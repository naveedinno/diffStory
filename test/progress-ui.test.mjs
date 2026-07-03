// Unit tests for the shared progress panel string builders. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressPanelStyles, progressPanelMarkup, progressPanelScript } from '../dist/progress-ui.js';

test('markup exposes the plan-centric regions for both variants', () => {
  for (const variant of ['inline', 'floating']) {
    const m = progressPanelMarkup(variant);
    assert.match(m, /ds-pp-title/);
    assert.match(m, /ds-pp-agent/);
    assert.match(m, /ds-pp-repo/);
    assert.match(m, /ds-pp-plan/);
    assert.match(m, /ds-pp-now/);
    assert.match(m, /ds-pp-live/);
    assert.match(m, /ds-pp-raw/);
    assert.match(m, /data-pp-stop/);
    assert.match(m, /data-pp-close/);
    assert.match(m, new RegExp(`data-variant="${variant}"`));
    assert.match(m, /ds-pp-miles/);
    assert.match(m, /ds-pp-note/);
    // The old noisy regions are gone.
    assert.doesNotMatch(m, /ds-pp-timeline/);
    assert.doesNotMatch(m, /ds-pp-phase-label/);
  }
});

test('script defines ProgressPanel and handles every event type incl. plan', () => {
  const s = progressPanelScript();
  assert.match(s, /function ProgressPanel/);
  assert.match(s, /function runProgress/);
  for (const t of [
    'run_started', 'context', 'phase', 'plan', 'file', 'command',
    'activity', 'tool', 'text', 'heartbeat', 'warning', 'error', 'run_done',
  ]) {
    assert.ok(s.includes(`'${t}'`), `script should handle ${t}`);
  }
  assert.match(s, /blocked/);
  assert.match(s, /quiet/);
  assert.match(s, /if\(opts\.onEvent\)opts\.onEvent\(ev\)/);
  assert.match(s, /if\(opts\.onBlocked\)opts\.onBlocked\(err\|\|\{\}\)/);
  // Preserved public surface used by callers.
  assert.match(s, /showFoot/);
  assert.match(s, /ds-pp-reload|reload/);
  assert.match(s, /ds-pp-mile/);
  assert.match(s, /'narration'/);
  assert.ok(s.includes('Recovering the why'));
  assert.ok(s.includes('Designing the reading path'));
  assert.ok(s.includes('Writing the story'));
});

test('finished runs stop the milestone pulse', () => {
  // Failed/stopped runs leave an is-active milestone behind; the panel marks
  // the root is-finished so its dot stops pulsing forever.
  const css = progressPanelStyles();
  assert.match(css, /\.ds-pp\.is-finished \.ds-pp-mile-dot\{animation:none\}/);
  const s = progressPanelScript();
  assert.match(s, /setFinished\(true\)/);
  assert.match(s, /setFinished\(false\)/);
});

test("'>>' note lines never echo into the mono activity line", () => {
  const s = progressPanelScript();
  assert.ok(s.includes("ln.indexOf('>>')!==0"), 'text handler should skip >> lines');
});

test('styles target the panel and adapt to dark mode', () => {
  const css = progressPanelStyles();
  assert.match(css, /\.ds-pp\b/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /data-variant="stage"/);
  assert.match(css, /ds-pp-miles/);
  assert.match(css, /ds-pp-note/);
});
