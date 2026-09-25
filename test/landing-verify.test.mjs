// Landing verification against a real repository: callers must share a file
// with the symbol, gates must be written in the step's file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { landingSearchName, verifyLandings } from '../dist/landing-verify.js';

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'ds-landing-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  writeFileSync(join(dir, 'rate.ts'), 'export function capRate(rate: number, cap: number) {\n  return Math.min(rate, cap);\n}\n');
  writeFileSync(join(dir, 'settle.ts'), "import { capRate } from './rate';\nexport function settleFunding(rate: number) {\n  return capRate(rate, 100);\n}\n");
  writeFileSync(join(dir, 'relay.sol'), 'function relayBatch(bytes calldata ops) external onlyRole(RELAYER_ROLE) {\n}\n');
  git('add', '.');
  git('commit', '-qm', 'base');
  return { dir, git };
}

const tourWith = (file, landing, head) => ({
  version: 3, title: 'T', summary: 's', ...(head ? { head, base: 'HEAD~0' } : {}),
  steps: [{ id: 's1', order: 1, title: 't', kind: 'changed', file, range: [1, 1], why: 'w', landing }],
});

test('landingSearchName keeps the searchable part of a symbol', () => {
  assert.equal(landingSearchName('settleFunding()'), 'settleFunding');
  assert.equal(landingSearchName('GaslessLayer.relayBatch(bytes)'), 'relayBatch');
  assert.equal(landingSearchName('Foo::bar'), 'bar');
  assert.equal(landingSearchName('.ds-main'), '.ds-main');
});

test('a real caller passes; a description, an invented caller, and the symbol itself fail', () => {
  const { dir } = repo();
  try {
    assert.deepEqual(verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['settleFunding()'] })).errors, []);
    const vague = verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['every review page'] })).errors;
    assert.match(vague[0], /is a description, not a symbol/);
    const invented = verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['ghostCaller()'] })).errors;
    assert.match(invented[0], /no file in the repository mentions both it and "capRate"/);
    const self = verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['capRate()'] })).errors;
    assert.match(self[0], /is the symbol itself/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the symbol must be in the step file, and a role gate must be written there', () => {
  const { dir } = repo();
  try {
    assert.match(verifyLandings(dir, tourWith('settle.ts', { symbol: 'missingThing()', calledBy: ['settleFunding()'] })).errors[0], /does not appear in settle.ts/);
    assert.deepEqual(verifyLandings(dir, tourWith('relay.sol', { symbol: 'relayBatch()', role: { who: 'relayer', gate: 'onlyRole(RELAYER_ROLE)' } })).errors, []);
    assert.match(verifyLandings(dir, tourWith('relay.sol', { symbol: 'relayBatch()', role: { who: 'relayer', gate: 'onlyOwner' } })).errors[0], /role.gate "onlyOwner" does not appear/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fixed-head stories are verified at head; working-tree stories include untracked files', () => {
  const { dir, git } = repo();
  try {
    const head = git('rev-parse', 'HEAD').trim();
    assert.deepEqual(verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['settleFunding()'] }, head)).errors, []);
    writeFileSync(join(dir, 'keeper.ts'), "import { capRate } from './rate';\nexport function runKeeper() { return capRate(1, 2); }\n");
    assert.deepEqual(verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['runKeeper()'] })).errors, [], 'untracked caller counts in the working tree');
    assert.ok(verifyLandings(dir, tourWith('rate.ts', { symbol: 'capRate()', calledBy: ['runKeeper()'] }, head)).errors.length, 'but not at a head where it does not exist');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
