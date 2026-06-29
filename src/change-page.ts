// The "Your change" screen — the app's honest front door. Pure git, NO agent runs
// here. Shows the current change + a scope switcher, and a single "Generate guided
// review" button that streams POST /api/generate into a small cancelable console and
// navigates into the review on success. Self-contained; all server values escaped.
import { APP_BRAND } from './config.js';
import { navBar, navStyles } from './nav.js';
import { BRAND_HEAD_LINKS } from './brand.js';
import type { ChangeSummary, ChangeFile } from './change-view.js';
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from './progress-ui.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function count(n: number | null, sign: string): string {
  return n == null ? '' : `<span class="${sign === '+' ? 'add' : 'del'}">${sign}${n}</span>`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Files nobody reviews by hand: vendored/build output, lockfiles, generated ABIs,
// or anything so large it's almost certainly machine-written. These get folded into
// a collapsed group so the real change isn't buried under noise.
const HUGE = 1500;
function isNoise(f: ChangeFile): boolean {
  const p = f.path.toLowerCase();
  const generated =
    /(^|\/)(dist|build|out|node_modules|vendor|\.next|coverage|__generated__)\//.test(p) ||
    /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|cargo\.lock|go\.sum)$/.test(p) ||
    /\.(min\.js|min\.css|map|lock)$/.test(p) ||
    /(^|\/)abis?\//.test(p) ||
    /\.abi\.json$/.test(p);
  return generated || (f.added ?? 0) + (f.removed ?? 0) >= HUGE;
}

/** A fixed-width green/red proportion bar so change size is felt, not just read. */
function diffBar(added: number | null, removed: number | null): string {
  if (added == null && removed == null) return `<span class="bar bar-bin" aria-hidden="true"></span>`;
  const a = added ?? 0;
  const d = removed ?? 0;
  const tot = a + d;
  if (tot === 0) return `<span class="bar" aria-hidden="true"></span>`;
  const W = 42;
  let aw = Math.round((W * a) / tot);
  if (a > 0 && aw === 0) aw = 1;
  if (d > 0 && aw >= W) aw = W - 1;
  const dw = W - aw;
  return `<span class="bar" aria-hidden="true"><span class="bar-a" style="width:${aw}px"></span><span class="bar-d" style="width:${dw}px"></span></span>`;
}

function fileRow(f: ChangeFile): string {
  const i = f.path.lastIndexOf('/');
  const dir = i < 0 ? '' : f.path.slice(0, i + 1);
  const base = i < 0 ? f.path : f.path.slice(i + 1);
  return (
    `<div class="frow">` +
    `<span class="fp" title="${esc(f.path)}">` +
    (dir ? `<span class="fdir"><bdi>${esc(dir)}</bdi></span>` : '') +
    `<span class="fname">${esc(base)}</span>` +
    `</span>` +
    diffBar(f.added, f.removed) +
    `<span class="fc">${count(f.added, '+')} ${count(f.removed, '−')}</span>` +
    `</div>`
  );
}

function topFolder(path: string): string {
  const i = path.indexOf('/');
  return i < 0 ? 'root' : path.slice(0, i) + '/';
}

function fileList(sum: ChangeSummary): string {
  const totals = sum.files.reduce(
    (acc, f) => ({ a: acc.a + (f.added ?? 0), d: acc.d + (f.removed ?? 0) }),
    { a: 0, d: 0 },
  );
  const summaryHead =
    `<div class="fsum">` +
    `<span class="fsum-n"><b>${sum.totalChanged}</b> ${sum.totalChanged === 1 ? 'file' : 'files'} changed</span>` +
    `<span class="fsum-stat"><span class="add">+${totals.a}</span><span class="del">−${totals.d}</span></span>` +
    `</div>`;

  const normal = sum.files.filter((f) => !isNoise(f));
  const noise = sum.files.filter((f) => isNoise(f));

  const groups = new Map<string, ChangeFile[]>();
  for (const f of normal) {
    const key = topFolder(f.path);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(f);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => {
    if (a === 'root') return 1;
    if (b === 'root') return -1;
    return a.localeCompare(b);
  });

  const groupHtml = groupKeys
    .map((k) => {
      const fs = groups.get(k)!;
      const subhead =
        groupKeys.length > 1 || noise.length
          ? `<div class="fgrp"><span class="fgrp-name">${esc(k)}</span><span class="fgrp-n">${plural(fs.length, 'file')}</span></div>`
          : '';
      return subhead + fs.map(fileRow).join('');
    })
    .join('');

  let noiseHtml = '';
  if (noise.length) {
    const nt = noise.reduce(
      (acc, f) => ({ a: acc.a + (f.added ?? 0), d: acc.d + (f.removed ?? 0) }),
      { a: 0, d: 0 },
    );
    noiseHtml =
      `<details class="fgen"><summary class="fgen-sum">` +
      `<span class="fgen-chev" aria-hidden="true">›</span>` +
      `<span>${plural(noise.length, 'generated & large file')}</span>` +
      `<span class="fgen-stat"><span class="add">+${nt.a}</span><span class="del">−${nt.d}</span></span>` +
      `</summary><div class="fgen-rows">${noise.map(fileRow).join('')}</div></details>`;
  }

  return summaryHead + `<div class="files">${groupHtml}${noiseHtml}</div>`;
}

