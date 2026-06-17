// Unit tests for the shared agent-run guard. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentPreflight } from '../dist/agent.js';

test('agentPreflight blocks when an agent is already running', () => {
  const r = agentPreflight({ repo: '/r', busy: true, agents: ['claude'] });
  assert.deepEqual(r, { ok: false, status: 409, error: 'An agent run is already in progress.' });
});

test('agentPreflight blocks when no repo is open', () => {
  const r = agentPreflight({ repo: null, busy: false, agents: ['claude'] });
  assert.deepEqual(r, { ok: false, status: 409, error: 'No repo is open.' });
});

test('agentPreflight blocks when no agent CLI is installed', () => {
  const r = agentPreflight({ repo: '/r', busy: false, agents: [] });
  assert.deepEqual(r, {
    ok: false,
    status: 400,
    error: 'No agent CLI found (looked for "claude" and "codex").',
  });
});

test('agentPreflight passes and returns the chosen agent', () => {
  const r = agentPreflight({ repo: '/r', busy: false, agents: ['codex', 'claude'] });
  assert.deepEqual(r, { ok: true, agent: 'codex' });
});
