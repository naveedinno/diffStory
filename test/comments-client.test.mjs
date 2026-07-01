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
  // ensureReply is retained as a helper but the turns-based path supersedes it.
  assert.match(PAGE_JS, /function ensureReply\(/);
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
