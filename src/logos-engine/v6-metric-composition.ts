/** Native common_metric_composition.py: measured irregular partitions, exact
 * rational raster targets, retained top occurrences and conditional transport.
 */
import frontierPolicy from './v6/frontier-policy.json' with { type:'json' };
import { ObservedInputDomain, v6Canonical } from './v6-native-observer.ts';
import { symbolicDigest } from './v6-hash.ts';
import { ControlDependencies } from './v6-transition-learning.ts';
import { supportParts, supportCompare, supportSame } from './v6-support-measurements.ts';
import { metricIdentity,metricRequest,metricStackState,metricLaw,metricPrimitive,metricStackTransition,
  enumerateMetricTargetDomain,fitMetricStackControl,assignMetricOccurrences,deriveMetricExposureDependencies } from './v6-metric-stack-mechanics.ts';
import type { NativeFamily,NativeRows,NativeExecution,NativeBeforeResult,NativeAfterResult,NativeRecordResult,NativeRecord,NativeObservation } from './v6-native-types.ts';
type R=Record<string,any>;
type RouteItem=[R,R,R,R];
export const METRIC_EMPTY='unoccupied_metric_support';
const clone=<T>(v:T):T=>structuredClone(v);
const frequency=(values:readonly any[]):[any,number][]=>{const counts=new Map<any,number>();for(const v of values)counts.set(v,(counts.get(v)??0)+1);return[...counts].sort((a,b)=>b[1]-a[1]);};
const gcd=(a:number,b:number):number=>{while(b)[a,b]=[b,a%b];return a;};
const ratio=(n:number,d:number):number[]=>{const g=gcd(n,d);return[n/g,d/g];};

/** CPython integer-set table order is observable in connected-group tie breaks.
 * Only nonnegative component indices are needed here; no hashed strings enter.
 */
export class MetricIntegerSet implements Iterable<number>{
  private table:(number|null|undefined)[]=Array(8).fill(null);private used=0;private fill=0;private finger=0;
  constructor(values:Iterable<number>=[]){for(const v of values)this.add(v);}
  get size():number{return this.used;}
  *[Symbol.iterator]():IterableIterator<number>{for(const v of this.table)if(v!=null)yield v;}
  private locate(value:number,insertion:boolean):number{const mask=this.table.length-1;let perturb=value,index=value&mask,free=-1;
    for(;;){const probes=index+9<=mask?9:0;for(let n=0;n<=probes;n++){const at=index+n,v=this.table[at];if(v===null)return insertion&&free>=0?free:at;if(v===undefined){if(insertion)free=at;}else if(v===value)return at;}
      perturb=Math.floor(perturb/32);index=(index*5+1+perturb)&mask;}
  }
  private resize(minimum:number):void{let size=8;while(size<=minimum)size*=2;const old=this.table;this.table=Array(size).fill(null);this.fill=this.used;for(const v of old)if(v!=null)this.table[this.locate(v,true)]=v;}
  add(value:number):void{if(!Number.isSafeInteger(value)||value<0||value>0x7fffffff)throw new TypeError('Metric component index must be a nonnegative bounded integer');const at=this.locate(value,true),prior=this.table[at];if(prior!=null)return;this.table[at]=value;this.used++;if(prior===undefined)return;this.fill++;if(this.fill*5>=(this.table.length-1)*3)this.resize(this.used>50000?this.used*2:this.used*4);}
  has(value:number):boolean{return this.table[this.locate(value,false)]!=null;}
  delete(value:number):void{const at=this.locate(value,false);if(this.table[at]!=null){this.table[at]=undefined;this.used--;}}
  pop():number{if(!this.used)throw new RangeError('empty metric component set');let i=this.finger&(this.table.length-1);while(this.table[i]==null)i=(i+1)&(this.table.length-1);const value=this.table[i]!;this.table[i]=undefined;this.used--;this.finger=i+1;return value;}
  intersection(other:MetricIntegerSet):MetricIntegerSet{const iterate=other.size>this.size?this:other,lookup=iterate===this?other:this,out=new MetricIntegerSet();for(const v of iterate)if(lookup.has(v))out.add(v);return out;}
}
const componentGroups=(size:number,adj:Map<number,MetricIntegerSet>):number[][]=>{const remaining=new MetricIntegerSet(Array.from({length:size},(_,i)=>i)),groups:number[][]=[];
  while(remaining.size){const todo=[remaining.pop()],group:number[]=[];while(todo.length){const i=todo.pop()!;group.push(i);for(const j of (adj.get(i)??new MetricIntegerSet()).intersection(remaining)){remaining.delete(j);todo.push(j);}}groups.push(group);}return groups;};
