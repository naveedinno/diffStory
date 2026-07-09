// Unit tests for the one-command Kokoro setup path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

test('package exposes a one-command kokoro setup script', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['setup:kokoro'], 'sh scripts/setup-kokoro.sh');
});

test('README keeps the core clone-and-run path free of Python setup', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /No Python is required for the core app\./);
  assert.match(readme, /Kokoro AI voice is optional/);
});

test('kokoro setup script accepts any compatible Python without breaking system packages', () => {
  const scriptUrl = new URL('../scripts/setup-kokoro.sh', import.meta.url);
  const script = readFileSync(scriptUrl, 'utf8');
  assert.ok(statSync(scriptUrl).isFile());
  assert.match(script, /find_compatible_python/);
  assert.match(script, /3\.10/);
  assert.match(script, /3\.11/);
  assert.match(script, /python3\.12/);
  assert.match(script, /brew install espeak-ng/);
  assert.match(script, /kokoro>=0\.9\.4/);
  assert.match(script, /soundfile/);
  assert.match(script, /DIFFSTORY_KOKORO_PYTHON/);
  assert.match(script, /\.diffstory\/kokoro-venv/);
  assert.match(script, /sys\.version_info/);
  assert.match(script, /rm -rf "\$VENV_DIR"/);
  assert.match(script, /note\(\)/);
  assert.doesNotMatch(script, /find_python312/);
  assert.doesNotMatch(script, /Python 3\.12 is required/);
  assert.doesNotMatch(script, /Kokoro needs Python 3\.12/);
  assert.doesNotMatch(script, /break-system-packages/);
});
