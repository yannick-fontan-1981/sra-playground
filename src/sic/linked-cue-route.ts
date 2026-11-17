import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { aimCommands, aimPoseMatches, aimRoute, hasAimedRay, overlaps, readGauge, remoteFlightObserved, remoteOpeningObserved,
  type AimCommand, type AimPose, type AimWitness, type RemoteRoute, type ResizeWitness } from './remote-effect-route.ts';

export type CueCell = { box: NativeBox; point: NativePoint; initial: number };
export type CueRecipe = { box: NativeBox; cells: number[]; examples: NativeBox[]; ink: number };
type Work = 'resize' | 'launch' | 'transfer';
type Activation = { work: Work; target: number; pending: CueCell[] };
type Scene = { panel: NativeBox; cells: CueCell[]; recipes: Record<Work, CueRecipe>; routes: RemoteRoute[];
  gauge: NativeBox; fill: number; supply: NativeBox; small: AimWitness; large: AimWitness; largeAnchor: NativePoint; exit: NativeBox };
export type LinkedCue = { scene: Scene; pose: AimPose; size: 'small' | 'large'; trips: number; cleared: number[]; replenished: boolean;
  activation: Activation | null; refs: string[]; epoch: number; lastRef: string; stopped?: boolean };
export type LinkedCueStep = { kind: 'select' | 'copy' | 'apply' | 'aim' | 'recover' | 'exit'; action: NativeCommand;
  work?: Work; target: number; activation?: Activation; click?: NativeBox; expected?: AimPose };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const contains = ([l, t, r, b]: NativeBox, x: number, y: number) => l <= x && x <= r && t <= y && y <= b;
const covers = (a: NativeBox, b: NativeBox) => contains(a, b[0], b[1]) && contains(a, b[2], b[3]);
const square = (x: number, y: number, side: number): NativeBox => [x, y, x + side - 1, y + side - 1];
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const inkAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const commands = Object.keys(aimCommands) as AimCommand[];
const pixelTest = (box: NativeBox, test: (x: number, y: number) => boolean) => {
  for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) if (!test(x, y)) return false;
  return true;
};

function measuredPose(rows: NativeRows, field: NativeBox, witness: AimWitness): AimPose | null {
  const parts = geometricComponents(rows).filter(p => p.rectangular && p.area === witness.side ** 2 / 2
    && covers(field, p.bbox) && [witness.frontInk, witness.backInk].includes(p.color));
  const poses: AimPose[] = [];
  for (const front of parts.filter(p => p.color === witness.frontInk)) for (const back of parts.filter(p => p.color === witness.backInk)) {
    const box: NativeBox = [Math.min(front.bbox[0], back.bbox[0]), Math.min(front.bbox[1], back.bbox[1]),
      Math.max(front.bbox[2], back.bbox[2]), Math.max(front.bbox[3], back.bbox[3])];
    if (width(box) !== witness.side || height(box) !== witness.side) continue;
    for (const heading of commands) if (aimPoseMatches(rows, witness, { box, heading })) poses.push({ box, heading });
  }
  return poses.length === 1 ? poses[0]! : null;
}