const addEdge=(adj:Map<number,MetricIntegerSet>,i:number,j:number):void=>{const a=adj.get(i)??new MetricIntegerSet(),b=adj.get(j)??new MetricIntegerSet();a.add(j);b.add(i);adj.set(i,a);adj.set(j,b);};

export function measuredMetricScene(rows:NativeRows):R|null{
  const rects=supportParts(rows).filter(c=>Math.min(c.bbox.width,c.bbox.height)>1&&c.area===c.bbox.width*c.bbox.height),boxes=rects.map(c=>[c.bbox.left,c.bbox.top,c.bbox.right+1,c.bbox.bottom+1]),adj=new Map<number,MetricIntegerSet>();
  for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++){const a=boxes[i]!,b=boxes[j]!;
    if(((a[2]===b[0]||b[2]===a[0])&&Math.max(a[1]!,b[1]!)<Math.min(a[3]!,b[3]!))||((a[3]===b[1]||b[3]===a[1])&&Math.max(a[0]!,b[0]!)<Math.min(a[2]!,b[2]!)))addEdge(adj,i,j);
  }
  const groups=componentGroups(rects.length,adj);if(!groups.length)return null;const group=[...groups].sort((a,b)=>b.length-a.length)[0]!;if(group.length<9)return null;
  const xs=[...new Set(group.flatMap(i=>[boxes[i]![0]!,boxes[i]![2]!]))].sort((a,b)=>a-b),ys=[...new Set(group.flatMap(i=>[boxes[i]![1]!,boxes[i]![3]!]))].sort((a,b)=>a-b);
  if((xs.length-1)*(ys.length-1)>64||Math.min(xs.length,ys.length)<3||group.length<Math.floor((xs.length-1)*(ys.length-1)/2))return null;
  const background=frequency(group.map(i=>rects[i]!.value)).slice(0,2).map(([v])=>v);if(background.length!==2)return null;
  const fills:string[]=[],selected:number[]=[],cells:number[][]=[];
  for(let y=0;y<ys.length-1;y++)for(let x=0;x<xs.length-1;x++){
    const top=ys[y]!,bottom=ys[y+1]!,left=xs[x]!,right=xs[x+1]!;cells.push([left,top,right,bottom]);const inside:number[]=[],whole:number[]=[],border:number[]=[];
    for(let r=top;r<bottom;r++)for(let c=left;c<right;c++){const v=rows[r]![c]!;whole.push(v);if(r>top&&r<bottom-1&&c>left&&c<right-1)inside.push(v);if(r===top||r===bottom-1||c===left||c===right-1)border.push(v);}
    const color=frequency(inside.length?inside:whole)[0]![0];fills.push(background.includes(color)?METRIC_EMPTY:String(color));if(!background.includes(color)&&new Set(border).size===1&&border[0]!==color)selected.push(cells.length-1);
  }
  if(selected.length>1)return null;const colors=new Set(fills.filter(c=>c!==METRIC_EMPTY));if(colors.size<2)return null;
  let outside=rects.filter(c=>!(xs[0]!<=c.bbox.left&&c.bbox.right<xs.at(-1)!&&ys[0]!<=c.bbox.top&&c.bbox.bottom<ys.at(-1)!)&&colors.has(String(c.value)));if(new Set(outside.map(c=>String(c.value))).size<2)return null;
  const collectionEdges=new Map<number,MetricIntegerSet>();for(let i=0;i<outside.length;i++)for(let j=0;j<i;j++){
    const a=outside[i]!.bbox,b=outside[j]!.bbox,gapx=Math.max(a.left-b.right-1,b.left-a.right-1,0),gapy=Math.max(a.top-b.bottom-1,b.top-a.bottom-1,0);
    if(Math.max(gapx,gapy)<=Math.max(Math.min(a.width,a.height),Math.min(b.width,b.height)))addEdge(collectionEdges,i,j);
  }
  const best=componentGroups(outside.length,collectionEdges).filter(m=>new Set(m.map(i=>outside[i]!.value)).size>=2);if(best.length!==1)return null;outside=best[0]!.map(i=>outside[i]!);
  const l=Math.min(...outside.map(c=>c.bbox.left)),t=Math.min(...outside.map(c=>c.bbox.top)),r=Math.max(...outside.map(c=>c.bbox.right))+1,b=Math.max(...outside.map(c=>c.bbox.bottom))+1;if(Math.max(r-l,b-t)>32)return null;
  const target=Array.from({length:b-t},(_,y)=>Array.from({length:r-l},(_,x)=>colors.has(String(rows[t+y]![l+x]))?String(rows[t+y]![l+x]):METRIC_EMPTY)),legend=outside.map(c=>[c.value,c.bbox.width,c.bbox.height]);
  return{cells,xs,ys,fills,selected:selected[0]??null,background,target,legend,grid_ref:symbolicDigest([xs,ys]),target_ref:symbolicDigest(target)};
}
export function measuredMetricState(scene:R,obs:R,suppliedStacks:readonly R[][]|null=null):R{
  const cells=scene.cells.map((b:number[],i:number)=>({cell_ref:String(i),left:b[0],top:b[1],right:b[2],bottom:b[3]})),stacks=suppliedStacks??scene.fills.map((c:string,i:number)=>c===METRIC_EMPTY?[]:[{occurrence_ref:'visible:'+i,color_ref:c}]);
  const selected=scene.selected!==null&&stacks[scene.selected]?.length?stacks[scene.selected].at(-1).occurrence_ref:null;
  return metricStackState({state_revision_ref:obs.observation_ref,grid_revision_ref:scene.grid_ref,cells,stacks,physical_selection_ref:selected});
}
export function metricTargetCandidates(scene:R,obs:R,state:R):R[]{
  const xs:number[]=scene.xs,ys:number[]=scene.ys,width=scene.target[0].length,height=scene.target.length,xratios=new Map<string,number[]>(),yratios=new Map<string,number[]>();
  for(const[,w,h]of scene.legend){for(let i=1;i<xs.length;i++){const r=ratio(xs[i]!-xs[i-1]!,w);xratios.set(r.join('/'),r);}for(let i=1;i<ys.length;i++){const r=ratio(ys[i]!-ys[i-1]!,h);yratios.set(r.join('/'),r);}}
  const ratios=[...xratios].filter(([k])=>yratios.has(k)).map(([,v])=>v).sort((a,b)=>a[0]!*b[1]!-b[0]!*a[1]!),found:R[]=[];
  for(const[n0,d0]of ratios){const n=n0!,d=d0!;if(n<=0)continue;const ax=xs.slice(0,-1).filter(x=>xs.some(b=>b*d===x*d+width*n)),ay=ys.slice(0,-1).filter(y=>ys.some(b=>b*d===y*d+height*n));
    for(const x of ax)for(const y of ay){const target={target_revision_ref:scene.target_ref,rows:scene.target,licensed_scales:[[n,d]],licensed_anchors:[[x,y]],outside_color_ref:METRIC_EMPTY},request=metricRequest({identity:metricIdentity(obs,'target_domain'),evidence_revision_ref:obs.observation_ref,evidence_refs:[obs.observation_ref],state,target}),r=enumerateMetricTargetDomain(request);
      if(!r.pending_count&&!r.facts.bound_reached)found.push(...clone(r.values.candidates));}
  }return found;
}
export const metricStateKey=(s:R):any[]=>[s.stacks.map((st:R[])=>st.map(o=>[o.occurrence_ref,o.color_ref])),s.physical_selection_ref];
export const metricVisible=(s:R):string[]=>s.stacks.map((st:R[])=>st.length?st.at(-1)!.color_ref:METRIC_EMPTY);
const edgeKey=(i:number,c:string):string=>i+':'+c;

