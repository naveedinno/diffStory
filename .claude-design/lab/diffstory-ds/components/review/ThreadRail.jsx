import React from 'react';
/* Reading-order rail (direction 3b): oversized numerals ARE the thread nodes.
   A 2px line runs behind them — solid accent to the active step, dim beyond. */
export function ThreadRail({steps=[], activeIndex=0, onSelect, style}) {
  const pct=steps.length>1?((activeIndex+0.5)/steps.length)*100:100;
  return React.createElement('div',{style:{position:'relative',display:'flex',flexDirection:'column',gap:22,...style}},
    React.createElement('div',{'aria-hidden':true,style:{position:'absolute',left:17,top:10,bottom:10,width:2,
      background:'linear-gradient(var(--thread) 0 '+pct+'%,var(--thread-dim) '+pct+'% 100%)'}}),
    steps.map((s,i)=>{const active=i===activeIndex;
      return React.createElement('button',{key:i,onClick:()=>onSelect&&onSelect(i),
        style:{display:'flex',gap:12,alignItems:'flex-start',textAlign:'left',border:'none',background:'transparent',padding:0,cursor:'pointer',minWidth:0},
        onMouseEnter:e=>{if(!active)e.currentTarget.firstChild.style.color='var(--text-2)'},
        onMouseLeave:e=>{if(!active)e.currentTarget.firstChild.style.color='var(--numeral-dim)'}},
        React.createElement('span',{style:{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,lineHeight:1,
          letterSpacing:'var(--tracking-numeral)',color:active?'var(--accent)':'var(--numeral-dim)',
          width:36,flex:'none',position:'relative',zIndex:1,background:'var(--bg)',paddingBottom:2,
          transition:'color var(--motion-duration-fast) ease'}},String(i+1).padStart(2,'0')),
        React.createElement('span',{style:{minWidth:0,display:'flex',flexDirection:'column',gap:3,paddingTop:2}},
          React.createElement('span',{style:{fontFamily:'var(--font-sans)',fontSize:12,fontWeight:active?600:400,
            lineHeight:1.3,color:active?'var(--text)':'var(--text-2)'}},s.title),
          s.meta?React.createElement('span',{style:{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)'}},s.meta):null))}));
}
