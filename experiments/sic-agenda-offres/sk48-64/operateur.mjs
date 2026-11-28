import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {evaluateurJeu} from '../evaluateur-jeu.mjs';
import {loadGame} from '../frontiere-22-23/game.mjs';
import {versions,withEngine} from '../moteur-reference.mjs';

versions.stations='4946cf0297734b9464fc52256af6fb27846f3bad';
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const effect=(controls)=>Object.fromEntries(Object.entries(controls).map(([command,e])=>
  [command,{translation:e.root_translation,extent:e.extent_delta,evidence:e.evidence_refs}]));
function memory(m){
  return {controls:effect(m.controls),tried:m.tried,refs:m.evidence,epoch:m.epoch,refuted:m.refuted.length,
    recovery:m.sic_recovery_need??null};
}
function recolor(board){
  const frame=rows=>rows.map(row=>row.map(v=>v===9?14:v===14?9:v));
  const palette=board.palette?.slice();
  if(palette)[palette[9],palette[14]]=[palette[14],palette[9]];
  return {...board,frame:frame(board.frame),frames:board.frames.map(frame),...(palette?{palette}:{})};
}

export async function play(engine,variant,vendor){
  assert.ok(['nominal','priorite','stationnaire','sans-effet','palette'].includes(variant));
  const native=n=>import(new URL('src/logos-engine/'+n+'.ts',engine));
  const {RootedLineMemory}=await native('v6-rooted-line-access');
  const {measureRootedLine,physicalRootedLine}=await native('v6-rooted-line-observation');
  const family=RootedLineMemory.prototype, propose=family.propose, record=family.record;
  const cuts=new Map(),post=new Map();
  let turn=1;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  hooks.push(mock.method(family,'propose',function(obs,rows,inputs,remaining,original){
    const current=this.currentState().line_memory, actual=this.lineMemory;
    const cfg=original.rooted_line_question, scene=measureRootedLine(rows);
    if(!cfg||!scene)return propose.call(this,obs,rows,inputs,remaining,original);
    const reordered=variant==='priorite'&&turn===1;
    const order=reordered?[cfg.probe_order[1],cfg.probe_order[0],...cfg.probe_order.slice(2)]:cfg.probe_order;
    const config=reordered?{...original,rooted_line_question:{...cfg,probe_order:order}}:original;
    const removed=variant==='sans-effet'&&turn===5? current.controls.ACTION1:null;
    if(removed){
      assert.ok(current.tried.includes('ACTION1'));
      delete current.controls.ACTION1;
      this.lineMemory=current;
    }
    try{
      const state=memory(current);
      const pre=structuredClone({ref:obs.observation_ref,layout:scene.layout,order:scene.order,physical:physicalRootedLine(scene),
        available:obs.available_action_refs,priority:order,declaredLimit:remaining,
        pending:order.filter(a=>obs.available_action_refs.includes(a)&&!Object.hasOwn(state.controls,a)&&!state.tried.includes(a)),state});
      const p=propose.call(this,obs,rows,inputs,remaining,config),plan=p?.rooted_line_plan;
      cuts.set(obs.observation_ref,{pre,seal:digest(pre),removed:removed&&effect({ACTION1:removed}).ACTION1,
        offer:p&&{status:p.status,reason:p.reason,blocks:p.block_unrelated_probe??false,kind:plan?.kind,
          next:p.actions?.[0]?.action_ref,search:plan?.search??p.search??null,refs:p.route_refs}});
      return p;
    }finally{this.lineMemory=actual;}
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const events=record.apply(this,args);
    if(events.length)post.set(args[2].observation_ref,structuredClone({detail:events[0].detail,state:memory(events[0].memory)}));
    return events;
  }));
  try{
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine),service=createService();
    const game=await loadGame('SK48',vendor,engine),sessionId='sk48-64';
    const display=variant==='palette'?recolor:b=>b;
    let board=display(game.initial);
    let result=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[],count=variant==='priorite'?2:variant==='stationnaire'?1:5;
    for(let i=1;i<=count;i++){
      while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i-1});
      if(!result.ticket)break;
      const {ticket,snapshot}=result,p=snapshot.proposal,plan=p.rooted_line_plan,g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const ref=ticket.observationRef,release=snapshot.trace.findLast(e=>e.kind==='sic_native_plan');
      const issued=structuredClone({ticket:ticket.id,ref,family:release?.family??snapshot.lastDecision,
        entry:p.field_subquestion??release?.source_subquestion??null,kind:p.kind,command:ticket.actionRef,index:ticket.actionIndex,
        guard:g?.reason,admitted:g?.admitted,cut:cuts.get(ref)??null,plan:plan&&{kind:plan.kind,refs:p.route_refs,
          expected:plan.predictions[ticket.actionIndex],search:plan.search,commands:plan.commands.map(c=>c.action_ref)}});
      const actual=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);
      const shown=variant==='stationnaire'?{...actual,frame:board.frame,frames:[board.frame]}:display(actual);
      turn=i+1;
      result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:ticket.id,observation:packet(shown,i),executionMs:0});
      const e=result.snapshot.trace.findLast(v=>v.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,need:e.sic_need??null,
        levels:shown.levelsCompleted,packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        normalized: digest(shown.frame),source:digest(actual.frame),record:post.get(e.observation_ref)??null};
      steps.push({i,issued,after});
      board=shown;
    }
    if(variant==='stationnaire')while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:1});
    return {steps,stop:result.reason??null,next:result.ticket?{command:result.ticket.actionRef,ref:result.ticket.observationRef,
      cut:cuts.get(result.ticket.observationRef)??null}:null,lastCut:[...cuts.values()].at(-1)??null};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  const run=engine=>play(engine,values.variante,resolve(values.pyodide));
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  console.log(r.steps.map(s=>[s.i,s.issued.command,s.issued.plan?.kind,s.after.matched].join(' ')).join('\n'));
  if(r.stop)console.log(r.stop,r.lastCut?.offer?.reason);
}