export function measureLinkedCue(rows: NativeRows, panel: NativeBox, cells: CueCell[], recipes: Record<Work, CueRecipe>,
  witness: AimWitness, resize: ResizeWitness, epoch: number, ref: string, refs: string[]): LinkedCue | null {
  if (resize.from !== witness.side || resize.side >= witness.side) return null;
  const field: NativeBox = [0, 0, rows[0]!.length - 1, panel[1] - 1], large = { ...witness, epoch };
  const pose = measuredPose(rows, field, large);
  if (!pose) return null;
  const parts = geometricComponents(rows), size = large.side;
  const exits = parts.filter(p => p.rectangular && p.color === large.backInk && width(p.bbox) === size && height(p.bbox) === size
    && parts.some(rim => rim.color === large.frontInk && !rim.rectangular && covers(rim.bbox, p.bbox)
      && width(rim.bbox) <= size + 2 && height(rim.bbox) <= size + 2));
  const [l, t, r, b] = pose.box;
  const edges: NativeBox[] = [[l, t - 1, r, t - 1], [l, b + 1, r, b + 1], [l - 1, t, l - 1, b], [r + 1, t, r + 1, b]];
  const grounds = edges.flatMap(edge => {
    const ink = rows[edge[1]]?.[edge[0]];
    return ink !== undefined && ink !== large.frontInk && ink !== large.backInk
      && pixelTest(edge, (x, y) => rows[y]?.[x] === ink) ? [ink] : [];
  });
  const floor = grounds.find(ink => grounds.filter(value => value === ink).length >= 3);
  const gauges = parts.filter(p => p.rectangular && height(p.bbox) === rows.length && width(p.bbox) <= resize.side
    && (p.bbox[0] === 0 || p.bbox[2] === rows[0]!.length - 1));
  if (exits.length !== 1 || gauges.length !== 1 || floor === undefined) return null;
  const exit = exits[0]!.bbox, gauge = gauges[0]!, fill = gauge.color;
  const supplies = parts.filter(p => p.rectangular && width(p.bbox) === resize.side && height(p.bbox) === resize.side
    && p.color === fill && covers(field, p.bbox) && !overlaps(p.bbox, gauge.bbox));
  if (supplies.length !== 1) return null;
  const supply = supplies[0]!.bbox, small = { ...large, side: resize.side, unit: resize.unit };
  const routes: RemoteRoute[] = [];
  for (const rim of parts.filter(p => p.color === recipes.launch.ink && !p.rectangular && width(p.bbox) === size
    && height(p.bbox) === size && covers(field, p.bbox))) {
    const cores = parts.filter(p => p.rectangular && p.bbox[0] > rim.bbox[0] && p.bbox[1] > rim.bbox[1]
      && p.bbox[2] < rim.bbox[2] && p.bbox[3] < rim.bbox[3]);
    if (cores.length !== 1) return null;
    const core = cores[0]!;
    const gates = parts.filter(p => p !== core && p.color === core.color && p.rectangular && covers(field, p.bbox)
      && (width(p.bbox) === size || height(p.bbox) === size));
    if (gates.length !== 1 || routes.some(route => overlaps(route.barrier, gates[0]!.bbox))) return null;
    routes.push({ target: rim.bbox, core: core.bbox, barrier: gates[0]!.bbox, exit, field, floor, supply, witness: small, offsetAim: true });
  }
  if (routes.length < 2) return null;
  const scene = { panel, cells, recipes, routes, exit, gauge: gauge.bbox, fill, supply, small, large, largeAnchor: [l, t] as const };
  return { scene, pose, size: 'large', trips: 0, cleared: [], replenished: false, activation: null, refs, epoch, lastRef: ref };
}

function markedCells(rows: NativeRows, scene: Scene, recipe: CueRecipe): CueCell[] {
  const marked = scene.cells.filter((_, index) => recipe.cells.includes(index));
  const unmarked = scene.cells.filter((_, index) => !recipe.cells.includes(index));
  const ink = inkAt(rows, marked[0]!.point), spare = inkAt(rows, unmarked[0]!.point);
  return ink !== spare && marked.every(cell => inkAt(rows, cell.point) === ink)
    && unmarked.every(cell => inkAt(rows, cell.point) === spare) ? marked.map(cell => ({ ...cell, initial: ink! })) : [];
}

const click = (box: NativeBox): NativeCommand => {
  const [x, y] = center(box);
  return { action_ref: 'ACTION6', data: { x, y } };
};

function openRecipe(run: LinkedCue, rows: NativeRows, work: Work, target = 0): LinkedCueStep {
  const recipe = run.scene.recipes[work], pending = markedCells(rows, run.scene, recipe);
  if (pending.length) return useActivation({ work, target, pending });
  return { kind: 'select', action: click(recipe.box), click: recipe.box, work, target };
}

function useActivation(activation: Activation): LinkedCueStep {
  const { work, target, pending } = activation, cell = pending[0]!;
  return { kind: pending.length === 1 ? 'apply' : 'copy', action: click(cell.box), click: cell.box, work, target, activation };
}

function expectedGrowth(run: LinkedCue): AimPose {
  const { largeAnchor, large } = run.scene;
  const snap = (value: number, anchor: number) => anchor + Math.floor((value - anchor) / large.unit) * large.unit;
  const [x, y] = run.pose.box;
  return { box: square(snap(x, largeAnchor[0]), snap(y, largeAnchor[1]), large.side), heading: run.pose.heading };
}

