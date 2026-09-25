# Baseline — storyteller skill as of 9a88ea0, measured 2026-09-25

## Eval (rubric v2, judge muse-spark-1.3-contributor, generator muse-spark-1.3-contributor)

Runner: muse (`--runner muse`). The campaign planned Claude Sonnet, but the
Claude account's session quota was exhausted when the run started (429 on all
six generations), so the baseline was measured on Muse instead; plan 025 must
use the same runner and model to stay comparable.

# Story eval — baseline-2026-09

Generated 2026-09-25T11:16:11.369Z · runner: muse · generator: muse-spark-1.3-contributor · judge: muse-spark-1.3-contributor

| case | mode | mean | declared_path_alignment | evolution_fidelity | narrative_order | thread_continuity | claim_falsifiability | beat_pointing | intent_grounding | hotspot_honesty | landing | listenability | rationale_depth | concreteness | newcomer_coverage | markup_judgment | val errors | md residue | lint E | lint W | uncovered | steps | hotspots | tables |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bugfix-review-ui | guided | 3.71 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 3 | 3 | 0 | 0 | 0 | 14 | 0 | 17 | 3 | 0 |
| small-feature-walkthrough-stage | brief | 3.36 | 5 | 5 | 4 | 4 | 2 | 3 | 3 | 5 | 3 | 3 | 2 | 3 | 2 | 3 | 0 | 0 | 0 | 5 | 0 | 4 | 2 | 0 |
| refactor-one-shot-notes | guided | 3.5 | 4 | 5 | 4 | 4 | 3 | 3 | 5 | 4 | 3 | 3 | 3 | 3 | 2 | 3 | 0 | 0 | 0 | 9 | 13 | 16 | 2 | 0 |
| medium-feature-rail-numerals | detailed | 4 | 5 | 5 | 5 | 4 | 5 | 4 | 4 | 5 | 3 | 3 | 3 | 3 | 3 | 4 | 0 | 0 | 0 | 5 | 0 | 9 | 2 | 0 |
| sol-feature-wallet-withdraw | detailed | 3.71 | 5 | 5 | 4 | 4 | 4 | 4 | 4 | 5 | 3 | 2 | 4 | 3 | 2 | 3 | 0 | 0 | 0 | 2 | 0 | 13 | 3 | 0 |
| sol-fix-recovery-api | guided | 3.14 | 4 | 5 | 2 | 4 | 2 | 4 | 3 | 5 | 4 | 2 | 2 | 2 | 2 | 3 | 0 | 0 | 0 | 12 | 10 | 50 | 3 | 0 |

## bugfix-review-ui

- verdict: Yes, it would help a reviewer verify the ghost split, hidden, boot, and regex fixes quickly despite weak touch-target sweeps.
- worst step: s13 because one generic beat sweeps six unrelated 44px grows with no sizes, no code symbol, and claims one instance verifies the pattern
- lint: 0 errors, 14 warnings {"formulaic-opener":1,"landing-missing-symbol":7,"why-copies-beats":3,"offscreen-claim":2,"tests-at-tail":1}
- declared_path_alignment (4): Reading path names five phases in order and steps follow them, though hidden rule and preview fit their buckets loosely.
- evolution_fidelity (5): Single-commit history makes evolution ineligible and the story correctly omits it.
- narrative_order (4): Ghost styles then server markup then client behavior plus server then client rebuilds beat file order, though boot preview composer and sweeps stay thematic.
- thread_continuity (4): Explicit that closes transitions carry the chapters, but island surface, filmstrip, and trust drawer arrive without prior teaching.
- claim_falsifiability (4): Most whys name checkable order and negative claims, but sweep whys in s12 and s13 tell the reviewer one instance verifies the pattern.
- beat_pointing (4): Most beats explain the leak or mechanism each hunk prevents, but sweep beats and several openers restate the visible change.
- intent_grounding (4): Goal and design name exact selectors and behaviors matching the diff, but the only source is the commit itself with no 44px standard or nonGoals.
- hotspot_honesty (4): Three first-person doubts name concrete untested manual checks, but aria tab wiring and hidden important blast radius get no hotspot.
- landing (3): New chapters name what the prior settled and most openers give who and when, but nine first beats name no symbol in code.
- listenability (3): Beats stay short with new info at the end, but This is opens thirteen first beats and chapter beats pack transition plus orientation plus change.
- rationale_depth (4): Legacy retention, hover pin, hidden force, boot order, and regex get local why and why-not, but 44px origin and composer wording do not.
- concreteness (3): Boot and regex give explicit old versus new behavior, but touch sweeps never quote old and new sizes.
- newcomer_coverage (3): Concept plus landings teach ghost cards, note actions, and builders, but island, filmstrip, verification, and resume semantics stay thin.
- markup_judgment (3): HTML is valid with code used for identifiers and no Markdown or tables, but it stays plain where a selector or size mapping would earn a grid.

