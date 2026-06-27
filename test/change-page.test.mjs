// Unit tests for the "Your change" screen renderer. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  const routed = renderChangePage(withChanges, { repoName: 'demo', routeBase: '/repo/demo' });
  assert.ok(routed.includes('href="/repo/demo/change?scope=uncommitted"'), 'scope tabs stay on the repo-named change route');
  assert.ok(routed.includes("var u='/repo/demo/change?base='"), 'manual compare stays on the repo-named change route');
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
  assert.ok(html.includes('id="cmpBase"') && html.includes('id="cmpHead"'), 'has base + head compare pickers');
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
