export function createSession(init) {
    return { repo: init.repo, base: init.base, head: init.head };
}
/** Open a repo: set it and clear any prior base/head selection. */
export function openSession(s, repo) {
    s.repo = repo;
    s.base = undefined;
    s.head = undefined;
}
/** Close the current repo, returning to the picker. */
export function closeSession(s) {
    s.repo = null;
    s.base = undefined;
    s.head = undefined;
}
