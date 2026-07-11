// Turn a validated tour + the parsed diff into a single self-contained HTML page —
// the diffStory review screen. All code content is escaped here, server-side; the
// client JS only ever sets textContent or injects this server-escaped HTML, so
// there is no HTML-injection sink.
import { join } from 'node:path';
import { PAGE_CSS, PAGE_JS } from './page-assets.js';
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from './progress-ui.js';
import { APP_BRAND } from './config.js';
import { BRAND_HEAD_LINKS, brandStoryMarkSvg } from './brand.js';
import { kokoroVoiceOptions } from './kokoro-tts.js';
import { buildReviewModel } from './view-model.js';
import { intraLineMap, type IntraSides } from './intra-line.js';
import { renderSplitRow, renderUnifiedRow, renderHunkGap, type RowTarget } from './diff-render.js';
import type {
  FileView,
  ReviewModel,
  SbsRow,
  StepView,
  TrustView,
  UncoveredView,
  UnifiedRow,
} from './view-model.js';
import { normalizeComment } from './comments.js';
import type { Comment, CommentSide, CommentType, DiffFile, Tour, Turn } from './types.js';
import type { ReviewStateSummary } from './review-state.js';
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

function commentSide(c: Comment): CommentSide {
  return c.side === 'left' ? 'left' : 'right';
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
  const repoName = input.repoName ?? (() => {
    try {
      return decodeURIComponent(routeBase.split('/').filter(Boolean).pop() ?? 'repo');
    } catch {
      return 'repo';
    }
  })();
  const storyless = input.storyless ?? false;
  const reviewMode = input.reviewMode ?? 'full';
  const reviewState = input.reviewState ?? {
    scopeKey: '',
    round: 1,
    currentDiffHash: '',
    changedFiles: [],
    hasChangesSinceReview: false,
    events: [],
    snapshots: [],
  };
  const model = buildReviewModel(repo, tour, files, headRef, { storyless });
  const pageTitle = storyless ? 'Reviewing the diff' : tour.title;
  // Navigation is 0-based with the Overview as index 0, so step i lands at i + 1.
  // Every [data-goto-step] target (file chips, trust drawer) reads from this map.
  const stepIndexById = new Map(model.steps.map((s, i) => [s.id, i + 1]));

  const openCount = comments.filter((c) => c.status !== 'resolved').length;
  const uncoveredCount = model.trust.uncovered.length;
  const approveReady = openCount === 0 && uncoveredCount === 0;
  // No story → no coverage to report, so the trust pill is meaningless; hide it.
  const trustPill = storyless
    ? ''
    : `<button class="ds-trustpill${uncoveredCount ? '' : ' is-clean'}" data-trust-open title="Trust check — changes in the diff that no story step explains">${
        uncoveredCount
          ? `<span class="ds-tri">▲</span><b>${uncoveredCount}</b> unexplained`
          : `<span class="ds-check">✓</span> all changes explained`
      }</button>`;

  const railCards = model.steps.map((s, i) => railCard(s, i)).join('');
  const railFiles = railFileTree(model.files, comments, reviewState.changedFiles);
  const kokoroVoiceCards = kokoroVoiceOptions().map((v, i) => voiceCard('kokoro', v.id, v.label, v.description, i === 0)).join('');
  const stepPanels = model.steps
    .map((s, i) => stepPanel(repo, s, i, model.totalSteps, comments))
    .join('');
  const filePanels = model.files.map((f, i) => filePanel(f, i, stepIndexById)).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f2f2f7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1c1c1e" media="(prefers-color-scheme: dark)">
${BRAND_HEAD_LINKS}
<title>${esc(APP_BRAND)} — ${esc(pageTitle)}</title>
<style>${PAGE_CSS}${progressPanelStyles()}</style>
</head>
<body${storyless ? ' data-storyless="1"' : ''} data-viewed-scope="${esc(`${repo}|${reviewState.scopeKey || baseLabel}|${reviewMode}`)}" data-review-scope="${esc(
    reviewState.scopeKey,
  )}" data-review-round="${reviewState.round}" data-review-snapshot="${esc(
    reviewState.currentSnapshotId ?? '',
  )}" data-current-review-mode="${reviewMode}"${reviewMode === 'since' ? ' data-initial-view="files"' : ''}>
