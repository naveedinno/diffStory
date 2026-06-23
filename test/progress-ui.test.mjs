// Unit tests for the shared progress panel string builders. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from '../dist/progress-ui.js';

test('markup exposes the panel regions for both variants', () => {
  for (const variant of ['inline', 'floating']) {
    const m = progressPanelMarkup(variant);
    assert.match(m, /ds-pp-title/);
    assert.match(m, /ds-pp-agent/);
    assert.match(m, /ds-pp-repo/);
    assert.match(m, /ds-pp-phase-label/);
    assert.match(m, /ds-pp-meta/);
    assert.match(m, /ds-pp-timeline/);
    assert.match(m, /ds-pp-raw/);
    assert.match(m, /data-pp-stop/);
    assert.match(m, /data-pp-close/);
    assert.match(m, new RegExp(`data-variant="${variant}"`));
  }
});

test('script defines ProgressPanel and handles every event type', () => {
  const s = progressPanelScript();
  assert.match(s, /function ProgressPanel/);
  assert.match(s, /function runProgress/);
  for (const t of [
    'run_started', 'context', 'phase', 'file', 'command',
    'activity', 'tool', 'text', 'heartbeat', 'warning', 'error', 'run_done',
  ]) {
    assert.ok(s.includes(`'${t}'`), `script should handle ${t}`);
  }
  assert.match(s, /blocked/);
  assert.match(s, /quiet/);
});

test('styles target the panel and adapt to dark mode', () => {
  const css = progressPanelStyles();
  assert.match(css, /\.ds-pp\b/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
});
