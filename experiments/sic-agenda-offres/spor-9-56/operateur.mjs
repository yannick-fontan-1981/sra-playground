import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mock } from 'node:test';
import { parseArgs } from 'node:util';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { withEngine } from '../moteur-reference.mjs';

export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const seal=fact=>({fact:structuredClone(fact),digest:digest(fact)});
const compactBox=c=>({box:c.box,border:c.border,point:c.point,filled:c.filled,closed:c.closed,local:c.local,contents:c.contents});
const part=p=>({id:p.id,bbox:p.bbox,point:p.point,color:p.color,shape:p.shape,marked:p.marked});
const scene=s=>s&&{key:s.key,source:s.source_ref,occurrences:s.occurrences.map(part),indicators:s.indicators,calibration:s.calibration};
const context=c=>c&&{previous:scene(c.previous),chosen:c.chosen,evidence:c.evidence_ref};
const compact=e=>({kind:e.kind,mode:e.mode,chosen:e.chosen,evidence:e.evidence,afterKey:e.after_scene_key,
  context:context(e.before_context),before:scene(e.before_scene)});

export async function play(engine,variant,limit,vendor){
  assert.ok(Number.isInteger(limit)&&limit>=1&&limit<=16);
  const native=name=>import(new URL('src/logos-engine/'+name+'.ts',engine));
  const {ContextualCompartments}=await native('v6-contextual-compartments');
  const {OccurrenceRecallAccess}=await native('v6-occurrence-recall');
  const {measureOccurrenceScene}=await native('v6-occurrence-scene');
  const {geometricComponents}=await native('v6-native-observer');
  let gesture=1,recording=0;
  const cuts9=new Map(), cuts56=new Map(),post9=new Map(),post56=new Map();
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  const compartment=ContextualCompartments.prototype, coach=OccurrenceRecallAccess.prototype;
  const choose=compartment.choose,record9=compartment.record,recall=coach.recallQuestion,record56=coach.record;
  hooks.push(mock.method(compartment,'choose',async function(s,obs){
    const pre=seal({observation:obs.observation_ref,frames:s.frames.map(compactBox),mark:s.mark,refs:this.refs,
      tried:[...this.tried],dependencies:[...this.dependencies].map(([k,v])=>[JSON.parse(k),[...v].map(key=>JSON.parse(key))]),
      priorBoundaries:this.passed.map(x=>[x.before,x.after]),pending:this.pending&&{ref:this.pending.ref,control:compactBox(this.pending.control),local:this.pending.local}});
    const chosen=await choose.call(this,s,obs);
    const offered=gesture===1&&variant==='sans-offre-9'?[null,null]:chosen;
    cuts9.set(obs.observation_ref,{pre,nominal:chosen[0]&&{compartment:compactBox(chosen[0]),question:chosen[1]}});
    return offered;
  }));
  hooks.push(mock.method(compartment,'record',async function(...args){
    if(variant==='sans-acquis-9'&&recording===1)
      return {status:'compartment_return_withheld_for_qualification',events:[]};
    const result=await record9.apply(this,args);
    const foreign=args[5]?.support_plan?.contextual_compartments!==true;
    if(!foreign||result.events?.length)
      post9.set(args[1].observation_ref,structuredClone({status:result.status,events:result.events,refs:this.refs,attempted:[...this.tried],
        dependencies:[...this.dependencies].map(([k,v])=>[JSON.parse(k),[...v].map(key=>JSON.parse(key))]),pending:this.pending&&{ref:this.pending.ref}}));
    return result;
  }));
  hooks.push(mock.method(coach,'recallQuestion',function(obs,rows,config){
    const calibration=this.recallCalibration, visible=measureOccurrenceScene(rows,obs,calibration);
    const records=Object.entries(this.recallModels).map(([key,x])=>({key,
      supports:x.unique_support,evidence:x.evidence,counterexamples:x.counterexamples}));
    const pre=seal({observation:obs.observation_ref,version:this.recallEpoch,calibration,prior:context(this.recallContext),
      candidates:scene(visible),seen:this.recallSeen.map(part),models:records,blocked:this.recallBlocked});
    const p=recall.call(this,obs,rows,config);
    cuts56.set(obs.observation_ref,{pre,selected:p&&part(p.occurrence_recall_plan.selected),
      reason:p?.occurrence_recall_plan.selection_reason??null,refs:p?.route_refs??null});
    return p;
  }));
  hooks.push(mock.method(coach,'record',function(...args){
    const outcome=record56.apply(this,args);
    if(outcome.length)post56.set(args[2].observation_ref,outcome.map(compact));
    return outcome;
  }));
  try{
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine), service=createService();
    const game=await loadGame('SPOR',vendor,engine),sessionId='spor-qualification';
    let board=game.initial;
    let r=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    for(let i=1;i<=limit;i++){
      while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i-1});
      if(!r.ticket)break;
      const {snapshot,ticket}=r,p=snapshot.proposal,p9=p.support_plan,ps=p.steps[ticket.actionIndex],p56=p.occurrence_recall_plan,g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const ref=ticket.observationRef;
      const pre=structuredClone({ref,level:board.level,ticket:ticket.id,index:ticket.actionIndex,family:snapshot.lastDecision,
        type:p.kind,entry:p.material_access_subquestion??p.field_subquestion??null,command:[ticket.actionRef,ticket.data??null],
        admitted:g?.admitted,guard:g?.reason,refs:p.route_refs,cut9:cuts9.get(ref)??null,cut56:cuts56.get(ref)??null,
        compartment:p9?.contextual_compartments?{control:compactBox(ps.control),key:ps.question_key,expected:ps.expected_after,dependencies:p9.receiver_dependencies}:null,
        recall:p56?{source:scene(p56.scene),context:context(p56.context),selected:part(p56.selected),reason:p56.selection_reason,
          support:p56.supporting_models,predictions:p56.predictions}:null});
      const actual=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);
      const replace=variant==='retour-9'&&i===1;
      let shown=replace?{...actual,frame:board.frame,frames:[board.frame]}:actual;
      let removed=null;
      if(variant==='sans-enclos-56'&&i===2){
        const observation={observation_ref:'controle-enclos',level_epoch:actual.level};
        const source=measureOccurrenceScene(actual.frame,observation,null);
        const marked=source?.occurrences.filter(x=>x.marked);
        assert.equal(marked?.length,1);
        const [l,t,r,b]=marked[0].bbox, extent=source.calibration.outline_extent;
        const enclosing=geometricComponents(actual.frame).filter(c=>{
          const [x,y,xx,yy]=c.bbox;
          return x<l&&y<t&&xx>r&&yy>b&&xx-x+1===extent[0]&&yy-y+1===extent[1];
        });
        assert.equal(enclosing.length,1);
        const enclosure=enclosing[0], [x,y]=enclosure.bbox;
        for(const [dx,dy] of enclosure.mask){
          const frame=actual.frame.map(row=>[...row]);
          frame[y+dy][x+dx]=source.background;
          if(measureOccurrenceScene(frame,observation,null)!==null)continue;
          assert.deepEqual(actual.frames.at(-1),actual.frame);
          shown={...actual,frame,frames:[...actual.frames.slice(0,-1),frame]};
          removed={point:[x+dx,y+dy],value:enclosure.color,background:source.background,box:enclosure.bbox,body:marked[0].bbox};
          break;
        }
        assert.ok(removed,'un pixel de l’enclos doit suffire');
      }
      gesture=i+1;recording=i;
      r=await service.handle({type:'advance',sessionId,sequence:i,ticketId:ticket.id,observation:packet(shown,i),executionMs:0});
      const e=r.snapshot.trace.findLast(v=>v.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:shown.levelsCompleted,
        packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        shown:digest(shown.frame),physical:digest(actual.frame),removed,
        compartment:post9.get(e.observation_ref)??null,recall:post56.get(e.observation_ref)??null};
      steps.push({i,pre,after});
      if(replace)break;
      board=shown;
    }
    if(variant==='retour-9')while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:steps.length});
    const next=r.ticket?{ref:r.ticket.observationRef,command:[r.ticket.actionRef,r.ticket.data??null],family:r.snapshot.lastDecision,
      type:r.snapshot.proposal.kind,cut9:cuts9.get(r.ticket.observationRef)??null}:null;
    return {steps,next,stop:r.reason??null};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
if(import.meta.main){
  const {values}=parseArgs({options:{moteur:{type:'string',default:'candidat'},source:{type:'string'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},gestes:{type:'string',default:'16'},recu:{type:'string'}}});
  assert.ok(['nominal','sans-offre-9','sans-acquis-9','retour-9','sans-enclos-56'].includes(values.variante));
  const run=e=>play(e,values.variante,Number(values.gestes),resolve(values.pyodide));
  const j=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(j,null,2)+'\n');
  for(const s of j.steps)console.log([s.i,s.pre.level,s.pre.family,s.pre.type,s.pre.entry,JSON.stringify(s.pre.command),
    s.pre.recall?.reason,s.after.recall?.[0]?.mode].join(' '));
}
