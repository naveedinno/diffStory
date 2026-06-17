// Unit tests for inspectRepo (the per-repo summary the picker shows). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectRepo } from '../dist/repo-state.js';

function gitRepo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-state-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  execFileSync('git', ['config', 'user.email', 't@e.st'], { cwd: d });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: d });
  writeFileSync(join(d, 'README.md'), '# hi\n');
  execFileSync('git', ['add', '.'], { cwd: d });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: d });
  return d;
}

test('inspectRepo reports a non-git directory', () => {
  const d = mkdtempSync(join(tmpdir(), 'ds-state-'));
  try {
    const s = inspectRepo(d);
    assert.equal(s.isGit, false);
    assert.equal(s.hasTour, false);
    assert.equal(s.name, basename(d));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('inspectRepo detects a git repo and a present tour', () => {
  const d = gitRepo();
  try {
    let s = inspectRepo(d);
    assert.equal(s.isGit, true);
    assert.equal(s.hasTour, false);
    assert.equal(typeof s.changedFiles, 'number');

    mkdirSync(join(d, '.diffstory'), { recursive: true });
    writeFileSync(join(d, '.diffstory', 'story.json'), '{}');
    s = inspectRepo(d);
    assert.equal(s.hasTour, true);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
