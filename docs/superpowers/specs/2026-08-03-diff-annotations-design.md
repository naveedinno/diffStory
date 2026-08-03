# Diff annotations — drawing on the panes

**Date:** 2026-08-03
**Status:** Approved design, ready for implementation
**Supersedes:** the logic-column / margin-note work in the current working tree
**Story schema:** Tour `version: 3` (already in place)

---

## 1. What this is

Today a reviewer reads two columns of code and reconstructs the shape of the change
in their head. The previous two attempts at fixing that both failed the same way:
they built a thing *next to* the diff (first a 39px ribbon gutter, then a 296px
column of prose) instead of drawing *on* it.

**Annotations are graphics on the real diff panes:**

- a **box** around a real region of code, with a short tag riding its top border
- an **arrow** that leaves a real region in the left pane and lands on a real
  region in the right pane
- a **callout** — a small bordered band — only where the fact is not on screen at all

Everything else stays an ordinary diff.

### The governing rule

> **Draw only what neither pane shows.** If a reviewer can learn it by reading the
> two columns of code, draw nothing.

This is not a style note; it is the acceptance test for every annotation. A picture
of an `if` that is already visible in green is wasted ink and actively costs the
reader attention. Most steps in most stories will carry **no annotation at all**,
and that is the design working.

Corollaries, which the implementation enforces rather than trusting to taste:

- A step with no annotations renders a **plain two-pane diff at full width**. No
  reserved column, no empty gutter, no placeholder.
- Boxes are drawn only when a region genuinely relocated or its extent is not
  obvious from the diff colouring.
- A callout exists only for a fact with no line of code to point at: an unwritten
  `else`, an off-screen destination, a broken ordering dependency.

### Non-goals

- No abstract node/flowchart column. That was tried and rejected.
- No prose panel. The `label`/`outcomes` margin-note rendering is deleted (§3).
- No annotation in Unified or Full-file mode (§7.4).
- No general graph layout. Every annotation shape is one of five fixed forms (§6).

---

## 2. What already exists and stays

Keep these. They are working and tested.

| Thing | Where | Why it stays |
| --- | --- | --- |
| `LogicMove` vocabulary + anchors | [types.ts:127-170](src/types.ts) | The eight kinds and `{file, range}` endpoints are the data the annotations draw from. |
| Row anchor tokens `data-move="<id>:before"` | [diff-render.ts:113,121](src/diff-render.ts) | This is how the client finds the rows for a region. Do not replace it. |
| Server-side range→row resolution | next to `rowVoiceFocusIndex` [render.ts:1607](src/render.ts) | Line numbers stay server-side; the client only ever sees tokens. |
| Automatic cross-file pairing | `pairedMoveFor` [view-model.ts:468](src/view-model.ts) | A cross-file move already puts old-file left / new-file right with no flag. |
| Paired row builder | `buildPairedBlocks` [view-model.ts:657](src/view-model.ts) | Independent left/right row content. |
| Validation + repair loop | [tour.ts](src/tour.ts), `finishStoryGeneration` [server.ts](src/server.ts) | Error strings already flow back to the agent. |

---

## 3. What to delete

All of this is margin-note machinery that the annotation model replaces. Remove it
rather than leaving it dormant.

**`src/render.ts`**
- `MOVE_EYEBROW` (:1244), `moveOutcomes` (:1255), `logicLane` (:1277)
- the `ds-diffwrap` / `ds-has-logic` wrapper in `diffInner` (:1489) and the
  `channel` class in `diffHead` (:1517)

**`src/diff-assets.ts`**
- CSS: `.ds-logiclane`, `.ds-logichead`, `.ds-lnote*`, and the `ds-has-logic`
  cell-margin rules (:65 and the `@media (max-width:1080px)` block at :219)
- JS: `layoutLogicNotes` (:243)

**`src/page-assets.ts`**
- the `[data-move-note]` click branch (:4089)

