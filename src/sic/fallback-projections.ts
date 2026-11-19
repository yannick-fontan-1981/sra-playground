import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import { localTraceEffect } from '../logos-engine/v6-trace-field-access.ts';
import { constructTraceField } from '../logos-engine/v6-trace-field-mechanics.ts';
import { measureTraceField, traceFieldCenter } from '../logos-engine/v6-trace-field-observation.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeObservation, NativePoint, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { observeMarkerStep, projectMarkerStep } from './marker-coverage.ts';
import { chooseVisibleOccurrence, observeVisibleOccurrence } from './occurrence-recall.ts';
import { matchesChannelOpening, nextChannelTile, planDistinctChannels } from './paired-channels.ts';
import { measurePointReach, pointReachActor, pointReachReserve, pointReachStep } from './point-reach.ts';
import { directProfileStep, matchesDirectProfileStep, measureProfileTransfer, profileTransferStrategies, receiverFilled } from './profile-transfer.ts';
import { rememberRouteRefusal, type RouteRefusals } from './route-refusals.ts';
import { checkStagedMarkStep, chooseStagedMarkStep, measureStagedMarks, readStagedMarks } from './staged-marks.ts';
import { fillsTarget, uniquePatternOption } from './visual-pattern.ts';

type TraceScene = NonNullable<ReturnType<typeof measureTraceField>>;
type PointModel = NonNullable<ReturnType<typeof measurePointReach>>;
type MarksModel = NonNullable<ReturnType<typeof measureStagedMarks>>;
type ChannelPlan = NonNullable<ReturnType<typeof planDistinctChannels>>;
type ProfileScene = NonNullable<ReturnType<typeof measureProfileTransfer>>;
type OccurrenceChoice = NonNullable<ReturnType<typeof chooseVisibleOccurrence>>;
type MarkerStep = NonNullable<Awaited<ReturnType<typeof projectMarkerStep>>>;

type Value =
  | { kind: 'trace'; geometry: TraceScene['geometry']; geometryRef: string }
  | { kind: 'reach'; layout: PointModel; radius: number; cost: number | null; blocked: RouteRefusals }
  | { kind: 'marks'; model: MarksModel; resizeRef: string | null; rejected: string[] }
  | { kind: 'channel'; plan: ChannelPlan; spent: number }
  | { kind: 'profile'; anchor?: ProfileScene['receiverAnchor'] }
  | { kind: 'occurrence'; sequence: OccurrenceChoice['local'] }
  | { kind: 'marker'; snapshot: NativeRecord };
type Model<K extends Value['kind']> = Extract<Value, { kind: K }>;
export type FallbackProjectionMemory = { value: Value; refs: string[]; retired?: true };
type Check =
  | { kind: 'pattern'; expected: Parameters<typeof fillsTarget>[0] }
  | { kind: 'trace'; memory: Model<'trace'>; scene: TraceScene; to: NativePoint }
  | { kind: 'reach'; memory: Model<'reach'>; actor: NativePoint; to: NativePoint; reserve: number }
  | { kind: 'marks'; memory: Model<'marks'>; scene: NonNullable<ReturnType<typeof readStagedMarks>>;
    choice: NonNullable<ReturnType<typeof chooseStagedMarkStep>> }
  | { kind: 'channel'; memory: Model<'channel'>; tile: NonNullable<ReturnType<typeof nextChannelTile>> }
  | { kind: 'profile'; memory: Model<'profile'>; scene: ProfileScene; offer: NonNullable<ReturnType<typeof directProfileStep>>; target: number }
  | { kind: 'occurrence'; choice: OccurrenceChoice }
  | { kind: 'marker'; step: MarkerStep };

export type FallbackProjection = { command: NativeCommand; box: NativeBox; goal: NativeBox; label: string;
  objective: string; evidence: string[]; check: Check };
type ProjectionReceipt = { matched: boolean | null; memory?: FallbackProjectionMemory };

const traceOptions = { distinguishCellSupport: true };
const click = ([x, y]: NativePoint): NativeCommand => ({ action_ref: 'ACTION6', data: { x, y } });
const pointBox = ([x, y]: NativePoint): NativeBox => [x, y, x, y];
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);