export function chooseLinkedCue(run: LinkedCue, rows: NativeRows, available: readonly string[], remaining: number): LinkedCueStep | null {
  if (run.stopped || !aimPoseMatches(rows, run.scene[run.size], run.pose)) return null;
  if (run.activation) return useActivation(run.activation);
  const { scene, pose } = run;
  if (!run.trips) return openRecipe(run, rows, run.size === 'large' ? 'resize' : 'transfer');
  if (run.trips > 1) {
    const exit = aimRoute(rows, { ...scene.routes[0]!, witness: scene.large }, pose, available, 'exit', remaining);
    return exit ? { kind: 'exit', action: { action_ref: exit.action, data: {} }, target: 0, expected: exit.pose } : null;
  }
  const pending = scene.routes.flatMap<{ target: number; plan: ReturnType<typeof aimRoute>; distance: number }>((route, target) => {
    if (run.cleared.includes(target)) return [];
    const plan = hasAimedRay(rows, route, pose) ? null : aimRoute(rows, route, pose, available, 'aim', remaining);
    return plan ? [{ target, plan, distance: plan.distance }] : hasAimedRay(rows, route, pose) ? [{ target, plan, distance: 0 }] : [];
  }).sort((a, b) => a.distance - b.distance);
  const next = pending[0];
  if (next?.plan) return { kind: 'aim', action: { action_ref: next.plan.action, data: {} }, target: next.target, expected: next.plan.pose };
  if (next) return openRecipe(run, rows, 'launch', next.target);
  if (run.cleared.length !== scene.routes.length) return null;
  if (!run.replenished) {
    const supply = aimRoute(rows, scene.routes[0]!, pose, available, 'supply', remaining);
    return supply ? { kind: 'recover', action: { action_ref: supply.action, data: {} }, target: 0, expected: supply.pose } : null;
  }
  if (run.size === 'large') return openRecipe(run, rows, 'transfer');
  const grown = expectedGrowth(run);
  const { field, floor } = scene.routes[0]!;
  if (!covers(field, grown.box) || !pixelTest(grown.box, (x, y) => rows[y]?.[x] === floor || contains(pose.box, x, y))) return null;
  return openRecipe(run, rows, 'resize');
}

export function observeLinkedCue(run: LinkedCue, step: LinkedCueStep, first: NativeRows, rows: NativeRows,
  frames: readonly NativeRows[] = []): { run: LinkedCue; reason: string } | null {
  const { scene, pose } = run, witness = scene[run.size], route = scene.routes[step.target]!;
  const state = (updates: Partial<LinkedCue>, reason: string) => ({ run: { ...run, ...updates }, reason });
  if (step.expected) {
    if (!aimPoseMatches(rows, witness, step.expected)) return null;
    const replenished = step.kind === 'recover' && overlaps(step.expected.box, scene.supply);
    if (replenished && readGauge(rows, scene.gauge, scene.fill) <= readGauge(first, scene.gauge, scene.fill)) return null;
    return state({ pose: step.expected, replenished: run.replenished || replenished },
      replenished ? 'contact_restored_reserve' : 'linked_route_landing_confirmed');
  }
  if (step.kind === 'select' && step.work) {
    const pending = markedCells(rows, scene, scene.recipes[step.work]);
    return pending.length && aimPoseMatches(rows, witness, pose)
      ? state({ activation: { work: step.work, target: step.target, pending } }, 'visible_recipe_selected') : null;
  }
  const activation = step.activation;
  if (!activation) return null;
  if (step.kind === 'copy') {
    const cell = activation.pending[0]!;
    return aimPoseMatches(rows, witness, pose) && inkAt(rows, cell.point) !== cell.initial
      ? state({ activation: { ...activation, pending: activation.pending.slice(1) } }, 'visible_recipe_cell_changed') : null;
  }
  if (step.work === 'launch') {
    return aimPoseMatches(rows, witness, pose) && remoteOpeningObserved(rows, route) && remoteFlightObserved(first, frames, pose, route)
      ? state({ cleared: [...run.cleared, step.target], activation: null }, 'visible_effect_reached_inset_and_removed_its_barrier') : null;
  }
  const size = step.work === 'resize' ? run.size === 'large' ? 'small' : 'large' : run.size;
  const observed = measuredPose(rows, route.field, scene[size]);
  if (!observed || observed.heading !== pose.heading) return null;
  if (step.work === 'resize') {
    const expected = size === 'large' ? expectedGrowth(run).box : pose.box;
    if (size === 'large' ? !same(observed.box, expected) : !covers(expected, observed.box)) return null;
    return state({ size, pose: observed, activation: null }, 'recipe_changed_footprint_at_same_site');
  }
  if (Math.max(Math.abs(observed.box[0] - pose.box[0]), Math.abs(observed.box[1] - pose.box[1])) <= witness.unit
    || !run.cleared.every(index => remoteOpeningObserved(rows, scene.routes[index]!))) return null;
  const reachable = !run.trips ? scene.routes.some(route => hasAimedRay(rows, route, observed) || aimRoute(rows, route, observed, commands, 'aim', 40))
    : aimRoute(rows, { ...route, witness }, observed, commands, 'exit', 40);
  return reachable ? state({ pose: observed, trips: run.trips + 1, activation: null }, 'recipe_landed_on_linked_platform') : null;
}
