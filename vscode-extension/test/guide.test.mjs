import assert from 'node:assert/strict';
import test from 'node:test';

const { classifyGuide, diffFingerprint } = await import('../dist/guide.js');

const activeDiff = 'diff --git a/src/a.ts b/src/a.ts\n+const current = true;\n';
const otherDiff = 'diff --git a/src/b.ts b/src/b.ts\n+const other = true;\n';

test('an exact fingerprint makes guide line targets current', () => {
  assert.deepEqual(classifyGuide({
    story: { diffFingerprint: diffFingerprint(activeDiff) },
    activeDiff,
    activeScopeLabel: 'HEAD → working tree',
  }), {
    state: 'current',
    activeScopeLabel: 'HEAD → working tree',
    canSwitchScope: false,
  });
});

test('a guide current for another declared comparison is a recoverable scope mismatch', () => {
  const status = classifyGuide({
    story: { diffFingerprint: diffFingerprint(otherDiff) },
    activeDiff,
    activeScopeLabel: 'HEAD → working tree',
    storyDiff: otherDiff,
    storyScopeLabel: 'main → feature',
    canSwitchScope: true,
  });

  assert.equal(status.state, 'scope-mismatch');
  assert.equal(status.canSwitchScope, true);
  assert.equal(status.storyScopeLabel, 'main → feature');
});

test('changed and legacy guides are stale or unverified instead of silently trusted', () => {
  assert.equal(classifyGuide({
    story: { diffFingerprint: diffFingerprint(otherDiff) },
    activeDiff,
    storyDiff: activeDiff,
    activeScopeLabel: 'HEAD → working tree',
  }).state, 'stale');
  assert.equal(classifyGuide({
    story: {},
    activeDiff,
    storyDiff: activeDiff,
    activeScopeLabel: 'HEAD → working tree',
  }).state, 'unverified');
});
