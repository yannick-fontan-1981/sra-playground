import { mock } from 'node:test';
import { createHash } from 'node:crypto';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { loadGame } from '../frontiere-22-23/game.mjs';

export const root = new URL('../../../', import.meta.url).href;
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function rename(board, colors) {
  if (!colors.length) return board;
  const [a,b] = colors;
  const frame = rows => rows.map(row => row.map(v => v === a ? b : v === b ? a : v));
  return {...board, frame:frame(board.frame), frames:board.frames.map(frame)};
}
export async function play(card, vendor, engine=root, inspect=null) {
  const { PeriodicSums, measurePeriodicSums } = await import(new URL('src/logos-engine/v6-periodic-sums.ts',engine));
  const { createService, packet, defaultRecoveryPack } = await evaluateurJeu(engine);
  const captures = new Map(), records = new Map(), steps = [];
  let turnUnderChoice = 1;
  const propose = PeriodicSums.prototype.propose, record = PeriodicSums.prototype.record;
  const ph = mock.method(PeriodicSums.prototype, 'propose', async function(obs, rows, inputs, remaining) {
    const config=this.config;
    if (card.inverserQuestionsInitiales && !this.refs.length) {
      const rule=config.initial_control_question;
      this.config={...config,initial_control_question:{...rule,ordered_input_hypotheses:[...rule.ordered_input_hypotheses].reverse()}};
    }
    const pre = {obs:structuredClone(obs), rows, inputs, remaining, state:this.state(), config:this.config};
    const policy=this.selectQuestion, offered=[], targets=this.targets;
    const cut=card.retirerPreimage;
    let projection;
    if (cut?.geste===turnUnderChoice) this.targets=function(scene,reference) {
      const native=targets.call(this,scene,reference);
      if (!native) return native;
      const allowed=new Set(native);
      const removed=allowed.delete(JSON.stringify(cut.phases));
      projection={ref:reference.observation_ref,requested:cut.phases,removed,original:native.size,retained:allowed.size};
      return allowed;
    };
    if (policy) this.selectQuestion = options => {
      offered.push(structuredClone(options));
      return card.substitution?.geste===turnUnderChoice ? card.substitution.indice : policy(options);
    };
    let proposal;
    try { proposal=await propose.call(this,obs,rows,inputs,remaining); }
    finally { this.config=config; if (policy) this.selectQuestion=policy; if(cut?.geste===turnUnderChoice) delete this.targets; }
    if (proposal) captures.set(obs.observation_ref, {pre, proposal, offered, projection, propose, record});
    return proposal;
  });
  const rh = mock.method(PeriodicSums.prototype,'record',function(...args) {
    const result = record.apply(this,args);
    records.set(args[1].observation_ref, structuredClone(result));
    return result;
  });
  const clock = mock.method(Date,'now',()=>1700000000000);
  try {
    const game = await loadGame('ONDE',vendor,engine), service = createService(), sessionId = 'onde-qualification';
    let board = rename(game.initial,card.couleurs);
    let answer = await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:card.budget ?? 16},observation:packet(board,0)});
    for(let turn=1; turn<=card.gestes; turn++) {
      while(answer.kind==='boundary') answer=await service.handle({type:'resume',sessionId,sequence:turn-1});
      if (!answer.ticket) return {steps, stop:answer.reason ?? answer.kind};
      const {ticket,snapshot} = answer, ref=ticket.observationRef, source=captures.get(ref);
      const proposal=snapshot.proposal, i=ticket.actionIndex, step=proposal.steps?.[i];
      const scene=measurePeriodicSums(board.frame), plan=proposal.support_plan;
      const pre={ref,epoch:ticket.level,kind:proposal.kind,mode:plan?.mode,question:plan?.question_key,remaining:source?.pre.remaining,
        scene:scene && {periods:scene.tracks.map(t=>t.period),profiles:scene.tracks.map(t=>t.profile),colors:scene.tracks.map(t=>t.color),focus:scene.selected,
          detectors:scene.detectors.map(d=>({x:d.x,target:d.target,total:d.total,contributions:d.contributions})),
          controls:scene.controls.map(c=>({shape:c.shape,point:c.point}))},refs:proposal.route_refs,
        laws:source && {individual:source.pre.state.individual,collective:source.pre.state.collective},
        domain:plan?.preimage_proof,probe:step?.probe,expected:step?.expected_after??null};
      const seal=digest(pre);
      const variations=source && inspect ? await inspect(turn,source,engine,card) : undefined;
      const next=rename(await game.step(Number(ticket.actionRef.slice(6)),ticket.data),card.couleurs);
      turnUnderChoice=turn+1;
      answer=await service.handle({type:'advance',sessionId,sequence:turn,ticketId:ticket.id,observation:packet(next,turn),executionMs:0});
      const outcome=answer.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      steps.push({turn,level:board.levelsCompleted+1,family:snapshot.lastDecision,ticket:ticket.id,
        command:ticket.actionRef,data:ticket.data??null,guard:guard?.admitted,pre,seal,offers:source?.offered,projection:source?.projection,variations,
        after:{ref:outcome?.observation_ref,matched:outcome?.matched,seal:outcome?.seal_prefix,
          reason:outcome?.reason,completed:next.levelsCompleted,events:records.get(outcome?.observation_ref)?.events}});
      board=next;
    }
    return {steps,stop:'limit'};
  } finally {ph.mock.restore(); rh.mock.restore(); clock.mock.restore();}
}
