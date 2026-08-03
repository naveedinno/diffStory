// Turn the validated tour + parsed diff + coverage into the view structures the
// review page renders: the ordered story steps (side-by-side rows), the All-files
// overview (unified rows), the trust check, and the reconstructed full-file view.
//
// Diff data stays pure: code strings pass through verbatim and are escaped at the
// render boundary. Authored prose does not. Every narrative field is parsed here,
// exactly once (narrative.ts), and carried as a Narrative — `.html` for template
// interpolation, `.text` for attributes, labels, and truncation, `.speech` for
// Aloud. The renderer places those projections; it never escapes, truncates,
// re-parses, or markdown-renders story prose itself, which is what removes the
// sanitize-then-reparse gap mXSS lives in.
//
// The renderer (render.ts) and the /api/fullfile endpoint (server.ts) both consume
// these, so the diff-shaping logic lives in exactly one place.
import { changedRanges, rangesOverlap } from './diff.js';
import { readFileRange, readWholeFile } from './git.js';
import { orderedSteps } from './tour.js';
import { claimedRanges } from './types.js';
import { computeCoverage } from './coverage.js';
import { isCodeStep } from './types.js';
import { narrative, narrativeText, type Narrative } from './narrative.js';
import { createHash } from 'node:crypto';
import type {
  CodeStepKind,
  CodeTourStep,
  ConceptTourStep,
  DiffFile,
  DiffHunk,
  DiffLine,
  FileStatus,
  ReviewFileIndexEntry,
  LogicMove,
  LogicMoveKind,
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
  /** Paired views carry independent old/new file content in one aligned row. */
  leftContent?: string;
  rightContent?: string;
  paired?: boolean;
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
  /** Projected once: `.html` for headings, `.text` for aria labels and titles. */
  title: Narrative;
  kind: StepKind;
  kindLabel: string;
  /** Authored review cues carried through from story.json, markup stripped. */
  tags: string[];
  /** Grouping key for long reading paths, so text only — never markup. */
  chapter?: string;
}

export interface StepHealthView {
  broad: boolean;
  reasons: string[];
  viewportLines: number;
  beatCount: number;
}

export interface LogicMoveEndpointView {
  file: string;
  range: [number, number];
  /** This panel contains rows for the endpoint. */
  local: boolean;
  /** 1-based story panel index for a remote endpoint when one is authored. */
  targetStep?: number;
}

export interface LogicMoveView {
  id: string;
  kind: LogicMoveKind;
  label?: string;
  hidden?: { as: 'path' | 'destination' | 'consequence'; tag: string; what: Narrative };
  before: LogicMoveEndpointView;
  after: LogicMoveEndpointView;
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
  why: Narrative;
  /** Author-declared distrust reason when this step is a story hotspot. */
  hotspot?: Narrative;
  health: StepHealthView;
  beats: StepBeatView[];
  /** Plain-English call-flow summary, e.g. "Calls step 3 · returns to 1". */
  flow: string;
  /** Diff rows grouped by hunk (rendered with a ⋯ separator between blocks). */
  blocks: SbsRow[][];
  note?: string;
  moves: LogicMoveView[];
  pairedView?: string;
}

/** A primer's diagram: the caption is prose, the source is Mermaid the client parses. */
export interface ConceptDiagramView {
  type: 'mermaid';
  source: string;
  caption: Narrative;
}

export interface ConceptStepView extends StepViewBase {
  kind: 'concept';
  /** The only block-tier narrative in the model: headings, lists, tables, code. */
  body: Narrative;
  diagram?: ConceptDiagramView;
  preparesFor: Array<{ id: string; order: number; title: Narrative }>;
}

export type StepView = CodeStepView | ConceptStepView;

export interface StepBeatView {
  text: Narrative;
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
  /** Stable identity of the code diff, independent of story coverage state. */
  reviewHash: string;
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
  /** Initial metadata-only pages have not loaded enough hunk evidence yet. */
  pending?: boolean;
}

/** One author-declared distrust spot, resolved against the ordered reading path. */
export interface HotspotView {
  stepId: string;
  /** 1-based panel index of the flagged step (panel 0 is the overview). */
  panelIndex: number;
  order: number;
  title: Narrative;
  reason: Narrative;
}

