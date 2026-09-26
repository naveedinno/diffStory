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

test('theme tokens are optional variables authors can override', () => {
  const html = conceptPageDocument('<p>x</p>', 'dark');
  assert.match(html, /--ds-accent:/);
  assert.match(html, /:root\[data-ds-theme="light"\]/);
});

test('the page CSP is permissive but only frameable by diffStory', () => {
  assert.match(CONCEPT_PAGE_CSP, /default-src \* data: blob: 'unsafe-inline' 'unsafe-eval'/);
  assert.match(CONCEPT_PAGE_CSP, /frame-ancestors 'self'/);
});
