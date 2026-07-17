// Fallback loader: uses the compiled _ds_bundle.js namespace when present,
// otherwise fetches component sources and transforms them in-browser.
window.loadDS = async function(root){
  if(window.__dsNS) return window.__dsNS;
  try{
    const probe='_ds_'+'bundle.js';
    const r=await fetch(root+probe,{method:'HEAD'});
    if(r.ok) await new Promise((res,rej)=>{const s=document.createElement('script');s.src=root+probe;s.onload=res;s.onerror=rej;document.head.appendChild(s)});
  }catch(e){}
  const found = Object.keys(window).map(k=>{try{const v=window[k];return v&&typeof v==='object'&&v.Button&&v.ThreadRail?v:null}catch(e){return null}}).find(Boolean);
  if(found) return (window.__dsNS=found);
  const files=['core/Button','core/IconButton','core/Input','core/SegmentedControl','core/Badge','core/StatChip','core/ContextMenu',
    'review/Kicker','review/ThreadRail','review/FileRow','review/ProgressBar','review/ReviewCard','review/DiffLine','review/FeedbackThread','review/FeedbackComposer'];
  const NS={};
  const sources=await Promise.all(files.map(f=>fetch(root+'components/'+f+'.jsx').then(r=>r.text())));
  files.forEach((f,i)=>{
    const name=f.split('/')[1];
    const src=sources[i].replace(/^import .*$/gm,'').replace(/^export /gm,'');
    const js=Babel.transform(src,{presets:[['react',{runtime:'classic',pragma:'React.createElement'}]],filename:name+'.jsx'}).code;
    NS[name]=(new Function('React',js+'\nreturn '+name+';'))(window.React);
  });
  return (window.__dsNS=NS);
};
window.loadJsx = async function(url){
  const src=await (await fetch(url)).text();
  const js=Babel.transform(src,{presets:[['react',{runtime:'classic',pragma:'React.createElement'}]],filename:url}).code;
  (new Function('React','ReactDOM',js))(window.React,window.ReactDOM);
};
