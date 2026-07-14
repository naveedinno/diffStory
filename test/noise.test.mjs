// Unit tests for the shared review-noise classifier. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isReviewNoise,
  isGeneratedPath,
  reviewExclusionMetadata,
  REVIEW_NOISE_MAX_LINES,
} from '../dist/noise.js';

test('generated/vendored paths are noise regardless of size', () => {
  for (const p of [
    'abis/symmio.json',
    'src/abi/token.json',
    'dist/bundle.js',
    'node_modules/x/index.js',
    'package-lock.json',
    'app/styles.min.css',
    'build/out.map',
  ]) {
    assert.equal(isGeneratedPath(p), true, p);
    assert.equal(isReviewNoise(p, 1), true, p);
  }
});

test('ordinary source paths are not generated', () => {
  for (const p of ['src/server.ts', 'contracts/Vault.sol', 'test/foo.test.mjs', 'README.md']) {
    assert.equal(isGeneratedPath(p), false, p);
  }
});

test('an ordinary file becomes noise only once its diff crosses the size line', () => {
  assert.equal(isReviewNoise('src/server.ts', REVIEW_NOISE_MAX_LINES - 1), false);
  assert.equal(isReviewNoise('src/server.ts', REVIEW_NOISE_MAX_LINES), true);
});

test('exclusion metadata explains generated paths with their changed-line count', () => {
  assert.deepEqual(reviewExclusionMetadata('abis/token.json', 7, 3), {
    path: 'abis/token.json',
    reason: 'generated-path',
    addedLines: 7,
    removedLines: 3,
    changedLines: 10,
  });
});

test('exclusion metadata distinguishes a large diff from an ordinary file', () => {
  assert.deepEqual(reviewExclusionMetadata('src/large.ts', REVIEW_NOISE_MAX_LINES, 2), {
    path: 'src/large.ts',
    reason: 'large-diff',
    addedLines: REVIEW_NOISE_MAX_LINES,
    removedLines: 2,
    changedLines: REVIEW_NOISE_MAX_LINES + 2,
  });
  assert.equal(reviewExclusionMetadata('src/small.ts', 10, 2), null);
});

test('generated binary metadata preserves an unknown changed-line count', () => {
  assert.deepEqual(reviewExclusionMetadata('dist/image.bin', null, null), {
    path: 'dist/image.bin',
    reason: 'generated-path',
    addedLines: null,
    removedLines: null,
    changedLines: null,
  });
});

test('ordinary binary and metadata-only changes stay visible as structured exclusions', () => {
  assert.deepEqual(reviewExclusionMetadata('assets/logo.png', null, null), {
    path: 'assets/logo.png',
    reason: 'binary',
    addedLines: null,
    removedLines: null,
    changedLines: null,
  });
  assert.deepEqual(reviewExclusionMetadata('scripts/run.sh', 0, 0), {
    path: 'scripts/run.sh',
    reason: 'metadata-only',
    addedLines: 0,
    removedLines: 0,
    changedLines: 0,
  });
});
