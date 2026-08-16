# 013 — Build the native presentation story stage

- **Status**: DONE
- **Commit**: 1e23de5
- **Severity**: MEDIUM
- **Category**: Story presentation / missed opportunity
- **Estimated scope**: 7 authored source files, 4 focused test files, UI-atlas fixture/evidence, and generated `dist/` output

## Outcome

Turn the existing Story view into a small, app-owned presentation system without
turning the review app into an embedded slide deck.

The result should feel like a sequence of deliberately composed scenes:

- an editorial opening that states the goal and reading path;
- compact concept-document scenes;
- split narrative/diagram scenes when a Mermaid model exists;
- live code-focus scenes where the existing diff is the visual center;
- live logic-move and paired-code scenes when the story already carries those
  semantic facts.

The code viewer remains the real viewer. Selection, inline comments, split /
unified / full-file modes, hunk expansion, logic-move overlays, narration,
keyboard navigation, lazy loading, and prefetch must keep working inside the
scene. This plan changes composition and choreography, not review semantics.

## Decision

Use presentation libraries as references, not as the in-app runtime.

| Direction | Decision | Reason |
| --- | --- | --- |
| Embed Reveal.js around the Story view | Reject for the review runtime | Reveal owns slide navigation and captures keyboard events by default. The review engine already owns 20 keyboard bindings, active-step state, narration, lazy loading, and directional View Transitions. A second navigation state would be a permanent synchronization seam. |
| Render a Slidev/Marp deck in an iframe | Reject for the review runtime | These are excellent authored/export pipelines, but an iframe would split focus, theme, comments, narration, and live diff state from the host app. |
| Let the agent emit arbitrary HTML/CSS/JS scenes | Reject | It weakens the existing sanitizer and makes layout, accessibility, motion, and backwards compatibility impossible for the app to guarantee. |
| Derive typed scene layouts from the existing story facts | **Select** | The agent continues to describe evidence; the app owns layout, interaction, responsive behavior, and motion. Existing stories gain the presentation treatment without regeneration. |

Reveal remains a valid later **standalone export adapter**. Its official React
wrapper and API can drive a separate read-only deck, but that is a different
product surface and needs a separate plan. References:

- <https://revealjs.com/react/>
- <https://revealjs.com/initialization/>
- <https://sli.dev/guide/exporting.html>

## Problem

The app already has most of a presentation engine, but it has no explicit scene
model. The filmstrip supplies ordered navigation, the review engine swaps one
step at a time, and View Transitions animate the active workspace. Layout still
branches only on broad content kind (`concept` versus code), so every code step
has the same composition and the renderer cannot deliberately treat a paired
cross-file explanation differently from a local code stop.

The current lazy contract is load-bearing:

```tsx
// client/surfaces/review/StoryView.tsx — current
function LazyStepPanel({ step, index }: { step: ReviewStepView; index: number }) {
  return (
    <section
      className={`ds-step ds-step-lazy${step.kind === "concept" ? " ds-concept-step" : " is-code-step"}`}
      data-step-panel={index + 1}
      data-step-id={step.id}
      data-step-lazy="1"
      hidden
    >
```

Only a tiny initial projection is shipped. The real panel arrives from
`GET /api/review/step-panel?index=N`. Any scene decision needed before loading a
panel therefore has to fit in `ReviewStepView`; it cannot pull diff blocks,
moves, or focus groups into the initial payload.

The loaded renderer currently has two presentation branches:

```ts
// src/render.ts — current
return step.kind === "concept"
  ? conceptStepPanel(step, i, total, stepIndexById)
  : codeStepPanel(step, i, total, comments);
```

The navigation runtime is deliberately imperative:

```tsx
// client/surfaces/review/ReviewApp.tsx — current contract
// This component renders the document ONCE and then gets out of the way.
// Every runtime change on this surface is written by the engine in
// `./engine/review-engine.js`.
```

That means `motion/react` components must not be introduced inside lazy panels.
React would believe it owns nodes that `loadStoryStep()` replaces with
server-rendered HTML. Scene choreography belongs in the existing engine, using
the existing CSS tokens and browser animation primitives.

