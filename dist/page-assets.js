// Inlined CSS + client JS for the diffStory review page. Kept as plain strings
// (no backticks, no ${} in the JS) so they drop straight into the render template
// literal. The client only ever sets textContent, builds nodes with createElement,
// or injects server-escaped HTML from /api/fullfile — so there is no injection sink.
import { DIFF_CSS, DIFF_JS } from './diff-assets.js';
import { sharedTokens, themeControlStyles, threadAtmosphereStyles } from './theme.js';
const PAGE_CSS_CORE = `
/* Material 3-inspired tokens. Dark is the default scheme; the light override
   flips the same semantic roles. Existing component variables map onto M3
   surface, primary, secondary, outline, and state-layer roles. */
:root{
  color-scheme:dark;
  /* Signal / Thread-Ledger (direction 3b). This block only ALIASES page-local
     names onto the canonical tokens defined in sharedTokens() (theme.ts).
     Canonical names (--bg,--surface,--text,--accent,--add,--del,--line,--fill-*,
     --gutter,--add-bg,--del-bg,--amber*,--scrim,--shadow,--scroll,--tk-*,fonts,
     motion,radii) are INHERITED, not redefined here — redefining them would form
     a var() cycle. Light values come from the canonical [data-theme="light"]
     block, so every alias below flips automatically and no light block is needed. */
  /* Material role names kept so existing component CSS keeps resolving */
  --md-primary:var(--accent); --md-on-primary:var(--on-accent); --md-primary-container:var(--accent-soft); --md-on-primary-container:var(--accent-hi);
  --md-secondary:var(--text-2); --md-secondary-container:var(--accent-soft); --md-on-secondary-container:var(--accent-hi);
  --md-tertiary:var(--del); --md-error:var(--del); --md-on-error:var(--on-accent); --md-error-container:var(--del-soft); --md-warn:var(--amber);
  --md-surface:var(--bg); --md-surface-container-low:var(--bg); --md-surface-container:var(--surface-2);
  --md-surface-container-high:var(--surface-3); --md-surface-container-highest:var(--surface-3);
  --md-on-surface:var(--text); --md-on-surface-variant:var(--text-2); --md-outline:var(--text-3); --md-outline-variant:var(--line);
  --accent-text:var(--accent-hi); --accent-blue:var(--accent);
  --add-bd:var(--add); --add-text:var(--add);
  --del-text:var(--del);
  --amber-text:var(--amber);
  --green:var(--add); --green-hi:var(--add); --on-green:var(--on-accent);
  --panel:var(--bg); --panel2:var(--surface-2); --panel3:var(--surface); --panel4:var(--surface-3);
  --text-secondary:var(--text-2); --text-tertiary:var(--text-3); --text-minimum:var(--text-3);
  --muted:var(--text-2); --dim:var(--text-3); --dim2:var(--text-3); --faint:var(--text-3);
  --hairline:var(--line);
  --gutter-hi:var(--surface-2); --diff-rule:var(--line-soft);
  --add-rail:var(--add); --del-rail:var(--del);
  --material:var(--surface-2); --scroll-hi:var(--text-3);
  --ds-rail-width:var(--rail-width);
  --ds-split:50;
  --mono:var(--font-mono); --sans:var(--font-sans);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%;max-width:100%;height:100%}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;-webkit-font-smoothing:antialiased;
  display:flex;flex-direction:column;height:100vh;overflow:hidden;
  /* Signal 3b: ink page frame — shell regions float as islands on a 12px gutter.
     The gutter is the padding; the seam between stacked regions is tighter, so the
     chrome reads as sitting on the content rather than drifting above it. Story and
     Files share both numbers — switching views must not move the frame. */
  padding:12px;gap:4px}
body.ds-noscroll{overflow:hidden}
button{font-family:inherit}
a{color:inherit;text-decoration:none}
::selection{background:color-mix(in srgb,var(--accent) 30%,transparent)}
::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-thumb{background:var(--scroll);border-radius:8px;border:3px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:var(--scroll-hi);background-clip:content-box}

/* ---- header ---- */
.ds-top{height:48px;flex:none;display:flex;align-items:center;gap:8px;padding:0 12px;
  border-bottom:1px solid var(--line-soft);background:var(--md-surface-container);z-index:5}
.ds-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.ds-brand{display:flex;align-items:center;gap:9px;flex:none;padding:5px 7px;margin-left:-7px;border-radius:9px;color:inherit;text-decoration:none}
.ds-brand:hover{background:var(--fill-2)}
.ds-brand:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-mark{display:block;--ds-brand-path:var(--accent);--ds-brand-node-a:var(--text);--ds-brand-node-b:var(--accent-hi);--ds-brand-node-c:var(--text)}
.ds-word{font-size:15.5px;letter-spacing:0.01em}
.ds-word-a{color:var(--muted);font-weight:500}
.ds-word-b{color:var(--text);font-weight:600}
.ds-sidebar-toggle{width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:9px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:15px;flex:none}
.ds-sidebar-toggle:hover{background:var(--fill-2);color:var(--text)}
.ds-sidebar-toggle.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
.ds-sidebar-toggle-ico{line-height:1;transform:translateY(-0.5px)}
.ds-vsep{width:1px;height:24px;background:var(--line)}
.ds-titlewrap{display:flex;flex-direction:column;min-width:0;flex:1 1 auto;gap:2px;overflow:hidden}
.ds-titlebar{display:flex;align-items:center;gap:7px;min-width:0;overflow:hidden;white-space:nowrap}
.ds-back{min-height:44px;display:inline-flex;align-items:center;gap:2px;padding:0 10px 0 7px;border-radius:9px;border:none;
  background:transparent;color:var(--muted);font-size:12.5px;font-weight:600;flex:none;white-space:nowrap}
.ds-back:hover{background:var(--fill-2);color:var(--text)}
.ds-back:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-back-ico{font-size:17px;line-height:1;font-weight:500;transform:translateY(-0.5px)}
.ds-crumb-repo{font-size:11px;color:var(--dim);font-family:var(--mono);max-width:18ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none}
.ds-crumb-repo:hover{color:var(--text)}
.ds-kicker{display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:0.09em;text-transform:uppercase;color:var(--dim2);font-weight:700;min-width:0;overflow:hidden;white-space:nowrap}
.ds-kicker .ds-dim{color:var(--faint);font-weight:600}
.ds-change{font-size:11px;color:var(--dim);font-family:var(--mono);text-transform:none;letter-spacing:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ds-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}
.ds-dot{width:5px;height:5px;border-radius:50%;background:var(--faint);flex:none;display:inline-block}
.ds-dot-amber{width:6px;height:6px;background:var(--amber)}
.ds-trustpill{width:100%;display:flex;align-items:center;gap:8px;font:inherit;font-size:12px;font-weight:600;color:var(--amber-text);
  padding:8px 9px;border:0;border-radius:var(--radius);background:var(--amber-soft);cursor:pointer;text-align:left}
.ds-trustpill:hover{background:color-mix(in srgb,var(--amber) 20%,transparent)}
.ds-trustpill b{font-weight:700}
.ds-trustpill .ds-tri{font-size:10px}
.ds-trustpill.is-clean{color:var(--add);background:var(--add-bg)}
.ds-trustpill.is-clean:hover{background:color-mix(in srgb,var(--add) 18%,transparent)}
/* Amber is reserved for findings. A coverage check that has not resolved yet is
   an absence of information, not a problem, so it reads neutral until it lands. */
.ds-trustpill.is-unknown{color:var(--muted);background:var(--fill-1)}
.ds-trustpill.is-unknown:hover{background:var(--fill-2)}
.ds-trustpill .ds-tri-spin{display:inline-block;animation:ds-tri-spin 1.1s linear infinite}
@keyframes ds-tri-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ds-trustpill .ds-tri-spin{animation:none}}
.ds-check{font-size:12px}
.ds-actions{position:relative;display:flex;align-items:center;gap:9px;flex:none}
.ds-btn{font-size:13px;font-weight:600;border-radius:var(--radius);cursor:pointer;border:1px solid transparent;white-space:nowrap}
.ds-btn-ghost{color:var(--accent-text);padding:9px 16px;border-color:var(--line);background:transparent}
.ds-btn-ghost:hover{background:var(--fill-2)}
.ds-btn-approve{display:flex;align-items:center;gap:7px;font-weight:700;color:var(--on-accent);padding:10px 18px;border:none;background:var(--accent)}
.ds-btn-approve:hover{background:var(--accent-hi)}
.ds-btn-approve:disabled{opacity:0.4;cursor:not-allowed}
.ds-help{font-weight:700;font-family:var(--mono)}
.ds-reload-diff:disabled{opacity:.55;cursor:default}
.ds-actions:empty{display:none}
.ds-review-summary-label{display:flex;align-items:center;gap:8px;padding:0 2px;color:var(--muted);font-size:12px}
.ds-review-summary-label b{color:var(--text);font-variant-numeric:tabular-nums}
.ds-feedback-health-alert{display:grid;gap:3px;margin:0 4px;padding:9px 10px;border:1px solid color-mix(in srgb,var(--amber) 38%,var(--line));border-radius:10px;background:var(--amber-soft);color:var(--amber-text);font-size:11.5px;line-height:1.4}
.ds-feedback-health-alert strong{font-size:12px}.ds-feedback-health-alert span{color:var(--text)}
.ds-review-row-arrow{margin-left:auto;color:var(--dim);font-size:16px;font-weight:500}
.ds-review-section{display:grid;gap:1px;padding:3px 0 5px}
.ds-review-option{width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;border:none;border-radius:10px;background:transparent;color:var(--text);padding:10px;cursor:pointer}
.ds-review-option:hover{background:var(--fill-2)}
.ds-review-option:disabled{opacity:0.45;cursor:not-allowed}
.ds-review-option:disabled:hover{background:transparent}
.ds-review-option-title{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;line-height:1.2}
.ds-review-option-desc{font-size:11.5px;line-height:1.35;color:var(--muted)}
.ds-review-option-approve:not(:disabled) .ds-review-option-title{color:var(--md-primary)}
.ds-review-option-approve:disabled{opacity:1}.ds-review-option-approve:disabled .ds-review-option-title{color:var(--dim)}.ds-review-option-approve:disabled [data-approve-desc]{color:var(--muted)}
.ds-option-count{min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);background:var(--fill-3);font-size:10px}
.ds-review-decision{padding:6px 0;border-top:1px solid var(--line-soft)}
.ds-review-section-label{padding:3px 10px 1px;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim2);font-weight:700}
.ds-keycap,.ds-command kbd{font-family:var(--mono);font-size:10px;line-height:1;border:1px solid var(--line);border-bottom-color:var(--md-outline);border-radius:5px;background:var(--fill-2);padding:3px 5px;color:var(--muted)}
.ds-readaloud{width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:var(--md-on-secondary-container);padding:0;border-radius:9px;border:none;
  background:transparent;cursor:pointer;white-space:nowrap}
.ds-readaloud:hover{background:var(--md-surface-container-highest)}
.ds-readaloud-ico{width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--md-on-primary);background:var(--md-primary)}
.ds-readaloud.is-active{background:var(--md-secondary-container);border-color:transparent;color:var(--md-on-secondary-container)}
.ds-readaloud.is-active .ds-readaloud-ico{background:var(--md-on-secondary-container);color:var(--md-secondary-container)}
.ds-readaloud.is-speaking .ds-readaloud-ico{animation:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-readaloud.is-loading{border-color:var(--md-primary);background:var(--md-surface-container-highest)}
.ds-readaloud.is-loading .ds-readaloud-ico{animation:dsSpin .8s linear infinite}
@keyframes dsPulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes dsSpin{to{transform:rotate(360deg)}}
.ds-story-tune{position:relative;flex:none}.ds-story-tune>summary{list-style:none;min-height:32px;display:flex;align-items:center;justify-content:center;padding:0 10px;border:1px solid var(--line-soft);border-radius:8px;background:transparent;color:var(--muted);cursor:pointer;font-size:11.5px;font-weight:700;white-space:nowrap}.ds-story-tune>summary::-webkit-details-marker{display:none}.ds-story-tune>summary:hover{border-color:var(--line);background:var(--fill-2);color:var(--text)}.ds-story-tune[open]>summary{border-color:color-mix(in srgb,var(--accent-blue) 45%,var(--line));background:var(--accent-soft);color:var(--accent-text)}
.ds-story-tune-icon{display:block;width:16px;height:16px}.ds-story-tune-icon svg{display:block;width:100%;height:100%}
.ds-story-tune-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:6;width:236px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--material);box-shadow:var(--shadow)}
.ds-story-tune button{display:grid;gap:3px;width:100%;border:0;border-radius:7px;background:transparent;color:var(--text);font:inherit;text-align:left;padding:9px 10px;cursor:pointer}.ds-story-tune button:hover{background:var(--fill-2)}.ds-story-tune button strong{font-size:11.5px;font-weight:700}.ds-story-tune button small{color:var(--muted);font-size:10.5px;font-weight:500;line-height:1.35}
.ds-btn-solid{font-weight:600;color:var(--on-accent);padding:7px 13px;border:none;background:var(--accent)}
.ds-btn-solid:hover{background:var(--accent-hi)}
.ds-rail-scrim{display:none}
/* header responsiveness: keep the code title, collapse everything else progressively */
@media (max-width:900px){
  .ds-kicker{display:none}
}
@media (max-width:720px){
  :root{--ds-rail-width:240px}
  .ds-top{padding:0 8px;gap:4px}.ds-title{font-size:13px}.ds-titlebar{display:none}.ds-back{padding-right:7px}.ds-back:not(:focus) {font-size:0}.ds-back-ico{font-size:18px}
  .ds-layout>.ds-rail{position:fixed;top:56px;bottom:0;left:0;z-index:8;max-width:calc(100vw - 48px);box-shadow:var(--shadow)}
  body:not(.ds-rail-collapsed) .ds-rail-scrim{display:block;position:fixed;top:56px;right:0;bottom:0;left:min(var(--ds-rail-width,240px),calc(100vw - 48px));z-index:7;border:0;padding:0;background:var(--scrim);cursor:pointer}
  body{padding:0;gap:0}body .ds-layout{gap:0}body .ds-reviewchrome,body .ds-rail,body .ds-main{border-radius:0}
  /* Phone drops the gutter entirely, so the story islands square off with the rest
     of the frame — a 16px radius riding the screen edge reads as a rendering fault. */
  body :is(#ds-view-tour>:not(.ds-dock):not(.ds-filmthread):not([hidden]),.ds-dock,.ds-filmthread.is-storyless){border-radius:0}
  .ds-main{width:100%}
  .ds-rail-resizer{display:none}
}


/* ---- layout ---- */
.ds-layout{flex:1;display:flex;gap:12px;min-width:0;min-height:0}
.ds-rail{position:relative;width:var(--ds-rail-width,316px);flex:none;display:flex;flex-direction:column;border:1px solid var(--line-soft);border-radius:var(--radius-island);background:var(--md-surface-container-low);min-height:0;overflow:hidden;transition:border-color var(--motion-duration-fast) ease}
body.ds-rail-collapsed .ds-rail{width:0;min-width:0;max-width:0;border-color:transparent}
body.ds-rail-collapsed .ds-layout{gap:0}
body.ds-rail-collapsed .ds-rail>*{visibility:hidden;pointer-events:none}
body.ds-sidebar-resizing{cursor:col-resize}
body.ds-sidebar-resizing .ds-rail{transition:none}
body.ds-sidebar-resizing .ds-rail,body.ds-sidebar-resizing .ds-main{user-select:none}
.ds-rail-resizer{position:absolute;top:0;right:0;bottom:0;width:12px;z-index:4;cursor:col-resize;touch-action:none}
.ds-rail-resizer::after{content:'';position:absolute;top:0;right:0;bottom:0;width:2px;background:transparent;transition:background .12s}
.ds-rail-resizer:hover::after,.ds-rail-resizer:focus-visible::after,body.ds-sidebar-resizing .ds-rail-resizer::after{background:var(--md-primary)}
.ds-rail-resizer:focus-visible{outline:none}
.ds-railpad{padding:14px 14px 0;flex:none}
.ds-viewtoggle{display:flex;gap:0;padding:0;border-radius:var(--radius);background:transparent;border:1px solid var(--line);overflow:hidden}
.ds-resume-review{width:100%;min-width:0;display:flex;align-items:center;gap:7px;margin-top:8px;padding:8px 10px;border:0;border-radius:9px;background:var(--accent-soft);color:var(--accent-text);font:inherit;font-size:11.5px;font-weight:700;text-align:left;cursor:pointer;overflow:hidden}.ds-resume-review>span[aria-hidden="true"]{flex:none}.ds-resume-review [data-resume-review-label]{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ds-resume-review:hover{background:var(--md-secondary-container)}.ds-resume-review[hidden]{display:none}
.ds-tab{flex:1;text-align:center;font-size:12.5px;font-weight:700;padding:10px 14px;border-radius:0;border:none;border-left:1px solid var(--line);cursor:pointer;background:transparent;color:var(--muted);
  transition:background .16s,color .16s}
.ds-tab:first-child{border-left:none}
.ds-tab:hover{color:var(--text);background:var(--fill-1)}
.ds-tab.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
.ds-readhead{position:relative;margin:8px 14px 2px;padding:12px 14px 14px;border:none;border-radius:16px;background:var(--md-surface-container);flex:none;overflow:hidden}
.ds-readhead-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ds-readhead-label{font-family:var(--mono);font-size:10.5px;letter-spacing:var(--tracking-kicker);text-transform:uppercase;color:var(--dim2);font-weight:500}
.ds-readhead-count{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:500}
.ds-readhead-track{position:absolute;left:14px;right:14px;bottom:8px;height:3px;background:var(--md-surface-container-highest);border-radius:99px}
.ds-readhead-fill{width:100%;height:100%;background:var(--md-primary);border-radius:99px;transform:scaleX(0);transform-origin:left center;transition:transform var(--motion-duration-progress) var(--motion-ease-in-out)}
.ds-filetools{display:grid;gap:7px;margin-top:10px}.ds-file-search{height:31px;display:flex;align-items:center;gap:7px;padding:0 9px;border:1px solid var(--line-soft);border-radius:9px;background:var(--panel3);color:var(--dim)}
.ds-file-search:focus-within{border-color:var(--accent-blue);box-shadow:0 0 0 2px var(--accent-soft)}.ds-file-search input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:12px}.ds-file-search input::placeholder{color:var(--dim)}
.ds-filefilters{display:flex;gap:5px;flex-wrap:wrap;padding-bottom:1px}.ds-filefilters button,.ds-next-unviewed{height:25px;flex:none;border:1px solid var(--line-soft);border-radius:var(--radius-sm);background:transparent;color:var(--muted);font:inherit;font-size:10.5px;font-weight:600;padding:0 8px;cursor:pointer}
.ds-filefilters button:hover,.ds-next-unviewed:hover{background:var(--fill-2);color:var(--text)}.ds-filefilters button.is-active{border-color:transparent;background:var(--md-secondary-container);color:var(--md-on-secondary-container)}.ds-next-unviewed{width:100%;border-radius:8px;display:flex;align-items:center;justify-content:space-between;padding:0 9px}
.ds-railscroll{flex:1;overflow-y:auto;padding:8px 12px 8px 14px}
.ds-railsteps{position:relative}
.ds-spine{position:absolute;left:34px;top:22px;bottom:22px;width:2px;background:var(--line)}
.ds-stepcard{display:grid;grid-template-columns:58px 1fr;align-items:start;width:100%;text-align:left;border:none;cursor:pointer;
  padding:13px 14px 14px 0;margin-bottom:4px;border-radius:18px;transition:background .12s;background:transparent}
.ds-stepcard:hover{background:var(--fill-1)}
.ds-stepcard.is-active{background:var(--md-secondary-container)}
.ds-num{grid-column:1;width:24px;height:24px;margin:1px 0 0 22px;border-radius:12px;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;position:relative;z-index:1;
  background:var(--md-surface-container);border:1px solid var(--line);color:var(--muted)}
.ds-stepcard.is-visited:not(.is-active) .ds-num{background:var(--md-surface-container-high);border-color:var(--line);color:var(--muted)}
.ds-stepcard.is-visited:not(.is-active) .ds-stepcard-title{color:var(--muted)}
.ds-stepcard.is-active .ds-num{background:var(--md-primary);border-color:var(--md-primary);color:var(--md-on-primary);box-shadow:none}
.ds-stepcard-body{grid-column:2;min-width:0;display:flex;flex-direction:column;gap:3px}
.ds-stepcard-title{font-size:13px;font-weight:600;color:var(--text);line-height:1.32;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ds-stepcard.is-active .ds-stepcard-title{color:var(--text)}
.ds-stepcard-fileline{display:flex;align-items:center;gap:7px;min-width:0;margin-top:1px}
.ds-stepcard-file{font-family:var(--mono);font-size:11px;color:var(--dim);line-height:1.35;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ds-railbadge{flex:none;font-size:9px;font-weight:600;padding:1px 6px;border-radius:5px;letter-spacing:0.02em;white-space:nowrap}
.ds-flowchip{display:flex;align-items:center;gap:4px;font-size:10.5px;color:var(--dim);padding:2px 7px;border-radius:5px;background:var(--fill-1)}
.ds-flowico{color:var(--dim2);font-size:9px}
.ds-badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;letter-spacing:0.02em;white-space:nowrap}
.ds-badge-changed{background:color-mix(in srgb,var(--accent) 13%,transparent);color:var(--accent-blue)}
.ds-badge-new{background:rgba(48,209,88,0.16);color:var(--add)}
.ds-badge-context{background:var(--fill-2);color:var(--muted)}
/* ---- overview (step 0) ---- */
.ds-storymark{display:block}
.ds-stepcard[hidden]{display:none}
.ds-stepcard.is-intro{width:auto;grid-template-columns:48px 1fr;align-items:center;margin:8px 14px 0;padding:12px 14px 12px 0;
  border-radius:18px;background:var(--md-surface-container);border:1px solid var(--line-soft);box-shadow:none}
.ds-stepcard.is-intro:hover{background:var(--md-surface-container-high)}
.ds-stepcard.is-intro.is-active{background:var(--md-secondary-container);border-color:transparent;box-shadow:none}
.ds-stepcard.is-intro .ds-num{grid-column:1;width:34px;height:34px;margin:0 0 0 10px;border-radius:12px;border:none;box-shadow:none;
  background:var(--md-surface-container-highest);color:var(--md-primary)}
.ds-stepcard.is-intro.is-active .ds-num{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--md-on-secondary-container)}
.ds-stepcard.is-intro .ds-stepcard-title{color:var(--text);font-size:13.5px;line-height:1.25}
.ds-stepcard.is-intro.is-active .ds-stepcard-title{color:var(--md-on-secondary-container)}
.ds-intro-cardsub{font-size:11.5px;color:var(--muted);line-height:1.35;margin-top:3px}
.ds-stepcard.is-intro.is-active .ds-intro-cardsub{color:rgba(232,222,248,0.72)}
.ds-step.is-intro{display:block;overflow-y:auto}
.ds-introwrap{max-width:820px;margin:0 auto;padding:64px 40px 80px}
.ds-intro-eyebrow{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10.5px;font-weight:500;letter-spacing:var(--tracking-kicker);text-transform:uppercase;color:var(--accent-blue)}
.ds-intro-eyebrow .ds-storymark{color:var(--accent-blue)}
.ds-intro-title{font-size:32px;font-weight:600;letter-spacing:-0.02em;line-height:1.16;color:var(--text);margin:15px 0 0;text-wrap:balance}
.ds-intro-lede{font-size:16px;line-height:1.62;color:var(--muted);margin:20px 0 0;text-wrap:pretty}
.ds-intro-design{font-size:14px;line-height:1.6;color:var(--muted);margin:12px 0 0;text-wrap:pretty}
.ds-intro-block-kicker{display:block;font-family:var(--mono);font-size:9.5px;font-weight:500;letter-spacing:var(--tracking-kicker);text-transform:uppercase}
.ds-intro-hotspots{margin-top:26px}
.ds-intro-hotspots>.ds-intro-block-kicker{color:var(--amber)}
.ds-intro-hotspots ul{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
.ds-intro-hotspots button{display:flex;flex-direction:column;gap:3px;width:100%;padding:11px 14px;text-align:left;font:inherit;cursor:pointer;
  color:inherit;background:color-mix(in srgb,var(--amber) 6%,var(--panel));border:1px solid color-mix(in srgb,var(--amber) 32%,transparent);border-radius:10px}
.ds-intro-hotspots button:hover{border-color:var(--amber)}
.ds-hotspot-step{font-size:12.5px;font-weight:600;color:var(--text)}
.ds-hotspot-reason{font-size:12.5px;line-height:1.5;color:var(--muted);text-wrap:pretty}
.ds-intro-nongoals{margin-top:14px}
.ds-intro-nongoals>.ds-intro-block-kicker{color:var(--dim)}
.ds-intro-nongoals ul{margin:7px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.ds-intro-nongoals li{font-size:13px;line-height:1.55;color:var(--muted);text-wrap:pretty}
.ds-intro-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;margin-top:34px;border-radius:13px;overflow:hidden;
  background:var(--line-soft);border:1px solid var(--line-soft)}
.ds-intro-facts[hidden]{display:none}
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
.ds-storygen-card{margin-top:28px;border:1px solid var(--line-soft);border-radius:14px;background:var(--md-surface-container);box-shadow:var(--shadow);overflow:hidden}
.ds-storygen-head{padding:19px 20px 18px;border-bottom:1px solid var(--line-soft);background:var(--fill-1)}
.ds-storygen-head strong{display:block;margin-top:5px;font-size:19px;font-weight:600;color:var(--text);letter-spacing:-0.01em}
.ds-storygen-head p{max-width:590px;margin:7px 0 0;color:var(--muted);font-size:12.5px;line-height:1.5}
.ds-storygen-eyebrow{font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim2);font-weight:700}
.ds-storygen-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.18fr);gap:17px 12px;padding:18px 20px 0;align-items:start}
.ds-storygen-field{display:flex;flex-direction:column;gap:7px;font-size:12px;color:var(--muted);font-weight:700;min-width:0}
.ds-storygen-label{font-size:12px;color:var(--muted);font-weight:700}
.ds-storygen-label b{font-weight:700;color:var(--text);font-variant-numeric:tabular-nums}
.ds-storygen-labelrow{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ds-storygen-optional{font-size:10.5px;font-weight:700;color:var(--muted)}
.ds-storygen-help{display:block;color:var(--muted);font-size:11.5px;font-weight:500;line-height:1.45}
.ds-choicegroup{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;min-height:34px;align-items:stretch;min-width:0}
.ds-field-detail{grid-column:1 / -1;border:0;padding:0;margin:0;min-inline-size:0}
.ds-field-detail>legend{padding:0;margin:0 0 3px}
.ds-depthchoices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:4px}
.ds-depthchoice{position:relative;min-width:0;min-height:142px;display:flex;flex-direction:column;align-items:stretch;gap:9px;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--panel3);color:var(--text);font:inherit;text-align:left;cursor:pointer;transition:border-color var(--motion-duration-fast) ease,background var(--motion-duration-fast) ease,box-shadow var(--motion-duration-fast) ease}
.ds-depthchoice:hover{border-color:color-mix(in srgb,var(--accent) 45%,transparent);background:var(--fill-1)}
.ds-depthchoice:focus-visible{outline:none;border-color:color-mix(in srgb,var(--accent) 78%,transparent);box-shadow:0 0 0 3px var(--accent-soft)}
.ds-depthchoice.is-active{border-color:var(--accent-blue);background:var(--accent-soft);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 16%,transparent)}
.ds-depthchoice-top{display:flex;align-items:center;gap:7px;min-width:0}
.ds-depthchoice-top strong{font-size:12.5px;font-weight:700;line-height:1.2}
.ds-depthchoice-radio{width:15px;height:15px;flex:none;border:1.5px solid var(--dim2);border-radius:50%;background:transparent}
.ds-depthchoice.is-active .ds-depthchoice-radio{border:4px solid var(--accent-blue);background:var(--on-accent)}
.ds-depthchoice-badge{margin-left:auto;padding:3px 6px;border-radius:5px;background:var(--fill-2);color:var(--muted);font-size:10.5px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap}
.ds-depthchoice-badge.is-recommended{background:var(--accent-blue);color:var(--on-accent)}
.ds-depthchoice-desc{font-size:11.5px;font-weight:600;line-height:1.45;color:var(--muted)}
.ds-depthchoice-meta{margin-top:auto;font-size:10.5px;font-weight:700;color:var(--accent-blue);letter-spacing:.01em}
.ds-field-scope,.ds-field-note{grid-column:1 / -1}
.ds-choice{min-width:0;min-height:34px;border:1px solid var(--line);border-radius:10px;background:var(--panel3);color:var(--muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer;padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ds-choice:hover{border-color:color-mix(in srgb,var(--accent) 45%,transparent);color:var(--text);background:var(--fill-1)}
.ds-choice:focus-visible{outline:none;border-color:color-mix(in srgb,var(--accent) 72%,transparent);box-shadow:0 0 0 3px var(--accent-soft)}
.ds-choice.is-active{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ds-field-agent.is-wide{grid-column:1 / -1}
.ds-storygen-agent-state{min-height:16px;margin:0;color:var(--muted);font-size:10.5px;font-weight:600;line-height:1.4}.ds-storygen-agent-state[hidden]{display:none}.ds-storygen-agent-state.is-error{color:var(--del-text)}.ds-storygen-agent-state:focus{outline:none;box-shadow:0 0 0 3px var(--accent-soft);border-radius:3px}
.ds-storyscope{grid-column:1 / -1;border:1px solid var(--line-soft);border-radius:12px;background:var(--panel2);overflow:hidden}
.ds-storyscope>summary{min-height:62px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;list-style:none;cursor:pointer}
.ds-storyscope>summary::-webkit-details-marker{display:none}
.ds-storyscope>summary:hover{background:var(--fill-1)}
.ds-storyscope>summary:focus-visible{outline:none;box-shadow:inset 0 0 0 3px var(--accent-soft)}
.ds-storyscope-copy{display:grid;gap:3px;min-width:0}.ds-storyscope-copy small{color:var(--muted);font-size:11px;line-height:1.35}
.ds-storyscope-summary{display:flex;align-items:center;gap:8px;flex:none;color:var(--muted);font-size:10.5px}.ds-storyscope-summary strong{color:var(--text);font-size:11px;font-variant-numeric:tabular-nums}.ds-storyscope-summary strong b{font:inherit}
.ds-storyscope-edit{color:var(--accent-blue);font-weight:700}.ds-storyscope-caret{font-size:16px;color:var(--dim);transform:rotate(0deg);transition:transform var(--motion-duration-fast) var(--motion-ease-in-out)}.ds-storyscope[open] .ds-storyscope-caret{transform:rotate(180deg)}
.ds-storyscope-body{display:grid;gap:10px;padding:12px 14px 14px;border-top:1px solid var(--line-soft)}
.ds-storyfile-search{height:34px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--panel3);color:var(--dim)}
.ds-storyfile-search:focus-within{border-color:color-mix(in srgb,var(--accent) 72%,transparent);box-shadow:0 0 0 3px var(--accent-soft)}
.ds-storyfile-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:12px;font-weight:600}
.ds-storyfile-search input::placeholder{color:var(--dim)}
.ds-storyscope-actions{display:flex;flex-wrap:nowrap;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:thin}
.ds-scopechip{flex:none;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--panel3);color:var(--muted);font:inherit;font-size:11.5px;font-weight:600;min-height:28px;padding:0 10px;cursor:pointer;white-space:nowrap}
.ds-scopechip:hover{border-color:color-mix(in srgb,var(--accent) 45%,transparent);color:var(--text);background:var(--fill-1)}
.ds-storyfiles{max-height:240px;overflow:auto;border:1px solid var(--line-soft);border-radius:10px;background:var(--panel2)}
.ds-storyfile{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;min-height:34px;padding:7px 10px;border-bottom:1px solid var(--line-soft);font-size:12px;color:var(--text);font-weight:600}
.ds-storyfile:last-child{border-bottom:none}
.ds-storyfile input{width:14px;height:14px;margin:0;accent-color:var(--accent)}
.ds-storyfile-path{font-family:var(--mono);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-storyfile-stat{font-family:var(--mono);font-size:11.5px;white-space:nowrap}
.ds-field-note textarea{width:100%;min-height:96px;resize:vertical;border:1px solid var(--line);border-radius:10px;background:var(--panel3);color:var(--text);font:inherit;font-size:12.5px;font-weight:600;line-height:1.45;padding:10px 11px}
.ds-field-note textarea:focus{outline:none;border-color:color-mix(in srgb,var(--accent) 72%,transparent);box-shadow:0 0 0 3px var(--accent-soft)}
.ds-storyscope-error{margin:0;padding:9px 10px;border-radius:8px;background:var(--del-bg);color:var(--del-text);font-size:11.5px;font-weight:700}.ds-storyscope-error[hidden]{display:none}.ds-storyscope-error:focus{outline:none;box-shadow:0 0 0 3px var(--del-soft)}
.ds-storygen-button{margin:18px 20px 20px;width:calc(100% - 40px)}
.ds-storygen-button:disabled{opacity:.5;cursor:not-allowed}
.ds-storygen-warn{margin:0 17px 17px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--amber) 32%,transparent);border-radius:10px;background:var(--amber-soft);color:var(--text);font-size:12.5px;line-height:1.45;display:flex;align-items:center;gap:10px}
.ds-storygen-warn[hidden]{display:none}
.ds-storygen-warn span{flex:1;min-width:0}
.ds-storygen-fix{flex:none;border:none;border-radius:8px;background:var(--accent);color:var(--on-accent);font:inherit;font-size:12px;font-weight:700;padding:6px 10px;cursor:pointer}
.ds-storygen-fix:hover{background:var(--accent-hi)}
.ds-storygen-fix:disabled{opacity:.55;cursor:default}
.ds-excluded-only{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;margin-top:28px;padding:18px 19px;border:1px solid color-mix(in srgb,var(--amber) 28%,var(--line-soft));border-radius:14px;background:color-mix(in srgb,var(--amber) 5%,var(--md-surface-container));box-shadow:var(--shadow)}
.ds-excluded-only-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--amber-soft);color:var(--amber-text);font-size:17px;font-weight:700}
.ds-excluded-only>div{min-width:0}.ds-excluded-only strong{display:block;color:var(--text);font-size:14px}.ds-excluded-only p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.45;text-wrap:pretty}
.ds-excluded-only-path{font-family:var(--mono);font-size:.94em;font-weight:600;color:var(--text);overflow-wrap:anywhere}
.ds-excluded-rail-list{display:grid;gap:2px;padding:4px 10px}
.ds-excluded-rail-file{width:100%;min-height:44px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;padding:7px 9px;border:0;border-radius:8px;background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}
.ds-excluded-rail-file:hover{background:var(--fill-2)}.ds-excluded-rail-file:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-excluded-rail-file-icon{width:20px;height:20px;display:grid;place-items:center;color:var(--dim)}.ds-excluded-rail-file-icon svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.25;stroke-linejoin:round}
.ds-excluded-rail-file code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:11.5px;font-weight:600}.ds-excluded-rail-file>span:last-child{color:var(--dim);font-size:18px}
@media (max-width:900px){.ds-storygen-grid{grid-template-columns:1fr}.ds-storygen-button{width:calc(100% - 40px)}}
@media (max-width:700px){.ds-choicegroup{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr))}.ds-depthchoices{grid-template-columns:1fr}.ds-depthchoice{min-height:0}.ds-storygen-button{width:calc(100% - 40px)}}
@media (max-width:560px){.ds-storygen-head{padding:17px}.ds-storygen-grid{padding:16px 17px 0}.ds-storygen-button{margin:17px;width:calc(100% - 34px)}.ds-storyscope>summary{align-items:flex-start}.ds-storyscope-summary{display:grid;justify-items:end;gap:2px}.ds-storyscope-edit{display:none}.ds-depthchoice{padding:12px}.ds-storygen-labelrow{align-items:flex-start}.ds-storygen-optional{white-space:nowrap}.ds-storyfile-search{height:40px}.ds-scopechip{min-height:36px;padding:0 12px}.ds-excluded-only{grid-template-columns:auto minmax(0,1fr);padding:15px}.ds-excluded-only>.ds-btn{grid-column:1 / -1;width:100%}}
@media (max-width:560px){.ds-intro-facts{grid-template-columns:1fr}.ds-introwrap{padding:40px 22px 60px}.ds-intro-title{font-size:26px}}

/* ---- main / story tour ---- */
.ds-main{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--radius-island);overflow:hidden}
.ds-view{flex:1;min-height:0;display:flex;flex-direction:column}
.ds-view[hidden]{display:none}
/* The review page: one scrollable surface instead of a popover over two drawers. */
#ds-view-review{overflow-y:auto}
/* minmax(0,1fr): the tab strip is a scroller whose natural width is the sum of
   its tabs, and an auto-sized track grows to that width — pushing the whole page
   past a narrow viewport instead of letting the strip scroll inside it. */
.ds-reviewpage{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:18px;width:min(920px,100%);margin:0 auto;padding:22px}
/* min-width:0 so a card shrinks to its track instead of being sized by its
   widest nowrap descendant, which pushed the page sideways on a phone. */
.ds-reviewpage-section{min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;padding:18px 20px;border:1px solid var(--line-soft);border-radius:var(--radius-island);background:var(--panel3)}
.ds-reviewpage-section:focus{outline:none}
.ds-reviewpage-section:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-reviewpage-h{display:flex;align-items:center;gap:7px;margin:0;font-size:13px;font-weight:700;letter-spacing:.02em;color:var(--text)}
.ds-reviewpage-sub{color:var(--dim);font-size:11px;font-weight:600}
.ds-queue-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;min-width:0}.ds-queue-title{display:grid;gap:4px;min-width:0}.ds-queue-title p{margin:0;color:var(--muted);font-size:11.5px;line-height:1.45}.ds-queue-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex:none}.ds-queue-actions button{min-height:36px}.ds-queue-send-count{font-variant-numeric:tabular-nums}
.ds-reviewpage-section .ds-review-section{gap:4px;padding:0}
/* The verdict is pinned above the tabs, so it reads from every panel. It is a
   summary, not a card: no panel chrome competing with the ones below it. */
.ds-reviewsummary{display:grid;gap:8px;padding:2px 2px 0}
.ds-reviewsummary:focus{outline:none}
.ds-reviewsummary:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft);border-radius:10px}
/* The pill was sized for a 320px popover; on a 920px page it must stay a pill. */
.ds-reviewsummary .ds-trustpill{width:auto;justify-self:stretch;justify-content:flex-start}
.ds-reviewtabs{position:sticky;z-index:3;top:0;min-width:0;display:flex;gap:2px;margin:0 -2px;padding:4px 2px 8px;background:linear-gradient(var(--surface) 72%,transparent);overflow-x:auto;scrollbar-width:none}
.ds-reviewtabs::-webkit-scrollbar{display:none}
.ds-reviewtab{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 13px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:650;white-space:nowrap;cursor:pointer;transition:background var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease}
.ds-reviewtab:hover{background:var(--fill-1);color:var(--text)}
.ds-reviewtab.is-active{border-color:var(--line-soft);background:var(--panel3);color:var(--text)}
.ds-reviewtab:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-reviewtab-flag{color:var(--amber);font-size:10px;font-weight:700;font-variant-numeric:tabular-nums}
.ds-reviewtab-flag[hidden],.ds-reviewtab-count[hidden]{display:none}
.ds-reviewtab-count{min-width:17px;height:17px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px;border-radius:999px;background:var(--fill-3);color:var(--muted);font-size:9.5px;font-variant-numeric:tabular-nums}
.ds-reviewtab.is-active .ds-reviewtab-count{color:var(--text)}
.ds-reviewpanel{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:18px}
.ds-reviewpanel[hidden]{display:none}
.ds-reviewpanel:focus{outline:none}
.ds-reviewpanel:focus-visible{outline:none}
/* The evidence wrapper only exists so the lazy coverage fetch has one node to
   swap. Its children are the Coverage panel's sections, so it contributes no box
   of its own — otherwise a nested grid double-counts the gap. */
.ds-trust-evidence{display:contents}
.ds-trust-sub{color:var(--dim);font-size:11.5px}
.ds-tab-badge{margin-left:6px;padding:0 5px;border-radius:999px;background:var(--fill-3);font-size:9.5px;font-variant-numeric:tabular-nums}
/* Unexplained changes: a section a reviewer opens, not a wall that opens itself. */
.ds-unexplained .ds-tri{color:var(--amber);font-size:10px}
.ds-unexplained-note{margin:0;color:var(--muted);font-size:12.5px;line-height:1.5;text-wrap:pretty}
.ds-unexplained-files{display:grid;gap:4px}
.ds-unexplained-file{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:34px;padding:6px 10px;border:1px solid color-mix(in srgb,var(--amber) 20%,transparent);border-radius:9px;background:color-mix(in srgb,var(--amber) 5%,transparent);color:var(--text);font:inherit;text-align:left;cursor:pointer}
.ds-unexplained-file:hover{border-color:color-mix(in srgb,var(--amber) 38%,transparent);background:color-mix(in srgb,var(--amber) 9%,transparent)}
.ds-unexplained-file code{min-width:0;font-family:var(--mono);font-size:11.5px;color:var(--amber-text);overflow-wrap:anywhere}
.ds-unexplained-file-count{flex:none;color:var(--dim2);font-size:10.5px;font-weight:600;font-variant-numeric:tabular-nums}
.ds-unexplained-detail>summary{list-style:none;display:flex;align-items:baseline;gap:8px;min-height:34px;padding:7px 10px;border:1px solid var(--line-soft);border-radius:9px;background:var(--fill-1);color:var(--text);font-size:12px;font-weight:700;cursor:pointer}
.ds-unexplained-detail>summary::-webkit-details-marker{display:none}
.ds-unexplained-detail>summary::before{content:'›';margin-right:1px;color:var(--dim);font-size:14px;font-weight:500;transition:transform var(--motion-duration-fast) var(--motion-ease-out)}
.ds-unexplained-detail[open]>summary::before{transform:rotate(90deg)}
.ds-unexplained-detail>summary:hover{background:var(--fill-2)}
.ds-unexplained-summary-hint{color:var(--dim2);font-size:10.5px;font-weight:600}
.ds-unexplained-cards{display:grid;gap:14px;margin-top:12px}
.ds-unexplained-cards .ds-trust-card{margin-bottom:0}
@media(prefers-reduced-motion:reduce){.ds-unexplained-detail>summary::before{transition:none}}
@media(max-width:720px){.ds-reviewpage{gap:12px;padding:12px}.ds-reviewpage-section{padding:14px}.ds-reviewpanel{gap:12px}.ds-reviewtab{padding:0 10px;font-size:11.5px}.ds-unexplained-summary-hint{display:none}.ds-queue-head{display:grid}.ds-queue-actions{justify-content:stretch}.ds-queue-actions button{flex:1}}
.ds-step{flex:1;min-height:0;display:flex;flex-direction:column}
.ds-step[hidden]{display:none}
.ds-step-top{padding:20px 30px 0;flex:none}
.ds-step-meta{display:flex;align-items:center;gap:10px;margin-bottom:11px}
.ds-step-count{font-size:11.5px;color:var(--dim2);font-variant-numeric:tabular-nums}
.ds-flex{flex:1}
.ds-step-titlerow{display:flex;align-items:baseline;gap:13px;flex-wrap:wrap}
/* Repair moved up here when the review-question row went away; it stays a quiet
   icon parked at the end of the title line. */
.ds-step-titlerow .ds-story-tune{margin-left:auto;align-self:center}
.ds-step-title{min-width:0;max-width:100%;font-size:19px;font-weight:600;margin:0;letter-spacing:-0.01em;color:var(--text);line-height:1.3;overflow-wrap:anywhere}
.ds-why{margin:17px 30px 0;padding:15px 17px;border-radius:13px;background:color-mix(in srgb,var(--accent) 7%,transparent);border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);flex:none;max-height:min(24vh,190px);overflow-y:auto}
.ds-why-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.ds-why-ico{width:15px;height:15px;border-radius:4px;background:color-mix(in srgb,var(--accent) 20%,transparent);display:flex;align-items:center;justify-content:center;position:relative}
.ds-why-ico::after{content:'';width:5px;height:5px;border-radius:50%;background:var(--accent-blue)}
.ds-why-label{font-size:10.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--accent-blue);font-weight:600}
.ds-why-text{margin:0;font-size:14px;line-height:1.58;color:var(--text);text-wrap:pretty}
.ds-step-health{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:8px;margin:0 0 10px;padding:9px 10px;border:1px solid color-mix(in srgb,var(--amber) 34%,var(--line));border-radius:9px;background:var(--amber-soft);color:var(--amber-text)}
.ds-step-health-mark{width:20px;height:20px;display:grid;place-items:center;border-radius:50%;background:var(--amber);color:#211700;font-size:11px;font-weight:900}.ds-step-health-copy{display:grid;gap:1px;min-width:0}.ds-step-health-copy strong{color:var(--text);font-size:11.5px}.ds-step-health-copy small{overflow:hidden;text-overflow:ellipsis;font-size:10.5px;white-space:nowrap}.ds-step-health button{padding:5px 8px;border:1px solid color-mix(in srgb,var(--amber) 28%,var(--line));border-radius:7px;background:transparent;color:var(--amber-text);font:inherit;font-size:10px;font-weight:700;cursor:pointer}.ds-step-health button:hover{background:color-mix(in srgb,var(--amber-soft) 72%,var(--panel2));color:var(--text)}
.ds-beatnav{display:flex;align-items:center;gap:8px;margin:0 0 5px;padding:0 6px;color:var(--muted);font-size:10.5px}.ds-beatnav-current{display:flex;align-items:baseline;gap:4px}.ds-beatnav-current b{color:var(--accent-text);font-size:11px}.ds-beatnav-hint{margin-left:auto;color:var(--dim)}.ds-beatnav-actions{display:flex;gap:3px}.ds-beatnav-actions button{width:25px;height:25px;display:grid;place-items:center;border:1px solid var(--line-soft);border-radius:7px;background:transparent;color:var(--text);cursor:pointer}.ds-beatnav-actions button:hover{background:var(--fill-2)}.ds-beatnav-actions button:disabled{opacity:.3;cursor:default}
.ds-beats{display:grid;min-width:0;gap:8px}
.ds-beat{width:100%;min-width:0;margin:0;padding:6px;display:grid;grid-template-columns:22px minmax(0,1fr);gap:9px;align-items:start;border:1px solid transparent;border-radius:9px;background:transparent;font:inherit;font-size:14px;line-height:1.52;color:var(--text);text-align:left;text-wrap:pretty;cursor:pointer;transition:background var(--motion-duration-fast) ease,border-color var(--motion-duration-fast) ease}
.ds-beat-text{display:block;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:normal}
.ds-beat:hover{background:var(--fill-2)}
.ds-beat:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-beat-index{width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent-blue);font-size:11px;font-weight:700}
.ds-beat.is-selected{border-color:color-mix(in srgb,var(--accent) 28%,transparent);background:color-mix(in srgb,var(--accent) 7%,transparent)}
.ds-beat.is-selected .ds-beat-index{box-shadow:inset 0 0 0 1px var(--accent-blue)}
.ds-beat.is-active .ds-beat-index{background:var(--accent-blue);color:var(--on-accent)}
.ds-beat.is-active .ds-beat-text{color:var(--accent-text)}
.ds-step.is-code-step .ds-beat:not(.is-selected) .ds-beat-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dim)}
.ds-step.is-code-step .ds-beat:not(.is-selected){padding-top:5px;padding-bottom:5px}
.ds-full-diff{height:29px;padding:0 8px;border:1px solid var(--line-soft);border-radius:8px;background:transparent;color:var(--muted);font:inherit;font-size:9.5px;font-weight:700;cursor:pointer}.ds-full-diff:hover{background:var(--fill-2);color:var(--text)}
.ds-step.is-code-step .ds-difftoolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px 8px;align-items:center}.ds-step.is-code-step .ds-difftoolbar>.ds-flex{display:none}.ds-step.is-code-step .ds-full-diff{justify-self:start}.ds-step.is-code-step .ds-modetoggle{justify-self:end}.ds-step.is-code-step .ds-changejump{display:none!important}

/* ---- review comments ---- */
.ds-comment-pin{position:absolute;z-index:7;top:50%;right:8px;transform:translateY(-50%);height:44px;min-width:44px;padding:0 8px;border:1px solid color-mix(in srgb,var(--accent) 50%,transparent);border-radius:999px;
  background:var(--material);box-shadow:0 3px 10px rgba(0,0,0,.28);color:var(--accent-blue);font:inherit;font-size:10.5px;font-weight:700;cursor:pointer}
.ds-comment-pin:hover,.ds-comment-pin[aria-expanded="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ds-row.ds-comment-anchor-target,.ds-urow.ds-comment-anchor-target{position:relative;z-index:2;box-shadow:inset 0 0 0 2px var(--accent-blue),0 0 0 4px var(--accent-soft)}
.ds-flavor-ico{width:18px;height:18px;border-radius:5px;color:var(--on-accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
.ds-md{white-space:normal;overflow-wrap:anywhere}
.ds-md p{margin:0}
.ds-md p+p,.ds-md p+ul,.ds-md p+ol,.ds-md p+blockquote,.ds-md p+.ds-md-code,.ds-md ul+p,.ds-md ol+p,.ds-md blockquote+p,.ds-md .ds-md-code+p{margin-top:10px}
.ds-md strong{font-weight:700;color:var(--text)}
.ds-md em{font-style:italic;color:var(--text)}
.ds-md code{font-family:var(--mono);font-size:.94em;color:var(--text);background:var(--fill-3);border:1px solid var(--line-soft);border-radius:5px;padding:1px 4px;white-space:break-spaces}
.ds-md ul,.ds-md ol{margin:8px 0 0;padding-left:22px}
.ds-md li{padding-left:2px}
.ds-md li+li{margin-top:4px}
.ds-md blockquote{margin:10px 0 0;padding:0 0 0 12px;border-left:2px solid var(--accent);color:var(--muted)}
.ds-md .ds-md-code{margin:10px 0 0;padding:10px 12px;border:1px solid var(--line-soft);border-radius:8px;background:var(--gutter);overflow:auto}
.ds-md .ds-md-code code{display:block;padding:0;border:0;border-radius:0;background:transparent;white-space:pre;overflow-wrap:normal}
/* ---- narrative markup (src/narrative.ts) ---- */
/* The sanitizer emits these tags directly, so each one needs a rule here: a bare
   UA <table> or <pre> ignores the concept column's width and blows it open
   sideways. Px values are hardcoded to sit with the .ds-md neighbours above —
   this block deliberately stays off the type-scale tokens. */
.ds-md .ds-md-tablewrap{margin:12px 0 0;overflow-x:auto;overscroll-behavior-x:contain}
.ds-md table{width:100%;margin:0;border-collapse:collapse;font-size:12.5px;line-height:1.5}
.ds-md caption{caption-side:top;padding:0 0 7px;color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.02em;text-align:left}
/* .ds-md sets overflow-wrap:anywhere at the root and it inherits. Unlike
   break-word, anywhere feeds the min-content width, so an unreset cell shrinks
   to one character per line and every column collapses. */
.ds-md th,.ds-md td{padding:8px 12px;overflow-wrap:normal;word-break:normal;text-align:left;vertical-align:top}
.ds-md thead th{border-bottom:1px solid var(--text-3);color:var(--text);font-weight:700;white-space:nowrap}
.ds-md tbody{border-bottom:1px solid var(--text-3)}
.ds-md tbody th{color:var(--text);font-weight:600}
.ds-md tbody tr:nth-child(even){background:var(--fill-1)}
.ds-md dl{margin:10px 0 0}
.ds-md dt{margin-top:9px;color:var(--text);font-weight:700}
.ds-md dt:first-child{margin-top:0}
.ds-md dd{margin:3px 0 0 16px}
.ds-md hr{height:1px;margin:14px 0;border:0;background:var(--line)}
.ds-md kbd{display:inline-block;min-width:18px;padding:1px 5px;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;background:var(--fill-2);color:var(--text);font-family:var(--mono);font-size:.86em;line-height:1.45;text-align:center;white-space:nowrap}
/* line-height:0 plus a relative offset is the only pair that keeps sup/sub from
   stretching the line box — the concept document runs 1.67 leading and a
   footnote marker must not open a gap in the paragraph it annotates. */
.ds-md sup,.ds-md sub{position:relative;font-size:.72em;line-height:0;vertical-align:baseline}
.ds-md sup{top:-.46em}
.ds-md sub{bottom:-.24em}
/* <pre data-lang> is allowlisted, but only the markdown renderer adds
   .ds-md-code — a narrative <pre> arrives bare and needs its own box. */
.ds-md pre{margin:10px 0 0;padding:10px 12px;border:1px solid var(--line-soft);border-radius:8px;background:var(--gutter);overflow-x:auto;color:var(--text);font-family:var(--mono);font-size:11.5px;line-height:1.5;white-space:pre;overflow-wrap:normal}
/* .ds-md p{margin:0}, so a paragraph following a new block needs the same
   sibling gap the .ds-md-code+p pair already gets. */
.ds-md .ds-md-tablewrap+p,.ds-md dl+p,.ds-md hr+p,.ds-md pre+p{margin-top:10px}
/* The five narrative accents. Each class sets nothing but a hue; the shared
   rules pull the tint and the chip border off currentColor, so the set stays one
   declaration wide. Hues are the syntax palette, which theme.ts already tunes
   for contrast in both themes: bit=literal, slot=identifier, flag=keyword,
   num=numeral, warn=the amber semantic pair. */
.ds-md :is(.ds-bit,.ds-slot,.ds-flag,.ds-val,.ds-warn){background:color-mix(in srgb,currentColor 14%,transparent)}
.ds-md :is(.ds-bit,.ds-slot,.ds-flag,.ds-val){font-family:var(--mono);font-size:.94em;font-weight:600;font-variant-numeric:tabular-nums}
.ds-md span:is(.ds-bit,.ds-slot,.ds-flag,.ds-val,.ds-warn){padding:1px 5px;border-radius:5px}
.ds-md code:is(.ds-bit,.ds-slot,.ds-flag,.ds-val,.ds-warn){border-color:color-mix(in srgb,currentColor 34%,transparent)}
.ds-md :is(th,td).ds-val{text-align:right}
.ds-md .ds-bit{color:var(--tk-s)}
.ds-md .ds-slot{color:var(--tk-f)}
.ds-md .ds-flag{color:var(--tk-k)}
.ds-md .ds-val{color:var(--tk-n)}
.ds-md .ds-warn{color:var(--text);background:var(--amber-soft);box-shadow:inset 0 0 0 1px var(--amber);font-weight:600}
.ds-ghost,.ds-feedback-action{min-height:44px;font-size:12px;font-weight:500;color:var(--text);padding:6px 12px;border-radius:7px;border:1px solid var(--line);background:transparent;cursor:pointer}
.ds-ghost:hover,.ds-feedback-action:hover{background:var(--fill-2)}
.ds-del{color:var(--del-text);border-color:rgba(255,69,58,.34)}.ds-del:hover{background:var(--del-bg);border-color:rgba(255,69,58,.56)}
.ds-composer{position:relative;z-index:8;box-sizing:border-box;width:100%;display:grid;gap:8px;padding:10px 11px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel3);box-shadow:0 8px 24px rgba(0,0,0,.22);font-family:var(--sans)}
.ds-row.ds-comment-draft-anchor,.ds-urow.ds-comment-draft-anchor{z-index:3;box-shadow:inset 2px 0 0 var(--accent-blue);background-image:linear-gradient(90deg,color-mix(in srgb,var(--accent-soft) 62%,transparent),transparent 42%)}
.ds-composer-head{display:flex;align-items:center;gap:7px;min-width:0;min-height:26px}.ds-composer-head strong{font-size:12px;font-weight:650}.ds-composer-anchor{min-width:0;overflow:hidden;text-overflow:ellipsis;padding:3px 6px;border:1px solid var(--line-soft);border-radius:5px;background:var(--fill-1);color:var(--muted);font:9.5px var(--mono);white-space:nowrap}.ds-composer-close{position:relative;flex:none;width:28px;height:28px;margin-left:auto;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dim);font:inherit;font-size:16px;cursor:pointer}.ds-composer-close::after{content:'';position:absolute;inset:-6px}.ds-composer-close:hover{background:var(--fill-2);color:var(--text)}
.ds-composer-main{display:grid;grid-template-columns:1fr;align-items:start;gap:8px}
.ds-composer-tabs{display:inline-flex;justify-self:start;gap:2px;flex-wrap:wrap;padding:2px;border:1px solid var(--line-soft);border-radius:8px;background:var(--fill-1)}
.ds-composer-tab{display:flex;align-items:center;gap:6px;min-height:30px;padding:4px 9px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--muted);font:inherit;font-size:10.5px;font-weight:600;cursor:pointer}
.ds-composer-type-icon{width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dim)}.ds-composer-type-icon svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.ds-composer-tab.is-active{border-color:var(--line-soft);background:var(--panel3);box-shadow:0 1px 3px rgba(0,0,0,.18);color:var(--text)}
.ds-composer-tab[data-flavor="change"].is-active .ds-composer-type-icon{color:var(--del)}
.ds-composer-tab[data-flavor="question"].is-active .ds-composer-type-icon{color:var(--accent-blue)}
.ds-composer-tab[data-flavor="nit"].is-active .ds-composer-type-icon{color:var(--amber)}
.ds-composer-ta{width:100%;min-height:82px;max-height:180px;box-sizing:border-box;resize:vertical;padding:9px 10px;border:1px solid var(--line-soft);border-radius:8px;background:var(--panel2);color:var(--text);font-size:12.5px;font-family:var(--sans);line-height:1.5;outline:none}
.ds-composer-ta::placeholder{color:var(--dim)}.ds-composer-ta:focus{border-color:var(--accent-line);box-shadow:0 0 0 2px var(--accent-soft)}
.ds-composer-foot{display:flex;align-items:center;justify-content:flex-end}.ds-composer-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}.ds-composer-actions button{min-height:34px;height:34px;padding:0 12px;border-radius:7px}.ds-composer-copy{min-width:72px}.ds-composer-add{border-color:var(--line-soft);color:var(--muted)}.ds-composer-add:hover{color:var(--text)}
@media (max-width:620px){.ds-composer{padding:10px}.ds-composer-actions{display:grid;width:100%;grid-template-columns:repeat(2,minmax(0,1fr))}.ds-composer-actions button{width:100%;min-width:0}}

/* ---- all files ---- */
.ds-stat-add{font-family:var(--mono);color:var(--add);font-variant-numeric:tabular-nums}
.ds-stat-del{font-family:var(--mono);color:var(--del);font-variant-numeric:tabular-nums}
.ds-filedetail{flex:1;overflow-y:auto;background:var(--panel3)}
.ds-filepanel{display:flex;flex-direction:column;min-height:100%}
.ds-filepanel[hidden]{display:none}
.ds-filepanel-head{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--material);border-bottom:1px solid var(--line)}
.ds-filepanel-body{position:relative;flex:1;padding-bottom:40px}
.ds-cardpath{font-family:var(--mono);font-size:13.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-cardpath .ds-dim{color:var(--dim)}
.ds-cardpath-base{color:var(--text);font-weight:600}
.ds-untoured-badge{flex:none;display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;background:color-mix(in srgb,var(--amber) 13%,transparent);color:var(--amber)}
.ds-untoured-badge .ds-tri{font-size:9px}
.ds-stepchip{flex:none;font-size:11px;color:var(--muted);padding:3px 9px;border-radius:6px;border:1px solid var(--line);background:transparent;cursor:pointer}
.ds-stepchip:hover{background:var(--fill-2);color:var(--text)}
.ds-cardstat{flex:none;display:flex;gap:8px;font-family:var(--mono);font-size:12px;font-variant-numeric:tabular-nums;justify-content:flex-end}

/* ---- sidebar file list (All files view) ---- */
.ds-railfiles{padding:5px 8px 8px;container-type:inline-size}
.ds-railfiles[hidden]{display:none}
.ds-filetree{display:flex;flex-direction:column;gap:0}
.ds-filetree-dir{margin:0}
.ds-filetree-dir>summary{list-style:none;display:grid;grid-template-columns:14px 16px minmax(0,1fr) auto;align-items:center;gap:5px;width:100%;min-height:28px;padding:4px 6px 4px calc(6px + var(--tree-indent,0px));border-radius:5px;color:var(--muted);cursor:pointer;user-select:none;transition:background-color var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease}
.ds-filetree-dir>summary::-webkit-details-marker{display:none}
.ds-filetree-dir>summary:hover{background:var(--fill-1);color:var(--text)}
.ds-filetree-caret,.ds-filetree-folder,.ds-fileitem-spacer,.ds-fileitem-icon{width:14px;height:16px;display:grid;place-items:center;color:var(--dim)}
.ds-filetree-caret svg,.ds-filetree-folder svg,.ds-fileitem-icon svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.25;stroke-linecap:round;stroke-linejoin:round}
.ds-filetree-caret{transform-origin:center;transition:transform .12s ease}
.ds-filetree-dir[open]>summary .ds-filetree-caret{transform:rotate(90deg)}
.ds-filetree-folder{width:16px;color:var(--muted)}
.ds-filetree-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--sans);font-size:12.5px;font-weight:600;color:var(--text)}
.ds-filetree-meta,.ds-fileitem-meta{min-width:0;display:inline-flex;align-items:center;justify-content:flex-end;gap:7px;margin-left:auto}
.ds-filetree-count{flex:none;font-size:10.5px;color:var(--dim);font-weight:500}
.ds-filetree-stat{flex:none;font-family:var(--mono);font-size:11px;font-variant-numeric:tabular-nums;display:flex;gap:5px}
.ds-filetree-children{display:flex;flex-direction:column;gap:0}
.ds-fileitem{display:grid;grid-template-columns:14px 16px minmax(0,1fr) auto;align-items:center;gap:5px;width:100%;min-height:28px;text-align:left;border:none;background:transparent;cursor:pointer;padding:4px 6px 4px calc(6px + var(--tree-indent,0px));border-radius:5px;font-family:var(--sans);margin:0;transition:background-color var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease,box-shadow var(--motion-duration-ui) var(--motion-ease-out)}
.ds-fileitem:hover{background:var(--fill-1)}
.ds-fileitem.is-active{background:var(--fill-2);box-shadow:inset 2px 0 0 var(--accent-blue)}
.ds-fileitem-icon.k-changed{color:var(--accent-blue)}
.ds-fileitem-icon.k-new{color:var(--add)}
.ds-fileitem-icon.k-context{color:var(--muted)}
.ds-fileitem-path{min-width:0;font-family:var(--sans);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-fileitem-path .ds-dim{color:var(--dim)}
.ds-fileitem-base{color:var(--text);font-weight:500}.ds-fileitem.is-active .ds-fileitem-base{font-weight:600}
.ds-fileitem-flag{flex:none;color:var(--amber);font-size:9px}
.ds-fileitem-stat{flex:none;font-family:var(--mono);font-size:11px;font-variant-numeric:tabular-nums;display:flex;gap:5px}
.ds-fileitem[hidden],.ds-filetree-dir[hidden]{display:none}
.ds-empty-rail{padding:24px 14px;font-size:12.5px}
@container (max-width:300px){.ds-filetree-count{display:none}.ds-filetree-meta,.ds-fileitem-meta{gap:4px}.ds-filetree-stat,.ds-fileitem-stat{font-size:10.5px;gap:3px}}
@media (max-width:720px){
  .ds-viewtoggle .ds-tab{min-height:44px;padding-top:12px;padding-bottom:12px}
  .ds-filetree-dir>summary,.ds-fileitem{min-height:44px}
  .ds-fileitem{padding-right:5px;padding-left:calc(5px + var(--tree-indent,0px))}
  .ds-fileitem-stat{gap:3px;font-size:10.5px}
  .ds-filetree-count{display:none}
}

/* ---- trust drawer ---- */
.ds-drawer-root{position:fixed;inset:0;z-index:50}
.ds-drawer-root[hidden]{display:none}
.ds-drawer-scrim{position:absolute;inset:0;background:var(--scrim);opacity:0;transition:opacity var(--motion-duration-ui) var(--motion-ease-out)}
.ds-drawer{position:absolute;top:0;right:0;width:440px;max-width:92vw;height:100%;background:var(--material);border-left:1px solid var(--line);
  display:flex;flex-direction:column;box-shadow:-30px 0 60px rgba(0,0,0,0.4);transform:translateX(100%);transition:transform var(--motion-duration-progress) var(--motion-ease-drawer)}
.ds-drawer-root.is-open .ds-drawer-scrim{opacity:1}
.ds-drawer-root.is-open .ds-drawer{transform:translateX(0)}
.ds-drawer-head{padding:20px 22px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.ds-drawer-title{font-size:16px;font-weight:600;color:var(--text)}
.ds-drawer-sub{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.45;text-wrap:pretty}
.ds-drawer-x{position:relative;flex:none;width:30px;height:30px;border-radius:var(--radius-sm);border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;font-size:16px}
.ds-drawer-x::after{content:'';position:absolute;inset:-7px}
.ds-drawer-x:hover{background:var(--fill-2)}
.ds-drawer-body{padding:18px 22px;overflow-y:auto;flex:1}
.ds-drift-drawer{width:min(920px,92vw)}
.ds-drift-body{display:grid;grid-template-columns:300px minmax(0,1fr);min-height:0;flex:1}
.ds-drift-list{overflow:auto;padding:10px;border-right:1px solid var(--line)}
.ds-drift-file{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:10px;border:0;border-radius:9px;background:transparent;color:var(--text);font:inherit;text-align:left;cursor:pointer}
.ds-drift-file:hover{background:var(--fill-2)}.ds-drift-file.is-active{background:var(--accent-soft)}
.ds-drift-file-main{display:grid;gap:3px;min-width:0}.ds-drift-file-main code{overflow:hidden;color:inherit;font-family:var(--font-mono);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.ds-drift-file-main>span{color:var(--muted);font-size:10.5px}
.ds-drift-file-meta{display:grid;justify-items:end;gap:4px;flex:none}.ds-drift-file-meta em{padding:2px 5px;border-radius:5px;background:var(--fill-3);color:var(--muted);font-size:9px;font-style:normal;font-weight:700;text-transform:uppercase}.ds-drift-file-meta em.is-story{background:var(--amber-soft);color:var(--amber-text)}
.ds-drift-lines{display:flex;gap:4px;font:10px var(--font-mono)}.ds-drift-lines i{color:var(--add);font-style:normal}.ds-drift-lines b{color:var(--del);font-weight:500}
.ds-drift-detail{display:flex;min-width:0;min-height:0;flex-direction:column}.ds-drift-detail-head{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 14px;border-bottom:1px solid var(--line)}.ds-drift-detail-head code{overflow:hidden;color:var(--muted);font:11px var(--font-mono);text-overflow:ellipsis;white-space:nowrap}
.ds-drift-preview{overflow:auto;min-height:0;flex:1;padding:14px;--ds-scrollpad-t:14px}.ds-drift-preview .ds-diff{margin:0}.ds-drift-back{display:none;border:0;background:transparent;color:var(--accent-text);font:inherit;font-size:12px;font-weight:650;cursor:pointer}
@media(max-width:720px){.ds-drift-drawer{width:100%;max-width:100vw;border-left:0}.ds-drift-body{display:block;min-height:0}.ds-drift-list,.ds-drift-detail{height:100%;border:0}.ds-drift-detail{display:none}.ds-drawer-root.is-detail .ds-drift-list{display:none}.ds-drawer-root.is-detail .ds-drift-detail{display:flex}.ds-drift-back{display:inline-flex;flex:none}}
.ds-trust-stats{display:flex;gap:10px}
.ds-trust-stat{flex:1;padding:13px;border-radius:11px}
.ds-trust-stat.ok{background:rgba(48,209,88,0.08);border:1px solid rgba(48,209,88,0.22)}
.ds-trust-stat.warn{background:color-mix(in srgb,var(--amber) 8%,transparent);border:1px solid color-mix(in srgb,var(--amber) 26%,transparent)}
.ds-trust-num{font-size:23px;font-weight:600;font-variant-numeric:tabular-nums}
.ds-trust-stat.ok .ds-trust-num{color:var(--add)}
.ds-trust-stat.warn .ds-trust-num{color:var(--amber)}
.ds-trust-lbl{font-size:11.5px;margin-top:2px;line-height:1.35}
.ds-trust-stat.ok .ds-trust-lbl{color:var(--add-text)}
.ds-trust-stat.warn .ds-trust-lbl{color:var(--amber-text)}
.ds-trust-card{border:1px solid color-mix(in srgb,var(--amber) 30%,transparent);border-radius:12px;overflow:hidden;margin-bottom:14px}
.ds-trust-card-head{padding:12px 14px;background:color-mix(in srgb,var(--amber) 6%,transparent);display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid color-mix(in srgb,var(--amber) 18%,transparent)}
.ds-trust-card-path{min-width:0;font-family:var(--mono);font-size:12px;color:var(--amber-text);overflow-wrap:anywhere}
.ds-trust-card .ds-diffbody-unified{background:transparent}
.ds-trust-card-actions{padding:12px 14px;display:flex;gap:9px;flex-wrap:wrap;border-top:1px solid var(--line-soft)}
.ds-trust-card-actions .ds-btn{min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;text-align:center}
.ds-trust-clean{padding:16px;border-radius:12px;background:rgba(48,209,88,0.08);border:1px solid rgba(48,209,88,0.22);color:var(--add-text);font-size:13px;line-height:1.5}
.ds-trust-foot{margin-top:4px;font-size:12px;color:var(--dim2);line-height:1.5;text-wrap:pretty}

/* ---- queued review comments ---- */
.ds-feedback-list{display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:11px}.ds-feedback-card{min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:9px;padding:13px;border:1px solid var(--line-soft);border-radius:12px;background:var(--panel3)}.ds-feedback-card.is-targeted{border-color:var(--accent-blue);box-shadow:0 0 0 3px var(--accent-soft)}.ds-feedback-card:focus{outline:none}.ds-feedback-card:focus-visible{box-shadow:0 0 0 3px var(--accent-soft)}.ds-feedback-head{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}.ds-feedback-head .ds-flavor-ico{background:var(--fill-2);color:var(--text)}.ds-feedback-type{color:var(--text);font-size:11.5px;font-weight:700}.ds-feedback-path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:11.5px;color:var(--text)}
.ds-anchorbadge{flex:none;font-size:9.5px;font-weight:600;padding:3px 6px;border-radius:var(--radius-sm);color:var(--muted);background:var(--fill-2)}.ds-anchorbadge.is-changed,.ds-anchorbadge.is-moved{color:var(--amber-text);background:var(--amber-soft)}.ds-feedback-selection{display:block;max-height:82px;overflow:auto;white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;line-height:1.4;padding:8px 9px;border-radius:7px;background:var(--gutter);color:var(--muted)}
.ds-feedback-message{font-size:12.5px;line-height:1.45}.ds-feedback-actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}.ds-drawer-empty{padding:30px 12px;text-align:center;color:var(--muted);font-size:12.5px}
.ds-feedback-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.ds-feedback-compare>div{display:grid;gap:4px;min-width:0}.ds-feedback-compare>div>span{color:var(--dim);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.ds-feedback-selection.is-current{border:1px solid var(--line-soft);background:var(--panel2);color:var(--text)}@media(max-width:560px){.ds-feedback-compare{grid-template-columns:1fr}}
.ds-challenge-panel{display:grid;align-content:start;gap:16px}.ds-challenge-head strong{font-size:15px}.ds-challenge-head p{margin:5px 0 0;color:var(--muted);font-size:12px;line-height:1.5}.ds-challenge-list{display:grid;gap:7px}.ds-challenge-item{display:flex;align-items:flex-start;gap:9px;padding:11px;border:1px solid var(--line-soft);border-radius:10px;background:var(--fill-1);cursor:pointer}.ds-challenge-item input{margin-top:2px}.ds-challenge-item span{display:grid;gap:3px}.ds-challenge-item strong{font-size:12px}.ds-challenge-item small{color:var(--muted);font-size:11px;line-height:1.4}.ds-challenge-targets{display:grid;gap:6px;padding-top:4px}.ds-challenge-targets>span{color:var(--dim);font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.ds-challenge-target{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;padding:9px 10px;text-align:left;border:1px solid var(--line-soft);border-radius:8px;background:transparent;color:var(--text);cursor:pointer}.ds-challenge-target:hover{background:var(--fill-2)}.ds-challenge-target span{grid-column:1;color:var(--amber-text);font-size:9px;font-weight:700}.ds-challenge-target strong{grid-column:1;overflow:hidden;text-overflow:ellipsis;font-size:11.5px;white-space:nowrap}.ds-challenge-target i{grid-column:2;grid-row:1/span 2;align-self:center;color:var(--accent-text);font-style:normal}

/* ---- misc ---- */
.ds-empty{padding:60px 40px;text-align:center;color:var(--muted)}
.ds-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);width:max-content;max-width:min(540px,calc(100vw - 24px));overflow-wrap:anywhere;
  background:var(--material);border:1px solid var(--line);color:var(--text);font-size:13px;line-height:1.45;
  padding:12px 16px;border-radius:var(--radius-lg);box-shadow:var(--shadow);opacity:0;transition:opacity var(--motion-duration-ui),transform var(--motion-duration-ui);z-index:80;pointer-events:none}
.ds-toast.is-show{opacity:1;transform:translateX(-50%) translateY(0)}
.ds-toast.is-error{border-color:color-mix(in srgb,var(--del) 52%,var(--line));background:color-mix(in srgb,var(--del-bg) 42%,var(--material))}
.ds-story-reload-toast{bottom:84px;display:flex;align-items:center;gap:12px;padding:6px 6px 6px 14px;pointer-events:auto}
.ds-story-reload-toast[hidden]{display:none}
.ds-story-reload-toast button{height:36px;padding:0 11px;border:0;border-radius:9px;background:var(--fill-2);color:var(--text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.ds-story-reload-toast button:hover{background:var(--fill-3)}
.ds-story-reload-toast button:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
body.ds-story-reload-pending #ds-toast{bottom:140px}
.ds-selection-menu{position:fixed;z-index:90;min-width:168px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--material);box-shadow:var(--shadow)}
.ds-selection-menu[hidden]{display:none}
.ds-selection-menu button{width:100%;display:block;border:none;border-radius:7px;background:transparent;color:var(--text);font-size:13px;font-weight:700;text-align:left;padding:8px 10px;cursor:pointer}
.ds-selection-menu button:hover{background:var(--fill-2)}
.ds-command-root{position:fixed;inset:0;z-index:100;display:flex;align-items:flex-start;justify-content:center;padding-top:min(16vh,140px)}.ds-command-root[hidden]{display:none}.ds-command-scrim{position:absolute;inset:0;border:0;background:var(--scrim)}.ds-command{position:relative;width:520px;max-width:calc(100vw - 24px);max-height:74vh;overflow:auto;border:1px solid var(--line);border-radius:16px;background:var(--material);box-shadow:0 24px 80px rgba(0,0,0,.48)}
.ds-command-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid var(--line-soft)}.ds-command-head>div{display:grid;gap:3px}.ds-command-head strong{font-size:15px}.ds-command-head span{font-size:11.5px;color:var(--muted)}.ds-command-head>button{width:28px;height:28px;border:1px solid var(--line);border-radius:7px;background:transparent;color:var(--muted);cursor:pointer}.ds-command-list{padding:7px}.ds-command-list>button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:9px;background:transparent;color:var(--text);font:inherit;text-align:left;padding:10px;cursor:pointer}.ds-command-list>button:hover{background:var(--fill-2)}.ds-command-list>button>span{display:grid;gap:2px}.ds-command-list strong{font-size:12.5px}.ds-command-list small{font-size:11px;color:var(--muted)}.ds-command-list kbd{flex:none}.ds-command-foot{display:flex;gap:14px;flex-wrap:wrap;padding:10px 16px 13px;border-top:1px solid var(--line-soft);font-size:10.5px;color:var(--dim)}.ds-command-foot span{display:flex;align-items:center;gap:4px}
.ds-green{color:var(--add)}
`;
/* Structural review-session pass. Kept after the legacy component rules so the
   redesign can stay reviewable as one intentional layer while behavior remains
   owned by the existing DOM and client contracts. */
const SESSION_REDESIGN_CSS = `
.ds-top{height:56px;padding:0 14px;gap:10px;background:var(--panel3);border-bottom-color:var(--line)}
.ds-titlewrap{gap:3px}.ds-title{font-size:14px;font-weight:700}.ds-kicker{font-size:9.5px}.ds-crumb-repo{font-size:11.5px}
.ds-sidebar-toggle,.ds-back,.ds-readaloud{min-height:36px}
.ds-layout{background:transparent}
.ds-rail{background:var(--surface)}
.ds-railpad{padding:10px 10px 0}.ds-viewtoggle{padding:3px;border:0;border-radius:10px;background:var(--fill-2);box-shadow:inset 0 0 0 1px var(--line-soft)}
.ds-tab{min-height:30px;padding:6px 12px;border:0!important;border-radius:7px;color:var(--dim);font-size:11.5px;letter-spacing:.01em}.ds-tab:hover{background:var(--fill-1);color:var(--text)}.ds-tab.is-active{background:var(--panel4);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.25)}
.ds-readhead{margin:9px 16px 2px;padding:7px 0 13px;border:0;border-radius:0;background:transparent}.ds-readhead-label{font-size:9.5px;letter-spacing:var(--tracking-kicker);color:var(--dim);font-weight:500}.ds-readhead-count{font-size:10.5px;color:var(--dim);font-weight:600}.ds-readhead-track{left:0;right:0;bottom:5px;height:2px;background:var(--fill-3)}
:root[data-theme="light"] .ds-railpad{padding:10px 16px 0}
:root[data-theme="light"] .ds-viewtoggle{position:relative;min-height:40px;padding:0 2px;border-radius:0;background:transparent;box-shadow:inset 0 -1px 0 var(--line)}
:root[data-theme="light"] .ds-tab{position:relative;min-height:40px;padding:0 12px;border-radius:0;color:var(--text-2);font-size:11.5px;font-weight:600;box-shadow:none}
:root[data-theme="light"] .ds-tab::after{content:'';position:absolute;bottom:0;left:50%;width:32px;height:2px;border-radius:2px 2px 0 0;background:var(--accent);transform:translateX(-50%) scaleX(0);transform-origin:center;transition:transform var(--motion-duration-fast) var(--motion-ease-out)}
:root[data-theme="light"] .ds-tab:hover{background:var(--fill-1);color:var(--text)}
:root[data-theme="light"] .ds-tab.is-active{background:transparent;color:var(--text);box-shadow:none}
:root[data-theme="light"] .ds-tab.is-active::after{transform:translateX(-50%) scaleX(1)}
:root[data-theme="light"] .ds-tab:focus-visible{outline:none;border-radius:6px;box-shadow:inset 0 0 0 2px var(--accent-line)}
:root[data-theme="light"] .ds-resume-review{min-height:34px;margin-top:6px;padding:5px 8px 5px 4px;border-radius:8px;background:transparent;color:var(--accent);font-size:11px;font-weight:600}
:root[data-theme="light"] .ds-resume-review>span[aria-hidden="true"]{width:24px;height:24px;display:grid;place-items:center;border-radius:6px;background:var(--accent-soft);font-size:12px}
:root[data-theme="light"] .ds-resume-review:hover{background:var(--accent-soft)}
:root[data-theme="light"] .ds-resume-review:focus-visible{outline:none;box-shadow:0 0 0 2px var(--accent-line)}
:root[data-theme="light"] .ds-readhead[data-rail="files"]{margin-top:5px;padding-top:11px;border-top:1px solid var(--line-soft)}
:root[data-theme="light"] .ds-readhead[data-rail="files"] .ds-readhead-label{color:var(--text-2);font-weight:600}
.ds-railscroll{padding:4px 8px 10px}.ds-railsteps{padding-top:2px}.ds-spine{left:25px;top:19px;bottom:19px;width:1px;background:var(--line-soft)}
.ds-railsteps:has(.ds-railchapter)>.ds-spine{display:none}.ds-railchapter{position:relative;margin:3px 0 7px}.ds-railchapter>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:30px;padding:4px 9px;list-style:none;border-radius:7px;color:var(--muted);cursor:pointer;font-size:10px;font-weight:700;letter-spacing:.055em;text-transform:uppercase}.ds-railchapter>summary::-webkit-details-marker{display:none}.ds-railchapter>summary:hover{background:var(--fill-1);color:var(--text)}.ds-railchapter>summary small{color:var(--dim);font-size:9px;font-weight:600;letter-spacing:0;text-transform:none}.ds-railchapter>summary::before{content:'›';width:12px;color:var(--dim);font-size:14px;transform-origin:center;transition:transform var(--motion-duration-fast) ease}.ds-railchapter[open]>summary::before{transform:rotate(90deg)}.ds-railchapter>summary span{margin-right:auto}.ds-railchapter-steps{position:relative}.ds-railchapter-steps::before{content:'';position:absolute;top:8px;bottom:8px;left:17px;width:1px;background:var(--line-soft)}
.ds-stepcard{position:relative;grid-template-columns:42px minmax(0,1fr);margin:0 0 2px;padding:9px 11px 10px 0;border-radius:9px;transition:background .12s ease,color .12s ease}.ds-stepcard::after{content:'';position:absolute;top:7px;bottom:7px;left:0;width:3px;border-radius:0 3px 3px 0;background:transparent}.ds-stepcard:hover{background:var(--fill-1)}
.ds-num{margin:1px 0 0 14px;width:22px;height:22px;border:none;border-radius:0;background:transparent;font-family:var(--font-display);font-size:12px;font-weight:700;letter-spacing:var(--tracking-numeral);color:var(--numeral-dim)}.ds-stepcard-title{font-size:12.5px;line-height:1.34;font-weight:600}.ds-stepcard-fileline{gap:6px;margin-top:2px}.ds-stepcard-file{font-size:10px;line-height:1.3}.ds-railbadge{padding:1px 5px;font-size:8px;border-radius:4px}
.ds-stepcard.is-active{background:var(--fill-2)}.ds-stepcard.is-active::after{background:var(--accent-blue)}.ds-stepcard.is-active .ds-num{background:transparent;border:none;color:var(--accent-blue);box-shadow:none}.ds-stepcard.is-active .ds-stepcard-title{font-weight:700}
.ds-stepcard.is-visited:not(.is-active) .ds-num{background:transparent;border:none;color:var(--muted)}.ds-stepcard.is-visited:not(.is-active) .ds-stepcard-title{color:var(--muted)}
.ds-railstory-node{position:relative}.ds-railbeats{display:none;margin:-2px 8px 10px 42px;padding:3px 0 2px 12px;border-left:1px solid color-mix(in srgb,var(--accent-blue) 28%,var(--line-soft))}.ds-railstory-node.is-active>.ds-railbeats{display:block}
.ds-railbeats-head{display:flex;align-items:center;gap:6px;min-height:27px;padding:0 2px 3px;color:var(--dim);font-size:8.5px;font-weight:700;letter-spacing:.075em;text-transform:uppercase}.ds-railbeats-health{display:inline-flex;align-items:center;gap:4px;color:var(--amber-text);letter-spacing:0;text-transform:none}.ds-railbeats-health i{width:5px;height:5px;border-radius:50%;background:var(--amber)}.ds-railbeats-count{margin-left:auto;font-family:var(--mono);font-size:8.5px;font-weight:600;letter-spacing:0}.ds-railbeats-head .ds-story-tune{margin-left:1px}.ds-railbeats-head .ds-story-tune>summary{width:28px;min-height:28px;padding:0;border:0;border-radius:6px;font-size:9px;letter-spacing:1px}.ds-railbeats-head .ds-story-tune-pop{right:-2px;top:calc(100% + 4px);text-transform:none;letter-spacing:0}
.ds-railbeat-list{display:grid;gap:1px}.ds-railbeat{position:relative;display:grid;grid-template-columns:26px minmax(0,1fr);align-items:center;gap:6px;width:100%;min-height:40px;margin:0;padding:5px 7px 5px 0;border:0;border-radius:7px;background:transparent;color:var(--dim);font:inherit;text-align:left;cursor:pointer}.ds-railbeat::before{content:'';position:absolute;left:-13px;top:50%;width:9px;border-top:1px solid var(--line-soft)}.ds-railbeat:hover{background:var(--fill-1);color:var(--muted)}.ds-railbeat-marker{display:grid;place-items:center;width:24px;height:24px;border-radius:6px;color:var(--dim);font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.04em}.ds-railbeat-text{min-width:0;overflow:hidden;text-overflow:ellipsis;color:inherit;font-size:10.5px;font-weight:500;line-height:1.32;white-space:nowrap}.ds-railbeat.is-visited:not(.is-selected){color:var(--muted)}.ds-railbeat.is-visited:not(.is-selected) .ds-railbeat-marker::after{content:'✓';font-family:var(--sans);font-size:9px}.ds-railbeat.is-visited:not(.is-selected) .ds-railbeat-marker{font-size:0}.ds-railbeat.is-selected{background:var(--accent-soft);color:var(--text)}.ds-railbeat.is-selected::before{border-color:var(--accent-blue)}.ds-railbeat.is-selected .ds-railbeat-marker{background:var(--accent-blue);color:var(--on-accent)}.ds-railbeat.is-active .ds-railbeat-text{color:var(--accent-text)}
.ds-stepcard.is-intro{grid-template-columns:42px minmax(0,1fr);margin:9px 10px 2px;padding:9px 10px 10px 0;border:1px solid var(--line-soft);border-radius:10px;background:transparent}.ds-stepcard.is-intro:hover{background:var(--fill-1)}.ds-stepcard.is-intro .ds-num{width:28px;height:28px;margin:0 0 0 10px;border-radius:8px;background:var(--fill-2);color:var(--accent-blue)}.ds-stepcard.is-intro .ds-stepcard-title{font-size:12.5px}.ds-stepcard.is-intro .ds-intro-cardsub{margin-top:2px;font-size:10px;color:var(--dim)}.ds-stepcard.is-intro.is-active{background:var(--fill-2);border-color:var(--line)}.ds-stepcard.is-intro.is-active::after{background:var(--accent-blue)}.ds-stepcard.is-intro.is-active .ds-num{background:var(--accent-soft);color:var(--accent-blue);box-shadow:none}.ds-stepcard.is-intro.is-active .ds-stepcard-title{color:var(--text)}.ds-stepcard.is-intro.is-active .ds-intro-cardsub{color:var(--muted)}
.ds-step[hidden]{display:none!important}
.ds-step.is-code-step{position:relative;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.ds-step.is-code-step>.ds-step-top{flex:none;padding:16px 22px 0}
.ds-step-title{font-size:18px}.ds-step-meta{margin-bottom:8px}
.ds-story-tune.is-icon>summary{position:relative;width:34px;min-height:34px;padding:0;border-color:transparent;font-size:9px;letter-spacing:1px}
.ds-hotspot-flag{flex:none;display:flex;align-items:baseline;gap:9px;margin:2px 22px 3px;padding:6px 11px;border:1px solid color-mix(in srgb,var(--amber) 32%,transparent);border-radius:8px;background:color-mix(in srgb,var(--amber) 6%,var(--panel))}
.ds-hotspot-flag-kicker{flex:none;font-family:var(--mono);font-size:9.5px;font-weight:500;letter-spacing:var(--tracking-kicker);text-transform:uppercase;color:var(--amber)}
.ds-hotspot-flag-reason{min-width:0;font-size:12.5px;line-height:1.45;color:var(--muted);text-wrap:pretty}
/* No side or bottom padding: the code is full-bleed to the island's edges, so the
   island rule is the only frame around it and the toolbar / file head read as its
   headers. Only the top gap survives, to part the title block from the toolbar. */
.ds-step.is-code-step>.ds-diffscroll{flex:1;min-width:0;min-height:180px;padding:8px 0 0;--ds-scrollpad-t:8px;overflow-x:hidden;overflow-y:auto}
/* The beat dock is rendered by its step but it lives in the bottom island — the
   client adopts it into .ds-dock-stage as the step comes up. So it draws no glass
   of its own: the island is the only floating surface, and this is one row in it. */
.ds-beatdock{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;min-width:0;margin:0;padding:0;border:0;background:transparent}.ds-beatdock[hidden]{display:none}.ds-beatdock-count{display:flex;align-items:baseline;gap:3px;min-width:43px;color:var(--dim);font-family:var(--mono);font-size:9px;font-variant-numeric:tabular-nums}.ds-beatdock-count b{color:var(--accent-blue);font-size:10.5px}.ds-beatdock-copy{min-width:0}.ds-beatdock-copy .ds-beats{display:grid}.ds-beatdock-note{display:none;width:100%;min-width:0;margin:0;padding:0;border:0;background:transparent;color:var(--text);font:inherit;font-size:11.5px;font-weight:500;line-height:1.42;text-align:left;cursor:pointer}.ds-beatdock-note.is-selected{display:block;background:transparent}.ds-beatdock-note:hover{background:transparent}.ds-beatdock-note:hover .ds-beat-text{color:var(--accent-text)}.ds-beatdock-note:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft);border-radius:3px}.ds-beatdock-note .ds-beat-text{display:-webkit-box;min-width:0;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;text-wrap:pretty}.ds-beatdock-note.is-active .ds-beat-text{color:var(--accent-text)}.ds-beatdock-actions{display:flex;align-items:center;gap:4px}.ds-beatdock-actions button{width:34px;height:34px;display:grid;place-items:center;padding:0;border:1px solid var(--line-soft);border-radius:9px;background:transparent;color:var(--muted);font:inherit;cursor:pointer;transition:background var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease,border-color var(--motion-duration-fast) ease}.ds-beatdock-actions button:hover:not(:disabled){background:var(--fill-2);border-color:color-mix(in srgb,var(--accent) 26%,var(--line-soft));color:var(--text)}.ds-beatdock-actions button:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}.ds-beatdock-actions button:disabled{opacity:.28;cursor:default}.ds-beatdock.is-single{grid-template-columns:auto minmax(0,1fr)}.ds-beatdock.is-single .ds-why-text{min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-size:11.5px;white-space:nowrap}
.ds-railbeat{min-height:44px}
/* ---- Filmstrip walkthrough (Signal 3b): rail hidden in Story view; each step is a
   centered stage with an oversized numeral; the bottom numeral thread is the whole nav. ---- */
body:not([data-read-view="files"]) .ds-rail{display:none}
body:not([data-read-view="files"]) .ds-sidebar-toggle{display:none}
/* Story view floats the stage as its own island on the ink page. The frame drops
   its border outright rather than only its colour: a transparent 1px edge still
   shrinks the content box, and that stray pixel is what pushed the islands inside
   it out of line with the chrome above. */
body[data-read-view="tour"] .ds-main{background:transparent;border:0;overflow:visible}
#ds-view-tour:not([hidden]){flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;position:relative}
/* One gutter, set once on the page frame: the chrome, the stage and the dock are
   three stacked islands, so they answer to body's 12px padding and nothing else.
   The inner inset this rule used to add made the stage 13px narrower per side than
   the chrome directly above it — three blocks, three edges, no line to read down. */
#ds-view-tour>:not(.ds-dock):not(.ds-filmthread):not([hidden]){flex:1;min-height:0;width:100%;max-width:none;margin:0;background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--radius-island)}
/* The stage keeps the same quiet edge as the chrome and the dock. "Reading here"
   and "speaking now" used to tint this border, which made sense when the stage was
   a card among siblings; once it grew to fill the frame, that accent was a saturated
   rectangle the width of the window, outlining the one region nothing competes with.
   Both states are already legible where the reader is looking: the focus rows carry
   the accent inside the diff, and the dock carries the beat, the transport and the
   lit numeral. Nothing may put a coloured ring back on this island. */
/* ---- The dock: one floating island at the foot of the story ----
   Transport, the beat you are on, and the numeral thread were three separate bars
   answering the same question. Stacked in one island they read as one instrument:
   press play on the left, the current beat speaks in the middle, the thread below
   shows where that beat sits in the whole story. */
.ds-dock{position:relative;z-index:3;flex:none;display:flex;flex-direction:column;width:100%;min-width:0;max-width:100%;margin:0;border:1px solid color-mix(in srgb,var(--line-soft) 78%,transparent);border-radius:16px;background:color-mix(in srgb,var(--surface-2) 86%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--text) 5%,transparent),0 1px 2px rgba(0,0,0,.05),0 16px 40px rgba(0,0,0,.17);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%)}
/* Ink casts a heavier shadow than paper: the dark theme needs the lift to read as
   floating, the light one only needs a hint or the island looks bruised. */
:root[data-theme="light"] .ds-dock{box-shadow:inset 0 1px 0 color-mix(in srgb,var(--text) 4%,transparent),0 1px 2px rgba(15,23,42,.05),0 12px 30px rgba(15,23,42,.09)}
.ds-dock-transport{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:12px;min-width:0;min-height:52px;padding:8px 12px 8px 10px}
.ds-dock-stage{position:relative;min-width:0}
.ds-dock-idle{min-width:0;margin:0;overflow:hidden;color:var(--dim);font-size:11.5px;font-weight:600;letter-spacing:-.01em;line-height:1.42;text-overflow:ellipsis;white-space:nowrap}
.ds-dock-idle[hidden]{display:none}
/* Hairline seam, not a border: the two rows are one surface split by light. */
.ds-dock-transport::after{content:'';position:absolute;left:1px;right:1px;bottom:0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--text) 11%,transparent) 12%,color-mix(in srgb,var(--text) 11%,transparent) 88%,transparent)}
.ds-filmthread{position:relative;z-index:1;flex:none;display:flex;align-items:center;gap:12px;min-width:0;padding:3px 10px 6px}
/* The thread yields its containing block to the island so a numeral's tooltip
   clears the whole dock. Anchored to the thread it opened straight onto the beat
   text one row up — the label covered the sentence it was meant to preview. */
.ds-dock>.ds-filmthread{position:static}
.ds-filmthread.is-overview{display:none}
/* Storyless review has no island to sit in, so that thread keeps its own glass. */
.ds-filmthread.is-storyless{width:100%;max-width:100%;margin:0;padding:7px 12px 8px;border:1px solid color-mix(in srgb,var(--line-soft) 76%,transparent);border-radius:14px;background:color-mix(in srgb,var(--surface-2) 84%,transparent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--text) 4%,transparent),0 7px 24px rgba(0,0,0,.07);backdrop-filter:blur(18px) saturate(130%);-webkit-backdrop-filter:blur(18px) saturate(130%)}
.ds-filmthread-scroll{position:relative;flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;padding:4px;scrollbar-width:none}.ds-filmthread-scroll::-webkit-scrollbar{display:none}
.ds-filmthread-line{position:absolute;left:0;right:0;top:40px;height:1px;opacity:.82;background:linear-gradient(90deg,var(--thread) 0 var(--thread-pct,0%),var(--thread-dim) var(--thread-pct,0%) 100%)}
.ds-filmthread-nodes{position:relative;display:flex;align-items:flex-end;justify-content:space-between;gap:4px;width:max-content;min-width:100%;padding:0 4px}
.ds-filmnode{--ds-dock-scale:1;--ds-dock-lift:0px;position:relative;display:grid;place-items:start center;flex:none;width:42px;min-width:42px;min-height:42px;padding:3px 0 0;border:0;background:transparent;color:inherit;cursor:pointer}.ds-filmnode.is-overview{width:42px;min-width:42px}.ds-filmnode:focus-visible{box-shadow:none}
.ds-filmnode::after{content:'';position:absolute;inset:-3px}
.ds-filmnode-num{position:relative;z-index:1;display:grid;place-items:center;width:28px;min-width:28px;height:28px;min-height:28px;padding:0;border:1px solid transparent;border-radius:9px;background:transparent;font-family:var(--font-display);font-size:14px;font-weight:700;letter-spacing:var(--tracking-numeral);line-height:1;color:color-mix(in srgb,var(--text-2) 72%,var(--numeral-dim));transform:translateY(var(--ds-dock-lift)) scale(var(--ds-dock-scale));transform-origin:center bottom;will-change:transform;transition:transform 220ms var(--motion-ease-drawer),color var(--motion-duration-fast) ease,background-color var(--motion-duration-fast) ease,border-color var(--motion-duration-fast) ease,box-shadow var(--motion-duration-fast) ease}
.ds-filmnode-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.ds-filmnode:is(:hover,:focus-visible){--ds-dock-scale:1.24;--ds-dock-lift:-5px}.ds-filmnode:is(:hover,:focus-visible) .ds-filmnode-num{z-index:4;color:var(--text);border-color:color-mix(in srgb,var(--text) 9%,transparent);background:color-mix(in srgb,var(--surface) 90%,transparent);box-shadow:0 7px 16px rgba(0,0,0,.16),inset 0 1px 0 color-mix(in srgb,var(--text) 5%,transparent)}
.ds-filmnode:has(+.ds-filmnode:is(:hover,:focus-visible)),.ds-filmnode:is(:hover,:focus-visible)+.ds-filmnode{--ds-dock-scale:1.09;--ds-dock-lift:-2px}
.ds-filmnode:has(+.ds-filmnode+.ds-filmnode:is(:hover,:focus-visible)),.ds-filmnode:is(:hover,:focus-visible)+.ds-filmnode+.ds-filmnode{--ds-dock-scale:1.025;--ds-dock-lift:-.5px}
.ds-filmnode.is-visited .ds-filmnode-num{color:var(--text-2)}
.ds-filmnode.is-active::before{content:'';position:absolute;bottom:0;left:50%;width:4px;height:4px;border-radius:50%;background:var(--accent);transform:translateX(-50%);box-shadow:0 0 8px var(--accent-glow)}.ds-filmnode.is-active .ds-filmnode-num{color:var(--accent);text-shadow:0 0 12px var(--accent-glow)}
.ds-filmthread-tooltip{position:absolute;left:var(--ds-film-tooltip-x,50%);bottom:calc(100% + 5px);z-index:8;width:max-content;max-width:min(520px,calc(100vw - 32px));max-height:none;overflow:visible;padding:7px 10px;border:1px solid color-mix(in srgb,var(--text) 8%,var(--line-soft));border-radius:8px;background:color-mix(in srgb,var(--panel3) 96%,transparent);box-shadow:0 8px 22px rgba(0,0,0,.2);opacity:0;color:var(--text);font-family:var(--sans);font-size:11px;font-weight:600;line-height:1.35;letter-spacing:0;text-align:center;text-wrap:pretty;white-space:normal;overflow-wrap:anywhere;pointer-events:none;transform:translate(-50%,4px) scale(.98);transform-origin:50% 100%;transition:opacity var(--motion-duration-fast) ease,transform var(--motion-duration-fast) var(--motion-ease-out);backdrop-filter:blur(14px) saturate(125%);-webkit-backdrop-filter:blur(14px) saturate(125%)}.ds-filmthread-tooltip.is-visible{opacity:1;transform:translate(-50%,0) scale(1)}
@media (hover:none),(pointer:coarse){.ds-filmnode{--ds-dock-scale:1!important;--ds-dock-lift:0px!important}.ds-filmthread-tooltip{display:none}.ds-beatdock-actions button{width:42px;height:42px;border-radius:11px}}
.ds-filmthread-allfiles{flex:none;align-self:center;height:34px;padding:0 13px;border:1px solid var(--line-soft);border-radius:var(--radius);background:var(--fill-1);color:var(--text-2);font:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.ds-filmthread-allfiles:hover{background:var(--fill-2);color:var(--text)}
.ds-badge-concept{border-color:color-mix(in srgb,var(--accent-blue) 34%,var(--line));background:var(--accent-soft);color:var(--accent-blue)}
.ds-stepcard.is-concept .ds-num{font-style:normal}
.ds-stepcard.is-concept .ds-stepcard-file{font-family:var(--sans);font-weight:600;letter-spacing:.01em}
.ds-concept-step{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.ds-concept-step>.ds-step-top{flex:none;padding:16px 22px 0}
.ds-concept-scroll{flex:1;min-height:0;overflow-y:auto;padding:18px 28px 42px}
.ds-concept-document{width:min(100%,860px);margin:0 auto;padding:34px 42px 38px;border:1px solid var(--line-soft);border-radius:16px;background:var(--panel2);box-shadow:0 16px 42px rgba(0,0,0,.12)}
.ds-concept-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:11px}
.ds-concept-eyebrow{display:inline-flex;align-items:center;gap:8px;color:var(--accent-blue);font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.ds-concept-eyebrow span{font-size:14px;line-height:1}
.ds-concept-title{max-width:22ch;margin:0;color:var(--text);font-size:30px;font-weight:700;letter-spacing:-.025em;line-height:1.12}
.ds-concept-body{max-width:72ch;margin-top:22px;color:var(--muted);font-size:15px;line-height:1.67}.ds-concept-body p{margin:0 0 14px}.ds-concept-body h2,.ds-concept-body h3,.ds-concept-body h4{margin:24px 0 9px;color:var(--text);font-size:15px;font-weight:700;letter-spacing:-.005em}.ds-concept-body h2:first-child,.ds-concept-body h3:first-child{margin-top:0}.ds-concept-body ul,.ds-concept-body ol{display:grid;gap:8px;margin:10px 0 17px;padding-left:22px}.ds-concept-body li::marker{color:var(--accent-blue)}.ds-concept-body blockquote{margin:18px 0;padding:1px 0 1px 15px;border-left:3px solid var(--accent-blue);color:var(--text)}.ds-concept-body code{padding:2px 5px;border:1px solid var(--line-soft);border-radius:5px;background:var(--fill-2);color:var(--text);font-family:var(--mono);font-size:.88em}.ds-concept-body .ds-md-code{overflow:auto;margin:16px 0;padding:13px 15px;border:1px solid var(--line-soft);border-radius:9px;background:var(--panel3)}
/* The concept document runs 15px/1.67, so the narrative blocks step up with it.
   These sit in SESSION_REDESIGN_CSS, which is concatenated after PAGE_CSS_CORE —
   that source order is the only reason they beat .ds-md at equal specificity.
   The wrap still owns overflow-x, so a wide table scrolls inside the measure and
   .ds-concept-scroll keeps its vertical-only axis. */
.ds-concept-body .ds-md-tablewrap{margin:18px 0 20px}.ds-concept-body table{font-size:13.5px;line-height:1.55}.ds-concept-body caption{padding-bottom:9px;color:var(--muted);font-size:11.5px}.ds-concept-body th,.ds-concept-body td{padding:9px 14px}.ds-concept-body dl{margin:14px 0 18px}.ds-concept-body dt{margin-top:13px}.ds-concept-body dd{margin:4px 0 0 18px}.ds-concept-body hr{margin:24px 0;background:var(--line-soft)}.ds-concept-body kbd{font-size:.8em}.ds-concept-body pre{margin:16px 0;padding:13px 15px;border-radius:9px;background:var(--panel3);font-size:12px}
.ds-concept-diagram{margin:26px 0 0;padding-top:22px;border-top:1px solid var(--line-soft)}
.ds-concept-diagram-output{display:flex;align-items:center;justify-content:center;min-height:210px;overflow:auto;padding:20px;border:1px solid var(--line-soft);border-radius:12px;background:var(--panel3)}.ds-concept-diagram-output svg{display:block;max-width:100%;height:auto}.ds-concept-diagram-loading{color:var(--dim);font-size:12px}.ds-concept-diagram.is-error .ds-concept-diagram-output{min-height:0;padding:14px;color:var(--amber-text);font-size:12px}
.ds-concept-diagram figcaption{margin-top:9px;color:var(--muted);font-size:11.5px;line-height:1.45}.ds-concept-diagram-source{margin-top:8px;color:var(--muted);font-size:11px}.ds-concept-diagram-source>summary{cursor:pointer}.ds-concept-diagram-source pre{overflow:auto;margin:8px 0 0;padding:12px;border:1px solid var(--line-soft);border-radius:8px;background:var(--panel3);color:var(--muted);font-family:var(--mono);font-size:10.5px;line-height:1.5}
.ds-concept-next{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 18px;width:100%;margin-top:28px;padding:15px 17px;text-align:left;border:1px solid color-mix(in srgb,var(--accent-blue) 34%,var(--line));border-radius:11px;background:var(--accent-soft);color:var(--text);cursor:pointer}.ds-concept-next:hover{border-color:var(--accent-blue);background:color-mix(in srgb,var(--accent-soft) 84%,var(--panel2))}.ds-concept-next-kicker{grid-column:1;color:var(--accent-blue);font-size:9.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.ds-concept-next-title{grid-column:1;overflow:hidden;text-overflow:ellipsis;color:var(--text);font-size:13px;font-weight:700;white-space:nowrap}.ds-concept-next-arrow{grid-column:2;grid-row:1 / span 2;align-self:center;color:var(--accent-blue);font-size:18px}
.ds-diff{border-radius:10px;box-shadow:none}.ds-difftoolbar{background:var(--panel2)}
.ds-introwrap{max-width:920px;padding:50px 48px 64px}.ds-intro-title{font-size:30px}.ds-intro-lede{max-width:68ch;margin-top:16px;color:color-mix(in srgb,var(--text) 72%,transparent);line-height:1.55}.ds-intro-context .ds-intro-design{margin-top:0;color:color-mix(in srgb,var(--text) 70%,transparent);line-height:1.54}.ds-intro-context .ds-intro-design+.ds-intro-design{margin-top:12px}
.ds-intro-facts{margin-top:26px;border-radius:11px}.ds-fact{padding:13px 15px}.ds-intro-start{margin-top:24px;border-radius:10px;transition:background-color 120ms ease-out,transform 100ms ease-out}.ds-intro-start:active{transform:scale(.98)}
.ds-intro-actions{margin-top:22px}.ds-intro-actions .ds-intro-start{display:inline-flex;flex-direction:row;align-items:center;min-height:44px;margin:0;padding:11px 18px}
.ds-intro-freshness{display:flex;align-items:center;gap:7px;margin-top:14px;color:var(--amber-text);font-size:11.5px;line-height:1.4}.ds-intro-freshness>span:first-child{font-size:8px}.ds-intro-freshness a{color:inherit;font-weight:650;text-decoration:underline;text-underline-offset:3px}.ds-intro-freshness a:hover{color:var(--text)}.ds-intro-freshness.is-current{color:var(--muted)}
.ds-drift-trigger{width:auto;padding:0;border:0;background:transparent;font:inherit;cursor:pointer;text-align:left}.ds-drift-trigger:hover{color:var(--text)}.ds-drift-trigger-link{font-weight:650;text-decoration:underline;text-underline-offset:3px}
.ds-intro-utility{display:flex;align-items:center;flex-wrap:wrap;gap:7px 18px;max-width:820px;margin-top:15px;color:var(--dim);font-size:11.5px}.ds-intro-scope{font-family:var(--mono);font-size:10.5px;letter-spacing:.02em}.ds-intro-notes{min-width:0}.ds-intro-notes>summary{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:2px 0;list-style:none;color:var(--muted);font-weight:600;cursor:pointer}.ds-intro-notes>summary::-webkit-details-marker{display:none}.ds-intro-notes>summary:hover{color:var(--text)}.ds-intro-notes-caret{color:var(--dim);font-size:13px;transition:transform var(--motion-duration-fast) var(--motion-ease-in-out)}.ds-intro-notes[open]{flex-basis:100%;width:100%}.ds-intro-notes[open] .ds-intro-notes-caret{transform:rotate(180deg)}.ds-intro-notes-body{margin-top:8px;padding:14px 16px 16px;border:1px solid var(--line-soft);border-radius:10px;background:var(--panel2)}
.ds-intro-notes .ds-intro-hotspots{margin:0}.ds-intro-notes .ds-intro-hotspots ul{margin:9px 0 0;gap:0}.ds-intro-notes .ds-intro-hotspots li+li{border-top:1px solid var(--line-soft)}.ds-intro-notes .ds-intro-hotspots button{padding:10px 8px;border:0;border-radius:7px;background:transparent}.ds-intro-notes .ds-intro-hotspots button:hover{border-color:transparent;background:var(--fill-1)}.ds-intro-notes .ds-intro-context{max-width:none;margin:0;padding:0;border:0}.ds-intro-notes .ds-intro-hotspots+.ds-intro-context{margin-top:16px;padding-top:15px;border-top:1px solid var(--line-soft)}.ds-intro-notes .ds-intro-nongoals{margin-top:16px;padding-top:14px;border-top:1px solid var(--line-soft)}.ds-intro-notes .ds-intro-nongoals:first-child{margin-top:0;padding-top:0;border-top:0}
.ds-intro-allfiles{min-height:28px;padding:2px 0;border:0;background:transparent;color:var(--muted);font:inherit;font-weight:600;cursor:pointer}.ds-intro-allfiles:hover{color:var(--text)}
.ds-symbols{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden}.ds-symbols code{max-width:130px;overflow:hidden;text-overflow:ellipsis;padding:3px 6px;border:1px solid var(--line-soft);border-radius:6px;background:var(--fill-1);color:var(--muted);font-family:var(--mono);font-size:9.5px;white-space:nowrap}.ds-fileitem-symbol{min-width:0;max-width:82px;overflow:hidden;text-overflow:ellipsis;color:var(--dim);font-family:var(--mono);font-size:9px;white-space:nowrap}
.ds-filefilter-menu{position:relative}.ds-filefilter-menu>summary{display:flex;align-items:center;justify-content:space-between;gap:6px;height:28px;padding:0 9px;list-style:none;border:1px solid var(--line-soft);border-radius:8px;background:transparent;color:var(--muted);font-size:10.5px;cursor:pointer}.ds-filefilter-menu>summary::-webkit-details-marker{display:none}.ds-filefilter-menu>summary strong{margin-right:auto;color:var(--text)}.ds-filefilter-menu[open] .ds-filefilters{display:flex}.ds-filefilter-menu .ds-filefilters{display:none;padding:7px;border:1px solid var(--line-soft);border-radius:9px;background:var(--panel3);box-shadow:var(--shadow)}
.ds-filepanel-loading,.ds-filepanel-loaderror,.ds-step-loading,.ds-step-loaderror{display:flex;min-height:180px;align-items:center;justify-content:center;gap:10px;padding:24px;color:var(--muted);font-size:12px}.ds-filepanel-loaderror,.ds-step-loaderror{flex-direction:column;color:var(--del-text)}.ds-step-lazy{align-items:center;justify-content:center}
.ds-step-loading{flex-direction:column;align-items:stretch;gap:9px;width:min(520px,100%);margin:0 auto}
.ds-sk{display:block;height:10px;border-radius:var(--radius-sm);background:var(--fill-2);animation:dsShimmer 1.6s ease-in-out infinite}
.ds-sk:nth-child(2){animation-delay:.12s}.ds-sk:nth-child(3){animation-delay:.24s}
.ds-step-loading-tx{margin-top:6px;font-family:var(--mono);font-size:10.5px;color:var(--dim);text-align:center}
@keyframes dsShimmer{0%,100%{opacity:.45}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.ds-sk{animation:none}}
.ds-exclusions-note{margin:0;color:var(--muted);font-size:12px;line-height:1.5}.ds-exclusion-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;padding:11px 12px;border:1px solid var(--line-soft);border-radius:10px;background:var(--fill-1)}.ds-exclusion-card>div:first-child{display:grid;gap:4px;min-width:0}.ds-exclusion-card code{overflow:hidden;text-overflow:ellipsis;color:var(--text);font-family:var(--mono);font-size:11px;white-space:nowrap}.ds-exclusion-card span{color:var(--muted);font-size:10.5px}.ds-exclusion-preview{grid-column:1/-1;max-height:360px;overflow:auto;border:1px solid var(--line-soft);border-radius:8px;background:var(--gutter)}.ds-excluded-file-head{display:grid;gap:3px;padding:9px 11px;border-bottom:1px solid var(--line-soft)}.ds-excluded-file-head strong{font-size:11px}.ds-excluded-file-head span{font-size:10px}.ds-excluded-code{display:grid;margin:0;padding:8px 0;white-space:pre}.ds-excluded-code>span{display:grid;grid-template-columns:45px minmax(max-content,1fr);font-family:var(--mono);font-size:10px;line-height:1.5}.ds-excluded-code i{padding-right:10px;text-align:right;color:var(--dim);font-style:normal;user-select:none}.ds-excluded-code code{padding-right:14px;color:var(--muted)}.ds-exclusion-ack{display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--amber) 35%,var(--line));border-radius:10px;background:var(--amber-soft);cursor:pointer}.ds-exclusion-ack input{margin-top:2px}.ds-exclusion-ack span{display:grid;gap:2px}.ds-exclusion-ack strong{font-size:12px}.ds-exclusion-ack small{color:var(--amber-text);font-size:10.5px}
body{height:100vh;height:100dvh}
/* Review comments are a lightweight capture surface plus a queue. */
.ds-comment-pin{top:50%;right:8px;width:30px;min-width:30px;height:30px;padding:0;display:grid;place-items:center;border-radius:999px;background:var(--panel3);color:var(--accent-text);font-size:10px;transform:translateY(-50%)}
.ds-comment-pin:hover,.ds-comment-pin:focus-visible{border-color:var(--accent-blue);background:var(--accent-soft);color:var(--accent-text)}
.ds-composer{width:min(600px,calc(100% - 24px));margin:7px 12px 9px auto}
.ds-composer[data-comment-side="left"]{margin-left:12px;margin-right:auto}
.ds-feedback-list{gap:16px}.ds-feedback-group{display:grid;gap:8px}.ds-feedback-group-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 3px;color:var(--dim);font-size:10px}.ds-feedback-group-head code{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font:11px var(--mono);white-space:nowrap}.ds-feedback-card{padding:12px 13px}.ds-feedback-actions{padding-top:1px}.ds-feedback-actions .ds-danger{margin-left:auto;color:var(--del-text)}
.ds-queue-edit{display:grid;gap:8px;padding:10px;border:1px solid var(--line-soft);border-radius:9px;background:var(--fill-1)}.ds-queue-edit[hidden]{display:none}.ds-queue-edit-types{display:flex;gap:5px;flex-wrap:wrap}.ds-queue-edit-types button{min-height:32px;padding:4px 8px;border:1px solid var(--line-soft);border-radius:7px;background:transparent;color:var(--muted);font:inherit;font-size:10.5px;font-weight:650;cursor:pointer}.ds-queue-edit-types button[aria-pressed="true"]{border-color:var(--accent-blue);background:var(--accent-soft);color:var(--accent-text)}.ds-queue-edit textarea{width:100%;min-height:76px;resize:vertical;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel3);color:var(--text);font:inherit;font-size:12.5px;line-height:1.45}.ds-queue-edit textarea:focus{outline:none;border-color:var(--accent-blue);box-shadow:0 0 0 3px var(--accent-soft)}.ds-queue-edit-actions{display:flex;justify-content:flex-end;gap:7px}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
@media (prefers-reduced-motion:no-preference){
  .ds-reviewchrome{animation:ds-review-chrome-in var(--motion-duration-spatial) var(--motion-ease-out) backwards}.ds-layout{animation:ds-review-layout-in var(--motion-duration-spatial) var(--motion-ease-out) 35ms backwards}
  .ds-story-tune-pop,.ds-filefilter-menu[open] .ds-filefilters{transform-origin:calc(100% - 14px) -6px;animation:ds-review-pop-in var(--motion-duration-ui) var(--motion-ease-out) backwards}
  .is-workspace-entering[data-ds-enter-direction="1"]{animation:ds-workspace-new-next var(--motion-duration-spatial) var(--motion-ease-drawer) both}.is-workspace-entering[data-ds-enter-direction="-1"]{animation:ds-workspace-new-prev var(--motion-duration-spatial) var(--motion-ease-drawer) both}.is-workspace-entering[data-ds-enter-direction="0"]{animation:ds-workspace-new-fade var(--motion-duration-ui) var(--motion-ease-out) both}
  html[data-ds-motion="view"] .ds-view:not([hidden]),html[data-ds-motion="file"] .ds-filepanel:not([hidden]),html[data-ds-motion="step"] .ds-step:not([hidden]),html[data-ds-motion="mode"] .ds-filepanel-body>[data-diff-inner]:not([hidden]),html[data-ds-motion="mode"] .ds-filepanel-body>[data-split-inner]:not([hidden]),html[data-ds-motion="mode"] .ds-filepanel-body>[data-full-inner]:not([hidden]){view-transition-name:ds-workspace-surface}
  ::view-transition-group(ds-workspace-surface){animation-duration:var(--motion-duration-spatial);animation-timing-function:var(--motion-ease-drawer)}
  ::view-transition-old(ds-workspace-surface),::view-transition-new(ds-workspace-surface){mix-blend-mode:normal;animation-duration:var(--motion-duration-spatial);animation-timing-function:var(--motion-ease-drawer)}
  html[data-ds-motion-direction="1"]::view-transition-old(ds-workspace-surface){animation-name:ds-workspace-old-next}html[data-ds-motion-direction="1"]::view-transition-new(ds-workspace-surface){animation-name:ds-workspace-new-next}
  html[data-ds-motion-direction="-1"]::view-transition-old(ds-workspace-surface){animation-name:ds-workspace-old-prev}html[data-ds-motion-direction="-1"]::view-transition-new(ds-workspace-surface){animation-name:ds-workspace-new-prev}
  html[data-ds-motion-direction="0"]::view-transition-old(ds-workspace-surface){animation-name:ds-workspace-old-fade}html[data-ds-motion-direction="0"]::view-transition-new(ds-workspace-surface){animation-name:ds-workspace-new-fade}
  @keyframes ds-review-chrome-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}@keyframes ds-review-layout-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
  @keyframes ds-review-pop-in{from{opacity:0;clip-path:inset(0 0 100% 72% round 10px);transform:translateY(-5px) scale(.97)}to{opacity:1;clip-path:inset(0 round 10px);transform:none}}
  @keyframes ds-workspace-old-next{to{opacity:0;transform:translateX(-6px)}}@keyframes ds-workspace-new-next{from{opacity:0;transform:translateX(10px)}}@keyframes ds-workspace-old-prev{to{opacity:0;transform:translateX(6px)}}@keyframes ds-workspace-new-prev{from{opacity:0;transform:translateX(-10px)}}@keyframes ds-workspace-old-fade{to{opacity:0;transform:scale(.997)}}@keyframes ds-workspace-new-fade{from{opacity:0;transform:scale(1.003)}}
}
@media (max-width:1080px){
  .ds-step.is-code-step{display:flex;overflow:hidden}.ds-step.is-code-step>.ds-step-top{padding:16px 24px 0}
  .ds-step.is-code-step>.ds-diffscroll{padding:8px 0 0;min-height:180px}
}
@media (max-width:760px){.ds-symbols{display:none}}
@media (max-width:620px){.ds-top{height:52px}.ds-layout>.ds-rail,body:not(.ds-rail-collapsed) .ds-rail-scrim{top:52px}.ds-introwrap{padding:32px 20px 48px}.ds-intro-title{font-size:27px;line-height:1.1}.ds-intro-lede{font-size:15.5px;line-height:1.52}.ds-intro-actions{margin-top:20px}.ds-intro-actions .ds-intro-start{width:auto;max-width:100%;padding:12px 16px}.ds-intro-utility{gap:7px 15px;margin-top:13px}.ds-intro-notes[open]{flex-basis:100%}.ds-intro-notes-body{padding:13px}.ds-intro-allfiles{min-height:44px}.ds-concept-step>.ds-step-top{padding:14px 16px 0}.ds-concept-scroll{padding:12px 12px 28px}.ds-concept-document{padding:25px 20px 28px;border-radius:12px}.ds-concept-title{font-size:25px}.ds-concept-body{font-size:14px}.ds-concept-diagram-output{min-height:160px;padding:12px}.ds-exclusion-card{grid-template-columns:1fr}.ds-exclusion-card>.ds-btn{justify-self:start}.ds-story-tune-long{display:none}.ds-story-tune-pop{max-width:min(236px,calc(100vw - 48px))}.ds-step.is-code-step>.ds-step-top{padding:13px 16px 0}.ds-step.is-code-step>.ds-diffscroll{padding:6px 0 0;--ds-scrollpad-t:6px}.ds-dock-transport{gap:8px;min-height:48px;padding:7px 8px 7px 7px}.ds-filmthread{gap:6px;padding:2px 6px 4px}.ds-filmthread.is-storyless{padding:4px 6px 5px}.ds-filmthread-scroll{padding:2px 0}.ds-filmthread-allfiles{height:44px;padding:0 9px}.ds-concept-body .ds-md-tablewrap{margin:14px 0 16px}.ds-concept-body table{font-size:12.5px}.ds-concept-body th,.ds-concept-body td{padding:7px 10px}.ds-concept-body dd{margin-left:13px}.ds-concept-body pre{margin:13px 0;padding:11px 12px;font-size:11.5px}.ds-md kbd{padding:1px 4px}}
@media (max-width:620px){.ds-composer,.ds-composer[data-comment-side="left"]{width:calc(100% - 8px);margin:4px}.ds-feedback-actions{justify-content:flex-start}.ds-feedback-actions .ds-danger{margin-left:0}}
@media (max-width:470px){.ds-step-meta{gap:6px}.ds-step-count{white-space:nowrap}.ds-step-meta>.ds-dot,.ds-step-meta>.ds-flowchip{display:none}.ds-step.is-code-step .ds-full-diff{display:none}/* The beat row stays one line even here. Wrapping the arrows underneath left the
   play button centred against a two-row neighbour, which opened a dead square in
   the middle of the island — worse than tighter gaps. */
.ds-beatdock{gap:8px}.ds-beatdock-count{min-width:0}.ds-beatdock-actions{gap:3px}.ds-beatdock-actions button{width:40px;height:40px}}
@media (max-width:720px){.ds-back{min-width:36px}.ds-help{display:none}}
@media (prefers-reduced-motion:reduce){.ds-intro-start,.ds-sidebar-toggle,.ds-back,.ds-readaloud,.ds-tab,.ds-concept-next,.ds-fileitem,.ds-filetree-dir>summary,.ds-filmnode,.ds-filmnode-num,.ds-filmnode-label,.ds-filmthread-tooltip{transition:none!important}.ds-intro-start:active{transform:none}.ds-command-root *{animation:none!important}.ds-toast{animation:none!important;transform:translateX(-50%);transition:opacity 200ms ease}.ds-toast.is-show{transform:translateX(-50%)}.ds-drawer{transform:none;opacity:0;transition:opacity 200ms ease}.ds-drawer-root.is-open .ds-drawer{transform:none;opacity:1}.ds-drawer-scrim{transition:opacity 200ms ease}.ds-readhead-fill{transition:none!important}.ds-readaloud.is-loading .ds-readaloud-ico,.ds-composer{animation:none!important}}
@media (prefers-reduced-transparency:reduce){.ds-top,.ds-drawer,.ds-toast,.ds-dock,.ds-filmthread.is-storyless{background:var(--panel3);backdrop-filter:none;-webkit-backdrop-filter:none}.ds-dock,.ds-filmthread.is-storyless{border-color:var(--line-soft)}.ds-md :is(.ds-bit,.ds-slot,.ds-flag,.ds-val,.ds-warn){background:color-mix(in srgb,currentColor 14%,var(--panel3))}.ds-md tbody tr:nth-child(even){background:var(--panel3)}}
@media (prefers-contrast:more){:root{--line:color-mix(in srgb,var(--text) 42%,transparent);--line-soft:color-mix(in srgb,var(--text) 28%,transparent)}.ds-top,.ds-reviewstatusbar{background:var(--panel3)}.ds-intro-lede{color:var(--text)}.ds-md caption{color:var(--text)}.ds-md thead th,.ds-md tbody{border-color:var(--text)}.ds-md tbody tr:nth-child(even){background:transparent}.ds-md tbody tr+tr{border-top:1px solid var(--line)}.ds-md hr{background:var(--text-3)}.ds-md kbd{border-color:var(--text-3)}}

/* The review frame keeps only navigation, scope, theme, and the decision entry
   point visible. Detailed status belongs inside Review, next to its actions. */
.ds-ui-icon{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;flex:none}.ds-ui-icon svg{display:block;width:100%;height:100%}
.ds-reviewchrome{height:56px;width:100%;min-width:0;position:relative;flex:none;display:flex;align-items:center;background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--radius-island);overflow:visible;z-index:9}
.ds-reviewchrome .ds-titlewrap{border-radius:8px;background:var(--surface);box-shadow:0 0 0 7px var(--surface)}
.ds-reviewchrome-rail{display:flex;align-items:center;min-width:0}
.ds-reviewchrome-nav{display:flex;align-items:center;gap:3px;padding:0 11px}.ds-reviewchrome-nav .ds-sidebar-toggle{width:44px;height:44px}.ds-reviewchrome-nav .ds-back{min-height:44px;padding-inline:7px 10px;gap:5px}
.ds-reviewchrome .ds-sidebar-toggle.is-active{background:transparent;color:var(--muted)}
.ds-reviewchrome-main{flex:1;display:flex;align-items:center;width:100%;min-width:0;max-width:100%;padding:0 16px 0 18px}
.ds-reviewchrome-main .ds-titlewrap{gap:3px}.ds-reviewchrome-main .ds-title{font-size:15px;font-weight:700;letter-spacing:-.01em}.ds-reviewchrome-subtitle{overflow:hidden;color:var(--dim);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}.ds-reviewchrome-subtitle span{margin:0 3px;color:var(--faint)}.ds-reviewchrome-subtitle b{color:var(--muted);font-family:var(--mono);font-size:10px;font-weight:600}
.ds-reviewchrome-mobile-nav{display:none;align-items:center;gap:1px;flex:none;margin-right:6px}.ds-reviewchrome-mobile-nav .ds-sidebar-toggle,.ds-reviewchrome-mobile-nav .ds-back{width:44px;min-height:44px;padding:0;justify-content:center}
.ds-reviewchrome-utilities{display:flex;align-items:center;gap:10px;flex:none;margin-left:14px}.ds-reviewchrome-utilities .ds-theme-toggle{width:36px;height:36px;min-height:36px}
/* Story ⇄ Files rides in the chrome, not the rail: switching views is a
   top-level move and the rail is collapsed for most of the review. The pill
   here overrides the rail's light-theme underline tabs, which were drawn to
   sit under a sidebar heading rather than inside a 56px bar. */
:root .ds-reviewchrome-utilities .ds-viewtoggle{flex:none;align-items:center;height:36px;min-height:0;padding:3px;border:0;border-radius:10px;background:var(--fill-2);box-shadow:inset 0 0 0 1px var(--line-soft)}
:root .ds-reviewchrome-utilities .ds-tab{flex:none;min-height:30px;padding:0 11px;border-radius:7px;font-size:11.5px;font-weight:650;white-space:nowrap;box-shadow:none}
:root .ds-reviewchrome-utilities .ds-tab::after{display:none}
:root .ds-reviewchrome-utilities .ds-tab:hover{background:var(--fill-1);color:var(--text)}
:root .ds-reviewchrome-utilities .ds-tab.is-active{background:var(--panel4);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.25)}
:root[data-theme="light"] .ds-reviewchrome-utilities .ds-tab.is-active{background:var(--surface);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.1)}
.ds-narration{position:relative;display:flex;align-items:center}.ds-narration-actions{display:flex;align-items:center;gap:5px}
.ds-dock .ds-readaloud-primary{display:flex;width:auto;height:38px;min-height:38px;gap:8px;padding:0 13px 0 9px;border:1px solid color-mix(in srgb,var(--md-primary) 30%,var(--line));border-radius:11px;background:color-mix(in srgb,var(--md-primary) 12%,var(--panel3));color:var(--text);font-size:12px;font-weight:700;letter-spacing:-.01em}
.ds-dock .ds-readaloud-primary:hover{border-color:color-mix(in srgb,var(--md-primary) 50%,var(--line));background:color-mix(in srgb,var(--md-primary) 18%,var(--panel3))}
.ds-dock .ds-readaloud-primary:disabled{cursor:wait;opacity:.82}
.ds-dock .ds-readaloud-primary:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-dock .ds-readaloud-primary .ds-readaloud-ico{width:21px;height:21px;flex:none;font-size:8px;box-shadow:0 1px 5px color-mix(in srgb,var(--md-primary) 38%,transparent)}
.ds-dock .ds-readaloud-primary.is-active{border-color:color-mix(in srgb,var(--md-primary) 38%,var(--line));background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
.ds-dock .ds-readaloud-primary.is-active .ds-readaloud-ico{background:var(--md-on-secondary-container);color:var(--on-accent)}
/* Transport glyphs are masked SVG, not border tricks. The old pause was two 3px
   square bars separated by 2px, so at this size the gap closed up optically and
   the icon read as one dark blob; these are drawn to size with rounded ends and
   a gap wider than the bars. */
.ds-readaloud-ico.is-play::before,.ds-readaloud-ico.is-pause::before{content:"";display:block;width:10px;height:10px;background:currentColor;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}
.ds-readaloud-ico.is-play::before{margin-left:2px;--ds-transport-glyph:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><path d='M2.6 1.8 L8.2 5 L2.6 8.2 Z' fill='black' stroke='black' stroke-width='1.6' stroke-linejoin='round'/></svg>");-webkit-mask-image:var(--ds-transport-glyph);mask-image:var(--ds-transport-glyph)}
.ds-readaloud-ico.is-pause::before{--ds-transport-glyph:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'><g fill='black'><rect x='0.85' y='0.85' width='2.5' height='8.3' rx='0.9'/><rect x='6.65' y='0.85' width='2.5' height='8.3' rx='0.9'/></g></svg>");-webkit-mask-image:var(--ds-transport-glyph);mask-image:var(--ds-transport-glyph)}
/* Stop is a square sibling of the transport pill, so it takes the pill's 38px
   box and corner radius. At 30px it sat visibly short next to Pause and the
   pair read as two unrelated controls rather than one transport cluster. */
.ds-narration-stop{width:38px;height:38px;display:grid;place-items:center;padding:0;border:1px solid color-mix(in srgb,var(--md-error) 22%,var(--line));border-radius:11px;background:var(--fill-1);color:var(--md-error);cursor:pointer}.ds-narration-stop[hidden]{display:none}.ds-narration-stop:hover{background:color-mix(in srgb,var(--md-error) 10%,var(--fill-1));border-color:color-mix(in srgb,var(--md-error) 42%,var(--line))}.ds-narration-stop:focus-visible{outline:none;box-shadow:0 0 0 3px color-mix(in srgb,var(--md-error) 18%,transparent)}.ds-narration-stop span{width:9px;height:9px;border-radius:2px;background:currentColor}
.ds-readaloud-label{white-space:nowrap}
.ds-reviewchrome .ds-actions{gap:7px}
.ds-reload-diff{height:36px;display:inline-flex;align-items:center;gap:7px;padding:0 9px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}.ds-reload-diff:hover{background:var(--fill-2);color:var(--text)}.ds-reload-diff:disabled{opacity:.7}.ds-reload-diff.is-loading .ds-reload-icon{animation:dsReloadSpin .7s linear infinite}@keyframes dsReloadSpin{to{transform:rotate(360deg)}}
/* The Review tab is the only door to the review page, so it carries that page's
   two facts inline: how many notes are open, and whether anything there is
   waiting on a decision. The flag is a marker, not a badge — it disappears the
   moment the page is clean rather than turning into a green reassurance. */
.ds-tab-flag{margin-left:5px;color:var(--amber);font-size:9px;line-height:1;vertical-align:1px}.ds-tab-flag[hidden]{display:none}
.ds-tab-badge[hidden]{display:none}.ds-tab-badge b{font-weight:700}
.ds-live-banner{position:fixed;z-index:20;top:72px;right:16px;width:min(420px,calc(100vw - 32px));min-height:52px;display:grid;grid-template-columns:28px minmax(0,1fr) auto 36px;align-items:center;gap:8px;padding:4px 4px 4px 8px;border:1px solid color-mix(in srgb,var(--md-primary) 24%,var(--line));border-radius:12px;background:color-mix(in srgb,var(--panel3) 94%,var(--md-primary));box-shadow:0 14px 34px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.18);color:var(--text);font-size:12px}.ds-live-banner[hidden]{display:none}.ds-live-banner-icon{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:var(--md-secondary-container);color:var(--md-on-secondary-container)}.ds-live-banner-icon svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.ds-live-banner [data-live-message]{min-width:0;line-height:1.35;font-weight:600;text-wrap:pretty}.ds-live-banner button{height:36px;border:0;border-radius:8px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.ds-live-banner button:hover{background:var(--fill-2);color:var(--text)}.ds-live-banner button:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}.ds-live-banner-reload{padding:0 10px;color:var(--md-primary)!important}.ds-live-banner-dismiss{width:36px;padding:0}.ds-live-banner-dismiss svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}.ds-live-banner[data-live-kind="disconnected"]{border-color:color-mix(in srgb,var(--amber) 34%,var(--line))}.ds-live-banner[data-live-kind="disconnected"] .ds-live-banner-icon{background:var(--amber-soft);color:var(--amber-text)}
body.ds-rail-collapsed .ds-reviewchrome{grid-template-columns:0 minmax(0,1fr)}body.ds-rail-collapsed .ds-reviewchrome-rail{display:none}body.ds-rail-collapsed .ds-reviewchrome-mobile-nav{display:flex}

@media (max-width:900px){
  .ds-reload-diff>span[data-reload-label]{display:none}
}
@media (max-width:720px){
  .ds-reviewchrome,body.ds-rail-collapsed .ds-reviewchrome{height:56px;grid-template-columns:minmax(0,1fr);grid-template-rows:56px}.ds-reviewchrome-main{grid-column:1;grid-row:1;padding:0 8px 0 7px}.ds-reviewchrome-mobile-nav{display:flex}.ds-reviewchrome-main .ds-title{font-size:13.5px}.ds-reviewchrome-subtitle{font-size:10px}.ds-reviewchrome-utilities{gap:5px;margin-left:6px}.ds-reviewchrome .ds-actions{gap:2px}.ds-reload-diff{min-width:44px;height:44px;justify-content:center;padding:0 10px}
  .ds-reviewchrome-utilities .ds-theme-toggle{width:44px;height:44px;min-height:44px}
  .ds-reviewchrome-utilities .ds-viewtoggle{height:44px}.ds-reviewchrome-utilities .ds-tab{min-height:38px;padding:0 9px;font-size:11px}
  .ds-dock .ds-readaloud-primary{display:flex;width:44px;height:44px;min-height:44px;padding:0;justify-content:center;border-radius:12px}.ds-dock .ds-readaloud-primary .ds-readaloud-label{display:none}.ds-narration-actions{gap:3px}.ds-narration-stop{position:absolute;z-index:13;bottom:calc(100% + 14px);left:0;width:62px;height:32px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;background:color-mix(in srgb,var(--md-error) 10%,var(--panel3));box-shadow:none;font-size:10px;font-weight:800}.ds-narration-stop::after{content:"Stop"}.ds-narration-stop span{width:7px;height:7px}
  .ds-reviewchrome>.ds-reviewchrome-rail{display:none;position:fixed;top:0;left:0;z-index:11;width:min(var(--ds-rail-width,240px),calc(100vw - 48px));height:56px;grid-template-columns:1fr;grid-template-rows:56px;border-bottom:1px solid var(--line);box-shadow:var(--shadow)}.ds-reviewchrome-rail .ds-reviewchrome-nav{padding-left:7px}body:not(.ds-rail-collapsed) .ds-reviewchrome-rail{display:grid}
  .ds-live-banner,body.ds-rail-collapsed .ds-live-banner{top:64px;right:8px;width:calc(100vw - 16px)}
  body:not(.ds-rail-collapsed) .ds-reviewchrome-rail .ds-sidebar-toggle.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
  .ds-layout>.ds-rail{top:56px}.ds-rail-scrim,body:not(.ds-rail-collapsed) .ds-rail-scrim{top:56px}
}
@media (max-width:470px){.ds-reviewchrome-main{padding-inline:4px}.ds-reviewchrome-utilities .ds-tab{padding:0 7px;font-size:10.5px}.ds-reviewchrome-main .ds-titlewrap{flex:1 1 0;max-width:none;box-shadow:none}.ds-reviewchrome-subtitle{display:none}.ds-reviewchrome-mobile-nav{gap:0;margin-right:2px}.ds-reviewchrome-utilities{gap:2px;margin-left:2px}.ds-reviewchrome .ds-actions{gap:0}}
@media (prefers-reduced-motion:reduce){.ds-reload-diff.is-loading .ds-reload-icon{animation:none}.ds-live-banner{transition:none!important}}
@media (prefers-reduced-transparency:reduce){.ds-reviewchrome,.ds-reviewchrome-rail{background:var(--panel3)}}
@media (prefers-contrast:more){.ds-reviewchrome-main,.ds-reviewchrome-rail{border-color:var(--line)}}
`;
export const PAGE_CSS = sharedTokens() + themeControlStyles() + threadAtmosphereStyles() + PAGE_CSS_CORE + DIFF_CSS + SESSION_REDESIGN_CSS;
// No backticks and no ${} below — safe to embed in a template literal.
const PAGE_JS_HEAD = `
(function(){
  var API='/api/comments';
  var CODEX_MODEL_API='/api/codex/models';
  var agentBusy=false;
  var BRAND='diffStory';
  var FLAVOR={change:{label:'Fix request',ico:'!'},question:{label:'Question',ico:'?'},nit:{label:'Note',ico:'·'}};
  var FLAVOR_ICON_PATHS={
    change:'<path d="M14.8 6.2a4.2 4.2 0 0 1-5.4 5.4l-4.8 4.8a1.4 1.4 0 0 1-2-2l4.8-4.8a4.2 4.2 0 0 1 5.4-5.4l-2.3 2.3.7 2.3 2.3.7 2.3-2.3Z"/>',
    question:'<circle cx="9" cy="9" r="6.5"/><path d="M7.2 7.1a2 2 0 0 1 3.8.9c0 1.5-2 1.7-2 3"/><path d="M9 13.4h.01"/>',
    nit:'<path d="M4.5 2.8h7l3 3v9.4h-10Z"/><path d="M11.5 2.8v3h3M7 9h5M7 11.6h4"/>'
  };
  function composerFlavorIcon(type){var span=el('span','ds-composer-type-icon');span.setAttribute('aria-hidden','true');span.innerHTML='<svg viewBox="0 0 18 18" focusable="false">'+(FLAVOR_ICON_PATHS[type]||FLAVOR_ICON_PATHS.nit)+'</svg>';return span;}
  var tourView,filesView,reviewView,driftDrawer,commandRoot,toastEl,selectionMenu,filmThread,filmTooltip,filmTooltipTarget=null,filmMagnifyFrame=0,filmPointerX=null,filmProgressObserver=null,selectionContext=null,selectionRects=[],selectionContextMenuPending=false,stepPanels,stepCards,total=1,active=0,visited={0:true},toastTimer,toastSequence=0,storyFocusIndex=-1,storyFocusGroup=-1,voiceFocusIndex=-1,voiceFocusGroup=-1,voiceFocusTimers=[],voiceSequenceToken=0,currentSpeechStep=-1,currentSpeechUnit=-1,currentSpeechManual=false,sidebarReturnFocus=null,commandReturnFocus=null,composerReturnFocus=null,modalStack=[],modalBackgroundSnapshots=[];
  var filePanels=[],fileItems=[],selectedFile=-1,fileSearchQuery='',fileSearchMatches=null,fileSearchRequest=0,fileSearchTimer=null,sidebarResizing=false,sidebarResizeFrame=0,sidebarResizeClientX=null,splitBody=null,splitHolder=null,splitResizeFrame=0,splitResizeClientX=null,annotationFrame=0,annotationObserver=null,focusScrollTimer=0,focusScrollFrame=0,aloudIntent='off',aloudResumeDirty=false,aloudControlTimer=0,aloudActive=false,aloudPaused=false,aloudJobId='',aloudPollTimer=0,aloudPrepareTimer=0,aloudPrepareRequest=0,aloudPreparedText='',aloudRequestAbort=null,aloudRequestToken=0,aloudControlToken=0,aloudControlPending=false,aloudPhase='idle',aloudRate=1,aloudSequence=[],aloudSequenceIndex=-1,speechLoadingLabel='',aloudPollFails=0,aloudStateMessage='',aloudStartedAt=0,aloudSlowNotice=false;
  var activeFileFilter='all',restoringReviewPosition=false,reviewSaveTimer=null,reviewPositionReady=false,driftRequestAbort=null,driftRequestToken=0,driftLayoutMode=compactScreen()?'unified':'split';
  var mermaidModulePromise=null,mermaidRenderId=0;
  var liveEventSource=null,liveDisconnectTimer=null,liveOriginalStoryFreshness='',liveIssues={diff:false,story:false,disconnected:false},liveGenerations={diff:0,story:0,disconnected:0},liveDismissed={diff:0,story:0,disconnected:0},storyReloadTimer=null,storyReloadToastSequence=0;
  var workspaceTransition=null,workspaceFallbackTimer=0,workspaceTransitionToken=0;
  function $(s,r){return (r||document).querySelector(s);}
  function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function closest(n,s){return n&&n.closest?n.closest(s):null;}
  function reviewPageUrl(path){
    var url=new URL(path,location.href),token=document.body.getAttribute('data-review-page-token')||'';
    if(token)url.searchParams.set('page',token);
    return url.pathname+url.search;
  }
  function openSymbolInVSCode(symbol){
    var code=closest(symbol,'[data-comment-code]');
    if(!code||(code.getAttribute('data-comment-side')||'right')!=='right')return;
    var file=code.getAttribute('data-comment-file')||'';
    var line=parseInt(code.getAttribute('data-comment-line')||'0',10);
    var column=parseInt(symbol.getAttribute('data-vscode-column')||'0',10);
    if(!file||!line||!column)return;
    fetch(reviewPageUrl('/api/editor/open'),{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({file:file,line:line,column:column})
    }).then(function(r){return r.json().then(function(body){if(!r.ok)throw new Error(body.error||'Could not open VS Code.');return body;});})
      .then(function(){toast('Opening implementation in VS Code…');})
      .catch(function(error){toast(error&&error.message?error.message:'Could not open VS Code.','error');});
  }
  var LIVE_BANNER_KINDS=[
    {kind:'diff',message:'Diff changed.'},
    {kind:'disconnected',message:'Live updates interrupted.'}
  ];
  function liveBannerEntry(kind){for(var i=0;i<LIVE_BANNER_KINDS.length;i++)if(LIVE_BANNER_KINDS[i].kind===kind)return LIVE_BANNER_KINDS[i];return null;}
  function livePriority(){for(var i=0;i<LIVE_BANNER_KINDS.length;i++){var kind=LIVE_BANNER_KINDS[i].kind;if(liveIssues[kind]&&liveDismissed[kind]!==liveGenerations[kind])return kind;}return '';}
  function renderLiveBanner(){
    var banner=$('[data-live-banner]');if(!banner)return;
    var entry=liveBannerEntry(livePriority());
    if(!entry){banner.hidden=true;banner.removeAttribute('data-live-kind');return;}
    var message=$('[data-live-message]',banner);banner.setAttribute('data-live-kind',entry.kind);banner.hidden=false;
    if(message)message.textContent=entry.message;
  }
  function hideStoryReloadToast(){
    var reloadToast=$('[data-story-reload-toast]'),sequence=++storyReloadToastSequence;
    if(storyReloadTimer){clearTimeout(storyReloadTimer);storyReloadTimer=null;}
    document.body.classList.remove('ds-story-reload-pending');
    if(!reloadToast)return;
    reloadToast.classList.remove('is-show');
    setTimeout(function(){if(sequence===storyReloadToastSequence)reloadToast.hidden=true;},220);
  }
  function scheduleStoryReload(){
    var reloadToast=$('[data-story-reload-toast]');if(!reloadToast||storyReloadTimer)return;
    var sequence=++storyReloadToastSequence;
    reloadToast.hidden=false;document.body.classList.add('ds-story-reload-pending');
    requestAnimationFrame(function(){if(sequence===storyReloadToastSequence)reloadToast.classList.add('is-show');});
    storyReloadTimer=setTimeout(function(){if(sequence!==storyReloadToastSequence)return;storyReloadTimer=null;location.reload();},10000);
  }
  function cancelStoryReload(){hideStoryReloadToast();toast('Automatic reload cancelled.');}
  function setLiveIssue(kind,on){
    if(liveIssues[kind]===on){renderLiveBanner();return;}
    liveIssues[kind]=on;if(on)liveGenerations[kind]++;
    if(kind==='diff'){
      document.body.setAttribute('data-live-diff-stale',on?'1':'0');
      refreshCount();
    }
    if(kind==='story'&&!document.body.hasAttribute('data-storyless')){
      var freshness=on?'stale':liveOriginalStoryFreshness||'unverified';
      document.body.setAttribute('data-story-freshness',freshness);
      var reviewButton=$('[data-review-status]');if(reviewButton)reviewButton.setAttribute('data-story-freshness',freshness);
      refreshCount();
      if(on)scheduleStoryReload();else hideStoryReloadToast();
    }
    renderLiveBanner();
  }
  function liveEventData(event){try{return JSON.parse(event.data||'{}');}catch(e){return {};}}
  function startLiveEvents(){
    var token=document.body.getAttribute('data-review-page-token')||'';if(!token||typeof EventSource==='undefined')return;
    liveOriginalStoryFreshness=document.body.getAttribute('data-story-freshness')||'unverified';
    function open(){
      if(liveEventSource&&liveEventSource.readyState!==2)return;
      var source=new EventSource(reviewPageUrl('/api/events'));liveEventSource=source;
      source.onopen=function(){
        if(liveDisconnectTimer){clearTimeout(liveDisconnectTimer);liveDisconnectTimer=null;}
        setLiveIssue('disconnected',false);refreshComments(null,true);refreshReviewState();
      };
      source.onerror=function(){
        if(liveDisconnectTimer)return;
        // The server's retry directive is 1500ms; the banner may only appear
        // once a healthy reconnect has had time to land, or it flashes on
        // every transient drop.
        liveDisconnectTimer=setTimeout(function(){liveDisconnectTimer=null;setLiveIssue('disconnected',true);},4000);
      };
      source.addEventListener('state',function(event){var data=liveEventData(event);setLiveIssue('diff',!!data.diffChanged);setLiveIssue('story',!!data.storyChanged);});
      source.addEventListener('comments-changed',function(){refreshComments(null,true);});
      source.addEventListener('review-state-changed',function(){refreshReviewState();});
      source.addEventListener('story-changed',function(){setLiveIssue('story',true);});
      source.addEventListener('story-synced',function(){setLiveIssue('story',false);});
      source.addEventListener('diff-changed',function(){setLiveIssue('diff',true);});
      source.addEventListener('diff-synced',function(){setLiveIssue('diff',false);refreshReviewState();});
    }
    open();
    // A bfcache restore revives the page with the stream we closed on the way
    // out; EventSource.close() is terminal, so reopen instead of going stale.
    window.addEventListener('pagehide',function(){if(liveEventSource)liveEventSource.close();});
    window.addEventListener('pageshow',function(e){if(e.persisted)open();});
  }
  function reviewLazyText(r){
    if(!r.ok){var err=new Error('Review evidence request failed');err.status=r.status;err.reloadRequired=r.status===409;throw err;}
    return r.text();
  }
  function reviewLazyMessage(err,fallback){
    return err&&err.reloadRequired?'The review changed while this page was open. Reload to continue safely.':fallback;
  }
  function reviewLazyAction(err,retryAttr,retryValue){
    if(err&&err.reloadRequired)return '<button type="button" class="ds-btn ds-btn-ghost" data-review-reload>Reload review</button>';
    return '<button type="button" class="ds-btn ds-btn-ghost" '+retryAttr+'="'+retryValue+'">Retry</button>';
  }
  function isTextEntryTarget(t){
    if(!t)return false;
    if(t.isContentEditable)return true;
    var tag=t.tagName||'';
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(tag))return true;
    return !!closest(t,'[contenteditable="true"]');
  }
  function isKeyboardControlTarget(t){
    if(!t)return false;
    var tag=t.tagName||'';
    if(/^(BUTTON|A)$/.test(tag))return true;
    return !!closest(t,'[role="button"],[role="link"],[role="separator"]');
  }
  function isReadAloudShortcutTarget(t){
    return !!closest(t,'[data-readaloud]');
  }
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  var CODE=String.fromCharCode(96),FENCE=CODE+CODE+CODE;
  function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function renderInlineMarkdown(input){
    var parts=String(input==null?'':input).split(CODE),out='';
    for(var i=0;i<parts.length;i++){
      if(i%2){out+='<code>'+escHtml(parts[i])+'</code>';continue;}
      out+=escHtml(parts[i])
        .replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>')
        .replace(/__([^_]+)__/g,'<strong>$1</strong>')
        .replace(/(^|[^\\*])\\*([^*\\n]+)\\*/g,'$1<em>$2</em>')
        .replace(/\\n/g,'<br>');
    }
    return out;
  }
  function renderMarkdown(input){
    var lines=String(input==null?'':input).replace(/\\r\\n/g,'\\n').trim().split('\\n'),out=[],para=[];
    function flush(){if(!para.length)return;out.push('<p>'+renderInlineMarkdown(para.join('\\n'))+'</p>');para=[];}
    for(var i=0;i<lines.length;i++){
      var line=lines[i],trim=line.trim();
      if(!trim){flush();continue;}
      if(trim.indexOf(FENCE)===0){
        flush();
        var code=[],lang=trim.slice(3).trim().split(/\\s+/)[0]||'';
        i++;
        while(i<lines.length&&lines[i].trim()!==FENCE){code.push(lines[i]);i++;}
        out.push('<pre class="ds-md-code"'+(lang?' data-lang="'+escHtml(lang)+'"':'')+'><code>'+escHtml(code.join('\\n'))+'</code></pre>');
        continue;
      }
      var q=line.match(/^>\\s?(.*)$/);
      if(q){
        flush();
        var quoted=[q[1]];
        while(i+1<lines.length){var nq=lines[i+1].match(/^>\\s?(.*)$/);if(!nq)break;quoted.push(nq[1]);i++;}
        out.push('<blockquote>'+renderMarkdown(quoted.join('\\n'))+'</blockquote>');
        continue;
      }
      var b=line.match(/^\\s*[-*]\\s+(.+)$/);
      if(b){
        flush();
        var bullets=[b[1]];
        while(i+1<lines.length){var nb=lines[i+1].match(/^\\s*[-*]\\s+(.+)$/);if(!nb)break;bullets.push(nb[1]);i++;}
        out.push('<ul>'+bullets.map(function(item){return '<li>'+renderInlineMarkdown(item)+'</li>';}).join('')+'</ul>');
        continue;
      }
      var o=line.match(/^\\s*\\d+[.)]\\s+(.+)$/);
      if(o){
        flush();
        var ordered=[o[1]];
        while(i+1<lines.length){var no=lines[i+1].match(/^\\s*\\d+[.)]\\s+(.+)$/);if(!no)break;ordered.push(no[1]);i++;}
        out.push('<ol>'+ordered.map(function(item){return '<li>'+renderInlineMarkdown(item)+'</li>';}).join('')+'</ol>');
        continue;
      }
      para.push(line);
    }
    flush();
    return out.join('');
  }
  function markdownBlock(cls,text){var e=el('div',cls);e.innerHTML=renderMarkdown(text);return e;}
  function mermaidModule(){
    if(mermaidModulePromise)return mermaidModulePromise;
    mermaidModulePromise=import('/assets/mermaid.esm.min.mjs').then(function(mod){
      var mermaid=mod.default||mod;
      var dark=document.documentElement.getAttribute('data-theme')==='dark';
      mermaid.initialize({startOnLoad:false,securityLevel:'strict',htmlLabels:false,suppressErrorRendering:true,maxTextSize:8000,maxEdges:120,theme:dark?'dark':'default',flowchart:{htmlLabels:false,useMaxWidth:true}});
      return mermaid;
    });
    return mermaidModulePromise;
  }
  function sanitizeMermaidSvg(svg){
    var parsed=new DOMParser().parseFromString(String(svg||''),'image/svg+xml');
    var root=parsed.documentElement;
    if(!root||String(root.localName||root.nodeName).toLowerCase()!=='svg'||root.namespaceURI!=='http://www.w3.org/2000/svg')throw new Error('invalid diagram SVG');
    Array.prototype.slice.call(root.querySelectorAll('script,foreignObject,iframe,object,embed,image,a')).forEach(function(node){node.remove();});
    Array.prototype.slice.call(root.querySelectorAll('style')).forEach(function(node){if(/@import|javascript:|data:|https?:/i.test(node.textContent||''))node.remove();});
    [root].concat(Array.prototype.slice.call(root.querySelectorAll('*'))).forEach(function(node){
      Array.prototype.slice.call(node.attributes||[]).forEach(function(attr){
        var name=String(attr.name||'').toLowerCase(),value=String(attr.value||'');
        if(name.indexOf('on')===0){node.removeAttribute(attr.name);return;}
        if(name==='href'||name==='xlink:href'){if(value.charAt(0)!=='#')node.removeAttribute(attr.name);return;}
        if(/javascript:|data:|https?:/i.test(value)){node.removeAttribute(attr.name);return;}
        if(name==='style'&&/url\\((?!\\s*#)/i.test(value))node.removeAttribute(attr.name);
      });
    });
    return new XMLSerializer().serializeToString(root);
  }
  function renderConceptDiagrams(panel){
    if(!panel)return;
    $all('[data-concept-diagram]',panel).forEach(function(figure){
      if(figure.getAttribute('data-render-state'))return;
      figure.setAttribute('data-render-state','loading');
      var source=$('[data-mermaid-source]',figure),output=$('[data-mermaid-output]',figure),fallback=$('[data-mermaid-fallback]',figure);
      var text=source?source.textContent||'':'';
      mermaidModule().then(function(mermaid){return mermaid.render('ds-mermaid-'+(++mermaidRenderId),text);}).then(function(result){
        if(!output)return;
        output.innerHTML=sanitizeMermaidSvg(result.svg);
        figure.setAttribute('data-render-state','ready');
      }).catch(function(){
        figure.setAttribute('data-render-state','error');figure.classList.add('is-error');
        if(output)output.textContent='The diagram could not be drawn. Its caption and source are preserved below.';
        if(fallback)fallback.open=true;
      });
    });
  }
  document.addEventListener('ds-theme-change',function(){
    mermaidModulePromise=null;
    $all('[data-concept-diagram]').forEach(function(figure){
      figure.removeAttribute('data-render-state');figure.classList.remove('is-error');
      var output=$('[data-mermaid-output]',figure);if(output)output.textContent='';
    });
    renderConceptDiagrams(document.body);
  });
  var STORY_MODELS={
    claude:[['Best quality','opus','Use the strongest available model for the clearest story'],['Lower cost','haiku','Use a smaller model for a faster, cheaper run']],
    // Safe while the live catalog loads: use the default from the exact Codex
    // runtime diffStory will launch, never a guessed hard-coded model name.
    codex:[['Codex default','','Use the default model from your installed Codex app']]
  };

  function setSidebarCollapsed(collapsed,persist){
    document.body.classList.toggle('ds-rail-collapsed',collapsed);
    if(persist!==false){try{localStorage.setItem('ds-sidebar-collapsed',collapsed?'1':'0');}catch(e){}}
    $all('[data-sidebar-toggle]').forEach(function(b){
      b.classList.toggle('is-active',!collapsed);
      b.setAttribute('aria-expanded',collapsed?'false':'true');
      b.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
      b.setAttribute('title',collapsed?'Expand sidebar':'Collapse sidebar');
    });
    syncSidebarOverlay(collapsed);
  }
  function compactScreen(){return !!(window.matchMedia&&window.matchMedia('(max-width:720px)').matches);}
  function prefersReducedMotion(){return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
  function showFilmTooltip(node){
    if(!filmTooltip||!node)return;
    var label=$('.ds-filmnode-label',node),thread=closest(node,'[data-filmthread]');if(!label||!thread)return;
    filmTooltipTarget=node;filmTooltip.textContent=label.textContent||'';filmTooltip.classList.add('is-visible');
    // Measured against whatever actually positions the tooltip — inside the dock
    // that is the island, not the thread row it lives in.
    var anchor=filmTooltip.offsetParent||thread;
    var tr=anchor.getBoundingClientRect(),nr=node.getBoundingClientRect(),half=filmTooltip.offsetWidth/2,x=nr.left+nr.width/2-tr.left;
    x=Math.max(half+10,Math.min(tr.width-half-10,x));filmTooltip.style.setProperty('--ds-film-tooltip-x',x+'px');
  }
  function hideFilmTooltip(node){if(!filmTooltip||filmTooltipTarget!==node)return;filmTooltipTarget=null;filmTooltip.classList.remove('is-visible');}
  function syncFilmProgress(){
    if(!filmThread)return;
    if(active<=0){filmThread.style.setProperty('--thread-pct','0px');return;}
    var nodes=$('.ds-filmthread-nodes',filmThread),node=nodes?$('[data-thread-node="'+active+'"]',nodes):null;if(!nodes||!node)return;
    // Both rectangles share the rendered viewport coordinate space. Their
    // difference stays correct after zoom and space-between redistributes nodes.
    var nr=nodes.getBoundingClientRect(),ar=node.getBoundingClientRect(),center=ar.left-nr.left+ar.width/2;
    if(Number.isFinite(center))filmThread.style.setProperty('--thread-pct',center+'px');
  }
  function watchFilmProgress(){
    syncFilmProgress();
    if(!filmThread||typeof ResizeObserver!=='function')return;
    var nodes=$('.ds-filmthread-nodes',filmThread);if(!nodes)return;
    if(!filmProgressObserver)filmProgressObserver=new ResizeObserver(syncFilmProgress);
    filmProgressObserver.disconnect();filmProgressObserver.observe(nodes);
  }
  function onFilmPointerOver(e){var node=closest(e.target,'.ds-filmnode');if(node)showFilmTooltip(node);}
  function onFilmPointerOut(e){var node=closest(e.target,'.ds-filmnode');if(node&&!node.contains(e.relatedTarget)&&document.activeElement!==node)hideFilmTooltip(node);}
  function onFilmFocusIn(e){var node=closest(e.target,'.ds-filmnode');if(node){clearFilmMagnification();showFilmTooltip(node);}}
  function onFilmFocusOut(e){var node=closest(e.target,'.ds-filmnode');if(node&&!node.contains(e.relatedTarget))hideFilmTooltip(node);}
  function clearFilmMagnification(){
    if(filmMagnifyFrame)cancelAnimationFrame(filmMagnifyFrame);filmMagnifyFrame=0;filmPointerX=null;
    if(filmThread)$all('.ds-filmnode',filmThread).forEach(function(node){node.style.removeProperty('--ds-dock-scale');node.style.removeProperty('--ds-dock-lift');});
  }
  function renderFilmMagnification(){
    filmMagnifyFrame=0;if(!filmThread||filmPointerX===null)return;
    $all('.ds-filmnode',filmThread).forEach(function(node){var r=node.getBoundingClientRect(),distance=Math.abs(filmPointerX-(r.left+r.width/2)),t=Math.max(0,1-distance/96),influence=t*t*(3-2*t);node.style.setProperty('--ds-dock-scale',(1+.24*influence).toFixed(3));node.style.setProperty('--ds-dock-lift',(-5*influence).toFixed(2)+'px');});
  }
  function onFilmPointerMove(e){
    var thread=closest(e.target,'[data-filmthread]');if(!thread||!closest(e.target,'.ds-filmthread-scroll')){clearFilmMagnification();return;}
    if(prefersReducedMotion()||(window.matchMedia&&window.matchMedia('(hover:none),(pointer:coarse)').matches)){clearFilmMagnification();return;}
    filmThread=thread;filmPointerX=e.clientX;if(!filmMagnifyFrame)filmMagnifyFrame=requestAnimationFrame(renderFilmMagnification);
  }
  function onFilmPointerLeave(){clearFilmMagnification();}
  function visibleWorkspaceSurface(kind){
    var selector=kind==='view'?'.ds-view:not([hidden])':kind==='file'?'.ds-filepanel:not([hidden])':kind==='step'?'.ds-step:not([hidden])':kind==='mode'?'.ds-filepanel-body>[data-diff-inner]:not([hidden]),.ds-filepanel-body>[data-split-inner]:not([hidden]),.ds-filepanel-body>[data-full-inner]:not([hidden])':'';
    return selector?$(selector):null;
  }
  function runWorkspaceFallback(kind,direction,update){
    if(workspaceFallbackTimer)clearTimeout(workspaceFallbackTimer);
    $all('.is-workspace-entering').forEach(function(node){node.classList.remove('is-workspace-entering');node.removeAttribute('data-ds-enter-direction');});
    update();
    var surface=visibleWorkspaceSurface(kind);if(!surface)return null;
    surface.setAttribute('data-ds-enter-direction',String(direction||0));surface.classList.add('is-workspace-entering');
    workspaceFallbackTimer=setTimeout(function(){workspaceFallbackTimer=0;surface.classList.remove('is-workspace-entering');surface.removeAttribute('data-ds-enter-direction');},kind==='mode'?210:350);
    return null;
  }
  function runWorkspaceTransition(kind,direction,update){
    if(!update)return null;
    if(prefersReducedMotion()){update();return null;}
    if(typeof document.startViewTransition!=='function')return runWorkspaceFallback(kind,direction,update);
    if(workspaceTransition&&typeof workspaceTransition.skipTransition==='function')workspaceTransition.skipTransition();
    var token=++workspaceTransitionToken,root=document.documentElement;
    root.setAttribute('data-ds-motion',kind);
    root.setAttribute('data-ds-motion-direction',String(direction||0));
    try{workspaceTransition=document.startViewTransition(update);}catch(e){
      workspaceTransition=null;root.removeAttribute('data-ds-motion');root.removeAttribute('data-ds-motion-direction');update();return null;
    }
    Promise.resolve(workspaceTransition.ready).catch(function(){});
    Promise.resolve(workspaceTransition.finished).then(function(){
      if(token!==workspaceTransitionToken)return;
      workspaceTransition=null;root.removeAttribute('data-ds-motion');root.removeAttribute('data-ds-motion-direction');
    },function(){
      if(token!==workspaceTransitionToken)return;
      workspaceTransition=null;root.removeAttribute('data-ds-motion');root.removeAttribute('data-ds-motion-direction');
    });
    return workspaceTransition;
  }
  function syncSidebarOverlay(collapsed){
    var open=compactScreen()&&!collapsed,main=$('.ds-main'),chrome=$('.ds-reviewchrome-main'),scrim=$('[data-sidebar-scrim]');
    if(main){if(open)main.setAttribute('inert','');else main.removeAttribute('inert');}
    if(chrome){if(open)chrome.setAttribute('inert','');else chrome.removeAttribute('inert');}
    if(scrim){scrim.tabIndex=open?0:-1;scrim.setAttribute('aria-hidden',open?'false':'true');}
  }
  function openCompactSidebar(trigger){
    sidebarReturnFocus=trigger||document.activeElement;
    setSidebarCollapsed(false);
    var tab=$('.ds-tab[aria-selected="true"]');if(tab)tab.focus();
  }
  function closeCompactSidebar(restore){
    setSidebarCollapsed(true);
    var target=sidebarReturnFocus;sidebarReturnFocus=null;
    if(restore&&target&&target.focus)target.focus();
  }
  function focusActiveReview(){
    focusViewEntry(currentView());
  }
  function collapseCompactSidebar(){if(compactScreen()){closeCompactSidebar(false);focusActiveReview();}}
  function nodeElement(n){return n&&n.nodeType===1?n:(n&&n.parentElement?n.parentElement:null);}
  function codeForNode(n){var e=nodeElement(n);return e?closest(e,'[data-comment-code]'):null;}
  function clearSelectionSide(){
    document.body.classList.remove('ds-selecting-left');
    document.body.classList.remove('ds-selecting-right');
  }
  function isSecondarySelectionGesture(e){
    return !!e&&(e.button===2||(e.button===0&&e.ctrlKey));
  }
  function trackSelectionSide(e){
    if(isSecondarySelectionGesture(e)){selectionContextMenuPending=true;setTimeout(function(){selectionContextMenuPending=false;},500);return;}
    if(e.button!==0)return;
    var code=codeForNode(e.target);
    selectionContext=null;selectionRects=[];
    clearSelectionSide();
    if(!code)return;
    var side=code.getAttribute('data-comment-side')||'right';
    document.body.classList.add(side==='left'?'ds-selecting-left':'ds-selecting-right');
  }
  function releaseSelectionSide(e){
    if(isSecondarySelectionGesture(e)||(e&&e.button!==0))return;
    setTimeout(function(){
      var sel=window.getSelection&&window.getSelection();
      if(!sel||sel.rangeCount===0||sel.isCollapsed){clearSelectionSide();selectionContext=null;selectionRects=[];return;}
      cacheSelectionContext();
    },0);
  }
  function clearCollapsedSelection(){
    if(selectionContextMenuPending)return;
    var sel=window.getSelection&&window.getSelection();
    if(sel&&sel.rangeCount&&!sel.isCollapsed)return;
    selectionContext=null;selectionRects=[];
  }
  function selectedTextInCode(range,code){
    try{
      var r=document.createRange();
      r.selectNodeContents(code);
      if(code.contains(range.startContainer))r.setStart(range.startContainer,range.startOffset);
      if(code.contains(range.endContainer))r.setEnd(range.endContainer,range.endOffset);
      return r.toString();
    }catch(e){return '';}
  }
  function selectedOffsetInCode(code,text){
    var full=code&&code.textContent?code.textContent:'';
    var idx=full.indexOf(text);
    if(idx<0)return {};
    return {start:idx+1,end:idx+text.length};
  }
  function currentSelectionContext(){
    var sel=window.getSelection&&window.getSelection();
    if(!sel||sel.rangeCount===0||sel.isCollapsed)return null;
    var range=sel.getRangeAt(0);
    var startCode=codeForNode(range.startContainer),endCode=codeForNode(range.endContainer);
    var intendedSide=(startCode||endCode)?(startCode||endCode).getAttribute('data-comment-side')||'right':document.body.classList.contains('ds-selecting-left')?'left':document.body.classList.contains('ds-selecting-right')?'right':'';
    if(!intendedSide)return null;
    if(startCode&&endCode&&(endCode.getAttribute('data-comment-side')||'right')!==intendedSide)return null;
    var codes=$all('[data-comment-code]').filter(function(code){
      if((code.getAttribute('data-comment-side')||'right')!==intendedSide)return false;
      try{return range.intersectsNode(code);}catch(e){return false;}
    });
    if(!codes.length)return null;
    var file='',side='',rows=[],segments=[],targets=[];
    for(var i=0;i<codes.length;i++){
      var code=codes[i],row=closest(code,'.ds-row,.ds-urow');
      if(!row)return null;
      var s=code.getAttribute('data-comment-side')||'right';
      if(side&&s!==side)return null;
      side=s;
      var f=code.getAttribute('data-comment-file')||'';
      var line=parseInt(code.getAttribute('data-comment-line')||'0',10);
      if(!f)return null;
      if(file&&f!==file)return null;
      if(!line)return null;
      file=f;
      var piece=selectedTextInCode(range,code);
      if(piece)segments.push(piece);
      rows.push(row);
      targets.push({row:row,line:line});
    }
    var selectedText=segments.join('\\n').trim();
    if(!selectedText)return null;
    var firstRow=rows[0],lastRow=rows[rows.length-1],firstTarget=targets[0],lastTarget=targets[targets.length-1];
    var startLine=firstTarget.line;
    var endLine=lastTarget.line;
    if(!startLine||!endLine)return null;
    var firstText=selectedTextInCode(range,codes[0]);
    var lastText=selectedTextInCode(range,codes[codes.length-1]);
    var firstOffset=selectedOffsetInCode(codes[0],firstText);
    var lastOffset=selectedOffsetInCode(codes[codes.length-1],lastText);
    return {
      anchorRow:lastRow,
      file:file,
      line:startLine,
      side:side,
      step:firstRow.getAttribute('data-step')||'',
      selectedText:selectedText,
      selection:{startLine:startLine,endLine:endLine,startColumn:firstOffset.start,endColumn:lastOffset.end}
    };
  }
  function focusedRowContext(){
    var row=closest(document.activeElement,'.ds-row,.ds-urow');if(!row)return null;
    var code=$('[data-comment-code]',row);if(!code)return null;
    var file=code.getAttribute('data-comment-file')||'',line=parseInt(code.getAttribute('data-comment-line')||'0',10),side=code.getAttribute('data-comment-side')||'right';
    if(!file||!line)return null;
    var selectedText=(code.textContent||'').replace(/\\s+$/,'');
    return {anchorRow:row,file:file,line:line,side:side,step:row.getAttribute('data-step')||'',selectedText:selectedText,selection:{startLine:line,endLine:line,startColumn:1,endColumn:selectedText.length+1}};
  }
  function ensureSelectionMenu(){
    if(selectionMenu)return selectionMenu;
    selectionMenu=$('[data-selection-menu]')||el('div','ds-selection-menu');
    selectionMenu.setAttribute('data-selection-menu','');
    selectionMenu.setAttribute('role','menu');
    if(!selectionMenu.children.length){
      var b=el('button','','Comment selected code');
      b.setAttribute('type','button');b.setAttribute('role','menuitem');b.setAttribute('data-selection-comment','');selectionMenu.appendChild(b);
    }
    selectionMenu.hidden=true;
    if(!selectionMenu.parentNode)document.body.appendChild(selectionMenu);
    return selectionMenu;
  }
  function closeSelectionMenu(){
    if(selectionMenu)selectionMenu.hidden=true;
  }
  function cacheSelectionContext(){
    var ctx=currentSelectionContext();if(!ctx){selectionContext=null;selectionRects=[];return;}
    selectionContext=ctx;
    var sel=window.getSelection&&window.getSelection();if(!sel||!sel.rangeCount)return;
    var range=sel.getRangeAt(0),rect=range.getBoundingClientRect();
    if(!rect||(!rect.width&&!rect.height)){selectionRects=[];return;}
    selectionRects=[];var rects=range.getClientRects?range.getClientRects():[];
    for(var ri=0;ri<rects.length;ri++){var rr=rects[ri];if(rr.width||rr.height)selectionRects.push({left:rr.left,top:rr.top,right:rr.right,bottom:rr.bottom});}
    if(!selectionRects.length)selectionRects.push({left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom});
  }
  function pointInSelection(x,y){
    for(var i=0;i<selectionRects.length;i++){var r=selectionRects[i];if(x>=r.left-2&&x<=r.right+2&&y>=r.top-2&&y<=r.bottom+2)return true;}
    return false;
  }
  function contextForSelectionMenu(e){
    var live=currentSelectionContext();
    if(live){
      var sel=window.getSelection&&window.getSelection();
      if(sel&&sel.rangeCount){var range=sel.getRangeAt(0),rects=range.getClientRects?range.getClientRects():[];selectionRects=[];for(var i=0;i<rects.length;i++){var r=rects[i];if(r.width||r.height)selectionRects.push({left:r.left,top:r.top,right:r.right,bottom:r.bottom});}}
      selectionContext=live;
    }
    return selectionContext&&pointInSelection(e.clientX,e.clientY)?selectionContext:null;
  }
  function openSelectionMenu(e){
    var ctx=contextForSelectionMenu(e);
    selectionContextMenuPending=false;
    if(!ctx)return;
    e.preventDefault();
    selectionContext=ctx;
    var menu=ensureSelectionMenu();
    menu.hidden=false;
    var x=e.clientX,y=e.clientY;
    var w=menu.offsetWidth||168,h=menu.offsetHeight||120;
    var vw=window.innerWidth||document.documentElement.clientWidth||0;
    var vh=window.innerHeight||document.documentElement.clientHeight||0;
    menu.style.left=Math.max(8,Math.min(x,vw-w-8))+'px';
    menu.style.top=Math.max(8,Math.min(y,vh-h-8))+'px';
  }
  function sidebarBounds(){
    var vw=window.innerWidth||document.documentElement.clientWidth||0;
    var min=240,max=Math.min(560,Math.max(min,vw-360));
    return {min:min,max:max};
  }
  function currentSidebarWidth(){
    var layout=$('.ds-layout'),bodyStyle=document.body.style;
    var raw=(bodyStyle.getPropertyValue('--ds-rail-width')||getComputedStyle(document.body).getPropertyValue('--ds-rail-width')||(layout&&layout.style.getPropertyValue('--ds-rail-width'))||(layout&&getComputedStyle(layout).getPropertyValue('--ds-rail-width'))||'316').replace('px','');
    return parseFloat(raw)||316;
  }
  function updateSidebarHandle(width){
    var b=sidebarBounds();
    $all('[data-sidebar-resizer]').forEach(function(h){
      h.setAttribute('aria-valuemin',String(b.min));
      h.setAttribute('aria-valuemax',String(b.max));
      h.setAttribute('aria-valuenow',String(Math.round(width)));
    });
  }
  function setSidebarWidth(w,persist){
    var b=sidebarBounds(),width=Math.max(b.min,Math.min(b.max,Number(w)||316));
    document.body.style.setProperty('--ds-rail-width',width+'px');
    updateSidebarHandle(width);
    if(persist){try{localStorage.setItem('ds-sidebar-width',String(Math.round(width)));}catch(e){}}
  }

  function focusElementWithoutScroll(target){
    if(!target||!target.focus)return false;
    try{target.focus({preventScroll:true});}catch(e){target.focus();}
    return document.activeElement===target;
  }
  function focusStoryViewEntry(){
    var panel=stepPanels&&stepPanels[active],target=null;
    if(panel){
      var host=beatHost(panel);
      target=active===0?$('.ds-intro-start',panel):$('[data-story-beat][aria-pressed="true"]',host);
      if(!target)target=$('[data-story-beat]',host)||$('.ds-concept-next',panel);
    }
    if(!target)target=$('[data-thread-node="'+active+'"]')||$('.ds-tab[aria-selected="true"]');
    focusElementWithoutScroll(target);
  }
  var DS_VIEWS=['tour','files','review'];
  function viewIndex(v){var i=DS_VIEWS.indexOf(v);return i<0?0:i;}
  function currentView(){var v=document.body.getAttribute('data-read-view');return DS_VIEWS.indexOf(v)<0?'tour':v;}
  function viewElement(v){return v==='files'?filesView:v==='review'?reviewView:tourView;}
  var pendingReviewSection=false;
  function focusViewEntry(v){
    if(v==='tour'){focusStoryViewEntry();return;}
    if(v==='review'){
      // gotoReview is about to focus a specific section; do not outrun it.
      if(pendingReviewSection)return;
      var selectedReviewTab=$('.ds-reviewtab[aria-selected="true"]');
      focusElementWithoutScroll(selectedReviewTab||$('[data-view="review"]'));return;
    }
    var tab=$('[data-view="files"]');if(!focusElementWithoutScroll(tab)){var search=$('[data-file-search]');focusElementWithoutScroll(search);}
  }
  function setView(v,focusAfter){
    if(DS_VIEWS.indexOf(v)<0)v='tour';
    // Read the previous view from the attribute the last commit wrote rather than
    // from panel visibility: with three panels a mid-transition DOM read is
    // ambiguous, and the server now paints data-read-view so the first read is
    // honest too.
    var previous=currentView();
    if(compactScreen()&&v!=='files')setSidebarCollapsed(true,false);
    var update=function(){
      document.body.setAttribute('data-read-view',v);
      if(tourView)tourView.hidden=v!=='tour';
      if(filesView)filesView.hidden=v!=='files';
      if(reviewView)reviewView.hidden=v!=='review';
      $all('.ds-tab').forEach(function(t){var on=t.getAttribute('data-view')===v;t.classList.toggle('is-active',on);t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;});
      $all('[data-rail]').forEach(function(r){r.hidden=r.getAttribute('data-rail')!==v;});
      revealResumeReview();
      // Files parks focus on its own tab, so entering it from a click would steal
      // focus back off whatever was clicked. Story and Review both have a real
      // entry point worth landing on.
      if(focusAfter||(v!=='files'&&previous!==v))setTimeout(function(){focusViewEntry(v);},0);
    };
    // Left-to-right tab order is the spatial model: tour(0) < files(1) < review(2).
    if(reviewPositionReady&&previous!==v)runWorkspaceTransition('view',viewIndex(v)>viewIndex(previous)?1:-1,update);else update();
    if(v==='files'&&selectedFile<0)selectFile(0);
    if(v==='review')loadTrustEvidence();
    watchStickyMetrics();
    if(v!=='tour'){cancelFocusScroll();setAloudIntent('off');cancelSpeech();}
    saveReviewPositionSoon();
  }

  function loadStoryStep(i,done){
    var panel=stepPanels&&stepPanels[i];if(!panel||!panel.hasAttribute('data-step-lazy')){if(done)done(true);return;}
    panel._dsStepCallbacks=panel._dsStepCallbacks||[];if(done)panel._dsStepCallbacks.push(done);
    if(panel.getAttribute('data-step-loading')==='1')return;
    panel.setAttribute('data-step-loading','1');
    panel.innerHTML='<div class="ds-step-loading" role="status"><span class="ds-sk" style="width:34%"></span><span class="ds-sk" style="width:76%"></span><span class="ds-sk" style="width:58%"></span><span class="ds-step-loading-tx">Loading this review step…</span></div>';
    fetch(reviewPageUrl('/api/review/step-panel?index='+encodeURIComponent(String(i))))
      .then(reviewLazyText)
      .then(function(html){
        var template=document.createElement('template');template.innerHTML=html.trim();var fresh=template.content.firstElementChild;
        if(!fresh||!fresh.classList||!fresh.classList.contains('ds-step'))throw new Error('Invalid story step');
        var callbacks=panel._dsStepCallbacks||[];panel.replaceWith(fresh);stepPanels=$all('.ds-step');
        mountCommentPins(fresh);adoptStepDocks();renderConceptDiagrams(fresh);$all('.ds-filepanel,.ds-diff',fresh).forEach(updateChangeNav);
        try{var split=localStorage.getItem('ds-split');if(split)$all('.ds-filepanel,.ds-diff',fresh).forEach(function(holder){holder.style.setProperty('--ds-split',split);});}catch(e){}
        callbacks.forEach(function(callback){callback(true);});
      })
      .catch(function(err){
        var callbacks=panel._dsStepCallbacks||[];panel._dsStepCallbacks=[];
        panel.removeAttribute('data-step-loading');
        panel.innerHTML='<div class="ds-step-loaderror" role="alert"><span>'+reviewLazyMessage(err,'Could not load this review step.')+'</span>'+reviewLazyAction(err,'data-retry-story-step',String(i))+'</div>';
        callbacks.forEach(function(callback){callback(false);});
      });
  }
  function activateStep(i,autoSpeak){
    if(i<0)i=0;if(i>total-1)i=total-1;var previous=active;active=i;visited[i]=true;
    if(aloudIntent==='off')clearVoiceFocus();
    var update=function(){
      stepPanels.forEach(function(p,idx){p.hidden=idx!==i;});
      stepCards.forEach(function(c,idx){
        var isA=idx===i,isV=visited[idx]&&!isA;
        c.classList.toggle('is-active',isA);
        c.classList.toggle('is-visited',isV);
        // Index 0 is the Overview — leave its mark alone; real steps keep stable numbers.
        var num=$('.ds-num',c);if(num&&!c.hasAttribute('data-intro'))num.textContent=('0'+idx).slice(-2);
      });
      $all('[data-story-step-node]').forEach(function(node){node.classList.toggle('is-active',parseInt(node.getAttribute('data-story-step-node')||'-1',10)===i);});
      var activeCard=stepCards[i],chapter=activeCard?closest(activeCard,'[data-story-chapter]'):null;if(chapter)chapter.open=true;
      $all('[data-thread-node]').forEach(function(n){var k=parseInt(n.getAttribute('data-thread-node')||'-1',10);n.classList.toggle('is-active',k===i);n.classList.toggle('is-visited',!!visited[k]&&k!==i);});
      syncDockStage();
      var thread=$('[data-filmthread]');
      document.body.classList.toggle('ds-overview-active',i===0);
      if(thread){
        if(i===0&&previous!==0){var introStart=$('.ds-intro-start');if(introStart)introStart.focus({preventScroll:true});}
        thread.classList.toggle('is-overview',i===0);
        if(i===0){filmTooltipTarget=null;if(filmTooltip)filmTooltip.classList.remove('is-visible');clearFilmMagnification();}
        var an=$('[data-thread-node="'+i+'"]',thread),scroll=$('.ds-filmthread-scroll',thread);
        // The fill is measured from the active node's rendered center and kept
        // live by the filmstrip observer when zoom or layout redistributes it.
        if(i>0&&an)syncFilmProgress();
        if(i>0&&an&&scroll){if(i<=1)scroll.scrollLeft=0;else{var sr=scroll.getBoundingClientRect(),ar=an.getBoundingClientRect();scroll.scrollLeft+=(ar.left+ar.width/2)-(sr.left+sr.width/2);}}}
      // A prefetched step is already loaded but still hidden while the workspace
      // transition starts. Paint only after this visibility update has landed.
      syncActiveAnnotations();
    };
    if(reviewPositionReady&&previous!==i)runWorkspaceTransition('step',i>previous?1:-1,update);else update();
    var steps=total-1; // real steps, with the Overview excluded
    var pt=$('#ds-progress-text');if(pt)pt.textContent=i===0?'Overview':(i+' / '+steps);
    var ratio=i===0||!steps?0:i/steps;ratio=Math.max(0,Math.min(1,ratio));
    var pf=$('#ds-progress-fill');if(pf)pf.style.transform='scaleX('+ratio+')';
    if(tourView)tourView.scrollTop=0;
    var ap=stepPanels[i];if(ap)ap.scrollTop=0;
    if(ap)renderConceptDiagrams(ap);
    applyResponsiveStoryMode(ap);
    // A hidden step has no box to measure, and a lazy one brings its own dock and
    // toolbar, so the metrics are taken (and re-observed) as the step comes up.
    watchStickyMetrics();
    prepareStepNarration(i===0?1:i);
    if(i===0)clearStoryFocus();
    var storyFocused=ap&&i>0?selectStoryFocus(i,0,true):false;
    if(ap&&!storyFocused)jumpToFirstChange($('.ds-diff',ap));
    // The autoSpeak branch is exactly the user-driven navigation path — the
    // narration engine advances the story with activateStep(i,false). Moving
    // while paused stays silent (speakStep is intent-gated) and re-points Resume
    // at the step the reviewer actually landed on.
    if(autoSpeak!==false){markResumeMoved();speakStep(i);}
    saveReviewPositionSoon();
  }
  function setActive(i,autoSpeak){
    if(i<0)i=0;if(i>total-1)i=total-1;
    // setActive is the user-driven entry point, so re-point Resume here rather
    // than relying on activateStep's autoSpeak branch: on a lazy step that branch
    // only runs from the load callback, which leaves a pause resuming into the
    // step the reviewer had already walked away from.
    markResumeMoved();
    var panel=stepPanels&&stepPanels[i];
    if(panel&&panel.hasAttribute('data-step-lazy')){
      activateStep(i,false);
      loadStoryStep(i,function(ok){if(ok&&active===i){activateStep(i,autoSpeak!==false);loadStoryStep(i+1);}});
      return;
    }
    activateStep(i,autoSpeak!==false);
    if(i>0)loadStoryStep(i+1);
  }
  function clearSpeechCursor(){
    currentSpeechStep=-1;currentSpeechUnit=-1;currentSpeechManual=false;
  }

  function clearVoiceFocus(){
    cancelFocusScroll();
    voiceFocusTimers.forEach(function(t){clearTimeout(t);});
    voiceFocusTimers=[];
    voiceFocusIndex=-1;
    voiceFocusGroup=-1;
    $all('.ds-step.is-voice-active').forEach(function(p){p.classList.remove('is-voice-active');});
    $all('.ds-row.is-voice-focus,.ds-urow.is-voice-focus').forEach(function(r){r.classList.remove('is-voice-focus');});
    clearActiveBeats();
  }
  function clearActiveBeats(){
    $all('.ds-beat.is-active,.ds-railbeat.is-active').forEach(function(b){b.classList.remove('is-active');});
  }
  // ---- The bottom island owns the beats ----
  // A step still renders its own dock (that is what the lazy step endpoint hands
  // back), but the dock is adopted into the island's stage so the reviewer reads
  // one bar instead of two. Everything that used to scope a beat query to the step
  // panel now goes through beatHost, and everything that walked back up to the
  // panel from a beat goes through beatPanel — the two are no longer the same tree.
  function beatHost(panel){
    if(!panel||!panel.getAttribute)return panel||null;
    var index=panel.getAttribute('data-step-panel');
    if(index==null)return panel;
    return $('[data-beat-dock][data-dock-step="'+index+'"]')||panel;
  }
  function beatPanel(node){
    var dock=closest(node,'[data-beat-dock]');
    if(dock){
      var owner=$('.ds-step[data-step-panel="'+dock.getAttribute('data-dock-step')+'"]');
      if(owner)return owner;
    }
    return closest(node,'.ds-step');
  }
  function adoptStepDocks(){
    var stage=$('[data-dock-slot]');if(!stage)return;
    $all('.ds-step [data-beat-dock]').forEach(function(dock){stage.appendChild(dock);});
    syncDockStage();
  }
  // With no dock for this step — the Overview, a concept step — the stage names the
  // step instead of collapsing, so the island keeps one steady height as you walk.
  function syncDockStage(){
    var stage=$('[data-dock-slot]');if(!stage)return;
    var mounted=null;
    $all('[data-beat-dock]',stage).forEach(function(dock){
      var on=parseInt(dock.getAttribute('data-dock-step')||'-1',10)===active;
      dock.hidden=!on;if(on)mounted=dock;
    });
    var idle=$('[data-dock-idle]',stage);if(!idle)return;
    idle.hidden=!!mounted;
    if(mounted)return;
    var label=$('[data-thread-node="'+active+'"] .ds-filmnode-label');
    idle.textContent=label?(label.textContent||'').trim():'Overview';
  }
  function focusGroupsForPanel(panel){
    var seen={};
    $all('[data-step-focus]',panel).forEach(function(r){
      var n=parseInt(r.getAttribute('data-step-focus')||'0',10);
      if(!isNaN(n))seen[n]=true;
    });
    return Object.keys(seen).map(function(k){return parseInt(k,10);}).sort(function(a,b){return a-b;});
  }
  function focusRowsForGroup(panel,group){
    var groups=focusGroupsForPanel(panel);
    if(!groups.length)return [];
    var g=groups.indexOf(group)>=0?group:groups[0];
    return $all('[data-step-focus="'+g+'"]',panel);
  }
  function updateBeatNav(panel,selected){
    var host=beatHost(panel);
    var beats=$all('[data-story-beat]',host),current=$('[data-beat-current]',host),prev=$('[data-beat-move="-1"]',host),next=$('[data-beat-move="1"]',host);
    var index=beats.findIndex(function(beat){return parseInt(beat.getAttribute('data-focus-group')||'-1',10)===selected;});if(index<0)index=0;
    var panelIndex=parseInt(panel.getAttribute('data-step-panel')||'-1',10);
    if(current)current.textContent=String(index+1).padStart(2,'0');if(prev)prev.disabled=index<=0&&panelIndex<=1;if(next)next.disabled=index>=beats.length-1&&panelIndex>=total-1;
    var railCurrent=$('[data-story-step-node="'+panelIndex+'"] [data-rail-current]');
    if(railCurrent)railCurrent.textContent=(index+1)+' / '+beats.length;
  }
  function cancelFocusScroll(){
    if(focusScrollTimer)clearTimeout(focusScrollTimer);
    if(focusScrollFrame)cancelAnimationFrame(focusScrollFrame);
    focusScrollTimer=0;focusScrollFrame=0;
  }
  function centerFocusRows(rows,instant){
    cancelFocusScroll();
    if(!rows.length)return;
    var rendered=rows.filter(function(row){return !closest(row,'[hidden]')&&row.getClientRects().length>0;});
    var candidates=rendered.length?rendered:rows,target=candidates[Math.floor((candidates.length-1)/2)];if(!target)return;
    focusScrollTimer=setTimeout(function(){
      focusScrollTimer=0;
      focusScrollFrame=requestAnimationFrame(function(){
        focusScrollFrame=0;
        if(!document.documentElement.contains(target))return;
        var scroller=closest(target,'.ds-diffscroll');if(!scroller||!document.documentElement.contains(scroller))return;
        var sr=scroller.getBoundingClientRect(),tr=target.getBoundingClientRect();
        var top=scroller.scrollTop+(tr.top-sr.top)-(scroller.clientHeight-tr.height)/2;
        try{scroller.scrollTo({top:Math.max(0,top),behavior:instant||prefersReducedMotion()?'auto':'smooth'});}
        catch(e){scroller.scrollTop=Math.max(0,top);}
      });
    },instant?0:120);
  }
  function clearStoryFocus(){
    cancelFocusScroll();
    storyFocusIndex=-1;storyFocusGroup=-1;
    $all('.ds-step.is-story-active').forEach(function(p){p.classList.remove('is-story-active');});
    $all('.ds-row.is-story-focus,.ds-urow.is-story-focus').forEach(function(r){r.classList.remove('is-story-focus');});
    $all('.ds-beat.is-selected').forEach(function(b){b.classList.remove('is-selected');b.setAttribute('aria-pressed','false');});
    $all('.ds-railbeat.is-selected').forEach(function(b){b.classList.remove('is-selected');b.classList.add('is-visited');b.setAttribute('aria-pressed','false');});
  }
  function announceStoryFocus(panel,beat){
    if(!panel||!beat)return;
    var status=$('[data-story-focus-status]',beatHost(panel));if(!status)return;
    var destination=beat.getAttribute('data-focus-destination')||'';
    var label=beat.getAttribute('data-focus-group')||'0';
    status.textContent='';
    setTimeout(function(){status.textContent='Story beat '+(parseInt(label,10)+1)+' focused at '+destination;},0);
  }
  // fromVoice suppresses the live-region announcement only: the narration is
  // already saying this beat out loud, so announcing it again talks over itself.
  function selectStoryFocus(stepIndex,group,shouldScroll,fromVoice){
    var panel=stepPanels&&stepPanels[stepIndex];
    if(!panel||!panel.hasAttribute('data-story-focus'))return false;
    var groups=focusGroupsForPanel(panel);if(!groups.length)return false;
    var selected=groups.indexOf(group)>=0?group:groups[0],rows=focusRowsForGroup(panel,selected);if(!rows.length)return false;
    clearStoryFocus();
    storyFocusIndex=stepIndex;storyFocusGroup=selected;panel.classList.add('is-story-active');
    rows.forEach(function(r){r.classList.add('is-story-focus');});
    var beat=$('[data-story-beat][data-focus-group="'+selected+'"]',beatHost(panel));
    if(beat){beat.classList.add('is-selected');beat.setAttribute('aria-pressed','true');if(!fromVoice)announceStoryFocus(panel,beat);}
    var railBeat=$('[data-rail-beat][data-rail-step-index="'+stepIndex+'"][data-focus-group="'+selected+'"]');
    if(railBeat){railBeat.classList.add('is-selected');railBeat.setAttribute('aria-pressed','true');}
    updateBeatNav(panel,selected);
    if(shouldScroll!==false)centerFocusRows(rows,false);
    return true;
  }
  function focusStoryStepBoundary(stepIndex,atEnd){
    var initial=stepPanels&&stepPanels[stepIndex],wasLazy=initial&&initial.hasAttribute('data-step-lazy');
    var finish=function(ok){
      if(!ok||active!==stepIndex)return;
      var panel=stepPanels&&stepPanels[stepIndex],beats=panel?$all('[data-story-beat]',beatHost(panel)):[];
      if(!beats.length){
        var boundaryTarget=panel&&atEnd?$('.ds-concept-next',panel):null;
        if(!boundaryTarget&&panel)boundaryTarget=$('.ds-intro-start',panel)||$('[data-goto-step]',panel);
        if(!boundaryTarget)boundaryTarget=$('[data-thread-node="'+stepIndex+'"]');
        var conceptScroll=panel&&$('.ds-concept-scroll',panel);
        if(conceptScroll)conceptScroll.scrollTop=atEnd?conceptScroll.scrollHeight:0;
        if(atEnd&&boundaryTarget&&boundaryTarget.focus)boundaryTarget.focus();else focusElementWithoutScroll(boundaryTarget);
        return;
      }
      var target=beats[atEnd?beats.length-1:0],group=parseInt(target.getAttribute('data-focus-group')||'0',10);
      selectStoryFocus(stepIndex,group,true);focusElementWithoutScroll(target);
    };
    var finishAfterActivation=function(ok){
      if(!ok)return;
      var focus=function(){requestAnimationFrame(function(){finish(true);});};
      if(workspaceTransition&&workspaceTransition.finished)Promise.resolve(workspaceTransition.finished).then(focus,focus);else focus();
    };
    setActive(stepIndex,false);
    if(wasLazy)loadStoryStep(stepIndex,finishAfterActivation);else finishAfterActivation(true);
  }
  function moveStoryBeat(button,delta){
    var panel=beatPanel(button);if(!panel)return false;
    var beats=$all('[data-story-beat]',beatHost(panel)),index=beats.indexOf(button);if(index<0||!beats.length)return false;
    var stepIndex=parseInt(panel.getAttribute('data-step-panel')||'0',10);
    if(delta>0&&index===beats.length-1&&stepIndex<total-1){focusStoryStepBoundary(stepIndex+1,false);return true;}
    if(delta<0&&index===0&&stepIndex>1){focusStoryStepBoundary(stepIndex-1,true);return true;}
    var next=Math.max(0,Math.min(beats.length-1,index+delta)),target=beats[next];
    var group=parseInt(target.getAttribute('data-focus-group')||'0',10);
    selectStoryFocus(stepIndex,group,true);target.focus();return true;
  }
  function movePanelBeat(panel,delta){
    if(!panel)return false;var host=beatHost(panel),selected=$('[data-story-beat].is-selected',host)||$('[data-story-beat]',host);if(!selected)return false;
    return moveStoryBeat(selected,delta);
  }
  function moveRailBeat(button,delta){
    if(!button)return false;var stepIndex=parseInt(button.getAttribute('data-rail-step-index')||'-1',10),beats=$all('[data-rail-beat][data-rail-step-index="'+stepIndex+'"]'),index=beats.indexOf(button);if(index<0||!beats.length)return false;
    var next=Math.max(0,Math.min(beats.length-1,index+delta)),target=beats[next],group=parseInt(target.getAttribute('data-focus-group')||'0',10);
    selectStoryFocus(stepIndex,group,true);target.focus();return true;
  }
  function applyResponsiveStoryMode(panel){
    if(!panel||!compactScreen())return;
    var holder=$('[data-story-diff]',panel);if(!holder||holder.hasAttribute('data-mode-user-set'))return;
    var unified=$('.ds-modetoggle button[data-mode="diff"]',holder);
    if(unified&&!unified.classList.contains('is-active')){
      setMode(unified,{persist:false});
      var panelIndex=parseInt(panel.getAttribute('data-step-panel')||'-1',10);
      if(storyFocusIndex===panelIndex)selectStoryFocus(panelIndex,storyFocusGroup,true);
    }
  }
  function estimatedSpeechDurationMs(text){
    var words=(text||'').split(/\\s+/).filter(Boolean).length;
    return Math.max(2400,Math.round(words/Math.max(80,155*aloudRate)*60000));
  }
  function activeVoiceFocusRows(panel,group){
    var focused=focusRowsForGroup(panel,group);if(focused.length)return focused;
    var rows=$all('.ds-row-add,.ds-row-del',panel);
    return rows.length?rows:$all('.ds-row',panel);
  }
  function applyVoiceFocusGroup(stepIndex,group){
    if(stepIndex==null||stepIndex<0)return;
    var panel=stepPanels&&stepPanels[stepIndex];if(!panel)return;
    if(voiceFocusIndex===stepIndex&&voiceFocusGroup>group)return;
    $all('.ds-row.is-voice-focus,.ds-urow.is-voice-focus',panel).forEach(function(r){r.classList.remove('is-voice-focus');});
    voiceFocusIndex=stepIndex;
    voiceFocusGroup=group;
    panel.classList.add('is-voice-active');
    // The dock is the reviewer's "which beat is this" readout, so the voice has
    // to carry it along: marking the beat active only recolored it, which left
    // the counter and the shown note parked on beat one for the whole step.
    // Ahead of centerFocusRows because selectStoryFocus cancels pending scrolls.
    selectStoryFocus(stepIndex,group,false,true);
    var focusRows=activeVoiceFocusRows(panel,group);
    focusRows.forEach(function(r){r.classList.add('is-voice-focus');});
    centerFocusRows(focusRows,false);
  }
  function setVoiceFocus(stepIndex,focusGroup){
    clearVoiceFocus();
    applyVoiceFocusGroup(stepIndex,focusGroup||0);
  }
  function setActiveBeat(stepIndex,group){
    setVoiceFocus(stepIndex,group==null?0:group);
    var panel=stepPanels&&stepPanels[stepIndex];if(!panel)return;
    var beat=group==null?null:$('[data-story-beat][data-focus-group="'+group+'"]',beatHost(panel));
    if(beat)beat.classList.add('is-active');
    var railBeat=group==null?null:$('[data-rail-beat][data-rail-step-index="'+stepIndex+'"][data-focus-group="'+group+'"]');
    if(railBeat)railBeat.classList.add('is-active');
  }
  function startVoiceFocusSequence(stepIndex,text){
    clearVoiceFocus();
    if(stepIndex==null||stepIndex<0)return;
    var panel=stepPanels&&stepPanels[stepIndex];if(!panel)return;
    var count=Math.max(1,focusGroupsForPanel(panel).length);
    applyVoiceFocusGroup(stepIndex,0);
    if(count<=1)return;
    var each=Math.max(900,estimatedSpeechDurationMs(text)/count);
    for(var i=1;i<count;i++){
      (function(group){
        voiceFocusTimers.push(setTimeout(function(){applyVoiceFocusGroup(stepIndex,group);},Math.round(each*group)));
      })(i);
    }
  }

  // The reviewer's intent — 'off', 'playing' or 'paused' — and the only thing
  // that decides whether moving through the story narrates. Deliberately never
  // written by the status poll: aloudActive and aloudPaused mirror what the
  // daemon last reported, which is an observation, and it arrives late and
  // sometimes stale. Conflating the two is why pause never held. A pause used to
  // leave "narrate as I navigate" armed, so clicking any step, pressing j/k or
  // pressing an arrow key started a brand new job talking over the pause.
  function narrationPlaying(){return aloudIntent==='playing';}
  function setAloudIntent(next){
    aloudIntent=next;
    if(next!=='paused')aloudResumeDirty=false;
  }
  // Moving the reading cursor while paused must stay silent, but it also
  // invalidates the daemon's paused job — it is parked somewhere the reviewer
  // has left. Remember that, so Resume speaks from where they actually are
  // instead of resuming a job pointing at the step they walked away from.
  function markResumeMoved(){
    if(aloudIntent==='paused')aloudResumeDirty=true;
  }
  function cancelSpeech(stopPlayback){
    cancelFocusScroll();
    voiceSequenceToken++;
    clearSpeechCursor();
    aloudRequestToken++;
    aloudControlToken++;aloudControlPending=false;
    if(aloudControlTimer){clearTimeout(aloudControlTimer);aloudControlTimer=0;}
    if(aloudPollTimer){clearTimeout(aloudPollTimer);aloudPollTimer=0;}
    if(aloudRequestAbort){try{aloudRequestAbort.abort();}catch(e){}}
    aloudRequestAbort=null;
    // speechLoadingLabel belongs in this guard: aborting our own fetch does not
    // un-send the POST, and the daemon starts the job whether or not we are still
    // listening. Without it, giving up mid-start left Aloud reading a story the
    // page had already forgotten, with every control hidden or idle.
    if(stopPlayback!==false&&(aloudActive||aloudJobId||speechLoadingLabel))aloudControl('stop',true);
    aloudActive=false;aloudPaused=false;aloudResumeDirty=false;aloudJobId='';aloudPhase='idle';aloudSequence=[];aloudSequenceIndex=-1;speechLoadingLabel='';
    clearVoiceFocus();
    var btn=$('[data-readaloud]');if(btn)btn.classList.remove('is-speaking');
    updateReadAloudButton();
  }
  // Narration is full of identifiers, and a phonemizer handed MAX_DAEMON_TEXT or
  // aloud-client.ts has no good options: it either spells letters out or slurs the
  // whole token. Splitting them into ordinary words first is what makes a beat
  // about code sound like a sentence instead of a stumble. Kept idempotent, since
  // stepSpeechUnits cleans a beat and splitSpeechUnit cleans it again.
  function speechClean(text){
    return (text||'')
      .replace(/→/g,' to ')
      .replace(/↵/g,' return ')
      // Our own name is one word. The camelCase rule below would otherwise read it
      // as "diff Story" every time a beat mentions the tool, which is most of them;
      // lowering the inner capital removes the boundary without a placeholder.
      .replace(/\\bdiffStory\\b/g,'diffstory')
      .replace(/\\bfn\\b/g,'function')
      .replace(/\\(\\)/g,' function ')
      // Operators, before punctuation stripping removes the characters they use.
      .replace(/!==|!=/g,' is not equal to ')
      .replace(/===|==/g,' equals ')
      .replace(/=>/g,' arrow ')
      .replace(/->/g,' to ')
      .replace(/&&/g,' and ')
      .replace(/\\|\\|/g,' or ')
      .replace(/>=/g,' at least ')
      .replace(/<=/g,' at most ')
      // A dotted file name reads as a word plus its extension, not as a decimal.
      .replace(/\\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|html|py|sh|yml|yaml)\\b/gi,' dot $1 ')
      // Paths: say the separator rather than running the segments together.
      .replace(/([A-Za-z0-9_)\\]])\\/([A-Za-z0-9_.])/g,'$1 slash $2')
      .replace(/::/g,' colon colon ')
      // A digit separator is not a word break: 120_000 has to stay one number,
      // or it reads as "one hundred twenty" followed by "zero".
      .replace(/([0-9])_([0-9])/g,'$1$2')
      // snake_case identifiers become separate words.
      .replace(/([A-Za-z0-9])_([A-Za-z0-9])/g,'$1 $2')
      // camelCase and PascalCase boundaries, including runs like HTTPServer.
      .replace(/([a-z0-9])([A-Z])/g,'$1 $2')
      // The acronym boundary needs two lowercase letters to follow, or a plural
      // acronym splits at its own last letter: APIs became "AP Is", IDs became
      // "I Ds". Requiring a real word after the capital keeps HTTPServer working
      // while leaving pluralised acronyms alone.
      .replace(/([A-Z]+)([A-Z][a-z]{2,})/g,'$1 $2')
      // Braces only. Semicolons used to be stripped alongside them, which read two
      // independent clauses as one breathless run-on ("the full modern gate legacy
      // repairs still validate..."). espeak-ng already treats a semicolon as a
      // clause pause, so deleting it threw away phrasing the narrator wanted.
      .replace(/[{}]+/g,' ')
      .replace(/\\s+/g,' ')
      // Expanding a token mid-sentence can leave a gap before the punctuation
      // that followed it, which the phonemizer voices as a stumble.
      .replace(/ +([,;:.!?])/g,'$1')
      .trim();
  }
  function speechFrom(node){
    // The speech projection rides in data-speech-text; textContent stays the
    // fallback so a node rendered without the attribute is still narrated.
    return speechClean(node.getAttribute('data-speech-text')||node.textContent||'');
  }
  function fallbackStepText(panel){
    var w=$('.ds-why-text',panel)||$('.ds-why-text',beatHost(panel));
    return w?speechFrom(w):'';
  }
  function stepSpeechUnits(panel){
    var overview=$all('[data-speech-overview],[data-speech-concept]',panel);
    if(overview.length){
      return overview.map(function(node){return {text:speechFrom(node),group:null};}).filter(function(unit){return !!unit.text;});
    }
    // A loaded step keeps its beats in the island; a lazy one still carries its own
    // sr-only speech cache, so both scopes are searched before giving up.
    var beats=$all('[data-speech-beat]',panel);
    if(!beats.length)beats=$all('[data-speech-beat]',beatHost(panel));
    if(beats.length){
      return beats.map(function(b){
        var group=parseInt(b.getAttribute('data-focus-group')||'',10);
        return {text:speechClean(b.getAttribute('data-speech-text')||b.textContent||''),group:isNaN(group)?null:group};
      }).filter(function(unit){return !!unit.text;});
    }
    var text=fallbackStepText(panel);
    return text?[{text:text,group:null}]:[];
  }
  function stepText(panel){
    return stepSpeechUnits(panel).map(function(unit){return unit.text;}).join(' ');
  }
  // Each chunk becomes its own synthesis request and its own audio clip, played
  // back to back. So a chunk boundary is an audible boundary: the narrator stops,
  // and the next clip starts with fresh sentence intonation. Boundaries therefore
  // belong at sentence ends, never wherever a character budget happens to run out.
  var ALOUD_FIRST_CHUNK_CHARS=170,ALOUD_CHUNK_CHARS=480,ALOUD_MIN_TAIL_CHARS=60;
  // Only split where punctuation is followed by whitespace or the end of the text,
  // so "1.5 seconds" and "app.ts" stay intact. Splitting on any period would both
  // mangle them and break the batches-rejoin-to-text contract Aloud checks.
  function splitSpeechSentences(text){
    var boundary=/[.!?]+(?:["')\\]]+)?(?=\\s+|$)/g,out=[],start=0,match;
    while((match=boundary.exec(text))!==null){
      var end=match.index+match[0].length,segment=text.slice(start,end).trim();
      if(segment)out.push(segment);
      start=end;
    }
    var tail=text.slice(start).trim();
    if(tail)out.push(tail);
    return out.length?out:[text.trim()];
  }
  function splitSpeechUnit(text){
    // The whitespace class needs a doubled backslash. This client code lives in a
    // plain string, so a single one is eaten before the browser sees it, and this
    // line read as "split on the letter s" — every beat was split on its own s
    // characters and rejoined with spaces, so narration said "Concept validation
    // i  a reu able profile". Every regex escape in this file must be doubled.
    var clean=speechClean(text);
    if(!clean)return [];
    // A sentence only gets broken apart when it alone exceeds a whole chunk.
    var units=[];
    splitSpeechSentences(clean).forEach(function(sentence){
      if(sentence.length<=ALOUD_CHUNK_CHARS){units.push(sentence);return;}
      var current='';
      sentence.split(/\\s+/).forEach(function(word){
        var combined=current?current+' '+word:word;
        if(current&&combined.length>ALOUD_CHUNK_CHARS){units.push(current);current=word;}
        else current=combined;
      });
      if(current)units.push(current);
    });
    var chunks=[],pending='';
    units.forEach(function(unit){
      // The first chunk stays small so playback can start sooner, but never at the
      // cost of cutting a sentence: an over-long opening sentence ships whole.
      var limit=chunks.length?ALOUD_CHUNK_CHARS:ALOUD_FIRST_CHUNK_CHARS;
      var combined=pending?pending+' '+unit:unit;
      // The budget must not force out a chunk too short to stand on its own. A brief
      // opening sentence ("The direct handler lands here.") followed by a long one
      // exceeded the limit immediately, so the short one shipped alone and was read
      // as an isolated utterance. Keep absorbing until it can carry a clip.
      if(pending&&combined.length>limit&&pending.length>=ALOUD_MIN_TAIL_CHARS){chunks.push(pending);pending=unit;}
      else pending=combined;
    });
    if(pending){
      // A short tail rides along with the previous chunk. Left alone it became its
      // own clip — an 8-character fragment read as a complete sentence.
      if(chunks.length&&pending.length<ALOUD_MIN_TAIL_CHARS)chunks[chunks.length-1]+=' '+pending;
      else chunks.push(pending);
    }
    return chunks;
  }
  function speechSequenceFrom(stepIndex,unitIndex,manual){
    var sequence=[],last=manual?stepIndex:total-1;
    for(var s=stepIndex;s<=last;s++){
      var panel=stepPanels[s],units=panel?stepSpeechUnits(panel):[];
      var first=s===stepIndex?Math.max(0,unitIndex||0):0;
      for(var u=first;u<units.length;u++){
        (function(stepIndex,unitIndex,unit){
          splitSpeechUnit(unit.text).forEach(function(chunk){
            sequence.push({stepIndex:stepIndex,unitIndex:unitIndex,text:chunk,group:unit.group,start:0});
          });
        })(s,u,units[u]);
      }
    }
    var offset=0;
    sequence.forEach(function(unit){unit.start=offset;offset+=unit.text.length+1;});
    return sequence;
  }
  function warmSpeechSequence(sequence,index){
    var warmed={},remaining=2;
    for(var i=Math.max(0,index+1);i<sequence.length&&remaining>0;i++){
      var stepIndex=sequence[i].stepIndex;
      if(warmed[stepIndex])continue;
      warmed[stepIndex]=true;
      var panel=stepPanels&&stepPanels[stepIndex];
      if(panel&&panel.hasAttribute('data-step-lazy')){loadStoryStep(stepIndex);remaining--;}
    }
  }
  function speakNarrationSequence(sequence,manual){
    if(!sequence.length)return false;
    var first=sequence[0],batches=sequence.map(function(unit){return unit.text;}),text=batches.join(' ');
    currentSpeechStep=first.stepIndex;currentSpeechUnit=first.unitIndex;currentSpeechManual=!!manual;
    return speak(text,{batches:batches,manual:!!manual,sequence:sequence,stepIndex:first.stepIndex,focusGroup:first.group});
  }
  function speakStepIndex(i,manual){
    var p=stepPanels[i];if(!p)return false;
    var units=stepSpeechUnits(p);if(!units.length)return false;
    voiceSequenceToken++;
    return speakStepUnit(i,units,0,manual);
  }
  function speakStepUnit(stepIndex,units,index,manual){
    if(index>=units.length)return false;
    return speakNarrationSequence(speechSequenceFrom(stepIndex,index,manual),manual);
  }
  function speakStep(i){if(!narrationPlaying())return false;return speakStepIndex(i,false);}
  function nextSpeakableStep(i){
    for(var j=i+1;j<total;j++){if(stepSpeechUnits(stepPanels[j]).length)return j;}
    return -1;
  }
  function previousSpeakableStep(i){
    for(var j=i-1;j>=1;j--){if(stepSpeechUnits(stepPanels[j]).length)return j;}
    return -1;
  }
  function advanceAfterSpeechStep(stepIndex,manual){
    if(manual)return;
    var n=nextSpeakableStep(stepIndex);if(n>=0)setActive(n);
  }
  function speechBeatTarget(stepIndex,unitIndex,delta){
    if(stepIndex<0)stepIndex=active;
    if(!stepPanels[stepIndex])return null;
    var units=stepSpeechUnits(stepPanels[stepIndex]);
    if(!units.length)return null;
    if(unitIndex<0)unitIndex=delta>0?-1:units.length;
    var nextUnit=unitIndex+delta;
    if(nextUnit>=0&&nextUnit<units.length)return {step:stepIndex,unit:nextUnit};
    if(delta>0){var n=nextSpeakableStep(stepIndex);if(n>=0)return {step:n,unit:0};}
    if(delta<0){var p=previousSpeakableStep(stepIndex);if(p>=0){var prevUnits=stepSpeechUnits(stepPanels[p]);return {step:p,unit:prevUnits.length-1};}}
    return null;
  }
  function moveSpeechBeat(delta){
    if(isTextEntryTarget(document.activeElement))return false;
    if(!(aloudIntent!=='off'||currentSpeechStep>=0))return false;
    var baseStep=currentSpeechStep>=0?currentSpeechStep:active,baseUnit=currentSpeechUnit;
    var target=speechBeatTarget(baseStep,baseUnit,delta);if(!target)return true;
    var units=stepSpeechUnits(stepPanels[target.step]);if(!units.length)return true;
    // Skipping beats while paused has to stay paused. This used to cancel the job
    // and immediately speak the neighbouring beat, so an arrow key silently
    // un-paused the story — and because speakStepUnit builds a sequence running
    // to the end, it replaced the paused job with a whole new full-story one.
    if(aloudIntent==='paused'){
      cancelSpeech(true);
      aloudResumeDirty=true;
      currentSpeechStep=target.step;currentSpeechUnit=target.unit;
      activateStep(target.step,false);
      var held=units[target.unit];if(held)setActiveBeat(target.step,held.group);
      updateReadAloudButton();
      return true;
    }
    var manual=currentSpeechManual&&!narrationPlaying();
    cancelSpeech(false);
    setAloudIntent(manual?'off':'playing');
    activateStep(target.step,false);
    updateReadAloudButton();
    voiceSequenceToken++;
    speakStepUnit(target.step,units,target.unit,manual);
    return true;
  }
  function firstSpeakableStep(){
    for(var j=Math.max(1,active);j<total;j++){if(stepSpeechUnits(stepPanels[j]).length)return j;}
    for(var k=1;k<Math.min(total,Math.max(1,active));k++){if(stepSpeechUnits(stepPanels[k]).length)return k;}
    return -1;
  }
  function readJsonOrError(r,msg){
    if(r.ok)return r.json();
    // Carry the reader's own "this was only a blip" signal onto the Error so the
    // narration loop can retry instead of tearing playback down.
    return r.json().then(function(j){
      var err=new Error((j&&j.error)||msg);
      if(j&&j.transient)err.transient=true;
      throw err;
    },function(){
      var err=new Error(msg);
      if(r.status===504)err.transient=true;
      throw err;
    });
  }
  function isAbortError(err){
    return err&&(err.name==='AbortError'||/aborted|cancelled/i.test(String(err.message||err)));
  }
  function aloudFetch(path,body,signal){
    var init={method:body==null?'GET':'POST',headers:body==null?undefined:{'Content-Type':'application/json'},signal:signal};
    if(body!=null)init.body=JSON.stringify(body);
    return fetch('/api/aloud/'+path,init).then(function(r){return readJsonOrError(r,'Aloud is unavailable.');});
  }
  // How many beats of the step under the cursor to warm ahead of a play. Matches
  // the daemon's own prepare depth; it clamps anything larger.
  var ALOUD_PREPARE_BEATS=4;
  // Long enough that a normal pause/resume always answers first, short enough
  // that a wedged one hands the control back while the reviewer is still looking
  // at it. aloudControl never rejects, so this only fires on a genuine stall.
  var ALOUD_CONTROL_TIMEOUT_MS=6000;
  function aloudPreparationIdentity(status){
    status=status||{};
    return [
      String(status.engine||''),
      String(status.voice||''),
      String(status.resolvedVoice||status.voice||''),
      String(status.rate||''),
      String(status.mode||'')
    ].join('|');
  }
  function prepareStepNarration(stepIndex){
    if(!stepPanels||stepIndex<=0||stepIndex>=stepPanels.length||aloudIntent!=='off'||aloudActive||speechLoadingLabel)return;
    var prepareRequest=++aloudPrepareRequest;
    if(aloudPrepareTimer)clearTimeout(aloudPrepareTimer);
    aloudPrepareTimer=setTimeout(function(){
      aloudPrepareTimer=0;
      var panel=stepPanels&&stepPanels[stepIndex];if(!panel)return;
      if(panel.hasAttribute('data-step-lazy')){
        loadStoryStep(stepIndex,function(ok){if(ok)prepareStepNarration(stepIndex);});
        return;
      }
      var units=stepSpeechUnits(panel),chunks=[];
      units.forEach(function(unit){splitSpeechUnit(unit.text).forEach(function(chunk){chunks.push(chunk);});});
      // Warm the whole step, not its first two beats. Two was enough to start
      // talking and not enough to keep talking: by beat three playback was waiting
      // on synthesis again. The daemon caps how deep it actually goes.
      var prepareChunks=chunks.slice(0,ALOUD_PREPARE_BEATS);
      if(!prepareChunks.length)return;
      // A text-only key reused audio prepared for the previous engine, voice,
      // speed, or mode. Ask Aloud for the settings it will actually use before
      // deciding this step is warm.
      aloudFetch('status').then(function(status){
        if(prepareRequest!==aloudPrepareRequest||aloudIntent!=='off'||aloudActive||speechLoadingLabel)return;
        if(!status||status.service!=='aloud-speech-daemon'||status.protocolVersion!==2)return;
        var preparedKey=aloudPreparationIdentity(status)+'\\n'+prepareChunks.join('\\n');
        if(preparedKey===aloudPreparedText)return;
        aloudPreparedText=preparedKey;
        return aloudFetch('prepare',{text:prepareChunks.join(' '),batches:prepareChunks,prefetch:ALOUD_PREPARE_BEATS}).catch(function(){
          if(aloudPreparedText===preparedKey)aloudPreparedText='';
        });
      }).catch(function(){
        // Preparation is opportunistic. Play owns the user-visible error path.
      });
    },120);
  }
  function aloudControl(action,silent){
    return aloudFetch('control',{action:action}).catch(function(err){if(!silent)toast(err.message||'Aloud is unavailable.','error');});
  }
  function applyAloudStatus(status){
    if(!status)return;
    // Observation, never intent. A status snapshot taken before the reviewer's
    // pause reached the daemon must not repaint the control with the state they
    // just left, so an in-flight control owns the truth until it answers.
    if(aloudControlPending)return;
    aloudActive=!!status.running;aloudPaused=!!status.paused;
    if(typeof status.rate==='number'&&isFinite(status.rate)&&status.rate>0)aloudRate=status.rate;
    var state=status.state||{},phase=String(state.status||'');
    aloudPhase=aloudPaused?'paused':(phase==='starting'||phase==='generating'||phase==='reading'?phase:(aloudActive?'starting':'idle'));
    // Aloud reports exactly which chunk it is preparing. Keep it so the control
    // can say what is happening instead of spinning silently.
    aloudStateMessage=typeof state.message==='string'?state.message:'';
    // Aloud has its own menu bar and a global shortcut, so it can be paused from
    // outside this page. Adopt that rather than insisting on an intent the
    // reviewer can plainly hear is wrong — but only while a job really exists,
    // so a story we paused and whose job we cancelled stays paused.
    if(aloudActive&&aloudIntent!=='off')setAloudIntent(aloudPaused?'paused':'playing');
  }
  function focusAloudSequenceUnit(index){
    if(index<0||index>=aloudSequence.length)return;
    aloudSequenceIndex=index;
    var unit=aloudSequence[index];
    currentSpeechStep=unit.stepIndex;currentSpeechUnit=unit.unitIndex;
    var apply=function(){
      if(aloudSequenceIndex!==index)return;
      if(active!==unit.stepIndex)activateStep(unit.stepIndex,false);
      setActiveBeat(unit.stepIndex,unit.group);
      warmSpeechSequence(aloudSequence,index);
    };
    var panel=stepPanels&&stepPanels[unit.stepIndex];
    if(panel&&panel.hasAttribute('data-step-lazy')){
      if(active!==unit.stepIndex)activateStep(unit.stepIndex,false);
      loadStoryStep(unit.stepIndex,function(ok){if(ok)apply();});
      return;
    }
    apply();
  }
  function applyAloudSequenceProgress(status){
    if(!aloudSequence.length||!status)return;
    var state=status.state||{},start=Number(state.chunkStart),index=-1;
    if(isFinite(start)){
      for(var i=0;i<aloudSequence.length;i++){if(aloudSequence[i].start===start){index=i;break;}}
    }
    if(index<0&&typeof state.current==='number'){
      index=Math.max(0,Math.min(aloudSequence.length-1,state.status==='starting'?state.current:state.current-1));
    }
    if(index>=0&&index!==aloudSequenceIndex)focusAloudSequenceUnit(index);
  }
  function finishAloudSpeech(token,opts,completed,message){
    if(token!==aloudRequestToken)return;
    if(aloudPollTimer){clearTimeout(aloudPollTimer);aloudPollTimer=0;}
    aloudActive=false;aloudPaused=false;aloudJobId='';aloudPhase='idle';speechLoadingLabel='';aloudPollFails=0;
    aloudStateMessage='';aloudStartedAt=0;aloudSlowNotice=false;
    if(opts.stepIndex!=null)clearVoiceFocus();
    aloudSequence=[];aloudSequenceIndex=-1;clearSpeechCursor();
    if(!opts.manual)setAloudIntent('off');
    var btn=$('[data-readaloud]');if(btn)btn.classList.remove('is-speaking');
    updateReadAloudButton();
    // Giving up on our side does not silence Aloud. Without this the reviewer
    // gets an error toast and a reset button while the narration keeps talking.
    // A jobId handover passes no message, so it never stops the incoming job.
    //
    // The message alone is the guard. It used to also require wasActive, which is
    // false on precisely the path that needs the stop most: a /speak that the
    // daemon accepted and started before the reply failed on our side. There the
    // browser had cleared aloudActive on the way in, so the compensating stop was
    // skipped and Aloud read the whole story to a page showing an idle button.
    if(message)aloudControl('stop',true);
    if(message)toast(message,'error');
    if(completed&&typeof opts.onDone==='function')opts.onDone();
  }
  // A cold start can run half a minute: Aloud unloads its speech model after two
  // idle minutes, so the first play after reading a while pays to reload it. Say
  // that out loud instead of leaving the reviewer with a silent spinner.
  function noticeSlowNarration(){
    if(aloudSlowNotice||!aloudStartedAt)return;
    if(aloudPhase!=='starting'&&aloudPhase!=='generating')return;
    if(Date.now()-aloudStartedAt<8000)return;
    aloudSlowNotice=true;
    toast(aloudStateMessage
      ?'Aloud is still generating audio — '+aloudStateMessage.charAt(0).toLowerCase()+aloudStateMessage.slice(1)+'.'
      :'Aloud is still generating audio. The first play after a pause can take a moment.');
  }
  // This loop runs hundreds of times per playback. Tight beat highlighting only
  // needs a fast poll while Aloud is actually reading; while it generates, a
  // slower poll tracks progress just as well with far fewer round trips. After a
  // failure, back off rather than hammering a reader that is already struggling.
  function aloudPollDelay(){
    if(aloudPollFails)return Math.min(1200,200*aloudPollFails);
    return aloudPhase==='reading'?100:500;
  }
  function pollAloudSpeech(token,opts){
    if(token!==aloudRequestToken)return;
    aloudPollTimer=setTimeout(function(){
      aloudPollTimer=0;
      aloudFetch('status').then(function(status){
        if(token!==aloudRequestToken)return;
        if(!status||status.service!=='aloud-speech-daemon'||status.protocolVersion!==2){
          finishAloudSpeech(token,opts,false,'Aloud returned an incompatible status.');return;
        }
        if(aloudJobId&&status.jobId!==aloudJobId){
          finishAloudSpeech(token,opts,false);return;
        }
        aloudPollFails=0;
        applyAloudStatus(status);applyAloudSequenceProgress(status);updateReadAloudButton();
        noticeSlowNarration();
        if(status.running){pollAloudSpeech(token,opts);return;}
        var state=status.state&&status.state.status;
        finishAloudSpeech(token,opts,state==='done',state==='error'?(status.state.message||'Aloud could not finish playback.'):'');
      }).catch(function(err){
        if(token!==aloudRequestToken)return;
        // One dropped poll is not a failed narration: Aloud keeps reading while
        // a timeout or a restarting server briefly hides it from us. Ride out a
        // short run of failures on a backoff before admitting defeat, otherwise
        // a single blip silently kills playback that is still audible.
        aloudPollFails++;
        if(aloudPollFails<=6){pollAloudSpeech(token,opts);return;}
        finishAloudSpeech(token,opts,false,err.message||'Aloud is unavailable.');
      });
    },aloudPollDelay());
  }
  function speak(text,opts){
    if(!text)return false;
    opts=opts||{};
    var token=++aloudRequestToken,btn=$('[data-readaloud]'),batches=opts.batches||[text];
    if(aloudPollTimer){clearTimeout(aloudPollTimer);aloudPollTimer=0;}
    if(aloudRequestAbort){try{aloudRequestAbort.abort();}catch(e){}}
    var ctrl=typeof AbortController!=='undefined'?new AbortController():null;
    aloudRequestAbort=ctrl;aloudActive=false;aloudPaused=false;aloudJobId='';aloudPhase='starting';speechLoadingLabel='Starting Aloud';
    aloudPollFails=0;aloudStateMessage='';aloudSlowNotice=false;aloudStartedAt=Date.now();
    aloudSequence=opts.sequence||[];aloudSequenceIndex=-1;
    if(aloudSequence.length)focusAloudSequenceUnit(0);
    else if(opts.stepIndex!=null){if(opts.focusGroup!=null)setActiveBeat(opts.stepIndex,opts.focusGroup);else startVoiceFocusSequence(opts.stepIndex,text);}
    else clearVoiceFocus();
    if(btn)btn.classList.add('is-speaking');updateReadAloudButton();
    aloudFetch('speak',{text:text,batches:batches,prefetch:3},ctrl?ctrl.signal:undefined).then(function(status){
      if(token!==aloudRequestToken)return;
      if(aloudSequence.length&&(!status.state||status.state.total!==aloudSequence.length)){
        aloudControl('stop',true);
        throw new Error('Aloud needs an update before it can prefetch DiffStory narration. Reinstall Aloud Services, then try again.');
      }
      aloudRequestAbort=null;speechLoadingLabel='';aloudJobId=status.jobId||'';applyAloudStatus(status);
      applyAloudSequenceProgress(status);updateReadAloudButton();pollAloudSpeech(token,opts);
    }).catch(function(err){
      if(token!==aloudRequestToken||isAbortError(err))return;
      aloudRequestAbort=null;setAloudIntent('off');
      finishAloudSpeech(token,opts,false,err.message||'Open Aloud and install its Services to enable narration.');
    });
    return true;
  }
  function updateReadAloudButton(){
    var btn=$('[data-readaloud]');if(!btn)return;
    var label=$('[data-readaloud-label]',btn),ico=$('.ds-readaloud-ico',btn),stop=$('[data-aloud-stop]');
    // Rendered from intent, not from the daemon snapshot. The poll used to own
    // these flags, so a /status reply taken before the click reached the daemon
    // repainted the button with the state the reviewer had just left — the
    // control said "Pause" while the audio was already stopping.
    var paused=aloudIntent==='paused',speaking=aloudIntent==='playing';
    var busy=!!speechLoadingLabel||aloudControlPending;
    var loading=!!speechLoadingLabel||(speaking&&aloudActive&&(aloudPhase==='starting'||aloudPhase==='generating'));
    var playing=aloudIntent!=='off'||!!speechLoadingLabel;
    var action=paused?'Resume':(speechLoadingLabel?'Starting':(speaking?'Pause':'Play'));
    var buttonLabel=paused?'Resume narration':(speaking?'Pause narration':(speechLoadingLabel?'Starting narration':'Play story with Aloud'));
    // While Aloud is still generating, its own progress is more useful than a
    // static label — a 30s cold start should never look like a hung button.
    if(loading&&aloudStateMessage)buttonLabel=buttonLabel+' — '+aloudStateMessage;
    btn.classList.toggle('is-active',playing);
    btn.classList.toggle('is-loading',loading||aloudControlPending);
    // An in-flight pause/resume now reads as busy instead of looking live and
    // swallowing every press through the aloudControlPending guard.
    btn.disabled=busy;
    btn.setAttribute('aria-busy',busy?'true':'false');
    btn.setAttribute('aria-pressed',speaking?'true':'false');
    btn.setAttribute('aria-label',buttonLabel);
    btn.setAttribute('title',buttonLabel);
    if(label)label.textContent=action;
    if(ico){ico.classList.toggle('is-pause',speaking&&!loading);ico.classList.toggle('is-play',!loading&&!speaking);ico.textContent=loading?'◌':'';}
    // Stop stays reachable through the start handshake, which is exactly when a
    // mis-started or wedged narration needs abandoning. It used to be hidden
    // there (aloudActive is false until /speak answers), so a start in progress
    // could not be called off from anywhere in the page.
    if(stop)stop.hidden=!(aloudIntent!=='off'||speechLoadingLabel);
    document.body.classList.toggle('ds-aloud-active',playing);
  }
  function startReadAloudFromActive(){
    var requestedStep=active,panel=stepPanels&&stepPanels[requestedStep];
    if(panel&&panel.hasAttribute('data-step-lazy')){
      // A newly selected step may still contain only its loading skeleton. It is
      // not an empty narration step, so do not fall through to some later panel
      // that happened to load first.
      loadStoryStep(requestedStep,function(ok){
        if(!ok){
          if(active===requestedStep){setAloudIntent('off');updateReadAloudButton();}
          return;
        }
        // setActive's own load callback starts narration when it is queued ahead
        // of this one. Only start here when no request is already in flight.
        if(!narrationPlaying()||active!==requestedStep||aloudActive||speechLoadingLabel)return;
        if(!speakStep(requestedStep)){setAloudIntent('off');updateReadAloudButton();}
      });
      return true;
    }
    if(speakStep(requestedStep))return true;
    var si=firstSpeakableStep();
    if(si>=0){setActive(si);return true;}
    setAloudIntent('off');updateReadAloudButton();return false;
  }
  function restartReadAloud(){
    cancelSpeech(false);
    setAloudIntent('playing');
    updateReadAloudButton();
    startReadAloudFromActive();
  }
  function toggleReadAloud(){
    if(speechLoadingLabel||aloudControlPending)return;
    // Intent decides, not the daemon: a paused story whose job we already
    // cancelled (skipping beats does that) still has to resume from this button.
    if(aloudIntent!=='off'){toggleVoicePause();return;}
    setAloudIntent('playing');
    updateReadAloudButton();
    startReadAloudFromActive();
  }
  function stopReadAloud(){
    if(!(aloudIntent!=='off'||aloudActive||speechLoadingLabel))return false;
    setAloudIntent('off');cancelSpeech();toast('Narration stopped');return true;
  }
  /**
   * Pause and resume are an intent change first and a daemon call second. The
   * old version wrote the daemon's own aloudPaused optimistically and let the
   * next status poll overwrite it with a pre-click snapshot.
   */
  function setNarrationPaused(next){
    if(aloudControlPending)return true;
    if(next&&aloudIntent!=='playing')return false;
    if(!next&&aloudIntent!=='paused')return false;
    // Read the moved flag before changing intent: setAloudIntent clears it on the
    // way to 'playing', so checking it afterwards can only ever see false.
    var previous=aloudIntent,moved=aloudResumeDirty;
    setAloudIntent(next?'paused':'playing');
    // Resuming after the reviewer moved: the daemon's job is parked on a step
    // they have walked away from, so speak from where they actually are instead
    // of resuming into the wrong place. Same when the job is already gone.
    if(!next&&(moved||!aloudActive)){
      aloudResumeDirty=false;
      cancelSpeech(true);
      setAloudIntent('playing');
      updateReadAloudButton();
      startReadAloudFromActive();
      return true;
    }
    var token=++aloudControlToken;
    aloudControlPending=true;
    if(aloudControlTimer)clearTimeout(aloudControlTimer);
    // A control request that never settles used to leave the button looking live
    // while silently dropping every press. Time out and hand control back.
    aloudControlTimer=setTimeout(function(){
      if(token!==aloudControlToken)return;
      aloudControlTimer=0;aloudControlPending=false;updateReadAloudButton();
    },ALOUD_CONTROL_TIMEOUT_MS);
    updateReadAloudButton();
    aloudControl(next?'pause':'resume',false).then(function(status){
      if(token!==aloudControlToken)return;
      if(aloudControlTimer){clearTimeout(aloudControlTimer);aloudControlTimer=0;}
      aloudControlPending=false;
      if(!status){setAloudIntent(previous);updateReadAloudButton();return;}
      applyAloudStatus(status);updateReadAloudButton();
    });
    return true;
  }
  function toggleVoicePause(){
    if(aloudIntent==='playing')return setNarrationPaused(true);
    if(aloudIntent==='paused')return setNarrationPaused(false);
    return false;
  }
  function loadFilePanel(panel){
    if(!panel||!$('[data-file-panel-lazy]',panel)||panel.getAttribute('data-panel-loading')==='1')return Promise.resolve(panel);
    var file=panel.getAttribute('data-file')||'';
    panel.setAttribute('data-panel-loading','1');panel.setAttribute('aria-busy','true');
    return fetch(reviewPageUrl('/api/diff/file-panel?file='+encodeURIComponent(file))).then(reviewLazyText).then(function(html){
      panel.innerHTML=html;panel.removeAttribute('data-panel-loading');panel.removeAttribute('aria-busy');
      mountCommentPins(panel);updateChangeNav(panel);refreshComments();applyFilesMode(panel);jumpToFirstChange(panel);return panel;
    }).catch(function(err){
      panel.removeAttribute('data-panel-loading');panel.removeAttribute('aria-busy');
      panel.innerHTML='<div class="ds-filepanel-loaderror" role="alert"><strong>'+reviewLazyMessage(err,'Could not load this file review.')+'</strong>'+reviewLazyAction(err,'data-retry-file-panel','')+'</div>';
      return panel;
    });
  }
  function selectFile(i){
    if(!filePanels.length)return;
    if(i<0)i=0;if(i>filePanels.length-1)i=filePanels.length-1;
    var previous=selectedFile;selectedFile=i;
    var update=function(){
      filePanels.forEach(function(p,idx){p.hidden=idx!==i;});
      fileItems.forEach(function(it){it.classList.toggle('is-active',Number(it.getAttribute('data-file-index'))===i);});
    };
    if(reviewPositionReady&&previous>=0&&previous!==i)runWorkspaceTransition('file',i>previous?1:-1,update);else update();
    var activePanel=filePanels[i],fileHint=$('[data-file-hint]'),filePath=activePanel&&activePanel.getAttribute('data-file');
    if(fileHint){fileHint.textContent=filePath?'Viewing '+filePath:'Showing selected file';if(filePath)fileHint.title=filePath;else fileHint.removeAttribute('title');}
    var panel=filePanels[i];
    loadFilePanel(panel).then(function(){if(filePanels[selectedFile]===panel){applyFilesMode(panel);jumpToFirstChange(panel);}});
    var detail=$('#ds-file-detail');if(detail)detail.scrollTop=0;
    saveReviewPositionSoon();
  }
  function applyFilesMode(panel){
    if(!panel)return;
    var stored=null;try{stored=localStorage.getItem('ds-files-mode');}catch(e){}
    var active=$('.ds-modetoggle button.is-active',panel);
    var want=panel.hasAttribute('data-context-file')?'diff':(stored||(compactScreen()?'diff':'split'));
    if(!want)return;
    var btn=$('.ds-modetoggle button[data-mode="'+want+'"]',panel)||active;
    if(btn)setMode(btn,{persist:false});
  }
  function selectFileByPath(file){
    for(var k=0;k<filePanels.length;k++){if(filePanels[k].getAttribute('data-file')===file){selectFile(k);return;}}
  }
  function reviewUiKey(){return 'ds-review-ui:'+(document.body.getAttribute('data-review-scope')||document.body.getAttribute('data-viewed-scope')||'');}
  function currentReviewPosition(){
    var view=currentView();
    var panel=view==='files'?filePanels[selectedFile]:stepPanels[active];
    var scroll=0;
    if(view==='files'){var detail=$('#ds-file-detail');scroll=detail?detail.scrollTop:0;}
    else if(panel){var diff=$('.ds-diffscroll',panel);scroll=diff?diff.scrollTop:panel.scrollTop;}
    return {view:view,step:active,file:filePanels[selectedFile]?filePanels[selectedFile].getAttribute('data-file'):'',scroll:Math.round(scroll||0),reviewTab:activeReviewTab()};
  }
  function saveReviewPosition(){
    if(restoringReviewPosition||!reviewPositionReady)return;
    try{localStorage.setItem(reviewUiKey(),JSON.stringify(currentReviewPosition()));}catch(e){}
  }
  function saveReviewPositionSoon(){
    if(reviewSaveTimer)clearTimeout(reviewSaveTimer);
    reviewSaveTimer=setTimeout(saveReviewPosition,90);
  }
  function storedReviewPosition(){try{return JSON.parse(localStorage.getItem(reviewUiKey())||'null');}catch(e){return null;}}
  function describeReviewPosition(state){
    if(!state)return '';
    if(state.view==='files'&&state.file)return 'Resume at '+state.file;
    if(state.view==='tour'&&Number(state.step)>0)return 'Resume at story step '+state.step;
    return '';
  }
  function revealResumeReview(){
    var state=storedReviewPosition(),btn=$('[data-resume-review]'),label=$('[data-resume-review-label]');
    var text=describeReviewPosition(state),inFiles=currentView()==='files';if(!btn)return;
    btn.hidden=!text||!inFiles;
    if(text){if(label)label.textContent=text;btn.title=text;btn.setAttribute('aria-label',text);}
    else{btn.removeAttribute('title');btn.removeAttribute('aria-label');}
  }
  function restoreReviewPosition(){
    var state=storedReviewPosition();if(!state)return;
    restoringReviewPosition=true;
    if(state.view==='review'){
      setView('review');if(state.reviewTab)setReviewTab(state.reviewTab,false);restoringReviewPosition=false;
    }else if(state.view==='files'){
      setView('files');if(state.file)selectFileByPath(state.file);
      setTimeout(function(){var d=$('#ds-file-detail');if(d)d.scrollTop=Number(state.scroll)||0;restoringReviewPosition=false;},0);
    }else{
      setView('tour');setActive(Number(state.step)||0,false);
      setTimeout(function(){var p=stepPanels[active],d=p&&$('.ds-diffscroll',p);if(d)d.scrollTop=Number(state.scroll)||0;restoringReviewPosition=false;},0);
    }
  }
`;
const PAGE_JS_TAIL = `
  function modalSnapshot(node){
    for(var i=0;i<modalBackgroundSnapshots.length;i++)if(modalBackgroundSnapshots[i].node===node)return modalBackgroundSnapshots[i];
    var snapshot={node:node,hadAriaHidden:node.hasAttribute('aria-hidden'),ariaHidden:node.getAttribute('aria-hidden'),hadInert:node.hasAttribute('inert'),inertValue:node.getAttribute('inert')};
    modalBackgroundSnapshots.push(snapshot);return snapshot;
  }
  function restoreModalNode(snapshot){
    var node=snapshot&&snapshot.node;if(!node)return;
    if(snapshot.hadAriaHidden)node.setAttribute('aria-hidden',snapshot.ariaHidden||'');else node.removeAttribute('aria-hidden');
    if(snapshot.hadInert)node.setAttribute('inert',snapshot.inertValue||'');else node.removeAttribute('inert');
  }
  function topModalFrame(){return modalStack.length?modalStack[modalStack.length-1]:null;}
  function topModalRoot(){var frame=topModalFrame();return frame&&frame.root;}
  function modalFocusables(root){
    return root?$all('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]',root).filter(function(node){return !node.hidden&&node.offsetParent!==null;}):[];
  }
  function focusModalRoot(root){
    if(!root||topModalRoot()!==root)return;var focusables=modalFocusables(root),dialog=$('[role="dialog"]',root)||root,target=focusables[0]||dialog;
    if(target&&target.focus)target.focus();
  }
  function syncModalBackground(){
    var top=topModalRoot(),bodyChildren=$all('body > *').filter(function(node){return node.tagName!=='SCRIPT'&&node.tagName!=='STYLE';});
    bodyChildren.forEach(modalSnapshot);
    if(!top){modalBackgroundSnapshots.forEach(restoreModalNode);modalBackgroundSnapshots=[];return;}
    bodyChildren.forEach(function(node){
      var snapshot=modalSnapshot(node);if(node===top){restoreModalNode(snapshot);return;}
      node.setAttribute('aria-hidden','true');node.setAttribute('inert','');
    });
  }
  function syncModalScrollLock(){document.body.classList.toggle('ds-noscroll',modalStack.length>0);}
  function activateModal(root,returnFocus){
    if(!root)return;for(var i=modalStack.length-1;i>=0;i--)if(modalStack[i].root===root)modalStack.splice(i,1);
    modalStack.push({root:root,returnFocus:returnFocus||document.activeElement});syncModalBackground();syncModalScrollLock();
  }
  function restoreModalFocus(frame){
    setTimeout(function(){
      var top=topModalRoot(),target=frame&&frame.returnFocus;
      if(top){if(target&&top.contains(target)&&document.contains(target)&&!target.hasAttribute('inert'))target.focus();else focusModalRoot(top);}
      else if(target&&document.contains(target)&&!target.hasAttribute('inert'))target.focus();
    },0);
  }
  function deactivateModal(root,restoreFocus){
    var index=-1;for(var i=modalStack.length-1;i>=0;i--)if(modalStack[i].root===root){index=i;break;}
    if(index<0)return false;var wasTop=index===modalStack.length-1,frame=modalStack[index];modalStack.splice(index,1);syncModalBackground();syncModalScrollLock();
    if(wasTop&&restoreFocus!==false)restoreModalFocus(frame);return wasTop;
  }
  function showDrawerRoot(root){
    if(!root)return;
    if(root._dsHideTimer){clearTimeout(root._dsHideTimer);root._dsHideTimer=0;}
    if(root._dsShowFrame){cancelAnimationFrame(root._dsShowFrame);root._dsShowFrame=0;}
    root._dsReturnFocus=document.activeElement;root.hidden=false;activateModal(root,root._dsReturnFocus);
    root._dsShowFrame=requestAnimationFrame(function(){root._dsShowFrame=0;if(!root.hidden)root.classList.add('is-open');});
    setTimeout(function(){focusModalRoot(root);},0);
  }
  function hideDrawerRoot(root){
    if(!root)return;
    if(root._dsShowFrame){cancelAnimationFrame(root._dsShowFrame);root._dsShowFrame=0;}
    if(root._dsHideTimer){clearTimeout(root._dsHideTimer);root._dsHideTimer=0;}
    root.classList.remove('is-open');
    deactivateModal(root,true);root._dsReturnFocus=null;
    root._dsHideTimer=setTimeout(function(){root._dsHideTimer=0;root.hidden=true;},prefersReducedMotion()?200:250);
  }
  var trustLoadPromise=null;
  function loadTrustEvidence(){
    var host=$('[data-trust-evidence]');
    if(!host||host.getAttribute('data-trust-pending')!=='1')return Promise.resolve();
    // Return the in-flight promise rather than bailing: gotoReview chains a
    // scroll on this, and the fetch replaces innerHTML — scrolling to a card
    // that is about to be swapped out lands the reviewer nowhere.
    if(trustLoadPromise)return trustLoadPromise;
    var pending=$('.ds-trust-clean',host);
    if(pending){pending.textContent='Calculating story coverage from the bounded diff…';pending.setAttribute('aria-busy','true');}
    trustLoadPromise=fetch(reviewPageUrl('/api/review/trust')).then(reviewLazyText).then(function(html){
      var parsed=new DOMParser().parseFromString(html,'text/html'),next=parsed.querySelector('[data-trust-evidence]');
      if(!next)throw new Error('Trust evidence response was incomplete.');
      host.innerHTML=next.innerHTML;
      host.setAttribute('data-trust-pending','0');
      // This response carries the same verdict the pill is waiting on. Settle the
      // pill from it rather than leaving it spinning next to its own answer.
      var verdict=next.getAttribute('data-trust-uncovered');
      if(verdict)applyCoverageVerdict(Number(verdict||0),next.getAttribute('data-trust-storyless')==='1');
      syncExclusionAcknowledgement();
    }).catch(function(err){
      host.innerHTML='<div class="ds-diffnote" role="alert">'+reviewLazyMessage(err,'Could not calculate coverage.')+(err&&err.reloadRequired?' <button type="button" class="ds-btn ds-btn-ghost" data-review-reload>Reload review</button>':'')+'</div>';
      markCoverageUnavailable();
    }).finally(function(){trustLoadPromise=null;});
    return trustLoadPromise;
  }
  // ---- coverage verdict ----
  // The page renders from a lazy file index, so at first paint it cannot know
  // whether the story explains every changed range. The pill says so honestly in
  // a neutral unknown state, and this resolves it in the background, then writes
  // the answer back into the pill AND the review chip's clean state — without
  // which the chip could never legitimately go green.
  var coverageResolved=false,coveragePromise=null;
  function applyCoverageVerdict(uncovered,storyless){
    var pill=$('.ds-trustpill');
    if(!pill||!pill.classList.contains('is-unknown'))return;
    coverageResolved=true;
    var reviewBtn=$('[data-review-status]');
    if(reviewBtn)reviewBtn.setAttribute('data-unexplained-count',String(uncovered));
    var excluded=Number(pill.getAttribute('data-trust-excluded')||0),focused=pill.getAttribute('data-trust-focused')==='1';
    pill.classList.remove('is-unknown');
    // The pill's arrow follows its verdict: a coverage gap sends the reviewer to
    // the unexplained section that holds it, not to a generic evidence anchor.
    pill.setAttribute('data-goto-review',uncovered>0&&!storyless?'unexplained':excluded?'exclusions':'evidence');
    applyCoverageFlag(uncovered>0&&!storyless?uncovered:0,excluded+$all('[data-review-section="staged"] .ds-exclusion-card').length);
    if(uncovered>0&&!storyless){
      pill.classList.remove('is-clean');
      pill.innerHTML='<span class="ds-tri">▲</span><span><b>'+uncovered+'</b> '+(uncovered===1?'change':'changes')+' not explained by the story</span><span class="ds-review-row-arrow">›</span>';
    }else{
      pill.classList.add('is-clean');
      pill.innerHTML='<span class="ds-check">✓</span><span>'+(focused?'Story covers its selected scope':'Story covers the rendered diff')+(excluded?' · <b>'+excluded+'</b> excluded '+(excluded===1?'file':'files')+' to inspect':'')+'</span><span class="ds-review-row-arrow">›</span>';
    }
    refreshCount();
  }
  // The Coverage tab's mark is decorative and its label is what a screen reader
  // reads, so both are written here, together, from the same numbers.
  function applyCoverageFlag(uncovered,outside){
    var flag=$('[data-coverage-flag]'),tab=$('[data-review-tab-select="coverage"]');
    if(!flag||!tab)return;
    var text=uncovered?'\u25b2'+uncovered:outside?'\u25b2':'';
    var label=uncovered?uncovered+' '+(uncovered===1?'change':'changes')+' not explained by the story':outside?'files to inspect outside the story':'';
    flag.textContent=text;flag.hidden=!text;
    if(label)tab.setAttribute('aria-label','Coverage, '+label);else tab.removeAttribute('aria-label');
  }
  // A check that could not run stays unknown — never silently clean.
  function markCoverageUnavailable(){
    var pill=$('.ds-trustpill');
    if(!pill||!pill.classList.contains('is-unknown'))return;
    var spin=$('.ds-tri-spin',pill);if(spin)spin.classList.remove('ds-tri-spin');
    var text=$('[data-trust-pill-text]',pill);if(text)text.textContent='Coverage unchecked · open to retry';
  }
  function resolveCoverage(){
    if(coverageResolved||coveragePromise)return;
    var pill=$('.ds-trustpill');
    if(!pill||!pill.classList.contains('is-unknown'))return;
    coveragePromise=fetch(reviewPageUrl('/api/review/coverage')).then(function(res){
      if(!res.ok)throw new Error('Coverage check failed.');
      return res.json();
    }).then(function(verdict){
      applyCoverageVerdict(Number((verdict&&verdict.uncovered)||0),!!(verdict&&verdict.storyless));
    }).catch(function(){
      markCoverageUnavailable();
    }).finally(function(){coveragePromise=null;});
  }
  // Coverage costs a full diff read on the server, so it waits for first paint
  // rather than competing with it.
  function scheduleCoverageResolve(){
    if(typeof requestIdleCallback==='function')requestIdleCallback(resolveCoverage,{timeout:2000});
    else setTimeout(resolveCoverage,400);
  }
  // ---- review page tabs ----
  // The page is tabbed, so reaching a section means selecting the tab that owns
  // it first. Sections carry their own names; the panel they sit in is the tab.
  function activeReviewTab(){var page=$('.ds-reviewpage');return page?page.getAttribute('data-review-tab')||'coverage':'';}
  function setReviewTab(tab,focusTab){
    var page=$('.ds-reviewpage');if(!page||!tab)return;
    var button=$('[data-review-tab-select="'+tab+'"]',page);if(!button)return;
    page.setAttribute('data-review-tab',tab);
    $all('[data-review-tab-select]',page).forEach(function(node){
      var on=node===button;
      node.classList.toggle('is-active',on);
      node.setAttribute('aria-selected',on?'true':'false');
      node.tabIndex=on?0:-1;
    });
    $all('[data-review-panel]',page).forEach(function(panel){panel.hidden=panel.getAttribute('data-review-panel')!==tab;});
    if(focusTab)button.focus();
    saveReviewPositionSoon();
  }
  // Switching tabs returns to the top of the page: the panel below the tab bar
  // changes completely, so a scroll offset carried over from the last one points
  // at nothing, and it would hide the pinned verdict for no reason.
  function selectReviewTab(tab,focusTab){
    if(tab===activeReviewTab()){if(focusTab){var same=$('[data-review-tab-select="'+tab+'"]');if(same)same.focus();}return;}
    setReviewTab(tab,focusTab);
    if(reviewView)reviewView.scrollTo({top:0,behavior:prefersReducedMotion()?'auto':'smooth'});
  }
  // Every affordance that used to open the trust drawer now points at a section
  // of the review page instead, so nothing that had an entrance loses one.
  function gotoReview(section,path){
    pendingReviewSection=true;
    setView('review');
    loadTrustEvidence().then(function(){
      pendingReviewSection=false;
      var dest=section?$('[data-review-section="'+section+'"]'):null;
      if(path){var card=$('[data-excluded-file="'+path+'"]');if(card)dest=card;}
      if(!dest){focusElementWithoutScroll(reviewView);return;}
      var panel=closest(dest,'[data-review-panel]');
      if(panel)setReviewTab(panel.getAttribute('data-review-panel'),false);
      // Asking for the unexplained changes is asking to read them: the section
      // stays shut on arrival, but not when the reviewer aimed at it.
      if(section==='unexplained'){var disclosure=$('[data-unexplained-disclosure]',dest);if(disclosure)disclosure.open=true;}
      // Scroll the review panel itself. The blunt DOM helper this replaces also
      // scrolls horizontal ancestors, which would shove the diff sideways.
      if(reviewView){
        var top=reviewView.scrollTop+dest.getBoundingClientRect().top-reviewView.getBoundingClientRect().top-12;
        reviewView.scrollTo({top:Math.max(0,top),behavior:prefersReducedMotion()?'auto':'smooth'});
      }
      focusElementWithoutScroll(dest.hasAttribute('tabindex')?dest:(closest(dest,'[data-review-section]')||dest));
    });
  }
  function setDriftExpanded(on){$all('[data-drift-open]').forEach(function(button){button.setAttribute('aria-expanded',on?'true':'false');});}
  function invalidateDriftRequest(){
    driftRequestToken++;
    if(driftRequestAbort){driftRequestAbort.abort();driftRequestAbort=null;}
  }
  function resetDriftSelection(){
    if(!driftDrawer)return;
    $all('[data-drift-file]',driftDrawer).forEach(function(row){row.classList.remove('is-active');row.setAttribute('aria-pressed','false');});
    var label=$('[data-drift-selected-path]',driftDrawer),preview=$('[data-drift-preview]',driftDrawer);if(label)label.textContent='';
    if(preview)preview.innerHTML='<div class="ds-diffnote">Choose a file to load its exact change since the story.</div>';
  }
  function openDriftDrawer(){if(!driftDrawer)return;invalidateDriftRequest();driftLayoutMode=compactScreen()?'unified':'split';driftDrawer.classList.remove('is-detail');resetDriftSelection();showDrawerRoot(driftDrawer);setDriftExpanded(true);}
  function closeDriftDrawer(){if(!driftDrawer)return;invalidateDriftRequest();hideDrawerRoot(driftDrawer);setDriftExpanded(false);}
  function loadDriftFile(button){
    if(!driftDrawer||!button)return;
    var file=button.getAttribute('data-drift-file')||'',labelText=button.getAttribute('data-drift-label')||file,observation=driftDrawer.getAttribute('data-drift-observation')||'',preview=$('[data-drift-preview]',driftDrawer),label=$('[data-drift-selected-path]',driftDrawer),back=$('[data-drift-back]',driftDrawer),layout=compactScreen()?'unified':'split';
    if(!file||!preview)return;
    driftLayoutMode=layout;
    invalidateDriftRequest();
    $all('[data-drift-file]',driftDrawer).forEach(function(row){var active=row===button;row.classList.toggle('is-active',active);row.setAttribute('aria-pressed',active?'true':'false');});
    if(label)label.textContent=labelText;driftDrawer.classList.add('is-detail');
    if(compactScreen()){if(back)back.focus();}else if(back&&document.activeElement===back)button.focus();
    if(button.getAttribute('data-drift-loaded')==='1'&&button._dsDriftHtml&&button._dsDriftLayout===layout){preview.innerHTML=button._dsDriftHtml;return;}
    preview.innerHTML='<div class="ds-diffnote" role="status">Loading change since story…</div>';
    var requestToken=driftRequestToken,ctrl=typeof AbortController!=='undefined'?new AbortController():null;
    driftRequestAbort=ctrl;
    fetch(reviewPageUrl('/api/story-drift/file?observation='+encodeURIComponent(observation)+'&file='+encodeURIComponent(file)+'&layout='+layout),ctrl?{signal:ctrl.signal}:undefined).then(reviewLazyText).then(function(html){
      if(requestToken!==driftRequestToken||$('.ds-drift-file.is-active',driftDrawer)!==button||button.getAttribute('data-drift-file')!==file)return;
      if(driftRequestAbort===ctrl)driftRequestAbort=null;
      button._dsDriftHtml=html;button._dsDriftLayout=layout;button.setAttribute('data-drift-loaded','1');preview.innerHTML=html;
    }).catch(function(err){
      if(requestToken!==driftRequestToken||$('.ds-drift-file.is-active',driftDrawer)!==button||(err&&err.name==='AbortError'))return;
      if(driftRequestAbort===ctrl)driftRequestAbort=null;
      preview.innerHTML='<div class="ds-diffnote" role="alert">'+reviewLazyMessage(err,'Could not load this change.')+' '+reviewLazyAction(err,'data-drift-retry','Retry')+'</div>';
    });
  }
  function showDriftList(){
    if(!driftDrawer)return;invalidateDriftRequest();var active=$('.ds-drift-file.is-active',driftDrawer);driftDrawer.classList.remove('is-detail');if(active)active.focus();
  }
  function syncDriftLayout(){
    var next=compactScreen()?'unified':'split';if(next===driftLayoutMode)return;driftLayoutMode=next;
    if(!driftDrawer||driftDrawer.hidden)return;var active=$('.ds-drift-file.is-active',driftDrawer);if(active){loadDriftFile(active);if(next==='split')active.focus();}
  }
  function fileMatchesFilter(item){
    var q=($('[data-file-search]')&&$('[data-file-search]').value||'').trim().toLowerCase();
    if(q&&(item.getAttribute('data-filter-path')||'').indexOf(q)<0&&!(
      fileSearchQuery===q&&fileSearchMatches&&fileSearchMatches[item.getAttribute('data-goto-file')]
    ))return false;
    if(activeFileFilter==='reviewed'&&!viewedFiles[item.getAttribute('data-goto-file')])return false;
    if(activeFileFilter==='unreviewed'&&viewedFiles[item.getAttribute('data-goto-file')])return false;
    if(activeFileFilter==='comments'&&item.getAttribute('data-filter-comments')!=='1')return false;
    if(activeFileFilter==='unexplained'&&item.getAttribute('data-filter-unexplained')!=='1')return false;
    if(activeFileFilter==='tests'&&item.getAttribute('data-filter-test')!=='1')return false;
    return true;
  }
  function applyFileFilters(){
    var visible=[];
    fileItems.forEach(function(item){var show=fileMatchesFilter(item);item.hidden=!show;if(show)visible.push(item);});
    $all('.ds-filetree-dir').reverse().forEach(function(dir){dir.hidden=!$all('.ds-fileitem',dir).some(function(item){return !item.hidden;});});
    $all('[data-file-filter]').forEach(function(btn){var active=btn.getAttribute('data-file-filter')===activeFileFilter;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',active?'true':'false');});
    var selected=fileItems.find(function(item){return Number(item.getAttribute('data-file-index'))===selectedFile;});
    if(visible.length&&(!selected||selected.hidden))selectFile(Number(visible[0].getAttribute('data-file-index')));
    var progress=$('[data-viewed-progress]');
    var excludedCount=progress?Number(progress.getAttribute('data-excluded-count')||0):0;
    if(progress&&!fileItems.length&&excludedCount)progress.textContent=excludedCount+' '+(excludedCount===1?'file':'files');
    else if(progress&&!visible.length)progress.textContent='No matching files';
    else syncViewed();
  }
  function searchFilesLazily(){
    var input=$('[data-file-search]'),q=(input&&input.value||'').trim().toLowerCase(),request=++fileSearchRequest;
    fileSearchQuery=q;fileSearchMatches=null;
    if(fileSearchTimer){clearTimeout(fileSearchTimer);fileSearchTimer=null;}
    applyFileFilters();
    if(q.length<2)return;
    fileSearchTimer=setTimeout(function(){
      fileSearchTimer=null;
      fetch(reviewPageUrl('/api/review/file-search?q='+encodeURIComponent(q))).then(function(response){
        if(!response.ok)throw new Error('Search unavailable');
        return response.json();
      }).then(function(result){
        if(request!==fileSearchRequest||!result||result.query!==q)return;
        var matches={};(result.files||[]).forEach(function(file){matches[file]=1;});
        fileSearchMatches=matches;applyFileFilters();
      }).catch(function(){if(request===fileSearchRequest){fileSearchMatches={};applyFileFilters();}});
    },180);
  }
  function setFileFilter(filter){
    activeFileFilter=filter||'all';applyFileFilters();
    var label=$('[data-file-filter-label]'),button=$('[data-file-filter="'+activeFileFilter+'"]');if(label)label.textContent=button?button.textContent:'All';
    var menu=$('.ds-filefilter-menu');if(menu)menu.open=false;
  }
  function syncFileCommentFlags(){
    var paths={};queuedComments().forEach(function(c){paths[c.file]=1;});
    fileItems.forEach(function(item){item.setAttribute('data-filter-comments',paths[item.getAttribute('data-goto-file')]?'1':'0');});
    applyFileFilters();
  }
  function nextUnviewedFile(){
    var visible=fileItems.filter(function(item){return !item.hidden&&!viewedFiles[item.getAttribute('data-goto-file')];});
    if(!visible.length){toast('Every visible file is marked reviewed');return;}
    var after=visible.find(function(item){return Number(item.getAttribute('data-file-index'))>selectedFile;})||visible[0];
    setView('files');selectFile(Number(after.getAttribute('data-file-index')));collapseCompactSidebar();
  }
  function challengeKey(){return 'ds-challenge:'+(document.body.getAttribute('data-review-scope')||'')+':'+(document.body.getAttribute('data-current-diff-hash')||'');}
  function loadChallengeChecks(){var saved={};try{saved=JSON.parse(localStorage.getItem(challengeKey())||'{}')||{};}catch(e){}$all('[data-challenge-check]').forEach(function(input){input.checked=!!saved[input.getAttribute('data-challenge-check')];});}
  function saveChallengeChecks(){var saved={};$all('[data-challenge-check]').forEach(function(input){if(input.checked)saved[input.getAttribute('data-challenge-check')]=1;});try{localStorage.setItem(challengeKey(),JSON.stringify(saved));}catch(e){}}
  function initialComments(){
    var node=document.getElementById('ds-initial-comments');if(!node)return [];
    try{var list=JSON.parse(node.textContent||'[]');return Array.isArray(list)?list:[];}catch(e){return [];}
  }
  var allComments=initialComments();
  var reviewFeedbackIdentityRequest=0;
  function queuedComments(){return allComments.filter(function(c){return c&&c.status==='open';});}
  function commentSide(c){return c&&c.side==='left'?'left':'right';}
  function commentById(id){return allComments.find(function(c){return c&&c.id===id;});}
  function replaceComment(c){var found=false;allComments=allComments.map(function(old){if(old.id===c.id){found=true;return c;}return old;});if(!found)allComments.push(c);}
  function refreshReviewState(done){
    var request=++reviewFeedbackIdentityRequest;
    fetch(reviewPageUrl('/api/review-state')).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(state){
      if(request!==reviewFeedbackIdentityRequest||!state)return;
      if(state.scopeKey!==(document.body.getAttribute('data-review-scope')||''))return;
      document.body.setAttribute('data-feedback-health',state.feedbackHealth&&state.feedbackHealth.status==='invalid'?'invalid':'healthy');
      var renderedHash=document.body.getAttribute('data-current-diff-hash')||'',sameDiff=state.currentDiffHash===renderedHash;
      setLiveIssue('diff',!sameDiff);refreshCount();if(done)done(state);
    }).catch(function(){if(done)done(null);});
  }
  function syncReviewFeedbackIdentity(){refreshReviewState();}
  function noteBlockingFeedbackMutation(comment){if(comment&&comment.type==='change')syncReviewFeedbackIdentity();}
  function commentRows(c,scope){
    var rows=[];$all('[data-comment-code]',scope||document).forEach(function(code){if(code.getAttribute('data-comment-file')!==c.file||String(code.getAttribute('data-comment-line'))!==String(c.line)||(code.getAttribute('data-comment-side')||'right')!==commentSide(c))return;var row=closest(code,'.ds-row,.ds-urow');if(row&&rows.indexOf(row)<0)rows.push(row);});return rows;
  }
  function commentRow(c,scope){
    var rows=commentRows(c,scope),visible=rows.find(function(row){return !closest(row,'[hidden]')&&row.getClientRects().length>0;});return visible||rows[0]||null;
  }
  function mountCommentPins(scope){
    scope=scope||document;$all('[data-comment-launcher]',scope).forEach(function(pin){if(pin.parentNode)pin.parentNode.removeChild(pin);});
    var mounted=[];queuedComments().forEach(function(c){commentRows(c,scope).forEach(function(row){if(mounted.indexOf(row)<0)mounted.push(row);});});mounted.forEach(function(row){var matches=queuedComments().filter(function(c){return commentRows(c,scope).indexOf(row)>=0;});var pin=el('button','ds-comment-pin',matches.length>1?String(matches.length):'●');pin.type='button';pin.setAttribute('data-comment-launcher','');pin.setAttribute('data-queued-comment-id',matches[0].id);pin.setAttribute('aria-label','Open '+matches.length+' queued review '+(matches.length===1?'comment':'comments'));row.appendChild(pin);});
  }
  function syncCommentPins(){mountCommentPins(document);}
  function gotoComment(id){
    var c=commentById(id);if(!c)return;
    if(c.step){setView('tour');var stepCard=$('.ds-stepcard[data-step-id="'+c.step+'"]');if(stepCard)setActive(Number(stepCard.getAttribute('data-step-index')));}else{setView('files');selectFileByPath(c.file);}
    var attempt=0;function focusWhenMounted(){var row=commentRow(c,document),pin=row&&$('[data-comment-launcher]',row);if(row&&pin&&pin.offsetParent){scrollReviewRowVertically(row);row.classList.add('ds-comment-anchor-target');pin.focus({preventScroll:true});setTimeout(function(){row.classList.remove('ds-comment-anchor-target');},2400);return;}if(++attempt<50)setTimeout(focusWhenMounted,80);}setTimeout(focusWhenMounted,80);
  }
  function gotoQueuedComment(id){
    pendingReviewSection=true;setView('review');loadTrustEvidence().then(function(){pendingReviewSection=false;setReviewTab('notes',false);var card=id?$('[data-feedback-card][data-comment-id="'+id+'"]'):null;if(!card){focusElementWithoutScroll(reviewView);return;}card.tabIndex=-1;card.classList.add('is-targeted');if(reviewView){var top=reviewView.scrollTop+card.getBoundingClientRect().top-reviewView.getBoundingClientRect().top-18;reviewView.scrollTo({top:Math.max(0,top),behavior:prefersReducedMotion()?'auto':'smooth'});}focusElementWithoutScroll(card);setTimeout(function(){card.classList.remove('is-targeted');},2400);});
  }
  function openCommands(){if(!commandRoot||!commandRoot.hidden)return;commandReturnFocus=document.activeElement;commandRoot.hidden=false;activateModal(commandRoot,commandReturnFocus);setTimeout(function(){if(topModalRoot()!==commandRoot)return;var firstCommand=$('[data-command]',commandRoot),dialog=$('[role="dialog"]',commandRoot);if(firstCommand)firstCommand.focus();else if(dialog&&dialog.focus)dialog.focus();},0);}
  function closeCommands(){if(!commandRoot||commandRoot.hidden)return;deactivateModal(commandRoot,true);commandRoot.hidden=true;commandReturnFocus=null;}
  function runCommand(id){closeCommands();if(id==='story'){setView('tour');return;}if(id==='files'){setView('files');var q=$('[data-file-search]');if(q)q.focus();return;}if(id==='review'){gotoReview('notes');return;}if(id==='next-unviewed'){nextUnviewedFile();return;}if(id==='toggle-viewed'){var panel=filePanels[selectedFile];if(panel)toggleViewed(panel.getAttribute('data-file'));return;}if(id==='read-aloud')toggleReadAloud();}
  function feedbackFlavorControls(c){
    var group=el('div','ds-queue-edit-types');group.setAttribute('role','group');group.setAttribute('aria-label','Comment type');['change','question','nit'].forEach(function(type){var b=el('button','',FLAVOR[type].label);b.type='button';b.setAttribute('data-edit-flavor',type);b.setAttribute('aria-pressed',c.type===type?'true':'false');b.onclick=function(){$all('[data-edit-flavor]',group).forEach(function(choice){choice.setAttribute('aria-pressed',choice===b?'true':'false');});};group.appendChild(b);});return group;
  }
  function buildFeedbackCardClient(c,anchor){
    var f=FLAVOR[c.type]||FLAVOR.change,card=el('article','ds-feedback-card');card.setAttribute('data-feedback-card','');card.setAttribute('data-feedback-anchor',anchor||'current');card.setAttribute('data-comment-id',c.id);card.setAttribute('data-comment-file',c.file||'');card.setAttribute('data-comment-line',String(c.line||0));card.setAttribute('data-comment-step',c.step||'');
    var head=el('div','ds-feedback-head');head.appendChild(el('span','ds-flavor-ico',f.ico));head.appendChild(el('span','ds-feedback-type',f.label));head.appendChild(el('span','ds-feedback-path',(c.file||'')+':'+(c.line||0)));head.appendChild(el('span','ds-flex'));head.appendChild(el('span','ds-anchorbadge is-'+(anchor||'current'),anchor==='changed'?'Code changed':anchor==='moved'?'Code moved':'Anchor current'));card.appendChild(head);
    if(c.selectedText){var compare=el('div','ds-feedback-compare'),side=el('div','');side.appendChild(el('span','','Commented on'));side.appendChild(el('code','ds-feedback-selection',c.selectedText));compare.appendChild(side);card.appendChild(compare);}
    card.appendChild(markdownBlock('ds-feedback-message ds-md',c.body||''));
    var editor=el('div','ds-queue-edit');editor.setAttribute('data-comment-editor','');editor.hidden=true;editor.appendChild(feedbackFlavorControls(c));var ta=el('textarea','');ta.rows=3;ta.value=c.body||'';ta.setAttribute('data-edit-body','');ta.setAttribute('aria-label','Edit review comment');editor.appendChild(ta);var editActions=el('div','ds-queue-edit-actions'),cancel=el('button','ds-feedback-action','Cancel'),save=el('button','ds-btn ds-btn-solid','Save');cancel.type='button';cancel.setAttribute('data-edit-cancel','');save.type='button';save.setAttribute('data-edit-save','');editActions.appendChild(cancel);editActions.appendChild(save);editor.appendChild(editActions);card.appendChild(editor);
    var actions=el('div','ds-feedback-actions'),go=el('button','ds-feedback-action','Go to code'),edit=el('button','ds-feedback-action','Edit'),remove=el('button','ds-feedback-action ds-danger','Remove');go.type='button';edit.type='button';remove.type='button';go.setAttribute('data-goto-comment',c.id);edit.setAttribute('data-edit-comment',c.id);remove.setAttribute('data-remove-comment',c.id);actions.appendChild(go);actions.appendChild(edit);actions.appendChild(remove);card.appendChild(actions);return card;
  }
  function syncFeedbackCards(){
    if(!reviewView)return;var list=$('[data-feedback-view="feedback"]',reviewView);if(!list)return;var anchors={};$all('[data-feedback-card]',list).forEach(function(card){anchors[card.getAttribute('data-comment-id')]=card.getAttribute('data-feedback-anchor')||'current';});list.textContent='';var queued=queuedComments().sort(function(a,b){return String(a.file).localeCompare(String(b.file))||Number(a.line)-Number(b.line)||String(a.createdAt).localeCompare(String(b.createdAt));});if(!queued.length){list.appendChild(el('div','ds-drawer-empty','No queued comments. Select code in the diff and press C.'));return;}var groups={};queued.forEach(function(c){(groups[c.file]||(groups[c.file]=[])).push(c);});Object.keys(groups).sort().forEach(function(file){var group=el('section','ds-feedback-group');group.setAttribute('data-feedback-group',file);var head=el('div','ds-feedback-group-head');head.appendChild(el('code','',file));head.appendChild(el('span','',groups[file].length+' '+(groups[file].length===1?'comment':'comments')));group.appendChild(head);groups[file].forEach(function(c){group.appendChild(buildFeedbackCardClient(c,anchors[c.id]||'current'));});list.appendChild(group);});
  }
  function syncComposerRadioGroup(group,selected){$all('[role="radio"]',group).forEach(function(choice){var active=choice===selected;choice.classList.toggle('is-active',active);choice.setAttribute('aria-checked',active?'true':'false');choice.tabIndex=active?0:-1;});}
  function moveComposerRadio(group,selector,e){if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'&&e.key!=='ArrowUp'&&e.key!=='ArrowDown'&&e.key!=='Home'&&e.key!=='End')return;var choices=$all(selector,group);if(!choices.length)return;var at=choices.indexOf(document.activeElement);if(at<0)at=choices.findIndex(function(choice){return choice.getAttribute('aria-checked')==='true';});if(at<0)at=0;var next;if(e.key==='Home')next=choices[0];else if(e.key==='End')next=choices[choices.length-1];else next=choices[(at+(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1)+choices.length)%choices.length];if(next){e.preventDefault();next.focus();next.click();}}
  function buildComposer(row,flavor,ctx){
    ctx=ctx||{};var file=ctx.file||row.getAttribute('data-file'),line=ctx.line||row.getAttribute('data-line'),step=ctx.step||row.getAttribute('data-step'),side=ctx.side||row.getAttribute('data-side')||'right',selectedText=ctx.selectedText||'',state={flavor:flavor||'change'};var box=el('section','ds-composer');box.setAttribute('data-comment-side',side);box.setAttribute('role','region');box.setAttribute('aria-label','New review comment on '+file+', line '+line);box.tabIndex=-1;
    var head=el('div','ds-composer-head');head.appendChild(el('strong','','New comment'));head.appendChild(el('span','ds-composer-anchor',file+':'+line));var close=el('button','ds-composer-close','×');close.type='button';close.setAttribute('aria-label','Cancel comment');close.onclick=function(){removeComposer(box,true);};head.appendChild(close);box.appendChild(head);
    var main=el('div','ds-composer-main'),tabs=el('div','ds-composer-tabs');tabs.setAttribute('role','radiogroup');tabs.setAttribute('aria-label','Comment type');tabs.setAttribute('aria-orientation','horizontal');['change','question','nit'].forEach(function(v){var f=FLAVOR[v],b=el('button','ds-composer-tab'+(v===state.flavor?' is-active':''));b.type='button';b.setAttribute('data-flavor',v);b.setAttribute('role','radio');b.setAttribute('aria-checked',v===state.flavor?'true':'false');b.tabIndex=v===state.flavor?0:-1;b.appendChild(composerFlavorIcon(v));b.appendChild(document.createTextNode(f.label));b.onclick=function(){state.flavor=v;syncComposerRadioGroup(tabs,b);};tabs.appendChild(b);});tabs.addEventListener('keydown',function(e){moveComposerRadio(tabs,'.ds-composer-tab',e);});var ta=el('textarea','ds-composer-ta');ta.placeholder='Write a question, requested fix, or note…';ta.rows=3;ta.setAttribute('aria-label','Review comment');ta.setAttribute('aria-keyshortcuts','Meta+Enter Control+Enter Meta+Shift+Enter Control+Shift+Enter');main.appendChild(tabs);main.appendChild(ta);box.appendChild(main);
    var foot=el('div','ds-composer-foot'),bar=el('div','ds-composer-actions'),add=el('button','ds-ghost ds-composer-add','Add to queue'),copy=el('button','ds-btn ds-btn-solid ds-composer-copy','Copy');
    function draft(){var body=ta.value.trim();return body?{file:file,line:Number(line),side:side,step:step,type:state.flavor,body:body,selectedText:selectedText,selection:ctx.selection,status:'open'}:null;}
    function queue(){var payload=draft();if(!payload){ta.focus();return;}add.disabled=true;copy.disabled=true;fetch(reviewPageUrl(API),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){return r.json().catch(function(){return {};}).then(function(data){if(!r.ok)throw new Error(data&&data.error||'Could not save comment');return data;});}).then(function(c){replaceComment(c);noteBlockingFeedbackMutation(c);removeComposer(box,false);syncCommentPins();syncFeedbackCards();syncFileCommentFlags();refreshCount();toast('Added to the review queue.');}).catch(function(err){add.disabled=false;copy.disabled=false;toast(err&&err.message?err.message:'Could not save your comment.','error');ta.focus();});}
    function copyDraft(){var payload=draft();if(!payload){ta.focus();return;}writeClipboard(commentsToText([payload]),function(){removeComposer(box,false);toast('Comment copied.');});}
    add.type='button';copy.type='button';add.onclick=queue;copy.onclick=copyDraft;bar.appendChild(add);bar.appendChild(copy);foot.appendChild(bar);box.appendChild(foot);ta.addEventListener('keydown',function(e){if(e.key!=='Enter'||(!e.metaKey&&!e.ctrlKey)||e.isComposing)return;e.preventDefault();if(e.shiftKey)queue();else copyDraft();});return box;
  }
  function removeComposer(box,restoreFocus){var b=box||$('.ds-composer'),back=composerReturnFocus,anchor=b&&b._dsAnchorRow;if(anchor&&anchor.classList)anchor.classList.remove('ds-comment-draft-anchor');if(b&&b.parentNode)b.parentNode.removeChild(b);composerReturnFocus=null;if(restoreFocus!==false&&back&&document.contains(back)&&back.focus)back.focus();}
  function revealComposer(box){var scroller=closest(box,'.ds-diffscroll')||closest(box,'.ds-filedetail');if(!scroller)return;requestAnimationFrame(function(){if(!document.documentElement.contains(box))return;var sr=scroller.getBoundingClientRect(),br=box.getBoundingClientRect(),pad=10,card=closest(box,'.ds-diff'),sticky=card?$all('.ds-difftoolbar,.ds-diffhead',card):[],stickyHeight=sticky.reduce(function(total,node){var nr=node.getBoundingClientRect(),style=getComputedStyle(node);return total+(style.position==='sticky'&&nr.height&&nr.bottom>sr.top&&nr.top<sr.bottom?nr.height:0);},0),topEdge=sr.top+stickyHeight+pad,bottomEdge=sr.bottom-pad,available=bottomEdge-topEdge,delta=0;if(br.height>available||br.top<topEdge)delta=br.top-topEdge;else if(br.bottom>bottomEdge)delta=br.bottom-bottomEdge;if(!delta)return;var top=Math.max(0,scroller.scrollTop+delta);try{scroller.scrollTo({top:top,behavior:'auto'});}catch(e){scroller.scrollTop=top;}});}
  function openComposer(row,flavor,ctx){removeComposer(null,false);if(!(ctx&&ctx.line)&&!row.getAttribute('data-line'))return;if(!row.parentNode)return;composerReturnFocus=document.activeElement;var box=buildComposer(row,flavor,ctx);box._dsAnchorRow=row;row.classList.add('ds-comment-draft-anchor');row.parentNode.insertBefore(box,row.nextSibling);var ta=$('.ds-composer-ta',box);if(ta){try{ta.focus({preventScroll:true});}catch(e){ta.focus();}}revealComposer(box);}
  function openQueuedCommentEditor(card){if(!card)return;var editor=$('[data-comment-editor]',card),message=$('.ds-feedback-message',card);if(!editor)return;editor.hidden=false;card.classList.add('is-editing');if(message)message.hidden=true;var ta=$('[data-edit-body]',editor);if(ta)ta.focus();}
  function closeQueuedCommentEditor(card){if(!card)return;var editor=$('[data-comment-editor]',card),message=$('.ds-feedback-message',card),c=commentById(card.getAttribute('data-comment-id'));if(editor)editor.hidden=true;if(message)message.hidden=false;card.classList.remove('is-editing');if(c){var ta=$('[data-edit-body]',card);if(ta)ta.value=c.body||'';$all('[data-edit-flavor]',card).forEach(function(choice){choice.setAttribute('aria-pressed',choice.getAttribute('data-edit-flavor')===c.type?'true':'false');});}}
  function saveQueuedComment(card){if(!card)return;var id=card.getAttribute('data-comment-id'),ta=$('[data-edit-body]',card),selected=$('[data-edit-flavor][aria-pressed="true"]',card),body=ta&&ta.value.trim(),type=selected&&selected.getAttribute('data-edit-flavor');if(!body){if(ta)ta.focus();return;}var save=$('[data-edit-save]',card);if(save)save.disabled=true;fetch(reviewPageUrl(API+'/'+encodeURIComponent(id)),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,body:body})}).then(function(r){return r.json().catch(function(){return {};}).then(function(data){if(!r.ok)throw new Error(data&&data.error||'Could not update comment');return data;});}).then(function(c){replaceComment(c);noteBlockingFeedbackMutation(c);syncFeedbackCards();syncCommentPins();refreshCount();toast('Queued comment updated.');}).catch(function(err){if(save)save.disabled=false;toast(err&&err.message?err.message:'Could not update the comment.','error');});}
  function removeQueuedComment(id){var removed=commentById(id);if(!removed)return;if(!window.confirm('Remove this queued comment?'))return;fetch(reviewPageUrl(API+'/'+encodeURIComponent(id)),{method:'DELETE'}).then(function(r){if(!r.ok)throw new Error('Remove failed');allComments=allComments.filter(function(c){return c.id!==id;});noteBlockingFeedbackMutation(removed);syncFeedbackCards();syncCommentPins();syncFileCommentFlags();refreshCount();toast('Queued comment removed.');}).catch(function(){toast('Could not remove the queued comment.','error');});}
  function setBusy(b){agentBusy=b;}
  function refreshComments(done){fetch(reviewPageUrl(API)).then(function(r){if(!r.ok){var err=new Error('HTTP '+r.status);err.status=r.status;throw err;}return r.json();}).then(function(list){if(Array.isArray(list))allComments=list;syncCommentPins();syncFeedbackCards();syncFileCommentFlags();refreshCount();syncReviewFeedbackIdentity();if(done)done(list);}).catch(function(err){if(err&&err.status===409){setLiveIssue('disconnected',true);if(done)done(null);return;}toast('Could not refresh review comments. Existing comments remain visible.','error');if(done)done(null);});}
  var acAbort=null;
  function acRoot(){return document.querySelector('.ds-pp');}
  function availableStoryAgents(agents){var raw=(agents||[]).filter(function(a){return a==='claude'||a==='codex';});return ['codex','claude'].filter(function(a){return raw.indexOf(a)>=0;});}
  function restoreAgentPanel(){var node=acRoot(),home=document.getElementById('ds-agentpanel');if(!node)return;node.hidden=true;node.setAttribute('data-variant','floating');if(home&&node.parentNode!==home)home.appendChild(node);}
  function repairStory(action,target){
    if(agentBusy){toast('The agent is already working — wait for it to finish.');return;}
    fetch('/api/agents').then(function(r){return r.json();}).then(function(d){
      var agents=availableStoryAgents(d.agents||[]);if(!agents.length){toast('No Claude or Codex CLI found on PATH.','error');return;}
      var root=acRoot();if(!root)return;
      setBusy(true);agentBusy=true;
      root.setAttribute('data-variant','floating');root.hidden=false;
      var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;acAbort=ctrl;
      var panel=new ProgressPanel(root,{
        onStop:function(){if(acAbort)acAbort.abort();},
        onClose:function(){restoreAgentPanel();},
        onBlocked:function(){setBusy(false);agentBusy=false;acAbort=null;},
        onDone:function(status){setBusy(false);agentBusy=false;acAbort=null;if(status!=='complete')return;var btn=el('button','ds-pp-reload','Reload story');btn.setAttribute('data-reload-diff','');panel.showFoot(btn);}
      });
      var payload={action:action,agent:agents[0]};
      if(target&&target.file)payload.file=target.file;if(target&&target.line)payload.line=target.line;if(target&&target.stepId)payload.stepId=target.stepId;
      panel.start();runProgress(panel,'/api/story/repair',payload,ctrl).then(function(){if(agentBusy){setBusy(false);agentBusy=false;acAbort=null;}});
    }).catch(function(){toast('Could not start story repair.','error');});
  }
  function storyGenEls(){
    return {
      agentSel:$('#storyAgentSel'),
      agentChoices:$('#storyAgentChoices'),
      agentField:$('.ds-field-agent'),
      agentState:$('[data-story-agent-state]'),
      modelSel:$('#storyModelSel'),
      modelChoices:$('#storyModelChoices'),
      qualityField:$('[data-story-quality-field]'),
      modeSel:$('#storyMode'),
      note:$('#storyReviewerNote'),
      scope:$('[data-story-scope]'),
      scopeError:$('#storyScopeError'),
      fileSearch:$('[data-story-file-search]'),
      ctaLabel:$('[data-storygen-cta-label]'),
      ctaSub:$('[data-storygen-cta-sub]'),
      warn:$('#storySkillWarn'),
      warnText:$('#storySkillWarnText'),
      updateBtn:$('#storySkillUpdateBtn')
    };
  }
  var storyIntroSaved=null,storyAgentReady=false;
  function storyIntroEls(){
    var wrap=document.querySelector('.ds-step.is-intro .ds-introwrap');
    if(!wrap)return null;
    return {
      wrap:wrap,
      title:$('.ds-intro-title',wrap),
      lede:$('.ds-intro-lede',wrap),
      eyebrow:$('.ds-intro-eyebrow span',wrap),
      facts:$('.ds-intro-facts',wrap),
      card:$('.ds-storygen-card',wrap)
    };
  }
  function mountPanelInStage(e){
    var node=acRoot(); if(!node)return null;
    node.setAttribute('data-variant','stage');
    var mount=document.getElementById('ds-storystage');
    if(!mount){
      mount=document.createElement('div'); mount.id='ds-storystage';
      e.wrap.insertBefore(mount,e.card||null);
    }
    mount.appendChild(node);
    return node;
  }
  function setStoryGenerating(state){
    var e=storyIntroEls(); if(!e)return;
    var on=!!state;
    if(on){
      if(!storyIntroSaved)storyIntroSaved={
        title:e.title?e.title.textContent:'',
        lede:e.lede?e.lede.textContent:'',
        eyebrow:e.eyebrow?e.eyebrow.textContent:''
      };
      var failed=state==='failed';
      if(e.title)e.title.textContent=failed?"The story wasn't created":'Writing the story of this change';
      if(e.eyebrow)e.eyebrow.textContent=failed?'Story not created':'Story in progress';
      if(e.lede)e.lede.textContent=failed
        ? 'No reviewable story is available yet. Try again, or change the story settings.'
        : 'Keep reading the diff under All files — the story will land here when it is ready.';
      if(e.facts)e.facts.hidden=true;
      if(e.card)e.card.hidden=true;
    }else{
      if(storyIntroSaved){
        if(e.title)e.title.textContent=storyIntroSaved.title;
        if(e.lede)e.lede.textContent=storyIntroSaved.lede;
        if(e.eyebrow)e.eyebrow.textContent=storyIntroSaved.eyebrow;
      }
      if(e.facts)e.facts.hidden=false;
      if(e.card)e.card.hidden=false;
    }
  }
  function setStoryChoice(id,value){
    var input=$('#'+id);if(!input)return;
    input.value=value||'';
    $all('[data-story-choice="'+id+'"]').forEach(function(b){
      var on=b.getAttribute('data-value')===input.value;
      b.classList.toggle('is-active',on);
      b.setAttribute('role','radio');
      b.setAttribute('aria-checked',on?'true':'false');
      b.setAttribute('tabindex',on?'0':'-1');
    });
    if(id==='storyMode')updateStoryGenerationSummary();
  }
  function storyFileChecks(){return $all('input[data-story-file]');}
  function storySelectedFiles(){
    return storyFileChecks().filter(function(c){return c.checked;}).map(function(c){return c.value;});
  }
  var STORY_DEPTH_UI={
    brief:{label:'Generate compact story'},
    guided:{label:'Generate guided review'},
    detailed:{label:'Generate deep review'}
  };
  function updateStoryGenerationSummary(){
    var e=storyGenEls(),mode=e.modeSel&&e.modeSel.value?e.modeSel.value:'guided';
    var ui=STORY_DEPTH_UI[mode]||STORY_DEPTH_UI.guided,n=storySelectedFiles().length;
    if(e.ctaLabel)e.ctaLabel.textContent=ui.label;
    if(e.ctaSub)e.ctaSub.textContent=storyAgentReady
      ? n+' selected '+(n===1?'file':'files')+' · gaps are flagged as Unexplained'
      : 'Waiting for an available local writer';
  }
  function storyPathIsTest(path){
    return /(^|\\/)(__tests__|test|tests|spec)(\\/|$)|(^|[._-])(test|spec)\\.[^/]+$/i.test(path);
  }
  function storyPathIsConfig(path){
    return /(^|\\/)(package(-lock)?\\.json|tsconfig\\.json|vite\\.config\\.|webpack\\.config\\.|rollup\\.config\\.|hardhat\\.config\\.|foundry\\.toml|\\.github\\/)|(^|\\/)(config|configs)(\\/|$)|\\.(config|rc)\\.[^/]+$/i.test(path);
  }
  function storyPathIsDoc(path){return /\\.(md|mdx|txt|rst)$/i.test(path);}
  function storyFileExt(path){
    var base=path.slice(path.lastIndexOf('/')+1),i=base.lastIndexOf('.');
    return i>0?base.slice(i):'';
  }
  function updateStoryScopeCount(){
    var n=storySelectedFiles().length,count=$('#storyScopeCount'),e=storyGenEls(),generate=$('[data-generate-story]');
    if(count)count.textContent=String(n);
    if(e.scopeError)e.scopeError.hidden=!!n;
    if(generate)generate.disabled=!n||agentBusy||!storyAgentReady;
    updateStoryGenerationSummary();
  }
  function filterStoryFiles(){
    var e=storyGenEls(),q=(e.fileSearch&&e.fileSearch.value||'').trim().toLowerCase();
    $all('.ds-storyfile').forEach(function(row){
      var input=$('input[data-story-file]',row),path=input&&input.value?input.value.toLowerCase():'';
      row.hidden=!!q&&path.indexOf(q)<0;
    });
  }
  function setStoryFileChecks(predicate){
    storyFileChecks().forEach(function(c){c.checked=!!predicate(c.value);});
    updateStoryScopeCount();
  }
  function renderStoryChoices(holder,id,items,value){
    if(!holder)return;
    holder.textContent='';
    items.forEach(function(item){
      var b=el('button','ds-choice');
      b.type='button';
      b.setAttribute('data-story-choice',id);
      b.setAttribute('data-value',item[1]);
      b.setAttribute('role','radio');
      b.setAttribute('aria-checked','false');
      b.setAttribute('tabindex','-1');
      if(item[2])b.setAttribute('title',item[2]);
      b.textContent=item[0];
      holder.appendChild(b);
    });
    var chosen=items.some(function(item){return item[1]===value;})?value:(items[0]?items[0][1]:'');
    setStoryChoice(id,chosen);
  }
  function fillStoryModels(){
    var e=storyGenEls();
    if(!e.modelSel)return;
    var ms=STORY_MODELS[e.agentSel?e.agentSel.value:'']||[['Best quality','']];
    renderStoryChoices(e.modelChoices,'storyModelSel',ms,e.modelSel.value);
  }
  function loadCodexStoryModels(){
    return fetch(CODEX_MODEL_API).then(function(r){
      return r.json().then(function(body){if(!r.ok)throw new Error(body.error||'Could not load Codex models.');return body;});
    }).then(function(body){
      var models=(body.models||[]).map(function(item){
        return item&&item.label&&item.model?[String(item.label),String(item.model),String(item.description||'')]:null;
      }).filter(Boolean);
      if(!models.length)return;
      STORY_MODELS.codex=models;
      var e=storyGenEls();if(e.agentSel&&e.agentSel.value==='codex')fillStoryModels();
    }).catch(function(){
      // The same-runtime default above remains valid when catalog discovery is unavailable.
    });
  }
  function setStoryAgents(agents,errorMessage){
    var e=storyGenEls();
    var list=(agents||[]).filter(function(a){return a==='claude'||a==='codex';});
    if(!list.length){
      storyAgentReady=false;
      if(e.agentSel)e.agentSel.value='';
      if(e.agentChoices)e.agentChoices.textContent='';
      if(e.modelSel)e.modelSel.value='';
      if(e.modelChoices)e.modelChoices.textContent='';
      if(e.agentField)e.agentField.classList.add('is-wide');
      if(e.qualityField)e.qualityField.hidden=true;
      if(e.agentState){e.agentState.hidden=false;e.agentState.classList.add('is-error');e.agentState.textContent=errorMessage||'No local writer found. Install Codex or Claude, then reload this page.';}
      updateStoryScopeCount();
      return;
    }
    storyAgentReady=true;
    if(e.agentField)e.agentField.classList.remove('is-wide');
    if(e.qualityField)e.qualityField.hidden=false;
    if(e.agentState){e.agentState.hidden=true;e.agentState.classList.remove('is-error');e.agentState.textContent='';}
    var current=list.indexOf('codex')>=0?'codex':list[0];
    renderStoryChoices(e.agentChoices,'storyAgentSel',list.map(function(a){return [a.charAt(0).toUpperCase()+a.slice(1),a];}),current);
    fillStoryModels();
    updateStoryScopeCount();
  }
  var storySkills=null,storySkillHide=null;
  function showStorySkillState(sk){
    if(sk)storySkills=sk;
    sk=storySkills;
    var e=storyGenEls();
    if(!e.warn||!e.warnText||!e.updateBtn||!sk)return;
    if(storySkillHide){clearTimeout(storySkillHide);storySkillHide=null;}
    var agent=e.agentSel&&e.agentSel.value?e.agentSel.value:'';
    var st=(agent&&sk.agents&&sk.agents[agent])?sk.agents[agent]:sk;
    var label=agent?agent.charAt(0).toUpperCase()+agent.slice(1):'the agent';
    var where=st.dir||'~/.agents, ~/.claude, or ~/.codex';
    if(sk.legacyInstalled){
      e.warn.hidden=false;e.updateBtn.hidden=false;e.updateBtn.disabled=false;e.updateBtn.textContent='Update skills';
      e.warnText.textContent='review-tour was renamed to diffstory-storyteller. Update skills to remove the retired copy before generating.';
      return;
    }
    if(st.current){
      e.warn.hidden=false;e.updateBtn.hidden=true;
      e.warnText.textContent=agent?'Story-generation skill is up to date for '+label+'.':'Story-generation skills are up to date.';
      storySkillHide=setTimeout(function(){e.warn.hidden=true;},1400);return;
    }
    e.warn.hidden=false;e.updateBtn.hidden=false;e.updateBtn.disabled=false;e.updateBtn.textContent='Update skills';
    e.warnText.textContent=st.installed
      ? 'Story-generation skill in '+where+' does not match this app. Update it before generating so '+label+' sees the current story rules.'
      : 'Story-generation skill was not found in '+where+'. Install it before generating so '+label+' can create the story reliably.';
  }
  function wireStorySkillUpdate(){
    var e=storyGenEls();if(!e.updateBtn)return;
    e.updateBtn.onclick=function(){
      e.updateBtn.disabled=true;e.updateBtn.textContent='Updating…';if(e.warnText)e.warnText.textContent='Installing bundled diffStory skills locally…';
      fetch('/api/skills/update',{method:'POST'}).then(function(r){return r.json();}).then(function(d){
        if(d&&d.skills)showStorySkillState(d.skills);else throw new Error('bad response');
      }).catch(function(){
        e.updateBtn.disabled=false;e.updateBtn.textContent='Try again';
        if(e.warnText)e.warnText.textContent='Could not update skills. Run scripts/install-skills.sh from this repo, or re-run the diffStory installer.';
      });
    };
  }
  function initStoryGenerator(){
    var e=storyGenEls();
    if(!e.agentSel)return;
    setStoryChoice('storyMode','guided');
    updateStoryScopeCount();
    storyFileChecks().forEach(function(c){c.addEventListener('change',updateStoryScopeCount);});
    if(e.fileSearch)e.fileSearch.addEventListener('input',filterStoryFiles);
    wireStorySkillUpdate();
    fetch('/api/agents').then(function(r){return r.json();}).then(function(d){
      setStoryAgents(d.agents||[]);
      if(storyAgentReady)showStorySkillState(d.skills);
      if((d.agents||[]).indexOf('codex')>=0)loadCodexStoryModels();
    }).catch(function(){setStoryAgents([],'Could not check local writers. Reload the page to try again.');});
  }
  function generateStory(btn){
    if(!storyAgentReady){var noWriter=storyGenEls();if(noWriter.agentState){noWriter.agentState.hidden=false;noWriter.agentState.focus();}return;}
    if(agentBusy){toast('The agent is already working — wait for it to finish.');return;}
    var selected=storySelectedFiles();
    if(!selected.length){
      var emptyState=storyGenEls();
      if(emptyState.scope)emptyState.scope.open=true;
      if(emptyState.scopeError){emptyState.scopeError.hidden=false;emptyState.scopeError.focus();}
      return;
    }
    restoreAgentPanel();
    var intro=storyIntroEls();
    var root=intro?mountPanelInStage(intro):acRoot();
    if(!root)return;
    if(intro)setStoryGenerating(true);
    var reviewUrl=btn.getAttribute('data-review-url')||'';
    var e=storyGenEls();
    var model=e.modelSel?e.modelSel.value:'';
    var payload={
      base:btn.getAttribute('data-base')||undefined,
      head:btn.getAttribute('data-head')||undefined,
      agent:e.agentSel&&e.agentSel.value?e.agentSel.value:undefined,
      model:model||undefined,
      mode:e.modeSel&&e.modeSel.value?e.modeSel.value:undefined,
      includedFiles:storySelectedFiles(),
      reviewerNote:e.note&&e.note.value?e.note.value.trim():undefined
    };
    function restoreForm(){
      setStoryGenerating(false); restoreAgentPanel();
      btn.disabled=false; setBusy(false); acAbort=null;
    }
    var panel;
    function startRun(){
      var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
      if(intro)setStoryGenerating(true);
      acAbort=ctrl;btn.disabled=true;setBusy(true);panel.start();
      runProgress(panel,'/api/generate',payload,ctrl);
    }
    function showRecovery(err){
      if(intro)setStoryGenerating('failed');
      if(panel.els.close)panel.els.close.hidden=true;
      var modelFailure=!!(err&&/Codex needs an update for/.test(err.label||''));
      var actions=el('div','ds-pp-actions'),primary,secondary;
      if(modelFailure){
        primary=el('button','ds-pp-reload','Change model');
        primary.onclick=function(){restoreForm();loadCodexStoryModels().then(function(){
          var choice=$('[data-story-choice="storyModelSel"][aria-checked="true"]');if(choice)choice.focus();
        });};
        secondary=el('button','ds-pp-secondary','Retry after updating');
        secondary.onclick=function(){loadCodexStoryModels().then(function(){
          var current=storyGenEls();payload.model=current.modelSel&&current.modelSel.value?current.modelSel.value:undefined;startRun();
        });};
      }else{
        primary=el('button','ds-pp-reload','Try again');primary.onclick=startRun;
        secondary=el('button','ds-pp-secondary','Review settings');secondary.onclick=function(){
          restoreForm();var choice=$('[data-story-choice="storyMode"][aria-checked="true"]');if(choice)choice.focus();
        };
      }
      actions.appendChild(primary);actions.appendChild(secondary);panel.showFoot(actions);
      var active=document.activeElement;
      if(root.offsetParent&&(!active||active===document.body||active===btn))primary.focus();
    }
    panel=new ProgressPanel(root,{
      onStop:function(){ if(acAbort)acAbort.abort(); },
      onClose:function(){ restoreForm(); },
      onBlocked:function(err){ setBusy(false); acAbort=null; btn.disabled=false;showRecovery(err); },
      onDone:function(status,result){
        setBusy(false); acAbort=null; btn.disabled=false;
        if(status==='complete'&&result&&result.storyWritten&&reviewUrl){location.href=reviewUrl;return;}
        if(status==='stopped'){restoreForm();return;}
        showRecovery(panel.error());
      }
    });
    startRun();
  }
  function refreshCount(){
    var queued=queuedComments(),openN=queued.length;
    var blockingN=queued.filter(function(c){return c.type==='change';}).length;
    var b=$('#ds-open-count b');if(b)b.textContent=openN;
    var count=$('#ds-open-count');if(count)count.hidden=openN===0;
    var reviewBtn=$('[data-review-status]'),unexplained=reviewBtn?Number(reviewBtn.getAttribute('data-unexplained-count')||0):0,excluded=reviewBtn?Number(reviewBtn.getAttribute('data-excluded-count')||0):0,indexDivergent=reviewBtn?Number(reviewBtn.getAttribute('data-index-divergence-count')||0):0;
    var storyFreshness=reviewBtn?reviewBtn.getAttribute('data-story-freshness')||'unverified':'current';
    var feedbackHealthy=document.body.getAttribute('data-feedback-health')!=='invalid';
    if(reviewBtn)reviewBtn.setAttribute('aria-label','Review, '+openN+' queued '+(openN===1?'comment':'comments')+(!feedbackHealthy?', feedback file needs repair':indexDivergent?', '+indexDivergent+' staged and working-tree '+(indexDivergent===1?'version differs':'versions differ'):storyFreshness!=='current'?', story requires regeneration':unexplained?', '+unexplained+' '+(unexplained===1?'change':'changes')+' not explained by the story':excluded?', '+excluded+' excluded '+(excluded===1?'file':'files')+' to inspect':''));
    var summary=$('.ds-review-summary-label b');if(summary){summary.textContent=openN;if(summary.nextSibling)summary.nextSibling.nodeValue=' queued '+(openN===1?'comment':'comments');}
    var notesTabCount=$('[data-review-open-notes]');if(notesTabCount){notesTabCount.textContent=openN;notesTabCount.hidden=openN===0;}
    var pill=$('.ds-trustpill'),fresh=document.body.getAttribute('data-story-freshness')||'unverified',focused=document.body.getAttribute('data-story-scope')==='focused',liveDiffCurrent=document.body.getAttribute('data-live-diff-stale')!=='1',coverageClean=(!pill||pill.classList.contains('is-clean'))&&fresh==='current',exclusionsClear=excluded===0||exclusionsAcknowledged(),clean=feedbackHealthy&&coverageClean&&exclusionsClear&&indexDivergent===0&&!focused&&liveDiffCurrent;
    // One flag on the Review tab, shown only while the page behind it still
    // wants a decision. Clean means the flag goes away, not that it turns green.
    var flag=$('[data-review-flag]');if(flag)flag.hidden=blockingN===0&&!!clean;
    var qs=$('[data-queue-summary]');if(qs){qs.textContent=openN+' queued';qs.hidden=openN===0;}
    $all('[data-copy-comments]').forEach(function(button){button.disabled=openN===0;});
    if(fileItems&&fileItems.length)syncFileCommentFlags();
  }
  function excludedPaths(){return $all('[data-excluded-file]').map(function(card){return card.getAttribute('data-excluded-file');}).filter(Boolean);}
  function exclusionsAckKey(){return 'ds-exclusions-ack:'+(document.body.getAttribute('data-review-scope')||'')+':'+(document.body.getAttribute('data-current-diff-hash')||'');}
  function exclusionsAcknowledged(){if(!excludedPaths().length)return true;try{return localStorage.getItem(exclusionsAckKey())==='1';}catch(e){return false;}}
  function syncExclusionAcknowledgement(){var checkbox=$('[data-exclusions-ack]');if(checkbox)checkbox.checked=exclusionsAcknowledged();refreshCount();}
  function setExclusionsAcknowledged(on){try{if(on)localStorage.setItem(exclusionsAckKey(),'1');else localStorage.removeItem(exclusionsAckKey());}catch(e){}refreshCount();}
  function toast(msg,tone){
    if(!toastEl)return;
    var sequence=++toastSequence,isError=tone==='error';
    clearTimeout(toastTimer);toastEl.classList.remove('is-show');toastEl.classList.toggle('is-error',isError);toastEl.textContent='';
    toastEl.setAttribute('role',isError?'alert':'status');toastEl.setAttribute('aria-live',isError?'assertive':'polite');
    requestAnimationFrame(function(){if(sequence!==toastSequence)return;toastEl.textContent=msg;toastEl.classList.add('is-show');});
    toastTimer=setTimeout(function(){if(sequence!==toastSequence)return;toastEl.classList.remove('is-show');setTimeout(function(){if(sequence!==toastSequence)return;toastEl.textContent='';toastEl.classList.remove('is-error');toastEl.setAttribute('role','status');toastEl.setAttribute('aria-live','polite');},220);},4200);
  }
  function commentsToText(list){
    var out=[list.length===1?'Review comment from diffStory':'Code review comments from diffStory',''];
    list.forEach(function(c,i){
      var label=(FLAVOR[c.type]&&FLAVOR[c.type].label)||c.type;
      var sel=c.selection||{},start=sel.startLine||c.line,end=sel.endLine||start;
      var side=commentSide(c);
      out.push((i+1)+'. ['+label+'] '+c.file+':'+start+(end&&end!==start?'-'+end:'')+' ('+(side==='left'?'old side':'new side')+')');
      if(c.selectedText){var fence=String.fromCharCode(96,96,96);out.push('Selected code:',fence,String(c.selectedText),fence);}
      out.push('Comment:',String(c.body||''));
      out.push('');
    });
    return out.join('\\n').replace(/\\s+$/,'');
  }
  function writeClipboard(text,onOk){
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(onOk,function(){legacyCopy(text,onOk);});
    }else{legacyCopy(text,onOk);}
  }
  function legacyCopy(text,onOk){
    try{
      var ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');
      ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);
      ta.select();var ok=document.execCommand('copy');document.body.removeChild(ta);
      if(ok)onOk();else toast('Could not copy — select the comments manually.','error');
    }catch(e){toast('Could not copy — select the comments manually.','error');}
  }
  function copyComments(){
    fetch(reviewPageUrl(API)).then(function(r){return r.json();}).then(function(list){
      var pick=(Array.isArray(list)?list:[]).filter(function(c){return c.status==='open';});
      if(!pick.length){toast('No queued comments to copy.');return;}
      writeClipboard(commentsToText(pick),function(){toast('Copied '+pick.length+' queued '+(pick.length===1?'comment.':'comments.'));});
    }).catch(function(){toast('Could not read comments to copy.','error');});
  }
  function closeStoryTuneMenus(){
    $all('.ds-story-tune[open]').forEach(function(menu){menu.open=false;});
  }

  function onClick(e){
    var t=e.target,b;
    if(!closest(t,'.ds-story-tune'))closeStoryTuneMenus();
    b=closest(t,'[data-vscode-symbol]');if(b&&(e.metaKey||e.ctrlKey)){e.preventDefault();openSymbolInVSCode(b);return;}
    b=closest(t,'[data-review-reload]');if(b){location.reload();return;}
    b=closest(t,'[data-move-target-file]');if(b){var targetStep=parseInt(b.getAttribute('data-move-target-step')||'0',10);if(targetStep>0){setActive(targetStep);return;}var targetFile=b.getAttribute('data-move-target-file')||'',targetLine=parseInt(b.getAttribute('data-move-target-line')||'0',10);if(targetFile){openMoveTargetFile(targetFile,targetLine);return;}}
    b=closest(t,'[data-selection-comment]');if(b){var ctx=selectionContext;closeSelectionMenu();if(ctx)openComposer(ctx.anchorRow,'change',ctx);return;}
    if(selectionMenu&&!selectionMenu.hidden&&!closest(t,'[data-selection-menu]'))closeSelectionMenu();
    b=closest(t,'[data-sidebar-toggle]');if(b){
      var collapsed=document.body.classList.contains('ds-rail-collapsed');
      if(compactScreen()){if(collapsed)openCompactSidebar(b);else closeCompactSidebar(true);}
      else setSidebarCollapsed(!collapsed);
      return;
    }
    b=closest(t,'[data-sidebar-scrim]');if(b){closeCompactSidebar(true);return;}
    b=closest(t,'[data-view]');if(b){setView(b.getAttribute('data-view'));return;}
    b=closest(t,'[data-review-tab-select]');if(b){selectReviewTab(b.getAttribute('data-review-tab-select'),false);return;}
    b=closest(t,'[data-goto-review]');if(b){gotoReview(b.getAttribute('data-goto-review'),b.getAttribute('data-goto-excluded'));return;}
    b=closest(t,'[data-file-filter]');if(b){setFileFilter(b.getAttribute('data-file-filter'));return;}
    b=closest(t,'[data-next-unviewed]');if(b){nextUnviewedFile();return;}
    b=closest(t,'[data-retry-file-panel]');if(b){var lazyPanel=closest(b,'.ds-filepanel');if(lazyPanel){lazyPanel.innerHTML='<div class="ds-filepanel-loading" data-file-panel-lazy role="status">Loading file review…</div>';loadFilePanel(lazyPanel);}return;}
    b=closest(t,'[data-retry-story-step]');if(b){var lazyStep=closest(b,'.ds-step'),stepIndex=Number(b.getAttribute('data-retry-story-step'));if(lazyStep){lazyStep.setAttribute('data-step-lazy','1');loadStoryStep(stepIndex,function(ok){if(ok&&active===stepIndex)activateStep(stepIndex,true);});}return;}
    b=closest(t,'[data-drift-open]');if(b){openDriftDrawer();return;}
    b=closest(t,'[data-drift-close]');if(b){closeDriftDrawer();return;}
    b=closest(t,'[data-drift-back]');if(b&&driftDrawer){showDriftList();return;}
    b=closest(t,'[data-drift-file]');if(b){loadDriftFile(b);return;}
    b=closest(t,'[data-drift-retry]');if(b&&driftDrawer){var activeDrift=$('.ds-drift-file.is-active',driftDrawer);if(activeDrift){activeDrift.removeAttribute('data-drift-loaded');loadDriftFile(activeDrift);}return;}
    b=closest(t,'[data-challenge-check]');if(b){saveChallengeChecks();return;}
    b=closest(t,'[data-goto-comment]');if(b){gotoComment(b.getAttribute('data-goto-comment'));return;}
    b=closest(t,'[data-edit-comment]');if(b){openQueuedCommentEditor(closest(b,'[data-feedback-card]'));return;}
    b=closest(t,'[data-edit-cancel]');if(b){closeQueuedCommentEditor(closest(b,'[data-feedback-card]'));return;}
    b=closest(t,'[data-edit-save]');if(b){saveQueuedComment(closest(b,'[data-feedback-card]'));return;}
    b=closest(t,'[data-remove-comment]');if(b){removeQueuedComment(b.getAttribute('data-remove-comment'));return;}
    b=closest(t,'[data-comment-launcher]');if(b){gotoQueuedComment(b.getAttribute('data-queued-comment-id'));return;}
    b=closest(t,'[data-resume-review]');if(b){restoreReviewPosition();return;}
    b=closest(t,'[data-shortcuts-open]');if(b){openCommands();return;}
    b=closest(t,'[data-shortcuts-close]');if(b){closeCommands();return;}
    b=closest(t,'[data-command]');if(b){runCommand(b.getAttribute('data-command'));return;}
    b=closest(t,'[data-story-choice]');if(b){
      var id=b.getAttribute('data-story-choice'),value=b.getAttribute('data-value')||'';
      setStoryChoice(id,value);
      if(id==='storyAgentSel'){fillStoryModels();showStorySkillState();}
      return;
    }
    b=closest(t,'[data-story-scope-action]');if(b){
      var action=b.getAttribute('data-story-scope-action');
      if(action==='all')setStoryFileChecks(function(){return true;});
      else if(action==='none')setStoryFileChecks(function(){return false;});
      else if(action==='tests')setStoryFileChecks(storyPathIsTest);
      else if(action==='config')setStoryFileChecks(storyPathIsConfig);
      else if(action==='source')setStoryFileChecks(function(path){return !storyPathIsTest(path)&&!storyPathIsConfig(path)&&!storyPathIsDoc(path);});
      return;
    }
    b=closest(t,'[data-story-ext]');if(b){
      var ext=b.getAttribute('data-story-ext')||'';
      setStoryFileChecks(function(path){return storyFileExt(path)===ext;});
      return;
    }
    b=closest(t,'input[data-story-file]');if(b){updateStoryScopeCount();return;}
    b=closest(t,'[data-generate-story]');if(b){generateStory(b);return;}
    b=closest(t,'[data-reload-diff]');if(b){b.disabled=true;b.classList.add('is-loading');b.setAttribute('aria-busy','true');b.setAttribute('aria-label','Reloading diff');var reloadLabel=$('[data-reload-label]',b);if(reloadLabel)reloadLabel.textContent='Reloading';requestAnimationFrame(function(){location.reload();});return;}
    b=closest(t,'[data-rail-beat]');if(b){var rbi=parseInt(b.getAttribute('data-rail-step-index')||'-1',10),rbg=parseInt(b.getAttribute('data-focus-group')||'0',10);if(rbi===active)selectStoryFocus(rbi,rbg,true);collapseCompactSidebar();return;}
    b=closest(t,'[data-beat-move]');if(b){var bmp=beatPanel(b);movePanelBeat(bmp,parseInt(b.getAttribute('data-beat-move')||'0',10));return;}
    b=closest(t,'[data-open-full-diff]');if(b){var file=b.getAttribute('data-open-full-diff')||'',item=fileItems.find(function(candidate){return candidate.getAttribute('data-file-path')===file;});setView('files');if(item)selectFile(Number(item.getAttribute('data-file-index')));collapseCompactSidebar();return;}
    b=closest(t,'[data-open-all-files]');if(b){setView('files');collapseCompactSidebar();return;}
    b=closest(t,'[data-story-beat]');if(b){var bp=beatPanel(b);if(bp){var bpi=parseInt(bp.getAttribute('data-step-panel')||'0',10),bpg=parseInt(b.getAttribute('data-focus-group')||'0',10);selectStoryFocus(bpi,bpg,true);}return;}
    b=closest(t,'[data-aloud-stop]');if(b){stopReadAloud();return;}
    b=closest(t,'[data-readaloud]');if(b){toggleReadAloud();return;}
    b=closest(t,'[data-viewed-toggle]');if(b){var viewedPanel=closest(b,'.ds-filepanel');if(viewedPanel)toggleViewed(viewedPanel.getAttribute('data-file'));return;}
    b=closest(t,'.ds-fileitem');if(b){setView('files');selectFile(Number(b.getAttribute('data-file-index')));collapseCompactSidebar();return;}
    b=closest(t,'[data-copy-comments]');if(b){if(b.disabled)return;copyComments();return;}
    b=closest(t,'[data-change-prev]');if(b){jumpRelativeChange(closest(b,'.ds-filepanel')||closest(b,'.ds-diff'),-1);return;}
    b=closest(t,'[data-change-next]');if(b){jumpRelativeChange(closest(b,'.ds-filepanel')||closest(b,'.ds-diff'),1);return;}
    b=closest(t,'[data-expand]');if(b){expandGap(b);return;}
    b=closest(t,'[data-mode]');if(b){var modeHolder=closest(b,'[data-story-diff]');if(modeHolder)modeHolder.setAttribute('data-mode-user-set','1');setMode(b);return;}
    b=closest(t,'[data-exclusions-ack]');if(b){setExclusionsAcknowledged(!!b.checked);return;}
    b=closest(t,'[data-inspect-excluded]');if(b){
      var excludedCard=closest(b,'[data-excluded-file]'),preview=excludedCard&&$('[data-excluded-preview]',excludedCard),excludedFile=b.getAttribute('data-inspect-excluded')||'';if(!preview)return;
      if(preview.getAttribute('data-loaded')==='1'){preview.hidden=!preview.hidden;b.textContent=preview.hidden?'Inspect current file':'Hide preview';return;}
      b.disabled=true;preview.hidden=false;preview.innerHTML='<div class="ds-diffnote">Loading excluded file preview…</div>';
      fetch(reviewPageUrl('/api/review/excluded-file?file='+encodeURIComponent(excludedFile))).then(reviewLazyText).then(function(html){preview.innerHTML=html;preview.setAttribute('data-loaded','1');b.disabled=false;b.textContent='Hide preview';}).catch(function(err){preview.innerHTML='<div class="ds-diffnote" role="alert">'+reviewLazyMessage(err,'Could not load this excluded file.')+(err&&err.reloadRequired?' <button type="button" class="ds-btn ds-btn-ghost" data-review-reload>Reload review</button>':'')+'</div>';b.disabled=false;b.textContent=err&&err.reloadRequired?'Reload required':'Retry preview';});return;
    }
    b=closest(t,'[data-goto-step]');if(b){closeDriftDrawer();setView('tour');setActive(Number(b.getAttribute('data-goto-step')));collapseCompactSidebar();return;}
    b=closest(t,'[data-goto-file]');if(b){closeDriftDrawer();setView('files');selectFileByPath(b.getAttribute('data-goto-file'));collapseCompactSidebar();return;}
    b=closest(t,'[data-explain]');if(b){repairStory('explain',{file:b.getAttribute('data-story-file'),line:Number(b.getAttribute('data-story-line')||0)});return;}
    b=closest(t,'[data-story-repair]');if(b){repairStory(b.getAttribute('data-story-repair'),{file:b.getAttribute('data-story-file'),stepId:b.getAttribute('data-story-step')});var det=closest(b,'details');if(det)det.open=false;return;}
    b=closest(t,'.ds-stepcard');if(b){setActive(Number(b.getAttribute('data-step-index')));collapseCompactSidebar();return;}
  }
  function onKey(e){
    if(e.key==='Escape'){
      var openTune=$('.ds-story-tune[open]');if(openTune){
        e.preventDefault();openTune.open=false;var tuneSummary=$('summary',openTune);if(tuneSummary)tuneSummary.focus();return;
      }
      var inlineComposer=$('.ds-composer');if(inlineComposer){e.preventDefault();removeComposer(inlineComposer,true);return;}
      var escapeModal=topModalRoot();if(escapeModal){
        e.preventDefault();if(escapeModal===commandRoot)closeCommands();else if(escapeModal===driftDrawer)closeDriftDrawer();return;
      }
      closeSelectionMenu();
      if(compactScreen()&&!document.body.classList.contains('ds-rail-collapsed'))closeCompactSidebar(true);
      return;
    }
    var modalRoot=topModalRoot();
    if(!isTextEntryTarget(e.target)&&e.key==='?'){e.preventDefault();openCommands();return;}
    if(modalRoot&&e.key==='Tab'){
      var focusables=modalFocusables(modalRoot);
      if(focusables.length){var first=focusables[0],last=focusables[focusables.length-1],focusInside=modalRoot.contains(document.activeElement);if(!focusInside){e.preventDefault();(e.shiftKey?last:first).focus();return;}if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();return;}if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();return;}}
    }
    if(modalRoot)return;
    if(!isTextEntryTarget(e.target)&&e.key==='/'){
      e.preventDefault();setView('files');var search=$('[data-file-search]');if(search)search.focus();return;
    }
    if(!isTextEntryTarget(e.target)&&(e.key==='c'||e.key==='C')){
      var cctx=currentSelectionContext()||focusedRowContext();if(cctx){e.preventDefault();selectionContext=cctx;openComposer(cctx.anchorRow,'change',cctx);return;}
    }
    var storyChoice=closest(e.target,'[data-story-choice]');
    if(storyChoice&&(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowDown'||e.key==='Home'||e.key==='End')){
      var choiceGroup=closest(storyChoice,'[role="radiogroup"]'),choices=choiceGroup?$all('[data-story-choice]',choiceGroup):[];
      if(choices.length){
        var ci=choices.indexOf(storyChoice),nextChoice;
        if(e.key==='Home')nextChoice=choices[0];
        else if(e.key==='End')nextChoice=choices[choices.length-1];
        else nextChoice=choices[(ci+((e.key==='ArrowRight'||e.key==='ArrowDown')?1:-1)+choices.length)%choices.length];
        if(nextChoice){e.preventDefault();nextChoice.focus();nextChoice.click();return;}
      }
    }
    // The review page's own tablist walks the same way the view tabs do — a
    // tablist a keyboard cannot cross is a tablist in name only.
    var reviewTab=closest(e.target,'[data-review-tab-select]');
    if(reviewTab&&(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Home'||e.key==='End')){
      var reviewTabs=$all('[data-review-tab-select]'),rti=reviewTabs.indexOf(reviewTab);
      var nextReviewTab=e.key==='Home'?reviewTabs[0]:e.key==='End'?reviewTabs[reviewTabs.length-1]:reviewTabs[(rti+(e.key==='ArrowRight'?1:-1)+reviewTabs.length)%reviewTabs.length];
      if(nextReviewTab){selectReviewTab(nextReviewTab.getAttribute('data-review-tab-select'),true);e.preventDefault();}
      return;
    }
    var viewTab=closest(e.target,'[data-view]');
    if(viewTab&&(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Home'||e.key==='End')){
      // Wrapping N-way walk: a two-way flip stopped being correct at three tabs.
      var tabs=$all('.ds-tab'),ti=tabs.indexOf(viewTab);
      var nextTab=e.key==='Home'?tabs[0]:e.key==='End'?tabs[tabs.length-1]:tabs[(ti+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
      if(nextTab){var nextView=nextTab.getAttribute('data-view');
      setView(nextView,true);
      nextTab.focus();
      e.preventDefault();}return;
    }
    var railHandle=closest(e.target,'[data-sidebar-resizer]');
    if(railHandle&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
      setSidebarCollapsed(false);
      setSidebarWidth(currentSidebarWidth()+(e.key==='ArrowRight'?16:-16),true);
      e.preventDefault();
      return;
    }
    var focusedRailBeat=closest(e.target,'[data-rail-beat]');
    if(focusedRailBeat&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){
      e.preventDefault();moveRailBeat(focusedRailBeat,e.key==='ArrowRight'?1:-1);return;
    }
    var focusedStoryBeat=closest(e.target,'[data-story-beat]');
    if(focusedStoryBeat&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){
      e.preventDefault();moveStoryBeat(focusedStoryBeat,e.key==='ArrowRight'?1:-1);return;
    }
    var wantsBeatNav=e.key==='ArrowRight'||e.key==='ArrowLeft';
    if(wantsBeatNav&&moveSpeechBeat(e.key==='ArrowRight'?1:-1)){e.preventDefault();return;}
    if(wantsBeatNav&&!isTextEntryTarget(e.target)&&tourView&&!tourView.hidden&&active>0&&movePanelBeat(stepPanels[active],e.key==='ArrowRight'?1:-1)){e.preventDefault();return;}
    if(handleChangeShortcut(e))return;
    var next=e.key==='j',prev=e.key==='k';
    if(next||prev){
      if(isTextEntryTarget(e.target))return;
      if(currentView()==='review')return;
      e.preventDefault();
      if(filesView&&!filesView.hidden)selectFile(selectedFile+(next?1:-1));
      else if(tourView&&!tourView.hidden)setActive(active+(next?1:-1));
      return;
    }
    if((e.key==='v'||e.key==='V')&&!isTextEntryTarget(e.target)&&filesView&&!filesView.hidden){
      var vp=filePanels[selectedFile];
      if(vp){toggleViewed(vp.getAttribute('data-file'));e.preventDefault();return;}
    }
    var wantsSpacePause=e.key===' '||e.code==='Space'||e.key==='Spacebar';
    // Space is documented as "Toggle read aloud", so it has to be able to start
    // narration, not only pause a running one. It used to call toggleVoicePause,
    // which returns false whenever nothing is playing — so the advertised
    // play/pause key did nothing at all until narration was already going, and
    // the keystroke was not even consumed.
    if(wantsSpacePause&&!isTextEntryTarget(e.target)&&(isReadAloudShortcutTarget(e.target)||!isKeyboardControlTarget(e.target))){
      // On the button itself, let the browser's own activation do the work —
      // handling it here as well would toggle twice for one press.
      if(isReadAloudShortcutTarget(e.target))return;
      if($('[data-readaloud]')){e.preventDefault();toggleReadAloud();return;}
    }
    if(isTextEntryTarget(e.target)||isKeyboardControlTarget(e.target))return;
  }
  // ---- resizable sidebar ----
  function sidebarDragWidth(e){
    var layout=$('.ds-layout'),left=0;
    if(layout){left=layout.getBoundingClientRect().left;}
    return e.clientX-left;
  }
  function startSidebarResize(e){
    var h=closest(e.target,'[data-sidebar-resizer]');if(!h)return;
    sidebarResizing=true;
    setSidebarCollapsed(false);
    document.body.classList.add('ds-sidebar-resizing');
    e.preventDefault();
  }
  function moveSidebarResize(e){
    if(!sidebarResizing)return;
    sidebarResizeClientX=e.clientX;
    if(!sidebarResizeFrame)sidebarResizeFrame=requestAnimationFrame(function(){
      sidebarResizeFrame=0;
      if(sidebarResizing&&sidebarResizeClientX!=null)setSidebarWidth(sidebarDragWidth({clientX:sidebarResizeClientX}),false);
    });
  }
  function endSidebarResize(e){
    if(!sidebarResizing)return;
    if(e&&typeof e.clientX==='number')sidebarResizeClientX=e.clientX;
    if(sidebarResizeFrame){cancelAnimationFrame(sidebarResizeFrame);sidebarResizeFrame=0;}
    if(sidebarResizeClientX!=null)setSidebarWidth(sidebarDragWidth({clientX:sidebarResizeClientX}),false);
    sidebarResizeClientX=null;
    sidebarResizing=false;
    document.body.classList.remove('ds-sidebar-resizing');
    setSidebarWidth(currentSidebarWidth(),true);
  }
  // ---- resizable diff panes (drag the BEFORE | AFTER divider) ----
  function startSplit(e){
    var div=closest(e.target,'.ds-celldiv');if(!div)return;
    var body=closest(div,'.ds-diffbody');if(!body)return;
    splitBody=body;splitHolder=closest(div,'.ds-filepanel,.ds-diff');splitResizeClientX=null;document.body.classList.add('ds-resizing');e.preventDefault();
  }
  function applySplitResize(clientX){
    if(!splitBody||!splitHolder)return;
    var r=splitBody.getBoundingClientRect();if(!r.width)return;
    var pct=Math.max(22,Math.min(78,(clientX-r.left)/r.width*100));
    splitHolder.style.setProperty('--ds-split',String(pct));
    scheduleAnnotations(closest(splitHolder,'.ds-step'));
  }
  function moveSplit(e){
    if(!splitBody)return;
    splitResizeClientX=e.clientX;
    if(!splitResizeFrame)splitResizeFrame=requestAnimationFrame(function(){splitResizeFrame=0;if(splitBody&&splitResizeClientX!=null)applySplitResize(splitResizeClientX);});
  }
  function endSplit(e){
    if(!splitBody)return;
    if(e&&typeof e.clientX==='number')splitResizeClientX=e.clientX;
    if(splitResizeFrame){cancelAnimationFrame(splitResizeFrame);splitResizeFrame=0;}
    if(splitResizeClientX!=null)applySplitResize(splitResizeClientX);
    try{localStorage.setItem('ds-split',(splitHolder&&splitHolder.style.getPropertyValue('--ds-split')||'').trim());}catch(err){}
    splitResizeClientX=null;splitBody=null;splitHolder=null;document.body.classList.remove('ds-resizing');
  }
  // The sticky file head parks below whatever chrome sits above it, and that
  // chrome's height is real layout, not a constant worth guessing. It lands as a
  // CSS var on the holder so the CSS above stays declarative. (The beat dock used
  // to need the same treatment when it floated over the diff; it stands in the
  // bottom island now, so the scroller has nothing to reserve room for.)
  var stickyObserver=null;
  function measureChrome(holder,sel,prop){
    var kid=holder?$(sel,holder):null;
    var h=kid?Math.round(kid.getBoundingClientRect().height):0;
    if(h)holder.style.setProperty(prop,h+'px');else if(holder)holder.style.removeProperty(prop);
  }
  function updateStickyMetrics(){
    $all('.ds-diff').forEach(function(card){measureChrome(card,'.ds-difftoolbar','--ds-stickytop');});
    $all('.ds-filepanel').forEach(function(panel){measureChrome(panel,'.ds-filepanel-head','--ds-stickytop');});
  }
  function watchStickyMetrics(){
    updateStickyMetrics();
    if(typeof ResizeObserver!=='function')return;
    // Observe only — the callback never re-observes, or each measurement would
    // schedule the next one and the loop would never settle.
    if(!stickyObserver)stickyObserver=new ResizeObserver(updateStickyMetrics);
    stickyObserver.disconnect();
    $all('.ds-difftoolbar,.ds-filepanel-head').forEach(function(el){stickyObserver.observe(el);});
  }
  function init(){
    tourView=$('#ds-view-tour');filesView=$('#ds-view-files');reviewView=$('#ds-view-review');driftDrawer=$('#ds-drift-drawer');commandRoot=$('[data-command-root]');toastEl=$('#ds-toast');selectionMenu=$('[data-selection-menu]');filmThread=$('[data-filmthread]');filmTooltip=$('[data-filmthread-tooltip]');
    stepPanels=$all('.ds-step');stepCards=$all('.ds-stepcard');total=stepPanels.length||1;
    adoptStepDocks();
    filePanels=$all('.ds-filepanel');fileItems=$all('.ds-fileitem');
    if(document.body.getAttribute('data-storyless')||document.body.getAttribute('data-initial-view')==='files')setView('files');
    document.addEventListener('click',onClick);
    document.addEventListener('contextmenu',openSelectionMenu);
    document.addEventListener('keydown',onKey);
    document.addEventListener('pointerover',onFilmPointerOver);
    document.addEventListener('pointerout',onFilmPointerOut);
    document.addEventListener('focusin',onFilmFocusIn);
    document.addEventListener('focusout',onFilmFocusOut);
    if(filmThread){filmThread.addEventListener('pointermove',onFilmPointerMove);filmThread.addEventListener('pointerleave',onFilmPointerLeave);}
    watchFilmProgress();
    document.addEventListener('mousedown',trackSelectionSide);
    document.addEventListener('mouseup',releaseSelectionSide);
    document.addEventListener('selectionchange',clearCollapsedSelection);
    document.addEventListener('scroll',saveReviewPositionSoon,true);
    document.addEventListener('mousedown',startSidebarResize);
    document.addEventListener('mousemove',moveSidebarResize);
    document.addEventListener('mouseup',endSidebarResize);
    document.addEventListener('mousedown',startSplit);
    document.addEventListener('mousemove',moveSplit);
    document.addEventListener('mouseup',endSplit);
    var liveReload=$('[data-live-reload]');if(liveReload)liveReload.addEventListener('click',function(){location.reload();});
    var liveDismiss=$('[data-live-dismiss]');if(liveDismiss)liveDismiss.addEventListener('click',function(){var kind=livePriority();if(kind){liveDismissed[kind]=liveGenerations[kind];renderLiveBanner();}});
    var storyReloadCancel=$('[data-story-reload-cancel]');if(storyReloadCancel)storyReloadCancel.addEventListener('click',cancelStoryReload);
    window.addEventListener('resize',function(){setSidebarWidth(currentSidebarWidth(),false);syncSidebarOverlay(document.body.classList.contains('ds-rail-collapsed'));applyResponsiveStoryMode(stepPanels&&stepPanels[active]);syncDriftLayout();$all('.ds-filepanel,.ds-diff').forEach(updateChangeNav);updateStickyMetrics();syncFilmProgress();syncActiveAnnotations();if(filmTooltipTarget)showFilmTooltip(filmTooltipTarget);});
    try{var rw=parseFloat(localStorage.getItem('ds-sidebar-width')||'');if(rw)setSidebarWidth(rw,false);else updateSidebarHandle(currentSidebarWidth());}catch(e){updateSidebarHandle(currentSidebarWidth());}
    try{var sv=localStorage.getItem('ds-split');if(sv)$all('.ds-filepanel,.ds-diff').forEach(function(holder){holder.style.setProperty('--ds-split',sv);});}catch(e){}
    try{
      var storedCollapsed=localStorage.getItem('ds-sidebar-collapsed');
      // A desktop preference must not cover the review on a narrow screen.
      setSidebarCollapsed(compactScreen()||storedCollapsed==='1',false);
    }catch(e){setSidebarCollapsed(compactScreen(),false);}
    initStoryGenerator();
    $all('.ds-filepanel,.ds-diff').forEach(updateChangeNav);
    watchStickyMetrics();
    refreshCount();
    scheduleCoverageResolve();
    loadViewed();invalidateChangedViewed();syncViewed();applyFileFilters();syncExclusionAcknowledgement();loadChallengeChecks();
    var fileSearch=$('[data-file-search]');if(fileSearch)fileSearch.addEventListener('input',searchFilesLazily);
    reviewPositionReady=true;restoreReviewPosition();
    revealResumeReview();
    refreshComments();
    startLiveEvents();
    // Reloading or closing the tab must not leave Aloud reading to a page that
    // no longer exists. The fresh page starts idle, so it hides the stop button
    // and every control refers to a job it has never heard of — there was no way
    // left in diffStory to silence a voice the reviewer could still hear.
    window.addEventListener('pagehide',function(){
      if(aloudIntent==='off'&&!aloudActive&&!aloudJobId&&!speechLoadingLabel)return;
      try{
        var body=new Blob([JSON.stringify({action:'stop'})],{type:'application/json'});
        if(navigator.sendBeacon)navigator.sendBeacon('/api/aloud/control',body);
      }catch(e){}
    });
    var rab=$('[data-readaloud]');
    if(rab)updateReadAloudButton();
    prepareStepNarration(active===0?1:active);
  }
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
`;
export const PAGE_JS = PAGE_JS_HEAD + DIFF_JS + PAGE_JS_TAIL;
