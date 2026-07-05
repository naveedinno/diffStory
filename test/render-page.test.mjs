// Unit tests for the rendered review page shell. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderFullFile, renderPage, renderSplitHunks } from '../dist/render.js';

const tour = {
  version: 1,
  title: 'Tiny tour',
  summary: 'One changed line.',
  steps: [
    {
      id: 's1',
      order: 1,
      title: 'Changed line',
      file: 'a.ts',
      range: [1, 1],
      kind: 'changed',
      why: 'I changed this line so the next helper receives the value it needs.',
    },
  ],
};

const files = [
  {
    oldPath: 'a.ts',
    newPath: 'a.ts',
    status: 'modified',
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [{ type: 'add', content: 'next', newNo: 1 }],
      },
    ],
  },
];

test('agent activity console starts hidden and idle', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /<div id="ds-agentpanel">/);
  assert.match(html, /class="ds-pp" data-variant="floating" hidden aria-live="polite"/);
  assert.match(html, /class="ds-pp-spin" aria-hidden="true" hidden/);
  assert.match(html, /class="ds-pp-title"/);
});

test('rail step numbers stay stable after visiting steps', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /c\.classList\.toggle\('is-visited',isV\)/);
  assert.match(html, /num\.textContent=String\(idx\)/);
  assert.doesNotMatch(html, /isD\?'✓'/);
});

test('step narrative is labeled as story, not why-this-step', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, />Story<\/span>/);
  assert.doesNotMatch(html, /Why this step/);
});

test('story text cannot take over the diff viewport when read aloud is off', () => {
  const longTour = {
    ...tour,
    steps: [
      {
        ...tour.steps[0],
        why: Array(18)
          .fill('I changed this path to explain the behavior, but the real diff still needs to stay visible.')
          .join(' '),
      },
    ],
  };
  const html = renderPage({ repo: process.cwd(), tour: longTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /\.ds-why\{[^}]*max-height:min\(24vh,190px\)[^}]*overflow-y:auto/s);
  assert.match(html, /\.ds-diffscroll\{[^}]*min-height:180px/s);
  assert.match(html, /@media \(max-height:760px\)\{\.ds-why\{max-height:120px\}\.ds-diffscroll\{min-height:160px\}\}/);
});

test('review page can return to the story chooser', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [], routeBase: '/repo/demo' });
  assert.match(html, /class="ds-back" data-close-story href="\/repo\/demo\/stories"/);
  assert.match(html, /Stories\s*<\/a>/);
  assert.match(html, /\.ds-back\{/);
  assert.doesNotMatch(html, /\.ds-close-story\{/);
  assert.match(html, /@media \(max-width:720px\)\{:root\{--ds-rail-width:240px\}\.ds-top\{[^}]+\}\.ds-word,\.ds-vsep,\.ds-status,\.ds-settings-wrap,\.ds-actions\{display:none\}/);
  assert.match(html, /getComputedStyle\(document\.documentElement\)\.getPropertyValue\('--ds-rail-width'\)/);
});

test('toolbar consolidates final review actions into one clear menu', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /data-review-menu/);
  assert.match(html, /data-review-menu-pop/);
  assert.match(html, />Review actions</);
  assert.match(html, />Send open comments</);
  assert.match(html, />Ask for fixes</);
  assert.match(html, /Mark approved/);
  assert.doesNotMatch(html, />Request changes</);
  assert.doesNotMatch(html, />Approve</);
});

test('submitting a comment sends it to the agent immediately', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /data-selection-menu/);
  assert.match(html, />Ask<\/button>/);
  assert.match(html, />Ask for change<\/button>/);
  assert.match(html, />Nit<\/button>/);
  assert.match(html, /ta\.placeholder='Comment on the selected text…'/);
  assert.match(html, /document\.addEventListener\('contextmenu',openSelectionMenu\)/);
  assert.doesNotMatch(html, /Leave a comment on this line/);
  assert.doesNotMatch(html, /ds-addcomment/);
  assert.doesNotMatch(html, /then Ask agent/);
  assert.match(html, /'Add comment'/);
  assert.match(html, /'Ask now'/);
  assert.match(html, /allComments\.push\(c\);removeComposer\(box\);syncThreads\(\);refreshCount\(\);/);
  assert.match(html, /if\(run\)sendToAgent\(\[c\.id\]\)/);
});

test('review sidebar can be grabbed, resized, and remembered', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /data-sidebar-resizer/);
  assert.match(html, /role="separator" aria-orientation="vertical"/);
  assert.match(html, /--ds-rail-width:316px/);
  assert.match(html, /\.ds-rail\{[^}]*width:var\(--ds-rail-width,316px\)/s);
  assert.match(html, /\.ds-rail-resizer\{[^}]*cursor:col-resize/s);
  assert.match(html, /body\.ds-sidebar-resizing/);
  assert.match(html, /function setSidebarWidth\(w,persist\)/);
  assert.match(html, /function startSidebarResize\(e\)/);
  assert.match(html, /localStorage\.setItem\('ds-sidebar-width',String\(Math\.round\(width\)\)\)/);
  assert.match(html, /document\.addEventListener\('mousedown',startSidebarResize\)/);
  assert.match(html, /document\.addEventListener\('mousemove',moveSidebarResize\)/);
  assert.match(html, /document\.addEventListener\('mouseup',endSidebarResize\)/);
});