<header class="ds-top">
  <button class="ds-sidebar-toggle" data-sidebar-toggle aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar">
    <span class="ds-sidebar-toggle-ico">☰</span>
  </button>
  <a class="ds-back" data-close-story href="${esc(routeBase)}/stories" title="Close this story — back to ${esc(
    repoName,
  )}'s saved stories" aria-label="Close story, back to saved stories">
    <span class="ds-back-ico" aria-hidden="true">‹</span> Stories
  </a>
  <div class="ds-titlewrap">
    <div class="ds-titlebar">
      <a class="ds-crumb-repo" href="${esc(routeBase)}/stories" title="${esc(repoName)} — saved stories">${esc(repoName)}</a>
      <span class="ds-kicker"><span class="ds-dim">·</span> Reviewing <span class="ds-dim">vs</span> <span class="ds-change" title="Diffing the working tree against ${esc(
        baseLabel,
      )}">${esc(baseLabel)}</span></span>
    </div>
    <div class="ds-title" title="${esc(storyless ? 'The current diff, file by file' : tour.summary || tour.title)}">${esc(pageTitle)}</div>
  </div>
  <div class="ds-settings-wrap">
    <button class="ds-readaloud" data-readaloud title="Read story aloud" aria-label="Read story aloud" aria-pressed="false"><span class="ds-readaloud-ico">▶</span><span class="ds-sr-only" data-readaloud-label>Read aloud</span></button>
    <button class="ds-gear" data-settings title="Voice settings" aria-label="Voice settings">⚙</button>
    <div class="ds-settings-pop" id="ds-settings" hidden>
      <div class="ds-voice-head">
        <div>
          <div class="ds-settings-title">Read aloud</div>
          <div class="ds-voice-now" data-voice-status>Voice ready</div>
        </div>
        <button class="ds-preview" data-preview-voice><span class="ds-preview-ico">▶</span><span data-preview-label>Preview</span></button>
      </div>
      <div class="ds-engine-row" aria-label="Voice engine">
        <button data-voice-engine="browser" class="is-active">Browser</button>
        <button data-voice-engine="say">Mac local</button>
        <button data-voice-engine="kokoro">Kokoro AI</button>
      </div>
      <div class="ds-voice-grid" data-browser-voices aria-label="Browser voice style">
        <button class="ds-voice-card is-active" data-voice-preset="story">
          <span class="ds-voice-badge">S</span>
          <span><span class="ds-voice-name">Story <span class="ds-voice-check">✓</span></span><span class="ds-voice-desc">Best natural browser narrator for walkthroughs.</span></span>
        </button>
        <button class="ds-voice-card" data-voice-preset="flirty">
          <span class="ds-voice-badge">F</span>
          <span><span class="ds-voice-name">Warm <span class="ds-voice-check">✓</span></span><span class="ds-voice-desc">Softer browser voice when available.</span></span>
        </button>
        <button class="ds-voice-card" data-voice-preset="bass">
          <span class="ds-voice-badge">M</span>
          <span><span class="ds-voice-name">Deep <span class="ds-voice-check">✓</span></span><span class="ds-voice-desc">Lower browser voice when available.</span></span>
        </button>
        <button class="ds-voice-card" data-voice-preset="system">
          <span class="ds-voice-badge">SYS</span>
          <span><span class="ds-voice-name">System <span class="ds-voice-check">✓</span></span><span class="ds-voice-desc">Browser default, fastest and plainest.</span></span>
        </button>
      </div>
      <div class="ds-voice-grid ds-say-voice-grid" data-say-voices aria-label="Mac local voice" hidden>
        <button class="ds-voice-card is-active" data-say-voice="samantha">
          <span class="ds-voice-badge">S</span>
          <span><span class="ds-voice-name">Samantha <span class="ds-voice-check">✓</span></span><span class="ds-voice-desc">macOS local voice.</span></span>
        </button>
        <button class="ds-voice-card" data-say-voice="daniel">
          <span class="ds-voice-badge">D</span>
          <span><span class="ds-voice-name">Daniel <span class="ds-voice-check">✓</span></span><span class="ds-voice-desc">macOS local voice.</span></span>
        </button>
      </div>
      <div class="ds-voice-grid ds-kokoro-voice-grid" data-kokoro-voices aria-label="Kokoro AI voice" hidden>
        ${kokoroVoiceCards}
      </div>
      <div class="ds-settings-row">
        <span class="ds-settings-label">Speed</span>
        <div class="ds-speed-row" aria-label="Read aloud speed">
          <button data-rate="0.8">Slow</button>
          <button data-rate="1.05" class="is-active">Normal</button>
          <button data-rate="1.4">Fast</button>
        </div>
      </div>
    </div>
  </div>
  <div class="ds-actions">
    ${
      storyless
        ? `<button class="ds-review-menu ds-reload-diff" data-reload-diff type="button" title="Re-read the working tree and refresh this diff">
        <span class="ds-review-menu-dot" aria-hidden="true"></span>
        <span>Reload diff</span>
      </button>`
        : ''
    }
    <div class="ds-review-menu-wrap">
      <button class="ds-review-menu" data-review-menu aria-haspopup="menu" aria-expanded="false" aria-label="Review, ${openCount} ${plural(openCount, 'open comment')}" title="Open review actions">
        <span class="ds-review-menu-dot" aria-hidden="true"></span>
        <span>Review</span>
        <span class="ds-review-menu-count" id="ds-open-count" title="Open comments"><b>${openCount}</b></span>
        <span class="ds-review-menu-caret" aria-hidden="true">⌄</span>
      </button>
      <div class="ds-review-menu-pop" data-review-menu-pop role="menu" hidden>
        <div class="ds-review-menu-title">Review</div>
        <div class="ds-review-summary">
          <span class="ds-review-summary-label"><span class="ds-dot ds-dot-amber"></span><b>${openCount}</b> ${plural(openCount, 'open comment')}</span>
          ${trustPill}
        </div>
        <button class="ds-review-option" data-address-all role="menuitem"${openCount ? '' : ' disabled'} title="Resend every open comment to your agent">
          <span class="ds-review-option-title">Send open comments</span>
          <span class="ds-review-option-desc">For older notes, or if an auto-send failed.</span>
        </button>
        <button class="ds-review-option" data-copy-comments="open" role="menuitem"${openCount ? '' : ' disabled'} title="Copy open comments as text to paste into your own agent chat">
          <span class="ds-review-option-title">Copy open comments</span>
          <span class="ds-review-option-desc">Grab the open comments as text to paste into any agent chat yourself.</span>
        </button>
        <button class="ds-review-option" data-copy-comments="all" role="menuitem"${comments.length ? '' : ' disabled'} title="Copy every comment, including resolved ones and diffStory's replies">
          <span class="ds-review-option-title">Copy all comments</span>
          <span class="ds-review-option-desc">The full thread — every status, with replies — for context.</span>
        </button>
        <button class="ds-review-option" data-feedback-open="feedback" role="menuitem"${comments.length ? '' : ' disabled'}>
          <span class="ds-review-option-title">Review feedback${comments.length ? ` <span class="ds-option-count">${comments.length}</span>` : ''}</span>
          <span class="ds-review-option-desc">Verify agent replies, reopen issues, or jump back to the code.</span>
        </button>
        <button class="ds-review-option" data-feedback-open="timeline" role="menuitem">
          <span class="ds-review-option-title">Review timeline</span>
          <span class="ds-review-option-desc">See review rounds, feedback, agent runs, and verification.</span>
        </button>
        <button class="ds-review-option" data-resume-review role="menuitem" hidden>
          <span class="ds-review-option-title">Resume last position</span>
          <span class="ds-review-option-desc" data-resume-review-label>Return to where you stopped reading.</span>
        </button>
        <button class="ds-review-option" data-shortcuts-open role="menuitem">
          <span class="ds-review-option-title">Commands and shortcuts <span class="ds-keycap">?</span></span>
          <span class="ds-review-option-desc">Navigate, filter, comment, and control read-aloud.</span>
        </button>
        <button class="ds-review-option" data-verdict="request" role="menuitem">
          <span class="ds-review-option-title">Ask for fixes</span>
          <span class="ds-review-option-desc">Use this when the change is not ready to merge.</span>
        </button>
        <button class="ds-review-option ds-review-option-approve" data-verdict="approve" role="menuitem"${approveReady ? '' : ' disabled'} title="${
          approveReady
            ? 'Everything is covered and there are no open comments'
            : 'Resolve open comments and make sure every change is explained first'
        }">
          <span class="ds-review-option-title"><span class="ds-check">✓</span> Mark approved</span>
          <span class="ds-review-option-desc">Available when comments are resolved and the story covers the diff.</span>
        </button>
      </div>
    </div>
  </div>