export function composeMetricVisibleObligations(state:R,target:R,scene:R,obs:R,law:R,edges:Map<string,number>,directions:R,remaining:number):any[][]{
  const demands=target.requirements.filter(([,c]:string[])=>c!==METRIC_EMPTY).map(([cell_ref,color_ref]:string[])=>({cell_ref,color_ref})),request=metricRequest({identity:metricIdentity(obs,'occurrence_assignment'),evidence_revision_ref:obs.observation_ref,evidence_refs:[obs.observation_ref],state,demands});
  const assigned=assignMetricOccurrences(request),surplus=new Set<string>(assigned.values.surplus_occurrence_refs??[]);if(!surplus.size||assigned.pending_count||assigned.facts.bound_reached)return[];
  const demanded=new Set(demands.map((d:R)=>d.cell_ref)),locations=new Map<string,string>();state.stacks.forEach((st:R[],i:number)=>st.forEach(o=>locations.set(o.occurrence_ref,String(i))));if([...surplus].some(o=>!demanded.has(locations.get(o))))return[];
  const offers:any[][]=[];
  for(const assignment of assigned.values.candidates){const placements=assignment.map((v:R)=>({occurrence_ref:v.occurrence_ref,target_cell_ref:v.target_cell_ref})),deps=deriveMetricExposureDependencies({...request,identity:metricIdentity(obs,'exposure_dependencies'),placements,needed_occurrence_refs:placements.map((v:R)=>v.occurrence_ref)});
    if(deps.pending_count||deps.facts.bound_reached||deps.values.cycle_node_refs.length)continue;const goals=new Map<string,number>(placements.map((v:R)=>[v.occurrence_ref,Number(v.target_cell_ref)])),path:RouteItem[]=[];let current=state,failed=false;
    for(let unused=0;unused<goals.size;unused++){const positions=new Map<string,number>();current.stacks.forEach((st:R[],i:number)=>st.forEach(o=>positions.set(o.occurrence_ref,i)));
      const todo=[...goals].filter(([o,destination])=>positions.get(o)!==destination||current.stacks[destination].at(-1)?.occurrence_ref!==o).map(([o])=>o);if(!todo.length)break;const routes:any[][]=[];
      for(const occurrence of todo){const origin=positions.get(occurrence)!,destination=goals.get(occurrence)!;if(current.stacks[origin].at(-1).occurrence_ref!==occurrence)continue;const blockers=new Set([...goals.keys()].filter(o=>o!==occurrence).map(o=>positions.get(o)!));if(blockers.has(destination))continue;
        const queue:[number,[string,number][]][]=[[origin,[]]],seen=new Set([origin]);let head=0;while(head<queue.length){const[cell,route]=queue[head++]!;if(cell===destination){routes.push([route.length+Number(current.physical_selection_ref!==occurrence),occurrence,origin,route]);break;}
          for(const command of Object.keys(directions)){const following=edges.get(edgeKey(cell,command));if(following!==undefined&&!seen.has(following)&&!blockers.has(following)){seen.add(following);queue.push([following,[...route,[command,following]]]);}}
        }
      }
      if(!routes.length){failed=true;break;}routes.sort((a,b)=>supportCompare(a.slice(0,2),b.slice(0,2)));const[,occurrence,origin,route]=routes[0]!;
      if(current.physical_selection_ref!==occurrence){const primitive=metricPrimitive({primitive_ref:'select:'+origin,kind:'SELECT',cell_ref:String(origin),occurrence_ref:occurrence}),[following,,,refusal]=metricStackTransition(current,law,primitive);if(refusal){failed=true;break;}
        const b=scene.cells[origin],action={action_ref:'ACTION6',data:{x:Math.floor((b[0]+b[2]-1)/2),y:Math.floor((b[1]+b[3]-1)/2)}};path.push([action,primitive,current,following]);current=following;
      }
      for(const[command,destination]of route){const primitive=metricPrimitive({primitive_ref:command+':'+destination,kind:'TRANSFER',occurrence_ref:occurrence,destination_ref:String(destination)}),[following,,,refusal]=metricStackTransition(current,law,primitive);if(refusal){failed=true;break;}path.push([{action_ref:command},primitive,current,following]);current=following;}
      if(failed)break;
    }
    if(failed||path.length>remaining||!target.requirements.every(([i,c]:string[])=>metricVisible(current)[Number(i)]===c))continue;
    const proof={method:'visible_top_assignment_with_retained_underlayers',assignment:clone(assignment),surplus_preserved:[...surplus].sort(),dependencies:clone(deps.values),inventory_complete:false,reason:'Unrequired visible occurrences already occupy future target cells. Cover them with the assigned visible suppliers; no need to remove them. Each subroute preserves all other required occurrences.'};offers.push([path.length,target,path,assigned.examined_count+deps.examined_count,proof]);
  }return offers;
}
class MetricHeap{
  rows:any[][]=[];
  less(a:any[],b:any[]):boolean{return supportCompare(a.slice(0,3),b.slice(0,3))<0;}
  push(row:any[]):void{const a=this.rows;let i=a.length;a.push(row);while(i){const p=(i-1)>>1;if(!this.less(row,a[p]!))break;a[i]=a[p]!;i=p;}a[i]=row;}
  pop():any[]{const a=this.rows,out=a[0]!,last=a.pop()!;if(!a.length)return out;let i=0;while(2*i+1<a.length){let c=2*i+1;if(c+1<a.length&&this.less(a[c+1]!,a[c]!))c++;if(!this.less(a[c]!,last))break;a[i]=a[c]!;i=c;}a[i]=last;return out;}
}

