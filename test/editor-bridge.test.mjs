import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';

// The Cmd/Ctrl-click bridge lives in the ported review engine now.
const PAGE_JS = readFileSync(new URL('../client/surfaces/review/engine/review-engine.js', import.meta.url), 'utf8');
const PAGE_CSS = readFileSync(new URL('../client/surfaces/review/review.css', import.meta.url), 'utf8');
import { serve, vscodeNavigationUrl } from '../dist/server.js';

test('VS Code URL carries an absolute source location through the built-in file handler', () => {
  const value = vscodeNavigationUrl('/tmp/review repo', 'src/order flow.ts', 42, 17);
  assert.equal(value, 'vscode://file/tmp/review%20repo/src/order%20flow.ts:42:17');
  const url = new URL(value);
  assert.equal(url.protocol, 'vscode:');
  assert.equal(url.host, 'file');
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
    // The page facts travel in the shell's JSON payload now; `<body>` gets them
    // from React at mount, so the server response no longer carries them as
    // attributes.
    const payload = JSON.parse(
      html.match(/<script type="application\/json" id="__DIFFSTORY_DATA__">([\s\S]*?)<\/script>/)[1],
    );
    const token = payload.pageToken;
    assert.ok(token);

    const response = await fetch(`${base}/api/editor/open?page=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'order.ts', line: 1, column: 17 }),
    });
    assert.equal(response.status, 200);
    assert.equal(opened.length, 1);
    const target = new URL(opened[0]);
    assert.equal(target.protocol, 'vscode:');
    assert.equal(target.host, 'file');
    assert.equal(decodeURIComponent(target.pathname), `${join(repo, 'order.ts')}:1:17`);

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
