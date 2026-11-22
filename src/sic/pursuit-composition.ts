import {add,diff,same,size,type XY} from './access-terrain.ts';
import {aligned} from './controlled-parts.ts';
import type {PreviewLearning,VisualLayout} from './witnessed-preview-transfer.ts';
import type {NativeRows} from '../logos-engine/v6-native-types.ts';

type Sample={actor:XY;peer:XY;next:XY};
type Response={actor:string;peer:string;pitch:number;away:number;toward:number;responses:string[];sites:string[];refs:string[];samples:Sample[]};
export type PursuitMemory={pairs:Record<string,Response>};
export type PursuitChoice={actor:string;peer:string;from:XY;to:XY;target:XY;input:string;horizon:number;
  peerOptions:XY[];refs:string[];basis:'all_measured_escape_directions'|'calibrated_response'|'one_possible_response'};
type ContactReturn = { actor:string; peer:string; target:XY; returnedFrame:string; evidence:string; repeated:boolean };
export type ContactReturns = Record<string,Record<string,ContactReturn>>;

export function repeatedContactMiss(history:ContactReturns | undefined, frame:string, trial:PursuitChoice) {
  const miss = history?.[frame]?.[trial.input];
  return !!miss?.repeated && miss.actor===trial.actor && miss.peer===trial.peer && same(miss.target,trial.target)
    && same(trial.to,trial.target);
}

export function recordContactMiss(history:ContactReturns, frame:string, trial:PursuitChoice, returnedFrame:string, evidence:string) {
  const actions = history[frame] ??= {};
  const previous = actions[trial.input];
  const repeated = !!previous && previous.returnedFrame===returnedFrame && previous.actor===trial.actor
    && previous.peer===trial.peer && same(previous.target,trial.target) && (previous.repeated || previous.evidence!==evidence);
  actions[trial.input]={actor:trial.actor,peer:trial.peer,target:trial.target,returnedFrame,evidence,repeated};
  return repeated;
}

export function reconsiderContact(history:ContactReturns | undefined, frame:string, input:string, returnedFrame:string) {
  if (!history) return;
  const actions = history[frame];
  if (!actions?.[input] || actions[input].returnedFrame===returnedFrame) return;
  delete actions[input];
  if (!Object.keys(actions).length) delete history[frame];
}
const cardinals=(pitch:number):XY[]=>[[pitch,0],[-pitch,0],[0,pitch],[0,-pitch]];
const distance=(a:XY,b:XY)=>size(diff(a,b));

