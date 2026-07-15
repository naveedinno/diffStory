# Design Implementation Plan: Storyless Review Header

## Summary

- **Scope:** Component-level redesign of the shared review chrome.
- **Target:** Both narrated-story and storyless review headers plus the shared review-status ledger.
- **Winner:** Variant F, “Integrated review frame.”
- **Source directions:** B’s sidebar-aligned frame plus E’s quiet native titlebar and semantic review ledger.
- **Outcome:** Navigation and repository context belong to the sidebar; the review canvas owns the document title and actions; narrated controls remain available only for stories; round/status information becomes one restrained ledger instead of a second toolbar.
- **Constraint:** Preserve every existing review, approval, exclusion, comparison, reload, sidebar, and accessibility contract. Add no dependency and do not edit generated `dist/` files directly.

## Files to Change

- [ ] `src/render.ts` — Restructure the storyless header markup and refine `reviewSessionBar()` into the selected ledger anatomy.
- [ ] `src/page-assets.ts` — Add the split chrome layout, semantic states, responsive behavior, loading feedback, and shared sidebar-width alignment.
- [ ] `test/render-page.test.mjs` — Lock the new markup, state, responsive, accessibility, and preserved-behavior contracts.

## Implementation Steps

1. **Create a common review-chrome grid.**
   - Render raw diffs and narrated stories as two columns tied to `--ds-rail-width`: sidebar context and review-canvas controls.
   - Use a 56px title row and a 30px ledger row on desktop.
   - Let the sidebar header span both rows so its right border continues directly into the existing review rail.
   - Keep the narrated-story controls inside the shared frame and omit them only in storyless mode.

2. **Move navigation and repository identity into the sidebar-owned header.**
   - Keep `[data-sidebar-toggle]` and the `/change` back link together.
   - Show the repository name below that navigation cluster.
   - Do not repeat the repository identity in the desktop canvas title.

3. **Make the canvas titlebar quiet and document-like.**
   - Show `Reviewing the diff` as the primary title and `Working tree vs <baseLabel>` as secondary context.
   - Hide narration/play and voice-settings controls when `data-storyless="1"`; retain Help.
   - Replace raw header glyphs with consistent inline SVG or shared vector markup using the existing visual tokens.
   - Keep Reload neutral and visually lighter than Review.

4. **Refine the action hierarchy without changing behavior.**
   - Preserve `[data-reload-diff]`, `[data-review-menu]`, `[data-review-menu-pop]`, unresolved-count updates, decision gating, and popover focus return.
   - Remove the amber warning dot from Reload.
   - Use a compact rectangular Review control with a flat unresolved-count badge and caret.
   - Keep Review neutral during attention states; use the existing subtle green treatment only when the full approval contract is ready.

5. **Turn `reviewSessionBar()` into the semantic ledger.**
   - Preserve `[data-roundbar]`, `[data-review-mode]`, `aria-pressed`, and disabled Since-review behavior.
   - Render: round ring and label → capped 1px connector → semantic icon and status sentence → Full/Since segment when `compareFrom` exists.
   - Map state classes explicitly:
     - attention/blocker → amber;
     - ready or approved → green/check;
     - follow-up round → blue/informational;
     - changes requested → red;
     - invalid feedback remains an alert and approval blocker.
   - Keep approval readiness independent from non-blocking unresolved comments.

6. **Align sidebar resizing across chrome and content.**
   - Move the live `--ds-rail-width` value to a common owner inherited by both the chrome and `.ds-layout`, rather than setting it only on `.ds-layout`.
   - Update `currentSidebarWidth()` and `setSidebarWidth()` accordingly.
   - Preserve the current 240–560px clamp, separator keyboard controls, `ds-sidebar-width` persistence, and resize affordance.

7. **Preserve collapsed and compact navigation.**
   - When the desktop sidebar is collapsed, reveal the existing toggle/back cluster in the canvas titlebar so navigation never disappears.
   - At `<=720px`, keep the sidebar as an overlay with scrim, Escape dismissal, focus return, and inert covered content.
   - Keep repo/base context available in the compact title or drawer header.
   - Use at least 44×44px targets for compact navigation, Reload, Review, and Full/Since controls.

8. **Handle narrow follow-up rounds without crushing status.**
   - Truncate long status copy before hiding important actions.
   - Remove the decorative connector first on compact screens.
   - At approximately `<=640px`, move Full/Since to a second ledger row with true 44px buttons.

