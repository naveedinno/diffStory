// Resolve the review scope for the "Your change" screen. The default is "what I just
// did": uncommitted changes if the working tree is dirty, otherwise the latest commit.
// Explicit presets (?scope=) and a compare-ref (?base=) override the default. Produces
// the base/head to diff plus a human label and which preset is active, for the UI.
import { resolveBase, describeBase, isDirty, hasParentCommit, emptyTree } from './git.js';

export interface Scope {
  base: string;
  head?: string;
  label: string;
  active: 'uncommitted' | 'last' | 'branch' | 'ref';
}

export function resolveScope(repo: string, params: URLSearchParams): Scope {
  const ref = params.get('base');
  if (ref) {
    return { base: ref, head: params.get('head') || undefined, label: describeBase(repo, ref), active: 'ref' };
  }
  const sel = params.get('scope'); // 'uncommitted' | 'last' | 'branch' | null (auto)
  if (sel === 'branch') {
    return { base: resolveBase(repo), head: undefined, label: 'Everything on this branch', active: 'branch' };
  }
  if (sel === 'uncommitted' || (sel == null && isDirty(repo))) {
    return { base: 'HEAD', head: undefined, label: 'Uncommitted changes', active: 'uncommitted' };
  }
  // 'last' explicitly, or auto + clean tree → the latest commit (whole first commit if no parent).
  const base = hasParentCommit(repo) ? 'HEAD~1' : emptyTree(repo);
  return { base, head: 'HEAD', label: 'Latest commit', active: 'last' };
}
