// Turn the validated tour + parsed diff + coverage into the view structures the
// review page renders: the ordered story steps (side-by-side rows), the All-files
// overview (unified rows), the trust check, and the reconstructed full-file view.
//
// Pure data only — no HTML. The renderer (render.ts) and the /api/fullfile
// endpoint (server.ts) both consume these, so the diff-shaping logic lives in
// exactly one place. Code strings are passed through verbatim; escaping happens
// at the render boundary.
import { changedRanges, rangesOverlap } from './diff.js';
import { readFileRange, readWholeFile } from './git.js';
import { orderedSteps } from './tour.js';
import { computeCoverage } from './coverage.js';
import type { DiffFile, DiffHunk, DiffLine, Tour, TourStep, StepKind } from './types.js';

export type RowType = 'add' | 'del' | 'ctx';

/** One row of a side-by-side diff (story tour + full file). */
export interface SbsRow {
  type: RowType;
  oldNo?: number;
  newNo?: number;
  content: string;
  /** Commentable when it has a post-change line number. */
  comment?: boolean;
  /** Flagged by the trust check (changed but no step explains it). */
  untoured?: boolean;
}

/** One row of a compact unified diff (All-files cards). */
export interface UnifiedRow {
  type: RowType;
  no?: number;
  content: string;
  untoured?: boolean;
}

export type FileKind = 'changed' | 'new' | 'context';

const STEP_KIND_LABEL: Record<StepKind, string> = {
  changed: 'Changed',
  context: 'Context',
  'new-file': 'New file',
};
const FILE_KIND_LABEL: Record<FileKind, string> = {
  changed: 'Changed',
  new: 'New file',
  context: 'Context',
};

export interface StepView {
  id: string;
  order: number;
  title: string;
  file: string;
  oldFile: string;
  /** Storyteller-selected visible window. */
  viewport: [number, number];
  range: [number, number];
  /** Narrower post-change line ranges that glow while this step is read aloud. */
  focusRanges: Array<[number, number]>;
  /** Focus ranges grouped by spoken unit. */
  focusGroups: Array<Array<[number, number]>>;
  /** Whether focusRanges came from story JSON instead of the step range fallback. */
  focusExplicit: boolean;
  kind: StepKind;
  kindLabel: string;
  newFile: boolean;
  context: boolean;
  why: string;
  beats: StepBeatView[];
  /** Plain-English call-flow summary, e.g. "Calls step 3 · returns to 1". */
  flow: string;
  /** Diff rows grouped by hunk (rendered with a ⋯ separator between blocks). */
  blocks: SbsRow[][];
  note?: string;
}

export interface StepBeatView {
  text: string;
  focusGroup: number;
  highlights: Array<[number, number]>;
}

export interface FileView {
  file: string;
  oldFile: string;
  kind: FileKind;
  kindLabel: string;
  add: number;
  del: number;
  /** Number of changed hunks in this file no step explains. */
  untoured: number;
  stepId?: string;
  stepOrder?: number;
  hunks: UnifiedRow[][];
  /** Whether a complete-file view can be loaded (file exists in the working tree). */
  hasFull: boolean;
}

export interface UncoveredView {
  file: string;
  line: number;
  rows: UnifiedRow[];
  stepId?: string;
  stepOrder?: number;
}

export interface TrustView {
  coveredLines: number;
  uncoveredLines: number;
  uncovered: UncoveredView[];
}

export interface ReviewModel {
  steps: StepView[];
  files: FileView[];
  trust: TrustView;
  totalSteps: number;
  filesChanged: number;
  contextFiles: number;
  totalAdd: number;
  totalDel: number;
}

export function buildReviewModel(
  repo: string,
  tour: Tour,
  files: DiffFile[],
  headRef?: string,
  opts?: { storyless?: boolean },
): ReviewModel {
  const steps = orderedSteps(tour);
  const byId = new Map(steps.map((s) => [s.id, s]));
  // Story-less (diff-only) view: there's no story to measure the diff against,
  // so nothing is "unexplained" — skip coverage instead of flagging every line.
  const uncovered = opts?.storyless ? [] : computeCoverage(tour, files).uncovered;

  // Uncovered ranges grouped by file, for line-level "untoured" flagging.
  const uncoveredByFile = new Map<string, Array<[number, number]>>();
  for (const u of uncovered) {
    const list = uncoveredByFile.get(u.file) ?? [];
    list.push(u.range);
    uncoveredByFile.set(u.file, list);
  }

  // First ordered step that shows each file → the "Step N" chip + jump target.
  const stepByFile = new Map<string, TourStep>();
  for (const s of steps) if (!stepByFile.has(s.file)) stepByFile.set(s.file, s);

  const stepViews = steps.map((s) => buildStep(repo, s, files, byId, steps.length, headRef));
  const fileViews = buildFiles(repo, steps, files, stepByFile, uncoveredByFile, headRef);
  const trust = buildTrust(files, uncovered, stepByFile);

  return {
    steps: stepViews,
    files: fileViews,
    trust,
    totalSteps: steps.length,
    filesChanged: fileViews.filter((f) => f.kind !== 'context').length,
    contextFiles: fileViews.filter((f) => f.kind === 'context').length,
    totalAdd: fileViews.reduce((a, f) => a + f.add, 0),
    totalDel: fileViews.reduce((a, f) => a + f.del, 0),
  };
}

