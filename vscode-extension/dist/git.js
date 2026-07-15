"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_TREE_REF = void 0;
exports.isGitRepository = isGitRepository;
exports.reviewRefs = reviewRefs;
exports.resolveReviewRevision = resolveReviewRevision;
exports.latestCommitComparison = latestCommitComparison;
exports.resolveBase = resolveBase;
exports.changedFiles = changedFiles;
exports.reviewDiff = reviewDiff;
exports.excludedReviewFiles = excludedReviewFiles;
exports.reviewChangeFingerprint = reviewChangeFingerprint;
exports.stagedWorktreeDivergentFiles = stagedWorktreeDivergentFiles;
exports.showFile = showFile;
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const REVIEW_NOISE_MAX_LINES = 1500;
exports.EMPTY_TREE_REF = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
async function git(repo, args) {
    const { stdout } = await execFileAsync('git', args, {
        cwd: repo.fsPath,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
}
async function tryGit(repo, args) {
    try {
        return await git(repo, args);
    }
    catch {
        return undefined;
    }
}
async function isGitRepository(repo) {
    return (await tryGit(repo, ['rev-parse', '--is-inside-work-tree']))?.trim() === 'true';
}
/** Branches and recent commits suitable for an explicit review-scope picker. */
async function reviewRefs(repo) {
    const [branchOutput, commitOutput] = await Promise.all([
        tryGit(repo, ['for-each-ref', '--format=%(refname:short)%09%(subject)', '--sort=-committerdate', 'refs/heads', 'refs/remotes']),
        tryGit(repo, ['log', '-20', '--no-merges', '--pretty=format:%H%x09%s']),
    ]);
    const refs = [{ ref: 'HEAD', label: 'HEAD', description: 'Current checked-out commit' }];
    const known = new Set(refs.map((candidate) => candidate.ref));
    for (const line of branchOutput?.split('\n') ?? []) {
        const [ref, subject = 'Branch'] = line.split('\t');
        if (!ref || ref.endsWith('/HEAD') || known.has(ref))
            continue;
        known.add(ref);
        refs.push({ ref, label: ref, description: subject || 'Branch' });
    }
    for (const line of commitOutput?.split('\n') ?? []) {
        const [sha, subject = 'Commit'] = line.split('\t');
        if (!sha || known.has(sha))
            continue;
        known.add(sha);
        refs.push({ ref: sha, label: `${sha.slice(0, 8)} · ${subject}`, description: sha });
    }
    return refs;
}
/** Resolve a commit or tree-ish used by a review comparison without silently falling back. */
async function resolveReviewRevision(repo, ref) {
    const value = ref.trim();
    if (!value)
        return undefined;
    return (await tryGit(repo, ['rev-parse', '--verify', `${value}^{tree}`]))?.trim();
}
/** The exact parent-to-commit scope for the currently checked-out commit. */
async function latestCommitComparison(repo) {
    if (!await resolveReviewRevision(repo, 'HEAD'))
        throw new Error('This repository does not have a commit to review yet.');
    const parent = await resolveReviewRevision(repo, 'HEAD^');
    return { base: parent ? 'HEAD^' : exports.EMPTY_TREE_REF, head: 'HEAD' };
}
/** Mirrors diffStory's default enough for a workspace-native review. */
async function resolveBase(repo, preferred) {
    if (preferred && await tryGit(repo, ['rev-parse', '--verify', `${preferred}^{commit}`]))
        return preferred;
    const api = require('vscode');
    const configured = api.workspace.getConfiguration('diffstory', repo).get('defaultBase')?.trim();
    if (configured && await tryGit(repo, ['rev-parse', '--verify', `${configured}^{commit}`]))
        return configured;
    const hasHead = await tryGit(repo, ['rev-parse', '--verify', 'HEAD']);
    if (!hasHead)
        return exports.EMPTY_TREE_REF;
    const remoteHead = (await tryGit(repo, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']))
        ?.trim()
        .replace('refs/remotes/', '');
    const candidates = [remoteHead, 'origin/main', 'main', 'origin/master', 'master', 'origin/develop', 'develop']
        .filter((candidate) => Boolean(candidate));
    const head = hasHead.trim();
    for (const candidate of candidates) {
        const mergeBase = (await tryGit(repo, ['merge-base', 'HEAD', candidate]))?.trim();
        if (mergeBase && mergeBase !== head)
            return mergeBase;
    }
    return 'HEAD';
}
async function changedFiles(repo, base, head) {
    const args = ['diff', '--name-status', '-z', base];
    if (head)
        args.push(head);
    args.push('--', ':(exclude).diffstory/**');
    const output = await git(repo, args);
    const tokens = output.split('\0').filter(Boolean);
    const files = [];
    for (let index = 0; index < tokens.length;) {
        const status = tokens[index++];
        if (!status)
            continue;
        // Renames/copies have source and target paths. Keep both so the native diff can read the correct base-side file.
        const oldPath = status.startsWith('R') || status.startsWith('C') ? tokens[index++] : undefined;
        const path = tokens[index++];
        if (path)
            files.push({ status, path, ...(oldPath ? { oldPath } : {}) });
    }
    if (!head) {
        const aggregate = new Set(files.map((file) => file.path));
        const stagedOnly = (await stagedOnlyReviewPaths(repo, base)).filter((file) => !aggregate.has(file));
        if (stagedOnly.length)
            appendNameStatus(files, await git(repo, [
                'diff', '--cached', '--name-status', '-z', base, '--', ...stagedOnly.map(literalPathspec),
            ]));
    }
    const stats = await changeStats(repo, base, head);
    for (const file of files)
        Object.assign(file, stats.get(file.path));
    if (head)
        return files;
    const untracked = (await git(repo, ['ls-files', '--others', '--exclude-standard', '-z']))
        .split('\0')
        .filter((file) => file && !file.startsWith('.diffstory/'));
    const divergent = new Set(await stagedWorktreeDivergentFiles(repo, base));
    const known = new Set(files.map((file) => file.path));
    for (const file of untracked) {
        if (!known.has(file) && !divergent.has(file)) {
            const stat = await untrackedStat(repo, file);
            files.push({ status: '?', path: file, ...stat });
        }
    }
    return files;
}
async function reviewDiff(repo, base, head) {
    const exclusionFiles = await excludedReviewFiles(repo, base, head);
    const excluded = exclusionFiles.map((file) => `:(exclude)${file.path}`);
    const args = ['diff', '--no-color', '--no-ext-diff', base];
    if (head)
        args.push(head);
    args.push('--', ':(exclude).diffstory/**', ...excluded);
    const tracked = await git(repo, args);
    if (head)
        return tracked;
    const excludedSet = new Set(exclusionFiles.map((file) => file.path));
    const stagedOnly = (await stagedOnlyReviewPaths(repo, base)).filter((file) => !excludedSet.has(file));
    const staged = stagedOnly.length
        ? await git(repo, [
            'diff', '--cached', '--no-color', '--no-ext-diff', base, '--', ...stagedOnly.map(literalPathspec),
        ])
        : '';
    const divergent = new Set(await stagedWorktreeDivergentFiles(repo, base));
    const untracked = (await git(repo, ['ls-files', '--others', '--exclude-standard', '-z']))
        .split('\0')
        .filter((file) => file && !file.startsWith('.diffstory/') && !excludedSet.has(file) && !divergent.has(file));
    if (!untracked.length)
        return joinDiffs([tracked, staged]);
    const additions = await Promise.all(untracked.map(async (file) => {
        try {
            const content = await (0, promises_1.readFile)(path.join(repo.fsPath, file), 'utf8');
            if (content.includes('\0'))
                return '';
            const lines = content.endsWith('\n') ? content.slice(0, -1).split('\n') : content.split('\n');
            return `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join('\n')}\n`;
        }
        catch {
            // A generated, binary, or unreadable untracked file should not prevent the whole review from opening.
            return '';
        }
    }));
    return joinDiffs([tracked, staged, ...additions]);
}
async function excludedReviewFiles(repo, base, head) {
    const files = await changedFilesWithoutMetadata(repo, base, head);
    return files.flatMap((file) => file.exclusion ? [file.exclusion] : []).sort((a, b) => a.path.localeCompare(b.path));
}
/** Complete review identity, including files intentionally omitted from the bounded guide diff. */
async function reviewChangeFingerprint(repo, base, head) {
    const hash = (0, node_crypto_1.createHash)('sha256');
    const resolvedBase = (await tryGit(repo, ['rev-parse', '--verify', `${base}^{tree}`]))?.trim() ?? base;
    const resolvedHead = head ? (await tryGit(repo, ['rev-parse', '--verify', `${head}^{tree}`]))?.trim() ?? head : 'working-tree';
    hash.update(`diffstory-full-change-v2\0${resolvedBase}\0${resolvedHead}\0`);
    const rawArgs = ['diff', '--raw', '-z', '--full-index', '--no-abbrev', '--no-renames', base];
    if (head)
        rawArgs.push(head);
    rawArgs.push('--', ':(exclude).diffstory/**');
    updateFingerprintPart(hash, 'base-to-review', await git(repo, rawArgs));
    if (!head) {
        updateFingerprintPart(hash, 'base-to-index', await git(repo, ['diff', '--cached', '--raw', '-z', '--full-index', '--no-abbrev', '--no-renames', base, '--', ':(exclude).diffstory/**']));
        updateFingerprintPart(hash, 'index-to-worktree', await git(repo, ['diff', '--raw', '-z', '--full-index', '--no-abbrev', '--no-renames', '--', ':(exclude).diffstory/**']));
        const paths = [...new Set([
                ...await changedPaths(repo, [base]),
                ...await changedPaths(repo, ['--cached', base]),
                ...await changedPaths(repo, []),
                ...await untrackedFiles(repo),
            ])].filter((file) => !file.startsWith('.diffstory/')).sort();
        for (const file of paths)
            await updateWorkingPathFingerprint(repo, file, hash);
    }
    return hash.digest('hex');
}
async function stagedWorktreeDivergentFiles(repo, base, head) {
    if (head)
        return [];
    const staged = new Set(await stagedChangedPaths(repo, base));
    const worktree = new Set([...await changedPaths(repo, []), ...await untrackedFiles(repo)]);
    const result = [];
    for (const file of staged) {
        if (worktree.has(file) || await stagedDeletionRestoredOnDisk(repo, file))
            result.push(file);
    }
    return result.sort();
}
function isGeneratedPath(file) {
    const value = file.toLowerCase();
    return /(^|\/)(dist|build|out|node_modules|vendor|\.next|coverage|__generated__)\//.test(value)
        || /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|cargo\.lock|go\.sum)$/.test(value)
        || /\.(min\.js|min\.css|map|lock)$/.test(value)
        || /(^|\/)abis?\//.test(value)
        || /\.abi\.json$/.test(value);
}
function exclusionFor(path, addedLines, removedLines) {
    const changedLines = addedLines == null || removedLines == null ? null : addedLines + removedLines;
    const reason = isGeneratedPath(path)
        ? 'generated-path'
        : changedLines == null
            ? 'binary'
            : changedLines === 0
                ? 'metadata-only'
                : changedLines >= REVIEW_NOISE_MAX_LINES
                    ? 'large-diff'
                    : undefined;
    return reason ? { path, reason, addedLines, removedLines, changedLines } : undefined;
}
async function changedFilesWithoutMetadata(repo, base, head) {
    const args = ['diff', '--name-status', '-z', base];
    if (head)
        args.push(head);
    args.push('--', ':(exclude).diffstory/**');
    const tokens = (await git(repo, args)).split('\0').filter(Boolean);
    const stats = await changeStats(repo, base, head);
    const files = [];
    for (let index = 0; index < tokens.length;) {
        const status = tokens[index++];
        const oldPath = status?.startsWith('R') || status?.startsWith('C') ? tokens[index++] : undefined;
        const file = tokens[index++];
        if (file)
            files.push({ status, path: file, ...(oldPath ? { oldPath } : {}), ...stats.get(file) });
    }
    if (!head) {
        const aggregate = new Set(files.map((file) => file.path));
        const stagedOnly = (await stagedOnlyReviewPaths(repo, base)).filter((file) => !aggregate.has(file));
        if (stagedOnly.length) {
            const staged = [];
            appendNameStatus(staged, await git(repo, ['diff', '--cached', '--name-status', '-z', base, '--', ...stagedOnly.map(literalPathspec)]));
            files.push(...staged.map((file) => ({ ...file, ...stats.get(file.path) })));
        }
        const known = new Set(files.map((file) => file.path));
        const divergent = new Set(await stagedWorktreeDivergentFiles(repo, base));
        for (const file of await untrackedFiles(repo)) {
            if (!file.startsWith('.diffstory/') && !known.has(file) && !divergent.has(file))
                files.push({ status: '?', path: file, ...await untrackedStat(repo, file) });
        }
    }
    return files;
}
async function changeStats(repo, base, head) {
    const args = ['diff', '--numstat', '-z', base];
    if (head)
        args.push(head);
    args.push('--', ':(exclude).diffstory/**');
    const result = new Map();
    appendNumstat(result, await git(repo, args));
    if (!head) {
        const stagedOnly = await stagedOnlyReviewPaths(repo, base);
        if (stagedOnly.length)
            appendNumstat(result, await git(repo, [
                'diff', '--cached', '--numstat', '-z', base, '--', ...stagedOnly.map(literalPathspec),
            ]));
    }
    return result;
}
function appendNumstat(result, output) {
    const tokens = output.split('\0').filter(Boolean);
    for (let index = 0; index < tokens.length; index += 1) {
        const parts = tokens[index].split('\t');
        let pathValue = parts.slice(2).join('\t');
        if (!pathValue && index + 2 < tokens.length) {
            index += 1;
            index += 1;
            pathValue = tokens[index];
        }
        if (!pathValue)
            continue;
        const addedLines = parts[0] === '-' ? null : Number(parts[0]);
        const removedLines = parts[1] === '-' ? null : Number(parts[1]);
        const exclusion = exclusionFor(pathValue, addedLines, removedLines);
        result.set(pathValue, { addedLines, removedLines, ...(exclusion ? { exclusion } : {}) });
    }
}
async function untrackedStat(repo, file) {
    try {
        const content = await (0, promises_1.readFile)(path.join(repo.fsPath, file));
        const binary = content.includes(0);
        const addedLines = binary ? null : content.toString('utf8').split('\n').length - (content.at(-1) === 10 ? 1 : 0);
        const removedLines = binary ? null : 0;
        const exclusion = exclusionFor(file, addedLines, removedLines);
        return { addedLines, removedLines, ...(exclusion ? { exclusion } : {}) };
    }
    catch {
        const exclusion = exclusionFor(file, null, null);
        return { addedLines: null, removedLines: null, ...(exclusion ? { exclusion } : {}) };
    }
}
async function changedPaths(repo, boundary) {
    const output = await tryGit(repo, ['diff', '--name-only', '-z', '--no-renames', ...boundary, '--', ':(exclude).diffstory/**']);
    return output?.split('\0').filter(Boolean).sort() ?? [];
}
async function stagedOnlyReviewPaths(repo, base) {
    const aggregate = new Set(await changedPaths(repo, [base]));
    return (await stagedChangedPaths(repo, base)).filter((file) => !aggregate.has(file));
}
async function stagedChangedPaths(repo, fallbackBase) {
    const indexBase = await tryGit(repo, ['rev-parse', '--verify', 'HEAD^{commit}']) ? 'HEAD' : fallbackBase;
    return changedPaths(repo, ['--cached', indexBase]);
}
async function stagedDeletionRestoredOnDisk(repo, file) {
    const entries = await tryGit(repo, ['ls-files', '--stage', '-z', '--', literalPathspec(file)]);
    const hasStageZero = entries?.split('\0').filter(Boolean).some((entry) => /^\d+ [0-9a-f]+ 0\t/.test(entry)) ?? false;
    if (hasStageZero)
        return false;
    try {
        await (0, promises_1.lstat)(path.join(repo.fsPath, file));
        return true;
    }
    catch {
        return false;
    }
}
function appendNameStatus(files, output) {
    const tokens = output.split('\0').filter(Boolean);
    for (let index = 0; index < tokens.length;) {
        const status = tokens[index++];
        if (!status)
            continue;
        const oldPath = status.startsWith('R') || status.startsWith('C') ? tokens[index++] : undefined;
        const file = tokens[index++];
        if (file)
            files.push({ status, path: file, ...(oldPath ? { oldPath } : {}) });
    }
}
function literalPathspec(file) {
    return `:(literal)${file}`;
}
function joinDiffs(parts) {
    return parts.map((part) => part.trimEnd()).filter(Boolean).join('\n');
}
async function untrackedFiles(repo) {
    return (await git(repo, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
}
function updateFingerprintPart(hash, label, value) {
    hash.update(`${label}\0${Buffer.byteLength(value)}\0${value}\0`);
}
async function updateWorkingPathFingerprint(repo, file, hash) {
    hash.update(`path\0${file}\0`);
    const absolute = path.join(repo.fsPath, file);
    try {
        const info = await (0, promises_1.lstat)(absolute);
        hash.update(`${info.mode & 0o7777}\0`);
        if (info.isSymbolicLink()) {
            hash.update(`symlink\0${await (0, promises_1.readlink)(absolute)}\0`);
        }
        else if (!info.isFile()) {
            hash.update(`special:${info.mode & 0o170000}\0`);
        }
        else {
            const oid = (await tryGit(repo, ['hash-object', '--no-filters', '--', file]))?.trim();
            if (oid)
                hash.update(`blob:${oid}\0`);
            else
                hash.update(await (0, promises_1.readFile)(absolute));
        }
    }
    catch {
        hash.update('missing\0');
    }
}
async function showFile(repo, ref, path) {
    return tryGit(repo, ['show', `${ref}:${path}`]);
}
//# sourceMappingURL=git.js.map