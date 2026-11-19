import { observeRevalidatedPair, projectRevalidatedPair } from './coupled-motion.ts';
import { checkRecalledOutlet, projectRecalledOutlet, type acquireMarkedOutlet } from './marked-compartment-flow.ts';
import { observeRecalledInstruction, projectRecalledInstruction, type SymbolAcquisition } from './symbol-contribution.ts';
import { observeRecalledPrefixes, projectRecalledPrefixes, type SymbolPrefixAcquisition } from './parallel-symbol-prefixes.ts';
import { chooseObservedProgram, verifyObservedProgram, type ProgramChoice, type ProgramWitness } from './observed-program-continuation.ts';
import { checkRecalledCatalogue, projectRecalledCatalogue, type CatalogueAcquisition } from './visible-configuration-coverage.ts';
import { observeRecalledRelation, projectRecalledRelation, type RelationsAcquisition } from './observed-shared-relations.ts';
import { observeRecalledNavigation, projectRecalledNavigation, type NavigationAcquisition } from './navigate-revealed-grid.ts';
import { observeRecalledRelay, projectRecalledRelay, type RelayAcquisition } from './observed-relay-route.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import { localTraceEffect } from '../logos-engine/v6-trace-field-access.ts';
import { constructTraceField } from '../logos-engine/v6-trace-field-mechanics.ts';
import { measureTraceField, traceFieldCenter } from '../logos-engine/v6-trace-field-observation.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeObservation, NativePoint, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { assessCompartmentInteraction, measureCompartments, selectCompartmentInteraction, type CompartmentAcquisition } from './compartment-growth.ts';
import { observeRecalledCapture, projectRecalledCapture, type CaptureRecollection } from './observed-capture-transfer.ts';
import { observeRecalledSwitch, projectRecalledSwitch, type DisplayAcquisition } from './display-coupling.ts';
import { observeMarkerStep, projectMarkerStep } from './marker-coverage.ts';
import { chooseVisibleOccurrence, observeVisibleOccurrence, retainOccurrenceChoice, type OccurrenceTransfer } from './occurrence-recall.ts';
import { matchesChannelOpening, nextChannelTile, planDistinctChannels, selectSeparatedLayout } from './paired-channels.ts';
import { measurePointReach, pointReachActor, pointReachReserve, pointReachStep } from './point-reach.ts';
import { directProfileStep, matchesDirectProfileStep, measureProfileTransfer, prepareProfile, profileTransferStrategies, receiverFilled, workshopState, type ProfileTransferEvidence } from './profile-transfer.ts';
import { rememberRouteRefusal, type RouteRefusals } from './route-refusals.ts';
import { checkStagedMarkStep, chooseStagedMarkStep, measureMarkEffects, measureStagedMarks, readStagedMarks, retainSpanMeasurements } from './staged-marks.ts';
import { assessSpanStep, beamBox, measureSpan, nextSpanStep, planSpan, readSpanPose, type SpanLayout, type SpanMemory } from './supported-span.ts';
import { fillsTarget, uniquePatternOption } from './visual-pattern.ts';

type TraceScene = NonNullable<ReturnType<typeof measureTraceField>>;
type PointModel = NonNullable<ReturnType<typeof measurePointReach>>;
type SpanPlanning = { layout: SpanLayout; plan: NonNullable<ReturnType<typeof planSpan>>; placed: number; refused: boolean };
type ProfileOffer = NonNullable<ReturnType<typeof directProfileStep>> | NonNullable<ReturnType<typeof prepareProfile>>;
type MarkEffects = ReturnType<typeof measureMarkEffects>;
type MarksModel = NonNullable<ReturnType<typeof measureStagedMarks>>;
type ChannelPlan = NonNullable<ReturnType<typeof planDistinctChannels>>;
type ProfileScene = NonNullable<ReturnType<typeof measureProfileTransfer>>;
type OccurrenceChoice = NonNullable<ReturnType<typeof chooseVisibleOccurrence>>;
type MarkerStep = NonNullable<Awaited<ReturnType<typeof projectMarkerStep>>>;

