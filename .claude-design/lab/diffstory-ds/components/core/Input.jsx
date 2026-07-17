import React from 'react';
export function Input({value, onChange, placeholder, mono=false, label, hint, style}) {
  const [focus,setFocus]=React.useState(false);
  return React.createElement('label',{style:{display:'flex',flexDirection:'column',gap:6,minWidth:0,...style}},
    label?React.createElement('span',{style:{fontSize:12,fontWeight:600,color:'var(--text)',fontFamily:'var(--font-sans)'}},label):null,
    React.createElement('input',{value,placeholder,onChange:e=>onChange&&onChange(e.target.value),
      onFocus:()=>setFocus(true),onBlur:()=>setFocus(false),spellCheck:false,
      style:{height:'var(--control-h-lg)',padding:'0 12px',borderRadius:'var(--radius)',
        border:'1px solid '+(focus?'var(--accent-line)':'var(--line)'),outline:'none',
        boxShadow:focus?'0 0 0 3px var(--accent-soft)':'none',background:'var(--fill-1)',color:'var(--text)',
        fontFamily:mono?'var(--font-mono)':'var(--font-sans)',fontSize:13,
        transition:'box-shadow var(--motion-duration-fast) ease,border-color var(--motion-duration-fast) ease'}}),
    hint?React.createElement('span',{style:{fontSize:11.5,color:'var(--text-3)',fontFamily:'var(--font-sans)',lineHeight:1.5}},hint):null);
}
