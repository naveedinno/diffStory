// Shared diff-row rendering — the ONE place that turns view-model rows into
// HTML. Consumed by the story-step renderer, the All-files panels, the
// full-file endpoint, and the expand-context endpoint, so every surface
// draws rows identically. Pure functions; all content is escaped here.
import { highlight, highlightNavigable } from './highlight.js';
import type { IntraSides } from './intra-line.js';
import type { MovedMark, SbsRow, UnifiedRow } from './view-model.js';

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

function reviewRowAttrs(
  target: RowTarget | undefined,
  type: SbsRow['type'] | UnifiedRow['type'],
  content: string | undefined,
  step?: string,
  changePair?: boolean,
  moved?: boolean,
): string {
  if (!target) return '';
  const action = changePair
    ? 'Changed'
    : moved && type !== 'ctx'
      ? 'Moved'
      : type === 'add' ? 'Added' : type === 'del' ? 'Deleted' : 'Context';
  const version = target.side === 'left' ? 'before' : 'after';
  // Keep the renderer tolerant of the legacy full-file row shape used by old
  // callers while still giving modern rows a useful accessible description.
  const summary = String(content ?? '').trim().replace(/\s+/g, ' ') || 'blank line';
  return `${rowAttrs(target, step)} data-review-row role="group" tabindex="-1" aria-keyshortcuts="C B" aria-label="${esc(
    `${action} ${version} line ${target.line} in ${target.file}: ${summary}`,
  )}"`;
}

/** The jump to a moved line's other end. The tag says where it went; the
 *  engine scrolls to `[data-side][data-line]` in the same file on click. */
function movedTagHtml(moved: MovedMark | undefined): string {
  if (!moved) return '';
  const text = moved.side === 'right' ? `Moved to ${moved.line}` : `Moved from ${moved.line}`;
  const where = `${moved.side === 'right' ? 'after' : 'before'} line ${moved.line}`;
  return `<button type="button" class="ds-moved-tag" data-moved-jump data-moved-side="${moved.side}" data-moved-line="${moved.line}" title="Jump to ${where}" aria-label="${text}: jump to ${where}">${text}</button>`;
}

function highlightedCode(code: string, target?: RowTarget): string {
  return target?.side === 'right' ? highlightNavigable(code) : highlight(code);
}

/** True when a row has nothing on `side`: an add has no left counterpart, a
 *  del has no right counterpart, and a merged pair can carry one side only. */
export function sideAbsent(side: RowSide, row: SbsRow): boolean {
  const sideContent = row.paired ? (side === 'left' ? row.leftContent : row.rightContent) : row.content;
  return (
    (row.paired && sideContent === undefined) ||
    (!row.paired && ((side === 'left' && row.type === 'add') || (side === 'right' && row.type === 'del')))
  );
}

/** One side of a split row. Copied verbatim from render.ts cell(). */
function cell(side: RowSide, row: SbsRow, target?: RowTarget, intra?: string, tag?: number | null): string {
  const add = row.type === 'add';
  const del = row.type === 'del';
  const sideCls = side === 'left' ? ' ds-cell-l' : ' ds-cell-r';
  const sideContent = row.paired ? (side === 'left' ? row.leftContent : row.rightContent) : row.content;
  if (sideAbsent(side, row)) {
    return `<span class="ds-cell ds-cell-empty${sideCls}"></span>`;
  }
  let no = '';
  let sign = '';
  let signClass = '';
  if (side === 'left') {
    no = row.oldNo !== undefined ? String(row.oldNo) : '';
    if (del) {
      sign = row.moved ? '↕' : '−';
      signClass = row.moved ? ' ds-sign-moved' : ' ds-sign-del';
    }
  } else {
    no = row.newNo !== undefined ? String(row.newNo) : '';
    if (add) {
      sign = row.moved ? '↕' : '+';
      signClass = row.moved ? ' ds-sign-moved' : ' ds-sign-add';
    }
  }
  let tint = '';
  if (row.paired) tint = side === 'left' ? ' ds-cell-del ds-cell-paired' : ' ds-cell-add ds-cell-paired';
  else if (row.moved && ((side === 'right' && add) || (side === 'left' && del))) tint = ' ds-cell-moved';
  else if (side === 'right' && add) tint = row.untoured ? ' ds-cell-untoured' : ' ds-cell-add';
  else if (side === 'left' && del) tint = ' ds-cell-del';
  const flag = (side === 'right' && untouredRow(row) && !row.moved ? untouredTagHtml(tag) : '') + movedTagHtml(row.moved);
  return `<span class="ds-cell${tint}${sideCls}"><span class="ds-no">${no}</span><span class="ds-sign${signClass}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${
    (intra ?? highlightedCode(sideContent ?? '', target)) || ' '
  }</span>${flag}</span>`;
}

