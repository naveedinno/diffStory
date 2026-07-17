import React from 'react';
export function SegmentedControl({options=[], value, onChange, size='md', style}) {
  return React.createElement('div',{role:'tablist',style:{display:'inline-flex',gap:2,padding:2,
    background:'var(--fill-1)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius)',...style}},
    options.map(opt=>{const active=opt===value;
      return React.createElement('button',{key:opt,role:'tab','aria-selected':active,onClick:()=>onChange&&onChange(opt),
        style:{height:size==='md'?28:24,padding:'0 12px',border:'none',borderRadius:'calc(var(--radius) - 2px)',
          background:active?'var(--surface-3)':'transparent',color:active?'var(--text)':'var(--text-2)',
          fontFamily:'var(--font-sans)',fontSize:12.5,fontWeight:active?600:500,cursor:'pointer',whiteSpace:'nowrap',
          transition:'background-color var(--motion-duration-fast) ease,color var(--motion-duration-fast) ease'}},opt)}));
}
