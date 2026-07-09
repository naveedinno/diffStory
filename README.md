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
diffstory                          →  opens the app in your browser
```

Everything happens in the page:

```text
1.  Pick a saved story, or "New diff scope" to read the change with no story at all
2.  From the diff, generate a guided story with your agent (claude/codex) — optional
3.  Read in order, select text, right-click to comment
4.  Hit "Ask agent"                →  it answers and fixes inline, live ✅
```

**Reviewing a teammate's PR?** If they committed their story file (`.diffstory/story.json`),
just `git checkout <their-branch> && diffstory` to replay their guided walkthrough — no agent
needed.

## Run from a fresh clone

Use this path when you have cloned this repository and want to run the web app from source.

```bash
git clone https://github.com/naveedinno/diffstory.git
cd diffstory
npm install
npm run dev -- --dir /path/to/the/repo-you-want-to-review
```

That starts the local web app and opens `http://localhost:7777/`. If the browser does not open
automatically, run:

```bash
npm run dev -- --dir /path/to/the/repo-you-want-to-review --no-open
```

Then open `http://localhost:7777/` yourself. You can omit `--dir` if you start diffStory inside the
git repo you want to review; otherwise the app opens a repo picker.

Useful clone-time commands:

| Command | Use it for |
| --- | --- |
| `npm run demo` | Build and open the sample review. Fastest way to see the UI. |
| `npm run dev -- --dir /path/to/repo` | Run the web app from TypeScript source while developing diffStory. Restart after source edits. |
| `npm run build` | Compile `src/` into `dist/`. |
| `npm run start -- --dir /path/to/repo` | Run the built CLI from `dist/cli.js`. |
| `npm test` | Build and run the test suite. |
| `npm link` | Optional: after `npm run build`, make `diffstory` available globally from this clone. |

Prerequisites: Node.js 20+, git, and a git repository to review. To generate stories or send
comments back to an agent, install either the `claude` or `codex` CLI on your PATH and install the
diffStory skills:

```bash
./scripts/install-skills.sh
```

Claude Code users can also install the plugin instead:

```text
/plugin marketplace add naveedinno/diffStory
/plugin install diffstory@diffstory
```

## Working with the app

Once the page is open:

```text
1.  Pick a repo, or let --dir open one directly
2.  Choose the diff scope: uncommitted changes, current branch, one commit, or any two refs
3.  Read the raw diff in "All files", or use "Story" → "Generate story" to have claude/codex write .diffstory/story.json
4.  Tune the story before generating: Brief/Balanced/Line-by-line, selected files, and reviewer guidance
5.  Select exact text in the diff, add a comment, then either save it locally or send it to the agent
6.  Use "Send all" / "Address all open" when you want the agent to answer and patch the repo
```

diffStory stores its review files inside the repo being reviewed:

```text
.diffstory/story.json      guided reading order, safe to commit when you want teammates to replay it
.diffstory/comments.json   your local review threads and agent handoff state
```

Add `.diffstory/` to the reviewed repo's `.gitignore` when stories should stay local.

## What you get

- 🧭 **A guided reading order** — walk the change step by step in call-flow order, not by filename.
- 📝 **A "why" for every step** — what to look at, what's subtle, why it's safe.
- ⚖️ **A plain diff viewer, no story required** — open any repo and read the real `git diff` straight away, file by file. Flip each file between **Unified**, **Split** (side-by-side), and **Full file** views, click a `⋯` gap to reveal 20 more lines of context (or all of it), and tick files off as **viewed** (`v`) with a progress count in the sidebar. Generate a guided story from it only if you want one.
- 🧠 **Real side-by-side diffs in the story** — before/after from the actual `git diff`, never reproduced by the AI.
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

Then add the skills your agent runs (diffStory is agent-agnostic):

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

## Running it

There's one command — `diffstory` — and it just opens the app in your browser. In a git repo it
opens that repo; anywhere else you pick one in the page. Everything else happens in the browser.

| Flag | What it does |
| --- | --- |
| `--dir <path>` | Open a specific repo instead of the current directory. |
| `--port <n>` | Server port. |
| `--no-open` | Don't open the browser automatically. |
| `diffstory --help` | Full usage. |

**Choosing what to diff** happens in the page: a scope switcher picks uncommitted changes, the
current branch, a single commit, or compares any two refs — and the diff re-renders instantly. No
flags to memorise.

---

<details>
<summary><b>The story format</b> — what your agent writes</summary>

<br>

`.diffstory/story.json` is authored by the agent: **order and narrative only, never code.**
Generation has two story modes: **Guided review** keeps the current concise walkthrough, while
**Detailed audit** writes a longer correctness-review story that walks important code paths and
ranges line by line. Each step can declare a `viewport` for what the reviewer should see and
`highlights` for the exact lines the narration is talking about. New stories should also include
`beats`: short read-aloud notes, each with its own highlights, so the voice and glowing code move
together instead of one long speech drifting across several code blocks.

New stories open with an `intent` block — the goal the change serves, the designed
flow, and the `sources` the why was recovered from (commits, PR body, the
conversation, or `code-derived` when no evidence exists). diffStory renders it as
the "why this change" lede on the overview panel.

```jsonc
{
  "version": 1,
  "mode": "guided",
  "title": "Add per-customer spending limit",
  "summary": "Read createOrder() first, then the helper it delegates to; slow down on the boundary check.",
  "intent": {
    "goal": "We wanted users to get a clear rejection before an over-cap order reaches placement.",
    "design": "createOrder() stops the request first, then hands the limit math to one shared helper.",
    "sources": ["conversation"]
  },
  "steps": [
    { "id": "s1", "order": 1, "title": "createOrder() now checks the limit", "file": "src/api.ts",
      "range": [4, 7], "viewport": [1, 16], "highlights": [[4, 7]],
      "kind": "changed", "why": "createOrder() now rejects over-cap orders before placement and delegates the cap math.",
      "beats": [
        { "text": "Start here: this is the flow users hit when they place an order.", "highlights": [[1, 4]] },
        { "text": "I put the guard before placement so rejected orders stop at the door.", "highlights": [[4, 7]] },
        { "text": "Then I pass the cap check to the helper in the next step.", "highlights": [[7, 7]] }
      ], "calls": ["s2"] },
    { "id": "s2", "order": 2, "title": "checkSpendingLimit()", "file": "src/limits.ts",
      "range": [1, 11], "viewport": [1, 11], "highlights": [[4, 8]], "kind": "new-file", "why": "checkSpendingLimit() owns the boundary rule for the entry point.",
      "beats": [
        { "text": "Pause here: this helper owns the boundary rule.", "highlights": [[1, 4]] },
        { "text": "The cap math stays here so createOrder() can stay focused on flow control.", "highlights": [[4, 8]] }
      ], "returnsTo": "s1" }
  ]
}
```

`kind` is `changed` (show the real hunk), `new-file`, or `context` (unchanged code the reader needs
— like a callee you didn't touch). `viewport` is the post-change line window the reviewer should
see; `highlights` is one or more post-change line ranges inside that viewport that should glow
while the narration talks about them. `beats` splits a step into separate short speeches, each
with its own highlights, which keeps read-aloud aligned with the code. `range` remains the changed-line coverage anchor the
in-page trust check uses to flag any change no step explains. For a whole-file deletion, `[0, 0]`
is the synthetic `range` / `viewport` / `highlights` anchor because there are no post-change lines.
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
