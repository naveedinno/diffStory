#!/usr/bin/env node
import { chromium } from 'playwright-core';
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'ui-atlas');
const SHOTS = join(OUT, 'screenshots');
const FIXTURE = mkdtempSync(join(tmpdir(), 'diffstory-atlas-fixture-'));
const HOME = mkdtempSync(join(tmpdir(), 'diffstory-atlas-home-'));
const STORY = join(FIXTURE, '.diffstory', 'story.json');
const STORY_HOLD = join(FIXTURE, '.diffstory', 'story.atlas-hold.json');
const TASK_ID = '019f78f0-63bb-7bc3-ab45-e697ffefa9ca';
const viewports = { desktop: { width: 1440, height: 960 }, tablet: { width: 920, height: 820 }, mobile: { width: 390, height: 844 } };

const definitions = [
  ['pages','Repository picker','Recent local workspaces and the app front door.','picker-recent','dark','desktop','/repos'],
  ['pages','Review history','Saved review, scope health, and unresolved-note status.','history-populated','dark','desktop','/repo/diffstory-atlas-fixture/stories'],
  ['pages','Choose review scope','Branch comparison and changed-file inventory.','change-populated','light','desktop','/repo/diffstory-atlas-fixture/change'],
  ['pages','Empty working tree','The honest no-change state for the uncommitted scope.','change-empty','dark','desktop','/repo/diffstory-atlas-fixture/change?scope=uncommitted'],
  ['pages','Raw diff','Story-free inspection of the exact selected change.','raw-diff','dark','desktop','/repo/diffstory-atlas-fixture/diff?base=main&head=feat%2Fspending-limit'],
  ['review','Guided review overview','Intent, reading path, scope, and walkthrough entry.','overview','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Code walkthrough step','Focused code, question, narrative beats, and filmstrip.','code-step','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Concept primer','Rendered mental model between code-review stops.','concept-step','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','All files — unified','Complete file inventory in the primary unified-diff mode.','files-unified','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','All files — split','Side-by-side review with the resizable before/after divider.','files-split','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Review status menu','Coverage, notes, challenge checks, and agent destination.','review-menu','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Notes drawer','All review notes, anchors, severity, and verification filters.','notes-drawer','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Anchored conversation','A comment thread placed back beside the code it discusses.','conversation','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['communication','Choose agent task','New and recent Codex tasks with repository context.','task-picker','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['communication','Agent working','Live plan, current activity, destination, and stop control.','agent-running','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['communication','Agent complete','Successful delivery state with the full milestone trail.','agent-complete','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['communication','Agent stopped','User-cancelled run with an explicit terminal status.','agent-stopped','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['communication','Agent failure','Actionable failure summary with technical details kept secondary.','agent-failed','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Tablet review','The review workspace at the rail-collapse breakpoint.','tablet-review','dark','tablet','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Mobile walkthrough','Compact chrome and a focused code step on a phone viewport.','mobile-step','light','mobile','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Mobile notes','Review notes as a full-height mobile workspace.','mobile-notes','dark','mobile','/repo/diffstory-atlas-fixture/review']
].map(([category,title,description,state,theme,viewport,route])=>({category,title,description,state,theme,viewport,route}));

function browserExecutable(){
  const configured=process.env.DIFFSTORY_ATLAS_BROWSER?.trim();
  const choices=[configured,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/usr/bin/google-chrome','/usr/bin/chromium'];
  return choices.find((path)=>Boolean(path)&&existsSync(path));
}
async function freePort(){return await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const a=s.address();s.close(()=>resolve(a.port));});});}
function fakeCodex(path){
  writeFileSync(path,`#!/usr/bin/env node
const TASK='${TASK_ID}';let input='';
if(process.argv[2]==='app-server'){
 process.stdin.setEncoding('utf8');process.stdin.on('data',c=>{input+=c;let lines=input.split('\\n');input=lines.pop();for(const line of lines){if(!line.trim())continue;let m;try{m=JSON.parse(line)}catch{continue}if(m.id===1)console.log(JSON.stringify({id:1,result:{}}));if(m.id===2&&m.method==='thread/list')console.log(JSON.stringify({id:2,result:{data:[{id:TASK,name:'Polish diffStory review flow',preview:'Checking task continuity, comments, and the final review handoff.',updatedAt:Math.floor(Date.now()/1000)-420,source:'appServer'},{id:'019f78f0-63bb-7bc3-ab45-e697ffefa9cb',name:'Investigate exact-cap boundary',preview:'Trace the monthly spending limit and its missing equality test.',updatedAt:Math.floor(Date.now()/1000)-3600,source:'vscode'}]}}));if(m.id===2&&m.method==='model/list')console.log(JSON.stringify({id:2,result:{data:[{model:'gpt-5.6-codex',displayName:'GPT-5.6 Codex',hidden:false,isDefault:true}]}}));if(m.id===2&&m.method==='thread/name/set')console.log(JSON.stringify({id:2,result:{}}));}});return;
}
console.log(JSON.stringify({type:'thread.started',thread_id:TASK}));console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Reviewing the selected comments and their code anchors.'}}));setTimeout(()=>process.exit(0),150);
`);
  chmodSync(path,0o755);
}
function waitReady(url,child){return new Promise((resolve,reject)=>{let tries=0;const tick=async()=>{if(child.exitCode!==null)return reject(new Error('diffStory server exited before capture.'));try{const r=await fetch(url);if(r.ok)return resolve();}catch{}if(++tries>100)return reject(new Error('Timed out waiting for diffStory.'));setTimeout(tick,100);};tick();});}
function setStory(visible){if(visible){if(existsSync(STORY_HOLD))copyFileSync(STORY_HOLD,STORY);return;}if(existsSync(STORY)){copyFileSync(STORY,STORY_HOLD);rmSync(STORY);}}
function themeInit(theme){return `(function(){try{localStorage.clear();localStorage.setItem('ds-theme','${theme}');localStorage.setItem('ds-sidebar-collapsed','0')}catch(e){}})()`;}
async function settled(page){await page.waitForLoadState('domcontentloaded');await page.waitForFunction(()=>document.fonts?document.fonts.status==='loaded':true);await page.waitForTimeout(280);}
async function click(page,selector){const target=page.locator(selector).first();await target.waitFor({state:'attached'});await target.evaluate((element)=>element.click());await page.waitForTimeout(240);}
async function assertReviewMenuVisible(page){
  const result=await page.evaluate(()=>{
    const pop=document.querySelector('[data-review-menu-pop]');
    if(!pop||pop.hidden)return {visible:false,reason:'popover is missing or hidden'};
    const rect=pop.getBoundingClientRect(),wrap=pop.parentElement?.getBoundingClientRect(),button=document.querySelector('[data-review-menu]')?.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+Math.min(96,rect.height/2);
    const hit=document.elementFromPoint(x,y);
    return {visible:!!hit&&(hit===pop||pop.contains(hit)),reason:`popover ${Math.round(rect.width)}x${Math.round(rect.height)} at ${Math.round(rect.left)},${Math.round(rect.top)}; wrap ${Math.round(wrap?.width||0)}x${Math.round(wrap?.height||0)} at ${Math.round(wrap?.left||0)},${Math.round(wrap?.top||0)}; button at ${Math.round(button?.left||0)},${Math.round(button?.top||0)}; computed top ${getComputedStyle(pop).top}; offset parent ${pop.offsetParent?.className||'none'}; hit ${hit?.className||hit?.tagName||'nothing'} at ${Math.round(x)},${Math.round(y)}`};
  });
  if(!result.visible)throw new Error(`Review menu is clipped or covered: ${result.reason}`);
}
async function assertReviewStageGeometry(page,expectSideControls=false){
  const result=await page.evaluate((checkControls)=>{
    const chrome=document.querySelector('[data-review-chrome]'),stage=document.querySelector('#ds-view-tour>:not(.ds-filmthread):not(.ds-step-ghost):not([hidden])'),thread=document.querySelector('.ds-filmthread');
    if(!chrome||!stage||!thread)return {valid:false,reason:'review chrome, active stage, or filmstrip is missing'};
    const chromeRect=chrome.getBoundingClientRect(),stageRect=stage.getBoundingClientRect(),threadRect=thread.getBoundingClientRect();
    const topGap=stageRect.top-chromeRect.bottom,bottomGap=threadRect.top-stageRect.bottom,widthShare=stageRect.width/innerWidth;
    let controlsValid=true,controlReason='';
    if(checkControls&&innerWidth>900){
      const prev=document.querySelector('[data-ghost-prev]'),next=document.querySelector('[data-ghost-next]'),prevRect=prev?.getBoundingClientRect(),nextRect=next?.getBoundingClientRect();
      controlsValid=!!prevRect&&!!nextRect&&!prev.hidden&&!next.hidden&&prevRect.right<=stageRect.left&&nextRect.left>=stageRect.right;
      controlReason=`; prev ${Math.round(prevRect?.left||0)}-${Math.round(prevRect?.right||0)}, stage ${Math.round(stageRect.left)}-${Math.round(stageRect.right)}, next ${Math.round(nextRect?.left||0)}-${Math.round(nextRect?.right||0)}`;
    }
    const valid=Math.abs(topGap-bottomGap)<=2&&widthShare>=.7&&controlsValid;
    return {valid,reason:`top gap ${Math.round(topGap)}px, bottom gap ${Math.round(bottomGap)}px, stage ${Math.round(widthShare*100)}% of viewport${controlReason}`};
  },expectSideControls);
  if(!result.valid)throw new Error(`Review stage geometry is unbalanced: ${result.reason}`);
}
async function progressState(page,status){
  await page.evaluate((terminal)=>{const root=document.querySelector('#ds-agentpanel .ds-pp');root.hidden=false;const panel=new ProgressPanel(root,{});panel.start();panel.handle({type:'run_started',workflow:'address',label:'Addressing comments'});panel.handle({type:'context',agent:'codex',repoName:'diffstory-atlas-fixture',targetCount:2,taskMode:'resume',taskLabel:'Polish diffStory review flow',taskId:'${TASK_ID}'});panel.handle({type:'phase',phase:'reading_changes'});panel.handle({type:'plan',items:[{text:'Trace both review comments to their source',status:'done'},{text:'Fix the exact-cap boundary and response contract',status:'active'},{text:'Run focused tests and report back',status:'pending'}]});panel.handle({type:'activity',kind:'search',label:'Reading src/limits.ts and src/api.ts'});if(terminal==='complete'){panel.handle({type:'phase',phase:'validating_output'});panel.handle({type:'run_done',status:'complete',result:{codeChanged:true}})}else if(terminal==='stopped'){panel.handle({type:'run_done',status:'stopped',result:{}})}else if(terminal==='failed'){panel.handle({type:'error',label:'The agent stopped before finishing',detail:'The selected Codex task could not be resumed. Re-select the task and try again.',technicalDetail:'Expected task ${TASK_ID}; received no task id.'});panel.handle({type:'run_done',status:'failed',result:{}})}},status);
  await page.waitForTimeout(180);
}

