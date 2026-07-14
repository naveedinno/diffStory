import { writeFile } from 'node:fs/promises';
import { renderDiffStoryWebview } from '../dist/webview.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), values[index + 1]]);
  return pairs;
}, []));
const state = args.state ?? 'welcome';
const theme = args.theme === 'light' ? 'light' : 'dark';
const out = args.out ?? `/private/tmp/diffstory-${state}-${theme}.html`;

const files = [
  { path: 'vscode-extension/src/extension.ts', status: 'M' },
  { path: 'vscode-extension/src/webview.ts', status: 'A' },
  { path: 'vscode-extension/src/review-state.ts', status: 'M' },
  { path: 'vscode-extension/test/webview.test.mjs', status: 'A' },
  { path: 'vscode-extension/package.json', status: 'M' },
  { path: 'src/story-picker.ts', status: 'M' },
  { path: 'src/render.ts', status: 'M' },
  { path: 'README.md', status: 'M' },
  { path: 'docs/review-workflow.md', status: 'A' },
  { path: 'src/very/long/path/that/must/not/break/the/sidebar/review-controller.ts', status: 'R100' },
  { path: 'src/legacy-panel.ts', status: 'D' },
  { path: 'notes/local-draft.md', status: '?' },
];
const story = {
  title: 'How the new review session fits together',
  summary: 'Start with the file queue, follow the controller into native diffs, then see how selected-code feedback returns for verification.',
  intent: { goal: 'Make DiffStory understandable on first open.', design: 'One adaptive surface separates changes, explanation, and feedback.' },
  steps: [
    { id: 'one', order: 1, title: 'The manifest exposes one focused review surface', file: 'vscode-extension/package.json', range: [104, 150], kind: 'context', why: 'This removes the competing stacked panels.' },
    { id: 'two', order: 2, title: 'The renderer turns state into a clear next action', file: 'vscode-extension/src/webview.ts', range: [25, 140], kind: 'implementation', why: 'Every state now tells the reviewer what to do.' },
  ],
};
const base = {
  nonce: 'preview',
  repo: { name: 'SmartDiffChecker', path: '/Users/naveed/Codes/blockchain/symmio/SmartDiffChecker' },
  scopeLabel: 'HEAD → working tree',
  files,
  seenFiles: [],
  comments: [],
  review: { round: 1, changedSinceReview: 0, changedFiles: [], seenFiles: [], events: [{ id: 'start', at: new Date().toISOString(), round: 1, kind: 'review-started', label: 'Review started' }] },
  story,
  guideStatus: { state: 'current', activeScopeLabel: 'HEAD → working tree', canSwitchScope: false },
  storyId: 'story.json',
  stories: [{ id: 'story.json', title: story.title, valid: true, story }],
  progress: [],
  agentRunning: false,
  agents: ['codex'],
  showWelcome: true,
  initialMode: 'changes',
};
const comments = [
  { id: 'verify-1', file: 'vscode-extension/src/webview.ts', line: 118, type: 'change', body: 'Make the changed file queue visible without another picker.', status: 'addressed', createdAt: new Date().toISOString(), reply: 'The file queue now lives directly in Changes with To review, All, and Commented filters.', selectedText: 'function renderFileList(model) {' },
  { id: 'open-1', file: 'vscode-extension/src/extension.ts', line: 151, type: 'question', body: 'Does a saved guide still change the Git comparison?', status: 'open', createdAt: new Date().toISOString() },
  { id: 'done-1', file: 'vscode-extension/package.json', line: 128, type: 'nit', body: 'Use one contributed view.', status: 'resolved', createdAt: new Date().toISOString(), reply: 'Removed the second stacked view.' },
];

const models = {
  welcome: base,
  progress: { ...base, showWelcome: false, seenFiles: files.slice(0, 4).map((file) => file.path), comments: comments.slice(1, 2) },
  guide: { ...base, showWelcome: false, seenFiles: files.slice(0, 3).map((file) => file.path), cursor: { storyId: 'story.json', stepId: 'one', at: new Date().toISOString() }, initialMode: 'guide' },
  feedback: { ...base, showWelcome: false, seenFiles: files.slice(0, 6).map((file) => file.path), comments, review: { ...base.review, round: 2, changedSinceReview: 3, changedFiles: files.slice(0, 3).map((file) => file.path) }, initialMode: 'feedback' },
  empty: { ...base, files: [], story: undefined, stories: [] },
};
const model = models[state];
if (!model) throw new Error(`Unknown preview state: ${state}`);

const palette = theme === 'light'
  ? `--vscode-sideBar-background:#f7f8fa;--vscode-editor-background:#fff;--vscode-sideBarSectionHeader-background:#eceff3;--vscode-sideBar-border:#d7dce3;--vscode-foreground:#20242b;--vscode-descriptionForeground:#68717d;--vscode-button-background:#276aa8;--vscode-button-hoverBackground:#327ab9;--vscode-button-foreground:#fff;--vscode-button-secondaryBackground:#e5e9ef;--vscode-button-secondaryForeground:#222831;--vscode-button-secondaryHoverBackground:#d9dee6;--vscode-focusBorder:#1676c2;--vscode-charts-blue:#1676c2;--vscode-charts-orange:#c95735;--vscode-charts-green:#21855c;--vscode-charts-purple:#7056c7;--vscode-charts-yellow:#a26b00;--vscode-errorForeground:#ba3344;--vscode-gitDecoration-addedResourceForeground:#21855c;--vscode-gitDecoration-deletedResourceForeground:#ba3344;--vscode-gitDecoration-modifiedResourceForeground:#a26b00;--vscode-gitDecoration-renamedResourceForeground:#1676c2;--vscode-gitDecoration-untrackedResourceForeground:#21855c;--vscode-font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;--vscode-editor-font-family:'SFMono-Regular',Consolas,monospace;`
  : `--vscode-sideBar-background:#181b22;--vscode-editor-background:#20242c;--vscode-sideBarSectionHeader-background:#252a34;--vscode-sideBar-border:#343a46;--vscode-foreground:#f3f5f7;--vscode-descriptionForeground:#9ba6b2;--vscode-button-background:#2777c8;--vscode-button-hoverBackground:#3489da;--vscode-button-foreground:#fff;--vscode-button-secondaryBackground:#343a46;--vscode-button-secondaryForeground:#f3f5f7;--vscode-button-secondaryHoverBackground:#414957;--vscode-focusBorder:#56b6e9;--vscode-charts-blue:#56b6e9;--vscode-charts-orange:#ff8a65;--vscode-charts-green:#67d391;--vscode-charts-purple:#a78bfa;--vscode-charts-yellow:#f5c451;--vscode-errorForeground:#ff6b7a;--vscode-gitDecoration-addedResourceForeground:#67d391;--vscode-gitDecoration-deletedResourceForeground:#ff6b7a;--vscode-gitDecoration-modifiedResourceForeground:#f5c451;--vscode-gitDecoration-renamedResourceForeground:#56b6e9;--vscode-gitDecoration-untrackedResourceForeground:#67d391;--vscode-font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;--vscode-editor-font-family:'SFMono-Regular',Consolas,monospace;`;

let html = renderDiffStoryWebview(model);
html = html
  .replace('<body>', `<body class="vscode-${theme}">`)
  .replace('</head>', `<style nonce="preview">:root{${palette}}</style><script nonce="preview">window.acquireVsCodeApi=()=>({postMessage:()=>{},getState:()=>undefined,setState:()=>{}});</script></head>`);
await writeFile(out, html, 'utf8');
console.log(out);
