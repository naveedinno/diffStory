// Inlined CSS + client JS for the diff surfaces (rows, gutters, toggles,
// change-jump). Same rules as page-assets.ts: plain strings, no backticks,
// no ${} in the JS. DIFF_JS is function declarations only — page-assets
// splices it INSIDE the page IIFE, so these share its closure scope.
export const DIFF_CSS = `.ds-diffscroll{flex:1;min-height:180px;overflow-y:auto;padding:18px 30px 26px}
/* .ds-why (the step narrative, page chrome) rides along in this diff-scoped
   at-rule because it shares one short-viewport breakpoint with .ds-diffscroll —
   they trade vertical space together, so the rule stays coupled rather than
   split across two files. */
@media (max-height:760px){.ds-why{max-height:120px}.ds-diffscroll{min-height:160px}}

/* ---- diff ---- */
.ds-diff{position:relative;border:1px solid var(--diff-rule);border-radius:6px;overflow:hidden;background:var(--panel3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.025)}
.ds-step.is-voice-active .ds-diff{border-color:rgba(208,188,255,0.72);box-shadow:0 0 0 1px rgba(208,188,255,0.34),0 12px 34px rgba(80,64,140,0.18),inset 0 1px 0 rgba(255,255,255,0.035)}
.ds-step.is-voice-active .ds-difthint{color:var(--md-primary);font-weight:700}
.ds-step.is-voice-active .ds-difthint::before{content:'Reading here';display:inline-flex;margin-right:8px;padding:1px 6px;border-radius:999px;background:rgba(208,188,255,0.16);color:var(--md-primary);font-size:10px;letter-spacing:0.02em;text-transform:uppercase}
.ds-difftoolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-bottom:1px solid var(--diff-rule);background:var(--panel2)}
.ds-difthint{font-size:11px;color:var(--dim)}
.ds-modetoggle{display:flex;gap:0;padding:2px;border-radius:7px;background:var(--fill-2);border:none}
.ds-modetoggle button{font-size:11px;font-weight:600;padding:4px 11px;border-radius:5px;border:none;cursor:pointer;background:transparent;color:var(--muted);transition:background .15s ease,color .15s ease}
.ds-modetoggle button.is-active{background:var(--panel4);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.28)}
.ds-diffhead{display:flex;background:#191b20;border-bottom:1px solid var(--diff-rule)}
.ds-diffhead-ctx{justify-content:space-between;align-items:center;padding:9px 14px}
.ds-diffhead-side{flex:1;min-width:0;display:flex;align-items:center;gap:9px;padding:9px 14px;overflow:hidden}
.ds-diffhead-side-l{flex-grow:var(--ds-split,50);flex-shrink:1;flex-basis:0}
.ds-diffhead-side-r{flex-grow:calc(100 - var(--ds-split,50));flex-shrink:1;flex-basis:0}
.ds-diffhead-ctx .ds-diffhead-side{padding:0}
.ds-diffhead-label{flex:none;font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--muted)}
.ds-diffhead-label.ds-dim{color:var(--dim2)}
.ds-diffhead-label.ds-green{color:var(--add)}
.ds-diffhead-path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:11.5px;color:var(--dim)}
.ds-diffhead-divider{width:1px;background:var(--diff-rule)}
.ds-diffhead-note{font-size:11px;color:var(--dim2)}
.ds-diffbody{font-family:var(--mono);font-size:12.5px;line-height:1.48;background:var(--panel3)}
.ds-diffbody-unified{font-size:12px;line-height:1.5;background:var(--panel3)}
.ds-hunkgap{padding:2px 14px;background:#15161a;color:var(--faint);font-size:11px;font-family:var(--mono);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft)}
.ds-row{display:flex;position:relative;border-bottom:1px solid rgba(255,255,255,0.025);min-height:24px}
.ds-row.is-voice-focus{box-shadow:inset 3px 0 0 var(--md-primary);animation:dsVoiceFocus 1.35s ease-in-out infinite}
.ds-row.is-voice-focus::before{content:'▶';position:absolute;left:8px;top:50%;transform:translateY(-50%);z-index:4;color:var(--md-primary);font-size:9px;line-height:1;pointer-events:none;text-shadow:0 0 8px rgba(208,188,255,0.72)}
.ds-row.is-voice-focus .ds-cell:not(.ds-cell-empty){background-image:linear-gradient(90deg,rgba(208,188,255,0.24),rgba(208,188,255,0.07))}
.ds-row.is-voice-focus .ds-no{color:var(--md-primary);font-weight:800}
@keyframes dsVoiceFocus{0%,100%{filter:brightness(1)}50%{filter:brightness(1.16)}}
.ds-cell{flex:1;min-width:0;display:flex;align-items:stretch}
.ds-cell-single{flex:1}
.ds-cell-add{background:rgba(18,150,111,0.14);box-shadow:inset 3px 0 0 var(--add-rail)}
.ds-cell-del{background:rgba(224,68,94,0.14);box-shadow:inset 3px 0 0 var(--del-rail)}
.ds-cell-untoured{background:rgba(255,159,10,0.13);box-shadow:inset 3px 0 0 var(--amber)}
.ds-cell-empty{flex:1;min-width:0;align-self:stretch;background-color:var(--fill-1);
  background-image:repeating-linear-gradient(135deg,var(--hairline) 0,var(--hairline) 1px,transparent 1px,transparent 7px)}
.ds-cell-l{flex-grow:var(--ds-split,50);flex-shrink:1;flex-basis:0}
.ds-cell-r{flex-grow:calc(100 - var(--ds-split,50));flex-shrink:1;flex-basis:0}
.ds-celldiv{width:1px;flex:none;background:var(--diff-rule);position:relative;cursor:col-resize}
.ds-celldiv::after{content:'';position:absolute;top:0;bottom:0;left:-5px;right:-5px;z-index:2}
.ds-celldiv:hover{background:var(--add-rail)}
body.ds-resizing{cursor:col-resize}
body.ds-resizing .ds-code,body.ds-resizing .ds-no{user-select:none}
body.ds-selecting-right .ds-code[data-comment-side="left"],
body.ds-selecting-left .ds-code[data-comment-side="right"]{-webkit-user-select:none;user-select:none}
.ds-no{width:42px;flex:none;display:flex;align-items:flex-start;justify-content:flex-end;text-align:right;padding:3px 8px 3px 0;color:var(--dim2);background:var(--gutter);border-right:1px solid var(--diff-rule);user-select:none;font-variant-numeric:tabular-nums}
.ds-sign{width:12px;flex:none;display:flex;align-items:flex-start;justify-content:center;text-align:center;padding:4px 0;color:var(--faint);user-select:none}
.ds-sign-add{color:var(--add-bd)}
.ds-sign-del{color:var(--del)}
.ds-code{flex:1;min-width:0;padding:3px 14px 3px 7px;color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere}
.ds-code-add{color:var(--add-text)}
.ds-code-del{color:var(--del-text)}
.ds-untoured-tag{flex:none;align-self:center;font-size:9px;font-weight:700;letter-spacing:0.03em;color:var(--on-amber);background:var(--amber);padding:1px 6px;border-radius:4px;margin:0 9px}
.ds-urow{display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.025);min-height:23px}
.ds-urow.ds-row-add{background:rgba(18,150,111,0.12);box-shadow:inset 3px 0 0 var(--add-rail)}
.ds-urow.ds-row-del{background:rgba(224,68,94,0.12);box-shadow:inset 3px 0 0 var(--del-rail)}
.ds-urow.is-untoured{background:rgba(255,159,10,0.1);border-left:2px solid var(--amber)}
.ds-urow .ds-no{width:44px}
.ds-urow .ds-code{padding:2px 12px 2px 7px}
.ds-urow .ds-no,.ds-urow .ds-sign{padding-top:2px;padding-bottom:2px}
.ds-changejump{flex:none;display:flex;align-items:center;gap:4px;padding:2px;border:1px solid var(--diff-rule);border-radius:7px;background:var(--gutter-hi)}
.ds-changejump[hidden]{display:none}
.ds-changebtn{width:26px;height:26px;display:flex;align-items:center;justify-content:center;border:none;border-radius:6px;background:transparent;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer}
.ds-changebtn:hover{background:var(--fill-2);color:var(--text)}
.ds-changebtn:disabled{opacity:.35;cursor:default}
.ds-changecount{min-width:40px;text-align:center;font-family:var(--mono);font-size:11px;color:var(--dim);font-variant-numeric:tabular-nums}
.ds-row.is-change-jump,.ds-urow.is-change-jump{animation:dsChangeJump 1.2s ease}
@keyframes dsChangeJump{0%,100%{filter:brightness(1)}20%,70%{filter:brightness(1.32)}}
/* syntax highlighting — the line background still marks add/del */
.ds-code .tk-k{color:var(--tk-k)}
.ds-code .tk-t{color:var(--tk-t)}
.ds-code .tk-f{color:var(--tk-f)}
.ds-code .tk-s{color:var(--tk-s)}
.ds-code .tk-n{color:var(--tk-n)}
.ds-code .tk-c{color:var(--tk-c);font-style:italic}
/* word-level diff: a stronger tint on just the tokens that changed within a line */
.ds-code .changed{border-radius:3px}
.ds-cell-add .changed,.ds-urow.ds-row-add .changed{background:rgba(18,150,111,0.38);box-shadow:0 0 0 1px rgba(18,150,111,0.38)}
.ds-cell-del .changed,.ds-urow.ds-row-del .changed{background:rgba(224,68,94,0.36);box-shadow:0 0 0 1px rgba(224,68,94,0.36)}
.ds-diffnote{padding:14px 16px;color:var(--muted);font-family:var(--sans);font-size:13px}
.ds-diffnote-soft{color:var(--dim2);font-size:12px;border-bottom:1px solid var(--line-soft)}
.ds-viewedmark{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:6px;border-radius:50%;border:1px solid var(--line);color:transparent;font-size:10px;line-height:1;transition:background .15s ease,border-color .15s ease,color .15s ease}
.ds-viewedmark:hover{border-color:var(--accent)}
.ds-viewedmark[aria-checked="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ds-fileitem.is-viewed .ds-fileitem-path,.ds-fileitem.is-viewed .ds-fileitem-stat{opacity:.55}
.ds-hunkgap.is-expandable:not(.ds-hunkgap-split){display:flex;align-items:center;justify-content:center;gap:10px}
.ds-hunkgap-split{display:flex;align-items:center;justify-content:stretch;gap:0;padding-left:0;padding-right:0}
.ds-gap-side{min-width:0;display:flex;align-items:center;gap:10px}
.ds-gap-side-l{flex-grow:var(--ds-split,50);flex-shrink:1;flex-basis:0;justify-content:flex-end}
.ds-gap-side-r{flex-grow:calc(100 - var(--ds-split,50));flex-shrink:1;flex-basis:0;justify-content:flex-start}
.ds-gap-side-l .ds-gapdots{margin-right:46px}
.ds-gap-side-r .ds-gapdots{margin-left:46px}
.ds-gap-mid{position:relative;flex:none;width:0;height:22px;display:flex;align-items:center;justify-content:center;color:var(--dim2)}
.ds-gap-mid>.ds-gapbtn{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.ds-gapbtn{font:inherit;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid var(--line-soft);background:transparent;color:var(--muted);cursor:pointer;opacity:0;transition:opacity .15s ease,background .15s ease}
.ds-hunkgap.is-expandable:hover .ds-gapbtn,.ds-gapbtn:focus-visible{opacity:1}
.ds-gapbtn:hover{background:var(--fill-2);color:var(--text)}
.ds-gapbtn:disabled{opacity:.4;cursor:default}
.ds-gapdots{color:var(--dim2)}
/* mode/file switches fade in */
.ds-filepanel-body>[data-diff-inner]:not([hidden]),.ds-filepanel-body>[data-split-inner]:not([hidden]),.ds-filepanel-body>[data-full-inner]:not([hidden]){animation:ds-body-in .16s ease}
@keyframes ds-body-in{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ds-filepanel-body>*{animation:none!important}.ds-modetoggle button,.ds-viewedmark,.ds-gapbtn{transition:none!important}}
`;

