import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {mock} from 'node:test';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {LinkedTemporalPreparation} from './src/logos-engine/v6-linked-temporal-preparation.ts';
const seen=[];let live;
const previous=LinkedTemporalPreparation.prototype.recordSource;
LinkedTemporalPreparation.prototype.recordSource=function(...args){
  const events=previous.apply(this,args),[before,after]=args,c=this.phase.linked_contact;
  live=c;seen.push({before:before.observation_ref,after:after.observation_ref,pose:this.phase.states.at(-1)?.poses[c.body?.signature],
    vectors:[...c.vectors],comparison:events.filter(e=>e.kind==='linked_contact_effect')});return events;
};
mock.method(Date,'now',()=>1700000000000);
const source=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,source),'utf8'));
const runtime=await createNativeV6Runtime({common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')},{now:()=>0});
const service=new V6AgentService(()=>runtime);
let tid,sid,seq=0;
for await(const line of createInterface({input:process.stdin})){
  const m=JSON.parse(line);sid??=m.sid;
  let r=await service.handle({sessionId:sid,sequence:seq,observation:m.obs,...(seq?{type:'advance',ticketId:tid.id,executionMs:0}:{type:'init',budgets:m.budgets})});
  const out=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome'),old=tid;
  while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId:sid,sequence:seq});
  const p=r.snapshot.proposal,plan=p?.phase_plan,tr=r.snapshot.trace,native=tr.findLast(e=>e.kind==='sic_native_plan'),guard=tr.findLast(e=>e.kind==='before_guard');
  tid=r.ticket;const s=p?.steps?.[tid?.actionIndex];
  console.log(JSON.stringify({ticket:tid,command:r.command,family:native?.family,kind:p?.kind,missing:native?.missingControl?.id,
    guard:guard?.admitted,mode:plan?.mode,site:plan?.site,subject:plan?.primary,from:s?.from,to:s?.to,evidence:p?.question?.hypothesis_refs,
    support:live?.selected?.peer_support,events:seen.splice(0),ret:seq?{ticket:old.id,ref:out?.observation_ref,matched:out?.matched}:null,
    ...(globalThis.contactRetiré?{retiré:true}:{}),...(globalThis.trajetPreuve?{trajet:globalThis.trajetPreuve}:{})}));
  seq++;
}
