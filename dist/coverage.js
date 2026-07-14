// Story-claim completeness only: this proves that authored step ranges account
// for every changed line. It does not prove that the story is correct or that a
// human reviewed the change.
import { changedRanges, rangesOverlap } from './diff.js';
import { isCodeStep } from './types.js';
/** Inclusive portions of target that are not accounted for by any claim. */
function unclaimedSegments(target, claims) {
    const relevant = claims
        .map(([start, end]) => [Math.max(target[0], start), Math.min(target[1], end)])
        .filter(([start, end]) => start <= end)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const missing = [];
    let cursor = target[0];
    for (const [start, end] of relevant) {
        if (end < cursor)
            continue;
        if (start > cursor)
            missing.push([cursor, start - 1]);
        cursor = Math.max(cursor, end + 1);
        if (cursor > target[1])
            break;
    }
    if (cursor <= target[1])
        missing.push([cursor, target[1]]);
    return missing;
}
export function computeStoryClaimCoverage(tour, files) {
    // Index the ranges each step claims, by file.
    const claimsByFile = new Map();
    for (const step of tour.steps) {
        if (!isCodeStep(step) || step.kind === 'context')
            continue; // concepts/context never claim changes
        const list = claimsByFile.get(step.file) ?? [];
        list.push(step.range);
        claimsByFile.set(step.file, list);
    }
    const unclaimed = [];
    const changedFiles = files.filter((f) => f.hunks.length > 0);
    let fullyClaimedChangedFiles = 0;
    let totalChangedRanges = 0;
    let fullyClaimedChangedRanges = 0;
    for (const file of changedFiles) {
        const claims = claimsByFile.get(file.newPath) ?? [];
        const fileRanges = changedRanges(file);
        let fileIsFullyClaimed = true;
        totalChangedRanges += fileRanges.length;
        for (const range of fileRanges) {
            const missing = unclaimedSegments(range, claims);
            if (missing.length === 0) {
                fullyClaimedChangedRanges += 1;
            }
            else {
                fileIsFullyClaimed = false;
                unclaimed.push(...missing.map((segment) => ({ file: file.newPath, range: segment, status: file.status })));
            }
        }
        if (fileIsFullyClaimed && fileRanges.length > 0)
            fullyClaimedChangedFiles += 1;
    }
    return {
        unclaimed,
        totalChangedFiles: changedFiles.length,
        fullyClaimedChangedFiles,
        totalChangedRanges,
        fullyClaimedChangedRanges,
        uncovered: unclaimed,
        coveredChangedFiles: fullyClaimedChangedFiles,
    };
}
/** @deprecated Prefer computeStoryClaimCoverage; coverage here means only authored story claims. */
export function computeCoverage(tour, files) {
    return computeStoryClaimCoverage(tour, files);
}
/** Tour steps that point at a file/range with no corresponding change in the diff. */
export function stalePointers(tour, files) {
    const byPath = new Map(files.map((f) => [f.newPath, f]));
    return tour.steps.filter((step) => {
        if (!isCodeStep(step) || step.kind === 'context')
            return false; // context/concepts are not diff pointers
        const file = byPath.get(step.file);
        if (!file)
            return true;
        return !changedRanges(file).some((r) => rangesOverlap(r, step.range));
    });
}
