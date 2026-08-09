// Turn a validated tour + the parsed diff into a single review page. Authored
// text and code are escaped server-side. The one client-side HTML insertion is
// locally rendered Mermaid SVG, parsed and sanitized before it reaches the DOM.
import { PAGE_CSS, PAGE_JS } from './page-assets.js';
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from './progress-ui.js';
import { APP_BRAND } from './config.js';
import { BRAND_HEAD_LINKS, brandStoryMarkSvg } from './brand.js';
import { themeBootstrapScript, themeControl } from './theme.js';
import { buildReviewModel } from './view-model.js';
import { intraLineMap, type IntraSides } from './intra-line.js';
import { renderSplitRow, renderUnifiedRow, renderHunkGap } from './diff-render.js';
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
import type {
  Comment,
  CommentSide,
  CommentType,
  DiffFile,
  ReviewFileIndexEntry,
  Tour,
} from './types.js';
import type { ReviewStateSummary } from './review-state.js';
import type { ReviewExclusionMetadata } from './noise.js';
import { readWholeFile } from './git.js';

export interface RenderInput {
  repo: string;
  tour: Tour;
  files: DiffFile[];
  /** Bounded summaries for metadata-first initial rendering. */
  fileIndex?: readonly ReviewFileIndexEntry[];
  baseLabel: string;
  /** Ref for the post-change side. Omitted means the live working tree. */
  headRef?: string;
  comments: Comment[];
  routeBase?: string;
  /** Repo display name for the breadcrumb. Falls back to the routeBase tail. */
  repoName?: string;
  /** Render the diff with no story: All-files default, Story tab → Generate. */
  storyless?: boolean;
  /** Scope identity, diff fingerprint, and feedback health for this page. */
  reviewState?: ReviewStateSummary;
  /** Opaque server-issued identity for lazy requests from this exact page. */
  reviewPageToken?: string;
  /**
   * Identity of the story on screen, stable while its steps are. Several stories —
   * and every regeneration of one — share a single base..head scope, so the scope
   * key alone cannot say whose saved reading position a page is allowed to resume.
   */
  storyKey?: string;
  /** Whether this story was generated for the exact diff currently on screen. */
  storyFreshness?: 'current' | 'stale' | 'unverified';
  /** Scope-aware changes observed after the story baseline was captured. */
  storyDrift?: StoryDriftView;
  /** Files intentionally omitted from the bounded renderer, never hidden from scope. */
  excludedFiles?: ReviewExclusionMetadata[];
  /** Paths whose staged and working-tree bytes are different review states. */
  stagedWorktreeDivergentFiles?: string[];
}

export interface StoryDriftViewFile {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'mode-changed' | 'unknown';
  scope: 'story' | 'outside';
  additions?: number;
  deletions?: number;
  detail: 'exact' | 'summary-only';
  reason?: string;
}

export interface StoryDriftView {
  state: 'current' | 'outside-only' | 'story-changed' | 'mixed' | 'unverified';
  observationId?: string;
  baselineId?: string;
  inScopeFiles: number;
  outsideScopeFiles: number;
  files: StoryDriftViewFile[];
}

interface ExactScopeFacts {
  changedFiles: number;
  addedLines: number;
  removedLines: number;
  hasUnknownLines: boolean;
}

function exactScopeFacts(model: ReviewModel, excludedFiles: readonly ReviewExclusionMetadata[]): ExactScopeFacts {
  return excludedFiles.reduce<ExactScopeFacts>(
    (facts, file) => ({
      changedFiles: facts.changedFiles + 1,
      addedLines: facts.addedLines + (file.addedLines ?? 0),
      removedLines: facts.removedLines + (file.removedLines ?? 0),
      hasUnknownLines:
        facts.hasUnknownLines || file.addedLines == null || file.removedLines == null,
    }),
    {
      changedFiles: model.filesChanged,
      addedLines: model.totalAdd,
      removedLines: model.totalDel,
      hasUnknownLines: false,
    },
  );
}

const FLAVOR_LABEL: Record<CommentType, string> = {
  change: 'Fix request',
  question: 'Question',
  nit: 'Note',
};
const FLAVOR_ICON: Record<CommentType, string> = { change: '!', question: '?', nit: '·' };

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

export function renderPage(input: RenderInput): string {
  const { repo, tour, files, baseLabel, comments, headRef } = input;
  const routeBase = input.routeBase ?? '';
  const storyless = input.storyless ?? false;
  const storyDrift = input.storyDrift;
  const storyFreshness = storyless
    ? 'current'
    : storyDrift
      ? storyDrift.state === 'unverified'
        ? 'unverified'
        : storyDrift.state === 'story-changed' || storyDrift.state === 'mixed'
          ? 'stale'
          : 'current'
      : (input.storyFreshness ?? 'current');
  const reviewState = input.reviewState ?? {
    scopeKey: '',
    currentDiffHash: '',
    feedbackHealth: { status: 'healthy' as const, source: 'missing' as const },
  };
  const excludedFiles = input.excludedFiles ?? [];
  const indexDivergentFiles = input.stagedWorktreeDivergentFiles ?? [];
  const model = buildReviewModel(repo, tour, files, headRef, {
    storyless,
    detailedStepIndexes: input.fileIndex ? new Set() : new Set([0]),
    detailedFilePaths: new Set(),
    fileIndex: input.fileIndex,
    trustPending: !!input.fileIndex,
    baseRef: tour.base ?? baseLabel,
  });
  const exactFiles = model.files.length + excludedFiles.length;
  const excludedOnly = model.files.length === 0 && excludedFiles.length > 0;
  const pageTitle = storyless ? 'Reviewing the diff' : model.story.title.text;
  // Navigation is 0-based with the Overview as index 0, so step i lands at i + 1.
  // Every [data-goto-step] target (file chips, trust drawer) reads from this map.
  const stepIndexById = new Map(model.steps.map((s, i) => [s.id, i + 1]));

  const queuedComments = comments.filter((comment) => comment.status === 'open');
  const openCount = queuedComments.length;
  const blockingOpenCount = queuedComments.filter((comment) => comment.type === 'change').length;
  const uncoveredCount = model.trust.uncovered.length;
  const focusedStory = !!tour.storyScope?.excludedFiles?.length;
  const feedbackHealthy = reviewState.feedbackHealth?.status !== 'invalid';
  const feedbackRecovery = reviewState.feedbackHealth?.status === 'invalid'
    ? reviewState.feedbackHealth.recovery
    : '';
  const reviewClean =
    !model.trust.pending &&
    feedbackHealthy &&
    blockingOpenCount === 0 &&
    uncoveredCount === 0 &&
    storyFreshness === 'current' &&
    excludedFiles.length === 0 &&
    indexDivergentFiles.length === 0 &&
    !focusedStory;
  // No story → no coverage to report, so the coverage row is meaningless; hide it.
  const showTrustPill = !storyless || excludedFiles.length > 0 || indexDivergentFiles.length > 0;
  const trustPillClean =
    !model.trust.pending &&
    !indexDivergentFiles.length &&
    (storyless || (storyFreshness === 'current' && !uncoveredCount));
  // The pill reports the most decision-blocking fact it has. Every fact except
  // coverage is already known here; coverage needs the whole diff, which this
  // page deliberately has not loaded yet. So `pending` ranks *below* everything
  // known — an unknown must never mask a stale story or a staged mismatch — and
  // above the two verdicts only a resolved coverage check can justify. The
  // client resolves it in place after first paint; see resolveCoverage().
  const pillState = indexDivergentFiles.length
    ? 'divergent'
    : storyless && excludedFiles.length
      ? 'excluded'
      : storyFreshness !== 'current'
        ? 'stale'
        : model.trust.pending
          ? 'pending'
          : uncoveredCount
            ? 'uncovered'
            : 'clean';
  // The pill's arrow lands on the section that owns the fact it reports, not on
  // a generic "evidence" anchor the reviewer then has to scan.
  const pillSection =
    pillState === 'divergent'
      ? 'staged'
      : pillState === 'excluded'
        ? 'exclusions'
        : pillState === 'uncovered'
          ? 'unexplained'
          : 'evidence';
  const trustPill = showTrustPill
    ? `<button class="ds-trustpill${trustPillClean ? ' is-clean' : ''}${pillState === 'pending' ? ' is-unknown' : ''}${excludedFiles.length || indexDivergentFiles.length ? ' has-exclusions' : ''}" data-goto-review="${pillSection}" data-trust-excluded="${excludedFiles.length}"${focusedStory ? ' data-trust-focused="1"' : ''} title="Trust check — story freshness, coverage, staged state, and files outside the bounded renderer">${
        pillState === 'divergent'
          ? `<span class="ds-tri">▲</span><span><b>${indexDivergentFiles.length}</b> staged/working-tree ${plural(indexDivergentFiles.length, 'mismatch')} · reconcile before deciding</span><span class="ds-review-row-arrow">›</span>`
          : pillState === 'excluded'
            ? `<span class="ds-tri">▲</span><span><b>${excludedFiles.length}</b> excluded ${plural(excludedFiles.length, 'file')} · inspect before deciding</span><span class="ds-review-row-arrow">›</span>`
          : pillState === 'stale'
          ? `<span class="ds-tri">▲</span><span><b>${storyFreshness === 'stale' ? 'Out of date' : 'Unverified'}</b> story · regenerate it</span><span class="ds-review-row-arrow">›</span>`
          : pillState === 'pending'
          ? `<span class="ds-tri ds-tri-spin">◌</span><span data-trust-pill-text>Checking coverage…</span><span class="ds-review-row-arrow">›</span>`
          : pillState === 'uncovered'
          ? `<span class="ds-tri">▲</span><span><b>${uncoveredCount}</b> ${plural(uncoveredCount, 'change')} not explained by the story</span><span class="ds-review-row-arrow">›</span>`
          : `<span class="ds-check">✓</span><span>${focusedStory ? 'Story covers its selected scope' : 'Story covers the rendered diff'}${excludedFiles.length ? ` · <b>${excludedFiles.length}</b> excluded ${plural(excludedFiles.length, 'file')} to inspect` : ''}</span><span class="ds-review-row-arrow">›</span>`
      }</button>`
    : '';

  // The Review tab is the only entrance to the review page, so it carries the
  // signal the retired chip used to: the queued-comment count and one flag that says
  // something on that page needs a decision. refreshCount() rebuilds this label
  // client-side from the same facts, so the two must stay in step.
  const reviewTabLabel = `Review, ${openCount} queued ${plural(openCount, 'comment')}${
    !feedbackHealthy
      ? ', feedback file needs repair'
      : indexDivergentFiles.length
        ? `, ${indexDivergentFiles.length} staged and working-tree ${plural(indexDivergentFiles.length, 'version')} differ`
        : storyFreshness !== 'current'
          ? ', story requires regeneration'
          : uncoveredCount
            ? `, ${uncoveredCount} ${plural(uncoveredCount, 'change')} not explained by the story`
            : excludedFiles.length
              ? `, ${excludedFiles.length} excluded ${plural(excludedFiles.length, 'file')} to inspect`
              : ''
  }`;

  const railCards = storyRail(model.steps);
  const railFiles = railFileTree(model.files, comments, []);
  const stepPanels = model.steps
    // The Overview is active initially, so keep only its adjacent first step in
    // the document. Later steps load when approached instead of multiplying a
    // large story's highlighted diff rows in the initial DOM.
    .map((s, i) =>
      !input.fileIndex && i === 0
        ? stepPanel(s, i, model.totalSteps, comments, stepIndexById)
        : lazyStepPanel(s, i),
    )
    .join('');
  const filePanels = model.files.map((f, i) => filePanel(f, i, stepIndexById)).join('');

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
<body class="ds-map-bg${storyless ? '' : ' ds-overview-active'}"${storyless ? ' data-storyless="1"' : ''} data-read-view="tour" data-story-freshness="${storyFreshness}" data-feedback-health="${feedbackHealthy ? 'healthy' : 'invalid'}"${focusedStory ? ' data-story-scope="focused"' : ''} data-repo="${esc(repo)}" data-viewed-scope="${esc(`${repo}|${reviewState.scopeKey || baseLabel}|full`)}" data-review-scope="${esc(
    reviewState.scopeKey,
  )}" data-story-key="${esc(input.storyKey ?? '')}" data-current-diff-hash="${esc(reviewState.currentDiffHash)}" data-review-page-token="${esc(
    input.reviewPageToken ?? '',
  )}">
