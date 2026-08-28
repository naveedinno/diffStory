# All-Files Diff View Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the All-files split diff dramatically easier to read: paired del/add rows (GitHub-style side-by-side changes), a legible "nothing existed here" void treatment, a sticky enclosing-scope header per hunk, deduped headers with change stats, clearer expand-context controls — all guarded by a render-performance baseline test.

**Architecture:** All diff rows are rendered server-side as HTML strings by pure functions (`src/diff-render.ts`, `src/render.ts`) from `SbsRow` view models (`src/view-model.ts`); the browser engine (`client/surfaces/review/engine/review-engine.js`) only adds behavior. Every change here stays in that shape: new pure row-shaping functions in the view model, new HTML in the renderers, new tokens-only CSS in `client/surfaces/review/review.css`, and three one-line selector updates in the engine.

**Tech Stack:** TypeScript (compiled by `tsc` to `dist/`), plain browser JS client engine, node:test, no runtime deps.

**Spec:** No separate spec file — the approved design is the five-item assessment in the conversation that produced this plan, summarized per-task below. Each task's "Why" line restates the requirement it implements.

## Global Constraints

- **Preflight (once, before Task 1):** the worktree currently has uncommitted polish-campaign edits (`client/surfaces/review/engine/review-engine.js`, `client/surfaces/review/review.css`, `dist/*`, `test/review-page.test.mjs`). Commit or land those first on their own commit. Never run `git checkout --`, `git reset --hard`, or `git clean` on files you did not author in this plan.
- **dist/ ships in git:** every commit that touches `src/` or `client/` MUST include the rebuilt `dist/` (`npm run build` before `git add`). GitHub installs have no build step.
- **Verification command:** `npm run check` (builds, then runs all node tests). For fast inner loops: `npm run build && node --test test/<file>.test.mjs`.
- **Client code is page content:** comments inside `client/surfaces/review/engine/review-engine.js` (and any served HTML/CSS/JS) must never name a banned API or a string that tests assert absent — inlined comments ship to the page and trip `doesNotMatch` assertions.
- **After editing the client engine:** run `node --check dist/client/review.js` post-build to catch syntax errors in the emitted bundle.
- **CSS uses existing tokens only:** `var(--line)`, `var(--gutter-hi)`, `var(--muted)`, `var(--diff-rule)`, `var(--panel2)`, etc. Never a raw hex color. Design language is "Signal / Thread-Ledger" — restrained, low-contrast chrome; nothing that shouts.
- **Node >= 20**, `"type": "module"`, tests import built code from `../dist/*.js` and read CSS straight from `client/surfaces/review/review.css`.

---

### Task 1: Render-performance baseline test

**Why:** Lock in a performance tripwire *before* adding pairing, scope rows, and hunk wrappers, so any quadratic regression from Tasks 4–6 fails CI. (Assessment item 5; ties to the standing "300-step stories must stay fast" goal.)

**Files:**
- Create: `test/perf-split-render.test.mjs`

**Interfaces:**
- Consumes: `hunksToSbsBlocks(file, uncoveredRanges)` from `dist/view-model.js`, `renderSplitHunks(blocks, opts)` from `dist/render.js` (both already exported).
- Produces: nothing for later tasks — pure guardrail. Later tasks must keep this test green.

- [ ] **Step 1: Write the test**

```js
// Performance tripwire for the All-files Split renderer. The budget is
// deliberately generous — it exists to catch accidental quadratic work in
// row shaping or rendering, not to benchmark. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hunksToSbsBlocks } from '../dist/view-model.js';
import { renderSplitHunks } from '../dist/render.js';

function syntheticFile(hunkCount) {
  const hunks = [];
  let oldNo = 1;
  let newNo = 1;
  for (let h = 0; h < hunkCount; h++) {
    const lines = [];
    for (let c = 0; c < 4; c++) {
      lines.push({ type: 'ctx', content: `    uint256 ctx_${h}_${c} = balances[msg.sender];`, oldNo: oldNo++, newNo: newNo++ });
    }
    const oldStart = oldNo - 4;
    const newStart = newNo - 4;
    for (let d = 0; d < 3; d++) {
      lines.push({ type: 'del', content: `    uint256 fee_${h}_${d} = (amount * rate_${d}) / denom;`, oldNo: oldNo++ });
    }
    for (let a = 0; a < 6; a++) {
      lines.push({ type: 'add', content: `    uint256 fee_${h}_${a} = (amount * plan.rate_${a}) / plan.denom;`, newNo: newNo++ });
    }
    hunks.push({ oldStart, oldLines: 7, newStart, newLines: 10, lines });
    oldNo += 20;
    newNo += 20;
  }
  return { oldPath: 'contracts/Big.sol', newPath: 'contracts/Big.sol', status: 'modified', hunks };
}

test('split renderer handles a 300-hunk file within budget', () => {
  const file = syntheticFile(300);
  const ranges = file.hunks.map((h) => [h.newStart, h.newStart + h.newLines - 1]);
  const start = performance.now();
  const blocks = hunksToSbsBlocks(file, []);
  const html = renderSplitHunks(blocks, {
    file: file.newPath,
    oldFile: file.oldPath,
    newFile: false,
    hunkRanges: ranges,
    canExpand: true,
  });
  const elapsed = performance.now() - start;
  assert.equal(blocks.length, 300);
  assert.ok(html.length > 100_000, 'render produced a real document');
  assert.ok(elapsed < 2000, `split render took ${Math.round(elapsed)}ms (budget 2000ms)`);
});
```

