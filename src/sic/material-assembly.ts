import { measureTypedCarriers, typedReplacementCandidate, typedMaterialDescendants, typedMaterialRequests,
  typedChildPresent, typedLocalChildMark, typedMaterialDigest, typedSmallParts, novelTypedControls, rotatedTypedMarks,
  currentTypedMarks, typedControlMatches } from '../logos-engine/v6-typed-material-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { pythonEqual } from '../logos-engine/v6-operations.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { compileStrategyGraph, observedMechanicsGroup, resolveStrategyGraph } from './strategy-agenda.ts';

export const materialAssemblyId = 'sic_material_assembly';
export const learnMaterialAssemblyId = 'sic_assemble_after_observed_mark';
export const materialAssemblyStrategies = {
  P02: navigationPrimitives.P02,
  P05: navigationPrimitives.P05,
  test_marked_material: 'Test the response of a piece with internal marks',
  combine_compatible_material: 'Test a second piece with a matching border pattern',
  open_replacement_material: 'Test the new piece that contains the previous marks',
  select_produced_piece: 'Select a produced piece with a compatible destination',
  orient_produced_core: 'Turn the selected piece’s internal marks toward a verified orientation',
  deliver_produced_piece: 'Test whether the selected piece fills the matching frame',
} as const;

const graph = compileStrategyGraph({
  id: 'assemble_and_apply_material_preserving_marks', version: 1, order: 'FALLBACK',
  priorities: ['deliver_produced_piece', 'orient_produced_core', 'select_produced_piece', 'open_replacement_material', 'combine_compatible_material', 'test_marked_material'],
  strategies: {
    test_marked_material: [{ fact: 'probe', expected: true, label: 'Several pieces have comparable internal marks and an input may reveal their role' }],
    combine_compatible_material: [{ fact: 'pair', expected: true, label: 'The first click marked a piece, and one other piece has the same border colors in the same counts' }],
    open_replacement_material: [{ fact: 'open', expected: true, label: 'A new piece contains marks from the pieces that disappeared' }],
    select_produced_piece: [{ fact: 'select', expected: true, label: 'A produced piece has a single compatible frame' }],
    orient_produced_core: [{ fact: 'turn', expected: true, label: 'An open frame matches another orientation of the selected marks, and a separate control is available' }],
    deliver_produced_piece: [{ fact: 'deliver', expected: true, label: 'The last return marked this piece, and its candidate frame is still visible' }],
  },
}, ['probe', 'pair', 'open', 'select', 'turn', 'deliver']);

type Piece = { id: string; bbox: NativeBox; center: NativePoint; point: NativePoint; signature: string;
  body_palette: number; fringe: number[][]; support_source?: string };
type Child = Piece & { core_signature: string; marks: number[][]; source_ref: string };
type AssemblyStrategy = Exclude<keyof typeof materialAssemblyStrategies, 'P02' | 'P05'>;
type Request = { bbox: NativeBox; point: NativePoint; descriptor: { palette: number } };
type Delivery = { core: string; destination: Request['descriptor']; evidence: string[] };
type SmallPart = { bbox: NativeBox; color: number; mask: number[][] };
type Control = { bbox: NativeBox; point: NativePoint; epoch: number; projection: NativeRows; source_ref: string };
type Calibration = { size: NativePoint; evidence: string[] };
type CompletedAssembly = { nextEpoch: number; score: number; deliveries: Delivery[]; parts?: SmallPart[]; calibrations?: Calibration[] };
type Scene = { carriers: Piece[]; source_ref: string };
type Replacement = { selected: Piece; removed: Piece[]; evidence: string[] };
type State = { epoch: number; frameHash: string; steps: number; marked: Piece | null; replacement: Replacement | null; children: Child[];
  selected: Child | null; filled: NativeBox[]; associations: Record<string, Request['descriptor']>;
  calibrations: Calibration[]; evidence: string[]; stopped: boolean; initialParts?: SmallPart[];
  deliveries?: Delivery[]; confirmed?: AssemblyStrategy[]; control?: Control; rotation?: { turns: number; evidence: string[] } };
type Choice = { piece: { bbox: NativeBox; point: NativePoint }; child?: Child; request?: Request; recalled?: Delivery | null;
  reorient?: boolean };
type Proposal = NativeProposal & { local: State; scene: Scene | null; choice: Choice; strategy: AssemblyStrategy; needId: string };

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
const visibleCore = (child: Child) => typedMaterialDigest(child.marks);
const rotateMarks = (marks: number[][], turns: number) => rotatedTypedMarks(marks, turns)
  .map(([value, dx, dy]) => [value!, dx || 0, dy || 0]);

