// Inlined CSS + client JS for the diffStory review page. Kept as plain strings
// (no backticks, no ${} in the JS) so they drop straight into the render template
// literal. The client only ever sets textContent, builds nodes with createElement,
// or injects server-escaped HTML from /api/fullfile — so there is no injection sink.

import { DIFF_CSS, DIFF_JS } from './diff-assets.js';
import { sharedTokens, themeControlStyles } from './theme.js';

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
  --md-tertiary:var(--del); --md-error:var(--del); --md-on-error:var(--on-accent); --md-error-container:var(--del-soft);
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
html,body{margin:0;padding:0;height:100%}
body{background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;-webkit-font-smoothing:antialiased;
  display:flex;flex-direction:column;height:100vh;overflow:hidden;
  /* Signal 3b: ink page frame — shell regions float as islands with 12px gutters */
  padding:12px;gap:12px}
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
.ds-sidebar-toggle{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:9px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:15px;flex:none}
.ds-sidebar-toggle:hover{background:var(--fill-2);color:var(--text)}
.ds-sidebar-toggle.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
.ds-sidebar-toggle-ico{line-height:1;transform:translateY(-0.5px)}
.ds-vsep{width:1px;height:24px;background:var(--line)}
.ds-titlewrap{display:flex;flex-direction:column;min-width:0;flex:1 1 auto;gap:2px;overflow:hidden}
.ds-titlebar{display:flex;align-items:center;gap:7px;min-width:0;overflow:hidden;white-space:nowrap}
.ds-back{height:32px;display:inline-flex;align-items:center;gap:2px;padding:0 10px 0 7px;border-radius:9px;border:none;
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
.ds-check{font-size:12px}
.ds-actions{position:relative;display:flex;align-items:center;gap:9px;flex:none}
.ds-btn{font-size:13px;font-weight:600;border-radius:var(--radius);cursor:pointer;border:1px solid transparent;white-space:nowrap}
.ds-btn-ghost{color:var(--accent-text);padding:9px 16px;border-color:var(--line);background:transparent}
.ds-btn-ghost:hover{background:var(--fill-2)}
.ds-btn-approve{display:flex;align-items:center;gap:7px;font-weight:700;color:var(--on-accent);padding:10px 18px;border:none;background:var(--accent)}
.ds-btn-approve:hover{background:var(--accent-hi)}
.ds-btn-approve:disabled{opacity:0.4;cursor:not-allowed}
.ds-help{font-weight:700;font-family:var(--mono)}
.ds-agent-target{height:var(--control-h);max-width:260px;display:flex;align-items:center;gap:7px;padding:0 11px;border-radius:var(--radius);border:1px solid var(--line);
  background:transparent;color:var(--text);font:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.ds-agent-target:hover{background:var(--fill-2);border-color:var(--md-outline)}
.ds-agent-target-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);background:var(--accent-soft);color:var(--accent-text);font-size:11px}
.ds-agent-target-prefix{color:var(--muted);font-weight:600}.ds-agent-target-sep,.ds-agent-target-caret{color:var(--dim)}
.ds-agent-target-name{min-width:0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-agent-target.is-empty .ds-agent-target-name{color:var(--accent-text)}
.ds-agent-target.is-busy .ds-agent-target-icon{animation:dsPulse 1s ease-in-out infinite;background:var(--md-primary);color:var(--md-on-primary)}
.ds-review-menu-wrap{position:relative}
.ds-review-menu{height:var(--control-h);display:flex;align-items:center;gap:8px;padding:0 13px;border-radius:var(--radius);border:1px solid var(--line);
  background:var(--md-surface-container-high);color:var(--text);font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}
.ds-review-menu:hover,.ds-review-menu.is-open{background:var(--md-surface-container-highest);border-color:var(--md-outline)}
.ds-reload-diff:disabled{opacity:.55;cursor:default}
.ds-review-menu-dot{width:7px;height:7px;border-radius:999px;background:var(--amber);box-shadow:0 0 0 4px var(--amber-soft)}
.ds-review-menu.is-clean .ds-review-menu-dot{background:var(--add);box-shadow:0 0 0 4px var(--add-bg)}
.ds-review-menu-caret{color:var(--muted);font-size:12px;transform:translateY(-1px)}
.ds-review-menu-coverage{padding:3px 7px;border-radius:var(--radius-sm);background:var(--amber-soft);color:var(--amber-text);font-size:10px;font-weight:600}
.ds-review-menu-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:32;width:320px;max-width:calc(100vw - 24px);padding:8px;
  border:1px solid var(--line-soft);border-radius:16px;background:var(--md-surface-container-high);box-shadow:var(--shadow)}
.ds-review-menu-pop:focus{outline:none}
.ds-review-menu-pop[hidden]{display:none}
.ds-review-menu-title{padding:7px 9px 6px;font-family:var(--mono);font-size:10px;letter-spacing:var(--tracking-kicker);text-transform:uppercase;color:var(--dim2);font-weight:500}
.ds-review-menu-count{min-width:20px;height:20px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--radius-sm);background:var(--fill-2);font-size:11px;font-variant-numeric:tabular-nums}
.ds-review-menu-count-label{margin-left:2px;color:var(--muted);font-size:10px;font-weight:600}
.ds-review-summary{display:flex;flex-direction:column;gap:6px;padding:0 4px 9px;margin-bottom:4px;border-bottom:1px solid var(--line-soft)}
.ds-review-summary-label{display:flex;align-items:center;gap:8px;padding:7px 6px 3px;color:var(--muted);font-size:12px}
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
.ds-review-more{border-top:1px solid var(--line-soft)}.ds-review-more>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border-radius:9px;color:var(--muted);font-size:11.5px;font-weight:700;cursor:pointer}.ds-review-more>summary::-webkit-details-marker{display:none}.ds-review-more>summary:hover{background:var(--fill-2);color:var(--text)}.ds-review-more[open]>summary span{transform:rotate(180deg)}
.ds-review-more-list{display:grid;gap:1px;padding:0 0 3px 12px}.ds-review-more-list .ds-review-option{padding-top:8px;padding-bottom:8px}.ds-review-more-list .ds-review-option-title{font-size:12px}
.ds-keycap,.ds-command kbd{font-family:var(--mono);font-size:10px;line-height:1;border:1px solid var(--line);border-bottom-color:var(--md-outline);border-radius:5px;background:var(--fill-2);padding:3px 5px;color:var(--muted)}
.ds-readaloud{width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:var(--md-on-secondary-container);padding:0;border-radius:9px;border:none;
  background:transparent;cursor:pointer;white-space:nowrap}
.ds-readaloud:hover{background:var(--md-surface-container-highest)}
.ds-readaloud-ico{width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--md-on-primary);background:var(--md-primary)}
.ds-readaloud.is-active{background:var(--md-secondary-container);border-color:transparent;color:var(--md-on-secondary-container)}
.ds-readaloud.is-active .ds-readaloud-ico{background:var(--md-on-secondary-container);color:var(--md-secondary-container)}
.ds-readaloud.is-speaking .ds-readaloud-ico{animation:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-readaloud.is-loading{border-color:var(--md-primary);background:var(--md-surface-container-highest)}
.ds-readaloud.is-loading .ds-readaloud-ico,.ds-preview.is-loading .ds-preview-ico,.ds-voice-card.is-loading .ds-voice-badge{animation:dsSpin .8s linear infinite}
@keyframes dsPulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes dsSpin{to{transform:rotate(360deg)}}
.ds-settings-wrap{position:relative;display:flex;align-items:center;gap:5px}
.ds-gear{display:flex;align-items:center;justify-content:center;width:30px;height:34px;border-radius:9px;border:none;background:transparent;color:var(--dim);cursor:pointer;font-size:13px}
.ds-gear:hover{background:var(--fill-2);color:var(--text)}
.ds-settings-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:30;width:420px;max-width:calc(100vw - 24px);max-height:calc(100vh - 72px);overflow:auto;
  background:var(--md-surface-container-high);border:1px solid var(--line-soft);border-radius:22px;padding:16px;box-shadow:var(--shadow)}
.ds-settings-pop[hidden]{display:none}
.ds-voice-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
.ds-settings-title{font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim2);font-weight:700;margin-bottom:3px}
.ds-voice-now{font-size:12px;color:var(--muted);line-height:1.35;min-height:16px}
.ds-preview{margin-left:auto;display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:transparent;color:var(--text);border-radius:var(--radius);padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
.ds-preview:hover{background:var(--fill-2)}
.ds-preview.is-loading{border-color:var(--md-primary);background:var(--fill-2);color:var(--text)}
.ds-preview-ico{font-size:9px;color:var(--md-primary)}
.ds-engine-row{display:flex;gap:8px;margin-bottom:12px}
.ds-engine-row button{flex:1;border:1px solid var(--line);border-radius:var(--radius);background:transparent;color:var(--muted);font-size:12px;font-weight:600;padding:8px 10px;cursor:pointer}
.ds-engine-row button:hover{background:var(--fill-2);color:var(--text)}
.ds-engine-row button.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container);border-color:transparent}
.ds-voice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.ds-voice-grid[hidden]{display:none}
.ds-kokoro-voice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.ds-voice-card{display:grid;grid-template-columns:34px 1fr;gap:10px;text-align:left;border:1px solid var(--line-soft);border-radius:16px;background:var(--md-surface-container);padding:11px;cursor:pointer;color:var(--text);
  min-height:82px;transition:background var(--motion-duration-fast) ease,border-color var(--motion-duration-fast) ease,box-shadow var(--motion-duration-fast) ease,transform var(--motion-duration-fast) var(--motion-ease-out)}
.ds-voice-card:hover{background:var(--md-surface-container-highest)}
@media (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){.ds-voice-card:hover{transform:translateY(-1px)}}
.ds-voice-card.is-active{border-color:var(--voice-accent,var(--md-primary));box-shadow:inset 0 0 0 1px var(--voice-accent,var(--md-primary));background:var(--voice-bg,var(--accent-soft))}
.ds-voice-card.is-loading{border-color:var(--voice-accent,var(--md-primary));background:var(--md-surface-container-highest)}
.ds-voice-card[data-voice-preset="story"]{--voice-accent:var(--md-primary);--voice-bg:color-mix(in srgb,var(--accent) 16%,transparent)}
.ds-voice-card[data-voice-preset="flirty"]{--voice-accent:var(--md-tertiary);--voice-bg:rgba(239,184,200,0.18)}
.ds-voice-card[data-voice-preset="bass"]{--voice-accent:#8FB4FF;--voice-bg:rgba(143,180,255,0.16)}
.ds-voice-card[data-voice-preset="system"]{--voice-accent:var(--md-outline);--voice-bg:rgba(202,196,208,0.10)}
.ds-voice-card[data-say-voice="samantha"]{--voice-accent:var(--md-primary);--voice-bg:color-mix(in srgb,var(--accent) 16%,transparent)}
.ds-voice-card[data-say-voice="daniel"]{--voice-accent:#8FB4FF;--voice-bg:rgba(143,180,255,0.16)}
.ds-voice-card[data-kokoro-voice="af_heart"]{--voice-accent:#7DD3C7;--voice-bg:rgba(125,211,199,0.16)}
.ds-voice-card[data-kokoro-voice="af_bella"]{--voice-accent:#EFB8C8;--voice-bg:rgba(239,184,200,0.16)}
.ds-voice-card[data-kokoro-voice="af_nicole"]{--voice-accent:#B7D59B;--voice-bg:rgba(183,213,155,0.16)}
.ds-voice-card[data-kokoro-voice="af_sarah"]{--voice-accent:#BF5AF2;--voice-bg:rgba(191,90,242,0.16)}
.ds-voice-card[data-kokoro-voice="am_adam"]{--voice-accent:#8FB4FF;--voice-bg:rgba(143,180,255,0.16)}
.ds-voice-card[data-kokoro-voice="am_onyx"]{--voice-accent:#7DA7FF;--voice-bg:rgba(125,167,255,0.16)}
.ds-voice-card[data-kokoro-voice="bf_emma"]{--voice-accent:#F6C769;--voice-bg:rgba(246,199,105,0.14)}
.ds-voice-card[data-kokoro-voice="bm_daniel"]{--voice-accent:#9BD67D;--voice-bg:rgba(155,214,125,0.14)}
.ds-voice-badge{width:32px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--voice-accent,var(--md-primary));background:var(--voice-bg,var(--accent-soft));letter-spacing:0.02em}
.ds-voice-name{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;line-height:1.2}
.ds-voice-check{display:none;color:var(--voice-accent,var(--md-primary));font-size:12px}
.ds-voice-card.is-active .ds-voice-check{display:inline}
.ds-voice-desc{display:block;margin-top:4px;font-size:11.5px;line-height:1.35;color:var(--muted);text-wrap:pretty}
.ds-settings-row{display:flex;flex-direction:column;align-items:stretch;gap:8px;margin-top:14px}
.ds-settings-label{font-size:12px;color:var(--muted);font-weight:700}
.ds-speed-row{display:flex;gap:8px}
.ds-speed-row button{flex:1;border:1px solid var(--line);border-radius:var(--radius);background:transparent;color:var(--muted);font-size:12px;font-weight:600;padding:8px 10px;cursor:pointer}
.ds-speed-row button:hover{background:var(--fill-2);color:var(--text)}
.ds-speed-row button.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container);border-color:transparent}
.ds-playstep{margin-left:auto;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);background:color-mix(in srgb,var(--accent) 8%,transparent);color:var(--accent-blue);cursor:pointer;font-size:10px;padding:0;line-height:1}
.ds-playstep:hover{background:color-mix(in srgb,var(--accent) 18%,transparent)}
.ds-story-tune{position:relative;flex:none}.ds-story-tune>summary{list-style:none;min-height:32px;display:flex;align-items:center;justify-content:center;padding:0 10px;border:1px solid var(--line-soft);border-radius:8px;background:transparent;color:var(--muted);cursor:pointer;font-size:11.5px;font-weight:700;white-space:nowrap}.ds-story-tune>summary::-webkit-details-marker{display:none}.ds-story-tune>summary:hover{border-color:var(--line);background:var(--fill-2);color:var(--text)}.ds-story-tune[open]>summary{border-color:color-mix(in srgb,var(--accent-blue) 45%,var(--line));background:var(--accent-soft);color:var(--accent-text)}
.ds-story-tune-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:6;width:236px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--material);box-shadow:var(--shadow)}
.ds-story-tune button{display:grid;gap:3px;width:100%;border:0;border-radius:7px;background:transparent;color:var(--text);font:inherit;text-align:left;padding:9px 10px;cursor:pointer}.ds-story-tune button:hover{background:var(--fill-2)}.ds-story-tune button strong{font-size:11.5px;font-weight:700}.ds-story-tune button small{color:var(--muted);font-size:10.5px;font-weight:500;line-height:1.35}
.ds-btn-solid{font-weight:600;color:var(--on-accent);padding:7px 13px;border:none;background:var(--accent)}
.ds-btn-solid:hover{background:var(--accent-hi)}
.ds-rail-scrim{display:none}
/* header responsiveness: keep the code title, collapse everything else progressively */
@media (max-width:900px){
  .ds-kicker{display:none}
  .ds-agent-target{width:36px;padding:0;justify-content:center}.ds-agent-target-prefix,.ds-agent-target-sep,.ds-agent-target-name,.ds-agent-target-caret{display:none}.ds-agent-target-icon{width:20px;height:20px}
  .ds-review-menu{width:36px;padding:0;justify-content:center}.ds-review-menu>span:not(.ds-review-menu-dot):not(.ds-review-menu-count){display:none}.ds-review-menu-dot{width:20px;height:20px;display:flex;align-items:center;justify-content:center;background:transparent;box-shadow:none}.ds-review-menu.is-clean .ds-review-menu-dot{background:transparent;box-shadow:none}.ds-review-menu-dot::before{content:'!';color:var(--amber);font-size:14px;font-weight:900;line-height:1}.ds-review-menu.is-clean .ds-review-menu-dot::before{content:'✓';color:var(--add)}.ds-reload-diff .ds-review-menu-dot::before{content:'↻';color:var(--text)}.ds-review-menu-count{position:absolute;top:-4px;right:-5px;min-width:17px;height:17px;padding:0 4px;font-size:9px}.ds-review-menu-count-label{display:none}
}
@media (max-width:720px){
  :root{--ds-rail-width:240px}
  .ds-top{padding:0 8px;gap:4px}.ds-settings-wrap{display:none}.ds-title{font-size:13px}.ds-titlebar{display:none}.ds-back{padding-right:7px}.ds-back:not(:focus) {font-size:0}.ds-back-ico{font-size:18px}
  .ds-layout>.ds-rail{position:fixed;top:56px;bottom:0;left:0;z-index:8;max-width:calc(100vw - 48px);box-shadow:var(--shadow)}
  body:not(.ds-rail-collapsed) .ds-rail-scrim{display:block;position:fixed;top:56px;right:0;bottom:0;left:min(var(--ds-rail-width,240px),calc(100vw - 48px));z-index:7;border:0;padding:0;background:var(--scrim);cursor:pointer}
  body{padding:0;gap:0}body .ds-layout{gap:0}body .ds-reviewchrome,body .ds-rail,body .ds-main{border-radius:0}
  .ds-main{width:100%}
  .ds-rail-resizer{display:none}
}
@media (max-width:520px){.ds-settings-pop{width:calc(100vw - 24px)}.ds-voice-grid{grid-template-columns:1fr}.ds-voice-head{align-items:stretch;flex-direction:column}.ds-preview{margin-left:0;justify-content:center}}


/* ---- layout ---- */
.ds-layout{flex:1;display:flex;gap:12px;min-height:0}
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
@media (max-width:900px){.ds-storygen-grid{grid-template-columns:1fr}.ds-storygen-button{width:calc(100% - 40px)}}
@media (max-width:700px){.ds-choicegroup{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr))}.ds-depthchoices{grid-template-columns:1fr}.ds-depthchoice{min-height:0}.ds-storygen-button{width:calc(100% - 40px)}}
@media (max-width:560px){.ds-storygen-head{padding:17px}.ds-storygen-grid{padding:16px 17px 0}.ds-storygen-button{margin:17px;width:calc(100% - 34px)}.ds-storyscope>summary{align-items:flex-start}.ds-storyscope-summary{display:grid;justify-items:end;gap:2px}.ds-storyscope-edit{display:none}.ds-depthchoice{padding:12px}.ds-storygen-labelrow{align-items:flex-start}.ds-storygen-optional{white-space:nowrap}.ds-storyfile-search{height:40px}.ds-scopechip{min-height:36px;padding:0 12px}}
@media (max-width:560px){.ds-intro-facts{grid-template-columns:1fr}.ds-introwrap{padding:40px 22px 60px}.ds-intro-title{font-size:26px}}

/* ---- main / story tour ---- */
.ds-main{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--radius-island);overflow:hidden}
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
.ds-step-title{min-width:0;max-width:100%;font-size:19px;font-weight:600;margin:0;letter-spacing:-0.01em;color:var(--text);line-height:1.3;overflow-wrap:anywhere}
.ds-step-file{font-family:var(--mono);font-size:12.5px;color:var(--muted);overflow-wrap:anywhere;min-width:0}
.ds-step-file:hover{color:var(--accent-blue);text-decoration:underline}
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
.ds-step[data-story-lens="focus"] .ds-beat:not(.is-selected) .ds-beat-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dim)}
.ds-step[data-story-lens="focus"] .ds-beat:not(.is-selected){padding-top:5px;padding-bottom:5px}
.ds-storylens{display:inline-flex;padding:2px;border:1px solid var(--line-soft);border-radius:8px;background:var(--fill-1)}.ds-storylens button{height:25px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--muted);font:inherit;font-size:9.5px;font-weight:700;cursor:pointer}.ds-storylens button.is-active{background:var(--panel3);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.18)}.ds-full-diff{height:29px;padding:0 8px;border:1px solid var(--line-soft);border-radius:8px;background:transparent;color:var(--muted);font:inherit;font-size:9.5px;font-weight:700;cursor:pointer}.ds-full-diff:hover{background:var(--fill-2);color:var(--text)}
.ds-step.is-code-step .ds-difftoolbar{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px 8px;align-items:center}.ds-step.is-code-step .ds-difftoolbar>.ds-flex{display:none}.ds-step.is-code-step .ds-difthint{grid-column:1/-1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ds-step.is-code-step .ds-storylens{justify-self:start}.ds-step.is-code-step .ds-full-diff{justify-self:start}.ds-step.is-code-step .ds-modetoggle{justify-self:end}.ds-step[data-story-lens="focus"] .ds-changejump{display:none!important}

/* ---- comments ---- */
.ds-thread{position:fixed;z-index:84;top:88px;right:24px;width:min(460px,calc(100vw - 40px));max-height:calc(100vh - 96px);padding:0;
  background:var(--material);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 72px rgba(0,0,0,.48);
  font-family:var(--sans);display:none;overflow:auto}
.ds-thread.is-open{display:block}
.ds-thread:focus{outline:none}
.ds-chat-head{position:sticky;z-index:3;top:0;display:flex;align-items:center;gap:10px;min-height:52px;padding:0 16px;
  border-bottom:1px solid var(--line);background:var(--material)}
.ds-chat-head>div{display:grid;gap:2px}
.ds-chat-head strong{font-size:13px;font-weight:700}.ds-chat-head span{font-size:11.5px;color:var(--muted)}
.ds-chat-nav{display:flex!important;align-items:center;gap:4px}.ds-chat-nav[hidden]{display:none!important}.ds-chat-nav span{min-width:38px;text-align:center;color:var(--muted);font-size:10.5px;font-variant-numeric:tabular-nums}
.ds-chat-nav button{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--muted);font:inherit;font-size:13px;cursor:pointer}.ds-chat-nav button:hover:not(:disabled){background:var(--fill-2);border-color:var(--line-soft);color:var(--text)}.ds-chat-nav button:disabled{opacity:.28;cursor:default}
.ds-chat-close{position:relative;flex:none;width:30px;height:30px;border:1px solid var(--line);border-radius:var(--radius-sm);background:transparent;color:var(--muted);font:inherit;font-size:16px;cursor:pointer}
.ds-chat-close::after{content:'';position:absolute;inset:-7px}
.ds-chat-close:hover{background:var(--fill-2);color:var(--text)}
.ds-comment-pin{position:absolute;z-index:7;top:50%;right:8px;transform:translateY(-50%);height:28px;min-width:28px;padding:0 8px;border:1px solid color-mix(in srgb,var(--accent) 50%,transparent);border-radius:999px;
  background:var(--material);box-shadow:0 3px 10px rgba(0,0,0,.28);color:var(--accent-blue);font:inherit;font-size:10.5px;font-weight:700;cursor:pointer}