type RelationProjection = NonNullable<ReturnType<typeof projectRecalledRelation>>;
type RelayProjection = NonNullable<ReturnType<typeof projectRecalledRelay>>;
type NavigationProjection = NonNullable<ReturnType<typeof projectRecalledNavigation>>;
type DisplayProjection = NonNullable<ReturnType<typeof projectRecalledSwitch>>;
type CaptureProjection = NonNullable<Awaited<ReturnType<typeof projectRecalledCapture>>>;
type CompartmentCheck = Parameters<typeof assessCompartmentInteraction>[0];
type OutletWitness = NonNullable<Awaited<ReturnType<typeof acquireMarkedOutlet>>>;
type OutletProjection = NonNullable<Awaited<ReturnType<typeof projectRecalledOutlet>>>;
type InstructionProjection = NonNullable<ReturnType<typeof projectRecalledInstruction>>;
type PairProjection = NonNullable<ReturnType<typeof projectRevalidatedPair>>;
type Value =
  | { kind: 'pair'; local: PairProjection['local'] }
  | { kind: 'outlet'; attempted: string[] }
  | { kind: 'instruction'; transaction: InstructionProjection['transaction'] }
  | { kind: 'program' }
  | { kind: 'symbols'; local: ReturnType<typeof observeRecalledPrefixes>['local'] }
  | { kind: 'catalogue' }
  | { kind: 'relations'; local: ReturnType<typeof observeRecalledRelation>['local'] }
  | { kind: 'relay'; local: RelayProjection['state'] }
  | { kind: 'navigation'; local: NavigationProjection['local'] }
  | { kind: 'display'; local: DisplayProjection['local'] }
  | { kind: 'capture'; local: CaptureProjection['local'] }
  | { kind: 'compartment'; layout: CompartmentCheck['local']['layout'] }
  | { kind: 'pattern' }
  | { kind: 'span'; planning: SpanPlanning }
  | { kind: 'trace'; geometry: TraceScene['geometry']; geometryRef: string }
  | { kind: 'reach'; layout: PointModel; radius: number; cost: number | null; blocked: RouteRefusals }
  | { kind: 'marks'; model: MarksModel; resizeRef: string | null; rejected: string[]; effects?: MarkEffects }
  | { kind: 'channel'; plan: ChannelPlan; spent: number }
  | { kind: 'profile'; used?: string[]; preparing?: true; anchor?: ProfileScene['receiverAnchor'] }
  | { kind: 'occurrence'; sequence: OccurrenceChoice['local'] }
  | { kind: 'marker'; snapshot: NativeRecord };
type Model<K extends Value['kind']> = Extract<Value, { kind: K }>;
export type FallbackProjectionMemory = { value: Value; refs: string[]; retired?: true };
export type FallbackLevelTransfer = { epoch: number } & (
  | { kind: 'profile'; proof: ProfileTransferEvidence }
  | { kind: 'span'; proof: SpanMemory }
  | { kind: 'occurrence'; proof: OccurrenceTransfer }
  | { kind: 'trace'; pitch: number; cells: number; refs: string[] }
  | { kind: 'channel'; pitch: number; pairs: number; refs: string[] }
  | { kind: 'pattern'; width: number; height: number; refs: string[] }
);

type Check =
  | { kind: 'pair'; projection: PairProjection }
  | { kind: 'outlet'; projection: OutletProjection; attempted: string[] }
  | { kind: 'instruction'; projection: InstructionProjection }
  | { kind: 'program'; program: ProgramWitness; choice: ProgramChoice }
  | { kind: 'symbols'; projection: NonNullable<ReturnType<typeof projectRecalledPrefixes>> }
  | { kind: 'catalogue'; projection: NonNullable<ReturnType<typeof projectRecalledCatalogue>> }
  | { kind: 'relations'; projection: RelationProjection }
  | { kind: 'relay'; projection: RelayProjection; witness: NonNullable<RelayAcquisition['witness']> }
  | { kind: 'navigation'; projection: NavigationProjection }
  | { kind: 'display'; projection: DisplayProjection }
  | { kind: 'capture'; projection: CaptureProjection }
  | { kind: 'compartment'; plan: CompartmentCheck }
  | { kind: 'span'; planning: SpanPlanning; pose: NonNullable<ReturnType<typeof readSpanPose>>; step: NonNullable<ReturnType<typeof nextSpanStep>> }
  | { kind: 'pattern'; expected: Parameters<typeof fillsTarget>[0] }
  | { kind: 'trace'; memory: Model<'trace'>; scene: TraceScene; to: NativePoint }
  | { kind: 'reach'; memory: Model<'reach'>; actor: NativePoint; to: NativePoint; reserve: number }
  | { kind: 'marks'; memory: Model<'marks'>; scene: NonNullable<ReturnType<typeof readStagedMarks>>;
    choice: NonNullable<ReturnType<typeof chooseStagedMarkStep>> }
  | { kind: 'channel'; memory: Model<'channel'>; tile: NonNullable<ReturnType<typeof nextChannelTile>> }
  | { kind: 'profile'; memory: Model<'profile'>; scene: ProfileScene; offer: ProfileOffer; target: number }
  | { kind: 'occurrence'; choice: OccurrenceChoice }
  | { kind: 'marker'; step: MarkerStep };