9. **Make Reload’s transient state explicit.**
   - On activation, set `disabled`, `aria-busy="true"`, an `is-loading` class, and the accessible name `Reloading diff` before navigation.
   - Animate only the Reload icon and respect `prefers-reduced-motion`.
   - Leave the last-known review ledger visible while reload begins.

10. **Verify the finished surface in both themes and all key states.**
    - Render attention, clean/decision-ready, loading, Round 2, approved, changes-requested, invalid-feedback, zero-comment, and long repo/base-label cases.
    - Check expanded/collapsed desktop, resized sidebar, compact drawer open/closed, and narrow follow-up layout.
    - Run the full project test suite after the focused render tests pass.

## Renderer Contract

- **Inputs already available:** `storyless`, `repoName`, `baseLabel`, `reviewState`, `reviewMode`, unresolved/blocking counts, coverage/exclusion/index-divergence state, freshness, and approval readiness.
- **Persistent client state:** sidebar collapsed state and `--ds-rail-width` via existing `localStorage` keys.
- **Transient client state:** sidebar overlay open, Review popover open, Reload busy, and current comparison mode.
- **Hooks that must remain stable:**
  - `[data-sidebar-toggle]`
  - `[data-sidebar-resizer]`
  - `[data-reload-diff]`
  - `[data-review-menu]` and `[data-review-menu-pop]`
  - `[data-roundbar]`
  - `[data-review-mode]`
  - `[data-close-story]`

## Required UI States

- **Attention:** Amber exists in the ledger only; neutral utilities remain neutral.
- **Ready:** Green ring/connector/check and a restrained clean Review treatment.
- **Approved:** Preserve the exact-diff verdict summary and green semantic state.
- **Changes requested:** Red semantic ledger without turning neutral controls red.
- **Loading:** Reload alone spins, disables, and announces busy state.
- **Follow-up:** Round 2 uses informational blue and exposes Full/Since comparison.
- **Disabled:** Since review remains disabled when no files changed; approval gates remain unchanged.
- **Error:** Invalid feedback remains a visible alert with recovery guidance.
- **Empty:** A zero comment count does not leave an empty badge or stray label.
- **Overflow:** Repository, base label, title, and status copy truncate without hiding navigation or decisions.

## Accessibility Checklist

- [ ] Sidebar toggle, Back, Reload, Help, Review, and comparison controls have stable accessible names.
- [ ] `aria-expanded`, `aria-controls`, `aria-pressed`, `aria-busy`, and disabled states stay synchronized.
- [ ] Review popover and compact drawer return focus to their trigger on close.
- [ ] Covered diff/status content becomes inert while the compact drawer is open.
- [ ] All compact controls meet the 44×44px target minimum.
- [ ] Focus-visible styling remains system blue and is never removed without a replacement.
- [ ] Light and dark text/UI contrast meet WCAG AA.
- [ ] Reduced-motion, reduced-transparency, and increased-contrast modes remain supported.

## Testing Checklist

- [ ] Extend `test/render-page.test.mjs` for the split header and ledger structure.
- [ ] Assert storyless mode omits narration/settings but keeps Help, Reload, Review, Back, and sidebar controls.
- [ ] Assert Reload has no warning dot and exposes busy-state hooks.
- [ ] Assert Review retains unresolved count, menu relationships, and approval metadata.
- [ ] Assert semantic ledger classes for attention, ready, follow-up, approved, requested, and invalid-feedback states.
- [ ] Assert Full/Since labels, disabled state, and `aria-pressed` behavior.
- [ ] Assert chrome and `.ds-layout` inherit the same persisted `--ds-rail-width`.
- [ ] Assert compact drawer, inert handling, focus return, 44px targets, and two-row follow-up CSS.
- [ ] Run `node --test test/render-page.test.mjs`.
- [ ] Run `npm test`.
- [ ] Capture desktop dark/light plus compact attention and Round 2 screenshots for final visual QA.

## Design Tokens

- Reuse `--ds-rail-width`, `--md-surface-*`, `--text`, `--muted`, `--line`, `--line-soft`, `--fill-*`, `--accent-*`, `--amber-*`, `--green`, `--add-*`, and `--del-*`.
- Keep SF Pro/system UI text and SF Mono for repository/base-ref metadata.
- Use existing 7–10px control radii; reserve pills for compact counts or segmented state only.
- Add no new global color palette or dependency.
