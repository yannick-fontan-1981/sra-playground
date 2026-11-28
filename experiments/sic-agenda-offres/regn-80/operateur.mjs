import { createHash } from 'node:crypto';
import { mock } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { withEngine } from '../moteur-reference.mjs';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const brief = s => ({ref:s.ref,frame:s.frame_hash,epoch:s.epoch,score:s.score});
const option = q => ({question:q.question_ref,cmd:q.action,context:q.context_index,reason:q.reason,refs:q.hypothesis_refs});
export async function play(engine,card,vendor) {
  const {NativeCallerCoordinator}=await import(new URL('src/logos-engine/v6-native-caller.ts',engine));
  const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine);
  const original=NativeCallerCoordinator.prototype.returnedBranchOffer, calls=[], steps=[];
  let sequence=1;
  const observe=card.observer===false?null:mock.method(NativeCallerCoordinator.prototype,'returnedBranchOffer',async function(obs,inputs) {
    const graph=this.frontier, open=graph.open, propose=graph.propose, episode=this.goal.memory.episode;
    const fork=episode.length && graph.observations[episode.at(-1)[0].ref]?.index;
    const before={ref:obs.observation_ref,frame:obs.frame_hash,episode:episode.map(([a,cmd,b])=>[brief(a),cmd,brief(b)]),fork};
    const domains=[];
    const edit=card.intervention?.geste===sequence ? card.intervention.type : null;
    graph.open=async function(index,...args) {
      const questions=await open.call(this,index,...args);
      if(index!==fork) return questions;
      const offered=edit==='retirer_questions'?[]:edit==='inverser_questions'?[...questions].reverse():questions;
      domains.push({index,available:questions.map(option),offered:offered.map(option)});
      return offered;
    };
    graph.propose=function(observation,domain,options) {
      const evidence=edit==='retirer_retour'?options.return_episode.slice(0,-1):options.return_episode;
      before.used=evidence.map(([a,cmd,b])=>[a.ref,cmd,b.ref]);
      return propose.call(this,observation,domain,{...options,return_episode:evidence});
    };
    try {
      const p=await original.call(this,obs,inputs);
      calls.push({before,seal:digest(before),domains,decision:p?{kind:p.kind,plan:p.actions,question:option(p.question),
        focus:p.question.return_focus,routes:p.route_refs}:null});
      return p;
    } finally {delete graph.open;delete graph.propose;}
  });
  const clock=mock.method(Date,'now',()=>1700000000000);
  try {
    const service=createService(),game=await loadGame('REGN',vendor,engine),sessionId='regn-qualification';
    let board=game.initial;
    const budgets={targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600)};
    if(card.budget!==null) budgets.maxActions=card.budget;
    let result=await service.handle({type:'init',sessionId,sequence:0,budgets,recovery:defaultRecoveryPack,observation:packet(board,0)});
    for(let i=1;i<=card.gestes;i++){
      while(result.kind==='boundary') result=await service.handle({type:'resume',sessionId,sequence:i-1});
      if(!result.ticket) return {steps,stop:result.reason??result.kind};
      const {snapshot,ticket}=result,p=snapshot.proposal,index=ticket.actionIndex,st=p.steps?.[index];
      const receipt=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const ref=ticket.observationRef, obs=calls.findLast(s=>s.before.ref===ref);
      const pre={ref,level:board.level,frame:ticket.frameHash,global:snapshot.sicFamilySelection?.selected,
        family:receipt?.family,kind:p.kind,strategy:receipt?.strategy,frontier:p.sic_frontier_decision?.strategy,
        planned:p.actions,question:p.question && option(p.question),focus:p.question?.return_focus,edges:p.route_refs,
        step:index,expected:st?.expected_after?.frame_hash??null,open:st?.first_unresolved_effect,
        guard:guard?.admitted,ticket:ticket.id,cmd:ticket.actionRef,offer:obs??null};
      const seal=digest(pre);
      sequence=i+1;
      board=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);
      result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:ticket.id,observation:packet(board,i),executionMs:0});
      const event=result.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      steps.push({i,pre,seal,after:{ref:event?.observation_ref,family:event?.family,matched:event?.matched,
        seal:event?.seal_prefix,reason:event?.reason,status:event?.status,completed:board.levelsCompleted}});
    }
    return {steps,stop:'lecture'};
  } finally {clock.mock.restore();observe?.mock.restore();}
}
export async function readCard(path){
  const c=JSON.parse(await readFile(path,'utf8'));
  if(c?.version!=='sic.regn/1'||Object.keys(c).some(k=>!['version','gestes','budget','intervention','observer'].includes(k))||
    (c.observer!==undefined && typeof c.observer!=='boolean') || (c.observer===false && c.intervention!==undefined) ||
    !Number.isInteger(c.gestes)||c.gestes<1||c.gestes>32||
    !(c.budget===null||Number.isInteger(c.budget)&&c.budget>=c.gestes&&c.budget<=600)) throw Error('Fiche REGN invalide');
  const e=c.intervention;
  if(e!==undefined&&(!e||Object.keys(e).sort().join(',')!=='geste,type'||!Number.isInteger(e.geste)||e.geste<1||
    e.geste>c.gestes||!['inverser_questions','retirer_questions','retirer_retour'].includes(e.type))) throw Error('Intervention inconnue');
  return c;
}
if(import.meta.main){
  const {values}=parseArgs({options:{pyodide:{type:'string'},fiche:{type:'string'},moteur:{type:'string',default:'candidat'},recu:{type:'string'}}});
  const card=await readCard(values.fiche);
  const result=await withEngine(values.moteur,source=>play(source,card,resolve(values.pyodide)));
  if(values.recu) await writeFile(values.recu,JSON.stringify(result,null,2)+'\n');
  console.log(result.steps.map(({i,pre,after})=>[i,pre.level,pre.family,pre.frontier??pre.strategy,pre.cmd,after.matched].join(' ')).join('\n'));
}
