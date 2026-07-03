// Unit tests for the app-owned progress protocol. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE_LABELS, phaseRank, observedPhase,
  runStarted, contextEvent, phaseEvent, fileEvent, commandEvent,
  activityEvent, toolEvent, textEvent, heartbeatEvent, warningEvent,
  errorEvent, doneEvent, planEvent,
} from '../dist/progress.js';

test('runStarted and contextEvent carry workflow + context fields', () => {
  assert.deepEqual(runStarted('guided_review', 'Generating guided review'), {
    type: 'run_started', workflow: 'guided_review', label: 'Generating guided review',
  });
  const ctx = contextEvent({
    repoName: 'SmartDiffChecker', repoPath: '/r', workflow: 'detailed_audit',
    agent: 'claude', model: 'opus', base: 'main', head: 'working tree',
    targetCount: undefined,
  });
  assert.equal(ctx.type, 'context');
  assert.equal(ctx.repoName, 'SmartDiffChecker');
  assert.equal(ctx.agent, 'claude');
  assert.equal(ctx.model, 'opus');
  assert.equal(ctx.base, 'main');
});

test('phaseEvent fills the default label and keeps detail optional', () => {
  assert.deepEqual(phaseEvent('reading_changes'), {
    type: 'phase', phase: 'reading_changes', label: PHASE_LABELS.reading_changes,
  });
  const e = phaseEvent('writing_output', 'Writing the story', 'story.json');
  assert.deepEqual(e, {
    type: 'phase', phase: 'writing_output', label: 'Writing the story', detail: 'story.json',
  });
});

test('PHASE_LABELS covers every phase', () => {
  for (const p of [
    'idle', 'preflight', 'resolving_context', 'preparing_prompt', 'starting_agent',
    'agent_running', 'reading_changes', 'recovering_why', 'designing_path', 'writing_output', 'validating_output',
    'applying_results', 'complete', 'failed', 'stopped',
  ]) {
    assert.equal(typeof PHASE_LABELS[p], 'string');
    assert.ok(PHASE_LABELS[p].length > 0);
  }
});

test('phaseRank is monotonic along the spine and sinks terminal failures', () => {
  assert.ok(phaseRank('preflight') < phaseRank('agent_running'));
  assert.ok(phaseRank('agent_running') < phaseRank('writing_output'));
  assert.ok(phaseRank('writing_output') < phaseRank('complete'));
  assert.ok(phaseRank('failed') >= phaseRank('complete'));
  assert.ok(phaseRank('stopped') >= phaseRank('complete'));
});

test('file/command/activity/tool/text helpers build readable labels', () => {
  assert.deepEqual(fileEvent('read', 'Read', 'src/x.ts'), {
    type: 'file', action: 'read', rawTool: 'Read', target: 'src/x.ts', label: 'Reading src/x.ts',
  });
  assert.equal(fileEvent('write', 'Write', 'a/story.json').label, 'Writing a/story.json');
  const cmd = commandEvent('git   diff --stat');
  assert.equal(cmd.type, 'command');
  assert.equal(cmd.command, 'git diff --stat');
  assert.equal(cmd.label, '$ git diff --stat');
  assert.deepEqual(activityEvent('search', 'Grep foo'), { type: 'activity', kind: 'search', label: 'Grep foo' });
  assert.deepEqual(toolEvent('DoThing x', 'DoThing', 'x'), { type: 'tool', label: 'DoThing x', rawTool: 'DoThing', target: 'x' });
  assert.deepEqual(textEvent('hi'), { type: 'text', data: 'hi' });
});

test('heartbeat/warning/error/done helpers carry their fields', () => {
  assert.deepEqual(heartbeatEvent(7000), { type: 'heartbeat', quietMs: 7000 });
  assert.deepEqual(warningEvent('No files changed', 'answered only'), {
    type: 'warning', label: 'No files changed', detail: 'answered only',
  });
  assert.deepEqual(errorEvent('preflight', 'No repository is open', 'Pick one first.'), {
    type: 'error', stage: 'preflight', label: 'No repository is open', detail: 'Pick one first.',
  });
  assert.deepEqual(doneEvent('complete', { storyWritten: true }), {
    type: 'run_done', status: 'complete', result: { storyWritten: true },
  });
  assert.deepEqual(doneEvent('stopped'), { type: 'run_done', status: 'stopped' });
});

test('observedPhase proves reading on reads/searches and writing on target writes only', () => {
  assert.equal(observedPhase(fileEvent('read', 'Read', 'a.ts'), false), 'reading_changes');
  assert.equal(observedPhase(activityEvent('search', 'Grep x'), false), 'reading_changes');
  assert.equal(observedPhase(fileEvent('write', 'Write', 'a.ts'), false), null);
  assert.equal(observedPhase(fileEvent('write', 'Write', 'story.json'), true), 'writing_output');
  assert.equal(observedPhase(fileEvent('edit', 'Edit', 'a.ts'), true), 'writing_output');
  assert.equal(observedPhase(fileEvent('edit', 'Edit', 'a.ts'), false), null);
  assert.equal(observedPhase(textEvent('hello'), true), null);
});

test('phaseRank throws on a phase missing from PHASE_ORDER', () => {
  assert.throws(() => phaseRank('not_a_phase'), /unknown phase/);
});

test('planEvent carries the agent checklist verbatim', () => {
  assert.deepEqual(
    planEvent([
      { text: 'Read the diff', status: 'done' },
      { text: 'Drafting the story', status: 'active' },
      { text: 'Check coverage', status: 'pending' },
    ]),
    {
      type: 'plan',
      items: [
        { text: 'Read the diff', status: 'done' },
        { text: 'Drafting the story', status: 'active' },
        { text: 'Check coverage', status: 'pending' },
      ],
    },
  );
});

test('story phases slot between reading and writing, with labels', () => {
  assert.ok(phaseRank('reading_changes') < phaseRank('recovering_why'));
  assert.ok(phaseRank('recovering_why') < phaseRank('designing_path'));
  assert.ok(phaseRank('designing_path') < phaseRank('writing_output'));
  assert.equal(PHASE_LABELS.recovering_why, 'Recovering the why');
  assert.equal(PHASE_LABELS.designing_path, 'Designing the reading path');
});

test('observedPhase proves recovering_why on intent-evidence commands only', () => {
  assert.equal(observedPhase(commandEvent('git log --oneline -15 main..HEAD'), false), 'recovering_why');
  assert.equal(observedPhase(commandEvent('gh pr view --json title,body'), false), 'recovering_why');
  assert.equal(observedPhase(commandEvent('git diff --stat'), false), null);
  assert.equal(observedPhase(commandEvent('npm test'), false), null);
});
