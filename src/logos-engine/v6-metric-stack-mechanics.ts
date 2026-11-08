/** Native called closure of V5 metric_stack_image. Each function computes a
 * supplied conditional model; no game state or action authority is available.
 * Source: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 */
import { symbolicDigest } from './v6-hash.ts';
import { supportCompare, supportSame } from './v6-support-measurements.ts';
type R=Record<string,any>;
const copy=<T>(v:T):T=>structuredClone(v);
const mapping=(v:any):v is R=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export const metricPrimitive=(v:R):R=>({primitive_ref:v.primitive_ref,kind:v.kind,cell_ref:null,occurrence_ref:null,destination_ref:null,...v});
export const metricLaw=(v:R):R=>({cycle_order:[],acceptance_checkpoint:null,empty_color_ref:null,...v});
export const metricStackState=(v:R):R=>({physical_selection_ref:null,inventory_complete_evidence_ref:null,...v});
export function metricIdentity(obs:R,operation:string):R{return{request_ref:'metric:'+obs.observation_ref+':'+operation,kernel_ref:'mechanics.metric_stack_image',operation_ref:'mechanics.metric_stack_image.'+operation,mode:'EVALUATE',caller_ref:'common_metric_composition',parent_contribution_ref:'G_official_completion',epoch:obs.level_epoch,input_revision_ref:obs.observation_ref,model_assignments:{scope:'conditional_current_visible_metric_model'},immutable_inputs:{observation_ref:obs.observation_ref},actual_bounds:{nodes:4096,outputs:128,time_ms:60000},expected_return_type:'MetricStackCalculation',requested_domain_ref:null};}
export function metricRequest(v:R):R{return{schema_version:'yf_arc3_v5.metric_stack_request.v1',evidence_refs:[],state:null,law:null,boundaries:[],query_points:[],control_samples:[],target:null,demands:[],placements:[],buffer_cell_refs:[],needed_occurrence_refs:[],primitive:null,sealed_samples:[],sealed_packet_ref:null,declared_restoration:null,restoration_contract_ref:null,external_ownership:null,witness_cost:null,witness_primitives:[],execution_scope_ref:null,execution_primitive_kinds:[],target_domain_complete_evidence_ref:null,resume_frontier:{},schedule_scope:null,schedule_allowed_destination_refs:null,schedule_restriction_evidence_ref:null,...v};}
export function metricPacketFingerprint(request:R):string{const{resume_frontier:_,...body}=copy(metricRequest(request));delete body.identity.immutable_inputs.metric_packet_fingerprint;return symbolicDigest(body);}

