import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { serve } from '../dist/server.js';
import { saveRecents } from '../dist/recents.js';

function storyRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'ds-home-nav-repo-'));
  const git = (args) => execFileSync('git', args, { cwd: repo });
  git(['init', '-q']);
  git(['config', 'user.email', 't@e.st']);
  git(['config', 'user.name', 'Test']);
  writeFileSync(join(repo, 'a.txt'), 'one\n');
  git(['add', '.']);
  git(['commit', '-qm', 'initial']);
  writeFileSync(join(repo, 'a.txt'), 'one\ntwo\n');
  mkdirSync(join(repo, '.diffstory'), { recursive: true });
  writeFileSync(join(repo, '.diffstory', 'story.json'), JSON.stringify({
    version: 1,
    title: 'Home navigation fixture',
    summary: 'Exercises the real story-to-home route.',
    base: 'HEAD',
    steps: [{
      id: 'changed-line',
      order: 1,
      title: 'Changed line',
      file: 'a.txt',
      range: [2, 2],
      kind: 'changed',
      why: 'The story page provides the logo link under test.',
    }],
  }));
  return repo;
}

test('the logo returns from an open repository to home without waiting for repo inspection', async () => {
  const repo = storyRepo();
  const home = mkdtempSync(join(tmpdir(), 'ds-home-nav-home-'));
  const bin = mkdtempSync(join(tmpdir(), 'ds-home-nav-bin-'));
  const realPath = process.env.PATH;
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const gitWrapper = join(bin, 'git');
  writeFileSync(
    gitWrapper,
    `#!/bin/sh\nsleep 0.15\nexec "${realGit.replaceAll('"', '\\"')}" "$@"\n`,
  );
  chmodSync(gitWrapper, 0o755);
  saveRecents(home, [{ path: repo, lastOpened: Date.now() }]);

  const server = serve({ repo, port: 0, open: false, homeOverride: home });
  await once(server, 'listening');
  const origin = `http://localhost:${server.address().port}`;

  try {
    const reviewHistory = await (await fetch(
      `${origin}/repo/${encodeURIComponent(basename(repo))}/stories`,
    )).text();
    assert.match(reviewHistory, /class="nv-brand" href="\/repos"/, 'repository logo points at home');

    process.env.PATH = `${bin}:${realPath}`;
    const started = performance.now();
    const response = await fetch(`${origin}/repos`);
    const html = await response.text();
    const elapsedMs = performance.now() - started;

    assert.equal(response.status, 200);
    assert.match(html, /Add repository/);
    assert.ok(
      elapsedMs < 300,
      `logo-to-home navigation took ${Math.round(elapsedMs)}ms because it waited for repository inspection`,
    );
  } finally {
    process.env.PATH = realPath;
    server.close();
    await once(server, 'close');
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('repository and story navigation do not synchronously repeat Git inspection', async () => {
  const repo = storyRepo();
  const home = mkdtempSync(join(tmpdir(), 'ds-nav-matrix-home-'));
  const bin = mkdtempSync(join(tmpdir(), 'ds-nav-matrix-bin-'));
  const realPath = process.env.PATH;
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const gitWrapper = join(bin, 'git');
  const gitLog = join(bin, 'git.log');
  writeFileSync(
    gitWrapper,
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "${gitLog.replaceAll('"', '\\"')}"\ncase "$1" in diff|status) sleep 0.08;; esac\nexec "${realGit.replaceAll('"', '\\"')}" "$@"\n`,
  );
  chmodSync(gitWrapper, 0o755);
  saveRecents(home, [{ path: repo, lastOpened: Date.now() }]);

  const server = serve({ repo, port: 0, open: false, homeOverride: home });
  await once(server, 'listening');
  const origin = `http://localhost:${server.address().port}`;
  const repoRoute = `/repo/${encodeURIComponent(basename(repo))}`;
  const timings = [];

  async function navigate(name, path, init, expected) {
    writeFileSync(gitLog, '');
    const started = performance.now();
    const response = await fetch(`${origin}${path}`, init);
    const body = await response.text();
    const gitCommands = readFileSync(gitLog, 'utf8').split('\n').filter(Boolean);
    timings.push({ name, elapsedMs: performance.now() - started, gitCommands });
    assert.equal(response.status, 200, `${name} returns a successful page`);
    assert.match(body, expected, `${name} reaches its destination`);
  }

  try {
    process.env.PATH = `${bin}:${realPath}`;
    await navigate('close story', `${repoRoute}/stories`, undefined, /Review history/);
    await navigate('open story', `${repoRoute}/review?story=story.json`, undefined, /Home navigation fixture/);
    await navigate('visit home', '/repos', undefined, /Add repository/);
    await navigate(
      'open repository',
      '/api/repo/open',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: repo }),
      },
      /"route":"\/repo\//,
    );

    const slow = timings.filter(
      ({ elapsedMs, gitCommands }) => elapsedMs >= 2_000 || gitCommands.length > 20,
    );
    assert.deepEqual(
      slow,
      [],
      `navigation waited for repeated Git inspection: ${slow.map(({ name, elapsedMs, gitCommands }) => `${name}=${Math.round(elapsedMs)}ms (${gitCommands.length} Git commands)`).join(', ')}`,
    );
  } finally {
    process.env.PATH = realPath;
    server.close();
    await once(server, 'close');
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    rmSync(bin, { recursive: true, force: true });
  }
});

