// Unit tests for agent detection + command building (not the real spawn). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  onPath, storyPrompt, normalizeStoryMode, agentCommand, addressPrompt,
  streamCommand, normalizeCodexRunOptions, parseClaudeStreamLine, parseCodexStreamLine, toolSummary, classifyTool, planItems,
  codexErrorMessage, summarizeAgentFailure,
  codexThreadIdFromOutput,
  resumedCodexTaskMatches,
  selectAvailableAgent,
  storyRepairPrompt,
} from '../dist/agent.js';
import { codexTaskBinary } from '../dist/codex-tasks.js';
import { validateGeneratedTour, validateTour } from '../dist/tour.js';

test('onPath finds sh, not a bogus command', () => {
  assert.equal(onPath('sh'), true);
  assert.equal(onPath('definitely-not-a-real-cmd-xyz'), false);
});

test('storyPrompt names the base and the output file', () => {
  const p = storyPrompt('main (abc123)');
  assert.ok(p.includes('main (abc123)'));
  assert.ok(p.includes('.diffstory/story.json'));
  assert.ok(p.includes('set its "version" field to 2'));
  assert.ok(p.includes('Use the diffstory-storyteller skill'));
  assert.ok(!p.includes('diffStory review-tour skill'));
  assert.ok(p.includes('reviewer, not a changelog'));
  assert.ok(p.includes('Do not ask questions. Generate it directly.'));
});

test('storyPrompt pins run facts and delegates every craft rule to the skill', () => {
  const p = storyPrompt('main');
  // Run-specific facts stay in the prompt…
  assert.ok(p.includes('git diff main --'));
  assert.ok(p.includes('set its "mode" field to "guided"'));
  assert.ok(p.includes('The skill owns the craft'));
  assert.ok(p.includes('recover the why, reconstruct the app path, storyboard the camera, then write the steps'));
  assert.ok(p.includes('hotspots'));
  assert.ok(p.includes('non-goals'));
  assert.ok(p.includes('The app validates the finished story'));
  // …while the craft contracts live only in SKILL.md, so the two cannot drift.
  for (const duplicated of [
    'Detail level contract', 'Viewport contract', 'Beat contract', 'Context contract',
    'Writing contract', 'Voice contract', 'Coverage contract', 'Range contract',
    'Focus pointer contract', 'Truth contract', 'Concept primer contract',
    'Falsifiable self-review', 'Phase 1 — Recover the why', 'Concept-gap test',
  ]) {
    assert.ok(!p.includes(duplicated), `craft rule duplicated in prompt: ${duplicated}`);
  }
  // Drift guard. The boundary the eval loop settled on: the prompt owns what the
  // VALIDATOR enforces (field names, numeric caps) because machine-checked
  // contracts do not survive being read as prose inside an 8k-word skill; the
  // skill owns judgment. So size alone is not the test — the craft-section
  // assertions above are. This cap just stops the skill leaking back in wholesale.
  assert.ok(p.length < 4000, `prompt grew to ${p.length} chars — move craft rules into SKILL.md instead`);
});

test('storyPrompt supports story detail levels', () => {
  assert.equal(normalizeStoryMode('brief'), 'brief');
  assert.equal(normalizeStoryMode('detailed'), 'detailed');
  assert.equal(normalizeStoryMode('guided'), 'guided');
  assert.equal(normalizeStoryMode('anything else'), 'guided');

  assert.ok(storyPrompt('main').includes('set its "mode" field to "guided"'));
  assert.ok(storyPrompt('main', undefined, 'brief').includes('set its "mode" field to "brief"'));
  const detailed = storyPrompt('main', undefined, 'detailed');
  assert.ok(detailed.includes('git diff main --'));
  assert.ok(detailed.includes('set its "mode" field to "detailed"'));
  for (const mode of ['brief', 'guided', 'detailed']) {
    const prompt = storyPrompt('main', undefined, mode);
    assert.ok(prompt.length < 4000, `${mode} prompt grew to ${prompt.length} chars`);
  }
});

