// Turn a validated tour + the parsed diff into a single self-contained HTML page —
// the diffStory review screen. All code content is escaped here, server-side; the
// client JS only ever sets textContent or injects this server-escaped HTML, so
// there is no HTML-injection sink.
import { join } from 'node:path';
import { PAGE_CSS, PAGE_JS } from './page-assets.js';
import { APP_BRAND } from './config.js';
import { buildReviewModel } from './view-model.js';
import { highlight } from './highlight.js';
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
export function renderPage(input) {
    const { repo, tour, files, baseLabel, comments } = input;
    const model = buildReviewModel(repo, tour, files);
    // Navigation is 0-based with the Overview as index 0, so step i lands at i + 1.
    // Every [data-goto-step] target (file chips, trust drawer) reads from this map.
    const stepIndexById = new Map(model.steps.map((s, i) => [s.id, i + 1]));
    const openCount = comments.filter((c) => c.status !== 'resolved').length;
    const uncoveredCount = model.trust.uncovered.length;
    const approveReady = openCount === 0 && uncoveredCount === 0;
    const railCards = model.steps.map((s, i) => railCard(s, i)).join('');
    const railFiles = model.files.map((f, i) => railFileItem(f, i)).join('');
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
<title>${esc(APP_BRAND)} — ${esc(tour.title)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<header class="ds-top">
  <div class="ds-brand" title="${esc(APP_BRAND)} — the agent tells the story of its change">
    ${BRAND_MARK}
    <span class="ds-word"><span class="ds-word-a">diff</span><span class="ds-word-b">Story</span></span>
  </div>
  <button class="ds-sidebar-toggle" data-sidebar-toggle aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar">
    <span class="ds-sidebar-toggle-ico">☰</span>
  </button>
  <div class="ds-vsep"></div>
  <div class="ds-titlewrap">
    <div class="ds-kicker">Reviewing <span class="ds-dim">vs</span> <span class="ds-change" title="Diffing the working tree against ${esc(baseLabel)}">${esc(baseLabel)}</span></div>
    <div class="ds-title" title="${esc(tour.summary || tour.title)}">${esc(tour.title)}</div>
  </div>
  <div class="ds-status">
    <span class="ds-open" id="ds-open-count" title="Review comments still awaiting a reply or resolution"><span class="ds-dot ds-dot-amber"></span><b>${openCount}</b> open ${plural(openCount, 'comment')}</span>
    <button class="ds-addall" data-address-all${openCount ? '' : ' disabled'} title="Have your agent address every open comment and reply right here">Address all open</button>
    <button class="ds-trustpill${uncoveredCount ? '' : ' is-clean'}" data-trust-open title="Trust check — changes in the diff that no tour step explains">${uncoveredCount
        ? `<span class="ds-tri">▲</span><b>${uncoveredCount}</b> unexplained ${plural(uncoveredCount, 'change')}`
        : `<span class="ds-check">✓</span> all changes explained`}</button>
  </div>
  <div class="ds-settings-wrap">
    <button class="ds-readaloud" data-readaloud title="Read each step's reason aloud as you walk the story"><span class="ds-readaloud-ico">▸</span> Read aloud</button>
    <button class="ds-gear" data-settings title="Read-aloud settings" aria-label="Read-aloud settings">⚙</button>
    <div class="ds-settings-pop" id="ds-settings" hidden>
      <div class="ds-settings-title">Read aloud</div>
      <div class="ds-settings-row">
        <span class="ds-settings-label">Operator</span>
        <div class="ds-seg" aria-label="Voice operator">
          <button data-operator="story" class="is-active">Story</button>
          <button data-operator="warm">Warm</button>
          <button data-operator="reviewer">Reviewer</button>
          <button data-operator="system">System</button>
        </div>
      </div>
      <div class="ds-settings-row">
        <span class="ds-settings-label">Speed</span>
        <div class="ds-seg">
          <button data-rate="0.8">Slow</button>
          <button data-rate="1.05" class="is-active">Normal</button>
          <button data-rate="1.4">Fast</button>
        </div>
      </div>
    </div>
  </div>
  <div class="ds-vsep"></div>
  <div class="ds-actions">
    <button class="ds-btn ds-btn-ghost" data-verdict="request">Request changes</button>
    <button class="ds-btn ds-btn-approve" data-verdict="approve"${approveReady ? '' : ' disabled'} title="${approveReady
        ? 'Everything is covered and there are no open comments'
        : 'Resolve open comments and make sure every change is explained first'}"><span class="ds-check">✓</span> Approve</button>
  </div>
</header>

<div class="ds-agentconsole" id="ds-agentconsole" hidden aria-live="polite">
  <div class="ds-ac-head">
    <span class="ds-ac-spin" aria-hidden="true"></span>
    <span class="ds-ac-title">Agent is working…</span>
    <span class="ds-flex"></span>
    <button class="ds-ghost ds-ac-stop" data-ac-stop hidden>Stop</button>
    <button class="ds-ghost ds-ac-close" data-ac-close hidden>Close</button>
  </div>
  <pre class="ds-ac-body" id="ds-ac-body"></pre>
  <div class="ds-ac-foot" id="ds-ac-foot" hidden></div>
</div>

<div class="ds-layout">
  <aside class="ds-rail">
    <div class="ds-railpad">
      <div class="ds-viewtoggle" role="tablist">
        <button class="ds-tab is-active" data-view="tour" role="tab">Story tour</button>
        <button class="ds-tab" data-view="files" role="tab">All files</button>
      </div>
    </div>
    ${introCard(model)}
    <div class="ds-readhead" data-rail="tour">
      <div class="ds-readhead-row">
        <span class="ds-readhead-label">Reading order</span>
        <span class="ds-readhead-count" id="ds-progress-text">${model.totalSteps} ${plural(model.totalSteps, 'step')}</span>
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
  </aside>

  <main class="ds-main">
    <div class="ds-view" id="ds-view-tour">
      ${introPanel(model, tour)}
      ${stepPanels}
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
        ? `<span class="ds-dot"></span><span class="ds-stat-untoured"><span class="ds-dot ds-dot-amber"></span>${uncoveredCount} untoured</span>`
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
<div class="ds-toast" id="ds-toast" hidden></div>
<noscript><div class="ds-empty">diffStory needs JavaScript to drive the review.</div></noscript>
<script>${PAGE_JS}</script>
</body>
</html>`;
}
// ---- sidebar ----
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
function railFileItem(f, i) {
    const [dir, base] = splitPath(f.file);
    const kindClass = f.kind === 'new' ? 'new' : f.kind;
    const stat = f.add || f.del
        ? `${f.add ? `<span class="ds-stat-add">+${f.add}</span>` : ''}${f.del ? `<span class="ds-stat-del">−${f.del}</span>` : ''}`
        : '<span class="ds-dim">·</span>';
    const flag = f.untoured
        ? `<span class="ds-fileitem-flag" title="${f.untoured} untoured ${plural(f.untoured, 'change')}">▲</span>`
        : '';
    return `<button class="ds-fileitem${f.untoured ? ' is-untoured' : ''}" data-file-index="${i}" data-goto-file="${esc(f.file)}" title="${esc(f.file)} — ${esc(f.kindLabel)}">
    <span class="ds-fileitem-dot k-${kindClass}"></span>
    <span class="ds-fileitem-path"><span class="ds-dim">${esc(dir)}</span><span class="ds-fileitem-base">${esc(base)}</span></span>
    ${flag}
    <span class="ds-fileitem-stat">${stat}</span>
  </button>`;
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
      <div class="ds-why-head"><span class="ds-why-ico"></span><span class="ds-why-label">Why this step</span><button class="ds-playstep" data-playstep title="Read this step aloud">▸</button></div>
      <p class="ds-why-text">${nl(esc(s.why))}</p>
    </div>
    <div class="ds-diffscroll">
      <div class="ds-diff" data-diff data-file="${esc(s.file)}"${s.newFile ? ' data-newfile="1"' : ''}>
        <div class="ds-difftoolbar">
          <span class="ds-difthint" data-difthint>Showing only the lines this step touches</span>
          <span class="ds-commenthint"><span class="ds-commenthint-ico">+</span> hover a line, click&nbsp;<b>+</b>&nbsp;to comment</span>
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
        .map((block, bi) => (bi > 0 ? `<div class="ds-hunkgap"><span>⋯</span></div>` : '') +
        block.map((row) => sbsRow(row, s, comments)).join(''))
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
    <span class="ds-diffhead-side">
      <span class="ds-diffhead-label${s.newFile ? ' ds-dim' : ''}">${leftLabel}</span>
      ${s.newFile ? '' : `<span class="ds-diffhead-path">${esc(s.file)}</span>`}
    </span>
    <span class="ds-diffhead-divider"></span>
    <span class="ds-diffhead-side">
      <span class="ds-diffhead-label${s.newFile ? ' ds-green' : ''}">${rightLabel}</span>
      <span class="ds-diffhead-path">${esc(s.file)}</span>
    </span>
  </div>`;
}
function sbsRow(row, s, comments) {
    const commentable = !!row.comment && row.newNo !== undefined;
    const attrs = commentable
        ? ` data-file="${esc(s.file)}" data-line="${row.newNo}" data-step="${esc(s.id)}"`
        : '';
    const cells = s.context || s.newFile
        ? singleCell(row)
        : `${cell('left', row)}<span class="ds-celldiv"></span>${cell('right', row)}`;
    const plus = commentable ? '<button class="ds-addcomment" title="Comment on this line">+</button>' : '';
    const rowHtml = `<div class="ds-row ds-row-${row.type}"${attrs}>${cells}${plus}</div>`;
    const thread = commentable ? threadFor(s.id, row.newNo, comments) : '';
    return rowHtml + thread;
}
function cell(side, row) {
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
    const flag = side === 'right' && add && row.untoured ? '<span class="ds-untoured-tag">UNTOURED</span>' : '';
    return `<span class="ds-cell${tint}${sideCls}"><span class="ds-no">${no}</span><span class="ds-sign${signClass}">${sign}</span><span class="ds-code">${highlight(row.content) || ' '}</span>${flag}</span>`;
}
function singleCell(row) {
    const no = row.newNo ?? row.oldNo ?? '';
    const add = row.type === 'add';
    const sign = add ? '+' : '';
    const signCls = add ? ' ds-sign-add' : '';
    const tint = add ? (row.untoured ? ' ds-cell-untoured' : ' ds-cell-add') : '';
    const flag = add && row.untoured ? '<span class="ds-untoured-tag">UNTOURED</span>' : '';
    return `<span class="ds-cell ds-cell-single${tint}"><span class="ds-no">${no}</span><span class="ds-sign${signCls}">${sign}</span><span class="ds-code">${highlight(row.content) || ' '}</span>${flag}</span>`;
}
function threadFor(stepId, line, comments) {
    const here = comments.filter((c) => c.step === stepId && c.line === line);
    if (!here.length)
        return '';
    return `<div class="ds-thread">${here.map(commentHtml).join('')}</div>`;
}
export function commentHtml(c) {
    const type = ['change', 'question', 'nit'].includes(c.type)
        ? c.type
        : 'change';
    const reply = c.reply
        ? `<div class="ds-reply">
        <span class="ds-reply-av">◈</span>
        <div class="ds-reply-main">
          <div class="ds-reply-who"><span class="ds-reply-name">${esc(APP_BRAND)}</span><span class="ds-ai-badge">AI</span></div>
          <div class="ds-reply-body">${nl(esc(c.reply))}</div>
        </div>
      </div>`
        : '';
    const resolved = c.status === 'resolved';
    return `<div class="ds-comment status-${c.status}" data-comment-id="${esc(c.id)}" data-status="${c.status}"${c.reply ? ' data-hasreply="1"' : ''}>
    <div class="ds-comment-card flavor-${type}">
      <div class="ds-comment-head">
        <span class="ds-flavor-ico">${FLAVOR_ICON[type]}</span>
        <span class="ds-flavor-label">${FLAVOR_LABEL[type]}</span>
        <span class="ds-dot"></span>
        <span class="ds-comment-author">${esc(authorOf(c))}</span>
        <span class="ds-flex"></span>
        <span class="ds-statusbadge"><span class="ds-dot"></span>${STATUS_LABEL[c.status]}</span>
      </div>
      <div class="ds-comment-body">${nl(esc(c.body))}</div>
      ${reply}
      <div class="ds-comment-actions">
        ${c.status !== 'resolved'
        ? '<button class="ds-ghost ds-send" data-send title="Ask your agent to answer or fix this — the reply appears right here">Ask agent</button>'
        : ''}
        <button class="ds-ghost" data-resolve>${resolved ? 'Reopen' : 'Resolve'}</button>
        <button class="ds-ghost ds-del" data-delete>Delete</button>
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
        ? `<button class="ds-stepchip" data-goto-step="${stepIdx}" title="Open this file in the story tour">Step ${f.stepOrder}</button>`
        : '';
    const untouredBadge = f.untoured
        ? `<span class="ds-untoured-badge"><span class="ds-tri">▲</span>${f.untoured} untoured</span>`
        : '';
    const stat = f.add || f.del
        ? `${f.add ? `<span class="ds-stat-add">+${f.add}</span>` : ''}${f.del ? `<span class="ds-stat-del">−${f.del}</span>` : ''}`
        : '<span class="ds-dim">unchanged</span>';
    const unified = f.hunks.length
        ? f.hunks
            .map((hunk, hi) => (hi > 0 ? `<div class="ds-hunkgap"><span>⋯</span></div>` : '') +
            hunk.map(unifiedRow).join(''))
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
      ${toggle}
    </div>
    <div class="ds-filepanel-body">
      <div data-diff-inner${f.hasFull ? ' hidden' : ''}><div class="ds-diffbody ds-diffbody-unified">${unified}</div></div>
      <div data-full-inner${f.hasFull ? '' : ' hidden'}></div>
    </div>
  </section>`;
}
function unifiedRow(row) {
    const sign = row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' ';
    const flag = row.untoured ? '<span class="ds-untoured-tag">UNTOURED</span>' : '';
    return `<div class="ds-urow ds-row-${row.type}${row.untoured ? ' is-untoured' : ''}"><span class="ds-no">${row.no ?? ''}</span><span class="ds-sign ds-sign-${row.type}">${sign}</span><span class="ds-code">${highlight(row.content) || ' '}</span>${flag}</div>`;
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
          <div class="ds-drawer-sub">Every line in the diff, accounted for against the tour.</div>
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
    const rows = u.rows.length
        ? u.rows.map(unifiedRow).join('')
        : `<div class="ds-diffnote">${esc(u.file)}:${u.line}</div>`;
    const stepIdx = u.stepId !== undefined ? stepIndexById.get(u.stepId) : undefined;
    const jump = stepIdx !== undefined
        ? `<button class="ds-btn ds-btn-solid" data-goto-step="${stepIdx}">Jump to ${esc(u.file)}</button>`
        : `<button class="ds-btn ds-btn-solid" data-goto-file="${esc(u.file)}">Show ${esc(u.file)}</button>`;
    return `<div class="ds-trust-card">
    <div class="ds-trust-card-head">
      <span class="ds-trust-card-path">${esc(u.file)}<span class="ds-dim">:${u.line}</span></span>
      <span class="ds-untoured-tag">UNTOURED</span>
    </div>
    <div class="ds-diffbody ds-diffbody-unified">${rows}</div>
    <div class="ds-trust-card-note">This change is in the diff but no tour step walks through it — surfaced here so nothing slips in unexplained.</div>
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
    <span class="ds-diffhead-side"><span class="ds-diffhead-label${opts.newFile ? ' ds-dim' : ''}">${leftLabel}</span>${opts.newFile ? '' : `<span class="ds-diffhead-path">${esc(opts.file)}</span>`}</span>
    <span class="ds-diffhead-divider"></span>
    <span class="ds-diffhead-side"><span class="ds-diffhead-label${opts.newFile ? ' ds-green' : ''}">${rightLabel}</span><span class="ds-diffhead-path">${esc(opts.file)}</span></span>
  </div>`;
    const body = rows.map((r) => fullRow(r)).join('');
    return `${head}<div class="ds-diffbody">${body}</div>`;
}
function fullRow(row) {
    const cells = `${cell('left', row)}<span class="ds-celldiv"></span>${cell('right', row)}`;
    return `<div class="ds-row ds-row-${row.type}">${cells}</div>`;
}
// ---- shared bits ----
const BRAND_MARK = `<svg class="ds-mark" width="13" height="20" viewBox="0 0 13 20" aria-hidden="true">
    <line x1="6.5" y1="3.5" x2="6.5" y2="16.5" stroke="#3f444c" stroke-width="2" stroke-linecap="round"></line>
    <circle cx="6.5" cy="4.5" r="3.6" fill="#5a606b"></circle>
    <circle cx="6.5" cy="10" r="3.6" fill="#828a96"></circle>
    <circle cx="6.5" cy="15.5" r="3.6" fill="oklch(0.7 0.13 235)"></circle>
  </svg>`;
// The brand mark in miniature, in currentColor so it tints with state: a spine of
// three points — the whole story at a glance. Marks the Overview, in rail and panel.
const STORY_MARK = `<svg class="ds-storymark" width="11" height="15" viewBox="0 0 11 15" aria-hidden="true"><line x1="5.5" y1="2.6" x2="5.5" y2="12.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"></line><circle cx="5.5" cy="2.6" r="1.9" fill="currentColor"></circle><circle cx="5.5" cy="7.5" r="1.9" fill="currentColor"></circle><circle cx="5.5" cy="12.4" r="1.9" fill="currentColor"></circle></svg>`;
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
