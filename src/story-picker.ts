import { APP_BRAND } from './config.js';
import { navBar, navStyles } from './nav.js';
import { BRAND_HEAD_LINKS, brandStoryMarkSvg } from './brand.js';
import { themeBootstrapScript } from './theme.js';
import type { StorySummary } from './stories.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relTime(then: number, now: number): string {
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? 'yesterday' : `${day} days ago`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const MARK = brandStoryMarkSvg('empty-storymark', 30, 30);
const CHEV = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;
const TRASH = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 13h10l1-13"/></svg>`;

function storyRow(s: StorySummary, now: number, routeBase: string): string {
  const href = `${routeBase}/review?story=${encodeURIComponent(s.id)}`;
  const state = !s.valid
    ? { label: 'Needs repair', cls: 'bad', detail: 'Story file cannot be read' }
    : s.openComments
      ? { label: 'Resolve feedback', cls: 'feedback', detail: `${plural(s.openComments, 'open thread')} waiting` }
      : s.freshness === 'stale'
        ? { label: 'Diff changed', cls: 'warn', detail: 'Regenerate before approval' }
        : s.freshness === 'unverified'
          ? { label: 'Verify scope', cls: 'warn', detail: 'Story has no exact diff fingerprint' }
          : { label: 'Ready to decide', cls: 'ready', detail: 'Current diff is verified' };

  const activity = s.changedSinceReview
    ? `${plural(s.changedSinceReview, 'file')} changed since feedback`
    : s.addressedComments
      ? `${plural(s.addressedComments, 'reply')} ready to verify`
      : state.detail;

  const summary = esc(s.valid ? s.summary || 'No summary yet.' : s.error || 'This story file could not be read.');

  return (
    `<article class="story-row state-${state.cls}${s.valid ? '' : ' row-bad'}">` +
    `<a class="row-main" href="${href}">` +
    `<span class="state-rail" aria-hidden="true"></span>` +
    `<span class="row-body">` +
    `<span class="row-head"><span class="row-title">${esc(s.title || s.id)}</span><span class="badge">${state.label}</span></span>` +
    `<span class="row-sum">${summary}</span>` +
    `<span class="session-facts">` +
      `<span><b>${s.liveFiles || s.files}</b> files</span>` +
      `<span><b class="plus">+${s.additions}</b> <b class="minus">−${s.deletions}</b></span>` +
      `<span><b>${Math.max(0, s.steps - s.primers)}</b> code stops${s.primers ? ` + ${plural(s.primers, 'primer')}` : ''}</span>` +
      `<span><b>Round ${s.reviewRound}</b></span>` +
      (s.openComments ? `<span><b>${s.openComments}</b> open feedback</span>` : '') +
    `</span>` +
    `<span class="row-foot"><span class="chip"${s.scope.command ? ` title="${esc(s.scope.command)}"` : ''}>${esc(s.scope.label)}</span><span>${esc(activity)}</span><span>${relTime(s.updatedAt, now)}</span></span>` +
    `</span>` +
    `<span class="resume">Resume review ${CHEV}</span>` +
    `</a>` +
    `<button class="row-del" data-delete-story="${esc(s.id)}" data-story-title="${esc(s.title || s.id)}" type="button" title="Remove story" aria-label="Remove ${esc(s.title || s.id)}">${TRASH}</button>` +
    `</article>`
  );
}

