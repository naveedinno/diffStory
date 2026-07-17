# Design spec: CodeWalkthrough filmstrip (Signal 3b)

**Status:** pending approval
**Date:** 2026-07-17
**Sub-project:** 4 of N in the "Signal / Thread-Ledger" (3b) port. Builds on the foundation + islands.

## Summary

Replace the story-walkthrough's **left beat-tree rail + bottom beatdock** with the 3b **filmstrip**: one step at a time on a centered stage (oversized Space Grotesk numeral + CHECK question + the *unchanged* diff viewer), dimmed ghost prev/next cards at the stage edges, and a **horizontal numeral thread along the bottom** as the whole step navigation. This supersedes the recently-shipped beat-tree nav (owner-approved: the mockup readme says the filmstrip "replaces the earlier sidebar-rail read layouts"). The **raw-diff / All-files view stays exactly as-is** (its file rail + diff viewer are untouched).

Source of truth: the imported mockup `.claude-design/lab/diffstory-ds/ui_kits/diffstory/CodeWalkthrough.jsx`.

## Goals

- **Story view = filmstrip.** In the walkthrough (Story) view, hide the left story rail; render the active step as a centered stage (max ~880px island): oversized numeral (`--font-display`, up to 52px, `--accent`, `--accent-glow`), step title + file meta, the `CHECK` kicker + review question, then the standard diff viewer unchanged.
- **Bottom numeral thread** is the primary nav: numerals `01…0N` in a row on a bottom island; a 2px thread solid `--thread` up to the active step, `--thread-dim` beyond; active numeral 22px `--accent`, read 15px `--text-2`, unread 15px `--numeral-dim`. Click a numeral → go to that step. Reuses `setActive(i)`.
- **Ghost cards**: dimmed prev/next step previews flanking the stage (numeral + short label); click → navigate. The leftmost "ghost" at step 0 is the scope/overview entry.
- **Preserve behavior**: reuse the existing `setActive`/step show-hide JS, arrow-key + Home/End nav, lazy step loading (`loadStoryStep`), concept-step panels, per-step beats/focus (`selectStoryFocus`) + the active-beat transport, the repair menu, read-aloud (`speakStepIndex`), "All files →" jump (`setView('files')`), and per-beat viewport targeting.

## Non-goals

- **All-files / raw diff view** — untouched (its file rail + unified/split/full viewer stay). The filmstrip is the Story view only.
- The diff viewer internals, comments, Notes/rounds model, or the other routes.
- The Atlas map (already cut by the design).

## Current architecture (what we're changing)

- **Story rail** (`render.ts` `storyRail`/`railCard`/`railBeatTree`): reading-order numerals + per-step beat tree, in `.ds-rail`. Also hosts the **file tree** for All-files (`railFileTree`) under the Story/All-files tabs.
- **Step panels** (`codeStepPanel`/`conceptStepPanel`): one shown at a time (`hidden` toggled), each with `.ds-step-top` (meta + title), `.ds-review-question`, `.ds-diffscroll` (diff), `stepStoryHtml` (beats).
- **Bottom beatdock** (`.ds-beatdock`): active-step beat transport (count, active-beat note, prev/next, playstep).
- **Client JS** (`page-assets.ts` PAGE_JS): `setActive(i)` (show step i, sync rail/beatdock), `activateStep`, `selectStoryFocus(step,beat)`, `setView('tour'|'files')`, `loadStoryStep`, arrow-key handlers, `data-goto-step`/`data-prev`/`data-next`/`data-step-panel`/`data-step-index`.

## Design / approach

**Reuse the nav engine.** Keep `setActive(i)` and the step panel show/hide, lazy loading, keyboard nav, and beat/focus logic. The change is **presentational + a new nav surface**:

1. **Stage layout.** Restyle `.ds-step.is-code-step` (and concept) into a centered stage island: oversized numeral column + title/CHECK header, diff below. Mostly CSS on the existing markup, plus adding the numeral element to `.ds-step-top`.
2. **Bottom numeral thread.** Render one new element (a `filmstripThread(steps)` in `render.ts`) — a bottom island with a numeral per step, wired to `setActive` via `data-goto-step`. It replaces the rail as the primary nav in Story view. Active/read/unread states driven by the existing active-step class sync (extend `setActive` to also mark the thread).
3. **Ghost cards.** Two dim preview cards flanking the stage (`filmstripGhost`), showing the prev/next step numeral + short label; `data-goto-step`. Purely presentational.
4. **Rail handling.** In **Story view**, hide `.ds-rail` (the filmstrip owns nav via the bottom thread). In **All-files view**, keep `.ds-rail` (file tree) exactly as today. Toggle via the existing `setView` + a body/data attribute (e.g. `data-read-view="tour|files"`), so no rail-content changes — just visibility.
5. **Beats.** Keep the active-step beat transport (the bottom beatdock) — but position it within/near the stage (above the numeral thread), since the rail beat-tree is gone. The beatdock already carries the active beat + prev/next; it stays the beat surface. (The rail `railBeatTree` is dropped in Story view.)

