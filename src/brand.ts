const THREAD_PATH_D =
  'M6.6 5.4h8.7c2 0 3.6 1.6 3.6 3.6s-1.6 3.6-3.6 3.6H8.8c-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8h8.6';

const THREAD_BACKDROP_D = 'M-30 38H560c46 0 46 62 0 62H210c-46 0-46 62 0 62H930';
const CHANGE_SCOPE_THREAD_D = 'M-30 38H870c26 0 26 62 0 62H10c-26 0-26 126 0 126H930';

const THREAD_PATH_MONO_BODY =
  `<path d="${THREAD_PATH_D}" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<circle cx="6.6" cy="5.4" r="2.35" fill="currentColor"/>` +
  `<circle cx="15.3" cy="12.6" r="2.35" fill="currentColor"/>` +
  `<circle cx="17.4" cy="20.2" r="2.35" fill="currentColor"/>`;

const THREAD_PATH_COLOR_BODY =
  `<path d="${THREAD_PATH_D}" fill="none" stroke="var(--ds-brand-path,currentColor)" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<circle cx="6.6" cy="5.4" r="2.35" fill="var(--ds-brand-node-a,currentColor)"/>` +
  `<circle cx="15.3" cy="12.6" r="2.35" fill="var(--ds-brand-node-b,currentColor)"/>` +
  `<circle cx="17.4" cy="20.2" r="2.35" fill="var(--ds-brand-node-c,currentColor)"/>`;

export function brandMarkSvg(className: string, width: number, height: number, tone: 'mono' | 'color' = 'color'): string {
  const body = tone === 'mono' ? THREAD_PATH_MONO_BODY : THREAD_PATH_COLOR_BODY;
  return `<svg class="${className}" viewBox="0 0 24 24" width="${width}" height="${height}" aria-hidden="true">${body}</svg>`;
}

export function brandStoryMarkSvg(className: string, width: number, height: number): string {
  return brandMarkSvg(className, width, height, 'mono');
}

function threadBackdropSvg(path: string, height: number, nodes: string, className: string): string {
  return (
    `<svg class="${className}" viewBox="0 0 900 ${height}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
    `<path class="thread-base" d="${path}" pathLength="100"/>` +
    `<path class="thread-pulse" d="${path}" pathLength="100"/>` +
    `<g class="thread-nodes">${nodes}</g></svg>`
  );
}

/** The masthead-scale Thread Path used as the shared page atmosphere. */
export function brandThreadBackdropSvg(className = 'ds-atmosphere-thread'): string {
  return threadBackdropSvg(
    THREAD_BACKDROP_D,
    190,
    `<circle cx="60" cy="38" r="3.2" opacity=".45"/>` +
      `<circle class="node-mid" cx="385" cy="100" r="3.2" opacity=".85"/>` +
      `<circle cx="760" cy="162" r="3.2" opacity=".45"/>`,
    className,
  );
}

/** A collision-safe Thread Path that uses the scope page's three empty horizontal bands. */
export function brandChangeScopeThreadSvg(className = 'ds-atmosphere-thread ds-scope-thread'): string {
  return threadBackdropSvg(
    CHANGE_SCOPE_THREAD_D,
    240,
    `<circle cx="72" cy="38" r="3.2" opacity=".45"/>` +
      `<circle class="node-mid" cx="650" cy="100" r="3.2" opacity=".85"/>` +
      `<circle cx="760" cy="226" r="3.2" opacity=".45"/>`,
    className,
  );
}

const FAVICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
  `<style>:root{--path:#0072d6;--node:#14171c;--mid:#7adfff}@media (prefers-color-scheme:dark){:root{--path:#3fb2ff;--node:#eef1f5;--mid:#7adfff}}</style>` +
  `<path d="${THREAD_PATH_D}" fill="none" stroke="var(--path)" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<circle cx="6.6" cy="5.4" r="2.35" fill="var(--node)"/>` +
  `<circle cx="15.3" cy="12.6" r="2.35" fill="var(--mid)"/>` +
  `<circle cx="17.4" cy="20.2" r="2.35" fill="var(--node)"/>` +
  `</svg>`;

const MASK_ICON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
  THREAD_PATH_MONO_BODY.replace(/currentColor/g, '#000') +
  `</svg>`;

function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const BRAND_FAVICON_HREF = svgDataUri(FAVICON_SVG);
export const BRAND_MASK_ICON_HREF = svgDataUri(MASK_ICON_SVG);
export const BRAND_HEAD_LINKS =
  `<link rel="icon" type="image/svg+xml" href="${BRAND_FAVICON_HREF}">` +
  `<link rel="mask-icon" href="${BRAND_MASK_ICON_HREF}" color="#0072d6">`;
