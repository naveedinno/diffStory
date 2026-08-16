// The review page, after the React rewrite.
//
// This replaces `render-page.test.mjs` (3,363 lines), `render-accessibility.test.mjs`
// and `comments-render.test.mjs`, all of which asserted on the ~300 KB HTML
// string `renderPage()` used to build. That function is gone: the route emits a
// shell plus a JSON payload, the document is `client/surfaces/review/`, and the
// interaction engine is `client/surfaces/review/engine/review-engine.js` — a
// MOVE of the old `PAGE_JS`/`DIFF_JS` template strings, not a rewrite.
//
// Four layers, matching test/picker.test.mjs and test/change-page.test.mjs:
//
//   1. THE ROUTE    — a real server, real requests. What do /review and /diff
//                     serve, and does a broken story still fall through to the
//                     scope picker with an explanation?
//   2. THE PAYLOAD  — the whole initial state, and specifically that it is
//                     METADATA-FIRST: a 300-step story must not ship 300
//                     rendered diffs.
//   3. THE SOURCE   — the behaviours `docs/superpowers/specs/review-page-inventory.md`
//                     ranks as at-risk, asserted against the code that
//                     implements them.
//   4. THE BUNDLE   — those strings and endpoints survive the build, so layer 3
//                     is guarding code that actually ships.
//
// Layers 3 and 4 cannot prove the DOM behaves. That was verified by driving the
// real page in Chrome — step navigation, the filmstrip, unified↔split, lazy
// panel loads, context expansion, full file, comment create/edit/delete,
// Cmd-click to VS Code, all twenty keyboard bindings, reading-position
// persistence across reload, and the theme toggle — with a clean console. See
// the report accompanying this rewrite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { serve } from "../dist/server.js";
import {
  renderFullFile,
  renderStoryStepPanel,
  renderFilePanelContent,
} from "../dist/render.js";
import { buildReviewModel } from "../dist/view-model.js";

const CLIENT = new URL("../client/", import.meta.url);
const readRaw = (relative) => readFileSync(new URL(relative, CLIENT), "utf8");

// Source assertions must read code, not prose: a comment explaining why some
// API is forbidden would otherwise trip the very guard that forbids it.
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
const read = (relative) => stripComments(readRaw(relative));

const engine = read("surfaces/review/engine/review-engine.js");
const engineRaw = readRaw("surfaces/review/engine/review-engine.js");
const reviewApp = read("surfaces/review/ReviewApp.tsx");
const sidebar = read("surfaces/review/Sidebar.tsx");
const storyView = read("surfaces/review/StoryView.tsx");
const reviewViewSrc = read("surfaces/review/ReviewView.tsx");
const progressHost = read("surfaces/review/engine/progress-host.tsx");
const entry = read("entry/review.tsx");
// The server still emits diff rows and their containers; React only renders the
// stubs they land in. Guards about container markup must read this, not the TSX.
const renderSrc = readFileSync(
  new URL("../src/render.ts", import.meta.url),
  "utf8",
);
const markup = [reviewApp, sidebar, storyView, reviewViewSrc].join("\n");

const PAYLOAD_BLOCK =
  /<script type="application\/json" id="__DIFFSTORY_DATA__">([\s\S]*?)<\/script>/;
const shellPayload = (html) => JSON.parse(html.match(PAYLOAD_BLOCK)[1]);

/**
 * A repository with a real multi-file diff and a real multi-step story.
 *
 * Two changed files plus a concept primer, so the rail, the filmstrip, the file
 * tree and the speech cache all have more than one of everything to get wrong.
 */
function fixtureRepo({ story = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "diffstory-review-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "src", "order.ts"),
    "export function place() {\n  return 1;\n}\n",
  );
  writeFileSync(
    join(dir, "src", "settle.ts"),
    "export function settle() {\n  return 0;\n}\n",
  );
  git("add", ".");
  git("commit", "-qm", "base");
  writeFileSync(
    join(dir, "src", "order.ts"),
    "export function place() {\n  return 2;\n}\n",
  );
  writeFileSync(
    join(dir, "src", "settle.ts"),
    "export function settle() {\n  return 7;\n}\n",
  );

  if (story) {
    mkdirSync(join(dir, ".diffstory"), { recursive: true });
    writeFileSync(
      join(dir, ".diffstory", "story.json"),
      JSON.stringify({
        // Concept primers require story version 2 or 3.
        version: 3,
        title: "Settle before placing",
        summary: "Two helpers change together.",
        base: "HEAD",
        steps: [
          {
            id: "primer",
            order: 1,
            kind: "concept",
            title: "How settlement works",
            body: "Settlement runs before placement, so the placement step can trust the netted figure it receives.",
            preparesFor: ["s1"],
          },
          {
            id: "s1",
            order: 2,
            title: "Place returns two",
            file: "src/order.ts",
            range: [1, 3],
            kind: "changed",
            why: "The caller needs the new value so settlement can net it out.",
            beats: [
              {
                text: "The return value moves from one to two.",
                highlights: [[2, 2]],
              },
              {
                text: "Nothing else in this function changes.",
                highlights: [[1, 1]],
              },
            ],
          },
          {
            id: "s2",
            order: 3,
            title: "Settle returns seven",
            file: "src/settle.ts",
            range: [2, 2],
            kind: "changed",
            why: "Settlement now reports a real figure instead of a placeholder.",
          },
        ],
      }),
    );
  }
  return dir;
}