function buildStep(
  repo: string,
  step: TourStep,
  files: DiffFile[],
  byId: Map<string, TourStep>,
  total: number,
  headRef?: string,
): StepView {
  const { blocks, note } = stepBlocks(repo, step, files, headRef);
  const diffFile = files.find((f) => f.newPath === step.file);
  const viewport = stepViewport(step);
  const highlights = stepHighlights(step);
  const beats = stepBeats(step);
  const focusGroups = stepFocusGroups(viewport, highlights, beats);
  const focusExplicit = beats.length > 0 || highlights.length > 0;
  return {
    id: step.id,
    order: step.order,
    title: step.title,
    file: step.file,
    oldFile: diffFile?.oldPath ?? step.file,
    viewport,
    range: viewport,
    focusRanges: focusGroups.flat(),
    focusGroups,
    focusExplicit,
    kind: step.kind,
    kindLabel: STEP_KIND_LABEL[step.kind],
    newFile: step.kind === 'new-file',
    context: step.kind === 'context',
    why: step.why,
    beats,
    flow: flowLabel(step, byId, total),
    blocks,
    note,
  };
}

function stepViewport(step: TourStep): [number, number] {
  return step.viewport ?? step.range;
}

function stepHighlights(step: TourStep): Array<[number, number]> {
  return step.highlights ?? step.focus?.ranges ?? [];
}

function stepBeats(step: TourStep): StepBeatView[] {
  return (step.beats ?? []).map((beat, i) => ({
    text: beat.text,
    focusGroup: i,
    highlights: beat.highlights,
  }));
}

function stepFocusGroups(
  viewport: [number, number],
  highlights: Array<[number, number]>,
  beats: StepBeatView[],
): Array<Array<[number, number]>> {
  if (beats.length) return beats.map((beat) => beat.highlights);
  if (highlights.length) return highlights.map((range) => [range]);
  return [[viewport]];
}

function stepBlocks(
  repo: string,
  step: TourStep,
  files: DiffFile[],
  headRef?: string,
): { blocks: SbsRow[][]; note?: string } {
  const viewport = stepViewport(step);
  const [start, end] = viewport;
  const file = files.find((f) => f.newPath === step.file);

  if (step.kind === 'changed') {
    if (file && file.hunks.length) {
      const whole = readWholeFile(repo, step.file, headRef);
      if (whole) {
        const rows = rowsInViewport(buildFullFileRows(file, whole, []), viewport);
        if (rows.length) return { blocks: [rows] };
      }
      const overlap = file.hunks.filter((h) => rangesOverlap(hunkNewRange(h), [start, end]));
      const use = overlap.length ? overlap : file.hunks;
      return {
        blocks: use.map((h) => h.lines.map(toSbs)),
        note: overlap.length ? undefined : 'tour range did not match a hunk — showing all changes in this file',
      };
    }
    const r = readFileRange(repo, step.file, start, end, headRef);
    if (!r) return { blocks: [], note: `file not found: ${step.file}` };
    return {
      blocks: [r.lines.map((c, i) => ctxRow(c, r.startLine + i))],
      note: 'no diff for this range — showing the current file',
    };
  }

  // context | new-file: read straight from the working tree.
  const r = readFileRange(repo, step.file, start, end, headRef);
  if (!r) return { blocks: [], note: `file not found: ${step.file}` };
  if (step.kind === 'new-file') {
    return { blocks: [r.lines.map((c, i) => ({ type: 'add' as const, newNo: r.startLine + i, content: c, comment: true }))] };
  }
  return { blocks: [r.lines.map((c, i) => ctxRow(c, r.startLine + i))] };
}

