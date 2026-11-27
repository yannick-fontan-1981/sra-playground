import { mock } from 'node:test';
import { observe, sha } from './sonde.mjs';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { loadGame } from '../frontiere-22-23/game.mjs';

export const root = new URL('../../../',import.meta.url).href;

export function validate(card) {
  if (!card || card.version !== 'sic.contact/1' || !Array.isArray(card.couleurs) ||
    ![0,2].includes(card.couleurs.length) || new Set(card.couleurs).size !== card.couleurs.length ||
    card.couleurs.some(n=>!Number.isInteger(n)||n<0||n>15) ||
    !Number.isInteger(card.gestes)||card.gestes<1||card.gestes>24 ||
    !card.pack || typeof card.pack !== 'object' || Array.isArray(card.pack) ||
    Object.keys(card).some(key=>!['version','couleurs','gestes','pack','retourModifie'].includes(key))) throw Error('Fiche sic.contact/1 invalide');
  if ('retourModifie' in card) {
    const patch=card.retourModifie;
    if (!patch || Object.keys(patch).sort().join(',')!=='couleurs,geste,zone' ||
      !Number.isInteger(patch.geste) || patch.geste<1 || patch.geste>card.gestes ||
      !Array.isArray(patch.couleurs) || patch.couleurs.length!==2 || new Set(patch.couleurs).size!==2 ||
      patch.couleurs.some(c=>!Number.isInteger(c)||c<0||c>15) ||
      !Array.isArray(patch.zone) || patch.zone.length!==4 || patch.zone.some(v=>!Number.isInteger(v)||v<0||v>63) ||
      patch.zone[0]>patch.zone[2] || patch.zone[1]>patch.zone[3]) throw Error('Retouche publique invalide');
  }
}
function recolor(board,colors) {
  if (!colors.length) return board;
  const [a,b] = colors;
  const frame = rows=>rows.map(row=>row.map(v=>v===a?b:v===b?a:v));
  const palette = board.palette?.slice();
  if (palette) [palette[a],palette[b]]=[palette[b],palette[a]];
  return {...board,frame:frame(board.frame),frames:board.frames.map(frame),...(palette ? {palette} : {})};
}
export async function play(card,vendor,engine=root) {
  validate(card);
  const decisions = observe(engine);
  const {createService,packet,defaultRecoveryPack} = await evaluateurJeu(engine);
  const {compileRecoveryPack} = await import(new URL('src/sic/active-recovery.ts',engine));
  const {measureRootedLine,physicalRootedLine} = await import(new URL('src/logos-engine/v6-rooted-line-observation.ts',engine));
  const recovery = compileRecoveryPack({...defaultRecoveryPack,...card.pack});
  const clock = mock.method(Date,'now',()=>1700000000000);
  try {
    const game = await loadGame('SK48',vendor,engine), service = createService();
    const sessionId = 'contact-qualification', steps = [];
    let board = recolor(game.initial,card.couleurs);
    let result = await service.handle({type:'init',sessionId,sequence:0,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600)},
      observation:packet(board,0),recovery});
    for(let i=0;i<card.gestes && board.levelsCompleted===0;i++) {
      while(result.kind==='boundary') result=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket} = result;
      if(!ticket) return {steps,stop:{kind:result.kind,phase:result.phase,reason:result.reason,decision:snapshot.lastDecision,
        beforeChoice:decisions.at(-1) ?? null}};
      const proposal = snapshot.proposal, plan = proposal.rooted_line_plan;
      const receipt=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'), guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const old=measureRootedLine(board.frame), search=plan?.search, sic=search?.sic_decision;
      const counter=plan?.memory.refuted.at(-1), index=ticket.actionIndex;
      const beforeChoice=decisions.findLast(r=>r.data.ref===ticket.observationRef) ?? null;
      // Cette projection et son sceau sont établis avant de demander une action au jeu.
      const pre={ref:ticket.observationRef,frame:ticket.frameHash,layout:old?.layout,physical:old && physicalRootedLine(old),
        order:old?.order,model:plan?.kind,expected:plan?.predictions[index] ?? null,
        counter:counter ?? null,scope:sic?.need?.scope,need:sic?.needId ?? null,strategy:sic?.strategy ?? null,
        evidence:search?.recovery_evidence ?? [],operations:search?.recovery_operations?.map(op=>op.key) ?? [],
        agenda:sic?.agenda?.map(e=>[e.strategy ?? e.id,e.result]) ?? [],visited:sic?.visited ?? null,
        distance:search?.predicted_goal_distance ?? null,bundle:proposal.bundle_template?.operation_key ?? null};
      const seal=sha(pre);
      let next=recolor(await game.step(Number(ticket.actionRef.slice(6)),ticket.data),card.couleurs);
      if (card.retourModifie?.geste===i+1) {
        const {zone:[l,t,r,b],couleurs:[a,bis]}=card.retourModifie;
        const edit=rows=>rows.map((row,y)=>y<t || y>b ? row : row.map((v,x)=>{
          if (x<l || x>r) return v;
          return v===a ? bis : v===bis ? a : v;
        }));
        next={...next,frame:edit(next.frame),frames:next.frames.map(edit)};
      }
      result=await service.handle({type:'advance',sessionId,sequence:i+1,ticketId:ticket.id,observation:packet(next,i+1),executionMs:0});
      const event=result.snapshot.trace.findLast(e=>e.kind==='actual_outcome'), scene=measureRootedLine(next.frame);
      steps.push({step:i+1,beforeChoice,
        pre,seal,ticket:{id:ticket.id,command:ticket.actionRef,index,level:ticket.level,frame:ticket.frameHash},
        family:receipt?.family,kind:proposal.kind,guard:{admitted:guard?.admitted,reason:guard?.reason},
        returned:{ref:event?.observation_ref,matched:event?.matched,seal:event?.seal_prefix,reason:event?.reason,
          need:event?.sic_need ?? null,completed:next.levelsCompleted,physical:scene && physicalRootedLine(scene)}});
      board=next;
    }
    return {steps,stop:{completed:board.levelsCompleted}};
  } finally {clock.mock.restore();}
}
