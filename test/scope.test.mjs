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
