import type {NativeRows} from '../logos-engine/v6-native-types.ts';
import {neighbor,poseId,readTransport,sitePoint,tileUniform,transportState,type TransportMemory,type TransportSide,
  type TransportState,type TransportStep,type TransportForecast} from './transport-observations.ts';

const ordered=(values:number[])=>values.sort((a,b)=>a-b);
const other=(side:TransportSide):TransportSide=>side===0?1:0;
const sortedReplacement=(pieces:number[],from:number,to:number)=>ordered(pieces.map(p=>p===from?to:p));
type Node={state:TransportState;cost:number;rank:number;parent?:Node;side?:TransportSide;op?:string};
function enqueue(queue:Node[],n:Node){
  let left=0,right=queue.length;
  while(left<right){const mid=(left+right)>>>1;if(queue[mid]!.rank>n.rank)left=mid+1;else right=mid;}
  queue.splice(left,0,n);
}
function marks(tiles:string[],floor:string){
  const groups=new Map<string,number[]>(),ground=floor.split(',')[0];
  for(const [i,tile] of tiles.entries()){
    const t=tile.split(','),mid=Math.floor(t.length/2);
    if(t[0]===ground||t[mid]!==ground||t.some((v,j)=>j!==mid&&v!==t[0]))continue;
    const group=groups.get(tile)??[];group.push(i);groups.set(tile,group);
  }
  const pairs=[...groups.values()].filter(v=>v.length===2);
  return pairs.length===1?pairs[0]:undefined;
}
export function chooseTransport(m:TransportMemory,rows:NativeRows,depth:number,limit:number,stageRegions=true):TransportForecast|undefined{
  const swap=m.swap;if(!swap||!m.verified.every(Boolean)||Object.keys(m.motors).length!==4)return;
  if(m.push&&(swap.side===m.push.side||swap.piece!==m.push.piece))return;
  const view=readTransport(m,rows),initial=view&&transportState(m,view);if(!view||!initial||!initial.pieces.length)return;
  const floor=m.push?.floor??swap.floor,goals=m.goals??marks(view.tiles,floor);
  if(!goals)return;m.goals=goals;
  const evidence=[m.selection,swap.ref,...Object.values(m.motors).map(o=>o.ref),...(m.push?[m.push.ref]:[]),...(m.supportRef?[m.supportRef]:[])];
  const uncertain=[...(!m.push?['contact_can_displace_the_aligned_piece']:[]),...(!m.push?.support?['piece_can_make_a_new_support']:[]),
    ...(!m.supportRef?['subject_can_use_the_changed_surface']:[]),...(!m.partnerExchange?['other_subject_can_also_exchange']:[])];
  const offer=(s:TransportStep):TransportForecast=>({purpose:m.planReason??'prepare_access_to_both_marks',command:s.command,from:s.state,
    expected:s.after,target:goals,evidence:[...new Set(evidence)],open:uncertain,key:poseId(s.state)+'/'+s.command});
  const stored=m.plan?.[0];if(stored&&poseId(stored.state)===poseId(initial)&&!m.denied[poseId(initial)+'/'+stored.command])return offer(stored);
  delete m.plan;
  const {grid}=m,walk=new Set(view.tiles.flatMap((v,i)=>v===floor?[i]:[]));
  for(const site of [...initial.subjects,...initial.pieces,...goals,...initial.supports])walk.add(site);
  const motors=Object.entries(m.motors),adjacent=(p:number,d:{dx:number;dy:number})=>neighbor(grid,p,d.dx,d.dy);
  const distance=(a:number,b:number)=>Math.abs(a%grid.columns-b%grid.columns)+Math.abs(Math.floor(a/grid.columns)-Math.floor(b/grid.columns));
  const core=new Set(goals),flood=[...goals];
  for(const p of flood)for(const [,d] of motors){const q=adjacent(p,d);if(walk.has(q)&&!core.has(q)){core.add(q);flood.push(q);}}
  const gaps:{hole:number;piece:number;behind:number}[]=[];
  for(const to of core)for(const [,d] of motors){
    const hole=adjacent(to,d);if(hole<0||walk.has(hole)||!tileUniform(view.tiles[hole]!)||m.push?.material&&view.tiles[hole]!==m.push.material)continue;
    const piece=adjacent(hole,d),behind=piece>=0?adjacent(piece,d):-1;
    if(walk.has(piece)&&!core.has(piece)&&walk.has(behind))gaps.push({hole,piece,behind});
  }
  const preparedGaps=gaps.filter(g=>initial.pieces.includes(g.piece));
  const shoreGoals=stageRegions&&preparedGaps.length?preparedGaps:gaps;
  const shores=new Set(gaps.map(t=>t.hole)),materials=new Set(gaps.map(t=>view.tiles[t.hole]!));
  if(m.push?.material)materials.add(m.push.material);
  const swapper=swap.side,pusher=other(swapper),[left,right]=goals as [number,number];
  const initiallyConnected=initial.subjects.some(p=>core.has(p));
  // Backward from the push site, price a handoff from each shore. A hypothetical
  // walk can ignore movable pieces here; the forward search still checks every move.
  const walks=new Map<number,Map<number,number>>();
  function walking(from:number){
    let known=walks.get(from);if(known)return known;
    const sites=[from];known=new Map([[from,0]]);
    for(const p of sites)for(const [,d] of motors){
      const to=adjacent(p,d);if(!walk.has(to)||known.has(to))continue;
      known.set(to,known.get(p)!+1);sites.push(to);
    }
    walks.set(from,known);return known;
  }
  const aligned=(a:number,b:number)=>a%grid.columns===b%grid.columns||Math.floor(a/grid.columns)===Math.floor(b/grid.columns);
  const regions:Map<number,number>[]=[];
  const regionOf=new Map<number,number>();
  for(const p of walk)if(!regionOf.has(p)){
    const sites=walking(p);for(const site of sites.keys())regionOf.set(site,regions.length);
    regions.push(sites);
  }
  const regionDistance=new Map<number,number>(),nearer:number[]=[];
  for(const g of shoreGoals){const id=regionOf.get(g.behind)!;if(!regionDistance.has(id)){regionDistance.set(id,0);nearer.push(id);}}
  for(const id of nearer)for(const [j,region] of regions.entries()){
    if(regionDistance.has(j))continue;
    if([...region.keys()].some(a=>[...regions[id]!.keys()].some(b=>aligned(a,b)))){
      regionDistance.set(j,regionDistance.get(id)!+1);nearer.push(j);
    }
  }
  const separation=(p:number)=>regionDistance.get(regionOf.get(p)!)??Infinity;
  const startSeparation=separation(initial.subjects[pusher]);
  const staging=stageRegions&&!initiallyConnected&&Number.isFinite(startSeparation)&&startSeparation>0;
  const nextRegions=nearer.filter(id=>regionDistance.get(id)===startSeparation-1);
  function handoffCost(s:TransportState,goal:number){
    const from=s.subjects[pusher],partner=s.subjects[swapper],local=walking(from);
    if(local.has(goal))return local.get(goal)!;
    const shore=walking(goal),otherWalk=walking(partner),landings=new Map<number,number>();
    if(shore.has(partner))landings.set(partner,0);
    else for(const token of s.pieces){
      if(!shore.has(token))continue;
      let least=Infinity;
      for(const [launch,steps] of otherWalk)if(aligned(launch,token))least=Math.min(least,steps+1);
      if(Number.isFinite(least))landings.set(token,least);
    }
    let cost=Infinity;
    for(const [landing,access] of landings)for(const [opposite,finish] of shore){
      const approach=walking(landing).get(opposite)!;
      for(const [origin,steps] of local)if(aligned(origin,opposite))cost=Math.min(cost,access+approach+steps+1+finish);
    }
    return Number.isFinite(cost)?cost:4+distance(from,goal)+0.5*distance(partner,goal);
  }
  function rank(s:TransportState){
    const [a,b]=s.subjects,targets=Math.min(distance(a,left)+distance(b,right),distance(a,right)+distance(b,left));
    if(!targets)return 0;
    if(!gaps.length||initiallyConnected||s.supports.some(p=>shores.has(p)))return 2+targets;
    if(!s.pieces.length)return Infinity;
    if(staging){
      let approach=Infinity;
      for(const region of nextRegions){
        // Any landing on the nearer shore establishes the next capability.
        const representative=regions[region]!.keys().next().value!;
        approach=Math.min(approach,handoffCost(s,representative));
      }
      const lost=preparedGaps.length&&!preparedGaps.some(g=>s.pieces.includes(g.piece));
      return 18+approach+Number(Boolean(lost))*walk.size;
    }
    let nearest=Infinity;
    for(const g of shoreGoals){
      const approach=stageRegions?handoffCost(s,g.behind):distance(s.subjects[pusher],g.behind);
      const material=Math.min(...s.pieces.map(p=>distance(p,g.piece)));
      nearest=Math.min(nearest,3*material+approach+0.16*distance(s.subjects[swapper],g.behind));
    }
    return 18+nearest+0.1*targets;
  }
  const click=(s:TransportState,side:TransportSide)=>'ACTION6:'+sitePoint(grid,s.subjects[side]).join(',');
  const root:Node={state:initial,cost:0,rank:0},queue=[root],visited=new Map([[poseId(initial),0]]);
  let best=root,bestEstimate=rank(initial);
  for(let expanded=0;queue.length&&expanded<limit;expanded++){
    const n=queue.pop()!,s=n.state;
    if(n.cost!==visited.get(poseId(s)))continue;
    const estimate=rank(s);
    if(estimate<bestEstimate){best=n;bestEstimate=estimate;}
    const reachedShore=staging&&separation(s.subjects[pusher])<startSeparation&&
      (!preparedGaps.length||preparedGaps.some(g=>s.pieces.includes(g.piece)));
    if(!estimate||reachedShore||stageRegions&&!initiallyConnected&&s.supports.some(p=>shores.has(p))){best=n;bestEstimate=estimate;break;}
    if(n.cost>=depth)continue;
    const canStand=(p:number)=>walk.has(p)||s.supports.includes(p);
    for(const side of [pusher,swapper]){
      const guard=other(side),start=s.subjects[side],parked=s.subjects[guard],selected=side===s.active?s:{...s,active:side};
      if(side!==s.active&&m.denied[poseId(s)+'/'+click(s,side)])continue;
      for(const [op,d] of motors){
        if(m.denied[poseId(selected)+'/'+op])continue;
        let to=adjacent(start,d);if(to<0)continue;
        let pieces=s.pieces,supports=s.supports,peer=parked;
        if(side===pusher){
          if(to===parked)continue;
          if(pieces.includes(to)){
            const ahead=adjacent(to,d);if(ahead<0||ahead===parked||pieces.includes(ahead))continue;
            if(canStand(ahead))pieces=sortedReplacement(pieces,to,ahead);
            else if(shores.has(ahead)){pieces=pieces.filter(p=>p!==to);supports=ordered([...supports,ahead]);}
            else continue;
          }else if(!canStand(to))continue;
        }else{
          let hit=-1;
          for(let q=to;q>=0;q=adjacent(q,d)){
            if(q===parked||pieces.includes(q)){hit=q;break;}
            if(!canStand(q)&&!materials.has(view.tiles[q]!))break;
          }
          if(hit>=0){to=hit;if(to===parked)peer=start;else pieces=sortedReplacement(pieces,to,start);}
          else if(!canStand(to))continue;
        }
        const subjects:[number,number]=side===0?[to,peer]:[peer,to],state={subjects,pieces,supports,active:side};
        const cost=n.cost+1+Number(side!==s.active),key=poseId(state);
        if(cost>depth||cost>=(visited.get(key)??Infinity))continue;
        visited.set(key,cost);enqueue(queue,{state,cost,rank:cost+4.5*rank(state),parent:n,side,op});
      }
    }
  }
  if(best===root)return;
  const path:TransportStep[]=[];
  for(let n=best;n.parent;n=n.parent){
    const before=n.parent.state,side=n.side!,selected=side===before.active?before:{...before,active:side};
    path.push({state:selected,command:n.op!,after:n.state});
    if(side!==before.active)path.push({state:before,command:click(before,side),after:selected});
  }
  m.planReason=bestEstimate===0?'prepare_access_to_both_marks':staging?'move_the_pushing_subject_to_a_nearer_region':
    stageRegions&&best.state.supports.some(p=>shores.has(p))?'create_a_support_between_regions':'test_a_placement_that_opens_access';
  m.plan=path.reverse();return offer(m.plan[0]!);
}
