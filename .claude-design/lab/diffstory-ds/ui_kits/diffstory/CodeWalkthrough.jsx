// Code walkthrough — "Filmstrip": one step at a time on a stage, full focus;
// a horizontal thread of numerals along the bottom is the whole navigation.
// The diff viewer inside the stage is the standard DiffLine viewer, unchanged.
window.DSKit.CodeWalkthrough = function CodeWalkthrough({go,NS}){
  const {Button,DiffLine,FeedbackComposer,ContextMenu}=NS;
  const {ReadTopBar,Icon,paths,LINES,CodeLine,STEPS}=window.DSKit;
  const [step,setStep]=React.useState(0);
  const [beat,setBeat]=React.useState(0);
  const [menu,setMenu]=React.useState(null);
  const [composing,setComposing]=React.useState(false);
  const [sentInline,setSentInline]=React.useState(false);
  const [draft,setDraft]=React.useState('Return a stable error code instead of prose; the storefront needs to branch on it.');
  const selLines=[9,10,11];
  const line11="+ return { status: 402, error: 'over the limit, …' };";
  const beats=[
    {t:'Start here: this existing handler is where a customer order enters the app.',focus:[5,6]},
    {t:'The new decision reads the limit and rejects before any placement side effects.',focus:[9,10,11]},
    {t:'The accepted path still reaches the original placement behavior.',focus:[14,15]}];
  const s=STEPS[step]; const focus=step===0?beats[beat].focus:[];
  const short=['api.ts','concept','limits.ts','db.ts','orders.ts','tests'];
  const goStep=i=>{if(i>=0&&i<6){setStep(i);setBeat(0);}};
  const Ghost=({i,label})=><button onClick={()=>i==null?go('scope'):goStep(i)} style={{width:64,alignSelf:'stretch',flex:'none',cursor:'pointer',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-island)',background:'var(--surface)',opacity:.55,color:'var(--text-3)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,padding:'12px 6px'}}>
    {i==null?<window.DSKit.Mark size={16}/>:<span style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:700,letterSpacing:'var(--tracking-numeral)'}}>{STEPS[i].n}</span>}
    <span style={{fontFamily:'var(--font-mono)',fontSize:9,writingMode:'vertical-rl',letterSpacing:'.08em'}}>{label}</span>
  </button>;
  return <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
    <ReadTopBar go={go} NS={NS} withPlay feedbackCount={1+(sentInline?1:0)}/>
    <div style={{flex:1,minHeight:0,display:'flex',alignItems:'stretch',justifyContent:'center',gap:12,padding:'12px 12px 4px'}}>
      {step===0?<Ghost i={null} label="scope"/>:<Ghost i={step-1} label={short[step-1]}/>}
      <div style={{flex:1,maxWidth:880,minWidth:0,...window.DSKit.ISLAND,display:'flex',flexDirection:'column',minHeight:0,position:'relative'}}>
        <div style={{flex:'none',padding:'16px 22px 12px',borderBottom:'1px solid var(--line-soft)',display:'flex',alignItems:'flex-start',gap:16}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:52,fontWeight:700,lineHeight:.85,letterSpacing:'var(--tracking-numeral)',color:'var(--accent)',flex:'none',textShadow:'0 4px 30px var(--accent-glow)'}}>{s.n}</div>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:17,fontWeight:600,lineHeight:1.25}}>{s.title} <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:400,color:'var(--text-3)'}}>{s.meta}</span></div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,marginTop:8}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:9.5,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--accent)',flex:'none'}}>Check</span>
              <span style={{fontSize:12.5,color:'var(--text-2)'}}>{s.q}</span>
            </div>
          </div>
        </div>
        <div style={{flex:1,overflow:'auto',padding:'8px 22px 14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:14,justifyContent:'flex-end',padding:'2px 2px 7px',fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'.06em',color:'var(--text-3)'}}>
            {['Unified','Split','Full file'].map((m,i)=><button key={m} style={{background:'transparent',border:'none',padding:0,cursor:'pointer',font:'inherit',letterSpacing:'inherit',color:i===0?'var(--accent)':'var(--text-3)',fontWeight:i===0?600:400}}>{m}</button>)}
            <span style={{width:1,height:10,background:'var(--line-soft)'}}/>
            <button onClick={()=>go('allfiles')} style={{background:'transparent',border:'none',padding:0,cursor:'pointer',font:'inherit',letterSpacing:'inherit',color:'var(--text-3)'}}>All files →</button>
          </div>
          {step===0?<div onContextMenu={e=>{e.preventDefault();setMenu({x:e.clientX,y:e.clientY})}} style={{border:'1px solid var(--accent-line)',borderRadius:'var(--radius)',overflow:'hidden'}}>
            {LINES.map(l=><React.Fragment key={l.no}>
              <CodeLine l={l} focus={((!!menu||composing)&&selLines.includes(l.no))||focus.includes(l.no)} DiffLine={DiffLine}/>
              {l.no===11&&composing?<div style={{padding:'10px 12px',background:'var(--fill-1)'}}>
                <FeedbackComposer anchor="src/api.ts:11" code={line11} value={draft} onChange={setDraft}
                  onSend={()=>{setComposing(false);setSentInline(true)}} onCancel={()=>setComposing(false)}/>
              </div>:null}
              {l.no===11&&sentInline&&!composing?<button onClick={()=>go('feedback')} style={{display:'flex',alignItems:'center',gap:8,width:'100%',textAlign:'left',cursor:'pointer',padding:'7px 12px',border:'none',borderTop:'1px solid var(--line-soft)',borderBottom:'1px solid var(--line-soft)',background:'var(--fill-1)'}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:'var(--amber)',flex:'none'}}/>
                <span style={{fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-2)',whiteSpace:'nowrap'}}>src/api.ts:11 · open · just now</span>
                <span style={{fontSize:11.5,color:'var(--text-2)',minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{draft}</span>
                <span style={{marginLeft:'auto',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--accent)',whiteSpace:'nowrap'}}>view in notes →</span>
              </button>:null}
            </React.Fragment>)}
          </div>:<div style={{border:'1px dashed var(--line)',borderRadius:'var(--radius)',padding:'28px 24px',textAlign:'center',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-3)'}}>— diff data for this step is omitted in the kit —</div>}
          {step===0?<div style={{marginTop:8,fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)'}}>right-click lines to leave a note</div>:null}
        </div>
        {step===0?<div style={{flex:'none',display:'flex',alignItems:'center',gap:14,padding:'12px 22px',borderTop:'1px solid var(--line-soft)'}}>
          <span style={{display:'flex',alignItems:'center',gap:5,flex:'none'}} aria-label={'beat '+(beat+1)+' of 3'}>
            {beats.map((b,j)=><span key={j} style={{width:j===beat?18:7,height:7,borderRadius:4,background:j<=beat?'var(--accent)':'var(--fill-3)',transition:'width var(--motion-duration-fast) ease'}}/>)}
          </span>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:12.5,lineHeight:1.5}}>{beats[beat].t}</div>
          </div>
          <span style={{display:'flex',gap:6,flex:'none'}}>
            <Button variant="secondary" size="sm" disabled={beat===0} onClick={()=>setBeat(beat-1)}><Icon d={paths.arrowL} size={13}/></Button>
            <Button size="sm" onClick={()=>beat===2?goStep(1):setBeat(beat+1)}>{beat===2?'Next step':''}<Icon d={paths.arrowR} size={13}/></Button>
          </span>
        </div>:<div style={{flex:'none',display:'flex',alignItems:'center',gap:10,padding:'12px 22px',borderTop:'1px solid var(--line-soft)'}}>
          <span style={{fontSize:12.5,color:'var(--text-2)'}}>Mark this step read, then continue along the thread.</span>
          <span style={{marginLeft:'auto',display:'flex',gap:6}}>
            <Button variant="secondary" size="sm" onClick={()=>goStep(step-1)}><Icon d={paths.arrowL} size={13}/></Button>
            <Button size="sm" disabled={step===5} onClick={()=>goStep(step+1)}>Next step <Icon d={paths.arrowR} size={13}/></Button>
          </span>
        </div>}
      </div>
      {step<5?<Ghost i={step+1} label={short[step+1]}/>:<div style={{width:64,flex:'none'}}/>}
    </div>
    <div style={{flex:'none',position:'relative',padding:'16px 90px',margin:'8px 12px 12px',...window.DSKit.ISLAND}}>
      <div style={{position:'absolute',left:110,right:110,top:31,height:2,background:`linear-gradient(90deg, var(--thread) 0 ${step/5*100}%, var(--thread-dim) ${step/5*100}% 100%)`}} aria-hidden="true"/>
      <div style={{display:'flex',justifyContent:'space-between',position:'relative'}}>
        {STEPS.map((t,i)=><button key={t.n} onClick={()=>goStep(i)} style={{background:'transparent',border:'none',cursor:'pointer',textAlign:'center',padding:0,color:'inherit'}}>
          <span style={{display:'inline-block',fontFamily:'var(--font-display)',fontSize:i===step?22:15,fontWeight:700,letterSpacing:'var(--tracking-numeral)',lineHeight:1,color:i===step?'var(--accent)':(i<step?'var(--text-2)':'var(--numeral-dim)'),background:'var(--surface)',padding:'0 8px'}}>{t.n}</span>
          <span style={{display:'block',fontFamily:'var(--font-mono)',fontSize:9,color:i===step?'var(--text-2)':'var(--text-3)',marginTop:3}}>{short[i]}</span>
        </button>)}
      </div>
    </div>
    {menu?<ContextMenu x={menu.x} y={menu.y} onClose={()=>setMenu(null)} items={[
      {label:'Note these lines',hint:'F',primary:true,onSelect:()=>setComposing(true)},
      'divider',
      {label:'Copy selection',hint:'⌘C'},
      {label:'Copy ref',hint:'src/api.ts:9–11'},
      {label:'Open in all files',hint:'↵',onSelect:()=>go('allfiles')}]}/>:null}
  </div>;
};
