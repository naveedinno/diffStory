// Unit tests for the "Your change" screen renderer. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { renderChangePage } from '../dist/change-page.js';

const withChanges = {
  base: 'abc123',
  baseLabel: 'main (abc123)',
  files: [{ path: 'src/api.ts', added: 12, removed: 3 }],
  totalChanged: 1,
  hasChanges: true,
};

test('renderChangePage shows the change, the base label, and the Generate action', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo' });
  assert.ok(html.includes('src/api.ts'));
  assert.ok(html.includes('main (abc123)'));
  assert.ok(html.includes('Generate guided review'));
  assert.ok(html.toLowerCase().includes('nothing starts until you click'));
  assert.ok(html.includes('id="storyMode"'), 'has a story mode picker');
  assert.ok(html.includes('value="guided" selected'), 'defaults to guided mode');
  assert.ok(html.includes('value="detailed"'), 'offers detailed correctness mode');
  assert.ok(html.includes('mode:modeSel?modeSel.value:undefined'), 'sends the selected story mode');
  assert.ok(html.includes('Single commit'), 'offers a single-commit scope');
  assert.ok(html.includes('Cross-branch commits'), 'offers commits from two different branches as a first-class scope');
  assert.ok(html.includes('Compare any refs'), 'offers arbitrary ref comparison');
  assert.ok(html.includes('id="commitRef"'), 'has a commit picker/input');
  assert.ok(html.includes('id="crossBaseBranch"') && html.includes('id="crossHeadCommit"'), 'has branch + commit controls for both sides');
  assert.ok(html.includes('id="cmpBase"') && html.includes('id="cmpHead"'), 'has from/to compare inputs');
  assert.ok(html.includes('data-picker="branch"'), 'uses the custom branch picker');
  assert.ok(html.includes('data-picker="ref"'), 'uses the custom ref picker');
  assert.ok(!html.includes('<datalist'), 'does not rely on the native datalist menu');
  const routed = renderChangePage(withChanges, { repoName: 'demo', routeBase: '/repo/demo' });
  assert.ok(routed.includes('href="/repo/demo/change?scope=uncommitted"'), 'scope tabs stay on the repo-named change route');
  assert.ok(routed.includes("'/repo/demo/change?scope=commit&commit='"), 'single commit stays on the repo-named change route');
  assert.ok(routed.includes("'/repo/demo/change?base='"), 'manual compare stays on the repo-named change route');
  assert.ok(routed.includes("location.href='/repo/demo/review?story=story.json'"), 'generation success opens the repo-named review route');
});

test('renderChangePage escapes file paths and shows an empty-change guard', () => {
  const html = renderChangePage(
    { base: 'x', baseLabel: 'x', files: [{ path: '<script>x', added: 1, removed: 0 }], totalChanged: 1, hasChanges: true },
    { repoName: 'd' },
  );
  assert.ok(html.includes('&lt;script&gt;x'));
  assert.ok(!html.includes('<script>x'));

  const empty = renderChangePage(
    { base: 'x', baseLabel: 'main', files: [], totalChanged: 0, hasChanges: false },
    { repoName: 'd' },
  );
  assert.ok(empty.toLowerCase().includes('nothing to review'));
  assert.ok(!empty.includes('Generate guided review'));
});

test('renderChangePage shows the human scope label and highlights the active segment', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo', scopeLabel: 'Uncommitted changes', active: 'uncommitted' });
  assert.ok(html.includes('Uncommitted changes'), 'shows the human scope label');
  assert.ok(html.includes('class="sopt on"'), 'marks the active segment');
  assert.ok(html.includes('data-panel="commit"'), 'has a dedicated commit panel');
  assert.ok(html.includes('data-panel="cross"'), 'has a dedicated cross-branch commit panel');
  assert.ok(html.includes('data-panel="compare"'), 'has a dedicated compare panel');
  assert.ok(html.includes('.refpanel,.refpanel[data-panel="commit"]{grid-template-columns:1fr}'), 'commit picker stacks on mobile');
});

test('commit picker shows commits when the current value is HEAD', async () => {
  class FakeEl {
    constructor(attrs = {}) {
      this.attrs = { ...attrs };
      this.children = [];
      this.listeners = {};
      this.hidden = !!attrs.hidden;
      this.style = {};
      this.value = attrs.value ?? '';
      this.textContent = '';
      this.className = '';
      this.classList = { add() {}, remove() {} };
    }
    getAttribute(name) {
      return this.attrs[name] ?? null;
    }
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    }
    addEventListener(name, fn) {
      (this.listeners[name] ||= []).push(fn);
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    replaceChildren(...children) {
      this.children = children;
    }
    contains(target) {
      return target === this || this.children.includes(target);
    }
    getBoundingClientRect() {
      return { left: 10, right: 610, top: 20, bottom: 54, width: 600, height: 34 };
    }
    get offsetHeight() {
      return 140;
    }
  }

  const html = renderChangePage(withChanges, { repoName: 'demo', active: 'commit', head: 'HEAD' });
  const pickerScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((script) => script.includes('function filteredOptions'));
  assert.ok(pickerScript, 'has the embedded ref picker script');

  const picker = new FakeEl({ id: 'refPicker', hidden: true });
  const commitInput = new FakeEl({ id: 'commitRef', 'data-picker': 'commit', value: 'HEAD' });
  const commitPanel = new FakeEl({ 'data-panel': 'commit' });
  const elements = { refPicker: picker, commitRef: commitInput };
  const documentListeners = {};
  const context = {
    console,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    fetch: async () => ({
      json: async () => ({
        current: 'main',
        branches: [],
        commits: [
          { sha: 'abc1234', subject: 'First commit' },
          { sha: 'def5678', subject: 'Second commit' },
        ],
      }),
    }),
    location: { href: '' },
    window: { innerWidth: 1024, innerHeight: 768, addEventListener() {} },
    document: {
      getElementById: (id) => elements[id] ?? null,
      querySelector: () => null,
      querySelectorAll: (selector) => {
        if (selector === '[data-panel]') return [commitPanel];
        if (selector === '[data-picker]') return [commitInput];
        return [];
      },
      createElement: () => new FakeEl(),
      addEventListener: (name, fn) => {
        (documentListeners[name] ||= []).push(fn);
      },
    },
  };

  vm.runInNewContext(pickerScript, context);
  commitInput.listeners.focus[0]();
  await new Promise((resolve) => setImmediate(resolve));

  const values = picker.children.map((row) => row.attrs['data-value']);
  assert.deepEqual(values.slice(0, 3), ['HEAD', 'abc1234', 'def5678']);
});

test('renderChangePage shows a notice banner and the agent + model picker', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo', notice: 'steps must be a non-empty array' });
  assert.ok(html.includes('class="notice"') && html.includes('steps must be a non-empty array'), 'shows the notice');
  assert.ok(html.includes('id="agentSel"') && html.includes('id="modelSel"'), 'has the agent + model dropdowns');
  assert.ok(html.includes('Update skills'), 'has skill update action');
  assert.ok(html.includes('/api/skills/update'), 'calls the skill update endpoint');
});

test('change page embeds the shared progress panel and drives ProgressPanel', () => {
  const html = renderChangePage(
    { hasChanges: true, baseLabel: 'main', files: [{ path: 'a.ts', added: 1, removed: 0 }] },
    { repoName: 'r', base: '', head: '', scopeLabel: 'Uncommitted', active: 'uncommitted' },
  );
  assert.match(html, /ds-pp-plan/);
  assert.match(html, /function ProgressPanel/);
  assert.match(html, /new ProgressPanel|ProgressPanel\(/);
  assert.match(html, /run_done/);
});
