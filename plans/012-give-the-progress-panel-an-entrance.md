# 012 — Give the floating progress panel an entrance and exit

- **Status**: DONE
- **Commit**: 2156520
- **Severity**: MEDIUM
- **Category**: Missed opportunities
- **Estimated scope**: 1 file, one wrapper component

## Problem

This was identified as a missed opportunity on 2026-07-14 and deferred:

> The three additive missed opportunities — folder-browser entrance,
> floating-progress-panel entrance, and anchored popover polish — remain
> deliberately out of scope until the corrective work is implemented and
> feel-checked. — `plans/README.md`

The other two are now resolved. This one is not. The panel still teleports.

```tsx
// client/surfaces/progress/ProgressPanel.tsx:89 — current
  if (!state.open) return null;
```

```tsx
// client/surfaces/progress/ProgressPanel.tsx:54-62 — current
const VARIANT: Record<ProgressVariant, string> = {
  // The parked home: a console in the corner of the review page.
  floating:
    "fixed right-[18px] bottom-[18px] z-50 w-[min(460px,calc(100vw-36px))] max-h-[min(72vh,580px)] shadow-[0_18px_50px_rgba(0,0,0,0.5)]",
  inline: "mt-5 max-h-[min(66vh,580px)]",
  // In the story stage the panel IS the content, so it gets room to breathe and
  // no scroll cap of its own.
  stage: "mt-7 max-h-none",
};
```

`VARIANT` carries positioning only. There is no entrance and no exit anywhere in
the component. When a reviewer starts generating a story, a 460px console
**appears fully-formed in the bottom-right corner in a single frame**, with
nothing connecting it to the action that summoned it. When the run ends and the
panel closes, it vanishes the same way.

This is the strongest remaining candidate in the app for added motion, and it
satisfies every condition the playbook sets for spending the delight budget:

- **Rare, high-emotion.** Story generation is a minutes-long operation a user
  starts deliberately and then watches. It is not a hot path — the playbook's
  rule that anything hit 100+ times/day should animate *less* does not apply.
- **Spatially unexplained.** The panel is a floating surface with no visual
  relationship to its trigger; a rise from the corner it occupies is the
  cheapest possible explanation of where it came from.
- **A jarring state change.** A large opaque console materialising over the
  review page is precisely the "prevent a jarring change" case.

## Target

Motion 11 is already a dependency (~106 kB gzip, in the shared chunk) and
`AnimatePresence` is currently used **nowhere** in the app. This is the case it
exists for: an exit animation is impossible without it, because
`if (!state.open) return null` unmounts the tree immediately.

Only the **floating** variant animates. `inline` and `stage` are laid out in
normal document flow as page content — sliding page content is wrong, and the
`stage` variant is already inside a container that has its own entrance.

```tsx
/* target — the wrapper around the existing panel markup */
<AnimatePresence>
  {state.open ? (
    <motion.div
      key="progress-panel"
      initial={reduce || variant !== "floating" ? false : { opacity: 0, transform: "translateY(12px) scale(0.985)" }}
      animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
      exit={
        reduce || variant !== "floating"
          ? { opacity: 0, transition: { duration: 0.12 } }
          : { opacity: 0, transform: "translateY(8px) scale(0.99)", transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] } }
      }
      transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
      /* …existing data-* attributes and className unchanged… */
    >
```

Every value above is deliberate and must not be approximated:

- `translateY(12px) scale(0.985)` — the panel rises from where it sits. **Never
  `scale(0)`**: nothing in the real world appears from nothing. This matches the
  folder-browser sheet, which uses `translateY(12px) scale(0.975)`
  (`client/shared/shared.css:172-178`).
- `0.34s` with `cubic-bezier(0.32, 0.72, 0, 1)` — the repo's `--motion-duration-spatial`
  and `--ease-drawer`, the same pair the folder-browser sheet uses. Inside the
  playbook's 200–500ms band for a panel of this size.
- Exit is faster than entry (`0.16s`, `--ease-out` = `cubic-bezier(0.23, 1, 0.32, 1)`).
  A dismissal should get out of the way; asymmetric timing is correct here.
- **The full `transform` string, not Motion's `y`/`scale` shorthands.** The
  shorthands are not hardware-accelerated and run on the main thread — and this
  panel animates *while an agent is streaming NDJSON into it*, which is exactly
  when the main thread is busiest.
