import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {mock} from 'node:test';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {SharedSeriesConstraint} from './src/logos-engine/v6-shared-series.ts';
import {OccurrenceRecallAccess} from './src/logos-engine/v6-occurrence-recall.ts';
import * as programs from './src/logos-engine/v6-program-composition-access.ts';
const mode=process.argv[2],turn=Number(process.argv[3]??0),methods={1:'editCollection',4:'composeProgram',12:'probeRespondents'};
const root=new URL('./reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
mock.method(Date,'now',()=>1700000000000);
let events=[],withdrawn=null;
const propose=SharedSeriesConstraint.prototype.programPropose;
SharedSeriesConstraint.prototype.programPropose=async function(...args){
  if(mode==='sans-modèle' && args[0].revision===4){
    const models=this.memory.compositionModels;withdrawn=models.length;
    this.memory.compositionModels=[];try{return await propose.apply(this,args);}finally{this.memory.compositionModels=models;}
  }
  if(mode==='retrait' && args[0].revision===turn){
    const orig=programs.defaultProgramOffers,name=methods[turn];
    const offers={...orig,[name]:(...a)=>{const p=orig[name](...a);if(p)withdrawn=p.kind;return null;}};
    return propose.call(this,...args.slice(0,6),offers);
  }
  return propose.apply(this,args);
};
const apply=OccurrenceRecallAccess.prototype.applyEvent;
const interest=new Set(['marked_collection_result','fitted_program_composition','program_composition_reconciled','respondent_probe_result','observed_respondent_order','respondent_probe_pending']);
OccurrenceRecallAccess.prototype.applyEvent=function(e){
  if(interest.has(e.kind)){
    const c=e.continuation;
    events.push({type:e.kind,refs:e.evidence,outcome:e.outcome?.matched,mode:e.mode,collection:e.before_collection,
      base:c?.own_base,mot:c?.word,modèle:e.model?.model_id,restauré:e.editing_composition_restored,
      progression:e.official_progress,ordre:e.order?.map(o=>({mot:o.word,premier:o.first_effect,preuve:o.evidence_kind})),
      prévus:e.results?.map(o=>({mot:o.candidate.object.word,avant:o.candidate.object.base,après:o.candidate.expected_first_base,
        indices:o.matching_packet_indices,statut:o.status})),
      révélés:e.revealed_candidates?.map(o=>({mot:o.object.word,après:o.object.base,premier:o.first_complete_packet_index,
        origines:o.compatible_retroprojections.map(r=>r.prior_base)}))});
  }
  return apply.call(this,e);
};
const runtime=await createNativeV6Runtime({common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')},{now:()=>0});
const service=new V6AgentService(()=>runtime),sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
let seq=0,ticket;
for await(const line of createInterface({input:process.stdin})){
  const {observation,budgets}=JSON.parse(line),past=ticket;withdrawn=null;events=[];
  let r=await service.handle({sessionId,sequence:seq,observation,...(seq?{type:'advance',ticketId:past.id,executionMs:0}:{type:'init',budgets})});
  const ret=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
  while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:seq});
  const s=r.snapshot,p=s.proposal;ticket=r.ticket;
  const rel=s.trace.findLast(e=>e.kind==='sic_native_plan'),g=s.trace.findLast(e=>e.kind==='before_guard');
  const m=p?.marked_collection_plan,prog=p?.program_composition_plan,probe=p?.respondent_probe_plan,plan=m??prog??probe;
  const ix=ticket?.actionIndex,step=prog?.steps[ix];
  const ev=seq?events.filter(e=>e.refs?.includes(ret?.observation_ref)):[];
  console.log(JSON.stringify({ticket,état:r.kind,raison:s.reason,famille:ticket&&rel?.family,type:ticket&&p?.kind,
    familleProgramme:ticket&&p?.field_subquestion,admis:ticket&&g?.admitted,ref:ticket&&plan?.observation_ref,
    mode:ticket&&plan?.mode,étape:ticket&&(m?.mode??step?.mode??(probe?(ix?'execute':'insert'):null)),index:ix,
    collection:m?.before_collection,mot:prog?.word??probe?.prepared_word,avant:step?.before_word,après:step?.after_word,
    base:prog?.own_base??probe?.owner_before?.base,prévu:step?.turn?.base??probe?.expected_final_own_base,
    géométrie:probe?{forme:probe.model.layer.shape,pas:probe.model.layer.step}:undefined,modèle:plan?.model?.model_id,
    withdrawn,events:ev,retour:seq?{ticket:past.id,ref:ret?.observation_ref,matched:ret?.matched,raison:ret?.reason}:null}));
  seq++;
}
