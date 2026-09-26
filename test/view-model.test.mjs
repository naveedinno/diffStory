// Unit tests for the full-file side-by-side reconstruction. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseUnifiedDiff } from '../dist/diff.js';
import { buildFullFileRows, buildPairedBlocks, buildReviewModel, hunksToSbsBlocks, pairChangeRows } from '../dist/view-model.js';
import { commitEvolutionManifest } from '../dist/git.js';

const DIFF = [
  'diff --git a/a.ts b/a.ts',
  '--- a/a.ts',
  '+++ b/a.ts',
  '@@ -1,2 +1,3 @@',
  ' line1',
  '+added2',
  ' line3',
].join('\n');

test('reconstructs the whole file: context both sides, add on the right', () => {
  const [file] = parseUnifiedDiff(DIFF);
  const rows = buildFullFileRows(file, ['line1', 'added2', 'line3'], []);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].type, 'ctx');
  assert.equal(rows[0].oldNo, 1);
  assert.equal(rows[0].newNo, 1);
  assert.equal(rows[1].type, 'add');
  assert.equal(rows[1].newNo, 2);
  assert.equal(rows[1].oldNo, undefined);
  assert.equal(rows[2].type, 'ctx');
  assert.equal(rows[2].newNo, 3);
});

test('flags untoured added lines by range', () => {
  const [file] = parseUnifiedDiff(DIFF);
  const rows = buildFullFileRows(file, ['line1', 'added2', 'line3'], [[2, 2]]);
  const add = rows.find((r) => r.type === 'add');
  assert.equal(add.untoured, true);
});

test('a context-only file (no diff) renders entirely as unchanged', () => {
  const rows = buildFullFileRows(undefined, ['a', 'b', 'c'], []);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.type === 'ctx'));
  assert.equal(rows[2].oldNo, 3);
  assert.equal(rows[2].newNo, 3);
});

test('paired rows align independent file streams at the semantic anchor tops', () => {
  const [rows] = buildPairedBlocks(
    { startLine: 8, lines: ['old 8', 'old 9', 'old anchor', 'old 11'] },
    { startLine: 19, lines: ['new anchor', 'new 20', 'new 21'] },
    [10, 10],
    [19, 19],
  );
  assert.equal(rows[0].rightContent, undefined, 'new stream receives lead-in filler');
  assert.equal(rows[2].oldNo, 10);
  assert.equal(rows[2].newNo, 19);
  assert.equal(rows[2].leftContent, 'old anchor');
  assert.equal(rows[2].rightContent, 'new anchor');
  assert.equal(rows.at(-1).leftContent, undefined, 'shorter old stream receives trailing filler');
});

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

test('hunksToSbsBlocks tolerates an absent file (context-only degrade path)', () => {
  // Split view for a context-only file (referenced by a step, absent from the
  // diff) has no DiffFile — the endpoint passes undefined and expects [].
  assert.deepEqual(hunksToSbsBlocks(undefined, []), []);
});

test('concept primers stay in reading order but out of file and coverage views', () => {
  const parsed = parseUnifiedDiff(DIFF);
  const tour = {
    version: 2,
    title: 'Concept-first story',
    summary: 'Learn the request lifecycle, then review its implementation.',
    steps: [
      {
        id: 'primer',
        order: 1,
        title: 'The request lifecycle',
        kind: 'concept',
        body: 'A request is normalized before the policy receives it.',
        preparesFor: ['implementation'],
        diagram: {
          type: 'mermaid',
          source: 'flowchart LR\n  Request --> Normalize --> Policy',
          caption: 'The request lifecycle before the changed policy.',
        },
      },
      {
        id: 'implementation',
        order: 2,
        title: 'Apply the policy',
        file: 'a.ts',
        range: [1, 3],
        kind: 'changed',
        why: 'The changed line applies the policy.',
      },
    ],
  };

  const model = buildReviewModel(process.cwd(), tour, parsed);

  assert.equal(model.totalSteps, 2);
  assert.equal(model.codeSteps, 1);
  assert.equal(model.conceptSteps, 1);
  assert.equal(model.steps[0].kind, 'concept');
  assert.equal(model.steps[0].sceneLayout, 'concept-diagram');
  assert.equal(model.steps[1].sceneLayout, 'code-focus');
  // Narrative arrives projected now, not raw: this plain-prose body is identical
  // in all three forms, which is exactly what it should be when there is no markup.
  assert.equal(model.steps[0].body.html, tour.steps[0].body);
  assert.equal(model.steps[0].body.text, tour.steps[0].body);
  assert.equal(model.steps[0].body.speech, tour.steps[0].body);
  assert.deepEqual(model.steps[0].preparesFor.map((p) => ({ id: p.id, order: p.order, title: p.title.text })), [
    { id: 'implementation', order: 2, title: 'Apply the policy' },
  ]);
  assert.equal(model.steps[0].diagram.type, tour.steps[0].diagram.type);
  assert.equal(model.steps[0].diagram.source, tour.steps[0].diagram.source);
  assert.equal(model.steps[0].diagram.caption.text, tour.steps[0].diagram.caption);
  assert.equal(model.files.length, 1);
  assert.equal(model.files[0].file, 'a.ts');
  assert.equal(model.files[0].stepId, 'implementation');
  assert.equal(model.trust.uncovered.length, 0);
});

