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
