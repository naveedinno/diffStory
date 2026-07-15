# Live Review Loop

Date: 2026-07-15
Status: approved for implementation

## Problem

diffStory's core loop is agent ↔ reviewer, but nothing in the browser is live.
Agent progress streams only inside the one-shot NDJSON POST; after that, an
open review has no way to learn that the agent replied to comments, updated the
story, or changed the working tree. `Reload diff` is a full `location.reload()`
and review-state freshness is only re-checked when the user mutates a comment.
The reviewer discovers agent work by habit-refreshing.

## Goal

An open review page notices, without a manual reload:

- new or updated agent replies in `.diffstory/comments.json`
- review-round/timeline changes in `.diffstory/review-state.json`
- story changes in `.diffstory/story.json` or `.diffstory/stories/`
- working-tree diff drift relative to the fingerprint the page rendered with

## Behavior contract (hybrid)

- **Non-destructive state refreshes in place automatically.** Comment replies,
  feedback cards, unresolved counts, and review-timeline identity update
  without user action, reusing the existing idempotent client paths.
- **Content changes never re-render under the reader.** A changed diff or
  story shows one quiet, dismissible banner with a Reload action. The page
  never reloads itself, never moves the viewport, and never steals focus.

## Architecture

### Server: event hub (`src/live.ts`, new)

A per-repo watch group exists only while at least one live client is connected
for that repo, and is disposed when the last client disconnects. The app keeps
its existing one-active-repository session, but a bounded lease registry lets
multiple `/diff` and `/review` tabs for that repository remain valid at once.
Opening another repository clears every old lease and live connection; keeping
multiple repositories active in one server is out of scope.

Each group runs two sources:

1. **`fs.watch` on `<repo>/.diffstory/`** (directory-level, non-recursive plus
   a nested watcher for `stories/`), so editor atomic rename-writes are
   caught. Events are debounced ~200 ms and classified by filename:
   - `comments.json` → `comments-changed`
   - `review-state.json` → `review-state-changed`
   - `story.json`, `stories/*` → `story-changed`

   If `.diffstory/` or `stories/` does not exist yet, the poll loop attaches or
   reattaches the relevant watcher once it appears. If a watcher errors or its
   directory is removed, the group falls back to a stable file signature inside
   the poll loop and keeps emitting the same invalidations. Story invalidations
   are matched against each lease's selected story path, so an unrelated named
   story does not make every tab stale.

2. **Fingerprint poll**, default every 4 s, one per distinct `(base, head)`
   scope among the group's connected clients — never per tab. Each tick
   recomputes `reviewChangeFingerprint(repo, base, head)` (`src/git.ts:180`)
   and compares it against each client's lease fingerprint:
   - mismatch → `diff-changed` to the stale clients (once per transition)
   - later match again (agent reverted) → `diff-synced` so the banner clears

Fingerprint ticks never overlap: the next timeout is scheduled only after the
previous synchronous Git fingerprint pass finishes. Debounce, polling,
heartbeat, watcher creation, and scheduling are injectable so tests never
sleep or depend on platform-specific `fs.watch` timing. The 4 s default must be
measured against a large dirty repository before being treated as final.

### Page leases

- `Session.reviewPageLease` becomes a bounded token → lease registry. Leases
  carry their immutable repo, base/head, rendered fingerprint, story path and
  identity, mode, and evidence fingerprints. They expire after a generous idle
  lifetime and the oldest lease is evicted when the bound is reached.
- Multiple tabs are supported only for the currently active repository.
  Opening or closing a repository clears the registry and disconnects its hub.
- Lease-scoped reads resolve repo/base/head/story from the lease, not from the
  session's latest navigation. Existing strict validation remains on lazy diff
  evidence and verdict writes.

### Transport: SSE

- Endpoint: `GET /api/events?page=<lease token>`.
- The endpoint uses a live-lease resolver, not strict lazy-panel validation.
  It authenticates the token and active repository but deliberately tolerates
  diff/story drift so it can report that drift. Invalid or expired lease →
  `204`, which tells `EventSource` not to reconnect forever.
- Response: `Content-Type: text/event-stream`, `Cache-Control: no-store`,
  heartbeat comment line (`: ping`) every 15 s.
- Event format: `event: <type>` plus one JSON `data:` line.
- No WebSocket and no new dependency; plain Node `http` response streaming.