test('a v4 page concept carries narration but never exposes its page HTML', () => {
  const parsed = parseUnifiedDiff(DIFF);
  const tour = {
    version: 4,
    title: 'Page-concept story',
    summary: 'Play with the margin simulator, then review the change that backs it.',
    steps: [
      {
        id: 'primer',
        order: 1,
        title: 'Margin simulator',
        kind: 'concept',
        page: '<html><head><script src="https://cdn.jsdelivr.net/npm/chart.js"></script></head><body>Drag the price</body></html>',
        narration: 'Drag the price and watch the margin line cross the liquidation threshold.',
      },
      {
        id: 'implementation',
        order: 2,
        title: 'Apply the policy',
        file: 'a.ts',
        range: [1, 3],
        kind: 'changed',
        why: 'The changed line applies the policy.',
      },
    ],
  };

  const model = buildReviewModel(process.cwd(), tour, parsed);
  const concept = model.steps.find((s) => s.kind === 'concept');
  assert.equal(concept.hasPage, true);
  assert.equal(concept.sceneLayout, 'concept-page');
  assert.equal(concept.narration.text, 'Drag the price and watch the margin line cross the liquidation threshold.');
  assert.equal(concept.body, undefined);
  assert.doesNotMatch(JSON.stringify(model), /cdn\.jsdelivr/, 'the page HTML never enters the view model');
});

