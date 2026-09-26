# Free Concept Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the storyteller agent author any HTML page (JS and CDN libraries included) as a concept step, rendered in a sandboxed iframe, with no limits on how many concept steps a story has or where they sit.

**Architecture:** Story format v4 adds a page-concept shape (`page` + `narration`). The validator accepts it and drops the structural concept rules for v4. The step panel renders an empty sandboxed iframe. The review engine points it at a new `/api/review/concept-page` endpoint that serves the author's HTML with its own permissive CSP plus a small injected shim for keys and theme. The skill, the in-app agent prompts, lint, eval, and docs switch to the new shape.

**Tech Stack:** TypeScript (Node ≥20, ESM), `node:test`, plain-JS review engine (`client/surfaces/review/engine/review-engine.js`), React shell, esbuild bundling via `npm run build`.

**Spec:** `docs/superpowers/specs/2026-09-26-free-concept-pages-design.md`

## Global Constraints

- Story format version for page concepts: `4`. v1–v3 stories keep validating exactly as today.
- Generated stories: `version` 3 or 4 accepted (`"version must be 3 or 4 for a generated story"`); the skill and app prompts write `4`.
- Page iframe sandbox is exactly `sandbox="allow-scripts"` plus `allow="fullscreen"`. Never `allow-same-origin`, `allow-top-navigation`, `allow-popups`, or `allow-forms`.
- Concept-page CSP: `default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'`.
- App CSP gains exactly `frame-src 'self'`; nothing else in the app CSP changes.
- The page HTML never appears inside the step-panel HTML or the review payload. It only leaves the server through the concept-page endpoint.
- The validator never parses or judges `page` beyond "non-empty string".
- `dist/` and `skills/diffstory-storyteller/scripts/check-story.mjs` are committed rebuilt with every `src/` change (`npm run build` produces both).
- Tests import from `../dist/`; `npm test` builds first. Run a single file with `npm run build && node --test test/<file>.test.mjs`.
- Engine code is dense one-line-per-statement ES5-style JS; match it. After editing the engine run `node --check client/surfaces/review/engine/review-engine.js`.
- Never write a banned API name or UI string into a comment inside the engine or other inlined page code (whole-document `doesNotMatch` assertions read comments too).

## Review Focus

1. **Keys typed into the page's own inputs** (a slider's number box, a search field) must not flip the story step. Pinned in Task 4 (shim skips text-entry targets and `defaultPrevented`).
2. **A page that is only a fragment** (no `<html>`/`<head>`) must still get the shim and render. Pinned in Task 4 (`conceptPageDocument` prepends when no `<head>`).
3. **A page whose HTML contains `</script>` or its own CSP `<meta>`** must not break the shim or the app. The shim is injected before author content, and a stricter author `<meta>` CSP only restricts the author's own page. Pinned in Task 4 (injection-order test).
4. **A request from inside the sandboxed page to the app's API** (e.g. `fetch('/api/comments')`, `fs-browse`) must be refused. Pinned in Task 4 (`Origin: null` and `Sec-Fetch-Site: cross-site` → 403).
5. **Opening an old v3 story or a legacy-concept v4 story** must render the text body and Mermaid diagram exactly as before. Pinned in Tasks 1 and 3.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/types.ts` | Story types | Add page-concept type, v4, `concept-page` scene layout |
| `src/tour.ts` | Story validation | v4, page shape, lifted v4 rules |
| `src/story-check.ts` | Checker CLI core | Dispatch v3+ to the new-story profile |
| `src/story-scenes.ts` | Scene projection | `concept-page` layout |
| `src/view-model.ts` | Step view model | `ConceptStepView` gains page flag + narration |
| `src/render.ts` | Step panel HTML | Page-concept panel with empty iframe; speech |
| `src/concept-page.ts` | **New.** Page document assembly | Shim + token injection, CSP constant |
| `src/server.ts` | HTTP routes, headers | `frame-src 'self'`, concept-page route |
| `client/surfaces/review/engine/review-engine.js` | Review interactions | Mount frames, key bridge, theme sync, fullscreen |
| `client/surfaces/review/review.css` | Review styles | `concept-page` stage layout |
| `src/story-lint.ts` | Lint | Narration for page concepts, legacy-only Mermaid lint |
| `src/agent.ts` | In-app generation/repair prompts | v4, page-concept fields, no budgets |
| `skills/diffstory-storyteller/**` | Storyteller skill | Concept pages guidance, v4 schema |
| `scripts/eval-stories.mjs` | Eval | Read narration for page concepts |
| `docs/story-schema.md`, `CHANGELOG.md` | Docs | v4, page concepts, CDN privacy note |

---

### Task 1: Schema and validator for v4 page concepts

**Files:**
- Modify: `src/types.ts:17-26` (scene layout), `src/types.ts:280-325` (concept types, `Tour.version`)
- Modify: `src/tour.ts` — constants (~line 55), `validateMoves` (~line 912), `validateConceptStep` (~line 705), `validateTour` version check (~line 1137) and concept branch (~line 1234), reading-path loop (~line 1264), `validateGeneratedConceptSteps` (~line 1390), `validateGeneratedTour` (~line 1441)
- Modify: `src/story-check.ts:103`
- Test: `test/tour.test.mjs`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export interface LegacyConceptTourStep extends TourStepBase { kind: 'concept'; body: string; preparesFor: string[]; diagram?: ConceptDiagram; page?: never; narration?: never }
  export interface PageConceptTourStep extends TourStepBase { kind: 'concept'; page: string; narration: string; preparesFor?: string[]; body?: never; diagram?: never }
  export type ConceptTourStep = LegacyConceptTourStep | PageConceptTourStep;
  export function isPageConcept(step: TourStep): step is PageConceptTourStep;
  // Tour.version: 1 | 2 | 3 | 4
  // StoryStepSceneLayout gains 'concept-page'
  ```
- Produces (tour.ts): unchanged exported names; `validateTour`, `validateGeneratedTour`, `validateGeneratedConceptSteps`, `validateNewGeneratedStory` accept v4.

- [ ] **Step 1: Write the failing tests** — append to `test/tour.test.mjs`:

```js
const pageConcept = (overrides = {}) => ({
  id: 'page',
  order: 1,
  title: 'How margin moves with price',
  kind: 'concept',
  page: '<!doctype html><html><head><script src="https://cdn.jsdelivr.net/npm/d3@7"></script></head><body><svg id="c"></svg><script>d3.select("#c")</script></body></html>',
  narration: 'Drag the price and watch the margin line cross the liquidation threshold.',
  ...overrides,
});
const v4Tour = (steps, overrides = {}) => ({ ...v2Tour(steps), version: 4, ...overrides });

test('schema v4 accepts a page concept with no preparesFor', () => {
  assert.deepEqual(validateTour(v4Tour([pageConcept(), v2CodeStep('code', 2)])), []);
});

test('page concepts require story version 4', () => {
  const errors = validateTour({ ...v2Tour([pageConcept(), v2CodeStep('code', 2)]), version: 3 });
  assert.ok(errors.includes('steps[0].page requires story version 4'), errors.join('; '));
});

test('page concepts need a non-empty page and plain-text narration', () => {
  const missing = validateTour(v4Tour([pageConcept({ page: ' ', narration: '' }), v2CodeStep('code', 2)]));
  assert.ok(missing.includes('steps[0].page must be a non-empty string'), missing.join('; '));
  assert.ok(missing.includes('steps[0].narration is required'), missing.join('; '));
  const marked = validateTour(v4Tour([pageConcept({ narration: 'Drag <strong>price</strong>.' }), v2CodeStep('code', 2)]));
  assert.ok(marked.some((e) => e.startsWith('steps[0].narration ')), marked.join('; '));
});

test('page and body are mutually exclusive; narration needs page', () => {
  const both = validateTour(v4Tour([pageConcept({ body: 'text' }), v2CodeStep('code', 2)]));
  assert.ok(both.includes('steps[0] concept step takes either page or body, not both'), both.join('; '));
  const legacyWithNarration = validateTour(v4Tour([v2ConceptStep({ narration: 'x' }), v2CodeStep('code', 2)]));
  assert.ok(legacyWithNarration.includes('steps[0].narration is only allowed with page'), legacyWithNarration.join('; '));
  const withDiagram = validateTour(v4Tour([pageConcept({ diagram: { type: 'mermaid', source: 'flowchart LR\n A --> B', caption: 'c' } }), v2CodeStep('code', 2)]));
  assert.ok(withDiagram.includes('steps[0].diagram is only allowed with body'), withDiagram.join('; '));
});

test('v4 lifts adjacency, last-step, and next-step preparesFor rules', () => {
  const tour = v4Tour([
    pageConcept({ id: 'a', order: 1 }),
    pageConcept({ id: 'b', order: 2 }),
    v2CodeStep('code', 3),
    v2ConceptStep({ id: 'legacy', order: 4, preparesFor: ['code'] }),
    pageConcept({ id: 'z', order: 5 }),
  ]);
  const errors = validateTour(tour);
  assert.ok(!errors.some((e) => /adjacent|last step|immediately following|must reference later/.test(e)), errors.join('; '));
});

test('v4 preparesFor still must name existing code steps', () => {
  const errors = validateTour(v4Tour([pageConcept({ preparesFor: ['ghost'] }), v2CodeStep('code', 2)]));
  assert.ok(errors.some((e) => e.includes('"ghost" is unknown')), errors.join('; '));
  const toConcept = validateTour(v4Tour([pageConcept({ id: 'a', preparesFor: ['b'] }), pageConcept({ id: 'b', order: 2 }), v2CodeStep('code', 3)]));
  assert.ok(toConcept.some((e) => e.includes('not concept "b"')), toConcept.join('; '));
});

test('v4 still rejects code fields on page concepts and still needs a code step', () => {
  const errors = validateTour(v4Tour([pageConcept({ file: 'x.ts' }), v2CodeStep('code', 2)]));
  assert.ok(errors.includes('steps[0].file is not allowed for a concept step'), errors.join('; '));
  assert.ok(validateTour(v4Tour([pageConcept()])).includes('steps must include at least one code step'));
});

test('v4 generated stories have no concept cap and no word bounds', () => {
  const tour = v4Tour([
    pageConcept({ id: 'a', order: 1 }), pageConcept({ id: 'b', order: 2 }),
    v2ConceptStep({ id: 'short', order: 3, body: 'Tiny.', preparesFor: ['code'] }),
    pageConcept({ id: 'd', order: 4 }), v2CodeStep('code', 5),
  ], { mode: 'brief' });
  assert.deepEqual(validateGeneratedConceptSteps(tour), []);
});

test('v3 generated stories keep the concept budget and word bounds', () => {
  const tooMany = { ...v2Tour([
    v2ConceptStep({ id: 'concept-a', body: longPrimerBody, preparesFor: ['code-a'] }),
    v2CodeStep('code-a', 2),
    v2ConceptStep({ id: 'concept-b', order: 3, body: longPrimerBody, preparesFor: ['code-b'] }),
    v2CodeStep('code-b', 4),
  ], { mode: 'brief' }), version: 3 };
  assert.ok(validateGeneratedConceptSteps(tooMany).includes('brief stories can include at most one concept step'));
});

test('generated stories accept version 3 or 4 and moves are allowed in v4', () => {
  const errors = validateGeneratedTour(v4Tour([pageConcept(), v2CodeStep('code', 2)], { mode: 'guided' }));
  assert.ok(!errors.some((e) => e.startsWith('version must')), errors.join('; '));
  assert.ok(validateGeneratedTour({ ...v2Tour([v2CodeStep('code', 1)]), mode: 'guided' }).includes('version must be 3 or 4 for a generated story'));
  const moves = validateTour(v4Tour([v2CodeStep('code', 1, { moves: [] })]));
  assert.ok(!moves.some((e) => e.includes('require story version 3')), moves.join('; '));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run build && node --test test/tour.test.mjs`
Expected: the new tests FAIL (`version must be 1, 2, or 3`, missing `page` errors, etc.).

- [ ] **Step 3: Update `src/types.ts`**

Replace the scene-layout union (lines ~22-27) with:

```ts
export type StoryStepSceneLayout =
  | 'concept-document'
  | 'concept-diagram'
  | 'concept-page'
  | 'code-focus'
  | 'logic-move'
  | 'paired-code';
```

Replace `ConceptTourStep` (lines ~291-304) with:

```ts
/** A short document stop that teaches a mental model before dependent code. */
export interface LegacyConceptTourStep extends TourStepBase {
  kind: 'concept';
  /**
   * Block-tier narrative HTML: paragraphs, h2-h4, lists, quotes, `pre`, tables,
   * and definition lists. See docs/story-schema.md for the allowlist.
   */
  body: string;
  /** Later code-step ids this primer exists to prepare the reviewer for. */
  preparesFor: string[];
  /** At most one optional local Mermaid diagram. */
  diagram?: ConceptDiagram;
  page?: never;
  narration?: never;
}

