// Phase-1 picker page: a dependency-free, self-contained stub that lists recent
// repos and lets you open one by path. Phase 2 replaces this with the real,
// Apple-HIG styled front door. All dynamic text is escaped server-side.
import { APP_BRAND } from './config.js';
function esc(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
export function renderPickerStub(recents) {
    const rows = recents.length
        ? recents
            .map((r) => `<li><button data-open="${esc(r.path)}">${esc(r.name)}</button> ` +
            `<small>${esc(r.path)}${r.hasTour ? ' · has tour' : ' · no tour'}</small></li>`)
            .join('')
        : '<li><em>No recent repos yet.</em></li>';
    return `<!doctype html><html><head><meta charset="utf-8"><title>${APP_BRAND}</title>
<style>body{font:15px/1.6 system-ui;max-width:60ch;margin:60px auto;padding:0 16px}
h1{font-size:20px}ul{list-style:none;padding:0}li{margin:8px 0}button{cursor:pointer}
small{color:#666}input{width:60%}</style></head>
<body>
<h1>${APP_BRAND} — pick a repo</h1>
<p>Open a repo to review (the full picker UI arrives in Phase 2).</p>
<h2>Recent</h2>
<ul id="recent">${rows}</ul>
<h2>Open by path</h2>
<input id="path" placeholder="/absolute/path/to/repo" />
<button id="openBtn">Open</button>
<p id="msg"></p>
<script>
async function open(path){
  const msg=document.getElementById('msg'); msg.textContent='Opening…';
  const r=await fetch('/api/repo/open',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path})});
  if(r.ok){ location.href='/'; } else { const e=await r.json().catch(()=>({})); msg.textContent=e.error||'Could not open that path.'; }
}
document.getElementById('recent').addEventListener('click',(e)=>{
  const b=e.target.closest('button[data-open]'); if(b) open(b.getAttribute('data-open'));
});
document.getElementById('openBtn').addEventListener('click',()=>open(document.getElementById('path').value.trim()));
</script>
</body></html>`;
}