export type FallbackProjection = { command: NativeCommand; box: NativeBox; goal: NativeBox; label: string;
  objective: string; evidence: string[]; recurring?: string; novelty?: string; check: Check };
type ProjectionReceipt = { matched: boolean | null; memory?: FallbackProjectionMemory };

const traceOptions = { distinguishCellSupport: true };
const click = ([x, y]: NativePoint): NativeCommand => ({ action_ref: 'ACTION6', data: { x, y } });
const pointBox = ([x, y]: NativePoint): NativeBox => [x, y, x, y];
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const rasterSize = (raster: readonly (readonly number[])[]) => ({ width: raster[0]?.length ?? 0, height: raster.length });
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);

type TransferContext = {
  fallbackTransfer?: FallbackLevelTransfer;
  compartmentTransfer?: CompartmentAcquisition;
  captureTransfer?: CaptureRecollection;
  displayTransfer?: DisplayAcquisition;
  relayTransfer?: RelayAcquisition;
  navigationTransfer?: NavigationAcquisition;
  relationsTransfer?: RelationsAcquisition;
  catalogueTransfer?: CatalogueAcquisition;
  symbolTransfer?: SymbolPrefixAcquisition;
  programWitness?: ProgramWitness;
  outletWitness?: OutletWitness;
  instructionTransfer?: SymbolAcquisition;
  jointTransfer?: { epoch: number; measured: Parameters<typeof projectRevalidatedPair>[3] };
};