</header>

<div id="ds-agentpanel">${progressPanelMarkup('floating')}</div>

${reviewRoundBar(reviewState, reviewMode)}

<div class="ds-layout">
  <aside class="ds-rail" aria-label="Review navigation">
    <div class="ds-railpad">
      <div class="ds-viewtoggle" role="tablist">
        <button class="ds-tab is-active" id="ds-tab-tour" data-view="tour" role="tab" aria-controls="ds-view-tour" aria-selected="true" tabindex="0">Story</button>
        <button class="ds-tab" id="ds-tab-files" data-view="files" role="tab" aria-controls="ds-view-files" aria-selected="false" tabindex="-1">All files</button>
      </div>
    </div>
    ${introCard(model)}
    <div class="ds-readhead" data-rail="tour">
      <div class="ds-readhead-row">
        <span class="ds-readhead-label">Reading order</span>
        <span class="ds-readhead-count" id="ds-progress-text">${
          storyless ? 'No story yet' : `${model.totalSteps} ${plural(model.totalSteps, 'step')}`
        }</span>
      </div>
      <div class="ds-readhead-track"><div class="ds-readhead-fill" id="ds-progress-fill" style="width:0%"></div></div>
    </div>
    <div class="ds-readhead" data-rail="files" hidden>
      <div class="ds-readhead-row">
        <span class="ds-readhead-label">Files</span>
        <span class="ds-readhead-count" data-viewed-progress>${model.files.length} ${plural(model.files.length, 'file')}</span>
      </div>
      <div class="ds-filetools">
        <label class="ds-file-search"><span aria-hidden="true">⌕</span><input data-file-search type="search" placeholder="Filter files" aria-label="Filter changed files"></label>
        <div class="ds-filefilters" aria-label="File filters">
          <button class="is-active" data-file-filter="all">All</button>
          <button data-file-filter="unviewed">Unviewed</button>
          <button data-file-filter="comments">Comments</button>
          <button data-file-filter="unexplained">Unexplained</button>
          <button data-file-filter="tests">Tests</button>
          ${reviewState.compareFrom ? '<button data-file-filter="since">Since review</button>' : ''}
        </div>
        <button class="ds-next-unviewed" data-next-unviewed type="button">Next unviewed <span aria-hidden="true">→</span></button>
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
    ${trustRailCard(model.trust)}
    <div class="ds-rail-resizer" data-sidebar-resizer role="separator" aria-orientation="vertical" aria-label="Resize sidebar" tabindex="0" title="Resize sidebar"></div>
  </aside>
  <button class="ds-rail-scrim" data-sidebar-scrim type="button" aria-label="Close review navigation" aria-hidden="true" tabindex="-1"></button>

  <main class="ds-main">
    <div class="ds-view" id="ds-view-tour" role="tabpanel" aria-labelledby="ds-tab-tour" tabindex="0">
      ${storyless ? generateCta(model, routeBase, tour.base, headRef) : introPanel(model, tour)}
      ${storyless ? '' : stepPanels}
    </div>
    <div class="ds-view" id="ds-view-files" role="tabpanel" aria-labelledby="ds-tab-files" tabindex="0" hidden>
      <div class="ds-fileshead">
        <div class="ds-fileshead-l">
          <h1 class="ds-fileshead-title">All files in this change</h1>
          <div class="ds-fileshead-stats">
            <span>${model.filesChanged} changed${
    model.contextFiles ? ` · ${model.contextFiles} context` : ''
  }</span>
            <span class="ds-dot"></span>
            <span class="ds-stat-add">+${model.totalAdd}</span>
            <span class="ds-stat-del">−${model.totalDel}</span>
            ${
              uncoveredCount
                ? `<span class="ds-dot"></span><span class="ds-stat-untoured"><span class="ds-dot ds-dot-amber"></span>${uncoveredCount} unexplained</span>`
                : ''
            }
          </div>
        </div>
        <div class="ds-fileshead-r">
          <span class="ds-fileshint">Pick a file from the list</span>
        </div>
      </div>
      <div class="ds-filedetail" id="ds-file-detail">
        ${filePanels || '<div class="ds-empty">No files in this change.</div>'}
      </div>
    </div>
  </main>
