// Public launch readiness checks for docs, release scripts, and GitHub hygiene.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

function read(rel) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

function exists(rel) {
  return existsSync(new URL(`../${rel}`, import.meta.url));
}

test('README leads with a visual demo, npm quickstart, and local-first positioning', () => {
  const readme = read('README.md');
  assert.match(readme, /!\[diffStory saved stories screen\]\(assets\/demo\/diffstory-story-picker\.png\)/);
  assert.match(readme, /!\[diffStory guided review screen\]\(assets\/demo\/diffstory-review\.png\)/);
  assert.doesNotMatch(readme, /assets\/demo\/diffstory-demo\.svg/);
  assert.match(readme, /npm i -g @naveedinno\/diffstory/);
  assert.match(readme, /diffstory/);
  assert.match(readme, /Works without AI/);
  assert.match(readme, /No Python is required for the core app\./);
});

test('package exposes release checks and ships demo and browser assets with npm package', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.build, /npm run build:browser-assets/);
  assert.equal(pkg.scripts['build:browser-assets'], 'node scripts/build-browser-assets.mjs');
  assert.equal(pkg.scripts.dev, 'npm run build && node dist/cli.js');
  assert.equal(pkg.scripts.check, 'npm run build && node --test test/*.test.mjs');
  assert.equal(pkg.scripts['release:check'], 'npm run check && npm pack --dry-run --json');
  assert.equal(pkg.scripts.prepublishOnly, 'npm run check');
  assert.equal(pkg.license, 'SEE LICENSE IN LICENSE');
  assert.ok(pkg.files.includes('dist'));
  assert.ok(pkg.files.includes('assets/demo'));
});

test('release build contains a self-contained Mermaid ESM browser bundle', () => {
  const buildScript = read('scripts/build-browser-assets.mjs');
  assert.match(buildScript, /mermaid\/dist\/mermaid\.esm\.min\.mjs/);
  assert.match(buildScript, /format: 'esm'/);
  assert.match(buildScript, /platform: 'browser'/);
  assert.match(buildScript, /minify: true/);
  assert.match(buildScript, /legalComments: 'eof'/);

  const asset = 'dist/mermaid.esm.min.mjs';
  assert.ok(exists(asset), `${asset} should be generated before packaging`);
  assert.ok(statSync(new URL(`../${asset}`, import.meta.url)).size > 500_000, `${asset} should contain Mermaid, not a loader stub`);
  const source = read(asset);
  assert.match(source, /export\{/);
  assert.match(source, /\/\*!|@license|@preserve/);
});

test('public repo hygiene files are present and point contributors at the right checks', () => {
  assert.match(read('CONTRIBUTING.md'), /npm run check/);
  assert.match(read('CONTRIBUTING.md'), /commercially relicense/i);
  assert.match(read('CHANGELOG.md'), /0\.1\.0/);
  assert.match(read('SECURITY.md'), /local/i);
  assert.match(read('docs/STRANGER_TEST.md'), /npm run dev/);
  assert.match(read('docs/RELEASE.md'), /npm run release:check/);
  assert.match(read('.github/workflows/ci.yml'), /npm run check/);
  assert.match(read('.github/ISSUE_TEMPLATE/bug_report.md'), /Steps to reproduce/);
  assert.match(read('.github/ISSUE_TEMPLATE/feature_request.md'), /What problem/);
});

test('license is source-available for personal use and requires commercial licensing', () => {
  const readme = read('README.md');
  const license = read('LICENSE');
  assert.doesNotMatch(readme, /license-MIT|MIT\]\(LICENSE\)/);
  assert.match(readme, /PolyForm Noncommercial License 1\.0\.0/);
  assert.match(readme, /commercial license/i);
  assert.match(license, /PolyForm Noncommercial License 1\.0\.0/);
  assert.match(license, /Required Notice: Copyright 2026 naveedinno/);
  assert.match(license, /Commercial use, embedding, resale, hosted service, or product integration requires a separate commercial license/i);
});

test('real demo screenshots exist where README references them', () => {
  for (const asset of ['assets/demo/diffstory-story-picker.png', 'assets/demo/diffstory-review.png']) {
    assert.ok(exists(asset), `${asset} should exist`);
    assert.ok(statSync(new URL(`../${asset}`, import.meta.url)).size > 20_000, `${asset} should be a real screenshot`);
  }
});
