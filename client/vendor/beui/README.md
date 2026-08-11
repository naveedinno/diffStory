# beUI (vendored)

React component source vendored from **[starc007/ui-components](https://github.com/starc007/ui-components)**
(the source repo behind [beui.dev](https://beui.dev)), MIT licensed. See `LICENSE`
for the upstream copyright notice, which is reproduced verbatim.

| | |
|---|---|
| Upstream | `starc007/ui-components` |
| Commit | `b3966e2604a8e43537a7b78fa3103a6fd72d1388` (`main`) |
| Vendored | 2026-08-09 |
| Files | 6 — the transitive closure of what the app actually imports |

Every vendored file carries a header naming its upstream path:

```
// Vendored from starc007/ui-components — components/motion/tabs.tsx (MIT)
```

## What is here, and why so little

74 files were vendored during the React rewrite; 68 were removed once the five
surfaces were finished and it was clear which ones the app really used. What
remains is exactly the closure of the live imports:

```
motion/button/base.tsx        Button / ButtonLink — used on all four small surfaces
motion/animated-badge.tsx     the story-picker state badge
lib/use-theme.ts              written here; bridges beUI's hook shape to src/theme.ts
lib/utils.ts                  cn()
lib/ease.ts                   easing constants (imported by the above)
lib/hooks/use-hover-capable.ts pointer-capability check (imported by the above)
```

`test/vendor-beui.test.mjs` asserts this list is exact. Re-adding a component is
therefore a deliberate act that fails a test until the list is updated — which
is the point, given the reason most of them were dropped.

## Why most components were rejected

Not taste. Three recurring, concrete reasons:

**1. Baked-in live regions.** Most of the `agents/` set — and several `motion/`
components — ship their own `aria-live` or `role="status"`. In a diff reviewer
that is actively harmful: a live region on a diff viewport announces the entire
diff body on every lazy load, context expansion and split↔unified toggle. The
progress panel has six tests asserting what must *not* announce, and adopting
`todo-list` for its plan would have read the whole plan aloud on every update.

Measured at the pinned commit, before removal:

| Component | Carried |
|---|---|
| `agents/file-diff.tsx` | `aria-live="polite"` **on the diff viewport** |
| `agents/ai-sidebar.tsx` | `aria-live="polite"` |
| `agents/tool-result.tsx` | `aria-live="polite"` + `role="log"` |
| `agents/todo-list.tsx` | `aria-live="polite"` |
| `agents/streaming-response.tsx` | `aria-live={announce …}` |
| `agents/code-block.tsx` | `aria-live={streaming …}` — conditional; safe only with `streaming` unset |
| `agents/agent-activity/index.tsx` | `role="status"` |
| `agents/loading-states/agent-progress.tsx` | `role="status"` |
| `agents/loading-states/reasoning-text.tsx` | `aria-live="polite"` + `role="status"` |
| `motion/dynamic-island.tsx` | `aria-live="polite"` + `role="status"` |
| `motion/loader.tsx` | `role="status"` |
| `motion/animated-toast-stack.tsx` | `aria-live="polite"` |
| `motion/button/stateful.tsx` | `aria-live="polite"` |

Adopting any of these means wrapping it to strip the live region — never editing
the vendored file.

**2. Semantics that do not match.** `morphing-tabs` would have collapsed
selection and disclosure into a single state on the scope picker, where one
segment is a real `<a href>` and two are disclosures. `table/` brings sorting,
resizing and selection nothing asked for. `swipeable-list` puts a destructive,
undo-less delete behind a swipe.

**3. Placement is specified behaviour.** The change page's ref combobox has an
exact anchoring rule; `select`/`popover` own their own placement.

The review page uses no beUI at all: its interaction layer was ported wholesale
rather than rebuilt, because the ordering of its delegated click table *is* the
behaviour.

## Why vendored rather than installed

beUI is distributed as copy-in source, not as an npm package — there is nothing
to install. Vendoring also lets us de-Nextify the components once, in place, and
keep the result under review like the rest of the codebase.

## Layout

Upstream's `components/` prefix is dropped; everything else keeps its shape.
Upstream's `@/components/...` and `@/lib/...` path aliases are rewritten to
relative imports so this tree resolves with no tsconfig `paths` entry.

## Deliberate modifications

Considered divergences from upstream, not accidents. Each is also commented at
the site of the change. (Items covering removed files are kept for whoever
re-vendors them.)

1. **`'use client'` directives removed** — every file. There is no server
   component boundary here; the whole client bundle is client-side.

2. **`next-themes` replaced by `lib/use-theme.ts`.** Written for this repo, it
   exposes the same `{ theme, resolvedTheme, systemTheme, setTheme }` surface but
   reads and writes diffStory's own theme plumbing: the `ds-theme` localStorage
   key, `data-theme` / `data-theme-mode` on `<html>`, `html.style.colorScheme`,
   the `meta[data-ds-theme-color]` tag, and the `ds-theme-change` document event.
   That contract is defined by `src/theme.ts`, which stays the canonical owner —
   its inline pre-paint bootstrap script still performs the first write. The two
   can coexist on one page; each listens for the other's changes.

3. **`lenis` not adopted**, and `motion/smooth-scroll.tsx` never vendored.
   Hijacked smooth scrolling is hostile in a diff viewer.

4. **`shiki` not adopted.** `src/highlight.ts` already highlights synchronously
   in this app's palette, and shiki is a multi-megabyte async WASM highlighter.
   The de-shiki'd components carried `highlightedHtml` props as the intended
   seam; they were removed with the rest of the unused set.

5. **`motion/theme-toggle.tsx` rendered on the first paint** rather than gating
   on a `mounted` effect, because our hook can read what the pre-paint bootstrap
   already wrote. (Removed with the unused set.)

Not modified: no `next/image`, `next/link`, `@vercel/*`, analytics or
beui.dev-site-specific imports appeared anywhere in this subtree, so there was
nothing to strip.

## Runtime dependencies

Of what remains: `react`, `motion` (imported as `motion/react`), `clsx`,
`tailwind-merge`. The full 74-file set additionally needed `react-dom`,
`lucide-react` and `@tanstack/react-virtual`.

Styling assumes Tailwind v4 and the shadcn-style CSS variable names beUI uses
(`--foreground`, `--muted-foreground`, `--background`, `--ring`, …). The
`@theme` bridge generated from `src/theme.ts` supplies them.

## Updating, or re-adding a component

Re-fetch from the pinned commit above, de-Nextify per the list, and add the file
to the allowlist in `test/vendor-beui.test.mjs`. **Check it for a live region
first** — the table above is the record of which ones had them at this commit,
and a vendor update can add more. Do not edit vendored files for styling; prefer
wrapper components in `client/` so the next update stays mechanical.
