import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const { EMPTY_TREE_REF, changedFiles, excludedReviewFiles, latestCommitComparison, resolveReviewRevision, reviewChangeFingerprint, reviewDiff, stagedWorktreeDivergentFiles } = await import('../dist/git.js');

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

test('bounded diffs expose exclusions while full fingerprints retain their bytes', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-git-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  await writeFile(path.join(root, 'src.ts'), 'export const value = 1;\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'base']);
  await writeFile(path.join(root, 'src.ts'), 'export const value = 2;\n');
  await writeFile(path.join(root, 'package-lock.json'), '{"lockfileVersion": 3}\n');
  const repo = { fsPath: root };

  const files = await changedFiles(repo, 'HEAD');
  assert.equal(files.find((file) => file.path === 'package-lock.json').exclusion.reason, 'generated-path');
  assert.deepEqual((await excludedReviewFiles(repo, 'HEAD')).map((file) => file.path), ['package-lock.json']);
  assert.doesNotMatch(await reviewDiff(repo, 'HEAD'), /package-lock\.json/);
  const first = await reviewChangeFingerprint(repo, 'HEAD');
  await writeFile(path.join(root, 'package-lock.json'), '{"lockfileVersion": 3, "packages": {}}\n');
  assert.notEqual(await reviewChangeFingerprint(repo, 'HEAD'), first);

  git(root, ['add', 'src.ts']);
  await writeFile(path.join(root, 'src.ts'), 'export const value = 3;\n');
  assert.deepEqual(await stagedWorktreeDivergentFiles(repo, 'HEAD'), ['src.ts']);
});

test('a staged change remains reviewable when the worktree restores the base', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-git-staged-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  await writeFile(path.join(root, 'src.ts'), 'export const value = 1;\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'base']);
  await writeFile(path.join(root, 'src.ts'), 'export const staged = 2;\n');
  git(root, ['add', 'src.ts']);
  await writeFile(path.join(root, 'src.ts'), 'export const value = 1;\n');
  const repo = { fsPath: root };

  assert.deepEqual((await changedFiles(repo, 'HEAD')).map((file) => [file.status, file.path]), [['M', 'src.ts']]);
  assert.match(await reviewDiff(repo, 'HEAD'), /export const staged = 2/);
  assert.deepEqual(await stagedWorktreeDivergentFiles(repo, 'HEAD'), ['src.ts']);
});

test('an ignored file restored after a staged deletion remains an explicit conflict', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-git-delete-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  await writeFile(path.join(root, '.gitignore'), 'seed.txt\n');
  await writeFile(path.join(root, 'seed.txt'), 'tracked value\n');
  git(root, ['add', '.gitignore']);
  git(root, ['add', '-f', 'seed.txt']);
  git(root, ['commit', '-qm', 'base']);
  git(root, ['rm', '--cached', '-q', 'seed.txt']);
  const repo = { fsPath: root };

  assert.deepEqual(await stagedWorktreeDivergentFiles(repo, 'HEAD'), ['seed.txt']);
  assert.deepEqual((await changedFiles(repo, 'HEAD')).map((file) => [file.status, file.path]), [['D', 'seed.txt']]);
  assert.equal((await reviewDiff(repo, 'HEAD')).match(/diff --git/g)?.length, 1);
});

test('comparison setup validates revisions and handles an initial commit', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'diffstory-git-comparison-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test']);
  await writeFile(path.join(root, 'src.ts'), 'export const value = 1;\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'initial']);
  const repo = { fsPath: root };

  assert.ok(await resolveReviewRevision(repo, 'HEAD'));
  assert.equal(await resolveReviewRevision(repo, 'missing-ref'), undefined);
  assert.deepEqual(await latestCommitComparison(repo), { base: EMPTY_TREE_REF, head: 'HEAD' });

  await writeFile(path.join(root, 'src.ts'), 'export const value = 2;\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'second']);
  assert.deepEqual(await latestCommitComparison(repo), { base: 'HEAD^', head: 'HEAD' });
});