<header class="ds-reviewchrome${storyless ? '' : ' is-storyful'}" data-review-chrome${storyless ? ' data-storyless-chrome' : ' data-story-chrome'}>
  <div class="ds-reviewchrome-rail">
    <div class="ds-reviewchrome-nav">
      <button class="ds-sidebar-toggle" data-sidebar-toggle aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar">
        <span class="ds-ui-icon" aria-hidden="true">${reviewChromeIcon('menu')}</span>
      </button>
      <a class="ds-back" data-close-story href="${esc(routeBase)}/stories" title="Close story and return to review history" aria-label="Close story and return to review history">
        <span class="ds-ui-icon" aria-hidden="true">${reviewChromeIcon('close')}</span><span>Close story</span>
      </a>
    </div>
  </div>
  <div class="ds-reviewchrome-main">
    <div class="ds-reviewchrome-mobile-nav">
      <button class="ds-sidebar-toggle" data-sidebar-toggle aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar">
        <span class="ds-ui-icon" aria-hidden="true">${reviewChromeIcon('menu')}</span>
      </button>
      <a class="ds-back" data-close-story href="${esc(routeBase)}/stories" title="Close story and return to review history" aria-label="Close story and return to review history">
        <span class="ds-ui-icon" aria-hidden="true">${reviewChromeIcon('close')}</span><span class="ds-sr-only">Close story</span>
      </a>
    </div>
    <div class="ds-titlewrap">
      <div class="ds-title" title="${esc(pageTitle)}">Diff review</div>
      <div class="ds-reviewchrome-subtitle">Working tree <span>vs</span> <b>${esc(baseLabel)}</b></div>
    </div>
    <div class="ds-reviewchrome-utilities">
      <div class="ds-viewtoggle" role="tablist" aria-label="Review view">
        <button class="ds-tab is-active" id="ds-tab-tour" data-view="tour" role="tab" aria-controls="ds-view-tour" aria-selected="true" tabindex="0">Story</button>
        <button class="ds-tab" id="ds-tab-files" data-view="files" role="tab" aria-controls="ds-view-files" aria-selected="false" tabindex="-1">Files</button>
        <button class="ds-tab" id="ds-tab-review" data-view="review" data-review-status data-unexplained-count="${uncoveredCount}" data-excluded-count="${excludedFiles.length}" data-index-divergence-count="${indexDivergentFiles.length}" data-story-freshness="${storyFreshness}" role="tab" aria-controls="ds-view-review" aria-selected="false" tabindex="-1" aria-label="${esc(reviewTabLabel)}" title="Review — notes, coverage, and anything the story leaves unexplained">Review<span class="ds-tab-flag" data-review-flag aria-hidden="true"${reviewClean ? ' hidden' : ''}>▲</span><span class="ds-tab-badge" id="ds-open-count" title="Unresolved notes"${openCount ? '' : ' hidden'}><b>${openCount}</b></span></button>
      </div>
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
  </div>
  </div>
  </div>
</header>

<div class="ds-live-banner" data-live-banner role="status" aria-live="polite" aria-atomic="true" aria-label="Live review status" hidden>
  <span class="ds-live-banner-icon" aria-hidden="true">
    <svg viewBox="0 0 16 16" focusable="false"><path d="M12.7 5.3A5.25 5.25 0 1 0 13 9"/><path d="M12.7 2.7v2.6h-2.6"/></svg>
  </span>
  <span data-live-message>Diff changed.</span>
  <button class="ds-live-banner-reload" type="button" data-live-reload>Reload</button>
  <button class="ds-live-banner-dismiss" type="button" data-live-dismiss aria-label="Dismiss live review status">
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 4 8 8M12 4l-8 8"/></svg>
  </button>
</div>

<div class="ds-toast ds-story-reload-toast" data-story-reload-toast role="status" aria-live="polite" aria-atomic="true" hidden>
  <span>Story updated. Reloading in 10 seconds.</span>
  <button type="button" data-story-reload-cancel aria-label="Cancel automatic story reload">Cancel</button>
</div>

<div id="ds-agentpanel">${progressPanelMarkup('floating')}</div>

<div class="ds-layout">
  <aside class="ds-rail" aria-label="Review navigation">
    <div class="ds-railpad">
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
        <span class="ds-readhead-count" data-viewed-progress data-excluded-count="${excludedFiles.length}">${exactFiles} ${plural(exactFiles, 'file')}${excludedFiles.length && model.files.length ? ` · ${excludedFiles.length} kept lazy` : ''}</span>
      </div>
      ${model.files.length ? `<div class="ds-filetools">
        <label class="ds-file-search"><span aria-hidden="true">⌕</span><input data-file-search type="search" placeholder="Search paths, symbols, or changed code" aria-label="Search changed file paths, declarations, and code"></label>
        <details class="ds-filefilter-menu">
          <summary>Filter: <strong data-file-filter-label>All</strong><span aria-hidden="true">⌄</span></summary>
          <div class="ds-filefilters" role="group" aria-label="File filters">
            <button class="is-active" data-file-filter="all" aria-pressed="true">All</button>
            <button data-file-filter="reviewed" aria-pressed="false">Reviewed</button>
            <button data-file-filter="unreviewed" aria-pressed="false">Unreviewed</button>
            <button data-file-filter="comments" aria-pressed="false">Comments</button>
            <button data-file-filter="unexplained" aria-pressed="false">Unexplained</button>
            <button data-file-filter="tests" aria-pressed="false">Tests</button>
          </div>
        </details>
        <button class="ds-next-unviewed" data-next-unviewed type="button">Next unreviewed <span aria-hidden="true">→</span></button>
      </div>` : ''}
    </div>
    <div class="ds-railscroll">
      <div class="ds-railsteps" data-rail="tour">
        <div class="ds-spine"></div>
        ${railCards}
      </div>
      <div class="ds-railfiles" data-rail="files" hidden>
        ${railFiles || (excludedOnly ? excludedScopeNotice(excludedFiles, true) : '<div class="ds-empty ds-empty-rail">No files in this change.</div>')}
      </div>
    </div>
    <div class="ds-rail-resizer" data-sidebar-resizer role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabindex="0" title="Resize sidebar"></div>
  </aside>
  <button class="ds-rail-scrim" data-sidebar-scrim type="button" aria-label="Close review navigation" aria-hidden="true" tabindex="-1"></button>

  <main class="ds-main">
    <div class="ds-view" id="ds-view-tour" role="tabpanel" aria-labelledby="ds-tab-tour">
      ${storyless ? generateCta(model, routeBase, tour.base, headRef, excludedFiles) : introPanel(model, tour, storyFreshness, routeBase, storyDrift)}
      ${storyless ? '' : stepPanels}
      ${storyless ? storylessThread(excludedOnly) : filmstripThread(model.steps)}
    </div>
    <div class="ds-view" id="ds-view-files" role="tabpanel" aria-labelledby="ds-tab-files" hidden>
      <div class="ds-filedetail" id="ds-file-detail">
        ${filePanels || (excludedOnly ? excludedScopeNotice(excludedFiles, false) : '<div class="ds-empty">No files in this change.</div>')}
      </div>
    </div>
    <div class="ds-view" id="ds-view-review" role="tabpanel" aria-labelledby="ds-tab-review" hidden>
      ${reviewPanel({
        repo,
        headRef,
        comments: queuedComments,
        model,
        routeBase,
        openCount,
        feedbackHealthy,
        feedbackRecovery,
        trustPill,
        stepIndexById,
        excludedFiles,
        indexDivergentFiles,
        storyless,
      })}
    </div>
  </main>
</div>

${driftDrawer(storyDrift)}
${commandPalette()}
<div class="ds-selection-menu" data-selection-menu role="menu" hidden>
  <button type="button" role="menuitem" data-selection-comment>Comment selected code</button>
</div>
<div class="ds-toast" id="ds-toast" role="status" aria-live="polite" aria-atomic="true" aria-relevant="additions text"></div>
<noscript><div class="ds-empty">diffStory needs JavaScript to drive the review.</div></noscript>
<script type="application/json" id="ds-initial-comments">${jsonForDataScript(queuedComments)}</script>
<script>${progressPanelScript()}</script>
<script>${PAGE_JS}</script>
</body>
</html>`;
}

// ---- sidebar ----

function reviewChromeIcon(name: 'menu' | 'close' | 'refresh' | 'review' | 'chevron'): string {
  const paths: Record<typeof name, string> = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    refresh: '<path d="M20 11a8.1 8.1 0 0 0-14.9-4.4L3 10"/><path d="M3 4v6h6M4 13a8.1 8.1 0 0 0 14.9 4.4L21 14"/><path d="M21 20v-6h-6"/>',
    review: '<path d="M6.5 5.5h11A2.5 2.5 0 0 1 20 8v6a2.5 2.5 0 0 1-2.5 2.5H11L6 20v-3.5A2.5 2.5 0 0 1 3.5 14V8A2.5 2.5 0 0 1 6 5.5Z"/><path d="M8 9.5h8M8 13h5"/>',
    chevron: '<path d="m8 10 4 4 4-4"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths[name]}</svg>`;
}