**`src/types.ts` / `src/tour.ts` / `src/view-model.ts`**
- `MoveOutcome` and `LogicMove.outcomes`, `validateMoveOutcomes`, and the
  `outcomes` mapping in `buildLogicMoves` — replaced by `hidden` (§4)

**Tests** — replace, don't patch: the logic-lane tests in
[test/render-page.test.mjs](test/render-page.test.mjs) and the `outcomes`
assertions in [test/tour.test.mjs](test/tour.test.mjs).

`LogicMove.label` **stays** but changes role: it is the box tag, so it must become
short (§4).

---

## 4. Schema

Two changes to `LogicMove` in [types.ts](src/types.ts).

```ts
/** One agent-authored semantic relationship between old and new code. */
export interface LogicMove {
  id: string;
  kind: LogicMoveKind;
  before: MoveAnchor;
  after: MoveAnchor;

  /**
   * The tag that rides the annotation box border. Two or three words, upper-cased
   * at render time: "unconditional", "now gated", "moved out". Plain text, <= 24
   * characters — it must fit a border tab without wrapping. Optional; without it
   * the box is drawn untagged.
   */
  label?: string;

  /**
   * The one fact about this move that neither pane shows. Its presence is the
   * ONLY trigger for a callout, and the strongest signal that the move is worth
   * annotating at all. Omit it whenever the diff already tells the story.
   */
  hidden?: MoveHidden;
}

/** A fact with no line of code to point at. */
export interface MoveHidden {
  /**
   * Which kind of invisible thing this is. Chooses the callout's colour and
   * which anchor it hangs from:
   *   'path'        — a branch with no code (an unwritten else, a silent skip)
   *   'destination' — where code went, when that file is not one of the panes
   *   'consequence' — what the change broke or newly permits
   */
  as: 'path' | 'destination' | 'consequence';
  /** Headline, upper-cased at render: "no else branch exists". Plain text, <= 48 chars. */
  tag: string;
  /** One clause the reviewer acts on. Inline-tier HTML, <= 120 chars. */
  what: string;
}
```

`Tour.version` stays `3`. Validation (in `validateMoves`, [tour.ts](src/tour.ts)):

- `label` plain text, <= 24 chars (tightened from 110 — it is a tab now, not a sentence)
- `hidden.as` in the three-value enum
- `hidden.tag` plain text, non-empty, <= 48 chars
- `hidden.what` inline-tier narrative, non-empty, <= 120 chars
- `hidden.as === 'destination'` requires the move to be cross-file
  (`before.file !== after.file`) — a destination callout for a same-file move is
  meaningless
- unchanged: <= 6 moves/step, unique ids, one anchor in `step.file`, same-file
  `after.range` intersects the viewport

Update the narrative tier tables in [docs/story-schema.md](docs/story-schema.md)
and [SKILL.md](skills/diffstory-storyteller/SKILL.md): `moves[].hidden.what` joins
the inline tier; `moves[].label` and `moves[].hidden.tag` are plain text.

---

## 5. Architecture

Three layers, with a hard boundary between them. **The split is what makes this
testable** — the previous implementation mixed measurement and drawing and could
only be verified by eye.

```
┌─ SERVER ────────────────────────────────────────────────────────────┐
│ resolve authored line ranges → row tokens   data-move="id:before"   │
│ emit annotation spec (JSON, no line numbers)                        │
│ render callouts as real DOM bands inside the pane flow              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─ MEASURE (client, impure, tiny) ────────────────────────────────────┐
│ read row rects → regions; read gutter edges → geom                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─ COMPUTE (client, PURE, unit-tested) ───────────────────────────────┐
│ computeAnnotations(spec, regions, geom) → {boxes, arrows, tags}     │
│ no DOM, no globals, deterministic                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─ PAINT (client, impure, dumb) ──────────────────────────────────────┐
│ build one <svg> from the returned shapes. No decisions here.        │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.1 Server: the annotation spec

One JSON block per step panel, inside `[data-split-inner]`, next to the rows:

```html
<script type="application/json" data-annotations>
{"moves":[
  {"id":"fee-gate","kind":"wrapped","tag":"now gated",
   "before":{"local":true},"after":{"local":true},"arrow":true}
]}
</script>
```

Rules for the spec:
- **Never contains line numbers.** Regions are found by token, exactly as the
  current overlay does. This is an existing invariant with a test — keep it.
- `local:false` endpoints carry `{file, range, targetStep}` for the jump control
  (the same shape the current `ds-lnote-dest` uses).
- `arrow` is true only when both endpoints are local and in different panes.

### 5.2 Client: the pure function

```js
computeAnnotations(spec, regions, geom) -> { boxes, arrows, tags }
```

**Inputs**

```js
spec    = { moves: [{ id, kind, tag, arrow, before:{local}, after:{local} }] }

