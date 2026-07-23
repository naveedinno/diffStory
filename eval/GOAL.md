# Story quality goal

The target the improvement loop runs against. "Good" has to be falsifiable or
the loop can never end, so it is defined as measurable exit criteria, not taste.

## Exit criteria — all must hold in ONE run, on the SAME skill version

1. **Every case produces a story.** 4/4 generate successfully. A case that times
   out is a failure, not an absence.
2. **Structurally valid.** `validateTour` and `validateGeneratedTour` both report
   0 errors for every case. This is a hard gate: a malformed story is worthless
   however well it reads.
3. **Covered.** At least 90% of the diff's changed ranges are fully claimed per
   case (`fullyClaimedChangedRanges / totalChangedRanges >= 0.9`). Coverage is
   the trust floor — the reviewer sees "N unexplained changes" otherwise.
4. **Genuinely useful.** Judge mean ≥ 4.0 for every case, and no single dimension
   below 3 in any case.

## Current status (2026-07-22)

The ChatGPT-agent `ranges` run meets the generation, validation, and coverage
gates: 4/4 stories, no validation or stale-pointer errors, and all 218 changed
clusters covered, including after re-scoring with the final diff-aware range
hardening. It does **not** close the full quality loop yet. The no-sweep small
case averaged 3.83 after regeneration, and one judge scored its hotspot honesty
at 2; both judges preferred that case's baseline. The three cases that actually
had mechanical tails all improved, so the `ranges` experiment itself succeeded
without making the global exit criteria easier.

## Non-goals for this loop

- Chasing a 5.0 mean. The judge is calibrated so 5 is rare; 4.0 across four
  diverse cases is a strong story.
- Requiring `question_falsifiability` from skim, sweep, or mechanical steps.
  Those steps are already exempt from the generated-story question requirement;
  judge question quality on substantive review stops instead of manufacturing
  rhetorical questions for coverage-only work.

## Rules the loop follows

- Reinstall the skill before every run; a stale install scores the wrong thing.
- Change ONE thing per iteration where possible, so the next result is
  attributable. Log what changed and what moved.
- Prefer pinning machine-checked contracts in the prompt over adding prose to
  the skill. Adding prose has already made things worse once.
- In the current `ranges` teaching experiment, success means fewer mechanical
  tail steps without increasing uncovered changes or validation errors. Treat
  the ChatGPT-agent before/after as a separate same-model comparison, not as a
  result to mix into the historical iter3/iter4 measurements.
- Stop when the exit criteria are met, or when two consecutive iterations move
  nothing — at that point the remaining gap is structural and belongs in a
  product change, not another prompt edit.
