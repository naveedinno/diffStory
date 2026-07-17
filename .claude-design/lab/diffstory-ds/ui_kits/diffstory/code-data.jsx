const LINES=[
 {no:1,s:' ',h:[['k','import'],['x',' { '],['f','placeOrder'],['x',' } '],['k','from'],['s'," './orders.js'"],['x',';']]},
 {no:2,s:'+',h:[['k','import'],['x',' { '],['f','checkSpendingLimit'],['x',' } '],['k','from'],['s'," './limits.js'"],['x',';']]},
 {no:3,s:' ',h:[]},
 {no:4,s:' ',h:[['c','// POST /orders — create an order for a customer.']]},
 {no:5,s:' ',h:[['k','export async function'],['x',' '],['f','createOrder'],['x','(req) {']]},
 {no:6,s:' ',h:[['x','  '],['k','const'],['x',' { customerId, amount, items } = req.body;']]},
 {no:7,s:'+',h:[]},
 {no:8,s:'+',h:[['x','  '],['c',"// Reject the order if it would blow the customer's monthly cap."]]},
 {no:9,s:'+',h:[['x','  '],['k','const'],['x',' limit = '],['k','await'],['x',' '],['f','checkSpendingLimit'],['x','(customerId, amount);']]},
 {no:10,s:'+',h:[['x','  '],['k','if'],['x',' (!limit.ok) {']]},
 {no:11,s:'+',h:[['x','    '],['k','return'],['x',' { status: '],['n','402'],['x',', error: '],['s',"'over the limit, '"],['x',' + limit.remaining + '],['s',"' remaining'"],['x',' };']]},
 {no:12,s:'+',h:[['x','  }']]},
 {no:13,s:'+',h:[]},
 {no:14,s:' ',h:[['x','  '],['k','const'],['x',' order = '],['k','await'],['x',' '],['f','placeOrder'],['x','(customerId, amount, items);']]},
 {no:15,s:' ',h:[['x','  '],['k','return'],['x',' { status: '],['n','201'],['x',', order };']]},
 {no:16,s:' ',h:[['x','}']]}];
const TK={k:'var(--tk-k)',f:'var(--tk-f)',s:'var(--tk-s)',n:'var(--tk-n)',c:'var(--tk-c)',x:'var(--text)'};
function CodeLine({l,focus,DiffLine}){
  return <DiffLine no={l.no} sign={l.s} focus={focus}>{l.h.length?l.h.map((t,i)=><span key={i} style={{color:TK[t[0]]}}>{t[1]}</span>):' '}</DiffLine>;
}
window.DSKit.LINES=LINES; window.DSKit.CodeLine=CodeLine;
