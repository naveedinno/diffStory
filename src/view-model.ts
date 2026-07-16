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
import { isCodeStep } from './types.js';
import type {
  CodeStepKind,
  CodeTourStep,
  ConceptDiagram,
  ConceptTourStep,
  DiffFile,
  DiffHunk,
  DiffLine,
  FileStatus,
  Tour,
  TourStep,
  StepKind,
} from './types.js';

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
  concept: 'Concept',
};
const FILE_KIND_LABEL: Record<FileKind, string> = {
  changed: 'Changed',
  new: 'New file',
  context: 'Context',
};

export interface StepViewBase {
  id: string;
  order: number;
  title: string;
  kind: StepKind;
  kindLabel: string;
  /** Authored review cues carried through from story.json. */
  tags: string[];
  chapter?: string;
}

export interface StepHealthView {
  broad: boolean;
  reasons: string[];
  viewportLines: number;
  beatCount: number;
}

export interface CodeStepView extends StepViewBase {
  kind: CodeStepKind;
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
  newFile: boolean;
  context: boolean;
  why: string;
  question: string;
  health: StepHealthView;
  beats: StepBeatView[];
  /** Plain-English call-flow summary, e.g. "Calls step 3 · returns to 1". */
  flow: string;
  /** Diff rows grouped by hunk (rendered with a ⋯ separator between blocks). */
  blocks: SbsRow[][];
  note?: string;
}

export interface ConceptStepView extends StepViewBase {
  kind: 'concept';
  body: string;
  diagram?: ConceptDiagram;
  preparesFor: Array<{ id: string; order: number; title: string }>;
}

export type StepView = CodeStepView | ConceptStepView;

export interface StepBeatView {
  text: string;
  focusGroup: number;
  highlights: Array<[number, number]>;
}

export interface FileView {
  file: string;
  oldFile: string;
  status: FileStatus;
  kind: FileKind;
  kindLabel: string;
  add: number;
  del: number;
  /** Number of changed hunks in this file no step explains. */
  untoured: number;
  stepId?: string;
  stepOrder?: number;
  hunks: UnifiedRow[][];
  /** [newStart, newEnd] per hunk, aligned with .hunks — lets the panel compute
   *  the gaps between hunks (and after the last one) for expand-context. */
  hunkRanges: Array<[number, number]>;
  /** Whether a complete-file view can be loaded (file exists in the working tree). */
  hasFull: boolean;
  /** Best-effort changed declarations, used only for navigation/search. */
  symbols: string[];
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
  codeSteps: number;
  conceptSteps: number;
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
  const codeSteps = steps.filter(isCodeStep);
  const coverageFiles = filesForStoryCoverage(tour, files);
  // Story-less (diff-only) view: there's no story to measure the diff against,
  // so nothing is "unexplained" — skip coverage instead of flagging every line.
  const uncovered = opts?.storyless ? [] : computeCoverage(tour, coverageFiles).uncovered;

  // Uncovered ranges grouped by file, for line-level "untoured" flagging.
  const uncoveredByFile = new Map<string, Array<[number, number]>>();
  for (const u of uncovered) {
    const list = uncoveredByFile.get(u.file) ?? [];
    list.push(u.range);
    uncoveredByFile.set(u.file, list);
  }

  // First ordered step that shows each file → the "Step N" chip + jump target.
  const stepByFile = new Map<string, CodeTourStep>();
  for (const s of codeSteps) if (!stepByFile.has(s.file)) stepByFile.set(s.file, s);

  const stepViews = steps.map((step) =>
    isCodeStep(step)
      ? buildCodeStep(repo, step, files, byId, steps.length, headRef)
      : buildConceptStep(step, byId),
  );
  const fileViews = buildFiles(repo, codeSteps, files, stepByFile, uncoveredByFile, headRef);
  const trust = buildTrust(coverageFiles, uncovered, stepByFile);

  return {
    steps: stepViews,
    files: fileViews,
    trust,
    totalSteps: steps.length,
    codeSteps: codeSteps.length,
    conceptSteps: steps.length - codeSteps.length,
    filesChanged: fileViews.filter((f) => f.kind !== 'context').length,
    contextFiles: fileViews.filter((f) => f.kind === 'context').length,
    totalAdd: fileViews.reduce((a, f) => a + f.add, 0),
    totalDel: fileViews.reduce((a, f) => a + f.del, 0),
  };
}

function filesForStoryCoverage(tour: Tour, files: DiffFile[]): DiffFile[] {
  const included = tour.storyScope?.includedFiles;
  if (!included?.length) return files;
  const selected = new Set(included);
  return files.filter((f) => selected.has(f.newPath));
}

function buildCodeStep(
  repo: string,
  step: CodeTourStep,
  files: DiffFile[],
  byId: Map<string, TourStep>,
  total: number,
  headRef?: string,
): CodeStepView {
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
    chapter: step.chapter?.trim() || undefined,
    file: step.file,
    oldFile: diffFile?.oldPath ?? step.file,
    viewport,
    range: viewport,
    focusRanges: focusGroups.flat(),
    focusGroups,
    focusExplicit,
    kind: step.kind,
    kindLabel: STEP_KIND_LABEL[step.kind],
    tags: step.tags ?? [],
    newFile: step.kind === 'new-file',
    context: step.kind === 'context',
    why: step.why,
    question: step.question?.trim() || fallbackReviewQuestion(step.title),
    health: stepHealth(step, viewport, focusGroups),
    beats,
    flow: flowLabel(step, byId, total),
    blocks,
    note,
  };
}