## small-feature-walkthrough-stage

- verdict: This story would help a reviewer find and check the island and kicker changes quickly but would not answer why the specific values and styles are correct.
- worst step: s3 because its why restates the title, its beats skip the tune alignment and font changes on the same line, and baseline versus center is never justified.
- lint: 0 errors, 5 warnings {"landing-missing-symbol":2,"why-copies-beats":3}
- declared_path_alignment (5): Reading path 'stage island -> kicker markup -> kicker style -> proof' names the four steps in order and the step order follows it exactly.
- evolution_fidelity (5): Single-commit history makes evolution ineligible and the story correctly omits it.
- narrative_order (4): Markup before style preserves the emit-then-style causal chain that filename grouping would break, though the island-first placement is independent rather than causal.
- thread_continuity (4): Explicit 'Second change' and 'just emitted' handoffs link the two gaps, but the island-to-kicker switch is still two mini-stories rather than one continuous arc.
- claim_falsifiability (2): Only the island-edge and regression-pin whys state checkable consequences while the kicker markup/style whys merely restate the change.
- beat_pointing (3): Beats give local purpose like readability and scope limits but rarely say what the lines unlock next.
- intent_grounding (3): Goal and design accurately describe the diff but cite only the commit itself with no mockup or external source.
- hotspot_honesty (5): Both hotspots name specific untested interactions with concrete widths and competing controls to chase.
- landing (3): First beats orient by audience and change but two lack <code> symbols and new chapters rarely recap what the previous settled.
- listenability (3): Beats are short with varied openings but every beat repeats the 'I <verb> ... so ...' frame and first beats pack two ideas.
- rationale_depth (2): No beat answers why this value over the obvious alternative like 66px gutter, 880 width, baseline, or Check versus dot.
- concreteness (3): Dot-to-Check and island-edge contrasts give old-versus-new while baseline and island sizing lack explicit before behavior.
- newcomer_coverage (2): CodeStepPanel and ghosts-as-prev/next are taught but kicker, reviewFocus, and tune/repair arrive without definition.
- markup_judgment (3): Inline <code> is correct where used with no tables or Markdown, but two landings miss code markup where identifiers needed it.

## refactor-one-shot-notes