/**
 * A v4 concept stop the author builds as a whole HTML page. The app never parses
 * it: the page is served from its own endpoint into a sandboxed iframe.
 */
export interface PageConceptTourStep extends TourStepBase {
  kind: 'concept';
  /** A complete HTML document. Any markup, script, or CDN resource. */
  page: string;
  /** Plain text Aloud speaks and screen readers announce for the page. */
  narration: string;
  /** Optional later code-step ids this page prepares the reviewer for. */
  preparesFor?: string[];
  body?: never;
  diagram?: never;
}

export type ConceptTourStep = LegacyConceptTourStep | PageConceptTourStep;
```

After `isCodeStep`, add:

```ts
export function isPageConcept(step: TourStep): step is PageConceptTourStep {
  return step.kind === 'concept' && typeof (step as PageConceptTourStep).page === 'string';
}
```

Change `Tour.version` to `version: 1 | 2 | 3 | 4;` and its doc comment to `/** v1 code-only; v2 concepts; v3 semantic moves; v4 page concepts and free concept placement. */`.

- [ ] **Step 4: Update `src/tour.ts`**

4a. `validateMoves`: replace `if (storyVersion !== 3)` with `if (storyVersion !== 3 && storyVersion !== 4)` and message `` `${where}.moves and pairedView require story version 3 or 4` ``. Update any existing test in `test/tour.test.mjs` that asserts the old message to the new text.

4b. Replace `validateConceptStep` with:

```ts
function validateConceptStep(
  step: Record<string, unknown>,
  where: string,
  storyVersion: unknown,
  errors: string[],
): void {
  const isPage = step.page !== undefined;
  if (isPage && step.body !== undefined)
    errors.push(`${where} concept step takes either page or body, not both`);
  if (isPage) {
    if (storyVersion !== 4)
      errors.push(`${where}.page requires story version 4`);
    // The page is the author's own document. It is served into a sandbox and
    // never parsed here, so the only check is that there is something to serve.
    if (typeof step.page !== "string" || !step.page.trim())
      errors.push(`${where}.page must be a non-empty string`);
    if (isBlankNarrative(step.narration))
      errors.push(`${where}.narration is required`);
    validateNarrative(step.narration, `${where}.narration`, "text", errors);
    if (step.diagram !== undefined)
      errors.push(`${where}.diagram is only allowed with body`);
  } else {
    if (isBlankNarrative(step.body)) errors.push(`${where}.body is required`);
    // The one block-tier field in the whole story: headings, lists, tables, code.
    validateNarrative(step.body, `${where}.body`, "block", errors);
    if (step.narration !== undefined)
      errors.push(`${where}.narration is only allowed with page`);
    validateConceptDiagram(step.diagram, where, errors);
  }
  validateStringArray(step.preparesFor, `${where}.preparesFor`, errors, {
    required: storyVersion !== 4,
    nonEmpty: true,
  });
  if (Array.isArray(step.preparesFor)) {
    const refs = step.preparesFor.filter(
      (ref): ref is string => typeof ref === "string",
    );
    if (new Set(refs).size !== refs.length)
      errors.push(`${where}.preparesFor must not contain duplicate step ids`);
  }
  for (const field of CONCEPT_CODE_FIELDS) {
    if (step[field] !== undefined)
      errors.push(`${where}.${field} is not allowed for a concept step`);
  }
}
```

`validateStringArray` returns early on `undefined` when `required` is false, so this keeps `preparesFor` optional in v4 and required in v2/v3, while a present-but-empty array still errors.

4c. Version check (~line 1137):

```ts
  if (t.version !== 1 && t.version !== 2 && t.version !== 3 && t.version !== 4)
    errors.push("version must be 1, 2, 3, or 4");
