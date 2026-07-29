# wiring-blocks

The wiring makes `view-model.ts` the single place authored prose is parsed, and turns `render.ts` into a pure placer of pre-computed projections. Every narrative field on the model changes type from `string` to `Narrative`; `ReviewModel` gains a `story: StoryView` block (title, summary, intent) plus `Narrative`-typed hotspots so `render.ts` never reads prose off the `Tour` again (it keeps the `tour` argument only for `storyScope` file paths and `base`, which are paths/refs, not prose). At each render sink the rule is mechanical: element content takes `.html`, anything inside a quoted attribute or an aria label takes `esc(x.text)`, and anything the Aloud client reads takes `esc(x.speech)` — including `data-speech-text` attributes newly added to the Overview and the no-beats `.ds-why-text` node, which today derive speech from `textContent`. `railBeatLabel()` keeps its signature but is fed `.text`, because truncating `.html` would cut a tag in half. `renderMarkdown()` survives untouched for comment bodies and agent turns (a different trust domain), but no longer renders concept bodies — `narrative(body, 'block')` does. `tour.ts` calls `narrativeIssues()` per field with the right tier, and the three raw-string checks (concept word count, `LINE_NUMBER_OPENER`, `VALUE_TRANSITION`) plus every "is this prose non-empty" gate move to `narrativeText()`, so markup can neither pad a thin primer nor smuggle a banned pattern past the regex. `story-picker.ts` is a plain-text surface, so it takes `narrativeText()` everywhere.


---

## Block A — `src/view-model.ts`

**Placement:** replace lines 1-28

```
// Turn the validated tour + parsed diff + coverage into the view structures the
// review page renders: the ordered story steps (side-by-side rows), the All-files
// overview (unified rows), the trust check, and the reconstructed full-file view.
//
// Diff data stays pure: code strings pass through verbatim and are escaped at the
// render boundary. Authored prose does not. Every narrative field is parsed here,
// exactly once (narrative.ts), and carried as a Narrative — `.html` for template
// interpolation, `.text` for attributes, labels, and truncation, `.speech` for
// Aloud. The renderer places those projections; it never escapes, truncates,
// re-parses, or markdown-renders story prose itself, which is what removes the
// sanitize-then-reparse gap mXSS lives in.
//
// The renderer (render.ts) and the /api/fullfile endpoint (server.ts) both consume
// these, so the diff-shaping logic lives in exactly one place.
import { changedRanges, rangesOverlap } from './diff.js';
import { readFileRange, readWholeFile } from './git.js';
import { orderedSteps } from './tour.js';
import { computeCoverage } from './coverage.js';
import { isCodeStep } from './types.js';
import { narrative, narrativeText, type Narrative } from './narrative.js';
import { createHash } from 'node:crypto';
import type {
  CodeStepKind,
  CodeTourStep,
  ConceptTourStep,
  DiffFile,
  DiffHunk,
  DiffLine,
  FileStatus,
  ReviewFileIndexEntry,
  Tour,
  TourStep,
  StepKind,
} from './types.js';
```

---

## Block B — `src/view-model.ts`

**Placement:** replace lines 66-124 (StepViewBase through StepBeatView; note ConceptDiagram is no longer imported from types.js)

```
export interface StepViewBase {
  id: string;
  order: number;
  /** Projected once: `.html` for headings, `.text` for aria labels and titles. */
  title: Narrative;
  kind: StepKind;
  kindLabel: string;
  /** Authored review cues carried through from story.json, markup stripped. */
  tags: string[];
  /** Grouping key for long reading paths, so text only — never markup. */
  chapter?: string;
}

export interface StepHealthView {
  broad: boolean;
  reasons: string[];
  viewportLines: number;
  beatCount: number;
}

export interface CodeStepView extends StepViewBase {
  kind: CodeStepKind;
  file: string;
  oldFile: string;
  /** Storyteller-selected visible window. */
  viewport: [number, number];
  range: [number, number];
  /** Narrower post-change line ranges that glow while this step is read aloud. */
  focusRanges: Array<[number, number]>;
  /** Focus ranges grouped by spoken unit. */
  focusGroups: Array<Array<[number, number]>>;
  /** Whether focusRanges came from story JSON instead of the step range fallback. */
  focusExplicit: boolean;
  newFile: boolean;
  context: boolean;
  why: Narrative;
  /** Author-declared distrust reason when this step is a story hotspot. */
  hotspot?: Narrative;
  health: StepHealthView;
  beats: StepBeatView[];
  /** Plain-English call-flow summary, e.g. "Calls step 3 · returns to 1". */
  flow: string;
  /** Diff rows grouped by hunk (rendered with a ⋯ separator between blocks). */
  blocks: SbsRow[][];
  note?: string;
}

/** A primer's diagram: the caption is prose, the source is Mermaid the client parses. */
export interface ConceptDiagramView {
  type: 'mermaid';
  source: string;
  caption: Narrative;
}

export interface ConceptStepView extends StepViewBase {
  kind: 'concept';
  /** The only block-tier narrative in the model: headings, lists, tables, code. */
  body: Narrative;
  diagram?: ConceptDiagramView;
  preparesFor: Array<{ id: string; order: number; title: Narrative }>;
}

export type StepView = CodeStepView | ConceptStepView;

export interface StepBeatView {
  text: Narrative;
  focusGroup: number;
  highlights: Array<[number, number]>;
}
```

---

## Block C — `src/view-model.ts`

**Placement:** replace lines 166-190 (HotspotView + ReviewModel)

```
/** One author-declared distrust spot, resolved against the ordered reading path. */
export interface HotspotView {
  stepId: string;
  /** 1-based panel index of the flagged step (panel 0 is the overview). */
  panelIndex: number;
  order: number;
  title: Narrative;
  reason: Narrative;
}

/** The recovered "why", projected for the Overview panel. */
export interface StoryIntentView {
  goal: Narrative;
  design?: Narrative;
  /** Evidence labels ("commit 41af8b7", "PR #12 body") — identifiers, not prose. */
  sources: string[];
  nonGoals: Narrative[];
}

/**
 * Tour-level narrative, projected once. Its existence is the reason render.ts
 * never touches Tour.title / Tour.summary / Tour.intent directly.
 */
export interface StoryView {
  title: Narrative;
  /** Absent when the story shipped an empty summary. */
  summary?: Narrative;
  /** Absent when no intent was recovered, or its goal was blank. */
  intent?: StoryIntentView;
}

export interface ReviewModel {
  /** Title, summary, and recovered intent — already projected for the renderer. */
  story: StoryView;
  steps: StepView[];
  files: FileView[];
  hotspots: HotspotView[];
  trust: TrustView;
  totalSteps: number;
  codeSteps: number;
  conceptSteps: number;
  filesChanged: number;
  contextFiles: number;
  totalAdd: number;
  totalDel: number;
  /** Hunk-bearing changed files inside the story's selected scope. */
  storyFilesChanged: number;
}
```

