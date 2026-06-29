// Resolve the review scope for the "Your change" screen. The default is "what I just
// did": uncommitted changes if the working tree is dirty, otherwise the latest commit.
// Explicit modes can pin a single commit, the committed current branch, or any
// base/head pair. Produces the exact base/head to diff plus a human label and active
// mode for the UI.
import {
  resolveBase,
  describeBase,
  isDirty,
  commitParentBase,
  describeCommit,
  isCommitRef,
} from './git.js';

export interface Scope {
  base: string;
  head?: string;
  label: string;
  active: 'uncommitted' | 'commit' | 'branch' | 'compare';
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
  const sel = params.get('scope'); // 'uncommitted' | 'last' | 'branch' | null (auto)
  if (sel === 'branch') {
    return { base: resolveBase(repo), head: 'HEAD', label: 'Current branch', active: 'branch' };
  }
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
