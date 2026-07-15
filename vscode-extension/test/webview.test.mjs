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
  assert.match(noWorkspace, /Choose repository/);

  const noChanges = renderDiffStoryWebview(model({ files: [] }));
  assert.match(noChanges, /Nothing to review/);
  assert.match(noChanges, /Choose another comparison/);
});

test('repository picker is a first-class page with workspace and recent projects', () => {
  const html = renderDiffStoryWebview(model({
    screen: 'repositories',
    repositories: [
      { name: 'sample-repo', path: '/work/sample-repo', kind: 'workspace', active: true, available: true },
      { name: 'other-repo', path: '/work/other-repo', kind: 'recent', active: false, available: true },
      { name: 'missing-repo', path: '/work/missing-repo', kind: 'recent', active: false, available: false },
    ],
  }));

  assert.match(html, /Choose where to review/);
  assert.match(html, /Open another repository…/);
  assert.match(html, /Current repository/);
  assert.match(html, /Continue a previous review/);
  assert.match(html, /data-select-repository="\/work\/other-repo"/);
  assert.match(html, /Folder unavailable/);
  assert.doesNotMatch(html, /role="tablist"/);
});

test('history page explains saved comparisons and exposes resumable activity', () => {
  const html = renderDiffStoryWebview(model({
    screen: 'history',
    review: { scopeKey: 'active', round: 2, changedSinceReview: 0, changedFiles: [], seenFiles: [], events: [] },
    history: [{
      scopeKey: 'active', base: 'main', head: 'feature', round: 2, snapshotCount: 3, latestSnapshotFiles: 7,
      seenFiles: 5, startedAt: '2026-07-14T10:00:00.000Z', lastActivityAt: '2026-07-15T10:00:00.000Z',
      latestVerdict: { decision: 'changes-requested', createdAt: '2026-07-15T10:00:00.000Z' },
      events: [{ id: 'event', at: '2026-07-15T10:00:00.000Z', round: 2, kind: 'verdict-recorded', label: 'Changes requested' }],
    }],
  }));

  assert.match(html, /Every comparison, round, decision/);
  assert.match(html, /main → feature/);
  assert.match(html, /Changes requested/);
  assert.match(html, /<b>7<\/b> files/);
  assert.match(html, /data-resume-history="active"/);
  assert.match(html, /Current/);
});

test('comparison setup offers useful presets and an exact-ref form', () => {
  const html = renderDiffStoryWebview(model({
    screen: 'comparison',
    scopeBase: 'main',
    scopeHead: 'feature',
    comparisonRefs: [{ ref: 'main', label: 'main', description: 'Primary branch' }, { ref: 'feature', label: 'feature', description: 'Feature branch' }],
  }));

  assert.match(html, /What do you want to review|Pick a common review/);
  assert.match(html, /Branch changes/);
  assert.match(html, /Uncommitted work/);
  assert.match(html, /Latest commit/);
  assert.match(html, /Compare exact Git refs/);
  assert.match(html, /id="comparison-base"[^>]*value="main"/);
  assert.match(html, /id="comparison-head"[^>]*value="feature"/);
  assert.match(html, /data-comparison-preset="latest"/);
  assert.doesNotMatch(html, /role="tablist"/);
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

test('review decisions expose blockers, exclusions, severity, and destructive comment actions', () => {
  const review = {
    round: 3, changedSinceReview: 0, changedFiles: [], seenFiles: [], events: [],
    verdict: { state: 'stale', invalidationReason: 'feedback-changed' },
    feedbackHealth: { status: 'healthy', source: 'file' },
  };
  const comment = {
    id: 'blocking', file: 'src/controller.ts', line: 8, type: 'question', severity: 'blocking',
    body: 'Prove this transition.', status: 'open', createdAt: '2026-07-15T10:00:00.000Z',
  };
  const html = renderDiffStoryWebview(model({
    showWelcome: false,
    comments: [comment],
    review,
    exclusions: [{ path: 'package-lock.json', reason: 'generated-path', addedLines: 3, removedLines: 2, changedLines: 5 }],
  }));

  assert.match(html, /Review decision/);
  assert.match(html, /decision is out of date/i);
  assert.match(html, /1 unresolved blocking comment/);
  assert.match(html, /Generated artifact/);
  assert.match(html, /id="approve-review" disabled/);
  assert.match(html, /data-delete-comment="blocking"/);
  assert.match(html, />Blocking</);
});

test('invalid comment storage presents recovery and disables approval', () => {
  const html = renderDiffStoryWebview(model({
    initialMode: 'feedback',
    review: {
      round: 1, changedSinceReview: 0, changedFiles: [], seenFiles: [], events: [],
      feedbackHealth: { status: 'invalid', reason: 'invalid-json', message: 'comments.json is broken.', recovery: 'Repair it, then refresh.' },
    },
  }));
  assert.match(html, /DiffStory stopped comment writes/);
  assert.match(html, /Repair it, then refresh/);
  assert.match(html, /id="approve-review" disabled/);
});

test('incomplete and focused guides explain why exact approval is unavailable', () => {
  const story = {
    version: 2,
    title: 'Focused guide',
    summary: 'Only part of the change is explained.',
    storyScope: { includedFiles: ['src/controller.ts'], excludedFiles: ['src/new-feature.ts'] },
    steps: [{ id: 'one', order: 1, title: 'Controller', file: 'src/controller.ts', range: [1, 2], kind: 'changed', why: 'Entry point' }],
  };
  const html = renderDiffStoryWebview(model({
    showWelcome: false,
    story,
    guideStatus: { state: 'current', activeScopeLabel: 'HEAD → working tree', canSwitchScope: false },
    storyCoverage: {
      unclaimed: [{ file: 'src/controller.ts', range: [3, 4], status: 'modified' }],
      totalChangedFiles: 1,
      fullyClaimedChangedFiles: 0,
      totalChangedRanges: 2,
      fullyClaimedChangedRanges: 1,
    },
  }));

  assert.match(html, /Guide covers only selected files/);
  assert.match(html, /1 changed range not explained by the guide/);
  assert.match(html, /Guide incomplete/);
  assert.match(html, /Regenerate complete guide/);
  assert.match(html, /id="approve-review" disabled/);
});

test('v2 guide stops expose narrated beats and navigable code flow', () => {
  const story = {
    version: 2,
    title: 'Follow the request',
    summary: 'Trace entry to persistence.',
    steps: [
      {
        id: 'entry', order: 1, title: 'Receive the request', file: 'src/controller.ts', range: [1, 8], viewport: [1, 12],
        highlights: [[3, 5]], beats: [{ text: 'Validate the request.', highlights: [[3, 5]] }], focus: { ranges: [[3, 5]], label: 'Validation' },
        tags: ['entrypoint'], kind: 'changed', why: 'This validates input.', calls: ['save'],
      },
      { id: 'save', order: 2, title: 'Persist the result', file: 'src/state.ts', range: [4, 9], kind: 'changed', why: 'This writes state.', returnsTo: 'entry' },
    ],
  };
  const html = renderDiffStoryWebview(model({
    story,
    guideStatus: { state: 'current', activeScopeLabel: 'HEAD → working tree', canSwitchScope: false },
  }));

  assert.match(html, /1 narrated beat/);
  assert.match(html, /Focus · Validation/);
  assert.match(html, /Calls Persist the result/);
  assert.match(html, /data-open-guide-step="save"/);
  assert.match(html, /entrypoint/);
});
