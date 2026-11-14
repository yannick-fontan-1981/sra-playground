import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { observedCommandFrontier, rememberCommandReturn, type ObservedCommandGraph } from './observed-command-frontier.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const publicInputExplorationId = 'sic_public_input_exploration';
export const publicInputStrategies = {
  compare_public_input: 'Test an available command on this board',
  revisit_input_frontier: 'Revisit a board with an untested command',
} as const;
const order = ['compare_public_input', 'revisit_input_frontier'] as const;
const graph = compileStrategyGraph({ id: 'understand_public_controls', version: 1, order: 'FALLBACK', priorities: order,
  strategies: {
    compare_public_input: [{ fact: 'untestedHere', expected: true, label: 'An available illustrated input has no return on this board' }],
    revisit_input_frontier: [{ fact: 'observedRoute', expected: true, label: 'Previously observed returns lead to an untested input' }],
  },
}, ['untestedHere', 'observedRoute']);
const explorationLimit = 40;
const clickLimit = 30;
const completion = 'G_official_completion';

type State = { epoch: number; experiments: number; transitions: ObservedCommandGraph; options: Record<string, string[]>;
  lastChange: { destination: string; action: string; evidence: string } | null };
type Proposal = NativeProposal & { source: string; candidates: string[]; expected?: string; needId: string };
const initial = (epoch = 0): State => ({ epoch, experiments: 0, transitions: {}, options: {}, lastChange: null });
const interfaceKey = (observation: NativeObservation) =>
  `${observation.frame_hash}:${[...observation.available_action_refs].sort().join(',')}`;
const commandKey = (command: NativeCommand) => command.action_ref === 'ACTION6'
  ? `ACTION6:${command.data.x},${command.data.y}` : command.action_ref;
const opposite: Readonly<Record<string, string>> = {
  ACTION1: 'ACTION2', ACTION2: 'ACTION1', ACTION3: 'ACTION4', ACTION4: 'ACTION3',
};

function visibleInputs(observation: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[]) {
  const candidates = new Map(inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref))
    .map(command => [commandKey(command), { command, box: null as NativeBox | null }]));
  if (!observation.available_action_refs.includes('ACTION6')) return candidates;
  const area = rows.length * rows[0]!.length;
  const parts = geometricComponents(rows).filter(component => component.area >= 2 && component.area * 4 < area)
    .sort((a, b) => b.area - a.area);
  for (const { bbox, mask } of parts.slice(0, clickLimit)) {
    const [left, top, right, bottom] = bbox;
    const distance = ([x, y]: NativePoint) => Math.abs(2 * x + left - right) + Math.abs(2 * y + top - bottom);
    const [x, y] = mask.reduce((best, point) => distance(point) < distance(best) ? point : best);
    const command = { action_ref: 'ACTION6', data: { x: x + left, y: y + top } };
    candidates.set(commandKey(command), { command, box: bbox });
  }
  return candidates;
}

export function createSicPublicInputExploration(): NativeFamily<Proposal> {
  let state = initial();
  return {
    id: publicInputExplorationId,
    async propose(observation, rows, inputs, remaining) {
      const local = state.epoch === observation.level_epoch ? state : initial(observation.level_epoch);
      const budget = Math.min(remaining, explorationLimit - local.experiments);
      if (budget < 1) return null;
      const source = interfaceKey(observation), ref = observation.observation_ref;
      const candidates = visibleInputs(observation, rows, inputs);
      const keys = [...candidates.keys()];
      const canDiversifyDirection = keys.includes('ACTION5')
        || (keys.some(key => key === 'ACTION1' || key === 'ACTION2') && keys.some(key => key === 'ACTION3' || key === 'ACTION4'));
      const lastChange = local.lastChange?.destination === source && canDiversifyDirection ? local.lastChange : null;
      const deferred = lastChange ? opposite[lastChange.action] : undefined;
      const frontier = observedCommandFrontier(local.transitions, source, keys, budget,
        board => board === source ? keys : local.options[board] ?? [], deferred);
      const offer = frontier && candidates.get(frontier.action);
      if (!offer) return null;
      const proof: [string, ...string[]] = [ref, ...(frontier.first ? [frontier.first.evidence] : []),
        ...(deferred && lastChange ? [lastChange.evidence] : [])];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        untestedHere: { value: frontier.depth === 0, evidence: proof },
        observedRoute: { value: frontier.depth > 0, evidence: proof },
      }, planners: { compare_public_input: () => offer, revisit_input_frontier: () => offer } });
      if (!selected) return null;
      const strategy = selected.id;
      const { command, box } = selected.plan;
      const label = publicInputStrategies[strategy];
      const goal = { kind: 'learn_public_command_effect', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['current_public_interface'], parentObjective: completion, satisfactionContract: 'observe_public_return_to_available_input' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: proof };
      const id = `public-input:${need.id}`, actions = [command];
      const witness = command.action_ref === 'ACTION6'
        ? await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], { reason: label, evidence: proof })
        : null;
      return {
        status: 'proposed', kind: publicInputExplorationId, actions, source, candidates: keys, needId: need.id,
        ...(frontier.first?.destination ? { expected: frontier.first.destination } : {}),
        steps: [{ action: command, expected_after: null, ...(witness ? { point_binding: witness } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Learn how to act on the current board', mode: 'exploration',
          situation: deferred && frontier.depth === 0 && frontier.probe !== deferred
            ? 'The last direction changed the board. Test another input before trying its opposite.'
            : label, agenda: entries, evidence: proof, ...(box ? { addressedRegion: box } : {}) },
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${completion}`] }],
        question: { reason: label, hypothesis_refs: proof }, route_refs: proof,
        sicLocalDecision: { strategy, objective: { id, label, parent: completion }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: completion, purpose: label,
          evidence: proof, preconditions: {}, preserve_refs: [], actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_public_input_bound' : 'public_input_scope_changed' };
    },
    after(proposal, _index, before, after) {
      const scored = after.levels_completed > before.levels_completed;
      const matched = !scored && proposal.expected ? proposal.expected === interfaceKey(after) : null;
      return { matched, seal_prefix: true, reason: scored ? 'official_boundary'
        : matched === false ? 'public_transition_contradicted' : 'observed_public_input_return',
        ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, command, _rows, _afterRows, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (state.epoch !== before.level_epoch) state = initial(before.level_epoch);
      state.experiments++;
      state.options[proposal.source] = proposal.candidates;
      const destination = interfaceKey(after), action = commandKey(command);
      rememberCommandReturn(state.transitions, proposal.source, destination, action, after.observation_ref);
      state.lastChange = destination === proposal.source ? null : { destination, action, evidence: after.observation_ref };
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}
