import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  codexStoryModelChoices,
  codexTaskBinary,
  listCodexStoryModels,
  listCodexTasks,
  validCodexThreadId,
} from '../dist/codex-tasks.js';

test('Codex task ids are constrained to persisted UUIDs', () => {
  assert.equal(validCodexThreadId('019f5079-f420-7423-8aa8-cf9f6a079e03'), true);
  assert.equal(validCodexThreadId('--last'), false);
  assert.equal(validCodexThreadId('not-a-task'), false);
});

test('configured Codex task runtime overrides platform discovery', () => {
  const before = process.env.DIFFSTORY_CODEX_BINARY;
  process.env.DIFFSTORY_CODEX_BINARY = '/tmp/codex-desktop-test';
  try {
    assert.equal(codexTaskBinary(), '/tmp/codex-desktop-test');
  } finally {
    if (before === undefined) delete process.env.DIFFSTORY_CODEX_BINARY;
    else process.env.DIFFSTORY_CODEX_BINARY = before;
  }
});

test('task discovery speaks app-server JSONL and returns repository chat metadata', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ds-codex-tasks-'));
  const fake = join(dir, 'codex');
  writeFileSync(
    fake,
    `#!/usr/bin/env node
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.id === 1) {
      process.stdout.write(JSON.stringify({ id: 1, result: { userAgent: 'fake' } }) + '\\n');
    }
    if (message.id === 2) {
      process.stdout.write(JSON.stringify({
        id: 2,
        result: {
          data: [
            {
              id: '019f5079-f420-7423-8aa8-cf9f6a079e03',
              name: 'Add Codex session selector',
              preview: 'Keep review questions in the same task.',
              source: 'vscode',
              updatedAt: 1783761978
            },
            {
              id: '019f502b-61f5-7f03-a3e4-2b71b778e3a8',
              name: null,
              preview: 'Improve the story prompt\\nwith better context.',
              source: 'cli',
              updatedAt: 1783761862
            },
            {
              id: '019f5042-9586-7993-8f33-3db3f13163df',
              name: null,
              preview: 'Use the diffstory-storyteller skill to generate a story.',
              source: 'exec',
              updatedAt: 1783757974
            }
          ]
        }
      }) + '\\n');
    }
  }
});
`,
  );
  chmodSync(fake, 0o755);
  try {
    const tasks = await listCodexTasks('/repo/example', { binary: fake, timeoutMs: 3000 });
    assert.equal(tasks.length, 2);
    assert.deepEqual(tasks[0], {
      id: '019f5079-f420-7423-8aa8-cf9f6a079e03',
      title: 'Add Codex session selector',
      preview: 'Keep review questions in the same task.',
      source: 'Codex Desktop',
      updatedAt: 1783761978,
    });
    assert.equal(tasks[1].title, 'Improve the story prompt with better context.');
    assert.equal(tasks[1].source, 'Codex CLI');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('story model choices come from the live visible Codex catalog', () => {
  assert.deepEqual(codexStoryModelChoices({ data: [
    { model: 'gpt-5.6-sol', displayName: 'GPT-5.6-Sol', hidden: false, isDefault: true },
    { model: 'gpt-5.4-mini', displayName: 'GPT-5.4-Mini', hidden: false, isDefault: false },
    { model: 'codex-auto-review', displayName: 'Auto Review', hidden: true, isDefault: false },
  ] }), [
    {
      label: 'Best quality',
      model: 'gpt-5.6-sol',
      description: 'GPT-5.6-Sol · recommended by your Codex app',
    },
    {
      label: 'Lower cost',
      model: 'gpt-5.4-mini',
      description: 'GPT-5.4-Mini · smaller model available in your Codex app',
    },
  ]);
});

test('model discovery uses app-server model/list and never invents a fallback model', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ds-codex-models-'));
  const fake = join(dir, 'codex');
  writeFileSync(
    fake,
    `#!/usr/bin/env node
let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split('\\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.id === 1) process.stdout.write(JSON.stringify({ id: 1, result: {} }) + '\\n');
    if (message.id === 2) {
      if (message.method !== 'model/list') process.exit(3);
      process.stdout.write(JSON.stringify({ id: 2, result: { data: [
        { model: 'codex-best', displayName: 'Codex Best', hidden: false, isDefault: true }
      ] } }) + '\\n');
    }
  }
});
`,
  );
  chmodSync(fake, 0o755);
  try {
    // Match the production timeout: the complete suite starts many child
    // processes in parallel, so a 3s test-only deadline can expire before this
    // tiny fixture is scheduled even though the protocol is healthy.
    assert.deepEqual(await listCodexStoryModels({ binary: fake, timeoutMs: 8000 }), [{
      label: 'Best quality',
      model: 'codex-best',
      description: 'Codex Best · recommended by your Codex app',
    }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
