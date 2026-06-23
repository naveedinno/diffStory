// Unit tests for agent detection + command building (not the real spawn). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  onPath, storyPrompt, normalizeStoryMode, agentCommand, addressPrompt,
  streamCommand, parseClaudeStreamLine, parseCodexStreamLine, toolSummary, classifyTool,
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
  assert.ok(p.includes('story paragraph'));
  assert.ok(p.includes('I added this parameter to method X'));
  assert.ok(p.includes('Voice contract'));
  assert.ok(p.includes('lively, specific, and a little fun'));
  assert.ok(p.includes('top-level "summary" is the overview'));
  assert.ok(p.includes('1-3 short informal sentences'));
  assert.ok(p.includes('first person'));
  assert.ok(p.includes('No long paragraphs'));
  assert.ok(p.includes('No corporate changelog voice'));
  assert.ok(p.includes('Run diffstory check'));
});

test('storyPrompt asks for a reviewer map and hard quality gates', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('private reviewer map'));
  assert.ok(p.includes('falsifiable mental model'));
  assert.ok(p.includes('Each step must answer a reviewer question'));
  assert.ok(p.includes('coverage ledger'));
  assert.ok(p.includes('Ranges are review windows, not coverage hacks'));
  assert.ok(p.includes('Truth contract'));
  assert.ok(p.includes('Do not claim tests pass unless you ran them'));
});

test('storyPrompt teaches explicit read-aloud focus targets', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Focus pointer contract'));
  assert.ok(p.includes('"focus"'));
  assert.ok(p.includes('"ranges"'));
  assert.ok(p.includes('inside that step'));
  assert.ok(p.includes('post-change line numbers'));
  assert.ok(p.includes('one or two lines'));
  assert.ok(p.includes('not the whole displayed section'));
});

test('storyPrompt supports a detailed correctness story mode', () => {
  assert.equal(normalizeStoryMode('detailed'), 'detailed');
  assert.equal(normalizeStoryMode('guided'), 'guided');
  assert.equal(normalizeStoryMode('anything else'), 'guided');

  const guided = storyPrompt('main');
  assert.ok(guided.includes('set its "mode" field to "guided"'));
  assert.ok(!guided.includes('Detailed correctness mode'));

  const detailed = storyPrompt('main', undefined, 'detailed');
  assert.ok(detailed.includes('git diff main --'));
  assert.ok(detailed.includes('set its "mode" field to "detailed"'));
  assert.ok(detailed.includes('Detailed correctness mode'));
  assert.ok(detailed.includes('line-by-line'));
  assert.ok(detailed.includes('all meaningful code paths'));
  assert.ok(detailed.includes('3-7 short sentences'));
  assert.ok(detailed.includes('split separate branches, guards, state writes, external calls, and error paths'));
});

test('bundled review-tour skill teaches reviewer-first story generation', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Make a reviewer map before JSON'));
  assert.ok(skill.includes('falsifiable mental model'));
  assert.ok(skill.includes('Hard quality gates'));
  assert.ok(skill.includes('coverage ledger'));
  assert.ok(skill.includes('Ranges are review windows, not coverage hacks'));
  assert.ok(skill.includes('Truth audit'));
  assert.ok(skill.includes('Do not claim tests pass unless you ran them'));
});

test('bundled review-tour skill teaches explicit read-aloud focus targets', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Focus pointer contract'));
  assert.ok(skill.includes('"focus"'));
  assert.ok(skill.includes('"ranges"'));
  assert.ok(skill.includes('inside that step'));
  assert.ok(skill.includes('post-change line numbers'));
  assert.ok(skill.includes('one or two lines'));
  assert.ok(skill.includes('not the whole displayed section'));
});

test('bundled review-tour skill teaches guided and detailed story modes', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Story modes'));
  assert.ok(skill.includes('Guided review mode'));
  assert.ok(skill.includes('Detailed correctness mode'));
  assert.ok(skill.includes('line-by-line'));
  assert.ok(skill.includes('all meaningful code paths'));
  assert.ok(skill.includes('"mode": "detailed"'));
});

test('storyPrompt records the head ref for fixed range stories', () => {
  const p = storyPrompt('main', 'feature/liquidation');
  assert.ok(p.includes('git diff main..feature/liquidation --'));
  assert.ok(p.includes('set its "base" field to "main" and its "head" field to "feature/liquidation"'));
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

test('classifyTool maps tools to the most specific progress event', () => {
  assert.deepEqual(classifyTool('Read', { file_path: 'src/x.ts' }),
    { type: 'file', action: 'read', rawTool: 'Read', target: 'src/x.ts', label: 'Reading src/x.ts' });
  assert.deepEqual(classifyTool('Write', { file_path: 'a/story.json' }),
    { type: 'file', action: 'write', rawTool: 'Write', target: 'a/story.json', label: 'Writing a/story.json' });
  assert.deepEqual(classifyTool('Edit', { file_path: 'src/y.ts' }),
    { type: 'file', action: 'edit', rawTool: 'Edit', target: 'src/y.ts', label: 'Editing src/y.ts' });
  const bash = classifyTool('Bash', { command: 'git   diff --stat' });
  assert.equal(bash.type, 'command');
  assert.equal(bash.command, 'git diff --stat');
  assert.deepEqual(classifyTool('Grep', { pattern: 'foo' }),
    { type: 'activity', kind: 'search', label: 'Grep foo' });
  assert.deepEqual(classifyTool('TodoWrite', {}),
    { type: 'activity', kind: 'plan', label: 'Updating the plan' });
  const unknown = classifyTool('MysteryTool', { path: 'p' });
  assert.equal(unknown.type, 'tool');
  assert.equal(unknown.rawTool, 'MysteryTool');
});

test('parseClaudeStreamLine yields text and classified tool events', () => {
  const textLine = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } });
  assert.deepEqual(parseClaudeStreamLine(textLine), [{ type: 'text', data: 'Hello' }]);

  const toolLine = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/x.ts' } }] },
  });
  assert.deepEqual(parseClaudeStreamLine(toolLine),
    [{ type: 'file', action: 'edit', rawTool: 'Edit', target: 'src/x.ts', label: 'Editing src/x.ts' }]);
});

test('toolSummary shows the command for Bash and the target for file tools', () => {
  assert.equal(toolSummary('Bash', { command: 'git   diff --stat' }), '$ git diff --stat');
  assert.equal(toolSummary('Read', { file_path: 'src/api.ts' }), 'Read src/api.ts');
  assert.equal(toolSummary('Grep', { pattern: 'foo' }), 'Grep foo');
  assert.equal(toolSummary('SomethingElse', {}), 'SomethingElse');
  assert.ok(toolSummary('Bash', { command: 'x'.repeat(200) }).endsWith('…'));
});

test('parseClaudeStreamLine ignores non-JSON, empty, and non-assistant lines', () => {
  assert.deepEqual(parseClaudeStreamLine('not json'), []);
  assert.deepEqual(parseClaudeStreamLine(''), []);
  assert.deepEqual(parseClaudeStreamLine(JSON.stringify({ type: 'system', subtype: 'init' })), []);
});

test('parseCodexStreamLine forwards prose as text and $-lines as commands', () => {
  assert.deepEqual(parseCodexStreamLine('working on it'), [{ type: 'text', data: 'working on it' }]);
  assert.deepEqual(parseCodexStreamLine('   '), []);
  const cmd = parseCodexStreamLine('$ npm test');
  assert.equal(cmd.length, 1);
  assert.equal(cmd[0].type, 'command');
  assert.equal(cmd[0].command, 'npm test');
});
