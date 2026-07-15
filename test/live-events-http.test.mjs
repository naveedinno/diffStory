import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { once } from 'node:events';
import { serve } from '../dist/server.js';

function repoFixture() {
  const repo = mkdtempSync(join(tmpdir(), 'ds-live-http-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  writeFileSync(join(repo, 'README.md'), '# before\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: repo });
  writeFileSync(join(repo, 'README.md'), '# after\n');
  mkdirSync(join(repo, '.diffstory'), { recursive: true });
  writeFileSync(join(repo, '.diffstory', 'comments.json'), '[]\n');
  return repo;
}

function tokenFrom(html) {
  const match = html.match(/data-review-page-token="([^"]+)"/);
  assert.ok(match?.[1]);
  return match[1];
}

async function readUntil(reader, pattern, timeoutMs = 3000) {
  const decoder = new TextDecoder();
  let text = '';
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out waiting for ${pattern}`)), timeoutMs);
  });
  const reading = (async () => {
    while (!pattern.test(text)) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
    assert.match(text, pattern);
    return text;
  })();
  try {
    return await Promise.race([reading, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

test('HTTP live stream authenticates leases, keeps two tabs valid, and emits file invalidations', async () => {
  const repo = repoFixture();
  const server = serve({ repo, port: 0, open: false });
  await once(server, 'listening');
  const address = server.address();
  const base = `http://localhost:${address.port}`;
  const route = `/repo/${encodeURIComponent(basename(repo))}/diff`;
  const controller = new AbortController();

  try {
    const firstHtml = await (await fetch(`${base}${route}`)).text();
    const firstToken = tokenFrom(firstHtml);
    const secondHtml = await (await fetch(`${base}${route}`)).text();
    const secondToken = tokenFrom(secondHtml);
    assert.notEqual(firstToken, secondToken);

    const oldTabPanel = await fetch(`${base}/api/diff/file-panel?file=README.md&page=${encodeURIComponent(firstToken)}`);
    assert.equal(oldTabPanel.status, 200, 'opening a second tab must not invalidate the first lease');
    assert.equal((await fetch(`${base}/api/events?page=not-a-lease`)).status, 204);

    const stream = await fetch(`${base}/api/events?page=${encodeURIComponent(firstToken)}`, { signal: controller.signal });
    assert.equal(stream.status, 200);
    const reader = stream.body.getReader();
    await readUntil(reader, /event: state/);

    writeFileSync(join(repo, '.diffstory', 'comments.json'), `${JSON.stringify([{
      id: 'external', file: 'README.md', line: 1, type: 'question', severity: 'concern',
      body: 'Did this arrive live?', status: 'open', createdAt: new Date().toISOString(), turns: [],
    }], null, 2)}\n`);
    await readUntil(reader, /event: comments-changed/, 5000);
  } finally {
    controller.abort();
    await new Promise((resolve) => server.close(resolve));
    rmSync(repo, { recursive: true, force: true });
  }
});
