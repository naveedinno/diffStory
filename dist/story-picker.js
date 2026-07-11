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
const TRASH = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 13h10l1-13"/></svg>`;
function storyRow(s, now, routeBase) {
    const href = `${routeBase}/review?story=${encodeURIComponent(s.id)}`;
    const mode = s.mode === 'brief'
        ? 'Compact story'
        : s.mode === 'detailed'
            ? 'Deep review'
            : 'Guided review';
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
    return (`<div class="story-row${s.valid ? '' : ' row-bad'}">` +
        `<a class="row-main" href="${href}">` +
        `<span class="row-body">` +
        `<span class="row-head"><span class="row-title">${esc(s.title || s.id)}</span>${badges}</span>` +
        `<span class="row-sum">${summary}</span>` +
        `<span class="row-meta">${metaHtml}</span>` +
        `</span>` +
        `<span class="row-chev" aria-hidden="true">${CHEV}</span>` +
        `</a>` +
        `<button class="row-del" data-delete-story="${esc(s.id)}" data-story-title="${esc(s.title || s.id)}" type="button" title="Remove story" aria-label="Remove ${esc(s.title || s.id)}">${TRASH}</button>` +
        `</div>`);
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
            `<a class="nv-pri" href="${esc(rb)}/change">New diff scope</a>`,
    });
    const body = hasStories
        ? `<div class="layout">
       <aside class="side">
         <p class="kicker">Story library</p>
         <h1>${esc(opts.repoName)}</h1>
         <p class="sub">Open a saved walkthrough, refresh after an agent writes a new one, or remove old story files you no longer need.</p>
         <a class="side-cta" href="${esc(rb)}/change">New diff scope</a>
       </aside>
       <section class="stories-panel">
         <div class="head">
           <div><p class="kicker">Saved stories</p><h2>${opts.stories.length} ${opts.stories.length === 1 ? 'story' : 'stories'}</h2></div>
           <a class="panel-action" href="${esc(rb)}/change">New diff scope</a>
         </div>
         <div class="card" id="storyList">${list}</div>
       </section>
       </div>
       `
        : `<div class="empty">
         <span class="empty-mark">${MARK}</span>
         <h1 class="empty-title">No stories yet</h1>
         <p class="empty-sub">Open <b>${esc(opts.repoName)}</b>'s current diff to read the change — then generate a guided story from it whenever you want one.</p>
         <a class="empty-cta" href="${esc(rb)}/change">New diff scope</a>
       </div>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${BRAND_HEAD_LINKS}
<title>${esc(APP_BRAND)} — ${esc(opts.repoName)} stories</title>
<style>
:root{--bg:#f4f5f7;--elev:#fff;--label:#17181c;--l2:#61656f;--l3:#8a8f9b;--hair:rgba(20,24,32,.12);--sep:rgba(20,24,32,.08);--blue:#007aff;--blue2:#0067d6;--red-bg:#fde9e7;--red:#bd2a22;--fill:rgba(0,0,0,.045);--chip:rgba(94,99,112,.12)}
@media (prefers-color-scheme:dark){:root{--bg:#17181b;--elev:#24262b;--label:#f5f6f8;--l2:#b3b7c0;--l3:#858b97;--hair:rgba(255,255,255,.13);--sep:rgba(255,255,255,.08);--blue:#0a84ff;--blue2:#3395ff;--red-bg:rgba(255,69,58,.18);--red:#ff6961;--fill:rgba(255,255,255,.06);--chip:rgba(127,132,145,.22)}}
${navStyles()}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--label);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:0}
.wrap{width:min(1080px,100%);margin:0 auto;padding:36px 24px 80px}
.layout{display:grid;grid-template-columns:minmax(230px,300px) minmax(0,1fr);gap:34px;align-items:start}
.side{position:sticky;top:76px;min-height:calc(100vh - 128px);display:flex;flex-direction:column;align-items:flex-start}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 14px}
.kicker{font-size:12px;font-weight:740;color:var(--l3);margin:0 0 6px;text-transform:uppercase;letter-spacing:.08em}
h1{font-size:28px;font-weight:740;letter-spacing:-.02em;margin:0}
h2{font-size:24px;line-height:1.1;font-weight:720;letter-spacing:-.018em;margin:0}
.sub{color:var(--l2);font-size:14px;margin:12px 0 20px;line-height:1.48;max-width:32ch}
.sub b{color:var(--label);font-weight:600}
.side-cta,.panel-action{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:8px;font-size:13.5px;font-weight:650;text-decoration:none;color:#fff;background:var(--blue)}
.side-cta:hover,.panel-action:hover{background:var(--blue2)}
.panel-action{display:none}
.stories-panel{min-width:0}
.card{display:grid;gap:8px}
.story-row{display:grid;grid-template-columns:minmax(0,1fr) 38px;gap:8px;align-items:stretch}
.row-main{display:flex;align-items:center;gap:14px;padding:14px 14px;border:.5px solid var(--hair);border-radius:8px;background:var(--elev);color:inherit;text-decoration:none;transition:background .12s ease,box-shadow .12s ease}
.row-main:hover{background:linear-gradient(0deg,var(--fill),var(--fill)),var(--elev);box-shadow:0 3px 12px rgba(0,0,0,.08)}
.row-main:focus-visible,.row-del:focus-visible,.side-cta:focus-visible,.panel-action:focus-visible{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 36%,transparent)}
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
.row-main:hover .row-chev{opacity:.8}
.row-bad .row-sum{color:var(--red)}
.row-del{width:38px;border:.5px solid var(--hair);border-radius:8px;background:var(--elev);color:var(--l3);display:flex;align-items:center;justify-content:center;cursor:pointer}
.row-del:hover{background:var(--red-bg);color:var(--red)}
.empty{margin:8vh auto 0;max-width:440px;text-align:center;padding:0 16px}
.empty-mark{display:inline-flex;width:66px;height:66px;align-items:center;justify-content:center;border-radius:14px;background:var(--elev);border:.5px solid var(--hair);box-shadow:0 1px 2px rgba(0,0,0,.05);color:var(--blue);margin-bottom:20px}
.empty-title{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0}
.empty-sub{color:var(--l2);font-size:14.5px;line-height:1.5;margin:10px 0 24px}
.empty-sub b{color:var(--label);font-weight:600}
.empty-cta{display:inline-flex;align-items:center;height:42px;padding:0 20px;border-radius:8px;font-size:15px;font-weight:600;color:#fff;background:var(--blue);text-decoration:none;box-shadow:0 1px 2px rgba(0,40,120,.18)}
.empty-cta:hover{background:var(--blue2)}
@media (max-width:760px){.wrap{padding:24px 16px 64px}.layout{display:block}.side{position:static;min-height:0;margin-bottom:26px}.side-cta{display:none}.panel-action{display:inline-flex}.row-meta{font-size:12px}}
</style></head>
<body>
${nav}
<main class="wrap">${body}</main>
<script>
(function(){
  var list=document.getElementById('storyList');if(!list)return;
  list.addEventListener('click',function(e){
    var btn=e.target.closest('button[data-delete-story]');if(!btn)return;
    e.preventDefault();e.stopPropagation();
    var id=btn.getAttribute('data-delete-story'),title=btn.getAttribute('data-story-title')||id;
    if(!id||!confirm('Remove "'+title+'" from this repo?'))return;
    btn.disabled=true;
    fetch('/api/stories',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id:id})})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(d){if(!r.ok)throw new Error(d.error||'Could not remove story.');return d;});})
      .then(function(){var row=btn.closest('.story-row');if(row&&row.parentNode)row.parentNode.removeChild(row);if(!list.querySelector('.story-row'))location.reload();})
      .catch(function(err){btn.disabled=false;alert(err.message||'Could not remove story.');});
  });
})();
</script>
</body></html>`;
}
