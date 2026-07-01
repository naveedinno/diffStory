// The review-page client wiring for cross-view comments. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_CSS, PAGE_JS } from '../dist/page-assets.js';

test('client defines thread mounting and a comment cache', () => {
  assert.match(PAGE_JS, /function mountThreads\(/);
  assert.match(PAGE_JS, /function syncThreads\(/);
  assert.match(PAGE_JS, /var allComments\s*=/);
});

test('the context menu opens the composer from selected review text', () => {
  assert.match(PAGE_JS, /document\.addEventListener\('contextmenu',openSelectionMenu\)/);
  assert.match(PAGE_JS, /function currentSelectionContext\(/);
  assert.match(PAGE_JS, /data-selection-action/);
  assert.doesNotMatch(PAGE_JS, /ds-addcomment/);
});

test('the selection context is constrained to one diff side', () => {
  assert.match(PAGE_JS, /data-comment-side/);
  assert.match(PAGE_JS, /data-comment-file/);
  assert.match(PAGE_JS, /data-comment-line/);
  assert.match(PAGE_JS, /if\(side&&s!==side\)return null/);
  assert.match(PAGE_JS, /side:side/);
});

test('code selection locks out the opposite side while dragging', () => {
  assert.match(PAGE_CSS, /body\.ds-selecting-right \.ds-code\[data-comment-side="left"\]/);
  assert.match(PAGE_CSS, /body\.ds-selecting-left \.ds-code\[data-comment-side="right"\]/);
  assert.match(PAGE_CSS, /-webkit-user-select:none;user-select:none/);
  assert.match(PAGE_JS, /function trackSelectionSide\(e\)/);
  assert.match(PAGE_JS, /document\.addEventListener\('mousedown',trackSelectionSide\)/);
});

test('refreshComments caches the list and re-syncs threads', () => {
  // The fetch(API) handler stores the list into allComments and calls syncThreads.
  assert.match(PAGE_JS, /allComments\s*=\s*list/);
  assert.match(PAGE_JS, /syncThreads\(\)/);
});

test('client renders comment replies through the same Markdown path', () => {
  assert.match(PAGE_JS, /function renderMarkdown\(/);
  assert.match(PAGE_JS, /function renderInlineMarkdown\(/);
  assert.match(PAGE_JS, /markdownBlock\('ds-comment-body ds-md',c\.body\)/);
  assert.match(PAGE_JS, /function turnNode\(/);
  assert.match(PAGE_JS, /function renderConversation\(/);
  assert.match(PAGE_JS, /renderConversation\(wrap,c\)/);
});

test('client no longer renders a Send again button', () => {
  assert.doesNotMatch(PAGE_JS, /Send again/);
});

test('address runs drive the shared ProgressPanel, not a bespoke bubble', () => {
  // Sending comments to the agent mounts the one shared ProgressPanel inline in the card
  // and streams the run through it — the agent's real plan, active step, and elapsed time.
  assert.match(PAGE_JS, /function sendToAgent\(ids,fromCard\)/);
  assert.match(PAGE_JS, /function mountPanelInCard\(/);
  assert.match(PAGE_JS, /function restoreAgentPanel\(/);
  assert.match(PAGE_JS, /new ProgressPanel\(root,/);
  assert.match(PAGE_JS, /runProgress\(panel,ADDRESS_API,payload,ctrl\)/);
  assert.match(PAGE_CSS, /\.ds-ai-badge/);
  // A code-changing run offers a reload through the panel's own footer.
  assert.match(PAGE_JS, /data-reload-diff/);
  // The old live bubble that echoed internal phase names is gone for good.
  assert.doesNotMatch(PAGE_CSS, /\.ds-reply-live/);
  assert.doesNotMatch(PAGE_CSS, /\.ds-live-updates/);
  assert.doesNotMatch(PAGE_CSS, /dsLiveTyping/);
  assert.doesNotMatch(PAGE_JS, /function agentDraftText\(/);
  assert.doesNotMatch(PAGE_JS, /function addressProgressPanel\(/);
});

test('a freshly loaded full file gets its threads mounted', () => {
  assert.match(PAGE_JS, /mountThreads\(fullInner\)/);
});

test('resolving a comment updates all cross-surfaced copies via patchComment', () => {
  assert.match(PAGE_JS, /patchComment\(c\);refreshCount\(\)/);
});

test('client mounts a persistent chat composer that posts and re-runs the agent', () => {
  assert.match(PAGE_JS, /function buildThreadComposer\(/);
  assert.match(PAGE_JS, /function sendThreadMessage\(/);
  assert.match(PAGE_JS, /data-thread-send/);
  assert.match(PAGE_JS, /data-thread-ta/);
  assert.match(PAGE_JS, /\/message/);
  assert.match(PAGE_JS, /sendToAgent\(\[id\]\)/);
  assert.match(PAGE_CSS, /\.ds-thread-composer/);
  assert.match(PAGE_CSS, /\.ds-thread-ta/);
});

test('the composer send is disabled while the agent is busy', () => {
  assert.match(PAGE_JS, /\[data-thread-send\]'\)\.forEach/);
  assert.match(PAGE_JS, /\[data-thread-add\]'\)\.forEach/);
});

test('comment counts are by unique id, so cross-surfaced comments are not double-counted', () => {
  // a single comment mounts as several .ds-comment nodes (diff hunks, full-file, tour);
  // collectOpenIds and refreshCount must dedupe by data-comment-id, not count nodes.
  assert.match(PAGE_JS, /function uniqueIds\(sel\)/);
  assert.match(PAGE_JS, /return uniqueIds\('\.ds-comment\.status-open'\)/);
  assert.match(PAGE_JS, /var openN=uniqueIds\('\.ds-comment:not\(\.status-resolved\)'\)\.length/);
  assert.doesNotMatch(PAGE_JS, /\$all\('\.ds-comment'\)\.length-\$all\('\.ds-comment\.status-resolved'\)\.length/);
});

test('the new-comment composer offers Add comment (save only) and Ask now', () => {
  assert.match(PAGE_JS, /function buildComposer\(/);
  assert.match(PAGE_JS, /ds-composer-add/);
  assert.match(PAGE_JS, /'Add comment'/);
  assert.match(PAGE_JS, /'Ask now'/);
  // shared helper gates the run on a flag; Add => false, Ask now => true
  assert.match(PAGE_JS, /function submitComment\(run\)/);
  assert.match(PAGE_JS, /if\(run\)sendToAgent\(\[c\.id\]\)/);
  assert.match(PAGE_JS, /submitComment\(false\)/);
  assert.match(PAGE_JS, /submitComment\(true\)/);
});

test('the thread composer offers Add (save only) and Ask now (save + run)', () => {
  assert.match(PAGE_JS, /function buildThreadComposer\(/);
  assert.match(PAGE_JS, /data-thread-add/);
  assert.match(PAGE_JS, /'Ask now'/);
  // sendThreadMessage gates the agent run on the `run` flag:
  assert.match(PAGE_JS, /function sendThreadMessage\(wrap,run\)/);
  assert.match(PAGE_JS, /if\(run\)sendToAgent\(\[id\]\)/);
  // delegation: Add => run=false, Ask now => run=true
  assert.match(PAGE_JS, /\[data-thread-add\]'\);if\(b\)\{sendThreadMessage\(closest\(b,'\.ds-comment'\),false\)/);
  assert.match(PAGE_JS, /\[data-thread-send\]'\);if\(b\)\{sendThreadMessage\(closest\(b,'\.ds-comment'\),true\)/);
  // Enter sends via the run path
  assert.match(PAGE_JS, /sendThreadMessage\(closest\(ta,'\.ds-comment'\),true\)/);
});

test('the Send all button runs the batch and tracks the open count', () => {
  // click delegation fires the existing batch path
  assert.match(PAGE_JS, /\[data-send-all\]'\);if\(b\)\{if\(b\.disabled\)return;sendToAgent\('all'\)/);
  // refreshCount updates the counted label + hidden state
  assert.match(PAGE_JS, /ds-send-all/);
  assert.match(PAGE_JS, /sa\.hidden=openN===0/);
  // setBusy disables it during a run
  assert.match(PAGE_JS, /\[data-send-all\]'\)/);
  assert.match(PAGE_CSS, /\.ds-send-all/);
});
