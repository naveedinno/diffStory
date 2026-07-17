import React from 'react';
const STATUS={
  open:{label:'to send',color:'var(--amber)'},
  sent:{label:'sent',color:'var(--accent)'},
  addressed:{label:'fixed · verify',color:'var(--accent-hi)'},
  resolved:{label:'done',color:'var(--add)'}};
export function FeedbackThread({status='open', anchor, code, body, time, round, replies=[], onResolve, onReopen, onCopy, onOpenCode, style}) {
  const e=React.createElement, st=STATUS[status]||STATUS.open;
  const link={border:'none',background:'transparent',padding:0,cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'.04em',color:'var(--text-3)'};
  const copy=()=>{const txt=(anchor?anchor+'\n':'')+(code?code+'\n':'')+body;try{navigator.clipboard.writeText(txt)}catch(_){}onCopy&&onCopy(txt)};
  return e('div',{style:{background:'var(--surface-2)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-lg)',padding:'11px 13px',display:'flex',flexDirection:'column',gap:7,...style}},
    e('div',{style:{display:'flex',alignItems:'center',gap:8,minWidth:0}},
      e('span',{style:{width:7,height:7,borderRadius:'50%',background:st.color,flex:'none'}}),
      anchor?e('button',{onClick:onOpenCode,style:{border:'none',padding:0,background:'transparent',cursor:onOpenCode?'pointer':'default',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--accent)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}},anchor):null,
      e('span',{style:{marginLeft:'auto',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)',whiteSpace:'nowrap',flex:'none'}},status==='open'?time:st.label)),
    code?e('div',{style:{fontFamily:'var(--font-mono)',fontSize:11,lineHeight:1.6,background:'var(--gutter)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-sm)',padding:'6px 9px',color:'var(--text-2)',whiteSpace:'pre',overflow:'hidden',textOverflow:'ellipsis'}},code):null,
    e('div',{style:{fontSize:12.5,lineHeight:1.55,color:'var(--text)'}},body),
    replies.map((r,i)=>e('div',{key:i,style:{borderLeft:'2px solid var(--line)',paddingLeft:11,display:'flex',flexDirection:'column',gap:3}},
      e('span',{style:{fontSize:12,lineHeight:1.55,color:'var(--text-2)'}},r.text),
      r.anchor?e('span',{style:{fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--accent)'}},r.anchor):null)),
    e('div',{style:{display:'flex',gap:14,marginTop:1}},
      e('button',{onClick:copy,style:link},'copy'),
      onResolve?e('button',{onClick:onResolve,style:{...link,color:'var(--text-2)'}},'mark done'):null,
      onReopen?e('button',{onClick:onReopen,style:link},'re-note'):null));
}
