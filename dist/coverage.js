// Trust check: every changed hunk in the real diff must be claimed by at least
// one tour step. Anything unclaimed is surfaced loudly so the agent can't quietly
// leave a change out of the narrative.
import { changedRanges, rangesOverlap } from './diff.js';
export function computeCoverage(tour, files) {
    // Index the ranges each step claims, by file.
    const claimsByFile = new Map();
    for (const step of tour.steps) {
        if (step.kind === 'context')
            continue; // context steps don't claim changes
        const list = claimsByFile.get(step.file) ?? [];
        list.push(step.range);
        claimsByFile.set(step.file, list);
    }
    const uncovered = [];
    const changedFiles = files.filter((f) => f.hunks.length > 0);
    const coveredFiles = new Set();
    for (const file of changedFiles) {
        const claims = claimsByFile.get(file.newPath) ?? [];
        for (const range of changedRanges(file)) {
            const covered = claims.some((c) => rangesOverlap(c, range));
            if (covered)
                coveredFiles.add(file.newPath);
            else
                uncovered.push({ file: file.newPath, range, status: file.status });
        }
    }
    return {
        uncovered,
        totalChangedFiles: changedFiles.length,
        coveredChangedFiles: coveredFiles.size,
    };
}
/** Tour steps that point at a file/range with no corresponding change in the diff. */
export function stalePointers(tour, files) {
    const byPath = new Map(files.map((f) => [f.newPath, f]));
    return tour.steps.filter((step) => {
        if (step.kind === 'context')
            return false; // context intentionally points at unchanged code
        const file = byPath.get(step.file);
        if (!file)
            return true;
        return !changedRanges(file).some((r) => rangesOverlap(r, step.range));
    });
}
