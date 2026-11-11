/** Pinned selected_rigid.mechanism measurements and full-mask displacement.
 * Geometry and collision/aperture eligibility are conditional library priors. */
import { geometricComponents, validateRows } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { SelectedRigidBody, SelectedRigidCell as Cell, SelectedRigidCommand,
  SelectedRigidGeometry, SelectedRigidPoses as Poses, SelectedRigidReceptacle, SelectedRigidScene as Scene } from './v6-selected-rigid-types.ts';

export const SELECTED_RIGID_DIRECTIONS: readonly Cell[] = Object.freeze([
  Object.freeze([0, -1] as const), Object.freeze([0, 1] as const),
  Object.freeze([-1, 0] as const), Object.freeze([1, 0] as const),
]);
const compareCell = (a: Cell, b: Cell): number => a[0] - b[0] || a[1] - b[1];
const cellKey = ([x, y]: Cell): string => `${x},${y}`;

function pixel(rows: NativeRows, x: number, y: number): number {
  const value = rows[y]?.[x];
  if (value === undefined) throw new RangeError('SelectedRigid measured geometry exceeds the current raster');
  return value;
}
function increment(counts: Map<number, number>, value: number): void {
  counts.set(value, (counts.get(value) ?? 0) + 1);
}
/** Counter.most_common(1) resolves a final tie by first encounter. Updating
 * a running winner while counting would choose wrongly for [a,b,b,a]. */
function mostCommon(counts: ReadonlyMap<number, number>): readonly [number, number] {
  let color: number | null = null, maximum = -1;
  for (const [value, count] of counts) if (count > maximum) { color = value; maximum = count; }
  if (color === null) throw new TypeError('SelectedRigid requires a nonempty measured inset');
  return [color, maximum];
}

export function selectedRigidScene(rows: NativeRows, old: Scene | null = null): Scene | null {
  validateRows(rows);
  const parts = geometricComponents(rows), backgroundCounts = new Map<number, number>();
  for (const row of rows) for (const value of row) increment(backgroundCounts, value);
  const background = mostCommon(backgroundCounts)[0];
  let geometry: SelectedRigidGeometry;
  if (old) geometry = old.geometry;
  else {
    const rectangles = parts.filter(c => {
      const side = Math.min(c.bbox[2] - c.bbox[0] + 1, c.bbox[3] - c.bbox[1] + 1);
      return c.rectangular && c.color !== background && side >= 4 && side <= 12;
    });
    const pitches = new Map<number, number>();
    for (const c of rectangles) increment(pitches, Math.min(c.bbox[2] - c.bbox[0] + 1, c.bbox[3] - c.bbox[1] + 1) + 2);
    const candidates: SelectedRigidGeometry[] = [];
    for (const [q, count] of pitches) {
      if (count < 4) continue;
      for (const c of parts) {
        const [left, top, right, bottom] = c.bbox, width = right - left - 3, height = bottom - top - 3;
        if (c.color === background || width < q * 3 || height < q * 3 || width % q !== 0 || height % q !== 0
          || c.area > 2 * (width + height)) continue;
        let topMatches = true;
        for (let x = left; x <= right; x++) if (pixel(rows, x, top) !== c.color) { topMatches = false; break; }
        if (topMatches) candidates.push({ q, origin: [left + 2, top + 2],
          size: [width / q, height / q], frame_color: c.color });
      }
    }
    // Do not deduplicate candidates: source ambiguity is an abstention.
    if (candidates.length !== 1) return null;
    geometry = candidates[0]!;
  }
  const { q } = geometry, [ox, oy] = geometry.origin, [width, height] = geometry.size;
  const fillColors = new Set<number>(), cells = new Map<number, Cell[]>();
  for (const c of parts) {
    const [left, top, right, bottom] = c.bbox;
    if (ox < left && left <= right && right < ox + width * q && oy < top && top <= bottom && bottom < oy + height * q
      && (left - ox - 1) % q === 0 && (top - oy - 1) % q === 0
      && (right - left + 3) % q === 0 && (bottom - top + 3) % q === 0) fillColors.add(c.color);
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const left = ox + x * q, top = oy + y * q, inside = new Map<number, number>();
    for (let yy = top + 1; yy < top + q - 1; yy++) for (let xx = left + 1; xx < left + q - 1; xx++) {
      increment(inside, pixel(rows, xx, yy));
    }
    const [color, count] = mostCommon(inside);
    // The source measures these corners but does not use them as a role rule.
    void [pixel(rows, left, top), pixel(rows, left + q - 1, top),
      pixel(rows, left, top + q - 1), pixel(rows, left + q - 1, top + q - 1)];
    if (fillColors.has(color) && count >= (q - 2) ** 2 * 0.55) {
      const occupied = cells.get(color) ?? []; occupied.push([x, y]); cells.set(color, occupied);
    }
  }
  if (cells.size < 3) return null;
  const bodies: SelectedRigidBody[] = [];
  for (const [color, occupied] of [...cells.entries()].sort(([a], [b]) => a - b)) {
    let x = Infinity, y = Infinity;
    for (const p of occupied) { x = Math.min(x, p[0]); y = Math.min(y, p[1]); }
    const mask: Cell[] = occupied.map(([a, b]) => [a - x, b - y]); mask.sort(compareCell);
    bodies.push({ key: String(color), color, position: [x, y], mask });
  }
  const receptacles: SelectedRigidReceptacle[] = [];
  for (const c of parts) {
    const [left, top, right, bottom] = c.bbox, color = c.color;
    if (top < oy + height * q || !cells.has(color) || (left - ox) % q !== 0 || (top - oy) % q !== 0
      || (right - left + 1) % q !== 0 || (bottom - top + 1) % q !== 0) continue;
    let borderMatches = true;
    for (let y = top; y <= bottom && borderMatches; y++) for (let x = left; x <= right; x++) {
      if ((x === left || x === right || y === top || y === bottom) && pixel(rows, x, y) !== color) {
        borderMatches = false; break;
      }
    }
    if (!borderMatches) continue;
    const body = bodies.find(b => b.color === color)!;
    let maskWidth = 0, maskHeight = 0;
    for (const [x, y] of body.mask) { maskWidth = Math.max(maskWidth, x + 1); maskHeight = Math.max(maskHeight, y + 1); }
    if (right - left + 1 === maskWidth * q && bottom - top + 1 === maskHeight * q) {
      receptacles.push({ key: body.key, position: [(left - ox) / q, (top - oy) / q], mask: body.mask });
    }
  }
  if (receptacles.length !== 1) return null;
  return { geometry, bodies, receptacle: receptacles[0]! };
}