---

## Block D — `src/view-model.ts`

**Placement:** replace lines 239-265 (hotspot map + hotspot views inside buildReviewModel)

```
  // First declared reason wins if a step is (incorrectly) flagged twice.
  const hotspotByStep = new Map<string, Narrative>();
  for (const spot of tour.hotspots ?? []) {
    const reason = narrative(spot.reason ?? '', 'inline');
    if (reason.text.trim() && !hotspotByStep.has(spot.step)) hotspotByStep.set(spot.step, reason);
  }

  const stepViews = steps.map((step, index) =>
    isCodeStep(step)
      ? buildCodeStep(
          repo,
          step,
          files,
          byId,
          steps.length,
          headRef,
          hotspotByStep.get(step.id),
          opts?.detailedStepIndexes === undefined || opts.detailedStepIndexes.has(index),
        )
      : buildConceptStep(step, byId),
  );
  // Built from the step views, not the raw steps: the title is already projected
  // there, and parsing it twice would be the second parse this module exists to
  // remove.
  const hotspots: HotspotView[] = stepViews.flatMap((step, index) => {
    const reason = hotspotByStep.get(step.id);
    return reason && step.kind !== 'concept'
      ? [{ stepId: step.id, panelIndex: index + 1, order: step.order, title: step.title, reason }]
      : [];
  });
```

---

## Block E — `src/view-model.ts`

**Placement:** replace lines 282-296 (the buildReviewModel return statement)

```
  return {
    story: storyView(tour),
    steps: stepViews,
    files: fileViews,
    hotspots,
    trust,
    totalSteps: steps.length,
    codeSteps: codeSteps.length,
    conceptSteps: steps.length - codeSteps.length,
    filesChanged: changedFileViews.length,
    contextFiles: fileViews.filter((f) => f.kind === 'context').length,
    totalAdd: changedFileViews.reduce((a, f) => a + f.add, 0),
    totalDel: changedFileViews.reduce((a, f) => a + f.del, 0),
    storyFilesChanged: storyFileViews.length,
  };
}

/**
 * The story's own prose, projected once. Everything here lands inside a sentence
 * or a list item on the Overview panel, so it is inline-tier; the concept body is
 * the only block-tier narrative in the model.
 */
function storyView(tour: Tour): StoryView {
  const summary = narrative(tour.summary ?? '', 'inline');
  const intent = tour.intent;
  const goal = narrative(intent?.goal ?? '', 'inline');
  const design = narrative(intent?.design ?? '', 'inline');
  return {
    title: narrative(tour.title ?? '', 'inline'),
    summary: summary.text.trim() ? summary : undefined,
    // A goal that is blank once markup is stripped is no recovered intent at all,
    // and the Overview's layout hangs off whether one exists.
    intent: goal.text.trim()
      ? {
          goal,
          design: design.text.trim() ? design : undefined,
          sources: (intent?.sources ?? []).map((source) => narrativeText(source)).filter(Boolean),
          nonGoals: (intent?.nonGoals ?? [])
            .map((nonGoal) => narrative(nonGoal, 'inline'))
            .filter((nonGoal) => nonGoal.text.trim()),
        }
      : undefined,
  };
}
```

---

## Block F — `src/view-model.ts`

**Placement:** replace lines 305-366 (buildCodeStep + buildConceptStep)

```
function buildCodeStep(
  repo: string,
  step: CodeTourStep,
  files: DiffFile[],
  byId: Map<string, TourStep>,
  total: number,
  headRef?: string,
  hotspot?: Narrative,
  detailed = true,
): CodeStepView {
  const { blocks, note } = detailed ? stepBlocks(repo, step, files, headRef) : { blocks: [] };
  const diffFile = files.find((f) => f.newPath === step.file);
  const viewport = stepViewport(step);
  const highlights = stepHighlights(step);
  const beats = stepBeats(step);
  const focusGroups = stepFocusGroups(viewport, highlights, beats);
  const focusExplicit = beats.length > 0 || highlights.length > 0;
  return {
    id: step.id,
    order: step.order,
    title: narrative(step.title, 'inline'),
    chapter: chapterLabel(step),
    file: step.file,
    oldFile: diffFile?.oldPath ?? step.file,
    viewport,
    range: viewport,
    focusRanges: focusGroups.flat(),
    focusGroups,
    focusExplicit,
    kind: step.kind,
    kindLabel: STEP_KIND_LABEL[step.kind],
    tags: (step.tags ?? []).map((tag) => narrativeText(tag)),
    newFile: step.kind === 'new-file',
    context: step.kind === 'context',
    why: narrative(step.why ?? '', 'inline'),
    hotspot,
    health: stepHealth(step, viewport, focusGroups),
    beats,
    flow: flowLabel(step, byId, total),
    blocks,
    note,
  };
}

function buildConceptStep(step: ConceptTourStep, byId: Map<string, TourStep>): ConceptStepView {
  return {
    id: step.id,
    order: step.order,
    title: narrative(step.title, 'inline'),
    chapter: chapterLabel(step),
    kind: 'concept',
    kindLabel: STEP_KIND_LABEL.concept,
    tags: (step.tags ?? []).map((tag) => narrativeText(tag)),
    body: narrative(step.body, 'block'),
    diagram: step.diagram
      ? {
          type: step.diagram.type,
          // The Mermaid source is not narrative: tour.ts validates it against its
          // own pattern list and the client parses it, so it stays verbatim.
          source: step.diagram.source,
          caption: narrative(step.diagram.caption, 'inline'),
        }
      : undefined,
    preparesFor: step.preparesFor
      .map((id) => byId.get(id))
      .filter((target): target is CodeTourStep => !!target && isCodeStep(target))
      .map((target) => ({ id: target.id, order: target.order, title: narrative(target.title, 'inline') }))
      .sort((a, b) => a.order - b.order),
  };
}

/** Chapters group the rail, so they are compared and printed as plain text. */
function chapterLabel(step: TourStep): string | undefined {
  return narrativeText(step.chapter ?? '').trim() || undefined;
}
```

---

## Block G — `src/view-model.ts`

**Placement:** replace lines 401-407 (stepBeats)

