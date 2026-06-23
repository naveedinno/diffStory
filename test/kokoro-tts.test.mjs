// Unit tests for optional Kokoro neural TTS helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  KOKORO_VOICES,
  kokoroPythonCommand,
  kokoroRate,
  kokoroTtsCachePath,
  kokoroTtsUrl,
  kokoroTtsVenvDir,
  kokoroVoiceLabel,
  kokoroVoiceLangCode,
  kokoroVoiceOptions,
  normalizeKokoroText,
  normalizeKokoroVoice,
  synthesizeWithKokoro,
} from '../dist/kokoro-tts.js';

test('kokoro voice selection exposes a curated local model set', () => {
  assert.equal(normalizeKokoroVoice(), 'af_heart');
  assert.equal(normalizeKokoroVoice('heart'), 'af_heart');
  assert.equal(normalizeKokoroVoice('bella'), 'af_bella');
  assert.equal(normalizeKokoroVoice('onyx'), 'am_onyx');
  assert.equal(normalizeKokoroVoice('Daniel'), 'bm_daniel');
  assert.equal(normalizeKokoroVoice('af_heart'), 'af_heart');
  assert.equal(normalizeKokoroVoice('unknown'), 'af_heart');
  assert.equal(kokoroVoiceLabel('af_heart'), 'Heart');
  assert.equal(kokoroVoiceLabel('am_onyx'), 'Onyx');
  assert.equal(kokoroVoiceLabel('bm_daniel'), 'Daniel');
  assert.equal(kokoroVoiceLangCode('af_heart'), 'a');
  assert.equal(kokoroVoiceLangCode('am_onyx'), 'a');
  assert.equal(kokoroVoiceLangCode('bf_emma'), 'b');
  assert.equal(kokoroVoiceLangCode('bm_daniel'), 'b');
  assert.deepEqual(
    kokoroVoiceOptions().map((v) => v.id),
    ['af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'am_adam', 'am_onyx', 'bf_emma', 'bm_daniel'],
  );
  assert.equal(KOKORO_VOICES.af_bella.label, 'Bella');
});

test('kokoro text and speed stay bounded for local synthesis', () => {
  assert.equal(normalizeKokoroText('  hello\n\nthere  '), 'hello\nthere');
  assert.equal(kokoroRate(0.1), 0.6);
  assert.equal(kokoroRate(1), 1);
  assert.equal(kokoroRate(3), 1.5);
  assert.equal(kokoroRate(Number.NaN), 1);
});

test('kokoro cache path and URL are deterministic and voice-sensitive', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-kokoro-home-'));
  try {
    const a = kokoroTtsCachePath(home, { text: 'hello', voice: 'af_heart', rate: 1 });
    const b = kokoroTtsCachePath(home, { text: 'hello', voice: 'heart', rate: 1 });
    const c = kokoroTtsCachePath(home, { text: 'hello again', voice: 'af_heart', rate: 1 });
    const d = kokoroTtsCachePath(home, { text: 'hello', voice: 'af_heart', rate: 1.4 });
    const e = kokoroTtsCachePath(home, { text: 'hello', voice: 'am_onyx', rate: 1 });
    assert.equal(a.path, b.path);
    assert.notEqual(a.path, c.path);
    assert.notEqual(a.path, d.path);
    assert.notEqual(a.path, e.path);
    assert.equal(a.voice, 'af_heart');
    assert.equal(e.voice, 'am_onyx');
    assert.equal(e.langCode, 'a');
    assert.equal(a.rate, 1);
    assert.ok(a.path.startsWith(join(home, '.diffstory', 'tts-cache', 'kokoro')));
    assert.match(a.path, /\.wav$/);
    assert.equal(kokoroTtsUrl(a.id), `/api/tts/kokoro/${a.id}.wav`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('kokoro python command prefers override then managed venv before system python', () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-kokoro-home-'));
  try {
    assert.equal(kokoroTtsVenvDir(home), join(home, '.diffstory', 'kokoro-venv'));
    assert.equal(kokoroPythonCommand(home), 'python3');
    const managedPython = join(home, '.diffstory', 'kokoro-venv', 'bin', 'python');
    mkdirSync(join(home, '.diffstory', 'kokoro-venv', 'bin'), { recursive: true });
    writeFileSync(managedPython, '#!/bin/sh\n', 'utf8');
    assert.equal(kokoroPythonCommand(home), managedPython);
    assert.equal(kokoroPythonCommand(home, '/tmp/custom-python'), '/tmp/custom-python');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('kokoro synthesis can be cancelled while the local process is still running', async () => {
  const home = mkdtempSync(join(tmpdir(), 'ds-kokoro-home-'));
  try {
    const fakePython = join(home, 'slow-python.sh');
    writeFileSync(fakePython, '#!/bin/sh\nsleep 5\n', 'utf8');
    chmodSync(fakePython, 0o755);
    const ctrl = new AbortController();
    const promise = synthesizeWithKokoro(
      home,
      { text: 'this generated speech should be cancelled', voice: 'af_heart', rate: 1 },
      { command: fakePython, signal: ctrl.signal },
    );
    setTimeout(() => ctrl.abort(), 20);
    await assert.rejects(promise, /cancelled/i);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