async function boot(repo) {
  const server = serve({ repo, port: 0, open: false });
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base, route: `/repo/${encodeURIComponent(basename(repo))}` };
}

// ---------------------------------------------------------------------------
// 1. the route
// ---------------------------------------------------------------------------

test("both review entry points serve the same shell", async () => {
  const repo = fixtureRepo();
  const { server, base, route } = await boot(repo);
  try {
    for (const [path, storyless, title] of [
      [`${route}/review?story=story.json`, false, "Settle before placing"],
      [`${route}/diff`, true, "Reviewing the diff"],
    ]) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(
        html,
        /data-surface="review"/,
        `${path} is the review surface`,
      );
      assert.match(
        html,
        /<script type="module" blocking="render" data-ds-entry src="\/assets\/client\/review\.js"><\/script>/,
      );
      assert.match(html, new RegExp(`<title>diffStory — ${title}`));
      // Painted during boot so the dot field is there before React commits.
      assert.match(html, /<body class="ds-map-bg/);
      const payload = shellPayload(html);
      assert.equal(payload.storyless, storyless);
      assert.ok(payload.pageToken, "every lazy request needs the lease token");
    }
  } finally {
    server.close();
  }
});

test("a broken story still falls through to the scope picker with an explanation", async () => {
  const repo = fixtureRepo({ story: false });
  mkdirSync(join(repo, ".diffstory"), { recursive: true });
  writeFileSync(join(repo, ".diffstory", "story.json"), '{"bogus":true}');
  const { server, base, route } = await boot(repo);
  try {
    const html = await (
      await fetch(`${base}${route}/review?story=story.json`)
    ).text();
    // The review page's error surface is the change page, and the notice is the
    // only explanation the reviewer ever gets for landing there.
    assert.match(html, /data-surface="change"/);
    assert.ok(shellPayload(html).notice);
  } finally {
    server.close();
  }
});