function totals(sum: ChangeSummary): { added: number; removed: number } {
  return sum.files.reduce(
    (acc, f) => ({ added: acc.added + (f.added ?? 0), removed: acc.removed + (f.removed ?? 0) }),
    { added: 0, removed: 0 },
  );
}

export function renderChangePage(
  sum: ChangeSummary,
  opts: { repoName: string; routeBase?: string; base?: string; head?: string; scopeLabel?: string; active?: string; notice?: string },
): string {
  const label = opts.scopeLabel ?? sum.baseLabel;
  const active = opts.active ?? '';
  const routeBase = opts.routeBase ?? '';
  const total = totals(sum);
  const notice = opts.notice
    ? `<div class="notice"><b>That review couldn't be loaded.</b> ${esc(opts.notice)} Generate a fresh one below.</div>`
    : '';

  const nav = navBar({
    home: '/repos',
    crumbs: [
      { label: opts.repoName, href: `${routeBase}/stories` },
      { label: 'New review' },
    ],
    right: `<a class="nv-act" href="${esc(routeBase)}/stories">Saved stories</a>`,
  });

  const scopeControls =
    `<div class="sopts" role="group" aria-label="Review scope">` +
    `<a class="sopt${active === 'uncommitted' ? ' on' : ''}" href="${esc(routeBase)}/change?scope=uncommitted">` +
    `<span class="sopt-k">Uncommitted</span><span class="sopt-t">Working tree vs HEAD</span>` +
    `</a>` +
    `<button class="sopt${active === 'commit' ? ' on' : ''}" data-open-panel="commit" type="button">` +
    `<span class="sopt-k">Single commit</span><span class="sopt-t">Parent -> selected commit</span>` +
    `</button>` +
    `<a class="sopt${active === 'branch' ? ' on' : ''}" href="${esc(routeBase)}/change?scope=branch">` +
    `<span class="sopt-k">Current branch</span><span class="sopt-t">Merge-base -> HEAD</span>` +
    `</a>` +
    `<button class="sopt" data-open-panel="range" type="button">` +
    `<span class="sopt-k">Branch commits</span><span class="sopt-t">Two commits on this branch</span>` +
    `</button>` +
    `<button class="sopt${active === 'compare' ? ' on' : ''}" data-open-panel="compare" type="button">` +
    `<span class="sopt-k">Compare any refs</span><span class="sopt-t">Branches, heads, commits</span>` +
    `</button>` +
    `</div>`;

  const launch = sum.hasChanges
    ? `<aside class="launch" aria-label="Generate review">
         <div class="launch-head">
           <span class="launch-eyebrow">Ready to narrate</span>
           <strong>${plural(sum.totalChanged, 'file')}</strong>
           <span><span class="add">+${total.added}</span><span class="del">-${total.removed}</span></span>
         </div>
         <div class="launch-body">
           <div class="genctl">
             <label class="genfield">Agent <select id="agentSel" aria-label="Agent"></select></label>
             <label class="genfield">Model <select id="modelSel" aria-label="Model"></select></label>
             <input id="modelInp" class="modelother" type="text" placeholder="model name" autocomplete="off" spellcheck="false" aria-label="Custom model" hidden />
             <label class="genfield">Story <select id="storyMode" aria-label="Story mode"><option value="guided" selected>Guided review</option><option value="detailed">Detailed audit</option></select></label>
           </div>
           <button class="gen" id="genBtn" type="button" data-base="${esc(opts.base ?? '')}" data-head="${esc(opts.head ?? '')}">Generate guided review</button>
         </div>
         <p class="skillwarn" id="skillWarn" hidden><span id="skillWarnText"></span><button class="skillfix" id="skillUpdateBtn" type="button">Update skills</button></p>
         <p class="gennote">Guided is the fast path; Detailed audit walks code paths line by line. Nothing starts until you click.</p>
       </aside>`
    : '';

  const cardBody = sum.hasChanges
    ? fileList(sum)
    : `<div class="empty">Nothing to review for <b>${esc(label)}</b>. Pick another scope above, or make a change.</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
${BRAND_HEAD_LINKS}
<title>${esc(APP_BRAND)} — new review</title>
<style>
:root{--bg:#f5f5f7;--elev:#fff;--label:#1d1d1f;--l2:#6e6e73;--l3:#8e8e93;--hair:rgba(0,0,0,.1);--sep:rgba(0,0,0,.07);
  --blue:#007aff;--blue2:#0067d6;--add:#1d7d3f;--del:#c4271f;--addbar:#34c759;--delbar:#ff453a;--fill:rgba(120,120,128,.12);--subbg:rgba(120,120,128,.06)}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1e;--elev:#2c2c2e;--label:#f5f5f7;--l2:#aeaeb2;--l3:#8e8e93;--hair:rgba(255,255,255,.12);
  --sep:rgba(255,255,255,.08);--blue:#0a84ff;--blue2:#3395ff;--add:#30d158;--del:#ff6961;--addbar:#30d158;--delbar:#ff453a;--fill:rgba(120,120,128,.24);--subbg:rgba(255,255,255,.035)}}
${navStyles()}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--label);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.wrap{max-width:1120px;margin:0 auto;padding:26px 24px 34px}
.lede{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:4px 0 18px}
.eyebrow{margin:0 0 7px;color:var(--blue);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.lede h1{font-size:30px;font-weight:760;letter-spacing:-.026em;margin:0}
.lede p{color:var(--l2);font-size:14px;margin:8px 0 0;line-height:1.45;max-width:62ch}
.scope-metrics{display:flex;align-items:center;gap:10px;flex:none;font-size:12.5px;color:var(--l2)}
.metric{display:flex;flex-direction:column;gap:2px;min-width:80px;padding:9px 11px;border:.5px solid var(--hair);border-radius:12px;background:var(--elev);box-shadow:0 1px 2px rgba(0,0,0,.035)}
.metric b{font-size:18px;line-height:1;color:var(--label);font-variant-numeric:tabular-nums}
.metric span{white-space:nowrap}
.layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;align-items:start}
.card{background:var(--elev);border:.5px solid var(--hair);border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden}
.scope-card{grid-column:1;padding:16px}
.scope{display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--l2)}
.scope-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.scur{display:flex;flex-direction:column;gap:4px}
.scur span{font-size:12px;color:var(--l3);font-weight:650;text-transform:uppercase;letter-spacing:.06em}
.scur b{color:var(--label);font-size:20px;line-height:1.15;font-weight:720;letter-spacing:-.02em}
.scope-command{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:11.5px;color:var(--l3);background:var(--subbg);border:.5px solid var(--sep);border-radius:999px;padding:6px 10px;white-space:nowrap}
.sopts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;max-width:100%}
.sopt{position:relative;display:flex;flex-direction:column;gap:5px;min-height:78px;font:inherit;text-align:left;color:var(--l2);background:var(--subbg);border:.5px solid var(--sep);cursor:pointer;padding:13px 13px 12px;border-radius:12px;text-decoration:none;white-space:normal}
.sopt:before{content:"";position:absolute;left:12px;right:12px;top:0;height:3px;border-radius:0 0 3px 3px;background:transparent}
.sopt:hover{color:var(--label);border-color:var(--hair);background:var(--fill)}
.sopt.on{background:linear-gradient(180deg,color-mix(in srgb,var(--blue) 10%,var(--elev)),var(--elev));color:var(--label);font-weight:590;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--blue) 40%,transparent),0 1px 2px rgba(0,0,0,.06);border-color:transparent}
.sopt.on:before{background:var(--blue)}
.sopt-k{font-size:13px;font-weight:700;color:var(--label);line-height:1.2}
.sopt-t{font-size:11.5px;line-height:1.3;color:var(--l2)}
.sopt.on .sopt-t{color:var(--l2)}
.refpanel{display:grid;grid-template-columns:1fr auto 1fr auto;align-items:end;gap:10px;margin-top:12px;padding:13px;border:.5px solid var(--sep);border-radius:12px;background:var(--subbg)}
.refpanel[hidden]{display:none}
.refpanel[data-panel="commit"]{grid-template-columns:minmax(220px,1fr) auto;align-items:end}
.refrow{display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--l2);min-width:0}
.refrow span{font-weight:620;color:var(--l2)}
.refhint{grid-column:1 / -1;margin:0;color:var(--l3);font-size:12px;line-height:1.4}
.refpanel input{font:inherit;font-size:13px;color:var(--label);background-color:var(--elev);border:.5px solid var(--hair);border-radius:8px;height:34px;padding:0 11px;min-width:0;width:100%}
.refpanel input:hover{border-color:var(--l3)}
.refpanel input:focus{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 30%,transparent)}
.cmparrow{color:var(--l3);display:inline-flex;align-self:center;padding-bottom:8px}
.cmpgo{font:inherit;font-size:13px;font-weight:600;color:#fff;background:var(--blue);border:none;border-radius:8px;height:34px;padding:0 16px;cursor:pointer;white-space:nowrap}
.cmpgo:hover{background:var(--blue2)}
.file-card{grid-column:1;min-width:0}
.fsum{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 15px;border-bottom:.5px solid var(--sep);background:var(--subbg);font-size:13px;color:var(--l2)}
.fsum-n b{color:var(--label);font-weight:650;font-variant-numeric:tabular-nums}
.fsum-stat{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12.5px;display:inline-flex;gap:9px}
.files{max-height:min(58vh,620px);overflow:auto}
.fgrp{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 15px;background:var(--subbg);
  font-size:11.5px;font-weight:700;letter-spacing:.02em;color:var(--l3);text-transform:uppercase;position:sticky;top:0;z-index:1;border-bottom:.5px solid var(--sep)}
.fgrp-name{font-family:"SF Mono",ui-monospace,Menlo,monospace;text-transform:none;letter-spacing:0;font-weight:600;color:var(--l2)}
.fgrp-n{font-weight:600}
.frow{display:flex;align-items:center;gap:12px;padding:9px 15px;border-bottom:.5px solid var(--sep);font-size:13px}
.frow:last-child{border-bottom:none}
.fp{flex:1;min-width:0;display:flex;align-items:baseline;overflow:hidden;font-family:"SF Mono",ui-monospace,Menlo,monospace}
.fdir{flex:0 1 auto;min-width:0;direction:rtl;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--l3)}
.fname{flex:0 0 auto;color:var(--label);font-weight:520}
.bar{flex:none;display:inline-flex;width:42px;height:7px;border-radius:3px;overflow:hidden;background:var(--fill)}
.bar-a{background:var(--addbar);height:100%}.bar-d{background:var(--delbar);height:100%}
.bar-bin{background:repeating-linear-gradient(45deg,var(--fill),var(--fill) 3px,transparent 3px,transparent 6px)}
.fc{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12px;flex:none;min-width:78px;text-align:right}
.add{color:var(--add)}.del{color:var(--del);margin-left:6px}
.fgen{border-top:.5px solid var(--sep)}
.fgen-sum{display:flex;align-items:center;gap:9px;padding:10px 15px;font-size:12.5px;color:var(--l2);cursor:pointer;list-style:none;user-select:none}
.fgen-sum::-webkit-details-marker{display:none}
.fgen-sum:hover{background:var(--fill)}
.fgen-chev{display:inline-flex;transition:transform .15s ease;color:var(--l3);font-size:15px;line-height:1}
.fgen[open] .fgen-chev{transform:rotate(90deg)}
.fgen-stat{margin-left:auto;font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12px;display:inline-flex;gap:8px}
.fgen-rows .frow{padding-left:26px}
.launch{grid-column:2;grid-row:1 / span 2;position:sticky;top:70px;background:var(--elev);border:.5px solid var(--hair);border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.08);padding:15px;overflow:hidden}
.launch-head{display:grid;grid-template-columns:1fr auto;align-items:end;gap:3px 10px;padding-bottom:13px;border-bottom:.5px solid var(--sep);font-size:12.5px;color:var(--l2)}
.launch-head strong{grid-column:1;font-size:20px;line-height:1;color:var(--label);font-weight:730;letter-spacing:-.02em}
.launch-head>span:last-child{grid-column:2;grid-row:1 / span 2;align-self:center;font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12px;white-space:nowrap}
.launch-eyebrow{grid-column:1;color:var(--l3);font-size:11px;text-transform:uppercase;letter-spacing:.07em;font-weight:700}
.launch-body{padding-top:14px}
.gennote{color:var(--l3);font-size:12px;margin:8px 2px 0;line-height:1.4}
.notice{background:rgba(255,159,10,.13);border:.5px solid rgba(255,159,10,.42);color:var(--label);border-radius:12px;padding:12px 15px;margin-bottom:16px;font-size:13.5px;line-height:1.5}
.notice b{font-weight:600}
.empty{padding:34px 16px;text-align:center;color:var(--l2);font-size:14px}
.empty b{color:var(--label);font-weight:600}
.genctl{display:flex;flex-direction:column;gap:10px;min-width:0}
.genfield{display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--l2);font-weight:590}
.genfield select,.genfield input{font:inherit;font-size:13px;color:var(--label);background-color:var(--bg);border:.5px solid var(--hair);border-radius:8px;height:34px;padding:0 11px}
.genfield select{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:30px;background-repeat:no-repeat;background-position:right 10px center;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")}
.genfield input{min-width:130px}
.genfield select:focus,.genfield input:focus{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 30%,transparent)}
.modelother{font:inherit;font-size:13px;color:var(--label);background-color:var(--bg);border:.5px solid var(--hair);border-radius:8px;height:34px;padding:0 11px;min-width:140px}
.modelother:focus{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 30%,transparent)}
.modelother[hidden]{display:none}
.gen{width:100%;height:42px;margin-top:13px;padding:0 18px;font:inherit;font-size:15px;font-weight:650;color:#fff;background:var(--blue);border:none;border-radius:11px;cursor:pointer;letter-spacing:-.01em;box-shadow:0 1px 2px rgba(0,40,120,.18)}
.gen:hover{background:var(--blue2)}.gen:active{transform:scale(.99)}.gen:disabled{opacity:.5;cursor:default}
.skillwarn{margin:12px 0 0;padding:10px 12px;border:.5px solid rgba(255,159,10,.42);border-radius:10px;background:rgba(255,159,10,.13);color:var(--label);font-size:12.5px;line-height:1.45;display:flex;align-items:center;gap:10px}
.skillwarn[hidden]{display:none}
.skillwarn span{flex:1;min-width:0}
.skillfix{flex:none;font:inherit;font-size:12px;font-weight:650;color:#fff;background:var(--blue);border:none;border-radius:8px;padding:6px 10px;cursor:pointer}
.skillfix:hover{background:var(--blue2)}.skillfix:disabled{opacity:.55;cursor:default}
.progress-host{grid-column:1 / -1}
@media (max-width:1080px){.sopts{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:980px){.layout{grid-template-columns:1fr}.scope-card,.file-card,.launch{grid-column:1}.launch{grid-row:auto;position:static}.genctl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.gen{margin-top:14px}.sopts{grid-template-columns:repeat(2,minmax(0,1fr))}.scope-metrics{display:none}}
@media (max-width:700px){.refpanel{grid-template-columns:1fr}.cmparrow{display:none}}
@media (max-width:600px){.wrap{padding:22px 14px 26px}.lede{display:block;margin-bottom:16px}.lede h1{font-size:28px}.lede p{font-size:14px}.scope-card{padding:14px}.scope-head{display:block}.scope-command{display:inline-flex;margin-top:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis}.sopts{grid-template-columns:1fr;gap:8px}.sopt{min-height:66px}.cmpgo{width:100%;max-width:none}.genctl{grid-template-columns:1fr}.launch{border-radius:14px}.files{max-height:58vh}.bar{width:34px}.fc{min-width:70px}.frow{gap:9px;padding:9px 13px}.fdir{max-width:48%}}
${progressPanelStyles()}
</style></head>
<body>
${nav}
<main class="wrap">
  <div class="lede">
    <div>
      <p class="eyebrow">Review scope</p>
      <h1>Choose what the story should cover</h1>
      <p>Pick the diff boundary first, then generate the walkthrough from the exact files in that scope.</p>
    </div>
    <div class="scope-metrics" aria-label="Current scope summary">
      <span class="metric"><b>${sum.totalChanged}</b><span>${sum.totalChanged === 1 ? 'file' : 'files'}</span></span>
      <span class="metric"><b class="add">+${total.added}</b><span>added</span></span>
      <span class="metric"><b class="del">−${total.removed}</b><span>removed</span></span>
    </div>
  </div>
  ${notice}
  <div class="layout">
    <section class="card scope-card" aria-label="Review scope">
      <div class="scope">
        <div class="scope-head">
          <span class="scur"><span>Reviewing</span><b>${esc(label)}</b></span>
          <span class="scope-command">git diff ${esc(opts.base ?? sum.base)}${opts.head ? ` ${esc(opts.head)}` : ''}</span>
        </div>
        ${scopeControls}
      </div>
      <div class="refpanel" data-panel="commit" id="commitPanel"${active === 'commit' ? '' : ' hidden'}>
        <label class="refrow"><span>Commit</span><input id="commitRef" list="commitOptions" placeholder="HEAD or a commit SHA" value="${esc(opts.head ?? 'HEAD')}" autocomplete="off" spellcheck="false"></label>
        <button class="cmpgo" id="commitGo" type="button">Review commit</button>
        <p class="refhint">Shows that commit against its first parent; root commits are shown against the empty tree.</p>
      </div>
      <div class="refpanel" data-panel="range" id="rangePanel" hidden>
        <label class="refrow"><span>Older commit</span><input id="rangeBase" list="commitOptions" placeholder="base commit" autocomplete="off" spellcheck="false"></label>
        <span class="cmparrow" aria-hidden="true">→</span>
        <label class="refrow"><span>Newer commit</span><input id="rangeHead" list="commitOptions" placeholder="HEAD or newer commit" value="HEAD" autocomplete="off" spellcheck="false"></label>
        <button class="cmpgo" id="rangeGo" type="button">Compare commits</button>
        <p class="refhint">Use this for two commits on the current branch; paste SHAs directly if they are not in the recent list.</p>
      </div>
      <div class="refpanel" data-panel="compare" id="comparePanel"${active === 'compare' ? '' : ' hidden'}>
        <label class="refrow"><span>From</span><input id="cmpBase" list="refOptions" placeholder="branch, tag, or commit" value="${esc(opts.base ?? '')}" autocomplete="off" spellcheck="false"></label>
        <span class="cmparrow" aria-hidden="true">→</span>
        <label class="refrow"><span>To</span><input id="cmpHead" list="refOptions" placeholder="branch head, commit, or blank for working tree" value="${esc(opts.head ?? '')}" autocomplete="off" spellcheck="false"></label>
        <button class="cmpgo" id="cmpGo" type="button">Compare refs</button>
        <p class="refhint">Use this for branch head vs branch head, branch head vs a commit, or commits from different branches.</p>
      </div>
      <datalist id="commitOptions"></datalist>
      <datalist id="refOptions"></datalist>
    </section>
    ${launch}
    <section class="card file-card" aria-label="Files in scope">
      ${cardBody}
    </section>
    <div id="genpanel" class="progress-host">${progressPanelMarkup('inline')}</div>
  </div>
</main>
<script>${progressPanelScript()}</script>
<script>
(function(){
  var loaded=false,panels=[].slice.call(document.querySelectorAll('[data-panel]'));
  var commitList=document.getElementById('commitOptions'),refList=document.getElementById('refOptions');
  function showPanel(name){
    panels.forEach(function(p){p.hidden=p.getAttribute('data-panel')!==name;});
    [].slice.call(document.querySelectorAll('.sopt')).forEach(function(el){el.classList.remove('on');});
    var btn=document.querySelector('[data-open-panel="'+name+'"]');if(btn)btn.classList.add('on');
    ensureRefs();
  }
  [].slice.call(document.querySelectorAll('[data-open-panel]')).forEach(function(btn){
    btn.addEventListener('click',function(){showPanel(btn.getAttribute('data-open-panel'));});
  });
  function addOpt(list,value,label){
    if(!list||!value)return;
    var o=document.createElement('option');o.value=value;if(label)o.label=label;list.appendChild(o);
  }
  function fillRefs(d){
    addOpt(refList,'HEAD','current HEAD');
    addOpt(commitList,'HEAD','current HEAD');
    (d.branches||[]).forEach(function(raw){
      var b=typeof raw==='string'?{name:raw,kind:'branch'}:raw;
      addOpt(refList,b.name,(b.kind==='remote'?'remote branch':'local branch'));
    });
    (d.commits||[]).forEach(function(c){
      var label=(c.subject||'commit')+(c.refs?(' · '+c.refs):'');
      addOpt(commitList,c.sha,label);
      addOpt(refList,c.sha,label);
    });
  }
  function ensureRefs(){
    if(loaded)return;loaded=true;
    fetch('/api/refs').then(function(r){return r.json();}).then(fillRefs).catch(function(){loaded=false;});
  }
  if(panels.some(function(p){return !p.hidden;}))ensureRefs();
  function navTo(url){location.href=url;}
  var commitGo=document.getElementById('commitGo'),commitRef=document.getElementById('commitRef');
  if(commitGo)commitGo.addEventListener('click',function(){
    var c=(commitRef.value||'HEAD').trim();
    navTo('${esc(routeBase)}/change?scope=commit&commit='+encodeURIComponent(c));
  });
  var rangeGo=document.getElementById('rangeGo'),rangeBase=document.getElementById('rangeBase'),rangeHead=document.getElementById('rangeHead');
  if(rangeGo)rangeGo.addEventListener('click',function(){
    var b=rangeBase.value.trim(),h=(rangeHead.value.trim()||'HEAD');if(!b)return;
    navTo('${esc(routeBase)}/change?base='+encodeURIComponent(b)+'&head='+encodeURIComponent(h));
  });
  var cmpGo=document.getElementById('cmpGo');
  if(cmpGo)cmpGo.addEventListener('click',function(){
    var baseSel=document.getElementById('cmpBase'),headSel=document.getElementById('cmpHead');
    var b=baseSel.value.trim(),h=headSel.value.trim();if(!b)return;
    var u='${esc(routeBase)}/change?base='+encodeURIComponent(b);if(h)u+='&head='+encodeURIComponent(h);location.href=u;
  });
  var agentSel=document.getElementById('agentSel'),modelSel=document.getElementById('modelSel'),modelInp=document.getElementById('modelInp'),modeSel=document.getElementById('storyMode');
  var MODELS={claude:[['Default (Sonnet)',''],['Opus','opus'],['Haiku','haiku'],['Other…','__other__']],codex:[['Default',''],['Other…','__other__']]};
  function syncOther(){if(modelInp&&modelSel)modelInp.hidden=(modelSel.value!=='__other__');}
  function fillModels(){
    if(!modelSel)return;
    while(modelSel.options.length)modelSel.remove(0);
    var ms=MODELS[agentSel?agentSel.value:'']||[['Default','']];
    ms.forEach(function(m){modelSel.add(new Option(m[0],m[1]));});
    syncOther();
  }
  if(modelSel)modelSel.addEventListener('change',syncOther);
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
      : 'Story-generation skill was not found in ~/.agents, ~/.claude, or ~/.codex. Install it before generating so the agent can create the story reliably.';
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
  if(agentSel){
    fetch('/api/agents').then(function(r){return r.json();}).then(function(d){
      (d.agents||[]).forEach(function(a){agentSel.add(new Option(a,a));});
      if(!agentSel.options.length)agentSel.add(new Option('no agent found',''));
      showSkillState(d.skills);
      fillModels();
    }).catch(function(){});
    agentSel.addEventListener('change',fillModels);
  }
  var gen=document.getElementById('genBtn');
  if(!gen)return;
  gen.addEventListener('click',function(){
    gen.disabled=true;
    var root=document.querySelector('#genpanel .ds-pp');
    if(!root){gen.disabled=false;return;}
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    var panel=new ProgressPanel(root,{
      onStop:function(){ if(ctrl)ctrl.abort(); },
      onClose:function(){ root.hidden=true; gen.disabled=false; },
      onDone:function(status,result){
        gen.disabled=false;
        if(status==='complete'&&result&&result.storyWritten){ location.href='${esc(routeBase)}/review?story=story.json'; }
      }
    });
    panel.start();
    var agent=agentSel?agentSel.value:'';
    var msel=modelSel?modelSel.value:'';
    var model=(msel==='__other__')?(modelInp?modelInp.value.trim():''):msel;
    var payload={base:gen.getAttribute('data-base')||undefined,head:gen.getAttribute('data-head')||undefined,agent:agent||undefined,model:model||undefined,mode:modeSel?modeSel.value:undefined};
    runProgress(panel,'/api/generate',payload,ctrl).then(function(){ gen.disabled=false; });
  });
})();
</script>
</body></html>`;
}
