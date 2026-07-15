import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const { InvalidCommentStoreError, loadCommentsWithHealth, saveComments, setCommentStatus } = await import('../dist/comments.js');

test('invalid feedback fails closed and is never overwritten', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-comments-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, '.diffstory'));
  const file = path.join(root, '.diffstory', 'comments.json');
  await writeFile(file, '{ broken json', 'utf8');
  const repo = { fsPath: root };
  const loaded = await loadCommentsWithHealth(repo);
  assert.equal(loaded.health.status, 'invalid');
  await assert.rejects(() => setCommentStatus(repo, 'missing', 'resolved'), InvalidCommentStoreError);
  assert.equal(await readFile(file, 'utf8'), '{ broken json');
});

test('comment writes reject stale source evidence', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-comments-race-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = { fsPath: root };
  const first = await loadCommentsWithHealth(repo);
  await saveComments(repo, [{
    id: 'newer', file: 'src/a.ts', line: 1, type: 'nit', severity: 'nit', body: 'Newer write',
    status: 'open', createdAt: '2026-07-15T10:00:00.000Z',
  }], first.sourceDigest);
  await assert.rejects(
    () => saveComments(repo, [], first.sourceDigest),
    /changed while this action was being saved/i,
  );
});
