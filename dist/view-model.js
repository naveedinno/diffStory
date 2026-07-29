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
import { narrative, narrativeText } from './narrative.js';
import { createHash } from 'node:crypto';
const STEP_KIND_LABEL = {
    changed: 'Changed',
    context: 'Context',
    'new-file': 'New file',
    concept: 'Concept',
};
const FILE_KIND_LABEL = {
    changed: 'Changed',
    new: 'New file',
    context: 'Context',
};
export function buildReviewModel(repo, tour, files, headRef, opts) {
    const steps = orderedSteps(tour);
    const byId = new Map(steps.map((s) => [s.id, s]));
    const codeSteps = steps.filter(isCodeStep);
    const coverageFiles = filesForStoryCoverage(tour, files);
    // Story-less (diff-only) view: there's no story to measure the diff against,
    // so nothing is "unexplained" — skip coverage instead of flagging every line.
    const uncovered = opts?.storyless ? [] : computeCoverage(tour, coverageFiles).uncovered;
    // Uncovered ranges grouped by file, for line-level "untoured" flagging.
    const uncoveredByFile = new Map();
    for (const u of uncovered) {
        const list = uncoveredByFile.get(u.file) ?? [];
        list.push(u.range);
        uncoveredByFile.set(u.file, list);
    }
    // First ordered step that shows each file → the "Step N" chip + jump target.
    const stepByFile = new Map();
    for (const s of codeSteps)
        if (!stepByFile.has(s.file))
            stepByFile.set(s.file, s);
    // First declared reason wins if a step is (incorrectly) flagged twice.
    const hotspotByStep = new Map();
    for (const spot of tour.hotspots ?? []) {
        const reason = narrative(spot.reason ?? '', 'inline');
        if (reason.text.trim() && !hotspotByStep.has(spot.step))
            hotspotByStep.set(spot.step, reason);
    }
    const stepViews = steps.map((step, index) => isCodeStep(step)
        ? buildCodeStep(repo, step, files, byId, steps.length, headRef, hotspotByStep.get(step.id), opts?.detailedStepIndexes === undefined || opts.detailedStepIndexes.has(index))
        : buildConceptStep(step, byId));
    // Built from the step views, not the raw steps: the title is already projected
    // there, and parsing it twice would be the second parse this module exists to
    // remove.
    const hotspots = stepViews.flatMap((step, index) => {
        const reason = hotspotByStep.get(step.id);
        return reason && step.kind !== 'concept'
            ? [{ stepId: step.id, panelIndex: index + 1, order: step.order, title: step.title, reason }]
            : [];
    });
    const fileViews = buildFiles(repo, codeSteps, files, stepByFile, uncoveredByFile, headRef, opts?.detailedFilePaths, opts?.fileIndex);
    const trust = buildTrust(coverageFiles, uncovered, stepByFile, opts?.includeTrustRows !== false);
    if (opts?.trustPending)
        trust.pending = true;
    const changedFileViews = fileViews.filter((file) => file.kind !== 'context');
    const storyPaths = new Set(coverageFiles.map((file) => file.newPath));
    const storyFileViews = changedFileViews.filter((file) => storyPaths.has(file.file));
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
function storyView(tour) {
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
function filesForStoryCoverage(tour, files) {
    const included = tour.storyScope?.includedFiles;
    if (!included?.length)
        return files;
    const selected = new Set(included);
    return files.filter((f) => selected.has(f.newPath));
}
function buildCodeStep(repo, step, files, byId, total, headRef, hotspot, detailed = true) {
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
function buildConceptStep(step, byId) {
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
            .filter((target) => !!target && isCodeStep(target))
            .map((target) => ({ id: target.id, order: target.order, title: narrative(target.title, 'inline') }))
            .sort((a, b) => a.order - b.order),
    };
}
/** Chapters group the rail, so they are compared and printed as plain text. */
function chapterLabel(step) {
    return narrativeText(step.chapter ?? '').trim() || undefined;
}
function stepHealth(step, viewport, focusGroups) {
    const viewportLines = viewport[0] === 0 ? 0 : viewport[1] - viewport[0] + 1;
    const beatCount = step.beats?.length ?? focusGroups.length;
    const reasons = [];
    if (viewportLines > 30)
        reasons.push(`${viewportLines} lines in one step`);
    if (beatCount > 3)
        reasons.push(`${beatCount} separate review beats`);
    const hasDistantFocus = focusGroups.some((group) => {
        const sorted = [...group].sort((a, b) => a[0] - b[0]);
        return sorted.some((range, index) => index > 0 && range[0] - sorted[index - 1][1] > 10);
    });
    if (hasDistantFocus)
        reasons.push('focus jumps across distant code');
    const widestSpan = focusGroups.reduce((widest, group) => {
        if (!group.length || group[0][0] === 0)
            return widest;
        const starts = group.map((range) => range[0]);
        const ends = group.map((range) => range[1]);
        return Math.max(widest, Math.max(...ends) - Math.min(...starts) + 1);
    }, 0);
    if (widestSpan > 20)
        reasons.push(`${widestSpan}-line focus span`);
    return { broad: reasons.length > 0, reasons, viewportLines, beatCount };
}
function stepViewport(step) {
    return step.viewport ?? step.range;
}
function stepHighlights(step) {
    return step.highlights ?? step.focus?.ranges ?? [];
}
function stepBeats(step) {
    return (step.beats ?? []).map((beat, i) => ({
        text: narrative(beat.text, 'inline'),
        focusGroup: i,
        highlights: beat.highlights,
    }));
}
function stepFocusGroups(viewport, highlights, beats) {
    if (beats.length)
        return beats.map((beat) => beat.highlights);
    if (highlights.length)
        return highlights.map((range) => [range]);
    return [[viewport]];
}
function stepBlocks(repo, step, files, headRef) {
    const viewport = stepViewport(step);
    const [start, end] = viewport;
    const file = files.find((f) => f.newPath === step.file);
    if (step.kind === 'changed') {
        if (file && file.hunks.length) {
            const whole = readWholeFile(repo, step.file, headRef);
            if (whole) {
                const rows = rowsInViewport(buildFullFileRows(file, whole, []), viewport);
                if (rows.length)
                    return { blocks: [rows] };
            }
            const overlap = file.hunks.filter((h) => rangesOverlap(hunkNewRange(h), [start, end]));
            const use = overlap.length ? overlap : file.hunks;
            return {
                blocks: use.map((h) => h.lines.map(toSbs)),
                note: overlap.length ? undefined : 'tour range did not match a hunk — showing all changes in this file',
            };
        }
        const r = readFileRange(repo, step.file, start, end, headRef);
        if (!r)
            return { blocks: [], note: `file not found: ${step.file}` };
        return {
            blocks: [r.lines.map((c, i) => ctxRow(c, r.startLine + i))],
            note: 'no diff for this range — showing the current file',
        };
    }
    // context | new-file: read straight from the working tree.
    const r = readFileRange(repo, step.file, start, end, headRef);
    if (!r)
        return { blocks: [], note: `file not found: ${step.file}` };
    if (step.kind === 'new-file') {
        return { blocks: [r.lines.map((c, i) => ({ type: 'add', newNo: r.startLine + i, content: c, comment: true }))] };
    }
    return { blocks: [r.lines.map((c, i) => ctxRow(c, r.startLine + i))] };
}
function rowsInViewport(rows, [start, end]) {
    return rows.filter((row, index) => rowInViewport(row, rows, index, start, end));
}
function rowInViewport(row, rows, index, start, end) {
    if (row.newNo !== undefined)
        return row.newNo >= start && row.newNo <= end;
    if (row.type !== 'del')
        return false;
    const prev = nearestNewLine(rows, index, -1);
    const next = nearestNewLine(rows, index, 1);
    return ((prev !== undefined && prev >= start - 1 && prev <= end) ||
        (next !== undefined && next >= start && next <= end + 1));
}
function nearestNewLine(rows, from, dir) {
    for (let i = from + dir; i >= 0 && i < rows.length; i += dir) {
        if (rows[i].newNo !== undefined)
            return rows[i].newNo;
    }
    return undefined;
}
function buildFiles(repo, steps, files, stepByFile, uncoveredByFile, headRef, detailedFilePaths, fileIndex) {
    const views = [];
    const seen = new Set();
    const summaries = fileIndex ?? files.map((file) => ({
        oldPath: file.oldPath,
        path: file.newPath,
        status: file.status,
        added: countLines(file, 'add'),
        removed: countLines(file, 'del'),
        byteSize: null,
        binary: false,
        large: false,
        generated: false,
        metadataOnly: !file.hunks.length,
        reviewHash: diffFileReviewHash(file),
    }));
    const diffByPath = new Map(files.map((file) => [file.newPath, file]));
    for (const summary of summaries) {
        const file = diffByPath.get(summary.path);
        seen.add(summary.path);
        const uncovered = uncoveredByFile.get(summary.path) ?? [];
        const hunks = file && (detailedFilePaths === undefined || detailedFilePaths.has(summary.path))
            ? file.hunks.map((h) => h.lines.map((l) => toUnified(l, uncovered)))
            : [];
        const step = stepByFile.get(summary.path);
        views.push({
            file: summary.path,
            oldFile: summary.oldPath,
            status: summary.status,
            kind: summary.status === 'added' ? 'new' : 'changed',
            kindLabel: summary.status === 'added' ? FILE_KIND_LABEL.new : FILE_KIND_LABEL.changed,
            add: summary.added ?? 0,
            del: summary.removed ?? 0,
            untoured: uncovered.length,
            stepId: step?.id,
            stepOrder: step?.order,
            hunks,
            hunkRanges: file?.hunks.map(hunkNewRange) ?? [],
            hasFull: summary.status !== 'deleted',
            symbols: file ? changedSymbols(file) : [],
            reviewHash: summary.reviewHash,
        });
    }
    // Context-only files (referenced by a context step, absent from the diff).
    for (const step of steps) {
        if (step.kind !== 'context' || seen.has(step.file))
            continue;
        seen.add(step.file);
        const detailed = detailedFilePaths === undefined || detailedFilePaths.has(step.file);
        const r = detailed
            ? readFileRange(repo, step.file, step.range[0], step.range[1], headRef)
            : null;
        const rows = r ? r.lines.map((c, i) => ({ type: 'ctx', no: r.startLine + i, content: c })) : [];
        views.push({
            file: step.file,
            oldFile: step.file,
            status: 'modified',
            kind: 'context',
            kindLabel: FILE_KIND_LABEL.context,
            add: 0,
            del: 0,
            untoured: 0,
            stepId: step.id,
            stepOrder: step.order,
            hunks: rows.length ? [rows] : [],
            hunkRanges: r ? [[r.startLine, r.startLine + rows.length - 1]] : [],
            hasFull: detailed ? r !== null : true,
            symbols: [],
            reviewHash: contextFileReviewHash(step.file, rows),
        });
    }
    return views.sort(byStepOrderThenPath);
}
function diffFileReviewHash(file) {
    const stableHunks = file.hunks.map((hunk) => hunk.lines.map((line) => ({
        type: line.type,
        no: line.type === 'del' ? line.oldNo : line.newNo,
        content: line.content,
    })));
    return createHash('sha256')
        .update(JSON.stringify([
        file.status,
        file.oldPath,
        file.newPath,
        file.hunks.map(hunkNewRange),
        stableHunks,
    ]))
        .digest('hex')
        .slice(0, 64);
}
function contextFileReviewHash(file, rows) {
    return createHash('sha256')
        .update(JSON.stringify(['modified', file, file, rows.length ? [[rows[0].no, rows[rows.length - 1].no]] : [], [rows]]))
        .digest('hex')
        .slice(0, 64);
}
/** Conservative declaration extraction for findability, never correctness claims. */
function changedSymbols(file) {
    const found = new Set();
    const declaration = /\b(?:async\s+)?(?:function|class|interface|type|enum|struct|contract|library|event|modifier|def|fn)\s+([A-Za-z_$][\w$]*)|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:=|:)/;
    for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
            if (line.type === 'ctx')
                continue;
            const match = line.content.match(declaration);
            const symbol = match?.[1] ?? match?.[2];
            if (symbol)
                found.add(symbol);
            if (found.size >= 12)
                return [...found];
        }
    }
    return [...found];
}
function buildTrust(files, uncovered, stepByFile, includeRows) {
    const byPath = new Map(files.map((f) => [f.newPath, f]));
    let totalAdd = 0;
    for (const f of files)
        totalAdd += countLines(f, 'add');
    let uncoveredAdds = 0;
    const views = uncovered.map((u) => {
        const file = byPath.get(u.file);
        const rows = includeRows && file
            ? file.hunks
                .filter((h) => rangesOverlap(hunkNewRange(h), u.range))
                .flatMap((h) => h.lines)
                .filter((l) => l.newNo !== undefined && l.newNo >= u.range[0] && l.newNo <= u.range[1])
                .map((l) => toUnified(l, [u.range]))
            : [];
        uncoveredAdds += rows.filter((r) => r.type === 'add').length;
        const step = stepByFile.get(u.file);
        return { file: u.file, line: u.range[0], rows, stepId: step?.id, stepOrder: step?.order };
    });
    return {
        coveredLines: Math.max(0, totalAdd - uncoveredAdds),
        uncoveredLines: uncoveredAdds || uncovered.length,
        uncovered: views,
    };
}
/**
 * Reconstruct the complete file as side-by-side rows: unchanged regions on both
 * sides, added lines on the right (left hatched), removed lines on the left.
 * Built from the working-tree file + the parsed hunks — no second git call.
 */
