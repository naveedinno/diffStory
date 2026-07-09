import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('launcher help presents diffStory as a browser app, not a CLI surface', () => {
  const out = execFileSync(process.execPath, ['dist/cli.js', '--help'], { encoding: 'utf8' });
  assert.match(out, /Run `diffstory` to open the local browser app\./);
  assert.match(out, /Pick a project from the list/);
  assert.doesNotMatch(out, /USAGE/);
  assert.doesNotMatch(out, /OPTIONS/);
  assert.doesNotMatch(out, /--dir/);
  assert.doesNotMatch(out, /--no-open/);
});
