# diffStory

[![CI](https://github.com/naveedinno/diffStory/actions/workflows/ci.yml/badge.svg)](https://github.com/naveedinno/diffStory/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@naveedinno/diffstory.svg)](https://www.npmjs.com/package/@naveedinno/diffstory)
[![license: PolyForm Noncommercial](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue.svg)](LICENSE)

Read a code change in the order it actually makes sense.

![diffStory guided review screen](assets/demo/diffstory-review.png)

diffStory is a local browser app for reviewing git diffs. You run one command,
pick a repo, choose what changed, and review the real diff with an optional
AI-written walkthrough. When something needs work, select the exact text, add a
comment, and send it back to your agent.

- Runs locally on your machine.
- Opens as a browser app, not a terminal review flow.
- Works with plain git diffs, even without generating a story.
- Can use Claude or Codex to generate walkthroughs and address comments.
- Works without AI. Agent features are optional.

## Quickstart

Requirements:

- Node.js 20 or newer
- git
- a local git repository you want to review

No Python is required for the core app.

Install diffStory once from npm:

```sh
npm i -g @naveedinno/diffstory
diffstory
```

That opens the local browser app.

If you prefer the no-global-npm installer:

```sh
curl -fsSL https://raw.githubusercontent.com/naveedinno/diffStory/main/scripts/install.sh | sh
diffstory
```

Optional: install Claude or Codex on your PATH if you want generated stories or
agent-handled review comments.

## Demo

Try a realistic throwaway review without touching your own repos:

```sh
git clone https://github.com/naveedinno/diffStory.git
cd diffStory
npm install
npm run demo
```

The demo creates a temporary git repo with a saved story, changed files, and a
couple of comments so you can see the full review loop.

![diffStory saved stories screen](assets/demo/diffstory-story-picker.png)

## First Review

1. Make changes in any local git repo.
2. Run `diffstory`.
3. In the browser, pick a repo from **Choose your workspace**.
4. Choose what you want to review: uncommitted changes, the current branch, one
   commit, or any two refs.
5. Read the diff in **All files**, or open **Story** and generate a guided
   walkthrough.
6. Select exact text in the diff, right-click, and add a comment.
7. Use **Ask agent** or **Send all** when you want Claude or Codex to answer and
   patch the repo.

You can use diffStory as a clean diff viewer without an agent. The AI parts are
only needed when you want generated stories or agent-handled comments.

## What You See

The first screen is your project list.

- Recent repositories appear automatically after you open them once.
- **Add repo** and **Browse folders** let you pick another local git repo.
- You can also paste a repository path and press **Open**.
- Missing or non-git folders are marked so you can remove them from recents.

Inside a repo, diffStory gives you two useful ways to read:

- **All files** shows the real git diff file by file.
- **Story** can generate a short reading path so you review the change in the
  order the logic flows, not alphabetically by filename.

The story never replaces the diff. It only explains and orders it. The code you
read comes from git.

## Agent Setup

The installer copies the bundled diffStory skills into the common agent skills
location. If the app says skills are missing or stale, use the **Update skills**
button in the browser.

Claude Code users can also install the plugin:

```text
/plugin marketplace add naveedinno/diffStory
/plugin install diffstory@diffstory
```

For Codex, Cursor, and other agents that read local skills, you can also install
the skills from a clone:

```sh
git clone git@github.com:naveedinno/diffStory.git
cd diffStory
./scripts/install-skills.sh
```

If no agent is installed, diffStory still opens and still works as a local diff
viewer. Story generation and comment handoff will be unavailable until Claude or
Codex is on your PATH.

## Review Files

diffStory stores review state inside the repo you open:

```text
.diffstory/story.json      generated reading order
.diffstory/comments.json   local review comments and agent replies
.diffstory/stories/        optional saved named stories
```

By default, keep `.diffstory/` local and add it to `.gitignore`.

If your team intentionally wants replayable walkthroughs, share a story file as
part of your review process and make that convention explicit. Comments are
normally local reviewer state.

## Team Use

If diffStory is in a private repository, each teammate needs normal GitHub access
first, the same as cloning the repo. For the public package, install with:

```sh
npm i -g @naveedinno/diffstory
```

A teammate can replay a walkthrough when they have:

1. the same branch or commit range checked out
2. access to the story file your team chose to share
3. diffStory installed locally

Then they run:

```sh
diffstory
```

They pick the repo in the browser and open the saved story. No agent is needed
just to read an existing walkthrough.

## From Source

Use this when you are developing diffStory itself:

```sh
git clone https://github.com/naveedinno/diffStory.git
cd diffStory
npm install
npm run dev
```

The app opens at `http://localhost:7777/`. If the browser does not open
automatically, open the printed URL yourself.

That is the whole core setup. You do not need Python, Homebrew, Kokoro, Claude,
or Codex just to open the app and review diffs.

Useful development commands:

| Command | Use |
| --- | --- |
| `npm run dev` | Build the current TypeScript source and run the app. |
| `npm run build` | Compile `src/` into `dist/`. |
| `npm run start` | Run the built app. |
| `npm run demo` | Build and open a sample review. |
| `npm test` | Build and run the test suite. |
| `npm run setup:kokoro` | Install optional local Kokoro speech support. |

## Optional Local Voice

Kokoro AI voice is optional. The read-aloud popup works with browser voices by
default, and you only need this setup if you want local generated speech:

```sh
npm run setup:kokoro
```

The setup script reuses a compatible Python if you already have one, creates
`~/.diffstory/kokoro-venv`, installs `kokoro` and `soundfile`, and installs
`espeak-ng` through Homebrew on macOS when needed. Kokoro currently supports
Python 3.10, 3.11, or 3.12. After setup, choose **Kokoro AI** in the voice
settings.

## Troubleshooting

**`diffstory` is not found**

Open a new terminal, or make sure `~/.local/bin` is on your PATH. The installer
prints the launcher path it created.

**The browser did not open**

Use the printed local URL, usually `http://localhost:7777/`.

**A repo is not accepted**

The folder must be a git repository. Open the folder that contains `.git`, or
paste that path into the project picker.

**Story generation says skills are missing or stale**

Click **Update skills** in the app, or rerun:

```sh
./scripts/install-skills.sh
```

from a diffStory clone.

**No Claude or Codex is found**

Install one of them and make sure its command is available on your PATH. You can
still read diffs without an agent.

## How It Works

diffStory starts a small local Node server and opens a browser page. The server
reads your local git repository, renders the diff, stores review state in
`.diffstory/`, and can ask Claude or Codex to generate or address review work.

The app uses Node built-ins for its runtime server. It does not need a hosted
service, database, browser extension, or cloud account.

For the story schema and agent contract, see
[`skills/review-tour/SKILL.md`](skills/review-tour/SKILL.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, checks, and contribution
notes. The short version:

```sh
npm run check
```

Release maintainers should also read [docs/RELEASE.md](docs/RELEASE.md).

## License

diffStory is source-available under the
[PolyForm Noncommercial License 1.0.0](LICENSE).

Personal, hobby, research, testing, and other noncommercial use is allowed.
Commercial use requires a separate commercial license from naveedinno
<naveedinno@proton.me>. That includes embedding diffStory or a modified
version in a paid product, proprietary app, hosted service, client project,
internal company tool, or commercial workflow.

This is not an OSI open-source license because commercial use is reserved.
