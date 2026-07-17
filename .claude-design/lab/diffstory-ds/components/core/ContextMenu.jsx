import React from 'react';
export function ContextMenu({x, y, items=[], onClose}) {
  const e=React.createElement;
  React.useEffect(()=>{
    const k=ev=>{if(ev.key==='Escape')onClose&&onClose()};
    window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);
  },[onClose]);
  return e(React.Fragment,null,
    e('div',{onClick:onClose,onContextMenu:ev=>{ev.preventDefault();onClose&&onClose()},style:{position:'fixed',inset:0,zIndex:60}}),
    e('div',{role:'menu',style:{position:'fixed',left:x,top:y,zIndex:61,minWidth:224,background:'var(--surface)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow)',padding:5,display:'flex',flexDirection:'column'}},
      items.map((it,i)=>it==='divider'
        ?e('div',{key:i,style:{height:1,background:'var(--line-soft)',margin:'4px 6px'}})
        :e(MenuItem,{key:i,item:it,onClose}))));
}
function MenuItem({item,onClose}){
  const e=React.createElement;
  const [hover,setHover]=React.useState(false);
  return e('button',{role:'menuitem',onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),
    onClick:()=>{onClose&&onClose();item.onSelect&&item.onSelect()},
    style:{display:'flex',alignItems:'center',gap:14,width:'100%',textAlign:'left',border:'none',cursor:'pointer',
      padding:'7px 10px',borderRadius:'var(--radius-sm)',fontFamily:'var(--font-sans)',fontSize:12.5,
      background:hover?'var(--fill-1)':'transparent',
      color:item.tone==='danger'?'var(--del)':hover?'var(--text)':'var(--text-2)',fontWeight:item.primary?600:400,
      transition:'background-color var(--motion-duration-fast) ease'}},
    e('span',{style:{minWidth:0,flex:1,color:item.primary&&!hover?'var(--text)':undefined}},item.label),
    item.hint?e('span',{style:{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)',whiteSpace:'nowrap'}},item.hint):null);
}