Finally, the authored format is intentionally constrained:

```ts
// src/types.ts — current
export interface ConceptDiagram {
  type: 'mermaid';
  source: string;
  caption: string;
}

export interface ConceptTourStep extends TourStepBase {
  kind: 'concept';
  body: string;
  preparesFor: string[];
  diagram?: ConceptDiagram;
}
```

That is a strength. The first version of the presentation layer must derive its
scenes from these semantics rather than add a layout DSL to `story.json`.

## Target architecture

### 1. One pure scene projector

Add `src/story-scenes.ts` as the single decision point between story semantics
and presentation layout. Its public surface should stay this small:

```ts
export type StoryStepSceneLayout =
  | "concept-document"
  | "concept-diagram"
  | "code-focus"
  | "logic-move"
  | "paired-code";

export type StoryStepSceneFacts =
  | { kind: "concept"; hasDiagram: boolean }
  | { kind: "code"; hasMoves: boolean; paired: boolean };

export function projectStoryStepScene(
  facts: StoryStepSceneFacts,
): StoryStepSceneLayout;
```

The function does not know CSS classes, animation timings, DOM structure, or
story schema versions. It answers only which layout best presents already
validated facts.

Use this exact precedence:

| Existing semantic facts | Scene layout |
| --- | --- |
| Overview panel | `opening` (static host layout, not a persisted step) |
| Concept with `diagram` | `concept-diagram` |
| Concept without `diagram` | `concept-document` |
| Code with a resolved `pairedView` | `paired-code` |
| Remaining code with one or more `moves` | `logic-move` |
| Remaining code | `code-focus` |

`paired-code` wins over `logic-move` because a cross-file pair needs the most
space and already contains the move explanation. Do not duplicate the same move
as a second decorative diagram.

### 2. Carry one short derived field through both render paths

Add `sceneLayout: StoryStepSceneLayout` to `StepViewBase` and
`ReviewStepView`. Set it when `buildCodeStep()` / `buildConceptStep()` have the
final facts, then preserve it in `stepView()`.

Both representations of a panel must expose the same attribute:

```html
<section data-scene-layout="paired-code" ...>
```

- `LazyStepPanel` needs it so the unloaded stage already has the correct
  composition and evidence hook.
- `codeStepPanel()` and `conceptStepPanel()` need it so replacing the stub does
  not silently change the scene identity.
- The storyful `IntroPanel` gets `data-scene-layout="opening"` directly.
- The storyless generation/setup panel is not a story scene and stays unchanged.

This adds one short string per initial step. It must not add blocks, move
endpoints, diagram source, file bodies, or any other detail to the initial
payload.

The data flow is:

`story.json semantics → view model → scene projector → StepView.sceneLayout → initial stub + lazy endpoint → app-owned CSS/engine`

### 3. Five step templates plus the opening, one interaction model

Implement the visual treatment in
`client/surfaces/review/review.css`. Prefer attribute selectors rooted at
`[data-scene-layout]` so the presentation vocabulary is visible in the DOM and
testable without coupling tests to incidental utility classes.

#### `opening`

- Keep the current story mark, title, goal/summary, freshness state, start
  action, scope, review notes, and All files escape.
- Compose it like an editorial title card: a readable measure, stronger title
  scale, deliberate vertical rhythm, and the existing filmstrip as the visual
  narrative spine.
- Do not turn optional review notes into a dashboard of equal-weight cards. The
  goal and Start action remain the first reading path.

#### `concept-document`

- Keep one centered document column with a comfortable reading measure.
- Use the eyebrow, title, body, and “Next in code” action as a clear vertical
  sequence.
- Lists, tables, definitions, quotes, and code blocks must remain readable and
  scroll naturally; do not fake a fixed-height slide that clips authored prose.

#### `concept-diagram`

- At desktop width, use an approximately 40/60 narrative-to-diagram grid. The
  title and concise explanatory body sit left; the Mermaid figure and caption
  sit right.
- Stack into one column below the existing compact-stage breakpoint. Diagram
  first versus prose first should follow DOM reading order; do not reorder with
  CSS in a way that disagrees with screen readers.
