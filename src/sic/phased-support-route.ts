import { composePlan } from './effect-composer.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { inferCycleAfterTransient, type CycleEvidence } from './observed-cycle.ts';

type Change = readonly [cell: number, ink: number];
type Cycle = { phases: Change[][]; closed: boolean; evidence?: CycleEvidence };
type Pad = { cell: number; pixels: number[] };
type Terrain = { origin: NativePoint; width: number; height: number; pitch: number; base: number[]; voids: number[] };
export type PhaseControls = { pitch: number; actor: number; target: number };
export type PhasePosition = { cell: number; phases: number[] };
export type PhaseStep = { direction: number; next: PhasePosition } | { control: number; next: PhasePosition; probing: boolean }
  | { portal: true; next: PhasePosition };
export type PhasedSupport = {
  terrain: Terrain; controls: NativeBox[]; portal: NativeBox; pads: [Pad, Pad]; actorInk: number; target: number;
  cycles: Cycle[]; position: PhasePosition; route: PhaseStep[];
};

const deltas: readonly NativePoint[] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const includes = (a: NativeBox, b: NativeBox) => a[0] <= b[0] && a[1] <= b[1] && b[2] <= a[2] && b[3] <= a[3];
const pixelsAt = (rows: NativeRows, [x, y]: NativePoint, pitch: number) =>
  rows.slice(y, y + pitch).flatMap(row => row.slice(x, x + pitch));
const uniform = (pixels: readonly number[]) => pixels.every(ink => ink === pixels[0]) ? pixels[0] ?? -1 : -1;
const point = ({ origin, pitch, width }: Terrain, cell: number): NativePoint =>
  [origin[0] + cell % width * pitch, origin[1] + Math.floor(cell / width) * pitch];

export function phaseFootprint(terrain: Terrain, cell: number): NativeBox {
  const [x, y] = point(terrain, cell), end = terrain.pitch - 1;
  return [x, y, x + end, y + end];
}

function neighbor({ width, height }: Terrain, cell: number, [dx, dy]: NativePoint): number {
  const x = cell % width + dx, y = Math.floor(cell / width) + dy;
  return x >= 0 && x < width && y >= 0 && y < height ? y * width + x : -1;
}

function raster(rows: NativeRows, terrain: Terrain): number[] {
  return Array.from({ length: terrain.width * terrain.height }, (_, cell) =>
    uniform(pixelsAt(rows, point(terrain, cell), terrain.pitch)));
}

