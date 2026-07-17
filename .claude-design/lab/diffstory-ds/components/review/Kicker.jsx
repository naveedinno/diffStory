import React from 'react';
export function Kicker({tone='faint', children, style}) {
  const colors={faint:'var(--text-3)',accent:'var(--accent)',muted:'var(--text-2)'};
  return React.createElement('div',{style:{fontFamily:'var(--font-mono)',fontSize:10.5,fontWeight:500,
    letterSpacing:'var(--tracking-kicker)',textTransform:'uppercase',color:colors[tone]||colors.faint,
    whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',...style}},children);
}