class MetricWork{
  readonly request:R;readonly limit:number;readonly outputLimit:number;readonly started=performance.now();readonly timeLimit:number;
  readonly priorCount:number;readonly priorNs:number;readonly invalidResume:boolean;count=0;hit=false;
  constructor(request:R){this.request=request;this.limit=request.identity.actual_bounds.nodes;this.outputLimit=request.identity.actual_bounds.outputs;this.timeLimit=request.identity.actual_bounds.time_ms*1e6;
    const stored=request.resume_frontier.work??{},valid=mapping(stored),retained=valid?stored:{},priorCount=retained.node_visits??0,priorNs=retained.elapsed_ns??0;
    this.invalidResume=Object.keys(request.resume_frontier).length>0&&(!valid||request.resume_frontier.packet_fingerprint!==metricPacketFingerprint(request)||!Number.isInteger(priorCount)||priorCount<0||priorCount>this.limit||!Number.isInteger(priorNs)||priorNs<0);
    this.priorCount=this.invalidResume?0:priorCount;this.priorNs=this.invalidResume?0:priorNs;
  }
  elapsed():number{return this.priorNs+Math.max(0,Math.floor((performance.now()-this.started)*1e6));}
  timeAvailable():boolean{if(this.invalidResume||this.elapsed()>=this.timeLimit){this.hit=true;return false;}return true;}
  visit():boolean{if(!this.timeAvailable()||this.priorCount+this.count>=this.limit){this.hit=true;return false;}this.count++;return true;}
}
function result(request:R,work:MetricWork,values:R,options:R={}):R{
  work.timeAvailable();const unknown=options.unknown??[],contradiction=!!options.contradiction||work.invalidResume,pending=options.pending??0,domainSize=options.domain_size??null,domainExamined=options.domain_examined??null;
  if(work.hit&&'closure_complete'in values)values={...values,closure_complete:false};
  const frontier={...(options.frontier??{}),packet_fingerprint:metricPacketFingerprint(request),work:{node_visits:work.priorCount+work.count,elapsed_ns:work.elapsed()}};
  values={...values,actual_node_visits:work.count,actual_total_node_visits:work.priorCount+work.count,declared_time_ms:request.identity.actual_bounds.time_ms,time_bound_enforced:true,resume_identity_invalid:work.invalidResume};
  return{schema_version:'yf_arc3_v5.metric_stack_calculation.v1',request_identity:request.identity,values,
    facts:{has_missing_observation:unknown.length>0,model_contradiction:contradiction,bound_reached:work.hit,empty_complete_domain:domainSize!==null&&domainSize===domainExamined&&!pending&&!work.hit&&!unknown.length&&!contradiction&&!(values.candidates?.length),missing_observation_refs:unknown},
    examined_count:domainExamined??work.count,declared_domain_size:domainSize,pending_count:pending,retained_frontier:frontier,retained_alternative_refs:(options.alternatives??[]).slice(0,128)};
}

export function fitMetricStackControl(input:R):R{
  const request=metricRequest(input),work=new MetricWork(request),retained=request.resume_frontier;let cursor=retained.next_sample??0;
  const evidence=[...(retained.evidence_refs??[])],displacements=[...(retained.observed_displacements??[])],cyclePairs=[...(retained.observed_cycle_pairs??[])],compatible=new Set<string>(retained.dimension_hypotheses??['CELL_SUPPORT','RIGID','INDEPENDENT_DEFORMATION']);
  let topOnly=retained.top_only_consistent??true,buried=retained.buried_selection_observed??false;
  if(work.invalidResume||!Number.isInteger(cursor)||cursor<0||cursor>request.control_samples.length||evidence.length!==cursor||displacements.length!==cursor||[...compatible].some(v=>!['CELL_SUPPORT','RIGID','INDEPENDENT_DEFORMATION'].includes(v))||typeof topOnly!=='boolean'||typeof buried!=='boolean')return result(request,work,{resume_mismatch:true},{contradiction:true});
  for(const sample of request.control_samples.slice(cursor)){if(!work.visit())break;const before=sample.dimensions_before,after=sample.dimensions_after;
    if(!supportSame(before,sample.support_before)||!supportSame(after,sample.support_after))compatible.delete('CELL_SUPPORT');if(!supportSame(before,after))compatible.delete('RIGID');
    if(sample.selection_accepted&&!sample.was_accessible_top){topOnly=false;buried=true;}
    evidence.push(sample.evidence_ref);displacements.push([sample.occurrence_ref,sample.position_after[0]-sample.position_before[0],sample.position_after[1]-sample.position_before[1]]);
    if(sample.input_kind==='CYCLE')cyclePairs.push([sample.physical_selection_before_ref,sample.physical_selection_after_ref,sample.selection_accepted]);cursor++;
  }
  const dimensions=[...compatible].sort();return result(request,work,{dimension_hypotheses:dimensions,observed_displacements:displacements,top_only_consistent:topOnly,buried_selection_observed:buried,cycling_is_unmeasured:cyclePairs.length===0,observed_cycle_pairs:cyclePairs,
    top_access_hypotheses:topOnly?['TOP_ONLY','BURIED_ACCESS_UNMEASURED']:['BURIED_ACCESS_OBSERVED'],evidence_refs:evidence,conditional_only:true},
    {pending:request.control_samples.length-cursor,frontier:{next_sample:cursor,dimension_hypotheses:dimensions,evidence_refs:evidence,observed_displacements:displacements,observed_cycle_pairs:cyclePairs,top_only_consistent:topOnly,buried_selection_observed:buried},alternatives:dimensions});
}

