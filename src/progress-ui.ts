// One shared live-progress panel for every agent run, embedded by both the change
// screen (inline variant) and the review screen (floating variant). It renders the
// agent's OWN plan (from TodoWrite) as the centerpiece: done items recede, the single
// active item is lit and carries a live "what's happening now" line. A plain-language
// lifecycle label (Preparing → Writing your review → Checking the result → Review ready)
// and honest liveness sit in the header/footer. Raw agent output is captured but only
// surfaced as a Details disclosure on failure. Exports three string builders: CSS, an
// HTML fragment, and a browser script defining a global ProgressPanel + runProgress.

/** Self-contained styles (own CSS custom properties so it looks identical on both screens). */
export function progressPanelStyles(): string {
  return `
.ds-pp{--pp-bg:#1c1c1e;--pp-elev:#2c2c2e;--pp-text:#f2f2f7;--pp-muted:#9a9aa3;--pp-faint:#6e6e73;
  --pp-line:rgba(255,255,255,.12);--pp-blue:#0a84ff;--pp-warn:#ff9f0a;--pp-err:#ff6961;--pp-ok:#30d158;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:var(--pp-text);
  background:var(--pp-bg);border:.5px solid var(--pp-line);border-radius:14px;overflow:hidden;letter-spacing:-.01em}
@media (prefers-color-scheme:dark){.ds-pp{--pp-bg:#1c1c1e;--pp-elev:#2c2c2e}}
@media (prefers-color-scheme:light){.ds-pp{--pp-bg:#1e1e21;--pp-elev:#2a2a2e;--pp-muted:#a6a6ad;--pp-faint:#8a8a90}}
.ds-pp[data-variant="floating"]{position:fixed;right:18px;bottom:18px;width:min(460px,calc(100vw - 36px));max-height:min(72vh,580px);display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.5);z-index:50}
.ds-pp[data-variant="inline"]{margin-top:20px;display:flex;flex-direction:column;max-height:min(66vh,580px)}
.ds-pp[data-variant][hidden]{display:none}
.ds-pp-head{display:flex;align-items:center;gap:9px;padding:12px 14px;border-bottom:.5px solid var(--pp-line)}
.ds-pp-spin{width:13px;height:13px;border-radius:50%;border:2px solid var(--pp-line);border-top-color:var(--pp-blue);animation:ds-pp-spin .7s linear infinite;flex:none}
.ds-pp-spin[hidden]{display:none}
@keyframes ds-pp-spin{to{transform:rotate(360deg)}}
.ds-pp-title{font-size:14px;font-weight:650}
.ds-pp-agent{font-size:11.5px;color:var(--pp-muted);background:var(--pp-elev);border:.5px solid var(--pp-line);border-radius:6px;padding:2px 7px}
.ds-pp-agent:empty{display:none}
.ds-pp-flex{flex:1}
.ds-pp-stop,.ds-pp-close{font:inherit;font-size:12px;font-weight:550;color:var(--pp-text);background:transparent;border:.5px solid var(--pp-line);border-radius:7px;padding:5px 11px;cursor:pointer}
.ds-pp-stop[hidden],.ds-pp-close[hidden]{display:none}
.ds-pp-sub{padding:9px 14px 2px}
.ds-pp-repo{font-size:11.5px;color:var(--pp-muted);font-family:"SF Mono",ui-monospace,Menlo,monospace}
.ds-pp-repo:empty{display:none}
.ds-pp-plan{list-style:none;margin:0;padding:6px 14px 4px;overflow:auto;flex:1;min-height:40px}
.ds-pp-plan:empty{display:none}
.ds-pp-step{display:flex;align-items:flex-start;gap:10px;padding:5px 0}
.ds-pp-mark{flex:none;width:16px;height:16px;border-radius:50%;box-sizing:border-box;margin-top:1px;display:flex;align-items:center;justify-content:center;font-size:11px}
.ds-pp-step.is-done .ds-pp-mark{background:var(--pp-ok);color:#0b2a14}
.ds-pp-step.is-active .ds-pp-mark{border:2px solid var(--pp-blue)}
.ds-pp-step.is-active .ds-pp-mark::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--pp-blue);animation:ds-pp-pulse 1.1s ease-in-out infinite}
.ds-pp-step.is-pending .ds-pp-mark{border:1.5px solid rgba(255,255,255,.22)}
.ds-pp-step-tx{font-size:13px;line-height:1.4}
.ds-pp-step.is-done .ds-pp-step-tx{color:var(--pp-faint)}
.ds-pp-step.is-active .ds-pp-step-tx{color:var(--pp-text);font-weight:560}
.ds-pp-step.is-pending .ds-pp-step-tx{color:var(--pp-muted)}
.ds-pp-step-now{display:block;font-size:11.5px;color:var(--pp-faint);font-family:"SF Mono",ui-monospace,Menlo,monospace;margin-top:2px;word-break:break-word}
.ds-pp-step-now:empty{display:none}
.ds-pp-now{padding:8px 14px;font-size:12.5px;color:var(--pp-muted);font-family:"SF Mono",ui-monospace,Menlo,monospace;word-break:break-word;overflow:auto;flex:1;min-height:24px}
.ds-pp-now[hidden]{display:none}
.ds-pp-live{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:.5px solid var(--pp-line);font-size:11.5px;color:var(--pp-faint);font-variant-numeric:tabular-nums}
.ds-pp-live[hidden]{display:none}
.ds-pp-live-dot{width:6px;height:6px;border-radius:50%;background:var(--pp-ok);flex:none;animation:ds-pp-pulse 1.6s ease-in-out infinite}
.ds-pp-live.is-error .ds-pp-live-dot{background:var(--pp-err);animation:none}
.ds-pp-live.is-done .ds-pp-live-dot{animation:none}
.ds-pp-live-count{margin-left:auto}
@keyframes ds-pp-pulse{0%,100%{opacity:1}50%{opacity:.35}}
.ds-pp-details{border-top:.5px solid var(--pp-line);padding:8px 14px 10px}
.ds-pp-details[hidden]{display:none}
.ds-pp-details>summary{font-size:10.5px;color:var(--pp-faint);cursor:pointer;text-transform:uppercase;letter-spacing:.04em}
.ds-pp-raw{margin:6px 0 0;max-height:160px;overflow:auto;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--pp-faint);white-space:pre-wrap;word-break:break-word}
.ds-pp-foot{padding:10px 14px;border-top:.5px solid var(--pp-line);font-size:12px;color:var(--pp-text);display:flex;align-items:center;gap:9px}
.ds-pp-foot[hidden]{display:none}
.ds-pp-foot .ds-pp-reload{font:inherit;font-size:12px;font-weight:650;color:#fff;background:var(--pp-blue);border:none;border-radius:8px;padding:6px 11px;cursor:pointer}
.ds-pp-miles{list-style:none;display:flex;flex-wrap:wrap;gap:6px 14px;margin:0;padding:10px 14px 2px}
.ds-pp-miles[hidden]{display:none}
.ds-pp-mile{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--pp-faint)}
.ds-pp-mile-dot{flex:none;width:7px;height:7px;border-radius:50%;border:1.5px solid rgba(255,255,255,.25);box-sizing:border-box}
.ds-pp-mile.is-done{color:var(--pp-muted)}
.ds-pp-mile.is-done .ds-pp-mile-dot{background:var(--pp-ok);border-color:var(--pp-ok)}
.ds-pp-mile.is-active{color:var(--pp-text);font-weight:600}
.ds-pp-mile.is-active .ds-pp-mile-dot{background:var(--pp-blue);border-color:var(--pp-blue);animation:ds-pp-pulse 1.1s ease-in-out infinite}
.ds-pp.is-finished .ds-pp-mile-dot{animation:none}
.ds-pp-note{padding:10px 14px 2px;font-size:13px;line-height:1.45;color:var(--pp-text)}
.ds-pp-note[hidden]{display:none}
.ds-pp[data-variant="stage"]{margin-top:28px;display:flex;flex-direction:column;max-height:none}
.ds-pp[data-variant="stage"] .ds-pp-title{font-size:15px}
.ds-pp[data-variant="stage"] .ds-pp-miles{padding:12px 16px 4px;gap:8px 16px}
.ds-pp[data-variant="stage"] .ds-pp-mile{font-size:12.5px}
.ds-pp[data-variant="stage"] .ds-pp-note{font-size:14px;padding:12px 16px 4px}
`;
}

