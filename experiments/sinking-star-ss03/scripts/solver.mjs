/** Author-only bounded pull search. No solver or witness is bundled into the demo. */
import {compileLevel,initialState,stepWorld,stepDetailed,equal,offset,planPull,terrainAt,contains} from '../dist/core.js';
const directions=['N','S','W','E'];
const num=p=>p.y*20+p.x;
const list=ps=>ps.map(num).sort((a,b)=>a-b).join(',');
const sameStones=(a,b)=>a.stones.length===b.stones.length&&a.stones.every(p=>contains(b.stones,p));
/** Directed walking reachability with the stone layout held fixed. Automatic pulls are excluded. */
export function reachable(w,s){
 if(w.gates.length)throw new Error('Walking reachability is only valid for levels without piston circuits; use solve() for complete-state search.');
 const map=new Map([[num(s.hero),[]]]),queue=[s.hero];
 for(let i=0;i<queue.length;i++){
  const p=queue[i],path=map.get(num(p));
  for(let a=1;a<=4;a++){
   const after=stepWorld(w,{...s,hero:p,complete:false},a);
   if(equal(after.hero,p)||!sameStones(s,after)||map.has(num(after.hero)))continue;
   map.set(num(after.hero),[...path,a]);queue.push(after.hero);
  }
 }
 return map;
}
/** Do not collapse by the smallest reachable cell: no-pull walking regions can be directed. */
const key=s=>`${num(s.hero)}|${list(s.stones)}`;
/** Gate memory and sunk supports can differ even when all actor positions are identical. */
const pistonKey=s=>`${num(s.hero)}|${list(s.stones)}|${list(s.supports)}|${(s.gateClosed??[]).map(v=>v?1:0).join('')}`;
function solvePistons(w,{maxStates,maxMs,disablePull,disablePistons}){
 const started=performance.now(),first=initialState(w);
 const nodes=[{s:first,parent:-1,action:0,pulls:0,pistonPushes:0}],seen=new Set([pistonKey(first)]);
 let expanded=0;
 const limit=()=>({status:'limit',states:seen.size,expanded,ms:performance.now()-started});
 function route(index){const actions=[];while(nodes[index].parent>=0){actions.push(nodes[index].action);index=nodes[index].parent;}return actions.reverse();}
 for(let head=0;head<nodes.length;head++){
  if(performance.now()-started>=maxMs||seen.size>maxStates)return limit();
  const node=nodes[head];expanded++;
  if(node.s.complete)return {status:'solved',actions:route(head),pulls:node.pulls,pistonPushes:node.pistonPushes,states:seen.size,expanded,ms:performance.now()-started};
  if(node.s.dead)continue;
  for(let action=1;action<=4;action++){
   if(performance.now()-started>=maxMs)return limit();
   const detail=stepDetailed(w,node.s,action),after=detail.state;
   if(after.dead||after.failed)continue;
   const pulls=detail.phases.filter(p=>p.kind==='pull').length;
   const pistonPushes=detail.phases.filter(p=>p.kind==='piston').length;
   if(disablePull&&pulls)continue;
   if(disablePistons&&detail.phases.some(p=>p.kind==='piston'||p.kind==='crush'))continue;
   const k=pistonKey(after);if(seen.has(k))continue;
   if(seen.size>=maxStates)return limit();
   seen.add(k);nodes.push({s:after,parent:head,action,pulls:node.pulls+pulls,pistonPushes:node.pistonPushes+pistonPushes});
  }
 }
 return {status:'unsolvable',states:seen.size,expanded,ms:performance.now()-started};
}
export function solve(spec,{maxStates=200000,maxMs=15000,disablePull=false,disablePistons=false,lockDoors=false}={}){
 let w=compileLevel(spec);
 if(lockDoors)w={...w,terrain:w.terrain.map((t,i)=>w.doors.some(p=>num(p)===i)?'#':t)};
 if(w.gates.length)return solvePistons(w,{maxStates,maxMs,disablePull,disablePistons});
 const start=initialState(w),nodes=[{s:start,parent:-1,segment:[],pulls:0}],seen=new Set([key(start)]);
 const dry=p=>terrainAt(w,p)==='.'||contains(start.supports,p);
 // Optimistic single-stone pull distances account for walls and the required square ahead of the hero.
 const distances=w.buttons.map(target=>{
  const map=new Map([[num(target),0]]),q=[target];
  for(let i=0;i<q.length;i++)for(const d of directions){
   const previous=offset(q[i],directions[directions.indexOf(d)^1]),ahead=offset(q[i],d);
   if(!dry(previous)||!dry(ahead)||map.has(num(previous)))continue;
   map.set(num(previous),map.get(num(q[i]))+1);q.push(previous);
  }
  return map;
 });
 function match(ps,targets){
  if(!targets.length)return 0;
  if(ps.length<targets.length)return 0; // The hero may be needed on a plate in diagnostic maps.
  let best=1e6;
  for(let i=0;i<ps.length;i++)best=Math.min(best,(distances[targets[0]].get(num(ps[i]))??10000)+match(ps.filter((_,j)=>j!==i),targets.slice(1)));
  return best;
 }
 function score(node){return node.pulls+2*match(node.s.stones,distances.map((_,i)=>i));}
 const pending=[{index:0,score:score(nodes[0])}];
 function push(index){pending.push({index,score:score(nodes[index])});let i=pending.length-1;while(i){const p=(i-1)>>1;if(pending[p].score<=pending[i].score)break;[pending[p],pending[i]]=[pending[i],pending[p]];i=p;}}
 function pop(){const top=pending[0],last=pending.pop();if(pending.length){pending[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let j=i;if(l<pending.length&&pending[l].score<pending[j].score)j=l;if(r<pending.length&&pending[r].score<pending[j].score)j=r;if(j===i)break;[pending[j],pending[i]]=[pending[i],pending[j]];i=j;}}return top.index;}
 function route(index,last){const parts=[last];while(index>=0){const n=nodes[index];parts.push(n.segment);index=n.parent;}return parts.reverse().flat();}
 const started=performance.now();let expanded=0;
 while(pending.length){
  if(performance.now()-started>maxMs)return {status:'limit',states:seen.size,expanded,ms:performance.now()-started};
  const index=pop(),node=nodes[index],s=node.s,reach=reachable(w,s);expanded++;
  if(s.complete||reach.has(num(w.goal)))return {status:'solved',actions:route(index,reach.get(num(w.goal))??[]),pulls:node.pulls,states:seen.size,expanded,ms:performance.now()-started};
  if(disablePull)continue;
  for(const rock of s.stones)for(let d=0;d<4;d++){
   const hero=offset(rock,directions[d]),path=reach.get(num(hero));if(!path)continue;
   const before={...s,hero,facing:directions[d],complete:false},plan=planPull(w,before,directions[d]);
   if(!plan?.valid)continue;
   const after=stepWorld(w,before,d+1);if(after.failed||sameStones(before,after))continue;
   const k=key(after);if(seen.has(k))continue;seen.add(k);
   nodes.push({s:after,parent:index,segment:[...path,d+1],pulls:node.pulls+1});push(nodes.length-1);
   if(seen.size>=maxStates)return {status:'limit',states:seen.size,expanded,ms:performance.now()-started};
  }
 }
 return {status:'unsolvable',states:seen.size,expanded,ms:performance.now()-started};
}
