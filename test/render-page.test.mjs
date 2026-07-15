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

test('concept steps render as safe document primers linked to the next code step', () => {
  const conceptTour = {
    version: 2,
    title: 'Concept-first review',
    summary: 'Learn the request lifecycle, then inspect the implementation.',
    steps: [
      {
        id: 'request-primer',
        order: 1,
        title: 'The request envelope',
        kind: 'concept',
        body: [
          '## Request envelope',
          'A **request envelope** carries `identity` into the policy.',
          '',
          '- Normalize once',
          '- Apply the policy',
          '',
          '<script>alert("primer")</script>',
          '',
          '```html',
          '<img src=x onerror=alert("fence")>',
          '```',
        ].join('\n'),
        preparesFor: ['implementation'],
        diagram: {
          type: 'mermaid',
          source: 'flowchart LR\n  Request --> Normalize --> Policy',
          caption: 'Parse <then> apply.',
        },
      },
      {
        ...tour.steps[0],
        id: 'implementation',
        order: 2,
        title: 'Apply the request policy',
      },
    ],
  };

  const html = renderPage({ repo: process.cwd(), tour: conceptTour, files, baseLabel: 'main', comments: [] });

  assert.ok(html.indexOf("var key='ds-theme'") < html.indexOf('<style>'), 'resolves the color theme before review CSS');
  assert.equal((html.match(/class="ds-theme-toggle"/g) || []).length, 1, 'renders one shared color-theme selector');
  assert.match(html, /data-theme-choice="light"/);
  assert.match(html, /document\.documentElement\.getAttribute\('data-theme'\)==='dark'/, 'uses the resolved theme for diagrams');
  assert.match(html, /document\.addEventListener\('ds-theme-change'/, 're-renders diagrams after a theme change');
  assert.match(html, /class="ds-stepcard is-concept"[^>]*data-step-id="request-primer"/);
  assert.match(html, />Concept primer</);
  assert.match(html, /class="ds-step ds-concept-step"[^>]*data-step-id="request-primer"/);
  assert.match(html, /<h2>Request envelope<\/h2>/);
  assert.match(html, /<strong>request envelope<\/strong>/);
  assert.match(html, /<ul><li>Normalize once<\/li><li>Apply the policy<\/li><\/ul>/);
  assert.match(html, /&lt;script&gt;alert\(&quot;primer&quot;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(&quot;fence&quot;\)&gt;/);
  assert.doesNotMatch(html, /<script>alert\("primer"\)<\/script>/);

  assert.match(html, /class="ds-concept-diagram" data-concept-diagram/);
  assert.match(html, /\.ds-concept-diagram figcaption\{[^}]*color:var\(--muted\)/);
  assert.match(html, /\.ds-concept-diagram-source\{[^}]*color:var\(--muted\)/);
  assert.match(html, /root\.namespaceURI!==['"]http:\/\/www\.w3\.org\/2000\/svg['"]/);
  assert.match(html, /\[root\]\.concat\(Array\.prototype\.slice\.call\(root\.querySelectorAll\('\*'\)\)\)/);
  assert.match(html, /<pre data-mermaid-source hidden>flowchart LR\n  Request --&gt; Normalize --&gt; Policy<\/pre>/);
  assert.match(html, /aria-label="Parse &lt;then&gt; apply\."/);
  assert.doesNotMatch(html, /<then>/);
  assert.match(html, /class="ds-concept-next"[^>]*data-goto-step="2"/);
  assert.match(html, /Next in code · Step 2/);
  assert.match(html, />Apply the request policy<\/span>/);

  assert.match(html, /1 code step \+ 1 primer/);
  assert.match(html, />1<\/span><span class="ds-fact-l">code step · 1 primer<\/span>/);
  const speech = html.match(/<span class="ds-sr-only" data-speech-concept>(.*?)<\/span>/s)?.[1] ?? '';
  assert.match(speech, /The request envelope/);
  assert.match(speech, /Parse &lt;then&gt; apply\./);
  assert.doesNotMatch(speech, /##|\*\*|```|img src/);
});

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

test('story sidebar uses a compact reading rail with one clear active marker', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /\.ds-stepcard\{[^}]*grid-template-columns:42px minmax\(0,1fr\)/);
  assert.match(html, /\.ds-stepcard::after\{[^}]*width:3px[^}]*background:transparent/);
  assert.match(html, /\.ds-stepcard\.is-active::after\{background:var\(--accent-blue\)\}/);
  assert.match(html, /\.ds-readhead\{[^}]*border:0[^}]*background:transparent/);
  assert.match(html, /\.ds-viewtoggle\{[^}]*padding:3px[^}]*border:0/);
});

test('overview keeps the primary walkthrough action ahead of supporting detail', () => {
  const intentTour = {
    ...tour,
    intent: {
      goal: 'Let reviewers understand the change quickly.',
      design: 'The implementation follows the existing review route.',
    },
  };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  const ledeAt = html.indexOf('class="ds-intro-lede"');
  const startAt = html.indexOf('class="ds-intro-start"');
  const contextAt = html.indexOf('class="ds-intro-context"');
  const factsAt = html.indexOf('class="ds-intro-facts"');

  assert.ok(ledeAt < startAt, 'the overview should establish intent before the action');
  assert.ok(startAt < contextAt, 'the action should be reachable before supporting prose');
  assert.ok(contextAt < factsAt, 'supporting prose should remain available before the review facts');
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(html, /@media \(prefers-reduced-transparency:reduce\)/);
  assert.match(html, /@media \(prefers-contrast:more\)/);
  assert.match(html, /\.ds-intro-context \.ds-intro-design\{[^}]*color:color-mix\(in srgb,var\(--text\) 70%,transparent\)/);
});

test('step narrative tells the reviewer what to verify', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, />Review focus<\/span>/);
  assert.match(html, /class="ds-reviewfocus">Check /);
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

test('the final session layout cannot re-enable horizontal story or diff scrolling', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /\.ds-step\.is-code-step>\.ds-why\{[^}]*overflow-x:hidden;overflow-y:auto/);
  assert.match(html, /\.ds-step\.is-code-step>\.ds-diffscroll\{[^}]*overflow-x:hidden;overflow-y:auto/);
  assert.doesNotMatch(html, /\.ds-step\.is-code-step>\.ds-(?:why|diffscroll)\{[^}]*overflow:auto/);
  assert.match(html, /\.ds-beat\{[^}]*grid-template-columns:22px minmax\(0,1fr\)/);
  assert.match(html, /\.ds-beat-text\{[^}]*min-width:0[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
  assert.match(html, /\.ds-step-title\{[^}]*min-width:0[^}]*overflow-wrap:anywhere/);
});

