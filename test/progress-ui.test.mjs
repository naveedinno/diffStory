// The live-progress panel, after the React rewrite.
//
// This surface is unlike the other four: it has no route, so the picker's
// "1. the route / 2. the payload" layers have nothing to point at. There is no
// HTML to request and no `__DIFFSTORY_DATA__` block to parse — the panel's whole
// input is the NDJSON body of `POST /api/generate` or `POST /api/story/repair`.
// The four layers are therefore:
//
//   1. THE UNION    — `src/progress.ts` defines the wire protocol. Every member
//                     of `ProgressEvent` must be handled, and every `Phase` must
//                     reach a milestone. A protocol that grows a member the
//                     panel silently ignores is the failure this layer catches.
//   2. THE CONTRACT — the review page imports this surface. Its exported names
//                     are an API between two agents' files, so a rename should
//                     fail here rather than in someone else's page.
//   3. THE SOURCE   — the two behaviours the surface inventory ranks #3 and #4
//                     at-risk: announcement discipline, and the `>>` echo guard.
//                     Plus the five panel states.
//   4. THE BUNDLE   — every user-facing string and both a11y contracts survive
//                     esbuild, so layer 3 guards code that actually ships.
//
// What layers 3 and 4 cannot do is prove the DOM behaves. That was verified by
// mounting `dist/client/progress.js` in Chromium and driving it with fixture
// `ProgressEvent`s through all five states — the same technique the UI atlas
// uses — while reading the live-region semantics back out of the rendered tree.
// See the report accompanying this rewrite. If this surface grows a regression
// the source text cannot catch, that browser run is what should become a test
// file, not a weaker string match here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const CLIENT = new URL('../client/', import.meta.url);
const readRaw = (relative) => readFileSync(new URL(relative, CLIENT), 'utf8');

// Source assertions must read code, not prose. A comment explaining why an API
// is forbidden otherwise trips the very guard that forbids it — and this file is
// full of such comments, because "never put aria-live here" is precisely the
// thing worth writing down next to the code. Only whole-line comments and block
// comments are stripped, so a `//` inside a string literal survives.
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');

const read = (relative) => stripComments(readRaw(relative));

const state = read('surfaces/progress/state.ts');
const hook = read('surfaces/progress/use-progress-run.ts');
const stream = read('surfaces/progress/run-progress.ts');
const panel = read('surfaces/progress/ProgressPanel.tsx');
const planList = read('surfaces/progress/PlanList.tsx');
const milestones = read('surfaces/progress/Milestones.tsx');
const elapsed = read('surfaces/progress/Elapsed.tsx');
const barrel = read('surfaces/progress/index.ts');
const entry = read('entry/progress.tsx');

const markup = [panel, planList, milestones, elapsed].join('\n');
const surface = [state, hook, stream, markup, barrel, entry].join('\n');

const protocol = readFileSync(new URL('../src/progress.ts', import.meta.url), 'utf8');

/** Pull one exported type's body out of `src/progress.ts`. */
function unionBody(name) {
  const start = protocol.indexOf(`export type ${name} =`);
  assert.ok(start >= 0, `src/progress.ts should export ${name}`);
  const end = protocol.indexOf('\n\n', start);
  return protocol.slice(start, end < 0 ? undefined : end);
}

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

