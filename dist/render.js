// Turn a validated tour + the parsed diff into a single self-contained HTML page —
// the diffStory review screen. All code content is escaped here, server-side; the
// client JS only ever sets textContent or injects this server-escaped HTML, so
// there is no HTML-injection sink.
import { join } from 'node:path';
import { PAGE_CSS, PAGE_JS } from './page-assets.js';
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from './progress-ui.js';
import { APP_BRAND } from './config.js';
import { BRAND_HEAD_LINKS, brandMarkSvg, brandStoryMarkSvg } from './brand.js';
import { kokoroVoiceOptions } from './kokoro-tts.js';
import { buildReviewModel } from './view-model.js';
import { highlight } from './highlight.js';
import { intraLineMap } from './intra-line.js';
import { normalizeComment } from './comments.js';
const FLAVOR_LABEL = {
    change: 'Change request',
    question: 'Question',
    nit: 'Nit',
};
const FLAVOR_ICON = { change: '◆', question: '?', nit: '○' };
const STATUS_LABEL = {
    open: 'Open',
    addressed: 'Addressed',
    resolved: 'Resolved',
};
function commentSide(c) {
    return c.side === 'left' ? 'left' : 'right';
}
function targetAttrs(target) {
    return target
        ? ` data-comment-code="1" data-comment-side="${target.side}" data-comment-file="${esc(target.file)}" data-comment-line="${target.line}"`
        : '';
}
function rowAttrs(target, step) {
    return target
        ? ` data-file="${esc(target.file)}" data-line="${target.line}" data-side="${target.side}"${step ? ` data-step="${esc(step)}"` : ''}`
        : '';
}
function threadForTargets(targets, comments) {
    const here = comments.filter((c) => targets.some((t) => t && commentSide(c) === t.side && c.file === t.file && c.line === t.line));
    if (!here.length)
        return '';
    return `<div class="ds-thread">${here.map(commentHtml).join('')}</div>`;
}
export function renderPage(input) {
    const { repo, tour, files, baseLabel, comments, headRef } = input;
    const routeBase = input.routeBase ?? '';
    const repoName = input.repoName ?? (() => {
        try {
            return decodeURIComponent(routeBase.split('/').filter(Boolean).pop() ?? 'repo');
        }
        catch {
            return 'repo';
        }
    })();
    const storyless = input.storyless ?? false;
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
        : `<button class="ds-trustpill${uncoveredCount ? '' : ' is-clean'}" data-trust-open title="Trust check — changes in the diff that no story step explains">${uncoveredCount
            ? `<span class="ds-tri">▲</span><b>${uncoveredCount}</b> unexplained`
            : `<span class="ds-check">✓</span> all changes explained`}</button>`;
    const railCards = model.steps.map((s, i) => railCard(s, i)).join('');
    const railFiles = railFileTree(model.files);
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
<body${storyless ? ' data-storyless="1"' : ''}>
<header class="ds-top">
  <a class="ds-brand" href="/repos" title="Home — your repositories" aria-label="Home — your repositories">
    ${BRAND_MARK}
    <span class="ds-word"><span class="ds-word-a">diff</span><span class="ds-word-b">Story</span></span>
  </a>
  <button class="ds-sidebar-toggle" data-sidebar-toggle aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar">
    <span class="ds-sidebar-toggle-ico">☰</span>
  </button>
  <div class="ds-vsep"></div>
  <a class="ds-back" data-close-story href="${esc(routeBase)}/stories" title="Close this story — back to ${esc(repoName)}'s saved stories" aria-label="Close story, back to saved stories">
    <span class="ds-back-ico" aria-hidden="true">‹</span> Stories
  </a>
  <div class="ds-titlewrap">
    <div class="ds-titlebar">
      <a class="ds-crumb-repo" href="${esc(routeBase)}/stories" title="${esc(repoName)} — saved stories">${esc(repoName)}</a>
      <span class="ds-kicker"><span class="ds-dim">·</span> Reviewing <span class="ds-dim">vs</span> <span class="ds-change" title="Diffing the working tree against ${esc(baseLabel)}">${esc(baseLabel)}</span></span>
    </div>
    <div class="ds-title" title="${esc(storyless ? 'The current diff, file by file' : tour.summary || tour.title)}">${esc(pageTitle)}</div>
  </div>
  <div class="ds-status">
    <span class="ds-open" id="ds-open-count" title="Review comments still awaiting a reply or resolution"><span class="ds-dot ds-dot-amber"></span><b>${openCount}</b> ${plural(openCount, 'comment')}</span>
    ${trustPill}
  </div>
  <div class="ds-settings-wrap">
    <button class="ds-readaloud" data-readaloud title="Read each step's story aloud as you walk the change" aria-pressed="false"><span class="ds-readaloud-ico">▶</span><span data-readaloud-label>Read aloud</span></button>
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
  <div class="ds-vsep"></div>
  <div class="ds-actions">
    ${storyless
        ? `<button class="ds-review-menu ds-reload-diff" data-reload-diff type="button" title="Re-read the working tree and refresh this diff">
        <span class="ds-review-menu-dot" aria-hidden="true"></span>
        <span>Reload diff</span>
      </button>`
        : ''}
    <div class="ds-review-menu-wrap">
      <button class="ds-review-menu" data-review-menu aria-haspopup="menu" aria-expanded="false" title="Open review actions">
        <span class="ds-review-menu-dot" aria-hidden="true"></span>
        <span>Review actions</span>
        <span class="ds-review-menu-caret" aria-hidden="true">⌄</span>
      </button>
      <div class="ds-review-menu-pop" data-review-menu-pop role="menu" hidden>
        <div class="ds-review-menu-title">Review actions</div>
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
        <button class="ds-review-option" data-verdict="request" role="menuitem">
          <span class="ds-review-option-title">Ask for fixes</span>
          <span class="ds-review-option-desc">Use this when the change is not ready to merge.</span>
        </button>
        <button class="ds-review-option ds-review-option-approve" data-verdict="approve" role="menuitem"${approveReady ? '' : ' disabled'} title="${approveReady
        ? 'Everything is covered and there are no open comments'
        : 'Resolve open comments and make sure every change is explained first'}">
          <span class="ds-review-option-title"><span class="ds-check">✓</span> Mark approved</span>
          <span class="ds-review-option-desc">Available when comments are resolved and the story covers the diff.</span>
        </button>
      </div>
    </div>
  </div>