test('story narrative is a compact reading column instead of a nested full-height card', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /\.ds-step\.is-code-step>\.ds-why\{[^}]*border:0[^}]*border-right:1px solid var\(--line-soft\)[^}]*border-radius:0[^}]*background:transparent/);
  assert.doesNotMatch(html, /\.ds-beats::before/);
  assert.match(html, /\.ds-why-head\{[^}]*border-bottom:0/);
  assert.match(html, /\.ds-beat\{[^}]*grid-template-columns:30px minmax\(0,1fr\)[^}]*border-top:1px solid var\(--line-soft\)/);
  assert.match(html, /\.ds-beat-index\{[^}]*border:0[^}]*background:transparent[^}]*font-family:var\(--mono\)/);
  assert.match(html, /\.ds-beat\.is-selected\{[^}]*border-radius:8px[^}]*background:var\(--fill-2\)[^}]*box-shadow:none/);
  assert.match(html, /@media \(max-width:1080px\)[\s\S]*\.ds-step\.is-code-step>\.ds-why\{[^}]*border:1px solid var\(--line-soft\)[^}]*border-radius:10px/);
});

test('review page returns to change scope and keeps saved reviews secondary', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [], routeBase: '/repo/demo' });
  assert.match(html, /class="ds-back" data-close-story href="\/repo\/demo\/change"/);
  assert.match(html, /<header class="ds-reviewchrome is-storyful" data-review-chrome data-story-chrome>/);
  assert.match(html, /class="ds-ui-icon" aria-hidden="true"><svg[^>]*>[\s\S]*?m15 18-6-6 6-6[\s\S]*?<\/svg><\/span><span>Change<\/span>/);
  assert.match(html, /href="\/repo\/demo\/stories"[\s\S]*Saved reviews/);
  assert.match(html, /\.ds-back\{/);
  assert.doesNotMatch(html, /\.ds-close-story\{/);
  assert.match(html, /@media \(max-width:720px\)[\s\S]*:root\{--ds-rail-width:240px\}/);
  assert.match(html, /\.ds-settings-wrap\{display:none\}/);
  assert.match(html, /getComputedStyle\(layout\)\.getPropertyValue\('--ds-rail-width'\)/);
});

test('narrated stories use one quiet review row and keep secondary controls out of the chrome', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [], routeBase: '/repo/demo' });
  assert.match(html, /<header class="ds-reviewchrome is-storyful" data-review-chrome data-story-chrome>/);
  assert.match(html, /class="ds-title" title="Tiny tour">Diff review<\/div>/);
  assert.match(html, /class="ds-reviewchrome-subtitle">Working tree <span>vs<\/span> <b>main<\/b><\/div>/);
  assert.match(html, /\.ds-reviewchrome\{height:56px[^}]*grid-template-rows:56px/);
  assert.doesNotMatch(html, /class="ds-readaloud" data-readaloud/);
  assert.doesNotMatch(html, /data-settings title="Voice settings"/);
  assert.doesNotMatch(html, /data-shortcuts-open title="Commands and shortcuts"/);
  assert.doesNotMatch(html, /class="ds-reviewstatusbar[^>]*data-roundbar/);
  assert.doesNotMatch(html, /<header class="ds-top">/);
  assert.doesNotMatch(html, /class="ds-titlebar"/);
});