export async function chooseFallbackProjection(previous: FallbackProjectionMemory | undefined, observation: NativeObservation,
  rows: NativeRows, inputs: readonly NativeCommand[], remaining: number, execution?: NativeExecution): Promise<FallbackProjection | undefined> {
  if (previous?.retired || execution?.signal?.aborted) return;
  const available = observation.available_action_refs, evidence = previous?.refs ?? [], prior = previous?.value;
  const pointer = available.includes('ACTION6');
  const directions = available.filter(action => /^ACTION[1-4]$/.test(action));
  if (pointer && (!prior || prior.kind === 'trace')) {
    const scene = measureTraceField(rows, prior?.geometry ?? null, traceOptions);
    if (scene && (!prior || scene.geometry_ref === prior.geometryRef)) {
      const now = execution?.now ?? (() => performance.now());
      const route = constructTraceField(scene, observation, remaining, Math.min(now() + 40, execution?.deadlineMs ?? Infinity), now);
      const to = route?.path[scene.prefix.length] as NativePoint | undefined;
      if (to) {
        const point = traceFieldCenter(scene.geometry, to);
        return { command: click(point), box: pointBox(point), goal: pointBox(traceFieldCenter(scene.geometry, route!.path.at(-1)! as NativePoint)),
          label: evidence.length ? 'Extend the verified trace toward complete coverage' : 'Test whether selecting the adjacent cell extends the trace',
          objective: 'cover_visible_cells_without_revisiting', evidence, check: { kind: 'trace', scene, to,
            memory: { kind: 'trace', geometry: scene.geometry, geometryRef: scene.geometry_ref } } };
      }
    }
  }
  if (pointer && !directions.length && !available.includes('ACTION5')) {
    if (!prior || prior.kind === 'reach') {
      const parts = geometricComponents(rows), layout = prior?.layout ?? measurePointReach(rows, parts);
      if (layout) {
        const memory = prior ?? { kind: 'reach' as const, layout, radius: 0, cost: null, blocked: [] };
        const actor = pointReachActor(parts, layout), reserve = pointReachReserve(rows, layout);
        const to = actor && reserve >= (memory.cost ?? 1) ? pointReachStep(actor, memory) : null;
        if (actor && to) return { command: click(to), box: pointBox(to), goal: layout.goal,
          label: memory.radius ? 'Approach the receptor within the measured range and remaining reserve' : 'Test a landing to measure range and reserve cost',
          objective: 'reach_visible_receptor_within_reserve', evidence, check: { kind: 'reach', memory, actor, to, reserve } };
      }
    }
    if (!prior || prior.kind === 'channel') {
      const plan = prior?.plan ?? planDistinctChannels(rows, remaining);
      if (plan && (prior?.spent ?? 0) < plan.layout.reserve) {
        const tile = nextChannelTile(rows, plan);
        if (tile) return { command: click(center(tile.tile.box)), box: tile.tile.box, goal: tile.pair.to.box,
          label: evidence.length ? 'Open the next cell on the route to the matching endpoint' : 'Test whether selecting a closed cell opens a channel',
          objective: 'connect_visible_endpoint_pairs', evidence, check: { kind: 'channel', memory: prior ?? { kind: 'channel', plan, spent: 0 }, tile } };
      }
    }
    if (!prior || prior.kind === 'occurrence') {
      const choice = chooseVisibleOccurrence(prior?.sequence, observation, rows);
      if (choice) return { command: click(choice.chosen.point), box: choice.chosen.bbox, goal: choice.chosen.bbox,
        label: choice.inferred ? 'Reuse a correspondence supported by earlier selections' : 'Test which indicator advances after selecting the marked occurrence',
        objective: 'advance_visible_occurrence_sequence', evidence, check: { kind: 'occurrence', choice } };
    }
  }
  if (pointer && !prior) {
    const option = await uniquePatternOption(observation, rows);
    if (option) {
      const { choice, layout } = option, target = layout.active.boxes[layout.active.missing]!;
      return { command: click(center(choice.box)), box: choice.box, goal: target,
        label: 'Test the only option compatible with the visible sequence', objective: 'fill_missing_pattern_card', evidence,
        check: { kind: 'pattern', expected: { target, preserve: layout.grid.flat().filter(box => box !== target), expected: choice.raster } } };
    }
  }
  if (pointer && available.includes('ACTION5') && (!prior || prior.kind === 'marks')) {
    const parts = geometricComponents(rows), model = prior?.model ?? measureStagedMarks(parts, rows);
    if (model) {
      const memory = prior ?? { kind: 'marks' as const, model, resizeRef: null, rejected: [] };
      const scene = readStagedMarks(parts, model), choice = scene && chooseStagedMarkStep(scene, memory);
      if (scene && choice && available.includes(choice.input)) return {
        command: choice.click ? click(choice.click) : { action_ref: choice.input, data: {} },
        box: choice.target, goal: model.reference.box, label: choice.reason, objective: 'compose_visible_reference_marks',
        evidence, check: { kind: 'marks', memory, choice, scene },
      };
    }
  }
  if (available.includes('ACTION5') && directions.length >= 3 && (!prior || prior.kind === 'profile')) {
    const scene = measureProfileTransfer(observation, rows, false, prior?.anchor);
    if (scene?.bands.length === 2 && scene.bands.every(band => receiverFilled(band.receiver) ||
      scene.bands.filter(candidate => same(candidate.profile.values, band.receiver.values)).length === 1)) {
      const target = scene.bands.findIndex(band => !receiverFilled(band.receiver));
      const offer = target >= 0 && directProfileStep(scene, inputs, target);
      if (offer && offer.command) return { command: offer.command, box: scene.marker, goal: scene.bands[target]!.receiver.box,
        label: profileTransferStrategies[offer.phase], objective: 'place_measured_profile_in_compatible_receiver', evidence,
        check: { kind: 'profile', memory: { kind: 'profile', ...(scene.receiverAnchor ? { anchor: scene.receiverAnchor } : {}) }, scene, offer, target } };
    }
  }
  if (directions.length === 4 && available.includes('ACTION5') && (!prior || prior.kind === 'marker')) {
    const keys = inputs.filter(input => /^ACTION[1-5]$/.test(input.action_ref)).map(input => input.action_ref);
    const step = await projectMarkerStep(observation, rows, keys, prior?.snapshot ?? null);
    if (step) {
      const label = step.step.mode === 'move' ? 'Move the selected shape toward the compatible marks'
        : step.step.mode === 'cycle' ? 'Test which shape the selector makes active' : 'Measure how the active shape moves';
      return { command: step.step.action, box: step.actor, goal: step.goal, label,
        objective: 'place_selectable_shapes_on_visible_marks', evidence, check: { kind: 'marker', step } };
    }
  }
}

