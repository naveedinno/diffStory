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

/** A short human label for what we diffed against. */
export function describeBase(repo: string, base: string): string {
  const short = tryGit(repo, ['rev-parse', '--short', base])?.trim();
  const name = tryGit(repo, ['name-rev', '--name-only', base])?.trim();
  if (name && name !== 'undefined') return `${name} (${short ?? base})`;
  return short ?? base;
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
): { lines: string[]; startLine: number } | null {
  const abs = join(repo, file);
  if (!existsSync(abs)) return null;
  const all = readFileSync(abs, 'utf8').split('\n');
  const from = Math.max(1, start);
  const to = Math.min(all.length, Math.max(from, end));
  return { lines: all.slice(from - 1, to), startLine: from };
}

/**
 * Read a whole file from the working tree as an array of lines (no trailing
 * newlines). Returns null if the file is gone. Used to reconstruct the
 * complete-file ("Full file") view.
 */
export function readWholeFile(repo: string, file: string): string[] | null {
  const abs = join(repo, file);
  if (!existsSync(abs)) return null;
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  // Drop a single trailing empty element from a final newline so the line count
  // matches the file's real line count.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
