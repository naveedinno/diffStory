# Story eval harness

Makes storyteller prompt/skill changes measurable. Four frozen `base..head`
ranges from this repo's own history (immutable, so every run sees identical
diffs) are turned into stories by the real production prompt, then scored two
ways:

- **Mechanical** (free, objective): the app's own validators
  (`validateTour`, `validateGeneratedTour`) and the coverage gate — validation
  errors, uncovered hunks, step/viewport stats, hotspot and non-goal counts.
- **LLM judge**: a rubric distilled from the skill's audits — narrative order,
  thread continuity, question falsifiability, beat pointing, intent grounding,
  hotspot honesty. Scored 1–5 with one-line rationale per dimension.

## Running

```bash
npm run build
node scripts/eval-stories.mjs all --label baseline          # full run, 4 cases
node scripts/eval-stories.mjs all --label exp-new-skill     # after a skill edit
node scripts/eval-stories.mjs generate --case bugfix-review-ui --label quick
node scripts/eval-stories.mjs judge --label quick           # re-judge without regenerating
```

Flags: `--label <name>` (result folder, default `baseline`), `--model <m>`
(generator, default `sonnet`), `--judge-model <m>` (default `sonnet`),
`--case <id>` (repeatable).

Requires the `claude` CLI on PATH and the diffstory-storyteller skill installed
(`scripts/install-skills.sh`). Generation briefly writes `.diffstory/story.json`;
any existing story is backed up and restored.

## Reading results

`eval/results/<label>/report.md` holds the score table and per-case rationale;
each case folder keeps the exact `prompt.txt`, `story.json`, and raw logs.
Compare labels before/after a prompt or skill change — a change is real when
the mean moves consistently across cases, not when one case wiggles. The judge
is calibrated to be stingy: 3 is adequate, 5 is rare. Judge scores drift with
judge model choice, so compare runs that used the same `--judge-model`.

## Adding a case

Append to `cases.json` with an immutable ref pair (a merged commit, `X^..X`),
a mode, and the standard `excludePaths`. Prefer diverse change shapes: bugfix,
small feature, deletion-heavy refactor, multi-file feature.
