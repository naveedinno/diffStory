# Story-shaped progress + generating-state takeover

**Date:** 2026-07-03
**Status:** Approved

## Problem

Two complaints from real use:

1. **Progress reads as tool spam.** The shared ProgressPanel was designed
   around the agent's TodoWrite plan, but story-generation agents never emit
   one, so the panel falls back to raw tool labels
   (`Reading /Users/…/package.json`). Meanwhile the story prompt already
   forces the agent to work in three named phases and print visible notes
   (the recovered goal, the narrative arc) — and the panel buries those
   `text` events in the failure-only Details disclosure.

2. **The page looks idle while generating.** On the change page ("No story
   yet"), pressing Generate leaves the form on screen and shows only a small
   floating panel. It is unclear that a run is in flight, what it is doing,
   or what the user can do meanwhile.

## Decisions

- **Story tab takeover**: while generating, the story tab's intro becomes a
  full-width progress stage; the All files tab stays live with a hint that
  the diff can be read meanwhile.
- **Progress = milestones + narration + honest counts**, derived per the
  live-progress protocol philosophy: the app owns the spine, agent output
  only enriches it. No fake percentages.
- **Shared panel upgrade**: the richer rendering lives in the shared
  ProgressPanel so review-screen floating/inline runs benefit too.
- **Signal source = marked notes + inference fallback** (Approach 1):
  the prompt's existing phase notes become machine-recognizable; observable
  events remain the honest fallback when markers are missing.

## Design

### 1. Protocol (`src/progress.ts`)

- Add two phases to the `Phase` union and `PHASE_ORDER`:
  `recovering_why` and `designing_path`, ordered
  `… → agent_running → reading_changes → recovering_why → designing_path →
  writing_output → …`. The existing monotonic guard (`phaseRank`) prevents
  late file-reads from dragging the display backwards.
- No new event types. Narration uses the existing `activity` event with
  kind `'narration'` (already in the union, currently unused). Milestone
  advances are ordinary `phase` events.
- `file` events gain optional enrichment fields: `rel` (repo-relative
  path) and `changedIndex` / `changedTotal` (distinct changed files read so
  far / total in scope) so the UI can render
  "Reading changed files · 3 of 8 · package.json".
- `PHASE_LABELS` gains labels for the two new phases
  ("Recovering the why", "Designing the reading path").

### 2. Prompt (`src/agent.ts`)

The story prompt already orders visible notes for Phases 1–2. Tighten it:

- Each phase begins by printing an exact marker line on its own line:
  `>> Recovering the why`, `>> Designing the reading path`,
  `>> Writing the steps`.
- Phase notes (the recovered goal, the narrative arc) are printed as
  `>> <text>` lines.

Human-readable in raw logs, trivially parseable, agent-agnostic (plain
stdout — works for both Claude and Codex).

### 3. Server (`src/server.ts`)

- A pure line-parser over agent stdout: the three exact marker lines map to
  `phase` events (`recovering_why`, `designing_path`, `writing_output`);
  any other line starting with `>>` becomes
  `activity(kind:'narration', label:<text>)`. Only exact markers advance
  phases — garbage cannot fake a milestone.
- Inference fallback keeps the spine honest when markers are absent:
  - `command` events containing `git log` / `gh pr view` → `recovering_why`;
  - existing `observedPhase()` already maps reads → `reading_changes` and
    story-file writes → `writing_output`;
  - validation/applying stays app-owned as today.
- The server knows the diff scope, so it matches `file` read events against
  the changed-file set (repo-relative suffix match, distinct files only)
  and emits the enriched `rel` / `changedIndex` / `changedTotal` fields.

### 4. Shared panel (`src/progress-ui.ts`)

- **Milestone strip** rendered from `phase` events with workflow-specific
  labels. Story runs: Preparing → Recovering the why → Designing the
  reading path → Writing the story → Checking the result → Ready.
  Address runs: Preparing → Working the comments → Checking → Done, with
  the agent's TodoWrite plan remaining the centerpiece beneath the strip
  when present.
- **Narration**: the most recent `narration` activity is displayed
  prominently in text type (not monospace), clipped sanely.
- **Activity line** demoted to small print: repo-relative paths and counts
  ("Reading changed files · 3 of 8 · package.json") instead of absolute
  paths.
- New **`stage` variant**: full-width, larger type, for embedding in the
  page body rather than floating. Existing `floating` / `inline` variants
  keep working and inherit the richer content.

### 5. Change-page takeover (`src/page-assets.ts`, `src/render.ts`)

- On Generate: hide the storygen form; relocate the single shared panel
  node into the story tab's intro section as the `stage` variant (same
  relocate/restore pattern address runs already use), under a swapped
  title — "Writing the story of this change" — plus a hint:
  "Keep reading the diff under All files — the story will land here."
- The All files tab stays fully usable during the run.
- Outcomes: complete + story written → navigate to the review URL
  (existing behavior); failed → error state with Details plus a
  "Try again" that restores the form; stopped → form restores.
- The review screen keeps floating/inline placement and gets milestones +
  narration for free.

## Error handling

- Missing markers → inference-only spine (still honest, just flatter).
- Missing narration → counted activity line carries the panel; never blank.
- Marker lines are exact-match; monotonic ordering rejects backwards jumps.
- Heartbeat / quiet display and Stop/Close semantics unchanged.

## Testing

- Pure functions unit-tested alongside existing progress tests: the `>>`
  line parser, phase ordering with the two new phases, and the
  changed-file matcher / counter.
- The takeover and panel rendering verified in the browser (change page:
  generate, stop, fail, complete paths; review page: floating run).
- Per repo rule, `dist/` is rebuilt and committed with the change.

## Out of scope

- No changes to story content/validation, TTS, or comments workflows.
- No bespoke console: all rendering stays in the shared ProgressPanel.