// A region is a LIST OF RUNS, not one box. Rows for one region can be split by a
// hunk gap; a single bounding box would swallow the gap and lie.
regions = { "fee-gate:after": [ {top, bottom, left, right}, ... ], ... }

geom    = { gutterLeft, gutterRight, width, height }
```

**Output** — plain data, no DOM nodes:

```js
{
  boxes:  [{ id, side:'left'|'right', kind, x, y, w, h, dashed:boolean }],
  arrows: [{ id, kind, d:'M…', head:{x,y,angle}, dashed:boolean }],
  tags:   [{ id, text, x, y, w, side }],
}
```

**Rules the function must implement**

1. **One box per run.** A region with two runs gets two boxes, not one tall box.
2. **Tag placement.** The tag rides the top border of the region's *first* run,
   inset 14px from its left edge. If the run is narrower than the tag, drop the
   tag (return no entry) rather than overflow.
3. **Arrows never leave the gutter.** Every arrow starts at `geom.gutterLeft` and
   ends at `geom.gutterRight`. Anchor y = the vertical centre of the region's
   first run. A cubic with control points at ±40% of the gutter width reads as a
   deliberate curve without wandering.
4. **Missing region.** If a region has no runs (rows outside the viewport, or not
   yet in the DOM) it produces no box, and any arrow that needed it terminates at
   the gutter edge with a chevron instead of a head. **Never guess a position.**
5. **Crossing arrows.** `reordered` produces two arrows whose endpoints are swapped
   (before-run-1 → after-run-2 and before-run-2 → after-run-1). The crossing is the
   message; do not deconflict it.
6. **Determinism.** Same inputs → identical output. No `Date.now()`, no random,
   no reads of anything but the arguments.

Round all coordinates to 1 decimal (`Math.round(n*10)/10`) so test assertions are
stable and paths stay compact.

### 5.3 Client: paint

Build one `<svg class="ds-annot">` appended to `.ds-diffbody`, `aria-hidden="true"`,
`pointer-events:none`. Iterate the returned shapes and emit `<rect>`/`<path>`/
`<text>`. **No conditionals in this layer** beyond "does this shape exist" — every
decision belongs in `computeAnnotations`.

### 5.4 Callouts are NOT overlay

This is the rule the mock got wrong and it must not be re-learned. A callout is a
**server-rendered DOM band in the pane flow**, emitted immediately after the last
row of its anchor region:

```html
<div class="ds-annot-callout ds-annot-callout-path" data-annot-callout="fee-gate">
  <span class="ds-annot-tag">no else branch exists</span>
  <span class="ds-annot-what">rebate trades now settle free</span>