```
function stepBeats(step: CodeTourStep): StepBeatView[] {
  return (step.beats ?? []).map((beat, i) => ({
    text: narrative(beat.text, 'inline'),
    focusGroup: i,
    highlights: beat.highlights,
  }));
}
```

---

## Block H — `src/render.ts`

**Placement:** replace line 187

```
  const pageTitle = storyless ? 'Reviewing the diff' : model.story.title.text;
```

---

## Block I — `src/render.ts`

**Placement:** replace lines 485-544 (railCard, railBeatTree, railBeatLabel)

```
// A rail card carries only what tells steps apart: the number, the headline, and
// the file's base name (full path on hover). The kind badge appears only when it
// is *not* a plain change — "Changed" on every card is noise, so it is dropped.
function railCard(s: StepView, i: number, includeBeats = true): string {
  if (s.kind === 'concept') {
    return `<div class="ds-railstory-node" data-story-step-node="${i + 1}">
      <button class="ds-stepcard is-concept" data-step-index="${i + 1}" data-step-id="${esc(s.id)}">
        <span class="ds-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="ds-stepcard-body">
          <span class="ds-stepcard-title">${s.title.html}</span>
          <span class="ds-stepcard-fileline">
            <span class="ds-stepcard-file">Concept primer</span>
          </span>
        </span>
      </button>
    </div>`;
  }
  const base = splitPath(s.file)[1];
  const badge =
    s.kind === 'changed'
      ? ''
      : `<span class="ds-railbadge ds-badge-${s.kind === 'new-file' ? 'new' : 'context'}">${esc(
          s.kindLabel,
        )}</span>`;
  return `<div class="ds-railstory-node" data-story-step-node="${i + 1}">
    <button class="ds-stepcard" data-step-index="${i + 1}" data-step-id="${esc(s.id)}">
      <span class="ds-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="ds-stepcard-body">
        <span class="ds-stepcard-title">${s.title.html}</span>
        <span class="ds-stepcard-fileline">
          <span class="ds-stepcard-file" title="${esc(s.file)}">${esc(base)}</span>${badge}
        </span>
      </span>
    </button>
    ${includeBeats ? railBeatTree(s, i + 1) : ''}
  </div>`;
}

function railBeatTree(step: CodeStepView, stepIndex: number): string {
  if (!step.beats.length) return '';
  const health = step.health.broad
    ? `<span class="ds-railbeats-health" title="${esc(step.health.reasons.join(' · '))}"><i aria-hidden="true"></i>Broad</span>`
    : '';
  const beats = step.beats.map((beat) => `<button type="button" class="ds-railbeat" data-rail-beat data-rail-step-index="${stepIndex}" data-focus-group="${beat.focusGroup}" aria-pressed="false" title="${esc(beat.text.text)}" aria-label="Beat ${beat.focusGroup + 1}: ${esc(beat.text.text)}">
      <span class="ds-railbeat-marker">${String(beat.focusGroup + 1).padStart(2, '0')}</span>
      <span class="ds-railbeat-text">${esc(railBeatLabel(beat.text.text))}</span>
    </button>`).join('');
  return `<div class="ds-railbeats" aria-label="Review beats for ${esc(step.title.text)}">
    <div class="ds-railbeats-head">
      <span>Review beats</span>${health}<span class="ds-railbeats-count" data-rail-current>1 / ${step.beats.length}</span>
      ${storyRepairMenu(step, true)}
    </div>
    <div class="ds-railbeat-list">${beats}</div>
  </div>`;
}

// Always fed the text projection: clipping `.html` at 64 characters would cut a
// tag in half and hand the browser a fragment the sanitizer never approved.
function railBeatLabel(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 64) return clean;
  const clipped = clean.slice(0, 64);
  const boundary = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, boundary > 42 ? boundary : 64).replace(/[,:;\s]+$/, '')}…`;
}
```

---

## Block J — `src/render.ts`

**Placement:** replace lines 589-594 (the steps.map inside filmstripThread)

```
    ...steps.map(
      (s, i) => `<button type="button" class="ds-filmnode" data-thread-node="${i + 1}" data-goto-step="${i + 1}" aria-label="Step ${i + 1}: ${esc(s.title.text)}">
      <span class="ds-filmnode-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="ds-filmnode-label">${s.title.html}</span>
    </button>`,
    ),
