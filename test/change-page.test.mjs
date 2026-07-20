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

/** The parsed diff the server hands the change page so it can render the hunks. */
const diffFiles = [
  {
    oldPath: 'src/api.ts',
    newPath: 'src/api.ts',
    status: 'modified',
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 2,
        lines: [
          { type: 'ctx', oldNo: 1, newNo: 1, content: 'const a = 1;' },
          { type: 'add', newNo: 2, content: 'const b = 2;' },
        ],
      },
    ],
  },
];

test('renderChangePage shows the change summary, base label, and review-viewer action', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo', diffFiles });
  assert.ok(html.includes('src/api.ts'));
  assert.ok(!html.includes('class="dv-file"'), 'does not render full diff hunks on the change summary');
  assert.ok(html.includes('Start review'), 'links into the real review workspace');
  assert.match(html, /aria-current="step"><i>01<\/i>Scope/, 'exposes the current lifecycle stage to assistive technology');
  assert.match(html, /<i>02<\/i>Read/, 'makes the full review lifecycle visible before opening the diff');
  assert.match(html, /\.review-path i\{[^}]*font-family:var\(--font-display\)[^}]*color:var\(--numeral-dim\)/, 'stage markers are Space Grotesk numerals, not circled badges');
  assert.equal((html.match(/<b aria-hidden="true"><\/b>/g) || []).length, 3, 'renders exactly three explicit connectors');
  assert.ok(html.includes('id="reloadBtn"') && html.includes('location.reload()'), 'has a wired reload control');
  assert.ok(html.includes('main (abc123)'));
  assert.ok(!html.includes('Generate guided review'), 'does not duplicate story generation on the change page');
  assert.ok(!html.includes('id="storyMode"'), 'story mode picker lives in the review page Story tab');
  assert.ok(html.includes('Single commit'), 'offers a single-commit scope');
  assert.ok(html.includes('Compare any refs'), 'offers arbitrary ref comparison');
  assert.ok(
    !html.includes('Current branch') && !html.includes('Branch commits') && !html.includes('Cross-branch commits'),
    'drops the redundant current-branch, branch-commits, and cross-branch cards',
  );
  assert.ok(html.includes('id="commitRef"'), 'has a commit picker/input');
  assert.ok(html.includes('id="cmpBase"') && html.includes('id="cmpHead"'), 'has one rev selector per compare side');
  assert.ok(!html.includes('id="cmpBaseRef"') && !html.includes('id="cmpHeadRef"'), 'drops the separate branch-vs-commit inputs');
  assert.ok(html.includes('<span>Base <i>older</i></span>') && html.includes('<span>Compare <i>newer</i></span>'), 'labels the sides by meaning, not position');
  assert.ok(!html.includes('<span>From</span>') && !html.includes('<span>To</span>'), 'does not use from/to labels');
  assert.ok(!html.includes('id="commitGo"') && !html.includes('Review commit'), 'single-commit scope auto-applies without a button');
  assert.ok(!html.includes('id="cmpGo"') && !html.includes('Compare refs'), 'compare scope auto-applies without a button');
  assert.ok(html.includes('data-picker="commit"'), 'uses the custom commit picker');
  assert.ok(html.includes('data-picker="base"') && html.includes('data-picker="head"'), 'uses one rev picker per compare side');
  assert.ok(!html.includes('data-picker="side-commit"'), 'no branch-scoped commit-pin pickers');
  assert.equal((html.match(/role="combobox"/g) || []).length, 3, 'exposes every ref field as a combobox');
  assert.equal((html.match(/aria-controls="refPicker"/g) || []).length, 3, 'binds every combobox to the shared listbox');
  assert.equal((html.match(/aria-expanded="false"/g) || []).length >= 5, true, 'starts disclosure and combobox state collapsed');
  assert.match(html, /id="refPicker" role="listbox" aria-label="Available git references"/);
  assert.ok(!html.includes('<datalist'), 'does not rely on the native datalist menu');
  assert.match(html, />History<\/a>/, 'keeps saved review history as a secondary action');
  assert.doesNotMatch(html, />Review sessions<\/a>/);
  assert.match(html, /aria-controls="commitPanel" aria-expanded="false"/);
  assert.match(html, /aria-controls="comparePanel" aria-expanded="false"/);
  assert.match(html, /\.sopts\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:6px\}/, 'keeps scope filters compact on mobile');
  assert.match(html, /\.review-path \.active\{gap:7px;font-size:10\.5px\}/, 'keeps the active lifecycle stage named on mobile');
  const routed = renderChangePage(withChanges, { repoName: 'demo', routeBase: '/repo/demo', diffFiles });
  assert.ok(routed.includes('href="/repo/demo/change?scope=uncommitted"'), 'scope tabs stay on the repo-named change route');
  assert.ok(routed.includes("'/repo/demo/change?scope=commit&commit='"), 'single commit stays on the repo-named change route');
  assert.ok(routed.includes("'/repo/demo/change?base='"), 'auto compare stays on the repo-named change route');
  assert.ok(routed.includes('href="/repo/demo/diff"'), 'summary opens the repo-named diff viewer');
});

