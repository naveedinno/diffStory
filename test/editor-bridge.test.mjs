import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { PAGE_CSS, PAGE_JS } from '../dist/page-assets.js';
import { serve, vscodeNavigationUrl } from '../dist/server.js';

test('VS Code bridge URL carries an absolute source location for the installed bridge id', () => {
  const value = vscodeNavigationUrl('/tmp/review repo', 'src/order flow.ts', 42, 17);
  assert.ok(value);
  const url = new URL(value);
  assert.equal(url.protocol, 'vscode:');
  assert.equal(url.host, 'naveedinno.diffstory-vscode');
  assert.equal(url.pathname, '/navigate');
  assert.equal(url.searchParams.get('path'), '/tmp/review repo/src/order flow.ts');
  assert.equal(url.searchParams.get('line'), '42');
  assert.equal(url.searchParams.get('column'), '17');
});

test('VS Code bridge URL rejects absolute and escaping review paths', () => {
  assert.equal(vscodeNavigationUrl('/tmp/repo', '/etc/passwd', 1, 1), null);
  assert.equal(vscodeNavigationUrl('/tmp/repo', '../secret.ts', 1, 1), null);
  assert.equal(vscodeNavigationUrl('/tmp/repo', 'src/a.ts', 0, 1), null);
  assert.equal(vscodeNavigationUrl('/tmp/repo', 'src/a.ts', 1, 0), null);
});

test('review assets expose modifier-click navigation without taking ordinary clicks', () => {
  assert.match(PAGE_CSS, /\[data-vscode-symbol\][^{]*\{[^}]*cursor:alias/);
  assert.match(PAGE_JS, /b=closest\(t,'\[data-vscode-symbol\]'\);if\(b&&\(e\.metaKey\|\|e\.ctrlKey\)\)/);
  assert.match(PAGE_JS, /fetch\(reviewPageUrl\('\/api\/editor\/open'\)/);
});

test('leased editor endpoint dispatches only reviewed files to the bridge', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'diffstory-editor-bridge-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  writeFileSync(join(repo, 'order.ts'), 'export function executeOrder() { return 1; }\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'base'], { cwd: repo });
  writeFileSync(join(repo, 'order.ts'), 'export function executeOrder() { return 2; }\n');

  const opened = [];
  const server = serve({ repo, port: 0, open: false, openExternal: (url) => { opened.push(url); return true; } });
  await once(server, 'listening');
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const review = await fetch(`${base}/repo/${encodeURIComponent(basename(repo))}/diff`);
    assert.equal(review.status, 200);
    const html = await review.text();
    const token = html.match(/data-review-page-token="([^"]+)"/)?.[1];
    assert.ok(token);

    const response = await fetch(`${base}/api/editor/open?page=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'order.ts', line: 1, column: 17 }),
    });
    assert.equal(response.status, 200);
    assert.equal(opened.length, 1);
    const target = new URL(opened[0]);
    assert.equal(target.searchParams.get('path'), join(repo, 'order.ts'));
    assert.equal(target.searchParams.get('line'), '1');
    assert.equal(target.searchParams.get('column'), '17');

    const rejected = await fetch(`${base}/api/editor/open?page=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: '../outside.ts', line: 1, column: 1 }),
    });
    assert.equal(rejected.status, 400);
    assert.equal(opened.length, 1);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});
