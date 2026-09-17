// Resolve the review scope for the "Your change" screen. The default is "what I just
// did": uncommitted changes if the working tree is dirty, otherwise the latest commit.
// Explicit modes can pin a single commit, a whole branch since it forked, or any
// base/head pair. Produces the exact
// base/head to diff plus a human label and active mode for the UI.
import {
  describeBase,
  isDirty,
  commitParentBase,
  describeCommit,
  isCommitRef,
  branchForkPoint,
  currentBranch,
  resolveCommit,
} from './git.js';

export interface Scope {
  base: string;
  head?: string;
  label: string;
  active: 'uncommitted' | 'commit' | 'branch' | 'compare';
  /** Branch scope only: the branch under review. */
  branch?: string;
  /** Branch scope only: the parent ref, when the URL pinned one rather than auto-detecting. */
  from?: string;
}

export function resolveScope(repo: string, params: URLSearchParams): Scope {
  const ref = params.get('base');
  if (ref) {
    const head = params.get('head') || undefined;
    // A base→head compare reads cleaner with the refs the user picked than name-rev.
    return {
      base: ref,
      head,
      label: head ? `${ref} → ${head}` : `${describeBase(repo, ref)} → working tree`,
      active: 'compare',
    };
  }
  const sel = params.get('scope'); // 'uncommitted' | 'commit' | 'last' | 'branch' | null (auto)
  if (sel === 'branch') return branchScope(repo, params.get('branch')?.trim() || '', params.get('from')?.trim() || '');
  if (sel === 'commit' || sel === 'last') return commitScope(repo, params.get('commit') || 'HEAD');
  if (sel === 'uncommitted' || (sel == null && isDirty(repo))) {
    return { base: 'HEAD', head: undefined, label: 'Uncommitted changes', active: 'uncommitted' };
  }
  // auto + clean tree → the latest commit (whole first commit if no parent).
  return commitScope(repo, 'HEAD');
}

function commitScope(repo: string, requested: string): Scope {
  const commit = isCommitRef(repo, requested) ? requested : 'HEAD';
  return {
    base: commitParentBase(repo, commit),
    head: commit,
    label: commit === 'HEAD' ? 'Latest commit' : `Commit ${describeCommit(repo, commit)}`,
    active: 'commit',
  };
}

/**
 * A whole branch since it forked: merge-base(parent, branch) → branch tip.
 * Committed work only — the working tree is what "Uncommitted" and a compare to
 * `Working tree` are for. When no fork point exists (the default branch itself,
 * or an unrelated parent) the scope is honestly empty rather than silently
 * widened to the whole history.
 */
function branchScope(repo: string, requested: string, from: string): Scope {
  const branch = requested && isCommitRef(repo, requested) ? requested : currentBranch(repo) ?? 'HEAD';
  const parent = from && resolveCommit(repo, from) ? from : undefined;
  const fork = branchForkPoint(repo, branch, parent);
  const pinned = parent ? { from: parent } : {};
  if (!fork) {
    const why = parent ? `shares no history with ${parent}` : 'has no fork point from another branch';
    return { base: branch, head: branch, label: `${branch} ${why}`, active: 'branch', branch, ...pinned };
  }
  if (fork.ahead === 0) {
    return { base: fork.base, head: branch, label: `${branch} is already in ${fork.parent}`, active: 'branch', branch, ...pinned };
  }
  const commits = `${fork.ahead} commit${fork.ahead === 1 ? '' : 's'}`;
  return {
    base: fork.base,
    head: branch,
    label: `${branch} since ${fork.parent} (${fork.base.slice(0, 7)}) · ${commits}`,
    active: 'branch',
    branch,
    ...pinned,
  };
}
