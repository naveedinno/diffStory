// Shared diff-row rendering — the ONE place that turns view-model rows into
// HTML. Consumed by the story-step renderer, the All-files panels, the
// full-file endpoint, and the expand-context endpoint, so every surface
// draws rows identically. Pure functions; all content is escaped here.
import { highlight } from './highlight.js';
import type { IntraSides } from './intra-line.js';
import type { SbsRow, UnifiedRow } from './view-model.js';

export type RowSide = 'left' | 'right';
export interface RowTarget { side: RowSide; file: string; line: number }

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function targetAttrs(target?: RowTarget): string {
  return target
    ? ` data-comment-code="1" data-comment-side="${target.side}" data-comment-file="${esc(
        target.file,
      )}" data-comment-line="${target.line}"`
    : '';
}

export function rowAttrs(target?: RowTarget, step?: string): string {
  return target
    ? ` data-file="${esc(target.file)}" data-line="${target.line}" data-side="${target.side}"${
        step ? ` data-step="${esc(step)}"` : ''
      }`
    : '';
}

/** One side of a split row. Copied verbatim from render.ts cell(). */
function cell(side: RowSide, row: SbsRow, target?: RowTarget, intra?: string): string {
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
  } else {
    no = row.newNo !== undefined ? String(row.newNo) : '';
    if (add) {
      sign = '+';
      signClass = ' ds-sign-add';
    }
  }
  let tint = '';
  if (side === 'right' && add) tint = row.untoured ? ' ds-cell-untoured' : ' ds-cell-add';
  else if (side === 'left' && del) tint = ' ds-cell-del';
  const flag = side === 'right' && add && row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
  return `<span class="ds-cell${tint}${sideCls}"><span class="ds-no">${no}</span><span class="ds-sign${signClass}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${
    (intra ?? highlight(row.content)) || ' '
  }</span>${flag}</span>`;
}

/** Context/new-file steps render one full-width cell. Verbatim from singleCell()
 *  — note it deliberately takes no intra (single-cell rows never word-diff). */
function singleCell(row: SbsRow, target?: RowTarget): string {
  const no = row.newNo ?? row.oldNo ?? '';
  const add = row.type === 'add';
  const sign = add ? '+' : '';
  const signCls = add ? ' ds-sign-add' : '';
  const tint = add ? (row.untoured ? ' ds-cell-untoured' : ' ds-cell-add') : '';
  const flag = add && row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
  return `<span class="ds-cell ds-cell-single${tint}"><span class="ds-no">${no}</span><span class="ds-sign${signCls}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${
    highlight(row.content) || ' '
  }</span>${flag}</span>`;
}

export interface SplitRowOpts {
  leftTarget?: RowTarget;
  rightTarget?: RowTarget;
  stepId?: string;
  /** Emit data-step-focus when a number; null/undefined omits it. */
  focusIndex?: number | null;
  /** Render the single-cell layout (context / new-file steps). */
  single?: boolean;
  sides?: IntraSides;
}

export function renderSplitRow(row: SbsRow, opts: SplitRowOpts = {}): string {
  const primaryTarget = opts.rightTarget ?? opts.leftTarget;
  const attrs = rowAttrs(primaryTarget, primaryTarget ? opts.stepId : undefined);
  const focusAttr =
    opts.focusIndex === null || opts.focusIndex === undefined ? '' : ` data-step-focus="${opts.focusIndex}"`;
  const cells = opts.single
    ? singleCell(row, opts.rightTarget)
    : `${cell('left', row, opts.leftTarget, opts.sides?.left)}<span class="ds-celldiv"></span>${cell(
        'right', row, opts.rightTarget, opts.sides?.right,
      )}`;
  return `<div class="ds-row ds-row-${row.type}"${attrs}${focusAttr}>${cells}</div>`;
}

export function renderUnifiedRow(row: UnifiedRow, target?: RowTarget, intra?: string): string {
  const sign = row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' ';
  const flag = row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
  const attrs = rowAttrs(target);
  return `<div class="ds-urow ds-row-${row.type}${row.untoured ? ' is-untoured' : ''}"${attrs}><span class="ds-no">${
    row.no ?? ''
  }</span><span class="ds-sign ds-sign-${row.type}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${
    (intra ?? highlight(row.content)) || ' '
  }</span>${flag}</div>`;
}

export interface GapInfo { file: string; from: number; to: number | 'eof' }

/** The ⋯ separator between hunks. Bare (no gap info) matches the legacy markup;
 *  Task 6 passes GapInfo to make it expandable. */
export function renderHunkGap(gap?: GapInfo): string {
  if (!gap) return `<div class="ds-hunkgap"><span>⋯</span></div>`;
  // Task 6 fills this branch in; until then it is unreachable.
  return `<div class="ds-hunkgap"><span>⋯</span></div>`;
}
