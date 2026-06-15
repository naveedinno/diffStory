// Unit tests for the story filename resolver. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storyPath, resolveStoryPath } from '../dist/config.js';

function tmpRepo() {
  const d = mkdtempSync(join(tmpdir(), 'ds-cfg-'));
  mkdirSync(join(d, '.diffstory'), { recursive: true });
  return d;
}

test('storyPath points at .diffstory/story.json', () => {
  const d = tmpRepo();
  assert.equal(storyPath(d), join(d, '.diffstory', 'story.json'));
  rmSync(d, { recursive: true, force: true });
});

test('resolveStoryPath prefers story.json', () => {
  const d = tmpRepo();
  writeFileSync(join(d, '.diffstory', 'story.json'), '{}');
  writeFileSync(join(d, '.diffstory', 'review-tour.json'), '{}');
  assert.equal(resolveStoryPath(d), join(d, '.diffstory', 'story.json'));
  rmSync(d, { recursive: true, force: true });
});

test('resolveStoryPath falls back to legacy review-tour.json', () => {
  const d = tmpRepo();
  writeFileSync(join(d, '.diffstory', 'review-tour.json'), '{}');
  assert.equal(resolveStoryPath(d), join(d, '.diffstory', 'review-tour.json'));
  rmSync(d, { recursive: true, force: true });
});

test('resolveStoryPath defaults to story.json when neither exists', () => {
  const d = tmpRepo();
  assert.equal(resolveStoryPath(d), join(d, '.diffstory', 'story.json'));
  rmSync(d, { recursive: true, force: true });
});
