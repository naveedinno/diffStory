// Shared chrome: brand lockup, top bars, icons.
window.DSKit.ISLAND={background:'var(--surface)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-island)'};
window.DSKit.Mark = function Mark({size=20}){
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M6.6 5.4h8.7c2 0 3.6 1.6 3.6 3.6s-1.6 3.6-3.6 3.6H8.8c-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8h8.6" fill="none" stroke="var(--accent)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="6.6" cy="5.4" r="2.35" fill="var(--text)"/><circle cx="15.3" cy="12.6" r="2.35" fill="var(--accent-hi)"/><circle cx="17.4" cy="20.2" r="2.35" fill="var(--text)"/></svg>;
};
window.DSKit.Wordmark = function Wordmark(){
  return <span style={{fontSize:15,whiteSpace:'nowrap'}}><span style={{color:'var(--text-2)',fontWeight:400}}>diff</span><span style={{fontWeight:600}}>Story</span></span>;
};
window.DSKit.Icon = function Icon({d,size=16,sw=1.6}){
  return <svg viewBox="0 0 20 20" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg>;
};
window.DSKit.paths = {
  moon:'M15.9 12.4A6.7 6.7 0 0 1 7.6 4.1 6.7 6.7 0 1 0 15.9 12.4z',
  search:'M12.9 12.9 17 17M14.5 8.75a5.75 5.75 0 1 1-11.5 0 5.75 5.75 0 0 1 11.5 0z',
  folder:'M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h3.6l1.8 2h6.6a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z',
  trash:'M4 5.5h12M8 5.5V4h4v1.5M6 5.5l.7 10a1.5 1.5 0 0 0 1.5 1.4h3.6a1.5 1.5 0 0 0 1.5-1.4l.7-10M8.5 9v5M11.5 9v5',
  chevR:'M7.5 4.5 13 10l-5.5 5.5', arrowR:'M4 10h12M11 5l5 5-5 5', arrowL:'M16 10H4M9 5l-5 5 5 5',
  plus:'M10 4v12M4 10h12', reload:'M16 8A6.3 6.3 0 0 0 4.5 6.2M4 4v3h3M4 12a6.3 6.3 0 0 0 11.5 1.8M16 16v-3h-3',
  play:'M7 5.2v9.6l8-4.8z', gear:'M10 12.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5zM10 2.8l.5 1.9a5.4 5.4 0 0 1 1.9.8l1.85-.65 1.4 2.4-1.4 1.35a5.5 5.5 0 0 1 0 2l1.4 1.35-1.4 2.4-1.85-.65a5.4 5.4 0 0 1-1.9.8l-.5 1.9h-2.8l-.5-1.9a5.4 5.4 0 0 1-1.9-.8l-1.85.65-1.4-2.4 1.4-1.35a5.5 5.5 0 0 1 0-2L2.05 7.25l1.4-2.4 1.85.65a5.4 5.4 0 0 1 1.9-.8l.5-1.9z', doc:'M6 3h5.5L15 6.5V17H6zM11 3v4h4', back:'M12.5 4.5 7 10l5.5 5.5'
};
// App top bar for full-app screens (picker/scope/history)
window.DSKit.TopBar = function TopBar({crumbs=[],right=null,NS}){
  const {Mark,Wordmark}=window.DSKit;
  return <div style={{height:50,flex:'none',display:'flex',alignItems:'center',gap:10,padding:'0 16px',margin:'10px 12px 0',...window.DSKit.ISLAND}}>
    <div style={{display:'flex',alignItems:'center',gap:9}}><Mark/><Wordmark/></div>
    {crumbs.length?<div style={{display:'flex',alignItems:'center',gap:7,minWidth:0,marginLeft:6}}>
      <span style={{width:1,height:20,background:'var(--line)'}}/>
      {crumbs.map((c,i)=><React.Fragment key={i}>
        <span style={{fontFamily:i<crumbs.length-1?'var(--font-mono)':'var(--font-sans)',fontSize:i<crumbs.length-1?11.5:13,color:i<crumbs.length-1?'var(--accent)':'var(--text)',fontWeight:i<crumbs.length-1?400:600,whiteSpace:'nowrap'}}>{c}</span>
        {i<crumbs.length-1?<span style={{color:'var(--text-3)'}}>/</span>:null}
      </React.Fragment>)}
    </div>:null}
    <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>{right}</div>
  </div>;
};

// Settings entry point: gear icon → small anchored menu. Theme lives here.
window.DSKit.SettingsButton = function SettingsButton({NS}){
  const {IconButton}=NS;const {Icon,paths}=window.DSKit;
  const [open,setOpen]=React.useState(false);
  const theme=()=>document.documentElement.getAttribute('data-theme')||'dark';
  const [t,setT]=React.useState(theme());
  const set=v=>{document.documentElement.setAttribute('data-theme',v);setT(v)};
  return <span style={{position:'relative',display:'inline-flex'}}>
    <IconButton label="Settings" onClick={()=>setOpen(!open)}><Icon d={paths.gear} sw={1.3}/></IconButton>
    {open?<>
      <span onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:60}}/>
      <span style={{position:'absolute',top:'calc(100% + 6px)',right:0,zIndex:61,width:216,background:'var(--surface)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow)',padding:'10px 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:9.5,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text-3)'}}>Appearance</span>
        <span style={{display:'flex',gap:4,background:'var(--fill-1)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius)',padding:3}}>
          {['dark','light','system'].map(v=><button key={v} onClick={()=>set(v==='system'?'dark':v)} style={{flex:1,border:'none',borderRadius:'var(--radius-sm)',padding:'5px 0',cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:10.5,background:t===v?'var(--surface)':'transparent',color:t===v?'var(--text)':'var(--text-3)',boxShadow:t===v?'0 0 0 1px var(--line-soft)':'none'}}>{v}</button>)}
        </span>
        <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)',paddingTop:2,borderTop:'1px solid var(--line-soft)'}}>model, keybindings, storage → full settings</span>
      </span>
    </>:null}
  </span>;
};