export async function assessFallbackProjection(projection: FallbackProjection, first: NativeRows, second: NativeRows,
  before: NativeObservation, after: NativeObservation): Promise<ProjectionReceipt> {
  const { check } = projection;
  const refs = [...projection.evidence.slice(-3), after.observation_ref];
  const state = (value: Value, retired = false): FallbackProjectionMemory => ({ value, refs, ...(retired ? { retired: true } : {}) });
  if (check.kind === 'marker') {
    const result = await observeMarkerStep(check.step, before, after, first, second);
    return { matched: result.matched, memory: state({ kind: 'marker', snapshot: result.snapshot }, result.retired) };
  }
  if (check.kind === 'occurrence') {
    const sequence = observeVisibleOccurrence(check.choice, after, second);
    return { matched: !!sequence, memory: state({ kind: 'occurrence', sequence: sequence ?? check.choice.local }, !sequence) };
  }
  if (check.kind === 'pattern') return { matched: fillsTarget(check.expected, first, second) };
  if (check.kind === 'reach') {
    const { memory, actor, to, reserve } = check;
    const actual = pointReachActor(geometricComponents(second), memory.layout);
    const arrived = !!actual && same(actual, to), spent = reserve - pointReachReserve(second, memory.layout);
    const distance = Math.hypot(actor[0] - to[0], actor[1] - to[1]);
    return { matched: arrived && (memory.cost === null || spent === memory.cost), memory: state({ ...memory,
      radius: arrived ? Math.max(memory.radius, distance) : memory.radius, cost: spent > 0 ? spent : memory.cost,
      blocked: arrived ? memory.blocked : rememberRouteRefusal(memory.blocked, actor, to.join(','), after.observation_ref) }) };
  }
  if (check.kind === 'trace') {
    const { memory, scene, to } = check;
    const next = measureTraceField(second, memory.geometry, traceOptions);
    const matched = !!next && next.geometry_ref === memory.geometryRef && next.prefix.length === scene.prefix.length + 1
      && scene.prefix.every((cell: NativePoint, i: number) => same(cell, next.prefix[i]!)) && same(to, next.prefix.at(-1)!)
      && localTraceEffect(scene, scene.head.cell as NativePoint, to, first, second);
    return { matched, memory: state(memory, !matched) };
  }
  if (check.kind === 'marks') {
    const { memory, choice, scene } = check;
    const matched = !!checkStagedMarkStep({ local: memory, scene, choice }, second);
    return { matched, memory: state({ ...memory,
      resizeRef: matched && choice.input === 'ACTION2' ? after.observation_ref : memory.resizeRef,
      rejected: matched ? memory.rejected : [...memory.rejected, scene.preview.join(',')],
    }, !matched) };
  }
  if (check.kind === 'channel') {
    const { memory, tile } = check;
    const matched = matchesChannelOpening(second, memory.plan.layout, tile);
    return { matched, memory: state({ ...memory, spent: memory.spent + 1 }, !matched) };
  }
  const { memory, scene, offer, target } = check;
  const next = measureProfileTransfer(after, second, false, scene.receiverAnchor);
  const matched = !!next && matchesDirectProfileStep(scene, offer.phase, target, next);
  return { matched, memory: state(memory, !matched) };
}
