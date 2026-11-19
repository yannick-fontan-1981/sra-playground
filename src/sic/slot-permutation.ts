import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { fitOrbit, measureOrbitField, orbitCycles, orbitRoute, orbitValues, type OrbitField } from '../logos-engine/v6-orbit-constraints.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { diagonalSlotContours, fitDisjointSlotCycles, measureBentSlotCycles, projectionWithinLimit, radialSlotPermutations } from './slot-field-transforms.ts';

export const slotPermutationId = 'sic_slot_permutation';
export const verifySlotPermutationId = 'sic_verify_slot_permutation';
export const learnSlotPermutationId = 'sic_learn_slot_permutation';
export const slotPermutationStrategies = {
  test_slot_permutation: 'Test how a visible control rearranges the slots',
  apply_slot_permutation: 'Apply a measured rearrangement toward the marked target',
  distinguish_slot_permutations: 'Retest on a different arrangement to distinguish possible effects',
} as const;

type Model = { key: NativePoint; permutations: number[][]; evidence: string; tried: string[] };
type State = { layout: string; models: Record<string, Model>; count: number };
type Board = { positions: NativePoint[]; size: number; targetSlots: number[] };
type Track = { across: 0 | 1; lanes: number[]; indices: number[]; alternating: number[] };
type Geometry = { layout: string; tracks: Track[]; rings?: number[][]; radial?: number[][]; bent?: number[][]; diagonals?: number[][] };
type SlotLeg = { control: NativePoint; values: number[]; prediction: number[] | null };
type Proposal = NativeProposal & { local: State; board: Board; route: SlotLeg[]; needId: string };
const key = (value: unknown) => JSON.stringify(value);
const sortedControls = (scene: OrbitField) => [...scene.controls.values()].sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1]);
const layoutKey = (epoch: number, scene: OrbitField) =>
  key([epoch, scene.positions, scene.size, [...scene.targets], sortedControls(scene).map(control => control.key)]);
const predict = (permutation: readonly number[], values: readonly number[]) => permutation.map(i => values[i]!);
const maxProjectedStates = 32 ** 3;
const maxMeasuredSlots = 128;

function visibleControlInputs(observation: NativeObservation): NativeCommand[] {
  return observation.entities.flatMap(entity => {
    if (entity.rectangular || entity.mask.length === 0 || entity.area < 4) return [];
    const [left, top, right, bottom] = entity.bbox;
    const distance = ([x, y]: NativePoint) => Math.abs(2 * x + left - right) + Math.abs(2 * y + top - bottom);
    const [x, y] = entity.mask.reduce((best, point) => distance(point) < distance(best) ? point : best);
    return [{ action_ref: 'ACTION6', data: { x: x + left, y: y + top } }];
  });
}

function distributedTracks(positions: readonly NativePoint[]): Track[] {
  const tracks: Track[] = [];
  for (const across of [0, 1] as const) {
    const along = across === 0 ? 1 : 0;
    const lines = new Map<number, number[]>();
    for (const [index, position] of positions.entries()) {
      const lane = lines.get(position[across]) ?? [];
      lane.push(index);
      lines.set(position[across], lane);
    }
    const profiles = new Map<string, { lanes: number[]; segments: number[][] }>();
    for (const [lane, indices] of [...lines].sort(([a], [b]) => a - b)) {
      indices.sort((a, b) => positions[a]![along] - positions[b]![along]);
      const coordinates = indices.map(i => positions[i]![along]);
      if (coordinates.length < 4) continue;
      const gaps = coordinates.slice(1).map((value, i) => value - coordinates[i]!);
      const pitch = Math.min(...gaps);
      const boundaries = [0, ...gaps.flatMap((gap, i) => gap > pitch ? [i + 1] : []), indices.length];
      if (boundaries.length < 3 || boundaries.slice(1).some((end, i) => end - boundaries[i]! < 2)) continue;
      const profile = profiles.get(key(coordinates)) ?? { lanes: [], segments: [] };
      profile.lanes.push(lane);
      profile.segments.push(indices);
      profiles.set(key(coordinates), profile);
    }
    for (const { lanes, segments } of profiles.values()) {
      if (lanes.length < 2) continue;
      tracks.push({ across, lanes, indices: segments.flat(),
        alternating: segments.flatMap((line, i) => i % 2 === 0 ? line : [...line].reverse()) });
    }
  }
  return tracks;
}

