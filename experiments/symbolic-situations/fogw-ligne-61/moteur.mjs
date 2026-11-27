import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {mock} from 'node:test';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {ReceptionServiceMemory} from './src/logos-engine/v6-reception-service-access.ts';
import {measureReceptionService,receptionServiceCarriers} from './src/logos-engine/v6-reception-service-observation.ts';
const root=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
mock.method(Date,'now',()=>1700000000000);
let seq=0,ticket,offre=false,dernièreScène=null,compte=null;
const record=ReceptionServiceMemory.prototype.record;
ReceptionServiceMemory.prototype.record=function(...args){
  const events=record.apply(this,args),event=events.at(-1);
  if(event){
    const m=event.memory,d=event.detail;
    compte={avant:d.before,après:d.after,dépensé:m.wait_spent,stationnaire:m.stationary?.ACTION4??null,
      delta:d.carrier_delta,sujetMesuré:m.scene?.counterparts?.[0]?.request_shape};
  }
  return events;
};
if(process.argv[2]==='unitaire'){
  const original=ReceptionServiceMemory.prototype.offerStationaryObservation;
  if(!original)throw Error('Point extrait absent');
  ReceptionServiceMemory.prototype.offerStationaryObservation=function(...args){
    const h=original.apply(this,args);
    if(seq===16 && h?.confirmed){offre=true;return {...h,confirmed:false};}
    return h;
  };
}
const runtime=await createNativeV6Runtime({common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')},{now:()=>0});
const service=new V6AgentService(()=>runtime);
for await(const line of createInterface({input:process.stdin})){
  const {sessionId,budgets,observation}=JSON.parse(line),past=ticket;
  compte=null;
  let r=await service.handle({sequence:seq,sessionId,observation,...(seq?{type:'advance',ticketId:past.id,executionMs:0}:{type:'init',budgets})});
  const outcome=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
  while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:seq});
  const s=r.snapshot,p=s.proposal,plan=p?.reception_service_plan;
  const release=s.trace.findLast(e=>e.kind==='sic_native_plan'),guard=s.trace.findLast(e=>e.kind==='before_guard');
  ticket=r.ticket;
  const scene=measureReceptionService(observation.frame,dernièreScène);
  dernièreScène=scene;
  console.log(JSON.stringify({ticket,état:r.kind,raison:s.reason,action:r.command?.actionRef,
    famille:ticket&&release?.family,kind:p?.kind,plan:plan?.kind,préparé:plan?.observation_ref,index:ticket?.actionIndex,
    taille:plan?.steps.length,confirmé:plan?.steps[ticket?.actionIndex]?.stationary_confirmed,autorisé:guard?.admitted,
    parent:p?.bundle_template?.objective_ref,contribution:p?.compositions?.[0]?.relations,sujet:plan?.scene.counterparts[0]?.request_shape,
    acteur:plan?.actor?.anchor,support:plan?.scene.target.anchor,attendu:plan?.steps[ticket?.actionIndex]?.to,
    sujetsVisibles:scene?.counterparts?.map(x=>({forme:x.request_shape,boîte:x.body_bbox})),porteurs:scene&&receptionServiceCarriers(observation.frame,scene).map(a=>a.anchor),
    offreRemplacée:offre,compte,reçu:seq?{ticket:past.id,ref:outcome?.observation_ref,matched:outcome?.matched,scellé:outcome?.seal_prefix,raison:outcome?.reason}:null}));
  seq++;
}