/** A common integer denominator keeps every cut exact; area uses BigInt. */
export function enumerateMetricTargetDomain(input:R):R{
  const request=metricRequest(input),work=new MetricWork(request),state=request.state,target=request.target,width=target.rows[0].length,height=target.rows.length;
  const choices=target.licensed_scales.flatMap((s:number[])=>target.licensed_anchors.map((a:number[])=>[s,a]));const start=Number(request.resume_frontier.cursor??0);
  if(Object.keys(request.resume_frontier).length&&request.resume_frontier.packet_fingerprint!==metricPacketFingerprint(request))return result(request,work,{resume_mismatch:true},{contradiction:true});
  const candidates:R[]=[];let cursor=start;
  for(let index=start;index<choices.length;index++){
    if(candidates.length>=work.outputLimit||!work.visit()){work.hit=true;break;}
    const[[n,d],[ax,ay]]=choices[index],axd=ax*d,ayd=ay*d,bx=axd+width*n,by=ayd+height*n,requirements:any[]=[];let valid=true,coveredArea=0n;
    for(const cell of state.cells){if(!work.visit()){valid=false;break;}const left=cell.left*d,top=cell.top*d,right=cell.right*d,bottom=cell.bottom*d,overlap=Math.max(left,axd)<Math.min(right,bx)&&Math.max(top,ayd)<Math.min(bottom,by);
      if(overlap&&!(left>=axd&&top>=ayd&&right<=bx&&bottom<=by)){valid=false;break;}const colors=new Set<string>();
      if(overlap){for(let y=0;y<height;y++){if(!work.visit()){valid=false;break;}if(Math.max(top,ayd+y*n)>=Math.min(bottom,ayd+(y+1)*n))continue;
          for(let x=0;x<width;x++){if(!work.visit()){valid=false;break;}if(Math.max(left,axd+x*n)<Math.min(right,axd+(x+1)*n))colors.add(target.rows[y][x]);}if(work.hit)break;
        }if(work.hit)break;coveredArea+=BigInt(cell.right-cell.left)*BigInt(cell.bottom-cell.top);
      }else colors.add(target.outside_color_ref);
      if(colors.size!==1){valid=false;break;}requirements.push([cell.cell_ref,[...colors][0]]);
    }
    if(work.hit)break;if(valid&&coveredArea*BigInt(d)*BigInt(d)===BigInt(width)*BigInt(height)*BigInt(n)*BigInt(n))candidates.push({scale:[n,d],anchor:[ax,ay],requirements,inventory_available:null,transport_accessible:null});cursor=index+1;
  }
  return result(request,work,{candidates,internal_background_preserved:true},{pending:choices.length-cursor,domain_size:start===0?choices.length:null,domain_examined:cursor-start,frontier:{cursor,packet_fingerprint:metricPacketFingerprint(request)}});
}