/** The recovered "why", projected for the Overview panel. */
export interface StoryIntentView {
  goal: Narrative;
  design?: Narrative;
  /** Evidence labels ("commit 41af8b7", "PR #12 body") — identifiers, not prose. */
  sources: string[];
  nonGoals: Narrative[];
}

/**
 * Tour-level narrative, projected once. Its existence is the reason render.ts
 * never touches Tour.title / Tour.summary / Tour.intent directly.
 */
export interface StoryView {
  title: Narrative;
  /** Absent when the story shipped an empty summary. */
  summary?: Narrative;
  /** Absent when no intent was recovered, or its goal was blank. */
  intent?: StoryIntentView;
}

export interface ReviewModel {
  /** Title, summary, and recovered intent — already projected for the renderer. */
  story: StoryView;
  steps: StepView[];
  files: FileView[];
  hotspots: HotspotView[];
  trust: TrustView;
  totalSteps: number;
  codeSteps: number;
  conceptSteps: number;
  filesChanged: number;
  contextFiles: number;
  totalAdd: number;
  totalDel: number;
  /** Hunk-bearing changed files inside the story's selected scope. */
  storyFilesChanged: number;
}

export interface BuildReviewModelOptions {
  storyless?: boolean;
  /**
   * Detail is opt-out for non-page callers. The review page passes an explicit
   * set so off-screen story steps do not read and shape their source files.
   */
  detailedStepIndexes?: ReadonlySet<number>;
  /**
   * File summaries remain available to navigation while hunk rows are built
   * only for the requested detail panel.
   */
  detailedFilePaths?: ReadonlySet<string>;
  /** Lazy detail endpoints do not need the trust drawer's code excerpts. */
  includeTrustRows?: boolean;
  /** Bounded changed-file summaries used before individual diffs are loaded. */
  fileIndex?: readonly ReviewFileIndexEntry[];
  /** Never present unloaded coverage evidence as a clean result. */
  trustPending?: boolean;
  /** Base-side ref used to materialize paired old-file anchors. */
  baseRef?: string;
}

export function buildReviewModel(
  repo: string,
  tour: Tour,
  files: DiffFile[],
  headRef?: string,
  opts?: BuildReviewModelOptions,
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

  // First declared reason wins if a step is (incorrectly) flagged twice.
  const hotspotByStep = new Map<string, Narrative>();
  for (const spot of tour.hotspots ?? []) {
    const reason = narrative(spot.reason ?? '', 'inline');
    if (reason.text.trim() && !hotspotByStep.has(spot.step)) hotspotByStep.set(spot.step, reason);
  }

  const stepViews = steps.map((step, index) =>
    isCodeStep(step)
      ? buildCodeStep(
          repo,
          step,
          files,
          byId,
          steps.length,
          headRef,
          hotspotByStep.get(step.id),
          steps,
          opts?.baseRef,
          opts?.detailedStepIndexes === undefined || opts.detailedStepIndexes.has(index),
        )
      : buildConceptStep(step, byId),
  );
  // Built from the step views, not the raw steps: the title is already projected
  // there, and parsing it twice would be the second parse this module exists to
  // remove.
  const hotspots: HotspotView[] = stepViews.flatMap((step, index) => {
    const reason = hotspotByStep.get(step.id);
    return reason && step.kind !== 'concept'
      ? [{ stepId: step.id, panelIndex: index + 1, order: step.order, title: step.title, reason }]
      : [];
  });
  const fileViews = buildFiles(
    repo,
    codeSteps,
    files,
    stepByFile,
    uncoveredByFile,
    headRef,
    opts?.detailedFilePaths,
    opts?.fileIndex,
  );
  const trust = buildTrust(coverageFiles, uncovered, stepByFile, opts?.includeTrustRows !== false);
  if (opts?.trustPending) trust.pending = true;
  const changedFileViews = fileViews.filter((file) => file.kind !== 'context');
  const storyPaths = new Set(
    coverageFiles.length
      ? coverageFiles.map((file) => file.newPath)
      : codeSteps.filter((step) => step.kind !== 'context').map((step) => step.file),
  );
  const storyFileViews = changedFileViews.filter((file) => storyPaths.has(file.file));

  return {
    story: storyView(tour),
    steps: stepViews,
    files: fileViews,
    hotspots,
    trust,
    totalSteps: steps.length,
    codeSteps: codeSteps.length,
    conceptSteps: steps.length - codeSteps.length,
    filesChanged: changedFileViews.length,
    contextFiles: fileViews.filter((f) => f.kind === 'context').length,
    totalAdd: changedFileViews.reduce((a, f) => a + f.add, 0),
    totalDel: changedFileViews.reduce((a, f) => a + f.del, 0),
    storyFilesChanged: storyFileViews.length,
  };
}

