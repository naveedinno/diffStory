// Unit tests for tour validation. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTour, validateGeneratedConceptSteps, validateGeneratedTour, validateTour } from '../dist/tour.js';

const longPrimerBody = [
  'A request enters through the existing boundary and is normalized into a stable envelope before policy code reads it.',
  'The envelope keeps identity, scope, and the requested action together while downstream helpers decide whether that action is allowed.',
  'This is not another stored record or a second API request; it is temporary decision context shared by the next code steps.',
  'Keep that ownership model in mind when checking where normalization happens, which helper applies policy, and where the accepted result returns.',
].join(' ');

const v2CodeStep = (id = 'code', order = 2, overrides = {}) => ({
  id,
  order,
  title: 'The implementation',
  file: 'x.ts',
  range: [1, 2],
  kind: 'changed',
  why: 'This is where the new behavior is implemented.',
  question: 'Does this implementation prove the intended behavior?',
  ...overrides,
});

const v2ConceptStep = (overrides = {}) => ({
  id: 'concept',
  order: 1,
  title: 'The new request lifecycle',
  kind: 'concept',
  body: 'A request is normalized before the implementation applies the policy.',
  preparesFor: ['code'],
  ...overrides,
});

const v2Tour = (steps, overrides = {}) => ({
  version: 2,
  title: 'Concept-first tour',
  summary: 'Understand the design, then review its implementation.',
  steps,
  ...overrides,
});

test('a well-formed tour has no errors', () => {
  const errs = validateTour({
    version: 1,
    mode: 'brief',
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(errs, []);
});

test('story snapshot references are optional, versioned, and content addressed', () => {
  const base = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  };
  assert.deepEqual(validateTour({ ...base, storySnapshot: { version: 1, id: 'a'.repeat(64) } }), []);
  assert.ok(validateTour({ ...base, storySnapshot: { version: 2, id: 'a'.repeat(64) } })
    .includes('storySnapshot must be a version 1 snapshot reference'));
  assert.ok(validateTour({ ...base, storySnapshot: { version: 1, id: '../unsafe' } })
    .includes('storySnapshot must be a version 1 snapshot reference'));
});

test('generated-story validation requires context, camera framing, and narrated highlights', () => {
  const legacyCompatible = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [4, 5], kind: 'changed', why: 'w' }],
  };
  assert.deepEqual(validateTour(legacyCompatible), []);

  const generatedErrors = validateGeneratedTour(legacyCompatible);
  assert.ok(generatedErrors.includes('version must be 2 for a generated story'));
  assert.ok(generatedErrors.includes('mode is required for a generated story'));
  assert.ok(generatedErrors.includes('intent is required for a generated story'));
  assert.ok(generatedErrors.includes('steps[0].viewport is required for a generated story'));
  assert.ok(generatedErrors.includes('steps[0].highlights are required for a generated story'));
  assert.ok(generatedErrors.includes('steps[0].beats are required for a generated story'));
});

test('generated-story validation keeps the changed range in frame and in at least one beat', () => {
  const base = {
    version: 1,
    mode: 'guided',
    title: 'T',
    summary: 'Follow the request into the changed decision.',
    intent: {
      goal: 'Let the reviewer verify the new decision.',
      design: 'The existing route reaches the changed branch and returns the result.',
      sources: ['conversation'],
    },
    steps: [{
      id: 's1',
      order: 1,
      title: 'Changed decision',
      file: 'x.ts',
      range: [20, 22],
      viewport: [10, 18],
      highlights: [[10, 12]],
      beats: [{ text: 'This only points at the caller.', highlights: [[10, 12]] }],
      kind: 'changed',
      why: 'The changed branch sits downstream.',
      question: 'Does the changed branch return the intended result?',
    }],
  };

  const errors = validateGeneratedTour(base);
  assert.ok(errors.includes('steps[0].range must be inside steps[0].viewport'));
  assert.ok(errors.includes('steps[0].beats must include a highlight that overlaps the changed range'));

  const valid = {
    ...base,
    version: 2,
    steps: [{
      ...base.steps[0],
      viewport: [10, 26],
      highlights: [[10, 12], [20, 22], [24, 26]],
      beats: [
        { text: 'The existing route puts us here.', highlights: [[10, 12]] },
        { text: 'This is the changed decision.', highlights: [[20, 22]] },
        { text: 'The result leaves through this return.', highlights: [[24, 26]] },
      ],
    }],
  };
  assert.deepEqual(validateGeneratedTour(valid), []);
});

