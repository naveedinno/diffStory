// Unit tests for the shared agent-run guard. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentPreflight } from '../dist/agent.js';

test('agentPreflight blocks (409) when an agent is already running', () => {
  const r = agentPreflight({ repo: '/r', busy: true, agents: ['claude'] });
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.equal(r.stage, 'preflight');
  assert.match(r.label, /already/i);
  assert.ok(r.detail.length > 0);
});

test('agentPreflight blocks (409) when no repo is open', () => {
  const r = agentPreflight({ repo: null, busy: false, agents: ['claude'] });
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
  assert.equal(r.stage, 'preflight');
  assert.match(r.label, /repository/i);
  assert.match(r.detail, /Pick a repository/i);
});

test('agentPreflight blocks (400) when no agent CLI is installed', () => {
  const r = agentPreflight({ repo: '/r', busy: false, agents: [] });
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.stage, 'preflight');
  assert.match(r.label, /agent/i);
  assert.match(r.detail, /claude|codex/i);
});

test('agentPreflight passes and returns the chosen agent', () => {
  const r = agentPreflight({ repo: '/r', busy: false, agents: ['codex', 'claude'] });
  assert.deepEqual(r, { ok: true, agent: 'codex' });
});
