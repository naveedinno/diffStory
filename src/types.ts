// Shared data shapes for diffStory.
//
// Two authored artifacts flow through the system:
//   - the *story* (story.json) — written by the AI, describes the reading order.
//   - the *comments* (comments.json) — written by the reviewer (via the server),
//     read back by the AI to close the loop.
// Everything else (diffs, snippets, coverage) is derived at render time.

/** What a tour step is pointing at. */
export type CodeStepKind =
  | 'changed' // a region the diff actually touched — render the real hunk(s)
  | 'context' // unchanged code shown only so the change makes sense (e.g. the callee)
  | 'new-file'; // a brand-new file — render the region as added

/** A stop in the reading path: either code evidence or a just-in-time mental model. */
export type StepKind = CodeStepKind | 'concept';

/**
 * App-owned presentation layout derived from a validated step. This is a view
 * projection, never an authored story.json field.
 */
export type StoryStepSceneLayout =
  | 'concept-document'
  | 'concept-diagram'
  | 'code-focus'
  | 'logic-move'
  | 'paired-code';

/** How much detail the authored story should carry. */
export type StoryMode =
  | 'brief' // compact story: every changed hunk, grouped into the fewest useful stops
  | 'guided' // guided review: behavior and context without line-by-line narration
  | 'detailed'; // deep review: more correctness boundaries, while still skipping trivial syntax

/** Optional legacy read-aloud pointer inside a step's wider review window. */
export interface StepFocusTarget {
  /** Inclusive post-change line ranges to glow; [0, 0] means a whole-file deletion. */
  ranges: Array<[number, number]>;
  /** Optional short cue for future reader surfaces. */
  label?: string;
}

/**
 * One read-aloud unit inside a step.
 *
 * Narrative fields across these shapes are authored as restricted HTML, in one
 * of three tiers — block, inline-only, or plain text — fixed by what the
 * surrounding markup can legally hold. docs/story-schema.md is the normative
 * statement of the tiers and the element/attribute allowlist.
 */
export interface StoryBeat {
  /**
   * Short narration spoken as one separate speech unit. Inline-tier HTML: this
   * renders inside a `<button>`, which cannot hold block content.
   */
  text: string;
  /** Inclusive post-change line ranges this beat points at while it is spoken. */
  highlights: Array<[number, number]>;
}

/** The recovered "why" behind the change — shown before any step. */
export interface StoryIntent {
  /** What we wanted to enable: actor + capability, 1-2 sentences. Inline-tier HTML. */
  goal: string;
  /** The flow designed to achieve it, 1-2 sentences. Inline-tier HTML. */
  design?: string;
  /** Evidence the goal rests on: "commit 41af8b7", "PR #12 body", "conversation", "docs/plan.md", or "code-derived". */
  sources?: string[];
  /** Deliberate omissions the reviewer should not flag: "does not touch settlement ordering". Inline-tier HTML. */
  nonGoals?: string[];
}

/** An author-declared low-confidence spot: where the reviewer should distrust the change hardest. */
export interface StoryHotspot {
  /** Id of the code step whose evidence carries the doubt. */
  step: string;
  /** Why the author is least sure here: a guessed boundary, unexercised path, or unverified invariant. Inline-tier HTML. */
  reason: string;
}

/** The changed files the reviewer intentionally asked the generated story to cover. */
export interface StoryScope {
  /** Repo-relative changed files that should receive story steps. */
  includedFiles: string[];
  /** Repo-relative changed files intentionally left out of the story. */
  excludedFiles?: string[];
  /**
   * Optional reviewer guidance captured from the generation form. Plain text —
   * it is reviewer-authored through a browser textarea and has no render
   * surface, so it never carries markup.
   */
  reviewerNote?: string;
}

/** Fields shared by every stop in the guided reading path. */
export interface TourStepBase {
  /** Stable id, referenced by `calls` / `returnsTo` and by comments. */
  id: string;
  /** 1-based position in the reading order. */
  order: number;
  /**
   * Short headline for the step. Plain text — it feeds nine sinks including
   * `aria-label` and `title` attributes, where markup can only ever show as
   * literal characters.
   */
  title: string;
  /** Optional free-form labels (e.g. "entrypoint", "core", "test"). */
  tags?: string[];
  /** Optional concise section label for grouping long reading paths. */
  chapter?: string;
}