export function assignMetricOccurrences(input:R):R{
  const request=metricRequest(input),work=new MetricWork(request),state=request.state,occurrences:any[][]=[];
  state.cells.forEach((cell:R,i:number)=>state.stacks[i].forEach((o:R,depth:number)=>occurrences.push([o,cell.cell_ref,depth,state.stacks[i].length-depth-1])));
  const domains:number[][]=request.demands.map((d:R)=>occurrences.flatMap(([o],i)=>o.color_ref===d.color_ref?[i]:[]));let queue:number[][]=[[]];
  if(Object.keys(request.resume_frontier).length){if(request.resume_frontier.packet_fingerprint!==metricPacketFingerprint(request))return result(request,work,{resume_mismatch:true},{contradiction:true});
    queue=copy(request.resume_frontier.pending_assignments??[]);if(queue.length>8192||queue.some(row=>row.length>domains.length||new Set(row).size!==row.length||row.some((p,i)=>!Number.isInteger(p)||!domains[i]!.includes(p))))throw new TypeError('invalid bounded injective assignment resume frontier');
  }
  const candidates:R[][]=[];while(queue.length){if(candidates.length>=work.outputLimit||!work.visit()){work.hit=true;break;}const assignment=queue.pop()!;
    if(assignment.length===domains.length)candidates.push(assignment.map((p,i)=>({target_cell_ref:request.demands[i].cell_ref,occurrence_ref:occurrences[p]![0].occurrence_ref,source_cell_ref:occurrences[p]![1],covers_to_remove:occurrences[p]![3]})));
    else for(const provider of [...domains[assignment.length]!].reverse())if(!assignment.includes(provider))queue.push([...assignment,provider]);
  }
  const unknown=occurrences.filter(([o])=>o.color_ref==null).map(([o])=>o.occurrence_ref);if(state.inventory_complete_evidence_ref==null)unknown.push('unknown_hidden_inventory');
  const owner=new Map<number,number>();const augment=(index:number,seen:Set<number>):boolean=>{for(const provider of domains[index]!){if(!work.visit())return false;if(seen.has(provider))continue;seen.add(provider);if(!owner.has(provider)||augment(owner.get(provider)!,seen)){owner.set(provider,index);return true;}}return false;};
  let matched=0;for(let i=0;i<domains.length;i++)if(augment(i,new Set()))matched++;
  return result(request,work,{candidates,compatible_provider_domains:domains,known_inventory_deficit:work.hit?null:domains.length-matched,total_inventory_deficit:unknown.length||work.hit?null:domains.length-matched,interchangeable_providers_retained:true,
    surplus_occurrence_refs:occurrences.filter(([o])=>request.demands.every((d:R)=>o.color_ref!==d.color_ref)).map(([o])=>o.occurrence_ref)},
    {unknown,pending:queue.length,frontier:{pending_assignments:queue,packet_fingerprint:metricPacketFingerprint(request)}});
}

