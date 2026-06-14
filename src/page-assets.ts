// Inlined CSS + client JS for the review page. Kept as plain strings (no backticks,
// no ${} in the JS) so they drop straight into the render template literal.

export const PAGE_CSS = `
:root{
  --bg:#0d1117; --panel:#161b22; --panel2:#0f141a; --border:#30363d;
  --text:#c9d1d9; --muted:#8b949e; --accent:#58a6ff;
  --add:rgba(46,160,67,.15); --add-bd:#2ea043;
  --del:rgba(248,81,73,.15); --del-bd:#f85149;
  --amber:#d29922; --warn:#f85149;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);
  font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
header.top{position:sticky;top:0;z-index:20;background:var(--panel);
  border-bottom:1px solid var(--border);padding:14px 22px}
header.top h1{margin:0;font-size:18px;display:flex;align-items:center;gap:10px}
.brand{color:var(--muted);font-weight:600;letter-spacing:.5px;text-transform:lowercase}
.summary{color:var(--muted);margin:6px 0 0;max-width:70ch}
.meta{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pill{font-size:12px;padding:2px 9px;border-radius:999px;border:1px solid var(--border);
  background:var(--panel2);color:var(--muted)}
.pill.ok{color:var(--add-bd);border-color:var(--add-bd)}
.pill.warn{color:var(--warn);border-color:var(--warn)}
.layout{display:flex;align-items:flex-start;gap:0}
nav.rail{position:sticky;top:74px;align-self:flex-start;width:260px;flex:0 0 260px;
  max-height:calc(100vh - 74px);overflow:auto;padding:18px 10px 40px 22px}
nav.rail ol{list-style:none;margin:0;padding:0}
nav.rail a{display:block;padding:7px 10px;border-radius:6px;color:var(--text);
  border-left:2px solid transparent;font-size:13px}
nav.rail a:hover{background:var(--panel)}
nav.rail a.active{background:var(--panel);border-left-color:var(--accent)}
nav.rail .num{color:var(--muted);margin-right:6px}
nav.rail .ktag{float:right;font-size:10px;color:var(--muted);text-transform:uppercase;margin-top:3px}
main{flex:1 1 auto;min-width:0;padding:18px 28px 120px;max-width:1100px}
section.step{margin:0 0 30px;border:1px solid var(--border);border-radius:10px;
  overflow:hidden;background:var(--panel2)}
.step-head{display:flex;align-items:baseline;gap:10px;padding:13px 16px;background:var(--panel)}
.step-head .order{color:var(--muted);font-variant-numeric:tabular-nums}
.step-head h2{margin:0;font-size:15px}
.kind{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);
  border:1px solid var(--border);border-radius:4px;padding:1px 6px;margin-left:auto}
.loc{font-family:var(--mono);font-size:12px;color:var(--muted);padding:6px 16px;
  border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center}
.why{padding:12px 16px;color:var(--text);background:rgba(88,166,255,.06);
  border-bottom:1px solid var(--border);border-left:3px solid var(--accent)}
.jumps{padding:8px 16px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--border)}
.jumps a{margin-right:12px}
.code{font-family:var(--mono);font-size:12.5px;overflow-x:auto}
.gap{height:0;border-top:1px dashed var(--border);margin:0;text-align:center}
.gap span{display:inline-block;transform:translateY(-10px);background:var(--panel2);
  color:var(--muted);padding:0 8px;font-size:11px}
.ln{display:grid;grid-template-columns:26px 52px 1fr;align-items:stretch;
  border-left:3px solid transparent;white-space:pre}
.ln .gut{text-align:center;user-select:none;border-right:1px solid var(--border);color:transparent}
.ln .gutter{cursor:pointer}
.ln:hover .gutter{color:var(--accent)}
.ln .no{color:var(--muted);text-align:right;padding:0 8px;user-select:none;
  font-variant-numeric:tabular-nums;opacity:.7}
.ln .code-content{padding:0 12px;overflow:visible}
.ln.add{background:var(--add);border-left-color:var(--add-bd)}
.ln.del{background:var(--del);border-left-color:var(--del-bd)}
.ln.has-comment{box-shadow:inset 3px 0 0 var(--amber)}
.uncovered{border:1px solid var(--warn);border-radius:10px;margin-top:10px;background:rgba(248,81,73,.05)}
.uncovered .step-head{background:rgba(248,81,73,.12)}
.uncovered h2{color:var(--warn)}
/* comments */
.thread{padding:6px 16px 10px 56px;background:var(--panel)}
.composer{padding:10px 16px 12px 56px;background:var(--panel)}
.composer textarea{width:100%;min-height:60px;background:var(--bg);color:var(--text);
  border:1px solid var(--border);border-radius:6px;padding:8px;font:13px var(--mono);resize:vertical}
.composer-bar{display:flex;gap:8px;margin-top:8px;align-items:center}
.composer select,button{font:13px inherit;border-radius:6px;border:1px solid var(--border);
  background:var(--panel2);color:var(--text);padding:5px 11px;cursor:pointer}
button.c-save{background:var(--accent);color:#0d1117;border-color:var(--accent);font-weight:600}
button:disabled{opacity:.5;cursor:default}
.comment{border:1px solid var(--border);border-radius:8px;padding:9px 11px;margin:6px 0;background:var(--panel2)}
.c-head{display:flex;gap:8px;align-items:center;margin-bottom:5px}
.c-badge{font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:1px 7px;border-radius:4px;font-weight:700}
.c-change{background:rgba(210,153,34,.2);color:var(--amber)}
.c-question{background:rgba(88,166,255,.2);color:var(--accent)}
.c-nit{background:rgba(139,148,158,.2);color:var(--muted)}
.c-status{font-size:11px;color:var(--muted)}
.comment.status-addressed{border-color:var(--add-bd)}
.comment.status-addressed .c-status{color:var(--add-bd)}
.c-del{margin-left:auto;font-size:11px;padding:2px 8px;color:var(--muted)}
.c-body{white-space:pre-wrap}
.c-reply{margin-top:8px;padding:8px 10px;border-left:2px solid var(--add-bd);background:rgba(46,160,67,.08);border-radius:0 6px 6px 0}
.c-reply-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--add-bd);font-weight:700;margin-bottom:3px}
.floating-thread{margin:0 16px 14px;border-top:1px dashed var(--border);padding-left:0}
.empty{padding:40px;text-align:center;color:var(--muted)}
`;