test('story shape and verified evolution project into the review model', () => {
  const repo = mkdtempSync(join(tmpdir(), 'ds-view-evolution-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    writeFileSync(join(repo, 'a.ts'), 'export const value = 0;\n');
    git('add', '.');
    git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD');
    for (const value of [1, 2]) {
      writeFileSync(join(repo, 'a.ts'), `export const value = ${value};\n`);
      git('add', '.');
      git('commit', '-qm', `set value ${value}`);
    }
    const head = git('rev-parse', 'HEAD');
    const manifest = commitEvolutionManifest(repo, base, head);
    const tour = {
      version: 3,
      title: 'Stable shape',
      summary: 'Read the decision and its proof.',
      storyArc: { changeType: 'bug-fix', shape: 'cause-effect', readingPath: 'failure -> fix -> proof' },
      evolution: {
        baseSha: base,
        headSha: head,
        phases: [{
          title: 'Close the gap',
          summary: 'The implementation lands, then its final behavior is pinned.',
          firstCommit: manifest.commits[0].sha,
          lastCommit: manifest.commits[1].sha,
          relatedSteps: ['decision'],
        }],
      },
      steps: [{ id: 'decision', order: 1, title: 'Changed decision', file: 'a.ts', range: [1, 1], kind: 'changed', why: 'Review the chosen value.' }],
    };
    const model = buildReviewModel(repo, tour, [], undefined, { storyIdentity: 'shape-v1' });
    assert.deepEqual(model.story.arc, {
      changeType: 'bug-fix', changeTypeLabel: 'Bug fix',
      shape: 'cause-effect', shapeLabel: 'Cause and effect',
      readingPath: 'failure -> fix -> proof',
    });
    assert.equal(model.story.evolution.commitCount, 2);
    assert.equal(model.story.evolution.phases[0].commitCount, 2);
    assert.equal(model.story.evolution.phases[0].summary.text, 'The implementation lands, then its final behavior is pinned.');
    assert.equal(model.story.evolution.phases[0].relatedPanelIndex, 1);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('code steps derive focus groups, chapters, and broad-step health', () => {
  const tour = {
    version: 1,
    title: 'Defensive focus',
    summary: '',
    steps: [{
      id: 's1', order: 1, title: 'External call stays bounded', chapter: 'Execution',
      file: 'a.ts', range: [20, 22], viewport: [1, 45], highlights: [[20, 22]],
      beats: [{ text: 'Inspect the call.', highlights: [[20, 22]] }],
      kind: 'changed', why: 'The call is bounded.',
    }],
  };
  const files = [{
    oldPath: 'a.ts', newPath: 'a.ts', status: 'modified',
    hunks: [{ oldStart: 20, oldLines: 0, newStart: 20, newLines: 3, lines: [
      { type: 'add', content: 'call();', newNo: 20 },
      { type: 'add', content: 'clear();', newNo: 21 },
      { type: 'add', content: 'verify();', newNo: 22 },
    ] }],
  }];
  const model = buildReviewModel(process.cwd(), tour, files);
  const step = model.steps[0];
  assert.equal(step.sceneLayout, 'code-focus', 'version 1 code projects without migration');
  assert.equal(step.chapter, 'Execution');
  assert.deepEqual(step.focusGroups, [[[20, 22]]]);
  assert.equal(step.health.broad, true);
  assert.ok(step.health.reasons.includes('45 lines in one step'));
});

test('version 3 cross-file moves project a paired-code scene without changing the story', () => {
  const parsed = parseUnifiedDiff(DIFF);
  const tour = {
    version: 3,
    title: 'Cross-file extraction',
    summary: 'Read the old owner beside the new one.',
    steps: [{
      id: 's1', order: 1, title: 'The helper gets a new owner',
      file: 'a.ts', range: [1, 3], kind: 'changed', why: 'The behavior moved.',
      moves: [{
        id: 'extract-helper', kind: 'extracted', label: 'moved here',
        before: { file: 'legacy.ts', range: [1, 2] },
        after: { file: 'a.ts', range: [1, 2] },
      }],
    }],
  };

  const model = buildReviewModel(process.cwd(), tour, parsed);
  assert.equal(model.steps[0].sceneLayout, 'paired-code');
  assert.equal('sceneLayout' in tour.steps[0], false, 'scene identity remains a view projection');
});

test('hotspots resolve to ordered panels and flag their step views', () => {
  const tour = {
    version: 2,
    title: 'Distrust map',
    summary: '',
    hotspots: [
      { step: 's2', reason: 'I never exercised the retry path.' },
      { step: 'ghost', reason: 'dropped: unknown step' },
    ],
    steps: [
      { id: 's1', order: 1, title: 'Entry', file: 'a.ts', range: [20, 20], kind: 'changed', why: 'w' },
      { id: 's2', order: 2, title: 'Retry boundary', file: 'a.ts', range: [21, 22], kind: 'changed', why: 'w' },
    ],
  };
  const files = [{
    oldPath: 'a.ts', newPath: 'a.ts', status: 'modified',
    hunks: [{ oldStart: 20, oldLines: 0, newStart: 20, newLines: 3, lines: [
      { type: 'add', content: 'call();', newNo: 20 },
      { type: 'add', content: 'retry();', newNo: 21 },
      { type: 'add', content: 'verify();', newNo: 22 },
    ] }],
  }];
  const model = buildReviewModel(process.cwd(), tour, files);
  // title and reason are projections now, so compare their text form.
  assert.deepEqual(
    model.hotspots.map((h) => ({
      stepId: h.stepId, panelIndex: h.panelIndex, order: h.order,
      title: h.title.text, reason: h.reason.text,
    })),
    [{ stepId: 's2', panelIndex: 2, order: 2, title: 'Retry boundary', reason: 'I never exercised the retry path.' }],
  );
  assert.equal(model.steps[0].hotspot, undefined);
  assert.equal(model.steps[1].hotspot.text, 'I never exercised the retry path.');
});

test('story overview file scope stays focused while All Files keeps complete diff totals', () => {
  const scopedTour = {
    version: 1,
    title: 'Focused story',
    summary: 'Review only the selected production path.',
    storyScope: { includedFiles: ['a.ts'], excludedFiles: ['b.test.ts'] },
    steps: [{ id: 's1', order: 1, title: 'Production path', file: 'a.ts', range: [2, 2], kind: 'changed', why: 'w' }],
  };
  const scopedFiles = [
    {
      oldPath: 'a.ts', newPath: 'a.ts', status: 'modified',
      hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [
        { type: 'ctx', content: 'keep', oldNo: 1, newNo: 1 },
        { type: 'add', content: 'production();', newNo: 2 },
      ] }],
    },
    {
      oldPath: 'b.test.ts', newPath: 'b.test.ts', status: 'modified',
      hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [
        { type: 'del', content: 'old test', oldNo: 1 },
        { type: 'add', content: 'new test', newNo: 1 },
        { type: 'add', content: 'another test', newNo: 2 },
      ] }],
    },
  ];

  const model = buildReviewModel(process.cwd(), scopedTour, scopedFiles);

  assert.equal(model.files.length, 2, 'All Files keeps the complete diff');
  assert.equal(model.filesChanged, 2);
  assert.equal(model.totalAdd, 3);
  assert.equal(model.totalDel, 1);
  assert.equal(model.storyFilesChanged, 1);
  assert.equal('storyTotalAdd' in model, false);
  assert.equal('storyTotalDel' in model, false);
});

