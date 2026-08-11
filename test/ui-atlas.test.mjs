import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const ATLAS=join(ROOT,'docs','ui-atlas');
const manifest=JSON.parse(readFileSync(join(ATLAS,'manifest.json'),'utf8'));

// A surface captured at one width and one theme cannot tell you whether a
// rewrite broke the other five combinations. These are the surfaces the React
// rewrite replaces wholesale, so each one has to be pinned at every viewport.
const everyViewport=['picker-recent','picker-modal','history-populated','change-populated','change-empty','change-refpicker','raw-diff','pp-running'];
const bothThemes=['picker-recent','picker-modal','history-populated','change-populated','change-empty','raw-diff'];
// The progress panel had no frame at all before the rewrite baseline. Its
// terminal states diverge sharply from the running one — different title,
// different live row, Close instead of Stop — so a running-only capture would
// miss most of the surface.
const panelStates=['pp-running','pp-complete','pp-stopped','pp-failed','pp-blocked','pp-stage'];

test('UI atlas is a browsable, machine-readable visual inventory',()=>{
  assert.equal(manifest.version,1);
  assert.ok(manifest.shots.length>=20,'atlas should cover the whole app, not a few hero screens');
  assert.equal(new Set(manifest.shots.map(shot=>shot.file)).size,manifest.shots.length);
  for(const category of ['pages','review','communication','responsive'])assert.ok(manifest.shots.some(shot=>shot.category===category),`missing ${category} coverage`);
  for(const theme of ['light','dark'])assert.ok(manifest.shots.some(shot=>shot.theme===theme),`missing ${theme} theme`);
  for(const viewport of ['desktop','tablet','mobile'])assert.ok(manifest.shots.some(shot=>shot.viewport===viewport),`missing ${viewport} viewport`);
  for(const shot of manifest.shots){assert.ok(shot.title&&shot.description&&shot.state&&shot.route);assert.ok(shot.surface,`${shot.state} does not name the surface it captures`);assert.ok(shot.width>0&&shot.height>0);assert.ok(existsSync(join(ATLAS,shot.file)),`missing ${shot.file}`);}
  const html=readFileSync(join(ATLAS,'index.html'),'utf8');assert.match(html,/manifest\.js/);assert.match(html,/data-filter="communication"/);assert.match(html,/class="lightbox"/);
});

test('every rewritten surface is pinned at all three viewports',()=>{
  for(const surface of everyViewport){
    const captured=new Set(manifest.shots.filter(shot=>shot.surface===surface).map(shot=>shot.viewport));
    for(const viewport of ['desktop','tablet','mobile'])assert.ok(captured.has(viewport),`${surface} has no ${viewport} frame`);
  }
});

test('every rewritten page surface is pinned in both themes',()=>{
  for(const surface of bothThemes){
    const captured=new Set(manifest.shots.filter(shot=>shot.surface===surface).map(shot=>shot.theme));
    for(const theme of ['light','dark'])assert.ok(captured.has(theme),`${surface} has no ${theme} frame`);
  }
});

test('the progress panel is captured in its running, terminal and stage states',()=>{
  for(const surface of panelStates)assert.ok(manifest.shots.some(shot=>shot.surface===surface),`progress panel state ${surface} is not captured`);
  assert.ok(manifest.shots.some(shot=>shot.surface==='pp-running'&&shot.viewport==='mobile'),'the panel needs a frame below its 520px head-grid breakpoint');
});

test('documented empty states are captured, not just populated ones',()=>{
  for(const surface of ['picker-empty','history-empty','change-empty'])assert.ok(manifest.shots.some(shot=>shot.surface===surface),`missing the ${surface} empty state`);
});

test('a frame that captured a broken surface says so instead of passing as coverage',()=>{
  // `degraded` is written by capture-ui-atlas.mjs when a frame contains a
  // `.ds-differror`. It must never be an empty marker: a frame either shows a
  // healthy surface or explains what was broken when it was taken.
  for(const shot of manifest.shots){
    if(!('degraded' in shot))continue;
    assert.equal(typeof shot.degraded,'string');
    assert.ok(shot.degraded.trim().length>20,`${shot.state} is flagged degraded without saying why`);
  }
});

test('the baseline captured before the React rewrite is preserved alongside the live atlas',()=>{
  // The live screenshots are overwritten by every atlas run. This copy is the
  // only "before" that survives, so the rewrite can be diffed against it.
  const baseline=join(ATLAS,'baseline-pre-react');
  assert.ok(existsSync(join(baseline,'README.md')),'the baseline needs a README recording what it is');
  const readme=readFileSync(join(baseline,'README.md'),'utf8');
  assert.match(readme,/2026-08-09/,'the baseline README must record when it was taken');
  assert.match(readme,/[0-9a-f]{40}/,'the baseline README must record the git HEAD it was taken at');
  // Deliberately not compared against the live manifest: the baseline is a
  // frozen point in time and must not have to be re-taken every time a new
  // frame is added to the live atlas. What matters is that it is internally
  // complete and covers the surfaces the rewrite replaces.
  const frozen=JSON.parse(readFileSync(join(baseline,'manifest.json'),'utf8'));
  for(const shot of frozen.shots)assert.ok(existsSync(join(baseline,shot.file)),`baseline is missing ${shot.file}`);
  const surfaces=new Set(frozen.shots.map(shot=>shot.surface));
  for(const surface of [...everyViewport,...panelStates])assert.ok(surfaces.has(surface),`the pre-rewrite baseline never captured ${surface}`);
});