export async function chooseFallbackProjection(previous: FallbackProjectionMemory | undefined, observation: NativeObservation,
  rows: NativeRows, inputs: readonly NativeCommand[], remaining: number, execution: NativeExecution | undefined,
  context: TransferContext, panel = false): Promise<FallbackProjection | undefined> {
  if (previous?.retired || execution?.signal?.aborted) return;
  const { fallbackTransfer, compartmentTransfer: compartment, captureTransfer: capture, displayTransfer: display,
    relayTransfer: relay, navigationTransfer: navigation, relationsTransfer: relations, catalogueTransfer: catalogue,
    symbolTransfer: symbols, programWitness: program, outletWitness: outlet, instructionTransfer: instruction, jointTransfer } = context;
  const transfer = fallbackTransfer?.epoch === observation.level_epoch - 1 ? fallbackTransfer : undefined;
  const pair = jointTransfer?.epoch === observation.level_epoch - 1 ? jointTransfer.measured : undefined;
  const available = observation.available_action_refs, evidence = previous?.refs ?? [], prior = previous?.value;
  const pointer = available.includes('ACTION6');
  const directions = available.filter(action => /^ACTION[1-4]$/.test(action));
  if (relay?.witness && pointer && (!prior || prior.kind === 'relay')) {
    const projection = projectRecalledRelay(prior?.local ?? null, observation, rows, relay.witness);
    if (projection) {
      const { decision, state, view } = projection;
      const control = decision.slot === null ? null : state.scene.controls[decision.slot];
      return { command: decision.command, box: control ? pointBox(control.point) : pointBox(view.goal.point),
        goal: pointBox(view.goal.point), label: decision.strategy === 'launch_configured_relay_route' ? 'Launch and check the newly configured route'
          : decision.strategy === 'identify_relay_control' ? 'Select the controller and recheck the relay it moves'
          : 'Set the measured relay direction for the current path',
        objective: 'configure_observed_relay_path', evidence: [...new Set([...relay.witness.evidence, ...evidence])],
        recurring: 'Reuse verified relay direction changes and the launch effect',
        ...(!prior ? { novelty: 'Recompute the relay path from the current sender, relays and receiver' } : {}),
        check: { kind: 'relay', projection, witness: relay.witness } };
    }
  }
  if (program?.epoch === observation.level_epoch && pointer && (!prior || prior.kind === 'program')) {
    const now = execution?.now ?? (() => performance.now());
    const choice = chooseObservedProgram(program, rows, available, remaining, Math.min(execution?.deadlineMs ?? Infinity, now() + 120));
    if (choice) {
      const box = choice.region ?? choice.actor ?? choice.display.member_box;
      const label = choice.kind === 'bind_program_bearer' ? 'Add an earlier operator to identify its current bearer'
        : choice.kind === 'run_verified_program' ? 'Run the assembled program and compare the return'
          : 'Add the next operator projected from the current arrangement';
      return { command: choice.action, box, goal: choice.display.member_box, label, objective: 'compose_supported_program_for_current_layout',
        evidence: [...new Set([...program.evidence, ...evidence])], recurring: 'Reuse the observed operator effects',
        ...(!prior ? { novelty: 'Identify the operator bearer and the new arrangement of pieces' } : {}), check: { kind: 'program', program, choice } };
    }
  }
  if (pointer && outlet && (!prior || prior.kind === 'outlet')) {
    const attempted = prior?.attempted ?? [], projection = await projectRecalledOutlet(outlet, observation, rows, attempted);
    if (projection) return { command: click(projection.choice.point), box: projection.choice.box, goal: projection.outlet,
      label: 'Use the current marked compartment to advance the materials toward the proved outlet',
      objective: 'move_material_through_marked_compartments', evidence: [...new Set([...projection.evidence, ...evidence])],
      recurring: 'Reuse the previously scoring outlet after matching the current chambers',
      ...(projection.novelty ? { novelty: 'Several marked compartments are available in the new layout' } : {}),
      check: { kind: 'outlet', projection, attempted } };
  }
  if (pointer && instruction?.learned && (!prior || prior.kind === 'instruction')) {
    const projection = projectRecalledInstruction(instruction, observation, rows, prior?.transaction);
    if (projection) return { command: click(projection.step.point), box: projection.step.target, goal: projection.step.target,
      label: projection.step.intermediate ? 'Test the transformation that supplies a missing intermediate symbol'
        : 'Use a measured symbol operation toward the current request',
      objective: 'supply_current_symbol_requests', evidence: [...new Set([...projection.learned.proof, ...evidence])],
      recurring: 'Reuse confirmed selection and operand effects',
      ...(projection.step.intermediate ? { novelty: 'The requested result needs an intermediate operand' } : {}),
      check: { kind: 'instruction', projection } };
  }
  if (pointer && catalogue?.witness && (!prior || prior.kind === 'catalogue')) {
    const projection = projectRecalledCatalogue(catalogue, observation, rows, remaining);
    if (projection) return { command: click(projection.point), box: projection.box, goal: projection.choice.target.box,
      objective: 'visit_all_displayed_combinations', label: projection.novelty ? 'Test the next value of a new factor'
        : 'Change one factor to reach an unvisited displayed configuration',
      evidence: projection.evidence, recurring: 'Use the confirmed effect of cycling one factor',
      ...(projection.novelty ? { novelty: 'This factor has a new set of visible values' } : {}),
      check: { kind: 'catalogue', projection } };
  }
  if (pointer && relations?.witness && (!prior || prior.kind === 'relations')) {
    const projection = projectRecalledRelation(relations, prior?.local, observation, rows, remaining);
    if (projection) return { command: click(projection.control.point), box: projection.control.switchBox, goal: projection.target,
      objective: 'settle_pieces_by_changing_shared_relations', label: 'Adjust the shared relation and check which pieces move',
      evidence: projection.evidence, recurring: 'Reuse measured coupled motion between rooms',
      ...(projection.novelty ? { novelty: 'Recompute the shared relations for a different number of rooms' } : {}),
      check: { kind: 'relations', projection } };
  }
  if (panel) return;
  if (pair && (!prior || prior.kind === 'pair')) {
    const projection = projectRevalidatedPair(observation, rows, remaining, pair, prior?.local);
    if (projection) return { command: { action_ref: projection.input, data: {} }, box: projection.box, goal: projection.goal,
      label: projection.route ? 'Bring the two pieces together along the route supported by current returns'
        : 'Recheck how both pieces respond in the new layout',
      objective: 'bring_together_measured_coupled_pieces', evidence: projection.local.evidence,
      recurring: 'Locate the two previously measured coupled pieces', check: { kind: 'pair', projection } };
  }
  if (symbols?.retained && (!prior || prior.kind === 'symbols')) {
    const projection = projectRecalledPrefixes(symbols, observation, rows, inputs, remaining, prior?.local);
    if (projection) return { command: projection.command, box: projection.box, goal: projection.local.panels.at(-1)!,
      label: projection.affected.length > 1 ? 'Extend the matching prefixes with their shared symbol' : 'Extend the next matching prefix',
      objective: 'complete_current_parallel_symbol_prefixes', evidence: projection.evidence,
      recurring: 'Reuse the proved correspondence between a command and a symbol',
      ...(projection.novelty ? { novelty: 'The current symbol groups now advance in parallel' } : {}),
      check: { kind: 'symbols', projection } };
  }
  if (navigation && !pointer && (!prior || prior.kind === 'navigation')) {
    const projected = projectRecalledNavigation(navigation, prior?.local, observation, rows);
    if (projected) return { command: projected.choice.action, box: projected.box, goal: projected.goal,
      label: projected.choice.kind === 'pulse' ? 'Reveal the new cells before moving' : projected.choice.kind === 'wait'
        ? 'Observe the next movement of the obstacles' : 'Follow the route through measured cells toward the current goal',
      objective: 'reveal_routes_and_avoid_moving_obstacles', evidence: projected.local.refs,
      recurring: 'Use observed movement directions and the effect of the revealing pulse',
      ...(projected.novelty ? { novelty: 'The new board changes the lattice or obstacle configuration' } : {}),
      check: { kind: 'navigation', projection: projected } };
  }
  if (pointer && (!prior || prior.kind === 'trace')) {
    const scene = measureTraceField(rows, prior?.geometry ?? null, traceOptions);
    if (scene && (!prior || scene.geometry_ref === prior.geometryRef)) {
      const now = execution?.now ?? (() => performance.now());
      const route = constructTraceField(scene, observation, remaining, Math.min(now() + 40, execution?.deadlineMs ?? Infinity), now);
      const to = route?.path[scene.prefix.length] as NativePoint | undefined;
      if (to) {
        const point = traceFieldCenter(scene.geometry, to);
        const recalled = transfer?.kind === 'trace' && transfer.pitch === scene.geometry.pitch ? transfer : null;
        const novelty = recalled && scene.geometry.cells?.length !== recalled.cells ? 'The current lattice has a different number of cells' : undefined;
        return { command: click(point), box: pointBox(point), goal: pointBox(traceFieldCenter(scene.geometry, route!.path.at(-1)! as NativePoint)),
          label: evidence.length ? 'Extend the verified trace toward complete coverage' : 'Test whether selecting the adjacent cell extends the trace',
          objective: 'cover_visible_cells_without_revisiting', evidence: recalled && !evidence.length ? recalled.refs : evidence,
          ...(recalled && !evidence.length ? { recurring: 'Extend a trace by selecting an adjacent cell' } : {}),
          ...(novelty ? { novelty } : {}), check: { kind: 'trace', scene, to,
            memory: { kind: 'trace', geometry: scene.geometry, geometryRef: scene.geometry_ref } } };
      }
    }
  }
  if (pointer && !directions.length && !available.includes('ACTION5')) {
    if ((!prior || prior.kind === 'display') && display?.scored) {
      const projection = projectRecalledSwitch(prior?.local, observation, rows, display);
      if (projection) {
        const box = projection.local.controls[projection.index]!;
        return { command: click(center(box)), box, goal: projection.local.receivers[0]!, objective: 'revalidate_coupled_indicator_spacing',
          label: 'Check whether the previously successful switch spacing still aligns the indicators',
          evidence: [...new Set([...projection.evidence, ...evidence])], recurring: 'Recheck the observed coupling between controls and indicators',
          ...(projection.novelty ? { novelty: 'The current row has a different number of switches' } : {}),
          check: { kind: 'display', projection } };
      }
    }
    if ((!prior || prior.kind === 'compartment') && compartment?.model?.completed === observation.levels_completed) {
      const { model } = compartment, layout = prior?.layout ?? measureCompartments(rows);
      const choice = layout && selectCompartmentInteraction(layout, rows, model);
      if (layout && choice) {
        const label = choice.phase === 'feed' ? 'Open the gate between the feeding group and its resources'
          : choice.phase === 'grow' ? 'Advance growth while keeping the larger reference isolated'
            : 'Open the gate to the reference once both sprites have compatible sizes';
        return { command: click(choice.gate.point), box: pointBox(choice.gate.point), goal: choice.threshold.box,
          objective: 'grow_before_connecting_to_larger_sprite', label, evidence: [...new Set([...model.evidence, ...evidence])],
          recurring: 'Use the measured effects of feeding, growth and opening gates',
          ...(!prior && compartment.calibration?.layout.rooms.length !== layout.rooms.length
            ? { novelty: 'The current gate network has a different number of compartments' } : {}),
          check: { kind: 'compartment', plan: { local: { epoch: observation.level_epoch, layout, evidence },
            choice, food: model.food, grower: model.grower } } };
      }
    }
    if ((!prior || prior.kind === 'capture') && capture?.proved) {
      const selected = await projectRecalledCapture(capture.proved, prior?.local, observation, rows, remaining);
      if (selected) return { command: click(selected.point), box: pointBox(selected.point), goal: pointBox(selected.target),
        objective: 'reduce_population_using_confirmed_capture', label: selected.selection ? 'Select a piece and verify its available landings'
          : 'Test the offered landing while preserving a route for the remaining captures',
        recurring: 'Use a previously measured jump effect', evidence: selected.evidence,
        ...(selected.novelty ? { novelty: selected.novelty } : {}), check: { kind: 'capture', projection: selected } };
    }
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
      const plan = prior?.plan ?? (transfer?.kind === 'channel'
        ? await selectSeparatedLayout(rows, [], remaining, execution) : planDistinctChannels(rows, remaining));
      if (plan && (prior?.spent ?? 0) < plan.layout.reserve) {
        const tile = nextChannelTile(rows, plan);
        const recalled = transfer?.kind === 'channel' && transfer.pitch === plan.layout.pitch ? transfer : null;
        if (tile) return { command: click(center(tile.tile.box)), box: tile.tile.box, goal: tile.pair.to.box,
          label: evidence.length ? 'Open the next cell on the route to the matching endpoint' : 'Test whether selecting a closed cell opens a channel',
          objective: 'connect_visible_endpoint_pairs', evidence: recalled && !evidence.length ? recalled.refs : evidence,
          ...(recalled && !evidence.length ? { recurring: 'Open a channel cell and verify its connection' } : {}),
          ...(recalled && plan.layout.pairs.some(pair => pair.other || pair.branches?.length)
            ? { novelty: 'The channel plan must preserve the new branch or the proposed source mixture' }
            : recalled && plan.layout.pairs.length !== recalled.pairs
              ? { novelty: 'The current board has a different number of endpoint pairs' } : {}), check: { kind: 'channel', memory: prior ?? { kind: 'channel', plan, spent: 0 }, tile } };
      }
    }
    if (!prior || prior.kind === 'occurrence') {
      const choice = chooseVisibleOccurrence(prior?.sequence, observation, rows, transfer?.kind === 'occurrence' ? transfer.proof : undefined);
      if (choice) return { command: click(choice.chosen.point), box: choice.chosen.bbox, goal: choice.chosen.bbox,
        label: choice.transferredStart ? 'Recheck the single visible occurrence using the previous successful start'
          : choice.inferred ? 'Reuse a correspondence supported by earlier selections' : 'Test which indicator advances after selecting the marked occurrence',
        objective: 'advance_visible_occurrence_sequence', evidence: [...new Set([...choice.evidence, ...evidence])],
        ...(choice.evidence.some(ref => /:epoch:\d+:revision:/.test(ref) && !ref.includes(':epoch:' + observation.level_epoch + ':'))
          ? { recurring: 'Match an occurrence using the proved sequence rules' } : {}), check: { kind: 'occurrence', choice } };
    }
  }
  if (pointer && (!prior || prior.kind === 'pattern')) {
    const option = await uniquePatternOption(observation, rows);
    if (option) {
      const { choice, layout } = option, target = layout.active.boxes[layout.active.missing]!;
      const { width, height } = rasterSize(choice.raster);
      const recalled = transfer?.kind === 'pattern' && transfer.width === width && transfer.height === height ? transfer : null;
      return { command: click(center(choice.box)), box: choice.box, goal: target,
        label: 'Test the only option compatible with the visible sequence', objective: 'fill_missing_pattern_card', evidence: recalled ? [...new Set([...recalled.refs, ...evidence])] : evidence,
        ...(recalled ? { recurring: 'Select a card after comparing independent visible pattern constraints' } : {}),
        check: { kind: 'pattern', expected: { target, preserve: layout.grid.flat().filter(box => box !== target), expected: choice.raster } } };
    }
  }
  if (transfer?.kind === 'span' && (!prior || prior.kind === 'span')) {
    const parts = geometricComponents(rows), { proof } = transfer;
    const known = prior?.planning;
    const pose = readSpanPose(parts, proof.pitch, proof.beamHeight, proof.validPaint,
      known ? { rows, slots: known.layout.slots } : undefined);
    const layout = pose && (known?.layout ?? measureSpan(rows, parts, proof, pose));
    const plan = layout && pose && (known?.plan ?? planSpan(layout, pose) ?? (proof.confirmedSpan ? planSpan(layout, pose, true) : null));
    if (pose && layout && plan) {
      const planning = known ?? { layout, plan, placed: 0, refused: false };
      const target = plan[planning.placed];
      const step = target && nextSpanStep(layout, pose, target, planning.refused);
      if (step && available.includes(step.action)) return {
        command: step.point ? click(step.point) : { action_ref: step.action, data: {} },
        box: beamBox(step.beam, layout.pitch), goal: beamBox(layout.goal, layout.pitch),
        label: step.kind === 'resize' ? 'Adjust the span width to its new support interval' : step.kind === 'align'
          ? 'Align the preview with the new support' : 'Place the measured span and verify the remaining stock',
        objective: 'connect_foundations_with_supported_spans', evidence: [...new Set([...proof.refs, ...evidence])],
        recurring: 'Reuse measured alignment, resize and placement effects',
        ...(planning.placed === 0 ? { novelty: 'The visible reference now needs a span supported by separate foundations' } : {}),
        check: { kind: 'span', planning, pose, step },
      };
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
    const recalled = transfer?.kind === 'profile' ? transfer.proof : null;
    const scene = measureProfileTransfer(observation, rows, !!recalled, prior?.anchor);
    if (scene?.bands.length === 2) {
      const direct = scene.bands.every(band => receiverFilled(band.receiver) ||
        scene.bands.filter(candidate => same(candidate.profile.values, band.receiver.values)).length === 1);
      const open = scene.bands.findIndex(band => !receiverFilled(band.receiver));
      const prepared = recalled && (!direct || prior?.preparing) ? prepareProfile(scene, inputs, recalled, remaining, rows.length, null) : null;
      const target = prepared?.target ?? open;
      const offer = prepared ?? (direct && target >= 0 ? directProfileStep(scene, inputs, target) : null);
      if (offer?.command) {
        const reused = recalled?.used.includes(offer.command.action_ref);
        const memory = { kind: 'profile' as const, ...(scene.receiverAnchor ? { anchor: scene.receiverAnchor } : {}),
          ...(prior?.used ? { used: prior.used } : {}), ...(prepared ? { preparing: true as const } : {}) };
        return { command: offer.command, box: prepared?.tool ?? scene.marker, goal: scene.bands[target]!.receiver.box,
          label: profileTransferStrategies[offer.phase], objective: 'place_measured_profile_in_compatible_receiver',
          evidence: reused ? [...new Set([...recalled!.evidence, ...evidence])] : evidence,
          ...(reused ? { recurring: 'Reuse a confirmed action for selecting, carrying or fitting a profile' } : {}),
          ...(prepared?.tool ? { novelty: 'A framed tool may change the profile that does not fit its receiver' } : {}),
          check: { kind: 'profile', memory, scene, offer, target } };
      }
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
  if (check.kind === 'pair') {
    const result = observeRevalidatedPair(check.projection, first, second, after);
    return { matched: result.matched, memory: state({ kind: 'pair', local: result.state }, result.state.stopped) };
  }
  if (check.kind === 'outlet') {
    const matched = checkRecalledOutlet(check.projection, first, second);
    return { matched, memory: state({ kind: 'outlet', attempted: [...check.attempted, check.projection.attempt] }) };
  }
  if (check.kind === 'instruction') {
    const result = observeRecalledInstruction(check.projection, first, second);
    return { matched: result.matched, memory: state({ kind: 'instruction', transaction: result.transaction }, !result.matched) };
  }
  if (check.kind === 'program') {
    const matched = verifyObservedProgram(check.choice, check.program, second);
    return { matched, memory: state({ kind: 'program' }, !matched) };
  }
  if (check.kind === 'symbols') {
    const result = observeRecalledPrefixes(check.projection, second, after.observation_ref);
    return { matched: result.matched, memory: state({ kind: 'symbols', local: result.local }, result.local.stopped) };
  }
  if (check.kind === 'catalogue') {
    const matched = checkRecalledCatalogue(check.projection, after, second);
    return { matched, memory: state({ kind: 'catalogue' }, !matched) };
  }
  if (check.kind === 'relations') {
    const result = observeRecalledRelation(check.projection, after, second);
    return { matched: result.matched, memory: state({ kind: 'relations', local: result.local }, !result.matched) };
  }
  if (check.kind === 'relay') {
    const { projection, witness } = check;
    const result = observeRecalledRelay({ local: projection.state, decision: projection.decision }, witness, first, second, after.observation_ref);
    return { matched: result.matched, memory: state({ kind: 'relay', local: result.local }, result.local.stopped) };
  }
  if (check.kind === 'navigation') {
    const result = observeRecalledNavigation(check.projection, second, after.observation_ref);
    return { matched: result.matched, memory: state({ kind: 'navigation', local: result.local }, result.stopped) };
  }
  if (check.kind === 'display') {
    const result = observeRecalledSwitch(check.projection, second);
    return { matched: result.matched, memory: state({ kind: 'display', local: result.local }) };
  }
  if (check.kind === 'compartment') {
    const matched = !!assessCompartmentInteraction(check.plan, first, second);
    return { matched, memory: state({ kind: 'compartment', layout: check.plan.local.layout }, !matched) };
  }
  if (check.kind === 'capture') {
    const result = await observeRecalledCapture(check.projection, second, after);
    return { matched: result.matched, memory: state({ kind: 'capture', local: result.memory }, result.memory.stopped) };
  }
  if (check.kind === 'marker') {
    const result = await observeMarkerStep(check.step, before, after, first, second);
    return { matched: result.matched, memory: state({ kind: 'marker', snapshot: result.snapshot }, result.retired) };
  }
  if (check.kind === 'occurrence') {
    const sequence = observeVisibleOccurrence(check.choice, after, second);
    return { matched: !!sequence, memory: state({ kind: 'occurrence', sequence: sequence ?? check.choice.local }, !sequence) };
  }
  if (check.kind === 'pattern') {
    const matched = fillsTarget(check.expected, first, second);
    return { matched, memory: state({ kind: 'pattern' }, !matched) };
  }
  if (check.kind === 'span') {
    const { planning, pose, step } = check;
    const matched = !!assessSpanStep(planning.layout, step, pose, first, second);
    return { matched, memory: state({ kind: 'span', planning: { ...planning,
      placed: planning.placed + Number(step.kind === 'place' && matched), refused: !!step.point && !matched,
    } }, !matched && !step.point) };
  }
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
    const binding = { local: memory, scene, choice };
    const confirmed = checkStagedMarkStep(binding, second), matched = !!confirmed;
    return { matched, memory: state({ ...memory,
      effects: { ...memory.effects, ...measureMarkEffects(binding, first, second, after.observation_ref, confirmed) },
      resizeRef: matched && choice.input === 'ACTION2' ? after.observation_ref : memory.resizeRef,
      rejected: matched ? memory.rejected : [...memory.rejected, scene.preview.join(',')],
    }, !matched) };
  }
  if (check.kind === 'channel') {
    const { memory, tile } = check;
    const matched = matchesChannelOpening(first, second, memory.plan.layout, tile);
    return { matched, memory: state({ ...memory, spent: memory.spent + 1 }, !matched) };
  }
  const { memory, scene, offer, target } = check;
  const next = measureProfileTransfer(after, second, false, scene.receiverAnchor);
  const matched = !!next && ('projected' in offer
    ? JSON.stringify(workshopState(next)) === JSON.stringify(offer.projected)
    : matchesDirectProfileStep(scene, offer.phase, target, next));
  return { matched, memory: state(matched ? { ...memory, used: [...new Set([...(memory.used ?? []), projection.command.action_ref])] } : memory, !matched) };
}

export function retainFallbackLevelKnowledge(projection: FallbackProjection, before: NativeObservation, after: NativeObservation,
  prior?: FallbackLevelTransfer): FallbackLevelTransfer | undefined {
  const { check } = projection, epoch = before.level_epoch;
  const refs = [...new Set([...projection.evidence.slice(-4), before.observation_ref, after.observation_ref])];
  switch (check.kind) {
    case 'trace': return { kind: 'trace', epoch, pitch: check.scene.geometry.pitch, cells: check.scene.geometry.cells?.length ?? 0, refs };
    case 'pattern': return { kind: 'pattern', epoch, ...rasterSize(check.expected.expected), refs };
    case 'channel': return { kind: 'channel', epoch, pitch: check.memory.plan.layout.pitch, pairs: check.memory.plan.layout.pairs.length, refs };
    case 'marks': {
      const proof = retainSpanMeasurements({ model: check.memory.model, ...check.memory.effects }, before.observation_ref, after);
      return proof ? { kind: 'span', epoch, proof } : undefined;
    }
    case 'span': return prior?.kind === 'span'
      ? { kind: 'span', epoch, proof: { ...prior.proof, completed: after.levels_completed, confirmedSpan: true, refs } } : undefined;
    case 'occurrence': {
      const proof = retainOccurrenceChoice(check.choice.local, check.choice.scene, after);
      return proof ? { kind: 'occurrence', epoch, proof } : undefined;
    }
    case 'profile': return { kind: 'profile', epoch, proof: { completed: after.levels_completed, evidence: refs,
      used: [...new Set([...(check.memory.used ?? []), projection.command.action_ref])] } };
  }
}
