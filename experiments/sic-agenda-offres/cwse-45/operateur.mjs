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
const scene=s=>({layout:s.layout,actor:s.actor,slots:s.slots,bodies:s.bodies,orientation:s.orientation});
const witness=s=>({nodes:s.nodes,visits:s.visits,bounded:s.bounded,reason:s.stop_reason,pathLength:s.path.length,
  first:s.path.slice(0,3).map(([delta,pose])=>({delta,actor:pose[0]}))});
const modes=['nominal','priorite','stationnaire','sans-effet'];

export async function play(engine,variant,vendor,arm){
  assert.ok(modes.includes(variant));
  const url=new URL('src/logos-engine/v6-exposed-reception-access.ts',engine).href;
  const channel=Symbol.for('sic.cwse.45.search'),searches=new Map();
  globalThis[channel]=(observation,search)=>searches.set(observation.observation_ref,structuredClone(witness(search)));
  const loader=registerHooks({load(specifier,context,next){
    const result=next(specifier,context);
    if(specifier!==url)return result;
    const source=result.source.toString(),marker='nodes = search.nodes; visits = search.visits;';
    assert.equal(source.split(marker).length,2);
    return {...result,source:source.replace(marker,'globalThis[Symbol.for("sic.cwse.45.search")](observation,search); '+marker)};
  }});
  const native=n=>import(new URL('src/logos-engine/'+n+'.ts',engine));
  const {ExposedReceptionMemory}=await native('v6-exposed-reception-access');
  const {measureExposedReception}=await native('v6-exposed-reception-observation');
  const {SharedSeriesConstraint}=await native('v6-shared-series');
  const family=ExposedReceptionMemory.prototype,propose=family.propose,record=family.record,before=SharedSeriesConstraint.prototype.before;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  const cuts=new Map(),guards=new Map(),posts=new Map();
  let turn=1;
  hooks.push(mock.method(family,'propose',function(obs,rows,inputs,remaining,configuration){
    const view=measureExposedReception(rows),original=this.receptionControls,cfg=configuration.exposed_reception_question;
    if(!view||!cfg)return propose.call(this,obs,rows,inputs,remaining,configuration);
    let changed=configuration,removed=null;
    if(turn===1&&variant==='priorite'){
      const [a,b,...rest]=cfg.probe_order;
      changed={...configuration,exposed_reception_question:{...cfg,probe_order:[b,a,...rest]}};
    }
    if(variant==='sans-effet'&&turn===arm.turn){
      const { [arm.action]:missing,...others }=original;
      assert.ok(missing,'effet à retirer non acquis');
      removed={action:arm.action,...missing};
      this.receptionControls=others;
    }
    try{
      searches.delete(obs.observation_ref);
      const before=structuredClone({ref:obs.observation_ref,scene:scene(view),controls:this.receptionControls,
        memory:this.receptionState,models:this.receptionModels,available:obs.available_action_refs,
        priority:changed.exposed_reception_question.probe_order,remaining});
      const answer=propose.call(this,obs,rows,inputs,remaining,changed);
      cuts.set(obs.observation_ref,{before,seal:digest(before),removed,search:searches.get(obs.observation_ref)??null,
        result:{status:answer?.status??null,reason:answer?.reason??null,kind:answer?.exposed_reception_plan?.kind??null,
          commands:answer?.actions?.map(c=>c.action_ref)??null,blocking:answer?.block_unrelated_probe??false}});
      return answer;
    }finally{this.receptionControls=original;}
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const events=record.apply(this,args);
    if(events.length){
      const e=events[0];
      posts.set(args[2].observation_ref,structuredClone({detail:e.detail,controls:e.controls,models:e.models,
        probed:e.state.probed,refs:e.state.evidence}));
    }
    return events;
  }));
  hooks.push(mock.method(SharedSeriesConstraint.prototype,'before',function(proposal,index,packet,observation){
    const real=before.call(this,proposal,index,packet,observation);
    if(index===0&&real.admitted&&proposal.exposed_reception_plan){
      const foreign=before.call(this,proposal,index,packet,{...observation,observation_ref:observation.observation_ref+':stale'});
      guards.set(observation.observation_ref,{real,foreign,expected:proposal.steps[index].expected_before,
        point:proposal.steps[index].point_support??null});
    }
    return real;
  }));
  try{
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine),service=createService();
    const game=await loadGame('CWSE',vendor,engine),sessionId='cwse-45';
    let board=game.initial;
    let result=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    const issued=()=>{
      if(!result.ticket)return null;
      const {snapshot,ticket}=result,p=snapshot.proposal,plan=p.exposed_reception_plan,ref=ticket.observationRef;
      const release=snapshot.trace.findLast(x=>x.kind==='sic_native_plan'),g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      return structuredClone({level:board.level,ref,ticket:ticket.id,index:ticket.actionIndex,family:release?.family??snapshot.lastDecision,
        entry:p.field_subquestion??null,type:p.kind,command:ticket.actionRef,data:ticket.data??{},cut:cuts.get(ref)??null,
        guard:{admitted:g?.admitted,reason:g?.reason},envelope:guards.get(ref)??null,refs:p.route_refs,
        plan:plan&&{kind:plan.kind,commands:plan.commands.map(c=>c.action_ref),expected:plan.predicted[ticket.actionIndex]??null}});
    };
    for(let i=1;i<=arm.limit;i++){
      while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i-1});
      const pre=issued();
      if(!pre)break;
      const actual=await game.step(Number(pre.command.slice(6)),pre.data);
      const replaced=variant==='stationnaire'&&i===1;
      const shown=replaced?{...actual,frame:board.frame,frames:[board.frame]}:actual;
      turn=i+1;
      result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(shown,i),executionMs:0});
      const e=result.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:shown.levelsCompleted,
        packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        physical:digest(actual.frame),presented:digest(shown.frame),record:posts.get(e.observation_ref)??null};
      steps.push({i,pre,after});board=shown;
      if(replaced){
        while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i});
        break;
      }
    }
    return {steps,next:issued(),stop:result.reason??null,lastCut:[...cuts.values()].at(-1)??null};
  }finally{
    for(const h of hooks.reverse())h.mock.restore();
    loader.deregister();
    delete globalThis[channel];
  }
}
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},gestes:{type:'string',default:'16'},tour:{type:'string'},commande:{type:'string'},recu:{type:'string'}}});
  const arm={limit:Number(values.gestes),turn:Number(values.tour),action:values.commande};
  assert.ok(Number.isInteger(arm.limit)&&arm.limit>=1&&arm.limit<=16);
  if(values.variante==='sans-effet')assert.ok(Number.isInteger(arm.turn)&&arm.turn<=arm.limit&&/^(ACTION[1-5])$/.test(arm.action));
  const run=e=>play(e,values.variante,resolve(values.pyodide),arm),r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.type,s.pre.plan?.kind,s.pre.command,s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
