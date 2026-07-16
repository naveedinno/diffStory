// Inlined CSS + client JS for the diff surfaces (rows, gutters, toggles,
// change-jump). Same rules as page-assets.ts: plain strings, no backticks,
// no ${} in the JS. DIFF_JS is function declarations only — page-assets
// splices it INSIDE the page IIFE, so these share its closure scope.
export const DIFF_CSS = `.ds-diffscroll{flex:1;min-width:0;min-height:180px;overflow-x:hidden;overflow-y:auto;padding:18px 30px 26px}
/* .ds-why (the step narrative, page chrome) rides along in this diff-scoped
   at-rule because it shares one short-viewport breakpoint with .ds-diffscroll —
   they trade vertical space together, so the rule stays coupled rather than
   split across two files. */
@media (max-height:760px){.ds-why{max-height:120px}.ds-diffscroll{min-height:160px}}

/* ---- diff ---- */
.ds-diff{position:relative;width:100%;min-width:0;max-width:100%;border:1px solid var(--diff-rule);border-radius:6px;overflow:hidden;background:var(--panel3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.025)}
.ds-step.is-story-active:not(.is-voice-active) .ds-diff{border-color:rgba(10,132,255,0.52);box-shadow:0 0 0 1px rgba(10,132,255,0.16),inset 0 1px 0 rgba(255,255,255,0.035)}
.ds-step.is-story-active:not(.is-voice-active) .ds-difthint{color:var(--accent-blue);font-weight:700}
.ds-step.is-story-active:not(.is-voice-active) .ds-difthint::before{content:'Story focus';display:inline-flex;margin-right:8px;padding:1px 6px;border-radius:999px;background:var(--accent-soft);color:var(--accent-blue);font-size:10px;letter-spacing:0.02em;text-transform:uppercase}
.ds-step.is-voice-active .ds-diff{border-color:rgba(208,188,255,0.72);box-shadow:0 0 0 1px rgba(208,188,255,0.34),0 12px 34px rgba(80,64,140,0.18),inset 0 1px 0 rgba(255,255,255,0.035)}
.ds-step.is-voice-active .ds-difthint{color:var(--md-primary);font-weight:700}
.ds-step.is-voice-active .ds-difthint::before{content:'Reading here';display:inline-flex;margin-right:8px;padding:1px 6px;border-radius:999px;background:rgba(208,188,255,0.16);color:var(--md-primary);font-size:10px;letter-spacing:0.02em;text-transform:uppercase}
.ds-difftoolbar{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-bottom:1px solid var(--diff-rule);background:var(--panel2)}
.ds-difthint{font-size:11px;color:var(--dim)}
.ds-modetoggle{display:flex;gap:0;padding:2px;border-radius:7px;background:var(--fill-2);border:none}
.ds-modetoggle button{font-size:11px;font-weight:600;padding:4px 11px;border-radius:5px;border:none;cursor:pointer;background:transparent;color:var(--muted);transition:background var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease}
.ds-modetoggle button.is-active{background:var(--panel4);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.28)}
.ds-diffhead{display:flex;background:var(--gutter-hi);border-bottom:1px solid var(--diff-rule)}
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
.ds-hunkgap{padding:2px 14px;background:var(--gutter);color:var(--faint);font-size:11px;font-family:var(--mono);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft)}
.ds-row{display:flex;position:relative;border-bottom:1px solid rgba(255,255,255,0.025);min-height:24px}
.ds-row[data-review-row]:focus-visible,.ds-urow[data-review-row]:focus-visible{outline:2px solid var(--accent-blue);outline-offset:-2px;z-index:3}
.ds-row.is-story-focus{box-shadow:inset 3px 0 0 var(--accent-blue)}
.ds-row.is-story-focus .ds-cell:not(.ds-cell-empty){background-image:linear-gradient(90deg,var(--accent-soft),transparent)}
.ds-row.is-story-focus .ds-no{color:var(--accent-blue);font-weight:800}
.ds-urow.is-story-focus{box-shadow:inset 3px 0 0 var(--accent-blue);background-image:linear-gradient(90deg,var(--accent-soft),transparent)}
.ds-urow.is-story-focus .ds-no{color:var(--accent-blue);font-weight:800}
.ds-step.is-story-active .ds-row.is-story-camera,.ds-step.is-story-active .ds-urow.is-story-camera{position:relative}
.ds-step[data-story-lens="focus"].is-story-active [data-diff-inner] .ds-diffbody>.ds-row:not(.is-story-focus),.ds-step[data-story-lens="focus"].is-story-active [data-diff-inner] .ds-diffbody>.ds-urow:not(.is-story-focus),.ds-step[data-story-lens="focus"].is-story-active [data-split-inner] .ds-diffbody>.ds-row:not(.is-story-focus),.ds-step[data-story-lens="focus"].is-story-active [data-split-inner] .ds-diffbody>.ds-urow:not(.is-story-focus){opacity:.46}
.ds-step[data-story-lens="focus"].is-story-active [data-diff-inner] .ds-hunkgap,.ds-step[data-story-lens="focus"].is-story-active [data-split-inner] .ds-hunkgap{opacity:.5}
.ds-step[data-story-lens="context"].is-story-active .ds-row:not(.is-story-camera) .ds-cell-add{background:color-mix(in srgb,var(--add-bg) 34%,var(--panel3))}
.ds-step[data-story-lens="context"].is-story-active .ds-row:not(.is-story-camera) .ds-cell-del{background:color-mix(in srgb,var(--del-bg) 34%,var(--panel3))}
.ds-step[data-story-lens="context"].is-story-active .ds-urow:not(.is-story-camera).ds-row-add{background:color-mix(in srgb,var(--add-bg) 34%,var(--panel3))}
.ds-step[data-story-lens="context"].is-story-active .ds-urow:not(.is-story-camera).ds-row-del{background:color-mix(in srgb,var(--del-bg) 34%,var(--panel3))}
.ds-step[data-story-lens="context"].is-story-active .ds-row:not(.is-story-camera) .ds-code,.ds-step[data-story-lens="context"].is-story-active .ds-urow:not(.is-story-camera) .ds-code{color:var(--muted)}
.ds-step.is-voice-active .ds-row.is-story-focus:not(.is-voice-focus){box-shadow:none}
.ds-step.is-voice-active .ds-row.is-story-focus:not(.is-voice-focus) .ds-cell:not(.ds-cell-empty){background-image:none}
.ds-step.is-voice-active .ds-row.is-story-focus:not(.is-voice-focus) .ds-no{color:var(--dim2);font-weight:400}
.ds-step.is-voice-active .ds-urow.is-story-focus:not(.is-voice-focus){box-shadow:none;background-image:none}
.ds-step.is-voice-active .ds-urow.is-story-focus:not(.is-voice-focus) .ds-no{color:var(--dim2);font-weight:400}
.ds-row.is-voice-focus{box-shadow:inset 3px 0 0 var(--md-primary)}
.ds-row.is-voice-focus::before{content:'▶';position:absolute;left:8px;top:50%;transform:translateY(-50%);z-index:4;color:var(--md-primary);font-size:9px;line-height:1;pointer-events:none;text-shadow:0 0 8px rgba(208,188,255,0.72)}
.ds-row.is-voice-focus .ds-cell:not(.ds-cell-empty){background-image:linear-gradient(90deg,rgba(208,188,255,0.24),rgba(208,188,255,0.07))}
.ds-row.is-voice-focus .ds-no{color:var(--md-primary);font-weight:800}
.ds-urow.is-voice-focus{position:relative;box-shadow:inset 3px 0 0 var(--md-primary);background-image:linear-gradient(90deg,rgba(208,188,255,0.24),rgba(208,188,255,0.07))}
.ds-urow.is-voice-focus::before{content:'▶';position:absolute;left:8px;top:50%;transform:translateY(-50%);z-index:4;color:var(--md-primary);font-size:9px;line-height:1;pointer-events:none;text-shadow:0 0 8px rgba(208,188,255,0.72)}
.ds-urow.is-voice-focus .ds-no{color:var(--md-primary);font-weight:800}
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
.ds-celldiv[role="separator"]:focus-visible{outline:2px solid var(--accent-blue);outline-offset:3px;background:var(--accent-blue);z-index:4}
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
.ds-changebtn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;border-radius:7px;background:transparent;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer}
.ds-changebtn:hover{background:var(--fill-2);color:var(--text)}
.ds-changebtn:disabled{opacity:.35;cursor:default}
.ds-changecount{min-width:40px;text-align:center;font-family:var(--mono);font-size:11px;color:var(--dim);font-variant-numeric:tabular-nums}
.ds-viewed-toggle{height:30px;flex:none;display:inline-flex;align-items:center;gap:6px;padding:0 9px;border:1px solid var(--diff-rule);border-radius:7px;background:transparent;color:var(--muted);font:inherit;font-size:11px;font-weight:650;cursor:pointer;transition:background var(--motion-duration-fast) ease,border-color var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease}
.ds-viewed-toggle:hover{background:var(--fill-2);color:var(--text)}
.ds-viewed-toggle:focus-visible{outline:2px solid var(--accent-blue);outline-offset:2px}
.ds-viewed-toggle-icon{width:15px;height:15px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--dim2);border-radius:50%;color:transparent;font-size:10px;line-height:1;transition:background var(--motion-duration-fast) ease,border-color var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease}
.ds-viewed-toggle.is-active{border-color:rgba(48,209,88,.28);background:rgba(48,209,88,.08);color:var(--add-text)}
.ds-viewed-toggle,.ds-fileitem-viewed{--ds-reviewed-check-fg:var(--on-green,#00250c)}
.ds-viewed-toggle.is-active .ds-viewed-toggle-icon{border-color:var(--add);background:var(--add);color:var(--ds-reviewed-check-fg)}
.ds-row.is-change-jump,.ds-urow.is-change-jump{box-shadow:inset 3px 0 0 var(--accent-blue)}
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
.ds-differror{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-left:3px solid var(--del);background:var(--del-bg)}
.ds-differror-title{color:var(--text);font-weight:700}
.ds-differror-detail{color:var(--muted)}
.ds-diffretry{min-height:30px;padding:5px 11px;border:1px solid var(--line);border-radius:7px;background:var(--fill-2);color:var(--text);font:inherit;font-weight:700;cursor:pointer}
.ds-diffretry:hover{background:var(--fill-3)}
.ds-diffretry:focus-visible{outline:2px solid var(--accent-blue);outline-offset:2px}
.ds-fileitem-viewed{flex:none;width:15px;height:15px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--add);color:var(--ds-reviewed-check-fg);font-size:9px;font-weight:850;opacity:0;transform:scale(.72);transition:opacity var(--motion-duration-fast) ease,transform var(--motion-duration-fast) var(--motion-ease-in-out)}
.ds-fileitem.is-viewed .ds-fileitem-viewed,.ds-fileitem.is-reviewed .ds-fileitem-viewed{opacity:1;transform:scale(1)}
.ds-fileitem.is-viewed .ds-fileitem-path,.ds-fileitem.is-viewed .ds-fileitem-stat,.ds-fileitem.is-reviewed .ds-fileitem-path,.ds-fileitem.is-reviewed .ds-fileitem-stat{opacity:.55}
.ds-hunkgap.is-expandable:not(.ds-hunkgap-split){display:flex;align-items:center;justify-content:center;gap:10px}
.ds-hunkgap-split{display:flex;align-items:center;justify-content:stretch;gap:0;padding-left:0;padding-right:0}
.ds-gap-side{min-width:0;display:flex;align-items:center;gap:10px}
.ds-gap-side-l{flex-grow:var(--ds-split,50);flex-shrink:1;flex-basis:0;justify-content:flex-end}
.ds-gap-side-r{flex-grow:calc(100 - var(--ds-split,50));flex-shrink:1;flex-basis:0;justify-content:flex-start}
.ds-gap-side-l .ds-gapdots{margin-right:46px}
.ds-gap-side-r .ds-gapdots{margin-left:46px}
.ds-gap-mid{position:relative;flex:none;width:0;height:22px;display:flex;align-items:center;justify-content:center;color:var(--dim2)}
.ds-gap-mid>.ds-gapbtn{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.ds-gapbtn{font:inherit;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid var(--line-soft);background:transparent;color:var(--muted);cursor:pointer;opacity:0;transition:opacity var(--motion-duration-fast) ease,background var(--motion-duration-fast) ease}
.ds-hunkgap.is-expandable:hover .ds-gapbtn,.ds-gapbtn:focus-visible{opacity:1}
.ds-gapbtn:hover{background:var(--fill-2);color:var(--text)}
.ds-gapbtn:disabled{opacity:.4;cursor:default}
.ds-gapdots{color:var(--dim2)}
.ds-hunkgap.is-error{display:flex;align-items:center;justify-content:center;min-height:34px;padding:4px 10px}
.ds-hunkgap.is-error>.ds-gapbtn,.ds-hunkgap.is-error>.ds-gapdots,.ds-hunkgap.is-error>.ds-gap-side,.ds-hunkgap.is-error>.ds-gap-mid{display:none}
.ds-gaperror{display:inline-flex;align-items:center;justify-content:center;gap:9px;color:var(--del-text);font-family:var(--sans);font-size:11px}
.ds-gapretry{opacity:1;min-height:26px;color:var(--text);border-color:var(--line)}
@media (hover:none),(pointer:coarse){.ds-hunkgap.is-expandable .ds-gapbtn{opacity:1;min-height:28px;padding-left:11px;padding-right:11px}}
/* Lazy diff bodies get a small fallback reveal. Interactive mode/file handoffs
   are owned by the interruptible workspace transition in page-assets. */
html:not([data-ds-motion]) .ds-filepanel-body>[data-diff-inner]:not([hidden]),html:not([data-ds-motion]) .ds-filepanel-body>[data-split-inner]:not([hidden]),html:not([data-ds-motion]) .ds-filepanel-body>[data-full-inner]:not([hidden]){animation:ds-body-in var(--motion-duration-fast) var(--motion-ease-out)}
@keyframes ds-body-in{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
@media (max-width:1050px){.ds-viewed-toggle{width:30px;padding:0;justify-content:center}.ds-viewed-toggle-label{display:none}}
@media (max-width:720px){
  .ds-filepanel-head{flex-wrap:wrap;gap:7px;padding:10px 12px}
  .ds-filepanel-head>.ds-cardpath{order:1;flex:1 1 110px}
  .ds-filepanel-head>.ds-badge{order:2}
  .ds-filepanel-head>.ds-untoured-badge{order:3}
  .ds-filepanel-head>.ds-stepchip{order:4}
  .ds-filepanel-head>.ds-cardstat{order:5}
  .ds-filepanel-head>.ds-flex{display:none}
  .ds-filepanel-head::after{content:'';order:6;flex-basis:100%;height:0}
  .ds-filepanel-head>.ds-changejump{order:7}
  .ds-filepanel-head>.ds-viewed-toggle{order:8}
  .ds-filepanel-head>.ds-modetoggle{order:9;margin-left:auto}
  .ds-filepanel-head .ds-modetoggle button{padding-left:8px;padding-right:8px}
}
@media (prefers-reduced-motion:reduce){.ds-filepanel-body>*{animation:none!important}.ds-row.is-voice-focus,.ds-urow.is-voice-focus,.ds-row.is-change-jump,.ds-urow.is-change-jump{animation:none!important;filter:none!important}.ds-modetoggle button,.ds-gapbtn,.ds-viewed-toggle,.ds-viewed-toggle-icon,.ds-fileitem-viewed{transition:none!important}}
`;
export const DIFF_JS = `
  function scrollReviewRowVertically(row,opts){
    if(!row)return false;
    var scroller=closest(row,'.ds-diffscroll')||closest(row,'.ds-filedetail');
    if(!scroller)return false;
    var sr=scroller.getBoundingClientRect(),rr=row.getBoundingClientRect();
    var top=scroller.scrollTop+(rr.top-sr.top)-(scroller.clientHeight-rr.height)/2;
    try{scroller.scrollTo({top:Math.max(0,top),behavior:(opts&&opts.instant)||prefersReducedMotion()?'auto':'smooth'});}
    catch(e){scroller.scrollTop=Math.max(0,top);}
    return true;
  }
  function visibleDiffRoot(holder){
    var fullInner=$('[data-full-inner]',holder),splitInner=$('[data-split-inner]',holder),diffInner=$('[data-diff-inner]',holder);
    if(fullInner&&!fullInner.hidden)return fullInner;
    if(splitInner&&!splitInner.hidden)return splitInner;
    return diffInner;
  }
  function diffResponseText(r){
    if(!r.ok){var err=new Error('Diff request failed');err.status=r.status;err.reloadRequired=r.status===409;throw err;}
    return r.text();
  }
  function diffFailureDetail(err){
    if(err&&err.reloadRequired)return 'The review changed while this page was open. Reload to continue safely.';
    return err&&err.status?'The server returned HTTP '+err.status+'.':'Check your connection and try again.';
  }
  function showDiffLoadError(inner,label,mode,err){
    inner.removeAttribute('data-loaded');inner.setAttribute('aria-busy','false');inner.textContent='';
    var note=document.createElement('div');note.className='ds-diffnote ds-differror';note.setAttribute('role','alert');
    var title=document.createElement('span');title.className='ds-differror-title';title.textContent='Could not load the '+label+'.';
    var detail=document.createElement('span');detail.className='ds-differror-detail';detail.textContent=diffFailureDetail(err);
    var retry=document.createElement('button');retry.type='button';retry.className='ds-diffretry';if(err&&err.reloadRequired){retry.setAttribute('data-review-reload','');retry.textContent='Reload review';retry.setAttribute('aria-label','Reload review with current evidence');}else{retry.setAttribute('data-mode',mode);retry.textContent='Retry';retry.setAttribute('aria-label','Retry loading the '+label);}
    note.appendChild(title);note.appendChild(detail);note.appendChild(retry);inner.appendChild(note);
  }
  function splitPercent(holder){
    var raw=holder&&holder.style?holder.style.getPropertyValue('--ds-split'):'';
    if(!raw&&holder&&window.getComputedStyle)raw=window.getComputedStyle(holder).getPropertyValue('--ds-split');
    var pct=parseFloat(raw||'50');if(isNaN(pct))pct=50;return Math.max(22,Math.min(78,pct));
  }
  function setSplitDividerValue(divider,pct){
    var rounded=Math.round(pct);
    divider.setAttribute('aria-valuenow',String(rounded));
    divider.setAttribute('aria-valuetext',rounded+'% before, '+(100-rounded)+'% after');
  }
  function handleSplitDividerKey(e){
    var divider=closest(e.target,'.ds-celldiv[role="separator"]');if(!divider)return false;
    var key=e.key;if(key!=='ArrowLeft'&&key!=='ArrowRight'&&key!=='Home'&&key!=='End')return false;
    var holder=closest(divider,'.ds-filepanel,.ds-diff');if(!holder)return false;
    var pct=splitPercent(holder),step=e.shiftKey?10:4;
    if(key==='Home')pct=22;else if(key==='End')pct=78;else pct+=key==='ArrowRight'?step:-step;
    pct=Math.max(22,Math.min(78,pct));holder.style.setProperty('--ds-split',String(pct));
    try{localStorage.setItem('ds-split',String(pct));}catch(err){}
    setSplitDividerValue(divider,pct);e.preventDefault();e.stopPropagation();return true;
  }
  function prepareSplitDivider(holder){
    if(!holder)return;
    var root=visibleDiffRoot(holder)||holder,dividers=$all('.ds-celldiv',root);
    dividers.forEach(function(divider){divider.tabIndex=-1;divider.setAttribute('aria-hidden','true');divider.removeAttribute('role');divider.removeAttribute('aria-label');divider.removeAttribute('aria-orientation');divider.removeAttribute('aria-valuemin');divider.removeAttribute('aria-valuemax');divider.removeAttribute('aria-valuenow');divider.removeAttribute('aria-valuetext');divider.removeAttribute('aria-keyshortcuts');});
    if(!dividers.length)return;
    var divider=dividers[0];divider.tabIndex=0;divider.removeAttribute('aria-hidden');divider.setAttribute('role','separator');divider.setAttribute('aria-label','Resize before and after panes');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-valuemin','22');divider.setAttribute('aria-valuemax','78');divider.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight Home End');divider.title='Resize panes with left and right arrow keys';setSplitDividerValue(divider,splitPercent(holder));
    if(!divider._dsSplitKeyboard){divider._dsSplitKeyboard=true;divider.addEventListener('keydown',handleSplitDividerKey);divider.addEventListener('focus',function(){setSplitDividerValue(divider,splitPercent(holder));});}
  }
  function changeRows(holder){
    var root=visibleDiffRoot(holder);if(!root)return [];
    return $all('.ds-row-add,.ds-row-del',root);
  }
  function updateChangeNav(holder){
    if(!holder)return;
    prepareSplitDivider(holder);
    var nav=$('[data-change-nav]',holder);if(!nav)return;
    nav.setAttribute('role','group');nav.setAttribute('aria-label','Change navigation');
    if(typeof syncViewed==='function')syncViewed();
    var rows=changeRows(holder),idx=parseInt(holder.getAttribute('data-change-index')||'0',10);
    if(!rows.length){holder.setAttribute('data-change-index','0');nav.hidden=true;return;}
    if(isNaN(idx)||idx<0)idx=0;if(idx>rows.length-1)idx=rows.length-1;
    holder.setAttribute('data-change-index',String(idx));
    nav.hidden=false;
    var count=$('[data-change-count]',nav);if(count){count.setAttribute('aria-live','polite');count.setAttribute('aria-atomic','true');count.textContent=(idx+1)+' / '+rows.length;}
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
    $all('.ds-row-add,.ds-row-del',holder).forEach(function(r){r.classList.remove('is-change-jump');r.removeAttribute('aria-current');});
    row.classList.add('is-change-jump');
    row.setAttribute('aria-current','true');
    scrollReviewRowVertically(row,opts);
    if(opts&&opts.focus&&row.focus){try{row.focus({preventScroll:true});}catch(e){row.focus();}}
    return true;
  }
  function jumpRelativeChange(holder,delta,opts){
    if(!holder)return false;
    var rows=changeRows(holder);
    if(!rows.length){updateChangeNav(holder);return false;}
    var idx=parseInt(holder.getAttribute('data-change-index')||'0',10);
    if(isNaN(idx))idx=0;
    idx=(idx+delta+rows.length)%rows.length;
    return jumpToChange(holder,idx,opts);
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
    jumpRelativeChange(holder,dir,{focus:true});
    return true;
  }

  function setMode(btn,opts){
    var holder=closest(btn,'.ds-filepanel')||closest(btn,'.ds-diff');if(!holder)return;
    var file=holder.getAttribute('data-file');
    var mode=btn.getAttribute('data-mode');
    var diffInner=$('[data-diff-inner]',holder),fullInner=$('[data-full-inner]',holder),splitInner=$('[data-split-inner]',holder),hint=$('[data-difthint]',holder);
    if(holder.classList.contains('ds-filepanel')&&!(opts&&opts.persist===false)){try{localStorage.setItem('ds-files-mode',mode);}catch(e){}}
    var needsLoad=mode==='full'?!!(fullInner&&!fullInner.getAttribute('data-loaded')&&file):mode==='split'?!!(splitInner&&!splitInner.getAttribute('data-loaded')&&file):false;
    if(needsLoad&&mode==='full')loadFull(fullInner,file);else if(needsLoad&&mode==='split')loadSplit(splitInner,file);
    var update=function(){
      $all('.ds-modetoggle button',holder).forEach(function(b){var active=b.getAttribute('data-mode')===mode;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false');});
      if(mode==='full'){
        if(hint){if(!hint.getAttribute('data-diffhint'))hint.setAttribute('data-diffhint',hint.textContent);hint.textContent='Complete file';}
        if(diffInner)diffInner.hidden=true;if(splitInner)splitInner.hidden=true;if(fullInner)fullInner.hidden=false;
      }else if(mode==='split'&&splitInner){
        if(hint&&hint.getAttribute('data-diffhint'))hint.textContent=hint.getAttribute('data-diffhint');
        if(diffInner)diffInner.hidden=true;if(fullInner)fullInner.hidden=true;splitInner.hidden=false;
      }else{
        if(hint&&hint.getAttribute('data-diffhint'))hint.textContent=hint.getAttribute('data-diffhint');
        if(fullInner)fullInner.hidden=true;if(splitInner)splitInner.hidden=true;if(diffInner)diffInner.hidden=false;
      }
    };
    var transition=null;if(opts&&opts.persist===false)update();else transition=runWorkspaceTransition('mode',0,update);
    var finish=function(){updateChangeNav(holder);if(!needsLoad)jumpToFirstChange(holder);};
    if(transition&&transition.updateCallbackDone)Promise.resolve(transition.updateCallbackDone).then(finish,finish);else finish();
    if(typeof saveReviewPositionSoon==='function')saveReviewPositionSoon();
  }
  function loadFull(fullInner,file){
    fullInner.setAttribute('data-loaded','1');
    fullInner.setAttribute('aria-busy','true');
    fullInner.innerHTML='<div class="ds-diffnote" role="status">Loading the full file…</div>';
    fetch(reviewPageUrl('/api/fullfile?file='+encodeURIComponent(file))).then(diffResponseText).then(function(html){fullInner.setAttribute('aria-busy','false');fullInner.innerHTML=html;mountThreads(fullInner);updateChangeNav(closest(fullInner,'.ds-filepanel')||closest(fullInner,'.ds-diff'));jumpToFirstChange(closest(fullInner,'.ds-filepanel')||closest(fullInner,'.ds-diff'));}).catch(function(err){showDiffLoadError(fullInner,'full file','full',err);updateChangeNav(closest(fullInner,'.ds-filepanel')||closest(fullInner,'.ds-diff'));});
  }
  function loadSplit(splitInner,file){
    splitInner.setAttribute('data-loaded','1');
    splitInner.setAttribute('aria-busy','true');
    splitInner.innerHTML='<div class="ds-diffnote" role="status">Loading the split view…</div>';
    fetch(reviewPageUrl('/api/diff/split?file='+encodeURIComponent(file))).then(diffResponseText).then(function(html){
      splitInner.setAttribute('aria-busy','false');
      splitInner.innerHTML=html;
      mountThreads(splitInner);
      var h=closest(splitInner,'.ds-filepanel')||closest(splitInner,'.ds-diff');
      updateChangeNav(h);jumpToFirstChange(h);
    }).catch(function(err){
      showDiffLoadError(splitInner,'split view','split',err);
      updateChangeNav(closest(splitInner,'.ds-filepanel')||closest(splitInner,'.ds-diff'));
    });
  }
  function viewedKey(){return 'ds-viewed:'+(document.body.getAttribute('data-viewed-scope')||'');}
  var viewedFiles=Object.create(null);
  function reviewHashForFile(file){
    var hash='',conflict=false;
    function take(node){
      if(!node)return;var value=(node.getAttribute('data-review-hash')||'').trim();if(!value)return;
      if(hash&&hash!==value)conflict=true;else hash=value;
    }
    fileItems.forEach(function(item){if(item.getAttribute('data-goto-file')===file)take(item);});
    filePanels.forEach(function(panel){if(panel.getAttribute('data-file')===file)take(panel);});
    return conflict?'':hash;
  }
  function fileIsReviewed(file){var hash=reviewHashForFile(file);return !!hash&&viewedFiles[file]===hash;}
  function loadViewed(){
    viewedFiles=Object.create(null);
    try{
      var stored=JSON.parse(localStorage.getItem(viewedKey())||'{}');
      if(Array.isArray(stored)){
        stored.forEach(function(file){var hash=reviewHashForFile(file);if(hash)viewedFiles[file]=hash;});
        saveViewed();
      }else if(stored&&typeof stored==='object'){
        Object.keys(stored).forEach(function(file){if(typeof stored[file]==='string'&&stored[file])viewedFiles[file]=stored[file];});
      }
    }catch(e){}
  }
  function saveViewed(){try{localStorage.setItem(viewedKey(),JSON.stringify(viewedFiles));}catch(e){}}
  function invalidateChangedViewed(){
    var changed=false;
    Object.keys(viewedFiles).forEach(function(file){var hash=reviewHashForFile(file);if(!hash||viewedFiles[file]!==hash){delete viewedFiles[file];changed=true;}});
    if(changed)saveViewed();
  }
  function toggleViewed(file){
    if(!file)return;
    var hash=reviewHashForFile(file);
    if(!hash){toast('This file cannot be marked reviewed until its review fingerprint is available.');return;}
    if(viewedFiles[file]===hash)delete viewedFiles[file];else viewedFiles[file]=hash;
    saveViewed();syncViewed();
  }
  function syncViewed(){
    var n=0,total=0;
    fileItems.forEach(function(it){
      var f=it.getAttribute('data-goto-file');if(!f)return;
      total++;
      var on=fileIsReviewed(f);if(on)n++;
      it.classList.toggle('is-viewed',on);
      it.classList.toggle('is-reviewed',on);
      it.setAttribute('data-reviewed',on?'true':'false');
    });
    $all('[data-viewed-toggle]').forEach(function(btn){
      var panel=closest(btn,'.ds-filepanel'),file=panel&&panel.getAttribute('data-file'),on=fileIsReviewed(file);
      btn.classList.toggle('is-active',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
      btn.setAttribute('data-reviewed',on?'true':'false');
      btn.setAttribute('aria-label','Mark '+(file||'file')+(on?' unreviewed':' reviewed'));
      btn.setAttribute('title',(on?'Mark unreviewed':'Mark reviewed')+' (V)');
      var label=$('[data-viewed-label]',btn);if(label)label.textContent=on?'Reviewed':'Mark reviewed';
    });
    var prog=$('[data-viewed-progress]');
    if(prog)prog.textContent=n+' of '+total+' reviewed';
  }
  function clearGapError(gap){
    var error=$('.ds-gaperror',gap);if(error&&error.parentNode)error.parentNode.removeChild(error);gap.classList.remove('is-error');
  }
  function showGapError(gap,mode,err){
    var restoreFocus=gap.contains(document.activeElement);
    clearGapError(gap);gap.classList.add('is-error');gap.setAttribute('aria-busy','false');
    var status=document.createElement('span');status.className='ds-gaperror';status.setAttribute('role','alert');
    var message=document.createElement('span');message.textContent='Could not load hidden context. '+diffFailureDetail(err);
    var retry=document.createElement('button');retry.type='button';retry.className='ds-gapbtn ds-gapretry';if(err&&err.reloadRequired){retry.setAttribute('data-review-reload','');retry.textContent='Reload review';retry.setAttribute('aria-label','Reload review with current evidence');}else{retry.setAttribute('data-expand',mode);retry.textContent='Retry';retry.setAttribute('aria-label','Retry loading hidden context');}
    status.appendChild(message);status.appendChild(retry);gap.appendChild(status);
    if(restoreFocus){try{retry.focus({preventScroll:true});}catch(e){retry.focus();}}
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
    clearGapError(gap);gap.setAttribute('aria-busy','true');
    var rf,rt;
    if(mode==='all'){rf=from;rt=eof?'eof':to;}
    else if(mode==='down'){rf=from;rt=eof?(from+19):Math.min(to,from+19);}
    else{rf=Math.max(from,to-19);rt=to;}
    var holder=closest(gap,'.ds-filepanel')||closest(gap,'.ds-diff');
    var layout=closest(gap,'[data-split-inner]')?'split':'unified';
    var btns=[].slice.call(gap.querySelectorAll('.ds-gapbtn'));
    btns.forEach(function(b){b.disabled=true;});
    fetch(reviewPageUrl('/api/diff/context?file='+encodeURIComponent(file)+'&from='+rf+'&to='+rt+'&layout='+layout))
      .then(diffResponseText)
      .then(function(html){
        gap.setAttribute('aria-busy','false');
        var tmp=document.createElement('div');tmp.innerHTML=html;
        var wrap=tmp.firstElementChild;
        if(!wrap||!wrap.hasAttribute('data-ctx-rows'))throw new Error('Unexpected context response');
        if(!wrap.children.length){gap.remove();if(holder)updateChangeNav(holder);return;}
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
      .catch(function(err){
        btns.forEach(function(b){b.disabled=false;});
        showGapError(gap,mode,err);
      });
  }
`;
