import { readFile } from 'node:fs/promises';
import { root } from './jouer.mjs';

// Une translation et son retour stationnaire dans une fixture indépendante du jeu.
export async function secondView(engine=root) {
  const native=p=>import(new URL('src/logos-engine/'+p,engine));
  const {NativeCallerCoordinator}=await native('v6-native-caller.ts');
  const {NativeReasoningMemory}=await native('v6-reasoning-memory.ts');
  const {measureNativeObservation,publicFrameHash,ObservedInputDomain}=await native('v6-native-observer.ts');
  const card=JSON.parse(await readFile(new URL('public/translation.json',import.meta.url)));
  function frame(dx,dy) {
    const rows=Array.from({length:card.hauteur},()=>Array(card.largeur).fill(0));
    for(const [x,y,c] of card.points) rows[y+dy][x+dx]=c;
    return rows;
  }
  const one=frame(0,0), two=frame(...card.decalage);
  const scope='fixture-continuite';
  async function measure(rows,i) {
    return measureNativeObservation({frame_rows:rows,frame_hash:await publicFrameHash(rows),level:1,levels_completed:0,
      state:'NOT_FINISHED',available_action_refs:['ACTION1','ACTION2','ACTION6']},i,scope);
  }
  const from=await measure(one,1),current=await measure(two,2),later=await measure(two,3);
  function caller(){
    return new NativeCallerCoordinator(new NativeReasoningMemory(),{targetLevels:2,domain:new ObservedInputDomain(256),
      strategy:{families:[]},informationGoal:'accessible_view_frontier',sicView:'active'});
  }
  const run=caller(), cmds=run.configuration.domain.candidates(current);
  const empty=await run.continuityOffer(current,cmds);
  const revealed=await run.view.record(from,current,{action_ref:'ACTION1',data:{}},one,two,{},0);
  const view=await run.viewOffer(current,two,cmds,16);
  const points=cmds.filter(c=>c.action_ref==='ACTION6');
  const point=await run.continuityOffer(current,points);
  const p=await run.continuityOffer(current,cmds);
  const guard=p?.status==='proposed'?await run.frontier.guard(p,current):null;
  const outcome=guard?.admitted?run.frontier.checkOutcome(p,later,0):null;
  if (outcome) await run.frontier.recordTransition(current,p.actions[0],later,{assessment:outcome,after_action_candidates:run.graphInputs(later)});
  const next=await run.continuityOffer(later,cmds);
  const last=await measure(two,4), nextGuard=await run.frontier.guard(next,later);
  if (!nextGuard.admitted) throw Error('Seconde sonde refusée');
  const acquired=run.frontier.checkOutcome(next,last,0);
  await run.frontier.recordTransition(later,next.actions[0],last,{assessment:acquired,after_action_candidates:run.graphInputs(last)});
  const exhausted=await run.continuityOffer(last,cmds);
  return {from:from.observation_ref,current:current.observation_ref,later:later.observation_ref,
    noQuestion:empty?.status ?? null,offeredPoints:points.length,withoutPlain:point,priorView:view?.status ?? null,
    reveal:{status:revealed.status,offset:revealed.registration.offset,pixels:revealed.new_viewport_pixels,block:revealed.blockage_question},
    evidence:run.view.continuityEvidence(),question:p?.sic_frontier_decision?.objective,need:p?.sic_frontier_decision?.need,
    action:p?.actions[0],guard,outcome,next:next?.actions?.[0],nextObjective:next?.sic_frontier_decision?.objective?.id,
    exhausted:{status:exhausted?.status,actions:exhausted?.actions,need:exhausted?.sic_frontier_refusal?.need?.status,
      agenda:exhausted?.sic_frontier_refusal?.agenda?.map(e=>[e.id,e.result])}};
}
