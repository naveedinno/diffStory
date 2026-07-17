// Raw diff — the ground truth. Feedback is created inline (right-click a
// selection → composer under the lines) and batches into the Round drawer.
window.DSKit.AllFilesDiff = function AllFilesDiff({go,NS,drawerOpen}){
  const {Button,Input,FileRow,DiffLine,Kicker,FeedbackThread,FeedbackComposer,ContextMenu}=NS;
  const {ReadTopBar,Icon,paths,LINES,CodeLine}=window.DSKit;
  const [sel,setSel]=React.useState('src/api.ts');
  const [mode,setMode]=React.useState('Unified');
  const [reviewed,setReviewed]=React.useState({});
  const [menu,setMenu]=React.useState(null);
  const [composing,setComposing]=React.useState(false);
  const [sentInline,setSentInline]=React.useState(false);
  const [drawer,setDrawer]=React.useState(!!drawerOpen);
  const [draft,setDraft]=React.useState('Return a stable error code instead of prose; the storefront needs to branch on it.');
  const files=[{p:'src/api.ts',a:8,r:0},{p:'src/limits.ts',a:11,r:0},{p:'src/orders.ts',a:7,r:1},{p:'test/limits.test.ts',a:7,r:0}];
  const done=Object.values(reviewed).filter(Boolean).length;
  const groups={src:files.filter(f=>f.p.startsWith('src/')),test:files.filter(f=>f.p.startsWith('test/'))};
  const openCount=1+(sentInline?1:0);
  const selLines=[9,10,11];
  const line11="+ return { status: 402, error: 'over the limit, …' };";
  return <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
    <ReadTopBar go={go} NS={NS} feedbackCount={openCount} onFeedback={()=>setDrawer(!drawer)}/>
    <div style={{flex:1,minHeight:0,display:'flex',gap:12,padding:12}}>
      <div style={{width:'var(--rail-width)',flex:'none',...window.DSKit.ISLAND,display:'flex',flexDirection:'column',minHeight:0}}>
        <div style={{padding:'12px 14px 0',display:'flex',alignItems:'baseline'}}>
          <Kicker>Files</Kicker>
          <span style={{marginLeft:'auto',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)'}}>{done} of 4 reviewed</span>
        </div>
        <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:8}}>
          <Input mono placeholder="Search files or changed code"/>
          <button style={{display:'flex',alignItems:'center',gap:8,height:32,padding:'0 11px',border:'1px solid var(--line-soft)',borderRadius:'var(--radius)',background:'var(--fill-1)',color:'var(--text-2)',fontSize:12,cursor:'pointer'}}>
            Next unreviewed <span style={{marginLeft:'auto'}}><Icon d={paths.arrowR} size={13}/></span></button>
        </div>
        <div style={{flex:1,overflow:'auto',padding:'2px 8px 16px'}}>
          {Object.entries(groups).map(([dir,fs])=><div key={dir}>
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 6px 4px',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)'}}>
              <Icon d={paths.folder} size={13}/> {dir}
              <span style={{marginLeft:'auto',fontSize:10.5,color:'var(--text-3)'}}>+{fs.reduce((s,f)=>s+f.a,0)}{fs.some(f=>f.r)?' −'+fs.reduce((s,f)=>s+f.r,0):''}</span>
            </div>
            {fs.map(f=><FileRow key={f.p} path={f.p} added={f.a} removed={f.r} selected={sel===f.p} reviewed={!!reviewed[f.p]} onClick={()=>setSel(f.p)}/>)}
          </div>)}
        </div>
      </div>
      <div style={{flex:1,minWidth:0,...window.DSKit.ISLAND,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0}}>
        <div style={{flex:'none',display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderBottom:'1px solid var(--line-soft)'}}>
          <span style={{fontFamily:'var(--font-mono)',fontSize:12.5,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            <span style={{color:'var(--text-2)'}}>{sel.slice(0,sel.lastIndexOf('/')+1)}</span><span style={{fontWeight:600}}>{sel.slice(sel.lastIndexOf('/')+1)}</span></span>
          <span style={{display:'flex',alignItems:'center',gap:6,fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)',flex:'none',whiteSpace:'nowrap'}}>
            <Icon d={paths.arrowL} size={13}/> 1 / 8 <Icon d={paths.arrowR} size={13}/></span>
          <span style={{marginLeft:'auto',display:'flex',gap:14,alignItems:'center',fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'.06em',color:'var(--text-3)',flex:'none',whiteSpace:'nowrap'}}>
            <button onClick={()=>setReviewed({...reviewed,[sel]:!reviewed[sel]})} style={{background:'transparent',border:'none',padding:0,cursor:'pointer',font:'inherit',letterSpacing:'inherit',color:reviewed[sel]?'var(--add)':'var(--text-3)',fontWeight:600}}>{reviewed[sel]?'✓ reviewed':'mark reviewed'}</button>
            <span style={{width:1,height:10,background:'var(--line-soft)'}}/>
            {['Unified','Split','Full file'].map(m=><button key={m} onClick={()=>setMode(m)} style={{background:'transparent',border:'none',padding:0,cursor:'pointer',font:'inherit',letterSpacing:'inherit',color:mode===m?'var(--accent)':'var(--text-3)',fontWeight:mode===m?600:400}}>{m}</button>)}
          </span>
        </div>
        <div style={{flex:1,overflow:'auto',padding:'14px 16px'}} onContextMenu={e=>{e.preventDefault();setMenu({x:e.clientX,y:e.clientY})}}>
          <div style={{border:'1px solid var(--line-soft)',borderRadius:'var(--radius)',overflow:'hidden'}}>
            {LINES.map(l=><React.Fragment key={l.no}>
              <CodeLine l={l} focus={(!!menu||composing)&&selLines.includes(l.no)} DiffLine={DiffLine}/>
              {l.no===11&&composing?<div style={{padding:'10px 12px',background:'var(--fill-1)'}}>
                <FeedbackComposer anchor="src/api.ts:11" code={line11} value={draft} onChange={setDraft}
                  onSend={()=>{setComposing(false);setSentInline(true);setDrawer(true)}} onCancel={()=>setComposing(false)}/>
              </div>:null}
              {l.no===11&&sentInline&&!composing?<button onClick={()=>setDrawer(true)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left',cursor:'pointer',padding:'7px 12px',border:'none',borderTop:'1px solid var(--line-soft)',borderBottom:'1px solid var(--line-soft)',background:'var(--fill-1)'}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:'var(--amber)',flex:'none'}}/>
                <span style={{fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-2)',whiteSpace:'nowrap'}}>src/api.ts:11 · open · just now</span>
                <span style={{fontSize:11.5,color:'var(--text-2)',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{draft}</span>
                <span style={{marginLeft:'auto',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--accent)',whiteSpace:'nowrap'}}>view in notes →</span>
              </button>:null}
            </React.Fragment>)}
          </div>
          <div style={{marginTop:8,fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)'}}>right-click lines to leave a note</div>
        </div>
      </div>
      {drawer?<div style={{width:308,flex:'none',...window.DSKit.ISLAND,display:'flex',flexDirection:'column',minHeight:0}}>
        <div style={{flex:'none',display:'flex',alignItems:'baseline',gap:8,padding:'14px 16px 10px',borderBottom:'1px solid var(--line-soft)'}}>
          <Kicker tone="accent">Notes</Kicker>
          <span style={{fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-2)',whiteSpace:'nowrap'}}>{openCount} to send</span>
          <button onClick={()=>{try{navigator.clipboard.writeText('src/limits.ts:12 — Use ≥ so an order landing exactly on the cap is rejected.'+(sentInline?'\nsrc/api.ts:11 — '+draft:''))}catch(_){}}} style={{marginLeft:'auto',border:'none',background:'transparent',cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'.04em',color:'var(--text-3)',padding:0}}>copy all</button>
          <button onClick={()=>setDrawer(false)} aria-label="Close round drawer" style={{border:'none',background:'transparent',color:'var(--text-3)',cursor:'pointer',fontSize:14,lineHeight:1,padding:2}}>×</button>
        </div>
        <div style={{flex:1,overflow:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
          <FeedbackThread status="open" anchor="src/limits.ts:12" time="20 min ago"
            body="Use ≥ so an order landing exactly on the cap is rejected — the brief says the cap is a hard limit."
            onResolve={()=>{}} onOpenCode={()=>setSel('src/limits.ts')}/>
          {sentInline?<FeedbackThread status="open" anchor="src/api.ts:11" time="just now"
            body={draft} onResolve={()=>{}} onOpenCode={()=>setSel('src/api.ts')}/>:null}
        </div>
        <div style={{flex:'none',padding:'12px 14px 14px',borderTop:'1px solid var(--line-soft)'}}>
          <Button style={{width:'100%'}} onClick={()=>{}}>Send {openCount} note{openCount>1?'s':''} to the agent →</Button>
        </div>
      </div>:null}
    </div>
    {menu?<ContextMenu x={menu.x} y={menu.y} onClose={()=>setMenu(null)} items={[
      {label:'Note these lines',hint:'F',primary:true,onSelect:()=>setComposing(true)},
      'divider',
      {label:'Copy selection',hint:'⌘C'},
      {label:'Copy ref',hint:'src/api.ts:9–11'},
      {label:'Open full file',hint:'↵'},
      'divider',
      {label:reviewed[sel]?'Unmark file reviewed':'Mark file reviewed',hint:'R',onSelect:()=>setReviewed({...reviewed,[sel]:!reviewed[sel]})}]}/>:null}
  </div>;
};
