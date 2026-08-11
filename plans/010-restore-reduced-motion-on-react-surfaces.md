# 010 — Restore reduced-motion and touch gating on the React surfaces

- **Status**: DONE
- **Commit**: 2156520
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 2 files, small Tailwind class additions

## Problem

Plan 006 completed reduced-motion coverage across the app on 2026-07-14. Four of
the five surfaces were then rewritten in React and their vanilla sources
(`src/picker.ts`, `src/story-picker.ts`, `src/change-page.ts`,
`src/progress-ui.ts`) deleted. The repo picker lost its coverage in that move —
it is now the only surface with **movement that is not gated for
`prefers-reduced-motion`**.

Every other React surface does gate it. `client/surfaces/stories/StoryRow.tsx`
is the same archetype (a clickable row card with a chevron) and is correct.

```tsx
// client/surfaces/picker/RecentRepos.tsx:70-74 — current
        className={cn(
          "flex w-full items-center gap-[13px] rounded-[var(--radius-island)] border border-transparent bg-surface-2 px-4 py-3.5 text-left",
          "transition-[transform,background-color,border-color] duration-[var(--motion-duration-fast)] ease-out",
          "hover:border-line hover:bg-fill-1 active:scale-[.992]",
```

```tsx
// client/surfaces/picker/RecentRepos.tsx:212 — current
              className="h-3.5 w-3.5 transition-transform duration-[var(--motion-duration-fast)] group-open:rotate-180"
```

A third, smaller gap: a hover transform that is not restricted to devices that
actually hover. Touch devices fire a false hover on tap, so the row nudges on
every tap on a phone.

```tsx
// client/surfaces/stories/StoryRow.tsx:192 — current
            className="h-3.5 w-3.5 transition-transform duration-[var(--motion-duration-fast)] ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
```

Reduced motion is handled there, but `hover:` is not gated. `review.css` gates
its hover motion three times (`@media (hover:none),(pointer:coarse)` at lines
885, 910 and 1020); the React surfaces never do.

## Target

Reduced motion means **fewer and gentler**, not zero. Colour and background
transitions stay — they aid comprehension and do not move anything. Only the
`transform` components are dropped.

```tsx
/* target — client/surfaces/picker/RecentRepos.tsx, the row button */
        className={cn(
          "flex w-full items-center gap-[13px] rounded-[var(--radius-island)] border border-transparent bg-surface-2 px-4 py-3.5 text-left",
          "transition-[transform,background-color,border-color] duration-[var(--motion-duration-fast)] ease-out",
          "hover:border-line hover:bg-fill-1 active:scale-[.97]",
          "motion-reduce:transition-[background-color,border-color] motion-reduce:active:transform-none",
```

Note the `active:scale-[.97]` — that value change is **plan 011's** job, not
this one. If plan 011 has already run, the value will already be `.97`; leave
whatever is there and only add the `motion-reduce:` classes. If plan 011 has not
run, leave `.992` alone here too. **This plan adds gating only.**

```tsx
/* target — client/surfaces/picker/RecentRepos.tsx:212, the chevron */
              className="h-3.5 w-3.5 transition-transform duration-[var(--motion-duration-fast)] group-open:rotate-180 motion-reduce:transition-none"
```

```tsx
/* target — client/surfaces/stories/StoryRow.tsx:192, the chevron */
            className="h-3.5 w-3.5 transition-transform duration-[var(--motion-duration-fast)] ease-out motion-reduce:transition-none [@media(hover:hover)and(pointer:fine)]:group-hover:translate-x-0.5"
```

Moving the nudge behind the media query makes the `motion-reduce:group-hover:translate-x-0`
override redundant — a device that cannot hover never applies the transform at
all. Remove that now-dead class as shown.

## Repo conventions to follow

- Motion durations are always tokens, never literals:
  `duration-[var(--motion-duration-fast)]` (`.15s`). Never write `duration-150`.
- Reduced motion is expressed with Tailwind's `motion-reduce:` variant in TSX,
  and with `@media (prefers-reduced-motion: reduce)` in `.css` files.
- **Exemplar to imitate**: `client/surfaces/stories/StoryRow.tsx:214-217` — the
  same row-card pattern, already gating both the transition and the transform:
  ```tsx
  "motion-reduce:transition-none motion-reduce:active:transform-none",
  ```
- Tailwind v4 arbitrary variants use bracket syntax:
  `[@media(hover:hover)and(pointer:fine)]:` — no spaces inside the brackets.

## Steps

1. In `client/surfaces/picker/RecentRepos.tsx`, in the row `<button>`'s `cn(...)`
   call (around line 70), add a new string entry after the existing
   `hover:…active:scale-…` line:
   `"motion-reduce:transition-[background-color,border-color] motion-reduce:active:transform-none",`
2. In the same file at line 212, append `motion-reduce:transition-none` to the
   chevron's `className`.
3. In `client/surfaces/stories/StoryRow.tsx` at line 192, replace
   `group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0`
   with
   `motion-reduce:transition-none [@media(hover:hover)and(pointer:fine)]:group-hover:translate-x-0.5`.
4. Run the build so Tailwind regenerates `dist/client/app.css` with the new
   variants (they are only emitted if a class is present in scanned source).

## Boundaries

- Do NOT touch `client/surfaces/review/**`, `client/surfaces/change/**`,
  `client/surfaces/progress/**`, or `client/vendor/beui/**`.
- Do NOT change any `active:scale-[…]` **value** — that is plan 011.
- Do NOT change markup, structure, or any colour. Motion gating only.
- Do NOT add dependencies.
- If a line does not match the code you find (drift since commit `2156520`),
  STOP and report rather than improvising.

## Verification

- **Mechanical**:
  - `npm run build` — must exit 0.
  - `npx tsc -p client/tsconfig.json --noEmit` — must report no errors.
  - `node --test test/*.test.mjs` — must stay at 0 failures. `test/picker.test.mjs`
    and `test/story-picker.test.mjs` assert on these components' source text; if
    an assertion breaks, read it before changing it — several deliberately pin
    accessibility behaviour.
  - `grep -c 'motion-reduce:' client/surfaces/picker/RecentRepos.tsx` — must be ≥ 2
    (it is 0 before this plan).
- **Feel check**: run the app (`node dist/app-server.js`, open `/repos`).
  - Hover a recent-repo row: background and border still change.
  - Press one: it dips slightly, then settles.
  - In DevTools → Rendering → **Emulate `prefers-reduced-motion: reduce`**, then
    hover and press again. The background/border change must **still happen**;
    the scale dip must **not**. Reduced motion is gentler, not dead.
  - Open the "unavailable workspaces" disclosure with reduced motion on: the
    chevron flips instantly rather than rotating.
  - In DevTools → Device toolbar, switch to a touch device and reload
    `/repo/<name>/stories`. Tap a story row: the chevron must **not** nudge
    right on tap.
- **Done when**: every mechanical check passes and reduced-motion emulation
  leaves colour feedback intact while removing all three transforms.