test('toolbar keeps the decision signal primary and demotes agent routing', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /data-review-menu/);
  assert.match(html, /data-review-menu-pop/);
  assert.match(html, />Review</);
  assert.match(html, /aria-label="Review, 0 unresolved comments(?:, [^"]+)?"/);
  assert.match(html, /data-unexplained-count="\d+"/);
  assert.match(html, /ds-review-summary/);
  assert.match(html, /data-agent-target-control/);
  assert.match(html, /data-agent-target-select/);
  assert.match(html, /data-agent-target-name>Choose task</);
  assert.match(html, /<details class="ds-review-more">[\s\S]*data-agent-target-control/);
  assert.match(html, /data-repo="/);
  assert.doesNotMatch(html, /data-send-all/);
  assert.match(html, />Resend open comments</);
  assert.match(html, />More review actions/);
  assert.match(html, /ds-check">✓<\/span> Approve/);
  assert.match(html, /class="ds-review-menu-title"><span>Review<\/span><small>Round 1<\/small><\/div>/);
  assert.doesNotMatch(html, /class="ds-reviewstatusbar[^>]*data-roundbar/);
  assert.doesNotMatch(html, /class="ds-review-menu-coverage"/);
  assert.doesNotMatch(html, /class="ds-reviewstatus-scope"/);
  assert.doesNotMatch(html, />Feedback clear<\/span>/);
  assert.doesNotMatch(html, /class="ds-sessionstage/);
  assert.doesNotMatch(html, /need coverage/);
  assert.doesNotMatch(html, />Question destination</);
  assert.doesNotMatch(html, />Ask for fixes</);
});

test('invalid feedback is a visible approval blocker with recovery guidance', () => {
  const html = renderPage({
    repo: process.cwd(), tour, files, baseLabel: 'main', comments: [],
    reviewState: {
      scopeKey: 'scope', round: 1, currentDiffHash: 'hash', changedFiles: [],
      hasChangesSinceReview: false, events: [], snapshots: [], feedbackVersion: 0,
      blockingFeedbackDigest: 'invalid-source-digest',
      feedbackHealth: {
        status: 'invalid', reason: 'invalid-entry',
        message: '.diffstory/comments.json has an invalid comment.',
        recovery: 'Repair or restore .diffstory/comments.json, then reload. diffStory will not overwrite the invalid file.',
      },
    },
  });
  assert.match(html, /data-feedback-health="invalid"/);
  assert.match(html, /role="alert"><strong>Feedback file needs repair<\/strong>/);
  assert.match(html, /Repair or restore \.diffstory\/comments\.json, then reload/);
  assert.match(html, /data-verdict="approve" disabled/);
  assert.match(html, /Feedback file needs repair/);
  assert.match(html, /data-feedback-health'\)==='invalid'/);
});

test('version-aware review rounds expose full and since-review modes', () => {
  const html = renderPage({
    repo: process.cwd(), tour, files, baseLabel: 'main', comments: [], reviewMode: 'full',
    reviewState: {
      scopeKey: 'scope', round: 2, currentDiffHash: 'hash', currentSnapshotId: 'r2',
      compareFrom: { id: 'r1', round: 1, createdAt: new Date().toISOString() },
      changedFiles: ['a.ts'], hasChangesSinceReview: true, events: [], snapshots: [],
    },
  });
  assert.match(html, /Round 2/);
  assert.match(html, /1 file changed since your feedback/);
  assert.match(html, /data-review-mode="full"/);
  assert.match(html, /data-review-mode="since"/);
  assert.match(html, /data-review-mode="full"[^>]*aria-pressed="true"/);
  assert.match(html, /data-filter-since="1"/);
  assert.match(html, /class="ds-roundmodes ds-review-menu-modes" role="group" aria-label="Review comparison"/);
  assert.match(html, /class="ds-review-menu-title"><span>Review<\/span><small>Round 2<\/small><\/div>/);
  assert.match(html, /\.ds-review-menu-modes\{width:100%;margin:0 0 8px\}/);
  assert.doesNotMatch(html, /class="ds-reviewstatusbar[^>]*data-roundbar/);
  assert.match(html, /var open=compactScreen\(\)&&!collapsed,main=\$\('\.ds-main'\),chrome=\$\('\.ds-reviewchrome-main'\)/);
  assert.match(html, /\.ds-layout>\.ds-rail,body:not\(\.ds-rail-collapsed\) \.ds-rail-scrim\{top:52px\}/);
  assert.doesNotMatch(html, /\.ds-roundmodes\{display:none\}/);
});

test('review action feedback uses a persistent live region with assertive error escalation', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });

  assert.match(html, /<div class="ds-toast" id="ds-toast" role="status" aria-live="polite" aria-atomic="true" aria-relevant="additions text"><\/div>/);
  assert.doesNotMatch(html, /id="ds-toast"[^>]* hidden/);
  assert.match(html, /function toast\(msg,tone\)/);
  assert.match(html, /isError=tone==='error'/);
  assert.match(html, /setAttribute\('role',isError\?'alert':'status'\)/);
  assert.match(html, /setAttribute\('aria-live',isError\?'assertive':'polite'\)/);
  assert.match(html, /toastEl\.textContent='';toastEl\.classList\.remove\('is-error'\);toastEl\.setAttribute\('role','status'\);toastEl\.setAttribute\('aria-live','polite'\)/);
  assert.match(html, /Could not save the review decision\.',\s*'error'/);
  assert.match(html, /setTimeout\(function\(\)\{location\.reload\(\);\},5000\)/, 'keeps verdict success mounted long enough to announce');
  assert.doesNotMatch(html, /location\.reload\(\);\},450\)/, 'does not interrupt the polite success announcement');
  assert.match(html, /\.ds-toast\.is-error\{/);
  assert.match(html, /\.ds-toast\{[^}]*width:max-content;max-width:min\(540px,calc\(100vw - 24px\)\);overflow-wrap:anywhere/);
});

test('server-rendered comments bootstrap the client cache without a false zero first paint', () => {
  const html = renderPage({
    repo: process.cwd(), tour, files, baseLabel: 'main',
    comments: [{
      id: 'bootstrap-comment', file: 'a.ts', line: 1, side: 'right', type: 'question',
      severity: 'concern', body: '</script><strong>still data</strong>', status: 'open',
      createdAt: new Date().toISOString(),
    }],
  });

  assert.match(html, /<script type="application\/json" id="ds-initial-comments">/);
  assert.match(html, /"id":"bootstrap-comment"/);
  assert.match(html, /\\u003c\/script\\u003e\\u003cstrong\\u003estill data\\u003c\/strong\\u003e/);
  assert.doesNotMatch(html, /<script type="application\/json" id="ds-initial-comments">[^<]*<\/script><strong>/);
});

test('secondary review text tokens retain 4.5 to 1 contrast on every surface tier', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  const rolePattern = /--text:var\(--md-on-surface\); --text-secondary:(#[0-9A-F]{6}); --text-tertiary:(#[0-9A-F]{6}); --text-minimum:(#[0-9A-F]{6});/gi;
  const roleSets = [...html.matchAll(rolePattern)].map((match) => match.slice(1));

  assert.equal(roleSets.length, 2, 'dark and light schemes should define explicit semantic text roles');
  assert.match(html, /--muted:var\(--text-secondary\); --dim:var\(--text-tertiary\); --dim2:var\(--text-minimum\); --faint:var\(--text-minimum\)/);

  function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map((part) => {
      const value = Number.parseInt(part, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }
  function contrast(foreground, background) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }

  for (const color of roleSets[0]) {
    assert.ok(contrast(color, '#48484A') >= 4.5, `${color} must be readable on the highest dark surface`);
  }
  for (const color of roleSets[1]) {
    assert.ok(contrast(color, '#E3E3E8') >= 4.5, `${color} must be readable on the highest light surface`);
  }
});

test('review page renders feedback, timeline, filters, resume, and story repair affordances', () => {
  const comments = [{
    id: 'c1', file: 'src/demo.ts', line: 2, type: 'change', body: 'Tighten this', status: 'addressed',
    createdAt: new Date().toISOString(), selectedText: 'return 1', turns: [{ role: 'ai', text: 'Fixed it', at: new Date().toISOString() }],
  }];
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments });
  assert.match(html, /data-feedback-open="feedback"/);
  assert.match(html, /data-feedback-view="timeline"/);
  assert.match(html, /Needs verification/);
  assert.match(html, /data-file-search/);
  assert.match(html, /data-resume-review/);
  assert.match(html, /data-shortcuts-open/);
  assert.match(html, /data-story-repair="shorten"/);
  assert.doesNotMatch(html, /data-selection-quick/);
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
  assert.match(html, /'Save only'/);
  assert.match(html, /'Choose task & ask'/);
  assert.match(html, /data-agent-target-cta/);
  assert.match(html, /allComments\.push\(c\);noteBlockingFeedbackMutation\(c\);removeComposer\(box,false\);syncThreads\(\);syncFeedbackCards\(\);refreshCount\(\);/);
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
  assert.match(html, /document\.body\.style\.setProperty\('--ds-rail-width',width\+'px'\)/);
  assert.match(html, /function startSidebarResize\(e\)/);
  assert.match(html, /localStorage\.setItem\('ds-sidebar-width',String\(Math\.round\(width\)\)\)/);
  assert.match(html, /document\.addEventListener\('mousedown',startSidebarResize\)/);
  assert.match(html, /document\.addEventListener\('mousemove',moveSidebarResize\)/);
  assert.match(html, /document\.addEventListener\('mouseup',endSidebarResize\)/);
  assert.doesNotMatch(html, /\.ds-rail\{--ds-rail-width:/, 'redesign styles must not override the user-resized width');
});

test('compact review opens on the diff and keeps the optional sidebar as an overlay', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /@media \(max-width:720px\)[\s\S]*\.ds-layout>\.ds-rail\{position:fixed;top:56px;bottom:0;left:0/);
  assert.match(html, /@media \(max-width:720px\)[\s\S]*\.ds-main\{width:100%\}/);
  assert.match(html, /@media \(max-width:720px\)[\s\S]*\.ds-rail-resizer\{display:none\}/);
  assert.match(html, /function compactScreen\(\)/);
  assert.match(html, /setSidebarCollapsed\(compactScreen\(\)\|\|storedCollapsed==='1',false\)/);
  assert.match(html, /localStorage\.setItem\('ds-sidebar-collapsed',collapsed\?'1':'0'\)/);
  assert.match(html, /function collapseCompactSidebar\(\)/);
  assert.match(html, /b\.classList\.toggle\('is-active',!collapsed\)/);
  assert.match(html, /body:not\(\.ds-rail-collapsed\) \.ds-reviewchrome-rail \.ds-sidebar-toggle\.is-active\{background:var\(--md-secondary-container\)/);
  assert.match(html, /chrome=\$\('\.ds-reviewchrome-main'\)/);
  assert.match(html, /if\(chrome\)\{if\(open\)chrome\.setAttribute\('inert',''\);else chrome\.removeAttribute\('inert'\);\}/);
  assert.match(html, /data-sidebar-scrim/);
  assert.match(html, /body:not\(\.ds-rail-collapsed\) \.ds-rail-scrim\{display:block;position:fixed;top:56px;right:0;bottom:0;left:min\(var\(--ds-rail-width,240px\),calc\(100vw - 48px\)\)/);
  assert.match(html, /\.ds-reviewchrome,body\.ds-rail-collapsed \.ds-reviewchrome\{height:56px;grid-template-columns:minmax\(0,1fr\);grid-template-rows:56px\}/);
  assert.match(html, /\.ds-reload-diff,\.ds-review-menu\{min-width:44px;height:44px/);
  assert.match(html, /if\(open\)main\.setAttribute\('inert',''\);else main\.removeAttribute\('inert'\)/);
  assert.match(html, /if\(compactScreen\(\)&&!document\.body\.classList\.contains\('ds-rail-collapsed'\)\)closeCompactSidebar\(true\)/);
  assert.match(html, /\.ds-filetree-dir>summary,\.ds-fileitem\{min-height:44px\}/);
  assert.match(html, /\.ds-fileitem\{padding-right:5px;padding-left:calc\(5px \+ var\(--tree-indent,0px\)\)\}/);
  assert.match(html, /\.ds-filetree-count\{display:none\}/);
});

test('review view switcher exposes complete keyboard tab semantics', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /id="ds-tab-tour"[^>]*role="tab"[^>]*aria-controls="ds-view-tour"[^>]*aria-selected="true"/);
  assert.match(html, /id="ds-tab-files"[^>]*role="tab"[^>]*aria-controls="ds-view-files"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
  assert.match(html, /id="ds-view-tour" role="tabpanel" aria-labelledby="ds-tab-tour" tabindex="0"/);
  assert.match(html, /id="ds-view-files" role="tabpanel" aria-labelledby="ds-tab-files" tabindex="0"/);
  assert.match(html, /t\.setAttribute\('aria-selected',on\?'true':'false'\);t\.tabIndex=on\?0:-1/);
  assert.match(html, /viewTab&&\(e\.key==='ArrowLeft'\|\|e\.key==='ArrowRight'\)/);
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

  assert.match(html, /<div class="ds-filetree">/);
  assert.doesNotMatch(html, /role="tree(?:item)?"/);
  assert.doesNotMatch(html, /class="ds-filetree"[^>]*role=/);
  assert.match(html, /class="ds-filetree-dir" data-filetree-path="contracts\/" style="--tree-depth:0" open/);
  assert.match(html, /class="ds-filetree-dir" data-filetree-path="contracts\/interfaces\/" style="--tree-depth:1" open/);
  assert.match(html, /data-goto-file="contracts\/DepositVault\.sol"/);
  assert.match(html, /data-goto-file="contracts\/interfaces\/IInstantWithdraw\.sol"/);
  assert.match(html, /data-goto-file="README\.md"/);
  assert.match(html, /class="ds-filetree-caret"[^>]*><svg/);
  assert.match(html, /class="ds-filetree-folder"[^>]*><svg/);
  assert.match(html, /class="ds-fileitem-spacer"/);
  assert.match(html, /class="ds-fileitem-icon k-changed"[^>]*><svg/);
  assert.doesNotMatch(html, /class="ds-fileitem-symbol"/);
  assert.match(html, /\.ds-fileitem\{display:grid;grid-template-columns:14px 16px minmax\(0,1fr\) auto/);
  assert.match(html, /\.ds-fileitem-path\{min-width:0;font-family:var\(--sans\)/);
  assert.match(html, /@container \(max-width:300px\)\{\.ds-filetree-count\{display:none\}/);
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
  assert.match(html, /function jumpRelativeChange\(holder,delta,opts\)/);
  assert.match(html, /function jumpToFirstChange\(holder\)/);
  assert.match(html, /function handleChangeShortcut\(e\)/);
  assert.match(html, /b=closest\(t,'\[data-change-prev\]'\);if\(b\)\{jumpRelativeChange\(closest\(b,'.ds-filepanel'\)\|\|closest\(b,'.ds-diff'\),-1\);return;\}/);
  assert.match(html, /b=closest\(t,'\[data-change-next\]'\);if\(b\)\{jumpRelativeChange\(closest\(b,'.ds-filepanel'\)\|\|closest\(b,'.ds-diff'\),1\);return;\}/);
  assert.match(html, /jumpToFirstChange\(panel\)/);
  assert.match(html, /mountThreads\(fullInner\);updateChangeNav\(closest\(fullInner,'.ds-filepanel'\)\|\|closest\(fullInner,'.ds-diff'\)\);jumpToFirstChange\(closest\(fullInner,'.ds-filepanel'\)\|\|closest\(fullInner,'.ds-diff'\)\);/);
});

test('the review chrome keeps one focused play control without voice-settings clutter', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.doesNotMatch(html, /data-voice-engine=/);
  assert.match(html, /class="ds-readaloud ds-readaloud-primary" data-readaloud[^>]*aria-label="Play story"/);
  assert.match(html, /data-readaloud-label>Play<\/span>/);
  assert.doesNotMatch(html, /id="ds-settings"/);
  assert.match(html, /class="ds-playstep" data-playstep/, 'step-level narration remains available in context');
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
  assert.match(html, /label\.textContent=speechLoadingLabel\|\|\(readAloud\?'Stop':'Play'\)/);
  assert.match(html, /btn\.setAttribute\('aria-label',buttonLabel\)/);
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
  assert.match(html, /function centerFocusRows\(rows,instant\)/);
  assert.match(html, /var scroller=closest\(target,'\.ds-diffscroll'\)/);
  assert.match(html, /scroller\.scrollTo\(\{top:Math\.max\(0,top\),behavior:instant\|\|prefersReducedMotion\(\)\?'auto':'smooth'\}\)/);
  assert.doesNotMatch(html, /target\.scrollIntoView/);
  assert.doesNotMatch(html, /scrollIntoView/, 'review row navigation must never scroll horizontal ancestors');
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

test('silent story navigation persistently centers the first authored focus', () => {
  const focusTour = {
    ...tour,
    steps: [{
      ...tour.steps[0],
      range: [1, 3],
      viewport: [1, 3],
      highlights: [[1, 1], [3, 3]],
      beats: [
        { text: 'Start at the setup.', highlights: [[1, 1]] },
        { text: 'Then inspect the result.', highlights: [[3, 3]] },
      ],
    }],
  };
  const focusFiles = [{
    ...files[0],
    hunks: [{
      oldStart: 1,
      oldLines: 0,
      newStart: 1,
      newLines: 3,
      lines: [
        { type: 'add', content: 'setup', newNo: 1 },
        { type: 'add', content: 'middle', newNo: 2 },
        { type: 'add', content: 'result', newNo: 3 },
      ],
    }],
  }];
  const html = renderPage({ repo: process.cwd(), tour: focusTour, files: focusFiles, baseLabel: 'main', comments: [] });

  assert.match(html, /data-step-panel="1"[^>]*data-story-focus="authored"/);
  assert.match(html, /storyFocusIndex=-1,storyFocusGroup=-1/);
  assert.match(html, /function selectStoryFocus\(stepIndex,group,shouldScroll\)/);
  assert.match(html, /var storyFocused=ap&&i>0\?selectStoryFocus\(i,0,true\):false;/);
  assert.match(html, /if\(ap&&!storyFocused\)jumpToFirstChange/);
  assert.match(html, /rows\[Math\.floor\(\(rows\.length-1\)\/2\)\]/);
  assert.match(html, /\.ds-row\.is-story-focus/);
  assert.match(html, /content:'Story focus'/);
  assert.match(html, /\.ds-step\.is-voice-active \.ds-row\.is-story-focus:not\(\.is-voice-focus\)/);
  assert.doesNotMatch(html, /function clearVoiceFocus\(\)\{(?:(?!function clearActiveBeats)[\s\S])*clearStoryFocus\(\)/);
});

test('story beats are keyboard controls that select and center their exact rows', () => {
  const beatTour = {
    ...tour,
    steps: [{
      ...tour.steps[0],
      highlights: [[1, 1]],
      beats: [{ text: 'Inspect the changed line.', highlights: [[1, 1]] }],
    }],
  };
  const html = renderPage({ repo: process.cwd(), tour: beatTour, files, baseLabel: 'main', comments: [] });
  const beatTag = html.match(/<button type="button" class="ds-beat"[^>]*>/)?.[0] ?? '';

  assert.match(beatTag, /data-story-beat/);
  assert.match(beatTag, /aria-pressed="false"/);
  assert.match(beatTag, /aria-label="Focus beat 1:/);
  assert.match(beatTag, /aria-controls="ds-story-diff-1"/);
  assert.match(beatTag, /data-focus-destination="a.ts, line 1"/);
  assert.doesNotMatch(beatTag, /voice/i);
  assert.match(html, /id="ds-story-diff-1"[^>]*data-story-diff[^>]*role="region"[^>]*aria-label="a.ts story diff"/);
  assert.match(html, /data-story-focus-status aria-live="polite" aria-atomic="true"/);
  assert.match(html, /\.ds-beat:focus-visible/);
  assert.match(html, /b=closest\(t,'\[data-story-beat\]'\)/);
  assert.match(html, /selectStoryFocus\(bpi,bpg,true\)/);
  assert.match(html, /rows\.forEach\(function\(r\)\{r\.classList\.add\('is-story-focus'\);\}\)/);
  assert.match(html, /announceStoryFocus\(panel,beat\)/);
  assert.match(html, /status\.textContent='Story beat '/);
});

test('story steps default to a real unified diff while split stays opt-in', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });

  assert.match(html, /class="ds-modetoggle" role="group" aria-label="Diff display mode"/);
  assert.match(html, /data-mode="diff" aria-pressed="true">Unified<\/button>/);
  assert.match(html, /data-mode="split" aria-pressed="false">Split<\/button>/);
  assert.match(html, /data-playstep title="Read this step aloud" aria-label="Read this step aloud"/);
  assert.match(html, /<div data-diff-inner>[\s\S]*class="ds-diffbody ds-diffbody-unified"/);
  assert.match(html, /<div data-split-inner data-loaded="1" hidden>[\s\S]*class="ds-diffbody"/);
  assert.match(html, /function applyResponsiveStoryMode\(panel\)/);
  assert.match(html, /if\(!panel\|\|!compactScreen\(\)\)return;/);
  assert.match(html, /holder\.hasAttribute\('data-mode-user-set'\)/);
  assert.match(html, /setMode\(unified,\{persist:false\}\)/);
  assert.match(html, /if\(storyFocusIndex===panelIndex\)selectStoryFocus\(panelIndex,storyFocusGroup,true\)/);
  assert.match(html, /modeHolder\.setAttribute\('data-mode-user-set','1'\)/);
});

test('arrow keys on a focused story beat move the authored camera instead of the global change cursor', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });

  assert.match(html, /function moveStoryBeat\(button,delta\)/);
  assert.match(html, /selectStoryFocus\(stepIndex,group,true\);target\.focus\(\);return true;/);
  assert.match(html, /var focusedStoryBeat=closest\(e\.target,'\[data-story-beat\]'\);/);
  assert.match(html, /if\(focusedStoryBeat&&\(e\.key==='ArrowRight'\|\|e\.key==='ArrowLeft'\)\)\{[\s\S]*e\.preventDefault\(\);moveStoryBeat[\s\S]*var wantsBeatNav=/);
  assert.match(html, /\.ds-urow\.is-story-focus/);
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
  assert.match(html, /function setActive\(i,autoSpeak\)/);
  assert.match(html, /loadStoryStep\(i,function\(ok\)\{if\(ok&&active===i\)\{activateStep\(i,autoSpeak!==false\);loadStoryStep\(i\+1\);\}\}\);/);
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
  const storylessFiles = [
    files[0],
    {
      oldPath: 'contracts/Fee.sol',
      newPath: 'contracts/Fee.sol',
      status: 'modified',
      hunks: [
        {
          oldStart: 8,
          oldLines: 1,
          newStart: 8,
          newLines: 1,
          lines: [{ type: 'add', content: 'fee = capped;', newNo: 8 }],
        },
      ],
    },
    {
      oldPath: 'test/Fee.test.ts',
      newPath: 'test/Fee.test.ts',
      status: 'modified',
      hunks: [
        {
          oldStart: 4,
          oldLines: 1,
          newStart: 4,
          newLines: 1,
          lines: [{ type: 'add', content: 'assert.equal(fee, cap);', newNo: 4 }],
        },
      ],
    },
  ];
  const html = renderPage({
    repo: process.cwd(),
    tour: { version: 1, title: '', summary: '', steps: [], base: 'abc123' },
    files: storylessFiles,
    baseLabel: 'main',
    headRef: 'def456',
    comments: [],
    routeBase: '/repo/demo',
    storyless: true,
  });
  assert.match(html, /data-storyless="1"/);
  assert.match(html, /<header class="ds-reviewchrome" data-review-chrome data-storyless-chrome>/);
  assert.match(html, /class="ds-title" title="Reviewing the diff">Diff review<\/div>/);
  assert.match(html, /class="ds-reviewchrome-subtitle">Working tree <span>vs<\/span> <b>main<\/b><\/div>/);
  assert.match(html, /class="ds-reload-diff" data-reload-diff[^>]*aria-label="Reload diff"/);
  assert.match(html, /class="ds-ui-icon ds-review-menu-icon"/);
  assert.doesNotMatch(html, /class="ds-review-menu-dot"/);
  assert.doesNotMatch(html, /class="ds-readaloud"/);
  assert.doesNotMatch(html, /id="ds-settings"/);
  assert.match(html, /id="storyAgentSel"/);
  assert.match(html, /id="storyModelSel"/);
  assert.match(html, /id="storyMode"/);
  assert.doesNotMatch(html, /<select id="storyAgentSel"|<select id="storyModelSel"|<select id="storyMode"/);
  assert.match(html, /id="storyAgentChoices"/);
  assert.match(html, /id="storyModelChoices"/);
  assert.match(html, /data-story-agent-state aria-live="polite" tabindex="-1">Checking available writers…/);
  assert.match(html, /data-story-quality-field hidden/);
  assert.match(html, /id="storyReviewerNote"/);
  assert.match(html, />What should this change accomplish\?<\/span>/);
  assert.match(html, />Optional · recommended<\/span>/);
  assert.match(html, /placeholder="Paste the request, acceptance criteria, or anything the story must not miss\."/);
  assert.match(html, /separate intended behavior from accidental changes/);
  assert.match(html, /data-story-file value="contracts\/Fee\.sol" checked/);
  assert.match(html, /data-story-file value="test\/Fee\.test\.ts" checked/);
  assert.match(html, /data-story-scope-action="all"/);
  assert.match(html, /data-story-scope-action="tests"/);
  assert.match(html, /data-story-ext="\.sol"/);
  assert.match(html, /data-story-scope open/);
  assert.match(html, /data-story-file-search/);
  assert.match(html, /<b id="storyScopeCount">3<\/b> of 3 selected/);
  assert.match(html, />Select all<\/button>/);
  assert.match(html, />Only source<\/button>/);
  assert.match(html, />Only tests<\/button>/);
  assert.match(html, />Only \.sol<\/button>/);
  assert.match(html, /id="storyScopeError" tabindex="-1" hidden/);
  assert.match(html, />Review depth<\/legend>/);
  assert.match(html, /Every mode reviews the same selected changes/);
  assert.match(html, /Choose how much guidance you want, not how much code you are willing to miss/);
  assert.match(html, /aria-label="Story depth"/);
  assert.match(html, /data-story-choice="storyMode" data-value="brief"/);
  assert.match(html, />Compact<\/strong>/);
  assert.match(html, />Shortest<\/span>/);
  assert.match(html, /data-story-choice="storyMode" data-value="guided"/);
  assert.match(html, />Guided review<\/strong>/);
  assert.match(html, />Recommended<\/span>/);
  assert.match(html, /without narrating every line/);
  assert.match(html, /data-story-choice="storyMode" data-value="detailed"/);
  assert.match(html, />Deep review<\/strong>/);
  assert.match(html, />Most detail<\/span>/);
  assert.match(html, /Trivial syntax stays skipped/);
  assert.match(html, /role="radio"[^>]*aria-checked="true" tabindex="0"/);
  assert.match(html, /function updateStoryGenerationSummary/);
  assert.match(html, /nextChoice\.focus\(\);nextChoice\.click\(\)/);
  assert.match(html, /emptyState\.scope\.open=true/);
  assert.match(html, /emptyState\.scopeError\.hidden=false;emptyState\.scopeError\.focus\(\)/);
  assert.match(html, /if\(e\.scopeError\)e\.scopeError\.hidden=!!n/);
  assert.match(html, /if\(generate\)generate\.disabled=!n\|\|agentBusy\|\|!storyAgentReady/);
  assert.match(html, /data-reload-diff/);
  assert.match(html, /Reload diff/);
  assert.match(html, /closest\(t,'\[data-reload-diff\]'\)/);
  assert.match(html, /b\.disabled=true;b\.classList\.add\('is-loading'\);b\.setAttribute\('aria-busy','true'\);b\.setAttribute\('aria-label','Reloading diff'\)/);
  assert.match(html, /requestAnimationFrame\(function\(\)\{location\.reload\(\);\}\);return;/);
  assert.doesNotMatch(html, />Line-by-line<\/button>/);
  assert.match(html, /Best quality/);
  assert.match(html, /Lower cost/);
  assert.match(html, /\/api\/codex\/models/);
  assert.match(html, /loadCodexStoryModels/);
  assert.match(html, /Use the default model from your installed Codex app/);
  assert.doesNotMatch(html, /gpt-5-mini/);
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
  assert.doesNotMatch(html, /\.ds-choicegroup[^}]*overflow-x:auto/);
  assert.match(html, /data-generate-story disabled data-review-url="\/repo\/demo\/review\?story=story\.json" data-base="abc123" data-head="def456"/);
  assert.match(html, /fetch\('\/api\/agents'\)/);
  assert.match(html, /setStoryAgents\(\[\],'Could not check local writers\. Reload the page to try again\.'\)/);
  assert.doesNotMatch(html, /setStoryAgents\(\['codex','claude'\]\)/);
  assert.match(html, /No local writer found\. Install Codex or Claude, then reload this page\./);
  assert.match(html, /fetch\('\/api\/skills\/update',\{method:'POST'\}\)/);
  assert.match(html, /if\(sk\.legacyInstalled\)/);
  assert.match(html, /review-tour was renamed to diffstory-storyteller/);
  assert.match(html, /data-story-choice/);
  assert.match(html, /function renderStoryChoices/);
  assert.match(html, /function setStoryChoice/);
  assert.match(html, /base:btn\.getAttribute\('data-base'\)\|\|undefined/);
  assert.match(html, /head:btn\.getAttribute\('data-head'\)\|\|undefined/);
  assert.match(html, /agent:e\.agentSel&&e\.agentSel\.value\?e\.agentSel\.value:undefined/);
  assert.match(html, /mode:e\.modeSel&&e\.modeSel\.value\?e\.modeSel\.value:undefined/);
  assert.match(html, /includedFiles:storySelectedFiles\(\)/);
  assert.match(html, /reviewerNote:e\.note&&e\.note\.value\?e\.note\.value\.trim\(\):undefined/);
  assert.doesNotMatch(html, /codexProvider:/);
  assert.doesNotMatch(html, /codexSandbox:/);
  assert.doesNotMatch(html, /codexProfile:/);
  assert.doesNotMatch(html, /codexConfig:/);
});

test('story generation failure offers error-specific recovery without overclaiming rollback', () => {
  const html = renderPage({
    repo: process.cwd(),
    tour: { version: 1, title: '', summary: '', steps: [], base: 'main' },
    files,
    baseLabel: 'main',
    comments: [],
    storyless: true,
  });

  assert.match(html, /function startRun\(\)\{/);
  assert.match(html, /failed=state==='failed'/);
  assert.match(html, /failed\?"The story wasn't created":'Writing the story of this change'/);
  assert.match(html, /failed\?'Story not created':'Story in progress'/);
  assert.match(html, /No reviewable story is available yet\. Try again, or change the story settings\./);
  assert.doesNotMatch(html, /Your diff is untouched/);
  assert.match(html, /if\(intro\)setStoryGenerating\('failed'\)/);
  assert.match(html, /if\(intro\)setStoryGenerating\(true\);/);
  assert.match(html, /function showRecovery\(err\)/);
  assert.match(html, /modelFailure=!!\(err&&\/Codex needs an update for\//);
  assert.match(html, /ds-pp-reload','Change model'/);
  assert.match(html, /ds-pp-secondary','Retry after updating'/);
  assert.match(html, /ds-pp-reload','Try again'/);
  assert.match(html, /ds-pp-secondary','Review settings'/);
  assert.match(html, /onBlocked:function\(err\)\{[^}]*showRecovery\(err\)/);
  assert.match(html, /showRecovery\(panel\.error\(\)\)/);
  assert.match(html, /panel\.els\.close\.hidden=true/);
  assert.match(html, /root\.offsetParent&&\(!active\|\|active===document\.body\|\|active===btn\)\)primary\.focus\(\)/);
  assert.match(html, /data-story-choice="storyModelSel"\]\[aria-checked="true"\]/);
  assert.match(html, /data-story-choice="storyMode"\]\[aria-checked="true"\]/);
});

test('large story scopes stay collapsed until the reviewer chooses to edit them', () => {
  const manyFiles = Array.from({ length: 13 }, (_, i) => ({
    ...files[0],
    oldPath: `src/file-${i}.ts`,
    newPath: `src/file-${i}.ts`,
  }));
  const html = renderPage({
    repo: process.cwd(),
    tour: { version: 1, title: '', summary: '', steps: [], base: 'main' },
    files: manyFiles,
    baseLabel: 'main',
    comments: [],
    storyless: true,
  });
  const scopeTag = html.match(/<details class="ds-storyscope"[^>]*>/)?.[0] ?? '';
  assert.match(scopeTag, /data-story-scope/);
  assert.doesNotMatch(scopeTag, /\sopen/);
  assert.match(html, /<b id="storyScopeCount">13<\/b> of 13 selected/);
  assert.match(html, /\.ds-depthchoices\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(html, /\.ds-depthchoice-badge\{[^}]*font-size:10\.5px/);
  assert.match(html, /\.ds-depthchoice-meta\{[^}]*font-size:10\.5px/);
  assert.match(html, /@media \(max-width:700px\)\{\.ds-choicegroup\{[^}]+\}\.ds-depthchoices\{grid-template-columns:1fr\}/);
});

test('story scope keeps excluded files visible without flagging them as unexplained', () => {
  const scopedFiles = [
    files[0],
    {
      oldPath: 'b.test.ts',
      newPath: 'b.test.ts',
      status: 'modified',
      hunks: [
        {
          oldStart: 1,
          oldLines: 1,
          newStart: 1,
          newLines: 1,
          lines: [{ type: 'add', content: 'expect(ok).toBe(true)', newNo: 1 }],
        },
      ],
    },
  ];
  const scopedTour = {
    ...tour,
    storyScope: {
      includedFiles: ['a.ts'],
      excludedFiles: ['b.test.ts'],
    },
  };
  const html = renderPage({ repo: process.cwd(), tour: scopedTour, files: scopedFiles, baseLabel: 'main', comments: [] });
  assert.match(html, /b\.test\.ts/);
  assert.doesNotMatch(html, /<b>1<\/b> unexplained/);
  assert.doesNotMatch(html, /title="1 unexplained change"/);
  assert.match(html, /data-story-scope="focused"/);
  assert.match(html, /Story covers its selected scope/);
  assert.match(html, /selected story scope explained/);
  assert.doesNotMatch(html, /every change explained/);
});

test('intro panel leads with recovered intent without duplicating it in a review map', () => {
  const intentTour = {
    ...tour,
    intent: {
      goal: 'We wanted ops to cap runaway fees before settlement.',
      design: 'The keeper clamps through one shared helper.',
      sources: ['commit abc1234', 'PR #7 body'],
    },
  };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-intro-lede" data-speech-overview>We wanted ops to cap runaway fees before settlement\./);
  assert.match(html, /class="ds-intro-design" data-speech-overview>The keeper clamps through one shared helper\./);
  assert.doesNotMatch(html, /ds-reviewmap|ds-review-evidence|What deserves attention/);
});

test('intro panel keeps the summary as the reading map when intent exists', () => {
  const intentTour = { ...tour, intent: { goal: 'Cap runaway fees.' } };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-intro-lede" data-speech-overview>Cap runaway fees\./);
  assert.match(html, /class="ds-intro-design" data-speech-overview>One changed line\./);
});

test('intro panel falls back to the summary lede without an intent block', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /class="ds-intro-lede" data-speech-overview>One changed line\./);
  assert.doesNotMatch(html, /ds-intro-sources/);
  assert.doesNotMatch(html, /class="ds-intro-design"/);
});

test('read aloud starts with overview context before advancing to step one', () => {
  const intentTour = {
    ...tour,
    intent: {
      goal: 'Let reviewers understand the original task.',
      design: 'Frame the flow before opening the implementation.',
    },
  };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });

  assert.equal((html.match(/<p class="ds-intro-(?:lede|design)" data-speech-overview/g) ?? []).length, 3);
  assert.match(html, /var overview=\$all\('\[data-speech-overview\],\[data-speech-concept\]',panel\)/);
  assert.match(html, /overview\.map\(function\(node\)\{return \{text:speechClean\(node\.textContent\|\|''\),group:null\};\}\)/);
  assert.match(html, /function advanceAfterSpeechStep\(stepIndex,manual\)/);
  assert.match(html, /var n=nextSpeakableStep\(stepIndex\);if\(n>=0\)\{setActive\(n\);return;\}/);
});

test('intent text is HTML-escaped in the intro panel', () => {
  const intentTour = { ...tour, intent: { goal: 'Guard <script> tags', sources: ['a & b'] } };
  const html = renderPage({ repo: process.cwd(), tour: intentTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /Guard &lt;script&gt; tags/);
  assert.doesNotMatch(html, /Guard <script> tags/);
  assert.doesNotMatch(html, /a (?:&|&amp;) b/);
});

test('all-files view exposes reviewed and unreviewed controls bound to file hashes', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.doesNotMatch(html, /<div class="ds-fileshead"|<[^>]+ data-file-hint/);
  assert.doesNotMatch(html, /class="ds-untoured-badge"|class="ds-stepchip"|class="ds-symbols"|class="ds-cardstat"/);
  assert.match(html, /class="ds-cardpath"/);
  assert.match(html, /class="ds-changejump"/);
  assert.match(html, /class="ds-modetoggle"/);
  assert.match(html, /data-viewed-scope="/);
  assert.match(html, /data-viewed-progress/);
  assert.match(html, /data-viewed-toggle aria-pressed="false"/);
  assert.match(html, /data-viewed-label>Mark reviewed</);
  assert.match(html, /data-review-hash="[a-f0-9]{64}"/);
  assert.match(html, /class="ds-fileitem-viewed" aria-hidden="true">✓</);
  assert.match(html, /data-file-filter="all" aria-pressed="true">All<\/button>/);
  assert.match(html, /data-file-filter="reviewed" aria-pressed="false">Reviewed<\/button>/);
  assert.match(html, /data-file-filter="unreviewed" aria-pressed="false">Unreviewed<\/button>/);
  assert.match(html, /btn\.setAttribute\('aria-pressed',active\?'true':'false'\)/);
  assert.match(html, /data-next-unviewed[^>]*>Next unreviewed/);
  assert.doesNotMatch(html, />Unviewed<\/button>/);
  assert.doesNotMatch(html, /role="checkbox"/);
});

test('commands describe V as toggling exact-file review state instead of advancing', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /data-command="toggle-viewed"[\s\S]*Toggle current file reviewed[\s\S]*<kbd>V<\/kbd>/);
  assert.doesNotMatch(html, /data-command="next-unviewed"(?:(?!<\/button>)[\s\S])*<kbd>V<\/kbd>/);
});

test('whole-change approval gates only on blocking feedback and full review mode', () => {
  const concern = {
    id: 'concern', file: 'a.ts', line: 1, type: 'question', severity: 'concern',
    body: 'Please double-check this.', status: 'open', createdAt: new Date().toISOString(),
  };
  const concernHtml = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [concern] });
  assert.match(concernHtml, /data-verdict="approve"(?![^>]*\sdisabled)[^>]*>/);
  assert.match(concernHtml, /no blocking feedback remains/);

  const blockingHtml = renderPage({
    repo: process.cwd(), tour, files, baseLabel: 'main',
    comments: [{ ...concern, id: 'blocking', type: 'change', severity: 'blocking' }],
  });
  assert.match(blockingHtml, /data-verdict="approve"[^>]*\sdisabled/);
  assert.match(blockingHtml, /Resolve 1 blocking comment first/);

  const sinceHtml = renderPage({
    repo: process.cwd(), tour, files, baseLabel: 'main', comments: [], reviewMode: 'since',
  });
  assert.match(sinceHtml, /data-verdict="approve"[^>]*\sdisabled/);
  assert.match(sinceHtml, /Return to Full change before approving the whole change/);

  const focusedHtml = renderPage({
    repo: process.cwd(),
    tour: { ...tour, storyScope: { includedFiles: ['a.ts'], excludedFiles: ['outside.ts'] } },
    files,
    baseLabel: 'main',
    comments: [],
  });
  assert.match(focusedHtml, /data-verdict="approve"[^>]*\sdisabled/);
  assert.match(focusedHtml, /This story omits changed files/);

  const divergentHtml = renderPage({
    repo: process.cwd(), tour, files, baseLabel: 'main', comments: [],
    stagedWorktreeDivergentFiles: ['a.ts'],
  });
  assert.match(divergentHtml, /data-verdict="approve"[^>]*\sdisabled/);
  assert.match(divergentHtml, /Reconcile 1 staged\/working-tree mismatch before approval/);
  assert.match(divergentHtml, /Staged state differs · 1/);
  assert.match(divergentHtml, /<code>a\.ts<\/code>/);
});