test('closing a story keeps the next repository entry on review history', async () => {
  const repo = storyRepo();
  const home = mkdtempSync(join(tmpdir(), 'ds-close-story-home-'));
  const server = serve({ repo: null, port: 0, open: false, homeOverride: home });
  await once(server, 'listening');
  const origin = `http://localhost:${server.address().port}`;
  const repoRoute = `/repo/${encodeURIComponent(basename(repo))}`;

  async function openRepository() {
    const response = await fetch(`${origin}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    assert.equal(response.status, 200);
    return response.json();
  }

  try {
    assert.equal((await openRepository()).route, `${repoRoute}/stories`);

    const review = await fetch(`${origin}${repoRoute}/review?story=story.json`);
    assert.equal(review.status, 200);
    assert.match(await review.text(), /Home navigation fixture/);

    const history = await fetch(`${origin}${repoRoute}/stories`);
    assert.equal(history.status, 200);
    assert.match(await history.text(), /Review history/);

    const homeResponse = await fetch(`${origin}/repos`);
    assert.equal(homeResponse.status, 200);
    assert.match(await homeResponse.text(), /Add repository/);

    assert.equal(
      (await openRepository()).route,
      `${repoRoute}/stories`,
      'after the reviewer closes a story, opening its repository should return to review history',
    );
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('visiting home does not strand a review restored from browser history', async () => {
  const repo = storyRepo();
  const home = mkdtempSync(join(tmpdir(), 'ds-browser-history-home-'));
  const server = serve({ repo, port: 0, open: false, homeOverride: home });
  await once(server, 'listening');
  const origin = `http://localhost:${server.address().port}`;
  const repoRoute = `/repo/${encodeURIComponent(basename(repo))}`;

  try {
    const review = await fetch(`${origin}${repoRoute}/review?story=story.json`);
    assert.equal(review.status, 200);
    const html = await review.text();
    const token = html.match(/data-review-page-token="([^"]+)"/)?.[1];
    assert.ok(token, 'review page receives a lease for its lazy requests');

    const picker = await fetch(`${origin}/repos`);
    assert.equal(picker.status, 200);
    assert.match(await picker.text(), /Add repository/);

    const restoredPageState = await fetch(
      `${origin}/api/review-state?page=${encodeURIComponent(token)}`,
    );
    assert.equal(
      restoredPageState.status,
      200,
      'a review restored by browser Back should keep working after the picker was visited',
    );
  } finally {
    server.close();
    await once(server, 'close');
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
