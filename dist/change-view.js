// The data behind the "Your change" screen: what changed, against what base.
// Pure composition over git.ts — no agent, no side effects.
import { resolveBase, describeBase, numstat } from './git.js';
/** Describe the current change. `base`/`head` override the smart default (resolveBase). */
export function summarizeChange(repo, base, head) {
    let fellBackFrom = '';
    const resolved = resolveBase(repo, base, (requested) => {
        fellBackFrom = requested;
    });
    const files = numstat(repo, resolved, head);
    return {
        base: resolved,
        baseLabel: describeBase(repo, resolved),
        files,
        totalChanged: files.length,
        hasChanges: files.length > 0,
        ...(fellBackFrom
            ? { note: `${fellBackFrom} is not a known ref, showing ${describeBase(repo, resolved)} instead.` }
            : {}),
    };
}
