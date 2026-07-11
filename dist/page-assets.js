// Inlined CSS + client JS for the diffStory review page. Kept as plain strings
// (no backticks, no ${} in the JS) so they drop straight into the render template
// literal. The client only ever sets textContent, builds nodes with createElement,
// or injects server-escaped HTML from /api/fullfile — so there is no injection sink.
import { DIFF_CSS, DIFF_JS } from './diff-assets.js';
import { sharedTokens } from './theme.js';
const PAGE_CSS_CORE = `
/* Material 3-inspired tokens. Dark is the default scheme; the light override
   flips the same semantic roles. Existing component variables map onto M3
   surface, primary, secondary, outline, and state-layer roles. */
:root{
  color-scheme:light dark;
  /* Apple-HIG palette (dark default): neutral system grays + system blue accent.
     The --md-* role names are kept so existing component CSS keeps resolving; only
     the values changed (purple/Google → gray/blue/SF). */
  --md-primary:var(--app-blue); --md-on-primary:#FFFFFF; --md-primary-container:#0A3A66; --md-on-primary-container:#D6E9FF;
  --md-secondary:#AEAEB2; --md-secondary-container:rgba(10,132,255,0.22); --md-on-secondary-container:#D6E9FF;
  --md-tertiary:#FF375F; --md-error:#FF453A; --md-on-error:#FFFFFF; --md-error-container:rgba(255,69,58,0.22);
  --md-surface:var(--app-bg); --md-surface-container-low:var(--app-bg); --md-surface-container:var(--app-elev);
  --md-surface-container-high:#3A3A3C; --md-surface-container-highest:#48484A;
  --md-on-surface:var(--app-label); --md-on-surface-variant:#AEAEB2; --md-outline:#8E8E93; --md-outline-variant:rgba(255,255,255,0.16);
  --accent:var(--md-primary); --accent-hi:#409CFF; --accent-soft:rgba(10,132,255,0.16);
  --accent-text:#6CB4FF; --accent-blue:var(--md-primary); --on-accent:var(--md-on-primary);
  --add:var(--app-addbar); --add-bg:rgba(48,209,88,0.14); --add-bd:#30D158; --add-text:#7EE29A;
  --del:var(--app-delbar); --del-bg:rgba(255,69,58,0.14); --del-text:#FFB3AC;
  --amber:#FF9F0A; --amber-soft:rgba(255,159,10,0.14); --amber-text:#FFCC80; --on-amber:#2A1800;
  --green:#30D158; --green-hi:#5EE07F; --on-green:#00250C;
  --bg:var(--md-surface); --panel:var(--md-surface-container-low); --panel2:var(--md-surface-container);
  --panel3:var(--md-surface); --panel4:var(--md-surface-container-high);
  --text:var(--md-on-surface); --muted:rgba(235,235,245,0.62); --dim:rgba(235,235,245,0.45);
  --dim2:rgba(235,235,245,0.30); --faint:rgba(235,235,245,0.20);
  --line:rgba(255,255,255,0.18); --line-soft:rgba(255,255,255,0.10);
  --fill-1:rgba(255,255,255,0.035); --fill-2:rgba(255,255,255,0.06); --fill-3:rgba(255,255,255,0.10);
  --hairline:rgba(255,255,255,0.12);
  --gutter:#161618; --gutter-hi:#1f1f22; --diff-rule:#2b2e36;
  --add-rail:#30D158; --del-rail:#FF453A;
  --material:var(--md-surface-container); --scrim:rgba(0,0,0,0.6); --shadow:0 1px 2px rgba(0,0,0,0.34),0 2px 8px rgba(0,0,0,0.24);
  --scroll:rgba(235,235,245,0.24); --scroll-hi:rgba(235,235,245,0.38);
  /* syntax (Xcode-flavored) */
  --tk-k:#C79BFF; --tk-t:#6FD2C2; --tk-f:#8FB4FF; --tk-s:#B7D59B; --tk-n:#E8A87C; --tk-c:#8A929E;
  --ds-rail-width:316px;
  --ds-split:50;
  --mono:"SF Mono",ui-monospace,Menlo,Monaco,"Cascadia Mono",Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Helvetica Neue",Arial,sans-serif;
}
@media (prefers-color-scheme:light){
  :root{
    --md-on-primary:#FFFFFF; --md-primary-container:#D5E7FF; --md-on-primary-container:#003E80;
    --md-secondary:#6E6E73; --md-secondary-container:rgba(0,122,255,0.14); --md-on-secondary-container:#0061CC;
    --md-tertiary:#FF2D55; --md-error:#FF3B30; --md-on-error:#FFFFFF; --md-error-container:rgba(255,59,48,0.12);
    --md-surface-container-high:#ECECF0; --md-surface-container-highest:#E3E3E8;
    --md-on-surface-variant:rgba(60,60,67,0.6); --md-outline:#C6C6C8; --md-outline-variant:rgba(60,60,67,0.18);
    --accent:var(--md-primary); --accent-hi:#3395FF; --accent-soft:rgba(0,122,255,0.12);
    --accent-text:#0067D6; --accent-blue:var(--md-primary); --on-accent:var(--md-on-primary);
    /* --add/--del are KEPT light overrides on purpose: they are the darker,
       text-legible hues for light mode and deliberately differ from the shared
       --app-addbar/--app-delbar (the brighter bar/tint colors). Don't "tidy"
       these away as redundant with the token unification — that reintroduces
       color drift on the light-scheme review page. */
    --add:#248A3D; --add-bg:rgba(52,199,89,0.14); --add-bd:#248A3D; --add-text:#1A6B30;
    --del:var(--md-error); --del-bg:rgba(255,59,48,0.10); --del-text:#C4271F;
    --amber:#B25000; --amber-soft:rgba(255,149,0,0.16); --amber-text:#8A5300; --on-amber:#FFFFFF;
    --green:#248A3D; --green-hi:#1A6B30; --on-green:#FFFFFF;
    --bg:var(--md-surface); --panel:var(--md-surface-container-low); --panel2:var(--md-surface-container);
    --panel3:var(--md-surface); --panel4:var(--md-surface-container-high);
    --text:var(--md-on-surface); --muted:rgba(60,60,67,0.6); --dim:rgba(60,60,67,0.45);
    --dim2:rgba(60,60,67,0.30); --faint:rgba(60,60,67,0.18);
    --line:rgba(0,0,0,0.16); --line-soft:rgba(0,0,0,0.08);
    --fill-1:rgba(0,0,0,0.025); --fill-2:rgba(0,0,0,0.05); --fill-3:rgba(0,0,0,0.08);
    --hairline:rgba(0,0,0,0.12);
    --material:var(--md-surface-container); --scrim:rgba(0,0,0,0.32); --shadow:0 1px 2px rgba(0,0,0,0.16),0 2px 6px rgba(0,0,0,0.10);
    --scroll:rgba(60,60,67,0.24); --scroll-hi:rgba(60,60,67,0.38);
    /* Diff gutter rail: the dark-default values (#161618 …) are near-black and
       would paint a black line-number column on the light-scheme diff, so give
       them light equivalents here. */
    --gutter:#ECECF0; --gutter-hi:#E3E3E8; --diff-rule:rgba(0,0,0,0.10);
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
.ds-top{height:48px;flex:none;display:flex;align-items:center;gap:8px;padding:0 12px;
  border-bottom:1px solid var(--line-soft);background:var(--md-surface-container);z-index:5}
.ds-sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
.ds-brand{display:flex;align-items:center;gap:9px;flex:none;padding:5px 7px;margin-left:-7px;border-radius:9px;color:inherit;text-decoration:none}
.ds-brand:hover{background:var(--fill-2)}
.ds-brand:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-mark{display:block;--ds-brand-path:var(--accent);--ds-brand-node-a:var(--text);--ds-brand-node-b:#64d2ff;--ds-brand-node-c:var(--text)}
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
  background:transparent;color:var(--muted);font-size:12.5px;font-weight:650;flex:none;white-space:nowrap}
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
.ds-trustpill{width:100%;display:flex;align-items:center;gap:8px;font:inherit;font-size:12px;font-weight:650;color:var(--amber-text);
  padding:8px 9px;border:0;border-radius:9px;background:var(--amber-soft);cursor:pointer;text-align:left}
.ds-trustpill:hover{background:rgba(246,199,105,0.20)}
.ds-trustpill b{font-weight:800}
.ds-trustpill .ds-tri{font-size:10px}
.ds-trustpill.is-clean{color:var(--add);background:var(--add-bg)}
.ds-trustpill.is-clean:hover{background:rgba(155,214,125,0.18)}
.ds-check{font-size:12px}
.ds-actions{position:relative;display:flex;align-items:center;gap:9px;flex:none}
.ds-btn{font-size:13px;font-weight:600;border-radius:999px;cursor:pointer;border:1px solid transparent;white-space:nowrap}
.ds-btn-ghost{color:var(--accent-text);padding:9px 16px;border-color:var(--line);background:transparent}
.ds-btn-ghost:hover{background:var(--fill-2)}
.ds-btn-approve{display:flex;align-items:center;gap:7px;font-weight:700;color:var(--on-accent);padding:10px 18px;border:none;background:var(--accent)}
.ds-btn-approve:hover{background:var(--accent-hi)}
.ds-btn-approve:disabled{opacity:0.4;cursor:not-allowed}
.ds-help{font-weight:850;font-family:var(--mono)}
.ds-agent-target{height:36px;max-width:260px;display:flex;align-items:center;gap:7px;padding:0 11px;border-radius:999px;border:1px solid var(--line);
  background:transparent;color:var(--text);font:inherit;font-size:12px;font-weight:750;cursor:pointer;white-space:nowrap}
.ds-agent-target:hover{background:var(--fill-2);border-color:var(--md-outline)}
.ds-agent-target-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:7px;background:var(--accent-soft);color:var(--accent-text);font-size:11px}
.ds-agent-target-prefix{color:var(--muted);font-weight:650}.ds-agent-target-sep,.ds-agent-target-caret{color:var(--dim)}
.ds-agent-target-name{min-width:0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-agent-target.is-empty .ds-agent-target-name{color:var(--accent-text)}
.ds-agent-target.is-busy .ds-agent-target-icon{animation:dsPulse 1s ease-in-out infinite;background:var(--md-primary);color:var(--md-on-primary)}
.ds-review-menu-wrap{position:relative}
.ds-review-menu{height:36px;display:flex;align-items:center;gap:8px;padding:0 13px;border-radius:999px;border:1px solid var(--line);
  background:var(--md-surface-container-high);color:var(--text);font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap}
.ds-review-menu:hover,.ds-review-menu.is-open{background:var(--md-surface-container-highest);border-color:var(--md-outline)}
.ds-reload-diff:disabled{opacity:.55;cursor:default}
.ds-review-menu-dot{width:7px;height:7px;border-radius:999px;background:var(--amber);box-shadow:0 0 0 4px var(--amber-soft)}
.ds-review-menu.is-clean .ds-review-menu-dot{background:var(--add);box-shadow:0 0 0 4px var(--add-bg)}
.ds-review-menu-caret{color:var(--muted);font-size:12px;transform:translateY(-1px)}
.ds-review-menu-coverage{padding:3px 7px;border-radius:999px;background:var(--amber-soft);color:var(--amber-text);font-size:10px;font-weight:800}
.ds-review-menu-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:32;width:320px;max-width:calc(100vw - 24px);padding:8px;
  border:1px solid var(--line-soft);border-radius:16px;background:var(--md-surface-container-high);box-shadow:var(--shadow)}
.ds-review-menu-pop:focus{outline:none}
.ds-review-menu-pop[hidden]{display:none}
.ds-review-menu-title{padding:7px 9px 6px;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim2);font-weight:800}
.ds-review-menu-count{min-width:20px;height:20px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:var(--fill-2);font-size:11px;font-variant-numeric:tabular-nums}
.ds-review-menu-count-label{margin-left:2px;color:var(--muted);font-size:10px;font-weight:650}
.ds-review-summary{display:flex;flex-direction:column;gap:6px;padding:0 4px 9px;margin-bottom:4px;border-bottom:1px solid var(--line-soft)}
.ds-review-summary-label{display:flex;align-items:center;gap:8px;padding:7px 6px 3px;color:var(--muted);font-size:12px}
.ds-review-summary-label b{color:var(--text);font-variant-numeric:tabular-nums}
.ds-review-row-arrow{margin-left:auto;color:var(--dim);font-size:16px;font-weight:500}
.ds-review-section{display:grid;gap:1px;padding:3px 0 5px}
.ds-review-option{width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;border:none;border-radius:10px;background:transparent;color:var(--text);padding:10px;cursor:pointer}
.ds-review-option:hover{background:var(--fill-2)}
.ds-review-option:disabled{opacity:0.45;cursor:not-allowed}
.ds-review-option:disabled:hover{background:transparent}
.ds-review-option-title{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;line-height:1.2}
.ds-review-option-desc{font-size:11.5px;line-height:1.35;color:var(--muted)}
.ds-review-option-approve:not(:disabled) .ds-review-option-title{color:var(--md-primary)}
.ds-review-option-approve:disabled{opacity:1}.ds-review-option-approve:disabled .ds-review-option-title{color:var(--dim)}.ds-review-option-approve:disabled [data-approve-desc]{color:var(--muted)}
.ds-option-count{min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:var(--fill-3);font-size:10px}
.ds-review-decision{padding:6px 0;border-top:1px solid var(--line-soft)}
.ds-review-section-label{padding:3px 10px 1px;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim2);font-weight:800}
.ds-review-more{border-top:1px solid var(--line-soft)}.ds-review-more>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border-radius:9px;color:var(--muted);font-size:11.5px;font-weight:750;cursor:pointer}.ds-review-more>summary::-webkit-details-marker{display:none}.ds-review-more>summary:hover{background:var(--fill-2);color:var(--text)}.ds-review-more[open]>summary span{transform:rotate(180deg)}
.ds-review-more-list{display:grid;gap:1px;padding:0 0 3px 12px}.ds-review-more-list .ds-review-option{padding-top:8px;padding-bottom:8px}.ds-review-more-list .ds-review-option-title{font-size:12px}
.ds-keycap,.ds-command kbd{font-family:var(--mono);font-size:10px;line-height:1;border:1px solid var(--line);border-bottom-color:var(--md-outline);border-radius:5px;background:var(--fill-2);padding:3px 5px;color:var(--muted)}
.ds-readaloud{width:34px;height:34px;display:flex;align-items:center;justify-content:center;color:var(--md-on-secondary-container);padding:0;border-radius:9px;border:none;
  background:transparent;cursor:pointer;white-space:nowrap}
.ds-readaloud:hover{background:var(--md-surface-container-highest)}
.ds-readaloud-ico{width:20px;height:20px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--md-on-primary);background:var(--md-primary)}
.ds-readaloud.is-active{background:var(--md-secondary-container);border-color:transparent;color:var(--md-on-secondary-container)}
.ds-readaloud.is-active .ds-readaloud-ico{background:var(--md-on-secondary-container);color:var(--md-secondary-container)}
.ds-readaloud.is-speaking .ds-readaloud-ico{animation:dsPulse 1s ease-in-out infinite}
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
.ds-preview{margin-left:auto;display:flex;align-items:center;gap:7px;border:1px solid var(--line);background:transparent;color:var(--text);border-radius:999px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.ds-preview:hover{background:var(--fill-2)}
.ds-preview.is-loading{border-color:var(--md-primary);background:var(--fill-2);color:var(--text)}
.ds-preview-ico{font-size:9px;color:var(--md-primary)}
.ds-engine-row{display:flex;gap:8px;margin-bottom:12px}
.ds-engine-row button{flex:1;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--muted);font-size:12px;font-weight:800;padding:8px 10px;cursor:pointer}
.ds-engine-row button:hover{background:var(--fill-2);color:var(--text)}
.ds-engine-row button.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container);border-color:transparent}
.ds-voice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.ds-voice-grid[hidden]{display:none}
.ds-kokoro-voice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.ds-voice-card{display:grid;grid-template-columns:34px 1fr;gap:10px;text-align:left;border:1px solid var(--line-soft);border-radius:16px;background:var(--md-surface-container);padding:11px;cursor:pointer;color:var(--text);
  min-height:82px;transition:background .14s,border-color .14s,box-shadow .14s,transform .14s}
.ds-voice-card:hover{background:var(--md-surface-container-highest);transform:translateY(-1px)}
.ds-voice-card.is-active{border-color:var(--voice-accent,var(--md-primary));box-shadow:inset 0 0 0 1px var(--voice-accent,var(--md-primary));background:linear-gradient(135deg,var(--voice-bg,var(--accent-soft)),var(--md-surface-container))}
.ds-voice-card.is-loading{border-color:var(--voice-accent,var(--md-primary));background:var(--md-surface-container-highest)}
.ds-voice-card[data-voice-preset="story"]{--voice-accent:var(--md-primary);--voice-bg:rgba(208,188,255,0.16)}
.ds-voice-card[data-voice-preset="flirty"]{--voice-accent:var(--md-tertiary);--voice-bg:rgba(239,184,200,0.18)}
.ds-voice-card[data-voice-preset="bass"]{--voice-accent:#8FB4FF;--voice-bg:rgba(143,180,255,0.16)}
.ds-voice-card[data-voice-preset="system"]{--voice-accent:var(--md-outline);--voice-bg:rgba(202,196,208,0.10)}
.ds-voice-card[data-say-voice="samantha"]{--voice-accent:var(--md-primary);--voice-bg:rgba(208,188,255,0.16)}
.ds-voice-card[data-say-voice="daniel"]{--voice-accent:#8FB4FF;--voice-bg:rgba(143,180,255,0.16)}
.ds-voice-card[data-kokoro-voice="af_heart"]{--voice-accent:#7DD3C7;--voice-bg:rgba(125,211,199,0.16)}
.ds-voice-card[data-kokoro-voice="af_bella"]{--voice-accent:#EFB8C8;--voice-bg:rgba(239,184,200,0.16)}
.ds-voice-card[data-kokoro-voice="af_nicole"]{--voice-accent:#B7D59B;--voice-bg:rgba(183,213,155,0.16)}
.ds-voice-card[data-kokoro-voice="af_sarah"]{--voice-accent:#BF5AF2;--voice-bg:rgba(191,90,242,0.16)}
.ds-voice-card[data-kokoro-voice="am_adam"]{--voice-accent:#8FB4FF;--voice-bg:rgba(143,180,255,0.16)}
.ds-voice-card[data-kokoro-voice="am_onyx"]{--voice-accent:#7DA7FF;--voice-bg:rgba(125,167,255,0.16)}
.ds-voice-card[data-kokoro-voice="bf_emma"]{--voice-accent:#F6C769;--voice-bg:rgba(246,199,105,0.14)}
.ds-voice-card[data-kokoro-voice="bm_daniel"]{--voice-accent:#9BD67D;--voice-bg:rgba(155,214,125,0.14)}
.ds-voice-badge{width:32px;height:32px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--voice-accent,var(--md-primary));background:var(--voice-bg,var(--accent-soft));letter-spacing:0.02em}
.ds-voice-name{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;line-height:1.2}
.ds-voice-check{display:none;color:var(--voice-accent,var(--md-primary));font-size:12px}
.ds-voice-card.is-active .ds-voice-check{display:inline}
.ds-voice-desc{display:block;margin-top:4px;font-size:11.5px;line-height:1.35;color:var(--muted);text-wrap:pretty}
.ds-settings-row{display:flex;flex-direction:column;align-items:stretch;gap:8px;margin-top:14px}
.ds-settings-label{font-size:12px;color:var(--muted);font-weight:700}
.ds-speed-row{display:flex;gap:8px}
.ds-speed-row button{flex:1;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--muted);font-size:12px;font-weight:800;padding:8px 10px;cursor:pointer}
.ds-speed-row button:hover{background:var(--fill-2);color:var(--text)}
.ds-speed-row button.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container);border-color:transparent}
.ds-playstep{margin-left:auto;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid rgba(10,132,255,0.3);background:rgba(10,132,255,0.08);color:var(--accent-blue);cursor:pointer;font-size:10px;padding:0;line-height:1}
.ds-playstep:hover{background:rgba(10,132,255,0.18)}
.ds-story-tune{position:relative}.ds-story-tune>summary{list-style:none;width:24px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:6px;color:var(--muted);cursor:pointer;font-size:11px}.ds-story-tune>summary::-webkit-details-marker{display:none}.ds-story-tune>summary:hover{background:var(--fill-2);color:var(--text)}
.ds-story-tune>div{position:absolute;right:0;top:calc(100% + 5px);z-index:6;width:142px;padding:5px;border:1px solid var(--line);border-radius:9px;background:var(--material);box-shadow:var(--shadow)}
.ds-story-tune button{width:100%;border:0;border-radius:6px;background:transparent;color:var(--text);font:inherit;font-size:11.5px;font-weight:700;text-align:left;padding:7px 8px;cursor:pointer}.ds-story-tune button:hover{background:var(--fill-2)}
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
  .ds-layout>.ds-rail{position:fixed;top:48px;bottom:0;left:0;z-index:8;max-width:calc(100vw - 48px);box-shadow:var(--shadow)}
  body:not(.ds-rail-collapsed) .ds-rail-scrim{display:block;position:fixed;top:48px;right:0;bottom:0;left:min(var(--ds-rail-width,240px),calc(100vw - 48px));z-index:7;border:0;padding:0;background:var(--scrim);cursor:pointer}
  .ds-main{width:100%}
  .ds-rail-resizer{display:none}
}
@media (max-width:520px){.ds-settings-pop{width:calc(100vw - 24px)}.ds-voice-grid{grid-template-columns:1fr}.ds-voice-head{align-items:stretch;flex-direction:column}.ds-preview{margin-left:0;justify-content:center}}

/* ---- review rounds ---- */
.ds-roundbar{height:40px;flex:none;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 14px;border-bottom:1px solid var(--line-soft);background:var(--panel3)}
.ds-roundbar-copy{display:flex;align-items:center;gap:9px;min-width:0}.ds-roundbadge{flex:none;font-size:10.5px;font-weight:800;color:var(--accent-text);padding:4px 8px;border-radius:999px;background:var(--accent-soft)}
.ds-roundstatus{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ds-roundmodes{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;flex:none}
.ds-roundmodes button{height:27px;border:0;border-left:1px solid var(--line);padding:0 10px;background:transparent;color:var(--muted);font:inherit;font-size:11.5px;font-weight:750;cursor:pointer}.ds-roundmodes button:first-child{border-left:0}.ds-roundmodes button:hover{background:var(--fill-2);color:var(--text)}.ds-roundmodes button.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}.ds-roundmodes button:disabled{opacity:.4;cursor:default}
@media (max-width:620px){.ds-roundbar{height:auto;min-height:44px;padding:7px 9px}.ds-roundstatus{display:none}.ds-roundmodes button{padding:0 8px}}

/* ---- layout ---- */
.ds-layout{flex:1;display:flex;min-height:0}
.ds-rail{position:relative;width:var(--ds-rail-width,316px);flex:none;display:flex;flex-direction:column;border-right:1px solid var(--line-soft);background:var(--md-surface-container-low);min-height:0;overflow:hidden;transition:width .18s ease,border-color .18s ease}
body.ds-rail-collapsed .ds-rail{width:0;min-width:0;max-width:0;border-right-color:transparent}
body.ds-rail-collapsed .ds-rail>*{visibility:hidden;pointer-events:none}
body.ds-sidebar-resizing{cursor:col-resize}
body.ds-sidebar-resizing .ds-rail{transition:none}
body.ds-sidebar-resizing .ds-rail,body.ds-sidebar-resizing .ds-main{user-select:none}
.ds-rail-resizer{position:absolute;top:0;right:0;bottom:0;width:12px;z-index:4;cursor:col-resize;touch-action:none}
.ds-rail-resizer::after{content:'';position:absolute;top:0;right:0;bottom:0;width:2px;background:transparent;transition:background .12s}
.ds-rail-resizer:hover::after,.ds-rail-resizer:focus-visible::after,body.ds-sidebar-resizing .ds-rail-resizer::after{background:var(--md-primary)}
.ds-rail-resizer:focus-visible{outline:none}
.ds-railpad{padding:14px 14px 0;flex:none}
.ds-viewtoggle{display:flex;gap:0;padding:0;border-radius:999px;background:transparent;border:1px solid var(--line);overflow:hidden}
.ds-resume-review{width:100%;display:flex;align-items:center;gap:7px;margin-top:8px;padding:8px 10px;border:0;border-radius:9px;background:var(--accent-soft);color:var(--accent-text);font:inherit;font-size:11.5px;font-weight:700;text-align:left;cursor:pointer}.ds-resume-review:hover{background:var(--md-secondary-container)}.ds-resume-review[hidden]{display:none}
.ds-tab{flex:1;text-align:center;font-size:12.5px;font-weight:700;padding:10px 14px;border-radius:0;border:none;border-left:1px solid var(--line);cursor:pointer;background:transparent;color:var(--muted);
  transition:background .16s,color .16s}
.ds-tab:first-child{border-left:none}
.ds-tab:hover{color:var(--text);background:var(--fill-1)}
.ds-tab.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
.ds-readhead{position:relative;margin:10px 14px 2px;padding:12px 14px 14px;border:none;border-radius:16px;background:var(--md-surface-container);flex:none;overflow:hidden}
.ds-readhead-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ds-readhead-label{font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim2);font-weight:600}
.ds-readhead-count{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:500}
.ds-readhead-track{position:absolute;left:14px;right:14px;bottom:8px;height:3px;background:var(--md-surface-container-highest);border-radius:99px}
.ds-readhead-fill{height:100%;background:var(--md-primary);border-radius:99px;transition:width .25s}
.ds-filetools{display:grid;gap:7px;margin-top:10px}.ds-file-search{height:31px;display:flex;align-items:center;gap:7px;padding:0 9px;border:1px solid var(--line-soft);border-radius:9px;background:var(--panel3);color:var(--dim)}
.ds-file-search:focus-within{border-color:var(--accent-blue);box-shadow:0 0 0 2px var(--accent-soft)}.ds-file-search input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:12px}.ds-file-search input::placeholder{color:var(--dim)}
.ds-filefilters{display:flex;gap:5px;flex-wrap:wrap;padding-bottom:1px}.ds-filefilters button,.ds-next-unviewed{height:25px;flex:none;border:1px solid var(--line-soft);border-radius:999px;background:transparent;color:var(--muted);font:inherit;font-size:10.5px;font-weight:750;padding:0 8px;cursor:pointer}
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
.ds-stepcard.is-intro{width:auto;grid-template-columns:48px 1fr;align-items:center;margin:8px 14px 10px;padding:12px 14px 12px 0;
  border-radius:18px;background:var(--md-surface-container);border:1px solid var(--line-soft);box-shadow:none}
.ds-stepcard.is-intro:hover{background:var(--md-surface-container-high)}
.ds-stepcard.is-intro.is-active{background:var(--md-secondary-container);border-color:transparent;box-shadow:none}
.ds-stepcard.is-intro .ds-num{grid-column:1;width:34px;height:34px;margin:0 0 0 10px;border-radius:12px;border:none;box-shadow:none;
  background:var(--md-surface-container-highest);color:var(--md-primary)}
.ds-stepcard.is-intro.is-active .ds-num{background:rgba(208,188,255,0.16);color:var(--md-on-secondary-container)}
.ds-stepcard.is-intro .ds-stepcard-title{color:var(--text);font-size:13.5px;line-height:1.25}
.ds-stepcard.is-intro.is-active .ds-stepcard-title{color:var(--md-on-secondary-container)}
.ds-intro-cardsub{font-size:11.5px;color:var(--muted);line-height:1.35;margin-top:3px}
.ds-stepcard.is-intro.is-active .ds-intro-cardsub{color:rgba(232,222,248,0.72)}
.ds-step.is-intro{display:block;overflow-y:auto}
.ds-introwrap{max-width:820px;margin:0 auto;padding:64px 40px 80px}
.ds-intro-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--accent-blue)}
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
.ds-storygen-head strong{display:block;margin-top:5px;font-size:19px;font-weight:650;color:var(--text);letter-spacing:-0.01em}
.ds-storygen-head p{max-width:590px;margin:7px 0 0;color:var(--muted);font-size:12.5px;line-height:1.5}
.ds-storygen-eyebrow{font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--dim2);font-weight:800}
.ds-storygen-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.18fr);gap:17px 12px;padding:18px 20px 0;align-items:start}
.ds-storygen-field{display:flex;flex-direction:column;gap:7px;font-size:12px;color:var(--muted);font-weight:700;min-width:0}
.ds-storygen-label{font-size:12px;color:var(--muted);font-weight:800}
.ds-storygen-label b{font-weight:800;color:var(--text);font-variant-numeric:tabular-nums}
.ds-storygen-labelrow{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ds-storygen-optional{font-size:10.5px;font-weight:750;color:var(--muted)}
.ds-storygen-help{display:block;color:var(--muted);font-size:11.5px;font-weight:550;line-height:1.45}
.ds-choicegroup{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;min-height:34px;align-items:stretch;min-width:0}
.ds-field-detail{grid-column:1 / -1;border:0;padding:0;margin:0;min-inline-size:0}
.ds-field-detail>legend{padding:0;margin:0 0 3px}
.ds-depthchoices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:4px}
.ds-depthchoice{position:relative;min-width:0;min-height:142px;display:flex;flex-direction:column;align-items:stretch;gap:9px;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--panel3);color:var(--text);font:inherit;text-align:left;cursor:pointer;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease}
.ds-depthchoice:hover{border-color:rgba(10,132,255,.45);background:var(--fill-1)}
.ds-depthchoice:focus-visible{outline:none;border-color:rgba(10,132,255,.78);box-shadow:0 0 0 3px var(--accent-soft)}
.ds-depthchoice.is-active{border-color:var(--accent-blue);background:var(--accent-soft);box-shadow:inset 0 0 0 1px rgba(10,132,255,.16)}
.ds-depthchoice-top{display:flex;align-items:center;gap:7px;min-width:0}
.ds-depthchoice-top strong{font-size:12.5px;font-weight:850;line-height:1.2}
.ds-depthchoice-radio{width:15px;height:15px;flex:none;border:1.5px solid var(--dim2);border-radius:50%;background:transparent}
.ds-depthchoice.is-active .ds-depthchoice-radio{border:4px solid var(--accent-blue);background:var(--on-accent)}
.ds-depthchoice-badge{margin-left:auto;padding:3px 6px;border-radius:5px;background:var(--fill-2);color:var(--muted);font-size:10.5px;font-weight:850;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap}
.ds-depthchoice-badge.is-recommended{background:var(--accent-blue);color:var(--on-accent)}
.ds-depthchoice-desc{font-size:11.5px;font-weight:600;line-height:1.45;color:var(--muted)}
.ds-depthchoice-meta{margin-top:auto;font-size:10.5px;font-weight:800;color:var(--accent-blue);letter-spacing:.01em}
.ds-field-scope,.ds-field-note{grid-column:1 / -1}
.ds-choice{min-width:0;min-height:34px;border:1px solid var(--line);border-radius:10px;background:var(--panel3);color:var(--muted);font:inherit;font-size:12px;font-weight:800;cursor:pointer;padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ds-choice:hover{border-color:rgba(10,132,255,0.45);color:var(--text);background:var(--fill-1)}
.ds-choice:focus-visible{outline:none;border-color:rgba(10,132,255,0.72);box-shadow:0 0 0 3px var(--accent-soft)}
.ds-choice.is-active{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ds-field-agent.is-wide{grid-column:1 / -1}
.ds-storygen-agent-state{min-height:16px;margin:0;color:var(--muted);font-size:10.5px;font-weight:650;line-height:1.4}.ds-storygen-agent-state[hidden]{display:none}.ds-storygen-agent-state.is-error{color:var(--del-text)}.ds-storygen-agent-state:focus{outline:2px solid var(--accent-blue);outline-offset:2px;border-radius:3px}
.ds-storyscope{grid-column:1 / -1;border:1px solid var(--line-soft);border-radius:12px;background:var(--panel2);overflow:hidden}
.ds-storyscope>summary{min-height:62px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;list-style:none;cursor:pointer}
.ds-storyscope>summary::-webkit-details-marker{display:none}
.ds-storyscope>summary:hover{background:var(--fill-1)}
.ds-storyscope>summary:focus-visible{outline:2px solid var(--accent-blue);outline-offset:-2px}
.ds-storyscope-copy{display:grid;gap:3px;min-width:0}.ds-storyscope-copy small{color:var(--muted);font-size:11px;line-height:1.35}
.ds-storyscope-summary{display:flex;align-items:center;gap:8px;flex:none;color:var(--muted);font-size:10.5px}.ds-storyscope-summary strong{color:var(--text);font-size:11px;font-variant-numeric:tabular-nums}.ds-storyscope-summary strong b{font:inherit}
.ds-storyscope-edit{color:var(--accent-blue);font-weight:800}.ds-storyscope-caret{font-size:16px;color:var(--dim);transform:rotate(0deg);transition:transform .15s ease}.ds-storyscope[open] .ds-storyscope-caret{transform:rotate(180deg)}
.ds-storyscope-body{display:grid;gap:10px;padding:12px 14px 14px;border-top:1px solid var(--line-soft)}
.ds-storyfile-search{height:34px;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--panel3);color:var(--dim)}
.ds-storyfile-search:focus-within{border-color:rgba(10,132,255,.72);box-shadow:0 0 0 3px var(--accent-soft)}
.ds-storyfile-search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:12px;font-weight:650}
.ds-storyfile-search input::placeholder{color:var(--dim)}
.ds-storyscope-actions{display:flex;flex-wrap:nowrap;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:thin}
.ds-scopechip{flex:none;border:1px solid var(--line);border-radius:999px;background:var(--panel3);color:var(--muted);font:inherit;font-size:11.5px;font-weight:800;min-height:28px;padding:0 10px;cursor:pointer;white-space:nowrap}
.ds-scopechip:hover{border-color:rgba(10,132,255,0.45);color:var(--text);background:var(--fill-1)}
.ds-storyfiles{max-height:240px;overflow:auto;border:1px solid var(--line-soft);border-radius:10px;background:var(--panel2)}
.ds-storyfile{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;min-height:34px;padding:7px 10px;border-bottom:1px solid var(--line-soft);font-size:12px;color:var(--text);font-weight:650}
.ds-storyfile:last-child{border-bottom:none}
.ds-storyfile input{width:14px;height:14px;margin:0;accent-color:var(--accent)}
.ds-storyfile-path{font-family:var(--mono);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-storyfile-stat{font-family:var(--mono);font-size:11.5px;white-space:nowrap}
.ds-field-note textarea{width:100%;min-height:96px;resize:vertical;border:1px solid var(--line);border-radius:10px;background:var(--panel3);color:var(--text);font:inherit;font-size:12.5px;font-weight:600;line-height:1.45;padding:10px 11px}
.ds-field-note textarea:focus{outline:none;border-color:rgba(10,132,255,0.72);box-shadow:0 0 0 3px var(--accent-soft)}
.ds-storyscope-error{margin:0;padding:9px 10px;border-radius:8px;background:var(--del-bg);color:var(--del-text);font-size:11.5px;font-weight:700}.ds-storyscope-error[hidden]{display:none}.ds-storyscope-error:focus{outline:2px solid var(--del);outline-offset:2px}
.ds-storygen-button{margin:18px 20px 20px;width:calc(100% - 40px)}
.ds-storygen-button:disabled{opacity:.5;cursor:not-allowed}
.ds-storygen-warn{margin:0 17px 17px;padding:11px 12px;border:1px solid rgba(255,159,10,0.32);border-radius:10px;background:var(--amber-soft);color:var(--text);font-size:12.5px;line-height:1.45;display:flex;align-items:center;gap:10px}
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
.ds-why{margin:17px 30px 0;padding:15px 17px;border-radius:13px;background:rgba(10,132,255,0.07);border:1px solid rgba(10,132,255,0.2);flex:none;max-height:min(24vh,190px);overflow-y:auto}
.ds-why-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.ds-why-ico{width:15px;height:15px;border-radius:4px;background:rgba(10,132,255,0.2);display:flex;align-items:center;justify-content:center;position:relative}
.ds-why-ico::after{content:'';width:5px;height:5px;border-radius:50%;background:var(--accent-blue)}
.ds-why-label{font-size:10.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--accent-blue);font-weight:600}
.ds-why-text{margin:0;font-size:14px;line-height:1.58;color:var(--text);text-wrap:pretty}
.ds-beats{display:grid;gap:8px}
.ds-beat{width:100%;margin:0;padding:6px;display:grid;grid-template-columns:22px 1fr;gap:9px;align-items:start;border:1px solid transparent;border-radius:9px;background:transparent;font:inherit;font-size:14px;line-height:1.52;color:var(--text);text-align:left;text-wrap:pretty;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.ds-beat:hover{background:var(--fill-2)}
.ds-beat:focus-visible{outline:2px solid var(--accent-blue);outline-offset:2px}
.ds-beat-index{width:22px;height:22px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;background:rgba(10,132,255,0.12);color:var(--accent-blue);font-size:11px;font-weight:800}
.ds-beat.is-selected{border-color:rgba(10,132,255,0.28);background:rgba(10,132,255,0.07)}
.ds-beat.is-selected .ds-beat-index{box-shadow:inset 0 0 0 1px var(--accent-blue)}
.ds-beat.is-active .ds-beat-index{background:var(--accent-blue);color:var(--on-accent)}
.ds-beat.is-active .ds-beat-text{color:var(--accent-text)}

/* ---- comments ---- */
.ds-thread{padding:14px 16px 16px 50px;background:var(--panel2);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);
  font-family:var(--sans);display:flex;flex-direction:column;gap:12px}
.ds-comment{padding:0;background:transparent;border:0;font-family:var(--sans);animation:dsIn .18s ease}
.ds-comment-card{display:flex;flex-direction:column;gap:8px;border:0;border-radius:0;overflow:visible;background:transparent}
.flavor-change{border-color:rgba(255,69,58,0.45)}
.flavor-question{border-color:rgba(10,132,255,0.5)}
.flavor-nit{border-color:rgba(255,159,10,0.45)}
.ds-comment-head{align-self:flex-end;max-width:min(760px,92%);display:flex;align-items:center;gap:8px;padding:0 2px;color:var(--muted)}
.flavor-change .ds-comment-head,.flavor-question .ds-comment-head,.flavor-nit .ds-comment-head{background:transparent}
.ds-flavor-ico{width:18px;height:18px;border-radius:5px;color:var(--on-accent);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
.flavor-change .ds-flavor-ico{background:rgba(255,69,58,0.45)}
.flavor-question .ds-flavor-ico{background:rgba(10,132,255,0.5)}
.flavor-nit .ds-flavor-ico{background:rgba(255,159,10,0.45)}
.ds-flavor-label{font-size:12px;font-weight:600}
.flavor-change .ds-flavor-label{color:var(--del-text)}
.flavor-question .ds-flavor-label{color:var(--accent-text)}
.flavor-nit .ds-flavor-label{color:var(--amber-text)}
.ds-comment-author{font-size:12px;color:var(--text);font-weight:500}
.ds-comment-selection{align-self:flex-end;max-width:min(760px,92%);padding:9px 11px;border:1px solid var(--line-soft);border-radius:8px;background:var(--panel3);display:grid;gap:5px}
.ds-comment-selection span{font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim2);font-weight:700}
.ds-comment-selection code{font-family:var(--mono);font-size:12px;line-height:1.45;color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere}
.ds-statusbadge{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:6px}
.status-open .ds-statusbadge{color:var(--amber);background:rgba(255,159,10,0.12)}
.status-open .ds-statusbadge .ds-dot{background:var(--amber)}
.status-addressed .ds-statusbadge{color:var(--accent-blue);background:rgba(10,132,255,0.12)}
.status-addressed .ds-statusbadge .ds-dot{background:var(--accent-blue)}
.status-resolved .ds-statusbadge{color:var(--add);background:rgba(48,209,88,0.14)}
.status-resolved .ds-statusbadge .ds-dot{background:var(--add)}
.ds-comment-body{align-self:flex-end;max-width:min(760px,92%);padding:10px 12px;font-size:13px;line-height:1.55;color:var(--text);
  border:1px solid var(--line-soft);border-radius:8px 8px 2px 8px;background:var(--md-surface-container-high)}
.ds-turn-user{margin-top:2px}
.ds-reply{align-self:flex-start;width:min(960px,100%);display:flex;gap:10px;padding:0;border:0;background:transparent}
.ds-reply-av{flex:none;width:28px;height:28px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--on-accent)}
.ds-reply-main{min-width:0;max-width:min(900px,calc(100% - 38px))}
.ds-reply-who{display:flex;align-items:center;gap:7px;margin-bottom:3px}
.ds-reply-name{font-size:12px;font-weight:600;color:var(--accent-blue)}
.ds-ai-badge{font-size:9.5px;font-weight:700;letter-spacing:0.04em;color:var(--accent-blue);background:rgba(10,132,255,0.14);padding:1px 6px;border-radius:4px}
.ds-reply-body{padding:12px 14px;border:1px solid rgba(10,132,255,0.24);border-radius:8px 8px 8px 2px;background:rgba(10,132,255,0.06);
  font-size:13px;line-height:1.58;color:var(--text)}
.ds-md{white-space:normal;overflow-wrap:anywhere}
.ds-md p{margin:0}
.ds-md p+p,.ds-md p+ul,.ds-md p+ol,.ds-md p+blockquote,.ds-md p+.ds-md-code,.ds-md ul+p,.ds-md ol+p,.ds-md blockquote+p,.ds-md .ds-md-code+p{margin-top:10px}
.ds-md strong{font-weight:750;color:var(--text)}
.ds-md em{font-style:italic;color:var(--text)}
.ds-md code{font-family:var(--mono);font-size:.94em;color:var(--text);background:var(--fill-3);border:1px solid var(--line-soft);border-radius:5px;padding:1px 4px;white-space:break-spaces}
.ds-md ul,.ds-md ol{margin:8px 0 0;padding-left:22px}
.ds-md li{padding-left:2px}
.ds-md li+li{margin-top:4px}
.ds-md blockquote{margin:10px 0 0;padding:0 0 0 12px;border-left:2px solid var(--accent);color:var(--muted)}
.ds-md .ds-md-code{margin:10px 0 0;padding:10px 12px;border:1px solid var(--line-soft);border-radius:8px;background:var(--gutter);overflow:auto}
.ds-md .ds-md-code code{display:block;padding:0;border:0;border-radius:0;background:transparent;white-space:pre;overflow-wrap:normal}
.ds-comment-actions{align-self:flex-end;display:flex;gap:8px;padding:0 2px}
.ds-send{color:var(--accent-blue)}
.ds-addall{font:inherit;font-size:11.5px;font-weight:600;color:var(--accent-blue);background:rgba(10,132,255,0.10);border:1px solid var(--line);padding:4px 10px;border-radius:7px;cursor:pointer}
.ds-addall:disabled{opacity:.45;cursor:default}
.ds-ghost{font-size:12px;font-weight:500;color:var(--text);padding:6px 12px;border-radius:7px;border:1px solid var(--line);background:transparent;cursor:pointer}
.ds-ghost:hover{background:var(--fill-2)}
.ds-composer{padding:12px 16px 14px 50px;background:var(--panel2);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);
  font-family:var(--sans);animation:dsIn .15s ease}
.ds-composer-selection{margin:0 0 10px;padding:10px 11px;border:1px solid var(--line-soft);border-radius:8px;background:var(--panel3);font-family:var(--mono);
  font-size:12px;line-height:1.45;color:var(--muted);white-space:pre-wrap;overflow-wrap:anywhere}
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
.ds-agent-route{min-width:0;display:flex;align-items:center;gap:6px;color:var(--muted);font-size:11px;line-height:1.2}
.ds-agent-route-icon{width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:6px;background:var(--accent-soft);color:var(--accent-text);font-size:9px}
.ds-agent-route strong{min-width:0;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:11.5px}
.ds-agent-route button{border:0;background:transparent;color:var(--accent-text);font:inherit;font-size:11px;font-weight:750;padding:3px 4px;border-radius:5px;cursor:pointer}.ds-agent-route button:hover{background:var(--accent-soft)}
.ds-composer-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px}.ds-composer-actions{display:flex;justify-content:flex-end;gap:8px;flex:none}
.ds-agent-chooser{position:fixed;inset:0;z-index:120;display:flex;align-items:flex-start;justify-content:center;padding:clamp(44px,10vh,110px) 12px 24px}
.ds-agent-chooser-scrim{position:absolute;inset:0;border:0;background:var(--scrim);cursor:default}
.ds-agent-chooser-panel{position:relative;width:560px;max-width:100%;max-height:min(720px,82vh);display:flex;flex-direction:column;overflow:hidden;
  border:1px solid var(--line);border-radius:18px;background:var(--material);box-shadow:0 28px 90px rgba(0,0,0,.48)}
.ds-agent-chooser-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:18px 18px 14px;border-bottom:1px solid var(--line-soft)}
.ds-agent-chooser-title{font-size:16px;font-weight:850;color:var(--text)}
.ds-agent-chooser-sub{font-size:12px;line-height:1.4;color:var(--muted);margin-top:4px}
.ds-agent-chooser-close{flex:none;width:30px;height:30px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--muted);font-size:17px;cursor:pointer}
.ds-agent-chooser-close:hover{background:var(--fill-2);color:var(--text)}
.ds-agent-task-search{margin:12px 14px 6px;height:36px;box-sizing:border-box;border:1px solid var(--line);border-radius:9px;background:var(--panel3);color:var(--text);font:inherit;font-size:12.5px;padding:0 11px;outline:none}
.ds-agent-task-search:focus{border-color:var(--accent-blue)}
.ds-agent-task-list{padding:7px 10px 12px;display:grid;gap:4px;overflow:auto}
.ds-agent-task-option{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;text-align:left;border:0;border-radius:11px;
  background:transparent;color:var(--text);padding:11px 12px;cursor:pointer}
.ds-agent-task-option:hover,.ds-agent-task-option:focus-visible{background:var(--fill-2);outline:none}
.ds-agent-task-option.is-primary{background:transparent;color:var(--text);margin-bottom:3px}.ds-agent-task-option.is-primary .ds-agent-task-main strong{color:var(--accent-text)}
.ds-agent-task-option.is-selected{box-shadow:inset 0 0 0 1px var(--accent-blue);background:var(--accent-soft)}
.ds-agent-task-main{min-width:0;display:grid;gap:3px}.ds-agent-task-main strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-agent-task-main small{font-size:11px;line-height:1.35;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-agent-task-meta{font-size:10.5px;color:var(--dim);white-space:nowrap}.ds-agent-task-option.is-selected .ds-agent-task-meta{color:var(--accent-text);font-weight:800}.ds-agent-task-empty{padding:20px 12px;text-align:center;font-size:12px;color:var(--muted)}
.ds-agent-task-section{padding:9px 12px 4px;font-size:9.5px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:var(--dim2)}
@media (max-width:620px){.ds-agent-chooser{align-items:flex-end;padding:12px 8px 8px}.ds-agent-chooser-panel{width:100%;max-height:88vh;border-radius:18px 18px 12px 12px}.ds-composer-foot,.ds-thread-composer-foot{align-items:stretch;flex-direction:column}.ds-composer-actions,.ds-thread-actions{justify-content:flex-end}.ds-agent-route strong{max-width:150px}}

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
.ds-filepanel-body{position:relative;flex:1;padding-bottom:40px}
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
.ds-filetree{display:flex;flex-direction:column;gap:1px}
.ds-filetree-dir{margin:1px 0}
.ds-filetree-dir>summary{list-style:none;display:flex;align-items:center;gap:8px;width:100%;min-height:31px;padding:7px 8px 7px calc(10px + var(--tree-indent,0px));border-radius:8px;color:var(--muted);cursor:pointer;user-select:none}
.ds-filetree-dir>summary::-webkit-details-marker{display:none}
.ds-filetree-dir>summary:hover{background:var(--fill-1);color:var(--text)}
.ds-filetree-caret{flex:none;width:10px;color:var(--dim);font-size:15px;line-height:1;transform-origin:center;transition:transform .12s ease}
.ds-filetree-dir[open]>summary .ds-filetree-caret{transform:rotate(90deg)}
.ds-filetree-folder{flex:none;width:9px;height:7px;border-radius:2px;background:var(--fill-3);box-shadow:inset 0 0 0 1px var(--line-soft)}
.ds-filetree-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:12.5px;font-weight:650;color:var(--text)}
.ds-filetree-count{flex:none;font-size:10.5px;color:var(--dim);font-weight:650}
.ds-filetree-stat{flex:none;font-family:var(--mono);font-size:11.5px;font-variant-numeric:tabular-nums;display:flex;gap:6px}
.ds-filetree-children{display:flex;flex-direction:column;gap:1px}
.ds-fileitem{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:none;background:transparent;cursor:pointer;padding:8px 10px 8px calc(10px + var(--tree-indent,0px));border-radius:8px;font-family:var(--sans);margin-bottom:1px}
.ds-fileitem:hover{background:var(--fill-1)}
.ds-fileitem.is-active{background:var(--fill-2)}
.ds-fileitem-dot{flex:none;width:8px;height:8px;border-radius:2px}
.ds-fileitem-dot.k-changed{background:var(--accent-blue)}
.ds-fileitem-dot.k-new{background:var(--add)}
.ds-fileitem-dot.k-context{background:var(--muted)}
.ds-fileitem-path{flex:1;min-width:0;font-family:var(--mono);font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ds-fileitem-path .ds-dim{color:var(--dim)}
.ds-fileitem-base{color:var(--text);font-weight:600}
.ds-fileitem-flag{flex:none;color:var(--amber);font-size:9px}
.ds-fileitem-stat{flex:none;font-family:var(--mono);font-size:11.5px;font-variant-numeric:tabular-nums;display:flex;gap:6px}
.ds-fileitem[hidden],.ds-filetree-dir[hidden]{display:none}
.ds-empty-rail{padding:24px 14px;font-size:12.5px}
@media (max-width:720px){
  .ds-viewtoggle .ds-tab{min-height:44px;padding-top:12px;padding-bottom:12px}
  .ds-filetree-dir>summary,.ds-fileitem{min-height:44px}
  .ds-fileitem{gap:7px;padding-right:7px;padding-left:calc(7px + var(--tree-indent,0px))}
  .ds-fileitem-stat{gap:3px;font-size:10.5px}
  .ds-filetree-count{display:none}
}

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

/* ---- feedback verification + timeline ---- */
.ds-drawer-tabs{display:flex;padding:10px 14px 0;gap:4px}.ds-drawer-tabs button{flex:1;height:34px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:800;cursor:pointer}.ds-drawer-tabs button:hover{background:var(--fill-2);color:var(--text)}.ds-drawer-tabs button.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}.ds-drawer-tabs button span{margin-left:4px}
.ds-feedback-filters{display:flex;gap:5px;padding:10px 14px;border-bottom:1px solid var(--line-soft);overflow-x:auto}.ds-feedback-filters button{flex:none;height:26px;border:1px solid var(--line-soft);border-radius:999px;background:transparent;color:var(--muted);font:inherit;font-size:10.5px;font-weight:750;padding:0 8px;cursor:pointer}.ds-feedback-filters button.is-active{border-color:transparent;background:var(--accent-soft);color:var(--accent-text)}
.ds-feedback-list{display:grid;align-content:start;gap:11px}.ds-feedback-card{display:grid;gap:9px;padding:13px;border:1px solid var(--line-soft);border-radius:12px;background:var(--panel3)}.ds-feedback-head{display:flex;align-items:center;gap:8px}.ds-feedback-path{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--mono);font-size:11.5px;color:var(--text)}
.ds-anchorbadge{flex:none;font-size:9.5px;font-weight:800;padding:3px 6px;border-radius:999px;color:var(--muted);background:var(--fill-2)}.ds-anchorbadge.is-changed,.ds-anchorbadge.is-moved{color:var(--amber-text);background:var(--amber-soft)}.ds-feedback-selection{display:block;max-height:82px;overflow:auto;white-space:pre-wrap;font-family:var(--mono);font-size:11.5px;line-height:1.4;padding:8px 9px;border-radius:7px;background:var(--gutter);color:var(--muted)}
.ds-feedback-message{font-size:12.5px;line-height:1.45}.ds-feedback-reply{padding:10px;border-left:2px solid var(--accent-blue);background:var(--accent-soft);border-radius:0 8px 8px 0;font-size:12px;line-height:1.45}.ds-feedback-reply>span{display:block;margin-bottom:4px;color:var(--accent-text);font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.08em}.ds-feedback-actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}.ds-drawer-empty{padding:30px 12px;text-align:center;color:var(--muted);font-size:12.5px}
.ds-review-timeline{list-style:none;margin:0;padding:0;display:grid;gap:0}.ds-timeline-event{position:relative;display:grid;grid-template-columns:16px 1fr;gap:9px;padding:0 0 18px}.ds-timeline-event:not(:last-child)::before{content:'';position:absolute;left:5px;top:12px;bottom:0;width:1px;background:var(--line)}.ds-timeline-dot{position:relative;z-index:1;width:11px;height:11px;margin-top:3px;border-radius:50%;background:var(--accent-blue);box-shadow:0 0 0 3px var(--accent-soft)}.ds-timeline-event div{display:grid;gap:3px}.ds-timeline-event strong{font-size:12.5px}.ds-timeline-event span:not(.ds-timeline-dot){font-size:11.5px;color:var(--muted);line-height:1.4}.ds-timeline-event small{font-size:10.5px;color:var(--dim)}

/* ---- misc ---- */
.ds-empty{padding:60px 40px;text-align:center;color:var(--muted)}
.ds-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(12px);max-width:540px;
  background:var(--material);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border:1px solid var(--line);color:var(--text);font-size:13px;line-height:1.45;
  padding:12px 16px;border-radius:11px;box-shadow:var(--shadow);opacity:0;transition:opacity .2s,transform .2s;z-index:80;pointer-events:none}
.ds-toast.is-show{opacity:1;transform:translateX(-50%) translateY(0)}
.ds-selection-menu{position:fixed;z-index:90;min-width:168px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--material);box-shadow:var(--shadow)}
.ds-selection-menu[hidden]{display:none}
.ds-selection-menu button{width:100%;display:block;border:none;border-radius:7px;background:transparent;color:var(--text);font-size:13px;font-weight:700;text-align:left;padding:8px 10px;cursor:pointer}
.ds-selection-menu button:hover{background:var(--fill-2)}
.ds-selection-quick{position:fixed;z-index:89;display:flex;padding:4px;border:1px solid var(--line);border-radius:10px;background:var(--material);box-shadow:var(--shadow)}.ds-selection-quick[hidden]{display:none}.ds-selection-quick button{height:29px;border:0;border-left:1px solid var(--line-soft);background:transparent;color:var(--text);font:inherit;font-size:11.5px;font-weight:750;padding:0 9px;cursor:pointer}.ds-selection-quick button:first-child{border-left:0}.ds-selection-quick button:hover{background:var(--fill-2)}
.ds-command-root{position:fixed;inset:0;z-index:100;display:flex;align-items:flex-start;justify-content:center;padding-top:min(16vh,140px)}.ds-command-root[hidden]{display:none}.ds-command-scrim{position:absolute;inset:0;border:0;background:var(--scrim)}.ds-command{position:relative;width:520px;max-width:calc(100vw - 24px);max-height:74vh;overflow:auto;border:1px solid var(--line);border-radius:16px;background:var(--material);box-shadow:0 24px 80px rgba(0,0,0,.48)}
.ds-command-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid var(--line-soft)}.ds-command-head>div{display:grid;gap:3px}.ds-command-head strong{font-size:15px}.ds-command-head span{font-size:11.5px;color:var(--muted)}.ds-command-head>button{width:28px;height:28px;border:1px solid var(--line);border-radius:7px;background:transparent;color:var(--muted);cursor:pointer}.ds-command-list{padding:7px}.ds-command-list>button{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:9px;background:transparent;color:var(--text);font:inherit;text-align:left;padding:10px;cursor:pointer}.ds-command-list>button:hover{background:var(--fill-2)}.ds-command-list>button>span{display:grid;gap:2px}.ds-command-list strong{font-size:12.5px}.ds-command-list small{font-size:11px;color:var(--muted)}.ds-command-list kbd{flex:none}.ds-command-foot{display:flex;gap:14px;flex-wrap:wrap;padding:10px 16px 13px;border-top:1px solid var(--line-soft);font-size:10.5px;color:var(--dim)}.ds-command-foot span{display:flex;align-items:center;gap:4px}
.ds-green{color:var(--add)}
.ds-thread-composer{align-self:stretch;display:grid;gap:8px;margin-top:8px}
.ds-thread-ta{flex:1;min-width:0;resize:none;font:inherit;font-size:13px;line-height:1.5;color:var(--text);background:var(--panel3);border:1px solid var(--line-soft);border-radius:10px;padding:9px 12px;max-height:160px}
.ds-thread-ta:focus{outline:none;border-color:var(--accent-blue)}
.ds-thread-ta:disabled{opacity:0.5}
.ds-thread-composer-foot{display:flex;align-items:center;justify-content:space-between;gap:12px}.ds-thread-actions{display:flex;align-items:center;gap:8px;flex:none}.ds-thread-send{flex:none;align-self:flex-end}
.ds-composer-add,.ds-thread-add{color:var(--accent-blue);border-color:var(--accent-blue)}
@media (max-width:620px){.ds-thread-composer-foot{align-items:stretch}}
`;
export const PAGE_CSS = sharedTokens() + PAGE_CSS_CORE + DIFF_CSS;
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
  var STATUS={open:'Open',addressed:'Needs verification',resolved:'Resolved'};
  var tourView,filesView,drawer,feedbackDrawer,commandRoot,toastEl,selectionMenu,selectionQuick,selectionContext=null,stepPanels,stepCards,total=1,active=0,visited={0:true},toastTimer,speechTimer,storyFocusIndex=-1,storyFocusGroup=-1,voiceFocusIndex=-1,voiceFocusGroup=-1,voiceFocusTimers=[],voiceSequenceToken=0,currentSpeechStep=-1,currentSpeechUnit=-1,currentSpeechManual=false,sidebarReturnFocus=null,reviewMenuReturnFocus=null,agentChooserReturnFocus=null;
  var filePanels=[],fileItems=[],selectedFile=-1,sidebarResizing=false,readAloud=false,rate=1.05,voicePreset='story',voiceEngine='browser',sayVoice='samantha',kokoroVoice='af_heart',voices=[],activeUtterance=null,localAudio=null,localAudioToken=0,speechAbort=null,speechLoadingLabel='',speechLoadingMode='',speechLoadingEngine='',speechLoadingVoice='',prefetchedSpeech={},speechPrefetchAbort=null,speechPrefetchKey='';
  var activeFileFilter='all',restoringReviewPosition=false,reviewSaveTimer=null,reviewPositionReady=false;
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
      b.classList.toggle('is-active',collapsed);
      b.setAttribute('aria-expanded',collapsed?'false':'true');
      b.setAttribute('aria-label',collapsed?'Expand sidebar':'Collapse sidebar');
      b.setAttribute('title',collapsed?'Expand sidebar':'Collapse sidebar');
    });
    syncSidebarOverlay(collapsed);
  }
  function compactScreen(){return !!(window.matchMedia&&window.matchMedia('(max-width:720px)').matches);}
  function syncSidebarOverlay(collapsed){
    var open=compactScreen()&&!collapsed,main=$('.ds-main'),scrim=$('[data-sidebar-scrim]');
    if(main){if(open)main.setAttribute('inert','');else main.removeAttribute('inert');}
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
  function trackSelectionSide(e){
    var code=codeForNode(e.target);
    clearSelectionSide();
    if(!code)return;
    var side=code.getAttribute('data-comment-side')||'right';
    document.body.classList.add(side==='left'?'ds-selecting-left':'ds-selecting-right');
  }
  function releaseSelectionSide(){
    setTimeout(function(){
      var sel=window.getSelection&&window.getSelection();
      if(!sel||sel.rangeCount===0||sel.isCollapsed){clearSelectionSide();closeSelectionQuick();return;}
      showSelectionQuick();
    },0);
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
    if(!startCode||!endCode)return null;
    var intendedSide=startCode.getAttribute('data-comment-side')||'right';
    if((endCode.getAttribute('data-comment-side')||'right')!==intendedSide)return null;
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
  function closeSelectionQuick(){if(selectionQuick)selectionQuick.hidden=true;}
  function positionSelectionPopup(node,rect){
    if(!node||!rect)return;
    node.hidden=false;
    var w=node.offsetWidth||170,h=node.offsetHeight||38;
    var vw=window.innerWidth||document.documentElement.clientWidth||0;
    var vh=window.innerHeight||document.documentElement.clientHeight||0;
    var x=Math.max(8,Math.min(rect.left+(rect.width-w)/2,vw-w-8));
    var y=rect.top-h-8;if(y<8)y=Math.min(vh-h-8,rect.bottom+8);
    node.style.left=Math.round(x)+'px';node.style.top=Math.round(y)+'px';
  }
  function showSelectionQuick(){
    var ctx=currentSelectionContext();if(!ctx){closeSelectionQuick();return;}
    selectionContext=ctx;
    var sel=window.getSelection&&window.getSelection();if(!sel||!sel.rangeCount)return;
    var rect=sel.getRangeAt(0).getBoundingClientRect();
    if(!rect||(!rect.width&&!rect.height)){closeSelectionQuick();return;}
    positionSelectionPopup(selectionQuick||$('[data-selection-quick]'),rect);
  }
  function copySelectionContext(){
    var ctx=selectionContext||currentSelectionContext();if(!ctx)return;
    var done=function(){toast('Selected code copied');closeSelectionQuick();};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(ctx.selectedText).then(done).catch(function(){toast('Could not copy selected code');});
    else{toast('Copy is unavailable in this browser');}
  }
  function openSelectionMenu(e){
    if(!codeForNode(e.target))return;
    var ctx=currentSelectionContext();
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
    closeSelectionQuick();
  }
  function sidebarBounds(){
    var vw=window.innerWidth||document.documentElement.clientWidth||0;
    var min=240,max=Math.min(560,Math.max(min,vw-360));
    return {min:min,max:max};
  }
  function currentSidebarWidth(){
    var raw=(document.documentElement.style.getPropertyValue('--ds-rail-width')||getComputedStyle(document.documentElement).getPropertyValue('--ds-rail-width')||'316').replace('px','');
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
    document.documentElement.style.setProperty('--ds-rail-width',width+'px');
    updateSidebarHandle(width);
    if(persist){try{localStorage.setItem('ds-sidebar-width',String(Math.round(width)));}catch(e){}}
  }

  function setView(v){
    if(tourView)tourView.hidden=v!=='tour';
    if(filesView)filesView.hidden=v!=='files';
    $all('.ds-tab').forEach(function(t){var on=t.getAttribute('data-view')===v;t.classList.toggle('is-active',on);t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;});
    $all('[data-rail]').forEach(function(r){r.hidden=r.getAttribute('data-rail')!==v;});
    revealResumeReview();
    if(v==='files'&&selectedFile<0)selectFile(0);
    if(v!=='tour'){readAloud=false;try{localStorage.setItem('ds-readaloud','');}catch(e){}cancelSpeech();}
    saveReviewPositionSoon();
  }

  function activateStep(i,autoSpeak){
    if(i<0)i=0;if(i>total-1)i=total-1;active=i;visited[i]=true;
    if(!readAloud)clearVoiceFocus();
    stepPanels.forEach(function(p,idx){p.hidden=idx!==i;});
    stepCards.forEach(function(c,idx){
      var isA=idx===i,isV=visited[idx]&&!isA;
      c.classList.toggle('is-active',isA);
      c.classList.toggle('is-visited',isV);
      // Index 0 is the Overview — leave its mark alone; real steps keep stable numbers.
      var num=$('.ds-num',c);if(num&&!c.hasAttribute('data-intro'))num.textContent=String(idx);
    });
    var steps=total-1; // real steps, with the Overview excluded
    var pt=$('#ds-progress-text');if(pt)pt.textContent=i===0?'Overview':(i+' / '+steps);
    var pf=$('#ds-progress-fill');if(pf)pf.style.width=(i===0||!steps?0:(i/steps*100))+'%';
    if(tourView)tourView.scrollTop=0;
    var ap=stepPanels[i];if(ap)ap.scrollTop=0;
    applyResponsiveStoryMode(ap);
    if(i===0)clearStoryFocus();
    var storyFocused=ap&&i>0?selectStoryFocus(i,0,true):false;
    if(ap&&!storyFocused)jumpToFirstChange($('.ds-diff',ap));
    if(autoSpeak!==false){var spoke=speakStep(i);if(!spoke)prefetchNextSpeech(i);}
    saveReviewPositionSoon();
  }
  function setActive(i){activateStep(i,true);}
  function clearSpeechCursor(){
    currentSpeechStep=-1;currentSpeechUnit=-1;currentSpeechManual=false;
  }

  function clearVoiceFocus(){
    voiceFocusTimers.forEach(function(t){clearTimeout(t);});
    voiceFocusTimers=[];
    voiceFocusIndex=-1;
    voiceFocusGroup=-1;
    $all('.ds-step.is-voice-active').forEach(function(p){p.classList.remove('is-voice-active');});
    $all('.ds-row.is-voice-focus,.ds-urow.is-voice-focus').forEach(function(r){r.classList.remove('is-voice-focus');});
    clearActiveBeats();
  }
  function clearActiveBeats(){
    $all('.ds-beat.is-active').forEach(function(b){b.classList.remove('is-active');});
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
  function centerFocusRows(rows,instant){
    if(!rows.length)return;
    var target=rows[Math.floor((rows.length-1)/2)];if(!target||!target.scrollIntoView)return;
    setTimeout(function(){
      try{target.scrollIntoView({block:'center',inline:'nearest',behavior:instant?'auto':'smooth'});}
      catch(e){try{target.scrollIntoView(false);}catch(ignore){}}
    },instant?0:120);
  }
  function clearStoryFocus(){
    storyFocusIndex=-1;storyFocusGroup=-1;
    $all('.ds-step.is-story-active').forEach(function(p){p.classList.remove('is-story-active');});
    $all('.ds-row.is-story-focus,.ds-urow.is-story-focus').forEach(function(r){r.classList.remove('is-story-focus');});
    $all('.ds-beat.is-selected').forEach(function(b){b.classList.remove('is-selected');b.setAttribute('aria-pressed','false');});
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
    var overview=$all('[data-speech-overview]',panel);
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
  function setRate(r){rate=r;try{localStorage.setItem('ds-rate',String(r));}catch(e){}$all('[data-rate]').forEach(function(b){b.classList.toggle('is-active',parseFloat(b.getAttribute('data-rate'))===r);});if(readAloud)restartReadAloud();}
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
    $all('[data-voice-engine]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-voice-engine')===voiceEngine);});
    var browserGrid=$('[data-browser-voices]'),sayGrid=$('[data-say-voices]'),kokoroGrid=$('[data-kokoro-voices]');
    if(browserGrid)browserGrid.hidden=voiceEngine!=='browser';
    if(sayGrid)sayGrid.hidden=voiceEngine!=='say';
    if(kokoroGrid)kokoroGrid.hidden=voiceEngine!=='kokoro';
    $all('[data-voice-preset]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-voice-preset')===voicePreset);});
    $all('[data-say-voice]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-say-voice')===sayVoice);b.classList.toggle('is-loading',speechLoadingEngine==='say'&&b.getAttribute('data-say-voice')===speechLoadingVoice);});
    $all('[data-kokoro-voice]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-kokoro-voice')===kokoroVoice);b.classList.toggle('is-loading',speechLoadingEngine==='kokoro'&&b.getAttribute('data-kokoro-voice')===speechLoadingVoice);});
    var s=$('[data-voice-status]');if(s)s.textContent=speechLoadingLabel?speechLoadingLabel+'…':describeVoice();
  }
  function updateReadAloudButton(){
    var btn=$('[data-readaloud]');if(!btn)return;
    var label=$('[data-readaloud-label]',btn),ico=$('.ds-readaloud-ico',btn);
    var loading=!!speechLoadingLabel;
    btn.classList.toggle('is-active',readAloud);
    btn.classList.toggle('is-loading',loading&&speechLoadingMode!=='preview');
    btn.setAttribute('aria-busy',loading?'true':'false');
    btn.setAttribute('aria-pressed',readAloud?'true':'false');
    if(label)label.textContent=speechLoadingLabel||(readAloud?'Stop':'Read aloud');
    if(ico)ico.textContent=loading?'◌':(readAloud?'■':'▶');
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
    toast(msg);
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
    a.onerror=function(){if(localAudio===a)localAudio=null;if(activeUtterance===a)activeUtterance=null;if(opts.stepIndex!=null)clearVoiceFocus();if(btn)btn.classList.remove('is-speaking');updateReadAloudButton();toast((engine==='kokoro'?'Kokoro voice':'Mac local voice')+' could not play; falling back to browser voice.');voiceEngine='browser';updateVoiceControls();speak(text,opts);};
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
      .catch(function(err){if(token!==localAudioToken)return;if(speechAbort===ctrl)speechAbort=null;clearGeneratedSpeechLoading(token);if(isAbortError(err))return;if(localAudio){try{localAudio.pause();}catch(e){}}localAudio=null;activeUtterance=null;if(opts.stepIndex!=null)clearVoiceFocus();if(btn)btn.classList.remove('is-speaking');updateReadAloudButton();toast((engine==='kokoro'?'Kokoro failed: '+err.message:'Mac local voice is unavailable; using browser voice.'));voiceEngine='browser';updateVoiceControls();speak(text,opts);});
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

  function selectFile(i){
    if(!filePanels.length)return;
    if(i<0)i=0;if(i>filePanels.length-1)i=filePanels.length-1;
    selectedFile=i;
    filePanels.forEach(function(p,idx){p.hidden=idx!==i;});
    fileItems.forEach(function(it){it.classList.toggle('is-active',Number(it.getAttribute('data-file-index'))===i);});
    var panel=filePanels[i];
    applyFilesMode(panel);
    var detail=$('#ds-file-detail');if(detail)detail.scrollTop=0;
    jumpToFirstChange(panel);
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
    return {view:view,step:active,file:filePanels[selectedFile]?filePanels[selectedFile].getAttribute('data-file'):'',scroll:Math.round(scroll||0),mode:document.body.getAttribute('data-current-review-mode')||'full'};
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
    btn.hidden=!text||!inFiles;if(text&&label)label.textContent=text;
  }
  function restoreReviewPosition(){
    var state=storedReviewPosition();if(!state)return;
    restoringReviewPosition=true;
    if(state.view==='files'){
      setView('files');if(state.file)selectFileByPath(state.file);
      setTimeout(function(){var d=$('#ds-file-detail');if(d)d.scrollTop=Number(state.scroll)||0;restoringReviewPosition=false;},0);
    }else{
      setView('tour');activateStep(Number(state.step)||0,false);
      setTimeout(function(){var p=stepPanels[active],d=p&&$('.ds-diffscroll',p);if(d)d.scrollTop=Number(state.scroll)||0;restoringReviewPosition=false;},0);
    }
    setReviewMenu(false);
  }
`;
const PAGE_JS_TAIL = `
  function openDrawer(){if(drawer){drawer.hidden=false;document.body.classList.add('ds-noscroll');}}
  function closeDrawer(){if(drawer){drawer.hidden=true;document.body.classList.remove('ds-noscroll');}}
  function fileMatchesFilter(item){
    var q=($('[data-file-search]')&&$('[data-file-search]').value||'').trim().toLowerCase();
    if(q&&(item.getAttribute('data-filter-path')||'').indexOf(q)<0)return false;
    if(activeFileFilter==='seen'&&!viewedFiles[item.getAttribute('data-goto-file')])return false;
    if(activeFileFilter==='unseen'&&viewedFiles[item.getAttribute('data-goto-file')])return false;
    if(activeFileFilter==='comments'&&item.getAttribute('data-filter-comments')!=='1')return false;
    if(activeFileFilter==='unexplained'&&item.getAttribute('data-filter-unexplained')!=='1')return false;
    if(activeFileFilter==='tests'&&item.getAttribute('data-filter-test')!=='1')return false;
    if(activeFileFilter==='since'&&item.getAttribute('data-filter-since')!=='1')return false;
    return true;
  }
  function applyFileFilters(){
    var visible=[];
    fileItems.forEach(function(item){var show=fileMatchesFilter(item);item.hidden=!show;if(show)visible.push(item);});
    $all('.ds-filetree-dir').reverse().forEach(function(dir){dir.hidden=!$all('.ds-fileitem',dir).some(function(item){return !item.hidden;});});
    $all('[data-file-filter]').forEach(function(btn){btn.classList.toggle('is-active',btn.getAttribute('data-file-filter')===activeFileFilter);});
    var selected=fileItems.find(function(item){return Number(item.getAttribute('data-file-index'))===selectedFile;});
    if(visible.length&&(!selected||selected.hidden))selectFile(Number(visible[0].getAttribute('data-file-index')));
    var progress=$('[data-viewed-progress]');
    if(progress&&!visible.length)progress.textContent='No matching files';
    else syncViewed();
  }
  function setFileFilter(filter){activeFileFilter=filter||'all';applyFileFilters();}
  function syncFileCommentFlags(){
    var paths={};allComments.forEach(function(c){if(c.status!=='resolved')paths[c.file]=1;});
    fileItems.forEach(function(item){item.setAttribute('data-filter-comments',paths[item.getAttribute('data-goto-file')]?'1':'0');});
    applyFileFilters();
  }
  function nextUnviewedFile(){
    var visible=fileItems.filter(function(item){return !item.hidden&&!viewedFiles[item.getAttribute('data-goto-file')];});
    if(!visible.length){toast('Every visible file is marked seen');return;}
    var after=visible.find(function(item){return Number(item.getAttribute('data-file-index'))>selectedFile;})||visible[0];
    setView('files');selectFile(Number(after.getAttribute('data-file-index')));collapseCompactSidebar();
  }
  function setReviewMode(mode){
    var url=new URL(location.href);if(mode==='since')url.searchParams.set('review','since');else{url.searchParams.delete('review');url.searchParams.delete('from');}
    location.href=url.pathname+(url.searchParams.toString()?'?'+url.searchParams.toString():'');
  }

  function setFeedbackPanel(panel){
    if(!feedbackDrawer)return;
    $all('[data-feedback-panel]',feedbackDrawer).forEach(function(btn){btn.classList.toggle('is-active',btn.getAttribute('data-feedback-panel')===panel);});
    $all('[data-feedback-view]',feedbackDrawer).forEach(function(view){view.hidden=view.getAttribute('data-feedback-view')!==panel;});
    var tools=$('[data-feedback-tools]',feedbackDrawer);if(tools)tools.hidden=panel!=='feedback';
  }
  function openFeedbackDrawer(panel){
    setReviewMenu(false);if(!feedbackDrawer)return;feedbackDrawer.hidden=false;document.body.classList.add('ds-noscroll');setFeedbackPanel(panel||'feedback');
  }
  function closeFeedbackDrawer(){if(feedbackDrawer){feedbackDrawer.hidden=true;document.body.classList.remove('ds-noscroll');}}
  function filterFeedback(filter){
    if(!feedbackDrawer)return;
    $all('[data-feedback-filter]',feedbackDrawer).forEach(function(btn){btn.classList.toggle('is-active',btn.getAttribute('data-feedback-filter')===filter);});
    $all('[data-feedback-card]',feedbackDrawer).forEach(function(card){
      var show=filter==='all'||card.getAttribute('data-feedback-status')===filter||(filter==='changed'&&(card.getAttribute('data-feedback-anchor')==='changed'||card.getAttribute('data-feedback-anchor')==='moved'));
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
    var f=FLAVOR[c.type]||FLAVOR.change,card=el('article','ds-feedback-card status-'+c.status);
    card.setAttribute('data-feedback-card','');card.setAttribute('data-feedback-status',c.status);card.setAttribute('data-feedback-anchor',anchor||'current');card.setAttribute('data-comment-id',c.id);card.setAttribute('data-comment-file',c.file||'');card.setAttribute('data-comment-line',String(c.line||0));card.setAttribute('data-comment-step',c.step||'');
    var head=el('div','ds-feedback-head');head.appendChild(el('span','ds-flavor-ico',f.ico));head.appendChild(el('span','ds-feedback-path',(c.file||'')+':'+(c.line||0)));head.appendChild(el('span','ds-flex'));head.appendChild(el('span','ds-anchorbadge is-'+(anchor||'current'),anchor==='changed'?'Code changed':anchor==='moved'?'Code moved':'Anchor current'));card.appendChild(head);
    if(c.selectedText)card.appendChild(el('code','ds-feedback-selection',c.selectedText));
    card.appendChild(markdownBlock('ds-feedback-message ds-md',c.body||''));
    var turns=c.turns||[],reply=null;for(var i=turns.length-1;i>=0;i--){if(turns[i].role==='ai'){reply=turns[i];break;}}
    if(reply){var r=markdownBlock('ds-feedback-reply ds-md',reply.text);r.insertBefore(el('span','',BRAND),r.firstChild);card.appendChild(r);}
    card.appendChild(el('div','ds-feedback-actions'));patchFeedbackStatus(c);return card;
  }
  function syncFeedbackCards(){
    if(!feedbackDrawer)return;var list=$('[data-feedback-view="feedback"]',feedbackDrawer);if(!list)return;
    var old={};$all('[data-feedback-card]',list).forEach(function(card){old[card.getAttribute('data-comment-id')]={node:card,anchor:card.getAttribute('data-feedback-anchor')||'current'};});
    list.textContent='';
    if(!allComments.length){list.appendChild(el('div','ds-drawer-empty','No review feedback yet.'));return;}
    allComments.forEach(function(c){var card=buildFeedbackCardClient(c,old[c.id]?old[c.id].anchor:'current');list.appendChild(card);patchFeedbackStatus(c);});
  }
  function updateCommentStatus(id,status){
    fetch(API+'/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:status})})
      .then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(c){patchComment(c);patchFeedbackStatus(c);refreshCount();if(status==='resolved')toast('Fix accepted');else toast('Comment reopened');}).catch(function(){toast('Could not update the comment');});
  }
  function gotoComment(id){
    var card=$('[data-feedback-card][data-comment-id="'+id+'"]');if(!card)return;
    var file=card.getAttribute('data-comment-file'),step=card.getAttribute('data-comment-step');closeFeedbackDrawer();
    if(step){setView('tour');var stepCard=$('.ds-stepcard[data-step-id="'+step+'"]');if(stepCard)setActive(Number(stepCard.getAttribute('data-step-index')));}
    else{setView('files');selectFileByPath(file);}
    setTimeout(function(){var wraps=$all('.ds-comment[data-comment-id="'+id+'"]').filter(function(node){return node.offsetParent;});if(wraps[0])wraps[0].scrollIntoView({block:'center',behavior:'smooth'});},80);
  }
  function openCommands(){setReviewMenu(false);if(commandRoot){commandRoot.hidden=false;document.body.classList.add('ds-noscroll');}}
  function closeCommands(){if(commandRoot){commandRoot.hidden=true;document.body.classList.remove('ds-noscroll');}}
  function runCommand(id){
    closeCommands();
    if(id==='story'){setView('tour');return;}if(id==='files'){setView('files');var q=$('[data-file-search]');if(q)q.focus();return;}
    if(id==='feedback'){openFeedbackDrawer('feedback');return;}if(id==='timeline'){openFeedbackDrawer('timeline');return;}
    if(id==='next-unviewed'){nextUnviewedFile();return;}
    if(id==='toggle-viewed'){var panel=filePanels[selectedFile];if(panel)toggleViewed(panel.getAttribute('data-file'));return;}
    if(id==='read-aloud'){toggleReadAloud();return;}
  }

  function threadAfter(row){
    var t=row.nextElementSibling;
    if(t&&t.classList&&t.classList.contains('ds-thread'))return t;
    t=el('div','ds-thread');row.parentNode.insertBefore(t,row.nextSibling);return t;
  }
  var allComments=[];
  function commentSide(c){return c&&c.side==='left'?'left':'right';}
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
      }
    }
  }
  function syncThreads(){ mountThreads(document); }
  function buildComment(c){
    var f=FLAVOR[c.type]||FLAVOR.change;
    var wrap=el('div','ds-comment status-'+c.status);
    wrap.setAttribute('data-comment-id',c.id);wrap.setAttribute('data-status',c.status);
    wrap.setAttribute('data-comment-file',c.file||'');wrap.setAttribute('data-comment-line',String(c.line||0));wrap.setAttribute('data-comment-step',c.step||'');
    if((c.turns||[]).some(function(t){return t.role==='ai';}))wrap.setAttribute('data-hasreply','1');
    var card=el('div','ds-comment-card flavor-'+c.type);
    var head=el('div','ds-comment-head');
    head.appendChild(el('span','ds-flavor-ico',f.ico));
    head.appendChild(el('span','ds-flavor-label',f.label));
    head.appendChild(el('span','ds-dot'));
    head.appendChild(el('span','ds-comment-author',c.author||'You'));
    head.appendChild(el('span','ds-flex'));
    var sb=el('span','ds-statusbadge');sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));head.appendChild(sb);
    card.appendChild(head);
    if(c.selectedText){
      var picked=el('div','ds-comment-selection');
      picked.appendChild(el('span','', commentSide(c)==='left'?'Selected old side':'Selected new side'));
      picked.appendChild(el('code','',c.selectedText));
      card.appendChild(picked);
    }
    card.appendChild(markdownBlock('ds-comment-body ds-md',c.body));
    var actions=el('div','ds-comment-actions');
    var rb=el('button','ds-ghost',c.status==='resolved'?'Reopen':'Resolve');rb.setAttribute('data-resolve','');actions.appendChild(rb);
    var db=el('button','ds-ghost ds-del','Delete');db.setAttribute('data-delete','');actions.appendChild(db);
    card.appendChild(actions);card.appendChild(buildThreadComposer(c));wrap.appendChild(card);renderConversation(wrap,c);return wrap;
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
    var box=el('div','ds-composer'),state={flavor:flavor||'change'};
    var tabs=el('div','ds-composer-tabs');
    ['change','question','nit'].forEach(function(v){
      var f=FLAVOR[v],b=el('button','ds-composer-tab'+(v===state.flavor?' is-active':''));
      b.setAttribute('data-flavor',v);
      b.appendChild(el('span','ds-flavor-ico',f.ico));
      b.appendChild(document.createTextNode(f.label));
      b.onclick=function(){state.flavor=v;$all('.ds-composer-tab',tabs).forEach(function(x){x.classList.remove('is-active');});b.classList.add('is-active');};
      tabs.appendChild(b);
    });
    if(selectedText)box.appendChild(el('div','ds-composer-selection',selectedText));
    var ta=el('textarea','ds-composer-ta');ta.placeholder='Comment on the selected text…';ta.rows=3;
    var foot=el('div','ds-composer-foot'),bar=el('div','ds-composer-actions');
    var cancel=el('button','ds-ghost','Cancel');cancel.onclick=function(){removeComposer(box);};
    function submitComment(run){
      var body=ta.value.trim();if(!body)return;
      add.disabled=true;ask.disabled=true;
      fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:file,line:Number(line),side:side,step:step,type:state.flavor,body:body,selectedText:selectedText,selection:ctx.selection})})
        .then(function(r){return r.json();}).then(function(c){
          if(!c||!c.id){add.disabled=false;ask.disabled=false;return;}
          allComments.push(c);removeComposer(box);syncThreads();syncFeedbackCards();refreshCount();
          if(run)sendToAgent([c.id]);
        }).catch(function(){add.disabled=false;ask.disabled=false;});
    }
    var add=el('button','ds-ghost ds-composer-add','Save only');
    add.title='Save without sending to the agent';
    add.onclick=function(){submitComment(false);};
    var ask=el('button','ds-btn ds-btn-solid','Choose task & ask');ask.setAttribute('data-agent-target-cta','');
    ask.onclick=function(){submitComment(true);};
    if(agentBusy)ask.disabled=true;
    bar.appendChild(cancel);bar.appendChild(add);bar.appendChild(ask);
    foot.appendChild(buildAgentRoute());foot.appendChild(bar);
    box.appendChild(tabs);box.appendChild(ta);box.appendChild(foot);applyAgentTargetTo(box,readAgentTarget());return box;
  }
  function removeComposer(box){var b=box||$('.ds-composer');if(b&&b.parentNode)b.parentNode.removeChild(b);}
  function openComposer(row,flavor,ctx){
    removeComposer();if(!(ctx&&ctx.line)&&!row.getAttribute('data-line'))return;
    var box=buildComposer(row,flavor,ctx),anchor=row,th=row.nextElementSibling;
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
        patchComment(c);refreshCount();
      }).catch(function(){});
  }
  function deleteComment(wrap){
    if(!wrap)return;var id=wrap.getAttribute('data-comment-id');
    fetch(API+'/'+encodeURIComponent(id),{method:'DELETE'}).then(function(){
      allComments=allComments.filter(function(x){return x.id!==id;});
      $all('.ds-comment[data-comment-id="'+id+'"]').forEach(function(n){
        var th=n.parentNode;
        if(n.parentNode)n.parentNode.removeChild(n);
        if(th&&th.classList&&th.classList.contains('ds-thread')&&!th.children.length&&th.parentNode)th.parentNode.removeChild(th);
      });
      syncFeedbackCards();refreshCount();
    }).catch(function(){});
  }
  // A comment is cross-surfaced into multiple views (diff hunks, full-file, tour),
  // so it appears as several .ds-comment nodes sharing one id. Count/collect by
  // unique id — never by node — or every count doubles per surface it's shown in.
  function uniqueIds(sel){
    var seen={},out=[];
    $all(sel).forEach(function(w){var id=w.getAttribute('data-comment-id');if(id&&!seen[id]){seen[id]=1;out.push(id);}});
    return out;
  }
  function collectOpenIds(){
    return uniqueIds('.ds-comment.status-open');
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
    var anchor=$('.ds-reply-live',card)||$('.ds-comment-actions',card);
    var turns=(c&&c.turns)||[];
    for(var i=0;i<turns.length;i++)card.insertBefore(turnNode(turns[i]),anchor||null);
  }
  function buildThreadComposer(c){
    var box=el('div','ds-thread-composer');
    var ta=el('textarea','ds-thread-ta');ta.placeholder='Reply to '+BRAND+'…';ta.rows=1;
    ta.setAttribute('data-thread-ta','');
    var add=el('button','ds-ghost ds-thread-add','Save reply');
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
    var text=ta.value.trim();if(!text)return;
    if(run&&agentBusy){toast('The agent is already working; wait for it to finish.');return;}
    ta.value='';
    fetch(API+'/'+encodeURIComponent(id)+'/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(updated){
        var found=false;
        for(var i=0;i<allComments.length;i++){if(allComments[i].id===id){allComments[i]=updated;found=true;break;}}
        if(!found)allComments.push(updated);
        patchComment(updated);syncFeedbackCards();refreshCount();
        if(run)sendToAgent([id]);
      }).catch(function(){if(!ta.value)ta.value=text;toast('Could not send your message.');});
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
    if(wrap){var card=$('.ds-comment-card',wrap)||wrap;var actions=$('.ds-comment-actions',card);card.insertBefore(node,actions||null);}
    return node;
  }
  function patchComment(c){
    var wraps=$all('.ds-comment[data-comment-id="'+c.id+'"]');
    for(var i=0;i<wraps.length;i++){
      var wrap=wraps[i];
      wrap.setAttribute('data-status',c.status);wrap.className='ds-comment status-'+c.status;
      var sb=$('.ds-statusbadge',wrap);if(sb){sb.textContent='';sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));}
      if((c.turns||[]).some(function(t){return t.role==='ai';}))wrap.setAttribute('data-hasreply','1');
      renderConversation(wrap,c);
      var rb=$('[data-resolve]',wrap);if(rb)rb.textContent=c.status==='resolved'?'Reopen':'Resolve';
    }
    patchFeedbackStatus(c);
  }
  function refreshComments(done){
    fetch(API).then(function(r){return r.json();}).then(function(list){
      if(Array.isArray(list)){allComments=list;list.forEach(patchComment);}
      syncThreads();syncFeedbackCards();syncFileCommentFlags();
      refreshCount();
      if(done)done(list);
    }).catch(function(){if(done)done(null);});
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
    var old=$('.ds-agent-chooser');if(old&&old.parentNode)old.parentNode.removeChild(old);
    if(restore===false)return;
    var focus=agentChooserReturnFocus;agentChooserReturnFocus=null;
    if(focus&&focus.focus&&document.documentElement.contains(focus))setTimeout(function(){focus.focus();},0);
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
  function renderAgentTargetChooser(agents,tasks,error,done,codexOnly){
    removeAddressAgentChooser(false);
    var root=el('div','ds-agent-chooser');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Choose agent task');
    var scrim=el('button','ds-agent-chooser-scrim');scrim.type='button';scrim.setAttribute('aria-label','Cancel');scrim.onclick=removeAddressAgentChooser;root.appendChild(scrim);
    var panel=el('div','ds-agent-chooser-panel');var head=el('div','ds-agent-chooser-head');var text=el('div');
    text.appendChild(el('div','ds-agent-chooser-title','Choose agent task'));
    text.appendChild(el('div','ds-agent-chooser-sub','Future review questions in this repository go here. Codex Desktop tasks keep the implementation context between questions.'));
    var close=el('button','ds-agent-chooser-close','×');close.type='button';close.setAttribute('aria-label','Cancel');close.onclick=removeAddressAgentChooser;
    head.appendChild(text);head.appendChild(close);panel.appendChild(head);
    var search=el('input','ds-agent-task-search');search.type='search';search.placeholder='Search recent tasks';search.setAttribute('aria-label','Search recent tasks');panel.appendChild(search);
    var list=el('div','ds-agent-task-list');
    if(agents.indexOf('codex')>=0){
      taskChoice(list,{agent:'codex',mode:'new',label:'＋ Start a new Codex task',preview:'Create it with your next question, then reuse it for later review questions here.',meta:'New'},done);
      if(tasks.length)list.appendChild(el('div','ds-agent-task-section','Recent Codex tasks in this repository'));
      tasks.forEach(function(t){taskChoice(list,{agent:'codex',mode:'thread',threadId:t.id,label:t.title,preview:t.preview||t.source,meta:taskAge(t.updatedAt)},done);});
      if(error)list.appendChild(el('div','ds-agent-task-empty',error));
    }
    if(!codexOnly&&agents.indexOf('claude')>=0){
      list.appendChild(el('div','ds-agent-task-section','Other agent'));
      taskChoice(list,{agent:'claude',mode:'new',label:'Claude',preview:'Start a separate Claude session for this run.',meta:'One-off'},done);
    }
    if(!list.children.length)list.appendChild(el('div','ds-agent-task-empty','No Claude or Codex installation was found.'));
    panel.appendChild(list);root.appendChild(panel);document.body.appendChild(root);
    search.addEventListener('input',function(){var q=search.value.trim().toLowerCase();$all('[data-agent-task-option]',list).forEach(function(b){b.hidden=!!q&&(b.getAttribute('data-task-search')||'').indexOf(q)<0;});});
    root.addEventListener('keydown',function(e){
      if(e.key!=='Tab')return;
      var focusable=$all('button:not(:disabled):not([hidden]),input:not(:disabled):not([hidden])',panel).filter(function(node){return !!node.offsetParent;});
      if(!focusable.length)return;var first=focusable[0],last=focusable[focusable.length-1],active=document.activeElement;
      if(e.shiftKey&&active===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&active===last){e.preventDefault();first.focus();}
    });
    search.focus();
  }
  function chooseAddressAgent(ids,fromCard,done,codexOnly){
    if(!agentChooserReturnFocus||!document.documentElement.contains(agentChooserReturnFocus))agentChooserReturnFocus=document.activeElement;
    fetch('/api/agents').then(function(r){return r.json();}).then(function(d){
      var list=addressAgentChoices(d.agents||[]);
      if(!list.length){agentChooserReturnFocus=null;toast('No Claude or Codex CLI found on PATH.');return;}
      if(list.indexOf('codex')<0){renderAgentTargetChooser(list,[],null,done,codexOnly);return;}
      fetch(CODEX_TASK_API).then(function(r){return r.json().then(function(body){if(!r.ok)throw new Error(body.error||'Could not load Codex tasks.');return body;});})
        .then(function(body){renderAgentTargetChooser(list,Array.isArray(body.tasks)?body.tasks:[],null,done,codexOnly);})
        .catch(function(e){renderAgentTargetChooser(list,[],e.message||'Could not load Codex tasks.',done,codexOnly);});
    }).catch(function(){agentChooserReturnFocus=null;toast('Could not load installed agents.');});
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
      if(target.mode==='thread'&&target.threadId)payload.codexThreadId=target.threadId;
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
      var agents=addressAgentChoices(d.agents||[]);if(!agents.length){toast('No Claude or Codex CLI found on PATH.');return;}
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
    }).catch(function(){toast('Could not start story repair.');});
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
    var openN=uniqueIds('.ds-comment:not(.status-resolved)').length;
    var b=$('#ds-open-count b');if(b)b.textContent=openN;
    var countLabel=$('.ds-review-menu-count-label');if(countLabel)countLabel.textContent=' '+(openN===1?'comment':'comments');
    var reviewBtn=$('[data-review-menu]'),unexplained=reviewBtn?Number(reviewBtn.getAttribute('data-unexplained-count')||0):0;
    if(reviewBtn)reviewBtn.setAttribute('aria-label','Review, '+openN+' unresolved '+(openN===1?'comment':'comments')+(unexplained?', '+unexplained+' '+(unexplained===1?'change':'changes')+' not explained by the story':''));
    var summary=$('.ds-review-summary-label b');if(summary){summary.textContent=openN;if(summary.nextSibling)summary.nextSibling.nodeValue=' unresolved '+(openN===1?'comment':'comments');}
    var approve=$('[data-verdict="approve"]'),pill=$('.ds-trustpill'),clean=!pill||pill.classList.contains('is-clean');
    if(approve)approve.disabled=!(openN===0&&clean);
    if(reviewBtn)reviewBtn.classList.toggle('is-clean',openN===0&&!!clean);
    var sendableN=collectOpenIds().length,aa=$('[data-address-all]');if(aa&&!agentBusy)aa.disabled=sendableN===0;
    var co=$('[data-copy-comments="open"]');if(co)co.disabled=sendableN===0;
    var totalN=uniqueIds('.ds-comment').length,ca=$('[data-copy-comments="all"]');if(ca)ca.disabled=totalN===0;
    var fb=$('[data-feedback-open="feedback"]');if(fb)fb.disabled=allComments.length===0&&uniqueIds('.ds-comment').length===0;
    var fc=$('[data-feedback-count]');if(fc){fc.textContent=totalN;fc.hidden=totalN===0;}
    var ad=$('[data-approve-desc]');if(ad){var coverage=$('.ds-trustpill b');ad.textContent=openN?'Resolve '+openN+' '+(openN===1?'comment':'comments')+' first.':clean?'Everything is covered and resolved.':'Explain '+(coverage?coverage.textContent:'the remaining')+' more '+(coverage&&coverage.textContent==='1'?'change':'changes')+' in the story first.';}
    if(fileItems&&fileItems.length)syncFileCommentFlags();
  }
  function verdict(kind){
    var openN=uniqueIds('.ds-comment:not(.status-resolved)').length;
    if(kind==='approve'){toast('Looks clean — every change is explained and there are no open comments. ✓');return;}
    if(openN>0)toast(openN+' open '+(openN===1?'comment':'comments')+' already '+(openN===1?'has':'have')+' a path to the agent. Use Send open comments only if something needs resending.');
    else toast('No open comments yet. Select text in the review, then right-click to comment.');
  }
  function toast(msg){
    if(!toastEl)return;toastEl.textContent=msg;toastEl.hidden=false;
    requestAnimationFrame(function(){toastEl.classList.add('is-show');});
    clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastEl.classList.remove('is-show');setTimeout(function(){toastEl.hidden=true;},220);},4200);
  }
  function commentsToText(list,withThread){
    var out=['Please address these review comments from my code review (diffStory). Each is anchored to selected text in the diff. This is a comparison between a target side and the current code — read both sides of the change before fixing or answering; do not assume a symbol is missing just because it is absent from one side.',''];
    list.forEach(function(c,i){
      var label=(FLAVOR[c.type]&&FLAVOR[c.type].label)||c.type;
      var sel=c.selection||{},start=sel.startLine||c.line,end=sel.endLine||start;
      var side=commentSide(c);
      var head=(i+1)+'. ['+label+'] '+c.file+':'+start+(end&&end!==start?'-'+end:'')+' ('+(side==='left'?'left / old side':'right / new side')+')';
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
      if(ok)onOk();else toast('Could not copy — select the comments manually.');
    }catch(e){toast('Could not copy — select the comments manually.');}
  }
  function copyComments(mode){
    var all=mode==='all';
    fetch(API).then(function(r){return r.json();}).then(function(list){
      var arr=Array.isArray(list)?list:[];
      var pick=all?arr:arr.filter(function(c){return c.status==='open';});
      if(!pick.length){toast(all?'No comments to copy yet.':'No open comments to copy.');return;}
      writeClipboard(commentsToText(pick,all),function(){
        toast('Copied '+pick.length+' '+(pick.length===1?'comment':'comments')+(all?' (full thread)':'')+' — paste them to your agent.');
      });
    }).catch(function(){toast('Could not read comments to copy.');});
  }

  function onClick(e){
    var t=e.target,b;
    var sp=$('#ds-settings');if(sp&&!sp.hidden&&!closest(t,'.ds-settings-wrap'))sp.hidden=true;
    var rp=$('[data-review-menu-pop]');if(rp&&!rp.hidden&&!closest(t,'.ds-review-menu-wrap'))setReviewMenu(false);
    b=closest(t,'[data-selection-action]');if(b){var ctx=selectionContext;closeSelectionMenu();if(ctx)openComposer(ctx.anchorRow,b.getAttribute('data-selection-action'),ctx);return;}
    b=closest(t,'[data-selection-quick-action]');if(b){var qa=b.getAttribute('data-selection-quick-action'),qctx=selectionContext||currentSelectionContext();closeSelectionQuick();if(qa==='copy'){copySelectionContext();return;}if(qctx)openComposer(qctx.anchorRow,qa,qctx);return;}
    if(selectionMenu&&!selectionMenu.hidden&&!closest(t,'[data-selection-menu]'))closeSelectionMenu();
    if(selectionQuick&&!selectionQuick.hidden&&!closest(t,'[data-selection-quick]')&&!codeForNode(t))closeSelectionQuick();
    b=closest(t,'[data-sidebar-toggle]');if(b){
      var collapsed=document.body.classList.contains('ds-rail-collapsed');
      if(compactScreen()){if(collapsed)openCompactSidebar(b);else closeCompactSidebar(true);}
      else setSidebarCollapsed(!collapsed);
      return;
    }
    b=closest(t,'[data-sidebar-scrim]');if(b){closeCompactSidebar(true);return;}
    b=closest(t,'[data-view]');if(b){setView(b.getAttribute('data-view'));return;}
    b=closest(t,'button[data-review-mode]');if(b){if(!b.disabled)setReviewMode(b.getAttribute('data-review-mode'));return;}
    b=closest(t,'[data-file-filter]');if(b){setFileFilter(b.getAttribute('data-file-filter'));return;}
    b=closest(t,'[data-next-unviewed]');if(b){nextUnviewedFile();return;}
    b=closest(t,'[data-feedback-open]');if(b){openFeedbackDrawer(b.getAttribute('data-feedback-open'));return;}
    b=closest(t,'[data-feedback-close]');if(b){closeFeedbackDrawer();return;}
    b=closest(t,'[data-feedback-panel]');if(b){setFeedbackPanel(b.getAttribute('data-feedback-panel'));return;}
    b=closest(t,'[data-feedback-filter]');if(b){filterFeedback(b.getAttribute('data-feedback-filter'));return;}
    b=closest(t,'[data-accept-fix]');if(b){updateCommentStatus(b.getAttribute('data-accept-fix'),'resolved');return;}
    b=closest(t,'[data-reopen-comment]');if(b){updateCommentStatus(b.getAttribute('data-reopen-comment'),'open');return;}
    b=closest(t,'[data-goto-comment]');if(b){gotoComment(b.getAttribute('data-goto-comment'));return;}
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
    b=closest(t,'[data-reload-diff]');if(b){b.disabled=true;location.reload();return;}
    b=closest(t,'[data-review-menu]');if(b){if(rp)setReviewMenu(rp.hidden);return;}
    b=closest(t,'[data-voice-engine]');if(b){setVoiceEngine(b.getAttribute('data-voice-engine'));return;}
    b=closest(t,'[data-rate]');if(b){setRate(parseFloat(b.getAttribute('data-rate')));return;}
    b=closest(t,'[data-say-voice]');if(b){setSayVoice(b.getAttribute('data-say-voice'),true);return;}
    b=closest(t,'[data-kokoro-voice]');if(b){setKokoroVoice(b.getAttribute('data-kokoro-voice'),true);return;}
    b=closest(t,'[data-voice-preset]');if(b){setVoicePreset(b.getAttribute('data-voice-preset'),true);return;}
    b=closest(t,'[data-preview-voice]');if(b){speakVoicePreview();return;}
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
    b=closest(t,'[data-goto-step]');if(b){closeDrawer();setView('tour');setActive(Number(b.getAttribute('data-goto-step')));collapseCompactSidebar();return;}
    b=closest(t,'[data-goto-file]');if(b){closeDrawer();setView('files');selectFileByPath(b.getAttribute('data-goto-file'));collapseCompactSidebar();return;}
    b=closest(t,'[data-explain]');if(b){repairStory('explain',{file:b.getAttribute('data-story-file'),line:Number(b.getAttribute('data-story-line')||0)});return;}
    b=closest(t,'[data-story-repair]');if(b){repairStory(b.getAttribute('data-story-repair'),{file:b.getAttribute('data-story-file'),stepId:b.getAttribute('data-story-step')});var det=closest(b,'details');if(det)det.open=false;return;}
    b=closest(t,'[data-verdict]');if(b){if(b.disabled)return;setReviewMenu(false);verdict(b.getAttribute('data-verdict'));return;}
    b=closest(t,'.ds-stepcard');if(b){setActive(Number(b.getAttribute('data-step-index')));collapseCompactSidebar();return;}
    b=closest(t,'[data-prev]');if(b){if(!b.disabled)setActive(active-1);return;}
    b=closest(t,'[data-next]');if(b){if(!b.disabled)setActive(active+1);return;}
  }
  function onKey(e){
    if(e.key==='Escape'){
      setReviewMenu(false);closeSelectionMenu();closeSelectionQuick();closeDrawer();closeFeedbackDrawer();closeCommands();removeComposer();removeAddressAgentChooser();
      if(compactScreen()&&!document.body.classList.contains('ds-rail-collapsed'))closeCompactSidebar(true);
      return;
    }
    if(!isTextEntryTarget(e.target)&&e.key==='?'){e.preventDefault();openCommands();return;}
    if(!isTextEntryTarget(e.target)&&e.key==='/'){
      e.preventDefault();setView('files');var search=$('[data-file-search]');if(search)search.focus();return;
    }
    if(!isTextEntryTarget(e.target)&&(e.key==='c'||e.key==='C')){
      var cctx=currentSelectionContext();if(cctx){e.preventDefault();selectionContext=cctx;closeSelectionQuick();openComposer(cctx.anchorRow,'change',cctx);return;}
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
    var railHandle=closest(e.target,'[data-sidebar-resizer]');
    if(railHandle&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
      setSidebarCollapsed(false);
      setSidebarWidth(currentSidebarWidth()+(e.key==='ArrowRight'?16:-16),true);
      e.preventDefault();
      return;
    }
    var focusedStoryBeat=closest(e.target,'[data-story-beat]');
    if(focusedStoryBeat&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){
      e.preventDefault();moveStoryBeat(focusedStoryBeat,e.key==='ArrowRight'?1:-1);return;
    }
    var wantsBeatNav=e.key==='ArrowRight'||e.key==='ArrowLeft';
    if(wantsBeatNav&&moveSpeechBeat(e.key==='ArrowRight'?1:-1)){e.preventDefault();return;}
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
    setSidebarWidth(sidebarDragWidth(e),false);
  }
  function endSidebarResize(){
    if(!sidebarResizing)return;
    sidebarResizing=false;
    document.body.classList.remove('ds-sidebar-resizing');
    setSidebarWidth(currentSidebarWidth(),true);
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
    tourView=$('#ds-view-tour');filesView=$('#ds-view-files');drawer=$('#ds-trust-drawer');feedbackDrawer=$('#ds-feedback-drawer');commandRoot=$('[data-command-root]');toastEl=$('#ds-toast');selectionMenu=$('[data-selection-menu]');selectionQuick=$('[data-selection-quick]');
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
    document.addEventListener('scroll',function(){closeSelectionQuick();saveReviewPositionSoon();},true);
    document.addEventListener('mousedown',startSidebarResize);
    document.addEventListener('mousemove',moveSidebarResize);
    document.addEventListener('mouseup',endSidebarResize);
    document.addEventListener('mousedown',startSplit);
    document.addEventListener('mousemove',moveSplit);
    document.addEventListener('mouseup',endSplit);
    window.addEventListener('resize',function(){setSidebarWidth(currentSidebarWidth(),false);syncSidebarOverlay(document.body.classList.contains('ds-rail-collapsed'));applyResponsiveStoryMode(stepPanels&&stepPanels[active]);$all('.ds-filepanel,.ds-diff').forEach(updateChangeNav);});
    try{var rw=parseFloat(localStorage.getItem('ds-sidebar-width')||'');if(rw)setSidebarWidth(rw,false);else updateSidebarHandle(currentSidebarWidth());}catch(e){updateSidebarHandle(currentSidebarWidth());}
    try{var sv=localStorage.getItem('ds-split');if(sv)document.documentElement.style.setProperty('--ds-split',sv);}catch(e){}
    try{
      var storedCollapsed=localStorage.getItem('ds-sidebar-collapsed');
      setSidebarCollapsed(storedCollapsed==='1'||(compactScreen()&&storedCollapsed!=='0'),false);
    }catch(e){setSidebarCollapsed(compactScreen(),false);}
    initStoryGenerator();
    refreshAgentTargetLabel();
    $all('.ds-filepanel,.ds-diff').forEach(updateChangeNav);
    refreshCount();
    loadViewed();invalidateChangedViewed();syncViewed();applyFileFilters();
    var fileSearch=$('[data-file-search]');if(fileSearch)fileSearch.addEventListener('input',applyFileFilters);
    revealResumeReview();
    reviewPositionReady=true;
    fetch('/api/review/checkpoint',{method:'POST'}).then(function(r){return r.json();}).then(function(d){if(d&&d.snapshot){document.body.setAttribute('data-review-snapshot',d.snapshot.id||'');document.body.setAttribute('data-review-round',String(d.snapshot.round||1));}}).catch(function(){});
    refreshComments();
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
    $all('[data-rate]').forEach(function(b){b.classList.toggle('is-active',parseFloat(b.getAttribute('data-rate'))===rate);});
    updateVoiceControls();
  }
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
`;
export const PAGE_JS = PAGE_JS_HEAD + DIFF_JS + PAGE_JS_TAIL;