```

Update the existing test asserting `"version must be 1, 2, or 3"` to the new message.

4d. Concept branch in the step loop (~line 1234):

```ts
    if (stepKind === "concept") {
      if (t.version !== 2 && t.version !== 3 && t.version !== 4)
        errors.push(`${where}.kind "concept" requires story version 2, 3, or 4`);
      validateConceptStep(step, where, t.version, errors);
    } else {
```

Update the existing v1 test that asserts the old `requires story version 2 or 3` message.

4e. Reading-path loop (~line 1264): wrap only the placement checks so v4 skips them; keep the reference checks for every version:

```ts
    if (step.kind === "concept") {
      const refs = Array.isArray(step.preparesFor)
        ? step.preparesFor.filter(
            (ref): ref is string => typeof ref === "string",
          )
        : [];
      // v4 hands placement to the author: concepts may sit back to back, open
      // or close the story, and stand alone. Earlier versions keep their rules.
      if (t.version !== 4) {
        const next = readingPath[pathIndex + 1]?.step;
        if (!next || typeof next !== "object" || next === null) {
          errors.push(`steps[${i}] concept step cannot be the last step`);
        } else if ((next as Record<string, unknown>).kind === "concept") {
          errors.push(`steps[${i}] concept steps cannot be adjacent`);
        } else if (
          typeof (next as Record<string, unknown>).id === "string" &&
          !refs.includes((next as Record<string, unknown>).id as string)
        ) {
          errors.push(
            `steps[${i}].preparesFor must include the immediately following code step`,
          );
        }
      }
      for (const ref of refs) {
        const target = stepsById.get(ref);
        if (!target) {
          errors.push(
            `steps[${i}].preparesFor must reference a known later code step; "${ref}" is unknown`,
          );
          continue;
        }
        if (target.kind === "concept") {
          errors.push(
            `steps[${i}].preparesFor must reference later code steps, not concept "${ref}"`,
          );
        }
        if (
          t.version !== 4 &&
          typeof step.order === "number" &&
          typeof target.order === "number" &&
          target.order <= step.order
        ) {
          errors.push(
            `steps[${i}].preparesFor must reference later code steps`,
          );
        }
      }
      return;
    }
```

4f. `validateGeneratedConceptSteps`: return early for v4, right after the `if (!concepts.length) return errors;` line:

```ts
  // v4 stories are free: no per-mode cap and no word bounds on any concept.
  if (tour.version === 4) return errors;
```

4g. `validateGeneratedTour`:

```ts
  if (tour.version !== 3 && tour.version !== 4)
    errors.push("version must be 3 or 4 for a generated story");
```

Update existing tests asserting `"version must be 3 for a generated story"`.

4h. `src/story-check.ts:103`: change `tour.version === 3 ?` to `tour.version >= 3 ?`.

- [ ] **Step 5: Fix type fallout**

Run: `npx tsc --noEmit`
Expected errors in `src/view-model.ts` (`step.body`, `step.preparesFor` possibly undefined) and `src/story-lint.ts` (`step.body`). Make them compile minimally now. In `view-model.ts` `buildConceptStep`, use `(step.preparesFor ?? [])`. In `story-lint.ts`, use `plainText(step.body ?? step.narration ?? "")` in `chapter-seam`. Tasks 2 and 5 finish these properly.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build && node --test test/tour.test.mjs test/story-check.test.mjs test/generate-finish.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run build
git add src/types.ts src/tour.ts src/story-check.ts src/view-model.ts src/story-lint.ts test/tour.test.mjs dist skills/diffstory-storyteller/scripts/check-story.mjs
git commit -m "feat: story v4 accepts free HTML page concepts"
```

---

### Task 2: View model, scene layout, and narration speech

**Files:**
- Modify: `src/story-scenes.ts`
- Modify: `src/view-model.ts:236-250` (`ConceptStepView`), `src/view-model.ts:715-740` (`buildConceptStep`)
- Modify: `src/render.ts:437-445` (`conceptSpeechText`)
- Test: `test/story-scenes.test.mjs`, `test/view-model.test.mjs`

**Interfaces:**
- Consumes: `PageConceptTourStep`, `isPageConcept` from Task 1.
- Produces:
  ```ts
  // story-scenes.ts
  export type StoryStepSceneFacts =
    | { kind: 'concept'; hasDiagram: boolean; hasPage?: boolean }
    | { kind: 'code'; hasMoves: boolean; paired: boolean };
  // view-model.ts
  export interface ConceptStepView extends StepViewBase {
    kind: 'concept';
    body?: Narrative;          // legacy only
    diagram?: ConceptDiagramView;
    /** True for a v4 page concept; the page itself never enters the view model. */
    hasPage: boolean;
    narration?: Narrative;     // page concepts only
    preparesFor: Array<{ id: string; order: number; title: Narrative }>;
  }
  ```

- [ ] **Step 1: Write the failing tests**

In `test/story-scenes.test.mjs`, add:

```js
test('page concepts project to the concept-page scene', () => {
  assert.equal(projectStoryStepScene({ kind: 'concept', hasDiagram: false, hasPage: true }), 'concept-page');
  assert.equal(projectStoryStepScene({ kind: 'concept', hasDiagram: true }), 'concept-diagram');
});
```

(Use the import already at the top of that file. If it imports from `../dist/story-scenes.js`, `projectStoryStepScene` is available.)

In `test/view-model.test.mjs`, find the existing concept-step test and follow its setup (`buildReviewModel(repo, tour, files, head, opts)`). Add a v4 story with a page concept and assert:

```js
  const concept = model.steps.find((s) => s.kind === 'concept');
  assert.equal(concept.hasPage, true);
  assert.equal(concept.sceneLayout, 'concept-page');
  assert.equal(concept.narration.text, 'Drag the price and watch the margin line cross the liquidation threshold.');
  assert.equal(concept.body, undefined);
  assert.doesNotMatch(JSON.stringify(model), /cdn\.jsdelivr/, 'the page HTML never enters the view model');
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && node --test test/story-scenes.test.mjs test/view-model.test.mjs`
Expected: FAIL (`concept-diagram`/`concept-document` returned, `hasPage` undefined).

- [ ] **Step 3: Implement**

`src/story-scenes.ts`:

```ts
export type StoryStepSceneFacts =
  | { kind: 'concept'; hasDiagram: boolean; hasPage?: boolean }
  | { kind: 'code'; hasMoves: boolean; paired: boolean };

export function projectStoryStepScene(facts: StoryStepSceneFacts): StoryStepSceneLayout {
  if (facts.kind === 'concept') {
    if (facts.hasPage) return 'concept-page';
    return facts.hasDiagram ? 'concept-diagram' : 'concept-document';
  }
  if (facts.paired) return 'paired-code';
  if (facts.hasMoves) return 'logic-move';
  return 'code-focus';
}
```

`src/view-model.ts`: update `ConceptStepView` as in Interfaces, then `buildConceptStep`:

```ts
function buildConceptStep(step: ConceptTourStep, byId: Map<string, TourStep>): ConceptStepView {
  const hasPage = isPageConcept(step);
  return {
    id: step.id,
    order: step.order,
    title: narrative(step.title, 'inline'),
    chapter: chapterLabel(step),
    kind: 'concept',
    kindLabel: STEP_KIND_LABEL.concept,
    sceneLayout: projectStoryStepScene({ kind: 'concept', hasDiagram: step.diagram !== undefined, hasPage }),
    tags: (step.tags ?? []).map((tag) => narrativeText(tag)),
    hasPage,
    // The page itself stays on disk: only the concept-page endpoint serves it.
    narration: hasPage ? narrative(step.narration, 'text') : undefined,
    body: hasPage ? undefined : narrative(step.body, 'block'),
    diagram: step.diagram
      ? {
          type: step.diagram.type,
          // The Mermaid source is not narrative: tour.ts validates it against its
          // own pattern list and the client parses it, so it stays verbatim.
          source: step.diagram.source,
          caption: narrative(step.diagram.caption, 'inline'),
        }
      : undefined,
    preparesFor: (step.preparesFor ?? [])
      .map((id) => byId.get(id))
      .filter((target): target is CodeTourStep => !!target && isCodeStep(target))
      .map((target) => ({ id: target.id, order: target.order, title: narrative(target.title, 'inline') }))
      .sort((a, b) => a.order - b.order),
  };
}
```

Import `isPageConcept` from `./types.js`. `narrative(input, 'text')` is an existing tier.

`src/render.ts` `conceptSpeechText`:

```ts
function conceptSpeechText(s: ConceptStepView): string {
  return [s.title.speech, s.narration?.speech, s.body?.speech, s.diagram?.caption.speech]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .map(endsSentence)
    .join(" ")
    .trim();
}
```

Also in `conceptStepPanel`, change `${s.body.html}` to `${s.body?.html ?? ""}` so it compiles. Task 3 replaces the page branch.

- [ ] **Step 4: Run to verify pass**

Run: `npm run build && node --test test/story-scenes.test.mjs test/view-model.test.mjs test/review-page.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run build
git add src/story-scenes.ts src/view-model.ts src/render.ts test/story-scenes.test.mjs test/view-model.test.mjs dist skills/diffstory-storyteller/scripts/check-story.mjs
git commit -m "feat: project page concepts into the concept-page scene"
```

---

### Task 3: Step panel renders a sandboxed frame

**Files:**
- Modify: `src/render.ts:374-418` (`conceptStepPanel`)
- Modify: `client/surfaces/review/review.css` (after the `concept-diagram` rules, ~line 1230)
- Test: `test/review-page.test.mjs`

**Interfaces:**
- Consumes: `ConceptStepView.hasPage`, `.narration` (Task 2).
- Produces markup contract the engine (Task 5) relies on:
  ```html
  <figure class="ds-concept-page" data-concept-page>
    <button type="button" class="ds-concept-page-fullscreen" data-concept-page-fullscreen aria-label="Open page fullscreen" title="Open page fullscreen">…</button>
    <span class="ds-concept-page-loading">Loading the mental model…</span>
    <iframe class="ds-concept-page-frame" data-concept-frame data-concept-index="N" sandbox="allow-scripts" allow="fullscreen" title="…narration text…" loading="lazy"></iframe>
  </figure>
  ```
  `N` is the 1-based panel index (same as `data-step-panel`). The iframe has **no `src`**; the engine sets it.

- [ ] **Step 1: Write the failing test**

In `test/review-page.test.mjs`, follow the existing step-panel fetch pattern (line ~297: write `.diffstory/story.json`, fetch the review route, read `payload.pageToken`, fetch `/api/review/step-panel?index=1&page=…`). Add a test with a v4 story whose first step is the `pageConcept()` fixture from Task 1 (copy the object literal) followed by a changed code step, and assert:

```js
    const panel = await (await fetch(`${base}/api/review/step-panel?index=1&page=${encodeURIComponent(payload.pageToken)}`)).text();
    assert.match(panel, /data-scene-layout="concept-page"/);
    assert.match(panel, /<iframe[^>]*sandbox="allow-scripts"[^>]*>/);
    assert.doesNotMatch(panel, /allow-same-origin|allow-top-navigation|allow-popups|allow-forms/);
    assert.match(panel, /data-concept-frame data-concept-index="1"/);
    assert.doesNotMatch(panel, /<iframe[^>]*\ssrc=/, 'the engine sets src; the panel never does');
    assert.doesNotMatch(panel, /cdn\.jsdelivr|d3\.select/, 'the page HTML never ships inside the panel');
    assert.match(panel, /data-speech-concept>How margin moves with price\. Drag the price/);
```

Add a second assertion block for a v3 story with a legacy concept (reuse an existing fixture in that file if one exists) proving `ds-concept-body` and no `<iframe` are still emitted.

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && node --test test/review-page.test.mjs`
Expected: FAIL (no iframe).

- [ ] **Step 3: Implement the panel branch**

At the top of `conceptStepPanel`, before the diagram code, add:

```ts
  if (s.hasPage) return conceptPagePanel(s, i);
```

Add below `conceptStepPanel`:

```ts
/**
 * A v4 page concept: the author's HTML runs in an opaque-origin sandbox the
 * engine points at /api/review/concept-page. The panel carries no page bytes.
 */
function conceptPagePanel(s: ConceptStepView, i: number): string {
  const speech = conceptSpeechText(s);
  return `<section class="ds-step ds-concept-step" data-step-panel="${i + 1}" data-step-id="${esc(s.id)}" data-scene-layout="${esc(s.sceneLayout)}" hidden>
    <article class="ds-concept-page-stage" aria-labelledby="ds-concept-title-${i + 1}">
      <div class="ds-concept-heading">
        <span class="ds-concept-eyebrow"><span aria-hidden="true">◇</span> Mental model</span>
        <h1 class="ds-concept-title" id="ds-concept-title-${i + 1}">${s.title.html}</h1>
      </div>
      <figure class="ds-concept-page" data-concept-page>
        <button type="button" class="ds-concept-page-fullscreen" data-concept-page-fullscreen aria-label="Open page fullscreen" title="Open page fullscreen">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
        </button>
        <span class="ds-concept-page-loading">Loading the mental model…</span>
        <iframe class="ds-concept-page-frame" data-concept-frame data-concept-index="${i + 1}" sandbox="allow-scripts" allow="fullscreen" title="${esc(s.narration?.text ?? s.title.text)}" loading="lazy"></iframe>
      </figure>
      <span class="ds-sr-only" data-speech-concept>${esc(speech)}</span>
    </article>
  </section>`;
}
```

- [ ] **Step 4: Add styles** to `client/surfaces/review/review.css`, after the `concept-diagram` block. Use the existing tokens (`--line`, `--surface`, `--text-3`, `--radius`, `--motion-duration-ui`, `--motion-ease-out`), not raw values:

```css
.ds-step[data-scene-layout="concept-page"]{display:flex;flex-direction:column;min-height:0}
.ds-concept-page-stage{flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;padding:18px 28px 24px}
.ds-concept-page-stage .ds-concept-title{margin:0}
.ds-concept-page{position:relative;flex:1;min-height:0;margin:0;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);overflow:hidden}
.ds-concept-page-frame{display:block;width:100%;height:100%;border:0;background:transparent;opacity:0}
.ds-concept-page.is-loaded .ds-concept-page-frame{opacity:1}
.ds-concept-page-loading{position:absolute;inset:0;display:grid;place-items:center;color:var(--text-3)}
.ds-concept-page.is-loaded .ds-concept-page-loading{display:none}
.ds-concept-page-fullscreen{position:absolute;top:10px;right:10px;z-index:1;width:32px;height:32px;display:grid;place-items:center;padding:0;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--text-3)}
.ds-concept-page-fullscreen svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
@media (prefers-reduced-motion:no-preference){.ds-concept-page-frame{transition:opacity var(--motion-duration-ui) var(--motion-ease-out)}}
```

If any token name above does not exist in `client/generated/theme.css`, substitute the nearest existing one used by `.ds-concept-diagram`.

- [ ] **Step 5: Run to verify pass**

Run: `npm run build && node --test test/review-page.test.mjs test/client-assets.test.mjs test/ui-layout-regressions.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/render.ts client/surfaces/review/review.css test/review-page.test.mjs dist skills/diffstory-storyteller/scripts/check-story.mjs
git commit -m "feat: render page concepts as a sandboxed frame"
```

---

### Task 4: Concept-page endpoint, shim, and CSP

**Files:**
- Create: `src/concept-page.ts`
- Modify: `src/server.ts:464-485` (`setLocalResponseHeaders`), route table near `/api/review/step-panel` (~line 955)
- Test: `test/concept-page.test.mjs` (new, unit), `test/app-server.test.mjs` (HTTP)

**Interfaces:**
- Produces:
  ```ts
  // src/concept-page.ts
  export type ConceptPageTheme = 'light' | 'dark';
  export const CONCEPT_PAGE_CSP: string;
  export function conceptPageDocument(page: string, theme: ConceptPageTheme): string;
  ```
- Route: `GET /api/review/concept-page?page=<lease>&index=<1-based>&theme=<light|dark>` → 200 `text/html` page, or 404 JSON `{ error }` for a non-page step, or 409 for a dead lease.
- postMessage protocol (Task 5 consumes):
  - page → parent: `{ type: 'diffstory:key', key, code, shiftKey, altKey, ctrlKey, metaKey, repeat }`
  - parent → page: `{ type: 'diffstory:theme', theme: 'light' | 'dark' }`

- [ ] **Step 1: Write the failing unit tests** — `test/concept-page.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conceptPageDocument, CONCEPT_PAGE_CSP } from '../dist/concept-page.js';

