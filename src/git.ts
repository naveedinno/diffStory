// Thin wrapper over the `git` CLI. No external deps — just child_process.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { DIFF_CONTEXT_LINES } from './config.js';
import { reviewExclusionMetadata, type ReviewExclusionMetadata } from './noise.js';

const APP_DATA_PATHSPEC = ':(exclude).diffstory/**';

function isAppDataPath(path: string): boolean {
  return path === '.diffstory' || path.startsWith('.diffstory/');
}

function git(repo: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // Capture stderr instead of inheriting it — base-detection probes are
    // expected to fail (e.g. no `origin`), and we don't want those leaking.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function tryGit(repo: string, args: string[]): string | null {
  try {
    return git(repo, args);
  } catch {
    return null;
  }
}

function gitOutputAllowingDiffExit(repo: string, args: string[]): string | null {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) return null;
  if (result.status === 0 || result.status === 1) return result.stdout ?? '';
  return null;
}

export function isGitRepo(repo: string): boolean {
  return tryGit(repo, ['rev-parse', '--is-inside-work-tree']) !== null;
}

/**
 * Decide what to diff against, in priority order:
 *   1. an explicit override (--base / tour.base)
 *   2. the merge-base of HEAD with the default branch (captures everything the
 *      branch changed, committed *and* uncommitted)
 *   3. HEAD (just the uncommitted changes)
 *   4. the empty tree (a fresh repo with no commits yet)
 */
export function resolveBase(repo: string, override?: string): string {
  if (override && tryGit(repo, ['rev-parse', '--verify', override]) !== null) {
    return override;
  }

  const hasHead = tryGit(repo, ['rev-parse', '--verify', 'HEAD']) !== null;
  if (!hasHead) {
    // Empty tree object — diffs the whole working tree as "added".
    return git(repo, ['hash-object', '-t', 'tree', '/dev/null']).trim();
  }

  for (const branch of defaultBranchCandidates(repo)) {
    const mergeBase = tryGit(repo, ['merge-base', 'HEAD', branch]);
    if (mergeBase) {
      const ref = mergeBase.trim();
      // If we're already on the default branch, merge-base == HEAD and the diff
      // would be empty; fall through to HEAD so uncommitted work still shows.
      const head = tryGit(repo, ['rev-parse', 'HEAD'])?.trim();
      if (ref && ref !== head) return ref;
    }
  }

  return 'HEAD';
}