</div>
```

Because it is a real element it pushes code down and **can never cover a line**.
It also means callouts survive with scripting disabled, and the annotation degrades
to "callouts only" if the overlay fails for any reason.

The SVG may draw a short dashed leader from the anchor region into the callout;
the callout's own rect is DOM, never SVG.

A cross-file destination callout must expose the relationship direction before
the authored explanation. When the off-screen endpoint is the old/source side,
render `CROSS-FILE SOURCE  [file:range] → THIS CODE`; when it is the new side,
render `CROSS-FILE DESTINATION  THIS CODE → [file:range]`. The file endpoint is
the jump button. Do not put the relationship arrow inside that button: doing so
makes an off-screen source look like the destination.

The callout is a fallback, not the default cross-file presentation. The step's
primary cross-file relationship must use the two panes — source file on the
left, destination file on the right. If two primary relationships compete for
the panes, split them into separate story steps. Use the callout only for a
secondary third-file fact that would otherwise displace the step's main
comparison.

---

## 6. The five shapes

Every annotation is one of these. No others.

| Shape | Drawn when | Form |
| --- | --- | --- |
| **Region box** | a region relocated, or its extent is not obvious | 2px rounded rect around the run; dashed on the before side, solid on the after side |
| **Tag** | the move has a `label` | uppercase mono on a filled tab riding the box's top border |
| **Crossing arrow** | both endpoints local, in opposite panes | cubic through the gutter with an arrowhead |
| **Edge chevron** | one endpoint is not on screen | arrow stops at the gutter edge, chevron instead of a head |
| **Callout** | the move has `hidden` | DOM band after the anchor region, with a dashed leader |

**Colour** carries state, not kind:

| Meaning | Token |
| --- | --- |
| before side / removed | `--diff-del-text` |
| after side / structural | `--accent-blue` |
| a path or destination you cannot see | `--md-warn` (amber) |
| a consequence that breaks something | `--diff-del-text` |

Exception: a paired `flow` source is dependency context, not removed code. Label
the panes `SOURCE` and `DESTINATION`, keep the source pane neutral, and use the
structural blue for both endpoint boxes. A real `moved` or `extracted`
relationship keeps `BEFORE`/`AFTER` and deletion/addition colouring.

Kind is carried by shape and tag text, never by a second hue. Do **not** introduce
green for annotations — the diff already owns green for "added line", and a green
annotation reads as an insertion.

---

## 7. Lifecycle, performance, edges

### 7.1 Redraw triggers

The overlay is absolutely positioned inside `.ds-diffbody`, which scrolls with the
rows, so **scrolling needs no redraw**. Everything else does:

| Trigger | Hook |
| --- | --- |
| step activation | `activateStep` [page-assets.ts:1740](src/page-assets.ts) (already calls `syncActiveMoveOverlay`) |
| split divider drag | [page-assets.ts:4322](src/page-assets.ts) |
| hunk gap expand | `expandGap` in [diff-assets.ts](src/diff-assets.ts) |
| mode toggle | `setMode` — draw in split only, tear down otherwise |
| window resize | [page-assets.ts:4398](src/page-assets.ts) |
| row wrap / font load | `ResizeObserver` on `.ds-diffbody` |

All of them funnel through one rAF-batched `scheduleAnnotations(panel)`. Never
draw synchronously from an event handler.

### 7.2 Performance

- Only the **active** step panel ever has an overlay. Tear down on deactivate.
- Cost is O(annotations in the active step), capped at 6 moves/step by validation.
- No per-frame work, no listeners on inactive panels. This is the existing
  contract for 300-step stories and it must not regress.

### 7.3 Correctness edges (each needs a test)

1. **Region split by a hunk gap** → two boxes, not one box swallowing the gap.
2. **Region partly outside the viewport** → box covers only the rendered runs; no
   extrapolation.
3. **Region entirely absent** → no box; dependent arrow degrades to a chevron.
4. **Wrapped code lines** → boxes follow measured heights, so a wrapped row makes
   its box taller. Verified by measuring, not by assuming row height.
5. **Split divider at an extreme** (one pane collapsed) → gutter still has width;
   arrows still resolve. If the gutter is under 24px, skip arrows and keep boxes.
6. **Paired cross-file view** → left and right are different files; annotations
   work unchanged because they are token-based, not file-based.
7. **Two annotations on adjacent rows** → boxes may touch but must not be merged.

### 7.4 Modes and responsiveness

- **Split** — full annotation.
- **Unified / Full file** — no overlay (there is no gutter and no two panes).
  Callouts, being DOM, still render inline. This is the honest degradation.
- **Narrow viewports** — no column to collapse any more, so nothing to do; boxes
  and callouts scale down naturally. Below ~640px, skip arrows (the gutter is too
  narrow to route them) and keep boxes and callouts.

### 7.5 Accessibility

- The SVG is decorative: `aria-hidden="true"`, `pointer-events:none`.
- **Callouts are the accessible rendering.** They are real text in the pane flow,
  in reading order, after the code they describe.
- The destination jump is a real `<button>` inside its callout, keyboard
  reachable, with an `aria-label` naming file and line range. Reuse the existing
  handler at [page-assets.ts:4088](src/page-assets.ts).
- No motion. The overlay redraws instantly; it never animates. Nothing to add to
  the `prefers-reduced-motion` block.

---

## 8. Tests

Follow the existing patterns — do not invent new harnesses.

**Pure geometry** — the bulk of the value. Extract with `clientFunction(...)`
([render-page.test.mjs:820](test/render-page.test.mjs)) and run in `vm` against
hand-authored region rectangles. No browser.

- one run → one box with the expected rect
- two runs (hunk gap) → two boxes, gap preserved
- tag omitted when the run is narrower than the tag
- arrow starts exactly at `gutterLeft`, ends at `gutterRight`, never outside
- missing region → no box, arrow becomes a chevron
- `reordered` → two arrows with swapped endpoints
- determinism: same input twice → identical output
- gutter < 24px → no arrows, boxes intact

**Server render** — `renderPage` + regex, as today.

- rows still emit `data-move` tokens
- `[data-annotations]` JSON present, and **contains no line numbers** for local
  endpoints (this assertion already exists; keep it)
- callout band renders after its anchor rows, with tag and `what`
- a step with no `hidden` and no `label` renders **no** `[data-annotations]`,
  **no** callout, and no wrapper element
- cross-file destination callout carries `data-move-target-step` / `-file` / `-line`

**Validation** — [tour.test.mjs](test/tour.test.mjs): each new rule's exact error
string; `hidden.as: 'destination'` rejected on a same-file move.

**Regression** — a story with zero moves produces byte-identical panel HTML to
before this change (no stray wrappers).

---

## 9. Authoring: skill and prompt

### SKILL.md (§5.4, [skills/diffstory-storyteller/SKILL.md](skills/diffstory-storyteller/SKILL.md))

Replace the outcomes guidance with the restraint rule, stated as a filter the
agent applies *before* writing a move:

> Annotations draw on the code itself. Before adding one, ask: **could the reviewer
> learn this by reading the two columns?** If yes, write no move. A picture of an
> `if` that is already visible in green costs the reader attention and teaches
> them nothing.
>
> Specifically, do NOT annotate:
> - a guard whose condition and body are both visible in the diff
> - a call that replaced inline code when both sides are on screen
> - a rename, a reformat, or a comment change
> - a relocation whose destination is already the right-hand pane
>
> DO annotate:
> - a branch with **no code to read** — an unwritten `else`, a silent skip
> - a destination in a file that is **not one of the two panes**
> - an ordering or dependency consequence that **no line states**
> - a region whose true extent is not obvious from the diff colouring

Plus: `label` is now a two-or-three-word tag, not a sentence; `hidden` is the only
thing that produces a callout; a worked example showing one move **with** `hidden`
and one deliberately **without**.

### storyPrompt ([agent.ts:120](src/agent.ts))

Machine-checked names and caps only — the prompt has a hard length budget with a
test on it ([agent.test.mjs](test/agent.test.mjs)), and craft belongs in the skill:

```
- Optional moves (max 6): "id", "kind", "before"/"after" {"file","range"},
  "label" (tag, max 24), "hidden" {"as":path|destination|consequence,
  "tag" max 48, "what" max 120}; kinds are moved/extracted/inlined/wrapped/
  unwrapped/condition-changed/reordered/flow.