```

---

## Block K — `src/render.ts`

**Placement:** replace lines 645-731 (introPanel)

```
function introPanel(
  model: ReviewModel,
  tour: Tour,
  freshness: 'current' | 'stale' | 'unverified',
  routeBase: string,
  drift?: StoryDriftView,
): string {
  const first = model.steps[0];
  const story = model.story;
  const intent = story.intent;
  const summaryText = story.summary ? nl(story.summary.html) : '';
  const goalText = intent ? nl(intent.goal.html) : '';
  // With a recovered intent the goal leads and the summary becomes the reading
  // map; without one the summary (or a generic line) is the lede, as before.
  const fallbackLede =
    'Each step builds on the one before it — read them in order, or jump to any file from the list.';
  const lede = goalText || summaryText || fallbackLede;
  // The narration reads data-speech-text when it is present, so the spoken form
  // of the Overview is the speech projection rather than whatever textContent
  // the visible markup happens to flatten to.
  const ledeSpeech = intent?.goal.speech || story.summary?.speech || fallbackLede;
  const design =
    goalText && intent?.design
      ? `<p class="ds-intro-design" data-speech-overview data-speech-text="${esc(
          intent.design.speech,
        )}">${nl(intent.design.html)}</p>`
      : '';
  const map = goalText && story.summary
    ? `<p class="ds-intro-design" data-speech-overview data-speech-text="${esc(
        story.summary.speech,
      )}">${summaryText}</p>`
    : '';
  // Deliberate omissions save the reviewer from flagging what the author skipped on purpose.
  const nonGoals = intent?.nonGoals.length
    ? `<div class="ds-intro-nongoals"><span class="ds-intro-block-kicker">Deliberately not touched</span><ul>${intent.nonGoals
        .map((nonGoal) => `<li>${nonGoal.html}</li>`)
        .join('')}</ul></div>`
    : '';
  const context = design || map || nonGoals
    ? `<div class="ds-intro-context">${design}${map}${nonGoals}</div>`
    : '';
  const hotspots = model.hotspots.length
    ? `<div class="ds-intro-hotspots" role="note" aria-label="Author-flagged review hotspots">
          <span class="ds-intro-block-kicker">Where I'd distrust this first</span>
          <ul>${model.hotspots
            .map(
              (spot) => `<li><button type="button" data-goto-step="${spot.panelIndex}">
                <span class="ds-hotspot-step">Step ${spot.order} · ${spot.title.html}</span>
                <span class="ds-hotspot-reason">${spot.reason.html}</span>
              </button></li>`,
            )
            .join('')}</ul>
        </div>`
    : '';
  const reviewNotes = hotspots || context
    ? `<details class="ds-intro-notes">
        <summary><span>Review notes</span><span class="ds-intro-notes-caret" aria-hidden="true">⌄</span></summary>
        <div class="ds-intro-notes-body">${hotspots}${context}</div>
      </details>`
    : '';
  // Story scope is file paths, not prose, so it is still read straight off the tour.
  const includedFiles = tour.storyScope?.includedFiles ?? [];
  const solidityOnly = includedFiles.length > 0 && includedFiles.every((file) => file.toLowerCase().endsWith('.sol'));
  const scopeText = solidityOnly
    ? `Solidity only · ${model.storyFilesChanged} ${plural(model.storyFilesChanged, 'file')}`
    : `${model.storyFilesChanged} ${plural(model.storyFilesChanged, 'file')} in story`;
  const freshnessNote = drift && drift.state !== 'unverified'
    ? driftStatus(drift)
    : freshness === 'current'
      ? ''
      : `<div class="ds-intro-freshness" role="status" aria-label="${
        freshness === 'stale'
          ? 'The diff changed after this story was generated. Regenerate the story before relying on coverage.'
          : 'This story baseline cannot be verified against its current scope. Regenerate the story before relying on coverage.'
      }"><span aria-hidden="true">▲</span><span>${freshness === 'stale' ? 'Story is out of date' : 'Freshness unverified'}</span><a href="${esc(
        routeBase,
      )}/change">Regenerate</a></div>`;
  const start = first
    ? `<button class="ds-intro-start" data-goto-step="1">
        <span class="ds-intro-start-main">Start the walkthrough <span class="ds-intro-arrow">→</span></span>
      </button>`
    : '';
  return `<section class="ds-step is-intro" data-step-panel="0">
    <div class="ds-introwrap">
      <span class="ds-intro-eyebrow">${STORY_MARK}<span>The story of this change</span></span>
      <h1 class="ds-intro-title">${story.title.html}</h1>
      <p class="ds-intro-lede" data-speech-overview data-speech-text="${esc(ledeSpeech)}">${lede}</p>
      ${freshnessNote}
      <div class="ds-intro-actions">${start}</div>
      <div class="ds-intro-utility" aria-label="Story scope and optional review material">
        <span class="ds-intro-scope">${scopeText}</span>
        ${reviewNotes}
        <button type="button" class="ds-intro-allfiles" data-open-all-files>All files <span aria-hidden="true">→</span></button>
      </div>
    </div>
  </section>`;
}
```

---

## Block L — `src/render.ts`

**Placement:** replace lines 1096-1106 (lazyStepSpeech)

```
function lazyStepSpeech(step: StepView): string {
  if (step.kind === 'concept') {
    return `<span data-speech-concept>${esc(conceptSpeechText(step))}</span>`;
  }
  if (!step.beats.length) {
    return `<span class="ds-why-text" data-speech-text="${esc(step.why.speech)}">${esc(step.why.text)}</span>`;
  }
  return step.beats.map((beat) => `<span data-speech-beat="${beat.focusGroup}" data-focus-group="${beat.focusGroup}" data-speech-text="${esc(
    beat.text.speech,
  )}">${esc(beat.text.text)}</span>`).join('');
}
```

---

## Block M — `src/render.ts`

**Placement:** replace lines 1158-1167 (the step title row and hotspot flag inside codeStepPanel)

```
      <div class="ds-step-titlerow">
        <h1 class="ds-step-title">${s.title.html}</h1>
        ${storyRepairMenu(s, true)}
      </div>
    </div>
    ${s.hotspot
      ? `<div class="ds-hotspot-flag" role="note"><span class="ds-hotspot-flag-kicker" aria-hidden="true">▲ Distrust</span><span class="ds-sr-only">Author-flagged hotspot: </span><span class="ds-hotspot-flag-reason">${
          s.hotspot.html
        }</span></div>`
      : ''}
```

---

## Block N — `src/render.ts`

**Placement:** replace lines 1205-1256 (conceptStepPanel)

```
function conceptStepPanel(
  s: ConceptStepView,
  i: number,
  total: number,
  stepIndexById: Map<string, number>,
): string {
  const next = s.preparesFor[0];
  const nextIndex = next ? stepIndexById.get(next.id) : undefined;
  const nextLink = next && nextIndex !== undefined
    ? `<button class="ds-concept-next" type="button" data-goto-step="${nextIndex}">
        <span class="ds-concept-next-kicker">Next in code · Step ${next.order}</span>
        <span class="ds-concept-next-title">${next.title.html}</span>
        <span class="ds-concept-next-arrow" aria-hidden="true">→</span>
      </button>`
    : '';
  const diagram = s.diagram
    ? `<figure class="ds-concept-diagram" data-concept-diagram>
        <div class="ds-concept-diagram-output" data-mermaid-output role="img" aria-label="${esc(
          s.diagram.caption.text,
        )}"><span class="ds-concept-diagram-loading">Drawing the mental model…</span></div>
        <pre data-mermaid-source hidden>${esc(s.diagram.source)}</pre>
        <figcaption>${s.diagram.caption.html}</figcaption>
        <details class="ds-concept-diagram-source" data-mermaid-fallback>
          <summary>Diagram source</summary>
          <pre><code>${esc(s.diagram.source)}</code></pre>
        </details>
      </figure>`
    : '';
  const speech = conceptSpeechText(s);
  return `<section class="ds-step ds-concept-step" data-step-panel="${i + 1}" data-step-id="${esc(s.id)}" hidden>
    <div class="ds-step-top">
      <div class="ds-step-meta">
        <span class="ds-step-count">Step ${s.order} of ${total}</span>
        <span class="ds-dot"></span>
        <span class="ds-badge ds-badge-concept">Concept</span>
        <span class="ds-flex"></span>
      </div>
    </div>
    <div class="ds-concept-scroll">
      <article class="ds-concept-document" aria-labelledby="ds-concept-title-${i + 1}">
        <div class="ds-concept-heading">
          <span class="ds-concept-eyebrow"><span aria-hidden="true">◇</span> Mental model</span>
        </div>
        <h1 class="ds-concept-title" id="ds-concept-title-${i + 1}">${s.title.html}</h1>
        <div class="ds-concept-body ds-md">${s.body.html}</div>
        ${diagram}
        ${nextLink}
        <span class="ds-sr-only" data-speech-concept>${esc(speech)}</span>
      </article>
    </div>
  </section>`;
}
```

---

## Block O — `src/render.ts`

**Placement:** replace lines 1268-1294 (conceptSpeechText)

```
/**
 * The spoken form of a primer: the projections the parser already produced,
 * ordered and terminated. The markdown-stripping this used to do lived here only
 * because the body arrived as raw authored prose; the speech projection owns that
 * shaping now, so the renderer only decides what is said in what order.
 */
