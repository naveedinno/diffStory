// Thin wrapper over the `git` CLI. No external deps — just child_process.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIFF_CONTEXT_LINES } from './config.js';
import { isReviewNoise } from './noise.js';
const APP_DATA_PATHSPEC = ':(exclude).diffstory/**';
function isAppDataPath(path) {
    return path === '.diffstory' || path.startsWith('.diffstory/');
}
function git(repo, args) {
    return execFileSync('git', args, {
        cwd: repo,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        // Capture stderr instead of inheriting it — base-detection probes are
        // expected to fail (e.g. no `origin`), and we don't want those leaking.
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}
function tryGit(repo, args) {
    try {
        return git(repo, args);
    }
    catch {
        return null;
    }
}
function gitOutputAllowingDiffExit(repo, args) {
    const result = spawnSync('git', args, {
        cwd: repo,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.error)
        return null;
    if (result.status === 0 || result.status === 1)
        return result.stdout ?? '';
    return null;
}
export function isGitRepo(repo) {
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
export function resolveBase(repo, override) {
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
            if (ref && ref !== head)
                return ref;
        }
    }
    return 'HEAD';
}
function defaultBranchCandidates(repo) {
    const out = [];
    const originHead = tryGit(repo, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
    if (originHead)
        out.push(originHead.trim().replace('refs/remotes/', ''));
    for (const name of ['main', 'master', 'develop']) {
        if (tryGit(repo, ['rev-parse', '--verify', name]) !== null)
            out.push(name);
        if (tryGit(repo, ['rev-parse', '--verify', `origin/${name}`]) !== null)
            out.push(`origin/${name}`);
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
export function getDiff(repo, base, head) {
    const noise = new Set(noiseFiles(repo, base, head));
    const args = ['diff', '--no-color', '--no-ext-diff', `-U${DIFF_CONTEXT_LINES}`, base];
    if (head)
        args.push(head);
    args.push('--', APP_DATA_PATHSPEC, ...excludePathspecs([...noise]));
    const tracked = git(repo, args);
    if (head)
        return tracked;
    const untracked = untrackedFiles(repo)
        .filter((path) => !isAppDataPath(path))
        .filter((path) => !noise.has(path))
        .map((path) => untrackedFileDiff(repo, path))
        .filter(Boolean);
    return joinDiffs([tracked, ...untracked]);
}
/**
 * Files nobody reviews by hand — generated/vendored by path, or so large they're
 * almost certainly machine-written (see `isReviewNoise`). Derived from `--numstat`,
 * so it's a cheap count with no file content read. The change summary folds the
 * same set into its collapsed "generated & large" group.
 */
export function noiseFiles(repo, base, head) {
    return numstat(repo, base, head)
        .filter((f) => isReviewNoise(f.path, (f.added ?? 0) + (f.removed ?? 0)))
        .map((f) => f.path);
}
/** Git pathspecs that subtract the given paths from a diff (`:(exclude)<path>`). */
export function excludePathspecs(paths) {
    return paths.map((p) => `:(exclude)${p}`);
}
/** Branch names (local + remote), most-recently-committed first. For the picker. */
export function listBranches(repo) {
    return listBranchRefs(repo).map((b) => b.name);
}
/** Branch refs with enough metadata for the picker to avoid flattening everything together. */
export function listBranchRefs(repo) {
    const out = tryGit(repo, [
        'for-each-ref',
        '--format=%(refname)%09%(refname:short)',
        '--sort=-committerdate',
        'refs/heads',
        'refs/remotes',
    ]);
    if (!out)
        return [];
    return out
        .split('\n')
        .map((s) => {
        const [full, short] = s.split('\t');
        const name = (short ?? '').trim();
        if (!full || !name || name.endsWith('/HEAD'))
            return null;
        if (full.startsWith('refs/remotes/')) {
            const remote = name.includes('/') ? name.slice(0, name.indexOf('/')) : undefined;
            return { name, kind: 'remote', remote };
        }
        return { name, kind: 'local' };
    })
        .filter((b) => !!b);
}
/** Commits as {sha, subject, committedAt}, newest first. For the picker. Pass n <= 0 for all. */
export function listRecentCommits(repo, n = 15, ref) {
    const args = ['log'];
    if (ref === '--all')
        args.push('--all');
    else if (ref)
        args.push(ref);
    if (n > 0)
        args.push(`-${n}`);
    args.push('--no-merges', '--pretty=format:%h%x09%cI%x09%s%x09%D');
    const out = tryGit(repo, args);
    if (!out)
        return [];
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
function commitTimeLabel(iso) {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : '';
}
function relativeCommitTime(iso, now = Date.now()) {
    const then = Date.parse(iso);
    if (!Number.isFinite(then))
        return '';
    const seconds = Math.max(0, Math.floor((now - then) / 1000));
    if (seconds < 45)
        return 'just now';
    if (seconds < 90)
        return '1m ago';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7)
        return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5)
        return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12)
        return `${months}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}
/** Current branch name, or null when detached. */
export function currentBranch(repo) {
    const b = tryGit(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim();
    return b && b !== 'HEAD' ? b : null;
}
/** A short human label for what we diffed against. */
export function describeBase(repo, base) {
    const short = tryGit(repo, ['rev-parse', '--short', base])?.trim();
    const name = tryGit(repo, ['name-rev', '--name-only', base])?.trim();
    if (name && name !== 'undefined')
        return `${name} (${short ?? base})`;
    return short ?? base;
}
/** True when `ref` resolves to a commit object. */
export function isCommitRef(repo, ref) {
    return tryGit(repo, ['rev-parse', '--verify', `${ref}^{commit}`]) !== null;
}
/** Resolve a commit-ish ref to its full object id, or null if it is not a commit. */
export function resolveCommit(repo, ref) {
    return tryGit(repo, ['rev-parse', '--verify', `${ref}^{commit}`])?.trim() ?? null;
}
/** First-parent base for a single commit diff; root commits diff against the empty tree. */
export function commitParentBase(repo, commit) {
    if (tryGit(repo, ['rev-parse', '--verify', `${commit}^`]) !== null)
        return `${commit}^`;
    return emptyTree(repo);
}
/** Short commit label for controls and headings. */
export function describeCommit(repo, commit) {
    const out = tryGit(repo, ['show', '-s', '--format=%h %s', commit])?.trim();
    return out || commit;
}
/** True when the working tree has uncommitted changes (staged or unstaged, incl. untracked). */
export function isDirty(repo) {
    const out = tryGit(repo, ['status', '--porcelain']);
    return out != null && out.trim().length > 0;
}
/** True when HEAD has a parent commit (so HEAD~1 is a valid ref). */
export function hasParentCommit(repo) {
    return tryGit(repo, ['rev-parse', '--verify', 'HEAD~1']) !== null;
}
/** The empty-tree object — diffing against it shows a commit's whole content as added. */
export function emptyTree(repo) {
    return git(repo, ['hash-object', '-t', 'tree', '/dev/null']).trim();
}
/**
 * Per-file added/removed line counts for the change (`git diff --numstat`).
 * Binary files report `-`/`-`, which we surface as null. Used by the change summary.
 */
export function numstat(repo, base, head) {
    const args = ['diff', '--numstat', '--no-color', base];
    if (head)
        args.push(head);
    args.push('--', APP_DATA_PATHSPEC);
    const out = tryGit(repo, args);
    const tracked = !out ? [] : out
        .split('\n')
        .filter(Boolean)
        .map((line) => {
        const parts = line.split('\t');
        const added = parts[0] === '-' ? null : Number(parts[0]);
        const removed = parts[1] === '-' ? null : Number(parts[1]);
        return { path: parts.slice(2).join('\t'), added, removed };
    });
    if (head)
        return tracked;
    return [...tracked, ...untrackedNumstat(repo)];
}
function joinDiffs(parts) {
    return parts
        .map((part) => part.trimEnd())
        .filter(Boolean)
        .join('\n');
}
function untrackedFiles(repo) {
    const out = tryGit(repo, ['ls-files', '--others', '--exclude-standard', '-z']);
    if (!out)
        return [];
    return out.split('\0').filter(Boolean).filter((path) => !isAppDataPath(path)).sort();
}
function untrackedFileDiff(repo, path) {
    return (gitOutputAllowingDiffExit(repo, [
        'diff',
        '--no-color',
        '--no-ext-diff',
        '--no-index',
        `-U${DIFF_CONTEXT_LINES}`,
        '--',
        '/dev/null',
        path,
    ]) ?? '');
}
function untrackedNumstat(repo) {
    return untrackedFiles(repo).map((path) => {
        const added = countFileLines(repo, path);
        return { path, added, removed: 0 };
    });
}
function countFileLines(repo, path) {
    try {
        const bytes = readFileSync(join(repo, path));
        if (bytes.includes(0))
            return null;
        if (bytes.length === 0)
            return 0;
        let lines = 0;
        for (const byte of bytes)
            if (byte === 10)
                lines++;
        return bytes[bytes.length - 1] === 10 ? lines : lines + 1;
    }
    catch {
        return null;
    }
}
/**
 * Read an inclusive 1-based line range from a file in the working tree.
 * Returns the lines (without trailing newlines) or null if the file is gone.
 */
export function readFileRange(repo, file, start, end, ref) {
    const text = readFileText(repo, file, ref);
    if (text == null)
        return null;
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
export function readWholeFile(repo, file, ref) {
    const text = readFileText(repo, file, ref);
    if (text == null)
        return null;
    const lines = text.split('\n');
    // Drop a single trailing empty element from a final newline so the line count
    // matches the file's real line count.
    if (lines.length > 1 && lines[lines.length - 1] === '')
        lines.pop();
    return lines;
}
function readFileText(repo, file, ref) {
    if (ref) {
        return tryGit(repo, ['show', `${ref}:${file}`]);
    }
    const abs = join(repo, file);
    if (!existsSync(abs))
        return null;
    return readFileSync(abs, 'utf8');
}
