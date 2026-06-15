// Unit tests for agent detection + command building (not the real spawn). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onPath, storyPrompt, agentCommand } from '../dist/agent.js';

test('onPath finds sh, not a bogus command', () => {
  assert.equal(onPath('sh'), true);
  assert.equal(onPath('definitely-not-a-real-cmd-xyz'), false);
});

test('storyPrompt names the base and the output file', () => {
  const p = storyPrompt('main (abc123)');
  assert.ok(p.includes('main (abc123)'));
  assert.ok(p.includes('.diffstory/story.json'));
});

test('agentCommand builds headless invocations', () => {
  assert.deepEqual(agentCommand('claude', 'GO'), [
    'claude',
    ['-p', 'GO', '--permission-mode', 'acceptEdits'],
  ]);
  assert.deepEqual(agentCommand('codex', 'GO'), ['codex', ['exec', '--full-auto', 'GO']]);
});
