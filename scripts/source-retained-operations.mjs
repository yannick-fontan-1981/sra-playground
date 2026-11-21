import {footprints, changedFootprints} from './source-contact-footprints.mjs';

const key = p => p.join(',');
const center = p => [(p.bbox[0] + p.bbox[2]) / 2, (p.bbox[1] + p.bbox[3]) / 2];
const plus = (a,b) => [a[0]+b[0], a[1]+b[1]];
const minus = (a,b) => [a[0]-b[0], a[1]-b[1]];
const norm = d => Math.abs(d[0])+Math.abs(d[1]);
const single = group => group?.size===1 ? group.values().next().value : null;
function localPatch(rows, box) {
  return rows.slice(box[1],box[3]+1).map(row=>row.slice(box[0],box[2]+1).join(',')).join('/');
}
function surroundings(rows,box,gap) {
  const x=Math.floor((box[0]+box[2])/2),y=Math.floor((box[1]+box[3])/2),samples=[];
  for(const scale of [.5,1,2])for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]){
    samples.push(rows[y+dy*Math.max(1,Math.round(gap*scale))]?.[x+dx*Math.max(1,Math.round(gap*scale))]??-1);
  }
  return samples;
}
function nearestGap(part,group){
  const p=center(part);
  return Math.max(1,Math.min(...[...group.values()].filter(o=>o!==part).map(o=>Math.max(...minus(center(o),p).map(Math.abs)))));
}
export function newOperandMemory() { return {rules:new Map(), motors:new Map(), places:new Map()}; }
export function observeOperands(memory, rows, nextRows, before, after, input, step) {
  if(rows.length!==nextRows.length||rows[0].length!==nextRows[0].length)return;
  if(!rows.some((row,y)=>row.some((value,x)=>value!==nextRows[y][x])))return;
  const moves=changedFootprints(before,after).filter(m=>m.copies===1), click=input.startsWith('ACTION6:')?input.slice(8).split(',').map(Number):null;
  for (const m of moves) {
    if(!/^ACTION[1-4]$/.test(input))continue;
    const motors=memory.motors.get(m.shape)??new Map(), values=motors.get(input)??new Set();
    values.add(key([m.dx,m.dy]));motors.set(input,values);memory.motors.set(m.shape,motors);
    const places=memory.places.get(m.shape)??new Set();
    places.add(key(center(m.from)));places.add(key(center(m.to)));memory.places.set(m.shape,places);
  }
  // An effect persists only when a subsequent, physically changing action
  // leaves its postcondition visible. Undoing it removes that witness.
  for(const rule of memory.rules.values())for(const s of rule.sites.values()){
    if(s.lost)continue;
    if(localPatch(nextRows,s.box)!==rule.after){s.lost=true;continue;}
    if(s.step<step)s.confirmed=true;
  }
  for(const [operand,group] of before){
    const rest=after.get(operand);
    if(group.size<2||group.size>64||!rest||rest.size!==group.size-1)continue;
    const missing=[...group].filter(([site])=>!rest.has(site));
    if(missing.length!==1)continue;
    const [site,part]=missing[0],box=part.bbox;
    if((box[2]-box[0]+1)*(box[3]-box[1]+1)>144)continue;
    const oldValue=localPatch(rows,box),newValue=localPatch(nextRows,box);
    if(oldValue===newValue)continue;
    const bindings=[];
    if(click&&click[0]>=box[0]&&click[0]<=box[2]&&click[1]>=box[1]&&click[1]<=box[3])
      bindings.push({kind:'point',offset:minus(click,box),input:'ACTION6'});
    if(!click)for(const m of moves){
      if(m.shape===operand)continue;
      const arrival=center(m.to),pitch=norm([m.dx,m.dy]);
      if(Math.max(...minus(arrival,center(part)).map(Math.abs))>pitch*.48)continue;
      bindings.push({kind:'approach',actor:m.shape,offset:minus(center(m.from),center(part)),input});
    }
    for(const binding of bindings){
      const id=JSON.stringify([operand,oldValue,newValue,binding]);
      const rule=memory.rules.get(id)??{operand,before:oldValue,after:newValue,binding,sites:new Map()};
      const prior=rule.sites.get(site);
      if(!prior||prior.lost){
        const gap=nearestGap(part,group);
        rule.sites.set(site,{step,box:[...box],gap,surroundings:surroundings(rows,box,gap),confirmed:false,lost:false});
      }
      memory.rules.set(id,rule);
    }
  }
}
function contactPath(memory,layout,binding,part,available) {
  const box=part.bbox;
  if(binding.kind==='point'){
    if(!available.has(6))return;
    return ['ACTION6:'+key(plus(box,binding.offset))];
  }
  const body=single(layout.get(binding.actor));if(!body)return;
  const start=center(body),goal=plus(center(part),binding.offset),visited=memory.places.get(binding.actor);
  const motors=[...(memory.motors.get(binding.actor)??[])].filter(([input,ds])=>ds.size===1&&available.has(Number(input.slice(6))))
    .map(([input,ds])=>[input,[...ds][0].split(',').map(Number)]);
  if(!available.has(Number(binding.input.slice(6))))return;
  const queue=[{at:start,path:[]}],seen=new Set([key(start)]);
  for(let i=0;i<queue.length;i++){
    const {at,path}=queue[i];
    if(key(at)===key(goal))return [...path,binding.input];
    if(path.length>=6)continue;
    for(const [input,d] of motors){
      const next=plus(at,d),k=key(next);
      if(seen.has(k)||(!visited?.has(k)&&k!==key(goal)))continue;
      seen.add(k);queue.push({at:next,path:[...path,input]});
    }
  }
}
export function proposeOperands(memory,rows,layout,available) {
  const offers=[];
  for(const rule of memory.rules.values()){
    const kept=[...rule.sites.values()].filter(s=>s.confirmed&&!s.lost&&localPatch(rows,s.box)===rule.after);
    if(!kept.length)continue;
    const remaining=layout.get(rule.operand);if(!remaining?.size)continue;
    for(const target of remaining.values()){
      if(localPatch(rows,target.bbox)!==rule.before)continue;
      const word=contactPath(memory,layout,rule.binding,target,available);if(!word)continue;
      offers.push({rule,target:[...target.bbox],word,kept,remaining:remaining.size});
    }
  }
  return offers.sort((a,b)=>b.kept.length-a.kept.length||a.remaining-b.remaining||a.word.length-b.word.length);
}
export function verifyOperand(offer,rows) {
  return {changed:localPatch(rows,offer.target)===offer.rule.after,
    kept:offer.kept.every(s=>localPatch(rows,s.box)===offer.rule.after)};
}
export function operandContrasts(offer,rows){
  return {oldGone:localPatch(rows,offer.target)!==offer.rule.before,
    firstStillChanged:offer.kept.every(s=>localPatch(rows,s.box)!==offer.rule.before),...verifyOperand(offer,rows)};
}
export function operandContext(offer,rows){
  return Math.max(...offer.kept.map(s=>{
    const v=surroundings(rows,offer.target,s.gap);
    return v.reduce((n,color,i)=>n+Number(color===s.surroundings[i]),0)/v.length;
  }));
}
export {footprints};