- verdict: Yes, it would help a reviewer trace the one-shot deletion layer by layer and verify absences, despite unexplained lease and blocking terms plus repetitive test framing.
- worst step: s2 because its why ends with unverifiable boilerplate about one local instance verifying the pattern and its first beat names no test symbol in code.
- lint: 0 errors, 9 warnings {"landing-missing-symbol":3,"beat-too-long":2,"offscreen-claim":4}
- declared_path_alignment (4): Reading path names six layers in order and steps follow state to server to page to client to history to record, though tests are unstated and page and client share one chapter.
- evolution_fidelity (5): Single-commit history at 45d4f55 makes evolution ineligible, so omitting an evolution section is correct.
- narrative_order (4): Layer order follows the live-state causal chain from summary helper to server poll to render to client sync to history, which alphabetical file order would scramble, though test sub-order within chapters is grouping rather than runtime.
- thread_continuity (4): Concept plus that-closes bridges and proof and still links carry one deletion story forward with no hard jump, though lease and blocking arrive without prior definition.
- claim_falsifiability (3): Most whys name a checkable absence or survivor, but s2 and s4 end with one local instance verifies the pattern and several others use vague still-prove checks nothing could disprove.
- beat_pointing (3): First beats usually explain why the symbol matters, but second beats often enumerate deleted spans across sweep ranges without saying what the shown lines unlock next.
- intent_grounding (5): Goal design and nonGoals name the slim three-field core plus removed verdict checkpoint timeline since snapshot and gating paths plus kept per-note blocking trust freshness lease behavior and the ignored old state file, citing commit 45d4f55 and the design memory file which match the diff.
- hotspot_honesty (4): Two hotspots admit specific unchecked risks around stale reviewRound stamps and the silent review-state-changed subscription, though coverage is thin for 89 hunks and missing ignored-file and 404-consumer doubts.
- landing (3): Source steps name a code symbol plus caller and timing plus change with chapter bridges, but all eight test first-beats open with Proof-for framing and prose test names with no code tag or runner timing.
- listenability (3): Repeated Proof-for plus Still plus That-closes frames plus stacked lists like approval-ladder plus snapshot plus since plus lease plus timeline in one sentence plus multi-identifier openers break one-idea short-sentence flow.
- rationale_depth (3): Story-level why for one-shot versus rounds is clear, but step whys mostly say because no decision survives or because field is gone without addressing obvious alternatives like migrate versus ignore or 404 versus stub.
- concreteness (3): Several steps give concrete old-versus-new or input scenarios like torn-page lease write or touch-diff flips stale, but core state server and sync steps list surviving fields without an input-to-outcome trace.
- newcomer_coverage (2): Concept teaches rounds verdicts timelines since checkpoints scope fingerprint and health well, but lease plus blocking severity plus Challenge pass plus fail-closed plus trust coverage plus torn-page arrive unexplained.
- markup_judgment (3): Only code identifiers are used correctly with no Markdown leakage or tables, so markup is correct but plain with no grid-earning structure.

## medium-feature-rail-numerals

- verdict: Yes, this story would help a reviewer walk the escape runtime, contrast the three numeral states, and safely skim the long weight tail with clear falsifiable checks.
- worst step: s8 because its landing names no <code> symbol, repeats the weight substitution abstractly without old to new numbers, and relies on story and voice lenses that were never taught
- lint: 0 errors, 5 warnings {"beat-too-long":2,"beats-long-on-average":1,"offscreen-claim":2}
- declared_path_alignment (5): The seven-part reading path names each chapter in order and the nine stops follow it exactly from escape call site through numeral restyle to weight sweep.
- evolution_fidelity (5): Single-commit change correctly omits evolution rather than inventing phases from one commit message.
- narrative_order (5): Steps follow runtime and cascade causality (call site to bar to handler, base pill to override to exception, primer to sweeps) that filename or line order would scatter.
- thread_continuity (4): Titles, concept body, and beats chain with explicit handoffs except for an unbridged jump from concept numerals into the weights primer.
- claim_falsifiability (5): Every title plus why states a checkable claim with a named contrast such as same landmark same button no numerals or nothing but the weight changed.
- beat_pointing (4): Beats consistently explain why lines matter and many point forward, though middle beats in the numeral chain describe states without unlocking the next beat.
- intent_grounding (4): Goal and design name the three concrete changes and mechanisms and match the visible diff, cited only to the single commit without deeper sources.
- hotspot_honesty (5): Both hotspots name concrete unverified rendering and contrast doubts with the exact states and themes a reviewer must check.
- landing (3): Most first beats name the symbol in code with caller and timing and s4 closes the prior chapter, but s7 opens the weights chapter without settling numerals and s8 names no code symbol.
- listenability (3): Openings vary with useful prefixes but nearly every landing repeats This is plus code and several beats pack multiple clauses and stacked attributes into one long sentence.
- rationale_depth (3): Escape reuse and weight synthesis risks are justified where visible, but the core numeral choice of color-alone states never answers why not keep a non-color marker.
- concreteness (3): Escape and numeral stops give old versus new behavior in words, while the weight sweeps never cite a concrete old to new number pair in the step itself.
- newcomer_coverage (3): Storyless, rail, thread bar, and fractional weights are taught before use, but primer cards, filmstrip, lenses, and session arrive as unexplained roles.
- markup_judgment (4): Code markup is consistently correct for symbols and weights with no Markdown leakage and no table where prose suffices, but shows no advanced grid-versus-prose judgment.

