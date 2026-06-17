// Inlined CSS + client JS for the diffStory review page. Kept as plain strings
// (no backticks, no ${} in the JS) so they drop straight into the render template
// literal. The client only ever sets textContent, builds nodes with createElement,
// or injects server-escaped HTML from /api/fullfile — so there is no injection sink.
export const PAGE_CSS = `
/* Apple Human Interface Guidelines palette. Dark is the default scheme;
   a prefers-color-scheme:light override flips the same semantic tokens.
   Colors are Apple system colors (systemBlue/Green/Red/Orange) and the
   label / fill / separator ramps; fonts are the San Francisco system stack. */
:root{
  color-scheme:light dark;
  /* accent — systemBlue */
  --accent:#0A84FF; --accent-hi:#409CFF; --accent-soft:rgba(10,132,255,0.22);
  --accent-text:#7FB5FF; --accent-blue:#64A8FF; --on-accent:#ffffff;
  /* status — systemGreen / systemRed / systemOrange */
  --add:#30D158; --add-bg:rgba(48,209,88,0.13); --add-bd:#30D158; --add-text:#86E0A1;
  --del:#FF453A; --del-bg:rgba(255,69,58,0.13); --del-text:#FF9D96;
  --amber:#FF9F0A; --amber-soft:rgba(255,159,10,0.13); --amber-text:#FFC774; --on-amber:#1c1c1e;
  --green:#30D158; --green-hi:#46DA73; --on-green:#04220f;
  /* backgrounds (windowed app: base content + grouped sidebar) */
  --bg:#17181c; --panel:#202127; --panel2:#1c1e23; --panel3:#17181c; --panel4:#25272d;
  /* label ramp — Apple base (235,235,245) */
  --text:#f5f5f7; --muted:rgba(235,235,245,0.62); --dim:rgba(235,235,245,0.42);
  --dim2:rgba(235,235,245,0.34); --faint:rgba(235,235,245,0.24);
  /* separators + system fills */
  --line:rgba(73,77,87,0.58); --line-soft:rgba(73,77,87,0.34);
  --fill-1:rgba(255,255,255,0.04); --fill-2:rgba(255,255,255,0.065); --fill-3:rgba(255,255,255,0.095);
  --hairline:rgba(255,255,255,0.055);
  --gutter:#15161a; --gutter-hi:#1a1c21; --diff-rule:#2b2e36;
  --add-rail:#12966f; --del-rail:#e0445e;
  /* materials + depth */
  --material:rgba(40,40,43,0.72); --scrim:rgba(0,0,0,0.55); --shadow:0 16px 40px rgba(0,0,0,0.5);
  --scroll:rgba(255,255,255,0.22); --scroll-hi:rgba(255,255,255,0.34);
  /* syntax (Xcode-flavored) */
  --tk-k:#C79BFF; --tk-t:#6FD2C2; --tk-f:#8FB4FF; --tk-s:#B7D59B; --tk-n:#E8A87C; --tk-c:#8A929E;
  --ds-split:50;
  --mono:"SF Mono",ui-monospace,Menlo,Monaco,"Cascadia Mono",Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;
}
@media (prefers-color-scheme:light){
  :root{
    --accent:#007AFF; --accent-hi:#0A84FF; --accent-soft:rgba(0,122,255,0.12);
    --accent-text:#0A66D6; --accent-blue:#007AFF; --on-accent:#ffffff;
    --add:#248A3D; --add-bg:rgba(52,199,89,0.16); --add-bd:#34C759; --add-text:#1B7A33;
    --del:#D70015; --del-bg:rgba(255,59,48,0.11); --del-text:#C9302C;
    --amber:#B25000; --amber-soft:rgba(255,149,0,0.14); --amber-text:#8A5200; --on-amber:#ffffff;
    --green:#34C759; --green-hi:#2DB14F; --on-green:#ffffff;
    --bg:#ffffff; --panel:#f2f2f7; --panel2:#f5f5f7; --panel3:#ffffff; --panel4:#ffffff;
    --text:#1d1d1f; --muted:rgba(60,60,67,0.62); --dim:rgba(60,60,67,0.48);
    --dim2:rgba(60,60,67,0.38); --faint:rgba(60,60,67,0.28);
    --line:rgba(60,60,67,0.24); --line-soft:rgba(60,60,67,0.13);
    --fill-1:rgba(0,0,0,0.035); --fill-2:rgba(0,0,0,0.05); --fill-3:rgba(0,0,0,0.08);
    --hairline:rgba(0,0,0,0.08);
    --material:rgba(250,250,252,0.72); --scrim:rgba(0,0,0,0.32); --shadow:0 14px 38px rgba(0,0,0,0.18);
    --scroll:rgba(0,0,0,0.22); --scroll-hi:rgba(0,0,0,0.34);
    --tk-k:#9A2EBF; --tk-t:#0E7490; --tk-f:#2563EB; --tk-s:#297A3A; --tk-n:#B45309; --tk-c:#6B7785;
  }
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;-webkit-font-smoothing:antialiased;
  display:flex;flex-direction:column;height:100vh;overflow:hidden}
body.ds-noscroll{overflow:hidden}
button{font-family:inherit}
a{color:inherit;text-decoration:none}
::selection{background:rgba(10,132,255,0.32)}
::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:8px;border:3px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:var(--scroll-hi);background-clip:content-box}
@keyframes dsIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}

/* ---- header ---- */
.ds-top{height:54px;flex:none;display:flex;align-items:center;gap:15px;padding:0 18px;
  border-bottom:1px solid var(--line);background:var(--material);
  backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);z-index:5}
.ds-brand{display:flex;align-items:center;gap:9px}
.ds-mark{display:block}
.ds-mark line{stroke:var(--faint)}
.ds-mark circle{fill:var(--dim2)}
.ds-mark circle:nth-of-type(2){fill:var(--muted)}
.ds-mark circle:last-of-type{fill:var(--accent)}
.ds-word{font-size:15.5px;letter-spacing:0.01em}
.ds-word-a{color:var(--muted);font-weight:500}
.ds-word-b{color:var(--text);font-weight:600}
.ds-sidebar-toggle{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;font-size:14px;flex:none}
.ds-sidebar-toggle:hover{background:var(--fill-2);color:var(--text)}
.ds-sidebar-toggle.is-active{background:var(--accent-soft);border-color:transparent;color:var(--accent-text)}
.ds-sidebar-toggle-ico{line-height:1;transform:translateY(-0.5px)}
.ds-vsep{width:1px;height:24px;background:var(--line)}
.ds-titlewrap{display:flex;flex-direction:column;min-width:0;flex:1 1 auto;gap:1px;overflow:hidden}
.ds-kicker{display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:0.09em;text-transform:uppercase;color:var(--dim2);font-weight:700;min-width:0;overflow:hidden;white-space:nowrap}
.ds-kicker .ds-dim{color:var(--faint);font-weight:600}
.ds-change{font-size:11px;color:var(--dim);font-family:var(--mono);text-transform:none;letter-spacing:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ds-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}
.ds-status{display:flex;align-items:center;gap:8px;flex:none}
.ds-open{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text);padding:7px 11px;border-radius:8px;background:var(--fill-2)}
.ds-open b{font-variant-numeric:tabular-nums;font-weight:600}
.ds-dot{width:5px;height:5px;border-radius:50%;background:var(--faint);flex:none;display:inline-block}
.ds-dot-amber{width:6px;height:6px;background:var(--amber)}
.ds-trustpill{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:500;color:var(--amber-text);
  padding:7px 11px;border-radius:8px;border:1px solid rgba(255,159,10,0.32);background:rgba(255,159,10,0.08);cursor:pointer}
.ds-trustpill:hover{background:rgba(255,159,10,0.14)}
.ds-trustpill b{font-weight:700}
.ds-trustpill .ds-tri{font-size:11px}
.ds-trustpill.is-clean{color:var(--add);border-color:rgba(48,209,88,0.32);background:rgba(48,209,88,0.08)}
.ds-trustpill.is-clean:hover{background:rgba(48,209,88,0.14)}
.ds-check{font-size:12px}
.ds-actions{display:flex;align-items:center;gap:9px}
.ds-btn{font-size:13px;font-weight:500;border-radius:9px;cursor:pointer;border:1px solid transparent;white-space:nowrap}
.ds-btn-ghost{color:var(--text);padding:9px 15px;border-color:var(--line);background:transparent}
.ds-btn-ghost:hover{background:var(--fill-2)}
.ds-btn-approve{display:flex;align-items:center;gap:7px;font-weight:600;color:var(--on-green);padding:9px 17px;border:none;background:var(--green)}
.ds-btn-approve:hover{background:var(--green-hi)}
.ds-btn-approve:disabled{opacity:0.4;cursor:not-allowed}
.ds-readaloud{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:var(--text);padding:7px 11px;border-radius:8px;border:1px solid var(--line);background:transparent;cursor:pointer;white-space:nowrap}
.ds-readaloud:hover{background:var(--fill-2)}
.ds-readaloud-ico{font-size:10px;color:var(--accent-blue)}
.ds-readaloud.is-active{background:var(--accent-soft);border-color:transparent;color:var(--accent-text)}
.ds-readaloud.is-active .ds-readaloud-ico{color:var(--accent-text)}
.ds-readaloud.is-speaking .ds-readaloud-ico{animation:dsPulse 1s ease-in-out infinite}
@keyframes dsPulse{0%,100%{opacity:1}50%{opacity:0.3}}
.ds-settings-wrap{position:relative;display:flex;align-items:center;gap:5px}
.ds-gear{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;font-size:14px}
.ds-gear:hover{background:var(--fill-2);color:var(--text)}
.ds-settings-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:30;min-width:310px;background:var(--material);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border:1px solid var(--line);border-radius:11px;padding:12px 14px;box-shadow:var(--shadow)}
.ds-settings-pop[hidden]{display:none}
.ds-settings-title{font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim2);font-weight:600;margin-bottom:10px}
.ds-settings-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:9px}
.ds-settings-row:first-of-type{margin-top:0}
.ds-settings-label{font-size:12.5px;color:var(--muted)}
.ds-seg{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--fill-2);border:1px solid var(--hairline);flex-wrap:wrap;justify-content:flex-end}
.ds-seg button{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:6px;border:none;cursor:pointer;background:transparent;color:var(--muted)}
.ds-seg button.is-active{background:var(--accent-soft);color:var(--accent-text)}
.ds-playstep{margin-left:auto;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid rgba(10,132,255,0.3);background:rgba(10,132,255,0.08);color:var(--accent-blue);cursor:pointer;font-size:10px;padding:0;line-height:1}
.ds-playstep:hover{background:rgba(10,132,255,0.18)}
.ds-btn-solid{font-weight:600;color:var(--on-accent);padding:7px 13px;border:none;background:var(--accent)}
.ds-btn-solid:hover{background:var(--accent-hi)}
/* header responsiveness: drop the kicker, then tighten pills/buttons as it narrows */
@media (max-width:1180px){.ds-top{gap:9px}.ds-kicker{display:none}}
@media (max-width:980px){.ds-open,.ds-trustpill{padding:6px 9px}.ds-btn-ghost,.ds-btn-approve{padding:8px 11px}.ds-readaloud{padding:7px 9px}.ds-gear{width:28px;height:28px}}

/* ---- layout ---- */
.ds-layout{flex:1;display:flex;min-height:0}
.ds-rail{width:316px;flex:none;display:flex;flex-direction:column;border-right:1px solid var(--line);background:var(--panel);min-height:0;overflow:hidden;transition:width .18s ease,border-color .18s ease}
body.ds-rail-collapsed .ds-rail{width:0;border-right-color:transparent}
body.ds-rail-collapsed .ds-rail>*{visibility:hidden;pointer-events:none}
.ds-railpad{padding:14px 14px 0;flex:none}
.ds-viewtoggle{display:flex;gap:4px;padding:4px;border-radius:16px;background:rgba(255,255,255,0.075);border:1px solid rgba(255,255,255,0.12);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),0 10px 22px rgba(0,0,0,0.16)}
.ds-tab{flex:1;text-align:center;font-size:12.5px;font-weight:650;padding:9px 14px;border-radius:12px;border:none;cursor:pointer;background:transparent;color:rgba(235,235,245,0.58);
  transition:background .16s,color .16s,box-shadow .16s}
.ds-tab:hover{color:var(--text);background:rgba(255,255,255,0.045)}
.ds-tab.is-active{background:linear-gradient(180deg,rgba(74,144,226,0.72),rgba(40,92,149,0.78));color:#cfe4ff;box-shadow:0 8px 20px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.18)}
.ds-readhead{position:relative;margin:10px 14px 2px;padding:10px 12px 12px;border:1px solid rgba(255,255,255,0.07);border-radius:14px;background:rgba(255,255,255,0.035);flex:none;overflow:hidden}
.ds-readhead-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ds-readhead-label{font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim2);font-weight:600}
.ds-readhead-count{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:500}
.ds-readhead-track{position:absolute;left:12px;right:12px;bottom:7px;height:2px;background:var(--fill-2);border-radius:99px}
.ds-readhead-fill{height:100%;background:var(--accent);border-radius:99px;transition:width .25s}
.ds-railscroll{flex:1;overflow-y:auto;padding:8px 12px 8px 0}
.ds-railsteps{position:relative}
.ds-spine{position:absolute;left:34px;top:22px;bottom:22px;width:2px;background:var(--line)}
.ds-stepcard{display:grid;grid-template-columns:58px 1fr;align-items:start;width:100%;text-align:left;border:none;cursor:pointer;
  padding:13px 14px 14px 0;margin-bottom:4px;border-radius:11px;transition:background .12s;background:transparent}
.ds-stepcard:hover{background:var(--fill-1)}
.ds-stepcard.is-active{background:var(--fill-2)}
.ds-num{grid-column:1;width:22px;height:22px;margin:1px 0 0 23px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;position:relative;z-index:1;
  background:var(--panel);border:1.5px solid var(--line);color:var(--muted)}
.ds-stepcard.is-done .ds-num{background:rgba(48,209,88,0.18);border-color:rgba(48,209,88,0.55);color:var(--add)}
.ds-stepcard.is-active .ds-num{background:var(--accent);border-color:var(--accent);color:var(--on-accent);box-shadow:0 0 0 4px rgba(10,132,255,0.16)}
.ds-stepcard-body{grid-column:2;min-width:0;display:flex;flex-direction:column;gap:3px}
.ds-stepcard-title{font-size:13px;font-weight:600;color:var(--text);line-height:1.32;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ds-stepcard.is-active .ds-stepcard-title{color:var(--text)}
.ds-stepcard-fileline{display:flex;align-items:center;gap:7px;min-width:0;margin-top:1px}
.ds-stepcard-file{font-family:var(--mono);font-size:11px;color:var(--dim);line-height:1.35;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ds-railbadge{flex:none;font-size:9px;font-weight:600;padding:1px 6px;border-radius:5px;letter-spacing:0.02em;white-space:nowrap}
.ds-flowchip{display:flex;align-items:center;gap:4px;font-size:10.5px;color:var(--dim);padding:2px 7px;border-radius:5px;background:var(--fill-1)}
.ds-flowico{color:var(--dim2);font-size:9px}
.ds-badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;letter-spacing:0.02em;white-space:nowrap}
.ds-badge-changed{background:rgba(10,132,255,0.13);color:var(--accent-blue)}
.ds-badge-new{background:rgba(48,209,88,0.16);color:var(--add)}
.ds-badge-context{background:var(--fill-2);color:var(--muted)}
.ds-trustcard{flex:none;margin:10px 12px 12px;display:flex;gap:11px;align-items:flex-start;padding:13px;border-radius:11px;
  border:1px solid rgba(255,159,10,0.3);background:rgba(255,159,10,0.07);text-align:left;cursor:pointer}
.ds-trustcard:hover{background:rgba(255,159,10,0.11)}
.ds-trustcard.is-clean{border-color:rgba(48,209,88,0.3);background:rgba(48,209,88,0.07)}
.ds-trustcard.is-clean:hover{background:rgba(48,209,88,0.11)}
.ds-trustcard-ico{flex:none;width:26px;height:26px;border-radius:7px;background:rgba(255,159,10,0.16);display:flex;align-items:center;justify-content:center;color:var(--amber);font-size:13px}
.ds-trustcard.is-clean .ds-trustcard-ico{background:rgba(48,209,88,0.16);color:var(--add)}
.ds-trustcard-body{min-width:0}
.ds-trustcard-title{font-size:12.5px;font-weight:600;color:var(--amber-text)}
.ds-trustcard.is-clean .ds-trustcard-title{color:var(--add-text)}
.ds-trustcard-sub{font-size:11.5px;color:var(--amber-text);margin-top:2px;line-height:1.4}
.ds-trustcard.is-clean .ds-trustcard-sub{color:var(--add-text)}

/* ---- overview (step 0) ---- */
.ds-storymark{display:block}
.ds-stepcard[hidden]{display:none}
.ds-stepcard.is-intro{align-items:center;margin:10px 12px 12px;padding:16px 14px 16px 0;border-radius:18px;background:linear-gradient(145deg,rgba(33,59,91,0.92),rgba(24,45,72,0.92));
  border:1px solid rgba(126,181,255,0.12);box-shadow:0 18px 30px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.06)}
.ds-stepcard.is-intro:hover{background:linear-gradient(145deg,rgba(38,68,104,0.95),rgba(27,50,80,0.95))}
.ds-stepcard.is-intro.is-active{background:linear-gradient(145deg,rgba(40,72,110,0.98),rgba(27,52,84,0.98));box-shadow:0 18px 34px rgba(0,0,0,0.24),inset 0 1px 0 rgba(255,255,255,0.08)}
.ds-stepcard.is-intro .ds-num{grid-column:1;width:44px;height:44px;margin:0 0 0 18px;border-radius:14px;border:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.16);
  background:linear-gradient(180deg,rgba(50,131,214,0.92),rgba(35,96,160,0.92));color:#9dccff}
.ds-stepcard.is-intro.is-active .ds-num{background:linear-gradient(180deg,rgba(63,151,238,0.98),rgba(42,107,176,0.98));color:#d8ebff}
.ds-stepcard.is-intro .ds-stepcard-title{color:var(--text)}
.ds-stepcard.is-intro.is-active .ds-stepcard-title{color:var(--text)}
.ds-stepcard.is-intro .ds-stepcard-title{font-size:14px;line-height:1.25}
.ds-intro-cardsub{font-size:12px;color:rgba(235,235,245,0.54);line-height:1.35;margin-top:5px}
.ds-step.is-intro{display:block;overflow-y:auto}
.ds-introwrap{max-width:660px;margin:0 auto;padding:64px 40px 80px}
.ds-intro-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent-blue)}
.ds-intro-eyebrow .ds-storymark{color:var(--accent-blue)}
.ds-intro-title{font-size:32px;font-weight:600;letter-spacing:-0.02em;line-height:1.16;color:var(--text);margin:15px 0 0;text-wrap:balance}
.ds-intro-lede{font-size:16px;line-height:1.62;color:var(--muted);margin:20px 0 0;text-wrap:pretty}
.ds-intro-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;margin-top:34px;border-radius:13px;overflow:hidden;
  background:var(--line-soft);border:1px solid var(--line-soft)}
.ds-fact{display:flex;flex-direction:column;gap:3px;padding:15px 17px;background:var(--panel)}
.ds-fact-n{font-size:19px;font-weight:600;color:var(--text);font-variant-numeric:tabular-nums;letter-spacing:-0.01em}
.ds-fact-l{font-size:11.5px;color:var(--dim)}
.ds-fact-ok .ds-fact-n{color:var(--add)}
.ds-fact-warn .ds-fact-n{color:var(--amber)}
.ds-intro-start{display:inline-flex;flex-direction:column;gap:3px;margin-top:32px;padding:14px 22px;border-radius:12px;border:none;cursor:pointer;
  background:var(--accent);color:var(--on-accent);text-align:left}
.ds-intro-start:hover{background:var(--accent-hi)}
.ds-intro-start-main{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:600}
.ds-intro-arrow{font-size:16px}
.ds-intro-start-sub{font-size:12px;font-weight:500;opacity:0.78}
@media (max-width:560px){.ds-intro-facts{grid-template-columns:1fr}.ds-introwrap{padding:40px 22px 60px}.ds-intro-title{font-size:26px}}

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
  border:1px solid var(--line);background:transparent;color:var(--text);cursor:pointer}
.ds-iconbtn:hover{background:var(--hairline)}
.ds-iconbtn:disabled{opacity:0.32;cursor:default}
.ds-step-titlerow{display:flex;align-items:baseline;gap:13px;flex-wrap:wrap}
.ds-step-title{font-size:19px;font-weight:600;margin:0;letter-spacing:-0.01em;color:var(--text);line-height:1.3}
.ds-step-file{font-family:var(--mono);font-size:12.5px;color:var(--muted);overflow-wrap:anywhere;min-width:0}
.ds-step-file:hover{color:var(--accent-blue);text-decoration:underline}
.ds-why{margin:17px 30px 0;padding:15px 17px;border-radius:13px;background:rgba(10,132,255,0.07);border:1px solid rgba(10,132,255,0.2);flex:none}
.ds-why-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.ds-why-ico{width:15px;height:15px;border-radius:4px;background:rgba(10,132,255,0.2);display:flex;align-items:center;justify-content:center;position:relative}
.ds-why-ico::after{content:'';width:5px;height:5px;border-radius:50%;background:var(--accent-blue)}
.ds-why-label{font-size:10.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--accent-blue);font-weight:600}
.ds-why-text{margin:0;font-size:14px;line-height:1.58;color:var(--text);text-wrap:pretty}
.ds-diffscroll{flex:1;overflow-y:auto;padding:18px 30px 26px}

/* ---- diff ---- */
.ds-diff{border:1px solid var(--diff-rule);border-radius:6px;overflow:hidden;background:var(--panel3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.025)}
.ds-difftoolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-bottom:1px solid var(--diff-rule);background:var(--panel2)}
.ds-difthint{font-size:11px;color:var(--dim)}
.ds-commenthint{font-size:11px;color:var(--accent-blue);display:flex;align-items:center;gap:6px;white-space:nowrap;margin-left:auto;margin-right:12px}
.ds-commenthint b{color:var(--accent-blue)}
.ds-commenthint-ico{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:5px;background:var(--accent);color:var(--on-accent);font-weight:700;font-size:13px;line-height:1}
.ds-modetoggle{display:flex;gap:2px;padding:2px;border-radius:6px;background:var(--gutter-hi);border:1px solid var(--diff-rule)}
.ds-modetoggle button{font-size:11px;font-weight:600;padding:4px 11px;border-radius:6px;border:none;cursor:pointer;background:transparent;color:var(--muted)}
.ds-modetoggle button.is-active{background:var(--accent-soft);color:var(--accent-text)}
.ds-diffhead{display:flex;background:#191b20;border-bottom:1px solid var(--diff-rule)}
.ds-diffhead-ctx{justify-content:space-between;align-items:center;padding:9px 14px}
.ds-diffhead-side{flex:1;display:flex;align-items:center;gap:9px;padding:9px 14px}
.ds-diffhead-ctx .ds-diffhead-side{padding:0}
.ds-diffhead-label{font-size:10.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--muted)}
.ds-diffhead-label.ds-dim{color:var(--dim2)}
.ds-diffhead-label.ds-green{color:var(--add)}
.ds-diffhead-path{font-family:var(--mono);font-size:11.5px;color:var(--dim)}
.ds-diffhead-divider{width:1px;background:var(--diff-rule)}
.ds-diffhead-note{font-size:11px;color:var(--dim2)}
.ds-diffbody{font-family:var(--mono);font-size:12.5px;line-height:1.48;background:var(--panel3)}
.ds-diffbody-unified{font-size:12px;line-height:1.5;background:var(--panel3)}
.ds-hunkgap{padding:2px 14px;background:#15161a;color:var(--faint);font-size:11px;font-family:var(--mono);border-top:1px solid var(--diff-rule);border-bottom:1px solid var(--diff-rule)}
.ds-row{display:flex;position:relative;border-bottom:1px solid rgba(255,255,255,0.025);min-height:24px}
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
.ds-no{width:42px;flex:none;display:flex;align-items:flex-start;justify-content:flex-end;text-align:right;padding:3px 8px 3px 0;color:var(--dim2);background:var(--gutter);border-right:1px solid var(--diff-rule);user-select:none;font-variant-numeric:tabular-nums}
.ds-sign{width:12px;flex:none;display:flex;align-items:flex-start;justify-content:center;text-align:center;padding:4px 0;color:var(--faint);user-select:none}
.ds-sign-add{color:var(--add-bd)}
.ds-sign-del{color:var(--del)}
.ds-code{flex:1;min-width:0;padding:3px 14px 3px 7px;color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere}
.ds-code-add{color:var(--add-text)}
.ds-code-del{color:var(--del-text)}
.ds-untoured-tag{flex:none;align-self:center;font-size:9px;font-weight:700;letter-spacing:0.03em;color:var(--on-amber);background:var(--amber);padding:1px 6px;border-radius:4px;margin:0 9px}
.ds-addcomment{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:6px;border:none;cursor:pointer;
  display:flex;align-items:center;justify-content:center;background:var(--accent);color:var(--on-accent);font-size:15px;font-weight:700;line-height:1;box-shadow:0 2px 8px rgba(0,0,0,0.35);z-index:3;
  opacity:0;pointer-events:none;transition:opacity .12s,transform .12s}
.ds-row:hover .ds-addcomment{opacity:1;pointer-events:auto;transform:translateY(-50%) scale(1.05)}
.ds-urow{display:flex;align-items:stretch;border-bottom:1px solid rgba(255,255,255,0.025);min-height:23px}
.ds-urow.ds-row-add{background:rgba(18,150,111,0.12);box-shadow:inset 3px 0 0 var(--add-rail)}
.ds-urow.ds-row-del{background:rgba(224,68,94,0.12);box-shadow:inset 3px 0 0 var(--del-rail)}
.ds-urow.is-untoured{background:rgba(255,159,10,0.1);border-left:2px solid var(--amber)}
.ds-urow .ds-no{width:44px}
.ds-urow .ds-code{padding:2px 12px 2px 7px}
.ds-urow .ds-no,.ds-urow .ds-sign{padding-top:2px;padding-bottom:2px}
/* syntax highlighting — the line background still marks add/del */
.ds-code .tk-k{color:var(--tk-k)}
.ds-code .tk-t{color:var(--tk-t)}
.ds-code .tk-f{color:var(--tk-f)}
.ds-code .tk-s{color:var(--tk-s)}
.ds-code .tk-n{color:var(--tk-n)}
.ds-code .tk-c{color:var(--tk-c);font-style:italic}
.ds-diffnote{padding:14px 16px;color:var(--muted);font-family:var(--sans);font-size:13px}
.ds-diffnote-soft{color:var(--dim2);font-size:12px;border-bottom:1px solid var(--line-soft)}

/* ---- comments ---- */
.ds-thread{}
.ds-comment{padding:12px 16px 14px 50px;background:var(--panel2);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);
  font-family:var(--sans);animation:dsIn .18s ease}
.ds-comment-card{border:1px solid var(--line);border-radius:11px;overflow:hidden;background:var(--panel4)}
.flavor-change{border-color:rgba(255,69,58,0.45)}
.flavor-question{border-color:rgba(10,132,255,0.5)}
.flavor-nit{border-color:rgba(255,159,10,0.45)}
.ds-comment-head{display:flex;align-items:center;gap:9px;padding:10px 13px;border-bottom:1px solid var(--line-soft)}
.flavor-change .ds-comment-head{background:rgba(255,69,58,0.12)}
.flavor-question .ds-comment-head{background:rgba(10,132,255,0.12)}
.flavor-nit .ds-comment-head{background:rgba(255,159,10,0.12)}
.ds-flavor-ico{width:18px;height:18px;border-radius:5px;color:var(--on-accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
.flavor-change .ds-flavor-ico{background:rgba(255,69,58,0.45)}
.flavor-question .ds-flavor-ico{background:rgba(10,132,255,0.5)}
.flavor-nit .ds-flavor-ico{background:rgba(255,159,10,0.45)}
.ds-flavor-label{font-size:12px;font-weight:600}
.flavor-change .ds-flavor-label{color:var(--del-text)}
.flavor-question .ds-flavor-label{color:var(--accent-text)}
.flavor-nit .ds-flavor-label{color:var(--amber-text)}
.ds-comment-author{font-size:12px;color:var(--text);font-weight:500}
.ds-statusbadge{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:6px}
.status-open .ds-statusbadge{color:var(--amber);background:rgba(255,159,10,0.12)}
.status-open .ds-statusbadge .ds-dot{background:var(--amber)}
.status-addressed .ds-statusbadge{color:var(--accent-blue);background:rgba(10,132,255,0.12)}
.status-addressed .ds-statusbadge .ds-dot{background:var(--accent-blue)}
.status-resolved .ds-statusbadge{color:var(--add);background:rgba(48,209,88,0.14)}
.status-resolved .ds-statusbadge .ds-dot{background:var(--add)}
.ds-comment-body{padding:11px 13px;font-size:13px;line-height:1.55;color:var(--text);white-space:pre-wrap}
.ds-reply{display:flex;gap:10px;padding:11px 13px;border-top:1px solid var(--line-soft);background:rgba(10,132,255,0.04)}
.ds-reply-av{flex:none;width:24px;height:24px;border-radius:7px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--on-accent)}
.ds-reply-main{min-width:0}
.ds-reply-who{display:flex;align-items:center;gap:7px;margin-bottom:3px}
.ds-reply-name{font-size:12px;font-weight:600;color:var(--accent-blue)}
.ds-ai-badge{font-size:9.5px;font-weight:700;letter-spacing:0.04em;color:var(--accent-blue);background:rgba(10,132,255,0.14);padding:1px 6px;border-radius:4px}
.ds-reply-body{font-size:12.5px;line-height:1.55;color:var(--muted);white-space:pre-wrap}
.ds-comment-actions{display:flex;gap:8px;padding:4px 13px 12px}
.ds-send{color:var(--accent-blue)}
.ds-addall{font:inherit;font-size:11.5px;font-weight:600;color:var(--accent-blue);background:rgba(10,132,255,0.10);border:1px solid var(--line);padding:4px 10px;border-radius:7px;cursor:pointer}
.ds-addall:disabled{opacity:.45;cursor:default}
.ds-agentconsole{position:fixed;right:18px;bottom:18px;width:min(440px,calc(100vw - 36px));max-height:min(60vh,520px);display:flex;flex-direction:column;
  background:var(--material);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);
  border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow);z-index:90;overflow:hidden}
.ds-ac-head{display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:1px solid var(--line-soft);font-size:12.5px;font-weight:600;color:var(--text)}
.ds-ac-spin{width:13px;height:13px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent-blue);animation:ds-spin .7s linear infinite;flex:none}
@keyframes ds-spin{to{transform:rotate(360deg)}}
.ds-ac-body{margin:0;padding:11px 13px;overflow:auto;flex:1;font:11.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);white-space:pre-wrap;word-break:break-word}
.ds-ac-body.is-hint{font-family:var(--sans);font-size:12.5px;font-style:italic;white-space:normal;color:var(--muted)}
.ds-ac-foot{padding:10px 13px;border-top:1px solid var(--line-soft);font-size:12px;color:var(--text);display:flex;align-items:center;gap:9px}
.ds-ghost{font-size:12px;font-weight:500;color:var(--text);padding:6px 12px;border-radius:7px;border:1px solid var(--line);background:transparent;cursor:pointer}
.ds-ghost:hover{background:var(--fill-2)}
.ds-composer{padding:12px 16px 14px 50px;background:var(--panel2);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);
  font-family:var(--sans);animation:dsIn .15s ease}
.ds-composer-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.ds-composer-tab{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:6px 11px;border-radius:8px;cursor:pointer;
  border:1px solid var(--line);background:transparent;color:var(--muted)}
.ds-composer-tab .ds-flavor-ico{background:var(--line);color:var(--muted)}
.ds-composer-tab[data-flavor="change"].is-active{border-color:rgba(255,69,58,0.45);background:rgba(255,69,58,0.12);color:var(--del-text)}
.ds-composer-tab[data-flavor="question"].is-active{border-color:rgba(10,132,255,0.5);background:rgba(10,132,255,0.12);color:var(--accent-text)}
.ds-composer-tab[data-flavor="nit"].is-active{border-color:rgba(255,159,10,0.45);background:rgba(255,159,10,0.12);color:var(--amber-text)}
.ds-composer-tab[data-flavor="change"].is-active .ds-flavor-ico{background:rgba(255,69,58,0.45);color:var(--on-accent)}
.ds-composer-tab[data-flavor="question"].is-active .ds-flavor-ico{background:rgba(10,132,255,0.5);color:var(--on-accent)}
.ds-composer-tab[data-flavor="nit"].is-active .ds-flavor-ico{background:rgba(255,159,10,0.45);color:var(--on-accent)}
.ds-composer-ta{width:100%;box-sizing:border-box;resize:vertical;background:var(--panel3);border:1px solid var(--line);border-radius:8px;
  padding:9px 11px;color:var(--text);font-size:13px;font-family:var(--sans);line-height:1.5;outline:none}
.ds-composer-ta:focus{border-color:rgba(10,132,255,0.5)}
.ds-composer-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}

/* ---- all files ---- */
.ds-fileshead{flex:none;padding:19px 30px 15px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line-soft)}
.ds-fileshead-l{min-width:0}
.ds-fileshead-title{font-size:18px;font-weight:600;margin:0 0 7px;color:var(--text);letter-spacing:-0.01em}
.ds-fileshead-stats{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.ds-stat-add{font-family:var(--mono);color:var(--add);font-variant-numeric:tabular-nums}
.ds-stat-del{font-family:var(--mono);color:var(--del);font-variant-numeric:tabular-nums}
.ds-stat-untoured{display:flex;align-items:center;gap:5px;color:var(--amber)}
.ds-fileshead-r{display:flex;gap:8px;flex:none;align-items:center}
.ds-fileshint{font-size:12px;color:var(--dim2)}
.ds-filedetail{flex:1;overflow-y:auto;background:var(--panel3)}
.ds-filepanel{display:flex;flex-direction:column;min-height:100%}
.ds-filepanel[hidden]{display:none}
.ds-filepanel-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:11px;padding:12px 30px;background:var(--material);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--line)}
.ds-filepanel-body{flex:1;padding-bottom:40px}
.ds-cardpath{font-family:var(--mono);font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-cardpath .ds-dim{color:var(--dim)}
.ds-cardpath-base{color:var(--text);font-weight:600}
.ds-untoured-badge{flex:none;display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;background:rgba(255,159,10,0.13);color:var(--amber)}
.ds-untoured-badge .ds-tri{font-size:9px}
.ds-stepchip{flex:none;font-size:11px;color:var(--muted);padding:3px 9px;border-radius:6px;border:1px solid var(--line);background:transparent;cursor:pointer}
.ds-stepchip:hover{background:var(--fill-2);color:var(--text)}
.ds-cardstat{flex:none;display:flex;gap:8px;font-family:var(--mono);font-size:12px;font-variant-numeric:tabular-nums;justify-content:flex-end}

/* ---- sidebar file list (All files view) ---- */
.ds-railfiles{padding:6px 12px 8px 14px}
.ds-railfiles[hidden]{display:none}
.ds-fileitem{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:none;background:transparent;cursor:pointer;padding:8px 10px;border-radius:8px;font-family:var(--sans);margin-bottom:1px}
.ds-fileitem:hover{background:var(--fill-1)}
.ds-fileitem.is-active{background:var(--fill-2)}
.ds-fileitem.is-untoured{box-shadow:inset 2px 0 0 var(--amber)}
.ds-fileitem-dot{flex:none;width:8px;height:8px;border-radius:2px}
.ds-fileitem-dot.k-changed{background:var(--accent-blue)}
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
.ds-drawer-scrim{position:absolute;inset:0;background:var(--scrim);animation:dsIn .15s ease}
.ds-drawer{position:absolute;top:0;right:0;width:440px;max-width:92vw;height:100%;background:var(--material);backdrop-filter:saturate(180%) blur(30px);-webkit-backdrop-filter:saturate(180%) blur(30px);border-left:1px solid var(--line);
  display:flex;flex-direction:column;box-shadow:-30px 0 60px rgba(0,0,0,0.4);animation:dsIn .18s ease}
.ds-drawer-head{padding:20px 22px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.ds-drawer-title{font-size:16px;font-weight:600;color:var(--text)}
.ds-drawer-sub{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.45;text-wrap:pretty}
.ds-drawer-x{flex:none;width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;font-size:16px}
.ds-drawer-x:hover{background:var(--fill-2)}
.ds-drawer-body{padding:18px 22px;overflow-y:auto;flex:1}
.ds-trust-stats{display:flex;gap:10px;margin-bottom:20px}
.ds-trust-stat{flex:1;padding:13px;border-radius:11px}
.ds-trust-stat.ok{background:rgba(48,209,88,0.08);border:1px solid rgba(48,209,88,0.22)}
.ds-trust-stat.warn{background:rgba(255,159,10,0.08);border:1px solid rgba(255,159,10,0.26)}
.ds-trust-num{font-size:23px;font-weight:600;font-variant-numeric:tabular-nums}
.ds-trust-stat.ok .ds-trust-num{color:var(--add)}
.ds-trust-stat.warn .ds-trust-num{color:var(--amber)}
.ds-trust-lbl{font-size:11.5px;margin-top:2px;line-height:1.35}
.ds-trust-stat.ok .ds-trust-lbl{color:var(--add-text)}
.ds-trust-stat.warn .ds-trust-lbl{color:var(--amber-text)}
.ds-trust-section{font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim2);font-weight:600;margin-bottom:11px}
.ds-trust-card{border:1px solid rgba(255,159,10,0.3);border-radius:12px;overflow:hidden;margin-bottom:14px}
.ds-trust-card-head{padding:12px 14px;background:rgba(255,159,10,0.06);display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid rgba(255,159,10,0.18)}
.ds-trust-card-path{font-family:var(--mono);font-size:12px;color:var(--amber-text)}
.ds-trust-card .ds-diffbody-unified{background:transparent}
.ds-trust-card-note{padding:12px 14px;font-size:12.5px;color:var(--muted);line-height:1.5;text-wrap:pretty;border-top:1px solid var(--line-soft)}
.ds-trust-card-actions{padding:0 14px 14px;display:flex;gap:9px}
.ds-trust-clean{padding:16px;border-radius:12px;background:rgba(48,209,88,0.08);border:1px solid rgba(48,209,88,0.22);color:var(--add-text);font-size:13px;line-height:1.5}
.ds-trust-foot{margin-top:18px;font-size:12px;color:var(--dim2);line-height:1.5;text-wrap:pretty}

/* ---- misc ---- */
.ds-empty{padding:60px 40px;text-align:center;color:var(--muted)}
.ds-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);max-width:540px;
  background:var(--material);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border:1px solid var(--line);color:var(--text);font-size:13px;line-height:1.45;
  padding:12px 16px;border-radius:11px;box-shadow:var(--shadow);opacity:0;transition:opacity .2s,transform .2s;z-index:80;pointer-events:none}
.ds-toast.is-show{opacity:1;transform:translateX(-50%) translateY(0)}
.ds-green{color:var(--add)}
`;
// No backticks and no ${} below — safe to embed in a template literal.
export const PAGE_JS = `
(function(){
  var API='/api/comments';
  var ADDRESS_API='/api/address';
  var agentBusy=false;
  var BRAND='diffStory';
  var FLAVOR={change:{label:'Change request',ico:'◆'},question:{label:'Question',ico:'?'},nit:{label:'Nit',ico:'○'}};
  var STATUS={open:'Open',addressed:'Addressed',resolved:'Resolved'};
  var tourView,filesView,drawer,toastEl,stepPanels,stepCards,total=1,active=0,visited={0:true},toastTimer;
  var filePanels=[],fileItems=[],selectedFile=-1,readAloud=false,rate=1.05,operator='balanced',voices=[];

  function $(s,r){return (r||document).querySelector(s);}
  function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function closest(n,s){return n&&n.closest?n.closest(s):null;}
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}

  function setSidebarCollapsed(collapsed){
    document.body.classList.toggle('ds-rail-collapsed',collapsed);
    try{localStorage.setItem('ds-sidebar-collapsed',collapsed?'1':'');}catch(e){}
    $all('[data-sidebar-toggle]').forEach(function(b){
      b.classList.toggle('is-active',collapsed);
      b.setAttribute('aria-expanded',collapsed?'false':'true');
      b.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
      b.setAttribute('title',collapsed?'Expand sidebar':'Collapse sidebar');
    });
  }

  function setView(v){
    if(tourView)tourView.hidden=v!=='tour';
    if(filesView)filesView.hidden=v!=='files';
    $all('.ds-tab').forEach(function(t){t.classList.toggle('is-active',t.getAttribute('data-view')===v);});
    $all('[data-rail]').forEach(function(r){r.hidden=r.getAttribute('data-rail')!==v;});
    if(v==='files'&&selectedFile<0)selectFile(0);
    if(v!=='tour'&&window.speechSynthesis)window.speechSynthesis.cancel();
  }

  function setActive(i){
    if(i<0)i=0;if(i>total-1)i=total-1;active=i;visited[i]=true;
    stepPanels.forEach(function(p,idx){p.hidden=idx!==i;});
    stepCards.forEach(function(c,idx){
      var isA=idx===i,isD=visited[idx]&&!isA;
      c.classList.toggle('is-active',isA);
      c.classList.toggle('is-done',isD);
      // Index 0 is the Overview — leave its mark alone; real steps show their number.
      var num=$('.ds-num',c);if(num&&!c.hasAttribute('data-intro'))num.textContent=isD?'✓':String(idx);
    });
    var steps=total-1; // real steps, with the Overview excluded
    var pt=$('#ds-progress-text');if(pt)pt.textContent=i===0?'Overview':(i+' / '+steps);
    var pf=$('#ds-progress-fill');if(pf)pf.style.width=(i===0||!steps?0:(i/steps*100))+'%';
    if(tourView)tourView.scrollTop=0;
    var ap=stepPanels[i];if(ap)ap.scrollTop=0;
    speakStep(i);
  }

  function speak(text){
    var synth=window.speechSynthesis;if(!synth||!text)return;
    synth.cancel();
    var u=new SpeechSynthesisUtterance(text);
    u.rate=rate;
    var v=pickVoice(operator);if(v)u.voice=v;
    var btn=$('[data-readaloud]');
    u.onstart=function(){if(btn)btn.classList.add('is-speaking');};
    u.onend=function(){if(btn)btn.classList.remove('is-speaking');};
    u.onerror=function(){if(btn)btn.classList.remove('is-speaking');};
    synth.speak(u);
  }
  function stepText(panel){var w=$('.ds-why-text',panel),t=$('.ds-step-title',panel);return w?((t?t.textContent+'. ':'')+w.textContent):'';}
  function speakStep(i){var p=stepPanels[i];if(readAloud&&p)speak(stepText(p));}
  function setRate(r){rate=r;try{localStorage.setItem('ds-rate',String(r));}catch(e){}$all('[data-rate]').forEach(function(b){b.classList.toggle('is-active',parseFloat(b.getAttribute('data-rate'))===r);});}
  function setOperator(op){
    operator=op||'balanced';
    try{localStorage.setItem('ds-operator',operator);}catch(e){}
    $all('[data-operator]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-operator')===operator);});
    if(readAloud)speakStep(active);
  }
  function loadVoices(){
    if(!window.speechSynthesis)return;
    voices=window.speechSynthesis.getVoices()||[];
  }
  function voiceScore(v,op){
    var name=(v.name||'').toLowerCase(),lang=(v.lang||'').toLowerCase(),score=0;
    if(lang.indexOf('en')===0)score+=20;
    if(v.default)score+=10;
    if(v.localService)score+=5;
    if(op==='warm'){
      if(/samantha|ava|serena|victoria|karen|moira|tessa|zira|female/.test(name))score+=28;
      if(/natural|premium|enhanced/.test(name))score+=10;
    }else if(op==='precise'){
      if(/alex|daniel|fred|tom|david|mark|male/.test(name))score+=24;
      if(/compact|google|microsoft/.test(name))score+=8;
    }else{
      if(/samantha|alex|daniel|google us english|microsoft/.test(name))score+=14;
      if(/natural|enhanced|premium/.test(name))score+=8;
    }
    return score;
  }
  function pickVoice(op){
    if(op==='system')return null;
    if(!voices.length)loadVoices();
    if(!voices.length)return null;
    return voices.slice().sort(function(a,b){return voiceScore(b,op)-voiceScore(a,op);})[0]||null;
  }
  function toggleReadAloud(){
    readAloud=!readAloud;
    try{localStorage.setItem('ds-readaloud',readAloud?'1':'');}catch(e){}
    var btn=$('[data-readaloud]');if(btn)btn.classList.toggle('is-active',readAloud);
    if(readAloud)speakStep(active);
    else if(window.speechSynthesis){window.speechSynthesis.cancel();if(btn)btn.classList.remove('is-speaking');}
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
    if(c.status!=='resolved'){var snd=el('button','ds-ghost ds-send','Ask agent');snd.setAttribute('data-send','');actions.appendChild(snd);}
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
    var ta=el('textarea','ds-composer-ta');ta.placeholder='Leave a comment on this line… then Ask agent to get a reply right here.';ta.rows=3;
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
  var NL=String.fromCharCode(10);
  function acEl(){return $('#ds-agentconsole');}
  var acTimer=null;
  function acClearTimer(){if(acTimer){clearInterval(acTimer);acTimer=null;}}
  function acOpen(title){
    var c=acEl();if(!c)return;c.hidden=false;
    var body=$('#ds-ac-body');if(body){body.className='ds-ac-body is-hint';body.textContent='Warming up — reading your comments and the current diff…';}
    var foot=$('#ds-ac-foot');if(foot){foot.hidden=true;foot.textContent='';}
    var t=$('.ds-ac-title',c);if(t)t.textContent=title||'Agent is working…';
    var sp=$('.ds-ac-spin',c);if(sp)sp.hidden=false;
    var cl=$('[data-ac-close]',c);if(cl)cl.hidden=true;
    var st=$('[data-ac-stop]',c);if(st)st.hidden=false;
    acClearTimer();var t0=Date.now();
    acTimer=setInterval(function(){
      var b=$('#ds-ac-body');if(!b||b.className.indexOf('is-hint')<0){acClearTimer();return;}
      b.textContent='Working — reading your comments and the current diff… ('+Math.round((Date.now()-t0)/1000)+'s)';
    },1000);
  }
  function acAppend(s){var body=$('#ds-ac-body');if(!body)return;if(body.className.indexOf('is-hint')>=0){acClearTimer();body.className='ds-ac-body';body.textContent='';}body.textContent+=s;body.scrollTop=body.scrollHeight;}
  function acFinish(ok,codeChanged){
    var c=acEl();if(!c)return;acClearTimer();
    var body=$('#ds-ac-body');if(body&&body.className.indexOf('is-hint')>=0){body.className='ds-ac-body';body.textContent=ok?'Finished — replies are on your comments below.':'';}
    var sp=$('.ds-ac-spin',c);if(sp)sp.hidden=true;
    var st=$('[data-ac-stop]',c);if(st)st.hidden=true;
    var t=$('.ds-ac-title',c);if(t)t.textContent=ok?'Done':'Agent run failed';
    var cl=$('[data-ac-close]',c);if(cl)cl.hidden=false;
    if(ok&&codeChanged){
      var foot=$('#ds-ac-foot');
      if(foot){foot.hidden=false;foot.textContent='';foot.appendChild(document.createTextNode('Code changed. '));
        var btn=el('button','ds-btn ds-btn-solid','Reload to see the new diff');
        btn.onclick=function(){location.reload();};foot.appendChild(btn);}
    }
  }
  function collectOpenIds(){
    return $all('.ds-comment.status-open').map(function(w){return w.getAttribute('data-comment-id');});
  }
  function setBusy(b){
    agentBusy=b;
    $all('[data-send]').forEach(function(s){s.disabled=b;});
    var aa=$('[data-address-all]');if(aa)aa.disabled=b||collectOpenIds().length===0;
  }
  function ensureReply(wrap,text){
    var card=$('.ds-comment-card',wrap);if(!card)return;
    var r=$('.ds-reply',card);
    if(!r){
      r=el('div','ds-reply');
      r.appendChild(el('span','ds-reply-av','◈'));
      var main=el('div','ds-reply-main');
      var who=el('div','ds-reply-who');who.appendChild(el('span','ds-reply-name',BRAND));who.appendChild(el('span','ds-ai-badge','AI'));
      main.appendChild(who);
      main.appendChild(el('div','ds-reply-body'));
      r.appendChild(main);
      var actions=$('.ds-comment-actions',card);
      card.insertBefore(r,actions||null);
    }
    var rb=$('.ds-reply-body',r);if(rb)rb.textContent=text;
  }
  function patchComment(c){
    var wrap=$('.ds-comment[data-comment-id="'+c.id+'"]');if(!wrap)return;
    wrap.setAttribute('data-status',c.status);wrap.className='ds-comment status-'+c.status;
    var sb=$('.ds-statusbadge',wrap);if(sb){sb.textContent='';sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));}
    if(c.reply){wrap.setAttribute('data-hasreply','1');ensureReply(wrap,c.reply);}
    var rb=$('[data-resolve]',wrap);if(rb)rb.textContent=c.status==='resolved'?'Reopen':'Resolve';
    var snd=$('[data-send]',wrap);if(snd)snd.style.display=(c.status==='resolved')?'none':'';
  }
  function refreshComments(){
    fetch(API).then(function(r){return r.json();}).then(function(list){
      if(Array.isArray(list))list.forEach(patchComment);
      refreshCount();
    }).catch(function(){});
  }
  function handleEvent(ev,result){
    if(!ev||!ev.type)return;
    if(ev.type==='text'){acAppend(ev.data||'');}
    else if(ev.type==='tool'){acAppend(NL+(ev.data||'')+NL);}
    else if(ev.type==='error'){acAppend(NL+(ev.data||'')+NL);result.ok=false;}
    else if(ev.type==='done'){result.ok=!!ev.ok;result.codeChanged=!!ev.codeChanged;}
  }
  function pump(reader,dec,buf,result){
    return reader.read().then(function(res){
      if(res.done){
        if(buf.trim()){try{handleEvent(JSON.parse(buf),result);}catch(e){}}
        return result;
      }
      buf+=dec.decode(res.value,{stream:true});
      var parts=buf.split(NL);buf=parts.pop();
      for(var i=0;i<parts.length;i++){var ln=parts[i];if(!ln.trim())continue;try{handleEvent(JSON.parse(ln),result);}catch(e){}}
      return pump(reader,dec,buf,result);
    });
  }
  function runTitle(ids){
    if(ids==='all'){var n=collectOpenIds().length;return 'Addressing '+n+' open '+(n===1?'comment':'comments')+'…';}
    if(ids&&ids.length>1)return 'Addressing '+ids.length+' comments…';
    return 'Replying to your comment…';
  }
  var acAbort=null;
  function acStopped(){
    var c=acEl();if(!c)return;acClearTimer();
    var sp=$('.ds-ac-spin',c);if(sp)sp.hidden=true;
    var st=$('[data-ac-stop]',c);if(st)st.hidden=true;
    var cl=$('[data-ac-close]',c);if(cl)cl.hidden=false;
    var t=$('.ds-ac-title',c);if(t)t.textContent='Stopped';
    var body=$('#ds-ac-body');if(body){if(body.className.indexOf('is-hint')>=0){body.className='ds-ac-body';body.textContent='';}body.textContent+=(body.textContent?NL:'')+'Stopped.';}
  }
  function sendToAgent(ids){
    if(agentBusy)return;
    var payload=ids==='all'?{all:true}:{commentIds:ids};
    var result={ok:false,codeChanged:false};
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    acAbort=ctrl;
    setBusy(true);acOpen(runTitle(ids));
    fetch(ADDRESS_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl?ctrl.signal:undefined})
      .then(function(r){
        if(r.status===409){acAppend('Another agent run is already in progress.');return null;}
        if(!r.ok||!r.body){
          return r.json().then(function(j){acAppend((j&&j.error)||'Could not start the agent run.');return null;},
                               function(){acAppend('Could not start the agent run.');return null;});
        }
        return pump(r.body.getReader(),new TextDecoder(),'',result);
      })
      .then(function(res){
        if(res){acFinish(result.ok,result.codeChanged);if(result.ok)refreshComments();}
        else{acFinish(false,false);}
        setBusy(false);acAbort=null;
      })
      .catch(function(err){
        if(ctrl&&ctrl.signal.aborted)acStopped();
        else{acAppend(NL+String(err));acFinish(false,false);}
        setBusy(false);acAbort=null;
      });
  }
  function refreshCount(){
    var openN=$all('.ds-comment').length-$all('.ds-comment.status-resolved').length;
    var b=$('#ds-open-count b');if(b){b.textContent=openN;if(b.nextSibling)b.nextSibling.nodeValue=' open '+(openN===1?'comment':'comments');}
    var approve=$('[data-verdict="approve"]'),pill=$('.ds-trustpill'),clean=pill&&pill.classList.contains('is-clean');
    if(approve)approve.disabled=!(openN===0&&clean);
    var aa=$('[data-address-all]');if(aa&&!agentBusy)aa.disabled=openN===0;
  }
  function verdict(kind){
    var openN=$all('.ds-comment').length-$all('.ds-comment.status-resolved').length;
    if(kind==='approve'){toast('Looks clean — every change is explained and there are no open comments. ✓');return;}
    if(openN>0)toast(openN+' open '+(openN===1?'comment':'comments')+'. Click “Address all open” to have your agent reply right here.');
    else toast('No open comments yet. Leave notes on the lines, then Ask agent to get a reply right here.');
  }
  function toast(msg){
    if(!toastEl)return;toastEl.textContent=msg;toastEl.hidden=false;
    requestAnimationFrame(function(){toastEl.classList.add('is-show');});
    clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastEl.classList.remove('is-show');setTimeout(function(){toastEl.hidden=true;},220);},4200);
  }

  function onClick(e){
    var t=e.target,b;
    var sp=$('#ds-settings');if(sp&&!sp.hidden&&!closest(t,'.ds-settings-wrap'))sp.hidden=true;
    b=closest(t,'[data-sidebar-toggle]');if(b){setSidebarCollapsed(!document.body.classList.contains('ds-rail-collapsed'));return;}
    b=closest(t,'[data-view]');if(b){setView(b.getAttribute('data-view'));return;}
    b=closest(t,'[data-settings]');if(b){if(sp)sp.hidden=!sp.hidden;return;}
    b=closest(t,'[data-rate]');if(b){setRate(parseFloat(b.getAttribute('data-rate')));return;}
    b=closest(t,'[data-operator]');if(b){setOperator(b.getAttribute('data-operator'));return;}
    b=closest(t,'[data-playstep]');if(b){var pp=closest(t,'.ds-step');if(pp)speak(stepText(pp));return;}
    b=closest(t,'[data-readaloud]');if(b){toggleReadAloud();return;}
    b=closest(t,'.ds-fileitem');if(b){setView('files');selectFile(Number(b.getAttribute('data-file-index')));return;}
    b=closest(t,'.ds-addcomment');if(b){var row=closest(t,'.ds-row');if(row)openComposer(row);return;}
    b=closest(t,'[data-resolve]');if(b){resolveComment(closest(b,'.ds-comment'));return;}
    b=closest(t,'[data-delete]');if(b){deleteComment(closest(b,'.ds-comment'));return;}
    b=closest(t,'[data-send]');if(b){if(b.disabled)return;var cm=closest(b,'.ds-comment');if(cm)sendToAgent([cm.getAttribute('data-comment-id')]);return;}
    b=closest(t,'[data-address-all]');if(b){if(b.disabled)return;sendToAgent('all');return;}
    b=closest(t,'[data-ac-stop]');if(b){if(acAbort)acAbort.abort();return;}
    b=closest(t,'[data-ac-close]');if(b){var ac=acEl();if(ac)ac.hidden=true;return;}
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
  // ---- resizable diff panes (drag the BEFORE | AFTER divider) ----
  var splitBody=null;
  function startSplit(e){
    var div=closest(e.target,'.ds-celldiv');if(!div)return;
    var body=closest(div,'.ds-diffbody');if(!body)return;
    splitBody=body;document.body.classList.add('ds-resizing');e.preventDefault();
  }
  function moveSplit(e){
    if(!splitBody)return;
    var r=splitBody.getBoundingClientRect();if(!r.width)return;
    var pct=Math.max(22,Math.min(78,(e.clientX-r.left)/r.width*100));
    document.documentElement.style.setProperty('--ds-split',String(pct));
  }
  function endSplit(){
    if(!splitBody)return;
    splitBody=null;document.body.classList.remove('ds-resizing');
    try{localStorage.setItem('ds-split',(document.documentElement.style.getPropertyValue('--ds-split')||'').trim());}catch(e){}
  }
  function init(){
    tourView=$('#ds-view-tour');filesView=$('#ds-view-files');drawer=$('#ds-trust-drawer');toastEl=$('#ds-toast');
    stepPanels=$all('.ds-step');stepCards=$all('.ds-stepcard');total=stepPanels.length||1;
    filePanels=$all('.ds-filepanel');fileItems=$all('.ds-fileitem');
    document.addEventListener('click',onClick);
    document.addEventListener('keydown',onKey);
    document.addEventListener('mousedown',startSplit);
    document.addEventListener('mousemove',moveSplit);
    document.addEventListener('mouseup',endSplit);
    try{var sv=localStorage.getItem('ds-split');if(sv)document.documentElement.style.setProperty('--ds-split',sv);}catch(e){}
    try{setSidebarCollapsed(!!localStorage.getItem('ds-sidebar-collapsed'));}catch(e){setSidebarCollapsed(false);}
    refreshCount();
    var rab=$('[data-readaloud]');
    if(rab){
      if(!window.speechSynthesis){rab.style.display='none';var gear=$('[data-settings]');if(gear)gear.style.display='none';}
      else{
        loadVoices();
        window.speechSynthesis.onvoiceschanged=loadVoices;
        try{readAloud=!!localStorage.getItem('ds-readaloud');operator=localStorage.getItem('ds-operator')||operator;}catch(e){}
        rab.classList.toggle('is-active',readAloud);
      }
    }
    try{var r0=parseFloat(localStorage.getItem('ds-rate'));if(r0)rate=r0;}catch(e){}
    $all('[data-rate]').forEach(function(b){b.classList.toggle('is-active',parseFloat(b.getAttribute('data-rate'))===rate);});
    $all('[data-operator]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-operator')===operator);});
  }
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
`;
