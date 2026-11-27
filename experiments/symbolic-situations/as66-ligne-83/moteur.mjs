import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {mock} from 'node:test';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {SlidingCavity} from './src/logos-engine/v6-sliding-cavity.ts';
const mode=process.argv[2];
const root=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
mock.method(Date,'now',()=>1700000000000);
let oldest,offre=null,memo=null;
const original=SlidingCavity.prototype.proposeDirectionQuestion,record=SlidingCavity.prototype.record;
SlidingCavity.prototype.record=function(...args){
  const result=record.apply(this,args);
  memo={directions:{...this.directions},clés:[...this.control_questions.attempted],méthode:this.scored.at(-1)?.method,
    événements:result.events?.filter(e=>e.local_delta).map(({before,after,local_delta})=>({before,after,local_delta}))};
  return result;
};
function résumé(p){return {ref:p.binding.observation_ref,clé:p.support_plan.question_key,commande:p.actions[0].action_ref,
  preuves:p.question.hypothesis_refs,position:p.support_plan.positions[0],géométrie:p.support_plan.static_digest};}
SlidingCavity.prototype.proposeDirectionQuestion=async function(...args){
  const [obs,rows]=args,fresh=await original.apply(this,args);
  if(!fresh)return fresh;
  let offer=fresh;
  if(obs.revision===6){
    oldest=fresh.binding.observation_ref;
    if(mode==='autre'){
      const order=this.policy.action_order.filter(k=>k!=='ACTION4');
      const alt=new SlidingCavity({sliding_cavity:{...this.policy,action_order:['ACTION4',...order]},
        cavity_binding_scope:this.scope_policy,cavity_clock_composition:this.clock_policy});
      alt.restore(this.state());offer=await original.apply(alt,args);
    }
  }
  if(mode==='périmée' && obs.revision===7){offer=structuredClone(fresh);offer.binding.observation_ref=oldest;}
  const guard=this.before(offer,0,{level:obs.level_epoch,levels_completed:obs.levels_completed,frame_rows:rows,frame_hash:obs.frame_hash},obs);
  offre={fraîche:résumé(fresh),présentée:résumé(offer),garde:guard.admitted};
  return offer;
};
const runtime=await createNativeV6Runtime({common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')},{now:()=>0});
const service=new V6AgentService(()=>runtime);
let seq=0,ticket;
for await(const line of createInterface({input:process.stdin})){
  const m=JSON.parse(line),sessionId=m.sessionId,previous=ticket;
  offre=null;memo=null;
  let r=await service.handle({sessionId,sequence:seq,observation:m.observation,...(seq?
    {type:'advance',ticketId:ticket.id,executionMs:0}:{type:'init',budgets:m.budgets})});
  const outcome=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
  while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:seq});
  const s=r.snapshot,p=s.proposal,release=s.trace.findLast(e=>e.kind==='sic_native_plan');
  ticket=r.ticket;
  console.log(JSON.stringify({état:r.kind,raison:s.reason,ticket,commande:r.command,kind:p?.kind,famille:ticket&&release?.family,
    besoin:ticket&&release?.missingControl?.id,objectif:ticket&&release?.subObjective,corps:p?.support_plan?.body_type,
    position:p?.support_plan?.positions?.[0],liaison:p?.support_plan?.role_rebinding,offre,memo,
    reçu:seq?{ticket:previous.id,ref:outcome?.observation_ref,matched:outcome?.matched}:null}));
  seq++;
}
