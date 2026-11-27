import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createNativeV6Runtime } from './src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from './src/runtime/v6-agent-service.ts';
import { readNativeResolution } from './src/sic/native-resolution.ts';
import { hydrateNativeState } from './src/logos-engine/v6-native-state-graph.ts';
const base=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,base),'utf8'));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const sessionId='public-transfer',runtime=await createNativeV6Runtime(declarations,{now:()=>0});
const service=new V6AgentService(()=>runtime);
let sequence=0,ticketId;
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  const input=JSON.parse(line);
  const call=sequence?{type:'advance',ticketId,executionMs:0}:{type:'init',budgets:input.budgets};
  let result=await service.handle({...call,sessionId,sequence,observation:input.observation});
  const outcome=readNativeResolution({...result.snapshot,sessionId,sequence,phase:result.phase})?.outcome;
  if(result.kind==='boundary') result=await service.handle({type:'resume',sessionId,sequence});
  const snap=result.snapshot,proposal=snap.proposal,decision=proposal?.sic_view_decision;
  const release=snap.trace.findLast(t=>t.kind==='sic_native_plan'),guard=snap.trace.findLast(t=>t.kind==='before_guard');
  let view=null;
  if(result.kind==='action' && release?.family==='view' && decision) {
    const f=decision.situation.facts,d=proposal.view_plan.details;
    view={branch:release.strategy,authority:release.authority,need:decision.need.id,kind:decision.need.kind,
      parent:decision.objective.parent,objective:decision.objective.id,released:release.subObjective,
      revision:decision.situation.revision,obstruction:f.obstruction.value,repeated:f.repeated.value,
      refs:f.obstruction.evidence,attempts:d.stationary_trials,exclusive:d.exclusive_blocking_cause,
      priorPassage:d.previous_clear_entry,key:d.obstruction_key,
      admitted:guard?.admitted,guard:guard?.reason};
  }
  let event=null;
  if(sequence>=12) {
    const graph=runtime.inspectKnowledge(),node=graph.nodes['reasoning:transition:'+sequence];
    const record=node && hydrateNativeState(node.value,id=>graph.nodes[id]?.value)?.caller_acquisition?.view_result;
    if(record) event={from:record.source_ref,to:record.after_ref,offset:record.registration.offset,
      block:record.blockage_question??null,receipt:record.sic_view_return??null};
  }
  console.log(JSON.stringify({command:result.command??null,kind:result.kind,view,event,
    returned:outcome?{reason:outcome.reason,closure:outcome.viewOutcome??null}:null}));
  ticketId=result.ticket?.id;sequence++;
}