function latticeChain(positions: readonly NativePoint[]): number[] {
  const pitches = ([0, 1] as const).map(axis => {
    const values = [...new Set(positions.map(point => point[axis]))].sort((a, b) => a - b);
    return Math.min(...values.slice(1).map((value, i) => value - values[i]!));
  });
  if (pitches.some(value => !Number.isFinite(value))) return [];
  const [dx, dy] = pitches as [number, number];
  const byPoint = new Map(positions.map((point, i) => [key(point), i]));
  const neighbors = positions.map(([x, y]) => [[x - dx, y], [x + dx, y], [x, y - dy], [x, y + dy]].flatMap(point => {
    const index = byPoint.get(key(point));
    return index === undefined ? [] : [index];
  }));
  const ends = neighbors.flatMap((adjacent, i) => adjacent.length === 1 ? [i] : []);
  if (ends.length !== 2 || neighbors.some(adjacent => adjacent.length < 1 || adjacent.length > 2)) return [];
  const chain = [ends[0]!];
  while (chain.at(-1) !== ends[1]) {
    const next = neighbors[chain.at(-1)!]!.find(index => index !== chain.at(-2));
    if (next === undefined) return [];
    chain.push(next);
  }
  return chain.length === positions.length ? chain : [];
}

function slotContours(positions: readonly NativePoint[], tracks: readonly Track[]): number[][] {
  const chain = latticeChain(positions);
  return [...orbitCycles(positions), ...tracks.flatMap(track => [track.indices, track.alternating]), ...(chain.length ? [chain] : [])];
}

function fitSlotPermutations(before: readonly number[], after: readonly number[], geometry: Geometry,
  positions: readonly NativePoint[], targetSlots: readonly number[]) {
  if (before.length !== after.length || before.every((value, i) => value === after[i])) return [];
  if (geometry.bent?.length) {
    geometry.diagonals ??= diagonalSlotContours(positions);
    const single = fitOrbit(before, after, geometry.diagonals);
    const coupled = geometry.bent.filter(permutation => permutation.every((source, i) => before[source] === after[i]));
    const fitted = [...new Map([...single, ...coupled].map(permutation => [key(permutation), permutation])).values()];
    if (fitted.length) return fitted;
  }
  geometry.rings ??= slotContours(positions, geometry.tracks);
  const contour = fitOrbit(before, after, geometry.rings);
  if (contour.length && !geometry.radial) return contour;
  geometry.radial ??= radialSlotPermutations(positions, targetSlots);
  const radial = geometry.radial.filter(permutation => permutation.every((source, i) => before[source] === after[i]));
  const options = [...new Map([...contour, ...radial].map(permutation => [key(permutation), permutation])).values()];
  return options.length ? options : fitDisjointSlotCycles(before, after, positions, geometry.rings);
}

function prioritizeTrials(tracks: readonly Track[], size: number, controls: ReturnType<typeof sortedControls>, models: State['models']) {
  const unmeasured = controls.filter(control => !models[key(control.key)]);
  if (!tracks.length) return unmeasured[0];
  const axis = (point: NativePoint) => {
    const alignments = new Set(tracks.filter(track => track.lanes.some(lane =>
      lane <= point[track.across] && point[track.across] < lane + size)).map(track => track.across));
    return alignments.size === 1 ? [...alignments][0]! : null;
  };
  const covered = Object.values(models).map(model => axis(model.key));
  const novel = unmeasured.find(control => { const aligned = axis(control.key); return aligned !== null && !covered.includes(aligned); });
  return novel ?? unmeasured[0];
}