export function measurePhasedSupport(rows: NativeRows, known: PhaseControls): PhasedSupport | null {
  if (known.pitch !== 2) return null;
  const { pitch } = known;
  const parts = geometricComponents(rows);
  const fields = parts.filter(part => !part.rectangular && part.area * 5 >= rows.length * rows[0]!.length);
  const matches: PhasedSupport[] = [];
  for (const arena of fields) for (const panel of fields) {
    if (arena.bbox[2] >= panel.bbox[0] && panel.bbox[2] >= arena.bbox[0]) continue;
    const actors = parts.filter(p => p.rectangular && p.color === known.actor
      && width(p.bbox) === pitch && height(p.bbox) === pitch && includes(arena.bbox, p.bbox));
    const targets = parts.filter(p => p.rectangular && p.color === known.target
      && width(p.bbox) === pitch && height(p.bbox) === pitch && includes(arena.bbox, p.bbox));
    if (actors.length !== 1 || targets.length !== 1) continue;
    const [ax, ay] = actors[0]!.bbox, [gx, gy] = targets[0]!.bbox, [l, t, r, b] = arena.bbox;
    if ((gx - ax) % pitch || (gy - ay) % pitch) continue;
    const origin: NativePoint = [l + (ax - l) % pitch, t + (ay - t) % pitch];
    const terrain: Terrain = { origin, pitch, width: Math.floor((r - origin[0] + 1) / pitch),
      height: Math.floor((b - origin[1] + 1) / pitch), base: [], voids: [arena.color, panel.color] };
    const index = (x: number, y: number) => (y - origin[1]) / pitch * terrain.width + (x - origin[0]) / pitch;
    const actor = index(ax, ay), target = index(gx, gy);
    terrain.base = raster(rows, terrain);
    const sharedFloor = deltas.map(delta => terrain.base[neighbor(terrain, actor, delta)]).filter((ink): ink is number =>
      ink !== undefined && ink >= 0 && !terrain.voids.includes(ink) && ink !== known.actor && ink !== known.target);
    const floors = [...new Set(sharedFloor)].filter(ink => sharedFloor.filter(other => other === ink).length >= 2);
    if (floors.length !== 1 || deltas.filter(delta => terrain.base[neighbor(terrain, target, delta)] === floors[0]).length < 2) continue;
    terrain.base[actor] = floors[0]!;
    const buttons = parts.filter(p => p.area >= 4 * pitch * pitch && width(p.bbox) >= 2 * pitch && height(p.bbox) >= 2 * pitch
      && p.color !== panel.color && includes(panel.bbox, p.bbox) && p.mask.some(([x, y]) =>
        x === Math.floor((width(p.bbox) - 1) / 2) && y === Math.floor((height(p.bbox) - 1) / 2)));
    if (buttons.length < 3 || buttons.length > 4) continue;
    const markers = terrain.base.flatMap((ink, cell) => {
      if (ink >= 0) return [];
      const pixels = pixelsAt(rows, point(terrain, cell), pitch);
      return pixels[0] === pixels[3] && pixels[1] === pixels[2] && pixels[0] !== pixels[1] ? [{ cell, pixels }] : [];
    });
    const portals = buttons.flatMap(button => {
      const pads = markers.filter(marker => marker.pixels.includes(button.color));
      return pads.length === 2 && pads[0]!.pixels.every(ink => pads[1]!.pixels.includes(ink)) ? [{ button, pads }] : [];
    });
    if (portals.length !== 1) continue;
    const { button, pads } = portals[0]!;
    const controls = buttons.filter(p => p !== button).map(p => p.bbox).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    matches.push({ terrain, controls, cycles: controls.map(() => ({ phases: [[]], closed: false })),
      portal: button.bbox, pads: [pads[0]!, pads[1]!], actorInk: known.actor, target,
      position: { cell: actor, phases: controls.map(() => 0) }, route: [] });
  }
  return matches.length === 1 ? matches[0]! : null;
}

function projected(state: PhasedSupport, position: PhasePosition): number[] {
  const result = [...state.terrain.base];
  for (const [control, phase] of position.phases.entries()) {
    for (const [cell, ink] of state.cycles[control]!.phases[phase]!) result[cell] = ink;
  }
  return result;
}

function matchesPads(state: PhasedSupport, rows: NativeRows, actor: number) {
  return state.pads.every(pad => {
    if (pad.cell === actor) return true;
    const pixels = pixelsAt(rows, point(state.terrain, pad.cell), state.terrain.pitch);
    return pixels[0] === pixels[3] && pixels[1] === pixels[2] && pixels[0] !== pixels[1]
      && pixels.every(ink => pad.pixels.includes(ink));
  });
}

