import{a as m,b as I}from"./chunk-MMUOS7QK.js";var n=m(I(),1);var i=(...t)=>t.filter((e,u,o)=>!!e&&e.trim()!==""&&o.indexOf(e)===u).join(" ").trim();var T=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();var q=t=>t.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,u,o)=>o?o.toUpperCase():u.toLowerCase());var x=t=>{let e=q(t);return e.charAt(0).toUpperCase()+e.slice(1)};var s=m(I(),1);var c={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};var b=t=>{for(let e in t)if(e.startsWith("aria-")||e==="role"||e==="title")return!0;return!1};var l=m(I(),1);var N=(0,l.createContext)({});var U=()=>(0,l.useContext)(N);var O=(0,s.forwardRef)(({color:t,size:e,strokeWidth:u,absoluteStrokeWidth:o,className:p="",children:d,iconNode:H,...R},v)=>{let{size:L=24,strokeWidth:y=2,absoluteStrokeWidth:G=!1,color:W="currentColor",className:V=""}=U()??{},E=o??G?Number(u??y)*24/Number(e??L):u??y;return(0,s.createElement)("svg",{ref:v,...c,width:e??L??c.width,height:e??L??c.height,stroke:t??W,strokeWidth:E,className:i("lucide",V,p),...!d&&!b(R)&&{"aria-hidden":"true"},...R},[...H.map(([X,z])=>(0,s.createElement)(X,z)),...Array.isArray(d)?d:[d]])});var a=(t,e)=>{let u=(0,n.forwardRef)(({className:o,...p},d)=>(0,n.createElement)(O,{ref:d,iconNode:e,className:i(`lucide-${T(x(t))}`,`lucide-${t}`,o),...p}));return u.displayName=x(t),u};var K=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],C=a("plus",K);var Z=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]],S=a("arrow-right",Z);var Q=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],h=a("check",Q);var J=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],g=a("chevron-down",J);var _=[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]],k=a("chevron-right",_);var j=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],P=a("circle",j);var Y=[["path",{d:"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",key:"1kt360"}]],w=a("folder",Y);var $=[["path",{d:"M15 6a9 9 0 0 0-9 9V3",key:"1cii5b"}],["circle",{cx:"18",cy:"6",r:"3",key:"1h7g24"}],["circle",{cx:"6",cy:"18",r:"3",key:"fqmcym"}]],A=a("git-branch",$);var aa=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],B=a("info",aa);var ea=[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]],f=a("loader-circle",ea);var ta=[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]],F=a("search",ta);var ua=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],M=a("trash-2",ua);var oa=[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]],r=a("triangle-alert",oa);var da=[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]],D=a("x",da);export{S as a,h as b,g as c,k as d,P as e,w as f,A as g,B as h,f as i,C as j,F as k,M as l,r as m,D as n};
/*! Bundled license information:

lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs:
lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs:
lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs:
lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs:
lucide-react/dist/esm/defaultAttributes.mjs:
lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs:
lucide-react/dist/esm/context.mjs:
lucide-react/dist/esm/Icon.mjs:
lucide-react/dist/esm/createLucideIcon.mjs:
lucide-react/dist/esm/icons/plus.mjs:
lucide-react/dist/esm/icons/arrow-right.mjs:
lucide-react/dist/esm/icons/check.mjs:
lucide-react/dist/esm/icons/chevron-down.mjs:
lucide-react/dist/esm/icons/chevron-right.mjs:
lucide-react/dist/esm/icons/circle.mjs:
lucide-react/dist/esm/icons/folder.mjs:
lucide-react/dist/esm/icons/git-branch.mjs:
lucide-react/dist/esm/icons/info.mjs:
lucide-react/dist/esm/icons/loader-circle.mjs:
lucide-react/dist/esm/icons/search.mjs:
lucide-react/dist/esm/icons/trash-2.mjs:
lucide-react/dist/esm/icons/triangle-alert.mjs:
lucide-react/dist/esm/icons/x.mjs:
lucide-react/dist/esm/lucide-react.mjs:
  (**
   * @license lucide-react v1.30.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
//# sourceMappingURL=chunk-QNYWOEJK.js.map
