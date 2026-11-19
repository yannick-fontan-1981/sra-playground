import { boundedReductionRouteCooperative, mergeReductionScene, packReductionState, reductionLayout, reductionMoved, reductionScan,
  reductionState, reductionSuccessors, reductionVisibleCells, REDUCTION_VECTORS,
  type ReductionModel, type ReductionOperation, type ReductionPoint, type ReductionScene,
} from '../logos-engine/v6-reduction-transport.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { acquireCarrierView, carrierView, unpackCarrierView, type CarrierView } from './carrier-camera.ts';
import { maximumCommittedActions } from './plan-step.ts';

export const observedCarrierReductionId = 'sic_transport_and_reduce_visible_population';
export const observedCarrierStrategies = {
  identify_carrier_motion: 'Test which way an available command moves the carrier on its rail',
  move_carrier_into_range: 'Move the carrier toward the planned landing or transfer',
  position_carried_intermediate: 'Move the carrier and verify the intermediate it carries',
  select_piece_for_reduction: 'Select the piece that can jump over its neighbor',
  verify_reduction_landing: 'Jump to the measured landing and verify that one piece is removed',
  verify_preserved_intermediate: 'Use the intermediate for access and verify that it stays in place',
  verify_dock_transfer: 'Test a transfer between the carrier and the fixed landing across the gap',
} as const;

type Packed = ReturnType<typeof packReductionState>;
type Motion = { vector: ReductionPoint; ref: string };
type Calibration = { epoch: number; model: ReductionModel | null; refs: string[] };
type Witness = { epoch: number; unit: number; pitch: number; token: number; refs: string[] };
type RecalledControls = { epoch: number; controls: Record<string, Motion> };
type Supports = { floor: string[]; rails: string[]; edges: string[] };
type Segment = { purpose: 'solve' | 'reduce' | 'reveal'; path: ReductionOperation[] };
type State = { epoch: number; model: ReductionModel; controls: Record<string, Motion>; tested: string[];
  selected: ReductionPoint | null; selectedSupports: Supports | null; stopped: boolean; refs: string[]; view?: CarrierView;
  followVacated?: boolean; peerJumpEvidence?: string; peerJumpRefuted?: true;
  segment?: Segment; reveal?: { direction: ReductionPoint; testedLandings: string[] } };
type Choice = { stage: 'probe' | 'move' | 'select' | 'jump'; command: NativeCommand; effect: Packed | null;
  addressed: ReductionPoint | null; source: ReductionPoint | null; landing: ReductionPoint | null; intermediate?: ReductionPoint;
  carried?: boolean; dock?: boolean; peerTrial?: boolean; reframes?: true };
type Proposal = NativeProposal & { local: State; choice: Choice; current: Packed; needId: string; directionalSeries?: Choice[] };
const same = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);
const packed = (scene: ReductionScene) => packReductionState(reductionState(scene));
const scopeAttempt = (input: string, current: Packed) => JSON.stringify([input, current]);

const origin: ReductionPoint = [0, 0];
function remeasureAuxiliaryLayout(observation: NativeObservation, rows: NativeRows, previous: ReductionModel): ReductionModel | null {
  const { floor, token, ring, rail, unit, pitch } = previous;
  const squares = observation.entities.filter(entity => entity.palette_value === floor && entity.rectangular && entity.area === unit ** 2
    && entity.bbox[2] - entity.bbox[0] + 1 === unit && entity.bbox[3] - entity.bbox[1] + 1 === unit);
  const phases = new Map(squares.map(({ bbox: [x, y] }) => [`${x % pitch},${y % pitch}`, [x % pitch, y % pitch] as ReductionPoint]));
  if (squares.length < 4 || phases.size !== 1 || ring === null || rail === null) return null;
  const phase = [...phases.values()][0]!;
  const cells = observation.entities.filter(({ bbox: [x, y, r, b], area, palette_value }) =>
    ![floor, ring, rail].includes(palette_value) && r - x + 1 === unit && b - y + 1 === unit && area > unit ** 2 / 2 && area < unit ** 2
    && x % pitch === phase[0] && y % pitch === phase[1]);
  const tokens = cells.filter(cell => cell.palette_value === token);
  const others = cells.filter(cell => cell.palette_value !== token);
  // The earlier witness identifies the token; the matching auxiliary and scanned rail corroborate the layout.
  if (!tokens.length || !others.length || new Set(others.map(cell => cell.palette_value)).size !== 1
    || !others.every(cell => tokens.some(peg => same(peg.mask, cell.mask)))) return null;
  const model = { floor, token, ring, rail, unit, pitch, phase, width: rows[0]!.length, height: rows.length, auxiliary: others[0]!.palette_value };
  const scan = reductionScan(rows, model);
  if (scan.carriers.length && scan.edges.size) return model;
  if (others.length < 2) return null;
  const clipped = { ...model, trackCoveredRails: true, trackClippedCarrierRows: true };
  const recovered = reductionScan(rows, clipped);
  return recovered.carriers.length && recovered.edges.size ? clipped : null;
}