test('sidebar file warnings avoid the awkward amber rail', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.doesNotMatch(html, /\.ds-fileitem\.is-untoured\{box-shadow/);
  assert.match(html, /\.ds-fileitem-flag\{flex:none;color:var\(--amber\)/);
});

test('all-files sidebar groups changed paths into an expanded tree', () => {
  const treeFiles = [
    {
      oldPath: 'contracts/DepositVault.sol',
      newPath: 'contracts/DepositVault.sol',
      status: 'modified',
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: [{ type: 'add', content: 'contract DepositVault {}', newNo: 1 }],
        },
      ],
    },
    {
      oldPath: 'contracts/interfaces/IInstantWithdraw.sol',
      newPath: 'contracts/interfaces/IInstantWithdraw.sol',
      status: 'modified',
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: [{ type: 'add', content: 'interface IInstantWithdraw {}', newNo: 1 }],
        },
      ],
    },
    {
      oldPath: 'README.md',
      newPath: 'README.md',
      status: 'modified',
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: [{ type: 'add', content: '# diffStory', newNo: 1 }],
        },
      ],
    },
  ];

  const html = renderPage({ repo: process.cwd(), tour, files: treeFiles, baseLabel: 'main', comments: [], storyless: true });

  assert.match(html, /<div class="ds-filetree" role="tree">/);
  assert.match(html, /class="ds-filetree-dir" data-filetree-path="contracts\/" style="--tree-depth:0" open/);
  assert.match(html, /class="ds-filetree-dir" data-filetree-path="contracts\/interfaces\/" style="--tree-depth:1" open/);
  assert.match(html, /data-goto-file="contracts\/DepositVault\.sol"/);
  assert.match(html, /data-goto-file="contracts\/interfaces\/IInstantWithdraw\.sol"/);
  assert.match(html, /data-goto-file="README\.md"/);
  assert.match(html, /it\.classList\.toggle\('is-active',Number\(it\.getAttribute\('data-file-index'\)\)===i\)/);
});

test('split diff headers use the same resizable columns as the code rows', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-diffhead-side ds-diffhead-side-l"/);
  assert.match(html, /class="ds-diffhead-side ds-diffhead-side-r"/);
  assert.match(html, /\.ds-diffhead-side-l\{flex-grow:var\(--ds-split,50\);flex-shrink:1;flex-basis:0\}/);
  assert.match(html, /\.ds-diffhead-side-r\{flex-grow:calc\(100 - var\(--ds-split,50\)\);flex-shrink:1;flex-basis:0\}/);

  const fullHtml = renderFullFile([{ type: 'ctx', oldNo: 1, newNo: 1, oldText: 'same', newText: 'same' }], {
    file: 'a.ts',
    newFile: false,
  });
  assert.match(fullHtml, /class="ds-diffhead-side ds-diffhead-side-l"/);
  assert.match(fullHtml, /class="ds-diffhead-side ds-diffhead-side-r"/);
});

test('diff panels expose automatic first-change navigation controls', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.doesNotMatch(html, /ds-changemap|data-change-map|refreshChangeMap|data-change-jump/);
  assert.match(html, /class="ds-changejump" data-change-nav hidden/);
  assert.match(html, /data-change-prev title="Previous change/);
  assert.match(html, /data-change-next title="Next change/);
  assert.match(html, /data-change-count>0 \/ 0/);
  assert.match(html, /\.ds-changejump\{[^}]*display:flex[^}]*align-items:center/s);
  assert.match(html, /function updateChangeNav\(holder\)/);
  assert.match(html, /function jumpToChange\(holder,index,opts\)/);
  assert.match(html, /function jumpRelativeChange\(holder,delta\)/);
  assert.match(html, /function jumpToFirstChange\(holder\)/);
  assert.match(html, /function handleChangeShortcut\(e\)/);
  assert.match(html, /b=closest\(t,'\[data-change-prev\]'\);if\(b\)\{jumpRelativeChange\(closest\(b,'.ds-filepanel'\)\|\|closest\(b,'.ds-diff'\),-1\);return;\}/);
  assert.match(html, /b=closest\(t,'\[data-change-next\]'\);if\(b\)\{jumpRelativeChange\(closest\(b,'.ds-filepanel'\)\|\|closest\(b,'.ds-diff'\),1\);return;\}/);
  assert.match(html, /jumpToFirstChange\(panel\)/);
  assert.match(html, /mountThreads\(fullInner\);updateChangeNav\(closest\(fullInner,'.ds-filepanel'\)\|\|closest\(fullInner,'.ds-diff'\)\);jumpToFirstChange\(closest\(fullInner,'.ds-filepanel'\)\|\|closest\(fullInner,'.ds-diff'\)\);/);
});

test('read aloud keeps browser presets separate from two mac voices', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /data-voice-engine="browser"/);
  assert.match(html, /data-voice-engine="say"/);
  assert.match(html, /data-voice-engine="kokoro"/);
  assert.match(html, /Mac local/);
  assert.match(html, /Kokoro AI/);
  assert.match(html, /data-browser-voices/);
  assert.match(html, /data-say-voices/);
  assert.match(html, /data-kokoro-voices/);
  assert.match(html, /data-voice-preset="story"/);
  assert.match(html, /data-voice-preset="flirty"/);
  assert.match(html, /data-voice-preset="bass"/);
  assert.match(html, /data-voice-preset="system"/);
  assert.equal((html.match(/<button class="ds-voice-card[^"]*" data-say-voice="/g) ?? []).length, 2);
  assert.equal((html.match(/<button class="ds-voice-card[^"]*" data-kokoro-voice="/g) ?? []).length, 8);
  assert.match(html, /data-say-voice="samantha"/);
  assert.match(html, /data-say-voice="daniel"/);
  assert.match(html, /data-kokoro-voice="af_heart"/);
  assert.match(html, /data-kokoro-voice="af_bella"/);
  assert.match(html, /data-kokoro-voice="af_nicole"/);
  assert.match(html, /data-kokoro-voice="af_sarah"/);
  assert.match(html, /data-kokoro-voice="am_adam"/);
  assert.match(html, /data-kokoro-voice="am_onyx"/);
  assert.match(html, /data-kokoro-voice="bf_emma"/);
  assert.match(html, /data-kokoro-voice="bm_daniel"/);
  assert.match(html, />Samantha /);
  assert.match(html, />Daniel /);
  assert.match(html, />Heart /);
  assert.match(html, />Bella /);
  assert.match(html, />Nicole /);
  assert.match(html, />Sarah /);
  assert.match(html, />Adam /);
  assert.match(html, />Onyx /);
  assert.match(html, />Emma /);
  assert.doesNotMatch(html, /Mac local: Samantha/);
  assert.doesNotMatch(html, /Mac local: Daniel/);
  assert.match(html, /\.ds-voice-grid/);
  assert.match(html, /\.ds-voice-grid\[hidden\]\{display:none\}/);
  assert.match(html, /\.ds-kokoro-voice-grid/);
  assert.match(html, /\.ds-voice-card\[data-voice-preset="flirty"\]/);
  assert.match(html, /\.ds-voice-card\[data-voice-preset="bass"\]/);
  assert.match(html, /\.ds-voice-card\[data-say-voice="samantha"\]/);
  assert.match(html, /\.ds-voice-card\[data-say-voice="daniel"\]/);
  assert.match(html, /\.ds-voice-card\[data-kokoro-voice="af_heart"\]/);
});

