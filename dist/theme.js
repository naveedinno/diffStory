// Shared color-theme plumbing for every browser surface. The preference lives in
// localStorage, while data-theme always contains the resolved light/dark value so
// an explicit choice can override the operating-system scheme without CSS drift.
const THEME_ICONS = {
    system: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.25"/><path d="M10 3.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" stroke="none"/></svg>',
    light: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.2"/><path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4"/></svg>',
    dark: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.9 12.4A6.7 6.7 0 0 1 7.6 4.1 6.7 6.7 0 1 0 15.9 12.4z"/></svg>',
};
export function themeControl() {
    return ('<div class="ds-theme-wrap">' +
        '<button class="ds-theme-toggle" type="button" data-theme-toggle aria-haspopup="menu" aria-expanded="false" aria-label="Color theme: System" title="Color theme: System">' +
        `<span data-theme-icon="system">${THEME_ICONS.system}</span>` +
        `<span data-theme-icon="light" hidden>${THEME_ICONS.light}</span>` +
        `<span data-theme-icon="dark" hidden>${THEME_ICONS.dark}</span>` +
        '</button>' +
        '<div class="ds-theme-menu" data-theme-menu role="menu" aria-label="Color theme" hidden>' +
        `<button type="button" role="menuitemradio" data-theme-choice="system" aria-checked="true"><span class="ds-theme-choice-icon">${THEME_ICONS.system}</span><span>System</span><span class="ds-theme-check" aria-hidden="true">✓</span></button>` +
        `<button type="button" role="menuitemradio" data-theme-choice="light" aria-checked="false"><span class="ds-theme-choice-icon">${THEME_ICONS.light}</span><span>Light</span><span class="ds-theme-check" aria-hidden="true">✓</span></button>` +
        `<button type="button" role="menuitemradio" data-theme-choice="dark" aria-checked="false"><span class="ds-theme-choice-icon">${THEME_ICONS.dark}</span><span>Dark</span><span class="ds-theme-check" aria-hidden="true">✓</span></button>` +
        '</div></div>');
}
export function themeControlStyles() {
    return `
.ds-theme-wrap{position:relative;display:inline-flex;align-items:center;flex:none}
.ds-theme-toggle{width:32px;height:32px;display:grid;place-items:center;padding:0;border:.5px solid var(--nv-bd,var(--line,var(--hairline,var(--app-hair))));border-radius:8px;background:var(--nv-fill,var(--fill-1,var(--hover,var(--app-fill))));color:var(--nv-mut,var(--muted,var(--label2,var(--app-l2))));font:inherit;cursor:pointer}
.ds-theme-toggle:hover,.ds-theme-toggle[aria-expanded="true"]{background:var(--nv-fill2,var(--fill-2,var(--hover,var(--app-fill))));color:var(--nv-fg,var(--text,var(--label,var(--app-label))))}
.ds-theme-toggle:focus-visible,.ds-theme-menu button:focus-visible{outline:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--nv-blue,var(--accent,var(--blue,var(--app-blue)))) 34%,transparent)}
.ds-theme-toggle>span{width:17px;height:17px;display:grid;place-items:center}.ds-theme-toggle>span[hidden]{display:none}
.ds-theme-toggle svg,.ds-theme-choice-icon svg{display:block;width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.45;stroke-linecap:round;stroke-linejoin:round}
.ds-theme-menu{position:absolute;top:calc(100% + 7px);right:0;z-index:100;width:154px;padding:5px;border:.5px solid var(--nv-bd,var(--line,var(--hairline,var(--app-hair))));border-radius:10px;background:var(--nv-bg,var(--panel2,var(--sheet,var(--app-elev))));box-shadow:0 12px 34px rgba(0,0,0,.24)}
.ds-theme-menu[hidden]{display:none}
.ds-theme-menu button{width:100%;height:34px;display:grid;grid-template-columns:18px minmax(0,1fr) 14px;align-items:center;gap:8px;padding:0 9px;border:0;border-radius:7px;background:transparent;color:var(--nv-fg,var(--text,var(--label,var(--app-label))));font:inherit;font-size:12.5px;text-align:left;cursor:pointer}
.ds-theme-menu button:hover,.ds-theme-menu button:focus-visible{background:var(--nv-fill,var(--fill-2,var(--hover,var(--app-fill))))}
.ds-theme-choice-icon{width:16px;height:16px;color:var(--nv-mut,var(--muted,var(--label2,var(--app-l2))))}
.ds-theme-check{color:var(--nv-blue,var(--accent,var(--blue,var(--app-blue))));font-weight:800;opacity:0}.ds-theme-menu button[aria-checked="true"] .ds-theme-check{opacity:1}
@media (prefers-reduced-motion:reduce){.ds-theme-toggle,.ds-theme-menu button{transition:none}}
`;
}
/**
 * Inline this in <head> before page CSS. It applies the saved preference before
 * first paint, then wires any theme controls after the document is ready.
 */
