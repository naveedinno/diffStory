import React from 'react';
export function FeedbackComposer({anchor, code, value, onChange, onSend, onCancel, ctaLabel='Add note', placeholder='What should change? The agent receives the exact selection with this note.', style}) {
  const e=React.createElement;
  return e('div',{style:{background:'var(--surface)',border:'1px solid var(--accent-line)',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow)',padding:'12px 14px',display:'flex',flexDirection:'column',gap:9,...style}},
    e('div',{style:{display:'flex',alignItems:'center',gap:8}},
      e('span',{style:{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--accent)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}},anchor),
      e('span',{style:{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)'}},'selection attached'),
      onCancel?e('button',{onClick:onCancel,'aria-label':'Discard feedback',style:{marginLeft:'auto',border:'none',background:'transparent',color:'var(--text-3)',cursor:'pointer',fontSize:14,lineHeight:1,padding:2}},'×'):null),
    code?e('div',{style:{fontFamily:'var(--font-mono)',fontSize:11,lineHeight:1.6,background:'var(--gutter)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-sm)',padding:'7px 10px',color:'var(--text-2)',whiteSpace:'pre',overflow:'auto'}},code):null,
    e('textarea',{value,onChange:onChange?ev=>onChange(ev.target.value):undefined,placeholder,rows:3,
      style:{resize:'vertical',minHeight:56,border:'1px solid var(--line-soft)',borderRadius:'var(--radius-sm)',background:'var(--fill-1)',color:'var(--text)',fontFamily:'var(--font-sans)',fontSize:12.5,lineHeight:1.5,padding:'8px 10px',outline:'none'}}),
    e('div',{style:{display:'flex',alignItems:'center',gap:8}},
      e('span',{style:{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)'}},'⌘↩ to send'),
      e('span',{style:{marginLeft:'auto',display:'flex',gap:8}},
        onCancel?e('button',{onClick:onCancel,style:{height:'var(--control-h)',padding:'0 12px',fontSize:12.5,fontWeight:600,fontFamily:'var(--font-sans)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius)',background:'transparent',color:'var(--text-2)',cursor:'pointer'}},'Cancel'):null,
        e('button',{onClick:onSend,style:{height:'var(--control-h)',padding:'0 14px',fontSize:12.5,fontWeight:600,fontFamily:'var(--font-sans)',border:'none',borderRadius:'var(--radius)',background:'var(--accent)',color:'var(--on-accent)',cursor:'pointer'}},ctaLabel))));
}
