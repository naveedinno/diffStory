import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clampNavigationPoint, parseNavigationQuery, prepareNavigation } from '../dist/navigation.js';

test('parses an encoded absolute source location', () => {
  const query = new URLSearchParams({
    repo: '/Users/example/Code/review app',
    path: '/Users/example/Code/review app/src/order flow.ts',
    line: '42',
    column: '17',
  }).toString();
  assert.deepEqual(parseNavigationQuery(query), {
    repo: '/Users/example/Code/review app',
    path: '/Users/example/Code/review app/src/order flow.ts',
    line: 42,
    column: 17,
  });
});

test('rejects relative paths and invalid positions', () => {
  assert.equal(parseNavigationQuery('repo=%2Ftmp%2Frepo&path=src%2Fa.ts&line=1&column=1'), null);
  assert.equal(parseNavigationQuery('repo=repo&path=%2Ftmp%2Frepo%2Fa.ts&line=1&column=1'), null);
  assert.equal(parseNavigationQuery('repo=%2Ftmp%2Frepo&path=%2Ftmp%2Frepo%2Fa.ts&line=0&column=1'), null);
  assert.equal(parseNavigationQuery('repo=%2Ftmp%2Frepo&path=%2Ftmp%2Frepo%2Fa.ts&line=1&column=1.5'), null);
  assert.equal(parseNavigationQuery('repo=%2Ftmp%2Frepo&path=%2Ftmp%2Frepo%2Fa.ts&line=1&column=0'), null);
});

test('rejects navigation targets outside the reviewed repository', () => {
  assert.equal(parseNavigationQuery('repo=%2Ftmp%2Frepo&path=%2Ftmp%2Fother%2Fa.ts&line=1&column=1'), null);
  assert.equal(parseNavigationQuery('repo=%2Ftmp%2Frepo&path=%2Ftmp%2Frepository%2Fa.ts&line=1&column=1'), null);
});

test('persists navigation before opening a missing reviewed repository', async () => {
  const request = {
    repo: '/Users/example/Code/review app',
    path: '/Users/example/Code/review app/src/order flow.ts',
    line: 42,
    column: 17,
  };
  const calls = [];
  const result = await prepareNavigation(request, {
    containsSource: () => false,
    persistPending: async (pending) => { calls.push(['persist', pending]); },
    openRepository: async (repo) => { calls.push(['open', repo]); },
  });
  assert.equal(result, 'opening-repository');
  assert.deepEqual(calls, [
    ['persist', request],
    ['open', request.repo],
  ]);
});

test('navigates immediately when the reviewed repository is already open', async () => {
  const request = { repo: '/tmp/repo', path: '/tmp/repo/a.ts', line: 1, column: 1 };
  const calls = [];
  const result = await prepareNavigation(request, {
    containsSource: () => true,
    persistPending: async () => { calls.push('persist'); },
    openRepository: async () => { calls.push('open'); },
  });
  assert.equal(result, 'ready');
  assert.deepEqual(calls, []);
});

test('clamps the requested caret to the opened source document', () => {
  const request = { repo: '/tmp/repo', path: '/tmp/repo/a.ts', line: 207, column: 9 };
  assert.deepEqual(clampNavigationPoint(request, 300, () => 80), { line: 206, character: 8 });
  assert.deepEqual(clampNavigationPoint(request, 12, () => 5), { line: 11, character: 5 });
});

test('opens and reveals the exact source position without provider lookup or success toast', () => {
  const extension = readFileSync(new URL('../dist/extension.js', import.meta.url), 'utf8');
  assert.match(extension, /TextEditorRevealType\.InCenterIfOutsideViewport/);
  assert.doesNotMatch(extension, /executeImplementationProvider|executeDefinitionProvider/);
  assert.doesNotMatch(extension, /No implementation or definition was reported/);
});
