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
const cmp=c=>({changes:c.changes,settings:c.settings,predictions:c.predictions??null});
function domainPart(domain){
  return {count:domain.candidates.length,enumerated:domain.enumerated,checks:domain.checks,
    complete:domain.complete_finite_domain,bounded:domain.bounded,offers:domain.candidates.slice(0,8).map(cmp),
    hash:digest(domain.candidates)};
}
function layout(s){
  return {id:s.layout,controls:s.controls.map(c=>({id:c.id,point:c.point,value:c.value,pixels:c.support.length})),
    axes:s.axes.map(a=>({id:a.id,context:a.context,target:a.target,inputs:a.inputs,value:a.value}))};
}
function memory(m){
  return {evidence:m.evidence,edges:m.edges,conflicts:m.conflicts,failed:m.failed,
    rows:Object.fromEntries(Object.entries(m.rows).map(([k,r])=>[k,Object.keys(r)])),boundaries:m.boundaries};
}
const variants=['nominal','sans-offre','contradiction','stationnaire'];

export async function play(engine,variant,vendor){
  assert.ok(variants.includes(variant));
  const source=new URL('src/logos-engine/v6-relational-chamber-access.ts',engine).href;
  const tap=Symbol.for('sic.catr.42');
  let turn=1;
  const cuts=new Map(),guards=new Map(),posts=new Map(),proposals=new Map();
  globalThis[tap]=(obs,scene,retained,domain,remaining)=>{
    const pre=structuredClone({ref:obs.observation_ref,layout:layout(scene),memory:memory(retained),domain:domainPart(domain),remaining});
    cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
  };
  const loader=registerHooks({load(url,context,next){
    const result=next(url,context);
    if(url!==source)return result;
    const text=result.source.toString(),mark='const candidate = domain.candidates.find';
    assert.equal(text.split(mark).length,2);
    return {...result,source:text.replace(mark,'globalThis[Symbol.for("sic.catr.42")](observation,scene,memory,domain,remaining);\n    '+mark)};
  }});
  const native=n=>import(new URL('src/logos-engine/'+n+'.ts',engine));
  const {RelationalChamberMemory}=await native('v6-relational-chamber-access');
  const {measureRelationalChamber}=await native('v6-relational-chamber-observation');
  const {SharedSeriesConstraint}=await native('v6-shared-series');
  const family=RelationalChamberMemory.prototype,propose=family.propose,record=family.record,before=SharedSeriesConstraint.prototype.before;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  hooks.push(mock.method(family,'propose',function(obs,rows,inputs,remaining,cfg){
    const original=this.relationMemory;
    let contradictory=null;
    if(turn===1&&variant==='contradiction'){
      const current=measureRelationalChamber(rows);
      if(current){
        const axis=current.axes.find(a=>a.target!==null),values=new Map(current.controls.map(c=>[c.id,c.value]));
        const key=JSON.stringify(axis.inputs.map(ref=>values.get(ref)));
        const value=axis.value==='0'?'1':'0';
        const evidence='qualification:contradictory-relation';
        contradictory={axis:axis.id,context:axis.context,key,observed:axis.value,value,evidence,observation:obs.observation_ref};
        this.relationMemory={...original,rows:{[axis.context]:{[key]:{value,evidence:[evidence]}}}};
      }
    }
    try{
      const raw=propose.call(this,obs,rows,inputs,remaining,cfg);
      const offered=variant==='sans-offre'&&turn===1?null:raw;
      if(raw||offered)proposals.set(obs.observation_ref,{raw:raw?.status,rawReason:raw?.reason,blocked:raw?.block_unrelated_probe??false,
        offered:offered?.status??null,contradictory});
      return offered;
    }finally{this.relationMemory=original;}
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const events=record.apply(this,args);
    if(events.length)posts.set(args[2].observation_ref,structuredClone({detail:events[0].detail,memory:memory(events[0].memory)}));
    return events;
  }));
  hooks.push(mock.method(SharedSeriesConstraint.prototype,'before',function(p,index,packet,observation){
    const real=before.call(this,p,index,packet,observation);
    if(p.chamber_relation_plan&&real.admitted&&index===0){
      const foreign=before.call(this,p,index,packet,{...observation,observation_ref:observation.observation_ref+':stale'});
      guards.set(observation.observation_ref,{real,foreign,expected:p.steps[index].expected_before,
        point:p.steps[index].point_support&&[p.steps[index].point_support.point,p.steps[index].point_support.palette_value]});
    }
    return real;
  }));
  try{
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine),service=createService();
    const game=await loadGame('CATR',vendor,engine),sessionId='catr-42';
    let board=game.initial;
    let result=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    const issued=()=>{
      if(!result.ticket)return null;
      const {snapshot,ticket}=result,p=snapshot.proposal,plan=p.chamber_relation_plan,ref=ticket.observationRef;
      const release=snapshot.trace.findLast(x=>x.kind==='sic_native_plan'),guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      return structuredClone({ref,ticket:ticket.id,index:ticket.actionIndex,level:board.level,family:release?.family??snapshot.lastDecision,
        entry:p.field_subquestion??null,type:p.kind,command:[ticket.actionRef,ticket.data??{}],guard:{admitted:guard?.admitted,reason:guard?.reason},
        envelope:guards.get(ref)??null,refs:p.route_refs,cut:cuts.get(ref)??null,disposition:proposals.get(ref)??null,
        plan:plan&&{kind:plan.kind,edits:plan.edits,predicted:plan.predicted,candidate:cmp(plan.candidate)}});
    };
    for(let i=1;i<=4;i++){
      while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i-1});
      const pre=issued();
      if(!pre)break;
      const actual=await game.step(Number(pre.command[0].slice(6)),pre.command[1]);
      const replace=i===1&&variant==='stationnaire';
      const shown=replace?{...actual,frame:board.frame,frames:[board.frame]}:actual;
      turn=i+1;
      result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(shown,i),executionMs:0});
      const e=result.snapshot.trace.findLast(x=>x.kind==='actual_outcome'),after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,
        levels:shown.levelsCompleted,packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        physical:digest(actual.frame),shown:digest(shown.frame),record:posts.get(e.observation_ref)??null};
      steps.push({i,issued:pre,after});board=shown;
      if(replace){
        while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i});
        break;
      }
    }
    return {steps,next:issued(),stop:result.reason??null,last:[...proposals.values()].at(-1)??null};
  }finally{
    for(const hook of hooks.reverse())hook.mock.restore();
    delete globalThis[tap];
    loader.deregister();
  }
}
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide)),r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.issued.type,JSON.stringify(s.issued.command),s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop,r.last?.rawReason);
}
