// The "Your change" screen — the app's honest front door. Pure git, NO agent runs
// here. Shows the current change + a scope switcher, and a single "Generate guided
// review" button that streams POST /api/generate into a small cancelable console and
// navigates into the review on success. Self-contained; all server values escaped.
import { APP_BRAND } from './config.js';
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function count(n, sign) {
    return n == null ? '' : `<span class="${sign === '+' ? 'add' : 'del'}">${sign}${n}</span>`;
}
export function renderChangePage(sum, opts) {
    const label = opts.scopeLabel ?? sum.baseLabel;
    const active = opts.active ?? '';
    const notice = opts.notice
        ? `<div class="notice"><b>That review couldn't be loaded.</b> ${esc(opts.notice)} Generate a fresh one below.</div>`
        : '';
    const rows = sum.files
        .map((f) => `<div class="frow"><span class="fp" title="${esc(f.path)}">${esc(f.path)}</span>` +
        `<span class="fc">${count(f.added, '+')} ${count(f.removed, '−')}</span></div>`)
        .join('');
    const action = sum.hasChanges
        ? `<div class="genctl">
         <label class="genfield">Agent <select id="agentSel" aria-label="Agent"></select></label>
         <label class="genfield">Model <select id="modelSel" aria-label="Model"></select></label>
         <input id="modelInp" class="modelother" type="text" placeholder="model name" autocomplete="off" spellcheck="false" aria-label="Custom model" hidden />
         <label class="genfield">Story <select id="storyMode" aria-label="Story mode"><option value="guided" selected>Guided review</option><option value="detailed">Detailed audit</option></select></label>
       </div>
       <p class="skillwarn" id="skillWarn" hidden><span id="skillWarnText"></span><button class="skillfix" id="skillUpdateBtn" type="button">Update skills</button></p>
       <button class="gen" id="genBtn" type="button" data-base="${esc(opts.base ?? '')}" data-head="${esc(opts.head ?? '')}">Generate guided review</button>
       <p class="gennote">Guided is the fast review path. Detailed audit is longer and walks code paths line by line. Nothing starts until you click.</p>`
        : `<div class="empty">Nothing to review for <b>${esc(label)}</b>. Pick another scope above, or make a change.</div>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(APP_BRAND)} — your change</title>
<style>
:root{--bg:#f5f5f7;--elev:#fff;--label:#1d1d1f;--l2:#6e6e73;--l3:#8e8e93;--hair:rgba(0,0,0,.1);--sep:rgba(0,0,0,.08);
  --blue:#007aff;--blue2:#0067d6;--add:#1d7d3f;--del:#c4271f;--fill:rgba(120,120,128,.12);--con:#1e1e21;--cont:#e8e8ec;--conl:rgba(255,255,255,.1)}
@media (prefers-color-scheme:dark){:root{--bg:#1c1c1e;--elev:#2c2c2e;--label:#f5f5f7;--l2:#aeaeb2;--l3:#8e8e93;--hair:rgba(255,255,255,.12);
  --sep:rgba(255,255,255,.1);--blue:#0a84ff;--blue2:#3395ff;--add:#30d158;--del:#ff6961;--fill:rgba(120,120,128,.24)}}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--label);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-.01em}
.wrap{max-width:680px;margin:0 auto;padding:52px 24px 72px}
h1{font-size:26px;font-weight:700;letter-spacing:-.02em;margin:0}
.what{color:var(--l2);font-size:15px;margin:10px 0 28px;line-height:1.45}
.card{background:var(--elev);border:.5px solid var(--hair);border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);overflow:hidden}
.scope{display:flex;flex-direction:column;gap:10px;padding:13px 15px;border-bottom:.5px solid var(--sep);font-size:13px;color:var(--l2)}
.scur b{color:var(--label);font-weight:600}
.sopts{display:inline-flex;gap:2px;align-self:flex-start;background:var(--fill);border-radius:9px;padding:2px;max-width:100%;flex-wrap:wrap}
.sopt{font:inherit;font-size:12.5px;color:var(--l2);background:none;border:none;cursor:pointer;padding:5px 11px;border-radius:7px;text-decoration:none;white-space:nowrap}
.sopt:hover{color:var(--label)}
.sopt.on{background:var(--elev);color:var(--label);font-weight:590;box-shadow:0 1px 2px rgba(0,0,0,.14)}
.cmppanel{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:4px 15px 15px}
.cmppanel[hidden]{display:none}
.cmprow{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--l2)}
.cmppanel select{appearance:none;-webkit-appearance:none;font:inherit;font-size:13px;color:var(--label);background-color:var(--elev);border:.5px solid var(--hair);border-radius:8px;height:32px;padding:0 30px 0 11px;min-width:172px;max-width:232px;cursor:pointer;background-repeat:no-repeat;background-position:right 10px center;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")}
.cmppanel select:hover{border-color:var(--l3)}
.cmppanel select:focus{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 30%,transparent)}
.cmparrow{color:var(--l3);display:inline-flex}
.cmpgo{font:inherit;font-size:13px;font-weight:600;color:#fff;background:var(--blue);border:none;border-radius:8px;height:32px;padding:0 16px;cursor:pointer}
.cmpgo:hover{background:var(--blue2)}
.files{max-height:46vh;overflow:auto}
.frow{display:flex;align-items:center;gap:10px;padding:9px 15px;border-bottom:.5px solid var(--sep);font-size:13px}
.frow:last-child{border-bottom:none}
.fp{flex:1;min-width:0;font-family:"SF Mono",ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fc{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12px;flex:none}
.add{color:var(--add)}.del{color:var(--del);margin-left:5px}
.gen{margin-top:14px;height:42px;padding:0 20px;font:inherit;font-size:15px;font-weight:600;color:#fff;background:var(--blue);border:none;border-radius:11px;cursor:pointer;box-shadow:0 1px 2px rgba(0,40,120,.18);letter-spacing:-.01em}
.gen:hover{background:var(--blue2)}.gen:active{transform:scale(.99)}.gen:disabled{opacity:.5;cursor:default}
.gennote{color:var(--l3);font-size:12.5px;margin:9px 2px 0;line-height:1.4}
.notice{background:rgba(255,159,10,.13);border:.5px solid rgba(255,159,10,.42);color:var(--label);border-radius:12px;padding:12px 15px;margin-bottom:16px;font-size:13.5px;line-height:1.5}
.notice b{font-weight:600}
.genctl{display:flex;flex-wrap:wrap;gap:14px;margin-top:24px}
.skillwarn{max-width:620px;margin:13px 2px 0;padding:10px 12px;border:.5px solid rgba(255,159,10,.42);border-radius:10px;background:rgba(255,159,10,.13);color:var(--label);font-size:12.5px;line-height:1.45;display:flex;align-items:center;gap:10px}
.skillwarn[hidden]{display:none}
.skillwarn span{flex:1;min-width:0}
.skillfix{flex:none;font:inherit;font-size:12px;font-weight:650;color:#fff;background:var(--blue);border:none;border-radius:8px;padding:6px 10px;cursor:pointer}
.skillfix:hover{background:var(--blue2)}.skillfix:disabled{opacity:.55;cursor:default}
.genfield{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--l2)}
.genfield select,.genfield input{font:inherit;font-size:13px;color:var(--label);background-color:var(--elev);border:.5px solid var(--hair);border-radius:8px;height:32px;padding:0 11px}
.genfield select{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:30px;background-repeat:no-repeat;background-position:right 10px center;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")}
.genfield input{min-width:130px}
.genfield select:focus,.genfield input:focus{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 30%,transparent)}
.modelother{font:inherit;font-size:13px;color:var(--label);background-color:var(--elev);border:.5px solid var(--hair);border-radius:8px;height:32px;padding:0 11px;min-width:140px}
.modelother:focus{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--blue) 30%,transparent)}
.modelother[hidden]{display:none}
.empty{padding:30px 16px;text-align:center;color:var(--l2);font-size:14px}
.gencon{margin-top:20px;background:var(--con);border:.5px solid var(--conl);border-radius:12px;overflow:hidden}
.genhd{display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:.5px solid var(--conl);font-size:12.5px;font-weight:600;color:var(--cont)}
.genspin{width:13px;height:13px;border-radius:50%;border:2px solid var(--conl);border-top-color:var(--blue);animation:gs .7s linear infinite;flex:none}
@keyframes gs{to{transform:rotate(360deg)}}
.genstop{margin-left:auto;font:inherit;font-size:12px;font-weight:550;color:var(--cont);background:transparent;border:.5px solid var(--conl);border-radius:7px;padding:5px 11px;cursor:pointer}
.genbody{margin:0;padding:11px 13px;max-height:34vh;overflow:auto;font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#9a9aa3;white-space:pre-wrap;word-break:break-word}
</style></head>
<body>
<main class="wrap">
  <h1>${esc(APP_BRAND)}</h1>
  <p class="what">The agent that wrote your change walks you through it — in the order the code actually flows, not by filename.</p>
  ${notice}
  <div class="card">
    <div class="scope">
      <span class="scur">Reviewing <b>${esc(label)}</b></span>
      <div class="sopts" role="group" aria-label="Review scope">
        <a class="sopt${active === 'uncommitted' ? ' on' : ''}" href="/change?scope=uncommitted">Uncommitted</a>
        <a class="sopt${active === 'last' ? ' on' : ''}" href="/change?scope=last">Latest commit</a>
        <a class="sopt${active === 'branch' ? ' on' : ''}" href="/change?scope=branch">Whole branch</a>
        <button class="sopt${active === 'ref' ? ' on' : ''}" id="cmpBtn" type="button">Compare…</button>
      </div>
    </div>
    <div class="cmppanel" id="cmppanel" hidden>
      <label class="cmprow">Base <select id="cmpBase"></select></label>
      <span class="cmparrow" aria-hidden="true">→</span>
      <label class="cmprow">Head <select id="cmpHead"></select></label>
      <button class="cmpgo" id="cmpGo" type="button">Compare</button>
    </div>
    ${sum.hasChanges ? `<div class="files">${rows}</div>` : ''}
  </div>
  ${action}
  <div class="gencon" id="gencon" hidden>
    <div class="genhd"><span class="genspin"></span><span id="genTitle">Writing your guided review…</span><button class="genstop" id="genstop" type="button">Stop</button></div>
    <pre class="genbody" id="genbody"></pre>
  </div>
</main>
<script>
(function(){
  var cmp=document.getElementById('cmpBtn'),panel=document.getElementById('cmppanel'),
      baseSel=document.getElementById('cmpBase'),headSel=document.getElementById('cmpHead'),loaded=false;
  function group(sel,lbl){var g=document.createElement('optgroup');g.label=lbl;sel.appendChild(g);return g;}
  function fillRefs(d){
    baseSel.add(new Option('Choose a base…',''));
    headSel.add(new Option('Working tree (uncommitted)',''));
    headSel.add(new Option('Latest commit (HEAD)','HEAD'));
    var bb=group(baseSel,'Branches'),hb=group(headSel,'Branches');
    (d.branches||[]).forEach(function(b){bb.appendChild(new Option(b,b));hb.appendChild(new Option(b,b));});
    var bc=group(baseSel,'Recent commits'),hc=group(headSel,'Recent commits');
    (d.commits||[]).forEach(function(c){var t=c.sha+(c.subject?(' — '+c.subject):'');bc.appendChild(new Option(t,c.sha));hc.appendChild(new Option(t,c.sha));});
  }
  if(cmp)cmp.addEventListener('click',function(){
    if(!panel.hidden){panel.hidden=true;return;}
    panel.hidden=false;
    if(loaded)return;loaded=true;
    fetch('/api/refs').then(function(r){return r.json();}).then(fillRefs).catch(function(){loaded=false;});
  });
  var go=document.getElementById('cmpGo');
  if(go)go.addEventListener('click',function(){
    var b=baseSel.value,h=headSel.value;if(!b)return;
    var u='/change?base='+encodeURIComponent(b);if(h)u+='&head='+encodeURIComponent(h);location.href=u;
  });
  var agentSel=document.getElementById('agentSel'),modelSel=document.getElementById('modelSel'),modelInp=document.getElementById('modelInp'),modeSel=document.getElementById('storyMode');
  var MODELS={claude:[['Default (Sonnet)',''],['Opus','opus'],['Haiku','haiku'],['Other…','__other__']],codex:[['Default',''],['Other…','__other__']]};
  function syncOther(){if(modelInp&&modelSel)modelInp.hidden=(modelSel.value!=='__other__');}
  function fillModels(){
    if(!modelSel)return;
    while(modelSel.options.length)modelSel.remove(0);
    var ms=MODELS[agentSel?agentSel.value:'']||[['Default','']];
    ms.forEach(function(m){modelSel.add(new Option(m[0],m[1]));});
    syncOther();
  }
  if(modelSel)modelSel.addEventListener('change',syncOther);
  function showSkillState(sk){
    var sw=document.getElementById('skillWarn'),txt=document.getElementById('skillWarnText'),btn=document.getElementById('skillUpdateBtn');
    if(!sw||!txt||!btn||!sk)return;
    if(sk.current){
      sw.hidden=false;txt.textContent='Story-generation skills are up to date.';btn.hidden=true;
      setTimeout(function(){sw.hidden=true;},1400);return;
    }
    sw.hidden=false;btn.hidden=false;btn.disabled=false;btn.textContent='Update skills';
    txt.textContent=sk.installed
      ? 'Story-generation skill is installed but does not match this app. Update it before generating so the agent sees the current story rules.'
      : 'Story-generation skill was not found in ~/.agents, ~/.claude, or ~/.codex. Install it before generating so the agent can create the story reliably.';
  }
  function wireSkillUpdate(){
    var btn=document.getElementById('skillUpdateBtn'),txt=document.getElementById('skillWarnText');if(!btn)return;
    btn.onclick=function(){
      btn.disabled=true;btn.textContent='Updating…';if(txt)txt.textContent='Installing bundled diffStory skills locally…';
      fetch('/api/skills/update',{method:'POST'}).then(function(r){return r.json();}).then(function(d){
        if(d&&d.skills)showSkillState(d.skills);else throw new Error('bad response');
      }).catch(function(){btn.disabled=false;btn.textContent='Try again';if(txt)txt.textContent='Could not update skills. Run scripts/install-skills.sh from this repo, or re-run the diffStory installer.';});
    };
  }
  wireSkillUpdate();
  if(agentSel){
    fetch('/api/agents').then(function(r){return r.json();}).then(function(d){
      (d.agents||[]).forEach(function(a){agentSel.add(new Option(a,a));});
      if(!agentSel.options.length)agentSel.add(new Option('no agent found',''));
      showSkillState(d.skills);
      fillModels();
    }).catch(function(){});
    agentSel.addEventListener('change',fillModels);
  }
  var gen=document.getElementById('genBtn');
  if(!gen)return;
  gen.addEventListener('click',function(){
    gen.disabled=true;
    var con=document.getElementById('gencon');con.hidden=false;
    var body=document.getElementById('genbody');body.textContent='Warming up — your agent is reading the change…';
    var stop=document.getElementById('genstop');
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    stop.onclick=function(){if(ctrl)ctrl.abort();};
    var hint=true,NL=String.fromCharCode(10);
    var agent=agentSel?agentSel.value:'';
    var msel=modelSel?modelSel.value:'';
    var model=(msel==='__other__')?(modelInp?modelInp.value.trim():''):msel;
    var modeLabel=modeSel&&modeSel.value==='detailed'?'detailed audit':'guided review';
    var ttl=document.getElementById('genTitle');
    if(ttl)ttl.textContent='Writing your '+modeLabel+' with '+(agent||'your agent')+(model?(' ('+model+')'):'')+'…';
    var payload={base:gen.getAttribute('data-base')||undefined,head:gen.getAttribute('data-head')||undefined,agent:agent||undefined,model:model||undefined,mode:modeSel?modeSel.value:undefined};
    fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl?ctrl.signal:undefined})
      .then(function(r){
        if(!r.ok||!r.body){return r.json().then(function(j){body.textContent=(j&&j.error)||'Could not start.';},function(){body.textContent='Could not start.';});}
        var rd=r.body.getReader(),dec=new TextDecoder(),buf='';
        function clr(){if(hint){hint=false;body.textContent='';}}
        function pump(){return rd.read().then(function(res){
          if(res.done)return;
          buf+=dec.decode(res.value,{stream:true});var parts=buf.split(NL);buf=parts.pop();
          for(var i=0;i<parts.length;i++){var ln=parts[i];if(!ln.trim())continue;var ev;try{ev=JSON.parse(ln);}catch(e){continue;}
            if(ev.type==='text'){clr();body.textContent+=ev.data||'';}
            else if(ev.type==='tool'){clr();body.textContent+=NL+(ev.data||'')+NL;}
            else if(ev.type==='error'){clr();body.textContent+=NL+(ev.data||'');}
            else if(ev.type==='done'){if(ev.storyWritten){location.href='/review?story=story.json';return;}}
            body.scrollTop=body.scrollHeight;}
          return pump();
        });}
        return pump();
      })
      .then(function(){ var sp=document.querySelector('.genspin'); if(sp)sp.style.display='none'; gen.disabled=false; })
      .catch(function(){
        var sp=document.querySelector('.genspin');if(sp)sp.style.display='none';
        if(ctrl&&ctrl.signal.aborted)body.textContent+=NL+'Stopped.';else body.textContent+=NL+'Something went wrong.';
        gen.disabled=false;
      });
  });
})();
</script>
</body></html>`;
}