test('ref combobox supports active-descendant keyboard selection and dismissal', async () => {
  class FakeEl {
    constructor(attrs = {}) {
      this.attrs = { ...attrs }; this.id = attrs.id || ''; this.children = []; this.listeners = {};
      this.hidden = !!attrs.hidden; this.style = {}; this.value = attrs.value ?? ''; this.textContent = '';
      this.className = ''; this.classList = { add() {}, remove() {} };
    }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    removeAttribute(name) { delete this.attrs[name]; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    contains(target) { return target === this || this.children.includes(target); }
    querySelectorAll(selector) { return selector === '[role="option"]' ? this.children.filter((child) => child.attrs.role === 'option') : []; }
    dispatchEvent(ev) { (this.listeners[ev.type] || []).forEach((fn) => fn(ev)); }
    getBoundingClientRect() { return { left: 10, right: 610, top: 20, bottom: 54, width: 600, height: 34 }; }
    get offsetHeight() { return 140; }
    scrollIntoView() { this.scrolled = true; }
  }

  const html = renderChangePage(withChanges, { repoName: 'demo', routeBase: '/repo/demo', active: 'commit', head: 'HEAD' });
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1]).find((candidate) => candidate.includes('function syncActiveOption'));
  assert.ok(script, 'has the combobox controller');

  const picker = new FakeEl({ id: 'refPicker', hidden: true });
  const input = new FakeEl({ id: 'commitRef', 'data-picker': 'commit', value: 'HEAD', 'aria-expanded': 'false' });
  const panel = new FakeEl({ 'data-panel': 'commit' });
  const elements = { refPicker: picker, commitRef: input };
  const context = {
    console,
    setTimeout,
    Event: class Event { constructor(type) { this.type = type; } },
    fetch: async () => ({ json: async () => ({
      current: 'main', branches: [], commits: [
        { sha: 'abc1234', subject: 'First commit' },
        { sha: 'def5678', subject: 'Second commit' },
      ],
    }) }),
    location: { href: '', pathname: '/repo/demo/change', search: '?scope=commit&commit=HEAD' },
    window: { innerWidth: 1024, innerHeight: 768, addEventListener() {} },
    document: {
      activeElement: input,
      getElementById: (id) => elements[id] ?? null,
      querySelector: () => null,
      querySelectorAll: (selector) => selector === '[data-panel]' ? [panel] : selector === '[data-picker]' ? [input] : [],
      createElement: () => new FakeEl(), addEventListener() {},
    },
  };
  vm.runInNewContext(script, context);
  input.listeners.focus[0]();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(input.attrs['aria-expanded'], 'true');
  assert.equal(picker.children[0].attrs.role, 'option');
  assert.equal(picker.children[0].attrs['aria-selected'], 'true');
  assert.equal(input.attrs['aria-activedescendant'], picker.children[0].id);

  const key = (name) => input.listeners.keydown[0]({ key: name, preventDefault() {}, stopPropagation() {} });
  key('ArrowDown');
  assert.equal(picker.children[1].attrs['aria-selected'], 'true');
  assert.equal(input.attrs['aria-activedescendant'], picker.children[1].id);
  key('End');
  assert.equal(input.attrs['aria-activedescendant'], picker.children[2].id);
  key('Home');
  assert.equal(input.attrs['aria-activedescendant'], picker.children[0].id);
  key('End'); key('Enter');
  assert.equal(input.value, 'def5678');
  assert.equal(context.location.href, '/repo/demo/change?scope=commit&commit=def5678');
  assert.equal(input.attrs['aria-expanded'], 'false');
  assert.equal(input.attrs['aria-activedescendant'], undefined);

  context.location.href = '';
  input.listeners.focus[0]();
  await new Promise((resolve) => setImmediate(resolve));
  key('Escape');
  assert.equal(picker.hidden, true);
  assert.equal(input.attrs['aria-expanded'], 'false');

  input.listeners.focus[0]();
  await new Promise((resolve) => setImmediate(resolve));
  const outside = new FakeEl({ id: 'afterRefPicker' });
  context.document.activeElement = outside;
  input.listeners.focusout[0]({ relatedTarget: outside });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(picker.hidden, true, 'tabbing away closes the listbox');
  assert.equal(input.attrs['aria-expanded'], 'false');
  assert.equal(input.attrs['aria-activedescendant'], undefined);
});

