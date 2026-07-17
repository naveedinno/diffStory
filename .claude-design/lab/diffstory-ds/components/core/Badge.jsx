import React from 'react';
export function Badge({tone='neutral', mono=true, children, style}) {
  const tones={neutral:{bg:'var(--fill-2)',fg:'var(--text-2)'},accent:{bg:'var(--accent-soft)',fg:'var(--accent)'},
    add:{bg:'var(--add-soft)',fg:'var(--add)'},del:{bg:'var(--del-soft)',fg:'var(--del)'},amber:{bg:'var(--amber-soft)',fg:'var(--amber)'}};
  const t=tones[tone]||tones.neutral;
  return React.createElement('span',{style:{display:'inline-flex',alignItems:'center',padding:'2px 7px',
    borderRadius:'var(--radius-sm)',background:t.bg,color:t.fg,
    fontFamily:mono?'var(--font-mono)':'var(--font-sans)',fontSize:9.5,fontWeight:600,
    letterSpacing:mono?'var(--tracking-kicker)':0,textTransform:mono?'uppercase':'none',whiteSpace:'nowrap',...style}},children);
}
