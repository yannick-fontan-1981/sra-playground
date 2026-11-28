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
const geometry=m=>m&&{signature:m.signature,word:m.word,boxes:m.boxes.map(b=>({bbox:b.bbox,capacity:b.capacity,filter:b.filter,
  second:b.second_field,mode:b.mode}))};
const method=e=>({box:e.box,field:e.field,before:e.before,after:e.after,signature:e.signature,evidence:e.evidence,
  authority:e.authority,source:e.source_epoch});
const offer=o=>({kind:o.kind,key:o.key,cost:o.cost,action:o.action,edit:o.edit,facts:o.facts,settings:o.plan.settings,
  methods:o.method_revalidation.methods.map(method),search:o.search});
const variants=['nominal','sans-methode','preuve-etrangere','stationnaire'];

export async function play(engine,variant,vendor){
  assert.ok(variants.includes(variant));
  const load=n=>import(new URL('src/logos-engine/'+n+'.ts',engine));
  const {WindowQuestion}=await load('v6-window-question');
  const {measure}=await load('v6-window-question-geometry');
  const family=WindowQuestion.prototype,nativeOffers=family.nativeOffers,record=family.recordSource;
  const cuts=new Map(),returns=new Map();
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1;
  hooks.push(mock.method(family,'nativeOffers',async function(obs,rows,remaining,execution){
    const original=this.edits,originalPortable=this.portable;
    const observed=measure(rows),signature=observed&&digest(observed.signature);
    const same=e=>digest(e.signature)===signature;
    let removed=[],foreign=null;
    if(turn===4&&variant==='sans-methode'){
      removed=[...original,...originalPortable.flatMap(x=>x.methods)].filter(same);
      assert.ok(removed.length);
      this.edits=original.filter(e=>!same(e));
      this.portable=originalPortable.map(x=>({...x,methods:x.methods.filter(e=>!same(e))}));
    }else if(turn===4&&variant==='preuve-etrangere'){
      const example=[...original,...originalPortable.flatMap(x=>x.methods)].find(same);
      assert.ok(example);
      foreign={...example,signature:['qualification-foreign-window'],evidence:['qualification:unrelated-window']};
      this.edits=[...original,foreign];
    }
    try{
      const pre=structuredClone({ref:obs.observation_ref,remaining,available:obs.available_action_refs,geometry:geometry(observed),
        edits:this.edits.map(method),portable:this.portable.map(x=>({epoch:x.source_epoch,methods:x.methods.map(method)})),
        attempts:Object.keys(this.attempts)});
      const r=await nativeOffers.call(this,obs,rows,remaining,execution);
      cuts.set(obs.observation_ref,{pre,seal:digest(pre),removed:removed.map(method),foreign:foreign&&method(foreign),
        offers:r.offers.map(offer),bound:r.bound});
      return r;
    }finally{this.edits=original;this.portable=originalPortable;}
  }));
  hooks.push(mock.method(family,'recordSource',function(...args){
    const registered=record.apply(this,args);
    if(registered)returns.set(args[1].observation_ref,structuredClone({registered,edits:this.edits.map(method),
      attempts:Object.keys(this.attempts),links:this.launches.map(e=>({frames:e.frames,evidence:e.evidence,authority:e.authority}))}));
    return registered;
  }));
  try{
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine),service=createService();
    const game=await loadGame('HPDL',vendor,engine),sessionId='hpdl-75';
    let board=game.initial;
    let result=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    const issued=()=>{
      if(!result.ticket)return null;
      const {snapshot,ticket}=result,p=snapshot.proposal,plan=p.window_question_plan,ref=ticket.observationRef,step=p.steps[ticket.actionIndex];
      const release=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      return structuredClone({ref,ticket:ticket.id,index:ticket.actionIndex,level:board.level,family:release?.family??snapshot.lastDecision,
        type:p.kind,entry:p.material_access_subquestion??null,command:[ticket.actionRef,ticket.data??{}],
        guard:{admitted:guard?.admitted,reason:guard?.reason},refs:p.route_refs,cut:cuts.get(ref)??null,
        bundle:p.bundle_template?.operation_key??null,point:step.point_binding?.point??null,
        plan:plan&&{offer:offer(plan.offer),choice:plan.choice,workflow:plan.workflow}});
    };
    const limit=variant==='nominal'?16:5;
    for(let i=1;i<=limit;i++){
      while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i-1});
      const pre=issued();
      if(!pre)break;
      const actual=await game.step(Number(pre.command[0].slice(6)),pre.command[1]);
      const replace=i===4&&variant==='stationnaire';
      const shown=replace?{...actual,frame:board.frame,frames:[board.frame]}:actual;
      turn=i+1;
      result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(shown,i),executionMs:0});
      const e=result.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:shown.levelsCompleted,
        packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        presented:digest(shown.frame),physical:digest(actual.frame),record:returns.get(e.observation_ref)??null};
      steps.push({i,pre,after});board=shown;
      if(replace){
        while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i});
        break;
      }
    }
    return {steps,stop:result.reason??null,next:issued(),lastCut:[...cuts.values()].at(-1)??null};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide)),r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.type,JSON.stringify(s.pre.command),s.pre.plan?.offer.kind,s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
