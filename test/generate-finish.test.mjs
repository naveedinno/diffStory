import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finishStoryGeneration } from '../dist/server.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'ds-generate-finish-'));

function writeStory(repo, stepKind, stepOverrides = {}) {
  const path = join(repo, '.diffstory', 'story.json');
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      title: 'Generated story',
      summary: 'Generated story summary',
      base: 'HEAD',
      steps: [
        {
          id: 's1',
          order: 1,
          title: 'Entry point',
          file: 'a.txt',
          range: [1, 1],
          kind: stepKind,
          why: 'Start here.',
          ...stepOverrides,
        },
      ],
    }),
  );
  return path;
}

test('generation finish accepts only a valid written story', () => {
  const repo = tmp();
  const storyPath = writeStory(repo, 'changed');
  const session = { repo, chooseStory: true };

  const out = finishStoryGeneration({ ok: true, output: '' }, storyPath, session);

  assert.equal(out.status, 'complete');
  assert.deepEqual(out.result, { storyWritten: true, storyValid: true });
  assert.deepEqual(out.events, []);
  assert.equal(session.selectedStory, storyPath);
  assert.equal(session.chooseStory, false);

  rmSync(repo, { recursive: true, force: true });
});

test('generation finish accepts deleted as a canonical changed step', () => {
  const repo = tmp();
  const storyPath = writeStory(repo, 'deleted');
  const session = { repo, chooseStory: true };

  const out = finishStoryGeneration({ ok: true, output: '' }, storyPath, session);

  assert.equal(out.status, 'complete');
  assert.deepEqual(out.result, { storyWritten: true, storyValid: true });
  assert.deepEqual(out.events, []);
  assert.equal(session.selectedStory, storyPath);
  assert.equal(session.chooseStory, false);

  rmSync(repo, { recursive: true, force: true });
});

test('generation finish accepts pure deleted-file sentinel anchors', () => {
  const repo = tmp();
  const storyPath = writeStory(repo, 'changed', {
    range: [0, 0],
    viewport: [0, 0],
    highlights: [[0, 0]],
  });
  const session = { repo, chooseStory: true };

  const out = finishStoryGeneration({ ok: true, output: '' }, storyPath, session);

  assert.equal(out.status, 'complete');
  assert.deepEqual(out.result, { storyWritten: true, storyValid: true });
  assert.deepEqual(out.events, []);
  assert.equal(session.selectedStory, storyPath);
  assert.equal(session.chooseStory, false);

  rmSync(repo, { recursive: true, force: true });
});

test('generation finish rejects a written but invalid story', () => {
  const repo = tmp();
  const storyPath = writeStory(repo, 'bogus');
  const session = { repo, chooseStory: true };

  const out = finishStoryGeneration({ ok: true, output: '' }, storyPath, session);

  assert.equal(out.status, 'failed');
  assert.equal(out.result.storyWritten, true);
  assert.equal(out.result.storyValid, false);
  assert.equal(out.events.length, 1);
  assert.equal(out.events[0].type, 'error');
  assert.equal(out.events[0].stage, 'validation');
  assert.match(out.events[0].label, /story is invalid/i);
  assert.match(out.events[0].detail, /kind must be one of changed, context, new-file/);
  assert.equal(session.selectedStory, undefined);
  assert.equal(session.chooseStory, true);

  rmSync(repo, { recursive: true, force: true });
});
