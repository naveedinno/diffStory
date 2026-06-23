// Unit tests for repo setup (gitignore modes + skills check). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setGitignore, skillsInstalled, skillStatus, updateSkills } from '../dist/repo-setup.js';

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

test('skillStatus reports a missing review-tour skill', () => {
  const home = tmp();
  const bundled = join(home, 'bundle', 'review-tour', 'SKILL.md');
  mkdirSync(join(home, 'bundle', 'review-tour'), { recursive: true });
  writeFileSync(bundled, 'current skill');

  const status = skillStatus(home, bundled);
  assert.equal(status.installed, false);
  assert.equal(status.current, false);
  assert.equal(status.candidates.length, 3);
  assert.ok(status.message.includes('not installed'));

  rmSync(home, { recursive: true, force: true });
});

test('skillStatus detects Codex installs and stale skill content', () => {
  const home = tmp();
  const bundled = join(home, 'bundle', 'review-tour', 'SKILL.md');
  const installed = join(home, '.codex', 'skills', 'review-tour', 'SKILL.md');
  mkdirSync(join(home, 'bundle', 'review-tour'), { recursive: true });
  mkdirSync(join(home, '.codex', 'skills', 'review-tour'), { recursive: true });
  writeFileSync(bundled, 'current skill');
  writeFileSync(installed, 'old skill');

  const stale = skillStatus(home, bundled);
  assert.equal(stale.installed, true);
  assert.equal(stale.current, false);
  assert.equal(stale.matches.length, 1);
  assert.equal(stale.matches[0].path, installed);
  assert.equal(stale.matches[0].current, false);
  assert.ok(stale.message.includes('out of date'));

  writeFileSync(installed, 'current skill');
  const current = skillStatus(home, bundled);
  assert.equal(current.installed, true);
  assert.equal(current.current, true);
  assert.equal(current.message, 'review-tour skill is installed and up to date.');

  rmSync(home, { recursive: true, force: true });
});

test('updateSkills installs bundled skills into agent and Codex skill dirs', () => {
  const home = tmp();
  const bundle = join(home, 'bundle', 'skills');
  for (const name of ['review-tour', 'address-review']) {
    mkdirSync(join(bundle, name), { recursive: true });
    writeFileSync(join(bundle, name, 'SKILL.md'), `${name} current`);
  }

  const result = updateSkills(home, bundle);

  assert.deepEqual(result.installed.map((p) => p.replace(home, '<home>')).sort(), [
    '<home>/.agents/skills/address-review',
    '<home>/.agents/skills/review-tour',
    '<home>/.codex/skills/address-review',
    '<home>/.codex/skills/review-tour',
  ]);
  assert.equal(readFileSync(join(home, '.agents', 'skills', 'review-tour', 'SKILL.md'), 'utf8'), 'review-tour current');
  assert.equal(readFileSync(join(home, '.codex', 'skills', 'address-review', 'SKILL.md'), 'utf8'), 'address-review current');
  assert.equal(skillStatus(home, join(bundle, 'review-tour', 'SKILL.md')).current, true);

  rmSync(home, { recursive: true, force: true });
});
