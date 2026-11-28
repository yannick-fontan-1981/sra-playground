import { mock } from 'node:test';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { observeFrontier,digest } from '../frontiere-22-23/observation.mjs';
import { predict } from '../frontiere-22-23/prediction.mjs';
import { withEngine } from '../moteur-reference.mjs';

export async function play(engine,card,vendor) {
  const calls=new Map(),cursor=new Map(),steps=[];
  const loader=observeFrontier(seal=>{
    const pre=JSON.parse(seal.payload);
    calls.set(pre.observation,{pre,prediction:predict(seal),seal:seal.sha256});
  },engine);
  const clock=mock.method(Date,'now',()=>1700000000000);
  let branch;
  try {
    const {NativeCallerCoordinator}=await import(new URL('src/logos-engine/v6-native-caller.ts',engine));
    const original=NativeCallerCoordinator.prototype.returnedBranchOffer;
    branch=mock.method(NativeCallerCoordinator.prototype,'returnedBranchOffer',async function(obs,inputs) {
      const episode=this.goal.memory.episode.map(([a,k,b])=>[a.ref,k,b.ref]);
      const offer=await original.call(this,obs,inputs);
      cursor.set(obs.observation_ref,{episode,capacity:this.frontier.max_prefix,offer:offer && {actions:offer.actions,scope:offer.question?.return_focus,kind:offer.kind}});
      return offer;
    });
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine,card.horloge==='native'?()=>performance.now():()=>0);
    const game=await loadGame('REGN',vendor,engine),service=createService(),sessionId='frontier-qualification';
    let board=game.initial;
    const budgets={targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600)};
    if(card.budget!==null) budgets.maxActions=card.budget;
    let r=await service.handle({type:'init',sessionId,sequence:0,budgets,recovery:defaultRecoveryPack,observation:packet(board,0)});
    for(let n=1;n<=card.gestes;n++) {
      while(r.kind==='boundary') r=await service.handle({type:'resume',sessionId,sequence:n-1});
      if(!r.ticket) return {steps,stop:{kind:r.kind,reason:r.reason,decision:r.snapshot.lastDecision,phase:r.phase}};
      const {snapshot,ticket}=r,p=snapshot.proposal,ref=ticket.observationRef;
      const rule=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const choice=snapshot.sicFamilySelection,frontier=p.sic_frontier_decision;
      const pre={ref,frame:ticket.frameHash,level:board.level,global:choice?.selected,visites:choice?.visited,family:rule?.family,
        strategy:frontier?.strategy??rule?.strategy,kind:p.kind,cmd:ticket.actionRef,guard:guard?.admitted,ticket:ticket.id,index:ticket.actionIndex,
        path:p.route_refs,actions:p.actions,question:p.question?.question_ref,need:frontier?.need?.id??null,accessNeed:frontier?.prerequisite?.id??null,
        expected:p.steps?.[ticket.actionIndex]?.expected_after?.frame_hash??null,
        retourBranche:cursor.get(ref)??null,frontiere:calls.get(ref)??null};
      const seal=digest(pre);
      board=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);
      r=await service.handle({type:'advance',sessionId,sequence:n,ticketId:ticket.id,observation:packet(board,n),executionMs:0});
      const e=r.snapshot.trace.findLast(row=>row.kind==='actual_outcome');
      steps.push({n,pre,seal,after:{ref:e?.observation_ref,family:e?.family,status:e?.status,matched:e?.matched,
        seal:e?.seal_prefix,completed:board.levelsCompleted,outcome:e?.sic_frontier_outcome}});
    }
    return {steps,stop:{kind:'limite_du_releve',prochain:r.kind,raison:r.reason??null}};
  } finally {branch?.mock.restore();clock.mock.restore();loader.deregister();}
}
export async function readCard(path) {
  const c=JSON.parse(await readFile(path,'utf8'));
  if(c?.version!=='sic.regn.frontiere/1'||Object.keys(c).sort().join(',')!=='budget,gestes,horloge,version'||
    !['fixe','native'].includes(c.horloge)||!Number.isInteger(c.gestes)||c.gestes<1||c.gestes>32||
    !(c.budget===null||Number.isInteger(c.budget)&&c.budget>=1&&c.budget<=600)) throw Error('Fiche publique REGN invalide.');
  return c;
}
if(import.meta.main){
  const {values}=parseArgs({options:{fiche:{type:'string'},pyodide:{type:'string'},recu:{type:'string'},moteur:{type:'string',default:'candidat'}}});
  const card=await readCard(values.fiche);
  const result=await withEngine(values.moteur,e=>play(e,card,resolve(values.pyodide)));
  if(values.recu) await writeFile(values.recu,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({gestes:result.steps.length,arret:result.stop,selections:result.steps.filter(s=>s.pre.strategy==='reach_open_input'&&s.pre.index===0).map(s=>s.n),
    continuations:result.steps.filter(s=>s.pre.strategy==='reach_open_input'&&s.pre.index>0).map(s=>s.n),
    au16:result.steps[15]&&[result.steps[15].pre.family,result.steps[15].pre.strategy,result.steps[15].pre.cmd,result.steps[15].after.matched]}));
}