- [ ] **Step 2: Run it — must pass against current code**

Run: `npm run build && node --test test/perf-split-render.test.mjs`
Expected: PASS (this is a baseline, not TDD red — it documents current behavior).

- [ ] **Step 3: Commit**

```bash
git add test/perf-split-render.test.mjs
git commit -m "test: add split-render performance tripwire"
```

---

### Task 2: Legible void treatment for absent counterparts

**Why:** In split view, a large added block leaves a giant blank region in the Before pane that is indistinguishable from unchanged background. Give `.ds-cell-empty` a subtle hatch so it reads as "this code did not exist on this side." (Assessment item 1.)

**Files:**
- Modify: `client/surfaces/review/review.css:838` (the `.ds-cell-empty` rule)
- Modify: `test/diff-render.test.mjs` (~line 120, the existing `.ds-cell-empty` rule-body assertion)

**Interfaces:**
- Consumes: the `.ds-cell-empty` class emitted by `cell()` in `src/diff-render.ts:61` (unchanged).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Update the failing CSS assertion first**

In `test/diff-render.test.mjs`, find the test that reads `cssRuleBody(DIFF_CSS, '.ds-cell-empty')` (~line 120) and replace its assertions with:

```js
const emptyCell = cssRuleBody(DIFF_CSS, '.ds-cell-empty');
assert.match(emptyCell, /repeating-linear-gradient/);
assert.match(emptyCell, /var\(--line\)/);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/diff-render.test.mjs`
Expected: FAIL — current rule body is `background:transparent`.

- [ ] **Step 3: Apply the CSS change**

In `client/surfaces/review/review.css`, replace:

```css
.ds-cell-empty{flex:1;min-width:0;align-self:stretch;background:transparent}
```

with:

```css
.ds-cell-empty{flex:1;min-width:0;align-self:stretch;background:repeating-linear-gradient(-45deg,transparent 0 5px,color-mix(in srgb,var(--line) 45%,transparent) 5px 6px)}
```

Keep it faint: the hatch must sit visually *below* the red/green tints, and `color-mix` against `--line` adapts to both themes automatically. Do not add a solid base color — the panel background stays visible through it.

- [ ] **Step 4: Build and run the suite**

Run: `npm run build && node --test test/diff-render.test.mjs test/diff-client.test.mjs`
Expected: PASS. If another test asserts the old `background:transparent` body, update it to the new body — same intent, new treatment.

- [ ] **Step 5: Visual check**

Run `npm run demo`, open a file with a large added block in Split view, confirm the hatch is visible but quiet in both light and dark themes (theme toggle in the app chrome).

- [ ] **Step 6: Commit (dist included)**

```bash
git add client/surfaces/review/review.css test/diff-render.test.mjs dist
git commit -m "feat: hatch absent-side cells in split view"
```

---

### Task 3: Header economy — dedupe paths, add change stats, clearer expanders

**Why:** The split header shows the identical path twice ("Before path / After path"); the panel head has no +N −M stats; the `↑ 5` / `↓ 5` / `All` expanders are cryptic and hidden until hover. (Assessment item 4.)

**Files:**
- Modify: `src/render.ts:1080-1096` (`splitHead`), `src/render.ts:821-832` (`renderFilePanelContent` head)
- Modify: `src/diff-render.ts:149-182` (`renderHunkGap` button labels)
- Modify: `client/surfaces/review/review.css` (new `.ds-diffstat` rules; `.ds-gapbtn` base opacity)
- Modify: `test/diff-render.test.mjs`, `test/diff-client.test.mjs` (existing label/opacity assertions)
- Test: `test/diff-render.test.mjs`

