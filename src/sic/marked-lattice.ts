import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { assessMarkerStep, markerDirections, nextMarkerStep, readMarkerField, retainMarkerStep,
  type MarkerField, type MarkerStep } from './observed-marker-field.ts';

export const markedLatticeId = 'sic_marked_lattice';
export const verifyMarkedLatticeId = 'sic_verify_marked_lattice';
export const markedLatticeStrategies = {
  acquire_marked_lattice_motion: 'Test how the cursor moves on the marked surface',
  approach_unvisited_marker: 'Move toward the nearest marker still awaiting a test',
  apply_at_current_marker: 'Test the local command on the reached marker',
} as const;

type State = { epoch: number; field: NativeBox; color: number; pitch: number; markers: NativeBox[];
  at: NativePoint; visited: number[]; count: number; evidence: string[]; stopped: boolean; movements?: string[] };
type LegacyProposal = NativeProposal & { local: State; landing: NativePoint | null; target: number; needId: string };
type FieldProposal = NativeProposal & { field: MarkerField; step: MarkerStep; needId: string };
type Proposal = LegacyProposal | FieldProposal;
type Transfer = { completed: number; evidence: string[]; movements: string[] };
const isFieldProposal = (proposal: Proposal): proposal is FieldProposal => 'field' in proposal;
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

