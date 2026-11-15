import type { NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { observedCommandFrontier, observedCommandState, oppositeDirection, rememberCommandReturn,
  stationaryDirectionalEvidence, type ObservedCommandGraph } from './observed-command-frontier.ts';

export const recheckDirectionalControlsId = 'sic_recheck_directional_controls';
export const recheckDirectionalControlsStrategies = {
  P05: 'Test an available control in the current interface',
  P07: 'Follow an observed return to an untested control',
};

type State = {
  epoch: number;
  transitions: ObservedCommandGraph;
  options: Record<string, string[]>;
  activation: { remaining: number; evidence: string[] } | null;
  lastChange: { action: string; destination: string; evidence: string } | null;
  stopped: boolean;
};
type Proposal = NativeProposal & { source: string; candidates: string[]; directions: string[];
  stage: 'direction' | 'activation' | 'recheck'; expected?: string; needId: string };

const initialize = (epoch: number): State => ({ epoch, transitions: {}, options: {}, activation: null, lastChange: null, stopped: false });

export function createSicRecheckDirectionalControls(): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: recheckDirectionalControlsId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, _rows, inputs, remaining, execution) {
      const local = state?.epoch === observation.level_epoch ? state : initialize(observation.level_epoch);
      if (local.stopped || remaining < 1 || !observation.available_action_refs.includes('ACTION5')) return null;
      const candidates = inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref));
      const keys = candidates.map(command => command.action_ref);
      const directions = keys.filter(action => action !== 'ACTION5');
      if (directions.length < 2) return null;

      const source = observedCommandState(observation);
      const outgoing = local.transitions[source] ?? [];
      const lastChange = local.lastChange?.destination === source ? local.lastChange : null;
      const frontier = local.activation && local.activation.remaining > 0
        ? observedCommandFrontier(local.transitions, source, keys, Math.min(remaining, local.activation.remaining),
          board => board === source ? keys : local.options[board] ?? [], lastChange ? oppositeDirection[lastChange.action] : undefined)
        : null;
      const untested = !local.activation ? directions.find(action => !outgoing.some(edge => edge.action === action)) : undefined;
      const stationary = !local.activation && !untested ? stationaryDirectionalEvidence(local.transitions, source, directions) : null;
      const input = frontier?.action ?? untested ?? (stationary ? 'ACTION5' : null);
      const command = candidates.find(candidate => candidate.action_ref === input);
      if (!command || !input) return null;

      const mode = execution?.reasoningMode ?? 'exploration';
      const routeSupported = !!frontier?.first;
      const facts = { eligibleProbe: !routeSupported, routeSupported, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = routeSupported ? 'P07' : 'P05';
      if (decision?.result !== strategy) return null;

      const ref = observation.observation_ref;
      const evidence = [...new Set([ref, ...(stationary ?? local.activation?.evidence ?? []),
        ...(frontier?.first ? [frontier.first.evidence] : []), ...(lastChange ? [lastChange.evidence] : [])])];
      const stage = local.activation ? 'recheck' : input === 'ACTION5' ? 'activation' : 'direction';
      const situation = stage === 'activation' ? 'The directions left the board unchanged. Test the remaining control.'
        : stage === 'recheck' ? 'The visible interface changed. Compare the directional controls in this state.'
          : 'Measure the direction in the current interface.';
      const parent = 'G_official_completion';
      const goal = { kind: 'verify_controls_after_interface_change', scope: ref.split(':revision:', 1)[0]!,
        subjects: [...directions, 'ACTION5'], parentObjective: parent, satisfactionContract: 'observe_the_current_control_effect' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = 'recheck-directions:' + need.id;
      const actions = [command], expected = frontier?.first?.destination;
      return {
        status: 'proposed', kind: recheckDirectionalControlsId, stage, source, candidates: keys, directions,
        ...(expected ? { expected } : {}), actions, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action: command, expected_after: null }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: { ...facts, stage } },
        sicSituationCard: { strategy, need: 'Find which directions work in the current interface', situation, mode, evidence, agenda: [],
          triggerCard: decision.receipt.workflow },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: situation, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'direction_probe_bound' : 'direction_probe_context_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const destination = observedCommandState(after);
      const matched = proposal.expected ? proposal.expected === destination : null;
      const reason = matched === false ? 'observed_control_return_contradicted'
        : destination === proposal.source ? 'control_left_interface_unchanged' : 'control_changed_interface';
      return { matched, seal_prefix: true, reason };
    },
    record(before, after, command, _first, _second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = state?.epoch === before.level_epoch ? state : initialize(before.level_epoch);
      const destination = observedCommandState(after), changed = destination !== proposal.source;
      local.options[proposal.source] = proposal.candidates;
      if (proposal.stage === 'direction') local.stopped = changed;
      if (proposal.stage === 'activation') {
        const previous = stationaryDirectionalEvidence(local.transitions, proposal.source, proposal.directions);
        if (changed && previous) local.activation = { remaining: proposal.directions.length * 3, evidence: [...previous, after.observation_ref] };
        else local.stopped = true;
      }
      if (local.activation && proposal.stage === 'recheck') local.activation.remaining--;
      rememberCommandReturn(local.transitions, proposal.source, destination, command.action_ref, after.observation_ref);
      local.lastChange = changed ? { action: command.action_ref, destination, evidence: after.observation_ref } : null;
      state = local;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
