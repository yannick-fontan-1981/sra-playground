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
const cell=([x,y])=>x+','+y;
function coverage(encoded){
  if(!encoded)return null;
  const {targets,bodies,dim,axis}=encoded;
  const target=new Set(targets.map(cell));
  return bodies.map(body=>{
    const direct=body.filter(p=>target.has(cell(p)));
    const reflected=body.map(p=>p.map((v,i)=>i===dim?2*axis-v:v)).filter(p=>target.has(cell(p)));
    return {direct,reflected};
  });
}
const reflectedMemory=(owner,encode)=>{
  const world=owner.world&&encode(owner.world);
  return {ready:owner.ready,axes:[...owner.axes_seen],effects:[...owner.effects],
    known:[...owner.current_known],refs:[...owner.refs],world,covered:coverage(world)};
};
function containMemory(owner,inputs=[]){
  const poses=owner.positions,bodies=owner.bodies?.map(x=>({origin:x.origin,color:x.color,shapeSize:x.shape.length,
    shellSize:x.shell.length,shape:digest(x.shape),shell:digest(x.shell)}));
  const plain=inputs.filter(c=>!c.data || !Object.hasOwn(c.data,'x')).map(c=>c.action_ref).sort();
  const availableCalibration=plain.filter(action=>!owner.vectors.has(action)&&!owner.noMoves.has(JSON.stringify([action,poses])));
  return {poses,bodies,goals:owner.goals,assignments:owner.assignments,active:owner.active,plain,availableCalibration,
    vectors:[...owner.vectors],refs:[...owner.motionRefs],noMoves:[...owner.noMoves.values()]};
}
const snapshot=x=>({fact:structuredClone(x),seal:digest(x)});
const variants=['nominal','autre-calibrage','retour-contenant','preuve-reflet','retrait-reflet','retour-reflet','reprise-reflet'];

