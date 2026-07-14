// Trust check: every changed hunk in the real diff must be claimed by at least
// one tour step. Anything unclaimed is surfaced loudly so the agent can't quietly
// leave a change out of the narrative.
import { changedRanges, rangesOverlap } from './diff.js';
import { isCodeStep, type DiffFile, type Tour, type TourStep } from './types.js';

export interface UncoveredHunk {
  file: string;
  range: [number, number];
  status: DiffFile['status'];
}

export interface Coverage {
  uncovered: UncoveredHunk[];
  totalChangedFiles: number;
  coveredChangedFiles: number;
}

export function computeCoverage(tour: Tour, files: DiffFile[]): Coverage {
  // Index the ranges each step claims, by file.
  const claimsByFile = new Map<string, Array<[number, number]>>();
  for (const step of tour.steps) {
    if (!isCodeStep(step) || step.kind === 'context') continue; // concepts/context never claim changes
    const list = claimsByFile.get(step.file) ?? [];
    list.push(step.range);
    claimsByFile.set(step.file, list);
  }

  const uncovered: UncoveredHunk[] = [];
  const changedFiles = files.filter((f) => f.hunks.length > 0);
  const coveredFiles = new Set<string>();

  for (const file of changedFiles) {
    const claims = claimsByFile.get(file.newPath) ?? [];
    for (const range of changedRanges(file)) {
      const covered = claims.some((c) => rangesOverlap(c, range));
      if (covered) coveredFiles.add(file.newPath);
      else uncovered.push({ file: file.newPath, range, status: file.status });
    }
  }

  return {
    uncovered,
    totalChangedFiles: changedFiles.length,
    coveredChangedFiles: coveredFiles.size,
  };
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
