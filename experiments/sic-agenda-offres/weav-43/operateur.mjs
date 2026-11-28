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
const variants=['nominal','stationnaire','sans-progression','sans-paire'];
const state=s=>s&&({ref:s.layout.ref,epoch:s.epoch,selected:s.selected,progress:s.progress,actions:s.actions,
  blocked:s.blocked,questions:s.questions,invalid:s.invalid});
const layout=l=>l&&({ref:l.ref,shape:l.shape,reference:l.reference,controllers:l.controllers.map(c=>({key:c.key,axis:c.axis,
  lane:c.lane,side:c.side,length:c.length,point:c.point,color:c.color}))});
const intent=p=>p&&({mode:p.mode,controller:p.controller,state:state(p.state_before),intent:p.intent});

function withoutAdvance(s,ack){
  assert.equal(s.actions[ack.key+':'+ack.index],ack.action);
  assert.equal(s.progress[ack.key],ack.index+1);
  const reduced=structuredClone(s);
  reduced.progress[ack.key]=ack.index;
  delete reduced.actions[ack.key+':'+ack.index];
  const retained=reduced.questions.filter(q=>q.source!==ack.ref);
  assert.equal(retained.length+1,reduced.questions.length);
  reduced.questions=retained;
  return reduced;
}

export async function play(engine,variant,vendor,selectedTurn){
  assert.ok(variants.includes(variant));
  assert.ok(variant==='nominal'||Number.isInteger(selectedTurn)&&selectedTurn>0);
  const path='src/logos-engine/v6-crossed-prefix-';
  const {CrossedPrefixMemory,crossedPrefixBefore,crossedPrefixAfter}=await import(new URL(path+'access.ts',engine));
  const geometry=await import(new URL(path+'observation.ts',engine));
  const {symbolicDigest}=await import(new URL('src/logos-engine/v6-hash.ts',engine));
  const family=CrossedPrefixMemory.prototype,cuts=new Map(),records=new Map(),checks=new Map();
  const question=family.crossQuestion,record=family.record;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1,firstAdvance=null;
  hooks.push(mock.method(family,'crossQuestion',function(obs,rows,inputs,options){
    const saved=this.crossState,pairs=this.pairs,incoming=this.currentState(),
      hide=turn===selectedTurn&&variant==='sans-progression',noPair=turn===selectedTurn&&variant==='sans-paire';
    if(hide){assert.ok(firstAdvance);this.crossState=withoutAdvance(saved,firstAdvance);}
    if(noPair){assert.equal(pairs.length,1);this.pairs=[];}
    try{
      const view=this.currentState(),measured=this.crossState?.layout??geometry.crossedPrefixGeometry(rows);
      const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,canonical:digest(rows),actions:obs.available_action_refs,
        layout:layout(measured),controls:measured?geometry.crossedPrefixMeasureControls(rows,measured):null,
        incoming:state(incoming.cross_state),state:state(view.cross_state),pairs:view.cross_pairs,
        incomingPairs:incoming.cross_pairs,axisInputs:view.cross_axis_inputs});
      cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
      const p=question.call(this,obs,rows,inputs,options);
      if(p?.crossed_prefix_plan){
        const plan=p.crossed_prefix_plan,meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,
          available:obs.available_action_refs};
        const changed=rows.map(row=>[...row]);
        const [x,y]=plan.state_before.layout.reference.origin;
        changed[y][x]=(changed[y][x]+1)%16;
        checks.set(obs.observation_ref,{live:crossedPrefixBefore(p,0,rows,meta),
          stale:crossedPrefixBefore(p,0,rows,{...meta,observation_ref:meta.observation_ref+':old'}),
          contrary:crossedPrefixBefore(p,0,changed,meta),
          contraryAtMatchingDigest:crossedPrefixBefore({...p,crossed_prefix_plan:{...plan,frame_digest:symbolicDigest(changed)}},0,changed,meta),
          contraryReturn:crossedPrefixAfter(p,0,rows,changed,{epoch:obs.level_epoch,score:obs.levels_completed,state:obs.state}),
          precedent:geometry.crossedPrefixReferencePresent(rows,plan.state_before.layout),
          referenceAltered:!geometry.crossedPrefixReferencePresent(changed,plan.state_before.layout)});
      }
      return p;
    }finally{if(hide)this.crossState=saved;if(noPair)this.pairs=pairs;}
  }));
  hooks.push(mock.method(family,'record',function(b,cmd,a,rows,later,p,index,options){
    const result=record.call(this,b,cmd,a,rows,later,p,index,options),plan=p.crossed_prefix_plan;
    if(!plan)return result;
    const after=result.find(e=>e.kind==='crossed_prefix_state'),cell=plan.mode==='advance'?plan.intent.cell:null;
    const slot=(input)=>cell?geometry.crossedPrefixSlot(input,plan.state_before.layout,cell):null;
    const old=slot(rows),next=slot(later),center=pixels=>pixels?.[Math.floor(pixels.length/2)]?.[Math.floor(pixels[0].length/2)]??null;
    records.set(a.observation_ref,structuredClone({events:result.filter(e=>e.kind!=='crossed_prefix_state'),
      state:state(after.state),outcome:after.outcome,ref:after.evidence,
      slot:cell&&{cell,changed:digest(old)!==digest(next),before:center(old),after:center(next)}}));
    if(!firstAdvance&&plan.mode==='advance'&&after.outcome.matched===true)
      firstAdvance={key:plan.controller.key,index:plan.intent.index,action:cmd.action_ref,ref:a.observation_ref};
    return result;
  }));
  try{
    const {createService,defaultRecoveryPack,packet}=await evaluateurJeu(engine),service=createService(),
      game=await loadGame('WEAV',vendor,engine),sessionId='weav-43';
    let board=game.initial;
    let r=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    const issued=()=>{
      if(!r.ticket)return null;
      const {snapshot,ticket}=r,p=snapshot.proposal,ref=ticket.observationRef;
      const release=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      return structuredClone({ref,ticket:ticket.id,level:board.level,family:release?.family??snapshot.lastDecision,
        kind:p.kind,slot:p.field_subquestion??null,bundle:p.bundle_template?.operation_key??null,
        command:[ticket.actionRef,ticket.data??{}],guard:{admitted:g?.admitted,reason:g?.reason},scope:checks.get(ref)??null,
        refs:p.route_refs,cut:cuts.get(ref)??null,plan:intent(p.crossed_prefix_plan),
        point:p.steps[ticket.actionIndex]?.point_binding??null});
    };
    const limit=variant==='nominal'?16:variant==='stationnaire'?selectedTurn:selectedTurn-1;
    for(let i=1;i<=limit;i++){
      while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i-1});
      const pre=issued();
      if(!pre)break;
      const actual=await game.step(Number(pre.command[0].slice(6)),pre.command[1]);
      const replace=variant==='stationnaire'&&i===selectedTurn;
      const shown=replace?{...board,frames:[board.frame]}:actual;
      turn=i+1;
      r=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(shown,i),executionMs:0});
      const e=r.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:shown.levelsCompleted,
        packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        physical:digest(actual.frame),presented:digest(shown.frame),record:records.get(e.observation_ref)??null};
      steps.push({i,pre,after});board=shown;
    }
    if(variant!=='nominal')while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:turn-1});
    return {steps,stop:r.reason??null,next:issued(),firstAdvance};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},tour:{type:'string'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide),Number(values.tour));
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.mode??s.pre.kind,JSON.stringify(s.pre.command),s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