test('read aloud presets have explicit voice preferences and samples', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /flirty:\{[^}]*rate:0\.98,pitch:1\.04,volume:1/s);
  assert.match(html, /bass:\{[^}]*rate:0\.95,pitch:0\.92,volume:1/s);
  assert.match(html, /prefer:\[\/ava\/,\/samantha\/,\/allison\/,\/susan\/,\/serena\/,\/karen\/,\/moira\/,\/tessa\/,\/zira\/,\/jenny\/,\/aria\/\]/);
  assert.match(html, /prefer:\[\/alex\/,\/daniel\/,\/tom\/,\/david\/,\/mark\/,\/guy\/,\/brian\/\]/);
  assert.match(html, /sample:'Warm mode\./);
  assert.match(html, /sample:'Deep mode\./);
  assert.match(html, /function pickVoice\(presetName\)/);
  assert.match(html, /voiceScore\(b,presetName\)-voiceScore\(a,presetName\)/);
});

test('mac local voice selection is direct and persisted separately', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /var SAY_VOICES=\{/);
  assert.match(html, /function setSayVoice\(v,preview\)/);
  assert.match(html, /localStorage\.setItem\('ds-say-voice',sayVoice\)/);
  assert.match(html, /b=closest\(t,'\[data-say-voice\]'\);if\(b\)\{setSayVoice\(b\.getAttribute\('data-say-voice'\),true\);return;\}/);
  assert.match(html, /function fetchGeneratedSpeech\(engine,text,voice,speechRate,signal\)/);
  assert.match(html, /return speakGeneratedAudio\('say',text,opts\)/);
  assert.match(html, /Mac local · '\+\(SAY_VOICES\[sayVoice\]\|\|SAY_VOICES\.samantha\)\.label/);
});

