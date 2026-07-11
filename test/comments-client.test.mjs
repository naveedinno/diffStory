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
  assert.match(PAGE_JS, /function sendToAgent\(ids,fromCard,target\)/);
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

test('address runs bind to a reusable Codex task and send that choice', () => {
  assert.match(PAGE_JS, /function chooseAddressAgent\(/);
  assert.match(PAGE_JS, /fetch\('\/api\/agents'\)/);
  assert.match(PAGE_JS, /fetch\(CODEX_TASK_API\)/);
  assert.match(PAGE_JS, /New Codex task/);
  assert.match(PAGE_JS, /data-agent-task-option/);
  assert.match(PAGE_JS, /payload\.agent=target\.agent/);
  assert.match(PAGE_JS, /payload\.codexThreadId=target\.threadId/);
  assert.match(PAGE_JS, /payload\.newCodexTask=true/);
  assert.match(PAGE_JS, /readAgentTarget\(\)/);
  assert.match(PAGE_JS, /saveAgentTarget\(target\)/);
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

test('the new-comment composer shows its agent task and separates save from send', () => {
  assert.match(PAGE_JS, /function buildComposer\(/);
  assert.match(PAGE_JS, /function buildAgentRoute\(/);
  assert.match(PAGE_JS, /ds-composer-add/);
  assert.match(PAGE_JS, /'Save only'/);
  assert.match(PAGE_JS, /'Choose task & ask'/);
  assert.match(PAGE_JS, /data-agent-target-cta/);
  // shared helper gates the run on a flag; Save only => false, Ask agent => true
  assert.match(PAGE_JS, /function submitComment\(run\)/);
  assert.match(PAGE_JS, /if\(run\)sendToAgent\(\[c\.id\]\)/);
  assert.match(PAGE_JS, /submitComment\(false\)/);
  assert.match(PAGE_JS, /submitComment\(true\)/);
});

test('the thread composer shows its agent task and separates save from send', () => {
  assert.match(PAGE_JS, /function buildThreadComposer\(/);
  assert.match(PAGE_JS, /data-thread-add/);
  assert.match(PAGE_JS, /'Save reply'/);
  assert.match(PAGE_JS, /'Choose task & ask'/);
  // sendThreadMessage gates the agent run on the `run` flag:
  assert.match(PAGE_JS, /function sendThreadMessage\(wrap,run\)/);
  assert.match(PAGE_JS, /if\(run\)sendToAgent\(\[id\]\)/);
  // delegation: Save reply => run=false, Ask agent => run=true
  assert.match(PAGE_JS, /\[data-thread-add\]'\);if\(b\)\{sendThreadMessage\(closest\(b,'\.ds-comment'\),false\)/);
  assert.match(PAGE_JS, /\[data-thread-send\]'\);if\(b\)\{sendThreadMessage\(closest\(b,'\.ds-comment'\),true\)/);
  // Enter sends via the run path
  assert.match(PAGE_JS, /sendThreadMessage\(closest\(ta,'\.ds-comment'\),true\)/);
});

test('the compact Review menu runs the batch and tracks the open count', () => {
  assert.match(PAGE_JS, /\[data-address-all\]'\);if\(b\)\{if\(b\.disabled\)return;setReviewMenu\(false\);sendToAgent\('all'\)/);
  assert.match(PAGE_JS, /ds-review-summary-label/);
  assert.doesNotMatch(PAGE_JS, /ds-send-all/);
});

test('agent target labels update every sending surface and mark the current task', () => {
  assert.match(PAGE_JS, /function applyAgentTargetTo\(scope,target\)/);
  assert.match(PAGE_JS, /\$all\('\[data-agent-target-name\]',scope\)\.forEach/);
  assert.match(PAGE_JS, /button\.textContent=has\?'Ask agent':'Choose task & ask'/);
  assert.match(PAGE_JS, /selected\?'Current':target\.meta/);
  assert.match(PAGE_JS, /target\.agent==='codex'&&target\.mode==='new'/);
});

test('agent and review controls stay distinct at compact widths', () => {
  assert.match(PAGE_CSS, /@media \(max-width:900px\)[\s\S]*?\.ds-agent-target\{width:36px/);
  assert.match(PAGE_CSS, /\.ds-review-menu-dot::before\{content:'!'/);
  assert.match(PAGE_CSS, /\.ds-review-menu\.is-clean \.ds-review-menu-dot::before\{content:'✓'/);
  assert.doesNotMatch(PAGE_CSS, /\.ds-review-menu-dot::before\{content:'…'/);
  assert.match(PAGE_CSS, /@media \(max-width:620px\)[\s\S]*?\.ds-agent-chooser\{align-items:flex-end/);
  assert.match(PAGE_CSS, /@media \(max-width:620px\)\{\.ds-thread-composer-foot\{align-items:stretch\}\}/);
});

test('agent and review dialogs restore focus and trap task-picker tabbing', () => {
  assert.match(PAGE_JS, /reviewMenuReturnFocus/);
  assert.match(PAGE_JS, /pop\.contains\(activeElement\)/);
  assert.match(PAGE_JS, /agentChooserReturnFocus/);
  assert.match(PAGE_JS, /root\.addEventListener\('keydown'/);
  assert.match(PAGE_JS, /if\(e\.key!=='Tab'\)return/);
});

test('copying all comments includes every conversation turn, not only legacy replies', () => {
  assert.match(PAGE_JS, /function commentTurnsToText\(/);
  assert.match(PAGE_JS, /c\.turns\.forEach/);
  assert.match(PAGE_JS, /who=t\.role==='ai'\?BRAND\+' reply':'Reviewer'/);
  assert.match(PAGE_JS, /commentTurnsToText\(c\)\.forEach/);
});

test('selection actions are discoverable without restoring line plus buttons', () => {
  assert.match(PAGE_JS, /function showSelectionQuick\(/);
  assert.match(PAGE_JS, /data-selection-quick-action/);
  assert.match(PAGE_JS, /e\.key==='c'\|\|e\.key==='C'/);
  assert.match(PAGE_CSS, /\.ds-selection-quick/);
});

test('review feedback has a verification inbox and timeline', () => {
  assert.match(PAGE_JS, /function openFeedbackDrawer\(/);
  assert.match(PAGE_JS, /function updateCommentStatus\(/);
  assert.match(PAGE_JS, /data-accept-fix/);
  assert.match(PAGE_JS, /data-reopen-comment/);
  assert.match(PAGE_CSS, /\.ds-review-timeline/);
});

test('file filters, resume state, and keyboard commands stay local to the review', () => {
  assert.match(PAGE_JS, /function applyFileFilters\(/);
  assert.match(PAGE_JS, /function restoreReviewPosition\(/);
  assert.match(PAGE_JS, /localStorage\.setItem\(reviewUiKey\(\)/);
  assert.match(PAGE_JS, /btn\.hidden=!text\|\|!inFiles/);
  assert.match(PAGE_JS, /function setView\(v\)[\s\S]*?revealResumeReview\(\)/);
  assert.match(PAGE_JS, /e\.key==='\?'/);
  assert.match(PAGE_JS, /e\.key==='\/'/);
});

test('targeted story repair uses the shared progress panel', () => {
  assert.match(PAGE_JS, /function repairStory\(/);
  assert.match(PAGE_JS, /runProgress\(panel,'\/api\/story\/repair'/);
  assert.match(PAGE_JS, /data-story-repair/);
});
