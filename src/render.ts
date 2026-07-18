// Turn a validated tour + the parsed diff into a single review page. Authored
// text and code are escaped server-side. The one client-side HTML insertion is
// locally rendered Mermaid SVG, parsed and sanitized before it reaches the DOM.
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PAGE_CSS, PAGE_JS } from './page-assets.js';
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from './progress-ui.js';
import { APP_BRAND } from './config.js';
import { BRAND_HEAD_LINKS, brandStoryMarkSvg } from './brand.js';
import { themeBootstrapScript, themeControl } from './theme.js';
import { buildReviewModel } from './view-model.js';
import { intraLineMap, type IntraSides } from './intra-line.js';
import { renderSplitRow, renderUnifiedRow, renderHunkGap, type RowTarget } from './diff-render.js';
import type {
  FileView,
  CodeStepView,
  ConceptStepView,
  ReviewModel,
  SbsRow,
  StepView,
  TrustView,
  UncoveredView,
  UnifiedRow,
} from './view-model.js';
import { normalizeComment } from './comments.js';
import type { Comment, CommentSeverity, CommentSide, CommentType, DiffFile, Tour, Turn } from './types.js';
import type { ReviewStateSummary } from './review-state.js';
import type { ReviewExclusionMetadata } from './noise.js';
import { readWholeFile } from './git.js';

export interface RenderInput {
  repo: string;
  tour: Tour;
  files: DiffFile[];
  baseLabel: string;
  /** Ref for the post-change side. Omitted means the live working tree. */
  headRef?: string;
  comments: Comment[];
  routeBase?: string;
  /** Repo display name for the breadcrumb. Falls back to the routeBase tail. */
  repoName?: string;
  /** Render the diff with no story: All-files default, Story tab → Generate. */
  storyless?: boolean;
  /** Version-aware local review state for rounds, verification, and timeline. */
  reviewState?: ReviewStateSummary;
  /** Render the complete change or only the delta since feedback was sent. */
  reviewMode?: 'full' | 'since';
  /** Opaque server-issued identity for lazy requests from this exact page. */
  reviewPageToken?: string;
  /** Snapshot marker used when reviewMode is `since`. */
  reviewFrom?: string;
  /** Whether this story was generated for the exact diff currently on screen. */
  storyFreshness?: 'current' | 'stale' | 'unverified';
  /** Files intentionally omitted from the bounded renderer, never hidden from scope. */
  excludedFiles?: ReviewExclusionMetadata[];
  /** Paths whose staged and working-tree bytes are different review states. */
  stagedWorktreeDivergentFiles?: string[];
}

const FLAVOR_LABEL: Record<CommentType, string> = {
  change: 'Change request',
  question: 'Question',
  nit: 'Nit',
};
const FLAVOR_ICON: Record<CommentType, string> = { change: '◆', question: '?', nit: '○' };
const STATUS_LABEL: Record<Comment['status'], string> = {
  open: 'Open',
  addressed: 'Needs verification',
  resolved: 'Resolved',
};
const SEVERITY_LABEL: Record<CommentSeverity, string> = {
  blocking: 'Blocking',
  concern: 'Concern',
  nit: 'Minor',
};

function commentSeverity(comment: Comment): CommentSeverity {
  if (comment.severity === 'blocking' || comment.severity === 'concern' || comment.severity === 'nit') {
    return comment.severity;
  }
  return comment.type === 'nit' ? 'nit' : comment.type === 'change' ? 'blocking' : 'concern';
}

function commentSide(c: Comment): CommentSide {
  return c.side === 'left' ? 'left' : 'right';
}

function jsonForDataScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function threadForTargets(targets: Array<RowTarget | undefined>, comments: Comment[]): string {
  const here = comments.filter((c) =>
    targets.some((t) => t && commentSide(c) === t.side && c.file === t.file && c.line === t.line),
  );
  if (!here.length) return '';
  return `<div class="ds-thread">${here.map(commentHtml).join('')}</div>`;
}