export const DIFF_JS = `
  function visibleDiffRoot(holder){
    var fullInner=$('[data-full-inner]',holder),splitInner=$('[data-split-inner]',holder),diffInner=$('[data-diff-inner]',holder);
    if(fullInner&&!fullInner.hidden)return fullInner;
    if(splitInner&&!splitInner.hidden)return splitInner;
    return diffInner;
  }
  function changeRows(holder){
    var root=visibleDiffRoot(holder);if(!root)return [];
    return $all('.ds-row-add,.ds-row-del',root);
  }
  function updateChangeNav(holder){
    if(!holder)return;
    var nav=$('[data-change-nav]',holder);if(!nav)return;
    var rows=changeRows(holder),idx=parseInt(holder.getAttribute('data-change-index')||'0',10);
    if(!rows.length){holder.setAttribute('data-change-index','0');nav.hidden=true;return;}
    if(isNaN(idx)||idx<0)idx=0;if(idx>rows.length-1)idx=rows.length-1;
    holder.setAttribute('data-change-index',String(idx));
    nav.hidden=false;
    var count=$('[data-change-count]',nav);if(count)count.textContent=(idx+1)+' / '+rows.length;
    var prev=$('[data-change-prev]',nav),next=$('[data-change-next]',nav);
    if(prev)prev.disabled=rows.length<2;
    if(next)next.disabled=rows.length<2;
  }
  function jumpToChange(holder,index,opts){
    if(!holder)return false;
    var rows=changeRows(holder);
    if(!rows.length){updateChangeNav(holder);return false;}
    var idx=Math.max(0,Math.min(rows.length-1,Number(index)||0));
    holder.setAttribute('data-change-index',String(idx));
    updateChangeNav(holder);
    var row=rows[idx];if(!row)return false;
    row.classList.add('is-change-jump');
    try{row.scrollIntoView({block:'center',inline:'nearest',behavior:opts&&opts.instant?'auto':'smooth'});}
    catch(e){try{row.scrollIntoView(false);}catch(ignore){}}
    setTimeout(function(){row.classList.remove('is-change-jump');},1300);
    return true;
  }
  function jumpRelativeChange(holder,delta){
    if(!holder)return false;
    var rows=changeRows(holder);
    if(!rows.length){updateChangeNav(holder);return false;}
    var idx=parseInt(holder.getAttribute('data-change-index')||'0',10);
    if(isNaN(idx))idx=0;
    idx=(idx+delta+rows.length)%rows.length;
    return jumpToChange(holder,idx);
  }
  function jumpToFirstChange(holder){
    if(!holder)return false;
    holder.setAttribute('data-change-index','0');
    updateChangeNav(holder);
    return jumpToChange(holder,0,{instant:true});
  }
  function activeChangeHolder(target){
    var holder=closest(target,'.ds-filepanel')||closest(target,'.ds-diff');
    if(holder&&!holder.hidden)return holder;
    if(filesView&&!filesView.hidden)return filePanels[selectedFile]||$('.ds-filepanel:not([hidden])');
    if(tourView&&!tourView.hidden){
      var panel=stepPanels&&stepPanels[active];
      return panel?$('.ds-diff',panel):null;
    }
    return null;
  }
  function handleChangeShortcut(e){
    if(isTextEntryTarget(e.target))return false;
    var dir=e.key==='ArrowRight'||e.key==='n'||e.key==='N'||e.key===']'?1:e.key==='ArrowLeft'||e.key==='p'||e.key==='P'||e.key==='['?-1:0;
    if(!dir)return false;
    var holder=activeChangeHolder(e.target);
    if(!holder||!changeRows(holder).length)return false;
    e.preventDefault();
    jumpRelativeChange(holder,dir);
    return true;
  }

  function setMode(btn,opts){
    var holder=closest(btn,'.ds-filepanel')||closest(btn,'.ds-diff');if(!holder)return;
    var file=holder.getAttribute('data-file');
    var mode=btn.getAttribute('data-mode');
    $all('.ds-modetoggle button',holder).forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-mode')===mode);});
    var diffInner=$('[data-diff-inner]',holder),fullInner=$('[data-full-inner]',holder),splitInner=$('[data-split-inner]',holder),hint=$('[data-difthint]',holder);
    if(holder.classList.contains('ds-filepanel')&&!(opts&&opts.persist===false)){try{localStorage.setItem('ds-files-mode',mode);}catch(e){}}
    var needsLoad=false;
    if(mode==='full'){
      if(hint){if(!hint.getAttribute('data-diffhint'))hint.setAttribute('data-diffhint',hint.textContent);hint.textContent='Complete file';}
      needsLoad=fullInner&&!fullInner.getAttribute('data-loaded')&&file;
      if(needsLoad)loadFull(fullInner,file);
      if(diffInner)diffInner.hidden=true;if(splitInner)splitInner.hidden=true;if(fullInner)fullInner.hidden=false;
    }else if(mode==='split'&&splitInner){
      if(hint&&hint.getAttribute('data-diffhint'))hint.textContent=hint.getAttribute('data-diffhint');
      needsLoad=!splitInner.getAttribute('data-loaded')&&file;
      if(needsLoad)loadSplit(splitInner,file);
      if(diffInner)diffInner.hidden=true;if(fullInner)fullInner.hidden=true;splitInner.hidden=false;
    }else{
      if(hint&&hint.getAttribute('data-diffhint'))hint.textContent=hint.getAttribute('data-diffhint');
      if(fullInner)fullInner.hidden=true;if(splitInner)splitInner.hidden=true;if(diffInner)diffInner.hidden=false;
    }
    updateChangeNav(holder);
    if(!needsLoad)jumpToFirstChange(holder);
  }
  function loadFull(fullInner,file){
    fullInner.setAttribute('data-loaded','1');
    fullInner.innerHTML='<div class="ds-diffnote">Loading the full file…</div>';
    fetch('/api/fullfile?file='+encodeURIComponent(file)).then(function(r){return r.text();}).then(function(html){fullInner.innerHTML=html;mountThreads(fullInner);updateChangeNav(closest(fullInner,'.ds-filepanel')||closest(fullInner,'.ds-diff'));jumpToFirstChange(closest(fullInner,'.ds-filepanel')||closest(fullInner,'.ds-diff'));}).catch(function(){fullInner.removeAttribute('data-loaded');fullInner.innerHTML='<div class="ds-diffnote">Could not load the full file.</div>';updateChangeNav(closest(fullInner,'.ds-filepanel')||closest(fullInner,'.ds-diff'));});
  }
  function loadSplit(splitInner,file){
    splitInner.setAttribute('data-loaded','1');
    splitInner.innerHTML='<div class="ds-diffnote">Loading the split view…</div>';
    fetch('/api/diff/split?file='+encodeURIComponent(file)).then(function(r){return r.text();}).then(function(html){
      splitInner.innerHTML=html;
      mountThreads(splitInner);
      var h=closest(splitInner,'.ds-filepanel')||closest(splitInner,'.ds-diff');
      updateChangeNav(h);jumpToFirstChange(h);
    }).catch(function(){
      splitInner.removeAttribute('data-loaded');
      splitInner.innerHTML='<div class="ds-diffnote">Could not load the split view.</div>';
      updateChangeNav(closest(splitInner,'.ds-filepanel')||closest(splitInner,'.ds-diff'));
    });
  }
  function viewedKey(){return 'ds-viewed:'+(document.body.getAttribute('data-viewed-scope')||'');}
  var viewedFiles={};
  function loadViewed(){
    viewedFiles={};
    try{(JSON.parse(localStorage.getItem(viewedKey())||'[]')||[]).forEach(function(f){viewedFiles[f]=true;});}catch(e){}
  }
  function saveViewed(){try{localStorage.setItem(viewedKey(),JSON.stringify(Object.keys(viewedFiles)));}catch(e){}}
  function toggleViewed(file){
    if(!file)return;
    if(viewedFiles[file])delete viewedFiles[file];else viewedFiles[file]=true;
    saveViewed();syncViewed();
  }
  function syncViewed(){
    var n=0,total=0;
    fileItems.forEach(function(it){
      var f=it.getAttribute('data-goto-file');if(!f)return;
      total++;
      var on=!!viewedFiles[f];if(on)n++;
      it.classList.toggle('is-viewed',on);
      var mark=$('[data-viewed-toggle]',it);
      if(mark){mark.setAttribute('aria-checked',on?'true':'false');mark.title=on?'Viewed — v to unmark':'Mark as viewed (v)';}
    });
    var prog=$('[data-viewed-progress]');
    if(prog)prog.textContent=n?(n+' of '+total+' viewed'):(total+' '+(total===1?'file':'files'));
  }
  function expandGap(btn){
    var gap=closest(btn,'[data-gap]');if(!gap)return;
    if(btn.disabled)return;
    var file=gap.getAttribute('data-gap-file');
    var from=parseInt(gap.getAttribute('data-gap-from')||'0',10);
    var toAttr=gap.getAttribute('data-gap-to');
    var eof=toAttr==='eof';
    var to=eof?0:parseInt(toAttr||'0',10);
    var mode=btn.getAttribute('data-expand');
    var rf,rt;
    if(mode==='all'){rf=from;rt=eof?'eof':to;}
    else if(mode==='down'){rf=from;rt=eof?(from+19):Math.min(to,from+19);}
    else{rf=Math.max(from,to-19);rt=to;}
    var holder=closest(gap,'.ds-filepanel')||closest(gap,'.ds-diff');
    var layout=closest(gap,'[data-split-inner]')?'split':'unified';
    var btns=[].slice.call(gap.querySelectorAll('.ds-gapbtn'));
    btns.forEach(function(b){b.disabled=true;});
    fetch('/api/diff/context?file='+encodeURIComponent(file)+'&from='+rf+'&to='+rt+'&layout='+layout)
      .then(function(r){return r.text();})
      .then(function(html){
        var tmp=document.createElement('div');tmp.innerHTML=html;
        var wrap=tmp.firstElementChild;
        if(!wrap||!wrap.hasAttribute('data-ctx-rows')||!wrap.children.length){gap.remove();if(holder)updateChangeNav(holder);return;}
        var servedFrom=parseInt(wrap.getAttribute('data-from')||'0',10);
        var servedTo=parseInt(wrap.getAttribute('data-to')||'0',10);
        mountThreads(wrap);
        var parent=gap.parentNode,refNode=(mode==='up')?gap.nextSibling:gap;
        while(wrap.firstChild)parent.insertBefore(wrap.firstChild,refNode);
        if(mode==='all'){gap.remove();}
        else if(mode==='down'){
          var nf=servedTo+1;
          if(eof){gap.setAttribute('data-gap-from',String(nf));}
          else if(nf>to){gap.remove();}
          else{gap.setAttribute('data-gap-from',String(nf));}
        }else{
          var nt=servedFrom-1;
          if(nt<from){gap.remove();}
          else{gap.setAttribute('data-gap-to',String(nt));}
        }
        btns.forEach(function(b){b.disabled=false;});
        if(holder)updateChangeNav(holder);
      })
      .catch(function(){
        btns.forEach(function(b){b.disabled=false;});
        toast('Could not load more context');
      });
  }
`;