export function deriveMetricExposureDependencies(input:R):R{
  const request=metricRequest(input),work=new MetricWork(request),state=request.state,retained=request.resume_frontier.exposure??{};
  if(!mapping(retained))return result(request,work,{resume_mismatch:true},{contradiction:true});
  let phase=retained.phase??'INVENTORY',cellCursor=retained.cell_cursor??0,depthCursor=retained.depth_cursor??0,requiredCursor=retained.next_required_occurrence??0,coverCursor=retained.cover_cursor??0,placementCursor=retained.placement_cursor??0,requiredStarted=retained.required_started??false;
  const locations:R=copy(retained.locations??{}),dependencies:R[]=copy(retained.and_or_dependencies??[]),buffers:R[]=copy(retained.buffer_reservations??[]),unknown:string[]=[...(retained.unknown_refs??[])],cycles:string[]=[...(retained.cycle_node_refs??[])];
  let cycleCursor=retained.cycle_cursor??0,cycleStarted=retained.cycle_started??false,cyclePending:string[]=[...(retained.cycle_pending??[])],cycleSeen=new Set<string>(retained.cycle_seen??[]),bufferCursor=retained.buffer_cursor??0;
  const invalidBuffers:string[]=[...(retained.invalid_buffer_refs??[])],required:string[]=[...new Set<string>([...request.needed_occurrence_refs,...request.placements.map((p:R)=>p.occurrence_ref)])];
  const cursors=[cellCursor,depthCursor,requiredCursor,coverCursor,placementCursor,cycleCursor,bufferCursor];
  if(work.invalidResume||!['INVENTORY','DEPENDENCIES','CYCLES','BUFFERS','COMPLETE'].includes(phase)||cursors.some(x=>!Number.isInteger(x)||x<0)||cellCursor>state.cells.length||requiredCursor>required.length||placementCursor>request.placements.length||bufferCursor>request.buffer_cell_refs.length||typeof requiredStarted!=='boolean'||typeof cycleStarted!=='boolean')return result(request,work,{resume_mismatch:true},{contradiction:true});
  while(phase==='INVENTORY'&&cellCursor<state.cells.length){const stack=state.stacks[cellCursor];if(depthCursor>stack.length)return result(request,work,{resume_mismatch:true},{contradiction:true});if(!work.visit())break;
    if(depthCursor<stack.length){locations[stack[depthCursor].occurrence_ref]=[cellCursor,depthCursor];depthCursor++;}else{cellCursor++;depthCursor=0;}
  }
  if(phase==='INVENTORY'&&cellCursor===state.cells.length)phase='DEPENDENCIES';
  while(phase==='DEPENDENCIES'&&requiredCursor<required.length){const ref=required[requiredCursor]!;
    if(!requiredStarted){if(!work.visit())break;if(!(ref in locations)){unknown.push(ref);requiredCursor++;continue;}requiredStarted=true;}
    const[sourceIndex,depth]=locations[ref],cellRef=state.cells[sourceIndex].cell_ref,above=state.stacks[sourceIndex].slice(depth+1).reverse().map((o:R)=>o.occurrence_ref);
    if(coverCursor>above.length)return result(request,work,{resume_mismatch:true},{contradiction:true});
    while(coverCursor<above.length){if(!work.visit())break;const cover=above[coverCursor];dependencies.push({kind:'AND',consumer:'expose:'+ref,need:'remove:'+cover,source_cell_ref:cellRef});if(coverCursor)dependencies.push({kind:'AND',consumer:'remove:'+cover,need:'remove:'+above[coverCursor-1]});
      buffers.push({occurrence_ref:cover,provider_kind:'OR',licensed_buffer_cell_refs:request.buffer_cell_refs.filter((x:string)=>x!==cellRef),restoration_required:true});coverCursor++;
    }
    if(work.hit)break;while(placementCursor<request.placements.length){if(!work.visit())break;const placement=request.placements[placementCursor];if(placement.target_cell_ref===cellRef&&placement.occurrence_ref!==ref)dependencies.push({kind:'AND',consumer:'close:'+cellRef,need:'extract:'+ref});placementCursor++;}
    if(work.hit)break;requiredCursor++;coverCursor=0;placementCursor=0;requiredStarted=false;
  }
  if(phase==='DEPENDENCIES'&&requiredCursor===required.length)phase='CYCLES';
  const edges=[...new Map(dependencies.map(d=>{const e=[d.consumer,d.need];return[JSON.stringify(e),e];})).values()].sort(supportCompare),nodes=[...new Set(edges.flat())].sort();
  if(cycleCursor>nodes.length)return result(request,work,{resume_mismatch:true},{contradiction:true});
  while(phase==='CYCLES'&&cycleCursor<nodes.length){const node=nodes[cycleCursor]!;if(!cycleStarted){cyclePending=edges.filter(e=>e[0]===node).map(e=>e[1]!);cycleSeen=new Set();cycleStarted=true;}
    while(cyclePending.length){if(!work.visit())break;const current=cyclePending.pop()!;if(current===node){cycles.push(node);cyclePending=[];break;}if(!cycleSeen.has(current)){cycleSeen.add(current);cyclePending.push(...edges.filter(e=>e[0]===current).map(e=>e[1]!));}}
    if(work.hit)break;cycleCursor++;cycleStarted=false;
  }
  if(phase==='CYCLES'&&cycleCursor===nodes.length)phase='BUFFERS';const cellRefs=new Set(state.cells.map((c:R)=>c.cell_ref));
  while(phase==='BUFFERS'&&bufferCursor<request.buffer_cell_refs.length){if(!work.visit())break;const ref=request.buffer_cell_refs[bufferCursor];if(!cellRefs.has(ref))invalidBuffers.push(ref);bufferCursor++;}
  if(phase==='BUFFERS'&&bufferCursor===request.buffer_cell_refs.length)phase='COMPLETE';
  const frontier={phase,cell_cursor:cellCursor,depth_cursor:depthCursor,locations,next_required_occurrence:requiredCursor,required_started:requiredStarted,cover_cursor:coverCursor,placement_cursor:placementCursor,and_or_dependencies:dependencies,buffer_reservations:buffers,unknown_refs:unknown,cycle_node_refs:cycles,cycle_cursor:cycleCursor,cycle_started:cycleStarted,cycle_pending:cyclePending,cycle_seen:[...cycleSeen].sort(),buffer_cursor:bufferCursor,invalid_buffer_refs:invalidBuffers};
  return result(request,work,{and_or_dependencies:dependencies,buffer_reservations:buffers,cycle_node_refs:cycles,invalid_buffer_refs:invalidBuffers,invented_size_order:false,dependency_phase:phase},{unknown:[...unknown,...invalidBuffers],pending:phase==='COMPLETE'?0:Math.max(1,required.length-requiredCursor),frontier:{exposure:frontier}});
}

