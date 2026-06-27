// The diffStory app picker — the front door you see when you open the app with no
// repo. Styled to Apple's HIG: SF Pro, semantic system colors, continuous corners,
// light + dark, reduced-motion aware. A browser can't read a path back from the OS
// file dialog, so the "Choose a folder" control drives a server-backed directory
// browser (GET /api/fs) instead. Self-contained; every server value is escaped.
import { APP_BRAND } from './config.js';

export interface RecentRow {
  path: string;
  name: string;
  isGit: boolean;
  hasTour: boolean;
  currentBranch: string | null;
  changedFiles: number;
  lastOpened: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Home-relative, middle-truncated path for compact display (full path stays in the title). */
function prettyPath(p: string, home: string): string {
  let s = home && p.startsWith(home) ? '~' + p.slice(home.length) : p;
  if (s.length > 46) s = s.slice(0, 16) + '…' + s.slice(-27);
  return s;
}

function relativeTime(then: number, now: number): string {
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? 'yesterday' : `${day} days ago`;
}

const ICON_FOLDER =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.2h7A1.5 1.5 0 0 1 19 9.7v7.8A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5z"/></svg>';
const ICON_BRANCH =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="7" r="2.2"/><path d="M6 7.2v9.6M18 9.2c0 4.2-3.4 4.8-6 5.4"/></svg>';
const ICON_CHEVRON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const ICON_MARK =
  '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h9l5 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z"/><path d="M13.5 4.5V10H19"/><path d="M7.5 14h6M7.5 17h4"/></svg>';

function statusPill(r: RecentRow): string {
  // Tour status is an internal concept and confused users — don't surface it here.
  // Only flag a recent whose folder is gone / no longer a git repo.
  if (!r.isGit) return `<span class="pill pill-missing">Missing</span>`;
  return '';
}

function recentCard(r: RecentRow, home: string, now: number): string {
  const meta: string[] = [];
  if (r.isGit && r.currentBranch) meta.push(`<span class="meta">${ICON_BRANCH}${esc(r.currentBranch)}</span>`);
  if (r.isGit && r.changedFiles > 0)
    meta.push(`<span class="meta">${r.changedFiles} changed file${r.changedFiles === 1 ? '' : 's'}</span>`);
  meta.push(`<span class="meta">${esc(relativeTime(r.lastOpened, now))}</span>`);

  return (
    `<button class="card${r.isGit ? '' : ' card-missing'}" data-open="${esc(r.path)}" type="button">` +
    `<span class="tile">${ICON_FOLDER}</span>` +
    `<span class="card-body">` +
    `<span class="card-top"><span class="name">${esc(r.name)}</span>${statusPill(r)}</span>` +
    `<span class="path" title="${esc(r.path)}">${esc(prettyPath(r.path, home))}</span>` +
    `<span class="card-meta">${meta.join('<span class="dot">·</span>')}</span>` +
    `</span>` +
    `<span class="chev" aria-hidden="true">${ICON_CHEVRON}</span>` +
    `</button>`
  );
}

export function renderPicker(recents: RecentRow[], home: string, now: number): string {
  const list = recents.length
    ? recents.map((r) => recentCard(r, home, now)).join('')
    : `<div class="empty"><span class="empty-mark">${ICON_FOLDER}</span><p class="empty-title">No repositories yet</p><p class="empty-sub">Choose a folder below to start your first guided review.</p></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(APP_BRAND)} — pick a repo</title>
<style>
:root{
  --bg:#f5f5f7; --bg-elev:#ffffff; --label:#1d1d1f; --label2:#6e6e73; --label3:#8e8e93;
  --sep:rgba(0,0,0,.08); --hairline:rgba(0,0,0,.10); --hover:rgba(0,0,0,.04);
  --blue:#007aff; --blue-press:#0067d6; --green-bg:#e3f7ea; --green-fg:#1d7d3f;
  --neutral-bg:rgba(120,120,128,.14); --neutral-fg:#6e6e73; --red-bg:#fde8e7; --red-fg:#c4271f;
  --tile:rgba(0,122,255,.10); --tile-fg:#007aff; --scrim:rgba(0,0,0,.32); --sheet:#ffffff;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#1c1c1e; --bg-elev:#2c2c2e; --label:#f5f5f7; --label2:#aeaeb2; --label3:#8e8e93;
  --sep:rgba(255,255,255,.10); --hairline:rgba(255,255,255,.12); --hover:rgba(255,255,255,.06);
  --blue:#0a84ff; --blue-press:#3395ff; --green-bg:rgba(48,209,88,.16); --green-fg:#30d158;
  --neutral-bg:rgba(120,120,128,.24); --neutral-fg:#aeaeb2; --red-bg:rgba(255,69,58,.18); --red-fg:#ff6961;
  --tile:rgba(10,132,255,.18); --tile-fg:#0a84ff; --scrim:rgba(0,0,0,.5); --sheet:#2c2c2e;
}}
*{box-sizing:border-box}
html,body{margin:0}
body{
  background:var(--bg); color:var(--label); min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; letter-spacing:-.01em;
}
.wrap{max-width:680px; margin:0 auto; padding:56px 24px 72px}
.head{display:flex; align-items:center; gap:15px; margin-bottom:6px}
.appicon{width:54px; height:54px; border-radius:14px; flex:none;
  background:linear-gradient(160deg,#3aa0ff,#007aff 64%,#0060df);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 4px 14px rgba(0,90,200,.30), inset 0 1px 0 rgba(255,255,255,.28);}
h1{font-size:30px; line-height:1.05; font-weight:700; margin:0; letter-spacing:-.022em}
.sub{color:var(--label2); font-size:15px; margin:14px 0 30px; max-width:48ch; line-height:1.45}
.launchwarn{max-width:620px;margin:-12px 0 28px;padding:10px 12px;border:.5px solid rgba(255,159,10,.42);border-radius:10px;background:rgba(255,159,10,.13);color:var(--label);font-size:12.5px;line-height:1.45;display:flex;align-items:center;gap:10px}
.launchwarn[hidden]{display:none}
.launchwarn span{flex:1;min-width:0}
.skillfix{flex:none;font:inherit;font-size:12px;font-weight:650;color:#fff;background:var(--blue);border:none;border-radius:8px;padding:6px 10px;cursor:pointer}
.skillfix:hover{background:var(--blue-press)}.skillfix:disabled{opacity:.55;cursor:default}
.section{font-size:13px; font-weight:600; color:var(--label3); margin:0 0 10px 2px}
.stack>*+*{margin-top:8px}
.card,.fsrow{font:inherit; color:inherit; cursor:pointer}
.card{width:100%; display:flex; align-items:center; gap:13px; text-align:left;
  background:var(--bg-elev); border:.5px solid var(--hairline); border-radius:14px; padding:13px 14px;
  box-shadow:0 1px 2px rgba(0,0,0,.04); transition:transform .14s ease, background .14s ease, box-shadow .14s ease;}
.card:hover{background:linear-gradient(0deg,var(--hover),var(--hover)),var(--bg-elev); box-shadow:0 3px 12px rgba(0,0,0,.08)}
.card:active{transform:scale(.992)}
.card:focus-visible,.chooser:focus-visible{outline:none; box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 38%,transparent)}
.card-missing{opacity:.62}
.tile{width:38px; height:38px; border-radius:10px; flex:none; background:var(--tile); color:var(--tile-fg);
  display:flex; align-items:center; justify-content:center}
.card-missing .tile{background:var(--neutral-bg); color:var(--neutral-fg)}
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
.empty{text-align:center; padding:34px 16px; border:.5px dashed var(--hairline); border-radius:14px; color:var(--label2)}
.empty-mark{display:inline-flex; width:46px; height:46px; border-radius:12px; align-items:center; justify-content:center;
  background:var(--neutral-bg); color:var(--label3); margin-bottom:10px}
.empty-title{font-size:15px; font-weight:600; color:var(--label); margin:0 0 2px}
.empty-sub{font-size:13px; margin:0}
.open{margin-top:30px}
.chooser{width:100%; display:flex; align-items:center; gap:13px; text-align:left; margin-top:10px;
  background:var(--bg-elev); border:.5px solid var(--hairline); border-radius:14px; padding:14px;
  box-shadow:0 1px 2px rgba(0,0,0,.04); transition:background .14s ease, box-shadow .14s ease}
.chooser:hover{background:linear-gradient(0deg,var(--hover),var(--hover)),var(--bg-elev); box-shadow:0 3px 12px rgba(0,0,0,.08)}
.chooser .tile{background:var(--tile); color:var(--tile-fg)}
.chooser .ctext{flex:1}
.chooser .ct1{font-size:15px; font-weight:590; color:var(--label)}
.chooser .ct2{font-size:12.5px; color:var(--label2); margin-top:1px}
.orpaste{display:flex; gap:10px; align-items:center; margin-top:12px}
input[type=text]{flex:1; height:34px; padding:0 12px; font:inherit; font-size:13px; color:var(--label);
  background:var(--bg-elev); border:.5px solid var(--hairline); border-radius:9px; outline:none;
  box-shadow:0 1px 2px rgba(0,0,0,.04); transition:box-shadow .14s ease, border-color .14s ease;}
input[type=text]::placeholder{color:var(--label3)}
input[type=text]:focus{border-color:transparent; box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 36%,transparent)}
.btn{height:36px; padding:0 16px; font:inherit; font-size:13.5px; font-weight:590; color:#fff; cursor:pointer;
  background:var(--blue); border:none; border-radius:9px; letter-spacing:-.01em;
  box-shadow:0 1px 2px rgba(0,40,120,.18); transition:background .14s ease, transform .1s ease}
.btn:hover{background:var(--blue-press)}
.btn:active{transform:scale(.97)}
.btn:disabled{opacity:.4; cursor:default; box-shadow:none}
.btn:focus-visible{outline:none; box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 40%,transparent)}
.ghost{height:36px; padding:0 16px; font:inherit; font-size:13.5px; font-weight:550; color:var(--label);
  background:transparent; border:.5px solid var(--hairline); border-radius:9px; cursor:pointer}
.ghost:hover{background:var(--hover)}
.msg{min-height:18px; margin:10px 2px 0; font-size:13px; color:var(--red-fg)}
.steps{display:flex; gap:18px; margin-top:34px; padding-top:22px; border-top:.5px solid var(--sep)}
.step{flex:1}
.step-n{display:inline-flex; width:20px; height:20px; border-radius:50%; align-items:center; justify-content:center;
  background:var(--neutral-bg); color:var(--label2); font-size:11px; font-weight:700; margin-bottom:7px}
.step-t{font-size:13px; font-weight:600; margin:0 0 2px}
.step-d{font-size:12px; color:var(--label2); margin:0; line-height:1.4}
.scrim{position:fixed; inset:0; background:var(--scrim); display:none; align-items:center; justify-content:center;
  padding:20px; z-index:50}
.scrim.show{display:flex}
.sheet{width:100%; max-width:540px; max-height:74vh; display:flex; flex-direction:column; overflow:hidden;
  background:var(--sheet); border:.5px solid var(--hairline); border-radius:16px; box-shadow:0 24px 70px rgba(0,0,0,.34)}
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
.fslist{overflow-y:auto; padding:6px; flex:1; min-height:120px}
.fsrow{width:100%; display:flex; align-items:center; gap:11px; padding:9px 10px; border-radius:9px; background:none; border:none}
.fsrow:hover{background:var(--hover)}
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
@media (max-width:560px){.steps{flex-direction:column; gap:14px}}
</style></head>
<body>
<main class="wrap">
  <div class="head reveal d1">
    <span class="appicon" aria-hidden="true">${ICON_MARK}</span>
    <div><h1>${esc(APP_BRAND)}</h1></div>
  </div>
  <p class="sub reveal d1">The agent that wrote the code walks you through its change — in reading order, not by filename. Open a repository to begin.</p>
  <p class="launchwarn reveal d1" id="skillWarn" hidden><span id="skillWarnText"></span><button class="skillfix" id="skillUpdateBtn" type="button">Update skills</button></p>

  <section class="reveal d2">
    <p class="section">Recent</p>
    <div class="stack" id="recent">${list}</div>
  </section>

  <section class="open reveal d3">
    <p class="section">Open a repository</p>
    <button class="chooser" id="chooseBtn" type="button">
      <span class="tile" aria-hidden="true">${ICON_FOLDER}</span>
      <span class="ctext"><span class="ct1">Choose a folder…</span><span class="ct2">Browse your machine and pick a git repo</span></span>
      <span class="chev" aria-hidden="true">${ICON_CHEVRON}</span>
    </button>
    <div class="orpaste">
      <input type="text" id="path" placeholder="…or paste a path" autocomplete="off" spellcheck="false" aria-label="Open by path" />
      <button class="btn" id="openBtn" type="button">Open</button>
    </div>
    <p class="msg" id="msg" role="status"></p>
  </section>

  <section class="steps reveal d4" aria-label="How it works">
    <div class="step"><span class="step-n">1</span><p class="step-t">Make changes</p><p class="step-d">Let your agent edit code as usual.</p></div>
    <div class="step"><span class="step-n">2</span><p class="step-t">Generate the story</p><p class="step-d">diffStory has your agent write the reading order.</p></div>
    <div class="step"><span class="step-n">3</span><p class="step-t">Walk the diff</p><p class="step-d">Read in order, comment, and it fixes inline.</p></div>
  </section>
</main>

<div class="scrim" id="scrim" role="dialog" aria-modal="true" aria-label="Choose a repository folder">
  <div class="sheet">
    <div class="sheet-head">
      <span class="sheet-title">Open a repository</span>
      <button class="iconbtn" id="fsClose" type="button" aria-label="Close">✕</button>
    </div>
    <div class="crumbs" id="crumbs"></div>
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
      sw.hidden=false;txt.textContent='Story-generation skills are up to date.';btn.hidden=true;
      setTimeout(function(){sw.hidden=true;},1400);return;
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
  document.getElementById('recent').addEventListener('click',function(e){
    var b=e.target.closest('button[data-open]'); if(b) open(b.getAttribute('data-open'));
  });
  var input=document.getElementById('path');
  document.getElementById('openBtn').addEventListener('click',function(){ open(input.value.trim()); });
  input.addEventListener('keydown',function(e){ if(e.key==='Enter') open(input.value.trim()); });

  var scrim=document.getElementById('scrim'), fslist=document.getElementById('fslist'),
      crumbs=document.getElementById('crumbs'), footPath=document.getElementById('footPath'),
      openHere=document.getElementById('openHere'), cur=null, curGit=false;
  function el(tag,cls,txt){ var n=document.createElement(tag); if(cls) n.className=cls; if(txt!=null) n.textContent=txt; return n; }
  function ico(id){ return document.getElementById(id).content.cloneNode(true); }

  function browse(path){
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
    // list
    fslist.textContent='';
    if(!l.entries.length){ fslist.appendChild(el('div','fsempty','No subfolders here.')); }
    l.entries.forEach(function(en){
      var row=el('button','fsrow'); row.type='button';
      var fi=el('span','fi'); fi.appendChild(ico('ico-folder')); row.appendChild(fi);
      row.appendChild(el('span','fn',en.name));
      if(en.isGit){ row.appendChild(el('span','repo','repo')); }
      else { var go=el('span','go'); go.appendChild(ico('ico-go')); row.appendChild(go); }
      row.addEventListener('click',function(){ if(en.isGit){ open(en.path); } else { browse(en.path); } });
      fslist.appendChild(row);
    });
    footPath.textContent=l.path;
    openHere.disabled=!curGit;
    openHere.textContent=curGit?'Open this folder':'Not a git repo';
  }
  function openModal(){ scrim.classList.add('show'); browse(null); }
  function closeModal(){ scrim.classList.remove('show'); }
  document.getElementById('chooseBtn').addEventListener('click',openModal);
  document.getElementById('fsClose').addEventListener('click',closeModal);
  scrim.addEventListener('click',function(e){ if(e.target===scrim) closeModal(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeModal(); });
  openHere.addEventListener('click',function(){ if(curGit) open(cur); });
})();
</script>
</body></html>`;
}
