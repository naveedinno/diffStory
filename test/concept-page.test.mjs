import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conceptPageDocument, CONCEPT_PAGE_CSP } from '../dist/concept-page.js';

test('the shim goes first inside <head>, before any author markup', () => {
  const html = conceptPageDocument('<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="script-src \'self\'"><script>var mine=1</script></head><body>x</body></html>', 'dark');
  const shim = html.indexOf('data-diffstory-shim');
  assert.ok(shim > -1);
  assert.ok(shim < html.indexOf('http-equiv'), 'the shim precedes the author CSP meta');
  assert.ok(shim < html.indexOf('var mine'), 'and the author script');
  assert.match(html, /<html[^>]*data-ds-theme="dark"|setAttribute\('data-ds-theme'/);
});

test('a fragment with no <head> still gets the shim prepended', () => {
  const html = conceptPageDocument('<svg><circle r="4"/></svg>', 'light');
  assert.ok(html.indexOf('data-diffstory-shim') < html.indexOf('<svg>'));
});

test('a headless page keeps its doctype first', () => {
  const html = conceptPageDocument('<!doctype html><body>x</body>', 'light');
  assert.match(html, /^<!doctype html>/i);
  assert.ok(html.indexOf('data-diffstory-shim') < html.indexOf('<body>'));
});

test('a headless page with an <html> tag keeps doctype and <html> first', () => {
  const html = conceptPageDocument('<!DOCTYPE html>\n<html lang="en"><body>x</body></html>', 'dark');
  const htmlOpen = html.indexOf('<html lang="en">');
  assert.ok(htmlOpen > -1);
  const shim = html.indexOf('data-diffstory-shim');
  assert.ok(shim > htmlOpen + '<html lang="en">'.length);
  assert.ok(shim < html.indexOf('<body>'));
});

test('an uppercase or attributed <HEAD> is found', () => {
  const html = conceptPageDocument('<HTML><HEAD lang="en"><TITLE>t</TITLE></HEAD><BODY></BODY></HTML>', 'light');
  assert.ok(html.indexOf('data-diffstory-shim') > html.indexOf('<HEAD lang="en">'));
  assert.ok(html.indexOf('data-diffstory-shim') < html.indexOf('<TITLE>'));
});

test('the shim skips text entry and handled keys and only trusts its parent', () => {
  const html = conceptPageDocument('<p>x</p>', 'light');
  assert.match(html, /defaultPrevented/);
  assert.match(html, /isContentEditable/);
  assert.match(html, /INPUT|TEXTAREA|SELECT/);
  assert.match(html, /e\.source!==parent|e\.source !== parent/);
  assert.match(html, /diffstory:key/);
  assert.match(html, /diffstory:theme/);
});

test('key forwarding is deferred so an author preventDefault still wins', () => {
  const html = conceptPageDocument('<p>x</p>', 'light');
  const setTimeoutAt = html.indexOf('setTimeout');
  assert.ok(setTimeoutAt > -1, 'the shim defers the forward');
  const defaultPreventedAt = html.indexOf('defaultPrevented');
  assert.ok(
    defaultPreventedAt > setTimeoutAt,
    'the defaultPrevented check runs inside the deferred callback, after dispatch completes',
  );
  const postMessageAt = html.indexOf('parent.postMessage');
  assert.ok(
    postMessageAt > defaultPreventedAt,
    'the forward itself also runs inside the deferred callback',
  );
});

test('theme tokens are optional variables authors can override', () => {
  const html = conceptPageDocument('<p>x</p>', 'dark');
  assert.match(html, /--ds-accent:/);
  assert.match(html, /:root\[data-ds-theme="light"\]/);
});

test('the page CSP is permissive but only frameable by diffStory', () => {
  assert.match(CONCEPT_PAGE_CSP, /default-src \* data: blob: 'unsafe-inline' 'unsafe-eval'/);
  assert.match(CONCEPT_PAGE_CSP, /^sandbox allow-scripts(;|$)/, 'the page is sandboxed even when opened as a top-level document');
  assert.doesNotMatch(CONCEPT_PAGE_CSP, /allow-same-origin|allow-popups|allow-top-navigation|allow-forms/);
  assert.match(CONCEPT_PAGE_CSP, /frame-ancestors 'self'/);
});
