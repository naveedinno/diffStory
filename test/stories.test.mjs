import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deleteStory, diffFingerprint, listStories, storyPathForId } from '../dist/stories.js';
import { getDiff } from '../dist/git.js';
import { captureStorySnapshot } from '../dist/story-drift.js';

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
  writeStory(repo, 'stories/brief.json', 'Brief work', { mode: 'brief' });
  writeStory(repo, 'stories/deep.json', 'Detailed work', { mode: 'detailed' });

  const stories = listStories(repo);
  assert.equal(stories[0].mode, 'guided');
  assert.equal(stories[1].mode, 'brief');
  assert.equal(stories[2].mode, 'detailed');

  rmSync(repo, { recursive: true, force: true });
});

test('listStories counts concept primers without treating them as files', () => {
  const repo = tmp();
  writeStory(repo, 'story.json', 'Concept-first story', {
    version: 2,
    steps: [
      {
        id: 'primer',
        order: 1,
        title: 'The request lifecycle',
        kind: 'concept',
        body: 'The request is normalized before the policy is applied.',
        preparesFor: ['implementation'],
      },
      {
        id: 'implementation',
        order: 2,
        title: 'Apply the policy',
        file: 'a.txt',
        range: [1, 1],
        kind: 'changed',
        why: 'This is the implementation the primer prepares the reviewer for.',
      },
      {
        id: 'downstream',
        order: 3,
        title: 'Return the result',
        file: 'a.txt',
        range: [2, 2],
        kind: 'context',
        why: 'This unchanged return shows where the result goes next.',
      },
    ],
  });

  const [story] = listStories(repo);
  assert.equal(story.valid, true);
  assert.equal(story.steps, 3);
  assert.equal(story.primers, 1);
  assert.equal(story.files, 1);

  rmSync(repo, { recursive: true, force: true });
});

test('listStories calls a legacy story current only on an exact fingerprint and otherwise leaves it unverified', () => {
  const repo = tmp();
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  writeFileSync(join(repo, 'a.txt'), 'one\n');
  execFileSync('git', ['add', 'a.txt'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: repo });
  writeFileSync(join(repo, 'a.txt'), 'two\n');
  const fingerprint = diffFingerprint(getDiff(repo, 'HEAD'));
  writeStory(repo, 'story.json', 'Exact review', { base: 'HEAD', diffFingerprint: fingerprint });
  writeStory(repo, 'stories/old.json', 'Old review', { base: 'HEAD' });

  let stories = listStories(repo);
  assert.equal(stories[0].freshness, 'current');
  assert.equal(stories[0].current, true);
  assert.equal(stories[0].liveFiles, 1);
  assert.equal(stories[0].additions, 1);
  assert.equal(stories[0].deletions, 1);
  assert.equal(stories[0].openComments, 0);
  assert.equal(stories[1].freshness, 'unverified');

  writeFileSync(join(repo, 'a.txt'), 'three\n');
  stories = listStories(repo);
  assert.equal(stories[0].freshness, 'unverified');
  assert.equal(stories[0].current, false);

  rmSync(repo, { recursive: true, force: true });
});

test('listStories keeps a scoped story current across side drift and stales it only for included files', () => {
  const repo = tmp();
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  writeFileSync(join(repo, 'a.txt'), 'story one\n');
  writeFileSync(join(repo, 'side.txt'), 'side one\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: repo });
  writeFileSync(join(repo, 'a.txt'), 'story two\n');
  const storySnapshot = captureStorySnapshot({
    repo,
    base: 'HEAD',
    storyScope: { includedFiles: ['a.txt'] },
  });
  writeStory(repo, 'story.json', 'Scoped review', {
    base: 'HEAD',
    storyScope: { includedFiles: ['a.txt'] },
    storySnapshot,
  });

  writeFileSync(join(repo, 'side.txt'), 'side two\n');
  let [story] = listStories(repo);
  assert.equal(story.freshness, 'current');
  assert.equal(story.current, true);
  assert.equal(story.inStoryDrift, 0);
  assert.equal(story.outsideStoryDrift, 1);

  writeFileSync(join(repo, 'a.txt'), 'story three\n');
  [story] = listStories(repo);
  assert.equal(story.freshness, 'stale');
  assert.equal(story.current, false);
  assert.equal(story.inStoryDrift, 1);
  assert.equal(story.outsideStoryDrift, 1);

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

test('deleteStory removes only known story files', () => {
  const repo = tmp();
  writeStory(repo, 'story.json', 'Primary');
  writeStory(repo, 'stories/deeper/b.json', 'Nested');
  writeFileSync(join(repo, '.diffstory', 'comments.json'), '[]');

  assert.equal(deleteStory(repo, 'stories/deeper/b.json'), true);
  assert.equal(storyPathForId(repo, 'stories/deeper/b.json'), null);
  assert.equal(deleteStory(repo, '../comments.json'), false);
  assert.equal(deleteStory(repo, 'comments.json'), false);
  assert.deepEqual(listStories(repo).map((s) => s.id), ['story.json']);

  rmSync(repo, { recursive: true, force: true });
});