function conceptSpeechText(s: ConceptStepView): string {
  return [s.title.speech, s.body.speech, s.diagram?.caption.speech]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .map(endsSentence)
    .join(' ')
    .trim();
}
```

---

## Block P — `src/render.ts`

**Placement:** replace lines 1296-1321 (stepStoryHtml + beatHtml)

```
function stepStoryHtml(s: CodeStepView, diffRegionId: string, stepIndex: number): string {
  if (!s.beats.length) return `<div class="ds-beatdock is-single" data-beat-dock data-dock-step="${stepIndex}" hidden>
    <span class="ds-beatdock-count">Review note</span>
    <p class="ds-why-text" data-speech-text="${esc(s.why.speech)}">${nl(s.why.html)}</p>
  </div>`;
  return `<div class="ds-beatdock" data-beat-dock data-dock-step="${stepIndex}" hidden>
    <span class="ds-beatdock-count"><b data-beat-current>01</b><span>/ ${String(s.beats.length).padStart(2, '0')}</span></span>
    <div class="ds-beatdock-copy">
      <div class="ds-beats">${s.beats.map((beat) => beatHtml(beat, s.file, diffRegionId)).join('')}</div>
    </div>
    <span class="ds-beatdock-actions">
      <button type="button" data-beat-move="-1" aria-label="Previous review beat" disabled>←</button>
      <button type="button" data-beat-move="1" aria-label="Next review beat">→</button>
    </span>
    <div class="ds-sr-only" data-story-focus-status aria-live="polite" aria-atomic="true"></div>
  </div>`;
}

function beatHtml(beat: CodeStepView['beats'][number], file: string, diffRegionId: string): string {
  const destination = beatDestination(file, beat.highlights);
  return `<button type="button" class="ds-beat ds-beatdock-note" data-story-beat data-speech-beat="${beat.focusGroup}" data-focus-group="${beat.focusGroup}" data-speech-text="${esc(
    beat.text.speech,
  )}" data-focus-destination="${esc(destination)}" aria-controls="${diffRegionId}" aria-pressed="false" aria-label="Focus beat ${beat.focusGroup + 1}: ${esc(
    beat.text.text,
  )}"><span class="ds-beat-text">${nl(beat.text.html)}</span></button>`;
}
```

---

## Block Q — `src/render.ts`

**Placement:** replace line 1793 (the targets map inside challengeChecklist)

```
  const targets = specific.map(({ step, index }) => `<button type="button" class="ds-challenge-target" data-goto-step="${index + 1}"><span>Step ${step.order}</span><strong>${step.title.html}</strong><i aria-hidden="true">→</i></button>`).join('');
```

---

## Block R — `src/page-assets.ts`

**Placement:** replace lines 1927-1934 (inside PAGE_JS: fallbackStepText + the overview branch of stepSpeechUnits)

```
  function speechFrom(node){
    // The speech projection rides in data-speech-text; textContent stays the
    // fallback so a node rendered without the attribute is still narrated.
    return speechClean(node.getAttribute('data-speech-text')||node.textContent||'');
  }
  function fallbackStepText(panel){
    var w=$('.ds-why-text',panel)||$('.ds-why-text',beatHost(panel));
    return w?speechFrom(w):'';
  }
  function stepSpeechUnits(panel){
    var overview=$all('[data-speech-overview],[data-speech-concept]',panel);
    if(overview.length){
      return overview.map(function(node){return {text:speechFrom(node),group:null};}).filter(function(unit){return !!unit.text;});
    }
```

---

## Block S — `src/tour.ts`

**Placement:** replace lines 4-5 (the import block)

```
import { readFileSync } from 'node:fs';
import { narrativeIssues, narrativeText, type NarrativeTier } from './narrative.js';
import type { CodeStepKind, Tour, TourStep, StepKind, StoryMode } from './types.js';
```

---

## Block T — `src/tour.ts`

**Placement:** replace lines 29-43 (the LINE_NUMBER_OPENER / VALUE_TRANSITION doc block, TourError, and add the two narrative helpers directly after it)

```
/**
 * Beat prose that says nothing the rendered diff already says. Both patterns are
 * forbidden by the storyteller skill, but prose guidance lands unevenly, so the
 * mechanically detectable cases are enforced at generation time.
 *
 * `LINE_NUMBER_OPENER` — "Line 742 makes …", "Lines 30-34 add …". The highlight
 * already points at those lines; the words should explain, not re-address.
 * `VALUE_TRANSITION` — "650 → 600", "650->600". Both sides are already rendered
 * in colour, so restating them costs a line and teaches nothing. Prose arrows
 * between words ("request → handler") stay legal: only digit-to-digit matches.
 *
 * Both run against the text projection, never the raw field. "<strong>Line
 * 742</strong> makes …" and "650 &rarr; 600" are the same sentence to a reader,
 * so they have to be the same sentence to the gate.
 */
const LINE_NUMBER_OPENER = /^lines?\s+\d/i;
const VALUE_TRANSITION = /\d\s*(?:→|->|—>|–>)\s*\d/;

export class TourError extends Error {}

/**
 * Authoring problems in one narrative field, reported under the field's own path.
 * `narrativeIssues` returns an empty array for prose the sanitizer keeps intact,
 * so a clean story adds nothing here.
 */
function validateNarrative(value: unknown, name: string, tier: NarrativeTier, errors: string[]): void {
  if (typeof value !== 'string') return;
  for (const issue of narrativeIssues(value, tier)) errors.push(`${name} ${issue}`);
}

/** True when a field carries no readable prose once its markup is stripped. */
function isBlankNarrative(value: unknown): boolean {
  return typeof value !== 'string' || !narrativeText(value).trim();
}
```

---

## Block U — `src/tour.ts`

**Placement:** replace lines 219-224 (the beat body inside validateBeats)

```
    const beat = rawBeat as Record<string, unknown>;
    if (isBlankNarrative(beat.text)) {
      errors.push(`${where}.beats[${i}].text is required`);
    }
    validateNarrative(beat.text, `${where}.beats[${i}].text`, 'inline', errors);
    validateBeatHighlights(beat, i, containerRange, containerName, where, errors, allowDeletionAnchor);
  });
}
```

---

## Block V — `src/tour.ts`

**Placement:** replace lines 233-256 (the body of validateIntent after the object-shape guard)

```
  const intent = t.intent as Record<string, unknown>;
  if (isBlankNarrative(intent.goal)) errors.push('intent.goal is required');
  validateNarrative(intent.goal, 'intent.goal', 'inline', errors);
  if (intent.design !== undefined && typeof intent.design !== 'string') errors.push('intent.design must be a string');
  validateNarrative(intent.design, 'intent.design', 'inline', errors);
  if (intent.sources !== undefined) {
    if (!Array.isArray(intent.sources) || intent.sources.length === 0) {
      errors.push('intent.sources must be a non-empty array');
    } else {
      intent.sources.forEach((s, i) => {
        if (typeof s !== 'string' || !s.trim()) errors.push(`intent.sources[${i}] must be a non-empty string`);
        // Sources are evidence labels the reviewer scans, never formatted prose.
        validateNarrative(s, `intent.sources[${i}]`, 'text', errors);
      });
    }
  }
  if (intent.nonGoals !== undefined) {
    if (!Array.isArray(intent.nonGoals)) {
      errors.push('intent.nonGoals must be an array');
    } else {
      // An empty array means "this change has no deliberate omissions", which is
      // the same honest claim as omitting the field. Rejecting it would fail a
      // whole story over a semantically correct answer.
      intent.nonGoals.forEach((s, i) => {
        if (typeof s !== 'string' || !s.trim()) errors.push(`intent.nonGoals[${i}] must be a non-empty string`);
        validateNarrative(s, `intent.nonGoals[${i}]`, 'inline', errors);
      });
    }
  }
