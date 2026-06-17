# diffStory App — Review-Flow Redesign (the "Your change" front door)

**Date:** 2026-06-17
**Status:** Approved design, pending implementation plan

## Why

The desktop app shipped its internal concepts raw and confused a first-time user:

- The agent console ("Agent is working…") appeared to start on its own. (It doesn't — it
  only opens from "Ask agent" / "Address all open" — but those labels never said they
  launch a local AI, so a click felt like a surprise.)
- The word **tour** is everywhere (picker badges, error copy) with no explanation of what
  it is or what it covers.
- The picker labels repos "Tour ready / No tour" as if a tour is a permanent property of a
  repo, raising "can a repo have many tours?" — which the app neither answers nor supports.
- Opening a repo with no tour drops you on a raw error page telling you to run
  `/review-tour`, treating the *normal starting point* as a failure.

The root cause: the app had no honest front door. It assumed you already knew diffStory.

## Settled model (from design Q&A)

1. **Unit of review = your current change.** You open diffStory to review *what your agent
   just did*. There is **one** review at a time, for that change. No multi-tour management,
   no PR list.
2. **A "tour" is the agent-written reading order for that one change** — start here, follow
   the call into this file, come back — with a one-line *why* per stop. One change → one
   tour.
3. **The agent is your local `claude`/`codex`, and it never runs without an explicit,
   clearly-labeled click.** It runs at exactly two moments: **Generate** (write the tour)
   and **Address** (reply to/fix review comments).
4. **Default diff scope is smart + switchable.** The app auto-picks the most likely scope
   (your branch vs `main`, committed + uncommitted — the existing `resolveBase` logic) and
   offers an obvious switcher: uncommitted only / since a commit / vs another branch.

## The flow: three screens, two agent moments

```
Pick repo  ──▶  Your change (NEW)  ──[Generate ▸ agent runs]──▶  Guided review
 (picker)        pure git, no AI                                  (+ Address ▸ agent runs)
```

The agent runs ONLY at the two marked arrows, each from a button that says so.

### Screen 1 — Pick your repo (recast picker)

The existing picker (recents + server-backed folder browser) stays, with one change:
**remove the "Tour ready / No tour" status pill** from recent cards — it leaks an internal
concept and implies a tour is a repo property. Keep the honest, non-AI signals: repo name,
path, last-opened, and an optional neutral "N changed files" hint. Opening a repo sets the
session and routes to Screen 2 (or straight to the review — see routing).

### Screen 2 — Your change (NEW — the missing front door)

This is the screen the user landed on with no tour and got ambushed. It is **pure git — no
agent runs here.** Server-rendered like the rest of the app. Contents:

- **A one-line "what is this":** *"The agent that wrote your change walks you through it —
  in the order the code actually flows."* So you never face jargon cold.
- **Your current change:** the changed files with +/− counts, against a **smart default
  base** (`resolveBase`, labeled via `describeBase`, e.g. "vs main (a1b2c3d)"), plus a
  **scope switcher** — uncommitted only / since a commit / vs another branch — fed by the
  existing `GET /api/refs`. Changing scope re-renders the file list.
- **One primary action:** **"Generate guided review"**, with plain supporting copy directly
  beneath it: *"Runs your local Claude / Codex to write the walkthrough — about a minute.
  Nothing starts until you click."*
- **Empty change guard:** if the chosen scope has no changes, show "Nothing to review
  against `<base>` — make a change or pick another scope," not a Generate button.

When **Generate** is clicked: the agent runs via the existing `POST /api/generate` (streams
NDJSON), surfaced in the **agent console shell** with the cancelable **Stop** button. On
success the page navigates into the review (Screen 3).

### Screen 3 — Guided review (existing)

Unchanged in behavior: walk the tour in order, comment on lines, and **Address** (single
comment or all-open) hands comments back to the agent under the same rule — clearly
labeled, runs only on click, cancelable via the console.

## Routing (server `GET /`)

| Session state | Today | New |
|---|---|---|
| `repo == null` | picker | picker (Screen 1) |
| repo set, **no** story file | **error page** ("re-run /review-tour") | **Screen 2** (Your change) |
| repo set, story file exists | review | review (Screen 3) — unchanged |

"Story exists" stays the existing `existsSync(resolveStoryPath(repo))` check. v1 treats any
present story as "review ready" and always offers a "Regenerate" path back to Screen 2.
*(Detecting a stale tour — story present but not covering the current diff, via the existing
`computeCoverage`/`stalePointers` — is a noted future refinement, not v1.)*

## Agent-run policy (the core fix, stated once)

- The agent starts from exactly two buttons: **Generate guided review** (Screen 2) and
  **Address** (Screen 3). Both carry copy that says they run your local agent.
- No agent run is ever triggered by opening a repo, loading a page, or any implicit action.
- Every run is **cancelable** (Stop button → kills the agent process; closing the page also
  kills it — already implemented) and shows live progress (task name + streamed actions).

## What's new vs reused

- **New:** Screen 2 (the "Your change" overview) — a server-rendered page with the change
  summary, scope switcher, and Generate button + copy. This is the only genuinely new
  surface.
- **Reused as-is:** folder browser + recents (`fs-browse`, `/api/fs`, recents store), the
  review page, the agent console (with Stop), `POST /api/generate`, `GET /api/refs`,
  `resolveBase`/`describeBase`/`getDiff`/`parseUnifiedDiff`.
- **Small edits:** picker recent-card markup (drop the tour pill); server `GET /` routing
  (no-tour → Screen 2 instead of error page); copy/labels for clarity.

## Out of scope (YAGNI)

- Multiple tours per repo / a review history / PR list (the model is one current change).
- Reviewing teammates' branches as a first-class flow (the "specific branch/PR" model was
  not chosen).
- Stale-tour detection on Screen 2 (future refinement).
- Any change to how the tour itself is authored or rendered.

## Testing

- **Screen 2 render** is pure git + HTML — unit-test the view builder (change summary +
  scope label) against a temp git repo, like `repo-state`/`fs-browse` tests.
- **Routing** — extend the app-server integration test: open a repo with **no** story →
  `GET /` returns Screen 2 (assert its marker copy + a "generate" control), not the error
  page; with a story present → still the review.
- **Agent-run policy** — assert (integration) that `GET /` for a no-tour repo does **not**
  start any agent (no `/api/generate` call happens server-side without the explicit POST).
- Existing 50 tests stay green; `dist/` rebuilt and committed with the change.

## Phasing

One focused plan: build Screen 2 + the routing change + the picker pill removal. The agent
console, Stop, generate backend, and folder browser are already in place, so this is a
single coherent slice that makes the whole app honest about itself.
