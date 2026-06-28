// One shared top bar for diffStory's Apple-HIG "front-door" screens (repo picker,
// story selector, change/generate). The point is consistency: the wordmark always
// goes home, a breadcrumb always says where you are, and every segment is a real
// link. It is self-contained — it ships its own --nv-* tokens and never depends on
// a page's palette, so dropping navBar()+navStyles() into any screen Just Works.

import { brandMarkSvg } from './brand.js';

export interface Crumb {
  /** Visible text for this breadcrumb segment. */
  label: string;
  /** Link target. Omit for the current (non-link, bold) segment — usually the last. */
  href?: string;
}

const NV_MARK = brandMarkSvg('nv-mark', 22, 22);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The persistent top bar. `home` is where the wordmark points (defaults to the repo
 * picker). `crumbs` render left→right after the wordmark; the last one (or any with
 * no href) shows as the current location. `right` is an optional HTML slot for
 * page-specific actions (use the .nv-act / .nv-pri button classes from navStyles()).
 */
export function navBar(opts: { home?: string; crumbs?: Crumb[]; right?: string } = {}): string {
  const home = opts.home ?? '/repos';
  const crumbs = opts.crumbs ?? [];
  const trail = crumbs
    .map((c, i) => {
      const last = i === crumbs.length - 1;
      const sep = i === 0 ? '' : `<span class="nv-sep" aria-hidden="true">/</span>`;
      const node =
        c.href && !last
          ? `<a class="nv-crumb" href="${esc(c.href)}">${esc(c.label)}</a>`
          : `<span class="nv-crumb nv-cur" aria-current="page">${esc(c.label)}</span>`;
      return sep + node;
    })
    .join('');

  return (
    `<header class="ds-nav">` +
    `<a class="nv-brand" href="${esc(home)}" title="Home — your repositories" aria-label="Home">` +
    `${NV_MARK}<span class="nv-word"><span class="nv-word-a">diff</span><span class="nv-word-b">Story</span></span>` +
    `</a>` +
    (crumbs.length
      ? `<span class="nv-vsep" aria-hidden="true"></span><nav class="nv-trail" aria-label="Breadcrumb">${trail}</nav>`
      : '') +
    `<span class="nv-spacer"></span>` +
    (opts.right ?? '') +
    `</header>`
  );
}

/** Styles for the bar. Include once per page, inside the page's own <style>. */
export function navStyles(): string {
  return `
:root{
  --nv-bg:rgba(246,246,248,.82);--nv-bd:rgba(0,0,0,.10);--nv-fg:#1d1d1f;--nv-mut:#6e6e73;--nv-dim:#8e8e93;
  --nv-blue:#007aff;--nv-blue2:#0067d6;--nv-fill:rgba(0,0,0,.05);--nv-fill2:rgba(0,0,0,.09);
}
@media (prefers-color-scheme:dark){:root{
  --nv-bg:rgba(28,28,30,.80);--nv-bd:rgba(255,255,255,.12);--nv-fg:#f5f5f7;--nv-mut:#aeaeb2;--nv-dim:#8e8e93;
  --nv-blue:#0a84ff;--nv-blue2:#3395ff;--nv-fill:rgba(255,255,255,.07);--nv-fill2:rgba(255,255,255,.12);
}}
.ds-nav{position:sticky;top:0;z-index:30;height:52px;display:flex;align-items:center;gap:11px;padding:0 18px;
  background:var(--nv-bg);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);
  border-bottom:.5px solid var(--nv-bd)}
.nv-brand{display:inline-flex;align-items:center;gap:8px;flex:none;color:var(--nv-fg);text-decoration:none;
  padding:5px 7px;margin-left:-7px;border-radius:8px}
.nv-brand:hover{background:var(--nv-fill)}
.nv-brand:focus-visible{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--nv-blue) 36%,transparent)}
.nv-mark{display:block;--ds-brand-path:var(--nv-blue);--ds-brand-node-a:var(--nv-fg);--ds-brand-node-b:#64d2ff;--ds-brand-node-c:var(--nv-fg)}
.nv-word{font-size:15px;letter-spacing:-.01em}
.nv-word-a{color:var(--nv-mut);font-weight:500}.nv-word-b{color:var(--nv-fg);font-weight:600}
.nv-vsep{width:1px;height:20px;background:var(--nv-bd);flex:none}
.nv-trail{display:flex;align-items:center;gap:3px;min-width:0;overflow:hidden}
.nv-crumb{font-size:13.5px;color:var(--nv-blue);text-decoration:none;white-space:nowrap;padding:3px 6px;border-radius:7px;
  overflow:hidden;text-overflow:ellipsis;max-width:42ch}
a.nv-crumb:hover{background:var(--nv-fill)}
a.nv-crumb:focus-visible{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--nv-blue) 36%,transparent)}
.nv-crumb.nv-cur{color:var(--nv-fg);font-weight:600;cursor:default}
.nv-sep{color:var(--nv-dim);font-size:13px;flex:none;opacity:.7}
.nv-spacer{flex:1 1 auto;min-width:8px}
.nv-act,.nv-pri{display:inline-flex;align-items:center;gap:6px;flex:none;height:32px;padding:0 13px;border-radius:8px;
  font:inherit;font-size:13.5px;font-weight:590;cursor:pointer;text-decoration:none;white-space:nowrap;letter-spacing:-.01em}
.nv-act{color:var(--nv-fg);background:var(--nv-fill);border:.5px solid var(--nv-bd)}
.nv-act:hover{background:var(--nv-fill2)}
.nv-pri{color:#fff;background:var(--nv-blue);border:.5px solid transparent;font-weight:600;
  box-shadow:0 1px 2px rgba(0,40,120,.18)}
.nv-pri:hover{background:var(--nv-blue2)}
.nv-act:focus-visible,.nv-pri:focus-visible{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--nv-blue) 36%,transparent)}
@media (max-width:560px){.ds-nav{padding:0 13px;gap:8px}.nv-word{display:none}.nv-act{padding:0 10px}}
`;
}
