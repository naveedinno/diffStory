import React from 'react';
export function FileRow({path, added=0, removed=0, selected=false, reviewed=false, onClick, style}) {
  const [hover,setHover]=React.useState(false);
  const i=path.lastIndexOf('/');
  const dir=i>=0?path.slice(0,i+1):'', name=i>=0?path.slice(i+1):path;
  return React.createElement('button',{onClick,onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),
    style:{display:'flex',alignItems:'center',gap:12,width:'100%',minWidth:0,padding:'9px 12px',border:'none',textAlign:'left',
      borderRadius:'var(--radius)',cursor:'pointer',
      background:selected?'var(--accent-soft)':hover?'var(--fill-1)':'transparent',
      transition:'background-color var(--motion-duration-fast) ease',...style}},
    React.createElement('span',{style:{fontFamily:'var(--font-mono)',fontSize:12,minWidth:0,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
      color:reviewed?'var(--text-3)':'var(--text-2)',textDecoration:reviewed?'line-through':'none'}},
      dir,React.createElement('span',{style:{color:reviewed?'var(--text-3)':'var(--text)',fontWeight:600}},name)),
    React.createElement('span',{style:{fontFamily:'var(--font-mono)',fontSize:10.5,whiteSpace:'nowrap',flex:'none',color:'var(--text-3)',opacity:hover||selected?1:.7}},
      added?'+'+added:null,
      added&&removed?' ':null,
      removed?'−'+removed:null));
}