/** Cancel stationary copies first. Only attribute a displacement when both endpoints identify each other. */
function shiftedPeers(old:XY[],next:XY[],pitch:number){
  const entered=next.filter(p=>!old.some(q=>same(p,q))),left=old.filter(p=>!next.some(q=>same(p,q)));
  return left.flatMap(p=>{
    const matches=entered.filter(q=>distance(p,q)===pitch&&(q[0]===p[0]||q[1]===p[1]));
    const q=matches[0];
    return matches.length===1&&q&&left.filter(v=>distance(v,q)===pitch&&(v[0]===q[0]||v[1]===q[1])).length===1?[{p,q}]:[];
  });
}
export function observePursuit(memory:PursuitMemory,before:VisualLayout,after:VisualLayout,input:string,ref:string){
  if(!/^ACTION[1-4]$/.test(input))return;
  const moved=Object.entries(before).filter(([role,parts])=>{
    const next=after[role];return parts.length<=8&&next?.length===parts.length&&parts.some(p=>!next.some(q=>same(p.at,q.at)));
  });
  for(const [actor,parts] of moved){
    if(parts.length!==1)continue;
    const a=parts[0]!.at,an=after[actor]![0]!.at,d=diff(an,a),pitch=size(d);
    if((d[0]===0)===(d[1]===0)||pitch<2)continue;
    for(const [peer,peers] of moved){
      if(peer===actor)continue;
      for(const {p,q} of shiftedPeers(peers.map(z=>z.at),after[peer]!.map(z=>z.at),pitch)){
        if(distance(a,p)<pitch/2||distance(an,q)<pitch/2)continue;
        const gain=distance(an,q)-distance(an,p);if(Math.abs(gain)!==pitch)continue;
        const id=[actor,peer,pitch].join('/');
        if(!memory.pairs[id]&&Object.keys(memory.pairs).length>=96)continue;
        const r=memory.pairs[id]??={actor,peer,pitch,away:0,toward:0,responses:[],sites:[],refs:[],samples:[]};
        if(gain>0)r.away++;else r.toward++;
        const effect=diff(q,p).join();if(!r.responses.includes(effect))r.responses.push(effect);
        for(const loc of [a,an,p,q])if(!r.sites.includes(loc.join()))r.sites.push(loc.join());
        if(r.refs.at(-1)!==ref)r.refs=[...r.refs.slice(-3),ref];
      }
    }
  }
  for(const r of Object.values(memory.pairs)){
    const subject=before[r.actor],returned=after[r.actor],old=before[r.peer],next=after[r.peer];
    if(subject?.length!==1||returned?.length!==1||!old||next?.length!==old.length)continue;
    const a=returned[0]!.at;if(distance(subject[0]!.at,a)!==r.pitch)continue;
    const p=old.map(z=>z.at),q=next.map(z=>z.at),changed=shiftedPeers(p,q,r.pitch);
    for(const b of p){
      const end=q.find(z=>same(z,b))??changed.find(m=>same(m.p,b))?.q;if(!end)continue;
      if(!r.samples.some(s=>same(s.actor,a)&&same(s.peer,b)&&same(s.next,end)))r.samples=[...r.samples.slice(-95),{actor:a,peer:b,next:end}];
    }
  }
}

