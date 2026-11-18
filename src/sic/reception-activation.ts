import { measureReceptionLayout, receptionServiceCarriers } from '../logos-engine/v6-reception-service-observation.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Support = { anchor: NativePoint; bbox: NativeBox; color: number; mask: NativePoint[] };
type Layout = { box: NativeBox; pitch: number; cells: NativePoint[]; background: number; support_candidates: Support[]; requests: NativeBox[] };
export type ReceptionMemory = { pitch: number; controls: Record<string, NativePoint>; supportInk: number; evidence: string[] };
type Move = { input: string; delta: NativePoint };
type Failure = { tick: number; activation: number; site: string };
export type ReceptionActivation = {
  epoch: number; layout: Layout; initialHash: string; start: NativePoint; carrierInk: number; at: NativePoint;
  visible: boolean; device: NativePoint | null; deviceMark: string; firstDevice: NativePoint; walls: string[];
  inactiveInk: number; target: NativePoint | null; tick: number; activation: number; failures: Failure[]; evidence: string[];
  requests?: NativeBox[]; ready?: boolean;
};
export type ReceptionActivationStep = {
  input: string; to: NativePoint; stage: 'approach' | 'contact' | 'route' | 'hold'; target: NativePoint;
};

const key = (point: NativePoint) => point.join(',');
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const offset = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const tile = (rows: NativeRows, [x, y]: NativePoint, pitch: number) => rows.slice(y, y + pitch).map(row => row.slice(x, x + pitch));
const fingerprint = (pixels: NativeRows) => JSON.stringify(pixels);
const deltaSize = ([x, y]: NativePoint) => Math.abs(x) + Math.abs(y);

function enclosedMark(pixels: NativeRows): boolean {
  const end = pixels.length - 1, ink = pixels[0]![0]!;
  let fill = 0;
  const holes = new Set<number>();
  for (const [y, row] of pixels.entries()) {
    for (const [x, value] of row.entries()) {
      if (x === 0 || y === 0 || x === end || y === end) {
        if (value !== ink) return false;
      } else if (value === ink) fill++;
      else holes.add(value);
    }
  }
  return fill > 0 && holes.size === 1;
}

export function receptionRequestTiles({ pitch, requests }: Pick<Layout, 'pitch' | 'requests'>): NativeBox[] {
  return [...new Map(requests.filter(([l, t, r, b]) => r - l + 1 === pitch && b - t + 1 === pitch)
    .map(request => [request.join(','), request])).values()];
}

export function startReceptionActivation(rows: NativeRows, epoch: number, frameHash: string, memory: ReceptionMemory): ReceptionActivation | null {
  const layout = measureReceptionLayout(rows) as Layout | null;
  if (!layout || layout.pitch !== memory.pitch || layout.cells.length > 196 || layout.support_candidates.length < 4) return null;
  const requests = receptionRequestTiles(layout);
  if (layout.requests.length !== 1 && requests.length < 2) return null;
  const actors = receptionServiceCarriers(rows, layout);
  const inactiveInk = layout.support_candidates[0]!.color;
  if (actors.length !== 1 || inactiveInk === memory.supportInk
    || layout.support_candidates.some(support => support.color !== inactiveInk)) return null;
  const { pitch, cells, box } = layout;
  const wall = fingerprint(tile(rows, [box[0] - 1, box[1] - 1], pitch));
  const patches = cells.map(site => ({ site, pixels: tile(rows, site, pitch) }));
  const walls = patches.filter(({ pixels }) => fingerprint(pixels) === wall).map(({ site }) => key(site));
  const devices = patches.filter(({ pixels }) => pixels[0]![0] !== inactiveInk && enclosedMark(pixels));
  if (devices.length !== 1) return null;
  const { site: device, pixels } = devices[0]!;
  const start = actors[0]!.anchor as NativePoint;
  return { epoch, layout, initialHash: frameHash, start, carrierInk: actors[0]!.color, at: start, visible: true,
    device, deviceMark: fingerprint(pixels), firstDevice: device, walls, inactiveInk, target: null, tick: 0,
    ...(requests.length > 1 ? { requests, ready: false } : {}),
    activation: 0, failures: [], evidence: memory.evidence };
}

function disabledSite(pixels: NativeRows, ink: number): boolean {
  const end = pixels.length - 1, top = pixels[0]!, bottom = pixels[end]!;
  // A marked rim can hide a moving body, so measure the interior edge samples.
  return [0, end].some(side => pixels.slice(1, end).every(row => row[side] === ink))
    && top.slice(1, end).every(value => value === ink) && bottom.slice(1, end).every(value => value === ink);
}