test('the shim goes first inside <head>, before any author markup', () => {
  const html = conceptPageDocument('<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \'self\'"><script>var mine=1</script></head><body>x</body></html>', 'dark');
  const shim = html.indexOf('data-diffstory-shim');
  assert.ok(shim > -1);
  assert.ok(shim < html.indexOf('http-equiv'), 'the shim precedes the author CSP meta');
  assert.ok(shim < html.indexOf('var mine'), 'and the author script');
  assert.match(html, /<html[^>]*data-ds-theme="dark"|setAttribute\('data-ds-theme'/);
});

test('a fragment with no <head> still gets the shim prepended', () => {
  const html = conceptPageDocument('<svg><circle r="4"/></svg>', 'light');
  assert.ok(html.indexOf('data-diffstory-shim') < html.indexOf('<svg>'));
});

test('an uppercase or attributed <HEAD> is found', () => {
  const html = conceptPageDocument('<HTML><HEAD lang="en"><TITLE>t</TITLE></HEAD><BODY></BODY></HTML>', 'light');
  assert.ok(html.indexOf('data-diffstory-shim') > html.indexOf('<HEAD lang="en">'));
  assert.ok(html.indexOf('data-diffstory-shim') < html.indexOf('<TITLE>'));
});

test('the shim skips text entry and handled keys and only trusts its parent', () => {
  const html = conceptPageDocument('<p>x</p>', 'light');
  assert.match(html, /defaultPrevented/);
  assert.match(html, /isContentEditable/);
  assert.match(html, /INPUT|TEXTAREA|SELECT/);
  assert.match(html, /e\.source!==parent|e\.source !== parent/);
  assert.match(html, /diffstory:key/);
  assert.match(html, /diffstory:theme/);
});

test('theme tokens are optional variables authors can override', () => {
  const html = conceptPageDocument('<p>x</p>', 'dark');
  assert.match(html, /--ds-accent:/);
  assert.match(html, /:root\[data-ds-theme="light"\]/);
});

test('the page CSP is permissive but only frameable by diffStory', () => {
  assert.match(CONCEPT_PAGE_CSP, /default-src \* data: blob: 'unsafe-inline' 'unsafe-eval'/);
  assert.match(CONCEPT_PAGE_CSP, /frame-ancestors 'self'/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && node --test test/concept-page.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/concept-page.ts`**

```ts
// Assemble a v4 concept page for its sandboxed frame. The author's HTML is
// passed through untouched; the only additions are a tiny shim, placed before
// any author markup, that forwards story keys to the app and follows the app's
// theme, and a set of optional color variables authors may use or ignore.
//
// Isolation does not come from here. It comes from the iframe sandbox (opaque
// origin, no navigation, no popups) and from the server refusing every request
// that is not same-origin. This module only keeps the page pleasant to use.

export type ConceptPageTheme = 'light' | 'dark';

/** Anything the author wants to load, run, or fetch, and only diffStory may frame it. */
export const CONCEPT_PAGE_CSP =
  "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'";

// Values mirror client/generated/theme.css so a page that opts in matches the app.
const TOKENS = `:root{--ds-bg:#0a0c0f;--ds-surface:#14171c;--ds-text:#eef1f5;--ds-text-2:#ccd1d9;--ds-text-3:#b1b9c6;--ds-line:rgba(190,205,225,.11);--ds-accent:#49b7ff;--ds-add:#3ddc97;--ds-del:#ff6b62}
:root[data-ds-theme="light"]{--ds-bg:#edf0f4;--ds-surface:#ffffff;--ds-text:#14171c;--ds-text-2:#4f5967;--ds-text-3:#5f6976;--ds-line:rgba(20,30,45,.12);--ds-accent:#0072d6;--ds-add:#178a52;--ds-del:#d2372e}`;

function shim(theme: ConceptPageTheme): string {
  return `<style data-diffstory-shim>${TOKENS}</style><script data-diffstory-shim>(function(){
var root=document.documentElement;root.setAttribute('data-ds-theme',${JSON.stringify(theme)});
function typing(t){if(!t)return false;if(t.isContentEditable)return true;var n=t.tagName;return n==='INPUT'||n==='TEXTAREA'||n==='SELECT';}
window.addEventListener('keydown',function(e){if(e.defaultPrevented||e.isComposing||typing(e.target))return;
parent.postMessage({type:'diffstory:key',key:e.key,code:e.code,shiftKey:e.shiftKey,altKey:e.altKey,ctrlKey:e.ctrlKey,metaKey:e.metaKey,repeat:e.repeat},'*');});
window.addEventListener('message',function(e){if(e.source!==parent)return;var d=e.data;if(d&&d.type==='diffstory:theme'&&(d.theme==='light'||d.theme==='dark'))root.setAttribute('data-ds-theme',d.theme);});
})();</script>`;
}

const HEAD_OPEN = /<head(?:\s[^>]*)?>/i;

/** The author's page with the shim injected first inside <head>, or prepended. */
export function conceptPageDocument(page: string, theme: ConceptPageTheme): string {
  const injected = shim(theme);
  const head = HEAD_OPEN.exec(page);
  if (!head) return injected + page;
  const at = head.index + head[0].length;
  return page.slice(0, at) + injected + page.slice(at);
}
```

The parent-bound `postMessage` target is `'*'` because the parent's origin is not visible from an opaque origin. The payload is key metadata only.

- [ ] **Step 4: Run unit tests to verify pass**

Run: `npm run build && node --test test/concept-page.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write the failing HTTP tests** — in `test/app-server.test.mjs`, add (reuse `gitRepo`, `boot`, `reviewPageToken`, `leased`):

```js
test('concept pages are served into a sandbox with their own policy', async () => {
  const repo = gitRepo();
  writeFileSync(join(repo, 'README.md'), '# changed\n');
  mkdirSync(join(repo, '.diffstory'), { recursive: true });
  writeFileSync(join(repo, '.diffstory', 'story.json'), `${JSON.stringify({
    version: 4, title: 'Page story', summary: 'A page concept first.', base: 'HEAD',
    steps: [
      { id: 'page', order: 1, title: 'How it moves', kind: 'concept',
        page: '<html><head><title>t</title></head><body><script src="https://cdn.jsdelivr.net/npm/d3@7"></script></body></html>',
        narration: 'Watch the line move.' },
      { id: 'code', order: 2, title: 'Readme', kind: 'changed', file: 'README.md', range: [1, 1], why: 'The heading changed.' },
    ],
  }, null, 2)}\n`);
  const { server, base } = await boot(repo);
  try {
    const route = `/repo/${encodeURIComponent(basename(repo))}/review?story=story.json`;
    const pageHtml = await (await fetch(`${base}${route}`)).text();
    const token = reviewPageToken(pageHtml);

    const app = await fetch(`${base}${route}`);
    assert.match(app.headers.get('content-security-policy') ?? '', /frame-src 'self'/);
    assert.match(app.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);

    const res = await fetch(leased(`${base}/api/review/concept-page?index=1&theme=dark`, token));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-frame-options'), null);
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src \* data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.text();
    assert.match(body, /data-diffstory-shim/);
    assert.match(body, /cdn\.jsdelivr\.net\/npm\/d3@7/);
    assert.match(body, /data-ds-theme',"dark"/);

    const code = await fetch(leased(`${base}/api/review/concept-page?index=2`, token));
    assert.equal(code.status, 404, 'code steps have no page');
    const stale = await fetch(leased(`${base}/api/review/concept-page?index=1`, 'not-a-real-token'));
    assert.equal(stale.status, 409);

    // The sandboxed page has an opaque origin. Its requests reach the app as
    // Origin: null / cross-site and must be refused before any route runs.
    for (const path of ['/api/comments', '/api/fs?path=/', `/api/review/concept-page?index=1&page=${encodeURIComponent(token)}`]) {
      const hostile = await fetch(`${base}${path}`, { headers: { origin: 'null', 'sec-fetch-site': 'cross-site' } });
      assert.equal(hostile.status, 403, `${path} refuses the sandboxed page`);
      assert.equal(hostile.headers.get('access-control-allow-origin'), null);
    }
    const hostileWrite = await fetch(`${base}/api/repo/close`, { method: 'POST', headers: { origin: 'null' } });
    assert.equal(hostileWrite.status, 403);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
  }
});
```

`/api/fs` is the directory-browse route (`src/server.ts:794`). Also update the existing assertion at `test/app-server.test.mjs:713` only if it breaks; `frame-ancestors 'none'` stays in the app CSP.

- [ ] **Step 6: Run to verify failure**

Run: `npm run build && node --test test/app-server.test.mjs`
Expected: the new test FAILs (no `frame-src`, 404/403 on the route).

- [ ] **Step 7: Implement in `src/server.ts`**

7a. In `setLocalResponseHeaders`, add `"frame-src 'self'",` after `"form-action 'self'",`.

7b. Import at the top: `import { CONCEPT_PAGE_CSP, conceptPageDocument } from "./concept-page.js";` and add `isPageConcept` to the existing `./types.js` import.

7c. Next to the `/api/review/step-panel` route, add:

```ts
    if (method === "GET" && url.pathname === "/api/review/concept-page") {
      const page = validateReviewPageLease(
        session,
        url.searchParams.get("page"),
      );
      if (!page.ok) return sendReviewPageConflict(res, page.error);
      const index = Number.parseInt(url.searchParams.get("index") ?? "", 10);
      const step =
        !page.storyless && Number.isInteger(index) && index >= 1
          ? orderedSteps(page.tour)[index - 1]
          : undefined;
      if (!step || !isPageConcept(step))
        return sendJson(res, 404, { error: "This step has no concept page." });
      const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
      // The author's page runs in an opaque-origin sandbox, so it gets its own
      // permissive policy. diffStory is the only document allowed to frame it.
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", CONCEPT_PAGE_CSP);
      return sendLeasedHtml(res, session, page, conceptPageDocument(step.page, theme));
    }
```

`page` here is the `ReviewPageLeaseResult` with `ok: true`; follow exactly how the step-panel route narrows it (it passes `page` straight to `sendLeasedHtml`, so the narrowed type already has `.tour` and `.storyless`). `sendHtml` already sets `Cache-Control: no-store`.

- [ ] **Step 8: Run to verify pass**

Run: `npm run build && node --test test/app-server.test.mjs test/concept-page.test.mjs test/client-assets.test.mjs test/fs-browse.test.mjs`
Expected: PASS. If a hostile request returns something other than 403, stop and report it. That would be a real isolation gap, not a test to loosen.

- [ ] **Step 9: Commit**

```bash
npm run build
git add src/concept-page.ts src/server.ts test/concept-page.test.mjs test/app-server.test.mjs dist skills/diffstory-storyteller/scripts/check-story.mjs
git commit -m "feat: serve concept pages from a sandboxed endpoint"
```

---

### Task 5: Review engine mounts frames, forwards keys, syncs theme

**Files:**
- Modify: `client/surfaces/review/engine/review-engine.js` — near `renderConceptDiagrams` (~line 467), `loadStoryStep` success path (~line 976), the eager-panel call site (~line 1037), startup listeners (~line 3990), `onClick` delegated branches
- Test: `test/concept-page-engine.test.mjs` (new; source-level assertions in the style of `test/motion-regressions.test.mjs`)

**Interfaces:**
- Consumes: markup from Task 3 (`[data-concept-frame]`, `data-concept-index`, `[data-concept-page]`, `[data-concept-page-fullscreen]`); route and message protocol from Task 4; existing `reviewPageUrl(path)`, `onKey(e)`, `$all`, `closest`.
- Produces: `mountConceptPages(panel)`, `onConceptFrameMessage(e)`, `syncConceptPageTheme()`.

- [ ] **Step 1: Write the failing test** — `test/concept-page-engine.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const engine = readFileSync(new URL('../client/surfaces/review/engine/review-engine.js', import.meta.url), 'utf8');

test('the engine points concept frames at the leased page endpoint with the theme', () => {
  assert.match(engine, /function mountConceptPages\(panel\)/);
  assert.match(engine, /reviewPageUrl\('\/api\/review\/concept-page\?index='/);
  assert.match(engine, /mountConceptPages\(fresh\)/, 'lazy panels mount their frame');
});

test('forwarded keys are accepted only from a concept frame window', () => {
  assert.match(engine, /function onConceptFrameMessage\(e\)/);
  assert.match(engine, /contentWindow===e\.source/);
  assert.match(engine, /d\.type!=='diffstory:key'/);
  assert.match(engine, /window\.addEventListener\('message',onConceptFrameMessage\)/);
});

test('theme changes reach every mounted concept frame', () => {
  assert.match(engine, /function syncConceptPageTheme\(\)/);
  assert.match(engine, /type:'diffstory:theme'/);
  assert.match(engine, /attributeFilter:\['data-theme'\]/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/concept-page-engine.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement** — add after `renderConceptDiagrams` (keep the engine's dense style):

```js
  function conceptPageTheme(){return document.documentElement.getAttribute('data-theme')==='light'?'light':'dark';}
  function mountConceptPages(panel){
    $all('[data-concept-frame]',panel).forEach(function(frame){
      if(frame._dsMounted)return;frame._dsMounted=true;
      var figure=closest(frame,'[data-concept-page]');
      frame.addEventListener('load',function(){if(figure)figure.classList.add('is-loaded');});
      frame.src=reviewPageUrl('/api/review/concept-page?index='+encodeURIComponent(frame.getAttribute('data-concept-index')||'')+'&theme='+conceptPageTheme());
    });
  }
  function syncConceptPageTheme(){
    var theme=conceptPageTheme();
    $all('[data-concept-frame]').forEach(function(frame){if(frame.contentWindow)frame.contentWindow.postMessage({type:'diffstory:theme',theme:theme},'*');});
  }
  function onConceptFrameMessage(e){
    var d=e.data;if(!d||d.type!=='diffstory:key'||typeof d.key!=='string')return;
    var frame=null;$all('[data-concept-frame]').forEach(function(f){if(f.contentWindow===e.source)frame=f;});
    if(!frame)return;
    onKey({key:d.key,code:String(d.code||''),shiftKey:!!d.shiftKey,altKey:!!d.altKey,ctrlKey:!!d.ctrlKey,metaKey:!!d.metaKey,repeat:!!d.repeat,isComposing:false,target:frame,defaultPrevented:false,preventDefault:function(){},stopPropagation:function(){}});
  }
```

Read the whole `onKey` body (starts ~line 3775) before wiring this. List every property it reads from `e` and make sure the synthetic event provides each one. If `onKey` calls a helper with `e` that reads more (e.g. `e.target.closest`), `target:frame` is a real element, so DOM methods work.

Wire it in:
- In `loadStoryStep` success, after `renderConceptDiagrams(fresh);` add `mountConceptPages(fresh);`.
- After line ~1037 `if(ap)renderConceptDiagrams(ap);` add `if(ap)mountConceptPages(ap);`, and after line ~492 `renderConceptDiagrams(document.body);` add `mountConceptPages(document.body);`.
- In startup, after `document.addEventListener('keydown',onKey);` add:
  ```js
    window.addEventListener('message',onConceptFrameMessage);
    new MutationObserver(syncConceptPageTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  ```
- In `onClick`, next to the existing Mermaid fullscreen branch (`grep -n "data-mermaid-fullscreen" review-engine.js`), add:
  ```js
    var cpf=closest(t,'[data-concept-page-fullscreen]');if(cpf){var cpfig=closest(cpf,'[data-concept-page]');if(cpfig&&cpfig.requestFullscreen)cpfig.requestFullscreen().catch(function(){});return;}
  ```
  Use the same variable holding the click target that neighboring branches use (`t` in the line-3751 branch).

- [ ] **Step 4: Syntax check and tests**

Run: `node --check client/surfaces/review/engine/review-engine.js && npm run build && node --test test/concept-page-engine.test.mjs test/client-js-xref.test.mjs test/motion-regressions.test.mjs test/review-page.test.mjs`
Expected: PASS. If `client-js-xref` flags a new `data-*` attribute as unknown, add it where that test's allowlist or markup source expects it.

- [ ] **Step 5: Commit**

```bash
npm run build
git add client/surfaces/review/engine/review-engine.js test/concept-page-engine.test.mjs dist
git commit -m "feat: mount concept pages and bridge their keys and theme"
```

---

### Task 6: Lint reads narration; Mermaid lint stays legacy

**Files:**
- Modify: `src/story-lint.ts` — `chapter-seam` opener (~line 413), `lintDiagrams` (~line 528), `narrativeFields` (~line 548)
- Test: `test/story-lint.test.mjs`

Spec deviation, intentional: the spec listed a `narration-markup` lint. Task 1 validates `narration` at the `text` tier, which already rejects markup as a hard error, so a lint would only duplicate it. No new lint rule is added.

- [ ] **Step 1: Write the failing tests** — in `test/story-lint.test.mjs`, follow the file's existing pattern for calling the lint (find how it builds a tour and reads problem ids). Add:

```js
test('page concepts contribute narration, never page HTML, to narrative lints', () => {
  const fields = narrativeFields({
    version: 4, title: 'T', summary: 'S',
    steps: [
      { id: 'p', order: 1, title: 'Model', kind: 'concept', page: '<p>**not prose**</p>', narration: 'Watch the line.' },
      { id: 'c', order: 2, title: 'Code', kind: 'changed', file: 'a.ts', range: [1, 1], why: 'w' },
    ],
  });
  assert.ok(fields.some(([path, text]) => path === 'steps[p].narration' && text === 'Watch the line.'));
  assert.ok(!fields.some(([path]) => path.startsWith('steps[p].page')), 'page HTML is not narrative');
});
```

Import `narrativeFields` from `../dist/story-lint.js` if not already imported.

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && node --test test/story-lint.test.mjs`
Expected: FAIL (no narration field).

- [ ] **Step 3: Implement**

In `narrativeFields`:

```ts
    if (step.kind === "concept") {
      push(`steps[${step.id}].body`, step.body);
      push(`steps[${step.id}].narration`, step.narration);
      push(`steps[${step.id}].diagram.caption`, step.diagram?.caption);
      continue;
    }
```

In the `chapter-seam` opener, make the concept branch read narration first (replacing the Task 1 stopgap):

```ts
        step.kind === "concept"
          ? plainText(step.narration ?? step.body ?? "").slice(0, 220)
          : plainText(step.beats?.[0]?.text ?? "");
```

`lintDiagrams` already guards `!step.diagram`, and page concepts can't carry a diagram, so it needs no change. Confirm with a read.

- [ ] **Step 4: Run to verify pass**

Run: `npm run build && node --test test/story-lint.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run build
git add src/story-lint.ts test/story-lint.test.mjs dist skills/diffstory-storyteller/scripts/check-story.mjs
git commit -m "feat: lint page-concept narration like other prose"
```

---

### Task 7: In-app generation and repair prompts

**Files:**
- Modify: `src/agent.ts:155-180` (generation prompt), `src/agent.ts:255-273` (repair prompt)
- Test: `test/agent.test.mjs`

- [ ] **Step 1: Write the failing test** — in `test/agent.test.mjs`, find the test that builds the generation prompt (search for `set its "version" field`) and the repair prompt, and add assertions using the same builder calls:

```js
  assert.match(prompt, /set its "version" field to 4/);
  assert.match(prompt, /Page concept steps: "id", "order", "title", "kind": "concept", "page", "narration"/);
  assert.doesNotMatch(prompt, /concept-primer budgets/);
  assert.match(repairPrompt, /Upgrade to version 4 whenever the repair adds a page concept/);
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Edit the generation prompt**

- `set its "version" field to 3` → `set its "version" field to 4`.
- In the contract sentence, replace `beats, concept-primer budgets, hotspots,` with `beats, hotspots,`.
- After the `- Every beat: "text" …` line add:
  ```ts
    `- Page concept steps: "id", "order", "title", "kind": "concept", "page", "narration"; optional "preparesFor", "tags", "chapter". "page" is a complete HTML document (any HTML, CSS, SVG, canvas, JavaScript, CDN libraries). "narration" is plain text with no tags. Add as many as teach the change, anywhere in the path.\n` +
  ```
- Replace the `- Concept "body" takes block tags: …` line with:
  ```ts
    `- A legacy concept "body" takes block tags: p, h2-h4, ul, ol, li, blockquote, pre, hr, table, caption, thead, tbody, tr, th, td, dl, dt, dd. New concept steps use "page" instead.\n` +
  ```
- In `- No links, images, SVG, id, or style.` prepend `Outside "page": ` so it reads `- Outside "page": no links, images, SVG, id, or style. …`.

- [ ] **Step 4: Edit the repair prompt**

- The preservation line becomes: `` `- Preserve every unaffected concept step exactly, including its page, narration, body, preparesFor links, diagram, tags, chapter, and position. Concept steps do not claim coverage.\n` ``
- The version line becomes: `` `- Preserve legacy version 1 or 2 when the repair does not add semantic moves. Upgrade to version 2 when a v1 repair introduces a concept primer and to version 3 whenever the repair adds moves or pairedView. Upgrade to version 4 whenever the repair adds a page concept. Preserve version 3 or 4 once present.\n` ``
- In the restricted-HTML line, replace `Concept "body" takes block tags` with `A concept "page" is free HTML; a legacy concept "body" takes block tags`.
- In the validate line, replace `concept body, preparesFor target, id, just-in-time primer position,` with `concept page/narration/body, preparesFor target, id,`.

- [ ] **Step 5: Run to verify pass**

Run: `npm run build && node --test test/agent.test.mjs test/generate-finish.test.mjs`
Expected: the new assertions PASS. Skill-text assertions in `agent.test.mjs` are updated in Task 8; if they are the only failures, proceed.

- [ ] **Step 6: Commit**

```bash
npm run build
git add src/agent.ts test/agent.test.mjs dist
git commit -m "feat: generation and repair prompts write v4 page concepts"
```

---

### Task 8: Rewrite the storyteller skill for concept pages

**Files:**
- Rewrite: `skills/diffstory-storyteller/references/primers.md`
- Modify: `skills/diffstory-storyteller/SKILL.md` (lines ~54, ~63, ~79-84, ~209-231, ~313, ~334, ~412, ~452, ~501)
- Modify: `skills/diffstory-storyteller/references/schema.md` (lines ~12, ~37-38, ~51, the `## Schema` example ~73-140)
- Modify: `skills/diffstory-storyteller/references/audits.md` (lines ~24, ~37-59)
- Modify: `skills/diffstory-storyteller/references/examples.md` if it shows a concept step
- Test: `test/agent.test.mjs` (skill-text tests at lines ~178-215)

- [ ] **Step 1: Update the skill-text tests first**

Replace the two tests at `test/agent.test.mjs` ~lines 178-205 with:

```js
test('bundled diffstory-storyteller skill teaches free concept pages', () => {
  const skill = skillCorpus();
  assert.ok(skill.includes('Concept-gap test'));
  assert.ok(skill.includes('shown than told'));
  assert.ok(skill.includes('concrete instance from this diff'));
  assert.ok(skill.includes('`narration` is what you would say while pointing at the page'));
  assert.ok(skill.includes('`--ds-accent`'));
  assert.ok(skill.includes('data-ds-theme'));
  assert.doesNotMatch(skill, /Never place two concept primers next to each other/);
  assert.doesNotMatch(skill, /Never end the story with a concept primer/);
});

test('bundled diffstory-storyteller skill pins the v4 concept schema and no budgets', () => {
  const skill = skillCorpus();
  const flat = skill.replace(/\s+/g, ' ');
  assert.ok(skill.includes('Newly generated stories use `"version": 4`'));
  assert.doesNotMatch(skill, /at most \d concept primers?/);
  assert.doesNotMatch(skill, /60-180 words/);
  assert.ok(skill.includes('Concept steps never claim diff coverage'));
  assert.ok(flat.includes('must not contain `file`, `range`, `ranges`, `viewport`, `highlights`, `beats`, `why`, `calls`, or `returnsTo`'));
  for (const tag of ['`skim`', '`sweep`', '`mechanical`']) assert.ok(flat.includes(tag));
  assert.ok(skill.includes('Stories longer than 10 steps'));
});
```

Update the `bundled skill schema example is a valid interleaved v3 story` test: rename it to `…v4 story` and change the expected `[order, kind]` list to match the new example in Step 4. Keep both `validateTour` and `validateGeneratedTour` assertions returning `[]`.

- [ ] **Step 2: Run to verify failure**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: FAIL on the skill-text tests.

- [ ] **Step 3: Rewrite `references/primers.md`** with this content:

````markdown
# Concept pages

Part of the diffstory-storyteller skill. Read when a code stop needs a mental
model the reviewer does not have yet.

### 3.75. Test for concept gaps

Run the Concept-gap test before finalizing the path: before each code stop, can
the reviewer explain the terminology, roles, relationships, or state model the
next lines need? When a model lands better shown than told, build a concept
page for it. You decide how many pages the change needs and where they sit.
Pages may open the story, close it, or sit back to back.

- Overview is the whole-change reading map. A concept page is a mental model,
  not a summary of the diff.
- Teach with a concrete instance from this diff, not a generic textbook
  picture: the real function names, the real numbers, the real states.
- Starting ideas, not a menu: an interactive state machine the reviewer steps
  through; an animated money or data flow; a before/after toggle; a worked
  numeric example with sliders (a position's margin as price moves); a
  lifecycle timeline; a table that fills in as you scrub. Build whatever
  teaches best.

### 6.25. Write concept pages

```jsonc
{
  "id": "concept-margin",
  "order": 2,
  "title": "How margin moves with price",
  "kind": "concept",
  "page": "<!doctype html><html><head>…</head><body>…</body></html>",
  "narration": "Drag the price. The margin line falls until it crosses the liquidation threshold, which is the check step 3 moves.",
  "preparesFor": ["s3"],
  "tags": ["mental-model"]
}
```

- `page` is a complete HTML document. Anything goes: HTML, CSS, SVG, canvas,
  JavaScript, and libraries or fonts from a CDN (d3, three.js, Chart.js…).
  It runs in a sandboxed frame that fills the stage, and it cannot reach
  diffStory or the reviewer's files.
- `narration` is what you would say while pointing at the page. Plain text,
  no tags. Aloud reads it and screen readers announce it, so it must make
  sense without seeing the page.
- Optional theming: the frame sets `data-ds-theme="light"` or `"dark"` on
  `<html>` and follows the app's theme live. The variables `--ds-bg`,
  `--ds-surface`, `--ds-text`, `--ds-text-2`, `--ds-text-3`, `--ds-line`,
  `--ds-accent`, `--ds-add`, `--ds-del` match the app's palette. Use them or
  ignore them.
- Arrow keys and story shortcuts pressed inside the page still move the story
  unless the page handles them (`preventDefault()`) or the focus is in an
  input, so claim the keys your page needs.
- `preparesFor` (optional) names code steps the page sets up.
- A concept step must not contain `file`, `range`, `ranges`, `viewport`,
  `highlights`, `beats`, `why`, `calls`, or `returnsTo`, nor legacy `focus`.
  Concept steps never claim diff coverage.
- Older stories carry a text `body` with an optional Mermaid `diagram`
  instead of `page`; keep them intact when repairing. New concept steps use
  `page`.
````

- [ ] **Step 4: Update `references/schema.md`**

- Line ~12: `Newly generated stories use \`"version": 4\`.` (keep the rest of the sentence).
- Lines ~37-38: `` `concept` steps are fileless pages (`page` + `narration`); same rule. ``
- Line ~51 table row: change to `| concept \`body\` (legacy) | …unchanged… |` and add a row `| concept \`page\` | any complete HTML document; never sanitized; runs sandboxed |` and `| concept \`narration\` | plain text, no tags |`.
- In the `## Schema` example: set `"version": 4` and replace the concept step with the Step 3 example object. Fill `page` with a small real document, e.g. `"<!doctype html><html><head><style>body{margin:0;font:14px system-ui;background:var(--ds-bg);color:var(--ds-text)}</style></head><body><input type=\"range\" id=\"p\" min=\"50\" max=\"150\" value=\"100\"><output id=\"m\"></output><script>var p=document.getElementById('p'),m=document.getElementById('m');function f(){m.textContent='margin '+(p.value-60)}p.oninput=f;f()</script></body></html>"`. Keep `preparesFor` pointing at a real later code step in the example. Keep every other step unchanged, then set the expected `[order, kind]` list in the Step 1 test to match.

- [ ] **Step 5: Update `SKILL.md` and `references/audits.md`**

- `SKILL.md` ~63: `"version": 3` → `"version": 4`.
- `SKILL.md` ~79-84: delete the "Concept-primer budgets are hard maxima…" sentence and the three Brief/Guided/Detailed budget bullets. If the sentence carries other mode rules, keep those.
- `SKILL.md` ~54: `` `concept` steps never claim coverage `` stays. Change the wording elsewhere from "concept primer" to "concept page" where it describes new stories (~209-210, ~231, ~313, ~412). At ~334 replace `Concept primers use \`body\` instead.` with `Concept pages use \`page\` and \`narration\` instead.` At ~501 change `Don't add primers as a glossary` to `Don't add concept pages as a glossary`.
- `audits.md` ~37: "read concept bodies and code beats" → "read concept narrations and code beats". ~43-44: replace the Primer placement test bullet with `- Page test: each concept page teaches one model with a concrete instance from this diff, and its narration makes sense without the page.` ~49: "concept bodies" → "concept narrations".
- Search the whole skill folder for leftovers: `grep -rn -i "60-180\|at most [0-9] concept\|adjacent\|end the story with" skills/diffstory-storyteller` and fix each hit that describes concept placement or budgets.

- [ ] **Step 6: Run to verify pass**

Run: `npm run build && node --test test/agent.test.mjs test/install-skills.test.mjs test/story-modules.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run build
git add skills/diffstory-storyteller test/agent.test.mjs dist
git commit -m "feat: storyteller skill authors free concept pages"
```

---

### Task 9: Eval, docs, changelog, full suite, and a real browser pass

**Files:**
- Modify: `scripts/eval-stories.mjs:499` (prose extraction), `:599` (rubric wording)
- Modify: `docs/story-schema.md`
- Modify: `CHANGELOG.md`
- Create: `examples/concept-page-story.json` (browser fixture; delete before commit if the repo keeps no such fixtures, see Step 5)

- [ ] **Step 1: Eval**

At `scripts/eval-stories.mjs:499`, next to `add(\`steps[${i}].body\`, s.body);` add `add(\`steps[${i}].narration\`, s.narration);`. At line ~599, change `'Read only titles, concept bodies, and beats'` to `'Read only titles, concept bodies or narrations, and beats'`. Run `node --test test/eval-cases.test.mjs` → PASS.

- [ ] **Step 2: Docs**

In `docs/story-schema.md`:
- Line ~25 version list: add `` `4` permits page concepts and lifts concept placement rules. ``
- The field table (~line 42): add rows for `steps[].page` ("a complete HTML document; any HTML, CSS, JS, CDN resources; served sandboxed, never sanitized") and `steps[].narration` ("plain text Aloud reads for a page concept"), and mark `steps[].body` as legacy.
- Line ~236: scope the 60–180 word rule to "v2–v3 generated stories".
- Add a short section **Concept pages and privacy**: "A page concept runs in an iframe with `sandbox=\"allow-scripts\"` and an opaque origin. It cannot read diffStory's storage, call its API, or navigate the app. Because pages may load resources from any URL, opening a story can make your browser contact servers its author chose, revealing your IP address and that the story was opened."

`CHANGELOG.md`: under the unreleased section (create `## Unreleased` if absent), add:
`- Story format v4: concept steps can be free HTML pages (JavaScript and CDN libraries allowed) rendered in a sandboxed frame, with no cap on how many or where they sit.`

- [ ] **Step 3: Full suite**

Run: `npm test`
Expected: all tests PASS. Fix any failures that reference the old concept messages by updating the assertion to the new behavior. Do not loosen isolation assertions.

- [ ] **Step 4: Typecheck the client**

Run: `npm run typecheck:client`
Expected: no errors. If `ReviewStepView` consumers break on `sceneLayout` values, add `'concept-page'` where the client switches on layouts.

- [ ] **Step 5: Browser pass** (use the `run` skill to launch the app)

1. In a scratch git repo with one changed file, write `.diffstory/story.json`: a v4 story whose first step is a page concept that loads d3 from `https://cdn.jsdelivr.net/npm/d3@7`, draws an SVG, and has an `<input type="range">`; then one changed code step.
2. `npm run dev` pointed at that repo; open the review.
3. Verify, with screenshots:
   - the page renders and the d3 drawing appears (CDN loaded through the page CSP);
   - clicking into the page, then pressing → moves to the next step;
   - focusing the range input and pressing → moves the slider, not the story;
   - switching the app theme updates `data-ds-theme` inside the frame (check it with the browser's console in the frame context);
   - the fullscreen button fullscreens the figure;
   - in the frame's console, `fetch('/api/comments')` fails (network error or 403), and `top.location` assignment throws;
   - narration plays the title followed by the `narration` text.
4. Open an existing v3 story with a legacy concept and confirm it looks unchanged.

Record any failure plainly in the final report; do not mark the task done on a failed check.

- [ ] **Step 6: Commit**

```bash
npm run build
git add scripts/eval-stories.mjs docs/story-schema.md CHANGELOG.md dist skills/diffstory-storyteller/scripts/check-story.mjs
git commit -m "docs: story v4 concept pages, privacy note, eval narration"
```