export function renderStoryPicker(opts: { repoName: string; routeBase: string; stories: StorySummary[]; now: number }): string {
  const rb = opts.routeBase;
  const hasStories = opts.stories.length > 0;
  const list = hasStories
    ? opts.stories.map((s) => storyRow(s, opts.now, rb)).join('')
    : '';
  const openFeedback = opts.stories.filter((s) => s.openComments).length;
  const readyToDecide = opts.stories.filter((s) => s.current && !s.openComments).length;

  const nav = navBar({
    home: '/repos',
    crumbs: [{ label: opts.repoName, href: `${rb}/change` }, { label: 'Review history' }],
    right: `<a class="nv-act" href="${esc(rb)}/stories" title="Reload after another agent saves a story">Refresh</a>`,
  });

  const body = `<header class="page-head">
      <div class="page-copy"><p class="kicker">${esc(opts.repoName)}</p><h1>Review history</h1><p class="sub">Resume a saved review when you need its scope, feedback, or prior decision.</p></div>
      <div class="page-actions">
        ${hasStories ? `<span class="history-status" aria-label="Review history status"><span><b>${openFeedback}</b> ${openFeedback === 1 ? 'review needs' : 'reviews need'} feedback</span><span><b>${readyToDecide}</b> ready to decide</span></span>` : ''}
        <a class="start-review" href="${esc(rb)}/change">Start review</a>
      </div>
    </header>` +
    (hasStories
      ? `<section class="stories-panel" aria-labelledby="saved-reviews-title">
           <div class="head"><h2 id="saved-reviews-title">${opts.stories.length} saved ${opts.stories.length === 1 ? 'review' : 'reviews'}</h2></div>
           <div class="card" id="storyList">${list}</div>
         </section>`
      : `<div class="empty">
           <span class="empty-mark">${MARK}</span>
           <h2 class="empty-title">No saved reviews</h2>
           <p class="empty-sub">Start from the current diff. A guided story will appear here when you save one.</p>
         </div>`);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#15171b" data-ds-theme-color>
${themeBootstrapScript()}
${BRAND_HEAD_LINKS}
<title>${esc(APP_BRAND)} — ${esc(opts.repoName)} review history</title>
<style>
:root{--bg:#17181b;--elev:#24262b;--label:#f5f6f8;--l2:#b3b7c0;--l3:#858b97;--hair:rgba(255,255,255,.13);--sep:rgba(255,255,255,.08);--blue:#0a84ff;--blue2:#3395ff;--red-bg:rgba(255,69,58,.18);--red:#ff6961;--amber:#d28b26;--green:#48d597;--fill:rgba(255,255,255,.06);--chip:rgba(127,132,145,.22)}
:root[data-theme="light"]{--bg:#f1f3f6;--elev:#fff;--label:#17191e;--l2:#5e6470;--l3:#858c99;--hair:rgba(18,23,32,.13);--sep:rgba(18,23,32,.08);--blue:#0866e5;--blue2:#0057ca;--red-bg:#fde9e7;--red:#bd2a22;--amber:#b86b00;--green:#177a51;--fill:rgba(15,23,42,.045);--chip:rgba(94,99,112,.11)}
${navStyles()}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--label);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:0}
.wrap{width:min(960px,100%);margin:0 auto;padding:28px 24px 64px}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;padding-bottom:22px;margin-bottom:22px;border-bottom:.5px solid var(--sep)}
.page-copy{min-width:0}.page-actions{display:flex;align-items:center;gap:18px;flex:none}
.head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 12px}
.kicker{font-size:12px;font-weight:740;color:var(--l3);margin:0 0 6px;text-transform:uppercase;letter-spacing:.08em}
h1{font-size:28px;font-weight:740;letter-spacing:-.02em;margin:0}
h2{font-size:18px;line-height:1.1;font-weight:700;letter-spacing:-.012em;margin:0}
.sub{color:var(--l2);font-size:13.5px;margin:7px 0 0;line-height:1.45;max-width:58ch}
.sub b{color:var(--label);font-weight:600}
.history-status{display:flex;align-items:center;gap:14px;color:var(--l2);font-size:12px;white-space:nowrap}.history-status span+span{padding-left:14px;border-left:1px solid var(--sep)}.history-status b{color:var(--label);font-variant-numeric:tabular-nums}
.start-review{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:8px;font-size:13.5px;font-weight:650;text-decoration:none;color:#fff;background:var(--blue)}
.start-review:hover{background:var(--blue2)}
.stories-panel{min-width:0}
.card{display:grid;gap:12px}
.story-row{display:grid;grid-template-columns:minmax(0,1fr) 38px;gap:8px;align-items:stretch}
.row-main{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:18px;padding:15px 16px 15px 19px;border:.5px solid var(--hair);border-radius:12px;background:var(--elev);color:inherit;text-decoration:none;overflow:hidden;transition:background .12s ease,box-shadow .12s ease,transform .1s ease-out}
.row-main:hover{background:linear-gradient(0deg,var(--fill),var(--fill)),var(--elev);box-shadow:0 3px 12px rgba(0,0,0,.08)}
.row-main:active{transform:scale(.995)}
.state-rail{position:absolute;inset:0 auto 0 0;width:3px;background:var(--l3)}.state-ready .state-rail{background:var(--green)}.state-feedback .state-rail{background:var(--blue)}.state-warn .state-rail{background:var(--amber)}.state-bad .state-rail{background:var(--red)}
.row-main:focus-visible,.row-del:focus-visible,.start-review:focus-visible{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 36%,transparent)}
.row-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.row-head{display:flex;align-items:center;gap:8px;min-width:0}
.row-title{font-size:15.5px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.badge{flex:none;font-size:10.5px;font-weight:740;letter-spacing:.04em;text-transform:uppercase;padding:3px 7px;border-radius:5px;color:var(--l2);background:var(--fill)}.state-ready .badge{color:var(--green);background:color-mix(in srgb,var(--green) 12%,transparent)}.state-feedback .badge{color:var(--blue);background:color-mix(in srgb,var(--blue) 12%,transparent)}.state-warn .badge{color:var(--amber);background:color-mix(in srgb,var(--amber) 12%,transparent)}.state-bad .badge{color:var(--red);background:var(--red-bg)}
.row-sum{font-size:13.5px;color:var(--l2);line-height:1.42;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.session-facts{display:flex;align-items:center;flex-wrap:wrap;gap:0;margin-top:5px;color:var(--l2);font-size:12px}.session-facts>span{padding:0 11px;border-left:1px solid var(--sep)}.session-facts>span:first-child{padding-left:0;border-left:0}.session-facts b{color:var(--label);font-variant-numeric:tabular-nums}.session-facts .plus{color:var(--green)}.session-facts .minus{color:var(--red);margin-left:3px}
.row-foot{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:3px;color:var(--l3);font-size:11.5px}.row-foot>span+span:before{content:"·";margin-right:8px;opacity:.55}
.chip{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--label);background:var(--chip);padding:2px 7px;border-radius:6px;letter-spacing:0}
.chip-bad{color:var(--red);background:var(--red-bg)}
.resume{display:inline-flex;align-items:center;gap:4px;color:var(--blue);font-size:12.5px;font-weight:680;white-space:nowrap}.resume svg{width:14px;height:14px}
.row-bad .row-sum{color:var(--red)}
.row-del{width:38px;border:.5px solid var(--hair);border-radius:8px;background:var(--elev);color:var(--l3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color .12s ease-out,color .12s ease-out,transform .1s ease-out}
.row-del:hover{background:var(--red-bg);color:var(--red)}
.row-del:active{transform:scale(.94)}
.empty{max-width:460px;text-align:left;padding:24px;border:.5px dashed var(--hair);border-radius:12px;background:color-mix(in srgb,var(--elev) 55%,transparent)}
.empty-mark{display:inline-flex;width:48px;height:48px;align-items:center;justify-content:center;border-radius:11px;background:var(--elev);border:.5px solid var(--hair);box-shadow:0 1px 2px rgba(0,0,0,.05);color:var(--blue);margin-bottom:14px}
.empty-title{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0}
.empty-sub{color:var(--l2);font-size:14px;line-height:1.5;margin:8px 0 0}
.empty-sub b{color:var(--label);font-weight:600}
@media (max-width:760px){.wrap{padding:22px 16px 64px}.page-head{align-items:flex-start}.page-actions{flex-direction:column;align-items:flex-end;gap:10px}.row-main{grid-template-columns:1fr;padding:16px 15px 15px 19px;gap:12px}.resume{justify-self:start}}
@media (max-width:460px){.story-row{position:relative;display:block}.row-main{padding:16px 54px 15px 19px}.row-head{align-items:flex-start;flex-direction:column}.row-title{display:-webkit-box;white-space:normal;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.28}.row-del{position:absolute;top:12px;right:12px;z-index:2;width:34px;height:34px;border-radius:9px}.row-del::after{content:"";position:absolute;inset:-5px}.session-facts{line-height:1.65}.session-facts>span{padding:0 8px}.row-foot{display:grid;grid-template-columns:auto minmax(0,1fr);gap:5px 8px;align-items:center}.row-foot>span+span:before{display:none}.row-foot>span:nth-child(2){grid-column:1 / -1;grid-row:2;line-height:1.35}.row-foot>span:nth-child(3){grid-column:2;grid-row:1}.resume{margin-top:2px}}
@media (max-width:560px){.page-head{display:block}.page-actions{margin-top:16px;align-items:stretch}.history-status{justify-content:space-between}.start-review{justify-content:center}.empty{max-width:none}}
@media (prefers-reduced-motion:reduce){.row-main,.row-del,.start-review{transition:none}.row-main:active,.row-del:active{transform:none}}
@media (prefers-contrast:more){.row-main,.row-del{border-width:1px;border-color:var(--label)}}
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