- Under reduced motion, entry is skipped (`initial={false}`) and exit is a plain
  120ms fade. Fewer and gentler, not zero: the fade still explains that
  something left.

## Repo conventions to follow

- Reduced motion in TSX components is read with `useReducedMotion()` from
  `motion/react`. **Exemplar**: `client/surfaces/change/RefPicker.tsx` — the only
  other file using Motion directly — reads `const reduce = useReducedMotion();`
  and branches its animate target on it.
- Motion values in that file are also written as full property objects with
  explicit transitions rather than shorthands. Imitate its shape.
- The panel's root already carries `data-progress-panel`, `data-variant` and
  `data-state`. **These are UI-atlas evidence selectors and test hooks — they
  must remain on the element that is now `motion.div`, not be moved to a new
  parent.** `scripts/capture-ui-atlas.mjs` selects
  `#ds-agentpanel [data-progress-panel]`, and `test/progress-ui.test.mjs`
  asserts on the panel's structure.

## Steps

1. In `client/surfaces/progress/ProgressPanel.tsx`, add to the existing imports:
   `import { AnimatePresence, motion, useReducedMotion } from "motion/react";`
2. Inside the component, above the existing `if (!state.open) return null;`, add
   `const reduce = useReducedMotion();`
3. Delete the `if (!state.open) return null;` early return. `AnimatePresence`
   needs to render the absence, so the conditional moves into the JSX.
4. Wrap the returned tree in `<AnimatePresence>{state.open ? ( … ) : null}</AnimatePresence>`.
5. Change the root `<div>` to `<motion.div>` with `key="progress-panel"` and the
   `initial` / `animate` / `exit` / `transition` props exactly as given in
   **Target**. Keep every existing `data-*` attribute and the entire `className`
   expression on that same element, unchanged.
6. Close the tag as `</motion.div>`.
7. Rebuild.

## Boundaries

- Do NOT animate the `inline` or `stage` variants. Gate on
  `variant !== "floating"` exactly as shown.
- Do NOT touch `client/surfaces/progress/state.ts`. The state machine, the single
  live region, and the `announce()` call sites are covered by six tests asserting
  what must **not** be announced. This plan changes presentation only.
- Do NOT add or move any `aria-*` attribute. In particular do not let
  `AnimatePresence` wrap or duplicate the visually-hidden
  `role="status"` announcer — it must stay exactly one node inside the panel.
- Do NOT use Motion's `y`, `scale`, or `opacity` shorthand props; use the full
  `transform` string as shown.
- Do NOT add dependencies. Motion is already installed.
- If the code does not match (drift since commit `2156520`), STOP and report.

## Verification

- **Mechanical**:
  - `npm run build` — exit 0.
  - `npx tsc -p client/tsconfig.json --noEmit` — no errors.
  - `node --test test/*.test.mjs` — 0 failures. `test/progress-ui.test.mjs`
    asserts the announcement discipline; if it breaks, you have moved the live
    region — revert and rethink, do **not** weaken the test.
  - `npm run ui:atlas` — must complete and report 55 frames. Ten of them are
    progress-panel states; if a selector stops matching you have moved
    `data-progress-panel` off the root.
- **Feel check**: run the app, open a repo, and start a story generation
  (`node dist/app-server.js`; the panel also mounts via
  `window.diffStoryProgress.mount(el, {variant:"floating"})` if you want to drive
  it without an agent on PATH).
  - The panel **rises** into the corner — it does not fade in place and does not
    grow from nothing.
  - On completion/close it drops away slightly faster than it arrived.
  - DevTools → Animations at 10% playback: confirm the panel is never smaller
    than ~98.5% at any frame, and that it translates no more than 12px.
  - Start a run, and while output is streaming, confirm the entrance did not
    stutter — this is the main-thread check that motivated the full `transform`
    string.
  - DevTools → Rendering → **Emulate `prefers-reduced-motion: reduce`**: the
    panel appears instantly with no movement, and still **fades** on close.
  - Switch the panel to the `stage` variant (it is used during story generation
    on a storyless review page): confirm it does **not** slide, because it is
    page content there.
- **Done when**: all mechanical checks pass, the atlas still reports 55 frames,
  and the panel arrives from the corner it lives in rather than materialising.