export function renderPage(input: RenderInput): string {
  const { repo, tour, files, baseLabel, comments, headRef } = input;
  const routeBase = input.routeBase ?? '';
  const storyless = input.storyless ?? false;
  const reviewMode = input.reviewMode ?? 'full';
  const storyFreshness = storyless ? 'current' : (input.storyFreshness ?? 'current');
  const reviewState = input.reviewState ?? {
    scopeKey: '',
    round: 1,
    currentDiffHash: '',
    changedFiles: [],
    hasChangesSinceReview: false,
    events: [],
    snapshots: [],
    blockingFeedbackDigest: '',
    feedbackHealth: { status: 'healthy' as const, source: 'missing' as const },
  };
  const excludedFiles = input.excludedFiles ?? [];
  const indexDivergentFiles = input.stagedWorktreeDivergentFiles ?? [];
  const model = buildReviewModel(repo, tour, files, headRef, { storyless });
  const pageTitle = storyless ? 'Reviewing the diff' : tour.title;
  // Navigation is 0-based with the Overview as index 0, so step i lands at i + 1.
  // Every [data-goto-step] target (file chips, trust drawer) reads from this map.
  const stepIndexById = new Map(model.steps.map((s, i) => [s.id, i + 1]));

  const openCount = comments.filter((c) => c.status !== 'resolved').length;
  const blockingOpenCount = comments.filter(
    (comment) => comment.status !== 'resolved' && commentSeverity(comment) === 'blocking',
  ).length;
  const sendableCount = comments.filter((c) => c.status === 'open').length;
  const uncoveredCount = model.trust.uncovered.length;
  const focusedStory = !!tour.storyScope?.excludedFiles?.length;
  const feedbackHealthy = reviewState.feedbackHealth?.status !== 'invalid';
  const feedbackRecovery = reviewState.feedbackHealth?.status === 'invalid'
    ? reviewState.feedbackHealth.recovery
    : '';
  const verdictEvaluation = reviewState.verdict;
  const currentVerdict = verdictEvaluation?.state === 'current' ? verdictEvaluation.current : undefined;
  const currentApproved = currentVerdict?.decision === 'approved';
  const approveReady =
    feedbackHealthy &&
    blockingOpenCount === 0 &&
    uncoveredCount === 0 &&
    storyFreshness === 'current' &&
    excludedFiles.length === 0 &&
    indexDivergentFiles.length === 0 &&
    reviewMode === 'full' &&
    !focusedStory;
  // No story → no coverage to report, so the coverage row is meaningless; hide it.
  const showTrustPill = !storyless || excludedFiles.length > 0 || indexDivergentFiles.length > 0;
  const trustPillClean = !indexDivergentFiles.length && (storyless || (storyFreshness === 'current' && !uncoveredCount));
  const trustPill = showTrustPill
    ? `<button class="ds-trustpill${trustPillClean ? ' is-clean' : ''}${excludedFiles.length || indexDivergentFiles.length ? ' has-exclusions' : ''}" data-trust-open title="Trust check — story freshness, coverage, staged state, and files outside the bounded renderer">${
        indexDivergentFiles.length
          ? `<span class="ds-tri">▲</span><span><b>${indexDivergentFiles.length}</b> staged/working-tree ${plural(indexDivergentFiles.length, 'mismatch')} · reconcile before approval</span><span class="ds-review-row-arrow">›</span>`
          : storyless && excludedFiles.length
            ? `<span class="ds-tri">▲</span><span><b>${excludedFiles.length}</b> excluded ${plural(excludedFiles.length, 'file')} · inspect before approval</span><span class="ds-review-row-arrow">›</span>`
          : storyFreshness !== 'current'
          ? `<span class="ds-tri">▲</span><span><b>${storyFreshness === 'stale' ? 'Out of date' : 'Unverified'}</b> story · regenerate before approval</span><span class="ds-review-row-arrow">›</span>`
          : uncoveredCount
          ? `<span class="ds-tri">▲</span><span><b>${uncoveredCount}</b> ${plural(uncoveredCount, 'change')} not explained by the story</span><span class="ds-review-row-arrow">›</span>`
          : `<span class="ds-check">✓</span><span>${focusedStory ? 'Story covers its selected scope' : 'Story covers the rendered diff'}${excludedFiles.length ? ` · <b>${excludedFiles.length}</b> excluded ${plural(excludedFiles.length, 'file')} to inspect` : ''}</span><span class="ds-review-row-arrow">›</span>`
      }</button>`
    : '';

  const railCards = storyRail(model.steps);
  const railFiles = railFileTree(model.files, comments, reviewState.changedFiles);
  const stepPanels = model.steps
    // The Overview is active initially, so keep only its adjacent first step in
    // the document. Later steps load when approached instead of multiplying a
    // large story's highlighted diff rows in the initial DOM.
    .map((s, i) =>
      i === 0
        ? stepPanel(repo, s, i, model.totalSteps, comments, stepIndexById)
        : lazyStepPanel(s, i),
    )
    .join('');
  const filePanels = model.files.map((f, i) => filePanel(f, i, stepIndexById)).join('');
  const reviewModeControls = reviewState.compareFrom
    ? `<div class="ds-roundmodes ds-review-menu-modes" role="group" aria-label="Review comparison" title="${
        reviewState.changedFiles.length
          ? `${reviewState.changedFiles.length} ${plural(reviewState.changedFiles.length, 'file')} changed since your feedback`
          : 'No code changes since your feedback'
      }">
        <button type="button" data-review-mode="full" class="${reviewMode === 'full' ? 'is-active' : ''}" aria-pressed="${reviewMode === 'full'}">Full change</button>
        <button type="button" data-review-mode="since" class="${reviewMode === 'since' ? 'is-active' : ''}"${
          reviewState.changedFiles.length ? '' : ' disabled'
        } aria-pressed="${reviewMode === 'since'}">Since review</button>
      </div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#0a0c0f" data-ds-theme-color>
${themeBootstrapScript()}
${BRAND_HEAD_LINKS}
<title>${esc(APP_BRAND)} — ${esc(pageTitle)}</title>
<style>${PAGE_CSS}${progressPanelStyles()}</style>
</head>
<body${storyless ? ' data-storyless="1"' : ''} data-story-freshness="${storyFreshness}" data-feedback-health="${feedbackHealthy ? 'healthy' : 'invalid'}"${focusedStory ? ' data-story-scope="focused"' : ''} data-repo="${esc(repo)}" data-viewed-scope="${esc(`${repo}|${reviewState.scopeKey || baseLabel}|${reviewMode}`)}" data-review-scope="${esc(
    reviewState.scopeKey,
  )}" data-review-round="${reviewState.round}" data-feedback-version="${reviewState.feedbackVersion ?? 0}" data-blocking-feedback-digest="${esc(
    reviewState.blockingFeedbackDigest ?? '',
  )}" data-review-snapshot="${esc(
    reviewState.currentSnapshotId ?? '',
  )}" data-current-diff-hash="${esc(reviewState.currentDiffHash)}" data-review-page-token="${esc(
    input.reviewPageToken ?? '',
  )}"${input.reviewFrom ? ` data-review-from="${esc(input.reviewFrom)}"` : ''} data-verdict-state="${verdictEvaluation?.state ?? 'none'}" data-verdict-decision="${currentVerdict?.decision ?? ''}" data-current-review-mode="${reviewMode}"${reviewMode === 'since' ? ' data-initial-view="files"' : ''}>
<header class="ds-reviewchrome${storyless ? '' : ' is-storyful'}${reviewState.compareFrom ? ' has-review-modes' : ''}" data-review-chrome${storyless ? ' data-storyless-chrome' : ' data-story-chrome'}>
  <div class="ds-reviewchrome-rail">
    <div class="ds-reviewchrome-nav">
      <button class="ds-sidebar-toggle" data-sidebar-toggle aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar">
        <span class="ds-ui-icon" aria-hidden="true">${reviewChromeIcon('menu')}</span>
      </button>
      <a class="ds-back" data-close-story href="${esc(routeBase)}/change" title="Back to change scope" aria-label="Back to change scope">
        <span class="ds-ui-icon" aria-hidden="true">${reviewChromeIcon('back')}</span><span>Change</span>
      </a>
    </div>
  </div>
  <div class="ds-reviewchrome-main">
    <div class="ds-reviewchrome-mobile-nav">
      <button class="ds-sidebar-toggle" data-sidebar-toggle aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar">
        <span class="ds-ui-icon" aria-hidden="true">${reviewChromeIcon('menu')}</span>
      </button>
      <a class="ds-back" data-close-story href="${esc(routeBase)}/change" title="Back to change scope" aria-label="Back to change scope">
        <span class="ds-ui-icon" aria-hidden="true">${reviewChromeIcon('back')}</span><span class="ds-sr-only">Change</span>
      </a>
    </div>
    <div class="ds-titlewrap">
      <div class="ds-title" title="${esc(pageTitle)}">Diff review</div>
      <div class="ds-reviewchrome-subtitle">Working tree <span>vs</span> <b>${esc(baseLabel)}</b></div>
    </div>
    <div class="ds-reviewchrome-utilities">
      ${
        storyless
          ? ''
          : `<button class="ds-readaloud ds-readaloud-primary" data-readaloud type="button" title="Play story" aria-label="Play story" aria-pressed="false">
        <span class="ds-readaloud-ico" aria-hidden="true">▶</span>
        <span class="ds-readaloud-label" data-readaloud-label>Play</span>
      </button>`
      }
      ${themeControl()}
  <div class="ds-actions">
    ${
      storyless
        ? `<button class="ds-reload-diff" data-reload-diff type="button" title="Re-read the working tree and refresh this diff" aria-label="Reload diff">
        <span class="ds-ui-icon ds-reload-icon" aria-hidden="true">${reviewChromeIcon('refresh')}</span>
        <span data-reload-label>Reload</span>
      </button>`
        : ''
    }
    <div class="ds-review-menu-wrap">
      <button class="ds-review-menu${approveReady ? ' is-clean' : ''}" data-review-menu data-unexplained-count="${uncoveredCount}" data-excluded-count="${excludedFiles.length}" data-index-divergence-count="${indexDivergentFiles.length}" data-story-freshness="${storyFreshness}" aria-haspopup="dialog" aria-expanded="false" aria-label="Review, ${openCount} unresolved ${plural(openCount, 'comment')}${!feedbackHealthy ? ', feedback file needs repair' : indexDivergentFiles.length ? `, ${indexDivergentFiles.length} staged and working-tree ${plural(indexDivergentFiles.length, 'version')} differ` : storyFreshness !== 'current' ? ', story requires regeneration before approval' : uncoveredCount ? `, ${uncoveredCount} ${plural(uncoveredCount, 'change')} not explained by the story` : excludedFiles.length ? `, ${excludedFiles.length} excluded ${plural(excludedFiles.length, 'file')} require acknowledgement` : ''}" title="Open review status">
        <span class="ds-ui-icon ds-review-menu-icon" aria-hidden="true">${reviewChromeIcon('review')}</span>
        <span class="ds-review-menu-label">Review</span>
        <span class="ds-review-menu-count" id="ds-open-count" title="Unresolved comments"${openCount ? '' : ' hidden'}><b>${openCount}</b><span class="ds-review-menu-count-label"> ${plural(openCount, 'comment')}</span></span>
        <span class="ds-ui-icon ds-review-menu-caret" aria-hidden="true">${reviewChromeIcon('chevron')}</span>
      </button>
      <div class="ds-review-menu-pop" data-review-menu-pop role="dialog" aria-label="Review status and actions" tabindex="-1" hidden>
        <div class="ds-review-menu-title"><span>Review</span><small>Round ${reviewState.round}</small></div>
        ${reviewModeControls}
        <div class="ds-review-summary">
          <span class="ds-review-summary-label"><span class="ds-dot ds-dot-amber"></span><span><b>${openCount}</b> unresolved ${plural(openCount, 'comment')}</span></span>
          ${!feedbackHealthy ? `<div class="ds-feedback-health-alert" role="alert"><strong>Feedback file needs repair</strong><span>${esc(feedbackRecovery)}</span></div>` : ''}
          ${trustPill}
        </div>
        <div class="ds-review-section">
        <button class="ds-review-option" data-feedback-open="feedback"${comments.length ? '' : ' disabled'}>
          <span class="ds-review-option-title">Feedback <span class="ds-option-count" data-feedback-count${comments.length ? '' : ' hidden'}>${comments.length}</span></span>
          <span class="ds-review-option-desc">Verify replies and resolve comments.</span>
        </button>
        <button class="ds-review-option" data-feedback-open="timeline">
          <span class="ds-review-option-title">Timeline</span>
          <span class="ds-review-option-desc">Review rounds, comments, and agent runs.</span>
        </button>
        <button class="ds-review-option" data-feedback-open="challenge">
          <span class="ds-review-option-title">Challenge pass</span>
          <span class="ds-review-option-desc">Re-read failure paths, boundaries, and missing tests before deciding.</span>
        </button>
        </div>
        <div class="ds-review-decision">
          <div class="ds-review-section-label">Decision</div>
          ${verdictSummary(reviewState)}
          <label class="ds-verdict-note"><span>Decision note <small>optional</small></span><textarea data-verdict-note rows="2" placeholder="Why are you approving or requesting changes?"></textarea></label>
        <button class="ds-review-option ds-review-option-approve${currentApproved ? ' is-current' : ''}" data-verdict="approve"${approveReady && !currentApproved ? '' : ' disabled'} title="${
          approveReady
            ? 'This exact full diff is covered and has no unresolved blocking feedback'
            : reviewMode === 'since'
              ? 'Return to Full change before making a whole-change decision'
              : !feedbackHealthy
                ? 'Repair .diffstory/comments.json and reload before approval'
              : indexDivergentFiles.length
                ? 'Reconcile staged and working-tree versions before approval'
              : focusedStory
                ? 'This story covers only a selected scope; use a full-change review before approval'
            : storyFreshness !== 'current'
              ? 'Regenerate the story for this exact diff before approval'
              : excludedFiles.length
                ? 'Inspect and acknowledge files omitted from the bounded renderer first'
                : 'Resolve open comments and make sure every rendered change is explained first'
        }">
          <span class="ds-review-option-title"><span class="ds-check">✓</span> ${currentApproved ? 'Approved' : 'Approve'}</span>
          <span class="ds-review-option-desc" data-approve-desc>${
            approveReady
              ? 'The full rendered diff is covered, exclusions are clear, and no blocking feedback remains.'
              : reviewMode === 'since'
                ? 'Return to Full change before approving the whole change.'
                : !feedbackHealthy
                  ? feedbackRecovery
                : indexDivergentFiles.length
                  ? `Reconcile ${indexDivergentFiles.length} staged/working-tree ${plural(indexDivergentFiles.length, 'mismatch')} before approval.`
                : focusedStory
                  ? 'This story omits changed files. Review the full change before approving.'
              : blockingOpenCount
                ? `Resolve ${blockingOpenCount} blocking ${plural(blockingOpenCount, 'comment')} first.`
                : storyFreshness !== 'current'
                  ? 'Regenerate the story for this exact diff first.'
                : excludedFiles.length
                  ? `Inspect and acknowledge ${excludedFiles.length} excluded ${plural(excludedFiles.length, 'file')} first.`
                  : `Explain ${uncoveredCount} more ${plural(uncoveredCount, 'change')} in the story first.`
          }</span>
        </button>
        <button class="ds-review-option ds-review-option-request" data-verdict="changes-requested">
          <span class="ds-review-option-title">Request changes</span>
          <span class="ds-review-option-desc">Save a durable decision for this exact diff. Open comments remain the actionable detail.</span>
        </button>
        </div>
        <details class="ds-review-more">
          <summary>More review actions <span aria-hidden="true">⌄</span></summary>
          <div class="ds-review-more-list">
            <a class="ds-review-option" href="${esc(routeBase)}/stories">
              <span class="ds-review-option-title">Saved reviews</span>
              <span class="ds-review-option-desc">Open older review sessions for this repository.</span>
            </a>
            <button class="ds-review-option ds-agent-target is-empty" data-agent-target-control data-agent-target-select type="button" title="Choose the Codex task that receives review questions">
              <span class="ds-review-option-title"><span class="ds-agent-target-icon" aria-hidden="true">◈</span> Agent task · <span data-agent-target-name>Choose task</span></span>
              <span class="ds-review-option-desc">Used only when you send feedback or ask for another pass.</span>
            </button>
            <button class="ds-review-option" data-address-all${sendableCount ? '' : ' disabled'} title="Resend every open comment to your agent">
              <span class="ds-review-option-title">Resend open comments</span>
              <span class="ds-review-option-desc" data-agent-target-batch>Choose an agent task first.</span>
            </button>
            <button class="ds-review-option" data-copy-comments="open"${sendableCount ? '' : ' disabled'} title="Copy open comments as text">
              <span class="ds-review-option-title">Copy open comments</span>
            </button>
            <button class="ds-review-option" data-copy-comments="all"${comments.length ? '' : ' disabled'} title="Copy every comment, including resolved ones and replies">
              <span class="ds-review-option-title">Copy full review</span>
            </button>
          </div>
        </details>
      </div>
    </div>
  </div>
  </div>
  </div>
</header>

<div class="ds-live-banner" data-live-banner role="status" aria-live="polite" aria-atomic="true" aria-label="Live review status" hidden>
  <span data-live-message>Live review updated.</span>
  <button type="button" data-live-reload>Reload</button>
  <button type="button" data-live-dismiss aria-label="Dismiss live review status">×</button>
</div>

<div id="ds-agentpanel">${progressPanelMarkup('floating')}</div>

<div class="ds-layout">
  <aside class="ds-rail" aria-label="Review navigation">
    <div class="ds-railpad">
      <div class="ds-viewtoggle" role="tablist">
        <button class="ds-tab is-active" id="ds-tab-tour" data-view="tour" role="tab" aria-controls="ds-view-tour" aria-selected="true" tabindex="0">Story</button>
        <button class="ds-tab" id="ds-tab-files" data-view="files" role="tab" aria-controls="ds-view-files" aria-selected="false" tabindex="-1">All files</button>
      </div>
      <button class="ds-resume-review" data-resume-review type="button" hidden><span aria-hidden="true">↩</span><span data-resume-review-label>Resume where you stopped</span></button>
    </div>
    ${introCard(model)}
    <div class="ds-readhead" data-rail="tour">
      <div class="ds-readhead-row">
        <span class="ds-readhead-label">Reading order</span>
        <span class="ds-readhead-count" id="ds-progress-text">${
          storyless ? 'No story yet' : readingOrderLabel(model)
        }</span>
      </div>
      <div class="ds-readhead-track"><div class="ds-readhead-fill" id="ds-progress-fill"></div></div>
    </div>
    <div class="ds-readhead" data-rail="files" hidden>
      <div class="ds-readhead-row">
        <span class="ds-readhead-label">Files</span>
        <span class="ds-readhead-count" data-viewed-progress>${model.files.length} ${plural(model.files.length, 'file')}</span>
      </div>
      <div class="ds-filetools">
        <label class="ds-file-search"><span aria-hidden="true">⌕</span><input data-file-search type="search" placeholder="Search files or changed code" aria-label="Search changed file paths, declarations, and code"></label>
        <details class="ds-filefilter-menu">
          <summary>Filter: <strong data-file-filter-label>All</strong><span aria-hidden="true">⌄</span></summary>
          <div class="ds-filefilters" role="group" aria-label="File filters">
            <button class="is-active" data-file-filter="all" aria-pressed="true">All</button>
            <button data-file-filter="reviewed" aria-pressed="false">Reviewed</button>
            <button data-file-filter="unreviewed" aria-pressed="false">Unreviewed</button>
            <button data-file-filter="comments" aria-pressed="false">Comments</button>
            <button data-file-filter="unexplained" aria-pressed="false">Unexplained</button>
            <button data-file-filter="tests" aria-pressed="false">Tests</button>
            ${reviewState.compareFrom ? '<button data-file-filter="since" aria-pressed="false">Since review</button>' : ''}
          </div>
        </details>
        <button class="ds-next-unviewed" data-next-unviewed type="button">Next unreviewed <span aria-hidden="true">→</span></button>
      </div>
    </div>
    <div class="ds-railscroll">
      <div class="ds-railsteps" data-rail="tour">
        <div class="ds-spine"></div>
        ${railCards}
      </div>
      <div class="ds-railfiles" data-rail="files" hidden>
        ${railFiles || '<div class="ds-empty ds-empty-rail">No files in this change.</div>'}
      </div>
    </div>
    <div class="ds-rail-resizer" data-sidebar-resizer role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabindex="0" title="Resize sidebar"></div>
  </aside>
  <button class="ds-rail-scrim" data-sidebar-scrim type="button" aria-label="Close review navigation" aria-hidden="true" tabindex="-1"></button>

  <main class="ds-main">
    <div class="ds-view" id="ds-view-tour" role="tabpanel" aria-labelledby="ds-tab-tour" tabindex="0">
      ${storyless ? generateCta(model, routeBase, tour.base, headRef) : introPanel(model, tour, storyFreshness, routeBase)}
      ${storyless ? '' : stepPanels}
      ${storyless ? '' : `<button type="button" class="ds-ghost ds-ghost-prev" data-ghost-prev hidden tabindex="-1" aria-hidden="true"><span class="ds-ghost-num"></span><span class="ds-ghost-label"></span></button><button type="button" class="ds-ghost ds-ghost-next" data-ghost-next hidden tabindex="-1" aria-hidden="true"><span class="ds-ghost-num"></span><span class="ds-ghost-label"></span></button>`}
      ${storyless ? storylessThread() : filmstripThread(model.steps)}
    </div>
    <div class="ds-view" id="ds-view-files" role="tabpanel" aria-labelledby="ds-tab-files" tabindex="0" hidden>
      <div class="ds-filedetail" id="ds-file-detail">
        ${filePanels || '<div class="ds-empty">No files in this change.</div>'}
      </div>
    </div>
  </main>
</div>

${trustDrawer(model.trust, stepIndexById, excludedFiles, indexDivergentFiles, storyless)}
${feedbackDrawer(repo, headRef, comments, reviewState, model)}
${commandPalette()}
<div class="ds-selection-menu" data-selection-menu role="menu" hidden>
  <button type="button" role="menuitem" data-selection-action="question">Ask</button>
  <button type="button" role="menuitem" data-selection-action="change">Ask for change</button>
  <button type="button" role="menuitem" data-selection-action="nit">Nit</button>
</div>
<div class="ds-toast" id="ds-toast" role="status" aria-live="polite" aria-atomic="true" aria-relevant="additions text"></div>
<noscript><div class="ds-empty">diffStory needs JavaScript to drive the review.</div></noscript>
<script type="application/json" id="ds-initial-comments">${jsonForDataScript(comments)}</script>
<script>${progressPanelScript()}</script>
<script>${PAGE_JS}</script>
</body>
</html>`;
}

// ---- sidebar ----

function reviewChromeIcon(name: 'menu' | 'back' | 'refresh' | 'review' | 'chevron'): string {
  const paths: Record<typeof name, string> = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    refresh: '<path d="M20 11a8.1 8.1 0 0 0-14.9-4.4L3 10"/><path d="M3 4v6h6M4 13a8.1 8.1 0 0 0 14.9 4.4L21 14"/><path d="M21 20v-6h-6"/>',
    review: '<path d="M6.5 5.5h11A2.5 2.5 0 0 1 20 8v6a2.5 2.5 0 0 1-2.5 2.5H11L6 20v-3.5A2.5 2.5 0 0 1 3.5 14V8A2.5 2.5 0 0 1 6 5.5Z"/><path d="M8 9.5h8M8 13h5"/>',
    chevron: '<path d="m8 10 4 4 4-4"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[name]}</svg>`;
}

