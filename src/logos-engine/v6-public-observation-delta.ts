import type { AgentObservation } from '../runtime/contracts.ts';

export interface PixelTransitionCount {
  from: number;
  to: number;
  count: number;
}

export interface PublicDeltaRegion {
  ref: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixelCount: number;
  transitions: PixelTransitionCount[];
}

export interface PublicObservationDelta {
  sessionId: string;
  beforeSequence: number;
  afterSequence: number;
  changedPixelCount: number;
  regions: PublicDeltaRegion[];
  effectKey: string;
}

const WIDTH = 64;
const HEIGHT = 64;
const PIXELS = WIDTH * HEIGHT;

function validateObservation(observation: AgentObservation, label: string): void {
  if (observation.image.width !== WIDTH || observation.image.height !== HEIGHT) {
    throw new RangeError(`${label} observation must be 64x64`);
  }
  if (observation.image.pixelFormat !== 'palette-index-u8') {
    throw new TypeError(`${label} observation has unsupported pixel format`);
  }
  if (!(observation.image.pixels instanceof Uint8Array) || observation.image.pixels.length !== PIXELS) {
    throw new RangeError(`${label} observation must contain exactly ${PIXELS} pixels`);
  }
  for (const value of observation.image.pixels) {
    if (value > 15) throw new RangeError(`${label} observation contains a palette index above 15`);
  }
}

function transitionSignature(transitions: readonly PixelTransitionCount[]): string {
  return transitions.map(item => `${item.from}>${item.to}x${item.count}`).join(',');
}

function buildRegion(
  indices: readonly number[],
  before: Uint8Array,
  after: Uint8Array,
): PublicDeltaRegion {
  let minX = WIDTH;
  let minY = HEIGHT;
  let maxX = -1;
  let maxY = -1;
  const counts = new Map<string, PixelTransitionCount>();

  for (const index of indices) {
    const y = Math.floor(index / WIDTH);
    const x = index % WIDTH;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    const from = before[index]!;
    const to = after[index]!;
    const key = `${from}:${to}`;
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { from, to, count: 1 });
  }

  const transitions = [...counts.values()].sort((a, b) => a.from - b.from || a.to - b.to);
  const pixelCount = indices.length;
  const signature = transitionSignature(transitions);
  return {
    ref: `delta:${minX},${minY}-${maxX},${maxY}:${pixelCount}:${signature}`,
    minX, minY, maxX, maxY, pixelCount, transitions,
  };
}

export function comparePublicObservations(
  beforeObservation: AgentObservation,
  afterObservation: AgentObservation,
): PublicObservationDelta {
  validateObservation(beforeObservation, 'before');
  validateObservation(afterObservation, 'after');
  if (beforeObservation.sessionId !== afterObservation.sessionId) {
    throw new Error('public observation delta requires the same session');
  }
  if (afterObservation.sequence <= beforeObservation.sequence) {
    throw new Error('after observation sequence must be greater than before sequence');
  }

  const before = beforeObservation.image.pixels;
  const after = afterObservation.image.pixels;
  const changed = new Set<number>();
  for (let index = 0; index < PIXELS; index += 1) {
    if (before[index] !== after[index]) changed.add(index);
  }

  const regions: PublicDeltaRegion[] = [];
  while (changed.size > 0) {
    const start = changed.values().next().value as number;
    changed.delete(start);
    const queue = [start];
    const component: number[] = [];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!;
      component.push(index);
      const y = Math.floor(index / WIDTH);
      const x = index % WIDTH;
      const neighbors = [
        y > 0 ? index - WIDTH : -1,
        y + 1 < HEIGHT ? index + WIDTH : -1,
        x > 0 ? index - 1 : -1,
        x + 1 < WIDTH ? index + 1 : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && changed.delete(neighbor)) queue.push(neighbor);
      }
    }
    component.sort((a, b) => a - b);
    regions.push(buildRegion(component, before, after));
  }

  regions.sort((a, b) =>
    a.minY - b.minY
    || a.minX - b.minX
    || a.maxY - b.maxY
    || a.maxX - b.maxX
    || a.pixelCount - b.pixelCount
    || a.ref.localeCompare(b.ref));

  const changedPixelCount = regions.reduce((sum, region) => sum + region.pixelCount, 0);
  const effectKey = regions.length === 0 ? 'no-change' : `delta-effect:${regions.map(region => region.ref).join('|')}`;
  return {
    sessionId: beforeObservation.sessionId,
    beforeSequence: beforeObservation.sequence,
    afterSequence: afterObservation.sequence,
    changedPixelCount,
    regions,
    effectKey,
  };
}
