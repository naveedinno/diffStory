// Unit tests for repo setup (gitignore modes + skills check). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setGitignore, skillsInstalled } from '../dist/repo-setup.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'ds-rs-'));

test('local mode ignores the whole .diffstory dir', () => {
  const d = tmp();
  setGitignore(d, 'local');
  const gi = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.ok(gi.includes('.diffstory/'));
  assert.ok(!gi.includes('.diffstory/comments.json'));
  rmSync(d, { recursive: true, force: true });
});

test('shared mode ignores only comments.json', () => {
  const d = tmp();
  setGitignore(d, 'shared');
  const gi = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.ok(gi.includes('.diffstory/comments.json'));
  assert.ok(!/^\.diffstory\/$/m.test(gi));
  rmSync(d, { recursive: true, force: true });
});

test('switching modes leaves exactly one diffstory line', () => {
  const d = tmp();
  writeFileSync(join(d, '.gitignore'), 'node_modules/\n');
  setGitignore(d, 'local');
  setGitignore(d, 'shared');
  setGitignore(d, 'shared');
  const gi = readFileSync(join(d, '.gitignore'), 'utf8');
  assert.equal((gi.match(/\.diffstory/g) || []).length, 1);
  assert.ok(gi.includes('node_modules/'));
  rmSync(d, { recursive: true, force: true });
});

test('skillsInstalled detects ~/.agents/skills/review-tour', () => {
  const home = tmp();
  assert.equal(skillsInstalled(home), false);
  mkdirSync(join(home, '.agents', 'skills', 'review-tour'), { recursive: true });
  writeFileSync(join(home, '.agents', 'skills', 'review-tour', 'SKILL.md'), '');
  assert.equal(skillsInstalled(home), true);
  rmSync(home, { recursive: true, force: true });
});