## sol-feature-wallet-withdraw

- verdict: Yes, this story would help an experienced reviewer move quickly with honest hotspots, though a newcomer listening would still stumble on long beats and missing fee terms.
- worst step: s9 because its first beat lands on existing events with no code symbol and never names WalletFundsWithdrawn, so a listener cannot tell what changed on screen
- lint: 0 errors, 2 warnings {"landing-missing-symbol":2}
- declared_path_alignment (5): Reading path names five stages in order and steps follow them exactly from entry through helper, quotes, receipts, and probe.
- evolution_fidelity (5): Single-commit history makes evolution ineligible so omitting an evolution section is the correct deliberate choice.
- narrative_order (4): Entry, helper, quote, and receipt ordering teaches the feature flow and breaks file order, though the allowlist gate and transfer primitive land out of runtime order.
- thread_continuity (4): Explicit transitions link chapters into one story, with only minor forward references like executeWithFeeLimit left briefly unexplained.
- claim_falsifiability (4): Most titles plus why state checkable orderings and zero-fee claims, but receipt and error steps make system-wide promises their declarations alone cannot disprove.
- beat_pointing (4): Beats consistently explain why lines matter and link forward or back, though a few describe mechanics without naming what the lines unlock next.
- intent_grounding (4): Goal, design, and nonGoals are specific and match the NatSpec and diff, but sources cite only the commit itself and code inference rather than external requirements.
- hotspot_honesty (5): Each hotspot names a concrete unverified risk with the exact check the reviewer should run, from reentrancy to sender attribution to fee revert.
- landing (3): Most first beats name the symbol, caller, and change with good chapter bridges, but the receipt steps open on These without any code symbol and several others omit the change.
- listenability (2): Many beats pack multiple clauses and stacked identifiers into one long sentence instead of one short idea with new information at the end.
- rationale_depth (4): Step-level whys answer fee ordering, helper sharing, and shared failures where visible, but sender attribution and zero-fee design lack explicit not-this-alternative contrasts.
- concreteness (3): Some steps give old versus new behavior like rejected versus admitted quotes, but no logic change traces a concrete input with values through to its outcome.
- newcomer_coverage (2): Primer teaches wallets, creation fees, and relayerless exits, yet gateway, scaled fees, zero wallet selection, and preview versus simulate remain unexplained.
- markup_judgment (3): Markup is valid paragraph and code tagging with no tables or Markdown leaks, but it never uses structure where a fee grid would beat prose.

## sol-fix-recovery-api

- verdict: This story orients a reviewer to the canonical interface and fee-free recovery but its file-order walk and trust-me sweeps still force re-reading the diff to verify.
- worst step: s-test-18 because one withdrawal assertion is asked to prove a 50-span rename sweep across every quote total with no concrete value shown
- lint: 0 errors, 12 warnings {"offscreen-claim":8,"tests-at-tail":1,"import-only-highlight":3}
- declared_path_alignment (4): The path names the real arc and is mostly followed, but deposits/views and quote-import seams are missing from the path.
- evolution_fidelity (5): Single-commit history is ineligible for evolution and the story correctly omits phases without fabricating development.
- narrative_order (2): Steps walk each file in line order from interface to implementation to scripts, so filename sorting would read nearly the same and tests sit apart from behavior.
- thread_continuity (4): Chapter seams with That closes/this starts plus forward pointers keep one flow despite a few unbridged jumps into quote and deploy helpers.
- claim_falsifiability (2): Most whys justify placement or state purpose rather than asserting a checkable behavior the highlights could disprove.
- beat_pointing (4): Beats consistently name who uses the lines and their consequence or next use, though not every beat states what it unlocks next.
- intent_grounding (3): Goal and design are specific and match the diff but cite only the commit itself with no external source or non-goals.
- hotspot_honesty (5): All three hotspots admit a specific unverified risk with file and failure mode a reviewer can directly chase.
- landing (4): First beats almost always name the symbol in code with caller and timing plus prior-chapter closure, except two key seams defer the change to beat two.
- listenability (2): Nearly every landing repeats This is X, the Y with long comma-stacked clauses, so openings and rhythm blur when heard.
- rationale_depth (2): Only isolated spots contrast the chosen approach with the obvious setter or fee alternative where the choice appears.
- concreteness (2): No logic change traces a concrete input to its new output, only abstract no-fee and renamed-basis claims without old-vs-new values.
- newcomer_coverage (2): Decimals and indices get a primer and landings gloss callers, but sub-account, treasury, billing, quota, and delegatecall arrive unexplained.
- markup_judgment (3): HTML is valid with consistent code tags and no Markdown or tables, but plain prose never uses structure where it would earn its place.

