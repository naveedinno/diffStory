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
});