/** The fields the unexplained logic reads; both row shapes carry them. */
export interface UntourableRow { type: string; untoured?: boolean; changePair?: boolean }

/** Rows a tag would mark: added or changed lines the story never covered. */
function untouredRow(row: UntourableRow): boolean {
  return !!row.untoured && (row.type === 'add' || !!row.changePair);
}

/** True when every changed row of a file is untoured: the story never visits
 *  the file at all. That is one fact about the file, not one per line, so the
 *  file gets a head badge and its rows render plain (see plainRows). */
export function wholeUntoured(rows: UntourableRow[]): boolean {
  let any = false;
  for (const row of rows) {
    const changed = row.type === 'add' || !!row.changePair;
    if (!changed) continue;
    if (!row.untoured) return false;
    any = true;
  }
  return any;
}

/** Copies with the per-row flag cleared, for a wholly untoured file. */
export function plainRows<T extends UntourableRow>(rows: T[]): T[] {
  return rows.map((row) => (row.untoured ? { ...row, untoured: false } : row));
}

/** One tag per run of consecutive unexplained rows, on the first row, with
 *  the run length. A 237-line untoured file says it once, not 237 times. */
export function untouredRuns<T extends UntourableRow>(rows: T[]): Map<T, number> {
  const runs = new Map<T, number>();
  let head: T | undefined;
  for (const row of rows) {
    if (!untouredRow(row)) {
      head = undefined;
      continue;
    }
    if (head) runs.set(head, (runs.get(head) ?? 0) + 1);
    else {
      head = row;
      runs.set(head, 1);
    }
  }
  return runs;
}

/** undefined keeps the legacy one-tag-per-row behaviour; null suppresses the
 *  tag (a later row of a run); a number is the run length to show. */
function untouredTagHtml(tag: number | null | undefined): string {
  if (tag === null) return '';
  const n = tag ?? 1;
  return n > 1
    ? `<span class="ds-untoured-tag" title="${n} unexplained lines">UNEXPLAINED ×${n}</span>`
    : '<span class="ds-untoured-tag">UNEXPLAINED</span>';
}

/** Context/new-file steps render one full-width cell. Verbatim from singleCell()
 *  — note it deliberately takes no intra (single-cell rows never word-diff). */
function singleCell(row: SbsRow, target?: RowTarget, tag?: number | null): string {
  const no = row.newNo ?? row.oldNo ?? '';
  const add = row.type === 'add';
  const sign = add ? '+' : '';
  const signCls = add ? ' ds-sign-add' : '';
  const tint = add ? (row.untoured ? ' ds-cell-untoured' : ' ds-cell-add') : '';
  const flag = add && row.untoured ? untouredTagHtml(tag) : '';
  return `<span class="ds-cell ds-cell-single${tint}"><span class="ds-no">${no}</span><span class="ds-sign${signCls}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${
    highlightedCode(row.content, target) || ' '
  }</span>${flag}</span>`;
}

export interface SplitRowOpts {
  leftTarget?: RowTarget;
  rightTarget?: RowTarget;
  stepId?: string;
  /** Logical row index within a two-column body; set by SplitColumns. */
  ri?: number;
  /** Emit data-step-focus when a number; null/undefined omits it. */
  focusIndex?: number | null;
  /** Render the single-cell layout (context / new-file steps). */
  single?: boolean;
  sides?: IntraSides;
  /** Semantic move endpoint tokens resolved by the server for this row. */
  moveTokens?: string[];
  /** See untouredRuns(): the run length on a run's first row, null after it. */
  untouredTag?: number | null;
}

function rowExtraAttrs(opts: SplitRowOpts): string {
  const focusAttr =
    opts.focusIndex === null || opts.focusIndex === undefined ? '' : ` data-step-focus="${opts.focusIndex}"`;
  const moveAttr = opts.moveTokens?.length ? ` data-move="${esc(opts.moveTokens.join(' '))}"` : '';
  return focusAttr + moveAttr;
}

/** The one-column layout used by context and new-file steps. Two-column
 *  bodies are built from `renderSplitHalves` through `SplitColumns`; asking
 *  this for a two-cell row is a caller bug, not a layout choice. */