function selection(state: ReceptionActivation, rows: NativeRows, moves: Move[], target: NativePoint, remaining: number) {
  const { layout, at, tick, activation, failures } = state;
  const wall = new Set(state.walls), cells = new Set(layout.cells.map(key));
  const barred = new Set(layout.cells.filter(site => disabledSite(tile(rows, site, layout.pitch), state.inactiveInk)).map(key));
  const knownBadTime = new Set(failures.filter(failure => failure.activation === activation).map(failure => `${failure.tick}:${failure.site}`));
  type Node = { site: NativePoint; depth: number; first: { move: Move; to: NativePoint } | null };
  const queue: Node[] = [{ site: at, depth: 0, first: null }];
  const visited = new Set([key(at) + ':0']);
  for (let i = 0; i < queue.length; i++) {
    const { site, depth, first } = queue[i]!;
    if (equal(site, target)) return first;
    if (depth >= Math.min(remaining, layout.cells.length)) continue;
    for (const move of moves) {
      const found = offset(site, move.delta), destination = key(found);
      const blocked = !cells.has(destination) || wall.has(destination);
      if (!knownBadTime.size && blocked) continue;
      const to = blocked ? site : found, toKey = key(to);
      const visit = `${toKey}:${knownBadTime.size ? depth + 1 : 0}`;
      if (visited.has(visit) || (!equal(to, target) && barred.has(toKey))
        || knownBadTime.has(`${tick + depth + 1}:${toKey}`)) continue;
      visited.add(visit);
      queue.push({ site: to, depth: depth + 1, first: first ?? { move, to } });
    }
  }
  return null;
}

export function chooseReceptionActivation(state: ReceptionActivation, rows: NativeRows, memory: ReceptionMemory,
  available: readonly string[], remaining: number): ReceptionActivationStep | null {
  const moves = available.flatMap(input => {
    const delta = memory.controls[input];
    return delta && deltaSize(delta) === state.layout.pitch && (delta[0] === 0 || delta[1] === 0) ? [{ input, delta }] : [];
  }).sort((a, b) => a.input.localeCompare(b.input));
  const target = state.target ?? state.device;
  if (state.ready || !target || moves.length < 2 || state.tick >= state.layout.cells.length) return null;
  if (state.target && equal(state.at, state.target)) {
    const blocked = moves.find(move => {
      const next = offset(state.at, move.delta);
      return !state.layout.cells.some(site => equal(site, next)) || state.walls.includes(key(next));
    });
    return blocked ? { input: blocked.input, to: state.at, stage: 'hold', target } : null;
  }
  const first = selection(state, rows, moves, target, remaining);
  return first ? { input: first.move.input, to: first.to, target,
    stage: state.target ? 'route' : equal(first.to, target) ? 'contact' : 'approach' } : null;
}

function activeSupports(rows: NativeRows, state: ReceptionActivation, supportInk: number): NativePoint[] {
  const active = state.layout.support_candidates.filter(support => {
    const [l, t] = support.bbox, [ax, ay] = support.anchor, last = state.layout.pitch - 1;
    const positions = support.mask.map(([dx, dy]) => [l + dx, t + dy] as const)
      .filter(([x, y]) => !((x === ax || x === ax + last) && (y === ay || y === ay + last)));
    return positions.length > 0 && positions.every(([x, y]) => rows[y]![x] === supportInk);
  });
  return active.map(support => support.anchor);
}

export function crossingRestoredStart(state: ReceptionActivation, step: ReceptionActivationStep, frameHash: string): boolean {
  return frameHash === state.initialHash && !equal(step.to, state.start);
}

export function recordReceptionActivation(state: ReceptionActivation, step: ReceptionActivationStep, rows: NativeRows,
  frameHash: string, ref: string, memory: ReceptionMemory): { next: ReceptionActivation; evidence?: string } {
  const { layout } = state, tick = state.tick + 1, evidence = [...state.evidence.slice(-5), ref];
  if (crossingRestoredStart(state, step, frameHash)) {
    const failed = { tick, activation: state.activation, site: key(step.to) };
    return { next: { ...state, at: state.start, visible: true, device: state.firstDevice, target: null, tick: 0, activation: 0,
      failures: [...state.failures, failed], evidence }, evidence: 'The attempted crossing restored the starting scene. Change the route or the time of arrival.' };
  }
  const supports = activeSupports(rows, state, memory.supportInk);
  const target = !state.requests && supports.length === 1 ? supports[0]! : state.target;
  const candidates = receptionServiceCarriers(rows, layout);
  const actor = candidates.find(candidate => equal(candidate.anchor, step.to))
    ?? candidates.find(candidate => candidate.color === state.carrierInk);
  const switchTiles = state.device ? layout.cells.filter(site => fingerprint(tile(rows, site, layout.pitch)) === state.deviceMark) : [];
  const device = switchTiles.length === 1 ? switchTiles[0]! : null;
  const changed = step.stage === 'contact' && state.device && device && !equal(state.device, device);
  const ready = !!state.requests && step.stage === 'contact' && !device && supports.length === state.requests.length;
  const activated = step.stage === 'contact' && !device && !state.target && (target || ready);
  return { next: { ...state, tick, target, activation: activated ? tick : state.activation, evidence, device,
    ...(state.requests ? { ready } : {}), at: actor?.anchor ?? step.to, visible: !!actor },
    ...(ready ? { evidence: 'The device disappeared and a support became available for each separate request.' }
      : activated ? { evidence: 'The device disappeared on contact and the distant support took the previously successful marking.' }
      : changed ? { evidence: 'The contacted body shifted by one cell. The support is still inactive.' } : {}) };
}