export function metricAdjacent(a:R,b:R):boolean{return((a.right===b.left||b.right===a.left)&&Math.max(a.top,b.top)<Math.min(a.bottom,b.bottom))||((a.bottom===b.top||b.bottom===a.top)&&Math.max(a.left,b.left)<Math.min(a.right,b.right));}
export function metricStackTransition(state:R,law:R,primitive:R):[R,any[],number,string|null]{
  const cells=new Map<string,number>(state.cells.map((c:R,i:number)=>[c.cell_ref,i])),stacks:R[][]=state.stacks.map((s:R[])=>[...s]);let selection=state.physical_selection_ref,cost=0,refusal:string|null=null;const effects:any[]=[];
  if(primitive.kind==='SELECT'){const index=cells.get(primitive.cell_ref);if(index===undefined||!stacks[index]!.length||stacks[index]!.at(-1)!.occurrence_ref!==primitive.occurrence_ref)refusal='selection_requires_the_current_named_top';else{selection=primitive.occurrence_ref;cost=law.select_cost;effects.push(['selection',selection]);}}
  else if(primitive.kind==='CYCLE'){if(law.access!=='CYCLE_TOPS'||!law.cycle_order.length||law.cycle_order.some((ref:string)=>!cells.has(ref)))refusal='missing_or_incompatible_selection_cycle';else{
    const tops=law.cycle_order.flatMap((ref:string)=>{const s=stacks[cells.get(ref)!]!;return s.length?[s.at(-1)!.occurrence_ref]:[];});if(tops.length){selection=tops.includes(selection)?tops[(tops.indexOf(selection)+1)%tops.length]:tops[0];cost=law.cycle_cost;effects.push(['selection',selection]);}else refusal='no_selectable_top';}}
  else if(primitive.kind==='TRANSFER'){const source=stacks.findIndex(s=>s.length>0&&s.at(-1)!.occurrence_ref===selection),destination=cells.get(primitive.destination_ref);
    if(source<0||selection!==primitive.occurrence_ref)refusal='transfer_requires_the_selected_accessible_top';else if(destination===undefined||source===destination)refusal='incompatible_destination';
    else if(!law.transfer_edges.some((e:string[])=>e[0]===state.cells[source].cell_ref&&e[1]===primitive.destination_ref))refusal='transfer_edge_is_not_licensed';
    else if(!metricAdjacent(state.cells[source],state.cells[destination]))refusal='declared_edge_is_not_metric_adjacent';else{const occurrence=stacks[source]!.pop()!;stacks[destination]!.push(occurrence);cost=law.transfer_cost;effects.push(['top_pop',occurrence.occurrence_ref],['adjacent_push',primitive.destination_ref],['support_rectangle',state.cells[destination]]);}}
  else refusal='reset_requires_the_independent_restoration_contract';
  return[{...state,stacks,physical_selection_ref:selection},effects,cost,refusal];
}
