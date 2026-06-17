// Integration test: boot the app server (no repo) and drive the repo endpoints
// over HTTP. Uses a temp HOME so recents never touch the real ~/.diffstory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { serve } from '../dist/server.js';

function gitRepo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-app-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  execFileSync('git', ['config', 'user.email', 't@e.st'], { cwd: d });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: d });
  writeFileSync(join(d, 'README.md'), '# hi\n');
  execFileSync('git', ['add', '.'], { cwd: d });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: d });
  return d;
}

async function boot() {
  const server = serve({ repo: null, port: 0, open: false });
  await once(server, 'listening');
  const { port } = server.address();
  return { server, base: `http://localhost:${port}` };
}

test('app server drives picker → open → refs → recent → close', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = gitRepo();
  const { server, base } = await boot();
  try {
    const root = await fetch(`${base}/`);
    assert.equal(root.status, 200);
    const rootText = (await root.text()).toLowerCase();
    assert.ok(rootText.includes('pick a repo'));
    assert.ok(rootText.includes('open by path'));

    assert.equal((await fetch(`${base}/api/refs`)).status, 409);

    const opened = await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    assert.equal(opened.status, 200);
    const state = await opened.json();
    assert.equal(state.isGit, true);
    assert.equal(state.hasTour, false);

    const refs = await (await fetch(`${base}/api/refs`)).json();
    assert.ok(Array.isArray(refs.branches));
    assert.ok(Array.isArray(refs.commits));

    const recent = await (await fetch(`${base}/api/repos/recent`)).json();
    assert.ok(recent.some((r) => r.path === repo));

    assert.equal((await fetch(`${base}/api/repo/close`, { method: 'POST' })).status, 200);
    assert.equal((await fetch(`${base}/api/refs`)).status, 409);

    // opening a non-git path is rejected
    const bad = await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: tmpHome }),
    });
    assert.equal(bad.status, 400);

    // generate without a repo open → 409 (guard returns before any spawn)
    const gen = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(gen.status, 409);
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});