.ds-comment-pin:hover,.ds-comment-pin[aria-expanded="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ds-comment{padding:12px 14px 14px;background:transparent;border:0;font-family:var(--sans)}
.ds-comment[hidden]{display:none!important}
.ds-comment+.ds-comment{border-top:1px solid var(--line)}
.ds-comment-card{display:flex;flex-direction:column;gap:10px;border:0;border-radius:0;overflow:visible;background:transparent}
.flavor-change{border-color:rgba(255,69,58,0.45)}
.flavor-question{border-color:color-mix(in srgb,var(--accent) 50%,transparent)}
.flavor-nit{border-color:color-mix(in srgb,var(--amber) 45%,transparent)}
.ds-comment-head{align-self:stretch;max-width:none;display:flex;align-items:center;gap:7px;padding:0;color:var(--muted)}
.flavor-change .ds-comment-head,.flavor-question .ds-comment-head,.flavor-nit .ds-comment-head{background:transparent}
.ds-flavor-ico{width:18px;height:18px;border-radius:5px;color:var(--on-accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
.flavor-change .ds-flavor-ico{background:rgba(255,69,58,0.45)}
.flavor-question .ds-flavor-ico{background:color-mix(in srgb,var(--accent) 50%,transparent)}
.flavor-nit .ds-flavor-ico{background:color-mix(in srgb,var(--amber) 45%,transparent)}
.ds-flavor-label{font-size:12px;font-weight:600}
.flavor-change .ds-flavor-label{color:var(--del-text)}
.flavor-question .ds-flavor-label{color:var(--accent-text)}
.flavor-nit .ds-flavor-label{color:var(--amber-text)}
.ds-comment-author{font-size:12px;color:var(--text);font-weight:500}
.ds-comment-selection{align-self:stretch;max-width:none;border:1px solid var(--line-soft);border-radius:9px;background:var(--panel3);overflow:hidden}
.ds-comment-selection>summary{list-style:none;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px 10px;cursor:pointer}.ds-comment-selection>summary::-webkit-details-marker{display:none}
.ds-comment-selection-label{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim2);font-weight:700;white-space:nowrap}
.ds-comment-selection-preview{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:11px;color:var(--muted)}
.ds-comment-selection-toggle{font-size:10px;color:var(--accent-text);font-weight:700}.ds-comment-selection-toggle::after{content:'Expand'}.ds-comment-selection[open] .ds-comment-selection-toggle::after{content:'Collapse'}
.ds-comment-selection-code{display:block;max-height:150px;overflow:auto;padding:9px 10px 10px;border-top:1px solid var(--line-soft);font-family:var(--mono);font-size:11.5px;line-height:1.45;color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere}
.ds-statusbadge{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:6px}
.status-open .ds-statusbadge{color:var(--amber);background:color-mix(in srgb,var(--amber) 12%,transparent)}
.status-open .ds-statusbadge .ds-dot{background:var(--amber)}
.status-addressed .ds-statusbadge{color:var(--accent-blue);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.status-addressed .ds-statusbadge .ds-dot{background:var(--accent-blue)}
.status-resolved .ds-statusbadge{color:var(--add);background:rgba(48,209,88,0.14)}
.status-resolved .ds-statusbadge .ds-dot{background:var(--add)}
.ds-comment-body{align-self:flex-end;max-width:88%;padding:9px 11px;font-size:13px;line-height:1.5;color:var(--text);
  border:1px solid var(--line-soft);border-radius:8px 8px 2px 8px;background:var(--md-surface-container-high)}
.ds-turn-user{margin-top:2px}
.ds-reply{align-self:flex-start;width:min(960px,100%);display:flex;gap:10px;padding:0;border:0;background:transparent}
.ds-reply-av{flex:none;width:28px;height:28px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--on-accent)}
.ds-reply-main{min-width:0;max-width:min(900px,calc(100% - 38px))}
.ds-reply-who{display:flex;align-items:center;gap:7px;margin-bottom:3px}
.ds-reply-name{font-size:12px;font-weight:600;color:var(--accent-blue)}
.ds-ai-badge{font-size:9.5px;font-weight:700;letter-spacing:0.04em;color:var(--accent-blue);background:color-mix(in srgb,var(--accent) 14%,transparent);padding:1px 6px;border-radius:4px}
.ds-reply-body{padding:12px 14px;border:1px solid color-mix(in srgb,var(--accent) 24%,transparent);border-radius:8px 8px 8px 2px;background:color-mix(in srgb,var(--accent) 6%,transparent);
  font-size:13px;line-height:1.58;color:var(--text)}
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
.ds-comment-menu{position:relative;flex:none}.ds-comment-menu>summary{list-style:none;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:7px;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer}.ds-comment-menu>summary::-webkit-details-marker{display:none}.ds-comment-menu>summary:hover,.ds-comment-menu[open]>summary{background:var(--fill-2);border-color:var(--line-soft);color:var(--text)}
.ds-comment-menu-pop{position:absolute;z-index:5;top:34px;right:0;width:156px;padding:5px;border:1px solid var(--line);border-radius:10px;background:var(--md-surface-container-high);box-shadow:var(--shadow)}
.ds-comment-menu-pop button{width:100%;display:block;border:0;border-radius:7px;background:transparent;color:var(--text);font:inherit;font-size:11.5px;font-weight:600;text-align:left;padding:8px 9px;cursor:pointer}.ds-comment-menu-pop button:hover{background:var(--fill-2)}.ds-comment-menu-pop .ds-del{color:var(--del-text)}.ds-comment-menu-pop .ds-del:hover{background:var(--del-bg)}
.ds-send{color:var(--accent-blue)}
.ds-addall{font:inherit;font-size:11.5px;font-weight:600;color:var(--accent-blue);background:color-mix(in srgb,var(--accent) 10%,transparent);border:1px solid var(--line);padding:4px 10px;border-radius:7px;cursor:pointer}
.ds-addall:disabled{opacity:.45;cursor:default}
.ds-ghost{font-size:12px;font-weight:500;color:var(--text);padding:6px 12px;border-radius:7px;border:1px solid var(--line);background:transparent;cursor:pointer}
.ds-ghost:hover{background:var(--fill-2)}
.ds-del{color:var(--del-text);border-color:rgba(255,69,58,.34)}.ds-del:hover{background:var(--del-bg);border-color:rgba(255,69,58,.56)}
.ds-composer{position:fixed;z-index:85;top:88px;right:24px;width:min(500px,calc(100vw - 40px));max-height:calc(100vh - 96px);overflow:auto;box-sizing:border-box;
  padding:0 18px 18px;background:var(--material);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 72px rgba(0,0,0,.48);
  font-family:var(--sans);animation:dsChatIn .18s ease}
.ds-composer>.ds-chat-head{margin:0 -18px 14px;padding-inline:16px}
.ds-composer-selection{margin:0 0 10px;padding:10px 11px;border:1px solid var(--line-soft);border-radius:8px;background:var(--panel3);font-family:var(--mono);
  font-size:12px;line-height:1.45;color:var(--muted);white-space:pre-wrap;overflow-wrap:anywhere}
.ds-composer-tabs{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.ds-composer-tab{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:6px 11px;border-radius:8px;cursor:pointer;
  border:1px solid var(--line);background:transparent;color:var(--muted)}
.ds-composer-tab .ds-flavor-ico{background:var(--line);color:var(--muted)}
.ds-composer-tab[data-flavor="change"].is-active{border-color:rgba(255,69,58,0.45);background:rgba(255,69,58,0.12);color:var(--del-text)}
.ds-composer-tab[data-flavor="question"].is-active{border-color:color-mix(in srgb,var(--accent) 50%,transparent);background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent-text)}
.ds-composer-tab[data-flavor="nit"].is-active{border-color:color-mix(in srgb,var(--amber) 45%,transparent);background:color-mix(in srgb,var(--amber) 12%,transparent);color:var(--amber-text)}
.ds-composer-tab[data-flavor="change"].is-active .ds-flavor-ico{background:rgba(255,69,58,0.45);color:var(--on-accent)}
.ds-composer-tab[data-flavor="question"].is-active .ds-flavor-ico{background:color-mix(in srgb,var(--accent) 50%,transparent);color:var(--on-accent)}
.ds-composer-tab[data-flavor="nit"].is-active .ds-flavor-ico{background:color-mix(in srgb,var(--amber) 45%,transparent);color:var(--on-accent)}
.ds-composer-ta{width:100%;box-sizing:border-box;resize:vertical;background:var(--panel3);border:1px solid var(--line);border-radius:8px;
  padding:9px 11px;color:var(--text);font-size:13px;font-family:var(--sans);line-height:1.5;outline:none}
.ds-composer-ta:focus{border-color:color-mix(in srgb,var(--accent) 50%,transparent)}
.ds-agent-route{min-width:0;display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px;line-height:1.2}
.ds-agent-route-icon{width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:var(--accent-soft);color:var(--accent-text);font-size:9px}
.ds-agent-route strong{min-width:0;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:11.5px}
.ds-agent-route button{border:0;background:transparent;color:var(--accent-text);font:inherit;font-size:11px;font-weight:700;padding:3px 4px;border-radius:5px;cursor:pointer}.ds-agent-route button:hover{background:var(--accent-soft)}
.ds-composer-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px}.ds-composer-actions{display:flex;justify-content:flex-end;gap:8px;flex:none}
.ds-agent-chooser{position:fixed;inset:0;z-index:120;display:flex;align-items:flex-start;justify-content:center;padding:clamp(44px,10vh,110px) 12px 24px}
.ds-agent-chooser-scrim{position:absolute;inset:0;border:0;background:var(--scrim);cursor:default}
.ds-agent-chooser-panel{position:relative;width:560px;max-width:100%;max-height:min(720px,82vh);display:flex;flex-direction:column;overflow:hidden;
  border:1px solid var(--line);border-radius:18px;background:var(--material);box-shadow:0 28px 90px rgba(0,0,0,.48)}
.ds-agent-chooser-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 18px 14px;border-bottom:1px solid var(--line-soft)}
.ds-agent-chooser-title{font-size:16px;font-weight:700;color:var(--text)}
.ds-agent-chooser-sub{font-size:12px;line-height:1.4;color:var(--muted);margin-top:4px}
.ds-agent-chooser-close{flex:none;width:30px;height:30px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--muted);font-size:17px;cursor:pointer}
.ds-agent-chooser-close:hover{background:var(--fill-2);color:var(--text)}
.ds-agent-task-search{margin:12px 14px 6px;height:36px;box-sizing:border-box;border:1px solid var(--line);border-radius:9px;background:var(--panel3);color:var(--text);font:inherit;font-size:12.5px;padding:0 11px;outline:none}
.ds-agent-task-search:focus{border-color:var(--accent-blue)}
.ds-agent-task-list{padding:7px 10px 12px;display:grid;gap:4px;overflow:auto}
.ds-agent-task-loading{min-height:116px;display:flex;align-items:center;justify-content:center;gap:9px;color:var(--muted);font-size:12px}.ds-agent-task-spinner{width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--accent-blue);border-radius:50%;animation:dsSpin .7s linear infinite}
.ds-agent-task-option{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;text-align:left;border:0;border-radius:11px;
  background:transparent;color:var(--text);padding:11px 12px;cursor:pointer}
.ds-agent-task-option:hover,.ds-agent-task-option:focus-visible{background:var(--fill-2);outline:none}
.ds-agent-task-option.is-primary{background:transparent;color:var(--text);margin-bottom:3px}.ds-agent-task-option.is-primary .ds-agent-task-main strong{color:var(--accent-text)}
.ds-agent-task-option.is-selected{box-shadow:inset 0 0 0 1px var(--accent-blue);background:var(--accent-soft)}
.ds-agent-task-main{min-width:0;display:grid;gap:3px}.ds-agent-task-main strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-agent-task-main small{font-size:11px;line-height:1.35;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-agent-task-meta{font-size:10.5px;color:var(--dim);white-space:nowrap}.ds-agent-task-option.is-selected .ds-agent-task-meta{color:var(--accent-text);font-weight:700}.ds-agent-task-empty{padding:20px 12px;text-align:center;font-size:12px;color:var(--muted)}
.ds-agent-task-section{padding:9px 12px 4px;font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--dim2)}
@media (max-width:620px){.ds-agent-chooser{align-items:flex-end;padding:12px 8px 8px}.ds-agent-chooser-panel{width:100%;max-height:88vh;border-radius:18px 18px 12px 12px}.ds-composer-foot,.ds-thread-composer-foot{align-items:stretch;flex-direction:column}.ds-composer-actions,.ds-thread-actions{justify-content:flex-end}.ds-agent-route strong{max-width:150px}}
@media (max-width:620px){.ds-thread,.ds-composer{top:auto;right:8px;bottom:8px;width:calc(100vw - 16px);max-height:calc(100vh - 72px);border-radius:18px}.ds-thread{max-height:calc(100vh - 72px)}.ds-comment{padding:14px 14px 18px}}
@keyframes dsChatIn{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}

/* ---- all files ---- */
.ds-stat-add{font-family:var(--mono);color:var(--add);font-variant-numeric:tabular-nums}
.ds-stat-del{font-family:var(--mono);color:var(--del);font-variant-numeric:tabular-nums}
.ds-filedetail{flex:1;overflow-y:auto;background:var(--panel3)}
.ds-filepanel{display:flex;flex-direction:column;min-height:100%}
.ds-filepanel[hidden]{display:none}
.ds-filepanel-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--material);border-bottom:1px solid var(--line)}
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
.ds-trust-stats{display:flex;gap:10px;margin-bottom:20px}
.ds-trust-stat{flex:1;padding:13px;border-radius:11px}
.ds-trust-stat.ok{background:rgba(48,209,88,0.08);border:1px solid rgba(48,209,88,0.22)}
.ds-trust-stat.warn{background:color-mix(in srgb,var(--amber) 8%,transparent);border:1px solid color-mix(in srgb,var(--amber) 26%,transparent)}
.ds-trust-num{font-size:23px;font-weight:600;font-variant-numeric:tabular-nums}
.ds-trust-stat.ok .ds-trust-num{color:var(--add)}
.ds-trust-stat.warn .ds-trust-num{color:var(--amber)}
.ds-trust-lbl{font-size:11.5px;margin-top:2px;line-height:1.35}
.ds-trust-stat.ok .ds-trust-lbl{color:var(--add-text)}
.ds-trust-stat.warn .ds-trust-lbl{color:var(--amber-text)}
.ds-trust-section{font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim2);font-weight:600;margin-bottom:11px}
.ds-trust-card{border:1px solid color-mix(in srgb,var(--amber) 30%,transparent);border-radius:12px;overflow:hidden;margin-bottom:14px}
.ds-trust-card-head{padding:12px 14px;background:color-mix(in srgb,var(--amber) 6%,transparent);display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid color-mix(in srgb,var(--amber) 18%,transparent)}
.ds-trust-card-path{font-family:var(--mono);font-size:12px;color:var(--amber-text)}
.ds-trust-card .ds-diffbody-unified{background:transparent}
.ds-trust-card-note{padding:12px 14px;font-size:12.5px;color:var(--muted);line-height:1.5;text-wrap:pretty;border-top:1px solid var(--line-soft)}
.ds-trust-card-actions{padding:0 14px 14px;display:flex;gap:9px}
.ds-trust-clean{padding:16px;border-radius:12px;background:rgba(48,209,88,0.08);border:1px solid rgba(48,209,88,0.22);color:var(--add-text);font-size:13px;line-height:1.5}
.ds-trust-foot{margin-top:18px;font-size:12px;color:var(--dim2);line-height:1.5;text-wrap:pretty}

/* ---- feedback verification + timeline ---- */
.ds-drawer-tabs{display:flex;padding:10px 14px 0;gap:4px}.ds-drawer-tabs button{flex:1;height:34px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.ds-drawer-tabs button:hover{background:var(--fill-2);color:var(--text)}.ds-drawer-tabs button.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}.ds-drawer-tabs button span{margin-left:4px}
.ds-feedback-filters{display:flex;gap:5px;padding:10px 14px;border-bottom:1px solid var(--line-soft);overflow-x:auto}.ds-feedback-filters button{flex:none;height:26px;border:1px solid var(--line-soft);border-radius:var(--radius-sm);background:transparent;color:var(--muted);font:inherit;font-size:10.5px;font-weight:600;padding:0 8px;cursor:pointer}.ds-feedback-filters button.is-active{border-color:transparent;background:var(--accent-soft);color:var(--accent-text)}
.ds-feedback-list{display:grid;align-content:start;gap:11px}.ds-feedback-card{display:grid;gap:9px;padding:13px;border:1px solid var(--line-soft);border-radius:12px;background:var(--panel3)}.ds-feedback-head{display:flex;align-items:center;gap:8px}.ds-feedback-path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:11.5px;color:var(--text)}
.ds-anchorbadge{flex:none;font-size:9.5px;font-weight:600;padding:3px 6px;border-radius:var(--radius-sm);color:var(--muted);background:var(--fill-2)}.ds-anchorbadge.is-changed,.ds-anchorbadge.is-moved{color:var(--amber-text);background:var(--amber-soft)}.ds-feedback-selection{display:block;max-height:82px;overflow:auto;white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;line-height:1.4;padding:8px 9px;border-radius:7px;background:var(--gutter);color:var(--muted)}
.ds-feedback-message{font-size:12.5px;line-height:1.45}.ds-feedback-reply{padding:10px;border-left:2px solid var(--accent-blue);background:var(--accent-soft);border-radius:0 8px 8px 0;font-size:12px;line-height:1.45}.ds-feedback-reply>span{display:block;margin-bottom:4px;color:var(--accent-text);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.ds-feedback-actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}.ds-drawer-empty{padding:30px 12px;text-align:center;color:var(--muted);font-size:12.5px}
.ds-feedback-compare{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.ds-feedback-compare>div{display:grid;gap:4px;min-width:0}.ds-feedback-compare>div>span{color:var(--dim);font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.ds-feedback-selection.is-current{border:1px solid var(--line-soft);background:var(--panel2);color:var(--text)}@media(max-width:560px){.ds-feedback-compare{grid-template-columns:1fr}}
.ds-challenge-panel{display:grid;align-content:start;gap:16px}.ds-challenge-head strong{font-size:15px}.ds-challenge-head p{margin:5px 0 0;color:var(--muted);font-size:12px;line-height:1.5}.ds-challenge-list{display:grid;gap:7px}.ds-challenge-item{display:flex;align-items:flex-start;gap:9px;padding:11px;border:1px solid var(--line-soft);border-radius:10px;background:var(--fill-1);cursor:pointer}.ds-challenge-item input{margin-top:2px}.ds-challenge-item span{display:grid;gap:3px}.ds-challenge-item strong{font-size:12px}.ds-challenge-item small{color:var(--muted);font-size:11px;line-height:1.4}.ds-challenge-targets{display:grid;gap:6px;padding-top:4px}.ds-challenge-targets>span{color:var(--dim);font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.ds-challenge-target{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;padding:9px 10px;text-align:left;border:1px solid var(--line-soft);border-radius:8px;background:transparent;color:var(--text);cursor:pointer}.ds-challenge-target:hover{background:var(--fill-2)}.ds-challenge-target span{grid-column:1;color:var(--amber-text);font-size:9px;font-weight:700}.ds-challenge-target strong{grid-column:1;overflow:hidden;text-overflow:ellipsis;font-size:11.5px;white-space:nowrap}.ds-challenge-target i{grid-column:2;grid-row:1/span 2;align-self:center;color:var(--accent-text);font-style:normal}

/* ---- misc ---- */
.ds-empty{padding:60px 40px;text-align:center;color:var(--muted)}
.ds-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);width:max-content;max-width:min(540px,calc(100vw - 24px));overflow-wrap:anywhere;
  background:var(--material);border:1px solid var(--line);color:var(--text);font-size:13px;line-height:1.45;
  padding:12px 16px;border-radius:var(--radius-lg);box-shadow:var(--shadow);opacity:0;transition:opacity var(--motion-duration-ui),transform var(--motion-duration-ui);z-index:80;pointer-events:none}
.ds-toast.is-show{opacity:1;transform:translateX(-50%) translateY(0)}
.ds-toast.is-error{border-color:color-mix(in srgb,var(--del) 52%,var(--line));background:color-mix(in srgb,var(--del-bg) 42%,var(--material))}
.ds-selection-menu{position:fixed;z-index:90;min-width:168px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--material);box-shadow:var(--shadow)}
.ds-selection-menu[hidden]{display:none}
.ds-selection-menu button{width:100%;display:block;border:none;border-radius:7px;background:transparent;color:var(--text);font-size:13px;font-weight:700;text-align:left;padding:8px 10px;cursor:pointer}
.ds-selection-menu button:hover{background:var(--fill-2)}
.ds-command-root{position:fixed;inset:0;z-index:100;display:flex;align-items:flex-start;justify-content:center;padding-top:min(16vh,140px)}.ds-command-root[hidden]{display:none}.ds-command-scrim{position:absolute;inset:0;border:0;background:var(--scrim)}.ds-command{position:relative;width:520px;max-width:calc(100vw - 24px);max-height:74vh;overflow:auto;border:1px solid var(--line);border-radius:16px;background:var(--material);box-shadow:0 24px 80px rgba(0,0,0,.48)}
.ds-command-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid var(--line-soft)}.ds-command-head>div{display:grid;gap:3px}.ds-command-head strong{font-size:15px}.ds-command-head span{font-size:11.5px;color:var(--muted)}.ds-command-head>button{width:28px;height:28px;border:1px solid var(--line);border-radius:7px;background:transparent;color:var(--muted);cursor:pointer}.ds-command-list{padding:7px}.ds-command-list>button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:9px;background:transparent;color:var(--text);font:inherit;text-align:left;padding:10px;cursor:pointer}.ds-command-list>button:hover{background:var(--fill-2)}.ds-command-list>button>span{display:grid;gap:2px}.ds-command-list strong{font-size:12.5px}.ds-command-list small{font-size:11px;color:var(--muted)}.ds-command-list kbd{flex:none}.ds-command-foot{display:flex;gap:14px;flex-wrap:wrap;padding:10px 16px 13px;border-top:1px solid var(--line-soft);font-size:10.5px;color:var(--dim)}.ds-command-foot span{display:flex;align-items:center;gap:4px}
.ds-green{color:var(--add)}
.ds-thread-composer{position:sticky;bottom:-14px;z-index:2;align-self:stretch;display:grid;gap:8px;margin:4px -14px -14px;padding:10px 14px 12px;border-top:1px solid var(--line-soft);background:var(--material)}
.ds-thread-ta{flex:1;min-width:0;resize:none;font:inherit;font-size:13px;line-height:1.5;color:var(--text);background:var(--panel3);border:1px solid var(--line-soft);border-radius:10px;padding:9px 12px;max-height:160px}
.ds-thread-ta:focus{outline:none;border-color:var(--accent-blue)}
.ds-thread-ta:disabled{opacity:0.5}
.ds-thread-composer-foot{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px}.ds-thread-actions{display:flex;align-items:center;gap:6px;flex:none}.ds-thread-send{flex:none;align-self:center}.ds-thread-composer .ds-agent-route{min-width:0}.ds-thread-composer .ds-agent-route>.ds-agent-route-icon+span{display:none}.ds-thread-composer .ds-agent-route strong{min-width:0;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ds-thread-composer .ds-agent-route button{padding-inline:0}
.ds-composer-add{color:var(--accent-blue);border-color:var(--accent-blue)}.ds-thread-add{border-color:transparent;color:var(--muted);padding-inline:7px}.ds-thread-add:hover{color:var(--text)}
@media (max-width:620px){.ds-thread-composer-foot{align-items:stretch}}
`;

/* Structural review-session pass. Kept after the legacy component rules so the
   redesign can stay reviewable as one intentional layer while behavior remains
   owned by the existing DOM and client contracts. */
const SESSION_REDESIGN_CSS = `
.ds-top{height:56px;padding:0 14px;gap:10px;background:var(--panel3);border-bottom-color:var(--line)}
.ds-titlewrap{gap:3px}.ds-title{font-size:14px;font-weight:700}.ds-kicker{font-size:9.5px}.ds-crumb-repo{font-size:11.5px}
.ds-sidebar-toggle,.ds-back,.ds-readaloud,.ds-gear{min-height:36px}
.ds-agent-target,.ds-review-menu{height:36px;border-radius:10px;background:var(--fill-1)}
.ds-agent-target{border-color:var(--line-soft)}.ds-review-menu{background:var(--panel2)}
.ds-layout{background:transparent}
.ds-rail{background:var(--surface)}
.ds-railpad{padding:10px 10px 0}.ds-viewtoggle{padding:3px;border:0;border-radius:10px;background:var(--fill-2);box-shadow:inset 0 0 0 1px var(--line-soft)}
.ds-tab{min-height:30px;padding:6px 12px;border:0!important;border-radius:7px;color:var(--dim);font-size:11.5px;letter-spacing:.01em}.ds-tab:hover{background:var(--fill-1);color:var(--text)}.ds-tab.is-active{background:var(--panel4);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.25)}
.ds-readhead{margin:9px 16px 2px;padding:7px 0 13px;border:0;border-radius:0;background:transparent}.ds-readhead-label{font-size:9.5px;letter-spacing:var(--tracking-kicker);color:var(--dim);font-weight:500}.ds-readhead-count{font-size:10.5px;color:var(--dim);font-weight:600}.ds-readhead-track{left:0;right:0;bottom:5px;height:2px;background:var(--fill-3)}
.ds-railscroll{padding:4px 8px 10px}.ds-railsteps{padding-top:2px}.ds-spine{left:25px;top:19px;bottom:19px;width:1px;background:var(--line-soft)}
.ds-railsteps:has(.ds-railchapter)>.ds-spine{display:none}.ds-railchapter{position:relative;margin:3px 0 7px}.ds-railchapter>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:30px;padding:4px 9px;list-style:none;border-radius:7px;color:var(--muted);cursor:pointer;font-size:10px;font-weight:700;letter-spacing:.055em;text-transform:uppercase}.ds-railchapter>summary::-webkit-details-marker{display:none}.ds-railchapter>summary:hover{background:var(--fill-1);color:var(--text)}.ds-railchapter>summary small{color:var(--dim);font-size:9px;font-weight:600;letter-spacing:0;text-transform:none}.ds-railchapter>summary::before{content:'›';width:12px;color:var(--dim);font-size:14px;transform-origin:center;transition:transform var(--motion-duration-fast) ease}.ds-railchapter[open]>summary::before{transform:rotate(90deg)}.ds-railchapter>summary span{margin-right:auto}.ds-railchapter-steps{position:relative}.ds-railchapter-steps::before{content:'';position:absolute;top:8px;bottom:8px;left:17px;width:1px;background:var(--line-soft)}
.ds-stepcard{position:relative;grid-template-columns:42px minmax(0,1fr);margin:0 0 2px;padding:9px 11px 10px 0;border-radius:9px;transition:background .12s ease,color .12s ease}.ds-stepcard::after{content:'';position:absolute;top:7px;bottom:7px;left:0;width:3px;border-radius:0 3px 3px 0;background:transparent}.ds-stepcard:hover{background:var(--fill-1)}
.ds-num{margin:1px 0 0 14px;width:22px;height:22px;border:none;border-radius:0;background:transparent;font-family:var(--font-display);font-size:12px;font-weight:700;letter-spacing:var(--tracking-numeral);color:var(--numeral-dim)}.ds-stepcard-title{font-size:12.5px;line-height:1.34;font-weight:600}.ds-stepcard-fileline{gap:6px;margin-top:2px}.ds-stepcard-file{font-size:10px;line-height:1.3}.ds-railbadge{padding:1px 5px;font-size:8px;border-radius:4px}
.ds-stepcard.is-active{background:var(--fill-2)}.ds-stepcard.is-active::after{background:var(--accent-blue)}.ds-stepcard.is-active .ds-num{background:transparent;border:none;color:var(--accent-blue);box-shadow:none}.ds-stepcard.is-active .ds-stepcard-title{font-weight:700}
.ds-stepcard.is-visited:not(.is-active) .ds-num{background:transparent;border:none;color:var(--muted)}.ds-stepcard.is-visited:not(.is-active) .ds-stepcard-title{color:var(--muted)}
.ds-railstory-node{position:relative}.ds-railbeats{display:none;margin:-2px 8px 10px 42px;padding:3px 0 2px 12px;border-left:1px solid color-mix(in srgb,var(--accent-blue) 28%,var(--line-soft))}.ds-railstory-node.is-active>.ds-railbeats{display:block}
.ds-railbeats-head{display:flex;align-items:center;gap:6px;min-height:27px;padding:0 2px 3px;color:var(--dim);font-size:8.5px;font-weight:700;letter-spacing:.075em;text-transform:uppercase}.ds-railbeats-health{display:inline-flex;align-items:center;gap:4px;color:var(--amber-text);letter-spacing:0;text-transform:none}.ds-railbeats-health i{width:5px;height:5px;border-radius:50%;background:var(--amber)}.ds-railbeats-count{margin-left:auto;font-family:var(--mono);font-size:8.5px;font-weight:600;letter-spacing:0}.ds-railbeats-head .ds-story-tune{margin-left:1px}.ds-railbeats-head .ds-story-tune>summary{width:28px;min-height:28px;padding:0;border:0;border-radius:6px;font-size:9px;letter-spacing:1px}.ds-railbeats-head .ds-story-tune-pop{right:-2px;top:calc(100% + 4px);text-transform:none;letter-spacing:0}
.ds-railbeats-head .ds-story-tune.is-icon.has-health>summary::before{display:none}
.ds-railbeat-list{display:grid;gap:1px}.ds-railbeat{position:relative;display:grid;grid-template-columns:26px minmax(0,1fr);align-items:center;gap:6px;width:100%;min-height:40px;margin:0;padding:5px 7px 5px 0;border:0;border-radius:7px;background:transparent;color:var(--dim);font:inherit;text-align:left;cursor:pointer}.ds-railbeat::before{content:'';position:absolute;left:-13px;top:50%;width:9px;border-top:1px solid var(--line-soft)}.ds-railbeat:hover{background:var(--fill-1);color:var(--muted)}.ds-railbeat-marker{display:grid;place-items:center;width:24px;height:24px;border-radius:6px;color:var(--dim);font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.04em}.ds-railbeat-text{min-width:0;overflow:hidden;text-overflow:ellipsis;color:inherit;font-size:10.5px;font-weight:500;line-height:1.32;white-space:nowrap}.ds-railbeat.is-visited:not(.is-selected){color:var(--muted)}.ds-railbeat.is-visited:not(.is-selected) .ds-railbeat-marker::after{content:'✓';font-family:var(--sans);font-size:9px}.ds-railbeat.is-visited:not(.is-selected) .ds-railbeat-marker{font-size:0}.ds-railbeat.is-selected{background:var(--accent-soft);color:var(--text)}.ds-railbeat.is-selected::before{border-color:var(--accent-blue)}.ds-railbeat.is-selected .ds-railbeat-marker{background:var(--accent-blue);color:var(--on-accent)}.ds-railbeat.is-active .ds-railbeat-text{color:var(--accent-text)}
.ds-stepcard.is-intro{grid-template-columns:42px minmax(0,1fr);margin:9px 10px 2px;padding:9px 10px 10px 0;border:1px solid var(--line-soft);border-radius:10px;background:transparent}.ds-stepcard.is-intro:hover{background:var(--fill-1)}.ds-stepcard.is-intro .ds-num{width:28px;height:28px;margin:0 0 0 10px;border-radius:8px;background:var(--fill-2);color:var(--accent-blue)}.ds-stepcard.is-intro .ds-stepcard-title{font-size:12.5px}.ds-stepcard.is-intro .ds-intro-cardsub{margin-top:2px;font-size:10px;color:var(--dim)}.ds-stepcard.is-intro.is-active{background:var(--fill-2);border-color:var(--line)}.ds-stepcard.is-intro.is-active::after{background:var(--accent-blue)}.ds-stepcard.is-intro.is-active .ds-num{background:var(--accent-soft);color:var(--accent-blue);box-shadow:none}.ds-stepcard.is-intro.is-active .ds-stepcard-title{color:var(--text)}.ds-stepcard.is-intro.is-active .ds-intro-cardsub{color:var(--muted)}
.ds-step[hidden]{display:none!important}
.ds-step.is-code-step{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.ds-step.is-code-step>.ds-step-top{flex:none;padding:16px 22px 0}
.ds-step-title{font-size:18px}.ds-step-meta{margin-bottom:8px}
.ds-review-question{flex:none;display:flex;align-items:center;gap:9px;min-height:38px;margin:9px 22px 3px;padding:3px 2px;color:var(--muted)}.ds-review-question-dot{flex:none;width:6px;height:6px;border-radius:2px;background:var(--accent-blue)}.ds-review-question .ds-reviewfocus{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11.5px;font-weight:500;line-height:1.4;white-space:nowrap}.ds-review-question .ds-story-tune{margin-left:auto}.ds-story-tune.is-icon>summary{position:relative;width:34px;min-height:34px;padding:0;border-color:transparent;font-size:9px;letter-spacing:1px}.ds-story-tune.is-icon.has-health>summary::before{content:'';position:absolute;top:5px;right:5px;width:5px;height:5px;border-radius:50%;background:var(--amber)}
.ds-step.is-code-step>.ds-diffscroll{flex:1;min-width:0;min-height:180px;padding:8px 22px 10px;overflow-x:hidden;overflow-y:auto}
.ds-beatdock{flex:none;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;margin:0 22px 16px;padding:9px 10px 9px 12px;border:1px solid var(--line-soft);border-radius:10px;background:var(--panel2);box-shadow:0 -8px 26px rgba(0,0,0,.08)}.ds-beatdock-count{display:flex;align-items:baseline;gap:3px;min-width:43px;color:var(--dim);font-family:var(--mono);font-size:9px;font-variant-numeric:tabular-nums}.ds-beatdock-count b{color:var(--accent-blue);font-size:10.5px}.ds-beatdock-copy{min-width:0}.ds-beatdock-copy .ds-beats{display:grid}.ds-beatdock-note{display:none;width:100%;min-width:0;margin:0;padding:0;border:0;background:transparent;color:var(--text);font:inherit;font-size:11.5px;font-weight:500;line-height:1.42;text-align:left;cursor:pointer}.ds-beatdock-note.is-selected{display:block}.ds-beatdock-note:hover .ds-beat-text{color:var(--accent-text)}.ds-beatdock-note:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft);border-radius:3px}.ds-beatdock-note .ds-beat-text{display:-webkit-box;min-width:0;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;text-wrap:pretty}.ds-beatdock-note.is-active .ds-beat-text{color:var(--accent-text)}.ds-beatdock-hint{display:block;margin-top:2px;color:var(--dim);font-size:9px}.ds-beatdock-actions{display:flex;align-items:center;gap:4px}.ds-beatdock-actions button{width:36px;height:36px;display:grid;place-items:center;padding:0;border:1px solid var(--line-soft);border-radius:8px;background:transparent;color:var(--muted);font:inherit;cursor:pointer}.ds-beatdock-actions button:hover:not(:disabled){background:var(--fill-2);color:var(--text)}.ds-beatdock-actions button:disabled{opacity:.28;cursor:default}.ds-beatdock-actions .ds-playstep{margin:0;border-color:color-mix(in srgb,var(--accent-blue) 30%,var(--line-soft));background:var(--accent-soft);color:var(--accent-blue);font-size:10px}.ds-beatdock.is-single{grid-template-columns:auto minmax(0,1fr) auto}.ds-beatdock.is-single .ds-why-text{min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-size:11.5px;white-space:nowrap}
.ds-railbeat{min-height:44px}.ds-beatdock-actions button{width:44px;height:44px;border-radius:9px}
/* ---- Filmstrip walkthrough (Signal 3b): rail hidden in Story view; each step is a
   centered stage with an oversized numeral; the bottom numeral thread is the whole nav. ---- */