</div>

${trustDrawer(model.trust, stepIndexById)}
${feedbackDrawer(repo, headRef, comments, reviewState)}
${commandPalette()}
<div class="ds-selection-menu" data-selection-menu role="menu" hidden>
  <button type="button" role="menuitem" data-selection-action="question">Ask</button>
  <button type="button" role="menuitem" data-selection-action="change">Ask for change</button>
  <button type="button" role="menuitem" data-selection-action="nit">Nit</button>
</div>
<div class="ds-selection-quick" data-selection-quick role="toolbar" aria-label="Selected code actions" hidden>
  <button type="button" data-selection-quick-action="change">Comment</button>
  <button type="button" data-selection-quick-action="question">Ask</button>
  <button type="button" data-selection-quick-action="copy">Copy</button>
</div>
<div class="ds-toast" id="ds-toast" hidden></div>
<noscript><div class="ds-empty">diffStory needs JavaScript to drive the review.</div></noscript>
<script>${progressPanelScript()}</script>
<script>${PAGE_JS}</script>
</body>
</html>`;
}

// ---- sidebar ----

function voiceCard(kind: 'kokoro', id: string, label: string, description: string, active = false): string {
  const badge = label.slice(0, 1).toUpperCase();
  return `<button class="ds-voice-card${active ? ' is-active' : ''}" data-${kind}-voice="${esc(id)}">
          <span class="ds-voice-badge">${esc(badge)}</span>
          <span><span class="ds-voice-name">${esc(label)} <span class="ds-voice-check">✓</span></span><span class="ds-voice-desc">${esc(description)}</span></span>
        </button>`;
}

function reviewRoundBar(state: ReviewStateSummary, mode: 'full' | 'since'): string {
  if (!state.compareFrom) return '';
  const changed = state.changedFiles.length;
  const status = changed
    ? `${changed} ${plural(changed, 'file')} changed since your feedback`
    : 'No code changes since your feedback';
  return `<div class="ds-roundbar" data-roundbar>
    <div class="ds-roundbar-copy">
      <span class="ds-roundbadge">Round ${state.round}</span>
      <span class="ds-roundstatus">${status}</span>
    </div>
    <div class="ds-roundmodes" role="group" aria-label="Review comparison">
      <button type="button" data-review-mode="full" class="${mode === 'full' ? 'is-active' : ''}">Full change</button>
      <button type="button" data-review-mode="since" class="${mode === 'since' ? 'is-active' : ''}"${
        changed ? '' : ' disabled'
      }>Since review</button>
    </div>
  </div>`;
}

// The Overview sits above the numbered steps as navigation index 0 — the calm
// entry point that answers "what is this change?" before the walkthrough begins.
function introCard(model: ReviewModel): string {
  const n = model.totalSteps;
  return `<button class="ds-stepcard is-intro is-active" data-rail="tour" data-intro data-step-index="0" title="The whole change at a glance, before the walkthrough">
    <span class="ds-num">${STORY_MARK}</span>
    <span class="ds-stepcard-body">
      <span class="ds-stepcard-title">Overview</span>
      <span class="ds-intro-cardsub">The change at a glance${n ? ` · ${n} ${plural(n, 'step')}` : ''}</span>
    </span>
  </button>`;
}

// A rail card carries only what tells steps apart: the number, the headline, and
// the file's base name (full path on hover). The kind badge appears only when it
// is *not* a plain change — "Changed" on every card is noise, so it is dropped.
function railCard(s: StepView, i: number): string {
  const base = splitPath(s.file)[1];
  const badge =
    s.kind === 'changed'
      ? ''
      : `<span class="ds-railbadge ds-badge-${s.kind === 'new-file' ? 'new' : 'context'}">${esc(
          s.kindLabel,
        )}</span>`;
  return `<button class="ds-stepcard" data-step-index="${i + 1}" data-step-id="${esc(s.id)}">
    <span class="ds-num">${i + 1}</span>
    <span class="ds-stepcard-body">
      <span class="ds-stepcard-title">${esc(s.title)}</span>
      <span class="ds-stepcard-fileline">
        <span class="ds-stepcard-file" title="${esc(s.file)}">${esc(base)}</span>${badge}
      </span>
    </span>
  </button>`;
}

// The Overview panel: the change's title and summary up front (this is the only
// place the summary is shown in full), a few orienting facts, and one button into
// the walkthrough. It is navigation index 0 — shown first, before any step.
function introPanel(model: ReviewModel, tour: Tour): string {
  const n = model.totalSteps;
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
    goalText && intent?.design?.trim() ? `<p class="ds-intro-design">${nl(esc(intent.design.trim()))}</p>` : '';
  const map = goalText && summaryText ? `<p class="ds-intro-design">${summaryText}</p>` : '';
  const sources =
    goalText && intent?.sources?.length
      ? `<p class="ds-intro-sources">Why from ${intent.sources.map((s) => esc(s)).join(' · ')}</p>`
      : '';
  const filesLabel = `${plural(model.filesChanged, 'file')} changed${
    model.contextFiles ? ` · ${model.contextFiles} for context` : ''
  }`;
  const trustFact = trust
    ? `<div class="ds-fact ds-fact-warn"><span class="ds-fact-n">▲ ${trust}</span><span class="ds-fact-l">unexplained ${plural(
        trust,
        'change',
      )}</span></div>`
    : `<div class="ds-fact ds-fact-ok"><span class="ds-fact-n">✓</span><span class="ds-fact-l">every change explained</span></div>`;
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
      <p class="ds-intro-lede">${lede}</p>
      ${design}${map}${sources}
      <div class="ds-intro-facts">
        <div class="ds-fact"><span class="ds-fact-n">${n}</span><span class="ds-fact-l">${plural(
    n,
    'step',
  )} to read in order</span></div>
        <div class="ds-fact"><span class="ds-fact-n">${model.filesChanged}</span><span class="ds-fact-l">${filesLabel}</span></div>
        <div class="ds-fact"><span class="ds-fact-n"><span class="ds-stat-add">+${model.totalAdd}</span> <span class="ds-stat-del">−${model.totalDel}</span></span><span class="ds-fact-l">lines</span></div>
        ${trustFact}
      </div>
      ${start}
    </div>
  </section>`;
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
  const extButtons = [...new Set(changed.map((f) => fileExtension(f.file)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
    .map((ext) => `<button class="ds-scopechip" type="button" data-story-ext="${esc(ext)}">${esc(ext)}</button>`)
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
  return `<div class="ds-storygen-field ds-field-scope">
      <span class="ds-storygen-label">Story files <b id="storyScopeCount">${changed.length}</b></span>
      <div class="ds-storyscope-actions" aria-label="Story file selection shortcuts">
        <button class="ds-scopechip" type="button" data-story-scope-action="all">All</button>
        <button class="ds-scopechip" type="button" data-story-scope-action="source">Source</button>
        <button class="ds-scopechip" type="button" data-story-scope-action="tests">Tests</button>
        <button class="ds-scopechip" type="button" data-story-scope-action="config">Config</button>
        <button class="ds-scopechip" type="button" data-story-scope-action="none">None</button>
        ${extButtons}
      </div>
      <div class="ds-storyfiles">${rows}</div>
    </div>
    <label class="ds-storygen-field ds-field-note">
      <span class="ds-storygen-label">Guidance</span>
      <textarea id="storyReviewerNote" rows="4" placeholder="Tell the agent what to pay extra attention to."></textarea>
    </label>`;
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
            <span class="ds-storygen-eyebrow">Generate a story</span>
            <strong>${model.filesChanged} ${plural(model.filesChanged, 'file')}</strong>
          </div>
          <span class="ds-storygen-stat"><span class="ds-stat-add">+${model.totalAdd}</span><span class="ds-stat-del">−${model.totalDel}</span></span>
        </div>
        <div class="ds-storygen-grid">
          <div class="ds-storygen-field ds-field-agent">
            <span class="ds-storygen-label">Agent</span>
            <input id="storyAgentSel" type="hidden" value="codex" />
            <div class="ds-choicegroup" id="storyAgentChoices" role="radiogroup" aria-label="Agent"></div>
          </div>
          <div class="ds-storygen-field ds-field-model">
            <span class="ds-storygen-label">Model</span>
            <input id="storyModelSel" type="hidden" value="" />
            <div class="ds-choicegroup" id="storyModelChoices" role="radiogroup" aria-label="Model"></div>
          </div>
          <div class="ds-storygen-field ds-field-detail">
            <span class="ds-storygen-label">Detail</span>
            <input id="storyMode" type="hidden" value="guided" />
            <div class="ds-choicegroup" role="radiogroup" aria-label="Story detail">
              <button class="ds-choice" type="button" data-story-choice="storyMode" data-value="brief" aria-pressed="false" title="One short sentence per meaningful change cluster">Brief</button>
              <button class="ds-choice is-active" type="button" data-story-choice="storyMode" data-value="guided" aria-pressed="true" title="Enough context to review the change in order">Balanced</button>
              <button class="ds-choice" type="button" data-story-choice="storyMode" data-value="detailed" aria-pressed="false" title="Walk important ranges line by line">Line-by-line</button>
            </div>
          </div>
          ${storyScopeControls(model.files)}
        </div>
        <button class="ds-intro-start ds-storygen-button" data-generate-story data-review-url="${esc(
          routeBase,
        )}/review?story=story.json"${dataBase}${dataHead}>
          <span class="ds-intro-start-main">Generate story <span class="ds-intro-arrow">→</span></span>
          <span class="ds-intro-start-sub">The agent writes the walkthrough for this diff scope</span>
        </button>
        <p class="ds-storygen-warn" id="storySkillWarn" hidden><span id="storySkillWarnText"></span><button class="ds-storygen-fix" id="storySkillUpdateBtn" type="button">Update skills</button></p>
      </div>
    </div>
  </section>`;
}

function trustRailCard(trust: TrustView): string {
  // When everything's explained the header pill already says so — don't spend
  // sidebar space on a redundant "all clear" card.
  if (!trust.uncovered.length) return '';
  const n = trust.uncovered.length;
  return `<button class="ds-trustcard" data-trust-open>
    <span class="ds-trustcard-ico">▲</span>
    <span class="ds-trustcard-body">
      <span class="ds-trustcard-title">Trust check</span>
      <span class="ds-trustcard-sub">${n} ${plural(n, 'change')} in this diff ${
    n === 1 ? "isn't" : "aren't"
  } explained by any step.</span>
    </span>
  </button>`;
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
      <span class="ds-filetree-caret" aria-hidden="true">›</span>
      <span class="ds-filetree-folder" aria-hidden="true"></span>
      <span class="ds-filetree-name">${esc(dir.name)}</span>
      <span class="ds-filetree-count">${dir.count} ${plural(dir.count, 'file')}</span>
      ${flag}
      <span class="ds-filetree-stat">${stat}</span>
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
  return `<button class="ds-fileitem${f.untoured ? ' is-untoured' : ''}" data-file-index="${i}" data-goto-file="${esc(
    f.file,
  )}" data-filter-path="${esc(f.file.toLowerCase())}" data-filter-status="${f.status}" data-filter-test="${
    isTest ? '1' : '0'
  }" data-filter-comments="${meta.comments.has(f.file) ? '1' : '0'}" data-filter-unexplained="${
    f.untoured ? '1' : '0'
  }" data-filter-since="${meta.since.has(f.file) ? '1' : '0'}" style="--tree-indent:${
    depth * 14
  }px" title="${esc(f.file)} — ${esc(f.kindLabel)}">
    <span class="ds-fileitem-dot k-${kindClass}"></span>
    <span class="ds-fileitem-path"><span class="ds-fileitem-base">${esc(base || dir)}</span></span>
    ${flag}
    <span class="ds-fileitem-viewed" aria-hidden="true">✓</span>
    <span class="ds-fileitem-stat">${stat}</span>
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

