import {existsSync,readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {mock} from 'node:test';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {hydrateNativeState} from './src/logos-engine/v6-native-state-graph.ts';
import {defaultRecoveryPack} from './src/sic/active-recovery.ts';
import {defaultBrowserFamilyAgenda} from './src/sic/family-agenda.ts';
const audit=existsSync(new URL('./sonde.mjs',import.meta.url))?await import('./sonde.mjs'):null;
const root=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
mock.method(Date,'now',()=>1700000000000);
const runtime=await createNativeV6Runtime({common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')},
  {now:()=>0,recovery:{...defaultRecoveryPack,familyAgenda:defaultBrowserFamilyAgenda}});
const service=new V6AgentService(()=>runtime);
let seq=0,sessionId,ticket,issuedNeed;
for await(const line of createInterface({input:process.stdin})){
  const m=JSON.parse(line);
  sessionId??=m.sessionId;
  let res=await service.handle({sessionId,sequence:seq,observation:m.observation,...(seq?
    {type:'advance',ticketId:ticket.id,executionMs:0}:{type:'init',budgets:m.budgets,recovery:defaultRecoveryPack})});
  const graph=runtime.inspectKnowledge(),get=k=>graph.nodes[k] && hydrateNativeState(graph.nodes[k].value,id=>graph.nodes[id]?.value);
  const transition=seq?get('reasoning:transition:'+seq):null,acq=transition?.caller_acquisition;
  const measure=acq?.information_goal_result,point=acq?.point_experiment_result;
  const ret=res.snapshot.trace.findLast(e=>e.kind==='sic_information_return');
  const need=issuedNeed && get(issuedNeed);
  while(res.kind==='boundary')res=await service.handle({type:'resume',sessionId,sequence:seq});
  const p=res.snapshot.proposal,trace=res.snapshot.trace,plan=trace.findLast(e=>e.kind==='sic_native_plan');
  const id=p?.sic_information_decision,q=p?.question?.curiosity;
  const before=ticket;ticket=res.ticket;issuedNeed=id?.need.id;
  const guard=trace.findLast(e=>e.kind==='before_guard' && e.index===ticket?.actionIndex);
  console.log(JSON.stringify({ticket,command:res.command,family:plan?.family,strategy:plan?.strategy,kind:p?.kind,guard:guard?.admitted,
    selection:id?{objective:id.objective,need:id.need,predictions:q.predictions,revision:q.observation_ref,evidence:q.evidence,
      admissibles:id.evidence.admissibleOffers,pairs:p.question.experiment?.new_contrast_pairs}:null,
    returned:!seq?null:{ticket:before?.id,observation:measure?.observation_ref,value:measure?.measured,checks:measure?.hypothesis_checks,
      supportChanged:point?.record?.observed_local_change,newPairs:point?.compared_pairs,proof:point?.record?.after_ref,
      objective:measure?ret?.objective:null,evidence:measure?ret?.evidence:null,need:measure && need?{id:need.id,status:need.status}:null,
      transition:transition?{before:transition.before,after:transition.after,command:transition.command}:null},
    ...(audit?{diagnostic:audit.drain()}:{} )}));
  seq++;
}
