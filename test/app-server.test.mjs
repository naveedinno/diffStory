// Integration test: boot the app server (no repo) and drive the repo endpoints
// over HTTP. Uses a temp HOME so recents never touch the real ~/.diffstory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
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

function addCommits(repo, count) {
  for (let i = 1; i <= count; i++) {
    writeFileSync(join(repo, 'README.md'), `# hi\n${i}\n`);
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-qm', `change ${i}`], { cwd: repo });
  }
}

async function boot() {
  const server = serve({ repo: null, port: 0, open: false });
  await once(server, 'listening');
  const { port } = server.address();
  return { server, base: `http://localhost:${port}` };
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
    const rootText = (await root.text()).toLowerCase();
    assert.ok(rootText.includes('pick a repo'));
    assert.ok(rootText.includes('open by path'));
    assert.ok(rootText.includes('skillwarn'));
    assert.ok(rootText.includes('update skills'));
    assert.ok(rootText.includes('/api/skills/update'));
    assert.ok(rootText.includes('d.route'));
    assert.ok(rootText.includes("'/repo/'+encodeuricomponent"));

    const agents = await (await fetch(`${base}/api/agents`)).json();
    assert.ok(Array.isArray(agents.agents));
    assert.equal(agents.skills.name, 'review-tour');
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
    assert.ok(existsSync(join(tmpHome, '.agents', 'skills', 'review-tour', 'SKILL.md')));
    assert.ok(existsSync(join(tmpHome, '.claude', 'skills', 'review-tour', 'SKILL.md')));
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
    await fetch(`${base}/repo/${encodeURIComponent(basename(repo))}/diff`);
    const res = await fetch(`${base}/api/diff/split?file=README.md`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /ds-diffhead/);
    assert.match(html, /ds-celldiv/);
    assert.match(html, /split me/);
    const miss = await fetch(`${base}/api/diff/split?file=nope.md`);
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
    await fetch(`${base}/repo/${encodeURIComponent(basename(repo))}/diff`);
    const res = await fetch(`${base}/api/diff/context?file=notes.txt&from=2&to=4&layout=unified`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /^<div data-ctx-rows data-from="2" data-to="4">/);
    // The syntax highlighter tokenizes the trailing digit, so "line 3" is served
    // as 'line <span class="tk-n">3</span>' rather than a literal substring.
    assert.match(html, /line <span class="tk-n">3<\/span>/);
    const split = await fetch(`${base}/api/diff/context?file=notes.txt&from=2&to=3&layout=split`);
    assert.match(await split.text(), /ds-celldiv/);
    const empty = await fetch(`${base}/api/diff/context?file=notes.txt&from=9999&to=eof&layout=unified`);
    assert.match(await empty.text(), /data-from="0" data-to="0"/);
    // Inverted numeric range (to < from) hits the guard, not the row filter.
    const inverted = await fetch(`${base}/api/diff/context?file=notes.txt&from=10&to=5&layout=unified`);
    assert.match(await inverted.text(), /^<div data-ctx-rows data-from="0" data-to="0"><\/div>$/);
    // A numeric range past EOF clamps to the file's last context line — that's
    // 39 here (line 40 is the added line, not a ctx row) — instead of erroring.
    const past = await fetch(`${base}/api/diff/context?file=notes.txt&from=38&to=58&layout=unified`);
    assert.match(await past.text(), /^<div data-ctx-rows data-from="38" data-to="39">/);
    // A file that's in the diff but unreadable from the working tree gets the note.
    const unreadable = await fetch(`${base}/api/diff/context?file=gone.txt&from=1&to=5&layout=unified`);
    assert.match(await unreadable.text(), /Couldn't read gone\.txt from the working tree\./);
    const bad = await fetch(`${base}/api/diff/context?file=nope.md&from=1&to=2&layout=unified`);
    assert.match(await bad.text(), /isn't part of this change/);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});
