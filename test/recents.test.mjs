// Unit tests for the global recents store. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addRecent,
  forgetRecent,
  loadRecents,
  recordRecent,
  removeRecent,
  restoreRecent,
  restoreRecentAt,
} from '../dist/recents.js';

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

test('addRecent stores and preserves the last repository snapshot', () => {
  const snapshot = {
    path: '/a',
    name: 'a',
    isGit: true,
    hasTour: true,
    currentBranch: 'feature/home',
    changedFiles: 4,
  };
  const recorded = addRecent([], '/a', 5, 12, snapshot);
  assert.deepEqual(recorded, [{ ...snapshot, lastOpened: 5 }]);
  assert.deepEqual(addRecent(recorded, '/a', 9), [{ ...snapshot, lastOpened: 9 }]);
});

test('loadRecents returns [] for a missing or corrupt file', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-rec-'));
  try {
    assert.deepEqual(loadRecents(home), []);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('removeRecent drops only the matching path', () => {
  const list = [
    { path: '/a', lastOpened: 1 },
    { path: '/b', lastOpened: 2 },
    { path: '/c', lastOpened: 3 },
  ];
  assert.deepEqual(removeRecent(list, '/b'), [
    { path: '/a', lastOpened: 1 },
    { path: '/c', lastOpened: 3 },
  ]);
  assert.deepEqual(removeRecent(list, '/missing'), list);
});

test('restoreRecentAt returns a removed entry to its former position without duplicates', () => {
  const restored = { path: '/b', name: 'b', lastOpened: 2 };
  assert.deepEqual(
    restoreRecentAt(
      [
        { path: '/a', lastOpened: 3 },
        { path: '/c', lastOpened: 1 },
        { path: '/b', lastOpened: 99 },
      ],
      restored,
      1,
    ),
    [
      { path: '/a', lastOpened: 3 },
      restored,
      { path: '/c', lastOpened: 1 },
    ],
  );
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

test('forgetRecent persists a removed repository', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-rec-'));
  try {
    recordRecent(home, '/x', 5);
    recordRecent(home, '/y', 6);

    const next = forgetRecent(home, '/x');

    assert.deepEqual(next, [{ path: '/y', lastOpened: 6 }]);
    assert.deepEqual(loadRecents(home), [{ path: '/y', lastOpened: 6 }]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('restoreRecent persists the original entry and position', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-rec-'));
  try {
    recordRecent(home, '/x', 5);
    recordRecent(home, '/y', 6);
    forgetRecent(home, '/y');

    const next = restoreRecent(home, { path: '/y', name: 'y', lastOpened: 6 }, 0);

    assert.deepEqual(next, [
      { path: '/y', name: 'y', lastOpened: 6 },
      { path: '/x', lastOpened: 5 },
    ]);
    assert.deepEqual(loadRecents(home), next);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
