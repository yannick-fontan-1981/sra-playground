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
const variants=['nominal','sans-corps','sans-correspondance','sans-deplacement','sans-attache','stationnaire'];
const state=s=>({epoch:s.epoch,core:s.core,moves:s.moves,held:s.held,interaction:s.interaction,tried:s.tried,
  failed:s.failed,context:s.correspondence_context,pending:s.pending_reception,receipts:s.reception_receipts});
const planOf=x=>({kind:x.kind,target:x.target,actions:x.actions,distance:x.distance,poses:x.poses,delta:x.delta??null,
  context:x.context,evidence:x.evidence,control:x.control_status??null,residual:x.residual_distance??null,
  revalidation:x.target_revalidation??null,focus:x.composition_attention??null});

export async function play(engine,variant,vendor,target){
  assert.ok(variants.includes(variant));
  const {ObservedBinding}=await import(new URL('src/logos-engine/v6-observed-binding.ts',engine));
  const family=ObservedBinding.prototype,cuts=new Map(),records=new Map(),checks=new Map();
  const propose=family.proposeInSubquestion,measure=family.measure,before=family.before,record=family.recordSource;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1;
  hooks.push(mock.method(family,'proposeInSubquestion',async function(g,q,obs,rows,...rest){
    const incoming=state(this.state());
    const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),
      actions:obs.available_action_refs,remaining:rest[1],incoming,measured:null});
    cuts.set(obs.observation_ref,{pre});
    const old=this.tracker.core;
    if(turn===2&&variant==='sans-corps'){assert.ok(old);this.tracker.core=null;}
    let p;
    try{p=await propose.call(this,g,q,obs,rows,...rest);}
    finally{if(turn===2&&variant==='sans-corps')this.tracker.core=old;}
    cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
    return p;
  }));
  hooks.push(mock.method(family,'measure',function(args){
    const transaction=this.active,[obs]=transaction.context,tracker=transaction.tracker,old=tracker.moves,held=tracker.held;
    try{
      if(turn===3&&variant==='sans-deplacement'){
        assert.ok(old.ACTION2);
        tracker.moves=Object.fromEntries(Object.entries(old).filter(([action])=>action!=='ACTION2'));
      }
      if(turn===13&&variant==='sans-attache'){assert.ok(held);tracker.held=null;}
      const result=measure.call(this,args);
      const removed=turn===2&&variant==='sans-correspondance'?result.offers.filter(p=>p.target.frame.ref===target):[];
      if(turn===2&&variant==='sans-correspondance')assert.ok(removed.length);
      const kept=result.offers.filter(p=>!removed.includes(p));
      const {pre}=cuts.get(obs.observation_ref);
      pre.measured=structuredClone({tracker:state(tracker.sourceState()),before:result.offers.map(planOf),
        offers:kept.map(planOf),removed:removed.map(planOf)});
      return {...result,offers:kept};
    }finally{tracker.moves=old;tracker.held=held;}
  }));
  hooks.push(mock.method(family,'before',function(p,i,packet,obs){
    const live=before.call(this,p,i,packet,obs),old=before.call(this,p,i,packet,{...obs,observation_ref:obs.observation_ref+':old'});
    checks.set(obs.observation_ref,{live,old});
    return live;
  }));
  hooks.push(mock.method(family,'recordSource',async function(b,a,cmd,f,s,p,i,x){
    const prior=state(this.state());
    const result=await record.call(this,b,a,cmd,f,s,p,i,x);
    records.set(a.observation_ref,structuredClone({result,prior,state:state(this.state()),owned:!!p?.binding_plan,command:cmd.action_ref}));
    return result;
  }));
  try{
    const {createService,defaultRecoveryPack,packet}=await evaluateurJeu(engine),service=createService(),
      game=await loadGame('CGWL',vendor,engine),sessionId='cgwl-37';
    let board=game.initial;
    let r=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    const issued=()=>{
      if(!r.ticket)return null;
      const {snapshot,ticket}=r,p=snapshot.proposal,ref=ticket.observationRef;
      const release=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const plan=p.binding_plan;
      return structuredClone({ref,ticket:ticket.id,level:board.level,index:ticket.actionIndex,family:release?.family??snapshot.lastDecision,
        kind:p.kind,slot:p.material_access_subquestion??null,bundle:p.bundle_template?.operation_key??null,
        command:[ticket.actionRef,ticket.data??{}],guard:{admitted:g?.admitted,reason:g?.reason},scope:checks.get(ref)??null,
        refs:p.route_refs,cut:cuts.get(ref)??null,plan:plan&&{offer:planOf(plan.offer),workflow:plan.workflow,core:plan.core,
          expected:p.steps[ticket.actionIndex].expected_after,root:p.bundle_template.objective_ref}});
    };
    const limit=variant==='nominal'?16:variant==='stationnaire'?2:variant==='sans-attache'?13:4;
    for(let i=1;i<=limit;i++){
      while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i-1});
      const pre=issued();
      if(!pre)break;
      const actual=await game.step(Number(pre.command[0].slice(6)),pre.command[1]);
      const replace=variant==='stationnaire'&&i===2;
      const shown=replace?{...board,frames:[board.frame]}:actual;
      turn=i+1;
      r=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(shown,i),executionMs:0});
      const e=r.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:shown.levelsCompleted,frames:actual.frames.length,
        packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        physical:digest(actual.frame),presented:digest(shown.frame),record:records.get(e.observation_ref)??null};
      steps.push({i,pre,after});board=shown;
      if(replace){
        while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i});
        break;
      }
    }
    return {steps,stop:r.reason??null,next:issued()};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},cible:{type:'string'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide),values.cible);
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.kind,JSON.stringify(s.pre.command),s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
