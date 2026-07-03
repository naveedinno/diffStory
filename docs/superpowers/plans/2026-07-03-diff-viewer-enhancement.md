# Diff Viewer Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared diff-rendering engine feeding every diff surface, plus viewed-file tracking, a Split view in All-files, expand-context at hunk gaps, and a both-pages visual unification — per the approved spec `docs/superpowers/specs/2026-07-03-diff-viewer-enhancement-design.md`.

**Architecture:** Server-rendered, zero-dependency Node app. `src/render.ts` builds the review page from view-models in `src/view-model.ts`; inline CSS/JS live as exported strings in `src/page-assets.ts`; `src/server.ts` serves lazy HTML fragments. We extract shared row renderers into a new `src/diff-render.ts`, split diff CSS/JS into `src/diff-assets.ts` (composed back into the same one-IIFE `PAGE_JS`), add two lazy endpoints (`/api/diff/split`, `/api/diff/context`), and introduce `src/theme.ts` shared tokens.

**Tech Stack:** TypeScript (ESM, `tsc` build to `dist/`), Node ≥20 built-ins only, `node --test` + `node:assert/strict` tests importing from `../dist/`.

**Plan deviation from spec (discovered while planning):** the spec said `renderDiffFullBody` moves into the shared module. Investigation shows it is *transitively dead*: its only caller is `/api/diff/fullfile`, which no live client code fetches (only the dead `diffViewScript` did). So Task 1 deletes all of `diff-view.ts`, the endpoint, and its server helper — even cleaner than the spec's aim.

**Scope note (expand context):** gaps become interactive in the **All-files tab** (unified + split). Story-step diffs keep inert `⋯` gaps: their viewport is storyteller-framed, and the step's Full-file mode already covers "show me more". This honors the spec's layout requirement (works in unified and split) on the surface where reading happens.

## Global Constraints

- Zero runtime dependencies; Node ≥ 20; ESM (`"type": "module"`).
- `PAGE_JS`/`DIFF_JS` strings must contain **no backticks and no `${}`** (they are embedded in template literals).
- All HTML is escaped server-side; client JS only sets `textContent`, builds nodes, or injects server-escaped fragments.
- Every commit that touches `src/` must include a rebuilt `dist/` (`npm run build`, then `git add dist`). GitHub installs have no build step.
- The working tree has **unrelated in-progress changes** (`src/repo-setup.ts`, `src/page-assets.ts` hunk about skills, `test/repo-setup.test.mjs`, `test/app-server.test.mjs`, matching `dist/` files). Always `git add` **explicit paths**, never `-A`/`.`. If a file you must edit already has unrelated modifications (`page-assets`, `app-server.test`), commit only your hunks via explicit `git add` of the file *after confirming with `git diff` that the unrelated hunks are yours to keep out* — if that is not cleanly possible, stop and ask the user to commit/stash their work first.
- Run tests with `npm test` (it builds first). For a single file: `npm run build && node --test test/<file>.test.mjs`.
- UI follows Apple HIG: SF system font stack, system grays, system blue accent, subtle hairlines and materials.

---

### Task 1: Delete the dead dv-* viewer and its endpoint

