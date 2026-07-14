import * as path from 'node:path';
import type { ChangedFile } from './git';
import type { ReviewComment, Tour } from './model';
import type { ReviewCursor, ReviewSummary } from './review-state';
import type { StorySummary } from './stories';
import type { GuideStatus } from './guide';

export type DiffStoryMode = 'changes' | 'guide' | 'feedback';

export interface DiffStoryViewModel {
  nonce: string;
  repo?: { name: string; path: string };
  canSwitchRepo?: boolean;
  scopeLabel: string;
  files: ChangedFile[];
  seenFiles: string[];
  comments: ReviewComment[];
  review: ReviewSummary;
  story?: Tour;
  guideStatus?: GuideStatus;
  storyId: string;
  stories: StorySummary[];
  cursor?: ReviewCursor;
  progress: string[];
  agentRunning: boolean;
  agents: Array<'codex' | 'claude'>;
  showWelcome: boolean;
  loading?: boolean;
  error?: string;
  initialMode?: DiffStoryMode;
}

export function renderDiffStoryWebview(model: DiffStoryViewModel): string {
  const nonce = model.nonce;
  const counts = feedbackCounts(model.comments);
  const repo = model.repo;
  const initialMode = model.initialMode ?? 'changes';
  const repoName = repo ? escapeHtml(repo.name) : 'DiffStory';
  const repoPath = repo ? escapeAttribute(repo.path) : '';
  const scope = repo
    ? `<button class="scope-button" id="change-scope" title="Change the Git comparison">${escapeHtml(model.scopeLabel)}<span aria-hidden="true">⌄</span></button>`
    : '';
  const workspaceName = repo
    ? model.canSwitchRepo
      ? `<button class="workspace-name repo-switch" id="switch-repo" title="Switch Git repository">${repoName}<span aria-hidden="true">⌄</span></button>`
      : `<strong class="workspace-name" title="${repoPath}">${repoName}</strong>`
    : `<strong class="workspace-name">${repoName}</strong>`;
  const tabs = repo
    ? `<nav class="mode-tabs" role="tablist" aria-label="DiffStory sections">
        ${modeTab('changes', 'Changes', model.files.length, initialMode)}
        ${modeTab('guide', 'Guide', model.story?.steps.length, initialMode)}
        ${modeTab('feedback', 'Feedback', counts.open + counts.addressed, initialMode, counts.addressed > 0)}
      </nav>`
    : '';
  const main = repo
    ? `<main>
        <section class="mode-panel" id="mode-panel-changes" data-mode-panel="changes" role="tabpanel" aria-labelledby="mode-tab-changes"${initialMode === 'changes' ? '' : ' hidden'}>${renderChanges(model)}</section>
        <section class="mode-panel" id="mode-panel-guide" data-mode-panel="guide" role="tabpanel" aria-labelledby="mode-tab-guide"${initialMode === 'guide' ? '' : ' hidden'}>${renderGuide(model)}</section>
        <section class="mode-panel" id="mode-panel-feedback" data-mode-panel="feedback" role="tabpanel" aria-labelledby="mode-tab-feedback"${initialMode === 'feedback' ? '' : ' hidden'}>${renderFeedback(model)}</section>
      </main>`
    : `<main>${renderNoWorkspace()}</main>`;
  const status = model.loading
    ? '<div class="app-status is-loading" role="status"><span class="spinner" aria-hidden="true"></span>Refreshing review…</div>'
    : model.error
      ? `<div class="app-status is-error" role="alert"><strong>Could not refresh this review.</strong><span>${escapeHtml(model.error)}</span><button id="retry-refresh">Try again</button></div>`
      : '';
  const agentStatus = repo ? renderAgentProgress(model) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">${webviewCss()}</style>
</head>
<body>
  <header class="app-header">
    <div class="brand-row">
      <div class="wordmark" aria-label="DiffStory"><span>diff</span><strong>Story</strong></div>
      <button class="quiet-button" id="refresh" title="Refresh review" aria-label="Refresh review">Refresh</button>
    </div>
    <div class="workspace-row">
      ${workspaceName}
      ${scope}
    </div>
  </header>
  ${status}
  ${tabs}
  ${agentStatus}
  ${main}
  <script nonce="${nonce}">${webviewScript(initialMode)}</script>
</body>
</html>`;
}

function modeTab(mode: DiffStoryMode, label: string, count: number | undefined, initial: DiffStoryMode, attention = false): string {
  return `<button class="mode-tab${mode === initial ? ' is-active' : ''}${attention ? ' has-attention' : ''}" id="mode-tab-${mode}" data-mode-tab="${mode}" role="tab" tabindex="${mode === initial ? '0' : '-1'}" aria-controls="mode-panel-${mode}" aria-selected="${mode === initial}"><span>${label}</span>${count ? `<b>${count}</b>` : ''}</button>`;
}

function renderNoWorkspace(): string {
  return `<section class="center-state">
    <div class="state-mark" aria-hidden="true">↗</div>
    <span class="kicker">Start here</span>
    <h1>Open a Git project</h1>
    <p>DiffStory reviews the code changes in an open repository. Your files stay in VS Code's native diff editor.</p>
    <button class="primary-button" id="open-folder">Open folder…</button>
  </section>`;
}

function renderChanges(model: DiffStoryViewModel): string {
  const seen = new Set(model.seenFiles);
  const reviewed = model.files.filter((file) => seen.has(file.path)).length;
  const unseen = Math.max(0, model.files.length - reviewed);
  const counts = feedbackCounts(model.comments);
  const firstRun = model.showWelcome && model.files.length > 0;
  if (!model.files.length) {
    return `<section class="center-state compact-state">
      <div class="state-mark is-done" aria-hidden="true">✓</div>
      <span class="kicker">Current comparison</span>
      <h1>Nothing to review</h1>
      <p>${escapeHtml(model.scopeLabel)} has no changed files.</p>
      <button class="primary-button" id="empty-change-scope">Choose another comparison</button>
    </section>`;
  }

  const hero = firstRun
    ? `<section class="welcome-block">
        <span class="kicker">Your first review</span>
        <h1>Review this code change</h1>
        <p>Open each changed file, comment on the exact code that matters, then verify the agent's fixes.</p>
        <button class="primary-button large-button" id="start-review">Review these changes <span aria-hidden="true">→</span></button>
        <button class="text-button welcome-guide-link" data-open-mode="guide">Want an explanation first? Open the Guide →</button>
      </section>`
    : `<section class="review-summary">
        <div><span class="kicker">Files opened</span><h1>${unseen ? `${unseen} ${plural(unseen, 'file')} unopened` : 'Every file opened'}</h1></div>
        ${unseen ? '<button class="primary-button" id="open-next">Open next file <span aria-hidden="true">→</span></button>' : '<button class="secondary-button" id="review-again">Review a file</button>'}
        <div class="progress-copy"><span>${reviewed} of ${model.files.length} opened</span><span>${Math.round((reviewed / model.files.length) * 100)}%</span></div>
        <progress class="progress-track" aria-label="Files opened" max="${model.files.length}" value="${reviewed}">${reviewed} of ${model.files.length}</progress>
      </section>`;

  const attention = counts.addressed
    ? `<button class="attention-strip is-verify" data-open-mode="feedback"><span><b>${counts.addressed} ${plural(counts.addressed, 'fix')} ready to verify</b><small>Check what changed before resolving.</small></span><span aria-hidden="true">→</span></button>`
    : counts.open
      ? `<button class="attention-strip is-comment" data-open-mode="feedback"><span><b>${counts.open} ${plural(counts.open, 'comment')} ready for the agent</b><small>Review or send your feedback.</small></span><span aria-hidden="true">→</span></button>`
      : reviewed
        ? `<div class="selection-tip"><span class="tip-key">2</span><span><b>Leave precise feedback</b><small>Select code in the diff, right-click, then choose <em>DiffStory: Add comment to selected code</em>.</small></span><button id="add-from-selection">Add from selection</button></div>`
        : '';

  return `${hero}${renderWorkflow(model)}${attention}${renderFileList(model, seen)}${renderGuideTeaser(model)}`;
}

function renderWorkflow(model: DiffStoryViewModel): string {
  const counts = feedbackCounts(model.comments);
  const active = counts.addressed ? 3 : counts.open ? 2 : 1;
  return `<ol class="workflow" aria-label="Review workflow">
    ${workflowStep(1, 'Review', 'Open changed files', active)}
    ${workflowStep(2, 'Comment', 'Select exact code', active)}
    ${workflowStep(3, 'Verify', 'Check agent fixes', active)}
  </ol>`;
}

function workflowStep(order: number, title: string, hint: string, active: number): string {
  return `<li class="${order === active ? 'is-active' : ''}${order < active ? ' is-past' : ''}"${order === active ? ' aria-current="step"' : ''}><span>${order}</span><div><b>${title}</b><small>${hint}</small></div></li>`;
}

function renderFileList(model: DiffStoryViewModel, seen: Set<string>): string {
  const commented = new Map<string, number>();
  for (const comment of model.comments.filter((item) => item.status !== 'resolved')) {
    commented.set(comment.file, (commented.get(comment.file) ?? 0) + 1);
  }
  const unseen = model.files.filter((file) => !seen.has(file.path)).length;
  const rows = model.files.map((file) => renderFileRow(file, seen.has(file.path), commented.get(file.path) ?? 0)).join('');
  return `<section class="file-section">
    <div class="section-heading"><div><span class="kicker">Changed files</span><strong>${model.files.length} total</strong></div><div class="filter-row" role="group" aria-label="Filter changed files"><button class="filter-button${unseen ? ' is-active' : ''}" data-file-filter="unseen" aria-pressed="${unseen > 0}">Unopened${unseen ? ` · ${unseen}` : ''}</button><button class="filter-button${unseen ? '' : ' is-active'}" data-file-filter="all" aria-pressed="${unseen === 0}">All</button>${commented.size ? '<button class="filter-button" data-file-filter="commented" aria-pressed="false">Commented</button>' : ''}</div></div>
    <div class="file-list">${rows}</div>
    <button class="show-more" id="show-more-files" hidden></button>
    <p class="filter-empty" id="file-filter-empty" hidden>No files match this filter.</p>
  </section>`;
}

function renderFileRow(file: ChangedFile, reviewed: boolean, comments: number): string {
  const parsed = path.posix.parse(file.path);
  const directory = parsed.dir ? `${parsed.dir}/` : '';
  const status = statusDetails(file.status);
  return `<button class="file-row" data-open-file="${escapeAttribute(file.path)}" data-file-reviewed="${reviewed}" data-file-commented="${comments > 0}" title="Open ${escapeAttribute(file.path)}">
    <span class="file-status is-${status.tone}" aria-label="${status.label}">${status.short}</span>
    <span class="file-name"><strong>${escapeHtml(parsed.base)}</strong>${directory ? `<small>${escapeHtml(directory)}</small>` : ''}</span>
    <span class="file-meta">${comments ? `<b>${comments} ${plural(comments, 'comment')}</b>` : reviewed ? '<b class="reviewed-mark">Opened</b>' : '<span>Open</span>'}</span>
  </button>`;
}

function renderGuideTeaser(model: DiffStoryViewModel): string {
  if (model.story) {
    const current = model.guideStatus?.state === 'current';
    return `<button class="guide-teaser${current ? '' : ' is-warning'}" data-open-mode="guide"><span class="guide-glyph" aria-hidden="true">${current ? '✦' : '!'}</span><span><b>${current ? 'Want the guided version?' : 'Guide needs attention'}</b><small>${current ? `${model.story.steps.length} stops explain this change in a useful order.` : 'Check its comparison before following any line targets.'}</small></span><span aria-hidden="true">→</span></button>`;
  }
  return `<button class="guide-teaser" data-open-mode="guide"><span class="guide-glyph" aria-hidden="true">✦</span><span><b>Need help understanding the change?</b><small>Create an agent-guided reading path.</small></span><span aria-hidden="true">→</span></button>`;
}

function renderGuide(model: DiffStoryViewModel): string {
  if (!model.story) {
    if (!model.agents.length) return renderAgentSetup('guide');
    return `<section class="center-state guide-empty">
      <div class="state-mark is-guide" aria-hidden="true">✦</div>
      <span class="kicker">Optional guide</span>
      <h1>Let an agent explain the change</h1>
      <p>DiffStory can arrange the important parts into a short reading path. You still review every line in VS Code's diff editor.</p>
      <button class="primary-button guide-button" id="create-guide">Create guided review</button>
      <button class="text-button" data-open-mode="changes">Review files without a guide</button>
    </section>`;
  }

  const story = model.story;
  const found = story.steps.findIndex((step) => step.id === model.cursor?.stepId);
  const index = found >= 0 ? found : 0;
  const step = story.steps[index];
  const progress = found >= 0 ? index + 1 : 0;
  const storyOptions = model.stories.length > 1 ? `${model.stories.length} saved guides` : 'Guide options';
  const guideCurrent = model.guideStatus?.state === 'current';
  return `<section class="guide-page">
    <div class="guide-intro">
      <span class="kicker">Guided review · optional</span>
      <h1>${escapeHtml(story.title)}</h1>
      <p>${escapeHtml(story.summary)}</p>
    </div>
    ${renderGuideStatus(model)}
    <section class="current-stop${guideCurrent ? '' : ' is-blocked'}">
      <div class="stop-progress"><span>${progress ? `Stop ${progress} of ${story.steps.length}` : `${story.steps.length} stops`}</span><span>${progress ? Math.round((progress / story.steps.length) * 100) : 0}%</span></div>
      <progress class="progress-track is-guide" aria-label="Guide progress" max="${story.steps.length}" value="${progress}">${progress} of ${story.steps.length}</progress>
      ${step ? `<div class="stop-copy"><span class="stop-number">${String(step.order).padStart(2, '0')}</span><div><h2>${escapeHtml(step.title)}</h2><code>${escapeHtml(step.file)} · ${step.range[0] === 0 ? 'deleted file' : `L${step.range[0]}–${step.range[1]}`}</code><p>${escapeHtml(step.why)}</p></div></div>` : ''}
      <button class="primary-button guide-button" id="open-guide-stop"${guideCurrent ? '' : ' disabled aria-disabled="true"'}>${found >= 0 ? 'Continue guided review' : 'Open first guide stop'} <span aria-hidden="true">→</span></button>
    </section>
    <div class="guide-actions"><button class="secondary-button" id="browse-guide"${guideCurrent ? '' : ' disabled aria-disabled="true"'}>Open another stop</button><button class="secondary-button" id="guide-options">${storyOptions}</button></div>
    ${story.intent?.goal ? `<details class="story-context"><summary>Why this change exists</summary><p><b>Goal</b> ${escapeHtml(story.intent.goal)}</p>${story.intent.design ? `<p><b>Approach</b> ${escapeHtml(story.intent.design)}</p>` : ''}</details>` : ''}
  </section>`;
}

function renderGuideStatus(model: DiffStoryViewModel): string {
  const status = model.guideStatus ?? { state: 'unverified' as const, activeScopeLabel: model.scopeLabel, canSwitchScope: false };
  if (status.state === 'current') {
    return `<div class="guide-trust is-current" role="status"><span aria-hidden="true">✓</span><span><b>Guide matches this comparison</b><small>Its line targets were written for ${escapeHtml(status.activeScopeLabel)}.</small></span></div>`;
  }
  const title = status.state === 'scope-mismatch'
    ? 'This guide belongs to another comparison'
    : status.state === 'stale'
      ? 'The code changed after this guide was written'
      : 'This guide cannot be verified yet';
  const detail = status.state === 'scope-mismatch'
    ? `Guide: ${status.storyScopeLabel ?? 'another comparison'}. Current: ${status.activeScopeLabel}. Switch comparisons or regenerate for the code you are reviewing now.`
    : status.state === 'stale'
      ? 'Its saved diff no longer matches the code, so DiffStory has blocked the line targets. Regenerate the guide before following it.'
      : 'This older guide has no exact diff fingerprint. Regenerate it before trusting its line targets.';
  const switchAction = status.state === 'scope-mismatch' && status.canSwitchScope
    ? '<button class="primary-button guide-button" id="switch-guide-scope">Switch to guide comparison</button>'
    : '';
  const recovery = model.agents.length
    ? '<button class="secondary-button" id="regenerate-guide">Regenerate for current comparison</button>'
    : '<button class="secondary-button" id="open-guide-agent-help">Set up an agent to regenerate</button>';
  return `<section class="guide-trust is-warning" role="alert"><span class="warning-mark" aria-hidden="true">!</span><div><span class="kicker">Guide paused</span><h2>${title}</h2><p>${escapeHtml(detail)}</p><div class="guide-recovery">${switchAction}${recovery}</div></div></section>`;
}

function renderFeedback(model: DiffStoryViewModel): string {
  const counts = feedbackCounts(model.comments);
  if (!model.comments.length) {
    return `<section class="center-state feedback-empty">
      <div class="state-mark is-comment" aria-hidden="true">+</div>
      <span class="kicker">No feedback yet</span>
      <h1>Comment on the exact code</h1>
      <p>Open a changed file, select the relevant code, then right-click and choose <b>DiffStory: Add comment to selected code</b>.</p>
      <button class="primary-button comment-button" data-open-mode="changes">Review changed files</button>
      <button class="text-button" id="empty-add-comment">Add from current selection</button>
    </section>`;
  }

  const defaultFilter = counts.addressed ? 'addressed' : counts.open ? 'open' : 'resolved';
  const action = renderFeedbackAction(model, counts);
  const cards = [...model.comments]
    .sort((a, b) => feedbackRank(a.status) - feedbackRank(b.status))
    .map(renderFeedbackCard)
    .join('');
  return `<section class="feedback-page" data-default-feedback-filter="${defaultFilter}">
    ${action}
    <section class="feedback-section">
      <div class="section-heading"><div><span class="kicker">Review feedback</span><strong>${model.comments.length} total</strong></div><div class="filter-row" role="group" aria-label="Filter feedback"><button class="filter-button${defaultFilter === 'addressed' ? ' is-active' : ''}" data-feedback-filter="addressed" aria-pressed="${defaultFilter === 'addressed'}">Verify · ${counts.addressed}</button><button class="filter-button${defaultFilter === 'open' ? ' is-active' : ''}" data-feedback-filter="open" aria-pressed="${defaultFilter === 'open'}">Needs agent · ${counts.open}</button><button class="filter-button${defaultFilter === 'resolved' ? ' is-active' : ''}" data-feedback-filter="resolved" aria-pressed="${defaultFilter === 'resolved'}">Resolved · ${counts.resolved}</button></div></div>
      <div class="feedback-list">${cards}</div>
      <p class="filter-empty" id="feedback-filter-empty" hidden>Nothing is waiting in this group.</p>
    </section>
    ${renderActivity(model)}
  </section>`;
}

function renderFeedbackAction(model: DiffStoryViewModel, counts: ReturnType<typeof feedbackCounts>): string {
  const firstAddressed = model.comments.find((comment) => comment.status === 'addressed');
  if (counts.addressed && firstAddressed) {
    return `<section class="action-callout is-verify"><span class="callout-number">3</span><div><span class="kicker">Your turn</span><h1>${counts.addressed} ${plural(counts.addressed, 'fix')} ready to verify</h1><p>Open the change, decide whether it answers your feedback, then mark it resolved or ask for more work.</p><button class="primary-button verify-button" data-show-comment="${escapeAttribute(firstAddressed.id)}">Review next fix <span aria-hidden="true">→</span></button>${model.review.changedSinceReview ? `<button class="text-button" id="inspect-since">Inspect all ${model.review.changedSinceReview} changed ${plural(model.review.changedSinceReview, 'file')}</button>` : ''}</div></section>`;
  }
  if (counts.open) {
    if (!model.agents.length) return renderAgentSetup('feedback');
    return `<section class="action-callout is-comment"><span class="callout-number">2</span><div><span class="kicker">Ready to send</span><h1>${counts.open} ${plural(counts.open, 'comment')} need the agent</h1><p>The agent will work on your open feedback. Nothing is resolved until you verify it.</p><button class="primary-button comment-button" id="address-feedback">Send ${counts.open} to agent <span aria-hidden="true">→</span></button></div></section>`;
  }
  return `<section class="action-callout is-complete"><span class="callout-number">✓</span><div><span class="kicker">Feedback complete</span><h1>Everything is resolved</h1><p>You verified every response in this review.</p><button class="secondary-button" data-open-mode="changes">Continue reviewing files</button></div></section>`;
}

function renderAgentProgress(model: DiffStoryViewModel): string {
  if (!model.agentRunning) return '';
  return `<section class="agent-running" aria-live="polite"><div><span class="spinner" aria-hidden="true"></span><span><b>Agent is working</b><small id="agent-current-line">${escapeHtml(model.progress.at(-1) ?? 'Starting the agent…')}</small></span></div><button id="stop-agent">Stop</button></section>`;
}

function renderAgentSetup(mode: 'guide' | 'feedback'): string {
  return `<section class="agent-setup ${mode === 'guide' ? 'is-guide' : 'is-comment'}">
    <div class="state-mark ${mode === 'guide' ? 'is-guide' : 'is-comment'}" aria-hidden="true">⌁</div>
    <span class="kicker">Agent setup needed</span>
    <h1>Connect Codex or Claude</h1>
    <p>${mode === 'guide' ? 'A local agent writes the guided review.' : 'A local agent addresses the feedback you send.'} Install the <code>codex</code> or <code>claude</code> CLI, make sure it runs in the VS Code terminal, then check again.</p>
    <button class="primary-button ${mode === 'guide' ? 'guide-button' : 'comment-button'}" id="check-agents">Check agent setup</button>
    <button class="text-button" id="open-agent-help">Open getting started</button>
  </section>`;
}

function renderFeedbackCard(comment: ReviewComment): string {
  const reply = [...(comment.turns ?? [])].reverse().find((turn) => turn.role === 'ai')?.text ?? comment.reply;
  const replyPreview = reply ? truncateText(reply, 220) : undefined;
  const label = comment.status === 'addressed' ? 'Ready to verify' : comment.status === 'open' ? 'Needs agent' : 'Resolved';
  const secondaryAction = comment.status === 'addressed'
    ? `<button data-reopen-comment="${escapeAttribute(comment.id)}">Needs more work</button><button class="resolve-button" data-resolve-comment="${escapeAttribute(comment.id)}">Mark resolved</button>`
    : comment.status === 'resolved'
      ? `<button data-reopen-comment="${escapeAttribute(comment.id)}">Reopen</button>`
      : `<button data-followup-comment="${escapeAttribute(comment.id)}">Add follow-up</button>`;
  return `<article class="feedback-card is-${comment.status}" data-feedback-status="${comment.status}">
    <div class="feedback-card-head"><span class="feedback-state">${label}</span><span class="feedback-kind is-${comment.type}">${escapeHtml(commentTypeLabel(comment.type))}</span></div>
    <h2>${escapeHtml(comment.body)}</h2>
    <button class="feedback-location" data-show-comment="${escapeAttribute(comment.id)}"><code>${escapeHtml(comment.file)}:${comment.line}</code><span aria-hidden="true">↗</span></button>
    ${reply && replyPreview ? `<div class="agent-reply"><span>Agent response</span><p>${escapeHtml(replyPreview)}</p>${replyPreview !== reply ? `<details><summary>Read full response</summary><p>${escapeHtml(reply)}</p></details>` : ''}</div>` : ''}
    ${comment.selectedText ? `<details class="selected-code"><summary>Selected code</summary><pre>${escapeHtml(comment.selectedText)}</pre></details>` : ''}
    <div class="feedback-actions"><button data-show-comment="${escapeAttribute(comment.id)}">Open change</button>${secondaryAction}</div>
  </article>`;
}

function renderActivity(model: DiffStoryViewModel): string {
  const lines = model.progress.slice(-8);
  const events = model.review.events.slice(0, 8);
  if (!lines.length && events.length <= 1) return '';
  return `<details class="activity-log"${model.agentRunning ? ' open' : ''}><summary>Activity</summary>${lines.length ? `<div class="agent-log" id="agent-log">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>` : ''}${events.length ? `<ol>${events.map((event) => `<li><span>${escapeHtml(event.label)}</span><small>Round ${event.round}</small></li>`).join('')}</ol>` : ''}</details>`;
}

function feedbackCounts(comments: ReviewComment[]): { open: number; addressed: number; resolved: number } {
  return comments.reduce((counts, comment) => ({ ...counts, [comment.status]: counts[comment.status] + 1 }), { open: 0, addressed: 0, resolved: 0 });
}

function feedbackRank(status: ReviewComment['status']): number {
  return status === 'addressed' ? 0 : status === 'open' ? 1 : 2;
}

function commentTypeLabel(type: ReviewComment['type']): string {
  return type === 'change' ? 'Change request' : type === 'question' ? 'Question' : 'Nit';
}

function statusDetails(status: string): { short: string; label: string; tone: string } {
  if (status.startsWith('A')) return { short: 'A', label: 'Added', tone: 'added' };
  if (status.startsWith('D')) return { short: 'D', label: 'Deleted', tone: 'deleted' };
  if (status.startsWith('R')) return { short: 'R', label: 'Renamed', tone: 'renamed' };
  if (status === '?') return { short: 'U', label: 'Untracked', tone: 'untracked' };
  return { short: 'M', label: 'Modified', tone: 'modified' };
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function truncateText(value: string, limit: number): string {
  const text = value.trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function webviewCss(): string {
  return `
    * { box-sizing:border-box; }
    :root {
      --ds-bg:var(--vscode-sideBar-background, #181b22);
      --ds-surface:var(--vscode-editor-background, #1f232b);
      --ds-raised:var(--vscode-sideBarSectionHeader-background, #252a34);
      --ds-line:var(--vscode-sideBar-border, #343a46);
      --ds-text:var(--vscode-foreground, #f3f5f7);
      --ds-muted:var(--vscode-descriptionForeground, #9ba6b2);
      --ds-review:var(--vscode-charts-blue, #56b6e9);
      --ds-comment:var(--vscode-charts-orange, #ff8a65);
      --ds-verify:var(--vscode-charts-green, #67d391);
      --ds-guide:var(--vscode-charts-purple, #a78bfa);
      --ds-warning:var(--vscode-charts-yellow, #f5c451);
      --ds-danger:var(--vscode-errorForeground, #ff6b7a);
      --ds-focus:var(--vscode-focusBorder, #56b6e9);
    }
    html { min-width:0; }
    body { background:var(--ds-bg); color:var(--ds-text); font:var(--vscode-font-weight, 400) var(--vscode-font-size, 13px)/1.45 var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif); margin:0; }
    button { color:inherit; font:inherit; }
    button:focus-visible, summary:focus-visible { outline:2px solid var(--ds-focus); outline-offset:2px; }
    button:disabled { cursor:default; opacity:.5; }
    .app-header { border-bottom:1px solid var(--ds-line); padding:13px 14px 11px; }
    .brand-row,.workspace-row,.section-heading,.stop-progress,.progress-copy,.feedback-card-head,.agent-running>div { align-items:center; display:flex; }
    .brand-row,.workspace-row,.section-heading,.stop-progress,.progress-copy { justify-content:space-between; }
    .wordmark { font-size:15px; letter-spacing:-.03em; line-height:1; }
    .wordmark span { color:var(--ds-muted); font-weight:550; }
    .wordmark strong { color:var(--ds-text); font-weight:800; }
    .quiet-button,.text-button { background:none; border:0; color:var(--ds-muted); cursor:pointer; font-size:11px; padding:3px 4px; }
    .quiet-button:hover,.text-button:hover { color:var(--ds-text); text-decoration:underline; }
    .workspace-row { gap:10px; margin-top:10px; }
    .workspace-name { font-size:12px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .repo-switch { align-items:center; background:transparent; border:0; cursor:pointer; display:flex; gap:4px; max-width:42%; padding:0; text-align:left; }
    .repo-switch:hover { color:var(--ds-review); }
    .scope-button { align-items:center; background:transparent; border:0; color:var(--ds-review); cursor:pointer; display:flex; flex:none; font-family:var(--vscode-editor-font-family, monospace); font-size:10px; gap:4px; max-width:58%; overflow:hidden; padding:2px 0; text-overflow:ellipsis; white-space:nowrap; }
    .scope-button:hover { text-decoration:underline; }
    .mode-tabs { background:var(--ds-bg); border-bottom:1px solid var(--ds-line); display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); position:sticky; top:0; z-index:4; }
    .mode-tab { align-items:center; background:transparent; border:0; border-bottom:2px solid transparent; color:var(--ds-muted); cursor:pointer; display:flex; font-size:11px; font-weight:650; gap:5px; justify-content:center; min-width:0; padding:9px 4px 8px; }
    .mode-tab:hover { background:var(--ds-raised); color:var(--ds-text); }
    .mode-tab.is-active { border-bottom-color:var(--ds-review); color:var(--ds-text); }
    .mode-tab[data-mode-tab="guide"].is-active { border-bottom-color:var(--ds-guide); }
    .mode-tab[data-mode-tab="feedback"].is-active { border-bottom-color:var(--ds-comment); }
    .mode-tab b { align-items:center; background:var(--ds-raised); border:1px solid var(--ds-line); border-radius:999px; display:inline-flex; font-size:10px; height:18px; justify-content:center; min-width:18px; padding:0 4px; }
    .mode-tab.has-attention b { background:var(--ds-verify); border-color:var(--ds-verify); color:#10261b; }
    .app-status { align-items:center; border-bottom:1px solid var(--ds-line); display:flex; font-size:11px; gap:8px; padding:9px 14px; }
    .app-status.is-loading { color:var(--ds-muted); }
    .app-status.is-error { align-items:flex-start; background:color-mix(in srgb, var(--ds-danger) 10%, var(--ds-bg)); border-left:3px solid var(--ds-danger); flex-direction:column; }
    .app-status.is-error span { color:var(--ds-muted); }
    .app-status button { background:transparent; border:0; color:var(--ds-danger); cursor:pointer; padding:0; text-decoration:underline; }
    main { min-height:240px; }
    .mode-panel { padding:14px 12px 24px; }
    .center-state { align-items:flex-start; display:flex; flex-direction:column; padding:38px 18px; }
    .compact-state { padding-top:50px; }
    .state-mark { align-items:center; background:color-mix(in srgb, var(--ds-review) 14%, var(--ds-surface)); border:1px solid color-mix(in srgb, var(--ds-review) 52%, var(--ds-line)); border-radius:8px; color:var(--ds-review); display:flex; font-size:20px; height:40px; justify-content:center; margin-bottom:17px; width:40px; }
    .state-mark.is-done { background:color-mix(in srgb, var(--ds-verify) 12%, var(--ds-surface)); border-color:color-mix(in srgb, var(--ds-verify) 52%, var(--ds-line)); color:var(--ds-verify); }
    .state-mark.is-guide { background:color-mix(in srgb, var(--ds-guide) 12%, var(--ds-surface)); border-color:color-mix(in srgb, var(--ds-guide) 52%, var(--ds-line)); color:var(--ds-guide); }
    .state-mark.is-comment { background:color-mix(in srgb, var(--ds-comment) 12%, var(--ds-surface)); border-color:color-mix(in srgb, var(--ds-comment) 52%, var(--ds-line)); color:var(--ds-comment); }
    .kicker { color:var(--ds-muted); display:block; font-size:10px; font-weight:750; letter-spacing:.1em; text-transform:uppercase; }
    h1 { font-size:18px; letter-spacing:-.025em; line-height:1.18; margin:5px 0 8px; }
    .center-state p,.welcome-block p,.guide-intro p,.action-callout p { color:var(--ds-muted); font-size:12px; line-height:1.55; margin:0; }
    .center-state p { max-width:370px; }
    .agent-setup { border-left:3px solid var(--ds-comment); padding:4px 4px 4px 13px; }
    .agent-setup.is-guide { border-left-color:var(--ds-guide); }
    .agent-setup .state-mark { margin-bottom:14px; }
    .agent-setup p { color:var(--ds-muted); font-size:12px; line-height:1.55; margin:0; }
    .agent-setup code { color:var(--ds-text); font-family:var(--vscode-editor-font-family, monospace); }
    .agent-setup .primary-button { margin-top:15px; width:100%; }
    .agent-setup .text-button { display:block; margin:7px 0 0 -4px; }
    .primary-button,.secondary-button { border-radius:5px; cursor:pointer; font-weight:700; padding:7px 9px; }
    .primary-button { background:var(--vscode-button-background, #2777c8); border:1px solid var(--vscode-button-background, #2777c8); color:var(--vscode-button-foreground, #fff); }
    .primary-button:hover { background:var(--vscode-button-hoverBackground, #3489da); border-color:var(--vscode-button-hoverBackground, #3489da); }
    .secondary-button { background:var(--vscode-button-secondaryBackground, #343a46); border:1px solid var(--ds-line); color:var(--vscode-button-secondaryForeground, var(--ds-text)); }
    .secondary-button:hover { background:var(--vscode-button-secondaryHoverBackground, #414957); }
    .center-state .primary-button { margin-top:18px; }
    .center-state .text-button { margin:8px 0 0 -4px; }
    .welcome-block { border-left:3px solid var(--ds-review); padding:3px 3px 3px 13px; }
    .welcome-block h1 { font-size:20px; }
    .large-button { margin-top:16px; padding:9px 11px; width:100%; }
    .welcome-guide-link { display:block; margin:7px 0 0 -4px; }
    .review-summary { display:grid; gap:11px; grid-template-columns:minmax(0,1fr) auto; }
    .review-summary h1 { font-size:18px; margin-bottom:0; }
    .review-summary>.primary-button,.review-summary>.secondary-button { align-self:end; white-space:nowrap; }
    .progress-copy { color:var(--ds-muted); font-family:var(--vscode-editor-font-family, monospace); font-size:10px; grid-column:1 / -1; }
    .progress-track { appearance:none; background:transparent; border:0; border-radius:999px; grid-column:1 / -1; height:4px; overflow:hidden; width:100%; }
    .progress-track::-webkit-progress-bar { background:var(--ds-raised); border-radius:999px; }
    .progress-track::-webkit-progress-value { background:var(--ds-review); border-radius:999px; }
    .progress-track.is-guide::-webkit-progress-value { background:var(--ds-guide); }
    .workflow { display:grid; gap:0; grid-template-columns:repeat(3, minmax(0,1fr)); list-style:none; margin:18px 0 0; padding:0; }
    .workflow li { align-items:flex-start; border-top:1px solid var(--ds-line); color:var(--ds-muted); display:flex; gap:7px; padding:10px 5px 0 0; position:relative; }
    .workflow li::before { background:var(--ds-line); border-radius:999px; content:""; height:5px; left:0; position:absolute; top:-3px; width:5px; }
    .workflow li.is-active { border-top-color:var(--ds-review); color:var(--ds-text); }
    .workflow li.is-active::before { background:var(--ds-review); box-shadow:0 0 0 3px color-mix(in srgb, var(--ds-review) 18%, transparent); }
    .workflow li.is-past { border-top-color:color-mix(in srgb, var(--ds-review) 45%, var(--ds-line)); }
    .workflow li>span { color:var(--ds-muted); font-family:var(--vscode-editor-font-family, monospace); font-size:10px; }
    .workflow b,.workflow small { display:block; }
    .workflow b { font-size:11px; }
    .workflow small { color:var(--ds-muted); font-size:10px; line-height:1.3; margin-top:2px; }
    .attention-strip,.guide-teaser { align-items:center; background:var(--ds-surface); border:1px solid var(--ds-line); border-radius:6px; cursor:pointer; display:grid; grid-template-columns:minmax(0,1fr) auto; margin-top:16px; padding:10px 11px; text-align:left; width:100%; }
    .attention-strip span:first-child,.guide-teaser span:nth-child(2) { min-width:0; }
    .attention-strip b,.attention-strip small,.guide-teaser b,.guide-teaser small { display:block; }
    .attention-strip b,.guide-teaser b { font-size:11px; }
    .attention-strip small,.guide-teaser small { color:var(--ds-muted); font-size:10px; line-height:1.35; margin-top:2px; }
    .attention-strip.is-comment { border-left:3px solid var(--ds-comment); }
    .attention-strip.is-verify { border-left:3px solid var(--ds-verify); }
    .selection-tip { align-items:start; background:color-mix(in srgb, var(--ds-comment) 7%, var(--ds-bg)); border-bottom:1px solid var(--ds-line); border-top:1px solid var(--ds-line); display:grid; gap:8px; grid-template-columns:auto minmax(0,1fr); margin-top:16px; padding:10px 2px; }
    .tip-key,.callout-number { align-items:center; border:1px solid currentColor; border-radius:999px; color:var(--ds-comment); display:flex; font-family:var(--vscode-editor-font-family, monospace); font-size:10px; height:21px; justify-content:center; width:21px; }
    .selection-tip b,.selection-tip small { display:block; }
    .selection-tip b { font-size:11px; }
    .selection-tip small { color:var(--ds-muted); font-size:10px; line-height:1.4; margin-top:2px; }
    .selection-tip em { color:var(--ds-text); font-style:normal; }
    .selection-tip button { background:transparent; border:0; color:var(--ds-comment); cursor:pointer; font-size:10px; grid-column:2; justify-self:start; padding:1px 0; }
    .file-section,.feedback-section { margin-top:20px; }
    .section-heading { align-items:flex-end; gap:10px; margin-bottom:8px; }
    .section-heading strong { display:block; font-size:11px; margin-top:2px; }
    .filter-row { display:flex; gap:3px; overflow:auto; }
    .filter-button { background:transparent; border:1px solid transparent; border-radius:999px; color:var(--ds-muted); cursor:pointer; flex:none; font-size:10px; padding:3px 7px; }
    .filter-button:hover { color:var(--ds-text); }
    .filter-button.is-active { background:var(--ds-raised); border-color:var(--ds-line); color:var(--ds-text); }
    .file-list,.feedback-list { border-top:1px solid var(--ds-line); }
    .file-row { align-items:center; background:transparent; border:0; border-bottom:1px solid var(--ds-line); cursor:pointer; display:grid; gap:8px; grid-template-columns:20px minmax(0,1fr) auto; padding:8px 2px; text-align:left; width:100%; }
    .file-row:hover { background:var(--ds-raised); }
    .file-status { align-items:center; border:1px solid currentColor; border-radius:3px; display:flex; font-family:var(--vscode-editor-font-family, monospace); font-size:10px; font-weight:800; height:20px; justify-content:center; width:20px; }
    .file-status.is-added { color:var(--vscode-gitDecoration-addedResourceForeground, var(--ds-verify)); }
    .file-status.is-deleted { color:var(--vscode-gitDecoration-deletedResourceForeground, var(--ds-danger)); }
    .file-status.is-modified { color:var(--vscode-gitDecoration-modifiedResourceForeground, var(--ds-warning)); }
    .file-status.is-renamed { color:var(--vscode-gitDecoration-renamedResourceForeground, var(--ds-review)); }
    .file-status.is-untracked { color:var(--vscode-gitDecoration-untrackedResourceForeground, var(--ds-verify)); }
    .file-name { min-width:0; }
    .file-name strong,.file-name small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .file-name strong { font-family:var(--vscode-editor-font-family, monospace); font-size:11px; font-weight:650; }
    .file-name small { color:var(--ds-muted); direction:rtl; font-family:var(--vscode-editor-font-family, monospace); font-size:10px; margin-top:2px; text-align:left; }
    .file-meta { color:var(--ds-muted); font-size:10px; text-align:right; white-space:nowrap; }
    .file-meta b { color:var(--ds-comment); font-weight:650; }
    .file-meta .reviewed-mark { color:var(--ds-verify); }
    .show-more { background:transparent; border:0; color:var(--ds-review); cursor:pointer; font-size:10px; padding:8px 2px 0; }
    .filter-empty { color:var(--ds-muted); font-size:10px; margin:12px 0; }
    .guide-teaser { grid-template-columns:26px minmax(0,1fr) auto; }
    .guide-glyph { color:var(--ds-guide); font-size:16px; }
    .guide-teaser.is-warning { border-color:color-mix(in srgb, var(--ds-warning) 58%, var(--ds-line)); }
    .guide-teaser.is-warning .guide-glyph { color:var(--ds-warning); font-weight:800; }
    .guide-page { display:grid; gap:16px; }
    .guide-intro { border-left:3px solid var(--ds-guide); padding-left:12px; }
    .guide-intro h1 { font-size:17px; }
    .guide-intro p { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
    .guide-trust { align-items:flex-start; display:flex; gap:9px; }
    .guide-trust.is-current { background:color-mix(in srgb, var(--ds-verify) 9%, var(--ds-surface)); border:1px solid color-mix(in srgb, var(--ds-verify) 45%, var(--ds-line)); border-radius:6px; color:var(--ds-verify); padding:9px 10px; }
    .guide-trust.is-current b,.guide-trust.is-current small { display:block; }
    .guide-trust.is-current b { font-size:11px; }
    .guide-trust.is-current small { color:var(--ds-muted); font-size:10px; margin-top:2px; }
    .guide-trust.is-warning { background:color-mix(in srgb, var(--ds-warning) 9%, var(--ds-surface)); border:1px solid color-mix(in srgb, var(--ds-warning) 55%, var(--ds-line)); border-radius:6px; display:grid; grid-template-columns:22px minmax(0,1fr); padding:11px; }
    .warning-mark { align-items:center; background:var(--ds-warning); border-radius:999px; color:#2b2108; display:flex; font-size:11px; font-weight:900; height:20px; justify-content:center; width:20px; }
    .guide-trust h2 { font-size:13px; line-height:1.35; margin:3px 0 5px; }
    .guide-trust p { color:var(--ds-muted); font-size:11px; line-height:1.5; margin:0; }
    .guide-recovery { display:grid; gap:6px; margin-top:11px; }
    .guide-recovery button { width:100%; }
    .current-stop { background:var(--ds-surface); border:1px solid var(--ds-line); border-top:3px solid var(--ds-guide); border-radius:6px; padding:12px; }
    .current-stop.is-blocked { border-top-color:var(--ds-warning); opacity:.72; }
    .stop-progress { color:var(--ds-muted); font-family:var(--vscode-editor-font-family, monospace); font-size:10px; }
    .current-stop .progress-track { margin-top:7px; }
    .stop-copy { display:grid; gap:10px; grid-template-columns:24px minmax(0,1fr); margin-top:15px; }
    .stop-number { color:var(--ds-guide); font-family:var(--vscode-editor-font-family, monospace); font-size:11px; }
    .stop-copy h2 { font-size:13px; line-height:1.35; margin:0; }
    .stop-copy code { color:var(--ds-muted); display:block; font-size:10px; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .stop-copy p { color:var(--ds-muted); font-size:10px; line-height:1.45; margin:9px 0 0; }
    .current-stop>.primary-button { margin-top:15px; width:100%; }
    .guide-button { background:var(--ds-guide); border-color:var(--ds-guide); color:#171124; }
    .guide-button:hover { background:color-mix(in srgb, var(--ds-guide) 85%, white); border-color:color-mix(in srgb, var(--ds-guide) 85%, white); }
    .guide-actions { display:grid; gap:6px; grid-template-columns:1fr 1fr; }
    .guide-actions button { font-size:10px; text-align:center; }
    .story-context,.activity-log { border-top:1px solid var(--ds-line); padding-top:11px; }
    .story-context summary,.activity-log summary { color:var(--ds-muted); cursor:pointer; font-size:10px; font-weight:650; }
    .story-context p { color:var(--ds-muted); font-size:10px; line-height:1.45; }
    .story-context b { color:var(--ds-text); }
    .feedback-page { display:grid; gap:16px; }
    .agent-running { align-items:center; background:color-mix(in srgb, var(--ds-guide) 10%, var(--ds-surface)); border:1px solid color-mix(in srgb, var(--ds-guide) 48%, var(--ds-line)); border-radius:6px; display:flex; justify-content:space-between; margin:10px 12px 0; padding:9px 10px; }
    .agent-running>div { gap:8px; }
    .agent-running b,.agent-running small { display:block; }
    .agent-running b { font-size:10px; }
    .agent-running small { color:var(--ds-muted); font-size:10px; margin-top:2px; max-width:210px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .agent-running button { background:transparent; border:0; color:var(--ds-danger); cursor:pointer; font-size:10px; }
    .spinner { animation:spin .8s linear infinite; border:2px solid var(--ds-line); border-right-color:var(--ds-guide); border-radius:50%; display:inline-block; height:14px; width:14px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion:reduce) { .spinner { animation:none; border-right-color:var(--ds-guide); } }
    .action-callout { border-left:3px solid var(--ds-comment); display:grid; gap:10px; grid-template-columns:24px minmax(0,1fr); padding:3px 3px 3px 9px; }
    .action-callout.is-verify { border-left-color:var(--ds-verify); }
    .action-callout.is-verify .callout-number { color:var(--ds-verify); }
    .action-callout.is-complete { border-left-color:var(--ds-verify); }
    .action-callout.is-complete .callout-number { color:var(--ds-verify); }
    .action-callout h1 { font-size:17px; }
    .action-callout .primary-button,.action-callout .secondary-button { margin-top:13px; }
    .action-callout .text-button { display:block; margin-top:5px; }
    .comment-button { background:var(--ds-comment); border-color:var(--ds-comment); color:#28130d; }
    .comment-button:hover { background:color-mix(in srgb, var(--ds-comment) 85%, white); border-color:color-mix(in srgb, var(--ds-comment) 85%, white); }
    .verify-button { background:var(--ds-verify); border-color:var(--ds-verify); color:#10261b; }
    .verify-button:hover { background:color-mix(in srgb, var(--ds-verify) 85%, white); border-color:color-mix(in srgb, var(--ds-verify) 85%, white); }
    .feedback-section { margin-top:0; }
    .feedback-section .section-heading { align-items:flex-start; flex-direction:column; }
    .feedback-card { border-bottom:1px solid var(--ds-line); display:grid; gap:9px; padding:12px 2px; }
    .feedback-state { color:var(--ds-muted); font-size:10px; font-weight:750; letter-spacing:.08em; text-transform:uppercase; }
    .feedback-card.is-addressed .feedback-state { color:var(--ds-verify); }
    .feedback-card.is-open .feedback-state { color:var(--ds-comment); }
    .feedback-kind { border:1px solid var(--ds-line); border-radius:999px; color:var(--ds-muted); font-size:10px; margin-left:auto; padding:2px 6px; }
    .feedback-kind.is-change { border-color:color-mix(in srgb, var(--ds-danger) 52%, var(--ds-line)); color:var(--ds-danger); }
    .feedback-kind.is-question { border-color:color-mix(in srgb, var(--ds-review) 52%, var(--ds-line)); color:var(--ds-review); }
    .feedback-kind.is-nit { border-color:color-mix(in srgb, var(--ds-guide) 52%, var(--ds-line)); color:var(--ds-guide); }
    .feedback-card h2 { font-size:12px; font-weight:650; line-height:1.4; margin:0; white-space:pre-wrap; }
    .feedback-location { align-items:center; background:transparent; border:0; color:var(--ds-review); cursor:pointer; display:flex; gap:7px; justify-content:space-between; min-width:0; padding:0; text-align:left; }
    .feedback-location code { font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .agent-reply { background:var(--ds-surface); border-left:2px solid var(--ds-guide); padding:8px 9px; }
    .agent-reply span { color:var(--ds-guide); font-size:10px; font-weight:750; letter-spacing:.08em; text-transform:uppercase; }
    .agent-reply p { color:var(--ds-muted); font-size:10px; line-height:1.45; margin:4px 0 0; white-space:pre-wrap; }
    .agent-reply details { border-top:1px solid var(--ds-line); margin-top:7px; padding-top:6px; }
    .agent-reply summary { color:var(--ds-text); cursor:pointer; font-size:10px; }
    .selected-code summary { color:var(--ds-muted); cursor:pointer; font-size:10px; }
    .selected-code pre { background:var(--vscode-textCodeBlock-background, var(--ds-surface)); color:var(--ds-muted); font-size:10px; margin:6px 0 0; max-height:90px; overflow:auto; padding:7px; white-space:pre-wrap; }
    .feedback-actions { display:flex; flex-wrap:wrap; gap:5px; }
    .feedback-actions button { background:transparent; border:1px solid var(--ds-line); border-radius:4px; color:var(--ds-muted); cursor:pointer; font-size:10px; padding:4px 6px; }
    .feedback-actions button:hover { border-color:var(--ds-muted); color:var(--ds-text); }
    .feedback-actions .resolve-button { border-color:color-mix(in srgb, var(--ds-verify) 58%, var(--ds-line)); color:var(--ds-verify); }
    .activity-log { margin-top:2px; }
    .activity-log ol { list-style:none; margin:8px 0 0; padding:0; }
    .activity-log li { align-items:center; color:var(--ds-muted); display:flex; font-size:10px; justify-content:space-between; padding:3px 0; }
    .activity-log li small { font-size:10px; }
    .agent-log { background:var(--ds-surface); margin-top:8px; max-height:160px; overflow:auto; padding:7px; }
    .agent-log p { color:var(--ds-muted); font-family:var(--vscode-editor-font-family, monospace); font-size:10px; margin:0 0 4px; }
    body.vscode-light { --ds-surface:var(--vscode-editor-background, #fff); --ds-raised:var(--vscode-sideBarSectionHeader-background, #eef1f5); --ds-line:var(--vscode-sideBar-border, #d6dae1); }
    body.vscode-high-contrast .primary-button,body.vscode-high-contrast .secondary-button,body.vscode-high-contrast .file-row,body.vscode-high-contrast .mode-tab { border:1px solid var(--vscode-contrastBorder); }
    @media (max-width:280px) { .workflow small,.file-meta span { display:none; } .mode-tab { font-size:10px; } .review-summary { grid-template-columns:1fr; } .review-summary>.primary-button,.review-summary>.secondary-button { width:100%; } .section-heading { align-items:flex-start; flex-direction:column; } .file-row { grid-template-columns:20px minmax(0,1fr); } .file-meta { grid-column:2; text-align:left; } }
  `;
}

function webviewScript(initialMode: DiffStoryMode): string {
  return `
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: () => {}, getState: () => undefined, setState: () => {} };
    const saved = vscode.getState?.() || {};
    const modes = ['changes', 'guide', 'feedback'];
    const fileFilters = ['unseen', 'all', 'commented'];
    const feedbackFilters = ['addressed', 'open', 'resolved'];
    let mode = modes.includes(saved.mode) ? saved.mode : '${initialMode}';
    const defaultFileFilter = document.querySelector('[data-file-filter="unseen"].is-active') ? 'unseen' : 'all';
    const defaultFeedbackFilter = document.querySelector('[data-default-feedback-filter]')?.dataset.defaultFeedbackFilter || 'open';
    let fileFilter = fileFilters.includes(saved.fileFilter) ? saved.fileFilter : defaultFileFilter;
    let feedbackFilter = feedbackFilters.includes(saved.feedbackFilter) ? saved.feedbackFilter : defaultFeedbackFilter;
    let filesExpanded = Boolean(saved.filesExpanded);
    let hydrating = true;
    const send = (type, extra = {}) => vscode.postMessage({ type, ...extra });
    const persist = () => { if (!hydrating) vscode.setState?.({ mode, fileFilter, feedbackFilter, filesExpanded, scrollY: window.scrollY }); };
    const selectMode = (next, preserveScroll = false) => {
      mode = next;
      document.querySelectorAll('[data-mode-tab]').forEach((tab) => {
        const active = tab.dataset.modeTab === mode;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      document.querySelectorAll('[data-mode-panel]').forEach((panel) => { panel.hidden = panel.dataset.modePanel !== mode; });
      if (!preserveScroll) window.scrollTo(0, 0);
      persist();
    };
    const applyFileFilter = () => {
      const rows = [...document.querySelectorAll('[data-open-file]')];
      const matching = rows.filter((row) => fileFilter === 'all' || (fileFilter === 'unseen' && row.dataset.fileReviewed !== 'true') || (fileFilter === 'commented' && row.dataset.fileCommented === 'true'));
      rows.forEach((row) => { row.hidden = !matching.includes(row) || (!filesExpanded && matching.indexOf(row) >= 10); });
      document.querySelectorAll('[data-file-filter]').forEach((button) => { const active = button.dataset.fileFilter === fileFilter; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
      const more = document.getElementById('show-more-files');
      if (more) { more.hidden = matching.length <= 10; more.textContent = filesExpanded ? 'Show fewer files' : 'Show ' + (matching.length - 10) + ' more'; }
      const empty = document.getElementById('file-filter-empty');
      if (empty) empty.hidden = matching.length > 0;
      persist();
    };
    const applyFeedbackFilter = () => {
      const cards = [...document.querySelectorAll('[data-feedback-status]')];
      const matching = cards.filter((card) => card.dataset.feedbackStatus === feedbackFilter);
      cards.forEach((card) => { card.hidden = !matching.includes(card); });
      document.querySelectorAll('[data-feedback-filter]').forEach((button) => { const active = button.dataset.feedbackFilter === feedbackFilter; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
      const empty = document.getElementById('feedback-filter-empty');
      if (empty) empty.hidden = matching.length > 0;
      persist();
    };
    document.querySelectorAll('[data-mode-tab],[data-open-mode]').forEach((button) => button.addEventListener('click', () => selectMode(button.dataset.modeTab || button.dataset.openMode)));
    const modeTabs = [...document.querySelectorAll('[data-mode-tab]')];
    modeTabs.forEach((tab, index) => tab.addEventListener('keydown', (event) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? modeTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + modeTabs.length) % modeTabs.length;
      const next = modeTabs[nextIndex];
      selectMode(next.dataset.modeTab);
      next.focus();
    }));
    document.getElementById('refresh')?.addEventListener('click', () => send('refresh'));
    document.getElementById('retry-refresh')?.addEventListener('click', () => send('refresh'));
    document.getElementById('change-scope')?.addEventListener('click', () => send('changeScope'));
    document.getElementById('switch-repo')?.addEventListener('click', () => send('switchRepo'));
    document.getElementById('empty-change-scope')?.addEventListener('click', () => send('changeScope'));
    document.getElementById('open-folder')?.addEventListener('click', () => send('openFolder'));
    document.getElementById('start-review')?.addEventListener('click', () => send('openNextUnseenFile'));
    document.getElementById('open-next')?.addEventListener('click', () => send('openNextUnseenFile'));
    document.getElementById('review-again')?.addEventListener('click', () => send('openChangedFile'));
    document.getElementById('add-from-selection')?.addEventListener('click', () => send('addComment'));
    document.getElementById('empty-add-comment')?.addEventListener('click', () => send('addComment'));
    document.querySelectorAll('[data-open-file]').forEach((button) => button.addEventListener('click', () => send('openFile', { file: button.dataset.openFile })));
    document.querySelectorAll('[data-file-filter]').forEach((button) => button.addEventListener('click', () => { fileFilter = button.dataset.fileFilter; filesExpanded = false; applyFileFilter(); }));
    document.getElementById('show-more-files')?.addEventListener('click', () => { filesExpanded = !filesExpanded; applyFileFilter(); });
    document.getElementById('create-guide')?.addEventListener('click', () => send('generateInteractive'));
    document.getElementById('open-guide-stop')?.addEventListener('click', () => send('resumeReview'));
    document.getElementById('browse-guide')?.addEventListener('click', () => send('browseGuide'));
    document.getElementById('guide-options')?.addEventListener('click', () => send('storyActions'));
    document.getElementById('switch-guide-scope')?.addEventListener('click', () => send('switchToGuideScope'));
    document.getElementById('regenerate-guide')?.addEventListener('click', () => send('generateInteractive'));
    document.getElementById('open-guide-agent-help')?.addEventListener('click', () => send('openGettingStarted'));
    document.getElementById('address-feedback')?.addEventListener('click', () => send('addressInteractive'));
    document.getElementById('check-agents')?.addEventListener('click', () => send('refresh'));
    document.getElementById('open-agent-help')?.addEventListener('click', () => send('openGettingStarted'));
    document.getElementById('stop-agent')?.addEventListener('click', () => send('stopAgent'));
    document.getElementById('inspect-since')?.addEventListener('click', () => send('openSinceFeedback'));
    document.querySelectorAll('[data-show-comment]').forEach((button) => button.addEventListener('click', () => send('showComment', { commentId: button.dataset.showComment })));
    document.querySelectorAll('[data-resolve-comment]').forEach((button) => button.addEventListener('click', () => send('resolveCommentId', { commentId: button.dataset.resolveComment })));
    document.querySelectorAll('[data-reopen-comment]').forEach((button) => button.addEventListener('click', () => send('reopenCommentId', { commentId: button.dataset.reopenComment })));
    document.querySelectorAll('[data-followup-comment]').forEach((button) => button.addEventListener('click', () => send('followUpCommentId', { commentId: button.dataset.followupComment })));
    document.querySelectorAll('[data-feedback-filter]').forEach((button) => button.addEventListener('click', () => { feedbackFilter = button.dataset.feedbackFilter; applyFeedbackFilter(); }));
    window.addEventListener('message', (event) => {
      if (event.data?.type !== 'agentProgress' || !Array.isArray(event.data.lines)) return;
      const lines = event.data.lines.filter((line) => typeof line === 'string');
      const current = document.getElementById('agent-current-line');
      if (current && lines.length) current.textContent = lines[lines.length - 1];
      const log = document.getElementById('agent-log');
      if (log) {
        log.replaceChildren(...lines.slice(-8).map((line) => { const paragraph = document.createElement('p'); paragraph.textContent = line; return paragraph; }));
        log.scrollTop = log.scrollHeight;
      }
    });
    let scrollTimer;
    window.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(persist, 80); }, { passive: true });
    selectMode(mode, true);
    applyFileFilter();
    applyFeedbackFilter();
    requestAnimationFrame(() => { if (saved.scrollY) window.scrollTo(0, saved.scrollY); hydrating = false; persist(); });
  `;
}
