import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {mock} from 'node:test';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {NativeCallerCoordinator} from './src/logos-engine/v6-native-caller.ts';
import {ObservedFrontier} from './src/logos-engine/v6-observed-frontier.ts';
import {ViewFrontier} from './src/logos-engine/v6-view-frontier.ts';
const variant=process.argv[2],choice=Number(process.argv[3]??0);
const root=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
mock.method(Date,'now',()=>1700000000000);
let audit,inside=false,phase=null,searching=false,added=false;
globalThis.vueBord=revision=>{if(revision===14)audit.bord++;};
const caller=NativeCallerCoordinator.prototype,front=ObservedFrontier.prototype;
const continuity=caller.continuityOffer,has=ViewFrontier.prototype.hasObservedViewQuestion;
caller.continuityOffer=async function(obs,...args){
  if(obs.revision!==14)return continuity.call(this,obs,...args);
  inside=true;
  try{
    audit.vue={question:this.view&&has.call(this.view),arrêts:this.view?.block?.fail_count??0,clé:this.view?.block?.key??null,
      preuves:this.view?.continuityEvidence()??[]};
    return await continuity.call(this,obs,...args);
  }finally{inside=false;}
};
ViewFrontier.prototype.hasObservedViewQuestion=function(){
  return inside && variant==='sans-vue'?false:has.call(this);
};
const open=front.open,access=front.access,propose=front.propose;
front.open=async function(index,...args){
  const q=await open.call(this,index,...args);
  if(!phase)return q;
  const returned=variant==='sans-questions'?[]:q;
  if(!searching){phase.locales=returned.map(x=>[x.action.action_ref,x.question_ref]);phase.disponibles=q.length;}
  return returned;
};
front.access=async function(...args){
  if(!phase)return access.apply(this,args);
  searching=true;
  try{const [path,q]=await access.apply(this,args);phase.trajets.push({pas:path?.length??null,question:q?.question_ref??null});return [path,q];}
  finally{searching=false;}
};
front.propose=async function(obs,actions,options={}){
  if(obs.revision!==14 || !options.sic_agenda)return propose.call(this,obs,actions,options);
  const local={continuité:!!options.sic_view_continuity,locales:[],trajets:[]};
  if(local.continuité && !added && ['déjà-essayée','épuisement','une-restante'].includes(variant)){
    const {observation_index:index}=await this.observe(obs,actions);
    const qs=await open.call(this,index,'least_tried');audit.avant=qs.map(q=>[q.action.action_ref,q.question_ref]);
    if(qs.length<2)throw Error('Au moins deux questions requises pour le contrôle');
    const keep=qs[1+choice%(qs.length-1)].question_ref;
    const trials=variant==='déjà-essayée'?[qs[0]]:variant==='une-restante'?qs.filter(q=>q.question_ref!==keep):qs;
    for(const q of trials){
      const tag='fixture:stationnaire:'+q.question_ref;
      const before={...obs,observation_ref:tag+':avant'},after={...obs,observation_ref:tag+':après'};
      const receipt=await this.recordTransition(before,q.action,after);
      audit.essais.push([q.action.action_ref,q.question_ref,receipt.transition_ref]);
    }
    added=true;
  }
  phase=local;
  try{
    const p=await propose.call(this,obs,actions,options);
    local.statut=p?.status;local.choix=p?.question?.question_ref??null;
    return p;
  }finally{audit.appels.push(local);phase=null;}
};
const runtime=await createNativeV6Runtime({common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')},{now:()=>0});
const service=new V6AgentService(()=>runtime),sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
let seq=0,ticket;
for await(const line of createInterface({input:process.stdin})){
  const m=JSON.parse(line),prior=ticket;audit={bord:0,vue:null,appels:[],essais:[]};
  let r=await service.handle({sessionId,sequence:seq,observation:m.observation,...(seq?{type:'advance',ticketId:prior.id,executionMs:0}:{type:'init',budgets:m.budgets})});
  const ret=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
  while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:seq});
  const s=r.snapshot,p=s.proposal,release=s.trace.findLast(e=>e.kind==='sic_native_plan'),guard=s.trace.findLast(e=>e.kind==='before_guard');
  const f=p?.sic_frontier_decision,v=p?.sic_view_decision;ticket=r.ticket;
  console.log(JSON.stringify({ticket,état:r.kind,raison:s.reason,famille:ticket&&release?.family,stratégie:ticket&&release?.strategy,admis:ticket&&guard?.admitted,
    but:f?.objective.parent??v?.objective?.parent,question:ticket&&p?.question?.question_ref,libéré:ticket&&release?.subObjective,
    besoin:f?.need??v?.need,objectif:f?.objective.id??v?.objective?.id,purpose:f?.purpose??null,étapes:p?.planned_access_length,
    audit:seq===13?audit:null,retour:seq?{ticket:prior.id,ref:ret?.observation_ref,matched:ret?.matched,frontière:ret?.sic_frontier_outcome??null,besoin:ret?.sic_need??null}:null}));
  seq++;
}
