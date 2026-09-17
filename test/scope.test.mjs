// Unit tests for resolveScope (the "what I just did" default + presets). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveScope } from '../dist/scope.js';

function repo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-scope-'));
  const g = (a) => execFileSync('git', a, { cwd: d });
  g(['init', '-q']); g(['config', 'user.email', 't@e.st']); g(['config', 'user.name', 'T']);
  writeFileSync(join(d, 'a.txt'), 'one\n'); g(['add', '.']); g(['commit', '-qm', 'c1']);
  writeFileSync(join(d, 'a.txt'), 'one\ntwo\n'); g(['add', '.']); g(['commit', '-qm', 'c2']);
  return d;
}
const Q = (s) => new URLSearchParams(s);

test('auto: dirty tree → uncommitted changes', () => {
  const d = repo();
  writeFileSync(join(d, 'a.txt'), 'one\ntwo\nthree\n'); // now uncommitted
  try {
    const s = resolveScope(d, Q(''));
    assert.equal(s.active, 'uncommitted');
    assert.equal(s.base, 'HEAD');
    assert.equal(s.head, undefined);
    assert.equal(s.label, 'Uncommitted changes');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('auto: clean tree → latest commit', () => {
  const d = repo();
  try {
    const s = resolveScope(d, Q(''));
    assert.equal(s.active, 'commit');
    assert.equal(s.base, 'HEAD^');
    assert.equal(s.head, 'HEAD');
    assert.equal(s.label, 'Latest commit');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('explicit presets and compare refs override the default', () => {
  const d = repo();
  try {
    assert.equal(resolveScope(d, Q('scope=uncommitted')).active, 'uncommitted');
    const r = resolveScope(d, Q('base=HEAD~1&head=HEAD'));
    assert.equal(r.active, 'compare');
    assert.equal(r.base, 'HEAD~1');
    assert.equal(r.head, 'HEAD');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('single commit scope compares the selected commit with its first parent', () => {
  const d = repo();
  try {
    const s = resolveScope(d, Q('scope=commit&commit=HEAD'));
    assert.equal(s.active, 'commit');
    assert.equal(s.base, 'HEAD^');
    assert.equal(s.head, 'HEAD');
    assert.match(s.label, /Latest commit|Commit/);

    const legacy = resolveScope(d, Q('scope=last'));
    assert.equal(legacy.active, 'commit');
    assert.equal(legacy.base, 'HEAD^');
    assert.equal(legacy.head, 'HEAD');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('single commit scope uses the empty tree for a root commit', () => {
  const d = mkdtempSync(join(tmpdir(), 'ds-scope-root-'));
  const g = (a) => execFileSync('git', a, { cwd: d });
  g(['init', '-q']); g(['config', 'user.email', 't@e.st']); g(['config', 'user.name', 'T']);
  writeFileSync(join(d, 'a.txt'), 'root\n'); g(['add', '.']); g(['commit', '-qm', 'root']);
  try {
    const s = resolveScope(d, Q('scope=commit&commit=HEAD'));
    assert.equal(s.active, 'commit');
    assert.notEqual(s.base, 'HEAD^');
    assert.match(s.base, /^[0-9a-f]{40}$/);
    assert.equal(s.head, 'HEAD');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

function branchedRepo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-scope-branch-'));
  const g = (a) => execFileSync('git', a, { cwd: d }).toString().trim();
  g(['init', '-q', '-b', 'main']); g(['config', 'user.email', 't@e.st']); g(['config', 'user.name', 'T']);
  writeFileSync(join(d, 'a.txt'), 'one\n'); g(['add', '.']); g(['commit', '-qm', 'c1']);
  const fork = g(['rev-parse', 'HEAD']);
  g(['checkout', '-qb', 'develop']);
  writeFileSync(join(d, 'd.txt'), 'dev\n'); g(['add', '.']); g(['commit', '-qm', 'd1']);
  const devFork = g(['rev-parse', 'HEAD']);
  g(['checkout', '-qb', 'feature/x']);
  writeFileSync(join(d, 'b.txt'), 'b\n'); g(['add', '.']); g(['commit', '-qm', 'f1']);
  writeFileSync(join(d, 'b.txt'), 'b\nc\n'); g(['add', '.']); g(['commit', '-qm', 'f2']);
  // main moves on after the fork; the branch scope must not pick that up.
  g(['checkout', '-q', 'main']);
  writeFileSync(join(d, 'a.txt'), 'one\nmain\n'); g(['add', '.']); g(['commit', '-qm', 'm2']);
  g(['checkout', '-q', 'feature/x']);
  return { d, fork, devFork };
}

test('branch scope diffs the current branch from its nearest fork point', () => {
  const { d, devFork } = branchedRepo();
  try {
    const s = resolveScope(d, Q('scope=branch'));
    assert.equal(s.active, 'branch');
    assert.equal(s.branch, 'feature/x');
    assert.equal(s.base, devFork, 'develop is nearer than main');
    assert.equal(s.head, 'feature/x');
    assert.equal(s.from, undefined);
    assert.match(s.label, /^feature\/x since develop \([0-9a-f]{7}\) · 2 commits$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('branch scope honours an explicit parent and a named branch', () => {
  const { d, fork } = branchedRepo();
  try {
    const s = resolveScope(d, Q('scope=branch&branch=develop&from=main'));
    assert.equal(s.branch, 'develop');
    assert.equal(s.from, 'main');
    assert.equal(s.base, fork);
    assert.equal(s.head, 'develop');
    assert.match(s.label, /· 1 commit$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('branch scope is honestly empty on the default branch itself', () => {
  const { d } = branchedRepo();
  try {
    const s = resolveScope(d, Q('scope=branch&branch=main'));
    assert.equal(s.active, 'branch');
    assert.equal(s.base, 'main');
    assert.equal(s.head, 'main');
    assert.match(s.label, /no fork point/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('branch scope says a fully merged branch is already in its parent', () => {
  const { d } = branchedRepo();
  const g = (a) => execFileSync('git', a, { cwd: d });
  try {
    for (const trunk of ['develop', 'main']) { g(['checkout', '-q', trunk]); g(['merge', '-q', '--no-edit', 'feature/x']); }
    const s = resolveScope(d, Q('scope=branch&branch=feature/x'));
    assert.equal(s.active, 'branch');
    assert.match(s.label, /^feature\/x is already in main$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('branch scope finds a release-line parent the default branches split from long ago', () => {
  const { d } = branchedRepo();
  const g = (a) => execFileSync('git', a, { cwd: d }).toString().trim();
  try {
    // release/1 splits from develop, gains work, and feature/y is cut from it.
    g(['checkout', '-qb', 'release/1', 'develop']);
    writeFileSync(join(d, 'r.txt'), 'r1\n'); g(['add', '.']); g(['commit', '-qm', 'r1']);
    writeFileSync(join(d, 'r.txt'), 'r1\nr2\n'); g(['add', '.']); g(['commit', '-qm', 'r2']);
    const releaseFork = g(['rev-parse', 'HEAD']);
    g(['checkout', '-qb', 'feature/y']);
    writeFileSync(join(d, 'y.txt'), 'y\n'); g(['add', '.']); g(['commit', '-qm', 'y1']);
    // The release line keeps moving after the cut.
    g(['checkout', '-q', 'release/1']);
    writeFileSync(join(d, 'r.txt'), 'r1\nr2\nr3\n'); g(['add', '.']); g(['commit', '-qm', 'r3']);
    const s = resolveScope(d, Q('scope=branch&branch=feature/y'));
    assert.equal(s.base, releaseFork);
    assert.match(s.label, /^feature\/y since release\/1 \([0-9a-f]{7}\) · 1 commit$/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