export function buildFullFileRows(file, newLines, uncoveredRanges) {
    const rows = [];
    const hunks = file ? [...file.hunks].sort((a, b) => a.newStart - b.newStart) : [];
    const untoured = (n) => n !== undefined && uncoveredRanges.some((r) => n >= r[0] && n <= r[1]);
    let newCursor = 1;
    let oldCursor = 1;
    for (const h of hunks) {
        while (newCursor < h.newStart && newCursor <= newLines.length) {
            rows.push({ type: 'ctx', oldNo: oldCursor, newNo: newCursor, content: newLines[newCursor - 1], comment: true });
            newCursor++;
            oldCursor++;
        }
        for (const l of h.lines) {
            if (l.type === 'ctx') {
                rows.push({ type: 'ctx', oldNo: l.oldNo, newNo: l.newNo, content: l.content, comment: true });
                if (l.newNo !== undefined)
                    newCursor = l.newNo + 1;
                if (l.oldNo !== undefined)
                    oldCursor = l.oldNo + 1;
            }
            else if (l.type === 'add') {
                rows.push({ type: 'add', newNo: l.newNo, content: l.content, comment: true, untoured: untoured(l.newNo) });
                if (l.newNo !== undefined)
                    newCursor = l.newNo + 1;
            }
            else {
                rows.push({ type: 'del', oldNo: l.oldNo, content: l.content });
                if (l.oldNo !== undefined)
                    oldCursor = l.oldNo + 1;
            }
        }
    }
    while (newCursor <= newLines.length) {
        rows.push({ type: 'ctx', oldNo: oldCursor, newNo: newCursor, content: newLines[newCursor - 1], comment: true });
        newCursor++;
        oldCursor++;
    }
    return rows;
}
/** Split-layout blocks for one file's hunks (the All-files Split view):
 *  each hunk becomes a block of SbsRows, adds flagged when uncovered.
 *  `file` is optional so context-only files (no entry in the parsed diff,
 *  only referenced by a context step) degrade to no blocks — same shape as
 *  buildFullFileRows' handling of an absent DiffFile. */
