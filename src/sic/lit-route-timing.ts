import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { inferWitnessedSuffixCycle, type WitnessedCycle } from './witnessed-cycle.ts';

export type LightTiming = {
  samples: string[];
  elapsed: number;
  period: number;
  waitTicks: number;
  stopped: boolean;
  transientEvidence?: Pick<WitnessedCycle<string>, 'onset' | 'witnesses'>;
};
export type LightRoute = { point: NativePoint; route: NativePoint[] };
type TimedStep = LightRoute & { wait?: true };
type View = { actor: NativePoint; goal: NativePoint; light: number; guardInk: number; walls: number };
const key = ([x, y]: NativePoint) => x + ',' + y;
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];

export function exposureMask(rows: NativeRows, view: View, pitch: number): string {
  const width = rows[0]!.length, height = rows.length - pitch;
  const pixels = new Uint8Array(Math.ceil(width * height / 8));
  const mark = (x: number, y: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const i = y * width + x;
      pixels[i >> 3] = pixels[i >> 3]! | 1 << (i & 7);
    }
  };
  const [gx, gy] = view.goal;
  let illuminatedAtGoal = false;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const ink = rows[y]![x];
    if (ink !== view.light && ink !== view.guardInk) continue;
    mark(x, y);
    if (x >= gx - 1 && x <= gx + pitch && y >= gy - 1 && y <= gy + pitch) illuminatedAtGoal = true;
    if (ink !== view.guardInk || rows[y]![x + 2] !== ink || rows[y + 2]?.[x] !== ink || rows[y + 2]?.[x + 2] !== ink) continue;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) mark(x + dx, y + dy);
  }
  // The exit sprite hides its floor. Treat light along its edge as possible exposure beneath it.
  if (illuminatedAtGoal) for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) mark(gx + dx, gy + dy);
  return btoa(String.fromCharCode(...pixels));
}

export function collectLightTiming(timing: LightTiming | null, before: NativeRows, after: NativeRows, frames: readonly NativeRows[],
  view: View, pitch: number, allowWitnessedTransient = false): LightTiming | null {
  if (frames.length < 4 || frames.some(rows => rows[1]?.[1] !== view.walls)) return null;
  const observed = frames.map(rows => exposureMask(rows, view, pitch));
  const ticks = observed.length - 2;
  const first = exposureMask(before, view, pitch), last = exposureMask(after, view, pitch);
  if (observed[0] !== first || observed.at(-1) !== last || observed.at(-2) !== last
    || (timing && (timing.waitTicks !== ticks || timing.samples.at(-1) !== first))) return null;
  const samples = [...(timing?.samples ?? [first]), ...observed.slice(1, -1)];
  const origin = samples[0]!;
  const confirmation = pitch * 2 + 1;
  let period = 0;
  for (let length = 2; length + confirmation <= samples.length; length++) {
    if (samples[length] !== origin || !samples.slice(0, length).some(mask => mask !== origin)) continue;
    if (samples.every((mask, i) => i < length || mask === samples[i - length])) { period = length; break; }
  }
  if (!period && allowWitnessedTransient) {
    const cycle = inferWitnessedSuffixCycle(samples);
    if (cycle) {
      const { onset, phases, witnesses } = cycle;
      const rotated = phases.map((_, index) => phases[(index - onset % phases.length + phases.length) % phases.length]!);
      return { samples: rotated, elapsed: samples.length - 1, period: phases.length, waitTicks: ticks, stopped: false,
        transientEvidence: { onset, witnesses } };
    }
  }
  return { samples: period ? samples.slice(0, period) : samples, elapsed: samples.length - 1,
    period, waitTicks: ticks, stopped: !period && samples.length >= 320 };
}

export function sampledExposureSites(samples: readonly string[], points: readonly NativePoint[], width: number, pitch: number): string[] {
  const masks = samples.map(mask => atob(mask));
  return points.filter(([x, y]) => masks.some(mask => {
    for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) {
      const i = (y + dy) * width + x + dx;
      if (mask.charCodeAt(i >> 3) & (1 << (i & 7))) return true;
    }
    return false;
  })).map(key);
}

export function searchLightTiming(timing: LightTiming, view: View, pitch: number, width: number, height: number,
  routes: (start: NativePoint) => Map<string, LightRoute>, remaining: number): TimedStep | null {
  const { period, elapsed, waitTicks, samples } = timing;
  if (!period || elapsed < 0 || remaining < 1) return null;
  const masks = samples.map(mask => atob(mask));
  const clear = masks.map(() => new Uint8Array(width * height));
  const safe = (x: number, y: number, at: number) => {
    if (x < 0 || y < 0 || x + pitch > width || y + pitch > height) return false;
    const phase = at % period, i = y * width + x, cache = clear[phase]!;
    if (cache[i]) return cache[i] === 1;
    const mask = masks[phase]!;
    for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) {
      const p = (y + dy) * width + x + dx;
      if (mask.charCodeAt(p >> 3) & (1 << (p & 7))) { cache[i] = 2; return false; }
    }
    cache[i] = 1;
    return true;
  };
  const routeSafe = (start: NativePoint, at: number, route: NativePoint[]) => {
    let [x, y] = start;
    for (const [nx, ny] of route) {
      const dx = Math.sign(nx - x), dy = Math.sign(ny - y);
      for (let step = 0; step < pitch; step++) {
        x += dx;
        y += dy;
        if (!safe(x, y, ++at)) return false;
      }
    }
    return true;
  };
  const goalKey = key(view.goal), toExit = routes(view.goal);
  const ordered = new Map<string, LightRoute[]>();
  type Node = { point: NativePoint; at: number; depth: number; first: TimedStep | null };
  const queue: Node[] = [{ point: view.actor, at: elapsed, depth: 0, first: null }];
  const seen = new Set([key(view.actor) + '/' + (elapsed % period)]);
  for (let i = 0; i < queue.length && i < 4000; i++) {
    const { point, at, depth, first } = queue[i]!;
    if (depth >= remaining) continue;
    const id = key(point);
    let options = ordered.get(id);
    if (!options) {
      options = [...routes(point).values()].filter(route => route.route.length && toExit.has(key(route.point)))
        .sort((a, b) => toExit.get(key(a.point))!.route.length - toExit.get(key(b.point))!.route.length);
      ordered.set(id, options);
    }
    if (options[0] && key(options[0].point) === goalKey && routeSafe(point, at, options[0].route)) return first ?? options[0];
    const offer = (step: TimedStep, next: number) => {
      const state = key(step.point) + '/' + (next % period);
      if (seen.has(state)) return;
      seen.add(state);
      queue.push({ point: step.point, at: next, depth: depth + 1, first: first ?? step });
    };
    if (depth + 1 >= remaining) continue;
    for (const option of options) if (!equal(option.point, view.goal) && routeSafe(point, at, option.route)) {
      offer(option, at + option.route.length * pitch);
    }
    if (Array.from({ length: waitTicks }, (_, tick) => safe(point[0], point[1], at + tick + 1)).every(Boolean)) {
      offer({ point, route: [], wait: true }, at + waitTicks);
    }
  }
  return null;
}
