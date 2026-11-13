/**
 * Public-raster reception geometry from the pinned V6 exposed_reception_access
 * and reception_lattice_projection sources (786dcf51ca57773d8e3a8948ce9ea3655e7baf8e).
 * The two lattice grammars, image regions and shape extents are source structural
 * priors. Colors, poses, receivers and orientation are measured on every frame.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity, sha256Bytes } from './v6-hash.ts';
import { geometricComponents, v6Canonical } from './v6-native-observer.ts';
import { programPythonFloat } from './v6-program-identity.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Point = [number, number];
type Box = readonly [number, number, number, number];
type Components = ReturnType<typeof geometricComponents>;
type Component = Components[number];
type PatternCell = { pos: Point; pattern: string };

const center = (box: Box): Point => [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
const positionOrder = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
const samePosition = (a: readonly number[], b: readonly number[]): boolean => a[0] === b[0] && a[1] === b[1];
function frequencies(values: Iterable<number>): Map<number, number> {
  const result = new Map<number, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}
/** Counter.most_common ties keep their first encounter, including core pixels. */
function mostCommon(counts: Map<number, number>): [number, number] {
  let selected: [number, number] | undefined;
  for (const entry of counts) if (!selected || entry[1] > selected[1]) selected = entry;
  return selected!;
}
function enclosingBars(parts: Components): [Component, Component] | null {
  const bars = parts.filter(part => part.bbox[1] > 4 && part.bbox[3] < 45
    && part.bbox[1] === part.bbox[3] && part.bbox[2] - part.bbox[0] > 24
    && part.area === part.bbox[2] - part.bbox[0] + 1);
  let selected: [Component, Component] | null = null;
  // Source max is stable at equal keys. Area and horizontal extent differ by
  // exactly one for admitted bars, so both source grammars select the same pair.
  for (const a of bars) for (const b of bars) {
    if (a.color !== b.color || a.bbox[0] !== b.bbox[0] || a.bbox[2] !== b.bbox[2]
      || b.bbox[1] - a.bbox[1] < 15) continue;
    if (!selected || a.area > selected[0].area || a.area === selected[0].area
      && b.bbox[1] - a.bbox[1] > selected[1].bbox[1] - selected[0].bbox[1]) selected = [a, b];
  }
  return selected;
}
function dialControls(parts: Components): R[] | null {
  const dial = parts.filter(part => part.bbox[1] >= 47 && part.bbox[0] >= 45
    && part.bbox[2] - part.bbox[0] === 2 && part.bbox[3] - part.bbox[1] === 2 && part.area === 8);
  if (dial.length !== 8) return null;
  const midpoint: Point = [0, 0];
  for (const part of dial) {
    const point = center(part.bbox);
    midpoint[0] += point[0]; midpoint[1] += point[1];
  }
  midpoint[0] /= 8; midpoint[1] /= 8;
  const dominant = mostCommon(frequencies(dial.map(part => part.color)))[0];
  const active = dial.filter(part => part.color !== dominant);
  if (active.length !== 1) return null;
  return dial.map(part => {
    const point = center(part.bbox);
    return { point: point.map(Math.trunc), vector: [point[0] - midpoint[0], point[1] - midpoint[1]], active: part === active[0] };
  });
}
function finalScene(origin: Point, pitch: number, size: Point, actor: Point, actorColor: number,
  bodies: R[], slots: R[], patterns: PatternCell[], wallPatterns: Set<string>, parts: Components,
  filterWallBodies: boolean): R | null {
  const walls = patterns.filter(cell => wallPatterns.has(cell.pattern)).map(cell => cell.pos);
  if (filterWallBodies) bodies = bodies.filter(body => !walls.some(pos => samePosition(pos, body.pos)));
  if (!slots.length || slots.length !== bodies.length) return null;
  const controls = dialControls(parts);
  if (!controls) return null;
  bodies.sort((a, b) => positionOrder(a.pos, b.pos));
  slots.sort((a, b) => positionOrder(a.pos, b.pos));
  const scene: R = { origin, pitch, size, actor, actor_color: actorColor, bodies, slots, walls,
    dial: controls, orientation: [...controls.find(control => control.active)!.vector] };
  scene.layout = identity([origin, pitch, size, walls, slots]);
  return structuredClone(scene);
}
function largeScene(rows: NativeRows, parts: Components): R | null {
  const pair = enclosingBars(parts);
  if (!pair) return null;
  const [top, bottom] = pair, [left, yt, right] = top.bbox, yb = bottom.bbox[1];
  const inside = (part: Component): boolean => left < part.bbox[0] && part.bbox[2] < right
    && yt < part.bbox[1] && part.bbox[3] < yb;
  const shape = (part: Component, missing: number): boolean => inside(part)
    && part.bbox[2] - part.bbox[0] === part.bbox[3] - part.bbox[1]
    && 2 <= part.bbox[2] - part.bbox[0] + 1 && part.bbox[2] - part.bbox[0] + 1 <= 3
    && part.area === (part.bbox[2] - part.bbox[0] + 1) ** 2 - missing;
  const boxes = parts.filter(part => shape(part, 1)), actorShapes = parts.filter(part => shape(part, 2));
  if (!boxes.length && !actorShapes.length) return null;
  const side = mostCommon(frequencies([...boxes, ...actorShapes].map(part => part.bbox[2] - part.bbox[0] + 1)))[0];
  const pitch = side + 2;
  if ((right - left + 1) % pitch || (yb - yt) % pitch) return null;
  const width = (right - left + 1) / pitch, height = (yb - yt) / pitch + 1;
  const actors = parts.filter(part => inside(part) && part.bbox[2] - part.bbox[0] + 1 === side
    && part.bbox[3] - part.bbox[1] + 1 === side && part.area === side * side - 2);
  if (actors.length !== 1) return null;
  const backgroundPixels: number[] = [];
  for (const row of rows.slice(yt, yb + pitch)) backgroundPixels.push(...row.slice(left, right + 1));
  const background = mostCommon(frequencies(backgroundPixels))[0];
  const slots: R[] = [], bodies: R[] = [], patterns: PatternCell[] = [], wallPatterns = new Set<string>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = left + x * pitch, py = yt + y * pitch;
    const patch = rows.slice(py, py + pitch).map(row => row.slice(px, px + pitch));
    if (patch.length !== pitch) return null;
    const pattern = identity(patch); patterns.push({ pos: [x, y], pattern });
    if (y === 0 || y === height - 1) wallPatterns.add(pattern);
    const color = patch[0]![0]!;
    if (color !== background && patch[0]![pitch - 1] === color && patch[pitch - 1]![0] === color
      && patch[pitch - 1]![pitch - 1] === color && patch[0]![1] !== color && patch[pitch - 1]![1] !== color) slots.push({ pos: [x, y], color });
    const core = patch.slice(1, -1).flatMap(row => row.slice(1, -1)), counts = frequencies(core);
    if (counts.size === 2) {
      const [bodyColor, count] = mostCommon(counts);
      if (count === side * side - 1 && bodyColor !== background && core[Math.floor(side / 2) * side + Math.floor(side / 2)] !== bodyColor) bodies.push({ pos: [x, y], color: bodyColor });
    }
  }
  const actorCenter = center(actors[0]!.bbox);
  const actor: Point = [Math.floor((actorCenter[0] - left) / pitch), Math.floor((actorCenter[1] - yt) / pitch)];
  return finalScene([left, yt], pitch, [width, height], actor, actors[0]!.color, bodies, slots, patterns, wallPatterns, parts, false);
}
function smallScene(rows: NativeRows, parts: Components): R | null {
  const pair = enclosingBars(parts);
  if (!pair) return null;
  const [top, bottom] = pair, [left, yt, right] = top.bbox, yb = bottom.bbox[1];
  const strips = parts.filter(part => part.color === top.color && part.bbox[1] === part.bbox[3]
    && part.bbox[0] >= left && part.bbox[2] <= right && yt < part.bbox[1] && part.bbox[1] < yb
    && part.area === part.bbox[2] - part.bbox[0] + 1 && 3 <= part.area && part.area <= 8).map(part => part.area);
  if (!strips.length) return null;
  const pitch = mostCommon(frequencies(strips))[0], side = pitch - 2;
  if (side !== 2 || (right - left + 1) % pitch || (yb - yt) % pitch) return null;
  const width = (right - left + 1) / pitch, height = (yb - yt) / pitch + 1;
  const patterns: PatternCell[] = [], wallPatterns = new Set<string>(), slots: R[] = [], bodies: R[] = [], actors: R[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = left + x * pitch, py = yt + y * pitch;
    const patch = rows.slice(py, py + pitch).map(row => row.slice(px, px + pitch));
    if (patch.length !== pitch || patch.some(row => row.length !== pitch)) return null;
    const pattern = identity(patch); patterns.push({ pos: [x, y], pattern });
    if (y === 0 || y === height - 1) wallPatterns.add(pattern);
    const color = patch[0]![0]!;
    if (patch[0]![pitch - 1] === color && patch[pitch - 1]![0] === color && patch[pitch - 1]![pitch - 1] === color
      && patch[0]![1] !== color && patch[pitch - 1]![1] !== color) slots.push({ pos: [x, y], color });
    const core = patch.slice(1, -1).flatMap(row => row.slice(1, -1)), counts = frequencies(core);
    if (counts.size === 3) {
      const [actorColor, count] = mostCommon(counts);
      if (count === side * side - 2) actors.push({ pos: [x, y], color: actorColor });
    }
    if (counts.size === 1) {
      const bodyColor = core[0]!;
      const members = parts.filter(part => part.color === bodyColor && part.bbox[0] <= px + 1 && part.bbox[1] <= py + 1
        && part.bbox[2] >= px + side && part.bbox[3] >= py + side && part.area <= side * side + side);
      if (members.length === 1) bodies.push({ pos: [x, y], color: bodyColor });
    } else if (counts.size === 2) {
      const [bodyColor, count] = mostCommon(counts);
      if (count === side * side - 1 && slots.some(slot => samePosition(slot.pos, [x, y]) && slot.color === bodyColor)) {
        const members = parts.filter(part => part.color === bodyColor && part.bbox[0] === px + 1 && part.bbox[1] === py + 1
          && part.bbox[2] === px + side && part.bbox[3] === py + side && part.area === count);
        if (members.length === 1) bodies.push({ pos: [x, y], color: bodyColor, underlay: 'receiver_overlap_candidate' });
      }
    }
  }
  if (actors.length !== 1) return null;
  return finalScene([left, yt], pitch, [width, height], actors[0]!.pos, actors[0]!.color, bodies, slots, patterns, wallPatterns, parts, true);
}

