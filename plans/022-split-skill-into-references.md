# 022 — Split the skill into a small core and on-demand references (verbatim)

> **For agentic workers:** Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to run this plan task by task.
> Steps use checkbox (`- [ ]`) syntax. Read `plans/README.md` → "Story quality
> campaign → Rules for every executor" before starting.

**Goal:** Cut the always-loaded `SKILL.md` from 1,040 to about 581 lines by
moving reference material verbatim into `references/*.md`, with a one-line
pointer left at each spot. No rule changes. This is the mechanical half of the
restructure; plan 023 changes the rules.

**Why:** A Codex session read the 56 KB skill in three chunks, got
context-compacted, and then wrote a story that fails the app's own validator
with 50 errors (audit finding 2). A small core the agent keeps, plus
references it loads at the step that needs them, survives compaction better.

**Architecture:** A one-shot Python script moves sections by their exact
heading lines. Tests switch from reading `SKILL.md` to reading the whole
skill corpus (core + references), so every pinned phrase keeps passing
wherever it now lives.

**Tech stack:** Python 3 (one-shot script), Node tests.

**Spec:** `docs/research/story-corpus-audit-2026-09.md` (finding 2, decision D8).

## Global constraints

- Verbatim: after the split, the multiset of non-pointer lines across
  `SKILL.md` + `references/*.md` equals the original `SKILL.md` (checked in
  Task 2 Step 3).
- `## Schema` must appear exactly once in the corpus (in `references/schema.md`).
  The schema-example test splits on that string.
- Verified in a scratch copy on 2026-09-25 (after the explicit-only trigger
  fix, `9a88ea0`): the script produced a 581-line core and 7 references, and
  all 68 agent tests passed on the split skill (66 existing + the 2 new guards
  below).
- Do not run the script twice. It refuses if `references/` exists.

## Review focus

- A pointer that sends the agent to the wrong file.
- A section cut mid-way because a heading was renamed since this plan was
  written. The script exits with "expected exactly one line …" instead of
  guessing. If it does, stop and report the heading; do not edit the script's
  heading list to "make it pass".

---

### Task 1: Read the skill as a corpus in tests

**Files:**
- Create: `test/helpers/skill-text.mjs`
- Modify: `test/agent.test.mjs`

**Interfaces:**
- Produces: `skillCore(): string`, `skillCorpus(): string`, `skillReferenceFiles(): string[]`.

- [ ] **Step 1: Create `test/helpers/skill-text.mjs`:**

```js
// The storyteller skill is SKILL.md plus references/*.md. Tests that pin skill
// wording read the whole corpus, so a rule can move between files without a
// test rewrite; tests that pin what must stay in the always-loaded core read
// SKILL.md alone.
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const DIR = new URL('../../skills/diffstory-storyteller/', import.meta.url);

/** SKILL.md only: what every agent loads before anything else. */
export function skillCore() {
  return readFileSync(new URL('SKILL.md', DIR), 'utf8');
}

/** File names under references/, sorted. */
export function skillReferenceFiles() {
  const refs = new URL('references/', DIR);
  return existsSync(refs) ? readdirSync(refs).filter((f) => f.endsWith('.md')).sort() : [];
}

/** SKILL.md followed by every reference file, in sorted order. */
export function skillCorpus() {
  const refs = new URL('references/', DIR);
  return [skillCore(), ...skillReferenceFiles().map((f) => readFileSync(new URL(f, refs), 'utf8'))].join('\n\n');
}
```

- [ ] **Step 2: Switch the tests to the corpus.** In `test/agent.test.mjs`:
  - add `import { skillCore, skillCorpus, skillReferenceFiles } from './helpers/skill-text.mjs';`
    below the `node:fs` import;
  - replace every occurrence of
    `readFileSync(new URL('../skills/diffstory-storyteller/SKILL.md', import.meta.url), 'utf8')`
    with `skillCorpus()` (34 occurrences on 2026-09-25):

```bash
perl -0pi -e "s/readFileSync\(new URL\('\.\.\/skills\/diffstory-storyteller\/SKILL\.md', import\.meta\.url\), 'utf8'\)/skillCorpus()/g" test/agent.test.mjs
grep -c "skillCorpus()" test/agent.test.mjs
grep -n "diffstory-storyteller/SKILL.md" test/agent.test.mjs
```

Expected: the count is 34 or more, and the last grep prints nothing.

(`test/release-readiness.test.mjs` keeps reading `SKILL.md` directly on
purpose: "diffStory is UI-only" must stay in the always-loaded core.)

- [ ] **Step 3: Run** `npm run build && node --test test/agent.test.mjs` —
  expected: PASS (nothing moved yet, so corpus = core).

- [ ] **Step 4: Commit**

```bash
git add test/helpers/skill-text.mjs test/agent.test.mjs
git commit -m "test: read the storyteller skill as core plus references"
```