async function main(){
  const executable=browserExecutable();if(!executable)throw new Error('Install Google Chrome or Microsoft Edge, or set DIFFSTORY_ATLAS_BROWSER.');
  mkdirSync(SHOTS,{recursive:true});for(const old of definitions)rmSync(join(SHOTS,`${old.category}-${old.state}.png`),{force:true});
  execFileSync(process.execPath,[join(ROOT,'examples','demo.mjs')],{cwd:ROOT,env:{...process.env,DIFFSTORY_DEMO_DIR:FIXTURE,DIFFSTORY_DEMO_NO_SERVE:'1'},stdio:'pipe'});copyFileSync(STORY,STORY_HOLD);
  const fake=join(HOME,'codex-atlas');fakeCodex(fake);const port=await freePort();const origin=`http://127.0.0.1:${port}`;
  const server=spawn(process.execPath,[join(ROOT,'dist','app-server.js'),'--dir',FIXTURE,'--port',String(port),'--no-open'],{cwd:ROOT,env:{...process.env,HOME,DIFFSTORY_CODEX_BINARY:fake},stdio:['ignore','pipe','pipe']});
  let serverLog='';server.stdout.on('data',c=>serverLog+=c);server.stderr.on('data',c=>serverLog+=c);
  let browser;
  try{
    await waitReady(origin,server);browser=await chromium.launch({headless:true,executablePath:executable,args:['--font-render-hinting=none']});const context=await browser.newContext({viewport:viewports.desktop,colorScheme:'dark',reducedMotion:'reduce'});const page=await context.newPage();
    const shots=[];
    for(const def of definitions){
      setStory(true);await page.setViewportSize(viewports[def.viewport]);await page.addInitScript(themeInit(def.theme));
      let runtimeRoute=def.route.replace('/repo/diffstory-atlas-fixture',`/repo/${encodeURIComponent(basename(FIXTURE))}`);
      if(runtimeRoute.endsWith('/review'))runtimeRoute+='?story=story.json';
      await page.goto(origin+runtimeRoute,{waitUntil:'domcontentloaded'});await settled(page);
      if(def.state==='picker-recent'){
        await page.evaluate(async(path)=>{await fetch('/api/repo/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path})});},FIXTURE);await page.goto(origin+'/repos');await settled(page);
      }else if(def.state==='history-populated'){
        await page.evaluate(async(path)=>{await fetch('/api/repo/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path})});},FIXTURE);await page.goto(origin+runtimeRoute);await settled(page);
      }else if(def.state==='code-step'||def.state==='mobile-step'){
        await click(page,'[data-goto-step="1"]');
      }else if(def.state==='concept-step'){
        await click(page,'[data-goto-step="1"]');await click(page,'[data-step-index="2"]');
        await page.waitForFunction(()=>{const diagram=document.querySelector('.ds-step:not([hidden]) [data-concept-diagram]');return !!diagram&&['ready','error'].includes(diagram.getAttribute('data-render-state'));});
      }else if(def.state==='files-unified'||def.state==='files-split'){
        await click(page,'#ds-tab-files');if(def.state==='files-split'){await click(page,'.ds-filepanel:not([hidden]) [data-mode="split"]');await page.waitForFunction(()=>document.querySelector('.ds-filepanel:not([hidden]) [data-split-inner]')?.getAttribute('aria-busy')==='false');}
      }else if(def.state==='review-menu'){
        await click(page,'[data-review-menu]');await assertReviewMenuVisible(page);
      }else if(def.state==='notes-drawer'||def.state==='mobile-notes'){
        await click(page,'[data-review-menu]');await click(page,'[data-feedback-open="feedback"]');
      }else if(def.state==='conversation'){
        await click(page,'[data-review-menu]');await click(page,'[data-feedback-open="feedback"]');await click(page,'[data-goto-comment]');await page.waitForFunction(()=>!!document.querySelector('.ds-thread.is-open .ds-comment-card'));
      }else if(def.state==='task-picker'){
        await click(page,'[data-review-menu]');await click(page,'[data-agent-target-select]');await page.waitForSelector('.ds-agent-task-option');
      }else if(def.state.startsWith('agent-')){
        await progressState(page,def.state.slice('agent-'.length));
      }
      if(!def.state.startsWith('agent-'))await page.waitForFunction(()=>!/Loading (?:the split view|this review step|available tasks)/i.test(document.body.innerText));
      if(def.state==='overview'||def.state==='code-step')await assertReviewStageGeometry(page,def.state==='code-step');
      const file=`screenshots/${def.category}-${def.state}.png`,target=join(OUT,file);await page.screenshot({path:target,fullPage:false});const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));const route=def.route.endsWith('/review')?`${def.route}?story=story.json`:def.route;shots.push({...def,route,file,width:size.width,height:size.height});console.log(`captured ${file}`);
    }
    const source=execFileSync('git',['rev-parse','--short','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();const dirty=execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).trim();const manifest={version:1,generatedAt:new Date().toISOString(),source:`commit ${source}${dirty?' + working tree':''} · deterministic demo`,shots};const json=JSON.stringify(manifest,null,2)+'\n';writeFileSync(join(OUT,'manifest.json'),json);writeFileSync(join(OUT,'manifest.js'),`window.DIFFSTORY_UI_ATLAS=${JSON.stringify(manifest)};\n`);console.log(`\nUI atlas: ${relative(ROOT,OUT)}/index.html (${shots.length} frames)`);
  }catch(error){throw new Error(`${error.message}\n${serverLog.trim()}`);}finally{if(browser)await browser.close();server.kill('SIGTERM');rmSync(FIXTURE,{recursive:true,force:true});rmSync(HOME,{recursive:true,force:true});}
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
