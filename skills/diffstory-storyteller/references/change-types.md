# Change-type playbooks

Part of the diffstory-storyteller skill. Read the entry for the `storyArc.changeType`
you chose, and the surface entries for the kinds of files the diff touches.
Each entry says how to open, what order to walk, and what evidence the
reviewer needs before they can trust this kind of change.

## By change type

### bug-fix

- Open on the symptom a user or caller saw, then the trigger that produces it.
  Shape `cause-effect`; a typical path is
  `symptom -> trigger -> root cause -> fix -> regression proof`.
- Name the root cause at the line where it lives, and say when there was more
  than one cause; a single "the bug was X" often hides a second.
- Put the fix at the causal point, then the regression test that fails
  without it. If you could not reproduce the failure, say so in `verification`
  and keep the claim narrow.

### feature

- Open on the capability that was missing and who needed it. Shape
  `entry-implementation`: the entry point a developer recognizes, then the new
  path end to end: guards, state, effects, then the tests that pin it.
- For every new entry point, say who may call it and what stops everyone else.

### refactor

- One hat at a time. Open on what must not change (the behavior the refactor
  preserves) and why the structure changes.
- Record every relocation as a `moved`, `extracted`, or `inlined` move.
- A systematic edit is one exemplar step plus a sweep: narrate the first
  instance fully, claim the rest with top-level `ranges`, and name any
  instance that deviates from the pattern. A deviation is where refactors break.
- The proof is that behavior did not change: tests that still pass unchanged,
  or an equivalence argument at the riskiest move. If the refactor also changes
  behavior, give that its own chapter and say so in `summary`.

### security

- Open in advisory form: "<weakness> in <component> allowed <who> to <impact>
  via <vector>." Then the trust boundary, the fix at that boundary, and the
  test that attacks it.
- Say what an attacker can still do after the fix, if anything.
- Do not spell out exploit steps beyond what the diff and tests already show.

### performance

- Open on the cost that mattered (latency, gas, memory, calls) and where it
  went. Shape `before-after`.
- Show the measurement: the benchmark, gas snapshot, or profile, before and
  after, and how it was taken. If nothing was measured, record that in
  `verification` as `not-run` and claim only what the code shows.
- Name the trade-off (memory for speed, readability for gas, a cache that can
  go stale).

### migration

For API, storage, protocol, or dependency changes other code relies on.

- Name the phase: expand (old and new both work), migrate (callers move), or
  contract (old path removed).
- Name the compatibility class: source, wire/ABI, storage layout, or semantic.
  Changing a default is a breaking semantic change.
- Say who must act (callers, deployers, indexers, integrators) and the
  rollback path. Put the removed or renamed surface early.

### maintenance

Dependency bumps, tooling, CI, formatting.

- Brief is usually right. Say what changes for developers or the build, and
  the one risk worth checking (a transitive behavior change, a new default).
- Lockfiles and generated output are one sweep each, never a series of steps.

### mixed

- Name each concern in `summary` ("two independent changes: X, then Y"),
  finish one before starting the next, and open each new concern by announcing
  the switch (Branch rule). Give each concern its own chapter.

## By surface

### Smart contracts (Solidity)

- Land on the external or public function and the role of `msg.sender`, then
  the access control that gates it (modifier, role check, pause flag).
- Walk state writes in execution order; say where checks, effects, and
  interactions happen, and which events are emitted with what payload.
- Units, decimals, and rounding direction get one concrete trace
  ("1e18 collateral at a 5% fee rounds the fee down to …").
- For upgradeable contracts, say what happens to storage layout (append-only,
  no reordering) and whether selectors or the ABI changed, and who must
  redeploy or re-integrate.

### UI and CSS

- The reviewer cannot see the render. Say what the user sees before and after,
  in words, at the component that owns it.
- Group CSS by visual outcome, not by selector; one stop per visible change.
- Hotspots go on responsive, empty, error, and focus states; `verification`
  says which browsers and sizes you actually looked at.

### Docs

- Say who reads the doc and what they can now do or understand.
- One stop per section whose meaning changed; wording-only edits are one sweep.
- Never hand the audit back ("spot-check the fields"). Say which facts you
  verified against code, and record the rest as a hotspot.

### Data schemas, ABIs, and indexers

- Show the schema and the code that writes or reads it side by side (one beat,
  or a paired view), not in two distant steps.
- Say what existing data looks like after the change and whether it needs a
  backfill or re-index.

### Config, generated files, lockfiles

- Never narrate them as decisions. One sweep step per generator: what produced
  the output and that nothing was hand-edited. If a value in config is a real
  decision (a limit, an address, a feature flag), it gets a normal step.