function repairStepIcon(): string {
  return '<span class="ds-story-tune-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z"/></svg></span>';
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
// A rail card carries only what tells steps apart: the number, the headline, and
// the file's base name (full path on hover). The kind badge appears only when it
// is *not* a plain change — "Changed" on every card is noise, so it is dropped.
function railCard(s: StepView, i: number, includeBeats = true): string {
  if (s.kind === 'concept') {
    return `<div class="ds-railstory-node" data-story-step-node="${i + 1}">
      <button class="ds-stepcard is-concept" data-step-index="${i + 1}" data-step-id="${esc(s.id)}">
        <span class="ds-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="ds-stepcard-body">
          <span class="ds-stepcard-title">${s.title.html}</span>
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
        <span class="ds-stepcard-title">${s.title.html}</span>
        <span class="ds-stepcard-fileline">
          <span class="ds-stepcard-file" title="${esc(s.file)}">${esc(base)}</span>${badge}
        </span>
      </span>
    </button>
    ${includeBeats ? railBeatTree(s, i + 1) : ''}
  </div>`;
}

function railBeatTree(step: CodeStepView, stepIndex: number): string {
  if (!step.beats.length) return '';
  const health = step.health.broad
    ? `<span class="ds-railbeats-health" title="${esc(step.health.reasons.join(' · '))}"><i aria-hidden="true"></i>Broad</span>`
    : '';
  const beats = step.beats.map((beat) => `<button type="button" class="ds-railbeat" data-rail-beat data-rail-step-index="${stepIndex}" data-focus-group="${beat.focusGroup}" aria-pressed="false" title="${esc(beat.text.text)}" aria-label="Beat ${beat.focusGroup + 1}: ${esc(beat.text.text)}">
      <span class="ds-railbeat-marker">${String(beat.focusGroup + 1).padStart(2, '0')}</span>
      <span class="ds-railbeat-text">${esc(railBeatLabel(beat.text.text))}</span>
    </button>`).join('');
  return `<div class="ds-railbeats" aria-label="Review beats for ${esc(step.title.text)}">
    <div class="ds-railbeats-head">
      <span>Review beats</span>${health}<span class="ds-railbeats-count" data-rail-current>1 / ${step.beats.length}</span>
      ${storyRepairMenu(step, true)}
    </div>
    <div class="ds-railbeat-list">${beats}</div>
  </div>`;
}

// Always fed the text projection: clipping `.html` at 64 characters would cut a
// tag in half and hand the browser a fragment the sanitizer never approved.
function railBeatLabel(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 64) return clean;
  const clipped = clean.slice(0, 64);
  const boundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, boundary > 42 ? boundary : 64).replace(/[,:;\s]+$/, '')}…`;
}

function storyRail(steps: StepView[]): string {
  if (steps.length <= 10) return steps.map((step, index) => railCard(step, index)).join('');
  // A long story already exposes its beat controls inside each lazily loaded
  // step. Repeating every beat in the sidebar makes the initial DOM scale with
  // the full narration body (nearly 1 MB for a 245-step real-world story).
  // Keep the rail as a lightweight step index instead.
  const compactCard = (step: StepView, index: number): string => railCard(step, index, false);
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
    <div class="ds-railchapter-steps">${group.items.map(({ step, index: stepIndex }) => compactCard(step, stepIndex)).join('')}</div>
  </details>`).join('');
}

// Filmstrip navigation (Signal 3b): a horizontal numeral thread that is the whole
// Story-view navigation. Node 0 is the Overview; nodes 1..N are the steps. Wired to
// setActive via data-goto-step; activateStep syncs active/read/unread + the line fill.
function filmstripThread(steps: StepView[]): string {
  const nodes = [
    `<button type="button" class="ds-filmnode is-overview is-active" data-thread-node="0" data-goto-step="0" aria-label="Overview">
      <span class="ds-filmnode-num" aria-hidden="true">◆</span><span class="ds-filmnode-label">Overview</span>
    </button>`,
    ...steps.map(
      (s, i) => `<button type="button" class="ds-filmnode" data-thread-node="${i + 1}" data-goto-step="${i + 1}" aria-label="Step ${i + 1}: ${esc(s.title.text)}">
      <span class="ds-filmnode-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="ds-filmnode-label">${s.title.html}</span>
    </button>`,
    ),
  ].join('');
  // One island, not two bars. The transport (play/pause), the active step's beats
  // and the numeral thread are all answers to "where am I in this story", so they
  // share a single piece of floating chrome. The stage is empty markup here: each
  // step still renders its own dock — that is what the lazy step endpoint returns —
  // and the client adopts it into the stage as the step comes up.
  return `<div class="ds-dock" data-story-dock>
    <div class="ds-dock-transport">
      ${narrationControls()}
      <div class="ds-dock-stage" data-dock-slot>
        <p class="ds-dock-idle" data-dock-idle>Overview</p>
      </div>
    </div>
    <nav class="ds-filmthread is-overview" data-filmthread aria-label="Reading order" style="--thread-pct:0%">
      <div class="ds-filmthread-scroll">
        <div class="ds-filmthread-nodes"><div class="ds-filmthread-line" aria-hidden="true"></div>${nodes}</div>
      </div>
      <span class="ds-filmthread-tooltip" data-filmthread-tooltip aria-hidden="true"></span>
    </nav>
  </div>`;
}

// Narration transport. It used to sit in the page chrome, three regions away from
// the beat it was reading; in the dock it stands next to the words it speaks.
function narrationControls(): string {
  return `<div class="ds-narration" data-narration>
    <div class="ds-narration-actions">
      <button class="ds-readaloud ds-readaloud-primary" data-readaloud type="button" title="Play story" aria-label="Play story" aria-pressed="false">
        <span class="ds-readaloud-ico" aria-hidden="true">▶</span>
        <span class="ds-readaloud-label" data-readaloud-label>Play</span>
      </button>
      <button class="ds-narration-stop" data-aloud-stop type="button" title="Stop narration" aria-label="Stop narration" hidden><span aria-hidden="true"></span></button>
    </div>
  </div>`;
}

// Storyless Story view has no numerals to walk. The Story/Files switch lives in
// the chrome now, so the only bar left worth drawing here is the excluded-file
// escape, which the switch does not offer.
function storylessThread(excludedOnly = false): string {
  if (!excludedOnly) return '';
  return `<nav class="ds-filmthread is-storyless" data-filmthread aria-label="Review navigation">
    <div class="ds-filmthread-scroll"></div>
    <button type="button" class="ds-filmthread-allfiles" data-goto-review="exclusions">Review excluded file <span aria-hidden="true">→</span></button>
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
  drift?: StoryDriftView,
): string {
  const first = model.steps[0];
  const story = model.story;
  const intent = story.intent;
  const summaryText = story.summary ? nl(story.summary.html) : '';
  const goalText = intent ? nl(intent.goal.html) : '';
  // With a recovered intent the goal leads and the summary becomes the reading
  // map; without one the summary (or a generic line) is the lede, as before.
  const fallbackLede =
    'Each step builds on the one before it — read them in order, or jump to any file from the list.';
  const lede = goalText || summaryText || fallbackLede;
  // The narration reads data-speech-text when it is present, so the spoken form
  // of the Overview is the speech projection rather than whatever textContent
  // the visible markup happens to flatten to.
  const ledeSpeech = intent?.goal.speech || story.summary?.speech || fallbackLede;
  const design =
    goalText && intent?.design
      ? `<p class="ds-intro-design" data-speech-overview data-speech-text="${esc(
          intent.design.speech,
        )}">${nl(intent.design.html)}</p>`
      : '';
  const map = goalText && story.summary
    ? `<p class="ds-intro-design" data-speech-overview data-speech-text="${esc(
        story.summary.speech,
      )}">${summaryText}</p>`
    : '';
  // Deliberate omissions save the reviewer from flagging what the author skipped on purpose.
  const nonGoals = intent?.nonGoals.length
    ? `<div class="ds-intro-nongoals"><span class="ds-intro-block-kicker">Deliberately not touched</span><ul>${intent.nonGoals
        .map((nonGoal) => `<li>${nonGoal.html}</li>`)
        .join('')}</ul></div>`
    : '';
  const context = design || map || nonGoals
    ? `<div class="ds-intro-context">${design}${map}${nonGoals}</div>`
    : '';
  const hotspots = model.hotspots.length
    ? `<div class="ds-intro-hotspots" role="note" aria-label="Author-flagged review hotspots">
          <span class="ds-intro-block-kicker">Where I'd distrust this first</span>
          <ul>${model.hotspots
            .map(
              (spot) => `<li><button type="button" data-goto-step="${spot.panelIndex}">
                <span class="ds-hotspot-step">Step ${spot.order} · ${spot.title.html}</span>
                <span class="ds-hotspot-reason">${spot.reason.html}</span>
              </button></li>`,
            )
            .join('')}</ul>
        </div>`
    : '';
  const reviewNotes = hotspots || context
    ? `<details class="ds-intro-notes">
        <summary><span>Review notes</span><span class="ds-intro-notes-caret" aria-hidden="true">⌄</span></summary>
        <div class="ds-intro-notes-body">${hotspots}${context}</div>
      </details>`
    : '';
  // Story scope is file paths, not prose, so it is still read straight off the tour.
  const includedFiles = tour.storyScope?.includedFiles ?? [];
  const solidityOnly = includedFiles.length > 0 && includedFiles.every((file) => file.toLowerCase().endsWith('.sol'));
  const scopeText = solidityOnly
    ? `Solidity only · ${model.storyFilesChanged} ${plural(model.storyFilesChanged, 'file')}`
    : `${model.storyFilesChanged} ${plural(model.storyFilesChanged, 'file')} in story`;
  const freshnessNote = drift && drift.state !== 'unverified'
    ? driftStatus(drift)
    : freshness === 'current'
      ? ''
      : `<div class="ds-intro-freshness" role="status" aria-label="${
        freshness === 'stale'
          ? 'The diff changed after this story was generated. Regenerate the story before relying on coverage.'
          : 'This story baseline cannot be verified against its current scope. Regenerate the story before relying on coverage.'
      }"><span aria-hidden="true">▲</span><span>${freshness === 'stale' ? 'Story is out of date' : 'Freshness unverified'}</span><a href="${esc(
        routeBase,
      )}/change">Regenerate</a></div>`;
  const start = first
    ? `<button class="ds-intro-start" data-goto-step="1">
        <span class="ds-intro-start-main">Start the walkthrough <span class="ds-intro-arrow">→</span></span>
      </button>`
    : '';
  return `<section class="ds-step is-intro" data-step-panel="0">
    <div class="ds-introwrap">
      <span class="ds-intro-eyebrow">${STORY_MARK}<span>The story of this change</span></span>
      <h1 class="ds-intro-title">${story.title.html}</h1>
      <p class="ds-intro-lede" data-speech-overview data-speech-text="${esc(ledeSpeech)}">${lede}</p>
      ${freshnessNote}
      <div class="ds-intro-actions">${start}</div>
      <div class="ds-intro-utility" aria-label="Story scope and optional review material">
        <span class="ds-intro-scope">${scopeText}</span>
        ${reviewNotes}
        <button type="button" class="ds-intro-allfiles" data-open-all-files>All files <span aria-hidden="true">→</span></button>
      </div>
    </div>
  </section>`;
}