### Task 2: Run the verbatim split

**Files:**
- Create: `scripts/split-storyteller-skill.py` (committed for provenance; one-shot)
- Modify: `skills/diffstory-storyteller/SKILL.md`
- Create: `skills/diffstory-storyteller/references/{splitting,examples,primers,schema,camera-and-coverage,moves,audits}.md`
- Test: `test/agent.test.mjs`

- [ ] **Step 1: Add the two guard tests** (append to `test/agent.test.mjs`):

```js
test('every storyteller reference file is linked from SKILL.md, and every link resolves', () => {
  const core = skillCore();
  const files = skillReferenceFiles();
  assert.ok(files.length > 0, 'references/ should exist');
  for (const f of files) assert.ok(core.includes(`references/${f}`), `SKILL.md never points at references/${f}`);
  for (const [, f] of core.matchAll(/references\/([a-z0-9-]+\.md)/g)) assert.ok(files.includes(f), `SKILL.md points at missing references/${f}`);
});

test('the always-loaded SKILL.md stays small enough to survive long sessions', () => {
  const lines = skillCore().split('\n').length;
  assert.ok(lines <= 600, `SKILL.md grew to ${lines} lines; move detail into references/`);
});
```

Run `node --test test/agent.test.mjs`. Expected: these two FAIL (no references yet).

- [ ] **Step 2: Create `scripts/split-storyteller-skill.py`** with exactly this
  content, then run it from the repo root:

```python
#!/usr/bin/env python3
"""One-shot, verbatim split of the storyteller SKILL.md into a core + references/.

Moves whole sections by their exact heading lines and leaves a short pointer
where each section was. No rule text is edited. Run once from the repo root:

    python3 scripts/split-storyteller-skill.py

It refuses to run twice (it checks that references/ does not exist yet).
"""
import pathlib
import sys

ROOT = pathlib.Path("skills/diffstory-storyteller")
SKILL = ROOT / "SKILL.md"
REFS = ROOT / "references"

if REFS.exists():
    sys.exit("references/ already exists; the split has already run.")

lines = SKILL.read_text().split("\n")


def at(heading):
    hits = [i for i, line in enumerate(lines) if line == heading]
    if len(hits) != 1:
        sys.exit(f"expected exactly one line {heading!r}, found {len(hits)}")
    return hits[0]


# (start heading, end heading exclusive, destination file, pointer left in core)
MOVES = [
    ("### The splitting test", "## Detail levels", "splitting.md",
     "Split into scoped stories only when the diff passes every test in\n"
     "`references/splitting.md`; read it before writing anything under\n"
     "`.diffstory/stories/`. Any doubt: one story.\n"),
    ("### 3.6. What good looks like: the same diff, told twice", "### 3.75. Test for concept gaps", "examples.md",
     "### 3.6. What good looks like\n\n"
     "Before your first story in a session, read `references/examples.md`: the\n"
     "same small diff told as a changelog and as a story.\n"),
    ("### 3.75. Test for concept gaps", "#### Narrative fields are HTML", "primers.md",
     "### 3.75. Test for concept gaps\n\n"
     "Before each code stop, ask whether the reviewer can already explain the\n"
     "terms, roles, and state the next lines need. When and how to write a concept\n"
     "primer is in `references/primers.md`.\n"),
    ("#### Narrative fields are HTML", "### 4. Plan the reading path", "schema.md",
     "Narrative fields are restricted HTML, not Markdown. The allowed tags for each\n"
     "field are in `references/schema.md`.\n"),
    ("### 5. Storyboard the camera", "### 5.4. Record semantic logic moves", "camera-and-coverage.md",
     "### 5. Storyboard the camera\n\n"
     "Every code step is one steady camera shot. Read\n"
     "`references/camera-and-coverage.md` for the viewport, highlight, `range`, and\n"
     "top-level `ranges` contracts before choosing any line numbers.\n"),
    ("### 5.4. Record semantic logic moves", "### 5.6. Split code narration into read-aloud beats", "moves.md",
     "### 5.4. Record semantic logic moves\n\n"
     "When logic moved, was extracted or inlined, or gained or lost a guard, read\n"
     "`references/moves.md` and record it in the step's `moves`.\n"),
    ("### 6.25. Write concept primers with the exact fileless shape", "### 6.5. Put necessary context in the visible story", "primers.md",
     "### 6.25. Write concept primers with the exact fileless shape\n\n"
     "The exact concept-step shape is in `references/primers.md`.\n"),
    ("## Hard quality gates", "### Coverage ledger", None,
     "## Hard quality gates\n\n"
     "Coverage is necessary, not sufficient. Build the coverage ledger\n"
     "(`references/camera-and-coverage.md`) before writing, and run the truth,\n"
     "narrative, and camera audits (`references/audits.md`) before handing back.\n"),
    ("### Coverage ledger", "### Truth audit", "camera-and-coverage.md", None),
    ("### Truth audit", "## Schema", "audits.md", None),
    ("## Schema", "## Save and verify", "schema.md",
     "## Story file shape\n\n"
     "Immediately before writing JSON, even if you read it earlier in this session,\n"
     "read `references/schema.md`: the exact schema with a valid example, the HTML\n"
     "rules for every field, and the concept-step shape. Long sessions get\n"
     "compacted, and the schema is the first thing lost.\n"),
]

HEADERS = {
    "splitting.md": ("Splitting a change into scoped stories", "Read before writing anything under `.diffstory/stories/`."),
    "examples.md": ("Worked examples", "Read once per session, before your first story."),
    "primers.md": ("Concept primers", "Read when a code stop needs a mental model the reviewer does not have yet."),
    "schema.md": ("Story file schema and narrative markup", "Read immediately before writing or editing story JSON."),
    "camera-and-coverage.md": ("Camera and coverage contracts", "Read before choosing `range`, `ranges`, `viewport`, or `highlights`, and before the final coverage pass."),
    "moves.md": ("Semantic logic moves", "Read when logic moved, was extracted or inlined, or a guard was added or removed."),
    "audits.md": ("Self-review audits", "Run every audit before handing a story back."),
}

spans = []
for start_h, end_h, dest, pointer in MOVES:
    start, end = at(start_h), at(end_h)
    if end <= start:
        sys.exit(f"{start_h!r} must come before {end_h!r}")
    spans.append((start, end, dest, pointer))

bodies = {name: [] for name in HEADERS}
core = []
cursor = 0
for start, end, dest, pointer in sorted(spans):
    if start < cursor:
        sys.exit("overlapping sections")
    core.extend(lines[cursor:start])
    if dest:
        bodies[dest].append("\n".join(lines[start:end]).rstrip() + "\n")
    if pointer:
        core.extend(pointer.rstrip("\n").split("\n"))
        core.append("")
    cursor = end
core.extend(lines[cursor:])

REFS.mkdir()
for name, (title, when) in HEADERS.items():
    text = f"# {title}\n\nPart of the diffstory-storyteller skill. {when}\n\n" + "\n".join(bodies[name])
    (REFS / name).write_text(text.rstrip() + "\n")
SKILL.write_text("\n".join(core).rstrip() + "\n")
print(f"SKILL.md: {len(lines)} -> {len(core)} lines")
for name in HEADERS:
    print(f"references/{name}: {len((REFS / name).read_text().splitlines())} lines")
```