test('bundled diffstory-storyteller skill teaches reviewer-first story generation', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  const flat = skill.replace(/\s+/g, ' ');
  assert.ok(skill.includes('Make a reviewer map before JSON'));
  assert.ok(skill.includes('falsifiable mental model'));
  assert.ok(skill.includes('Hard quality gates'));
  assert.ok(skill.includes('coverage ledger'));
  assert.ok(skill.includes('`viewport` is the review window'));
  assert.ok(flat.includes('`range` anchors; optional top-level `ranges` claim; `highlights` point'));
  assert.ok(skill.includes('Truth audit'));
  assert.ok(skill.includes('Do not claim tests pass unless you ran them'));
});

test('bundled diffstory-storyteller skill restores app context before judging the diff', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('reviewer remembers the requested outcome but not the app internals'));
  assert.ok(skill.includes('Reconstruct the app path'));
  assert.ok(skill.includes('inbound'));
  assert.ok(skill.includes('outbound'));
  assert.ok(skill.includes('entry -> existing owner -> changed decision -> downstream effect -> proof/risk'));
  assert.ok(skill.includes('behavioral entry point'));
  assert.ok(skill.includes('Do not start with imports, icons'));
  assert.ok(skill.includes('Context beats may and should highlight unchanged lines'));
});

test('bundled diffstory-storyteller skill makes the camera contract falsifiable', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('guided camera'));
  assert.ok(skill.includes('orientation -> change ->'));
  assert.ok(skill.includes('detailed steps stay within 60'));
  assert.ok(skill.includes('range` itself'));
  assert.ok(skill.includes('at most 12 context'));
  assert.ok(skill.includes('at most 12 lines'));
  assert.ok(skill.includes('Memory test'));
  assert.ok(skill.includes('Camera test'));
  assert.ok(skill.includes('First-stop test'));
});

test('bundled diffstory-storyteller skill requires the narrative story arc', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Narrative arc'));
  assert.ok(skill.includes('We wanted to enable'));
  assert.ok(skill.includes('designed the flow'));
  assert.ok(skill.includes('To implement that flow, I first'));
  assert.ok(skill.includes('intent -> flow -> implementation'));
  assert.ok(skill.includes('not a list of touched files'));
});

test('bundled diffstory-storyteller skill teaches just-in-time concept primers', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Concept-gap test'));
  assert.ok(skill.includes('terminology, roles, relationships, or state model'));
  assert.ok(skill.includes('immediately before the first code step that depends on it'));
  assert.ok(skill.includes('Overview is the whole-change reading map'));
  assert.ok(skill.includes('primer is a just-in-time mental model'));
  assert.ok(skill.includes('Never place two concept primers next to each other'));
  assert.ok(skill.includes('Never end the story with a concept primer'));
});

test('bundled diffstory-storyteller skill pins concept schema, limits, and diagram safety', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  const flat = skill.replace(/\s+/g, ' ');
  assert.ok(skill.includes('Newly generated stories use `"version": 2`'));
  assert.ok(skill.includes('60-180 words'));
  assert.match(skill, /hard maximum\s+of 220 words/);
  assert.ok(skill.includes('Brief: at most 1 concept primer'));
  assert.ok(skill.includes('Guided: at most 2 concept primers'));
  assert.ok(skill.includes('Detailed: at most 3 concept primers'));
  assert.ok(skill.includes('Concept primers never claim diff coverage'));
  assert.match(skill, /three or more\s+actors\/components/);
  assert.ok(skill.includes('flowchart`, `sequenceDiagram`, or `stateDiagram-v2'));
  assert.ok(skill.includes('caption is required'));
  assert.ok(skill.includes('No links, URLs, `click`/`href` directives, init/config directives, HTML, images, or custom styling directives'));
  assert.ok(flat.includes('must not contain `file`, `range`, `ranges`, `viewport`, `highlights`, `beats`, `why`, `question`, `calls`, or `returnsTo`'));
  assert.match(flat, /`question`[^.]{0,400}(?:optional|except)/i);
  for (const tag of ['`skim`', '`sweep`', '`mechanical`']) assert.ok(flat.includes(tag));
  assert.ok(skill.includes('Stories longer than 10 steps'));
});

test('bundled skill schema example is a valid interleaved v2 story', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  const example = JSON.parse(skill.split('## Schema')[1].split('```jsonc')[1].split('```')[0]);
  assert.deepEqual(validateTour(example), []);
  assert.deepEqual(validateGeneratedTour(example), []);
  assert.deepEqual(example.steps.map((step) => [step.order, step.kind]), [
    [1, 'changed'],
    [2, 'concept'],
    [3, 'new-file'],
    [4, 'context'],
  ]);
  assert.deepEqual(example.steps[1].preparesFor, ['s2']);
});