test('renderChangePage keeps generated output out of the primary reading list', () => {
  const sum = {
    base: 'HEAD', baseLabel: 'Working tree', totalChanged: 2, hasChanges: true,
    files: [
      { path: 'src/app.ts', added: 4, removed: 1 },
      { path: 'dist/app.js', added: 9, removed: 3 },
    ],
  };
  const html = renderChangePage(sum, { repoName: 'demo' });
  assert.match(html, /<b>1<\/b> review file <span>· 1 generated<\/span>/);
  assert.match(html, /<details class="generated"><summary><span>Generated output<\/span><span>1 file/);
  assert.match(html, /aria-label="Start review of 2 files"/);
});

test('renderChangePage escapes file paths and shows an empty-change guard', () => {
  const html = renderChangePage(
    { base: 'x', baseLabel: 'x', files: [{ path: '<script>x', added: 1, removed: 0 }], totalChanged: 1, hasChanges: true },
    {
      repoName: 'd',
      diffFiles: [
        {
          oldPath: '<script>x',
          newPath: '<script>x',
          status: 'added',
          hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, lines: [{ type: 'add', newNo: 1, content: 'x' }] }],
        },
      ],
    },
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
  assert.ok(html.includes('data-panel="compare"'), 'has a dedicated compare panel');
  assert.ok(!html.includes('data-panel="cross"') && !html.includes('data-panel="range"'), 'no longer renders the cross/range panels');
  assert.ok(html.includes('.sopt.is-open'), 'has a distinct panel-open state separate from the selected scope');
  assert.ok(html.includes("classList.remove('is-open')"), 'opening a panel clears only the open-state marker');
  assert.ok(html.includes("setAttribute('aria-expanded','false')"), 'keeps disclosure state in sync for assistive technology');
  assert.ok(html.includes("setAttribute('aria-expanded','true')"), 'announces the open scope panel');
  assert.ok(!html.includes("classList.remove('on')"), 'opening a picker panel does not lie about the URL-backed selected scope');
  assert.ok(
    html.includes('.refpanel,.refpanel[data-panel="commit"],.refpanel[data-panel="compare"]{grid-template-columns:1fr}'),
    'commit and compare pickers stack on mobile',
  );
});

test('compare panel prefills from the active scope and defaults the right side to the working tree', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo', active: 'compare', base: 'main' });
  assert.match(html, /id="cmpBase"[^>]+value="main"/, 'base side shows the resolved base rev');
  assert.match(html, /id="cmpHead"[^>]+value="Working tree"[^>]+data-worktree="1"/, 'compare side defaults to the working tree');

  const other = renderChangePage(withChanges, { repoName: 'demo', active: 'uncommitted', base: 'HEAD' });
  assert.match(other, /id="cmpBase"[^>]+value=""/, 'non-compare scopes do not leak bookkeeping revs into the base input');
});

test('compare panel repopulates both sides straight from base/head after navigation', () => {
  const html = renderChangePage(withChanges, {
    repoName: 'demo',
    active: 'compare',
    base: '42dbc69',
    head: 'c4d0151',
  });

  assert.match(html, /id="cmpBase"[^>]+value="42dbc69"/, 'base side keeps the chosen rev');
  assert.match(html, /id="cmpHead"[^>]+value="c4d0151"/, 'compare side keeps the chosen rev');
  assert.doesNotMatch(html, /id="cmpHead"[^>]+data-worktree="1"/, 'an explicit head does not render as worktree');
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
          { sha: 'abc1234', subject: 'First commit', committedAtLabel: '2026-06-30 14:34', committedAtRelative: '2h ago' },
          { sha: 'def5678', subject: 'Second commit', committedAtLabel: '2026-06-29 09:12', committedAtRelative: '1d ago' },
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
  const metas = picker.children.map((row) => row.children[1].textContent);
  assert.equal(metas[1], '2026-06-30 14:34 · 2h ago · First commit');
  assert.equal(metas[2], '2026-06-29 09:12 · 1d ago · Second commit');
});