test('generated-story validation keeps each camera shot and pointing gesture local', () => {
  const story = {
    version: 2,
    mode: 'guided',
    title: 'T',
    summary: 'Walk the existing route into the changed branch.',
    intent: {
      goal: 'Explain the changed route.',
      design: 'The existing route reaches a changed branch and returns a result.',
      sources: ['conversation'],
    },
    steps: [{
      id: 's1',
      order: 1,
      title: 'Changed branch',
      file: 'x.ts',
      range: [70, 72],
      viewport: [20, 80],
      highlights: [[20, 35], [70, 72]],
      beats: [
        { text: 'This gesture is too broad.', highlights: [[20, 35]] },
        { text: 'This points at the change.', highlights: [[70, 72]] },
      ],
      kind: 'changed',
      why: 'The branch controls the result.',
    }],
  };

  const errors = validateGeneratedTour(story);
  assert.ok(errors.includes('steps[0].viewport must stay within one 60-line camera shot'));
  assert.ok(errors.includes('steps[0].beats[0].highlights[0] must point at at most 12 lines'));

  const mismatched = {
    ...story,
    steps: [{
      ...story.steps[0],
      viewport: [20, 79],
      highlights: [[20, 31], [70, 72], [75, 76]],
      beats: [
        { text: 'This locates the route.', highlights: [[20, 31]] },
        { text: 'This points at the change.', highlights: [[70, 72]] },
      ],
    }],
  };
  assert.ok(validateGeneratedTour(mismatched).includes('steps[0].highlights must match the union of steps[0].beats highlights'));
});

test('generated guided stories reject over-broad cameras and too many review beats', () => {
  const story = {
    version: 2,
    mode: 'guided',
    title: 'Broad story',
    summary: 'Follow one broad step.',
    intent: {
      goal: 'Let a reviewer inspect the behavior.',
      design: 'The route reaches one changed branch and returns the result.',
      sources: ['conversation'],
    },
    steps: [{
      id: 's1', order: 1, title: 'One broad decision', question: 'Does this decision stay bounded?',
      file: 'x.ts', range: [20, 22], viewport: [1, 41], highlights: [[2, 2], [10, 10], [20, 22], [38, 38]],
      beats: [
        { text: 'First.', highlights: [[2, 2]] },
        { text: 'Second.', highlights: [[10, 10]] },
        { text: 'Third.', highlights: [[20, 22]] },
        { text: 'Fourth.', highlights: [[38, 38]] },
      ],
      kind: 'changed', why: 'This is too broad for one guided stop.',
    }],
  };
  const errors = validateGeneratedTour(story);
  assert.ok(errors.includes('steps[0].viewport should stay within 40 lines in guided mode; split the step'));
  assert.ok(errors.includes('steps[0].beats should contain at most 3 review points in guided mode; split the step'));
});

test('loadTour canonicalizes deleted step kind to changed', () => {
  const repo = mkdtempSync(join(tmpdir(), 'ds-tour-'));
  const path = join(repo, 'story.json');
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      title: 'T',
      summary: '',
      steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'deleted', why: 'w' }],
    }),
  );

  const tour = loadTour(path);
  assert.equal(tour.steps[0].kind, 'changed');

  rmSync(repo, { recursive: true, force: true });
});

test('accepts an optional narrow read-aloud focus target inside the step range', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [10, 20],
        focus: { ranges: [[14, 16]], label: 'balance guard' },
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('accepts an optional story generation file scope', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    storyScope: {
      includedFiles: ['contracts/Fee.sol'],
      excludedFiles: ['test/Fee.test.ts', 'package.json'],
      reviewerNote: 'Pay extra attention to the fee guard.',
    },
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'contracts/Fee.sol',
        range: [10, 20],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('flags malformed story generation file scopes', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    storyScope: {
      includedFiles: [],
      excludedFiles: ['test/Fee.test.ts', 12],
      reviewerNote: 42,
    },
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'contracts/Fee.sol',
        range: [10, 20],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(errs.some((e) => e.includes('storyScope.includedFiles')));
  assert.ok(errs.some((e) => e.includes('storyScope.excludedFiles[1]')));
  assert.ok(errs.some((e) => e.includes('storyScope.reviewerNote')));
});

test('flags scoped story steps that point at files outside the selected scope', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    storyScope: {
      includedFiles: ['contracts/Fee.sol'],
      excludedFiles: ['test/Fee.test.ts'],
    },
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'test/Fee.test.ts',
        range: [10, 20],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(errs.some((e) => e.includes('storyScope.includedFiles')));
});