/** The panel markup fragment; \`variant\` only sets the outer positioning class. */
export function progressPanelMarkup(variant: 'inline' | 'floating'): string {
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
  <ol class="ds-pp-miles" hidden></ol>
  <div class="ds-pp-note" hidden></div>
  <ol class="ds-pp-plan"></ol>
  <div class="ds-pp-now" hidden></div>
  <div class="ds-pp-live" hidden><span class="ds-pp-live-dot" aria-hidden="true"></span><span class="ds-pp-live-tx">Starting…</span><span class="ds-pp-live-count"></span></div>
  <details class="ds-pp-details" hidden><summary>Details</summary><pre class="ds-pp-raw"></pre></details>
  <div class="ds-pp-foot" hidden></div>
</div>`;
}

/** Browser script: defines a global ProgressPanel(root, opts) driven by progress events. */
export function progressPanelScript(): string {
  return `
function ProgressPanel(root, opts){
  opts = opts || {};
  var NL = String.fromCharCode(10);
  function q(sel){ return root.querySelector(sel); }
  var els = {
    title:q('.ds-pp-title'), agent:q('.ds-pp-agent'), repo:q('.ds-pp-repo'), spin:q('.ds-pp-spin'),
    plan:q('.ds-pp-plan'), now:q('.ds-pp-now'), live:q('.ds-pp-live'),
    liveTx:q('.ds-pp-live-tx'), liveCount:q('.ds-pp-live-count'),
    details:q('.ds-pp-details'), raw:q('.ds-pp-raw'), foot:q('.ds-pp-foot'),
    stop:q('[data-pp-stop]'), close:q('[data-pp-close]'),
    miles:q('.ds-pp-miles'), note:q('.ds-pp-note')
  };
  var WORK={guided_review:'Writing your review',detailed_audit:'Writing your review',address:'Addressing comments'};
  var DONE={guided_review:'Review ready',detailed_audit:'Review ready',address:'Comments addressed'};
  var MILES={
    guided_review:[
      {label:'Preparing',phases:['idle','preflight','resolving_context','preparing_prompt','starting_agent','agent_running']},
      {label:'Recovering the why',phases:['reading_changes','recovering_why']},
      {label:'Designing the reading path',phases:['designing_path']},
      {label:'Writing the story',phases:['writing_output']},
      {label:'Checking the result',phases:['validating_output','applying_results']},
      {label:'Ready',phases:['complete']}
    ],
    address:[
      {label:'Preparing',phases:['idle','preflight','resolving_context','preparing_prompt','starting_agent','agent_running']},
      {label:'Working the comments',phases:['reading_changes','recovering_why','designing_path','writing_output','applying_results']},
      {label:'Checking',phases:['validating_output']},
      {label:'Done',phases:['complete']}
    ]
  };
  MILES.detailed_audit=MILES.guided_review;
  var miles=null, mileIdx=-1;
  var workflow='', hasPlan=false, planTotal=0, planDone=0, activeNow=null, curState='Working';
  var t0=0, timer=null;
  function elapsed(){ var s=Math.round((Date.now()-t0)/1000); return s<60?(s+'s'):(Math.floor(s/60)+'m '+(s%60)+'s'); }
  function setLive(state, quietMs){
    if(!els.liveTx)return;
    var q2=(typeof quietMs==='number')?Math.round(quietMs/1000):0;
    els.liveTx.textContent=(state||'Working')+' · '+elapsed()+(q2>=8?(' · quiet '+q2+'s'):'');
  }
  function tick(){ setLive(curState,0); }
  function clip(s,n){ s=String(s||'').replace(/\\s+/g,' ').trim(); return s.length>n?s.slice(0,n)+'…':s; }
  function firstLine(s){ s=String(s||''); var i=s.indexOf(NL); return i>=0?s.slice(0,i):s; }
  var RAW_CAP=200000;
  function appendRaw(s){
    if(!els.raw||!s)return;
    var t=els.raw.textContent+s;
    if(t.length>RAW_CAP)t='…'+t.slice(t.length-RAW_CAP); // bound memory like the server caps its own capture
    els.raw.textContent=t; els.raw.scrollTop=els.raw.scrollHeight;
  }
  function setCurrent(text){
    var t=clip(text,120); if(!t)return;
    if(activeNow){ activeNow.textContent=t; if(els.now)els.now.hidden=true; }
    else if(els.now){ els.now.textContent=t; els.now.hidden=false; }
  }
  function renderPlan(items){
    if(!els.plan||!items||!items.length)return;
    hasPlan=true; planTotal=items.length; planDone=0; activeNow=null;
    els.plan.textContent=''; if(els.now)els.now.hidden=true;
    for(var i=0;i<items.length;i++){
      var it=items[i]||{}; var st=it.status||'pending';
      var li=document.createElement('li'); li.className='ds-pp-step is-'+st;
      var mk=document.createElement('span'); mk.className='ds-pp-mark';
      if(st==='done'){ mk.textContent='✓'; planDone++; }
      var tx=document.createElement('span'); tx.className='ds-pp-step-tx'; tx.textContent=it.text||'';
      li.appendChild(mk); li.appendChild(tx);
      if(st==='active'){ var now=document.createElement('span'); now.className='ds-pp-step-now'; tx.appendChild(now); activeNow=now; }
      els.plan.appendChild(li);
    }
    els.plan.scrollTop=els.plan.scrollHeight;
    if(els.liveCount)els.liveCount.textContent=planDone+' of '+planTotal+' done';
  }
  function renderMiles(){
    if(!els.miles||!miles)return;
    els.miles.hidden=false; els.miles.textContent='';
    for(var i=0;i<miles.length;i++){
      var li=document.createElement('li');
      li.className='ds-pp-mile '+(i<mileIdx?'is-done':i===mileIdx?'is-active':'is-pending');
      var dot=document.createElement('span'); dot.className='ds-pp-mile-dot';
      var tx=document.createElement('span'); tx.textContent=miles[i].label;
      li.appendChild(dot); li.appendChild(tx);
      els.miles.appendChild(li);
    }
  }
  function advanceMiles(phase){
    if(!miles)return;
    for(var i=0;i<miles.length;i++){
      if(miles[i].phases.indexOf(phase)>=0){ if(i>mileIdx){mileIdx=i;renderMiles();} return; }
    }
  }
  function setNote(text){
    var t=clip(text,220); if(!t||!els.note)return;
    els.note.textContent=t; els.note.hidden=false;
  }
  function setFinished(on){
    var c=root.className.replace(/\\s*\\bis-finished\\b/g,'');
    root.className=on?(c+' is-finished'):c;
  }
  function agentChip(agent,model){ var a=agent?(agent.charAt(0).toUpperCase()+agent.slice(1)):'Agent'; return model?(a+' · '+model):a; }
  function repoLine(ev){
    var p=ev.repoName||'';
    if(ev.base){ p+=' · '+ev.base+' → '+(ev.head||'working tree'); }
    if(typeof ev.targetCount==='number'){ p+=' · '+ev.targetCount+' '+(ev.targetCount===1?'comment':'comments'); }
    return p;
  }
  function start(){
    root.hidden=false; t0=Date.now(); setFinished(false);
    workflow=''; hasPlan=false; planTotal=0; planDone=0; activeNow=null; curState='Working';
    miles=null; mileIdx=-1;
    if(els.miles){els.miles.textContent='';els.miles.hidden=true;}
    if(els.note){els.note.textContent='';els.note.hidden=true;}
    if(els.spin)els.spin.hidden=false;
    if(els.stop)els.stop.hidden=false;
    if(els.close)els.close.hidden=true;
    if(els.title)els.title.textContent='Preparing…';
    if(els.plan)els.plan.textContent='';
    if(els.now){els.now.textContent='';els.now.hidden=true;}
    if(els.raw)els.raw.textContent='';
    if(els.details)els.details.hidden=true;
    if(els.foot){els.foot.hidden=true; els.foot.textContent='';}
    if(els.live){els.live.hidden=false; els.live.className='ds-pp-live';}
    if(els.liveCount)els.liveCount.textContent='';
    if(timer)clearInterval(timer); timer=setInterval(tick,1000); setLive('Preparing',0);
  }
  function stopTimer(){ if(timer){clearInterval(timer);timer=null;} }
  function handle(ev){
    if(!ev||!ev.type)return;
    if(opts.onEvent)opts.onEvent(ev);
    switch(ev.type){
      case 'run_started':
        workflow=ev.workflow||'';
        if(els.title)els.title.textContent=WORK[workflow]||ev.label||'Working…';
        miles=MILES[workflow]||null; mileIdx=miles?0:-1; if(miles)renderMiles();
        curState='Working'; setLive('Working',0); break;
      case 'context':
        if(els.agent)els.agent.textContent=agentChip(ev.agent,ev.model);
        if(els.repo)els.repo.textContent=repoLine(ev); break;
      case 'phase':
        advanceMiles(ev.phase);
        if(ev.phase==='validating_output'||ev.phase==='applying_results'){
          if(els.title)els.title.textContent='Checking the result…';
          curState='Checking'; setLive('Checking',0);
        } break;
      case 'plan': renderPlan(ev.items); break;
      case 'file': setCurrent(ev.label); break;
      case 'command': setCurrent(ev.label); break;
      case 'activity':
        if(ev.kind==='narration')setNote(ev.label);
        else setCurrent(ev.label);
        break;
      case 'tool': setCurrent(ev.label); break;
      case 'text':
        appendRaw(ev.data||'');
        // '>>' notes reach the panel as narration/phase events; echoing them
        // here would duplicate them into the mono activity line.
        if(!hasPlan){ var ln=clip(firstLine(ev.data),120); if(ln&&ln.indexOf('>>')!==0)setCurrent(ln); } break;
      case 'heartbeat': setLive(curState, ev.quietMs); break;
      case 'warning': appendRaw('[warn] '+(ev.label||'')+NL); break;
      case 'error': appendRaw('[error] '+(ev.label||'')+(ev.detail?(' — '+ev.detail):'')+NL); break;
      case 'run_done': finish(ev.status, ev.result||{}); break;
    }
  }
  function finish(status, result){
    stopTimer(); setFinished(true);
    if(els.spin)els.spin.hidden=true;
    if(els.stop)els.stop.hidden=true;
    if(els.close)els.close.hidden=false;
    var ok=(status==='complete');
    if(ok&&miles){ mileIdx=miles.length; renderMiles(); }
    if(els.title)els.title.textContent=ok?(DONE[workflow]||'Done'):(status==='stopped')?'Stopped':"Couldn't finish";
    if(els.now)els.now.hidden=true;
    if(els.live){
      els.live.className='ds-pp-live '+(ok?'is-done':'is-error');
      if(els.liveTx)els.liveTx.textContent=(ok?'Done':(status==='stopped')?'Stopped':'Failed')+' · '+elapsed();
    }
    if(!ok && els.details && els.raw && els.raw.textContent.trim()) els.details.hidden=false;
    if(opts.onDone)opts.onDone(status, result||{});
  }
  function blocked(err){
    root.hidden=false; stopTimer();
    if(els.spin)els.spin.hidden=true;
    if(els.stop)els.stop.hidden=true;
    if(els.close)els.close.hidden=false;
    if(els.title)els.title.textContent='Cannot start';
    if(els.live){ els.live.hidden=false; els.live.className='ds-pp-live is-error';
      if(els.liveTx)els.liveTx.textContent=(err&&err.label)||'Blocked'; if(els.liveCount)els.liveCount.textContent=''; }
    if(els.foot){ els.foot.hidden=false; els.foot.textContent=(err&&err.detail)||(err&&err.label)||'Blocked.'; }
    if(opts.onBlocked)opts.onBlocked(err||{});
  }
  if(els.stop)els.stop.addEventListener('click',function(){ if(opts.onStop)opts.onStop(); });
  if(els.close)els.close.addEventListener('click',function(){ if(opts.onClose)opts.onClose(); else root.hidden=true; });
  return { root:root, els:els, start:start, handle:handle, finish:finish, blocked:blocked,
           /* callers inject a .ds-pp-reload button via showFoot */
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