function buildConceptStep(step: ConceptTourStep, byId: Map<string, TourStep>): ConceptStepView {
  return {
    id: step.id,
    order: step.order,
    title: step.title,
    chapter: step.chapter?.trim() || undefined,
    kind: 'concept',
    kindLabel: STEP_KIND_LABEL.concept,
    tags: step.tags ?? [],
    body: step.body,
    diagram: step.diagram,
    preparesFor: step.preparesFor
      .map((id) => byId.get(id))
      .filter((target): target is CodeTourStep => !!target && isCodeStep(target))
      .map((target) => ({ id: target.id, order: target.order, title: target.title }))
      .sort((a, b) => a.order - b.order),
  };
}

function fallbackReviewQuestion(title: string): string {
  const claim = title.trim().replace(/[.?!]+$/, '');
  return `Does the code prove this claim: ${claim}?`;
}

function stepHealth(
  step: CodeTourStep,
  viewport: [number, number],
  focusGroups: Array<Array<[number, number]>>,
): StepHealthView {
  const viewportLines = viewport[0] === 0 ? 0 : viewport[1] - viewport[0] + 1;
  const beatCount = step.beats?.length ?? focusGroups.length;
  const reasons: string[] = [];
  if (viewportLines > 30) reasons.push(`${viewportLines} lines in one step`);
  if (beatCount > 3) reasons.push(`${beatCount} separate review beats`);
  const hasDistantFocus = focusGroups.some((group) => {
    const sorted = [...group].sort((a, b) => a[0] - b[0]);
    return sorted.some((range, index) => index > 0 && range[0] - sorted[index - 1][1] > 10);
  });
  if (hasDistantFocus) reasons.push('focus jumps across distant code');
  const widestSpan = focusGroups.reduce((widest, group) => {
    if (!group.length || group[0][0] === 0) return widest;
    const starts = group.map((range) => range[0]);
    const ends = group.map((range) => range[1]);
    return Math.max(widest, Math.max(...ends) - Math.min(...starts) + 1);
  }, 0);
  if (widestSpan > 20) reasons.push(`${widestSpan}-line focus span`);
  return { broad: reasons.length > 0, reasons, viewportLines, beatCount };
}

function stepViewport(step: CodeTourStep): [number, number] {
  return step.viewport ?? step.range;
}

function stepHighlights(step: CodeTourStep): Array<[number, number]> {
  return step.highlights ?? step.focus?.ranges ?? [];
}

function stepBeats(step: CodeTourStep): StepBeatView[] {
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
  step: CodeTourStep,
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
  steps: CodeTourStep[],
  files: DiffFile[],
  stepByFile: Map<string, CodeTourStep>,
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
      status: file.status,
      kind: file.status === 'added' ? 'new' : 'changed',
      kindLabel: file.status === 'added' ? FILE_KIND_LABEL.new : FILE_KIND_LABEL.changed,
      add,
      del,
      untoured: uncovered.length,
      stepId: step?.id,
      stepOrder: step?.order,
      hunks,
      hunkRanges: file.hunks.map(hunkNewRange),
      hasFull: file.status !== 'deleted',
      symbols: changedSymbols(file),
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
      status: 'modified',
      kind: 'context',
      kindLabel: FILE_KIND_LABEL.context,
      add: 0,
      del: 0,
      untoured: 0,
      stepId: step.id,
      stepOrder: step.order,
      hunks: rows.length ? [rows] : [],
      hunkRanges: r ? [[r.startLine, r.startLine + rows.length - 1]] : [],
      hasFull: r !== null,
      symbols: [],
    });
  }

  return views.sort(byStepOrderThenPath);
}

/** Conservative declaration extraction for findability, never correctness claims. */
function changedSymbols(file: DiffFile): string[] {
  const found = new Set<string>();
  const declaration = /\b(?:async\s+)?(?:function|class|interface|type|enum|struct|contract|library|event|modifier|def|fn)\s+([A-Za-z_$][\w$]*)|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:=|:)/;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'ctx') continue;
      const match = line.content.match(declaration);
      const symbol = match?.[1] ?? match?.[2];
      if (symbol) found.add(symbol);
      if (found.size >= 12) return [...found];
    }
  }
  return [...found];
}

function buildTrust(
  files: DiffFile[],
  uncovered: ReturnType<typeof computeCoverage>['uncovered'],
  stepByFile: Map<string, CodeTourStep>,
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

function flowLabel(step: CodeTourStep, byId: Map<string, TourStep>, total: number): string {
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

// The new-file line span a hunk occupies, used to size the expandable gaps
// between hunks. A pure-deletion hunk has newLines === 0; the Math.max(…,1)
// floor claims one line at newStart so the range is never inverted — a known,
// harmless one-line seam where the context line beside such a hunk is attributed
// to the hunk rather than a neighboring gap. Revisit here if gap ranges change.
export function hunkNewRange(h: DiffHunk): [number, number] {
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