export function themeBootstrapScript() {
    return `<script>
(function(){
  var key='ds-theme',media=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
  function readMode(){try{var value=localStorage.getItem(key);return value==='light'||value==='dark'?value:'system';}catch(e){return 'system';}}
  function resolved(mode){return mode==='system'?(media&&media.matches?'dark':'light'):mode;}
  function apply(mode){
    var value=resolved(mode),root=document.documentElement,previous=root.getAttribute('data-theme');
    root.setAttribute('data-theme',value);root.setAttribute('data-theme-mode',mode);root.style.colorScheme=value;
    var meta=document.querySelector('meta[data-ds-theme-color]');if(meta)meta.setAttribute('content',value==='dark'?'#15171b':'#f1f3f6');
    syncControls(mode);
    if(previous&&previous!==value&&typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('ds-theme-change',{detail:{theme:value,mode:mode}}));
  }
  function save(mode){try{if(mode==='system')localStorage.removeItem(key);else localStorage.setItem(key,mode);}catch(e){}apply(mode);}
  function syncControls(mode){
    document.querySelectorAll('[data-theme-toggle]').forEach(function(toggle){
      var label='Color theme: '+mode.charAt(0).toUpperCase()+mode.slice(1);toggle.setAttribute('aria-label',label);toggle.setAttribute('title',label);
      toggle.querySelectorAll('[data-theme-icon]').forEach(function(icon){icon.hidden=icon.getAttribute('data-theme-icon')!==mode;});
    });
    document.querySelectorAll('[data-theme-choice]').forEach(function(choice){choice.setAttribute('aria-checked',choice.getAttribute('data-theme-choice')===mode?'true':'false');});
  }
  function close(wrap,restore){var toggle=wrap.querySelector('[data-theme-toggle]'),menu=wrap.querySelector('[data-theme-menu]');if(!toggle||!menu)return;menu.hidden=true;toggle.setAttribute('aria-expanded','false');if(restore)toggle.focus();}
  function init(){
    syncControls(readMode());
    document.querySelectorAll('.ds-theme-wrap').forEach(function(wrap){
      var toggle=wrap.querySelector('[data-theme-toggle]'),menu=wrap.querySelector('[data-theme-menu]');if(!toggle||!menu)return;
      toggle.addEventListener('click',function(){
        var opening=menu.hidden;document.querySelectorAll('.ds-theme-wrap').forEach(function(other){if(other!==wrap)close(other,false);});
        menu.hidden=!opening;toggle.setAttribute('aria-expanded',opening?'true':'false');
        if(opening){var active=menu.querySelector('[aria-checked="true"]');if(active)active.focus();}
      });
      menu.addEventListener('click',function(event){var choice=event.target.closest('[data-theme-choice]');if(!choice)return;save(choice.getAttribute('data-theme-choice'));close(wrap,true);});
      menu.addEventListener('keydown',function(event){
        if(event.key==='Escape'){event.preventDefault();close(wrap,true);return;}
        if(event.key!=='ArrowDown'&&event.key!=='ArrowUp'&&event.key!=='Home'&&event.key!=='End')return;
        event.preventDefault();var items=Array.prototype.slice.call(menu.querySelectorAll('[data-theme-choice]')),index=items.indexOf(document.activeElement);
        if(event.key==='Home')index=0;else if(event.key==='End')index=items.length-1;else index=(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
        if(items[index])items[index].focus();
      });
    });
    document.addEventListener('mousedown',function(event){document.querySelectorAll('.ds-theme-wrap').forEach(function(wrap){if(!wrap.contains(event.target))close(wrap,false);});});
  }
  apply(readMode());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  if(media){var onScheme=function(){if(readMode()==='system')apply('system');};if(media.addEventListener)media.addEventListener('change',onScheme);else if(media.addListener)media.addListener(onScheme);}
  window.addEventListener('storage',function(event){if(event.key===key)apply(readMode());});
})();
</script>`;
}
// The shared graphite review palette. Dark is the no-script fallback; the head
// bootstrap resolves System to a concrete data-theme value before first paint.
export function sharedTokens() {
    return `
:root{color-scheme:dark;--app-bg:#15171b;--app-elev:#22252b;--app-label:#f4f6f8;--app-l2:#b3b8c2;--app-l3:#858c98;
  --app-hair:rgba(255,255,255,.13);--app-sep:rgba(255,255,255,.075);--app-fill:rgba(255,255,255,.075);--app-subbg:rgba(255,255,255,.035);
  --app-blue:#4a9cff;--app-blue2:#72b2ff;--app-add:#48d597;--app-del:#ff756e;--app-addbar:#48d597;--app-delbar:#ff625b;
  --motion-ease-out:cubic-bezier(0.23,1,0.32,1);--motion-ease-in-out:cubic-bezier(0.77,0,0.175,1);--motion-ease-drawer:cubic-bezier(0.32,0.72,0,1);
  --motion-duration-press:120ms;--motion-duration-fast:150ms;--motion-duration-ui:200ms;--motion-duration-progress:250ms}
:root[data-theme="light"]{color-scheme:light;--app-bg:#f1f3f6;--app-elev:#ffffff;--app-label:#17191e;--app-l2:#5e6470;--app-l3:#858c99;
  --app-hair:rgba(18,23,32,.13);--app-sep:rgba(18,23,32,.075);--app-fill:rgba(15,23,42,.055);--app-subbg:rgba(15,23,42,.028);
  --app-blue:#0866e5;--app-blue2:#0057ca;--app-add:#177a51;--app-del:#bd2a22;--app-addbar:#2b9a68;--app-delbar:#e14a43}
`;
}
