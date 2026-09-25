# Worked examples

Part of the diffstory-storyteller skill. Read once per session, before your first story.

### 3.6. What good looks like: the same diff, told twice

One small diff: `settleFunding()` in `Funding.sol` gains a clamp, a new
`_capRate()` helper lands in `RateMath.sol`, and `RateMath.t.sol` gets a test.

**The changelog (do not write this).** File order, diff-restating beats:

```text
1. "Update Funding.sol"       — why: "Adds a cap check to settleFunding()."
2. "Add RateMath.sol helper"  — why: "Adds a _capRate() helper for clamping."
3. "Add tests"                — why: "Adds tests for the new helper."
```

Every hunk covered, every gate passed, and the reviewer learned nothing the diff
did not already say. The real hinge — can an unclamped rate still reach
balances? — is never named.

**The story (write this).** Same three stops, ordered by the runtime path, each
beat picking up what the previous stop established:

```text
1. "Entry: settleFunding() clamps before balances move"
   beat: "Start here: this is settleFunding(), the path the keeper hits each
          epoch, and the old code handed the raw rate straight to settlement."
   beat: "Now the rate passes through _capRate() first — the review hinge is
          that this happens before any balance mutation."
2. "Helper: _capRate() owns the inclusive boundary"
   beat: "This is _capRate(), where settleFunding() just sent us; the cap is
          inclusive, so rate == cap must pass."
3. "Proof: the boundary test pins rate == cap"
   beat: "Final proof: testCapIsInclusive drives settleFunding() at the exact
          cap and fails if the boundary flips to exclusive — it guards the
          hinge from step 2."
```

The difference is not length or polish: each stop exists because of the
previous one, each first beat says whose code this is, and
each beat names the failure its evidence rules out.
