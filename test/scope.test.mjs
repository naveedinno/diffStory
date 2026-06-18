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
    assert.equal(s.active, 'last');
    assert.equal(s.base, 'HEAD~1');
    assert.equal(s.head, 'HEAD');
    assert.equal(s.label, 'Latest commit');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('explicit presets and a compare-ref override the default', () => {
  const d = repo();
  try {
    assert.equal(resolveScope(d, Q('scope=uncommitted')).active, 'uncommitted');
    assert.equal(resolveScope(d, Q('scope=branch')).active, 'branch');
    const r = resolveScope(d, Q('base=HEAD~1'));
    assert.equal(r.active, 'ref');
    assert.equal(r.base, 'HEAD~1');
  } finally { rmSync(d, { recursive: true, force: true }); }
});