/** The body of one `case` arm in state.ts's event switch, up to the next arm. */
function switchArm(label) {
  const start = state.indexOf(`case "${label}":`);
  assert.ok(start >= 0, `applyEvent should handle ${label}`);
  const rest = state.slice(start + label.length + 8);
  const next = rest.search(/\n\s{4}(case "|default:)/);
  return next < 0 ? rest : rest.slice(0, next);
}

// ──────────────────────────────────────────────────────────── 1. the union

test('every streamed event type reaches a handler', () => {
  const types = [...unionBody('ProgressEvent').matchAll(/type: '([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(types.length >= 13, `expected the full ProgressEvent union, saw ${types.length} members`);
  for (const type of types) {
    assert.ok(state.includes(`case "${type}":`), `applyEvent must handle "${type}"`);
  }
  // And nothing invented: a case for an event the server never sends is dead
  // code that will rot without anyone noticing.
  const handled = [...state.matchAll(/case "([a-z_]+)":/g)].map((m) => m[1]);
  for (const type of handled) {
    assert.ok(types.includes(type), `"${type}" is handled but is not a ProgressEvent member`);
  }
});

test('every phase the server can emit lands on a milestone', () => {
  const phases = [...unionBody('Phase').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(phases.length >= 15, `expected the full Phase union, saw ${phases.length} members`);
  const start = state.indexOf('const STORY_MILESTONES');
  const table = state.slice(start, state.indexOf('\n];', start));
  assert.ok(start >= 0 && table.length > 200, 'the milestone table should be readable from source');
  const named = new Set(
    [...table.matchAll(/phases: \[([^\]]*)\]/gs)]
      .flatMap((m) => [...m[1].matchAll(/"([a-z_]+)"/g)].map((p) => p[1])),
  );
  for (const phase of phases) {
    // `failed` and `stopped` are terminal states, not steps on the thread.
    if (phase === 'failed' || phase === 'stopped') {
      assert.ok(!named.has(phase), `${phase} is a run outcome, not a milestone phase`);
      continue;
    }
    assert.ok(named.has(phase), `phase "${phase}" would never advance the milestone thread`);
  }
  // The three labels the story prompt tells the agent to print, verbatim.
  assert.ok(state.includes('Recovering the why'));
  assert.ok(state.includes('Designing the reading path'));
  assert.ok(state.includes('Writing the story'));
  // Monotonic: a late earlier phase must not rewind the thread.
  assert.match(state, /if \(i > state\.milestoneIndex\)/);
});

// ───────────────────────────────────────────────────────── 2. the contract

test('the surface exports the interface the review page consumes', () => {
  for (const name of [
    'ProgressPanel',
    'progressPrimaryActionClass',
    'progressSecondaryActionClass',
    'useProgressRun',
    'runProgress',
  ]) {
    assert.match(barrel, new RegExp(`\\b${name}\\b`), `index.ts must export ${name}`);
  }
  for (const type of ['ProgressPanelProps', 'ProgressRun', 'ProgressRunOptions', 'ProgressState', 'ProgressVariant']) {
    assert.match(barrel, new RegExp(`\\b${type}\\b`), `index.ts must export the ${type} type`);
  }

  // The run handle. Each of these is called by the host, not by this surface,
  // so nothing inside client/ would break if one silently disappeared.
  for (const method of ['start', 'handle', 'finish', 'blocked', 'close', 'error', 'requestStop', 'requestClose']) {
    assert.match(hook, new RegExp(`\\b${method}:`), `ProgressRun must expose ${method}`);
  }
  // Host callbacks, in the vanilla panel's vocabulary.
  for (const callback of ['onEvent', 'onStop', 'onClose', 'onDone', 'onBlocked']) {
    assert.match(hook, new RegExp(`${callback}\\?:`), `ProgressRunOptions must accept ${callback}`);
  }
  assert.match(hook, /opts\.current\.onEvent\?\.\(event\)/, 'every event reaches onEvent before the panel');

  // Three placements, one component. The vanilla panel was a singleton node
  // re-parented between them; React renders it where the host puts it.
  assert.match(state, /export type ProgressVariant = "floating" \| "inline" \| "stage";/);
  for (const variant of ['floating', 'inline', 'stage']) {
    assert.match(panel, new RegExp(`${variant}:`), `the panel must style the ${variant} placement`);
  }
  // `foot` replaces the vanilla showFoot(node) DOM injection.
  assert.match(panel, /foot\?: ReactNode/);
  assert.match(panel, /data-pp-foot=""/);
});

test('the NDJSON pump keeps its three distinct failure outcomes', () => {
  // A run that never started is NOT a run that failed: the host offers a way to
  // fix the cause, not a retry of a request that cannot succeed.
  assert.match(stream, /if \(!response\.ok \|\| !response\.body\)/);
  assert.match(stream, /run\.blocked\(/);
  assert.match(stream, /if \(signal\?\.aborted\) run\.finish\("stopped", \{\}\);/);
  assert.match(stream, /else run\.finish\("failed", \{\}\);/);
  // A malformed frame costs one frame.
  assert.match(stream, /continue;/);
  assert.match(stream, /buffer = lines\.pop\(\) \?\? "";/);
  // This is the POST-body stream, not the review page's SSE channel.
  assert.ok(!/EventSource|text\/event-stream/.test(stream), 'the panel never touches /api/events');
});

// ───────────────────────────────────────────── 3. at-risk behaviour, in source

test('the panel has exactly one live region and it is the announcer', () => {
  // At-risk #3. The instinctive React move is `aria-live` on the status panel;
  // during a 60-second run that is several hundred spoken interruptions.
  assert.equal(countOf(markup, 'aria-live'), 2, 'only the announcer and the opted-out timer may mention aria-live');
  assert.match(panel, /role="status"\s+aria-live="polite"\s+aria-atomic="true"/);
  assert.equal(countOf(markup, 'role="status"'), 1);
  assert.equal(countOf(markup, 'aria-live="polite"'), 1);
  assert.ok(!/role="log"/.test(markup), 'no implicit live region either');

  // The announcer renders exactly one field, and that field has exactly one writer.
  assert.match(panel, /\{state\.announcement\}/);
  assert.equal(countOf(panel, 'state.announcement'), 1);

  // The elapsed clock ticks once a second and must stay silent while doing it.
  assert.match(elapsed, /role="timer"\s+aria-live="off"/);
  assert.match(elapsed, /<span className="sr-only">Elapsed <\/span>/);
  assert.match(elapsed, /window\.setInterval\(\(\) => tick\(\(n\) => n \+ 1\), 1000\)/);
  assert.ok(!/announce/.test(elapsed), 'the tick writes no announcement');

  // The error card is the one thing allowed to interrupt, and it appears once.
  assert.match(panel, /role="alert"\s+aria-atomic="true"/);
  assert.equal(countOf(markup, 'role="alert"'), 1);
});

test('only lifecycle changes announce — activity, heartbeats and text stay silent', () => {
  // `announce()` is defined once and called from exactly five places. If you are
  // adding a sixth, you are almost certainly making the panel chatty.
  assert.match(state, /function announce\(state: ProgressState, message: string\): ProgressState \{/);
  assert.equal(countOf(state, 'announce('), 6, 'one definition plus five call sites');

  // The five, named. Each is a lifecycle transition a user would want spoken.
  assert.match(state, /announce\(setLive\(fresh, "Preparing", 0\), "Preparing"\)/);
  assert.match(state, /announce\(setLive\(next, "Working", 0\), title\)/);
  assert.match(state, /announce\(\{ \.\.\.state, milestoneIndex: i \}, milestones\[i\]\.label\)/);
  assert.match(state, /if \(!next\.milestones\) next = announce\(next, "Checking the result"\)/);
  assert.match(state, /if \(ok \|\| status === "stopped"\) next = announce\(next, title\)/);

  // And the arms that must NOT speak. These are the high-frequency ones: a
  // single run emits hundreds of them.
  for (const quiet of ['heartbeat', 'file', 'command', 'tool', 'text', 'warning', 'plan', 'context']) {
    assert.ok(!switchArm(quiet).includes('announce('), `the "${quiet}" arm must stay silent`);
  }

  // Deduping, so a repeated milestone or re-emitted title does not re-speak.
  assert.match(state, /if \(!text \|\| text === state\.announcement\) return state;/);
  // Nothing outside state.ts may write an announcement.
  assert.ok(!/announcement:/.test(markup), 'the components render the announcement, they never set it');
});

test('the vendored components that ship their own live region are not used', () => {
  // beUI's agent components were the design doc's suggestion for this panel and
  // every one of them bakes in a live region — `todo-list` would have read the
  // whole plan aloud on each update. That is why the plan list, milestone thread
  // and spinner are hand-built here.
  //
  // This used to assert against the vendored files themselves. They were pruned
  // once the rewrite finished (74 files → the 6 the app imports), so the record
  // of what carried a live region now lives in `client/vendor/beui/README.md`
  // and the tree is held to an allowlist by `test/vendor-beui.test.mjs`. What is
  // still worth asserting here is local: this panel imports nothing that speaks.
  const rejected = [
    'agents/todo-list',
    'agents/agent-activity',
    'agents/loading-states/agent-progress',
    'agents/loading-states/reasoning-text',
    'motion/dynamic-island',
    'motion/loader',
  ];
  for (const specifier of rejected) {
    assert.ok(
      !surface.includes(`vendor/beui/${specifier}`),
      `${specifier} would add a second live region to the panel`,
    );
  }
  // What IS used from beUI: the button, and nothing that speaks.
  assert.match(panel, /import \{ Button \} from "\.\.\/\.\.\/vendor\/beui\/motion\/button\/base";/);
});

test("'>>' note lines never echo into the activity line", () => {
  // At-risk #4. One `indexOf` check. A `>>` line has already arrived as a
  // narration or phase event; without this the raw stdout copy prints it a
  // second time, as mono, under the prose.
  assert.ok(state.includes('line.indexOf(">>") !== 0'), 'the text handler must skip note lines');
  const text = switchArm('text');
  // The guard only matters when there is no plan, and it must sit AFTER the raw
  // log append — the note still belongs in the technical details.
  assert.ok(text.indexOf('appendRaw(state, event.data') < text.indexOf('indexOf(">>")'));
  assert.match(text, /if \(next\.hasPlan\) return next;/);
  assert.match(text, /if \(line && line\.indexOf\(">>"\) !== 0\) return setCurrent\(next, line\);/);
});

test('the panel keeps all five of its states', () => {
  // running
  assert.match(state, /phase: "running"/);
  assert.match(state, /spinning: true,\n\s*showStop: true,\n\s*showClose: false,/);
  // complete — including the desktop hand-off, which is a complete run that
  // produced no story file.
  assert.match(state, /const handedToDesktop = ok && result\?\.delivery === "desktop";/);
  assert.match(state, /\? "Sent to ChatGPT"/);
  assert.match(state, /"Message delivered"/);
  assert.ok(state.includes('guided_review: "Review ready"'));
  // stopped
  assert.match(state, /status === "stopped"\n?\s*\? "Stopped"/);
  // failed
  assert.ok(state.includes('guided_review: "Generation failed"'));
  assert.match(state, /label: "The connection to the agent ended"/);
  assert.match(state, /if \(!ok && next\.raw\.trim\(\)\) next = \{ \.\.\.next, showDetails: true \}/);
  assert.match(panel, /<summary[^>]*>\s*Technical details/s);
  assert.ok(!/details open|defaultOpen/.test(panel), 'diagnostics are revealed, never auto-opened');
  // cannot start
  assert.match(state, /export function blockRun/);
  assert.match(state, /title: "Cannot start"/);
  assert.match(state, /label: error\.label \|\| "Could not start"/);

  // The milestone pulse freezes once a run lands, in every state.
  assert.match(state, /finished: true/);
  assert.match(milestones, /!state\.finished &&\n?\s*"animate-pulse/);
  // Reduced motion removes every one of the three pulses and the spinner.
  assert.equal(countOf(markup, 'motion-reduce:animate-none'), 4);
});

test('the stage variant and the elapsed clock survive the port', () => {
  // The stage placement (the panel taking over the story intro) gets a bigger
  // title, roomier milestones and note, and no scroll cap of its own.
  assert.match(panel, /stage: "mt-7 max-h-none"/);
  assert.match(panel, /const stage = variant === "stage";/);
  assert.match(panel, /stage && "text-\[11\.5px\]"/);
  assert.match(milestones, /compact && "px-4 pt-3\.5 pb-1"/);

  // Elapsed formatting: "42s" below a minute, "1m 5s" above it.
  assert.match(state, /seconds < 60 \? `\$\{seconds\}s` : `\$\{Math\.floor\(seconds \/ 60\)\}m \$\{seconds % 60\}s`/);
  // Read from the clock, so the render that stops the run prints the final time.
  assert.match(elapsed, /startedAt \? elapsedLabel\(Date\.now\(\) - startedAt\) : "0s"/);
  assert.match(elapsed, /if \(!running\) return;/);
});

test('the panel does not become a dialog, a router, or a store', () => {
  // It is a non-blocking status surface over a page the user can still read.
  // Making it modal mid-run is a behaviour change, not a port.
  assert.ok(!/role="dialog"|aria-modal|inert/.test(markup), 'no focus trap, no modality');
  assert.ok(!/"Escape"/.test(surface), 'there is no Escape-to-close, deliberately');
  assert.ok(!/localStorage|sessionStorage/.test(surface), 'a run is not resumable; nothing is persisted');
  assert.ok(
    !/(?:history|window\.history)\s*\.\s*(?:pushState|replaceState)\s*\(/.test(surface),
    'there is no history API anywhere in this codebase',
  );
  // Regions that were removed on purpose and should not come back.
  for (const gone of [/ds-pp-timeline/, /ds-pp-phase-label/, /taskMode/, /codex:\/\/threads/]) {
    assert.doesNotMatch(surface, gone, `${gone} was removed on purpose`);
  }
});

// ──────────────────────────────────────────────────────────── 4. the bundle

test('the built bundle ships the panel behaviour', (t) => {
  const dir = new URL('../dist/client/', import.meta.url);
  if (!existsSync(new URL('progress.js', dir))) {
    t.skip('client bundle not built');
    return;
  }
  // The review page imports this surface, so code splitting hoists the panel
  // itself into a shared `chunk-*.js` and leaves `progress.js` as little more
  // than the imperative bridge. "Did this string survive the build" is a
  // question about the entry AND its chunks.
  const js = readdirSync(dir)
    .filter((file) => file === 'progress.js' || (file.startsWith('chunk-') && file.endsWith('.js')))
    .map((file) => readFileSync(new URL(file, dir), 'utf8'))
    .join('\n')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

  // Every user-facing string, including the branches a user only reaches when
  // something has gone wrong — the easiest to lose and the hardest to notice.
  for (const text of [
    'Preparing',
    'Writing your review',
    'Review ready',
    'Generation failed',
    "Couldn't finish",
    'Stopped',
    'Sent to ChatGPT',
    'Message delivered',
    'Cannot start',
    'Could not start',
    'The connection to the agent ended',
    'reopen diffStory and check the technical details',
    'The run failed',
    'Technical details',
    'Recovering the why',
    'Designing the reading path',
    'Writing the story',
    'Checking the result',
    'Elapsed ',
    ' done',
    'working tree',
  ]) {
    assert.ok(js.includes(text), `bundle should contain ${JSON.stringify(text)}`);
  }

  // The a11y contract, as it actually ships. Exactly one polite live region,
  // one opted-out timer, one alert.
  assert.equal(countOf(js, '"aria-live":"polite"'), 1);
  assert.equal(countOf(js, '"aria-live":"off"'), 1);
  assert.equal(countOf(js, 'role:"status"'), 1);
  assert.equal(countOf(js, 'role:"timer"'), 1);
  assert.equal(countOf(js, 'role:"alert"'), 1);
  assert.ok(!js.includes('"aria-live":"assertive"'), 'nothing in this panel interrupts');

  // The `>>` guard, in shipped code.
  assert.ok(js.includes('indexOf(">>")'), 'the echo guard must survive minification');

  // The panel takes its endpoint from the host; hard-coding one here would mean
  // story repair and story generation could not share it.
  assert.ok(!js.includes('/api/generate'), 'the URL is the caller\'s to choose');
  assert.ok(!js.includes('/api/story/repair'));
});
