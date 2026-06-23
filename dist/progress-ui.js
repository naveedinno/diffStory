// One shared live-progress panel for every agent run, embedded by both the change
// screen (inline variant) and the review screen (floating variant). Exports three
// string builders: self-contained CSS, an HTML fragment, and a browser script that
// defines a global `ProgressPanel`. The panel renders the app-owned progress events
// from src/progress.ts: workflow title, agent/model, repo+scope, current phase,
// elapsed/liveness, a timeline of meaningful events, and raw agent text (secondary).
/** Self-contained styles (own CSS custom properties so it looks identical on both screens). */
export function progressPanelStyles() {
    return `
.ds-pp{--pp-bg:#1c1c1e;--pp-elev:#2c2c2e;--pp-text:#f2f2f7;--pp-muted:#9a9aa3;--pp-faint:#6e6e73;
  --pp-line:rgba(255,255,255,.12);--pp-blue:#0a84ff;--pp-warn:#ff9f0a;--pp-err:#ff6961;--pp-ok:#30d158;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:var(--pp-text);
  background:var(--pp-bg);border:.5px solid var(--pp-line);border-radius:14px;overflow:hidden;letter-spacing:-.01em}
@media (prefers-color-scheme:dark){.ds-pp{--pp-bg:#1c1c1e;--pp-elev:#2c2c2e}}
@media (prefers-color-scheme:light){.ds-pp{--pp-bg:#1e1e21;--pp-elev:#2a2a2e;--pp-text:#f2f2f7;--pp-muted:#a6a6ad;--pp-faint:#8a8a90;--pp-line:rgba(255,255,255,.12)}}
.ds-pp[data-variant="floating"]{position:fixed;right:18px;bottom:18px;width:min(460px,calc(100vw - 36px));max-height:min(70vh,560px);display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.5);z-index:50}
.ds-pp[data-variant="inline"]{margin-top:20px;display:flex;flex-direction:column;max-height:min(64vh,560px)}
/* The variant rules set display:flex, which beats the [hidden] UA rule — re-assert hidden with higher specificity. */
.ds-pp[data-variant][hidden]{display:none}
.ds-pp-head{display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:.5px solid var(--pp-line)}
.ds-pp-spin{width:13px;height:13px;border-radius:50%;border:2px solid var(--pp-line);border-top-color:var(--pp-blue);animation:ds-pp-spin .7s linear infinite;flex:none}
.ds-pp-spin[hidden]{display:none}
@keyframes ds-pp-spin{to{transform:rotate(360deg)}}
.ds-pp-title{font-size:13px;font-weight:650}
.ds-pp-agent{font-size:11.5px;color:var(--pp-muted);background:var(--pp-elev);border:.5px solid var(--pp-line);border-radius:6px;padding:2px 7px}
.ds-pp-agent:empty{display:none}
.ds-pp-flex{flex:1}
.ds-pp-stop,.ds-pp-close{font:inherit;font-size:12px;font-weight:550;color:var(--pp-text);background:transparent;border:.5px solid var(--pp-line);border-radius:7px;padding:5px 11px;cursor:pointer}
.ds-pp-stop[hidden],.ds-pp-close[hidden]{display:none}
.ds-pp-sub{padding:7px 13px 0}
.ds-pp-repo{font-size:11.5px;color:var(--pp-muted);font-family:"SF Mono",ui-monospace,Menlo,monospace}
.ds-pp-repo:empty{display:none}
.ds-pp-phase{display:flex;align-items:center;gap:8px;padding:9px 13px}
.ds-pp-phase-dot{width:7px;height:7px;border-radius:50%;background:var(--pp-blue);flex:none}
.ds-pp-phase-label{font-size:12.5px;font-weight:600}
.ds-pp-meta{margin-left:auto;font-size:11px;color:var(--pp-faint);font-variant-numeric:tabular-nums}
.ds-pp-timeline{list-style:none;margin:0;padding:2px 13px 8px;overflow:auto;flex:1;min-height:48px}
.ds-pp-ev{display:flex;gap:8px;align-items:baseline;padding:3px 0;font-size:11.5px;color:var(--pp-muted);line-height:1.45}
.ds-pp-ic{flex:none;width:13px;text-align:center;color:var(--pp-faint);font-family:"SF Mono",ui-monospace,Menlo,monospace}
.ds-pp-tx{word-break:break-word}
.ds-pp-phase>.ds-pp-ic,.ds-pp-ev.ds-pp-phase .ds-pp-ic{color:var(--pp-blue)}
.ds-pp-ev.ds-pp-phase .ds-pp-tx{color:var(--pp-text);font-weight:560}
.ds-pp-ev.ds-pp-warning .ds-pp-ic,.ds-pp-ev.ds-pp-warning .ds-pp-tx{color:var(--pp-warn)}
.ds-pp-ev.ds-pp-error .ds-pp-ic,.ds-pp-ev.ds-pp-error .ds-pp-tx{color:var(--pp-err)}
.ds-pp-ev.ds-pp-file .ds-pp-tx,.ds-pp-ev.ds-pp-command .ds-pp-tx{font-family:"SF Mono",ui-monospace,Menlo,monospace}
.ds-pp-rawwrap{border-top:.5px solid var(--pp-line)}
.ds-pp-rawhd{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--pp-faint);padding:7px 13px 3px}
.ds-pp-raw{margin:0;padding:0 13px 10px;max-height:120px;overflow:auto;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--pp-faint);white-space:pre-wrap;word-break:break-word}
.ds-pp-rawwrap:has(.ds-pp-raw:empty){display:none}
.ds-pp-foot{padding:10px 13px;border-top:.5px solid var(--pp-line);font-size:12px;color:var(--pp-text);display:flex;align-items:center;gap:9px}
.ds-pp-foot[hidden]{display:none}
.ds-pp-foot .ds-pp-reload{font:inherit;font-size:12px;font-weight:650;color:#fff;background:var(--pp-blue);border:none;border-radius:8px;padding:6px 11px;cursor:pointer}
`;
}
/** The panel markup fragment; `variant` only sets the outer positioning class. */
export function progressPanelMarkup(variant) {
    return `<div class="ds-pp" data-variant="${variant}" hidden aria-live="polite">
  <div class="ds-pp-head">
    <span class="ds-pp-spin" aria-hidden="true" hidden></span>
    <span class="ds-pp-title">Preparing…</span>
    <span class="ds-pp-agent"></span>
    <span class="ds-pp-flex"></span>
    <button class="ds-pp-stop" data-pp-stop hidden>Stop</button>
    <button class="ds-pp-close" data-pp-close hidden>Close</button>
  </div>
  <div class="ds-pp-sub"><span class="ds-pp-repo"></span></div>
  <div class="ds-pp-phase">
    <span class="ds-pp-phase-dot" aria-hidden="true"></span>
    <span class="ds-pp-phase-label">Starting…</span>
    <span class="ds-pp-meta"></span>
  </div>
  <ol class="ds-pp-timeline"></ol>
  <div class="ds-pp-rawwrap"><div class="ds-pp-rawhd">Raw agent output</div><pre class="ds-pp-raw"></pre></div>
  <div class="ds-pp-foot" hidden></div>
</div>`;
}
/** Browser script: defines a global ProgressPanel(root, opts) driven by progress events. */
export function progressPanelScript() {
    return `
function ProgressPanel(root, opts){
  opts = opts || {};
  var NL = String.fromCharCode(10);
  function q(sel){ return root.querySelector(sel); }
  var els = {
    title:q('.ds-pp-title'), agent:q('.ds-pp-agent'), repo:q('.ds-pp-repo'),
    spin:q('.ds-pp-spin'), phaseLabel:q('.ds-pp-phase-label'), meta:q('.ds-pp-meta'),
    timeline:q('.ds-pp-timeline'), raw:q('.ds-pp-raw'), foot:q('.ds-pp-foot'),
    stop:q('[data-pp-stop]'), close:q('[data-pp-close]')
  };
  var ICON={phase:'◆',file:'→',command:'$',activity:'•',tool:'•',warning:'!',error:'✕'};
  var WF={guided_review:'Generating guided review',detailed_audit:'Generating detailed audit',address:'Addressing comments'};
  var t0=0, timer=null;
  function elapsed(){ var s=Math.round((Date.now()-t0)/1000); return s<60?(s+'s'):(Math.floor(s/60)+'m '+(s%60)+'s'); }
  function setMeta(quietMs){
    if(!els.meta)return;
    var q2=(typeof quietMs==='number')?Math.round(quietMs/1000):0;
    els.meta.textContent='Elapsed '+elapsed()+(q2>=8?(' · quiet '+q2+'s'):'');
  }
  function tick(){ setMeta(0); }
  function add(kind,text){
    if(!els.timeline||!text)return;
    var li=document.createElement('li'); li.className='ds-pp-ev ds-pp-'+kind;
    var ic=document.createElement('span'); ic.className='ds-pp-ic'; ic.textContent=ICON[kind]||'•';
    var tx=document.createElement('span'); tx.className='ds-pp-tx'; tx.textContent=text;
    li.appendChild(ic); li.appendChild(tx); els.timeline.appendChild(li);
    els.timeline.scrollTop=els.timeline.scrollHeight;
  }
  function appendRaw(s){ if(!els.raw||!s)return; els.raw.textContent+=s; els.raw.scrollTop=els.raw.scrollHeight; }
  function agentChip(agent,model){ var a=agent?(agent.charAt(0).toUpperCase()+agent.slice(1)):'Agent'; return model?(a+' · '+model):a; }
  function repoLine(ev){
    var p=ev.repoName||'';
    if(ev.base){ p+=' · '+ev.base+' → '+(ev.head||'working tree'); }
    if(typeof ev.targetCount==='number'){ p+=' · '+ev.targetCount+' '+(ev.targetCount===1?'comment':'comments'); }
    return p;
  }
  function start(){
    root.hidden=false; t0=Date.now();
    if(els.spin)els.spin.hidden=false;
    if(els.stop)els.stop.hidden=false;
    if(els.close)els.close.hidden=true;
    if(els.foot){els.foot.hidden=true; els.foot.textContent='';}
    if(els.timeline)els.timeline.textContent='';
    if(els.raw)els.raw.textContent='';
    if(timer)clearInterval(timer); timer=setInterval(tick,1000); tick();
  }
  function stopTimer(){ if(timer){clearInterval(timer);timer=null;} }
  function handle(ev){
    if(!ev||!ev.type)return;
    switch(ev.type){
      case 'run_started': if(els.title)els.title.textContent=ev.label||WF[ev.workflow]||'Working…'; break;
      case 'context':
        if(els.agent)els.agent.textContent=agentChip(ev.agent,ev.model);
        if(els.repo)els.repo.textContent=repoLine(ev);
        break;
      case 'phase':
        var plbl=ev.label||ev.phase;
        if(els.phaseLabel)els.phaseLabel.textContent=plbl;
        if(ev.phase!=='agent_running') add('phase', ev.detail?(plbl+' — '+ev.detail):plbl);
        break;
      case 'file': add('file', ev.label); break;
      case 'command': add('command', ev.label); break;
      case 'activity': if(ev.kind==='narration'){ appendRaw((ev.label||'')+NL); } else { add('activity', ev.label); } break;
      case 'tool': add('tool', ev.label); break;
      case 'text': appendRaw(ev.data||''); break;
      case 'heartbeat': setMeta(ev.quietMs); break;
      case 'warning': add('warning', ev.label+(ev.detail?(' — '+ev.detail):'')); break;
      case 'error': add('error', ev.label+(ev.detail?(' — '+ev.detail):'')); break;
      case 'run_done': finish(ev.status, ev.result||{}); break;
    }
  }
  function finish(status, result){
    stopTimer();
    if(els.spin)els.spin.hidden=true;
    if(els.stop)els.stop.hidden=true;
    if(els.close)els.close.hidden=false;
    if(els.phaseLabel)els.phaseLabel.textContent=(status==='complete')?'Done':(status==='stopped')?'Stopped':'Failed';
    if(opts.onDone)opts.onDone(status, result||{});
  }
  function blocked(err){
    root.hidden=false; stopTimer();
    if(els.spin)els.spin.hidden=true;
    if(els.stop)els.stop.hidden=true;
    if(els.close)els.close.hidden=false;
    if(els.title)els.title.textContent='Cannot start';
    if(els.phaseLabel)els.phaseLabel.textContent=(err&&err.label)||'Blocked';
    if(els.foot){els.foot.hidden=false; els.foot.textContent=(err&&err.detail)||(err&&err.label)||'Blocked.';}
  }
  if(els.stop)els.stop.addEventListener('click',function(){ if(opts.onStop)opts.onStop(); });
  if(els.close)els.close.addEventListener('click',function(){
    if(opts.onClose)opts.onClose(); else root.hidden=true;
  });
  return { root:root, els:els, start:start, handle:handle, finish:finish, blocked:blocked,
           showFoot:function(node){ if(els.foot){els.foot.hidden=false; els.foot.textContent=''; els.foot.appendChild(node);} } };
}

/** Drive one agent run: POST the payload, stream NDJSON into the panel, stage blocked/stopped/failed. */
function runProgress(panel, url, payload, ctrl){
  var NL=String.fromCharCode(10);
  return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl?ctrl.signal:undefined})
    .then(function(r){
      if(!r.ok||!r.body){
        return r.json().then(function(j){ panel.blocked(j||{label:'Could not start.'}); },
                            function(){ panel.blocked({label:'Could not start.'}); });
      }
      var rd=r.body.getReader(),dec=new TextDecoder(),buf='';
      function pump(){return rd.read().then(function(res){
        if(res.done){ if(buf.trim()){try{panel.handle(JSON.parse(buf));}catch(e){}} return; }
        buf+=dec.decode(res.value,{stream:true});var parts=buf.split(NL);buf=parts.pop();
        for(var i=0;i<parts.length;i++){var ln=parts[i];if(!ln.trim())continue;var ev;try{ev=JSON.parse(ln);}catch(e){continue;}panel.handle(ev);}
        return pump();
      });}
      return pump();
    })
    .catch(function(){
      if(ctrl&&ctrl.signal.aborted)panel.finish('stopped',{});
      else panel.finish('failed',{});
    });
}
`;
}