function boundaryLandings(model: ReductionModel, view: CarrierView, scene: ReductionScene, reveal: NonNullable<State['reveal']>) {
  const visible = reductionVisibleCells(model, view.offset), [dx, dy] = reveal.direction;
  const depth = (cell: string) => {
    const [x, y] = cell.split(',').map(Number);
    return x! * dx + y! * dy;
  };
  const edge = Math.max(...[...visible].map(depth));
  const attempted = new Set(reveal.testedLandings);
  return new Set([...scene.floor, ...scene.rails].filter(cell =>
    visible.has(cell) && depth(cell) >= edge - 1 && !attempted.has(cell)));
}

function carrierScopeForPair(scene: ReductionScene, direction: ReductionPoint) {
  const points = [...scene.pegs].map(cell => cell.split(',').map(Number) as ReductionPoint), [dx, dy] = direction;
  const depth = ([x, y]: ReductionPoint) => x * dx + y * dy;
  if (points.length !== 2 || depth(points[0]!) === depth(points[1]!)) return scene;
  const anchor = depth(points[0]!) > depth(points[1]!) ? points[0]! : points[1]!;
  const support = (cell: string) => (scene.floor.has(cell) || scene.rails.has(cell)) && !scene.plots?.has(cell);
  const nearby = new Set<string>();
  const shifted = ([x, y]: ReductionPoint, [u, v]: ReductionPoint, times: number): string => [x + u * times, y + v * times].join(',');
  for (const vector of REDUCTION_VECTORS) {
    for (const roles of [[0, 1, 2], [-1, 0, 1]]) {
      const triplet = roles.map(step => shifted(anchor, vector, step));
      if (triplet.every(support)) for (const cell of triplet) if (scene.rails.has(cell)) nearby.add(cell);
    }
  }
  if (!nearby.size) return scene;
  for (const carrier of scene.carriers) {
    const cell = carrier.join(',');
    if (scene.pegs.has(cell) || scene.auxiliaries?.has(cell)) nearby.add(cell);
  }
  for (const cell of nearby) {
    const [x, y] = cell.split(',').map(Number) as ReductionPoint;
    for (const [dx, dy] of REDUCTION_VECTORS) {
      const next = [x + dx, y + dy].join(',');
      if (scene.edges.has(cell + '>' + next)) nearby.add(next);
    }
  }
  const carriers = scene.carriers.filter(cell => nearby.has(cell.join(',')));
  if (!carriers.length || carriers.length === scene.carriers.length) return scene;
  const carriedPlots = scene.carriedPlots && new Set([...scene.carriedPlots].filter(cell => nearby.has(cell)));
  return { ...scene, carriers, ...(carriedPlots ? { carriedPlots } : {}) };
}

function verifiesReductionPath(scene: ReductionScene, visible: ReadonlySet<string>, path: readonly ReductionOperation[]) {
  let state = reductionState(scene);
  for (const step of path) {
    if (step[0] === 'move') {
      state = reductionMoved(state, step[1], scene.edges, scene.plots, scene.followVacated);
    } else {
      if (!visible.has(step[1].join(',')) || !visible.has(step[2].join(','))) return false;
      const jump = [...reductionSuccessors(state, scene)].find(([, option]) => same(option, step));
      if (!jump) return false;
      state = jump[0];
    }
  }
  return state[0].size === 1;
}