export function renderSplitRow(row: SbsRow, opts: SplitRowOpts = {}): string {
  if (!opts.single) throw new Error('renderSplitRow renders single-cell rows only; use SplitColumns');
  const target = opts.rightTarget ?? opts.leftTarget;
  const attrs = reviewRowAttrs(
    target,
    row.type,
    row.rightContent ?? row.leftContent ?? row.content,
    target ? opts.stepId : undefined,
    row.changePair,
  );
  return `<div class="ds-row ds-row-${row.type}${
    row.changePair ? ' ds-row-pair' : ''
  }"${attrs}${rowExtraAttrs(opts)}>${singleCell(row, opts.rightTarget, opts.untouredTag)}</div>`;
}

export interface SplitHalves { left: string; right: string }

/** Both halves of one logical split row, each a single-cell `.ds-row` that
 *  lives in its own column. A side the row has nothing on yields '' — there
 *  is no filler: the columns flow independently and the engine keeps them
 *  in step. Change units stay one element each: `ds-row-add` (right only),
 *  `ds-row-del` (left only), `ds-row-pair` on the right half of a merged
 *  pair with `ds-row-pair-l` on its left half. Both halves share `data-ri`. */
export function renderSplitHalves(row: SbsRow, opts: SplitRowOpts = {}): SplitHalves {
  const extra = rowExtraAttrs(opts);
  const ri = opts.ri === undefined ? '' : ` data-ri="${opts.ri}"`;
  const half = (side: RowSide): string => {
    if (sideAbsent(side, row)) return '';
    const target = side === 'left' ? opts.leftTarget : opts.rightTarget;
    const content = row.paired ? (side === 'left' ? row.leftContent : row.rightContent) : row.content;
    const attrs = reviewRowAttrs(target, row.type, content, target ? opts.stepId : undefined, row.changePair, !!row.moved);
    const pairCls = row.changePair ? (side === 'left' ? ' ds-row-pair-l' : ' ds-row-pair') : '';
    const intra = side === 'left' ? opts.sides?.left : opts.sides?.right;
    return `<div class="ds-row ds-row-${row.type}${pairCls}${row.moved ? ' ds-row-moved' : ''}"${ri}${attrs}${extra}>${cell(side, row, target, intra, opts.untouredTag)}</div>`;
  };
  return { left: half('left'), right: half('right') };
}

/** The divider column between the two flows. The engine paints change bands
 *  into the svg and owns the resize handle role. */
export function splitDividerHtml(): string {
  return `<span class="ds-celldiv" aria-hidden="true"><svg class="ds-bands" aria-hidden="true" focusable="false"></svg></span>`;
}

/** Accumulates one split body as two independent columns. Every logical row
 *  (code row, gap, extra) takes the next `data-ri`, shared by whichever halves
 *  exist, so the engine can pair them back up without walking both columns. */
export class SplitColumns {
  private readonly l: string[] = [];
  private readonly r: string[] = [];
  private ri = 0;
  private extraClass = '';

  constructor(opts: { bodyClass?: string } = {}) {
    this.extraClass = opts.bodyClass ? ` ${opts.bodyClass}` : '';
  }

  row(row: SbsRow, opts: SplitRowOpts = {}): this {
    const halves = renderSplitHalves(row, { ...opts, ri: this.ri++ });
    if (halves.left) this.l.push(halves.left);
    if (halves.right) this.r.push(halves.right);
    return this;
  }

  gap(gap?: GapInfo, opts: HunkGapOpts = {}): this {
    const halves = renderSplitGapHalves(gap, opts, this.ri++);
    this.l.push(halves.left);
    this.r.push(halves.right);
    return this;
  }

  /** Content that exists on one side only (a scope row, a callout). */
  left(html: string): this {
    if (html) this.l.push(html);
    return this;
  }

  right(html: string): this {
    if (html) this.r.push(html);
    return this;
  }

  get count(): number {
    return this.ri;
  }

  /** The raw column bodies, for a response that inserts them elsewhere. */
  sides(): SplitHalves {
    return { left: this.l.join(''), right: this.r.join('') };
  }

  /** The two columns plus the divider, without the body wrapper. */
  columns(): string {
    return `<div class="ds-col ds-col-l">${this.l.join('')}</div>${splitDividerHtml()}<div class="ds-col ds-col-r">${this.r.join('')}</div>`;
  }

