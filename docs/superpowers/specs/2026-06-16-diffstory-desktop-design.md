# diffStory Desktop (Tauri) — Design Spec

**Date:** 2026-06-16
**Status:** Approved design, pending implementation plan

## Goal

Ship diffStory as a standalone macOS desktop app you open cold — a dock icon, not a
browser tab launched from a repo. Opening it shows a **repo picker**; you pick a repo and
either open an existing review or generate a fresh tour on demand. The app is a thin native
skin over the existing diffStory server and agent loop — almost everything is reuse.

## Decisions (locked)

1. **App model: standalone + repo picker.** The app opens without a repo and presents a
   picker (recent reviews + open-a-folder). This differs from today's flow, where the repo
   is the current working directory of `diffstory serve`.
2. **Tour source: open existing, generate on demand.** If a picked repo has a tour, open it.
   If it has no tour — or not the one the user wants — a **Generate** button drives the
   agent to write one (with a base/branch picker), then opens the review.
3. **Runtime: lean on installed Node.** The Tauri shell spawns the user's existing `node`
   to run the diffStory backend. No bundled Node runtime. Rationale: diffStory already
   requires Node ≥20 **and** an installed `claude`/`codex` CLI (the agent CLIs cannot be
   bundled), so for diffStory's audience Node is already a given — bundling it buys little
   and costs the most expensive part of a Tauri build. Keeps the bundle small (~10MB) and
   native.

## Architecture: three layers, built bottom-up

```
┌─ Layer 3: Tauri shell ──────────────┐  native window, spawns Node, folder dialog, .app/.dmg
│  ┌─ Layer 2: Picker UI ───────────┐ │  front-door page: recent repos, open folder, generate
│  │  ┌─ Layer 1: Shell backend ──┐ │ │  repo-agnostic server: session + new endpoints
│  │  │  existing server + agent  │ │ │  (existing review page + agent loop, unchanged core)
└──┴──┴───────────────────────────┴─┴─┘
```

The de-risking property: **Layers 1 + 2 are a complete standalone web app**, fully testable
in a plain browser via `diffstory app`. Layer 3 (Tauri) is the last ~20% — a native skin.

---

## Layer 1 — Backend "shell mode" (repo-agnostic server)

### The change

Today `serve(opts: ServeOptions)` in `src/server.ts` binds one repo: every handler closes
over a fixed `opts` carrying `{ repo, port, baseOverride, headOverride, open }`. For a
standalone app that switches repos at runtime, the server instead holds a small **mutable
session**:

```ts
interface Session { repo: string | null; base?: string; head?: string; }
```

Handlers read repo/base from the session instead of a fixed `opts`. The picker sets the
session via a new endpoint. Single-user / single-window → one session is sufficient and
matches the existing "one agent run at a time" invariant (`agentBusy`).

### New CLI command

`diffstory app` (added to the `main()` dispatch in `src/cli.ts`) boots the server **without
requiring a repo** (no `ensureRepo`, no `chooseDiff`). It accepts `--port` and `--no-open`.
Tauri launches it as `node dist/cli.js app --no-open --port <free>`.

### Endpoints

Each is mostly wiring an existing function to HTTP:

| Method + path | Behavior | Reuses |
|---|---|---|
| `GET /` | `session.repo == null` → render **picker page**; else → existing review | `renderReview` |
| `GET /api/repos/recent` | Recent repos with `{ path, lastOpened, hasTour, title?, dirty }` | new `recents.json`, `loadTour` |
| `POST /api/repo/open` | Body `{ path }`. Validate, set `session.repo`, return repo state, add to recents | `isGitRepo`, `loadTour`, `currentBranch` |
| `POST /api/repo/close` | Clear `session.repo` → back to picker | — |
| `GET /api/refs` | Branches + recent commits for the base picker | `listBranches`, `listRecentCommits`, `currentBranch` |
| `POST /api/generate` | Body `{ base?, head? }`. Stream agent writing a tour (NDJSON), set session base/head, single-flight | `streamAgent`, `storyPrompt`, `availableAgents`, `agentBusy` |

Existing endpoints — `GET /api/fullfile`, `GET/POST /api/comments`,
`PATCH/DELETE /api/comments/:id`, `POST /api/address` — change only in that they read
`session.repo` / `session.base` / `session.head` instead of the fixed `opts`.

### Tour generation reuse

The in-app **Generate** button reuses the exact streaming machinery that already powers
"Address all open." Today `POST /api/address` calls
`streamAgent(agent, repo, addressPrompt(target), onEvent)` and emits NDJSON
(`{type:'text'|'tool'|'error'|'done'}`). Generate is the same call with `storyPrompt(base, head)`
instead of `addressPrompt(...)`, guarded by the same `agentBusy` single-flight. On `done`,
if a story file now exists (`resolveStoryPath(repo)`), the client navigates into the review.

`storyPrompt` and `streamAgent` already exist in `src/agent.ts`; `storyPrompt` is already
used by `cmdStory` (via the blocking `runAgent`). No new agent machinery.

