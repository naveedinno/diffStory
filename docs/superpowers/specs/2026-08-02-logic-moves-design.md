# Logic Moves — semantic diff visualization

**Date:** 2026-08-02
**Status:** Approved design, ready for implementation
**Story schema impact:** Tour `version: 3`

## 1. What this is

Today diffStory shows *text* changing: red lines out, green lines in. It never shows the
*shape of the logic* changing. In a change like the LibSettlement refactor — where the
isolated-branch math gets wrapped in a new `!isCrossPartyB` gate and the raw balance
arithmetic becomes two named `LibAccount` calls — the reviewer has to reconstruct
"this block is now guarded" and "this logic moved into another library" in their head
from line noise.

**Logic Moves** lets the storytelling agent assert a small closed vocabulary of semantic
moves (`moved`, `extracted`, `wrapped`, …) as structured data on story steps. The app —
never the agent — renders each move visually on the real diff: ribbons and brackets
drawn in the seam between the before/after panes, connecting the exact old lines to the
exact new lines. Moves can cross files ("this block moved into LibAccount.sol"), and a
step can present a **paired view**: old-file-A on the left, new-file-B on the right.

Two principles drive everything below:

1. **The agent asserts, the app draws.** The agent never emits pixels, SVG, or Mermaid
   for this feature. It emits typed facts (`{kind: 'wrapped', before: …, after: …}`).
   The app owns layout, glyphs, color, and interaction, so quality is consistent across
   generations.
2. **The trigger is "can you name the move?"** — not "is this complex?". If a hunk's
   story is one of the vocabulary verbs, the agent annotates it. If it's just text
   changing, it doesn't. This makes the authoring decision mechanical and checkable.

### Non-goals

- No automatic AST/tree-sitter derivation of moves. Moves are agent-authored claims,
  app-verified where cheap (see §6).
- No freeform diagram language. The single escape hatch is the `flow` kind (§3).
- No backward compatibility with stories generated before this design. Old saved
  stories (v2) still *open*, but generation requires v3 and moves are v3-only.
- The plain "All files" diff view (no story) is out of scope; moves render only inside
  story steps, because only the story carries them.

## 2. The move vocabulary

Eight kinds. Seven named verbs plus one escape hatch. The disambiguation rules are part
of the contract — they go verbatim into the storyteller skill.

| Kind | Meaning | Disambiguation rule |
| --- | --- | --- |
| `moved` | Same logic, new home (may be cross-file) | No call remains at the old site |
| `extracted` | Logic became a named function + a call site (may be cross-file) | A call *replaces* it at the old site |
| `inlined` | Reverse of `extracted`: a call was replaced by its body | — |
| `wrapped` | Lines are now guarded by a new condition | The branch structure *grew* a gate |
| `unwrapped` | A guard was removed from these lines | — |
| `condition-changed` | Same branch shape, different predicate | Structure unchanged; only the test changed |
| `reordered` | Blocks swapped execution order | Nothing added or removed; order flipped |
| `flow` | Freeform labeled connection, any before-anchor → any after-anchor | Only when no verb above fits; `label` is required |

Wrong-verb failures degrade gracefully: if the agent says `moved` where `extracted` was
truer, the rendered ribbon still connects old site → new site and the review still
works. The vocabulary is small on purpose; `flow` absorbs the unnameable rest.

## 3. Schema (Tour v3)

New shapes in [types.ts](src/types.ts), attached to code steps:

```ts
/** Which version of a file a move endpoint addresses. */
export interface MoveAnchor {
  /** Repo-relative path. May differ from the step's file (cross-file moves). */
  file: string;
  /**
   * Inclusive line range. Semantics depend on the endpoint:
   * `before` anchors use PRE-change numbering of the OLD version of `file`;
   * `after` anchors use POST-change numbering of the NEW version of `file`.
   */
  range: [number, number];
}

export type LogicMoveKind =
  | 'moved' | 'extracted' | 'inlined'
  | 'wrapped' | 'unwrapped'
  | 'condition-changed' | 'reordered'
  | 'flow';

/** One agent-asserted semantic move, rendered visually by the app. */
export interface LogicMove {
  /** Unique within the step; referenced by DOM attributes and the paired view. */
  id: string;
  kind: LogicMoveKind;
  before: MoveAnchor;
  after: MoveAnchor;
  /**
   * Short plain-text caption (tier C, like `title`): it feeds chips, tooltips,
   * and aria-labels. Required for `flow`; optional otherwise.
   * For `wrapped`/`unwrapped`/`condition-changed` it should name the predicate,
   * e.g. "now gated by !isCrossPartyB".
   */
  label?: string;
}
```