function stepPanel(
  repo: string,
  s: StepView,
  i: number,
  total: number,
  comments: Comment[],
): string {
  const editor = vscodeLink(repo, s.file, 1);
  const nextDisabled = i === total - 1 ? ' disabled' : '';
  // Call-flow lives here now (not on every rail card). Only show the meaningful
  // cross-references — "Standalone"/"Final step" carry no navigation cue.
  const flow = /^(Calls|Returns)/.test(s.flow)
    ? `<span class="ds-flowchip" title="Call flow — where this step leads in the walkthrough"><span class="ds-flowico">↳</span>${esc(
        s.flow,
      )}</span>`
    : '';
  return `<section class="ds-step" data-step-panel="${i + 1}" data-step-id="${esc(s.id)}" hidden>
    <div class="ds-step-top">
      <div class="ds-step-meta">
        <span class="ds-step-count">Step ${s.order} of ${total}</span>
        <span class="ds-dot"></span>
        <span class="ds-badge ds-badge-${s.kind === 'new-file' ? 'new' : s.kind}">${esc(s.kindLabel)}</span>
        ${flow}
        <span class="ds-flex"></span>
        <span class="ds-step-pos">${s.order} / ${total}</span>
        <span class="ds-nav">
          <button class="ds-iconbtn" data-prev title="Previous">←</button>
          <button class="ds-iconbtn" data-next title="Next step"${nextDisabled}>→</button>
        </span>
      </div>
      <div class="ds-step-titlerow">
        <h1 class="ds-step-title">${esc(s.title)}</h1>
        <a class="ds-step-file" href="${editor}" title="Open ${esc(s.file)} in your editor">${esc(
          s.file,
        )}</a>
      </div>
    </div>
    <div class="ds-why">
      <div class="ds-why-head"><span class="ds-why-ico"></span><span class="ds-why-label">Story</span><span class="ds-flex"></span><details class="ds-story-tune"><summary title="Tune this story step" aria-label="Tune this story step">•••</summary><div><button type="button" data-story-repair="shorten" data-story-step="${esc(
        s.id,
      )}" data-story-file="${esc(s.file)}">Make shorter</button><button type="button" data-story-repair="split" data-story-step="${esc(
        s.id,
      )}" data-story-file="${esc(s.file)}">Split this step</button></div></details><button class="ds-playstep" data-playstep title="Read this step aloud">▸</button></div>
      ${stepStoryHtml(s)}
    </div>
    <div class="ds-diffscroll">
      <div class="ds-diff" data-diff data-file="${esc(s.file)}"${s.newFile ? ' data-newfile="1"' : ''}>
        <div class="ds-difftoolbar">
          <span class="ds-difthint" data-difthint>Showing storyteller-selected viewport</span>
          <span class="ds-flex"></span>
          ${changeJumpControls()}
          <div class="ds-modetoggle">
            <button class="is-active" data-mode="diff">Diff</button>
            <button data-mode="full">Full file</button>
          </div>
        </div>
        <div data-diff-inner>${diffInner(s, comments)}</div>
        <div data-full-inner hidden></div>
      </div>
    </div>
  </section>`;
}

