// Public launch readiness checks for docs, release scripts, and GitHub hygiene.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function read(rel) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

function exists(rel) {
  return existsSync(new URL(`../${rel}`, import.meta.url));
}

test('README leads with a visual demo, npm quickstart, and local-first positioning', () => {
  const readme = read('README.md');
  assert.match(readme, /!\[diffStory guided review demo\]\(assets\/demo\/diffstory-demo\.svg\)/);
  assert.match(readme, /npm i -g @naveedinno\/diffstory/);
  assert.match(readme, /diffstory/);
  assert.match(readme, /Works without AI/);
  assert.match(readme, /No Python is required for the core app\./);
});

test('package exposes release checks and ships demo assets with npm package', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.check, 'npm run build && node --test test/*.test.mjs');
  assert.equal(pkg.scripts['release:check'], 'npm run check && npm pack --dry-run --json');
  assert.equal(pkg.scripts.prepublishOnly, 'npm run check');
  assert.ok(pkg.files.includes('assets/demo'));
});

test('public repo hygiene files are present and point contributors at the right checks', () => {
  assert.match(read('CONTRIBUTING.md'), /npm run check/);
  assert.match(read('CHANGELOG.md'), /0\.1\.0/);
  assert.match(read('SECURITY.md'), /local/i);
  assert.match(read('docs/STRANGER_TEST.md'), /npm run dev/);
  assert.match(read('docs/RELEASE.md'), /npm run release:check/);
  assert.match(read('.github/workflows/ci.yml'), /npm run check/);
  assert.match(read('.github/ISSUE_TEMPLATE/bug_report.md'), /Steps to reproduce/);
  assert.match(read('.github/ISSUE_TEMPLATE/feature_request.md'), /What problem/);
});

test('demo asset exists where README references it', () => {
  assert.ok(exists('assets/demo/diffstory-demo.svg'));
});
