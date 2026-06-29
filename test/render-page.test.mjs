// Unit tests for the rendered review page shell. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../dist/render.js';

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
  assert.match(html, /var submit=el\('button','ds-btn ds-btn-solid','Send'\)/);
  assert.match(html, /allComments\.push\(c\);removeComposer\(box\);syncThreads\(\);refreshCount\(\);sendToAgent\(\[c\.id\]\);/);
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

test('generated voice prefetches the next step while the current step is active', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /prefetchedSpeech=\{\}/);
  assert.match(html, /speechPrefetchAbort=null/);
  assert.match(html, /function prefetchNextSpeech\(i\)/);
  assert.match(html, /function prefetchGeneratedSpeech\(engine,text,voice,speechRate\)/);
  assert.match(html, /function cachedGeneratedSpeech\(engine,text,voice,speechRate\)/);
  assert.match(html, /speakStep\(i\);prefetchNextSpeech\(i\);/);
  assert.match(html, /if\(cached\)\{playFetchedGeneratedAudio\(engine,text,opts,token,btn,null,cached\);/);
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
  assert.match(html, /speak\(stepText\(p\),\{stepIndex:i\}\)/);
  assert.match(html, /if\(opts\.stepIndex!=null\)startVoiceFocusSequence\(opts\.stepIndex,text\)/);
  assert.match(html, /u\.onboundary=function\(e\)/);
  assert.match(html, /if\(opts\.stepIndex!=null\)clearVoiceFocus\(\)/);
  assert.match(html, /speak\(stepText\(pp\),\{stepIndex:sp\}\)/);
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
  assert.match(html, /data-line="2" data-step="s1" data-step-focus="0"/);
  assert.doesNotMatch(html, /data-line="1" data-step="s1" data-step-focus=/);
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
  assert.match(html, /data-line="1" data-step="s1" data-step-focus="0"/);
  assert.doesNotMatch(html, /data-line="2" data-step="s1" data-step-focus=/);
  assert.match(html, /data-line="3" data-step="s1" data-step-focus="1"/);
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
  assert.match(html, /data-line="1" data-step="s1" data-step-focus="0"/);
  assert.match(html, /data-line="10" data-step="s1" data-step-focus="1"/);
});

test('space pauses and resumes voice without stealing focused controls', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function isTextEntryTarget\(t\)/);
  assert.match(html, /\^\(INPUT\|TEXTAREA\|SELECT\)\$/);
  assert.match(html, /function isKeyboardControlTarget\(t\)/);
  assert.match(html, /\^\(BUTTON\|A\)\$/);
  assert.match(html, /function toggleVoicePause\(\)/);
  assert.match(html, /localAudio\.paused/);
  assert.match(html, /localAudio\.pause\(\)/);
  assert.match(html, /if\(synth\.paused\)\{synth\.resume\(\);toast\('Voice resumed'\);/);
  assert.match(html, /if\(synth\.speaking\|\|activeUtterance\)\{synth\.pause\(\);toast\('Voice paused'\);/);
  assert.match(html, /if\(isTextEntryTarget\(e\.target\)\|\|isKeyboardControlTarget\(e\.target\)\)return;/);
  assert.match(html, /if\(e\.key===' '\|\|e\.code==='Space'\|\|e\.key==='Spacebar'\)\{if\(toggleVoicePause\(\)\)e\.preventDefault\(\);return;\}/);
});

test('arrow keys navigate the story and keep read aloud moving even when controls are focused', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /function setActive\(i\)[\s\S]*speakStep\(i\);/);
  assert.match(html, /var next=e\.key==='ArrowRight'\|\|e\.key==='j',prev=e\.key==='ArrowLeft'\|\|e\.key==='k';/);
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