```

---

## Block W — `src/tour.ts`

**Placement:** replace lines 272-273 (inside the validateHotspots forEach)

```
    if (typeof spot.step !== 'string' || !spot.step.trim()) errors.push(`hotspots[${i}].step is required`);
    if (isBlankNarrative(spot.reason)) errors.push(`hotspots[${i}].reason is required`);
    validateNarrative(spot.reason, `hotspots[${i}].reason`, 'inline', errors);
```

---

## Block X — `src/tour.ts`

**Placement:** replace lines 312-314 (the reviewerNote check in validateStoryScope)

```
  if (scope.reviewerNote !== undefined && typeof scope.reviewerNote !== 'string') {
    errors.push('storyScope.reviewerNote must be a string');
  }
  // Reviewer guidance is echoed back into agent prompts, not into the page.
  validateNarrative(scope.reviewerNote, 'storyScope.reviewerNote', 'text', errors);
```

---

## Block Y — `src/tour.ts`

**Placement:** replace lines 325-327 (the caption check in validateConceptDiagram)

```
  if (typeof diagram.caption !== 'string' || !diagram.caption.trim()) {
    errors.push(`${where}.diagram.caption is required`);
  }
  validateNarrative(diagram.caption, `${where}.diagram.caption`, 'inline', errors);
```

---

## Block Z — `src/tour.ts`

**Placement:** replace line 361 (the body check in validateConceptStep)

```
  if (isBlankNarrative(step.body)) errors.push(`${where}.body is required`);
  // The one block-tier field in the whole story: headings, lists, tables, code.
  validateNarrative(step.body, `${where}.body`, 'block', errors);
```

---

## Block [ — `src/tour.ts`

**Placement:** replace line 381 (the why check in validateCodeStep)

```
  if (typeof step.why !== 'string') errors.push(`${where}.why is required`);
  validateNarrative(step.why, `${where}.why`, 'inline', errors);
```

---

## Block \ — `src/tour.ts`

**Placement:** replace lines 513-514 (the title/summary checks in validateTour)

```
  if (isBlankNarrative(t.title)) errors.push('title is required');
  validateNarrative(t.title, 'title', 'inline', errors);
  if (typeof t.summary !== 'string') errors.push('summary is required (use "" if none)');
  validateNarrative(t.summary, 'summary', 'inline', errors);
```

---

## Block ] — `src/tour.ts`

**Placement:** replace lines 552-556 (the per-step title/chapter/tags checks in validateTour)

```
    if (typeof step.title !== 'string' || !step.title) errors.push(`${where}.title is required`);
    validateNarrative(step.title, `${where}.title`, 'inline', errors);
    if (step.chapter !== undefined && (typeof step.chapter !== 'string' || !step.chapter.trim())) {
      errors.push(`${where}.chapter must be a non-empty string`);
    }
    // Chapters group the rail by string equality, so they carry no markup.
    validateNarrative(step.chapter, `${where}.chapter`, 'text', errors);
    validateStringArray(step.tags, `${where}.tags`, errors);
    if (Array.isArray(step.tags)) {
      step.tags.forEach((tag, tagIndex) =>
        validateNarrative(tag, `${where}.tags[${tagIndex}]`, 'text', errors),
      );
    }
```

---

## Block ^ — `src/tour.ts`

**Placement:** replace lines 655-659 (conceptWordCount)

```
/**
 * Words the reviewer actually hears. Counting the raw field would let markup pad
 * a thin primer past the minimum — "<strong>" is not a word — so the count runs
 * on the text projection, the same string the speech stream is built from.
 */