test('accepts viewport and highlighted lines as the storyteller display contract', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 46],
        viewport: [37, 66],
        highlights: [[45, 46]],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('accepts story beats with their own highlighted lines', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 52],
        viewport: [37, 66],
        highlights: [[45, 52]],
        beats: [
          { text: 'First I explain the guard.', highlights: [[45, 46]] },
          { text: 'Then I explain the handoff.', highlights: [[51, 52]] },
        ],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('accepts the pure deleted-file sentinel anchor', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'deleted file',
        file: 'old-plan.md',
        range: [0, 0],
        viewport: [0, 0],
        highlights: [[0, 0]],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.deepEqual(errs, []);
});

test('flags unsupported version, missing title, and empty steps', () => {
  const errs = validateTour({ version: 3, steps: [] });
  assert.ok(errs.some((e) => e.includes('version')));
  assert.ok(errs.some((e) => e.includes('title')));
  assert.ok(errs.some((e) => e.includes('steps')));
});

test('flags a bad kind and a malformed range', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1], kind: 'bogus', why: 'w' }],
  });
  assert.ok(errs.some((e) => e.includes('kind')));
  assert.ok(errs.some((e) => e.includes('range')));
});

test('flags malformed or out-of-range read-aloud focus targets', () => {
  const malformed = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [10, 20], focus: { ranges: [[14]] }, kind: 'changed', why: 'w' }],
  });
  assert.ok(malformed.some((e) => e.includes('focus.ranges[0]')));

  const outside = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [10, 20], focus: { ranges: [[9, 10]] }, kind: 'changed', why: 'w' }],
  });
  assert.ok(outside.some((e) => e.includes('inside steps[0].range')));
});

test('flags highlighted lines outside the viewport', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 46],
        viewport: [37, 66],
        highlights: [[30, 34]],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(errs.some((e) => e.includes('highlights[0] must be inside steps[0].viewport')));
});

test('flags malformed or out-of-range story beats', () => {
  const malformed = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 46],
        viewport: [37, 66],
        beats: [{ text: '', highlights: [[45, 46]] }],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(malformed.some((e) => e.includes('beats[0].text')));

  const outside = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'a',
        file: 'x.ts',
        range: [45, 46],
        viewport: [37, 66],
        beats: [{ text: 'Too far.', highlights: [[70, 71]] }],
        kind: 'changed',
        why: 'w',
      },
    ],
  });
  assert.ok(outside.some((e) => e.includes('beats[0].highlights[0] must be inside steps[0].viewport')));
});

test('flags an invalid story mode', () => {
  const errs = validateTour({
    version: 1,
    mode: 'verbose',
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.ok(errs.some((e) => e.includes('mode')));
});

test('flags references to unknown step ids', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w', calls: ['nope'] }],
  });
  assert.ok(errs.some((e) => e.includes('unknown step id')));
});

test('flags invalid story step ordering', () => {
  const duplicate = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [
      { id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' },
      { id: 's2', order: 1, title: 'b', file: 'x.ts', range: [3, 4], kind: 'changed', why: 'w' },
    ],
  });
  assert.ok(duplicate.some((e) => e.includes('order 1 is duplicated')));

  for (const badOrder of [0, -1, 1.5]) {
    const errs = validateTour({
      version: 1,
      title: 'T',
      summary: '',
      steps: [{ id: 's1', order: badOrder, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
    });
    assert.ok(errs.some((e) => e.includes('order must be a positive integer')), `order ${badOrder} should be rejected`);
  }
});

test('flags malformed optional step metadata without throwing', () => {
  const base = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  };

  assert.ok(validateTour({ ...base, steps: [{ ...base.steps[0], tags: [123] }] }).includes('steps[0].tags[0] must be a non-empty string'));
  assert.ok(validateTour({ ...base, steps: [{ ...base.steps[0], calls: 123 }] }).includes('steps[0].calls must be an array'));
  assert.ok(validateTour({ ...base, steps: [{ ...base.steps[0], returnsTo: 123 }] }).includes('steps[0].returnsTo must be a string'));
});

test('accepts a story intent block with goal, design, and sources', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    intent: {
      goal: 'We wanted keepers to settle funding without one market draining balances.',
      design: 'settleFunding() clamps through one shared helper.',
      sources: ['commit 41af8b7', 'PR #12 body'],
    },
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(errs, []);
});

