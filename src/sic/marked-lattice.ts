import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const markedLatticeId = 'sic_marked_lattice';
export const markedLatticeStrategies = {
  acquire_marked_lattice_motion: 'Test how the cursor moves on the marked surface',
  approach_unvisited_marker: 'Move toward the nearest marker still awaiting a test',
  apply_at_current_marker: 'Test the local command on the reached marker',
} as const;
const graph = compileStrategyGraph({ id: 'test_each_marker_on_a_surface', version: 1, order: 'FALLBACK',
  priorities: ['apply_at_current_marker', 'acquire_marked_lattice_motion', 'approach_unvisited_marker'],
  strategies: {
    acquire_marked_lattice_motion: [{ fact: 'acquire', expected: true, label: 'A unique cursor and repeated markers share a visible lattice' }],
    approach_unvisited_marker: [{ fact: 'move', expected: true, label: 'One direction reduces distance to an unvisited marker' }],
    apply_at_current_marker: [{ fact: 'onTarget', expected: true, label: 'The cursor occupies a marker whose local effect remains untested' }],
  },
}, ['acquire', 'move', 'onTarget']);

type State = { epoch: number; field: NativeBox; color: number; pitch: number; markers: NativeBox[];
  at: NativePoint; visited: number[]; count: number; evidence: string[]; stopped: boolean };
type Proposal = NativeProposal & { local: State; landing: NativePoint | null; target: number; needId: string };
const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
const distance = ([x, y]: NativePoint, [u, v]: NativePoint) => Math.abs(x - u) + Math.abs(y - v);
const center = ([x, y, r, b]: NativeBox): NativePoint => [(x + r) / 2, (y + b) / 2];
const inside = ([x, y]: NativePoint, [l, t, r, b]: NativeBox) => l <= x && x <= r && t <= y && y <= b;
const ordered = (markers: NativeBox[], at: NativePoint) =>
  markers.map((box, i) => ({ i, at: center(box) })).sort((a, b) => distance(at, a.at) - distance(at, b.at) || a.at[1] - b.at[1] || a.at[0] - b.at[0]);

function measure(rows: NativeRows, epoch: number): State | null {
  const parts = geometricComponents(rows);
  const fields = parts.filter(part => !part.rectangular && part.area >= rows.length * rows[0]!.length / 4);
  const candidates: State[] = [];
  for (const field of fields) {
    const [l, t, r, b] = field.bbox;
    const inner = parts.filter(part => part.rectangular && part.bbox[0] > l && part.bbox[1] > t && part.bbox[2] < r && part.bbox[3] < b);
    const dots = inner.filter(part => part.area === 1);
    if (dots.length !== 1) continue;
    const cursor = dots[0]!, at = center(cursor.bbox);
    const groups = new Map<string, NativeBox[]>();
    for (const { bbox, color, area } of inner) {
      const side = bbox[2] - bbox[0] + 1;
      if (side < 3 || side % 2 === 0 || area !== side * side) continue;
      const key = `${side}:${color}`, markers = groups.get(key) ?? [];
      markers.push(bbox);
      groups.set(key, markers);
    }
    for (const markers of groups.values()) {
      if (markers.length !== 4) continue;
      const centers = markers.map(center);
      const cols = [...new Set(centers.map(([x]) => x))], lines = [...new Set(centers.map(([, y]) => y))];
      if (cols.length !== 2 || lines.length !== 2) continue;
      const [x, y] = centers[0]!;
      const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : Math.abs(a);
      const pitch = [...centers, at].flatMap(([a, b]) => [a - x, b - y]).reduce(gcd, 0);
      if (pitch <= markers[0]![2] - markers[0]![0] + 1) continue;
      candidates.push({ epoch, field: field.bbox, color: cursor.color, pitch, markers, at, visited: [],
        count: 0, evidence: [], stopped: false });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

export function createSicMarkedLattice(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: markedLatticeId,
    propose(observation, rows, inputs, remaining) {
      if (remaining < 1 || observation.available_action_refs.includes('ACTION6') || !inputs.some(command => command.action_ref === 'ACTION5')) return null;
      const local = state?.epoch === observation.level_epoch ? state : measure(rows, observation.level_epoch);
      if (!local || local.stopped || local.count >= 32) return null;
      const [x, y] = local.at, { pitch } = local;
      if (rows[y]?.[x] !== local.color) return null;
      const target = ordered(local.markers, local.at).find(marker => !local.visited.includes(marker.i));
      if (!target) return null;
      const onTarget = distance(local.at, target.at) === 0;
      const moves = directions.flatMap(([action, dx, dy]) => {
        const command = inputs.find(input => input.action_ref === action);
        const landing: NativePoint = [x + dx * pitch, y + dy * pitch];
        return command && inside(landing, local.field) && distance(landing, target.at) < distance(local.at, target.at)
          ? [{ command, landing }] : [];
      });
      const move = moves[0] ?? null;
      const command: NativeCommand | null = onTarget ? inputs.find(input => input.action_ref === 'ACTION5') ?? null : move?.command ?? null;
      if (!command) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        acquire: { value: !onTarget && local.count === 0, evidence }, move: { value: !onTarget && !!move, evidence },
        onTarget: { value: onTarget, evidence },
      }, planners: { acquire_marked_lattice_motion: () => command, approach_unvisited_marker: () => command, apply_at_current_marker: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = markedLatticeStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'test_repeated_markers_in_reachable_order', scope: ref.split(':revision:', 1)[0]!, subjects: ['cursor_and_visible_markers'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_marker_contacts' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `marked-lattice:${need.id}`, actions = [command];
      return { status: 'proposed', kind: markedLatticeId, actions, local, target: target.i,
        landing: onTarget ? null : move!.landing, needId: need.id,
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Find the effect of visiting and using the marked cells', mode: onTarget ? 'exploration' : 'solving',
          situation: label, agenda: entries, evidence, cursor: [x - 1, y - 1, x + 1, y + 1], target: local.markers[target.i],
          distance: distance(local.at, target.at) / pitch },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'marked_lattice_bound' : 'marked_lattice_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = observed(proposal, first, second);
      return { matched, seal_prefix: true, reason: matched ? 'marked_lattice_return_observed' : 'marked_lattice_return_contradicted' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, landing, target } = proposal, matched = observed(proposal, first, second);
      state = { ...local, at: landing ?? local.at, visited: matched && !landing ? [...local.visited, target] : local.visited,
        stopped: !matched, count: local.count + 1, evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function observed({ local, landing, target }: Proposal, first: NativeRows, second: NativeRows): boolean {
  const [x, y] = local.at;
  if (landing) return first[landing[1]]?.[landing[0]] !== local.color && second[landing[1]]?.[landing[0]] === local.color
    && second[y]?.[x] !== local.color;
  const [l, t, r, b] = local.markers[target]!;
  if (second[y]?.[x] !== local.color) return false;
  for (let v = t; v <= b; v++) for (let u = l; u <= r; u++) if (first[v]?.[u] !== second[v]?.[u]) return true;
  return false;
}
