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
const MAX_PALETTE_INDEX = 15;
const TRANSITION_DOMAIN = 16 * 16;

function validateObservationShape(observation: AgentObservation, label: string): Uint8Array {
  if (observation.image.width !== WIDTH || observation.image.height !== HEIGHT) {
    throw new RangeError(`${label} observation must be 64x64`);
  }
  if (observation.image.pixelFormat !== 'palette-index-u8') {
    throw new TypeError(`${label} observation has unsupported pixel format`);
  }
  if (!(observation.image.pixels instanceof Uint8Array) || observation.image.pixels.length !== PIXELS) {
    throw new RangeError(`${label} observation must contain exactly ${PIXELS} pixels`);
  }
  return observation.image.pixels;
}

function validatePalette(pixels: Uint8Array, label: string): void {
  for (let index = 0; index < PIXELS; index += 1) {
    if (pixels[index]! > MAX_PALETTE_INDEX) {
      throw new RangeError(`${label} observation contains a palette index above 15`);
    }
  }
}

function transitionSignature(transitions: readonly PixelTransitionCount[]): string {
  return transitions.map(item => `${item.from}>${item.to}x${item.count}`).join(',');
}

export function comparePublicObservations(
  beforeObservation: AgentObservation,
  afterObservation: AgentObservation,
): PublicObservationDelta {
  const before = validateObservationShape(beforeObservation, 'before');
  validatePalette(before, 'before');
  const after = validateObservationShape(afterObservation, 'after');

  // A fixed 64x64 mask replaces Set<number>. It preserves the exact public
  // 4-connected measurement while avoiding per-pixel object allocation.
  const changed = new Uint8Array(PIXELS);
  let changedPixelCount = 0;
  for (let index = 0; index < PIXELS; index += 1) {
    const to = after[index]!;
    if (to > MAX_PALETTE_INDEX) {
      throw new RangeError('after observation contains a palette index above 15');
    }
    if (before[index] !== to) {
      changed[index] = 1;
      changedPixelCount += 1;
    }
  }

  if (beforeObservation.sessionId !== afterObservation.sessionId) {
    throw new Error('public observation delta requires the same session');
  }
  if (afterObservation.sequence <= beforeObservation.sequence) {
    throw new Error('after observation sequence must be greater than before sequence');
  }

  if (changedPixelCount === 0) {
    return {
      sessionId: beforeObservation.sessionId,
      beforeSequence: beforeObservation.sequence,
      afterSequence: afterObservation.sequence,
      changedPixelCount: 0,
      regions: [],
      effectKey: 'no-change',
    };
  }

  // All work buffers are strictly bounded by the public 64x64 frame and the
  // 16x16 palette-transition domain. They remain local so concurrent calls
  // cannot share mutable measurement state.
  const queue = new Int32Array(PIXELS);
  const transitionCounts = new Uint16Array(TRANSITION_DOMAIN);
  const touchedTransitionKeys = new Uint16Array(TRANSITION_DOMAIN);
  const regions: PublicDeltaRegion[] = [];

  for (let start = 0; start < PIXELS; start += 1) {
    if (changed[start] === 0) continue;

    let head = 0;
    let tail = 0;
    let touchedTransitionCount = 0;
    let pixelCount = 0;
    let minX = WIDTH;
    let minY = HEIGHT;
    let maxX = -1;
    let maxY = -1;

    changed[start] = 0;
    queue[tail] = start;
    tail += 1;

    while (head < tail) {
      const index = queue[head]!;
      head += 1;
      const x = index & (WIDTH - 1);
      const y = index >>> 6;
      pixelCount += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      const transitionKey = (before[index]! << 4) | after[index]!;
      if (transitionCounts[transitionKey] === 0) {
        touchedTransitionKeys[touchedTransitionCount] = transitionKey;
        touchedTransitionCount += 1;
      }
      transitionCounts[transitionKey] = transitionCounts[transitionKey]! + 1;

      let neighbor: number;
      if (y > 0) {
        neighbor = index - WIDTH;
        if (changed[neighbor] !== 0) {
          changed[neighbor] = 0;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
      if (y + 1 < HEIGHT) {
        neighbor = index + WIDTH;
        if (changed[neighbor] !== 0) {
          changed[neighbor] = 0;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
      if (x > 0) {
        neighbor = index - 1;
        if (changed[neighbor] !== 0) {
          changed[neighbor] = 0;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
      if (x + 1 < WIDTH) {
        neighbor = index + 1;
        if (changed[neighbor] !== 0) {
          changed[neighbor] = 0;
          queue[tail] = neighbor;
          tail += 1;
        }
      }
    }

    // Iterating the bounded transition domain yields the same from/to ordering
    // as the previous Map + sort implementation, without allocating map keys.
    const transitions: PixelTransitionCount[] = [];
    for (let transitionKey = 0; transitionKey < TRANSITION_DOMAIN; transitionKey += 1) {
      const count = transitionCounts[transitionKey]!;
      if (count === 0) continue;
      transitions.push({
        from: transitionKey >>> 4,
        to: transitionKey & MAX_PALETTE_INDEX,
        count,
      });
    }
    for (let index = 0; index < touchedTransitionCount; index += 1) {
      transitionCounts[touchedTransitionKeys[index]!] = 0;
    }

    const signature = transitionSignature(transitions);
    regions.push({
      ref: `delta:${minX},${minY}-${maxX},${maxY}:${pixelCount}:${signature}`,
      minX,
      minY,
      maxX,
      maxY,
      pixelCount,
      transitions,
    });
  }

  regions.sort((a, b) =>
    a.minY - b.minY
    || a.minX - b.minX
    || a.maxY - b.maxY
    || a.maxX - b.maxX
    || a.pixelCount - b.pixelCount
    || a.ref.localeCompare(b.ref));

  return {
    sessionId: beforeObservation.sessionId,
    beforeSequence: beforeObservation.sequence,
    afterSequence: afterObservation.sequence,
    changedPixelCount,
    regions,
    effectKey: `delta-effect:${regions.map(region => region.ref).join('|')}`,
  };
}