function reorientation(child: Child, requests: Request[], deliveries: Delivery[], step: number): Choice | null {
  const options = [1, 2, 3].flatMap(count => {
    const core = typedMaterialDigest(rotateMarks(child.marks, count * step));
    return deliveries.filter(delivery => delivery.core === core).flatMap(recalled =>
      requests.filter(request => pythonEqual(request.descriptor, recalled.destination)).map(request => ({ request, recalled })));
  });
  const option = options[0];
  return option && options.every(item => same(item.request.bbox, option.request.bbox))
    ? { ...option, child, piece: child, reorient: true } : null;
}

function observedCoreTurn(child: Child, control: Control, before: NativeRows, after: NativeRows, expected?: number) {
  const marks = currentTypedMarks(child, after);
  if (!marks) return null;
  const turns = [1, 2, 3].filter(turn => same(rotateMarks(child.marks, turn), marks));
  if (turns.length !== 1 || (expected !== undefined && turns[0] !== expected)) return null;
  const [cx, cy] = child.center, [left, top, right, bottom] = control.bbox;
  const affected = [...child.marks, ...marks];
  for (let y = 0; y < before.length; y++) for (let x = 0; x < before[y]!.length; x++) {
    if (before[y]![x] === after[y]?.[x] || (left <= x && x <= right && top <= y && y <= bottom)) continue;
    if (!affected.some(([, dx, dy]) => x === cx + dx! && y === cy + dy!)) return null;
  }
  return { marks, turns: turns[0]! };
}

function deliveryReceipt(choice: Choice, before: NativeObservation, after: NativeObservation): Delivery | null {
  if (!choice.child || !choice.request) return null;
  return { core: visibleCore(choice.child), destination: choice.request.descriptor,
    evidence: [choice.child.source_ref, before.observation_ref, after.observation_ref] };
}

function confirmsMark(piece: Piece, scene: Scene, first: NativeRows, second: NativeRows, after: NativeObservation, calibrations: State['calibrations']) {
  if (!externalMark(piece.bbox, first, second)) return false;
  const updated = measureTypedCarriers(second, after, { ...config, observed_body_shapes: calibrations }) as Scene | null;
  return !!updated && updated.carriers.length === scene.carriers.length && scene.carriers.every(old =>
    updated.carriers.some(result => same(old.bbox, result.bbox) && old.signature === result.signature && old.body_palette === result.body_palette));
}

function calibrateMark(calibrations: State['calibrations'], piece: Piece, evidence: string[]) {
  const [width, height] = shape(piece.bbox), size: NativePoint = [width + 1, height + 1];
  return piece.support_source === 'component' && !calibrations.some(calibration => same(calibration.size, size))
    ? [...calibrations, { size, evidence }] : calibrations;
}

async function acquireMark(rows: NativeRows, observation: NativeObservation, execution: NativeExecution | undefined) {
  const receipt = await execution?.readPriorClickScene?.((first, before, command) => {
    const scene = measureTypedCarriers(first, before, { ...config, observed_body_shapes: [] }) as Scene | null;
    if (!scene) return null;
    const { x, y } = command.data;
    if (x === undefined || y === undefined) return null;
    const targets = scene.carriers.filter(({ bbox: [l, t, r, b] }) => l <= x && x <= r && t <= y && y <= b);
    return targets.length === 1 && confirmsMark(targets[0]!, scene, first, rows, observation, []) ? targets[0]! : null;
  });
  return receipt?.afterRef === observation.observation_ref && receipt.levelEpoch === observation.level_epoch ? receipt : null;
}