function conceptWordCount(body: unknown): number {
  return typeof body === 'string'
    ? narrativeText(body).match(/[\p{L}\p{N}_][\p{L}\p{N}_'-]*/gu)?.length ?? 0
    : 0;
}
```

---

## Block _ — `src/tour.ts`

**Placement:** replace lines 709-711 (the summary gate in validateGeneratedTour)

```
  if (isBlankNarrative(tour.summary)) {
    errors.push('summary must explain the generated reading path');
  }
```

---

## Block ` — `src/tour.ts`

**Placement:** replace lines 715-717 (the intent.design gate in validateGeneratedTour)

```
    if (isBlankNarrative(tour.intent.design)) {
      errors.push('intent.design must explain the existing app path, attachment point, and new outcome');
    }
```

---

## Block a — `src/tour.ts`

**Placement:** replace lines 731-733 (the step.why gate in validateGeneratedTour)

```
    if (isBlankNarrative(step.why)) {
      errors.push(`${where}.why must be a non-empty fallback recap`);
    }
```

---

## Block b — `src/tour.ts`

**Placement:** replace lines 775-791 (the opening of the beats forEach in validateGeneratedTour, through the VALUE_TRANSITION block)

```
    step.beats?.forEach((beat, beatIndex) => {
      // Two prose failures that make a beat say nothing the diff hasn't already
      // shown. Both are asked for in the skill, but prose guidance lands
      // inconsistently across runs, so the ones that can be checked are checked.
      // Both patterns read the text projection, so markup and entities cannot
      // hide a line-number opener or a value transition from them.
      const beatText = narrativeText(typeof beat?.text === 'string' ? beat.text : '').trim();
      if (LINE_NUMBER_OPENER.test(beatText)) {
        errors.push(
          `${where}.beats[${beatIndex}].text must not open by naming line numbers; ` +
          `the highlight already points there — say why those lines matter`,
        );
      }
      if (VALUE_TRANSITION.test(beatText)) {
        errors.push(
          `${where}.beats[${beatIndex}].text must not narrate a value transition; ` +
          `the diff already shows both sides — say what depended on the old value`,
        );
      }
```

---

## Block c — `src/story-picker.ts`

**Placement:** insert after line 4 (the theme.ts import)

```
import { narrativeText } from './narrative.js';
```

---

## Block d — `src/story-picker.ts`

**Placement:** replace lines 46-72 (the tail of storyRow, from the activity line through the closing article)

```
  const activity = s.addressedComments
    ? `${plural(s.addressedComments, 'reply')} ready to verify`
    : state.detail;

  // This page is plain text end to end — no story markup renders here, so both
  // authored fields take the text projection and the local esc() as before.
  const title = narrativeText(s.title) || s.id;
  const summary = esc(
    s.valid ? narrativeText(s.summary) || 'No summary yet.' : s.error || 'This story file could not be read.',
  );

  return (
    `<article class="story-row state-${state.cls}${s.valid ? '' : ' row-bad'}">` +
    `<a class="row-main" href="${href}">` +
    `<span class="state-rail" aria-hidden="true"></span>` +
    `<span class="row-num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>` +
    `<span class="row-body">` +
    `<span class="row-head"><span class="row-title">${esc(title)}</span><span class="badge">${state.label}</span></span>` +
    `<span class="row-sum">${summary}</span>` +
    `<span class="session-facts">` +
      `<span><b>${s.liveFiles || s.files}</b> files</span>` +
      `<span><b class="plus">+${s.additions}</b> <b class="minus">−${s.deletions}</b></span>` +
      `<span><b>${Math.max(0, s.steps - s.primers)}</b> code stops${s.primers ? ` + ${plural(s.primers, 'primer')}` : ''}</span>` +
      (s.openComments ? `<span><b>${s.openComments}</b> open ${s.openComments === 1 ? 'note' : 'notes'}</span>` : '') +
    `</span>` +
    `<span class="row-foot"><span class="chip"${s.scope.command ? ` title="${esc(s.scope.command)}"` : ''}>${esc(s.scope.label)}</span><span>${esc(activity)}</span><span>${relTime(s.updatedAt, now)}</span></span>` +
    `</span>` +
    `<span class="resume">Resume review ${CHEV}</span>` +
    `</a>` +
    `<button class="row-del" data-delete-story="${esc(s.id)}" data-story-title="${esc(title)}" type="button" title="Remove story" aria-label="Remove ${esc(title)}">${TRASH}</button>` +
    `</article>`
  );
}
```

---

## Notes

- COMPLETE render.ts narrative inventory, verified line by line against the current file. Format: line — current expression — replacement — projection.

TOUR-LEVEL (all now read from model.story, never from `tour`):
  187 — `tour.title` — `model.story.title.text` — TEXT (feeds <title> at 257 and the title= attribute at 286, both already esc()'d).
  654 — `nl(esc(tour.summary.trim()))` — `nl(story.summary.html)` — HTML.
  655 — `nl(esc(intent.goal.trim()))` — `nl(intent.goal.html)` — HTML.
  664 — `nl(esc(intent.design.trim()))` — `nl(intent.design.html)` + new `data-speech-text="${esc(intent.design.speech)}"` — HTML + SPEECH.
  666 — `${summaryText}` (the reading-map <p>) — same html, plus `data-speech-text="${esc(story.summary.speech)}"` — HTML + SPEECH.
  671 — `<li>${esc(g)}</li>` — `<li>${nonGoal.html}</li>` — HTML (trim/filter moved into storyView).
  683 — `${esc(spot.title)}` — `${spot.title.html}` — HTML.
  684 — `${esc(spot.reason)}` — `${spot.reason.html}` — HTML.
  720 — `${esc(tour.title)}` — `${story.title.html}` — HTML.
  721 — the lede <p> — unchanged content, plus `data-speech-text="${esc(ledeSpeech)}"` — SPEECH.

STEP TITLES (7 sinks):
  491 — `${esc(s.title)}` concept rail card — `${s.title.html}` — HTML.
  510 — `${esc(s.title)}` code rail card — `${s.title.html}` — HTML.
  529 — `aria-label="Review beats for ${esc(step.title)}"` — `${esc(step.title.text)}` — TEXT.
  590 — `aria-label="Step N: ${esc(s.title)}"` filmstrip — `${esc(s.title.text)}` — TEXT.
  592 — `${esc(s.title)}` filmstrip label — `${s.title.html}` — HTML.
  1159 — `${esc(s.title)}` code step <h1> — `${s.title.html}` — HTML.
  1216 — `${esc(next.title)}` concept next-link — `${next.title.html}` — HTML.
  1248 — `${esc(s.title)}` concept <h1> — `${s.title.html}` — HTML.
  1793 — `<strong>${esc(step.title)}</strong>` challenge target — `${step.title.html}` — HTML.

BEAT TEXT (the 8 sinks named in the task, all confirmed at those exact lines):
  525 `title="${esc(beat.text)}"` — `${esc(beat.text.text)}` — TEXT.
  525 `aria-label="Beat N: ${esc(beat.text)}"` — `${esc(beat.text.text)}` — TEXT.
  527 `${esc(railBeatLabel(beat.text))}` — `${esc(railBeatLabel(beat.text.text))}` — TEXT (truncation must never see .html).
  1103 `data-speech-text="${esc(beat.text)}"` (lazy cache) — `${esc(beat.text.speech)}` — SPEECH.
  1105 `${esc(beat.text)}` (lazy cache node body) — `${esc(beat.text.text)}` — TEXT.
  1316 `data-speech-text="${esc(beat.text)}"` (live beat button) — `${esc(beat.text.speech)}` — SPEECH.
  1318 `aria-label="Focus beat N: ${esc(beat.text)}"` — `${esc(beat.text.text)}` — TEXT.
  1320 `<span class="ds-beat-text">${nl(esc(beat.text))}</span>` — `${nl(beat.text.html)}` — HTML.

WHY (2 sinks):
  1101 — `${esc(step.why)}` in the lazy sr-only cache — `${esc(step.why.text)}` in the node plus `data-speech-text="${esc(step.why.speech)}"` — TEXT + SPEECH.
  1299 — `${nl(esc(s.why))}` in the single-note dock — `${nl(s.why.html)}` plus `data-speech-text="${esc(s.why.speech)}"` — HTML + SPEECH.

HOTSPOT ON THE STEP:
  1164-1165 — `${esc(s.hotspot)}` — `${s.hotspot.html}` — HTML.

CONCEPT:
  1233 — `const speech = conceptSpeechText(s);` — unchanged call, rewritten function (now joins `.speech` of title, body, and caption; the markdown-stripping pipeline at 1269-1286 is deleted).
  1249 — `${renderMarkdown(s.body)}` — `${s.body.html}` — HTML (block tier).
  1252 — `${esc(speech)}` — unchanged expression; the value is now built from projections — SPEECH.
  1098 — `${esc(conceptSpeechText(step))}` in lazyStepSpeech — unchanged expression, same rewritten function — SPEECH.
  1222-1224 — `aria-label="${esc(s.diagram.caption)}"` — `${esc(s.diagram.caption.text)}` — TEXT.
  1226 — `<figcaption>${esc(s.diagram.caption)}</figcaption>` — `${s.diagram.caption.html}` — HTML.
  1225 / 1229 — `${esc(s.diagram.source)}` — UNCHANGED. Mermaid source is not narrative: tour.ts validates it against its own unsafe-pattern list and the client parses it.

CHAPTER:
  553 / 557 / 576 — `step.chapter` and `esc(group.label)` — UNCHANGED code; the value arriving is now the text projection because view-model's chapterLabel() runs narrativeText().

DELIBERATELY NOT CHANGED (renderer-generated strings, not authored prose — routing them through narrative() would be noise): 523 and 1192 `step.health.reasons`, 1142-1144 `s.flow`, 503/1154 `s.kindLabel`, 1333/1346/1385/1400 `s.note`, and every `s.file` / `s.id` / path sink. 1475/1481/1529/1685/1686 `renderMarkdown(...)` for comment bodies and agent turns stay as-is: reviewer and agent text is a different trust domain with its own pipeline, so `renderMarkdown` must NOT be deleted.

- Attribute escaping: `.text` and `.speech` are raw strings (the contract calls them plain text, and truncation/word-count callers need them raw), so every attribute sink keeps its `esc()` wrapper. render.ts's `esc()` does not escape `'`, which is fine because every attribute in render.ts is double-quoted — the module's stricter `'` → `&#39;` rule governs attributes the narrative serializer itself emits, not these hand-written ones. Do not widen render.ts's esc() as part of this change; it would churn several unrelated snapshot assertions for no security gain.

