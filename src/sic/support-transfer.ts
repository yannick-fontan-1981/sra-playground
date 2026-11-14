import { declaredSupportOrders, materializeOrderedSupportTransferWitnesses, measureOrderedSupportScene, measureSupportBand,
  orderedSupportSelectionMatches, type OrderedSupportPolicy, type OrderedSupportScene, type MaterialBand } from '../logos-engine/v6-ordered-support.ts';
import { ObservedInputDomain, v6Canonical } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { sicNeedId } from './need-identity.ts';

export const supportTransferId = 'sic_ordered_support_transfer';
const objective = 'G_official_completion';
const strategy = 'transfer_exposed_member';
const graph = compileStrategyGraph({ id: 'complete_ordered_support', version: 1, order: 'FALLBACK', priorities: [strategy],
  strategies: { [strategy]: [{ fact: 'referenceBound', expected: true, label: 'Repeated supports and a distinct receiving reference are visible' }] },
}, ['referenceBound']);

type Transfer = { source: number; destination: number; member: MaterialBand; expected: number[][]; remaining: number };
type TransferProposal = NativeProposal & { transfer: Transfer; scene: OrderedSupportScene; before: NativeRows; key: string; needId: string };
const same = (a: unknown, b: unknown) => v6Canonical(a) === v6Canonical(b);

export function createSicSupportTransfer(policy: OrderedSupportPolicy): NativeFamily<TransferProposal> {
  let refused: string[] = [];
  let witnessed: { epoch: number; ref: string } | null = null;

  async function check(proposal: TransferProposal, index: number, rows: NativeRows) {
    if (index === 0) return orderedSupportSelectionMatches(proposal.before, rows, proposal.transfer);
    const current = await measureOrderedSupportScene(rows);
    return !!current && current.target === proposal.scene.target && same(current.configuration, proposal.transfer.expected)
      && same(current.structural_supports, proposal.scene.structural_supports);
  }

  return {
    id: supportTransferId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (!policy.enabled || remaining < 2 || !observation.available_action_refs.includes(policy.point_action)) return null;
      const scene = await measureOrderedSupportScene(rows);
      if (!scene || execution?.signal?.aborted) return null;
      const ref = observation.observation_ref;
      const key = v6Canonical([observation.level_epoch, scene.configuration, scene.target, scene.structural_supports]);
      if (refused.includes(key)) return null;
      const result = resolveStrategyGraph({ graph, mode: 'active',
        facts: { referenceBound: { value: true, evidence: [ref] } },
        planners: { [strategy]: () => materializeOrderedSupportTransferWitnesses({
          configuration: { support_extents: scene.configuration }, endpoint_support_index: scene.target,
          traversal_orders: declaredSupportOrders(scene.configuration.length, scene.target, policy.traversal_orders),
          maximum_state_expansions: policy.maximum_state_expansions, maximum_transfer_depth: Math.min(policy.maximum_transfer_depth, Math.floor(remaining / 2)),
        }).witnesses[0] ?? null },
      });
      const step = result.selected?.plan.steps[0];
      if (!step) return null;
      const source = step.source_support_index, destination = step.destination_support_index;
      const member = await measureSupportBand(rows, scene, source, step.extent);
      if (!member) return null;
      const expected = scene.configuration.map(stack => [...stack]);
      expected[destination]!.push(expected[source]!.pop()!);
      const actions: NativeCommand[] = [source, destination].map(index => {
        const [y, x] = scene.geometry.supports[index]!.point;
        return { action_ref: policy.point_action, data: { x, y } };
      });
      const label = 'Move the exposed member toward the support indicated by the reference';
      const proof = witnessed?.epoch === observation.level_epoch ? [ref, witnessed.ref] : [ref];
      const goal = { kind: 'reproduce_ordered_support_configuration', scope: ref.split(':revision:', 1)[0]!,
        subjects: [scene.geometry.supports[scene.target]!.support_ref], parentObjective: objective,
        satisfactionContract: 'official_progress_after_attested_ordered_transfers' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: proof };
      const id = `support:${need.id}`;
      const steps = await Promise.all(actions.map(async (action, index) => ({
        action, expected_after: index === 0 ? { selection: 'visible_member_selected' } : { configuration: expected },
        point_binding: await ObservedInputDomain.makeLocusWitness(observation, rows, [action.data.x!, action.data.y!],
          { reason: label, evidence: proof }),
      })));
      return { status: 'proposed', kind: supportTransferId, actions, steps, key, scene, before: rows, needId: need.id,
        transfer: { source, destination, member, expected, remaining: result.selected!.plan.steps.length },
        support_plan: { member, destination: scene.structural_supports[destination], scene: { target: scene.target } },
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        question: { reason: label, hypothesis_refs: proof }, route_refs: proof,
        sicLocalDecision: { strategy, objective: { id, label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          evidence: proof, preconditions: {}, preserve_refs: [], actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      const admitted = proposal.binding?.level_epoch === observation.level_epoch && (index === 0
        ? proposal.binding?.observation_ref === observation.observation_ref
        : index === 1 && orderedSupportSelectionMatches(proposal.before, packet.frame_rows, proposal.transfer));
      return { admitted, reason: admitted ? 'ordered_member_and_receiver_verified' : 'transfer_selection_unconfirmed' };
    },
    async after(proposal, index, before, after, _old, rows) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state || before.levels_completed !== after.levels_completed) {
        return { matched: null, seal_prefix: true, reason: 'official_boundary',
          ...(after.levels_completed > before.levels_completed ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
      }
      const matched = await check(proposal, index, rows);
      return { matched, seal_prefix: !matched || index === 1, reason: index === 0 ? 'check_transfer_selection' : 'check_ordered_transfer' };
    },
    async record(before, after, _command, _old, rows, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const matched = await check(proposal, index, rows);
      if (!matched && !refused.includes(proposal.key)) refused = [...refused.slice(-31), proposal.key];
      if (matched && index === 1) witnessed = { epoch: after.level_epoch, ref: after.observation_ref };
      return { events: [] };
    },
    state: () => ({ refused, witnessed }),
    restore(state: NativeRecord) {
      refused = structuredClone(state.refused as string[]);
      witnessed = structuredClone(state.witnessed as typeof witnessed);
    },
  };
}