export function measureLargeExposedReception(rows: NativeRows): R | null { return largeScene(rows, geometricComponents(rows)); }
export function measureSmallExposedReception(rows: NativeRows): R | null { return smallScene(rows, geometricComponents(rows)); }
export function measureExposedReception(rows: NativeRows): R | null {
  const parts = geometricComponents(rows);
  return largeScene(rows, parts) ?? smallScene(rows, parts);
}
export function exposedReceptionProjection(scene: R): R {
  return structuredClone({ actor: scene.actor, bodies: scene.bodies.map((body: R) => [body.pos, body.color])
    .sort((a: any[], b: any[]) => positionOrder(a[0], b[0]) || a[1] - b[1]) });
}
/** Append this source layer's dial points after inherited controls. Dict-style
 * replacement keeps the first occurrence's insertion position when deduplicating.
 */
export function exposedReceptionInputCandidates(rows: NativeRows, available: readonly string[], inherited: readonly R[] = []): R[] {
  const values = [...inherited], scene = measureExposedReception(rows);
  if (scene && available.includes('ACTION6')) for (const control of scene.dial) values.push({ action_ref: 'ACTION6', data: { x: control.point[0], y: control.point[1] } });
  return [...new Map(values.map(value => [identity(value), value])).values()];
}

const floatPoint = (value: unknown): string => Array.isArray(value) ? `[${value.map(programPythonFloat).join(',')}]` : v6Canonical(value);
function sceneCanonical(scene: R): string {
  if (scene === null || typeof scene !== 'object' || Array.isArray(scene)) return v6Canonical(scene);
  return `{${Object.keys(scene).sort(compareUnicode).map(key => {
    let value: string;
    if (key === 'orientation') value = floatPoint(scene[key]);
    else if (key === 'dial' && Array.isArray(scene[key])) value = `[${scene.dial.map((control: R) => `{${Object.keys(control).sort(compareUnicode)
      .map(field => `${v6Canonical(field)}:${field === 'vector' ? floatPoint(control[field]) : v6Canonical(control[field])}`).join(',')}}`).join(',')}]`;
    else value = v6Canonical(scene[key]);
    return `${v6Canonical(key)}:${value}`;
  }).join(',')}}`;
}
/** The source /2 centers and /8 dial midpoint create Python floats, including
 * integral vectors. Their schema-specific spelling belongs to the enclosing
 * plan digest; ordinary native JSON and retained acquisition state stay unchanged.
 */
export function exposedReceptionPlanIdentity(plan: R): string {
  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) return identity(plan);
  const encoded = `{${Object.keys(plan).sort(compareUnicode).map(key => `${v6Canonical(key)}:${key === 'scene'
    ? sceneCanonical(plan.scene) : v6Canonical(plan[key])}`).join(',')}}`;
  return sha256Bytes(new TextEncoder().encode(encoded));
}