export async function play(engine,variant,count,vendor){
  assert.ok(variants.includes(variant));
  assert.ok(Number.isInteger(count)&&count>=4&&count<=16);
  const {Containment,containmentNeighborhood}=await import(new URL('src/logos-engine/v6-containment.ts',engine));
  const {ReflectedCover,encodeReflectedWorld,measureReflectedLattice}=await import(new URL('src/logos-engine/v6-reflected-cover.ts',engine));
  let turn=1,recording=1;
  const refs8=new Map(),refs77=new Map(),post8=new Map(),post77=new Map();
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  const c=Containment.prototype,r=ReflectedCover.prototype;
  const choices=c.choices,record8=c.record,propose77=r.propose,solve=r.solve,record77=r.record;
  hooks.push(mock.method(c,'choices',function(obs,inputs){
    const before=snapshot(containMemory(this,inputs));
    const nominal=choices.call(this,obs,inputs);
    refs8.set(obs.observation_ref,before);
    return nominal;
  }));
  if(c.chooseCalibration) {
    const select=c.chooseCalibration;
    hooks.push(mock.method(c,'chooseCalibration',function(offered){
      if(turn===1&&variant==='autre-calibrage')return select.call(this,offered.slice(1));
      return select.call(this,offered);
    }));
  }
  hooks.push(mock.method(c,'record',function(...args){
    const event=record8.apply(this,args);
    const rim=this.assignments?.length===1?this.assignments[0].map((goal,i)=>{
      const [x,y]=this.goals[goal],points=containmentNeighborhood(this.bodies[i].shape);
      const read=rows=>points.map(([dx,dy])=>rows[y+dy]?.[x+dx]??null);
      const before=read(args[3]),after=read(args[4]);
      return {goal:[x,y],size:points.length,before:[...new Set(before)],after:[...new Set(after)],
        unchanged:digest(before)===digest(after)};
    }):null;
    post8.set(args[1].observation_ref,structuredClone({event,rim,...containMemory(this)}));
    return event;
  }));
  let currentReference;
  hooks.push(mock.method(r,'propose',async function(obs,rows,inputs,remaining){
    const pre=reflectedMemory(this,encodeReflectedWorld);
    const lattice=measureReflectedLattice(rows,this.world);
    const geometry=lattice&&{dim:lattice.dim,axis:lattice.axis,pitch:lattice.pitch,dims:[lattice.nx,lattice.ny]};
    const allowed=turn===4&&variant==='reprise-reflet'?Math.min(12,remaining):remaining;
    const entry={pre:snapshot({...pre,geometry,remaining,allowed})};
    refs77.set(obs.observation_ref,entry);
    currentReference=entry;
    try{return await propose77.call(this,obs,rows,inputs,allowed);}
    finally{currentReference=undefined;}
  }));
  hooks.push(mock.method(r,'solve',function(world){
    const pre=reflectedMemory(this,encodeReflectedWorld);
    const solution=turn===4&&variant==='retrait-reflet'?null:solve.call(this,world);
    // L’appel synchrone n’existe que dans propose et suit immédiatement
    // la liaison de la géométrie et du marqueur courants.
    currentReference.solved={pre:snapshot(pre),solution:structuredClone(solution)};
    return solution;
  }));
  hooks.push(mock.method(r,'record',function(...args){
    if(recording===3&&variant==='preuve-reflet'){
      const suppressed={status:'qualification_return_withheld',events:[]};
      post77.set(args[1].observation_ref,{...suppressed,...reflectedMemory(this,encodeReflectedWorld)});
      return suppressed;
    }
    const result=record77.apply(this,args);
    post77.set(args[1].observation_ref,structuredClone({...result,...reflectedMemory(this,encodeReflectedWorld)}));
    return result;
  }));
  try{
    const {createService,defaultRecoveryPack,packet}=await evaluateurJeu(engine),service=createService();
    const game=await loadGame('AR25',vendor,engine),sessionId='ar25-qualification';
    let board=game.initial;
    let result=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    for(let i=1;i<=count;i++){
      while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i-1});
      if(!result.ticket)break;
      const {ticket,snapshot}=result,p=snapshot.proposal,index=ticket.actionIndex,ps=p.steps[index],ref=ticket.observationRef;
      const g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const pre=structuredClone({level:board.level,ref,ticket:ticket.id,index,family:snapshot.lastDecision,kind:p.kind,
        command:[ticket.actionRef,ticket.data??null],guard:g?.admitted,guardReason:g?.reason,
        facts:p.facts,refs:p.route_refs,steps:p.actions?.map(a=>a.action_ref),
        containment:refs8.get(ref)??null,reflection:refs77.get(ref)??null,
        containmentPlan:p.containment_plan&&{...p.containment_plan,mode:ps.mode,body:ps.body,expected:ps.expected_after},
        reflectionPlan:p.support_plan?.reflected_cover?{plan:p.support_plan,before:ps.expected_before,after:ps.expected_after,
          coveredBefore:coverage(ps.expected_before),coveredAfter:coverage(ps.expected_after)}:null});
      const actual=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);
      const replace=variant==='retour-contenant'&&i===1||variant==='retour-reflet'&&i===4;
      const shown=replace?{...actual,frame:board.frame,frames:[board.frame]}:actual;
      recording=i;turn=i+1;
      result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:ticket.id,observation:packet(shown,i),executionMs:0});
      const e=result.snapshot.trace.findLast(v=>v.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:shown.levelsCompleted,
        packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        presented:digest(shown.frame),actual:digest(actual.frame),containment:post8.get(e.observation_ref)??null,
        reflection:post77.get(e.observation_ref)??null};
      steps.push({i,pre,after});
      if(replace)break;
      board=shown;
    }
    if(variant==='retour-contenant'||variant==='retour-reflet'){
      while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:steps.length});
    }
    return {steps,next:result.ticket&&{kind:result.snapshot.proposal.kind,family:result.snapshot.lastDecision,
      action:result.ticket.actionRef,index:result.ticket.actionIndex,ref:result.ticket.observationRef},reason:result.reason??null};
  }finally{
    for(const h of hooks.reverse())h.mock.restore();
  }
}
if(import.meta.main){
  const {values}=parseArgs({options:{moteur:{type:'string',default:'candidat'},source:{type:'string'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},gestes:{type:'string',default:'12'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,Number(values.gestes),resolve(values.pyodide));
  const result=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(result,null,2)+'\n');
  for(const s of result.steps)console.log([s.i,s.pre.level,s.pre.family,s.pre.kind,s.pre.command[0],s.after.matched,s.after.levels].join(' '));
}
