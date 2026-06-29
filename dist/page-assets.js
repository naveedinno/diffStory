// Inlined CSS + client JS for the diffStory review page. Kept as plain strings
// (no backticks, no ${} in the JS) so they drop straight into the render template
// literal. The client only ever sets textContent, builds nodes with createElement,
// or injects server-escaped HTML from /api/fullfile — so there is no injection sink.
export const PAGE_CSS = `
/* Material 3-inspired tokens. Dark is the default scheme; the light override
   flips the same semantic roles. Existing component variables map onto M3
   surface, primary, secondary, outline, and state-layer roles. */
:root{
  color-scheme:light dark;
  /* Apple-HIG palette (dark default): neutral system grays + system blue accent.
     The --md-* role names are kept so existing component CSS keeps resolving; only
     the values changed (purple/Google → gray/blue/SF). */
  --md-primary:#0A84FF; --md-on-primary:#FFFFFF; --md-primary-container:#0A3A66; --md-on-primary-container:#D6E9FF;
  --md-secondary:#AEAEB2; --md-secondary-container:rgba(10,132,255,0.22); --md-on-secondary-container:#D6E9FF;
  --md-tertiary:#FF375F; --md-error:#FF453A; --md-on-error:#FFFFFF; --md-error-container:rgba(255,69,58,0.22);
  --md-surface:#1C1C1E; --md-surface-container-low:#1C1C1E; --md-surface-container:#2C2C2E;
  --md-surface-container-high:#3A3A3C; --md-surface-container-highest:#48484A;
  --md-on-surface:#F5F5F7; --md-on-surface-variant:#AEAEB2; --md-outline:#8E8E93; --md-outline-variant:rgba(255,255,255,0.16);
  --accent:var(--md-primary); --accent-hi:#409CFF; --accent-soft:rgba(10,132,255,0.16);
  --accent-text:#6CB4FF; --accent-blue:var(--md-primary); --on-accent:var(--md-on-primary);
  --add:#30D158; --add-bg:rgba(48,209,88,0.14); --add-bd:#30D158; --add-text:#7EE29A;
  --del:var(--md-error); --del-bg:rgba(255,69,58,0.14); --del-text:#FFB3AC;
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
    --md-primary:#007AFF; --md-on-primary:#FFFFFF; --md-primary-container:#D5E7FF; --md-on-primary-container:#003E80;
    --md-secondary:#6E6E73; --md-secondary-container:rgba(0,122,255,0.14); --md-on-secondary-container:#0061CC;
    --md-tertiary:#FF2D55; --md-error:#FF3B30; --md-on-error:#FFFFFF; --md-error-container:rgba(255,59,48,0.12);
    --md-surface:#F5F5F7; --md-surface-container-low:#F5F5F7; --md-surface-container:#FFFFFF;
    --md-surface-container-high:#ECECF0; --md-surface-container-highest:#E3E3E8;
    --md-on-surface:#1D1D1F; --md-on-surface-variant:rgba(60,60,67,0.6); --md-outline:#C6C6C8; --md-outline-variant:rgba(60,60,67,0.18);
    --accent:var(--md-primary); --accent-hi:#3395FF; --accent-soft:rgba(0,122,255,0.12);
    --accent-text:#0067D6; --accent-blue:var(--md-primary); --on-accent:var(--md-on-primary);
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
.ds-top{height:56px;flex:none;display:flex;align-items:center;gap:14px;padding:0 18px;
  border-bottom:1px solid var(--line-soft);background:var(--md-surface-container);z-index:5}
.ds-brand{display:flex;align-items:center;gap:9px;flex:none;padding:5px 7px;margin-left:-7px;border-radius:9px;color:inherit;text-decoration:none}
.ds-brand:hover{background:var(--fill-2)}
.ds-brand:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-mark{display:block;--ds-brand-path:var(--accent);--ds-brand-node-a:var(--text);--ds-brand-node-b:#64d2ff;--ds-brand-node-c:var(--text)}
.ds-word{font-size:15.5px;letter-spacing:0.01em}
.ds-word-a{color:var(--muted);font-weight:500}
.ds-word-b{color:var(--text);font-weight:600}
.ds-sidebar-toggle{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:20px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:15px;flex:none}
.ds-sidebar-toggle:hover{background:var(--fill-2);color:var(--text)}
.ds-sidebar-toggle.is-active{background:var(--md-secondary-container);color:var(--md-on-secondary-container)}
.ds-sidebar-toggle-ico{line-height:1;transform:translateY(-0.5px)}
.ds-vsep{width:1px;height:24px;background:var(--line)}
.ds-titlewrap{display:flex;flex-direction:column;min-width:0;flex:1 1 auto;gap:2px;overflow:hidden}
.ds-titlebar{display:flex;align-items:center;gap:7px;min-width:0;overflow:hidden;white-space:nowrap}
.ds-back{height:30px;display:inline-flex;align-items:center;gap:3px;padding:0 13px 0 9px;border-radius:999px;border:1px solid var(--line-soft);
  background:var(--md-surface-container-high);color:var(--text);font-size:12.5px;font-weight:600;flex:none;white-space:nowrap}
.ds-back:hover{background:var(--md-secondary-container);border-color:transparent;color:var(--md-on-secondary-container)}
.ds-back:focus-visible{outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
.ds-back-ico{font-size:17px;line-height:1;font-weight:500;transform:translateY(-0.5px)}
.ds-crumb-repo{font-size:11px;color:var(--dim);font-family:var(--mono);max-width:18ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none}
.ds-crumb-repo:hover{color:var(--text)}
.ds-kicker{display:flex;align-items:center;gap:6px;font-size:9px;letter-spacing:0.09em;text-transform:uppercase;color:var(--dim2);font-weight:700;min-width:0;overflow:hidden;white-space:nowrap}
.ds-kicker .ds-dim{color:var(--faint);font-weight:600}
.ds-change{font-size:11px;color:var(--dim);font-family:var(--mono);text-transform:none;letter-spacing:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ds-title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}
.ds-status{display:flex;align-items:center;gap:8px;flex:none}
.ds-open{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text);padding:8px 12px;border-radius:999px;background:var(--md-surface-container-high)}
.ds-open b{font-variant-numeric:tabular-nums;font-weight:600}
.ds-dot{width:5px;height:5px;border-radius:50%;background:var(--faint);flex:none;display:inline-block}
.ds-dot-amber{width:6px;height:6px;background:var(--amber)}
.ds-trustpill{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--amber-text);
  padding:8px 12px;border-radius:999px;border:1px solid rgba(246,199,105,0.32);background:var(--amber-soft);cursor:pointer}
.ds-trustpill:hover{background:rgba(246,199,105,0.20)}
.ds-trustpill b{font-weight:700}
.ds-trustpill .ds-tri{font-size:11px}
.ds-trustpill.is-clean{color:var(--add);border-color:rgba(155,214,125,0.32);background:var(--add-bg)}
.ds-trustpill.is-clean:hover{background:rgba(155,214,125,0.20)}
.ds-check{font-size:12px}
.ds-actions{position:relative;display:flex;align-items:center;gap:9px;flex:none}
.ds-btn{font-size:13px;font-weight:600;border-radius:999px;cursor:pointer;border:1px solid transparent;white-space:nowrap}
.ds-btn-ghost{color:var(--accent-text);padding:9px 16px;border-color:var(--line);background:transparent}
.ds-btn-ghost:hover{background:var(--fill-2)}
.ds-btn-approve{display:flex;align-items:center;gap:7px;font-weight:700;color:var(--on-accent);padding:10px 18px;border:none;background:var(--accent)}
.ds-btn-approve:hover{background:var(--accent-hi)}
.ds-btn-approve:disabled{opacity:0.4;cursor:not-allowed}
.ds-review-menu-wrap{position:relative}
.ds-review-menu{height:36px;display:flex;align-items:center;gap:8px;padding:0 13px;border-radius:999px;border:1px solid var(--line);
  background:var(--md-surface-container-high);color:var(--text);font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap}
.ds-review-menu:hover,.ds-review-menu.is-open{background:var(--md-surface-container-highest);border-color:var(--md-outline)}
.ds-review-menu-dot{width:7px;height:7px;border-radius:999px;background:var(--md-primary);box-shadow:0 0 0 4px var(--accent-soft)}
.ds-review-menu-caret{color:var(--muted);font-size:12px;transform:translateY(-1px)}
.ds-review-menu-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:32;width:300px;max-width:calc(100vw - 24px);padding:8px;
  border:1px solid var(--line-soft);border-radius:16px;background:var(--md-surface-container-high);box-shadow:var(--shadow)}
.ds-review-menu-pop[hidden]{display:none}
.ds-review-menu-title{padding:7px 9px 8px;font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--dim2);font-weight:800}
.ds-review-option{width:100%;display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;border:none;border-radius:10px;background:transparent;color:var(--text);padding:10px;cursor:pointer}
.ds-review-option:hover{background:var(--fill-2)}
.ds-review-option:disabled{opacity:0.45;cursor:not-allowed}
.ds-review-option:disabled:hover{background:transparent}
.ds-review-option-title{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;line-height:1.2}
.ds-review-option-desc{font-size:11.5px;line-height:1.35;color:var(--muted)}
.ds-review-option-approve:not(:disabled) .ds-review-option-title{color:var(--md-primary)}
.ds-readaloud{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:var(--md-on-secondary-container);padding:8px 13px;border-radius:999px;border:1px solid var(--line);
  background:var(--md-surface-container-high);cursor:pointer;white-space:nowrap;min-width:112px;justify-content:center}
.ds-readaloud:hover{background:var(--md-surface-container-highest)}
.ds-readaloud-ico{width:17px;height:17px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--md-on-primary);background:var(--md-primary)}
.ds-readaloud.is-active{background:var(--md-secondary-container);border-color:transparent;color:var(--md-on-secondary-container)}
.ds-readaloud.is-active .ds-readaloud-ico{background:var(--md-on-secondary-container);color:var(--md-secondary-container)}
.ds-readaloud.is-speaking .ds-readaloud-ico{animation:dsPulse 1s ease-in-out infinite}
.ds-readaloud.is-loading{border-color:var(--md-primary);background:var(--md-surface-container-highest)}
.ds-readaloud.is-loading .ds-readaloud-ico,.ds-preview.is-loading .ds-preview-ico,.ds-voice-card.is-loading .ds-voice-badge{animation:dsSpin .8s linear infinite}
@keyframes dsPulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes dsSpin{to{transform:rotate(360deg)}}
.ds-settings-wrap{position:relative;display:flex;align-items:center;gap:5px}
.ds-gear{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:18px;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:14px}
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
.ds-btn-solid{font-weight:600;color:var(--on-accent);padding:7px 13px;border:none;background:var(--accent)}
.ds-btn-solid:hover{background:var(--accent-hi)}
/* header responsiveness: drop the kicker, then tighten pills/buttons as it narrows */
@media (max-width:1180px){.ds-top{gap:9px}.ds-kicker{display:none}}
@media (max-width:980px){.ds-open,.ds-trustpill{padding:6px 9px}.ds-btn-ghost,.ds-btn-approve{padding:8px 11px}.ds-readaloud{padding:7px 9px;min-width:auto}.ds-gear{width:28px;height:28px}.ds-review-menu{width:36px;padding:0;justify-content:center}.ds-review-menu>span:not(.ds-review-menu-dot):not(.ds-review-menu-caret){display:none}}
@media (max-width:720px){:root{--ds-rail-width:240px}.ds-top{padding:0 12px;gap:8px}.ds-word,.ds-vsep,.ds-status,.ds-settings-wrap,.ds-actions{display:none}.ds-title{font-size:13px}}
@media (max-width:520px){.ds-settings-pop{width:calc(100vw - 24px)}.ds-voice-grid{grid-template-columns:1fr}.ds-voice-head{align-items:stretch;flex-direction:column}.ds-preview{margin-left:0;justify-content:center}}

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
.ds-why{margin:17px 30px 0;padding:15px 17px;border-radius:13px;background:rgba(10,132,255,0.07);border:1px solid rgba(10,132,255,0.2);flex:none;max-height:min(24vh,190px);overflow-y:auto}
.ds-why-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.ds-why-ico{width:15px;height:15px;border-radius:4px;background:rgba(10,132,255,0.2);display:flex;align-items:center;justify-content:center;position:relative}
.ds-why-ico::after{content:'';width:5px;height:5px;border-radius:50%;background:var(--accent-blue)}
.ds-why-label{font-size:10.5px;letter-spacing:0.07em;text-transform:uppercase;color:var(--accent-blue);font-weight:600}
.ds-why-text{margin:0;font-size:14px;line-height:1.58;color:var(--text);text-wrap:pretty}
.ds-diffscroll{flex:1;min-height:180px;overflow-y:auto;padding:18px 30px 26px}
@media (max-height:760px){.ds-why{max-height:120px}.ds-diffscroll{min-height:160px}}

/* ---- diff ---- */
.ds-diff{border:1px solid var(--diff-rule);border-radius:6px;overflow:hidden;background:var(--panel3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.025)}
.ds-step.is-voice-active .ds-diff{border-color:rgba(208,188,255,0.72);box-shadow:0 0 0 1px rgba(208,188,255,0.34),0 12px 34px rgba(80,64,140,0.18),inset 0 1px 0 rgba(255,255,255,0.035)}
.ds-step.is-voice-active .ds-difthint{color:var(--md-primary);font-weight:700}
.ds-step.is-voice-active .ds-difthint::before{content:'Reading here';display:inline-flex;margin-right:8px;padding:1px 6px;border-radius:999px;background:rgba(208,188,255,0.16);color:var(--md-primary);font-size:10px;letter-spacing:0.02em;text-transform:uppercase}
.ds-difftoolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border-bottom:1px solid var(--diff-rule);background:var(--panel2)}
.ds-difthint{font-size:11px;color:var(--dim)}
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
.ds-comment-selection{padding:10px 13px;border-bottom:1px solid var(--line-soft);background:var(--panel3);display:grid;gap:5px}
.ds-comment-selection span{font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--dim2);font-weight:700}
.ds-comment-selection code{font-family:var(--mono);font-size:12px;line-height:1.45;color:var(--text);white-space:pre-wrap;overflow-wrap:anywhere}
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
.ds-selection-menu{position:fixed;z-index:90;min-width:168px;padding:6px;border:1px solid var(--line);border-radius:10px;background:var(--material);box-shadow:var(--shadow)}
.ds-selection-menu[hidden]{display:none}
.ds-selection-menu button{width:100%;display:block;border:none;border-radius:7px;background:transparent;color:var(--text);font-size:13px;font-weight:700;text-align:left;padding:8px 10px;cursor:pointer}
.ds-selection-menu button:hover{background:var(--fill-2)}
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
  var tourView,filesView,drawer,toastEl,selectionMenu,selectionContext=null,stepPanels,stepCards,total=1,active=0,visited={0:true},toastTimer,speechTimer,voiceFocusIndex=-1,voiceFocusGroup=-1,voiceFocusTimers=[];
  var filePanels=[],fileItems=[],selectedFile=-1,sidebarResizing=false,readAloud=false,rate=1.05,voicePreset='story',voiceEngine='browser',sayVoice='samantha',kokoroVoice='af_heart',voices=[],activeUtterance=null,localAudio=null,localAudioToken=0,speechAbort=null,speechLoadingLabel='',speechLoadingMode='',speechLoadingEngine='',speechLoadingVoice='',prefetchedSpeech={},speechPrefetchAbort=null,speechPrefetchKey='';
  var VOICE_PRESETS={
    story:{
      label:'Story',badge:'S',rate:1,pitch:1,volume:1,
      sample:'Story mode. I changed this helper so the caller can pass the missing value clearly.',
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
  function setReviewMenu(open){
    var pop=$('[data-review-menu-pop]'),btn=$('[data-review-menu]');
    if(!pop||!btn)return;
    pop.hidden=!open;
    btn.classList.toggle('is-open',open);
    btn.setAttribute('aria-expanded',open?'true':'false');
  }
  function nodeElement(n){return n&&n.nodeType===1?n:(n&&n.parentElement?n.parentElement:null);}
  function codeForNode(n){var e=nodeElement(n);return e?closest(e,'[data-comment-code]'):null;}
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
    var codes=$all('[data-comment-code]').filter(function(code){
      try{return range.intersectsNode(code);}catch(e){return false;}
    });
    if(!codes.length)return null;
    var file='',rows=[],segments=[];
    for(var i=0;i<codes.length;i++){
      var code=codes[i],row=closest(code,'[data-file][data-line]');
      if(!row)return null;
      var f=row.getAttribute('data-file')||'';
      if(!f)return null;
      if(file&&f!==file)return null;
      file=f;
      var piece=selectedTextInCode(range,code);
      if(piece)segments.push(piece);
      rows.push(row);
    }
    var selectedText=segments.join('\\n').trim();
    if(!selectedText)return null;
    var firstRow=rows[0],lastRow=rows[rows.length-1];
    var startLine=parseInt(firstRow.getAttribute('data-line')||'0',10);
    var endLine=parseInt(lastRow.getAttribute('data-line')||'0',10);
    if(!startLine||!endLine)return null;
    var firstText=selectedTextInCode(range,codes[0]);
    var lastText=selectedTextInCode(range,codes[codes.length-1]);
    var firstOffset=selectedOffsetInCode(codes[0],firstText);
    var lastOffset=selectedOffsetInCode(codes[codes.length-1],lastText);
    return {
      anchorRow:lastRow,
      file:file,
      line:startLine,
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
    $all('.ds-tab').forEach(function(t){t.classList.toggle('is-active',t.getAttribute('data-view')===v);});
    $all('[data-rail]').forEach(function(r){r.hidden=r.getAttribute('data-rail')!==v;});
    if(v==='files'&&selectedFile<0)selectFile(0);
    if(v!=='tour'){readAloud=false;try{localStorage.setItem('ds-readaloud','');}catch(e){}cancelSpeech();}
  }

  function setActive(i){
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
    speakStep(i);prefetchNextSpeech(i);
  }

  function clearVoiceFocus(){
    voiceFocusTimers.forEach(function(t){clearTimeout(t);});
    voiceFocusTimers=[];
    voiceFocusIndex=-1;
    voiceFocusGroup=-1;
    $all('.ds-step.is-voice-active').forEach(function(p){p.classList.remove('is-voice-active');});
    $all('.ds-row.is-voice-focus').forEach(function(r){r.classList.remove('is-voice-focus');});
  }
  function voiceFocusGroups(panel){
    var seen={};
    $all('[data-step-focus]',panel).forEach(function(r){
      var n=parseInt(r.getAttribute('data-step-focus')||'0',10);
      if(!isNaN(n))seen[n]=true;
    });
    return Object.keys(seen).map(function(k){return parseInt(k,10);}).sort(function(a,b){return a-b;});
  }
  function estimatedSpeechDurationMs(text){
    var words=(text||'').split(/\\s+/).filter(Boolean).length;
    return Math.max(2400,Math.round(words/Math.max(80,155*rate)*60000));
  }
  function activeVoiceFocusRows(panel,group){
    var groups=voiceFocusGroups(panel);
    if(groups.length){
      var g=groups.indexOf(group)>=0?group:groups[0];
      return $all('[data-step-focus="'+g+'"]',panel);
    }
    var rows=$all('.ds-row-add,.ds-row-del',panel);
    return rows.length?rows:$all('.ds-row',panel);
  }
  function applyVoiceFocusGroup(stepIndex,group){
    if(stepIndex==null||stepIndex<0)return;
    var panel=stepPanels&&stepPanels[stepIndex];if(!panel)return;
    if(voiceFocusIndex===stepIndex&&voiceFocusGroup>group)return;
    $all('.ds-row.is-voice-focus',panel).forEach(function(r){r.classList.remove('is-voice-focus');});
    voiceFocusIndex=stepIndex;
    voiceFocusGroup=group;
    panel.classList.add('is-voice-active');
    var focusRows=activeVoiceFocusRows(panel,group);
    focusRows.forEach(function(r){r.classList.add('is-voice-focus');});
    if(focusRows[0]&&focusRows[0].scrollIntoView){
      setTimeout(function(){
        try{focusRows[0].scrollIntoView({block:'center',inline:'nearest',behavior:'smooth'});}
        catch(e){try{focusRows[0].scrollIntoView(false);}catch(ignore){}}
      },120);
    }
  }
  function setVoiceFocus(stepIndex,focusGroup){
    clearVoiceFocus();
    applyVoiceFocusGroup(stepIndex,focusGroup||0);
  }
  function focusGroupForChar(stepIndex,charIndex,text){
    var panel=stepPanels&&stepPanels[stepIndex];if(!panel)return 0;
    var count=Math.max(1,voiceFocusGroups(panel).length);
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
    var count=Math.max(1,voiceFocusGroups(panel).length);
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
    u.onstart=function(){activeUtterance=u;if(opts.stepIndex!=null)startVoiceFocusSequence(opts.stepIndex,text);if(btn)btn.classList.add('is-speaking');updateReadAloudButton();};
    u.onboundary=function(e){if(opts.stepIndex!=null&&e&&typeof e.charIndex==='number')updateVoiceFocusForChar(opts.stepIndex,e.charIndex,text);};
    u.onend=function(){if(activeUtterance===u)activeUtterance=null;if(opts.stepIndex!=null)clearVoiceFocus();if(btn)btn.classList.remove('is-speaking');updateReadAloudButton();};
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
  function stepText(panel){
    var w=$('.ds-why-text',panel);
    return speechClean(w?w.textContent:'');
  }
  function speakStep(i){var p=stepPanels[i];if(readAloud&&p)return speak(stepText(p),{stepIndex:i});return false;}
  function nextSpeakableStep(i){
    for(var j=i+1;j<total;j++){if(stepText(stepPanels[j]))return j;}
    return -1;
  }
  function prefetchNextSpeech(i){
    if(!readAloud)return;
    var engine=voiceEngine==='say'||voiceEngine==='kokoro'?voiceEngine:'';
    if(!engine)return;
    var n=nextSpeakableStep(i);if(n<0)return;
    var text=stepText(stepPanels[n]);if(!text)return;
    var voice=engine==='kokoro'?kokoroVoice:sayVoice;
    prefetchGeneratedSpeech(engine,text,voice,rate);
  }
  function firstSpeakableStep(){
    for(var j=Math.max(1,active);j<total;j++){if(stepText(stepPanels[j]))return j;}
    for(var k=1;k<Math.min(total,Math.max(1,active));k++){if(stepText(stepPanels[k]))return k;}
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
    a.onended=function(){if(localAudio===a)localAudio=null;if(activeUtterance===a)activeUtterance=null;if(opts.stepIndex!=null)clearVoiceFocus();if(btn)btn.classList.remove('is-speaking');updateReadAloudButton();};
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
    if(opts.stepIndex!=null)startVoiceFocusSequence(opts.stepIndex,text);else clearVoiceFocus();
    var voice=engine==='kokoro'?(opts.voice||kokoroVoice):(opts.voice||sayVoice);
    var speechRate=opts.rate||rate;
    var cached=!opts.preview&&cachedGeneratedSpeech(engine,text,voice,speechRate);
    if(btn)btn.classList.add('is-speaking');
    if(cached){playFetchedGeneratedAudio(engine,text,opts,token,btn,null,cached);prefetchNextSpeech(active);return true;}
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    speechAbort=ctrl;
    setGeneratedSpeechLoading(token,opts.preview?'Generating preview':'Generating speech',engine,voice,opts.preview?'preview':'speech');
    fetchGeneratedSpeech(engine,text,voice,speechRate,ctrl?ctrl.signal:undefined)
      .then(function(d){playFetchedGeneratedAudio(engine,text,opts,token,btn,ctrl,d);if(!opts.preview)prefetchNextSpeech(active);})
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
    fetch('/api/fullfile?file='+encodeURIComponent(file)).then(function(r){return r.text();}).then(function(html){fullInner.innerHTML=html;mountThreads(fullInner);}).catch(function(){fullInner.removeAttribute('data-loaded');fullInner.innerHTML='<div class="ds-diffnote">Could not load the full file.</div>';});
  }

  function openDrawer(){if(drawer){drawer.hidden=false;document.body.classList.add('ds-noscroll');}}
  function closeDrawer(){if(drawer){drawer.hidden=true;document.body.classList.remove('ds-noscroll');}}

  function threadAfter(row){
    var t=row.nextElementSibling;
    if(t&&t.classList&&t.classList.contains('ds-thread'))return t;
    t=el('div','ds-thread');row.parentNode.insertBefore(t,row.nextSibling);return t;
  }
  var allComments=[];
  function mountThreads(scope){
    if(!scope)return;
    var rows=$all('[data-line]',scope);
    for(var i=0;i<rows.length;i++){
      var row=rows[i],file=row.getAttribute('data-file'),line=row.getAttribute('data-line');
      if(!file||line==null)continue;
      for(var j=0;j<allComments.length;j++){
        var c=allComments[j];
        if(c.file!==file||String(c.line)!==String(line))continue;
        var th=threadAfter(row);
        if(!$('.ds-comment[data-comment-id="'+c.id+'"]',th))th.appendChild(buildComment(c));
      }
    }
  }
  function syncThreads(){ mountThreads(document); }
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
    if(c.selectedText){
      var picked=el('div','ds-comment-selection');
      picked.appendChild(el('span','', 'Selected'));
      picked.appendChild(el('code','',c.selectedText));
      card.appendChild(picked);
    }
    card.appendChild(el('div','ds-comment-body',c.body));
    var actions=el('div','ds-comment-actions');
    if(c.status!=='resolved'){var snd=el('button','ds-ghost ds-send','Send again');snd.setAttribute('data-send','');actions.appendChild(snd);}
    var rb=el('button','ds-ghost',c.status==='resolved'?'Reopen':'Resolve');rb.setAttribute('data-resolve','');actions.appendChild(rb);
    var db=el('button','ds-ghost ds-del','Delete');db.setAttribute('data-delete','');actions.appendChild(db);
    card.appendChild(actions);wrap.appendChild(card);return wrap;
  }
  function buildComposer(row,flavor,ctx){
    ctx=ctx||{};
    var file=ctx.file||row.getAttribute('data-file'),line=ctx.line||row.getAttribute('data-line'),step=ctx.step||row.getAttribute('data-step');
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
    var bar=el('div','ds-composer-actions');
    var cancel=el('button','ds-ghost','Cancel');cancel.onclick=function(){removeComposer(box);};
    var submit=el('button','ds-btn ds-btn-solid','Send');
    submit.onclick=function(){
      var body=ta.value.trim();if(!body)return;submit.disabled=true;
      fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:file,line:Number(line),step:step,type:state.flavor,body:body,selectedText:selectedText,selection:ctx.selection})})
        .then(function(r){return r.json();}).then(function(c){
          if(!c||!c.id){submit.disabled=false;return;}
          allComments.push(c);removeComposer(box);syncThreads();refreshCount();sendToAgent([c.id]);
        }).catch(function(){submit.disabled=false;});
    };
    bar.appendChild(cancel);bar.appendChild(submit);
    box.appendChild(tabs);box.appendChild(ta);box.appendChild(bar);return box;
  }
  function removeComposer(box){var b=box||$('.ds-composer');if(b&&b.parentNode)b.parentNode.removeChild(b);}
  function openComposer(row,flavor,ctx){
    removeComposer();if(!row.getAttribute('data-line'))return;
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
      refreshCount();
    }).catch(function(){});
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
    var wraps=$all('.ds-comment[data-comment-id="'+c.id+'"]');
    for(var i=0;i<wraps.length;i++){
      var wrap=wraps[i];
      wrap.setAttribute('data-status',c.status);wrap.className='ds-comment status-'+c.status;
      var sb=$('.ds-statusbadge',wrap);if(sb){sb.textContent='';sb.appendChild(el('span','ds-dot'));sb.appendChild(document.createTextNode(STATUS[c.status]||'Open'));}
      if(c.reply){wrap.setAttribute('data-hasreply','1');ensureReply(wrap,c.reply);}
      var rb=$('[data-resolve]',wrap);if(rb)rb.textContent=c.status==='resolved'?'Reopen':'Resolve';
      var snd=$('[data-send]',wrap);if(snd)snd.style.display=(c.status==='resolved')?'none':'';
    }
  }
  function refreshComments(){
    fetch(API).then(function(r){return r.json();}).then(function(list){
      if(Array.isArray(list)){allComments=list;list.forEach(patchComment);}
      syncThreads();
      refreshCount();
    }).catch(function(){});
  }
  var acAbort=null;
  function acRoot(){ var w=document.getElementById('ds-agentpanel'); return w?w.querySelector('.ds-pp'):null; }
  function ensurePanel(onDoneExtra){
    var root=acRoot(); if(!root)return null;
    return new ProgressPanel(root,{
      onStop:function(){ if(acAbort)acAbort.abort(); },
      onClose:function(){ root.hidden=true; },
      onDone:function(status,result){ if(onDoneExtra)onDoneExtra(status,result); }
    });
  }
  function sendToAgent(ids){
    if(agentBusy){toast('Saved. The agent is already working; use Send open comments after it finishes.');return;}
    var payload=ids==='all'?{all:true}:{commentIds:ids};
    var ctrl=(typeof AbortController!=='undefined')?new AbortController():null;
    acAbort=ctrl;
    var panel=ensurePanel(function(status,result){
      if(status==='complete'){
        refreshComments();
        if(result&&result.codeChanged&&panel&&panel.showFoot){
          var btn=el('button','ds-pp-reload','Reload to see the new diff');
          btn.onclick=function(){location.reload();};
          panel.showFoot(btn);
        }
      }
      setBusy(false); acAbort=null;
    });
    if(!panel){ setBusy(false); return; }
    setBusy(true); panel.start();
    runProgress(panel,ADDRESS_API,payload,ctrl).then(function(){ setBusy(false); acAbort=null; });
  }
  function refreshCount(){
    var openN=$all('.ds-comment').length-$all('.ds-comment.status-resolved').length;
    var b=$('#ds-open-count b');if(b){b.textContent=openN;if(b.nextSibling)b.nextSibling.nodeValue=' '+(openN===1?'comment':'comments');}
    var approve=$('[data-verdict="approve"]'),pill=$('.ds-trustpill'),clean=pill&&pill.classList.contains('is-clean');
    if(approve)approve.disabled=!(openN===0&&clean);
    var aa=$('[data-address-all]');if(aa&&!agentBusy)aa.disabled=openN===0;
    var co=$('[data-copy-comments="open"]');if(co)co.disabled=openN===0;
    var ca=$('[data-copy-comments="all"]');if(ca)ca.disabled=$all('.ds-comment').length===0;
  }
  function verdict(kind){
    var openN=$all('.ds-comment').length-$all('.ds-comment.status-resolved').length;
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
      var head=(i+1)+'. ['+label+'] '+c.file+':'+start+(end&&end!==start?'-'+end:'');
      if(withThread)head+='  ('+(STATUS[c.status]||c.status)+')';
      out.push(head);
      if(c.selectedText)out.push('   Selected: '+String(c.selectedText).replace(/\\n/g,'\\n   '));
      out.push('   '+String(c.body||'').replace(/\\n/g,'\\n   '));
      if(withThread&&c.reply)out.push('   '+BRAND+' reply: '+String(c.reply).replace(/\\n/g,'\\n   '));
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
    if(selectionMenu&&!selectionMenu.hidden&&!closest(t,'[data-selection-menu]'))closeSelectionMenu();
    b=closest(t,'[data-sidebar-toggle]');if(b){setSidebarCollapsed(!document.body.classList.contains('ds-rail-collapsed'));return;}
    b=closest(t,'[data-view]');if(b){setView(b.getAttribute('data-view'));return;}
    b=closest(t,'[data-settings]');if(b){if(sp)sp.hidden=!sp.hidden;return;}
    b=closest(t,'[data-review-menu]');if(b){if(rp)setReviewMenu(rp.hidden);return;}
    b=closest(t,'[data-voice-engine]');if(b){setVoiceEngine(b.getAttribute('data-voice-engine'));return;}
    b=closest(t,'[data-rate]');if(b){setRate(parseFloat(b.getAttribute('data-rate')));return;}
    b=closest(t,'[data-say-voice]');if(b){setSayVoice(b.getAttribute('data-say-voice'),true);return;}
    b=closest(t,'[data-kokoro-voice]');if(b){setKokoroVoice(b.getAttribute('data-kokoro-voice'),true);return;}
    b=closest(t,'[data-voice-preset]');if(b){setVoicePreset(b.getAttribute('data-voice-preset'),true);return;}
    b=closest(t,'[data-preview-voice]');if(b){speakVoicePreview();return;}
    b=closest(t,'[data-playstep]');if(b){var pp=closest(t,'.ds-step');if(pp){var sp=parseInt(pp.getAttribute('data-step-panel')||'0',10);speak(stepText(pp),{stepIndex:sp});}return;}
    b=closest(t,'[data-readaloud]');if(b){toggleReadAloud();return;}
    b=closest(t,'.ds-fileitem');if(b){setView('files');selectFile(Number(b.getAttribute('data-file-index')));return;}
    b=closest(t,'[data-resolve]');if(b){resolveComment(closest(b,'.ds-comment'));return;}
    b=closest(t,'[data-delete]');if(b){deleteComment(closest(b,'.ds-comment'));return;}
    b=closest(t,'[data-send]');if(b){if(b.disabled)return;var cm=closest(b,'.ds-comment');if(cm)sendToAgent([cm.getAttribute('data-comment-id')]);return;}
    b=closest(t,'[data-address-all]');if(b){if(b.disabled)return;setReviewMenu(false);sendToAgent('all');return;}
    b=closest(t,'[data-copy-comments]');if(b){if(b.disabled)return;setReviewMenu(false);copyComments(b.getAttribute('data-copy-comments'));return;}
    b=closest(t,'[data-mode]');if(b){setMode(b);return;}
    b=closest(t,'[data-trust-open]');if(b){openDrawer();return;}
    b=closest(t,'[data-trust-close]');if(b){closeDrawer();return;}
    b=closest(t,'[data-goto-step]');if(b){closeDrawer();setView('tour');setActive(Number(b.getAttribute('data-goto-step')));return;}
    b=closest(t,'[data-goto-file]');if(b){closeDrawer();setView('files');selectFileByPath(b.getAttribute('data-goto-file'));return;}
    b=closest(t,'[data-explain]');if(b){toast('Ask your agent to add a story step for this change (run diffstory story again), so '+BRAND+' narrates why it is here.');return;}
    b=closest(t,'[data-verdict]');if(b){if(b.disabled)return;setReviewMenu(false);verdict(b.getAttribute('data-verdict'));return;}
    b=closest(t,'.ds-stepcard');if(b){setActive(Number(b.getAttribute('data-step-index')));return;}
    b=closest(t,'[data-prev]');if(b){if(!b.disabled)setActive(active-1);return;}
    b=closest(t,'[data-next]');if(b){if(!b.disabled)setActive(active+1);return;}
  }
  function onKey(e){
    if(e.key==='Escape'){setReviewMenu(false);closeSelectionMenu();closeDrawer();removeComposer();return;}
    var railHandle=closest(e.target,'[data-sidebar-resizer]');
    if(railHandle&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){
      setSidebarCollapsed(false);
      setSidebarWidth(currentSidebarWidth()+(e.key==='ArrowRight'?16:-16),true);
      e.preventDefault();
      return;
    }
    var next=e.key==='ArrowRight'||e.key==='j',prev=e.key==='ArrowLeft'||e.key==='k';
    if(next||prev){
      if(isTextEntryTarget(e.target))return;
      if(drawer&&!drawer.hidden)return;
      e.preventDefault();
      if(filesView&&!filesView.hidden)selectFile(selectedFile+(next?1:-1));
      else if(tourView&&!tourView.hidden)setActive(active+(next?1:-1));
      return;
    }
    if(isTextEntryTarget(e.target)||isKeyboardControlTarget(e.target))return;
    if(e.key===' '||e.code==='Space'||e.key==='Spacebar'){if(toggleVoicePause())e.preventDefault();return;}
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
    tourView=$('#ds-view-tour');filesView=$('#ds-view-files');drawer=$('#ds-trust-drawer');toastEl=$('#ds-toast');selectionMenu=$('[data-selection-menu]');
    stepPanels=$all('.ds-step');stepCards=$all('.ds-stepcard');total=stepPanels.length||1;
    filePanels=$all('.ds-filepanel');fileItems=$all('.ds-fileitem');
    document.addEventListener('click',onClick);
    document.addEventListener('contextmenu',openSelectionMenu);
    document.addEventListener('keydown',onKey);
    document.addEventListener('mousedown',startSidebarResize);
    document.addEventListener('mousemove',moveSidebarResize);
    document.addEventListener('mouseup',endSidebarResize);
    document.addEventListener('mousedown',startSplit);
    document.addEventListener('mousemove',moveSplit);
    document.addEventListener('mouseup',endSplit);
    window.addEventListener('resize',function(){setSidebarWidth(currentSidebarWidth(),false);});
    try{var rw=parseFloat(localStorage.getItem('ds-sidebar-width')||'');if(rw)setSidebarWidth(rw,false);else updateSidebarHandle(currentSidebarWidth());}catch(e){updateSidebarHandle(currentSidebarWidth());}
    try{var sv=localStorage.getItem('ds-split');if(sv)document.documentElement.style.setProperty('--ds-split',sv);}catch(e){}
    try{setSidebarCollapsed(!!localStorage.getItem('ds-sidebar-collapsed'));}catch(e){setSidebarCollapsed(false);}
    refreshCount();
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