`ChangedCodeTourStep` gains:

```ts
/** Semantic moves this step's evidence demonstrates. Requires version 3. */
moves?: LogicMove[];
/**
 * Optional cross-file paired presentation: render this move's `before.file`
 * (old version) as the LEFT pane and `after.file` (new version) as the RIGHT
 * pane, instead of the normal same-file split view. Value is a move id from
 * `moves` whose two anchors are in different files. Requires version 3.
 */
pairedView?: string;
```

`Tour.version` becomes `1 | 2 | 3`.

### Versioning decision (no-legacy rule)

- `validateTour` accepts 2 and 3 so previously saved stories still open. (v1 support
  can be dropped in the same change; nothing we care about emits v1 anymore.)
- `moves` and `pairedView` are rejected on any version below 3 — same pattern as the
  existing "concept requires version 2" gate at [tour.ts:609](src/tour.ts:609).
- `validateGeneratedTour` requires `version: 3`, and the prompt pin in
  [agent.ts:104](src/agent.ts:104) moves to 3. No shims, no migration code.

### Anchor semantics, precisely

- `before.range` addresses the old blob of `before.file` (the base side of the diff) in
  old line numbers — the numbering already carried by `ds-cell-l` rows as
  `data-line` when `data-side="left"`.
- `after.range` addresses the new blob of `after.file` in new line numbers — the
  numbering used by `viewport`/`highlights` today.
- Same-file move: `before.file === after.file === step.file`. Both endpoints resolve to
  rows of the step's own split view.
- Cross-file move: exactly one endpoint matches `step.file`* — the other names a
  different file. The step that owns the move is the *viewing* step; the far endpoint
  either renders as a jump chip (§5.4) or becomes the far pane of a paired view (§5.5).

\* Validation enforces that at least one anchor's `file` equals `step.file` (for
same-file moves both do), so a move is always visible from the step that carries it.

### Authoring example (the LibSettlement change)

```jsonc
{
  "id": "settle-isolated",
  "kind": "changed",
  "file": "contracts/core/libraries/LibSettlement.sol",
  "range": [244, 260],
  "viewport": [230, 270],
  "moves": [
    {
      "id": "gate-isolated",
      "kind": "wrapped",
      "before": { "file": "contracts/core/libraries/LibSettlement.sol", "range": [251, 254] },
      "after":  { "file": "contracts/core/libraries/LibSettlement.sol", "range": [244, 260] },
      "label": "now gated by !isCrossPartyB"
    },
    {
      "id": "extract-decrease",
      "kind": "extracted",
      "before": { "file": "contracts/core/libraries/LibSettlement.sol", "range": [252, 252] },
      "after":  { "file": "contracts/core/libraries/LibAccount.sol", "range": [118, 131] },
      "label": "raw balance math → LibAccount.decreasePartyBAllocatedBalance"
    }
  ]
}
```

## 4. Where moves live in the pipeline

The compile model copies the proven `data-step-focus` pattern: **the server resolves
authored line ranges into per-row DOM attributes; the client never sees line numbers.**
(Precedent: `rowVoiceFocusIndex` at [render.ts:1480](src/render.ts:1480) feeding
`focusRowsForGroup` at [page-assets.ts:1827](src/page-assets.ts:1827).)

```
story.json (LogicMove[])
   │  server render of a step panel
   ▼
per-row attributes:  data-move="gate-isolated:before gate-isolated:after"
plus a per-panel manifest: <script type="application/json" data-move-manifest>
   │  client, on step activation / relayout
   ▼
SVG overlay positioned inside .ds-diff  (ribbons, brackets, glyphs)
+ accessible move chips in the step header (the non-visual rendering)
```