test("the shell carries exactly two inline scripts and one data block", async () => {
  const repo = fixtureRepo();
  const { server, base, route } = await boot(repo);
  try {
    const html = await (
      await fetch(`${base}${route}/review?story=story.json`)
    ).text();
    // The theme bootstrap must stay inline and stay ahead of the stylesheet, or
    // a light-mode user gets a dark flash on every navigation.
    //
    // The second inline script is the entry's blocking-release timer, and it is
    // deliberately not folded into the bootstrap: the bootstrap resolves the
    // palette, this one bounds how long the entry module may hold up the first
    // paint. Nothing else may join them — the `#ds-initial-comments` block the
    // vanilla page shipped is a payload field now.
    assert.equal((html.match(/<script>/g) || []).length, 2);
    assert.doesNotMatch(html, /id="ds-initial-comments"/);
    assert.ok(
      html.indexOf("<script>") < html.indexOf('<link rel="stylesheet"'),
      "theme resolves before the stylesheet loads",
    );
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------------------
// 2. the payload
// ---------------------------------------------------------------------------

test("the payload is metadata-first: no step ships a rendered diff", async () => {
  const repo = fixtureRepo();
  const { server, base, route } = await boot(repo);
  try {
    const html = await (await fetch(`${base}${route}/review?story=story.json`)).text();
    const payload = shellPayload(html);
    assert.equal(payload.steps.length, 3);
    assert.deepEqual(
      payload.steps.map((step) => step.sceneLayout),
      ["concept-document", "code-focus", "code-focus"],
    );
    const serialized = JSON.stringify(payload);
    // The whole point of `files: []` + empty detail sets: a 300-step story
    // ships 300 stubs, not 300 highlighted diffs. If any of these appear the
    // metadata-first options have been lost and large reviews got slow.
    for (const marker of [
      "ds-diffbody",
      "ds-row ds-row-add",
      "ds-urow",
      "data-comment-code",
      "tk-k",
    ]) {
      assert.ok(
        !serialized.includes(marker),
        `payload must not carry rendered diff markup (${marker})`,
      );
    }
    for (const step of payload.steps) {
      assert.ok(
        !("blocks" in step) && !("moves" in step) && !("focusGroups" in step),
      );
    }
    const loaded = await fetch(
      `${base}/api/review/step-panel?index=1&page=${encodeURIComponent(payload.pageToken)}`,
    );
    assert.equal(loaded.status, 200);
    const loadedHtml = await loaded.text();
    assert.match(loadedHtml, /data-scene-layout="concept-document"/);
    assert.equal(
      loadedHtml.match(/data-scene-layout="([^"]+)"/)?.[1],
      payload.steps[0].sceneLayout,
      "the lazy endpoint preserves the stub's projected scene identity",
    );
    // Coverage is honestly unknown until the deferred check answers.
    assert.equal(payload.trust.pending, true);
  } finally {
    server.close();
  }
});

test("the payload carries the speech projections a stub needs to plan narration", async () => {
  const repo = fixtureRepo();
  const { server, base, route } = await boot(repo);
  try {
    const payload = shellPayload(
      await (await fetch(`${base}${route}/review?story=story.json`)).text(),
    );
    const primer = payload.steps.find((step) => step.kind === "concept");
    assert.ok(
      primer.conceptSpeech,
      "a concept stub can be spoken without loading it",
    );
    const beated = payload.steps.find((step) => step.beats.length > 1);
    assert.ok(beated, "the fixture has a multi-beat step");
    for (const beat of beated.beats) {
      assert.equal(typeof beat.text.speech, "string");
      assert.ok(
        beat.destination.startsWith("src/order.ts"),
        "the spoken destination names the file",
      );
    }
    const plain = payload.steps.find(
      (step) => step.kind !== "concept" && !step.beats.length,
    );
    assert.ok(
      plain.why.speech,
      "a beat-less step still speaks its review note",
    );
  } finally {
    server.close();
  }
});

test("the reading-position key is scoped per story, not per scope", async () => {
  const repo = fixtureRepo();
  const { server, base, route } = await boot(repo);
  try {
    const payload = shellPayload(
      await (await fetch(`${base}${route}/review?story=story.json`)).text(),
    );
    assert.ok(payload.storyKey, "the story half of the key travels");
    assert.ok(
      payload.viewedScope.startsWith(repo),
      "the reviewed-mark scope is repo + scope",
    );
  } finally {
    server.close();
  }
});

test("only open comments travel, each with its server-computed anchor", async () => {
  const repo = fixtureRepo();
  mkdirSync(join(repo, ".diffstory"), { recursive: true });
  writeFileSync(
    join(repo, ".diffstory", "comments.json"),
    JSON.stringify([
      {
        id: "open",
        file: "src/order.ts",
        line: 2,
        side: "right",
        type: "question",
        body: "Why two?",
        selectedText: "  return 2;",
        status: "open",
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "done",
        file: "src/order.ts",
        line: 2,
        type: "nit",
        body: "ok",
        status: "resolved",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ]),
  );
  const { server, base, route } = await boot(repo);
  try {
    const payload = shellPayload(
      await (await fetch(`${base}${route}/diff`)).text(),
    );
    assert.deepEqual(
      payload.comments.map((c) => c.id),
      ["open"],
    );
    assert.equal(payload.chrome.openCount, 1);
    const anchor = payload.commentAnchors.find((a) => a.id === "open");
    // Only the server can answer this: it re-reads the working tree and looks
    // for the selected text. `current` proves it actually did the read.
    assert.equal(anchor.state, "current");
  } finally {
    server.close();
  }
});

test("hostile authored text cannot terminate the payload script element", async () => {
  const repo = fixtureRepo();
  // A comment body is the right probe: unlike a story title it is NOT run
  // through the narrative projection, so it reaches `serializeShellPayload`
  // exactly as the author typed it. Whatever protects the document here is the
  // escaping, not a sanitizer upstream of it.
  const hostile = "Close </script><img src=x onerror=alert(1)> then <!-- open";
  writeFileSync(
    join(repo, ".diffstory", "comments.json"),
    JSON.stringify([
      {
        id: "c1",
        file: "src/order.ts",
        line: 2,
        side: "right",
        type: "question",
        body: hostile,
        status: "open",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ]),
  );
  const { server, base, route } = await boot(repo);
  try {
    const html = await (await fetch(`${base}${route}/diff`)).text();
    // `</script` closes the element early and `<!--` switches the tokenizer into
    // script-data-escaped state, which then swallows the real closing tag. Both
    // start with `<`, which is the one character the serializer has to escape.
    assert.equal(
      (html.match(/<\/script>/g) || []).length,
      4,
      "bootstrap + blocking-release timer + payload + module entry",
    );
    assert.ok(
      !html.includes("<img src=x"),
      "no element escapes into the document",
    );
    assert.ok(!html.includes("<!--"), "no comment state is entered");
    assert.match(
      html,
      /\\u003c/,
      "the payload block escapes every < it serializes",
    );
    assert.equal(
      shellPayload(html).comments[0].body,
      hostile,
      "and the value round-trips byte for byte",
    );
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------------------
// 3. the source — the inventory's at-risk list
// ---------------------------------------------------------------------------

test("AT RISK 1: lazy step stubs still ship the speech cache", () => {
  assert.match(storyView, /data-scene-layout=\{step\.sceneLayout\}/);
  assert.match(storyView, /data-step-speech-cache/);
  assert.match(storyView, /data-speech-beat=\{beat\.focusGroup\}/);
  assert.match(storyView, /data-speech-concept/);
  assert.match(storyView, /ds-why-text/);
  // Every step is a stub. An eager render is what would put a 300-step story's
  // whole diff in the document.
  assert.match(storyView, /data-step-lazy="1"/);
  assert.doesNotMatch(storyView, /data-diff-inner|data-split-inner/);
  // And the engine plans playback by reading the cache's speech units out of an
  // unloaded stub, rather than fetching the panel to find them.
  assert.match(engine, /\[data-speech-beat\]/);
  assert.match(engine, /\[data-speech-concept\]/);
  const plan =
    engine.match(/function speechUnitsForStep\([\s\S]*?\n {2}\}/) ||
    engine.match(/function stepSpeechUnits\([\s\S]*?\n {2}\}/);
  assert.ok(plan, "the engine still has a step→speech-units projection");
});

test("AT RISK 2: the reading position is keyed by scope AND story", () => {
  const key = engine.match(/function reviewUiKey\(\)\{[\s\S]*?\n {2}\}/)[0];
  assert.match(key, /'ds-review-ui:'/);
  assert.match(key, /data-review-scope/);
  assert.match(key, /data-viewed-scope/);
  assert.match(
    key,
    /data-story-key/,
    "commit 2156520: scope alone replays one story into another",
  );
  // The story half only exists if something writes it onto <body>.
  assert.match(reviewApp, /"data-story-key": payload\.storyKey/);
});

test("AT RISK 3: the measurement-only row attributes still exist end to end", () => {
  const renderTs = readFileSync(
    new URL("../src/render.ts", import.meta.url),
    "utf8",
  );
  // Emitted server-side...
  assert.match(renderTs, /data-step-focus="\$\{focusIndex\}"/);
  assert.match(renderTs, /data-step="\$\{esc\(s\.id\)\}"/);
  assert.match(renderTs, /moveTokens: rowMoveTokens\(row, s\)/);
  // ...and read by measurement code, not by a click handler, which is exactly
  // why dropping one fails silently rather than loudly.
  assert.match(engine, /data-step-focus/);
  assert.match(engine, /data-move/);
  assert.match(engine, /function focusGroupsForPanel\(/);
  assert.match(engine, /function moveEndpointRows\(/);
});

test("AT RISK 4: the arrow keys are resolved by one handler in a fixed order", () => {
  const onKey = engine.match(
    /function onKey\(e\)\{[\s\S]*?\n {2}\}\n {2}function /,
  )[0];
  const order = [
    "data-rail-beat",
    "data-story-beat",
    "moveSpeechBeat",
    "movePanelBeat",
    "handleChangeShortcut",
  ].map((name) => onKey.indexOf(name));
  assert.ok(
    order.every((at) => at >= 0),
    "all five arrow-key claimants are in the one handler",
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
    "rail beat → story beat → speech → panel beat → change nav",
  );
  // Space has a two-branch guard so it does not double-fire on the button.
  assert.match(onKey, /Spacebar|code==='Space'/);
  assert.match(onKey, /isKeyboardControlTarget/);
  // No component may take a key handler of its own and break the precedence.
  assert.doesNotMatch(markup, /onKeyDown|onKeyUp|onKeyPress/);
});

test("all twenty keyboard bindings survive the move", () => {
  const bindings = [
    ["Escape", /e\.key==='Escape'/],
    ["?", /e\.key==='\?'/],
    ["Tab trap", /e\.key==='Tab'/],
    ["/", /e\.key==='\/'/],
    ["c", /e\.key==='c'\|\|e\.key==='C'/],
    ["depth radiogroup", /data-story-choice/],
    ["review sub-tabs", /data-review-tab-select/],
    ["view tabs", /\.ds-tab\[data-view\]|data-view\]/],
    ["sidebar resizer", /data-sidebar-resizer/],
    ["rail beat", /data-rail-beat/],
    ["story beat", /data-story-beat/],
    ["speech beat", /moveSpeechBeat/],
    ["panel beat", /movePanelBeat/],
    ["j", /e\.key==='j'/],
    ["k", /e\.key==='k'/],
    ["v", /e\.key==='v'\|\|e\.key==='V'/],
    ["space", /toggleReadAloud/],
    ["composer Cmd+Enter", /aria-keyshortcuts','Meta\+Enter Control\+Enter/],
    [
      "split divider arrows",
      /aria-keyshortcuts','ArrowLeft ArrowRight Home End/,
    ],
    ["row C hint", /aria-keyshortcuts/],
  ];
  for (const [name, pattern] of bindings)
    assert.match(engine, pattern, `keyboard binding: ${name}`);
  // The four change-nav keys live in the diff half and the palette never
  // advertised them, so they are easy to lose by porting from the palette.
  const changeShortcut = engine.match(
    /function handleChangeShortcut\(e\)\{[\s\S]*?\n {2}\}/,
  )[0];
  for (const key of ["'n'", "'N'", "'p'", "'P'", "'\\['", "'\\]'"]) {
    assert.match(
      changeShortcut,
      new RegExp(key),
      `change navigation still binds ${key}`,
    );
  }
});

test("AT RISK 5: every lazy endpoint distinguishes a stale lease from a retry", () => {
  // 409 + reloadRequired is not retryable: retrying the same request against
  // the same dead lease can only 409 again.
  assert.match(engine, /reloadRequired/);
  assert.match(engine, /status===409/);
  const reloads = engine.match(/data-review-reload/g) || [];
  assert.ok(
    reloads.length >= 4,
    `every inline error surface offers a reload (${reloads.length})`,
  );
  assert.match(engine, /The review changed while this page was open/);
  // …and each of the six leased endpoints goes through the token helper.
  for (const path of [
    "/api/review/step-panel",
    "/api/diff/file-panel",
    "/api/diff/split",
    "/api/fullfile",
    "/api/diff/context",
    "/api/review/trust",
  ]) {
    assert.ok(engine.includes(path), `engine calls ${path}`);
  }
  assert.match(engine, /function reviewPageUrl\(path\)/);
});

test("AT RISK 6: coverage is pending until it is checked, never assumed clean", () => {
  assert.match(
    reviewViewSrc,
    /data-trust-uncovered=\{trust\.pending \? "" : trust\.uncoveredCount\}/,
  );
  assert.match(reviewViewSrc, /Checking coverage…/);
  assert.match(reviewViewSrc, /is-unknown/);
  assert.match(engine, /function markCoverageUnavailable\(/);
  assert.match(engine, /function applyCoverageVerdict\(/);
});

test("AT RISK 7: reviewed marks stay bound to the exact file diff", () => {
  assert.match(engine, /viewedFiles\[file\]===hash/);
  assert.match(engine, /function reviewHashForFile\(/);
  assert.match(
    engine,
    /Array\.isArray\(stored\)/,
    "legacy string[] entries migrate",
  );
  assert.match(sidebar, /data-review-hash=\{file\.reviewHash\}/);
  assert.match(reviewViewSrc, /data-review-hash=\{file\.reviewHash\}/);
});

test("AT RISK 8: a selection may not cross diff sides", () => {
  assert.match(engine, /ds-selecting-left/);
  assert.match(engine, /ds-selecting-right/);
  const context = engine.match(
    /function currentSelectionContext\(\)\{[\s\S]*?\n {2}\}/,
  )[0];
  assert.match(context, /return null/);
});

test("AT RISK 9: the Mermaid sanitizer keeps every one of its rules", () => {
  const sanitize = engine.match(
    /function sanitizeMermaidSvg\(svg\)\{[\s\S]*?\n {2}\}/,
  )[0];
  assert.match(sanitize, /image\/svg\+xml/);
  assert.match(sanitize, /http:\/\/www\.w3\.org\/2000\/svg/);
  assert.match(sanitize, /invalid diagram SVG/);
  // `image` and `a` are blocked too, not just script/foreignObject.
  // One selector, and `image` and `a` are in it — not just script/foreignObject.
  assert.match(
    sanitize,
    /querySelectorAll\('script,foreignObject,iframe,object,embed,image,a'\)/,
  );
  assert.match(sanitize, /@import/);
  assert.match(sanitize, /XMLSerializer/, "reparse-then-serialize round trip");
  assert.match(engine, /securityLevel:'strict'/);
  assert.match(engine, /htmlLabels:false/);
});

test("AT RISK 10: scrollIntoView stays banned", () => {
  assert.doesNotMatch(engine, /scrollIntoView/);
  assert.doesNotMatch(markup, /scrollIntoView/);
  assert.match(engine, /function scrollReviewRowVertically\(/);
  assert.match(engine, /function centerFocusRows\(/);
});

test("AT RISK 11: the beat dock is adopted into the island, not left in the step", () => {
  assert.match(engine, /function adoptStepDocks\(/);
  assert.match(engine, /function beatHost\(/);
  assert.match(engine, /function beatPanel\(/);
  assert.match(storyView, /data-dock-slot/);
});

test("AT RISK 13/14: live banners are per-generation and the drop has a grace period", () => {
  assert.match(engine, /liveDismissed\[kind\]=liveGenerations\[kind\]/);
  assert.match(
    engine,
    /liveDisconnectTimer=setTimeout\([\s\S]{0,120}?4000\)|4000\)/,
  );
  assert.match(engine, /pageshow/);
  assert.match(engine, /event\.persisted|e\.persisted/);
  // A dead lease answers 204 so EventSource stops reconnecting; the client must
  // not paper over that with its own retry.
  assert.doesNotMatch(engine, /new EventSource[\s\S]{0,400}?setInterval/);
});

test("modal inerting reaches the modal's real siblings, not just body's children", () => {
  // Found by driving the command palette in Chrome: the vanilla page put every
  // modal directly under <body>, so "inert everything except the modal" was
  // `body > *` minus the modal. React mounts into `#root`, which made `body > *`
  // match only `#root` — the modal's own ancestor — so opening the palette
  // inerted the palette and Tab walked straight out of the dialog.
  assert.match(engine, /function modalBackgroundNodes\(top\)/);
  assert.doesNotMatch(engine, /\$all\('body > \*'\)/);
  const sync = engine.match(
    /function syncModalBackground\(\)\{[\s\S]*?\n {2}\}/,
  )[0];
  assert.match(
    sync,
    /modalBackgroundSnapshots\.forEach\(restoreModalNode\)/,
    "restore before re-applying",
  );
  assert.match(sync, /setAttribute\('inert',''\)/);
  assert.match(sync, /setAttribute\('aria-hidden','true'\)/);
});

test("AT RISK 15: a deliberate mode choice survives a narrow screen", () => {
  assert.match(engine, /data-mode-user-set/);
  assert.match(engine, /function applyResponsiveStoryMode\(/);
});

test("every performance measure that keeps a 300-step story usable is still here", () => {
  const measures = [
    [
      "single-step prefetch only",
      /loadStoryStep\(i\+1\)|loadStoryStep\(index\+1\)/,
    ],
    ["narration warms at most two ahead", /function warmSpeechSequence\(/],
    ["coverage deferred past first paint", /requestIdleCallback/],
    ["coverage idle timeout", /timeout:2000/],
    ["coverage fallback", /setTimeout\(scheduleCoverage|400\)/],
    ["trust fetched once, promise shared", /trustLoadPromise/],
    ["position save debounce", /90\)/],
    ["file search debounce", /180\)/],
    ["narration dwell debounce", /aloudPrepareTimer=setTimeout\(/],
    [
      "rAF-batched drags",
      /requestAnimationFrame\(applySplitResize|splitResizeFrame/,
    ],
    ["rAF-batched annotations", /function scheduleAnnotations\(/],
    ["observers disconnect before reobserving", /\.disconnect\(\)/],
    ["hidden, never unmounted", /\.hidden=/],
    ["abortable token-guarded requests", /AbortController/],
  ];
  for (const [name, pattern] of measures)
    assert.match(engine, pattern, `performance measure: ${name}`);
  // The rail compaction is markup-side.
  assert.match(sidebar, /steps\.length <= 10/);
  assert.match(sidebar, /includeBeats=\{false\}/);
  // And the file panels are stubs, one fetch each, with split as a second one.
  assert.match(reviewViewSrc, /data-file-panel-lazy/);
  assert.match(engine, /function loadSplit\(/);
});

test("the route still builds its model metadata-first", () => {
  const renderTs = readFileSync(
    new URL("../src/render.ts", import.meta.url),
    "utf8",
  );
  const call = renderTs.match(
    /buildReviewModel\(repo, tour, files, headRef, \{[\s\S]*?\}\);/,
  )[0];
  assert.match(
    call,
    /detailedStepIndexes: input\.fileIndex \? new Set\(\) : new Set\(\[0\]\)/,
  );
  assert.match(call, /detailedFilePaths: new Set\(\)/);
  assert.match(call, /trustPending: !!input\.fileIndex/);
});

// ---------------------------------------------------------------------------
// 3b. announcement discipline
// ---------------------------------------------------------------------------

test("no beUI component with a baked-in live region reaches this surface", () => {
  // A live region on the diff viewport would announce the whole body on every
  // lazy load, context expansion and split↔unified toggle — and `agents/file-diff`
  // shipped exactly that, on the viewport element itself. `ai-sidebar`,
  // `tool-result`, `todo-list`, `streaming-response` and `motion/loader` carried
  // one too, and `agents/code-block` carried a conditional one behind a
  // `streaming` prop.
  //
  // Those files were pruned after the rewrite (74 vendored → the 6 the app
  // imports); `client/vendor/beui/README.md` keeps the measured record and
  // `test/vendor-beui.test.mjs` holds the tree to an allowlist and re-checks the
  // survivors. The invariant that belongs *here* is blunter and stronger.
  const surface = [
    reviewApp,
    sidebar,
    storyView,
    reviewViewSrc,
    progressHost,
    entry,
  ].join("\n");
  assert.ok(
    !/vendor\/beui/.test(surface),
    "this surface is hand-built; it imports no beUI component at all",
  );
  assert.ok(
    !surface.includes("streaming"),
    "nothing here passes a streaming prop",
  );

  // This page does have live regions, and should: the toast, the drift path and
  // the generation state are small, targeted, and ported from the vanilla page.
  // The rule is narrower than "none" — no *diff container* may be one, because
  // that is the element whose whole subtree is replaced on every lazy load.
  // The elements whose entire subtree is swapped for diff rows. Deliberately
  // NOT the `data-file-panel-lazy` loading stub — a one-shot "Loading…" status
  // is exactly what a live region is for.
  //
  // These containers are emitted server-side by `src/render.ts` and by the
  // engine, NOT by the TSX above — scanning only the components made this check
  // vacuous, which is the exact failure it exists to catch.
  const DIFF_CONTAINERS = /data-(diff|split|full)-inner|data-ctx-rows/;
  const emitters = [renderSrc, engine].join("\n");
  const tags = emitters.match(/<[A-Za-z][^>]*?>/gs) ?? [];
  assert.ok(
    tags.filter((tag) => DIFF_CONTAINERS.test(tag)).length >= 3,
    "found no diff containers to check — this guard is pointed at the wrong file",
  );
  for (const tag of tags) {
    if (!DIFF_CONTAINERS.test(tag)) continue;
    assert.doesNotMatch(
      tag,
      /aria-live|role="(status|log|alert)"/,
      `a diff container must never be a live region — it would announce the whole body on every lazy load:\n${tag}`,
    );
  }
});

test("the accessibility contract the old renderer guaranteed is still in the markup", () => {
  // Formerly test/render-accessibility.test.mjs, against renderPage()'s string.
  assert.doesNotMatch(markup, /data-feedback-filter/);
  assert.match(
    engine,
    /'role','group'[\s\S]{0,80}'aria-label','Comment type'|aria-label','Comment type'/,
  );
  assert.match(engine, /'aria-label','Edit review comment'/);
  assert.match(engine, /ta\.rows=3/);
  assert.match(reviewViewSrc, /data-copy-comments="queued"/);
  assert.match(storyView, /id="storyReviewerNoteLabel"/);
  assert.match(storyView, /aria-labelledby="storyReviewerNoteLabel"/);
  assert.match(storyView, /aria-describedby="storyReviewerNoteHelp"/);
  assert.match(storyView, /What should this change accomplish\?/);
  // The command dialog, including the scrim that must not be focusable.
  assert.match(reviewApp, /className="ds-command"[\s\S]{0,200}role="dialog"/);
  assert.match(reviewApp, /aria-labelledby="ds-command-title"/);
  assert.match(reviewApp, /aria-describedby="ds-command-description"/);
  assert.match(reviewApp, /id="ds-command-title">Commands/);
  assert.match(reviewApp, /Keyboard-first review without hidden magic\./);
  assert.match(
    reviewApp,
    /<div\s+className="ds-command-scrim"[\s\S]{0,120}data-shortcuts-close[\s\S]{0,120}aria-hidden="true"[\s\S]{0,20}\/>/,
  );
  assert.doesNotMatch(reviewApp, /<button className="ds-command-scrim"/);
  assert.match(reviewApp, /aria-label="Close commands"/);
  assert.match(
    reviewApp,
    /className="ds-command-list"[\s\S]{0,120}role="group"[\s\S]{0,120}aria-label="Review commands"/,
  );
  // Landmarks and the three view tabpanels.
  assert.match(
    sidebar,
    /<aside className="ds-rail" aria-label="Review navigation">/,
  );
  assert.match(reviewApp, /<main className="ds-main">/);
  for (const view of ["tour", "files", "review"]) {
    assert.ok(
      markup.includes(
        `id="ds-view-${view}" role="tabpanel" aria-labelledby="ds-tab-${view}"`,
      ),
      `#ds-view-${view} is a labelled tabpanel`,
    );
  }
});

// ---------------------------------------------------------------------------
// 3c. the server fragments that stay server-rendered
// ---------------------------------------------------------------------------

test("diff rows keep their full data-* contract", () => {
  const full = renderFullFile(
    [
      { type: "ctx", oldNo: 1, newNo: 1, content: "line one" },
      { type: "add", newNo: 2, content: "line two" },
    ],
    { file: "a.ts", newFile: false },
  );
  assert.match(
    full,
    /data-comment-side="left" data-comment-file="a\.ts" data-comment-line="1"/,
  );
  assert.match(
    full,
    /data-comment-side="right" data-comment-file="a\.ts" data-comment-line="2"/,
  );
  assert.match(full, /role="group" tabindex="-1" aria-keyshortcuts="C"/);
  assert.match(full, /aria-label="Added after line 2 in a\.ts: line two"/);
});

test("a lazily served step panel carries the step, focus and move attributes", () => {
  const tour = {
    version: 1,
    title: "t",
    summary: "s",
    steps: [
      {
        id: "s1",
        order: 1,
        title: "c",
        file: "a.ts",
        range: [1, 2],
        kind: "changed",
        why: "I changed this so the next helper receives the value it needs.",
      },
    ],
  };
  const files = [
    {
      oldPath: "a.ts",
      newPath: "a.ts",
      status: "modified",
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 2,
          lines: [
            { type: "del", content: "old", oldNo: 1 },
            { type: "add", content: "new1", newNo: 1 },
            { type: "add", content: "new2", newNo: 2 },
          ],
        },
      ],
    },
  ];
  const model = buildReviewModel(process.cwd(), tour, files, undefined, {});
  const panel = renderStoryStepPanel(process.cwd(), model, [], 0);
  assert.match(panel, /class="ds-step is-code-step"/);
  assert.match(panel, /data-step="s1"/, "comment→step attribution");
  assert.match(panel, /data-step-focus="\d+"/, "beat focus groups");
  assert.match(panel, /data-diff-inner/);
  assert.match(
    panel,
    /data-split-inner data-loaded="1"/,
    "story steps never fetch split",
  );
  assert.match(panel, /data-beat-dock/);
  // The unified inner is where `data-step` is injected by regex; losing it
  // breaks comment attribution silently.
  const unified = panel.slice(
    panel.indexOf("data-diff-inner"),
    panel.indexOf("data-split-inner"),
  );
  assert.match(unified, /class="ds-urow[^"]*" data-step="s1"/);

  const filePanel = renderFilePanelContent(model.files[0], new Map());
  assert.match(filePanel, /data-viewed-toggle/);
  assert.match(filePanel, /data-split-inner/);
  assert.doesNotMatch(
    filePanel,
    /data-split-inner data-loaded/,
    "All-files split is a second lazy fetch",
  );
});

// ---------------------------------------------------------------------------
// 4. the bundle
// ---------------------------------------------------------------------------

test("the built bundle actually ships the review behaviour", (t) => {
  const dir = new URL("../dist/client/", import.meta.url);
  if (!existsSync(new URL("review.js", dir))) {
    t.skip("client bundle not built");
    return;
  }
  // Splitting hoists shared code into `chunk-*.js`, and esbuild emits an ASCII
  // bundle, so every non-ASCII character ships as `\uXXXX`. Read the entry plus
  // the chunks and decode, or half of these would silently never match.
  const js = readdirSync(dir)
    .filter(
      (file) =>
        file === "review.js" ||
        (file.startsWith("chunk-") && file.endsWith(".js")),
    )
    .map((file) => readFileSync(new URL(file, dir), "utf8"))
    .join("\n")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );

  for (const endpoint of [
    "/api/review/step-panel",
    "/api/diff/file-panel",
    "/api/diff/split",
    "/api/fullfile",
    "/api/diff/context",
    "/api/review/trust",
    "/api/review/coverage",
    "/api/review/file-search",
    "/api/review/excluded-file",
    "/api/story-drift/file",
    "/api/review-state",
    "/api/comments",
    "/api/editor/open",
    "/api/events",
    "/api/generate",
    "/api/story/repair",
    "/assets/mermaid.esm.min.mjs",
  ]) {
    assert.ok(js.includes(endpoint), `bundle calls ${endpoint}`);
  }

  for (const text of [
    "Loading this review step…",
    "Loading file review…",
    "Reading order",
    "Next unreviewed",
    "Start the walkthrough",
    "Checking coverage…",
    "No queued comments. Select code in the diff and press C.",
    "Keyboard-first review without hidden magic.",
    "Comment selected code",
    "Story updated. Reloading in 10 seconds.",
    "Live updates interrupted.",
    "The review changed while this page was open",
    "Opening implementation in VS Code…",
    "Remove this queued comment?",
    "invalid diagram SVG",
    "ds-review-ui:",
    "ds-viewed:",
    "ds-challenge:",
    "ds-exclusions-ack:",
    "ds-files-mode",
    "ds-sidebar-width",
    "ds-split",
  ]) {
    assert.ok(js.includes(text), `bundle ships "${text}"`);
  }

  // The bans, in the shipped artifact rather than only in the source.
  assert.ok(
    !js.includes("scrollIntoView"),
    "the horizontal-scroll trap stays out of the bundle",
  );
});

test("the engine is one module with one entry point and two seams", () => {
  // The whole reason the interaction layer was moved rather than reimplemented:
  // the click order and the key precedence are the behaviour. Anything that
  // splits this file into per-component handlers has to re-derive both.
  assert.equal((engineRaw.match(/^export function /gm) || []).length, 1);
  assert.match(engineRaw, /export function startReviewEngine\(options\)\{/);
  const imports = engineRaw.match(/^import [\s\S]*?from '[^']+';/gm) || [];
  assert.equal(
    imports.length,
    1,
    "exactly one import: the progress-panel seam",
  );
  assert.match(imports[0], /\.\/progress-host/);
  // The other seam: it runs when React has committed, not on DOMContentLoaded.
  assert.doesNotMatch(engine, /DOMContentLoaded/);
  assert.match(reviewApp, /startReviewEngine\(\{/);
});
