// Unit tests for agent detection + command building (not the real spawn). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  onPath, storyPrompt, normalizeStoryMode, agentCommand, addressPrompt,
  streamCommand, normalizeCodexRunOptions, parseClaudeStreamLine, parseCodexStreamLine, toolSummary, classifyTool, planItems,
} from '../dist/agent.js';

test('onPath finds sh, not a bogus command', () => {
  assert.equal(onPath('sh'), true);
  assert.equal(onPath('definitely-not-a-real-cmd-xyz'), false);
});

test('storyPrompt names the base and the output file', () => {
  const p = storyPrompt('main (abc123)');
  assert.ok(p.includes('main (abc123)'));
  assert.ok(p.includes('.diffstory/story.json'));
  assert.ok(p.includes('do not emit one step per file'));
  assert.ok(p.includes('synchronized story note'));
  assert.ok(p.includes('I added this parameter to method X'));
  assert.ok(p.includes('Voice contract'));
  assert.ok(p.includes('lively, specific, and a little fun'));
  assert.ok(p.includes('top-level "summary" is the reading map'));
  assert.ok(p.includes('1-3 short informal sentences'));
  assert.ok(p.includes('first person'));
  assert.ok(p.includes('No long paragraphs'));
  assert.ok(p.includes('No corporate changelog voice'));
  assert.ok(p.includes('the coverage gate is clean'));
});

test('storyPrompt recovers the why before reading the diff', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Phase 1 — Recover the why'));
  assert.ok(p.includes('gh pr view --json title,body'));
  assert.ok(p.includes('git log'));
  assert.ok(p.includes('Not evidence: branch names, filenames, vibes'));
  assert.ok(p.includes('We wanted to enable'));
  assert.ok(p.includes('designed the flow'));
  assert.ok(p.includes('"intent"'));
  assert.ok(p.includes('"sources"'));
  assert.ok(p.includes('code-derived'));
  assert.ok(p.includes('Never invent product intent'));
});

test('storyPrompt designs the reading path as a narrative, not a file list', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Phase 2 — Design the reading path'));
  assert.ok(p.includes('intent -> flow -> implementation'));
  assert.ok(p.includes('not a list of touched files'));
  assert.ok(p.includes('To implement that flow, I first'));
  assert.ok(p.includes('never by filename'));
  assert.ok(p.includes('Order test:'));
  assert.ok(p.includes('Thread rule:'));
  assert.ok(p.includes('one continuous story'));
});

test('storyPrompt ends with a falsifiable self-review', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Falsifiable self-review'));
  assert.ok(p.includes('Why test:'));
  assert.ok(p.includes('Thread test:'));
  assert.ok(p.includes('read only the beats'));
  assert.ok(p.includes('Do not ask questions. Generate it directly.'));
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

test('storyPrompt makes deleted-file steps use the changed kind', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Never use "deleted" as a step kind'));
  assert.ok(p.includes('For deleted files, use kind "changed"'));
  assert.ok(p.includes('anchor the range at the post-change deletion location'));
});

test('storyPrompt teaches the pure deleted-file sentinel anchor', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('For a whole deleted file, use range, viewport, and highlights of [0, 0]'));
  assert.ok(p.includes('Do not invent line 1 for a file that no longer exists'));
});

test('storyPrompt teaches explicit read-aloud focus targets', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Focus pointer contract'));
  assert.ok(p.includes('Prefer "highlights" for new stories'));
  assert.ok(p.includes('"focus"'));
  assert.ok(p.includes('"ranges"'));
  assert.ok(p.includes('inside that step\'s "viewport"'));
  assert.ok(p.includes('post-change line numbers'));
  assert.ok(p.includes('exact line or tiny block'));
  assert.ok(p.includes('line-by-line correctness pivots'));
});

test('storyPrompt teaches viewport and highlighted line selection', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Viewport contract'));
  assert.ok(p.includes('"viewport"'));
  assert.ok(p.includes('"highlights"'));
  assert.ok(p.includes('what the reviewer sees'));
  assert.ok(p.includes('lines the story is currently talking about'));
  assert.ok(p.includes('from the requirement'));
  assert.ok(p.includes('far-apart highlight islands'));
  assert.ok(p.includes('scroll-stable'));
});