body:not([data-read-view="files"]) .ds-rail{display:none}
body:not([data-read-view="files"]) .ds-sidebar-toggle{display:none}
#ds-view-tour:not([hidden]){flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.ds-ghost{position:absolute;top:calc(50% - 30px);transform:translateY(-50%);z-index:2;width:52px;display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 6px;border:1px solid var(--line-soft);border-radius:var(--radius-island);background:var(--surface);opacity:.5;color:var(--text-3);cursor:pointer;transition:opacity var(--motion-duration-fast) ease}
.ds-ghost:hover{opacity:.9;color:var(--text-2)}
.ds-ghost[hidden]{display:none}
.ds-ghost-prev{left:6px}.ds-ghost-next{right:6px}
.ds-ghost-num{font-family:var(--font-display);font-size:20px;font-weight:700;letter-spacing:var(--tracking-numeral);line-height:1}
.ds-ghost-label{font-family:var(--mono);font-size:9px;writing-mode:vertical-rl;letter-spacing:.08em}
@media (max-width:1120px){.ds-ghost{display:none}}
#ds-view-tour>:not(.ds-filmthread):not(.ds-ghost):not([hidden]){flex:1;min-height:0;width:100%;max-width:920px;margin-left:auto;margin-right:auto}
.ds-stage-num{font-family:var(--font-display);font-size:52px;font-weight:700;line-height:.85;letter-spacing:var(--tracking-numeral);color:var(--accent);text-shadow:0 4px 30px var(--accent-glow)}
.ds-step.is-code-step>.ds-step-top,.ds-concept-step>.ds-step-top{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:18px;align-items:center}
.ds-step-top>.ds-stage-num{grid-row:1/3;align-self:start;margin-top:2px}
.ds-step-top>.ds-step-meta,.ds-step-top>.ds-step-titlerow{grid-column:2}
.ds-filmthread{flex:none;display:flex;align-items:center;gap:14px;margin:6px 12px 12px;padding:10px 16px;background:var(--surface-2);border:1px solid var(--line-soft);border-radius:var(--radius-island)}
.ds-filmthread-scroll{position:relative;flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;padding:8px 4px 4px}
.ds-filmthread-line{position:absolute;left:0;right:0;top:15px;height:2px;background:linear-gradient(90deg,var(--thread) 0 var(--thread-pct,0%),var(--thread-dim) var(--thread-pct,0%) 100%)}
.ds-filmthread-nodes{position:relative;display:flex;gap:22px;width:max-content;padding:0 4px}
.ds-filmnode{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;flex:none;min-width:44px;padding:0;border:0;background:transparent;cursor:pointer}
.ds-filmnode::after{content:'';position:absolute;inset:-7px 0}
.ds-filmnode-num{font-family:var(--font-display);font-size:15px;font-weight:700;letter-spacing:var(--tracking-numeral);line-height:1;color:var(--numeral-dim);background:var(--surface-2);padding:0 7px;transition:color var(--motion-duration-fast) ease,font-size var(--motion-duration-fast) ease}
.ds-filmnode-label{max-width:74px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:9px;color:var(--text-3)}
.ds-filmnode:hover .ds-filmnode-num{color:var(--text-2)}
.ds-filmnode.is-visited .ds-filmnode-num{color:var(--text-2)}
.ds-filmnode.is-active .ds-filmnode-num{font-size:22px;color:var(--accent)}
.ds-filmnode.is-active .ds-filmnode-label{color:var(--text-2)}
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
.ds-concept-diagram{margin:26px 0 0;padding-top:22px;border-top:1px solid var(--line-soft)}
.ds-concept-diagram-output{display:flex;align-items:center;justify-content:center;min-height:210px;overflow:auto;padding:20px;border:1px solid var(--line-soft);border-radius:12px;background:var(--panel3)}.ds-concept-diagram-output svg{display:block;max-width:100%;height:auto}.ds-concept-diagram-loading{color:var(--dim);font-size:12px}.ds-concept-diagram.is-error .ds-concept-diagram-output{min-height:0;padding:14px;color:var(--amber-text);font-size:12px}
.ds-concept-diagram figcaption{margin-top:9px;color:var(--muted);font-size:11.5px;line-height:1.45}.ds-concept-diagram-source{margin-top:8px;color:var(--muted);font-size:11px}.ds-concept-diagram-source>summary{cursor:pointer}.ds-concept-diagram-source pre{overflow:auto;margin:8px 0 0;padding:12px;border:1px solid var(--line-soft);border-radius:8px;background:var(--panel3);color:var(--muted);font-family:var(--mono);font-size:10.5px;line-height:1.5}
.ds-concept-next{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 18px;width:100%;margin-top:28px;padding:15px 17px;text-align:left;border:1px solid color-mix(in srgb,var(--accent-blue) 34%,var(--line));border-radius:11px;background:var(--accent-soft);color:var(--text);cursor:pointer}.ds-concept-next:hover{border-color:var(--accent-blue);background:color-mix(in srgb,var(--accent-soft) 84%,var(--panel2))}.ds-concept-next-kicker{grid-column:1;color:var(--accent-blue);font-size:9.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.ds-concept-next-title{grid-column:1;overflow:hidden;text-overflow:ellipsis;color:var(--text);font-size:13px;font-weight:700;white-space:nowrap}.ds-concept-next-arrow{grid-column:2;grid-row:1 / span 2;align-self:center;color:var(--accent-blue);font-size:18px}
.ds-diff{border-radius:10px;box-shadow:none}.ds-difftoolbar{background:var(--panel2)}
.ds-introwrap{max-width:980px;padding:46px 48px 64px}.ds-intro-title{font-size:30px}.ds-intro-lede{max-width:68ch;margin-top:16px;color:color-mix(in srgb,var(--text) 72%,transparent);line-height:1.55}.ds-intro-context{max-width:74ch;margin-top:28px;padding-top:22px;border-top:1px solid var(--line-soft)}.ds-intro-context .ds-intro-design{margin-top:0;color:color-mix(in srgb,var(--text) 70%,transparent);line-height:1.54}.ds-intro-context .ds-intro-design+.ds-intro-design{margin-top:12px}
.ds-intro-facts{margin-top:26px;border-radius:11px}.ds-fact{padding:13px 15px}.ds-intro-start{margin-top:24px;border-radius:10px;transition:background-color 120ms ease-out,transform 100ms ease-out}.ds-intro-start:active{transform:scale(.98)}
.ds-freshness-callout{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:22px;padding:13px 14px;border:1px solid color-mix(in srgb,var(--amber) 32%,transparent);border-radius:11px;background:var(--amber-soft);color:var(--amber-text);font-size:12.5px;line-height:1.45}
.ds-freshness-callout b{color:var(--text)}.ds-freshness-callout a{flex:none;padding:8px 11px;border-radius:8px;background:var(--accent);color:var(--on-accent);font-weight:700}
.ds-symbols{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden}.ds-symbols code{max-width:130px;overflow:hidden;text-overflow:ellipsis;padding:3px 6px;border:1px solid var(--line-soft);border-radius:6px;background:var(--fill-1);color:var(--muted);font-family:var(--mono);font-size:9.5px;white-space:nowrap}.ds-fileitem-symbol{min-width:0;max-width:82px;overflow:hidden;text-overflow:ellipsis;color:var(--dim);font-family:var(--mono);font-size:9px;white-space:nowrap}
.ds-filefilter-menu{position:relative}.ds-filefilter-menu>summary{display:flex;align-items:center;justify-content:space-between;gap:6px;height:28px;padding:0 9px;list-style:none;border:1px solid var(--line-soft);border-radius:8px;background:transparent;color:var(--muted);font-size:10.5px;cursor:pointer}.ds-filefilter-menu>summary::-webkit-details-marker{display:none}.ds-filefilter-menu>summary strong{margin-right:auto;color:var(--text)}.ds-filefilter-menu[open] .ds-filefilters{display:flex}.ds-filefilter-menu .ds-filefilters{display:none;padding:7px;border:1px solid var(--line-soft);border-radius:9px;background:var(--panel3);box-shadow:var(--shadow)}
.ds-filepanel-loading,.ds-filepanel-loaderror,.ds-step-loading,.ds-step-loaderror{display:flex;min-height:180px;align-items:center;justify-content:center;gap:10px;padding:24px;color:var(--muted);font-size:12px}.ds-filepanel-loaderror,.ds-step-loaderror{flex-direction:column;color:var(--del-text)}.ds-step-lazy{align-items:center;justify-content:center}
.ds-step-loading{flex-direction:column;align-items:stretch;gap:9px;width:min(520px,100%);margin:0 auto}
.ds-sk{display:block;height:10px;border-radius:var(--radius-sm);background:var(--fill-2);animation:dsShimmer 1.6s ease-in-out infinite}
.ds-sk:nth-child(2){animation-delay:.12s}.ds-sk:nth-child(3){animation-delay:.24s}
.ds-step-loading-tx{margin-top:6px;font-family:var(--mono);font-size:10.5px;color:var(--dim);text-align:center}
@keyframes dsShimmer{0%,100%{opacity:.45}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.ds-sk{animation:none}}
.ds-severity{display:inline-flex;align-items:center;padding:2px 6px;border-radius:var(--radius-sm);font-size:8.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}.ds-severity-blocking{background:var(--del-bg);color:var(--del-text)}.ds-severity-concern{background:var(--amber-soft);color:var(--amber-text)}.ds-severity-nit{background:var(--fill-2);color:var(--muted)}.ds-composer-severity{display:flex;gap:5px;margin:-2px 0 10px}.ds-severity-choice{padding:5px 8px;border:1px solid var(--line-soft);border-radius:var(--radius-sm);background:transparent;color:var(--muted);font:inherit;font-size:10.5px;font-weight:600;cursor:pointer}.ds-severity-choice.is-active{border-color:var(--accent-blue);background:var(--accent-soft);color:var(--accent-text)}
.ds-review-more-list .ds-agent-target{height:auto;max-width:none;align-items:flex-start;border:0;border-radius:10px;white-space:normal}.ds-review-more-list .ds-agent-target-icon{display:inline-flex}
.ds-exclusions{margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}.ds-exclusions-note{margin:0 0 12px;color:var(--muted);font-size:12px;line-height:1.5}.ds-exclusion-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;padding:11px 12px;border:1px solid var(--line-soft);border-radius:10px;background:var(--fill-1)}.ds-exclusion-card+.ds-exclusion-card{margin-top:8px}.ds-exclusion-card>div:first-child{display:grid;gap:4px;min-width:0}.ds-exclusion-card code{overflow:hidden;text-overflow:ellipsis;color:var(--text);font-family:var(--mono);font-size:11px;white-space:nowrap}.ds-exclusion-card span{color:var(--muted);font-size:10.5px}.ds-exclusion-preview{grid-column:1/-1;max-height:360px;overflow:auto;border:1px solid var(--line-soft);border-radius:8px;background:var(--gutter)}.ds-excluded-file-head{display:grid;gap:3px;padding:9px 11px;border-bottom:1px solid var(--line-soft)}.ds-excluded-file-head strong{font-size:11px}.ds-excluded-file-head span{font-size:10px}.ds-excluded-code{display:grid;margin:0;padding:8px 0;white-space:pre}.ds-excluded-code>span{display:grid;grid-template-columns:45px minmax(max-content,1fr);font-family:var(--mono);font-size:10px;line-height:1.5}.ds-excluded-code i{padding-right:10px;text-align:right;color:var(--dim);font-style:normal;user-select:none}.ds-excluded-code code{padding-right:14px;color:var(--muted)}.ds-exclusion-ack{display:flex;align-items:flex-start;gap:9px;margin-top:12px;padding:11px 12px;border:1px solid color-mix(in srgb,var(--amber) 35%,var(--line));border-radius:10px;background:var(--amber-soft);cursor:pointer}.ds-exclusion-ack input{margin-top:2px}.ds-exclusion-ack span{display:grid;gap:2px}.ds-exclusion-ack strong{font-size:12px}.ds-exclusion-ack small{color:var(--amber-text);font-size:10.5px}
body{height:100vh;height:100dvh}.ds-settings-pop,.ds-thread,.ds-composer{max-height:calc(100dvh - 72px)}
button:focus-visible,a:focus-visible,summary:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
@media (prefers-reduced-motion:no-preference){
  .ds-reviewchrome{animation:ds-review-chrome-in var(--motion-duration-spatial) var(--motion-ease-out) backwards}.ds-layout{animation:ds-review-layout-in var(--motion-duration-spatial) var(--motion-ease-out) 35ms backwards}
  .ds-story-tune-pop,.ds-filefilter-menu[open] .ds-filefilters{transform-origin:calc(100% - 14px) -6px;animation:ds-review-pop-in var(--motion-duration-ui) var(--motion-ease-out) backwards}
  .ds-agent-chooser-panel{transform-origin:50% 18%;animation:ds-review-sheet-in var(--motion-duration-spatial) var(--motion-ease-drawer) backwards}.ds-agent-chooser-scrim{animation:ds-review-scrim-in var(--motion-duration-ui) ease backwards}
  .is-workspace-entering[data-ds-enter-direction="1"]{animation:ds-workspace-new-next var(--motion-duration-spatial) var(--motion-ease-drawer) both}.is-workspace-entering[data-ds-enter-direction="-1"]{animation:ds-workspace-new-prev var(--motion-duration-spatial) var(--motion-ease-drawer) both}.is-workspace-entering[data-ds-enter-direction="0"]{animation:ds-workspace-new-fade var(--motion-duration-ui) var(--motion-ease-out) both}
  html[data-ds-motion="view"] .ds-view:not([hidden]),html[data-ds-motion="file"] .ds-filepanel:not([hidden]),html[data-ds-motion="step"] .ds-step:not([hidden]),html[data-ds-motion="mode"] .ds-filepanel-body>[data-diff-inner]:not([hidden]),html[data-ds-motion="mode"] .ds-filepanel-body>[data-split-inner]:not([hidden]),html[data-ds-motion="mode"] .ds-filepanel-body>[data-full-inner]:not([hidden]){view-transition-name:ds-workspace-surface}
  ::view-transition-group(ds-workspace-surface){animation-duration:var(--motion-duration-spatial);animation-timing-function:var(--motion-ease-drawer)}
  ::view-transition-old(ds-workspace-surface),::view-transition-new(ds-workspace-surface){mix-blend-mode:normal;animation-duration:var(--motion-duration-spatial);animation-timing-function:var(--motion-ease-drawer)}
  html[data-ds-motion-direction="1"]::view-transition-old(ds-workspace-surface){animation-name:ds-workspace-old-next}html[data-ds-motion-direction="1"]::view-transition-new(ds-workspace-surface){animation-name:ds-workspace-new-next}
  html[data-ds-motion-direction="-1"]::view-transition-old(ds-workspace-surface){animation-name:ds-workspace-old-prev}html[data-ds-motion-direction="-1"]::view-transition-new(ds-workspace-surface){animation-name:ds-workspace-new-prev}
  html[data-ds-motion-direction="0"]::view-transition-old(ds-workspace-surface){animation-name:ds-workspace-old-fade}html[data-ds-motion-direction="0"]::view-transition-new(ds-workspace-surface){animation-name:ds-workspace-new-fade}
  @keyframes ds-review-chrome-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}@keyframes ds-review-layout-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
  @keyframes ds-review-pop-in{from{opacity:0;clip-path:inset(0 0 100% 72% round 10px);transform:translateY(-5px) scale(.97)}to{opacity:1;clip-path:inset(0 round 10px);transform:none}}
  @keyframes ds-review-sheet-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}@keyframes ds-review-scrim-in{from{opacity:0}to{opacity:1}}
  @keyframes ds-workspace-old-next{to{opacity:0;transform:translateX(-6px)}}@keyframes ds-workspace-new-next{from{opacity:0;transform:translateX(10px)}}@keyframes ds-workspace-old-prev{to{opacity:0;transform:translateX(6px)}}@keyframes ds-workspace-new-prev{from{opacity:0;transform:translateX(-10px)}}@keyframes ds-workspace-old-fade{to{opacity:0;transform:scale(.997)}}@keyframes ds-workspace-new-fade{from{opacity:0;transform:scale(1.003)}}
}
@media (max-width:1080px){
  .ds-step.is-code-step{display:flex;overflow:hidden}.ds-step.is-code-step>.ds-step-top{padding:16px 24px 0}
  .ds-review-question{margin:8px 24px 2px}.ds-step.is-code-step>.ds-diffscroll{padding:8px 24px 10px;min-height:180px}.ds-beatdock{margin:0 24px 16px}
}
@media (max-width:820px){.ds-agent-target-prefix,.ds-agent-target-sep{display:none}.ds-agent-target{max-width:150px}.ds-review-menu-count-label{display:none}}
@media (max-width:760px){.ds-symbols{display:none}}
@media (max-width:620px){.ds-top{height:52px}.ds-layout>.ds-rail,body:not(.ds-rail-collapsed) .ds-rail-scrim{top:52px}.ds-freshness-callout{align-items:stretch;flex-direction:column}.ds-freshness-callout a{text-align:center}.ds-introwrap{padding:32px 20px 48px}.ds-intro-title{font-size:27px;line-height:1.1}.ds-intro-lede{font-size:15.5px;line-height:1.52}.ds-intro-start{display:flex;width:100%;margin-top:22px;padding:13px 16px}.ds-intro-context{margin-top:26px;padding-top:20px}.ds-concept-step>.ds-step-top{padding:14px 16px 0}.ds-concept-scroll{padding:12px 12px 28px}.ds-concept-document{padding:25px 20px 28px;border-radius:12px}.ds-concept-title{font-size:25px}.ds-concept-body{font-size:14px}.ds-concept-diagram-output{min-height:160px;padding:12px}.ds-exclusion-card{grid-template-columns:1fr}.ds-exclusion-card>.ds-btn{justify-self:start}.ds-story-tune-long{display:none}.ds-story-tune-pop{max-width:min(236px,calc(100vw - 48px))}.ds-step.is-code-step>.ds-step-top{padding:13px 16px 0}.ds-review-question{margin:6px 16px 2px}.ds-step.is-code-step>.ds-diffscroll{padding:6px 16px 8px}.ds-beatdock{margin:0 16px 12px;padding-left:10px}.ds-beatdock-hint{display:none}}
@media (max-width:470px){.ds-step-meta{gap:6px}.ds-step-count{white-space:nowrap}.ds-step-meta>.ds-dot,.ds-step-meta>.ds-flowchip,.ds-step-meta>.ds-step-pos{display:none}.ds-step.is-code-step .ds-full-diff{display:none}.ds-beatdock{grid-template-columns:auto minmax(0,1fr);row-gap:7px}.ds-beatdock-actions{grid-column:1/-1;justify-content:flex-end;padding-top:6px;border-top:1px solid var(--line-soft)}.ds-review-question .ds-reviewfocus{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal}.ds-review-question{align-items:flex-start;padding-top:7px}}
@media (max-width:720px){.ds-back{min-width:36px}.ds-settings-wrap{display:flex}.ds-readaloud{display:none}.ds-settings-wrap .ds-gear{display:flex}.ds-help{display:none}}
@media (prefers-reduced-motion:reduce){.ds-intro-start,.ds-sidebar-toggle,.ds-back,.ds-readaloud,.ds-gear,.ds-agent-target,.ds-review-menu,.ds-iconbtn,.ds-tab,.ds-playstep,.ds-concept-next,.ds-fileitem,.ds-filetree-dir>summary{transition:none!important}.ds-intro-start:active{transform:none}.ds-command-root *{animation:none!important}.ds-toast{animation:none!important;transform:translateX(-50%);transition:opacity 200ms ease}.ds-toast.is-show{transform:translateX(-50%)}.ds-drawer{transform:none;opacity:0;transition:opacity 200ms ease}.ds-drawer-root.is-open .ds-drawer{transform:none;opacity:1}.ds-drawer-scrim{transition:opacity 200ms ease}.ds-readhead-fill{transition:none!important}.ds-agent-target.is-busy .ds-agent-target-icon,.ds-readaloud.is-loading .ds-readaloud-ico,.ds-preview.is-loading .ds-preview-ico,.ds-voice-card.is-loading .ds-voice-badge,.ds-agent-task-spinner,.ds-composer{animation:none!important}}
@media (prefers-reduced-transparency:reduce){.ds-top,.ds-drawer,.ds-settings-pop,.ds-review-menu-pop,.ds-toast{background:var(--panel3);backdrop-filter:none;-webkit-backdrop-filter:none}}
@media (prefers-contrast:more){:root{--line:color-mix(in srgb,var(--text) 42%,transparent);--line-soft:color-mix(in srgb,var(--text) 28%,transparent)}.ds-top,.ds-reviewstatusbar{background:var(--panel3)}.ds-intro-lede{color:var(--text)}}

