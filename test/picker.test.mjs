import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPicker } from '../dist/picker.js';

test('folder browser exposes live filtering and keyboard navigation', () => {
  const html = renderPicker([], '/Users/test', Date.now());

  assert.match(html, /id="fsSearch"[^>]+type="search"|type="search"[^>]+id="fsSearch"/);
  assert.match(html, /aria-label="Filter folders in this location"/);
  assert.match(html, /id="fsSearchStatus"[^>]+aria-live="polite"/);
  assert.match(html, /fsSearch\.addEventListener\('input'/);
  assert.match(html, /e\.key==='ArrowDown'\|\|e\.key==='ArrowUp'/);
  assert.match(html, /e\.key==='Enter'&&selectedIndex>=0/);
  assert.match(html, /No folders match/);
  assert.match(html, /fsSearch\.focus\(\)/);
  assert.match(html, /if\(modalTrigger&&modalTrigger\.focus\)modalTrigger\.focus\(\)/);
  assert.match(html, /if\(sk\.legacyInstalled\)/);
  assert.match(html, /review-tour was renamed to diffstory-storyteller/);
});
