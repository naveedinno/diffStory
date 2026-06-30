<div align="center">

# 📖 diffStory

### Read AI-written code the way it was meant to be read.

diffStory turns a sprawling, AI-authored change into a **guided story**. The agent that wrote the
code walks you through it in the order the logic actually flows — you select the exact text you
care about, right-click, and it fixes things on the spot. No more hunting through thirty
alphabetised files.

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
2.  Read in order, select text, right-click to comment
3.  Hit "Ask agent" on the page    →  it answers and fixes inline, live ✅
```

**Reviewing a teammate's PR?** If they committed their story (`diffstory init` → *share via git*),
just `git checkout <their-branch> && diffstory serve` to replay their guided walkthrough — no agent
needed.

## What you get

- 🧭 **A guided reading order** — walk the change step by step in call-flow order, not by filename.
- 📝 **A "why" for every step** — what to look at, what's subtle, why it's safe.
- ⚖️ **Real side-by-side diffs** — before/after from the actual `git diff`, never reproduced by the AI. Flip to the full file anytime.
- 💬 **Comments that loop back, live** — drop a change request, question, or nit, then hit **Ask agent** (or **Address all open**) and watch the agent reply and fix right on the page; you resolve.
- 🛡️ **A trust check** — any change no step explains gets flagged, so nothing slips in quietly.
- 🗂️ **An all-files view** — a clean, file-by-file overview when you want the bird's-eye.
- 🔒 **Local & dependency-free** — Node built-ins only; nothing installed at runtime, nothing phoned home.

### Optional local neural voice

The read-aloud popup can use Kokoro for better local speech. Run the setup script once:

```bash
npm run setup:kokoro
```

It installs `espeak-ng`, creates `~/.diffstory/kokoro-venv` with Python 3.12, and installs
`kokoro` + `soundfile` there. diffStory auto-detects that venv; then choose **Kokoro AI** in
the voice settings and press **Preview**.

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
| `diffstory check` | Print coverage; **exits non-zero if a change isn't in the story** — great for CI. |
| `diffstory init` | Scaffold `.diffstory/` with a starter story. |
| `diffstory help` | Full usage and flags. |

Flags: `--dir <path>` · `--base <ref>` · `--head <ref>` · `--port <n>` · `--no-open`.

**Choosing what to diff** — just run `diffstory serve` and it **asks** (pick a branch or commit
from a list). Prefer flags? Pass one to skip the prompt: uncommitted only `--base HEAD` · since a
commit/tag `--base v1.2.0` · between two refs `--base main --head feature` · a different repo
`--dir /path/to/repo`.

---

<details>
<summary><b>The story format</b> — what your agent writes</summary>

<br>

`.diffstory/story.json` is authored by the agent: **order and narrative only, never code.**
Generation has two story modes: **Guided review** keeps the current concise walkthrough, while
**Detailed audit** writes a longer correctness-review story that walks important code paths and
ranges line by line. Each step can declare a `viewport` for what the reviewer should see and
`highlights` for the exact lines the narration is talking about.

```jsonc
{
  "version": 1,
  "mode": "guided",
  "title": "Add per-customer spending limit",
  "summary": "We wanted users to get a clear rejection before an over-cap order reaches placement. I designed the flow so createOrder() stops the request first, then hands the limit math to one helper; read that path, then the proof.",
  "steps": [
    { "id": "s1", "order": 1, "title": "createOrder() now checks the limit", "file": "src/api.ts",
      "range": [4, 7], "viewport": [1, 16], "highlights": [[4, 7]],
      "kind": "changed", "why": "Start here: this is the flow users hit when they place an order. I first put the guard before placement so rejected orders stop at the door, then I pass the cap check to the helper in the next step.", "calls": ["s2"] },
    { "id": "s2", "order": 2, "title": "checkSpendingLimit()", "file": "src/limits.ts",
      "range": [1, 11], "viewport": [1, 11], "highlights": [[4, 8]], "kind": "new-file", "why": "Pause here: this is the helper that owns the boundary rule. I wired the cap math here so createOrder() can stay focused on flow control while this function answers the one limit question.", "returnsTo": "s1" }
  ]
}
```

`kind` is `changed` (show the real hunk), `new-file`, or `context` (unchanged code the reader needs
— like a callee you didn't touch). `viewport` is the post-change line window the reviewer should
see; `highlights` is one or more post-change line ranges inside that viewport that should glow
while the narration talks about them. `range` remains the changed-line coverage anchor for
`diffstory check`.
`calls` / `returnsTo` render the cross-file jumps. Full schema in
[`skills/review-tour/SKILL.md`](skills/review-tour/SKILL.md).

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

- **Reload after code edits.** Replies stream into the page live and patch inline; when the agent also edits code, the diff and story are server-rendered, so a one-click "Reload to see the new diff" refreshes them.
- **Comment drift.** Comments anchor to selected text plus its current file/range; if code shifts and the story isn't refreshed, the saved range can get stale. Resolve a batch, then re-review fresh.
- **Syntax highlighting** is diff-coloring only in v1 (kept self-contained, no CDN).
- Needs a git repo; reviews the working tree against a base.

</details>

## License

[MIT](LICENSE) © naveedinno