export function createSicVerifyMarkedLattice(): NativeFamily<Proposal> {
  let state: State | null = null;
  let measured: MarkerField | null = null;
  let transfer: Transfer | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyMarkedLatticeId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || observation.available_action_refs.includes('ACTION6') || !inputs.some(command => command.action_ref === 'ACTION5')) return null;
      const current = measured?.epoch === observation.level_epoch ? measured : null;
      const local = current ? null : state?.epoch === observation.level_epoch ? state : measure(rows, observation.level_epoch);
      if (!local) {
        if (!transfer || transfer.completed !== observation.levels_completed) return null;
        const field = current ?? readMarkerField(rows, observation.level_epoch, transfer.evidence, transfer.movements);
        const step = field ? nextMarkerStep(field, rows, inputs) : null;
        return field && step ? fieldProposal(observation, field, step, decide, execution) : null;
      }
      if (local.stopped || local.count >= 32) return null;
      const [x, y] = local.at, { pitch } = local;
      if (rows[y]?.[x] !== local.color) return null;
      const target = ordered(local.markers, local.at).find(marker => !local.visited.includes(marker.i));
      if (!target) return null;
      const onTarget = distance(local.at, target.at) === 0;
      const moves = markerDirections.flatMap(([action, dx, dy]) => {
        const command = inputs.find(input => input.action_ref === action);
        const landing: NativePoint = [x + dx * pitch, y + dy * pitch];
        return command && inside(landing, local.field) && distance(landing, target.at) < distance(local.at, target.at)
          ? [{ command, landing }] : [];
      });
      const move = moves[0] ?? null;
      const command: NativeCommand | null = onTarget ? inputs.find(input => input.action_ref === 'ACTION5') ?? null : move?.command ?? null;
      if (!command) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const mode = execution?.reasoningMode ?? (onTarget ? 'exploration' : 'solving');
      const routeSupported = !onTarget && local.count > local.visited.length;
      const knownInteraction = onTarget && local.visited.length > 0;
      const facts = { routeSupported, knownInteraction, eligibleProbe: !routeSupported && !knownInteraction, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = routeSupported ? 'P07' : knownInteraction ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const phase = onTarget ? 'apply_at_current_marker' : routeSupported ? 'approach_unvisited_marker' : 'acquire_marked_lattice_motion';
      const label = markedLatticeStrategies[phase], parent = 'G_official_completion';
      const goal = { kind: 'test_repeated_markers_in_reachable_order', scope: ref.split(':revision:', 1)[0]!, subjects: ['cursor_and_visible_markers'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_marker_contacts' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `marked-lattice:${need.id}`, actions = [command];
      return { status: 'proposed', kind: verifyMarkedLatticeId, actions, local, target: target.i,
        landing: onTarget ? null : move!.landing, needId: need.id,
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Find the effect of visiting and using the marked cells', mode,
          situation: label, agenda: [], evidence, triggerCard: decision.receipt.workflow,
          cursor: [x - 1, y - 1, x + 1, y + 1], target: local.markers[target.i],
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
      if (isFieldProposal(proposal)) {
        const result = assessMarkerStep(proposal.field, proposal.step, first, second);
        return { matched: result.kind === 'tested' ? null : result.kind !== 'contradicted' && result.kind !== 'blocked',
          seal_prefix: true, reason: `marker_field_${result.kind}` };
      }
      const matched = observed(proposal, first, second);
      return { matched, seal_prefix: true, reason: matched ? 'marked_lattice_return_observed' : 'marked_lattice_return_contradicted' };
    },
    record(before, after, command, first, second, proposal) {
      if (after.levels_completed > before.levels_completed) {
        const local = isFieldProposal(proposal) ? proposal.field : proposal.local;
        transfer = { completed: after.levels_completed, evidence: [...local.evidence.slice(-4), after.observation_ref],
          movements: local.movements ?? [] };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (isFieldProposal(proposal)) {
        const result = assessMarkerStep(proposal.field, proposal.step, first, second);
        measured = retainMarkerStep(proposal.field, proposal.step, result, after.observation_ref);
        return { events: [] };
      }
      const { local, landing, target } = proposal, matched = observed(proposal, first, second);
      state = { ...local, at: landing ?? local.at, visited: matched && !landing ? [...local.visited, target] : local.visited,
        stopped: !matched, count: local.count + 1, evidence: [...local.evidence.slice(-4), after.observation_ref],
        ...(matched && landing ? { movements: [...new Set([...(local.movements ?? []), command.action_ref])] } : {}) };
      return { events: [] };
    },
    state: () => ({ state, measured, transfer }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      measured = structuredClone((value.measured as MarkerField | undefined) ?? null);
      transfer = structuredClone((value.transfer as Transfer | undefined) ?? null);
    },
  };
}

function observed({ local, landing, target }: LegacyProposal, first: NativeRows, second: NativeRows): boolean {
  const [x, y] = local.at;
  if (landing) return first[landing[1]]?.[landing[0]] !== local.color && second[landing[1]]?.[landing[0]] === local.color
    && second[y]?.[x] !== local.color;
  const [l, t, r, b] = local.markers[target]!;
  if (second[y]?.[x] !== local.color) return false;
  for (let v = t; v <= b; v++) for (let u = l; u <= r; u++) if (first[v]?.[u] !== second[v]?.[u]) return true;
  return false;
}

async function fieldProposal(observation: Parameters<NativeFamily['propose']>[0], field: MarkerField, step: MarkerStep,
  decide: NativeProgramHandle | undefined, execution: Parameters<NativeFamily['propose']>[4]): Promise<FieldProposal | null> {
  const { command, target, landing } = step, { at, scene } = field;
  const [x, y] = target.point, size = scene.extent - 1;
  const ref = observation.observation_ref;
  const evidence: [string, ...string[]] = [ref, ...new Set([...field.evidence, ...(field.calibration ? [field.calibration] : [])]
    .filter(item => item !== ref))];
  const mode = execution?.reasoningMode ?? (landing ? 'solving' : 'exploration');
  const routeSupported = landing !== null && field.movements.includes(command.action_ref);
  const knownInteraction = false;
  const facts = { routeSupported, knownInteraction, eligibleProbe: !routeSupported, mode };
  const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
  const strategy = routeSupported ? 'P07' : 'P05';
  if (decision?.result !== strategy) return null;
  const label = field.prepared ? 'Keep the cursor on the prepared marker and test the next activation'
    : target.kind === 'calibration' ? 'Test the distinct control while the counter is still empty'
    : target.kind === 'mode' ? 'Check whether the remaining acquisitions require a different visible group'
      : 'Approach the visible candidate and verify whether it fills the counter';
  const parent = 'G_official_completion';
  const goal = { kind: 'complete_marker_counter_across_access_modes', scope: ref.split(':revision:', 1)[0]!,
    subjects: ['controlled_cursor', 'unresolved_marker', 'acquisition_counter'], parentObjective: parent,
    satisfactionContract: 'observe_official_progress_after_marker_contacts' };
  const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
  const id = `marked-lattice:${need.id}`, actions = [command];
  return { status: 'proposed', kind: verifyMarkedLatticeId, actions, field, step, needId: need.id,
    steps: [{ action: command, expected_after: landing }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
    sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
      edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
    sicSituationCard: { strategy, need: 'Fill the remaining acquisition slots', mode, situation: label,
      agenda: [], evidence, triggerCard: decision.receipt.workflow, cursor: [at[0], at[1], at[0] + size, at[1] + size],
      target: target.kind === 'calibration' ? scene.calibrator : target.kind === 'mode' ? scene.control : [x, y, x + size, y + size],
      counter: scene.counter, ...(field.prepared && scene.preparation ? { preparation: scene.preparation } : {}) },
    question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
    sicLocalDecision: { strategy, objective: { id, label, parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
      preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
  };
}
