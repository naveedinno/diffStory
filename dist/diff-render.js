// Shared diff-row rendering — the ONE place that turns view-model rows into
// HTML. Consumed by the story-step renderer, the All-files panels, the
// full-file endpoint, and the expand-context endpoint, so every surface
// draws rows identically. Pure functions; all content is escaped here.
import { highlight } from './highlight.js';
export function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function targetAttrs(target) {
    return target
        ? ` data-comment-code="1" data-comment-side="${target.side}" data-comment-file="${esc(target.file)}" data-comment-line="${target.line}"`
        : '';
}
export function rowAttrs(target, step) {
    return target
        ? ` data-file="${esc(target.file)}" data-line="${target.line}" data-side="${target.side}"${step ? ` data-step="${esc(step)}"` : ''}`
        : '';
}
function reviewRowAttrs(target, type, content, step) {
    if (!target)
        return '';
    const action = type === 'add' ? 'Added' : type === 'del' ? 'Deleted' : 'Context';
    const version = target.side === 'left' ? 'before' : 'after';
    // Keep the renderer tolerant of the legacy full-file row shape used by old
    // callers while still giving modern rows a useful accessible description.
    const summary = String(content ?? '').trim().replace(/\s+/g, ' ') || 'blank line';
    return `${rowAttrs(target, step)} data-review-row role="group" tabindex="-1" aria-keyshortcuts="C" aria-label="${esc(`${action} ${version} line ${target.line} in ${target.file}: ${summary}`)}"`;
}
/** One side of a split row. Copied verbatim from render.ts cell(). */
function cell(side, row, target, intra) {
    const add = row.type === 'add';
    const del = row.type === 'del';
    const sideCls = side === 'left' ? ' ds-cell-l' : ' ds-cell-r';
    // An add has no left counterpart; a del has no right counterpart.
    if ((side === 'left' && add) || (side === 'right' && del)) {
        return `<span class="ds-cell ds-cell-empty${sideCls}"></span>`;
    }
    let no = '';
    let sign = '';
    let signClass = '';
    if (side === 'left') {
        no = row.oldNo !== undefined ? String(row.oldNo) : '';
        if (del) {
            sign = '−';
            signClass = ' ds-sign-del';
        }
    }
    else {
        no = row.newNo !== undefined ? String(row.newNo) : '';
        if (add) {
            sign = '+';
            signClass = ' ds-sign-add';
        }
    }
    let tint = '';
    if (side === 'right' && add)
        tint = row.untoured ? ' ds-cell-untoured' : ' ds-cell-add';
    else if (side === 'left' && del)
        tint = ' ds-cell-del';
    const flag = side === 'right' && add && row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
    return `<span class="ds-cell${tint}${sideCls}"><span class="ds-no">${no}</span><span class="ds-sign${signClass}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${(intra ?? highlight(row.content)) || ' '}</span>${flag}</span>`;
}
/** Context/new-file steps render one full-width cell. Verbatim from singleCell()
 *  — note it deliberately takes no intra (single-cell rows never word-diff). */
function singleCell(row, target) {
    const no = row.newNo ?? row.oldNo ?? '';
    const add = row.type === 'add';
    const sign = add ? '+' : '';
    const signCls = add ? ' ds-sign-add' : '';
    const tint = add ? (row.untoured ? ' ds-cell-untoured' : ' ds-cell-add') : '';
    const flag = add && row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
    return `<span class="ds-cell ds-cell-single${tint}"><span class="ds-no">${no}</span><span class="ds-sign${signCls}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${highlight(row.content) || ' '}</span>${flag}</span>`;
}
export function renderSplitRow(row, opts = {}) {
    const primaryTarget = opts.rightTarget ?? opts.leftTarget;
    const attrs = reviewRowAttrs(primaryTarget, row.type, row.content, primaryTarget ? opts.stepId : undefined);
    const focusAttr = opts.focusIndex === null || opts.focusIndex === undefined ? '' : ` data-step-focus="${opts.focusIndex}"`;
    const cameraAttr = opts.cameraIndices?.length ? ` data-step-camera="${opts.cameraIndices.join(' ')}"` : '';
    const cells = opts.single
        ? singleCell(row, opts.rightTarget)
        : `${cell('left', row, opts.leftTarget, opts.sides?.left)}<span class="ds-celldiv" aria-hidden="true"></span>${cell('right', row, opts.rightTarget, opts.sides?.right)}`;
    return `<div class="ds-row ds-row-${row.type}"${attrs}${focusAttr}${cameraAttr}>${cells}</div>`;
}
export function renderUnifiedRow(row, target, intra) {
    const sign = row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' ';
    const flag = row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
    const attrs = reviewRowAttrs(target, row.type, row.content);
    return `<div class="ds-urow ds-row-${row.type}${row.untoured ? ' is-untoured' : ''}"${attrs}><span class="ds-no">${row.no ?? ''}</span><span class="ds-sign ds-sign-${row.type}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${(intra ?? highlight(row.content)) || ' '}</span>${flag}</div>`;
}
/** The ⋯ separator between hunks. Bare (no gap info) matches the legacy markup;
 *  Task 6 passes GapInfo to make it expandable. */
export function renderHunkGap(gap, opts = {}) {
    if (!gap) {
        return opts.split
            ? `<div class="ds-hunkgap ds-hunkgap-split"><span class="ds-gap-side ds-gap-side-l"></span><span class="ds-gap-mid"><span>⋯</span></span><span class="ds-gap-side ds-gap-side-r"></span></div>`
            : `<div class="ds-hunkgap"><span>⋯</span></div>`;
    }
    const up = gap.to === 'eof'
        ? ''
        : `<button type="button" class="ds-gapbtn" data-expand="up" title="Show the last 20 hidden lines" aria-label="Show the last 20 hidden lines">↑ 20</button>`;
    const open = `<div class="ds-hunkgap is-expandable${opts.split ? ' ds-hunkgap-split' : ''}" data-gap data-gap-file="${esc(gap.file)}" data-gap-from="${gap.from}" data-gap-to="${gap.to}">`;
    if (!opts.split) {
        return (open +
            `<button type="button" class="ds-gapbtn" data-expand="down" title="Show the first 20 hidden lines" aria-label="Show the first 20 hidden lines">↓ 20</button>` +
            `<span class="ds-gapdots">⋯</span>` +
            `<button type="button" class="ds-gapbtn" data-expand="all" title="Show all hidden lines" aria-label="Show all hidden lines">all</button>` +
            `<span class="ds-gapdots">⋯</span>` +
            up +
            `</div>`);
    }
    return (open +
        `<span class="ds-gap-side ds-gap-side-l"><button type="button" class="ds-gapbtn" data-expand="down" title="Show the first 20 hidden lines" aria-label="Show the first 20 hidden lines">↓ 20</button><span class="ds-gapdots">⋯</span></span>` +
        `<span class="ds-gap-mid"><button type="button" class="ds-gapbtn" data-expand="all" title="Show all hidden lines" aria-label="Show all hidden lines">all</button></span>` +
        `<span class="ds-gap-side ds-gap-side-r"><span class="ds-gapdots">⋯</span>${up}</span>` +
        `</div>`);
}
