import assert from 'node:assert/strict';
import test from 'node:test';
import { renderDiffStoryWebview } from '../dist/webview.js';

function model(overrides = {}) {
  return {
    nonce: 'test-nonce',
    repo: { name: 'sample-repo', path: '/work/sample-repo' },
    scopeLabel: 'HEAD → working tree',
    files: [
      { path: 'src/controller.ts', status: 'M' },
      { path: 'src/new-feature.ts', status: 'A' },
    ],
    seenFiles: [],
    comments: [],
    review: { round: 1, changedSinceReview: 0, changedFiles: [], seenFiles: [], events: [] },
    storyId: 'story.json',
    stories: [],
    progress: [],
    agentRunning: false,
    agents: ['codex'],
    showWelcome: true,
    ...overrides,
  };
}

test('fresh installs explain the job and make changed files the primary surface', () => {
  const html = renderDiffStoryWebview(model());

  assert.match(html, /Review this code change/);
  assert.match(html, /Review these changes/);
  assert.match(html, /data-open-file="src\/controller\.ts"/);
  assert.match(html, />Changes<\/span>/);
  assert.match(html, />Guide<\/span>/);
  assert.match(html, />Feedback<\/span>/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-controls="mode-panel-changes"/);
  assert.doesNotMatch(html, /Review setup|Story actions|class="step"/);
  assert.doesNotMatch(html, /style=/, 'CSP-safe rendering must not rely on inline style attributes');
});

test('after onboarding, the primary state becomes honest file-open progress', () => {
  const html = renderDiffStoryWebview(model({ showWelcome: false, seenFiles: ['src/controller.ts'] }));

  assert.doesNotMatch(html, /Your first review/);
  assert.match(html, /1 file unopened/);
  assert.match(html, /1 of 2 opened/);
  assert.match(html, /Open next file/);
});

test('the guide shows one useful next stop instead of dumping the whole story', () => {
  const story = {
    title: 'Understand the review controller',
    summary: 'Follow the request from the view into the native diff editor.',
    steps: [
      { id: 'one', order: 1, title: 'Start at the controller', file: 'src/controller.ts', range: [10, 25], kind: 'context', why: 'This owns the review session.' },
      { id: 'two', order: 2, title: 'Then inspect persistence', file: 'src/state.ts', range: [4, 18], kind: 'implementation', why: 'This remembers progress.' },
    ],
  };
  const html = renderDiffStoryWebview(model({
    story,
    guideStatus: { state: 'current', activeScopeLabel: 'HEAD → working tree', canSwitchScope: false },
    stories: [{ id: 'story.json', title: story.title, valid: true, story }],
  }));

  assert.match(html, /Understand the review controller/);
  assert.match(html, /Start at the controller/);
  assert.doesNotMatch(html, /Then inspect persistence/);
  assert.match(html, /Open another stop/);
  assert.match(html, /Guide matches this comparison/);
});

test('a guide for another comparison blocks line targets and offers safe recovery', () => {
  const story = {
    title: 'Review the feature branch',
    summary: 'Follow the feature comparison.',
    steps: [{ id: 'one', order: 1, title: 'Feature entry', file: 'src/feature.ts', range: [10, 15], kind: 'changed', why: 'This is the entry point.' }],
  };
  const html = renderDiffStoryWebview(model({
    story,
    initialMode: 'guide',
    guideStatus: { state: 'scope-mismatch', activeScopeLabel: 'HEAD → working tree', storyScopeLabel: 'main → feature', canSwitchScope: true },
    stories: [{ id: 'story.json', title: story.title, valid: true, story }],
  }));

  assert.match(html, /This guide belongs to another comparison/);
  assert.match(html, /Switch to guide comparison/);
  assert.match(html, /Regenerate for current comparison/);
  assert.match(html, /id="open-guide-stop" disabled aria-disabled="true"/);
  assert.match(html, /id="browse-guide" disabled aria-disabled="true"/);
});

test('feedback defaults to fixes awaiting verification when both queues have work', () => {
  const comments = [
    {
      id: 'open-comment', file: 'src/a.ts', line: 4, type: 'question', body: 'Can this be simpler?', status: 'open', createdAt: '2026-07-13T10:00:00.000Z',
    },
    {
      id: 'addressed-comment', file: 'src/b.ts', line: 9, type: 'change', body: 'Handle the empty state.', status: 'addressed', createdAt: '2026-07-13T10:01:00.000Z', reply: 'Added an explicit empty state.',
    },
  ];
  const html = renderDiffStoryWebview(model({ comments, review: { round: 2, changedSinceReview: 1, changedFiles: ['src/b.ts'], seenFiles: [], events: [] } }));

  assert.match(html, /data-default-feedback-filter="addressed"/);
  assert.match(html, /1 fix ready to verify/);
  assert.match(html, /Review next fix/);
  assert.match(html, /Mark resolved/);
  assert.match(html, /Needs more work/);
});

test('long agent replies stay scannable behind a disclosure', () => {
  const reply = 'Implemented the requested fix. '.repeat(20);
  const html = renderDiffStoryWebview(model({
    comments: [{ id: 'addressed', file: 'src/a.ts', line: 4, type: 'change', body: 'Handle the edge case.', status: 'addressed', createdAt: '2026-07-13T10:00:00.000Z', reply }],
  }));

  assert.match(html, /Read full response/);
  assert.match(html, /Implemented the requested fix\./);
});

test('empty workspace and empty comparison states give a clear recovery action', () => {
  const noWorkspace = renderDiffStoryWebview(model({ repo: undefined, files: [] }));
  assert.match(noWorkspace, /Open a Git project/);
  assert.match(noWorkspace, /Open folder…/);

  const noChanges = renderDiffStoryWebview(model({ files: [] }));
  assert.match(noChanges, /Nothing to review/);
  assert.match(noChanges, /Choose another comparison/);
});

test('agent-dependent states explain setup before an action can dead-end', () => {
  const guide = renderDiffStoryWebview(model({ story: undefined, stories: [], agents: [], initialMode: 'guide' }));
  assert.match(guide, /Connect Codex or Claude/);
  assert.match(guide, /Check agent setup/);

  const feedback = renderDiffStoryWebview(model({
    agents: [],
    initialMode: 'feedback',
    comments: [{ id: 'open', file: 'src/a.ts', line: 2, type: 'question', body: 'Why?', status: 'open', createdAt: '2026-07-13T10:00:00.000Z' }],
  }));
  assert.match(feedback, /Agent setup needed/);
  assert.doesNotMatch(feedback, /id="address-feedback"/);
});

test('user-controlled paths and feedback are escaped', () => {
  const html = renderDiffStoryWebview(model({
    files: [{ path: 'src/<script>.ts', status: 'M' }],
    comments: [{ id: 'x', file: 'src/<script>.ts', line: 1, type: 'nit', body: '<img src=x onerror=alert(1)>', status: 'open', createdAt: '2026-07-13T10:00:00.000Z' }],
  }));

  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /src\/&lt;script&gt;\.ts/);
});