test('storyPrompt requires beat-by-beat narration for read-aloud sync', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('Beat contract'));
  assert.ok(p.includes('"beats"'));
  assert.ok(p.includes('separate speech'));
  assert.ok(p.includes('one beat per highlighted code part'));
  assert.ok(p.includes('Do not put one big speech over several highlight groups'));
});

test('storyPrompt supports story detail levels', () => {
  assert.equal(normalizeStoryMode('brief'), 'brief');
  assert.equal(normalizeStoryMode('detailed'), 'detailed');
  assert.equal(normalizeStoryMode('guided'), 'guided');
  assert.equal(normalizeStoryMode('anything else'), 'guided');

  const guided = storyPrompt('main');
  assert.ok(guided.includes('set its "mode" field to "guided"'));
  assert.ok(guided.includes('Balanced mode'));
  assert.ok(!guided.includes('Line-by-line mode'));

  const brief = storyPrompt('main', undefined, 'brief');
  assert.ok(brief.includes('set its "mode" field to "brief"'));
  assert.ok(brief.includes('Brief mode'));
  assert.ok(brief.includes('one short sentence'));
  assert.ok(brief.includes('one compact stop per meaningful change cluster'));

  const detailed = storyPrompt('main', undefined, 'detailed');
  assert.ok(detailed.includes('git diff main --'));
  assert.ok(detailed.includes('set its "mode" field to "detailed"'));
  assert.ok(detailed.includes('Line-by-line mode'));
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
  assert.ok(skill.includes('`viewport` is the review window'));
  assert.ok(skill.includes('`range` is the coverage hook'));
  assert.ok(skill.includes('Truth audit'));
  assert.ok(skill.includes('Do not claim tests pass unless you ran them'));
});

test('bundled review-tour skill requires the narrative story arc', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Narrative arc'));
  assert.ok(skill.includes('We wanted to enable'));
  assert.ok(skill.includes('designed the flow'));
  assert.ok(skill.includes('To implement that flow, I first'));
  assert.ok(skill.includes('intent -> flow -> implementation'));
  assert.ok(skill.includes('not a list of touched files'));
});

test('bundled review-tour skill makes deleted-file steps use the changed kind', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Never use "deleted" as a step kind'));
  assert.ok(skill.includes('For deleted files, use kind "changed"'));
  assert.ok(skill.includes('anchor the range at the post-change deletion location'));
});

test('bundled review-tour skill teaches the pure deleted-file sentinel anchor', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('For a whole deleted file, use `range`, `viewport`, and `highlights` of `[0, 0]`'));
  assert.ok(skill.includes('Do not invent line 1 for a file that no longer exists'));
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

test('bundled review-tour skill teaches viewport and highlighted line selection', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Viewport contract'));
  assert.ok(skill.includes('`viewport`'));
  assert.ok(skill.includes('`highlights`'));
  assert.ok(skill.includes('what the reviewer sees'));
  assert.ok(skill.includes('lines the story is currently talking about'));
  assert.ok(skill.includes('from the requirement'));
  assert.ok(skill.includes('far-apart highlight islands'));
  assert.ok(skill.includes('steady camera shot'));
});

test('bundled review-tour skill requires beat-by-beat narration for read-aloud sync', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Beat contract'));
  assert.ok(skill.includes('`beats`'));
  assert.ok(skill.includes('separate speech'));
  assert.ok(skill.includes('one beat per highlighted code part'));
  assert.ok(skill.includes('Do not put one big speech over several highlight groups'));
});

test('bundled review-tour skill teaches story detail levels', () => {
  const skill = readFileSync(new URL('../skills/review-tour/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Detail levels'));
  assert.ok(skill.includes('Brief mode'));
  assert.ok(skill.includes('Balanced mode'));
  assert.ok(skill.includes('Line-by-line mode'));
  assert.ok(skill.includes('line-by-line'));
  assert.ok(skill.includes('all meaningful code paths'));
  assert.ok(skill.includes('"mode": "brief"'));
  assert.ok(skill.includes('"mode": "detailed"'));
});