test('kokoro voice selection is a separate neural engine', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /var KOKORO_VOICES=\{/);
  assert.match(html, /af_heart:\{label:'Heart'/);
  assert.match(html, /af_bella:\{label:'Bella'/);
  assert.match(html, /am_onyx:\{label:'Onyx'/);
  assert.match(html, /bm_daniel:\{label:'Daniel'/);
  assert.match(html, /function normalizeKokoroVoice\(v\)/);
  assert.match(html, /return KOKORO_VOICES\[name\]\?name:\(aliases\[name\]\|\|'af_heart'\)/);
  assert.match(html, /function setKokoroVoice\(v,preview\)/);
  assert.match(html, /localStorage\.setItem\('ds-kokoro-voice',kokoroVoice\)/);
  assert.match(html, /b=closest\(t,'\[data-kokoro-voice\]'\);if\(b\)\{setKokoroVoice\(b\.getAttribute\('data-kokoro-voice'\),true\);return;\}/);
  assert.match(html, /function speakKokoroAudio\(text,opts\)/);
  assert.match(html, /api=engine==='kokoro'\?'\/api\/tts\/kokoro':'\/api\/tts\/say'/);
  assert.match(html, /return speakGeneratedAudio\('kokoro',text,opts\)/);
  assert.match(html, /Kokoro AI · '\+\(KOKORO_VOICES\[kokoroVoice\]\|\|KOKORO_VOICES\.af_heart\)\.label/);
});

test('kokoro generated speech separates server failure from playback blocking', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function readJsonOrError\(r,msg\)/);
  assert.match(html, /throw new Error\(\(j&&j\.error\)\|\|msg\)/);
  assert.match(html, /function handleLocalPlaybackBlocked\(a,btn,msg\)/);
  assert.match(html, /Kokoro audio is ready\. Press Space to play it\./);
  assert.match(html, /Kokoro failed: '\+err\.message/);
  assert.doesNotMatch(html, /function handleLocalPlaybackBlocked\(a,btn,msg\)[\s\S]*voiceEngine='browser'[\s\S]*function playGeneratedAudio/);
});

test('read aloud avoids warped persona voices and falls back to natural voices', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.doesNotMatch(html, /pitch:1\.4/);
  assert.doesNotMatch(html, /pitch:0\.4/);
  assert.doesNotMatch(html, /rate:0\.6/);
  assert.match(html, /function bestNaturalVoice\(\)/);
  assert.match(html, /return bestNaturalVoice\(\)/);
});

test('read aloud start stop and preview are controlled by one speech state', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function speakLocalAudio\(text,opts\)/);
  assert.match(html, /fetch\(api,\{method:'POST'/);
  assert.match(html, /function setGeneratedSpeechLoading\(token,label,engine,voice,mode\)/);
  assert.match(html, /function clearGeneratedSpeechLoading\(token\)/);
  assert.match(html, /function abortGeneratedSpeech\(\)/);
  assert.match(html, /speechAbort=ctrl/);
  assert.match(html, /signal:ctrl\?ctrl\.signal:undefined/);
  assert.match(html, /if\(isAbortError\(err\)\)return;/);
  assert.match(html, /setGeneratedSpeechLoading\(token,opts\.preview\?'Generating preview':'Generating speech',engine,voice,opts\.preview\?'preview':'speech'\)/);
  assert.match(html, /function setVoiceEngine\(engine\)/);
  assert.match(html, /localStorage\.setItem\('ds-voice-engine',voiceEngine\)/);
  assert.match(html, /browserGrid\.hidden=voiceEngine!=='browser'/);
  assert.match(html, /sayGrid\.hidden=voiceEngine!=='say'/);
  assert.match(html, /kokoroGrid\.hidden=voiceEngine!=='kokoro'/);
  assert.match(html, /function firstSpeakableStep\(\)/);
  assert.match(html, /function cancelSpeech\(\)/);
  assert.match(html, /activeUtterance=null/);
  assert.match(html, /function updateReadAloudButton\(\)/);
  assert.match(html, /label\.textContent=speechLoadingLabel\|\|\(readAloud\?'Stop':'Read aloud'\)/);
  assert.match(html, /function restartReadAloud\(\)/);
  assert.match(html, /function speakVoicePreview\(\)/);
  assert.match(html, /readAloud=false;\n    try\{localStorage\.setItem\('ds-readaloud',''\);\}catch\(e\)\{\}/);
  assert.match(html, /speak\(kokoroLocal\.sample,\{voice:kokoroVoice,rate:1,preview:true\}\)/);
  assert.match(html, /b=closest\(t,'\[data-preview-voice\]'\);if\(b\)\{speakVoicePreview\(\);return;\}/);
});

test('generated voice loading is visible in the controls while previews or steps render', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /\.ds-readaloud\.is-loading/);
  assert.match(html, /\.ds-preview\.is-loading/);
  assert.match(html, /\.ds-voice-card\.is-loading/);
  assert.match(html, /preview\.classList\.toggle\('is-loading',loading&&speechLoadingMode==='preview'\)/);
  assert.match(html, /previewLabel\.textContent=loading&&speechLoadingMode==='preview'\?'Generating':'Preview'/);
  assert.match(html, /b\.classList\.toggle\('is-loading',speechLoadingEngine==='kokoro'&&b\.getAttribute\('data-kokoro-voice'\)===speechLoadingVoice\)/);
  assert.match(html, /b\.classList\.toggle\('is-loading',speechLoadingEngine==='say'&&b\.getAttribute\('data-say-voice'\)===speechLoadingVoice\)/);
  assert.match(html, /if\(s\)s\.textContent=speechLoadingLabel\?speechLoadingLabel\+'…':describeVoice\(\)/);
});

test('generated voice prefetches the next speech unit while the current unit is active', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /prefetchedSpeech=\{\}/);
  assert.match(html, /speechPrefetchAbort=null/);
  assert.match(html, /function prefetchNextSpeech\(i\)/);
  assert.match(html, /function prefetchGeneratedSpeechText\(text\)/);
  assert.match(html, /function prefetchUpcomingSpeech\(stepIndex,units,index,manual\)/);
  assert.match(html, /function prefetchGeneratedSpeech\(engine,text,voice,speechRate\)/);
  assert.match(html, /function cachedGeneratedSpeech\(engine,text,voice,speechRate\)/);
  assert.match(html, /var spoke=speakStep\(i\);if\(!spoke\)prefetchNextSpeech\(i\);/);
  assert.match(html, /if\(index\+1<units\.length\)\{prefetchGeneratedSpeechText\(units\[index\+1\]\.text\);return;\}/);
  assert.match(html, /if\(spoken\)prefetchUpcomingSpeech\(stepIndex,units,index,manual\);return spoken;/);
  assert.doesNotMatch(html, /prefetchNextSpeech\(active\)/);
});

test('read aloud visually focuses the code rows for the step being spoken', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /\.ds-step\.is-voice-active \.ds-diff/);
  assert.match(html, /\.ds-row\.is-voice-focus/);
  assert.match(html, /voiceFocusIndex=-1/);
  assert.match(html, /function clearVoiceFocus\(\)/);
  assert.match(html, /function setVoiceFocus\(stepIndex,focusGroup\)/);
  assert.match(html, /function startVoiceFocusSequence\(stepIndex,text\)/);
  assert.match(html, /function updateVoiceFocusForChar\(stepIndex,charIndex,text\)/);
  assert.match(html, /function activeVoiceFocusRows\(panel,group\)/);
  assert.match(html, /focusRows\[0\]\.scrollIntoView/);
  assert.match(html, /function stepSpeechUnits\(panel\)/);
  assert.match(html, /function speakStepIndex\(i,manual\)/);
  assert.match(html, /function speakStepUnit\(stepIndex,units,index,manual\)/);
  assert.match(html, /if\(opts\.stepIndex!=null\)\{if\(opts\.focusGroup!=null\)setActiveBeat\(opts\.stepIndex,opts\.focusGroup\);else startVoiceFocusSequence\(opts\.stepIndex,text\);\}/);
  assert.match(html, /u\.onboundary=function\(e\)/);
  assert.match(html, /if\(opts\.stepIndex!=null\)clearVoiceFocus\(\)/);
  assert.match(html, /speakStepIndex\(sp,true\)/);
});

