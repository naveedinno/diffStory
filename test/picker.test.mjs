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
  assert.doesNotMatch(html, /Open a repository to review its current change/);
  assert.doesNotMatch(html, /class="steps"|Choose the exact change|Approve only when the thread is clear/);
  assert.ok(html.includes("+'/stories'"), 'falls back to review history when the server omits a route');
  assert.match(html, /id="quickAddBtn"[^>]+aria-label="Add repository"/, 'keeps the icon-only mobile action named');
  assert.doesNotMatch(html, /id="path"|id="openBtn"|Paste a repository path/, 'does not repeat repository opening controls below the primary action');
  assert.match(html, /\.remove-btn::after\{content:"";position:absolute;inset:-5px\}/, 'keeps the compact mobile remove action easy to tap');
  assert.doesNotMatch(html, /hero-copy|hero-title|Recent repositories keep branch/, 'keeps the app bar free of repeated instructions');
  assert.doesNotMatch(html, /Your repositories|<p class="section">/, 'uses one concise repositories heading');
});

test('picker keeps repository bookkeeping in the repository row, not the masthead', () => {
  const now = 10_000_000;
  const html = renderPicker(
    [{
      path: '/Users/test/workspace',
      name: 'workspace',
      isGit: true,
      hasTour: false,
      currentBranch: 'main',
      changedFiles: 3,
      lastOpened: now - 7 * 60 * 1000,
    }],
    '/Users/test',
    now,
  );

  assert.doesNotMatch(html, /herostats/, 'does not render the redundant masthead ledger');
  assert.match(html, /class="hero-thread ds-atmosphere-thread"/, 'keeps the animated masthead thread when removing the ledger copy');
  assert.match(html, /animation:ds-thread-pulse 11s linear 2s infinite backwards/, 'keeps the travelling pulse timing intact');
  assert.equal((html.match(/3 changed files/g) ?? []).length, 1, 'shows the change count only on the repository row');
  assert.equal((html.match(/7 min ago/g) ?? []).length, 1, 'shows the last-opened time only on the repository row');
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
  assert.match(html, /scrim\.hidden=false;setModalBackground\(true\)/);
  assert.match(html, /requestAnimationFrame\(function\(\)\{if\(!scrim\.hidden\)scrim\.classList\.add\('show'\);\}\)/);
  assert.match(html, /scrim\.classList\.remove\('show'\);setModalBackground\(false\)/);
  assert.match(html, /modalCloseTimer=setTimeout\(function\(\)\{modalCloseTimer=0;if\(!scrim\.classList\.contains\('show'\)\)scrim\.hidden=true;\}/);
  assert.match(html, /fsSearch\.setAttribute\('aria-expanded','true'\)/);
  assert.match(html, /fsSearch\.setAttribute\('aria-expanded','false'\);fsSearch\.removeAttribute\('aria-activedescendant'\)/);
  assert.match(html, /var restore=modalTrigger;modalTrigger=null;if\(restore&&restore\.focus\)restore\.focus\(\)/);
  assert.match(html, /document\.addEventListener\('keydown',trapModalFocus\)/);
});

test('picker motion connects the page and folder sheet without overriding reduced motion', () => {
  const html = renderPicker([], '/Users/test', Date.now());
  assert.match(html, /--motion-duration-spatial:340ms/);
  assert.match(html, /\.scrim\.show \.sheet\{transform:none;opacity:1\}/);
  assert.match(html, /\.reveal\{animation:up var\(--motion-duration-spatial\) var\(--motion-ease-out\) backwards\}/);
  assert.match(html, /prefers-reduced-motion:reduce\)\{\.scrim,\.sheet\{transition:none\}/);
});
