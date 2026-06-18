// Integration test: opening a repo with no tour lands on the "Your change" screen
// (NOT an error page), and no agent is started. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

async function boot() {
  const server = serve({ repo: null, port: 0, open: false });
  await once(server, 'listening');
  return { server, base: `http://localhost:${server.address().port}` };
}

test('opening a no-tour repo lands on the change screen, not an error', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = repoWithChange();
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: repo }),
    });
    const html = (await (await fetch(`${base}/`)).text());
    assert.ok(html.includes('Generate guided review'), 'shows the Generate action');
    assert.ok(html.includes('a.txt'), 'shows the changed file');
    assert.ok(!html.includes("Couldn't build the review"), 'is not the error page');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('a malformed story shows the change screen with a notice, not the raw error page', async () => {
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
    const html = await (await fetch(`${base}/`)).text();
    assert.ok(html.includes('class="notice"'), 'shows a notice about the bad review');
    assert.ok(html.includes('Generate guided review'), 'offers regenerate');
    assert.ok(!html.includes("Couldn't build the review"), 'is not the raw error page');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});