test('lazy file indexes keep the authored story file count truthful before diff bodies load', () => {
  const lazyTour = {
    version: 3,
    title: 'Lazy story',
    summary: 'The overview renders before file bodies.',
    steps: [
      { id: 's1', order: 1, title: 'Changed path', file: 'a.ts', range: [1, 1], kind: 'changed', why: 'w' },
      { id: 's2', order: 2, title: 'Context path', file: 'context.ts', range: [1, 1], kind: 'context', why: 'w' },
    ],
  };
  const fileIndex = [
    { oldPath: 'a.ts', path: 'a.ts', status: 'modified', added: 2, removed: 1, byteSize: 24, binary: false, large: false, generated: false, metadataOnly: false, reviewHash: 'a' },
    { oldPath: 'outside.ts', path: 'outside.ts', status: 'modified', added: 1, removed: 0, byteSize: 16, binary: false, large: false, generated: false, metadataOnly: false, reviewHash: 'b' },
  ];

  const model = buildReviewModel(process.cwd(), lazyTour, [], undefined, { fileIndex, trustPending: true });

  assert.equal(model.filesChanged, 2, 'All Files still reports every indexed change');
  assert.equal(model.storyFilesChanged, 1, 'only authored changed paths count as story files while coverage is lazy');
});

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
  assert.equal(out.length, 4, 'ctx + two merged pairs + one leftover add');
  assert.equal(out[1].changePair, true);
  assert.equal(out[1].paired, true);
  assert.equal(out[1].oldNo, 2);
  assert.equal(out[1].newNo, 2);
  assert.equal(out[1].leftContent, 'uint256 fee = solverFee * filled / uncapped;');
  assert.equal(out[1].rightContent, 'uint256 fee = solverFee * filled / plan.uncapped;');
  assert.ok(sides.get(out[1])?.left, 'similar pair carries intra-line marks');
  assert.equal(sides.get(out[2]), undefined, 'dissimilar pair gets no intra marks');
  assert.equal(out[3].type, 'add', 'unpaired excess keeps its single-sided row');
  assert.equal(out[3].changePair, undefined);
});

test('pairChangeRows leaves already-paired story rows untouched', () => {
  const rows = [{ type: 'ctx', paired: true, leftContent: 'x', rightContent: 'y', content: 'y' }];
  const { rows: out } = pairChangeRows(rows);
  assert.equal(out[0], rows[0]);
});

test('pairChangeRows carries the untoured flag from the added side', () => {
  const rows = [
    { type: 'del', oldNo: 4, content: 'const a = compute(x);' },
    { type: 'add', newNo: 4, content: 'const a = compute(y);', untoured: true },
  ];
  const { rows: out } = pairChangeRows(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].untoured, true);
});

test('pairChangeRows leaves a pure deletion run single-sided', () => {
  const rows = [
    { type: 'del', oldNo: 7, content: 'gone();' },
    { type: 'ctx', oldNo: 8, newNo: 7, content: 'kept();' },
  ];
  const { rows: out } = pairChangeRows(rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].type, 'del');
  assert.equal(out[0].changePair, undefined);
});

test('a scoped story is measured only against its included files', async () => {
  const { filesForStoryCoverage } = await import('../dist/view-model.js');
  const files = [{ newPath: 'src/a.ts', hunks: [] }, { newPath: 'test/a.test.ts', hunks: [] }];
  assert.deepEqual(filesForStoryCoverage({ storyScope: { includedFiles: ['src/a.ts'] } }, files).map((f) => f.newPath), ['src/a.ts']);
  assert.equal(filesForStoryCoverage({}, files).length, 2);
});

// ---- moved lines ----
import { markMovedLines } from '../dist/view-model.js';

const del = (oldNo, content) => ({ type: 'del', oldNo, content });
const add = (newNo, content) => ({ type: 'add', newNo, content });
const ctx = (n, content = 'ctx') => ({ type: 'ctx', oldNo: n, newNo: n, content, comment: true });
const lineOf = (r) => (r.type === 'del' ? r.oldNo : r.newNo);