function rowsInViewport(rows: SbsRow[], [start, end]: [number, number]): SbsRow[] {
  return rows.filter((row, index) => rowInViewport(row, rows, index, start, end));
}

function rowInViewport(row: SbsRow, rows: SbsRow[], index: number, start: number, end: number): boolean {
  if (row.newNo !== undefined) return row.newNo >= start && row.newNo <= end;
  if (row.type !== 'del') return false;
  const prev = nearestNewLine(rows, index, -1);
  const next = nearestNewLine(rows, index, 1);
  return (
    (prev !== undefined && prev >= start - 1 && prev <= end) ||
    (next !== undefined && next >= start && next <= end + 1)
  );
}

function nearestNewLine(rows: SbsRow[], from: number, dir: -1 | 1): number | undefined {
  for (let i = from + dir; i >= 0 && i < rows.length; i += dir) {
    if (rows[i].newNo !== undefined) return rows[i].newNo;
  }
  return undefined;
}

function buildFiles(
  repo: string,
  steps: TourStep[],
  files: DiffFile[],
  stepByFile: Map<string, TourStep>,
  uncoveredByFile: Map<string, Array<[number, number]>>,
  headRef?: string,
): FileView[] {
  const views: FileView[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (!file.hunks.length) continue; // pure metadata (e.g. mode change) — skip
    seen.add(file.newPath);
    const uncovered = uncoveredByFile.get(file.newPath) ?? [];
    const hunks = file.hunks.map((h) => h.lines.map((l) => toUnified(l, uncovered)));
    const add = countLines(file, 'add');
    const del = countLines(file, 'del');
    const step = stepByFile.get(file.newPath);
    views.push({
      file: file.newPath,
      oldFile: file.oldPath,
      kind: file.status === 'added' ? 'new' : 'changed',
      kindLabel: file.status === 'added' ? FILE_KIND_LABEL.new : FILE_KIND_LABEL.changed,
      add,
      del,
      untoured: uncovered.length,
      stepId: step?.id,
      stepOrder: step?.order,
      hunks,
      hasFull: file.status !== 'deleted',
    });
  }

  // Context-only files (referenced by a context step, absent from the diff).
  for (const step of steps) {
    if (step.kind !== 'context' || seen.has(step.file)) continue;
    seen.add(step.file);
    const r = readFileRange(repo, step.file, step.range[0], step.range[1], headRef);
    const rows = r ? r.lines.map((c, i) => ({ type: 'ctx' as const, no: r.startLine + i, content: c })) : [];
    views.push({
      file: step.file,
      oldFile: step.file,
      kind: 'context',
      kindLabel: FILE_KIND_LABEL.context,
      add: 0,
      del: 0,
      untoured: 0,
      stepId: step.id,
      stepOrder: step.order,
      hunks: rows.length ? [rows] : [],
      hasFull: r !== null,
    });
  }

  return views.sort(byStepOrderThenPath);
}

function buildTrust(
  files: DiffFile[],
  uncovered: ReturnType<typeof computeCoverage>['uncovered'],
  stepByFile: Map<string, TourStep>,
): TrustView {
  const byPath = new Map(files.map((f) => [f.newPath, f]));
  let totalAdd = 0;
  for (const f of files) totalAdd += countLines(f, 'add');

  let uncoveredAdds = 0;
  const views: UncoveredView[] = uncovered.map((u) => {
    const file = byPath.get(u.file);
    const rows = file
      ? file.hunks
          .filter((h) => rangesOverlap(hunkNewRange(h), u.range))
          .flatMap((h) => h.lines)
          .filter((l) => l.newNo !== undefined && l.newNo >= u.range[0] && l.newNo <= u.range[1])
          .map((l) => toUnified(l, [u.range]))
      : [];
    uncoveredAdds += rows.filter((r) => r.type === 'add').length;
    const step = stepByFile.get(u.file);
    return { file: u.file, line: u.range[0], rows, stepId: step?.id, stepOrder: step?.order };
  });

  return {
    coveredLines: Math.max(0, totalAdd - uncoveredAdds),
    uncoveredLines: uncoveredAdds || uncovered.length,
    uncovered: views,
  };
}

/**
 * Reconstruct the complete file as side-by-side rows: unchanged regions on both
 * sides, added lines on the right (left hatched), removed lines on the left.
 * Built from the working-tree file + the parsed hunks — no second git call.
 */