function verdictSummary(state: ReviewStateSummary): string {
  const verdict = state.verdict;
  if (!verdict || verdict.state === 'none') {
    return '<div class="ds-verdict-state is-none">No decision saved for this diff.</div>';
  }
  if (verdict.state === 'stale') {
    const previous = verdict.latest?.decision === 'approved' ? 'approval' : 'change request';
    const reason = verdict.invalidationReason === 'scope-changed'
      ? 'the review scope changed'
      : verdict.invalidationReason === 'feedback-changed'
        ? 'blocking feedback changed'
        : 'the diff changed';
    return `<div class="ds-verdict-state is-stale">Previous ${previous} is stale because ${reason}.</div>`;
  }
  const current = verdict.current;
  if (!current) return '<div class="ds-verdict-state is-none">No decision saved for this diff.</div>';
  return `<div class="ds-verdict-state ${current.decision === 'approved' ? 'is-approved' : 'is-requested'}"><strong>${
    current.decision === 'approved' ? 'Approved' : 'Changes requested'
  }</strong><span>Bound to this exact diff · ${esc(relativeTime(current.createdAt))}</span>${
    current.note ? `<small>${esc(current.note)}</small>` : ''
  }</div>`;
}

// The Overview sits above the numbered steps as navigation index 0 — the calm
// entry point that answers "what is this change?" before the walkthrough begins.
function introCard(model: ReviewModel): string {
  return `<button class="ds-stepcard is-intro is-active" data-rail="tour" data-intro data-step-index="0" title="The whole change at a glance, before the walkthrough">
    <span class="ds-num">${STORY_MARK}</span>
    <span class="ds-stepcard-body">
      <span class="ds-stepcard-title">Overview</span>
      <span class="ds-intro-cardsub">The change at a glance${model.totalSteps ? ` · ${readingOrderLabel(model)}` : ''}</span>
    </span>
  </button>`;
}

// A rail card carries only what tells steps apart: the number, the headline, and
// the file's base name (full path on hover). The kind badge appears only when it
// is *not* a plain change — "Changed" on every card is noise, so it is dropped.
function railCard(s: StepView, i: number): string {
  if (s.kind === 'concept') {
    return `<div class="ds-railstory-node" data-story-step-node="${i + 1}">
      <button class="ds-stepcard is-concept" data-step-index="${i + 1}" data-step-id="${esc(s.id)}">
        <span class="ds-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="ds-stepcard-body">
          <span class="ds-stepcard-title">${esc(s.title)}</span>
          <span class="ds-stepcard-fileline">
            <span class="ds-stepcard-file">Concept primer</span>
          </span>
        </span>
      </button>
    </div>`;
  }
  const base = splitPath(s.file)[1];
  const badge =
    s.kind === 'changed'
      ? ''
      : `<span class="ds-railbadge ds-badge-${s.kind === 'new-file' ? 'new' : 'context'}">${esc(
          s.kindLabel,
        )}</span>`;
  return `<div class="ds-railstory-node" data-story-step-node="${i + 1}">
    <button class="ds-stepcard" data-step-index="${i + 1}" data-step-id="${esc(s.id)}">
      <span class="ds-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="ds-stepcard-body">
        <span class="ds-stepcard-title">${esc(s.title)}</span>
        <span class="ds-stepcard-fileline">
          <span class="ds-stepcard-file" title="${esc(s.file)}">${esc(base)}</span>${badge}
        </span>
      </span>
    </button>
    ${railBeatTree(s, i + 1)}
  </div>`;
}

function railBeatTree(step: CodeStepView, stepIndex: number): string {
  if (!step.beats.length) return '';
  const health = step.health.broad
    ? `<span class="ds-railbeats-health" title="${esc(step.health.reasons.join(' · '))}"><i aria-hidden="true"></i>Broad</span>`
    : '';
  const beats = step.beats.map((beat) => `<button type="button" class="ds-railbeat" data-rail-beat data-rail-step-index="${stepIndex}" data-focus-group="${beat.focusGroup}" aria-pressed="false" title="${esc(beat.text)}" aria-label="Beat ${beat.focusGroup + 1}: ${esc(beat.text)}">
      <span class="ds-railbeat-marker">${String(beat.focusGroup + 1).padStart(2, '0')}</span>
      <span class="ds-railbeat-text">${esc(railBeatLabel(beat.text))}</span>
    </button>`).join('');
  return `<div class="ds-railbeats" aria-label="Review beats for ${esc(step.title)}">
    <div class="ds-railbeats-head">
      <span>Review beats</span>${health}<span class="ds-railbeats-count" data-rail-current>1 / ${step.beats.length}</span>
      ${storyRepairMenu(step, true)}
    </div>
    <div class="ds-railbeat-list">${beats}</div>
  </div>`;
}

