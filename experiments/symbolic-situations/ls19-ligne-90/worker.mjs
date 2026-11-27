import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createNativeV6Runtime } from './src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from './src/runtime/v6-agent-service.ts';
import { readNativeResolution } from './src/sic/native-resolution.ts';

const root=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const sessionId='public-transfer';
const service=new V6AgentService(recovery=>createNativeV6Runtime(declarations,{recovery,now:()=>0}));
let ticketId,sequence=0;
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  const input=JSON.parse(line);
  const envelope=!sequence?{type:'init',sequence:0,budgets:input.budgets}:{type:'advance',sequence,ticketId,executionMs:0};
  let result=await service.handle({...envelope,sessionId,observation:input.observation});
  const state=r=>({...r.snapshot,sessionId,sequence,phase:r.phase});
  const returned=readNativeResolution(state(result))?.outcome;
  if(result.kind==='boundary') result=await service.handle({type:'resume',sessionId,sequence});
  const snap=result.snapshot, proposal=snap.proposal, decision=proposal?.sic_view_decision;
  const release=snap.trace.findLast(e=>e.kind==='sic_native_plan'), guard=snap.trace.findLast(e=>e.kind==='before_guard');
  const obs=decision?.situation.facts, details=proposal?.view_plan?.details;
  const view=release?.family==='view' && result.kind==='action';
  const selected=view?{strategy:release.strategy,authority:release.authority,need:decision?.need.id,
    kind:decision?.need.kind,parent:decision?.objective.parent,objective:decision?.objective.id,subObjective:release.subObjective,
    guard:guard?.reason,admitted:guard?.admitted,index:guard?.index,
    facts:obs && Object.fromEntries(Object.entries(obs).map(([k,f])=>[k,f.value])),
    gain:details?.conditional_new_viewport_pixels,vector:details?.access_vector,
    evidenceCount:decision?.need?.evidence?.length}:null;
  ticketId=result.ticket?.id;
  console.log(JSON.stringify({command:result.command??null,kind:result.kind,selected,
    returned:returned?{matched:returned.matched,reason:returned.reason,view:returned.viewOutcome??null}:null}));
  sequence++;
}
