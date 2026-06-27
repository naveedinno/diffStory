// The summary the picker needs for one repo: is it a git repo, does it have a
// tour, what's the branch, how many files differ from the default base. Pure
// composition over git.ts/config.ts so it's cheap to call for a recents list.
import { basename } from 'node:path';
import { isGitRepo, resolveBase, getDiff, currentBranch } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { hasStories } from './stories.js';
export function inspectRepo(repo) {
    const isGit = isGitRepo(repo);
    const hasTour = hasStories(repo);
    let changedFiles = 0;
    let branch = null;
    if (isGit) {
        branch = currentBranch(repo);
        try {
            const base = resolveBase(repo);
            changedFiles = parseUnifiedDiff(getDiff(repo, base)).filter((f) => f.hunks.length).length;
        }
        catch {
            changedFiles = 0;
        }
    }
    return { path: repo, name: basename(repo), isGit, hasTour, currentBranch: branch, changedFiles };
}