- A row can participate in several moves; the attribute is a space-separated list of
  `moveId:endpoint` tokens.
- The manifest carries each move's `id`, `kind`, `label`, and whether each endpoint is
  local (rows exist in this panel) or remote (cross-file / outside viewport), plus the
  remote step index to jump to. The client draws from the manifest + row geometry only.

## 5. Rendering design

### 5.1 The canvas

The seam between the panes is currently `.ds-celldiv` — a 1px divider that is also the
split-resize drag handle ([diff-render.ts:119](src/diff-render.ts:119),
[diff-assets.ts:83](src/diff-assets.ts:83), resize logic at
[page-assets.ts:4309](src/page-assets.ts:4309)). **Do not overload it.** Instead:

- The overlay is one absolutely-positioned `<svg class="ds-moves" aria-hidden="true">`
  appended inside the step's `.ds-diff` (already `position: relative`,
  [diff-assets.ts:19](src/diff-assets.ts:19)), spanning the full `.ds-diffbody` size, with
  `pointer-events: none` (individual hit targets re-enable `pointer-events: auto`).
- It scrolls with the content for free because it lives inside the scrolled container.
- Ribbons route through the seam's x-position (derived from the first `.ds-celldiv`'s
  bounding box), so visually the connection "flows through the gutter" without touching
  the divider element or its `role="separator"` semantics
  ([diff-assets.ts:242](src/diff-assets.ts:242)).
- Precedent for content living on the seam: the split hunk-gap's `.ds-gap-mid`
  zero-width lane ([diff-assets.ts:153](src/diff-assets.ts:153)).

### 5.2 Visual vocabulary (Signal design language)

All colors come from existing Signal tokens (ink, signal blue, the diff add/del hues);
no new palette. Strokes are thin (1–1.5px), labels are the existing mono UI font.
Nothing animates by default; `prefers-reduced-motion` is already the house rule and
this feature introduces no continuous motion at all — geometry only redraws on layout
changes.

| Kind | Drawing |
| --- | --- |
| `moved` | A ribbon (cubic bézier band) from the before-rows' bounding box edge (left pane) to the after-rows' box edge (right pane), routed through the seam. Small ⇢ glyph at the seam midpoint. |
| `extracted` | Ribbon as `moved`, but the seam glyph is ƒ and the after edge gets a function-bracket cap. Cross-file: chip instead (§5.4). |
| `inlined` | Mirror of `extracted` (ƒ glyph, direction reversed). |
| `wrapped` | A bracket spine drawn just inside the *right* pane along the after-range rows, plus a gate glyph (⊃ / diamond) at the top with the label chip. A thin tether connects the bracket to the before-rows on the left. |
| `unwrapped` | Same bracket on the *left* pane (the guard that existed), open-gate glyph, tether to the after-rows. |
| `condition-changed` | Both predicate rows get an underline tick; a straight connector joins them through the seam with a Δ glyph. |
| `reordered` | Two ribbons that visibly cross in the seam (the crossing IS the message). |
| `flow` | Dashed ribbon with an arrowhead and the mandatory label chip at the seam midpoint. |

Hover/focus on any ribbon, glyph, or chip highlights both endpoint row groups (reuse
the existing `.is-story-focus` row treatment) and dims other move ribbons.

### 5.3 Geometry, lifecycle, performance

- A pure function `computeMoveGeometry(manifest, rowBoxes, seamX, bodyBox)` (top-level
  function in `DIFF_JS` so `clientFunction()` can extract and unit-test it) maps row
  bounding boxes → SVG path data. All DOM measurement happens outside it.
- Redraw triggers: step activation ([page-assets.ts:1703](src/page-assets.ts:1703)),
  split-resize (`--ds-split` changes, rAF-batched like the existing resize), hunk-gap
  expansion, Unified/Split/Full mode toggle (overlay renders **only in Split mode**;
  Unified mode falls back to chips), and container `ResizeObserver`.