**Files:**
- Delete: `src/diff-view.ts`, `dist/diff-view.js` (and `.d.ts`/map if present)
- Modify: `src/server.ts` (route at ~line 297, import at line 29, `renderDiffFullFileResponse` at ~line 595)
- Modify: `test/intra-line-render.test.mjs` (drop the diff-view test + import)
- Test: `test/app-server.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: a codebase where the only diff renderers are in `src/render.ts` (Task 2 extracts from there). `/api/diff/fullfile` returns 404.

- [ ] **Step 1: Write the failing test**

Append to `test/app-server.test.mjs` (inside a new test at the end of the file, reusing the existing `gitRepo()` and `boot()` helpers):

```js
test('the dead /api/diff/fullfile endpoint is gone', async () => {
  const repo = gitRepo();
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    const res = await fetch(`${base}/api/diff/fullfile?file=README.md`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run build && node --test test/app-server.test.mjs`
Expected: the new test FAILS (endpoint currently answers 200 with HTML).

- [ ] **Step 3: Delete the dead code**

1. Delete `src/diff-view.ts`.
2. In `src/server.ts`: remove `import { renderDiffFullBody } from './diff-view.js';` (line 29), remove the route block:
   ```ts
   if (method === 'GET' && url.pathname === '/api/diff/fullfile') {
     return sendHtml(res, renderDiffFullFileResponse(session, url.searchParams.get('file') ?? ''));
   }
   ```
   and remove the whole `renderDiffFullFileResponse` function (~line 595, including its doc comment).
3. In `test/intra-line-render.test.mjs`: remove `import { renderDiffFullBody } from '../dist/diff-view.js';` and the test `'unified viewer (diff-view.ts rowHtml) marks only the changed token'`. Keep every other test.
4. Remove stale build artifacts: `rm -f dist/diff-view.js dist/diff-view.d.ts`.

- [ ] **Step 4: Run the full suite to verify green**

Run: `npm test`
Expected: PASS, including the new 404 test. Also verify no stragglers: `grep -rn "diff-view\|renderDiffFullBody\|dv-" src/ test/ --include="*.ts" --include="*.mjs"` → only the `change-page.test.mjs` assertion `!html.includes('class="dv-file"')` may remain (it asserts absence; keep it).

- [ ] **Step 5: Commit (with rebuilt dist)**

```bash
npm run build
git add src/diff-view.ts src/server.ts test/intra-line-render.test.mjs test/app-server.test.mjs dist
git commit -m "refactor: delete the dead dv-* diff viewer and its /api/diff/fullfile endpoint"
```

---

### Task 2: Extract the shared diff engine `src/diff-render.ts`

**Files:**
- Create: `src/diff-render.ts`
- Modify: `src/render.ts` (functions `targetAttrs`/`rowAttrs`/`CommentTarget` at lines 53–73, `sbsRow` ~772–790, `cell` ~805–836, `singleCell` ~838–848, `unifiedRow` ~965–982, `fullRow` ~1072–1088, both `ds-hunkgap` literals at ~729 and ~931)
- Test: `test/diff-render.test.mjs` (new)

**Interfaces:**
- Consumes: `SbsRow`, `UnifiedRow` from `src/view-model.ts`; `highlight` from `src/highlight.ts`; `IntraSides` from `src/intra-line.ts`.
- Produces (used by Tasks 5, 6 and by `render.ts`):
  ```ts
  export type RowSide = 'left' | 'right';
  export interface RowTarget { side: RowSide; file: string; line: number }
  export function esc(s: string): string
  export function targetAttrs(target?: RowTarget): string
  export function rowAttrs(target?: RowTarget, step?: string): string
  export interface SplitRowOpts {
    leftTarget?: RowTarget; rightTarget?: RowTarget;
    stepId?: string; focusIndex?: number | null;
    single?: boolean; sides?: IntraSides;
  }
  export function renderSplitRow(row: SbsRow, opts?: SplitRowOpts): string
  export function renderUnifiedRow(row: UnifiedRow, target?: RowTarget, intra?: string): string
  export interface GapInfo { file: string; from: number; to: number | 'eof' }
  export function renderHunkGap(gap?: GapInfo): string
  ```

**CRITICAL invariant:** the produced HTML must be byte-identical to today's output for every existing surface. The whole existing test suite is the golden gate; the new unit tests pin the exact strings.

- [ ] **Step 1: Write the failing tests**

Create `test/diff-render.test.mjs`:

```js
// Unit tests for the shared diff-row renderer. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderUnifiedRow, renderSplitRow, renderHunkGap, rowAttrs, targetAttrs } from '../dist/diff-render.js';

test('unified add row carries anchors, sign, and tint class', () => {
  const html = renderUnifiedRow(
    { type: 'add', no: 3, content: 'const x = 1;' },
    { side: 'right', file: 'a.ts', line: 3 },
  );
  assert.match(html, /^<div class="ds-urow ds-row-add" data-file="a\.ts" data-line="3" data-side="right">/);
  assert.match(html, /<span class="ds-no">3<\/span>/);
  assert.match(html, /<span class="ds-sign ds-sign-add">\+<\/span>/);
  assert.match(html, /data-comment-file="a\.ts" data-comment-line="3"/);
});

test('unified untoured row is flagged UNEXPLAINED', () => {
  const html = renderUnifiedRow({ type: 'add', no: 1, content: 'x', untoured: true });
  assert.match(html, /is-untoured/);
  assert.match(html, /UNEXPLAINED/);
});

test('split ctx row renders both cells with line numbers', () => {
  const html = renderSplitRow(
    { type: 'ctx', oldNo: 4, newNo: 5, content: 'same' },
    {
      leftTarget: { side: 'left', file: 'a.ts', line: 4 },
      rightTarget: { side: 'right', file: 'a.ts', line: 5 },
    },
  );
  assert.match(html, /^<div class="ds-row ds-row-ctx" data-file="a\.ts" data-line="5" data-side="right">/);
  assert.match(html, /ds-cell-l/);
  assert.match(html, /ds-celldiv/);
  assert.match(html, /ds-cell-r/);
});

test('split add row leaves the left cell empty and tints the right', () => {
  const html = renderSplitRow(
    { type: 'add', newNo: 9, content: 'added' },
    { rightTarget: { side: 'right', file: 'b.ts', line: 9 } },
  );
  assert.match(html, /ds-cell-empty ds-cell-l/);
  assert.match(html, /ds-cell-add/);
});

test('single-cell mode (context/new-file steps) renders one cell', () => {
  const html = renderSplitRow(
    { type: 'add', newNo: 1, content: 'new' },
    { rightTarget: { side: 'right', file: 'c.ts', line: 1 }, single: true },
  );
  assert.match(html, /ds-cell-single/);
  assert.doesNotMatch(html, /ds-celldiv/);
});

test('focus index is emitted only when set', () => {
  const withFocus = renderSplitRow({ type: 'ctx', oldNo: 1, newNo: 1, content: 'x' }, { focusIndex: 2 });
  const without = renderSplitRow({ type: 'ctx', oldNo: 1, newNo: 1, content: 'x' }, { focusIndex: null });
  assert.match(withFocus, /data-step-focus="2"/);
  assert.doesNotMatch(without, /data-step-focus/);
});

test('bare hunk gap matches the legacy markup exactly', () => {
  assert.equal(renderHunkGap(), '<div class="ds-hunkgap"><span>⋯</span></div>');
});

test('attrs helpers escape file paths', () => {
  assert.match(rowAttrs({ side: 'right', file: 'a"b.ts', line: 1 }), /data-file="a&quot;b\.ts"/);
  assert.match(targetAttrs({ side: 'left', file: '<x>.ts', line: 2 }), /data-comment-file="&lt;x&gt;\.ts"/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build 2>&1 | head -5; node --test test/diff-render.test.mjs`
Expected: build fails or tests fail with "Cannot find module '../dist/diff-render.js'".

- [ ] **Step 3: Create `src/diff-render.ts`**

Move the bodies **verbatim** from `render.ts` (do not retype logic — copy, then adapt only the parameter plumbing):

```ts
// Shared diff-row rendering — the ONE place that turns view-model rows into
// HTML. Consumed by the story-step renderer, the All-files panels, the
// full-file endpoint, and the expand-context endpoint, so every surface
// draws rows identically. Pure functions; all content is escaped here.
import { highlight } from './highlight.js';
import type { IntraSides } from './intra-line.js';
import type { SbsRow, UnifiedRow } from './view-model.js';

export type RowSide = 'left' | 'right';
export interface RowTarget { side: RowSide; file: string; line: number }

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function targetAttrs(target?: RowTarget): string {
  return target
    ? ` data-comment-code="1" data-comment-side="${target.side}" data-comment-file="${esc(
        target.file,
      )}" data-comment-line="${target.line}"`
    : '';
}

export function rowAttrs(target?: RowTarget, step?: string): string {
  return target
    ? ` data-file="${esc(target.file)}" data-line="${target.line}" data-side="${target.side}"${
        step ? ` data-step="${esc(step)}"` : ''
      }`
    : '';
}

/** One side of a split row. Copied verbatim from render.ts cell(). */
function cell(side: RowSide, row: SbsRow, target?: RowTarget, intra?: string): string {
  const add = row.type === 'add';
  const del = row.type === 'del';
  const sideCls = side === 'left' ? ' ds-cell-l' : ' ds-cell-r';
  // An add has no left counterpart; a del has no right counterpart.
  if ((side === 'left' && add) || (side === 'right' && del)) {
    return `<span class="ds-cell ds-cell-empty${sideCls}"></span>`;
  }
  let no = '';
  let sign = '';
  let signClass = '';
  if (side === 'left') {
    no = row.oldNo !== undefined ? String(row.oldNo) : '';
    if (del) {
      sign = '−';
      signClass = ' ds-sign-del';
    }
  } else {
    no = row.newNo !== undefined ? String(row.newNo) : '';
    if (add) {
      sign = '+';
      signClass = ' ds-sign-add';
    }
  }
  let tint = '';
  if (side === 'right' && add) tint = row.untoured ? ' ds-cell-untoured' : ' ds-cell-add';
  else if (side === 'left' && del) tint = ' ds-cell-del';
  const flag = side === 'right' && add && row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
  return `<span class="ds-cell${tint}${sideCls}"><span class="ds-no">${no}</span><span class="ds-sign${signClass}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${
    (intra ?? highlight(row.content)) || ' '
  }</span>${flag}</span>`;
}

/** Context/new-file steps render one full-width cell. Verbatim from singleCell()
 *  — note it deliberately takes no intra (single-cell rows never word-diff). */
function singleCell(row: SbsRow, target?: RowTarget): string {
  const no = row.newNo ?? row.oldNo ?? '';
  const add = row.type === 'add';
  const sign = add ? '+' : '';
  const signCls = add ? ' ds-sign-add' : '';
  const tint = add ? (row.untoured ? ' ds-cell-untoured' : ' ds-cell-add') : '';
  const flag = add && row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
  return `<span class="ds-cell ds-cell-single${tint}"><span class="ds-no">${no}</span><span class="ds-sign${signCls}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${
    highlight(row.content) || ' '
  }</span>${flag}</span>`;
}

export interface SplitRowOpts {
  leftTarget?: RowTarget;
  rightTarget?: RowTarget;
  stepId?: string;
  /** Emit data-step-focus when a number; null/undefined omits it. */
  focusIndex?: number | null;
  /** Render the single-cell layout (context / new-file steps). */
  single?: boolean;
  sides?: IntraSides;
}

export function renderSplitRow(row: SbsRow, opts: SplitRowOpts = {}): string {
  const primaryTarget = opts.rightTarget ?? opts.leftTarget;
  const attrs = rowAttrs(primaryTarget, primaryTarget ? opts.stepId : undefined);
  const focusAttr =
    opts.focusIndex === null || opts.focusIndex === undefined ? '' : ` data-step-focus="${opts.focusIndex}"`;
  const cells = opts.single
    ? singleCell(row, opts.rightTarget)
    : `${cell('left', row, opts.leftTarget, opts.sides?.left)}<span class="ds-celldiv"></span>${cell(
        'right', row, opts.rightTarget, opts.sides?.right,
      )}`;
  return `<div class="ds-row ds-row-${row.type}"${attrs}${focusAttr}>${cells}</div>`;
}

export function renderUnifiedRow(row: UnifiedRow, target?: RowTarget, intra?: string): string {
  const sign = row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' ';
  const flag = row.untoured ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';
  const attrs = rowAttrs(target);
  return `<div class="ds-urow ds-row-${row.type}${row.untoured ? ' is-untoured' : ''}"${attrs}><span class="ds-no">${
    row.no ?? ''
  }</span><span class="ds-sign ds-sign-${row.type}">${sign}</span><span class="ds-code"${targetAttrs(target)}>${
    (intra ?? highlight(row.content)) || ' '
  }</span>${flag}</div>`;
}

export interface GapInfo { file: string; from: number; to: number | 'eof' }

/** The ⋯ separator between hunks. Bare (no gap info) matches the legacy markup;
 *  Task 6 passes GapInfo to make it expandable. */
export function renderHunkGap(gap?: GapInfo): string {
  if (!gap) return `<div class="ds-hunkgap"><span>⋯</span></div>`;
  // Task 6 fills this branch in; until then it is unreachable.
  return `<div class="ds-hunkgap"><span>⋯</span></div>`;
}
```

- [ ] **Step 4: Rewire `render.ts` onto the shared module**

1. Add import: `import { renderSplitRow, renderUnifiedRow, renderHunkGap, rowAttrs, targetAttrs, type RowTarget } from './diff-render.js';`
2. Delete from `render.ts`: `type CommentTarget` (line 53), `targetAttrs` (59–65), `rowAttrs` (67–73), `cell` (805–836), `singleCell` (838–848). Replace every remaining `CommentTarget` type reference with `RowTarget` (it is used by `threadForTargets` and the target-builder code — `commentSide` comparisons still work since `RowSide` is the same union).
3. Rewrite `sbsRow` to delegate (behavior identical):
   ```ts
   function sbsRow(row: SbsRow, s: StepView, comments: Comment[], blockIndex: number, intra?: Map<SbsRow, IntraSides>): string {
     const leftTarget =
       !s.context && !s.newFile && row.oldNo !== undefined
         ? { side: 'left' as const, file: s.oldFile, line: row.oldNo }
         : undefined;
     const rightTarget =
       row.newNo !== undefined ? { side: 'right' as const, file: s.file, line: row.newNo } : undefined;
     const rowHtml = renderSplitRow(row, {
       leftTarget,
       rightTarget,
       stepId: s.id,
       focusIndex: rowVoiceFocusIndex(row, s, blockIndex),
       single: s.context || s.newFile,
       sides: intra?.get(row),
     });
     return rowHtml + threadForTargets([leftTarget, rightTarget], comments);
   }
   ```
   **Watch out:** the old `singleCell` call passed `rightTarget` only — `renderSplitRow`'s `single` branch does the same. The old single-cell path also ignored intra — preserved because `singleCell` takes no intra.
4. Rewrite `unifiedRow` as a thin wrapper:
   ```ts
   function unifiedRow(row: UnifiedRow, file: string, oldFile = file, intra?: string): string {
     const target =
       row.no === undefined
         ? undefined
         : {
             side: row.type === 'del' ? ('left' as const) : ('right' as const),
             file: row.type === 'del' ? oldFile : file,
             line: row.no,
           };
     return renderUnifiedRow(row, target, intra);
   }
   ```
5. Rewrite `fullRow` to delegate:
   ```ts
   function fullRow(row: SbsRow, opts: { file: string; oldFile?: string; newFile: boolean }, intra?: Map<SbsRow, IntraSides>): string {
     const leftTarget =
       !opts.newFile && row.oldNo !== undefined
         ? { side: 'left' as const, file: opts.oldFile ?? opts.file, line: row.oldNo }
         : undefined;
     const rightTarget =
       row.newNo !== undefined ? { side: 'right' as const, file: opts.file, line: row.newNo } : undefined;
     return renderSplitRow(row, { leftTarget, rightTarget, sides: intra?.get(row) });
   }
   ```
   **Watch out:** old `fullRow` emitted no `data-step-focus` and no `data-step`; `renderSplitRow` omits both when `stepId`/`focusIndex` are undefined — verify in the diff of rendered output (Step 5).
6. Replace both hunk-gap literals (`` `<div class="ds-hunkgap"><span>⋯</span></div>` `` at ~729 and ~931) with `renderHunkGap()`.

- [ ] **Step 5: Verify byte-identical output and green suite**

Run: `npm test`
Expected: ALL tests pass — `render-page.test.mjs`, `intra-line-render.test.mjs`, `comments-render.test.mjs` are the golden gate, plus the new `diff-render.test.mjs`.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/diff-render.ts src/render.ts test/diff-render.test.mjs dist
git commit -m "refactor: extract shared diff-row engine into diff-render.ts"
```

---

### Task 3: Split diff CSS/JS into `src/diff-assets.ts`

**Files:**
- Create: `src/diff-assets.ts`
- Modify: `src/page-assets.ts`
- Test: `test/diff-client.test.mjs` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```ts
  // src/diff-assets.ts
  export const DIFF_CSS: string  // diff-surface rules, appended to PAGE_CSS
  export const DIFF_JS: string   // function declarations spliced INSIDE the page IIFE
  ```
  `page-assets.ts` keeps exporting `PAGE_CSS`/`PAGE_JS` with identical composed content, so `render.ts` and all existing regex tests are untouched.

**Mechanism:** `PAGE_JS` is one IIFE. `DIFF_JS` holds *function declarations only* (they hoist), spliced into the IIFE between two halves of the existing string. Closure variables (`filePanels`, `selectedFile`, `$`, `$all`, `closest`, `mountThreads`, …) keep resolving because everything stays inside the same IIFE.

- [ ] **Step 1: Write the failing test**

Create `test/diff-client.test.mjs`:

```js
// The diff-surface client assets stay composed into the one page IIFE. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFF_CSS, DIFF_JS } from '../dist/diff-assets.js';
import { PAGE_CSS, PAGE_JS } from '../dist/page-assets.js';

test('diff-assets exports the diff client functions', () => {
  assert.match(DIFF_JS, /function setMode\(/);
  assert.match(DIFF_JS, /function loadFull\(/);
  assert.match(DIFF_JS, /function updateChangeNav\(/);
  assert.match(DIFF_JS, /function handleChangeShortcut\(/);
});

test('diff assets are composed back into the page assets', () => {
  assert.ok(PAGE_JS.includes(DIFF_JS), 'DIFF_JS is spliced into PAGE_JS');
  assert.ok(PAGE_CSS.includes(DIFF_CSS), 'DIFF_CSS is appended to PAGE_CSS');
  assert.match(PAGE_JS, /^\s*\(function\(\)\{/, 'still one IIFE');
});

test('diff CSS moved out of page-assets core', () => {
  assert.match(DIFF_CSS, /\.ds-row\b/);
  assert.match(DIFF_CSS, /\.ds-hunkgap\b/);
  assert.match(DIFF_CSS, /\.ds-modetoggle\b/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build 2>&1 | head -3; node --test test/diff-client.test.mjs`
Expected: FAIL — `dist/diff-assets.js` does not exist.

- [ ] **Step 3: Create `src/diff-assets.ts` and move the code**

1. Create the file with this shape:
   ```ts
   // Inlined CSS + client JS for the diff surfaces (rows, gutters, toggles,
   // change-jump). Same rules as page-assets.ts: plain strings, no backticks,
   // no ${} in the JS. DIFF_JS is function declarations only — page-assets
   // splices it INSIDE the page IIFE, so these share its closure scope.
   export const DIFF_CSS = `
   ...moved CSS rules...
   `;

   export const DIFF_JS = `
   ...moved function declarations...
   `;
   ```
2. **CSS to move** (cut each rule block from `PAGE_CSS` verbatim; find with `grep -n` in `src/page-assets.ts`): every rule whose selector contains `.ds-diffscroll`, `.ds-diff` (the diff container, *not* `.ds-diffhead`-unrelated chrome), `.ds-difftoolbar`, `.ds-difthint`, `.ds-modetoggle`, `.ds-diffhead`, `.ds-diffbody`, `.ds-diffnote`, `.ds-row`, `.ds-cell`, `.ds-celldiv`, `.ds-no`, `.ds-sign`, `.ds-code`, `.ds-urow`, `.ds-hunkgap`, `.ds-untoured`, `.ds-changejump`, `.ds-changebtn`, `.ds-changecount`, `.is-change-jump`, `.tk-` (syntax token colors), `.changed` (intra-line marks), `body.ds-resizing`, `body.ds-selecting-left`, `body.ds-selecting-right`. Do **not** move `.ds-filepanel*`, `.ds-fileitem*`, `.ds-rail*` (page chrome).
3. **JS to move**: the contiguous block `src/page-assets.ts:1515–1608` — `visibleDiffRoot`, `changeRows`, `updateChangeNav`, `jumpToChange`, `jumpRelativeChange`, `jumpToFirstChange`, `activeChangeHolder`, `handleChangeShortcut`, `setMode`, `loadFull`. (`selectFile`/`selectFileByPath` at 1498–1513 stay in page-assets — they are file-list navigation.)
4. Recompose in `src/page-assets.ts`:
   ```ts
   import { DIFF_CSS, DIFF_JS } from './diff-assets.js';

   const PAGE_CSS_CORE = ` ...existing CSS minus the moved rules... `;
   export const PAGE_CSS = PAGE_CSS_CORE + DIFF_CSS;

   const PAGE_JS_HEAD = `
   (function(){
     ...everything before line 1515...
   `;
   const PAGE_JS_TAIL = `
     ...everything from line 1610 (openDrawer) to the end, including the
     init() wiring and the closing })();
   `;
   export const PAGE_JS = PAGE_JS_HEAD + DIFF_JS + PAGE_JS_TAIL;
   ```
   **Watch out:** the head/tail literals must not end/start mid-statement — cut exactly at the blank lines around the moved block. Keep `toggleVoicePause` (ends line 1496) in the head; keep `openDrawer` (1610) in the tail.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — especially `comments-client.test.mjs` (regexes over the composed `PAGE_JS`) and `render-page.test.mjs`. If a regex fails, a moved boundary swallowed a neighbor function — re-check the cut points.

- [ ] **Step 5: Smoke-test the composed page in a browser**

Run: `npm run demo` (builds a sample change and opens the review page).
Verify: All-files tab renders diffs; Diff/Full-file toggle works; n/p jumps between changes; no console errors. Close the server (Ctrl-C) after.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/diff-assets.ts src/page-assets.ts test/diff-client.test.mjs dist
git commit -m "refactor: split diff CSS/JS into diff-assets.ts, composed into the same page IIFE"
```

---

### Task 4: Viewed-file tracking

**Files:**
- Modify: `src/render.ts` (`railFileItem` ~616, files readhead ~288–293, `<body>` attrs line 132)
- Modify: `src/diff-assets.ts` (new JS + CSS)
- Modify: `src/page-assets.ts` (onClick dispatch ~2144, onKey ~2176, init ~2255)
- Test: `test/render-page.test.mjs` (markup), `test/diff-client.test.mjs` (client)

**Interfaces:**
- Consumes: `fileItems`, `filePanels`, `selectedFile`, `$`, `$all`, `closest` (page IIFE closure).
- Produces: DOM contract — `body[data-viewed-scope]`, `.ds-fileitem [data-viewed-toggle]`, `[data-viewed-progress]`; storage key `'ds-viewed:' + scope`; JS functions `loadViewed()`, `toggleViewed(file)`, `syncViewed()`.

- [ ] **Step 1: Write the failing tests**

Append to `test/render-page.test.mjs` (reuse its existing `tour`/`files` fixtures and however it calls `renderPage` — match the existing test bodies):

```js
test('sidebar file items carry a viewed toggle and the body a scope key', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /data-viewed-scope="/);
  assert.match(html, /data-viewed-toggle/);
  assert.match(html, /data-viewed-progress/);
});
```

(`tour` and `files` are the fixtures already defined at the top of `test/render-page.test.mjs` — this matches every other test in the file.)

Append to `test/diff-client.test.mjs`:

```js
test('viewed-file tracking is wired: storage, toggle, v key', () => {
  assert.match(DIFF_JS, /function toggleViewed\(/);
  assert.match(DIFF_JS, /function syncViewed\(/);
  assert.match(DIFF_JS, /'ds-viewed:'/);
  assert.match(PAGE_JS, /data-viewed-toggle/);
  assert.match(PAGE_JS, /e\.key==='v'\|\|e\.key==='V'/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && node --test test/render-page.test.mjs test/diff-client.test.mjs`
Expected: the two new tests FAIL.

- [ ] **Step 3: Server-side markup (`render.ts`)**

1. Body tag (line 132) — add the scope key (values available in `renderPage`: `repo`, `baseLabel`, `headRef`):
   ```ts
   <body${storyless ? ' data-storyless="1"' : ''} data-viewed-scope="${esc(`${repo}|${baseLabel}|${headRef ?? 'worktree'}`)}">
   ```
2. `railFileItem` — inside the `<button class="ds-fileitem">`, after the stat span, append:
   ```ts
   <span class="ds-viewedmark" data-viewed-toggle role="checkbox" aria-checked="false" title="Mark as viewed (v)">✓</span>
   ```
3. Files readhead (~line 288) — give the count span the hook:
   ```html
   <span class="ds-readhead-count" data-viewed-progress>${model.files.length} ${plural(model.files.length, 'file')}</span>
   ```

- [ ] **Step 4: Client JS (append to `DIFF_JS`) and CSS (append to `DIFF_CSS`)**

JS (function declarations, same style — no backticks/`${}`):

```js
  function viewedKey(){return 'ds-viewed:'+(document.body.getAttribute('data-viewed-scope')||'');}
  var viewedFiles={};
  function loadViewed(){
    viewedFiles={};
    try{(JSON.parse(localStorage.getItem(viewedKey())||'[]')||[]).forEach(function(f){viewedFiles[f]=true;});}catch(e){}
  }
  function saveViewed(){try{localStorage.setItem(viewedKey(),JSON.stringify(Object.keys(viewedFiles)));}catch(e){}}
  function toggleViewed(file){
    if(!file)return;
    if(viewedFiles[file])delete viewedFiles[file];else viewedFiles[file]=true;
    saveViewed();syncViewed();
  }
  function syncViewed(){
    var n=0,total=0;
    fileItems.forEach(function(it){
      var f=it.getAttribute('data-goto-file');if(!f)return;
      total++;
      var on=!!viewedFiles[f];if(on)n++;
      it.classList.toggle('is-viewed',on);
      var mark=$('[data-viewed-toggle]',it);if(mark)mark.setAttribute('aria-checked',on?'true':'false');
    });
    var prog=$('[data-viewed-progress]');
    if(prog)prog.textContent=n?(n+' of '+total+' viewed'):(total+' '+(total===1?'file':'files'));
  }
```

CSS:

```css
.ds-viewedmark{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:6px;border-radius:50%;border:1px solid var(--line);color:transparent;font-size:10px;line-height:1;transition:background .15s ease,border-color .15s ease,color .15s ease}
.ds-viewedmark:hover{border-color:var(--accent)}
.ds-viewedmark[aria-checked="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ds-fileitem.is-viewed .ds-fileitem-path,.ds-fileitem.is-viewed .ds-fileitem-stat{opacity:.55}
```

- [ ] **Step 5: Wiring in `page-assets.ts`**

1. onClick dispatch — **before** the `.ds-fileitem` line (~2144: `b=closest(t,'.ds-fileitem');if(b){...}`), insert:
   ```js
   b=closest(t,'[data-viewed-toggle]');if(b){var vi=closest(b,'.ds-fileitem');if(vi)toggleViewed(vi.getAttribute('data-goto-file'));return;}
   ```
   (Order matters — the toggle sits inside the fileitem button; returning first prevents file navigation on toggle click.)
2. onKey (~2176, next to the j/k block) — add:
   ```js
   if((e.key==='v'||e.key==='V')&&!isTextEntryTarget(e.target)&&filesView&&!filesView.hidden){
     var vp=filePanels[selectedFile];
     if(vp){toggleViewed(vp.getAttribute('data-file'));e.preventDefault();return;}
   }
   ```
3. `init()` (~2255, near `refreshCount()`) — add `loadViewed();syncViewed();`.

- [ ] **Step 6: Run the suite, then verify in the browser**

Run: `npm test` → all PASS.
Run: `npm run demo` → All-files: click a checkmark (fills, sidebar row dims, "1 of N viewed"), press `v` (toggles selected file), reload page (marks persist). Ctrl-C.

- [ ] **Step 7: Commit**

```bash
npm run build
git add src/render.ts src/diff-assets.ts src/page-assets.ts test/render-page.test.mjs test/diff-client.test.mjs dist
git commit -m "feat: viewed-file tracking with checkmarks, v shortcut, and progress count"
```

---

### Task 5: Split view in All-files

**Files:**
- Modify: `src/view-model.ts` (new export `hunksToSbsBlocks`)
- Modify: `src/render.ts` (`filePanel` ~910–963, extract `splitHead` from `renderFullFile` ~1052–1070, new export `renderSplitHunks`)
- Modify: `src/server.ts` (new route + `renderSplitResponse`, mirroring `renderFullFileResponse` at ~561)
- Modify: `src/diff-assets.ts` (`setMode` split branch, `loadSplit`, mode persistence), `src/page-assets.ts` (`selectFile` applies stored mode)
- Test: `test/view-model.test.mjs`, `test/app-server.test.mjs`, `test/diff-client.test.mjs`

**Interfaces:**
- Consumes: `renderSplitRow` (Task 2), `toSbs` (view-model internal), session scope handling in `server.ts`.
- Produces:
  ```ts
  // view-model.ts
  export function hunksToSbsBlocks(file: DiffFile, uncoveredRanges: Array<[number, number]>): SbsRow[][]
  // render.ts
  export function renderSplitHunks(blocks: SbsRow[][], opts: { file: string; oldFile?: string; newFile: boolean }): string
  ```
  HTTP: `GET /api/diff/split?file=<path>` → HTML fragment (`ds-diffhead` + blocks with `ds-hunkgap` separators).
  DOM: `[data-split-inner]` per file panel; localStorage `ds-files-mode` ∈ `diff|split|full`.

- [ ] **Step 1: Write the failing tests**

`test/view-model.test.mjs` (append; mirror the file's existing fixtures style):

```js
test('hunksToSbsBlocks maps hunks to split rows and flags uncovered adds', () => {
  const file = {
    oldPath: 'a.ts', newPath: 'a.ts', status: 'modified',
    hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2,
      lines: [
        { type: 'ctx', content: 'keep', oldNo: 1, newNo: 1 },
        { type: 'add', content: 'new line', newNo: 2 },
      ] }],
  };
  const blocks = hunksToSbsBlocks(file, [[2, 2]]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].length, 2);
  assert.equal(blocks[0][0].type, 'ctx');
  assert.equal(blocks[0][1].untoured, true);
});
```

`test/app-server.test.mjs` (append; reuse `gitRepo`/`boot` and the open-repo pattern from Task 1's test):

```js
test('/api/diff/split serves side-by-side hunks for a changed file', async () => {
  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# hi\nsplit me\n');
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    const res = await fetch(`${base}/api/diff/split?file=README.md`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /ds-diffhead/);
    assert.match(html, /ds-celldiv/);
    assert.match(html, /split me/);
    const miss = await fetch(`${base}/api/diff/split?file=nope.md`);
    assert.match(await miss.text(), /isn't part of this change/);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});
```

`test/diff-client.test.mjs` (append):

```js
test('split mode is lazy-loaded and persisted', () => {
  assert.match(DIFF_JS, /function loadSplit\(/);
  assert.match(DIFF_JS, /'ds-files-mode'/);
  assert.match(DIFF_JS, /\/api\/diff\/split\?file=/);
  assert.match(PAGE_JS, /function applyFilesMode\(/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build 2>&1 | head -3; node --test test/view-model.test.mjs test/app-server.test.mjs test/diff-client.test.mjs`
Expected: new tests FAIL (missing export / 404 / missing functions).

- [ ] **Step 3: view-model — `hunksToSbsBlocks`**

Add to `src/view-model.ts` (near `buildFullFileRows`):

```ts
/** Split-layout blocks for one file's hunks (the All-files Split view):
 *  each hunk becomes a block of SbsRows, adds flagged when uncovered. */
export function hunksToSbsBlocks(
  file: DiffFile,
  uncoveredRanges: Array<[number, number]>,
): SbsRow[][] {
  const untoured = (n?: number) =>
    n !== undefined && uncoveredRanges.some((r) => n >= r[0] && n <= r[1]);
  return file.hunks.map((h) =>
    h.lines.map((l) => {
      const row = toSbs(l);
      if (l.type === 'add' && untoured(l.newNo)) row.untoured = true;
      return row;
    }),
  );
}
```

- [ ] **Step 4: render — `splitHead` + `renderSplitHunks`**

In `src/render.ts`: extract the head block of `renderFullFile` (lines 1056–1066) into a helper and reuse it:

```ts
function splitHead(opts: { file: string; oldFile?: string; newFile: boolean }): string {
  const leftLabel = opts.newFile ? 'Did not exist' : 'Before';
  const rightLabel = opts.newFile ? 'New file' : 'After';
  return `<div class="ds-diffhead">
    <span class="ds-diffhead-side ds-diffhead-side-l"><span class="ds-diffhead-label${
      opts.newFile ? ' ds-dim' : ''
    }">${leftLabel}</span>${opts.newFile ? '' : `<span class="ds-diffhead-path">${esc(opts.oldFile ?? opts.file)}</span>`}</span>
    <span class="ds-diffhead-divider"></span>
    <span class="ds-diffhead-side ds-diffhead-side-r"><span class="ds-diffhead-label${
      opts.newFile ? ' ds-green' : ''
    }">${rightLabel}</span><span class="ds-diffhead-path">${esc(opts.file)}</span></span>
  </div>`;
}

/** The lazily-loaded Split view for one All-files panel: hunks only,
 *  side-by-side, ⋯ gaps between hunks (expandable after Task 6). */
export function renderSplitHunks(
  blocks: SbsRow[][],
  opts: { file: string; oldFile?: string; newFile: boolean },
): string {
  if (!blocks.length) return `<div class="ds-diffnote">No diff to show.</div>`;
  const body = blocks
    .map((block, bi) => {
      const intra = intraLineMap(block, (r) => r.type, (r) => r.content);
      return (
        (bi > 0 ? renderHunkGap() : '') +
        block.map((row) => fullRow(row, opts, intra)).join('')
      );
    })
    .join('');
  return `${splitHead(opts)}<div class="ds-diffbody">${body}</div>`;
}
```

Update `renderFullFile` to call `splitHead(opts)` instead of its inline head.

In `filePanel` (~940): rename the toggle labels and add Split + the lazy container. Replace the current `toggle` construction and body with:

```ts
const toggle = f.hasFull
  ? `<div class="ds-modetoggle"><button data-mode="diff">Unified</button><button data-mode="split">Split</button><button class="is-active" data-mode="full">Full file</button></div>`
  : f.hunks.length
    ? `<div class="ds-modetoggle"><button class="is-active" data-mode="diff">Unified</button><button data-mode="split">Split</button></div>`
    : '';
```

and in the panel body add the split container between the two existing ones:

```html
<div data-split-inner hidden></div>
```

**Watch out:** context-only files (`kind === 'context'`) have no hunks to split — the `f.hunks.length` guard above only offers Split when there are hunks; context files keep their current toggle-less or full-only behavior. Check the demo renders context files unharmed.

- [ ] **Step 5: server — `/api/diff/split`**

In `src/server.ts`, next to the `/api/fullfile` route:

```ts
if (method === 'GET' && url.pathname === '/api/diff/split') {
  return sendHtml(res, renderSplitResponse(session, url.searchParams.get('file') ?? ''));
}
```

And mirror `renderFullFileResponse` exactly (same scope rules, same story/storyless branches):

```ts
/** The lazily-loaded Split (hunks-only, side-by-side) view for one file. */
function renderSplitResponse(session: Session, file: string): string {
  if (!session.repo) return `<div class="ds-diffnote">No repo is open.</div>`;
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
  const repo = session.repo;

  if (session.selectedStory === null) {
    const df = parseUnifiedDiff(getDiff(repo, resolveBase(repo, session.base), session.head)).find(
      (f) => f.newPath === file,
    );
    if (!df) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
    return renderSplitHunks(hunksToSbsBlocks(df, []), {
      file,
      oldFile: df.oldPath,
      newFile: df.status === 'added',
    });
  }

  const { tour, files } = loadReview(session);
  const df = files.find((f) => f.newPath === file);
  if (!df) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
  const ranges = computeCoverage(tour, files)
    .uncovered.filter((u) => u.file === file)
    .map((u) => u.range);
  return renderSplitHunks(hunksToSbsBlocks(df, ranges), {
    file,
    oldFile: df.oldPath,
    newFile: df.status === 'added',
  });
}
```

Import `hunksToSbsBlocks` from `./view-model.js` and `renderSplitHunks` from `./render.js`.

- [ ] **Step 6: client — split branch in `setMode`, `loadSplit`, persistence**

In `src/diff-assets.ts`, rewrite `setMode` (moved there in Task 3) to handle three modes and persist for file panels:

```js
  function setMode(btn){
    var holder=closest(btn,'.ds-filepanel')||closest(btn,'.ds-diff');if(!holder)return;
    var file=holder.getAttribute('data-file');
    var mode=btn.getAttribute('data-mode');
    $all('.ds-modetoggle button',holder).forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-mode')===mode);});
    var diffInner=$('[data-diff-inner]',holder),fullInner=$('[data-full-inner]',holder),splitInner=$('[data-split-inner]',holder),hint=$('[data-difthint]',holder);
    if(holder.classList.contains('ds-filepanel')){try{localStorage.setItem('ds-files-mode',mode);}catch(e){}}
    var needsLoad=false;
    if(mode==='full'){
      if(hint){if(!hint.getAttribute('data-diffhint'))hint.setAttribute('data-diffhint',hint.textContent);hint.textContent='Complete file';}
      needsLoad=fullInner&&!fullInner.getAttribute('data-loaded')&&file;
      if(needsLoad)loadFull(fullInner,file);
      if(diffInner)diffInner.hidden=true;if(splitInner)splitInner.hidden=true;if(fullInner)fullInner.hidden=false;
    }else if(mode==='split'&&splitInner){
      if(hint&&hint.getAttribute('data-diffhint'))hint.textContent=hint.getAttribute('data-diffhint');
      needsLoad=!splitInner.getAttribute('data-loaded')&&file;
      if(needsLoad)loadSplit(splitInner,file);
      if(diffInner)diffInner.hidden=true;if(fullInner)fullInner.hidden=true;splitInner.hidden=false;
    }else{
      if(hint&&hint.getAttribute('data-diffhint'))hint.textContent=hint.getAttribute('data-diffhint');
      if(fullInner)fullInner.hidden=true;if(splitInner)splitInner.hidden=true;if(diffInner)diffInner.hidden=false;
    }
    updateChangeNav(holder);
    if(!needsLoad)jumpToFirstChange(holder);
  }
  function loadSplit(splitInner,file){
    splitInner.setAttribute('data-loaded','1');
    splitInner.innerHTML='<div class="ds-diffnote">Loading the split view…</div>';
    fetch('/api/diff/split?file='+encodeURIComponent(file)).then(function(r){return r.text();}).then(function(html){
      splitInner.innerHTML=html;
      mountThreads(splitInner);
      var h=closest(splitInner,'.ds-filepanel')||closest(splitInner,'.ds-diff');
      updateChangeNav(h);jumpToFirstChange(h);
    }).catch(function(){
      splitInner.removeAttribute('data-loaded');
      splitInner.innerHTML='<div class="ds-diffnote">Could not load the split view.</div>';
      updateChangeNav(closest(splitInner,'.ds-filepanel')||closest(splitInner,'.ds-diff'));
    });
  }
```

**Watch out:** story-step toolbars also use `data-mode` buttons (`diff`/`full`) but have no `[data-split-inner]` — the `mode==='split'&&splitInner` guard keeps them on the legacy path, and mode persistence is gated on `.ds-filepanel`.

Also update `visibleDiffRoot` so change-jump works in split mode:

```js
  function visibleDiffRoot(holder){
    var fullInner=$('[data-full-inner]',holder),splitInner=$('[data-split-inner]',holder),diffInner=$('[data-diff-inner]',holder);
    if(fullInner&&!fullInner.hidden)return fullInner;
    if(splitInner&&!splitInner.hidden)return splitInner;
    return diffInner;
  }
```

In `src/page-assets.ts`, `selectFile` (~1498): replace the inline full-file lazy-load block

```js
    var panel=filePanels[i],fullInner=$('[data-full-inner]',panel);
    if(fullInner&&!fullInner.hidden&&!fullInner.getAttribute('data-loaded')){
      var file=panel.getAttribute('data-file');if(file)loadFull(fullInner,file);
    }
```

with

```js
    var panel=filePanels[i];
    applyFilesMode(panel);
```

and add (in page-assets, near `selectFile`, since it references `setMode` which hoists from `DIFF_JS` in the same IIFE):

```js
  function applyFilesMode(panel){
    if(!panel)return;
    var stored=null;try{stored=localStorage.getItem('ds-files-mode');}catch(e){}
    var active=$('.ds-modetoggle button.is-active',panel);
    var want=stored||(active?active.getAttribute('data-mode'):null);
    if(!want)return;
    var btn=$('.ds-modetoggle button[data-mode="'+want+'"]',panel)||active;
    if(btn)setMode(btn);
  }
```

**Watch out:** `applyFilesMode` runs `setMode` even when the wanted mode is already active — that re-triggers the lazy load for not-yet-loaded full/split bodies, which is exactly what the deleted `selectFile` block did for `full`.

- [ ] **Step 7: Run the suite + browser check**

Run: `npm test` → all PASS.
Run: `npm run demo` → All-files: segmented control shows Unified | Split | Full file; Split lazy-loads side-by-side hunks with the draggable divider working; pick Split, switch file — mode sticks; reload — mode sticks; story steps' own Diff/Full toggle unaffected.

- [ ] **Step 8: Commit**

```bash
npm run build
git add src/view-model.ts src/render.ts src/server.ts src/diff-assets.ts src/page-assets.ts test/view-model.test.mjs test/app-server.test.mjs test/diff-client.test.mjs dist
git commit -m "feat: Split view in All-files — lazy side-by-side hunks with persisted mode"
```

---

### Task 6: Expand context at hunk gaps

**Files:**
- Modify: `src/diff-render.ts` (`renderHunkGap` gains the interactive branch)
- Modify: `src/view-model.ts` (`FileView.hunkRanges`)
- Modify: `src/render.ts` (gap info in `filePanel` unified body + `renderSplitHunks`; new export `renderContextRows`)
- Modify: `src/server.ts` (route `/api/diff/context` + `renderContextResponse`)
- Modify: `src/diff-assets.ts` (`expandGap` + gap CSS), `src/page-assets.ts` (onClick dispatch line)
- Test: `test/diff-render.test.mjs`, `test/app-server.test.mjs`, `test/diff-client.test.mjs`

**Interfaces:**
- Consumes: `buildFullFileRows`, `readWholeFile`, session scope (server); `renderUnifiedRow`/`renderSplitRow` (Task 2); `mountThreads`, `updateChangeNav` (client closure).
- Produces:
  ```ts
  // view-model.ts — FileView gains:
  hunkRanges: Array<[number, number]>   // [newStart, newEnd] per hunk, aligned with .hunks
  // render.ts
  export function renderContextRows(rows: SbsRow[], layout: 'unified' | 'split', opts: { file: string; oldFile?: string; newFile: boolean }): string
  ```
  HTTP: `GET /api/diff/context?file=<path>&from=<n>&to=<n|eof>&layout=<unified|split>` → `<div data-ctx-rows data-from="F" data-to="T">rows…</div>` (F=T=0 when empty).
  DOM: `.ds-hunkgap[data-gap]` with `data-gap-file`, `data-gap-from`, `data-gap-to` (`eof` allowed), buttons `[data-expand="down"|"up"|"all"]`. Semantics: the gap covers hidden new-file lines `from..to`; **down** reveals the first 20 (`from..from+19`, inserted *before* the gap element), **up** reveals the last 20 (`to-19..to`, inserted *after* the gap element), **all** reveals everything and removes the gap. Trailing `eof` gaps offer only down/all.

- [ ] **Step 1: Write the failing tests**

`test/diff-render.test.mjs` (append):

```js
test('interactive hunk gap carries range data and expand buttons', () => {
  const html = renderHunkGap({ file: 'a.ts', from: 10, to: 30 });
  assert.match(html, /data-gap /);
  assert.match(html, /data-gap-file="a\.ts"/);
  assert.match(html, /data-gap-from="10"/);
  assert.match(html, /data-gap-to="30"/);
  assert.match(html, /data-expand="down"/);
  assert.match(html, /data-expand="all"/);
  assert.match(html, /data-expand="up"/);
});

test('eof gap omits the up button', () => {
  const html = renderHunkGap({ file: 'a.ts', from: 50, to: 'eof' });
  assert.match(html, /data-gap-to="eof"/);
  assert.doesNotMatch(html, /data-expand="up"/);
});
```

`test/app-server.test.mjs` (append):

```js
test('/api/diff/context serves clamped context rows', async () => {
  const repo = gitRepo();
  // Commit a 40-line file, then change only the LAST line: lines 1–36ish are
  // outside the hunk, so the expandable gap consists of real *context* rows.
  const lines = Array.from({ length: 40 }, (_, i) => 'line ' + (i + 1));
  writeFileSync(join(repo, 'notes.txt'), lines.join('\n') + '\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'add notes'], { cwd: repo });
  writeFileSync(join(repo, 'notes.txt'), lines.slice(0, 39).join('\n') + '\nline forty\n');
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    const res = await fetch(`${base}/api/diff/context?file=notes.txt&from=2&to=4&layout=unified`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /^<div data-ctx-rows data-from="2" data-to="4">/);
    assert.match(html, /line 3/);
    const split = await fetch(`${base}/api/diff/context?file=notes.txt&from=2&to=3&layout=split`);
    assert.match(await split.text(), /ds-celldiv/);
    const empty = await fetch(`${base}/api/diff/context?file=notes.txt&from=9999&to=eof&layout=unified`);
    assert.match(await empty.text(), /data-from="0" data-to="0"/);
    const bad = await fetch(`${base}/api/diff/context?file=nope.md&from=1&to=2&layout=unified`);
    assert.match(await bad.text(), /isn't part of this change/);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});
```

**Watch out:** the ctx-row filter serves only lines *outside* the hunk (plus the hunk's own context lines). If `data-from`/`data-to` land off-by-something, print the endpoint's HTML and re-check which lines the hunk swallowed rather than loosening the assertion.

`test/diff-client.test.mjs` (append):

```js
test('expand-context client is wired', () => {
  assert.match(DIFF_JS, /function expandGap\(/);
  assert.match(DIFF_JS, /\/api\/diff\/context\?file=/);
  assert.match(PAGE_JS, /data-expand/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && node --test test/diff-render.test.mjs test/app-server.test.mjs test/diff-client.test.mjs`
Expected: new tests FAIL.

- [ ] **Step 3: `renderHunkGap` interactive branch (`diff-render.ts`)**

```ts
export function renderHunkGap(gap?: GapInfo): string {
  if (!gap) return `<div class="ds-hunkgap"><span>⋯</span></div>`;
  const up =
    gap.to === 'eof'
      ? ''
      : `<button type="button" class="ds-gapbtn" data-expand="up" title="Show the last 20 hidden lines">↑ 20</button>`;
  return (
    `<div class="ds-hunkgap is-expandable" data-gap data-gap-file="${esc(gap.file)}" data-gap-from="${gap.from}" data-gap-to="${gap.to}">` +
    `<button type="button" class="ds-gapbtn" data-expand="down" title="Show the first 20 hidden lines">↓ 20</button>` +
    `<span class="ds-gapdots">⋯</span>` +
    `<button type="button" class="ds-gapbtn" data-expand="all" title="Show all hidden lines">all</button>` +
    `<span class="ds-gapdots">⋯</span>` +
    up +
    `</div>`
  );
}
```

- [ ] **Step 4: gap data in the panels (`view-model.ts` + `render.ts`)**

1. `FileView` interface: add `hunkRanges: Array<[number, number]>;` after `hunks`. In the changed-files constructor (view-model.ts ~312–324) add `hunkRanges: file.hunks.map(hunkNewRange),`. In the context-files constructor (~333–345) add `hunkRanges: r ? [[r.startLine, r.startLine + rows.length - 1]] : [],` (`r` is the `readFileRange` result already in scope; context files never render expandable gaps anyway — `canExpand` excludes them — the field just keeps the shape total).
2. `filePanel` unified body (~926–935): thread gap info. Replace the `unified` construction with:
   ```ts
   const canExpand = f.kind !== 'context' && f.hasFull;
   const gapBefore = (hi: number): string => {
     if (!canExpand) return hi > 0 ? renderHunkGap() : '';
     if (hi === 0) {
       const start = f.hunkRanges[0]?.[0] ?? 1;
       return start > 1 ? renderHunkGap({ file: f.file, from: 1, to: start - 1 }) : '';
     }
     const prevEnd = f.hunkRanges[hi - 1][1];
     const nextStart = f.hunkRanges[hi][0];
     return nextStart - prevEnd > 1
       ? renderHunkGap({ file: f.file, from: prevEnd + 1, to: nextStart - 1 })
       : renderHunkGap();
   };
   const gapAfterLast = canExpand && f.hunks.length
     ? renderHunkGap({ file: f.file, from: f.hunkRanges[f.hunkRanges.length - 1][1] + 1, to: 'eof' })
     : '';
   const unified = f.hunks.length
     ? f.hunks
         .map((hunk, hi) => {
           const intra = intraLineMap(hunk, (r) => r.type, (r) => r.content);
           return gapBefore(hi) + hunk.map((r) => unifiedRow(r, f.file, f.oldFile, unifiedIntra(r, intra))).join('');
         })
         .join('') + gapAfterLast
     : '<div class="ds-diffnote">No diff to show.</div>';
   ```
   **Watch out:** deleted files have `hasFull === false` → no expandable gaps (working tree can't serve their lines). The trailing `eof` gap may cover zero lines — the client removes it on first click when the endpoint returns nothing.
3. `renderSplitHunks` (Task 5): accept gap info the same way — change its signature to
   ```ts
   export function renderSplitHunks(
     blocks: SbsRow[][],
     opts: { file: string; oldFile?: string; newFile: boolean; hunkRanges?: Array<[number, number]>; canExpand?: boolean },
   ): string
   ```
   and use the same `gapBefore`/`gapAfterLast` logic keyed on `opts.hunkRanges`/`opts.canExpand` (bare `renderHunkGap()` when absent). In `renderSplitResponse` (server), pass `hunkRanges: df.hunks.map(hunkNewRange)` — export `hunkNewRange` from view-model.ts (currently internal, ~line 455) — and `canExpand: df.status !== 'deleted'`.
4. New export in `render.ts`:
   ```ts
   /** Rows served by /api/diff/context, wrapped so the client can read the
    *  actually-served range. Context rows only. */
   export function renderContextRows(
     rows: SbsRow[],
     layout: 'unified' | 'split',
     opts: { file: string; oldFile?: string; newFile: boolean },
   ): string {
     if (!rows.length) return `<div data-ctx-rows data-from="0" data-to="0"></div>`;
     const from = rows[0].newNo ?? 0;
     const to = rows[rows.length - 1].newNo ?? 0;
     const body =
       layout === 'split'
         ? rows.map((r) => fullRow(r, opts)).join('')
         : rows
             .map((r) =>
               unifiedRow({ type: 'ctx', no: r.newNo, content: r.content }, opts.file, opts.oldFile ?? opts.file),
             )
             .join('');
     return `<div data-ctx-rows data-from="${from}" data-to="${to}">${body}</div>`;
   }
   ```

- [ ] **Step 5: server — `/api/diff/context`**

Route (next to `/api/diff/split`):

```ts
if (method === 'GET' && url.pathname === '/api/diff/context') {
  return sendHtml(res, renderContextResponse(session, url.searchParams));
}
```

Handler (mirrors the scope rules of `renderFullFileResponse`):

```ts
/** Context rows for expand-a-hunk-gap: ctx rows of the reconstructed full
 *  file, clamped to [from, to] new-file line numbers. */
function renderContextResponse(session: Session, params: URLSearchParams): string {
  if (!session.repo) return `<div class="ds-diffnote">No repo is open.</div>`;
  const repo = session.repo;
  const file = params.get('file') ?? '';
  if (!file) return `<div class="ds-diffnote">No file requested.</div>`;
  const from = Math.max(1, parseInt(params.get('from') ?? '1', 10) || 1);
  const toRaw = params.get('to') ?? 'eof';
  const to = toRaw === 'eof' ? Number.MAX_SAFE_INTEGER : parseInt(toRaw, 10) || 0;
  const layout = params.get('layout') === 'split' ? ('split' as const) : ('unified' as const);
  if (to < from) return `<div data-ctx-rows data-from="0" data-to="0"></div>`;

  let df: DiffFile | undefined;
  if (session.selectedStory === null) {
    df = parseUnifiedDiff(getDiff(repo, resolveBase(repo, session.base), session.head)).find(
      (f) => f.newPath === file,
    );
    if (!df) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
  } else {
    const { files } = loadReview(session);
    df = files.find((f) => f.newPath === file);
    if (!df) return `<div class="ds-diffnote">That file isn't part of this change.</div>`;
  }
  const newLines = readWholeFile(repo, file, session.head) ?? [];
  if (!newLines.length) return `<div class="ds-diffnote">Couldn't read ${escapeHtml(file)} from the working tree.</div>`;
  const rows = buildFullFileRows(df, newLines, []).filter(
    (r) => r.type === 'ctx' && r.newNo !== undefined && r.newNo >= from && r.newNo <= to,
  );
  return renderContextRows(rows, layout, { file, oldFile: df.oldPath, newFile: df.status === 'added' });
}
```

**Watch out:** `server.ts` may or may not already have an HTML-escape helper — check (`grep -n "escapeHtml\|function esc" src/server.ts`); if absent, import `esc` from `./diff-render.js` and use it instead of `escapeHtml`. Also confirm `readWholeFile` and `buildFullFileRows` are already imported (they are, for `renderFullFileResponse`).

- [ ] **Step 6: client — `expandGap` (append to `DIFF_JS`) + dispatch + CSS**

```js
  function expandGap(btn){
    var gap=closest(btn,'[data-gap]');if(!gap)return;
    if(btn.disabled)return;
    var file=gap.getAttribute('data-gap-file');
    var from=parseInt(gap.getAttribute('data-gap-from')||'0',10);
    var toAttr=gap.getAttribute('data-gap-to');
    var eof=toAttr==='eof';
    var to=eof?0:parseInt(toAttr||'0',10);
    var mode=btn.getAttribute('data-expand');
    var rf,rt;
    if(mode==='all'){rf=from;rt=eof?'eof':to;}
    else if(mode==='down'){rf=from;rt=eof?(from+19):Math.min(to,from+19);}
    else{rf=Math.max(from,to-19);rt=to;}
    var holder=closest(gap,'.ds-filepanel')||closest(gap,'.ds-diff');
    var layout=closest(gap,'[data-split-inner]')?'split':'unified';
    var btns=[].slice.call(gap.querySelectorAll('.ds-gapbtn'));
    btns.forEach(function(b){b.disabled=true;});
    fetch('/api/diff/context?file='+encodeURIComponent(file)+'&from='+rf+'&to='+rt+'&layout='+layout)
      .then(function(r){return r.text();})
      .then(function(html){
        var tmp=document.createElement('div');tmp.innerHTML=html;
        var wrap=tmp.firstElementChild;
        if(!wrap||!wrap.hasAttribute('data-ctx-rows')||!wrap.children.length){gap.remove();if(holder)updateChangeNav(holder);return;}
        var servedFrom=parseInt(wrap.getAttribute('data-from')||'0',10);
        var servedTo=parseInt(wrap.getAttribute('data-to')||'0',10);
        mountThreads(wrap);
        var parent=gap.parentNode,refNode=(mode==='up')?gap.nextSibling:gap;
        while(wrap.firstChild)parent.insertBefore(wrap.firstChild,refNode);
        if(mode==='all'){gap.remove();}
        else if(mode==='down'){
          var nf=servedTo+1;
          if(eof){gap.setAttribute('data-gap-from',String(nf));}
          else if(nf>to){gap.remove();}
          else{gap.setAttribute('data-gap-from',String(nf));}
        }else{
          var nt=servedFrom-1;
          if(nt<from){gap.remove();}
          else{gap.setAttribute('data-gap-to',String(nt));}
        }
        btns.forEach(function(b){b.disabled=false;});
        if(holder)updateChangeNav(holder);
      })
      .catch(function(){
        btns.forEach(function(b){b.disabled=false;});
        toast('Could not load more context');
      });
  }
```

**Watch out (eof + down):** when an `eof` gap's down-expansion returns fewer than 20 rows the file ended — the *next* click returns an empty wrap and removes the gap. Acceptable one-extra-click; do not special-case.

Dispatch in `page-assets.ts` onClick, directly before the `[data-mode]` line (~2153):

```js
    b=closest(t,'[data-expand]');if(b){expandGap(b);return;}
```

CSS (append to `DIFF_CSS`):

```css
.ds-hunkgap.is-expandable{display:flex;align-items:center;justify-content:center;gap:10px}
.ds-gapbtn{font:inherit;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid var(--line-soft);background:transparent;color:var(--muted);cursor:pointer;opacity:0;transition:opacity .15s ease,background .15s ease}
.ds-hunkgap.is-expandable:hover .ds-gapbtn,.ds-gapbtn:focus-visible{opacity:1}
.ds-gapbtn:hover{background:var(--fill-2);color:var(--text)}
.ds-gapbtn:disabled{opacity:.4;cursor:default}
.ds-gapdots{color:var(--dim2)}
```

- [ ] **Step 7: Run the suite + browser check**

Run: `npm test` → all PASS.
Run: `npm run demo` → All-files Unified: hover a `⋯` gap → buttons appear; `↓ 20` inserts 20 context lines above the gap marker with correct line numbers and syntax highlighting; `all` dissolves the gap; switch to Split and expand there too; comment on an expanded row (right-click) works. Ctrl-C.

- [ ] **Step 8: Commit**

```bash
npm run build
git add src/diff-render.ts src/view-model.ts src/render.ts src/server.ts src/diff-assets.ts src/page-assets.ts test/diff-render.test.mjs test/app-server.test.mjs test/diff-client.test.mjs dist
git commit -m "feat: expandable hunk gaps — 20-line and full context expansion in All-files"
```

---

### Task 7: Shared tokens + diff visual polish

**Files:**
- Create: `src/theme.ts`
- Modify: `src/change-page.ts` (token block at lines 150–153), `src/render.ts` (style tag line 130), `src/page-assets.ts` (light-scheme diff hues if present), `src/diff-assets.ts` (polish rules)
- Test: `test/change-page.test.mjs`, `test/diff-client.test.mjs`

**Interfaces:**
- Produces:
  ```ts
  // src/theme.ts
  export function sharedTokens(): string  // :root { --app-* } light defaults + dark @media override
  ```

- [ ] **Step 1: Write the failing tests**

`test/change-page.test.mjs` (append, matching its existing render-call pattern):

```js
test('change page draws from the shared --app-* tokens', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo', diffFiles });
  assert.match(html, /--app-bg:/);
  assert.match(html, /--bg:var\(--app-bg\)/);
});
```

(`withChanges` and `diffFiles` are the fixtures already defined at the top of `test/change-page.test.mjs` — this matches the file's existing tests.)

`test/diff-client.test.mjs` (append):

```js
test('review page consumes shared tokens and respects reduced motion', () => {
  assert.match(PAGE_CSS, /--app-bg:/);
  assert.match(DIFF_CSS, /prefers-reduced-motion/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && node --test test/change-page.test.mjs test/diff-client.test.mjs`
Expected: new tests FAIL.

- [ ] **Step 3: Create `src/theme.ts`**

```ts
// The one Apple-HIG palette every page draws from. Emitted as --app-* custom
// properties (light defaults, dark override); each page aliases its legacy
// token names onto these so both screens read as one app.
export function sharedTokens(): string {
  return `
:root{--app-bg:#f5f5f7;--app-elev:#ffffff;--app-label:#1d1d1f;--app-l2:#6e6e73;--app-l3:#8e8e93;
  --app-hair:rgba(0,0,0,.1);--app-sep:rgba(0,0,0,.07);--app-fill:rgba(120,120,128,.12);--app-subbg:rgba(120,120,128,.06);
  --app-blue:#007aff;--app-blue2:#0067d6;--app-add:#1d7d3f;--app-del:#c4271f;--app-addbar:#34c759;--app-delbar:#ff453a}
@media (prefers-color-scheme:dark){:root{--app-bg:#1c1c1e;--app-elev:#2c2c2e;--app-label:#f5f5f7;--app-l2:#aeaeb2;--app-l3:#8e8e93;
  --app-hair:rgba(255,255,255,.12);--app-sep:rgba(255,255,255,.08);--app-fill:rgba(120,120,128,.24);--app-subbg:rgba(255,255,255,.035);
  --app-blue:#0a84ff;--app-blue2:#3395ff;--app-add:#30d158;--app-del:#ff6961;--app-addbar:#30d158;--app-delbar:#ff453a}}
`;
}
```

(The values are the change page's exact current palette — chosen as canonical because both pages already share them where they overlap.)

- [ ] **Step 4: Alias the change page onto the shared tokens**

In `src/change-page.ts`: import `sharedTokens`, then replace lines 150–153 (both `:root` blocks) with:

```ts
${sharedTokens()}
:root{--bg:var(--app-bg);--elev:var(--app-elev);--label:var(--app-label);--l2:var(--app-l2);--l3:var(--app-l3);
  --hair:var(--app-hair);--sep:var(--app-sep);--blue:var(--app-blue);--blue2:var(--app-blue2);
  --add:var(--app-add);--del:var(--app-del);--addbar:var(--app-addbar);--delbar:var(--app-delbar);
  --fill:var(--app-fill);--subbg:var(--app-subbg)}
```

(No dark media query needed — `--app-*` flips itself.)

- [ ] **Step 5: Feed the review page from the same tokens**

1. `src/render.ts` line 130: `<style>${sharedTokens()}${PAGE_CSS}${progressPanelStyles()}</style>` (import `sharedTokens`).
2. In `src/page-assets.ts` `PAGE_CSS_CORE`, remap the overlapping review tokens onto `--app-*`. The review page is dark-by-default with a light override block — locate it (`grep -n "prefers-color-scheme:light" src/page-assets.ts`). Apply this exact mapping in the **dark-default `:root`** block:
   - `--md-primary:#0A84FF` → `--md-primary:var(--app-blue)` — **note:** `--app-blue` is scheme-responsive (#007aff light / #0a84ff dark), which is exactly what the two blocks currently hand-flip.
   - `--add:#30D158` → `--add:var(--app-addbar)`; `--del:var(--md-error)` stays (error red ≙ delbar in dark) — change to `--del:var(--app-delbar)`.
   - `--bg`/`--md-surface` chain: `--md-surface:#1C1C1E` → `var(--app-bg)`; `--md-surface-container-low:#1C1C1E` → `var(--app-bg)`; `--md-surface-container:#2C2C2E` → `var(--app-elev)`; `--md-on-surface:#F5F5F7` → `var(--app-label)`.
   - In the **light override** block, delete any declaration that now duplicates what the responsive `--app-*` alias already produces (compare value-by-value; keep everything that differs).
3. Verify no visual drift: this mapping only substitutes identical hex values through a variable — the computed colors must not change in either scheme.

- [ ] **Step 6: Diff-focused polish (edit `DIFF_CSS`)**

Apply these rule changes (find each existing rule and modify; add the new ones at the end):

```css
/* gutter: numbers read as a distinct column */
.ds-no{background:var(--gutter);border-right:1px solid var(--diff-rule);font-variant-numeric:tabular-nums}
/* macOS-style segmented control */
.ds-modetoggle{gap:0;padding:2px;border-radius:7px;background:var(--fill-2);border:none}
.ds-modetoggle button{border-radius:5px;transition:background .15s ease,color .15s ease}
.ds-modetoggle button.is-active{background:var(--panel4);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.28)}
/* hunk separators: hairline rules instead of a bare band */
.ds-hunkgap{border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft)}
/* mode/file switches fade in */
.ds-filepanel-body>[data-diff-inner]:not([hidden]),.ds-filepanel-body>[data-split-inner]:not([hidden]),.ds-filepanel-body>[data-full-inner]:not([hidden]){animation:ds-body-in .16s ease}
@keyframes ds-body-in{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ds-filepanel-body>*{animation:none!important}.ds-modetoggle button,.ds-viewedmark,.ds-gapbtn{transition:none!important}}
```

**Watch out:** `.ds-no` also appears inside split cells — check in the browser that the gutter border doesn't double up against `.ds-celldiv`; if it does, scope the border to `.ds-urow .ds-no` and add a cell-side rule that looks right. The exact values above are the starting point; nudge them only if the browser check shows a problem, and keep every change inside `DIFF_CSS`.

- [ ] **Step 7: Run suite + visual audit in both schemes**

Run: `npm test` → all PASS.
Run: `npm run demo`, then audit BOTH pages (change page via the nav, review page steps + All-files) in light **and** dark (macOS appearance or DevTools emulation):
- change page and review page share grays/blue/add/del;
- segmented control reads native; active pill legible in both schemes;
- viewed-dimmed sidebar rows still ≥ readable contrast;
- add/del tints and intra-line `.changed` emphasis legible in both schemes;
- motion absent when "Reduce Motion" is on.

- [ ] **Step 8: Commit**

```bash
npm run build
git add src/theme.ts src/change-page.ts src/render.ts src/page-assets.ts src/diff-assets.ts test/change-page.test.mjs test/diff-client.test.mjs dist
git commit -m "feat: shared --app-* design tokens across both pages + diff visual polish pass"
```

---

### Task 8: Final verification, docs, spec status

**Files:**
- Modify: `README.md` ("What you get" bullets), `docs/superpowers/specs/2026-07-03-diff-viewer-enhancement-design.md` (status line)

- [ ] **Step 1: Full suite + fresh demo pass**

Run: `npm test` → ALL PASS (report the count).
Run: `npm run demo` and walk the whole surface once: story steps (side-by-side, comments, voice focus unaffected) → All files (Unified/Split/Full, expand gaps, viewed marks, j/k/n/p/v keys) → trust drawer → change page styling. Anything broken: fix before proceeding, add a regression test where the suite missed it.

- [ ] **Step 2: Update README + spec status**

In `README.md`, extend the plain-diff-viewer bullet (the "⚖️ **A plain diff viewer…**" line) to mention: unified/split/full-file views per file, expandable context around hunks, and viewed-file tracking. Keep the existing voice.

In the spec, change `**Status:** Approved, awaiting implementation plan` → `**Status:** Implemented (2026-07-03)`.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/specs/2026-07-03-diff-viewer-enhancement-design.md
git commit -m "docs: README + spec status for the diff viewer enhancement"
```
