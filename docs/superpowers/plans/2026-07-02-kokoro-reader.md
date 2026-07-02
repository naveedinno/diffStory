# Kokoro Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/Users/naveed/Codes/blockchain/symmio/kokoro-reader`, a simple local Kokoro-only text reader.

**Architecture:** Create a standalone Node and TypeScript project with one local HTTP server, one browser page, one copied Kokoro TTS module, and focused tests. The server owns Kokoro generation and cached audio delivery; the browser owns paste/play/stop UI state.

**Tech Stack:** Node.js 20+, TypeScript, Node built-in `http`, `node --test`, browser `Audio`, local Kokoro Python environment.

---

## File Structure

- Create `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/package.json`: project scripts and dev dependency.
- Create `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/tsconfig.json`: TypeScript build config.
- Create `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/README.md`: run/setup instructions.
- Create `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/src/kokoro-tts.ts`: copied and lightly adapted Kokoro synthesis/cache helpers.
- Create `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/src/page.ts`: HTML, CSS, and browser JavaScript for the reader.
- Create `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/src/server.ts`: local server, API route, static page route, audio route.
- Create `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/src/cli.ts`: command-line entry point.
- Create `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/test/kokoro-tts.test.mjs`: helper tests.
- Create `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/test/server.test.mjs`: server/page/API validation tests.

### Task 1: Scaffold Project

**Files:**
- Create: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/package.json`
- Create: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/tsconfig.json`
- Create: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/README.md`

- [ ] **Step 1: Create package scripts**

```json
{
  "name": "kokoro-reader",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "tsc",
    "dev": "node --experimental-strip-types --no-warnings src/cli.ts",
    "start": "node dist/cli.js",
    "test": "npm run build && node --test test/*.test.mjs"
  },
  "engines": {
    "node": ">=20"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create TypeScript config**

Use `rootDir: "src"`, `outDir: "dist"`, `module: "NodeNext"`, strict mode, and Node types.

- [ ] **Step 3: Write README**

Include:

```bash
npm install
npm run dev
```

Mention Kokoro setup from SmartDiffChecker:

```bash
cd /Users/naveed/Codes/blockchain/symmio/SmartDiffChecker
npm run setup:kokoro
```

### Task 2: Copy Kokoro TTS Core

**Files:**
- Create: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/src/kokoro-tts.ts`
- Test: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/test/kokoro-tts.test.mjs`

- [ ] **Step 1: Copy the proven Kokoro helpers**

Copy the existing SmartDiffChecker helper shape: `KOKORO_MAX_TEXT`, `KOKORO_VOICES`, `normalizeKokoroVoice`, `kokoroRate`, `normalizeKokoroText`, `kokoroTtsCachePath`, `kokoroTtsUrl`, `isKokoroTtsId`, and `synthesizeWithKokoro`.

- [ ] **Step 2: Preserve cache compatibility**

Keep generated files under:

```text
~/.diffstory/tts-cache/kokoro
```

Use route URLs like:

```text
/api/tts/kokoro/<sha256>.wav
```

- [ ] **Step 3: Add helper tests**

Test voice aliases, speed clamp values `0.6`, `1`, `1.5`, deterministic cache URLs, and invalid ID rejection.

### Task 3: Build Server

**Files:**
- Create: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/src/server.ts`
- Create: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/src/cli.ts`
- Test: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/test/server.test.mjs`

- [ ] **Step 1: Serve the page**

`GET /` returns the HTML from `renderPage()`.

- [ ] **Step 2: Generate Kokoro speech**

`POST /api/tts/kokoro` parses JSON and calls:

```ts
synthesizeWithKokoro(homedir(), {
  text: input.text ?? '',
  voice: input.voice,
  rate: input.rate,
});
```

Return:

```json
{ "cached": false, "engine": "kokoro", "rate": 1, "url": "/api/tts/kokoro/<id>.wav", "voice": "af_heart" }
```

- [ ] **Step 3: Serve cached audio**

`GET /api/tts/kokoro/<id>.wav` validates the ID, reads from `kokoroTtsCacheDir(homedir())`, and responds with `Content-Type: audio/wav`.

- [ ] **Step 4: Add API validation tests**

Use an injectable synth function so tests can assert empty text and invalid JSON without running Kokoro.

### Task 4: Build Page UI

**Files:**
- Create: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/src/page.ts`
- Test: `/Users/naveed/Codes/blockchain/symmio/kokoro-reader/test/server.test.mjs`

- [ ] **Step 1: Render the reader screen**

The page contains a textarea, voice cards for the eight Kokoro voices, speed buttons, Play, Stop, and status text.

- [ ] **Step 2: Implement browser playback**

On Play, abort any in-flight request, POST `{ text, voice, rate }`, create `new Audio(data.url)`, and play it.

- [ ] **Step 3: Implement Stop**

Stop aborts fetch generation and pauses/resets active audio.

- [ ] **Step 4: Persist choices**

Persist `kokoro-reader-voice`, `kokoro-reader-rate`, and `kokoro-reader-text` in `localStorage`.

### Task 5: Verify

**Files:**
- No new files.

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install
```

- [ ] **Step 2: Run tests**

Run:

```bash
npm test
```

Expected: all `node --test` tests pass.

- [ ] **Step 3: Start local app**

Run:

```bash
npm run dev -- --no-open
```

Expected: server prints `kokoro-reader ready -> http://localhost:7878/`.

- [ ] **Step 4: Smoke the page**

Run:

```bash
curl -s http://localhost:7878/ | rg "Kokoro Reader|data-reader-app|Play"
```

Expected: page HTML contains the reader app markers.
