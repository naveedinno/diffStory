// The diffStory app picker — the front door you see when you open the app with no
// repo. Styled to Apple's HIG: SF Pro, semantic system colors, continuous corners,
// light + dark, reduced-motion aware. A browser can't read a path back from the OS
// file dialog, so the "Choose a folder" control drives a server-backed directory
// browser (GET /api/fs) instead. Self-contained; every server value is escaped.
import { APP_BRAND } from './config.js';
import { BRAND_HEAD_LINKS, brandMarkSvg, brandThreadBackdropSvg } from './brand.js';
import { sharedTokens, themeBootstrapScript, themeControl, themeControlStyles, threadAtmosphereStyles } from './theme.js';
function esc(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
/** Home-relative, middle-truncated path for compact display (full path stays in the title). */
function prettyPath(p, home) {
    let s = home && p.startsWith(home) ? '~' + p.slice(home.length) : p;
    if (s.length > 46)
        s = s.slice(0, 16) + '…' + s.slice(-27);
    return s;
}
function relativeTime(then, now) {
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
const ICON_FOLDER = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.2h7A1.5 1.5 0 0 1 19 9.7v7.8A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5z"/></svg>';
const ICON_BRANCH = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="7" r="2.2"/><path d="M6 7.2v9.6M18 9.2c0 4.2-3.4 4.8-6 5.4"/></svg>';
const ICON_CHEVRON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const ICON_PLUS = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 13h10l1-13"/></svg>';
const ICON_SEARCH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>';
const ICON_MARK = brandMarkSvg('appmark', 34, 34);
const COLO_MARK = brandMarkSvg('colomark', 15, 15, 'mono');
const HERO_THREAD = brandThreadBackdropSvg('hero-thread ds-atmosphere-thread');
function statusPill(r) {
    // Tour status is an internal concept and confused users — don't surface it here.
    // Only flag a recent whose folder is gone / no longer a git repo.
    if (!r.isGit)
        return `<span class="pill pill-missing">Missing</span>`;
    return '';
}
function recentCard(r, home, now, index) {
    const meta = [];
    if (r.isGit && r.currentBranch)
        meta.push(`<span class="meta">${ICON_BRANCH}${esc(r.currentBranch)}</span>`);
    if (r.isGit && r.changedFiles > 0)
        meta.push(`<span class="meta">${r.changedFiles} changed file${r.changedFiles === 1 ? '' : 's'}</span>`);
    meta.push(`<span class="meta">${esc(relativeTime(r.lastOpened, now))}</span>`);
    return (`<div class="repo-row${r.isGit ? '' : ' repo-row-missing'}">` +
        `<button class="repo-card" data-open="${esc(r.path)}" type="button">` +
        `<span class="lg-num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>` +
        `<span class="tile">${ICON_FOLDER}</span>` +
        `<span class="card-body">` +
        `<span class="card-top"><span class="name">${esc(r.name)}</span>${statusPill(r)}</span>` +
        `<span class="path" title="${esc(r.path)}">${esc(prettyPath(r.path, home))}</span>` +
        `<span class="card-meta">${meta.join('<span class="dot">·</span>')}</span>` +
        `</span>` +
        `<span class="chev" aria-hidden="true">${ICON_CHEVRON}</span>` +
        `</button>` +
        `<button class="remove-btn" data-remove-repo="${esc(r.path)}" type="button" title="Remove from recent repositories" aria-label="Remove ${esc(r.name)} from recent repositories">${ICON_TRASH}</button>` +
        `</div>`);
}
export function renderPicker(recents, home, now) {
    const available = recents.filter((r) => r.isGit);
    const missing = recents.filter((r) => !r.isGit);
    const list = recents.length
        ? available.map((r, i) => recentCard(r, home, now, i)).join('') +
            (missing.length
                ? `<details class="missing-group"><summary>${missing.length} unavailable ${missing.length === 1 ? 'workspace' : 'workspaces'} <span aria-hidden="true">⌄</span></summary><div class="missing-list">${missing.map((r, i) => recentCard(r, home, now, available.length + i)).join('')}</div></details>`
                : '')
        : `<div class="empty"><span class="empty-mark">${ICON_FOLDER}</span><p class="empty-title">No repositories yet</p><p class="empty-sub">Point diffStory at any local Git repository — it reads the working tree directly, nothing is uploaded.</p></div>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#0a0c0f" data-ds-theme-color>
${themeBootstrapScript()}
${BRAND_HEAD_LINKS}
<title>${esc(APP_BRAND)} — pick a repo</title>
<style>
${sharedTokens()}
${threadAtmosphereStyles()}
/* Signal 3b: alias picker names onto the canonical tokens (theme.ts); --bg and --scrim are canonical (inherited). Aliases flip via the canonical light block. */
:root{
  --bg-rail:var(--surface-2); --bg-elev:var(--surface); --label:var(--text); --label2:var(--text-2); --label3:var(--text-3);
  --sep:var(--line-soft); --hairline:var(--line); --hover:var(--fill-2);
  --blue:var(--accent); --blue-press:var(--accent-hi); --green-bg:var(--add-soft); --green-fg:var(--add);
  --neutral-bg:var(--fill-3); --neutral-fg:var(--text-2); --red-bg:var(--del-soft); --red-fg:var(--del);
  --tile:var(--accent-soft); --tile-fg:var(--accent); --sheet:var(--surface-3);
}
${themeControlStyles()}
*{box-sizing:border-box}
html,body{margin:0}
body{
  background:var(--bg); color:var(--label); min-height:100vh;
  font-family:var(--font-sans);
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; letter-spacing:0;
}
.wrap{width:min(820px,100%); margin:0 auto; padding:36px 24px 28px; min-height:100vh; display:flex; flex-direction:column}
.hero{position:relative;display:flex;align-items:center;min-height:168px;padding:24px 0 26px;margin-bottom:24px;border-bottom:1px solid var(--sep);overflow:hidden}
.hero>*{position:relative;z-index:1}
/* Solid plates under the hero text so the thread reads as passing behind the
   labels instead of striking through them. */
.hero .head{background:var(--bg);border-radius:var(--radius-lg);padding:10px 16px 10px 14px;margin-left:-14px}
.hero>.ds-theme-wrap{background:var(--bg);border-radius:var(--radius);box-shadow:0 0 0 6px var(--bg)}
.hero-thread{position:absolute;inset:0;z-index:0;width:100%;height:100%;pointer-events:none}
.hero>.ds-theme-wrap{margin-left:auto}
.head{display:flex; align-items:center; gap:14px; flex:none}
/* Signal 3b: the old blue rounded-square app icon is retired — show the Thread-Path mark directly. */
.appicon{flex:none;display:flex;align-items:center;justify-content:center}
.appmark{display:block;--ds-brand-path:var(--accent);--ds-brand-node-a:var(--label);--ds-brand-node-b:var(--accent-hi);--ds-brand-node-c:var(--label)}
h1{font-size:22px; line-height:1.05; font-weight:700; margin:0; letter-spacing:-.022em}
.brandlock{display:flex;flex-direction:column;gap:2px;min-width:0}
h1.wordmark{font-family:var(--font-display);font-size:24px;font-weight:400;line-height:1;letter-spacing:-.03em}
.wm-diff{color:var(--label2);font-weight:400}.wm-story{color:var(--label);font-weight:700}
.brandkicker{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
.manager{min-width:0}
.launchwarn{margin:0 0 18px;padding:10px 12px;border:1px solid var(--amber);border-radius:var(--radius);background:var(--amber-soft);color:var(--label);font-size:12.5px;line-height:1.45;display:flex;align-items:center;gap:10px}
.launchwarn[hidden]{display:none}
.launchwarn span{flex:1;min-width:0}
.skillfix{flex:none;font:inherit;font-size:12px;font-weight:600;color:var(--on-accent);background:var(--blue);border:none;border-radius:var(--radius);padding:6px 10px;cursor:pointer}
.skillfix:hover{background:var(--blue-press)}.skillfix:disabled{opacity:.55;cursor:default}
.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:2px 0 14px}
h2{font-family:var(--font-display);font-size:26px;line-height:1.1;font-weight:700;margin:0;letter-spacing:-.02em}
.add-btn{height:var(--control-h);padding:0 13px;display:inline-flex;align-items:center;gap:7px;border:none;border-radius:var(--radius);background:var(--blue);color:var(--on-accent);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.add-btn:hover{background:var(--blue-press)}
.stack>*+*{margin-top:8px}
.missing-group{margin-top:12px;border-top:1px solid var(--sep);padding-top:8px}.missing-group>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;padding:8px 3px;color:var(--label3);font-size:12px;font-weight:600;cursor:pointer}.missing-group>summary::-webkit-details-marker{display:none}.missing-group[open]>summary span{transform:rotate(180deg)}.missing-list{display:grid;gap:8px;padding-top:2px}
.repo-card,.fsrow{font:inherit; color:inherit; cursor:pointer}
.repo-row{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:8px;align-items:stretch}
.lg-num{flex:none;width:20px;font-family:var(--font-mono);font-size:12px;font-weight:600;letter-spacing:-.01em;color:var(--numeral);text-align:right}
.repo-row-missing .lg-num{color:var(--numeral-dim)}
.repo-card{width:100%; display:flex; align-items:center; gap:13px; text-align:left;
  background:var(--surface-2); border:1px solid var(--line-soft); border-radius:var(--radius-island); padding:14px 16px;
  transition:transform var(--motion-duration-fast) ease, background var(--motion-duration-fast) ease, border-color var(--motion-duration-fast) ease;}
.repo-card:hover{background:var(--fill-1); border-color:var(--line)}
.repo-card:active{transform:scale(.992)}
.repo-card:focus-visible,.add-btn:focus-visible,.remove-btn:focus-visible{outline:none; box-shadow:0 0 0 3px var(--accent-soft)}
.repo-row-missing{opacity:.68}
.remove-btn{width:44px;border:1px solid var(--hairline);border-radius:var(--radius);background:var(--bg-elev);color:var(--label3);display:flex;align-items:center;justify-content:center;cursor:pointer}
.remove-btn:hover{background:var(--red-bg);color:var(--red-fg)}
.tile{width:38px; height:38px; border-radius:var(--radius); flex:none; background:var(--tile); color:var(--tile-fg);
  display:flex; align-items:center; justify-content:center}
.repo-row-missing .tile{background:var(--neutral-bg); color:var(--neutral-fg)}
.card-body{flex:1; min-width:0; display:flex; flex-direction:column; gap:3px}
.card-top{display:flex; align-items:center; gap:8px}
.name{font-size:15px; font-weight:600; letter-spacing:-.012em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.path{font-family:var(--font-mono); font-size:12px; color:var(--label2);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.card-meta{display:flex; align-items:center; flex-wrap:wrap; gap:7px; color:var(--label2); font-family:var(--font-mono); font-size:11px; margin-top:1px}
.meta{display:inline-flex; align-items:center; gap:4px}
.meta svg{opacity:.8}
.dot{color:var(--label3); opacity:.6}
.chev{color:var(--label3); flex:none; display:flex; opacity:.55}
.pill{font-size:11px; font-weight:600; padding:2px 8px; border-radius:var(--radius-sm); flex:none}
.pill-ready{background:var(--green-bg); color:var(--green-fg)}
.pill-none{background:var(--neutral-bg); color:var(--neutral-fg)}
.pill-missing{background:var(--red-bg); color:var(--red-fg)}
.empty{text-align:center; padding:40px 20px; border:1px dashed var(--line); border-radius:var(--radius-island); color:var(--label2)}
.empty-mark{display:inline-flex; width:52px; height:52px; border-radius:var(--radius-island); align-items:center; justify-content:center;
  background:var(--fill-1); color:var(--label3); margin-bottom:14px}
.empty-title{font-family:var(--font-display); font-size:20px; font-weight:700; letter-spacing:-.02em; color:var(--label); margin:0 0 6px}
.empty-sub{font-size:12.5px; line-height:1.55; margin:0 auto; max-width:42ch}
input[type=search]{width:100%;height:var(--control-h-lg); padding:0 12px; font:inherit; font-size:13px; color:var(--label);
  background:var(--bg-elev); border:1px solid var(--hairline); border-radius:var(--radius); outline:none;
  transition:box-shadow var(--motion-duration-fast) ease, border-color var(--motion-duration-fast) ease;}
input[type=search]::placeholder{color:var(--label3)}
input[type=search]:focus{border-color:var(--accent-line); box-shadow:0 0 0 3px var(--accent-soft)}
.btn{height:var(--control-h-lg); padding:0 16px; font:inherit; font-size:13px; font-weight:600; color:var(--on-accent); cursor:pointer;
  background:var(--blue); border:none; border-radius:var(--radius); letter-spacing:0;
  transition:background var(--motion-duration-fast) ease, transform var(--motion-duration-press) ease}
.btn:hover{background:var(--blue-press)}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.4; cursor:default; box-shadow:none}
.btn:focus-visible{outline:none; box-shadow:0 0 0 3px var(--accent-soft)}
.ghost{height:var(--control-h-lg); padding:0 16px; font:inherit; font-size:13px; font-weight:500; color:var(--label);
  background:transparent; border:1px solid var(--hairline); border-radius:var(--radius); cursor:pointer}
.ghost:hover{background:var(--hover)}
.scrim{position:fixed; inset:0; background:var(--scrim); display:flex; align-items:center; justify-content:center;
  padding:20px; z-index:50;opacity:0;visibility:hidden;pointer-events:none;transition:opacity var(--motion-duration-ui) ease,visibility 0s linear var(--motion-duration-ui)}
.scrim.show{opacity:1;visibility:visible;pointer-events:auto;transition-delay:0s}
.scrim[hidden]{display:none}
.sheet{width:100%; max-width:560px; max-height:76vh; display:flex; flex-direction:column; overflow:hidden;
  background:var(--sheet); border:1px solid var(--hairline); border-radius:var(--radius-lg); box-shadow:var(--shadow);transform-origin:50% 0;transform:translateY(12px) scale(.975);opacity:0;transition:transform var(--motion-duration-spatial) var(--motion-ease-drawer),opacity var(--motion-duration-ui) ease}
.scrim.show .sheet{transform:none;opacity:1}
.sheet-head{display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid var(--sep)}
.sheet-title{font-size:15px; font-weight:600; flex:1}
.iconbtn{position:relative; width:28px; height:28px; border-radius:var(--radius-sm); border:none; background:var(--neutral-bg); color:var(--label2);
  display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:17px; line-height:1}
.iconbtn::after{content:""; position:absolute; inset:-8px}
.iconbtn:hover{background:var(--hover)}
.crumbs{display:flex; align-items:center; flex-wrap:wrap; gap:2px; padding:9px 16px; border-bottom:1px solid var(--sep);
  font-size:12.5px; color:var(--label2)}
.crumb{background:none; border:none; font:inherit; color:var(--blue); cursor:pointer; padding:2px 5px; border-radius:var(--radius-sm)}
.crumb:not(.cur):hover{background:var(--hover)}
.crumb.cur{color:var(--label); font-weight:600; cursor:default}
.crumb-sep{color:var(--label3); opacity:.6}
.fssearch{padding:10px 16px;border-bottom:1px solid var(--sep)}
.fssearch-box{position:relative;display:flex;align-items:center}
.fssearch-icon{position:absolute;left:11px;color:var(--label3);display:flex;pointer-events:none}
.fssearch input{height:34px;padding-left:35px;padding-right:34px;background:var(--bg);box-shadow:none}
.fssearch input::-webkit-search-cancel-button{-webkit-appearance:none}
.fsclear{position:absolute;right:6px;width:23px;height:23px;border:0;border-radius:var(--radius-sm);background:var(--neutral-bg);color:var(--label2);font:inherit;font-size:13px;line-height:1;cursor:pointer;display:none;align-items:center;justify-content:center}
.fsclear::after{content:"";position:absolute;inset:-10px}
.fsclear.show{display:flex}
.fsclear[hidden]{display:none}
.fsclear:hover{background:var(--hover)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.fslist{overflow-y:auto; padding:6px; flex:1; min-height:120px}
.fsrow{width:100%; display:flex; align-items:center; gap:11px; padding:9px 10px; border-radius:var(--radius); background:none; border:none}
.fsrow:hover{background:var(--hover)}
.fsrow.is-selected{background:var(--hover);box-shadow:inset 0 0 0 1px var(--accent-line)}
.fsrow:focus-visible{outline:none;box-shadow:inset 0 0 0 3px var(--accent-soft)}
.fsrow .fi{color:var(--blue); display:flex; flex:none}
.fsrow .fn{flex:1; min-width:0; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:left}
.fsrow .repo{font-size:11px; font-weight:600; padding:1px 7px; border-radius:var(--radius-sm); background:var(--green-bg); color:var(--green-fg)}
.fsrow .go{color:var(--label3); opacity:.5; display:flex; flex:none}
.fsempty{padding:26px; text-align:center; color:var(--label3); font-size:13px}
.colophon{margin-top:auto;padding-top:16px;border-top:1px solid var(--sep);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px 18px;
  font-family:var(--font-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--label3)}
.manager{margin-bottom:56px}
.colo-brand{display:inline-flex;align-items:center;gap:7px;color:var(--label2);flex:none}
.colo-brand .colomark{display:block;opacity:.7}
.colo-note{text-align:right;min-width:0}
.sheet-foot{display:flex; align-items:center; gap:10px; padding:13px 16px; border-top:1px solid var(--sep)}
.foot-path{flex:1; min-width:0; font-family:var(--font-mono); font-size:11.5px; color:var(--label3);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
@media (prefers-reduced-motion:no-preference){
  .reveal{animation:up var(--motion-duration-spatial) var(--motion-ease-out) backwards}
  .d1{animation-delay:.02s}.d2{animation-delay:.07s}.d3{animation-delay:.12s}.d4{animation-delay:.17s}
  @keyframes up{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
}
@media (prefers-reduced-motion:reduce){.scrim,.sheet{transition:none}.scrim.show .sheet{transform:none;opacity:1}.btn:active{transform:none}}
@media (prefers-contrast:more){.repo-card,.remove-btn,.ghost,input[type=search],.sheet,.launchwarn{border-color:var(--label)}}
@media (max-width:760px){
  .wrap{padding:24px 16px 24px}
  .hero{min-height:128px;padding:14px 0 18px;margin-bottom:20px}
  .manager{margin-bottom:40px}
  .add-btn span{display:none}
}
@media (max-width:480px){
  .hero{align-items:center;min-height:0;padding:6px 0 16px}.hero>.ds-theme-wrap{margin-left:auto}
  .hero-thread{display:none}
  .appmark{width:28px;height:28px}
  .section-head{align-items:center}h2{font-size:21px}
  .colophon{justify-content:center;text-align:center}.colo-note{text-align:center}
  .repo-row{position:relative;display:block}.repo-card{padding-right:54px}
  .lg-num{display:none}
  .remove-btn{position:absolute;top:12px;right:12px;width:34px;height:34px;z-index:2}
  .remove-btn::after{content:"";position:absolute;inset:-5px}
}
</style></head>
<body class="ds-map-bg">
<main class="wrap" id="pickerMain">
  <section class="hero reveal d1">
    ${HERO_THREAD}
    <div class="head">
      <span class="appicon" aria-hidden="true">${ICON_MARK}</span>
      <span class="brandlock">
        <h1 class="wordmark"><span class="wm-diff">diff</span><span class="wm-story">Story</span></h1>
        <span class="brandkicker">the story of this change</span>
      </span>
    </div>
    ${themeControl()}
  </section>

  <section class="manager reveal d2">
    <p class="launchwarn" id="skillWarn" hidden><span id="skillWarnText"></span><button class="skillfix" id="skillUpdateBtn" type="button">Update skills</button></p>
    <div class="section-head">
      <div><h2>Repositories</h2></div>
      <button class="add-btn" id="quickAddBtn" type="button" aria-label="Add repository" title="Add repository">${ICON_PLUS}<span>Add repository</span></button>
    </div>
    <div class="stack" id="recent">${list}</div>
    <p class="sr-only" id="msg" role="status"></p>
  </section>

  <footer class="colophon reveal d3">
    <span class="colo-brand">${COLO_MARK}<span>diffStory</span></span>
    <span class="colo-note">Reads your working tree locally — nothing leaves this machine</span>
  </footer>
</main>

<div class="scrim" id="scrim" role="dialog" aria-modal="true" aria-label="Choose a repository folder" tabindex="-1" hidden>
  <div class="sheet">
    <div class="sheet-head">
      <span class="sheet-title">Choose a repository</span>
      <button class="iconbtn" id="fsClose" type="button" aria-label="Close">✕</button>
    </div>
    <div class="crumbs" id="crumbs"></div>
    <div class="fssearch">
      <div class="fssearch-box">
        <span class="fssearch-icon" aria-hidden="true">${ICON_SEARCH}</span>
        <input type="search" id="fsSearch" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" placeholder="Filter folders" autocomplete="off" spellcheck="false" aria-label="Filter folders in this location" aria-controls="fslist" />
        <button class="fsclear" id="fsClear" type="button" aria-label="Clear folder filter" hidden>✕</button>
      </div>
      <span class="sr-only" id="fsSearchStatus" role="status" aria-live="polite"></span>
    </div>
    <div class="fslist" id="fslist" role="listbox" aria-label="Folders in this location"></div>
    <div class="sheet-foot">
      <span class="foot-path" id="footPath"></span>
      <button class="btn" id="openHere" type="button" disabled>Open this folder</button>
    </div>
  </div>
</div>

<template id="ico-folder">${ICON_FOLDER}</template>
<template id="ico-go">${ICON_CHEVRON}</template>
<script>
(function(){
  var msg=document.getElementById('msg');
  function showSkillState(sk){
    var sw=document.getElementById('skillWarn'),txt=document.getElementById('skillWarnText'),btn=document.getElementById('skillUpdateBtn');
    if(!sw||!txt||!btn||!sk)return;
    if(sk.legacyInstalled){
      sw.hidden=false;btn.hidden=false;btn.disabled=false;btn.textContent='Update skills';
      txt.textContent='review-tour was renamed to diffstory-storyteller. Update skills to remove the retired copy and finish migration.';
      return;
    }
    if(sk.current){
      sw.hidden=true;btn.hidden=true;return;
    }
    sw.hidden=false;btn.hidden=false;btn.disabled=false;btn.textContent='Update skills';
    txt.textContent=sk.installed
      ? 'Story-generation skill is installed but does not match this app. Update it before generating so the agent sees the current story rules.'
      : 'Story-generation skill was not found in ~/.agents, ~/.claude, or ~/.codex. Install it before generating so the agent can create stories reliably.';
  }
  function wireSkillUpdate(){
    var btn=document.getElementById('skillUpdateBtn'),txt=document.getElementById('skillWarnText');if(!btn)return;
    btn.onclick=function(){
      btn.disabled=true;btn.textContent='Updating…';if(txt)txt.textContent='Installing bundled diffStory skills locally…';
      fetch('/api/skills/update',{method:'POST'}).then(function(r){return r.json();}).then(function(d){
        if(d&&d.skills)showSkillState(d.skills);else throw new Error('bad response');
      }).catch(function(){btn.disabled=false;btn.textContent='Try again';if(txt)txt.textContent='Could not update skills. Run scripts/install-skills.sh from this repo, or re-run the diffStory installer.';});
    };
  }
  wireSkillUpdate();
  fetch('/api/agents').then(function(r){return r.json();}).then(function(d){
    showSkillState(d.skills);
  }).catch(function(){});
  function open(path){
    if(!path) return;
    msg.style.color=''; msg.textContent='Opening…';
    fetch('/api/repo/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:path})})
      .then(function(r){ return r.json().catch(function(){return {};}).then(function(d){ if(r.ok){ location.href=d.route||('/repo/'+encodeURIComponent(path.replace(/[\\\/]+$/,'').split(/[\\\/]/).pop()||'repo')+'/stories'); return null; } return d; }); })
      .then(function(e){ if(e){ msg.style.color='var(--red-fg)'; msg.textContent=e.error||'Could not open that path.'; } })
      .catch(function(){ msg.style.color='var(--red-fg)'; msg.textContent='Could not reach the server.'; });
  }
  function emptyRecent(){
    return '<div class="empty"><span class="empty-mark">'+document.getElementById('ico-folder').innerHTML+'</span><p class="empty-title">No repositories yet</p><p class="empty-sub">Point diffStory at any local Git repository — it reads the working tree directly, nothing is uploaded.</p></div>';
  }
  function removeRecent(path,row){
    fetch('/api/repos/recent',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({path:path})})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(d){if(!r.ok)throw new Error(d.error||'Could not remove repository.');return d;});})
      .then(function(){
        if(row&&row.parentNode)row.parentNode.removeChild(row);
        if(!document.querySelector('#recent .repo-row'))document.getElementById('recent').innerHTML=emptyRecent();
        msg.style.color='var(--label2)'; msg.textContent='Removed from recent repositories.';
      })
      .catch(function(e){ msg.style.color='var(--red-fg)'; msg.textContent=e.message||'Could not remove repository.'; });
  }
  document.getElementById('recent').addEventListener('click',function(e){
    var rb=e.target.closest('button[data-remove-repo]');
    if(rb){ e.preventDefault(); e.stopPropagation(); removeRecent(rb.getAttribute('data-remove-repo'),rb.closest('.repo-row')); return; }
    var b=e.target.closest('button[data-open]'); if(b) open(b.getAttribute('data-open'));
  });
  var scrim=document.getElementById('scrim'), fslist=document.getElementById('fslist'),
      crumbs=document.getElementById('crumbs'), footPath=document.getElementById('footPath'),
      openHere=document.getElementById('openHere'), fsSearch=document.getElementById('fsSearch'),
      fsClear=document.getElementById('fsClear'), fsSearchStatus=document.getElementById('fsSearchStatus'),
      modalBackground=document.getElementById('pickerMain'),cur=null, curGit=false, entries=[], filteredEntries=[], selectedIndex=-1, modalTrigger=null,modalCloseTimer=0;
  function el(tag,cls,txt){ var n=document.createElement(tag); if(cls) n.className=cls; if(txt!=null) n.textContent=txt; return n; }
  function ico(id){ return document.getElementById(id).content.cloneNode(true); }

  function browse(path){
    fsSearch.value=''; fsClear.hidden=true; fsClear.classList.remove('show'); entries=[]; filteredEntries=[]; selectedIndex=-1;
    fsSearch.removeAttribute('aria-activedescendant'); fsSearchStatus.textContent='Loading folders…';
    fslist.textContent='Loading…';
    fslist.className='fslist'; fslist.style.color='var(--label3)'; fslist.style.padding='26px';
    fetch('/api/fs'+(path?('?path='+encodeURIComponent(path)):''))
      .then(function(r){return r.json();}).then(render)
      .catch(function(){ fslist.textContent='Could not read that folder.'; fsSearchStatus.textContent='Could not read that folder.'; });
  }
  function crumbFor(p){ var b=el(p.cur?'span':'button','crumb',p.label);
    if(p.cur){ b.classList.add('cur'); b.setAttribute('aria-current','location'); }
    else { b.type='button'; b.addEventListener('click',function(){browse(p.path);}); } return b; }

  function render(l){
    cur=l.path; curGit=!!l.isGit;
    fslist.style.padding=''; fslist.style.color='';
    // breadcrumbs
    crumbs.textContent='';
    var parts=l.path.split('/').filter(Boolean), acc='';
    crumbs.appendChild(crumbFor({label:'/',path:'/',cur:parts.length===0}));
    for(var i=0;i<parts.length;i++){ acc+='/'+parts[i];
      crumbs.appendChild(el('span','crumb-sep','/'));
      crumbs.appendChild(crumbFor({label:parts[i],path:acc,cur:i===parts.length-1})); }
    entries=l.entries.slice();
    renderEntries();
    footPath.textContent=l.path;
    openHere.disabled=!curGit;
    openHere.textContent=curGit?'Open this folder':'Not a git repo';
    if(scrim.classList.contains('show'))fsSearch.focus();
  }
  function activateEntry(en){ if(en.isGit){ open(en.path); } else { browse(en.path); } }
  function renderEntries(){
    var query=fsSearch.value.trim().toLocaleLowerCase();
    filteredEntries=query?entries.filter(function(en){return en.name.toLocaleLowerCase().indexOf(query)!==-1;}):entries.slice();
    if(query){ selectedIndex=filteredEntries.length?Math.min(Math.max(selectedIndex,0),filteredEntries.length-1):-1; }
    else { selectedIndex=-1; }
    var hasFilter=!!fsSearch.value;fsClear.hidden=!hasFilter;fsClear.classList.toggle('show',hasFilter);
    fslist.textContent='';
    if(!filteredEntries.length){
      var emptyText=query?'No folders match “'+fsSearch.value.trim()+'”.':'No subfolders here.';
      fslist.appendChild(el('div','fsempty',emptyText));
    }
    filteredEntries.forEach(function(en,index){
      var row=el('button','fsrow'); row.type='button';row.tabIndex=-1;row.setAttribute('role','option');row.setAttribute('aria-selected',index===selectedIndex?'true':'false');
      row.id='fs-entry-'+index;
      var fi=el('span','fi'); fi.appendChild(ico('ico-folder')); row.appendChild(fi);
      row.appendChild(el('span','fn',en.name));
      if(en.isGit){ row.appendChild(el('span','repo','repo')); }
      else { var go=el('span','go'); go.appendChild(ico('ico-go')); row.appendChild(go); }
      if(index===selectedIndex)row.classList.add('is-selected');
      row.addEventListener('mouseenter',function(){ selectEntry(index,false); });
      row.addEventListener('click',function(){ activateEntry(en); });
      fslist.appendChild(row);
    });
    updateSelection(false);
    fsSearchStatus.textContent=filteredEntries.length+' folder'+(filteredEntries.length===1?'':'s')+' shown.';
  }
  function updateSelection(scroll){
    var rows=fslist.querySelectorAll('.fsrow');
    rows.forEach(function(row,index){var selected=index===selectedIndex;row.classList.toggle('is-selected',selected);row.setAttribute('aria-selected',selected?'true':'false');});
    if(selectedIndex<0||!rows[selectedIndex]){fsSearch.removeAttribute('aria-activedescendant');return;}
    fsSearch.setAttribute('aria-activedescendant',rows[selectedIndex].id);
    if(scroll)rows[selectedIndex].scrollIntoView({block:'nearest'});
  }
  function selectEntry(index,scroll){selectedIndex=index;updateSelection(scroll);}
  function moveSelection(delta){
    if(!filteredEntries.length)return;
    if(selectedIndex<0)selectedIndex=delta>0?0:filteredEntries.length-1;
    else selectedIndex=(selectedIndex+delta+filteredEntries.length)%filteredEntries.length;
    updateSelection(true);
  }
  fsSearch.addEventListener('input',function(){selectedIndex=fsSearch.value.trim()?0:-1;renderEntries();});
  fsSearch.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();moveSelection(e.key==='ArrowDown'?1:-1);return;}
    if(e.key==='Home'||e.key==='End'){e.preventDefault();selectEntry(e.key==='Home'?0:filteredEntries.length-1,true);return;}
    if(e.key==='Enter'&&selectedIndex>=0&&filteredEntries[selectedIndex]){e.preventDefault();activateEntry(filteredEntries[selectedIndex]);return;}
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeModal();}
  });
  fsClear.addEventListener('click',function(){fsSearch.value='';selectedIndex=-1;renderEntries();fsSearch.focus();});
  function setModalBackground(blocked){
    if(!modalBackground)return;
    if(blocked){modalBackground.setAttribute('inert','');modalBackground.setAttribute('aria-hidden','true');}
    else{modalBackground.removeAttribute('inert');modalBackground.removeAttribute('aria-hidden');}
  }
  function modalFocusables(){
    return [].slice.call(scrim.querySelectorAll('button:not([disabled]),input:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')).filter(function(node){return !node.hidden&&node.getAttribute('aria-hidden')!=='true'&&node.getAttribute('tabindex')!=='-1';});
  }
  function trapModalFocus(e){
    if(scrim.hidden)return;
    if(e.key==='Escape'){e.preventDefault();closeModal();return;}
    if(e.key!=='Tab')return;
    var items=modalFocusables();if(!items.length){e.preventDefault();scrim.focus();return;}
    var first=items[0],last=items[items.length-1],active=document.activeElement;
    if(e.shiftKey&&(active===first||!scrim.contains(active))){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&(active===last||!scrim.contains(active))){e.preventDefault();first.focus();}
  }
  function openModal(e){
    if(!scrim.hidden&&!modalCloseTimer)return;
    if(modalCloseTimer){clearTimeout(modalCloseTimer);modalCloseTimer=0;}
    modalTrigger=e&&e.currentTarget?e.currentTarget:document.activeElement;
    scrim.hidden=false;setModalBackground(true);fsSearch.setAttribute('aria-expanded','true');browse(null);fsSearch.focus();
    requestAnimationFrame(function(){if(!scrim.hidden)scrim.classList.add('show');});
  }
  function closeModal(){
    if(scrim.hidden||modalCloseTimer)return;
    scrim.classList.remove('show');setModalBackground(false);fsSearch.value='';fsSearch.setAttribute('aria-expanded','false');fsSearch.removeAttribute('aria-activedescendant');fsClear.hidden=true;fsClear.classList.remove('show');
    var restore=modalTrigger;modalTrigger=null;if(restore&&restore.focus)restore.focus();
    var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    modalCloseTimer=setTimeout(function(){modalCloseTimer=0;if(!scrim.classList.contains('show'))scrim.hidden=true;},reduced?0:210);
  }
  document.getElementById('quickAddBtn').addEventListener('click',openModal);
  document.getElementById('fsClose').addEventListener('click',closeModal);
  scrim.addEventListener('click',function(e){ if(e.target===scrim) closeModal(); });
  document.addEventListener('keydown',trapModalFocus);
  openHere.addEventListener('click',function(){ if(curGit) open(cur); });
})();
</script>
</body></html>`;
}