function defaultBranchCandidates(repo: string): string[] {
  const out: string[] = [];
  const originHead = tryGit(repo, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (originHead) out.push(originHead.trim().replace('refs/remotes/', ''));
  for (const name of ['main', 'master', 'develop']) {
    if (tryGit(repo, ['rev-parse', '--verify', name]) !== null) out.push(name);
    if (tryGit(repo, ['rev-parse', '--verify', `origin/${name}`]) !== null) out.push(`origin/${name}`);
  }
  return out;
}

/**
 * Unified diff against `base`. With no `head`, diffs the working tree (the usual
 * "review my current change" case). With `head`, diffs `base..head` — two refs,
 * no working tree involved.
 *
 * Generated/oversized files (see `noiseFiles`) are subtracted from the diff:
 * a regenerated 20k-line ABI would otherwise become tens of thousands of DOM
 * rows in the review and crash the tab. Keeping this in the one diff everything
 * shares means the rendered review, the coverage gate, and the change summary
 * all agree on the same reduced set without each call site re-deriving it.
 */
export function getDiff(repo: string, base: string, head?: string): string {
  const noise = new Set(noiseFiles(repo, base, head));
  const args = ['diff', '--no-color', '--no-ext-diff', `-U${DIFF_CONTEXT_LINES}`, base];
  if (head) args.push(head);
  args.push('--', APP_DATA_PATHSPEC, ...excludePathspecs([...noise]));
  const tracked = git(repo, args);
  if (head) return tracked;

  // `git diff <base>` compares the base directly with filesystem bytes. That
  // normally gives the useful aggregate change, but it can hide the index: an
  // MM file whose unstaged edit restores the base has no base→worktree diff
  // even though it still contains a staged change. Append only those missing
  // base→index paths so every staged change remains reviewable without
  // duplicating files already represented by the aggregate diff.
  const stagedOnly = stagedOnlyReviewPaths(repo, base).filter((path) => !noise.has(path));
  const staged = stagedOnly.length
    ? git(repo, [
        'diff',
        '--cached',
        '--no-color',
        '--no-ext-diff',
        `-U${DIFF_CONTEXT_LINES}`,
        base,
        '--',
        ...stagedOnly.map(literalPathspec),
      ])
    : '';

  // An index deletion restored at the same path is reported by Git as both a
  // tracked deletion and an untracked file (`D  path` + `?? path`). The trust
  // gate exposes that index/worktree collision explicitly, so do not append a
  // second diff block for the same path and make the reviewed identity look
  // like two independent files.
  const indexDivergent = new Set(stagedWorktreeDivergentFiles(repo, base));
  const untracked = untrackedFiles(repo)
    .filter((path) => !isAppDataPath(path))
    .filter((path) => !indexDivergent.has(path))
    .filter((path) => !noise.has(path))
    .map((path) => untrackedFileDiff(repo, path))
    .filter(Boolean);
  return joinDiffs([tracked, staged, ...untracked]);
}

/**
 * Paths omitted from the bounded default diff. Kept for compatibility; callers
 * that show review scope should use excludedReviewFiles() so the omission and
 * reason remain visible.
 */
export function noiseFiles(repo: string, base: string, head?: string): string[] {
  return excludedReviewFiles(repo, base, head).map((file) => file.path);
}

/**
 * Structured omissions for the bounded default diff. Derived from --numstat so
 * callers can show the path, reason, and changed-line count without reading the
 * excluded file contents.
 */
export function excludedReviewFiles(repo: string, base: string, head?: string): ReviewExclusionMetadata[] {
  return numstat(repo, base, head)
    .map((file) => reviewExclusionMetadata(file.path, file.added, file.removed))
    .filter((file): file is ReviewExclusionMetadata => file !== null)
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Fingerprint the complete review change without materialising its contents in
 * the browser-facing diff. The bounded renderer may omit generated, oversized,
 * binary, and metadata-only files, but none of those omissions may let an old
 * approval survive.
 *
 * For fixed ref comparisons, Git's full raw diff contains exact object ids and
 * modes. For a working-tree comparison Git intentionally writes an all-zero
 * destination id, so we additionally hash the current bytes/mode of every
 * changed and untracked path. `.diffstory/**` is app state, not product code.
 */
export function reviewChangeFingerprint(repo: string, base: string, head?: string): string {
  const hash = createHash('sha256');
  const resolvedBase = tryGit(repo, ['rev-parse', '--verify', `${base}^{tree}`])?.trim() ?? base;
  const resolvedHead = head
    ? tryGit(repo, ['rev-parse', '--verify', `${head}^{tree}`])?.trim() ?? head
    : 'working-tree';
  hash.update('diffstory-full-change-v2\0');
  hash.update(resolvedBase);
  hash.update('\0');
  hash.update(resolvedHead);
  hash.update('\0');

  const args = ['diff', '--raw', '-z', '--full-index', '--no-abbrev', '--no-renames', base];
  if (head) args.push(head);
  args.push('--', APP_DATA_PATHSPEC);
  updateFingerprintPart(hash, 'base-to-review', git(repo, args));

  if (!head) {
    // Base→worktree alone does not identify the index. Hash both Git boundaries
    // explicitly so restaging different bytes invalidates an approval even when
    // the visible filesystem and aggregate diff do not change.
    updateFingerprintPart(
      hash,
      'base-to-index',
      git(repo, [
        'diff',
        '--cached',
        '--raw',
        '-z',
        '--full-index',
        '--no-abbrev',
        '--no-renames',
        base,
        '--',
        APP_DATA_PATHSPEC,
      ]),
    );
    updateFingerprintPart(
      hash,
      'index-to-worktree',
      git(repo, [
        'diff',
        '--raw',
        '-z',
        '--full-index',
        '--no-abbrev',
        '--no-renames',
        '--',
        APP_DATA_PATHSPEC,
      ]),
    );

    const paths = [
      ...new Set([
        ...changedPaths(repo, [base]),
        ...changedPaths(repo, ['--cached', base]),
        ...changedPaths(repo, []),
        ...untrackedFiles(repo),
      ]),
    ].sort();
    for (const path of paths) updateWorkingPathFingerprint(repo, path, hash);
  }

  return hash.digest('hex');
}

function updateFingerprintPart(
  hash: ReturnType<typeof createHash>,
  label: string,
  value: string,
): void {
  hash.update(label);
  hash.update('\0');
  hash.update(String(Buffer.byteLength(value)));
  hash.update('\0');
  hash.update(value);
  hash.update('\0');
}

function updateWorkingPathFingerprint(repo: string, path: string, hash: ReturnType<typeof createHash>): void {
  hash.update('path\0');
  hash.update(path);
  hash.update('\0');
  const abs = join(repo, path);
  if (!existsSync(abs)) {
    hash.update('missing\0');
    return;
  }
  const stat = lstatSync(abs);
  hash.update(`${stat.mode & 0o7777}\0`);
  if (stat.isSymbolicLink()) {
    hash.update('symlink\0');
    hash.update(readlinkSync(abs));
    hash.update('\0');
    return;
  }
  if (!stat.isFile()) {
    // Submodules and other special entries are already represented by the raw
    // Git record. Including their filesystem type prevents accidental aliasing.
    hash.update(`special:${stat.mode & 0o170000}\0`);
    return;
  }
  const oid = tryGit(repo, ['hash-object', '--no-filters', '--', path])?.trim();
  if (oid) hash.update(`blob:${oid}\0`);
  else hash.update(readFileSync(abs));
}

/** Git pathspecs that subtract the given paths from a diff (`:(exclude)<path>`). */
export function excludePathspecs(paths: string[]): string[] {
  return paths.map((p) => `:(exclude)${p}`);
}

function literalPathspec(path: string): string {
  return `:(literal)${path}`;
}

/**
 * Paths with both a staged base→index change and a separate index→worktree
 * state. Git's ordinary diff finds tracked worktree edits, but an index deletion
 * restored at the same path becomes untracked (`D  path` + `?? path`) and must
 * be included explicitly. A reviewer cannot infer both states from one
 * aggregate base→worktree diff, so callers should surface these paths and must
 * not treat an approval as trustworthy until the index and worktree are
 * reconciled.
 * Fixed-ref reviews have no mutable index boundary and therefore return none.
 */
export function stagedWorktreeDivergentFiles(repo: string, base: string, head?: string): string[] {
  if (head) return [];
  const staged = new Set(stagedChangedPaths(repo, base));
  const worktree = new Set([...changedPaths(repo, []), ...untrackedFiles(repo)]);
  return [...staged]
    .filter((path) => worktree.has(path) || stagedDeletionRestoredOnDisk(repo, path))
    .sort();
}

/**
 * `git diff` cannot report an index deletion restored as an untracked path. In
 * particular, `ls-files --others --exclude-standard` also hides that restore
 * when a committed ignore rule covers the formerly tracked path. Compare the
 * staged path with the actual stage-0 index entry and filesystem instead: an
 * index-missing path that exists in any form is a real index/worktree split.
 */
function stagedDeletionRestoredOnDisk(repo: string, path: string): boolean {
  const entries = tryGit(repo, ['ls-files', '--stage', '-z', '--', literalPathspec(path)]);
  const hasStageZero = !!entries
    ?.split('\0')
    .filter(Boolean)
    .some((entry) => /^\d+ [0-9a-f]+ 0\t/.test(entry));
  if (hasStageZero) return false;
  try {
    lstatSync(join(repo, path));
    return true;
  } catch {
    return false;
  }
}

function stagedOnlyReviewPaths(repo: string, base: string): string[] {
  const aggregate = new Set(changedPaths(repo, [base]));
  return stagedChangedPaths(repo, base).filter((path) => !aggregate.has(path));
}

/** Paths changed in the index itself, excluding commits already present at HEAD. */
function stagedChangedPaths(repo: string, fallbackBase: string): string[] {
  const indexBase = tryGit(repo, ['rev-parse', '--verify', 'HEAD^{commit}']) ? 'HEAD' : fallbackBase;
  return changedPaths(repo, ['--cached', indexBase]);
}

/** Run `git diff --name-only` for one boundary and return literal NUL paths. */
function changedPaths(repo: string, boundary: string[]): string[] {
  const out = tryGit(repo, [
    'diff',
    '--name-only',
    '-z',
    '--no-renames',
    ...boundary,
    '--',
    APP_DATA_PATHSPEC,
  ]);
  if (!out) return [];
  return out.split('\0').filter(Boolean).filter((path) => !isAppDataPath(path)).sort();
}

export interface BranchRef {
  name: string;
  kind: 'local' | 'remote';
  remote?: string;
}

export interface CommitRef {
  sha: string;
  subject: string;
  refs?: string;
  committedAt?: string;
  committedAtLabel?: string;
  committedAtRelative?: string;
}

/** Branch names (local + remote), most-recently-committed first. For the picker. */
export function listBranches(repo: string): string[] {
  return listBranchRefs(repo).map((b) => b.name);
}

/** Branch refs with enough metadata for the picker to avoid flattening everything together. */
export function listBranchRefs(repo: string): BranchRef[] {
  const out = tryGit(repo, [
    'for-each-ref',
    '--format=%(refname)%09%(refname:short)',
    '--sort=-committerdate',
    'refs/heads',
    'refs/remotes',
  ]);
  if (!out) return [];
  return out
    .split('\n')
    .map((s): BranchRef | null => {
      const [full, short] = s.split('\t');
      const name = (short ?? '').trim();
      if (!full || !name || name.endsWith('/HEAD')) return null;
      if (full.startsWith('refs/remotes/')) {
        const remote = name.includes('/') ? name.slice(0, name.indexOf('/')) : undefined;
        return { name, kind: 'remote' as const, remote };
      }
      return { name, kind: 'local' as const };
    })
    .filter((b): b is BranchRef => !!b);
}

/** Commits as {sha, subject, committedAt}, newest first. For the picker. Pass n <= 0 for all. */
export function listRecentCommits(repo: string, n = 15, ref?: string): CommitRef[] {
  const args = ['log'];
  if (ref === '--all') args.push('--all');
  else if (ref) args.push(ref);
  if (n > 0) args.push(`-${n}`);
  args.push('--no-merges', '--pretty=format:%h%x09%cI%x09%s%x09%D');
  const out = tryGit(repo, args);
  if (!out) return [];
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, committedAt = '', subject = '', refs = ''] = line.split('\t');
      return {
        sha,
        committedAt,
        committedAtLabel: commitTimeLabel(committedAt),
        committedAtRelative: relativeCommitTime(committedAt),
        subject,
        refs,
      };
    });
}

