# 001 — Unify motion tokens

- **Status**: DONE
- **Commit**: b352778
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 6 files, small mechanical CSS rewrite

## Problem

The shared theme defines only color tokens:

```ts
// src/theme.ts:5 — current
:root{--app-bg:#f1f3f6;--app-elev:#ffffff;--app-label:#17191e;
```

Motion is independently typed throughout the same product. Examples include:

```css
/* src/page-assets.ts:217 — current */
transition:background .14s,border-color .14s,box-shadow .14s,transform .14s

/* src/diff-assets.ts:23 — current */
transition:background .15s ease,color .15s ease

/* src/nav.ts:96 — current */
transition:background-color 120ms ease-out,transform 100ms ease-out,box-shadow 120ms ease-out
```

The result is a collection of almost-matching durations and weak built-in curves rather than one crisp dashboard motion language.

## Target

Add these exact shared tokens to `sharedTokens()` in `src/theme.ts`:

```css
--motion-ease-out:cubic-bezier(0.23,1,0.32,1);
--motion-ease-in-out:cubic-bezier(0.77,0,0.175,1);
--motion-ease-drawer:cubic-bezier(0.32,0.72,0,1);
--motion-duration-press:120ms;
--motion-duration-fast:150ms;
--motion-duration-ui:200ms;
--motion-duration-progress:250ms;
```

Use `--motion-ease-out` for entrances/exits and press feedback, `--motion-ease-in-out` for movement that remains on screen, and normal CSS `ease` only for hover/color feedback. Do not change which elements animate in this plan.

## Repo conventions to follow

- Shared cross-page tokens live in `src/theme.ts` and are returned by `sharedTokens()`.
- `src/change-page.ts`, `src/picker.ts`, `src/story-picker.ts`, and the review page already include `sharedTokens()` before their component CSS.
- Keep the compact, semicolon-delimited token style already used at `src/theme.ts:5-10`.

## Steps

1. Add all seven tokens to both effective color-scheme roots through the base `:root` declaration in `src/theme.ts`; they do not need dark-mode overrides.
2. In `src/nav.ts`, replace the literal 120ms press/background duration with `var(--motion-duration-press)` and `ease-out` with `var(--motion-ease-out)`; keep the existing 100ms transform duration because it is already within the 100–160ms press budget.
3. In `src/page-assets.ts`, `src/diff-assets.ts`, `src/picker.ts`, and `src/story-picker.ts`, replace repeated 150ms/200ms/250ms movement or entrance declarations with the matching token. Preserve intentionally shorter 100ms/120ms press feedback.
4. Do not replace hover-only `ease` color transitions with a movement curve.
5. Update CSS-string tests only if they assert the old literal declaration; assert the token name and exact token value instead.

## Boundaries

- Do NOT change behavior, markup, keyframes, selectors, or event handlers.
- Do NOT migrate the VS Code webview; it does not consume `sharedTokens()`.
- Do NOT add dependencies or a second token source.
- If any target page does not include `sharedTokens()`, STOP rather than introducing a local duplicate.

## Verification

- **Mechanical**: run `npm run build`, then `npm test`; both must pass.
- **Feel check**: compare navigation buttons, story cards, review controls, and diff toggles before/after at normal speed; timing must remain functionally identical.
- In DevTools, inspect computed transitions and confirm token values resolve to the exact cubic-beziers above.
- Toggle `prefers-reduced-motion`; existing reduced-motion behavior must not regress.
- **Done when**: all shared motion primitives resolve from `src/theme.ts`, and no parallel easing-token set exists.
