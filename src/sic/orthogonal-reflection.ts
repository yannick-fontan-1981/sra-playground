import { reflectCoverPoints, shiftReflectionPoints } from '../logos-engine/v6-reflected-cover.ts';
import { reflectionConnectedSets } from '../logos-engine/v6-reflection-audit.ts';
import { supportKey, supportPoint } from '../logos-engine/v6-support-measurements.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Dimension = 0 | 1;
type Focus = Dimension | 'piece';
type Lattice = { pitch: number; phase: NativePoint; size: NativePoint };
type Band = { ink: number; start: number; end: number };
export type OrthogonalWorld = Lattice & {
  axes: NativePoint; axisInk: number; background: number; direct: number; image: number; marker: number;
  target: number; body: string[]; targets: string[]; focus: Focus;
};
type Materials = Pick<OrthogonalWorld, 'pitch' | 'direct' | 'image' | 'marker'>;
type Cell = { x: number; y: number; key: string; ink: number; marker: number | null };
const dimensions = [0, 1] as const;

function bands(rows: NativeRows, dim: Dimension): Band[] {
  const sizes = [rows[0]!.length, rows.length] as const;
  const lines: Band[] = [];
  for (let p = 0; p < sizes[dim]; p++) {
    const counts = new Map<number, number>();
    for (let q = 0; q < sizes[1 - dim]!; q++) {
      const ink = dim === 0 ? rows[q]![p]! : rows[p]![q]!;
      counts.set(ink, (counts.get(ink) ?? 0) + 1);
    }
    for (const [ink, count] of counts) {
      if (count < sizes[1 - dim]! / 2) continue;
      const previous = lines.find(line => line.ink === ink && line.end === p - 1);
      if (previous) previous.end = p;
      else lines.push({ ink, start: p, end: p });
    }
  }
  return lines;
}

function cells(rows: NativeRows, { pitch, phase, size }: Lattice): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < size[1]; y++) {
    for (let x = 0; x < size[0]; x++) {
      const counts = new Map<number, number>();
      for (let j = 0; j < pitch; j++) {
        for (let i = 0; i < pitch; i++) {
          const ink = rows[phase[1] + y * pitch + j]![phase[0] + x * pitch + i]!;
          counts.set(ink, (counts.get(ink) ?? 0) + 1);
        }
      }
      const [[ink, count], minor] = [...counts].sort((a, b) => b[1] - a[1]) as [[number, number], [number, number]?];
      out.push({ x, y, key: supportKey([x, y]), ink, marker: count === pitch * pitch - 1 ? minor?.[0] ?? null : null });
    }
  }
  return out;
}

function focusOf(world: OrthogonalWorld, measured: Cell[]): Focus | null {
  const body = new Set(world.body);
  const owners = new Set<Focus>();
  for (const { x, y, key, ink, marker } of measured) {
    if (marker !== world.marker) continue;
    if (ink === world.direct && body.has(key)) owners.add('piece');
    if (ink === world.axisInk) {
      if (x === world.axes[0] && y !== world.axes[1]) owners.add(0);
      if (y === world.axes[1] && x !== world.axes[0]) owners.add(1);
    }
  }
  return owners.size === 1 ? [...owners][0]! : null;
}

export function measureOrthogonalReflection(rows: NativeRows, materials: Materials): OrthogonalWorld | null {
  const { pitch, direct, image, marker } = materials;
  if (pitch < 2 || pitch > 8 || !rows.length || !rows[0]?.length) return null;
  const wholeBands = (dim: Dimension) => bands(rows, dim).filter(b => b.end - b.start + 1 === pitch);
  const axesCandidates = wholeBands(0).flatMap(x => wholeBands(1).flatMap(y => x.ink === y.ink ? [[x, y] as const] : []));
  if (axesCandidates.length !== 1) return null;
  const [xAxis, yAxis] = axesCandidates[0]!;
  const axisInk = xAxis.ink;
  if ([direct, image, marker].includes(axisInk)) return null;
  const phase = [xAxis.start % pitch, yAxis.start % pitch] as const;
  const size = [Math.floor((rows[0].length - phase[0]) / pitch), Math.floor((rows.length - phase[1]) / pitch)] as const;
  const axes = [(xAxis.start - phase[0]) / pitch, (yAxis.start - phase[1]) / pitch] as const;
  const measured = cells(rows, { pitch, phase, size });
  const groups = new Map<number, string[]>();
  for (const { ink, key } of measured) {
    const group = groups.get(ink) ?? [];
    group.push(key);
    groups.set(ink, group);
  }
  const background = [...groups].find(([, group]) => group.length > measured.length / 2)?.[0];
  if (background === undefined || [direct, image, axisInk].includes(background)) return null;
  const body = groups.get(direct);
  const targetInks = [...groups.keys()].filter(ink => ![background, axisInk, direct, image].includes(ink));
  if (!body || reflectionConnectedSets(new Set(body)).length !== 1 || targetInks.length !== 1) return null;
  const target = targetInks[0]!, targets = groups.get(target)!;
  if (targets.length > body.length * 4) return null;
  const tentative: OrthogonalWorld = { pitch, phase, size, axes, axisInk, background, direct, image, marker,
    body, target, targets, focus: 'piece' };
  const focus = focusOf(tentative, measured);
  return focus === null ? null : reconcile(tentative, measured, focus);
}