function driftStatus(drift: StoryDriftView): string {
  const story = drift.inScopeFiles;
  const outside = drift.outsideScopeFiles;
  if (drift.state === 'current') {
    return '<div class="ds-intro-freshness is-current" role="status"><span aria-hidden="true">✓</span><span>Story current</span></div>';
  }
  const needsRefresh = story > 0;
  const parts = [
    story ? `${story} story ${plural(story, 'file')}` : '',
    outside ? `${outside} side ${plural(outside, 'file')}` : '',
  ].filter(Boolean).join(' + ');
  const label = needsRefresh ? `Story needs refresh · ${parts} changed` : `Story current · ${parts} changed`;
  return `<button type="button" class="ds-intro-freshness ds-drift-trigger${needsRefresh ? ' is-stale' : ' is-current'}" data-drift-open aria-haspopup="dialog" aria-controls="ds-drift-drawer" aria-expanded="false"><span aria-hidden="true">${needsRefresh ? '▲' : '✓'}</span><span>${label}</span><span class="ds-drift-trigger-link">See changes →</span></button>`;
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
        <span class="ds-storygen-label" id="storyReviewerNoteLabel">What should this change accomplish?</span>
        <span class="ds-storygen-optional">Optional · recommended</span>
      </span>
      <textarea id="storyReviewerNote" rows="4" aria-labelledby="storyReviewerNoteLabel" aria-describedby="storyReviewerNoteHelp" placeholder="Paste the request, acceptance criteria, or anything the story must not miss."></textarea>
      <small class="ds-storygen-help" id="storyReviewerNoteHelp">This helps the agent separate intended behavior from accidental changes.</small>
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

function excludedScopeNotice(
  excludedFiles: readonly ReviewExclusionMetadata[],
  compact: boolean,
): string {
  if (compact) {
    return `<div class="ds-excluded-rail-list">${excludedFiles.map((file) =>
      `<button type="button" class="ds-excluded-rail-file" data-goto-review="exclusions" data-goto-excluded="${esc(file.path)}" aria-label="${esc(file.path)}, inspect bounded preview">
        <span class="ds-excluded-rail-file-icon" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.75 1.75h5.1l3.4 3.4v9.1h-8.5z"/><path d="M8.75 1.75v3.5h3.5"/></svg></span>
        <code>${esc(file.path)}</code>
        <span aria-hidden="true">›</span>
      </button>`,
    ).join('')}</div>`;
  }
  const largeCount = excludedFiles.filter((file) => file.reason === 'large-diff').length;
  const singlePath = excludedFiles.length === 1 ? excludedFiles[0]?.path : undefined;
  const title = largeCount === 1 && excludedFiles.length === 1
    ? 'Large file kept lazy'
    : `${excludedFiles.length} ${plural(excludedFiles.length, 'file')} kept lazy`;
  return `<div class="ds-excluded-only" role="note">
    <span class="ds-excluded-only-icon" aria-hidden="true">↯</span>
    <div>
      <strong>${title}</strong>
      <p>${singlePath ? `<code class="ds-excluded-only-path">${esc(singlePath)}</code> remains` : 'Still'} part of this exact scope, but kept outside the diff DOM so the page stays fast.</p>
    </div>
    <button type="button" class="ds-btn ds-btn-ghost" data-goto-review="exclusions">Inspect bounded preview</button>
  </div>`;
}

function generateCta(
  model: ReviewModel,
  routeBase: string,
  baseRef?: string,
  headRef?: string,
  excludedFiles: readonly ReviewExclusionMetadata[] = [],
): string {
  const scope = exactScopeFacts(model, excludedFiles);
  const filesLabel = `${plural(scope.changedFiles, 'file')} changed${
    model.contextFiles ? ` · ${model.contextFiles} for context` : ''
  }`;
  const dataBase = baseRef ? ` data-base="${esc(baseRef)}"` : '';
  const dataHead = headRef ? ` data-head="${esc(headRef)}"` : '';
  const excludedOnly = model.filesChanged === 0 && excludedFiles.length > 0;
  const lede = excludedOnly
    ? 'This exact scope contains a file too large for the diff DOM. Its bounded preview remains available without loading the full body.'
    : excludedFiles.length
      ? `Read the bounded diff under <b>All files</b>. ${excludedFiles.length} ${plural(excludedFiles.length, 'file')} ${excludedFiles.length === 1 ? 'stays' : 'stay'} available separately under <b>Review</b>.`
      : 'The real diff is under <b>All files</b>. Keep reading it directly, or generate a story for this exact scope.';
  const storySetup = excludedOnly
    ? excludedScopeNotice(excludedFiles, false)
    : `<div class="ds-storygen-card">
        <div class="ds-storygen-head">
          <div>
            <span class="ds-storygen-eyebrow">Story setup</span>
            <strong>Choose how the story should guide your review</strong>
            <p>${excludedFiles.length ? `The story covers the ${model.filesChanged} bounded ${plural(model.filesChanged, 'file')} you select. Review the ${excludedFiles.length} excluded ${plural(excludedFiles.length, 'file')} separately.` : 'Every mode reviews the same selected changes. Depth changes the grouping, context, and explanation—not the coverage.'}</p>
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
      </div>`;
  return `<section class="ds-step is-intro" data-step-panel="0">
    <div class="ds-introwrap">
      <span class="ds-intro-eyebrow">${STORY_MARK}<span>No story yet</span></span>
      <h1 class="ds-intro-title">${excludedOnly ? 'Large change, lightweight review' : 'Read the diff, or have the agent narrate it'}</h1>
      <p class="ds-intro-lede">${lede}</p>
      <div class="ds-intro-facts">
        <div class="ds-fact"><span class="ds-fact-n">${scope.changedFiles}</span><span class="ds-fact-l">${filesLabel}</span></div>
        <div class="ds-fact"><span class="ds-fact-n"><span class="ds-stat-add">+${scope.addedLines}</span> <span class="ds-stat-del">−${scope.removedLines}</span></span><span class="ds-fact-l">${scope.hasUnknownLines ? 'known lines · binary counts separate' : 'lines'}</span></div>
      </div>
      ${storySetup}
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
  return `<button class="ds-fileitem${f.untoured ? ' is-untoured' : ''}" data-file-index="${i}" data-file-path="${esc(f.file)}" data-goto-file="${esc(
    f.file,
  )}" data-review-hash="${reviewHash}" data-filter-path="${esc(
    `${f.file} ${f.symbols.join(' ')}`.toLowerCase(),
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
  )}" data-step-lazy="1" hidden>
    <div class="ds-sr-only" data-step-speech-cache>${lazyStepSpeech(step)}</div>
    <div class="ds-step-loading" role="status">Loading this review step…</div>
  </section>`;
}

function lazyStepSpeech(step: StepView): string {
  if (step.kind === 'concept') {
    return `<span data-speech-concept>${esc(conceptSpeechText(step))}</span>`;
  }
  if (!step.beats.length) {
    return `<span class="ds-why-text" data-speech-text="${esc(step.why.speech)}">${esc(step.why.text)}</span>`;
  }
  return step.beats.map((beat) => `<span data-speech-beat="${beat.focusGroup}" data-focus-group="${beat.focusGroup}" data-speech-text="${esc(
    beat.text.speech,
  )}">${esc(beat.text.text)}</span>`).join('');
}

/** Render one story step for the lazy review-step endpoint. */
export function renderStoryStepPanel(
  _repo: string,
  model: ReviewModel,
  comments: Comment[],
  stepIndex: number,
): string {
  const step = model.steps[stepIndex];
  if (!step) return '<div class="ds-diffnote">That story step does not exist.</div>';
  const stepIndexById = new Map(model.steps.map((candidate, index) => [candidate.id, index + 1]));
  return stepPanel(step, stepIndex, model.totalSteps, comments, stepIndexById);
}

function stepPanel(
  step: StepView,
  i: number,
  total: number,
  comments: Comment[],
  stepIndexById: Map<string, number>,
): string {
  return step.kind === 'concept'
    ? conceptStepPanel(step, i, total, stepIndexById)
    : codeStepPanel(step, i, total, comments);
}

function codeStepPanel(
  s: CodeStepView,
  i: number,
  total: number,
  comments: Comment[],
): string {
  const diffRegionId = `ds-story-diff-${i + 1}`;
  // Call-flow lives here now (not on every rail card). Only show the meaningful
  // cross-references — "Standalone"/"Final step" carry no navigation cue.
  const flow = /^(Calls|Returns)/.test(s.flow)
    ? `<span class="ds-flowchip" title="Call flow — where this step leads in the walkthrough"><span class="ds-flowico">↳</span>${esc(
        s.flow,
      )}</span>`
    : '';
  return `<section class="ds-step is-code-step" data-step-panel="${i + 1}" data-step-id="${esc(s.id)}"${
    s.focusExplicit ? ' data-story-focus="authored"' : ''
  } hidden>
    <div class="ds-step-top">
      <div class="ds-step-meta">
        <span class="ds-step-count">Step ${s.order} of ${total}</span>
        <span class="ds-dot"></span>
        <span class="ds-badge ds-badge-${s.kind === 'new-file' ? 'new' : s.kind}">${esc(s.kindLabel)}</span>
        ${flow}
        <span class="ds-flex"></span>
      </div>
      <div class="ds-step-titlerow">
        <h1 class="ds-step-title">${s.title.html}</h1>
        ${storyRepairMenu(s, true)}
      </div>
    </div>
    ${s.hotspot
      ? `<div class="ds-hotspot-flag" role="note"><span class="ds-hotspot-flag-kicker" aria-hidden="true">▲ Distrust</span><span class="ds-sr-only">Author-flagged hotspot: </span><span class="ds-hotspot-flag-reason">${
          s.hotspot.html
        }</span></div>`
      : ''}
    <div class="ds-diffscroll">
      <div class="ds-diff" id="${diffRegionId}" data-diff data-story-diff data-file="${esc(s.file)}" role="region" aria-label="${esc(
        s.file,
        )} story diff"${s.newFile ? ' data-newfile="1"' : ''}>
        <div class="ds-difftoolbar">
          <span class="ds-flex"></span>
          <button class="ds-full-diff" type="button" data-open-full-diff="${esc(s.file)}">All files</button>
          ${changeJumpControls()}
          <div class="ds-modetoggle" role="group" aria-label="Diff display mode">
            <button data-mode="diff" aria-pressed="false">Unified</button>
            <button class="is-active" data-mode="split" aria-pressed="true">Split</button>
            <button data-mode="full" aria-pressed="false">Full file</button>
          </div>
        </div>
        <div data-diff-inner hidden>${storyUnifiedDiffInner(s, comments)}</div>
        <div data-split-inner data-loaded="1">${diffInner(s, comments)}</div>
        <div data-full-inner hidden></div>
      </div>
    </div>
    ${stepStoryHtml(s, diffRegionId, i + 1)}
  </section>`;
}

