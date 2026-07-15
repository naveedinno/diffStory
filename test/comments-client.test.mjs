// The review-page client wiring for cross-view comments. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_CSS, PAGE_JS } from '../dist/page-assets.js';

test('resume control contains long file paths inside the resizable sidebar', () => {
  assert.match(PAGE_CSS, /\.ds-resume-review\{[^}]*min-width:0[^}]*overflow:hidden/);
  assert.match(PAGE_CSS, /\.ds-resume-review \[data-resume-review-label\]\{[^}]*min-width:0[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/);
  assert.match(PAGE_JS, /btn\.title=text;btn\.setAttribute\('aria-label',text\)/);
  assert.match(PAGE_JS, /btn\.removeAttribute\('title'\);btn\.removeAttribute\('aria-label'\)/);
});

test('client defines thread mounting and a comment cache', () => {
  assert.match(PAGE_JS, /function mountThreads\(/);
  assert.match(PAGE_JS, /function syncThreads\(/);
  assert.match(PAGE_JS, /function initialComments\(\)/);
  assert.match(PAGE_JS, /document\.getElementById\('ds-initial-comments'\)/);
  assert.match(PAGE_JS, /var allComments=initialComments\(\)/);
});

test('comment conversations open in a floating sidecar instead of splitting the diff', () => {
  assert.match(PAGE_CSS, /\.ds-thread\{position:fixed/);
  assert.match(PAGE_CSS, /\.ds-thread\.is-open\{display:block/);
  assert.match(PAGE_CSS, /\.ds-comment-pin\{position:absolute/);
  assert.match(PAGE_JS, /function openCommentSurface\(/);
  assert.match(PAGE_JS, /data-comment-launcher/);
  assert.match(PAGE_JS, /data-comment-surface-close/);
  assert.match(PAGE_JS, /setAttribute\('aria-expanded'/);
  assert.match(PAGE_JS, /if\(focusInside\)surface\.focus\(\{preventScroll:true\}\)/);
  assert.match(PAGE_JS, /t\.tabIndex=-1/);
  assert.match(PAGE_JS, /setSidebarCollapsed\(true,false\)/);
  assert.match(PAGE_JS, /setSidebarCollapsed\(false,false\)/);
});

test('new review comments compose in the same floating surface', () => {
  assert.match(PAGE_CSS, /\.ds-composer\{position:fixed/);
  assert.match(PAGE_JS, /box\.setAttribute\('role','dialog'\)/);
  assert.match(PAGE_JS, /box\.setAttribute\('aria-modal','true'\)/);
  assert.match(PAGE_JS, /tabs\.setAttribute\('role','radiogroup'\)/);
  assert.match(PAGE_JS, /b\.setAttribute\('role','radio'\)/);
  assert.match(PAGE_JS, /activateModal\(box,composerReturnFocus\)/);
  assert.match(PAGE_JS, /deactivateModal\(b,restoreFocus!==false\)/);
  assert.match(PAGE_JS, /document\.body\.appendChild\(box\)/);
  assert.doesNotMatch(PAGE_JS, /anchor\.parentNode\.insertBefore\(box,anchor\.nextSibling\)/);
});

test('deleting a review conversation is visibly destructive and requires confirmation', () => {
  assert.match(PAGE_CSS, /\.ds-del\{color:var\(--del-text\)/);
  assert.match(PAGE_JS, /window\.confirm\('Delete this review conversation\? This cannot be undone\.'/);
});

test('the context menu opens the composer from selected review text', () => {
  assert.match(PAGE_JS, /document\.addEventListener\('contextmenu',openSelectionMenu\)/);
  assert.match(PAGE_JS, /function currentSelectionContext\(/);
  assert.match(PAGE_JS, /function contextForSelectionMenu\(e\)/);
  assert.match(PAGE_JS, /selectionContext&&pointInSelection\(e\.clientX,e\.clientY\)/);
  assert.match(PAGE_JS, /if\(e\.button!==0\)return/);
  assert.match(PAGE_JS, /data-selection-action/);
  assert.doesNotMatch(PAGE_JS, /ds-addcomment/);
});

test('right click survives a browser-collapsed selection but stays inside its highlight', () => {
  assert.match(PAGE_JS, /selectionRects=\[\]/);
  assert.match(PAGE_JS, /range\.getClientRects/);
  assert.match(PAGE_JS, /function cacheSelectionContext\(\)/);
  assert.match(PAGE_JS, /cacheSelectionContext\(\)/);
  assert.match(PAGE_JS, /function isSecondarySelectionGesture\(e\)/);
  assert.match(PAGE_JS, /e\.button===2\|\|\(e\.button===0&&e\.ctrlKey\)/);
  assert.match(PAGE_JS, /if\(isSecondarySelectionGesture\(e\)\)\{selectionContextMenuPending=true/);
  assert.match(PAGE_JS, /if\(isSecondarySelectionGesture\(e\)\|\|\(e&&e\.button!==0\)\)return/);
  assert.match(PAGE_JS, /return selectionContext&&pointInSelection\(e\.clientX,e\.clientY\)\?selectionContext:null/);
  assert.match(PAGE_JS, /var ctx=contextForSelectionMenu\(e\);\s*selectionContextMenuPending=false;\s*if\(!ctx\)return;\s*e\.preventDefault\(\)/);
});

test('cached selection geometry clears after an ordinary collapsed selection', () => {
  assert.match(PAGE_JS, /function clearCollapsedSelection\(\)/);
  assert.match(PAGE_JS, /if\(selectionContextMenuPending\)return/);
  assert.match(PAGE_JS, /selectionContext=null;selectionRects=\[\]/);
  assert.match(PAGE_JS, /document\.addEventListener\('selectionchange',clearCollapsedSelection\)/);
});

test('selection endpoints may land on a diff row wrapper', () => {
  assert.match(PAGE_JS, /var intendedSide=\(startCode\|\|endCode\)\?/);
  assert.doesNotMatch(PAGE_JS, /if\(!startCode\|\|!endCode\)return null/);
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

test('refreshing feedback preserves server-rendered before/current evidence', () => {
  assert.match(PAGE_JS, /var existing=old\[c\.id\],card=existing\?existing\.node/);
  assert.match(PAGE_JS, /if\(existing\)patchFeedbackContent\(card,c\)/);
  assert.doesNotMatch(PAGE_JS, /allComments\.forEach\(function\(c\)\{var card=buildFeedbackCardClient/);
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
  assert.match(PAGE_JS, /payload\.codexTaskLabel=target\.label\|\|'Selected Codex task'/);
  assert.match(PAGE_JS, /payload\.newCodexTask=true/);
  assert.match(PAGE_JS, /readAgentTarget\(\)/);
  assert.match(PAGE_JS, /saveAgentTarget\(target\)/);
});

test('agent task picker opens immediately while slow task discovery stays inside the dialog', () => {
  const shell = PAGE_JS.indexOf('renderAgentTargetChooser([],[],null,done,codexOnly,true)');
  const discovery = PAGE_JS.indexOf("fetch('/api/agents')", shell);
  assert.ok(shell >= 0 && discovery > shell, 'renders the loading dialog before starting discovery');
  assert.match(PAGE_JS, /Loading available tasks…/);
  assert.match(PAGE_JS, /request!==agentChooserRequest/);
  assert.match(PAGE_JS, /agentChooserRequest\+\+/);
  assert.match(PAGE_CSS, /\.ds-agent-task-loading/);
  assert.match(PAGE_CSS, /\.ds-agent-task-spinner/);
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
  assert.match(PAGE_JS, /sendToAgent\(\[id\],wrap\)/);
  assert.match(PAGE_CSS, /\.ds-thread-composer/);
  assert.match(PAGE_CSS, /\.ds-thread-ta/);
});

test('the composer send is disabled while the agent is busy', () => {
  assert.match(PAGE_JS, /\[data-thread-send\]'\)\.forEach/);
  assert.match(PAGE_JS, /\[data-thread-add\]'\)\.forEach/);
});

test('global comment counts and batch actions use the canonical cache before lazy panels mount', () => {
  // A saved comment can have zero or several mounted .ds-comment nodes. The API cache
  // must remain canonical so neither lazy loading nor cross-surfacing changes the count.
  assert.match(PAGE_JS, /function commentIds\(predicate\)/);
  assert.match(PAGE_JS, /allComments\.forEach\(function\(c\)/);
  assert.match(PAGE_JS, /return commentIds\(function\(c\)\{return c\.status==='open';\}\)/);
  assert.match(PAGE_JS, /var openN=commentIds\(function\(c\)\{return c\.status!=='resolved';\}\)\.length/);
  assert.match(PAGE_JS, /var totalN=commentIds\(\)\.length/);
  assert.doesNotMatch(PAGE_JS, /uniqueIds\('\.ds-comment/);
  assert.doesNotMatch(PAGE_JS, /\$all\('\.ds-comment'\)\.length-\$all\('\.ds-comment\.status-resolved'\)\.length/);
});

test('patching a lazy comment updates the canonical cache before refreshing counts', () => {
  assert.match(PAGE_JS, /function patchComment\(c\)\{\s*var found=false;/);
  assert.match(PAGE_JS, /allComments\[ai\]=c;found=true/);
  assert.match(PAGE_JS, /if\(!found\)allComments\.push\(c\)/);
});

test('approval posts the issued page identity, exact change, and live feedback identity', () => {
  assert.match(PAGE_JS, /pageToken:document\.body\.getAttribute\('data-review-page-token'\)\|\|''/);
  assert.match(PAGE_JS, /expectedFingerprint:document\.body\.getAttribute\('data-current-diff-hash'\)\|\|''/);
  assert.match(PAGE_JS, /expectedScopeKey:document\.body\.getAttribute\('data-review-scope'\)\|\|''/);
  assert.match(PAGE_JS, /expectedFeedbackVersion:Number\(document\.body\.getAttribute\('data-feedback-version'\)\|\|0\)/);
  assert.match(PAGE_JS, /expectedBlockingFeedbackDigest:document\.body\.getAttribute\('data-blocking-feedback-digest'\)\|\|''/);
  assert.match(PAGE_JS, /mode:mode/);
  assert.match(PAGE_JS, /if\(kind==='approve'&&mode!=='full'\)/);
  assert.match(PAGE_JS, /data-index-divergence-count/);
  assert.match(PAGE_JS, /Reconcile staged and working-tree versions before approval/);
  assert.match(PAGE_JS, /commentSeverity\(c\)==='blocking'/);
  assert.match(PAGE_JS, /function noteBlockingFeedbackMutation\(comment\)/);
  assert.match(PAGE_JS, /function syncReviewFeedbackIdentity\(\)/);
  assert.match(PAGE_JS, /data-blocking-feedback-digest/);
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

test('Enter asks the agent from a new comment while Shift+Enter stays multiline', () => {
  assert.match(PAGE_JS, /ta\.title='Enter to ask agent · Shift\+Enter for a new line'/);
  assert.match(PAGE_JS, /ta\.setAttribute\('aria-keyshortcuts','Enter'\)/);
  assert.match(PAGE_JS, /if\(e\.key!=='Enter'\|\|e\.shiftKey\|\|e\.isComposing\)return;e\.preventDefault\(\);if\(!ask\.disabled\)submitComment\(true\)/);
});

test('the thread composer shows its agent task and separates save from send', () => {
  assert.match(PAGE_JS, /function buildThreadComposer\(/);
  assert.match(PAGE_JS, /data-thread-add/);
  assert.match(PAGE_JS, /'Save'/);
  assert.match(PAGE_JS, /'Choose task & ask'/);
  // sendThreadMessage gates the agent run on the `run` flag:
  assert.match(PAGE_JS, /function sendThreadMessage\(wrap,run\)/);
  assert.match(PAGE_JS, /if\(run\)sendToAgent\(\[id\],wrap\)/);
  // delegation: Save reply => run=false, Ask agent => run=true
  assert.match(PAGE_JS, /\[data-thread-add\]'\);if\(b\)\{sendThreadMessage\(closest\(b,'\.ds-comment'\),false\)/);
  assert.match(PAGE_JS, /\[data-thread-send\]'\);if\(b\)\{sendThreadMessage\(closest\(b,'\.ds-comment'\),true\)/);
  // Enter sends via the run path
  assert.match(PAGE_JS, /sendThreadMessage\(closest\(ta,'\.ds-comment'\),true\)/);
});

test('Ask agent sends an existing popup conversation even when the reply box is empty', () => {
  assert.match(PAGE_JS, /if\(!text\)\{if\(run\)sendToAgent\(\[id\],wrap\);return;\}/);
  assert.match(PAGE_JS, /if\(run\)sendToAgent\(\[id\],wrap\);/);
});

test('conversation hierarchy keeps code context compact and secondary actions quiet', () => {
  assert.match(PAGE_CSS, /\.ds-thread\{position:fixed[^}]*width:min\(460px[^}]*max-height:calc\(100vh - 96px\)/);
  assert.match(PAGE_CSS, /\.ds-comment-selection>summary/);
  assert.match(PAGE_CSS, /\.ds-comment-selection-preview/);
  assert.match(PAGE_CSS, /\.ds-comment-menu-pop/);
  assert.match(PAGE_CSS, /\.ds-thread-composer\{position:sticky/);
  assert.match(PAGE_JS, /ds-comment-selection-preview/);
  assert.match(PAGE_JS, /ds-comment-menu-pop/);
  assert.match(PAGE_JS, /Delete conversation/);
});

test('multiple comments on one anchor show one conversation and one composer at a time', () => {
  assert.match(PAGE_CSS, /\.ds-comment\[hidden\]\{display:none!important\}/);
  assert.match(PAGE_CSS, /\.ds-chat-nav\[hidden\]\{display:none!important\}/);
  assert.match(PAGE_JS, /function surfaceComments\(/);
  assert.match(PAGE_JS, /function showCommentInSurface\(/);
  assert.match(PAGE_JS, /comments\[k\]\.hidden=!active/);
  assert.match(PAGE_JS, /data-comment-position/);
  assert.match(PAGE_JS, /data-comment-prev/);
  assert.match(PAGE_JS, /data-comment-next/);
  assert.match(PAGE_JS, /showCommentInSurface\(surface,wrap\.getAttribute\('data-comment-id'\)\)/);
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

test('nested dialogs preserve the underlying modal and only trap focus in the top layer', () => {
  assert.match(PAGE_JS, /reviewMenuReturnFocus/);
  assert.match(PAGE_JS, /pop\.contains\(activeElement\)/);
  assert.match(PAGE_JS, /agentChooserReturnFocus/);
  assert.match(PAGE_JS, /modalStack=\[\],modalBackgroundSnapshots=\[\]/);
  assert.match(PAGE_JS, /modalStack\.push\(\{root:root,returnFocus:/);
  assert.match(PAGE_JS, /modalStack\.splice\(index,1\);syncModalBackground\(\);syncModalScrollLock\(\)/);
  assert.match(PAGE_JS, /if\(node===top\)\{restoreModalNode\(snapshot\);return;\}/);
  assert.match(PAGE_JS, /if\(!top\)\{modalBackgroundSnapshots\.forEach\(restoreModalNode\);modalBackgroundSnapshots=\[\];return;\}/);
  assert.match(PAGE_JS, /activateModal\(root,agentChooserReturnFocus\)/);
  assert.match(PAGE_JS, /deactivateModal\(old,restore!==false\)/);
  assert.match(PAGE_JS, /commandReturnFocus/);
  assert.match(PAGE_JS, /var modalRoot=topModalRoot\(\)/);
  assert.match(PAGE_JS, /focusInside=modalRoot\.contains\(document\.activeElement\)/);
  assert.match(PAGE_JS, /if\(modalRoot\)return/);
  assert.match(PAGE_JS, /var escapeModal=topModalRoot\(\)/);
  assert.doesNotMatch(PAGE_JS, /data-ds-prev-hidden/);
});

test('copying all comments includes every conversation turn, not only legacy replies', () => {
  assert.match(PAGE_JS, /function commentTurnsToText\(/);
  assert.match(PAGE_JS, /c\.turns\.forEach/);
  assert.match(PAGE_JS, /who=t\.role==='ai'\?BRAND\+' reply':'Reviewer'/);
  assert.match(PAGE_JS, /commentTurnsToText\(c\)\.forEach/);
});

test('ordinary selection stays quiet while right click and keyboard actions remain available', () => {
  assert.doesNotMatch(PAGE_JS, /showSelectionQuick/);
  assert.doesNotMatch(PAGE_JS, /data-selection-quick-action/);
  assert.match(PAGE_JS, /e\.key==='c'\|\|e\.key==='C'/);
  assert.doesNotMatch(PAGE_CSS, /\.ds-selection-quick/);
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
  assert.match(PAGE_JS, /function closeStoryTuneMenus\(/);
  assert.match(PAGE_JS, /if\(!closest\(t,'\.ds-story-tune'\)\)closeStoryTuneMenus\(\)/);
  assert.match(PAGE_JS, /var openTune=\$\('\.ds-story-tune\[open\]'\)/);
  assert.match(PAGE_CSS, /\.ds-story-tune>summary\{[^}]*min-height:32px[^}]*padding:0 10px/);
  assert.match(PAGE_CSS, /\.ds-story-tune\[open\]>summary\{/);
  assert.match(PAGE_CSS, /\.ds-reviewfocus\{[^}]*grid-column:1\/-1[^}]*grid-row:2/);
});

test('live review reconnects through the page lease and recovers durable state', () => {
  assert.match(PAGE_JS, /new EventSource\(reviewPageUrl\('\/api\/events'\)\)/);
  assert.match(PAGE_JS, /source\.onopen=function\(\)\{/);
  assert.match(PAGE_JS, /refreshComments\(null,true\);refreshReviewState\(\)/);
  assert.match(PAGE_JS, /source\.addEventListener\('state'/);
  assert.match(PAGE_JS, /source\.addEventListener\('diff-changed'/);
  assert.match(PAGE_JS, /source\.addEventListener\('story-synced'/);
  assert.match(PAGE_JS, /var kinds=\['diff','story','disconnected'\]/);
  assert.match(PAGE_JS, /data-live-diff-stale/);
  assert.match(PAGE_JS, /fetch\(reviewPageUrl\('\/api\/review-state'\)\)/);
  assert.match(PAGE_JS, /renderReviewTimeline\(state\.events\|\|\[\]\)/);
  assert.match(PAGE_JS, /function aiTurnKeys\(/);
  assert.match(PAGE_JS, /Agent replied to /);
  assert.match(PAGE_CSS, /\.ds-live-banner\{position:fixed/);
  assert.match(PAGE_CSS, /\.ds-live-banner button\{[^}]*min-width:44px[^}]*min-height:44px/);
});
