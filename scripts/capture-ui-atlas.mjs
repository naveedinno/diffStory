#!/usr/bin/env node
import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.DIFFSTORY_UI_ATLAS_OUT?.trim() || join(ROOT, 'docs', 'ui-atlas');
const SHOTS = join(OUT, 'screenshots');
const FIXTURE = mkdtempSync(join(tmpdir(), 'diffstory-atlas-fixture-'));
const HOME = mkdtempSync(join(tmpdir(), 'diffstory-atlas-home-'));
const STORY = join(FIXTURE, '.diffstory', 'story.json');
const STORY_HOLD = join(FIXTURE, '.diffstory', 'story.atlas-hold.json');
const viewports = { desktop: { width: 1440, height: 960 }, tablet: { width: 920, height: 820 }, mobile: { width: 390, height: 844 } };
// The panel root is a `data-progress-panel` element after the React rewrite;
// `.ds-pp` was a class name that no longer exists.
const PANEL = '#ds-agentpanel [data-progress-panel], #ds-storystage [data-progress-panel]';

// [category, title, description, state, theme, viewport, route, surface?]
// `surface` names the behaviour the capture has to drive; `state` names the file.
// Every non-review surface is captured at all three viewports plus a
// counter-theme desktop frame, so the pre-React baseline covers layout *and*
// palette for each page rather than desktop-dark only.
const definitions = [
  ['pages','Repository picker','Recent local workspaces and the app front door.','picker-recent','dark','desktop','/repos'],
  ['pages','Repository picker — tablet','Recent workspaces at the tablet width.','picker-recent-tablet','dark','tablet','/repos','picker-recent'],
  ['pages','Repository picker — mobile','Recent workspaces with the icon-only add button and overlaid remove control.','picker-recent-mobile','dark','mobile','/repos','picker-recent'],
  ['pages','Repository picker — light','Recent workspaces in the light palette.','picker-recent-light','light','desktop','/repos','picker-recent'],
  ['pages','Repository picker — empty','The no-repositories-yet state before anything has been opened.','picker-empty','dark','desktop','/repos','picker-empty'],
  ['pages','Repository picker — empty, mobile','The no-repositories-yet state on a phone viewport.','picker-empty-mobile','dark','mobile','/repos','picker-empty'],
  ['pages','Folder browser modal','The repository chooser sheet open over the inert picker.','picker-modal','dark','desktop','/repos','picker-modal'],
  ['pages','Folder browser modal — tablet','The repository chooser sheet at the tablet width.','picker-modal-tablet','dark','tablet','/repos','picker-modal'],
  ['pages','Folder browser modal — mobile','The repository chooser sheet on a phone viewport.','picker-modal-mobile','dark','mobile','/repos','picker-modal'],
  ['pages','Folder browser modal — light','The repository chooser sheet in the light palette.','picker-modal-light','light','desktop','/repos','picker-modal'],
  ['pages','Review history','Saved review, scope health, and queued-comment status.','history-populated','dark','desktop','/repo/diffstory-atlas-fixture/stories'],
  ['pages','Review history — tablet','Saved reviews at the tablet width.','history-populated-tablet','dark','tablet','/repo/diffstory-atlas-fixture/stories','history-populated'],
  ['pages','Review history — mobile','Saved reviews with the stacked row footer on a phone viewport.','history-populated-mobile','dark','mobile','/repo/diffstory-atlas-fixture/stories','history-populated'],
  ['pages','Review history — light','Saved reviews in the light palette.','history-populated-light','light','desktop','/repo/diffstory-atlas-fixture/stories','history-populated'],
  ['pages','Review history — empty','The no-saved-reviews state with the header Start review still present.','history-empty','dark','desktop','/repo/diffstory-atlas-fixture/stories','history-empty'],
  ['pages','Review history — empty, mobile','The no-saved-reviews state on a phone viewport.','history-empty-mobile','dark','mobile','/repo/diffstory-atlas-fixture/stories','history-empty'],
  // An explicit base/head is what actually populates this page. Plain `/change`
  // resolves to the (clean) uncommitted scope, which is why the pre-existing
  // `change-populated` frame was a duplicate of `change-empty` in light theme.
  ['pages','Choose review scope','Branch comparison and changed-file inventory.','change-populated','light','desktop','/repo/diffstory-atlas-fixture/change?base=main&head=feat%2Fspending-limit'],
  ['pages','Choose review scope — tablet','Scope selection below the metrics-ledger breakpoint.','change-populated-tablet','light','tablet','/repo/diffstory-atlas-fixture/change?base=main&head=feat%2Fspending-limit','change-populated'],
  ['pages','Choose review scope — mobile','Scope selection with the icon-only segment tiles on a phone viewport.','change-populated-mobile','light','mobile','/repo/diffstory-atlas-fixture/change?base=main&head=feat%2Fspending-limit','change-populated'],
  ['pages','Choose review scope — dark','Scope selection in the dark palette.','change-populated-dark','dark','desktop','/repo/diffstory-atlas-fixture/change?base=main&head=feat%2Fspending-limit','change-populated'],
  ['pages','Empty working tree','The honest no-change state for the uncommitted scope.','change-empty','dark','desktop','/repo/diffstory-atlas-fixture/change?scope=uncommitted'],
  ['pages','Empty working tree — tablet','The no-change state at the tablet width.','change-empty-tablet','dark','tablet','/repo/diffstory-atlas-fixture/change?scope=uncommitted','change-empty'],
  ['pages','Empty working tree — mobile','The no-change state on a phone viewport.','change-empty-mobile','dark','mobile','/repo/diffstory-atlas-fixture/change?scope=uncommitted','change-empty'],
  ['pages','Empty working tree — light','The no-change state in the light palette.','change-empty-light','light','desktop','/repo/diffstory-atlas-fixture/change?scope=uncommitted','change-empty'],
  ['pages','Ref picker open','The compare panel open with the anchored git-reference listbox.','change-refpicker','dark','desktop','/repo/diffstory-atlas-fixture/change','change-refpicker'],
  ['pages','Ref picker open — tablet','The anchored reference listbox at the tablet width.','change-refpicker-tablet','dark','tablet','/repo/diffstory-atlas-fixture/change','change-refpicker'],
  ['pages','Ref picker open — mobile','The anchored reference listbox on a phone viewport, where compare rows stack.','change-refpicker-mobile','dark','mobile','/repo/diffstory-atlas-fixture/change','change-refpicker'],
  ['pages','Raw diff','Story-free inspection of the exact selected change.','raw-diff','dark','desktop','/repo/diffstory-atlas-fixture/diff?base=main&head=feat%2Fspending-limit'],
  ['pages','Raw diff — tablet','Story-free diff inspection at the tablet width.','raw-diff-tablet','dark','tablet','/repo/diffstory-atlas-fixture/diff?base=main&head=feat%2Fspending-limit','raw-diff'],
  ['pages','Raw diff — mobile','Story-free diff inspection on a phone viewport.','raw-diff-mobile','dark','mobile','/repo/diffstory-atlas-fixture/diff?base=main&head=feat%2Fspending-limit','raw-diff'],
  ['pages','Raw diff — light','Story-free diff inspection in the light palette.','raw-diff-light','light','desktop','/repo/diffstory-atlas-fixture/diff?base=main&head=feat%2Fspending-limit','raw-diff'],
  ['review','Guided review overview','Intent, reading path, scope, and walkthrough entry.','overview','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Code walkthrough step','Focused code, narrative beats, and filmstrip.','code-step','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Concept primer','Rendered mental model between code-review stops.','concept-step','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','All files — unified','Complete file inventory in the primary unified-diff mode.','files-unified','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','All files — split','Side-by-side review with the resizable before/after divider.','files-split','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Review page','Coverage, queued comments, challenge checks, and saved reviews — as a page.','review-menu','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Review comments','Queued comments grouped by file with code anchors, editing, removal, and Copy all.','comment-queue','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Inline comment','A compact selected-code composer with Copy as the default and Queue as persistence.','comment-composer','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Comment anchor','A queued comment traced back to highlighted code without opening a modal.','comment-anchor','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['communication','Agent working','Floating progress panel mid-run: milestones, plan, activity, and the stop control.','pp-running','dark','desktop','/repo/diffstory-atlas-fixture/review','pp-running'],
  ['communication','Agent working — tablet','The floating progress panel at the tablet width.','pp-running-tablet','dark','tablet','/repo/diffstory-atlas-fixture/review','pp-running'],
  ['communication','Agent working — mobile','The progress panel below its 520px head-grid breakpoint.','pp-running-mobile','dark','mobile','/repo/diffstory-atlas-fixture/review','pp-running'],
  ['communication','Agent working — light host','The panel stays dark on a light page; only its ink lifts.','pp-running-light','light','desktop','/repo/diffstory-atlas-fixture/review','pp-running'],
  ['communication','Agent working — panel detail','The running panel captured at element scale.','pp-detail-running','dark','desktop','/repo/diffstory-atlas-fixture/review','pp-detail-running'],
  ['communication','Agent complete','Terminal success: every milestone done, Close replaces Stop.','pp-complete','dark','desktop','/repo/diffstory-atlas-fixture/review','pp-complete'],
  ['communication','Agent stopped','User-cancelled run with an explicit terminal status.','pp-stopped','dark','desktop','/repo/diffstory-atlas-fixture/review','pp-stopped'],
  ['communication','Agent failure','Actionable failure summary with technical details kept collapsed.','pp-failed','dark','desktop','/repo/diffstory-atlas-fixture/review','pp-failed'],
  ['communication','Agent failure — panel detail','The failed panel captured at element scale.','pp-detail-failed','dark','desktop','/repo/diffstory-atlas-fixture/review','pp-detail-failed'],
  ['communication','Agent cannot start','The pre-stream blocked state, before any run events arrive.','pp-blocked','dark','desktop','/repo/diffstory-atlas-fixture/review','pp-blocked'],
  // The storyless intro that hosts the stage variant lives on the diff route
  // with no story file present, not on /review.
  ['communication','Agent working — stage variant','The same panel node re-parented into the storyless intro as the stage variant.','pp-stage','dark','desktop','/repo/diffstory-atlas-fixture/diff?base=main&head=feat%2Fspending-limit','pp-stage'],
  ['responsive','Tablet review','The review workspace at the rail-collapse breakpoint.','tablet-review','dark','tablet','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Mobile walkthrough','Compact chrome and a focused code step on a phone viewport.','mobile-step','light','mobile','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Mobile inline comment','The code-anchored composer in the mobile review flow.','mobile-comment-composer','dark','mobile','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Mobile comments','The comment queue as a full-height mobile workspace.','mobile-comments','dark','mobile','/repo/diffstory-atlas-fixture/review']
].map(([category,title,description,state,theme,viewport,route,surface])=>({category,title,description,state,theme,viewport,route,surface:surface||state}))
  .filter((definition)=>{const selected=process.env.DIFFSTORY_UI_ATLAS_STATES?.split(',').map((state)=>state.trim()).filter(Boolean);return !selected?.length||selected.includes(definition.state);});

// A surface is only "covered" if the frame actually contains it. Each entry is
// a selector that must exist and have a non-zero box before the shutter fires,
// so a blank body or a server error page fails the run instead of shipping as
// coverage.
const evidence = {
  // Attribute, not a class: under Tailwind the class list is styling and churns,
  // so the React surfaces expose deliberate `data-*` hooks for this script.
  'picker-recent':'[data-repo-card]',
  'picker-empty':'[data-recents-empty]',
  'picker-modal':'.ds-scrim.is-shown .ds-sheet',
  'history-populated':'#storyList .story-row',
  'history-empty':'main .empty',
  'change-populated':'.file-card .frow',
  'change-empty':'.file-card .empty-title',
  'change-refpicker':'#refPicker .refpick-row',
  'raw-diff':'.ds-filedetail',
  // The React panel replaced the `ds-pp-*` class names with Tailwind utilities
  // and a deliberate `data-pp-*` hook set. `is-finished` became `data-state`.
  'pp-running':'[data-progress-panel][data-state="running"] [data-pp-plan] [data-pp-step-now]',
  'pp-detail-running':'[data-progress-panel][data-state="running"] [data-pp-plan] [data-pp-step-now]',
  'pp-complete':'[data-progress-panel][data-state="complete"] [data-pp-live][data-tone="done"]',
  'pp-stopped':'[data-progress-panel][data-state="stopped"] [data-pp-live][data-tone="error"]',
  'pp-failed':'[data-progress-panel][data-state="failed"] [data-pp-error]',
  'pp-detail-failed':'[data-progress-panel][data-state="failed"] [data-pp-error]',
  'pp-blocked':'[data-progress-panel][data-state="blocked"] [data-pp-error]',
  'pp-stage':'#ds-storystage [data-progress-panel][data-variant="stage"]'
};

// A frame that quietly contains a load error looks like coverage and is worse
// than no frame at all. So an unexpected `.ds-differror` fails the run, and the
// surfaces that are *known* to be broken right now are listed here, recorded in
// the manifest as `degraded`, and shouted about on stdout. Delete an entry the
// moment its bug is fixed — the run then tells you the note is stale.
const knownDegraded = {};

function browserExecutable(){
  const configured=process.env.DIFFSTORY_ATLAS_BROWSER?.trim();
  const choices=[configured,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/usr/bin/google-chrome','/usr/bin/chromium'];
  return choices.find((path)=>Boolean(path)&&existsSync(path));
}
async function freePort(){return await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();s.close(()=>resolve(a.port));});});}
function fakeCodex(path){
  writeFileSync(path,`#!/usr/bin/env node
let input='';
if(process.argv[2]==='app-server'){
 process.stdin.setEncoding('utf8');process.stdin.on('data',c=>{input+=c;let lines=input.split('\\n');input=lines.pop();for(const line of lines){if(!line.trim())continue;let m;try{m=JSON.parse(line)}catch{continue}if(m.id===1)console.log(JSON.stringify({id:1,result:{}}));if(m.id===2&&m.method==='model/list')console.log(JSON.stringify({id:2,result:{data:[{model:'gpt-5.6-codex',displayName:'GPT-5.6 Codex',hidden:false,isDefault:true}]}}));}});return;
}
console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Generating the review story.'}}));setTimeout(()=>process.exit(0),150);
`);
  chmodSync(path,0o755);
}
// The folder-browser modal lists the server's HOME. A bare temp dir renders the
// "No subfolders here." branch, which hides the row layout the modal exists for,
// so give it a small deterministic tree with one git repo in it.
function seedBrowsableHome(){
  for(const name of ['notes-archive','Projects','Sandbox'])mkdirSync(join(HOME,name),{recursive:true});
  mkdirSync(join(HOME,'workbench-demo','.git'),{recursive:true});
}
function waitReady(url,child){return new Promise((resolve,reject)=>{let tries=0;const tick=async()=>{if(child.exitCode!==null)return reject(new Error('diffStory server exited before capture.'));try{const r=await fetch(url);if(r.ok)return resolve();}catch{}if(++tries>100)return reject(new Error('Timed out waiting for diffStory.'));setTimeout(tick,100);};tick();});}
function setStory(visible){if(visible){if(existsSync(STORY_HOLD))copyFileSync(STORY_HOLD,STORY);return;}if(existsSync(STORY)){copyFileSync(STORY,STORY_HOLD);rmSync(STORY);}}
function themeInit(theme){return `(function(){try{localStorage.clear();localStorage.setItem('ds-theme','${theme}');localStorage.setItem('ds-sidebar-collapsed','0')}catch(e){}})()`;}
async function settled(page){await page.waitForLoadState('domcontentloaded');await page.waitForFunction(()=>document.fonts?document.fonts.status==='loaded':true);await page.waitForTimeout(280);}
async function click(page,selector){const target=page.locator(selector).first();await target.waitFor({state:'attached'});if(await target.isVisible())await target.click();else await target.evaluate((element)=>element.click());await page.waitForTimeout(240);}
async function openFixtureRepo(page,origin,route){
  await page.evaluate(async(path)=>{await fetch('/api/repo/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path})});},FIXTURE);
  await page.goto(origin+route);await settled(page);
}
async function forgetAllRecents(page){
  await page.evaluate(async()=>{
    const list=await fetch('/api/repos/recent').then(r=>r.json()).catch(()=>[]);
    for(const entry of Array.isArray(list)?list:[]){
      if(!entry||!entry.path)continue;
      await fetch('/api/repos/recent',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({path:entry.path})});
    }
  });
}
/**
 * Drive the real ProgressPanel with real ProgressEvent-shaped fixtures.
 * There is no AI agent on PATH during a capture, so the run itself is synthetic
 * — but every pixel is produced by the shipped panel code reacting to the exact
 * event union `src/progress.ts` defines and the server streams as NDJSON.
 */
/**
 * Load the panel's imperative bridge.
 *
 * The review page imports the component from the barrel, not the bundle entry,
 * so `window.diffStoryProgress` is not present until we ask for it. The entry
 * publishes it on load precisely so a non-React driver like this one can mount
 * a panel and step it through fixture events.
 */
async function ensureProgressBridge(page){
  await page.addScriptTag({type:'module',url:'/assets/client/progress.js'});
  await page.waitForFunction(()=>typeof window.diffStoryProgress?.mount==='function',undefined,{timeout:5000});
}

async function progressState(page,kind){
  await ensureProgressBridge(page);
  await page.evaluate((terminal)=>{
    // Mount our own panel rather than reaching into one the review engine owns:
    // two drivers on one panel is not a state the app can ever be in.
    const host=document.querySelector('#ds-storystage')||document.querySelector('#ds-agentpanel');
    if(!host)throw new Error('No progress panel host (#ds-storystage / #ds-agentpanel) on this page.');
    window.__atlasPanel?.unmount();
    const variant=host.id==='ds-storystage'?'stage':'floating';
    const panel=window.diffStoryProgress.mount(host,{variant});
    window.__atlasPanel=panel;
    panel.start();
    if(terminal==='blocked'){
      panel.blocked({label:'No story agent available',detail:'diffStory could not find Claude Code or Codex on this machine. Install one, then start the review again.',technicalDetail:'looked for: claude, codex; PATH had neither'});
      return;
    }
    panel.handle({type:'run_started',workflow:'guided_review'});
    panel.handle({type:'context',agent:'codex',model:'gpt-5.6-codex',repoName:'diffstory-atlas-fixture',base:'main',head:'feat/spending-limit'});
    panel.handle({type:'phase',phase:'reading_changes'});
    panel.handle({type:'plan',items:[
      {text:'Read every changed file and recover the intent',status:'done'},
      {text:'Design a reading path across the spending-limit change',status:'active'},
      {text:'Write the story and verify each code anchor',status:'pending'}
    ]});
    panel.handle({type:'file',label:'Reading changed files · 3 of 8 · src/limits.ts'});
    panel.handle({type:'activity',kind:'narration',label:'The monthly cap moved from a per-request guard into a ledger, so the story has to open with why that boundary changed.'});
    panel.handle({type:'text',data:'reading src/limits.ts\nreading src/api.ts\n'});
    panel.handle({type:'heartbeat',quietMs:9000});
    if(terminal==='complete'){
      panel.handle({type:'phase',phase:'designing_path'});
      panel.handle({type:'phase',phase:'writing_output'});
      panel.handle({type:'phase',phase:'validating_output'});
      panel.handle({type:'run_done',status:'complete',result:{storyWritten:true}});
    }else if(terminal==='stopped'){
      panel.handle({type:'run_done',status:'stopped',result:{}});
    }else if(terminal==='failed'){
      panel.handle({type:'error',label:'The agent stopped before finishing',detail:'No story file was written. Try again, or switch to another agent from review settings.',technicalDetail:'codex exited with code 1 after 42s\nlast line: unable to open src/limits.ts'});
      panel.handle({type:'run_done',status:'failed',result:{}});
    }
  },kind);
  await page.waitForTimeout(200);
}
// The stage variant used to be a re-parent of one singleton node. After the
// React rewrite it is a prop: render the panel inside the story stage with
// variant="stage" instead of moving a node between hosts. All this has to do is
// create the stage host in the right place; progressState() mounts into it and
// picks the variant from the host it lands in.
async function mountPanelInStage(page){
  await page.evaluate(()=>{
    const wrap=document.querySelector('.ds-step.is-intro .ds-introwrap');
    if(!wrap)throw new Error('The storyless intro is not on this page, so the stage variant cannot be mounted.');
    if(!document.getElementById('ds-storystage')){
      const mount=document.createElement('div');
      mount.id='ds-storystage';
      wrap.insertBefore(mount,wrap.querySelector('.ds-storygen-card')||null);
    }
  });
}
async function assertRendered(page,def){
  const selector=evidence[def.surface];
  const failure=await page.evaluate(()=>{const node=document.querySelector('.ds-differror');return node?(node.innerText||'').replace(/\s+/g,' ').trim():'';});
  const expected=knownDegraded[def.surface];
  if(failure&&!expected)throw new Error(`${def.state} rendered a load error, which would ship as fake coverage: ${failure}`);
  if(!failure&&expected)console.warn(`  note: ${def.state} rendered cleanly although its surface is in knownDegraded — either the bug is fixed (drop the entry) or this viewport does not take the broken path.`);
  if(failure)console.warn(`  DEGRADED ${def.state}: ${failure}`);
  const result=await page.evaluate((sel)=>{
    const title=document.title||'';
    const heading=document.querySelector('h1')?.textContent||'';
    if(/—\s*error$/.test(title)||/Couldn't build the review/.test(heading))return {ok:false,reason:`server error page: ${heading.trim()||title}`};
    if((document.body.innerText||'').trim().length<40)return {ok:false,reason:'page body is effectively blank'};
    if(!sel)return {ok:true,reason:''};
    const nodes=Array.from(document.querySelectorAll(sel));
    if(!nodes.length)return {ok:false,reason:`no element matches ${sel}`};
    // Several surfaces keep off-screen duplicates (collapsed file panels, the
    // parked floating panel). One laid-out match is enough to prove the surface
    // is really on the frame.
    if(!nodes.some((node)=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0;}))return {ok:false,reason:`all ${nodes.length} matches for ${sel} have a zero box`};
    return {ok:true,reason:''};
  },selector);
  if(!result.ok)throw new Error(`${def.state} did not render its surface: ${result.reason}`);
  return failure?(expected||failure):'';
}
async function assertReviewPageVisible(page){
  const result=await page.evaluate(()=>{
    const view=document.querySelector('#ds-view-review');
    if(!view||view.hidden)return {visible:false,reason:'review view is missing or hidden'};
    const evidence=document.querySelector('[data-trust-evidence]');
    const rect=view.getBoundingClientRect();
    return {visible:rect.width>0&&rect.height>0&&!!evidence,reason:`review view ${Math.round(rect.width)}x${Math.round(rect.height)}; evidence ${evidence?'present':'missing'}`};
  });
  if(!result.visible)throw new Error(`Review page did not render: ${result.reason}`);
}
// The stage used to be flanked by `[data-ghost-prev]` / `[data-ghost-next]`
// buttons. Neither attribute exists anywhere in `src/` any more (nor at HEAD),
// so the old `expectSideControls` branch could only ever fail. The balance and
// width checks are the part that still describes shipped layout.
async function assertReviewStageGeometry(page){
  const result=await page.evaluate(()=>{
    // The filmstrip is `.ds-dock` since the review-page rework; the old
    // `.ds-filmthread` node is gone, which silently turned this whole check
    // into a guaranteed failure (a zero-box `thread` put the bottom gap at
    // -882px). Same intent, current selector.
    const chrome=document.querySelector('[data-review-chrome]'),stage=document.querySelector('#ds-view-tour>:not(.ds-dock):not(.ds-step-ghost):not([hidden])'),thread=document.querySelector('.ds-dock');
    if(!chrome||!stage||!thread)return {valid:false,reason:'review chrome, active stage, or filmstrip is missing'};
    const chromeRect=chrome.getBoundingClientRect(),stageRect=stage.getBoundingClientRect(),threadRect=thread.getBoundingClientRect();
    const topGap=stageRect.top-chromeRect.bottom,bottomGap=threadRect.top-stageRect.bottom,widthShare=stageRect.width/innerWidth;
    const valid=Math.abs(topGap-bottomGap)<=2&&widthShare>=.7;
    return {valid,reason:`top gap ${Math.round(topGap)}px, bottom gap ${Math.round(bottomGap)}px, stage ${Math.round(widthShare*100)}% of viewport`};
  });
  if(!result.valid)throw new Error(`Review stage geometry is unbalanced: ${result.reason}`);
}
async function main(){
  const executable=browserExecutable();if(!executable)throw new Error('Install Google Chrome or Microsoft Edge, or set DIFFSTORY_ATLAS_BROWSER.');
  mkdirSync(SHOTS,{recursive:true});for(const old of definitions)rmSync(join(SHOTS,`${old.category}-${old.state}.png`),{force:true});
  execFileSync(process.execPath,[join(ROOT,'examples','demo.mjs')],{cwd:ROOT,env:{...process.env,DIFFSTORY_DEMO_DIR:FIXTURE,DIFFSTORY_DEMO_NO_SERVE:'1'},stdio:'pipe'});copyFileSync(STORY,STORY_HOLD);
  seedBrowsableHome();
  const fake=join(HOME,'codex-atlas');fakeCodex(fake);const port=await freePort();const origin=`http://127.0.0.1:${port}`;
  const server=spawn(process.execPath,[join(ROOT,'dist','app-server.js'),'--dir',FIXTURE,'--port',String(port),'--no-open'],{cwd:ROOT,env:{...process.env,HOME,DIFFSTORY_CODEX_BINARY:fake},stdio:['ignore','pipe','pipe']});
  let serverLog='';server.stdout.on('data',c=>serverLog+=c);server.stderr.on('data',c=>serverLog+=c);
  let browser;
  try{
    await waitReady(origin,server);browser=await chromium.launch({headless:true,executablePath:executable,args:['--font-render-hinting=none']});const context=await browser.newContext({viewport:viewports.desktop,colorScheme:'dark',reducedMotion:'reduce'});const page=await context.newPage();
    const shots=[];
    for(const def of definitions){
      setStory(def.surface!=='history-empty'&&def.surface!=='pp-stage');
      await page.setViewportSize(viewports[def.viewport]);await page.addInitScript(themeInit(def.theme));
      // Only the progress panel reads prefers-color-scheme; every other surface
      // is driven by ds-theme, so the emulation stays dark for them.
      await page.emulateMedia({colorScheme:def.surface.startsWith('pp-')&&def.theme==='light'?'light':'dark'});
      let runtimeRoute=def.route.replace('/repo/diffstory-atlas-fixture',`/repo/${encodeURIComponent(basename(FIXTURE))}`);
      if(runtimeRoute.endsWith('/review'))runtimeRoute+='?story=story.json';
      await page.goto(origin+runtimeRoute,{waitUntil:'domcontentloaded'});await settled(page);
      if(def.surface==='picker-recent'){
        await openFixtureRepo(page,origin,'/repos');
      }else if(def.surface==='picker-empty'){
        await forgetAllRecents(page);await page.goto(origin+'/repos');await settled(page);
      }else if(def.surface==='picker-modal'){
        await openFixtureRepo(page,origin,'/repos');
        await click(page,'#quickAddBtn');
        await page.waitForFunction(()=>{const scrim=document.querySelector('.ds-scrim');const list=document.querySelector('#fslist');return !!scrim&&!scrim.hidden&&scrim.classList.contains('is-shown')&&!!list&&!/Loading…/.test(list.textContent||'');},undefined,{timeout:5000});
        await page.waitForTimeout(240);
      }else if(def.surface==='history-populated'||def.surface==='history-empty'){
        await openFixtureRepo(page,origin,runtimeRoute);
      }else if(def.surface==='change-refpicker'){
        await click(page,'[data-open-panel="compare"]');
        await page.locator('#cmpBase').focus();
        await page.waitForFunction(()=>{const picker=document.querySelector('#refPicker');return !!picker&&!picker.hidden&&!!picker.querySelector('.refpick-row');},undefined,{timeout:5000});
        await page.waitForTimeout(240);
      }else if(def.surface==='raw-diff'){
        await page.waitForFunction(()=>{const panel=document.querySelector('.ds-filepanel:not([hidden])');if(!panel)return false;if(panel.querySelector('.ds-differror'))return true;return Array.from(panel.querySelectorAll('[data-comment-code]')).some((node)=>node.getBoundingClientRect().height>0);},undefined,{timeout:15000});
        await page.waitForTimeout(240);
      }else if(def.surface==='code-step'||def.surface==='mobile-step'){
        await click(page,'[data-goto-step="1"]');
      }else if(def.surface==='concept-step'){
        await click(page,'[data-goto-step="1"]');await click(page,'[data-step-index="2"]');
        await page.waitForFunction(()=>{const diagram=document.querySelector('.ds-step:not([hidden]) [data-concept-diagram]');return !!diagram&&['ready','error'].includes(diagram.getAttribute('data-render-state'));});
      }else if(def.surface==='files-unified'||def.surface==='files-split'){
        await click(page,'#ds-tab-files');if(def.surface==='files-split'){await click(page,'.ds-filepanel:not([hidden]) [data-mode="split"]');await page.waitForFunction(()=>document.querySelector('.ds-filepanel:not([hidden]) [data-split-inner]')?.getAttribute('aria-busy')==='false');}
      }else if(def.surface==='review-menu'){
        await click(page,'#ds-tab-review');await assertReviewPageVisible(page);
      }else if(def.surface==='comment-queue'||def.surface==='mobile-comments'){
        await click(page,'#ds-tab-review');await click(page,'[data-review-tab-select="notes"]');
      }else if(def.surface==='comment-composer'||def.surface==='mobile-comment-composer'){
        await click(page,'[data-goto-step="1"]');
        // The step's diff body is lazily loaded, so a fixed 240ms after the
        // click is not enough to have a selectable row on screen.
        await page.waitForFunction(()=>Array.from(document.querySelectorAll('.ds-step:not([hidden]) [data-comment-code][data-comment-side="right"]')).some((node)=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0;}),undefined,{timeout:15000});
        await page.evaluate(()=>{const code=Array.from(document.querySelectorAll('.ds-step:not([hidden]) [data-comment-code][data-comment-side="right"]')).find(node=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0;});if(!code)throw new Error('No visible selectable code row found.');const range=document.createRange();range.selectNodeContents(code);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});
        await page.keyboard.press('c');
        await page.waitForSelector('.ds-composer',{state:'attached',timeout:5000});
        await page.waitForFunction(()=>{const node=document.querySelector('.ds-composer'),scroller=node?.closest('.ds-diffscroll, .ds-filedetail');if(!node||!scroller)return false;const rect=node.getBoundingClientRect(),sr=scroller.getBoundingClientRect(),card=node.closest('.ds-diff'),sticky=card?Array.from(card.querySelectorAll('.ds-difftoolbar,.ds-diffhead')).filter(part=>getComputedStyle(part).position==='sticky'):[],top=sr.top+sticky.reduce((sum,part)=>sum+part.getBoundingClientRect().height,0);return rect.top>=top-1&&rect.bottom<=sr.bottom+1;},undefined,{timeout:5000});
        const composer=await page.evaluate(()=>{const node=document.querySelector('.ds-composer'),style=getComputedStyle(node),rect=node.getBoundingClientRect();return {position:style.position,width:rect.width,height:rect.height,inline:node.parentElement?.classList.contains('ds-diffbody'),modal:node.getAttribute('aria-modal')};});
        if(composer.position==='fixed'||!composer.inline||composer.modal||!composer.width||!composer.height)throw new Error(`Comment composer is not inline and visible: ${JSON.stringify(composer)}`);
      }else if(def.surface==='comment-anchor'){
        await click(page,'#ds-tab-review');await click(page,'[data-review-tab-select="notes"]');await click(page,'[data-goto-comment]');await page.waitForFunction(()=>!!document.querySelector('.ds-comment-anchor-target'),undefined,{timeout:5000});
      }else if(def.surface==='pp-stage'){
        // The diff route opens on the Files view, so the storyless intro that
        // hosts the stage variant is present but not on screen.
        await click(page,'#ds-tab-tour');
        await mountPanelInStage(page);await progressState(page,'running');
        await page.evaluate(()=>document.getElementById('ds-storystage')?.scrollIntoView({block:'center'}));await page.waitForTimeout(240);
      }else if(def.surface.startsWith('pp-')){
        await progressState(page,def.surface.replace('pp-detail-','').replace('pp-',''));
      }
      await page.waitForFunction(()=>!/Loading (?:the split view|this review step)/i.test(document.body.innerText));
      if(def.surface==='overview'||def.surface==='code-step')await assertReviewStageGeometry(page);
      const degraded=await assertRendered(page,def);
      const file=`screenshots/${def.category}-${def.state}.png`,target=join(OUT,file);
      let size;
      if(def.surface.startsWith('pp-detail-')){
        const element=page.locator(PANEL).first();
        await element.screenshot({path:target});
        const box=await element.boundingBox();
        size={width:Math.round(box.width),height:Math.round(box.height)};
      }else{
        await page.screenshot({path:target,fullPage:false});
        size=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
      }
      if(!existsSync(target))throw new Error(`${def.state} produced no file at ${file}`);
      const bytes=readFileSync(target).length;
      if(bytes<2000)throw new Error(`${def.state} produced a suspiciously small ${bytes}-byte PNG`);
      const route=def.route.endsWith('/review')?`${def.route}?story=story.json`:def.route;
      shots.push({category:def.category,title:def.title,description:def.description,state:def.state,theme:def.theme,viewport:def.viewport,surface:def.surface,route,file,width:size.width,height:size.height,...(degraded?{degraded}:{})});
      console.log(`captured ${file} (${size.width}x${size.height}, ${bytes} bytes)`);
    }
    const source=execFileSync('git',['rev-parse','--short','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();const dirty=execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).trim();const manifest={version:1,generatedAt:new Date().toISOString(),source:`commit ${source}${dirty?' + working tree':''} · deterministic demo`,shots};const json=JSON.stringify(manifest,null,2)+'\n';writeFileSync(join(OUT,'manifest.json'),json);writeFileSync(join(OUT,'manifest.js'),`window.DIFFSTORY_UI_ATLAS=${JSON.stringify(manifest)};\n`);console.log(`\nUI atlas: ${relative(ROOT,OUT)}/index.html (${shots.length} frames)`);
    const degradedShots=shots.filter((shot)=>shot.degraded);
    if(degradedShots.length)console.log(`\n${degradedShots.length} frame(s) captured a degraded surface:\n${degradedShots.map((shot)=>`  ${shot.state} — ${shot.degraded}`).join('\n')}`);
  }catch(error){throw new Error(`${error.message}\n${serverLog.trim()}`);}finally{if(browser)await browser.close();server.kill('SIGTERM');rmSync(FIXTURE,{recursive:true,force:true});rmSync(HOME,{recursive:true,force:true});}
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
