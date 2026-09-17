// Unit tests for blameReviewLine: the commit behind one line of the diff. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { blameReviewLine } from '../dist/git.js';

function repo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-blame-'));
  const g = (a) => execFileSync('git', a, { cwd: d }).toString().trim();
  g(['init', '-q', '-b', 'main']); g(['config', 'user.email', 't@e.st']); g(['config', 'user.name', 'Tess']);
  writeFileSync(join(d, 'a.sol'), 'one\ntwo\nthree\n'); g(['add', '.']); g(['commit', '-qm', 'base: seed']);
  const base = g(['rev-parse', 'HEAD']);
  writeFileSync(join(d, 'a.sol'), 'one\ntwo\nthree\nfour\n'); g(['add', '.']); g(['commit', '-qm', 'add four']);
  const addFour = g(['rev-parse', 'HEAD']);
  writeFileSync(join(d, 'a.sol'), 'one\nthree\nfour\n'); g(['add', '.']); g(['commit', '-qm', 'drop two']);
  const dropTwo = g(['rev-parse', 'HEAD']);
  writeFileSync(join(d, 'a.sol'), 'one\nthree\nfour\nfive\n'); g(['add', '.']); g(['commit', '-qm', 'add five']);
  const head = g(['rev-parse', 'HEAD']);
  return { d, g, base, addFour, dropTwo, head };
}

test('an after-side line blames to the commit in the review that wrote it', () => {
  const { d, base, addFour, head } = repo();
  try {
    const r = blameReviewLine(d, { base, head, side: 'right', file: 'a.sol', line: 3 });
    assert.equal(r.kind, 'line');
    assert.equal(r.commit.sha, addFour);
    assert.equal(r.commit.subject, 'add four');
    assert.equal(r.commit.author, 'Tess');
    assert.equal(r.inRange, true);
    const old = blameReviewLine(d, { base, head, side: 'right', file: 'a.sol', line: 1 });
    assert.equal(old.commit.sha, base);
    assert.equal(old.inRange, false, 'a context line older than the review is not part of it');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('a before-side line names the commit that removed it and where it came from', () => {
  const { d, base, dropTwo, head } = repo();
  try {
    const r = blameReviewLine(d, { base, head, side: 'left', file: 'a.sol', line: 2 });
    assert.equal(r.kind, 'removed');
    assert.equal(r.removedBy.sha, dropTwo);
    assert.equal(r.origin.sha, base);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('working-tree reviews report uncommitted additions and removals', () => {
  const { d, g, base } = repo();
  try {
    writeFileSync(join(d, 'a.sol'), 'three\nfour\nfive\nsix\n');
    const added = blameReviewLine(d, { base, side: 'right', file: 'a.sol', line: 4 });
    assert.equal(added.kind, 'uncommitted');
    const removed = blameReviewLine(d, { base, side: 'left', file: 'a.sol', line: 1 });
    assert.equal(removed.kind, 'removed');
    assert.equal(removed.removedBy, 'uncommitted');
    g(['checkout', '--', 'a.sol']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('unsafe input gets no blame', () => {
  const { d, base, head } = repo();
  try {
    assert.equal(blameReviewLine(d, { base, head, side: 'right', file: '../etc/passwd', line: 1 }), null);
    assert.equal(blameReviewLine(d, { base: '--output=x', head, side: 'right', file: 'a.sol', line: 1 }), null);
    assert.equal(blameReviewLine(d, { base, head, side: 'right', file: 'a.sol', line: 0 }), null);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('a before-side line that moved names the commit that moved it', () => {
  const d = mkdtempSync(join(tmpdir(), 'ds-blame-move-'));
  const g = (a) => execFileSync('git', a, { cwd: d }).toString().trim();
  try {
    g(['init', '-q', '-b', 'main']); g(['config', 'user.email', 't@e.st']); g(['config', 'user.name', 'T']);
    writeFileSync(join(d, 'a.sol'), 'fee = 1;\nquote.closedAmount += filledAmount;\nsubtract(quote);\ndone();\n'); g(['add', '.']); g(['commit', '-qm', 'seed']);
    const base = g(['rev-parse', 'HEAD']);
    writeFileSync(join(d, 'a.sol'), 'fee = 1;\nsubtract(quote);\nquote.closedAmount += filledAmount;\ndone();\n'); g(['add', '.']); g(['commit', '-qm', 'reorder close']);
    const mover = g(['rev-parse', 'HEAD']);
    const r = blameReviewLine(d, { base, head: mover, side: 'left', file: 'a.sol', line: 2 });
    assert.equal(r.kind, 'removed');
    assert.equal(r.removedBy.sha, mover);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
