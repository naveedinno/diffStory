// Load and validate the story file (.diffstory/story.json). Validation is hand-rolled (no schema dep)
// but thorough — a malformed story should fail loudly with a useful message,
// not render a broken page.
import { readFileSync } from 'node:fs';
import type { Tour, TourStep, StepKind, StoryMode } from './types.js';

const KINDS: StepKind[] = ['changed', 'context', 'new-file'];
const MODES: StoryMode[] = ['guided', 'detailed'];

export class TourError extends Error {}

function isLineNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function validateLineRange(value: unknown, name: string, errors: string[]): [number, number] | undefined {
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
  stepRange: [number, number] | undefined,
  where: string,
  errors: string[],
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
    const focusRange = validateLineRange(range, `${where}.focus.ranges[${j}]`, errors);
    if (
      focusRange &&
      stepRange &&
      (focusRange[0] < stepRange[0] || focusRange[1] > stepRange[1])
    ) {
      errors.push(`${where}.focus.ranges[${j}] must be inside ${where}.range`);
    }
  });
}

export function loadTour(path: string): Tour {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new TourError(`No review story found at ${path}. Run "diffstory story" to create one.`);
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
  if (!Array.isArray(t.steps) || t.steps.length === 0) {
    errors.push('steps must be a non-empty array');
    return errors;
  }

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
    if (!KINDS.includes(step.kind as StepKind)) {
      errors.push(`${where}.kind must be one of ${KINDS.join(', ')}`);
    }
    const stepRange = validateLineRange(step.range, `${where}.range`, errors);
    validateFocus(step, stepRange, where, errors);
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