- Only the **active** step panel ever has a live overlay; deactivating a step removes
  its SVG. With 300-step stories the cost is O(moves in the active step), bounded by
  validation at ≤6 moves per step. No per-frame work, no listeners on inactive panels.
- Endpoints outside the rendered viewport (rows not in the DOM because
  `stepBlocks` filters to the viewport, [view-model.ts:503](src/view-model.ts:503))
  degrade to an edge stub: the ribbon runs to the top/bottom edge of the panel with a
  chevron, and the chip jumps/scrolls on click. Never require off-DOM geometry.

### 5.4 Cross-file moves, stage A: jump chips

When a move's far endpoint is not in this panel's file pair, the overlay draws the
local endpoint treatment (bracket/box) and terminates the ribbon at the seam in a
**chip**: `⇢ LibAccount.sol:118–131` (+ label). Clicking the chip activates the step
that shows the far file (the manifest carries the target step index, resolved
server-side by scanning steps for one whose file matches and whose claimed ranges
intersect the anchor; if none exists, the chip opens the file panel at that range).
The same chips also render as a plain, focusable list in the step header —
that list is the accessible rendering of all moves (the SVG stays `aria-hidden`).

### 5.5 Cross-file moves, stage B: the paired view

A step with `pairedView: "<moveId>"` renders its diff surface as a **pairing**, not a
diff: left pane shows the OLD version of `before.file` around `before.range`; right
pane shows the NEW version of `after.file` around `after.range`. This is the "this
block moved into an internal function of that library" reading experience.

Design decisions that keep this tractable:

- **A paired view is a presentation of one move, not a general two-file diff.** No
  line-matching algorithm: left rows and right rows are independent streams, aligned
  once at the anchor tops (filler cells pad the shorter lead-in). Rows render through
  the existing `renderSplitRow` machinery with a new row shape that carries separate
  left/right content (the current `SbsRow` has a single `content` field —
  [view-model.ts:39](src/view-model.ts:39) — which is the one structural blocker; see
  Stage 4 tasks).
- Left rows are tinted with the existing del-side neutral, right rows with the add-side
  neutral; the move's ribbon renders in the seam exactly as in same-file mode, which is
  what makes the paired view legible at a glance.
- The panel header (currently hardcoding one file on both sides at
  [render.ts:1425](src/render.ts:1425)) shows `BEFORE before.file` / `AFTER after.file`.
- Old-side content comes from `git show <base>:<file>` range reads (the bounded range
  reader in [git.ts:911](src/git.ts:911) already exists for context steps); new-side
  content reuses the full-file path. Both respect the existing size caps.
- Comments: rows carry their real `data-comment-file`/`side`/`line` (the row targets
  already support left≠right paths via `oldFile`, [render.ts:1463](src/render.ts:1463)),
  so selection-anchored comments keep working in paired views with no comment-schema work.
- The step keeps a normal `viewport`/`highlights`/`beats` contract on the **after**
  side; beats highlight rows in the right pane. Validation requires the after anchor's
  file to be `step.file` when `pairedView` is set, so coverage accounting is unchanged.

## 6. Validation & verification

### Structural validation ([tour.ts](src/tour.ts), pure, agent-visible errors)

Added to `validateCodeStep` / new `validateMoves`, following the existing
error-string style (`steps[3].moves[1].before.range must be …`):

- `moves`/`pairedView` require `version: 3`.
- Move ids unique within the step; `kind` in the vocabulary; anchors well-formed
  (`file` non-empty string, `range` a valid inclusive pair).
- `label` required for `flow`; plain text (reject markup, same rule as `title`); ≤ 80 chars.
- ≤ 6 moves per step (rendering sanity + authoring restraint).
- At least one anchor of every move must be in `step.file`.
- Same-file moves: the after anchor must intersect the step's `viewport` (otherwise the
  move is invisible where it's claimed).
- `pairedView` must reference an existing move id on the same step whose anchors are in
  two different files, and that move's `after.file` must equal `step.file`.
- Anchor files must be inside `storyScope.includedFiles` when a scope exists
  (alongside the existing check at [tour.ts:419](src/tour.ts:419)).

### Content verification (server-side, generation/repair time)