/**
 * The story's own prose, projected once. Everything here lands inside a sentence
 * or a list item on the Overview panel, so it is inline-tier; the concept body is
 * the only block-tier narrative in the model.
 */
function storyView(tour: Tour): StoryView {
  const summary = narrative(tour.summary ?? '', 'inline');
  const intent = tour.intent;
  const goal = narrative(intent?.goal ?? '', 'inline');
  const design = narrative(intent?.design ?? '', 'inline');
  return {
    title: narrative(tour.title ?? '', 'inline'),
    summary: summary.text.trim() ? summary : undefined,
    // A goal that is blank once markup is stripped is no recovered intent at all,
    // and the Overview's layout hangs off whether one exists.
    intent: goal.text.trim()
      ? {
          goal,
          design: design.text.trim() ? design : undefined,
          sources: (intent?.sources ?? []).map((source) => narrativeText(source)).filter(Boolean),
          nonGoals: (intent?.nonGoals ?? [])
            .map((nonGoal) => narrative(nonGoal, 'inline'))
            .filter((nonGoal) => nonGoal.text.trim()),
        }
      : undefined,
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
  hotspot?: Narrative,
  ordered?: TourStep[],
  baseRef?: string,
  detailed = true,
): CodeStepView {
  const { blocks, note } = detailed ? stepBlocks(repo, step, files, headRef, baseRef) : { blocks: [] };
  const diffFile = files.find((f) => f.newPath === step.file);
  const viewport = stepViewport(step);
  const highlights = stepHighlights(step);
  const beats = stepBeats(step);
  const focusGroups = stepFocusGroups(viewport, highlights, beats);
  const focusExplicit = beats.length > 0 || highlights.length > 0;
  const moves = buildLogicMoves(step, diffFile?.oldPath ?? step.file, ordered ?? []);
  return {
    id: step.id,
    order: step.order,
    title: narrative(step.title, 'inline'),
    chapter: chapterLabel(step),
    file: step.file,
    oldFile: diffFile?.oldPath ?? step.file,
    viewport,
    range: viewport,
    focusRanges: focusGroups.flat(),
    focusGroups,
    focusExplicit,
    kind: step.kind,
    kindLabel: STEP_KIND_LABEL[step.kind],
    tags: (step.tags ?? []).map((tag) => narrativeText(tag)),
    newFile: step.kind === 'new-file',
    context: step.kind === 'context',
    why: narrative(step.why ?? '', 'inline'),
    hotspot,
    health: stepHealth(step, viewport, focusGroups),
    beats,
    flow: flowLabel(step, byId, total),
    blocks,
    note,
    moves,
    pairedView: pairedMoveFor(step)?.id,
  };
}

/**
 * The move whose two files become the left and right panes.
 *
 * Cross-file moves pair automatically: when a move lands on this step's file
 * from a different one, that relationship *is* the view, and the reader should
 * not have to open something to see the other side. `pairedView` remains an
 * explicit override for a step carrying more than one cross-file move.
 */
export function pairedMoveFor(step: CodeTourStep): LogicMove | undefined {
  if (!('moves' in step)) return undefined;
  const moves = step.moves ?? [];
  const explicitId = 'pairedView' in step ? step.pairedView : undefined;
  const crossFile = (move: LogicMove) => move.before.file !== move.after.file;
  if (explicitId) {
    const chosen = moves.find((move) => move.id === explicitId);
    return chosen && crossFile(chosen) ? chosen : undefined;
  }
  return moves.find((move) => crossFile(move) && move.after.file === step.file);
}

function buildLogicMoves(step: CodeTourStep, oldFile: string, ordered: TourStep[]): LogicMoveView[] {
  const authored = 'moves' in step ? step.moves ?? [] : [];
  const pairedId = pairedMoveFor(step)?.id;
  const targetStep = (file: string, range: [number, number]): number | undefined => {
    const index = ordered.findIndex((candidate) =>
      isCodeStep(candidate)
      && candidate.id !== step.id
      && candidate.file === file
      && claimedRanges(candidate).some((candidateRange) => rangesOverlap(candidateRange, range)),
    );
    return index >= 0 ? index + 1 : undefined;
  };
  return authored.map((move) => {
    const paired = pairedId === move.id;
    const beforeLocal = paired || move.before.file === step.file || move.before.file === oldFile;
    const afterLocal = paired || move.after.file === step.file;
    return {
      id: move.id,
      kind: move.kind,
      label: move.label ? narrativeText(move.label) : undefined,
      hidden: move.hidden
        ? {
            as: move.hidden.as,
            tag: narrativeText(move.hidden.tag),
            what: narrative(move.hidden.what, 'inline'),
          }
        : undefined,
      before: {
        ...move.before,
        local: beforeLocal,
        targetStep: beforeLocal ? undefined : targetStep(move.before.file, move.before.range),
      },
      after: {
        ...move.after,
        local: afterLocal,
        targetStep: afterLocal ? undefined : targetStep(move.after.file, move.after.range),
      },
    };
  });
}

function buildConceptStep(step: ConceptTourStep, byId: Map<string, TourStep>): ConceptStepView {
  return {
    id: step.id,
    order: step.order,
    title: narrative(step.title, 'inline'),
    chapter: chapterLabel(step),
    kind: 'concept',
    kindLabel: STEP_KIND_LABEL.concept,
    tags: (step.tags ?? []).map((tag) => narrativeText(tag)),
    body: narrative(step.body, 'block'),
    diagram: step.diagram
      ? {
          type: step.diagram.type,
          // The Mermaid source is not narrative: tour.ts validates it against its
          // own pattern list and the client parses it, so it stays verbatim.
          source: step.diagram.source,
          caption: narrative(step.diagram.caption, 'inline'),
        }
      : undefined,
    preparesFor: step.preparesFor
      .map((id) => byId.get(id))
      .filter((target): target is CodeTourStep => !!target && isCodeStep(target))
      .map((target) => ({ id: target.id, order: target.order, title: narrative(target.title, 'inline') }))
      .sort((a, b) => a.order - b.order),
  };
}

/** Chapters group the rail, so they are compared and printed as plain text. */
function chapterLabel(step: TourStep): string | undefined {
  return narrativeText(step.chapter ?? '').trim() || undefined;
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
    text: narrative(beat.text, 'inline'),
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
  baseRef?: string,
): { blocks: SbsRow[][]; note?: string } {
  const viewport = stepViewport(step);
  const [start, end] = viewport;
  const file = files.find((f) => f.newPath === step.file);

  const paired = pairedMoveFor(step);
  if (paired && paired.before.file !== paired.after.file) {
    const oldSlice = readFileRange(repo, paired.before.file, Math.max(1, paired.before.range[0] - 6), paired.before.range[1] + 6, baseRef);
    const newSlice = readFileRange(repo, paired.after.file, Math.max(1, paired.after.range[0] - 6), paired.after.range[1] + 6, headRef);
    if (oldSlice && newSlice) {
      return { blocks: buildPairedBlocks(oldSlice, newSlice, paired.before.range, paired.after.range) };
    }
    return { blocks: [], note: 'paired move source could not be read at the requested revision' };
  }

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

export interface PairedFileSlice { lines: string[]; startLine: number }

/** Align two independent file slices once at their semantic-anchor top lines. */
export function buildPairedBlocks(
  oldSlice: PairedFileSlice,
  newSlice: PairedFileSlice,
  beforeRange: [number, number],
  afterRange: [number, number],
): SbsRow[][] {
  const oldLead = Math.max(0, beforeRange[0] - oldSlice.startLine);
  const newLead = Math.max(0, afterRange[0] - newSlice.startLine);
  const lead = Math.max(oldLead, newLead);
  const oldPad = lead - oldLead;
  const newPad = lead - newLead;
  const length = Math.max(oldPad + oldSlice.lines.length, newPad + newSlice.lines.length);
  const rows: SbsRow[] = [];
  for (let index = 0; index < length; index += 1) {
    const oldIndex = index - oldPad;
    const newIndex = index - newPad;
    const leftContent = oldIndex >= 0 && oldIndex < oldSlice.lines.length ? oldSlice.lines[oldIndex] : undefined;
    const rightContent = newIndex >= 0 && newIndex < newSlice.lines.length ? newSlice.lines[newIndex] : undefined;
    rows.push({
      type: 'ctx',
      content: rightContent ?? leftContent ?? '',
      leftContent,
      rightContent,
      oldNo: leftContent === undefined ? undefined : oldSlice.startLine + oldIndex,
      newNo: rightContent === undefined ? undefined : newSlice.startLine + newIndex,
      comment: true,
      paired: true,
    });
  }
  return [rows];
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
  detailedFilePaths?: ReadonlySet<string>,
  fileIndex?: readonly ReviewFileIndexEntry[],
): FileView[] {
  const views: FileView[] = [];
  const seen = new Set<string>();

  const summaries = fileIndex ?? files.map((file): ReviewFileIndexEntry => ({
    oldPath: file.oldPath,
    path: file.newPath,
    status: file.status,
    added: countLines(file, 'add'),
    removed: countLines(file, 'del'),
    byteSize: null,
    binary: false,
    large: false,
    generated: false,
    metadataOnly: !file.hunks.length,
    reviewHash: diffFileReviewHash(file),
  }));
  const diffByPath = new Map(files.map((file) => [file.newPath, file]));

  for (const summary of summaries) {
    const file = diffByPath.get(summary.path);
    seen.add(summary.path);
    const uncovered = uncoveredByFile.get(summary.path) ?? [];
    const hunks =
      file && (detailedFilePaths === undefined || detailedFilePaths.has(summary.path))
        ? file.hunks.map((h) => h.lines.map((l) => toUnified(l, uncovered)))
        : [];
    const step = stepByFile.get(summary.path);
    views.push({
      file: summary.path,
      oldFile: summary.oldPath,
      status: summary.status,
      kind: summary.status === 'added' ? 'new' : 'changed',
      kindLabel: summary.status === 'added' ? FILE_KIND_LABEL.new : FILE_KIND_LABEL.changed,
      add: summary.added ?? 0,
      del: summary.removed ?? 0,
      untoured: uncovered.length,
      stepId: step?.id,
      stepOrder: step?.order,
      hunks,
      hunkRanges: file?.hunks.map(hunkNewRange) ?? [],
      hasFull: summary.status !== 'deleted',
      symbols: file ? changedSymbols(file) : [],
      reviewHash: summary.reviewHash,
    });
  }

  // Context-only files (referenced by a context step, absent from the diff).
  for (const step of steps) {
    if (step.kind !== 'context' || seen.has(step.file)) continue;
    seen.add(step.file);
    const detailed = detailedFilePaths === undefined || detailedFilePaths.has(step.file);
    const r = detailed
      ? readFileRange(repo, step.file, step.range[0], step.range[1], headRef)
      : null;
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
      hasFull: detailed ? r !== null : true,
      symbols: [],
      reviewHash: contextFileReviewHash(step.file, rows),
    });
  }

  return views.sort(byStepOrderThenPath);
}

function diffFileReviewHash(file: DiffFile): string {
  const stableHunks = file.hunks.map((hunk) =>
    hunk.lines.map((line) => ({
      type: line.type,
      no: line.type === 'del' ? line.oldNo : line.newNo,
      content: line.content,
    })),
  );
  return createHash('sha256')
    .update(JSON.stringify([
      file.status,
      file.oldPath,
      file.newPath,
      file.hunks.map(hunkNewRange),
      stableHunks,
    ]))
    .digest('hex')
    .slice(0, 64);
}

function contextFileReviewHash(file: string, rows: UnifiedRow[]): string {
  return createHash('sha256')
    .update(JSON.stringify(['modified', file, file, rows.length ? [[rows[0].no, rows[rows.length - 1].no]] : [], [rows]]))
    .digest('hex')
    .slice(0, 64);
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
  includeRows: boolean,
): TrustView {
  const byPath = new Map(files.map((f) => [f.newPath, f]));
  let totalAdd = 0;
  for (const f of files) totalAdd += countLines(f, 'add');

  let uncoveredAdds = 0;
  const views: UncoveredView[] = uncovered.map((u) => {
    const file = byPath.get(u.file);
    const rows = includeRows && file
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