// Compute the number of further actor moves required to contact the peer.
// The universal case admits a move only when every projected peer reply has a shorter continuation.
export function captureRanks(cells:XY[],actorEdges:number[][],peerEdges:number[][],conservative:boolean,predicted?:Int16Array):Int16Array {
  const n=cells.length,rank=new Int16Array(n*n),next=new Int16Array(n*n);
  const replies=Array.from({length:n*n},(_,i)=>{
    if(predicted)return [predicted[i]!];
    const a=cells[Math.floor(i/n)]!,b=i%n,d=distance(a,cells[b]!);
    return [b,...peerEdges[b]!.filter(q=>distance(a,cells[q]!)>d)];
  });
  for(let a=0;a<n;a++)for(const dest of actorEdges[a]!)rank[a*n+dest]=1;
  for(let depth=2;depth<=Math.min(48,n+1);depth++){
    next.set(rank);let gains=0;
    for(let a=0;a<n;a++)for(let b=0;b<n;b++){
      if(a===b||rank[a*n+b])continue;
      for(const dest of actorEdges[a]!){
        const row=dest*n,options=replies[row+b]!;
        const qualifies=conservative?options.every(q=>rank[row+q]!>0):options.some(q=>rank[row+q]!>0);
        if(qualifies){next[a*n+b]=depth;gains++;break;}
      }
    }
    if(!gains)break;
    rank.set(next);
  }
  return rank;
}
type Fitted={predicted:Int16Array;ranks:Int16Array};
type Graph={cells:XY[];indices:Map<string,number>;actorEdges:number[][];peerEdges:number[][];worst:Int16Array;best?:Int16Array;models:Map<string,Fitted>};
const graphCache=new Map<string,Graph>();
function graph(points:XY[],directions:XY[],peerDirections:XY[]){
  const cells=points.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const id=JSON.stringify([cells,directions,peerDirections]);
  const old=graphCache.get(id);if(old)return old;
  const indices=new Map(cells.map((p,i)=>[p.join(),i]));
  const edges=(ds:XY[])=>cells.map(p=>ds.flatMap(d=>{const k=indices.get(add(p,d).join());return k===undefined?[]:[k];}));
  const actorEdges=edges(directions),peerEdges=edges(peerDirections);
  const result:Graph={cells,indices,actorEdges,peerEdges,worst:captureRanks(cells,actorEdges,peerEdges,true),models:new Map()};
  if(graphCache.size>=8)graphCache.delete(graphCache.keys().next().value!);
  graphCache.set(id,result);return result;
}
function permutations(xs:number[]):number[][]{
  return xs.length?xs.flatMap(x=>permutations(xs.filter(y=>y!==x)).map(t=>[x,...t])):[[]];
}
const priorities=permutations([0,1,2,3]);
function fitResponse(g:Graph,r:Response,origin:XY):Fitted|undefined{
  const index=(p:XY)=>g.indices.get(aligned(p,origin,[r.pitch,r.pitch]).join());
  const samples=r.samples.flatMap(s=>{
    const a=index(s.actor),b=index(s.peer),c=index(s.next);
    return a===undefined||b===undefined||c===undefined?[]:[{a,b,c}];
  });
  const moving=samples.filter(s=>s.b!==s.c).length;
  if(moving<3||samples.length<5)return;
  const n=g.cells.length,axes=cardinals(r.pitch),options=g.cells.map(p=>axes.map(d=>index(add(p,d))??-1));
  const ranges=[Infinity,...new Set(samples.map(s=>distance(g.cells[s.a]!,g.cells[s.b]!)/r.pitch))];
  function response(a:number,b:number,order:number[],squared:boolean,range:number){
    const from=g.cells[a]!,at=g.cells[b]!,initial=distance(from,at);
    if(initial>range*r.pitch)return b;
    const value=(p:XY)=>squared?(p[0]-from[0])**2+(p[1]-from[1])**2:distance(from,p);
    let best=b,score=value(at);
    for(const k of order){
      const q=options[b]![k]!;if(q<0||distance(from,g.cells[q]!)<=initial)continue;
      const v=value(g.cells[q]!);if(v>score){score=v;best=q;}
    }
    return best;
  }
  let best:{score:number;order:number[];squared:boolean;range:number}|undefined;
  for(const range of ranges)for(const squared of [false,true])for(const order of priorities){
    let right=0,movedRight=0;
    for(const s of samples)if(response(s.a,s.b,order,squared,range)===s.c){right++;if(s.b!==s.c)movedRight++;}
    const score=(right/samples.length+movedRight/moving)/2;
    if(!best||score>best.score)best={score,order,squared,range};
  }
  if(!best||best.score<0.7)return;
  const {order,squared,range}=best,k=[order,squared,range].join('/'),existing=g.models.get(k);if(existing)return existing;
  const predicted=Int16Array.from({length:n*n},(_,i)=>response(Math.floor(i/n),i%n,order,squared,range));
  const fitted={predicted,ranks:captureRanks(g.cells,g.actorEdges,g.peerEdges,true,predicted)};
  if(g.models.size>=8)g.models.delete(g.models.keys().next().value!);g.models.set(k,fitted);return fitted;
}
export type PursuitTerrain={actor:string;peer:string;from:XY;targets:XY[];pitch:number;floor:number;known:Set<string>;
  reachable:XY[];motors:{op:string;d:XY}[]};
