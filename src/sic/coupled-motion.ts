import { matchCoupledPair, measureCoupledPairs, type CoupledPair, type CoupledPairBox, type CoupledPairDelta } from '../logos-engine/v6-coupled-pair-observation.ts';
import { jointCoupledPairRoute, type CoupledPairRoute } from '../logos-engine/v6-coupled-pair-route.ts';
import type { NativeBox, NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const coupledMotionId = 'sic_coupled_motion';
export const coupledMotionStrategies = {
  measure_pair_displacement: 'Test a direction and compare the movement of both pieces',
  route_coupled_pieces: 'Move both pieces toward a possible meeting point',
} as const;

const graph = compileStrategyGraph({
  id: 'bring_jointly_controlled_pieces_together', version: 1, order: 'FALLBACK',
  priorities: ['route_coupled_pieces', 'measure_pair_displacement'],
  strategies: {
    measure_pair_displacement: [{ fact: 'probe', expected: true, label: 'Two matching pieces sit on the same grid and an untested direction may reveal how they move together' }],
    route_coupled_pieces: [{ fact: 'route', expected: true, label: 'Both axes have consistent measured effects and the observed floor supports a candidate joint route' }],
  },
}, ['probe', 'route']);

type Sample = { input: string; first: CoupledPairDelta; second: CoupledPairDelta };
type State = { epoch: number; pair: CoupledPair; samples: Sample[]; floors: number[]; evidence: string[];
  remainingRoute: { actions: string[]; expected: CoupledPairBox[][] } | null; count: number; stopped: boolean };
type Candidate = { input: string; route: State['remainingRoute'] };
type Proposal = NativeProposal & { local: State; candidate: Candidate; needId: string };
const displayBox = ([t, l, b, r]: CoupledPairBox): NativeBox => [l, t, r, b];
const keys = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function inBox([t, l, b, r]: CoupledPairBox, y: number, x: number): boolean {
  return t <= y && y <= b && l <= x && x <= r;
}
function matchProjection(rows: NativeRows, later: NativeRows, pair: CoupledPair, next: readonly CoupledPairBox[]): boolean {
  for (const [top, left, bottom, right] of next) for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) if (later[y]?.[x] !== pair.value) return false;
  }
  const affected = [...pair.boxes, ...next];
  for (let y = 1; y < rows.length - 1; y++) for (let x = 1; x < rows[y]!.length - 1; x++) {
    if (rows[y]![x] !== later[y]?.[x] && !affected.some(box => inBox(box, y, x))) return false;
  }
  return true;
}

function revealedFloor(previous: CoupledPair, next: readonly CoupledPairBox[], rows: NativeRows): number[] {
  return previous.boxes.flatMap(([top, left, bottom, right]) => {
    const values = new Set<number>();
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const value = rows[y]?.[x];
      if (value !== undefined && !next.some(box => inBox(box, y, x))) values.add(value);
    }
    return values.size === 1 ? [...values] : [];
  });
}

function routeFromSamples(state: State, rows: NativeRows, available: readonly string[], remaining: number): CoupledPairRoute | null {
  if (!state.floors.length) return null;
  const vectors = new Map<string, Map<string, CoupledPairDelta>>();
  const signs = [new Set<number>(), new Set<number>()];
  for (const { input, first, second } of state.samples) {
    if (first.some(Boolean)) {
      const seen = vectors.get(input) ?? new Map();
      seen.set(first.join(','), first);
      vectors.set(input, seen);
    }
    for (const axis of [0, 1] as const) {
      if (first[axis] && Math.abs(first[axis]) === Math.abs(second[axis])) signs[axis]!.add(Math.sign(first[axis] * second[axis]));
    }
  }
  if (signs.some(axis => axis.size !== 1)) return null;
  const controls = Object.fromEntries([...vectors].flatMap(([input, seen]) => available.includes(input) && seen.size === 1 ? [[input, [...seen.values()][0]!]] : []));
  return jointCoupledPairRoute(rows, state.pair, controls, state.floors, signs.map(axis => [...axis][0]!), Math.min(40, remaining), state.evidence, true);
}

