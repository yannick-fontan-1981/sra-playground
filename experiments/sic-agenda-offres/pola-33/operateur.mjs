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
const variants=['nominal','sans-attestation','axe-perpendiculaire','stationnaire','sans-methode'];

const summary=m=>m&&{selected:m.selected?.center??null,target:m.target,quantum:m.quantum,
  bodies:m.bodies.map(({center,axis,poles,marker,bbox})=>({center,axis,poles,marker,bbox}))};
const offer=o=>({key:o.key,action:o.action,kind:o.kind,distance:o.quarter_distance,turn:o.turn,
  peer:o.relation.peer.center,peerAxis:o.relation.peer.axis,actor:o.actor.center,actorAxis:o.actor.axis,
  desired:o.relation.desired_axis,hypothesis:o.relation.direction_hypothesis,dependencies:o.relation.dependency,
  projection:o.projection,scope:o.relation.scope,selection:o.selection_evidence,method:o.method_revalidation});

function rotatePeer(rows,m,point){
  const body=m?.bodies.find(b=>b.center.toString()===point.toString());
  assert.ok(body);
  assert.notDeepEqual(body.center,m.selected.center);
  const [left,top,right,bottom]=body.bbox,changed=rows.map(r=>[...r]);
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)changed[y][x]=rows[top+right-x][left+y-top];
  return changed;
}

export async function play(engine,variant,vendor,peer){
  assert.ok(variants.includes(variant));
  assert.ok(variant!=='axe-perpendiculaire'||peer?.length===2);
  const {AxialQuestion}=await import(new URL('src/logos-engine/v6-axial-question.ts',engine));
  const {measure}=await import(new URL('src/logos-engine/v6-axial-question-geometry.ts',engine));
  const family=AxialQuestion.prototype,cuts=new Map(),records=new Map(),checks=new Map(),slots=new WeakSet();
  const entry=family.proposeInSubquestion,offers=family.offers,before=family.before,record=family.recordObserved;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1;
  hooks.push(mock.method(family,'proposeInSubquestion',async function(...args){
    slots.add(this);
    try{return await entry.apply(this,args);}finally{slots.delete(this);}
  }));
  hooks.push(mock.method(family,'offers',function(obs,rows){
    if(!slots.has(this))return offers.call(this,obs,rows);
    const original=this.selection,portable=this.portable,base=summary(measure(rows));
    const scoped=turn===4&&variant==='axe-perpendiculaire'?rotatePeer(rows,measure(rows),peer):rows;
    if(turn===4&&variant==='sans-attestation')this.selection=null;
    if(turn===8&&variant==='sans-methode')this.portable=[];
    try{
      const used=structuredClone({observation:obs.observation_ref,scope:obs.level_epoch,actions:obs.available_action_refs,
        input:digest(rows),usedRows:digest(scoped),original:base,selection:this.selection,rotations:this.rotations,portable:this.portable});
      const [items,measurement]=offers.call(this,obs,scoped);
      const pre={...used,usedGeometry:summary(measurement),offers:items.map(offer)};
      cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
      assert.ok(scoped===rows||items.length===0,'A provider-only change must abstain before the real guard');
      return [items,measurement];
    }finally{this.selection=original;this.portable=portable;}
  }));
  hooks.push(mock.method(family,'before',function(p,i,packet,obs){
    const live=before.call(this,p,i,packet,obs);
    const old=before.call(this,p,i,packet,{...obs,observation_ref:obs.observation_ref+':old'});
    checks.set(obs.observation_ref,{live,old});
    return live;
  }));
  hooks.push(mock.method(family,'recordObserved',function(b,a,cmd,first,second,p,index,frames){
    const result=record.call(this,b,a,cmd,first,second,p,index,frames);
    if(result){
      const ordinals=result.native_packet_attribution?.accepted_frame_ordinals??[];
      records.set(a.observation_ref,structuredClone({result,selection:this.selection,rotations:this.rotations,
        portable:this.portable,attempts:Object.keys(this.attempts),input:summary(measure(first)),final:summary(measure(second)),
        compared:summary(measure(frames?.[ordinals.at(-1)??frames.length-1]??second)),
        oldCompared:ordinals.length>0,command:cmd.action_ref,owned:!!p?.axial_plan}));
    }
    return result;
  }));
  try{
    const {createService,defaultRecoveryPack,packet}=await evaluateurJeu(engine),service=createService(),
      game=await loadGame('POLA',vendor,engine),sessionId='pola-33';
    let board=game.initial;
    let r=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    const issued=()=>{
      if(!r.ticket)return null;
      const {snapshot,ticket}=r,p=snapshot.proposal,ref=ticket.observationRef;
      const release=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const plan=p.axial_plan;
      assert.ok(!plan||plan.offer);
      return structuredClone({ref,ticket:ticket.id,level:board.level,family:release?.family??snapshot.lastDecision,
        kind:p.kind,slot:p.material_access_subquestion??null,bundle:p.bundle_template?.operation_key??null,
        command:[ticket.actionRef,ticket.data??{}],guard:{admitted:g?.admitted,reason:g?.reason},scope:checks.get(ref)??null,
        refs:p.route_refs,cut:cuts.get(ref)??null,
        plan:plan&&{offer:offer(plan.offer),policy:{choice:plan.choice,workflow:plan.workflow},root:p.bundle_template.objective_ref}});
    };
    const limit=variant==='nominal'?16:variant==='stationnaire'?4:variant==='sans-methode'?9:5;
    for(let i=1;i<=limit;i++){
      while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i-1});
      const pre=issued();
      if(!pre)break;
      assert.equal(turn,i);
      const actual=await game.step(Number(pre.command[0].slice(6)),pre.command[1]);
      const replace=variant==='stationnaire'&&i===4;
      const shown=replace?board:actual;
      const publicShown=replace?{...shown,frames:[shown.frame]}:shown;
      turn=i+1;
      r=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(publicShown,i),executionMs:0});
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
    variante:{type:'string',default:'nominal'},pair:{type:'string'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide),values.pair?.split(',').map(Number));
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.kind,JSON.stringify(s.pre.command),s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
