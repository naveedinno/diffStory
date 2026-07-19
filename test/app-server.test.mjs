// Integration test: boot the app server (no repo) and drive the repo endpoints
// over HTTP. Uses a temp HOME so recents never touch the real ~/.diffstory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { serve } from '../dist/server.js';
import { getDiff } from '../dist/git.js';
import { parseUnifiedDiff } from '../dist/diff.js';
import { diffFingerprint } from '../dist/stories.js';

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

function addCommits(repo, count) {
  for (let i = 1; i <= count; i++) {
    writeFileSync(join(repo, 'README.md'), `# hi\n${i}\n`);
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-qm', `change ${i}`], { cwd: repo });
  }
}

async function boot(repo = null) {
  const server = serve({ repo, port: 0, open: false });
  await once(server, 'listening');
  const { address, port } = server.address();
  assert.equal(address, '127.0.0.1', 'local app server only listens on loopback');
  return { server, base: `http://localhost:${port}` };
}

function reviewPageToken(html) {
  const match = html.match(/data-review-page-token="([^"]+)"/);
  assert.ok(match?.[1], 'review page issues a lazy-evidence token');
  return match[1];
}

function leased(url, token) {
  return `${url}${url.includes('?') ? '&' : '?'}page=${encodeURIComponent(token)}`;
}

test('malformed feedback blocks every comment write without losing source bytes', async () => {
  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# changed\n');
  mkdirSync(join(repo, '.diffstory'), { recursive: true });
  const commentsFile = join(repo, '.diffstory', 'comments.json');
  const malformed = '[null, {"partial": true}]';
  writeFileSync(commentsFile, malformed);
  const { server, base } = await boot(repo);
  try {
    const route = `/repo/${encodeURIComponent(basename(repo))}/diff`;
    const pageHtml = await (await fetch(`${base}${route}`)).text();
    assert.match(pageHtml, /data-feedback-health="invalid"/);
    assert.match(pageHtml, /Feedback file needs repair/);

    const state = await (await fetch(`${base}/api/review-state`)).json();
    assert.equal(state.feedbackHealth.status, 'invalid');
    assert.match(state.feedbackHealth.recovery, /will not overwrite/i);

    const reads = await fetch(`${base}/api/comments`);
    assert.equal(reads.status, 409);
    assert.equal((await reads.json()).feedbackHealth.status, 'invalid');

    const writes = [
      fetch(`${base}/api/comments`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: 'README.md', line: 1, type: 'change', body: 'x' }),
      }),
      fetch(`${base}/api/comments/c1/message`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x' }),
      }),
      fetch(`${base}/api/comments/c1`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }),
      }),
      fetch(`${base}/api/comments/c1`, { method: 'DELETE' }),
    ];
    for (const pending of writes) {
      const response = await pending;
      assert.equal(response.status, 409);
      assert.equal((await response.json()).feedbackHealth.status, 'invalid');
      assert.equal(readFileSync(commentsFile, 'utf8'), malformed);
    }

    // The one-shot model has no verdict endpoint to gate; the routes are gone.
    const verdict = await fetch(`${base}/api/review/verdict`, { method: 'POST', body: '{}' });
    assert.equal(verdict.status, 404);
    const checkpoint = await fetch(`${base}/api/review/checkpoint`, { method: 'POST' });
    assert.equal(checkpoint.status, 404);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});

