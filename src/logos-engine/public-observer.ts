import { assertPortableNumber, digest, immutableJson, stringValue } from './canonical.ts';
import type { PublicObservation } from './v7-runtime.ts';

/** The public fields admitted by V7's pixel observer; no engine internals. */
export interface PublicFrameInput {
  readonly frame: readonly (readonly number[])[];
  readonly availableActionIds: readonly number[];
  readonly state: string;
  readonly levelsCompleted: number;
}

export interface PublicObservationIdentity {
  readonly id: string;
  readonly scope: string;
}

export const MAX_PUBLIC_FRAME_CELLS = 4096;

interface ComponentCounts {
  readonly monochromeComponents: number;
  readonly paletteCount: number;
  readonly rectangularComponents: number;
}

/**
 * The three counts used by V7 public_observer.perceive, measured from the same
 * four-connected monochrome components as V6 geometric_observer.components.
 * Background pixels are included. No colour, shape or command is assigned a
 * game-specific role, and components do not acquire identities across frames.
 */
function componentCounts(rows: readonly (readonly number[])[]): ComponentCounts {
  const height = rows.length;
  const width = rows[0]!.length;
  const visited = new Uint8Array(width * height);
  const palette = new Set<number>();
  let monochromeComponents = 0;
  let rectangularComponents = 0;

  for (let root = 0; root < visited.length; root += 1) {
    if (visited[root]) continue;
    const rootX = root % width;
    const rootY = Math.floor(root / width);
    const colour = rows[rootY]![rootX]!;
    palette.add(colour);
    monochromeComponents += 1;
    visited[root] = 1;
    const pending = [root];
    let area = 0;
    let left = rootX, right = rootX, top = rootY, bottom = rootY;

    while (pending.length) {
      const index = pending.pop()!;
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      // Same four-neighbour domain as the Python observer. Diagonals do not join.
      for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nextX === undefined || nextY === undefined || nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const nextIndex = nextY * width + nextX;
        if (!visited[nextIndex] && rows[nextY]![nextX] === colour) {
          visited[nextIndex] = 1;
          pending.push(nextIndex);
        }
      }
    }
    if (area === (right - left + 1) * (bottom - top + 1)) rectangularComponents += 1;
  }
  return { monochromeComponents, paletteCount: palette.size, rectangularComponents };
}

/**
 * Project a current public frame into exactly the eight measured facts used by
 * Python V7. The host owns session/sequence identity; it must use a new scope
 * after a discontinuity and never label a manual action as an agent action.
 *
 * Inputs are detached before the first await. Extra engine fields are ignored,
 * never enumerated or spread into the reasoning observation.
 */
export async function perceiveFrame(
  input: PublicFrameInput,
  context: PublicObservationIdentity,
): Promise<PublicObservation> {
  const id = stringValue(context.id, 'public observation id');
  const scope = stringValue(context.scope, 'public observation scope');
  const publicState = stringValue(input.state, 'public state');
  if (!id || !scope || !publicState) throw new TypeError('Public observation identity, scope and state must be nonempty');

  const levelsCompleted = input.levelsCompleted;
  if (typeof levelsCompleted !== 'number') throw new TypeError('Completed levels must be a nonnegative integer');
  assertPortableNumber(levelsCompleted);
  if (levelsCompleted < 0) throw new RangeError('Completed levels must be a nonnegative integer');

  const rawRows = immutableJson(input.frame);
  if (!Array.isArray(rawRows) || !rawRows.length || !Array.isArray(rawRows[0]) || !rawRows[0].length) {
    throw new TypeError('Public frame must be a nonempty rectangular palette grid');
  }
  const height = rawRows.length;
  const width = rawRows[0].length;
  if (height * width > MAX_PUBLIC_FRAME_CELLS) throw new RangeError('Public frame exceeds the 4096-pixel observation budget');
  for (const row of rawRows) {
    if (!Array.isArray(row) || row.length !== width) throw new TypeError('Public frame rows must have the same width');
    for (const value of row) {
      if (typeof value !== 'number' || !Number.isInteger(value) || Object.is(value, -0) || value < 0 || value >= 16) {
        throw new TypeError('Public pixels must be integer palette indices from 0 to 15');
      }
    }
  }
  const rows = rawRows as readonly (readonly number[])[];

  const rawActions = immutableJson(input.availableActionIds);
  if (!Array.isArray(rawActions) || rawActions.length > 8 || new Set(rawActions).size !== rawActions.length
      || rawActions.some(action => typeof action !== 'number' || !Number.isInteger(action) || Object.is(action, -0) || action < 0 || action > 7)) {
    throw new TypeError('Public action IDs must be unique integers from 0 to 7');
  }
  const actions = rawActions.map(action => `ACTION${action}`);
  const measured = componentCounts(rows);
  const frameSha256 = await digest(rows);

  return immutableJson({
    id,
    scope,
    values: {
      frame_sha256: frameSha256,
      width,
      height,
      monochrome_components: measured.monochromeComponents,
      palette_count: measured.paletteCount,
      rectangular_components: measured.rectangularComponents,
      public_state: publicState,
      levels_completed: levelsCompleted,
    },
    actions,
  }) as PublicObservation;
}