test('storyPrompt records the head ref for fixed range stories', () => {
  const p = storyPrompt('main', 'feature/liquidation');
  assert.ok(p.includes('git diff main..feature/liquidation --'));
  assert.ok(p.includes('set its "base" field to "main" and its "head" field to "feature/liquidation"'));
});

test('storyPrompt excludes oversized files from the diff and tells the agent to skip them', () => {
  const p = storyPrompt('main', 'feature/x', 'guided', ['abis/symmio.json', 'docs/gen.html']);
  // The agent's own diff command must subtract the generated files via pathspec.
  assert.ok(p.includes("git diff main..feature/x -- ':(exclude)abis/symmio.json' ':(exclude)docs/gen.html'"));
  // And it must be told not to chase coverage on them (which would loop forever).
  assert.ok(p.includes('Scope contract'));
  assert.ok(p.includes('intentionally excluded from this review: abis/symmio.json, docs/gen.html'));
  assert.ok(p.includes('Do not read, narrate, or write steps for them'));
});

test('storyPrompt with no exclusions leaves the diff command untouched', () => {
  const p = storyPrompt('main');
  assert.ok(p.includes('git diff main --'));
  assert.ok(!p.includes(':(exclude)'));
  assert.ok(!p.includes('Scope contract'));
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

test('agentCommand maps Codex configuration to real exec flags', () => {
  assert.deepEqual(
    agentCommand('codex', 'GO', 'gpt-5-codex', {
      codex: {
        sandbox: 'workspace-write',
        provider: 'lmstudio',
        profile: 'story',
        config: ['model_reasoning_effort="high"', 'features.web_search=true'],
      },
    })[1],
    [
      'exec',
      '--sandbox',
      'workspace-write',
      '--oss',
      '--local-provider',
      'lmstudio',
      '--profile',
      'story',
      '-c',
      'model_reasoning_effort="high"',
      '-c',
      'features.web_search=true',
      '--model',
      'gpt-5-codex',
      'GO',
    ],
  );
  assert.deepEqual(
    agentCommand('codex', 'GO', undefined, { codex: { sandbox: 'danger-full-access', provider: 'ollama' } })[1],
    ['exec', '--dangerously-bypass-approvals-and-sandbox', '--oss', '--local-provider', 'ollama', 'GO'],
  );
});

test('normalizeCodexRunOptions keeps only supported story-generation options', () => {
  assert.deepEqual(normalizeCodexRunOptions({
    codexSandbox: 'workspace-write',
    codexProvider: 'ollama',
    codexProfile: ' review ',
    codexConfig: '# no\nfoo=true\nnot-a-config\nbar=\"baz\"',
  }), {
    sandbox: 'workspace-write',
    provider: 'ollama',
    profile: 'review',
    config: ['foo=true', 'bar="baz"'],
  });
});

test('addressPrompt targets specific ids via the address-review skill', () => {
  const p = addressPrompt(['c_a', 'c_b']);
  assert.ok(p.includes('address-review'));
  assert.ok(p.includes('c_a, c_b'));
  assert.ok(p.includes('.diffstory/comments.json'));
  assert.ok(p.includes('selected text'));
  assert.ok(!p.includes('file:line'));
  assert.ok(p.includes('Do not ask questions'));
});

test('addressPrompt handles the all-open case', () => {
  const p = addressPrompt('all');
  assert.ok(p.includes('every comment whose status is "open"'));
  assert.ok(p.includes('address-review'));
});

test('addressPrompt grounds answers in both sides when a base ref is given', () => {
  const p = addressPrompt(['c_a'], 'origin/main');
  assert.ok(p.includes('origin/main'));               // names the target side
  assert.ok(p.includes('git show origin/main:'));     // tells it how to read the other side
  assert.ok(p.includes('git diff origin/main --'));   // and how to see the change itself
  assert.ok(p.includes('working tree'));              // current side stays the working tree
  assert.ok(p.includes('side: "left"'));
  assert.ok(p.includes('side: "right"'));
});

test('addressPrompt grounds on base..head when both refs are committed', () => {
  const p = addressPrompt(['c_a'], 'origin/main', 'feature/x');
  assert.ok(p.includes('git show origin/main:'));        // target side
  assert.ok(p.includes('git show feature/x:'));          // current side is a ref, not the tree
  assert.ok(p.includes('git diff origin/main..feature/x --'));
  assert.ok(!p.includes('working tree'));                // not the working-tree variant
});

test('addressPrompt can describe a historical temporary checkout', () => {
  const p = addressPrompt(['c_a'], 'abc123', 'def456', {
    historicalCheckout: true,
    originalRepo: '/repo/live',
  });
  assert.ok(p.includes('temporary checkout of "def456"'));
  assert.ok(p.includes('/repo/live'));
  assert.ok(p.includes('Do not edit source files in this historical checkout'));
  assert.match(p, /appending a new ai turn/);
});

test('addressPrompt stays single-sided when no base ref is known', () => {
  const p = addressPrompt(['c_a']);
  assert.ok(!p.includes('Two-sided grounding contract'));
  assert.ok(!p.includes('git show'));
});

test('addressPrompt tells the agent to append an ai turn, not overwrite a reply', () => {
  const p = addressPrompt(['c_1'], 'main');
  assert.match(p, /"turns"/);
  assert.match(p, /append a new turn/i);
  assert.match(p, /"role":"ai"/);
  assert.match(p, /latest "user" message/i);
});

test('streamCommand uses stream-json for claude and exec for codex', () => {
  assert.deepEqual(streamCommand('claude', 'GO'), [
    'claude',
    ['-p', 'GO', '--output-format', 'stream-json', '--verbose',
     '--permission-mode', 'acceptEdits', '--model', 'sonnet'],
  ]);
  assert.deepEqual(streamCommand('codex', 'GO'), ['codex', ['exec', '--full-auto', 'GO']]);
  assert.deepEqual(streamCommand('codex', 'GO', 'gpt-5')[1], ['exec', '--full-auto', '--model', 'gpt-5', 'GO']);
  assert.deepEqual(streamCommand('codex', 'GO', 'gpt-5', { codex: { sandbox: 'read-only' } })[1], [
    'exec',
    '--sandbox',
    'read-only',
    '--model',
    'gpt-5',
    'GO',
  ]);
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
  assert.deepEqual(
    classifyTool('TodoWrite', {
      todos: [
        { content: 'Read the diff', activeForm: 'Reading the diff', status: 'completed' },
        { content: 'Draft the story', activeForm: 'Drafting the story', status: 'in_progress' },
        { content: 'Check coverage', activeForm: 'Checking coverage', status: 'pending' },
      ],
    }),
    {
      type: 'plan',
      items: [
        { text: 'Read the diff', status: 'done' },
        { text: 'Drafting the story', status: 'active' },
        { text: 'Check coverage', status: 'pending' },
      ],
    },
  );
  const unknown = classifyTool('MysteryTool', { path: 'p' });
  assert.equal(unknown.type, 'tool');
  assert.equal(unknown.rawTool, 'MysteryTool');
});

test('planItems maps statuses, prefers activeForm for the active item, drops empties', () => {
  assert.deepEqual(
    planItems([{ content: 'a', activeForm: 'doing a', status: 'in_progress' }]),
    [{ text: 'doing a', status: 'active' }],
  );
  // Non-active items use content even if activeForm is present.
  assert.deepEqual(
    planItems([{ content: 'a', activeForm: 'doing a', status: 'completed' }]),
    [{ text: 'a', status: 'done' }],
  );
  // Unknown/missing status falls back to pending; missing activeForm falls back to content.
  assert.deepEqual(
    planItems([{ content: 'b', status: undefined }]),
    [{ text: 'b', status: 'pending' }],
  );
  // Non-array input and empty-text items are dropped.
  assert.deepEqual(planItems(undefined), []);
  assert.deepEqual(planItems([{ content: '   ', status: 'pending' }]), []);
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
