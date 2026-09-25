# Story corpus audit and quality campaign spec — 2026-09-25

This is the evidence and the spec behind plans 014–027 (see `plans/README.md`,
"Story quality campaign"). Every plan in that campaign argues from this file.
Read it before executing any of them.

## 1. What was examined

- **66 story files** from 20 repositories under `~/Codes` (every
  `.diffstory/story.json`, `.diffstory/stories/*.json`, and the perps-core3
  iteration backups), plus the 4 `eval/results/chatgpt-ranges` stories.
  2,719 steps, 4,373 beats, 21.8 words per beat on average.
- **The user's own feedback**: 3,141 unique user-typed messages across Claude
  Code, Codex, and T3 transcripts (about 170 about stories), 24 review
  comments sent from diffStory, 8 `comments.json` entries, 7 story backups.
  Claude Code transcripts before 2026-08-02 were purged; June–July feedback
  survives through Codex sessions, commits, and specs.
- **The app's own validators** (`validateTour`, `validateGeneratedTour`) run
  over the whole corpus, plus heuristic prose lints. Scratch scripts:
  `/tmp/story-lint/run.mjs`, `/tmp/story-audit-a/`, `/tmp/story-audit-b/`,
  `/tmp/story-feedback/` (machine-local, not committed).
- **New research** beyond `docs/research/*.md` (sources in section 5).

## 2. The five structural findings

These are why prose-only fixes to the skill have not stuck.

1. **Chat-written stories are never gated.** `finishStoryGeneration`
   (`src/server.ts` ~2610) runs `validateGeneratedTour` only for stories the
   app itself launches. Stories an agent writes from chat — the user's normal
   path — only pass the lenient `validateTour` at load. 17 of 40 v3 stories
   fail the generation validator (229 errors). The newest story
   (`perps-core/.diffstory/story.json`, 2026-09-23) fails with 50 errors:
   `storyArc` is a string, hotspots use `{file, range, note}`, 15 of 16 code
   steps have no `beats`.
2. **The skill does not survive long sessions.** `SKILL.md` is 1,036 lines
   (56 KB). The 2026-09-23 Codex session read it in three chunks, was
   context-compacted, then wrote the story from memory and validated it with
   a homemade script that could not catch schema errors. Agents are told to
   "verify it yourself" with no tool to verify with.
3. **Every prose-craft rule is enforced nowhere.** Landing, thread, chapter
   seams, restating, title rules, template/copied beats, `why` duplicating
   beats, tests-at-the-tail: no code checks any of them, and the eval judge
   does not score landing or voice. Camera/coverage geometry is checked, but
   only at generation time.
4. **Stale installs.** `~/.codex/skills/diffstory-storyteller/SKILL.md` is a
   2026-08-03 copy (1,400 lines, no Landing rule, no `storyArc`). Codex writes
   most perps stories. `scripts/install-skills.sh` never touches `~/.codex`;
   the app's `updateSkills` does, but only when the user clicks update. Both
   the app's `skillStatus` and the eval harness compare only `SKILL.md`, so a
   stale `references/` or `scripts/` file would go unnoticed once they exist.
5. **Standing preferences have no home.** "Only Solidity" was asked for 7
   times; "detailed" about 14 times. Nothing lets the agent remember a
   per-repo scope or default mode, and the skill pushes the other way
   ("do not split tests off", "tests right after behavior").

## 3. Recurring failures in the stories themselves

Ranked by reviewer harm. Counts are across the 66-story corpus unless noted.