// No backticks and no ${} below — safe to embed in a template literal.
export const PAGE_JS = `
(function(){
  var API='/api/comments';
  var byId={};
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  function lineSel(c){return '.ln[data-step="'+c.step+'"][data-line="'+c.line+'"]';}

  function renderComment(c){
    var wrap=el('div','comment status-'+c.status);
    var head=el('div','c-head');
    head.appendChild(el('span','c-badge c-'+c.type,c.type));
    head.appendChild(el('span','c-status',c.status));
    if(c.status==='open'){
      var del=el('button','c-del','delete');
      del.onclick=function(){remove(c);};
      head.appendChild(del);
    }
    wrap.appendChild(head);
    wrap.appendChild(el('div','c-body',c.body));
    if(c.reply){
      var r=el('div','c-reply');
      r.appendChild(el('div','c-reply-label','agent reply'));
      r.appendChild(el('div','c-reply-body',c.reply));
      wrap.appendChild(r);
    }
    return wrap;
  }
  function thread(lineEl){
    var n=lineEl.nextElementSibling;
    if(n&&n.classList.contains('thread'))return n;
    var t=el('div','thread');
    lineEl.parentNode.insertBefore(t,lineEl.nextSibling);
    return t;
  }
  function attach(c){
    var lineEl=document.querySelector(lineSel(c));
    if(lineEl){lineEl.classList.add('has-comment');thread(lineEl).appendChild(renderComment(c));return;}
    var stepEl=document.getElementById('step-'+c.step);
    if(!stepEl)return;
    var t=stepEl.querySelector('.floating-thread');
    if(!t){t=el('div','thread floating-thread');stepEl.appendChild(t);}
    t.appendChild(renderComment(c));
  }
  function count(){
    var n=Object.keys(byId).length;
    var b=document.getElementById('comment-count');
    if(b)b.textContent=n+(n===1?' comment':' comments');
  }
  function composer(lineEl){
    var open=lineEl.parentNode.querySelector('.composer');
    if(open){open.parentNode.removeChild(open);return;}
    var box=el('div','composer');
    var ta=document.createElement('textarea');
    ta.placeholder='Leave a note for the agent\\u2026';
    var bar=el('div','composer-bar');
    var sel=document.createElement('select');
    ['change','question','nit'].forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;sel.appendChild(o);});
    var save=el('button','c-save','Comment');
    var cancel=el('button','c-cancel','Cancel');
    bar.appendChild(sel);bar.appendChild(save);bar.appendChild(cancel);
    box.appendChild(ta);box.appendChild(bar);
    lineEl.parentNode.insertBefore(box,lineEl.nextSibling);
    ta.focus();
    cancel.onclick=function(){box.parentNode.removeChild(box);};
    save.onclick=function(){
      var body=ta.value.trim();if(!body)return;save.disabled=true;
      fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        file:lineEl.getAttribute('data-file'),line:Number(lineEl.getAttribute('data-line')),
        step:lineEl.getAttribute('data-step'),type:sel.value,body:body})})
      .then(function(r){return r.json();}).then(function(c){
        box.parentNode.removeChild(box);byId[c.id]=c;attach(c);count();
      }).catch(function(){save.disabled=false;});
    };
  }
  function remove(c){
    fetch(API+'/'+c.id,{method:'DELETE'}).then(function(){delete byId[c.id];location.reload();}).catch(function(){});
  }
  function load(){
    fetch(API).then(function(r){return r.json();}).then(function(list){
      list.forEach(function(c){byId[c.id]=c;attach(c);});count();
    }).catch(function(){});
  }
  function rail(){
    var links={};
    document.querySelectorAll('nav.rail a').forEach(function(a){links[a.getAttribute('href').slice(1)]=a;});
    var obs=new IntersectionObserver(function(es){
      es.forEach(function(en){
        if(en.isIntersecting){
          for(var k in links)links[k].classList.remove('active');
          if(links[en.target.id])links[en.target.id].classList.add('active');
        }
      });
    },{rootMargin:'-8% 0px -82% 0px'});
    document.querySelectorAll('section.step').forEach(function(s){obs.observe(s);});
  }
  document.addEventListener('click',function(e){
    var t=e.target;
    if(t&&t.classList&&t.classList.contains('gutter')){var l=t.closest('.ln');if(l)composer(l);}
  });
  function init(){load();rail();}
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
`;
