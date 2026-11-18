/** Author-only bounded search by pushes. Never bundled or sent to the SRA. */
import {compileLevel,initialState,stepWorld,equal,offset,terrainAt,doorsOpen,contains} from '../dist/core.js';
const directions=['N','S','W','E'];
const num=p=>p.y*20+p.x;
const list=ps=>ps.map(num).sort((a,b)=>a-b).join(',');
export function reachable(w,s){
 const map=new Map([[num(s.hero),[]]]), queue=[s.hero];
 for(let head=0;head<queue.length;head++){
  const p=queue[head], path=map.get(num(p));
  for(let action=1;action<=4;action++){
   // Walking regions must not push stones or discard a changed stone layout.
   if(contains(s.stones,offset(p,directions[action-1])))continue;
   const next=stepWorld(w,{...s,hero:p,complete:false},action);
   if(equal(next.hero,p)||map.has(num(next.hero)))continue;
   map.set(num(next.hero),[...path,action]);queue.push(next.hero);
  }
 }
 return map;
}
const key=(s,reach)=>`${list(s.stones)}|${list(s.supports)}|${Math.min(...reach.keys())}`;
export function solve(spec,{maxStates=100000,maxMs=8000,disableSinking=false,lockDoors=false,guides=[]}={}){
 let w=compileLevel(spec);
 if(lockDoors) w={...w,terrain:w.terrain.map((t,i)=>w.doors.some(p=>num(p)===i)?'#':t)};
 const first=initialState(w), firstReach=reachable(w,first);
 const queue=[{s:first,reach:firstReach,parent:-1,segment:[],pushes:0}];
 const seen=new Set([key(first,firstReach)]);
 const ox=Math.floor((20-spec.rows[0].length)/2),oy=Math.floor((20-spec.rows.length)/2);
 const guidePoints=guides.map(([x,y])=>({x:x+ox,y:y+oy}));
 function score(node){
  const targets=[...w.buttons,...guidePoints.filter(p=>!contains(node.s.supports,p))];
  function match(ps,ts){if(!ts.length)return 0;if(ps.length<ts.length)return 10000;
   return Math.min(...ps.map((p,i)=>Math.abs(p.x-ts[0].x)+Math.abs(p.y-ts[0].y)+match(ps.filter((_,j)=>i!==j),ts.slice(1))));}
  return node.pushes+2*match(node.s.stones,targets);
 }
 const usePriority=guides.length>0 || w.buttons.length>0;
 const pending=[{index:0,priority:score(queue[0])}];
 function enqueue(index){pending.push({index,priority:score(queue[index])});let i=pending.length-1;
  while(i>0){let p=(i-1)>>1;if(pending[p].priority<=pending[i].priority)break;[pending[p],pending[i]]=[pending[i],pending[p]];i=p;}}
 function pop(){const top=pending[0],last=pending.pop();if(pending.length){pending[0]=last;let i=0;for(;;){let l=i*2+1,r=l+1,j=i;if(l<pending.length&&pending[l].priority<pending[j].priority)j=l;if(r<pending.length&&pending[r].priority<pending[j].priority)j=r;if(j===i)break;[pending[i],pending[j]]=[pending[j],pending[i]];i=j;}}return top.index;}
 let expanded=0;
 function route(index,last=[]){const parts=[last];while(index>=0){const node=queue[index];parts.push(node.segment);index=node.parent;}return parts.reverse().flat();}
 const started=performance.now();
 for(let fifo=0;usePriority?pending.length>0:fifo<queue.length;fifo++){
  if(performance.now()-started>maxMs)return {status:"limit",states:seen.size,ms:performance.now()-started};
  const head=usePriority?pop():fifo; expanded++;
  const node=queue[head],{s,reach}=node;
  if(s.complete||reach.has(num(w.goal))) return {status:'solved',actions:route(head,reach.get(num(w.goal))??[]),pushes:node.pushes,states:seen.size,expanded,ms:performance.now()-started};
  for(const rock of s.stones)for(let d=0;d<4;d++){
   const behind=offset(rock,directions[d^1]), path=reach.get(num(behind));
   if(!path)continue;
   const oriented={...s,hero:behind,facing:directions[d],complete:false};
   const after=stepWorld(w,oriented,d+1);
   if(after.failed)continue;
   if(disableSinking&&after.supports.length>s.supports.length)continue;
   const r=reachable(w,after), k=key(after,r);
   if(seen.has(k))continue;
   seen.add(k);queue.push({s:after,reach:r,parent:head,segment:[...path,d+1],pushes:node.pushes+1});
   if(usePriority)enqueue(queue.length-1);
   if(seen.size>=maxStates)return {status:'limit',states:seen.size,ms:performance.now()-started};
  }
 }
 return {status:'unsolvable',states:seen.size,ms:performance.now()-started};
}
