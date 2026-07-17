const THREAD_PATH_D = 'M6.6 5.4h8.7c2 0 3.6 1.6 3.6 3.6s-1.6 3.6-3.6 3.6H8.8c-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8h8.6';
const THREAD_PATH_MONO_BODY = `<path d="${THREAD_PATH_D}" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="6.6" cy="5.4" r="2.35" fill="currentColor"/>` +
    `<circle cx="15.3" cy="12.6" r="2.35" fill="currentColor"/>` +
    `<circle cx="17.4" cy="20.2" r="2.35" fill="currentColor"/>`;
const THREAD_PATH_COLOR_BODY = `<path d="${THREAD_PATH_D}" fill="none" stroke="var(--ds-brand-path,currentColor)" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="6.6" cy="5.4" r="2.35" fill="var(--ds-brand-node-a,currentColor)"/>` +
    `<circle cx="15.3" cy="12.6" r="2.35" fill="var(--ds-brand-node-b,currentColor)"/>` +
    `<circle cx="17.4" cy="20.2" r="2.35" fill="var(--ds-brand-node-c,currentColor)"/>`;
export function brandMarkSvg(className, width, height, tone = 'color') {
    const body = tone === 'mono' ? THREAD_PATH_MONO_BODY : THREAD_PATH_COLOR_BODY;
    return `<svg class="${className}" viewBox="0 0 24 24" width="${width}" height="${height}" aria-hidden="true">${body}</svg>`;
}
export function brandStoryMarkSvg(className, width, height) {
    return brandMarkSvg(className, width, height, 'mono');
}
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<style>:root{--path:#0072d6;--node:#14171c;--mid:#7adfff}@media (prefers-color-scheme:dark){:root{--path:#3fb2ff;--node:#eef1f5;--mid:#7adfff}}</style>` +
    `<path d="${THREAD_PATH_D}" fill="none" stroke="var(--path)" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="6.6" cy="5.4" r="2.35" fill="var(--node)"/>` +
    `<circle cx="15.3" cy="12.6" r="2.35" fill="var(--mid)"/>` +
    `<circle cx="17.4" cy="20.2" r="2.35" fill="var(--node)"/>` +
    `</svg>`;
const MASK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    THREAD_PATH_MONO_BODY.replace(/currentColor/g, '#000') +
    `</svg>`;
function svgDataUri(svg) {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
export const BRAND_FAVICON_HREF = svgDataUri(FAVICON_SVG);
export const BRAND_MASK_ICON_HREF = svgDataUri(MASK_ICON_SVG);
export const BRAND_HEAD_LINKS = `<link rel="icon" type="image/svg+xml" href="${BRAND_FAVICON_HREF}">` +
    `<link rel="mask-icon" href="${BRAND_MASK_ICON_HREF}" color="#0072d6">`;