export function createSicVerifySlotPermutation(family = verifySlotPermutationId, transferObservedPermutation = false): NativeFamily<Proposal> {
  const learns = family === learnSlotPermutationId;
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  let geometry: Geometry | null = null;
  let retained: { epoch: number; refs: string[] } | null = null;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const scene = measureOrbitField(observation, visibleControlInputs(observation));
      if (!scene || scene.positions.length > maxMeasuredSlots || scene.targets.size > 3) return null;
      const { positions, size, targets } = scene, controls = sortedControls(scene);
      const targetSlots = [...targets.keys()];
      const layout = layoutKey(observation.level_epoch, scene);
      if (geometry?.layout !== layout) geometry = { layout, tracks: distributedTracks(positions) };
      const extended = positions.length > 64 || positions.length ** targets.size > maxProjectedStates;
      if (extended && !(geometry.radial ??= radialSlotPermutations(positions, targetSlots)).length
        && !(geometry.bent ??= measureBentSlotCycles(positions, targetSlots)).length) return null;
      const { tracks } = geometry;
      if (controls.length > (tracks.length ? 32 : 8)) return null;
      let local: State = state?.layout === layout ? state : { layout, models: {}, count: 0 };
      if (local.count >= 32) return null;
      const values = orbitValues(rows, positions, size);
      if (!values.length || [...targets].every(([i, color]) => values[i] === color)) return null;
      const recalled = transferObservedPermutation && retained?.epoch === observation.level_epoch - 1 ? retained : null;
      if (learns && !recalled && !local.count) {
        const evidence = await execution?.readPriorClickScene?.((first, previous, action) => {
          const prior = measureOrbitField(previous, visibleControlInputs(previous));
          const point: NativePoint = [action.data.x!, action.data.y!];
          if (!prior || key(prior.positions) !== key(positions) || prior.size !== size || key([...prior.targets]) !== key([...targets])
            || !prior.controls.has(key(point)) || !scene.controls.has(key(point))) return null;
          const before = orbitValues(first, positions, size);
          if (key(before) === key(values)) return null;
          const permutations = fitSlotPermutations(before, values, geometry!, positions, targetSlots);
          return permutations.length === 1 ? { point, before, permutations } : null;
        });
        if (!evidence || evidence.afterRef !== observation.observation_ref || evidence.levelEpoch !== observation.level_epoch) return null;
        const { point, before, permutations } = evidence.scene;
        local = { layout, count: 1, models: { [key(point)]: { key: point, permutations, evidence: evidence.afterRef, tried: [key(before)] } } };
      }
      const operators = new Map(Object.entries(local.models).flatMap(([ref, model]) =>
        model.permutations.length === 1 ? [[ref, { key: model.key, permutation: model.permutations[0]! }] as const] : []));
      const path = !extended || projectionWithinLimit(targets, operators.values(), maxProjectedStates)
        ? orbitRoute(values, targets, operators, Math.min(remaining, 32 - local.count)) : null;
      const next = path?.length ? scene.controls.get(key(path[0])) : null;
      if (learns && !recalled && !next) return null;
      const unmeasured = prioritizeTrials(tracks, size, controls, local.models);
      const arrangement = key(values);
      const ambiguous = controls.find(control => {
        const model = local.models[key(control.key)];
        return model && model.permutations.length > 1 && !model.tried.includes(arrangement)
          && new Set(model.permutations.map(permutation => key(predict(permutation, values)))).size > 1;
      });
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...(recalled?.refs ?? []), ...Object.values(local.models).map(model => model.evidence)])];
      const trial = unmeasured ?? ambiguous;
      const mode = execution?.reasoningMode ?? (next ? 'solving' : 'exploration');
      const facts = { routeSupported: !!next, eligibleProbe: !!trial, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || (strategy !== 'P07' && strategy !== 'P05')) return null;
      const control = strategy === 'P07' ? next : trial;
      if (!control) return null;
      const phase = strategy === 'P07' ? 'apply_slot_permutation' : unmeasured ? 'test_slot_permutation' : 'distinguish_slot_permutations';
      const label = slotPermutationStrategies[phase], parent = 'G_official_completion';
      const goal = { kind: 'match_visible_marked_slots', scope: ref.split(':revision:', 1)[0]!, subjects: ['marked_slot_field'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_matching_marked_slots' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `${learns ? family : 'slot-permutation'}:${need.id}`;
      const [x, y] = control.key, command = { action_ref: 'ACTION6', data: { x, y } }, actions = [command];
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, control.key, { reason: label, evidence });
      const operator = operators.get(key(control.key));
      const prediction = operator ? predict(operator.permutation, values) : null;
      const route: SlotLeg[] = [{ control: control.key, values, prediction }];
      const steps = [{ action: command, expected_after: prediction, point_binding: pointBinding }];
      if (strategy === 'P07') for (const target of path!.slice(1, maximumCommittedActions)) {
        const next = operators.get(key(target)), previous = route.at(-1)!.prediction;
        if (!next || !previous) break;
        const [x, y] = target;
        const action = { action_ref: 'ACTION6', data: { x, y } };
        const witness = key(target) === key(control.key) ? pointBinding
          : await ObservedInputDomain.makeLocusWitness(observation, rows, target, { reason: label, evidence });
        const prediction = predict(next.permutation, previous);
        route.push({ control: target, values: previous, prediction });
        actions.push(action);
        steps.push({ action, expected_after: prediction, point_binding: witness });
      }
      const moving = operator?.permutation.flatMap((from, to) => from === to ? [] : [to]) ?? [];
      const distributed = tracks.find(track => track.indices.length === moving.length && track.indices.every(i => moving.includes(i)));
      const slot = (i: number) => { const [x, y] = positions[i]!; return [x, y, x + size - 1, y + size - 1]; };
      const targetColors = new Set(targets.values());
      const motion = (distributed || geometry.radial?.length) && operator ? moving.flatMap(to => {
        const from = operator.permutation[to]!;
        return values[from] !== values[to] && targetColors.has(values[from]!) ? [{ source: slot(from), destination: slot(to) }] : [];
      }).slice(0, 3) : [];
      const situation = distributed && next ? `This control rearranges ${moving.length} slots across ${distributed.lanes.length} lines. ${path!.length} moves remain.`
        : strategy === 'P07' ? `The measured rearrangements give a route in ${path!.length} moves.` : label;
      return { status: 'proposed', kind: family, actions, local, route,
        board: { positions, size, targetSlots }, needId: need.id, steps,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Bring the marked slots to their displayed target colors', mode,
          situation,
          agenda: [], evidence, triggerCard: decision.receipt.workflow,
          ...(recalled && !local.count ? { newLevelConfiguration: 'Measure the permutations of the controls on the current slot layout' } : {}),
          control: control.box, distance: strategy === 'P07' ? path!.length : null,
          targets: targetSlots.map(slot), ...(motion.length ? { motion } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const { positions, size } = proposal.board;
      const field = index > 0 ? measureOrbitField(observation, visibleControlInputs(observation)) : null;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!field && proposal.binding?.level_epoch === observation.level_epoch
          && layoutKey(observation.level_epoch, field) === proposal.local.layout
          && key(orbitValues(packet.frame_rows, positions, size)) === key(proposal.route[index]!.values);
      return { admitted, reason: admitted ? 'slot_permutation_bound' : 'slot_permutation_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const actual = orbitValues(second, proposal.board.positions, proposal.board.size);
      const { prediction } = proposal.route[index]!;
      const matched = prediction ? key(actual) === key(prediction) : null;
      return { matched, seal_prefix: !matched || index + 1 >= proposal.route.length, reason: matched === false ? 'slot_permutation_contradicted'
        : matched ? 'slot_permutation_confirmed' : 'observe_slot_rearrangement' };
    },
    record(before, after, _command, _first, second, proposal, index) {
      if (transferObservedPermutation && after.levels_completed > before.levels_completed && proposal.route[index]?.prediction) {
        const proven = Object.values((state?.layout === proposal.local.layout ? state : proposal.local).models)
          .filter(model => model.permutations.length === 1).map(model => model.evidence);
        if (proven.length) retained = { epoch: before.level_epoch, refs: [...new Set(proven)].slice(-8) };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = (index > 0 && state?.layout === proposal.local.layout ? state : null) ?? proposal.local;
      const { positions, size, targetSlots } = proposal.board;
      const { control, values, prediction } = proposal.route[index]!;
      const actual = orbitValues(second, positions, size);
      const prior = local.models[key(control)];
      let permutations: number[][] = [];
      if (prediction && key(prediction) === key(actual) && key(values) !== key(actual)) {
        permutations = prior?.permutations ?? [];
      } else if (actual.length) {
        if (geometry?.layout !== local.layout) geometry = { layout: local.layout, tracks: distributedTracks(positions) };
        const possible = fitSlotPermutations(values, actual, geometry, positions, targetSlots);
        permutations = prior ? possible.filter(option => prior.permutations.some(previous => key(previous) === key(option))) : possible;
      }
      const model = { key: control, permutations, evidence: after.observation_ref, tried: [...(prior?.tried ?? []), key(values)] };
      state = { ...local, models: { ...local.models, [key(control)]: model }, count: local.count + 1 };
      return { events: [] };
    },
    state: () => ({ state, ...(retained ? { retained } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      retained = structuredClone((value.retained ?? null) as typeof retained);
    },
  };
}
