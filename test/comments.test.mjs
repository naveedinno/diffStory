// Unit tests for the comment store. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addComment, appendUserMessage, loadComments } from '../dist/comments.js';

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

test('addComment persists which diff side was selected', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, {
      step: 's1',
      file: 'a.ts',
      line: 4,
      side: 'left',
      type: 'question',
      body: 'is the old branch still needed?',
      selectedText: 'oldBranch()',
      selection: { startLine: 4, endLine: 4 },
    });
    assert.equal(c.side, 'left');
    assert.equal(loadComments(repo)[0].side, 'left');
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

test('loadComments migrates a legacy reply into one ai turn', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { file: 'a.ts', line: 1, type: 'question', body: 'why?' });
    // Simulate an old comments.json written by a pre-turns agent: a bare reply.
    const raw = loadComments(repo);
    raw[0].reply = 'because X';
    delete raw[0].turns;
    writeFileSync(join(repo, '.diffstory', 'comments.json'), JSON.stringify(raw) + '\n');
    const [loaded] = loadComments(repo);
    assert.deepEqual(loaded.turns, [{ role: 'ai', text: 'because X', at: loaded.createdAt }]);
    assert.equal(loaded.id, c.id);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('appendUserMessage adds a user turn and reopens the thread', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { file: 'a.ts', line: 1, type: 'question', body: 'first?' });
    // Mark it addressed with an ai turn, as if the agent already answered.
    const raw = loadComments(repo);
    raw[0].status = 'addressed';
    raw[0].turns = [{ role: 'ai', text: 'answer', at: '2026-01-01T00:00:00Z' }];
    writeFileSync(join(repo, '.diffstory', 'comments.json'), JSON.stringify(raw) + '\n');

    const updated = appendUserMessage(repo, c.id, '  follow-up question  ');
    assert.equal(updated.status, 'open');
    assert.equal(updated.turns.length, 2);
    assert.equal(updated.turns[1].role, 'user');
    assert.equal(updated.turns[1].text, 'follow-up question');
    assert.ok(updated.turns[1].at);
    assert.deepEqual(loadComments(repo)[0].turns, updated.turns);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('appendUserMessage rejects empty text and unknown ids', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { file: 'a.ts', line: 1, type: 'change', body: 'x' });
    assert.throws(() => appendUserMessage(repo, c.id, '   '), /text/);
    assert.equal(appendUserMessage(repo, 'nope', 'hi'), null);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
