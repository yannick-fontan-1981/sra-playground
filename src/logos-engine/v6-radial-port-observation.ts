/** Palette-neutral radial observations from pinned V6 radial_ports_observation.py. */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { PointSet, type Point } from './v6-point-set.ts';
import { portView, type PortPose } from './v6-port-assembly.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const DIRECTIONS: readonly Point[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const modulo = (a: number, n: number) => (a % n + n) % n;

export function rotateRadialPorts(ports: readonly number[], turn: number): number[] {
  return ports.map(direction => modulo(direction + turn, 4)).sort((a, b) => a - b);
}

/** Reproject at measured supports; this does not assign an input or goal role. */
export function radialAtGeometry(rows: NativeRows, geometry: R): R | null {
  const [x, y] = geometry.origin, pitch = geometry.pitch, n = geometry.shape[0], substrate = geometry.substrate;
  const cells: R[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = x + i * pitch + Math.floor(pitch / 2), cy = y + j * pitch + Math.floor(pitch / 2);
    if (rows[cy]![cx] === substrate) return null;
    const ports: number[] = [];
    for (const [direction, [dx, dy]] of DIRECTIONS.entries()) {
      const ray: number[] = [];
      for (let k = Math.max(1, Math.floor(pitch / 4)); k < Math.floor(pitch / 2); k++) ray.push(rows[cy + dy * k]![cx + dx * k]!);
      if (ray.length && ray.every(value => value !== substrate)) ports.push(direction);
    }
    if (!ports.length || ports.length > 3) return null;
    cells.push({ index: j * n + i, grid: [i, j], point: [cx, cy], ports,
      bbox: [x + i * pitch, y + j * pitch, x + (i + 1) * pitch, y + (j + 1) * pitch] });
  }
  return { ...geometry, cells };
}

export function measureRadialPorts(rows: NativeRows): R | null {
  const candidates: R[] = [];
  for (const part of geometricComponents(rows)) {
    const [x, y, right, bottom] = part.bbox, span = right - x;
    if (span !== bottom - y || span < 12) continue;
    const border = part.color, rim: boolean[] = [];
    for (let u = x; u <= right; u++) rim.push(rows[y]![u] === border);
    for (let u = x; u <= right; u++) rim.push(rows[bottom]![u] === border);
    for (let v = y; v <= bottom; v++) rim.push(rows[v]![x] === border);
    for (let v = y; v <= bottom; v++) rim.push(rows[v]![right] === border);
    if (rim.filter(Boolean).length < 0.75 * rim.length) continue;
    const counts = new Map<number, number>();
    for (let v = y + 1; v < bottom; v++) for (let u = x + 1; u < right; u++) {
      const value = rows[v]![u]!; counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    // Python Counter.most_common preserves encounter order on tied counts.
    const substrate = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
    if (substrate === border) continue;
    for (let n = 2; n <= Math.floor(span / 4); n++) {
      if (span % n || Math.floor(span / n) % 2) continue;
      const geometry = { origin: [x, y], shape: [n, n], pitch: Math.floor(span / n), border, substrate };
      const scene = radialAtGeometry(rows, geometry);
      if (scene) candidates.push(scene);
    }
  }
  if (candidates.length !== 1) return null;
  const scene = candidates[0]!;
  scene.geometry_ref = identity(Object.fromEntries(Object.entries(scene).filter(([key]) => key !== 'cells')));
  return scene;
}

/** Existing finite port assembly receives only measured cells and four poses. */
export function radialAssemblyModel(scene: R): readonly [R, readonly PortPose[]] {
  const bodies: R[] = [], domains: PortPose[][] = [], current: PortPose[] = [];
  for (const cell of scene.cells as R[]) {
    const ports = new PointSet((cell.ports as number[]).map(direction => DIRECTIONS[direction]!));
    const material = ports.union(new PointSet([[0, 0]]));
    bodies.push({ material, ports, known: true });
    const [i, j] = cell.grid, poses: PortPose[] = [];
    for (let turn = 0; turn < 4; turn++) {
      const center = portView(material, ports, turn)[2].get('0,0')!;
      poses.push([turn, 2 * i + 1 - center[0], 2 * j + 1 - center[1]]);
    }
    domains.push(poses); current.push(poses[0]!);
  }
  const n = scene.shape[0];
  return [{ bodies, pose_domains: domains, unit: 1, phase: [0, 1], width: 2 * n + 1, height: 2 * n + 2,
    require_connected: true, require_acyclic: true }, current];
}

export function selectedRadialOccurrence(rows: NativeRows, scene: R): R | null {
  const hits: R[] = [];
  for (const cell of scene.cells as R[]) {
    const [left, top, right, bottom] = cell.bbox, l = left + 1, t = top + 1, r = right - 1, b = bottom - 1;
    const rim: number[] = [];
    for (let u = l; u <= r; u++) rim.push(rows[t]![u]!);
    for (let u = l; u <= r; u++) rim.push(rows[b]![u]!);
    for (let v = t; v <= b; v++) rim.push(rows[v]![l]!);
    for (let v = t; v <= b; v++) rim.push(rows[v]![r]!);
    if (new Set(rim).size === 1 && ![scene.substrate, scene.border].includes(rim[0])) {
      hits.push({ index: cell.index, frame_palette: rim[0] });
    }
  }
  return hits.length === 1 ? hits[0]! : null;
}