function railBeatLabel(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 64) return clean;
  const clipped = clean.slice(0, 64);
  const boundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, boundary > 42 ? boundary : 64).replace(/[,:;\s]+$/, '')}…`;
}

function storyRail(steps: StepView[]): string {
  if (steps.length <= 10) return steps.map((step, index) => railCard(step, index)).join('');
  const explicit = steps.some((step) => step.chapter);
  const groups: Array<{ label: string; items: Array<{ step: StepView; index: number }> }> = [];
  if (explicit) {
    steps.forEach((step, index) => {
      const label = step.chapter || 'More to review';
      const previous = groups[groups.length - 1];
      if (previous?.label === label) previous.items.push({ step, index });
      else groups.push({ label, items: [{ step, index }] });
    });
  } else {
    const size = 6;
    for (let start = 0; start < steps.length; start += size) {
      const groupIndex = groups.length;
      const end = Math.min(steps.length, start + size);
      const label = groupIndex === 0
        ? 'Start here'
        : end === steps.length
          ? 'Boundaries and proof'
          : `Follow the flow · ${groupIndex + 1}`;
      groups.push({ label, items: steps.slice(start, end).map((step, offset) => ({ step, index: start + offset })) });
    }
  }
  return groups.map((group, index) => `<details class="ds-railchapter" data-story-chapter${index === 0 ? ' open' : ''}>
    <summary><span>${esc(group.label)}</span><small>${group.items.length} ${plural(group.items.length, 'step')}</small></summary>
    <div class="ds-railchapter-steps">${group.items.map(({ step, index: stepIndex }) => railCard(step, stepIndex)).join('')}</div>
  </details>`).join('');
}

// Filmstrip navigation (Signal 3b): a horizontal numeral thread that is the whole
// Story-view navigation. Node 0 is the Overview; nodes 1..N are the steps. Wired to
// setActive via data-goto-step; activateStep syncs active/read/unread + the line fill.
function filmNodeLabel(s: StepView): string {
  if (s.kind === 'concept') return 'Concept';
  return splitPath(s.file)[1];
}
function filmstripThread(steps: StepView[]): string {
  const nodes = [
    `<button type="button" class="ds-filmnode is-overview is-active" data-thread-node="0" data-goto-step="0" aria-label="Overview">
      <span class="ds-filmnode-num" aria-hidden="true">◆</span><span class="ds-filmnode-label">Overview</span>
    </button>`,
    ...steps.map(
      (s, i) => `<button type="button" class="ds-filmnode" data-thread-node="${i + 1}" data-goto-step="${i + 1}" aria-label="Step ${i + 1}: ${esc(s.title)}" title="${esc(s.title)}">
      <span class="ds-filmnode-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="ds-filmnode-label">${esc(filmNodeLabel(s))}</span>
    </button>`,
    ),
  ].join('');
  return `<nav class="ds-filmthread" data-filmthread aria-label="Reading order" style="--thread-pct:0%">
    <div class="ds-filmthread-scroll">
      <div class="ds-filmthread-nodes"><div class="ds-filmthread-line" aria-hidden="true"></div>${nodes}</div>
    </div>
    <button type="button" class="ds-filmthread-allfiles" data-open-all-files>All files <span aria-hidden="true">→</span></button>
  </nav>`;
}

// Storyless Story view has no numerals to walk, but it still needs the thread bar's
// "All files" escape — the rail (and its tabs) is hidden outside the files view, so
// without this the generate screen would be a navigation dead end.
function storylessThread(): string {
  return `<nav class="ds-filmthread is-storyless" data-filmthread aria-label="Review navigation">
    <div class="ds-filmthread-scroll"></div>
    <button type="button" class="ds-filmthread-allfiles" data-open-all-files>All files <span aria-hidden="true">→</span></button>
  </nav>`;
}

// The Overview panel: the change's title and summary up front (this is the only
// place the summary is shown in full), a few orienting facts, and one button into
// the walkthrough. It is navigation index 0 — shown first, before any step.
function introPanel(
  model: ReviewModel,
  tour: Tour,
  freshness: 'current' | 'stale' | 'unverified',
  routeBase: string,
): string {
  const trust = model.trust.uncovered.length;
  const first = model.steps[0];
  const intent = tour.intent;
  const summaryText = tour.summary && tour.summary.trim() ? nl(esc(tour.summary.trim())) : '';
  const goalText = intent?.goal?.trim() ? nl(esc(intent.goal.trim())) : '';
  // With a recovered intent the goal leads and the summary becomes the reading
  // map; without one the summary (or a generic line) is the lede, as before.
  const lede =
    goalText ||
    summaryText ||
    'Each step builds on the one before it — read them in order, or jump to any file from the list.';
  const design =
    goalText && intent?.design?.trim()
      ? `<p class="ds-intro-design" data-speech-overview>${nl(esc(intent.design.trim()))}</p>`
      : '';
  const map = goalText && summaryText ? `<p class="ds-intro-design" data-speech-overview>${summaryText}</p>` : '';
  const filesLabel = `${plural(model.filesChanged, 'file')} changed${
    model.contextFiles ? ` · ${model.contextFiles} for context` : ''
  }`;
  const trustFact = freshness !== 'current'
    ? `<div class="ds-fact ds-fact-warn"><span class="ds-fact-n">▲</span><span class="ds-fact-l">${
        freshness === 'stale' ? 'story is out of date' : 'story freshness unverified'
      }</span></div>`
    : trust
    ? `<div class="ds-fact ds-fact-warn"><span class="ds-fact-n">▲ ${trust}</span><span class="ds-fact-l">unexplained ${plural(
        trust,
        'change',
      )}</span></div>`
    : `<div class="ds-fact ds-fact-ok"><span class="ds-fact-n">✓</span><span class="ds-fact-l">${
        tour.storyScope?.excludedFiles?.length ? 'selected story scope explained' : 'rendered diff explained'
      }</span></div>`;
  const freshnessNote = freshness === 'current'
    ? ''
    : `<div class="ds-freshness-callout" role="status"><span><b>${
        freshness === 'stale' ? 'The diff changed after this story was generated.' : 'This older story has no exact diff fingerprint.'
      }</b> Review the current diff without relying on coverage, or regenerate the story before approval.</span><a href="${esc(routeBase)}/change">Regenerate story</a></div>`;
  const start = first
    ? `<button class="ds-intro-start" data-goto-step="1">
        <span class="ds-intro-start-main">Start the walkthrough <span class="ds-intro-arrow">→</span></span>
        <span class="ds-intro-start-sub">Step 1 · ${esc(first.title)}</span>
      </button>`
    : '';
  return `<section class="ds-step is-intro" data-step-panel="0">
    <div class="ds-introwrap">
      <span class="ds-intro-eyebrow">${STORY_MARK}<span>The story of this change</span></span>
      <h1 class="ds-intro-title">${esc(tour.title)}</h1>
      <p class="ds-intro-lede" data-speech-overview>${lede}</p>
      ${freshnessNote}
      ${start}
      ${design || map ? `<div class="ds-intro-context">${design}${map}</div>` : ''}
      <div class="ds-intro-facts">
        <div class="ds-fact"><span class="ds-fact-n">${model.codeSteps}</span><span class="ds-fact-l">${plural(
    model.codeSteps,
    'code step',
  )}${model.conceptSteps ? ` · ${model.conceptSteps} ${plural(model.conceptSteps, 'primer')}` : ''}</span></div>
        <div class="ds-fact"><span class="ds-fact-n">${model.filesChanged}</span><span class="ds-fact-l">${filesLabel}</span></div>
        <div class="ds-fact"><span class="ds-fact-n"><span class="ds-stat-add">+${model.totalAdd}</span> <span class="ds-stat-del">−${model.totalDel}</span></span><span class="ds-fact-l">lines</span></div>
        ${trustFact}
      </div>
    </div>
  </section>`;
}

interface ReviewCue {
  label: string;
  source: 'authored' | 'suggested';
}

function reviewCues(step: StepView): ReviewCue[] {
  if (step.kind === 'concept') return [{ label: 'Context', source: 'suggested' }];
  const authored = step.tags
    .map(humanizeTag)
    .filter(Boolean)
    .map((label) => ({ label, source: 'authored' as const }));
  const text = `${step.title} ${step.why} ${step.file}`.toLowerCase();
  const suggested: ReviewCue[] = [];
  const add = (label: string, pattern: RegExp) => {
    if (pattern.test(text)) suggested.push({ label, source: 'suggested' });
  };
  add('Security', /auth|permission|access|role|signature|nonce|reentr|security/);
  add('State change', /state|storage|schema|migration|persist|cache|transaction/);
  add('Value movement', /fee|price|payment|balance|transfer|amount|token/);
  add('Failure path', /error|revert|guard|fallback|retry|failure|invalid|edge/);
  add('API contract', /api|route|endpoint|interface|public|request|response/);
  add('Test coverage', /(^|\W)test|spec|fixture|mock/);
  const combined = [...authored, ...suggested];
  if (!combined.length) combined.push({ label: 'Behavior', source: 'suggested' });
  return combined.filter((cue, index, all) => all.findIndex((candidate) => candidate.label === cue.label) === index);
}

function humanizeTag(tag: string): string {
  const clean = tag.replace(/[-_]+/g, ' ').trim();
  return clean ? clean[0].toUpperCase() + clean.slice(1) : 'Behavior';
}

const REVIEW_FOCUS_PHRASES: Record<string, string> = {
  Entrypoint: "the flow's entry point",
  'Entry point': "the flow's entry point",
  'Caller identity': 'the caller identity seen at the next boundary',
  Security: 'permission and trust boundaries',
  'State change': 'the state that can change',
  'Value movement': 'how value and balances move',
  'Failure path': 'failure and rollback behavior',
  'API contract': 'the public contract and compatibility',
  'Test coverage': 'the behavior the tests prove',
  Behavior: 'the intended behavior',
  Context: 'the surrounding context this change depends on',
};

function naturalList(items: string[]): string {
  if (items.length < 2) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function reviewFocus(step: StepView): string {
  if (step.kind !== 'concept') return step.question;
  const phrases = reviewCues(step)
    .map((cue) => REVIEW_FOCUS_PHRASES[cue.label])
    .filter((phrase): phrase is string => Boolean(phrase))
    .filter((phrase, index, all) => all.indexOf(phrase) === index)
    .slice(0, 4);
  return phrases.length ? `Check ${naturalList(phrases)}.` : 'Check that this step behaves as described.';
}

// The Story tab when there's no story yet: generation controls live beside the
// full diff, and the request carries the same base/head scope the viewer opened.
function fileExtension(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i) : '';
}

function storyScopeControls(files: FileView[]): string {
  const changed = files.filter((f) => f.kind !== 'context');
  const scopeOpen = changed.length <= 12 ? ' open' : '';
  const extButtons = [...new Set(changed.map((f) => fileExtension(f.file)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map(
      (ext) =>
        `<button class="ds-scopechip" type="button" data-story-ext="${esc(ext)}">Only ${esc(ext)}</button>`,
    )
    .join('');
  const rows = changed
    .map(
      (file) =>
        `<label class="ds-storyfile" title="${esc(file.file)}">` +
        `<input type="checkbox" data-story-file value="${esc(file.file)}" checked>` +
        `<span class="ds-storyfile-path">${esc(file.file)}</span>` +
        `<span class="ds-storyfile-stat"><span class="ds-stat-add">+${file.add}</span><span class="ds-stat-del">−${file.del}</span></span>` +
        `</label>`,
    )
    .join('');
  return `<label class="ds-storygen-field ds-field-note">
      <span class="ds-storygen-labelrow">
        <span class="ds-storygen-label">What should this change accomplish?</span>
        <span class="ds-storygen-optional">Optional · recommended</span>
      </span>
      <textarea id="storyReviewerNote" rows="4" placeholder="Paste the request, acceptance criteria, or anything the story must not miss."></textarea>
      <small class="ds-storygen-help">This helps the agent separate intended behavior from accidental changes.</small>
    </label>
    <details class="ds-storyscope" data-story-scope${scopeOpen}>
      <summary>
        <span class="ds-storyscope-copy">
          <span class="ds-storygen-label">Files to cover</span>
          <small>Every selected file gets the same coverage check.</small>
        </span>
        <span class="ds-storyscope-summary">
          <strong aria-live="polite"><b id="storyScopeCount">${changed.length}</b> of ${changed.length} selected</strong>
          <span class="ds-storyscope-edit">Change</span>
          <span class="ds-storyscope-caret" aria-hidden="true">⌄</span>
        </span>
      </summary>
      <div class="ds-storyscope-body">
        <label class="ds-storyfile-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" data-story-file-search placeholder="Find a file" aria-label="Find a story file">
        </label>
        <div class="ds-storyscope-actions" aria-label="Story file selection shortcuts">
          <button class="ds-scopechip" type="button" data-story-scope-action="all">Select all</button>
          <button class="ds-scopechip" type="button" data-story-scope-action="source">Only source</button>
          <button class="ds-scopechip" type="button" data-story-scope-action="tests">Only tests</button>
          <button class="ds-scopechip" type="button" data-story-scope-action="config">Only config</button>
          <button class="ds-scopechip" type="button" data-story-scope-action="none">Clear</button>
          ${extButtons}
        </div>
        <div class="ds-storyfiles">${rows}</div>
        <p class="ds-storyscope-error" id="storyScopeError" tabindex="-1" hidden>Select at least one file before generating the story.</p>
      </div>
    </details>`;
}

function generateCta(model: ReviewModel, routeBase: string, baseRef?: string, headRef?: string): string {
  const filesLabel = `${plural(model.filesChanged, 'file')} changed${
    model.contextFiles ? ` · ${model.contextFiles} for context` : ''
  }`;
  const dataBase = baseRef ? ` data-base="${esc(baseRef)}"` : '';
  const dataHead = headRef ? ` data-head="${esc(headRef)}"` : '';
  return `<section class="ds-step is-intro" data-step-panel="0">
    <div class="ds-introwrap">
      <span class="ds-intro-eyebrow">${STORY_MARK}<span>No story yet</span></span>
      <h1 class="ds-intro-title">Read the diff, or have the agent narrate it</h1>
      <p class="ds-intro-lede">The real diff is under <b>All files</b>. Keep reading it directly, or generate a story for this exact scope.</p>
      <div class="ds-intro-facts">
        <div class="ds-fact"><span class="ds-fact-n">${model.filesChanged}</span><span class="ds-fact-l">${filesLabel}</span></div>
        <div class="ds-fact"><span class="ds-fact-n"><span class="ds-stat-add">+${model.totalAdd}</span> <span class="ds-stat-del">−${model.totalDel}</span></span><span class="ds-fact-l">lines</span></div>
      </div>
      <div class="ds-storygen-card">
        <div class="ds-storygen-head">
          <div>
            <span class="ds-storygen-eyebrow">Story setup</span>
            <strong>Choose how the story should guide your review</strong>
            <p>Every mode reviews the same selected changes. Depth changes the grouping, context, and explanation—not the coverage.</p>
          </div>
        </div>
        <div class="ds-storygen-grid">
          <fieldset class="ds-storygen-field ds-field-detail">
            <legend class="ds-storygen-label">Review depth</legend>
            <p class="ds-storygen-help" id="storyDepthHelp">Choose how much guidance you want, not how much code you are willing to miss.</p>
            <input id="storyMode" type="hidden" value="guided" />
            <div class="ds-depthchoices" role="radiogroup" aria-label="Story depth" aria-describedby="storyDepthHelp">
              <button class="ds-depthchoice" type="button" role="radio" data-story-choice="storyMode" data-value="brief" aria-checked="false" tabindex="-1">
                <span class="ds-depthchoice-top"><span class="ds-depthchoice-radio" aria-hidden="true"></span><strong>Compact</strong><span class="ds-depthchoice-badge">Shortest</span></span>
                <span class="ds-depthchoice-desc">Groups related edits into the fewest useful stops and keeps low-risk mechanical detail brief.</span>
                <span class="ds-depthchoice-meta">Same selected changes</span>
              </button>
              <button class="ds-depthchoice is-active" type="button" role="radio" data-story-choice="storyMode" data-value="guided" aria-checked="true" tabindex="0">
                <span class="ds-depthchoice-top"><span class="ds-depthchoice-radio" aria-hidden="true"></span><strong>Guided review</strong><span class="ds-depthchoice-badge is-recommended">Recommended</span></span>
                <span class="ds-depthchoice-desc">Follows intent, behavior, and code flow with the context that matters—without narrating every line.</span>
                <span class="ds-depthchoice-meta">Same selected changes</span>
              </button>
              <button class="ds-depthchoice" type="button" role="radio" data-story-choice="storyMode" data-value="detailed" aria-checked="false" tabindex="-1">
                <span class="ds-depthchoice-top"><span class="ds-depthchoice-radio" aria-hidden="true"></span><strong>Deep review</strong><span class="ds-depthchoice-badge">Most detail</span></span>
                <span class="ds-depthchoice-desc">Adds smaller stops for guards, branches, state writes, errors, side effects, and tests.</span>
                <span class="ds-depthchoice-meta">Trivial syntax stays skipped</span>
              </button>
            </div>
          </fieldset>
          <div class="ds-storygen-field ds-field-agent is-wide">
            <span class="ds-storygen-label">Writer</span>
            <input id="storyAgentSel" type="hidden" value="" />
            <div class="ds-choicegroup" id="storyAgentChoices" role="radiogroup" aria-label="Story writer"></div>
            <p class="ds-storygen-agent-state" data-story-agent-state aria-live="polite" tabindex="-1">Checking available writers…</p>
          </div>
          <div class="ds-storygen-field ds-field-model" data-story-quality-field hidden>
            <span class="ds-storygen-label">Quality</span>
            <input id="storyModelSel" type="hidden" value="" />
            <div class="ds-choicegroup" id="storyModelChoices" role="radiogroup" aria-label="Story quality"></div>
          </div>
          ${storyScopeControls(model.files)}
        </div>
        <button class="ds-intro-start ds-storygen-button" data-generate-story disabled data-review-url="${esc(
          routeBase,
        )}/review?story=story.json"${dataBase}${dataHead}>
          <span class="ds-intro-start-main"><span data-storygen-cta-label>Generate guided review</span> <span class="ds-intro-arrow">→</span></span>
          <span class="ds-intro-start-sub" data-storygen-cta-sub>${plural(
            model.filesChanged,
            'file',
          )} selected · gaps are flagged as Unexplained</span>
        </button>
        <p class="ds-storygen-warn" id="storySkillWarn" hidden><span id="storySkillWarnText"></span><button class="ds-storygen-fix" id="storySkillUpdateBtn" type="button">Update skills</button></p>
      </div>
    </div>
  </section>`;
}

type FileTreeChild = FileTreeDir | FileTreeFile;

interface FileTreeDir {
  kind: 'dir';
  name: string;
  path: string;
  children: FileTreeChild[];
  dirs: Map<string, FileTreeDir>;
  count: number;
  add: number;
  del: number;
  untoured: number;
}

interface FileTreeFile {
  kind: 'file';
  file: FileView;
  index: number;
}

interface FileFilterMeta {
  comments: Set<string>;
  since: Set<string>;
}

const FILE_TREE_CHEVRON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.75 3.75 4.25 4.25-4.25 4.25"/></svg>';
const FILE_TREE_FOLDER =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.75 4.25h4.1l1.4 1.5h7v7.5H1.75z"/></svg>';
const FILE_TREE_FILE =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.75 1.75h5.1l3.4 3.4v9.1h-8.5z"/><path d="M8.75 1.75v3.5h3.5"/></svg>';

function railFileTree(files: FileView[], comments: Comment[], sinceFiles: string[]): string {
  if (!files.length) return '';
  const root = createFileTreeDir('', '');
  files.forEach((file, index) => addFileTreeEntry(root, file, index));
  const meta: FileFilterMeta = {
    comments: new Set(comments.filter((comment) => comment.status !== 'resolved').map((comment) => comment.file)),
    since: new Set(sinceFiles),
  };
  return `<div class="ds-filetree">${renderFileTreeChildren(root.children, 0, meta)}</div>`;
}

function createFileTreeDir(name: string, path: string): FileTreeDir {
  return { kind: 'dir', name, path, children: [], dirs: new Map(), count: 0, add: 0, del: 0, untoured: 0 };
}

function addFileTreeEntry(root: FileTreeDir, file: FileView, index: number): void {
  const parts = file.file.split('/').filter(Boolean);
  parts.pop();
  let node = root;
  addFileTreeStats(node, file);

  let path = '';
  for (const part of parts) {
    path += `${part}/`;
    let dir = node.dirs.get(part);
    if (!dir) {
      dir = createFileTreeDir(part, path);
      node.dirs.set(part, dir);
      node.children.push(dir);
    }
    addFileTreeStats(dir, file);
    node = dir;
  }

  node.children.push({ kind: 'file', file, index });
}

function addFileTreeStats(node: FileTreeDir, file: FileView): void {
  node.count += 1;
  node.add += file.add;
  node.del += file.del;
  node.untoured += file.untoured;
}

function renderFileTreeChildren(children: FileTreeChild[], depth: number, meta: FileFilterMeta): string {
  return children
    .map((child) =>
      child.kind === 'dir' ? renderFileTreeDir(child, depth, meta) : railFileItem(child.file, child.index, depth, meta),
    )
    .join('');
}

function renderFileTreeDir(dir: FileTreeDir, depth: number, meta: FileFilterMeta): string {
  const stat = railFileStat(dir.add, dir.del);
  const flag = dir.untoured
    ? `<span class="ds-fileitem-flag" title="${dir.untoured} unexplained ${plural(dir.untoured, 'change')}">▲</span>`
    : '';
  return `<details class="ds-filetree-dir" data-filetree-path="${esc(dir.path)}" style="--tree-depth:${depth}" open>
    <summary class="ds-filetree-summary" style="--tree-indent:${depth * 14}px" title="${esc(dir.path)}">
      <span class="ds-filetree-caret" aria-hidden="true">${FILE_TREE_CHEVRON}</span>
      <span class="ds-filetree-folder" aria-hidden="true">${FILE_TREE_FOLDER}</span>
      <span class="ds-filetree-name">${esc(dir.name)}</span>
      <span class="ds-filetree-meta">
        <span class="ds-filetree-count">${dir.count} ${plural(dir.count, 'file')}</span>
        ${flag}
        <span class="ds-filetree-stat">${stat}</span>
      </span>
    </summary>
    <div class="ds-filetree-children">${renderFileTreeChildren(dir.children, depth + 1, meta)}</div>
  </details>`;
}

function railFileItem(f: FileView, i: number, depth: number, meta: FileFilterMeta): string {
  const [dir, base] = splitPath(f.file);
  const kindClass = f.kind === 'new' ? 'new' : f.kind;
  const stat = railFileStat(f.add, f.del);
  const flag = f.untoured
    ? `<span class="ds-fileitem-flag" title="${f.untoured} unexplained ${plural(f.untoured, 'change')}">▲</span>`
    : '';
  const isTest = /(^|\/)(__tests__|test|tests|spec)(\/|$)|\.(test|spec)\.[^.]+$/i.test(f.file);
  const reviewHash = fileReviewHash(f);
  const declarationTitle = f.symbols.length ? ` · Changed: ${f.symbols.slice(0, 2).join(', ')}` : '';
  const searchCode = f.hunks
    .flat()
    .filter((row) => row.type !== 'ctx')
    .map((row) => row.content)
    .join(' ')
    .toLowerCase();
  return `<button class="ds-fileitem${f.untoured ? ' is-untoured' : ''}" data-file-index="${i}" data-file-path="${esc(f.file)}" data-goto-file="${esc(
    f.file,
  )}" data-review-hash="${reviewHash}" data-filter-path="${esc(f.file.toLowerCase())}" data-filter-code="${esc(
    `${f.symbols.join(' ')} ${searchCode}`,
  )}" data-filter-status="${f.status}" data-filter-test="${
    isTest ? '1' : '0'
  }" data-filter-comments="${meta.comments.has(f.file) ? '1' : '0'}" data-filter-unexplained="${
    f.untoured ? '1' : '0'
  }" data-filter-since="${meta.since.has(f.file) ? '1' : '0'}" style="--tree-indent:${
    depth * 14
  }px" title="${esc(f.file)} — ${esc(f.kindLabel)}${esc(declarationTitle)}">
    <span class="ds-fileitem-spacer" aria-hidden="true"></span>
    <span class="ds-fileitem-icon k-${kindClass}" aria-hidden="true">${FILE_TREE_FILE}</span>
    <span class="ds-fileitem-path"><span class="ds-fileitem-base">${esc(base || dir)}</span></span>
    <span class="ds-fileitem-meta">
      ${flag}
      <span class="ds-fileitem-viewed" aria-hidden="true">✓</span>
      <span class="ds-fileitem-stat">${stat}</span>
    </span>
  </button>`;
}

function railFileStat(add: number, del: number): string {
  if (!add && !del) return '<span class="ds-dim">·</span>';
  return `${add ? `<span class="ds-stat-add">+${add}</span>` : ''}${
    del ? `<span class="ds-stat-del">−${del}</span>` : ''
  }`;
}

function changeJumpControls(): string {
  return `<div class="ds-changejump" data-change-nav hidden>
    <button class="ds-changebtn" data-change-prev title="Previous change (← / P)" aria-label="Previous change">←</button>
    <span class="ds-changecount" data-change-count>0 / 0</span>
    <button class="ds-changebtn" data-change-next title="Next change (→ / N)" aria-label="Next change">→</button>
  </div>`;
}

// ---- story tour ----

function lazyStepPanel(step: StepView, i: number): string {
  const kind = step.kind === 'concept' ? ' ds-concept-step' : ' is-code-step';
  return `<section class="ds-step ds-step-lazy${kind}" data-step-panel="${i + 1}" data-step-id="${esc(
    step.id,
  )}" data-step-lazy="1" hidden><div class="ds-step-loading" role="status">Loading this review step…</div></section>`;
}

