// Shared data shapes for diffStory.
//
// Two authored artifacts flow through the system:
//   - the *story* (story.json) — written by the AI, describes the reading order.
//   - the *comments* (comments.json) — written by the reviewer (via the server),
//     read back by the AI to close the loop.
// Everything else (diffs, snippets, coverage) is derived at render time.

/** What a tour step is pointing at. */
export type StepKind =
  | 'changed' // a region the diff actually touched — render the real hunk(s)
  | 'context' // unchanged code shown only so the change makes sense (e.g. the callee)
  | 'new-file'; // a brand-new file — render the region as added

/** How much detail the authored story should carry. */
export type StoryMode =
  | 'brief' // quickest skim: one short sentence per meaningful change cluster
  | 'guided' // balanced review path: enough context to read the diff in the right order
  | 'detailed'; // line-by-line correctness audit: longer, code-path explanation

/** Optional legacy read-aloud pointer inside a step's wider review window. */
export interface StepFocusTarget {
  /** Inclusive post-change line ranges to glow; [0, 0] means a whole-file deletion. */
  ranges: Array<[number, number]>;
  /** Optional short cue for future reader surfaces. */
  label?: string;
}

/** One read-aloud unit inside a step. */
export interface StoryBeat {
  /** Short narration spoken as one separate speech unit. */
  text: string;
  /** Inclusive post-change line ranges this beat points at while it is spoken. */
  highlights: Array<[number, number]>;
}

/** The recovered "why" behind the change — shown before any step. */
export interface StoryIntent {
  /** What we wanted to enable: actor + capability, 1-2 sentences. */
  goal: string;
  /** The flow designed to achieve it, 1-2 sentences. */
  design?: string;
  /** Evidence the goal rests on: "commit 41af8b7", "PR #12 body", "conversation", "docs/plan.md", or "code-derived". */
  sources?: string[];
}

/** The changed files the reviewer intentionally asked the generated story to cover. */
export interface StoryScope {
  /** Repo-relative changed files that should receive story steps. */
  includedFiles: string[];
  /** Repo-relative changed files intentionally left out of the story. */
  excludedFiles?: string[];
  /** Optional reviewer guidance captured from the generation form. */
  reviewerNote?: string;
}

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
  /** Inclusive changed-line coverage anchor in the post-change file; [0, 0] means a whole-file deletion. */
  range: [number, number];
  /** Inclusive visible review window the storyteller wants the diff viewer to show. */
  viewport?: [number, number];
  /** Inclusive post-change line ranges inside viewport; [0, 0] means a whole-file deletion. */
  highlights?: Array<[number, number]>;
  /** Optional beat-by-beat narration; each beat is spoken separately with its own highlights. */
  beats?: StoryBeat[];
  /** Optional legacy narrower post-change line range(s) to point at while reading aloud. */
  focus?: StepFocusTarget;
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
  /** Story depth requested at generation time; old stories default to guided. */
  mode?: StoryMode;
  title: string;
  summary: string;
  /** Optional recovered intent: the goal, designed flow, and evidence sources. */
  intent?: StoryIntent;
  /** Optional file-level generation scope for focused stories. */
  storyScope?: StoryScope;
  /** Optional git ref to diff against; overrides auto-detection. */
  base?: string;
  /** Optional head ref for fixed base..head stories. Omitted means working tree vs base. */
  head?: string;
  steps: TourStep[];
}

export type CommentType = 'change' | 'question' | 'nit';
export type CommentStatus = 'open' | 'addressed' | 'resolved';
export type CommentSide = 'left' | 'right';

/** One message in a review-thread conversation: the reviewer (`user`) or the AI. */
export interface Turn {
  role: 'user' | 'ai';
  text: string;
  /** ISO timestamp; set by the server. */
  at: string;
}

/** The selected code text a reviewer anchored a comment to. */
export interface CommentSelection {
  /** Inclusive line range covered by the selected text, on the selected diff side. */
  startLine: number;
  endLine: number;
  /** Best-effort 1-based column offsets inside the first and last selected lines. */
  startColumn?: number;
  endColumn?: number;
}

/** A reviewer comment anchored to selected text, persisted for the agent to consume. */
export interface Comment {
  id: string;
  /** Optional Story-view placement hint; absent for comments left in the All-files view. */
  step?: string;
  /** Diff side selected by the reviewer. Absent means the legacy right/current side. */
  side?: CommentSide;
  file: string;
  /** First selected-side line for placement and backward compatibility. */
  line: number;
  /** Reviewer-selected code/text snippet. Absent on legacy line-anchored comments. */
  selectedText?: string;
  /** Selected-side line range and optional columns. */
  selection?: CommentSelection;
  type: CommentType;
  body: string;
  status: CommentStatus;
  /** ISO timestamp; set by the server. */
  createdAt: string;
  /** Filled in by the AI during /address-review. */
  reply?: string;
  /** Ordered follow-up conversation after `body`. Absent on legacy single-reply comments. */
  turns?: Turn[];
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