function commitTimeLabel(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : '';
}

function relativeCommitTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 45) return 'just now';
  if (seconds < 90) return '1m ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Current branch name, or null when detached. */
export function currentBranch(repo: string): string | null {
  const b = tryGit(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim();
  return b && b !== 'HEAD' ? b : null;
}

/** A short human label for what we diffed against. */
export function describeBase(repo: string, base: string): string {
  const short = tryGit(repo, ['rev-parse', '--short', base])?.trim();
  const name = tryGit(repo, ['name-rev', '--name-only', base])?.trim();
  if (name && name !== 'undefined') return `${name} (${short ?? base})`;
  return short ?? base;
}

/** True when `ref` resolves to a commit object. */
export function isCommitRef(repo: string, ref: string): boolean {
  return tryGit(repo, ['rev-parse', '--verify', `${ref}^{commit}`]) !== null;
}

/** Resolve a commit-ish ref to its full object id, or null if it is not a commit. */
export function resolveCommit(repo: string, ref: string): string | null {
  return tryGit(repo, ['rev-parse', '--verify', `${ref}^{commit}`])?.trim() ?? null;
}

/** First-parent base for a single commit diff; root commits diff against the empty tree. */
export function commitParentBase(repo: string, commit: string): string {
  if (tryGit(repo, ['rev-parse', '--verify', `${commit}^`]) !== null) return `${commit}^`;
  return emptyTree(repo);
}

/** Short commit label for controls and headings. */
export function describeCommit(repo: string, commit: string): string {
  const out = tryGit(repo, ['show', '-s', '--format=%h %s', commit])?.trim();
  return out || commit;
}

/** True when the working tree has uncommitted changes (staged or unstaged, incl. untracked). */
export function isDirty(repo: string): boolean {
  const out = tryGit(repo, ['status', '--porcelain']);
  return out != null && out.trim().length > 0;
}

/** True when HEAD has a parent commit (so HEAD~1 is a valid ref). */
export function hasParentCommit(repo: string): boolean {
  return tryGit(repo, ['rev-parse', '--verify', 'HEAD~1']) !== null;
}

/** The empty-tree object — diffing against it shows a commit's whole content as added. */
export function emptyTree(repo: string): string {
  return git(repo, ['hash-object', '-t', 'tree', '/dev/null']).trim();
}

/**
 * Per-file added/removed line counts for the change (`git diff --numstat`).
 * Binary files report `-`/`-`, which we surface as null. Used by the change summary.
 */
export function numstat(
  repo: string,
  base: string,
  head?: string,
): Array<{ path: string; added: number | null; removed: number | null }> {
  const args = ['diff', '--numstat', '--no-color', base];
  if (head) args.push(head);
  args.push('--', APP_DATA_PATHSPEC);
  const tracked = parseNumstat(tryGit(repo, args));
  if (head) return tracked;

  // Keep omission metadata aligned with getDiff(): a large, generated, binary,
  // or metadata-only staged remainder must still be identified even when the
  // worktree happens to match the base.
  const stagedOnly = stagedOnlyReviewPaths(repo, base);
  const staged = stagedOnly.length
    ? parseNumstat(
        tryGit(repo, [
          'diff',
          '--cached',
          '--numstat',
          '--no-color',
          base,
          '--',
          ...stagedOnly.map(literalPathspec),
        ]),
      )
    : [];
  const indexDivergent = new Set(stagedWorktreeDivergentFiles(repo, base));
  return [
    ...tracked,
    ...staged,
    ...untrackedNumstat(repo).filter((file) => !indexDivergent.has(file.path)),
  ];
}

function parseNumstat(
  out: string | null,
): Array<{ path: string; added: number | null; removed: number | null }> {
  return !out ? [] : out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const added = parts[0] === '-' ? null : Number(parts[0]);
      const removed = parts[1] === '-' ? null : Number(parts[1]);
      return { path: parts.slice(2).join('\t'), added, removed };
    });
}

