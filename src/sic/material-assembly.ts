import { measureTypedCarriers, typedReplacementCandidate, typedMaterialDescendants, typedMaterialRequests,
  typedChildPresent, typedLocalChildMark } from '../logos-engine/v6-typed-material-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const materialAssemblyId = 'sic_material_assembly';
export const materialAssemblyStrategies = {
  test_marked_material: 'Test the response of a piece with internal marks',
  combine_compatible_material: 'Test a second piece with a matching border pattern',
  open_replacement_material: 'Test the new piece that contains the previous marks',
  select_produced_piece: 'Select a produced piece with a compatible destination',
  deliver_produced_piece: 'Test whether the selected piece fills the matching frame',
} as const;

const graph = compileStrategyGraph({
  id: 'assemble_and_apply_material_preserving_marks', version: 1, order: 'FALLBACK',
  priorities: ['deliver_produced_piece', 'select_produced_piece', 'open_replacement_material', 'combine_compatible_material', 'test_marked_material'],
  strategies: {
    test_marked_material: [{ fact: 'probe', expected: true, label: 'Several pieces have comparable internal marks and an input may reveal their role' }],
    combine_compatible_material: [{ fact: 'pair', expected: true, label: 'The first click marked a piece, and one other piece has the same border colors in the same counts' }],
    open_replacement_material: [{ fact: 'open', expected: true, label: 'A new piece contains marks from the pieces that disappeared' }],
    select_produced_piece: [{ fact: 'select', expected: true, label: 'A produced piece has a single compatible frame' }],
    deliver_produced_piece: [{ fact: 'deliver', expected: true, label: 'The last return marked this piece, and its candidate frame is still visible' }],
  },
}, ['probe', 'pair', 'open', 'select', 'deliver']);

type Piece = { id: string; bbox: NativeBox; center: NativePoint; point: NativePoint; signature: string;
  body_palette: number; fringe: number[][]; support_source?: string };
type Child = Piece & { core_signature: string; source_ref: string };
type Request = { bbox: NativeBox; point: NativePoint; descriptor: { palette: number } };
type Scene = { carriers: Piece[]; source_ref: string };
type Replacement = { selected: Piece; removed: Piece[]; evidence: string[] };
type State = { epoch: number; frameHash: string; steps: number; marked: Piece | null; replacement: Replacement | null; children: Child[];
  selected: Child | null; filled: NativeBox[]; associations: Record<string, Request['descriptor']>;
  calibrations: { size: NativePoint; evidence: string[] }[]; evidence: string[]; stopped: boolean };
type Choice = { piece: Piece | Request; child?: Child; request?: Request };
type Proposal = NativeProposal & { local: State; scene: Scene | null; choice: Choice; strategy: keyof typeof materialAssemblyStrategies; needId: string };

const config = { minimum_body_fill: 0.75, minimum_distinct_internal_marks: 2, maximum_pixels_per_mark: 1, minimum_repeated_carriers: 2 };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const shape = ([x, y, r, b]: NativeBox): [number, number] => [r - x, b - y];
const byPosition = (a: Piece, b: Piece) => a.center[1] - b.center[1] || a.center[0] - b.center[0];
function fringeCounts(piece: Piece) {
  const counts: Record<number, number> = {};
  for (const [, , value] of piece.fringe) counts[value!] = (counts[value!] ?? 0) + 1;
  return counts;
}
function externalMark(box: NativeBox, before: NativeRows, after: NativeRows): boolean {
  const [l, t, r, b] = box, margin = Math.max(r - l + 1, b - t + 1) / 2;
  let changed = false;
  for (let y = 0; y < before.length; y++) for (let x = 0; x < before[y]!.length; x++) {
    if (before[y]![x] === after[y]?.[x]) continue;
    if (x < l - margin || x > r + margin || y < t - margin || y > b + margin || (l <= x && x <= r && t <= y && y <= b)) return false;
    changed = true;
  }
  return changed;
}
const patch = (rows: NativeRows, [l, t, r, b]: NativeBox) => rows.slice(t, b + 1).map(row => row.slice(l, r + 1));

