// Load and validate the story file (.diffstory/story.json). Validation is hand-rolled (no schema dep)
// but thorough — a malformed story should fail loudly with a useful message,
// not render a broken page.
import { readFileSync } from 'node:fs';
import type { Tour, TourStep, StepKind, StoryMode } from './types.js';

const KINDS: StepKind[] = ['changed', 'context', 'new-file'];
const MODES: StoryMode[] = ['brief', 'guided', 'detailed'];

export class TourError extends Error {}

function isLineNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function isDeletionAnchor(value: unknown): value is [0, 0] {
  return Array.isArray(value) && value.length === 2 && value[0] === 0 && value[1] === 0;
}

function validateLineRange(
  value: unknown,
  name: string,
  errors: string[],
  opts: { allowDeletionAnchor?: boolean } = {},
): [number, number] | undefined {
  if (isDeletionAnchor(value)) {
    if (opts.allowDeletionAnchor) return value;
    errors.push(`${name} can use [0, 0] only for a pure deleted-file changed step`);
    return undefined;
  }
  if (!Array.isArray(value) || value.length !== 2 || !isLineNumber(value[0]) || !isLineNumber(value[1])) {
    errors.push(`${name} must be [startLine, endLine]`);
    return undefined;
  }
  if (value[0] > value[1]) {
    errors.push(`${name} must start before it ends`);
    return undefined;
  }
  return [value[0], value[1]];
}

function validateFocus(
  step: Record<string, unknown>,
  containerRange: [number, number] | undefined,
  containerName: string,
  where: string,
  errors: string[],
  allowDeletionAnchor: boolean,
): void {
  if (step.focus === undefined) return;
  if (typeof step.focus !== 'object' || step.focus === null || Array.isArray(step.focus)) {
    errors.push(`${where}.focus must be an object`);
    return;
  }
  const focus = step.focus as Record<string, unknown>;
  if (focus.label !== undefined && typeof focus.label !== 'string') {
    errors.push(`${where}.focus.label must be a string`);
  }
  if (!Array.isArray(focus.ranges) || focus.ranges.length === 0) {
    errors.push(`${where}.focus.ranges must be a non-empty array`);
    return;
  }
  focus.ranges.forEach((range, j) => {
    const focusRange = validateLineRange(range, `${where}.focus.ranges[${j}]`, errors, { allowDeletionAnchor });
    if (
      focusRange &&
      containerRange &&
      (focusRange[0] < containerRange[0] || focusRange[1] > containerRange[1])
    ) {
      errors.push(`${where}.focus.ranges[${j}] must be inside ${containerName}`);
    }
  });
}

function validateHighlights(
  step: Record<string, unknown>,
  containerRange: [number, number] | undefined,
  containerName: string,
  where: string,
  errors: string[],
  allowDeletionAnchor: boolean,
): void {
  if (step.highlights === undefined) return;
  if (!Array.isArray(step.highlights) || step.highlights.length === 0) {
    errors.push(`${where}.highlights must be a non-empty array`);
    return;
  }
  step.highlights.forEach((range, j) => {
    const highlight = validateLineRange(range, `${where}.highlights[${j}]`, errors, { allowDeletionAnchor });
    if (
      highlight &&
      containerRange &&
      (highlight[0] < containerRange[0] || highlight[1] > containerRange[1])
    ) {
      errors.push(`${where}.highlights[${j}] must be inside ${containerName}`);
    }
  });
}

function validateBeatHighlights(
  beat: Record<string, unknown>,
  beatIndex: number,
  containerRange: [number, number] | undefined,
  containerName: string,
  where: string,
  errors: string[],
  allowDeletionAnchor: boolean,
): void {
  if (!Array.isArray(beat.highlights) || beat.highlights.length === 0) {
    errors.push(`${where}.beats[${beatIndex}].highlights must be a non-empty array`);
    return;
  }
  beat.highlights.forEach((range, j) => {
    const highlight = validateLineRange(range, `${where}.beats[${beatIndex}].highlights[${j}]`, errors, { allowDeletionAnchor });
    if (
      highlight &&
      containerRange &&
      (highlight[0] < containerRange[0] || highlight[1] > containerRange[1])
    ) {
      errors.push(`${where}.beats[${beatIndex}].highlights[${j}] must be inside ${containerName}`);
    }
  });
}

