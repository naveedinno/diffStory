import React from 'react';
export function ReviewCard({title, badge, badgeTone='accent', description, facts=[], footer, action, onAction, style}) {
  const [hover,setHover]=React.useState(false);
  return React.createElement('div',{onMouseEnter:()=>setHover(true),onMouseLeave:()=>setHover(false),
    style:{background:'var(--surface-2)',border:'1px solid '+(hover?'var(--line)':'var(--line-soft)'),
      borderLeft:'2px solid var(--accent)',borderRadius:'var(--radius-island)',padding:'16px 18px',
      display:'flex',flexDirection:'column',gap:10,transition:'border-color var(--motion-duration-fast) ease',...style}},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:10,minWidth:0}},
      React.createElement('span',{style:{fontFamily:'var(--font-sans)',fontSize:15,fontWeight:600,color:'var(--text)',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},title),
      badge?React.createElement('span',{style:{display:'inline-flex',padding:'2px 7px',borderRadius:'var(--radius-sm)',
        background:badgeTone==='amber'?'var(--amber-soft)':badgeTone==='add'?'var(--add-soft)':'var(--accent-soft)',
        color:badgeTone==='amber'?'var(--amber)':badgeTone==='add'?'var(--add)':'var(--accent)',
        fontFamily:'var(--font-mono)',fontSize:9.5,fontWeight:600,letterSpacing:'var(--tracking-kicker)',textTransform:'uppercase',whiteSpace:'nowrap'}},badge):null,
      action?React.createElement('button',{onClick:onAction,style:{marginLeft:'auto',border:'none',background:'transparent',
        color:'var(--accent)',fontFamily:'var(--font-sans)',fontSize:12.5,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',flex:'none'}},action+' →'):null),
    description?React.createElement('div',{style:{fontFamily:'var(--font-sans)',fontSize:12.5,lineHeight:1.55,color:'var(--text-2)'}},description):null,
    facts.length?React.createElement('div',{style:{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)'}},
      facts.map((f,i)=>React.createElement('span',{key:i,style:{whiteSpace:'nowrap'}},f))):null,
    footer?React.createElement('div',{style:{fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-3)'}},footer):null);
}
