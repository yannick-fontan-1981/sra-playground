import { existsSync,readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createNativeV6Runtime } from './src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from './src/runtime/v6-agent-service.ts';
import { hydrateNativeState } from './src/logos-engine/v6-native-state-graph.ts';
const root=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
if(existsSync(new URL('./sonder.mjs',import.meta.url))) await import('./sonder.mjs');
const runtime=await createNativeV6Runtime({common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')},{now:()=>0});
const service=new V6AgentService(()=>runtime),sessionId='public-logi';
let ticketId,sequence=0;
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  const m=JSON.parse(line),call=sequence?{type:'advance',ticketId,executionMs:0}:{type:'init',budgets:m.budgets};
  let result=await service.handle({...call,sessionId,sequence,observation:m.observation});
  const trace=result.snapshot.trace,ret=trace.findLast(e=>e.kind==='sic_information_return');
  let measured=null;
  if(sequence){
    const graph=runtime.inspectKnowledge(),node=graph.nodes['reasoning:transition:'+sequence];
    const transition=node && hydrateNativeState(node.value,id=>graph.nodes[id]?.value);
    const o=transition?.caller_acquisition?.information_goal_result;
    if(o) measured={value:o.measured,revision:o.observation_ref,checks:o.hypothesis_checks,objective:ret?.objective,evidence:ret?.evidence};
  }
  if(result.kind==='boundary') result=await service.handle({type:'resume',sessionId,sequence});
  const snap=result.snapshot,p=snap.proposal,d=p?.sic_information_decision,q=p?.question?.curiosity;
  const release=snap.trace.findLast(e=>e.kind==='sic_native_plan');
  const info=d && result.kind==='action'?{source:d.strategy,objective:d.objective.id,parent:d.objective.parent,
    need:d.need.id,kind:d.need.kind,admissibles:d.evidence.admissibleOffers,considered:d.considered,
    revision:q.observation_ref,evidence:q.evidence,predictions:q.predictions,engaged:q.engaged_parent,
    outcomes:q.distinct_outcomes,relations:q.relations,needEvidence:d.need.evidence,
    control:q.control_index,controls:q.controls,receivers:q.receivers,before:q.starting_values,lamps:q.receiver_values,
    family:release?.family,released:release?.subObjective}:null;
  console.log(JSON.stringify({command:result.command??null,kind:result.kind,info,measured,...(globalThis.takeElection?{elections:globalThis.takeElection()}:{})}));
  sequence++;ticketId=result.ticket?.id;
}