/** Fields shared by every code-backed stop. */
export interface CodeTourStepBase extends TourStepBase {
  /** Repo-relative path of the file this step shows. */
  file: string;
  /** Inclusive local camera anchor and legacy coverage claim; [0, 0] means a whole-file deletion. */
  range: [number, number];
  /** Inclusive visible review window the storyteller wants the diff viewer to show. */
  viewport?: [number, number];
  /** Inclusive post-change line ranges inside viewport; [0, 0] means a whole-file deletion. */
  highlights?: Array<[number, number]>;
  /** Optional beat-by-beat narration; each beat is spoken separately with its own highlights. */
  beats?: StoryBeat[];
  /** Optional legacy narrower post-change line range(s) to point at while reading aloud. */
  focus?: StepFocusTarget;
  /**
   * The review-oriented narrative: what to verify, what's subtle, why it's safe.
   * Inline-tier HTML — it renders inside a height-capped `<p>`.
   */
  why: string;
  /** Step ids this one leads into (renders the A -> B jump links). */
  calls?: string[];
  /** Step id to return to afterwards (the B -> A jump back). */
  returnsTo?: string;
}

/** Which version of a file a semantic move endpoint addresses. */
export interface MoveAnchor {
  /** Repo-relative path. Cross-file moves may name a path other than the step file. */
  file: string;
  /** Inclusive old-side (`before`) or new-side (`after`) line range. */
  range: [number, number];
}

/** The closed vocabulary the app can render as a semantic logic move. */
export type LogicMoveKind =
  | 'moved'
  | 'extracted'
  | 'inlined'
  | 'wrapped'
  | 'unwrapped'
  | 'condition-changed'
  | 'reordered'
  | 'flow';

/** A fact about a move that has no line of code to point at. */
export interface MoveHidden {
  /** The invisible relationship the callout describes. */
  as: 'path' | 'destination' | 'consequence';
  /** Short plain-text callout headline. */
  tag: string;
  /** One inline-tier clause the reviewer can act on. */
  what: string;
}

/** One agent-authored semantic relationship between old and new code. */
export interface LogicMove {
  /** Unique within the containing step. */
  id: string;
  kind: LogicMoveKind;
  before: MoveAnchor;
  after: MoveAnchor;
  /** Two- or three-word plain-text tag rendered on the annotation border. */
  label?: string;
  /** The one fact about this move that neither pane shows. */
  hidden?: MoveHidden;
}

/** A changed/new-file stop that may explicitly claim scattered changed spans. */
export interface ChangedCodeTourStep extends CodeTourStepBase {
  kind: 'changed' | 'new-file';
  /**
   * Optional complete coverage-claim list for scattered changed/new-file spans in one file.
   * `range` remains the tight camera anchor contained by one entry; other entries
   * may sit outside `viewport` and must not be collapsed into a bounding box.
   * Absent means the step claims exactly `range`, preserving legacy behaviour.
   */
  ranges?: Array<[number, number]>;
  /** Semantic moves this step's evidence demonstrates. Requires story version 3. */
  moves?: LogicMove[];
  /** Cross-file move id to present as old-file/new-file paired panes. Requires version 3. */
  pairedView?: string;
}

/** An unchanged-code stop; context can frame evidence but never claim diff coverage. */
export interface ContextCodeTourStep extends CodeTourStepBase {
  kind: 'context';
  ranges?: never;
}

/** One code-backed stop with a local camera anchor. */
export type CodeTourStep = ChangedCodeTourStep | ContextCodeTourStep;

/** Optional diagram inside a concept primer. Source is rendered locally by Mermaid. */
export interface ConceptDiagram {
  type: 'mermaid';
  source: string;
  /**
   * Human-readable fallback and accessible description for the diagram.
   * Inline-tier HTML; it is also what the narrator speaks for the figure.
   */
  caption: string;
}

