import React from 'react';
export function IconButton({label, active=false, size=32, children, onClick, style}) {
  const [hover,setHover]=React.useState(false);
  return React.createElement('button',{'aria-label':label,title:label,onClick,
    onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),
    style:{width:size,height:size,display:'grid',placeItems:'center',padding:0,
      border:'1px solid '+(active?'var(--accent-line)':'var(--line-soft)'),borderRadius:'var(--radius)',
      background:active?'var(--accent-soft)':hover?'var(--fill-2)':'var(--fill-1)',
      color:active?'var(--accent)':hover?'var(--text)':'var(--text-2)',cursor:'pointer',
      transition:'background-color var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease',...style}},children);
}