export function choosePursuit(memory:PursuitMemory,learn:PreviewLearning,view:VisualLayout,rows:NativeRows,available:Set<string>,
  attempts:Record<string,number>={},inspect?:(terrain:PursuitTerrain)=>void,
  refutedHere:Readonly<Record<string,string>>={}):PursuitChoice|null {
  let best:{score:number;choice:PursuitChoice}|undefined;
  for(const r of Object.values(memory.pairs)){
    const subject=view[r.actor],targets=view[r.peer],motion=learn.partMotion?.[r.actor];
    if(!motion||subject?.length!==1||!targets?.length||r.away<3||r.away<4*r.toward||r.responses.length<2)continue;
    // A push can look like escape. Give the experiment selector the turn when
    // all observed displacements required contact and separated copies stayed put.
    const shifts=r.samples.filter(s=>!same(s.peer,s.next));
    const atContact=(s:Sample)=>distance(s.actor,s.peer)<r.pitch/2;
    if(new Set(shifts.map(s=>s.peer.join())).size>=2 && shifts.every(atContact) &&
        r.samples.some(s=>!atContact(s)&&same(s.peer,s.next)))continue;
    const a=subject[0]!.at,pitch=r.pitch,step:XY=[pitch,pitch],motors=Object.entries(motion.displacements??motion.axes).flatMap(([op,options])=>{
      const values=Object.values(options);return available.has(op)&&/^ACTION[1-4]$/.test(op)&&values.length===1&&size(values[0]!.d)===pitch?[{op,d:values[0]!.d}]:[];
    });
    if(new Set(motors.map(m=>m.d.join())).size<2)continue;
    const occupied=new Set([a,...targets.map(t=>aligned(t.at,a,step))].map(p=>p.join()));
    const sites=new Set([...Object.keys(motion.sites),...r.sites].map(p=>aligned(p.split(',').map(Number) as XY,a,step).join()));
    const color=(p:XY)=>rows[Math.floor(p[1]/2)]?.[Math.floor(p[0]/2)];
    const palette=new Map<number,number>();
    for(const s of sites){if(occupied.has(s))continue;const c=color(s.split(',').map(Number) as XY);if(c!==undefined)palette.set(c,(palette.get(c)??0)+1);}
    if(!palette.size)continue;
    const floor=[...palette].sort((a,b)=>b[1]-a[1])[0]![0];
    const full=cardinals(pitch),open=[a],seen=new Set([a.join()]);
    for(let i=0;i<open.length&&open.length<=192;i++)for(const d of full){
      const p=add(open[i]!,d),k=p.join();if(seen.has(k)||p[0]<0||p[1]<0||p[1]>=rows.length*2||p[0]>=rows[0]!.length*2)continue;
      if(!occupied.has(k)&&!sites.has(k)&&color(p)!==floor)continue;
      seen.add(k);open.push(p);
    }
    inspect?.({actor:r.actor,peer:r.peer,from:a,targets:targets.map(t=>aligned(t.at,a,step)),pitch,floor,known:sites,reachable:open,motors});
    if(open.length>192)continue;
    const g=graph(open,motors.map(m=>m.d),full),ai=g.indices.get(a.join())!,n=g.cells.length,fit=fitResponse(g,r,a);
    for(const target of targets){
      const b=aligned(target.at,a,step),bi=g.indices.get(b.join());if(bi===undefined||ai===bi)continue;
      for(const motor of motors){
        if(refutedHere[motor.op])continue;
        const to=add(a,motor.d),di=g.indices.get(to.join());if(di===undefined)continue;
        const replies=[bi,...g.peerEdges[bi]!.filter(q=>distance(to,g.cells[q]!)>distance(to,b))];
        const worst=replies.map(q=>g.worst[di*n+q]!);
        let horizon=1,basis:PursuitChoice['basis']='all_measured_escape_directions',chosenReplies=replies;
        if(di!==bi){
          if(worst.every(Boolean))horizon=1+Math.max(...worst);
          else {
            g.best??=captureRanks(g.cells,g.actorEdges,g.peerEdges,false);
            const possible=replies.map(q=>g.best![di*n+q]!).filter(Boolean);if(!possible.length)continue;
            horizon=1+Math.min(...possible);basis='one_possible_response';
          }
          if(fit){
            const response=fit.predicted[di*n+bi]!,steps=fit.ranks[di*n+response]!;
            if(steps&&(basis==='one_possible_response'||steps+3<horizon)){horizon=1+steps;basis='calibrated_response';chosenReplies=[response];}
          }
        }
        const count=attempts[[r.actor,r.peer,a,b,motor.op].join('/')]??0;
        const score=(basis==='one_possible_response'?70:basis==='calibrated_response'?2:0)+horizon+Math.min(8,count)*(basis==='one_possible_response'?6:0.1);
        if(!best||score<best.score)best={score,choice:{actor:r.actor,peer:r.peer,from:a,to,target:b,input:motor.op,horizon,
          peerOptions:di===bi?[]:chosenReplies.map(q=>g.cells[q]!),refs:[...r.refs,...Object.values(refutedHere)],basis}};
      }
    }
  }
  return best?.choice??null;
}