- Preserve `role="img"`, the caption, hidden Mermaid source, and visible source
  fallback on render failure.

#### `code-focus`

- The existing live `.ds-diff` remains the largest object in the scene.
- Keep the step title/meta above it and the adopted beat dock in the stable
  floating island below it.
- Do not shrink the diff into a decorative screenshot or place prose over
  selectable rows.

#### `logic-move` and `paired-code`

- Reuse the existing move chips, annotations, cross-file paired panes, and
  navigation. The scene layer changes spacing and emphasis only.
- `logic-move` may reserve slightly more header/annotation breathing room, but
  code rows remain stable when beats change.
- `paired-code` uses the widest available stage at desktop widths and collapses
  according to the current responsive diff behavior. Never force two unreadable
  columns onto a phone.

Across all six stage layouts:

- the filmstrip/dock remains in one stable location;
- the All files view and sidebar are untouched;
- no ancestor of the active live diff may retain a CSS transform after an
  entrance, because transforms interfere with sticky geometry, selection
  overlays, and anchored comments;
- light and dark themes use the existing semantic tokens rather than a parallel
  “slide theme”.

### 4. Motion: scene changes, not moving code

Keep `runWorkspaceTransition("step", direction, update)` as the sole owner of
whole-scene navigation. It already supplies an interruptible directional View
Transition, a CSS fallback, and an instant reduced-motion path using:

- `--motion-duration-spatial: 340ms`
- `--motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`

Add one restrained first-visit entrance for concept scenes only. The opening
already enters with the review layout, and code scenes already have the
directional workspace transition. Stacking another animation on either would
spend motion without adding meaning.

For a concept's first real activation, use the existing imperative engine plus
`Element.animate()`; do not mount `motion/react` inside engine-owned panels.
Targets are the eyebrow/title group, body, diagram when present, and Next action.
Each target uses only opacity and `translateY(6px)` to `translateY(0)`,
`--motion-duration-ui` (200ms), and `--motion-ease-out`, with a 40ms
non-blocking stagger. Never stagger individual paragraphs, list items, diagram
nodes, diff rows, or tokens.

Use **one motion owner per navigation**:

- first activation of a fully loaded concept scene: synchronously show the
  panel and start the internal entrance before the next paint, instead of
  starting a whole-scene View Transition;
- a concept that is still lazy: transition to its loading stub normally, then
  run the internal entrance when the real panel replaces that active stub;
- code scenes and every revisit: use the existing whole-scene View Transition;
- Mermaid SVG insertion: a separate 150–200ms opacity/6px settle is allowed on
  the newly inserted `svg`, but never animate individual Mermaid paths.

Do not wait for a 340ms View Transition to finish and then start a 200ms
entrance. That serial sequence flashes already-visible content back to opacity
zero and makes one step change feel like two.

Implementation requirements for `review-engine.js`:

1. Track `sceneEntered[index]` separately from `visited[index]`. A lazy stub is
   marked visited before its real HTML arrives, so `visited` cannot be the
   entrance gate.
2. Before choosing the motion path, verify the target is a real concept panel,
   `data-step-lazy` is absent, and this scene has not been entered. Only that
   case bypasses the whole-scene transition.
3. After the visibility update, re-check the navigation token,
   `active === index`, and that the panel is visible; then start the concept
   entrance synchronously so its first keyframe is applied before paint. Do not
   serialize it after a View Transition.
4. Track the returned `Animation` objects. Cancel them when rapid navigation
   starts and clear their inline effects when they finish.
5. Mark a real concept scene entered on its first successful activation. Under
   reduced motion, mark it without animating; a failed lazy request must not
   consume the one-shot reveal.
6. Under `prefers-reduced-motion: reduce`, do not translate or stagger. Retain
   the existing instant scene swap and ordinary color/opacity feedback at no
   more than 200ms.

This choreography is intentionally quieter than a conference deck. It explains
hierarchy on the first concept encounter without making keyboard review or
narration wait for decoration.

## Implementation slices

Each slice should be independently reviewable and must preserve a passing test
suite before the next begins.

