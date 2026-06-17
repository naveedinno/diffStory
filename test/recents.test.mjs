// Unit tests for the global recents store. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addRecent, loadRecents, recordRecent } from '../dist/recents.js';

test('addRecent moves an existing path to the front and dedupes', () => {
  const list = [
    { path: '/a', lastOpened: 1 },
    { path: '/b', lastOpened: 2 },
  ];
  const next = addRecent(list, '/a', 9);
  assert.deepEqual(next, [
    { path: '/a', lastOpened: 9 },
    { path: '/b', lastOpened: 2 },
  ]);
});

test('addRecent caps the list length, newest first', () => {
  let list = [];
  for (let i = 1; i <= 15; i++) list = addRecent(list, `/r${i}`, i, 12);
  assert.equal(list.length, 12);
  assert.equal(list[0].path, '/r15');
  assert.equal(list[11].path, '/r4');
});

test('loadRecents returns [] for a missing or corrupt file', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-rec-'));
  try {
    assert.deepEqual(loadRecents(home), []);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('recordRecent round-trips through a temp home', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-rec-'));
  try {
    recordRecent(home, '/x', 5);
    recordRecent(home, '/y', 6);
    const list = loadRecents(home);
    assert.equal(list[0].path, '/y');
    assert.equal(list[1].path, '/x');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