export class MetricComposition implements NativeFamily<any>{
  readonly id='metric_composition';readonly policy:R;epoch:number|null=null;current:R|null=null;grid:string|null=null;evidence:string[]=[];questions=new ControlDependencies();control_samples:R[]=[];control_facts:R|null=null;events:R[]=[];scored_targets:string[]=[];directions:R={};attempted=new Set<string>();
  constructor(policy:R=frontierPolicy.metric_composition){this.policy=clone(policy);}
  reconcile(obs:R,rows:NativeRows):R|null{
    const scene=measuredMetricScene(rows);if(!scene)return null;if(this.epoch!==obs.level_epoch||this.grid!==scene.grid_ref){this.current=measuredMetricState(scene,obs);this.epoch=obs.level_epoch;this.grid=scene.grid_ref;}
    else{const stacks=scene.fills.map((color:string,i:number)=>{const old=this.current!.stacks[i];return color===METRIC_EMPTY?[]:old.length&&old.at(-1).color_ref===color?old:[{occurrence_ref:'observed:'+obs.observation_ref+':'+i,color_ref:color}];});this.current=measuredMetricState(scene,obs,stacks);}return scene;
  }
  record(before:R,after:R,command:R,_first:NativeRows,second:NativeRows,proposal?:R,index?:number,_frames?:readonly NativeRows[]):NativeRecordResult{
    this.events=[];if(proposal?.support_plan?.metric_composition){const p=proposal.support_plan,step=p.transitions[index!];
      if(after.levels_completed>before.levels_completed){this.scored_targets.push(p.target_ref);this.current=null;this.grid=null;this.epoch=after.level_epoch;return{status:'metric_official_boundary',events:[{kind:'metric_target_official_score',before:before.observation_ref,after:after.observation_ref}]};}
      const prior=clone(step.before),predicted=clone(step.after);this.current=predicted;this.epoch=after.level_epoch;this.grid=predicted.grid_revision_ref;const scene=this.reconcile(after,second);
      if(scene){this.attempted.add(p.question_key);this.evidence.push(after.observation_ref);const matched=supportSame(scene.fills,metricVisible(predicted));this.events=[{kind:'metric_control_response',before:before.observation_ref,after:after.observation_ref,expected_visible_matched:matched,primitive:clone(step.primitive),unknown_underlay_revealed:!matched}];
        if(matched&&step.primitive.kind==='TRANSFER'){const origin=prior.stacks.findIndex((st:R[])=>st.length>0&&st.at(-1)!.occurrence_ref===step.primitive.occurrence_ref),destination=Number(step.primitive.destination_ref),a=prior.cells[origin],b=prior.cells[destination],vector=[b.left-a.left,b.top-a.top];this.directions[command.action_ref]=vector.map(v=>Math.sign(v));
          this.control_samples.push({evidence_ref:after.observation_ref,evidence_revision_ref:after.observation_ref,occurrence_ref:step.primitive.occurrence_ref,input_kind:'TRANSFER',physical_selection_before_ref:prior.physical_selection_ref,physical_selection_after_ref:this.current!.physical_selection_ref,position_before:[a.left,a.top],position_after:[b.left,b.top],was_accessible_top:true,selection_accepted:true,dimensions_before:[a.right-a.left,a.bottom-a.top],dimensions_after:[b.right-b.left,b.bottom-b.top],support_before:[a.right-a.left,a.bottom-a.top],support_after:[b.right-b.left,b.bottom-b.top]});
          this.control_facts=clone(fitMetricStackControl(metricRequest({identity:metricIdentity(after,'control_fit'),evidence_revision_ref:after.observation_ref,control_samples:this.control_samples.slice(-128)})).values);
        }
      }return{status:'metric_observed',events:this.events};
    }return{status:'metric_not_owned',events:[]};
  }
  async propose(obs:R,rows:NativeRows,_inputs:readonly R[],remaining:number,execution?:NativeExecution):Promise<any|null>{
    if(!this.policy.enabled||!obs.available_action_refs.includes('ACTION6')||remaining<=0)return null;const scene=this.reconcile(obs,rows);if(!scene)return null;const state=this.current!,targets=metricTargetCandidates(scene,obs,state);if(!targets.length)return null;
    const cols=scene.xs.length-1,directions:R={...Object.fromEntries(Object.entries(this.policy.conditional_action_vectors).filter(([k])=>obs.available_action_refs.includes(k))),...this.directions},edges=new Map<string,number>();
    for(let i=0;i<state.cells.length;i++){const x=i%cols,y=Math.floor(i/cols);for(const[command,[dx,dy]]of Object.entries(directions) as [string,number[]][]){const xx=x+dx!,yy=y+dy!;if(xx>=0&&xx<cols&&yy>=0&&yy<scene.ys.length-1)edges.set(edgeKey(i,command),yy*cols+xx);}}
    const law=metricLaw({law_revision_ref:'conditional_metric_top_transfer',evidence_refs:(this.evidence.length?this.evidence:[obs.observation_ref]).slice(-32),access:'TOP_ONLY',dimension_rule:'CELL_SUPPORT',transfer_edges:[...edges].map(([key,j])=>[key.slice(0,key.indexOf(':')),String(j)]),select_cost:1,cycle_cost:1,transfer_cost:1,event_owner_ref:'current_external_command',acceptance_checkpoint:'AFTER_TRANSFER',empty_color_ref:METRIC_EMPTY});
    const inventory=new Map(frequency(state.stacks.flat().map((o:R)=>o.color_ref))),eligible=targets.filter(target=>frequency(target.requirements.filter(([,c]:string[])=>c!==METRIC_EMPTY).map(([,c]:string[])=>c)).every(([c,n])=>(inventory.get(c)??0)>=n));if(!eligible.length)return null;
    const heuristic=(s:R,requirements:Map<number,string>):number=>{let value=0;for(const[i,c]of requirements){if(c===METRIC_EMPTY||s.stacks[i]?.at(-1)?.color_ref===c)continue;const places=s.stacks.flatMap((st:R[],j:number)=>st.some(o=>o.color_ref===c)?[j]:[]);if(!places.length)return 9999;value+=Math.min(...places.map((j:number)=>Math.abs(i%cols-j%cols)+Math.abs(Math.floor(i/cols)-Math.floor(j/cols))));}return value;};
    const offers:any[][]=[],compositionProofs:R={};
    for(const target of eligible){const composed=composeMetricVisibleObligations(state,target,scene,obs,law,edges,directions,remaining);if(composed.length){for(const[cost,goal,path,examined,proof]of composed){offers.push([cost,goal,path,examined]);compositionProofs[symbolicDigest(goal)]=proof;}continue;}
      const requirements=new Map<number,string>(target.requirements.map(([i,c]:string[])=>[Number(i),c!])),queue=new MetricHeap();let serial=0,expanded=0;queue.push([heuristic(state,requirements),0,serial++,state,[]]);const best=new Map([[v6Canonical(metricStateKey(state)),0]]);
      while(queue.rows.length&&expanded<this.policy.search_states){const[,cost,,current,path]=queue.pop(),key=v6Canonical(metricStateKey(current));if(best.get(key)!==cost)continue;expanded++;
        if(execution&&expanded%64===0){execution.signal?.throwIfAborted();await execution.yieldControl();}
        if([...requirements].every(([i,c])=>metricVisible(current)[i]===c)){offers.push([cost,target,path,expanded]);break;}if(cost>=remaining)continue;
        for(let i=0;i<current.stacks.length;i++){const stack=current.stacks[i];if(!stack.length)continue;const occurrence=stack.at(-1).occurrence_ref;
          for(const command of Object.keys(directions)){const j=edges.get(edgeKey(i,command));if(j===undefined)continue;let working=current;const prefix:RouteItem[]=[];
            if(working.physical_selection_ref!==occurrence){const primitive=metricPrimitive({primitive_ref:'select:'+i,kind:'SELECT',cell_ref:String(i),occurrence_ref:occurrence}),[following,,,refusal]=metricStackTransition(working,law,primitive);if(refusal)continue;const b=scene.cells[i],action={action_ref:'ACTION6',data:{x:Math.floor((b[0]+b[2]-1)/2),y:Math.floor((b[1]+b[3]-1)/2)}};prefix.push([action,primitive,working,following]);working=following;}
            const primitive=metricPrimitive({primitive_ref:command+':'+j,kind:'TRANSFER',occurrence_ref:occurrence,destination_ref:String(j)}),[following,,,refusal]=metricStackTransition(working,law,primitive);if(refusal)continue;prefix.push([{action_ref:command},primitive,working,following]);const newcost=cost+prefix.length;if(newcost>remaining)continue;const nextkey=v6Canonical(metricStateKey(following));if(newcost>=(best.get(nextkey)??1e9))continue;best.set(nextkey,newcost);queue.push([newcost+heuristic(following,requirements),newcost,serial++,following,[...path,...prefix]]);
          }
        }
      }
    }
    if(!offers.length)return null;offers.sort((a,b)=>supportCompare([a[0],a[1].anchor],[b[0],b[1].anchor]));const[cost,target,path,expanded]=offers[0]!;if(!path.length)return null;const prefix:RouteItem[]=[];
    for(const item of path.slice(0,Math.min(16,remaining))){prefix.push(item);if(item[1].kind==='TRANSFER'&&!(item[0].action_ref in this.directions))break;}
    const why='Compose the measured irregular support rectangles into the small raster under one uniform scale. Reuse V5 metric target-domain and top-stack transition; selection must persist into its conditional transfer. Unknown command geometry or revealed underlay seals the prefix and revalidates the composition.';
    const question=await ControlDependencies.questionKey(obs.level_epoch,'metric_target_access',{grid:scene.grid_ref,target:scene.target_ref,state:metricStateKey(state),requirements:target.requirements},prefix[0]![0]),ref='C_metric_'+question.slice(0,16);if(this.attempted.has(question))return null;
    const transitions=prefix.map(([,p,a,b])=>({primitive:clone(p),before:clone(a),after:clone(b)})),actions=prefix.map(([command])=>command),steps:R[]=[];
    for(const[command,p,a,b]of prefix){const step:R={action:command,expected_before:{metric_visible:metricVisible(a),selection:a.physical_selection_ref},expected_after:{metric_visible:metricVisible(b),selection:b.physical_selection_ref}};
      if(command.data&&Object.keys(command.data).length)step.locus_witness=await ObservedInputDomain.makeLocusWitness(obs as NativeObservation,rows,[command.data.x,command.data.y],{reason:why,evidence:[obs.observation_ref]});steps.push(step);}
    const plan={metric_composition:true,frame_hash:obs.frame_hash,grid_ref:scene.grid_ref,target_ref:scene.target_ref,target,question_key:question,transitions,conditional_law:law,control_facts:this.control_facts,unknown_underlay:'empty_is_provisional_until_exposed',cut_reason:!(prefix.at(-1)![0].action_ref in this.directions)?'first_unmeasured_control_geometry':'bounded_conditional_target_route',search_expanded:expanded,complete_model_cost:cost,visible_obligations:compositionProofs[symbolicDigest(target)]??null};
    const facts={current_metric_partition_measured:true,uniform_raster_target_domain_calculated:true,conditional_top_transfer_model:true,current_selection_or_address_bound:true},proof=[obs.observation_ref,...this.evidence.slice(-8)];
    return{status:'proposed',kind:'metric_composition_access',support_plan:plan,steps,actions,facts,compositions:[{id:ref,role:'information_question',observed:false,open_question:why,properties:{target_status:'raster_hypothesis'},relations:['contributes_to:G_official_completion']}],question:{reason:why,hypothesis_refs:proof},route_refs:proof,binding:{observation_ref:obs.observation_ref,level_epoch:obs.level_epoch,levels_completed:obs.levels_completed},bundle_template:{operation_key:'OP18',composition_ref:ref,objective_ref:'G_official_completion',preserve_refs:[],purpose:why,preconditions:facts,evidence:proof,actions,frozen_support_plan:clone(plan),outcome_guard:{path:['value'],contains:ref}}};
  }
  bind(p:R):void{for(const step of p.steps)if(step.locus_witness)step.point_binding=step.locus_witness;}
  before(p:R,i:number,packet:R,_obs:R):NativeBeforeResult{
    const plan=p.support_plan,s=measuredMetricScene(packet.frame_rows),expected=plan.transitions[i].before,index=expected.stacks.findIndex((st:R[])=>st.length>0&&st.at(-1)!.occurrence_ref===expected.physical_selection_ref),selected=index<0?null:index;
    let ok=packet.level===p.binding.level_epoch&&packet.levels_completed===p.binding.levels_completed&&s!==null&&s.grid_ref===plan.grid_ref&&s.target_ref===plan.target_ref&&supportSame(s.fills,metricVisible(expected))&&s.selected===selected;if(i===0)ok=ok&&packet.frame_hash===plan.frame_hash;return{admitted:ok,reason:ok?'metric_target_selection_and_visible_support_bound':'metric_premise_changed'};
  }
  after(p:R,i:number,before:R,after:R,_first:NativeRows,second:NativeRows):NativeAfterResult{
    if(after.levels_completed>before.levels_completed)return{matched:true,seal_prefix:true,reason:'official_score'};const plan=p.support_plan,s=measuredMetricScene(second),expected=plan.transitions[i].after,index=expected.stacks.findIndex((st:R[])=>st.length>0&&st.at(-1)!.occurrence_ref===expected.physical_selection_ref),selected=index<0?null:index;
    const ok=s!==null&&s.grid_ref===plan.grid_ref&&s.target_ref===plan.target_ref&&supportSame(s.fills,metricVisible(expected))&&s.selected===selected;return{matched:ok,seal_prefix:!ok,reason:ok?'metric_predicted_visible_effect':'metric_effect_or_underlay_requires_reconciliation'};
  }
  state():NativeRecord{return clone({format:'metric_composition_state.v1',epoch:this.epoch,current:this.current,grid:this.grid,evidence:this.evidence,questions:{pending:this.questions.pending,attempted:[...this.questions.attempted].sort()},control_samples:this.control_samples,control_facts:this.control_facts,events:this.events,scored_targets:this.scored_targets,directions:this.directions,attempted:[...this.attempted].sort()});}
  restore(state:NativeRecord):void{const s=clone(state) as R,required=['format','epoch','current','grid','evidence','questions','control_samples','control_facts','events','scored_targets','directions','attempted'];
    if(s.format!=='metric_composition_state.v1'||!supportSame(Object.keys(s).sort(),required.sort())||!supportSame(Object.keys(s.questions).sort(),['attempted','pending']))throw new TypeError('Incomplete metric composition state contract');
    this.current=s.current;this.epoch=s.epoch;this.grid=s.grid;this.evidence=s.evidence;this.control_facts=s.control_facts;this.events=s.events;this.scored_targets=s.scored_targets;this.directions=s.directions;this.control_samples=s.control_samples;this.attempted=new Set(s.attempted);this.questions=new ControlDependencies();this.questions.pending=s.questions.pending;this.questions.attempted=new Set(s.questions.attempted);
  }
}
