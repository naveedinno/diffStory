window.DSKit.ChangeScope = function ChangeScope({go,NS}){
  const {Button,IconButton,Input,StatChip,FileRow,Kicker}=NS; const {TopBar,Icon,paths}=window.DSKit;
  const [mode,setMode]=React.useState(1);
  const files=[{p:'src/api.ts',a:8,r:0},{p:'src/limits.ts',a:11,r:0},{p:'src/orders.ts',a:7,r:1},{p:'test/limits.test.ts',a:7,r:0}];
  const stages=['Scope','Read','Resolve','Decide'];
  const modes=[{t:'Uncommitted',d:'Working tree vs HEAD'},{t:'Single commit',d:'Parent → selected commit'},{t:'Compare any refs',d:'Branches with optional commit pins'}];
  return <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
    <TopBar crumbs={['diffstory-demo','Scope']} right={<>
      <window.DSKit.SettingsButton NS={NS}/>
      <Button variant="secondary" size="sm"><Icon d={paths.reload} size={13}/> Reload</Button>
      <Button variant="secondary" size="sm" onClick={()=>go('history')}>History</Button></>}/>
    <div style={{flex:1,overflow:'auto'}}><div style={{maxWidth:960,margin:'0 auto',padding:'30px 24px 40px'}}>
      <div style={{display:'flex',alignItems:'center',gap:0,marginBottom:26}}>
        {stages.map((s,i)=><React.Fragment key={s}>
          <span style={{display:'flex',alignItems:'center',gap:9}}>
            <span style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:700,letterSpacing:'var(--tracking-numeral)',lineHeight:1,color:i===0?'var(--accent)':'var(--numeral-dim)'}}>{'0'+(i+1)}</span>
            <Kicker tone={i===0?'accent':'faint'}>{s}</Kicker>
          </span>
          {i<3?<span style={{flex:1,height:2,margin:'0 16px',background:i===0?'linear-gradient(90deg,var(--thread),var(--thread-dim))':'var(--thread-dim)',opacity:i===0?1:.5,maxWidth:90}}/>:null}
        </React.Fragment>)}
      </div>
      <div style={{marginBottom:22}}>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,letterSpacing:'var(--tracking-tight)'}}>Choose what to review</div>
        </div>
      </div>
      <div style={{background:'var(--surface-2)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-island)',padding:'16px 18px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:12}}>
          <Kicker>Reviewing</Kicker>
          <span style={{fontSize:15,fontWeight:600}}>{modes[mode].t}</span>
          <span style={{marginLeft:'auto',fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-3)',background:'var(--fill-1)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-sm)',padding:'3px 8px'}}>{['git status --porcelain · git diff HEAD','git diff HEAD^ HEAD','git diff main...feat/spending-limit'][mode]}</span>
        </div>
        <div style={{display:'flex',gap:10,marginBottom:12}}>
          {modes.map((m,i)=><button key={i} onClick={()=>setMode(i)} style={{flex:1,textAlign:'left',padding:'11px 13px',cursor:'pointer',borderRadius:'var(--radius)',
            border:'1px solid '+(mode===i?'var(--accent-line)':'var(--line-soft)'),background:mode===i?'var(--accent-soft)':'var(--fill-1)',
            transition:'border-color var(--motion-duration-fast) ease,background-color var(--motion-duration-fast) ease',color:'var(--text)'}}>
            <div style={{fontSize:12.5,fontWeight:600,color:mode===i?'var(--accent)':'var(--text)'}}>{m.t}</div>
            <div style={{fontSize:11.5,color:'var(--text-2)',marginTop:2}}>{m.d}</div>
          </button>)}
        </div>
        {mode===0?<div style={{display:'flex',alignItems:'center',gap:10,fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)'}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:'var(--add)'}}/>tracking the working tree · 4 modified · 0 untracked · refreshes on save
        </div>:null}
        {mode===1?<Input label="Commit" mono value="HEAD" hint="Shows that commit against its first parent; root commits are shown against the empty tree."/>:null}
        {mode===2?<div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
          <div style={{flex:1,minWidth:0}}><Input label="Base" mono value="main" hint="Branch, tag, or commit"/></div>
          <button aria-label="Swap refs" style={{flex:'none',width:32,height:32,marginBottom:22,display:'grid',placeItems:'center',border:'1px solid var(--line-soft)',borderRadius:'var(--radius)',background:'var(--fill-1)',color:'var(--text-2)',cursor:'pointer'}}><Icon d={paths.reload} size={14}/></button>
          <div style={{flex:1,minWidth:0}}><Input label="Compare" mono value="feat/spending-limit" hint="Three-dot diff: changes since the common ancestor"/></div>
        </div>:null}
      </div>
      <div style={{background:'var(--surface-2)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-island)',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:'1px solid var(--line-soft)'}}>
          <span style={{fontSize:13}}><span style={{fontFamily:'var(--font-display)',fontWeight:700}}>4</span> <span style={{color:'var(--text-2)'}}>review files</span></span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:11.5}}><span style={{color:'var(--add)'}}>+33</span> <span style={{color:'var(--del)'}}>−1</span></span>
          <span style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}><Button variant="secondary" size="sm" onClick={()=>go('walkthrough')}>Generate a story</Button><Button size="sm" onClick={()=>go('allfiles')}>Review 4 files →</Button></span>
        </div>
        <div style={{padding:'6px 8px 10px'}}>
          {[['src',[{p:'src/api.ts',a:8,r:0,n:214},{p:'src/limits.ts',a:11,r:0,n:96},{p:'src/orders.ts',a:7,r:1,n:310}]],['test',[{p:'test/limits.test.ts',a:7,r:0,n:152}]]].map(([dir,fs])=><div key={dir}>
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 8px 4px',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)'}}>
              <Icon d={paths.folder} size={13}/> {dir}
              <span style={{marginLeft:'auto',fontSize:10.5,color:'var(--text-3)'}}>{fs.reduce((s,f)=>s+f.n,0)} loc</span>
            </div>
            {fs.map(f=><div key={f.p} style={{display:'flex',alignItems:'center',gap:10,paddingLeft:10}}>
              <div style={{flex:1,minWidth:0}}><FileRow path={f.p} added={f.a} removed={f.r}/></div>
              <span style={{flex:'none',width:64,textAlign:'right',fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-3)',paddingRight:10}}>{f.n} loc</span>
            </div>)}
          </div>)}
        </div>
      </div>
    </div></div>
  </div>;
};
