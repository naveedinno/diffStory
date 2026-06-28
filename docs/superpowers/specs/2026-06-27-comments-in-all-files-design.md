# Comments in the All-files view — design

**Date:** 2026-06-27
**Status:** Design, awaiting review

## Problem

The review screen has two views: **Story** (step-by-step, side-by-side diff) and
**All files** (a master/detail file browser with a Diff / Full-file sub-toggle). You can
leave line comments in the Story view, but **not in All files** — there is no `+`
affordance on those rows. Reported live: *"I don't see a way to put comments in this mode."*

Root cause: a comment is stored as `{ step, file, line, type, body }` and `step` is
**required** ([comments.ts:42](../../../src/comments.ts)). The Story view anchors threads
and the `+` button by `step`+`line` ([render.ts:516-528](../../../src/render.ts)); the
All-files renderers (`unifiedRow`, `fullRow`) emit neither line metadata nor the button, and
the All-files view has no "step" to attach to.

## Core idea

Treat a comment as fundamentally a **`(file, line)`** annotation. Demote `step` to an
optional hint that only tells the Story view where to place a thread. Then:

- Any row that carries `data-file` + `data-line` is commentable — the client's existing
  generic composer already works on it.
- The **same** comment surfaces in every view where its `(file, line)` is shown — drop one
  in All-files and it also appears on that line in the Story, and vice versa (cross-surfaced).
- The agent / `/address-review` is unaffected: it already acts on `file:line`.

## What's already reusable (no change)

- `buildComposer(row)` ([page-assets.ts:1192](../../../src/page-assets.ts)) reads
  `data-file`/`data-line`/`data-step` from any row and POSTs `{file,line,step,type,body}`.
- `buildComment(c)`, `threadAfter(row)`, `openComposer(row)`, the `+` click handler
  ([page-assets.ts:1351](../../../src/page-assets.ts)), and the `GET/POST /api/comments`
  routes all already exist.
- Full-file rows already carry `comment: l.newNo !== undefined`
  ([view-model.ts:353](../../../src/view-model.ts)) — "any line present in the file is
  commentable" is already the data's intent.

So the work is: (1) loosen `step`, (2) emit the attributes+button in the two All-files
renderers, (3) make threads find their rows by `(file, line)` in every view.

## Changes by file

### `src/types.ts` + `src/comments.ts` — loosen `step`
- `Comment.step` and `NewComment.step` become optional (`step?: string`).
- `addComment`: drop the "comment step is required" throw. Store `step` only when provided
  (omit the key entirely when absent, so All-files comments have no `step` in `comments.json`).
- `file` stays required; `line` stays as today.

