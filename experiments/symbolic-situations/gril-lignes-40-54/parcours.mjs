import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {gunzipSync} from 'node:zlib';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {OccludedCatalogueMemory} from './src/logos-engine/v6-occluded-catalogue-access.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';

const src=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,src)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const gz=p=>JSON.parse(gunzipSync(readFileSync(new URL(p,import.meta.url))));
const trace=gz('docs/migration/native-campaigns-v49/gril-public-trace.json.gz').packets;
const sessionId='sra-v6-'+gz('tests/fixtures/sic-gril-alternate-returns.json.gz').session;
const sum=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fields='catalogue_field_input_observed', response='catalogue_response', view='catalogue_view_experiment';
function changed(before,after) {
  return after.flatMap((row,y)=>row.flatMap((p,x)=>p===before[y][x]?[]:[[x,y]]));
}
function present(name,seq,observation,previous,seed){
  if(name==='stationnaire40'&&seq===4)return {...observation,frame:previous,frames:observation.frames.map(()=>previous)};
  if(name!=='partiel54'||seq!==2)return observation;
  const axis=seed[0]&1, high=Boolean(seed[0]&2);
  const delta=changed(previous,observation.frame), sorted=delta.map(p=>p[axis]).sort((a,b)=>a-b);
  const median=sorted[Math.floor(sorted.length/2)];
  const edit=frame=>frame.map((row,y)=>row.map((p,x)=>((axis===0?x:y)>=median)===high?p:previous[y][x]));
  return {...observation,frame:edit(observation.frame),frames:observation.frames.map(edit)};
}
function summary(e){
  return {kind:e.kind,mode:e.mode,palette:e.palette,evidence:e.evidence,key:e.trial_key,
    field:e.field_ref,candidates:e.candidate_ids,structure:e.structure_preserved,changed:e.field_changed,
    command:e.command?.action_ref,official:e.official_progress};
}
async function play(game,name,cap,seed){
  const rows=[],effects=[],interventions=[],hooks=[];
  const M=OccludedCatalogueMemory.prototype, record=M.record, propose=M.proposeCatalogue;
  let entry1,entry2,entry11;
  hooks.push(mock.method(M,'record',function(...args){
    const all=record.apply(this,args);
    for(const e of all){
      effects.push(summary(e));
      if(args[2].revision===2&&e.kind===fields)entry1=e;
      if(args[2].revision===3&&e.kind===response&&e.mode==='answer')entry2=e;
      if(args[2].revision===12&&e.kind===fields)entry11=e;
    }
    return all;
  }));
  hooks.push(mock.method(M,'proposeCatalogue',async function(...args){
    const original=await propose.apply(this,args), rev=args[0].revision;
    let check;
    if(name==='sansSoumission54'&&rev===3&&original?.occluded_catalogue_plan?.mode==='select')
      check=e=>e.kind===entry2.kind && e.evidence[1]===entry2.evidence[1];
    if(name==='sansAccès40'&&rev===4&&original?.kind===view)
      check=e=>e.kind===fields && e.evidence[1]===entry1.evidence[1];
    if(name==='sansLienDirect54'&&rev===4&&original?.kind===view)
      check=e=>e.evidence[1]===entry2.evidence[1];
    if(name==='accèsPériméN3'&&rev===15&&original?.kind===view)
      check=e=>e.kind===fields && e.evidence[1]===entry11.evidence[1];
    if(!check)return original;
    const state=this.currentState(), rebuild=new OccludedCatalogueMemory(), removed=[];
    let oldWitness=false;
    for(const event of [...state.catalogue_events,...state.catalogue_view_events]){
      if(check(event))removed.push(summary(event));
      else{
        if(event.kind===fields && event.evidence[1]===entry1.evidence[1])oldWitness=true;
        rebuild.applyEvent(event);
      }
    }
    if(name==='accèsPériméN3' && !oldWitness){
      rebuild.applyEvent(entry1);oldWitness=true;
    }
    const result=await propose.apply(rebuild,args);
    if(!interventions.some(i=>i.tour===rev))interventions.push({tour:rev,removed,oldWitness,original:original.kind,
      same:JSON.stringify(original)===JSON.stringify(result),remaining:result?.kind??null});
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}), service=new V6AgentService(()=>runtime);
    let board=game.dispatch({type:'load',code:'GRIL',level:1}),previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i), obs=present(name,i,real,previous?.frame,seed);
      if(name==='nominal'){
        const p=trace[i].packet;
        for(const [a,b] of [['frame','frame_rows'],['frames','frame_packet'],['level','level'],['levelsCompleted','levels_completed'],['state','state'],['stepIndex','step_index']])
          assert.deepEqual(obs[a],p[b]);
        assert.deepEqual(obs.availableActionIds,p.available_action_refs.map(id=>Number(id.slice(6))));
      }
      const start=effects.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal, plan=p?.occluded_catalogue_plan;
      rows.push({tour:i+1,niveau:obs.level,progression:obs.levelsCompleted,
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,sub:p.field_subquestion,
          cmd:ticket.actionRef,data:ticket.data,admis:snapshot.trace.findLast(e=>e.kind==='before_guard')?.admitted,
          mode:plan?.mode,palette:plan?.target_palette,key:plan?.trial_key,candidat:plan?.evidence?.candidate,
          fonds:plan?.evidence?.backgrounds,preuve:plan?.details?.evidence_refs??plan?.evidence?.supporting_observation_refs,
          candidats:plan?.details?.candidate_ids,attendu:p.steps[ticket.actionIndex]?.expected_after},
        ret:previous&&{id:previous.id,ref:outcome?.observation_ref,owner:outcome?.family,accord:outcome?.matched,motif:outcome?.reason,
          pixelsJeu:changed(previous.frame,real.frame).length,pixelsServis:changed(previous.frame,obs.frame).length,
          jeu:sum(real.frame),servi:sum(obs.frame),images:obs.frames.length,événements:effects.slice(start)}});
      if(!ticket || i===cap)break;
      if(name==='nominal')assert.deepEqual([ticket.actionRef,ticket.data],[trace[i+1].command.action_ref,trace[i+1].command.data]);
      previous={id:ticket.id,frame:obs.frame};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),...(ticket.data?.x===undefined?{}:{data:ticket.data})});
    }
    return {rows,interventions};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root,seed){
  const groups={nominal:[['nominal',16]],contrôles:[['sansSoumission54',3],['sansAccès40',4],['sansLienDirect54',4],['accèsPériméN3',15]],
    réserve:[['partiel54',2],['stationnaire40',4]]};
  assert.ok(groups[group]);
  const game=await sourceBackend(root),clock=mock.method(Date,'now',()=>1700000000000),cases={};
  try{for(const [name,cap] of groups[group])cases[name]=await play(game,name,cap,seed);}
  finally{clock.mock.restore();}
  return cases;
}
