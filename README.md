<div align="center">

# 📖 diffStory

### Read AI-written code the way it was meant to be read.

diffStory turns a sprawling, AI-authored change into a **guided tour**. The agent that wrote the
code walks you through it in the order the logic actually flows — you comment right on the lines,
and it fixes things on the spot. No more hunting through thirty alphabetised files.

`MIT` · zero runtime dependencies · 100% local · works with **Claude Code** & **Codex**

</div>

---

## Why

Reviewing a big change an AI wrote is miserable: thirty files in alphabetical order, no idea where
to start, nothing connecting them. diffStory flips it. The AI that wrote the code emits the
**reading order** — start at the entry point, follow the call into the next file, come back — plus
a one-line *why* for every stop. You read the **story** of the change, not a pile of diffs, and
hand your comments straight back to the agent.

## Quick start

See it in ~10 seconds:

```bash
npm install && npm run demo
```

This builds a sample multi-file change and opens the review page so you can click around — walk the
steps, leave a comment, watch the trust check flag a sneaky change.

Then use it for real, in any repo after making changes:

```text
1.  diffstory story                →  your agent writes .diffstory/story.json, then the review opens
2.  Read in order, comment on lines
3.  Ask your agent to address them →  refresh, repeat until clean ✅
```

**Reviewing a teammate's PR?** If they committed their story (`diffstory init` → *share via git*),
just `git checkout <their-branch> && diffstory serve` to replay their guided walkthrough — no agent
needed.

## What you get

- 🧭 **A guided reading order** — walk the change step by step in call-flow order, not by filename.
- 📝 **A "why" for every step** — what to look at, what's subtle, why it's safe.
- ⚖️ **Real side-by-side diffs** — before/after from the actual `git diff`, never reproduced by the AI. Flip to the full file anytime.
- 💬 **Comments that loop back** — drop a change request, question, or nit; the agent replies and fixes; you resolve.
- 🛡️ **A trust check** — any change no step explains gets flagged, so nothing slips in quietly.
- 🗂️ **An all-files view** — a clean, file-by-file overview when you want the bird's-eye.
- 🔒 **Local & dependency-free** — Node built-ins only; nothing installed at runtime, nothing phoned home.

## Install

One command — no `npm -g`, no `sudo`. It clones diffStory to `~/.diffstory` and puts a launcher
on your PATH that runs via `node`. Re-run any time to update:

```sh
curl -fsSL https://raw.githubusercontent.com/naveedinno/diffStory/main/scripts/install.sh | sh
```

<details><summary>Other ways to install</summary>

- **npm (from the repo):** `npm i -g github:naveedinno/diffStory`
- **From source:** `git clone … && cd diffStory && npm install && npm run build && npm link`

</details>

Then add the skills your agent runs (the CLI is agent-agnostic):

**Claude Code**
```text
/plugin marketplace add naveedinno/diffStory
/plugin install diffstory@diffstory
```

**Codex · Cursor · other**
```bash
git clone git@github.com:naveedinno/diffStory.git && cd diffStory
./scripts/install-skills.sh
```

## Commands

| Command | What it does |
| --- | --- |
| `diffstory serve` | Open the guided review page (default command). |
| `diffstory check` | Print coverage; **exits non-zero if a change isn't in the tour** — great for CI. |
| `diffstory init` | Scaffold `.diffstory/` with a starter tour. |
| `diffstory help` | Full usage and flags. |

Flags: `--dir <path>` · `--base <ref>` · `--head <ref>` · `--port <n>` · `--no-open`.

**Choosing what to diff** — just run `diffstory serve` and it **asks** (pick a branch or commit
from a list). Prefer flags? Pass one to skip the prompt: uncommitted only `--base HEAD` · since a
commit/tag `--base v1.2.0` · between two refs `--base main --head feature` · a different repo
`--dir /path/to/repo`.

---

<details>
<summary><b>The tour format</b> — what your agent writes</summary>

<br>

`.diffstory/review-tour.json` is authored by the agent: **order and narrative only, never code.**

```jsonc
{
  "version": 1,
  "title": "Add per-customer spending limit",
  "summary": "Start at the API entry point, follow the limit check across files, then the test.",
  "steps": [
    { "id": "s1", "order": 1, "title": "createOrder() now checks the limit", "file": "src/api.ts",
      "range": [1, 16], "kind": "changed", "why": "Entry point — the new block rejects over-cap orders before placing them.", "calls": ["s2"] },
    { "id": "s2", "order": 2, "title": "checkSpendingLimit()", "file": "src/limits.ts",
      "range": [1, 11], "kind": "new-file", "why": "Reads the customer's spend and compares to the cap.", "returnsTo": "s1" }
  ]
}
```

`kind` is `changed` (show the real hunk), `new-file`, or `context` (unchanged code the reader needs
— like a callee you didn't touch). `calls` / `returnsTo` render the cross-file jumps. Full schema
in [`skills/review-tour/SKILL.md`](skills/review-tour/SKILL.md).

</details>

<details>
<summary><b>How it works under the hood</b></summary>

<br>

You always review the **real `git diff`** — diffStory only *reorders and annotates* it. The agent
supplies order + narrative; the code shown is pulled from git, never reproduced by the AI (which
matters when the thing you're auditing is that same AI's output).

The whole tool is Node built-ins (`http`, `child_process`, `fs`) — nothing to install at runtime,
nothing phoning home. The review page is a single self-contained HTML document; all code is escaped
server-side and the client only ever sets text or injects that server-escaped markup.

</details>

<details>
<summary><b>Rolling it out to a team</b></summary>

<br>

The repo can stay **private** — grant read access to specific people (Settings → Collaborators, or
a GitHub org + team). Everyone then installs from it using their own GitHub auth:

- **CLI:** `npm i -g github:naveedinno/diffStory` (if it errors on auth, use `git+ssh://git@github.com/naveedinno/diffStory.git`).
- **Claude Code:** `/plugin marketplace add naveedinno/diffStory` → `/plugin install diffstory@diffstory`.
- **Codex / others:** `./scripts/install-skills.sh` (installs into `~/.agents/skills/`; `--claude` also targets `~/.claude/skills/`, `--dir PATH` for a custom location).

Each teammate needs the repo shared with them and GitHub auth configured (an SSH key or token) —
the same as cloning any private repo. Add `.diffstory/` to each repo's `.gitignore`.

</details>

<details>
<summary><b>Limitations (v1)</b></summary>

<br>

- **Manual round-trip.** Comments save to disk; you trigger the agent's address step and refresh. Live-watch is planned.
- **Comment drift.** Comments anchor to a line number at comment-time; if code shifts and the tour isn't refreshed, a comment falls back to a note on its step. Resolve a batch, then re-review fresh.
- **Syntax highlighting** is diff-coloring only in v1 (kept self-contained, no CDN).
- Needs a git repo; reviews the working tree against a base.

</details>

## License

[MIT](LICENSE) © naveedinno