### `src/render.ts` — emit commentable rows in All-files, key threads by (file,line)
- **`sbsRow`** (Story): change `threadFor(s.id, row.newNo!, comments)` to key by
  `(file, line)` — `threadFor(s.file, row.newNo!, comments)` filtering
  `c.file === file && c.line === line`. The `+` button and `data-*` already exist here.
  (Update `threadFor`'s signature accordingly.)
- **`fullRow(row, file)`** (Full-file): when `row.comment && row.newNo !== undefined`, add
  `data-file="<file>" data-line="<newNo>"` to the `.ds-row` and append the
  `<button class="ds-addcomment" …>+</button>`. Thread the `file` argument down from
  `renderFullFile(rows, { file, newFile })`, which already has it. No server-side thread
  HTML — the client mounts threads (below).
- **`unifiedRow(row, file)`** (All-files Diff): when `row.type !== 'del' && row.no !==
  undefined`, add `data-file`/`data-line="<no>"` and the `+` button. Thread `file` down from
  `filePanel` (it has `f.file`). Rows stay `.ds-urow`.
- `threadFor` now filters by `(file, line)`; it stays used by `sbsRow` for the Story's
  server-rendered initial threads. All-files threads are client-mounted.

### `src/page-assets.ts` — client: mount threads by (file,line), recognize `.ds-urow`
- Add `mountThreads(container, comments)`: for each comment, find rows in `container` with
  `data-file === c.file && String(data-line) === String(c.line)`; for each, ensure its
  thread (`threadAfter(row)`) contains a `.ds-comment[data-comment-id=c.id]` — insert
  `buildComment(c)` only if absent. **Idempotent**, so it is safe to run over the Story view
  too (won't duplicate server-rendered threads).
- Keep a client copy of the comment list. `refreshComments()`
  ([page-assets.ts:1279](../../../src/page-assets.ts)) already `fetch(API)`s the list — store
  it (e.g. `allComments`) and, after patching, call `mountThreads` on the visible All-files
  panel and the Story container.
- Call `mountThreads` after `loadFull` finishes injecting `/api/fullfile` HTML
  ([page-assets.ts:1161](../../../src/page-assets.ts)), and after `setMode` switches a panel
  to Diff/Full so freshly shown rows get their threads.
- After an add (`buildComposer` submit success), also run `mountThreads` across the other
  visible views (not just `threadAfter(row)` on the authored row) so the new comment
  cross-surfaces immediately. Add/resolve/delete already call `refreshCount`; route them
  through a single `syncComments()` that re-mounts.
- `+` click handler ([page-assets.ts:1351](../../../src/page-assets.ts)) and `openComposer`:
  accept `.ds-urow` in addition to `.ds-row` (`closest(t,'.ds-row,.ds-urow')`). Full-file
  rows are `.ds-row` and already match.
- The composer's POST sends `step` = `data-step` (null/absent for All-files) — the relaxed
  server accepts it.

### `src/server.ts` — no logic change
`POST /api/comments` already calls `addComment(repo, input)`; it now succeeds without a
`step`. Confirm no other code path asserts `step` presence.

### `dist/` — rebuild and commit
Per project rule, every touched `src/` file ships its rebuilt `dist/` counterpart in the
same commit (`npm run build`). Touched: `dist/types.js` (none — types only), `dist/comments.js`,
`dist/render.js`, `dist/page-assets.js`, and `dist/server.js` if it recompiles.

## Commentable-line policy

- **Full-file view:** every line that exists in the current file (`row.comment` / `newNo`
  present) — you are reviewing the whole file, so any line takes a comment.
- **Diff (unified) view:** lines present on the new side (adds + context); pure deletions
  are not commentable (no new-file line to anchor to), matching the Story view.
- **Story view:** unchanged — its existing `commentable` rows.

## Cross-surfacing semantics

- A comment's identity is `(file, line)`. It renders in any view that shows a commentable
  row for that `(file, line)`.
- `mountThreads` idempotency (keyed on `data-comment-id`) guarantees no duplicates when a
  comment is both server-rendered (Story) and client-mounted.
- If the same `(file, line)` is commentable in two Story steps (rare), the thread renders in
  both — acceptable; it is the same line.

## Testing

- **Unit (`comments.ts`):** `addComment` succeeds with no `step` (stored comment has no
  `step` key); still succeeds with `step`; still throws on missing `file`/empty `body`.
- **Render (`render.ts`):** `renderFullFile` emits `data-file`/`data-line`/`.ds-addcomment`
  on a line present in the file; `unifiedRow` emits them for an add/context row and omits
  them for a `del` row; `sbsRow` thread keys by `(file, line)` (a comment with a matching
  file+line but no step still renders). Extend `test/render-page.test.mjs`.
- **Route (`server`/`change-route`):** `POST /api/comments` without `step` returns 201 and
  persists. Extend `test/change-route.test.mjs` (note: it has unrelated in-progress edits —
  add, don't disturb).
- Client `mountThreads` behavior is integration-level; cover what the string builders emit
  and verify manually in a live run.

## Out of scope

- No change to the agent prompts, the `/address-review` flow, or the progress panel.
- No redesign of the comment card or composer UI — only where the `+` appears and how
  threads are located.
- No migration of existing `comments.json` (the `step` key simply becomes optional).
