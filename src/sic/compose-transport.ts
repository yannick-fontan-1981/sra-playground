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
export function chooseTransport(m:TransportMemory,rows:NativeRows,depth:number,limit:number):TransportForecast|undefined{
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
  const shores=new Set(gaps.map(t=>t.hole)),materials=new Set(gaps.map(t=>view.tiles[t.hole]!));
  if(m.push?.material)materials.add(m.push.material);
  const swapper=swap.side,pusher=other(swapper),[left,right]=goals as [number,number];
  const initiallyConnected=initial.subjects.some(p=>core.has(p));
  function rank(s:TransportState){
    const [a,b]=s.subjects,targets=Math.min(distance(a,left)+distance(b,right),distance(a,right)+distance(b,left));
    if(!targets)return 0;
    if(!gaps.length||initiallyConnected||s.supports.some(p=>shores.has(p)))return 2+targets;
    if(!s.pieces.length)return Infinity;
    let nearest=Infinity;for(const g of gaps)for(const p of s.pieces){
      const h=3*distance(p,g.piece)+distance(s.subjects[pusher],g.behind)+0.16*distance(s.subjects[swapper],g.behind);
      nearest=Math.min(nearest,h);
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
    if(!estimate)break;
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
  m.planReason=bestEstimate===0?'prepare_access_to_both_marks':'test_a_placement_that_opens_access';
  m.plan=path.reverse();return offer(m.plan[0]!);
}