test('bundled diffstory-storyteller skill makes deleted-file steps use the changed kind', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Never use "deleted" as a step kind'));
  assert.ok(skill.includes('For deleted files, use kind "changed"'));
  assert.ok(skill.includes('anchor the range at the post-change deletion location'));
});

test('bundled diffstory-storyteller skill teaches the pure deleted-file sentinel anchor', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('For a whole deleted file, use `range`, `viewport`, and `highlights` of `[0, 0]`'));
  assert.ok(skill.includes('Do not invent line 1 for a file that no longer exists'));
});

test('bundled diffstory-storyteller skill teaches explicit read-aloud focus targets', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Focus pointer contract'));
  assert.ok(skill.includes('"focus"'));
  assert.ok(skill.includes('"ranges"'));
  assert.ok(skill.includes('inside that step'));
  assert.ok(skill.includes('post-change line numbers'));
  assert.ok(skill.includes('one or two lines'));
  assert.ok(skill.includes('not the whole displayed section'));
});

test('bundled diffstory-storyteller skill teaches viewport and highlighted line selection', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Viewport contract'));
  assert.ok(skill.includes('`viewport`'));
  assert.ok(skill.includes('`highlights`'));
  assert.ok(skill.includes('what the reviewer sees'));
  assert.ok(skill.includes('lines the story is currently talking about'));
  assert.ok(skill.includes('from the requirement'));
  assert.ok(skill.includes('far-apart highlight islands'));
  assert.ok(skill.includes('steady camera shot'));
});

test('bundled diffstory-storyteller skill requires beat-by-beat narration for read-aloud sync', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Beat contract'));
  assert.ok(skill.includes('`beats`'));
  assert.ok(skill.includes('separate speech'));
  assert.ok(skill.includes('one beat per highlighted code part'));
  assert.ok(skill.includes('Do not put one big speech over several highlight groups'));
});

test('bundled diffstory-storyteller skill teaches story detail levels', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Detail levels'));
  assert.ok(skill.includes('Brief mode'));
  assert.ok(skill.includes('Balanced mode'));
  assert.ok(skill.includes('Line-by-line mode'));
  assert.ok(skill.includes('line-by-line'));
  assert.ok(skill.includes('all meaningful code paths'));
  assert.ok(skill.includes('"mode": "brief"'));
  assert.ok(skill.includes('"mode": "detailed"'));
});

test('bundled diffstory-storyteller skill recovers intent before writing', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Recover the why'));
  assert.ok(skill.includes('"sources"'));
  assert.ok(skill.includes('code-derived'));
  assert.ok(skill.includes('conversation'));
  assert.ok(skill.includes('up to 2 short questions'));
  assert.ok(skill.includes('Not evidence: branch names, filenames, vibes'));
  assert.ok(skill.includes('Never invent product intent'));
});

test('bundled diffstory-storyteller skill enforces the narrative audit', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Narrative audit'));
  assert.ok(skill.includes('Order test'));
  assert.ok(skill.includes('Thread rule'));
  assert.ok(skill.includes('Thread test'));
  assert.ok(skill.includes('one continuous story'));
});

test('bundled diffstory-storyteller skill teaches focused story scopes', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('storyScope'));
  assert.ok(skill.includes('includedFiles'));
  assert.ok(skill.includes('excludedFiles'));
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

test('storyPrompt supports selected story files and reviewer guidance', () => {
  const p = storyPrompt('main', 'feature/x', 'guided', ['package-lock.json'], {
    includedFiles: ['contracts/Fee.sol', 'src/story.ts'],
    excludedFiles: ['test/story.test.ts', 'package.json'],
    reviewerNote: 'Pay extra attention to the fee guard.',
  });
  assert.ok(p.includes("git diff main..feature/x -- 'contracts/Fee.sol' 'src/story.ts' ':(exclude)package-lock.json'"));
  assert.ok(p.includes('Story scope contract'));
  assert.ok(p.includes('Only create changed or new-file story steps for these selected files: contracts/Fee.sol, src/story.ts'));
  assert.ok(p.includes('These changed files are intentionally outside this story scope: test/story.test.ts, package.json'));
  assert.ok(p.includes('"storyScope"'));
  assert.ok(p.includes('Pay extra attention to the fee guard.'));
  assert.ok(p.includes('cite "reviewer guidance" in intent.sources'));
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
  assert.deepEqual(agentCommand('codex', 'GO'), [codexTaskBinary(), ['exec', '--full-auto', 'GO']]);
});

