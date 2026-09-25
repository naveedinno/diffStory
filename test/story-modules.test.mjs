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
