import React from 'react';
export function ProgressBar({value=0, style}) {
  return React.createElement('div',{role:'progressbar','aria-valuenow':Math.round(value*100),'aria-valuemin':0,'aria-valuemax':100,
    style:{height:4,background:'var(--fill-2)',borderRadius:2,overflow:'hidden',...style}},
    React.createElement('div',{style:{width:(value*100)+'%',height:'100%',background:'var(--accent)',
      transition:'width var(--motion-duration-progress) var(--motion-ease-out)'}}));
}