`finishStoryGeneration` ([server.ts:1785](src/server.ts:1785)) gains a moves-verification
pass with repo access. These checks produce the same repairable error strings the agent
already fixes via `storyRepairPrompt`:

- Every anchor's range must exist in the addressed blob (old blob for `before`, new
  blob for `after`) — hard error.
- `moved`: normalized text (whitespace-collapsed) of the two anchors must be
  substantially similar (≥ 70% token overlap) — hard error below the bar, since a
  false `moved` claim is actively misleading.
- `extracted`/`inlined`: the after/before range must be a real function-shaped region
  that contains the majority of the other side's tokens — soft warning only (logged,
  not blocking), because extraction legitimately renames and reshapes.
- Cross-file anchors must point at files present in the diff **or** resolvable in the
  repo at the relevant ref (context files are legal targets) — hard error otherwise.

## 7. Agent authoring: how the storyteller decides

Changes to [skills/diffstory-storyteller/SKILL.md](skills/diffstory-storyteller/SKILL.md)
(new section after §5 "Storyboard code viewports and highlighted lines", ~line 511) and
the machine-checked parts duplicated into `storyPrompt`
([agent.ts:113–160](src/agent.ts:113)) per that file's stated convention:

**The decision rule (verbatim in the skill):**

> While storyboarding each step, ask: *can you name what happened to the logic using
> one of the eight move verbs?* If yes, you MUST record it as a move — the reviewer
> should see the shape change, not reconstruct it. If the honest answer is "text
> changed", record nothing. Never use `flow` when a named verb fits. Never annotate
> formatting, renames of variables, or comment edits as moves.

Plus: the disambiguation table from §2 verbatim; anchor numbering semantics (before =
old numbering, after = new numbering); the numeric caps; one worked example (the
LibSettlement change above); and a rule that any `extracted`/`moved` whose target file
is in the diff should make the storyteller *consider* (not require) a `pairedView` step
when the target body is substantial enough to deserve side-by-side reading.

`storyPrompt` inline additions (field names + limits only, a few lines): the `moves`
field shape, the eight kind strings, ≤ 6 moves/step, `label` rule, version 3 pin.

## 8. Implementation plan

Repo ground rules for every stage (from project memory / CONTRIBUTING):