function joinDiffs(parts: string[]): string {
  return parts
    .map((part) => part.trimEnd())
    .filter(Boolean)
    .join('\n');
}

function untrackedFiles(repo: string): string[] {
  const out = tryGit(repo, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (!out) return [];
  return out.split('\0').filter(Boolean).filter((path) => !isAppDataPath(path)).sort();
}

function untrackedFileDiff(repo: string, path: string): string {
  return (
    gitOutputAllowingDiffExit(repo, [
      'diff',
      '--no-color',
      '--no-ext-diff',
      '--no-index',
      `-U${DIFF_CONTEXT_LINES}`,
      '--',
      '/dev/null',
      path,
    ]) ?? ''
  );
}

function untrackedNumstat(repo: string): Array<{ path: string; added: number | null; removed: number | null }> {
  return untrackedFiles(repo).map((path) => {
    const added = countFileLines(repo, path);
    return { path, added, removed: 0 };
  });
}

function countFileLines(repo: string, path: string): number | null {
  try {
    const bytes = readFileSync(join(repo, path));
    if (bytes.includes(0)) return null;
    if (bytes.length === 0) return 0;
    let lines = 0;
    for (const byte of bytes) if (byte === 10) lines++;
    return bytes[bytes.length - 1] === 10 ? lines : lines + 1;
  } catch {
    return null;
  }
}

/**
 * Read an inclusive 1-based line range from a file in the working tree.
 * Returns the lines (without trailing newlines) or null if the file is gone.
 */
export function readFileRange(
  repo: string,
  file: string,
  start: number,
  end: number,
  ref?: string,
): { lines: string[]; startLine: number } | null {
  const text = readFileText(repo, file, ref);
  if (text == null) return null;
  const all = text.split('\n');
  const from = Math.max(1, start);
  const to = Math.min(all.length, Math.max(from, end));
  return { lines: all.slice(from - 1, to), startLine: from };
}

/**
 * Read a whole file from the working tree as an array of lines (no trailing
 * newlines). Returns null if the file is gone. Used to reconstruct the
 * complete-file ("Full file") view.
 */
export function readWholeFile(repo: string, file: string, ref?: string): string[] | null {
  const text = readFileText(repo, file, ref);
  if (text == null) return null;
  const lines = text.split('\n');
  // Drop a single trailing empty element from a final newline so the line count
  // matches the file's real line count.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function readFileText(repo: string, file: string, ref?: string): string | null {
  if (ref) {
    return tryGit(repo, ['show', `${ref}:${file}`]);
  }
  const abs = join(repo, file);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8');
}
