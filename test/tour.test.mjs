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