test('explicit story focus narrows which rows are highlighted during read aloud', () => {
  const focusTour = {
    version: 1,
    title: 'Focused tour',
    summary: 'Two changed lines, one spoken focus.',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'Changed block',
        file: 'a.ts',
        range: [1, 2],
        focus: { ranges: [[2, 2]], label: 'second line' },
        kind: 'changed',
        why: 'Read the block, but point at the second line while speaking.',
      },
    ],
  };
  const focusFiles = [
    {
      oldPath: 'a.ts',
      newPath: 'a.ts',
      status: 'modified',
      hunks: [
        {
          oldStart: 1,
          oldLines: 0,
          newStart: 1,
          newLines: 2,
          lines: [
            { type: 'add', content: 'first', newNo: 1 },
            { type: 'add', content: 'second', newNo: 2 },
          ],
        },
      ],
    },
  ];
  const html = renderPage({ repo: process.cwd(), tour: focusTour, files: focusFiles, baseLabel: 'main', comments: [] });
  assert.match(html, /data-line="2"[^>]*data-step="s1"[^>]*data-step-focus="0"/);
  assert.doesNotMatch(html, /data-line="1"[^>]*data-step="s1"[^>]*data-step-focus=/);
});

test('story viewport controls visible code while highlights control narration focus', () => {
  const repo = mkdtempSync(join(tmpdir(), 'ds-viewport-'));
  writeFileSync(
    join(repo, 'a.ts'),
    [
      'function settleFee(input) {',
      '  const account = input.account;',
      '  const amount = input.amount;',
      '  const feeBps = input.feeBps;',
      '  storeFee(account, feeBps);',
      '  return settle(account, amount);',
      '}',
    ].join('\n'),
  );

  const viewportTour = {
    version: 1,
    title: 'Viewport tour',
    summary: 'Show the whole method, talk about the fee lines.',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'Settlement fee enters the method',
        file: 'a.ts',
        range: [4, 5],
        viewport: [1, 7],
        highlights: [[4, 5]],
        kind: 'changed',
        why: 'We wanted the fee to enter settlement with the rest of the user input.',
      },
    ],
  };
  const viewportFiles = [
    {
      oldPath: 'a.ts',
      newPath: 'a.ts',
      status: 'modified',
      hunks: [
        {
          oldStart: 4,
          oldLines: 0,
          newStart: 4,
          newLines: 2,
          lines: [
            { type: 'add', content: '  const feeBps = input.feeBps;', newNo: 4 },
            { type: 'add', content: '  storeFee(account, feeBps);', newNo: 5 },
          ],
        },
      ],
    },
  ];

  const html = renderPage({ repo, tour: viewportTour, files: viewportFiles, baseLabel: 'main', comments: [] });
  assert.match(html, /settleFee/);
  assert.match(html, /settle<\/span>\(account, amount\)/);
  assert.match(html, /data-line="4"[^>]*data-step="s1"[^>]*data-step-focus="0"/);
  assert.match(html, /data-line="5"[^>]*data-step="s1"[^>]*data-step-focus="0"/);
  assert.doesNotMatch(html, /data-line="2"[^>]*data-step="s1"[^>]*data-step-focus=/);
  assert.match(html, /storyteller-selected viewport/i);

  rmSync(repo, { recursive: true, force: true });
});

test('story beats render as separate spoken notes with exact focus groups', () => {
  const beatTour = {
    version: 1,
    title: 'Beat tour',
    summary: 'One step has two spoken beats.',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'Changed block',
        file: 'a.ts',
        range: [1, 3],
        viewport: [1, 3],
        highlights: [[1, 3]],
        beats: [
          { text: 'First I explain the setup line.', highlights: [[1, 1]] },
          { text: 'Then I explain the result line.', highlights: [[3, 3]] },
        ],
        kind: 'changed',
        why: 'Fallback recap for older readers.',
      },
    ],
  };
  const beatFiles = [
    {
      oldPath: 'a.ts',
      newPath: 'a.ts',
      status: 'modified',
      hunks: [
        {
          oldStart: 1,
          oldLines: 0,
          newStart: 1,
          newLines: 3,
          lines: [
            { type: 'add', content: 'setup', newNo: 1 },
            { type: 'add', content: 'middle', newNo: 2 },
            { type: 'add', content: 'result', newNo: 3 },
          ],
        },
      ],
    },
  ];

  const html = renderPage({ repo: process.cwd(), tour: beatTour, files: beatFiles, baseLabel: 'main', comments: [] });

  assert.match(html, /class="ds-beat"[^>]*data-speech-beat="0"[^>]*data-focus-group="0"/);
  assert.match(html, /class="ds-beat"[^>]*data-speech-beat="1"[^>]*data-focus-group="1"/);
  assert.match(html, /First I explain the setup line\./);
  assert.match(html, /Then I explain the result line\./);
  assert.match(html, /data-line="1"[^>]*data-step="s1"[^>]*data-step-focus="0"/);
  assert.doesNotMatch(html, /data-line="2"[^>]*data-step="s1"[^>]*data-step-focus=/);
  assert.match(html, /data-line="3"[^>]*data-step="s1"[^>]*data-step-focus="1"/);
  assert.match(html, /function stepSpeechUnits\(panel\)/);
  assert.match(html, /function speakStepUnit\(stepIndex,units,index,manual\)/);
  assert.match(html, /setActiveBeat\(stepIndex,group\)/);
  assert.match(html, /b=closest\(t,'\[data-playstep\]'\);if\(b\)\{var pp=closest\(t,'\.ds-step'\);if\(pp\)\{var sp=parseInt\(pp\.getAttribute\('data-step-panel'\)\|\|'0',10\);speakStepIndex\(sp,true\);\}return;\}/);
});

