"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReviewComment = isReviewComment;
exports.isLineRange = isLineRange;
exports.isSafeRelativePath = isSafeRelativePath;
exports.parseTour = parseTour;
function isReviewComment(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const comment = value;
    return typeof comment.id === 'string'
        && isSafeRelativePath(comment.file)
        && typeof comment.line === 'number'
        && Number.isInteger(comment.line)
        && comment.line > 0
        && typeof comment.body === 'string'
        && typeof comment.createdAt === 'string'
        && ['change', 'question', 'nit'].includes(String(comment.type))
        && ['open', 'addressed', 'resolved'].includes(String(comment.status))
        && optionalString(comment.step)
        && optionalString(comment.selectedText)
        && optionalString(comment.reply)
        && optionalString(comment.anchorHash)
        && (comment.side === undefined || comment.side === 'left' || comment.side === 'right')
        && (comment.selection === undefined || isCommentSelection(comment.selection))
        && (comment.turns === undefined || (Array.isArray(comment.turns) && comment.turns.every(isCommentTurn)));
}
function optionalString(value) {
    return value === undefined || typeof value === 'string';
}
function isCommentSelection(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const selection = value;
    return positiveInteger(selection.startLine)
        && positiveInteger(selection.endLine)
        && selection.startLine <= selection.endLine
        && (selection.startColumn === undefined || positiveInteger(selection.startColumn))
        && (selection.endColumn === undefined || positiveInteger(selection.endColumn));
}
function isCommentTurn(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const turn = value;
    return (turn.role === 'user' || turn.role === 'ai')
        && typeof turn.text === 'string'
        && typeof turn.at === 'string';
}
function positiveInteger(value) {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
function isLineRange(value, allowDeletionAnchor = false) {
    return Array.isArray(value)
        && value.length === 2
        && value.every((part) => typeof part === 'number' && Number.isInteger(part))
        && ((allowDeletionAnchor && value[0] === 0 && value[1] === 0) || (value[0] > 0 && value[0] <= value[1]));
}
function isSafeRelativePath(value) {
    return typeof value === 'string'
        && value.length > 0
        && !value.startsWith('/')
        && !value.startsWith('\\')
        && !value.includes('\\')
        && !value.includes('\0')
        && !value.split('/').includes('..');
}
function parseTour(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const raw = value;
    if (raw.version !== 1
        || typeof raw.title !== 'string'
        || typeof raw.summary !== 'string'
        || !Array.isArray(raw.steps)
        || raw.steps.length === 0) {
        return undefined;
    }
    const steps = [];
    for (const candidate of raw.steps) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
            return undefined;
        const step = candidate;
        if (typeof step.id !== 'string'
            || typeof step.order !== 'number'
            || typeof step.title !== 'string'
            || !isSafeRelativePath(step.file)
            || typeof step.why !== 'string'
            || !['changed', 'context', 'new-file'].includes(String(step.kind))
            || !isLineRange(step.range, true))
            return undefined;
        const highlights = Array.isArray(step.highlights) && step.highlights.every((range) => isLineRange(range, true))
            ? step.highlights
            : undefined;
        const beats = Array.isArray(step.beats)
            ? step.beats.map((beat) => {
                if (!beat || typeof beat !== 'object' || Array.isArray(beat))
                    return undefined;
                const b = beat;
                return typeof b.text === 'string' && Array.isArray(b.highlights) && b.highlights.every((range) => isLineRange(range, true))
                    ? { text: b.text, highlights: b.highlights }
                    : undefined;
            })
            : undefined;
        if (beats?.some((beat) => !beat))
            return undefined;
        steps.push({
            id: step.id,
            order: step.order,
            title: step.title,
            file: step.file,
            range: step.range,
            ...(isLineRange(step.viewport, true) ? { viewport: step.viewport } : {}),
            ...(highlights ? { highlights } : {}),
            ...(beats ? { beats: beats } : {}),
            kind: step.kind,
            why: step.why,
            ...(Array.isArray(step.tags) && step.tags.every((tag) => typeof tag === 'string') ? { tags: step.tags } : {}),
        });
    }
    const intent = parseIntent(raw.intent);
    if (raw.intent !== undefined && !intent)
        return undefined;
    const storyScope = parseStoryScope(raw.storyScope);
    if (raw.storyScope !== undefined && !storyScope)
        return undefined;
    if (raw.diffFingerprint !== undefined && (typeof raw.diffFingerprint !== 'string' || !/^[0-9a-f]{64}$/i.test(raw.diffFingerprint)))
        return undefined;
    if (raw.mode !== undefined && raw.mode !== 'brief' && raw.mode !== 'guided' && raw.mode !== 'detailed')
        return undefined;
    return {
        version: 1,
        ...(typeof raw.diffFingerprint === 'string' ? { diffFingerprint: raw.diffFingerprint.toLowerCase() } : {}),
        ...(raw.mode === 'brief' || raw.mode === 'guided' || raw.mode === 'detailed' ? { mode: raw.mode } : {}),
        title: raw.title,
        summary: raw.summary,
        ...(typeof raw.base === 'string' ? { base: raw.base } : {}),
        ...(typeof raw.head === 'string' ? { head: raw.head } : {}),
        ...(intent ? { intent } : {}),
        ...(storyScope ? { storyScope } : {}),
        steps: steps.sort((a, b) => a.order - b.order),
    };
}
function parseIntent(value) {
    if (value === undefined)
        return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const intent = value;
    if (typeof intent.goal !== 'string' || (intent.design !== undefined && typeof intent.design !== 'string'))
        return undefined;
    if (intent.sources !== undefined && (!Array.isArray(intent.sources) || !intent.sources.every((source) => typeof source === 'string')))
        return undefined;
    return {
        goal: intent.goal,
        ...(typeof intent.design === 'string' ? { design: intent.design } : {}),
        ...(Array.isArray(intent.sources) ? { sources: intent.sources } : {}),
    };
}
function parseStoryScope(value) {
    if (value === undefined)
        return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const scope = value;
    if (!Array.isArray(scope.includedFiles) || scope.includedFiles.length === 0 || !scope.includedFiles.every(isSafeRelativePath))
        return undefined;
    if (scope.excludedFiles !== undefined && (!Array.isArray(scope.excludedFiles) || !scope.excludedFiles.every(isSafeRelativePath)))
        return undefined;
    if (scope.reviewerNote !== undefined && typeof scope.reviewerNote !== 'string')
        return undefined;
    return {
        includedFiles: scope.includedFiles,
        ...(Array.isArray(scope.excludedFiles) ? { excludedFiles: scope.excludedFiles } : {}),
        ...(typeof scope.reviewerNote === 'string' ? { reviewerNote: scope.reviewerNote } : {}),
    };
}
//# sourceMappingURL=model.js.map