- `nl()` is applied to `.html` only at inline-tier sites (654, 655, 664, 1299, 1320). Never call it on a block-tier projection: `narrative(body, 'block')` can emit a `<pre>`, and rewriting its newlines to `<br>` would corrupt the code block. That is why the concept body at 1249 is a bare `${s.body.html}`.

- Speech plumbing needs the small PAGE_JS edit included above. Today `stepSpeechUnits` reads `textContent` for `[data-speech-overview]` / `[data-speech-concept]`, and `fallbackStepText` reads `textContent` of `.ds-why-text`; beats already prefer `data-speech-text`. Without the `speechFrom()` helper the new speech projections on the Overview and the no-beats dock are emitted and ignored, so narration silently falls back to flattened markup. PAGE_JS is a template string tsc cannot parse — run `node --check` on the emitted `dist/page-assets.js` PAGE_JS body after editing, and remember every regex escape inside that string must be doubled (the edit above contains no regex, so nothing to double).

- Concept-body behaviour change, call it out in the plan: `narrative(body, 'block')` replaces `renderMarkdown(body)` for primers. The allowlist (h2-h4, ul/ol/li, blockquote, pre, table family, dl) is exactly the element set renderMarkdown produced, so the storyteller must now author concept bodies as restricted HTML. Markdown-authored bodies in existing stories will render as literal text. Two ways to close that, decide before implementing: (a) migrate the storyteller skill and accept that old primers read as plain paragraphs, or (b) add a markdown→structural-tags pre-pass that emits UNESCAPED author text wrapped in allowlisted tags and feed that into narrative() — safe because the narrative parser stays the final authority, but it must not be `narrative(renderMarkdown(x))`, which would double-escape every `&`.

- `ConceptDiagram` must be removed from view-model.ts's `import type { … } from './types.js'` list once `ConceptDiagramView` replaces it — `noUnusedLocals` flags unused imports and the build will fail otherwise.

- Hotspot views are now built from `stepViews` rather than the raw `steps`, which removes a second parse of every flagged step's title. The `isCodeStep` guard becomes `step.kind !== 'concept'` because the array holds views, not tour steps; `isCodeStep` is still imported and used elsewhere in the module, so the import stays.

- `intent.sources` stays `string[]` (text-projected) — it is not rendered anywhere in render.ts today; I checked. `storyScope.reviewerNote` is likewise never rendered, only fed back into agent prompts, which is why it validates at the 'text' tier and gets no view-model field.

- story-picker.ts line 66 is NOT a narrative site despite being in the task list — it interpolates `s.scope.command`, `s.scope.label`, and `activity`, all derived from git scope and review state. It is left untouched. The real title sinks are 58 and 70 (twice: `data-story-title` and the `aria-label`), which is why the replacement hoists a single `title` const. `s.error` at 50 is a loader message, not authored prose, so it keeps plain `esc()`.

- Test fallout to expect, since every one of these reads a raw string today: test/view-model.test.mjs (asserts on step titles/why), test/render-page.test.mjs, test/render-accessibility.test.mjs, test/tour.test.mjs (error message list gains per-field narrative issues), test/motion-regressions.test.mjs and test/ui-layout-regressions.test.mjs (both grep rendered markup). Tests import from dist/, so rebuild before running. Per the repo rule, commit a rebuilt dist/ alongside the src/ change — github installs have no build step.
