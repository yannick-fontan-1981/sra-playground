import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mock } from 'node:test';
import { parseArgs } from 'node:util';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { withEngine } from '../moteur-reference.mjs';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function readCard(file) {
  const c = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(c.version,'sic.as66/1');
  assert.ok(Object.keys(c).every(k=>['version','limite','gestes','examiner','intervention'].includes(k)));
  assert.ok(c.limite===null || Number.isInteger(c.limite) && c.limite>=1 && c.limite<=600);
  assert.ok(Number.isInteger(c.gestes) && c.gestes>=1 && c.gestes<=20);
  assert.ok(Array.isArray(c.examiner) && c.examiner.every(i=>Number.isInteger(i) && i>=1 && i<=c.gestes));
  if(c.intervention){
    assert.deepEqual(Object.keys(c.intervention).sort(),['geste','type']);
    assert.ok(Number.isInteger(c.intervention.geste) && c.intervention.geste>=1 && c.intervention.geste<=c.gestes);
    assert.ok(['retirer_acces','retirer_horloge','plateau_precedent'].includes(c.intervention.type));
  }
  return c;
}
function phase(sample) {
  return {ref:sample.evidence,action:sample.action,position:sample.position,delta:sample.delta,
    taille:sample.size,motif:digest(sample.pattern),avantActeur:sample.before_actor};
}
function offer(proposal) {
  if(!proposal)return null;
  const plan=proposal.support_plan, geometry=plan.geometry;
  return {type:proposal.kind,actions:proposal.actions.map(c=>c.action_ref),positions:plan.positions,
    refs:proposal.route_refs,facts:proposal.facts,phase:plan.clock_evidence,
    masques:plan.mask_regions,hypotheses:plan.conditional_assumptions,
    geometrie:geometry && {corps:geometry.open_cavity_body_bbox,cavite:geometry.open_cavity_core_bbox,
      surface:geometry.open_cavity_connecting_surface_ref,route:geometry.open_cavity_conditional_route_action_refs,
      arriveeDirecte:geometry.open_cavity_next_stop_equals_core,nonRetour:geometry.open_cavity_nonreturn_first_action_refs,
      arrets:geometry.open_cavity_recalled_stop_claim_refs}};
}
async function examine(owner, state, args, propose) {
  // Chaque variante part de la même mémoire acquise avant la proposition réelle.
  const test=async (change,horizon=args[3])=>{
    const copy=Object.create(Object.getPrototypeOf(owner));
    Object.assign(copy,owner);
    copy.restore(state);
    change(copy);
    const p=await propose.call(copy,args[0],args[1],args[2],horizon);
    return p && {type:p.kind,actions:p.actions.map(a=>a.action_ref),positions:p.support_plan.positions};
  };
  const withoutDirections={};
  for(const command of Object.keys(state.directions))
    withoutDirections[command]=await test(c=>{delete c.directions[command];});
  const result={sansDirection:withoutDirections,sansArrets:await test(c=>{c.stops=[];}),
    sansOffreHorloge:await test(c=>{c.clock.propose=()=>null;}),
    sansOffreAcces:typeof owner.proposeAccess==='function'?await test(c=>{c.proposeAccess=()=>null;}):'raccord_absent'};
  if(state.clock.measurements.length>=2) {
    result.uneMesure=await test(c=>{c.clock.measurements=c.clock.measurements.slice(-1);});
    result.memeCommande=await test(c=>{c.clock.measurements.at(-2).action=c.clock.measurements.at(-1).action;});
    result.masqueDecale=await test(c=>{c.clock.measurements.at(-1).position[0]+=1;});
    result.horizons={};
    for(let n=1;n<=6;n++) result.horizons[n]=await test(()=>{},n);
  }
  return result;
}
export async function play(engine,card,vendor) {
  const { SlidingCavity }=await import(new URL('src/logos-engine/v6-sliding-cavity.ts',engine));
  const { CavityClock }=await import(new URL('src/logos-engine/v6-cavity-clock.ts',engine));
  const family=SlidingCavity.prototype,propose=family.propose,access=family.proposeAccess,clockOffer=CavityClock.prototype.propose;
  const local=new Map(),directionRefs={},steps=[];
  let turn=1;
  const intervention=()=>card.intervention?.geste===turn?card.intervention.type:null;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  if (access) hooks.push(mock.method(family,'proposeAccess',function(...args){
    return intervention()==='retirer_acces'?null:access.apply(this,args);
  }));
  hooks.push(mock.method(CavityClock.prototype,'propose',function(...args){
    return intervention()==='retirer_horloge'?null:clockOffer.apply(this,args);
  }));
  const record=family.record;
  hooks.push(mock.method(family,'record',function(...args){
    const before={...this.directions};
    const result=record.apply(this,args);
    for(const [id,v] of Object.entries(this.directions)) if(digest(before[id]??null)!==digest(v)){
      directionRefs[id]={avant:args[0].observation_ref,apres:args[1].observation_ref,images:args[7]?.length??0};
    }
    return result;
  }));
  hooks.push(mock.method(family,'propose',async function(...args){
    const [obs,,,remaining]=args;
    const pre=structuredClone({ref:obs.observation_ref,image:obs.frame_hash,restant:remaining,
      corps:this.body_type,sol:this.floor,directions:this.directions,sourcesDirections:directionRefs,
      arrets:this.stops.map(s=>s.claim_ref),methodes:this.scored.map(s=>s.evidence),
      phase:this.clock.measurements.slice(-2).map(phase)});
    const seal=digest(pre),state=card.examiner.includes(turn)?this.state():null;
    const p=await propose.apply(this,args);
    const variants=state?await examine(this,state,args,propose):null;
    local.set(obs.observation_ref,{pre,seal,offre:offer(p),variantes:variants});
    return p;
  }));
  try {
    const game=await loadGame('AS66',vendor,engine);
    const {createService,defaultRecoveryPack,packet}=await evaluateurJeu(engine);
    const service=createService(),sessionId='as66-qualification';
    let board=game.initial;
    const budgets={targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),
      ...(card.limite===null?{}:{maxActions:card.limite})};
    let result=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,budgets,observation:packet(board,0)});
    for(let i=1;i<=card.gestes;i++) {
      while(result.kind==='boundary') result=await service.handle({type:'resume',sessionId,sequence:i-1});
      if(!result.ticket)break;
      const {ticket,snapshot}=result,ref=ticket.observationRef,p=snapshot.proposal,index=ticket.actionIndex;
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const clock=p.support_plan?.clock_composition;
      const before={niveau:board.level,ref,appel:local.get(ref)??null,famille:snapshot.lastDecision,type:p.kind,
        ticket:ticket.id,indice:index,commande:ticket.actionRef,plan:p.actions?.map(a=>a.action_ref),garde:guard?.admitted,
        position:p.support_plan?.positions?.[index],arretPrevu:p.support_plan?.positions?.[index+1],
        branches:clock?[...SlidingCavity.clockMatches(board.frame,p.support_plan,index)]:null};
      const next=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);
      const physical=digest(next.frame);
      const packetDigest=digest([next.frame,next.frames,next.availableActionIds,next.level,next.levelsCompleted,next.state]);
      if(intervention()==='plateau_precedent'){next.frame=board.frame;next.frames=[board.frame];}
      turn=i+1;
      result=await service.handle({type:'advance',sessionId,sequence:i,ticketId:ticket.id,observation:packet(next,i),executionMs:0});
      const outcome=result.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      const after={ref:outcome?.observation_ref,accord:outcome?.matched,scelle:outcome?.seal_prefix,motif:outcome?.reason,
        niveaux:next.levelsCompleted,physique:physical,paquetJeu:packetDigest,presente:digest(next.frame),images:next.frames.length,
        branches:clock?[...SlidingCavity.clockMatches(next.frame,p.support_plan,index+1)]:null};
      steps.push({geste:i,before,after}); board=next;
      if(card.limite===null && board.levelsCompleted>=3)break;
    }
    return {budgets,coupure:card.gestes,etat:result.kind,motif:result.reason??null,steps};
  } finally {for(const h of hooks.reverse())h.mock.restore();}
}
if(import.meta.main) {
  const {values}=parseArgs({options:{pyodide:{type:'string'},fiche:{type:'string'},moteur:{type:'string',default:'candidat'},recu:{type:'string'}}});
  const card=await readCard(values.fiche),result=await withEngine(values.moteur,e=>play(e,card,resolve(values.pyodide)));
  if(values.recu)await writeFile(values.recu,JSON.stringify(result,null,2)+'\n');
  for(const s of result.steps)console.log([s.geste,s.before.niveau,s.before.type,s.before.commande,s.before.indice,s.after.accord,s.after.niveaux].join(' '));
}
