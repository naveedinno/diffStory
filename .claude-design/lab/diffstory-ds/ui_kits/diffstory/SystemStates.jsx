// System states — loading, empty, error, and in-progress screens.
// One kit screen with a state switcher rail; each state is a full-screen mock.
(function(){
const css=document.createElement('style');
css.textContent=`@keyframes ds-shimmer{0%{opacity:.45}50%{opacity:1}100%{opacity:.45}}
@keyframes ds-dash{to{stroke-dashoffset:0}}
@keyframes ds-pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes ds-spin{to{transform:rotate(360deg)}}`;
document.head.appendChild(css);

function Sk({w='100%',h=12,r=4,style}){return <span style={{display:'block',width:w,height:h,borderRadius:r,background:'var(--fill-2)',animation:'ds-shimmer 1.6s ease-in-out infinite',...style}}/>;}
window.DSKit.Sk=Sk;

// ---- 1. Story generating -------------------------------------------------
function StoryGenerating({go,NS}){
  const {Button,Kicker}=NS;const {Mark}=window.DSKit;
  const log=[
    ['done','read 4 changed files · +33 −1'],
    ['done','ordered the reading path · api → limits → store → tests'],
    ['live','drafting step 03 · "Stored spend becomes a gate result"'],
    ['wait','primer · why the budget is derived, not stored'],
    ['wait','verification map · claims → evidence']];
  return <div style={{height:'100%',display:'grid',placeItems:'center',padding:24}}>
    <div style={{width:480,...window.DSKit.ISLAND,padding:'30px 32px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
        <Mark size={22}/><Kicker tone="accent">Generating the story</Kicker>
        <span style={{marginLeft:'auto',fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-3)'}}>local · ~20s</span>
      </div>
      <svg width="100%" height="34" viewBox="0 0 416 34" style={{marginBottom:18}} aria-hidden="true">
        <path d="M8 17h400" stroke="var(--line)" strokeWidth="2" fill="none"/>
        <path d="M8 17h400" stroke="var(--accent)" strokeWidth="2" fill="none" strokeDasharray="400" strokeDashoffset="400" style={{animation:'ds-dash 20s linear forwards'}}/>
        {[8,88,168,248,328,408].map((x,i)=><circle key={x} cx={x} cy="17" r={i<3?5:4} fill={i<2?'var(--accent)':i===2?'var(--surface)':'var(--surface)'} stroke={i<3?'var(--accent)':'var(--line)'} strokeWidth="1.5" style={i===2?{animation:'ds-pulse 1.2s ease-in-out infinite'}:null}/>)}
      </svg>
      <div style={{display:'flex',flexDirection:'column',gap:9,marginBottom:22}}>
        {log.map(([st,t],i)=><div key={i} style={{display:'flex',gap:10,alignItems:'baseline',fontFamily:'var(--font-mono)',fontSize:11,color:st==='wait'?'var(--text-3)':'var(--text-2)'}}>
          <span style={{width:14,flex:'none',color:st==='done'?'var(--add)':st==='live'?'var(--accent)':'var(--text-3)',...(st==='live'?{animation:'ds-pulse 1.2s ease-in-out infinite'}:null)}}>{st==='done'?'✓':st==='live'?'●':'○'}</span>
          <span style={{minWidth:0}}>{t}</span></div>)}
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <Button variant="secondary" size="sm" onClick={()=>go('allfiles')}>Read the raw diff meanwhile →</Button>
        <button onClick={()=>go('scope')} style={{marginLeft:'auto',border:'none',background:'transparent',cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-3)'}}>cancel</button>
      </div>
    </div>
  </div>;
}

// ---- 2. Diff loading skeleton ---------------------------------------------
function DiffSkeleton(){
  return <div style={{height:'100%',display:'flex',gap:12,padding:12}}>
    <div style={{width:'var(--rail-width)',flex:'none',...window.DSKit.ISLAND,padding:'16px 14px',display:'flex',flexDirection:'column',gap:14}}>
      <Sk w={64} h={10}/><Sk h={32} r={9}/>
      {[92,72,84,60].map((w,i)=><div key={i} style={{display:'flex',gap:10,alignItems:'center'}}><Sk w={16} h={16} r={4}/><Sk w={w+'%'} h={11}/></div>)}
    </div>
    <div style={{flex:1,...window.DSKit.ISLAND,padding:'16px',display:'flex',flexDirection:'column',gap:0,overflow:'hidden'}}>
      <div style={{display:'flex',gap:12,alignItems:'center',paddingBottom:14,marginBottom:14,borderBottom:'1px solid var(--line-soft)'}}><Sk w={180} h={12}/><Sk w={60} h={10} style={{marginLeft:'auto'}}/></div>
      {[.9,.75,.85,.6,.8,.7,.5,.82,.65,.4].map((f,i)=><div key={i} style={{display:'flex',gap:14,alignItems:'center',padding:'5px 0'}}>
        <Sk w={26} h={10} style={{flex:'none'}}/><Sk w={(f*72)+'%'} h={10} style={{animationDelay:(i*.08)+'s'}}/></div>)}
      <div style={{marginTop:'auto',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-3)'}}>computing diff · git diff --merge-base main</div>
    </div>
  </div>;
}

// ---- 3. Empty picker --------------------------------------------------------
function EmptyPicker({NS}){
  const {Button}=NS;const {Mark,Icon,paths}=window.DSKit;
  return <div style={{maxWidth:820,margin:'0 auto',padding:'36px 24px'}}>
    <div style={{display:'flex',alignItems:'center',gap:11,paddingBottom:22,borderBottom:'1px solid var(--line-soft)'}}>
      <Mark size={26}/><span style={{fontSize:18}}><span style={{color:'var(--text-2)'}}>diff</span><span style={{fontWeight:600}}>Story</span></span>
    </div>
    <div style={{marginTop:56,textAlign:'center'}}>
      <div style={{width:52,height:52,margin:'0 auto 18px',display:'grid',placeItems:'center',borderRadius:'var(--radius-island)',background:'var(--fill-1)',color:'var(--text-3)'}}><Icon d={paths.folder} size={24} sw={1.4}/></div>
      <div style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:700,letterSpacing:'var(--tracking-tight)',marginBottom:8}}>No repositories yet</div>
      <div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.6,maxWidth:380,margin:'0 auto 20px'}}>Point diffStory at any local Git repository. It reads the working tree directly — nothing is uploaded.</div>
      <Button><Icon d={paths.plus} size={14}/> Add a repository</Button>
      <div style={{fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-3)',marginTop:14}}>or drop a folder anywhere on this window</div>
    </div>
  </div>;
}

// ---- 4. Clean working tree ---------------------------------------------------
function CleanTree({go,NS}){
  const {Button,Kicker}=NS;const {Icon,paths,TopBar}=window.DSKit;
  return <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
    <TopBar crumbs={['diffstory-demo','Changes']} NS={NS}/>
    <div style={{flex:1,display:'grid',placeItems:'center'}}>
      <div style={{width:440,...window.DSKit.ISLAND,padding:'28px 30px',textAlign:'center'}}>
        <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--add)',marginBottom:12}}>✓ working tree clean</div>
        <div style={{fontFamily:'var(--font-display)',fontSize:19,fontWeight:700,letterSpacing:'var(--tracking-tight)',marginBottom:8}}>Nothing to review on ⎇ feat/spending-limit</div>
        <div style={{fontSize:12.5,color:'var(--text-2)',lineHeight:1.6,marginBottom:20}}>No uncommitted changes and no commits ahead of main. When your agent writes code, the changes appear here.</div>
        <div style={{display:'flex',gap:8,justifyContent:'center'}}>
          <Button variant="secondary" size="sm"><Icon d={paths.reload} size={14}/> Re-check</Button>
          <Button variant="secondary" size="sm" onClick={()=>go('history')}>Past rounds →</Button>
        </div>
      </div>
    </div>
  </div>;
}

// ---- 5. Story generation failed ---------------------------------------------
function StoryError({go,NS}){
  const {Button,Kicker}=NS;
  return <div style={{height:'100%',display:'grid',placeItems:'center',padding:24}}>
    <div style={{width:460,...window.DSKit.ISLAND,padding:'26px 28px'}}>
      <Kicker tone="danger">Story generation failed</Kicker>
      <div style={{fontSize:15,fontWeight:600,margin:'10px 0 8px'}}>The model didn't return a usable story</div>
      <div style={{fontFamily:'var(--font-mono)',fontSize:10.5,lineHeight:1.7,color:'var(--text-2)',background:'var(--fill-1)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius)',padding:'10px 12px',marginBottom:10}}>anthropic · timeout after 60s · request re-runs from scratch, nothing was saved</div>
      <div style={{fontSize:12,color:'var(--text-2)',lineHeight:1.6,marginBottom:18}}>Your diff is untouched — the story is a layer on top. Retry, or review the raw diff; you can generate again anytime.</div>
      <div style={{display:'flex',gap:8}}>
        <Button size="sm">Retry generation</Button>
        <Button variant="secondary" size="sm" onClick={()=>go('allfiles')}>Review 4 files without a story →</Button>
      </div>
    </div>
  </div>;
}

// ---- 6. Round sent / agent working --------------------------------------------
function RoundSent({go,NS}){
  const {Button,Kicker}=NS;
  return <div style={{height:'100%',display:'grid',placeItems:'center',padding:24}}>
    <div style={{width:460,...window.DSKit.ISLAND,padding:'26px 28px'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:14}}>
        <Kicker tone="accent">Notes sent</Kicker>
        <span style={{fontFamily:'var(--font-mono)',fontSize:10.5,color:'var(--text-3)'}}>.diffstory/notes.md · copied · just now</span>
      </div>
      <div style={{fontFamily:'var(--font-mono)',fontSize:11,lineHeight:1.8,color:'var(--text-2)',background:'var(--fill-1)',border:'1px solid var(--line-soft)',borderRadius:'var(--radius)',padding:'12px 14px',marginBottom:14}}>
        2 notes · src/limits.ts:12 · src/api.ts:11<br/>paste into your agent — any agent, your session</div>
      <div style={{display:'flex',gap:10,alignItems:'center',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-2)',marginBottom:18}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:'var(--amber)',animation:'ds-pulse 1.2s ease-in-out infinite'}}/>watching the working tree — when it changes, a fresh review opens</div>
      <div style={{display:'flex',gap:8}}>
        <Button variant="secondary" size="sm" onClick={()=>go('allfiles')}>Keep reading the diff</Button>
        <Button variant="secondary" size="sm" onClick={()=>go('history')}>Review history →</Button>
      </div>
    </div>
  </div>;
}

const STATES=[
  ['story-gen','Generating story',StoryGenerating],
  ['diff-skeleton','Diff loading',DiffSkeleton],
  ['empty-picker','No repositories',EmptyPicker],
  ['clean-tree','Nothing to review',CleanTree],
  ['story-error','Generation failed',StoryError],
  ['round-sent','Notes sent',RoundSent]];

window.DSKit.SystemStates = function SystemStates({go,NS}){
  const [st,setSt]=React.useState('story-gen');
  const S=STATES.find(s=>s[0]===st)[2];
  return <div style={{height:'100%',display:'flex',flexDirection:'column'}}>
    <div style={{flex:'none',display:'flex',gap:2,padding:'8px 12px',alignItems:'center'}}>
      <span style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--text-3)',paddingRight:6}}>state</span>
      {STATES.map(([k,label])=><button key={k} onClick={()=>setSt(k)} style={{border:'none',borderRadius:4,padding:'4px 9px',cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:10,background:st===k?'var(--accent-soft)':'transparent',color:st===k?'var(--accent)':'var(--text-2)'}}>{label}</button>)}
    </div>
    <div style={{flex:1,minHeight:0}}><S go={go} NS={NS}/></div>
  </div>;
};
})();