  html(): string {
    return `<div class="ds-diffbody ds-diffbody-cols${this.extraClass}">${this.columns()}</div>`;
  }
}

export function renderUnifiedRow(row: UnifiedRow, target?: RowTarget, intra?: string, tag?: number | null): string {
  const sign = row.moved ? '↕' : row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' ';
  const flag = (row.untoured && !row.moved ? untouredTagHtml(tag) : '') + movedTagHtml(row.moved);
  const attrs = reviewRowAttrs(target, row.type, row.content, undefined, false, !!row.moved);
  return `<div class="ds-urow ds-row-${row.type}${row.moved ? ' ds-row-moved' : ''}${row.untoured && !row.moved ? ' is-untoured' : ''}"${attrs}><span class="ds-no">${
    row.no ?? ''
  }</span><span class="ds-sign ds-sign-${row.moved ? 'moved' : row.type}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${
    (intra ?? highlightedCode(row.content, target)) || ' '
  }</span>${flag}</div>`;
}

export interface GapInfo { file: string; from: number; to: number | 'eof' }
export interface HunkGapOpts { edge?: 'before' | 'after' }

const UNIFIED_CONTEXT_CHUNK = 20;
const SPLIT_CONTEXT_CHUNK = 5;

function gapButtons(gap: GapInfo, chunk: number, edge?: 'before' | 'after'): { up: string; down: string; all: string } {
  const up =
    gap.to === 'eof'
      ? ''
      : `<button type="button" class="ds-gapbtn ds-gapbtn-context" data-expand="up" title="Show ${chunk} lines above" aria-label="Show ${chunk} lines above">↑ ${chunk} lines</button>`;
  const down =
    edge === 'before'
      ? ''
      : `<button type="button" class="ds-gapbtn ds-gapbtn-context" data-expand="down" title="Show ${chunk} lines below" aria-label="Show ${chunk} lines below">↓ ${chunk} lines</button>`;
  const all = `<button type="button" class="ds-gapbtn" data-expand="all" title="Show all hidden lines" aria-label="Show all hidden lines">Show all</button>`;
  return { up, down, all };
}

function gapDataAttrs(gap: GapInfo, chunk: number): string {
  return ` data-gap data-gap-file="${esc(gap.file)}" data-gap-from="${gap.from}" data-gap-to="${gap.to}" data-gap-chunk="${chunk}"`;
}

/** The skipped-lines separator between hunks in the unified layout. Bare
 *  gaps stay descriptive; a GapInfo makes them expandable. */
export function renderHunkGap(gap?: GapInfo, opts: HunkGapOpts = {}): string {
  if (!gap) return `<div class="ds-hunkgap"><span class="ds-gaplabel">Skipped lines</span></div>`;
  const chunk = UNIFIED_CONTEXT_CHUNK;
  const { up, down, all } = gapButtons(gap, chunk, opts.edge);
  return `<div class="ds-hunkgap is-expandable"${gapDataAttrs(gap, chunk)}>${down}${all}${up}</div>`;
}

/** The same separator as two column halves. The right half is the canonical
 *  expandable gap (`data-gap`) and carries Show all plus the upward expander;
 *  the left half mirrors it (`data-gap-mirror`) with the downward expander, so
 *  the engine updates both from the canonical one by their shared `data-ri`. */
export function renderSplitGapHalves(gap: GapInfo | undefined, opts: HunkGapOpts = {}, ri?: number): SplitHalves {
  const riAttr = ri === undefined ? '' : ` data-ri="${ri}"`;
  if (!gap) {
    const label = `<span class="ds-gaplabel">Skipped lines</span>`;
    return {
      left: `<div class="ds-hunkgap ds-hunkgap-side ds-hunkgap-l"${riAttr} data-gap-mirror>${label}</div>`,
      right: `<div class="ds-hunkgap ds-hunkgap-side ds-hunkgap-r"${riAttr}>${label}</div>`,
    };
  }
  const chunk = SPLIT_CONTEXT_CHUNK;
  const { up, down, all } = gapButtons(gap, chunk, opts.edge);
  return {
    left: `<div class="ds-hunkgap is-expandable ds-hunkgap-side ds-hunkgap-l"${riAttr} data-gap-mirror>${down}</div>`,
    right: `<div class="ds-hunkgap is-expandable ds-hunkgap-side ds-hunkgap-r"${riAttr}${gapDataAttrs(gap, chunk)}>${all}${up}</div>`,
  };
}