export function createSicMaterialAssembly(family = materialAssemblyId): NativeFamily<Proposal> {
  const learns = family === learnMaterialAssemblyId;
  let state: State | null = null;
  let completed: CompletedAssembly | null = null;
  let decide: NativeProgramHandle | undefined;
  const currentMemory = (observation: NativeObservation) => completed?.nextEpoch === observation.level_epoch
    && completed.score === observation.levels_completed ? completed : null;
  return {
    id: family,
    proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      const reusing = !learns && !!currentMemory(observation)?.deliveries.length;
      if ((group === observedMechanicsGroup) !== reusing) return null;
      return this.propose(observation, rows, inputs, remaining, execution);
    },
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior && (prior.stopped || prior.steps >= 36 || prior.frameHash !== observation.frame_hash)) return null;
      const acquired = learns && !prior ? await acquireMark(rows, observation, execution) : null;
      if (learns && !prior && !acquired) return null;
      const evidenceRefs = acquired ? [acquired.beforeRef, acquired.afterRef] : [];
      const memory = currentMemory(observation);
      const [controls, parts] = !prior && memory?.parts && memory.calibrations?.length
        ? novelTypedControls(memory.parts, rows, observation, { ...config, observed_body_shapes: memory.calibrations }) as [Control[], SmallPart[]]
        : [[], prior ? [] : typedSmallParts(rows) as SmallPart[]];
      const local: State = prior ?? { epoch: observation.level_epoch, frameHash: observation.frame_hash, steps: acquired ? 1 : 0,
        marked: acquired?.scene ?? null, replacement: null, children: [], selected: null, filled: [], associations: {},
        calibrations: acquired ? calibrateMark([], acquired.scene, evidenceRefs) : [], evidence: evidenceRefs, stopped: false,
        initialParts: parts, ...(controls.length === 1 ? { control: controls[0]! } : {}) };
      const scene = measureTypedCarriers(rows, observation, { ...config, observed_body_shapes: local.calibrations }) as Scene | null;
      const carriers = scene?.carriers ?? [];
      let select: Choice | null = null, deliver: Choice | null = null, pair: Choice | null = null, turn: Choice | null = null;
      if (local.children.length) {
        const transferred = memory?.deliveries ?? [];
        const requests = (typedMaterialRequests(rows, observation, local.filled.map(shape)) as Request[])
          .filter(request => !local.filled.some(box => same(request.bbox, box)));
        const children = local.selected ? [local.selected] : [...local.children].sort(byPosition);
        for (const child of children) {
          if (!typedChildPresent(child, rows)) continue;
          const core = visibleCore(child);
          const remembered = transferred.filter(delivery => delivery.core === core);
          const localDestination = local.associations[child.core_signature];
          const recalled = localDestination ? null : remembered[0] ?? null;
          if (recalled && remembered.some(delivery => !pythonEqual(delivery.destination, recalled.destination))) continue;
          const prior = localDestination ?? recalled?.destination;
          const candidates = requests.filter(request => prior ? pythonEqual(request.descriptor, prior) : request.descriptor.palette === child.body_palette);
          if (candidates.length !== 1) continue;
          const request = candidates[0]!;
          if (local.selected) deliver = { piece: request, child, request, recalled };
          else select = { piece: child, child, request, recalled };
          break;
        }
        if (!select && !deliver && local.control && typedControlMatches(local.control, rows, observation.level_epoch)) {
          for (const child of children) {
            if (!typedChildPresent(child, rows)) continue;
            const choice = reorientation(child, requests, transferred, local.rotation?.turns ?? 1);
            if (!choice) continue;
            if (local.selected) turn = { ...choice, piece: local.control };
            else select = choice;
            break;
          }
        }
      } else if (local.marked && !local.replacement) {
        const profile = fringeCounts(local.marked);
        const peers = carriers.filter(piece => !same(piece.bbox, local.marked!.bbox) && same(fringeCounts(piece), profile));
        if (peers.length === 1) pair = { piece: peers[0]! };
      }
      const open: Choice | null = local.replacement ? { piece: local.replacement.selected } : null;
      const first = !local.children.length && !local.replacement && !local.marked ? [...carriers].sort(byPosition)[0] : null;
      const probe: Choice | null = first ? { piece: first } : null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence,
        ...(deliver?.recalled?.evidence ?? select?.recalled?.evidence ?? turn?.recalled?.evidence ?? []),
        ...(turn && local.control ? [local.control.source_ref, ...(local.rotation?.evidence ?? [])] : [])].filter(value => value !== ref))];
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: { probe: { value: !!probe, evidence }, pair: { value: !!pair, evidence }, open: { value: !!open, evidence },
          select: { value: !!select, evidence }, turn: { value: !!turn, evidence }, deliver: { value: !!deliver, evidence } },
        planners: { test_marked_material: () => probe, combine_compatible_material: () => pair, open_replacement_material: () => open,
          select_produced_piece: () => select, orient_produced_core: () => turn, deliver_produced_piece: () => deliver },
      });
      if (!selected) return null;
      const choice: Choice = selected.plan, strategy = selected.id, parent = 'G_official_completion';
      const label = choice.reorient
        ? strategy === 'select_produced_piece' ? 'Select the piece whose internal marks need a different orientation'
          : local.rotation ? materialAssemblyStrategies.orient_produced_core : 'Test whether the new control rotates the selected marks in place'
        : choice.recalled
        ? strategy === 'deliver_produced_piece' ? 'Deliver the selected piece to the frame previously verified for its core'
          : 'Select the piece whose internal marks identify a previously verified frame'
        : materialAssemblyStrategies[strategy];
      const mode = execution?.reasoningMode ?? 'exploration';
      const repeated = local.confirmed?.includes(strategy) ?? false;
      const facts = { repeatSupportedInteraction: repeated, probeNeededInteraction: !repeated, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const primitive = repeated ? 'P02' : 'P05';
      if (learns && decision?.result !== primitive) return null;
      const selectedStrategy = learns ? primitive : strategy;
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, choice.piece.point, { reason: label, evidence });
      if (!pointBinding) return null;
      const [x, y] = choice.piece.point, action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const objective = { kind: 'assemble_and_apply_material_preserving_marks', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['marked_pieces', 'produced_piece', 'matching_frame'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_a_compatible_placement' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'material-assembly:' + need.id;
      return { status: 'proposed', kind: family, local, scene, choice, strategy, actions, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, point_binding: pointBinding,
          expected_after: turn?.child && local.rotation ? rotateMarks(turn.child.marks, local.rotation.turns) : null }],
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy: selectedStrategy, need: 'Find how marked pieces produce material that fills the frames', situation: label, evidence, agenda: entries,
          mode: learns ? mode : strategy === 'deliver_produced_piece' || (turn && local.rotation) ? 'solving'
            : strategy === 'select_produced_piece' ? 'assimilation' : 'exploration',
          ...(decision ? { triggerCard: decision.receipt.workflow } : {}),
          focus: choice.child?.bbox ?? choice.piece.bbox, partner: local.marked?.bbox ?? null, destination: choice.request?.bbox ?? null,
          ...(turn ? { control: turn.piece.bbox } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selectedStrategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_material_and_test_point_bound' : 'material_context_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local, choice, strategy } = proposal;
      if (strategy === 'orient_produced_core' && choice.child && local.control) {
        const matched = !!observedCoreTurn(choice.child, local.control, first, second, local.rotation?.turns);
        return { matched, seal_prefix: true, reason: matched ? 'observed_selected_core_turned_in_place' : 'selected_core_turn_not_confirmed' };
      }
      return { matched: null, seal_prefix: true, reason: 'compare_material_and_frame_return' };
    },
    record(before, after, _command, first, second, proposal) {
      const { local, strategy, choice, scene } = proposal;
      if (after.levels_completed > before.levels_completed) {
        const finalDelivery = strategy === 'deliver_produced_piece' && deliveryReceipt(choice, before, after);
        const deliveries = local.deliveries ?? [];
        if (finalDelivery && new Set(deliveries.map(delivery => delivery.core)).size >= 2) {
          completed = { nextEpoch: after.level_epoch, score: after.levels_completed, deliveries: [...deliveries, finalDelivery],
            ...(local.initialParts ? { parts: local.initialParts } : {}), calibrations: local.calibrations };
        }
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const next: State = { ...local, steps: local.steps + 1, frameHash: after.frame_hash,
        evidence: [...local.evidence.slice(-4), after.observation_ref], stopped: true };
      const measurement = { ...config, observed_body_shapes: local.calibrations };
      if (strategy === 'test_marked_material' && scene) {
        const piece = choice.piece as Piece;
        if (confirmsMark(piece, scene, first, second, after, local.calibrations)) {
          next.calibrations = calibrateMark(local.calibrations, piece, [before.observation_ref, after.observation_ref]);
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
      } else if (strategy === 'orient_produced_core' && choice.child && local.control) {
        const result = observedCoreTurn(choice.child, local.control, first, second, local.rotation?.turns);
        if (result) {
          const { marks, turns } = result;
          const child = { ...choice.child, marks, core_signature: typedMaterialDigest(['observed_oriented_core', marks]) };
          next.children = local.children.map(piece => piece.id === child.id ? child : piece);
          next.selected = child;
          next.control = { ...local.control, projection: patch(second, local.control.bbox) };
          next.rotation = { turns, evidence: [...(local.rotation?.evidence.slice(-2) ?? []), before.observation_ref, after.observation_ref] };
          next.stopped = false;
        }
      } else if (strategy === 'deliver_produced_piece' && choice.child && choice.request
        && !typedChildPresent(choice.child, second) && !same(patch(first, choice.request.bbox), patch(second, choice.request.bbox))) {
        const { child, request } = choice;
        next.children = local.children.filter(piece => piece.id !== child.id);
        next.selected = null;
        next.filled = [...local.filled, request.bbox];
        next.associations = { ...local.associations, [child.core_signature]: request.descriptor };
        const receipt = deliveryReceipt(choice, before, after);
        if (receipt) next.deliveries = [...(local.deliveries ?? []), receipt];
        next.stopped = false;
      }
      if (learns && !next.stopped && !next.confirmed?.includes(strategy)) next.confirmed = [...(next.confirmed ?? []), strategy];
      state = next;
      return { events: [] };
    },
    state: () => ({ state, completed }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      completed = structuredClone((value.completed as CompletedAssembly | null | undefined) ?? null);
    },
  };
}