test('pure deleted-file sentinel highlights deleted rows', () => {
  const deletedTour = {
    version: 1,
    title: 'Deleted file tour',
    summary: 'Deleted file cleanup.',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'Old plan is gone',
        file: 'old-plan.md',
        range: [0, 0],
        viewport: [0, 0],
        highlights: [[0, 0]],
        kind: 'changed',
        why: 'This deleted plan is no longer the source of truth.',
      },
    ],
  };
  const deletedFiles = [
    {
      oldPath: 'old-plan.md',
      newPath: 'old-plan.md',
      status: 'deleted',
      hunks: [
        {
          oldStart: 1,
          oldLines: 2,
          newStart: 0,
          newLines: 0,
          lines: [
            { type: 'del', content: '# Old plan', oldNo: 1 },
            { type: 'del', content: '- stale step', oldNo: 2 },
          ],
        },
      ],
    },
  ];

  const html = renderPage({ repo: process.cwd(), tour: deletedTour, files: deletedFiles, baseLabel: 'main', comments: [] });

  assert.match(html, /Old plan/);
  assert.match(html, /data-step="s1"[^>]*data-step-focus="0"/);
});

test('multiple story focus ranges are rendered as separate read-aloud groups', () => {
  const focusTour = {
    version: 1,
    title: 'Focused tour',
    summary: 'Three changed lines, two spoken focus groups.',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'Changed block',
        file: 'a.ts',
        range: [1, 3],
        focus: { ranges: [[1, 1], [3, 3]], label: 'first and third lines' },
        kind: 'changed',
        why: 'First read the setup line. Then move to the result line.',
      },
    ],
  };
  const focusFiles = [
    {
      oldPath: 'a.ts',
      newPath: 'a.ts',
      status: 'modified',
      hunks: [
        {
          oldStart: 1,
          oldLines: 0,
          newStart: 1,
          newLines: 3,
          lines: [
            { type: 'add', content: 'first', newNo: 1 },
            { type: 'add', content: 'middle', newNo: 2 },
            { type: 'add', content: 'third', newNo: 3 },
          ],
        },
      ],
    },
  ];
  const html = renderPage({ repo: process.cwd(), tour: focusTour, files: focusFiles, baseLabel: 'main', comments: [] });
  assert.match(html, /data-line="1"[^>]*data-step="s1"[^>]*data-step-focus="0"/);
  assert.doesNotMatch(html, /data-line="2"[^>]*data-step="s1"[^>]*data-step-focus=/);
  assert.match(html, /data-line="3"[^>]*data-step="s1"[^>]*data-step-focus="1"/);
  assert.ok(html.includes('data-step-focus="\'+g+\'"]'));
  assert.match(html, /voiceFocusTimers\.push\(setTimeout\(function\(\)\{applyVoiceFocusGroup\(stepIndex,group\);\}/);
});

test('steps without explicit focus use rendered hunks as read-aloud groups', () => {
  const hunkTour = {
    version: 1,
    title: 'Hunk tour',
    summary: 'One step spans two hunks.',
    steps: [
      {
        id: 's1',
        order: 1,
        title: 'Two blocks',
        file: 'a.ts',
        range: [1, 12],
        kind: 'changed',
        why: 'First read the top block. Then read the lower block.',
      },
    ],
  };
  const hunkFiles = [
    {
      oldPath: 'a.ts',
      newPath: 'a.ts',
      status: 'modified',
      hunks: [
        {
          oldStart: 1,
          oldLines: 0,
          newStart: 1,
          newLines: 1,
          lines: [{ type: 'add', content: 'top', newNo: 1 }],
        },
        {
          oldStart: 10,
          oldLines: 0,
          newStart: 10,
          newLines: 1,
          lines: [{ type: 'add', content: 'bottom', newNo: 10 }],
        },
      ],
    },
  ];
  const html = renderPage({ repo: process.cwd(), tour: hunkTour, files: hunkFiles, baseLabel: 'main', comments: [] });
  assert.match(html, /data-line="1"[^>]*data-step="s1"[^>]*data-step-focus="0"/);
  assert.match(html, /data-line="10"[^>]*data-step="s1"[^>]*data-step-focus="1"/);
});

test('space pauses and resumes voice without stealing focused controls', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function isTextEntryTarget\(t\)/);
  assert.match(html, /\^\(INPUT\|TEXTAREA\|SELECT\)\$/);
  assert.match(html, /function isKeyboardControlTarget\(t\)/);
  assert.match(html, /function isReadAloudShortcutTarget\(t\)/);
  assert.match(html, /\^\(BUTTON\|A\)\$/);
  assert.match(html, /function toggleVoicePause\(\)/);
  assert.match(html, /localAudio\.paused/);
  assert.match(html, /localAudio\.pause\(\)/);
  assert.match(html, /if\(synth\.paused\)\{synth\.resume\(\);toast\('Voice resumed'\);/);
  assert.match(html, /if\(synth\.speaking\|\|activeUtterance\)\{synth\.pause\(\);toast\('Voice paused'\);/);
  assert.match(html, /var wantsSpacePause=e\.key===' '\|\|e\.code==='Space'\|\|e\.key==='Spacebar';/);
  assert.match(html, /if\(wantsSpacePause&&!isTextEntryTarget\(e\.target\)&&\(isReadAloudShortcutTarget\(e\.target\)\|\|!isKeyboardControlTarget\(e\.target\)\)\)\{if\(toggleVoicePause\(\)\)\{e\.preventDefault\(\);return;\}\}/);
  assert.match(html, /if\(isTextEntryTarget\(e\.target\)\|\|isKeyboardControlTarget\(e\.target\)\)return;/);
  assert.doesNotMatch(html, /if\(e\.key===' '\|\|e\.code==='Space'\|\|e\.key==='Spacebar'\)\{if\(toggleVoicePause\(\)\)e\.preventDefault\(\);return;\}/);
});

