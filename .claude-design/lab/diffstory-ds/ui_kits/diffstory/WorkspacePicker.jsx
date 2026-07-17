window.DSKit.WorkspacePicker = function WorkspacePicker({go,NS}){
  const {Button,IconButton}=NS; const {Mark,Wordmark,Icon,paths}=window.DSKit;
  const [hover,setHover]=React.useState(false);
  return <div style={{maxWidth:820,margin:'0 auto',padding:'36px 24px'}}>
    <div style={{display:'flex',alignItems:'center',gap:14,paddingBottom:24,borderBottom:'1px solid var(--line-soft)'}}>
      <Mark size={34}/>
      <span style={{display:'flex',flexDirection:'column',gap:1}}>
        <span style={{fontFamily:'var(--font-display)',fontSize:24,letterSpacing:'-0.03em',lineHeight:1}}><span style={{color:'var(--text-2)',fontWeight:400}}>diff</span><span style={{fontWeight:700}}>Story</span></span>
        <span style={{fontFamily:'var(--font-mono)',fontSize:9.5,letterSpacing:'.22em',textTransform:'uppercase',color:'var(--accent)'}}>the story of this change</span>
      </span>
      <span style={{marginLeft:'auto'}}><window.DSKit.SettingsButton NS={NS}/></span>
    </div>
    <div style={{display:'flex',alignItems:'center',margin:'30px 0 18px'}}>
      <span style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,letterSpacing:'var(--tracking-tight)'}}>Repositories</span>
      <span style={{marginLeft:'auto'}}><Button size="sm"><Icon d={paths.plus} size={14}/> Add repository</Button></span>
    </div>
    <div style={{display:'flex',gap:8,alignItems:'stretch'}}>
      <button onClick={()=>go('scope')} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
        style={{flex:1,display:'flex',alignItems:'center',gap:14,padding:'14px 16px',textAlign:'left',cursor:'pointer',
        background:hover?'var(--fill-1)':'var(--surface-2)',border:'1px solid '+(hover?'var(--line)':'var(--line-soft)'),borderRadius:'var(--radius-island)',
        transition:'background-color var(--motion-duration-fast) ease,border-color var(--motion-duration-fast) ease',minWidth:0,color:'var(--text)'}}>
        <span style={{width:38,height:38,flex:'none',display:'grid',placeItems:'center',borderRadius:'var(--radius)',background:'var(--accent-soft)',color:'var(--accent)'}}><Icon d={paths.folder} size={19}/></span>
        <span style={{minWidth:0,display:'flex',flexDirection:'column',gap:3}}>
          <span style={{fontSize:14,fontWeight:600}}>diffstory-demo</span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>/var/folders/43/…5qt80000gn/T/diffstory-demo</span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)',display:'flex',gap:8,alignItems:'center'}}>4 changed files<span style={{color:'var(--text-3)'}}>·</span><span style={{color:'var(--text-3)'}}>1 hr ago</span></span>
        </span>
        <span style={{marginLeft:'auto',color:hover?'var(--text-2)':'var(--text-3)'}}><Icon d={paths.chevR} size={15}/></span>
      </button>
      <IconButton label="Remove from list" size={40} style={{alignSelf:'stretch',height:'auto',minHeight:44}}><Icon d={paths.trash} size={16}/></IconButton>
    </div>
  </div>;
};
