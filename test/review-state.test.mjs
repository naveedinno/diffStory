import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseUnifiedDiff } from '../dist/diff.js';
import { getDiff } from '../dist/git.js';
import {
  captureReviewSnapshot,
  diffSinceReview,
  reviewStateSummary,
} from '../dist/review-state.js';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'ds-rounds-'));
  const git = (args) => execFileSync('git', args, { cwd: dir });
  git(['init', '-q']);
  git(['config', 'user.email', 't@e.st']);
  git(['config', 'user.name', 'T']);
  writeFileSync(join(dir, 'a.ts'), 'export const value = 1;\n');
  git(['add', '.']);
  git(['commit', '-qm', 'init']);
  return { dir, git };
}

function current(dir) {
  const diff = getDiff(dir, 'HEAD');
  return { diff, files: parseUnifiedDiff(diff) };
}

test('feedback checkpoints create a versioned comparison and agent round', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const first = current(dir);
    captureReviewSnapshot(dir, { base: 'HEAD', ...first, reason: 'opened' });
    const feedback = captureReviewSnapshot(dir, {
      base: 'HEAD',
      ...first,
      reason: 'feedback-sent',
      commentIds: ['c1'],
    });

    writeFileSync(join(dir, 'a.ts'), 'export const value = 3;\n');
    writeFileSync(join(dir, 'b.ts'), 'export const added = true;\n');
    const second = current(dir);
    const completed = captureReviewSnapshot(dir, { base: 'HEAD', ...second, reason: 'agent-complete' });
    const summary = reviewStateSummary(dir, 'HEAD', undefined, second.diff, second.files);

    assert.equal(feedback.round, 1);
    assert.equal(completed.round, 2);
    assert.equal(summary.round, 2);
    assert.deepEqual(summary.changedFiles, ['a.ts', 'b.ts']);
    assert.equal(summary.compareFrom.id, feedback.id);
    assert.match(diffSinceReview(dir, 'HEAD', undefined, second.files, feedback.id), /export const value = 3/);
    assert.match(diffSinceReview(dir, 'HEAD', undefined, second.files, feedback.id), /b\/b\.ts/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('opening an unchanged review does not create duplicate snapshots', () => {
  const { dir } = repo();
  try {
    writeFileSync(join(dir, 'a.ts'), 'export const value = 2;\n');
    const state = current(dir);
    const one = captureReviewSnapshot(dir, { base: 'HEAD', ...state, reason: 'opened' });
    const two = captureReviewSnapshot(dir, { base: 'HEAD', ...state, reason: 'opened' });
    assert.equal(one.id, two.id);
    const stored = JSON.parse(readFileSync(join(dir, '.diffstory', 'review-state.json'), 'utf8'));
    assert.equal(Object.values(stored.scopes)[0].snapshots.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