test('a line deleted in one place and added in another is marked moved both ways', () => {
  const rows = [ctx(120), del(121, '    quote.closedAmount += filledAmount;'), ctx(122), add(122, '        quote.closedAmount += filledAmount;'), ctx(123)];
  markMovedLines([rows], lineOf);
  assert.deepEqual(rows[1].moved, { side: 'right', line: 122 });
  assert.deepEqual(rows[3].moved, { side: 'left', line: 121 });
  const { rows: paired } = pairChangeRows(rows);
  assert.ok(paired.every((r) => !r.changePair), 'moved lines never pair as an edit');
});

test('moves need a meaningful, unambiguous line and are not in-place re-indents', () => {
  const trivial = [del(1, '}'), ctx(2), add(3, '}')];
  markMovedLines([trivial], lineOf);
  assert.equal(trivial[0].moved, undefined, 'a brace is not a move');

  const ambiguous = [del(1, 'emitSettlement(quoteId);'), del(2, 'emitSettlement(quoteId);'), ctx(3), add(4, 'emitSettlement(quoteId);')];
  markMovedLines([ambiguous], lineOf);
  assert.ok(ambiguous.every((r) => !r.moved), 'a repeated line has no single other end');

  const reindent = [del(5, '  settleFunding(quote);'), add(5, '    settleFunding(quote);')];
  markMovedLines([reindent], lineOf);
  assert.ok(reindent.every((r) => !r.moved), 'an edit in place stays an edit');

  const swap = [del(7, 'firstStatement(alpha);'), del(8, 'secondStatement(beta);'), add(7, 'secondStatement(beta);'), add(8, 'firstStatement(alpha);')];
  markMovedLines([swap], lineOf);
  assert.ok(swap.every((r) => r.moved), 'two swapped lines are two moves');
});

test('moves are found across hunks', () => {
  const blocks = [[ctx(10), del(11, 'uint256 cachedBalance = balanceOf(owner);'), ctx(12)], [ctx(80), add(79, 'uint256 cachedBalance = balanceOf(owner);'), ctx(81)]];
  markMovedLines(blocks, lineOf);
  assert.deepEqual(blocks[0][1].moved, { side: 'right', line: 79 });
  assert.deepEqual(blocks[1][1].moved, { side: 'left', line: 11 });
});

test('a moved line keeps its place in the column it belongs to', () => {
  // A two-argument signature grows to four: two of its lines survive at new
  // indices (moves), and the after column must still read top to bottom.
  const rows = [
    ctx(280, '    /**'),
    del(281, '    function deploySwapAccount('),
    del(282, '        address baseTokenAddress,'),
    del(283, '        address quoteTokenAddress,'),
    del(284, '    ) external onlyRole(TOKEN_MANAGER_ROLE) returns (address swapAccount) {'),
    add(282, '     * @return swapAccount The deployed SwapAccount address'),
    add(283, '     */'),
    add(284, '    function deploySwapAccountWithPermissions('),
    add(285, '        address baseTokenAddress,'),
    add(286, '        address quoteTokenAddress,'),
    add(287, '        address[] calldata initialOperators,'),
    add(288, '        address[] calldata initialWithdrawers'),
    add(289, '    ) external onlyRole(TOKEN_MANAGER_ROLE) returns (address swapAccount) {'),
    ctx(290, '        swapAccount = _deploySwapAccount(baseTokenAddress, quoteTokenAddress);'),
  ];
  markMovedLines([rows], lineOf);
  assert.ok(rows[9].moved && rows[12].moved, 'the reused signature lines are moves');

  const { rows: out } = pairChangeRows(rows);
  const after = out.filter((r) => r.newNo !== undefined).map((r) => r.newNo);
  assert.deepEqual(after, [280, 282, 283, 284, 285, 286, 287, 288, 289, 290], 'after column stays in line order');
  const before = out.filter((r) => r.oldNo !== undefined && r.type !== 'add').map((r) => r.oldNo);
  assert.deepEqual(before, [280, 281, 282, 283, 284, 290], 'before column stays in line order');
});

test('a moved line does not stop its neighbours pairing as an edit', () => {
  const rows = [
    del(10, 'const budget = plan.cap - plan.spent;'),
    del(11, 'emitBudgetReady(budget);'),
    add(10, 'const budget = plan.cap - plan.spent - plan.reserved;'),
    ctx(12, 'settle();'),
    add(13, 'emitBudgetReady(budget);'),
  ];
  markMovedLines([rows], lineOf);
  assert.ok(rows[1].moved, 'the re-emitted line is a move');
  const { rows: out } = pairChangeRows(rows);
  assert.equal(out[0].changePair, true, 'the edited line still pairs across the move');
  assert.equal(out[0].oldNo, 10);
  assert.equal(out[0].newNo, 10);
  assert.equal(out[1].type, 'del', 'the moved deletion keeps its own side');
  assert.ok(out[1].moved);
});