function stepStoryHtml(s: StepView): string {
  if (!s.beats.length) return `<p class="ds-why-text">${nl(esc(s.why))}</p>`;
  return `<div class="ds-beats">${s.beats.map(beatHtml).join('')}</div>`;
}

function beatHtml(beat: StepView['beats'][number]): string {
  return `<p class="ds-beat" data-speech-beat="${beat.focusGroup}" data-focus-group="${beat.focusGroup}" data-speech-text="${esc(
    beat.text,
  )}"><span class="ds-beat-index">${beat.focusGroup + 1}</span><span class="ds-beat-text">${nl(esc(beat.text))}</span></p>`;
}

function diffInner(s: StepView, comments: Comment[]): string {
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

function diffHead(s: StepView): string {
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

function sbsRow(row: SbsRow, s: StepView, comments: Comment[], blockIndex: number, intra?: Map<SbsRow, IntraSides>): string {
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

function rowVoiceFocusIndex(row: SbsRow, s: StepView, blockIndex: number): number | null {
  const idx = s.focusGroups.findIndex((ranges) => ranges.some((range) => rowInFocusRange(row, s, range)));
  if (idx >= 0) {
    return s.focusExplicit ? idx : blockIndex;
  }
  return !s.focusExplicit && row.type === 'del' && s.kind === 'changed' ? blockIndex : null;
}

function rowInFocusRange(row: SbsRow, s: StepView, [start, end]: [number, number]): boolean {
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
  const selectionLabel = commentSide(c) === 'left' ? 'Selected old side' : 'Selected new side';
  const selection = c.selectedText
    ? `<div class="ds-comment-selection"><span>${selectionLabel}</span><code>${esc(c.selectedText)}</code></div>`
    : '';
  return `<div class="ds-comment status-${c.status}" data-comment-id="${esc(c.id)}" data-status="${
    c.status
  }" data-comment-file="${esc(c.file)}" data-comment-line="${c.line}" data-comment-step="${esc(
    c.step ?? '',
  )}"${hasReply ? ' data-hasreply="1"' : ''}>
    <div class="ds-comment-card flavor-${type}">
      <div class="ds-comment-head">
        <span class="ds-flavor-ico">${FLAVOR_ICON[type]}</span>
        <span class="ds-flavor-label">${FLAVOR_LABEL[type]}</span>
        <span class="ds-dot"></span>
        <span class="ds-comment-author">${esc(authorOf(c))}</span>
        <span class="ds-flex"></span>
        <span class="ds-statusbadge"><span class="ds-dot"></span>${STATUS_LABEL[c.status]}</span>
      </div>
      ${selection}
      <div class="ds-comment-body ds-md">${renderMarkdown(c.body)}</div>
      ${turnsHtml}
      <div class="ds-comment-actions">
        <button class="ds-ghost" data-resolve>${resolved ? 'Reopen' : 'Resolve'}</button>
        <button class="ds-ghost ds-del" data-delete>Delete</button>
      </div>
      <div class="ds-thread-composer">
        <textarea class="ds-thread-ta" data-thread-ta placeholder="Reply to ${esc(APP_BRAND)}…" rows="1"></textarea>
        <button class="ds-ghost ds-thread-add" data-thread-add title="Save without sending to the agent">Add</button>
        <button class="ds-btn ds-btn-solid ds-thread-send" data-thread-send>Ask now</button>
      </div>
    </div>
  </div>`;
}

function authorOf(_c: Comment): string {
  return 'You';
}

// ---- all files ----

function filePanel(f: FileView, i: number, stepIndexById: Map<string, number>): string {
  const [dir, base] = splitPath(f.file);
  const stepIdx = f.stepId !== undefined ? stepIndexById.get(f.stepId) : undefined;
  const stepChip =
    stepIdx !== undefined && f.stepOrder !== undefined
      ? `<button class="ds-stepchip" data-goto-step="${stepIdx}" title="Open this file in the story">Step ${f.stepOrder}</button>`
      : '';
  const untouredBadge = f.untoured
    ? `<span class="ds-untoured-badge"><span class="ds-tri">▲</span>${f.untoured} unexplained</span>`
    : '';
  const stat =
    f.add || f.del
      ? `${f.add ? `<span class="ds-stat-add">+${f.add}</span>` : ''}${
          f.del ? `<span class="ds-stat-del">−${f.del}</span>` : ''
        }`
      : '<span class="ds-dim">unchanged</span>';
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
  // The All-files pane is a master/detail viewer: one file at a time (driven by
  // the sidebar list), defaulting to the complete-file view. The full file and
  // the split view are lazy-loaded when their toggle is first activated.
  const toggle = f.hasFull
    ? `<div class="ds-modetoggle"><button data-mode="diff">Unified</button><button data-mode="split">Split</button><button class="is-active" data-mode="full">Full file</button></div>`
    : f.hunks.length
      ? `<div class="ds-modetoggle"><button class="is-active" data-mode="diff">Unified</button><button data-mode="split">Split</button></div>`
      : '';
  return `<section class="ds-filepanel${f.untoured ? ' is-untoured' : ''}" data-file-panel="${i}" data-file="${esc(
    f.file,
  )}"${f.kind === 'new' ? ' data-newfile="1"' : ''}${i === 0 ? '' : ' hidden'}>
    <div class="ds-filepanel-head">
      <span class="ds-cardpath"><span class="ds-dim">${esc(dir)}</span><span class="ds-cardpath-base">${esc(
        base,
      )}</span></span>
      <span class="ds-badge ds-badge-${f.kind === 'new' ? 'new' : f.kind}">${esc(f.kindLabel)}</span>
      ${untouredBadge}
      ${stepChip}
      <span class="ds-flex"></span>
      <span class="ds-cardstat">${stat}</span>
      ${changeJumpControls()}
      <button type="button" class="ds-viewed-toggle" data-viewed-toggle aria-pressed="false" aria-label="Mark ${esc(
        f.file,
      )} viewed" title="Mark viewed (V)"><span class="ds-viewed-toggle-icon" aria-hidden="true">✓</span><span class="ds-viewed-toggle-label" data-viewed-label>Mark viewed</span></button>
      ${toggle}
    </div>
    <div class="ds-filepanel-body">
      <div data-diff-inner${f.hasFull ? ' hidden' : ''}><div class="ds-diffbody ds-diffbody-unified">${unified}</div></div>
      <div data-split-inner hidden></div>
      <div data-full-inner${f.hasFull ? '' : ' hidden'}></div>
    </div>
  </section>`;
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
  return `<article class="ds-feedback-card status-${c.status}" data-feedback-card data-feedback-status="${c.status}" data-feedback-anchor="${anchor}" data-comment-id="${esc(
    c.id,
  )}" data-comment-file="${esc(c.file)}" data-comment-line="${c.line}" data-comment-step="${esc(c.step ?? '')}">
    <div class="ds-feedback-head">
      <span class="ds-flavor-ico">${FLAVOR_ICON[c.type] ?? FLAVOR_ICON.change}</span>
      <span class="ds-feedback-path">${esc(c.file)}<span class="ds-dim">:${c.line}</span></span>
      <span class="ds-flex"></span>
      <span class="ds-anchorbadge is-${anchor}">${anchorLabel(anchor)}</span>
    </div>
    ${c.selectedText ? `<code class="ds-feedback-selection">${esc(c.selectedText)}</code>` : ''}
    <div class="ds-feedback-message ds-md">${renderMarkdown(c.body)}</div>
    ${latestAgent ? `<div class="ds-feedback-reply ds-md"><span>${esc(APP_BRAND)}</span>${renderMarkdown(latestAgent.text)}</div>` : ''}
    <div class="ds-feedback-actions">
      <button type="button" class="ds-ghost" data-goto-comment="${esc(c.id)}">Show in diff</button>
      ${verify ? `<button type="button" class="ds-ghost" data-reopen-comment="${esc(c.id)}">Reopen</button><button type="button" class="ds-btn ds-btn-solid" data-accept-fix="${esc(c.id)}">Accept fix</button>` : ''}
      ${c.status === 'resolved' ? `<button type="button" class="ds-ghost" data-reopen-comment="${esc(c.id)}">Reopen</button>` : ''}
    </div>
  </article>`;
}

function feedbackDrawer(
  repo: string,
  headRef: string | undefined,
  comments: Comment[],
  state: ReviewStateSummary,
): string {
  const addressed = comments.filter((comment) => comment.status === 'addressed').length;
  const cards = comments.length
    ? comments.map((comment) => feedbackCard(repo, headRef, comment)).join('')
    : '<div class="ds-drawer-empty">No review feedback yet.</div>';
  const events = state.events.length
    ? state.events
        .map(
          (event) => `<li class="ds-timeline-event"><span class="ds-timeline-dot kind-${event.kind}"></span><div><strong>${esc(
            event.label,
          )}</strong>${event.detail ? `<span>${esc(event.detail)}</span>` : ''}<small>Round ${event.round} · ${esc(
            relativeTime(event.at),
          )}</small></div></li>`,
        )
        .join('')
    : '<li class="ds-drawer-empty">The timeline starts when this review is opened.</li>';
  return `<div class="ds-drawer-root" id="ds-feedback-drawer" hidden>
    <div class="ds-drawer-scrim" data-feedback-close></div>
    <div class="ds-drawer ds-feedback-drawer" role="dialog" aria-label="Review feedback and timeline">
      <div class="ds-drawer-head">
        <div><div class="ds-drawer-title">Review loop</div><div class="ds-drawer-sub">Verify what changed, reopen anything unresolved, and keep the rounds honest.</div></div>
        <button class="ds-drawer-x" data-feedback-close title="Close">×</button>
      </div>
      <div class="ds-drawer-tabs" role="tablist">
        <button class="is-active" data-feedback-panel="feedback" role="tab">Feedback${addressed ? ` <span>${addressed}</span>` : ''}</button>
        <button data-feedback-panel="timeline" role="tab">Timeline</button>
      </div>
      <div class="ds-feedback-filters" data-feedback-tools>
        <button class="is-active" data-feedback-filter="all">All</button>
        <button data-feedback-filter="addressed">Needs verification</button>
        <button data-feedback-filter="open">Open</button>
        <button data-feedback-filter="changed">Code changed</button>
        <button data-feedback-filter="resolved">Resolved</button>
      </div>
      <div class="ds-drawer-body ds-feedback-list" data-feedback-view="feedback">${cards}</div>
      <div class="ds-drawer-body" data-feedback-view="timeline" hidden><ol class="ds-review-timeline">${events}</ol></div>
    </div>
  </div>`;
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

function commandPalette(): string {
  const commands = [
    ['story', 'Open Story', 'J / K', 'Move through the guided walkthrough'],
    ['files', 'Open All files', '/', 'Search and filter the changed files'],
    ['feedback', 'Review feedback', '', 'Verify agent replies and reopen comments'],
    ['timeline', 'Open review timeline', '', 'See rounds, comments, and agent runs'],
    ['next-unviewed', 'Next unviewed file', '', 'Keep the review moving'],
    ['toggle-viewed', 'Toggle current file viewed', 'V', 'Track what you have already checked'],
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

function trustDrawer(trust: TrustView, stepIndexById: Map<string, number>): string {
  const clean = !trust.uncovered.length;
  const cards = trust.uncovered.map((u) => trustCard(u, stepIndexById)).join('');
  const body = clean
    ? `<div class="ds-trust-clean">✓ Every change in the diff is explained by a step. Nothing was slipped in quietly.</div>`
    : `<div class="ds-trust-section">Unexplained ${plural(trust.uncovered.length, 'change')}</div>${cards}`;
  return `<div class="ds-drawer-root" id="ds-trust-drawer" hidden>
    <div class="ds-drawer-scrim" data-trust-close></div>
    <div class="ds-drawer" role="dialog" aria-label="Trust check">
      <div class="ds-drawer-head">
        <div>
          <div class="ds-drawer-title">Trust check</div>
          <div class="ds-drawer-sub">Every line in the diff, accounted for against the story.</div>
        </div>
        <button class="ds-drawer-x" data-trust-close title="Close">×</button>
      </div>
      <div class="ds-drawer-body">
        <div class="ds-trust-stats">
          <div class="ds-trust-stat ok"><div class="ds-trust-num">${trust.coveredLines}</div><div class="ds-trust-lbl">changed ${plural(
            trust.coveredLines,
            'line',
          )} covered by a step</div></div>
          <div class="ds-trust-stat warn"><div class="ds-trust-num">${trust.uncoveredLines}</div><div class="ds-trust-lbl">${plural(
            trust.uncoveredLines,
            'change',
          )} no step explains</div></div>
        </div>
        ${body}
        <div class="ds-trust-foot">When every change is explained, this panel turns green — nothing was slipped in quietly.</div>
      </div>
    </div>
  </div>`;
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