test('lazy file evidence remains available when only another file changes', async () => {
  const repo = gitRepo();
  writeFileSync(join(repo, 'review.txt'), 'review base\n');
  writeFileSync(join(repo, 'other.txt'), 'other base\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'add review fixtures'], { cwd: repo });
  writeFileSync(join(repo, 'review.txt'), 'review changed\n');
  writeFileSync(join(repo, 'other.txt'), 'other changed\n');

  const { server, base } = await boot(repo);
  try {
    const route = `/repo/${encodeURIComponent(basename(repo))}/diff`;
    const pageHtml = await (await fetch(`${base}${route}`)).text();
    const token = reviewPageToken(pageHtml);

    writeFileSync(join(repo, 'other.txt'), 'other changed again\n');

    const unchangedFileEndpoints = [
      '/api/diff/file-panel?file=review.txt',
      '/api/fullfile?file=review.txt',
      '/api/diff/split?file=review.txt',
      '/api/diff/context?file=review.txt&from=1&to=1&layout=unified',
    ];
    for (const endpoint of unchangedFileEndpoints) {
      const response = await fetch(leased(`${base}${endpoint}`, token));
      assert.equal(response.status, 200, `${endpoint} keeps serving unchanged file evidence`);
    }

    const changedFile = await fetch(leased(`${base}/api/diff/file-panel?file=other.txt`, token));
    assert.equal(changedFile.status, 409, 'the file that actually moved still requires fresh evidence');
    assert.equal((await changedFile.json()).reloadRequired, true);

    const wholeReviewPanel = await fetch(leased(`${base}/api/review/step-panel?index=1`, token));
    assert.equal(wholeReviewPanel.status, 409, 'story-wide evidence stays bound to the full change');

  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});

test('app server serves the bundled Mermaid ESM from the same origin', async () => {
  const { server, base } = await boot();
  try {
    const res = await fetch(`${base}/assets/mermaid.esm.min.mjs`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /^text\/javascript/);
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin');
    assert.match(
      res.headers.get('content-security-policy') ?? '',
      /script-src 'self' 'unsafe-inline'/,
    );
    const source = await res.text();
    assert.ok(source.length > 500_000, 'serves the real local Mermaid browser bundle');
    assert.match(source, /export\{/);
  } finally {
    server.close();
  }
});

function requestStatusWithHost(base, host) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1',
      port: url.port,
      path: '/',
      method: 'GET',
      headers: { host },
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

function installFakeClaude(binDir) {
  const path = join(binDir, 'claude');
  writeFileSync(
    path,
    `#!/bin/sh
printf '\\nagent edit\\n' >> README.md
printf '%s\\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":"README.md"}}]}}'
`,
  );
  chmodSync(path, 0o755);
}

function installFakeStoryRepairClaude(binDir) {
  const path = join(binDir, 'claude');
  writeFileSync(
    path,
    `#!/bin/sh
node -e "const fs=require('fs');const p='.diffstory/story.json';const s=JSON.parse(fs.readFileSync(p,'utf8'));s.steps[0].why='Shortened explanation.';fs.writeFileSync(p,JSON.stringify(s,null,2)+'\\n');"
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":".diffstory/story.json"}}]}}'
`,
  );
  chmodSync(path, 0o755);
}

test('POST /api/story/repair runs the selected agent and validates the rewritten story', async () => {
  const realPath = process.env.PATH;
  const fakeBin = mkdtempSync(join(tmpdir(), 'ds-story-repair-agent-'));
  process.env.PATH = `${fakeBin}:${realPath ?? ''}`;
  installFakeStoryRepairClaude(fakeBin);

  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# hi\nchanged\n');
  mkdirSync(join(repo, '.diffstory'), { recursive: true });
  writeFileSync(join(repo, '.diffstory', 'story.json'), `${JSON.stringify({
    version: 2,
    mode: 'guided',
    title: 'Review the changed readme',
    summary: 'One focused change.',
    intent: { goal: 'Explain the readme change.', sources: ['code-derived'] },
    base: 'HEAD',
    steps: [{
      id: 's1', order: 1, title: 'The changed line', file: 'README.md',
      range: [2, 2], viewport: [1, 2], highlights: [[2, 2]], kind: 'changed',
      why: 'This explanation is deliberately too long for the focused review step.',
    }],
  }, null, 2)}\n`);

  const { server, base } = await boot(repo);
  try {
    const response = await fetch(`${base}/api/story/repair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'shorten', agent: 'claude', file: 'README.md', stepId: 's1' }),
    });
    assert.equal(response.status, 200);
    const events = ndjsonEvents(await response.text());
    const done = events.find((event) => event.type === 'run_done');
    assert.equal(done?.status, 'complete');
    const repaired = JSON.parse(readFileSync(join(repo, '.diffstory', 'story.json'), 'utf8'));
    assert.equal(repaired.steps[0].why, 'Shortened explanation.');
    assert.match(repaired.diffFingerprint, /^[a-f0-9]{64}$/);
    assert.equal(readFileSync(join(repo, 'README.md'), 'utf8'), '# hi\nchanged\n');
  } finally {
    server.close();
    process.env.PATH = realPath;
    rmSync(repo, { recursive: true, force: true });
    rmSync(fakeBin, { recursive: true, force: true });
  }
});

async function fakeCodexDesktop(socketPath) {
  rmSync(socketPath, { force: true });
  const requests = [];
  const server = createNetServer((socket) => {
    let buffered = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= 4) {
        const length = buffered.readUInt32LE(0);
        if (buffered.length < length + 4) return;
        const message = JSON.parse(buffered.subarray(4, length + 4).toString('utf8'));
        buffered = buffered.subarray(length + 4);
        requests.push(message);
        const response = message.method === 'initialize'
          ? {
              type: 'response', requestId: message.requestId, resultType: 'success',
              method: 'initialize', handledByClientId: 'router', result: { clientId: 'diffstory-client' },
            }
          : {
              type: 'response', requestId: message.requestId, resultType: 'success',
              method: message.method, handledByClientId: 'desktop-owner', result: { result: { turn: { id: 'turn-1' } } },
            };
        const json = JSON.stringify(response);
        const frame = Buffer.alloc(4 + Buffer.byteLength(json));
        frame.writeUInt32LE(Buffer.byteLength(json), 0);
        frame.write(json, 4);
        socket.write(frame);
      }
    });
  });
  server.listen(socketPath);
  await once(server, 'listening');
  return { server, requests };
}

function installFakeCodex(binDir) {
  const path = join(binDir, 'codex');
  writeFileSync(
    path,
    `#!/bin/sh
printf '\\ncodex edit\\n' >> README.md
printf '%s\\n' '$ printf codex'
`,
  );
  chmodSync(path, 0o755);
}

function installFakeResumingCodex(binDir, threadId) {
  const path = join(binDir, 'codex');
  writeFileSync(
    path,
    `#!/bin/sh
printf '%s\n' "$@" > codex-args.txt
printf '\nresumed codex edit\n' >> README.md
printf '%s\n' '{"type":"thread.started","thread_id":"${threadId}"}'
`,
  );
  chmodSync(path, 0o755);
}

function ndjsonEvents(text) {
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test('app server drives picker → open → refs → recent → close', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = gitRepo();
  addCommits(repo, 82);
  const { server, base } = await boot();
  try {
    const root = await fetch(`${base}/`);
    assert.equal(root.status, 200);
    assert.equal(root.headers.get('x-frame-options'), 'DENY');
    assert.equal(root.headers.get('x-content-type-options'), 'nosniff');
    assert.match(root.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
    const rootText = (await root.text()).toLowerCase();
    assert.ok(rootText.includes('pick a repo'));
    assert.ok(rootText.includes('add repository'));
    assert.ok(rootText.includes('skillwarn'));
    assert.ok(rootText.includes('update skills'));
    assert.ok(rootText.includes('/api/skills/update'));
    assert.ok(rootText.includes('d.route'));
    assert.ok(rootText.includes("'/repo/'+encodeuricomponent"));

    const hostileOrigin = await fetch(`${base}/api/repo/close`, {
      method: 'POST',
      headers: { origin: 'https://example.com' },
    });
    assert.equal(hostileOrigin.status, 403, 'cross-origin browser writes are rejected');

    assert.equal(await requestStatusWithHost(base, 'example.com'), 403, 'non-loopback Host headers are rejected');

    const oversized = await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'x'.repeat(1_000_001) }),
    });
    assert.equal(oversized.status, 413, 'oversized request bodies get a useful HTTP response');
    assert.equal((await oversized.json()).error, 'Request body is too large.');

    const agents = await (await fetch(`${base}/api/agents`)).json();
    assert.ok(Array.isArray(agents.agents));
    assert.equal(agents.skills.name, 'diffstory-storyteller');
    assert.equal(agents.skills.installed, false);
    assert.equal(agents.skills.current, false);
    assert.ok(agents.skills.message.includes('not installed'));
    assert.equal(agents.skills.agents.claude.current, false);
    assert.equal(agents.skills.agents.codex.current, false);

    const updated = await fetch(`${base}/api/skills/update`, { method: 'POST' });
    assert.equal(updated.status, 200);
    const updatedBody = await updated.json();
    assert.equal(updatedBody.skills.current, true);
    assert.equal(updatedBody.skills.agents.claude.current, true);
    assert.equal(updatedBody.skills.agents.codex.current, true);
    assert.ok(existsSync(join(tmpHome, '.agents', 'skills', 'diffstory-storyteller', 'SKILL.md')));
    assert.ok(existsSync(join(tmpHome, '.claude', 'skills', 'diffstory-storyteller', 'SKILL.md')));
    assert.ok(existsSync(join(tmpHome, '.codex', 'skills', 'address-review', 'SKILL.md')));

    const agentsAfter = await (await fetch(`${base}/api/agents`)).json();
    assert.equal(agentsAfter.skills.current, true);

    if (process.platform === 'darwin' && existsSync('/usr/bin/say')) {
      const tts = await fetch(`${base}/api/tts/say`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'diffStory local voice check', voice: 'daniel', rate: 1 }),
      });
      assert.equal(tts.status, 200);
      const ttsBody = await tts.json();
      assert.equal(ttsBody.voice, 'Daniel');
      assert.match(ttsBody.url, /^\/api\/tts\/say\/[a-f0-9]{64}\.m4a$/);

      const audio = await fetch(`${base}${ttsBody.url}`);
      assert.equal(audio.status, 200);
      assert.match(audio.headers.get('content-type') ?? '', /audio\/mp4/);
      assert.ok((await audio.arrayBuffer()).byteLength > 0);
    }

    const badKokoro = await fetch(`${base}/api/tts/kokoro`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(badKokoro.status, 400);
    assert.equal((await badKokoro.json()).error, 'invalid JSON');

    assert.equal((await fetch(`${base}/api/tts/kokoro/not-a-real.wav`)).status, 404);

    // server-backed folder browser lists dirs and flags the repo itself
    const fs = await (await fetch(`${base}/api/fs?path=${encodeURIComponent(repo)}`)).json();
    assert.equal(typeof fs.path, 'string');
    assert.equal(fs.isGit, true);
    assert.ok(Array.isArray(fs.entries));

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
    assert.equal(state.route, `/repo/${encodeURIComponent(basename(repo))}/stories`);

    const stories = await fetch(`${base}/repo/${encodeURIComponent(basename(repo))}/stories`);
    assert.equal(stories.status, 200);
    assert.equal(stories.url, `${base}/repo/${encodeURIComponent(basename(repo))}/stories`);

    const legacyStories = await fetch(`${base}/stories`);
    assert.equal(legacyStories.status, 200);
    assert.equal(legacyStories.url, `${base}/repo/${encodeURIComponent(basename(repo))}/stories`);

    const refs = await (await fetch(`${base}/api/refs`)).json();
    assert.ok(Array.isArray(refs.branches));
    assert.ok(Array.isArray(refs.commits));
    assert.ok(refs.commits.length > 80, 'ref picker exposes every commit, not only a capped recent list');
    assert.ok(refs.branches.every((b) => typeof b === 'object' && typeof b.name === 'string'), 'branches include picker metadata');
    assert.match(refs.commits[0].committedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:/, 'commits expose ISO commit time');
    assert.match(refs.commits[0].committedAtLabel, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, 'commits expose compact picker time');
    assert.match(refs.commits[0].committedAtRelative, /^(just now|\d+[mhdw] ago|\d+mo ago|\d+y ago)$/, 'commits expose relative picker time');

    const scopedRefs = await (await fetch(`${base}/api/refs?ref=${encodeURIComponent('HEAD~10')}`)).json();
    assert.equal(scopedRefs.ref, 'HEAD~10');
    assert.ok(scopedRefs.commits.length > 0, 'branch-scoped commit picker still returns commits');
    assert.ok(scopedRefs.commits.length < refs.commits.length, 'branch-scoped commit picker does not return all refs');

    const recent = await (await fetch(`${base}/api/repos/recent`)).json();
    assert.ok(recent.some((r) => r.path === repo));

    assert.equal((await fetch(`${base}/api/repo/close`, { method: 'POST' })).status, 200);
    assert.equal((await fetch(`${base}/api/refs`)).status, 409);

    const picker = await (await fetch(`${base}/repos`)).text();
    assert.ok(picker.includes('data-remove-repo'), 'repo picker exposes a remove action for recents');

    const removed = await fetch(`${base}/api/repos/recent`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    assert.equal(removed.status, 200);
    const removedBody = await removed.json();
    assert.equal(removedBody.ok, true);
    assert.equal(removedBody.removed, true);

    const recentAfterRemove = await (await fetch(`${base}/api/repos/recent`)).json();
    assert.ok(!recentAfterRemove.some((r) => r.path === repo));

    // opening a non-git path is rejected
    const bad = await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: tmpHome }),
    });
    assert.equal(bad.status, 400);

    // generate without a repo open → 409 with a structured preflight error event
    const gen = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(gen.status, 409);
    const genBody = await gen.json();
    assert.equal(genBody.type, 'error');
    assert.equal(genBody.stage, 'preflight');
    assert.match(genBody.label, /repository/i);
    assert.ok(genBody.detail.length > 0);

    // address without a repo open → 409 with the same structured blocked shape
    const addr = await fetch(`${base}/api/address`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    assert.equal(addr.status, 409);
    const addrBody = await addr.json();
    assert.equal(addrBody.type, 'error');
    assert.equal(addrBody.stage, 'preflight');
  } finally {
    server.close();
    process.env.HOME = realHome;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('POST /api/comments/:id/message appends a user turn and reopens the thread', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = gitRepo();
  addCommits(repo, 1);
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    const created = await (await fetch(`${base}/api/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: 'README.md', line: 1, type: 'question', body: 'why?' }),
    })).json();

    const res = await fetch(`${base}/api/comments/${created.id}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'a follow-up' }),
    });
    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.status, 'open');
    assert.equal(updated.turns.at(-1).role, 'user');
    assert.equal(updated.turns.at(-1).text, 'a follow-up');

    const empty = await fetch(`${base}/api/comments/${created.id}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '  ' }),
    });
    assert.equal(empty.status, 400);

    const missing = await fetch(`${base}/api/comments/nope/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x' }),
    });
    assert.equal(missing.status, 404);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
    process.env.HOME = realHome;
  }
});

test('addressing comments from the raw diff viewer reports code edits so the UI can reload', async () => {
  const realHome = process.env.HOME;
  const realPath = process.env.PATH;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  const fakeBin = mkdtempSync(join(tmpdir(), 'ds-agent-bin-'));
  process.env.HOME = tmpHome;
  process.env.PATH = `${fakeBin}:${realPath ?? ''}`;
  installFakeClaude(fakeBin);

  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# hi\nraw diff change\n');
  const { server, base } = await boot();
  try {
    const opened = await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    assert.equal(opened.status, 200);

    const route = `/repo/${encodeURIComponent(basename(repo))}`;
    const diff = await fetch(`${base}${route}/diff`);
    assert.equal(diff.status, 200);
    assert.match(await diff.text(), /data-storyless="1"/);

    const comment = await fetch(`${base}/api/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'README.md', line: 2, type: 'change', body: 'Please adjust this line.' }),
    });
    assert.equal(comment.status, 201);

    const addr = await fetch(`${base}/api/address`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    assert.equal(addr.status, 200);
    const done = ndjsonEvents(await addr.text()).find((e) => e.type === 'run_done');
    assert.equal(done?.status, 'complete');
    assert.equal(done?.result?.codeChanged, true);
  } finally {
    server.close();
    process.env.HOME = realHome;
    process.env.PATH = realPath;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(fakeBin, { recursive: true, force: true });
  }
});

