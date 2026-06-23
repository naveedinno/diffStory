import { APP_BRAND } from './config.js';
import type { StorySummary } from './stories.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function relTime(then: number, now: number): string {
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? 'yesterday' : `${day} days ago`;
}

function storyRow(s: StorySummary, now: number): string {
  const href = `/review?story=${encodeURIComponent(s.id)}`;
  const mode = s.mode === 'detailed' ? 'Detailed audit' : 'Guided review';
  const meta = [
    mode,
    esc(s.id),
    s.scope.command ? esc(s.scope.command) : '',
    relTime(s.updatedAt, now),
  ].filter(Boolean);
  return (
    `<a class="story${s.valid ? '' : ' bad'}" href="${href}">` +
    `<span class="story-main">` +
    `<span class="story-title">${esc(s.title || s.id)}</span>` +
    `<span class="story-summary">${esc(s.valid ? s.summary || 'No summary.' : s.error || 'Invalid story.')}</span>` +
    `<span class="story-scope"><b>${esc(s.scope.label)}</b><span>${esc(s.scope.description)}</span></span>` +
    `<span class="story-meta">${meta.join(' · ')}</span>` +
    `</span>` +
    `<span class="story-status">${s.valid ? 'Open' : 'Fix'}</span>` +
    `</a>`
  );
}

export function renderStoryPicker(opts: { repoName: string; stories: StorySummary[]; now: number }): string {
  const stories = opts.stories.length
    ? opts.stories.map((s) => storyRow(s, opts.now)).join('')
    : `<div class="empty">No saved stories yet.</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(APP_BRAND)} — stories</title>
<style>
:root{--bg:#f5f5f7;--elev:#fff;--label:#1d1d1f;--l2:#6e6e73;--l3:#8e8e93;--hair:rgba(0,0,0,.1);--sep:rgba(0,0,0,.08);--blue:#007aff;--blue2:#0067d6;--red-bg:#fde8e7;--red:#c4271f;--fill:rgba(120,120,128,.12)}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1e;--elev:#2c2c2e;--label:#f5f5f7;--l2:#aeaeb2;--l3:#8e8e93;--hair:rgba(255,255,255,.12);--sep:rgba(255,255,255,.1);--blue:#0a84ff;--blue2:#3395ff;--red-bg:rgba(255,69,58,.18);--red:#ff6961;--fill:rgba(120,120,128,.24)}}
*{box-sizing:border-box}html,body{margin:0}body{background:var(--bg);color:var(--label);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.wrap{max-width:720px;margin:0 auto;padding:52px 24px 72px}
.top{display:flex;align-items:flex-start;gap:14px;justify-content:space-between;margin-bottom:20px}
h1{font-size:26px;font-weight:700;letter-spacing:-.02em;margin:0}
.sub{color:var(--l2);font-size:14px;margin:9px 0 0;line-height:1.45}
.new{flex:none;height:38px;display:inline-flex;align-items:center;padding:0 17px;border-radius:10px;background:var(--blue);color:#fff;text-decoration:none;font-size:14px;font-weight:650;box-shadow:0 1px 2px rgba(0,40,120,.18)}
.new:hover{background:var(--blue2)}
.card{background:var(--elev);border:.5px solid var(--hair);border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden}
.story{display:flex;align-items:center;gap:14px;padding:14px 15px;border-bottom:.5px solid var(--sep);color:inherit;text-decoration:none}
.story:last-child{border-bottom:none}.story:hover{background:var(--fill)}
.story-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.story-title{font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.story-summary{font-size:13px;color:var(--l2);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.story-scope{display:flex;gap:8px;align-items:baseline;color:var(--label);font-size:12.5px;line-height:1.35;min-width:0}
.story-scope b{font-weight:650;white-space:nowrap}.story-scope span{color:var(--l2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.story-meta{font:11.5px/1.4 "SF Mono",ui-monospace,Menlo,monospace;color:var(--l3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.story-status{flex:none;font-size:12px;font-weight:650;color:var(--blue);padding:4px 9px;border-radius:999px;background:color-mix(in srgb,var(--blue) 12%,transparent)}
.story.bad{background:var(--red-bg)}.story.bad .story-status,.story.bad .story-summary{color:var(--red)}
.empty{padding:34px 16px;text-align:center;color:var(--l2);font-size:14px}
.foot{margin-top:14px;color:var(--l3);font-size:12.5px;line-height:1.45}
@media (max-width:560px){.top{flex-direction:column}.new{width:100%;justify-content:center}.story{align-items:flex-start}.story-status{margin-top:1px}}
</style></head>
<body><main class="wrap">
  <div class="top">
    <div>
      <h1>Choose a story</h1>
      <p class="sub">${esc(opts.repoName)} can have more than one saved review story. Open one, or start a new story from the current diff.</p>
    </div>
    <a class="new" href="/change">New story</a>
  </div>
  <div class="card">${stories}</div>
  <p class="foot">Stories live in <code>.diffstory/story.json</code> or <code>.diffstory/stories/*.json</code>.</p>
</main></body></html>`;
}
