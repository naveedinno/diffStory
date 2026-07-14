import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPicker } from '../dist/picker.js';

test('folder browser exposes live filtering and keyboard navigation', () => {
  const html = renderPicker([], '/Users/test', Date.now());

  assert.match(html, /id="fsSearch"[^>]+type="search"|type="search"[^>]+id="fsSearch"/);
  assert.match(html, /aria-label="Filter folders in this location"/);
  assert.match(html, /id="fsSearch"[^>]+role="combobox"[^>]+aria-autocomplete="list"[^>]+aria-haspopup="listbox"[^>]+aria-expanded="false"/);
  assert.match(html, /id="fslist" role="listbox" aria-label="Folders in this location"/);
  assert.match(html, /id="fsSearchStatus"[^>]+aria-live="polite"/);
  assert.match(html, /fsSearch\.addEventListener\('input'/);
  assert.match(html, /e\.key==='ArrowDown'\|\|e\.key==='ArrowUp'/);
  assert.match(html, /e\.key==='Home'\|\|e\.key==='End'/);
  assert.match(html, /e\.key==='Enter'&&selectedIndex>=0/);
  assert.match(html, /row\.tabIndex=-1;row\.setAttribute\('role','option'\);row\.setAttribute\('aria-selected'/);
  assert.match(html, /row\.setAttribute\('aria-selected',selected\?'true':'false'\)/);
  assert.match(html, /fsSearch\.setAttribute\('aria-activedescendant',rows\[selectedIndex\]\.id\)/);
  assert.match(html, /fsSearchStatus\.textContent='Loading folders…'/);
  assert.match(html, /fsSearchStatus\.textContent='Could not read that folder\.'/);
  assert.match(html, /el\(p\.cur\?'span':'button','crumb',p\.label\)/);
  assert.match(html, /b\.setAttribute\('aria-current','location'\)/);
  assert.match(html, /\.crumb:not\(\.cur\):hover/);
  assert.match(html, /No folders match/);
  assert.match(html, /fsSearch\.focus\(\)/);
  assert.match(html, /if\(restore&&restore\.focus\)restore\.focus\(\)/);
  assert.match(html, /if\(sk\.legacyInstalled\)/);
  assert.match(html, /review-tour was renamed to diffstory-storyteller/);
  assert.match(html, /Open a repository to review its current change/);
  assert.doesNotMatch(html, /class="steps"|Choose the exact change|Approve only when the thread is clear/);
  assert.ok(html.includes("+'/change'"), 'falls back to the scope page when the server omits a route');
  assert.match(html, /id="quickAddBtn"[^>]+aria-label="Open repository"/, 'keeps the icon-only mobile action named');
  assert.doesNotMatch(html, /id="chooseBtn"/, 'does not repeat the folder-browser action below the path field');
  assert.match(html, /\.remove-btn::after\{content:"";position:absolute;inset:-5px\}/, 'keeps the compact mobile remove action easy to tap');
});

test('folder browser enforces its aria-modal contract and restores focus', () => {
  const html = renderPicker([], '/Users/test', Date.now());

  assert.match(html, /<main class="wrap" id="pickerMain">/);
  assert.match(html, /id="scrim" role="dialog" aria-modal="true"[^>]+tabindex="-1" hidden/);
  assert.match(html, /function setModalBackground\(blocked\)/);
  assert.match(html, /setAttribute\('inert',''\);modalBackground\.setAttribute\('aria-hidden','true'\)/);
  assert.match(html, /removeAttribute\('inert'\);modalBackground\.removeAttribute\('aria-hidden'\)/);
  assert.match(html, /function modalFocusables\(\)/);
  assert.match(html, /id="fsClear"[^>]+hidden>/, 'the CSS-hidden clear action is also removed from focus order');
  assert.match(html, /\.fsclear\[hidden\]\{display:none\}/);
  assert.match(html, /fsClear\.hidden=!hasFilter/);
  assert.match(html, /node\.getAttribute\('tabindex'\)!=='-1'/, 'composite listbox options are excluded from the modal tab ring');
  assert.match(html, /function trapModalFocus\(e\)/);
  assert.match(html, /if\(e\.key!=='Tab'\)return/);
  assert.match(html, /e\.shiftKey&&\(active===first\|\|!scrim\.contains\(active\)\)/);
  assert.match(html, /!e\.shiftKey&&\(active===last\|\|!scrim\.contains\(active\)\)/);
  assert.match(html, /if\(e\.key==='Escape'\)\{e\.preventDefault\(\);closeModal\(\);return;\}/);
  assert.match(html, /scrim\.hidden=false;scrim\.classList\.add\('show'\);setModalBackground\(true\)/);
  assert.match(html, /scrim\.classList\.remove\('show'\);scrim\.hidden=true;setModalBackground\(false\)/);
  assert.match(html, /fsSearch\.setAttribute\('aria-expanded','true'\)/);
  assert.match(html, /fsSearch\.setAttribute\('aria-expanded','false'\);fsSearch\.removeAttribute\('aria-activedescendant'\)/);
  assert.match(html, /var restore=modalTrigger;modalTrigger=null;if\(restore&&restore\.focus\)restore\.focus\(\)/);
  assert.match(html, /document\.addEventListener\('keydown',trapModalFocus\)/);
});
