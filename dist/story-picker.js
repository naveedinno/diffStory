import { APP_BRAND } from './config.js';
import { navBar, navStyles } from './nav.js';
import { BRAND_HEAD_LINKS, brandStoryMarkSvg } from './brand.js';
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function relTime(then, now) {
    const sec = Math.max(0, Math.round((now - then) / 1000));
    if (sec < 60)
        return 'just now';
    const min = Math.round(sec / 60);
    if (min < 60)
        return `${min} min ago`;
    const hr = Math.round(min / 60);
    if (hr < 24)
        return `${hr} hr ago`;
    const day = Math.round(hr / 24);
    return day === 1 ? 'yesterday' : `${day} days ago`;
}
function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}
const MARK = brandStoryMarkSvg('empty-storymark', 30, 30);
const CHEV = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;
function storyRow(s, now, routeBase) {
    const href = `${routeBase}/review?story=${encodeURIComponent(s.id)}`;
    const mode = s.mode === 'detailed' ? 'Detailed audit' : 'Guided review';
    const badges = (s.current ? `<span class="badge badge-cur">Current</span>` : '') +
        (s.valid ? '' : `<span class="badge badge-bad">Needs fix</span>`);
    const meta = s.valid
        ? [
            `<span class="chip"${s.scope.command ? ` title="${esc(s.scope.command)}"` : ''}>${esc(s.scope.label)}</span>`,
            mode,
            `${plural(s.files, 'file')} · ${plural(s.steps, 'step')}`,
            relTime(s.updatedAt, now),
        ]
        : [`<span class="chip chip-bad">${esc(s.scope.label)}</span>`, relTime(s.updatedAt, now)];
    const metaHtml = meta
        .map((m, i) => (i === 0 ? m : `<span class="mdot">·</span>${m}`))
        .join('');
    const summary = esc(s.valid ? s.summary || 'No summary yet.' : s.error || 'This story file could not be read.');
    return (`<a class="row${s.valid ? '' : ' row-bad'}" href="${href}">` +
        `<span class="row-body">` +
        `<span class="row-head"><span class="row-title">${esc(s.title || s.id)}</span>${badges}</span>` +
        `<span class="row-sum">${summary}</span>` +
        `<span class="row-meta">${metaHtml}</span>` +
        `</span>` +
        `<span class="row-chev" aria-hidden="true">${CHEV}</span>` +
        `</a>`);
}
export function renderStoryPicker(opts) {
    const rb = opts.routeBase;
    const hasStories = opts.stories.length > 0;
    const list = hasStories
        ? opts.stories.map((s) => storyRow(s, opts.now, rb)).join('')
        : '';
    const nav = navBar({
        home: '/repos',
        crumbs: [{ label: opts.repoName }],
        right: `<a class="nv-act" href="${esc(rb)}/stories" title="Reload after another agent saves a story">Refresh</a>` +
            `<a class="nv-pri" href="${esc(rb)}/change">+ New story</a>`,
    });
    const body = hasStories
        ? `<div class="head">
         <h1>Stories</h1>
         <p class="sub">Saved walkthroughs for <b>${esc(opts.repoName)}</b>. Open one to review, or start a new story from the current diff.</p>
       </div>
       <div class="card">${list}</div>`
        : `<div class="empty">
         <span class="empty-mark">${MARK}</span>
         <h1 class="empty-title">No stories yet</h1>
         <p class="empty-sub">Generate a guided walkthrough of <b>${esc(opts.repoName)}</b>'s current diff — the agent that wrote the change explains it in reading order.</p>
         <a class="empty-cta" href="${esc(rb)}/change">Start your first review</a>
       </div>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${BRAND_HEAD_LINKS}
<title>${esc(APP_BRAND)} — ${esc(opts.repoName)} stories</title>
<style>
:root{--bg:#f5f5f7;--elev:#fff;--label:#1d1d1f;--l2:#6e6e73;--l3:#8e8e93;--hair:rgba(0,0,0,.1);--sep:rgba(0,0,0,.07);--blue:#007aff;--blue2:#0067d6;--red-bg:#fde8e7;--red:#c4271f;--fill:rgba(0,0,0,.04);--chip:rgba(120,120,128,.12)}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1e;--elev:#2c2c2e;--label:#f5f5f7;--l2:#aeaeb2;--l3:#8e8e93;--hair:rgba(255,255,255,.12);--sep:rgba(255,255,255,.08);--blue:#0a84ff;--blue2:#3395ff;--red-bg:rgba(255,69,58,.18);--red:#ff6961;--fill:rgba(255,255,255,.05);--chip:rgba(120,120,128,.24)}}
${navStyles()}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--label);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.wrap{max-width:760px;margin:0 auto;padding:28px 24px 80px}
.head{margin:0 0 18px}
h1{font-size:26px;font-weight:700;letter-spacing:-.022em;margin:0}
.sub{color:var(--l2);font-size:14px;margin:7px 0 0;line-height:1.45;max-width:62ch}
.sub b{color:var(--label);font-weight:600}
.card{background:var(--elev);border:.5px solid var(--hair);border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden}
.row{display:flex;align-items:center;gap:14px;padding:15px 16px;border-bottom:.5px solid var(--sep);color:inherit;text-decoration:none;transition:background .12s ease}
.row:last-child{border-bottom:none}.row:hover{background:var(--fill)}
.row:focus-visible{outline:none;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--blue) 55%,transparent)}
.row-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.row-head{display:flex;align-items:center;gap:8px;min-width:0}
.row-title{font-size:15.5px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.badge{flex:none;font-size:10.5px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;padding:2px 7px;border-radius:6px}
.badge-cur{color:var(--blue);background:color-mix(in srgb,var(--blue) 14%,transparent)}
.badge-bad{color:var(--red);background:var(--red-bg)}
.row-sum{font-size:13.5px;color:var(--l2);line-height:1.42;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.row-meta{display:flex;align-items:center;flex-wrap:wrap;gap:7px;font-size:12.5px;color:var(--l3);margin-top:1px}
.mdot{opacity:.5}
.chip{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--label);background:var(--chip);padding:2px 7px;border-radius:6px;letter-spacing:0}
.chip-bad{color:var(--red);background:var(--red-bg)}
.row-chev{flex:none;color:var(--l3);display:flex;opacity:.5}
.row:hover .row-chev{opacity:.8}
.row-bad .row-sum{color:var(--red)}
.empty{margin:8vh auto 0;max-width:440px;text-align:center;padding:0 16px}
.empty-mark{display:inline-flex;width:66px;height:66px;align-items:center;justify-content:center;border-radius:18px;background:var(--elev);border:.5px solid var(--hair);box-shadow:0 1px 2px rgba(0,0,0,.05);color:var(--blue);margin-bottom:20px}
.empty-title{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0}
.empty-sub{color:var(--l2);font-size:14.5px;line-height:1.5;margin:10px 0 24px}
.empty-sub b{color:var(--label);font-weight:600}
.empty-cta{display:inline-flex;align-items:center;height:44px;padding:0 22px;border-radius:11px;font-size:15px;font-weight:600;color:#fff;background:var(--blue);text-decoration:none;box-shadow:0 1px 2px rgba(0,40,120,.18)}
.empty-cta:hover{background:var(--blue2)}
@media (max-width:560px){.wrap{padding:20px 16px 64px}.row-meta{font-size:12px}}
</style></head>
<body>
${nav}
<main class="wrap">${body}</main>
</body></html>`;
}