export function createSicMaterialAssembly(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: materialAssemblyId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior && (prior.stopped || prior.steps >= 36 || prior.frameHash !== observation.frame_hash)) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, frameHash: observation.frame_hash, steps: 0,
        marked: null, replacement: null, children: [], selected: null, filled: [], associations: {}, calibrations: [], evidence: [], stopped: false };
      const scene = measureTypedCarriers(rows, observation, { ...config, observed_body_shapes: local.calibrations }) as Scene | null;
      const carriers = scene?.carriers ?? [];
      let select: Choice | null = null, deliver: Choice | null = null, pair: Choice | null = null;
      if (local.children.length) {
        const requests = (typedMaterialRequests(rows, observation, local.filled.map(shape)) as Request[])
          .filter(request => !local.filled.some(box => same(request.bbox, box)));
        for (const child of (local.selected ? [local.selected] : [...local.children].sort(byPosition))) {
          if (!typedChildPresent(child, rows)) continue;
          const prior = local.associations[child.core_signature];
          const candidates = requests.filter(request => prior ? same(request.descriptor, prior) : request.descriptor.palette === child.body_palette);
          if (candidates.length !== 1) continue;
          const request = candidates[0]!;
          if (local.selected) deliver = { piece: request, child, request };
          else select = { piece: child, child, request };
          break;
        }
      } else if (local.marked && !local.replacement) {
        const profile = fringeCounts(local.marked);
        const peers = carriers.filter(piece => !same(piece.bbox, local.marked!.bbox) && same(fringeCounts(piece), profile));
        if (peers.length === 1) pair = { piece: peers[0]! };
      }
      const open: Choice | null = local.replacement ? { piece: local.replacement.selected } : null;
      const first = !local.children.length && !local.replacement && !local.marked ? [...carriers].sort(byPosition)[0] : null;
      const probe: Choice | null = first ? { piece: first } : null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: { probe: { value: !!probe, evidence }, pair: { value: !!pair, evidence }, open: { value: !!open, evidence },
          select: { value: !!select, evidence }, deliver: { value: !!deliver, evidence } },
        planners: { test_marked_material: () => probe, combine_compatible_material: () => pair, open_replacement_material: () => open,
          select_produced_piece: () => select, deliver_produced_piece: () => deliver },
      });
      if (!selected) return null;
      const choice: Choice = selected.plan, strategy = selected.id, label = materialAssemblyStrategies[strategy], parent = 'G_official_completion';
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, choice.piece.point, { reason: label, evidence });
      if (!pointBinding) return null;
      const [x, y] = choice.piece.point, action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const objective = { kind: 'assemble_and_apply_material_preserving_marks', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['marked_pieces', 'produced_piece', 'matching_frame'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_a_compatible_placement' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'material-assembly:' + need.id;
      return { status: 'proposed', kind: materialAssemblyId, local, scene, choice, strategy, actions, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, point_binding: pointBinding, expected_after: null }],
        sicSituationCard: { strategy, need: 'Find how marked pieces produce material that fills the frames', situation: label, evidence, agenda: entries,
          mode: strategy === 'deliver_produced_piece' ? 'solving' : strategy === 'select_produced_piece' ? 'assimilation' : 'exploration',
          focus: choice.child?.bbox ?? choice.piece.bbox, partner: local.marked?.bbox ?? null, destination: choice.request?.bbox ?? null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_material_and_test_point_bound' : 'material_context_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      return { matched: null, seal_prefix: true, reason: 'compare_material_and_frame_return' };
    },
    record(before, after, _command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, strategy, choice, scene } = proposal;
      const next: State = { ...local, steps: local.steps + 1, frameHash: after.frame_hash,
        evidence: [...local.evidence.slice(-4), after.observation_ref], stopped: true };
      const measurement = { ...config, observed_body_shapes: local.calibrations };
      if (strategy === 'test_marked_material' && scene) {
        const piece = choice.piece as Piece;
        const updated = measureTypedCarriers(second, after, measurement) as Scene | null;
        const preserved = updated && updated.carriers.length === scene.carriers.length && scene.carriers.every(old =>
          updated.carriers.some(result => same(old.bbox, result.bbox) && old.signature === result.signature && old.body_palette === result.body_palette));
        if (preserved && externalMark(piece.bbox, first, second)) {
          const [width, height] = shape(piece.bbox), size: NativePoint = [width + 1, height + 1];
          if (piece.support_source === 'component' && !local.calibrations.some(c => same(c.size, size))) {
            next.calibrations = [...local.calibrations, { size, evidence: [before.observation_ref, after.observation_ref] }];
          }
          next.marked = piece;
          next.stopped = false;
        }
      } else if (strategy === 'combine_compatible_material' && scene) {
        next.replacement = typedReplacementCandidate(scene, second, after, measurement) as Replacement | null;
        next.marked = null;
        next.stopped = !next.replacement;
      } else if (strategy === 'open_replacement_material' && local.replacement) {
        next.children = typedMaterialDescendants(local.replacement, first, second, after) as Child[];
        next.replacement = null;
        next.stopped = !next.children.length;
      } else if (strategy === 'select_produced_piece' && choice.child && typedLocalChildMark(choice.child, first, second)) {
        next.selected = choice.child;
        next.stopped = false;
      } else if (strategy === 'deliver_produced_piece' && choice.child && choice.request
        && !typedChildPresent(choice.child, second) && !same(patch(first, choice.request.bbox), patch(second, choice.request.bbox))) {
        const { child, request } = choice;
        next.children = local.children.filter(piece => piece.id !== child.id);
        next.selected = null;
        next.filled = [...local.filled, request.bbox];
        next.associations = { ...local.associations, [child.core_signature]: request.descriptor };
        next.stopped = false;
      }
      state = next;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
