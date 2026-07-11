// Integration test: opening a repo lands on story selection first. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { serve } from '../dist/server.js';

function repoWithChange() {
  const d = mkdtempSync(join(tmpdir(), 'ds-cr-'));
  const g = (a) => execFileSync('git', a, { cwd: d });
  g(['init', '-q']); g(['config', 'user.email', 't@e.st']); g(['config', 'user.name', 'T']);
  writeFileSync(join(d, 'a.txt'), 'one\n'); g(['add', '.']); g(['commit', '-qm', 'init']);
  writeFileSync(join(d, 'a.txt'), 'one\ntwo\n'); // uncommitted change, no tour
  return d;
}

function repoWithCommittedHeadStory() {
  const d = mkdtempSync(join(tmpdir(), 'ds-cr-'));
  const g = (a) => execFileSync('git', a, { cwd: d });
  g(['init', '-q']); g(['config', 'user.email', 't@e.st']); g(['config', 'user.name', 'T']);
  writeFileSync(join(d, 'a.txt'), 'one\n'); g(['add', '.']); g(['commit', '-qm', 'init']);
  writeFileSync(join(d, 'a.txt'), 'one\ntwo\n');
  writeStory(d);
  g(['add', '.']); g(['commit', '-qm', 'save story and change']);
  return d;
}

function repoWithHistoricalHeadStoryAndMovedWorkingTree() {
  const d = mkdtempSync(join(tmpdir(), 'ds-cr-'));
  const g = (a) => execFileSync('git', a, { cwd: d });
  g(['init', '-q']); g(['config', 'user.email', 't@e.st']); g(['config', 'user.name', 'T']);
  writeFileSync(join(d, 'a.txt'), 'base-one\n');
  g(['add', '.']); g(['commit', '-qm', 'base']);
  writeFileSync(join(d, 'a.txt'), 'head-one\nhead-two\n');
  g(['add', '.']); g(['commit', '-qm', 'head story target']);
  writeStory(d, {
    title: 'Historical story',
    summary: 'A story against an old head.',
    base: 'HEAD~1',
    head: 'HEAD',
    steps: [
      {
        id: 'context',
        order: 1,
        title: 'Context from the reviewed head',
        file: 'a.txt',
        range: [1, 1],
        kind: 'context',
        why: 'This line should come from the committed head side, not the live tree.',
      },
      {
        id: 'changed',
        order: 2,
        title: 'Changed line',
        file: 'a.txt',
        range: [2, 2],
        kind: 'changed',
        why: 'This is the added line in the historical head.',
      },
    ],
  });
  writeFileSync(join(d, 'a.txt'), 'live-one\nlive-two\n'); // current working tree moved on
  return d;
}

function writeStory(repo, body = {}, rel = 'story.json') {
  const path = join(repo, '.diffstory', rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      title: 'Saved story',
      summary: 'A saved story for this repo',
      base: 'HEAD',
      steps: [
        {
          id: 's1',
          order: 1,
          title: 'Entry point',
          file: 'a.txt',
          range: [2, 2],
          kind: 'changed',
          why: 'Start at the changed line.',
        },
      ],
      ...body,
    }),
  );
}

async function boot() {
  const server = serve({ repo: null, port: 0, open: false });
  await once(server, 'listening');
  return { server, base: `http://localhost:${server.address().port}` };
}

async function bootRepo(repo) {
  const server = serve({ repo, port: 0, open: false });
  await once(server, 'listening');
  return { server, base: `http://localhost:${server.address().port}` };
}

function repoRoute(repo) {
  return `/repo/${encodeURIComponent(basename(repo))}`;
}