test('POST /api/address honors the selected agent instead of first PATH match', async () => {
  const realHome = process.env.HOME;
  const realPath = process.env.PATH;
  const realCodexBinary = process.env.DIFFSTORY_CODEX_BINARY;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  const fakeBin = mkdtempSync(join(tmpdir(), 'ds-agent-bin-'));
  process.env.HOME = tmpHome;
  process.env.PATH = `${fakeBin}:${realPath ?? ''}`;
  installFakeClaude(fakeBin);
  installFakeCodex(fakeBin);
  process.env.DIFFSTORY_CODEX_BINARY = join(fakeBin, 'codex');

  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# hi\nraw diff change\n');
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    await fetch(`${base}/api/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'README.md', line: 2, type: 'change', body: 'Please adjust this line.' }),
    });

    const addr = await fetch(`${base}/api/address`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true, agent: 'codex' }),
    });
    assert.equal(addr.status, 200);
    const events = ndjsonEvents(await addr.text());
    assert.equal(events.find((e) => e.type === 'context')?.agent, 'codex');
    assert.match(readFileSync(join(repo, 'README.md'), 'utf8'), /codex edit/);
    assert.doesNotMatch(readFileSync(join(repo, 'README.md'), 'utf8'), /agent edit/);
  } finally {
    server.close();
    process.env.HOME = realHome;
    process.env.PATH = realPath;
    if (realCodexBinary === undefined) delete process.env.DIFFSTORY_CODEX_BINARY;
    else process.env.DIFFSTORY_CODEX_BINARY = realCodexBinary;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(fakeBin, { recursive: true, force: true });
  }
});

test('POST /api/address sends a visible turn through the selected task live Desktop owner', async () => {
  const realHome = process.env.HOME;
  const realPath = process.env.PATH;
  const realCodexBinary = process.env.DIFFSTORY_CODEX_BINARY;
  const realCodexSocket = process.env.DIFFSTORY_CODEX_IPC_SOCKET;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  const fakeBin = mkdtempSync(join(tmpdir(), 'ds-agent-bin-'));
  const threadId = '019f5079-f420-7423-8aa8-cf9f6a079e03';
  process.env.HOME = tmpHome;
  process.env.PATH = `${fakeBin}:${realPath ?? ''}`;
  installFakeResumingCodex(fakeBin, threadId);
  process.env.DIFFSTORY_CODEX_BINARY = join(fakeBin, 'codex');
  const socketPath = join(tmpdir(), `diffstory-codex-${process.pid}-${Date.now()}.sock`);
  process.env.DIFFSTORY_CODEX_IPC_SOCKET = socketPath;
  const desktop = await fakeCodexDesktop(socketPath);

  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# hi\nraw diff change\n');
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    const comment = await (await fetch(`${base}/api/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'README.md', line: 2, type: 'question', body: 'What is happening?' }),
    })).json();
    await fetch(`${base}/api/comments/${comment.id}/message`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Are you sure?' }),
    });

    const addr = await fetch(`${base}/api/address`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        all: true, agent: 'codex', codexThreadId: threadId,
        codexTaskLabel: 'Clarify restated quote handling',
      }),
    });
    assert.equal(addr.status, 200);
    const events = ndjsonEvents(await addr.text());
    const context = events.find((event) => event.type === 'context');
    assert.equal(context?.taskMode, 'resume');
    assert.equal(context?.taskLabel, 'Clarify restated quote handling');
    assert.equal(context?.taskId, threadId);
    assert.ok(events.some((event) => event.type === 'activity' && /Sent to live ChatGPT task/.test(event.label)));
    const done = events.find((event) => event.type === 'run_done');
    assert.equal(done?.status, 'complete');
    assert.equal(done?.result?.codexThreadId, threadId);
    assert.equal(done?.result?.delivery, 'desktop');
    assert.equal(existsSync(join(repo, 'codex-args.txt')), false, 'selected tasks never fall back to codex exec resume');
    const sent = desktop.requests.find((message) => message.method === 'thread-follower-start-turn');
    assert.equal(sent?.version, 1);
    assert.equal(sent?.sourceClientId, 'diffstory-client');
    assert.equal(sent?.params?.conversationId, threadId);
    const visibleText = sent?.params?.turnStartParams?.input?.[0]?.text;
    assert.ok(visibleText.indexOf('Are you sure?') === 0, 'latest diffStory message is the visible turn text');
    assert.ok(visibleText.indexOf('Are you sure?') < visibleText.indexOf('Use the diffStory address-review skill'));
    assert.equal(visibleText.includes('What is happening?'), false, 'the visible task message uses the latest user turn');
  } finally {
    server.close();
    desktop.server.close();
    process.env.HOME = realHome;
    process.env.PATH = realPath;
    if (realCodexBinary === undefined) delete process.env.DIFFSTORY_CODEX_BINARY;
    else process.env.DIFFSTORY_CODEX_BINARY = realCodexBinary;
    if (realCodexSocket === undefined) delete process.env.DIFFSTORY_CODEX_IPC_SOCKET;
    else process.env.DIFFSTORY_CODEX_IPC_SOCKET = realCodexSocket;
    rmSync(socketPath, { force: true });
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(fakeBin, { recursive: true, force: true });
  }
});

