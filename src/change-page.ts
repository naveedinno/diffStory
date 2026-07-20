// The "Your change" screen — the app's honest front door. Pure git, NO agent runs
// here. Shows the current scope + changed-file summary, then links into the real
// review viewer for the full diff, comments, and optional story generation.
// Self-contained; all server values escaped.
import { APP_BRAND } from './config.js';
import { navBar, navStyles } from './nav.js';
import { BRAND_HEAD_LINKS, brandChangeScopeThreadSvg } from './brand.js';
import { sharedTokens, themeBootstrapScript, threadAtmosphereStyles } from './theme.js';
import type { ChangeSummary } from './change-view.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// A reload control lives in the (sticky) nav so it's always reachable: the diff
// is rendered from the working tree at request time, so editing code and hitting
// this re-reads the tree and rebuilds the diff + counts in one shot.
const REFRESH_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>`;
const PAGE_THREAD = brandChangeScopeThreadSvg();

function totals(sum: ChangeSummary): { added: number; removed: number } {
  return sum.files.reduce(
    (acc, f) => ({ added: acc.added + (f.added ?? 0), removed: acc.removed + (f.removed ?? 0) }),
    { added: 0, removed: 0 },
  );
}

function splitPath(path: string): [string, string] {
  const i = path.lastIndexOf('/');
  return i < 0 ? ['', path] : [path.slice(0, i + 1), path.slice(i + 1)];
}

function filePathHtml(path: string): string {
  const [dir, base] = splitPath(path);
  return `${dir ? `<span class="fdir">${esc(dir)}</span>` : ''}<span class="fname">${esc(base)}</span>`;
}

function fileStat(file: ChangeSummary['files'][number]): string {
  if (file.added === null || file.removed === null) return '<span class="muted">binary / metadata</span>';
  const parts = [];
  if (file.added) parts.push(`<span class="add">+${file.added}</span>`);
  if (file.removed) parts.push(`<span class="del">−${file.removed}</span>`);
  return parts.length ? parts.join(' ') : '<span class="muted">metadata</span>';
}

function changeBar(file: ChangeSummary['files'][number]): string {
  if (file.added === null || file.removed === null) return '<span class="bar bar-bin"></span>';
  const changed = Math.max(1, file.added + file.removed);
  const addWidth = Math.round((file.added / changed) * 100);
  const delWidth = 100 - addWidth;
  return `<span class="bar" aria-hidden="true"><span class="bar-a" style="width:${addWidth}%"></span><span class="bar-d" style="width:${delWidth}%"></span></span>`;
}

function generatedOutput(path: string): boolean {
  return /^(dist|build|coverage|out|target)\//.test(path) || /(^|\/)([^/]+\.generated\.[^/]+|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(path);
}

function fileRow(file: ChangeSummary['files'][number]): string {
  return `<div class="frow">` +
    `<span class="fp" title="${esc(file.path)}">${filePathHtml(file.path)}</span>` +
    changeBar(file) +
    `<span class="fc">${fileStat(file)}</span>` +
    `</div>`;
}

function renderFileSummary(sum: ChangeSummary, diffHref: string): string {
  const total = totals(sum);
  const primary = sum.files.filter((file) => !generatedOutput(file.path));
  const generated = sum.files.filter((file) => generatedOutput(file.path));
  const rows = primary.map(fileRow).join('');
  const generatedRows = generated.length
    ? `<details class="generated"><summary><span>Generated output</span><span>${generated.length} ${generated.length === 1 ? 'file' : 'files'} <i>⌄</i></span></summary><div>${generated.map(fileRow).join('')}</div></details>`
    : '';
  return `<div class="card file-summary-card">
    <div class="fsum">
      <span class="fsum-n"><b>${primary.length}</b> review ${primary.length === 1 ? 'file' : 'files'}${generated.length ? ` <span>· ${generated.length} generated</span>` : ''}</span>
      <span class="fsum-stat"><span class="add">+${total.added}</span><span class="del">−${total.removed}</span></span>
      <a class="openreview" href="${esc(diffHref)}" aria-label="Start review of ${sum.totalChanged} ${sum.totalChanged === 1 ? 'file' : 'files'}">Review ${sum.totalChanged} ${sum.totalChanged === 1 ? 'file' : 'files'} <span aria-hidden="true">→</span></a>
    </div>
    <div class="files">${rows}${generatedRows}</div>
  </div>`;
}

/** Carry the current scope to the /diff viewer so it diffs the same thing. */
function scopeQuery(base?: string, head?: string): string {
  const parts: string[] = [];
  if (base) parts.push(`base=${encodeURIComponent(base)}`);
  if (head) parts.push(`head=${encodeURIComponent(head)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function renderChangePage(
  sum: ChangeSummary,
  opts: {
    repoName: string;
    routeBase?: string;
    base?: string;
    head?: string;
    scopeLabel?: string;
    active?: string;
    notice?: string;
  },
): string {
  const label = opts.scopeLabel ?? sum.baseLabel;
  const active = opts.active ?? '';
  const routeBase = opts.routeBase ?? '';
  const total = totals(sum);
  const notice = opts.notice
    ? `<div class="notice"><b>That review couldn't be loaded.</b> ${esc(
        opts.notice,
      )} Open the diff viewer below, then generate a fresh story from the Story tab.</div>`
    : '';

  const nav = navBar({
    home: '/repos',
    crumbs: [
      { label: opts.repoName, href: `${routeBase}/change` },
      { label: 'Scope' },
    ],
    right:
      `<button class="nv-act" id="reloadBtn" type="button" title="Re-read the working tree and rebuild the diff" aria-label="Reload current scope">${REFRESH_ICON}<span class="reload-label">Reload</span></button>` +
      `<a class="nv-act nv-history" href="${esc(routeBase)}/stories">History</a>`,
  });

  const scopeControls =
    `<div class="sopts" role="group" aria-label="Review scope">` +
    `<a class="sopt${active === 'uncommitted' ? ' on' : ''}" href="${esc(routeBase)}/change?scope=uncommitted"${active === 'uncommitted' ? ' aria-current="true"' : ''}>` +
    `<span class="sopt-k">Uncommitted</span><span class="sopt-t">Working tree vs HEAD</span>` +
    `</a>` +
    `<button class="sopt${active === 'commit' ? ' on' : ''}" data-open-panel="commit" type="button" aria-controls="commitPanel" aria-expanded="${active === 'commit' ? 'true' : 'false'}">` +
    `<span class="sopt-k">Single commit</span><span class="sopt-t">Parent → selected commit</span>` +
    `</button>` +
    `<button class="sopt${active === 'compare' ? ' on' : ''}" data-open-panel="compare" type="button" aria-controls="comparePanel" aria-expanded="${active === 'compare' ? 'true' : 'false'}">` +
    `<span class="sopt-k">Compare any refs</span><span class="sopt-t">Base → compare, any branch or commit</span>` +
    `</button>` +
    `</div>`;

  const diffHref = `${routeBase}/diff${scopeQuery(opts.base, opts.head)}`;
  // The compare panel repopulates straight from the resolved scope: base/head ARE
  // the two revs. Only prefill when compare is the active mode — other scopes set
  // base to bookkeeping values like HEAD that would read as a chosen rev here.
  const inCompare = active === 'compare';
  const compareBaseValue = inCompare ? opts.base ?? '' : '';
  const compareHeadIsWorktree = !inCompare || !opts.head;
  const compareHeadValue = compareHeadIsWorktree ? 'Working tree' : opts.head ?? '';
  const compareHeadWorktree = compareHeadIsWorktree ? ' data-worktree="1"' : '';

  const cardBody = sum.hasChanges
    ? renderFileSummary(sum, diffHref)
    : `<div class="card"><div class="empty">
        <p class="empty-clean">✓ working tree clean</p>
        <h2 class="empty-title">Nothing to review for ${esc(label)}</h2>
        <p class="empty-sub">Pick another scope above, or make a change. When your agent writes code, the changes appear here.</p>
        <div class="empty-actions"><button class="empty-recheck" type="button" onclick="location.reload()">Re-check</button><a class="empty-history" href="${esc(routeBase)}/stories">Review history →</a></div>
      </div></div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#0a0c0f" data-ds-theme-color>
${themeBootstrapScript()}
${BRAND_HEAD_LINKS}
<title>${esc(APP_BRAND)} — choose review scope</title>
<style>
${sharedTokens()}
${threadAtmosphereStyles()}
/* Signal 3b: --bg/--add/--del are canonical (inherited); alias the rest onto the shared --app-* layer, which itself aliases the canonical tokens. */
:root{--elev:var(--app-elev);--label:var(--app-label);--l2:var(--app-l2);--l3:var(--app-l3);
  --hair:var(--app-hair);--sep:var(--app-sep);--blue:var(--app-blue);--blue2:var(--app-blue2);
  --addbar:var(--app-addbar);--delbar:var(--app-delbar);
  --fill:var(--app-fill);--subbg:var(--app-subbg)}
${navStyles()}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--label);min-height:100vh;font-family:var(--font-sans);-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.wrap{max-width:960px;margin:0 auto;padding:30px 24px 40px;position:relative;isolation:isolate}
.wrap>.ds-thread-layer{top:-34px;bottom:auto;height:240px;opacity:.78}
.wrap>*:not(.ds-thread-layer){position:relative;z-index:1}
.review-path{display:flex;align-items:center;margin:0 0 26px;color:var(--l3);font-family:var(--font-mono);font-size:10.5px;font-weight:500;text-transform:uppercase;letter-spacing:var(--tracking-kicker)}.review-path>b{flex:1;height:2px;max-width:90px;margin:0 16px;background:var(--thread-dim);opacity:.5}.review-path>span+b:first-of-type{background:linear-gradient(90deg,var(--thread),var(--thread-dim));opacity:1}.review-path span{display:flex;align-items:center;gap:9px;white-space:nowrap}.review-path i{font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:var(--tracking-numeral);line-height:1;font-style:normal;color:var(--numeral-dim)}.review-path .active{color:var(--accent)}.review-path .active i{color:var(--accent)}
.lede{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:4px 0 18px}
.eyebrow{margin:0 0 7px;color:var(--blue);font-family:var(--font-mono);font-size:10.5px;font-weight:500;letter-spacing:var(--tracking-kicker);text-transform:uppercase}
.lede h1{font-family:var(--font-display);font-size:26px;font-weight:700;letter-spacing:-.02em;margin:0}
.lede p{color:var(--l2);font-size:14px;margin:8px 0 0;line-height:1.45;max-width:62ch}
.scope-metrics{display:flex;align-items:center;gap:10px;flex:none;font-size:12.5px;color:var(--l2)}
.metric{display:flex;flex-direction:column;gap:2px;min-width:80px;padding:9px 11px;border:1px solid var(--line-soft);border-radius:var(--radius-lg);background:var(--fill-1)}
.metric b{font-family:var(--font-display);font-size:18px;line-height:1;color:var(--label);font-variant-numeric:tabular-nums}
.metric span{white-space:nowrap}
.layout{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;align-items:start}
.card{background:var(--surface-2);border:1px solid var(--line-soft);border-radius:var(--radius-island);overflow:hidden}
.scope-card{grid-column:1;padding:16px;overflow:visible}
.scope{display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--l2)}
.scope-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.scur{display:flex;flex-direction:column;gap:4px}
.scur span{font-family:var(--font-mono);font-size:10.5px;color:var(--l3);font-weight:500;text-transform:uppercase;letter-spacing:var(--tracking-kicker)}
.scur b{color:var(--label);font-size:20px;line-height:1.15;font-weight:700;letter-spacing:-.02em}
.scope-command{font-family:var(--font-mono);font-size:11.5px;color:var(--l3);background:var(--subbg);border:1px solid var(--sep);border-radius:var(--radius-sm);padding:6px 10px;white-space:nowrap}
.sopts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;max-width:100%}
.sopt{position:relative;display:flex;flex-direction:column;gap:4px;min-height:64px;font:inherit;text-align:left;color:var(--l2);background:var(--subbg);border:1px solid var(--sep);cursor:pointer;padding:10px 12px;border-radius:var(--radius);text-decoration:none;white-space:normal;transition:background-color var(--motion-duration-fast) ease,border-color var(--motion-duration-fast) ease,transform var(--motion-duration-press) var(--motion-ease-out),box-shadow var(--motion-duration-fast) ease}
.sopt:before{content:"";position:absolute;left:12px;right:12px;top:0;height:3px;border-radius:0 0 3px 3px;background:transparent}
.sopt:hover,.sopt.is-open{color:var(--label);border-color:var(--hair);background:var(--fill)}
.sopt.is-open:not(.on){border-color:color-mix(in srgb,var(--blue) 30%,var(--hair));background:color-mix(in srgb,var(--blue) 8%,var(--elev))}
.sopt.is-open:not(.on):before{background:color-mix(in srgb,var(--blue) 55%,transparent)}
.sopt.on{background:var(--accent-soft);color:var(--label);font-weight:600;border-color:var(--accent-line)}
.sopt:focus-visible,.openreview:focus-visible,.generated summary:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.sopt.on:before{background:var(--blue)}
.sopt:active{transform:scale(.985)}
.sopt-k{font-size:13px;font-weight:700;color:var(--label);line-height:1.2}
.sopt-t{font-size:11.5px;line-height:1.3;color:var(--l2)}
.sopt.on .sopt-t{color:var(--l2)}
.refpanel{display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:10px;margin-top:12px;padding:13px;border:1px solid var(--sep);border-radius:var(--radius-lg);background:var(--subbg);transform-origin:50% 0}
.refpanel[hidden]{display:none}
.refpanel[data-panel="commit"]{grid-template-columns:minmax(220px,1fr);align-items:end}
.refpanel[data-panel="compare"]{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}
.refrow{position:relative;display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--l2);min-width:0}
.refrow span{font-weight:600;color:var(--l2)}
.refrow span i{font-style:normal;font-weight:400;color:var(--l3);margin-left:5px;font-size:11.5px}
.refhint{grid-column:1 / -1;margin:0;color:var(--l3);font-size:12px;line-height:1.4}
.refhint code{font-family:var(--font-mono);font-size:11px}
.refpanel input{font:inherit;font-size:13px;color:var(--label);background-color:var(--elev);border:1px solid var(--hair);border-radius:var(--radius);height:var(--control-h-lg);padding:0 11px;min-width:0;width:100%}
.refpanel input:hover{border-color:var(--l3)}
.refpanel input:focus{outline:none;border-color:var(--accent-line);box-shadow:0 0 0 3px var(--accent-soft)}
.refpicker{position:fixed;z-index:50;max-height:260px;overflow:auto;padding:6px;background:var(--elev);border:1px solid var(--hair);border-radius:var(--radius-lg);box-shadow:var(--shadow);transform-origin:50% 0}
.refpicker[hidden]{display:none}
.refpick-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:8px 10px;border:none;border-radius:var(--radius-sm);background:transparent;color:var(--label);font:inherit;text-align:left;cursor:pointer}
.refpick-row:hover,.refpick-row.is-active{background:var(--fill)}
.refpick-main{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);font-size:12.5px;font-weight:600}
.refpick-kind{grid-column:2;grid-row:1 / span 2;align-self:center;color:var(--l3);font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700}
.refpick-meta{grid-column:1;color:var(--l2);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.refpick-empty{padding:9px 10px;color:var(--l3);font-size:12px}
.cmparrow{color:var(--l3);display:inline-flex;align-self:center;padding-bottom:8px}
.file-card{grid-column:1;min-width:0}
.file-summary-card{overflow:hidden}
.fsum{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 15px;border-bottom:1px solid var(--sep);background:var(--subbg);font-size:13px;color:var(--l2);flex-wrap:wrap}
.fsum-n b{color:var(--label);font-family:var(--font-display);font-weight:700;font-variant-numeric:tabular-nums}
.fsum-n span{color:var(--l3)}
.fsum-stat{font-family:var(--font-mono);font-size:12.5px;display:inline-flex;gap:9px}
.openreview{margin-left:auto;display:inline-flex;align-items:center;gap:7px;height:var(--control-h);padding:0 14px;border-radius:var(--radius);background:var(--blue);color:var(--on-accent);text-decoration:none;font-size:12.5px;font-weight:600;transition:background-color var(--motion-duration-fast) ease,transform var(--motion-duration-press) var(--motion-ease-out)}
.openreview:hover{background:var(--blue2)}
.openreview:active{transform:scale(.97)}
.files{max-height:min(58vh,620px);overflow:auto}
.frow{display:flex;align-items:center;gap:12px;padding:9px 15px;border-bottom:1px solid var(--sep);font-size:13px}
.frow:last-child{border-bottom:none}
.generated{border-top:1px solid var(--sep)}.generated summary{display:flex;align-items:center;justify-content:space-between;padding:11px 15px;background:var(--subbg);cursor:pointer;color:var(--l2);font-size:12px;font-weight:600;list-style:none}.generated summary::-webkit-details-marker{display:none}.generated summary i{font-style:normal;margin-left:6px;color:var(--l3)}.generated[open] summary i{display:inline-block;transform:rotate(180deg)}.generated>div .frow{padding-left:25px;background:color-mix(in srgb,var(--subbg) 50%,transparent)}
.fp{flex:1;min-width:0;display:flex;align-items:baseline;overflow:hidden;font-family:var(--font-mono)}
.fdir{flex:0 1 auto;min-width:0;direction:ltr;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--l3)}
.fname{flex:0 0 auto;color:var(--label);font-weight:500}
.bar{flex:none;display:inline-flex;width:42px;height:7px;border-radius:3px;overflow:hidden;background:var(--fill)}
.bar-a{background:var(--addbar);height:100%}.bar-d{background:var(--delbar);height:100%}
.bar-bin{background:repeating-linear-gradient(45deg,var(--fill),var(--fill) 3px,transparent 3px,transparent 6px)}
.fc{font-family:var(--font-mono);font-size:12px;flex:none;min-width:78px;text-align:right}
.muted{color:var(--l3)}
.add{color:var(--add)}.del{color:var(--del);margin-left:6px}
.notice{background:var(--amber-soft);border:1px solid var(--amber);color:var(--label);border-radius:var(--radius-lg);padding:12px 15px;margin-bottom:16px;font-size:13.5px;line-height:1.5}
.notice b{font-weight:600}
.empty{padding:34px 16px 38px;text-align:center;color:var(--l2);font-size:14px}
.empty b{color:var(--label);font-weight:600}
.empty-clean{margin:0 0 12px;font-family:var(--font-mono);font-size:11px;color:var(--add)}
.empty .empty-title{font-family:var(--font-display);font-size:19px;font-weight:700;letter-spacing:var(--tracking-tight);color:var(--label);margin:0 0 8px}
.empty .empty-sub{font-size:12.5px;color:var(--l2);line-height:1.6;max-width:46ch;margin:0 auto 20px}
.empty-actions{display:flex;gap:8px;justify-content:center;align-items:center}
.empty-recheck,.empty-history{display:inline-flex;align-items:center;height:var(--control-h);padding:0 13px;font:inherit;font-size:12.5px;font-weight:600;color:var(--label);background:transparent;border:1px solid var(--hair);border-radius:var(--radius);cursor:pointer;text-decoration:none}
.empty-recheck:hover,.empty-history:hover{background:var(--fill)}
.empty-recheck:focus-visible,.empty-history:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
@media (prefers-reduced-motion:no-preference){.wrap{animation:change-page-in var(--motion-duration-spatial) var(--motion-ease-out) backwards}.refpanel:not([hidden]){animation:change-panel-in var(--motion-duration-spatial) var(--motion-ease-out) backwards}.refpicker:not([hidden]){animation:change-picker-in var(--motion-duration-ui) var(--motion-ease-out) backwards}@keyframes change-page-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}@keyframes change-panel-in{from{opacity:0;clip-path:inset(0 0 100% round 12px);transform:translateY(-5px)}to{opacity:1;clip-path:inset(0 round 12px);transform:none}}@keyframes change-picker-in{from{opacity:0;clip-path:inset(0 0 100% round 10px);transform:translateY(-4px) scale(.985)}to{opacity:1;clip-path:inset(0 round 10px);transform:none}}}
@media (prefers-reduced-motion:reduce){.sopt,.openreview{transition:none}.sopt:active,.openreview:active{transform:none}}
@media (prefers-contrast:more){.card,.sopt,.refpanel,.refpanel input,.scope-command,.notice,.metric{border-color:var(--label)}}
@media (max-width:1080px){.sopts{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:980px){.scope-card,.file-card{grid-column:1}.sopts{grid-template-columns:repeat(2,minmax(0,1fr))}.scope-metrics{display:none}}
@media (max-width:700px){.refpanel,.refpanel[data-panel="commit"],.refpanel[data-panel="compare"]{grid-template-columns:1fr}.cmparrow{display:none}}
@media (max-width:600px){.wrap{padding:20px 14px 26px}.wrap>.ds-thread-layer{top:-51px}.review-path{display:flex;width:100%}.review-path>b{flex:1;min-width:12px;max-width:none;margin:0 10px}.review-path span{flex:none;gap:0;font-size:0}.review-path .active{gap:7px;font-size:10.5px}.review-path i{font-size:16px}.lede{display:block;margin-bottom:16px}.lede h1{font-size:28px}.lede p{font-size:14px}.scope-card{padding:14px}.scope-head{display:block}.scope-command{display:inline-flex;margin-top:10px;max-width:100%;overflow:hidden;text-overflow:ellipsis}.sopts{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.sopt{min-height:44px;justify-content:center;text-align:center;padding:8px 6px}.sopt-k{font-size:12px}.sopt-t{display:none}.files{max-height:58vh}.bar{width:34px}.fc{min-width:70px}.frow{gap:9px;padding:9px 13px}.fdir{max-width:48%}.openreview{width:100%;justify-content:center;margin-left:0}}
@media (max-width:480px){.reload-label{display:none}.nv-history{padding-left:9px;padding-right:9px}}
</style></head>
<body class="ds-map-bg">
${nav}
<main class="wrap ds-thread-host">
  <div class="ds-thread-layer" data-thread-compact="hide">${PAGE_THREAD}</div>
  <div class="review-path" role="list" aria-label="Review workflow"><span class="active" role="listitem" aria-current="step"><i>01</i>Scope</span><b aria-hidden="true"></b><span role="listitem"><i>02</i>Read</span><b aria-hidden="true"></b><span role="listitem"><i>03</i>Resolve</span><b aria-hidden="true"></b><span role="listitem"><i>04</i>Decide</span></div>
  <div class="lede">
    <div>
      <p class="eyebrow">Review session</p>
      <h1>Choose what to review</h1>
      <p>Set the exact git scope, confirm the changed files, then start with the real diff. A guided story stays optional.</p>
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
        <label class="refrow"><span>Commit</span><input id="commitRef" data-picker="commit" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="refPicker" aria-expanded="false" placeholder="HEAD or a commit SHA" value="${esc(opts.head ?? 'HEAD')}" autocomplete="off" spellcheck="false"></label>
        <p class="refhint">Shows that commit against its first parent; root commits are shown against the empty tree.</p>
      </div>
      <div class="refpanel" data-panel="compare" id="comparePanel"${active === 'compare' ? '' : ' hidden'}>
        <label class="refrow"><span>Base <i>older</i></span><input id="cmpBase" data-picker="base" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="refPicker" aria-expanded="false" placeholder="branch, tag, or commit" value="${esc(
          compareBaseValue,
        )}" autocomplete="off" spellcheck="false"></label>
        <span class="cmparrow" aria-hidden="true">→</span>
        <label class="refrow"><span>Compare <i>newer</i></span><input id="cmpHead" data-picker="head" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="refPicker" aria-expanded="false" placeholder="branch, tag, or commit" value="${esc(
          compareHeadValue,
        )}"${compareHeadWorktree} autocomplete="off" spellcheck="false"></label>
        <p class="refhint">Each side takes anything git does — a branch, tag, SHA, or <code>main~2</code>. Leave the right side on Working tree to include uncommitted edits.</p>
      </div>
      <div class="refpicker" id="refPicker" role="listbox" aria-label="Available git references" hidden></div>
    </section>
    <section class="file-card" aria-label="Changed files">
      ${cardBody}
    </section>
  </div>
</main>
<script>
(function(){
  var reloadBtn=document.getElementById('reloadBtn');
  if(reloadBtn)reloadBtn.addEventListener('click',function(){reloadBtn.disabled=true;location.reload();});
  var loaded=false,loadingRefs=false,refsPromise=null,panels=[].slice.call(document.querySelectorAll('[data-panel]'));
  var refData={current:'HEAD',branches:[],commits:[]};
  var picker=document.getElementById('refPicker'),activeInput=null,activeRows=[],activeIndex=-1,refQueries=new WeakMap();
  function showPanel(name){
    panels.forEach(function(p){p.hidden=p.getAttribute('data-panel')!==name;});
    [].slice.call(document.querySelectorAll('[data-open-panel]')).forEach(function(el){el.classList.remove('is-open');el.setAttribute('aria-expanded','false');});
    var btn=document.querySelector('[data-open-panel="'+name+'"]');if(btn)btn.classList.add('is-open');
    if(btn)btn.setAttribute('aria-expanded','true');
    ensureRefs();
  }
  [].slice.call(document.querySelectorAll('[data-open-panel]')).forEach(function(btn){
    btn.addEventListener('click',function(){showPanel(btn.getAttribute('data-open-panel'));});
  });
  function option(value,label,meta,kind){return {value:value,label:label||value,meta:meta||'',kind:kind||''};}
  function headOption(){return option('HEAD','HEAD','current HEAD','head');}
  function worktreeOption(){return option('__WORKTREE__','Working tree','HEAD plus uncommitted edits','worktree');}
  function branchOptions(){
    return (refData.branches||[]).map(function(b){
      return option(b.name,b.name,b.kind==='remote'?'remote branch':'local branch',b.kind==='remote'?'remote':'branch');
    });
  }
  function commitOptions(){
    return (refData.commits||[]).map(function(c){
      return option(c.sha,c.sha,commitMeta(c),'commit');
    });
  }
  function commitMeta(c){
    var subject=c.subject||c.refs||'commit';
    var when=c.committedAtLabel||c.committedAt||'';
    var rel=c.committedAtRelative||'';
    return [when,rel,subject].filter(Boolean).join(' · ');
  }
  function fillRefs(d){
    refData.current=d.current||'HEAD';
    refData.branches=(d.branches||[]).map(function(raw){return typeof raw==='string'?{name:raw,kind:'branch'}:raw;});
    refData.commits=d.commits||[];
  }
  function ensureRefs(){
    if(loaded)return Promise.resolve();
    if(refsPromise)return refsPromise;
    loadingRefs=true;
    refsPromise=fetch('/api/refs').then(function(r){return r.json();}).then(function(d){fillRefs(d);loaded=true;loadingRefs=false;refsPromise=null;}).catch(function(){loaded=false;loadingRefs=false;refsPromise=null;});
    return refsPromise;
  }
  if(panels.some(function(p){return !p.hidden;}))ensureRefs();
  function optionsForInput(input){
    var kind=input.getAttribute('data-picker');
    if(!loaded)return [option('', 'Loading refs…', 'reading local git refs', '')];
    if(kind==='commit')return [headOption()].concat(commitOptions());
    if(kind==='head')return [worktreeOption()].concat(branchOptions(),commitOptions());
    return branchOptions().concat(commitOptions());
  }
  function filteredOptions(input){
    var q=(refQueries.get(input)||'').trim().toLowerCase();
    return optionsForInput(input).filter(function(o){
      if(!o.value)return true;
      if(!q)return true;
      return (o.value+' '+o.label+' '+o.meta+' '+o.kind).toLowerCase().indexOf(q)>=0;
    });
  }
  function placePicker(){
    if(!picker||!activeInput||picker.hidden)return;
    var r=activeInput.getBoundingClientRect();
    var w=Math.min(Math.max(260,Math.round(r.width)),Math.max(220,window.innerWidth-24));
    var left=Math.min(Math.max(12,Math.round(r.left)),Math.max(12,window.innerWidth-w-12));
    var maxH=Math.max(140,Math.min(260,window.innerHeight-24));
    picker.style.maxHeight=maxH+'px';
    var h=Math.min(picker.offsetHeight||maxH,maxH);
    var top=r.bottom+7;
    if(top+h>window.innerHeight-12){
      top=r.top-7-h;
      if(top<12)top=Math.max(12,window.innerHeight-h-12);
    }
    picker.style.left=left+'px';
    picker.style.top=Math.round(top)+'px';
    picker.style.width=w+'px';
  }
  function renderPicker(){
    if(!picker||!activeInput)return;
    activeRows=filteredOptions(activeInput);
    var currentValue=(activeInput.value||'').trim();
    activeIndex=activeRows.length?activeRows.findIndex(function(o){
      return o.value===currentValue||(o.value==='__WORKTREE__'&&activeInput.getAttribute('data-worktree')==='1');
    }): -1;
    if(activeRows.length&&activeIndex<0)activeIndex=0;
    picker.replaceChildren();
    if(!activeRows.length){
      var empty=document.createElement('div');empty.className='refpick-empty';empty.textContent='No matching refs';picker.appendChild(empty);
    }else{
      activeRows.forEach(function(o,i){
        var row=document.createElement('button');row.type='button';row.tabIndex=-1;row.id='ref-option-'+(activeInput.id||activeInput.getAttribute('id')||'input')+'-'+i;row.className='refpick-row'+(i===activeIndex?' is-active':'');row.setAttribute('role','option');row.setAttribute('aria-selected',i===activeIndex?'true':'false');row.setAttribute('data-value',o.value);
        var main=document.createElement('span');main.className='refpick-main';main.textContent=o.label;
        var meta=document.createElement('span');meta.className='refpick-meta';meta.textContent=o.meta;
        var kind=document.createElement('span');kind.className='refpick-kind';kind.textContent=o.kind;
        row.appendChild(main);row.appendChild(meta);row.appendChild(kind);
        row.addEventListener('mousedown',function(ev){ev.preventDefault();});
        row.addEventListener('mouseenter',function(){setActiveIndex(i,false);});
        row.addEventListener('click',function(ev){ev.preventDefault();chooseRef(o.value);});
        picker.appendChild(row);
      });
    }
    picker.hidden=false;activeInput.setAttribute('aria-expanded','true');syncActiveOption(false);placePicker();
  }
  function optionNodes(){
    if(!picker)return [];
    return picker.querySelectorAll?[].slice.call(picker.querySelectorAll('[role="option"]')):[].slice.call(picker.children||[]);
  }
  function syncActiveOption(scroll){
    var rows=optionNodes();
    rows.forEach(function(row,i){row.className='refpick-row'+(i===activeIndex?' is-active':'');row.setAttribute('aria-selected',i===activeIndex?'true':'false');});
    if(!activeInput||activeIndex<0||!rows[activeIndex]){if(activeInput)activeInput.removeAttribute('aria-activedescendant');return;}
    activeInput.setAttribute('aria-activedescendant',rows[activeIndex].id);
    if(scroll&&rows[activeIndex].scrollIntoView)rows[activeIndex].scrollIntoView({block:'nearest'});
  }
  function setActiveIndex(index,scroll){
    if(!activeRows.length){activeIndex=-1;syncActiveOption(false);return;}
    activeIndex=Math.max(0,Math.min(index,activeRows.length-1));syncActiveOption(scroll);
  }
  function openPicker(input,query){
    if(activeInput&&activeInput!==input){activeInput.setAttribute('aria-expanded','false');activeInput.removeAttribute('aria-activedescendant');}
    activeInput=input;
    activeIndex=-1;
    input.setAttribute('aria-expanded','true');
    if(query!==undefined)refQueries.set(input,query);
    renderPicker();
    ensureRefs().then(renderPicker);
  }
  function closePicker(){
    if(picker)picker.hidden=true;
    if(activeInput){activeInput.setAttribute('aria-expanded','false');activeInput.removeAttribute('aria-activedescendant');}
    activeInput=null;activeRows=[];activeIndex=-1;
  }
  function chooseRef(value){
    if(!activeInput||!value)return;
    refQueries.set(activeInput,'');
    if(value==='__WORKTREE__'){
      activeInput.value='Working tree';
      activeInput.setAttribute('data-worktree','1');
    }else{
      activeInput.value=value;
      activeInput.removeAttribute('data-worktree');
    }
    activeInput.dispatchEvent(new Event('change',{bubbles:true}));
    closePicker();
  }
  [].slice.call(document.querySelectorAll('[data-picker]')).forEach(function(input){
    input.addEventListener('focus',function(){openPicker(input,'');});
    input.addEventListener('click',function(){openPicker(input,refQueries.get(input)||'');});
    input.addEventListener('input',function(){input.removeAttribute('data-worktree');openPicker(input,input.value);});
    input.addEventListener('focusout',function(ev){
      var next=ev.relatedTarget;
      if(next&&picker&&picker.contains(next))return;
      setTimeout(function(){
        var focused=document.activeElement;
        if(activeInput===input&&focused!==input&&!(picker&&focused&&picker.contains(focused)))closePicker();
      },0);
    });
    input.addEventListener('keydown',function(ev){
      if(ev.key==='Escape'&&activeInput===input){ev.preventDefault();ev.stopPropagation();closePicker();return;}
      if(ev.key==='ArrowDown'||ev.key==='ArrowUp'||ev.key==='Home'||ev.key==='End'){
        ev.preventDefault();
        if(activeInput!==input||picker.hidden){openPicker(input,refQueries.get(input)||'');return;}
        if(ev.key==='Home')setActiveIndex(0,true);
        else if(ev.key==='End')setActiveIndex(activeRows.length-1,true);
        else setActiveIndex(activeIndex+(ev.key==='ArrowDown'?1:-1),true);
        return;
      }
      if(ev.key==='Enter'&&activeInput===input&&activeRows[activeIndex]&&activeRows[activeIndex].value){ev.preventDefault();chooseRef(activeRows[activeIndex].value);}
    });
  });
  document.addEventListener('mousedown',function(ev){
    if(!picker||picker.hidden)return;
    if(ev.target===picker||picker.contains(ev.target))return;
    if(activeInput&&ev.target===activeInput)return;
    closePicker();
  });
  window.addEventListener('resize',placePicker);
  window.addEventListener('scroll',placePicker,true);
  var autoScopeTimer=null;
  function navTo(url){location.href=url;}
  function currentRoute(){
    return (location.pathname||'')+(location.search||'');
  }
  function scheduleNavTo(url,delay){
    if(!url)return;
    if(autoScopeTimer)clearTimeout(autoScopeTimer);
    var go=function(){
      if(url!==currentRoute())navTo(url);
    };
    if(delay>0)autoScopeTimer=setTimeout(go,delay);
    else go();
  }
  function commitUrl(){
    var c=(commitRef&&commitRef.value||'HEAD').trim()||'HEAD';
    return '${esc(routeBase)}/change?scope=commit&commit='+encodeURIComponent(c);
  }
  function compareHeadValue(){
    var input=document.getElementById('cmpHead');
    if(!input||input.getAttribute('data-worktree')==='1')return '';
    var v=(input.value||'').trim();
    return v==='Working tree'?'':v;
  }
  function compareUrl(){
    var baseInput=document.getElementById('cmpBase');
    var b=(baseInput&&baseInput.value||'').trim();
    if(!b)return '';
    var u='${esc(routeBase)}/change?base='+encodeURIComponent(b);
    var h=compareHeadValue();
    if(h)u+='&head='+encodeURIComponent(h);
    return u;
  }
  var commitRef=document.getElementById('commitRef');
  if(commitRef){
    commitRef.addEventListener('change',function(){scheduleNavTo(commitUrl(),0);});
    commitRef.addEventListener('input',function(){scheduleNavTo(commitUrl(),700);});
  }
  ['cmpBase','cmpHead'].forEach(function(id){
    var input=document.getElementById(id);
    if(!input)return;
    input.addEventListener('change',function(){scheduleNavTo(compareUrl(),0);});
    input.addEventListener('input',function(){scheduleNavTo(compareUrl(),700);});
  });
})();
</script>
</body></html>`;
}
