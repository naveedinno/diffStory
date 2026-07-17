window.DSKit.boot = function(NS){
  function App(){
    const [screen,setScreen]=React.useState('picker');
    const [theme,setTheme]=React.useState('dark');
    React.useEffect(()=>{document.documentElement.setAttribute('data-theme',theme)},[theme]);
    const K=window.DSKit;
    const screens={picker:K.WorkspacePicker,scope:K.ChangeScope,history:K.ReviewHistory,allfiles:K.AllFilesDiff,walkthrough:K.CodeWalkthrough,feedback:K.FeedbackPanel,states:K.SystemStates};
    const S=screens[screen];
    return <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
      <div style={{flex:'none',display:'flex',gap:2,padding:'6px 10px',borderBottom:'1px solid var(--line-soft)',background:'var(--surface)',alignItems:'center'}}>
        {[['scope→',['picker','scope']],['read→',['walkthrough','allfiles']],['resolve→',['feedback']],['decide',['history']],['·',['states']]].map(([stage,keys])=>
          <React.Fragment key={stage}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text-3)',padding:'0 4px 0 8px',pointerEvents:'none'}}>{stage}</span>
            {keys.map(k=><button key={k} onClick={()=>setScreen(k)} style={{border:'none',borderRadius:4,padding:'4px 9px',cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'.08em',textTransform:'uppercase',background:screen===k?'var(--accent-soft)':'transparent',color:screen===k?'var(--accent)':'var(--text-2)'}}>{k}</button>)}
          </React.Fragment>)}
        <button onClick={()=>setTheme(theme==='dark'?'light':'dark')} style={{marginLeft:'auto',border:'1px solid var(--line-soft)',borderRadius:4,padding:'4px 9px',cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:10,background:'var(--fill-1)',color:'var(--text-2)'}}>{theme==='dark'?'light':'dark'} mode</button>
      </div>
      <div style={{flex:1,minHeight:0}}><S go={setScreen} NS={NS}/></div>
    </div>;
  }
  ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
};