test('POST /api/address resumes the exact selected Codex task when Desktop handoff is unavailable', async () => {
  const realHome = process.env.HOME;
  const realPath = process.env.PATH;
  const realCodexBinary = process.env.DIFFSTORY_CODEX_BINARY;
  const realCodexSocket = process.env.DIFFSTORY_CODEX_IPC_SOCKET;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  const fakeBin = mkdtempSync(join(tmpdir(), 'ds-agent-bin-'));
  const threadId = '019f5079-f420-7423-8aa8-cf9f6a079e03';
  process.env.HOME = tmpHome;
  process.env.PATH = `${fakeBin}:${realPath ?? ''}`;
  installFakeResumingCodex(fakeBin, threadId);
  process.env.DIFFSTORY_CODEX_BINARY = join(fakeBin, 'codex');
  process.env.DIFFSTORY_CODEX_IPC_SOCKET = join(tmpdir(), `missing-diffstory-codex-${process.pid}-${Date.now()}.sock`);

  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# hi\nraw diff change\n');
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    await fetch(`${base}/api/comments`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'README.md', line: 2, type: 'question', body: 'What is happening?' }),
    });

    const addr = await fetch(`${base}/api/address`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        all: true, agent: 'codex', codexThreadId: threadId,
        codexTaskLabel: 'Clarify restated quote handling',
      }),
    });
    assert.equal(addr.status, 200);
    const events = ndjsonEvents(await addr.text());
    const context = events.find((event) => event.type === 'context');
    assert.equal(context?.taskMode, 'resume');
    assert.equal(context?.taskId, threadId);
    assert.ok(events.some((event) => event.type === 'activity' && /Message added to selected Codex task/.test(event.label)));
    const done = events.find((event) => event.type === 'run_done');
    assert.equal(done?.status, 'complete');
    assert.equal(done?.result?.codexThreadId, threadId);
    assert.match(readFileSync(join(repo, 'codex-args.txt'), 'utf8'), new RegExp(`^exec\\nresume\\n--json\\n${threadId}\\n`));
  } finally {
    server.close();
    process.env.HOME = realHome;
    process.env.PATH = realPath;
    if (realCodexBinary === undefined) delete process.env.DIFFSTORY_CODEX_BINARY;
    else process.env.DIFFSTORY_CODEX_BINARY = realCodexBinary;
    if (realCodexSocket === undefined) delete process.env.DIFFSTORY_CODEX_IPC_SOCKET;
    else process.env.DIFFSTORY_CODEX_IPC_SOCKET = realCodexSocket;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(fakeBin, { recursive: true, force: true });
  }
});