**Interfaces:**
- Consumes: `FileView.add` / `FileView.del` (already computed in `src/view-model.ts`); `splitHead` opts `{ file, oldFile?, newFile }` (shape unchanged).
- Produces: `.ds-diffstat`, `.ds-diffstat-add`, `.ds-diffstat-del` class names; gap buttons now read `↑ N lines`, `↓ N lines`, `Show all` (Task 6's gap markup must not regress these).

- [ ] **Step 1: Write the failing tests**

Add to `test/diff-render.test.mjs`:

```js
test('split head omits duplicate paths for a plain modification', () => {
  const html = renderHeadForTest({ file: 'a/b.sol', oldFile: 'a/b.sol', newFile: false });
  assert.match(html, /Before/);
  assert.match(html, /After/);
  assert.doesNotMatch(html, /ds-diffhead-path/);
});

test('split head keeps both paths for a rename', () => {
  const html = renderHeadForTest({ file: 'a/new.sol', oldFile: 'a/old.sol', newFile: false });
  assert.match(html, /ds-diffhead-path">a\/old\.sol/);
  assert.match(html, /ds-diffhead-path">a\/new\.sol/);
});

test('hunk gap buttons carry readable labels', () => {
  const html = renderHunkGap({ file: 'a.ts', from: 10, to: 40 }, { split: true });
  assert.match(html, />↑ 5 lines</);
  assert.match(html, />↓ 5 lines</);
  assert.match(html, />Show all</);
});
```

`splitHead` is not exported; test it through `renderSplitHunks` (already imported in this file) — `renderHeadForTest` is a small local helper that calls `renderSplitHunks([[{ type: 'ctx', content: 'x', oldNo: 1, newNo: 1 }]], { ...opts, hunkRanges: [[1, 1]], canExpand: false })`.

Also update the existing assertions in this file that expect `>All<` and `aria-label="Show all hidden lines"` buttons (~lines 144, 148, 195, 197): the label becomes `Show all`; keep the aria-label as is.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run build && node --test test/diff-render.test.mjs`
Expected: FAIL on all three new tests.

- [ ] **Step 3: Implement `splitHead` dedupe**

Replace the body of `splitHead` in `src/render.ts`:

```ts
function splitHead(opts: {
  file: string;
  oldFile?: string;
  newFile: boolean;
}): string {
  const leftLabel = opts.newFile ? "Did not exist" : "Before";
  const rightLabel = opts.newFile ? "New file" : "After";
  const oldPath = opts.oldFile ?? opts.file;
  // The panel head above already names the file; paths reappear here only
  // when the two sides genuinely differ (a rename).
  const renamed = !opts.newFile && oldPath !== opts.file;
  return `<div class="ds-diffhead">
    <span class="ds-diffhead-side ds-diffhead-side-l"><span class="ds-diffhead-label${
      opts.newFile ? " ds-dim" : ""
    }">${leftLabel}</span>${renamed ? `<span class="ds-diffhead-path">${esc(oldPath)}</span>` : ""}</span>
    <span class="ds-diffhead-divider"></span>
    <span class="ds-diffhead-side ds-diffhead-side-r"><span class="ds-diffhead-label${
      opts.newFile ? " ds-green" : ""
    }">${rightLabel}</span>${renamed ? `<span class="ds-diffhead-path">${esc(opts.file)}</span>` : ""}</span>
  </div>`;
}
```

- [ ] **Step 4: Implement gap button labels**

In `src/diff-render.ts` `renderHunkGap`, change the three button texts (leave `data-expand`, `title`, and `aria-label` attributes exactly as they are):
- up button text: `↑ ${contextChunk} lines`
- down button text: `↓ ${contextChunk} lines`
- all button text (both unified and split branches): `Show all`

- [ ] **Step 5: Add the stats chip to the panel head**

In `renderFilePanelContent` (`src/render.ts:821`), insert after the `ds-cardpath` span:

```ts
const stat =
  f.kind === "context"
    ? ""
    : `<span class="ds-diffstat" title="${f.add} added, ${f.del} deleted"><span class="ds-diffstat-add">+${f.add}</span><span class="ds-diffstat-del">−${f.del}</span></span>`;
```

and place `${stat}` immediately after the closing `</span>` of `ds-cardpath` in the template. Add CSS to `review.css` near the `.ds-filepanel-head` rules:

```css
.ds-diffstat{display:inline-flex;align-items:baseline;gap:6px;flex:none;font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums}
.ds-diffstat-add{color:var(--diff-add-text)}
.ds-diffstat-del{color:var(--diff-del-text)}
```

(`--diff-add-text` is already used at `review.css` for `.ds-sign-add`; confirm the matching `--diff-del-text` token name by checking the `.ds-sign-del` rule and use whatever token it uses.)

- [ ] **Step 6: Make expanders visible at rest**

Find the `.ds-gapbtn` rules in `review.css`. Change the resting state from fully hidden to `opacity:.55`, keep hover/focus at `opacity:1`. Update `test/diff-client.test.mjs` (~lines 133–134) which currently pins the hover-reveal rules — the coarse-pointer `opacity:1` override stays; the assertion that only matches the old resting rule changes to match the new one.

- [ ] **Step 7: Build, run the affected suites, then the full check**

Run: `npm run build && node --test test/diff-render.test.mjs test/diff-client.test.mjs test/review-page.test.mjs && npm run check`
Expected: PASS. Any other test pinning the old gap-button text gets the same one-line label update.

- [ ] **Step 8: Commit (dist included)**

```bash
git add src/render.ts src/diff-render.ts client/surfaces/review/review.css test/diff-render.test.mjs test/diff-client.test.mjs dist
git commit -m "feat: dedupe split headers, add change stats, clarify expanders"
```

---

### Task 4: Paired change rows in split and full-file views (flagship)

**Why:** Today a del-run renders left-only rows and the following add-run renders right-only rows below them, so a rewritten statement appears as two disconnected islands with a void between. Pair the k-th deleted line with the k-th added line onto ONE row (GitHub-style), with intra-line word marks on both sides. The `SbsRow.paired` machinery and `.ds-cell-paired` styling already exist for story move views — this task applies the same row shape to real change runs. (Assessment item 2.)

**Files:**
- Modify: `src/view-model.ts` (add `changePair` to `SbsRow` ~line 52; new exported `pairChangeRows` near `hunksToSbsBlocks` ~line 936)
- Modify: `src/diff-render.ts` (`reviewRowAttrs` ~line 32, `cell` ~line 83, `renderSplitRow` ~line 116)
- Modify: `src/render.ts` (`renderFullFile` ~line 1098, `renderSplitHunks` ~line 1163)
- Modify: `client/surfaces/review/engine/review-engine.js:1257,2261,2287` (change-jump selectors)
- Test: `test/view-model.test.mjs`, `test/diff-render.test.mjs`

**Interfaces:**
- Consumes: `SbsRow` (fields `type/oldNo/newNo/content/leftContent/rightContent/paired/comment/untoured`), `diffLineTokens(oldLine, newLine): { left, right } | null` and `IntraSides` from `src/intra-line.ts`.
- Produces: `export function pairChangeRows(rows: SbsRow[]): { rows: SbsRow[]; sides: Map<SbsRow, IntraSides> }` in `src/view-model.ts`; new optional `SbsRow.changePair?: boolean`; merged rows render with class `ds-row-ctx ds-row-pair`, both line numbers, both comment anchors, and aria action `Changed`. Task 6 renders these same rows inside hunk wrappers.

- [ ] **Step 1: Write the failing view-model tests**

Add to `test/view-model.test.mjs`:

```js
test('pairChangeRows merges a del-run and add-run into side-by-side rows', () => {
  const rows = [
    { type: 'ctx', oldNo: 1, newNo: 1, content: 'a' },
    { type: 'del', oldNo: 2, content: 'uint256 fee = solverFee * filled / uncapped;' },
    { type: 'del', oldNo: 3, content: 'old only line' },
    { type: 'add', newNo: 2, content: 'uint256 fee = solverFee * filled / plan.uncapped;' },
    { type: 'add', newNo: 3, content: 'completely rewritten other thing();' },
    { type: 'add', newNo: 4, content: 'extra added line' },
  ];
  const { rows: out, sides } = pairChangeRows(rows);
  assert.equal(out.length, 4); // ctx + 2 merged pairs + 1 leftover add
  assert.equal(out[1].changePair, true);
  assert.equal(out[1].paired, true);
  assert.equal(out[1].oldNo, 2);
  assert.equal(out[1].newNo, 2);
  assert.equal(out[1].leftContent, 'uint256 fee = solverFee * filled / uncapped;');
  assert.equal(out[1].rightContent, 'uint256 fee = solverFee * filled / plan.uncapped;');
  assert.ok(sides.get(out[1])?.left, 'similar pair carries intra-line marks');
  assert.equal(sides.get(out[2]), undefined, 'dissimilar pair has no intra marks');
  assert.equal(out[3].type, 'add'); // unpaired excess keeps its single-sided row
  assert.equal(out[3].changePair, undefined);
});

test('pairChangeRows leaves already-paired story rows untouched', () => {
  const rows = [{ type: 'ctx', paired: true, leftContent: 'x', rightContent: 'y', content: 'y' }];
  const { rows: out } = pairChangeRows(rows);
  assert.equal(out[0], rows[0]);
});
```

(Import `pairChangeRows` from `../dist/view-model.js` alongside the file's existing imports.)

- [ ] **Step 2: Run to verify they fail**

Run: `npm run build && node --test test/view-model.test.mjs`
Expected: FAIL — `pairChangeRows` is not exported.

- [ ] **Step 3: Implement `pairChangeRows`**

In `src/view-model.ts`, add `changePair?: boolean;` to the `SbsRow` interface with the doc comment `/** A del/add pair merged onto one row (All-files split + full file). */`, import `diffLineTokens` and `IntraSides` from `./intra-line.js`, and add near `hunksToSbsBlocks`:

```ts
/** GitHub-style change pairing: within each run of deleted lines immediately
 *  followed by added lines, merge the k-th del with the k-th add onto one
 *  side-by-side row and word-diff the pair. Excess lines keep their
 *  single-sided rows; story-paired rows pass through untouched. */
export function pairChangeRows(rows: SbsRow[]): { rows: SbsRow[]; sides: Map<SbsRow, IntraSides> } {
  const out: SbsRow[] = [];
  const sides = new Map<SbsRow, IntraSides>();
  let i = 0;
  while (i < rows.length) {
    if (rows[i].type !== 'del' || rows[i].paired) {
      out.push(rows[i]);
      i++;
      continue;
    }
    const delStart = i;
    while (i < rows.length && rows[i].type === 'del' && !rows[i].paired) i++;
    const addStart = i;
    while (i < rows.length && rows[i].type === 'add' && !rows[i].paired) i++;
    const dels = rows.slice(delStart, addStart);
    const adds = rows.slice(addStart, i);
    const n = Math.min(dels.length, adds.length);
    for (let k = 0; k < n; k++) {
      const merged: SbsRow = {
        type: 'ctx',
        changePair: true,
        paired: true,
        oldNo: dels[k].oldNo,
        newNo: adds[k].newNo,
        content: adds[k].content,
        leftContent: dels[k].content,
        rightContent: adds[k].content,
        comment: true,
        untoured: adds[k].untoured,
      };
      const intra = diffLineTokens(dels[k].content, adds[k].content);
      if (intra) sides.set(merged, intra);
      out.push(merged);
    }
    for (let k = n; k < dels.length; k++) out.push(dels[k]);
    for (let k = n; k < adds.length; k++) out.push(adds[k]);
  }
  return { rows: out, sides };
}
```

- [ ] **Step 4: Run the view-model tests**

Run: `npm run build && node --test test/view-model.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write the failing renderer tests**

Add to `test/diff-render.test.mjs`:

```js
test('a merged change pair renders both sides on one row', () => {
  const row = {
    type: 'ctx', changePair: true, paired: true,
    oldNo: 154, newNo: 158,
    content: 'new;', leftContent: 'old;', rightContent: 'new;', comment: true,
  };
  const html = renderSplitRow(row, {
    leftTarget: { side: 'left', file: 'a.sol', line: 154 },
    rightTarget: { side: 'right', file: 'a.sol', line: 158 },
  });
  assert.match(html, /class="ds-row ds-row-ctx ds-row-pair"/);
  assert.match(html, /ds-cell-del ds-cell-paired/);
  assert.match(html, /ds-cell-add ds-cell-paired/);
  assert.match(html, /aria-label="Changed after line 158/);
  assert.match(html, /data-comment-side="left" [^>]*data-comment-line="154"/);
  assert.match(html, /data-comment-side="right" [^>]*data-comment-line="158"/);
});
```

Adjust the attribute regexes to the exact attribute order `targetAttrs` emits (`data-comment-code="1" data-comment-side="…" data-comment-file="…" data-comment-line="…"`) — copy the order from the existing anchor assertions in this file.

- [ ] **Step 6: Run to verify it fails, then implement the renderer changes**

Run: `node --test test/diff-render.test.mjs` — expect FAIL on the new test (no `ds-row-pair` class, aria says `Context`).

In `src/diff-render.ts`:
1. `reviewRowAttrs`: add a `changePair?: boolean` parameter and make the action line
   `const action = changePair ? 'Changed' : type === 'add' ? 'Added' : type === 'del' ? 'Deleted' : 'Context';`
2. `renderSplitRow`: pass `row.changePair` into `reviewRowAttrs`, and build the class as
   `ds-row ds-row-${row.type}${row.changePair ? ' ds-row-pair' : ''}`.
3. `cell()`: the UNEXPLAINED flag currently requires `add` — widen it so a merged pair can carry it:
   `const flag = side === 'right' && row.untoured && (add || row.changePair) ? '<span class="ds-untoured-tag">UNEXPLAINED</span>' : '';`

- [ ] **Step 7: Wire pairing into the two render entry points**

In `src/render.ts`, import `pairChangeRows` from `./view-model.js`.

`renderSplitHunks` — replace the per-block `intraLineMap` with pairing:

```ts
const body =
  blocks
    .map((block, bi) => {
      const { rows: pairedRows, sides } = pairChangeRows(block);
      return gapBefore(bi) + pairedRows.map((row) => fullRow(row, opts, sides)).join("");
    })
    .join("") + gapAfterLast;
```

`renderFullFile` — same substitution:

```ts
const { rows: pairedRows, sides } = pairChangeRows(rows);
const body = pairedRows.map((r) => fullRow(r, opts, sides)).join("");
```

`fullRow` needs no change — its `intra?: Map<SbsRow, IntraSides>` lookup and left/right target construction (from `oldNo`/`newNo`) already handle merged rows. `intraLineMap` stays imported for the unified panel path.

- [ ] **Step 8: Update the change-jump selectors in the engine**

In `client/surfaces/review/engine/review-engine.js`, at the three sites (~lines 1257, 2261, 2287) change `'.ds-row-add,.ds-row-del'` to `'.ds-row-add,.ds-row-del,.ds-row-pair'` so next/prev-change navigation still lands on merged rows. Do not touch anything else in the engine.

- [ ] **Step 9: Build, syntax-check the emitted client, run the full suite**

Run: `npm run build && node --check dist/client/review.js && npm run check`
Expected: PASS, including the Task 1 perf tripwire. Existing tests that assert separate del/add rows in split output (search `test/` for `ds-row-del` and `ds-row-add` against `renderSplitHunks`/full-file output) get updated to the merged shape — the intent of those tests (anchors, tints, ordering) is preserved on the paired row.

- [ ] **Step 10: Interactive verification**

Run `npm run demo`; in Split view confirm: paired rows show old/new side-by-side with word-level marks on both sides; selecting text on the left side produces a Before-anchored comment and on the right an After-anchored one; `n`/`p` change-jump lands on merged rows; unified and story views are unchanged.

- [ ] **Step 11: Commit (dist included)**

```bash
git add src/view-model.ts src/diff-render.ts src/render.ts client/surfaces/review/engine/review-engine.js test/view-model.test.mjs test/diff-render.test.mjs dist
git commit -m "feat: pair del/add runs onto side-by-side rows in split and full views"
```

---

### Task 5: Capture git's hunk function context

**Why:** `git diff` already emits the enclosing declaration after the second `@@` in every hunk header; the parser currently discards it. Capture it as the fallback scope label for Task 6. (Assessment item 3, part 1.)

**Files:**
- Modify: `src/diff.ts:5` (`HUNK_RE`) and the hunk construction (~line 76)
- Modify: `src/types.ts:351` (`DiffHunk`)
- Test: `test/diff.test.mjs`

**Interfaces:**
- Consumes: raw unified diff text (unchanged input).
- Produces: `DiffHunk.context?: string` — the trimmed funcname text from the `@@` header, `undefined` when absent. Task 6 reads it.

- [ ] **Step 1: Write the failing test**

Add to `test/diff.test.mjs` (match the file's existing fixture style):

```js
test('hunk headers keep the trailing function context', () => {
  const raw = [
    'diff --git a/a.sol b/a.sol',
    '--- a/a.sol',
    '+++ b/a.sol',
    '@@ -10,2 +10,3 @@ contract PartyBExecutionFacet {',
    ' ctx',
    '-old',
    '+new',
    '+newer',
    '',
  ].join('\n');
  const [file] = parseUnifiedDiff(raw);
  assert.equal(file.hunks[0].context, 'contract PartyBExecutionFacet {');
});

test('hunk headers without context leave it undefined', () => {
  const raw = ['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '@@ -1 +1 @@', '-a', '+b', ''].join('\n');
  const [file] = parseUnifiedDiff(raw);
  assert.equal(file.hunks[0].context, undefined);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run build && node --test test/diff.test.mjs`
Expected: FAIL — `context` is undefined in the first test only because the regex drops it; assert exposes it.

- [ ] **Step 3: Implement**

In `src/diff.ts`:

```ts
const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: (.+))?$/;
```

and in the hunk construction:

```ts
const context = hm[5]?.trim() || undefined;
hunk = { oldStart, oldLines, newStart, newLines, context, lines: [] };
```

In `src/types.ts`, add to `DiffHunk`:

```ts
/** git's funcname text after the second @@ — the nearest enclosing declaration. */
context?: string;
```

- [ ] **Step 4: Build and run**

Run: `npm run build && node --test test/diff.test.mjs && npm run check`
Expected: PASS.

- [ ] **Step 5: Commit (dist included)**

```bash
git add src/diff.ts src/types.ts test/diff.test.mjs dist
git commit -m "feat: parse hunk function context from diff headers"
```

---

### Task 6: Sticky enclosing-scope row per hunk (split view)

**Why:** A hunk deep inside a long Solidity function gives no orientation beyond a stray `} private returns …` fragment. Render a one-line scope label at the top of each split hunk — computed by indentation scan of the new file, falling back to git's funcname — and keep it stuck below the Before/After header while the hunk scrolls. (Assessment item 3, part 2.)

**Files:**
- Create: `src/enclosing-scope.ts`
- Modify: `src/server.ts:2219-2243` (`renderSplitResponse`), `src/render.ts:1116-1177` (`renderSplitHunks`)
- Modify: `client/surfaces/review/review.css` (`.ds-diffhead` explicit height; new `.ds-hunk` / `.ds-scoperow` rules)
- Test: create `test/enclosing-scope.test.mjs`; extend `test/diff-render.test.mjs`

**Interfaces:**
- Consumes: `DiffHunk.context` (Task 5), `readWholeFile(repo, file, head)` already used in `renderFullFileResponse` (`src/server.ts:2202`), `renderSplitHunks` opts (Task 3/4 shape).
- Produces: `export function enclosingScopeLabel(lines: string[], startLine: number): string | undefined` in `src/enclosing-scope.ts`; `renderSplitHunks` gains `opts.scopes?: Array<string | undefined>` and wraps each hunk in `<div class="ds-hunk">`, prepending `<div class="ds-scoperow">` when a label exists.

- [ ] **Step 1: Write the failing scope-label tests**

Create `test/enclosing-scope.test.mjs`:

```js
// The indentation-based enclosing-scope heuristic. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enclosingScopeLabel } from '../dist/enclosing-scope.js';

const SOL = [
  '// SPDX-License-Identifier: MIT',            // 1
  'contract PartyBFacet {',                     // 2
  '    uint256 nonce;',                         // 3
  '',                                           // 4
  '    function fillCloseRequest(',             // 5
  '        uint256 quoteId',                    // 6
  '    ) private returns (uint256 filled) {',   // 7
  '        uint256 a;',                         // 8
  '        if (a > 0) {',                       // 9
  '            a = 1;',                         // 10
  '        }',                                  // 11
  '        return a;',                          // 12
  '    }',                                      // 13
  '}',                                          // 14
];

test('finds the innermost lower-indent opener above the hunk', () => {
  assert.equal(enclosingScopeLabel(SOL, 10), 'if (a > 0)');
  assert.equal(enclosingScopeLabel(SOL, 12), 'function fillCloseRequest(');
  assert.equal(enclosingScopeLabel(SOL, 3), 'contract PartyBFacet');
});

test('skips closers, blanks, and comment lines while scanning', () => {
  const lines = ['function f() {', '    x;', '    }', '    // note', '    y;'];
  assert.equal(enclosingScopeLabel(lines, 5), 'function f()');
});

test('top-level code has no enclosing scope', () => {
  assert.equal(enclosingScopeLabel(['const a = 1;', 'const b = 2;'], 2), undefined);
});

test('long labels are truncated with an ellipsis', () => {
  const lines = ['function ' + 'x'.repeat(120) + '() {', '    y;'];
  const label = enclosingScopeLabel(lines, 2);
  assert.ok(label.length <= 90);
  assert.ok(label.endsWith('…'));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run build && node --test test/enclosing-scope.test.mjs`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/enclosing-scope.ts`**

```ts
// Language-agnostic "where am I" label for a diff hunk: scan upward from the
// hunk's first line for the nearest non-blank line with strictly lower
// indentation that opens a scope, skipping closers and comments. Works on
// indentation alone so Solidity, TS, Python, and friends all resolve without
// per-language grammars; callers fall back to git's funcname when this
// returns undefined.
const SKIP_RE = /^\s*(\}|\)|\]|else\b|\/\/|\/\*|\*|#|<!--|['"`])/;
const MAX_LABEL = 90;