function readPlot(observation: NativeObservation, model: ReductionModel): ReductionModel['plot'] {
  const { unit, pitch, phase, floor, token, rail, ring } = model;
  const groups = new Map<string, { plot: NonNullable<ReductionModel['plot']>; count: number }>();
  for (const entity of observation.entities) {
    const [l, t, r, b] = entity.bbox, ink = entity.palette_value;
    if ([floor, token, rail, ring, model.auxiliary].includes(ink) || r - l + 1 !== unit || b - t + 1 !== unit || entity.rectangular
      || entity.area < unit ** 2 / 2) continue;
    const offsetBy = (value: number, axis: number) => value - phase[axis]! - Math.round((value - phase[axis]!) / pitch) * pitch;
    const offset: ReductionPoint = [offsetBy(l, 0), offsetBy(t, 1)];
    if (Math.abs(offset[0]) + Math.abs(offset[1]) !== 1) continue;
    const plot = { ink, offset, mask: entity.mask }, signature = JSON.stringify(plot);
    const group = groups.get(signature);
    groups.set(signature, { plot, count: (group?.count ?? 0) + 1 });
  }
  const plots = [...groups.values()].filter(group => group.count >= 2);
  return plots.length === 1 ? plots[0]!.plot : undefined;
}

function boxFor(model: ReductionModel, [column, row]: ReductionPoint, offset: ReductionPoint = origin): NativeBox {
  const x = model.phase[0] + (column - offset[0]) * model.pitch, y = model.phase[1] + (row - offset[1]) * model.pitch;
  return [x, y, x + model.unit - 1, y + model.unit - 1];
}

function jumpViewDirection(model: ReductionModel, offset: ReductionPoint, source: ReductionPoint, landing: ReductionPoint): ReductionPoint | null {
  for (const cell of [source, landing]) {
    const [left, top, right, bottom] = boxFor(model, cell, offset);
    if (left < 0) return [-1, 0];
    if (right >= model.width) return [1, 0];
    if (top < 0) return [0, -1];
    if (bottom >= model.height) return [0, 1];
  }
  return null;
}

function visibleSelection(model: ReductionModel, cell: ReductionPoint, first: NativeRows, second: NativeRows, offset = origin): boolean {
  const [left, top, right, bottom] = boxFor(model, cell, offset);
  for (let y = Math.max(0, top - 1); y <= Math.min(first.length - 1, bottom + 1); y++) {
    for (let x = Math.max(0, left - 1); x <= Math.min(first[y]!.length - 1, right + 1); x++) {
      if (first[y]![x] !== second[y]?.[x]) return true;
    }
  }
  return false;
}

function fitCarrierMotion(scene: ReductionScene, after: Packed): ReductionPoint | null {
  const current = reductionState(scene);
  if (same(packReductionState(current), after)) return null;
  const fits = REDUCTION_VECTORS.filter(vector => same(packReductionState(reductionMoved(current, vector, scene.edges, scene.plots)), after));
  return fits.length === 1 ? fits[0]! : null;
}

function plannerScene(rows: NativeRows, model: ReductionModel, selectedSupports: Supports | null): ReductionScene {
  const visible = reductionScan(rows, model);
  if (!selectedSupports) return visible;
  return mergeReductionScene({ ...visible, floor: new Set(selectedSupports.floor), rails: new Set(selectedSupports.rails),
    edges: new Set(selectedSupports.edges) }, visible, model, [0, 0]);
}

function isAddressed(model: ReductionModel, cell: ReductionPoint, command: NativeCommand): boolean {
  const [left, top, right, bottom] = boxFor(model, cell);
  const { x, y } = command.data;
  return typeof x === 'number' && typeof y === 'number' && x >= left && x <= right && y >= top && y <= bottom;
}