| # | Failure | Evidence | Skill rule status |
|---|---|---|---|
| F1 | **Template / copied beats.** One decision split across many steps with the same sentence. | muon-oracle: "Now that the previous boundary is visible, inspect this … decision" ×466 (26% of 1,768 beats). kareem: one beat ×14 over `import` lines. monolith-245: "The highlighted block centers this review beat on …" ×337. 561 copied beats across 5 stories. | Missing. Nothing bans it; no lint catches it. |
| F2 | **Landing missing or bolted on.** Steps open on the change; symbols unnamed. When the user asked "tell me where I am", the agent prepended "Look at lines N through M." to every old beat and appended a restatement: words per beat 15–33 → 45–50 (max 103), `why` became the concatenated beats, chapter seams vanished. | Only 12% of first beats outside the perps repos name any identifier; 18 of 1,109 beats use `<code>`. 134 "Look at lines…" in 3 perps-core3 files. | Landing rule exists (09-13) but never reached Codex; unmeasured; no approved way to point at lines, so "Look at lines" filled the gap. |
| F3 | **Chapter switches unannounced; chapters ping-pong.** | 79 of 116 chapter changes (other repos) not announced at all; 16 more only in the silent `why`. Proof/code chapters alternate 3× in allocated-balance. Formula seams "X is covered; Y" ×36 (23 in one file). | Seam rule new (09-13); conflicts with "test right after behavior" (tests get their own chapter, causing ping-pong). |
| F4 | **Highlights do not prove the beat.** Beats glow `import` lines or 160-line blocks while talking about logic; beats talk about "the second claimed span" that is off screen. | 102 v3 beat highlights > 12 lines; 21 distant jumps; JiraQ hides real code behind `ranges` on all 58 steps. | Geometry rules exist but only gate app-launched generation. "Highlight what the beat names, never an import" is missing. |
| F5 | **Captions instead of consequences; `why` repeats beats.** | 25 of 29 perps stories name a symbol in < 45% of first beats; 14 of 54 stories have exactly one beat per step that repeats `why`. Reviewer comments: "What is this method even for?", "what is this for?" | Why/Failure tests exist; ignored. "Say why this code must exist" is missing. |
| F6 | **Concept gaps.** 37 of 54 current stories have zero primers; 0 context steps in 33 non-perps stories. 8 of 24 review comments were "what is X?" ("what is single CLose?", "what is uncapped amount?"). | | Concept-gap test reads as a prohibition; "context steps stay few" reads as "none". |
| F7 | **Mechanical edits as one step per file / numbered series.** | deployment-folder: 42 steps for a folder rename. evidence-hygiene: "Skim this deletion…" ×13. Titles "… · 1" to "· 14", "(1/5)…(5/5)", "decision 19". | Sweeps are one-pattern-one-file; nothing covers cross-file systematic edits. |
| F8 | **Hotspots that are not doubts; intent that restates the diff.** | ~18 of 60 perps hotspots are deploy chores; ~27 of 53 elsewhere are environment gaps ("physical VoiceOver … not replayed"). ~7 of 26 intents restate the diff ("We wanted … to use OpenZeppelin 5.6.1"). | Hotspot test clear but ignored; no home for verification gaps. The skill's own template "We wanted to enable <actor> to <capability>" invites restatement. The best intents open on the failure. |
| F9 | **Tests and docs pushed to the tail.** | JiraQ's rollup test is step 50, the code it pins is step 10. 9 perps files, 5+ others. | Rule clear; ignored. |
| F10 | **Invalid Mermaid ships.** Unquoted `O(1)` label broke a diagram (08-17). | `validateConceptDiagram` checks header/safety only. | Missing. |

Also: the skill's own schema example puts Markdown backticks inside a concept
`body` (block HTML), so the example teaches the residue it forbids.

Things that already work and must be preserved: no digit value-transitions
(0 hits), no Markdown residue in any v3 story, concept word bands respected,
hotspots ≤ 3, `ranges` sweeps shortened eval stories 110 → 75 steps with 0
coverage loss.

## 4. What the user asked for (verbatim, trimmed)

- Landing: "at each step you should start with ok this is function x that is
  getting called by y in z process and at line 120 as you can see we added h
  … I shouldn't be forced to pause and play a hundred times" (09-13).
- Before/after: "it doesn't clearly tell me how it was before, what you
  changed, moved x to y" (08-19); "the line is moved so you can be smarter and
  just show that it moved" (09-17); "are you using the diff story features
  good enough?" (09-06).
- Depth: "Make the stories way more detailed" (08-16); "I need line by line
  version. Keep it fun and not boring" (09-06); "those concepts steps should be
  really helpfull" (09-13).
- Scope: "Only the solidity files" (08-29, and 6 more times).
- Freshness: "Do I have my detailed story updated?" (09-06, and 6 more times).
- Validity: "diagram is wrong or app has problems?" (08-17); "maybe open diff
  story in browser and check your story yourself" (08-28).
- Triggering: "I don't need diff story" (5 times, 4 of them after 09-13).
- Skill shape: "The skill should be very consice and to the point" (09-13).
- Hygiene: "you should never add stories to git" (06-28).

## 5. Research beyond `docs/research/` (new sources)

Evidence tags: [E] empirical, [X] expert practice.

- **Pascarella et al., CSCW 2018, "Information Needs in Contemporary Code
  Review"** [E]: the most frequent reviewer need is *whether an alternative
  solution would fit better*, then rationale, context, and *necessity*.
  → Answer "why not the obvious alternative?" and "what breaks without this?"
  at the step where the choice is visible.
- **Tao et al., FSE 2012, "How do software engineers understand code
  changes?"** [E]: rationale first, then risk ("does this break anything
  else?") and consistency ("do other places need the same change?").
- **Fregnan et al., FSE 2022, "First come first served"** [E]: bugs in the
  first file were 64% more likely to be found than in the last. → Risk early.
- **Wurzel Gonçalves et al. 2025, "Code Review Comprehension Model"** [E]:
  reviewers compare the change against an *expected* solution they hold in
  mind. → Name the expected shape, then where the real one differs.
- **Margulieux, Catrambone & Guzdial 2016** [E]: purpose labels on line groups
  ("Reject stale quotes") → 44% more tasks completed. → Titles and chapters are
  subgoal labels.