test('picker rows select refs through the normal click path', async () => {
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
    removeAttribute(name) {
      delete this.attrs[name];
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
    dispatchEvent(ev) {
      (this.listeners[ev.type] || []).forEach((fn) => fn(ev));
    }
    getBoundingClientRect() {
      return { left: 10, right: 610, top: 20, bottom: 54, width: 600, height: 34 };
    }
    get offsetHeight() {
      return 140;
    }
  }

  const html = renderChangePage(withChanges, { repoName: 'demo', routeBase: '/repo/demo', active: 'commit', head: 'HEAD' });
  const pickerScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((script) => script.includes('function filteredOptions'));
  assert.ok(pickerScript, 'has the embedded ref picker script');

  const picker = new FakeEl({ id: 'refPicker', hidden: true });
  const commitInput = new FakeEl({ id: 'commitRef', 'data-picker': 'commit', value: 'HEAD' });
  const commitPanel = new FakeEl({ 'data-panel': 'commit' });
  const elements = { refPicker: picker, commitRef: commitInput };
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
          { sha: 'abc1234', subject: 'First commit', committedAtLabel: '2026-06-30 14:34' },
          { sha: 'def5678', subject: 'Second commit', committedAtLabel: '2026-06-29 09:12' },
        ],
      }),
    }),
    location: { href: '', pathname: '/repo/demo/change', search: '?scope=commit&commit=HEAD' },
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
      addEventListener() {},
    },
  };

  vm.runInNewContext(pickerScript, context);
  commitInput.listeners.focus[0]();
  await new Promise((resolve) => setImmediate(resolve));

  const row = picker.children.find((child) => child.attrs['data-value'] === 'def5678');
  assert.ok(row, 'renders the commit row');
  assert.ok(row.listeners.click?.length, 'picker rows use a click handler for selection');
  row.listeners.click[0]({ preventDefault() {} });

  assert.equal(commitInput.value, 'def5678');
assert.equal(context.location.href, '/repo/demo/change?scope=commit&commit=def5678');
}
);

test('base rev picker offers branches then commits, without worktree pseudo-rows', async () => {
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

  const html = renderChangePage(withChanges, { repoName: 'demo', active: 'compare', base: 'main' });
  const pickerScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((script) => script.includes('function filteredOptions'));
  assert.ok(pickerScript, 'has the embedded ref picker script');

  const picker = new FakeEl({ id: 'refPicker', hidden: true });
  const cmpBase = new FakeEl({ id: 'cmpBase', 'data-picker': 'base', value: '' });
  const comparePanel = new FakeEl({ 'data-panel': 'compare' });
  const elements = { refPicker: picker, cmpBase };
  const context = {
    console,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    fetch: async () => ({
      json: async () => ({
        current: 'HEAD',
        branches: [
          { name: 'main', kind: 'local' },
          { name: 'origin/main', kind: 'remote' },
          { name: 'origin/feat/scope-selector', kind: 'remote' },
        ],
        commits: [
          { sha: '1ce5906', subject: 'Spec: collapse scope picker' },
          { sha: '42dbc69', subject: 'Previous scope selector change' },
        ],
      }),
    }),
    location: { href: '' },
    window: { innerWidth: 1024, innerHeight: 768, addEventListener() {} },
    document: {
      getElementById: (id) => elements[id] ?? null,
      querySelector: () => null,
      querySelectorAll: (selector) => {
        if (selector === '[data-panel]') return [comparePanel];
        if (selector === '[data-picker]') return [cmpBase];
        return [];
      },
      createElement: () => new FakeEl(),
      addEventListener() {},
    },
  };

  vm.runInNewContext(pickerScript, context);
  cmpBase.listeners.focus[0]();
  await new Promise((resolve) => setImmediate(resolve));

  assert.ok(cmpBase.listeners.click?.length, 'rev inputs reopen the picker on click');
  const values = picker.children.map((row) => row.attrs['data-value']);
  assert.deepEqual(values, ['main', 'origin/main', 'origin/feat/scope-selector', '1ce5906', '42dbc69'], 'branches first, then recent commits');
  assert.ok(!values.includes('__WORKTREE__'), 'the base side cannot be the working tree');
});