function images(body: Set<string>, axes: NativePoint): Set<string> {
  const x = reflectCoverPoints(body, axes[0], 0);
  return new Set([...x, ...reflectCoverPoints(body, axes[1], 1), ...reflectCoverPoints(x, axes[1], 1)]);
}

function reconcile(world: OrthogonalWorld, measured: Cell[], focus: Focus, previous?: OrthogonalWorld): OrthogonalWorld | null {
  const body = new Set(world.body), copies = images(body, world.axes), targets = new Set(world.targets);
  const observedFocus = focusOf(world, measured);
  if (observedFocus !== focus) return null;
  const previousBody = previous ? new Set(previous.body) : null;
  const previousCopies = previousBody && previous ? images(previousBody, previous.axes) : null;
  for (const { ink, key, x, y } of measured) {
    const onAxis = x === world.axes[0] || y === world.axes[1];
    if (body.has(key)) {
      if (ink !== world.direct) return null;
    } else if (ink === world.target) {
      if (previous && !targets.has(key) && !previousBody?.has(key) && !previousCopies?.has(key)
        && x !== previous.axes[0] && y !== previous.axes[1]) return null;
      targets.add(key);
    } else if (ink === world.image) {
      if (!copies.has(key)) return null;
    } else if (ink === world.axisInk) {
      if (!onAxis) return null;
    } else if (ink !== world.background || copies.has(key) || onAxis || targets.has(key)) {
      return null;
    }
  }
  return { ...world, focus, targets: [...targets] };
}

export function reconcileOrthogonalReflection(world: OrthogonalWorld, rows: NativeRows, previous = world): OrthogonalWorld | null {
  const { pitch, phase, size } = world;
  if (rows.length < phase[1] + size[1] * pitch || !rows[0] || rows[0].length < phase[0] + size[0] * pitch) return null;
  return reconcile(world, cells(rows, world), world.focus, previous);
}

export function selectOrthogonalContributor(world: OrthogonalWorld, rows: NativeRows): OrthogonalWorld | null {
  const measured = cells(rows, world);
  const focus = focusOf(world, measured);
  return focus === null || focus === world.focus ? null : reconcile(world, measured, focus, world);
}

export function moveOrthogonalContributor(world: OrthogonalWorld, delta: NativePoint): OrthogonalWorld {
  const { focus } = world;
  if (focus === 'piece') return { ...world, body: [...shiftReflectionPoints(new Set(world.body), [...delta])] };
  const [x, y] = world.axes;
  return { ...world, axes: focus === 0 ? [x + delta[0], y] : [x, y + delta[1]] };
}

const limits = (points: readonly string[], dim: Dimension): [number, number] => {
  const coords = points.map(key => supportPoint(key)[dim]!);
  return [Math.min(...coords), Math.max(...coords)];
};

export function orthogonalBox(world: OrthogonalWorld, points: readonly string[]): NativeBox {
  const [left, right] = limits(points, 0), [top, bottom] = limits(points, 1);
  const { phase, pitch } = world;
  return [phase[0] + left * pitch, phase[1] + top * pitch, phase[0] + (right + 1) * pitch - 1, phase[1] + (bottom + 1) * pitch - 1];
}

export function orthogonalReflectionBoxes(world: OrthogonalWorld): NativeBox[] {
  const body = new Set(world.body);
  const vertical = reflectCoverPoints(body, world.axes[0], 0);
  const horizontal = reflectCoverPoints(body, world.axes[1], 1);
  const visible = (points: Set<string>) => [...points].filter(key => {
    const [x, y] = supportPoint(key);
    return x! >= 0 && x! < world.size[0] && y! >= 0 && y! < world.size[1];
  });
  return [vertical, horizontal, reflectCoverPoints(vertical, world.axes[1], 1)].flatMap(points => {
    const clipped = visible(points);
    return clipped.length ? [orthogonalBox(world, clipped)] : [];
  });
}

export function planOrthogonalReflection(world: OrthogonalWorld): { axes: NativePoint; translation: NativePoint } | null {
  const source = new Set(world.body);
  const targetLimits = dimensions.map(dim => limits(world.targets, dim));
  const bodyLimits = dimensions.map(dim => limits(world.body, dim));
  const center = targetLimits.map(([min, max]) => (min + max) / 2);
  const positions = dimensions.map(dim => {
    const half = center[dim]!;
    return Array.from({ length: world.size[dim] }, (_, pos) => pos).sort((a, b) => Math.abs(a - half) - Math.abs(b - half));
  });
  const translations = dimensions.map(dim => {
    const [min, max] = bodyLimits[dim]!;
    return Array.from({ length: world.size[dim] - (max - min) }, (_, pos) => pos - min).sort((a, b) => Math.abs(a) - Math.abs(b));
  });
  const placements = translations[0]!.flatMap(dx => translations[1]!.map(dy => ({ translation: [dx, dy] as const,
    cost: Math.abs(dx) + Math.abs(dy), body: shiftReflectionPoints(source, [dx, dy]) }))).sort((a, b) => a.cost - b.cost);
  const targets = world.targets.map(supportPoint);
  for (const ax of positions[0]!) {
    for (const ay of positions[1]!) {
      for (const { translation, body } of placements) {
        const covers = targets.every(([x, y]) => {
          const rx = 2 * ax - x!, ry = 2 * ay - y!;
          return body.has(supportKey([x!, y!])) || body.has(supportKey([rx, y!]))
            || body.has(supportKey([x!, ry])) || body.has(supportKey([rx, ry]));
        });
        if (covers) return { axes: [ax, ay], translation };
      }
    }
  }
  return null;
}