export function createSicObservedCarrierReduction(): NativeFamily<Proposal> {
  let calibration: Calibration | null = null, witness: Witness | null = null, state: State | null = null;
  let recalled: RecalledControls | null = null;
  return {
    id: observedCarrierReductionId,
    observePublicOutcome(before, after, command, first, second) {
      if (command.action_ref !== 'ACTION6') return;
      if (calibration?.epoch !== before.level_epoch) {
        calibration = { epoch: before.level_epoch, model: reductionLayout(before, first), refs: [] };
      }
      const { model, refs } = calibration;
      if (!model) return;
      const scene = reductionScan(first, model);
      const options = [...reductionSuccessors(reductionState(scene), scene)].filter(([, operation]) =>
        operation[0] === 'jump' && isAddressed(model, operation[2], command));
      if (!options.length) return;
      const observed = [before.observation_ref, after.observation_ref];
      if (after.levels_completed > before.levels_completed && refs.length && options.some(([result]) => result[0].size === 1)) {
        witness = { epoch: after.level_epoch, unit: model.unit, pitch: model.pitch, token: model.token, refs: [...refs, ...observed] };
      } else if (before.level_epoch === after.level_epoch) {
        const result = packed(reductionScan(second, model));
        if (options.some(([expected]) => same(packReductionState(expected), result))) {
          calibration.refs = [...refs.slice(-4), ...observed];
        }
      }
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const retained = witness;
      if (remaining < 1 || retained?.epoch !== observation.level_epoch || !observation.available_action_refs.includes('ACTION6')) return null;
      const previous = state?.epoch === observation.level_epoch ? state : null;
      if (previous?.stopped) return null;
      if (previous?.view && previous.refs.at(-1) !== observation.observation_ref) return null;
      const inherited = state?.epoch === observation.level_epoch - 1 ? state : null;
      const recognized = previous?.model ?? reductionLayout(observation, rows);
      const measured = recognized ?? (inherited ? remeasureAuxiliaryLayout(observation, rows, inherited.model) : null);
      if (!measured || measured.unit !== retained.unit || measured.pitch !== retained.pitch || measured.token !== retained.token || measured.rail === null) return null;
      const plot = !previous ? readPlot(observation, measured) : undefined;
      const model = plot ? { ...measured, plot } : measured;
      const visible = plannerScene(rows, model, previous?.selectedSupports ?? null);
      const reuse = recalled?.epoch === observation.level_epoch ? recalled.controls : null;
      const view = previous?.view ?? (reuse && (visible.carriers.length > 1 || visible.plots?.size || visible.auxiliaries?.size)
        ? carrierView(origin, mergeReductionScene(null, visible, model, origin)) : null);
      const offset = inherited?.view?.offset;
      const direction: ReductionPoint | null = offset && (offset[0] === 0) !== (offset[1] === 0)
        ? [Math.sign(offset[0]), Math.sign(offset[1])] : null;
      const revealDirection = direction && !recognized && view && visible.pegs.size === 1 && visible.auxiliaries?.size ? direction : null;
      const local: State = previous ?? { epoch: observation.level_epoch, model: revealDirection ? { ...model, trackCoveredRails: true } : model,
        controls: view && reuse ? reuse : {}, tested: [],
        ...(view ? { view } : {}), ...(revealDirection ? { reveal: { direction: revealDirection, testedLandings: [] } } : {}),
        ...(visible.auxiliaries?.size && inherited?.followVacated ? { followVacated: true } : {}),
        ...(visible.auxiliaries?.size && inherited?.peerJumpEvidence && inherited.model.auxiliary === model.auxiliary
          ? { peerJumpEvidence: inherited.peerJumpEvidence } : {}),
        selected: null, selectedSupports: null, stopped: false, refs: [] };
      const scanned = view ? unpackCarrierView(view) : visible;
      const peerJump = !!local.peerJumpEvidence || !!model.trackClippedCarrierRows && !local.peerJumpRefuted;
      const scene = local.followVacated || local.reveal || peerJump ? { ...scanned,
        ...(local.followVacated ? { followVacated: true } : {}), ...(local.reveal || peerJump ? { allowDockTransfer: false } : {}),
        ...(peerJump ? { allowAuxiliaryPeerJump: true } : {}) } : scanned;
      const current = packed(scene);
      const exploratory = !!view && (!!scene.plots || !!scene.auxiliaries);
      if (!scene.carriers.length || !scene.edges.size || scene.pegs.size < (exploratory ? 1 : 2)) return null;
      const initial = reductionState(scene);
      const budget = remaining + Number(local.selected !== null), mobilePlot = Boolean(scene.carriedPlots?.size);
      const extended = mobilePlot || !!scene.auxiliaries?.size;
      const bounds = extended ? { maximumStates: 65_536, maximumFrontier: 131_072 }
        : { maximumStates: 8192, maximumFrontier: 16384 };
      const pending = extended ? local.segment?.path[0] : undefined;
      const retainedSegment = pending && [...reductionSuccessors(initial, scene)].some(([, next]) => same(next, pending))
        ? local.segment : null;
      const joinPair = local.reveal && view && scene.pegs.size === 2 ? local.reveal : null;
      const focused = joinPair && !retainedSegment ? carrierScopeForPair(scene, joinPair.direction) : scene;
      const scoped = focused === scene ? null
        : await boundedReductionRouteCooperative(reductionState(focused), focused, budget, bounds, 'join_pair', execution);
      // A scoped search can ignore unrelated carriers. Check its route against the full scene before using it.
      const result = retainedSegment || exploratory && scene.pegs.size === 1 ? null
        : scoped?.path && view && verifiesReductionPath(scene, reductionVisibleCells(model, view.offset), scoped.path) ? scoped
          : await boundedReductionRouteCooperative(initial, scene, budget, bounds, joinPair ? 'join_pair' : false, execution);
      const partial = !retainedSegment && exploratory && (result?.status === 'exhausted' || extended && result?.status === 'resource_bound')
        ? await boundedReductionRouteCooperative(initial, scene, budget, bounds, 'reduce', execution) : null;
      const landings = local.reveal && view && !retainedSegment ? boundaryLandings(model, view, scene, local.reveal) : null;
      let reveal = !retainedSegment && view && (!result || result.status === 'exhausted' || extended && result.status === 'resource_bound') && !partial?.path
        ? await boundedReductionRouteCooperative(initial, scene, budget, bounds, landings ? { landings, auxiliary: true }
          : !model.trackClippedCarrierRows && scene.auxiliaries?.size && scene.carriers.length > 1 ? 'reveal_with_auxiliary' : true, execution) : null;
      if (landings && reveal?.status === 'exhausted') {
        reveal = await boundedReductionRouteCooperative(initial, scene, budget, bounds, { landings }, execution);
      }
      const segment: Segment | null = retainedSegment ?? (result?.path ? { purpose: 'solve', path: result.path }
        : partial?.path ? { purpose: 'reduce', path: partial.path } : reveal?.path ? { purpose: 'reveal', path: reveal.path } : null);
      if (!segment) return null;
      let operation = segment.path[0];
      let reframes = false;
      if (view && operation?.[0] === 'jump') {
        const vector = jumpViewDirection(model, view.offset, operation[1], operation[2]);
        if (vector && Object.values(local.controls).some(control => same(control.vector, vector))) {
          const projected = packReductionState(reductionMoved(initial, vector, scene.edges, scene.plots, scene.followVacated));
          if (!same(projected, current)) {
            operation = ['move', vector];
            reframes = true;
          }
        }
      }
      if (!operation) return null;
      let choice: Choice;
      if (operation[0] === 'move') {
        const vector = operation[1], available = observation.available_action_refs;
        const known = available.find(input => same(local.controls[input]?.vector, vector));
        const probe = available.find(input => /^ACTION[1-4]$/.test(input) && !local.controls[input] && !local.tested.includes(scopeAttempt(input, current)));
        const input = known ?? probe;
        if (!input) return null;
        const effect = known ? packReductionState(reductionMoved(initial, vector, scene.edges, scene.plots, scene.followVacated)) : null;
        choice = { stage: known ? 'move' : 'probe', command: { action_ref: input, data: {} },
          effect, addressed: null, source: null, landing: null,
          ...(reframes ? { reframes: true } : {}),
          ...(effect?.[2] && !same(effect[2], current[2]) ? { carried: true } : {}) };
      } else {
        const [, source, landing] = operation, selected = same(local.selected, source);
        const cell = selected ? landing : source, box = boxFor(model, cell, view?.offset);
        const [x, y] = [Math.floor((box[0] + box[2] + 1) / 2), Math.floor((box[1] + box[3] + 1) / 2)];
        if (x < 0 || y < 0 || x >= model.width || y >= model.height) return null;
        const planned = [...reductionSuccessors(initial, scene)].find(([, candidate]) => same(candidate, operation));
        if (!planned) return null;
        const mid: ReductionPoint = [(source[0] + landing[0]) / 2, (source[1] + landing[1]) / 2];
        const midKey = mid.join(',');
        const auxiliaryJump = !!scene.auxiliaries?.has(source.join(','));
        const peerTrial = auxiliaryJump && scene.auxiliaries?.has(midKey) && !local.peerJumpEvidence;
        const carried = !!scene.carriedPlots?.has(midKey) ||
          !!scene.auxiliaries?.has(midKey) && scene.carriers.some(cell => same(cell, mid));
        const preserved = carried || scene.plots?.has(midKey) || scene.auxiliaries?.has(midKey)
          || auxiliaryJump && scene.pegs.has(midKey);
        const dock = !!scene.auxiliaries && !preserved && !scene.pegs.has(midKey);
        choice = { stage: selected ? 'jump' : 'select', command: { action_ref: 'ACTION6', data: { x, y } },
          effect: selected ? packReductionState(planned[0]) : current, addressed: cell, source, landing,
          ...(preserved ? { intermediate: mid, ...(carried ? { carried: true } : {}) } : {}), ...(dock ? { dock } : {}),
          ...(peerTrial ? { peerTrial } : {}) };
      }
      const strategy = choice.stage === 'probe' ? 'identify_carrier_motion'
        : choice.stage === 'move' ? choice.carried ? 'position_carried_intermediate' : 'move_carrier_into_range'
        : choice.dock ? 'verify_dock_transfer' : choice.intermediate ? 'verify_preserved_intermediate'
        : choice.stage === 'select' ? 'select_piece_for_reduction' : 'verify_reduction_landing';
      const ref = observation.observation_ref, parent = 'G_official_completion', label = observedCarrierStrategies[strategy];
      const situation = choice.reframes ? 'Bring both ends of the pending jump into view'
        : choice.peerTrial ? 'Test whether two matching auxiliaries can jump over each other and both stay in play'
        : segment.purpose === 'reveal' && scene.auxiliaries?.size
        ? 'Keep the auxiliary within reach and check what the next landing reveals'
        : segment.purpose === 'reveal' ? 'Move a loaded carrier toward the edge of the mapped area and check what the new view reveals'
        : segment.purpose === 'reduce' ? 'Reduce a group that can be reached now and retain the other pieces in the map' : label;
      const evidence: [string, ...string[]] = [ref, ...new Set([...retained.refs, ...local.refs, ...(local.peerJumpEvidence ? [local.peerJumpEvidence] : []),
        ...Object.values(local.controls).map(motion => motion.ref)].filter(item => item !== ref))];
      const action = choice.command, directionalSeries: Choice[] = [];
      if (extended && local.followVacated && view && choice.stage === 'move') {
        let position = initial;
        for (const next of segment.path.slice(0, Math.min(remaining, maximumCommittedActions))) {
          if (next[0] !== 'move') break;
          const command = observation.available_action_refs.find(input => same(local.controls[input]?.vector, next[1]));
          if (!command) break;
          position = reductionMoved(position, next[1], scene.edges, scene.plots, true);
          directionalSeries.push({ ...choice, command: { action_ref: command, data: {} }, effect: packReductionState(position) });
        }
      }
      const actions = directionalSeries.length > 1 ? directionalSeries.map(step => step.command) : [action];
      const locus = choice.addressed ? await ObservedInputDomain.makeLocusWitness(observation, rows, [Number(action.data.x), Number(action.data.y)], { reason: label, evidence }) : null;
      if (choice.addressed && !locus) return null;
      const objective = { kind: 'join_visible_population_through_supported_jumps', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['piece', 'carrier', 'landing'], parentObjective: parent, satisfactionContract: 'observe_reduce_and_official_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `carrier-reduction:${need.id}`;
      const loadedAuxiliaries = scene.carriers.filter(cell => scene.auxiliaries?.has(cell.join(',')));
      const focusedCarrier = scene.auxiliaries && scene.carriers.find(cell => same(cell, choice.source) || same(cell, choice.landing))
        || loadedAuxiliaries[0] || scene.carriers[0]!;
      const cargo = [...(scene.carriedPlots?.size ? current[2] ?? [] : []), ...loadedAuxiliaries]
        .map(cell => boxFor(model, cell, view?.offset)).filter(([l, t, r, b]) => l >= 0 && t >= 0 && r < model.width && b < model.height);
      return { status: 'proposed', kind: observedCarrierReductionId, actions, local: extended ? { ...local, segment } : local, choice, current, needId: need.id,
        ...(actions.length > 1 ? { directionalSeries } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: actions.map((item, i) => ({ action: item, ...(locus ? { point_binding: locus } : {}),
          expected_after: directionalSeries[i]?.effect ?? choice.effect })),
        sicSituationCard: { strategy, need: 'Bring the separated pieces into one reachable group',
          situation, mode: choice.stage === 'probe' || choice.peerTrial || segment.purpose === 'reveal' ? 'exploration' : 'solving', evidence, agenda: [],
          carrier: boxFor(model, focusedCarrier, view?.offset), source: choice.source && boxFor(model, choice.source, view?.offset),
          landing: choice.landing && boxFor(model, choice.landing, view?.offset),
          ...(choice.intermediate ? { intermediate: boxFor(model, choice.intermediate, view?.offset) } : {}),
          ...(mobilePlot || cargo.length ? { carriedIntermediates: cargo } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
          preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const previous = index > 0 ? proposal.directionalSeries?.[index - 1]?.effect : null;
      const { local: { view, model, epoch } } = proposal;
      const next = view && previous && epoch === observation.level_epoch
        ? acquireCarrierView(packet.frame_rows, observation, model, view, previous) : null;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : next?.matches === true && !next.cameraChanged && !next.newPegs;
      return { admitted, reason: admitted ? 'carrier_or_landing_bound' : 'transport_context_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const { local: { model, view } } = proposal;
      const choice = proposal.directionalSeries?.[index] ?? proposal.choice;
      if (view) {
        const vector = (proposal.local.reveal || model.trackClippedCarrierRows) && choice.stage === 'move'
          ? proposal.local.controls[choice.command.action_ref]?.vector : undefined;
        const next = acquireCarrierView(second, after, model, view, choice.effect, vector);
        const selected = choice.stage !== 'select' || visibleSelection(model, choice.addressed!, first, second, view.offset);
        const matched = !next || !selected ? false : next.matches;
        return { matched, seal_prefix: !proposal.directionalSeries || matched !== true || !!next?.cameraChanged || !!next?.newPegs || !!next?.enteringCarriers || !!next?.leavingCarriers,
          reason: !next ? 'camera_registration_ambiguous' : !selected || matched === false
          ? 'tracked_population_or_carrier_motion_refuted' : next.enteringCarriers ? 'carrier_arrived_from_outside_the_observed_rails'
            : next.leavingCarriers ? 'carrier_left_toward_unobserved_rails' : next.newPegs ? 'camera_registered_and_new_pieces_observed'
            : next.cameraChanged ? 'tracked_population_preserved_across_camera_shift' : 'carrier_and_population_projection_confirmed' };
      }
      const next = packed(reductionScan(second, model));
      const matched = before.level_epoch === after.level_epoch && (choice.stage === 'probe' ? null
        : same(next, choice.effect) && (choice.stage !== 'select' || visibleSelection(model, choice.addressed!, first, second)));
      return { matched, seal_prefix: true, reason: matched === null ? 'measure_carrier_direction'
        : matched ? 'carrier_and_population_projection_confirmed' : 'carrier_or_population_projection_refuted' };
    },
    async record(before, after, action, first, second, proposal, index) {
      const { current } = proposal;
      const local = index > 0 && state?.epoch === before.level_epoch ? state : proposal.local;
      const choice = proposal.directionalSeries?.[index] ?? proposal.choice;
      if (after.levels_completed > before.levels_completed && choice.stage === 'jump') {
        const { unit, pitch, token } = local.model;
        witness = { epoch: after.level_epoch, unit, pitch, token, refs: [...local.refs.slice(-4), before.observation_ref, after.observation_ref] };
        recalled = { epoch: after.level_epoch, controls: local.controls };
      }
      if (before.level_epoch !== after.level_epoch) return { events: [] };
      if (local.view) {
        const vector = local.controls[action.action_ref]?.vector;
        const motion = (local.reveal || local.model.trackClippedCarrierRows) && choice.stage === 'move' ? vector : undefined;
        let next = acquireCarrierView(second, after, local.model, local.view, choice.effect, motion);
        const scene = unpackCarrierView(local.view);
        let learnedVacancy = false;
        if (next?.matches === false && (scene.carriedPlots?.size || scene.auxiliaries?.size) && !local.followVacated && choice.stage === 'move' && vector) {
          const alternative = packReductionState(reductionMoved(reductionState(scene), vector, scene.edges, scene.plots, true));
          if (!same(choice.effect, alternative)) {
            const acquired = acquireCarrierView(second, after, local.model, local.view, alternative, motion);
            if (acquired?.matches) { next = acquired; learnedVacancy = true; }
          }
        }
        const selected = choice.stage === 'select' && next?.matches && visibleSelection(local.model, choice.addressed!, first, second, local.view.offset)
          ? choice.addressed : null;
        const direction = choice.stage === 'probe' && next ? fitCarrierMotion(scene, packed(unpackCarrierView(next.view))) : null;
        const { segment, ...retained } = local;
        const newPlot = next?.matches && next.cameraChanged && !local.model.plot ? readPlot(after, next.nextModel) : undefined;
        let learnedPlot = false;
        if (next && newPlot) {
          const measured = acquireCarrierView(second, after, { ...next.nextModel, plot: newPlot }, next.view, null);
          if (measured && (measured.view.memory.plots?.length || measured.view.memory.carriedPlots?.length)) {
            next = { ...next, nextModel: measured.nextModel, view: measured.view };
            learnedPlot = true;
          }
        }
        let remaining: ReductionOperation[] = [];
        if (segment && !learnedPlot && !learnedVacancy && next?.matches && !next.newPegs && !next.enteringCarriers && !next.leavingCarriers) {
          if (choice.reframes) {
            // The viewport motion did not execute the jump. Downstream carrier moves need a fresh route.
            const firstMove = segment.path.findIndex(step => step[0] === 'move');
            if (next.cameraChanged) remaining = firstMove < 0 ? segment.path : segment.path.slice(0, firstMove);
          } else if (segment.purpose !== 'reveal' || !next.cameraChanged) {
            remaining = choice.stage === 'select' ? segment.path : segment.path.slice(1);
          }
        }
        const reveal = local.reveal;
        const testedTargets = reveal && segment?.purpose === 'reveal' && !remaining.length && next?.matches && !next.cameraChanged
          ? boundaryLandings(local.model, local.view, scene, reveal) : null;
        const attemptedLanding = testedTargets && next
          ? [...next.view.memory.pegs, ...(next.view.memory.auxiliaries ?? [])]
            .filter(cell => testedTargets.has(cell) && !scene.pegs.has(cell) && !scene.auxiliaries?.has(cell)) : [];
        const peerTest = choice.peerTrial && choice.stage === 'jump';
        state = { ...retained, selected, model: next?.nextModel ?? local.model, view: next?.view ?? local.view,
          ...(reveal && attemptedLanding.length ? { reveal: { ...reveal, testedLandings: [...new Set([...reveal.testedLandings, ...attemptedLanding])] } } : {}),
          stopped: !next || !peerTest && next.matches === false || choice.stage === 'select' && !selected,
          ...(peerTest && next?.matches === true ? { peerJumpEvidence: after.observation_ref }
            : peerTest && next?.matches === false ? { peerJumpRefuted: true } : {}),
          ...(segment && remaining.length ? { segment: { ...segment, path: remaining } } : {}),
          ...(learnedVacancy ? { followVacated: true } : {}),
          refs: [...local.refs.slice(-6), after.observation_ref],
          tested: choice.stage === 'probe' ? [...local.tested, scopeAttempt(action.action_ref, current)] : local.tested,
          controls: direction ? { ...local.controls, [action.action_ref]: { vector: direction, ref: after.observation_ref } } : local.controls };
        return { events: [], ...(learnedVacancy ? { reviewEvidence: 'The following carrier moved into the position vacated by the leading carrier in the same command.' }
          : peerTest && next?.matches === true ? { reviewEvidence: 'The jumping auxiliary changed position and the auxiliary it crossed stayed in place.' } : {}) };
      }
      const result = await this.after(proposal, 0, before, after, first, second);
      const selected = choice.stage === 'select' && result.matched ? choice.addressed : null;
      const clear = selected ? reductionScan(first, local.model) : null;
      state = { ...local, selected, selectedSupports: clear ? { floor: [...clear.floor], rails: [...clear.rails], edges: [...clear.edges] } : null,
        stopped: result.matched === false, refs: [...local.refs.slice(-6), after.observation_ref] };
      if (choice.stage === 'probe') {
        const direction = fitCarrierMotion(reductionScan(first, local.model), packed(reductionScan(second, local.model)));
        state.tested = [...local.tested, scopeAttempt(action.action_ref, current)];
        if (direction) state.controls = { ...local.controls, [action.action_ref]: { vector: direction, ref: after.observation_ref } };
      }
      return { events: [] };
    },
    state: () => ({ calibration, witness, state, recalled }),
    restore(value: NativeRecord) {
      calibration = structuredClone((value.calibration as Calibration | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      state = structuredClone((value.state as State | undefined) ?? null);
      recalled = structuredClone((value.recalled as RecalledControls | undefined) ?? null);
    },
  };
}
