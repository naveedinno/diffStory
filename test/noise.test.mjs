// Unit tests for the shared review-noise classifier. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isReviewNoise, isGeneratedPath, REVIEW_NOISE_MAX_LINES } from '../dist/noise.js';

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