export function createSicCoupledMotion(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: coupledMotionId,
    propose(observation, rows, _inputs, remaining) {
      const available = keys.filter(input => observation.available_action_refs.includes(input));
      if (remaining < 1 || available.length < 3 || rows.length < 3) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 60) return null;
      const measured = measureCoupledPairs(rows);
      const pair = prior ? measured.find(pair => pair.value === prior.pair.value && pair.size === prior.pair.size
        && pair.boxes.every(box => prior.pair.boxes.some(bound => same(box, bound)))) : measured.length === 1 ? measured[0] : null;
      if (!pair || Math.floor(rows.length / pair.size) * Math.floor(rows[0]!.length / pair.size) > 4096) return null;
      const [a, b] = pair.boxes;
      if (!a || !b || (a[0] - b[0]) % pair.size || (a[1] - b[1]) % pair.size) return null;
      if (!prior && new Set(rows.flat()).size < 4) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, pair, samples: [], floors: [], evidence: [],
        remainingRoute: null, count: 0, stopped: false };
      const untested = available.find(input => !local.samples.some(sample => sample.input === input));
      const route = local.remainingRoute?.actions.every(input => available.includes(input)) ? local.remainingRoute
        : !untested ? routeFromSamples(local, rows, available, remaining) : null;
      const first = route?.actions[0];
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: { route: { value: !!first, evidence }, probe: { value: !!untested, evidence } },
        planners: {
          route_coupled_pieces: (): Candidate | null => first && route ? { input: first, route: { actions: route.actions, expected: route.expected } } : null,
          measure_pair_displacement: () => untested ? { input: untested, route: null } : null,
        },
      });
      if (!selected) return null;
      const candidate = selected.plan, strategy = selected.id, label = coupledMotionStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'bring_jointly_controlled_pieces_together', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['first_piece', 'second_piece', 'shared_controls'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_the_joint_meeting_test' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'coupled-motion:' + need.id;
      const action = { action_ref: candidate.input, data: {} }, actions = [action];
      return { status: 'proposed', kind: coupledMotionId, candidate, local, actions, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, expected_after: candidate.route?.expected[0] ?? null }],
        sicSituationCard: { strategy, need: 'Find how to bring together pieces that share controls', situation: label, evidence, agenda: entries,
          mode: candidate.route ? 'solving' : 'exploration', members: local.pair.boxes.map(displayBox),
          nextMembers: candidate.route?.expected[0]?.map(displayBox) ?? [] },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_joint_control_and_pieces_bound' : 'joint_control_context_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const expected = proposal.candidate.route?.expected[0];
      const matched = expected ? matchProjection(first, second, proposal.local.pair, expected) : null;
      return { matched, seal_prefix: true, reason: matched === true ? 'observed_joint_displacement' : 'compare_both_piece_returns' };
    },
    record(before, after, command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, candidate } = proposal, previous = local.pair, route = candidate.route, expected = route?.expected[0];
      const measured = measureCoupledPairs(second).filter(pair => pair.value === previous.value && pair.size === previous.size);
      const match = measured.length === 1 ? matchCoupledPair(previous, measured[0]!) : null;
      const projected = expected && matchProjection(first, second, previous, expected) ? expected : null;
      const boxes = projected ?? match?.boxes ?? previous.boxes;
      const sample: Sample | null = !route ? { input: command.action_ref, first: match?.deltas[0] ?? [0, 0],
        second: match?.deltas[1] ?? [0, 0] } : null;
      state = { ...local, pair: { ...previous, boxes }, count: local.count + 1,
        samples: sample ? [...local.samples, sample] : local.samples, floors: [...new Set([...local.floors, ...revealedFloor(previous, boxes, second)])],
        evidence: [...local.evidence.slice(-7), after.observation_ref], stopped: route ? !projected : !match,
        remainingRoute: projected && route && route.actions.length > 1 ? { actions: route.actions.slice(1), expected: route.expected.slice(1) } : null };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