test('opening a repo lands on story selection before generating a new story', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithChange();
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: repo }),
    });
    const route = repoRoute(repo);
    const html = (await (await fetch(`${base}${route}/stories`)).text());
    assert.ok(html.includes('New diff scope'), 'shows story selection');
    assert.ok(html.includes('No stories yet'), 'shows the empty story state');
    assert.ok(html.includes(`href="${route}/change"`), 'new story has its own repo-named route');
    assert.ok(!html.includes('Generate guided review'), 'does not jump straight to generation');

    const next = await (await fetch(`${base}${route}/change`)).text();
    assert.ok(!next.includes('Generate guided review'), 'the scope picker does not duplicate story generation');
    assert.ok(next.includes(`href="${route}/diff`), 'the scope picker links to the review viewer');
    assert.ok(next.includes('a.txt'), 'the scope picker shows the changed file');

    const diff = await (await fetch(`${base}${route}/diff`)).text();
    assert.ok(diff.includes('data-storyless'), '/diff renders the real review page with no story');
    assert.ok(diff.includes('Generate guided review'), '/diff Story tab offers the recommended guided review');
    assert.ok(diff.includes('a.txt'), '/diff shows the changed file');

    const again = await (await fetch(`${base}${route}/stories`)).text();
    assert.ok(again.includes('New diff scope'), 'explicit stories route still returns to the chooser');
    assert.ok(!again.includes("Couldn't build the review"), 'is not the error page');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('starting with a repo lands on story selection before opening the primary story', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithChange();
  writeStory(repo);
  const { server, base } = await bootRepo(repo);
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.ok(html.includes('New diff scope'), 'shows story selection');
    assert.ok(html.includes('Saved story'), 'lists the primary saved story');
    const route = repoRoute(repo);
    assert.ok(html.includes(`href="${route}/review?story=story.json"`), 'primary story has its own repo-named review route');
    assert.ok(html.includes('href="/repos"'), 'offers a way back to the repo picker');
    assert.ok(!html.includes('data-diff'), 'does not jump straight into the review diff');

    const picker = await (await fetch(`${base}/repos`)).text();
    assert.ok(picker.includes('Open a repository'), 'switch repo returns to the app picker');
    assert.ok(picker.includes('Open by path'), 'repo picker can open another folder');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('starting with a repo lists named stories even without a primary story', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithChange();
  writeStory(repo, { title: 'Named saved story', summary: 'A named saved story for this repo' }, 'stories/native.json');
  const { server, base } = await bootRepo(repo);
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.ok(html.includes('New diff scope'), 'shows story selection');
    assert.ok(html.includes('Named saved story'), 'lists the named saved story');
    const route = repoRoute(repo);
    assert.ok(html.includes(`href="${route}/review?story=stories%2Fnative.json"`), 'named story has its own repo-named review route');
    assert.ok(!html.includes('No saved stories found'), 'does not show the empty story state');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('a committed story generated against HEAD still opens the committed diff', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithCommittedHeadStory();
  const { server, base } = await bootRepo(repo);
  try {
    const review = await (await fetch(`${base}${repoRoute(repo)}/review?story=story.json`)).text();
    assert.ok(review.includes('Entry point'), 'opens the selected story');
    assert.ok(review.includes('ds-row-add'), 'shows the committed added line');
    assert.ok(!review.includes('no diff for this range'), 'does not fall back to current-file context');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('a historical committed story reads context and full-file content from its head ref', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithHistoricalHeadStoryAndMovedWorkingTree();
  const { server, base } = await bootRepo(repo);
  try {
    const route = repoRoute(repo);
    const review = await (await fetch(`${base}${route}/review?story=story.json`)).text();
    assert.ok(review.includes('Historical story'), 'opens the selected story');
    assert.ok(review.includes('head-one'), 'context step reads the story head side');
    assert.ok(!review.includes('live-one'), 'context step does not read the live working tree');

    const full = await (await fetch(`${base}/api/fullfile?file=a.txt`)).text();
    assert.ok(full.includes('head-two'), 'full-file view reads the story head side');
    assert.ok(!full.includes('live-two'), 'full-file view does not read the live working tree');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('opening a repo with a saved story lets the user select it', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithChange();
  writeStory(repo);
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: repo }),
    });
    const route = repoRoute(repo);
    const chooser = await (await fetch(`${base}${route}/stories`)).text();
    assert.ok(chooser.includes('New diff scope'), 'shows story selection');
    assert.ok(chooser.includes('Saved story'), 'lists the saved story');
    assert.ok(chooser.includes('data-delete-story'), 'shows a story remove action');
    assert.ok(chooser.includes('Working tree vs HEAD'), 'explains the diff scope');
    assert.ok(chooser.includes('git diff HEAD --'), 'shows the underlying diff command');
    assert.ok(chooser.includes(`href="${route}/review?story=story.json"`), 'saved story has its own repo-named review route');

    const review = await (await fetch(`${base}${route}/review?story=story.json`)).text();
    assert.ok(review.includes('Entry point'), 'opens the selected story');
    assert.ok(review.includes('data-close-story'), 'review page exposes a close-story affordance');
    assert.ok(review.includes(`href="${route}/stories"`), 'close-story affordance returns to the repo-named chooser route');
    assert.ok(!review.includes('New diff scope'), 'does not stay on the chooser');

    const chooserAgain = await (await fetch(`${base}${route}/stories`)).text();
    assert.ok(chooserAgain.includes('New diff scope'), 'review route does not consume the chooser route');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('story picker can remove a saved story', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithChange();
  writeStory(repo);
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: repo }),
    });
    const route = repoRoute(repo);
    const removed = await fetch(`${base}/api/stories`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'story.json' }),
    });
    assert.equal(removed.status, 200);
    const body = await removed.json();
    assert.equal(body.ok, true);
    assert.equal(body.removed, true);

    const chooser = await (await fetch(`${base}${route}/stories`)).text();
    assert.ok(chooser.includes('No stories yet'), 'returns to the empty story state');
    assert.ok(!chooser.includes('Saved story'), 'deleted story no longer appears');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('a malformed selected story shows the scope picker with a notice, not the raw error page', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithChange();
  mkdirSync(join(repo, '.diffstory'), { recursive: true });
  writeFileSync(join(repo, '.diffstory', 'story.json'), '{"bogus":true}'); // invalid tour
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: repo }),
    });
    const route = repoRoute(repo);
    const chooser = await (await fetch(`${base}${route}/stories`)).text();
    assert.ok(chooser.includes('story.json'), 'lists the bad story');
    const html = await (await fetch(`${base}${route}/review?story=story.json`)).text();
    assert.ok(html.includes('class="notice"'), 'shows a notice about the bad review');
    assert.ok(html.includes('Open diff viewer'), 'points back to the diff viewer');
    assert.ok(!html.includes("Couldn't build the review"), 'is not the raw error page');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('legacy story query routes still work for old bookmarks', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithChange();
  writeStory(repo);
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: repo }),
    });
    const changeResponse = await fetch(`${base}/?story=new`);
    assert.ok(changeResponse.url.endsWith(`${repoRoute(repo)}/change`), 'old new-story query redirects to the repo-named change route');
    const change = await changeResponse.text();
    assert.ok(change.includes('Open diff viewer'), 'old new-story query opens the scope picker');

    const reviewResponse = await fetch(`${base}/?story=story.json`);
    assert.ok(reviewResponse.url.endsWith(`${repoRoute(repo)}/review?story=story.json`), 'old story query redirects to the repo-named review route');
    const review = await reviewResponse.text();
    assert.ok(review.includes('Entry point'), 'old story query opens the selected story');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});