test('selectAvailableAgent honors explicit installed choices and rejects unavailable ones', () => {
  assert.deepEqual(selectAvailableAgent(undefined, ['claude', 'codex'], 'claude'), { ok: true, agent: 'claude' });
  assert.deepEqual(selectAvailableAgent('codex', ['claude', 'codex'], 'claude'), { ok: true, agent: 'codex' });

  const unavailable = selectAvailableAgent('codex', ['claude'], 'claude');
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.status, 400);
  assert.match(unavailable.label, /not available/i);

  const invalid = selectAvailableAgent('gemini', ['claude', 'codex'], 'claude');
  assert.equal(invalid.ok, false);
  assert.match(invalid.detail, /Claude, Codex/i);
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
  assert.ok(p.includes('diffstory-storyteller'));
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

test('addressPrompt puts the reviewer message first so it is visible in a resumed Codex task', () => {
  const p = addressPrompt(['c_question'], undefined, undefined, {
    reviewMessages: [{ id: 'c_question', text: 'are you sure sir?' }],
  });
  assert.ok(p.startsWith('are you sure sir?\n\n---\n\n'));
  assert.ok(p.includes('comments with these ids: c_question'));
});

test('addressPrompt surfaces every reviewer message in a batch run', () => {
  const p = addressPrompt('all', undefined, undefined, {
    reviewMessages: [
      { id: 'c_one', text: 'why is this nullable?' },
      { id: 'c_two', text: 'please rename this' },
    ],
  });
  assert.ok(p.startsWith('Review these diffStory messages:'));
  assert.ok(p.includes('1. why is this nullable? (comment c_one)'));
  assert.ok(p.includes('2. please rename this (comment c_two)'));
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

test('storyRepairPrompt preserves unaffected steps and targets one repair', () => {
  const prompt = storyRepairPrompt({ action: 'split', stepId: 's2', file: 'src/a.ts', base: 'main' });
  assert.match(prompt, /Split story step "s2" in src\/a\.ts/);
  assert.match(prompt, /Preserve every unaffected step/);
  assert.match(prompt, /Do not regenerate the walkthrough from scratch/);
  assert.match(prompt, /Preserve every unaffected concept primer/);
  assert.match(prompt, /Keep a legacy version 1 story at version 1/);
  assert.match(prompt, /upgrade it to version 2 only if this repair introduces a concept primer/);
  assert.match(prompt, /concept primers do not claim coverage/i);
  assert.match(prompt, /\.diffstory\/story\.json/);
  assert.match(prompt, /diffstory-storyteller/);
});

test('streamCommand uses stream-json for claude and exec for codex', () => {
  assert.deepEqual(streamCommand('claude', 'GO'), [
    'claude',
    ['-p', 'GO', '--output-format', 'stream-json', '--verbose',
     '--permission-mode', 'acceptEdits', '--model', 'sonnet'],
  ]);
  assert.deepEqual(streamCommand('codex', 'GO'), [codexTaskBinary(), ['exec', '--full-auto', 'GO']]);
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

test('streamCommand resumes a selected Codex task with the runtime that listed it', () => {
  const id = '019f5079-f420-7423-8aa8-cf9f6a079e03';
  assert.deepEqual(
    streamCommand('codex', 'ADDRESS', undefined, {
      codex: { binary: '/Applications/ChatGPT.app/Contents/Resources/codex', threadId: id, json: true },
    }),
    [
      '/Applications/ChatGPT.app/Contents/Resources/codex',
      ['exec', 'resume', '--json', id, 'ADDRESS'],
    ],
  );
});

test('Codex JSONL progress exposes useful events and the persistent task id', () => {
  const id = '019f5079-f420-7423-8aa8-cf9f6a079e03';
  assert.deepEqual(
    parseCodexStreamLine(JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'Done.' } })),
    [{ type: 'text', data: 'Done.' }],
  );
  assert.deepEqual(
    parseCodexStreamLine(JSON.stringify({ type: 'item.completed', item: { type: 'command_execution', command: 'npm test' } })),
    [{ type: 'command', command: 'npm test', label: '$ npm test' }],
  );
  assert.equal(
    codexThreadIdFromOutput(JSON.stringify({ type: 'thread.started', thread_id: id }) + '\n'),
    id,
  );
  assert.deepEqual(
    parseCodexStreamLine(JSON.stringify({ type: 'thread.started', thread_id: id })),
    [{ type: 'activity', kind: 'task', label: 'Message added to selected Codex task · …6a079e03' }],
  );
  assert.equal(resumedCodexTaskMatches(id, id), true);
  assert.equal(resumedCodexTaskMatches(id, undefined), false);
  assert.equal(resumedCodexTaskMatches(id, '019f5079-f420-7423-8aa8-cf9f00000000'), false);
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

test('Codex upgrade failures become one actionable diagnostic instead of streamed JSON', () => {
  const message = "The 'gpt-5.6-sol' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again.";
  const line = `ERROR: ${JSON.stringify({
    type: 'error',
    status: 400,
    error: { type: 'invalid_request_error', message },
  })}`;

  assert.equal(codexErrorMessage(line), message);
  assert.deepEqual(parseCodexStreamLine(line), []);

  const summary = summarizeAgentFailure([
    'hook: SessionStart',
    line,
    line,
  ].join('\n'));
  assert.equal(summary.label, 'Codex needs an update for gpt-5.6-sol');
  assert.match(summary.detail, /choose another model and try again/i);
  assert.equal(summary.technicalDetail, message);
  assert.doesNotMatch(summary.technicalDetail, /hook:|ERROR:|\{"type"/);
});

test('storyPrompt requires live >> phase markers and notes', () => {
  const p = storyPrompt('main');
  assert.match(p, /">> Recovering the why"/);
  assert.match(p, /">> Reconstructing the app path"/);
  assert.match(p, /">> Storyboarding the camera"/);
  assert.match(p, /">> Writing the steps"/);
  assert.match(p, /starting with ">> "/);
});

test('bundled diffstory-storyteller skill demands honest hotspots and non-goals', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Declare your doubts (hotspots)'));
  assert.ok(skill.includes('where should I distrust this?'));
  assert.ok(skill.includes('"hotspots"'));
  assert.ok(skill.includes('Honest reasons only'));
  assert.ok(skill.includes('the id of a `changed` or `new-file` step'));
  assert.ok(skill.includes('nonGoals'));
  assert.ok(skill.includes('Deliberately does not'));
  assert.ok(skill.includes('Hotspot test'));
  assert.ok(skill.includes('an accidental gap'));
});

test('bundled diffstory-storyteller skill bans rhetorical review questions', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Run the flip test on every `question`'));
  assert.ok(skill.includes('name the specific bug'));
  assert.ok(skill.includes('rhetorical'));
  assert.ok(skill.includes('REJECT, rhetorical'));
  assert.ok(skill.includes('KEEP, names a real bug'));
  assert.ok(skill.includes('Question flip test'));
});

test('bundled diffstory-storyteller skill shows the same diff as changelog vs story', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('the same diff, told twice'));
  assert.ok(skill.includes('The changelog (do not write this)'));
  assert.ok(skill.includes('The story (write this)'));
  assert.ok(skill.includes('each question names a failure the evidence must rule out'));
});

test('bundled diffstory-storyteller skill teaches beat prose that unlocks, not inventories', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('the layer that most often goes flat'));
  assert.ok(skill.includes('No line-number narration'));
  assert.ok(skill.includes('One beat, one decision'));
  assert.ok(skill.includes('End on the consequence'));
  assert.ok(skill.includes('BAD  (one beat, three decisions, pure inventory)'));
  assert.ok(skill.includes('GOOD  (three beats, each one decision ending in its consequence)'));
  assert.ok(skill.includes('Beat prose test'));
});