Overall mean: 3.57 across 6 cases.
Cases skipped or failed: none. (One generation, sol-fix-recovery-api, died on
Muse transport errors and succeeded on its single re-run; the earlier all-Claude
attempt failed with 429 session-limit on all six cases before any story existed.)

## Lint profile per case

| case | lint errors | lint warnings | top 3 rules |
| --- | --- | --- | --- |
| bugfix-review-ui | 0 | 14 | landing-missing-symbol x7, why-copies-beats x3, offscreen-claim x2 |
| small-feature-walkthrough-stage | 0 | 5 | why-copies-beats x3, landing-missing-symbol x2 |
| refactor-one-shot-notes | 0 | 9 | offscreen-claim x4, landing-missing-symbol x3, beat-too-long x2 |
| medium-feature-rail-numerals | 0 | 5 | beat-too-long x2, offscreen-claim x2, beats-long-on-average x1 |
| sol-feature-wallet-withdraw | 0 | 2 | landing-missing-symbol x2 |
| sol-fix-recovery-api | 0 | 12 | offscreen-claim x8, import-only-highlight x3, tests-at-tail x1 |

## Real-world corpus (scripts/story-corpus-report.mjs, all of ~/Codes)

18 of 53 stories pass basic validation, the generation contract, and lint errors.

- W landing-missing-symbol: 1275
- W why-copies-beats: 458
- W chapter-seam: 128
- E markdown-residue: 95
- W import-only-highlight: 82
- W offscreen-claim: 36
- W beat-too-long: 34
- E copied-beat: 31
- W hotspot-not-a-doubt: 19
- W chapter-pingpong: 15
- W numbered-series: 14
- W tests-at-tail: 11
- W chapter-too-long: 10
- W landing-bare-opener: 7
- W no-hotspots: 6
- W chapter-missing: 4
- W beats-long-on-average: 4
- W hotspot-is-verification: 3
- W line-pointer: 3
- W formulaic-opener: 2
- E line-pointer: 1

## Worst step per case (judge's words)

- bugfix-review-ui — s13 because one generic beat sweeps six unrelated 44px grows with no sizes, no code symbol, and claims one instance verifies the pattern
- small-feature-walkthrough-stage — s3 because its why restates the title, its beats skip the tune alignment and font changes on the same line, and baseline versus center is never justified.
- refactor-one-shot-notes — s2 because its why ends with unverifiable boilerplate about one local instance verifying the pattern and its first beat names no test symbol in code.
- medium-feature-rail-numerals — s8 because its landing names no <code> symbol, repeats the weight substitution abstractly without old to new numbers, and relies on story and voice lenses that were never taught
- sol-feature-wallet-withdraw — s9 because its first beat lands on existing events with no code symbol and never names WalletFundsWithdrawn, so a listener cannot tell what changed on screen
- sol-fix-recovery-api — s-test-18 because one withdrawal assertion is asked to prove a 50-span rename sweep across every quote total with no concrete value shown