### Events

| event | data | client action |
| --- | --- | --- |
| `comments-changed` | `{}` | run existing `refreshComments()`; the client derives a toast from the refresh delta (e.g. "Agent replied to 2 comments"); no visible delta → no toast |
| `review-state-changed` | `{}` | run lease-scoped `refreshReviewState()`; update round/snapshot/verdict identity and replace the rendered timeline |
| `story-changed` | `{}` | show banner: story updated |
| `story-synced` | `{}` | clear the story banner if the selected story was restored |
| `diff-changed` | `{ fingerprint }` | show banner: diff changed since load |
| `diff-synced` | `{ fingerprint }` | clear the diff banner if visible |

The server also sends an initial `state` event containing current diff and story
identities. On every initial connection or reconnect the client refreshes
comments and review state, then derives content banners from that state. SSE is
an invalidation channel rather than an event log, so a write that happens while
the connection is down is recovered without `Last-Event-ID` replay.

Overlap with in-page agent runs is acceptable: refresh paths are idempotent.
Reply notifications compare newly fetched AI turns with the pre-refresh cache;
only newly observed AI turns produce "Agent replied" feedback.

### Client (inline runtime in `src/page-assets.ts`)

- One `EventSource` per leased page. The leased surfaces are the storyless
  `/diff` review and guided `/review`; the scope-picker `/change` page is not
  leased. The "All files" tab is part of those review surfaces.
- `EventSource` auto-reconnect handles transient drops. `onerror` starts a
  short grace timer before showing "live updates disconnected — reload";
  `onopen` clears that state and runs the recovery refresh. A dead lease stops
  reconnecting via the endpoint's `204` response.
- No new client framework; a small `startLiveEvents()` block wired where the
  page boots, gated on the presence of a lease token.

### Banner

- One quiet, dismissible strip adjacent to the semantic review ledger.
- Informational blue per DESIGN_MEMORY (amber stays reserved for blockers).
- One sentence + one **Reload** action + dismiss. Reload preserves current
  scope params (same URL), matching today's reload semantics.
- ARIA live region (`polite`), stable accessible name, ≥44 px targets, no
  entrance animation under reduced motion, WCAG AA in both themes.
- Priority when multiple triggers stack: diff-changed wins over story-changed
  wins over disconnected; one banner at a time. Dismissal is remembered for
  the current trigger generation, while a later transition may show it again.

## Lifecycle and edge cases

- Multiple tabs on the active repo share one watch group; each tab has its own
  lease and staleness comparison.
- Opening another repo closes the prior repo's clients and clears its leases.
- Last client disconnects → dispose watchers and clear the poll timer; no
  background work with zero clients.
- Watch events are invalidations, not proof that external asynchronous writes
  are complete. Debounce absorbs normal and atomic-rename writes; refresh reads
  preserve existing content and retry on transient invalid JSON. The server
  does not suppress events for its own writes
  (e.g. a comment POST from the same tab) — the client refresh paths are
  idempotent, so the extra event is a no-op.
- The hub never reads or transmits file contents over SSE — event names and
  fingerprints only; the client re-fetches through existing authenticated
  endpoints.

## Testing

- New `test/live-events.test.mjs` via the existing app-server harness:
  - open SSE with a real lease; write `comments.json` → `comments-changed`
  - write `review-state.json` → `review-state-changed`
  - write `story.json` → `story-changed`
  - mutate the working tree, tick the injectable poll → `diff-changed`;
    revert → `diff-synced`
  - disconnect the last client → watchers disposed, poll cleared
  - missed write during reconnect is recovered by the initial state/refresh
  - unrelated named-story write does not stale another story lease
  - invalid lease → `204` and no reconnect loop
  - two page leases stay valid until bounded eviction/expiry
- `test/render-page.test.mjs`: banner markup, data hooks, ARIA contract,
  reduced-motion rule.
- Existing motion-regression suite must stay green.

## Out of scope

- Auto-re-rendering changed file panels or story steps (rejected
  "fully automatic" mode).
- Watching the whole working tree with `fs.watch` (the fingerprint poll
  covers diff drift more reliably and more cheaply).
- VS Code extension parity for live events.
- Pausing the poll for hidden tabs (local, cheap; revisit only if it shows up
  in practice).
