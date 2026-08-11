# 011 — Unify press feedback to one scale

- **Status**: DONE
- **Commit**: 2156520
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens / Physicality
- **Estimated scope**: 3 files, one-line value changes

## Problem

Four different press-feedback scales are in use across the React surfaces, none
of them agreeing, two of them outside the useful range. The audit playbook
specifies press feedback at **`scale(0.97)`**, kept subtle within **0.95–0.98**.

```tsx
// client/surfaces/picker/RecentRepos.tsx:73 — current
          "hover:border-line hover:bg-fill-1 active:scale-[.992]",
```

`.992` is a 0.8% dip. It is below the threshold of perception — the most-clicked
control on the picker effectively has **no** press feedback, while still paying
for a compositor layer and a transition.

```tsx
// client/surfaces/stories/StoryRow.tsx:214 — current
          "active:scale-[.94]",
```

`.94` is a 6% dip — the most aggressive press in the app, and it is on the
**destructive delete** control. Oversized press feedback on a destructive action
reads as eagerness, which is the wrong feeling for the one button a user might
regret.

```tsx
// client/shared/nav.tsx:43  — "active:scale-[.97]"
// client/shared/nav.tsx:48  — "active:scale-[.97]"
// client/shared/nav.tsx:76  — "active:scale-[.98]"
```

The nav is already correct and already the majority. It is the reference.

This is a cohesion finding rather than a bug: nothing is broken, but pressing
different controls in the same app produces four different physical responses,
which is exactly the kind of inconsistency a user feels without being able to
name.

## Target

One value for standard controls, one documented exception for large surfaces.

| Control | Value | Why |
| --- | --- | --- |
| Buttons, rows, chips, icon buttons | `active:scale-[.97]` | The playbook default; already used by `nav.tsx:43,48` |
| Large surfaces (a full-width card or panel) | `active:scale-[.98]` | A 3% dip on a very wide element reads as a lurch; `nav.tsx:76` already uses this |

```tsx
/* target — client/surfaces/picker/RecentRepos.tsx:73 */
          "hover:border-line hover:bg-fill-1 active:scale-[.98]",
```

The recent-repo row is a full-width card, so it takes the large-surface value —
a real, perceptible dip, without the wide element appearing to buckle.

```tsx
/* target — client/surfaces/stories/StoryRow.tsx:214 */
          "active:scale-[.97]",
```

The delete control is a small icon button: the standard value.

`client/shared/nav.tsx` is already correct at all three sites. **Do not edit it.**

Every one of these already sits behind a `transition-[…transform…]` with
`duration-[var(--motion-duration-press)]` (`.12s`) or
`duration-[var(--motion-duration-fast)]` (`.15s`), both inside the playbook's
100–160ms band for press feedback. Durations are correct; do not change them.

## Repo conventions to follow

- Press feedback is expressed as a Tailwind `active:scale-[…]` arbitrary value,
  never inline styles and never a Motion `whileTap`.
- Bracket values are written without a leading zero: `.97`, not `0.97`. Match
  the existing style exactly — `test/picker.test.mjs` and
  `test/story-picker.test.mjs` assert on this source text.
- **Exemplar to imitate**: `client/shared/nav.tsx:43` —
  ```tsx
  "text-text bg-fill-2 hover:bg-fill-1 active:scale-[.97]"
  ```

## Steps

1. In `client/surfaces/picker/RecentRepos.tsx:73`, change `active:scale-[.992]`
   to `active:scale-[.98]`. Change nothing else on that line.
2. In `client/surfaces/stories/StoryRow.tsx:214`, change `active:scale-[.94]` to
   `active:scale-[.97]`. Change nothing else on that line.
3. Run `node --test test/picker.test.mjs test/story-picker.test.mjs`. If either
   asserts the old literal, update **only** the literal in the assertion — do not
   weaken or delete the assertion, and do not touch its surrounding checks.
4. Run the full build so `dist/client/app.css` regenerates with the new
   arbitrary values.

## Boundaries

- Do NOT edit `client/shared/nav.tsx` — it is already the reference.
- Do NOT change any `duration-[…]`, easing, or transition property list.
- Do NOT add `active:scale-` to controls that do not currently have it. This
  plan unifies existing values; it does not add press feedback anywhere new.
- Do NOT touch `client/surfaces/review/**` or `client/vendor/beui/**`. The
  vendored `Button` handles its own press via Motion and is out of scope.
- If a line does not match the code you find (drift since commit `2156520`),
  STOP and report rather than improvising.

## Verification

- **Mechanical**:
  - `npm run build` — exit 0.
  - `node --test test/*.test.mjs` — 0 failures.
  - `grep -rn 'active:scale-' client/surfaces client/shared` — every result must
    be `.97` or `.98`. No `.94`, no `.992`.
- **Feel check**: run the app (`node dist/app-server.js`).
  - On `/repos`, press and hold a recent-repo row. The dip must be *visible* —
    before this change it was not.
  - On `/repo/<name>/stories`, press and hold a story row's delete button. It
    should feel like the same product as the row above it, not springier.
  - Open DevTools → Animations, set playback speed to 10%, and press each. The
    two should look like the same gesture at different sizes.
  - With `prefers-reduced-motion: reduce` emulated, neither should scale at all
    (that gating is plan 010's job — if 010 has not run yet, the picker row will
    still dip here, which is expected).
- **Done when**: the grep returns only `.97` and `.98`, the suite is green, and
  pressing a repo row and a delete button feels like one product.
