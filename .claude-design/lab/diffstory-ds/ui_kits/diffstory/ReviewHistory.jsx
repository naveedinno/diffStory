window.DSKit.ReviewHistory = function ReviewHistory({go,NS}){
  const {Button,IconButton,ReviewCard,Kicker}=NS; const {TopBar,Icon,paths}=window.DSKit;
  return <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
    <TopBar crumbs={['diffstory-demo','Review history']} right={<>
      <window.DSKit.SettingsButton NS={NS}/>
      <Button variant="secondary" size="sm">Refresh</Button></>}/>
    <div style={{flex:1,overflow:'auto'}}><div style={{maxWidth:880,margin:'0 auto',padding:'34px 24px'}}>
      <Kicker style={{marginBottom:8}}>diffstory-demo</Kicker>
      <div style={{display:'flex',alignItems:'flex-end',gap:16,flexWrap:'wrap'}}>
        <div style={{minWidth:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:700,letterSpacing:'var(--tracking-tight)'}}>Review history</div>
        </div>
        <div style={{marginLeft:'auto'}}>
          <Button size="sm" onClick={()=>go('scope')}>Start review</Button>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'baseline',gap:10,margin:'28px 0 12px'}}>
        <span style={{fontFamily:'var(--font-display)',fontSize:15,fontWeight:600}}>1 saved review</span>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'stretch'}}>
        <div style={{flex:1,minWidth:0}}>
          <ReviewCard title="Add per-customer monthly spending limit" badge="In review" badgeTone="accent"
            facts={['4 files','+33 −1']}
            footer="Working tree vs main · 1 hr ago"
            action="Resume review" onAction={()=>go('walkthrough')}/>
        </div>
        <IconButton label="Delete review" size={44} style={{alignSelf:'stretch',height:'auto',minHeight:44}}><Icon d={paths.trash} size={16}/></IconButton>
      </div>
    </div></div>
  </div>;
};
