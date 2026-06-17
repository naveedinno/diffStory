// Unit tests for the server-side directory browser. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listDirs } from '../dist/fs-browse.js';

test('listDirs lists subdirectories sorted, flags git repos, hides dotdirs and files', () => {
  const root = mkdtempSync(join(tmpdir(), 'ds-fs-'));
  mkdirSync(join(root, 'beta'));
  mkdirSync(join(root, 'alpha'));
  mkdirSync(join(root, 'beta', '.git'), { recursive: true });
  mkdirSync(join(root, '.hidden'));
  writeFileSync(join(root, 'a-file.txt'), 'x');
  try {
    const l = listDirs(root);
    assert.deepEqual(l.entries.map((e) => e.name), ['alpha', 'beta']);
    assert.equal(l.entries.find((e) => e.name === 'beta').isGit, true);
    assert.equal(l.entries.find((e) => e.name === 'alpha').isGit, false);
    assert.equal(l.parent !== null, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('listDirs reports whether the folder itself is a git repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'ds-fs-'));
  mkdirSync(join(root, '.git'));
  try {
    assert.equal(listDirs(root).isGit, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('listDirs tolerates a nonexistent or unreadable path', () => {
  const l = listDirs('/no/such/path/hopefully/xyz123');
  assert.deepEqual(l.entries, []);
  assert.equal(typeof l.path, 'string');
});