test('compare head picker leads with the working tree, then branches and commits', async () => {
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
    removeAttribute(name) {
      delete this.attrs[name];
    }
    addEventListener(name, fn) {
      (this.listeners[name] ||= []).push(fn);
    }
    dispatchEvent(ev) {
      (this.listeners[ev.type] || []).forEach((fn) => fn(ev));
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

  const html = renderChangePage(withChanges, { repoName: 'demo', active: 'compare', base: 'main', head: 'feature/demo' });
  const pickerScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((script) => script.includes('function filteredOptions'));
  assert.ok(pickerScript, 'has the embedded ref picker script');

  const picker = new FakeEl({ id: 'refPicker', hidden: true });
  const cmpBase = new FakeEl({ id: 'cmpBase', 'data-picker': 'base', value: 'main' });
  const cmpHead = new FakeEl({ id: 'cmpHead', 'data-picker': 'head', value: '' });
  const comparePanel = new FakeEl({ 'data-panel': 'compare' });
  const elements = { refPicker: picker, cmpBase, cmpHead };
  const fetched = [];
  const context = {
    console,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    fetch: async (url) => {
      fetched.push(String(url));
      return {
        json: async () => ({
          current: 'main',
          branches: [{ name: 'main', kind: 'local' }, { name: 'feature/demo', kind: 'local' }],
          commits: [{ sha: 'all9999', subject: 'All branch commit', committedAtLabel: '2026-06-29 09:12' }],
        }),
      };
    },
    location: { href: '' },
    window: { innerWidth: 1024, innerHeight: 768, addEventListener() {} },
    document: {
      getElementById: (id) => elements[id] ?? null,
      querySelector: () => null,
      querySelectorAll: (selector) => {
        if (selector === '[data-panel]') return [comparePanel];
        if (selector === '[data-picker]') return [cmpBase, cmpHead];
        return [];
      },
      createElement: () => new FakeEl(),
      addEventListener() {},
    },
  };

  vm.runInNewContext(pickerScript, context);
  cmpHead.listeners.focus[0]();
  await new Promise((resolve) => setImmediate(resolve));

  const values = picker.children.map((row) => row.attrs['data-value']);
  const labels = picker.children.map((row) => row.children[0].textContent);
  assert.deepEqual(fetched, ['/api/refs'], 'a single unscoped fetch feeds both sides');
  assert.equal(values[0], '__WORKTREE__');
  assert.equal(labels[0], 'Working tree');
  assert.deepEqual(values.slice(1), ['main', 'feature/demo', 'all9999'], 'branches then recent commits follow the worktree row');

  const worktreeRow = picker.children[0];
  worktreeRow.listeners.click[0]({ preventDefault() {} });
  assert.equal(cmpHead.value, 'Working tree');
  assert.equal(cmpHead.attrs['data-worktree'], '1');
});

test('scope inputs automatically navigate so the summary refreshes', () => {
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
    removeAttribute(name) {
      delete this.attrs[name];
    }
    addEventListener(name, fn) {
      (this.listeners[name] ||= []).push(fn);
    }
    dispatchEvent(ev) {
      (this.listeners[ev.type] || []).forEach((fn) => fn(ev));
    }
    contains(target) {
      return target === this || this.children.includes(target);
    }
    replaceChildren(...children) {
      this.children = children;
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    getBoundingClientRect() {
      return { left: 10, right: 610, top: 20, bottom: 54, width: 600, height: 34 };
    }
    get offsetHeight() {
      return 140;
    }
  }

  const html = renderChangePage(withChanges, { repoName: 'demo', routeBase: '/repo/demo', active: 'commit', head: 'old' });
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .find((candidate) => candidate.includes('function scheduleNavTo'));
  assert.ok(script, 'has the embedded auto-refresh script');

  const commitRef = new FakeEl({ id: 'commitRef', 'data-picker': 'commit', value: 'old' });
  const cmpBase = new FakeEl({ id: 'cmpBase', 'data-picker': 'base', value: 'main' });
  const cmpHead = new FakeEl({ id: 'cmpHead', 'data-picker': 'head', value: 'Working tree', 'data-worktree': '1' });
  const elements = {
    refPicker: new FakeEl({ id: 'refPicker', hidden: true }),
    commitRef,
    cmpBase,
    cmpHead,
  };
  const context = {
    console,
    Event: class Event {
      constructor(type) {
        this.type = type;
      }
    },
    fetch: async () => ({ json: async () => ({ branches: [], commits: [] }) }),
    setTimeout: (fn) => {
      fn();
      return 1;
    },
    clearTimeout() {},
    location: { href: '', pathname: '/repo/demo/change', search: '?scope=commit&commit=old' },
    window: { innerWidth: 1024, innerHeight: 768, addEventListener() {} },
    document: {
      getElementById: (id) => elements[id] ?? null,
      querySelector: () => null,
      querySelectorAll: (selector) => {
        if (selector === '[data-panel]') return [new FakeEl({ 'data-panel': 'commit' })];
        if (selector === '[data-picker]') return [commitRef, cmpBase, cmpHead];
        return [];
      },
      createElement: () => new FakeEl(),
      addEventListener() {},
    },
  };

  vm.runInNewContext(script, context);

  commitRef.value = 'feature/demo';
  commitRef.dispatchEvent(new context.Event('change'));
  assert.equal(context.location.href, '/repo/demo/change?scope=commit&commit=feature%2Fdemo');

  context.location.href = '';
  context.location.search = '?base=main';
  cmpBase.value = '42dbc69';
  cmpBase.dispatchEvent(new context.Event('change'));
  assert.equal(context.location.href, '/repo/demo/change?base=42dbc69', 'base rev goes straight into the base param');

  context.location.href = '';
  context.location.search = '?base=main';
  cmpBase.value = 'main';
  cmpHead.value = 'feature/demo';
  cmpHead.removeAttribute('data-worktree');
  cmpHead.dispatchEvent(new context.Event('change'));
  assert.equal(context.location.href, '/repo/demo/change?base=main&head=feature%2Fdemo');

  context.location.href = '';
  context.location.search = '?base=main&head=feature%2Fdemo';
  cmpHead.value = 'Working tree';
  cmpHead.setAttribute('data-worktree', '1');
  cmpHead.dispatchEvent(new context.Event('change'));
  assert.equal(context.location.href, '/repo/demo/change?base=main', 'working tree means no head param');
});

test('renderChangePage shows a notice banner and the agent + model picker', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo', notice: 'steps must be a non-empty array' });
  assert.ok(html.includes('class="notice"') && html.includes('steps must be a non-empty array'), 'shows the notice');
  assert.ok(html.includes('generate a fresh story from the Story tab'), 'points generation to the review page');
  assert.ok(!html.includes('id="agentSel"') && !html.includes('id="modelSel"'), 'does not render story controls here');
});

