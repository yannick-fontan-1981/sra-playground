import {
  acquireConstellation, constellationAgreement, constellationBodyPixels, constellationCursorAt, constellationFocus,
  constellationJointGoal, constellationMaterial, constellationMechanicalPoseOptions, constellationMinus, constellationOutside,
  constellationPlus, ConstellationEvidence, measureConstellationLayout,
} from '../logos-engine/v6-constellation-cover.ts';
import { PointSet, type Point } from '../logos-engine/v6-point-set.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { markerAcquisitionRisk, markerContactKey, measureMarkerMaterialRegions, nextMarkerMaterialMove, type MaterialContact } from './marker-material-route.ts';
import { sicNeedId } from './need-identity.ts';

export const markerCoverageId = 'sic_marker_coverage';
export const verifyMarkerPlacementId = 'sic_verify_marker_placement';
export const markerCoverageStrategies = {
  measure_support_motion: 'Test how the selected piece moves',
  measure_remaining_directions: 'Complete the observed movement controls',
  change_controlled_support: 'Change which piece is controlled',
  cover_compatible_markers: 'Move the selected piece toward compatible markers',
} as const;

const phaseLabels = {
  acquire: markerCoverageStrategies.measure_support_motion,
  calibrate: markerCoverageStrategies.measure_remaining_directions,
  cycle: markerCoverageStrategies.change_controlled_support,
  move: markerCoverageStrategies.cover_compatible_markers,
};

type Step = { action: NativeCommand; cursor: Point; mode: 'acquire' | 'calibrate' | 'cycle' | 'move';
  poses?: readonly Point[]; expected_after: readonly Point[] | null; acquisition_focus_projection?: Point; unobserved_support_pixels?: number;
  materialContact?: MaterialContact };
type Proposal = NativeProposal & { steps: readonly Step[]; measured: NativeRecord; count: number; needId: string; dismissedContacts?: readonly string[] };