test('bundled diffstory-storyteller skill rejects circular intent sources', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Prefer evidence that *motivated* the change'));
  assert.ok(skill.includes('circular'));
  assert.ok(skill.includes('keep the\n  goal narrow and factual'));
});

test('bundled diffstory-storyteller skill signals independent concerns instead of faking a thread', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('Branch rule'));
  assert.ok(skill.includes('Do not fake a thread between them'));
  assert.ok(skill.includes('announcing the switch'));
  assert.ok(skill.includes('An unsignalled jump between concerns'));
  assert.ok(skill.includes('an unannounced jump fails this test'));
});

test('bundled diffstory-storyteller skill permits only narrow mechanical sweep consolidation', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  const flat = skill.replace(/\s+/g, ' ');
  assert.ok(flat.includes('Count the hunks before you plan the steps'));
  assert.ok(flat.includes('Mechanical sweeps'));
  assert.ok(flat.includes('one repeated mechanical pattern in one file'));
  assert.ok(flat.includes('top-level `ranges`'));
  assert.ok(flat.includes('Keep `range` tight around one representative instance'));
  assert.ok(flat.includes('Scattered substantive decisions need separate steps'));
  assert.ok(flat.includes('coverage wins'));
  assert.ok(!flat.includes('One step claims exactly one `range`'));
});