function moveRangeLabel(file: string, [start, end]: [number, number]): string {
  return `${file}:${start}${start === end ? '' : `–${end}`}`;
}

type MoveView = CodeStepView['moves'][number];
type MoveEndpointView = MoveView['before'];

function calloutEndpoint(move: MoveView): { endpoint: MoveEndpointView; side: 'left' | 'right' } {
  if (move.hidden?.as === 'destination') {
    return move.before.local ? { endpoint: move.before, side: 'left' } : { endpoint: move.after, side: 'right' };
  }
  return move.after.local ? { endpoint: move.after, side: 'right' } : { endpoint: move.before, side: 'left' };
}

function rowMatchesEndpoint(row: SbsRow, endpoint: MoveEndpointView, side: 'left' | 'right'): boolean {
  const line = side === 'left' ? row.oldNo : row.newNo;
  return endpoint.local && line !== undefined && line >= endpoint.range[0] && line <= endpoint.range[1];
}

function calloutsByLastRow(s: CodeStepView): Map<SbsRow, MoveView[]> {
  const rows = s.blocks.flat();
  const result = new Map<SbsRow, MoveView[]>();
  for (const move of s.moves) {
    if (!move.hidden) continue;
    const anchor = calloutEndpoint(move);
    const row = rows.filter((candidate) => rowMatchesEndpoint(candidate, anchor.endpoint, anchor.side)).at(-1);
    if (!row) continue;
    result.set(row, [...(result.get(row) ?? []), move]);
  }
  return result;
}

function moveTargetAttributes(endpoint: MoveEndpointView): string {
  return `${endpoint.targetStep ? ` data-move-target-step="${endpoint.targetStep}"` : ''} data-move-target-file="${esc(
    endpoint.file,
  )}" data-move-target-line="${endpoint.range[0]}"`;
}

function crossFileRouteHtml(move: MoveView, remote: MoveEndpointView): string {
  const remoteIsSource = !move.before.local;
  const role = remoteIsSource ? 'source' : 'destination';
  const fileLabel = moveRangeLabel(remote.file, remote.range);
  const file = `<button type="button" class="ds-annot-dest"${moveTargetAttributes(remote)} aria-label="${esc(
    `Open cross-file ${role} ${fileLabel}`,
  )}"><span>${esc(fileLabel)}</span></button>`;
  const here = `<span class="ds-annot-here ds-annot-here-${remoteIsSource ? 'right' : 'left'}">this code</span>`;
  const arrow = '<span class="ds-annot-route-arrow" aria-hidden="true">→</span>';
  return `<div class="ds-annot-route" data-cross-file-role="${role}">
    <span class="ds-annot-relation">Cross-file ${role}</span>
    <span class="ds-annot-endpoints">${remoteIsSource ? `${file}${arrow}${here}` : `${here}${arrow}${file}`}</span>
  </div>`;
}

function calloutHtml(move: MoveView, unified = false): string {
  if (!move.hidden) return '';
  const anchor = calloutEndpoint(move);
  const remote = !move.before.local ? move.before : !move.after.local ? move.after : undefined;
  const route = move.hidden.as === 'destination' && remote ? crossFileRouteHtml(move, remote) : '';
  const detail = `<span class="ds-annot-tag">${esc(move.hidden.tag)}</span>
    <span class="ds-annot-what">${move.hidden.what.html}</span>`;
  return `<div class="ds-annot-callout ds-annot-callout-${move.hidden.as}${route ? ' ds-annot-callout-cross' : ''} ds-annot-callout-${
    unified ? 'unified' : anchor.side
  }" data-annot-callout="${esc(move.id)}" data-move-id="${esc(move.id)}" role="note">
    ${route}${route ? `<div class="ds-annot-detail">${detail}</div>` : detail}
  </div>`;
}

function rowCallouts(row: SbsRow, callouts: Map<SbsRow, MoveView[]>, unified = false): string {
  return (callouts.get(row) ?? []).map((move) => calloutHtml(move, unified)).join('');
}

function annotationEndpoint(endpoint: MoveEndpointView): Record<string, unknown> {
  if (endpoint.local) return { local: true };
  return {
    local: false,
    file: endpoint.file,
    range: endpoint.range,
    ...(endpoint.targetStep ? { targetStep: endpoint.targetStep } : {}),
  };
}

function annotationSummary(s: CodeStepView): string {
  const relationships = s.moves
    .filter((move) => Boolean(move.label))
    .map(
      (move) => {
        const sourceLabel = move.kind === 'flow' ? 'Source' : 'Before';
        const destinationLabel = move.kind === 'flow' ? 'destination' : 'after';
        return `<span>Code relationship: ${esc(move.label ?? '')}. ${sourceLabel} ${esc(
          moveRangeLabel(move.before.file, move.before.range),
        )}; ${destinationLabel} ${esc(moveRangeLabel(move.after.file, move.after.range))}.</span>`;
      },
    );
  return relationships.length
    ? `<div class="ds-sr-only" data-annotation-summary>${relationships.join(' ')}</div>`
    : '';
}

function annotationData(s: CodeStepView): string {
  const moves = s.moves
    .filter((move) => Boolean(move.label || move.hidden))
    .map((move) => ({
      id: move.id,
      kind: move.kind,
      ...(move.label ? { tag: move.label } : {}),
      before: annotationEndpoint(move.before),
      after: annotationEndpoint(move.after),
      arrow: move.before.local && move.after.local,
    }));
  return moves.length
    ? `<script type="application/json" data-annotations>${jsonForDataScript({ moves })}</script>`
    : '';
}

function storyRepairMenu(step: CodeStepView, iconOnly = false): string {
  const healthTitle = step.health.broad ? ` Broad step: ${step.health.reasons.join(' · ')}.` : '';
  return `<details class="ds-story-tune${iconOnly ? ' is-icon' : ''}">
    <summary aria-label="Repair this story step" title="Story repair options.${esc(healthTitle)}">${iconOnly ? repairStepIcon() : '<span>Repair step</span>'}</summary>
    <div class="ds-story-tune-pop"><button type="button" data-story-repair="rewrite" data-story-step="${esc(
      step.id,
    )}" data-story-file="${esc(step.file)}"><strong>Rewrite explanation</strong><small>Make the claim and evidence sharper without changing the review path.</small></button><button type="button" data-story-repair="shorten" data-story-step="${esc(
      step.id,
    )}" data-story-file="${esc(step.file)}"><strong>Make shorter</strong><small>Condense this explanation without dropping its risk.</small></button><button type="button" data-story-repair="split" data-story-step="${esc(
      step.id,
    )}" data-story-file="${esc(step.file)}"><strong>Split into smaller stops</strong><small>Give each decision its own local camera.</small></button></div>
  </details>`;
}

function conceptStepPanel(
  s: ConceptStepView,
  i: number,
  total: number,
  stepIndexById: Map<string, number>,
): string {
  const next = s.preparesFor[0];
  const nextIndex = next ? stepIndexById.get(next.id) : undefined;
  const nextLink = next && nextIndex !== undefined
    ? `<button class="ds-concept-next" type="button" data-goto-step="${nextIndex}">
        <span class="ds-concept-next-kicker">Next in code · Step ${next.order}</span>
        <span class="ds-concept-next-title">${next.title.html}</span>
        <span class="ds-concept-next-arrow" aria-hidden="true">→</span>
      </button>`
    : '';
  const diagram = s.diagram
    ? `<figure class="ds-concept-diagram" data-concept-diagram>
        <div class="ds-concept-diagram-output" data-mermaid-output role="img" aria-label="${esc(
          s.diagram.caption.text,
        )}"><span class="ds-concept-diagram-loading">Drawing the mental model…</span></div>
        <pre data-mermaid-source hidden>${esc(s.diagram.source)}</pre>
        <figcaption>${s.diagram.caption.html}</figcaption>
        <details class="ds-concept-diagram-source" data-mermaid-fallback>
          <summary>Diagram source</summary>
          <pre><code>${esc(s.diagram.source)}</code></pre>
        </details>
      </figure>`
    : '';
  const speech = conceptSpeechText(s);
  return `<section class="ds-step ds-concept-step" data-step-panel="${i + 1}" data-step-id="${esc(s.id)}" hidden>
    <div class="ds-step-top">
      <div class="ds-step-meta">
        <span class="ds-step-count">Step ${s.order} of ${total}</span>
        <span class="ds-dot"></span>
        <span class="ds-badge ds-badge-concept">Concept</span>
        <span class="ds-flex"></span>
      </div>
    </div>
    <div class="ds-concept-scroll">
      <article class="ds-concept-document" aria-labelledby="ds-concept-title-${i + 1}">
        <div class="ds-concept-heading">
          <span class="ds-concept-eyebrow"><span aria-hidden="true">◇</span> Mental model</span>
        </div>
        <h1 class="ds-concept-title" id="ds-concept-title-${i + 1}">${s.title.html}</h1>
        <div class="ds-concept-body ds-md">${s.body.html}</div>
        ${diagram}
        ${nextLink}
        <span class="ds-sr-only" data-speech-concept>${esc(speech)}</span>
      </article>
    </div>
  </section>`;
}

/**
 * Ends a spoken segment with sentence punctuation, without doubling it.
 *
 * Joining these segments with a bare ". " produced "…where to continue.. The
 * primer sits…" whenever a segment already ended in punctuation.
 */
function endsSentence(text: string): string {
  return /[.!?:;]$/.test(text) ? text : `${text}.`;
}

/**
 * The spoken form of a primer: the projections the parser already produced,
 * ordered and terminated. The markdown-stripping this used to do lived here only
 * because the body arrived as raw authored prose; the speech projection owns that
 * shaping now, so the renderer only decides what is said in what order.
 */
function conceptSpeechText(s: ConceptStepView): string {
  return [s.title.speech, s.body.speech, s.diagram?.caption.speech]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .map(endsSentence)
    .join(' ')
    .trim();
}

