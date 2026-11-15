import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { interiorShapeTargets } from './interior-shape-targets.ts';
import { sicNeedId } from './need-identity.ts';
import { observedCommandFrontier, observedCommandKey, observedCommandState, oppositeDirection, rememberCommandReturn,
  stationaryCommandEvidence, type ObservedCommandGraph } from './observed-command-frontier.ts';

export const recheckDirectionalControlsId = 'sic_recheck_directional_controls';
export const recheckDirectionalControlsStrategies = {
  P05: 'Test an available control in the current interface',
  P07: 'Follow an observed return to an untested control',
};

type State = {
  epoch: number;
  tested: number;
  transitions: ObservedCommandGraph;
  options: Record<string, string[]>;
  activation: { remaining: number; evidence: string[] } | null;
  shapeEvidence?: string[];
  lastChange: { action: string; destination: string; evidence: string } | null;
};
type Proposal = NativeProposal & { source: string; candidates: string[]; directions: string[];
  stage: 'compare' | 'activation' | 'recheck' | 'click'; shapeEvidence?: string[]; expected?: string; needId: string };

const initialize = (epoch: number): State => ({ epoch, tested: 0, transitions: {}, options: {}, activation: null, lastChange: null });

export function createSicRecheckDirectionalControls(): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: recheckDirectionalControlsId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      const local = state?.epoch === observation.level_epoch ? state : initialize(observation.level_epoch);
      const budget = Math.min(remaining, 40 - local.tested, local.activation?.remaining ?? 40);
      if (budget < 1) return null;
      const named = inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref));
      const namedKeys = named.map(command => command.action_ref);
      const directions = namedKeys.filter(action => action !== 'ACTION5');
      const source = observedCommandState(observation);
      const shapeEvidence = observation.available_action_refs.includes('ACTION6')
        ? local.shapeEvidence ?? (namedKeys.length === 1 && namedKeys[0] === 'ACTION5' ? [observation.observation_ref]
          : stationaryCommandEvidence(local.transitions, source, namedKeys) ?? undefined)
        : undefined;
      if (directions.length < 2 && !shapeEvidence) return null;
      const targets = shapeEvidence ? interiorShapeTargets(rows, 30) : [];
      const candidates = [...named, ...targets.map(target => target.command)];
      const keys = candidates.map(observedCommandKey);
      const lastChange = local.lastChange?.destination === source ? local.lastChange : null;
      const frontier = observedCommandFrontier(local.transitions, source, keys, budget,
        board => board === source ? keys : local.options[board] ?? [], lastChange ? oppositeDirection[lastChange.action] : undefined);
      const input = frontier?.action;
      const command = candidates.find(candidate => observedCommandKey(candidate) === input);
      if (!frontier || !command) return null;
      const target = targets.find(candidate => candidate.command === command);
      const stationary = !local.activation && !shapeEvidence && input === 'ACTION5'
        ? stationaryCommandEvidence(local.transitions, source, directions) : null;

      const mode = execution?.reasoningMode ?? 'exploration';
      const routeSupported = !!frontier.first;
      const facts = { eligibleProbe: !routeSupported, routeSupported, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = routeSupported ? 'P07' : 'P05';
      if (decision?.result !== strategy) return null;

      const ref = observation.observation_ref;
      const evidence = [...new Set([ref, ...(shapeEvidence ?? stationary ?? local.activation?.evidence ?? []),
        ...(frontier.first ? [frontier.first.evidence] : []), ...(lastChange ? [lastChange.evidence] : [])])];
      const stage = target ? 'click' : local.activation ? 'recheck' : stationary ? 'activation' : 'compare';
      const situation = stage === 'activation' ? 'The tested directions left the board unchanged. Try the alternate key.'
        : stage === 'recheck' ? 'The visible interface changed. Compare the directional controls in this state.'
          : stage === 'click' && !routeSupported ? 'Test whether this interior shape responds to a click.'
          : recheckDirectionalControlsStrategies[strategy];
      const parent = 'G_official_completion';
      const goal = { kind: shapeEvidence ? 'compare_keys_and_shape_targets' : 'compare_current_directional_controls',
        scope: ref.split(':revision:', 1)[0]!, subjects: shapeEvidence ? [...namedKeys, 'interior_shapes'] : namedKeys,
        parentObjective: parent, satisfactionContract: 'observe_the_current_control_effect' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = 'recheck-directions:' + need.id;
      const actions = [command], expected = frontier.first?.destination;
      const witness = target ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [command.data.x!, command.data.y!], { reason: situation, evidence }) : null;
      return {
        status: 'proposed', kind: recheckDirectionalControlsId, stage, source, candidates: keys, directions,
        ...(expected ? { expected } : {}), ...(shapeEvidence ? { shapeEvidence } : {}), actions, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action: command, expected_after: null, ...(witness ? { point_binding: witness } : {}) }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: { ...facts, stage } },
        sicSituationCard: { strategy, need: shapeEvidence ? 'Find which keys or visible shapes respond' : 'Find which directions work in the current interface',
          situation, mode, evidence, agenda: [], triggerCard: decision.receipt.workflow, ...(target ? { addressedRegion: target.box } : {}) },
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
      const action = observedCommandKey(command);
      local.tested++;
      local.options[proposal.source] = proposal.candidates;
      if (proposal.shapeEvidence) local.shapeEvidence = proposal.shapeEvidence;
      if (proposal.stage === 'activation') {
        const previous = stationaryCommandEvidence(local.transitions, proposal.source, proposal.directions);
        if (changed && previous) local.activation = { remaining: proposal.directions.length * 3, evidence: [...previous, after.observation_ref] };
      }
      if (local.activation && proposal.stage !== 'activation') local.activation.remaining--;
      rememberCommandReturn(local.transitions, proposal.source, destination, action, after.observation_ref);
      local.lastChange = changed ? { action, destination, evidence: after.observation_ref } : null;
      state = local;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) {
      const restored = structuredClone(value.state as State | null);
      if (restored && !Number.isInteger(restored.tested)) {
        restored.tested = Object.values(restored.transitions).reduce((count, edges) => count + edges.length, 0);
      }
      state = restored;
    },
  };
}
