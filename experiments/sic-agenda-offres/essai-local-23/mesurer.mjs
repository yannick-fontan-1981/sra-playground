import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { candidate, loadService } from './service.mjs';
import { board, openFixture } from './fiche.mjs';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { digest } from '../frontiere-22-23/observation.mjs';
import { digest as nativeDigest } from '../../../src/logos-engine/canonical.ts';

const [root = candidate.href, mode = 'dev', vendor] = process.argv.slice(2);
const start = await loadService(root);
const base = JSON.parse(await readFile(new URL('developpement.json', import.meta.url), 'utf8'));
const results = {};
async function trial(session, d, after) {
  assert.equal(d.family, 'observed_frontier');
  assert.equal(d.strategy, 'test_local_input');
  assert.equal(d.kind, 'experiment');
  assert.equal(d.need.parentObjective, 'G_protocol_completion');
  assert.deepEqual(d.need.subjects, [d.pre.local.ref]);
  assert.equal(d.question.id, d.pre.local.ref);
  assert.equal(d.pre.local.context, d.pre.index);
  assert.equal(d.pre.routeStatus, 'unqueried');
  assert.equal(d.pre.remote, null);
  const chosen = d.pre.domain.find(v => v.command.action_ref === d.ticket.actionRef);
  assert.deepEqual(chosen.tried, []);
  assert.equal(d.expectedAfter, null);
  assert.equal(d.predictedEffectUnknown, true);
  assert.equal(d.ticket.observationRef, d.pre.observation);
  assert.equal(d.ticket.actionIndex, 0);
  assert.equal(d.ticket.actionRef, d.pre.local.action.action_ref);
  assert.deepEqual(d.guard, { family: d.family, index: 0, admitted: true, pointBound: true, beforeRelease: true,
    reason: 'current_public_premises_match_provisional_step' });
  assert.deepEqual(d.release, { revision: d.ticket.decisionRevision, admitted: true, nativeGate: true });
  const r = await session.advance(d.ticket.id, after);
  assert.equal(r.frontier.objective, d.question.id);
  assert.equal(r.frontier.need, d.need.id);
  assert.equal(r.frontier.status, 'observed');
  assert.equal(r.status, 'unknown_effect_observed');
  assert.equal(r.matched, null);
  assert.equal(r.need.status, 'observed');
  assert.deepEqual(r.need.subjects, [d.question.id]);
  assert.equal(r.need.latestPlan, d.plan);
  assert.ok(r.need.evidence.includes(r.after));
  assert.equal(r.before, r.transition.before);
  assert.equal(r.after, r.transition.after);
  assert.equal(r.transition.command.action_ref, d.ticket.actionRef);
  assert.equal(r.transition.acquisition, 'transition:' + await nativeDigest([r.before, d.pre.local.action, r.after]));
  return r;
}
function summarize(d, r) {
  return { pre: d.preSha256, occurrence: d.pre.observation, question: d.question.id, command: d.ticket.actionRef,
    ranking: d.ranking, guard: d.guard, release: d.release, ticket: d.ticket, receipt: r, need: d.need.id };
}
if (mode === 'dev') {
  // Le premier retour au même contexte supprime une seule question de l'ensemble ouvert.
  const { session, decision: first } = await openFixture(start, base);
  const stale = async id => {
    const before = session.fingerprint();
    await assert.rejects(() => session.advance(id, board(base.depart)), e => e.code === 'stale');
    assert.equal(session.fingerprint(), before);
  };
  await stale('foreign-ticket');
  const r1 = await trial(session, first, board(base.depart));
  const second = await session.decision();
  await stale(first.ticket.id);
  const r2 = await trial(session, second, board(base.depart));
  assert.deepEqual([first.ticket.actionRef, second.ticket.actionRef], ['ACTION1', 'ACTION2']);
  assert.equal(first.pre.index, second.pre.index);
  assert.notEqual(first.need.id, second.need.id);
  assert.deepEqual(second.pre.domain.find(v => v.command.action_ref === 'ACTION1').tried, [r1.transition.acquisition]);
  const stopped = await session.decision();
  assert.equal(stopped.ticket, null);
  assert.equal(stopped.pre.local, null);
  assert.equal(stopped.pre.routeStatus, 'exhausted');
  assert.equal(stopped.need.status, 'open');
  results.cycle = [summarize(first, r1), summarize(second, r2)];
  results.suspension = { pre: stopped.preSha256, reason: stopped.reason, need: stopped.need };
  for (const domain of [[2, 1], [2]]) {
    const { decision, session: other } = await openFixture(start, { ...base, depart: { ...base.depart, commandes: domain } });
    assert.equal(decision.ticket.actionRef, domain.length === 2 ? 'ACTION1' : 'ACTION2');
    if (domain.length === 2) assert.equal(decision.question.id, first.question.id);
    results['domaine' + domain.join('')] = summarize(decision, await trial(other, decision, board({ fond: 0, commandes: domain })));
  }

  // Même historique réalisé et deux questions locales de même priorité.
  const entry = { fond: 1, commandes: [1] }, here = base.depart;
  const card = { ...base, depart: entry, historique: [here] };
  const variants = [];
  for (const order of ['least_tried', 'command_order']) {
    const { decision, history, session: other } = await openFixture(start, card, order);
    assert.equal(history[0].transition.command.action_ref, 'ACTION1');
    assert.ok(decision.pre.domain.every(v => v.tried.length === 0));
    assert.equal(decision.ranking.questions.length, 2);
    assert.equal(new Set(decision.ranking.questions.map(q => q.priority)).size, 1);
    assert.equal(decision.ranking.alternatives.usageGap, 1);
    const ranked = order === 'least_tried' ? decision.ranking.alternatives.leastTried : decision.ranking.alternatives.commandOrder;
    assert.equal(decision.question.id, ranked);
    variants.push({ history: history[0].transition, pre: decision.pre });
    results[order] = summarize(decision, await trial(other, decision, board(here)));
  }
  assert.deepEqual(variants[0].history, variants[1].history);
  assert.deepEqual(variants[0].pre.domain, variants[1].pre.domain);
  assert.equal(variants[0].pre.observation, variants[1].pre.observation);
  assert.deepEqual([results.least_tried.command, results.command_order.command], ['ACTION2','ACTION1']);

  // Avec le trajet déjà appris, la relève est identifiée et comptée à part.
  const b = { fond: 1, commandes: [1,2,3] }, a = { fond: 0, commandes: [4] };
  const remote = await openFixture(start, { ...base, depart: b, historique: [a, b, a] });
  const access = remote.decision;
  assert.equal(access.pre.local, null);
  assert.equal(access.pre.routeStatus, 'found');
  assert.equal(access.strategy, 'reach_open_input');
  assert.equal(access.ticket.actionRef, 'ACTION4');
  results.relais22 = { pre: access.preSha256, route: access.pre.path[0].ref, question: access.pre.remote.ref,
    strategy: access.strategy, ticket: access.ticket.id };
  // Changer uniquement la troisième observation retournée. La même question
  // préparée par open() à destination devient alors une offre locale immédiate.
  const local = await openFixture(start, { ...base, depart: b, historique: [a, b, b] });
  assert.deepEqual(local.history.slice(0, 2), remote.history.slice(0, 2));
  assert.equal(local.history[2].before, remote.history[2].before);
  assert.deepEqual(local.history[2].transition.command, remote.history[2].transition.command);
  assert.notEqual(local.history[2].after, remote.history[2].after);
  assert.equal(local.decision.pre.local.ref, access.pre.remote.ref);
  assert.equal(local.decision.pre.local.context, access.pre.remote.context);
  assert.equal(local.decision.need.id, access.need.id);
  results.reutilisation = summarize(local.decision, await trial(local.session, local.decision, board(b)));
}
if (vendor) {
  const game = await loadGame('G50T', vendor, root), session = await start(game.initial);
  const decision = await session.decision();
  const sample = JSON.parse(await readFile(new URL('../frontiere-22-23/temoins.json', import.meta.url)));
  const expected = sample.references.find(row => row.game === 'G50T');
  assert.equal(decision.preSha256, expected.preSha256);
  assert.equal(decision.ticket.id, expected.ticket);
  assert.equal(decision.ticket.actionRef, expected.command);
  assert.equal(decision.question.id, expected.question);
  const after = game.step(Number(decision.ticket.actionRef.slice(6)), decision.ticket.data);
  const r = await trial(session, decision, after);
  assert.equal(r.after, expected.after);
  results.G50T = summarize(decision, r);
}
process.stdout.write(JSON.stringify({ results, sha256: digest(results) }));
