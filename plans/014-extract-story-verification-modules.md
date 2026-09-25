# 014 — Extract story verification into standalone modules

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Make `verifyLogicMoves` and `filesForStoryCoverage` importable without
pulling in the HTTP server or the view model, so a standalone story checker
(plan 016) can bundle them. No behavior change.

**Architecture:** Move `verifyLogicMoves` and its three private helpers from
`src/server.ts` into a new `src/logic-moves.ts`. Move `filesForStoryCoverage`
from `src/view-model.ts` into `src/coverage.ts`. Both old modules re-export the
moved symbol so every existing import keeps working.

**Tech stack:** TypeScript (`tsc`), Node ≥ 20 ESM, `node --test`.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (finding 1, decision D1).

## Global constraints

- Pure refactor. Function bodies move byte-for-byte; only imports/exports change.
- `dist/` is committed: rebuild with `npm run build` and commit `dist/` with `src/`.
- Git safety rules in `plans/README.md` apply (no checkout/stash/reset/clean/restore).

## Review focus

- A re-export that is accidentally a *copy* (two diverging implementations).
- `server.ts` still defines a now-unused `moveTokens`/`tokenOverlap`/`functionShaped`.
- A circular import between `coverage.ts` and `view-model.ts`.

---

### Task 1: Move `verifyLogicMoves` into `src/logic-moves.ts`

**Files:**
- Create: `src/logic-moves.ts`
- Modify: `src/server.ts` (the block from `function moveTokens(` through the end
  of `export function verifyLogicMoves(…)`, currently ~lines 2719–2846)
- Test: `test/story-modules.test.mjs` (new)

**Interfaces:**
- Produces: `verifyLogicMoves(repo: string, tour: Tour): { errors: string[]; warnings: string[] }`
  exported from `dist/logic-moves.js` **and** still from `dist/server.js`.

- [ ] **Step 1: Write the failing test**

Create `test/story-modules.test.mjs`:

```js
// Standalone story-verification modules: importable without the HTTP server.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('logic-moves exports verifyLogicMoves without loading the server', async () => {
  const mod = await import('../dist/logic-moves.js');
  assert.equal(typeof mod.verifyLogicMoves, 'function');
  const result = mod.verifyLogicMoves('', { version: 3, title: 't', summary: 's', steps: [] });
  assert.deepEqual(result.errors, ['logic moves could not be verified because the repository path is unavailable']);
});

test('server keeps re-exporting the same verifyLogicMoves', async () => {
  const server = await import('../dist/server.js');
  const moves = await import('../dist/logic-moves.js');
  assert.equal(server.verifyLogicMoves, moves.verifyLogicMoves);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run build && node --test test/story-modules.test.mjs`
Expected: FAIL — `Cannot find module '…/dist/logic-moves.js'`.

- [ ] **Step 3: Create `src/logic-moves.ts`**

1. Open `src/server.ts` and find `function moveTokens(text: string): string[] {`.
2. Cut everything from that line through the closing `}` of
   `export function verifyLogicMoves(` (the line `  return { errors, warnings };`
   followed by `}`), including the `/** Verify move claims … */` doc comment.
3. Paste it into the new file `src/logic-moves.ts` under this header:

```ts
// Verifies authored logic-move claims (moved/extracted/inlined) against the
// exact old/new blobs a story names. Standalone so the bundled story checker
// can run it without the HTTP server.
import { readFileRange, readWholeFile } from "./git.js";
import { orderedSteps } from "./tour.js";
import { isCodeStep, type Tour } from "./types.js";

// (pasted: moveTokens, tokenOverlap, functionShaped, verifyLogicMoves)
```

4. Confirm the moved code references only those imports. Run
   `npx tsc --noEmit -p tsconfig.json`. If it reports a missing name, import
   it from the module `src/server.ts` imported it from (check the top of
   `server.ts`). Do not copy any other function.

- [ ] **Step 4: Re-export from `src/server.ts`**

At the top of `src/server.ts`, with the other imports, add:

```ts
import { verifyLogicMoves } from "./logic-moves.js";
```

and immediately after the import block add:

```ts
export { verifyLogicMoves } from "./logic-moves.js";
```

Then confirm nothing else in `server.ts` used the helpers:
`grep -n "moveTokens\|tokenOverlap\|functionShaped" src/server.ts` must print
nothing.

- [ ] **Step 5: Build and run the new and existing move tests**

Run: `npm run build && node --test test/story-modules.test.mjs test/generate-finish.test.mjs`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add src/logic-moves.ts src/server.ts test/story-modules.test.mjs dist/logic-moves.js dist/server.js
git status --short   # only these five paths may be staged
git commit -m "refactor: move logic-move verification into its own module"
```

(The build emits no `.d.ts` or source maps. Never `git add dist/` wholesale — it would sweep in unrelated rebuilt files.)

### Task 2: Move `filesForStoryCoverage` into `src/coverage.ts`

**Files:**
- Modify: `src/coverage.ts`, `src/view-model.ts` (function near line 567)
- Test: `test/story-modules.test.mjs`

**Interfaces:**
- Produces: `filesForStoryCoverage(tour: Tour, files: DiffFile[]): DiffFile[]` from
  `dist/coverage.js`, still re-exported from `dist/view-model.js`.

- [ ] **Step 1: Add the failing test** (append to `test/story-modules.test.mjs`)

```js
test('coverage owns filesForStoryCoverage; view-model re-exports it', async () => {
  const coverage = await import('../dist/coverage.js');
  const viewModel = await import('../dist/view-model.js');
  assert.equal(typeof coverage.filesForStoryCoverage, 'function');
  assert.equal(viewModel.filesForStoryCoverage, coverage.filesForStoryCoverage);
  const files = [{ newPath: 'a.sol' }, { newPath: 'b.ts' }];
  const scoped = { storyScope: { includedFiles: ['a.sol'] } };
  assert.deepEqual(coverage.filesForStoryCoverage(scoped, files).map((f) => f.newPath), ['a.sol']);
  assert.equal(coverage.filesForStoryCoverage({}, files).length, 2);
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npm run build && node --test test/story-modules.test.mjs`
Expected: FAIL — `coverage.filesForStoryCoverage` is `undefined`.

- [ ] **Step 3: Move the function**

Cut this block (doc comment included) from `src/view-model.ts`:

```ts
/** The files a story is measured against. A scoped story only owes an
 *  explanation for its included files, so anything outside the scope is never
 *  "unexplained" — the lazy split and full-file responses must apply the same
 *  filter as the review model or they flag every line of an excluded file. */
export function filesForStoryCoverage(tour: Tour, files: DiffFile[]): DiffFile[] {
  const included = tour.storyScope?.includedFiles;
  if (!included?.length) return files;
  const selected = new Set(included);
  return files.filter((f) => selected.has(f.newPath));
}
```

Paste it at the end of `src/coverage.ts`. `coverage.ts` already imports `Tour`
and `DiffFile` types; if `tsc` says otherwise, add them from `./types.js`.

In `src/view-model.ts`, change the existing coverage import line
`import { computeCoverage } from './coverage.js';` to:

```ts
import { computeCoverage, filesForStoryCoverage } from './coverage.js';
export { filesForStoryCoverage } from './coverage.js';
```

- [ ] **Step 4: Build and run the full suite**

Run: `npm test`
Expected: all tests pass (same count as before plus the 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/coverage.ts src/view-model.ts test/story-modules.test.mjs dist/coverage.js dist/view-model.js
git status --short
git commit -m "refactor: let coverage own the story-scope file filter"
```