</header>

<div id="ds-agentpanel">${progressPanelMarkup('floating')}</div>

<div class="ds-layout">
  <aside class="ds-rail">
    <div class="ds-railpad">
      <div class="ds-viewtoggle" role="tablist">
        <button class="ds-tab is-active" data-view="tour" role="tab">Story</button>
        <button class="ds-tab" data-view="files" role="tab">All files</button>
      </div>
    </div>
    ${introCard(model)}
    <div class="ds-readhead" data-rail="tour">
      <div class="ds-readhead-row">
        <span class="ds-readhead-label">Reading order</span>
        <span class="ds-readhead-count" id="ds-progress-text">${storyless ? 'No story yet' : `${model.totalSteps} ${plural(model.totalSteps, 'step')}`}</span>
      </div>
      <div class="ds-readhead-track"><div class="ds-readhead-fill" id="ds-progress-fill" style="width:0%"></div></div>
    </div>
    <div class="ds-readhead" data-rail="files" hidden>
      <div class="ds-readhead-row">
        <span class="ds-readhead-label">Files</span>
        <span class="ds-readhead-count">${model.files.length} ${plural(model.files.length, 'file')}</span>
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

  <main class="ds-main">
    <div class="ds-view" id="ds-view-tour">
      ${storyless ? generateCta(model, routeBase, tour.base, headRef) : introPanel(model, tour)}
      ${storyless ? '' : stepPanels}
    </div>
    <div class="ds-view" id="ds-view-files" hidden>
      <div class="ds-fileshead">
        <div class="ds-fileshead-l">
          <h1 class="ds-fileshead-title">All files in this change</h1>
          <div class="ds-fileshead-stats">
            <span>${model.filesChanged} changed${model.contextFiles ? ` · ${model.contextFiles} context` : ''}</span>
            <span class="ds-dot"></span>
            <span class="ds-stat-add">+${model.totalAdd}</span>
            <span class="ds-stat-del">−${model.totalDel}</span>
            ${uncoveredCount
        ? `<span class="ds-dot"></span><span class="ds-stat-untoured"><span class="ds-dot ds-dot-amber"></span>${uncoveredCount} unexplained</span>`
        : ''}
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
<div class="ds-selection-menu" data-selection-menu role="menu" hidden>
  <button type="button" role="menuitem" data-selection-action="question">Ask</button>
  <button type="button" role="menuitem" data-selection-action="change">Ask for change</button>
  <button type="button" role="menuitem" data-selection-action="nit">Nit</button>
