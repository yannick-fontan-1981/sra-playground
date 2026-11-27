import assert from 'node:assert/strict';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { mock } from 'node:test';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { observeQueries, sha } from './sonde.mjs';

const [opening, vendor, engine, intervention] = process.argv.slice(2);
const root = engine ?? new URL('../../../', import.meta.url);
assert.ok(['catalogue', 'curieux'].includes(opening));
let captures = [], original, enableFork = false;
observeQueries(root, (family, obs, rows, remaining, value) => {
  const pre = structuredClone(value);
  captures.push({ pre, sha256: sha(pre) });
  if (enableFork) original = { state: family.state(), policy: family.policy, obs: structuredClone(obs), rows: structuredClone(rows), remaining };
}, intervention === 'autre-optimum');
const native = path => import(new URL('src/' + path, root));
const { SubsetDiagnosis } = await native('logos-engine/v6-subset-diagnosis.ts');
const { defaultRecoveryPack, createService, packet } = await evaluateurJeu(root);
const game = await loadGame('DICO', vendor, root);
const boards = [game.initial];
mock.method(Date, 'now', () => 1700000000000);

// Lecture après record(), pour les seuls retours de ce service, avec le mode et
// le ticket associés par l'appelant. Aucun record ou propose supplémentaire.
const savedRecord = SubsetDiagnosis.prototype.record;
let posts = [];
SubsetDiagnosis.prototype.record = function (...args) {
  const result = savedRecord.apply(this, args);
  const event = result.events?.find(e => e.kind === 'public_subset_feedback');
  posts.push({ before: args[0].observation_ref, after: args[1].observation_ref, command: structuredClone(args[2]),
    status: result.status, retained: this.candidates && [...this.candidates].sort((a,b)=>a-b),
    event: event ? { before: event.before, after: event.after, label: event.feedback, tested: event.tested,
      beforeDomain: event.candidates_before, afterDomain: event.candidates_after } : null });
  return result;
};
const pack = opening === 'curieux' ? { ...defaultRecoveryPack, openingCuriosity: 'active' } : defaultRecoveryPack;
async function play(mode) {
  const service = createService();
  const sessionId = 'subset-qualification', initial = boards[0];
  captures = []; posts = [];
  let result = await service.handle({ type: 'init', sessionId, sequence: 0, budgets: {
    targetLevels: initial.levelCount, levelActionCaps: Array(initial.levelCount).fill(600) }, observation: packet(initial, 0), recovery: pack });
  const rows = [];
  for (let i = 0; i < 4; i++) {
    enableFork = mode === 'game' && i === 3;
    while (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence: i });
    const t = result.ticket, s = result.snapshot, p = s.proposal;
    assert.ok(t, 'ticket du geste ' + (i+1));
    const receipt = s.trace.findLast(e => e.kind === 'sic_native_plan');
    const guard = s.trace.findLast(e => e.kind === 'before_guard');
    const offerSet = captures.findLast(c => c.pre.observation === t.observationRef);
    const plan = p.support_plan;
    const row = { step: i+1, level: t.level, family: receipt.family, strategy: receipt.strategy, kind: p.kind, ticket: t,
      opening: p.sic_frontier_decision?.openingCuriosity?.selected ?? null,
      guard: { admitted: guard.admitted, reason: guard.reason }, offerSet,
      query: plan?.subset_diagnosis ? { key: plan.question_key, mode: plan.mode, tested: plan.tested, candidates: plan.candidates } : null };
    if (mode === 'game') boards.push(await game.step(Number(t.actionRef.slice(6)), t.data));
    let after = boards[i+1];
    if (i === 3 && mode === 'stationary') after = { ...boards[i], frames: [boards[i].frame] };
    if (i === 3 && mode === 'last') after = { ...after, frames: [after.frame] };
    const start = posts.length;
    result = await service.handle({ type: 'advance', sessionId, sequence: i+1, ticketId: t.id, observation: packet(after,i+1), executionMs: 0 });
    const outcome = result.snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ ...row, after: outcome.observation_ref, matched: outcome.matched, result: outcome.reason,
      status: after.state, completed: after.levelsCompleted, frames: after.frames.length, feedback: posts.slice(start).at(-1) });
  }
  enableFork = false;
  return rows;
}
const rows = await play('game');
const report = { opening, rows };
if (!intervention && opening === 'catalogue' && rows[3].kind === 'subset_scope_query') {
  const fixture = original;
  assert.ok(fixture);
  const forks = [];
  // Deux restaurations hors ligne après le parcours nominal. Même observation et
  // même mémoire initiale. Le premier essai permute uniquement l'insertion.
  for (const values of [fixture.state.candidates, [...fixture.state.candidates].reverse()]) {
    const family = new SubsetDiagnosis(fixture.policy);
    family.restore({ ...structuredClone(fixture.state), candidates: values });
    const proposal = await family.propose(fixture.obs, fixture.rows, [], fixture.remaining);
    forks.push({ offerSet: captures.at(-1).sha256, key: proposal.support_plan.question_key,
      tested: proposal.support_plan.tested, command: proposal.actions[0] });
  }
  assert.deepEqual(forks[0], forks[1]);
  assert.equal(forks[0].offerSet, rows[3].offerSet.sha256);
  report.permutation = forks[0];
  // Contre-épreuve ultérieure : réexposer la géométrie du choix initial à
  // la seule population réduite, comme si l'on revenait sur cette vue.
  const revised = new SubsetDiagnosis(fixture.policy);
  const posterior = rows[3].feedback.event.afterDomain;
  revised.restore({ ...structuredClone(fixture.state), candidates: posterior });
  const previousCaptures = captures.length;
  const proposal = await revised.propose(fixture.obs, fixture.rows, [], fixture.remaining);
  report.posteriorOnSameView = { candidates: posterior, kind: proposal?.kind, tested: proposal?.support_plan?.tested,
    command: proposal?.actions[0], offerSet: captures.length > previousCaptures ? captures.at(-1) : null };
  for (const name of ['stationary','last']) {
    const variant = await play(name);
    for (let i=0;i<4;i++) assert.deepEqual(variant[i].ticket, rows[i].ticket);
    assert.deepEqual(variant[3].offerSet, rows[3].offerSet);
    report[name] = variant[3];
  }
}
process.stdout.write(JSON.stringify(report));