test('bundled diffstory-storyteller skill keeps detailed mode from narrating line numbers', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  assert.ok(skill.includes('describes *granularity*, never *phrasing*'));
  assert.ok(skill.includes('does not license narrating line numbers'));
  assert.ok(skill.includes('let the highlight supply the address'));
});

test('bundled diffstory-storyteller skill forbids abbreviating sweep-step schema', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  const flat = skill.replace(/\s+/g, ' ');
  assert.ok(flat.includes('shorter, never structurally lighter'));
  assert.ok(flat.includes('beats use `text`, never `body`'));
  assert.ok(flat.includes('drift into an abbreviated shape, and the app rejects the whole story over it'));
  assert.ok(flat.includes('Schema spot-check'));
  assert.ok(flat.includes('are the ones real stories lose first'));
  assert.ok(flat.includes('`order` (a number — never omit it)'));
});

test('storyPrompt pins machine-checked field names the skill prose cannot convey', () => {
  // Real eval runs paraphrased the beat field as "body" and "prose" and dropped
  // "order" from every step. Field names are the output contract, not craft, so
  // they live in the prompt where they cannot be reworded.
  const p = storyPrompt('main');
  assert.ok(p.includes('Exact field names (never paraphrase)'));
  assert.ok(p.includes('"order" (number 1..N)'));
  assert.ok(p.includes('optional TOP-LEVEL "ranges" only when "tags" includes "skim", "sweep", or "mechanical"'));
  assert.ok(p.includes('"question" is required unless tagged that way'));
  assert.ok(p.includes('"text" (not "body" or "prose")'));
  assert.ok(p.includes('"body" is concept-only'));
  assert.ok(p.includes('One omission invalidates the story'));
});

test('bundled diffstory-storyteller skill keeps sweep steps from becoming diff narration', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  const flat = skill.replace(/\s+/g, ' ');
  assert.ok(flat.includes('Sweep steps must not become diff narration'));
  assert.ok(flat.includes('Keep `range` tight around one representative instance'));
  assert.match(flat, /same (?:repeated )?(?:edit|change|pattern)/i);
  assert.ok(flat.includes('never a restatement of the changed lines'));
  assert.ok(flat.includes('same `chapter` so the rail shows one skimmable'));
});

test('bundled diffstory-storyteller skill separates range (claims) from highlights (points)', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  // Markdown rewraps as the prose is edited, so match against whitespace-normalized
  // text instead of guessing where a line happens to break.
  const flat = skill.replace(/\s+/g, ' ');
  for (const phrase of [
    '`range` anchors; optional top-level `ranges` claim; `highlights` point',
    'top-level `ranges`',
    'legacy `focus.ranges`',
    'complete coverage claim',
    '`range` must be contained in one entry',
    'not the bounding box',
    'Other top-level `ranges` entries may sit outside `viewport`',
    'Point the single beat at ONE local instance',
  ]) {
    assert.ok(flat.includes(phrase), `SKILL.md is missing: ${phrase}`);
  }
});

test('bundled diffstory-storyteller skill bans value-transition narration in beats', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  const flat = skill.replace(/\s+/g, ' ');
  for (const phrase of [
    'Never narrate a value transition',
    'The diff already renders both sides in colour',
    'say what depended on it',
    'A sweep beat is allowed to be short; it is not allowed to be empty',
  ]) {
    assert.ok(flat.includes(phrase), `SKILL.md is missing: ${phrase}`);
  }
});