### Recents persistence

A small global JSON file (e.g. `~/.diffstory/recents.json`) — distinct from the per-repo
`.diffstory/` data dir. Holds an ordered list of `{ path, lastOpened }`; the rest
(`hasTour`, `title`, `dirty`) is computed on read so it never goes stale.

---

## Layer 2 — Picker UI (the new front-door page)

A new self-contained HTML view, sibling to the review page, following the same discipline:
**no CDN, all code escaped server-side, client only sets text or injects server-escaped
markup.** Styled to **Apple HIG** per project convention — system fonts, system colors,
materials, native-feeling controls.

### Screens / flow

1. **Picker (root).**
   - **Recent reviews** — cards: repo name, path, last opened, a state chip
     (*has tour* / *no tour* / *dirty*). Click → open.
   - **Open folder…** — native dialog in Tauri (passes the path to `/api/repo/open`); a path
     input fallback in the browser.
2. **Repo detail** (after open). Always offers both paths — this is what *"or not the one I
   want"* means:
   - **Open existing review** (shown when a tour is present).
   - **Generate a tour ▸** — base/branch/commit picker fed by `/api/refs`; agent picker if
     more than one is installed; **Generate** button.
3. **Generating.** Progress streams into the **same agent console shell** already built for
   "Ask agent" / "Address all" (in `src/render.ts`), parsing the same NDJSON. On success →
   the review.

### No-agent / error states

If `availableAgents()` is empty, the Generate panel is disabled with a friendly note
(install `claude` or `codex`) — the `/api/generate` and `/api/address` endpoints already
return a clear error for this case; the UI surfaces it rather than failing silently.

---

## Layer 3 — Tauri shell

- New `src-tauri/` directory (Tauri's standard layout). Rust `setup` hook:
  1. Pick a free port.
  2. Spawn `node <resource>/cli.js app --no-open --port <port>` as a child process.
  3. Poll until the server is listening, then load `http://localhost:<port>` in the webview.
  4. On window close / app quit, kill the child process.
- **diffStory JS rides along as a Tauri resource.** The compiled `dist/` is tiny; bundling
  it as a resource and running it against the user's `node` makes the app self-contained
  except for Node + the agent CLIs (both already required) — and avoids "which installed
  diffStory does it use" ambiguity.
- **Native folder dialog** via the Tauri dialog plugin → POSTs the chosen path to
  `/api/repo/open`.
- Window: title "diffStory", sensible default size, native traffic lights.
- `tauri build` → `.app` / `.dmg`.

### Node-missing guard

On startup, if `node` is not on PATH, show a friendly window ("diffStory needs Node ≥20")
rather than a blank webview.

---

## Cross-cutting concerns

- **Security.** Keep the existing posture: bind `localhost` only; escape server-side. The
  new `POST /api/repo/open` validates the path with `isGitRepo` before storing it; file
  reads remain guarded by the existing `/api/fullfile` allowlist (only files in the diff or
  tour are readable).
- **Single-flight.** `agentBusy` now guards generate *and* address — one agent run at a time,
  app-wide, which is correct since both edit the working tree / write `.diffstory/`.
- **Cross-platform.** Layers 1–2 are platform-neutral (Node + HTML). macOS is the only
  packaging target for v1; Windows/Linux Tauri builds are a later, mechanical add.

## Not in v1 (YAGNI)

- No bundled Node runtime (decided — lean on installed Node).
- No code-signing / notarization. Personal builds run unsigned (right-click → Open).
  Documented as a follow-up; needs an Apple Developer account.
- No auto-update.
- No multi-window / multiple repos open at once (one session).
- No Windows/Linux packaging.
- No reimplementation of base-selection or diff logic — reuse `src/git.ts`.

## Phasing (build + demo order)

1. **Phase 1 — Backend shell mode.** `diffstory app` command, session model, new endpoints
   (recent / open / close / refs / generate), existing endpoints read from session.
   *Demo:* run `diffstory app`, drive the whole flow in a browser via curl/devtools.
2. **Phase 2 — Picker UI.** The front-door page (recent, open folder, repo detail, generate
   panel + base picker), Apple-HIG styled, reusing the agent console shell.
   *Demo:* a fully working standalone **web** app in the browser — no Tauri yet.
3. **Phase 3 — Tauri shell.** Wrap it: spawn Node, native folder dialog, package to
   `.app`/`.dmg`.
   *Demo:* double-click the app.

Each phase is independently demoable. Phases 1–2 deliver the whole product in a browser;
Phase 3 is the native skin.

## Rough effort

Phase 1 ~a day · Phase 2 ~1–2 days (most of the UI work) · Phase 3 ~a day + packaging
fiddliness. ≈ **3–4 focused days to a working unsigned `.app`**, usable as a web app after
Phase 2.

## Open follow-ups (post-v1)

- Code-signing + notarization for distribution without warnings.
- Windows/Linux packaging.
- Auto-update channel.
