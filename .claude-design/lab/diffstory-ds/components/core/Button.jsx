import React from 'react';
export function Button({variant='primary', size='md', disabled=false, children, onClick, style}) {
  const [hover,setHover]=React.useState(false),[press,setPress]=React.useState(false);
  const h=size==='sm'?'var(--control-h)':'var(--control-h-lg)';
  const base={display:'inline-flex',alignItems:'center',gap:8,height:h,padding:size==='sm'?'0 13px':'0 16px',
    borderRadius:'var(--radius)',fontFamily:'var(--font-sans)',fontSize:size==='sm'?12.5:13,fontWeight:600,
    cursor:disabled?'default':'pointer',border:'1px solid transparent',whiteSpace:'nowrap',userSelect:'none',
    transition:'background-color var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease,transform var(--motion-duration-press) var(--motion-ease-out)',
    transform:press&&!disabled?'scale(.97)':'none',opacity:disabled?.45:1};
  const looks={
    primary:{background:hover&&!disabled?'var(--accent-hi)':'var(--accent)',color:'var(--on-accent)'},
    secondary:{background:hover&&!disabled?'var(--fill-2)':'transparent',color:hover&&!disabled?'var(--text)':'var(--text-2)',border:'1px solid var(--line)'},
    ghost:{background:hover&&!disabled?'var(--fill-2)':'transparent',color:hover&&!disabled?'var(--text)':'var(--text-2)'}};
  return React.createElement('button',{style:{...base,...looks[variant],...style},disabled,onClick,
    onMouseEnter:()=>setHover(true),onMouseLeave:()=>{setHover(false);setPress(false)},
    onMouseDown:()=>setPress(true),onMouseUp:()=>setPress(false)},children);
}
