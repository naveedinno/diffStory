// Unit tests for the comment store. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addComment, loadComments } from '../dist/comments.js';

function tmpRepo() { return mkdtempSync(join(tmpdir(), 'cmt-')); }

test('addComment persists a comment with no step (All-files annotation)', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { file: 'a.ts', line: 12, type: 'change', body: 'hi' });
    assert.equal(c.file, 'a.ts');
    assert.equal(c.line, 12);
    assert.equal(c.status, 'open');
    assert.ok(!('step' in c), 'step should be absent when not provided');
    const all = loadComments(repo);
    assert.equal(all.length, 1);
    assert.ok(!('step' in all[0]));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('addComment keeps step when provided (Story annotation)', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { step: 's1', file: 'a.ts', line: 3, type: 'nit', body: 'x' });
    assert.equal(c.step, 's1');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('addComment persists selected text and selected line range', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, {
      step: 's1',
      file: 'a.ts',
      line: 7,
      type: 'question',
      body: 'why this branch?',
      selectedText: 'if (needsRetry) {',
      selection: { startLine: 7, endLine: 8, startColumn: 5, endColumn: 18 },
    });
    assert.equal(c.selectedText, 'if (needsRetry) {');
    assert.deepEqual(c.selection, { startLine: 7, endLine: 8, startColumn: 5, endColumn: 18 });
    assert.deepEqual(loadComments(repo)[0].selection, c.selection);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('addComment ignores an empty step string', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { step: '', file: 'a.ts', line: 1, type: 'change', body: 'x' });
    assert.ok(!('step' in c));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('addComment still requires file and a non-empty body', () => {
  const repo = tmpRepo();
  try {
    assert.throws(() => addComment(repo, { file: '', line: 1, type: 'change', body: 'x' }), /file/);
    assert.throws(() => addComment(repo, { file: 'a.ts', line: 1, type: 'change', body: '  ' }), /body/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
