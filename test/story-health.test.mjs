import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storyHealth } from '../dist/story-health.js';

function step(id, order, overrides = {}) {
  return {
    id,
    order,
    title: `Step ${id}`,
    kind: 'changed',
    file: 'a.ts',
    range: [1, 2],
    viewport: [1, 10],
    highlights: [[1, 2]],
    beats: [{ text: `Beat for ${id} with <code>${id}()</code> landing.`, highlights: [[1, 2]] }],
    why: `Why ${id} matters.`,
    landing: { symbol: `${id}()`, calledBy: ['main()'], when: 'always' },
    ...overrides,
  };
}

function tour(steps) {
  return { version: 4, title: 'Health story', summary: 'summary', steps };
}

test('contract errors resolve to their step, panel, and file', () => {
  const health = storyHealth(tour([step('s1', 1), step('s2', 2, { beats: undefined })]));
  const beats = health.findings.find((f) => f.message.includes('.beats are required'));
  assert.ok(beats);
  assert.equal(beats.kind, 'contract');
  assert.equal(beats.severity, 'error');
  assert.equal(beats.stepId, 's2');
  assert.equal(beats.panelIndex, 2);
  assert.equal(beats.file, 'a.ts');
  const mode = health.findings.find((f) => f.message.includes('mode is required'));
  assert.ok(mode, 'missing mode is a contract error');
  assert.equal(mode.stepId, undefined, 'story-level findings carry no step');
  assert.equal(mode.panelIndex, undefined);
});

test('lint findings resolve step ids, including the first of a shared span', () => {
  const shared = 'The very same narration everywhere with <code>x()</code> inside it.';
  const steps = ['s1', 's2', 's3'].map((id, i) =>
    step(id, i + 1, {
      beats: [{ text: shared, highlights: [[1, 2]] }],
      why: `Why ${id} with <code>y()</code>.`,
    }),
  );
  const health = storyHealth(tour(steps));
  const copied = health.findings.find((f) => f.rule === 'copied-beat');
  assert.ok(copied);
  assert.equal(copied.stepId, 's1', 'a shared finding repairs from its first step');
  assert.equal(copied.panelIndex, 1);
  assert.equal(copied.severity, 'error');
});

test('markdown residue in a why surfaces with its fix', () => {
  const health = storyHealth(tour([step('s1', 1, { why: 'This **fixes** everything.' })]));
  const residue = health.findings.find((f) => f.rule === 'markdown-residue');
  assert.ok(residue);
  assert.equal(residue.where, 'steps[s1].why');
  assert.equal(residue.stepId, 's1');
  assert.ok(residue.fix);
});

test('errors sort before warnings, and counts match', () => {
  const health = storyHealth(
    tour([
      step('s1', 1, { why: 'This **fixes** everything.' }),
      step('s2', 2, { beats: undefined }),
    ]),
  );
  assert.ok(health.errors >= 2);
  const severities = health.findings.map((f) => f.severity);
  assert.deepEqual([...severities].sort(), severities, 'errors first');
  assert.equal(
    health.errors + health.warnings,
    health.findings.length,
    'counts cover every finding',
  );
});

test('a clean story reports no findings', () => {
  const healthy = {
    version: 4,
    title: 'Healthy',
    summary: 'summary',
    mode: 'guided',
    intent: { goal: 'Ship the fix.', design: 'One path.', sources: ['conversation'] },
    hotspots: [{ step: 's1', reason: 'I never ran the exact-cap case.' }],
    steps: [step('s1', 1)],
  };
  const health = storyHealth(healthy);
  assert.equal(health.errors, 0);
  assert.deepEqual(
    health.findings.map((f) => f.rule ?? f.message),
    [],
  );
});
