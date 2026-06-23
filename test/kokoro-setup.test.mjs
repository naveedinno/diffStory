// Unit tests for the one-command Kokoro setup path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

test('package exposes a one-command kokoro setup script', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['setup:kokoro'], 'sh scripts/setup-kokoro.sh');
});

test('kokoro setup script creates a Python 3.12 venv without breaking system packages', () => {
  const scriptUrl = new URL('../scripts/setup-kokoro.sh', import.meta.url);
  const script = readFileSync(scriptUrl, 'utf8');
  assert.ok(statSync(scriptUrl).isFile());
  assert.match(script, /python3\.12/);
  assert.match(script, /python@3\.12/);
  assert.match(script, /brew install espeak-ng/);
  assert.match(script, /kokoro>=0\.9\.4/);
  assert.match(script, /soundfile/);
  assert.match(script, /DIFFSTORY_KOKORO_PYTHON/);
  assert.match(script, /\.diffstory\/kokoro-venv/);
  assert.match(script, /sys\.version_info/);
  assert.match(script, /rm -rf "\$VENV_DIR"/);
  assert.match(script, /note\(\)/);
  assert.doesNotMatch(script, /say "Installing Python 3\.12 with Homebrew/);
  assert.doesNotMatch(script, /break-system-packages/);
});