**Markup changes** (`render.ts`): add the oversized numeral to the code/concept step header; add `filmstripThread` + `filmstripGhost`; wrap the Story-view stage. **CSS** (`page-assets.ts`): stage island, oversized numeral, thread, ghosts, and hide `.ds-rail` in Story view. **JS**: extend `setActive` to update the thread's active/read/unread + ghost labels; everything else reused.

## Edge cases & risks

- **Rail serves two views.** The rail hosts both the story beat-tree (drop in Story view) and the file tree (keep for All-files). Must hide the rail only in Story view, and restore it on All-files — verify the toggle both ways, plus rail collapse/resize in All-files.
- **Concept steps** have no diff — the stage must render the concept document centered (numeral + concept card) without a diff viewer.
- **Lazy loading**: later steps load on approach; the thread/ghosts must reflect steps that aren't yet in the DOM (drive them from step metadata, not the panel DOM).
- **Compact width**: the bottom thread must stay usable (scroll/condense); ghosts hide on narrow; the stage goes full-bleed.
- **Keyboard + read-aloud auto-advance** must still move the stage and the thread highlight together.
- **This replaces recently-shipped code** (`railBeatTree`, the rail-as-story-nav). Expect to update render-contract tests that assert the story rail / beat-tree markup — preserve their *intent* (nav exists, steps reachable) against the new thread.

## Verification

1. `npm run build`; on `/review` with a story, in dark + light: the filmstrip stage renders (oversized numeral, CHECK, diff), the bottom numeral thread navigates, ghosts preview prev/next; screenshot both themes.
2. Click a numeral, use arrow keys + Home/End, and read-aloud auto-advance — stage + thread stay in sync.
3. Toggle to **All files** and back — the file rail returns intact (resize/collapse still work); toggle to a **concept step** — centered concept card renders.
4. Compact width — thread usable, stage full-bleed, no overflow.
5. `node --test test/*.test.mjs` — update walkthrough/rail contract tests to the filmstrip; rebuild `dist/`; `node --check` the emitted PAGE_JS after the JS edit.

## Open questions for approval

1. **Scope of first pass:** ship the full filmstrip (stage + thread + ghosts) in one pass, or land the **stage + bottom thread first** and add **ghost cards** as a fast follow (lower risk, sooner verification)? Recommend stage + thread first, ghosts as follow-up. — *Decided: full filmstrip in one pass.*
2. **Beats surface:** keep the current bottom **beatdock** as the active-step beat transport (recommended — it already works), or fold beats into the stage differently? — *Decided: keep the beatdock.*

## Implementation map (from code exploration, 2026-07-17)

Concrete attach points confirmed by reading the current walkthrough:

- **Layout markup** (`render.ts` ~L374–438): `<div class="ds-layout"> <aside class="ds-rail"> <main class="ds-main"> <div class="ds-view" id="ds-view-tour">${introPanel}${stepPanels}</div> <div class="ds-view" id="ds-view-files">${filePanels}</div>`. The **Story/All-files tabs live inside `.ds-rail`** (L375–378), and the rail's inner content already toggles per view via `[data-rail="tour|files"]`.
- **Nav engine (reuse):** `setActive(i)` → `activateStep(i)` (`page-assets.ts` ~L1443/L1474): shows panel `i` (`p.hidden=idx!==i`), syncs `stepCards`/`[data-story-step-node].is-active`, progress, lazy-loads via `loadStoryStep`. `setView(v)` (~L1405) flips `#ds-view-tour`/`#ds-view-files` + `.ds-tab` + `[data-rail]`. Step panels carry `data-step-panel="${i+1}"`; nav triggers are `data-goto-step` / `data-prev` / `data-next`.
- **Beatdock**: `stepStoryHtml` (`render.ts` L1228) renders `.ds-beatdock` per step — keep as the beat transport.

### Build steps
1. `render.ts`: add oversized `.ds-stage-num` (`String(order).padStart(2,'0')`) to `codeStepPanel` + `conceptStepPanel` headers; add `filmstripThread(steps,total)` (bottom numeral island, `data-goto-step`, + an **"All files →"** control calling `setView('files')`) and insert it at the end of `#ds-view-tour`.
2. `page-assets.ts` CSS: center the active `.ds-step` as a max-880px stage island; style `.ds-stage-num`, the thread (solid `--thread` to active, `--thread-dim` beyond; active 22px `--accent`, read 15px `--text-2`, unread `--numeral-dim`), and ghost prev/next cards; **hide `.ds-rail` in tour view** (`body[data-read-view="tour"] .ds-rail{display:none}` + `.ds-main` full-width) — default (no attr) = tour.
3. `page-assets.ts` JS: `setView` sets `document.body.setAttribute('data-read-view', v)`; extend `activateStep` to mark the thread node/ghosts active/read/unread. `node --check` the emitted PAGE_JS.

### Integration crux (the reason this is a large, careful build)
The **view toggle lives in the rail** the filmstrip hides. Resolution: in Story view hide the rail and expose "All files →" on the thread island; in Files view the rail (with tabs) returns you to Story. Concept steps and the Overview (index 0) render on the stage without a diff. All of `setActive`/lazy-load/keyboard/read-aloud must keep the thread highlight in sync. This is why it is the highest-regression slice — it rewires the primary review navigation.