- **Kalyuga et al. 2003, expertise reversal** [E]; **Renkl 2002; Atkinson,
  Renkl & Merrill 2003** [E]: guidance that helps novices costs experts;
  narrate the first instance fully, later ones briefly (fading). → Sweeps
  narrate one exemplar; primers are for real gaps only.
- **Lister et al. 2006 (SOLO)** [E]: experts explain relationally (what the
  code achieves), novices line by line. → Relational beats by default.
- **Leinonen et al., ITiCSE 2023** [E]: LLM explanations follow one fixed
  template; explanations that restate names rate low.
- **Gong et al. 2026 (preprint)** [E]: agent PR text with phantom changes or
  understated scope was accepted 28% vs 80% of the time. → Every claim maps to
  lit lines.
- **Paech et al. 2025, Antislop; Shaib et al. 2025** [E]: LLM phrase frames
  repeat up to 1000× human rates; "templatedness" and "repetition" are
  measurable slop dimensions. → Cap reuse of opening frames.
- **Gopen & Swan 1990** [X]: old information first, new information at the
  end, where stress falls — matters more when spoken.
- **Olson, And-But-Therefore (2015)** [X]: "and, and, and" is a list; "but"
  adds tension; "therefore" resolves. Works per beat and per step.
- **Victor 2012; Evans 2021** [X]: show the data, concrete before abstract,
  realistic examples. → One concrete trace per logic change.
- **Change-type evidence** [X]: Google SRE postmortems (symptom → trigger →
  causes → fix → regression proof); MITRE CVE phrasing (VULNTYPE in COMPONENT
  allows ATTACKER to IMPACT via VECTOR); Go/Gregg benchmarking (before/after
  with the measurement); Beck *Tidy First?* (structure vs behavior, one hat at
  a time); SWE-at-Google ch. 22 and Parallel Change (expand/migrate/contract,
  compatibility class, rollback).
- **LLM-judge research** [E]: Zheng et al. 2023 (verbosity/position bias →
  swap pairwise order, penalize length); Prometheus, Kim et al. 2024 (per-level
  anchors plus a reference answer reach r≈.9 with humans); CodeRPE, Wu et al.
  2024 (judges miss hallucinations → check claims against the diff
  separately).

## 6. Decisions this campaign makes (defaults — the user can override)

- **D1 — Bundled checker.** Ship `skills/diffstory-storyteller/scripts/check-story.mjs`,
  a self-contained Node script built from the app's own validators. It is not a
  `diffstory` CLI: nothing is installed on PATH, there is no `bin`, and the
  "diffStory is UI-only" rule stays. Agents run it with
  `node <skill-dir>/scripts/check-story.mjs`.
- **D2 — Line pointers.** A beat may say "at line 120" (or "down at line
  120") at most once per step, only after the landing, and only when the glow
  alone is ambiguous. Never open a beat with a line number; never "Look at
  lines X through Y". The ban on line-number *narration* stays.
- **D3 — Moves are expected, not rationed.** Record `moved` / `extracted` /
  `inlined` whenever logic changed home (cross-file, or more than ~40 lines
  apart in one file). The restraint filter stays for `hidden` callouts only.
- **D4 — Standing preferences.** `.diffstory/preferences.json` (local, never
  committed) holds `defaultMode`, `includeGlobs`, `excludeGlobs`, `notes`.
  The skill reads it first and offers to save a preference the user states
  twice.
- **D5 — Verification is a field, not a hotspot.** New optional top-level
  `verification` list (what ran, result). Hotspots are first-person doubts
  about the code only.
- **D6 — Explicit-only trigger (user decision, 2026-09-25; landed in `9a88ea0`).**
  The skill runs only when the user explicitly asks for a story, or when a
  prompt names the skill (the app's generation and repair prompts do). Agents
  never write or offer one on their own initiative.
- **D7 — Intent opens on the problem.** Replace "We wanted to enable <actor>
  to <capability>" with problem → stakes → fix.
- **D8 — Skill shape.** Core `SKILL.md` at most ~300 lines; details live in
  `references/*.md`, loaded at the step that needs them. The core tells the
  agent to re-read `references/schema.md` immediately before writing JSON,
  because compaction drops it.

## 7. Success criteria for the campaign

Measured with the eval harness after plans 018–020 land (baseline) and again
after 023–025 (after):

1. All eval cases (4 existing + 2 Solidity) generate; 0 `validateGeneratedTour`
   errors; ≥ 90% changed ranges covered (unchanged from `eval/GOAL.md`).
2. Checker lint: 0 `copied-beat` errors; `formulaic-opener` warnings ≤ 1 per
   story; `landing-missing-symbol` warnings ≤ 10% of code steps.
3. Judge v2 mean ≥ 4.0 per case with `landing` and `listenability` ≥ 4 on
   every case; blind pairwise judges prefer "after" over "baseline" in ≥ 4 of
   6 cases.
4. Real-world: the next 5 stories written in the user's repos pass the checker
   with 0 errors (tracked with `scripts/story-corpus-report.mjs`).
