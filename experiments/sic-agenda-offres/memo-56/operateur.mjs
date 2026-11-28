import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {evaluateurJeu} from '../evaluateur-jeu.mjs';
import {loadGame} from '../frontiere-22-23/game.mjs';
import {withEngine} from '../moteur-reference.mjs';

export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const occurrence=p=>({id:p.id,point:p.point,bbox:p.bbox,shape:p.shape,color:p.color,marked:p.marked});
const view=s=>s&&{key:s.key,ref:s.source_ref,clues:s.indicators,calibration:s.calibration,occurrences:s.occurrences.map(occurrence)};
const context=c=>c&&{example:c.evidence_ref,chosen:c.chosen,previous:view(c.previous)};
const interventions={'sans-exemple':[46,41],'sans-voisin':[14,37]};
const equalPoint=(a,b)=>a[0]===b[0]&&a[1]===b[1];

export async function play(engine,variant,vendor){
  assert.ok(variant==='nominal'||Object.hasOwn(interventions,variant));
  const native=n=>import(new URL('src/logos-engine/'+n+'.ts',engine));
  const cuts=new Map(),receipts=new Map();
  let turn=1, removed=null, comparisons=[];
  const module=new URL('src/logos-engine/v6-occurrence-recall.ts',engine).href;
  const symbol=Symbol.for('sic.memo.56.comparaison');
  globalThis[symbol]=(find,scene,original,seen,relation,comparison)=>{
    const locus=turn===7?interventions[variant]:null;
    let input=original;
    if(locus){
      assert.ok(original.evidence_ref.includes(':revision:6:'));
      const previous=original.previous;
      const matches=previous.occurrences.filter(o=>equalPoint(o.point,locus));
      assert.equal(matches.length,1);
      assert.notEqual(matches[0].id,original.chosen);
      removed=occurrence(matches[0]);
      input={...original,previous:{...previous,occurrences:previous.occurrences.filter(o=>o.id!==removed.id)}};
    }
    const candidates=find(scene,input,seen,relation,comparison);
    comparisons.push({relation,comparison,candidates});
    return candidates;
  };
  const loader=registerHooks({load(url,context,next){
    const loaded=next(url,context);
    if(url!==module)return loaded;
    const source=loaded.source.toString(),marker='occurrenceCandidates(scene, context, this.recallSeen, relation, comparison)';
    assert.equal(source.split(marker).length,2);
    const invoke='globalThis[Symbol.for("sic.memo.56.comparaison")](occurrenceCandidates, scene, context, this.recallSeen, relation, comparison)';
    return {...loaded,source:source.replace(marker,invoke)};
  }});
  const {OccurrenceRecallAccess}=await native('v6-occurrence-recall');
  const {measureOccurrenceScene}=await native('v6-occurrence-scene');
  const family=OccurrenceRecallAccess.prototype, recall=family.recallQuestion, record=family.record;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  hooks.push(mock.method(family,'recallQuestion',function(obs,rows,configuration){
    removed=null;
    comparisons=[];
    const pre=structuredClone({observation:obs.observation_ref,epoch:obs.level_epoch,
      current:view(measureOccurrenceScene(rows,obs,this.recallCalibration)),prior:context(this.recallContext),
      models:Object.entries(this.recallModels).map(([key,m])=>({key,count:m.unique_support,evidence:m.evidence,counterexamples:m.counterexamples})),
      seen:this.recallSeen.map(occurrence),limits:configuration.minimum_unique_observations});
    const result=recall.call(this,obs,rows,configuration), p=result?.occurrence_recall_plan;
    cuts.set(obs.observation_ref,{pre,seal:digest(pre),removed,comparisons,
      authorizes:p?{selected:occurrence(p.selected),reason:p.selection_reason,predictions:p.predictions,support:p.supporting_models,refs:result.route_refs}:null});
    return result;
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const result=record.apply(this,args);
    if(result.length)receipts.set(args[2].observation_ref,result.map(e=>({kind:e.kind,mode:e.mode,chosen:e.chosen,
      evidence:e.evidence,prior:context(e.before_context),afterScene:e.after_scene_key,consolidated:context(this.recallContext)})));
    return result;
  }));
  try{
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine),service=createService();
    const game=await loadGame('MEMO',vendor,engine), sessionId='memo-qualification';
    let board=game.initial;
    let result=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    for(let i=1;i<=8;i++){
      while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i-1});
      if(!result.ticket)break;
      const {ticket,snapshot}=result,g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const issued={ref:ticket.observationRef,ticket:ticket.id,level:board.level,family:snapshot.lastDecision,
        kind:snapshot.proposal.kind,entry:snapshot.proposal.field_subquestion??null,command:[ticket.actionRef,ticket.data??null],
        guard:g?.reason,admitted:g?.admitted,cut:cuts.get(ticket.observationRef)??null};
      board=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);
      turn=i+1;
      result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:ticket.id,observation:packet(board,i),executionMs:0});
      const e=result.snapshot.trace.findLast(v=>v.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:board.levelsCompleted,
        packet:digest([board.frame,board.frames,board.availableActionIds,board.level,board.levelsCompleted,board.state]),
        memory:receipts.get(e.observation_ref)??null};
      steps.push({i,issued,after});
    }
    return {steps,stop:result.reason??null};
  }finally{
    for(const h of hooks.reverse())h.mock.restore();
    loader.deregister();
    delete globalThis[symbol];
  }
}
if(import.meta.main){
  const {values}=parseArgs({options:{moteur:{type:'string',default:'candidat'},source:{type:'string'},
    pyodide:{type:'string'},variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide));
  const j=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(j,null,2)+'\n');
  for(const s of j.steps)console.log(s.i,s.issued.family,JSON.stringify(s.issued.command),
    s.issued.cut?.authorizes?.reason,s.after.memory?.[0]?.mode);
}