/** Render one story step for the lazy review-step endpoint. */
export function renderStoryStepPanel(
  repo: string,
  model: ReviewModel,
  comments: Comment[],
  stepIndex: number,
): string {
  const step = model.steps[stepIndex];
  if (!step) return '<div class="ds-diffnote">That story step does not exist.</div>';
  const stepIndexById = new Map(model.steps.map((candidate, index) => [candidate.id, index + 1]));
  return stepPanel(repo, step, stepIndex, model.totalSteps, comments, stepIndexById);
}

function stepPanel(
  repo: string,
  step: StepView,
  i: number,
  total: number,
  comments: Comment[],
  stepIndexById: Map<string, number>,
): string {
  return step.kind === 'concept'
    ? conceptStepPanel(step, i, total, stepIndexById)
    : codeStepPanel(repo, step, i, total, comments);
}

function codeStepPanel(
  repo: string,
  s: CodeStepView,
  i: number,
  total: number,
  comments: Comment[],
): string {
  const editor = vscodeLink(repo, s.file, 1);
  const diffRegionId = `ds-story-diff-${i + 1}`;
  const nextDisabled = i === total - 1 ? ' disabled' : '';
  // Call-flow lives here now (not on every rail card). Only show the meaningful
  // cross-references — "Standalone"/"Final step" carry no navigation cue.
  const flow = /^(Calls|Returns)/.test(s.flow)
    ? `<span class="ds-flowchip" title="Call flow — where this step leads in the walkthrough"><span class="ds-flowico">↳</span>${esc(
        s.flow,
      )}</span>`
    : '';
  return `<section class="ds-step is-code-step" data-step-panel="${i + 1}" data-step-id="${esc(s.id)}" data-story-lens="focus"${
    s.focusExplicit ? ' data-story-focus="authored"' : ''
  } hidden>
    <div class="ds-step-top">
      <div class="ds-stage-num" aria-hidden="true">${String(s.order).padStart(2, '0')}</div>
      <div class="ds-step-meta">
        <span class="ds-step-count">Step ${s.order} of ${total}</span>
        <span class="ds-dot"></span>
        <span class="ds-badge ds-badge-${s.kind === 'new-file' ? 'new' : s.kind}">${esc(s.kindLabel)}</span>
        ${flow}
        <span class="ds-flex"></span>
        <span class="ds-step-pos">${s.order} / ${total}</span>
        <span class="ds-nav">
          <button class="ds-iconbtn" data-prev title="Previous story step" aria-label="Previous story step">←</button>
          <button class="ds-iconbtn" data-next title="Next story step" aria-label="Next story step"${nextDisabled}>→</button>
        </span>
      </div>
      <div class="ds-step-titlerow">
        <h1 class="ds-step-title">${esc(s.title)}</h1>
        <a class="ds-step-file" href="${editor}" title="Open ${esc(s.file)} in your editor">${esc(
          s.file,
        )}</a>
      </div>
    </div>
    <div class="ds-review-question">
      <span class="ds-review-question-dot" aria-hidden="true"></span>
      <span class="ds-sr-only">Review question: </span>
      <span class="ds-reviewfocus">${esc(reviewFocus(s))}</span>
      ${storyRepairMenu(s, true)}
    </div>
    <div class="ds-diffscroll">
      <div class="ds-diff" id="${diffRegionId}" data-diff data-story-diff data-file="${esc(s.file)}" role="region" aria-label="${esc(
        s.file,
      )} story diff"${s.newFile ? ' data-newfile="1"' : ''}>
        <div class="ds-difftoolbar">
          <span class="ds-difthint" data-difthint>Active beat at full strength</span>
          <span class="ds-flex"></span>
          <div class="ds-storylens" role="group" aria-label="Story attention level">
            <button class="is-active" data-story-lens="focus" aria-pressed="true">Focus</button>
            <button data-story-lens="full" aria-pressed="false">Full</button>
          </div>
          <button class="ds-full-diff" type="button" data-open-full-diff="${esc(s.file)}">All files</button>
          ${changeJumpControls()}
          <div class="ds-modetoggle" role="group" aria-label="Diff display mode">
            <button class="is-active" data-mode="diff" aria-pressed="true">Unified</button>
            <button data-mode="split" aria-pressed="false">Split</button>
            <button data-mode="full" aria-pressed="false">Full file</button>
          </div>
        </div>
        <div data-diff-inner>${storyUnifiedDiffInner(s, comments)}</div>
        <div data-split-inner data-loaded="1" hidden>${diffInner(s, comments)}</div>
        <div data-full-inner hidden></div>
      </div>
    </div>
    ${stepStoryHtml(s, diffRegionId)}
  </section>`;
}

function storyRepairMenu(step: CodeStepView, iconOnly = false): string {
  const healthTitle = step.health.broad ? ` Broad step: ${step.health.reasons.join(' · ')}.` : '';
  return `<details class="ds-story-tune${iconOnly ? ' is-icon' : ''}${step.health.broad ? ' has-health' : ''}">
    <summary aria-label="Repair this story step" title="Story repair options.${esc(healthTitle)}"><span aria-hidden="true">${iconOnly ? '•••' : 'Repair step'}</span></summary>
    <div class="ds-story-tune-pop"><button type="button" data-story-repair="rewrite" data-story-step="${esc(
      step.id,
    )}" data-story-file="${esc(step.file)}"><strong>Rewrite explanation</strong><small>Make the question and evidence sharper without changing the review path.</small></button><button type="button" data-story-repair="shorten" data-story-step="${esc(
      step.id,
    )}" data-story-file="${esc(step.file)}"><strong>Make shorter</strong><small>Condense this explanation without dropping its risk.</small></button><button type="button" data-story-repair="split" data-story-step="${esc(
      step.id,
    )}" data-story-file="${esc(step.file)}"><strong>Split into smaller stops</strong><small>Give each review question its own local camera.</small></button></div>
  </details>`;
}

function conceptStepPanel(
  s: ConceptStepView,
  i: number,
  total: number,
  stepIndexById: Map<string, number>,
): string {
  const nextDisabled = i === total - 1 ? ' disabled' : '';
  const next = s.preparesFor[0];
  const nextIndex = next ? stepIndexById.get(next.id) : undefined;
  const nextLink = next && nextIndex !== undefined
    ? `<button class="ds-concept-next" type="button" data-goto-step="${nextIndex}">
        <span class="ds-concept-next-kicker">Next in code · Step ${next.order}</span>
        <span class="ds-concept-next-title">${esc(next.title)}</span>
        <span class="ds-concept-next-arrow" aria-hidden="true">→</span>
      </button>`
    : '';
  const diagram = s.diagram
    ? `<figure class="ds-concept-diagram" data-concept-diagram>
        <div class="ds-concept-diagram-output" data-mermaid-output role="img" aria-label="${esc(
          s.diagram.caption,
        )}"><span class="ds-concept-diagram-loading">Drawing the mental model…</span></div>
        <pre data-mermaid-source hidden>${esc(s.diagram.source)}</pre>
        <figcaption>${esc(s.diagram.caption)}</figcaption>
        <details class="ds-concept-diagram-source" data-mermaid-fallback>
          <summary>Diagram source</summary>
          <pre><code>${esc(s.diagram.source)}</code></pre>
        </details>
      </figure>`
    : '';
  const speech = conceptSpeechText(s);
  return `<section class="ds-step ds-concept-step" data-step-panel="${i + 1}" data-step-id="${esc(s.id)}" hidden>
    <div class="ds-step-top">
      <div class="ds-stage-num" aria-hidden="true">${String(s.order).padStart(2, '0')}</div>
      <div class="ds-step-meta">
        <span class="ds-step-count">Step ${s.order} of ${total}</span>
        <span class="ds-dot"></span>
        <span class="ds-badge ds-badge-concept">Concept</span>
        <span class="ds-flex"></span>
        <span class="ds-step-pos">${s.order} / ${total}</span>
        <span class="ds-nav">
          <button class="ds-iconbtn" data-prev title="Previous story step" aria-label="Previous story step">←</button>
          <button class="ds-iconbtn" data-next title="Next story step" aria-label="Next story step"${nextDisabled}>→</button>
        </span>
      </div>
    </div>
    <div class="ds-concept-scroll">
      <article class="ds-concept-document" aria-labelledby="ds-concept-title-${i + 1}">
        <div class="ds-concept-heading">
          <span class="ds-concept-eyebrow"><span aria-hidden="true">◇</span> Mental model</span>
          <button class="ds-playstep" data-playstep title="Read this primer aloud" aria-label="Read this primer aloud">▸</button>
        </div>
        <h1 class="ds-concept-title" id="ds-concept-title-${i + 1}">${esc(s.title)}</h1>
        <div class="ds-concept-body ds-md">${renderMarkdown(s.body)}</div>
        ${diagram}
        ${nextLink}
        <span class="ds-sr-only" data-speech-concept>${esc(speech)}</span>
      </article>
    </div>
  </section>`;
}

function conceptSpeechText(s: ConceptStepView): string {
  const body = s.body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const caption = s.diagram?.caption?.trim();
  return [s.title, body, caption].filter(Boolean).join('. ');
}

function stepStoryHtml(s: CodeStepView, diffRegionId: string): string {
  if (!s.beats.length) return `<div class="ds-beatdock is-single">
    <span class="ds-beatdock-count">Review note</span>
    <p class="ds-why-text">${nl(esc(s.why))}</p>
    <button class="ds-playstep" data-playstep title="Read this step aloud" aria-label="Read this step aloud">▸</button>
  </div>`;
  return `<div class="ds-beatdock" data-beat-dock>
    <span class="ds-beatdock-count"><b data-beat-current>01</b><span>/ ${String(s.beats.length).padStart(2, '0')}</span></span>
    <div class="ds-beatdock-copy">
      <div class="ds-beats">${s.beats.map((beat) => beatHtml(beat, s.file, diffRegionId)).join('')}</div>
      <span class="ds-beatdock-hint">← → move beats</span>
    </div>
    <span class="ds-beatdock-actions">
      <button class="ds-playstep" data-playstep title="Read this step aloud" aria-label="Read this step aloud">▸</button>
      <button type="button" data-beat-move="-1" aria-label="Previous review beat" disabled>←</button>
      <button type="button" data-beat-move="1" aria-label="Next review beat">→</button>
    </span>
    <div class="ds-sr-only" data-story-focus-status aria-live="polite" aria-atomic="true"></div>
  </div>`;
}

