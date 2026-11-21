import type { NativePoint, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { readTravelGrid, type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';

type Law = 'translate' | 'follow' | 'push' | 'pull';
const laws: Law[] = ['translate', 'follow', 'push', 'pull'];
type Cells = ReturnType<typeof readTravelGrid>['cells'];
type Pair = { body: string; position: string; laws: Law[]; refs: string[] };
export type PairMemory = { pair?: Pair; attempted: string[]; focus?: {site:string;body:string} };
export const newPairMemory = (): PairMemory => ({ attempted: [] });
export type PairExperiment = { input: string; actor: string; peer: string; destinations: Partial<Record<Law,string>>;
  refs: string[]; context: string; target?: string; targetBody?: string };
const point = (site: string) => site.split(',').map(Number) as [number,number];
function move(site:string, delta:NativePoint, sign=1) {
  const [x,y]=point(site);
  return [x+sign*delta[0],y+sign*delta[1]].join(',');
}
function locations(cells:Cells, body:string) {
  return [...cells].filter(([,pixels])=>pixels.join(',')===body).map(([key])=>key);
}
function predict(law:Law, actor:string, peer:string, delta:NativePoint) {
  switch(law) {
    case 'translate': return move(peer,delta);
    case 'follow': return actor;
    case 'push': return move(actor,delta)===peer ? move(peer,delta) : peer;
    case 'pull': return move(actor,delta,-1)===peer ? actor : peer;
  }
}
function trackPeer(body:string, origin:string, before:Cells, after:Cells) {
  const previous=locations(before,body), next=locations(after,body);
  if(!previous.includes(origin) || previous.length!==next.length ||
      previous.some(p=>p!==origin && !next.includes(p)))return;
  return next.includes(origin) ? origin : next.find(p=>!previous.includes(p));
}

// One conserved token moves with the controlled object. Preserve every
// explanation consistent with the observation until their predictions differ.
export function observePair(memory:PairMemory, previous:ObservedTravel|undefined, current:ObservedTravel|undefined,
    beforeRows:NativeRows, afterRows:NativeRows, input:string, ref:string, trial?:PairExperiment) {
  if(trial && !memory.attempted.includes(trial.context)) memory.attempted.push(trial.context);
  if(trial?.target && trial.targetBody)memory.focus={site:trial.target,body:trial.targetBody};
  if(!previous?.actor || !current?.actor || previous.grid.ink!==current.grid.ink ||
     previous.grid.pitch!==current.grid.pitch) { delete memory.pair; return; }
  const actor=previous.actor, delta=current.moves[input]?.delta;
  if(!delta || move(actor,delta)!==current.actor) {
    if(beforeRows!==afterRows && memory.pair){
      const cells=readTravelGrid(afterRows,current.grid).cells;
      if(cells.get(memory.pair.position)?.join(',')!==memory.pair.body)delete memory.pair;
    }
    return;
  }
  const before=readTravelGrid(beforeRows,previous.grid).cells, after=readTravelGrid(afterRows,current.grid).cells;
  if(memory.pair) {
    const {body,position,laws:remaining,refs}=memory.pair;
    const actual=trackPeer(body,position,before,after);
    const surviving=remaining.filter(law=>predict(law,actor,position,delta)===actual);
    if(actual && surviving.length) {
      memory.pair={body,position:actual,laws:surviving,refs:surviving.length<remaining.length?[refs[0]!,ref]:refs};
      return;
    }
    delete memory.pair;
  }
  for(const sign of [-1,1]){
    const position=move(actor,delta,sign), pixels=before.get(position);
    if(!pixels || new Set(pixels).size<2)continue;
    const body=pixels.join(','), actual=trackPeer(body,position,before,after);
    if(!actual || actual===position)continue;
    const surviving=laws.filter(law=>predict(law,actor,position,delta)===actual);
    if(surviving.length) {memory.pair={body,position:actual,laws:surviving,refs:[ref]};return;}
  }
}

export function choosePairExperiment(m:PairMemory, travel:ObservedTravel|undefined, rows:NativeRows):PairExperiment|null {
  const pair=m.pair;
  if(!pair || pair.laws.length<2 || !travel?.actor)return null;
  const actor=travel.actor, cells=readTravelGrid(rows,travel.grid).cells;
  if(cells.get(pair.position)?.join(',')!==pair.body)return null;
  let best:PairExperiment|null=null, bestScore=0;
  for(const [input,{delta,ref}] of Object.entries(travel.moves)){
    const destination=move(actor,delta), ground=cells.get(destination);
    if(!ground)continue;
    const destinations=Object.fromEntries(pair.laws.map(law=>[law,predict(law,actor,pair.position,delta)]));
    const outcomes=new Set(Object.values(destinations));
    const context=[actor,pair.position,pair.body,pair.laws.join(),input,ground.join()].join('/');
    if(outcomes.size<2 || m.attempted.includes(context) || [...outcomes].some(p=>!cells.has(p)))continue;
    const score=outcomes.size*3+Number(travel.supports.includes(ground.join(',')) || travel.visited.includes(destination));
    if(score>bestScore){
      bestScore=score;best={input,actor,peer:pair.position,destinations,refs:[...pair.refs,ref],context};
    }
  }
  return best;
}

// Enumerate first contacts. Only use a novel surface on the final move of
// a route. Intermediate positions require public evidence of support.
export function pairContacts(m:PairMemory, travel:ObservedTravel|undefined, rows:NativeRows):PairExperiment[] {
  const pair=m.pair;
  if(!pair || pair.laws.length!==1 || !travel?.actor)return [];
  const law=pair.laws[0]!, actor=travel.actor, cells=readTravelGrid(rows,travel.grid).cells;
  if(cells.get(pair.position)?.join(',')!==pair.body)return [];
  const counts=new Map<string,number>(), actorPattern=cells.get(actor)?.join(',');
  for(const tile of cells.values())counts.set(tile.join(','),(counts.get(tile.join(','))??0)+1);
  const support=new Set(travel.supports), walk=new Set(travel.visited);
  walk.add(actor);walk.add(pair.position);
  const targets=new Map<string,string>();
  for(const [site,tile] of cells){
    const stamp=tile.join(',');
    if(support.has(stamp)||tile.every(v=>v===travel.grid.floor))walk.add(site);
    if(stamp!==pair.body && stamp!==actorPattern && !tile.every(v=>v===travel.grid.floor) &&
        counts.get(stamp)!<=3)targets.set(site,stamp);
    if(travel.grid.annotatedMarks?.[site] && site!==actor && site!==pair.position)targets.set(site,stamp);
  }
  if(m.focus?.site===actor && actor!==pair.position)targets.set(actor,m.focus.body);
  if(!targets.size)return [];
  const queue=[{actor,peer:pair.position,first:'',depth:0}],seen=new Set([actor+'/'+pair.position]);
  const found=new Map<string,PairExperiment>();
  for(let i=0;i<queue.length && i<2048;i++){
    const state=queue[i]!;
    for(const [input,{delta}] of Object.entries(travel.moves)){
      const to=move(state.actor,delta), nextPeer=predict(law,state.actor,state.peer,delta);
      if(to===nextPeer || !cells.has(to) || !cells.has(nextPeer))continue;
      const first=state.first||input, targetBody=targets.get(nextPeer);
      if(nextPeer!==state.peer && targetBody && walk.has(to) && !found.has(nextPeer)){
        const context=['contact',actor,pair.position,pair.body,law,nextPeer,targetBody,first].join('/');
        if(!m.attempted.includes(context)){
          found.set(nextPeer,{input:first,actor,peer:pair.position,
            destinations:{[law]:predict(law,actor,pair.position,travel.moves[first]!.delta)},
            refs:[...pair.refs,travel.moves[first]!.ref],context,target:nextPeer,targetBody});
        }
      }
      const key=to+'/'+nextPeer;
      const preparingFollow=law==='follow' && targets.has(to);
      if(state.depth<18 && (walk.has(to)||preparingFollow) && walk.has(nextPeer) && !seen.has(key)){
        seen.add(key);queue.push({actor:to,peer:nextPeer,first,depth:state.depth+1});
      }
    }
  }
  return [...found.values()];
}
