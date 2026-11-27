import { readFile } from 'node:fs/promises';
import { mock } from 'node:test';
import { digest, observeFrontier } from '../frontiere-22-23/observation.mjs';

export const candidate = new URL('../../../', import.meta.url);
export async function loadService(root = candidate) {
  const seals = [];
  observeFrontier((seal, ranking) => seals.push({ seal, pre: JSON.parse(seal.payload), ranking }), root, { includeRanking: true });
  const native = path => import(new URL('src/' + path, root));
  const { createNativeV6Runtime } = await native('logos-engine/v6-native-runtime.ts');
  const { V6AgentService } = await native('runtime/v6-agent-service.ts');
  const { hydrateNativeState } = await native('logos-engine/v6-native-state-graph.ts');
  const { defaultRecoveryPack } = await native('sic/active-recovery.ts');
  const { defaultBrowserFamilyAgenda } = await native('sic/family-agenda.ts');
  const { toV6PublicObservation, V6_DEFAULT_ACTIONS_PER_LEVEL } = await native('runtime/v6-agent-protocol.ts');
  const source = new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', root);
  const read = async path => JSON.parse(await readFile(new URL(path, source), 'utf8'));
  const declarations = { common: await read('laya_proto/common_frontier_policy.drm.json'), strategy: await read('morphology_policy/strategy.drm') };
  mock.method(Date, 'now', () => 1700000000000);

  // Une session active par opérateur. Les témoins sont remis à zéro à chaque départ.
  return async function start(board, order) {
    seals.length = 0;
    let runtime, sequence = 0;
    const recovery = order ? { ...defaultRecoveryPack, frontier: { inputOrder: order } } : defaultRecoveryPack;
    const service = new V6AgentService(pack => createNativeV6Runtime(declarations, {
      recovery: { ...pack, familyAgenda: defaultBrowserFamilyAgenda }, now: () => 0,
    }).then(value => runtime = value));
    const sessionId = 'frontier-qualification';
    const project = (board, i) => toV6PublicObservation({ ...board, gameCode: board.code ?? board.gameCode }, i);
    let result = await service.handle({ type: 'init', sessionId, sequence, observation: project(board, 0), recovery,
      budgets: { targetLevels: board.levelCount, levelActionCaps: Array(board.levelCount).fill(V6_DEFAULT_ACTIONS_PER_LEVEL) } });

    async function decision() {
      while (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence });
      const { ticket, snapshot } = result, trace = snapshot.trace;
      const refusal = trace.findLast(e => e.kind === 'sic_frontier_refusal');
      const occurrence = ticket?.observationRef ?? refusal?.observation_ref;
      const captured = seals.findLast(row => row.pre.observation === occurrence);
      const pre = captured?.pre ?? null, preSha256 = captured?.seal.sha256 ?? null;
      if (!ticket) return { ticket: null, pre, preSha256, need: refusal?.decision.need, reason: result.reason };
      const plan = trace.findLast(e => e.kind === 'sic_native_plan');
      const p = snapshot.proposal, f = p.sic_frontier_decision;
      const guard = trace.findLast(e => e.kind === 'before_guard' && e.index === ticket.actionIndex);
      const release = trace.findLast(e => e.kind === 'why_act_release' && e.decision_revision === ticket.decisionRevision);
      const guardAt = trace.lastIndexOf(guard), releaseAt = trace.lastIndexOf(release);
      return { pre, preSha256, ranking: captured?.ranking, ticket, family: plan.family, strategy: plan.strategy, kind: p.kind, plan: plan.id,
        question: f?.objective, need: f?.need, expectedAfter: p.steps?.[ticket.actionIndex]?.expected_after,
        predictedEffectUnknown: p.steps?.[ticket.actionIndex]?.first_unresolved_effect,
        guard: guard && { admitted: guard.admitted, reason: guard.reason, pointBound: guard.point_bound, family: guard.family, index: guard.index,
          beforeRelease: trace.findLastIndex(e => e.kind === 'actual_outcome') < guardAt && guardAt < releaseAt },
        release: release && { admitted: release.admitted, revision: release.decision_revision, nativeGate: release.native_gate } };
    }

    async function advance(ticketId, after) {
      const before = result.ticket, needId = result.snapshot.proposal?.sic_frontier_decision?.need.id;
      const next = await service.handle({ type: 'advance', sessionId, sequence: sequence + 1, ticketId,
        observation: project(after, sequence + 1), executionMs: 0 });
      result = next;
      sequence++;
      const outcome = next.snapshot.trace.findLast(e => e.kind === 'actual_outcome');
      const graph = runtime.inspectKnowledge();
      const read = id => graph.nodes[id] && hydrateNativeState(graph.nodes[id].value, k => graph.nodes[k]?.value);
      const need = needId && read(needId), transition = read('reasoning:transition:' + sequence);
      return { ticket: before.id, before: before.observationRef, after: outcome.observation_ref, plan: outcome.sic_plan,
        matched: outcome.matched, status: outcome.status, frontier: outcome.sic_frontier_outcome,
        need: need && { id: need.id, status: need.status, subjects: need.subjects, evidence: need.evidence,
          firstPlan: need.firstPlan, latestPlan: need.latestPlan },
        transition: transition && { before: transition.before, after: transition.after, command: transition.command,
          acquisition: transition.frontier_acquisition?.transition_ref }, graphChain: next.snapshot.graphChain };
    }

    return { decision, advance, fingerprint: () => digest([sequence, result.ticket, runtime.snapshot().graphChain]) };
  };
}
