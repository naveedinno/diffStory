import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finishStoryGeneration } from '../dist/server.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'ds-generate-finish-'));

function writeStory(repo, stepKind, stepOverrides = {}) {
  const path = join(repo, '.diffstory', 'story.json');
  mkdirSync(join(path, '..'), { recursive: true });
  const range = stepOverrides.range ?? [1, 1];
  const highlights = stepOverrides.highlights ?? [range];
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      mode: 'guided',
      title: 'Generated story',
      summary: 'Generated story summary',
      intent: {
        goal: 'Help the reviewer understand the generated change.',
        design: 'The existing entry path reaches one changed decision and then its downstream effect.',
        sources: ['conversation'],
      },
      base: 'HEAD',
      steps: [
        {
          id: 's1',
          order: 1,
          title: 'Entry point',
          file: 'a.txt',
          range,
          viewport: range,
          highlights,
          beats: [{ text: 'Start at the changed decision.', highlights }],
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
  assert.match(out.events[0].label, /final check/i);
  assert.match(out.events[0].detail, /cannot safely open/i);
  assert.match(out.events[0].technicalDetail, /kind must be one of changed, context, new-file/);
  assert.equal(session.selectedStory, undefined);
  assert.equal(session.chooseStory, true);

  rmSync(repo, { recursive: true, force: true });
});

test('generation finish rejects a legacy-minimal story that skips the guided camera', () => {
  const repo = tmp();
  const storyPath = writeStory(repo, 'changed', {
    viewport: undefined,
    highlights: undefined,
    beats: undefined,
  });
  const session = { repo, chooseStory: true };

  const out = finishStoryGeneration({ ok: true, output: '' }, storyPath, session);

  assert.equal(out.status, 'failed');
  assert.equal(out.result.storyValid, false);
  assert.match(out.events[0].technicalDetail, /viewport is required for a generated story/);
  assert.match(out.events[0].technicalDetail, /highlights are required for a generated story/);
  assert.match(out.events[0].technicalDetail, /beats are required for a generated story/);
  assert.equal(session.selectedStory, undefined);
  assert.equal(session.chooseStory, true);

  rmSync(repo, { recursive: true, force: true });
});

test('generation finish does not treat an unchanged prior story as fresh output', () => {
  const repo = tmp();
  const storyPath = writeStory(repo, 'changed');
  const previous = readFileSync(storyPath, 'utf8');
  const session = { repo, chooseStory: true };

  const out = finishStoryGeneration(
    { ok: false, output: 'model failed before writing' },
    storyPath,
    session,
    previous,
  );

  assert.equal(out.status, 'failed');
  assert.deepEqual(out.result, { storyWritten: false, storyValid: false });
  assert.equal(out.events[0].stage, 'execution');
  assert.match(out.events[0].detail, /model failed before writing/);
  assert.equal(session.selectedStory, undefined);
  assert.equal(session.chooseStory, true);

  rmSync(repo, { recursive: true, force: true });
});

test('generation finish explains an incompatible Codex model without raw duplicated JSON', () => {
  const repo = tmp();
  const storyPath = join(repo, '.diffstory', 'story.json');
  const session = { repo, chooseStory: true };
  const message = "The 'gpt-5.6-sol' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again.";
  const line = `ERROR: ${JSON.stringify({
    type: 'error',
    status: 400,
    error: { type: 'invalid_request_error', message },
  })}`;

  const out = finishStoryGeneration({
    ok: false,
    failure: 'execution',
    output: `hook: SessionStart\n${line}\n${line}\n`,
  }, storyPath, session, null);

  assert.equal(out.status, 'failed');
  assert.equal(out.events.length, 1);
  assert.equal(out.events[0].label, 'Codex needs an update for gpt-5.6-sol');
  assert.match(out.events[0].detail, /choose another model and try again/i);
  assert.equal(out.events[0].technicalDetail, message);
  assert.doesNotMatch(out.events[0].detail, /ERROR:|hook:|\{"type"/);
  assert.doesNotMatch(out.events[0].technicalDetail, /ERROR:|hook:|\{"type"/);

  rmSync(repo, { recursive: true, force: true });
});

test('targeted repair can preserve a schema-valid legacy story without forcing a rewrite', () => {
  const repo = tmp();
  const storyPath = join(repo, '.diffstory', 'story.json');
  mkdirSync(join(storyPath, '..'), { recursive: true });
  const previous = JSON.stringify({
    version: 1,
    title: 'Legacy story',
    summary: 'Old but still readable.',
    steps: [{ id: 's1', order: 1, title: 'Old step', file: 'a.txt', range: [1, 1], kind: 'changed', why: 'Before.' }],
  });
  writeFileSync(storyPath, previous);
  writeFileSync(storyPath, previous.replace('Before.', 'Repaired.'));
  const session = { repo, chooseStory: true };

  const out = finishStoryGeneration(
    { ok: true, output: '' },
    storyPath,
    session,
    previous,
    false,
  );

  assert.equal(out.status, 'complete');
  assert.deepEqual(out.result, { storyWritten: true, storyValid: true });
  assert.equal(session.selectedStory, storyPath);
  assert.equal(session.chooseStory, false);

  rmSync(repo, { recursive: true, force: true });
});