test('arrow keys move through read-aloud beats and auto-advance steps', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /currentSpeechStep=-1,currentSpeechUnit=-1,currentSpeechManual=false/);
  assert.match(html, /function activateStep\(i,autoSpeak\)/);
  assert.match(html, /function setActive\(i\)\{activateStep\(i,true\);\}/);
  assert.match(html, /function previousSpeakableStep\(i\)/);
  assert.match(html, /function speechBeatTarget\(stepIndex,unitIndex,delta\)/);
  assert.match(html, /function moveSpeechBeat\(delta\)/);
  assert.match(html, /function advanceAfterSpeechStep\(stepIndex,manual\)/);
  assert.match(html, /var n=nextSpeakableStep\(stepIndex\);if\(n>=0\)\{setActive\(n\);return;\}/);
  assert.match(html, /if\(delta<0\)\{var p=previousSpeakableStep\(stepIndex\);if\(p>=0\)\{var prevUnits=stepSpeechUnits\(stepPanels\[p\]\);return \{step:p,unit:prevUnits\.length-1\};\}\}/);
  assert.match(html, /var target=speechBeatTarget\(baseStep,baseUnit,delta\);if\(!target\)return true;/);
  assert.match(html, /activateStep\(target\.step,false\);/);
  assert.match(html, /speakStepUnit\(target\.step,units,target\.unit,manual\);/);
  assert.match(html, /var wantsBeatNav=e\.key==='ArrowRight'\|\|e\.key==='ArrowLeft';/);
  assert.match(html, /if\(wantsBeatNav&&moveSpeechBeat\(e\.key==='ArrowRight'\?1:-1\)\)\{e\.preventDefault\(\);return;\}/);
  assert.match(html, /if\(handleChangeShortcut\(e\)\)return;/);
});

test('arrow keys navigate changes while j/k still navigate the story or file list', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function activateStep\(i,autoSpeak\)[\s\S]*var spoke=speakStep\(i\);/);
  assert.match(html, /if\(handleChangeShortcut\(e\)\)return;/);
  assert.match(html, /var next=e\.key==='j',prev=e\.key==='k';/);
  assert.match(html, /if\(next\|\|prev\)\{[\s\S]*if\(isTextEntryTarget\(e\.target\)\)return;/);
  assert.match(html, /if\(filesView&&!filesView\.hidden\)selectFile\(selectedFile\+\(next\?1:-1\)\);/);
  assert.match(html, /else if\(tourView&&!tourView\.hidden\)setActive\(active\+\(next\?1:-1\)\);/);
});

test('read aloud preset switch migrates old modes and restarts active reading', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function normalizePreset\(p\)/);
  assert.match(html, /if\(p==='warm'\|\|p==='flirty'\)return 'flirty'/);
  assert.match(html, /if\(p==='precise'\|\|p==='reviewer'\|\|p==='bass'\)return 'bass'/);
  assert.match(html, /localStorage\.getItem\('ds-voice-preset'\)\|\|localStorage\.getItem\('ds-operator'\)/);
  assert.match(html, /if\(readAloud\)restartReadAloud\(\)/);
  assert.match(html, /else if\(preview\)speakVoicePreview\(\)/);
});

test('review page embeds the shared progress panel and ProgressPanel script', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /ds-pp-plan/);
  assert.match(html, /function ProgressPanel/);
  assert.match(html, /run_done/);
  assert.match(html, /data-pp-stop/);
});

test('storyless review page puts story generation controls in the Story tab', () => {
  const html = renderPage({
    repo: process.cwd(),
    tour: { version: 1, title: '', summary: '', steps: [], base: 'abc123' },
    files,
    baseLabel: 'main',
    headRef: 'def456',
    comments: [],
    routeBase: '/repo/demo',
    storyless: true,
  });
  assert.match(html, /data-storyless="1"/);
  assert.match(html, /id="storyAgentSel"/);
  assert.match(html, /id="storyModelSel"/);
  assert.match(html, /id="storyMode"/);
  assert.doesNotMatch(html, /<select id="storyAgentSel"|<select id="storyModelSel"|<select id="storyMode"/);
  assert.match(html, /id="storyAgentChoices"/);
  assert.match(html, /id="storyModelChoices"/);
  assert.match(html, />Detail<\/span>/);
  assert.match(html, /aria-label="Story detail"/);
  assert.match(html, /data-story-choice="storyMode" data-value="brief"/);
  assert.match(html, />Brief<\/button>/);
  assert.match(html, /data-story-choice="storyMode" data-value="guided"/);
  assert.match(html, />Balanced<\/button>/);
  assert.match(html, /data-story-choice="storyMode" data-value="detailed"/);
  assert.match(html, />Line-by-line<\/button>/);
  assert.match(html, /data-reload-diff/);
  assert.match(html, /Reload diff/);
  assert.match(html, /closest\(t,'\[data-reload-diff\]'\)/);
  assert.match(html, /b\.disabled=true;location\.reload\(\);return;/);
  assert.doesNotMatch(html, />Guided<\/button>/);
  assert.doesNotMatch(html, />Detailed<\/button>/);
  assert.match(html, /Best story/);
  assert.match(html, /Lower cost/);
  assert.doesNotMatch(html, /id="storyModelInp"/);
  assert.doesNotMatch(html, /id="storyCodexPanel"/);
  assert.doesNotMatch(html, /id="storyCodexProvider"/);
  assert.doesNotMatch(html, /id="storyCodexSandbox"/);
  assert.doesNotMatch(html, /id="storyCodexProfile"/);
  assert.doesNotMatch(html, /id="storyCodexConfig"/);
  assert.doesNotMatch(html, /GPT-5 Codex/);
  assert.doesNotMatch(html, /\bo3\b/);
  assert.doesNotMatch(html, /LM Studio/);
  assert.doesNotMatch(html, /Ollama/);
  assert.doesNotMatch(html, /No sandbox/);
  assert.doesNotMatch(html, /overflow-x:auto/);
  assert.match(html, /data-generate-story data-review-url="\/repo\/demo\/review\?story=story\.json" data-base="abc123" data-head="def456"/);
  assert.match(html, /fetch\('\/api\/agents'\)/);
  assert.match(html, /fetch\('\/api\/skills\/update',\{method:'POST'\}\)/);
  assert.match(html, /data-story-choice/);
  assert.match(html, /function renderStoryChoices/);
  assert.match(html, /function setStoryChoice/);
  assert.match(html, /base:btn\.getAttribute\('data-base'\)\|\|undefined/);
  assert.match(html, /head:btn\.getAttribute\('data-head'\)\|\|undefined/);
  assert.match(html, /agent:e\.agentSel&&e\.agentSel\.value\?e\.agentSel\.value:undefined/);
  assert.match(html, /mode:e\.modeSel&&e\.modeSel\.value\?e\.modeSel\.value:undefined/);
  assert.doesNotMatch(html, /codexProvider:/);
  assert.doesNotMatch(html, /codexSandbox:/);
  assert.doesNotMatch(html, /codexProfile:/);
  assert.doesNotMatch(html, /codexConfig:/);
});

