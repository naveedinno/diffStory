// The summary the picker needs for one repo: is it a git repo, does it have a
// tour, what's the branch, how many files differ from the default base. Pure
// composition over git.ts/config.ts so it's cheap to call for a recents list.
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { isGitRepo, resolveBase, getDiff, currentBranch } from './git.js';
import { parseUnifiedDiff } from './diff.js';
import { resolveStoryPath } from './config.js';

export interface RepoState {
  path: string;
  name: string;
  isGit: boolean;
  hasTour: boolean;
  currentBranch: string | null;
  changedFiles: number;
}

export function inspectRepo(repo: string): RepoState {
  const isGit = isGitRepo(repo);
  // resolveStoryPath returns the (non-existent) default path when no tour exists,
  // so existsSync is a correct presence check for either story.json or the legacy file.
  const hasTour = existsSync(resolveStoryPath(repo));
  let changedFiles = 0;
  let branch: string | null = null;
  if (isGit) {
    branch = currentBranch(repo);
    try {
      const base = resolveBase(repo);
      changedFiles = parseUnifiedDiff(getDiff(repo, base)).filter((f) => f.hunks.length).length;
    } catch {
      changedFiles = 0;
    }
  }
  return { path: repo, name: basename(repo), isGit, hasTour, currentBranch: branch, changedFiles };
}
