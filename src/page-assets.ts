// Inlined CSS + client JS for the diffStory review page. Kept as plain strings
// (no backticks, no ${} in the JS) so they drop straight into the render template
// literal. The client only ever sets textContent, builds nodes with createElement,
// or injects server-escaped HTML from /api/fullfile — so there is no injection sink.

export const PAGE_CSS = `
:root{
  --bg:#0e0f13; --panel:#15171c; --panel2:#16181d; --panel3:#121419; --panel4:#181a20;
  --line:rgba(255,255,255,0.08); --line-soft:rgba(255,255,255,0.05);
  --text:#e7e8ec; --muted:#9ba1ad; --dim:#7a818c; --dim2:#6a7079; --faint:#565c66;
  --accent:oklch(0.7 0.13 235); --accent-hi:oklch(0.74 0.13 235); --accent-soft:rgba(96,150,255,0.16);
  --accent-text:#bcd0ff; --accent-blue:#8fb4ff;
  --add:#5ed27a; --add-bg:rgba(46,160,67,0.1); --add-bd:#56b96a; --add-text:#cfe6d6;
  --del:#e0716c; --del-bg:rgba(248,81,73,0.1); --del-text:#f0b3af;
  --amber:#e0b34d; --amber-soft:rgba(224,179,77,0.1); --amber-text:#e7d6a8;
  --green:oklch(0.74 0.16 150);
  --mono:ui-monospace,Menlo,Consolas,"SF Mono",monospace;
  --sans:'Helvetica Neue',Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;-webkit-font-smoothing:antialiased;
  display:flex;flex-direction:column;height:100vh;overflow:hidden}
body.ds-noscroll{overflow:hidden}
button{font-family:inherit}
a{color:inherit;text-decoration:none}
::selection{background:rgba(96,150,255,0.32)}
::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.11);border-radius:8px;border:3px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.2);background-clip:content-box}
@keyframes dsIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}

/* ---- header ---- */
.ds-top{height:54px;flex:none;display:flex;align-items:center;gap:15px;padding:0 18px;
  border-bottom:1px solid var(--line);background:#101217;z-index:5}
.ds-brand{display:flex;align-items:center;gap:9px}
.ds-mark{display:block}
.ds-word{font-size:15.5px;letter-spacing:0.01em}
.ds-word-a{color:#8a909b;font-weight:500}
.ds-word-b{color:#f0f1f4;font-weight:600}
.ds-vsep{width:1px;height:24px;background:rgba(255,255,255,0.1)}
.ds-titlewrap{display:flex;flex-direction:column;min-width:0;flex:1 1 auto;gap:1px}
.ds-kicker{display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:0.09em;text-transform:uppercase;color:var(--dim2);font-weight:700}
.ds-kicker .ds-dim{color:var(--faint);font-weight:600}
.ds-change{font-size:11px;color:var(--dim);font-family:var(--mono);text-transform:none;letter-spacing:0}
.ds-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f0f1f4}
.ds-status{display:flex;align-items:center;gap:8px;flex:none}
.ds-open{display:flex;align-items:center;gap:7px;font-size:12px;color:#cdd2da;padding:7px 11px;border-radius:8px;background:rgba(255,255,255,0.05)}
.ds-open b{font-variant-numeric:tabular-nums;font-weight:600}
.ds-dot{width:5px;height:5px;border-radius:50%;background:var(--faint);flex:none;display:inline-block}
.ds-dot-amber{width:6px;height:6px;background:var(--amber)}
.ds-trustpill{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:500;color:var(--amber-text);
  padding:7px 11px;border-radius:8px;border:1px solid rgba(224,179,77,0.32);background:rgba(224,179,77,0.08);cursor:pointer}
.ds-trustpill:hover{background:rgba(224,179,77,0.14)}
.ds-trustpill b{font-weight:700}
.ds-trustpill .ds-tri{font-size:11px}
.ds-trustpill.is-clean{color:var(--add);border-color:rgba(46,160,67,0.32);background:rgba(46,160,67,0.08)}
.ds-trustpill.is-clean:hover{background:rgba(46,160,67,0.14)}
.ds-check{font-size:12px}
.ds-actions{display:flex;align-items:center;gap:9px}
.ds-btn{font-size:13px;font-weight:500;border-radius:9px;cursor:pointer;border:1px solid transparent}
.ds-btn-ghost{color:#cdd2da;padding:9px 15px;border-color:rgba(255,255,255,0.16);background:transparent}
.ds-btn-ghost:hover{background:rgba(255,255,255,0.06)}
.ds-btn-approve{display:flex;align-items:center;gap:7px;font-weight:600;color:#0a1f12;padding:9px 17px;border:none;background:var(--green)}
.ds-btn-approve:hover{background:oklch(0.78 0.16 150)}
.ds-btn-approve:disabled{opacity:0.4;cursor:not-allowed}
.ds-btn-solid{font-weight:600;color:#0a1322;padding:7px 13px;border:none;background:var(--accent)}
.ds-btn-solid:hover{background:var(--accent-hi)}

/* ---- layout ---- */
.ds-layout{flex:1;display:flex;min-height:0}
.ds-rail{width:316px;flex:none;display:flex;flex-direction:column;border-right:1px solid var(--line);background:var(--panel);min-height:0}
.ds-railpad{padding:12px 12px 0;flex:none}
.ds-viewtoggle{display:flex;gap:3px;padding:3px;border-radius:9px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07)}
.ds-tab{flex:1;text-align:center;font-size:12.5px;font-weight:600;padding:6px 14px;border-radius:7px;border:none;cursor:pointer;background:transparent;color:var(--muted)}
.ds-tab.is-active{background:var(--accent-soft);color:var(--accent-text)}
.ds-readhead{position:relative;padding:11px 14px 12px;border-bottom:1px solid var(--line-soft);flex:none}
.ds-readhead-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ds-readhead-label{font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim2);font-weight:600}
.ds-readhead-count{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:500}
.ds-readhead-track{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,0.06)}
.ds-readhead-fill{height:100%;background:var(--accent);border-radius:99px;transition:width .25s}
.ds-railscroll{flex:1;overflow-y:auto;padding:8px 12px 8px 0}
.ds-railsteps{position:relative}
.ds-spine{position:absolute;left:34px;top:22px;bottom:22px;width:2px;background:rgba(255,255,255,0.08)}
.ds-stepcard{display:grid;grid-template-columns:58px 1fr;align-items:start;width:100%;text-align:left;border:none;cursor:pointer;
  padding:13px 14px 14px 0;margin-bottom:4px;border-radius:11px;transition:background .12s;background:transparent}
.ds-stepcard:hover{background:rgba(255,255,255,0.035)}
.ds-stepcard.is-active{background:rgba(255,255,255,0.05)}
.ds-num{grid-column:1;width:22px;height:22px;margin:1px 0 0 23px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;position:relative;z-index:1;
  background:var(--panel);border:1.5px solid rgba(255,255,255,0.16);color:var(--muted)}
.ds-stepcard.is-done .ds-num{background:rgba(46,160,67,0.18);border-color:rgba(46,160,67,0.55);color:var(--add)}
.ds-stepcard.is-active .ds-num{background:var(--accent);border-color:var(--accent);color:#0a0c10;box-shadow:0 0 0 4px rgba(96,150,255,0.16)}
.ds-stepcard-body{grid-column:2;min-width:0;display:flex;flex-direction:column;gap:3px}
.ds-stepcard-title{font-size:13px;font-weight:600;color:#cdd2da;line-height:1.32;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ds-stepcard.is-active .ds-stepcard-title{color:#fff}
.ds-stepcard-file{font-family:var(--mono);font-size:11px;color:var(--dim);overflow-wrap:anywhere;line-height:1.35}
.ds-stepcard-tags{display:flex;align-items:center;gap:7px;margin-top:4px;flex-wrap:wrap}
.ds-flowchip{display:flex;align-items:center;gap:4px;font-size:10.5px;color:var(--dim);padding:2px 7px;border-radius:5px;background:rgba(255,255,255,0.04)}
.ds-flowico{color:var(--dim2);font-size:9px}
.ds-badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;letter-spacing:0.02em;white-space:nowrap}
.ds-badge-changed{background:rgba(120,160,255,0.13);color:#9db8ff}
.ds-badge-new{background:rgba(46,160,67,0.16);color:var(--add)}
.ds-badge-context{background:rgba(255,255,255,0.05);color:var(--muted)}
.ds-trustcard{flex:none;margin:10px 12px 12px;display:flex;gap:11px;align-items:flex-start;padding:13px;border-radius:11px;
  border:1px solid rgba(224,179,77,0.3);background:rgba(224,179,77,0.07);text-align:left;cursor:pointer}
.ds-trustcard:hover{background:rgba(224,179,77,0.11)}
.ds-trustcard.is-clean{border-color:rgba(46,160,67,0.3);background:rgba(46,160,67,0.07)}
.ds-trustcard.is-clean:hover{background:rgba(46,160,67,0.11)}
.ds-trustcard-ico{flex:none;width:26px;height:26px;border-radius:7px;background:rgba(224,179,77,0.16);display:flex;align-items:center;justify-content:center;color:var(--amber);font-size:13px}
.ds-trustcard.is-clean .ds-trustcard-ico{background:rgba(46,160,67,0.16);color:var(--add)}
.ds-trustcard-body{min-width:0}
.ds-trustcard-title{font-size:12.5px;font-weight:600;color:var(--amber-text)}
.ds-trustcard.is-clean .ds-trustcard-title{color:#bfe6cb}
.ds-trustcard-sub{font-size:11.5px;color:#b9a878;margin-top:2px;line-height:1.4}
.ds-trustcard.is-clean .ds-trustcard-sub{color:#8fb89c}

/* ---- main / story tour ---- */
.ds-main{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--bg)}
.ds-view{flex:1;min-height:0;display:flex;flex-direction:column}
.ds-view[hidden]{display:none}
.ds-step{flex:1;min-height:0;display:flex;flex-direction:column}
.ds-step[hidden]{display:none}
.ds-step-top{padding:20px 30px 0;flex:none}
.ds-step-meta{display:flex;align-items:center;gap:10px;margin-bottom:11px}
.ds-step-count{font-size:11.5px;color:var(--dim2);font-variant-numeric:tabular-nums}
.ds-flex{flex:1}
.ds-step-pos{font-size:11.5px;color:var(--faint);font-variant-numeric:tabular-nums;margin-right:2px}
.ds-nav{display:flex;gap:6px}
.ds-iconbtn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:15px;border-radius:8px;
  border:1px solid rgba(255,255,255,0.12);background:transparent;color:#cdd2da;cursor:pointer}
.ds-iconbtn:hover{background:rgba(255,255,255,0.07)}
.ds-iconbtn:disabled{opacity:0.32;cursor:default}
.ds-step-titlerow{display:flex;align-items:baseline;gap:13px;flex-wrap:wrap}
.ds-step-title{font-size:19px;font-weight:600;margin:0;letter-spacing:-0.01em;color:#f0f1f4;line-height:1.3}
.ds-step-file{font-family:var(--mono);font-size:12.5px;color:var(--muted);overflow-wrap:anywhere;min-width:0}
.ds-step-file:hover{color:var(--accent-blue);text-decoration:underline}
.ds-why{margin:17px 30px 0;padding:15px 17px;border-radius:13px;background:rgba(96,150,255,0.07);border:1px solid rgba(96,150,255,0.2);flex:none}
.ds-why-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.ds-why-ico{width:15px;height:15px;border-radius:4px;background:rgba(96,150,255,0.2);display:flex;align-items:center;justify-content:center;position:relative}
.ds-why-ico::after{content:'';width:5px;height:5px;border-radius:50%;background:var(--accent-blue)}
.ds-why-label{font-size:10.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--accent-blue);font-weight:600}
.ds-why-text{margin:0;font-size:14px;line-height:1.58;color:#d6d9df;text-wrap:pretty}
.ds-diffscroll{flex:1;overflow-y:auto;padding:18px 30px 26px}

/* ---- diff ---- */
.ds-diff{border:1px solid var(--line);border-radius:13px;overflow:hidden;background:var(--panel3)}
.ds-difftoolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.07);background:var(--panel2)}
.ds-difthint{font-size:11px;color:var(--dim)}
.ds-commenthint{font-size:11px;color:var(--accent-blue);display:flex;align-items:center;gap:6px;white-space:nowrap;margin-left:auto;margin-right:12px}
.ds-commenthint b{color:var(--accent-blue)}
.ds-commenthint-ico{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:5px;background:var(--accent);color:#0a1322;font-weight:700;font-size:13px;line-height:1}
.ds-modetoggle{display:flex;gap:2px;padding:2px;border-radius:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.06)}
.ds-modetoggle button{font-size:11px;font-weight:600;padding:4px 11px;border-radius:6px;border:none;cursor:pointer;background:transparent;color:var(--muted)}
.ds-modetoggle button.is-active{background:var(--accent-soft);color:var(--accent-text)}
.ds-diffhead{display:flex;background:var(--panel2);border-bottom:1px solid rgba(255,255,255,0.07)}
.ds-diffhead-ctx{justify-content:space-between;align-items:center;padding:9px 14px}
.ds-diffhead-side{flex:1;display:flex;align-items:center;gap:9px;padding:9px 14px}
.ds-diffhead-ctx .ds-diffhead-side{padding:0}
.ds-diffhead-label{font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#828a96}
.ds-diffhead-label.ds-dim{color:var(--dim2)}
.ds-diffhead-label.ds-green{color:var(--add)}
.ds-diffhead-path{font-family:var(--mono);font-size:11.5px;color:var(--dim)}
.ds-diffhead-divider{width:1px;background:rgba(255,255,255,0.06)}
.ds-diffhead-note{font-size:11px;color:var(--dim2)}
.ds-diffbody{font-family:var(--mono);font-size:12.5px}
.ds-diffbody-unified{font-size:12px;line-height:1.5;background:var(--panel3)}
.ds-hunkgap{padding:2px 14px;background:#0f1115;color:#454a52;font-size:11px;font-family:var(--mono);border-top:1px solid rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.04)}
.ds-row{display:flex;position:relative;border-bottom:1px solid rgba(255,255,255,0.03)}
.ds-cell{flex:1;min-width:0;display:flex;align-items:flex-start}
.ds-cell-single{flex:1}
.ds-cell-add{background:var(--add-bg)}
.ds-cell-del{background:var(--del-bg)}
.ds-cell-untoured{background:rgba(224,179,77,0.12)}
.ds-cell-empty{flex:1;min-width:0;align-self:stretch;background-color:rgba(255,255,255,0.012);
  background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0.022) 0,rgba(255,255,255,0.022) 1px,transparent 1px,transparent 7px)}
.ds-celldiv{width:1px;flex:none;background:rgba(255,255,255,0.06)}
.ds-no{width:38px;flex:none;text-align:right;padding:4px 8px 4px 0;color:var(--faint);user-select:none;font-variant-numeric:tabular-nums}
.ds-sign{width:12px;flex:none;text-align:center;padding:4px 0;color:var(--faint);user-select:none}
.ds-sign-add{color:var(--add-bd)}
.ds-sign-del{color:var(--del)}
.ds-code{flex:1;min-width:0;padding:4px 14px 4px 4px;color:#c8ccd4;white-space:pre-wrap;overflow-wrap:anywhere}
.ds-code-add{color:var(--add-text)}
.ds-code-del{color:var(--del-text)}
.ds-untoured-tag{flex:none;align-self:center;font-size:9px;font-weight:700;letter-spacing:0.03em;color:#0e0f13;background:var(--amber);padding:1px 6px;border-radius:4px;margin:0 9px}
.ds-addcomment{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:6px;border:none;cursor:pointer;
  display:flex;align-items:center;justify-content:center;background:var(--accent);color:#0a1322;font-size:15px;font-weight:700;line-height:1;box-shadow:0 2px 8px rgba(0,0,0,0.35);z-index:3;
  opacity:0.28;transition:opacity .12s,transform .12s}
.ds-row:hover .ds-addcomment{opacity:1;transform:translateY(-50%) scale(1.08)}
.ds-addcomment:hover{opacity:1}
.ds-urow{display:flex;align-items:flex-start}
.ds-urow.ds-row-add{background:rgba(46,160,67,0.09)}
.ds-urow.ds-row-del{background:rgba(248,81,73,0.09)}
.ds-urow.is-untoured{background:rgba(224,179,77,0.1);border-left:2px solid var(--amber)}
.ds-urow .ds-no{width:40px}
.ds-urow .ds-code{padding:2px 12px 2px 4px}
.ds-urow .ds-no,.ds-urow .ds-sign{padding-top:2px;padding-bottom:2px}
/* syntax highlighting — the line background still marks add/del */
.ds-code .tk-k{color:#c79bff}
.ds-code .tk-t{color:#6fd2c2}
.ds-code .tk-f{color:#8fb4ff}
.ds-code .tk-s{color:#b7d59b}
.ds-code .tk-n{color:#e8a87c}
.ds-code .tk-c{color:#727a86;font-style:italic}
.ds-diffnote{padding:14px 16px;color:var(--muted);font-family:var(--sans);font-size:13px}
.ds-diffnote-soft{color:var(--dim2);font-size:12px;border-bottom:1px solid var(--line-soft)}

/* ---- comments ---- */
.ds-thread{}
.ds-comment{padding:12px 16px 14px 50px;background:#14161b;border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);
  font-family:var(--sans);animation:dsIn .18s ease}
.ds-comment-card{border:1px solid rgba(255,255,255,0.1);border-radius:11px;overflow:hidden;background:var(--panel4)}
.flavor-change{border-color:rgba(248,120,113,0.45)}
.flavor-question{border-color:rgba(96,150,255,0.5)}
.flavor-nit{border-color:rgba(224,179,77,0.45)}
.ds-comment-head{display:flex;align-items:center;gap:9px;padding:10px 13px;border-bottom:1px solid var(--line-soft)}
.flavor-change .ds-comment-head{background:rgba(248,120,113,0.12)}
.flavor-question .ds-comment-head{background:rgba(96,150,255,0.12)}
.flavor-nit .ds-comment-head{background:rgba(224,179,77,0.12)}
.ds-flavor-ico{width:18px;height:18px;border-radius:5px;color:#10121a;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
.flavor-change .ds-flavor-ico{background:rgba(248,120,113,0.45)}
.flavor-question .ds-flavor-ico{background:rgba(96,150,255,0.5)}
.flavor-nit .ds-flavor-ico{background:rgba(224,179,77,0.45)}
.ds-flavor-label{font-size:12px;font-weight:600}
.flavor-change .ds-flavor-label{color:#f0a39e}
.flavor-question .ds-flavor-label{color:var(--accent-text)}
.flavor-nit .ds-flavor-label{color:var(--amber-text)}
.ds-comment-author{font-size:12px;color:#cdd2da;font-weight:500}
.ds-statusbadge{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:6px}
.status-open .ds-statusbadge{color:var(--amber);background:rgba(224,179,77,0.12)}
.status-open .ds-statusbadge .ds-dot{background:var(--amber)}
.status-addressed .ds-statusbadge{color:var(--accent-blue);background:rgba(96,150,255,0.12)}
.status-addressed .ds-statusbadge .ds-dot{background:var(--accent-blue)}
.status-resolved .ds-statusbadge{color:var(--add);background:rgba(46,160,67,0.14)}
.status-resolved .ds-statusbadge .ds-dot{background:var(--add)}
.ds-comment-body{padding:11px 13px;font-size:13px;line-height:1.55;color:#d6d9df;white-space:pre-wrap}
.ds-reply{display:flex;gap:10px;padding:11px 13px;border-top:1px solid var(--line-soft);background:rgba(96,150,255,0.04)}
.ds-reply-av{flex:none;width:24px;height:24px;border-radius:7px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0a1322}
.ds-reply-main{min-width:0}
.ds-reply-who{display:flex;align-items:center;gap:7px;margin-bottom:3px}
.ds-reply-name{font-size:12px;font-weight:600;color:var(--accent-blue)}
.ds-ai-badge{font-size:9.5px;font-weight:700;letter-spacing:0.04em;color:var(--accent-blue);background:rgba(96,150,255,0.14);padding:1px 6px;border-radius:4px}
.ds-reply-body{font-size:12.5px;line-height:1.55;color:#c4c8d0;white-space:pre-wrap}
.ds-comment-actions{display:flex;gap:8px;padding:4px 13px 12px}
.ds-ghost{font-size:12px;font-weight:500;color:#cdd2da;padding:6px 12px;border-radius:7px;border:1px solid rgba(255,255,255,0.13);background:transparent;cursor:pointer}
.ds-ghost:hover{background:rgba(255,255,255,0.05)}
.ds-composer{padding:12px 16px 14px 50px;background:#14161b;border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);
  font-family:var(--sans);animation:dsIn .15s ease}
.ds-composer-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.ds-composer-tab{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:6px 11px;border-radius:8px;cursor:pointer;
  border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--muted)}
.ds-composer-tab .ds-flavor-ico{background:rgba(255,255,255,0.1);color:var(--muted)}
.ds-composer-tab[data-flavor="change"].is-active{border-color:rgba(248,120,113,0.45);background:rgba(248,120,113,0.12);color:#f0a39e}
.ds-composer-tab[data-flavor="question"].is-active{border-color:rgba(96,150,255,0.5);background:rgba(96,150,255,0.12);color:var(--accent-text)}
.ds-composer-tab[data-flavor="nit"].is-active{border-color:rgba(224,179,77,0.45);background:rgba(224,179,77,0.12);color:var(--amber-text)}
.ds-composer-tab[data-flavor="change"].is-active .ds-flavor-ico{background:rgba(248,120,113,0.45);color:#10121a}
.ds-composer-tab[data-flavor="question"].is-active .ds-flavor-ico{background:rgba(96,150,255,0.5);color:#10121a}
.ds-composer-tab[data-flavor="nit"].is-active .ds-flavor-ico{background:rgba(224,179,77,0.45);color:#10121a}
.ds-composer-ta{width:100%;box-sizing:border-box;resize:vertical;background:#0f1115;border:1px solid rgba(255,255,255,0.13);border-radius:8px;
  padding:9px 11px;color:var(--text);font-size:13px;font-family:var(--sans);line-height:1.5;outline:none}
.ds-composer-ta:focus{border-color:rgba(96,150,255,0.5)}
.ds-composer-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}

/* ---- all files ---- */
.ds-fileshead{flex:none;padding:19px 30px 15px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line-soft)}
.ds-fileshead-l{min-width:0}
.ds-fileshead-title{font-size:18px;font-weight:600;margin:0 0 7px;color:#f0f1f4;letter-spacing:-0.01em}
.ds-fileshead-stats{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.ds-stat-add{font-family:var(--mono);color:var(--add);font-variant-numeric:tabular-nums}
.ds-stat-del{font-family:var(--mono);color:var(--del);font-variant-numeric:tabular-nums}
.ds-stat-untoured{display:flex;align-items:center;gap:5px;color:var(--amber)}
.ds-fileshead-r{display:flex;gap:8px;flex:none;align-items:center}
.ds-fileshint{font-size:12px;color:var(--dim2)}
.ds-filedetail{flex:1;overflow-y:auto;background:var(--panel3)}
.ds-filepanel{display:flex;flex-direction:column;min-height:100%}
.ds-filepanel[hidden]{display:none}
.ds-filepanel-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:11px;padding:12px 30px;background:var(--panel2);border-bottom:1px solid var(--line)}
.ds-filepanel-body{flex:1;padding-bottom:40px}
.ds-cardpath{font-family:var(--mono);font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-cardpath .ds-dim{color:var(--dim)}
.ds-cardpath-base{color:var(--text);font-weight:600}
.ds-untoured-badge{flex:none;display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;background:rgba(224,179,77,0.13);color:var(--amber)}
.ds-untoured-badge .ds-tri{font-size:9px}
.ds-stepchip{flex:none;font-size:11px;color:var(--muted);padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:transparent;cursor:pointer}
.ds-stepchip:hover{background:rgba(255,255,255,0.05);color:var(--text)}
.ds-cardstat{flex:none;display:flex;gap:8px;font-family:var(--mono);font-size:12px;font-variant-numeric:tabular-nums;justify-content:flex-end}

/* ---- sidebar file list (All files view) ---- */
.ds-railfiles{padding:6px 12px 8px 14px}
.ds-railfiles[hidden]{display:none}
.ds-fileitem{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:none;background:transparent;cursor:pointer;padding:8px 10px;border-radius:8px;font-family:var(--sans);margin-bottom:1px}
.ds-fileitem:hover{background:rgba(255,255,255,0.04)}
.ds-fileitem.is-active{background:rgba(255,255,255,0.05)}
.ds-fileitem.is-untoured{box-shadow:inset 2px 0 0 var(--amber)}
.ds-fileitem-dot{flex:none;width:8px;height:8px;border-radius:2px}
.ds-fileitem-dot.k-changed{background:#9db8ff}
.ds-fileitem-dot.k-new{background:var(--add)}
.ds-fileitem-dot.k-context{background:var(--muted)}
.ds-fileitem-path{flex:1;min-width:0;font-family:var(--mono);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-fileitem-path .ds-dim{color:var(--dim)}
.ds-fileitem-base{color:var(--text);font-weight:600}
.ds-fileitem-flag{flex:none;color:var(--amber);font-size:9px}
.ds-fileitem-stat{flex:none;font-family:var(--mono);font-size:11.5px;font-variant-numeric:tabular-nums;display:flex;gap:6px}
.ds-empty-rail{padding:24px 14px;font-size:12.5px}

/* ---- trust drawer ---- */
.ds-drawer-root{position:fixed;inset:0;z-index:50}
.ds-drawer-root[hidden]{display:none}
.ds-drawer-scrim{position:absolute;inset:0;background:rgba(8,9,12,0.62);animation:dsIn .15s ease}
.ds-drawer{position:absolute;top:0;right:0;width:440px;max-width:92vw;height:100%;background:var(--panel);border-left:1px solid rgba(255,255,255,0.1);
  display:flex;flex-direction:column;box-shadow:-30px 0 60px rgba(0,0,0,0.4);animation:dsIn .18s ease}
.ds-drawer-head{padding:20px 22px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.ds-drawer-title{font-size:16px;font-weight:600;color:#f0f1f4}
.ds-drawer-sub{font-size:12.5px;color:#828a96;margin-top:4px;line-height:1.45;text-wrap:pretty}
.ds-drawer-x{flex:none;width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--muted);cursor:pointer;font-size:16px}
.ds-drawer-x:hover{background:rgba(255,255,255,0.05)}
.ds-drawer-body{padding:18px 22px;overflow-y:auto;flex:1}
.ds-trust-stats{display:flex;gap:10px;margin-bottom:20px}
.ds-trust-stat{flex:1;padding:13px;border-radius:11px}
.ds-trust-stat.ok{background:rgba(46,160,67,0.08);border:1px solid rgba(46,160,67,0.22)}
.ds-trust-stat.warn{background:rgba(224,179,77,0.08);border:1px solid rgba(224,179,77,0.26)}
.ds-trust-num{font-size:23px;font-weight:600;font-variant-numeric:tabular-nums}
.ds-trust-stat.ok .ds-trust-num{color:var(--add)}
.ds-trust-stat.warn .ds-trust-num{color:var(--amber)}
.ds-trust-lbl{font-size:11.5px;margin-top:2px;line-height:1.35}
.ds-trust-stat.ok .ds-trust-lbl{color:#9ab8a4}
.ds-trust-stat.warn .ds-trust-lbl{color:#b9a878}
.ds-trust-section{font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim2);font-weight:600;margin-bottom:11px}
.ds-trust-card{border:1px solid rgba(224,179,77,0.3);border-radius:12px;overflow:hidden;margin-bottom:14px}
.ds-trust-card-head{padding:12px 14px;background:rgba(224,179,77,0.06);display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(224,179,77,0.18)}
.ds-trust-card-path{font-family:var(--mono);font-size:12px;color:var(--amber-text)}
.ds-trust-card .ds-diffbody-unified{background:transparent}
.ds-trust-card-note{padding:12px 14px;font-size:12.5px;color:#b3b8c0;line-height:1.5;text-wrap:pretty;border-top:1px solid var(--line-soft)}
.ds-trust-card-actions{padding:0 14px 14px;display:flex;gap:9px}
.ds-trust-clean{padding:16px;border-radius:12px;background:rgba(46,160,67,0.08);border:1px solid rgba(46,160,67,0.22);color:#bfe6cb;font-size:13px;line-height:1.5}
.ds-trust-foot{margin-top:18px;font-size:12px;color:var(--dim2);line-height:1.5;text-wrap:pretty}

/* ---- misc ---- */
.ds-empty{padding:60px 40px;text-align:center;color:var(--muted)}
.ds-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);max-width:540px;
  background:#1b1e25;border:1px solid rgba(255,255,255,0.14);color:#e7e8ec;font-size:13px;line-height:1.45;
  padding:12px 16px;border-radius:11px;box-shadow:0 12px 40px rgba(0,0,0,0.5);opacity:0;transition:opacity .2s,transform .2s;z-index:80;pointer-events:none}
.ds-toast.is-show{opacity:1;transform:translateX(-50%) translateY(0)}
.ds-green{color:var(--add)}
`;

