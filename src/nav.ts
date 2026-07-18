// One shared top bar for diffStory's Signal "front-door" screens (repo picker,
// story selector, change/generate): a flat floating island per direction 3b. The
// point is consistency: the wordmark always goes home, a breadcrumb always says
// where you are, and every segment is a real link. It is self-contained — its
// --nv-* names alias the canonical tokens, so navBar()+navStyles() Just Works.

import { brandMarkSvg } from './brand.js';
import { themeControl, themeControlStyles } from './theme.js';

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
    themeControl() +
    (opts.right ?? '') +
    `</header>`
  );
}

/** Styles for the bar. Include once per page, inside the page's own <style>. */
export function navStyles(): string {
  return `
/* Signal 3b: alias nav names onto the canonical tokens (one-directional; all flip via canonical). */
:root{
  --nv-bg:var(--surface);--nv-bd:var(--line);--nv-bd-soft:var(--line-soft);--nv-fg:var(--text);--nv-mut:var(--text-2);--nv-dim:var(--text-3);
  --nv-blue:var(--accent);--nv-blue2:var(--accent-hi);--nv-fill:var(--fill-2);--nv-fill2:var(--fill-3);
}
${themeControlStyles()}
.ds-nav{position:sticky;top:10px;z-index:30;height:50px;display:flex;align-items:center;gap:11px;padding:0 16px;margin:10px 12px 0;
  background:var(--nv-bg);border:1px solid var(--nv-bd-soft);border-radius:var(--radius-island)}
.nv-brand{display:inline-flex;align-items:center;gap:8px;flex:none;color:var(--nv-fg);text-decoration:none;
  padding:5px 7px;margin-left:-7px;border-radius:var(--radius)}
.nv-brand:hover{background:var(--nv-fill)}
.nv-brand:active{transform:scale(.98)}
.nv-brand:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.nv-mark{display:block;--ds-brand-path:var(--nv-blue);--ds-brand-node-a:var(--nv-fg);--ds-brand-node-b:var(--nv-blue2);--ds-brand-node-c:var(--nv-fg)}
.nv-word{font-size:15px;letter-spacing:-.01em}
.nv-word-a{color:var(--nv-mut);font-weight:500}.nv-word-b{color:var(--nv-fg);font-weight:600}
.nv-vsep{width:1px;height:20px;background:var(--nv-bd);flex:none}
.nv-trail{display:flex;align-items:center;gap:3px;min-width:0;overflow:hidden}
.nv-crumb{font-size:13.5px;color:var(--nv-blue);text-decoration:none;white-space:nowrap;padding:3px 6px;border-radius:var(--radius-sm);
  overflow:hidden;text-overflow:ellipsis;max-width:42ch}
a.nv-crumb:hover{background:var(--nv-fill)}
a.nv-crumb:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.nv-crumb.nv-cur{color:var(--nv-fg);font-weight:600;cursor:default}
.nv-sep{color:var(--nv-dim);font-size:13px;flex:none;opacity:.7}
.nv-spacer{flex:1 1 auto;min-width:8px}
.nv-act,.nv-pri{display:inline-flex;align-items:center;gap:6px;flex:none;height:var(--control-h);padding:0 13px;border-radius:var(--radius);
  font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap;letter-spacing:-.01em}
.nv-act{color:var(--nv-fg);background:var(--nv-fill);border:1px solid var(--nv-bd)}
.nv-act:hover{background:var(--nv-fill2)}
.nv-pri{color:var(--on-accent);background:var(--nv-blue);border:1px solid transparent;font-weight:600}
.nv-pri:hover{background:var(--nv-blue2)}
.nv-act:active,.nv-pri:active{transform:scale(.97)}
.nv-brand,.nv-act,.nv-pri{transition:background-color var(--motion-duration-press) ease-out,transform var(--motion-duration-press) ease-out,box-shadow var(--motion-duration-press) ease-out}
.nv-act:focus-visible,.nv-pri:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
@media (max-width:560px){.ds-nav{padding:0 13px;gap:8px;margin:8px 8px 0;top:8px}.nv-word{display:none}.nv-act{padding:0 10px}}
@media (prefers-reduced-motion:reduce){.nv-brand,.nv-act,.nv-pri{transition:none}.nv-brand:active,.nv-act:active,.nv-pri:active{transform:none}}
@media (prefers-contrast:more){.ds-nav{border-color:var(--nv-fg)}.nv-act{border-color:var(--nv-fg)}}
`;
}
