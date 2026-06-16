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
  assert.ok(p.includes('Reading order contract'));
  assert.ok(p.includes('do not emit one step per file'));
  assert.ok(p.includes('what to verify'));
  assert.ok(p.includes('Run diffstory check'));
});

test('agentCommand builds headless invocations with a safe default model', () => {
  assert.deepEqual(agentCommand('claude', 'GO'), [
    'claude',
    ['-p', 'GO', '--permission-mode', 'acceptEdits', '--model', 'sonnet'],
  ]);
  assert.deepEqual(agentCommand('codex', 'GO'), ['codex', ['exec', '--full-auto', 'GO']]);
});

test('agentCommand honors an explicit model', () => {
  assert.deepEqual(agentCommand('claude', 'GO', 'opus')[1], [
    '-p', 'GO', '--permission-mode', 'acceptEdits', '--model', 'opus',
  ]);
  assert.deepEqual(agentCommand('codex', 'GO', 'gpt-5')[1], ['exec', '--full-auto', '--model', 'gpt-5', 'GO']);
});
