import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {mock} from 'node:test';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
const root=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
mock.method(Date,'now',()=>1700000000000);
const runtime=await createNativeV6Runtime({common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')},{now:()=>0});
const service=new V6AgentService(()=>runtime);
let seq=0,sid,ticket;
for await(const line of createInterface({input:process.stdin})){
  const m=JSON.parse(line);sid??=m.sessionId;
  let r=await service.handle({sessionId:sid,sequence:seq,observation:m.observation,...(seq?
    {type:'advance',ticketId:ticket.id,executionMs:0}:{type:'init',budgets:m.budgets})});
  const past=ticket,ret=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
  while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId:sid,sequence:seq});
  const s=r.snapshot,p=s.proposal,plan=s.trace.findLast(e=>e.kind==='sic_native_plan'),guard=s.trace.findLast(e=>e.kind==='before_guard');
  const q=p?.question?.control_acquisition;
  ticket=r.ticket;
  console.log(JSON.stringify({ticket,command:r.command,kind:p?.kind,family:plan?.family,strategy:plan?.strategy,
    sub:plan?.subObjective??null,missing:plan?.missingControl?.id??null,guard:guard?.admitted,pair:p?.morphology?.measured_facts?.pair_ref,
    acquisition:q?{action:q.action_ref,experiment:q.experiment,origin:q.observation_ref,evidence:q.evidence,pair:q.pair_ref,motion:q.expected_motion}:null,
    ret:seq?{ticket:past.id,ref:ret?.observation_ref,matched:ret?.matched,plan:ret?.sic_plan}:null,
    ...(globalThis.offresRetirées?{retirées:globalThis.offresRetirées}:{})}));
  seq++;
}