function indentWidth(line: string): number {
  let w = 0;
  for (const ch of line) {
    if (ch === ' ') w += 1;
    else if (ch === '\t') w += 4;
    else break;
  }
  return w;
}

export function enclosingScopeLabel(lines: string[], startLine: number): string | undefined {
  const startIdx = Math.min(Math.max(startLine, 1), lines.length) - 1;
  // Indent of the first non-blank line at or after the hunk start.
  let base: number | undefined;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim()) {
      base = indentWidth(lines[i]);
      break;
    }
  }
  if (base === undefined || base === 0) return undefined;
  for (let i = startIdx - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim() || SKIP_RE.test(line)) continue;
    if (indentWidth(line) < base) {
      const label = line.trim().replace(/\s*\{\s*$/, '');
      if (!label) continue;
      return label.length > MAX_LABEL ? label.slice(0, MAX_LABEL - 1) + '…' : label;
    }
  }
  return undefined;
}
```

Run: `npm run build && node --test test/enclosing-scope.test.mjs` — expect PASS. If an assertion disagrees with the implementation on an edge (e.g. the multi-line signature case returning `function fillCloseRequest(`), fix the TEST expectation only if the implemented behavior is genuinely more useful; otherwise fix the code.

- [ ] **Step 4: Write the failing renderer test**

Add to `test/diff-render.test.mjs` (again via `renderSplitHunks`):

```js
test('split hunks wrap in ds-hunk and carry a scope row when a label exists', () => {
  const block = [[{ type: 'ctx', content: 'x', oldNo: 5, newNo: 5 }]];
  const html = renderSplitHunks(block, {
    file: 'a.sol', oldFile: 'a.sol', newFile: false,
    hunkRanges: [[5, 5]], canExpand: false,
    scopes: ['function fillCloseRequest('],
  });
  assert.match(html, /<div class="ds-hunk"><div class="ds-scoperow"><code>function fillCloseRequest\(<\/code><\/div>/);
});

test('a hunk without a scope label gets the wrapper but no scope row', () => {
  const block = [[{ type: 'ctx', content: 'x', oldNo: 5, newNo: 5 }]];
  const html = renderSplitHunks(block, {
    file: 'a.sol', oldFile: 'a.sol', newFile: false,
    hunkRanges: [[5, 5]], canExpand: false,
  });
  assert.match(html, /<div class="ds-hunk">/);
  assert.doesNotMatch(html, /ds-scoperow/);
});
```

Run: `node --test test/diff-render.test.mjs` — expect FAIL.

- [ ] **Step 5: Implement the renderer + server wiring**

`src/render.ts` — `renderSplitHunks`: add `scopes?: Array<string | undefined>` to the opts interface and wrap each block (building on Task 4's shape):

```ts
const body =
  blocks
    .map((block, bi) => {
      const { rows: pairedRows, sides } = pairChangeRows(block);
      const scope = opts.scopes?.[bi];
      const scopeRow = scope ? `<div class="ds-scoperow"><code>${esc(scope)}</code></div>` : "";
      return (
        gapBefore(bi) +
        `<div class="ds-hunk">${scopeRow}${pairedRows.map((row) => fullRow(row, opts, sides)).join("")}</div>`
      );
    })
    .join("") + gapAfterLast;
```

`src/server.ts` — `renderSplitResponse`: import `enclosingScopeLabel` from `./enclosing-scope.js`, and before the return add:

```ts
const newLines = df && df.status !== "deleted" ? readWholeFile(page.repo, file, page.head) : undefined;
const scopes = df
  ? df.hunks.map((h) => (newLines ? enclosingScopeLabel(newLines, h.newStart) : undefined) ?? h.context)
  : [];
```

and pass `scopes` in the `renderSplitHunks` opts. (Match the exact `readWholeFile` call shape used at `src/server.ts:2202` — destructure `repo`/`head` from `page` the way `renderFullFileResponse` does.)

- [ ] **Step 6: Add the CSS**

In `review.css`:
1. Give the split header a fixed height so the scope row can stack under it: on `.ds-diffhead` add `height:var(--ds-diffhead-h)` and define `--ds-diffhead-h:26px` on the same rule. Verify the labels still center (add `align-items:center` if they don't).
2. Add:

```css
.ds-hunk{display:block}
.ds-scoperow{position:sticky;top:calc(var(--ds-stickytop,0px) - var(--ds-scrollpad-t,0px) + var(--ds-diffhead-h,26px));z-index:6;display:flex;align-items:center;min-width:0;padding:3px 10px 3px 14px;background:var(--gutter-hi);border-bottom:1px solid var(--diff-rule);color:var(--muted);font-size:10.5px}
.ds-scoperow code{font:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
```

The sticky `top` mirrors `.ds-diffhead`'s own formula (`review.css:753`) plus the header height, and z-index 6 sits below the header (8) and toolbar (9). Each `.ds-hunk` is the sticky containing block, so the label releases when its hunk scrolls past and the next hunk's label takes over.

- [ ] **Step 7: Build and run everything**

Run: `npm run build && node --check dist/client/review.js && npm run check`
Expected: PASS, perf tripwire included. If any test pins the old flat split-body structure (rows as direct children of `ds-diffbody`), update it to expect the `ds-hunk` wrappers.

- [ ] **Step 8: Interactive verification**

Run `npm run demo` and open a long file in Split view. Confirm: scope labels are correct for nested Solidity/TS code; a label sticks under the Before/After header while its hunk scrolls and hands off at the next hunk; expand-context (`↑ 5 lines` / `Show all`) still inserts rows correctly around the gaps (expanded context lands between hunk wrappers — verify no visual seam); comment selection across rows inside a wrapper still works.

- [ ] **Step 9: Commit (dist included)**

```bash
git add src/enclosing-scope.ts src/server.ts src/render.ts client/surfaces/review/review.css test/enclosing-scope.test.mjs test/diff-render.test.mjs dist
git commit -m "feat: sticky enclosing-scope row on split hunks"
```

---

### Task 7: Changelog and final sweep

**Why:** Repo keeps a human changelog; the campaign needs one final all-green verification with fresh eyes.

**Files:**
- Modify: `CHANGELOG.md` (Unreleased section)

**Interfaces:**
- Consumes: everything above. Produces: nothing.

- [ ] **Step 1: Add changelog entries**

Under `## Unreleased` in `CHANGELOG.md`, add (match the existing bullet voice):

```markdown
- Paired deleted/added lines onto single side-by-side rows in the Split and
  full-file views, with word-level change marks on both sides of each pair.
- Marked absent-side regions in split panes with a quiet hatch so added or
  removed blocks read as "did not exist here" instead of blank space.
- Added a sticky enclosing-scope label to each split hunk so long functions
  stay oriented while scrolling.
- Decluttered the split header (paths shown only for renames), added +N −M
  change stats to each file panel, and made expand-context controls visible
  and labeled.
```

- [ ] **Step 2: Full verification**

Run: `npm run check`
Expected: all tests PASS. Then `npm run demo` for a last visual pass over: light + dark themes, a renamed file's header, a new file (hatched left pane, "Did not exist" label, no scope rows misbehaving), and change-jump across paired rows.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for all-files diff view enhancements"
```
