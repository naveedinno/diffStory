// Unit tests for agent detection + command building (not the real spawn). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  onPath, storyPrompt, agentCommand, addressPrompt,
  streamCommand, parseClaudeStreamLine, parseCodexStreamLine,
} from '../dist/agent.js';

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

test('addressPrompt targets specific ids via the address-review skill', () => {
  const p = addressPrompt(['c_a', 'c_b']);
  assert.ok(p.includes('address-review'));
  assert.ok(p.includes('c_a, c_b'));
  assert.ok(p.includes('.diffstory/comments.json'));
  assert.ok(p.includes('Do not ask questions'));
});

test('addressPrompt handles the all-open case', () => {
  const p = addressPrompt('all');
  assert.ok(p.includes('every comment whose status is "open"'));
  assert.ok(p.includes('address-review'));
});

test('streamCommand uses stream-json for claude and exec for codex', () => {
  assert.deepEqual(streamCommand('claude', 'GO'), [
    'claude',
    ['-p', 'GO', '--output-format', 'stream-json', '--verbose',
     '--permission-mode', 'acceptEdits', '--model', 'sonnet'],
  ]);
  assert.deepEqual(streamCommand('codex', 'GO'), ['codex', ['exec', '--full-auto', 'GO']]);
  assert.deepEqual(streamCommand('codex', 'GO', 'gpt-5')[1], ['exec', '--full-auto', '--model', 'gpt-5', 'GO']);
});

test('parseClaudeStreamLine extracts assistant text and tool notices', () => {
  const textLine = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } });
  assert.deepEqual(parseClaudeStreamLine(textLine), [{ type: 'text', data: 'Hello' }]);

  const toolLine = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/x.ts' } }] },
  });
  assert.deepEqual(parseClaudeStreamLine(toolLine), [{ type: 'tool', data: '✏️ Edit src/x.ts' }]);
});

test('parseClaudeStreamLine ignores non-JSON, empty, and non-assistant lines', () => {
  assert.deepEqual(parseClaudeStreamLine('not json'), []);
  assert.deepEqual(parseClaudeStreamLine(''), []);
  assert.deepEqual(parseClaudeStreamLine(JSON.stringify({ type: 'system', subtype: 'init' })), []);
});

test('parseCodexStreamLine forwards non-empty lines as text', () => {
  assert.deepEqual(parseCodexStreamLine('working on it'), [{ type: 'text', data: 'working on it' }]);
  assert.deepEqual(parseCodexStreamLine('   '), []);
});