</div>
<div class="ds-toast" id="ds-toast" hidden></div>
<noscript><div class="ds-empty">diffStory needs JavaScript to drive the review.</div></noscript>
<script>${progressPanelScript()}</script>
<script>${PAGE_JS}</script>
</body>
</html>`;
}
// ---- sidebar ----
function voiceCard(kind, id, label, description, active = false) {
    const badge = label.slice(0, 1).toUpperCase();
    return `<button class="ds-voice-card${active ? ' is-active' : ''}" data-${kind}-voice="${esc(id)}">
          <span class="ds-voice-badge">${esc(badge)}</span>
          <span><span class="ds-voice-name">${esc(label)} <span class="ds-voice-check">✓</span></span><span class="ds-voice-desc">${esc(description)}</span></span>
        </button>`;
}
// The Overview sits above the numbered steps as navigation index 0 — the calm
// entry point that answers "what is this change?" before the walkthrough begins.
function introCard(model) {
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
function railCard(s, i) {
    const base = splitPath(s.file)[1];
    const badge = s.kind === 'changed'
        ? ''
        : `<span class="ds-railbadge ds-badge-${s.kind === 'new-file' ? 'new' : 'context'}">${esc(s.kindLabel)}</span>`;
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
function introPanel(model, tour) {
    const n = model.totalSteps;
    const trust = model.trust.uncovered.length;
    const first = model.steps[0];
    const summary = tour.summary && tour.summary.trim()
        ? nl(esc(tour.summary.trim()))
        : 'Each step builds on the one before it — read them in order, or jump to any file from the list.';
    const filesLabel = `${plural(model.filesChanged, 'file')} changed${model.contextFiles ? ` · ${model.contextFiles} for context` : ''}`;
    const trustFact = trust
        ? `<div class="ds-fact ds-fact-warn"><span class="ds-fact-n">▲ ${trust}</span><span class="ds-fact-l">unexplained ${plural(trust, 'change')}</span></div>`
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
      <p class="ds-intro-lede">${summary}</p>
      <div class="ds-intro-facts">
        <div class="ds-fact"><span class="ds-fact-n">${n}</span><span class="ds-fact-l">${plural(n, 'step')} to read in order</span></div>
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
function generateCta(model, routeBase, baseRef, headRef) {
    const filesLabel = `${plural(model.filesChanged, 'file')} changed${model.contextFiles ? ` · ${model.contextFiles} for context` : ''}`;
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
        </div>
        <button class="ds-intro-start ds-storygen-button" data-generate-story data-review-url="${esc(routeBase)}/review?story=story.json"${dataBase}${dataHead}>
          <span class="ds-intro-start-main">Generate story <span class="ds-intro-arrow">→</span></span>
          <span class="ds-intro-start-sub">The agent writes the walkthrough for this diff scope</span>
        </button>
        <p class="ds-storygen-warn" id="storySkillWarn" hidden><span id="storySkillWarnText"></span><button class="ds-storygen-fix" id="storySkillUpdateBtn" type="button">Update skills</button></p>
      </div>
    </div>
  </section>`;
}
function trustRailCard(trust) {
    // When everything's explained the header pill already says so — don't spend
    // sidebar space on a redundant "all clear" card.
    if (!trust.uncovered.length)
        return '';
    const n = trust.uncovered.length;
    return `<button class="ds-trustcard" data-trust-open>
    <span class="ds-trustcard-ico">▲</span>
    <span class="ds-trustcard-body">
      <span class="ds-trustcard-title">Trust check</span>
      <span class="ds-trustcard-sub">${n} ${plural(n, 'change')} in this diff ${n === 1 ? "isn't" : "aren't"} explained by any step.</span>
    </span>
  </button>`;
}
function railFileTree(files) {
    if (!files.length)
        return '';
    const root = createFileTreeDir('', '');
    files.forEach((file, index) => addFileTreeEntry(root, file, index));
    return `<div class="ds-filetree" role="tree">${renderFileTreeChildren(root.children, 0)}</div>`;
}
function createFileTreeDir(name, path) {
    return { kind: 'dir', name, path, children: [], dirs: new Map(), count: 0, add: 0, del: 0, untoured: 0 };
}
function addFileTreeEntry(root, file, index) {
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
function addFileTreeStats(node, file) {
    node.count += 1;
    node.add += file.add;
    node.del += file.del;
    node.untoured += file.untoured;
}
function renderFileTreeChildren(children, depth) {
    return children
        .map((child) => (child.kind === 'dir' ? renderFileTreeDir(child, depth) : railFileItem(child.file, child.index, depth)))
        .join('');
}
function renderFileTreeDir(dir, depth) {
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
    <div class="ds-filetree-children" role="group">${renderFileTreeChildren(dir.children, depth + 1)}</div>
  </details>`;
}
function railFileItem(f, i, depth = 0) {
    const [dir, base] = splitPath(f.file);
    const kindClass = f.kind === 'new' ? 'new' : f.kind;
    const stat = railFileStat(f.add, f.del);
    const flag = f.untoured
        ? `<span class="ds-fileitem-flag" title="${f.untoured} unexplained ${plural(f.untoured, 'change')}">▲</span>`
        : '';
    return `<button class="ds-fileitem${f.untoured ? ' is-untoured' : ''}" data-file-index="${i}" data-goto-file="${esc(f.file)}" style="--tree-indent:${depth * 14}px" role="treeitem" title="${esc(f.file)} — ${esc(f.kindLabel)}">
    <span class="ds-fileitem-dot k-${kindClass}"></span>
    <span class="ds-fileitem-path"><span class="ds-fileitem-base">${esc(base || dir)}</span></span>
    ${flag}
    <span class="ds-fileitem-stat">${stat}</span>
  </button>`;
}
function railFileStat(add, del) {
    if (!add && !del)
        return '<span class="ds-dim">·</span>';
    return `${add ? `<span class="ds-stat-add">+${add}</span>` : ''}${del ? `<span class="ds-stat-del">−${del}</span>` : ''}`;
}
function changeJumpControls() {
    return `<div class="ds-changejump" data-change-nav hidden>
    <button class="ds-changebtn" data-change-prev title="Previous change (← / P)" aria-label="Previous change">←</button>
    <span class="ds-changecount" data-change-count>0 / 0</span>
    <button class="ds-changebtn" data-change-next title="Next change (→ / N)" aria-label="Next change">→</button>
  </div>`;
}
// ---- story tour ----
function stepPanel(repo, s, i, total, comments) {
    const editor = vscodeLink(repo, s.file, 1);
    const nextDisabled = i === total - 1 ? ' disabled' : '';
    // Call-flow lives here now (not on every rail card). Only show the meaningful
    // cross-references — "Standalone"/"Final step" carry no navigation cue.
    const flow = /^(Calls|Returns)/.test(s.flow)
        ? `<span class="ds-flowchip" title="Call flow — where this step leads in the walkthrough"><span class="ds-flowico">↳</span>${esc(s.flow)}</span>`
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
        <a class="ds-step-file" href="${editor}" title="Open ${esc(s.file)} in your editor">${esc(s.file)}</a>
      </div>
    </div>
    <div class="ds-why">
      <div class="ds-why-head"><span class="ds-why-ico"></span><span class="ds-why-label">Story</span><button class="ds-playstep" data-playstep title="Read this step aloud">▸</button></div>
      <p class="ds-why-text">${nl(esc(s.why))}</p>
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
function diffInner(s, comments) {
    if (!s.blocks.length || !s.blocks.some((b) => b.length)) {
        return `<div class="ds-diffnote">${esc(s.note ?? 'Nothing to show for this step.')}</div>`;
    }
    const head = diffHead(s);
    const body = s.blocks
        .map((block, bi) => {
        const intra = intraLineMap(block, (r) => r.type, (r) => r.content);
        return ((bi > 0 ? `<div class="ds-hunkgap"><span>⋯</span></div>` : '') +
            block.map((row) => sbsRow(row, s, comments, bi, intra)).join(''));
    })
        .join('');
    const note = s.note && s.blocks.some((b) => b.length)
        ? `<div class="ds-diffnote ds-diffnote-soft">${esc(s.note)}</div>`
        : '';
    return `${head}${note}<div class="ds-diffbody">${body}</div>`;
}
function diffHead(s) {
    if (s.context) {
        return `<div class="ds-diffhead ds-diffhead-ctx">
      <span class="ds-diffhead-side"><span class="ds-diffhead-label">Context</span><span class="ds-diffhead-path">${esc(s.file)}</span></span>
      <span class="ds-diffhead-note">unchanged — shown so the change makes sense</span>
    </div>`;
    }
    if (s.newFile) {
        return `<div class="ds-diffhead ds-diffhead-ctx">
      <span class="ds-diffhead-side"><span class="ds-diffhead-label ds-green">New file</span><span class="ds-diffhead-path">${esc(s.file)}</span></span>
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
function sbsRow(row, s, comments, blockIndex, intra) {
    const leftTarget = !s.context && !s.newFile && row.oldNo !== undefined
        ? { side: 'left', file: s.oldFile, line: row.oldNo }
        : undefined;
    const rightTarget = row.newNo !== undefined ? { side: 'right', file: s.file, line: row.newNo } : undefined;
    const primaryTarget = rightTarget ?? leftTarget;
    const attrs = rowAttrs(primaryTarget, primaryTarget ? s.id : undefined);
    const focusIndex = rowVoiceFocusIndex(row, s, blockIndex);
    const focusAttr = focusIndex === null ? '' : ` data-step-focus="${focusIndex}"`;
    const sides = intra?.get(row);
    const cells = s.context || s.newFile
        ? singleCell(row, rightTarget)
        : `${cell('left', row, leftTarget, sides?.left)}<span class="ds-celldiv"></span>${cell('right', row, rightTarget, sides?.right)}`;
    const rowHtml = `<div class="ds-row ds-row-${row.type}"${attrs}${focusAttr}>${cells}</div>`;
    const thread = threadForTargets([leftTarget, rightTarget], comments);
    return rowHtml + thread;
}
function rowVoiceFocusIndex(row, s, blockIndex) {
    if (row.newNo !== undefined) {
        const n = row.newNo;
        const idx = s.focusRanges.findIndex(([start, end]) => n >= start && n <= end);
        return idx >= 0 ? (s.focusExplicit ? idx : blockIndex) : null;
    }
    return !s.focusExplicit && row.type === 'del' && s.kind === 'changed' ? blockIndex : null;
}
function cell(side, row, target, intra) {
    const add = row.type === 'add';
    const del = row.type === 'del';
    const sideCls = side === 'left' ? ' ds-cell-l' : ' ds-cell-r';
    // An add has no left counterpart; a del has no right counterpart.
    if ((side === 'left' && add) || (side === 'right' && del)) {
        return `<span class="ds-cell ds-cell-empty${sideCls}"></span>`;
    }
    let no = '';
    let sign = '';
    let signClass = '';
    if (side === 'left') {
        no = row.oldNo !== undefined ? String(row.oldNo) : '';
        if (del) {
            sign = '−';
            signClass = ' ds-sign-del';
        }
    }
    else {
        no = row.newNo !== undefined ? String(row.newNo) : '';
        if (add) {
            sign = '+';
            signClass = ' ds-sign-add';
        }
    }
    let tint = '';
    if (side === 'right' && add)
        tint = row.untoured ? ' ds-cell-untoured' : ' ds-cell-add';
    else if (side === 'left' && del)
        tint = ' ds-cell-del';
    const flag = side === 'right' && add && row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
    return `<span class="ds-cell${tint}${sideCls}"><span class="ds-no">${no}</span><span class="ds-sign${signClass}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${(intra ?? highlight(row.content)) || ' '}</span>${flag}</span>`;
}
function singleCell(row, target) {
    const no = row.newNo ?? row.oldNo ?? '';
    const add = row.type === 'add';
    const sign = add ? '+' : '';
    const signCls = add ? ' ds-sign-add' : '';
    const tint = add ? (row.untoured ? ' ds-cell-untoured' : ' ds-cell-add') : '';
    const flag = add && row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
    return `<span class="ds-cell ds-cell-single${tint}"><span class="ds-no">${no}</span><span class="ds-sign${signCls}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${highlight(row.content) || ' '}</span>${flag}</span>`;
}
function turnHtml(t) {
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
export function commentHtml(c0) {
    const c = normalizeComment(c0);
    const type = ['change', 'question', 'nit'].includes(c.type)
        ? c.type
        : 'change';
    const turns = c.turns ?? [];
    const turnsHtml = turns.map(turnHtml).join('');
    const hasReply = turns.some((t) => t.role === 'ai');
    const resolved = c.status === 'resolved';
    const selectionLabel = commentSide(c) === 'left' ? 'Selected old side' : 'Selected new side';
    const selection = c.selectedText
        ? `<div class="ds-comment-selection"><span>${selectionLabel}</span><code>${esc(c.selectedText)}</code></div>`
        : '';
    return `<div class="ds-comment status-${c.status}" data-comment-id="${esc(c.id)}" data-status="${c.status}"${hasReply ? ' data-hasreply="1"' : ''}>
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
function authorOf(_c) {
    return 'You';
}
// ---- all files ----
function filePanel(f, i, stepIndexById) {
    const [dir, base] = splitPath(f.file);
    const stepIdx = f.stepId !== undefined ? stepIndexById.get(f.stepId) : undefined;
    const stepChip = stepIdx !== undefined && f.stepOrder !== undefined
        ? `<button class="ds-stepchip" data-goto-step="${stepIdx}" title="Open this file in the story">Step ${f.stepOrder}</button>`
        : '';
    const untouredBadge = f.untoured
        ? `<span class="ds-untoured-badge"><span class="ds-tri">▲</span>${f.untoured} unexplained</span>`
        : '';
    const stat = f.add || f.del
        ? `${f.add ? `<span class="ds-stat-add">+${f.add}</span>` : ''}${f.del ? `<span class="ds-stat-del">−${f.del}</span>` : ''}`
        : '<span class="ds-dim">unchanged</span>';
    const unified = f.hunks.length
        ? f.hunks
            .map((hunk, hi) => {
            const intra = intraLineMap(hunk, (r) => r.type, (r) => r.content);
            return ((hi > 0 ? `<div class="ds-hunkgap"><span>⋯</span></div>` : '') +
                hunk.map((r) => unifiedRow(r, f.file, f.oldFile, unifiedIntra(r, intra))).join(''));
        })
            .join('')
        : '<div class="ds-diffnote">No diff to show.</div>';
    // The All-files pane is a master/detail viewer: one file at a time (driven by
    // the sidebar list), defaulting to the complete-file view. The full file is
    // lazy-loaded into [data-full-inner] when the panel is first shown.
    const toggle = f.hasFull
        ? `<div class="ds-modetoggle"><button data-mode="diff">Diff</button><button class="is-active" data-mode="full">Full file</button></div>`
        : '';
    return `<section class="ds-filepanel${f.untoured ? ' is-untoured' : ''}" data-file-panel="${i}" data-file="${esc(f.file)}"${f.kind === 'new' ? ' data-newfile="1"' : ''}${i === 0 ? '' : ' hidden'}>
    <div class="ds-filepanel-head">
      <span class="ds-cardpath"><span class="ds-dim">${esc(dir)}</span><span class="ds-cardpath-base">${esc(base)}</span></span>
      <span class="ds-badge ds-badge-${f.kind === 'new' ? 'new' : f.kind}">${esc(f.kindLabel)}</span>
      ${untouredBadge}
      ${stepChip}
      <span class="ds-flex"></span>
      <span class="ds-cardstat">${stat}</span>
      ${changeJumpControls()}
      ${toggle}
    </div>
    <div class="ds-filepanel-body">
      <div data-diff-inner${f.hasFull ? ' hidden' : ''}><div class="ds-diffbody ds-diffbody-unified">${unified}</div></div>
      <div data-full-inner${f.hasFull ? '' : ' hidden'}></div>
    </div>
  </section>`;
}
function unifiedRow(row, file, oldFile = file, intra) {
    const sign = row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' ';
    const flag = row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
    const target = row.no === undefined
        ? undefined
        : {
            side: row.type === 'del' ? 'left' : 'right',
            file: row.type === 'del' ? oldFile : file,
            line: row.no,
        };
    const attrs = rowAttrs(target);
    return `<div class="ds-urow ds-row-${row.type}${row.untoured ? ' is-untoured' : ''}"${attrs}><span class="ds-no">${row.no ?? ''}</span><span class="ds-sign ds-sign-${row.type}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${(intra ?? highlight(row.content)) || ' '}</span>${flag}</div>`;
}
/** Look up a unified row's precomputed intra-line side (del→left, add→right). */
function unifiedIntra(row, map) {
    const sides = map.get(row);
    return row.type === 'del' ? sides?.left : sides?.right;
}
// ---- trust drawer ----
function trustDrawer(trust, stepIndexById) {
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
          <div class="ds-trust-stat ok"><div class="ds-trust-num">${trust.coveredLines}</div><div class="ds-trust-lbl">changed ${plural(trust.coveredLines, 'line')} covered by a step</div></div>
          <div class="ds-trust-stat warn"><div class="ds-trust-num">${trust.uncoveredLines}</div><div class="ds-trust-lbl">${plural(trust.uncoveredLines, 'change')} no step explains</div></div>
        </div>
        ${body}
        <div class="ds-trust-foot">When every change is explained, this panel turns green — nothing was slipped in quietly.</div>
      </div>
    </div>
  </div>`;
}
function trustCard(u, stepIndexById) {
    const intra = intraLineMap(u.rows, (r) => r.type, (r) => r.content);
    const rows = u.rows.length
        ? u.rows.map((r) => unifiedRow(r, u.file, u.file, unifiedIntra(r, intra))).join('')
        : `<div class="ds-diffnote">${esc(u.file)}:${u.line}</div>`;
    const stepIdx = u.stepId !== undefined ? stepIndexById.get(u.stepId) : undefined;
    const jump = stepIdx !== undefined
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
      <button class="ds-btn ds-btn-ghost" data-explain>Ask ${esc(APP_BRAND)} to explain</button>
    </div>
  </div>`;
}
// ---- full file (used by the lazy /api/fullfile endpoint) ----
export function renderFullFile(rows, opts) {
    if (!rows.length) {
        return `<div class="ds-diffnote">Couldn't read ${esc(opts.file)} from the working tree.</div>`;
    }
    const leftLabel = opts.newFile ? 'Did not exist' : 'Before';
    const rightLabel = opts.newFile ? 'New file' : 'After';
    const head = `<div class="ds-diffhead">
    <span class="ds-diffhead-side ds-diffhead-side-l"><span class="ds-diffhead-label${opts.newFile ? ' ds-dim' : ''}">${leftLabel}</span>${opts.newFile ? '' : `<span class="ds-diffhead-path">${esc(opts.oldFile ?? opts.file)}</span>`}</span>
    <span class="ds-diffhead-divider"></span>
    <span class="ds-diffhead-side ds-diffhead-side-r"><span class="ds-diffhead-label${opts.newFile ? ' ds-green' : ''}">${rightLabel}</span><span class="ds-diffhead-path">${esc(opts.file)}</span></span>
  </div>`;
    const intra = intraLineMap(rows, (r) => r.type, (r) => r.content);
    const body = rows.map((r) => fullRow(r, opts, intra)).join('');
    return `${head}<div class="ds-diffbody">${body}</div>`;
}
function fullRow(row, opts, intra) {
    const leftTarget = !opts.newFile && row.oldNo !== undefined
        ? { side: 'left', file: opts.oldFile ?? opts.file, line: row.oldNo }
        : undefined;
    const rightTarget = row.newNo !== undefined ? { side: 'right', file: opts.file, line: row.newNo } : undefined;
    const primaryTarget = rightTarget ?? leftTarget;
    const sides = intra?.get(row);
    const cells = `${cell('left', row, leftTarget, sides?.left)}<span class="ds-celldiv"></span>${cell('right', row, rightTarget, sides?.right)}`;
    const attrs = rowAttrs(primaryTarget);
    return `<div class="ds-row ds-row-${row.type}"${attrs}>${cells}</div>`;
}
// ---- shared bits ----
const BRAND_MARK = brandMarkSvg('ds-mark', 24, 24);
// The brand mark in miniature, in currentColor so it tints with state.
const STORY_MARK = brandStoryMarkSvg('ds-storymark', 18, 18);
function splitPath(p) {
    const i = p.lastIndexOf('/');
    return i < 0 ? ['', p] : [p.slice(0, i + 1), p.slice(i + 1)];
}
function plural(n, word) {
    return n === 1 ? word : word + 's';
}
function vscodeLink(repo, file, line) {
    return `vscode://file${encodeURI(join(repo, file))}:${line}`;
}
function esc(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function nl(s) {
    return s.replace(/\n/g, '<br>');
}
function renderMarkdown(input) {
    const lines = input.replace(/\r\n/g, '\n').trim().split('\n');
    const out = [];
    let paragraph = [];
    function flushParagraph() {
        if (!paragraph.length)
            return;
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
            const code = [];
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
                if (!next)
                    break;
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
                if (!next)
                    break;
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
                if (!next)
                    break;
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
function renderInlineMarkdown(input) {
    return input
        .split(/(`[^`]*`)/g)
        .map((part) => {
        if (part.startsWith('`') && part.endsWith('`'))
            return `<code>${esc(part.slice(1, -1))}</code>`;
        return esc(part)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_]+)__/g, '<strong>$1</strong>')
            .replace(/(^|[^\*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
            .replace(/\n/g, '<br>');
    })
        .join('');
}
