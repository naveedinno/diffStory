import React from 'react';
export function DiffLine({no, sign=' ', children, focus=false, style}) {
  const bg=sign==='+'?'var(--add-bg)':sign==='-'?'var(--del-bg)':'transparent';
  const signColor=sign==='+'?'var(--add)':sign==='-'?'var(--del)':'var(--text-3)';
  return React.createElement('div',{style:{display:'flex',fontFamily:'var(--font-mono)',fontSize:12.5,lineHeight:'22px',
    background:focus?'var(--accent-soft)':bg,minWidth:0,...style}},
    React.createElement('span',{style:{width:44,flex:'none',textAlign:'right',paddingRight:12,color:focus?'var(--accent)':'var(--text-3)',
      background:'var(--gutter)',userSelect:'none',fontSize:11.5}},no??''),
    React.createElement('span',{style:{width:22,flex:'none',textAlign:'center',color:signColor,userSelect:'none'}},sign.trim()),
    React.createElement('span',{style:{whiteSpace:'pre',overflow:'hidden',textOverflow:'ellipsis',color:'var(--text)'}},children));
}