### Slice A — Scene contract with no visual change

1. Add `src/story-scenes.ts` with the union, input facts, precedence table in
   comments, and `projectStoryStepScene()`.
2. Add `sceneLayout` to `StepViewBase` in `src/view-model.ts`.
3. In `buildConceptStep()`, project from `!!step.diagram`.
4. In `buildCodeStep()`, project only after moves and the resolved paired view
   are known; pass `paired: !!pairedView` and `hasMoves: moves.length > 0`.
5. Add the derived field to `ReviewStepView` in `src/payloads.ts` and to
   `stepView()` in `src/render.ts`.
6. Stamp `data-scene-layout` on the lazy stub, both loaded panel renderers, and
   the storyful overview.
7. Add `test/story-scenes.test.mjs` for all five outcomes and the paired-over-
   move precedence. Extend `test/view-model.test.mjs` and
   `test/review-page.test.mjs` to prove the attribute survives both initial and
   lazy render paths.

Done when every current story renders exactly as before except for the new data
attribute, and the initial payload remains metadata-only.

### Slice B — Static scene composition

1. Add the five attribute-rooted layout treatments to `review.css`.
2. Make the concept diagram layout a true responsive grid at desktop and one
   DOM-order column at tablet/mobile widths.
3. Give `paired-code` the widest safe stage without changing the diff's own mode
   logic.
4. Keep the dock height and active diff viewport stable when moving between
   adjacent code scene types.
5. Add overflow assertions and scene selectors to the UI-atlas capture script.

Done when the scenes are visually distinct in static screenshots while every
control works with animations disabled.

### Slice C — First-visit narrative choreography

1. Add the scene-entrance bookkeeping and cancellation helper beside
   `runWorkspaceTransition()` in `review-engine.js`.
2. Let `activateStep()` choose exactly one path: first-visit concept entrance or
   the existing whole-scene transition.
3. Limit internal entrance targets to the concept selectors listed above; keep
   the opening on its existing page entrance and code on View Transitions.
4. Parse the existing CSS duration/easing custom properties rather than create a
   second timing source in JavaScript.
5. Extend `test/motion-regressions.test.mjs` to pin cancellation, lazy-panel
   gating, reduced-motion gating, transform/opacity-only animation, and the rule
   that `.ds-row`, `.ds-urow`, and diff containers are never entrance targets.

Done when the first view feels composed, revisits remain instant apart from the
existing scene transition, and rapid arrow-key navigation never queues reveals.

### Slice D — Visual evidence and authoring gate

Extend `scripts/capture-ui-atlas.mjs` and its deterministic fixture so evidence
covers:

- opening — dark desktop (existing frame, updated composition);
- code-focus — dark desktop and mobile (existing frames);
- concept-document — desktop;
- concept-diagram — light desktop plus tablet/mobile;
- logic-move — desktop;
- paired-code — desktop;
- at least one counter-theme code or concept scene.

Run a fresh visual review on those images for hierarchy, semantic value,
responsive behavior, and reduced motion. Only after that review may the
storyteller prompt/skill be adjusted. The first implementation should not tell
the agent to emit more diagrams merely to fill a layout. Existing guidance that
permits a diagram only when it clarifies three or more relationships remains the
quality bar.

If the renderer proves that richer content is genuinely needed, write a
separate schema plan for a typed `visual` union (for example timeline,
comparison, metric, or process). Do not extend this plan into Tour v4 and do not
add arbitrary HTML/CSS/JS fields.

## Repo conventions to preserve

- React renders the review document once; `review-engine.js` owns all runtime
  mutation after commit.
- Step details remain server-rendered and lazy through
  `GET /api/review/step-panel?index=N`.
- The hidden speech cache remains in every lazy stub so full-story narration
  does not fetch all panels.
- `hidden`, not unmounting, preserves step state.
- The generated story remains Tour v1/v2/v3 compatible. `sceneLayout` is a view
  projection and is never written to `.diffstory/story.json`.
- Narrative HTML continues through the current sanitizer. No `script`, `style`,
  `iframe`, `object`, `embed`, form controls, event attributes, or external
  executable content.
