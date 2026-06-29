// Thin wrapper over the `git` CLI. No external deps — just child_process.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIFF_CONTEXT_LINES } from './config.js';

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
 */
export function getDiff(repo: string, base: string, head?: string): string {
  const args = ['diff', '--no-color', '--no-ext-diff', `-U${DIFF_CONTEXT_LINES}`, base];
  if (head) args.push(head);
  args.push('--');
  return git(repo, args);
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

/** Recent commits as {sha, subject}, newest first. For the picker. */
export function listRecentCommits(repo: string, n = 15, ref?: string): CommitRef[] {
  const args = ['log'];
  if (ref === '--all') args.push('--all');
  else if (ref) args.push(ref);
  args.push(`-${n}`, '--no-merges', '--pretty=format:%h%x09%s%x09%D');
  const out = tryGit(repo, args);
  if (!out) return [];
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, subject = '', refs = ''] = line.split('\t');
      return { sha, subject, refs };
    });
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
  args.push('--');
  const out = tryGit(repo, args);
  if (!out) return [];
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const added = parts[0] === '-' ? null : Number(parts[0]);
      const removed = parts[1] === '-' ? null : Number(parts[1]);
      return { path: parts.slice(2).join('\t'), added, removed };
    });
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
