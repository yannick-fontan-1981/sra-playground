import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { observedCommandFrontier, observedCommandState, rememberCommandReturn, type ObservedCommandGraph } from './observed-command-frontier.ts';

export const trialRepeatedLinearControlsId = 'sic_trial_repeated_linear_controls';
export const trialRepeatedLinearControlsStrategies = {
  P05: 'Test one of the repeated linear elements as a click target',
  P07: 'Follow an observed return to an untested linear element',
};

type Target = { key: string; point: NativePoint; box: NativeBox };
type State = { epoch: number; tested: number; transitions: ObservedCommandGraph; options: Record<string, string[]> };
type Proposal = NativeProposal & { source: string; target: Target; keys: string[]; needId: string; expected?: string };
const initialize = (epoch: number): State => ({ epoch, tested: 0, transitions: {}, options: {} });

function repeatedTargets(rows: NativeRows): Target[] {
  const byLength = new Map<number, Target[]>();
  for (const { bbox: box } of geometricComponents(rows)) {
    const [left, top, right, bottom] = box;
    const width = right - left + 1, height = bottom - top + 1;
    const length = Math.max(width, height);
    const axisLength = width > height ? rows[0]!.length : rows.length;
    if (Math.min(width, height) !== 1 || length < 2 || length * 2 >= axisLength) continue;
    const point: NativePoint = [Math.floor((left + right) / 2), Math.floor((top + bottom) / 2)];
    const key = point.join(',');
    const group = byLength.get(length);
    if (group) group.push({ key, point, box });
    else byLength.set(length, [{ key, point, box }]);
  }
  return [...byLength.values()].filter(group => group.length > 1).flat();
}

export function createSicTrialRepeatedLinearControls(): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: trialRepeatedLinearControlsId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const available = observation.available_action_refs;
      if (!available.includes('ACTION6') || available.some(action => /^ACTION[1-5]$/.test(action))) return null;
      const local = state?.epoch === observation.level_epoch ? state : initialize(observation.level_epoch);
      const budget = Math.min(remaining, 40 - local.tested);
      if (budget < 1) return null;
      const ref = observation.observation_ref, source = observedCommandState(observation);
      const targets = repeatedTargets(rows), keys = targets.map(target => target.key);
      const frontier = observedCommandFrontier(local.transitions, source, keys, budget,
        position => position === source ? keys : local.options[position] ?? []);
      const target = frontier && targets.find(candidate => candidate.key === frontier.action);
      if (!target) return null;

      const mode = execution?.reasoningMode ?? 'exploration';
      const routeSupported = !!frontier.first;
      const facts = { eligibleProbe: !routeSupported, routeSupported, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = routeSupported ? 'P07' : 'P05';
      if (decision?.result !== strategy) return null;
      const label = trialRepeatedLinearControlsStrategies[strategy];
      const evidence = [ref, ...(frontier.first ? [frontier.first.evidence] : [])];
      const parent = 'G_official_completion';
      const goal = { kind: 'learn_click_effect_on_repeated_elements', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['repeated_linear_elements'], parentObjective: parent, satisfactionContract: 'observe_the_current_click_effect' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = 'test-repeated-lines:' + need.id;
      const [x, y] = target.point;
      const command = { action_ref: 'ACTION6', data: { x, y } };
      const actions = [command], expected = frontier.first?.destination;
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, target.point, { reason: label, evidence });
      return {
        status: 'proposed', kind: trialRepeatedLinearControlsId, source, target, keys, actions, needId: need.id,
        ...(expected ? { expected } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action: command, expected_after: null, point_binding: witness }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: { ...facts, repeatedLinearTargets: targets.length } },
        sicSituationCard: { strategy, need: 'Find which repeated elements respond to a click', situation: label, mode,
          evidence, agenda: [], triggerCard: decision.receipt.workflow, addressedRegion: target.box },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'linear_target_bound' : 'linear_target_context_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const destination = observedCommandState(after);
      const matched = proposal.expected ? proposal.expected === destination : null;
      const reason = matched === false ? 'previous_click_return_contradicted'
        : destination === proposal.source ? 'click_left_interface_unchanged' : 'click_changed_interface';
      return { matched, seal_prefix: true, reason };
    },
    record(before, after, _command, _first, _second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = state?.epoch === before.level_epoch ? state : initialize(before.level_epoch);
      local.tested++;
      local.options[proposal.source] = proposal.keys;
      rememberCommandReturn(local.transitions, proposal.source, observedCommandState(after), proposal.target.key, after.observation_ref);
      state = local;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
