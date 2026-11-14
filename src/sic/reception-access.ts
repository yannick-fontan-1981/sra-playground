import { measureReceptionService, receptionServiceCarriers, receptionServicePath } from '../logos-engine/v6-reception-service-observation.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const receptionAccessId = 'sic_reception_access';
export const receptionAccessStrategies = {
  measure_support_approach: 'Measure a direction toward the candidate support',
  approach_request_support: 'Follow observed displacements toward the matching support',
  observe_arrival_at_support: 'Observe the support while the carrier stays in place',
} as const;
const graph = compileStrategyGraph({ id: 'approach_distinct_request_support', version: 1, order: 'FALLBACK',
  priorities: ['observe_arrival_at_support', 'approach_request_support', 'measure_support_approach'],
  strategies: {
    measure_support_approach: [{ fact: 'probe', expected: true, label: 'Available directions may complete the access route or recover visibility' }],
    approach_request_support: [{ fact: 'access', expected: true, label: 'The measured displacements permit access while avoiding the other supports' }],
    observe_arrival_at_support: [{ fact: 'arrived', expected: true, label: 'The carrier is on the candidate support and a direction points beyond the visible floor' }],
  },
}, ['probe', 'access', 'arrived']);
type Scene = { pitch: number; cells: NativePoint[]; target: { anchor: NativePoint }; counterparts: { request_bbox: NativeBox; body_bbox: NativeBox }[] };
type State = { epoch: number; count: number; scene: Scene; controls: Record<string, NativePoint>; trials: string[]; waits: number;
  last: { action: string; from: NativePoint | null } | null; evidence: string[]; stopped: boolean };
type Choice = { action: string; expected: NativePoint | null };
type Proposal = NativeProposal & { local: State; choice: Choice; attempt: string; from: NativePoint | null; wait: boolean; needId: string };
const hints: Readonly<Record<string, NativePoint>> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const opposite: Readonly<Record<string, string>> = { ACTION1: 'ACTION2', ACTION2: 'ACTION1', ACTION3: 'ACTION4', ACTION4: 'ACTION3' };
const equal = (a: NativePoint | null, b: NativePoint | null) => a === b || !!a && !!b && a[0] === b[0] && a[1] === b[1];
const box = ([x, y]: NativePoint, pitch: number): NativeBox => [x, y, x + pitch - 1, y + pitch - 1];
const distance = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.abs(x - a) + Math.abs(y - b);

function carrier(rows: NativeRows, scene: Scene): NativePoint | null {
  const bodies = receptionServiceCarriers(rows, scene);
  return bodies.length === 1 ? bodies[0]!.anchor as NativePoint : null;
}

export function createSicReceptionAccess(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: receptionAccessId,
    propose(observation, rows, _inputs, remaining) {
      const keys = observation.available_action_refs.filter(action => hints[action]);
      if (remaining < 1 || keys.length < 2 || observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 48) return null;
      const scene = measureReceptionService(rows, prior?.scene ?? null) as Scene | null;
      if (!scene || scene.counterparts.length !== 1 || scene.cells.length > 196) return null;
      const local: State = prior ? { ...prior, scene } : { epoch: observation.level_epoch, count: 0, scene,
        controls: {}, trials: [], waits: 0, last: null, evidence: [], stopped: false };
      const from = carrier(rows, scene), target = scene.target.anchor, atTarget = equal(from, target);
      const key = (action: string) => JSON.stringify([from, target, action]);
      const tested = (action: string) => local.trials.includes(key(action));
      const moves = Object.fromEntries(keys.flatMap(action => local.controls[action] && !tested(action) ? [[action, local.controls[action]]] : []));
      const path = from && !atTarget ? receptionServicePath(rows, scene, from, target, moves, remaining) : null;
      const outward = atTarget && local.waits < 8 ? Object.entries(local.controls).find(([action, delta]) =>
        keys.includes(action) && !scene.cells.some(([x, y]) => x === target[0] + delta[0] && y === target[1] + delta[1])) : null;
      const recover = !from && local.last ? opposite[local.last.action] : null;
      const experiment = recover && keys.includes(recover) && !tested(recover) ? recover : keys
        .filter(action => !tested(action) && !local.controls[action]).sort((a, b) => {
          const toward = (action: string) => {
            if (!from) return 0;
            const [x, y] = hints[action]!;
            return distance([from[0] + x * scene.pitch, from[1] + y * scene.pitch], target);
          };
          return toward(a) - toward(b);
        })[0];
      const probe: Choice | null = experiment ? { action: experiment, expected: null } : null;
      const access: Choice | null = path?.[0] ? { action: path[0].action_ref, expected: path[0].to } : null;
      const wait: Choice | null = outward ? { action: outward[0], expected: target } : null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        probe: { value: !!probe, evidence }, access: { value: !!access, evidence }, arrived: { value: !!wait, evidence },
      }, planners: { measure_support_approach: () => probe, approach_request_support: () => access, observe_arrival_at_support: () => wait } });
      if (!selected) return null;
      const strategy = selected.id, choice = selected.plan, label = receptionAccessStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'reach_support_for_visible_request', scope: ref.split(':revision:', 1)[0]!, subjects: ['visible_request', 'carrier', 'distinct_support'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_arrival_at_the_candidate_support' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `reception-access:${need.id}`;
      const command = { action_ref: choice.action, data: {} }, actions = [command];
      return { status: 'proposed', kind: receptionAccessId, actions, local, choice, attempt: key(choice.action), from,
        wait: strategy === 'observe_arrival_at_support', needId: need.id,
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Bring the carrier to the support for the visible request', mode: strategy === 'approach_request_support' ? 'solving' : 'exploration',
          situation: label, agenda: entries, evidence, actor: from ? box(from, scene.pitch) : null, target: box(target, scene.pitch),
          request: scene.counterparts[0]!.request_bbox },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_carrier_and_support_bound' : 'carrier_or_support_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.choice.expected ? equal(carrier(second, proposal.local.scene), proposal.choice.expected) : null;
      return { matched, seal_prefix: true, reason: matched ? 'carrier_projection_observed' : 'compare_carrier_and_support_return' };
    },
    record(before, after, issued, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, from, wait } = proposal, position = carrier(second, local.scene), controls = { ...local.controls };
      if (from && position) {
        const delta: NativePoint = [position[0] - from[0], position[1] - from[1]];
        if (Math.abs(delta[0]) + Math.abs(delta[1]) === local.scene.pitch && (delta[0] === 0 || delta[1] === 0)) controls[issued.action_ref] = delta;
      }
      state = { ...local, count: local.count + 1, controls, trials: equal(from, position) || !position ? [...local.trials, proposal.attempt] : local.trials, waits: local.waits + Number(wait),
        last: { action: issued.action_ref, from }, stopped: wait && !equal(position, local.scene.target.anchor),
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
