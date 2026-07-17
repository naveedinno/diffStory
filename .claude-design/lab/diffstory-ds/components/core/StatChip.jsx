import React from 'react';
export function StatChip({added, removed, children, style}) {
  return React.createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 11px',
    background:'var(--fill-1)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius)',
    fontFamily:'var(--font-mono)',fontSize:11.5,color:'var(--text-2)',whiteSpace:'nowrap',...style}},
    added!=null?React.createElement('span',{style:{color:'var(--add)'}},'+'+added):null,
    removed!=null?React.createElement('span',{style:{color:'var(--del)'}},'−'+removed):null,
    children);
}
