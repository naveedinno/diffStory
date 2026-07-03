// Unit tests for numstat rename-path normalization. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postRenamePath } from '../dist/server.js';

test('postRenamePath leaves ordinary paths alone', () => {
  assert.equal(postRenamePath('src/server.ts'), 'src/server.ts');
  assert.equal(postRenamePath('a.ts'), 'a.ts');
  assert.equal(postRenamePath(''), '');
});

test('postRenamePath collapses braced rename segments to the new side', () => {
  assert.equal(postRenamePath('src/{old => new}/file.ts'), 'src/new/file.ts');
  assert.equal(postRenamePath('src/{old.ts => new.ts}'), 'src/new.ts');
  assert.equal(postRenamePath('{old => new}/file.ts'), 'new/file.ts');
});

test('postRenamePath handles segments added or removed by the rename', () => {
  // `{ => sub}` inserts a directory; `{old => }` drops one — the leftover
  // double slash must not survive into the changed-file list.
  assert.equal(postRenamePath('src/{ => sub}/file.ts'), 'src/sub/file.ts');
  assert.equal(postRenamePath('src/{old => }/file.ts'), 'src/file.ts');
});

test('postRenamePath takes the right side of a bare whole-path rename', () => {
  assert.equal(postRenamePath('old-name.ts => new-name.ts'), 'new-name.ts');
  assert.equal(postRenamePath('docs/a.md => notes/b.md'), 'notes/b.md');
});