- Motion values come from `src/theme.ts`; do not add a local easing vocabulary.
- CSS transitions list exact properties. Do not introduce `transition: all`.
- `dist/` is tracked output; rebuild it with the authored source changes.
- `.diffstory/` is local runtime data and must not be committed.

## Boundaries

- Do NOT add Reveal.js, Slidev, Marp, Swiper, GSAP, or another presentation /
  animation dependency in this plan.
- Do NOT wrap the Story view in an iframe or a second router.
- Do NOT let a deck framework capture the app's arrow, Home/End, Escape, or
  narration keyboard paths.
- Do NOT add layout or animation instructions to `story.json`.
- Do NOT render code as screenshots or cloned syntax blocks. The live diff is
  the scene.
- Do NOT animate diff rows, line numbers, selections, comment anchors, the
  sticky toolbar, or beat-driven scroll position.
- Do NOT replay decorative entrance choreography on every revisit or narration
  advance.
- Do NOT reintroduce filmstrip ghost cards. The numeral thread remains the
  primary navigation.
- Do NOT redesign All files, comments, the sidebar, generation setup, or story
  schema as part of this feature.
- If adding `sceneLayout` would require detailed diff data in the initial
  payload, stop: the scene decision is in the wrong layer.

## Verification

### Mechanical

- `npm run check` — build succeeds and every test passes.
- `npm run ui:atlas` — all evidence selectors resolve and the expanded atlas is
  generated.
- `git diff --check` — no whitespace errors.
- Add assertions that:
  - every scene-projector branch and precedence rule is covered;
  - old Tour v1, v2, and v3 stories project a scene without migration;
  - the initial review payload still omits blocks, moves, focus groups, and file
    bodies;
  - lazy stubs and loaded endpoints carry the same `data-scene-layout`;
  - the speech cache remains present before any panel fetch;
  - no forbidden HTML capability was added;
  - reduced motion skips translations and staggering;
  - rapid step changes cancel stale scene entrances.

### Interaction replay

Using the deterministic atlas fixture and a real browser, verify every scene
type in light and dark where specified:

- Arrow keys and Home/End select the correct filmstrip node and scene.
- Narration advances beats/steps and keeps Resume pointed at the actual scene.
- First entry into a lazy step fetches once; the next step still prefetches.
- Split, unified, and full-file modes continue to work inside code scenes.
- Change navigation, hunk expansion, logic-move targets, paired panes, text
  selection, right-click comment creation, and queued-comment anchors still
  work.
- The dock does not jump when moving between code-focus, logic-move, and
  paired-code scenes.
- The concept diagram retains its caption/fallback and never overflows.
- At 1440×960, 920×820, and 390×844, no primary action or active evidence is
  clipped; long concept content scrolls instead of being cropped to a slide.
- With `prefers-reduced-motion: reduce`, there is no translation or stagger and
  all state remains understandable.
- Rapidly alternate Left/Right for several seconds. No old scene animates after
  the current one, focus is not stolen, and the final active node/panel agree.

### Visual quality gate

Do not call this complete from source inspection alone. Compare the new atlas
frames against the baseline, then have a fresh reviewer critique them for:

- whether each layout communicates a meaning rather than adding decoration;
- whether the live diff is still the dominant evidence on code scenes;
- whether title, explanation, evidence, and navigation have a clear reading
  order;
- whether dark/light and desktop/tablet/mobile states feel like one product;
- whether the animation is calm enough for repeated code review.

**Done when** all mechanical checks pass, the full interaction replay passes,
the screenshot set covers every scene template and responsive variant above,
and the independent visual review finds no blocking hierarchy, overflow,
semantic, or motion issue.

## Follow-up, explicitly outside this plan

After the native scene system has shipped and been used on real stories, decide
whether a standalone “Present / Export” command is worth building. If yes, make
it a separate adapter over the same projected scenes:

- Reveal.js may own navigation only inside that standalone surface;
- code may be a read-only rendered snapshot there, with a clear loss of live
  commenting/editing capability;
- the review app remains the source of truth;
- export must never weaken the in-app story sanitizer or lazy-load contract.