function stepStoryHtml(s: CodeStepView, diffRegionId: string, stepIndex: number): string {
  if (!s.beats.length) return `<div class="ds-beatdock is-single" data-beat-dock data-dock-step="${stepIndex}" hidden>
    <span class="ds-beatdock-count">Review note</span>
    <p class="ds-why-text" data-speech-text="${esc(s.why.speech)}">${nl(s.why.html)}</p>
  </div>`;
  return `<div class="ds-beatdock" data-beat-dock data-dock-step="${stepIndex}" hidden>
    <span class="ds-beatdock-count"><b data-beat-current>01</b><span>/ ${String(s.beats.length).padStart(2, '0')}</span></span>
    <div class="ds-beatdock-copy">
      <div class="ds-beats">${s.beats.map((beat) => beatHtml(beat, s.file, diffRegionId)).join('')}</div>
    </div>
    <span class="ds-beatdock-actions">
      <button type="button" data-beat-move="-1" aria-label="Previous review beat" disabled>←</button>
      <button type="button" data-beat-move="1" aria-label="Next review beat">→</button>
    </span>
    <div class="ds-sr-only" data-story-focus-status aria-live="polite" aria-atomic="true"></div>
  </div>`;
}

function beatHtml(beat: CodeStepView['beats'][number], file: string, diffRegionId: string): string {
  const destination = beatDestination(file, beat.highlights);
  return `<button type="button" class="ds-beat ds-beatdock-note" data-story-beat data-speech-beat="${beat.focusGroup}" data-focus-group="${beat.focusGroup}" data-speech-text="${esc(
    beat.text.speech,
  )}" data-focus-destination="${esc(destination)}" aria-controls="${diffRegionId}" aria-pressed="false" aria-label="Focus beat ${beat.focusGroup + 1}: ${esc(
    beat.text.text,
  )}"><span class="ds-beat-text">${nl(beat.text.html)}</span></button>`;
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
  const callouts = calloutsByLastRow(s);
  const body = s.blocks
    .map((block, bi) => {
      const intra = intraLineMap(block, (r) => r.type, (r) => r.content);
      return (
        (bi > 0 ? renderHunkGap() : '') +
        block.map((row) => storyUnifiedRow(row, s, comments, bi, intra) + rowCallouts(row, callouts, true)).join('')
      );
    })
    .join('');
  const note =
    s.note && s.blocks.some((b) => b.length)
      ? `<div class="ds-diffnote ds-diffnote-soft">${esc(s.note)}</div>`
      : '';
  return `${storyUnifiedHead(s)}${note}${annotationSummary(s)}<div class="ds-diffbody ds-diffbody-unified">${body}</div>`;
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
  _comments: Comment[],
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
  return rowHtml;
}

function diffInner(s: CodeStepView, comments: Comment[]): string {
  if (!s.blocks.length || !s.blocks.some((b) => b.length)) {
    return `<div class="ds-diffnote">${esc(s.note ?? 'Nothing to show for this step.')}</div>`;
  }
  const head = diffHead(s);
  const hunkGap = () => (s.context || s.newFile ? renderHunkGap() : renderHunkGap(undefined, { split: true }));
  const canExpandViewport = !s.context && !s.newFile && !s.pairedView && s.viewport[0] > 0;
  const viewportBefore =
    canExpandViewport && s.viewport[0] > 1
      ? renderHunkGap({ file: s.file, from: 1, to: s.viewport[0] - 1 }, { split: true, edge: 'before' })
      : '';
  const viewportAfter = canExpandViewport
    ? renderHunkGap({ file: s.file, from: s.viewport[1] + 1, to: 'eof' }, { split: true, edge: 'after' })
    : '';
  const callouts = calloutsByLastRow(s);
  const body =
    viewportBefore +
    s.blocks
      .map((block, bi) => {
        const intra = intraLineMap(block, (r) => r.type, (r) => r.content);
        return (
          (bi > 0 ? hunkGap() : '') +
          block.map((row) => sbsRow(row, s, comments, bi, intra) + rowCallouts(row, callouts)).join('')
        );
      })
      .join('') +
    viewportAfter;
  const note =
    s.note && s.blocks.some((b) => b.length)
      ? `<div class="ds-diffnote ds-diffnote-soft">${esc(s.note)}</div>`
      : '';
  const paired = s.pairedView ? s.moves.find((move) => move.id === s.pairedView) : undefined;
  const bodyClass = paired?.kind === 'flow' ? ' ds-diffbody-paired-flow' : '';
  return `${head}${note}${annotationSummary(s)}<div class="ds-diffbody${bodyClass}">${body}</div>${annotationData(s)}`;
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
  const paired = s.pairedView ? s.moves.find((move) => move.id === s.pairedView) : undefined;
  if (paired) {
    const flow = paired.kind === 'flow';
    const leftLabel = flow ? 'Source' : 'Before';
    const rightLabel = flow ? 'Destination' : 'After';
    return `<div class="ds-diffhead ds-diffhead-paired">
      <span class="ds-diffhead-side ds-diffhead-side-l"><span class="ds-diffhead-label">${leftLabel}</span><span class="ds-diffhead-path">${esc(
        paired.before.file,
      )}</span></span><span class="ds-diffhead-divider"></span>
      <span class="ds-diffhead-side ds-diffhead-side-r"><span class="ds-diffhead-label ${flow ? 'ds-blue' : 'ds-green'}">${rightLabel}</span><span class="ds-diffhead-path">${esc(
        paired.after.file,
      )}</span></span>
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
  _comments: Comment[],
  blockIndex: number,
  intra?: Map<SbsRow, IntraSides>,
): string {
  const paired = s.pairedView ? s.moves.find((move) => move.id === s.pairedView) : undefined;
  const leftTarget =
    !s.context && (paired || !s.newFile) && row.oldNo !== undefined
      ? { side: 'left' as const, file: paired?.before.file ?? s.oldFile, line: row.oldNo }
      : undefined;
  const rightTarget =
    row.newNo !== undefined ? { side: 'right' as const, file: paired?.after.file ?? s.file, line: row.newNo } : undefined;
  const rowHtml = renderSplitRow(row, {
    leftTarget,
    rightTarget,
    stepId: s.id,
    focusIndex: rowVoiceFocusIndex(row, s, blockIndex),
    single: !paired && (s.context || s.newFile),
    sides: intra?.get(row),
    moveTokens: rowMoveTokens(row, s),
  });
  return rowHtml;
}

function rowMoveTokens(row: SbsRow, s: CodeStepView): string[] {
  const tokens: string[] = [];
  for (const move of s.moves) {
    if (
      move.before.local
      && row.oldNo !== undefined
      && row.oldNo >= move.before.range[0]
      && row.oldNo <= move.before.range[1]
    ) tokens.push(`${move.id}:before`);
    if (
      move.after.local
      && row.newNo !== undefined
      && row.newNo >= move.after.range[0]
      && row.newNo <= move.after.range[1]
    ) tokens.push(`${move.id}:after`);
  }
  return tokens;
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

// ---- all files ----

function filePanel(f: FileView, i: number, _stepIndexById: Map<string, number>): string {
  const reviewHash = fileReviewHash(f);
  return `<section class="ds-filepanel${f.untoured ? ' is-untoured' : ''}" data-file-panel="${i}" data-file="${esc(
    f.file,
  )}" data-review-hash="${reviewHash}"${f.kind === 'new' ? ' data-newfile="1"' : ''}${
    f.kind === 'context' ? ' data-context-file="1"' : ''
  }${i === 0 ? '' : ' hidden'}>
    <div class="ds-filepanel-loading" data-file-panel-lazy role="status">Loading file review…</div>
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
  // Changed files default to Split. A context-only file has no before/after
  // diff, so Unified is its real evidence and Split must not be offered.
  const toggle = f.kind === 'context'
    ? `<div class="ds-modetoggle" role="group" aria-label="File display mode"><button class="is-active" data-mode="diff" aria-pressed="true">Unified</button>${
        f.hasFull ? '<button data-mode="full" aria-pressed="false">Full file</button>' : ''
      }</div>`
    : f.hasFull
      ? `<div class="ds-modetoggle" role="group" aria-label="Diff display mode"><button data-mode="diff" aria-pressed="false">Unified</button><button class="is-active" data-mode="split" aria-pressed="true">Split</button><button data-mode="full" aria-pressed="false">Full file</button></div>`
    : f.hunks.length
      ? `<div class="ds-modetoggle" role="group" aria-label="Diff display mode"><button data-mode="diff" aria-pressed="false">Unified</button><button class="is-active" data-mode="split" aria-pressed="true">Split</button></div>`
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
      <div data-diff-inner${f.kind === 'context' ? '' : ' hidden'}><div class="ds-diffbody ds-diffbody-unified">${unified}</div></div>
      <div data-split-inner${f.kind === 'context' ? ' hidden' : ''}><div class="ds-diffnote" role="status">Loading the split view…</div></div>
      <div data-full-inner hidden></div>
    </div>
  `;
}

function fileReviewHash(file: FileView): string {
  // Story-derived presentation flags are intentionally absent: repairing the
  // narrative must not clear a review mark when the file diff is unchanged.
  return file.reviewHash;
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

function feedbackCard(repo: string, headRef: string | undefined, c: Comment): string {
  const anchor = commentAnchorState(repo, headRef, c);
  const currentExcerpt = feedbackCurrentExcerpt(repo, headRef, c, anchor);
  const flavorControls = (['change', 'question', 'nit'] as CommentType[]).map((type) => `<button type="button" data-edit-flavor="${type}" aria-pressed="${c.type === type}">${FLAVOR_LABEL[type]}</button>`).join('');
  return `<article class="ds-feedback-card" data-feedback-card data-feedback-anchor="${anchor}" data-comment-id="${esc(
    c.id,
  )}" data-comment-file="${esc(c.file)}" data-comment-line="${c.line}" data-comment-step="${esc(c.step ?? '')}">
    <div class="ds-feedback-head">
      <span class="ds-flavor-ico">${FLAVOR_ICON[c.type] ?? FLAVOR_ICON.change}</span>
      <span class="ds-feedback-type">${FLAVOR_LABEL[c.type] ?? FLAVOR_LABEL.change}</span>
      <span class="ds-feedback-path">${esc(c.file)}<span class="ds-dim">:${c.line}</span></span>
      <span class="ds-flex"></span>
      <span class="ds-anchorbadge is-${anchor}">${anchorLabel(anchor)}</span>
    </div>
    ${c.selectedText ? `<div class="ds-feedback-compare"><div><span>Commented on</span><code class="ds-feedback-selection">${esc(c.selectedText)}</code></div>${currentExcerpt ? `<div><span>${anchor === 'moved' ? 'Current location' : 'Current region'}</span><code class="ds-feedback-selection is-current">${esc(currentExcerpt)}</code></div>` : ''}</div>` : ''}
    <div class="ds-feedback-message ds-md">${renderMarkdown(c.body)}</div>
    <div class="ds-queue-edit" data-comment-editor hidden>
      <div class="ds-queue-edit-types" role="group" aria-label="Comment type">${flavorControls}</div>
      <textarea data-edit-body rows="3" aria-label="Edit review comment">${esc(c.body)}</textarea>
      <div class="ds-queue-edit-actions"><button type="button" class="ds-feedback-action" data-edit-cancel>Cancel</button><button type="button" class="ds-btn ds-btn-solid" data-edit-save>Save</button></div>
    </div>
    <div class="ds-feedback-actions">
      <button type="button" class="ds-feedback-action" data-goto-comment="${esc(c.id)}">Go to code</button>
      <button type="button" class="ds-feedback-action" data-edit-comment="${esc(c.id)}">Edit</button>
      <button type="button" class="ds-feedback-action ds-danger" data-remove-comment="${esc(c.id)}">Remove</button>
    </div>
  </article>`;
}

function feedbackGroups(repo: string, headRef: string | undefined, comments: Comment[]): string {
  if (!comments.length) {
    return '<div class="ds-drawer-empty">No queued comments. Select code in the diff and press C.</div>';
  }
  const sorted = [...comments].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.createdAt.localeCompare(b.createdAt));
  const groups = new Map<string, Comment[]>();
  for (const comment of sorted) groups.set(comment.file, [...(groups.get(comment.file) ?? []), comment]);
  return [...groups].map(([file, fileComments]) => `<section class="ds-feedback-group" data-feedback-group="${esc(file)}">
    <div class="ds-feedback-group-head"><code>${esc(file)}</code><span>${fileComments.length} ${plural(fileComments.length, 'comment')}</span></div>
    ${fileComments.map((comment) => feedbackCard(repo, headRef, comment)).join('')}
  </section>`).join('');
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

interface ReviewPanelInput {
  repo: string;
  headRef: string | undefined;
  comments: Comment[];
  model: ReviewModel;
  routeBase: string;
  openCount: number;
  feedbackHealthy: boolean;
  feedbackRecovery: string;
  trustPill: string;
  stepIndexById: Map<string, number>;
  excludedFiles: ReviewExclusionMetadata[];
  indexDivergentFiles: string[];
  storyless: boolean;
}

/** The review page's tabs, in the order a reviewer meets them. */
const REVIEW_TABS = [
  { id: 'coverage', label: 'Coverage' },
  { id: 'notes', label: 'Comments' },
  { id: 'challenge', label: 'Challenge' },
  { id: 'actions', label: 'Actions' },
] as const;

/**
 * The Review view: a full page rather than a popover stacked on two drawers.
 *
 * Everything a reviewer needs to decide lives here — status, coverage evidence,
 * every queued comment, the challenge pass, and the actions — because a
 * cramped modal was hiding the one signal that says whether the change is safe
 * to accept. Stacking all of it cost the other extreme: a single column so tall
 * that reaching the actions meant scrolling past every unexplained range.
 *
 * So the page is tabbed, and the verdict is not one of the tabs. The queued
 * count and the trust pill stay pinned above the tab bar, visible from every
 * panel, because a reviewer reading their notes should not have to scroll back
 * to remember whether the story still covers the diff.
 */
function reviewPanel({
  repo,
  headRef,
  comments,
  model,
  routeBase,
  openCount,
  feedbackHealthy,
  feedbackRecovery,
  trustPill,
  stepIndexById,
  excludedFiles,
  indexDivergentFiles,
  storyless,
}: ReviewPanelInput): string {
  const cards = feedbackGroups(repo, headRef, comments);
  // The coverage tab's flag has no honest value until the lazy coverage check
  // answers, so a pending page ships it empty and the client fills it in. The
  // mark is decorative; the tab's own label is what a screen reader reads, so
  // the two are written together and must be updated together.
  const coverage = model.trust.pending
    ? { flag: '', label: '' }
    : coverageFlag(model.trust.uncovered.length, excludedFiles.length + indexDivergentFiles.length);
  const tabs = REVIEW_TABS.map((tab) => {
    const active = tab.id === 'coverage';
    const badge =
      tab.id === 'coverage'
        ? `<span class="ds-reviewtab-flag" data-coverage-flag aria-hidden="true"${coverage.flag ? '' : ' hidden'}>${coverage.flag}</span>`
        : tab.id === 'notes'
          ? `<span class="ds-reviewtab-count" data-review-open-notes${openCount ? '' : ' hidden'}>${openCount}</span>`
          : '';
    const label = tab.id === 'coverage' && coverage.label ? ` aria-label="Coverage, ${esc(coverage.label)}"` : '';
    return `<button class="ds-reviewtab${active ? ' is-active' : ''}" type="button" role="tab" id="ds-reviewtab-${tab.id}" data-review-tab-select="${tab.id}" aria-controls="ds-reviewpanel-${tab.id}" aria-selected="${active}" tabindex="${active ? '0' : '-1'}"${label}>${tab.label}${badge}</button>`;
  }).join('');
  return `<div class="ds-reviewpage" data-review-tab="coverage">
  <div class="ds-reviewsummary" data-review-section="status" tabindex="-1">
    <span class="ds-review-summary-label"><span class="ds-dot ds-dot-amber"></span><span><b>${openCount}</b> queued ${plural(openCount, 'comment')}</span></span>
    ${!feedbackHealthy ? `<div class="ds-feedback-health-alert" role="alert"><strong>Feedback file needs repair</strong><span>${esc(feedbackRecovery)}</span></div>` : ''}
    ${trustPill}
  </div>
  <div class="ds-reviewtabs" role="tablist" aria-label="Review sections">${tabs}</div>
  <div class="ds-reviewpanel" id="ds-reviewpanel-coverage" role="tabpanel" aria-labelledby="ds-reviewtab-coverage" data-review-panel="coverage" tabindex="0">
    ${renderTrustEvidence(model.trust, stepIndexById, excludedFiles, indexDivergentFiles, storyless)}
  </div>
  <div class="ds-reviewpanel" id="ds-reviewpanel-notes" role="tabpanel" aria-labelledby="ds-reviewtab-notes" data-review-panel="notes" tabindex="0" hidden>
  <section class="ds-reviewpage-section" data-review-section="notes" aria-labelledby="ds-reviewpage-notes-h" tabindex="-1">
    <div class="ds-queue-head">
      <div class="ds-queue-title">
        <h2 class="ds-reviewpage-h" id="ds-reviewpage-notes-h">Review comments <span class="ds-reviewpage-sub" data-queue-summary${openCount ? '' : ' hidden'}>${openCount} queued</span></h2>
        <p>Collect comments while you review, then copy the complete queue when you are ready.</p>
      </div>
      <div class="ds-queue-actions">
        <button type="button" class="ds-btn ds-btn-solid" data-copy-comments="queued"${openCount ? '' : ' disabled'}>Copy all</button>
      </div>
    </div>
    <div class="ds-feedback-list" data-feedback-view="feedback">${cards}</div>
  </section>
  </div>
  <div class="ds-reviewpanel" id="ds-reviewpanel-challenge" role="tabpanel" aria-labelledby="ds-reviewtab-challenge" data-review-panel="challenge" tabindex="0" hidden>
  <section class="ds-reviewpage-section" data-review-section="challenge" aria-labelledby="ds-reviewpage-challenge-h" tabindex="-1">
    <h2 class="ds-reviewpage-h" id="ds-reviewpage-challenge-h">Challenge pass</h2>
    <div class="ds-challenge-panel" data-feedback-view="challenge">${challengeChecklist(model)}</div>
  </section>
  </div>
  <div class="ds-reviewpanel" id="ds-reviewpanel-actions" role="tabpanel" aria-labelledby="ds-reviewtab-actions" data-review-panel="actions" tabindex="0" hidden>
  <section class="ds-reviewpage-section" data-review-section="actions" aria-labelledby="ds-reviewpage-actions-h" tabindex="-1">
    <h2 class="ds-reviewpage-h" id="ds-reviewpage-actions-h">Review actions</h2>
    <div class="ds-review-section">
      <a class="ds-review-option" href="${esc(routeBase)}/stories">
        <span class="ds-review-option-title">Saved reviews</span>
        <span class="ds-review-option-desc">Open older review sessions for this repository.</span>
      </a>
    </div>
  </section>
  </div>
