// Turn the validated tour + parsed diff + coverage into the view structures the
// review page renders: the ordered story steps (side-by-side rows), the All-files
// overview (unified rows), the trust check, and the reconstructed full-file view.
//
// Pure data only — no HTML. The renderer (render.ts) and the /api/fullfile
// endpoint (server.ts) both consume these, so the diff-shaping logic lives in
// exactly one place. Code strings are passed through verbatim; escaping happens
// at the render boundary.
import { changedRanges, rangesOverlap } from './diff.js';
import { readFileRange } from './git.js';
import { orderedSteps } from './tour.js';
import { computeCoverage } from './coverage.js';
const STEP_KIND_LABEL = {
    changed: 'Changed',
    context: 'Context',
    'new-file': 'New file',
};
const FILE_KIND_LABEL = {
    changed: 'Changed',
    new: 'New file',
    context: 'Context',
};
export function buildReviewModel(repo, tour, files) {
    const steps = orderedSteps(tour);
    const byId = new Map(steps.map((s) => [s.id, s]));
    const coverage = computeCoverage(tour, files);
    // Uncovered ranges grouped by file, for line-level "untoured" flagging.
    const uncoveredByFile = new Map();
    for (const u of coverage.uncovered) {
        const list = uncoveredByFile.get(u.file) ?? [];
        list.push(u.range);
        uncoveredByFile.set(u.file, list);
    }
    // First ordered step that shows each file → the "Step N" chip + jump target.
    const stepByFile = new Map();
    for (const s of steps)
        if (!stepByFile.has(s.file))
            stepByFile.set(s.file, s);
    const stepViews = steps.map((s) => buildStep(repo, s, files, byId, steps.length));
    const fileViews = buildFiles(repo, steps, files, stepByFile, uncoveredByFile);
    const trust = buildTrust(files, coverage.uncovered, stepByFile);
    return {
        steps: stepViews,
        files: fileViews,
        trust,
        totalSteps: steps.length,
        filesChanged: fileViews.filter((f) => f.kind !== 'context').length,
        contextFiles: fileViews.filter((f) => f.kind === 'context').length,
        totalAdd: fileViews.reduce((a, f) => a + f.add, 0),
        totalDel: fileViews.reduce((a, f) => a + f.del, 0),
    };
}
function buildStep(repo, step, files, byId, total) {
    const { blocks, note } = stepBlocks(repo, step, files);
    return {
        id: step.id,
        order: step.order,
        title: step.title,
        file: step.file,
        kind: step.kind,
        kindLabel: STEP_KIND_LABEL[step.kind],
        newFile: step.kind === 'new-file',
        context: step.kind === 'context',
        why: step.why,
        flow: flowLabel(step, byId, total),
        blocks,
        note,
    };
}
function stepBlocks(repo, step, files) {
    const [start, end] = step.range;
    const file = files.find((f) => f.newPath === step.file);
    if (step.kind === 'changed') {
        if (file && file.hunks.length) {
            const overlap = file.hunks.filter((h) => rangesOverlap(hunkNewRange(h), [start, end]));
            const use = overlap.length ? overlap : file.hunks;
            return {
                blocks: use.map((h) => h.lines.map(toSbs)),
                note: overlap.length ? undefined : 'tour range did not match a hunk — showing all changes in this file',
            };
        }
        const r = readFileRange(repo, step.file, start, end);
        if (!r)
            return { blocks: [], note: `file not found: ${step.file}` };
        return {
            blocks: [r.lines.map((c, i) => ctxRow(c, r.startLine + i))],
            note: 'no diff for this range — showing the current file',
        };
    }
    // context | new-file: read straight from the working tree.
    const r = readFileRange(repo, step.file, start, end);
    if (!r)
        return { blocks: [], note: `file not found: ${step.file}` };
    if (step.kind === 'new-file') {
        return { blocks: [r.lines.map((c, i) => ({ type: 'add', newNo: r.startLine + i, content: c, comment: true }))] };
    }
    return { blocks: [r.lines.map((c, i) => ctxRow(c, r.startLine + i))] };
}
function buildFiles(repo, steps, files, stepByFile, uncoveredByFile) {
    const views = [];
    const seen = new Set();
    for (const file of files) {
        if (!file.hunks.length)
            continue; // pure metadata (e.g. mode change) — skip
        seen.add(file.newPath);
        const uncovered = uncoveredByFile.get(file.newPath) ?? [];
        const hunks = file.hunks.map((h) => h.lines.map((l) => toUnified(l, uncovered)));
        const add = countLines(file, 'add');
        const del = countLines(file, 'del');
        const step = stepByFile.get(file.newPath);
        views.push({
            file: file.newPath,
            kind: file.status === 'added' ? 'new' : 'changed',
            kindLabel: file.status === 'added' ? FILE_KIND_LABEL.new : FILE_KIND_LABEL.changed,
            add,
            del,
            untoured: uncovered.length,
            stepId: step?.id,
            stepOrder: step?.order,
            hunks,
            hasFull: file.status !== 'deleted',
        });
    }
    // Context-only files (referenced by a context step, absent from the diff).
    for (const step of steps) {
        if (step.kind !== 'context' || seen.has(step.file))
            continue;
        seen.add(step.file);
        const r = readFileRange(repo, step.file, step.range[0], step.range[1]);
        const rows = r ? r.lines.map((c, i) => ({ type: 'ctx', no: r.startLine + i, content: c })) : [];
        views.push({
            file: step.file,
            kind: 'context',
            kindLabel: FILE_KIND_LABEL.context,
            add: 0,
            del: 0,
            untoured: 0,
            stepId: step.id,
            stepOrder: step.order,
            hunks: rows.length ? [rows] : [],
            hasFull: r !== null,
        });
    }
    return views.sort(byStepOrderThenPath);
}
function buildTrust(files, uncovered, stepByFile) {
    const byPath = new Map(files.map((f) => [f.newPath, f]));
    let totalAdd = 0;
    for (const f of files)
        totalAdd += countLines(f, 'add');
    let uncoveredAdds = 0;
    const views = uncovered.map((u) => {
        const file = byPath.get(u.file);
        const rows = file
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
function hunkNewRange(h) {
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
