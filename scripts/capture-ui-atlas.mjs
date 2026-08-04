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

const definitions = [
  ['pages','Repository picker','Recent local workspaces and the app front door.','picker-recent','dark','desktop','/repos'],
  ['pages','Review history','Saved review, scope health, and queued-comment status.','history-populated','dark','desktop','/repo/diffstory-atlas-fixture/stories'],
  ['pages','Choose review scope','Branch comparison and changed-file inventory.','change-populated','light','desktop','/repo/diffstory-atlas-fixture/change'],
  ['pages','Empty working tree','The honest no-change state for the uncommitted scope.','change-empty','dark','desktop','/repo/diffstory-atlas-fixture/change?scope=uncommitted'],
  ['pages','Raw diff','Story-free inspection of the exact selected change.','raw-diff','dark','desktop','/repo/diffstory-atlas-fixture/diff?base=main&head=feat%2Fspending-limit'],
  ['review','Guided review overview','Intent, reading path, scope, and walkthrough entry.','overview','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Code walkthrough step','Focused code, narrative beats, and filmstrip.','code-step','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Concept primer','Rendered mental model between code-review stops.','concept-step','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','All files — unified','Complete file inventory in the primary unified-diff mode.','files-unified','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','All files — split','Side-by-side review with the resizable before/after divider.','files-split','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Review page','Coverage, queued comments, challenge checks, and saved reviews — as a page.','review-menu','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Review comments','Queued comments grouped by file with code anchors, editing, removal, and Copy all.','comment-queue','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Inline comment','A compact selected-code composer with Copy as the default and Queue as persistence.','comment-composer','dark','desktop','/repo/diffstory-atlas-fixture/review'],
  ['review','Comment anchor','A queued comment traced back to highlighted code without opening a modal.','comment-anchor','light','desktop','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Tablet review','The review workspace at the rail-collapse breakpoint.','tablet-review','dark','tablet','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Mobile walkthrough','Compact chrome and a focused code step on a phone viewport.','mobile-step','light','mobile','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Mobile inline comment','The code-anchored composer in the mobile review flow.','mobile-comment-composer','dark','mobile','/repo/diffstory-atlas-fixture/review'],
  ['responsive','Mobile comments','The comment queue as a full-height mobile workspace.','mobile-comments','dark','mobile','/repo/diffstory-atlas-fixture/review']
].map(([category,title,description,state,theme,viewport,route])=>({category,title,description,state,theme,viewport,route}))
  .filter((definition)=>{const selected=process.env.DIFFSTORY_UI_ATLAS_STATES?.split(',').map((state)=>state.trim()).filter(Boolean);return !selected?.length||selected.includes(definition.state);});

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
function waitReady(url,child){return new Promise((resolve,reject)=>{let tries=0;const tick=async()=>{if(child.exitCode!==null)return reject(new Error('diffStory server exited before capture.'));try{const r=await fetch(url);if(r.ok)return resolve();}catch{}if(++tries>100)return reject(new Error('Timed out waiting for diffStory.'));setTimeout(tick,100);};tick();});}
function setStory(visible){if(visible){if(existsSync(STORY_HOLD))copyFileSync(STORY_HOLD,STORY);return;}if(existsSync(STORY)){copyFileSync(STORY,STORY_HOLD);rmSync(STORY);}}
function themeInit(theme){return `(function(){try{localStorage.clear();localStorage.setItem('ds-theme','${theme}');localStorage.setItem('ds-sidebar-collapsed','0')}catch(e){}})()`;}
async function settled(page){await page.waitForLoadState('domcontentloaded');await page.waitForFunction(()=>document.fonts?document.fonts.status==='loaded':true);await page.waitForTimeout(280);}
async function click(page,selector){const target=page.locator(selector).first();await target.waitFor({state:'attached'});if(await target.isVisible())await target.click();else await target.evaluate((element)=>element.click());await page.waitForTimeout(240);}
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
        await click(page,'#ds-tab-review');await assertReviewPageVisible(page);
      }else if(def.state==='comment-queue'||def.state==='mobile-comments'){
        await click(page,'#ds-tab-review');await click(page,'[data-review-tab-select="notes"]');
      }else if(def.state==='comment-composer'||def.state==='mobile-comment-composer'){
        await click(page,'[data-goto-step="1"]');
        await page.evaluate(()=>{const code=Array.from(document.querySelectorAll('.ds-step:not([hidden]) [data-comment-code][data-comment-side="right"]')).find(node=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0;});if(!code)throw new Error('No visible selectable code row found.');const range=document.createRange();range.selectNodeContents(code);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));});
        await page.keyboard.press('c');
        await page.waitForSelector('.ds-composer',{state:'attached',timeout:5000});
        await page.waitForFunction(()=>{const node=document.querySelector('.ds-composer'),scroller=node?.closest('.ds-diffscroll, .ds-filedetail');if(!node||!scroller)return false;const rect=node.getBoundingClientRect(),sr=scroller.getBoundingClientRect(),card=node.closest('.ds-diff'),sticky=card?Array.from(card.querySelectorAll('.ds-difftoolbar,.ds-diffhead')).filter(part=>getComputedStyle(part).position==='sticky'):[],top=sr.top+sticky.reduce((sum,part)=>sum+part.getBoundingClientRect().height,0);return rect.top>=top-1&&rect.bottom<=sr.bottom+1;},undefined,{timeout:5000});
        const composer=await page.evaluate(()=>{const node=document.querySelector('.ds-composer'),style=getComputedStyle(node),rect=node.getBoundingClientRect();return {position:style.position,width:rect.width,height:rect.height,inline:node.parentElement?.classList.contains('ds-diffbody'),modal:node.getAttribute('aria-modal')};});
        if(composer.position==='fixed'||!composer.inline||composer.modal||!composer.width||!composer.height)throw new Error(`Comment composer is not inline and visible: ${JSON.stringify(composer)}`);
      }else if(def.state==='comment-anchor'){
        await click(page,'#ds-tab-review');await click(page,'[data-review-tab-select="notes"]');await click(page,'[data-goto-comment]');await page.waitForFunction(()=>!!document.querySelector('.ds-comment-anchor-target'),undefined,{timeout:5000});
      }
      await page.waitForFunction(()=>!/Loading (?:the split view|this review step)/i.test(document.body.innerText));
      if(def.state==='overview'||def.state==='code-step')await assertReviewStageGeometry(page,def.state==='code-step');
      const file=`screenshots/${def.category}-${def.state}.png`,target=join(OUT,file);await page.screenshot({path:target,fullPage:false});const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));const route=def.route.endsWith('/review')?`${def.route}?story=story.json`:def.route;shots.push({...def,route,file,width:size.width,height:size.height});console.log(`captured ${file}`);
    }
    const source=execFileSync('git',['rev-parse','--short','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();const dirty=execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).trim();const manifest={version:1,generatedAt:new Date().toISOString(),source:`commit ${source}${dirty?' + working tree':''} · deterministic demo`,shots};const json=JSON.stringify(manifest,null,2)+'\n';writeFileSync(join(OUT,'manifest.json'),json);writeFileSync(join(OUT,'manifest.js'),`window.DIFFSTORY_UI_ATLAS=${JSON.stringify(manifest)};\n`);console.log(`\nUI atlas: ${relative(ROOT,OUT)}/index.html (${shots.length} frames)`);
  }catch(error){throw new Error(`${error.message}\n${serverLog.trim()}`);}finally{if(browser)await browser.close();server.kill('SIGTERM');rmSync(FIXTURE,{recursive:true,force:true});rmSync(HOME,{recursive:true,force:true});}
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