</div>`;
}

/**
 * What the Coverage tab's flag says. Ranges the story never explains get a
 * count; files merely kept outside the renderer get a bare mark, because the
 * two are different kinds of debt and adding them together would invent a
 * number that means nothing.
 */
function coverageFlag(uncovered: number, outside: number): { flag: string; label: string } {
  if (uncovered) {
    return { flag: `▲${uncovered}`, label: `${uncovered} ${plural(uncovered, 'change')} not explained by the story` };
  }
  if (outside) return { flag: '▲', label: 'files to inspect outside the story' };
  return { flag: '', label: '' };
}

function driftDrawer(report?: StoryDriftView): string {
  if (!report || report.state === 'unverified' || !report.files.length) return '';
  const summary = report.inScopeFiles
    ? `${report.inScopeFiles} story ${plural(report.inScopeFiles, 'file')}${report.outsideScopeFiles ? ` and ${report.outsideScopeFiles} side ${plural(report.outsideScopeFiles, 'file')}` : ''} changed after this story was captured.`
    : `${report.outsideScopeFiles} side ${plural(report.outsideScopeFiles, 'file')} changed. The story's selected files still match its baseline.`;
  const rows = report.files.map((file) => {
    const pathLabel = file.oldPath && file.oldPath !== file.path ? `${file.oldPath} → ${file.path}` : file.path;
    const totals = file.additions !== undefined || file.deletions !== undefined
      ? `<span class="ds-drift-lines"><i>+${file.additions ?? 0}</i><b>−${file.deletions ?? 0}</b></span>`
      : '';
    return `<button type="button" class="ds-drift-file" data-drift-file="${esc(file.path)}" data-drift-label="${esc(pathLabel)}" data-drift-detail="${file.detail}" aria-pressed="false"><span class="ds-drift-file-main"><code>${esc(pathLabel)}</code><span>${esc(driftFileStatus(file.status))}${file.detail === 'summary-only' ? ' · summary only' : ''}</span></span><span class="ds-drift-file-meta"><em class="is-${file.scope}">${file.scope === 'story' ? 'Story' : 'Side'}</em>${totals}</span></button>`;
  }).join('');
  return `<div class="ds-drawer-root" id="ds-drift-drawer" data-drift-observation="${esc(report.observationId ?? '')}" hidden>
    <div class="ds-drawer-scrim" data-drift-close></div>
    <div class="ds-drawer ds-drift-drawer" role="dialog" aria-modal="true" aria-labelledby="ds-drift-title" tabindex="-1">
      <div class="ds-drawer-head">
        <div><div class="ds-drawer-title" id="ds-drift-title">Since story</div><div class="ds-drawer-sub">${esc(summary)}</div></div>
        <button class="ds-drawer-x" data-drift-close title="Close" aria-label="Close changes since story">×</button>
      </div>
      <div class="ds-drift-body">
        <div class="ds-drift-list" role="list" aria-label="Files changed since story">${rows}</div>
        <div class="ds-drift-detail">
          <div class="ds-drift-detail-head"><button type="button" class="ds-drift-back" data-drift-back>← Files</button><code data-drift-selected-path aria-live="polite"></code></div>
          <div class="ds-drift-preview" data-drift-preview><div class="ds-diffnote">Choose a file to load its exact change since the story.</div></div>
        </div>
      </div>
    </div>
  </div>`;
}

