import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('macOS updater closes and relaunches an already-running installed app', () => {
  const installer = fs.readFileSync('scripts/install-macos-app.sh', 'utf8');
  assert.match(installer, /pgrep -f -x "\$INSTALLED_EXECUTABLE"/);
  assert.match(installer, /tell application id "local\.diffstory\.desktop" to quit/);
  assert.match(installer, /pkill -TERM -f -x "\$_server_command"/);
  assert.match(installer, /never kill an arbitrary owner/);
  assert.match(installer, /if \(\( RELAUNCH_APP \)\); then\s+\/usr\/bin\/open "\$APP_PATH"/);
});

test('macOS installer builds an iconutil-readable ICNS without iconutil packing', {
  skip: process.platform !== 'darwin',
}, (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffstory-icon-test-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const iconset = path.join(tempDir, 'diffStory.iconset');
  const output = path.join(tempDir, 'diffStory.icns');
  const extracted = path.join(tempDir, 'extracted.iconset');
  const source = path.resolve('macos/DiffStoryApp/icons/icon.png');
  fs.mkdirSync(iconset);

  for (const size of [16, 32, 128, 256, 512]) {
    execFileSync('/usr/bin/sips', [
      '-z', String(size), String(size), source,
      '--out', path.join(iconset, `icon_${size}x${size}.png`),
    ]);
    execFileSync('/usr/bin/sips', [
      '-z', String(size * 2), String(size * 2), source,
      '--out', path.join(iconset, `icon_${size}x${size}@2x.png`),
    ]);
  }

  execFileSync(process.execPath, ['scripts/build-icns.mjs', iconset, output]);
  const icns = fs.readFileSync(output);
  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns');
  assert.equal(icns.readUInt32BE(4), icns.length);

  execFileSync('/usr/bin/iconutil', ['-c', 'iconset', output, '-o', extracted]);
  assert.ok(fs.existsSync(path.join(extracted, 'icon_512x512@2x.png')));
});
