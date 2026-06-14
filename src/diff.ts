// Parse `git diff` unified output into structured files/hunks/lines.
// Handles the common cases: modified, added, deleted, renamed.
import type { DiffFile, DiffHunk, DiffLine } from './types.js';

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseUnifiedDiff(raw: string): DiffFile[] {
  const lines = raw.split('\n');
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  const pushFile = () => {
    if (file) {
      if (hunk) file.hunks.push(hunk);
      files.push(file);
    }
    hunk = null;
  };

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      pushFile();
      const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      file = {
        oldPath: m ? m[1] : '',
        newPath: m ? m[2] : '',
        status: 'modified',
        hunks: [],
      };
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
      const p = line.slice(4);
      if (p !== '/dev/null') file.oldPath = stripPrefix(p);
      else file.status = 'added';
      continue;
    }
    if (line.startsWith('+++ ')) {
      const p = line.slice(4);
      if (p !== '/dev/null') file.newPath = stripPrefix(p);
      else file.status = 'deleted';
      continue;
    }

    const hm = line.match(HUNK_RE);
    if (hm) {
      if (hunk) file.hunks.push(hunk);
      const oldStart = Number(hm[1]);
      const oldLines = hm[2] === undefined ? 1 : Number(hm[2]);
      const newStart = Number(hm[3]);
      const newLines = hm[4] === undefined ? 1 : Number(hm[4]);
      hunk = { oldStart, oldLines, newStart, newLines, lines: [] };
      oldNo = oldStart;
      newNo = newStart;
      continue;
    }

    if (!hunk) continue;

    if (line.startsWith('\\')) continue; // "\ No newline at end of file"

    const marker = line[0];
    const content = line.slice(1);
    let dl: DiffLine;
    if (marker === '+') {
      dl = { type: 'add', content, newNo: newNo++ };
    } else if (marker === '-') {
      dl = { type: 'del', content, oldNo: oldNo++ };
    } else if (marker === ' ' || marker === undefined) {
      dl = { type: 'ctx', content, oldNo: oldNo++, newNo: newNo++ };
    } else {
      continue; // index/binary/other metadata lines inside a file block
    }
    hunk.lines.push(dl);
  }

  pushFile();
  return files.filter((f) => f.newPath || f.oldPath);
}

function stripPrefix(p: string): string {
  // strip the leading a/ or b/ and any trailing tab-decorated timestamp
  return p.replace(/^[ab]\//, '').replace(/\t.*$/, '');
}

/** New-file line ranges actually touched (added or changed) within a file. */
export function changedRanges(file: DiffFile): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const hunk of file.hunks) {
    let start: number | null = null;
    let prev: number | null = null;
    for (const l of hunk.lines) {
      if (l.type === 'add' && l.newNo !== undefined) {
        if (start === null) start = l.newNo;
        prev = l.newNo;
      } else if (l.type === 'ctx') {
        if (start !== null && prev !== null) ranges.push([start, prev]);
        start = null;
        prev = null;
      }
      // deletions have no new-file line; they attach to the surrounding range
    }
    if (start !== null && prev !== null) ranges.push([start, prev]);
    // a pure-deletion hunk still represents a change — anchor it at newStart
    if (ranges.length === 0 || !hunk.lines.some((l) => l.type === 'add')) {
      ranges.push([hunk.newStart, hunk.newStart]);
    }
  }
  return ranges;
}

export function rangesOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}