function driftFileStatus(status: StoryDriftViewFile['status']): string {
  return status === 'mode-changed' ? 'Mode changed' : status.charAt(0).toUpperCase() + status.slice(1);
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
  // Was the step's review question until that field went away; the title is what
  // the reviewer recognizes from the rail anyway.
  const targets = specific.map(({ step, index }) => `<button type="button" class="ds-challenge-target" data-goto-step="${index + 1}"><span>Step ${step.order}</span><strong>${step.title.html}</strong><i aria-hidden="true">→</i></button>`).join('');
  return `<div class="ds-challenge-head"><strong>Adversarial review pass</strong><p>This checklist structures a human second pass; it does not certify the change.</p></div><div class="ds-challenge-list">${items}</div>${targets ? `<div class="ds-challenge-targets"><span>Steps to re-read</span>${targets}</div>` : ''}`;
}

function commandPalette(): string {
  const commands = [
    ['story', 'Open Story', 'J / K', 'Move through the guided walkthrough'],
    ['files', 'Open All files', '/', 'Search and filter the changed files'],
    ['review', 'Open Review', '', 'Unresolved notes, coverage evidence, and the challenge pass'],
    ['next-unviewed', 'Next unreviewed file', '', 'Keep the review moving'],
    ['toggle-viewed', 'Toggle current file reviewed', 'V', 'Bind completion to this exact file diff'],
    ['read-aloud', 'Toggle read aloud', 'Space', 'Pause or resume narration'],
  ];
  return `<div class="ds-command-root" data-command-root hidden>
    <div class="ds-command-scrim" data-shortcuts-close aria-hidden="true"></div>
    <div class="ds-command" role="dialog" aria-modal="true" aria-labelledby="ds-command-title" aria-describedby="ds-command-description" tabindex="-1">
      <div class="ds-command-head"><div><strong id="ds-command-title">Commands</strong><span id="ds-command-description">Keyboard-first review without hidden magic.</span></div><button data-shortcuts-close type="button" aria-label="Close commands">×</button></div>
      <div class="ds-command-list" role="group" aria-label="Review commands">${commands
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

// ---- trust evidence ----

export function renderTrustEvidence(
  trust: TrustView,
  stepIndexById: Map<string, number>,
  excludedFiles: ReviewExclusionMetadata[],
  indexDivergentFiles: string[],
  storyless: boolean,
): string {
  const clean = !trust.uncovered.length;
  const verdict = trust.pending
    ? `<div class="ds-trust-clean">Coverage is calculated from lazy file evidence as it is requested. This page does not call an unloaded change “covered.”</div>`
    : storyless
    ? `<div class="ds-trust-clean">The full bounded diff is available file by file. No story-coverage claim is applied in this view.</div>`
    : clean
    ? `<div class="ds-trust-clean">✓ Every changed range in the bounded renderer is fully explained by a step.</div>`
    : '';
  const coverage = `<section class="ds-reviewpage-section" data-review-section="evidence" aria-labelledby="ds-reviewpage-evidence-h" tabindex="-1">
    <h2 class="ds-reviewpage-h" id="ds-reviewpage-evidence-h">Coverage</h2>
    <div class="ds-trust-sub">${storyless ? 'Exact change scope, staging state, and files outside the bounded renderer.' : 'Coverage of the bounded review, plus every file kept outside it.'}</div>
    ${storyless || trust.pending ? '' : `<div class="ds-trust-stats">
      <div class="ds-trust-stat ok"><div class="ds-trust-num">${trust.coveredLines}</div><div class="ds-trust-lbl">changed ${plural(
        trust.coveredLines,
        'line',
      )} covered by a step</div></div>
      <div class="ds-trust-stat warn"><div class="ds-trust-num">${trust.uncoveredLines}</div><div class="ds-trust-lbl">${plural(
        trust.uncoveredLines,
        'change',
      )} no step explains</div></div>
    </div>`}
    ${verdict}
    <div class="ds-trust-foot">${storyless ? 'The page shows the bounded diff directly. Excluded files and divergent staged state remain separate reviewer responsibilities.' : 'Coverage means every rendered changed range is fully claimed by story steps. Excluded files remain a separate reviewer responsibility.'}</div>
  </section>`;
  const unexplained = trust.pending || storyless || clean ? '' : unexplainedSection(trust, stepIndexById);
  const exclusions = excludedFiles.length
    ? `<section class="ds-reviewpage-section ds-exclusions" data-review-section="exclusions" aria-labelledby="ds-exclusions-title" tabindex="-1">
        <h2 class="ds-reviewpage-h" id="ds-exclusions-title">Outside the bounded renderer <span class="ds-option-count">${excludedFiles.length}</span></h2>
        <p class="ds-exclusions-note">These files are part of the git change but are not included in story coverage or the default diff DOM. Inspect them deliberately before deciding.</p>
        ${excludedFiles.map(excludedFileCard).join('')}
        <label class="ds-exclusion-ack"><input type="checkbox" data-exclusions-ack><span><strong>I inspected these exclusions</strong><small>Bound to this exact diff; a code change clears the acknowledgement.</small></span></label>
      </section>`
    : '';
  const stagedState = indexDivergentFiles.length
    ? `<section class="ds-reviewpage-section ds-exclusions" data-review-section="staged" aria-labelledby="ds-index-state-title" tabindex="-1">
        <h2 class="ds-reviewpage-h" id="ds-index-state-title">Staged state differs <span class="ds-option-count">${indexDivergentFiles.length}</span></h2>
        <p class="ds-exclusions-note">These paths contain one version in Git's index and another in the working tree. A single combined diff cannot prove which version you intend to commit, so approval stays blocked until they match.</p>
        ${indexDivergentFiles.map((path) => `<article class="ds-exclusion-card"><div><code>${esc(path)}</code><span>Index and working tree contain different bytes</span></div></article>`).join('')}
      </section>`
    : '';
  // Every block below is its own review-page section, so the wrapper only exists
  // to give the lazy fetch one node to swap. data-trust-uncovered is how that
  // replacement settles the pill: an empty value means "no verdict" — the client
  // must leave the pill alone rather than read a missing answer as zero.
  return `<div class="ds-trust-evidence" data-trust-evidence data-trust-pending="${trust.pending ? '1' : '0'}" data-trust-uncovered="${trust.pending ? '' : trust.uncovered.length}" data-trust-storyless="${storyless ? '1' : '0'}">
    ${coverage}
    ${unexplained}
    ${stagedState}
    ${exclusions}
  </div>`;
}

/**
 * The unexplained changes, on their own.
 *
 * These used to render inline under Status, which turned a routine "19 ranges no
 * step claims" into a page-long wall of amber the moment the review page opened.
 * They are evidence a reviewer should choose to read, not an alarm: the section
 * states the size of the gap and which files hold it, and keeps the diff cards
 * behind a disclosure that stays shut until asked.
 */
function unexplainedSection(trust: TrustView, stepIndexById: Map<string, number>): string {
  const ranges = trust.uncovered.length;
  const byFile = new Map<string, { ranges: number; lines: number }>();
  for (const u of trust.uncovered) {
    const entry = byFile.get(u.file) ?? { ranges: 0, lines: 0 };
    entry.ranges += 1;
    entry.lines += u.rows.filter((r) => r.type === 'add').length;
    byFile.set(u.file, entry);
  }
  const files = [...byFile.entries()].sort((a, b) => b[1].ranges - a[1].ranges || a[0].localeCompare(b[0]));
  const fileRows = files
    .map(
      ([file, count]) =>
        `<button type="button" class="ds-unexplained-file" data-goto-file="${esc(file)}" title="Open ${esc(file)} in Files">
          <code>${esc(file)}</code>
          <span class="ds-unexplained-file-count">${count.ranges} ${plural(count.ranges, 'range')}${count.lines ? ` · ${count.lines} ${plural(count.lines, 'line')}` : ''}</span>
        </button>`,
    )
    .join('');
  return `<section class="ds-reviewpage-section ds-unexplained" data-review-section="unexplained" aria-labelledby="ds-reviewpage-unexplained-h" tabindex="-1">
    <h2 class="ds-reviewpage-h" id="ds-reviewpage-unexplained-h"><span class="ds-tri" aria-hidden="true">▲</span>Unexplained changes <span class="ds-option-count">${ranges}</span></h2>
    <p class="ds-unexplained-note">${ranges} changed ${plural(ranges, 'range')} across ${files.length} ${plural(files.length, 'file')} ${ranges === 1 ? 'is' : 'are'} in the diff with no story step walking through ${ranges === 1 ? 'it' : 'them'}. That is a gap in the story, not a verdict on the code — read ${ranges === 1 ? 'it' : 'them'} yourself, or ask ${esc(APP_BRAND)} to explain.</p>
    <div class="ds-unexplained-files">${fileRows}</div>
    <details class="ds-unexplained-detail" data-unexplained-disclosure>
      <summary><span class="ds-unexplained-summary-label">Show ${ranges === 1 ? 'the change' : `all ${ranges} changes`}</span><span class="ds-unexplained-summary-hint">diff, with jump and explain actions</span></summary>
      <div class="ds-unexplained-cards">${trust.uncovered.map((u) => trustCard(u, stepIndexById)).join('')}</div>
    </details>
  </section>`;
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

/** Compact, single-column rendering for since-story evidence. The drawer's
 * header already carries the path, so this keeps mobile focused on the exact
 * changed lines instead of squeezing two code columns into half a viewport. */
export function renderUnifiedHunks(file: DiffFile): string {
  if (!file.hunks.length) return `<div class="ds-diffnote">No diff to show.</div>`;
  const body = file.hunks.map((hunk, index) => {
    const rows = hunk.lines.map((line) => renderUnifiedRow({
      type: line.type,
      no: line.newNo ?? line.oldNo,
      content: line.content,
    }));
    return `${index ? renderHunkGap() : ''}${rows.join('')}`;
  }).join('');
  return `<div class="ds-diffbody ds-diffbody-unified ds-drift-unified">${body}</div>`;
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