```bash
python3 scripts/split-storyteller-skill.py
```

Expected output (line counts may differ by a few if the skill changed since 2026-09-25):

```
SKILL.md: 1040 -> 581 lines
references/splitting.md: 37 lines
references/examples.md: 42 lines
references/primers.md: 41 lines
references/schema.md: 138 lines
references/camera-and-coverage.md: 147 lines
references/moves.md: 58 lines
references/audits.md: 59 lines
```

- [ ] **Step 3: Prove it was verbatim.** Every original line must still exist
  somewhere in the corpus:

```bash
node --input-type=module -e "
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
const before = execSync('git show HEAD:skills/diffstory-storyteller/SKILL.md', { encoding: 'utf8' }).split('
');
const dir = 'skills/diffstory-storyteller/';
const after = [readFileSync(dir + 'SKILL.md', 'utf8'), ...readdirSync(dir + 'references').map((f) => readFileSync(dir + 'references/' + f, 'utf8'))].join('
').split('
');
const pool = new Map();
for (const l of after) pool.set(l, (pool.get(l) ?? 0) + 1);
const lost = before.filter((l) => { const n = pool.get(l) ?? 0; if (n) { pool.set(l, n - 1); return false; } return l.trim() !== ''; });
console.log(lost.length ? 'LOST LINES:
' + lost.join('
') : 'verbatim: every original line is present');"
grep -c "^## Schema$" skills/diffstory-storyteller/SKILL.md skills/diffstory-storyteller/references/*.md | grep -v ":0"
```

Expected: see the note below for the one listed line, and exactly one file
(`references/schema.md:1`) listed by the grep.

The check will list exactly one line, `Coverage is necessary, not sufficient.`
That is expected: the pointer that replaces the gates intro repeats that
sentence inside a longer line. Any other listed line is a bug.

- [ ] **Step 4: Run** `npm test` — expected: all pass, including the 2 new guards.

- [ ] **Step 5: Install and confirm the shipped folder**

```bash
sh scripts/install-skills.sh --claude
ls ~/.claude/skills/diffstory-storyteller ~/.claude/skills/diffstory-storyteller/references
```

- [ ] **Step 6: Commit**

```bash
git add scripts/split-storyteller-skill.py skills/diffstory-storyteller/SKILL.md skills/diffstory-storyteller/references test/agent.test.mjs
git commit -m "refactor: split the storyteller skill into a core and on-demand references"
```
