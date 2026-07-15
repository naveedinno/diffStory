import { isCodeStep, type LineRange, type Tour } from './model';

export interface UnclaimedChange {
  file: string;
  range: LineRange;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
}

export interface StoryClaimCoverage {
  unclaimed: UnclaimedChange[];
  totalChangedFiles: number;
  fullyClaimedChangedFiles: number;
  totalChangedRanges: number;
  fullyClaimedChangedRanges: number;
}

interface ParsedFile {
  oldPath: string;
  newPath: string;
  status: UnclaimedChange['status'];
  changed: LineRange[];
}

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Proves only that authored changed/new-file steps account for every rendered
 * changed line. Concept and context steps intentionally make no such claim.
 */
export function computeStoryClaimCoverage(tour: Tour, unifiedDiff: string): StoryClaimCoverage {
  const claims = new Map<string, LineRange[]>();
  for (const step of tour.steps) {
    if (!isCodeStep(step) || step.kind === 'context') continue;
    const ranges = claims.get(step.file) ?? [];
    ranges.push(step.range);
    claims.set(step.file, ranges);
  }

  const files = parseChangedRanges(unifiedDiff).filter((file) => file.changed.length > 0);
  const unclaimed: UnclaimedChange[] = [];
  let fullyClaimedChangedFiles = 0;
  let totalChangedRanges = 0;
  let fullyClaimedChangedRanges = 0;

  for (const file of files) {
    const fileClaims = claims.get(file.newPath) ?? [];
    let fileClaimed = true;
    totalChangedRanges += file.changed.length;
    for (const changed of file.changed) {
      const missing = unclaimedSegments(changed, fileClaims);
      if (!missing.length) fullyClaimedChangedRanges += 1;
      else {
        fileClaimed = false;
        unclaimed.push(...missing.map((range) => ({ file: file.newPath, range, status: file.status })));
      }
    }
    if (fileClaimed) fullyClaimedChangedFiles += 1;
  }

  return {
    unclaimed,
    totalChangedFiles: files.length,
    fullyClaimedChangedFiles,
    totalChangedRanges,
    fullyClaimedChangedRanges,
  };
}

function parseChangedRanges(raw: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  let file: ParsedFile | undefined;
  let hunkRanges: LineRange[] = [];
  let rangeStart: number | undefined;
  let rangeEnd: number | undefined;
  let newLine = 0;
  let oldRemain = 0;
  let newRemain = 0;
  let hunkNewStart = 0;
  let hunkHadAddition = false;
  let inHunk = false;

  const flushRange = () => {
    if (rangeStart !== undefined && rangeEnd !== undefined) hunkRanges.push([rangeStart, rangeEnd]);
    rangeStart = undefined;
    rangeEnd = undefined;
  };
  const flushHunk = () => {
    if (!file || !inHunk) return;
    flushRange();
    if (!hunkHadAddition) hunkRanges.push([hunkNewStart, hunkNewStart]);
    file.changed.push(...hunkRanges);
    hunkRanges = [];
    hunkNewStart = 0;
    hunkHadAddition = false;
    inHunk = false;
    oldRemain = 0;
    newRemain = 0;
  };
  const flushFile = () => {
    flushHunk();
    if (file) files.push(file);
    file = undefined;
  };

  for (const line of raw.split('\n')) {
    if (line.startsWith('diff --git ')) {
      flushFile();
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      file = { oldPath: match?.[1] ?? '', newPath: match?.[2] ?? '', status: 'modified', changed: [] };
      continue;
    }
    if (!file) continue;
    if (line.startsWith('new file mode')) {
      file.status = 'added';
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      file.status = 'deleted';
      continue;
    }
    if (line.startsWith('rename from ')) {
      file.status = 'renamed';
      file.oldPath = line.slice('rename from '.length);
      continue;
    }
    if (line.startsWith('rename to ')) {
      file.newPath = line.slice('rename to '.length);
      continue;
    }
    if (line.startsWith('--- ')) {
      const value = line.slice(4);
      if (value === '/dev/null') file.status = 'added';
      else file.oldPath = stripDiffPath(value);
      continue;
    }
    if (line.startsWith('+++ ')) {
      const value = line.slice(4);
      if (value === '/dev/null') file.status = 'deleted';
      else file.newPath = stripDiffPath(value);
      continue;
    }

    const match = line.match(HUNK);
    if (match) {
      flushHunk();
      hunkNewStart = Number(match[3]);
      newLine = hunkNewStart;
      oldRemain = match[2] === undefined ? 1 : Number(match[2]);
      newRemain = match[4] === undefined ? 1 : Number(match[4]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith('\\')) continue;
    if (line.startsWith('+') && newRemain > 0) {
      newRemain -= 1;
      if (rangeStart === undefined) rangeStart = newLine;
      rangeEnd = newLine;
      newLine += 1;
      hunkHadAddition = true;
    } else if (line.startsWith('-') && oldRemain > 0) {
      oldRemain -= 1;
    } else if ((line.startsWith(' ') || line === '') && oldRemain > 0 && newRemain > 0) {
      flushRange();
      oldRemain -= 1;
      newRemain -= 1;
      newLine += 1;
    }
  }
  flushFile();
  return files.filter((candidate) => candidate.newPath || candidate.oldPath);
}

function stripDiffPath(value: string): string {
  return value.replace(/^[ab]\//, '').replace(/\t.*$/, '');
}

function unclaimedSegments(target: LineRange, claims: LineRange[]): LineRange[] {
  const relevant = claims
    .map(([start, end]): LineRange => [Math.max(target[0], start), Math.min(target[1], end)])
    .filter(([start, end]) => start <= end)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const missing: LineRange[] = [];
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
