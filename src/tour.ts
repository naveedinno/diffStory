// Load and validate the story file (.diffstory/story.json). Validation is hand-rolled (no schema dep)
// but thorough — a malformed tour should fail loudly with a useful message,
// not render a broken page.
import { readFileSync } from 'node:fs';
import type { Tour, TourStep, StepKind } from './types.js';

const KINDS: StepKind[] = ['changed', 'context', 'new-file'];

export class TourError extends Error {}

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
  const errors = validateTour(parsed);
  if (errors.length) {
    throw new TourError(`${path} is not a valid tour:\n  - ${errors.join('\n  - ')}`);
  }
  return parsed as Tour;
}

export function validateTour(obj: unknown): string[] {
  const errors: string[] = [];
  if (typeof obj !== 'object' || obj === null) return ['tour must be a JSON object'];
  const t = obj as Record<string, unknown>;

  if (t.version !== 1) errors.push('version must be 1');
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
    if (
      !Array.isArray(step.range) ||
      step.range.length !== 2 ||
      typeof step.range[0] !== 'number' ||
      typeof step.range[1] !== 'number'
    ) {
      errors.push(`${where}.range must be [startLine, endLine]`);
    }
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
