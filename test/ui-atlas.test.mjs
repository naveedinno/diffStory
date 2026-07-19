import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const ATLAS=join(ROOT,'docs','ui-atlas');

test('UI atlas is a browsable, machine-readable visual inventory',()=>{
  const manifest=JSON.parse(readFileSync(join(ATLAS,'manifest.json'),'utf8'));
  assert.equal(manifest.version,1);
  assert.ok(manifest.shots.length>=20,'atlas should cover the whole app, not a few hero screens');
  assert.equal(new Set(manifest.shots.map(shot=>shot.file)).size,manifest.shots.length);
  for(const category of ['pages','review','communication','responsive'])assert.ok(manifest.shots.some(shot=>shot.category===category),`missing ${category} coverage`);
  for(const theme of ['light','dark'])assert.ok(manifest.shots.some(shot=>shot.theme===theme),`missing ${theme} theme`);
  for(const viewport of ['desktop','tablet','mobile'])assert.ok(manifest.shots.some(shot=>shot.viewport===viewport),`missing ${viewport} viewport`);
  for(const shot of manifest.shots){assert.ok(shot.title&&shot.description&&shot.state&&shot.route);assert.ok(shot.width>0&&shot.height>0);assert.ok(existsSync(join(ATLAS,shot.file)),`missing ${shot.file}`);}
  const html=readFileSync(join(ATLAS,'index.html'),'utf8');assert.match(html,/manifest\.js/);assert.match(html,/data-filter="communication"/);assert.match(html,/class="lightbox"/);
});