test('a story without an intent block stays valid', () => {
  const errs = validateTour({
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(errs, []);
});

test('intent.goal is required when intent is present', () => {
  const base = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  };
  assert.ok(validateTour({ ...base, intent: {} }).includes('intent.goal is required'));
  assert.ok(validateTour({ ...base, intent: { goal: '   ' } }).includes('intent.goal is required'));
  assert.ok(validateTour({ ...base, intent: 'why' }).includes('intent must be an object'));
});

test('intent.design and intent.sources are type-checked when present', () => {
  const base = {
    version: 1,
    title: 'T',
    summary: '',
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  };
  assert.ok(validateTour({ ...base, intent: { goal: 'g', design: 7 } }).includes('intent.design must be a string'));
  assert.ok(validateTour({ ...base, intent: { goal: 'g', sources: [] } }).includes('intent.sources must be a non-empty array'));
  assert.ok(validateTour({ ...base, intent: { goal: 'g', sources: 'commit' } }).includes('intent.sources must be a non-empty array'));
  assert.ok(validateTour({ ...base, intent: { goal: 'g', sources: ['ok', ''] } }).includes('intent.sources[1] must be a non-empty string'));
});

test('schema v1 remains valid for file-backed stories and rejects concept steps', () => {
  assert.deepEqual(validateTour({
    version: 1,
    title: 'Legacy story',
    summary: '',
    steps: [v2CodeStep('code', 1)],
  }), []);

  const errors = validateTour({
    version: 1,
    title: 'Legacy story',
    summary: '',
    steps: [v2ConceptStep(), v2CodeStep()],
  });
  assert.ok(errors.some((error) => error.includes('steps[0]') && error.includes('version 2')));
});

test('schema v2 accepts an interleaved concept step without code anchor or narration fields', () => {
  const story = v2Tour([
    v2ConceptStep({
      tags: ['architecture', 'request-flow'],
      diagram: {
        type: 'mermaid',
        source: 'flowchart LR\n  Request --> Normalize --> Policy',
        caption: 'The request reaches policy only after normalization.',
      },
    }),
    v2CodeStep(),
  ]);

  assert.deepEqual(validateTour(story), []);
});

test('concept steps reject code anchors and code-step narration fields', () => {
  const forbidden = {
    file: 'x.ts',
    range: [1, 2],
    ranges: [[1, 2], [40, 42]],
    viewport: [1, 2],
    highlights: [[1, 2]],
    focus: { ranges: [[1, 2]] },
    beats: [{ text: 'Point at code.', highlights: [[1, 2]] }],
    why: 'A code-step recap.',
    calls: ['code'],
    returnsTo: 'code',
  };

  for (const [field, value] of Object.entries(forbidden)) {
    const errors = validateTour(v2Tour([
      v2ConceptStep({ [field]: value }),
      v2CodeStep(),
    ]));
    assert.ok(
      errors.some((error) => error.includes(`steps[0].${field}`)),
      `concept field ${field} should be rejected: ${errors.join('; ')}`,
    );
  }
});

test('concept preparesFor references one or more later code steps', () => {
  const valid = v2Tour([
    v2ConceptStep({ preparesFor: ['code-a', 'code-b'] }),
    v2CodeStep('code-a', 2),
    v2CodeStep('code-b', 3, { file: 'y.ts' }),
  ]);
  assert.deepEqual(validateTour(valid), []);

  const cases = [
    {
      name: 'unknown target',
      steps: [v2ConceptStep({ preparesFor: ['missing'] }), v2CodeStep()],
    },
    {
      name: 'earlier target',
      steps: [v2CodeStep('code', 1), v2ConceptStep({ order: 2, preparesFor: ['code'] }), v2CodeStep('later', 3)],
    },
    {
      name: 'concept target',
      steps: [v2ConceptStep({ id: 'intro', preparesFor: ['concept'] }), v2ConceptStep({ order: 2 }), v2CodeStep('code', 3)],
    },
  ];

  for (const { name, steps } of cases) {
    const errors = validateTour(v2Tour(steps));
    assert.ok(
      errors.some((error) => error.includes('preparesFor') && error.includes('later code step')),
      `${name} should be rejected: ${errors.join('; ')}`,
    );
  }
});

test('concept preparesFor ids are unique and code flow links cannot target primers', () => {
  const duplicate = validateTour(v2Tour([
    v2ConceptStep({ preparesFor: ['code', 'code'] }),
    v2CodeStep(),
  ]));
  assert.ok(duplicate.some((error) => error.includes('duplicate step ids')));

  const badFlow = validateTour(v2Tour([
    v2CodeStep('entry', 1, { calls: ['concept'] }),
    v2ConceptStep({ order: 2, preparesFor: ['code'] }),
    v2CodeStep('code', 3, { returnsTo: 'concept' }),
  ]));
  assert.ok(badFlow.some((error) => error.includes('steps[0].calls must reference code steps')));
  assert.ok(badFlow.some((error) => error.includes('steps[2].returnsTo must reference code steps')));
});

test('concept steps cannot be adjacent or end the reading path', () => {
  const adjacent = validateTour(v2Tour([
    v2ConceptStep({ id: 'concept-a', preparesFor: ['code'] }),
    v2ConceptStep({ id: 'concept-b', order: 2, preparesFor: ['code'] }),
    v2CodeStep('code', 3),
  ]));
  assert.ok(adjacent.some((error) => error.includes('adjacent')));

  const ending = validateTour(v2Tour([
    v2CodeStep('code', 1),
    v2ConceptStep({ order: 2, preparesFor: ['code'] }),
  ]));
  assert.ok(ending.some((error) => error.includes('last')));
});

test('concept adjacency follows the order field rather than JSON array order', () => {
  const story = v2Tour([
    v2CodeStep('code-b', 3, { file: 'y.ts' }),
    v2ConceptStep({ preparesFor: ['code-a'] }),
    v2CodeStep('code-a', 2),
  ]);
  assert.deepEqual(validateTour(story), []);

  story.steps[1].preparesFor = ['code-b'];
  assert.ok(validateTour(story).some((error) => error.includes('immediately following code step')));
});

test('concept diagrams accept Mermaid flowcharts and reject executable Mermaid directives', () => {
  const safe = v2Tour([
    v2ConceptStep({
      diagram: {
        type: 'mermaid',
        source: 'sequenceDiagram\n  Browser->>Server: Review story',
        caption: 'The browser requests the prepared story.',
      },
    }),
    v2CodeStep(),
  ]);
  assert.deepEqual(validateTour(safe), []);

  for (const source of [
    '%%{init: {"securityLevel": "loose"}}%%\nflowchart LR\n  A --> B',
    'flowchart LR\n  A[<script>alert(1)</script>] --> B',
    'flowchart LR\n  A@{ img: "//evil.example/pixel", label: "x" }',
  ]) {
    const errors = validateTour(v2Tour([
      v2ConceptStep({ diagram: { type: 'mermaid', source, caption: 'Unsafe.' } }),
      v2CodeStep(),
    ]));
    assert.ok(
      errors.some((error) => error.includes('diagram.source') && error.includes('unsafe')),
      `unsafe Mermaid should be rejected: ${errors.join('; ')}`,
    );
  }
});

test('generated and repaired concept profiles enforce mode budgets and useful body length', () => {
  const valid = v2Tour([
    v2ConceptStep({ body: longPrimerBody }),
    v2CodeStep(),
  ], { mode: 'guided' });
  assert.deepEqual(validateGeneratedConceptSteps(valid), []);

  const tooShort = structuredClone(valid);
  tooShort.steps[0].body = 'A tiny glossary entry.';
  assert.ok(validateGeneratedConceptSteps(tooShort).includes('steps[0].body must contain at least 60 words'));

  const tooMany = v2Tour([
    v2ConceptStep({ id: 'concept-a', body: longPrimerBody, preparesFor: ['code-a'] }),
    v2CodeStep('code-a', 2),
    v2ConceptStep({ id: 'concept-b', order: 3, body: longPrimerBody, preparesFor: ['code-b'] }),
    v2CodeStep('code-b', 4),
  ], { mode: 'brief' });
  assert.ok(validateGeneratedConceptSteps(tooMany).includes('brief stories can include at most one concept step'));
});

test('intent.nonGoals must be non-empty strings when present', () => {
  const tour = (nonGoals) => ({
    version: 2,
    title: 'T',
    summary: '',
    intent: { goal: 'We wanted the boundary clamped.', nonGoals },
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(validateTour(tour(['does not touch settlement ordering'])), []);
  // An empty array is the honest "no deliberate omissions"; see the dedicated test below.
  assert.deepEqual(validateTour(tour([])), []);
  assert.ok(validateTour(tour([' '])).includes('intent.nonGoals[0] must be a non-empty string'));
  assert.ok(validateTour(tour('nope')).includes('intent.nonGoals must be an array'));
});

test('hotspots must be well-shaped and resolve to code steps', () => {
  const tour = (hotspots) => v2Tour([v2ConceptStep(), v2CodeStep()], { hotspots });
  assert.deepEqual(validateTour(tour([{ step: 'code', reason: 'I never exercised the deletion path.' }])), []);
  assert.ok(validateTour(tour([])).includes('hotspots must be a non-empty array'));
  assert.ok(validateTour(tour([{ reason: 'no anchor' }])).includes('hotspots[0].step is required'));
  assert.ok(validateTour(tour([{ step: 'code', reason: ' ' }])).includes('hotspots[0].reason is required'));
  assert.ok(validateTour(tour([{ step: 'ghost', reason: 'r' }])).includes('hotspots[0].step references unknown step id "ghost"'));
  assert.ok(validateTour(tour([{ step: 'concept', reason: 'r' }])).includes('hotspots[0].step must reference a code step, not concept "concept"'));
});

test('generated stories keep hotspots down to the three most honest doubts', () => {
  const steps = [1, 2, 3, 4].map((n) => v2CodeStep(`s${n}`, n));
  const spots = (n) => steps.slice(0, n).map((s) => ({ step: s.id, reason: `unsure about ${s.id}` }));
  assert.ok(!validateGeneratedTour(v2Tour(steps, { hotspots: spots(3) }))
    .some((e) => e.includes('hotspots')));
  assert.ok(validateGeneratedTour(v2Tour(steps, { hotspots: spots(4) }))
    .includes('hotspots must name at most 3 distrust spots; keep only the places you are least sure about'));
});

test('generated-story validation reports malformed beats instead of throwing', () => {
  // A real agent produced this shape under load: beats spelled `text` as `body`
  // and omitted `highlights` entirely. Callers show these messages to the
  // reviewer, so a TypeError here would surface as "not iterable" noise.
  const malformed = v2Tour([
    v2CodeStep('s1', 1, {
      viewport: [1, 10],
      highlights: [[1, 2]],
      beats: [{ body: 'wrote body instead of text, and no highlights' }],
    }),
  ], { mode: 'guided', intent: { goal: 'g', design: 'd', sources: ['conversation'] } });

  let errors;
  assert.doesNotThrow(() => { errors = validateGeneratedTour(malformed); });
  assert.ok(errors.includes('steps[0].beats[0].highlights are required for a generated story'));

  // Non-pair highlight entries are reported, not thrown on, too.
  const badPair = structuredClone(malformed);
  badPair.steps[0].beats = [{ text: 'ok', highlights: [[1, 2], null] }];
  let pairErrors;
  assert.doesNotThrow(() => { pairErrors = validateGeneratedTour(badPair); });
  assert.ok(pairErrors.includes('steps[0].beats[0].highlights[1] must be a [start, end] pair'));
});

test('generated-story validation rejects beat prose that only restates the diff', () => {
  const story = (text) => v2Tour([
    v2CodeStep('s1', 1, {
      viewport: [1, 10], highlights: [[1, 2]],
      beats: [{ text, highlights: [[1, 2]] }],
    }),
  ], { mode: 'guided', intent: { goal: 'g', design: 'd', sources: ['conversation'] } });

  // Line-number openers: the highlight already points there.
  const opener = validateGeneratedTour(story('Lines 748-750 normalize the heading weights.'));
  assert.ok(opener.some((e) => e.includes('must not open by naming line numbers')));
  assert.ok(validateGeneratedTour(story('Line 784 now carries font-style:normal.'))
    .some((e) => e.includes('must not open by naming line numbers')));

  // Value transitions: the diff renders both sides already.
  assert.ok(validateGeneratedTour(story('The back button font-weight 650→600 here.'))
    .some((e) => e.includes('must not narrate a value transition')));
  assert.ok(validateGeneratedTour(story('concept-eyebrow 780 -> 700 for consistency.'))
    .some((e) => e.includes('must not narrate a value transition')));

  // Conceptual arrows between words are normal prose and must stay legal.
  const conceptual = validateGeneratedTour(story('The request → handler path clamps before the write, so nothing downstream over-caps.'));
  assert.ok(!conceptual.some((e) => e.includes('value transition')));
  // "inline" mention of a line number mid-sentence is fine; only openers are barred.
  const midSentence = validateGeneratedTour(story('The guard added at line 42 is what stops a stale nonce reaching the write.'));
  assert.ok(!midSentence.some((e) => e.includes('naming line numbers')));
});

test('intent.nonGoals tolerates an empty array as "no deliberate omissions"', () => {
  const tour = (nonGoals) => ({
    version: 2, title: 'T', summary: '',
    intent: { goal: 'We clamped the boundary.', nonGoals },
    steps: [{ id: 's1', order: 1, title: 'a', file: 'x.ts', range: [1, 2], kind: 'changed', why: 'w' }],
  });
  assert.deepEqual(validateTour(tour([])), []);
  assert.deepEqual(validateTour(tour(['does not touch settlement ordering'])), []);
  assert.ok(validateTour(tour('nope')).includes('intent.nonGoals must be an array'));
  assert.ok(validateTour(tour([' '])).includes('intent.nonGoals[0] must be a non-empty string'));
});

test('skim steps need no review question; substantive stops still do', () => {
  const step = (overrides) => v2CodeStep('s1', 1, {
    viewport: [1, 10], highlights: [[1, 2]],
    beats: [{ text: 'Same rename as above; nothing reads the old field.', highlights: [[1, 2]] }],
    ...overrides,
  });
  const tour = (s) => v2Tour([s], { mode: 'guided', intent: { goal: 'g', design: 'd', sources: ['conversation'] } });

  // A mechanical sweep stop exists for coverage, not interrogation — forcing a
  // question there only produces rhetorical filler.
  const skim = tour(step({ question: undefined, tags: ['skim'] }));
  assert.ok(!validateGeneratedTour(skim).some((e) => e.includes('question is required')));
  for (const tag of ['sweep', 'mechanical', 'SKIM']) {
    assert.ok(!validateGeneratedTour(tour(step({ question: undefined, tags: [tag] })))
      .some((e) => e.includes('question is required')));
  }
  // Anything the reviewer must actually weigh still needs one.
  assert.ok(validateGeneratedTour(tour(step({ question: undefined })))
    .some((e) => e.includes('question is required')));
  assert.ok(validateGeneratedTour(tour(step({ question: undefined, tags: ['core'] })))
    .some((e) => e.includes('question is required')));

  // Agent output is untrusted JSON. A non-string tag is a useful validation
  // error, never a `.trim is not a function` crash in the generation result.
  const malformedTags = tour(step({ tags: [42] }));
  let malformedErrors;
  assert.doesNotThrow(() => { malformedErrors = validateGeneratedTour(malformedTags); });
  assert.ok(malformedErrors.includes('steps[0].tags[0] must be a non-empty string'));
});

test('viewport caps bound framing, not the size of the change itself', () => {
  const tour = (range, viewport, mode) => v2Tour([
    v2CodeStep('s1', 1, {
      range, viewport, highlights: [[range[0], range[0] + 1]],
      beats: [{ text: 'The guard now runs before the write.', highlights: [[range[0], range[0] + 1]] }],
    }),
  ], { mode, intent: { goal: 'g', design: 'd', sources: ['conversation'] } });
  const viewportErrors = (t) => validateGeneratedTour(t).filter((e) => e.includes('viewport'));

  // A hunk larger than the mode cap must still be claimable whole: "range spans
  // the full hunk" and "range sits inside viewport" would otherwise conflict.
  assert.deepEqual(viewportErrors(tour([100, 145], [100, 145], 'guided')), []);
  // ...with room for context around it.
  assert.deepEqual(viewportErrors(tour([100, 145], [94, 151], 'guided')), []);
  // But padding beyond that allowance is still a too-broad step.
  assert.ok(viewportErrors(tour([100, 145], [70, 175], 'guided')).length);
  // Small ranges keep the original caps: 41 lines of frame around 2 changed lines.
  assert.ok(viewportErrors(tour([100, 101], [70, 110], 'guided')).length);
  assert.deepEqual(viewportErrors(tour([100, 101], [80, 110], 'guided')), []);
});

test('context steps never use the large-range viewport exception', () => {
  const context = (range, viewport, mode) => v2Tour([
    v2CodeStep('s1', 1, {
      kind: 'context', range, viewport, highlights: [[range[0], range[0] + 1]],
      beats: [{ text: 'This caller explains where the changed path begins.', highlights: [[range[0], range[0] + 1]] }],
    }),
  ], { mode, intent: { goal: 'g', design: 'd', sources: ['conversation'] } });

  assert.ok(validateGeneratedTour(context([100, 145], [100, 145], 'guided'))
    .includes('steps[0].viewport should stay within 40 lines in guided mode; split the step'));
  assert.ok(validateGeneratedTour(context([100, 160], [100, 160], 'detailed'))
    .includes('steps[0].viewport must stay within one 60-line camera shot'));
});

test('optional ranges lets one step claim scattered spans without widening the camera', () => {
  const step = (extra) => v2CodeStep('s1', 1, {
    file: 'x.ts', range: [10, 14], viewport: [8, 30], highlights: [[10, 12]],
    beats: [{ text: 'The rename lands here; nothing reads the old field.', highlights: [[10, 12]] }],
    ...extra,
  });
  const tour = (extra) => v2Tour([step(extra)], {
    mode: 'guided', intent: { goal: 'g', design: 'd', sources: ['conversation'] },
  });

  // Absent -> unchanged behaviour.
  assert.deepEqual(validateTour(tour({})), []);

  // Scattered spans far outside the viewport are the POINT: a sweep touches
  // lines no single camera shot can show.
  const scattered = tour({
    ranges: [[10, 14], [400, 402], [900, 900]],
    question: undefined,
    tags: ['skim'],
  });
  assert.deepEqual(validateTour(scattered), []);
  assert.deepEqual(validateGeneratedTour(scattered), []);

  // Multi-range coverage is reserved for an explicitly skimmable mechanical
  // sweep. Otherwise the agent could hide substantive review points in one step.
  const untagged = tour({ ranges: [[10, 14], [400, 402]] });
  assert.ok(validateGeneratedTour(untagged)
    .includes('steps[0].ranges requires a "skim", "sweep", or "mechanical" tag for a generated story'));

  // Containment, not exact equality: the anchor may be a tighter camera shot
  // inside the changed span it represents.
  assert.deepEqual(validateTour(tour({ ranges: [[8, 20], [400, 402]] })), []);

  // The anchor must be part of what is claimed, so framing and claim can't drift.
  assert.ok(validateTour(tour({ ranges: [[400, 402]] }))
    .some((e) => e.includes('range must be contained in one of steps[0].ranges')));

  // Shape errors are reported, not thrown.
  assert.ok(validateTour(tour({ ranges: [] })).includes('steps[0].ranges must be a non-empty array when present'));
  assert.ok(validateTour(tour({ ranges: [[5]] })).some((e) => e.includes('steps[0].ranges[0] must be [startLine, endLine]')));

  // Context never claims coverage, so accepting ranges there would be a silent no-op.
  assert.ok(validateTour(tour({ kind: 'context', ranges: [[10, 14], [400, 402]] }))
    .includes('steps[0].ranges is not allowed for a context step'));
});

test('whole-file deletion ranges must contain the deletion anchor', () => {
  const deletion = (ranges) => v2Tour([
    v2CodeStep('s1', 1, {
      range: [0, 0], ranges, viewport: [0, 0], highlights: [[0, 0]],
      beats: [{ text: 'The file disappears as one deliberate removal.', highlights: [[0, 0]] }],
      tags: ['mechanical'],
    }),
  ], { mode: 'guided', intent: { goal: 'g', design: 'd', sources: ['conversation'] } });

  assert.deepEqual(validateTour(deletion([[0, 0]])), []);
  assert.deepEqual(validateGeneratedTour(deletion([[0, 0]])), []);
  assert.ok(validateTour(deletion([[1, 1]]))
    .some((e) => e.includes('range must be contained in one of steps[0].ranges')));
});

test('coverage counts every span a step claims via ranges', async () => {
  const { computeCoverage } = await import('../dist/coverage.js');
  const { parseUnifiedDiff } = await import('../dist/diff.js');
  // Two separate clusters inside one file: 10-11 and 40-41.
  const diff = [
    'diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts',
    '@@ -10,0 +10,2 @@', '+alpha', '+beta',
    '@@ -40,0 +40,2 @@', '+gamma', '+delta',
  ].join('\n');
  const files = parseUnifiedDiff(diff);
  const base = { id: 's1', order: 1, title: 'T', kind: 'changed', file: 'x.ts', why: 'w' };

  // Anchor alone leaves the far cluster unexplained...
  const narrow = { version: 2, title: 'T', summary: '', steps: [{ ...base, range: [10, 11] }] };
  assert.equal(computeCoverage(narrow, files).uncovered.length, 1);

  // ...and claiming both spans closes it, with no change to what is displayed.
  const swept = { version: 2, title: 'T', summary: '', steps: [{ ...base, range: [10, 11], ranges: [[10, 11], [40, 41]] }] };
  assert.equal(computeCoverage(swept, files).uncovered.length, 0);
});