const command = (action_ref: string): NativeCommand => ({ action_ref, data: {} });
const samePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const distance = ([x, y]: Point) => Math.abs(x) + Math.abs(y);
function bounds(points: Iterable<Point>): NativeBox | null {
  const entries = [...points];
  if (!entries.length) return null;
  const xs = entries.map(point => point[0]), ys = entries.map(point => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

function measurements(snapshot: NativeRecord | null): ConstellationEvidence {
  const measured = new ConstellationEvidence();
  if (snapshot) measured.restore(snapshot);
  return measured;
}

function contactObserved(measured: ConstellationEvidence, step: Step, rows: NativeRows): boolean {
  if (!step.materialContact || !step.expected_after || measured.active === null) return false;
  const active = measured.active, body = measured.bodies[active]!, model = measured.model!;
  const color = step.materialContact.region.color, pose = step.expected_after[active]!;
  if (body.color === color) return false;
  const otherSameColor = new PointSet(measured.bodies.flatMap((piece, index) => index !== active && piece.color === color
    ? [...constellationBodyPixels(piece, step.expected_after![index]!)] : []));
  const visibleChange = [...constellationBodyPixels(body, pose)].some(([x, y]) => !model.excluded.has([x, y])
    && !model.boundary_overlay.has([x, y]) && !otherSameColor.has([x, y]) && rows[y]?.[x] === color);
  if (!visibleChange) return false;
  const bodies = measured.bodies.map((piece, index) => index === active ? { ...body, color } : piece);
  return constellationAgreement(rows, model, bodies, step.expected_after, pose, active);
}

function nextProbe(measured: ConstellationEvidence, rows: NativeRows, cursor: Point, inputs: readonly string[]): Step | null {
  const model = measured.model!;
  const untried = (input: string) => !measured.tried.has(JSON.stringify([input, cursor]));
  const unknown = inputs.find(input => !measured.motion.has(input) && input !== measured.selector && untried(input));
  if (measured.active === null) {
    if (unknown) return { action: command(unknown), cursor, mode: 'acquire', expected_after: null };
    const origin = measured.samples[0]!.focus;
    const offsets = measured.samples.map(sample => constellationMinus(sample.focus, origin));
    const contactRisk = markerAcquisitionRisk(measured, rows, cursor);
    const candidates = [...measured.motion].flatMap(([input, vector]) => {
      const point = constellationPlus(cursor, vector), [x, y] = point;
      if (!inputs.includes(input) || !untried(input) || constellationOutside(new PointSet([point]), model).size
        || measured.bodies.some((body, i) => constellationBodyPixels(body, measured.poses[i]!).has(point))) return [];
      const independent = offsets.some(offset => vector[0] * offset[1] !== vector[1] * offset[0]);
      return [{ input, point, rank: 4 * contactRisk(point) + 2 * Number(!independent) + Number(rows[y]![x] !== model.background) }];
    });
    candidates.sort((a, b) => a.rank - b.rank);
    const choice = candidates[0];
    return choice ? { action: command(choice.input), cursor, mode: 'acquire', expected_after: null,
      acquisition_focus_projection: choice.point } : null;
  }
  if (measured.motion.size < 4) {
    const vectors = [...measured.motion.values()];
    const input = unknown ?? [...measured.motion].find(([key, vector]) =>
      inputs.includes(key) && untried(key) && !vectors.some(other => samePoint(other, [-vector[0], -vector[1]])))?.[0];
    return input ? { action: command(input), cursor, mode: 'calibrate', expected_after: null } : null;
  }
  const input = measured.selector ?? inputs.find(key => !measured.motion.has(key));
  return input && inputs.includes(input) ? { action: command(input), cursor, mode: 'cycle', expected_after: null } : null;
}

export function createSicVerifyMarkerPlacement(): NativeFamily<Proposal> {
  let snapshot: NativeRecord | null = null;
  let count = 0;
  let dismissedContacts: readonly string[] = [];
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyMarkerPlacementId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      const keys = inputs.filter(input => !Object.keys(input.data ?? {}).length && input.action_ref !== 'ACTION7').map(input => input.action_ref);
      if (remaining < 1 || keys.length < 3) return null;
      const prior = snapshot?.epoch === observation.level_epoch ? snapshot : null;
      const issued = prior ? count : 0;
      const dismissed = prior ? dismissedContacts : [];
      if (issued >= 64) return null;
      const measured = measurements(prior);
      if (!prior) {
        measured.epoch = observation.level_epoch;
        measured.firstObservation = observation.observation_ref;
        const regions = measureMarkerMaterialRegions(observation, rows);
        measured.model = (regions.length ? measureConstellationLayout(observation, rows, regions) : null)
          ?? measureConstellationLayout(observation, rows);
      }
      const model = measured.model;
      if (!model || measured.retired) return null;
      const retained = measured.active === null ? null : measured.poses[measured.active]!;
      const cursor = constellationFocus(rows, model) ?? (measured.complete && retained
        && constellationCursorAt(rows, model, retained, measured.bodies, measured.poses, measured.active) ? retained : null);
      if (!cursor) return null;
      if (!measured.samples.length) measured.samples.push({ focus: cursor, material: constellationMaterial(rows, model) });
      if (measured.active === null) {
        const learned = acquireConstellation(measured.samples, model);
        if (learned) {
          measured.active = measured.bodies.length;
          measured.bodies.push(learned);
          measured.poses.push(cursor);
        }
      }

      let step: Step | null = null;
      const route: Step[] = [];
      let destination: NativeBox | null = null;
      let finalPlacement: NativeBox | null = null;
      let colorSource: NativeBox | undefined;
      const active = measured.active;
      if (!measured.complete) step = nextProbe(measured, rows, cursor, keys);
      else if (active !== null && constellationAgreement(rows, model, measured.bodies, measured.poses, cursor, active)) {
        if (model.materialRegions) {
          const next = nextMarkerMaterialMove(measured, keys, dismissed);
          if (next?.kind === 'cycle' && measured.selector && keys.includes(measured.selector)) {
            step = { action: command(measured.selector), cursor, mode: 'cycle', poses: measured.poses, expected_after: null };
          } else if (next?.kind === 'move') {
            const poses = [...measured.poses];
            poses[active] = next.next;
            finalPlacement = bounds(constellationBodyPixels(measured.bodies[active]!, next.goal));
            colorSource = next.source;
            destination = next.contact?.region.box ?? colorSource ?? finalPlacement;
            step = { action: command(next.key), cursor, mode: 'move', poses: measured.poses,
              expected_after: poses, ...(next.contact ? { materialContact: next.contact } : {}) };
          }
        } else {
          const quantum = [...measured.motion.values()].flat().reduce((result, value) => gcd(result, Math.abs(value)), 0);
          if (!quantum) return null;
          const options = await constellationMechanicalPoseOptions(observation, rows, measured.bodies, measured.poses, model, quantum);
          const goal = constellationJointGoal(measured.bodies, measured.poses, model, quantum, options);
          if (!goal || measured.poses.every((pose, i) => samePoint(pose, goal[i]!))) return null;
          const delta = constellationMinus(goal[active]!, measured.poses[active]!);
          destination = bounds(constellationBodyPixels(measured.bodies[active]!, goal[active]!));
          if (distance(delta) === 0) {
            if (measured.selector && keys.includes(measured.selector)) step = { action: command(measured.selector), cursor, mode: 'cycle',
              poses: measured.poses, expected_after: null };
          } else {
            let poses = measured.poses;
            let at = cursor;
            for (let i = 0; i < Math.min(remaining, 64 - issued, 16); i++) {
              const offset = constellationMinus(goal[active]!, at);
              const move = [...measured.motion].find(([key, vector]) => keys.includes(key)
                && distance(constellationMinus(offset, vector)) < distance(offset));
              if (!move) break;
              const next = [...poses];
              next[active] = constellationPlus(at, move[1]);
              const hidden = constellationOutside(constellationBodyPixels(measured.bodies[active]!, next[active]!), model).size;
              if (hidden && route.length) break;
              route.push({ action: command(move[0]), cursor: at, mode: 'move', poses, expected_after: next, unobserved_support_pixels: hidden });
              if (hidden) break;
              poses = next;
              at = next[active]!;
            }
            step = route[0] ?? null;
          }
        }
      }
      if (!step) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...new Set([...measured.refs.values()].filter(value => value !== ref))];
      const mode = execution?.reasoningMode ?? (step.mode === 'move' ? 'solving' : measured.complete ? 'assimilation' : 'exploration');
      const routeSupported = step.mode === 'move';
      const knownInteraction = step.mode === 'cycle' && measured.selector === step.action.action_ref;
      const facts = { routeSupported, knownInteraction, eligibleProbe: !routeSupported && !knownInteraction, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = routeSupported ? 'P07' : knownInteraction ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const label = step.materialContact ? 'Check whether contact changes the piece to the marker color'
        : colorSource ? 'Approach a candidate source of the marker color' : phaseLabels[step.mode];
      const parent = 'G_official_completion';
      const objective = { kind: 'place_independently_controlled_supports', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['selected_piece', 'other_pieces', 'compatible_markers'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_observed_marker_coverage' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'marker-coverage:' + need.id, steps = route.length ? route : [step];
      const actions = steps.map(leg => leg.action);
      return { status: 'proposed', kind: verifyMarkerPlacementId, actions, steps, measured: measured.state(), count: issued, needId: need.id,
        dismissedContacts: dismissed,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch, levels_completed: observation.levels_completed },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Bring movable pieces onto compatible markers when their controls are known', mode,
          situation: measured.complete ? label : label + '. Some pixels may belong to overlapping pieces.',
          agenda: [], evidence, triggerCard: decision.receipt.workflow,
          actor: active === null ? bounds([cursor]) : bounds(constellationBodyPixels(measured.bodies[active]!, cursor)),
          otherSupports: measured.bodies.flatMap((body, i) => i === active ? [] : [bounds(constellationBodyPixels(body, measured.poses[i]!))]),
          targets: destination ? [destination, ...(finalPlacement && finalPlacement !== destination ? [finalPlacement] : [])] : [...model.targets.values()].map(bounds) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const result = measurements(proposal.measured).before(proposal, index, packet, observation);
      return { admitted: result.admitted, reason: result.reason };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const measured = measurements(proposal.measured), step = proposal.steps[index]!;
      if (contactObserved(measured, step, second)) return { matched: true, seal_prefix: true, reason: 'observed_material_change_with_preserved_supports' };
      const result = measured.after(proposal, index, before, after, first, second);
      if (step.materialContact?.expected && result.matched) return { matched: false, seal_prefix: true, reason: 'material_contact_without_color_change' };
      return { matched: result.matched, seal_prefix: result.seal_prefix, reason: result.reason };
    },
    async record(before, after, command, first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const retained = index > 0 && count === proposal.count + index && snapshot?.epoch === before.level_epoch;
      const measured = measurements(retained ? snapshot : proposal.measured);
      const step = proposal.steps[index]!, contact = step.materialContact;
      dismissedContacts = proposal.dismissedContacts ?? [];
      if (contact && measured.active !== null) {
        if (contactObserved(measured, step, second)) {
          measured.bodies[measured.active]!.color = contact.region.color;
          measured.refs.set('material:' + contact.region.box.join(','), after.observation_ref);
        } else if (contact.expected) {
          dismissedContacts = [...dismissedContacts, markerContactKey(contact.region, step.expected_after![measured.active]!)];
        }
      }
      await measured.record(before, after, command, first, second, proposal, index);
      measured.events = [];
      snapshot = measured.state();
      count = proposal.count + index + 1;
      return { events: [] };
    },
    state: () => ({ snapshot, count, dismissedContacts }),
    restore(value) {
      snapshot = structuredClone(value.snapshot as NativeRecord | null ?? null);
      count = typeof value.count === 'number' ? value.count : 0;
      dismissedContacts = Array.isArray(value.dismissedContacts) ? value.dismissedContacts as string[] : [];
    },
  };
}