export function buildFullFileRows(
  file: DiffFile | undefined,
  newLines: string[],
  uncoveredRanges: Array<[number, number]>,
): SbsRow[] {
  const rows: SbsRow[] = [];
  const hunks = file ? [...file.hunks].sort((a, b) => a.newStart - b.newStart) : [];
  const untoured = (n: number | undefined) =>
    n !== undefined && uncoveredRanges.some((r) => n >= r[0] && n <= r[1]);
  let newCursor = 1;
  let oldCursor = 1;

  for (const h of hunks) {
    while (newCursor < h.newStart && newCursor <= newLines.length) {
      rows.push({ type: 'ctx', oldNo: oldCursor, newNo: newCursor, content: newLines[newCursor - 1], comment: true });
      newCursor++;
      oldCursor++;
    }
    for (const l of h.lines) {
      if (l.type === 'ctx') {
        rows.push({ type: 'ctx', oldNo: l.oldNo, newNo: l.newNo, content: l.content, comment: true });
        if (l.newNo !== undefined) newCursor = l.newNo + 1;
        if (l.oldNo !== undefined) oldCursor = l.oldNo + 1;
      } else if (l.type === 'add') {
        rows.push({ type: 'add', newNo: l.newNo, content: l.content, comment: true, untoured: untoured(l.newNo) });
        if (l.newNo !== undefined) newCursor = l.newNo + 1;
      } else {
        rows.push({ type: 'del', oldNo: l.oldNo, content: l.content });
        if (l.oldNo !== undefined) oldCursor = l.oldNo + 1;
      }
    }
  }
  while (newCursor <= newLines.length) {
    rows.push({ type: 'ctx', oldNo: oldCursor, newNo: newCursor, content: newLines[newCursor - 1], comment: true });
    newCursor++;
    oldCursor++;
  }
  return rows;
}

/** Split-layout blocks for one file's hunks (the All-files Split view):
 *  each hunk becomes a block of SbsRows, adds flagged when uncovered.
 *  `file` is optional so context-only files (no entry in the parsed diff,
 *  only referenced by a context step) degrade to no blocks — same shape as
 *  buildFullFileRows' handling of an absent DiffFile. */
export function hunksToSbsBlocks(
  file: DiffFile | undefined,
  uncoveredRanges: Array<[number, number]>,
): SbsRow[][] {
  if (!file) return [];
  const untoured = (n?: number) =>
    n !== undefined && uncoveredRanges.some((r) => n >= r[0] && n <= r[1]);
  return file.hunks.map((h) =>
    h.lines.map((l) => {
      const row = toSbs(l);
      if (l.type === 'add' && untoured(l.newNo)) row.untoured = true;
      return row;
    }),
  );
}

// ---- helpers ----

function flowLabel(step: TourStep, byId: Map<string, TourStep>, total: number): string {
  const calls = (step.calls ?? []).map((id) => byId.get(id)).filter((t): t is TourStep => !!t);
  const ret = step.returnsTo ? byId.get(step.returnsTo) : undefined;
  if (calls.length) {
    let label = 'Calls step ' + calls.map((t) => t.order).join(', ');
    if (ret) label += ' · returns to ' + ret.order;
    return label;
  }
  if (ret) return 'Returns to step ' + ret.order;
  return step.order === total ? 'Final step' : 'Standalone';
}

function toSbs(l: DiffLine): SbsRow {
  return { type: l.type, oldNo: l.oldNo, newNo: l.newNo, content: l.content, comment: l.newNo !== undefined };
}

function ctxRow(content: string, no: number): SbsRow {
  return { type: 'ctx', oldNo: no, newNo: no, content, comment: true };
}

function toUnified(l: DiffLine, uncovered: Array<[number, number]>): UnifiedRow {
  const untoured =
    l.newNo !== undefined && uncovered.some((r) => l.newNo! >= r[0] && l.newNo! <= r[1]);
  return { type: l.type, no: l.newNo ?? l.oldNo, content: l.content, untoured };
}

function hunkNewRange(h: DiffHunk): [number, number] {
  return [h.newStart, h.newStart + Math.max(h.newLines, 1) - 1];
}

function countLines(file: DiffFile, type: RowType): number {
  let n = 0;
  for (const h of file.hunks) for (const l of h.lines) if (l.type === type) n++;
  return n;
}

function byStepOrderThenPath(a: FileView, b: FileView): number {
  const ao = a.stepOrder ?? Number.MAX_SAFE_INTEGER;
  const bo = b.stepOrder ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.file.localeCompare(b.file);
}

// changedRanges is re-exported for callers that want raw uncovered ranges.
export { changedRanges };