- **Rebuild and commit `dist/` with every `src/` change** (GitHub installs have no build step).
- After editing `PAGE_JS`/`DIFF_JS` template strings, **syntax-check the emitted JS
  with `node --check`** (client code lives in template literals tsc can't parse).
- **Never name a banned API or UI string in a `PAGE_JS`/`DIFF_JS` comment** — inlined
  comments are page content and trip whole-document `doesNotMatch` test assertions.
- Keep 300-step stories fast: no work proportional to story size on inactive panels.
- Tests: `npm test` (unit tests import from `dist/`, so build first).

### Stage 1 — Schema + validation (no UI)

*Files: [src/types.ts](src/types.ts), [src/tour.ts](src/tour.ts), [docs/story-schema.md](docs/story-schema.md), [test/tour.test.mjs](test/tour.test.mjs)*

1. Add `MoveAnchor`, `LogicMoveKind`, `LogicMove`; extend `ChangedCodeTourStep` with
   `moves?`/`pairedView?`; widen `Tour.version` to `1 | 2 | 3`.
2. `validateTour`: accept version 3; implement every structural rule in §6; gate
   `moves`/`pairedView` on v3 (copy the concept/v2 gate pattern,
   [tour.ts:609](src/tour.ts:609)).
3. `validateGeneratedTour`: require version 3.
4. `docs/story-schema.md`: add `label` to the tier-C (plain text) list.
5. Tests: valid v3 story with moves passes; each structural rule produces its exact
   error string; v2 story with moves fails with the version-gate message.

**Acceptance:** `npm test` green; a hand-written v3 story with the §3 example validates.

### Stage 2 — Same-file rendering (the core feature)

*Files: [src/view-model.ts](src/view-model.ts), [src/render.ts](src/render.ts),
[src/diff-render.ts](src/diff-render.ts), [src/diff-assets.ts](src/diff-assets.ts),
[src/page-assets.ts](src/page-assets.ts), [test/diff-render.test.mjs](test/diff-render.test.mjs),
[test/render-page.test.mjs](test/render-page.test.mjs)*

1. **Server compile:** in the step-panel render path, resolve each move endpoint to row
   matches — before-anchors match `data-side="left"` rows by old line number,
   after-anchors match right rows by new line number (the resolution lives next to
   `rowVoiceFocusIndex`, [render.ts:1480](src/render.ts:1480)). Emit `data-move`
   tokens via `SplitRowOpts` ([diff-render.ts:101](src/diff-render.ts:101)) and the
   per-panel JSON manifest `<script type="application/json" data-move-manifest>` inside
   the step's `.ds-diff`.
2. **Overlay:** new functions in `DIFF_JS` (they share the page IIFE closure):
   `renderMoveOverlay(panel)`, the pure `computeMoveGeometry(...)`, and hover/focus
   wiring. SVG per §5.1–5.3; kind glyphs per §5.2; Split-mode only.
3. **Chips list:** render the accessible move list into the step header
   (`codeStepPanel`, [render.ts:1166](src/render.ts:1166)); chips focus/hover mirror
   ribbon hover; clicking scrolls the other endpoint into view (reuse
   `centerFocusRows` mechanics, [page-assets.ts:1855](src/page-assets.ts:1855)).
4. **Lifecycle:** draw on `activateStep`; tear down on deactivate; redraw on
   split-resize/gap-expand/mode-toggle/ResizeObserver, rAF-batched.
5. **CSS:** `ds-move-*` rules in `DIFF_CSS` using Signal tokens; visible focus rings on
   chips; no keyframe animation.
6. Tests: rows emit `data-move` only when authored (mirror the `data-step-focus` test
   pattern, [diff-render.test.mjs:79](test/diff-render.test.mjs)); manifest JSON appears
   in panel HTML; `computeMoveGeometry` unit-tested via `clientFunction()`
   ([render-page.test.mjs:820](test/render-page.test.mjs)) with hand-rolled row boxes —
   assert ribbon endpoints, seam routing x, and the reordered-crossing case.

**Acceptance:** the §3 example story renders a `wrapped` bracket + ribbon on a real
LibSettlement-style diff; resize/mode-toggle keep geometry correct; `npm test` green;
`node --check` passes on emitted `PAGE_JS`.

### Stage 3 — Cross-file chips + step jumping

*Files: [src/render.ts](src/render.ts), [src/page-assets.ts](src/page-assets.ts), server manifest resolution in [src/server.ts](src/server.ts)*

1. Manifest gains remote-endpoint entries: target file, range, and resolved target step
   index (server scans `orderedSteps` for a step on that file whose claimed ranges
   intersect the anchor; falls back to the file panel).
2. Overlay terminates remote ribbons in seam chips (§5.4); chip click activates the
   target step (`setActive`) or opens the file panel at the range.
3. Tests: manifest carries the resolved step index; chip markup present; jump handler
   unit-tested via `clientFunction()`.

**Acceptance:** an `extracted` move into another changed file renders a chip that jumps
to that file's step.

### Stage 4 — Paired view (cross-file panes)

*Files: [src/view-model.ts](src/view-model.ts), [src/diff-render.ts](src/diff-render.ts),
[src/render.ts](src/render.ts), [src/server.ts](src/server.ts), [src/git.ts](src/git.ts),
[test/view-model.test.mjs](test/view-model.test.mjs), [test/render-page.test.mjs](test/render-page.test.mjs)*

This is the deep stage; it removes the "left and right are the same file" assumption
for exactly one panel type.

1. **Row shape:** add a paired row variant with independent `leftContent`/`rightContent`
   (today `SbsRow.content` is single, [view-model.ts:39](src/view-model.ts:39));
   `cell()`/`renderSplitRow` ([diff-render.ts:54](src/diff-render.ts:54)) learn to render
   it. Existing diff rows are untouched.
2. **Builder:** `buildPairedBlocks(oldSlice, newSlice, move)` — two independent row
   streams, aligned once at anchor tops with filler cells; left rows carry
   `data-side="left" data-file=<before.file>` with old numbering, right rows the
   after-file with new numbering (row targets already support left≠right paths,
   [render.ts:1463](src/render.ts:1463)).
3. **Materialization:** `renderStoryStepResponse` ([server.ts:1564](src/server.ts:1564))
   materializes both sides for paired steps — old side via the bounded range reader at
   the base ref, new side via the existing full-file path. Add the before-file to every
   `allowed` path-gate that currently unions `fileIndex ∪ steps[].file`
   ([server.ts:479, 601, 1493, 1517, 1724](src/server.ts:479)).
4. **Header:** `diffHead` ([render.ts:1425](src/render.ts:1425)) shows the two real file
   names (this also fixes the existing `oldFile` inconsistency for renamed files).
5. **Overlay in paired mode:** the move's ribbon connects the two anchor row groups
   across the seam — same overlay code, geometry only.
6. Tests: builder unit tests (alignment, filler, numbering); paired panel HTML shows
   both file names and both content streams; comment targets carry the correct
   per-side file; allowed-gate admits the before-file.

**Acceptance:** a step with `pairedView` shows old-LibSettlement left, new-LibAccount
right, ribbon across the seam, and commenting works on both sides.

### Stage 5 — Generation: skill, prompt, verification, repair

*Files: [skills/diffstory-storyteller/SKILL.md](skills/diffstory-storyteller/SKILL.md),
[src/agent.ts](src/agent.ts), [src/server.ts](src/server.ts), [test/tour.test.mjs](test/tour.test.mjs)*

1. Skill section per §7 (decision rule, disambiguation table, anchor semantics, caps,
   worked example, pairedView guidance) — placed after the storyboard section (~line 511).
2. `storyPrompt`: version pin → 3; inline field names/kinds/caps
   ([agent.ts:113–160](src/agent.ts:113)).
3. Content verification pass in `finishStoryGeneration` per §6 (blob range existence,
   `moved` similarity ≥ 70% token overlap, cross-file resolvability); errors flow
   through the existing repair loop (`storyRepairPrompt` needs no changes).
4. Tests for the verification pass (fixture repo with a real moved block, a false
   `moved` claim, an out-of-range anchor).

**Acceptance:** generating a story on a refactor-shaped diff produces validated moves;
a planted false `moved` claim round-trips through repair.

### Stage 6 — Demo + polish

1. Extend the `npm run demo` fixture story with two moves (one `wrapped`, one
   cross-file `extracted` with a `pairedView` step) so the full loop is visible
   out of the box.
2. Screenshot pass against the Signal direction; verify reduced-motion, keyboard access
   (chips reachable, `aria-label`s complete), and a 300-step story staying fast (only
   active panel draws).
3. Update README feature list; CHANGELOG entry.

### Stage dependencies

```
Stage 1 ──► Stage 2 ──► Stage 3 ──► Stage 4 ──► Stage 6
                └──────────► Stage 5 (needs 1; renders best after 2) ──► 6
```

Stages 2→3→4 are strictly sequential. Stage 5 can start any time after Stage 1, but
end-to-end verification of generated stories wants Stage 2 on screen.

## 9. Risks & mitigations

- **Agent over-annotates** (moves on trivial edits) → the decision rule + ≤6 cap +
  content verification; reviewers see at most a handful of high-signal ribbons.
- **Geometry drift** (ribbons detach from rows after DOM changes) → all redraw
  triggers route through one rAF-batched `renderMoveOverlay`; the pure geometry
  function is unit-tested; endpoints degrade to edge stubs rather than guessing.
- **Seam conflicts with the resize handle** → overlay is `pointer-events: none` except
  chips/glyphs, which are offset from the divider's 11px hit area; the divider keeps
  its `role="separator"` untouched.
- **Paired view scope creep** → it renders exactly one move, no diffing, alignment at
  anchor tops only. Anything smarter is explicitly out of scope.
- **`moved` similarity check false-positives** on heavy reformat-while-moving → the
  70% bar is deliberately loose, and repair guidance tells the agent to downgrade to
  `flow` with a label when the check rejects an honest claim.