export function hunksToSbsBlocks(file, uncoveredRanges) {
    if (!file)
        return [];
    const untoured = (n) => n !== undefined && uncoveredRanges.some((r) => n >= r[0] && n <= r[1]);
    return file.hunks.map((h) => h.lines.map((l) => {
        const row = toSbs(l);
        if (l.type === 'add' && untoured(l.newNo))
            row.untoured = true;
        return row;
    }));
}
// ---- helpers ----
function flowLabel(step, byId, total) {
    const calls = (step.calls ?? []).map((id) => byId.get(id)).filter((t) => !!t);
    const ret = step.returnsTo ? byId.get(step.returnsTo) : undefined;
    if (calls.length) {
        let label = 'Calls step ' + calls.map((t) => t.order).join(', ');
        if (ret)
            label += ' · returns to ' + ret.order;
        return label;
    }
    if (ret)
        return 'Returns to step ' + ret.order;
    return step.order === total ? 'Final step' : 'Standalone';
}
function toSbs(l) {
    return { type: l.type, oldNo: l.oldNo, newNo: l.newNo, content: l.content, comment: l.newNo !== undefined };
}
function ctxRow(content, no) {
    return { type: 'ctx', oldNo: no, newNo: no, content, comment: true };
}
function toUnified(l, uncovered) {
    const untoured = l.newNo !== undefined && uncovered.some((r) => l.newNo >= r[0] && l.newNo <= r[1]);
    return { type: l.type, no: l.newNo ?? l.oldNo, content: l.content, untoured };
}
// The new-file line span a hunk occupies, used to size the expandable gaps
// between hunks. A pure-deletion hunk has newLines === 0; the Math.max(…,1)
// floor claims one line at newStart so the range is never inverted — a known,
// harmless one-line seam where the context line beside such a hunk is attributed
// to the hunk rather than a neighboring gap. Revisit here if gap ranges change.
export function hunkNewRange(h) {
    return [h.newStart, h.newStart + Math.max(h.newLines, 1) - 1];
}
function countLines(file, type) {
    let n = 0;
    for (const h of file.hunks)
        for (const l of h.lines)
            if (l.type === type)
                n++;
    return n;
}
function byStepOrderThenPath(a, b) {
    const ao = a.stepOrder ?? Number.MAX_SAFE_INTEGER;
    const bo = b.stepOrder ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo)
        return ao - bo;
    return a.file.localeCompare(b.file);
}
// changedRanges is re-exported for callers that want raw uncovered ranges.
export { changedRanges };