/** A short document stop that teaches a mental model before dependent code. */
export interface ConceptTourStep extends TourStepBase {
  kind: 'concept';
  /**
   * Block-tier narrative HTML: paragraphs, h2-h4, lists, quotes, `pre`, tables,
   * and definition lists. The only field that may carry block markup.
   * See docs/story-schema.md for the element and attribute allowlist.
   */
  body: string;
  /** Later code-step ids this primer exists to prepare the reviewer for. */
  preparesFor: string[];
  /** At most one optional local Mermaid diagram. */
  diagram?: ConceptDiagram;
}

/** One stop on the guided tour. */
export type TourStep = CodeTourStep | ConceptTourStep;

export function isCodeStep(step: TourStep): step is CodeTourStep {
  return step.kind !== 'concept';
}

/**
 * Every changed span a code step claims for the coverage gate. `ranges` exists so
 * one step can honestly claim scattered edits (a rename across twenty call sites)
 * instead of forcing one step per hunk; without it, `range` alone is the claim.
 */
export function claimedRanges(step: CodeTourStep): Array<[number, number]> {
  return step.ranges?.length ? step.ranges : [step.range];
}

/** The whole reading plan the AI emits. */
export interface Tour {
  /** v1 contains code-only steps; v2 permits concepts; v3 permits semantic moves. */
  version: 1 | 2 | 3;
  /** SHA-256 of the exact rendered git diff when the story was last generated or repaired. */
  diffFingerprint?: string;
  /** Immutable post-story repository evidence used for scope-aware freshness and since-story diffs. */
  storySnapshot?: { version: 1; id: string };
  /** Story depth requested at generation time; old stories default to guided. */
  mode?: StoryMode;
  /** Plain text — it feeds `<title>`, the page header, and a chrome tooltip. */
  title: string;
  /** Inline-tier HTML — it renders inside the intro `<p>` the narrator reads. */
  summary: string;
  /** Optional recovered intent: the goal, designed flow, and evidence sources. */
  intent?: StoryIntent;
  /** Author-declared distrust spots (at most 3), each anchored to a code step. */
  hotspots?: StoryHotspot[];
  /** Optional file-level generation scope for focused stories. */
  storyScope?: StoryScope;
  /** Optional git ref to diff against; overrides auto-detection. */
  base?: string;
  /** Optional head ref for fixed base..head stories. Omitted means working tree vs base. */
  head?: string;
  steps: TourStep[];
}

export type CommentType = 'change' | 'question' | 'nit';
/** Legacy impact field retained only so older comments.json files remain readable. */
export type CommentSeverity = 'blocking' | 'concern' | 'nit';
export type CommentStatus = 'open' | 'addressed' | 'resolved';
export type CommentSide = 'left' | 'right';

/** Legacy conversation data retained for backwards-compatible file parsing. */
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
  /**
   * Story this comment was left against, as a listStories() id ("story.json",
   * "stories/quote-v2.json"). Absent on comments written before stories were
   * separable, and on comments left outside a story; an absent value reads as
   * "belongs to every story" so no existing feedback disappears.
   */
  story?: string;
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
  /** Legacy field; new comments use their type without a second severity axis. */
  severity?: CommentSeverity;
  body: string;
  status: CommentStatus;
  /** Review round in which the comment was created. */
  reviewRound?: number;
  /** Snapshot the selected code belonged to, for version-aware verification. */
  reviewSnapshotId?: string;
  /** Stable digest of the selected text and its original anchor. */
  anchorHash?: string;
  /** ISO timestamp; set by the server. */
  createdAt: string;
  /** Legacy AI field; preserved on disk but not used by the review UI. */
  reply?: string;
  /** Legacy conversation field; preserved on disk but not used by the review UI. */
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

/**
 * Bounded metadata for one changed path. Unlike DiffFile this shape never
 * carries hunk or source bytes, so it is safe to build for the initial page
 * even when the underlying change is extremely large.
 */
export interface ReviewFileIndexEntry {
  oldPath: string;
  path: string;
  status: FileStatus;
  added: number | null;
  removed: number | null;
  /** Current-side size, or base-side size for a deletion. */
  byteSize: number | null;
  binary: boolean;
  large: boolean;
  generated: boolean;
  metadataOnly: boolean;
  /** Stable identity for lazy detail responses and stale-response rejection. */
  reviewHash: string;
}
