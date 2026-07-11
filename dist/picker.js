// The diffStory app picker — the front door you see when you open the app with no
// repo. Styled to Apple's HIG: SF Pro, semantic system colors, continuous corners,
// light + dark, reduced-motion aware. A browser can't read a path back from the OS
// file dialog, so the "Choose a folder" control drives a server-backed directory
// browser (GET /api/fs) instead. Self-contained; every server value is escaped.
import { APP_BRAND } from './config.js';
import { BRAND_HEAD_LINKS, brandMarkSvg } from './brand.js';
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
function statusPill(r) {
    // Tour status is an internal concept and confused users — don't surface it here.
    // Only flag a recent whose folder is gone / no longer a git repo.
    if (!r.isGit)
        return `<span class="pill pill-missing">Missing</span>`;
    return '';
}
function recentCard(r, home, now) {
    const meta = [];
    if (r.isGit && r.currentBranch)
        meta.push(`<span class="meta">${ICON_BRANCH}${esc(r.currentBranch)}</span>`);
    if (r.isGit && r.changedFiles > 0)
        meta.push(`<span class="meta">${r.changedFiles} changed file${r.changedFiles === 1 ? '' : 's'}</span>`);
    meta.push(`<span class="meta">${esc(relativeTime(r.lastOpened, now))}</span>`);
    return (`<div class="repo-row${r.isGit ? '' : ' repo-row-missing'}">` +
        `<button class="repo-card" data-open="${esc(r.path)}" type="button">` +
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
    const list = recents.length
        ? recents.map((r) => recentCard(r, home, now)).join('')
        : `<div class="empty"><span class="empty-mark">${ICON_FOLDER}</span><p class="empty-title">No repositories yet</p><p class="empty-sub">Choose a folder below to start your first guided review.</p></div>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${BRAND_HEAD_LINKS}
<title>${esc(APP_BRAND)} — pick a repo</title>
<style>
:root{
  --bg:#f4f5f7; --bg-rail:#e9ebef; --bg-elev:#ffffff; --label:#17181c; --label2:#61656f; --label3:#8a8f9b;
  --sep:rgba(20,24,32,.09); --hairline:rgba(20,24,32,.12); --hover:rgba(0,0,0,.045);
  --blue:#007aff; --blue-press:#0067d6; --green-bg:#e2f6e9; --green-fg:#16783a;
  --neutral-bg:rgba(95,99,109,.12); --neutral-fg:#656a75; --red-bg:#fde9e7; --red-fg:#bd2a22;
  --tile:rgba(0,122,255,.10); --tile-fg:#007aff; --scrim:rgba(0,0,0,.36); --sheet:#ffffff;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#17181b; --bg-rail:#202226; --bg-elev:#24262b; --label:#f5f6f8; --label2:#b3b7c0; --label3:#858b97;
  --sep:rgba(255,255,255,.09); --hairline:rgba(255,255,255,.13); --hover:rgba(255,255,255,.06);
  --blue:#0a84ff; --blue-press:#3395ff; --green-bg:rgba(53,199,89,.16); --green-fg:#35c759;
  --neutral-bg:rgba(127,132,145,.22); --neutral-fg:#aeb4bf; --red-bg:rgba(255,69,58,.18); --red-fg:#ff6961;
  --tile:rgba(10,132,255,.18); --tile-fg:#0a84ff; --scrim:rgba(0,0,0,.55); --sheet:#25272c;
}}
*{box-sizing:border-box}
html,body{margin:0}
body{
  background:var(--bg); color:var(--label); min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; letter-spacing:0;
}
.wrap{width:min(1080px,100%); margin:0 auto; padding:44px 24px 64px; display:grid; grid-template-columns:minmax(250px,320px) minmax(0,1fr); gap:34px; align-items:start}
.hero{position:sticky; top:28px; min-height:calc(100vh - 88px); display:flex; flex-direction:column; justify-content:space-between; gap:34px}
.head{display:flex; align-items:center; gap:14px; margin-bottom:14px}
.appicon{width:54px; height:54px; border-radius:14px; flex:none;
  background:#007aff;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 4px 14px rgba(0,90,200,.30), inset 0 1px 0 rgba(255,255,255,.28);}
.appmark{display:block;--ds-brand-path:#fff;--ds-brand-node-a:#fff;--ds-brand-node-b:#d6e9ff;--ds-brand-node-c:#fff}
h1{font-size:30px; line-height:1.05; font-weight:700; margin:0; letter-spacing:-.022em}
.sub{color:var(--label2); font-size:15px; margin:0; max-width:31ch; line-height:1.5}
.manager{min-width:0}
.launchwarn{margin:0 0 18px;padding:10px 12px;border:.5px solid rgba(255,159,10,.42);border-radius:8px;background:rgba(255,159,10,.13);color:var(--label);font-size:12.5px;line-height:1.45;display:flex;align-items:center;gap:10px}
.launchwarn[hidden]{display:none}
.launchwarn span{flex:1;min-width:0}
.skillfix{flex:none;font:inherit;font-size:12px;font-weight:650;color:#fff;background:var(--blue);border:none;border-radius:8px;padding:6px 10px;cursor:pointer}
.skillfix:hover{background:var(--blue-press)}.skillfix:disabled{opacity:.55;cursor:default}
.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:2px 0 14px}
.section{font-size:12px;font-weight:700;color:var(--label3);margin:0 0 5px;text-transform:uppercase;letter-spacing:.08em}
h2{font-size:24px;line-height:1.1;font-weight:720;margin:0;letter-spacing:-.018em}
.add-btn{height:36px;padding:0 13px;display:inline-flex;align-items:center;gap:7px;border:none;border-radius:8px;background:var(--blue);color:#fff;font:inherit;font-size:13px;font-weight:650;cursor:pointer;box-shadow:0 1px 2px rgba(0,40,120,.18)}
.add-btn:hover{background:var(--blue-press)}
.stack>*+*{margin-top:8px}
.repo-card,.fsrow{font:inherit; color:inherit; cursor:pointer}
.repo-row{display:grid;grid-template-columns:minmax(0,1fr) 38px;gap:8px;align-items:stretch}
.repo-card{width:100%; display:flex; align-items:center; gap:13px; text-align:left;
  background:var(--bg-elev); border:.5px solid var(--hairline); border-radius:8px; padding:13px 14px;
  box-shadow:0 1px 2px rgba(0,0,0,.04); transition:transform .14s ease, background .14s ease, box-shadow .14s ease;}
.repo-card:hover{background:linear-gradient(0deg,var(--hover),var(--hover)),var(--bg-elev); box-shadow:0 3px 12px rgba(0,0,0,.08)}
.repo-card:active{transform:scale(.992)}
.repo-card:focus-visible,.chooser:focus-visible,.add-btn:focus-visible,.remove-btn:focus-visible{outline:none; box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 38%,transparent)}
.repo-row-missing{opacity:.68}
.remove-btn{width:38px;border:.5px solid var(--hairline);border-radius:8px;background:var(--bg-elev);color:var(--label3);display:flex;align-items:center;justify-content:center;cursor:pointer}
.remove-btn:hover{background:var(--red-bg);color:var(--red-fg)}
.tile{width:38px; height:38px; border-radius:8px; flex:none; background:var(--tile); color:var(--tile-fg);
  display:flex; align-items:center; justify-content:center}
.repo-row-missing .tile{background:var(--neutral-bg); color:var(--neutral-fg)}
.card-body{flex:1; min-width:0; display:flex; flex-direction:column; gap:3px}
.card-top{display:flex; align-items:center; gap:8px}
.name{font-size:15px; font-weight:590; letter-spacing:-.012em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.path{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:12px; color:var(--label2);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.card-meta{display:flex; align-items:center; flex-wrap:wrap; gap:7px; color:var(--label3); font-size:12px; margin-top:1px}
.meta{display:inline-flex; align-items:center; gap:4px}
.meta svg{opacity:.8}
.dot{color:var(--label3); opacity:.6}
.chev{color:var(--label3); flex:none; display:flex; opacity:.55}
.pill{font-size:11px; font-weight:600; padding:2px 8px; border-radius:100px; flex:none}
.pill-ready{background:var(--green-bg); color:var(--green-fg)}
.pill-none{background:var(--neutral-bg); color:var(--neutral-fg)}
.pill-missing{background:var(--red-bg); color:var(--red-fg)}
.empty{text-align:center; padding:30px 16px; border:.5px dashed var(--hairline); border-radius:8px; color:var(--label2)}
.empty-mark{display:inline-flex; width:44px; height:44px; border-radius:8px; align-items:center; justify-content:center;
  background:var(--neutral-bg); color:var(--label3); margin-bottom:10px}
.empty-title{font-size:15px; font-weight:600; color:var(--label); margin:0 0 2px}
.empty-sub{font-size:13px; margin:0}
.open{margin-top:18px;padding-top:18px;border-top:.5px solid var(--sep)}
.quick-open{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
.chooser{width:100%; display:flex; align-items:center; gap:11px; text-align:left; margin-top:10px;
  background:transparent; border:.5px solid var(--hairline); border-radius:8px; padding:11px 12px;
  transition:background .14s ease, box-shadow .14s ease}
.chooser:hover{background:linear-gradient(0deg,var(--hover),var(--hover)),var(--bg-elev); box-shadow:0 3px 12px rgba(0,0,0,.08)}
.chooser .tile{background:var(--tile); color:var(--tile-fg)}
.chooser .ctext{flex:1}
.chooser .ct1{display:block;font-size:13.5px; font-weight:650; color:var(--label)}
.chooser .ct2{display:block;font-size:12.5px; color:var(--label2); margin-top:1px}
.orpaste{display:flex; gap:10px; align-items:center; margin-top:12px}
input[type=text],input[type=search]{width:100%;height:36px; padding:0 12px; font:inherit; font-size:13px; color:var(--label);
  background:var(--bg-elev); border:.5px solid var(--hairline); border-radius:8px; outline:none;
  box-shadow:0 1px 2px rgba(0,0,0,.04); transition:box-shadow .14s ease, border-color .14s ease;}
input[type=text]::placeholder,input[type=search]::placeholder{color:var(--label3)}
input[type=text]:focus,input[type=search]:focus{border-color:transparent; box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 36%,transparent)}
.btn{height:36px; padding:0 16px; font:inherit; font-size:13.5px; font-weight:590; color:#fff; cursor:pointer;
  background:var(--blue); border:none; border-radius:8px; letter-spacing:0;
  box-shadow:0 1px 2px rgba(0,40,120,.18); transition:background .14s ease, transform .1s ease}
.btn:hover{background:var(--blue-press)}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.4; cursor:default; box-shadow:none}
.btn:focus-visible{outline:none; box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 40%,transparent)}
.ghost{height:36px; padding:0 16px; font:inherit; font-size:13.5px; font-weight:550; color:var(--label);
  background:transparent; border:.5px solid var(--hairline); border-radius:8px; cursor:pointer}
.ghost:hover{background:var(--hover)}
.msg{min-height:18px; margin:10px 2px 0; font-size:13px; color:var(--red-fg)}
.steps{display:grid; gap:14px; padding-top:20px; border-top:.5px solid var(--sep)}
.step{display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;align-items:start}
.step-n{display:inline-flex; width:20px; height:20px; border-radius:50%; align-items:center; justify-content:center;
  background:var(--neutral-bg); color:var(--label2); font-size:11px; font-weight:700; margin-top:1px}
.step-t{font-size:13px; font-weight:600; margin:0 0 2px}
.step-d{font-size:12px; color:var(--label2); margin:0; line-height:1.4}
.scrim{position:fixed; inset:0; background:var(--scrim); display:none; align-items:center; justify-content:center;
  padding:20px; z-index:50}
.scrim.show{display:flex}
.sheet{width:100%; max-width:560px; max-height:76vh; display:flex; flex-direction:column; overflow:hidden;
  background:var(--sheet); border:.5px solid var(--hairline); border-radius:10px; box-shadow:0 24px 70px rgba(0,0,0,.34)}
.sheet-head{display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:.5px solid var(--sep)}
.sheet-title{font-size:15px; font-weight:640; flex:1}
.iconbtn{width:28px; height:28px; border-radius:8px; border:none; background:var(--neutral-bg); color:var(--label2);
  display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:17px; line-height:1}
.iconbtn:hover{background:var(--hover)}
.crumbs{display:flex; align-items:center; flex-wrap:wrap; gap:2px; padding:9px 16px; border-bottom:.5px solid var(--sep);
  font-size:12.5px; color:var(--label2)}
.crumb{background:none; border:none; font:inherit; color:var(--blue); cursor:pointer; padding:2px 5px; border-radius:6px}
.crumb:hover{background:var(--hover)}
.crumb.cur{color:var(--label); font-weight:590; cursor:default}
.crumb-sep{color:var(--label3); opacity:.6}
.fssearch{padding:10px 16px;border-bottom:.5px solid var(--sep)}
.fssearch-box{position:relative;display:flex;align-items:center}
.fssearch-icon{position:absolute;left:11px;color:var(--label3);display:flex;pointer-events:none}
.fssearch input{height:34px;padding-left:35px;padding-right:34px;background:var(--bg);box-shadow:none}
.fssearch input::-webkit-search-cancel-button{-webkit-appearance:none}
.fsclear{position:absolute;right:6px;width:23px;height:23px;border:0;border-radius:6px;background:var(--neutral-bg);color:var(--label2);font:inherit;font-size:13px;line-height:1;cursor:pointer;display:none;align-items:center;justify-content:center}
.fsclear.show{display:flex}
.fsclear:hover{background:var(--hover)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.fslist{overflow-y:auto; padding:6px; flex:1; min-height:120px}
.fsrow{width:100%; display:flex; align-items:center; gap:11px; padding:9px 10px; border-radius:8px; background:none; border:none}
.fsrow:hover{background:var(--hover)}
.fsrow.is-selected{background:var(--hover);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--blue) 42%,transparent)}
.fsrow:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--blue)}
.fsrow .fi{color:var(--blue); display:flex; flex:none}
.fsrow .fn{flex:1; min-width:0; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:left}
.fsrow .repo{font-size:11px; font-weight:600; padding:1px 7px; border-radius:100px; background:var(--green-bg); color:var(--green-fg)}
.fsrow .go{color:var(--label3); opacity:.5; display:flex; flex:none}
.fsempty{padding:26px; text-align:center; color:var(--label3); font-size:13px}
.sheet-foot{display:flex; align-items:center; gap:10px; padding:13px 16px; border-top:.5px solid var(--sep)}
.foot-path{flex:1; min-width:0; font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:11.5px; color:var(--label3);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
@media (prefers-reduced-motion:no-preference){
  .reveal{opacity:0; transform:translateY(8px); animation:up .5s cubic-bezier(.22,.61,.36,1) forwards}
  .d1{animation-delay:.02s}.d2{animation-delay:.09s}.d3{animation-delay:.16s}.d4{animation-delay:.23s}
  @keyframes up{to{opacity:1; transform:none}}
}
@media (max-width:760px){
  .wrap{display:block;padding:28px 16px 54px}
  .hero{position:static;min-height:0;margin-bottom:28px}
  .sub{max-width:44ch}
  .quick-open{grid-template-columns:1fr}
  .add-btn span{display:none}
}
</style></head>
<body>
<main class="wrap">
  <section class="hero reveal d1">
    <div>
      <div class="head">
        <span class="appicon" aria-hidden="true">${ICON_MARK}</span>
        <div><h1>${esc(APP_BRAND)}</h1></div>
      </div>
      <p class="sub">Open a repo, generate a short story, then review the actual diff in the order the change wants to be read.</p>
    </div>

    <section class="steps" aria-label="How it works">
      <div class="step"><span class="step-n">1</span><span><p class="step-t">Make changes</p><p class="step-d">Let your agent edit code as usual.</p></span></div>
      <div class="step"><span class="step-n">2</span><span><p class="step-t">Generate the story</p><p class="step-d">Save a guided reading order for the current diff.</p></span></div>
      <div class="step"><span class="step-n">3</span><span><p class="step-t">Walk the diff</p><p class="step-d">Read, comment, and send fixes back inline.</p></span></div>
    </section>
  </section>

  <section class="manager reveal d2">
    <p class="launchwarn" id="skillWarn" hidden><span id="skillWarnText"></span><button class="skillfix" id="skillUpdateBtn" type="button">Update skills</button></p>
    <div class="section-head">
      <div><p class="section">Repositories</p><h2>Choose your workspace</h2></div>
      <button class="add-btn" id="quickAddBtn" type="button">${ICON_PLUS}<span>Add repo</span></button>
    </div>
    <div class="stack" id="recent">${list}</div>

    <div class="open">
      <div class="quick-open">
        <input type="text" id="path" placeholder="Paste a repository path" autocomplete="off" spellcheck="false" aria-label="Open by path" />
        <button class="btn" id="openBtn" type="button">Open</button>
      </div>
    <button class="chooser" id="chooseBtn" type="button">
      <span class="tile" aria-hidden="true">${ICON_FOLDER}</span>
      <span class="ctext"><span class="ct1">Browse folders</span><span class="ct2">Pick a local git repository from your machine</span></span>
      <span class="chev" aria-hidden="true">${ICON_CHEVRON}</span>
    </button>
      <p class="msg" id="msg" role="status"></p>
    </div>
  </section>
</main>

<div class="scrim" id="scrim" role="dialog" aria-modal="true" aria-label="Choose a repository folder">
  <div class="sheet">
    <div class="sheet-head">
      <span class="sheet-title">Open a repository</span>
      <button class="iconbtn" id="fsClose" type="button" aria-label="Close">✕</button>
    </div>
    <div class="crumbs" id="crumbs"></div>
    <div class="fssearch">
      <div class="fssearch-box">
        <span class="fssearch-icon" aria-hidden="true">${ICON_SEARCH}</span>
        <input type="search" id="fsSearch" placeholder="Filter folders" autocomplete="off" spellcheck="false" aria-label="Filter folders in this location" aria-controls="fslist" />
        <button class="fsclear" id="fsClear" type="button" aria-label="Clear folder filter">✕</button>
      </div>
      <span class="sr-only" id="fsSearchStatus" role="status" aria-live="polite"></span>
    </div>
    <div class="fslist" id="fslist"></div>
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
    return '<div class="empty"><span class="empty-mark">'+document.getElementById('ico-folder').innerHTML+'</span><p class="empty-title">No repositories yet</p><p class="empty-sub">Add a local git repo to start your first guided review.</p></div>';
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
  var input=document.getElementById('path');
  document.getElementById('openBtn').addEventListener('click',function(){ open(input.value.trim()); });
  input.addEventListener('keydown',function(e){ if(e.key==='Enter') open(input.value.trim()); });

  var scrim=document.getElementById('scrim'), fslist=document.getElementById('fslist'),
      crumbs=document.getElementById('crumbs'), footPath=document.getElementById('footPath'),
      openHere=document.getElementById('openHere'), fsSearch=document.getElementById('fsSearch'),
      fsClear=document.getElementById('fsClear'), fsSearchStatus=document.getElementById('fsSearchStatus'),
      cur=null, curGit=false, entries=[], filteredEntries=[], selectedIndex=-1, modalTrigger=null;
  function el(tag,cls,txt){ var n=document.createElement(tag); if(cls) n.className=cls; if(txt!=null) n.textContent=txt; return n; }
  function ico(id){ return document.getElementById(id).content.cloneNode(true); }

  function browse(path){
    fsSearch.value=''; fsClear.classList.remove('show'); entries=[]; filteredEntries=[]; selectedIndex=-1;
    fsSearch.removeAttribute('aria-activedescendant'); fsSearchStatus.textContent='';
    fslist.textContent='Loading…';
    fslist.className='fslist'; fslist.style.color='var(--label3)'; fslist.style.padding='26px';
    fetch('/api/fs'+(path?('?path='+encodeURIComponent(path)):''))
      .then(function(r){return r.json();}).then(render)
      .catch(function(){ fslist.textContent='Could not read that folder.'; });
  }
  function crumbFor(p){ var b=el('button','crumb',p.label);
    if(p.cur){ b.classList.add('cur'); } else { b.addEventListener('click',function(){browse(p.path);}); } return b; }

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
    fsClear.classList.toggle('show',!!fsSearch.value);
    fslist.textContent='';
    if(!filteredEntries.length){
      var emptyText=query?'No folders match “'+fsSearch.value.trim()+'”.':'No subfolders here.';
      fslist.appendChild(el('div','fsempty',emptyText));
    }
    filteredEntries.forEach(function(en,index){
      var row=el('button','fsrow'); row.type='button';
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
    rows.forEach(function(row,index){row.classList.toggle('is-selected',index===selectedIndex);});
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
    if(e.key==='Enter'&&selectedIndex>=0&&filteredEntries[selectedIndex]){e.preventDefault();activateEntry(filteredEntries[selectedIndex]);return;}
    if(e.key==='Escape'&&fsSearch.value){e.preventDefault();e.stopPropagation();fsSearch.value='';selectedIndex=-1;renderEntries();}
  });
  fsClear.addEventListener('click',function(){fsSearch.value='';selectedIndex=-1;renderEntries();fsSearch.focus();});
  function openModal(e){ modalTrigger=e&&e.currentTarget?e.currentTarget:document.activeElement; scrim.classList.add('show'); browse(null); fsSearch.focus(); }
  function closeModal(){ scrim.classList.remove('show'); fsSearch.value=''; if(modalTrigger&&modalTrigger.focus)modalTrigger.focus(); modalTrigger=null; }
  document.getElementById('quickAddBtn').addEventListener('click',openModal);
  document.getElementById('chooseBtn').addEventListener('click',openModal);
  document.getElementById('fsClose').addEventListener('click',closeModal);
  scrim.addEventListener('click',function(e){ if(e.target===scrim) closeModal(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeModal(); });
  openHere.addEventListener('click',function(){ if(curGit) open(cur); });
})();
</script>
</body></html>`;
}
