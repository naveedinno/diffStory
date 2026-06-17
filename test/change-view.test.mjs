// Unit tests for summarizeChange (the "Your change" data). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { summarizeChange } from '../dist/change-view.js';

function repo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-chg-'));
  const g = (args) => execFileSync('git', args, { cwd: d });
  g(['init', '-q']);
  g(['config', 'user.email', 't@e.st']);
  g(['config', 'user.name', 'T']);
  writeFileSync(join(d, 'a.txt'), 'one\n');
  g(['add', '.']);
  g(['commit', '-qm', 'init']);
  return d;
}

test('summarizeChange lists changed files with line counts', () => {
  const d = repo();
  writeFileSync(join(d, 'a.txt'), 'one\ntwo\n'); // uncommitted: +1 line
  try {
    const s = summarizeChange(d);
    assert.equal(s.hasChanges, true);
    assert.equal(s.totalChanged, 1);
    assert.equal(s.files[0].path, 'a.txt');
    assert.equal(s.files[0].added, 1);
    assert.equal(s.files[0].removed, 0);
    assert.equal(typeof s.baseLabel, 'string');
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

test('summarizeChange reports no changes for a clean tree', () => {
  const d = repo();
  try {
    assert.equal(summarizeChange(d).hasChanges, false);
    assert.equal(summarizeChange(d).totalChanged, 0);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});
