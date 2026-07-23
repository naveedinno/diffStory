// Shape checks for the story-eval harness fixtures. Run with: npm test
// (No git or claude CLI involved: refs are only resolved when the harness runs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { storyPrompt } from '../dist/agent.js';

const { cases } = JSON.parse(readFileSync(new URL('../eval/cases.json', import.meta.url), 'utf8'));

test('eval cases are unique, complete, and use real story modes', () => {
  assert.ok(cases.length >= 3, 'keep at least three diverse frozen cases');
  const ids = cases.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'case ids must be unique');
  for (const c of cases) {
    assert.ok(c.base && c.head, `${c.id} needs a frozen base..head range`);
    assert.ok(c.base.endsWith('^'), `${c.id} base should be the parent ref (X^) so the range stays immutable`);
    assert.ok(['brief', 'guided', 'detailed'].includes(c.mode), `${c.id} has unknown mode ${c.mode}`);
    assert.ok(Array.isArray(c.excludePaths) && c.excludePaths.includes('dist/*'),
      `${c.id} must exclude generated dist/ like the app would`);
    assert.ok(c.note?.trim(), `${c.id} needs a note describing the change shape`);
  }
});

test('every eval case builds the production story prompt', () => {
  for (const c of cases) {
    const p = storyPrompt(c.base, c.head, c.mode, c.excludePaths);
    assert.ok(p.includes(`git diff ${c.base}..${c.head} --`), `${c.id} prompt pins the frozen range`);
    assert.ok(p.includes(`set its "mode" field to "${c.mode}"`));
    assert.ok(p.includes(':(exclude)dist/*'));
  }
});

// The harness module is import-safe: its main block is guarded, so importing it
// here formats events and checks skill freshness without spawning agent runs.
const { progressLine, skillInstallState } = await import('../scripts/eval-stories.mjs');

test('progressLine turns agent events into one readable line, or nothing', () => {
  assert.equal(progressLine({ type: 'file', action: 'read', target: 'src/render.ts' }), 'read src/render.ts');
  assert.equal(progressLine({ type: 'command', command: 'git diff --stat' }), '$ git diff --stat');
  assert.equal(progressLine({ type: 'activity', kind: 'search', label: 'Grep settleFunding' }), 'Grep settleFunding');
  // The live-progress protocol's ">> " markers are the story-shaped signal.
  assert.equal(progressLine({ type: 'text', data: '>> Recovering the why' }), '▸ Recovering the why');
  assert.equal(progressLine({ type: 'text', data: 'thinking out loud\n>> Goal: cap the fee' }), '▸ Goal: cap the fee');
  // Ordinary prose stays in the log file instead of flooding the console.
  assert.equal(progressLine({ type: 'text', data: 'Let me look at the diff.' }), null);
  assert.equal(progressLine({ type: 'nonsense' }), null);
});

test('skillInstallState refuses to score a stale or missing installed skill', () => {
  assert.deepEqual(skillInstallState('SKILL body', 'SKILL body'), { ok: true });
  assert.deepEqual(skillInstallState('SKILL body\n', '  SKILL body  '), { ok: true });
  assert.deepEqual(skillInstallState('new skill', 'old skill'), { ok: false, reason: 'out of date' });
  assert.deepEqual(skillInstallState('new skill', null), { ok: false, reason: 'not installed' });
});

test('retriesExhausted separates infrastructure failures from story failures', async () => {
  const { retriesExhausted } = await import('../scripts/eval-stories.mjs');
  const retry = (attempt, max) =>
    JSON.stringify({ type: 'system', subtype: 'api_retry', attempt, max_retries: max });

  // A run that burned every retry died of infrastructure — reporting it as a
  // generation failure would read as a quality regression and skew the loop.
  assert.equal(retriesExhausted([retry(9, 10), retry(10, 10)].join('\n')), 10);
  // Retries that eventually succeeded are not failures.
  assert.equal(retriesExhausted([retry(1, 10), retry(2, 10)].join('\n')), 0);
  assert.equal(retriesExhausted('{"type":"system","subtype":"init"}'), 0);
  assert.equal(retriesExhausted(''), 0);
  // Truncated/partial stream lines must not throw.
  assert.equal(retriesExhausted('{"type":"system","subtype":"api_retry",'), 0);
});