test('intro panel leads with the recovered intent and cites its sources', () => {
  const intentTour = {
    ...tour,
    intent: {
      goal: 'We wanted ops to cap runaway fees before settlement.',
      design: 'The keeper clamps through one shared helper.',
      sources: ['commit abc1234', 'PR #7 body'],
    },
  };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-intro-lede">We wanted ops to cap runaway fees before settlement\./);
  assert.match(html, /class="ds-intro-design">The keeper clamps through one shared helper\./);
  assert.match(html, /class="ds-intro-sources">Why from commit abc1234 · PR #7 body</);
});

test('intro panel keeps the summary as the reading map when intent exists', () => {
  const intentTour = { ...tour, intent: { goal: 'Cap runaway fees.' } };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-intro-lede">Cap runaway fees\./);
  assert.match(html, /class="ds-intro-design">One changed line\./);
});

test('intro panel falls back to the summary lede without an intent block', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-intro-lede">One changed line\./);
  // The static stylesheet always carries the .ds-intro-sources rule, so pin
  // the absence of the rendered *markup* (class attribute), not the bare name.
  assert.doesNotMatch(html, /class="ds-intro-sources"/);
  assert.doesNotMatch(html, /class="ds-intro-design"/);
});

test('intent text is HTML-escaped in the intro panel', () => {
  const intentTour = { ...tour, intent: { goal: 'Guard <script> tags', sources: ['a & b'] } };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /Guard &lt;script&gt; tags/);
  assert.match(html, /a &amp; b/);
  assert.doesNotMatch(html, /Guard <script> tags/);
});

test('sidebar file items carry a viewed toggle and the body a scope key', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /data-viewed-scope="/);
  assert.match(html, /data-viewed-toggle/);
  assert.match(html, /data-viewed-progress/);
});

test('a new file has no expandable eof gap in the split view', () => {
  const blocks = [
    [
      { type: 'add', newNo: 1, content: 'export const x = 1;' },
      { type: 'add', newNo: 2, content: 'export const y = 2;' },
    ],
  ];
  // A brand-new file's entire content is the hunk — there are no hidden lines
  // past it, so the "reveal more" affordance would be a lie.
  const created = renderSplitHunks(blocks, { file: 'brand.ts', newFile: true, hunkRanges: [[1, 2]], canExpand: true });
  assert.doesNotMatch(created, /data-gap/);
  // Control: the same rows as a modified file DO get the eof affordance.
  const modified = renderSplitHunks(blocks, { file: 'brand.ts', newFile: false, hunkRanges: [[1, 2]], canExpand: true });
  assert.match(modified, /data-gap-from="3" data-gap-to="eof"/);
});

test('a new file shows no phantom eof expand-gap in the All-files unified body', () => {
  const nfTour = {
    version: 1,
    title: 'New',
    summary: '',
    steps: [
      { id: 's1', order: 1, title: 'New file', file: 'brand.ts', range: [1, 2], kind: 'new-file', why: 'A brand-new file added whole.' },
    ],
  };
  const nfFiles = [
    {
      oldPath: 'brand.ts',
      newPath: 'brand.ts',
      status: 'added',
      hunks: [
        {
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 2,
          lines: [
            { type: 'add', content: 'export const x = 1;', newNo: 1 },
            { type: 'add', content: 'export const y = 2;', newNo: 2 },
          ],
        },
      ],
    },
  ];
  const html = renderPage({ repo: process.cwd(), tour: nfTour, files: nfFiles, baseLabel: 'main', comments: [] });
  assert.doesNotMatch(html, /data-gap-to="eof"/);
});

test('adjacent hunks render a bare, non-expandable gap between them', () => {
  const blocks = [
    [{ type: 'ctx', oldNo: 1, newNo: 1, content: 'top' }],
    [{ type: 'ctx', oldNo: 6, newNo: 6, content: 'bottom' }],
  ];
  const html = renderSplitHunks(blocks, {
    file: 'a.ts',
    newFile: false,
    hunkRanges: [
      [1, 5],
      [6, 9],
    ],
    canExpand: true,
  });
  // Hunks 1-5 and 6-9 touch (no hidden lines between them): the separator must
  // be a bare split gap, with no expand affordance…
  assert.match(html, /<div class="ds-hunkgap ds-hunkgap-split">/);
  assert.match(html, /<span class="ds-gap-mid"><span>⋯<\/span><\/span>/);
  assert.doesNotMatch(html, /data-gap-from="6"/);
  // …while the trailing eof gap stays expandable.
  assert.match(html, /<span class="ds-gap-mid"><button type="button" class="ds-gapbtn" data-expand="all"/);
  assert.match(html, /data-gap-from="10" data-gap-to="eof"/);
});
