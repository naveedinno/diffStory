import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listStories, storyPathForId } from '../dist/stories.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'ds-stories-'));

function writeStory(repo, rel, title, extra = {}) {
  const path = join(repo, '.diffstory', rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      title,
      summary: `${title} summary`,
      base: 'main',
      steps: [
        {
          id: 's1',
          order: 1,
          title: 'Entry point',
          file: 'a.txt',
          range: [1, 1],
          kind: 'changed',
          why: 'Start here.',
        },
      ],
      ...extra,
    }),
  );
}

test('listStories discovers primary, legacy, and named stories', () => {
  const repo = tmp();
  writeStory(repo, 'story.json', 'Primary story');
  writeStory(repo, 'review-tour.json', 'Legacy story');
  writeStory(repo, 'stories/liquidation.json', 'Liquidation story');
  writeStory(repo, 'stories/payments/monthly.json', 'Monthly story');
  writeFileSync(join(repo, '.diffstory', 'comments.json'), '[]');

  const stories = listStories(repo);
  assert.deepEqual(stories.map((s) => s.id), [
    'story.json',
    'review-tour.json',
    'stories/liquidation.json',
    'stories/payments/monthly.json',
  ]);
  assert.deepEqual(stories.map((s) => s.title), [
    'Primary story',
    'Legacy story',
    'Liquidation story',
    'Monthly story',
  ]);
  assert.equal(stories.every((s) => s.valid), true);

  rmSync(repo, { recursive: true, force: true });
});

test('listStories explains whether a story covers working tree or a ref range', () => {
  const repo = tmp();
  writeStory(repo, 'story.json', 'Uncommitted work', { base: 'HEAD' });
  writeStory(repo, 'stories/range.json', 'Branch range', { base: 'main', head: 'feature/liquidation' });

  const stories = listStories(repo);
  assert.equal(stories[0].scope.label, 'Working tree vs HEAD');
  assert.equal(stories[0].scope.command, 'git diff HEAD --');
  assert.match(stories[0].scope.description, /current working tree/);
  assert.equal(stories[1].scope.label, 'main..feature/liquidation');
  assert.equal(stories[1].scope.command, 'git diff main..feature/liquidation --');
  assert.match(stories[1].scope.description, /does not include uncommitted/);

  rmSync(repo, { recursive: true, force: true });
});

test('listStories exposes the story generation mode', () => {
  const repo = tmp();
  writeStory(repo, 'story.json', 'Guided work');
  writeStory(repo, 'stories/deep.json', 'Detailed work', { mode: 'detailed' });

  const stories = listStories(repo);
  assert.equal(stories[0].mode, 'guided');
  assert.equal(stories[1].mode, 'detailed');

  rmSync(repo, { recursive: true, force: true });
});

test('listStories includes invalid stories with an error and ignores comments', () => {
  const repo = tmp();
  mkdirSync(join(repo, '.diffstory'), { recursive: true });
  writeFileSync(join(repo, '.diffstory', 'story.json'), '{"bogus":true}');
  writeFileSync(join(repo, '.diffstory', 'comments.json'), '{"bogus":true}');

  const stories = listStories(repo);
  assert.equal(stories.length, 1);
  assert.equal(stories[0].id, 'story.json');
  assert.equal(stories[0].valid, false);
  assert.match(stories[0].error, /not a valid/);

  rmSync(repo, { recursive: true, force: true });
});

test('storyPathForId only resolves known story ids', () => {
  const repo = tmp();
  writeStory(repo, 'stories/a.json', 'A');
  writeStory(repo, 'stories/deeper/b.json', 'B');

  assert.equal(storyPathForId(repo, 'stories/a.json'), join(repo, '.diffstory', 'stories', 'a.json'));
  assert.equal(storyPathForId(repo, 'stories/deeper/b.json'), join(repo, '.diffstory', 'stories', 'deeper', 'b.json'));
  assert.equal(storyPathForId(repo, '../a.json'), null);
  assert.equal(storyPathForId(repo, 'comments.json'), null);

  rmSync(repo, { recursive: true, force: true });
});