export function selectedRigidPoint(scene: Scene, index: number): { x: number; y: number } {
  const body = scene.bodies[index];
  if (!body?.mask.length) throw new RangeError('SelectedRigid point needs a current occupied body mask');
  const [dx, dy] = body.mask[0]!, [x, y] = body.position, { q, origin: [ox, oy] } = scene.geometry;
  return { x: ox + (x + dx) * q + Math.floor(q / 2), y: oy + (y + dy) * q + Math.floor(q / 2) };
}
export function selectedRigidInputCandidates(rows: NativeRows, available: readonly string[]): SelectedRigidCommand[] {
  const scene = selectedRigidScene(rows);
  return scene && available.includes('ACTION6')
    ? scene.bodies.map((_, index) => ({ action_ref: 'ACTION6', data: selectedRigidPoint(scene, index) })) : [];
}
export function selectedRigidPoses(scene: Scene): Poses {
  return scene.bodies.map(body => [body.position[0], body.position[1]] as Cell);
}

/** The consumed V5 helper is _rotated(offset,0), hence the full offsets are
 * retained unchanged. No bounding-box fill or unobserved rotation is added.
 * tick is native scheduling metadata; it cannot change a successful result. */
export function selectedRigidMoved(scene: Scene, poses: Poses, index: number, direction: Cell,
  tick?: () => void): Poses {
  const body = scene.bodies[index], prior = poses[index];
  if (!body || !prior || poses.length !== scene.bodies.length) throw new RangeError('SelectedRigid pose population differs from its bodies');
  const [width, height] = scene.geometry.size, target = scene.receptacle;
  const at: Cell = [prior[0] + direction[0], prior[1] + direction[1]];
  const occupied = new Set<string>();
  for (let j = 0; j < poses.length; j++) if (j !== index) {
    const p = poses[j]!;
    for (const [x, y] of scene.bodies[j]!.mask) { occupied.add(cellKey([p[0] + x, p[1] + y])); tick?.(); }
  }
  const extra = new Set<string>();
  if (body.key === target.key) for (const [x, y] of target.mask) {
    extra.add(cellKey([target.position[0] + x, target.position[1] + y])); tick?.();
  }
  for (const [x, y] of body.mask) {
    const cell: Cell = [at[0] + x, at[1] + y], key = cellKey(cell); tick?.();
    if (occupied.has(key) || (!(cell[0] >= 0 && cell[0] < width && cell[1] >= 0 && cell[1] < height) && !extra.has(key))) return poses;
  }
  const result = [...poses]; result[index] = at; return result;
}
