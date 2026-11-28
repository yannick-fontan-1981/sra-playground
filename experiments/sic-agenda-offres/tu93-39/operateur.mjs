import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {evaluateurJeu} from '../evaluateur-jeu.mjs';
import {loadGame} from '../frontiere-22-23/game.mjs';
import {withEngine} from '../moteur-reference.mjs';

export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const variants=['nominal','sans-action4','retrait-offre','stationnaire','preuve-etrangere'];
const fields=['alternating_material_measurement_frame_ref','alternating_material_first_value','alternating_material_connector_values',
  'alternating_material_graph_node_count','alternating_material_graph_edge_count','alternating_material_first_shortest_action_refs',
  'alternating_material_first_shortest_edge_count','unique_alternating_material_graph_description_present',
  'translated_overlay_matches_alternating_pitch_and_edge',
  'alternating_material_block_quantum','alternating_material_full_step_pitch','alternating_material_route_witness_count',
  'alternating_material_additional_occupant_count','alternating_material_counterfactual_excluded_positions'];
const measure=m=>m&&Object.fromEntries(fields.filter(k=>Object.hasOwn(m,k)).map(k=>[k,m[k]]));
function offer(raw){
  const p=raw?.graph_access_plan;
  return raw&&{status:raw.status,reason:raw.reason,blocking:raw.block_unrelated_probe??false,
    plan:p?{signature:p.signature,actor:{bbox:p.actor.bbox,size:p.actor.size,histogram:p.actor.histogram},
      steps:p.steps,measurement:measure(p.measurement),evidence:p.evidence,trial:p.trial,instrumental:p.instrumental_contact}:null};
}
const surface=(s)=>({signature:s.signature,action:s.action,delta:s.delta,epoch:s.epoch,from:s.from,to:s.to,
  evidence:s.evidence,size:s.size,histogram:s.histogram});

export async function play(engine,variant,vendor){
  assert.ok(variants.includes(variant));
  const native=n=>import(new URL('src/logos-engine/'+n+'.ts',engine));
  const {AlternatingGraphMemory,alternatingGraphSignature}=await native('v6-alternating-graph-access');
  const {alternatingOverlays}=await native('v6-alternating-graph-observation');
  const family=AlternatingGraphMemory.prototype,propose=family.proposeGraph,record=family.record;
  let turn=1;
  const cuts=new Map(),afterCuts=new Map(),hooks=[mock.method(Date,'now',()=>1700000000000)];
  hooks.push(mock.method(family,'proposeGraph',function(obs,rows,inputs,remaining,config){
    const original=this.samples,observed=alternatingOverlays(rows).map(a=>({signature:alternatingGraphSignature(a),bbox:a.bbox,size:a.size,histogram:a.histogram}));
    let removed=[], added=null;
    if(turn===15&&variant==='sans-action4'){
      removed=original.filter(s=>s.action==='ACTION4'&&observed.some(a=>a.signature===s.signature));
      assert.ok(removed.length);
      this.samples=original.filter(s=>!removed.includes(s));
    }
    if(turn===15&&variant==='preuve-etrangere'){
      const tracked=original.find(s=>s.action==='ACTION4'&&observed.some(a=>a.signature===s.signature));
      assert.ok(tracked);
      added={...tracked,signature:'fixture:evidence-foreign-signature',delta:tracked.delta.map(x=>-x)};
      this.samples=[...original,added];
    }
    try{
      const fact=structuredClone({ref:obs.observation_ref,remaining,available:obs.available_action_refs,actors:observed,
        samples:this.samples.map(surface),calibration:measure(this.calibration),contacts:this.contacts,refused:[...this.refused]});
      const proposal=propose.call(this,obs,rows,inputs,remaining,config);
      const removedOffer=turn===15&&variant==='retrait-offre'&&proposal.status==='proposed';
      const authored=removedOffer?{status:'abstained',reason:'withdrawn_in_qualification'}:proposal;
      cuts.set(obs.observation_ref,{fact,seal:digest(fact),removed:removed.map(surface),added:added&&surface(added),
        proposed:offer(proposal),authored:disposition(authored)});
      return authored;
    }finally{this.samples=original;}
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const events=record.apply(this,args),last=events.at(-1);
    if(last)afterCuts.set(args[2].observation_ref,structuredClone({detail:last.detail,last:last.samples.at(-1)&&surface(last.samples.at(-1)),
      refused:last.refused,calibration:measure(last.calibration),contacts:last.contacts}));
    return events;
  }));
  try{
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine), service=createService();
    const game=await loadGame('TU93',vendor,engine),sessionId='tu93-39';
    let board=game.initial;
    let result=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    const issued=()=>{
      if(!result.ticket)return null;
      const {ticket,snapshot}=result,p=snapshot.proposal,g=snapshot.trace.findLast(v=>v.kind==='before_guard');
      const release=snapshot.trace.findLast(v=>v.kind==='sic_native_plan'),ref=ticket.observationRef;
      return structuredClone({ref,level:board.level,ticket:ticket.id,index:ticket.actionIndex,command:ticket.actionRef,data:ticket.data??{},
        type:p.kind,family:release?.family??snapshot.lastDecision,entry:p.field_subquestion??release?.source_subquestion??null,
        guard:g?.reason,admitted:g?.admitted,refs:p.route_refs,cut:cuts.get(ref)??null,plan:p.graph_access_plan?offer(p).plan:null});
    };
    for(let i=1;i<=16;i++){
      while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i-1});
      const pre=issued();
      if(!pre)break;
      const actual=await game.step(Number(pre.command.slice(6)),pre.data);
      const replaced=i===15&&variant==='stationnaire';
      const shown=replaced?{...actual,frame:board.frame,frames:[board.frame]}:actual;
      turn=i+1;
      result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(shown,i),executionMs:0});
      const e=result.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,reason:e.reason,seal:e.seal_prefix,levels:shown.levelsCompleted,
        packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        physical:digest(actual.frame),shown:digest(shown.frame),record:afterCuts.get(e.observation_ref)??null};
      steps.push({i,pre,after});board=shown;
      if(replaced){
        while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i});
        break;
      }
    }
    return {steps,stop:result.reason??null,next:issued(),lastCut:[...cuts.values()].at(-1)??null};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
const disposition=p=>({status:p.status,reason:p.reason,blocking:p.block_unrelated_probe??false});
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide)), r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.type,s.pre.command,s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
