import {changedFootprints} from './source-contact-footprints.mjs';

const key=p=>p.join(',');
export const midpoint=p=>[p.bbox[0]+p.bbox[2],p.bbox[1]+p.bbox[3]];
const centerColor=(rows,p)=>rows[Math.floor(p[1]/2)]?.[Math.floor(p[0]/2)];
const single=entries=>entries?.size===1?entries.values().next().value:null;
const getKey=(map,key,create)=>{if(!map.has(key))map.set(key,create());return map.get(key);};
export function newCoordinateMemory(){return {actors:new Map(),fixed:new Map()};}
export function observeCoordinates(memory,before,after,rows,next,input,step) {
  for(const [role,group] of after){
    const previous=before.get(role),old=memory.fixed.get(role)??new Map(),now=new Map();
    for(const site of group.keys())now.set(site,previous?.has(site)?old.get(site)??step-1:step);
    memory.fixed.set(role,now);
  }
  for(const role of memory.fixed.keys())if(!after.has(role))memory.fixed.delete(role);
  if(!/^ACTION[1-57]$/.test(input))return;
  for(const motion of changedFootprints(before,after)){
    if(motion.copies!==1)continue;
    const from=midpoint(motion.from),to=midpoint(motion.to),d=to.map((v,i)=>v-from[i]);
    const actor=getKey(memory.actors,motion.shape,()=>({inputs:new Map(),pairs:new Map(),visited:new Map(),floors:new Map(),last:null}));
    const values=getKey(actor.inputs,input,()=>new Map()),id=key(d);
    values.set(id,(values.get(id)??0)+1);actor.visited.set(key(from),step-1);actor.visited.set(key(to),step);
    const floor=centerColor(next,from);
    if(floor!==undefined)actor.floors.set(floor,(actor.floors.get(floor)??0)+1);
    const prev=actor.last,axis=d[0]?0:1;
    if(prev?.step===step-1&&prev.axis!==axis&&key(prev.to)===key(from)){
      const pair=prev.input+'/'+input;
      const proof=getKey(actor.pairs,pair,()=>({count:0,first:step-1,last:step}));
      proof.count++;proof.last=step;
    }
    actor.last={axis,input,to,step};
  }
}
function orderedRoute(actor,rows,start,goal,x,y) {
  const n=(goal[0]-start[0])/x.delta,m=(goal[1]-start[1])/y.delta;
  if(n<1||m<1||!Number.isInteger(n)||!Number.isInteger(m)||n+m<3||n+m>18)return;
  const floor=[...actor.floors].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const paths=new Map([['0,0',{cost:0,word:[],positions:[]}]]);
  for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){
    if(i===0&&j===0)continue;
    const at=[start[0]+i*x.delta,start[1]+j*y.delta],known=actor.visited.has(key(at));
    const local=known||i===n&&j===m?0:centerColor(rows,at)===floor?1:4;
    let best;
    for(const [a,b,input] of [[i-1,j,x.input],[i,j-1,y.input]]){
      const prev=paths.get(key([a,b]));if(!prev)continue;
      const cost=prev.cost+local;
      if(!best||cost<best.cost)best={cost,word:[...prev.word,input],positions:[...prev.positions,at]};
    }
    if(best)paths.set(key([i,j]),best);
  }
  return paths.get(key([n,m]));
}
export function coordinatePrograms(memory,view,rows,available,step,budget){
  const offers=[];
  for(const [role,actor] of memory.actors){
    const subject=single(view.get(role));if(!subject)continue;
    const start=midpoint(subject),motors=[];
    for(const [input,ds] of actor.inputs){
      if(ds.size!==1||!available.has(Number(input.slice(6))))continue;
      const [d,support]=[...ds][0],v=d.split(',').map(Number),axis=v[0]?0:1;
      if(Math.abs(v[axis])>8*Math.max(subject.bbox[2]-subject.bbox[0]+1,subject.bbox[3]-subject.bbox[1]+1))continue;
      motors.push({input,axis,delta:v[axis],support});
    }
    for(const x of motors.filter(m=>m.axis===0))for(const y of motors.filter(m=>m.axis===1)){
      const xy=actor.pairs.get(x.input+'/'+y.input),yx=actor.pairs.get(y.input+'/'+x.input);
      if(!xy&&!yx)continue;
      for(const [marker,group] of view){
        if(marker===role||group.size>6)continue;
        for(const [site,part] of group){
          const since=memory.fixed.get(marker)?.get(site);
          if(since===undefined||step-since<2)continue;
          const [left,top,right,bottom]=part.bbox;
          if(right-left+1>Math.abs(x.delta)||bottom-top+1>Math.abs(y.delta))continue;
          const middle=midpoint(part),goal=[start[0]+Math.round((middle[0]-start[0])/x.delta)*x.delta,
            start[1]+Math.round((middle[1]-start[1])/y.delta)*y.delta];
          if(goal[0]<2*left-1||goal[0]>2*right+1||goal[1]<2*top-1||goal[1]>2*bottom+1)continue;
          if((actor.visited.get(key(goal))??-1)>=since)continue;
          const route=orderedRoute(actor,rows,start,goal,x,y);if(!route||route.word.length>budget)continue;
          const score=5*Number(group.size===1)+3*Number(!!xy&&!!yx)+Math.min(x.support,y.support,3)
            -route.cost/route.word.length-Math.log2(route.word.length);
          offers.push({role,marker,site,start,goal,...route,score,copies:group.size,x,y,
            xy:xy?.first??null,yx:yx?.first??null});
        }
      }
    }
  }
  return offers.sort((a,b)=>b.score-a.score);
}
