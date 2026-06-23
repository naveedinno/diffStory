// The one mutable thing the server holds: which repo is open and what to diff.
// Single-window app → one session is enough, and matches the existing
// "one agent run at a time" invariant.
export interface Session {
  repo: string | null;
  base?: string;
  head?: string;
  selectedStory?: string | null;
  chooseStory: boolean;
}

export function createSession(init: { repo: string | null; base?: string; head?: string }): Session {
  return {
    repo: init.repo,
    base: init.base,
    head: init.head,
    chooseStory: init.repo === null,
  };
}

/** Open a repo: set it and clear any prior base/head selection. */
export function openSession(s: Session, repo: string): void {
  s.repo = repo;
  s.base = undefined;
  s.head = undefined;
  s.selectedStory = undefined;
  s.chooseStory = true;
}

/** Close the current repo, returning to the picker. */
export function closeSession(s: Session): void {
  s.repo = null;
  s.base = undefined;
  s.head = undefined;
  s.selectedStory = undefined;
  s.chooseStory = true;
}