function beatHtml(beat: CodeStepView['beats'][number], file: string, diffRegionId: string): string {
  const destination = beatDestination(file, beat.highlights);
  return `<button type="button" class="ds-beat ds-beatdock-note" data-story-beat data-speech-beat="${beat.focusGroup}" data-focus-group="${beat.focusGroup}" data-speech-text="${esc(
    beat.text,
  )}" data-focus-destination="${esc(destination)}" aria-controls="${diffRegionId}" aria-pressed="false" aria-label="Focus beat ${beat.focusGroup + 1}: ${esc(
    beat.text,
  )}"><span class="ds-beat-text">${nl(esc(beat.text))}</span></button>`;
}

function beatDestination(file: string, highlights: Array<[number, number]>): string {
  const ranges = highlights.map(([start, end]) => {
    if (start === 0 && end === 0) return 'deleted lines';
    return start === end ? `line ${start}` : `lines ${start} to ${end}`;
  });
  return `${file}, ${ranges.join(' and ')}`;
}

function storyUnifiedDiffInner(s: CodeStepView, comments: Comment[]): string {
  if (!s.blocks.length || !s.blocks.some((b) => b.length)) {
    return `<div class="ds-diffnote">${esc(s.note ?? 'Nothing to show for this step.')}</div>`;
  }
  const body = s.blocks
    .map((block, bi) => {
      const intra = intraLineMap(block, (r) => r.type, (r) => r.content);
      return (
        (bi > 0 ? renderHunkGap() : '') +
        block.map((row) => storyUnifiedRow(row, s, comments, bi, intra)).join('')
      );
    })
    .join('');
  const note =
    s.note && s.blocks.some((b) => b.length)
      ? `<div class="ds-diffnote ds-diffnote-soft">${esc(s.note)}</div>`
      : '';
  return `${storyUnifiedHead(s)}${note}<div class="ds-diffbody ds-diffbody-unified">${body}</div>`;
}

function storyUnifiedHead(s: CodeStepView): string {
  const label = s.context ? 'Context' : s.newFile ? 'New file' : 'Unified';
  const note = s.context ? 'unchanged — shown so the change makes sense' : s.newFile ? '' : 'before and after in one readable column';
  return `<div class="ds-diffhead ds-diffhead-ctx"><span class="ds-diffhead-side"><span class="ds-diffhead-label${
    s.newFile ? ' ds-green' : ''
  }">${label}</span><span class="ds-diffhead-path">${esc(s.file)}</span></span>${
    note ? `<span class="ds-diffhead-note">${note}</span>` : ''
  }</div>`;
}

function storyUnifiedRow(
  row: SbsRow,
  s: CodeStepView,
  comments: Comment[],
  blockIndex: number,
  intra?: Map<SbsRow, IntraSides>,
): string {
  const target =
    row.type === 'del' && row.oldNo !== undefined
      ? { side: 'left' as const, file: s.oldFile, line: row.oldNo }
      : row.newNo !== undefined
        ? { side: 'right' as const, file: s.file, line: row.newNo }
        : undefined;
  const unified: UnifiedRow = { type: row.type, no: target?.line, content: row.content, untoured: row.untoured };
  const side = row.type === 'del' ? intra?.get(row)?.left : row.type === 'add' ? intra?.get(row)?.right : undefined;
  const focusIndex = rowVoiceFocusIndex(row, s, blockIndex);
  const focusAttr = focusIndex === null ? '' : ` data-step-focus="${focusIndex}"`;
  const stepAttr = target ? ` data-step="${esc(s.id)}"` : '';
  const rowHtml = renderUnifiedRow(unified, target, side).replace(/^<div class="([^"]+)"/, `<div class="$1"${stepAttr}${focusAttr}`);
  return rowHtml + threadForTargets([target], comments);
}

function diffInner(s: CodeStepView, comments: Comment[]): string {
  if (!s.blocks.length || !s.blocks.some((b) => b.length)) {
    return `<div class="ds-diffnote">${esc(s.note ?? 'Nothing to show for this step.')}</div>`;
  }
  const head = diffHead(s);
  const hunkGap = () => (s.context || s.newFile ? renderHunkGap() : renderHunkGap(undefined, { split: true }));
  const body = s.blocks
    .map((block, bi) => {
      const intra = intraLineMap(block, (r) => r.type, (r) => r.content);
      return (
        (bi > 0 ? hunkGap() : '') +
        block.map((row) => sbsRow(row, s, comments, bi, intra)).join('')
      );
    })
    .join('');
  const note =
    s.note && s.blocks.some((b) => b.length)
      ? `<div class="ds-diffnote ds-diffnote-soft">${esc(s.note)}</div>`
      : '';
  return `${head}${note}<div class="ds-diffbody">${body}</div>`;
}

function diffHead(s: CodeStepView): string {
  if (s.context) {
    return `<div class="ds-diffhead ds-diffhead-ctx">
      <span class="ds-diffhead-side"><span class="ds-diffhead-label">Context</span><span class="ds-diffhead-path">${esc(
        s.file,
      )}</span></span>
      <span class="ds-diffhead-note">unchanged — shown so the change makes sense</span>
    </div>`;
  }
  if (s.newFile) {
    return `<div class="ds-diffhead ds-diffhead-ctx">
      <span class="ds-diffhead-side"><span class="ds-diffhead-label ds-green">New file</span><span class="ds-diffhead-path">${esc(
        s.file,
      )}</span></span>
    </div>`;
  }
  const leftLabel = s.newFile ? 'Did not exist' : 'Before';
  const rightLabel = s.newFile ? 'New file' : 'After';
  return `<div class="ds-diffhead">
    <span class="ds-diffhead-side ds-diffhead-side-l">
      <span class="ds-diffhead-label${s.newFile ? ' ds-dim' : ''}">${leftLabel}</span>
      ${s.newFile ? '' : `<span class="ds-diffhead-path">${esc(s.file)}</span>`}
    </span>
    <span class="ds-diffhead-divider"></span>
    <span class="ds-diffhead-side ds-diffhead-side-r">
      <span class="ds-diffhead-label${s.newFile ? ' ds-green' : ''}">${rightLabel}</span>
      <span class="ds-diffhead-path">${esc(s.file)}</span>
    </span>
  </div>`;
}

function sbsRow(
  row: SbsRow,
  s: CodeStepView,
  comments: Comment[],
  blockIndex: number,
  intra?: Map<SbsRow, IntraSides>,
): string {
  const leftTarget =
    !s.context && !s.newFile && row.oldNo !== undefined
      ? { side: 'left' as const, file: s.oldFile, line: row.oldNo }
      : undefined;
  const rightTarget =
    row.newNo !== undefined ? { side: 'right' as const, file: s.file, line: row.newNo } : undefined;
  const rowHtml = renderSplitRow(row, {
    leftTarget,
    rightTarget,
    stepId: s.id,
    focusIndex: rowVoiceFocusIndex(row, s, blockIndex),
    single: s.context || s.newFile,
    sides: intra?.get(row),
  });
  return rowHtml + threadForTargets([leftTarget, rightTarget], comments);
}

function rowVoiceFocusIndex(row: SbsRow, s: CodeStepView, blockIndex: number): number | null {
  const idx = s.focusGroups.findIndex((ranges) => ranges.some((range) => rowInFocusRange(row, s, range)));
  if (idx >= 0) {
    return s.focusExplicit ? idx : blockIndex;
  }
  return !s.focusExplicit && row.type === 'del' && s.kind === 'changed' ? blockIndex : null;
}

function rowInFocusRange(row: SbsRow, s: CodeStepView, [start, end]: [number, number]): boolean {
  if (row.newNo !== undefined) return row.newNo >= start && row.newNo <= end;
  return s.kind === 'changed' && row.type === 'del' && start === 0 && end === 0;
}

function turnHtml(t: Turn): string {
  if (t.role === 'user') {
    return `<div class="ds-comment-body ds-turn ds-turn-user ds-md">${renderMarkdown(t.text)}</div>`;
  }
  return `<div class="ds-reply ds-turn">
        <span class="ds-reply-av">◈</span>
        <div class="ds-reply-main">
          <div class="ds-reply-who"><span class="ds-reply-name">${esc(APP_BRAND)}</span><span class="ds-ai-badge">AI</span></div>
          <div class="ds-reply-body ds-md">${renderMarkdown(t.text)}</div>
        </div>
      </div>`;
}

