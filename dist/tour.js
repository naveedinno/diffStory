// Load and validate the story file (.diffstory/story.json). Validation is hand-rolled (no schema dep)
// but thorough — a malformed story should fail loudly with a useful message,
// not render a broken page.
import { readFileSync } from 'node:fs';
const CODE_KINDS = ['changed', 'context', 'new-file'];
const KINDS = [...CODE_KINDS, 'concept'];
const MODES = ['brief', 'guided', 'detailed'];
const CONCEPT_CODE_FIELDS = [
    'file',
    'range',
    'viewport',
    'highlights',
    'beats',
    'focus',
    'why',
    'calls',
    'returnsTo',
];
const CONCEPT_MIN_WORDS = 60;
const CONCEPT_MAX_WORDS = 220;
const MERMAID_MAX_CHARS = 8_000;
const MERMAID_MAX_LINES = 80;
export class TourError extends Error {
}
function isLineNumber(v) {
    return typeof v === 'number' && Number.isInteger(v) && v > 0;
}
function isDeletionAnchor(value) {
    return Array.isArray(value) && value.length === 2 && value[0] === 0 && value[1] === 0;
}
function mergedLineRanges(ranges) {
    const sorted = ranges
        .filter((range) => !isDeletionAnchor(range))
        .map((range) => [...range])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged = [];
    for (const range of sorted) {
        const previous = merged[merged.length - 1];
        if (!previous || range[0] > previous[1] + 1)
            merged.push(range);
        else
            previous[1] = Math.max(previous[1], range[1]);
    }
    return merged;
}
function sameLineCoverage(a, b) {
    if (a.some(isDeletionAnchor) || b.some(isDeletionAnchor)) {
        return a.length === 1 && b.length === 1 && isDeletionAnchor(a[0]) && isDeletionAnchor(b[0]);
    }
    return JSON.stringify(mergedLineRanges(a)) === JSON.stringify(mergedLineRanges(b));
}
function validateLineRange(value, name, errors, opts = {}) {
    if (isDeletionAnchor(value)) {
        if (opts.allowDeletionAnchor)
            return value;
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
function validateFocus(step, containerRange, containerName, where, errors, allowDeletionAnchor) {
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
        const focusRange = validateLineRange(range, `${where}.focus.ranges[${j}]`, errors, { allowDeletionAnchor });
        if (focusRange &&
            containerRange &&
            (focusRange[0] < containerRange[0] || focusRange[1] > containerRange[1])) {
            errors.push(`${where}.focus.ranges[${j}] must be inside ${containerName}`);
        }
    });
}
function validateHighlights(step, containerRange, containerName, where, errors, allowDeletionAnchor) {
    if (step.highlights === undefined)
        return;
    if (!Array.isArray(step.highlights) || step.highlights.length === 0) {
        errors.push(`${where}.highlights must be a non-empty array`);
        return;
    }
    step.highlights.forEach((range, j) => {
        const highlight = validateLineRange(range, `${where}.highlights[${j}]`, errors, { allowDeletionAnchor });
        if (highlight &&
            containerRange &&
            (highlight[0] < containerRange[0] || highlight[1] > containerRange[1])) {
            errors.push(`${where}.highlights[${j}] must be inside ${containerName}`);
        }
    });
}
function validateBeatHighlights(beat, beatIndex, containerRange, containerName, where, errors, allowDeletionAnchor) {
    if (!Array.isArray(beat.highlights) || beat.highlights.length === 0) {
        errors.push(`${where}.beats[${beatIndex}].highlights must be a non-empty array`);
        return;
    }
    beat.highlights.forEach((range, j) => {
        const highlight = validateLineRange(range, `${where}.beats[${beatIndex}].highlights[${j}]`, errors, { allowDeletionAnchor });
        if (highlight &&
            containerRange &&
            (highlight[0] < containerRange[0] || highlight[1] > containerRange[1])) {
            errors.push(`${where}.beats[${beatIndex}].highlights[${j}] must be inside ${containerName}`);
        }
    });
}
function validateBeats(step, containerRange, containerName, where, errors, allowDeletionAnchor) {
    if (step.beats === undefined)
        return;
    if (!Array.isArray(step.beats) || step.beats.length === 0) {
        errors.push(`${where}.beats must be a non-empty array`);
        return;
    }
    step.beats.forEach((rawBeat, i) => {
        if (typeof rawBeat !== 'object' || rawBeat === null || Array.isArray(rawBeat)) {
            errors.push(`${where}.beats[${i}] must be an object`);
            return;
        }
        const beat = rawBeat;
        if (typeof beat.text !== 'string' || !beat.text.trim()) {
            errors.push(`${where}.beats[${i}].text is required`);
        }
        validateBeatHighlights(beat, i, containerRange, containerName, where, errors, allowDeletionAnchor);
    });
}
function validateIntent(t, errors) {
    if (t.intent === undefined)
        return;
    if (typeof t.intent !== 'object' || t.intent === null || Array.isArray(t.intent)) {
        errors.push('intent must be an object');
        return;
    }
    const intent = t.intent;
    if (typeof intent.goal !== 'string' || !intent.goal.trim())
        errors.push('intent.goal is required');
    if (intent.design !== undefined && typeof intent.design !== 'string')
        errors.push('intent.design must be a string');
    if (intent.sources !== undefined) {
        if (!Array.isArray(intent.sources) || intent.sources.length === 0) {
            errors.push('intent.sources must be a non-empty array');
        }
        else {
            intent.sources.forEach((s, i) => {
                if (typeof s !== 'string' || !s.trim())
                    errors.push(`intent.sources[${i}] must be a non-empty string`);
            });
        }
    }
}
function validateStringArray(value, name, errors, opts = {}) {
    if (value === undefined) {
        if (opts.required)
            errors.push(`${name} is required`);
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
        if (typeof s !== 'string' || !s.trim())
            errors.push(`${name}[${i}] must be a non-empty string`);
    });
}
function validateStoryScope(t, errors) {
    if (t.storyScope === undefined)
        return;
    if (typeof t.storyScope !== 'object' || t.storyScope === null || Array.isArray(t.storyScope)) {
        errors.push('storyScope must be an object');
        return;
    }
    const scope = t.storyScope;
    validateStringArray(scope.includedFiles, 'storyScope.includedFiles', errors, {
        required: true,
        nonEmpty: true,
    });
    validateStringArray(scope.excludedFiles, 'storyScope.excludedFiles', errors);
    if (scope.reviewerNote !== undefined && typeof scope.reviewerNote !== 'string') {
        errors.push('storyScope.reviewerNote must be a string');
    }
}
function validateConceptDiagram(value, where, errors) {
    if (value === undefined)
        return;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push(`${where}.diagram must be an object`);
        return;
    }
    const diagram = value;
    if (diagram.type !== 'mermaid')
        errors.push(`${where}.diagram.type must be "mermaid"`);
    if (typeof diagram.caption !== 'string' || !diagram.caption.trim()) {
        errors.push(`${where}.diagram.caption is required`);
    }
    if (typeof diagram.source !== 'string' || !diagram.source.trim()) {
        errors.push(`${where}.diagram.source is required`);
        return;
    }
    const source = diagram.source.trim();
    const lines = source.split(/\r?\n/);
    if (source.length > MERMAID_MAX_CHARS) {
        errors.push(`${where}.diagram.source must be at most ${MERMAID_MAX_CHARS} characters`);
    }
    if (lines.length > MERMAID_MAX_LINES) {
        errors.push(`${where}.diagram.source must be at most ${MERMAID_MAX_LINES} lines`);
    }
    const declaration = lines.find((line) => line.trim() && !line.trim().startsWith('%%'))?.trim() ?? '';
    if (!/^(?:flowchart\s+(?:TD|TB|BT|LR|RL)|sequenceDiagram\b|stateDiagram-v2\b)/.test(declaration)) {
        errors.push(`${where}.diagram.source must start with flowchart, sequenceDiagram, or stateDiagram-v2`);
    }
    const unsafePatterns = [
        [/%%\s*\{/i, 'configuration directives'],
        [/\bclick\b/i, 'click directives'],
        [/\bhref\b/i, 'href directives'],
        [/(?:https?:|javascript:|data:)?\/\//i, 'external URLs'],
        [/(?:javascript:|data:)/i, 'executable or embedded URLs'],
        [/<\/?[a-z][^>]*>/i, 'HTML tags'],
        [/\b(?:image|img)\s*:/i, 'image directives'],
        [/\b(?:classDef|linkStyle|style)\b/i, 'custom style directives'],
    ];
    for (const [pattern, label] of unsafePatterns) {
        if (pattern.test(source))
            errors.push(`${where}.diagram.source cannot contain unsafe ${label}`);
    }
}
function validateConceptStep(step, where, errors) {
    if (typeof step.body !== 'string' || !step.body.trim())
        errors.push(`${where}.body is required`);
    validateStringArray(step.preparesFor, `${where}.preparesFor`, errors, { required: true, nonEmpty: true });
    if (Array.isArray(step.preparesFor)) {
        const refs = step.preparesFor.filter((ref) => typeof ref === 'string');
        if (new Set(refs).size !== refs.length)
            errors.push(`${where}.preparesFor must not contain duplicate step ids`);
    }
    validateConceptDiagram(step.diagram, where, errors);
    for (const field of CONCEPT_CODE_FIELDS) {
        if (step[field] !== undefined)
            errors.push(`${where}.${field} is not allowed for a concept step`);
    }
}
function validateCodeStep(step, where, storyFiles, errors) {
    const stepKind = step.kind;
    if (typeof step.file !== 'string' || !step.file)
        errors.push(`${where}.file is required`);
    if (typeof step.why !== 'string')
        errors.push(`${where}.why is required`);
    validateStringArray(step.calls, `${where}.calls`, errors);
    if (step.returnsTo !== undefined && typeof step.returnsTo !== 'string') {
        errors.push(`${where}.returnsTo must be a string`);
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
}
function storyScopeIncludedFiles(t) {
    if (typeof t.storyScope !== 'object' || t.storyScope === null || Array.isArray(t.storyScope))
        return null;
    const includedFiles = t.storyScope.includedFiles;
    if (!Array.isArray(includedFiles) || includedFiles.length === 0)
        return null;
    if (!includedFiles.every((f) => typeof f === 'string' && f.trim()))
        return null;
    return new Set(includedFiles);
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
    if (t.version !== 1 && t.version !== 2)
        errors.push('version must be 1 or 2');
    if (t.diffFingerprint !== undefined && !/^[0-9a-f]{64}$/i.test(String(t.diffFingerprint))) {
        errors.push('diffFingerprint must be a SHA-256 hex digest');
    }
    if (t.mode !== undefined && !MODES.includes(t.mode)) {
        errors.push(`mode must be one of ${MODES.join(', ')}`);
    }
    if (typeof t.title !== 'string' || !t.title.trim())
        errors.push('title is required');
    if (typeof t.summary !== 'string')
        errors.push('summary is required (use "" if none)');
    validateIntent(t, errors);
    validateStoryScope(t, errors);
    if (!Array.isArray(t.steps) || t.steps.length === 0) {
        errors.push('steps must be a non-empty array');
        return errors;
    }
    const rawSteps = t.steps;
    const storyFiles = storyScopeIncludedFiles(t);
    const ids = new Set();
    const orders = new Set();
    const stepsById = new Map();
    let codeStepCount = 0;
    rawSteps.forEach((s, i) => {
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
        else {
            ids.add(step.id);
            stepsById.set(step.id, step);
        }
        if (typeof step.order !== 'number') {
            errors.push(`${where}.order must be a number`);
        }
        else if (!Number.isInteger(step.order) || step.order <= 0) {
            errors.push(`${where}.order must be a positive integer`);
        }
        else if (orders.has(step.order)) {
            errors.push(`${where}.order ${step.order} is duplicated`);
        }
        else {
            orders.add(step.order);
        }
        if (typeof step.title !== 'string' || !step.title)
            errors.push(`${where}.title is required`);
        validateStringArray(step.tags, `${where}.tags`, errors);
        const stepKind = step.kind;
        if (!KINDS.includes(stepKind)) {
            errors.push(`${where}.kind must be one of ${KINDS.join(', ')}`);
            // Keep reporting malformed code-anchor fields alongside the bad kind, as
            // v1 validation did, so authors can fix one step in a single pass.
            validateCodeStep(step, where, storyFiles, errors);
            return;
        }
        if (stepKind === 'concept') {
            if (t.version !== 2)
                errors.push(`${where}.kind "concept" requires story version 2`);
            validateConceptStep(step, where, errors);
        }
        else {
            codeStepCount += 1;
            validateCodeStep(step, where, storyFiles, errors);
        }
    });
    if (codeStepCount === 0)
        errors.push('steps must include at least one code step');
    // Referential integrity for code flow and concept-to-code preparation links.
    // A story's reading path is defined by `order`, even when the JSON array was
    // authored out of order, so adjacency checks use that same canonical path.
    const readingPath = rawSteps
        .map((step, sourceIndex) => ({ step, sourceIndex }))
        .sort((a, b) => {
        const aOrder = typeof a.step?.order === 'number'
            ? a.step.order
            : Number.MAX_SAFE_INTEGER;
        const bOrder = typeof b.step?.order === 'number'
            ? b.step.order
            : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || a.sourceIndex - b.sourceIndex;
    });
    readingPath.forEach(({ step: s, sourceIndex: i }, pathIndex) => {
        if (typeof s !== 'object' || s === null)
            return;
        const step = s;
        if (step.kind === 'concept') {
            const refs = Array.isArray(step.preparesFor)
                ? step.preparesFor.filter((ref) => typeof ref === 'string')
                : [];
            const next = readingPath[pathIndex + 1]?.step;
            if (!next || typeof next !== 'object' || next === null) {
                errors.push(`steps[${i}] concept step cannot be the last step`);
            }
            else if (next.kind === 'concept') {
                errors.push(`steps[${i}] concept steps cannot be adjacent`);
            }
            else if (typeof next.id === 'string' && !refs.includes(next.id)) {
                errors.push(`steps[${i}].preparesFor must include the immediately following code step`);
            }
            for (const ref of refs) {
                const target = stepsById.get(ref);
                if (!target) {
                    errors.push(`steps[${i}].preparesFor must reference a known later code step; "${ref}" is unknown`);
                    continue;
                }
                if (target.kind === 'concept') {
                    errors.push(`steps[${i}].preparesFor must reference later code steps, not concept "${ref}"`);
                }
                if (typeof step.order === 'number' && typeof target.order === 'number' && target.order <= step.order) {
                    errors.push(`steps[${i}].preparesFor must reference later code steps`);
                }
            }
            return;
        }
        const refs = [
            ...(Array.isArray(step.calls)
                ? step.calls
                    .filter((ref) => typeof ref === 'string')
                    .map((ref) => ['calls', ref])
                : []),
            ...(typeof step.returnsTo === 'string' ? [['returnsTo', step.returnsTo]] : []),
        ];
        for (const [field, ref] of refs) {
            if (!ids.has(ref)) {
                errors.push(`steps[${i}] references unknown step id "${ref}"`);
            }
            else if (stepsById.get(ref)?.kind === 'concept') {
                errors.push(`steps[${i}].${field} must reference code steps, not concept "${ref}"`);
            }
        }
    });
    return errors;
}
function conceptWordCount(body) {
    return body.match(/[\p{L}\p{N}_][\p{L}\p{N}_'-]*/gu)?.length ?? 0;
}
/**
 * Generated-primer rules that also apply when a targeted repair upgrades a
 * legacy code-only story. They intentionally do not impose modern camera
 * requirements on untouched v1-era code steps.
 */
export function validateGeneratedConceptSteps(tour) {
    const errors = [];
    const concepts = tour.steps
        .map((step, index) => ({ step, index }))
        .filter((entry) => entry.step.kind === 'concept');
    if (!concepts.length)
        return errors;
    const mode = tour.mode ?? 'guided';
    const limit = mode === 'brief' ? 1 : mode === 'detailed' ? 3 : 2;
    if (concepts.length > limit) {
        errors.push(`${mode} stories can include at most ${limit === 1 ? 'one' : limit === 2 ? 'two' : 'three'} concept ${limit === 1 ? 'step' : 'steps'}`);
    }
    for (const { step, index } of concepts) {
        const words = conceptWordCount(step.body);
        if (words < CONCEPT_MIN_WORDS) {
            errors.push(`steps[${index}].body must contain at least ${CONCEPT_MIN_WORDS} words`);
        }
        if (words > CONCEPT_MAX_WORDS) {
            errors.push(`steps[${index}].body must stay within ${CONCEPT_MAX_WORDS} words`);
        }
    }
    return errors;
}
/**
 * New stories generated by the app must use the modern storyteller contract.
 * `validateTour()` intentionally stays backward-compatible so older hand-written
 * stories still open; this stricter profile is only applied at generation time.
 */
export function validateGeneratedTour(tour) {
    const errors = validateGeneratedConceptSteps(tour);
    if (tour.version !== 2)
        errors.push('version must be 2 for a generated story');
    if (!tour.mode)
        errors.push('mode is required for a generated story');
    if (!tour.summary.trim())
        errors.push('summary must explain the generated reading path');
    if (!tour.intent) {
        errors.push('intent is required for a generated story');
    }
    else {
        if (!tour.intent.design?.trim()) {
            errors.push('intent.design must explain the existing app path, attachment point, and new outcome');
        }
        if (!tour.intent.sources?.length) {
            errors.push('intent.sources must name the evidence used to recover the task');
        }
    }
    tour.steps.forEach((step, i) => {
        const where = `steps[${i}]`;
        if (step.kind === 'concept') {
            return;
        }
        if (!step.why.trim())
            errors.push(`${where}.why must be a non-empty fallback recap`);
        if (!step.viewport)
            errors.push(`${where}.viewport is required for a generated story`);
        if (!step.highlights?.length)
            errors.push(`${where}.highlights are required for a generated story`);
        if (!step.beats?.length)
            errors.push(`${where}.beats are required for a generated story`);
        if (step.viewport && !isDeletionAnchor(step.range) && !isDeletionAnchor(step.viewport)) {
            if (step.range[0] < step.viewport[0] || step.range[1] > step.viewport[1]) {
                errors.push(`${where}.range must be inside ${where}.viewport`);
            }
            if (step.viewport[1] - step.viewport[0] + 1 > 60) {
                errors.push(`${where}.viewport must stay within one 60-line camera shot`);
            }
        }
        step.beats?.forEach((beat, beatIndex) => {
            beat.highlights.forEach((highlight, highlightIndex) => {
                if (!isDeletionAnchor(highlight) && highlight[1] - highlight[0] + 1 > 12) {
                    errors.push(`${where}.beats[${beatIndex}].highlights[${highlightIndex}] must point at at most 12 lines`);
                }
            });
        });
        if (step.highlights?.length && step.beats?.length) {
            const beatHighlights = step.beats.flatMap((beat) => beat.highlights);
            if (!sameLineCoverage(step.highlights, beatHighlights)) {
                errors.push(`${where}.highlights must match the union of ${where}.beats highlights`);
            }
        }
        if (step.kind !== 'context' && step.beats?.length) {
            const coversChange = step.beats.some((beat) => beat.highlights.some((highlight) => isDeletionAnchor(step.range)
                ? isDeletionAnchor(highlight)
                : !isDeletionAnchor(highlight) && highlight[0] <= step.range[1] && highlight[1] >= step.range[0]));
            if (!coversChange) {
                errors.push(`${where}.beats must include a highlight that overlaps the changed range`);
            }
        }
    });
    return errors;
}
/** Steps in reading order. */
export function orderedSteps(tour) {
    return [...tour.steps].sort((a, b) => a.order - b.order);
}
