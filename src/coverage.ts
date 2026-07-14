// Story-claim completeness only: this proves that authored step ranges account
// for every changed line. It does not prove that the story is correct or that a
// human reviewed the change.
import { changedRanges, rangesOverlap } from './diff.js';
import { isCodeStep, type DiffFile, type Tour, type TourStep } from './types.js';

export interface UnclaimedChange {
  file: string;
  range: [number, number];
  status: DiffFile['status'];
}

/** @deprecated Use UnclaimedChange; this is story completeness, not correctness. */
export type UncoveredHunk = UnclaimedChange;

export interface StoryClaimCoverage {
  unclaimed: UnclaimedChange[];
  totalChangedFiles: number;
  fullyClaimedChangedFiles: number;
  totalChangedRanges: number;
  fullyClaimedChangedRanges: number;
  /** @deprecated Use unclaimed. */
  uncovered: UnclaimedChange[];
  /** @deprecated Use fullyClaimedChangedFiles. */
  coveredChangedFiles: number;
}

/** @deprecated Use StoryClaimCoverage; this measures authored range claims only. */
export type Coverage = StoryClaimCoverage;

/** Inclusive portions of target that are not accounted for by any claim. */
function unclaimedSegments(
  target: [number, number],
  claims: Array<[number, number]>,
): Array<[number, number]> {
  const relevant = claims
    .map(([start, end]): [number, number] => [Math.max(target[0], start), Math.min(target[1], end)])
    .filter(([start, end]) => start <= end)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const missing: Array<[number, number]> = [];
  let cursor = target[0];
  for (const [start, end] of relevant) {
    if (end < cursor) continue;
    if (start > cursor) missing.push([cursor, start - 1]);
    cursor = Math.max(cursor, end + 1);
    if (cursor > target[1]) break;
  }
  if (cursor <= target[1]) missing.push([cursor, target[1]]);
  return missing;
}

export function computeStoryClaimCoverage(tour: Tour, files: DiffFile[]): StoryClaimCoverage {
  // Index the ranges each step claims, by file.
  const claimsByFile = new Map<string, Array<[number, number]>>();
  for (const step of tour.steps) {
    if (!isCodeStep(step) || step.kind === 'context') continue; // concepts/context never claim changes
    const list = claimsByFile.get(step.file) ?? [];
    list.push(step.range);
    claimsByFile.set(step.file, list);
  }

  const unclaimed: UnclaimedChange[] = [];
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
      } else {
        fileIsFullyClaimed = false;
        unclaimed.push(...missing.map((segment) => ({ file: file.newPath, range: segment, status: file.status })));
      }
    }
    if (fileIsFullyClaimed && fileRanges.length > 0) fullyClaimedChangedFiles += 1;
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
export function computeCoverage(tour: Tour, files: DiffFile[]): StoryClaimCoverage {
  return computeStoryClaimCoverage(tour, files);
}

/** Tour steps that point at a file/range with no corresponding change in the diff. */
export function stalePointers(tour: Tour, files: DiffFile[]): TourStep[] {
  const byPath = new Map(files.map((f) => [f.newPath, f]));
  return tour.steps.filter((step) => {
    if (!isCodeStep(step) || step.kind === 'context') return false; // context/concepts are not diff pointers
    const file = byPath.get(step.file);
    if (!file) return true;
    return !changedRanges(file).some((r) => rangesOverlap(r, step.range));
  });
}