// No backticks and no ${} below — safe to embed in a template literal.
export const PAGE_JS = `
(function(){
  var API='/api/comments';
  var BRAND='diffStory';
  var FLAVOR={change:{label:'Change request',ico:'◆'},question:{label:'Question',ico:'?'},nit:{label:'Nit',ico:'○'}};
  var STATUS={open:'Open',addressed:'Addressed',resolved:'Resolved'};
  var tourView,filesView,drawer,toastEl,stepPanels,stepCards,total=1,active=0,visited={0:true},toastTimer;
  var filePanels=[],fileItems=[],selectedFile=-1;

  function $(s,r){return (r||document).querySelector(s);}
  function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function closest(n,s){return n&&n.closest?n.closest(s):null;}
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}

  function setView(v){
    if(tourView)tourView.hidden=v!=='tour';
    if(filesView)filesView.hidden=v!=='files';
    $all('.ds-tab').forEach(function(t){t.classList.toggle('is-active',t.getAttribute('data-view')===v);});
    $all('[data-rail]').forEach(function(r){r.hidden=r.getAttribute('data-rail')!==v;});
    if(v==='files'&&selectedFile<0)selectFile(0);
  }

  function setActive(i){
    if(i<0)i=0;if(i>total-1)i=total-1;active=i;visited[i]=true;
    stepPanels.forEach(function(p,idx){p.hidden=idx!==i;});
    stepCards.forEach(function(c,idx){
      var isA=idx===i,isD=visited[idx]&&!isA;
      c.classList.toggle('is-active',isA);
      c.classList.toggle('is-done',isD);
      var num=$('.ds-num',c);if(num)num.textContent=isD?'✓':String(idx+1);
    });
    var pt=$('#ds-progress-text');if(pt)pt.textContent=(i+1)+' / '+total;
    var pf=$('#ds-progress-fill');if(pf)pf.style.width=(total?((i+1)/total*100):0)+'%';
    if(tourView)tourView.scrollTop=0;
  }

  function selectFile(i){
    if(!filePanels.length)return;
    if(i<0)i=0;if(i>filePanels.length-1)i=filePanels.length-1;
    selectedFile=i;
    filePanels.forEach(function(p,idx){p.hidden=idx!==i;});
    fileItems.forEach(function(it,idx){it.classList.toggle('is-active',idx===i);});
    var panel=filePanels[i],fullInner=$('[data-full-inner]',panel);
    if(fullInner&&!fullInner.hidden&&!fullInner.getAttribute('data-loaded')){
      var file=panel.getAttribute('data-file');if(file)loadFull(fullInner,file);
    }
    var detail=$('#ds-file-detail');if(detail)detail.scrollTop=0;
  }
  function selectFileByPath(file){
    for(var k=0;k<filePanels.length;k++){if(filePanels[k].getAttribute('data-file')===file){selectFile(k);return;}}
  }

  function setMode(btn){
    var holder=closest(btn,'.ds-filepanel')||closest(btn,'.ds-diff');if(!holder)return;
    var file=holder.getAttribute('data-file');
    var mode=btn.getAttribute('data-mode');
    $all('.ds-modetoggle button',holder).forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-mode')===mode);});
    var diffInner=$('[data-diff-inner]',holder),fullInner=$('[data-full-inner]',holder),hint=$('[data-difthint]',holder);
    if(mode==='full'){
      if(hint){if(!hint.getAttribute('data-diffhint'))hint.setAttribute('data-diffhint',hint.textContent);hint.textContent='Complete file';}
      if(fullInner&&!fullInner.getAttribute('data-loaded')&&file)loadFull(fullInner,file);
      if(diffInner)diffInner.hidden=true;if(fullInner)fullInner.hidden=false;
    }else{
      if(hint&&hint.getAttribute('data-diffhint'))hint.textContent=hint.getAttribute('data-diffhint');
      if(fullInner)fullInner.hidden=true;if(diffInner)diffInner.hidden=false;
    }
  }
  function loadFull(fullInner,file){
    fullInner.setAttribute('data-loaded','1');
    fullInner.innerHTML='<div class="ds-diffnote">Loading the full file…</div>';
    fetch('/api/fullfile?file='+encodeURIComponent(file)).then(function(r){return r.text();}).then(function(html){fullInner.innerHTML=html;}).catch(function(){fullInner.removeAttribute('data-loaded');fullInner.innerHTML='<div class="ds-diffnote">Could not load the full file.</div>';});
  }

  function openDrawer(){if(drawer){drawer.hidden=false;document.body.classList.add('ds-noscroll');}}
  function closeDrawer(){if(drawer){drawer.hidden=true;document.body.classList.remove('ds-noscroll');}}

  function threadAfter(row){
    var t=row.nextElementSibling;
    if(t&&t.classList&&t.classList.contains('ds-thread'))return t;
    t=el('div','ds-thread');row.parentNode.insertBefore(t,row.nextSibling);return t;
  }
  function buildComment(c){
    var f=FLAVOR[c.type]||FLAVOR.change;
    var wrap=el('div','ds-comment status-'+c.status);
    wrap.setAttribute('data-comment-id',c.id);wrap.setAttribute('data-status',c.status);if(c.reply)wrap.setAttribute('data-hasreply','1');
    var card=el('div','ds-comment-card flavor-'+c.type);
    var head=el('div','ds-comment-head');
    head.appendChild(el('span','ds-flavor-ico',f.ico));
    head.appendChild(el('span','ds-flavor-label',f.label));
    head.appendChild(el('span','ds-dot'));
    head.appendChild(el('span','ds-comment-author',c.author||'You'));
    head.appendChild(el('span','ds-flex'));
    var sb=el('span','ds-statusbadge');sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));head.appendChild(sb);
    card.appendChild(head);
    card.appendChild(el('div','ds-comment-body',c.body));
    var actions=el('div','ds-comment-actions');
    var rb=el('button','ds-ghost',c.status==='resolved'?'Reopen':'Resolve');rb.setAttribute('data-resolve','');actions.appendChild(rb);
    var db=el('button','ds-ghost ds-del','Delete');db.setAttribute('data-delete','');actions.appendChild(db);
    card.appendChild(actions);wrap.appendChild(card);return wrap;
  }
  function buildComposer(row){
    var file=row.getAttribute('data-file'),line=row.getAttribute('data-line'),step=row.getAttribute('data-step');
    var box=el('div','ds-composer'),state={flavor:'change'};
    var tabs=el('div','ds-composer-tabs');
    ['change','question','nit'].forEach(function(v){
      var f=FLAVOR[v],b=el('button','ds-composer-tab'+(v==='change'?' is-active':''));
      b.setAttribute('data-flavor',v);
      b.appendChild(el('span','ds-flavor-ico',f.ico));
      b.appendChild(document.createTextNode(f.label));
      b.onclick=function(){state.flavor=v;$all('.ds-composer-tab',tabs).forEach(function(x){x.classList.remove('is-active');});b.classList.add('is-active');};
      tabs.appendChild(b);
    });
    var ta=el('textarea','ds-composer-ta');ta.placeholder='Leave a comment on this line… '+BRAND+' replies when you run /address-review.';ta.rows=3;
    var bar=el('div','ds-composer-actions');
    var cancel=el('button','ds-ghost','Cancel');cancel.onclick=function(){removeComposer(box);};
    var submit=el('button','ds-btn ds-btn-solid','Comment');
    submit.onclick=function(){
      var body=ta.value.trim();if(!body)return;submit.disabled=true;
      fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:file,line:Number(line),step:step,type:state.flavor,body:body})})
        .then(function(r){return r.json();}).then(function(c){
          if(!c||!c.id){submit.disabled=false;return;}
          threadAfter(row).appendChild(buildComment(c));removeComposer(box);refreshCount();
        }).catch(function(){submit.disabled=false;});
    };
    bar.appendChild(cancel);bar.appendChild(submit);
    box.appendChild(tabs);box.appendChild(ta);box.appendChild(bar);return box;
  }
  function removeComposer(box){var b=box||$('.ds-composer');if(b&&b.parentNode)b.parentNode.removeChild(b);}
  function openComposer(row){
    removeComposer();if(!row.getAttribute('data-line'))return;
    var box=buildComposer(row),anchor=row,th=row.nextElementSibling;
    if(th&&th.classList&&th.classList.contains('ds-thread'))anchor=th;
    anchor.parentNode.insertBefore(box,anchor.nextSibling);
    var ta=$('.ds-composer-ta',box);if(ta)ta.focus();
  }
  function resolveComment(wrap){
    if(!wrap)return;
    var id=wrap.getAttribute('data-comment-id'),cur=wrap.getAttribute('data-status'),hasReply=wrap.getAttribute('data-hasreply');
    var target=cur==='resolved'?(hasReply?'addressed':'open'):'resolved';
    fetch(API+'/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:target})})
      .then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(c){
        wrap.setAttribute('data-status',c.status);wrap.className='ds-comment status-'+c.status;
        var sb=$('.ds-statusbadge',wrap);if(sb){sb.textContent='';sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));}
        var rb=$('[data-resolve]',wrap);if(rb)rb.textContent=c.status==='resolved'?'Reopen':'Resolve';
        refreshCount();
      }).catch(function(){});
  }
  function deleteComment(wrap){
    if(!wrap)return;var id=wrap.getAttribute('data-comment-id'),th=wrap.parentNode;
    fetch(API+'/'+encodeURIComponent(id),{method:'DELETE'}).then(function(){
      if(wrap.parentNode)wrap.parentNode.removeChild(wrap);
      if(th&&th.classList&&th.classList.contains('ds-thread')&&!th.children.length&&th.parentNode)th.parentNode.removeChild(th);
      refreshCount();
    }).catch(function(){});
  }
  function refreshCount(){
    var openN=$all('.ds-comment').length-$all('.ds-comment.status-resolved').length;
    var b=$('#ds-open-count b');if(b){b.textContent=openN;if(b.nextSibling)b.nextSibling.nodeValue=' open '+(openN===1?'comment':'comments');}
    var approve=$('[data-verdict="approve"]'),pill=$('.ds-trustpill'),clean=pill&&pill.classList.contains('is-clean');
    if(approve)approve.disabled=!(openN===0&&clean);
  }
  function verdict(kind){
    var openN=$all('.ds-comment').length-$all('.ds-comment.status-resolved').length;
    if(kind==='approve'){toast('Looks clean — every change is explained and there are no open comments. ✓');return;}
    if(openN>0)toast(openN+' open '+(openN===1?'comment':'comments')+' saved to .diffstory/comments.json — run /address-review in your agent to hand them back.');
    else toast('No open comments yet. Leave notes on the lines, then run /address-review to hand them to the agent.');
  }
  function toast(msg){
    if(!toastEl)return;toastEl.textContent=msg;toastEl.hidden=false;
    requestAnimationFrame(function(){toastEl.classList.add('is-show');});
    clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastEl.classList.remove('is-show');setTimeout(function(){toastEl.hidden=true;},220);},4200);
  }

  function onClick(e){
    var t=e.target,b;
    b=closest(t,'[data-view]');if(b){setView(b.getAttribute('data-view'));return;}
    b=closest(t,'.ds-fileitem');if(b){setView('files');selectFile(Number(b.getAttribute('data-file-index')));return;}
    b=closest(t,'.ds-addcomment');if(b){var row=closest(t,'.ds-row');if(row)openComposer(row);return;}
    b=closest(t,'[data-resolve]');if(b){resolveComment(closest(b,'.ds-comment'));return;}
    b=closest(t,'[data-delete]');if(b){deleteComment(closest(b,'.ds-comment'));return;}
    b=closest(t,'[data-mode]');if(b){setMode(b);return;}
    b=closest(t,'[data-trust-open]');if(b){openDrawer();return;}
    b=closest(t,'[data-trust-close]');if(b){closeDrawer();return;}
    b=closest(t,'[data-goto-step]');if(b){closeDrawer();setView('tour');setActive(Number(b.getAttribute('data-goto-step')));return;}
    b=closest(t,'[data-goto-file]');if(b){closeDrawer();setView('files');selectFileByPath(b.getAttribute('data-goto-file'));return;}
    b=closest(t,'[data-explain]');if(b){toast('Ask your agent to add a tour step for this change (re-run /review-tour), so '+BRAND+' narrates why it is here.');return;}
    b=closest(t,'[data-verdict]');if(b){if(b.disabled)return;verdict(b.getAttribute('data-verdict'));return;}
    b=closest(t,'.ds-stepcard');if(b){setActive(Number(b.getAttribute('data-step-index')));return;}
    b=closest(t,'[data-prev]');if(b){if(!b.disabled)setActive(active-1);return;}
    b=closest(t,'[data-next]');if(b){if(!b.disabled)setActive(active+1);return;}
  }
  function onKey(e){
    if(e.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
    if(e.key==='Escape'){closeDrawer();removeComposer();return;}
    if(drawer&&!drawer.hidden)return;
    var next=e.key==='ArrowRight'||e.key==='j',prev=e.key==='ArrowLeft'||e.key==='k';
    if(!next&&!prev)return;
    if(filesView&&!filesView.hidden)selectFile(selectedFile+(next?1:-1));
    else if(tourView&&!tourView.hidden)setActive(active+(next?1:-1));
  }
  function init(){
    tourView=$('#ds-view-tour');filesView=$('#ds-view-files');drawer=$('#ds-trust-drawer');toastEl=$('#ds-toast');
    stepPanels=$all('.ds-step');stepCards=$all('.ds-stepcard');total=stepPanels.length||1;
    filePanels=$all('.ds-filepanel');fileItems=$all('.ds-fileitem');
    document.addEventListener('click',onClick);
    document.addEventListener('keydown',onKey);
    refreshCount();
  }
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
`;