export function observePhaseStep(state: PhasedSupport, step: PhaseStep, rows: NativeRows, maximumObservations = 12): PhasedSupport | null {
  const { terrain, actorInk } = state, next = step.next, observed = raster(rows, terrain);
  if (observed[next.cell] !== actorInk || observed.filter(ink => ink === actorInk).length !== 1 || !matchesPads(state, rows, next.cell)) return null;
  if ('control' in step && step.probing) {
    const changes = observed.flatMap<Change>((ink, cell) => cell !== next.cell && ink !== terrain.base[cell] ? [[cell, ink]] : []);
    const cycle = state.cycles[step.control]!;
    if (!changes.length && cycle.phases.length === 1 || cycle.phases.length >= maximumObservations && changes.length) return null;
    const previous = new Set(state.cycles.flatMap((other, index) => index === step.control ? [] : other.phases.flat().map(([cell]) => cell)));
    if (changes.some(([cell]) => previous.has(cell))) return null;
    const samples = [...cycle.phases, changes];
    const learned = changes.length ? inferCycleAfterTransient(samples, (left, right) =>
      left.length === right.length && left.every(([cell, ink], i) => cell === right[i]![0] && ink === right[i]![1]), 0) : undefined;
    const updated: Cycle = learned
      ? { phases: learned.phases, closed: true, evidence: { start: learned.start, witnesses: learned.witnesses } }
      : changes.length ? { phases: samples, closed: false } : { ...cycle, closed: true };
    const cycles = state.cycles.map((other, index) => index === step.control ? updated : other);
    const position = learned ? { ...next, phases: next.phases.map((phase, index) => index === step.control
      ? (samples.length - 1 - learned.start) % learned.phases.length : phase) } : state.position;
    return { ...state, cycles, position };
  }
  const expected = projected(state, next);
  if (observed.some((ink, cell) => cell !== next.cell && ink !== expected[cell])) return null;
  return { ...state, position: next, route: state.route.slice(1) };
}

export function planPhasedSupport(state: PhasedSupport, directions: readonly number[], remaining: number): PhaseStep[] {
  if (state.route.length) return state.route;
  const control = state.cycles.findIndex(cycle => !cycle.closed);
  if (control >= 0) return [{ control, next: state.position, probing: true }];
  const { terrain, target, pads } = state, counts = state.cycles.map(cycle => cycle.phases.length);
  const lookup = state.cycles.map(cycle => cycle.phases.map(phase => new Map(phase)));
  const passes = ({ cell, phases }: PhasePosition) => {
    if (cell === target || pads.some(pad => pad.cell === cell)) return true;
    const values = phases.map((phase, index) => lookup[index]![phase]!.get(cell));
    const ink = values.find(value => value !== undefined) ?? terrain.base[cell]!;
    return ink >= 0 && !terrain.voids.includes(ink);
  };
  const supported = { relation: 'footing remains supported', holds: passes };
  return composePlan<PhasePosition, PhaseStep>({
    domain: 'phased-support',
    initial: state.position, key: ({ cell, phases }) => [cell, ...phases].join(','),
    goal: { relation: 'reach the destination support', holds: position => position.cell === target },
    budget: { commands: remaining, states: 100_001 },
    *choices({ cell, phases }) {
      for (const direction of directions) {
        const after = { cell: neighbor(terrain, cell, deltas[direction]!), phases };
        if (after.cell >= 0) yield { action: { direction, next: after }, after, ensures: [supported] };
      }
      for (const [control, period] of counts.entries()) {
        const after = { cell, phases: phases.map((phase, i) => i === control ? (phase + 1) % period : phase) };
        yield { action: { control, probing: false, next: after }, after, maintains: [supported] };
      }
      const pad = pads.findIndex(item => item.cell === cell);
      if (pad !== -1) {
        const after = { cell: pads[1 - pad]!.cell, phases };
        yield { action: { portal: true, next: after }, after, ensures: [supported] };
      }
    },
  })?.effects.map(result => result.action) ?? [];
}

export function phaseAffectedSupport(state: PhasedSupport, control: number): NativeBox | null {
  const cells = state.cycles[control]!.phases.flatMap(phase => phase.map(([cell]) => phaseFootprint(state.terrain, cell)));
  if (!cells.length) return null;
  return [Math.min(...cells.map(box => box[0])), Math.min(...cells.map(box => box[1])),
    Math.max(...cells.map(box => box[2])), Math.max(...cells.map(box => box[3]))];
}
