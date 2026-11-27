import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {mock} from 'node:test';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {FieldServiceMemory,fieldServiceBefore} from './src/logos-engine/v6-field-service-access.ts';
const root=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
mock.method(Date,'now',()=>1700000000000);
const mode=process.argv[2],selected=Number(process.argv[3]??0),methods={2:'offerEnvelopeFill',5:'offerFieldService',11:'offerFieldTransfer'};
let seq=0,ticket,withdrawn=null,proof=null,events=[];const refs=[];
const proto=FieldServiceMemory.prototype;
if(mode==='retrait'){
  const method=methods[selected],original=proto[method];
  if(typeof original!=='function')throw Error('Entrée de retrait absente');
  proto[method]=function(...args){
    const offer=original.apply(this,args);
    if(args[0].revision===selected && offer?.kind){withdrawn=offer.kind;return undefined;}
    return offer;
  };
}
const transferEvent=proto.transferEvent;
proto.transferEvent=function(model,...args){
  if(seq===10 && model?.official_boundary_witness && ['absente','altérée'].includes(mode)){
    model=structuredClone(model);const old=[...model.official_boundary_witness];
    if(mode==='absente')delete model.official_boundary_witness;
    else model.official_boundary_witness=[refs[selected],old[1]];
    proof={avant:old,après:model.official_boundary_witness??null};
  }
  return transferEvent.call(this,model,...args);
};
const record=proto.record;
proto.record=function(...a){
  const data=record.apply(this,a);
  for(const e of data){
    const c=e.context,trial=c?.attempted_controls?.at(-1);
    events.push({kind:e.kind,refs:e.evidence,phase:c?.phase,arrêt:e.stop_reason??null,restauré:c?.restored_measured_fields,
      répétable:c?.repeatable_extent_change,préservé:c?.field_contents_preserved,orientation:c?.paired_control_orientation_changed,
      opaque:c?.fields?.filter(f=>c.history?.some(h=>h[f.id]?.opaque_replacement)).map(f=>f.id),
      frontière:e.model?.official_boundary_witness,essai:trial&&{point:trial.point,de:trial.from,à:trial.to}});
  }
  return data;
};
const runtime=await createNativeV6Runtime({common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')},{now:()=>0});
const service=new V6AgentService(()=>runtime),sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
for await(const line of createInterface({input:process.stdin})){
  const {observation,budgets}=JSON.parse(line),past=ticket;events=[];withdrawn=null;proof=null;
  let r=await service.handle({sessionId,sequence:seq,observation,...(seq?{type:'advance',ticketId:past.id,executionMs:0}:{type:'init',budgets})});
  const outcome=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
  while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:seq});
  const s=r.snapshot,p=s.proposal,plan=p?.nested_control_plan,release=s.trace.findLast(e=>e.kind==='sic_native_plan'),guard=s.trace.findLast(e=>e.kind==='before_guard');
  ticket=r.ticket;if(ticket)refs.push(ticket.observationRef);
  const stale=ticket&&plan&&fieldServiceBefore(p,0,observation.frame,{epoch:plan.epoch,score:plan.score,available:['ACTION6'],observation_ref:'ancienne'}).admitted;
  console.log(JSON.stringify({ticket,état:r.kind,raison:s.reason,famille:ticket&&release?.family,type:ticket&&p?.kind,sousQuestion:ticket&&p?.field_subquestion,
    phase:ticket&&plan?.phase,point:ticket&&plan?.selected?.point,ref:ticket&&plan?.observation_ref,admis:ticket&&guard?.admitted,périmé:stale,
    preuves:ticket&&p?.question?.hypothesis_refs,withdrawn,proof,events,retour:seq?{ticket:past.id,ref:outcome?.observation_ref,matched:outcome?.matched,raison:outcome?.reason}:null}));
  seq++;
}
