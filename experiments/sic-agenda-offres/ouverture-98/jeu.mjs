import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { observeOpening } from './sonde.mjs';

const [vendor,root = new URL('../../../',import.meta.url).href,code='DICO',mode='active',variant] = process.argv.slice(2);
const pre = observeOpening(root,variant === 'autre-egalite');
const { createService, packet, defaultRecoveryPack } = await evaluateurJeu(root);
const game = await loadGame(code,vendor,root);
mock.method(Date,'now',()=>1700000000000);
const service = createService(), initial = game.initial, sessionId = 'subset-qualification';
const recovery = mode === 'absent' ? defaultRecoveryPack : { ...defaultRecoveryPack, openingCuriosity:mode };
let result = await service.handle({ type:'init',sessionId,sequence:0,budgets:{
  targetLevels:initial.levelCount,levelActionCaps:Array(initial.levelCount).fill(600)
},observation:packet(initial,0),recovery });
const steps = code === 'DICO' && mode === 'active' && !variant ? 2 : 1;
const report=[];
for (let i=0;i<steps;i++) {
  while(result.kind==='boundary') result=await service.handle({type:'resume',sessionId,sequence:i});
  const t=result.ticket, s=result.snapshot;
  assert.ok(t);
  const p=s.proposal, f=p.sic_frontier_decision, receipt=s.trace.findLast(e=>e.kind==='sic_native_plan');
  const guard=s.trace.findLast(e=>e.kind==='before_guard');
  const row={ step:i+1,level:t.level,slate:pre.findLast(r=>r.pre.observation===t.observationRef) ?? null,
    ticket:t,family:receipt.family,strategy:receipt.strategy,kind:p.kind,
    opening:f?.openingCuriosity ?? null,objective:f?.objective ?? null,need:f?.need?.id ?? null,
    guard:{admitted:guard.admitted,reason:guard.reason} };
  const board=await game.step(Number(t.actionRef.slice(6)),t.data);
  result=await service.handle({type:'advance',sessionId,sequence:i+1,ticketId:t.id,observation:packet(board,i+1),executionMs:0});
  const event=result.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
  report.push({...row,returned:{after:event.observation_ref,matched:event.matched,status:event.status,completed:board.levelsCompleted,
    acquired:event.sic_frontier_outcome ?? null}});
}
process.stdout.write(JSON.stringify(report));