export function commentHtml(c0: Comment): string {
  const c = normalizeComment(c0);
  const type = (['change', 'question', 'nit'] as CommentType[]).includes(c.type as CommentType)
    ? (c.type as CommentType)
    : 'change';
  const turns = c.turns ?? [];
  const turnsHtml = turns.map(turnHtml).join('');
  const hasReply = turns.some((t) => t.role === 'ai');
  const resolved = c.status === 'resolved';
  const severity = commentSeverity(c);
  const selectionLabel = commentSide(c) === 'left' ? 'Selected old side' : 'Selected new side';
  const selectionText = c.selectedText?.replace(/\s+/g, ' ').trim() ?? '';
  const selectionPreview = selectionText.length > 82 ? `${selectionText.slice(0, 79)}…` : selectionText;
  const selection = c.selectedText
    ? `<details class="ds-comment-selection"><summary><span class="ds-comment-selection-label">${selectionLabel}</span><code class="ds-comment-selection-preview">${esc(
        selectionPreview,
      )}</code><b class="ds-comment-selection-toggle" aria-hidden="true"></b></summary><code class="ds-comment-selection-code">${esc(
        c.selectedText,
      )}</code></details>`
    : '';
  return `<div class="ds-comment status-${c.status}" data-comment-id="${esc(c.id)}" data-status="${
    c.status
  }" data-comment-file="${esc(c.file)}" data-comment-line="${c.line}" data-comment-step="${esc(
    c.step ?? '',
  )}" data-comment-severity="${severity}"${hasReply ? ' data-hasreply="1"' : ''}>
    <div class="ds-comment-card flavor-${type}">
      <div class="ds-comment-head">
        <span class="ds-flavor-ico">${FLAVOR_ICON[type]}</span>
        <span class="ds-flavor-label">${FLAVOR_LABEL[type]}</span>
        <span class="ds-dot"></span>
        <span class="ds-comment-author">${esc(authorOf(c))}</span>
        <span class="ds-severity ds-severity-${severity}">${SEVERITY_LABEL[severity]}</span>
        <span class="ds-flex"></span>
        <span class="ds-statusbadge"><span class="ds-dot"></span>${STATUS_LABEL[c.status]}</span>
        <details class="ds-comment-menu">
          <summary aria-label="Conversation actions">•••</summary>
          <div class="ds-comment-menu-pop">
            <button data-resolve>${resolved ? 'Reopen' : 'Resolve'}</button>
            <button class="ds-del" data-delete>Delete conversation</button>
          </div>
        </details>
      </div>
      ${selection}
      <div class="ds-comment-body ds-md">${renderMarkdown(c.body)}</div>
      ${turnsHtml}
      <div class="ds-thread-composer">
        <textarea class="ds-thread-ta" data-thread-ta placeholder="Reply to ${esc(APP_BRAND)}…" rows="1"></textarea>
        <div class="ds-thread-composer-foot">
          <div class="ds-agent-route"><span class="ds-agent-route-icon" aria-hidden="true">◈</span><span>Agent task</span><strong data-agent-target-name>Choose task</strong><button data-agent-target-select type="button">Change</button></div>
          <div class="ds-thread-actions">
            <button class="ds-ghost ds-thread-add" data-thread-add title="Save without sending to the agent">Save</button>
            <button class="ds-btn ds-btn-solid ds-thread-send" data-thread-send data-agent-target-cta>Choose task &amp; ask</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function authorOf(_c: Comment): string {
  return 'You';
}

// ---- all files ----

function filePanel(f: FileView, i: number, stepIndexById: Map<string, number>): string {
  const reviewHash = fileReviewHash(f);
  return `<section class="ds-filepanel${f.untoured ? ' is-untoured' : ''}" data-file-panel="${i}" data-file="${esc(
    f.file,
  )}" data-review-hash="${reviewHash}"${f.kind === 'new' ? ' data-newfile="1"' : ''}${i === 0 ? '' : ' hidden'}>
    ${i === 0 ? renderFilePanelContent(f, stepIndexById) : '<div class="ds-filepanel-loading" data-file-panel-lazy role="status">Loading file review…</div>'}
  </section>`;
}

/** Inner master/detail panel markup, also served lazily for non-active files. */
export function renderFilePanelContent(f: FileView, _stepIndexById: Map<string, number>): string {
  const [dir, base] = splitPath(f.file);
  const canExpand = f.kind !== 'context' && f.hasFull;
  const gapBefore = (hi: number): string => {
    if (!canExpand) return hi > 0 ? renderHunkGap() : '';
    if (hi === 0) {
      const start = f.hunkRanges[0]?.[0] ?? 1;
      return start > 1 ? renderHunkGap({ file: f.file, from: 1, to: start - 1 }) : '';
    }
    const prevEnd = f.hunkRanges[hi - 1][1];
    const nextStart = f.hunkRanges[hi][0];
    return nextStart - prevEnd > 1
      ? renderHunkGap({ file: f.file, from: prevEnd + 1, to: nextStart - 1 })
      : renderHunkGap();
  };
  // A new file's whole content is the hunk — nothing is hidden past it, so the
  // trailing "reveal more" affordance would promise lines that can't exist.
  const gapAfterLast = canExpand && f.hunks.length && f.kind !== 'new'
    ? renderHunkGap({ file: f.file, from: f.hunkRanges[f.hunkRanges.length - 1][1] + 1, to: 'eof' })
    : '';
  const unified = f.hunks.length
    ? f.hunks
        .map((hunk, hi) => {
          const intra = intraLineMap(hunk, (r) => r.type, (r) => r.content);
          return gapBefore(hi) + hunk.map((r) => unifiedRow(r, f.file, f.oldFile, unifiedIntra(r, intra))).join('');
        })
        .join('') + gapAfterLast
    : '<div class="ds-diffnote">No diff to show.</div>';
  // Unified is the review-first default. Full-file and split views stay available
  // but are fetched only when the reviewer asks for them.
  const toggle = f.hasFull
    ? `<div class="ds-modetoggle" role="group" aria-label="Diff display mode"><button class="is-active" data-mode="diff" aria-pressed="true">Unified</button><button data-mode="split" aria-pressed="false">Split</button><button data-mode="full" aria-pressed="false">Full file</button></div>`
    : f.hunks.length
      ? `<div class="ds-modetoggle" role="group" aria-label="Diff display mode"><button class="is-active" data-mode="diff" aria-pressed="true">Unified</button><button data-mode="split" aria-pressed="false">Split</button></div>`
      : '';
  return `<div class="ds-filepanel-head">
      <span class="ds-cardpath"><span class="ds-dim">${esc(dir)}</span><span class="ds-cardpath-base">${esc(
        base,
      )}</span></span>
      <span class="ds-flex"></span>
      ${changeJumpControls()}
      <button type="button" class="ds-viewed-toggle" data-viewed-toggle aria-pressed="false" aria-label="Mark ${esc(
        f.file,
      )} reviewed" title="Mark reviewed (V)"><span class="ds-viewed-toggle-icon" aria-hidden="true">✓</span><span class="ds-viewed-toggle-label" data-viewed-label>Mark reviewed</span></button>
      ${toggle}
    </div>
    <div class="ds-filepanel-body">
      <div data-diff-inner><div class="ds-diffbody ds-diffbody-unified">${unified}</div></div>
      <div data-split-inner hidden></div>
      <div data-full-inner hidden></div>
    </div>
  `;
}

function fileReviewHash(file: FileView): string {
  const stableHunks = file.hunks.map((hunk) =>
    hunk.map((row) => ({
      type: row.type,
      no: row.no,
      content: row.content,
    })),
  );
  return createHash('sha256')
    // Story-derived presentation flags are intentionally absent: repairing the
    // narrative must not clear a review mark when the file diff is unchanged.
    .update(JSON.stringify([file.status, file.oldFile, file.file, file.hunkRanges, stableHunks]))
    .digest('hex')
    .slice(0, 64);
}

function unifiedRow(row: UnifiedRow, file: string, oldFile = file, intra?: string): string {
  const target =
    row.no === undefined
      ? undefined
      : {
          side: row.type === 'del' ? ('left' as const) : ('right' as const),
          file: row.type === 'del' ? oldFile : file,
          line: row.no,
        };
  return renderUnifiedRow(row, target, intra);
}

/** Look up a unified row's precomputed intra-line side (del→left, add→right). */
function unifiedIntra(row: UnifiedRow, map: Map<UnifiedRow, IntraSides>): string | undefined {
  const sides = map.get(row);
  return row.type === 'del' ? sides?.left : sides?.right;
}

type CommentAnchorState = 'current' | 'moved' | 'changed' | 'old-side' | 'legacy';

function commentAnchorState(repo: string, headRef: string | undefined, c: Comment): CommentAnchorState {
  if (commentSide(c) === 'left') return 'old-side';
  if (!c.selectedText) return 'legacy';
  const lines = readWholeFile(repo, c.file, headRef);
  if (!lines) return 'changed';
  const text = lines.join('\n');
  const index = text.indexOf(c.selectedText);
  if (index < 0) return 'changed';
  const currentLine = text.slice(0, index).split('\n').length;
  return currentLine === c.line ? 'current' : 'moved';
}

function anchorLabel(state: CommentAnchorState): string {
  if (state === 'moved') return 'Code moved';
  if (state === 'changed') return 'Code changed';
  if (state === 'old-side') return 'Old-side anchor';
  if (state === 'legacy') return 'Line anchor';
  return 'Anchor current';
}

function feedbackCard(repo: string, headRef: string | undefined, raw: Comment): string {
  const c = normalizeComment(raw);
  const anchor = commentAnchorState(repo, headRef, c);
  const latestAgent = [...(c.turns ?? [])].reverse().find((turn) => turn.role === 'ai');
  const verify = c.status === 'addressed';
  const severity = commentSeverity(c);
  const currentExcerpt = feedbackCurrentExcerpt(repo, headRef, c, anchor);
  return `<article class="ds-feedback-card status-${c.status}" data-feedback-card data-feedback-status="${c.status}" data-feedback-anchor="${anchor}" data-comment-id="${esc(
    c.id,
  )}" data-feedback-severity="${severity}" data-comment-file="${esc(c.file)}" data-comment-line="${c.line}" data-comment-step="${esc(c.step ?? '')}">
    <div class="ds-feedback-head">
      <span class="ds-flavor-ico">${FLAVOR_ICON[c.type] ?? FLAVOR_ICON.change}</span>
      <span class="ds-severity ds-severity-${severity}">${SEVERITY_LABEL[severity]}</span>
      <span class="ds-feedback-path">${esc(c.file)}<span class="ds-dim">:${c.line}</span></span>
      <span class="ds-flex"></span>
      <span class="ds-anchorbadge is-${anchor}">${anchorLabel(anchor)}</span>
    </div>
    ${c.selectedText ? `<div class="ds-feedback-compare"><div><span>Commented on</span><code class="ds-feedback-selection">${esc(c.selectedText)}</code></div>${currentExcerpt ? `<div><span>${anchor === 'moved' ? 'Current location' : 'Current region'}</span><code class="ds-feedback-selection is-current">${esc(currentExcerpt)}</code></div>` : ''}</div>` : ''}
    <div class="ds-feedback-message ds-md">${renderMarkdown(c.body)}</div>
    ${latestAgent ? `<div class="ds-feedback-reply ds-md"><span>${esc(APP_BRAND)}</span>${renderMarkdown(latestAgent.text)}</div>` : ''}
    <div class="ds-feedback-actions">
      <button type="button" class="ds-ghost" data-goto-comment="${esc(c.id)}">Show in diff</button>
      ${verify ? `<button type="button" class="ds-ghost" data-reopen-comment="${esc(c.id)}">Reopen</button><button type="button" class="ds-btn ds-btn-solid" data-accept-fix="${esc(c.id)}">Accept fix</button>` : ''}
      ${c.status === 'resolved' ? `<button type="button" class="ds-ghost" data-reopen-comment="${esc(c.id)}">Reopen</button>` : ''}
    </div>
  </article>`;
}

function feedbackCurrentExcerpt(
  repo: string,
  headRef: string | undefined,
  comment: Comment,
  state: CommentAnchorState,
): string | undefined {
  if (!comment.selectedText || (state !== 'changed' && state !== 'moved')) return undefined;
  const lines = readWholeFile(repo, comment.file, headRef);
  if (!lines?.length) return undefined;
  if (state === 'moved') return comment.selectedText;
  const count = Math.max(1, (comment.selection?.endLine ?? comment.line) - (comment.selection?.startLine ?? comment.line) + 1);
  const start = Math.max(0, comment.line - 1);
  return lines.slice(start, Math.min(lines.length, start + count)).join('\n') || undefined;
}

function feedbackDrawer(
  repo: string,
  headRef: string | undefined,
  comments: Comment[],
  state: ReviewStateSummary,
  model: ReviewModel,
): string {
  const addressed = comments.filter((comment) => comment.status === 'addressed').length;
  const cards = comments.length
    ? comments.map((comment) => feedbackCard(repo, headRef, comment)).join('')
    : '<div class="ds-drawer-empty">No review feedback yet.</div>';
  const events = reviewTimelineEventsHtml(state.events);
  return `<div class="ds-drawer-root" id="ds-feedback-drawer" hidden>
    <div class="ds-drawer-scrim" data-feedback-close></div>
    <div class="ds-drawer ds-feedback-drawer" role="dialog" aria-modal="true" aria-labelledby="ds-feedback-title" tabindex="-1">
      <div class="ds-drawer-head">
        <div><div class="ds-drawer-title" id="ds-feedback-title">Review loop</div><div class="ds-drawer-sub">Verify what changed, reopen anything unresolved, and keep the rounds honest.</div></div>
        <button class="ds-drawer-x" data-feedback-close title="Close" aria-label="Close review loop">×</button>
      </div>
      <div class="ds-drawer-tabs" role="tablist">
        <button class="is-active" id="ds-feedback-tab" data-feedback-panel="feedback" role="tab" aria-selected="true" aria-controls="ds-feedback-panel" tabindex="0">Feedback${addressed ? ` <span>${addressed}</span>` : ''}</button>
        <button id="ds-timeline-tab" data-feedback-panel="timeline" role="tab" aria-selected="false" aria-controls="ds-timeline-panel" tabindex="-1">Timeline</button>
        <button id="ds-challenge-tab" data-feedback-panel="challenge" role="tab" aria-selected="false" aria-controls="ds-challenge-panel" tabindex="-1">Challenge</button>
      </div>
      <div class="ds-feedback-filters" data-feedback-tools>
        <button class="is-active" data-feedback-filter="all">All</button>
        <button data-feedback-filter="blocking">Blocking</button>
        <button data-feedback-filter="addressed">Needs verification</button>
        <button data-feedback-filter="open">Open</button>
        <button data-feedback-filter="changed">Code changed</button>
        <button data-feedback-filter="resolved">Resolved</button>
      </div>
      <div class="ds-drawer-body ds-feedback-list" id="ds-feedback-panel" role="tabpanel" aria-labelledby="ds-feedback-tab" data-feedback-view="feedback">${cards}</div>
      <div class="ds-drawer-body" id="ds-timeline-panel" role="tabpanel" aria-labelledby="ds-timeline-tab" data-feedback-view="timeline" hidden><ol class="ds-review-timeline">${events}</ol></div>
      <div class="ds-drawer-body ds-challenge-panel" id="ds-challenge-panel" role="tabpanel" aria-labelledby="ds-challenge-tab" data-feedback-view="challenge" hidden>${challengeChecklist(model)}</div>
    </div>
  </div>`;
}

function challengeChecklist(model: ReviewModel): string {
  const specific = model.steps
    .map((step, index) => ({ step, index }))
    .filter((item) => item.step.kind !== 'concept')
    .slice(0, 5);
  const generic = [
    ['intent', 'Challenge the intent', 'Could the implementation be correct while solving the wrong user problem?'],
    ['failure', 'Trace failure and rollback', 'Follow errors, retries, partial writes, and cleanup—not only the happy path.'],
    ['boundary', 'Check trust boundaries', 'Re-check permissions, untrusted input, state transitions, and value movement.'],
    ['tests', 'Look for the missing test', 'Name the regression or edge case that would still escape the current suite.'],
  ];
  const items = generic.map(([id, title, detail]) => `<label class="ds-challenge-item"><input type="checkbox" data-challenge-check="${id}"><span><strong>${title}</strong><small>${detail}</small></span></label>`).join('');
  const targets = specific.map(({ step, index }) => `<button type="button" class="ds-challenge-target" data-goto-step="${index + 1}"><span>Review focus</span><strong>${esc(reviewFocus(step))}</strong><i aria-hidden="true">→</i></button>`).join('');
  return `<div class="ds-challenge-head"><strong>Adversarial review pass</strong><p>This checklist structures a human second pass; it does not certify the change.</p></div><div class="ds-challenge-list">${items}</div>${targets ? `<div class="ds-challenge-targets"><span>Cue-specific targets</span>${targets}</div>` : ''}`;
}

function relativeTime(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return 'recently';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** The one authority for review-timeline markup: the initial drawer render and
 * the /api/review-state live refresh must never drift apart. */
export function reviewTimelineEventsHtml(events: ReviewStateSummary['events']): string {
  if (!events.length) return '<li class="ds-drawer-empty">The timeline starts when this review is opened.</li>';
  return events
    .map(
      (event) => `<li class="ds-timeline-event"><span class="ds-timeline-dot kind-${event.kind}"></span><div><strong>${esc(
        event.label,
      )}</strong>${event.detail ? `<span>${esc(event.detail)}</span>` : ''}<small>Round ${event.round} · ${esc(
        relativeTime(event.at),
      )}</small></div></li>`,
    )
    .join('');
}

function commandPalette(): string {
  const commands = [
    ['story', 'Open Story', 'J / K', 'Move through the guided walkthrough'],
    ['files', 'Open All files', '/', 'Search and filter the changed files'],
    ['feedback', 'Review feedback', '', 'Verify agent replies and reopen comments'],
    ['timeline', 'Open review timeline', '', 'See rounds, comments, and agent runs'],
    ['next-unviewed', 'Next unreviewed file', '', 'Keep the review moving'],
    ['toggle-viewed', 'Toggle current file reviewed', 'V', 'Bind completion to this exact file diff'],
    ['read-aloud', 'Toggle read aloud', 'Space', 'Pause or resume narration'],
  ];
  return `<div class="ds-command-root" data-command-root hidden>
    <button class="ds-command-scrim" data-shortcuts-close aria-label="Close commands"></button>
    <div class="ds-command" role="dialog" aria-label="Commands and keyboard shortcuts">
      <div class="ds-command-head"><div><strong>Commands</strong><span>Keyboard-first review without hidden magic.</span></div><button data-shortcuts-close>×</button></div>
      <div class="ds-command-list">${commands
        .map(
          ([id, title, key, detail]) => `<button type="button" data-command="${id}"><span><strong>${title}</strong><small>${detail}</small></span>${
            key ? `<kbd>${key}</kbd>` : ''
          }</button>`,
        )
        .join('')}</div>
      <div class="ds-command-foot"><span><kbd>←</kbd><kbd>→</kbd> changes / narration</span><span><kbd>C</kbd> comment selection</span><span><kbd>?</kbd> commands</span></div>
    </div>
  </div>`;
}

// ---- trust drawer ----

function trustDrawer(
  trust: TrustView,
  stepIndexById: Map<string, number>,
  excludedFiles: ReviewExclusionMetadata[],
  indexDivergentFiles: string[],
  storyless: boolean,
): string {
  const clean = !trust.uncovered.length;
  const cards = trust.uncovered.map((u) => trustCard(u, stepIndexById)).join('');
  const body = storyless
    ? `<div class="ds-trust-clean">The full bounded diff is available file by file. No story-coverage claim is applied in this view.</div>`
    : clean
    ? `<div class="ds-trust-clean">✓ Every changed range in the bounded renderer is fully explained by a step.</div>`
    : `<div class="ds-trust-section">Unexplained ${plural(trust.uncovered.length, 'change')}</div>${cards}`;
  const exclusions = excludedFiles.length
    ? `<section class="ds-exclusions" aria-labelledby="ds-exclusions-title">
        <div class="ds-trust-section" id="ds-exclusions-title">Outside the bounded renderer · ${excludedFiles.length}</div>
        <p class="ds-exclusions-note">These files are part of the git change but are not included in story coverage or the default diff DOM. Inspect them deliberately before deciding.</p>
        ${excludedFiles.map(excludedFileCard).join('')}
        <label class="ds-exclusion-ack"><input type="checkbox" data-exclusions-ack><span><strong>I inspected these exclusions</strong><small>Bound to this exact diff; a code change clears the acknowledgement.</small></span></label>
      </section>`
    : '';
  const stagedState = indexDivergentFiles.length
    ? `<section class="ds-exclusions" aria-labelledby="ds-index-state-title">
        <div class="ds-trust-section" id="ds-index-state-title">Staged state differs · ${indexDivergentFiles.length}</div>
        <p class="ds-exclusions-note">These paths contain one version in Git's index and another in the working tree. A single combined diff cannot prove which version you intend to commit, so approval stays blocked until they match.</p>
        ${indexDivergentFiles.map((path) => `<article class="ds-exclusion-card"><div><code>${esc(path)}</code><span>Index and working tree contain different bytes</span></div></article>`).join('')}
      </section>`
    : '';
  return `<div class="ds-drawer-root" id="ds-trust-drawer" hidden>
    <div class="ds-drawer-scrim" data-trust-close></div>
    <div class="ds-drawer" role="dialog" aria-modal="true" aria-labelledby="ds-trust-title" tabindex="-1">
      <div class="ds-drawer-head">
        <div>
          <div class="ds-drawer-title" id="ds-trust-title">Trust check</div>
          <div class="ds-drawer-sub">${storyless ? 'Exact change scope, staging state, and files outside the bounded renderer.' : 'Coverage of the bounded review, plus every file kept outside it.'}</div>
        </div>
        <button class="ds-drawer-x" data-trust-close title="Close" aria-label="Close trust check">×</button>
      </div>
      <div class="ds-drawer-body">
        ${storyless ? '' : `<div class="ds-trust-stats">
          <div class="ds-trust-stat ok"><div class="ds-trust-num">${trust.coveredLines}</div><div class="ds-trust-lbl">changed ${plural(
            trust.coveredLines,
            'line',
          )} covered by a step</div></div>
          <div class="ds-trust-stat warn"><div class="ds-trust-num">${trust.uncoveredLines}</div><div class="ds-trust-lbl">${plural(
            trust.uncoveredLines,
            'change',
          )} no step explains</div></div>
        </div>`}
        ${body}
        ${stagedState}
        ${exclusions}
        <div class="ds-trust-foot">${storyless ? 'The page shows the bounded diff directly. Excluded files and divergent staged state remain separate reviewer responsibilities.' : 'Coverage means every rendered changed range is fully claimed by story steps. Excluded files remain a separate reviewer responsibility.'}</div>
      </div>
    </div>
  </div>`;
}

function excludedFileCard(file: ReviewExclusionMetadata): string {
  const reason =
    file.reason === 'generated-path'
      ? 'Generated or vendored path'
      : file.reason === 'large-diff'
        ? 'Large diff'
        : file.reason === 'binary'
          ? 'Binary or non-text change'
          : 'Metadata-only change';
  const lines = file.changedLines == null ? 'Binary or uncounted change' : `${file.changedLines} changed ${plural(file.changedLines, 'line')}`;
  return `<article class="ds-exclusion-card" data-excluded-file="${esc(file.path)}">
    <div><code>${esc(file.path)}</code><span>${reason} · ${lines}</span></div>
    <button type="button" class="ds-btn ds-btn-ghost" data-inspect-excluded="${esc(file.path)}">Inspect current file</button>
    <div class="ds-exclusion-preview" data-excluded-preview hidden></div>
  </article>`;
}

function trustCard(u: UncoveredView, stepIndexById: Map<string, number>): string {
  const intra = intraLineMap(u.rows, (r) => r.type, (r) => r.content);
  const rows = u.rows.length
    ? u.rows.map((r) => unifiedRow(r, u.file, u.file, unifiedIntra(r, intra))).join('')
    : `<div class="ds-diffnote">${esc(u.file)}:${u.line}</div>`;
  const stepIdx = u.stepId !== undefined ? stepIndexById.get(u.stepId) : undefined;
  const jump =
    stepIdx !== undefined
      ? `<button class="ds-btn ds-btn-solid" data-goto-step="${stepIdx}">Jump to ${esc(u.file)}</button>`
      : `<button class="ds-btn ds-btn-solid" data-goto-file="${esc(u.file)}">Show ${esc(u.file)}</button>`;
  return `<div class="ds-trust-card">
    <div class="ds-trust-card-head">
      <span class="ds-trust-card-path">${esc(u.file)}<span class="ds-dim">:${u.line}</span></span>
      <span class="ds-untoured-tag">UNEXPLAINED</span>
    </div>
    <div class="ds-diffbody ds-diffbody-unified">${rows}</div>
    <div class="ds-trust-card-note">This change is in the diff but no story step walks through it — surfaced here so nothing slips in unexplained.</div>
    <div class="ds-trust-card-actions">
      ${jump}
      <button class="ds-btn ds-btn-ghost" data-explain data-story-file="${esc(u.file)}" data-story-line="${u.line}">Ask ${esc(APP_BRAND)} to explain</button>
    </div>
  </div>`;
}

// ---- full file (used by the lazy /api/fullfile endpoint) ----

function splitHead(opts: { file: string; oldFile?: string; newFile: boolean }): string {
  const leftLabel = opts.newFile ? 'Did not exist' : 'Before';
  const rightLabel = opts.newFile ? 'New file' : 'After';
  return `<div class="ds-diffhead">
    <span class="ds-diffhead-side ds-diffhead-side-l"><span class="ds-diffhead-label${
      opts.newFile ? ' ds-dim' : ''
    }">${leftLabel}</span>${opts.newFile ? '' : `<span class="ds-diffhead-path">${esc(opts.oldFile ?? opts.file)}</span>`}</span>
    <span class="ds-diffhead-divider"></span>
    <span class="ds-diffhead-side ds-diffhead-side-r"><span class="ds-diffhead-label${
      opts.newFile ? ' ds-green' : ''
    }">${rightLabel}</span><span class="ds-diffhead-path">${esc(opts.file)}</span></span>
  </div>`;
}

export function renderFullFile(rows: SbsRow[], opts: { file: string; oldFile?: string; newFile: boolean }): string {
  if (!rows.length) {
    return `<div class="ds-diffnote">Couldn't read ${esc(opts.file)} from the working tree.</div>`;
  }
  const intra = intraLineMap(rows, (r) => r.type, (r) => r.content);
  const body = rows.map((r) => fullRow(r, opts, intra)).join('');
  return `${splitHead(opts)}<div class="ds-diffbody">${body}</div>`;
}

