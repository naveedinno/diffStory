// Load and validate the story file (.diffstory/story.json). Validation is hand-rolled (no schema dep)
// but thorough — a malformed story should fail loudly with a useful message,
// not render a broken page.
import { readFileSync } from 'node:fs';
const KINDS = ['changed', 'context', 'new-file'];
const MODES = ['brief', 'guided', 'detailed'];
export class TourError extends Error {
}
function isLineNumber(v) {
    return typeof v === 'number' && Number.isInteger(v) && v > 0;
}
function validateLineRange(value, name, errors) {
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
function validateFocus(step, containerRange, containerName, where, errors) {
    if (step.focus === undefined)
        return;
    if (typeof step.focus !== 'object' || step.focus === null || Array.isArray(step.focus)) {
        errors.push(`${where}.focus must be an object`);
        return;
    }
    const focus = step.focus;
    if (focus.label !== undefined && typeof focus.label !== 'string') {
        errors.push(`${where}.focus.label must be a string`);
    }
    if (!Array.isArray(focus.ranges) || focus.ranges.length === 0) {
        errors.push(`${where}.focus.ranges must be a non-empty array`);
        return;
    }
    focus.ranges.forEach((range, j) => {
        const focusRange = validateLineRange(range, `${where}.focus.ranges[${j}]`, errors);
        if (focusRange &&
            containerRange &&
            (focusRange[0] < containerRange[0] || focusRange[1] > containerRange[1])) {
            errors.push(`${where}.focus.ranges[${j}] must be inside ${containerName}`);
        }
    });
}
function validateHighlights(step, containerRange, containerName, where, errors) {
    if (step.highlights === undefined)
        return;
    if (!Array.isArray(step.highlights) || step.highlights.length === 0) {
        errors.push(`${where}.highlights must be a non-empty array`);
        return;
    }
    step.highlights.forEach((range, j) => {
        const highlight = validateLineRange(range, `${where}.highlights[${j}]`, errors);
        if (highlight &&
            containerRange &&
            (highlight[0] < containerRange[0] || highlight[1] > containerRange[1])) {
            errors.push(`${where}.highlights[${j}] must be inside ${containerName}`);
        }
    });
}
export function loadTour(path) {
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    }
    catch {
        throw new TourError(`No review story found at ${path}. Open the diff in the diffStory app and generate one.`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (e) {
        throw new TourError(`${path} is not valid JSON: ${e.message}`);
    }
    canonicalizeStepKindAliases(parsed);
    const errors = validateTour(parsed);
    if (errors.length) {
        throw new TourError(`${path} is not a valid story:\n  - ${errors.join('\n  - ')}`);
    }
    return parsed;
}
function canonicalizeStepKindAliases(obj) {
    if (typeof obj !== 'object' || obj === null)
        return;
    const steps = obj.steps;
    if (!Array.isArray(steps))
        return;
    for (const s of steps) {
        if (typeof s !== 'object' || s === null)
            continue;
        const step = s;
        if (step.kind === 'deleted')
            step.kind = 'changed';
    }
}
export function validateTour(obj) {
    const errors = [];
    if (typeof obj !== 'object' || obj === null)
        return ['story must be a JSON object'];
    const t = obj;
    if (t.version !== 1)
        errors.push('version must be 1');
    if (t.mode !== undefined && !MODES.includes(t.mode)) {
        errors.push(`mode must be one of ${MODES.join(', ')}`);
    }
    if (typeof t.title !== 'string' || !t.title.trim())
        errors.push('title is required');
    if (typeof t.summary !== 'string')
        errors.push('summary is required (use "" if none)');
    if (!Array.isArray(t.steps) || t.steps.length === 0) {
        errors.push('steps must be a non-empty array');
        return errors;
    }
    const ids = new Set();
    t.steps.forEach((s, i) => {
        const where = `steps[${i}]`;
        if (typeof s !== 'object' || s === null) {
            errors.push(`${where} must be an object`);
            return;
        }
        const step = s;
        if (typeof step.id !== 'string' || !step.id)
            errors.push(`${where}.id is required`);
        else if (ids.has(step.id))
            errors.push(`${where}.id "${step.id}" is duplicated`);
        else
            ids.add(step.id);
        if (typeof step.order !== 'number')
            errors.push(`${where}.order must be a number`);
        if (typeof step.title !== 'string' || !step.title)
            errors.push(`${where}.title is required`);
        if (typeof step.file !== 'string' || !step.file)
            errors.push(`${where}.file is required`);
        if (typeof step.why !== 'string')
            errors.push(`${where}.why is required`);
        if (!KINDS.includes(step.kind)) {
            errors.push(`${where}.kind must be one of ${KINDS.join(', ')}`);
        }
        const stepRange = validateLineRange(step.range, `${where}.range`, errors);
        const viewportRange = step.viewport === undefined
            ? undefined
            : validateLineRange(step.viewport, `${where}.viewport`, errors);
        const containerRange = viewportRange ?? stepRange;
        const containerName = viewportRange ? `${where}.viewport` : `${where}.range`;
        validateFocus(step, containerRange, containerName, where, errors);
        validateHighlights(step, containerRange, containerName, where, errors);
    });
    // referential integrity for calls / returnsTo
    t.steps.forEach((s, i) => {
        const step = s;
        const refs = [...(step.calls ?? []), ...(step.returnsTo ? [step.returnsTo] : [])];
        for (const ref of refs) {
            if (!ids.has(ref))
                errors.push(`steps[${i}] references unknown step id "${ref}"`);
        }
    });
    return errors;
}
/** Steps in reading order. */
export function orderedSteps(tour) {
    return [...tour.steps].sort((a, b) => a.order - b.order);
}
