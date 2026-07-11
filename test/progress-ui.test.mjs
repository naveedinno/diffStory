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
    assert.match(m, /ds-pp-error-title/);
    assert.match(m, /ds-pp-error-detail/);
    assert.match(m, /role="alert" aria-atomic="true"/);
    assert.match(m, /ds-pp-raw/);
    assert.match(m, /<summary>Technical details<\/summary>/);
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
  const css = progressPanelStyles();
  assert.match(css, /\.ds-pp\.is-finished \.ds-pp-mile-dot\{animation:none\}/);
  const s = progressPanelScript();
  assert.match(s, /setFinished\(true\)/);
  assert.match(s, /setFinished\(false\)/);
});

test('failed runs show one human error and keep diagnostics collapsed', () => {
  const s = progressPanelScript();
  assert.match(s, /function showError\(err\)/);
  assert.match(s, /case 'error': showError\(ev\)/);
  assert.match(s, /lastError\.technicalDetail/);
  assert.match(s, /error:function\(\)\{return lastError;\}/);
  assert.match(s, /els\.details\.open=false/);
  assert.match(s, /FAIL=\{guided_review:'Generation failed'/);
  assert.match(s, /mileFailed\?'is-error':'is-active'/);
  assert.match(s, /root\.setAttribute\('aria-live','off'\)/);
  assert.match(s, /root\.setAttribute\('aria-live','polite'\)/);
  assert.doesNotMatch(s, /case 'error': appendRaw/);

  const css = progressPanelStyles();
  assert.match(css, /\.ds-pp-error\{/);
  assert.match(css, /\.ds-pp-foot\{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.ds-pp-secondary/);
  assert.match(css, /\.ds-pp-mile\.is-error/);
  assert.match(css, /\.ds-pp-live\.is-error\{color:var\(--pp-muted\)\}/);
  assert.match(css, /\.ds-pp-details>summary\{[^}]*color:var\(--pp-muted\)/);
  assert.match(css, /--pp-faint:#9a9aa3/);
  assert.match(css, /focus-visible/);
  assert.match(css, /@media \(max-width:520px\)\{[\s\S]*\.ds-pp-head\{display:grid/);
  assert.match(css, /\.ds-pp-agent\{[^}]*text-overflow:ellipsis/);
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