/* The review frame keeps only navigation, scope, theme, and the decision entry
   point visible. Detailed status belongs inside Review, next to its actions. */
.ds-ui-icon{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;flex:none}.ds-ui-icon svg{display:block;width:100%;height:100%}
.ds-reviewchrome{height:56px;flex:none;display:flex;align-items:center;background:var(--surface);border:1px solid var(--line-soft);border-radius:var(--radius-island);overflow:hidden;z-index:9}
.ds-reviewchrome-rail{display:flex;align-items:center;min-width:0}
.ds-reviewchrome-nav{display:flex;align-items:center;gap:3px;padding:0 11px}.ds-reviewchrome-nav .ds-sidebar-toggle{width:36px;height:36px}.ds-reviewchrome-nav .ds-back{height:36px;padding-inline:7px 10px;gap:5px}
.ds-reviewchrome .ds-sidebar-toggle.is-active{background:transparent;color:var(--muted)}
.ds-reviewchrome-main{flex:1;display:flex;align-items:center;min-width:0;padding:0 16px 0 18px}
.ds-reviewchrome-main .ds-titlewrap{gap:3px}.ds-reviewchrome-main .ds-title{font-size:15px;font-weight:700;letter-spacing:-.01em}.ds-reviewchrome-subtitle{overflow:hidden;color:var(--dim);font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}.ds-reviewchrome-subtitle span{margin:0 3px;color:var(--faint)}.ds-reviewchrome-subtitle b{color:var(--muted);font-family:var(--mono);font-size:10px;font-weight:600}
.ds-reviewchrome-mobile-nav{display:none;align-items:center;gap:1px;margin-right:6px}.ds-reviewchrome-mobile-nav .ds-sidebar-toggle,.ds-reviewchrome-mobile-nav .ds-back{width:36px;height:36px;padding:0;justify-content:center}
.ds-reviewchrome-utilities{display:flex;align-items:center;gap:10px;flex:none;margin-left:14px}.ds-reviewchrome-utilities .ds-theme-toggle{width:36px;height:36px;min-height:36px}
.ds-reviewchrome-utilities .ds-readaloud-primary{display:flex;width:auto;height:36px;min-height:36px;gap:7px;padding:0 11px 0 8px;border:1px solid color-mix(in srgb,var(--md-primary) 28%,var(--line));border-radius:10px;background:color-mix(in srgb,var(--md-primary) 10%,var(--panel3));color:var(--text);font-size:12px;font-weight:700;letter-spacing:-.01em}
.ds-reviewchrome-utilities .ds-readaloud-primary:hover{border-color:color-mix(in srgb,var(--md-primary) 48%,var(--line));background:color-mix(in srgb,var(--md-primary) 16%,var(--panel3))}
.ds-reviewchrome-utilities .ds-readaloud-primary:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-reviewchrome-utilities .ds-readaloud-primary .ds-readaloud-ico{width:20px;height:20px;flex:none;font-size:8px;box-shadow:0 1px 4px color-mix(in srgb,var(--md-primary) 34%,transparent)}
.ds-reviewchrome-utilities .ds-readaloud-primary.is-active{border-color:color-mix(in srgb,var(--md-primary) 36%,var(--line));background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
.ds-reviewchrome-utilities .ds-readaloud-primary.is-active .ds-readaloud-ico{background:var(--md-on-secondary-container);color:var(--md-secondary-container)}
.ds-reviewchrome-utilities .ds-readaloud-primary.is-active .ds-readaloud-ico.is-stop{background:transparent;color:var(--md-error);box-shadow:none}
.ds-reviewchrome-utilities .ds-readaloud-primary.is-active .ds-readaloud-ico.is-stop::before{content:"";width:14px;height:14px;border-radius:3px;background:currentColor;box-shadow:0 1px 2px color-mix(in srgb,var(--md-error) 34%,transparent)}
.ds-readaloud-label{white-space:nowrap}
.ds-reviewchrome .ds-actions{gap:7px}
.ds-reload-diff{height:36px;display:inline-flex;align-items:center;gap:7px;padding:0 9px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}.ds-reload-diff:hover{background:var(--fill-2);color:var(--text)}.ds-reload-diff:disabled{opacity:.7}.ds-reload-diff.is-loading .ds-reload-icon{animation:dsReloadSpin .7s linear infinite}@keyframes dsReloadSpin{to{transform:rotate(360deg)}}
.ds-review-menu{height:36px;gap:7px;padding:0 10px;border-radius:9px;background:var(--fill-1);font-size:12px;font-weight:700}.ds-review-menu:hover,.ds-review-menu.is-open{background:var(--fill-2)}.ds-review-menu.is-clean{border-color:color-mix(in srgb,var(--green) 34%,var(--line));background:color-mix(in srgb,var(--add-bg) 42%,var(--fill-1));color:var(--add-text)}
.ds-review-menu-icon{width:17px;height:17px;color:var(--muted)}.ds-review-menu.is-clean .ds-review-menu-icon{color:var(--green)}.ds-review-menu-caret{width:15px;height:15px;transform:none;color:var(--dim)}
.ds-review-menu-count{height:19px;min-width:19px;padding:0 5px;background:var(--fill-3);font-size:10px}.ds-review-menu-count[hidden]{display:none}.ds-review-menu-count-label{display:none}
.ds-review-menu-title{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ds-live-banner{position:fixed;z-index:8;top:76px;left:calc(var(--ds-rail-width,316px) + 28px);right:24px;min-height:48px;display:flex;align-items:center;gap:12px;max-width:760px;padding:4px 5px 4px 14px;border:1px solid color-mix(in srgb,var(--md-primary) 34%,var(--line));border-radius:10px;background:color-mix(in srgb,var(--md-primary) 10%,var(--panel3));box-shadow:var(--shadow);color:var(--text);font-size:12.5px}.ds-live-banner[hidden]{display:none}.ds-live-banner [data-live-message]{flex:1;line-height:1.4}.ds-live-banner button{min-width:44px;min-height:44px;border:0;border-radius:8px;background:transparent;color:var(--md-primary);font:inherit;font-weight:700;cursor:pointer}.ds-live-banner button:hover{background:color-mix(in srgb,var(--md-primary) 12%,transparent)}.ds-live-banner [data-live-dismiss]{min-width:44px;color:var(--muted);font-size:20px;font-weight:500}
body.ds-rail-collapsed .ds-reviewchrome{grid-template-columns:0 minmax(0,1fr)}body.ds-rail-collapsed .ds-reviewchrome-rail{display:none}body.ds-rail-collapsed .ds-reviewchrome-mobile-nav{display:flex}
body.ds-rail-collapsed .ds-live-banner{left:16px}

@media (max-width:900px){
  .ds-review-menu{width:auto;padding:0 9px}.ds-review-menu>span.ds-review-menu-label{display:none}.ds-review-menu-icon{display:inline-flex!important}.ds-review-menu-caret{display:inline-flex!important}.ds-reload-diff>span[data-reload-label]{display:none}
}
@media (max-width:720px){
  .ds-reviewchrome,body.ds-rail-collapsed .ds-reviewchrome{height:56px;grid-template-columns:minmax(0,1fr);grid-template-rows:56px}.ds-reviewchrome-main{grid-column:1;grid-row:1;padding:0 8px 0 7px}.ds-reviewchrome-mobile-nav{display:flex}.ds-reviewchrome-main .ds-title{font-size:13.5px}.ds-reviewchrome-subtitle{font-size:10px}.ds-reviewchrome-utilities{gap:5px;margin-left:6px}.ds-reviewchrome .ds-actions{gap:2px}.ds-reload-diff,.ds-review-menu{min-width:44px;height:44px;justify-content:center;padding:0 10px}.ds-review-menu-caret{display:none!important}
  .ds-reviewchrome-utilities .ds-theme-toggle{width:44px;height:44px;min-height:44px}
  .ds-reviewchrome-utilities .ds-readaloud-primary{display:flex;width:44px;height:44px;min-height:44px;padding:0;justify-content:center;border-radius:11px}.ds-reviewchrome-utilities .ds-readaloud-primary .ds-readaloud-label{display:none}
  .ds-reviewchrome-rail{display:none;position:fixed;top:0;left:0;z-index:11;width:min(var(--ds-rail-width,240px),calc(100vw - 48px));height:56px;grid-template-columns:1fr;grid-template-rows:56px;border-bottom:1px solid var(--line);box-shadow:var(--shadow)}.ds-reviewchrome-rail .ds-reviewchrome-nav{padding-left:7px}body:not(.ds-rail-collapsed) .ds-reviewchrome-rail{display:grid}
  .ds-live-banner,body.ds-rail-collapsed .ds-live-banner{left:8px;right:8px;top:64px}
  body:not(.ds-rail-collapsed) .ds-reviewchrome-rail .ds-sidebar-toggle.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
  .ds-layout>.ds-rail{top:56px}.ds-rail-scrim,body:not(.ds-rail-collapsed) .ds-rail-scrim{top:56px}
}
@media (max-width:470px){.ds-reviewchrome-main .ds-titlewrap{max-width:140px}.ds-review-menu-count{position:absolute;top:1px;right:0}}
@media (prefers-reduced-motion:reduce){.ds-reload-diff.is-loading .ds-reload-icon{animation:none}.ds-live-banner{transition:none!important}}
@media (prefers-reduced-transparency:reduce){.ds-reviewchrome,.ds-reviewchrome-rail{background:var(--panel3)}}
@media (prefers-contrast:more){.ds-reviewchrome-main,.ds-reviewchrome-rail{border-color:var(--line)}}
`;

export const PAGE_CSS = sharedTokens() + themeControlStyles() + PAGE_CSS_CORE + DIFF_CSS + SESSION_REDESIGN_CSS;

// No backticks and no ${} below — safe to embed in a template literal.
const PAGE_JS_HEAD = `
(function(){
  var API='/api/comments';
  var ADDRESS_API='/api/address';
  var CODEX_TASK_API='/api/codex/tasks';
  var CODEX_MODEL_API='/api/codex/models';
  var agentBusy=false;
  var BRAND='diffStory';
  var FLAVOR={change:{label:'Change request',ico:'◆'},question:{label:'Question',ico:'?'},nit:{label:'Nit',ico:'○'}};
  var SEVERITY={blocking:'Blocking',concern:'Concern',nit:'Minor'};
  var STATUS={open:'Open',addressed:'Needs verification',resolved:'Resolved'};
  var tourView,filesView,drawer,feedbackDrawer,commandRoot,toastEl,selectionMenu,selectionContext=null,selectionRects=[],selectionContextMenuPending=false,stepPanels,stepCards,total=1,active=0,visited={0:true},toastTimer,toastSequence=0,speechTimer,storyFocusIndex=-1,storyFocusGroup=-1,voiceFocusIndex=-1,voiceFocusGroup=-1,voiceFocusTimers=[],voiceSequenceToken=0,currentSpeechStep=-1,currentSpeechUnit=-1,currentSpeechManual=false,sidebarReturnFocus=null,reviewMenuReturnFocus=null,commandReturnFocus=null,agentChooserReturnFocus=null,agentChooserRequest=0,activeCommentSurface=null,commentSurfaceReturnFocus=null,commentSurfaceSeq=0,commentSurfaceCollapsedSidebar=false,composerReturnFocus=null,composerCollapsedSidebar=false,modalStack=[],modalBackgroundSnapshots=[];
  var filePanels=[],fileItems=[],selectedFile=-1,sidebarResizing=false,sidebarResizeFrame=0,sidebarResizeClientX=null,splitBody=null,splitHolder=null,splitResizeFrame=0,splitResizeClientX=null,focusScrollTimer=0,focusScrollFrame=0,readAloud=false,rate=1.05,voicePreset='story',voiceEngine='browser',sayVoice='samantha',kokoroVoice='af_heart',voices=[],activeUtterance=null,localAudio=null,localAudioToken=0,speechAbort=null,speechLoadingLabel='',speechLoadingMode='',speechLoadingEngine='',speechLoadingVoice='',prefetchedSpeech={},speechPrefetchAbort=null,speechPrefetchKey='';
  var activeFileFilter='all',restoringReviewPosition=false,reviewSaveTimer=null,reviewPositionReady=false;
  var mermaidModulePromise=null,mermaidRenderId=0;
  var liveEventSource=null,liveDisconnectTimer=null,liveOriginalStoryFreshness='',liveIssues={diff:false,story:false,disconnected:false},liveGenerations={diff:0,story:0,disconnected:0},liveDismissed={diff:0,story:0,disconnected:0};
  var workspaceTransition=null,workspaceFallbackTimer=0,workspaceTransitionToken=0;
  var VOICE_PRESETS={
    story:{
      label:'Story',badge:'S',rate:1,pitch:1,volume:1,
      sample:'Guided review. I changed this helper so the caller can pass the missing value clearly.',
      prefer:[/natural/,/premium/,/enhanced/,/neural/,/google us english/,/microsoft.*(aria|jenny|guy)/,/samantha/,/alex/],
      avoid:[/compact/,/novelty/,/robot/,/fred/,/ralph/,/whisper/,/zarvox/]
    },
    flirty:{
      label:'Warm',badge:'F',rate:0.98,pitch:1.04,volume:1,
      sample:'Warm mode. I made this path smoother and easier to review.',
      prefer:[/ava/,/samantha/,/allison/,/susan/,/serena/,/karen/,/moira/,/tessa/,/zira/,/jenny/,/aria/],
      avoid:[/alex/,/daniel/,/tom/,/david/,/mark/,/guy/,/brian/,/fred/,/ralph/,/bruce/,/reed/,/robot/,/compact/]
    },
    bass:{
      label:'Deep',badge:'M',rate:0.95,pitch:0.92,volume:1,
      sample:'Deep mode. I changed this branch because the old path missed the edge case.',
      prefer:[/alex/,/daniel/,/tom/,/david/,/mark/,/guy/,/brian/],
      avoid:[/ava/,/samantha/,/allison/,/susan/,/serena/,/victoria/,/karen/,/moira/,/tessa/,/zira/,/jenny/,/aria/,/fred/,/ralph/,/bruce/,/reed/,/robot/,/compact/]
    },
    system:{
      label:'System',badge:'SYS',rate:1.35,pitch:0.94,volume:1,
      sample:'System mode. Plain browser voice.',
      prefer:[],
      avoid:[]
    }
  };
  var SAY_VOICES={
    samantha:{label:'Samantha',sample:'Samantha voice. I changed this helper so the caller can pass the missing value clearly.'},
    daniel:{label:'Daniel',sample:'Daniel voice. I changed this branch because the old path missed the edge case.'}
  };
  var KOKORO_VOICES={
    af_heart:{label:'Heart',sample:'Heart voice. I changed this helper so the caller can pass the missing value clearly.'},
    af_bella:{label:'Bella',sample:'Bella voice. I made this review note easier to follow without hiding the important code path.'},
    af_nicole:{label:'Nicole',sample:'Nicole voice. I tightened this branch so the edge case reads cleanly.'},
    af_sarah:{label:'Sarah',sample:'Sarah voice. I changed this step because the previous flow skipped the useful context.'},
    am_adam:{label:'Adam',sample:'Adam voice. I updated this helper so the caller gets a predictable result.'},
    am_onyx:{label:'Onyx',sample:'Onyx voice. I changed this branch because the old path missed the edge case.'},
    bf_emma:{label:'Emma',sample:'Emma voice. I made this walkthrough calmer and easier to inspect.'},
    bm_daniel:{label:'Daniel',sample:'Daniel voice. I moved this check closer to the place where the value is used.'}
  };

  function $(s,r){return (r||document).querySelector(s);}
  function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function closest(n,s){return n&&n.closest?n.closest(s):null;}
  function reviewPageUrl(path){
    var url=new URL(path,location.href),token=document.body.getAttribute('data-review-page-token')||'';
    if(token)url.searchParams.set('page',token);
    return url.pathname+url.search;
  }
  var LIVE_BANNER_KINDS=[
    {kind:'diff',message:'The diff changed since this review loaded.'},
    {kind:'story',message:'The guided story was updated.'},
    {kind:'disconnected',message:'Live updates disconnected. Reload to reconnect safely.'}
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
      var reviewButton=$('[data-review-menu]');if(reviewButton)reviewButton.setAttribute('data-story-freshness',freshness);
      refreshCount();
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
    var target=filesView&&!filesView.hidden?filesView:tourView;
    if(target&&target.focus){try{target.focus({preventScroll:true});}catch(e){target.focus();}}
  }
  function collapseCompactSidebar(){if(compactScreen()){closeCompactSidebar(false);focusActiveReview();}}
  function setReviewMenu(open){
    var pop=$('[data-review-menu-pop]'),btn=$('[data-review-menu]');
    if(!pop||!btn)return;
    var wasOpen=!pop.hidden,activeElement=document.activeElement,restore=!open&&wasOpen&&pop.contains(activeElement);
    if(open)reviewMenuReturnFocus=btn;
    pop.hidden=!open;
    btn.classList.toggle('is-open',open);
    btn.setAttribute('aria-expanded',open?'true':'false');
    if(open)setTimeout(function(){pop.focus();},0);
    else if(restore&&reviewMenuReturnFocus&&reviewMenuReturnFocus.focus)reviewMenuReturnFocus.focus();
  }
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
    var selectedText=(code.textContent||'').replace(/\s+$/,'');
    return {anchorRow:row,file:file,line:line,side:side,step:row.getAttribute('data-step')||'',selectedText:selectedText,selection:{startLine:line,endLine:line,startColumn:1,endColumn:selectedText.length+1}};
  }
  function ensureSelectionMenu(){
    if(selectionMenu)return selectionMenu;
    selectionMenu=$('[data-selection-menu]')||el('div','ds-selection-menu');
    selectionMenu.setAttribute('data-selection-menu','');
    selectionMenu.setAttribute('role','menu');
    if(!selectionMenu.children.length){
      [
        ['question','Ask'],
        ['change','Ask for change'],
        ['nit','Nit']
      ].forEach(function(item){
        var b=el('button','',item[1]);
        b.setAttribute('type','button');
        b.setAttribute('role','menuitem');
        b.setAttribute('data-selection-action',item[0]);
        selectionMenu.appendChild(b);
      });
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

  function setView(v){
    var previous=filesView&&!filesView.hidden?'files':'tour';
    var update=function(){
      document.body.setAttribute('data-read-view',v);
      if(tourView)tourView.hidden=v!=='tour';
      if(filesView)filesView.hidden=v!=='files';
      $all('.ds-tab').forEach(function(t){var on=t.getAttribute('data-view')===v;t.classList.toggle('is-active',on);t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;});
      $all('[data-rail]').forEach(function(r){r.hidden=r.getAttribute('data-rail')!==v;});
    };
    if(reviewPositionReady&&previous!==v)runWorkspaceTransition('view',v==='files'?1:-1,update);else update();
    revealResumeReview();
    if(v==='files'&&selectedFile<0)selectFile(0);
    if(v!=='tour'){cancelFocusScroll();readAloud=false;try{localStorage.setItem('ds-readaloud','');}catch(e){}cancelSpeech();}
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
        mountThreads(fresh);renderConceptDiagrams(fresh);$all('.ds-filepanel,.ds-diff',fresh).forEach(updateChangeNav);
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
    if(!readAloud)clearVoiceFocus();
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
      var thread=$('[data-filmthread]');
      if(thread){var an=$('[data-thread-node="'+i+'"]',thread),scroll=$('.ds-filmthread-scroll',thread);
        // Fill boundary lands on the active numeral's center, not an index ratio —
        // nodes are left-packed at max-content, so a percentage of the line drifts.
        if(an)thread.style.setProperty('--thread-pct',(an.offsetLeft+an.offsetWidth/2)+'px');
        if(an&&scroll){var sr=scroll.getBoundingClientRect(),ar=an.getBoundingClientRect();scroll.scrollLeft+=(ar.left+ar.width/2)-(sr.left+sr.width/2);}}
      var gp=$('[data-ghost-prev]'),gn=$('[data-ghost-next]');
      // Ghost cards preview the neighboring step: numeral + its short file label.
      var ghostLabel=function(k){var src=$('[data-thread-node="'+k+'"] .ds-filmnode-label');return src?src.textContent:'';};
      if(gp){if(i>0){gp.hidden=false;gp.setAttribute('data-goto-step',String(i-1));var gpn=$('.ds-ghost-num',gp);if(gpn)gpn.textContent=i-1===0?'◆':String(i-1).padStart(2,'0');var gpl=$('.ds-ghost-label',gp);if(gpl)gpl.textContent=i-1===0?'overview':(ghostLabel(i-1)||'prev');}else gp.hidden=true;}
      if(gn){if(i<total-1){gn.hidden=false;gn.setAttribute('data-goto-step',String(i+1));var gnn=$('.ds-ghost-num',gn);if(gnn)gnn.textContent=String(i+1).padStart(2,'0');var gnl=$('.ds-ghost-label',gn);if(gnl)gnl.textContent=ghostLabel(i+1)||'next';}else gn.hidden=true;}
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
    if(ap&&i>0)restoreStoryLens(ap);
    if(i===0)clearStoryFocus();
    var storyFocused=ap&&i>0?selectStoryFocus(i,0,true):false;
    if(ap&&!storyFocused)jumpToFirstChange($('.ds-diff',ap));
    if(autoSpeak!==false){var spoke=speakStep(i);if(!spoke)prefetchNextSpeech(i);}
    saveReviewPositionSoon();
  }
  function setActive(i,autoSpeak){
    if(i<0)i=0;if(i>total-1)i=total-1;
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
  function storyLensLabel(lens){return lens==='focus'?'Active beat at full strength':'All authored rows';}
  function setStoryLens(panel,lens,persist){
    if(!panel||['focus','full'].indexOf(lens)<0)return;
    panel.setAttribute('data-story-lens',lens);
    $all('.ds-storylens [data-story-lens]',panel).forEach(function(button){var on=button.getAttribute('data-story-lens')===lens;button.classList.toggle('is-active',on);button.setAttribute('aria-pressed',on?'true':'false');});
    var hint=$('[data-difthint]',panel);if(hint)hint.textContent=storyLensLabel(lens);
    if(persist!==false)try{localStorage.setItem('ds-story-lens',lens);}catch(e){}
  }
  function restoreStoryLens(panel){
    var lens='focus';try{lens=localStorage.getItem('ds-story-lens')||'focus';}catch(e){}
    if(lens!=='focus'&&lens!=='full')lens='focus';
    setStoryLens(panel,lens,false);
  }
  function updateBeatNav(panel,selected){
    var beats=$all('[data-story-beat]',panel),current=$('[data-beat-current]',panel),prev=$('[data-beat-move="-1"]',panel),next=$('[data-beat-move="1"]',panel);
    var index=beats.findIndex(function(beat){return parseInt(beat.getAttribute('data-focus-group')||'-1',10)===selected;});if(index<0)index=0;
    if(current)current.textContent=String(index+1).padStart(2,'0');if(prev)prev.disabled=index<=0;if(next)next.disabled=index>=beats.length-1;
    var panelIndex=parseInt(panel.getAttribute('data-step-panel')||'-1',10),railCurrent=$('[data-story-step-node="'+panelIndex+'"] [data-rail-current]');
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
    var target=rows[Math.floor((rows.length-1)/2)];if(!target)return;
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
    var status=$('[data-story-focus-status]',panel);if(!status)return;
    var destination=beat.getAttribute('data-focus-destination')||'';
    var label=beat.getAttribute('data-focus-group')||'0';
    status.textContent='';
    setTimeout(function(){status.textContent='Story beat '+(parseInt(label,10)+1)+' focused at '+destination;},0);
  }
  function selectStoryFocus(stepIndex,group,shouldScroll){
    var panel=stepPanels&&stepPanels[stepIndex];
    if(!panel||!panel.hasAttribute('data-story-focus'))return false;
    var groups=focusGroupsForPanel(panel);if(!groups.length)return false;
    var selected=groups.indexOf(group)>=0?group:groups[0],rows=focusRowsForGroup(panel,selected);if(!rows.length)return false;
    clearStoryFocus();
    storyFocusIndex=stepIndex;storyFocusGroup=selected;panel.classList.add('is-story-active');
    rows.forEach(function(r){r.classList.add('is-story-focus');});
    var beat=$('[data-story-beat][data-focus-group="'+selected+'"]',panel);
    if(beat){beat.classList.add('is-selected');beat.setAttribute('aria-pressed','true');announceStoryFocus(panel,beat);}
    var railBeat=$('[data-rail-beat][data-rail-step-index="'+stepIndex+'"][data-focus-group="'+selected+'"]');
    if(railBeat){railBeat.classList.add('is-selected');railBeat.setAttribute('aria-pressed','true');}
    updateBeatNav(panel,selected);
    if(shouldScroll!==false)centerFocusRows(rows,false);
    return true;
  }
  function moveStoryBeat(button,delta){
    var panel=closest(button,'.ds-step');if(!panel)return false;
    var beats=$all('[data-story-beat]',panel),index=beats.indexOf(button);if(index<0||!beats.length)return false;
    var next=Math.max(0,Math.min(beats.length-1,index+delta)),target=beats[next];
    var stepIndex=parseInt(panel.getAttribute('data-step-panel')||'0',10);
    var group=parseInt(target.getAttribute('data-focus-group')||'0',10);
    selectStoryFocus(stepIndex,group,true);target.focus();return true;
  }
  function movePanelBeat(panel,delta){
    if(!panel)return false;var selected=$('[data-story-beat].is-selected',panel)||$('[data-story-beat]',panel);if(!selected)return false;
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
    return Math.max(2400,Math.round(words/Math.max(80,155*rate)*60000));
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
    var beat=group==null?null:$('[data-focus-group="'+group+'"]',panel);
    if(beat)beat.classList.add('is-active');
    var railBeat=group==null?null:$('[data-rail-beat][data-rail-step-index="'+stepIndex+'"][data-focus-group="'+group+'"]');
    if(railBeat)railBeat.classList.add('is-active');
  }
  function focusGroupForChar(stepIndex,charIndex,text){
    var panel=stepPanels&&stepPanels[stepIndex];if(!panel)return 0;
    var count=Math.max(1,focusGroupsForPanel(panel).length);
    var ratio=Math.max(0,Math.min(0.999,(charIndex||0)/Math.max(1,(text||'').length)));
    return Math.min(count-1,Math.floor(ratio*count));
  }
  function updateVoiceFocusForChar(stepIndex,charIndex,text){
    applyVoiceFocusGroup(stepIndex,focusGroupForChar(stepIndex,charIndex,text));
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

  function speak(text,opts){
    if(voiceEngine==='kokoro')return speakKokoroAudio(text,opts);
    if(voiceEngine==='say')return speakLocalAudio(text,opts);
    var synth=window.speechSynthesis;if(!synth||!text)return false;
    opts=opts||{};
    clearVoiceFocus();
    if(speechTimer){clearTimeout(speechTimer);speechTimer=null;}
    synth.cancel();
    activeUtterance=null;
    var u=new SpeechSynthesisUtterance(text);
    var preset=VOICE_PRESETS[opts.preset||voicePreset]||VOICE_PRESETS.story;
    u.rate=Math.max(0.5,Math.min(1.75,(opts.rate||rate)*preset.rate));
    u.pitch=preset.pitch;
    u.volume=preset.volume;
    var v=preset===VOICE_PRESETS.system?null:pickVoice(opts.preset||voicePreset);if(v)u.voice=v;
    var btn=$('[data-readaloud]');
    u.onstart=function(){activeUtterance=u;if(opts.stepIndex!=null){if(opts.focusGroup!=null)setActiveBeat(opts.stepIndex,opts.focusGroup);else startVoiceFocusSequence(opts.stepIndex,text);}if(btn)btn.classList.add('is-speaking');updateReadAloudButton();};
    u.onboundary=function(e){if(opts.stepIndex!=null&&opts.focusGroup==null&&e&&typeof e.charIndex==='number')updateVoiceFocusForChar(opts.stepIndex,e.charIndex,text);};
    u.onend=function(){if(activeUtterance===u)activeUtterance=null;if(opts.stepIndex!=null)clearVoiceFocus();if(btn)btn.classList.remove('is-speaking');updateReadAloudButton();if(typeof opts.onDone==='function')opts.onDone();};
    u.onerror=function(){if(activeUtterance===u)activeUtterance=null;if(opts.stepIndex!=null)clearVoiceFocus();if(btn)btn.classList.remove('is-speaking');updateReadAloudButton();};
    try{
      if(synth.paused)synth.resume();
      speechTimer=setTimeout(function(){
        speechTimer=null;
        try{synth.speak(u);}catch(e){activeUtterance=null;updateReadAloudButton();}
      },70);
      return true;
    }catch(e){activeUtterance=null;updateReadAloudButton();return false;}
  }
  function cancelSpeech(){
    cancelFocusScroll();
    voiceSequenceToken++;
    clearSpeechCursor();
    if(speechTimer){clearTimeout(speechTimer);speechTimer=null;}
    if(window.speechSynthesis)window.speechSynthesis.cancel();
    abortGeneratedSpeech();
    abortSpeechPrefetch();
    if(localAudio){try{localAudio.pause();localAudio.currentTime=0;}catch(e){}}
    localAudio=null;localAudioToken++;
    speechLoadingLabel='';speechLoadingMode='';speechLoadingEngine='';speechLoadingVoice='';
    activeUtterance=null;
    clearVoiceFocus();
    var btn=$('[data-readaloud]');if(btn)btn.classList.remove('is-speaking');
    updateReadAloudButton();
  }
  function speechClean(text){
    return (text||'')
      .replace(/→/g,' to ')
      .replace(/↵/g,' return ')
      .replace(/\\bfn\\b/g,'function')
      .replace(/\\(\\)/g,' function ')
      .replace(/[{};]+/g,' ')
      .replace(/\\s+/g,' ')
      .trim();
  }
  function fallbackStepText(panel){
    var w=$('.ds-why-text',panel);
    return speechClean(w?w.textContent:'');
  }
  function stepSpeechUnits(panel){
    var overview=$all('[data-speech-overview],[data-speech-concept]',panel);
    if(overview.length){
      return overview.map(function(node){return {text:speechClean(node.textContent||''),group:null};}).filter(function(unit){return !!unit.text;});
    }
    var beats=$all('[data-speech-beat]',panel);
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
  function speakStepIndex(i,manual){
    var p=stepPanels[i];if(!p)return false;
    var units=stepSpeechUnits(p);if(!units.length)return false;
    voiceSequenceToken++;
    return speakStepUnit(i,units,0,manual);
  }
  function speakStepUnit(stepIndex,units,index,manual){
    if(index>=units.length)return false;
    currentSpeechStep=stepIndex;currentSpeechUnit=index;currentSpeechManual=!!manual;
    var token=voiceSequenceToken,unit=units[index];
    var spoken=speak(unit.text,{stepIndex:stepIndex,focusGroup:unit.group,onDone:function(){
      if(token!==voiceSequenceToken)return;
      if(index+1<units.length){speakStepUnit(stepIndex,units,index+1,manual);return;}
      advanceAfterSpeechStep(stepIndex,manual);
    }});
    if(spoken)prefetchUpcomingSpeech(stepIndex,units,index,manual);return spoken;
  }
  function speakStep(i){if(readAloud)return speakStepIndex(i,false);return false;}
  function nextSpeakableStep(i){
    for(var j=i+1;j<total;j++){if(stepSpeechUnits(stepPanels[j]).length)return j;}
    return -1;
  }
  function previousSpeakableStep(i){
    for(var j=i-1;j>=1;j--){if(stepSpeechUnits(stepPanels[j]).length)return j;}
    return -1;
  }
  function prefetchGeneratedSpeechText(text){
    var engine=voiceEngine==='say'||voiceEngine==='kokoro'?voiceEngine:'';
    if(!engine||!text)return;
    var voice=engine==='kokoro'?kokoroVoice:sayVoice;
    prefetchGeneratedSpeech(engine,text,voice,rate);
  }
  function prefetchUpcomingSpeech(stepIndex,units,index,manual){
    if(index+1<units.length){prefetchGeneratedSpeechText(units[index+1].text);return;}
    if(!manual)prefetchNextSpeech(stepIndex);
  }
  function advanceAfterSpeechStep(stepIndex,manual){
    if(manual)return;
    var n=nextSpeakableStep(stepIndex);if(n>=0){setActive(n);return;}
    prefetchNextSpeech(stepIndex);
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
    if(!(readAloud||activeUtterance||localAudio||currentSpeechStep>=0))return false;
    var baseStep=currentSpeechStep>=0?currentSpeechStep:active,baseUnit=currentSpeechUnit;
    var target=speechBeatTarget(baseStep,baseUnit,delta);if(!target)return true;
    var manual=currentSpeechManual&&!readAloud;
    var units=stepSpeechUnits(stepPanels[target.step]);if(!units.length)return true;
    cancelSpeech();
    readAloud=!manual;
    activateStep(target.step,false);
    updateReadAloudButton();
    voiceSequenceToken++;
    speakStepUnit(target.step,units,target.unit,manual);
    return true;
  }
  function prefetchNextSpeech(i){
    if(!readAloud)return;
    var n=nextSpeakableStep(i);if(n<0)return;
    var units=stepSpeechUnits(stepPanels[n]),text=units[0]&&units[0].text;if(!text)return;
    prefetchGeneratedSpeechText(text);
  }
  function firstSpeakableStep(){
    for(var j=Math.max(1,active);j<total;j++){if(stepSpeechUnits(stepPanels[j]).length)return j;}
    for(var k=1;k<Math.min(total,Math.max(1,active));k++){if(stepSpeechUnits(stepPanels[k]).length)return k;}
    return -1;
  }
  function setRate(r){rate=r;try{localStorage.setItem('ds-rate',String(r));}catch(e){}$all('[data-rate]').forEach(function(b){var active=parseFloat(b.getAttribute('data-rate'))===r;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false');});if(readAloud)restartReadAloud();}
  function setVoiceEngine(engine){
    voiceEngine=engine==='say'||engine==='kokoro'?engine:'browser';
    try{localStorage.setItem('ds-voice-engine',voiceEngine);}catch(e){}
    cancelSpeech();
    updateVoiceControls();
    if(readAloud)restartReadAloud();
  }
  function normalizePreset(p){
    if(p==='balanced'||p==='operator'||p==='story')return 'story';
    if(p==='warm'||p==='flirty')return 'flirty';
    if(p==='precise'||p==='reviewer'||p==='bass')return 'bass';
    return VOICE_PRESETS[p]?p:'story';
  }
  function normalizeSayVoice(v){
    return String(v||'').toLowerCase()==='daniel'?'daniel':'samantha';
  }
  function normalizeKokoroVoice(v){
    var name=String(v||'').toLowerCase().replace(/[\\s-]+/g,'_');
    var aliases={heart:'af_heart',bella:'af_bella',nicole:'af_nicole',sarah:'af_sarah',adam:'am_adam',onyx:'am_onyx',emma:'bf_emma',daniel:'bm_daniel'};
    return KOKORO_VOICES[name]?name:(aliases[name]||'af_heart');
  }
  function sayVoiceFromLegacyPreset(p){
    return normalizePreset(p)==='bass'?'daniel':'samantha';
  }
  function setSayVoice(v,preview){
    sayVoice=normalizeSayVoice(v);
    try{localStorage.setItem('ds-say-voice',sayVoice);}catch(e){}
    updateVoiceControls();
    updateReadAloudButton();
    if(readAloud)restartReadAloud();
    else if(preview)speakVoicePreview();
  }
  function setKokoroVoice(v,preview){
    kokoroVoice=normalizeKokoroVoice(v);
    try{localStorage.setItem('ds-kokoro-voice',kokoroVoice);}catch(e){}
    updateVoiceControls();
    updateReadAloudButton();
    if(readAloud)restartReadAloud();
    else if(preview)speakVoicePreview();
  }
  function setVoicePreset(p,preview){
    voicePreset=normalizePreset(p);
    try{localStorage.setItem('ds-voice-preset',voicePreset);localStorage.setItem('ds-operator',voicePreset);}catch(e){}
    updateVoiceControls();
    updateReadAloudButton();
    if(readAloud)restartReadAloud();
    else if(preview)speakVoicePreview();
  }
  function loadVoices(){
    if(!window.speechSynthesis)return;
    voices=window.speechSynthesis.getVoices()||[];
  }
  function voiceScore(v,presetName){
    var preset=VOICE_PRESETS[presetName]||VOICE_PRESETS.story;
    var name=(v.name||'').toLowerCase(),lang=(v.lang||'').toLowerCase(),score=0;
    if(lang.indexOf('en')===0)score+=20;
    if(v.default)score+=10;
    if(v.localService)score+=5;
    preset.prefer.forEach(function(re){if(re.test(name))score+=44;});
    preset.avoid.forEach(function(re){if(re.test(name))score-=80;});
    if(/natural|premium|enhanced|neural/.test(name))score+=24;
    if(/google|microsoft/.test(name))score+=10;
    if(/compact|robot|novelty|fred|ralph|whisper|zarvox/.test(name))score-=60;
    return score;
  }
  function voiceQuality(v){
    var name=(v.name||'').toLowerCase(),lang=(v.lang||'').toLowerCase(),score=0;
    if(lang.indexOf('en')===0)score+=40;
    if(/natural|premium|enhanced|neural/.test(name))score+=28;
    if(/google|microsoft/.test(name))score+=14;
    if(/compact|robot|novelty|fred|ralph|whisper|zarvox/.test(name))score-=80;
    if(v.localService)score+=3;
    if(v.default)score+=6;
    return score;
  }
  function voicePool(){
    return voices.slice().sort(function(a,b){return voiceQuality(b)-voiceQuality(a);});
  }
  function voiceMatchesPreset(v,presetName){
    var preset=VOICE_PRESETS[presetName]||VOICE_PRESETS.story;
    var name=(v&&v.name||'').toLowerCase();
    var avoided=preset.avoid.some(function(re){return re.test(name);});
    if(avoided)return false;
    return preset.prefer.some(function(re){return re.test(name);});
  }
  function bestNaturalVoice(){
    if(!voices.length)loadVoices();
    return voicePool().filter(function(v){return voiceQuality(v)>0;})[0]||null;
  }
  function pickVoice(presetName){
    presetName=normalizePreset(presetName);
    if(presetName==='system')return null;
    if(!voices.length)loadVoices();
    if(!voices.length)return null;
    var natural=bestNaturalVoice();
    var picked=voicePool().sort(function(a,b){return voiceScore(b,presetName)-voiceScore(a,presetName);})[0]||null;
    if(presetName==='story')return picked||natural;
    if(picked&&voiceMatchesPreset(picked,presetName))return picked;
    return bestNaturalVoice();
  }
  function describeVoice(){
    var preset=VOICE_PRESETS[voicePreset]||VOICE_PRESETS.story;
    if(voiceEngine==='kokoro')return 'Kokoro AI · '+(KOKORO_VOICES[kokoroVoice]||KOKORO_VOICES.af_heart).label;
    if(voiceEngine==='say')return 'Mac local · '+(SAY_VOICES[sayVoice]||SAY_VOICES.samantha).label;
    var v=pickVoice(voicePreset);
    if(voicePreset==='system')return 'System voice · browser default';
    if(v)return preset.label+' · '+v.name;
    return preset.label+' · voice loads when the browser is ready';
  }
  function updateVoiceControls(){
    $all('[data-voice-engine]').forEach(function(b){var active=b.getAttribute('data-voice-engine')===voiceEngine;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false');});
    var browserGrid=$('[data-browser-voices]'),sayGrid=$('[data-say-voices]'),kokoroGrid=$('[data-kokoro-voices]');
    if(browserGrid)browserGrid.hidden=voiceEngine!=='browser';
    if(sayGrid)sayGrid.hidden=voiceEngine!=='say';
    if(kokoroGrid)kokoroGrid.hidden=voiceEngine!=='kokoro';
    $all('[data-voice-preset]').forEach(function(b){var active=b.getAttribute('data-voice-preset')===voicePreset;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false');});
    $all('[data-say-voice]').forEach(function(b){var active=b.getAttribute('data-say-voice')===sayVoice;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false');b.classList.toggle('is-loading',speechLoadingEngine==='say'&&b.getAttribute('data-say-voice')===speechLoadingVoice);});
    $all('[data-kokoro-voice]').forEach(function(b){var active=b.getAttribute('data-kokoro-voice')===kokoroVoice;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false');b.classList.toggle('is-loading',speechLoadingEngine==='kokoro'&&b.getAttribute('data-kokoro-voice')===speechLoadingVoice);});
    var s=$('[data-voice-status]');if(s)s.textContent=speechLoadingLabel?speechLoadingLabel+'…':describeVoice();
  }
  function updateReadAloudButton(){
    var btn=$('[data-readaloud]');if(!btn)return;
    var label=$('[data-readaloud-label]',btn),ico=$('.ds-readaloud-ico',btn);
    var loading=!!speechLoadingLabel;
    var buttonLabel=speechLoadingLabel||(readAloud?'Stop story':'Play story');
    btn.classList.toggle('is-active',readAloud);
    btn.classList.toggle('is-loading',loading&&speechLoadingMode!=='preview');
    btn.setAttribute('aria-busy',loading?'true':'false');
    btn.setAttribute('aria-pressed',readAloud?'true':'false');
    btn.setAttribute('aria-label',buttonLabel);
    btn.setAttribute('title',buttonLabel);
    if(label)label.textContent=speechLoadingLabel||(readAloud?'Stop':'Play');
    if(ico){ico.classList.toggle('is-stop',readAloud&&!loading);ico.textContent=loading?'◌':(readAloud?'':'▶');}
    var preview=$('[data-preview-voice]');
    if(preview){
      var previewLabel=$('[data-preview-label]',preview),previewIco=$('.ds-preview-ico',preview);
      preview.classList.toggle('is-loading',loading&&speechLoadingMode==='preview');
      preview.setAttribute('aria-busy',loading&&speechLoadingMode==='preview'?'true':'false');
      if(previewLabel)previewLabel.textContent=loading&&speechLoadingMode==='preview'?'Generating':'Preview';
      if(previewIco)previewIco.textContent=loading&&speechLoadingMode==='preview'?'◌':'▶';
    }
  }
  function restartReadAloud(){
    cancelSpeech();
    readAloud=true;
    updateReadAloudButton();
    if(!speakStep(active)){var si=firstSpeakableStep();if(si>=0)setActive(si);}
  }
  function speakVoicePreview(){
    var preset=VOICE_PRESETS[voicePreset]||VOICE_PRESETS.story,localVoice=SAY_VOICES[sayVoice]||SAY_VOICES.samantha,kokoroLocal=KOKORO_VOICES[kokoroVoice]||KOKORO_VOICES.af_heart;
    readAloud=false;
    try{localStorage.setItem('ds-readaloud','');}catch(e){}
    updateReadAloudButton();
    if(voiceEngine==='kokoro')speak(kokoroLocal.sample,{voice:kokoroVoice,rate:1,preview:true});
    else if(voiceEngine==='say')speak(localVoice.sample,{voice:sayVoice,rate:1,preview:true});
    else speak(preset.sample,{preset:voicePreset,rate:1});
  }
  function readJsonOrError(r,msg){
    if(r.ok)return r.json();
    return r.json().then(function(j){throw new Error((j&&j.error)||msg);},function(){throw new Error(msg);});
  }
  function isAbortError(err){
    return err&&(err.name==='AbortError'||/aborted|cancelled/i.test(String(err.message||err)));
  }
  function generatedSpeechKey(engine,text,voice,speechRate){
    return [engine,voice,speechRate,text].join('\\n');
  }
  function cachedGeneratedSpeech(engine,text,voice,speechRate){
    return prefetchedSpeech[generatedSpeechKey(engine,text,voice,speechRate)]||null;
  }
  function abortSpeechPrefetch(){
    if(speechPrefetchAbort){try{speechPrefetchAbort.abort();}catch(e){}}
    speechPrefetchAbort=null;speechPrefetchKey='';
  }
  function abortGeneratedSpeech(){
    if(speechAbort){try{speechAbort.abort();}catch(e){}}
    speechAbort=null;
  }
  function setGeneratedSpeechLoading(token,label,engine,voice,mode){
    if(token!==localAudioToken)return;
    speechLoadingLabel=label;
    speechLoadingMode=mode||'speech';
    speechLoadingEngine=engine;
    speechLoadingVoice=voice||'';
    updateReadAloudButton();
    updateVoiceControls();
  }
  function clearGeneratedSpeechLoading(token){
    if(token!==localAudioToken)return;
    speechLoadingLabel='';
    speechLoadingMode='';
    speechLoadingEngine='';
    speechLoadingVoice='';
    updateReadAloudButton();
    updateVoiceControls();
  }
  function handleLocalPlaybackBlocked(a,btn,msg){
    if(localAudio!==a)return;
    if(btn)btn.classList.remove('is-speaking');
    updateReadAloudButton();
    toast(msg,'error');
  }
  function playGeneratedAudio(a,btn,msg){
    try{
      var p=a.play();
      if(p&&p.catch)p.catch(function(){handleLocalPlaybackBlocked(a,btn,msg);});
    }catch(e){
      handleLocalPlaybackBlocked(a,btn,msg);
    }
  }
  function fetchGeneratedSpeech(engine,text,voice,speechRate,signal){
    var api=engine==='kokoro'?'/api/tts/kokoro':'/api/tts/say';
    var msg=engine==='kokoro'?'Kokoro speech failed':'Local speech failed';
    return fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text,voice:voice,rate:speechRate}),signal:signal})
      .then(function(r){return readJsonOrError(r,msg);});
  }
  function prefetchGeneratedSpeech(engine,text,voice,speechRate){
    if(!text)return;
    var key=generatedSpeechKey(engine,text,voice,speechRate);
    if(prefetchedSpeech[key]||speechPrefetchKey===key)return;
    abortSpeechPrefetch();
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    speechPrefetchKey=key;speechPrefetchAbort=ctrl;
    fetchGeneratedSpeech(engine,text,voice,speechRate,ctrl?ctrl.signal:undefined)
      .then(function(d){if(speechPrefetchKey!==key)return;prefetchedSpeech[key]=d;speechPrefetchKey='';speechPrefetchAbort=null;})
      .catch(function(err){if(speechPrefetchKey!==key)return;speechPrefetchKey='';speechPrefetchAbort=null;if(isAbortError(err))return;});
  }
  function playFetchedGeneratedAudio(engine,text,opts,token,btn,ctrl,d){
    if(token!==localAudioToken)return;
    if(speechAbort===ctrl)speechAbort=null;
    clearGeneratedSpeechLoading(token);
    var a=new Audio(d.url);
    localAudio=a;activeUtterance=a;
    a.onended=function(){if(localAudio===a)localAudio=null;if(activeUtterance===a)activeUtterance=null;if(opts.stepIndex!=null)clearVoiceFocus();if(btn)btn.classList.remove('is-speaking');updateReadAloudButton();if(typeof opts.onDone==='function')opts.onDone();};
    a.onerror=function(){if(localAudio===a)localAudio=null;if(activeUtterance===a)activeUtterance=null;if(opts.stepIndex!=null)clearVoiceFocus();if(btn)btn.classList.remove('is-speaking');updateReadAloudButton();toast((engine==='kokoro'?'Kokoro voice':'Mac local voice')+' could not play; falling back to browser voice.','error');voiceEngine='browser';updateVoiceControls();speak(text,opts);};
    playGeneratedAudio(a,btn,engine==='kokoro'?'Kokoro audio is ready. Press Space to play it.':'Mac local voice is ready. Press Space to play it.');
  }
  function speakGeneratedAudio(engine,text,opts){
    if(!text)return false;
    opts=opts||{};
    abortGeneratedSpeech();
    if(localAudio){try{localAudio.pause();localAudio.currentTime=0;}catch(e){}}
    localAudioToken++;
    var token=localAudioToken,btn=$('[data-readaloud]');
    if(opts.stepIndex!=null){if(opts.focusGroup!=null)setActiveBeat(opts.stepIndex,opts.focusGroup);else startVoiceFocusSequence(opts.stepIndex,text);}else clearVoiceFocus();
    var voice=engine==='kokoro'?(opts.voice||kokoroVoice):(opts.voice||sayVoice);
    var speechRate=opts.rate||rate;
    var cached=!opts.preview&&cachedGeneratedSpeech(engine,text,voice,speechRate);
    if(btn)btn.classList.add('is-speaking');
    if(cached){playFetchedGeneratedAudio(engine,text,opts,token,btn,null,cached);return true;}
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    speechAbort=ctrl;
    setGeneratedSpeechLoading(token,opts.preview?'Generating preview':'Generating speech',engine,voice,opts.preview?'preview':'speech');
    fetchGeneratedSpeech(engine,text,voice,speechRate,ctrl?ctrl.signal:undefined)
      .then(function(d){playFetchedGeneratedAudio(engine,text,opts,token,btn,ctrl,d);})
      .catch(function(err){if(token!==localAudioToken)return;if(speechAbort===ctrl)speechAbort=null;clearGeneratedSpeechLoading(token);if(isAbortError(err))return;if(localAudio){try{localAudio.pause();}catch(e){}}localAudio=null;activeUtterance=null;if(opts.stepIndex!=null)clearVoiceFocus();if(btn)btn.classList.remove('is-speaking');updateReadAloudButton();toast((engine==='kokoro'?'Kokoro failed: '+err.message:'Mac local voice is unavailable; using browser voice.'),'error');voiceEngine='browser';updateVoiceControls();speak(text,opts);});
    updateReadAloudButton();
    return true;
  }
  function speakKokoroAudio(text,opts){
    return speakGeneratedAudio('kokoro',text,opts);
  }
  function speakLocalAudio(text,opts){
    return speakGeneratedAudio('say',text,opts);
  }
  function toggleReadAloud(){
    if(readAloud){readAloud=false;try{localStorage.setItem('ds-readaloud','');}catch(e){}cancelSpeech();return;}
    readAloud=true;
    try{localStorage.setItem('ds-readaloud',readAloud?'1':'');}catch(e){}
    updateReadAloudButton();
    if(!speakStep(active)){var si=firstSpeakableStep();if(si>=0)setActive(si);}
  }
  function toggleVoicePause(){
    if(localAudio){
      if(localAudio.paused){localAudio.play();toast('Voice resumed');updateReadAloudButton();return true;}
      localAudio.pause();toast('Voice paused');updateReadAloudButton();return true;
    }
    var synth=window.speechSynthesis;if(!synth)return false;
    if(synth.paused){synth.resume();toast('Voice resumed');updateReadAloudButton();return true;}
    if(synth.speaking||activeUtterance){synth.pause();toast('Voice paused');updateReadAloudButton();return true;}
    return false;
  }

  function loadFilePanel(panel){
    if(!panel||!$('[data-file-panel-lazy]',panel)||panel.getAttribute('data-panel-loading')==='1')return Promise.resolve(panel);
    var file=panel.getAttribute('data-file')||'';
    panel.setAttribute('data-panel-loading','1');panel.setAttribute('aria-busy','true');
    return fetch(reviewPageUrl('/api/diff/file-panel?file='+encodeURIComponent(file))).then(reviewLazyText).then(function(html){
      panel.innerHTML=html;panel.removeAttribute('data-panel-loading');panel.removeAttribute('aria-busy');
      mountThreads(panel);updateChangeNav(panel);refreshComments();applyFilesMode(panel);jumpToFirstChange(panel);return panel;
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
    var want=stored||(active?active.getAttribute('data-mode'):null);
    if(!want)return;
    var btn=$('.ds-modetoggle button[data-mode="'+want+'"]',panel)||active;
    if(btn)setMode(btn,{persist:false});
  }
  function selectFileByPath(file){
    for(var k=0;k<filePanels.length;k++){if(filePanels[k].getAttribute('data-file')===file){selectFile(k);return;}}
  }
  function reviewUiKey(){return 'ds-review-ui:'+(document.body.getAttribute('data-review-scope')||document.body.getAttribute('data-viewed-scope')||'');}
  function currentReviewPosition(){
    var view=filesView&&!filesView.hidden?'files':'tour';
    var panel=view==='files'?filePanels[selectedFile]:stepPanels[active];
    var scroll=0;
    if(view==='files'){var detail=$('#ds-file-detail');scroll=detail?detail.scrollTop:0;}
    else if(panel){var diff=$('.ds-diffscroll',panel);scroll=diff?diff.scrollTop:panel.scrollTop;}
    return {view:view,step:active,file:filePanels[selectedFile]?filePanels[selectedFile].getAttribute('data-file'):'',scroll:Math.round(scroll||0)};
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
    var text=describeReviewPosition(state),inFiles=filesView&&!filesView.hidden;if(!btn)return;
    btn.hidden=!text||!inFiles;
    if(text){if(label)label.textContent=text;btn.title=text;btn.setAttribute('aria-label',text);}
    else{btn.removeAttribute('title');btn.removeAttribute('aria-label');}
  }
  function restoreReviewPosition(){
    var state=storedReviewPosition();if(!state)return;
    restoringReviewPosition=true;
    if(state.view==='files'){
      setView('files');if(state.file)selectFileByPath(state.file);
      setTimeout(function(){var d=$('#ds-file-detail');if(d)d.scrollTop=Number(state.scroll)||0;restoringReviewPosition=false;},0);
    }else{
      setView('tour');setActive(Number(state.step)||0,false);
      setTimeout(function(){var p=stepPanels[active],d=p&&$('.ds-diffscroll',p);if(d)d.scrollTop=Number(state.scroll)||0;restoringReviewPosition=false;},0);
    }
    setReviewMenu(false);
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
  function openDrawer(){showDrawerRoot(drawer);}
  function closeDrawer(){hideDrawerRoot(drawer);}
  function fileMatchesFilter(item){
    var q=($('[data-file-search]')&&$('[data-file-search]').value||'').trim().toLowerCase();
    if(q&&(item.getAttribute('data-filter-path')||'').indexOf(q)<0&&(item.getAttribute('data-filter-code')||'').indexOf(q)<0)return false;
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
    if(progress&&!visible.length)progress.textContent='No matching files';
    else syncViewed();
  }
  function setFileFilter(filter){
    activeFileFilter=filter||'all';applyFileFilters();
    var label=$('[data-file-filter-label]'),button=$('[data-file-filter="'+activeFileFilter+'"]');if(label)label.textContent=button?button.textContent:'All';
    var menu=$('.ds-filefilter-menu');if(menu)menu.open=false;
  }
  function syncFileCommentFlags(){
    var paths={};allComments.forEach(function(c){if(c.status!=='resolved')paths[c.file]=1;});
    fileItems.forEach(function(item){item.setAttribute('data-filter-comments',paths[item.getAttribute('data-goto-file')]?'1':'0');});
    applyFileFilters();
  }
  function nextUnviewedFile(){
    var visible=fileItems.filter(function(item){return !item.hidden&&!viewedFiles[item.getAttribute('data-goto-file')];});
    if(!visible.length){toast('Every visible file is marked reviewed');return;}
    var after=visible.find(function(item){return Number(item.getAttribute('data-file-index'))>selectedFile;})||visible[0];
    setView('files');selectFile(Number(after.getAttribute('data-file-index')));collapseCompactSidebar();
  }
  function setFeedbackPanel(panel){
    if(!feedbackDrawer)return;
    $all('[data-feedback-panel]',feedbackDrawer).forEach(function(btn){var active=btn.getAttribute('data-feedback-panel')===panel;btn.classList.toggle('is-active',active);btn.setAttribute('aria-selected',active?'true':'false');btn.tabIndex=active?0:-1;});
    $all('[data-feedback-view]',feedbackDrawer).forEach(function(view){view.hidden=view.getAttribute('data-feedback-view')!==panel;});
    var tools=$('[data-feedback-tools]',feedbackDrawer);if(tools)tools.hidden=panel!=='feedback';
  }
  function challengeKey(){return 'ds-challenge:'+(document.body.getAttribute('data-review-scope')||'')+':'+(document.body.getAttribute('data-current-diff-hash')||'');}
  function loadChallengeChecks(){var saved={};try{saved=JSON.parse(localStorage.getItem(challengeKey())||'{}')||{};}catch(e){}$all('[data-challenge-check]').forEach(function(input){input.checked=!!saved[input.getAttribute('data-challenge-check')];});}
  function saveChallengeChecks(){var saved={};$all('[data-challenge-check]').forEach(function(input){if(input.checked)saved[input.getAttribute('data-challenge-check')]=1;});try{localStorage.setItem(challengeKey(),JSON.stringify(saved));}catch(e){}}
  function openFeedbackDrawer(panel){
    setReviewMenu(false);if(!feedbackDrawer)return;showDrawerRoot(feedbackDrawer);setFeedbackPanel(panel||'feedback');
  }
  function closeFeedbackDrawer(){hideDrawerRoot(feedbackDrawer);}
  function filterFeedback(filter){
    if(!feedbackDrawer)return;
    $all('[data-feedback-filter]',feedbackDrawer).forEach(function(btn){btn.classList.toggle('is-active',btn.getAttribute('data-feedback-filter')===filter);});
    $all('[data-feedback-card]',feedbackDrawer).forEach(function(card){
      var show=filter==='all'||card.getAttribute('data-feedback-status')===filter||card.getAttribute('data-feedback-severity')===filter||(filter==='changed'&&(card.getAttribute('data-feedback-anchor')==='changed'||card.getAttribute('data-feedback-anchor')==='moved'));
      card.hidden=!show;
    });
  }
  function patchFeedbackStatus(c){
    $all('[data-feedback-card][data-comment-id="'+c.id+'"]').forEach(function(card){
      card.setAttribute('data-feedback-status',c.status);card.className='ds-feedback-card status-'+c.status;
      var actions=$('.ds-feedback-actions',card);if(!actions)return;actions.textContent='';
      var show=el('button','ds-ghost','Show in diff');show.setAttribute('data-goto-comment',c.id);actions.appendChild(show);
      if(c.status==='addressed'){
        var reopen=el('button','ds-ghost','Reopen');reopen.setAttribute('data-reopen-comment',c.id);actions.appendChild(reopen);
        var accept=el('button','ds-btn ds-btn-solid','Accept fix');accept.setAttribute('data-accept-fix',c.id);actions.appendChild(accept);
      }else if(c.status==='resolved'){
        var reopen2=el('button','ds-ghost','Reopen');reopen2.setAttribute('data-reopen-comment',c.id);actions.appendChild(reopen2);
      }
    });
  }
  function buildFeedbackCardClient(c,anchor){
    var f=FLAVOR[c.type]||FLAVOR.change,severity=commentSeverity(c),card=el('article','ds-feedback-card status-'+c.status);
    card.setAttribute('data-feedback-card','');card.setAttribute('data-feedback-status',c.status);card.setAttribute('data-feedback-severity',severity);card.setAttribute('data-feedback-anchor',anchor||'current');card.setAttribute('data-comment-id',c.id);card.setAttribute('data-comment-file',c.file||'');card.setAttribute('data-comment-line',String(c.line||0));card.setAttribute('data-comment-step',c.step||'');
    var head=el('div','ds-feedback-head');head.appendChild(el('span','ds-flavor-ico',f.ico));head.appendChild(el('span','ds-severity ds-severity-'+severity,SEVERITY[severity]));head.appendChild(el('span','ds-feedback-path',(c.file||'')+':'+(c.line||0)));head.appendChild(el('span','ds-flex'));head.appendChild(el('span','ds-anchorbadge is-'+(anchor||'current'),anchor==='changed'?'Code changed':anchor==='moved'?'Code moved':'Anchor current'));card.appendChild(head);
    if(c.selectedText)card.appendChild(el('code','ds-feedback-selection',c.selectedText));
    card.appendChild(markdownBlock('ds-feedback-message ds-md',c.body||''));
    var turns=c.turns||[],reply=null;for(var i=turns.length-1;i>=0;i--){if(turns[i].role==='ai'){reply=turns[i];break;}}
    if(reply){var r=markdownBlock('ds-feedback-reply ds-md',reply.text);r.insertBefore(el('span','',BRAND),r.firstChild);card.appendChild(r);}
    card.appendChild(el('div','ds-feedback-actions'));patchFeedbackStatus(c);return card;
  }
  function patchFeedbackContent(card,c){
    if(!card)return;
    var severity=commentSeverity(c);card.setAttribute('data-feedback-severity',severity);
    var severityBadge=$('.ds-severity',card);if(severityBadge){severityBadge.className='ds-severity ds-severity-'+severity;severityBadge.textContent=SEVERITY[severity];}
    var path=$('.ds-feedback-path',card);if(path)path.textContent=(c.file||'')+':'+(c.line||0);
    var message=$('.ds-feedback-message',card),freshMessage=markdownBlock('ds-feedback-message ds-md',c.body||'');
    if(message&&message.parentNode)message.parentNode.replaceChild(freshMessage,message);
    var oldReply=$('.ds-feedback-reply',card);if(oldReply&&oldReply.parentNode)oldReply.parentNode.removeChild(oldReply);
    var turns=c.turns||[],reply=null;for(var i=turns.length-1;i>=0;i--){if(turns[i].role==='ai'){reply=turns[i];break;}}
    if(reply){var rendered=markdownBlock('ds-feedback-reply ds-md',reply.text);rendered.insertBefore(el('span','',BRAND),rendered.firstChild);var actions=$('.ds-feedback-actions',card);card.insertBefore(rendered,actions||null);}
  }
  function syncFeedbackCards(){
    if(!feedbackDrawer)return;var list=$('[data-feedback-view="feedback"]',feedbackDrawer);if(!list)return;
    var old={};$all('[data-feedback-card]',list).forEach(function(card){old[card.getAttribute('data-comment-id')]={node:card,anchor:card.getAttribute('data-feedback-anchor')||'current'};});
    list.textContent='';
    if(!allComments.length){list.appendChild(el('div','ds-drawer-empty','No review feedback yet.'));return;}
    allComments.forEach(function(c){
      var existing=old[c.id],card=existing?existing.node:buildFeedbackCardClient(c,'current');
      if(existing)patchFeedbackContent(card,c);
      list.appendChild(card);patchFeedbackStatus(c);
    });
  }
  function updateCommentStatus(id,status){
    fetch(reviewPageUrl(API+'/'+encodeURIComponent(id)),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:status})})
      .then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(c){noteBlockingFeedbackMutation(c);patchComment(c);patchFeedbackStatus(c);refreshCount();if(status==='resolved')toast('Fix accepted');else toast('Comment reopened');}).catch(function(){toast('Could not update the comment','error');});
  }
  function gotoComment(id){
    var card=$('[data-feedback-card][data-comment-id="'+id+'"]');if(!card)return;
    var file=card.getAttribute('data-comment-file'),step=card.getAttribute('data-comment-step');closeFeedbackDrawer();
    if(step){setView('tour');var stepCard=$('.ds-stepcard[data-step-id="'+step+'"]');if(stepCard)setActive(Number(stepCard.getAttribute('data-step-index')));}
    else{setView('files');selectFileByPath(file);}
    setTimeout(function(){var wraps=$all('.ds-comment[data-comment-id="'+id+'"]');for(var i=0;i<wraps.length;i++){var surface=closest(wraps[i],'.ds-thread'),row=surface&&surface.previousElementSibling,launcher=row&&$('[data-comment-launcher]',row);if(launcher&&launcher.offsetParent){scrollReviewRowVertically(row);openCommentSurface(surface,launcher,true,id);break;}}},80);
  }
  function openCommands(){
    setReviewMenu(false);if(!commandRoot||!commandRoot.hidden)return;
    commandReturnFocus=document.activeElement;commandRoot.hidden=false;activateModal(commandRoot,commandReturnFocus);setTimeout(function(){focusModalRoot(commandRoot);},0);
  }
  function closeCommands(){
    if(!commandRoot||commandRoot.hidden)return;
    deactivateModal(commandRoot,true);commandRoot.hidden=true;commandReturnFocus=null;
  }
  function runCommand(id){
    closeCommands();
    if(id==='story'){setView('tour');return;}if(id==='files'){setView('files');var q=$('[data-file-search]');if(q)q.focus();return;}
    if(id==='feedback'){openFeedbackDrawer('feedback');return;}
    if(id==='next-unviewed'){nextUnviewedFile();return;}
    if(id==='toggle-viewed'){var panel=filePanels[selectedFile];if(panel)toggleViewed(panel.getAttribute('data-file'));return;}
    if(id==='read-aloud'){toggleReadAloud();return;}
  }

  function chatHead(title,detail){
    var head=el('div','ds-chat-head');
    var copy=el('div','');copy.appendChild(el('strong','',title));if(detail)copy.appendChild(el('span','',detail));head.appendChild(copy);head.appendChild(el('span','ds-flex'));
    var nav=el('div','ds-chat-nav');nav.hidden=true;
    var prev=el('button','','‹');prev.type='button';prev.setAttribute('data-comment-prev','');prev.setAttribute('aria-label','Previous conversation');nav.appendChild(prev);
    var pos=el('span','','');pos.setAttribute('data-comment-position','');pos.setAttribute('aria-live','polite');nav.appendChild(pos);
    var next=el('button','','›');next.type='button';next.setAttribute('data-comment-next','');next.setAttribute('aria-label','Next conversation');nav.appendChild(next);head.appendChild(nav);
    var close=el('button','ds-chat-close','×');close.type='button';close.setAttribute('data-comment-surface-close','');close.setAttribute('aria-label','Close conversation');head.appendChild(close);return head;
  }
  function closeCommentSurface(restoreFocus){
    if(!activeCommentSurface)return;
    activeCommentSurface.classList.remove('is-open');activeCommentSurface.hidden=true;
    $all('[data-comment-launcher][aria-expanded="true"]').forEach(function(b){b.setAttribute('aria-expanded','false');});
    var back=commentSurfaceReturnFocus;activeCommentSurface=null;commentSurfaceReturnFocus=null;
    if(commentSurfaceCollapsedSidebar){setSidebarCollapsed(false,false);commentSurfaceCollapsedSidebar=false;}
    if(restoreFocus&&back&&document.contains(back))back.focus();
  }
  function surfaceComments(surface){return surface?$all('.ds-comment',surface).filter(function(n){return n.parentNode===surface;}):[];}
  function showCommentInSurface(surface,idOrIndex){
    var comments=surfaceComments(surface);if(!comments.length)return null;
    var index=-1;
    if(typeof idOrIndex==='number')index=idOrIndex;
    else if(idOrIndex){for(var i=0;i<comments.length;i++){if(comments[i].getAttribute('data-comment-id')===idOrIndex){index=i;break;}}}
    if(index<0){for(var j=0;j<comments.length;j++){if(comments[j].classList.contains('is-active-thread')){index=j;break;}}}
    if(index<0)index=0;index=Math.max(0,Math.min(comments.length-1,index));
    for(var k=0;k<comments.length;k++){var active=k===index;comments[k].hidden=!active;comments[k].classList.toggle('is-active-thread',active);}
    surface.setAttribute('data-active-comment-id',comments[index].getAttribute('data-comment-id')||'');
    var nav=$('.ds-chat-nav',surface),pos=$('[data-comment-position]',surface),prev=$('[data-comment-prev]',surface),next=$('[data-comment-next]',surface);
    if(nav)nav.hidden=comments.length<2;if(pos)pos.textContent=(index+1)+' / '+comments.length;if(prev)prev.disabled=index===0;if(next)next.disabled=index===comments.length-1;
    return comments[index];
  }
  function openCommentSurface(surface,trigger,focusInside,commentId){
    if(!surface)return;closeCommentSurface(false);removeComposer(null,false);
    commentSurfaceCollapsedSidebar=!compactScreen()&&!document.body.classList.contains('ds-rail-collapsed');
    if(commentSurfaceCollapsedSidebar)setSidebarCollapsed(true,false);
    activeCommentSurface=surface;commentSurfaceReturnFocus=trigger||null;surface.hidden=false;surface.classList.add('is-open');
    showCommentInSurface(surface,commentId);
    if(trigger)trigger.setAttribute('aria-expanded','true');
    if(focusInside)surface.focus({preventScroll:true});
  }
  function ensureThreadSurface(row,t){
    if(!t.id)t.id='ds-comment-surface-'+(++commentSurfaceSeq);
    if(!$('.ds-chat-head',t))t.insertBefore(chatHead('Review conversation','Anchored to selected code'),t.firstChild);
    t.hidden=!t.classList.contains('is-open');t.setAttribute('role','dialog');t.setAttribute('aria-label','Review conversation');t.tabIndex=-1;
    var launcher=$('[data-comment-launcher]',row);
    if(!launcher){launcher=el('button','ds-comment-pin','');launcher.type='button';launcher.setAttribute('data-comment-launcher','');row.appendChild(launcher);}
    var count=surfaceComments(t).length;launcher.textContent=count>1?String(count):'●';launcher.setAttribute('aria-label','Open '+count+' review '+(count===1?'comment':'comments'));if(count)showCommentInSurface(t,t.getAttribute('data-active-comment-id'));
    launcher.setAttribute('aria-controls',t.id);launcher.setAttribute('aria-expanded',t.classList.contains('is-open')?'true':'false');return t;
  }
  function threadAfter(row){
    var t=row.nextElementSibling;
    if(t&&t.classList&&t.classList.contains('ds-thread'))return ensureThreadSurface(row,t);
    t=el('div','ds-thread');row.parentNode.insertBefore(t,row.nextSibling);return ensureThreadSurface(row,t);
  }
  function initialComments(){
    var node=document.getElementById('ds-initial-comments');if(!node)return [];
    try{var list=JSON.parse(node.textContent||'[]');return Array.isArray(list)?list:[];}catch(e){return [];}
  }
  var allComments=initialComments();
  var reviewFeedbackIdentityRequest=0;
  function commentSide(c){return c&&c.side==='left'?'left':'right';}
  function commentSeverity(c){return c&&SEVERITY[c.severity]?c.severity:c&&c.type==='nit'?'nit':c&&c.type==='change'?'blocking':'concern';}
  function refreshReviewState(done){
    var request=++reviewFeedbackIdentityRequest;
    fetch(reviewPageUrl('/api/review-state')).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(state){
      if(request!==reviewFeedbackIdentityRequest||!state)return;
      if(state.scopeKey!==(document.body.getAttribute('data-review-scope')||''))return;
      document.body.setAttribute('data-feedback-health',state.feedbackHealth&&state.feedbackHealth.status==='invalid'?'invalid':'healthy');
      var renderedHash=document.body.getAttribute('data-current-diff-hash')||'',sameDiff=state.currentDiffHash===renderedHash;
      setLiveIssue('diff',!sameDiff);
      refreshCount();
      if(done)done(state);
    }).catch(function(){if(done)done(null);});
  }
  function syncReviewFeedbackIdentity(){refreshReviewState();}
  function noteBlockingFeedbackMutation(comment){
    if(!comment||commentSeverity(comment)!=='blocking')return;
    syncReviewFeedbackIdentity();
  }
  function mountThreads(scope){
    if(!scope)return;
    var codes=$all('[data-comment-code]',scope);
    for(var i=0;i<codes.length;i++){
      var code=codes[i],row=closest(code,'.ds-row,.ds-urow');
      if(!row)continue;
      var file=code.getAttribute('data-comment-file'),line=code.getAttribute('data-comment-line'),side=code.getAttribute('data-comment-side')||'right';
      if(!file||line==null)continue;
      for(var j=0;j<allComments.length;j++){
        var c=allComments[j];
        if(commentSide(c)!==side||c.file!==file||String(c.line)!==String(line))continue;
        var th=threadAfter(row);
        if(!$('.ds-comment[data-comment-id="'+c.id+'"]',th))th.appendChild(buildComment(c));
        ensureThreadSurface(row,th);
      }
    }
  }
  function syncThreads(){ mountThreads(document); }
  function buildComment(c){
    var f=FLAVOR[c.type]||FLAVOR.change,severity=commentSeverity(c);
    var wrap=el('div','ds-comment status-'+c.status);
    wrap.setAttribute('data-comment-id',c.id);wrap.setAttribute('data-status',c.status);
    wrap.setAttribute('data-comment-file',c.file||'');wrap.setAttribute('data-comment-line',String(c.line||0));wrap.setAttribute('data-comment-step',c.step||'');wrap.setAttribute('data-comment-severity',severity);
    if((c.turns||[]).some(function(t){return t.role==='ai';}))wrap.setAttribute('data-hasreply','1');
    var card=el('div','ds-comment-card flavor-'+c.type);
    var head=el('div','ds-comment-head');
    head.appendChild(el('span','ds-flavor-ico',f.ico));
    head.appendChild(el('span','ds-flavor-label',f.label));
    head.appendChild(el('span','ds-dot'));
    head.appendChild(el('span','ds-comment-author',c.author||'You'));
    head.appendChild(el('span','ds-severity ds-severity-'+severity,SEVERITY[severity]));
    head.appendChild(el('span','ds-flex'));
    var sb=el('span','ds-statusbadge');sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));head.appendChild(sb);
    var menu=el('details','ds-comment-menu'),menuToggle=el('summary','','•••');menuToggle.setAttribute('aria-label','Conversation actions');menu.appendChild(menuToggle);
    var menuPop=el('div','ds-comment-menu-pop');
    var rb=el('button','',c.status==='resolved'?'Reopen':'Resolve');rb.setAttribute('data-resolve','');menuPop.appendChild(rb);
    var db=el('button','ds-del','Delete conversation');db.setAttribute('data-delete','');menuPop.appendChild(db);menu.appendChild(menuPop);head.appendChild(menu);
    card.appendChild(head);
    if(c.selectedText){
      var picked=el('details','ds-comment-selection'),pickSummary=el('summary','');
      pickSummary.appendChild(el('span','ds-comment-selection-label',commentSide(c)==='left'?'Selected old side':'Selected new side'));
      var preview=String(c.selectedText).replace(/\s+/g,' ').trim();if(preview.length>82)preview=preview.slice(0,79)+'…';
      pickSummary.appendChild(el('code','ds-comment-selection-preview',preview));var toggle=el('b','ds-comment-selection-toggle','');toggle.setAttribute('aria-hidden','true');pickSummary.appendChild(toggle);picked.appendChild(pickSummary);
      picked.appendChild(el('code','ds-comment-selection-code',c.selectedText));
      card.appendChild(picked);
    }
    card.appendChild(markdownBlock('ds-comment-body ds-md',c.body));
    card.appendChild(buildThreadComposer(c));wrap.appendChild(card);renderConversation(wrap,c);return wrap;
  }
  function buildAgentRoute(){
    var route=el('div','ds-agent-route');
    route.appendChild(el('span','ds-agent-route-icon','◈'));
    route.appendChild(el('span','','Agent task'));
    var name=el('strong','','Choose task');name.setAttribute('data-agent-target-name','');route.appendChild(name);
    var change=el('button','','Choose');change.type='button';change.setAttribute('data-agent-target-select','');change.setAttribute('data-agent-target-change','');route.appendChild(change);
    applyAgentTargetTo(route,readAgentTarget());return route;
  }
  function buildComposer(row,flavor,ctx){
    ctx=ctx||{};
    var file=ctx.file||row.getAttribute('data-file'),line=ctx.line||row.getAttribute('data-line'),step=ctx.step||row.getAttribute('data-step');
    var side=ctx.side||row.getAttribute('data-side')||'right';
    var selectedText=ctx.selectedText||'';
    var initialFlavor=flavor||'change';
    var box=el('div','ds-composer'),state={flavor:initialFlavor,severity:initialFlavor==='nit'?'nit':initialFlavor==='question'?'concern':'blocking'};
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','New review comment');box.setAttribute('tabindex','-1');box.appendChild(chatHead('New review comment','Anchored to your selection'));
    var tabs=el('div','ds-composer-tabs');tabs.setAttribute('role','radiogroup');tabs.setAttribute('aria-label','Comment intent');
    ['change','question','nit'].forEach(function(v){
      var f=FLAVOR[v],b=el('button','ds-composer-tab'+(v===state.flavor?' is-active':''));
      b.setAttribute('data-flavor',v);b.setAttribute('role','radio');b.setAttribute('aria-checked',v===state.flavor?'true':'false');
      b.appendChild(el('span','ds-flavor-ico',f.ico));
      b.appendChild(document.createTextNode(f.label));
      b.onclick=function(){state.flavor=v;$all('.ds-composer-tab',tabs).forEach(function(x){var on=x===b;x.classList.toggle('is-active',on);x.setAttribute('aria-checked',on?'true':'false');});};
      tabs.appendChild(b);
    });
    tabs.addEventListener('keydown',function(e){
      if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'&&e.key!=='ArrowUp'&&e.key!=='ArrowDown'&&e.key!=='Home'&&e.key!=='End')return;
      var choices=$all('.ds-composer-tab',tabs),at=choices.indexOf(document.activeElement),next;
      if(e.key==='Home')next=choices[0];else if(e.key==='End')next=choices[choices.length-1];else next=choices[(Math.max(0,at)+(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1)+choices.length)%choices.length];
      if(next){e.preventDefault();next.focus();next.click();}
    });
    var severity=el('div','ds-composer-severity');severity.setAttribute('role','radiogroup');severity.setAttribute('aria-label','Review impact');
    ['blocking','concern','nit'].forEach(function(value){
      var b=el('button','ds-severity-choice'+(value===state.severity?' is-active':''),SEVERITY[value]);b.type='button';b.setAttribute('role','radio');b.setAttribute('aria-checked',value===state.severity?'true':'false');
      b.onclick=function(){state.severity=value;$all('.ds-severity-choice',severity).forEach(function(choice){var on=choice===b;choice.classList.toggle('is-active',on);choice.setAttribute('aria-checked',on?'true':'false');});};severity.appendChild(b);
    });
    if(selectedText)box.appendChild(el('div','ds-composer-selection',selectedText));
    var ta=el('textarea','ds-composer-ta');ta.placeholder='Comment on the selected text…';ta.rows=3;ta.title='Enter to ask agent · Shift+Enter for a new line';ta.setAttribute('aria-keyshortcuts','Enter');
    var foot=el('div','ds-composer-foot'),bar=el('div','ds-composer-actions');
    var cancel=el('button','ds-ghost','Cancel');cancel.onclick=function(){removeComposer(box);};
    function submitComment(run){
      var body=ta.value.trim();if(!body)return;
      add.disabled=true;ask.disabled=true;
      fetch(reviewPageUrl(API),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:file,line:Number(line),side:side,step:step,type:state.flavor,severity:state.severity,body:body,selectedText:selectedText,selection:ctx.selection})})
        .then(function(r){return r.json().catch(function(){return {};}).then(function(data){if(!r.ok)throw new Error(data&&data.error||'Could not save comment');return data;});}).then(function(c){
          if(!c||!c.id){add.disabled=false;ask.disabled=false;return;}
          allComments.push(c);noteBlockingFeedbackMutation(c);removeComposer(box,false);syncThreads();syncFeedbackCards();refreshCount();
          var created=$all('.ds-comment[data-comment-id="'+c.id+'"]');for(var ci=0;ci<created.length;ci++){var surface=closest(created[ci],'.ds-thread');if(surface&&surface.previousElementSibling&&surface.previousElementSibling.offsetParent){openCommentSurface(surface,$('[data-comment-launcher]',surface.previousElementSibling),false,c.id);break;}}
          if(run)sendToAgent([c.id]);
        }).catch(function(err){add.disabled=false;ask.disabled=false;toast(err&&err.message?err.message:'Could not save your comment.','error');ta.focus();});
    }
    var add=el('button','ds-ghost ds-composer-add','Save only');
    add.title='Save without sending to the agent';
    add.onclick=function(){submitComment(false);};
    var ask=el('button','ds-btn ds-btn-solid','Choose task & ask');ask.setAttribute('data-agent-target-cta','');
    ask.onclick=function(){submitComment(true);};
    if(agentBusy)ask.disabled=true;
    ta.addEventListener('keydown',function(e){if(e.key!=='Enter'||e.shiftKey||e.isComposing)return;e.preventDefault();if(!ask.disabled)submitComment(true);});
    bar.appendChild(cancel);bar.appendChild(add);bar.appendChild(ask);
    foot.appendChild(buildAgentRoute());foot.appendChild(bar);
    box.appendChild(tabs);box.appendChild(severity);box.appendChild(ta);box.appendChild(foot);applyAgentTargetTo(box,readAgentTarget());return box;
  }
  function removeComposer(box,restoreFocus){var b=box||$('.ds-composer');if(b){deactivateModal(b,restoreFocus!==false);if(b.parentNode)b.parentNode.removeChild(b);}composerReturnFocus=null;if(composerCollapsedSidebar){setSidebarCollapsed(false,false);composerCollapsedSidebar=false;}}
  function openComposer(row,flavor,ctx){
    removeComposer(null,false);closeCommentSurface(false);if(!(ctx&&ctx.line)&&!row.getAttribute('data-line'))return;
    composerReturnFocus=document.activeElement;composerCollapsedSidebar=!compactScreen()&&!document.body.classList.contains('ds-rail-collapsed');if(composerCollapsedSidebar)setSidebarCollapsed(true,false);var box=buildComposer(row,flavor,ctx);document.body.appendChild(box);activateModal(box,composerReturnFocus);
    var ta=$('.ds-composer-ta',box);if(ta)ta.focus();
  }
  function resolveComment(wrap){
    if(!wrap)return;
    var id=wrap.getAttribute('data-comment-id'),cur=wrap.getAttribute('data-status'),hasReply=wrap.getAttribute('data-hasreply');
    var target=cur==='resolved'?(hasReply?'addressed':'open'):'resolved';
    fetch(reviewPageUrl(API+'/'+encodeURIComponent(id)),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:target})})
      .then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(c){
        noteBlockingFeedbackMutation(c);patchComment(c);refreshCount();
      }).catch(function(){toast('Could not update the comment. It was not changed.','error');});
  }
  function deleteComment(wrap){
    if(!wrap)return;var id=wrap.getAttribute('data-comment-id');
    var deletedComment=allComments.filter(function(x){return x.id===id;})[0];
    if(!window.confirm('Delete this review conversation? This cannot be undone.'))return;
    fetch(reviewPageUrl(API+'/'+encodeURIComponent(id)),{method:'DELETE'}).then(function(r){if(!r.ok)throw new Error('Delete failed');
      noteBlockingFeedbackMutation(deletedComment);allComments=allComments.filter(function(x){return x.id!==id;});
      $all('.ds-comment[data-comment-id="'+id+'"]').forEach(function(n){
        var th=n.parentNode;
        if(n.parentNode)n.parentNode.removeChild(n);
        if(th&&th.classList&&th.classList.contains('ds-thread')&&!$('.ds-comment',th)&&th.parentNode){var row=th.previousElementSibling,launcher=row&&$('[data-comment-launcher]',row);if(launcher&&launcher.parentNode)launcher.parentNode.removeChild(launcher);if(activeCommentSurface===th)closeCommentSurface(false);th.parentNode.removeChild(th);}else if(th&&th.classList&&th.classList.contains('ds-thread'))ensureThreadSurface(th.previousElementSibling,th);
      });
      syncFeedbackCards();refreshCount();
    }).catch(function(){toast('Could not delete the conversation. It is still saved.','error');});
  }
  // Lazy file panels mean a saved comment may have no mounted .ds-comment node yet.
  // The API-backed cache is therefore the canonical source for global counts and
  // batch actions; de-duplicate it defensively in case a refresh races an insert.
  function commentIds(predicate){
    var seen={},out=[];
    allComments.forEach(function(c){var id=c&&c.id;if(id&&!seen[id]&&(!predicate||predicate(c))){seen[id]=1;out.push(id);}});
    return out;
  }
  function collectOpenIds(){
    return commentIds(function(c){return c.status==='open';});
  }
  function setBusy(b){
    agentBusy=b;
    $all('[data-thread-send]').forEach(function(s){s.disabled=b;});
    $all('[data-thread-add]').forEach(function(s){s.disabled=b;});
    $all('[data-thread-ta]').forEach(function(s){s.disabled=b;});
    $all('[data-agent-target-cta]').forEach(function(s){s.disabled=b;});
    $all('[data-agent-target-control]').forEach(function(s){s.classList.toggle('is-busy',b);s.setAttribute('aria-busy',b?'true':'false');});
    var aa=$('[data-address-all]');if(aa)aa.disabled=b||collectOpenIds().length===0;
  }
  function turnNode(t){
    if(t.role==='user')return markdownBlock('ds-comment-body ds-turn ds-turn-user ds-md',t.text);
    var r=el('div','ds-reply ds-turn');
    r.appendChild(el('span','ds-reply-av','◈'));
    var main=el('div','ds-reply-main');
    var who=el('div','ds-reply-who');who.appendChild(el('span','ds-reply-name',BRAND));who.appendChild(el('span','ds-ai-badge','AI'));
    main.appendChild(who);
    main.appendChild(markdownBlock('ds-reply-body ds-md',t.text));
    r.appendChild(main);
    return r;
  }
  function renderConversation(wrap,c){
    var card=$('.ds-comment-card',wrap);if(!card)return;
    $all('.ds-turn',card).forEach(function(n){if(n.parentNode)n.parentNode.removeChild(n);});
    var anchor=$('.ds-reply-live',card)||$('.ds-thread-composer',card);
    var turns=(c&&c.turns)||[];
    for(var i=0;i<turns.length;i++)card.insertBefore(turnNode(turns[i]),anchor||null);
  }
  function buildThreadComposer(c){
    var box=el('div','ds-thread-composer');
    var ta=el('textarea','ds-thread-ta');ta.placeholder='Reply to '+BRAND+'…';ta.rows=1;
    ta.setAttribute('data-thread-ta','');
    var add=el('button','ds-ghost ds-thread-add','Save');
    add.setAttribute('data-thread-add','');add.title='Save without sending to the agent';
    var send=el('button','ds-btn ds-btn-solid ds-thread-send','Choose task & ask');
    send.setAttribute('data-thread-send','');send.setAttribute('data-agent-target-cta','');
    if(agentBusy){ta.disabled=true;send.disabled=true;add.disabled=true;}
    var foot=el('div','ds-thread-composer-foot'),actions=el('div','ds-thread-actions');
    actions.appendChild(add);actions.appendChild(send);foot.appendChild(buildAgentRoute());foot.appendChild(actions);
    box.appendChild(ta);box.appendChild(foot);applyAgentTargetTo(box,readAgentTarget());return box;
  }
  function sendThreadMessage(wrap,run){
    if(!wrap)return;
    var id=wrap.getAttribute('data-comment-id');
    var ta=$('[data-thread-ta]',wrap);if(!ta)return;
    if(run&&agentBusy){toast('The agent is already working; wait for it to finish.');return;}
    var text=ta.value.trim();
    // The popup may already contain the saved question the reviewer wants to
    // send. In that case Ask agent means "send this conversation"; only Save
    // requires a new reply in the textarea.
    if(!text){if(run)sendToAgent([id],wrap);return;}
    ta.value='';
    fetch(reviewPageUrl(API+'/'+encodeURIComponent(id)+'/message'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(updated){
        var found=false;
        for(var i=0;i<allComments.length;i++){if(allComments[i].id===id){allComments[i]=updated;found=true;break;}}
        if(!found)allComments.push(updated);
        noteBlockingFeedbackMutation(updated);patchComment(updated);syncFeedbackCards();refreshCount();
        if(run)sendToAgent([id],wrap);
      }).catch(function(){if(!ta.value)ta.value=text;toast('Could not send your message.','error');});
  }
  function commentIdsForSend(ids){
    if(ids==='all')return collectOpenIds();
    return Array.isArray(ids)?ids.filter(function(id){return !!id;}):[];
  }
  function commentWrapsForIds(ids){
    var wanted={};
    (ids||[]).forEach(function(id){wanted[id]=1;});
    return $all('.ds-comment').filter(function(w){return !!wanted[w.getAttribute('data-comment-id')];});
  }
  // Address runs drive the one shared ProgressPanel (the same node #ds-agentpanel gives
  // story generation): the agent's real plan, the lit active step, the live "now" line and
  // an honest elapsed timer. For an address run we relocate that single node inline into the
  // comment card being worked, then send it home when the run is dismissed. agentBusy
  // serializes runs, so one panel node is always enough.
  function restoreAgentPanel(){
    var node=acRoot(),home=document.getElementById('ds-agentpanel');
    if(!node)return;
    node.hidden=true;node.setAttribute('data-variant','floating');
    if(home&&node.parentNode!==home)home.appendChild(node);
  }
  function mountPanelInCard(wrap){
    var node=acRoot();if(!node)return null;
    node.setAttribute('data-variant','inline');
    if(wrap){var surface=closest(wrap,'.ds-thread');if(surface)showCommentInSurface(surface,wrap.getAttribute('data-comment-id'));var card=$('.ds-comment-card',wrap)||wrap;var composer=$('.ds-thread-composer',card);card.insertBefore(node,composer||null);}
    return node;
  }
  function patchComment(c){
    var found=false;
    for(var ai=0;ai<allComments.length;ai++){if(allComments[ai].id===c.id){allComments[ai]=c;found=true;break;}}
    if(!found)allComments.push(c);
    var wraps=$all('.ds-comment[data-comment-id="'+c.id+'"]');
    for(var i=0;i<wraps.length;i++){
      var wrap=wraps[i];
      var activeThread=wrap.classList.contains('is-active-thread');wrap.setAttribute('data-status',c.status);wrap.className='ds-comment status-'+c.status+(activeThread?' is-active-thread':'');
      var sb=$('.ds-statusbadge',wrap);if(sb){sb.textContent='';sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));}
      if((c.turns||[]).some(function(t){return t.role==='ai';}))wrap.setAttribute('data-hasreply','1');
      renderConversation(wrap,c);
      var rb=$('[data-resolve]',wrap);if(rb)rb.textContent=c.status==='resolved'?'Reopen':'Resolve';
    }
    patchFeedbackStatus(c);
  }
  function aiTurnKeys(list){
    var keys={};(list||[]).forEach(function(c){(c.turns||[]).forEach(function(turn,index){if(turn.role==='ai')keys[String(c.id)+'\u0000'+String(index)+'\u0000'+String(turn.at||'')+'\u0000'+String(turn.text||'')]=1;});});return keys;
  }
  function refreshComments(done,notifyReplies,retried){
    var before=aiTurnKeys(allComments);
    fetch(reviewPageUrl(API)).then(function(r){if(!r.ok){var err=new Error('HTTP '+r.status);err.status=r.status;throw err;}return r.json();}).then(function(list){
      var newReplies=0;if(notifyReplies&&Array.isArray(list)){var after=aiTurnKeys(list);Object.keys(after).forEach(function(key){if(!before[key])newReplies++;});}
      if(Array.isArray(list)){allComments=list;list.forEach(patchComment);}
      syncThreads();syncFeedbackCards();syncFileCommentFlags();
      refreshCount();
      syncReviewFeedbackIdentity();
      if(newReplies)toast('Agent replied to '+newReplies+' '+(newReplies===1?'comment.':'comments.'));
      if(done)done(list);
    }).catch(function(err){
      // A dead lease answers 409: this page can only reconnect by reloading,
      // which is the disconnect banner's job, not a comment-store error.
      if(err&&err.status===409){setLiveIssue('disconnected',true);if(done)done(null);return;}
      if(notifyReplies&&!retried){setTimeout(function(){refreshComments(done,notifyReplies,true);},250);return;}
      toast('Could not refresh review comments. Existing comments remain visible.','error');if(done)done(null);
    });
  }
  var acAbort=null;
  function acRoot(){ return document.querySelector('.ds-pp'); }
  function addressAgentChoices(agents){
    var raw=(agents||[]).filter(function(a){return a==='claude'||a==='codex';});
    return ['codex','claude'].filter(function(a){return raw.indexOf(a)>=0;});
  }
  function agentTargetKey(){return 'ds-agent-target:'+(document.body.getAttribute('data-repo')||'repo');}
  function readAgentTarget(){
    try{
      var v=JSON.parse(localStorage.getItem(agentTargetKey())||'null');
      if(v&&v.agent==='claude')return v;
      if(v&&v.agent==='codex'&&(v.mode==='new'||(v.mode==='thread'&&v.threadId)))return v;
    }catch(e){}
    return null;
  }
  function saveAgentTarget(target){
    try{localStorage.setItem(agentTargetKey(),JSON.stringify(target));}catch(e){}
    refreshAgentTargetLabel(target);
  }
  function agentTargetName(target){
    if(!target)return 'Choose task';
    if(target.agent==='claude')return 'Claude (one-off)';
    if(target.mode==='new')return 'New Codex task';
    return target.label||'Selected Codex task';
  }
  function applyAgentTargetTo(scope,target){
    scope=scope||document;var name=agentTargetName(target),has=!!target;
    $all('[data-agent-target-name]',scope).forEach(function(label){label.textContent=name;});
    $all('[data-agent-target-cta]',scope).forEach(function(button){button.textContent=has?'Ask agent':'Choose task & ask';});
    $all('[data-agent-target-change]',scope).forEach(function(button){button.textContent=has?'Change':'Choose';});
    $all('[data-agent-target-batch]',scope).forEach(function(label){
      label.textContent=!target?'Choose an agent task first.':target.agent==='claude'?'Starts a new Claude session.':target.mode==='new'?'Starts a new Codex task, then reuses it.':'Send to '+name+'.';
    });
    $all('[data-agent-target-control]',scope).forEach(function(button){
      button.classList.toggle('is-empty',!has);button.setAttribute('aria-label',has?'Agent task: '+name+'. Change task':'Choose agent task');button.title=has?'Future review questions in this repository go to '+name+'. Click to change.':'Choose where review questions in this repository go.';
    });
  }
  function refreshAgentTargetLabel(target){
    target=target||readAgentTarget();
    applyAgentTargetTo(document,target);
  }
  function taskAge(seconds){
    var n=Math.max(0,Math.floor(Date.now()/1000-Number(seconds||0)));
    if(n<60)return 'now';if(n<3600)return Math.floor(n/60)+'m';if(n<86400)return Math.floor(n/3600)+'h';
    if(n<604800)return Math.floor(n/86400)+'d';return Math.floor(n/604800)+'w';
  }
  function removeAddressAgentChooser(restore){
    agentChooserRequest++;
    var old=$('.ds-agent-chooser');if(old){deactivateModal(old,restore!==false);if(old.parentNode)old.parentNode.removeChild(old);}
    if(restore!==false)agentChooserReturnFocus=null;
  }
  function addressAnchorForIds(targetIds,fromCard){
    // Anchor the inline panel to the card the user acted on; a comment can be cross-surfaced
    // in two views, so fall back to the first visible copy rather than a hidden one.
    var wraps=commentWrapsForIds(targetIds);
    var anchor=(fromCard&&fromCard.offsetParent)?fromCard:null;
    if(!anchor)for(var wi=0;wi<wraps.length;wi++){if(wraps[wi].offsetParent){anchor=wraps[wi];break;}}
    return anchor||wraps[0]||null;
  }
  function taskChoice(list,target,done){
    var current=readAgentTarget(),selected=!!current&&current.agent===target.agent&&current.mode===target.mode&&(target.mode!=='thread'||current.threadId===target.threadId);
    var b=el('button','ds-agent-task-option'+(target.agent==='codex'&&target.mode==='new'?' is-primary':'')+(selected?' is-selected':''));b.type='button';
    b.setAttribute('data-agent-task-option','');b.setAttribute('data-task-search',(target.label+' '+(target.preview||'')).toLowerCase());
    b.setAttribute('aria-pressed',selected?'true':'false');
    var main=el('span','ds-agent-task-main');main.appendChild(el('strong','',target.label));
    if(target.preview)main.appendChild(el('small','',target.preview));b.appendChild(main);
    b.appendChild(el('span','ds-agent-task-meta',selected?'Current':target.meta||''));
    b.onclick=function(){saveAgentTarget(target);removeAddressAgentChooser();if(done)done(target);};list.appendChild(b);
  }
  function renderAgentTargetChooser(agents,tasks,error,done,codexOnly,loading){
    var old=$('.ds-agent-chooser');if(old){deactivateModal(old,false);if(old.parentNode)old.parentNode.removeChild(old);}
    var root=el('div','ds-agent-chooser');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Choose agent task');
    var scrim=el('button','ds-agent-chooser-scrim');scrim.type='button';scrim.setAttribute('aria-label','Cancel');scrim.onclick=removeAddressAgentChooser;root.appendChild(scrim);
    var panel=el('div','ds-agent-chooser-panel');var head=el('div','ds-agent-chooser-head');var text=el('div');
    text.appendChild(el('div','ds-agent-chooser-title','Choose agent task'));
    text.appendChild(el('div','ds-agent-chooser-sub','Future review questions in this repository go here. Codex Desktop tasks keep the implementation context between questions.'));
    var close=el('button','ds-agent-chooser-close','×');close.type='button';close.setAttribute('aria-label','Cancel');close.onclick=removeAddressAgentChooser;
    head.appendChild(text);head.appendChild(close);panel.appendChild(head);
    var search=el('input','ds-agent-task-search');search.type='search';search.placeholder=loading?'Loading recent tasks…':'Search recent tasks';search.setAttribute('aria-label','Search recent tasks');search.disabled=!!loading;panel.appendChild(search);
    var list=el('div','ds-agent-task-list');
    if(loading){
      var loadingRow=el('div','ds-agent-task-loading');loadingRow.setAttribute('role','status');loadingRow.setAttribute('aria-live','polite');
      loadingRow.appendChild(el('span','ds-agent-task-spinner'));loadingRow.appendChild(document.createTextNode('Loading available tasks…'));list.appendChild(loadingRow);
    }else if(agents.indexOf('codex')>=0){
      taskChoice(list,{agent:'codex',mode:'new',label:'＋ Start a new Codex task',preview:'Create it with your next question, then reuse it for later review questions here.',meta:'New'},done);
      if(tasks.length)list.appendChild(el('div','ds-agent-task-section','Recent Codex tasks in this repository'));
      tasks.forEach(function(t){taskChoice(list,{agent:'codex',mode:'thread',threadId:t.id,label:t.title,preview:t.preview||t.source,meta:taskAge(t.updatedAt)},done);});
      if(error)list.appendChild(el('div','ds-agent-task-empty',error));
    }
    if(!loading&&!codexOnly&&agents.indexOf('claude')>=0){
      list.appendChild(el('div','ds-agent-task-section','Other agent'));
      taskChoice(list,{agent:'claude',mode:'new',label:'Claude',preview:'Start a separate Claude session for this run.',meta:'One-off'},done);
    }
    if(!list.children.length)list.appendChild(el('div','ds-agent-task-empty',error||'No Claude or Codex installation was found.'));
    panel.appendChild(list);root.appendChild(panel);document.body.appendChild(root);activateModal(root,agentChooserReturnFocus);
    search.addEventListener('input',function(){var q=search.value.trim().toLowerCase();$all('[data-agent-task-option]',list).forEach(function(b){b.hidden=!!q&&(b.getAttribute('data-task-search')||'').indexOf(q)<0;});});
    if(loading)close.focus();else search.focus();
  }
  function chooseAddressAgent(ids,fromCard,done,codexOnly){
    if(!agentChooserReturnFocus||!document.documentElement.contains(agentChooserReturnFocus))agentChooserReturnFocus=document.activeElement;
    var request=++agentChooserRequest;
    renderAgentTargetChooser([],[],null,done,codexOnly,true);
    fetch('/api/agents').then(function(r){return r.json();}).then(function(d){
      if(request!==agentChooserRequest)return;
      var list=addressAgentChoices(d.agents||[]);
      if(!list.length){renderAgentTargetChooser([],[],'No Claude or Codex installation was found.',done,codexOnly,false);return;}
      if(list.indexOf('codex')<0){renderAgentTargetChooser(list,[],null,done,codexOnly);return;}
      fetch(CODEX_TASK_API).then(function(r){return r.json().then(function(body){if(!r.ok)throw new Error(body.error||'Could not load Codex tasks.');return body;});})
        .then(function(body){if(request===agentChooserRequest)renderAgentTargetChooser(list,Array.isArray(body.tasks)?body.tasks:[],null,done,codexOnly);})
        .catch(function(e){if(request===agentChooserRequest)renderAgentTargetChooser(list,[],e.message||'Could not load Codex tasks.',done,codexOnly);});
    }).catch(function(){if(request===agentChooserRequest)renderAgentTargetChooser([],[],'Could not load installed agents.',done,codexOnly,false);});
  }
  function sendToAgent(ids,fromCard,target){
    if(agentBusy){toast('Saved. The agent is already working; use Send open comments after it finishes.');return;}
    var targetIds=commentIdsForSend(ids);
    if(!targetIds.length){toast('No open comments to send.');return;}
    if(!target){target=readAgentTarget();if(!target){chooseAddressAgent(ids,fromCard,function(chosen){sendToAgent(ids,fromCard,chosen);},false);return;}}
    removeAddressAgentChooser();
    var anchor=addressAnchorForIds(targetIds,fromCard);
    var root=mountPanelInCard(anchor)||acRoot();
    if(!root)return;
    var payload=ids==='all'?{all:true}:{commentIds:targetIds};
    payload.agent=target.agent;
    if(target.agent==='codex'){
      if(target.mode==='thread'&&target.threadId){payload.codexThreadId=target.threadId;payload.codexTaskLabel=target.label||'Selected Codex task';}
      else payload.newCodexTask=true;
    }
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    acAbort=ctrl;
    var panel=new ProgressPanel(root,{
      onStop:function(){ if(acAbort)acAbort.abort(); },
      onClose:function(){ restoreAgentPanel(); },
      onBlocked:function(){ setBusy(false);acAbort=null; },
      onDone:function(status,result){
        setBusy(false);acAbort=null;
        if(status!=='complete')return;
        if(result&&result.delivery==='desktop'){
          toast('Sent to the selected ChatGPT task.');
          return;
        }
        if(target.agent==='codex'&&result&&result.codexThreadId&&target.mode==='new'){
          target={agent:'codex',mode:'thread',threadId:result.codexThreadId,label:'diffStory review'};saveAgentTarget(target);
        }
        // The agent's actual reply is now persisted on the comment; pull it into the thread.
        refreshComments(function(){
          if(result&&result.codeChanged){
            var btn=el('button','ds-pp-reload','Reload diff');
            btn.setAttribute('data-reload-diff','');
            panel.showFoot(btn);
          }
        });
      }
    });
    setBusy(true);panel.start();
    runProgress(panel,ADDRESS_API,payload,ctrl).then(function(){ setBusy(false);acAbort=null; });
  }
  function repairStory(action,target){
    if(agentBusy){toast('The agent is already working — wait for it to finish.');return;}
    fetch('/api/agents').then(function(r){return r.json();}).then(function(d){
      var agents=addressAgentChoices(d.agents||[]);if(!agents.length){toast('No Claude or Codex CLI found on PATH.','error');return;}
      var root=acRoot();if(!root)return;
      closeDrawer();setBusy(true);agentBusy=true;
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
  function storyFileChecks(){return $all('[data-story-file]');}
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
      var input=$('[data-story-file]',row),path=input&&input.value?input.value.toLowerCase():'';
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
    var openN=commentIds(function(c){return c.status!=='resolved';}).length;
    var blockingN=commentIds(function(c){return c.status!=='resolved'&&commentSeverity(c)==='blocking';}).length,nonblockingN=Math.max(0,openN-blockingN);
    var b=$('#ds-open-count b');if(b)b.textContent=openN;
    var count=$('#ds-open-count');if(count)count.hidden=openN===0;
    var countLabel=$('.ds-review-menu-count-label');if(countLabel)countLabel.textContent=' '+(openN===1?'note':'notes');
    var reviewBtn=$('[data-review-menu]'),unexplained=reviewBtn?Number(reviewBtn.getAttribute('data-unexplained-count')||0):0,excluded=reviewBtn?Number(reviewBtn.getAttribute('data-excluded-count')||0):0,indexDivergent=reviewBtn?Number(reviewBtn.getAttribute('data-index-divergence-count')||0):0;
    var storyFreshness=reviewBtn?reviewBtn.getAttribute('data-story-freshness')||'unverified':'current';
    var feedbackHealthy=document.body.getAttribute('data-feedback-health')!=='invalid';
    if(reviewBtn)reviewBtn.setAttribute('aria-label','Review, '+openN+' unresolved '+(openN===1?'note':'notes')+(blockingN?', '+blockingN+' blocking':'')+(!feedbackHealthy?', feedback file needs repair':indexDivergent?', '+indexDivergent+' staged and working-tree '+(indexDivergent===1?'version differs':'versions differ'):storyFreshness!=='current'?', story requires regeneration':unexplained?', '+unexplained+' '+(unexplained===1?'change':'changes')+' not explained by the story':''));
    var summary=$('.ds-review-summary-label b');if(summary){summary.textContent=openN;if(summary.nextSibling)summary.nextSibling.nodeValue=' unresolved '+(openN===1?'note':'notes');}
    var pill=$('.ds-trustpill'),fresh=document.body.getAttribute('data-story-freshness')||'unverified',focused=document.body.getAttribute('data-story-scope')==='focused',liveDiffCurrent=document.body.getAttribute('data-live-diff-stale')!=='1',coverageClean=(!pill||pill.classList.contains('is-clean'))&&fresh==='current',exclusionsClear=excluded===0||exclusionsAcknowledged(),clean=feedbackHealthy&&coverageClean&&exclusionsClear&&indexDivergent===0&&!focused&&liveDiffCurrent;
    void nonblockingN;
    if(reviewBtn)reviewBtn.classList.toggle('is-clean',blockingN===0&&!!clean);
    var sendableN=collectOpenIds().length,aa=$('[data-address-all]');if(aa&&!agentBusy)aa.disabled=sendableN===0;
    var co=$('[data-copy-comments="open"]');if(co)co.disabled=sendableN===0;
    var totalN=commentIds().length,ca=$('[data-copy-comments="all"]');if(ca)ca.disabled=totalN===0;
    var fb=$('[data-feedback-open="feedback"]');if(fb)fb.disabled=totalN===0;
    var fc=$('[data-feedback-count]');if(fc){fc.textContent=totalN;fc.hidden=totalN===0;}
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
  function commentsToText(list,withThread){
    var out=['Please address these review comments from my code review (diffStory). Each is anchored to selected text in the diff. This is a comparison between a target side and the current code — read both sides of the change before fixing or answering; do not assume a symbol is missing just because it is absent from one side.',''];
    list.forEach(function(c,i){
      var label=(FLAVOR[c.type]&&FLAVOR[c.type].label)||c.type;
      var sel=c.selection||{},start=sel.startLine||c.line,end=sel.endLine||start;
      var side=commentSide(c);
      var head=(i+1)+'. ['+(SEVERITY[commentSeverity(c)]||'Concern')+'] ['+label+'] '+c.file+':'+start+(end&&end!==start?'-'+end:'')+' ('+(side==='left'?'left / old side':'right / new side')+')';
      if(withThread)head+='  ('+(STATUS[c.status]||c.status)+')';
      out.push(head);
      if(c.selectedText)out.push('   Selected: '+String(c.selectedText).replace(/\\n/g,'\\n   '));
      out.push('   '+String(c.body||'').replace(/\\n/g,'\\n   '));
      if(withThread)commentTurnsToText(c).forEach(function(line){out.push(line);});
      out.push('');
    });
    return out.join('\\n').replace(/\\s+$/,'');
  }
  function commentTurnsToText(c){
    var lines=[];
    if(Array.isArray(c.turns))c.turns.forEach(function(t){
      if(!t||typeof t.text!=='string'||!t.text.trim())return;
      var who=t.role==='ai'?BRAND+' reply':'Reviewer';
      lines.push('   '+who+': '+String(t.text).replace(/\\n/g,'\\n   '));
    });
    if(!lines.length&&c.reply)lines.push('   '+BRAND+' reply: '+String(c.reply).replace(/\\n/g,'\\n   '));
    return lines;
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
  function copyComments(mode){
    var all=mode==='all';
    fetch(reviewPageUrl(API)).then(function(r){return r.json();}).then(function(list){
      var arr=Array.isArray(list)?list:[];
      var pick=all?arr:arr.filter(function(c){return c.status==='open';});
      if(!pick.length){toast(all?'No comments to copy yet.':'No open comments to copy.');return;}
      writeClipboard(commentsToText(pick,all),function(){
        toast('Copied '+pick.length+' '+(pick.length===1?'comment':'comments')+(all?' (full thread)':'')+' — paste them to your agent.');
      });
    }).catch(function(){toast('Could not read comments to copy.','error');});
  }

  function closeStoryTuneMenus(){
    $all('.ds-story-tune[open]').forEach(function(menu){menu.open=false;});
  }

  function onClick(e){
    var t=e.target,b;
    if(!closest(t,'.ds-story-tune'))closeStoryTuneMenus();
    var sp=$('#ds-settings');if(sp&&!sp.hidden&&!closest(t,'.ds-settings-wrap'))sp.hidden=true;
    var rp=$('[data-review-menu-pop]');if(rp&&!rp.hidden&&!closest(t,'.ds-review-menu-wrap'))setReviewMenu(false);
    b=closest(t,'[data-review-reload]');if(b){location.reload();return;}
    b=closest(t,'[data-selection-action]');if(b){var ctx=selectionContext;closeSelectionMenu();if(ctx)openComposer(ctx.anchorRow,b.getAttribute('data-selection-action'),ctx);return;}
    if(selectionMenu&&!selectionMenu.hidden&&!closest(t,'[data-selection-menu]'))closeSelectionMenu();
    b=closest(t,'[data-sidebar-toggle]');if(b){
      var collapsed=document.body.classList.contains('ds-rail-collapsed');
      if(compactScreen()){if(collapsed)openCompactSidebar(b);else closeCompactSidebar(true);}
      else setSidebarCollapsed(!collapsed);
      return;
    }
    b=closest(t,'[data-sidebar-scrim]');if(b){closeCompactSidebar(true);return;}
    b=closest(t,'[data-view]');if(b){setView(b.getAttribute('data-view'));return;}
    b=closest(t,'[data-file-filter]');if(b){setFileFilter(b.getAttribute('data-file-filter'));return;}
    b=closest(t,'[data-next-unviewed]');if(b){nextUnviewedFile();return;}
    b=closest(t,'[data-retry-file-panel]');if(b){var lazyPanel=closest(b,'.ds-filepanel');if(lazyPanel){lazyPanel.innerHTML='<div class="ds-filepanel-loading" data-file-panel-lazy role="status">Loading file review…</div>';loadFilePanel(lazyPanel);}return;}
    b=closest(t,'[data-retry-story-step]');if(b){var lazyStep=closest(b,'.ds-step'),stepIndex=Number(b.getAttribute('data-retry-story-step'));if(lazyStep){lazyStep.setAttribute('data-step-lazy','1');loadStoryStep(stepIndex,function(ok){if(ok&&active===stepIndex)activateStep(stepIndex,true);});}return;}
    b=closest(t,'[data-feedback-open]');if(b){openFeedbackDrawer(b.getAttribute('data-feedback-open'));return;}
    b=closest(t,'[data-feedback-close]');if(b){closeFeedbackDrawer();return;}
    b=closest(t,'[data-feedback-panel]');if(b){setFeedbackPanel(b.getAttribute('data-feedback-panel'));return;}
    b=closest(t,'[data-feedback-filter]');if(b){filterFeedback(b.getAttribute('data-feedback-filter'));return;}
    b=closest(t,'[data-challenge-check]');if(b){saveChallengeChecks();return;}
    b=closest(t,'[data-accept-fix]');if(b){updateCommentStatus(b.getAttribute('data-accept-fix'),'resolved');return;}
    b=closest(t,'[data-reopen-comment]');if(b){updateCommentStatus(b.getAttribute('data-reopen-comment'),'open');return;}
    b=closest(t,'[data-goto-comment]');if(b){gotoComment(b.getAttribute('data-goto-comment'));return;}
    b=closest(t,'[data-comment-prev],[data-comment-next]');if(b){var surface=closest(b,'.ds-thread'),comments=surfaceComments(surface),activeId=surface&&surface.getAttribute('data-active-comment-id'),index=0;for(var ni=0;ni<comments.length;ni++){if(comments[ni].getAttribute('data-comment-id')===activeId){index=ni;break;}}showCommentInSurface(surface,index+(b.hasAttribute('data-comment-next')?1:-1));return;}
    b=closest(t,'[data-comment-launcher]');if(b){var row=closest(b,'.ds-row,.ds-urow'),surface=row&&row.nextElementSibling;if(surface&&surface.classList.contains('ds-thread')){if(activeCommentSurface===surface)closeCommentSurface(true);else openCommentSurface(surface,b);}return;}
    b=closest(t,'[data-comment-surface-close]');if(b){if(closest(b,'.ds-composer'))removeComposer(null,true);else closeCommentSurface(true);return;}
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
    b=closest(t,'[data-story-file]');if(b){updateStoryScopeCount();return;}
    b=closest(t,'[data-generate-story]');if(b){generateStory(b);return;}
    b=closest(t,'[data-settings]');if(b){if(sp)sp.hidden=!sp.hidden;return;}
    b=closest(t,'[data-reload-diff]');if(b){b.disabled=true;b.classList.add('is-loading');b.setAttribute('aria-busy','true');b.setAttribute('aria-label','Reloading diff');var reloadLabel=$('[data-reload-label]',b);if(reloadLabel)reloadLabel.textContent='Reloading';requestAnimationFrame(function(){location.reload();});return;}
    b=closest(t,'[data-review-menu]');if(b){if(rp)setReviewMenu(rp.hidden);return;}
    b=closest(t,'[data-voice-engine]');if(b){setVoiceEngine(b.getAttribute('data-voice-engine'));return;}
    b=closest(t,'[data-rate]');if(b){setRate(parseFloat(b.getAttribute('data-rate')));return;}
    b=closest(t,'[data-say-voice]');if(b){setSayVoice(b.getAttribute('data-say-voice'),true);return;}
    b=closest(t,'[data-kokoro-voice]');if(b){setKokoroVoice(b.getAttribute('data-kokoro-voice'),true);return;}
    b=closest(t,'[data-voice-preset]');if(b){setVoicePreset(b.getAttribute('data-voice-preset'),true);return;}
    b=closest(t,'[data-preview-voice]');if(b){speakVoicePreview();return;}
    b=closest(t,'button[data-story-lens]');if(b){var lp=closest(b,'.ds-step');if(lp)setStoryLens(lp,b.getAttribute('data-story-lens')||'focus',true);return;}
    b=closest(t,'[data-rail-beat]');if(b){var rbi=parseInt(b.getAttribute('data-rail-step-index')||'-1',10),rbg=parseInt(b.getAttribute('data-focus-group')||'0',10);if(rbi===active)selectStoryFocus(rbi,rbg,true);collapseCompactSidebar();return;}
    b=closest(t,'[data-beat-move]');if(b){var bmp=closest(b,'.ds-step');movePanelBeat(bmp,parseInt(b.getAttribute('data-beat-move')||'0',10));return;}
    b=closest(t,'[data-open-full-diff]');if(b){var file=b.getAttribute('data-open-full-diff')||'',item=fileItems.find(function(candidate){return candidate.getAttribute('data-file-path')===file;});setView('files');if(item)selectFile(Number(item.getAttribute('data-file-index')));collapseCompactSidebar();return;}
    b=closest(t,'[data-open-all-files]');if(b){setView('files');collapseCompactSidebar();return;}
    b=closest(t,'[data-story-beat]');if(b){var bp=closest(b,'.ds-step');if(bp){var bpi=parseInt(bp.getAttribute('data-step-panel')||'0',10),bpg=parseInt(b.getAttribute('data-focus-group')||'0',10);selectStoryFocus(bpi,bpg,true);}return;}
    b=closest(t,'[data-playstep]');if(b){var pp=closest(t,'.ds-step');if(pp){var sp=parseInt(pp.getAttribute('data-step-panel')||'0',10);speakStepIndex(sp,true);}return;}
    b=closest(t,'[data-readaloud]');if(b){toggleReadAloud();return;}
    b=closest(t,'[data-viewed-toggle]');if(b){var viewedPanel=closest(b,'.ds-filepanel');if(viewedPanel)toggleViewed(viewedPanel.getAttribute('data-file'));return;}
    b=closest(t,'.ds-fileitem');if(b){setView('files');selectFile(Number(b.getAttribute('data-file-index')));collapseCompactSidebar();return;}
    b=closest(t,'[data-resolve]');if(b){resolveComment(closest(b,'.ds-comment'));return;}
    b=closest(t,'[data-delete]');if(b){deleteComment(closest(b,'.ds-comment'));return;}
    b=closest(t,'[data-thread-add]');if(b){sendThreadMessage(closest(b,'.ds-comment'),false);return;}
    b=closest(t,'[data-thread-send]');if(b){sendThreadMessage(closest(b,'.ds-comment'),true);return;}
    b=closest(t,'[data-agent-target-select]');if(b){setReviewMenu(false);chooseAddressAgent(null,null,null,false);return;}
    b=closest(t,'[data-address-all]');if(b){if(b.disabled)return;setReviewMenu(false);sendToAgent('all');return;}
    b=closest(t,'[data-copy-comments]');if(b){if(b.disabled)return;setReviewMenu(false);copyComments(b.getAttribute('data-copy-comments'));return;}
    b=closest(t,'[data-change-prev]');if(b){jumpRelativeChange(closest(b,'.ds-filepanel')||closest(b,'.ds-diff'),-1);return;}
    b=closest(t,'[data-change-next]');if(b){jumpRelativeChange(closest(b,'.ds-filepanel')||closest(b,'.ds-diff'),1);return;}
    b=closest(t,'[data-expand]');if(b){expandGap(b);return;}
    b=closest(t,'[data-mode]');if(b){var modeHolder=closest(b,'[data-story-diff]');if(modeHolder)modeHolder.setAttribute('data-mode-user-set','1');setMode(b);return;}
    b=closest(t,'[data-trust-open]');if(b){openDrawer();return;}
    b=closest(t,'[data-trust-close]');if(b){closeDrawer();return;}
    b=closest(t,'[data-exclusions-ack]');if(b){setExclusionsAcknowledged(!!b.checked);return;}
    b=closest(t,'[data-inspect-excluded]');if(b){
      var excludedCard=closest(b,'[data-excluded-file]'),preview=excludedCard&&$('[data-excluded-preview]',excludedCard),excludedFile=b.getAttribute('data-inspect-excluded')||'';if(!preview)return;
      if(preview.getAttribute('data-loaded')==='1'){preview.hidden=!preview.hidden;b.textContent=preview.hidden?'Inspect current file':'Hide preview';return;}
      b.disabled=true;preview.hidden=false;preview.innerHTML='<div class="ds-diffnote">Loading excluded file preview…</div>';
      fetch(reviewPageUrl('/api/review/excluded-file?file='+encodeURIComponent(excludedFile))).then(reviewLazyText).then(function(html){preview.innerHTML=html;preview.setAttribute('data-loaded','1');b.disabled=false;b.textContent='Hide preview';}).catch(function(err){preview.innerHTML='<div class="ds-diffnote" role="alert">'+reviewLazyMessage(err,'Could not load this excluded file.')+(err&&err.reloadRequired?' <button type="button" class="ds-btn ds-btn-ghost" data-review-reload>Reload review</button>':'')+'</div>';b.disabled=false;b.textContent=err&&err.reloadRequired?'Reload required':'Retry preview';});return;
    }
    b=closest(t,'[data-goto-step]');if(b){closeDrawer();closeFeedbackDrawer();setView('tour');setActive(Number(b.getAttribute('data-goto-step')));collapseCompactSidebar();return;}
    b=closest(t,'[data-goto-file]');if(b){closeDrawer();closeFeedbackDrawer();setView('files');selectFileByPath(b.getAttribute('data-goto-file'));collapseCompactSidebar();return;}
    b=closest(t,'[data-explain]');if(b){repairStory('explain',{file:b.getAttribute('data-story-file'),line:Number(b.getAttribute('data-story-line')||0)});return;}
    b=closest(t,'[data-story-repair]');if(b){repairStory(b.getAttribute('data-story-repair'),{file:b.getAttribute('data-story-file'),stepId:b.getAttribute('data-story-step')});var det=closest(b,'details');if(det)det.open=false;return;}
    b=closest(t,'.ds-stepcard');if(b){setActive(Number(b.getAttribute('data-step-index')));collapseCompactSidebar();return;}
    b=closest(t,'[data-prev]');if(b){if(!b.disabled)setActive(active-1);return;}
    b=closest(t,'[data-next]');if(b){if(!b.disabled)setActive(active+1);return;}
  }
  function onKey(e){
    if(e.key==='Escape'){
      var openTune=$('.ds-story-tune[open]');if(openTune){
        e.preventDefault();openTune.open=false;var tuneSummary=$('summary',openTune);if(tuneSummary)tuneSummary.focus();return;
      }
      var escapeModal=topModalRoot();if(escapeModal){
        e.preventDefault();if(escapeModal===$('.ds-agent-chooser'))removeAddressAgentChooser();else if(escapeModal===$('.ds-composer'))removeComposer(escapeModal,true);else if(escapeModal===commandRoot)closeCommands();else if(escapeModal===feedbackDrawer)closeFeedbackDrawer();else if(escapeModal===drawer)closeDrawer();return;
      }
      setReviewMenu(false);closeSelectionMenu();closeCommentSurface(true);
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
    var viewTab=closest(e.target,'[data-view]');
    if(viewTab&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
      var nextView=viewTab.getAttribute('data-view')==='tour'?'files':'tour';
      setView(nextView);
      var nextTab=$('[data-view="'+nextView+'"]');if(nextTab)nextTab.focus();
      e.preventDefault();return;
    }
    var feedbackTab=closest(e.target,'[data-feedback-panel]');
    if(feedbackTab&&(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Home'||e.key==='End')){
      var feedbackTabs=$all('[data-feedback-panel]',feedbackDrawer),fi=feedbackTabs.indexOf(feedbackTab),nextFeedback=e.key==='Home'?feedbackTabs[0]:e.key==='End'?feedbackTabs[feedbackTabs.length-1]:feedbackTabs[(fi+(e.key==='ArrowRight'?1:-1)+feedbackTabs.length)%feedbackTabs.length];
      if(nextFeedback){e.preventDefault();setFeedbackPanel(nextFeedback.getAttribute('data-feedback-panel'));nextFeedback.focus();return;}
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
      if(drawer&&!drawer.hidden)return;
      e.preventDefault();
      if(filesView&&!filesView.hidden)selectFile(selectedFile+(next?1:-1));
      else if(tourView&&!tourView.hidden)setActive(active+(next?1:-1));
      return;
    }
    if((e.key==='v'||e.key==='V')&&!isTextEntryTarget(e.target)&&filesView&&!filesView.hidden){
      if(drawer&&!drawer.hidden)return;
      var vp=filePanels[selectedFile];
      if(vp){toggleViewed(vp.getAttribute('data-file'));e.preventDefault();return;}
    }
    var wantsSpacePause=e.key===' '||e.code==='Space'||e.key==='Spacebar';
    if(wantsSpacePause&&!isTextEntryTarget(e.target)&&(isReadAloudShortcutTarget(e.target)||!isKeyboardControlTarget(e.target))){if(toggleVoicePause()){e.preventDefault();return;}}
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
  function init(){
    tourView=$('#ds-view-tour');filesView=$('#ds-view-files');drawer=$('#ds-trust-drawer');feedbackDrawer=$('#ds-feedback-drawer');commandRoot=$('[data-command-root]');toastEl=$('#ds-toast');selectionMenu=$('[data-selection-menu]');
    stepPanels=$all('.ds-step');stepCards=$all('.ds-stepcard');total=stepPanels.length||1;
    filePanels=$all('.ds-filepanel');fileItems=$all('.ds-fileitem');
    if(document.body.getAttribute('data-storyless')||document.body.getAttribute('data-initial-view')==='files')setView('files');
    document.addEventListener('click',onClick);
    document.addEventListener('contextmenu',openSelectionMenu);
    document.addEventListener('keydown',onKey);
    document.addEventListener('keydown',function(e){
      if(e.key!=='Enter'||e.shiftKey)return;
      var ta=closest(e.target,'[data-thread-ta]');if(!ta)return;
      e.preventDefault();sendThreadMessage(closest(ta,'.ds-comment'),true);
    });
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
    window.addEventListener('resize',function(){setSidebarWidth(currentSidebarWidth(),false);syncSidebarOverlay(document.body.classList.contains('ds-rail-collapsed'));applyResponsiveStoryMode(stepPanels&&stepPanels[active]);$all('.ds-filepanel,.ds-diff').forEach(updateChangeNav);});
    try{var rw=parseFloat(localStorage.getItem('ds-sidebar-width')||'');if(rw)setSidebarWidth(rw,false);else updateSidebarHandle(currentSidebarWidth());}catch(e){updateSidebarHandle(currentSidebarWidth());}
    try{var sv=localStorage.getItem('ds-split');if(sv)$all('.ds-filepanel,.ds-diff').forEach(function(holder){holder.style.setProperty('--ds-split',sv);});}catch(e){}
    try{
      var storedCollapsed=localStorage.getItem('ds-sidebar-collapsed');
      // A desktop preference must not cover the review on a narrow screen.
      setSidebarCollapsed(compactScreen()||storedCollapsed==='1',false);
    }catch(e){setSidebarCollapsed(compactScreen(),false);}
    initStoryGenerator();
    refreshAgentTargetLabel();
    $all('.ds-filepanel,.ds-diff').forEach(updateChangeNav);
    refreshCount();
    loadViewed();invalidateChangedViewed();syncViewed();applyFileFilters();syncExclusionAcknowledgement();loadChallengeChecks();
    var fileSearch=$('[data-file-search]');if(fileSearch)fileSearch.addEventListener('input',applyFileFilters);
    revealResumeReview();
    reviewPositionReady=true;
    refreshComments();
    startLiveEvents();
    try{var storedEngine=localStorage.getItem('ds-voice-engine');voiceEngine=storedEngine==='say'||storedEngine==='kokoro'?storedEngine:voiceEngine;}catch(e){}
    var rab=$('[data-readaloud]');
    if(rab){
      if(window.speechSynthesis){
        loadVoices();
        window.speechSynthesis.onvoiceschanged=function(){loadVoices();updateVoiceControls();};
      }
      try{
        readAloud=!!localStorage.getItem('ds-readaloud');
        voicePreset=normalizePreset(localStorage.getItem('ds-voice-preset')||localStorage.getItem('ds-operator')||voicePreset);
        sayVoice=normalizeSayVoice(localStorage.getItem('ds-say-voice')||sayVoiceFromLegacyPreset(localStorage.getItem('ds-voice-preset')||localStorage.getItem('ds-operator')||voicePreset));
        kokoroVoice=normalizeKokoroVoice(localStorage.getItem('ds-kokoro-voice')||kokoroVoice);
      }catch(e){}
      updateReadAloudButton();
    }
    try{var r0=parseFloat(localStorage.getItem('ds-rate'));if(r0)rate=r0;}catch(e){}
    $all('[data-rate]').forEach(function(b){var active=parseFloat(b.getAttribute('data-rate'))===rate;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',active?'true':'false');});
    updateVoiceControls();
  }
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
`;

export const PAGE_JS = PAGE_JS_HEAD + DIFF_JS + PAGE_JS_TAIL;
