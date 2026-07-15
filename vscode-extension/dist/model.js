"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCodeStep = isCodeStep;
exports.isReviewComment = isReviewComment;
exports.isLineRange = isLineRange;
exports.isSafeRelativePath = isSafeRelativePath;
exports.parseTour = parseTour;
function isCodeStep(step) {
    return step.kind !== 'concept';
}
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
        && (comment.severity === undefined || ['blocking', 'concern', 'nit'].includes(String(comment.severity)))
        && ['open', 'addressed', 'resolved'].includes(String(comment.status))
        && optionalString(comment.step)
        && optionalString(comment.selectedText)
        && optionalString(comment.reply)
        && optionalString(comment.reviewSnapshotId)
        && optionalString(comment.anchorHash)
        && (comment.reviewRound === undefined || positiveInteger(comment.reviewRound))
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
    if ((raw.version !== 1 && raw.version !== 2)
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
        if (typeof step.id !== 'string' || !step.id.trim() || !positiveInteger(step.order) || typeof step.title !== 'string' || !step.title.trim())
            return undefined;
        const tags = Array.isArray(step.tags) && step.tags.every((tag) => typeof tag === 'string' && tag.trim())
            ? step.tags
            : undefined;
        if (step.tags !== undefined && !tags)
            return undefined;
        if (step.kind === 'concept') {
            if (raw.version !== 2 || typeof step.body !== 'string' || !step.body.trim() || !Array.isArray(step.preparesFor) || !step.preparesFor.length || !step.preparesFor.every((id) => typeof id === 'string' && id.trim()) || new Set(step.preparesFor).size !== step.preparesFor.length)
                return undefined;
            const diagram = parseConceptDiagram(step.diagram);
            if (step.diagram !== undefined && !diagram)
                return undefined;
            steps.push({
                id: step.id,
                order: step.order,
                title: step.title,
                kind: 'concept',
                body: step.body,
                preparesFor: step.preparesFor,
                ...(diagram ? { diagram } : {}),
                ...(tags ? { tags } : {}),
            });
            continue;
        }
        const kind = step.kind === 'deleted' ? 'changed' : step.kind;
        const allowDeletionAnchor = kind === 'changed';
        if (!isSafeRelativePath(step.file) || typeof step.why !== 'string' || !['changed', 'context', 'new-file'].includes(String(kind)) || !isLineRange(step.range, allowDeletionAnchor))
            return undefined;
        if (step.viewport !== undefined && !isLineRange(step.viewport, allowDeletionAnchor))
            return undefined;
        const container = isLineRange(step.viewport, allowDeletionAnchor) ? step.viewport : step.range;
        const highlights = Array.isArray(step.highlights) && step.highlights.length > 0 && step.highlights.every((range) => isLineRange(range, allowDeletionAnchor) && rangeInside(range, container))
            ? step.highlights
            : undefined;
        if (step.highlights !== undefined && !highlights)
            return undefined;
        const beats = Array.isArray(step.beats)
            ? step.beats.map((beat) => {
                if (!beat || typeof beat !== 'object' || Array.isArray(beat))
                    return undefined;
                const b = beat;
                return typeof b.text === 'string' && b.text.trim() && Array.isArray(b.highlights) && b.highlights.length > 0 && b.highlights.every((range) => isLineRange(range, allowDeletionAnchor) && rangeInside(range, container))
                    ? { text: b.text, highlights: b.highlights }
                    : undefined;
            })
            : undefined;
        if (step.beats !== undefined && (!beats?.length || beats.some((beat) => !beat)))
            return undefined;
        const focus = parseFocus(step.focus, allowDeletionAnchor, container);
        if (step.focus !== undefined && !focus)
            return undefined;
        const calls = Array.isArray(step.calls) && step.calls.every((id) => typeof id === 'string' && id.trim()) ? step.calls : undefined;
        if (step.calls !== undefined && !calls)
            return undefined;
        if (step.returnsTo !== undefined && (typeof step.returnsTo !== 'string' || !step.returnsTo.trim()))
            return undefined;
        steps.push({
            id: step.id,
            order: step.order,
            title: step.title,
            file: step.file,
            range: step.range,
            ...(isLineRange(step.viewport, allowDeletionAnchor) ? { viewport: step.viewport } : {}),
            ...(highlights ? { highlights } : {}),
            ...(beats ? { beats: beats } : {}),
            ...(focus ? { focus } : {}),
            kind: kind,
            why: step.why,
            ...(tags ? { tags } : {}),
            ...(calls ? { calls } : {}),
            ...(typeof step.returnsTo === 'string' ? { returnsTo: step.returnsTo } : {}),
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
    if (!validTourRelations(steps, storyScope))
        return undefined;
    return {
        version: raw.version,
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
function parseFocus(value, allowDeletionAnchor, container) {
    if (value === undefined)
        return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const focus = value;
    if (!Array.isArray(focus.ranges) || !focus.ranges.length || !focus.ranges.every((range) => isLineRange(range, allowDeletionAnchor) && rangeInside(range, container)))
        return undefined;
    if (focus.label !== undefined && typeof focus.label !== 'string')
        return undefined;
    return { ranges: focus.ranges, ...(typeof focus.label === 'string' ? { label: focus.label } : {}) };
}
function parseConceptDiagram(value) {
    if (value === undefined)
        return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const diagram = value;
    if (diagram.type !== 'mermaid' || typeof diagram.source !== 'string' || typeof diagram.caption !== 'string' || !diagram.caption.trim() || !safeMermaid(diagram.source))
        return undefined;
    return { type: 'mermaid', source: diagram.source, caption: diagram.caption };
}
function parseIntent(value) {
    if (value === undefined)
        return undefined;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const intent = value;
    if (typeof intent.goal !== 'string' || !intent.goal.trim() || (intent.design !== undefined && typeof intent.design !== 'string'))
        return undefined;
    if (intent.sources !== undefined && (!Array.isArray(intent.sources) || !intent.sources.length || !intent.sources.every((source) => typeof source === 'string' && source.trim())))
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
    const included = scope.includedFiles;
    const excluded = Array.isArray(scope.excludedFiles) ? scope.excludedFiles : [];
    if (new Set(included).size !== included.length || new Set(excluded).size !== excluded.length || excluded.some((file) => included.includes(file)))
        return undefined;
    return {
        includedFiles: scope.includedFiles,
        ...(Array.isArray(scope.excludedFiles) ? { excludedFiles: scope.excludedFiles } : {}),
        ...(typeof scope.reviewerNote === 'string' ? { reviewerNote: scope.reviewerNote } : {}),
    };
}
function rangeInside(range, container) {
    if (range[0] === 0 || container[0] === 0)
        return range[0] === 0 && range[1] === 0 && container[0] === 0 && container[1] === 0;
    return range[0] >= container[0] && range[1] <= container[1];
}
function safeMermaid(source) {
    const value = source.trim();
    const lines = value.split(/\r?\n/);
    if (!value || value.length > 8_000 || lines.length > 80)
        return false;
    const declaration = lines.find((line) => line.trim() && !line.trim().startsWith('%%'))?.trim() ?? '';
    if (!/^(?:flowchart\s+(?:TD|TB|BT|LR|RL)|sequenceDiagram\b|stateDiagram-v2\b)/.test(declaration))
        return false;
    return ![
        /%%\s*\{/i,
        /\bclick\b/i,
        /\bhref\b/i,
        /(?:https?:|javascript:|data:)?\/\//i,
        /(?:javascript:|data:)/i,
        /<\/?[a-z][^>]*>/i,
        /\b(?:image|img)\s*:/i,
        /\b(?:classDef|linkStyle|style)\b/i,
    ].some((pattern) => pattern.test(value));
}
function validTourRelations(steps, storyScope) {
    if (!steps.some(isCodeStep))
        return false;
    if (new Set(steps.map((step) => step.id)).size !== steps.length)
        return false;
    if (new Set(steps.map((step) => step.order)).size !== steps.length)
        return false;
    const byId = new Map(steps.map((step) => [step.id, step]));
    const included = storyScope ? new Set(storyScope.includedFiles) : undefined;
    const ordered = [...steps].sort((a, b) => a.order - b.order);
    for (let index = 0; index < ordered.length; index += 1) {
        const step = ordered[index];
        if (!isCodeStep(step)) {
            const next = ordered[index + 1];
            if (!next || !isCodeStep(next) || !step.preparesFor.includes(next.id))
                return false;
            for (const id of step.preparesFor) {
                const target = byId.get(id);
                if (!target || !isCodeStep(target) || target.order <= step.order)
                    return false;
            }
            continue;
        }
        if (included && step.kind !== 'context' && !included.has(step.file))
            return false;
        for (const id of [...(step.calls ?? []), ...(step.returnsTo ? [step.returnsTo] : [])]) {
            const target = byId.get(id);
            if (!target || !isCodeStep(target))
                return false;
        }
    }
    return true;
}
//# sourceMappingURL=model.js.map