test('storyPrompt pins the numeric limits the validator enforces, per mode', () => {
  // Camera caps drifted the same way field names did: stated in the skill, ignored
  // in practice. They are machine-checked, so they belong next to the field names.
  const guided = storyPrompt('main');
  assert.ok(guided.includes('Hard limits the app enforces'));
  assert.ok(guided.includes('at most 12 lines'));
  assert.ok(guided.includes('A wide "range" does NOT permit a wide highlight'));
  assert.ok(guided.includes('Each claimed span covers its FULL changed cluster'));
  assert.ok(guided.includes('"range" is framed and inside "viewport"'));
  assert.ok(guided.includes('other "ranges" entries need not be'));
  assert.ok(guided.includes('"viewport": at most 40 lines in guided mode'));
  assert.ok(guided.includes('only a changed/new-file step with a larger "range" may use its length plus at most 12 context lines'));
  assert.ok(guided.includes('At most 3 beats per step in guided mode'));
  assert.ok(guided.includes('must not narrate a value transition'));

  const detailed = storyPrompt('main', undefined, 'detailed');
  assert.ok(detailed.includes('"viewport": at most 60 lines in detailed mode'));
  assert.ok(detailed.includes('At most 5 beats per step in detailed mode'));
});

test('storyPrompt self-check names every required field, not a sample', () => {
  // A run that was told to check only order/text/highlights shipped 55 code
  // steps with no "why" at all — the self-check list is what gets verified.
  const p = storyPrompt('main');
  assert.ok(p.includes('check EVERY step'));
  assert.ok(p.includes('all ten always-required fields'));
  assert.ok(!p.includes('all eleven of'));
  for (const f of ['id', 'order', 'title', 'kind', 'file', 'range', 'viewport', 'highlights', 'why', 'beats']) {
    assert.ok(p.includes(`"${f}"`), `self-check omits ${f}`);
  }
  assert.ok(p.includes('has "question" unless tagged "skim", "sweep", or "mechanical"'));
  assert.ok(p.includes('every beat has "text" and "highlights"'));
  assert.ok(p.includes('One omission invalidates the story'));
});

test('storyPrompt makes coverage a verification pass, not just a generation goal', () => {
  // Scattered mechanical edits may share one narrative only through explicit
  // top-level claims; ordinary behavior still keeps one framed local range.
  const p = storyPrompt('main');
  assert.ok(p.includes('Coverage pass'));
  assert.ok(p.includes('including separate clusters inside one hunk'));
  assert.ok(p.includes('changed/new-file step claims TOP-LEVEL "ranges" when present, otherwise "range"'));
  assert.ok(p.includes('Legacy "focus.ranges" only points at code; it never claims coverage'));
  assert.ok(p.includes('Only on a "skim"/"sweep"/"mechanical" step for one repeated sweep in one file'));
  assert.ok(p.includes('one representative "range"'));
  assert.ok(p.includes('every other full changed span in "ranges"'));
  assert.ok(p.includes('Other entries may be outside "viewport"'));
  assert.ok(p.includes('"range" must be contained in one entry, never a bounding box'));
  assert.ok(p.includes('Anything outside all claims is unexplained'));
});

test('storyPrompt requires every named source to be cited in intent.sources', () => {
  // A run named "DESIGN_MEMORY" in its goal while sources listed only the commit,
  // making the reviewer's one verifiable claim unverifiable.
  const p = storyPrompt('main');
  assert.ok(p.includes('must also appear in "sources"'));
  assert.ok(p.includes('if you cannot cite it, do not name it'));
});

test('bundled diffstory-storyteller skill bridges chapter seams without blanket long-tail merging', () => {
  const skill = readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8');
  const flat = skill.replace(/\s+/g, ' ');
  for (const phrase of [
    'Chapter-seam rule',
    'must open by naming the seam',
    'the single most common place a story loses its thread',
    'Long-tail caution',
    'top-level `ranges`',
    'show a representative instance',
    'coverage-preserving tool for the repetitive tail',
    'not a general instruction to make stories shorter',
  ]) {
    assert.ok(flat.includes(phrase), `SKILL.md is missing: ${phrase}`);
  }
  assert.ok(flat.includes('one repeated mechanical pattern in one file'));
  assert.ok(flat.includes('Substantive changes still need enough local steps to explain every decision'));
  assert.ok(!flat.includes('Prose is the only lever here; step count is not.'));
});