test('change page does not embed the generation progress panel', () => {
  const html = renderChangePage(
    { hasChanges: true, baseLabel: 'main', files: [{ path: 'a.ts', added: 1, removed: 0 }] },
    { repoName: 'r', base: '', head: '', scopeLabel: 'Uncommitted', active: 'uncommitted' },
  );
  assert.doesNotMatch(html, /ds-pp-plan/);
  assert.doesNotMatch(html, /function ProgressPanel/);
  assert.doesNotMatch(html, /new ProgressPanel|ProgressPanel\(/);
  assert.doesNotMatch(html, /run_done/);
});

test('change page draws from the shared --app-* tokens', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo', diffFiles });
  assert.match(html, /--app-bg:/);
  assert.match(html, /--elev:var\(--app-elev\)/);
});

test('change page routes its Thread Path through content-free bands', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo', diffFiles });
  assert.match(html, /class="ds-atmosphere-thread ds-scope-thread" viewBox="0 0 900 240"/);
  assert.match(html, /d="M-30 38H870c26 0 26 62 0 62H10c-26 0-26 126 0 126H930"/);
  assert.match(html, /\.wrap>\.ds-thread-layer\{top:-34px;bottom:auto;height:240px;opacity:\.78\}/);
  assert.match(html, /max-width:600px\)\{\.wrap\{[^}]+\}\.wrap>\.ds-thread-layer\{top:-51px\}/);
});

test('change page unfolds scope controls from their source and supports reduced motion', () => {
  const html = renderChangePage(withChanges, { repoName: 'demo', diffFiles });
  assert.match(html, /\.refpanel:not\(\[hidden\]\)\{animation:change-panel-in var\(--motion-duration-spatial\)/);
  assert.match(html, /\.refpicker:not\(\[hidden\]\)\{animation:change-picker-in var\(--motion-duration-ui\)/);
  assert.match(html, /prefers-reduced-motion:reduce\)\{\.sopt,\.openreview\{transition:none\}/);
});