/** The lazily-loaded Split view for one All-files panel: hunks only,
 *  side-by-side, ⋯ gaps between hunks (expandable after Task 6). */
export function renderSplitHunks(
  blocks: SbsRow[][],
  opts: {
    file: string;
    oldFile?: string;
    newFile: boolean;
    hunkRanges?: Array<[number, number]>;
    canExpand?: boolean;
  },
): string {
  if (!blocks.length) return `<div class="ds-diffnote">No diff to show.</div>`;
  const hunkRanges = opts.hunkRanges;
  const canExpand = !!opts.canExpand && !!hunkRanges;
  const gapBefore = (bi: number): string => {
    if (!canExpand || !hunkRanges) return bi > 0 ? renderHunkGap(undefined, { split: true }) : '';
    if (bi === 0) {
      const start = hunkRanges[0]?.[0] ?? 1;
      return start > 1 ? renderHunkGap({ file: opts.file, from: 1, to: start - 1 }, { split: true }) : '';
    }
    const prevEnd = hunkRanges[bi - 1][1];
    const nextStart = hunkRanges[bi][0];
    return nextStart - prevEnd > 1
      ? renderHunkGap({ file: opts.file, from: prevEnd + 1, to: nextStart - 1 }, { split: true })
      : renderHunkGap(undefined, { split: true });
  };
  // A new file's whole content is the hunk — nothing is hidden past it (see
  // filePanel's matching guard), so it gets no trailing eof expand affordance.
  const gapAfterLast =
    canExpand && hunkRanges && blocks.length && !opts.newFile
      ? renderHunkGap({ file: opts.file, from: hunkRanges[hunkRanges.length - 1][1] + 1, to: 'eof' }, { split: true })
      : '';
  const body =
    blocks
      .map((block, bi) => {
        const intra = intraLineMap(block, (r) => r.type, (r) => r.content);
        return gapBefore(bi) + block.map((row) => fullRow(row, opts, intra)).join('');
      })
      .join('') + gapAfterLast;
  return `${splitHead(opts)}<div class="ds-diffbody">${body}</div>`;
}

/** Rows served by /api/diff/context, wrapped so the client can read the
 *  actually-served range. Context rows only. */
export function renderContextRows(
  rows: SbsRow[],
  layout: 'unified' | 'split',
  opts: { file: string; oldFile?: string; newFile: boolean },
): string {
  if (!rows.length) return `<div data-ctx-rows data-from="0" data-to="0"></div>`;
  const from = rows[0].newNo ?? 0;
  const to = rows[rows.length - 1].newNo ?? 0;
  const body =
    layout === 'split'
      ? rows.map((r) => fullRow(r, opts)).join('')
      : rows
          .map((r) =>
            unifiedRow({ type: 'ctx', no: r.newNo, content: r.content }, opts.file, opts.oldFile ?? opts.file),
          )
          .join('');
  return `<div data-ctx-rows data-from="${from}" data-to="${to}">${body}</div>`;
}

function fullRow(row: SbsRow, opts: { file: string; oldFile?: string; newFile: boolean }, intra?: Map<SbsRow, IntraSides>): string {
  const leftTarget =
    !opts.newFile && row.oldNo !== undefined
      ? { side: 'left' as const, file: opts.oldFile ?? opts.file, line: row.oldNo }
      : undefined;
  const rightTarget =
    row.newNo !== undefined ? { side: 'right' as const, file: opts.file, line: row.newNo } : undefined;
  return renderSplitRow(row, { leftTarget, rightTarget, sides: intra?.get(row) });
}

// ---- shared bits ----

// The brand mark in miniature, in currentColor so it tints with state.
const STORY_MARK = brandStoryMarkSvg('ds-storymark', 18, 18);

function splitPath(p: string): [string, string] {
  const i = p.lastIndexOf('/');
  return i < 0 ? ['', p] : [p.slice(0, i + 1), p.slice(i + 1)];
}

function plural(n: number, word: string): string {
  return n === 1 ? word : word + 's';
}

function readingOrderLabel(model: ReviewModel): string {
  if (!model.conceptSteps) return `${model.codeSteps} ${plural(model.codeSteps, 'step')}`;
  return `${model.codeSteps} ${plural(model.codeSteps, 'code step')} + ${model.conceptSteps} ${plural(
    model.conceptSteps,
    'primer',
  )}`;
}

function vscodeLink(repo: string, file: string, line: number): string {
  return `vscode://file${encodeURI(join(repo, file))}:${line}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl(s: string): string {
  return s.replace(/\n/g, '<br>');
}

function renderMarkdown(input: string): string {
  const lines = input.replace(/\r\n/g, '\n').trim().split('\n');
  const out: string[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(`<p>${renderInlineMarkdown(paragraph.join('\n'))}</p>`);
    paragraph = [];
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(4, heading[1].length);
      out.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const fence = line.match(/^```([\w-]+)?\s*$/);
    if (fence) {
      flushParagraph();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      const lang = fence[1] ? ` data-lang="${esc(fence[1])}"` : '';
      out.push(`<pre class="ds-md-code"${lang}><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      const quoted = [quote[1]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(/^>\s?(.*)$/);
        if (!next) break;
        quoted.push(next[1]);
        i += 1;
      }
      out.push(`<blockquote>${renderMarkdown(quoted.join('\n'))}</blockquote>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      const items = [bullet[1]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(/^\s*[-*]\s+(.+)$/);
        if (!next) break;
        items.push(next[1]);
        i += 1;
      }
      out.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      const items = [ordered[1]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(/^\s*\d+[.)]\s+(.+)$/);
        if (!next) break;
        items.push(next[1]);
        i += 1;
      }
      out.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ol>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return out.join('');
}

function renderInlineMarkdown(input: string): string {
  return input
    .split(/(`[^`]*`)/g)
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`')) return `<code>${esc(part.slice(1, -1))}</code>`;
      return esc(part)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/(^|[^\*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/\n/g, '<br>');
    })
    .join('');
}