test('storyless exclusions remain inspectable and acknowledgeable from review status', () => {
  const html = renderPage({
    repo: process.cwd(),
    tour: { version: 1, title: '', summary: '', steps: [], base: 'HEAD' },
    files,
    baseLabel: 'main',
    comments: [],
    storyless: true,
    excludedFiles: [{
      path: 'dist/bundle.js', reason: 'generated-path',
      addedLines: 12, removedLines: 0, changedLines: 12,
    }],
  });
  assert.match(html, /class="ds-trustpill is-clean has-exclusions" data-trust-open/);
  assert.match(html, /<b>1<\/b> excluded file · inspect before approval/);
  assert.match(html, /data-exclusions-ack/);
  assert.match(html, /No story-coverage claim is applied in this view/);
});

test('reviewed-file hash follows code identity instead of story coverage state', () => {
  const covered = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  const uncovered = renderPage({
    repo: process.cwd(),
    tour: { ...tour, steps: [{ ...tour.steps[0], range: [2, 2] }] },
    files,
    baseLabel: 'main',
    comments: [],
  });
  const coveredHash = covered.match(/class="ds-fileitem[^"]*"[^>]*data-review-hash="([^"]+)"/)?.[1];
  const uncoveredHash = uncovered.match(/class="ds-fileitem[^"]*"[^>]*data-review-hash="([^"]+)"/)?.[1];
  assert.ok(coveredHash);
  assert.equal(uncoveredHash, coveredHash);
});

test('file search indexes changed code beyond the old 2400-character cutoff', () => {
  const searchFiles = [{
    ...files[0],
    hunks: [{
      ...files[0].hunks[0],
      lines: [
        { type: 'add', content: 'x'.repeat(2600), newNo: 1 },
        { type: 'add', content: 'late_search_marker', newNo: 2 },
      ],
    }],
  }];
  const html = renderPage({ repo: process.cwd(), tour, files: searchFiles, baseLabel: 'main', comments: [] });
  assert.match(html, /data-filter-code="[^"]*late_search_marker/);
});

test('review focus translates internal tags and heuristics into one human instruction', () => {
  const cueTour = {
    ...tour,
    steps: [{
      ...tour.steps[0],
      tags: ['entrypoint', 'caller-identity'],
      why: 'Authorization is checked before transaction state changes.',
    }],
  };
  const html = renderPage({ repo: process.cwd(), tour: cueTour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /Review focus/);
  assert.match(html, /Check the flow's entry point, the caller identity seen at the next boundary, permission and trust boundaries, and the state that can change\./);
  assert.doesNotMatch(html, /<h3>Review focus<\/h3>|Authored story tag|Suggested from this step|ds-reviewcue|ds-railcue|ds-reviewmap/);
});

test('story tuning is a named control with clear outcomes instead of an ellipsis', () => {
  const html = renderPage({ repo: process.cwd(), tour, files, baseLabel: 'main', comments: [] });
  assert.match(html, /<summary aria-label="Tune explanation">/);
  assert.match(html, />Tune&nbsp;<span class="ds-story-tune-long">explanation<\/span>/);
  assert.match(html, /<strong>Make shorter<\/strong><small>Condense this explanation without changing its meaning\.<\/small>/);
  assert.match(html, /<strong>Split into two steps<\/strong><small>Break a dense explanation into two focused review stops\.<\/small>/);
  assert.doesNotMatch(html, /Tune this story step|>•••<\/summary>/);
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

test('unverified stories block approval and explain how to recover trust', () => {
  const html = renderPage({
    repo: process.cwd(),
    tour,
    files,
    baseLabel: 'main',
    comments: [],
    routeBase: '/repo/demo',
    storyFreshness: 'unverified',
  });
  assert.match(html, /Unverified<\/b> story · regenerate before approval/);
  assert.match(html, /This older story has no exact diff fingerprint/);
  assert.match(html, /data-verdict="approve" disabled/);
  assert.match(html, /Regenerate story/);
});

test('live review banner is stable, polite, dismissible, and does not move document flow', () => {
  const html = renderPage({
    repo: process.cwd(), tour, files, baseLabel: 'main', comments: [], reviewPageToken: 'lease-token',
  });
  assert.match(html, /class="ds-live-banner" data-live-banner role="status" aria-live="polite" aria-atomic="true" aria-label="Live review status" hidden/);
  assert.match(html, /data-live-reload>Reload</);
  assert.match(html, /data-live-dismiss aria-label="Dismiss live review status"/);
  assert.ok(html.indexOf('data-live-banner') < html.indexOf('class="ds-layout"'));
});