```

Add `move "hidden.what"` to the inline-tier line at [agent.ts:129](src/agent.ts).

### Server verification ([server.ts](src/server.ts))

Keep the existing anchor-existence and `moved` similarity checks. Add one:
`hidden.as === 'destination'` must name a file that resolves in the repo. Errors
flow through the existing repair loop unchanged.

---

## 10. Stages

Every stage ends green: `npm test`, `node --check` on emitted `PAGE_JS`, `dist/`
rebuilt and committed.

### Stage 1 — Schema swap
`types.ts`, `tour.ts`, `view-model.ts`, `docs/story-schema.md`, `tour.test.mjs`.
Delete `MoveOutcome`/`outcomes`/`validateMoveOutcomes`; add `MoveHidden`/`hidden`;
tighten `label`. **Accepts:** a v3 story with `hidden` validates; every new rule
has its error-string test; `outcomes` is gone from the codebase.

### Stage 2 — Delete the logic column
Everything in §3. **Accepts:** a story with moves renders a plain two-pane diff,
byte-identical to a story without moves apart from the row `data-move` tokens.
This stage removes a feature and adds none — land it separately so the diff is
readable.

### Stage 3 — Callouts (DOM, no overlay)
Server-render callout bands after their anchor rows; CSS; the destination jump
button. **Accepts:** callouts render in reading order, never overlap code, work in
unified mode, and are keyboard reachable. **Ship-able on its own** — this alone is
a real improvement over the current state.

### Stage 4 — Geometry
`computeAnnotations` as a pure function in `DIFF_JS`, plus its full unit-test
suite (§8). No painting yet. **Accepts:** every geometry test passes, including
the hunk-gap split and the missing-region degradation.

### Stage 5 — Paint and lifecycle
The SVG builder, `scheduleAnnotations`, and every redraw trigger in §7.1.
**Accepts:** boxes and arrows land on the right rows and stay there through
divider drag, gap expand, window resize, mode toggle, and step switch. Verify by
screenshot in the browser preview, and re-verify after restarting the preview
server (it loads `dist/` at startup — a stale server was the cause of a false
"nothing changed" earlier in this work).

### Stage 6 — Authoring + fixtures
SKILL.md, `storyPrompt`, server verification, and the demo story. Rewrite
`examples/demo.mjs` so **most moves carry no `hidden`** and one does — the demo
must model the restraint, not showcase every feature.

### Dependencies

```
1 → 2 → 3 → 4 → 5 → 6
```
Strictly sequential. Stage 3 is the first user-visible improvement; stages 4-5 are
where the care goes.

---

## 11. Repo ground rules

Non-negotiable, from `CLAUDE.md` and hard-won in this codebase:

- **Rebuild and commit `dist/` with every `src/` change.** GitHub installs have no
  build step.
- **`node --check` the emitted `PAGE_JS` after editing it.** Client code lives in
  template literals that `tsc` cannot parse:
  ```bash
  node -e "const {PAGE_JS}=require('./dist/page-assets.js');require('fs').writeFileSync('/tmp/pj.js','(function(){'+PAGE_JS+'})()')" && node --check /tmp/pj.js
  ```
- **Never name a banned API or UI string in a `PAGE_JS`/`DIFF_JS` comment.**
  Inlined comments are page content and trip whole-document `doesNotMatch`
  assertions.
- **Restart the preview server after rebuilding.** It loads `dist/` at startup.
- **Do not regress 300-step performance.** No work proportional to story size on
  inactive panels.
- Tests import from `dist/`, so build before running them.

---

## 12. Risks

- **Drift.** A box one row off its code is worse than no box. Mitigated by pure,
  unit-tested geometry over measured rects, and by the "never extrapolate a
  missing region" rule.
- **Over-annotation.** The agent will err generous. Mitigated by the explicit
  do-not list in the skill, the 6/step cap, and `hidden` being the only callout
  trigger. If it still over-fires, the next lever is a server-side check that
  rejects a `wrapped` annotation whose condition and body are both inside the
  step viewport.
- **Gutter starvation.** A dragged divider can leave no room for arrows. Handled
  explicitly: under 24px, boxes and callouts only.
- **Scope creep back into a panel.** If someone finds themselves adding a second
  column, stop — that path was tried twice and rejected.
