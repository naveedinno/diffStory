# 009: Calm engine chrome (toasts, shortcuts, dialogs)
- Findings: A11Y-4, A11Y-12, A11Y-7, EXP-8
- Severity: MEDIUM
- Wave: 2 (engine chain, runs after plan 008)
- Owned files: client/surfaces/review/engine/review-engine.js

## Problem
- A11Y-4: one 4200ms timer dismisses every toast including errors: `toastTimer=setTimeout(function(){...},4200)` (:3578). Error callers are real flows (comment save :3191, copy :3603, aloud :1791). Region `#ds-toast` (`role="status"`) is stable and correct.
- A11Y-12: global single-key shortcuts (`? / b c j k v`, :3853 area) fire document-wide with no off switch; Space on non-control targets starts narration instead of scrolling (:3925 area, documented as "Toggle read aloud").
- A11Y-7 (JS half): blame popover gets `role="dialog"` + `tabIndex=-1` (:3687) and an aria-label (:3692) but no `aria-modal`. (CSS ring half is plan 003.)
- EXP-8: `removeQueuedComment` uses `window.confirm('Remove this queued comment?')` (:3201) while story removal uses a labeled dialog (RemoveStoryDialog) naming consequence and scope.

## Target
- Polite toasts last at least 5000ms; error-tone toasts persist until the next toast or an explicit dismiss. Region structure unchanged.
- Shortcuts: leave Space to scroll (default) until narration has started at least once this page-load; after that, Space toggles as today. Add a user-facing toggle for the single-key layer: a "Keyboard shortcuts" checkbox in the command palette footer (or the palette help row), persisted in localStorage, default ON, gating `? / b c j k v` (not Escape, arrows, or typing). At minimum the palette documents Space (already does) plus the toggle.
- Blame popover: set `aria-modal="true"` on open.
- Queued-comment removal confirms through a labeled inline dialog following the RemoveStoryDialog pattern (title naming the file:line anchor, "Remove comment" + "Cancel", Cancel focused, failed delete keeps the dialog open with its reason). No `window.confirm` remains.

## Repo conventions
- Toast exemplar: existing `toast()` shape and `#ds-toast` region.
- Dialog exemplar: `client/surfaces/stories/RemoveStoryDialog.tsx` (title, consequence, scope, focused Cancel).
- Storage exemplar: `ds-*` namespaced localStorage keys.

## Steps
1. Split toast timing by tone (5000ms+ polite, persistent error).
2. Gate single-key shortcuts behind the persisted toggle; make Space scroll until narration first starts.
3. Set `aria-modal="true"` on the blame popover.
4. Replace `window.confirm` with the labeled comment-removal dialog.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: error toast persists; shortcuts toggle off stops single-key firing; Space scrolls a fresh page; blame announces as modal dialog; comment removal shows the labeled dialog with Cancel focused.
- Done when: build passes; all four target states present; no `window.confirm` or 4200ms timer remains.