test('POST /api/address rejects a selected agent that is not available', async () => {
  const realHome = process.env.HOME;
  const realPath = process.env.PATH;
  const realCodexBinary = process.env.DIFFSTORY_CODEX_BINARY;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  const fakeBin = mkdtempSync(join(tmpdir(), 'ds-agent-bin-'));
  const gitBin = dirname(execFileSync('which', ['git']).toString().trim());
  process.env.HOME = tmpHome;
  process.env.PATH = `${fakeBin}:${gitBin}:/usr/bin:/bin:/usr/sbin:/sbin`;
  process.env.DIFFSTORY_CODEX_BINARY = join(fakeBin, 'missing-codex');
  installFakeClaude(fakeBin);

  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# hi\nraw diff change\n');
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    await fetch(`${base}/api/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'README.md', line: 2, type: 'change', body: 'Please adjust this line.' }),
    });

    const addr = await fetch(`${base}/api/address`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true, agent: 'codex' }),
    });
    assert.equal(addr.status, 400);
    const body = await addr.json();
    assert.equal(body.type, 'error');
    assert.equal(body.stage, 'preflight');
    assert.match(body.label, /not available/i);
    assert.doesNotMatch(readFileSync(join(repo, 'README.md'), 'utf8'), /agent edit/);
  } finally {
    server.close();
    process.env.HOME = realHome;
    process.env.PATH = realPath;
    if (realCodexBinary === undefined) delete process.env.DIFFSTORY_CODEX_BINARY;
    else process.env.DIFFSTORY_CODEX_BINARY = realCodexBinary;
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
    rmSync(fakeBin, { recursive: true, force: true });
  }
});

test('the dead /api/diff/fullfile endpoint is gone', async () => {
  const repo = gitRepo();
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    const res = await fetch(`${base}/api/diff/fullfile?file=README.md`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});

test('/api/diff/split serves side-by-side hunks for a changed file', async () => {
  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# hi\nsplit me\n');
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    // Opening a repo alone leaves selectedStory undefined; visiting /diff (like the
    // storyless viewer flow does) is what puts the session into storyless mode.
    const page = await (await fetch(`${base}/repo/${encodeURIComponent(basename(repo))}/diff`)).text();
    const token = reviewPageToken(page);
    const res = await fetch(leased(`${base}/api/diff/split?file=README.md`, token));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /ds-diffhead/);
    assert.match(html, /ds-celldiv/);
    assert.match(html, /split me/);
    const miss = await fetch(leased(`${base}/api/diff/split?file=nope.md`, token));
    assert.match(await miss.text(), /isn't part of this change/);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});

test('/api/diff/context serves clamped context rows', async () => {
  const repo = gitRepo();
  // Commit a 40-line file, then change only the LAST line: lines 1–36ish are
  // outside the hunk, so the expandable gap consists of real *context* rows.
  const lines = Array.from({ length: 40 }, (_, i) => 'line ' + (i + 1));
  writeFileSync(join(repo, 'notes.txt'), lines.join('\n') + '\n');
  // A second committed file that then vanishes from the working tree: its diff
  // entry survives (status deleted) but readWholeFile can't serve its lines.
  writeFileSync(join(repo, 'gone.txt'), 'ghost\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'add notes'], { cwd: repo });
  writeFileSync(join(repo, 'notes.txt'), lines.slice(0, 39).join('\n') + '\nline forty\n');
  rmSync(join(repo, 'gone.txt'));
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    // Opening a repo alone leaves selectedStory undefined; visiting /diff (like the
    // storyless viewer flow does) is what puts the session into storyless mode —
    // same warm-up the /api/diff/split test above needs.
    const page = await (await fetch(`${base}/repo/${encodeURIComponent(basename(repo))}/diff`)).text();
    const token = reviewPageToken(page);
    const context = (query) => leased(`${base}/api/diff/context?${query}`, token);
    const res = await fetch(context('file=notes.txt&from=2&to=4&layout=unified'));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /^<div data-ctx-rows data-from="2" data-to="4">/);
    // The syntax highlighter tokenizes the trailing digit, so "line 3" is served
    // as 'line <span class="tk-n">3</span>' rather than a literal substring.
    assert.match(html, /line <span class="tk-n">3<\/span>/);
    const split = await fetch(context('file=notes.txt&from=2&to=3&layout=split'));
    assert.match(await split.text(), /ds-celldiv/);
    const empty = await fetch(context('file=notes.txt&from=9999&to=eof&layout=unified'));
    assert.match(await empty.text(), /data-from="0" data-to="0"/);
    // Inverted numeric range (to < from) hits the guard, not the row filter.
    const inverted = await fetch(context('file=notes.txt&from=10&to=5&layout=unified'));
    assert.match(await inverted.text(), /^<div data-ctx-rows data-from="0" data-to="0"><\/div>$/);
    // A numeric range past EOF clamps to the file's last context line — that's
    // 39 here (line 40 is the added line, not a ctx row) — instead of erroring.
    const past = await fetch(context('file=notes.txt&from=38&to=58&layout=unified'));
    assert.match(await past.text(), /^<div data-ctx-rows data-from="38" data-to="39">/);
    // A file that's in the diff but unreadable from the working tree gets the note.
    const unreadable = await fetch(context('file=gone.txt&from=1&to=5&layout=unified'));
    assert.match(await unreadable.text(), /Couldn't read gone\.txt from the working tree\./);
    const bad = await fetch(context('file=nope.md&from=1&to=2&layout=unified'));
    assert.match(await bad.text(), /isn't part of this change/);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});

test('/api/diff/context serves the story head, not the drifted working tree', async () => {
  const repo = gitRepo();
  const lines = Array.from({ length: 30 }, (_, i) => 'line ' + (i + 1));
  writeFileSync(join(repo, 'notes.txt'), lines.join('\n') + '\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'add notes'], { cwd: repo });
  const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo }).toString().trim();
  writeFileSync(join(repo, 'notes.txt'), lines.slice(0, 29).join('\n') + '\nline thirty\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'change tail'], { cwd: repo });
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo }).toString().trim();
  // Drift the working tree past the story's pinned head: line 3 becomes "drifted".
  writeFileSync(
    join(repo, 'notes.txt'),
    ['line 1', 'line 2', 'drifted'].concat(lines.slice(3, 29)).join('\n') + '\nline thirty\n',
  );
  // A minimal valid story pinned to base..head — selecting it clears session.head,
  // so the endpoint must read the file at the story's resolved head, not the tree.
  mkdirSync(join(repo, '.diffstory'), { recursive: true });
  writeFileSync(
    join(repo, '.diffstory', 'story.json'),
    JSON.stringify({
      version: 1,
      title: 'Pinned story',
      summary: '',
      base: baseSha,
      head: headSha,
      steps: [
        { id: 's1', order: 1, title: 'Tail change', file: 'notes.txt', range: [30, 30], kind: 'changed', why: 'The tail line changed.' },
      ],
    }),
  );
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    // Visiting the review route with ?story= selects the story (and clears session scope).
    const review = await fetch(`${base}/repo/${encodeURIComponent(basename(repo))}/review?story=story.json`);
    assert.equal(review.status, 200);
    const token = reviewPageToken(await review.text());
    const res = await fetch(leased(`${base}/api/diff/context?file=notes.txt&from=2&to=4&layout=unified`, token));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /^<div data-ctx-rows data-from="2" data-to="4">/);
    // Story-head content at line 3 is "line 3" (digit tokenized by the highlighter) —
    // the drifted working-tree content must NOT leak in.
    assert.match(html, /line <span class="tk-n">3<\/span>/);
    assert.doesNotMatch(html, /drifted/);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});