function validateBeats(
  step: Record<string, unknown>,
  containerRange: [number, number] | undefined,
  containerName: string,
  where: string,
  errors: string[],
  allowDeletionAnchor: boolean,
): void {
  if (step.beats === undefined) return;
  if (!Array.isArray(step.beats) || step.beats.length === 0) {
    errors.push(`${where}.beats must be a non-empty array`);
    return;
  }
  step.beats.forEach((rawBeat, i) => {
    if (typeof rawBeat !== 'object' || rawBeat === null || Array.isArray(rawBeat)) {
      errors.push(`${where}.beats[${i}] must be an object`);
      return;
    }
    const beat = rawBeat as Record<string, unknown>;
    if (typeof beat.text !== 'string' || !beat.text.trim()) {
      errors.push(`${where}.beats[${i}].text is required`);
    }
    validateBeatHighlights(beat, i, containerRange, containerName, where, errors, allowDeletionAnchor);
  });
}

function validateIntent(t: Record<string, unknown>, errors: string[]): void {
  if (t.intent === undefined) return;
  if (typeof t.intent !== 'object' || t.intent === null || Array.isArray(t.intent)) {
    errors.push('intent must be an object');
    return;
  }
  const intent = t.intent as Record<string, unknown>;
  if (typeof intent.goal !== 'string' || !intent.goal.trim()) errors.push('intent.goal is required');
  if (intent.design !== undefined && typeof intent.design !== 'string') errors.push('intent.design must be a string');
  if (intent.sources !== undefined) {
    if (!Array.isArray(intent.sources) || intent.sources.length === 0) {
      errors.push('intent.sources must be a non-empty array');
    } else {
      intent.sources.forEach((s, i) => {
        if (typeof s !== 'string' || !s.trim()) errors.push(`intent.sources[${i}] must be a non-empty string`);
      });
    }
  }
}

function validateStringArray(
  value: unknown,
  name: string,
  errors: string[],
  opts: { required?: boolean; nonEmpty?: boolean } = {},
): void {
  if (value === undefined) {
    if (opts.required) errors.push(`${name} is required`);
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${name} must be an array`);
    return;
  }
  if (opts.nonEmpty && value.length === 0) {
    errors.push(`${name} must be a non-empty array`);
    return;
  }
  value.forEach((s, i) => {
    if (typeof s !== 'string' || !s.trim()) errors.push(`${name}[${i}] must be a non-empty string`);
  });
}

function validateStoryScope(t: Record<string, unknown>, errors: string[]): void {
  if (t.storyScope === undefined) return;
  if (typeof t.storyScope !== 'object' || t.storyScope === null || Array.isArray(t.storyScope)) {
    errors.push('storyScope must be an object');
    return;
  }
  const scope = t.storyScope as Record<string, unknown>;
  validateStringArray(scope.includedFiles, 'storyScope.includedFiles', errors, {
    required: true,
    nonEmpty: true,
  });
  validateStringArray(scope.excludedFiles, 'storyScope.excludedFiles', errors);
  if (scope.reviewerNote !== undefined && typeof scope.reviewerNote !== 'string') {
    errors.push('storyScope.reviewerNote must be a string');
  }
}

function storyScopeIncludedFiles(t: Record<string, unknown>): Set<string> | null {
  if (typeof t.storyScope !== 'object' || t.storyScope === null || Array.isArray(t.storyScope)) return null;
  const includedFiles = (t.storyScope as Record<string, unknown>).includedFiles;
  if (!Array.isArray(includedFiles) || includedFiles.length === 0) return null;
  if (!includedFiles.every((f) => typeof f === 'string' && f.trim())) return null;
  return new Set(includedFiles as string[]);
}

export function loadTour(path: string): Tour {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new TourError(`No review story found at ${path}. Open the diff in the diffStory app and generate one.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new TourError(`${path} is not valid JSON: ${(e as Error).message}`);
  }
  canonicalizeStepKindAliases(parsed);
  const errors = validateTour(parsed);
  if (errors.length) {
    throw new TourError(`${path} is not a valid story:\n  - ${errors.join('\n  - ')}`);
  }
  return parsed as Tour;
}

