// The vendored beUI tree is an allowlist, not a dumping ground.
//
// 74 components were vendored during the React rewrite and 68 were removed once
// it was clear which ones the app used. Most were rejected because they ship
// their own `aria-live` / `role="status"` — actively harmful in a diff reviewer,
// where a live region on a diff viewport announces the whole body on every lazy
// load. `client/vendor/beui/README.md` records which components carried one at
// the pinned commit.
//
// So this file makes re-adding a component a deliberate act: it fails until the
// allowlist is updated, which is the moment to check the new file for a live
// region.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const VENDOR = fileURLToPath(new URL('../client/vendor/beui/', import.meta.url));
const CLIENT = fileURLToPath(new URL('../client/', import.meta.url));

/** Exactly the transitive closure of what the app imports. Keep sorted. */
const ALLOWED = [
  'lib/ease.ts',
  'lib/hooks/use-hover-capable.ts',
  'lib/use-theme.ts',
  'lib/utils.ts',
  'motion/animated-badge.tsx',
  'motion/button/base.tsx',
];

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(relative(VENDOR, full));
  }
  return out.sort();
}

function appSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'vendor' || entry === 'generated') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...appSources(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test('the vendored tree holds exactly the components the app imports', () => {
  assert.deepEqual(
    sourceFiles(VENDOR),
    ALLOWED,
    'vendored beUI files drifted from the allowlist — see client/vendor/beui/README.md before adding one',
  );
});

test('nothing imports a beUI module that is not vendored', () => {
  const missing = [];
  for (const file of appSources(CLIENT)) {
    const src = readFileSync(file, 'utf8');
    for (const match of src.matchAll(/["']([^"']*vendor\/beui\/[^"']+)["']/g)) {
      const spec = match[1].replace(/.*vendor\/beui\//, '');
      const resolved = ALLOWED.find((a) => a === spec || a.replace(/\.tsx?$/, '') === spec);
      if (!resolved) missing.push(`${relative(CLIENT, file)} imports beui/${spec}`);
    }
  }
  assert.deepEqual(missing, [], 'an import points at a beUI module that is no longer vendored');
});

test('no vendored component smuggles in a live region', () => {
  // The survivors were checked by hand; this keeps them honest across updates.
  // A button and a badge have no business announcing anything.
  for (const file of ALLOWED) {
    const src = readFileSync(join(VENDOR, file), 'utf8');
    assert.doesNotMatch(
      src,
      /aria-live|role="(status|log|alert)"/,
      `${file} carries a live region — wrap it to strip that before shipping it`,
    );
  }
});

test('the provenance record survives, including why components were dropped', () => {
  const readme = readFileSync(join(VENDOR, 'README.md'), 'utf8');
  assert.match(readme, /b3966e2604a8e43537a7b78fa3103a6fd72d1388/, 'the pinned upstream commit');
  assert.match(readme, /aria-live="polite"\*\* on the diff viewport|on the diff viewport/);
  assert.match(readme, /test\/vendor-beui\.test\.mjs/, 'points at this allowlist');
  assert.ok(readFileSync(join(VENDOR, 'LICENSE'), 'utf8').includes('MIT'), 'upstream MIT notice is kept');
});
