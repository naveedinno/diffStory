// Shared read-view chrome: ReadTopBar + step data. (The Atlas map screen was cut — the walkthrough is the story overview.)
window.DSKit.ReadTopBar = function ReadTopBar({go,NS,withPlay,onFeedback,feedbackCount=1}){
  const {Button,IconButton}=NS; const {Icon,paths}=window.DSKit;
  return <div style={{height:50,flex:'none',display:'flex',alignItems:'center',gap:10,padding:'0 14px',margin:'10px 12px 0',...window.DSKit.ISLAND}}>
    <Button variant="ghost" size="sm" onClick={()=>go('scope')}><Icon d={paths.back} size={13}/> Change</Button>
    <span style={{width:1,height:20,background:'var(--line)'}}/>
    <div style={{minWidth:0}}>
      <div style={{fontSize:13.5,fontWeight:600,lineHeight:1.2}}>Diff review</div>
      <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)'}}>Working tree vs main (da4f486)</div>
    </div>
    <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
      {withPlay?<Button variant="secondary" size="sm"><Icon d={paths.play} size={13}/> Play</Button>:null}
      <window.DSKit.SettingsButton NS={NS}/>
      <Button variant="secondary" size="sm"><Icon d={paths.reload} size={13}/> Reload</Button>
      <Button variant="secondary" size="sm" onClick={onFeedback||(()=>go('feedback'))}>Notes · {feedbackCount}</Button>
    </div>
  </div>;
};
// Shared step data for the read views
window.DSKit.STEPS=[
  {n:'01',title:'POST /orders keeps ownership and gains one pre-placement decision',meta:'api.ts',kind:'changed',stat:'+6',q:'Can an over-cap order reach placeOrder(), or does the handler stop it first?'},
  {n:'02',title:'The limit is a decision over derived budget, not a stored flag',meta:'concept primer',kind:'primer',stat:'no file',q:'What frees budget when an order is cancelled?'},
  {n:'03',title:'checkSpendingLimit() turns stored spend into the gate result',meta:'limits.ts · new file',kind:'changed',stat:'+19 −1',q:'Is the boundary check ≥ or > at exactly the cap?'},
  {n:'04',title:'Existing customer storage supplies monthlySpend',meta:'db.ts · context',kind:'context',stat:'read only',q:'Does anything else write monthlySpend?'},
  {n:'05',title:'Accepted orders feed spend back into the placement path',meta:'orders.ts',kind:'changed',stat:'+5',q:'Is spend recorded only after placement succeeds?'},
  {n:'06',title:'Rejection proof leaves the exact boundary exposed',meta:'limits.test.ts · new file',kind:'proof',stat:'+3',q:'Is the exact-cap case asserted, not just over-cap?'}];