function canonicalizeStepKindAliases(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) return;
  const steps = (obj as Record<string, unknown>).steps;
  if (!Array.isArray(steps)) return;
  for (const s of steps) {
    if (typeof s !== 'object' || s === null) continue;
    const step = s as Record<string, unknown>;
    if (step.kind === 'deleted') step.kind = 'changed';
  }
}

export function validateTour(obj: unknown): string[] {
  const errors: string[] = [];
  if (typeof obj !== 'object' || obj === null) return ['story must be a JSON object'];
  const t = obj as Record<string, unknown>;

  if (t.version !== 1) errors.push('version must be 1');
  if (t.mode !== undefined && !MODES.includes(t.mode as StoryMode)) {
    errors.push(`mode must be one of ${MODES.join(', ')}`);
  }
  if (typeof t.title !== 'string' || !t.title.trim()) errors.push('title is required');
  if (typeof t.summary !== 'string') errors.push('summary is required (use "" if none)');
  validateIntent(t, errors);
  validateStoryScope(t, errors);
  if (!Array.isArray(t.steps) || t.steps.length === 0) {
    errors.push('steps must be a non-empty array');
    return errors;
  }

  const storyFiles = storyScopeIncludedFiles(t);
  const ids = new Set<string>();
  t.steps.forEach((s, i) => {
    const where = `steps[${i}]`;
    if (typeof s !== 'object' || s === null) {
      errors.push(`${where} must be an object`);
      return;
    }
    const step = s as Record<string, unknown>;
    if (typeof step.id !== 'string' || !step.id) errors.push(`${where}.id is required`);
    else if (ids.has(step.id)) errors.push(`${where}.id "${step.id}" is duplicated`);
    else ids.add(step.id);

    if (typeof step.order !== 'number') errors.push(`${where}.order must be a number`);
    if (typeof step.title !== 'string' || !step.title) errors.push(`${where}.title is required`);
    if (typeof step.file !== 'string' || !step.file) errors.push(`${where}.file is required`);
    if (typeof step.why !== 'string') errors.push(`${where}.why is required`);
    const stepKind = step.kind as StepKind;
    if (!KINDS.includes(stepKind)) {
      errors.push(`${where}.kind must be one of ${KINDS.join(', ')}`);
    }
    if (storyFiles && stepKind !== 'context' && typeof step.file === 'string' && !storyFiles.has(step.file)) {
      errors.push(`${where}.file must be in storyScope.includedFiles`);
    }
    const allowDeletionAnchor = stepKind === 'changed';
    const stepRange = validateLineRange(step.range, `${where}.range`, errors, { allowDeletionAnchor });
    const viewportRange = step.viewport === undefined
      ? undefined
      : validateLineRange(step.viewport, `${where}.viewport`, errors, { allowDeletionAnchor });
    const containerRange = viewportRange ?? stepRange;
    const containerName = viewportRange ? `${where}.viewport` : `${where}.range`;
    validateFocus(step, containerRange, containerName, where, errors, allowDeletionAnchor);
    validateHighlights(step, containerRange, containerName, where, errors, allowDeletionAnchor);
    validateBeats(step, containerRange, containerName, where, errors, allowDeletionAnchor);
  });

  // referential integrity for calls / returnsTo
  t.steps.forEach((s, i) => {
    const step = s as Partial<TourStep>;
    const refs = [...(step.calls ?? []), ...(step.returnsTo ? [step.returnsTo] : [])];
    for (const ref of refs) {
      if (!ids.has(ref)) errors.push(`steps[${i}] references unknown step id "${ref}"`);
    }
  });

  return errors;
}

/** Steps in reading order. */
export function orderedSteps(tour: Tour): TourStep[] {
  return [...tour.steps].sort((a, b) => a.order - b.order);
}
