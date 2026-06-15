// Shared data shapes for diffStory.
//
// Two authored artifacts flow through the system:
//   - the *tour* (review-tour.json) — written by the AI, describes the reading order.
//   - the *comments* (comments.json) — written by the reviewer (via the server),
//     read back by the AI to close the loop.
// Everything else (diffs, snippets, coverage) is derived at render time.

/** What a tour step is pointing at. */
export type StepKind =
  | 'changed' // a region the diff actually touched — render the real hunk(s)
  | 'context' // unchanged code shown only so the change makes sense (e.g. the callee)
  | 'new-file'; // a brand-new file — render the region as added

/** One stop on the guided tour. */
export interface TourStep {
  /** Stable id, referenced by `calls` / `returnsTo` and by comments. */
  id: string;
  /** 1-based position in the reading order. */
  order: number;
  /** Short headline for the step. */
  title: string;
  /** Repo-relative path of the file this step shows. */
  file: string;
  /** Inclusive line range in the *post-change* file, [start, end] (1-based). */
  range: [number, number];
  kind: StepKind;
  /** The review-oriented narrative: what to verify, what's subtle, why it's safe. */
  why: string;
  /** Step ids this one leads into (renders the A -> B jump links). */
  calls?: string[];
  /** Step id to return to afterwards (the B -> A jump back). */
  returnsTo?: string;
  /** Optional free-form labels (e.g. "entrypoint", "core", "test"). */
  tags?: string[];
}

/** The whole reading plan the AI emits. */
export interface Tour {
  version: 1;
  title: string;
  summary: string;
  /** Optional git ref to diff against; overrides auto-detection. */
  base?: string;
  steps: TourStep[];
}

export type CommentType = 'change' | 'question' | 'nit';
export type CommentStatus = 'open' | 'addressed' | 'resolved';

/** A reviewer comment anchored to a line, persisted for the agent to consume. */
export interface Comment {
  id: string;
  /** Step the comment was left on (anchors it even if line numbers drift). */
  step: string;
  file: string;
  /** Line number in the post-change file, as shown at comment time. */
  line: number;
  type: CommentType;
  body: string;
  status: CommentStatus;
  /** ISO timestamp; set by the server. */
  createdAt: string;
  /** Filled in by the AI during /address-review. */
  reply?: string;
}

// ---- Derived (parsed) diff shapes ----

export type DiffLineType = 'add' | 'del' | 'ctx';

export interface DiffLine {
  type: DiffLineType;
  content: string;
  /** Line number in the old file (undefined for added lines). */
  oldNo?: number;
  /** Line number in the new file (undefined for deleted lines). */
  newNo?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed';

export interface DiffFile {
  oldPath: string;
  newPath: string;
  status: FileStatus;
  hunks: DiffHunk[];
}
