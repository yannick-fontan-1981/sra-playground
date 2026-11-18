import { reflectCoverPoints, shiftReflectionPoints } from '../logos-engine/v6-reflected-cover.ts';
import { reflectionConnectedSets } from '../logos-engine/v6-reflection-audit.ts';
import { supportKey, supportPoint } from '../logos-engine/v6-support-measurements.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Dimension = 0 | 1;
type Focus = Dimension | 'piece';
export type OrthogonalFocusKey = Focus | `piece:${number}`;
type Lattice = { pitch: number; phase: NativePoint; size: NativePoint };
type Band = { ink: number; start: number; end: number };
export type OrthogonalWorld = Lattice & {
  axes: NativePoint; axisInk: number; background: number; direct: number; image: number; marker: number;
  target: number; body: string[]; targets: string[]; focus: Focus;
  pieces?: { masks: string[][]; active: number | null };
};
type Materials = Pick<OrthogonalWorld, 'pitch' | 'direct' | 'image' | 'marker'>;
type Cell = { x: number; y: number; key: string; ink: number; marker: number | null };
const dimensions = [0, 1] as const;

function bands(rows: NativeRows, dim: Dimension, fraction = 0.5): Band[] {
  const sizes = [rows[0]!.length, rows.length] as const;
  const lines: Band[] = [];
  for (let p = 0; p < sizes[dim]; p++) {
    const counts = new Map<number, number>();
    for (let q = 0; q < sizes[1 - dim]!; q++) {
      const ink = dim === 0 ? rows[q]![p]! : rows[p]![q]!;
      counts.set(ink, (counts.get(ink) ?? 0) + 1);
    }
    for (const [ink, count] of counts) {
      if (count < sizes[1 - dim]! * fraction) continue;
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

export function orthogonalFocusKey(world: OrthogonalWorld): OrthogonalFocusKey {
  return world.focus === 'piece' && world.pieces?.active !== null && world.pieces?.active !== undefined
    ? `piece:${world.pieces.active}` : world.focus;
}

function focusOf(world: OrthogonalWorld, measured: Cell[]): OrthogonalFocusKey | null {
  const body = new Set(world.body);
  const owners = new Set<OrthogonalFocusKey>();
  const marked = measured.filter(cell => cell.marker === world.marker);
  for (const { x, y, ink } of marked) {
    if (ink !== world.axisInk) continue;
    if (x === world.axes[0] && y !== world.axes[1]) owners.add(0);
    if (y === world.axes[1] && x !== world.axes[0]) owners.add(1);
  }
  for (const { x, y, key, ink } of marked) {
    if (ink === world.direct && body.has(key)) {
      if ((x === world.axes[0] && owners.has(0)) || (y === world.axes[1] && owners.has(1))) continue;
      const piece = world.pieces?.masks.findIndex(mask => mask.includes(key));
      owners.add(piece !== undefined && piece >= 0 ? `piece:${piece}` : 'piece');
    }
  }
  return owners.size === 1 ? [...owners][0]! : null;
}

function selectFocus(world: OrthogonalWorld, owner: OrthogonalFocusKey): OrthogonalWorld {
  if (!world.pieces) return { ...world, focus: owner as Focus };
  const active = typeof owner === 'string' && owner.startsWith('piece:') ? Number(owner.slice(6)) : null;
  return { ...world, focus: active === null ? owner as Focus : 'piece', pieces: { ...world.pieces, active } };
}

function diagonalComponents(body: string[]) {
  const pending = new Set(body), components: string[][] = [];
  for (const start of pending) {
    const mask = [start];
    pending.delete(start);
    for (const key of mask) {
      const [x, y] = supportPoint(key);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const neighbour = supportKey([x! + dx, y! + dy]);
        if (pending.delete(neighbour)) mask.push(neighbour);
      }
    }
    components.push(mask);
  }
  return components;
}

export function measureOrthogonalReflection(rows: NativeRows, materials: Materials): OrthogonalWorld | null {
  const { pitch, direct, image, marker } = materials;
  if (pitch < 2 || pitch > 8 || !rows.length || !rows[0]?.length) return null;
  const wholeBands = (dim: Dimension, fraction: number) => bands(rows, dim, fraction).filter(b => b.end - b.start + 1 === pitch);
  const intersections = (vertical: Band[], horizontal: Band[]) => vertical.flatMap(x => horizontal.flatMap(y =>
    x.ink === y.ink ? [[x, y] as const] : []));
  const vertical = wholeBands(0, 0.5), horizontal = wholeBands(1, 0.5);
  const visible = intersections(vertical, horizontal);
  const axesCandidates = visible.length ? visible : [
    ...intersections(wholeBands(0, 1 / 3), horizontal), ...intersections(vertical, wholeBands(1, 1 / 3)),
  ];
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
  if (!body || targetInks.length !== 1) return null;
  const contiguous = reflectionConnectedSets(new Set(body)).length === 1;
  const masks = contiguous ? null : diagonalComponents(body);
  if (masks && (masks.length < 2 || masks.length > 4 || masks.some(mask => mask.length < 2))) return null;
  const target = targetInks[0]!, targets = groups.get(target)!;
  if (targets.length > body.length * 4) return null;
  const tentative: OrthogonalWorld = { pitch, phase, size, axes, axisInk, background, direct, image, marker,
    body, target, targets, focus: 'piece', ...(masks ? { pieces: { masks, active: null } } : {}) };
  const focus = focusOf(tentative, measured);
  return focus === null ? null : reconcile(selectFocus(tentative, focus), measured);
}

function images(body: Set<string>, axes: NativePoint): Set<string> {
  const x = reflectCoverPoints(body, axes[0], 0);
  return new Set([...x, ...reflectCoverPoints(body, axes[1], 1), ...reflectCoverPoints(x, axes[1], 1)]);
}

function reconcile(world: OrthogonalWorld, measured: Cell[], previous?: OrthogonalWorld): OrthogonalWorld | null {
  const body = new Set(world.body), copies = images(body, world.axes), targets = new Set(world.targets);
  const observedFocus = focusOf(world, measured);
  if (observedFocus !== orthogonalFocusKey(world)) {
    // A confirmed piece can cover its marks and show the target ink in place
    // of every selection dot. The other contributors must remain verifiable.
    const covered = observedFocus === null && previous?.focus === 'piece' && world.pieces
      && world.pieces.active !== null && previous.pieces?.active === world.pieces.active
      && world.pieces.masks[world.pieces.active]!.every(key => targets.has(key)
        && measured.some(cell => cell.key === key && cell.ink === world.direct && cell.marker === world.target));
    if (!covered) return null;
  }
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
  return { ...world, targets: [...targets] };
}

export function reconcileOrthogonalReflection(world: OrthogonalWorld, rows: NativeRows, previous = world): OrthogonalWorld | null {
  const { pitch, phase, size } = world;
  if (rows.length < phase[1] + size[1] * pitch || !rows[0] || rows[0].length < phase[0] + size[0] * pitch) return null;
  return reconcile(world, cells(rows, world), previous);
}

export function selectOrthogonalContributor(world: OrthogonalWorld, rows: NativeRows): OrthogonalWorld | null {
  const measured = cells(rows, world);
  const focus = focusOf(world, measured);
  return focus === null || focus === orthogonalFocusKey(world) ? null : reconcile(selectFocus(world, focus), measured, world);
}

export function moveOrthogonalContributor(world: OrthogonalWorld, delta: NativePoint): OrthogonalWorld {
  const { focus } = world;
  if (focus === 'piece' && world.pieces && world.pieces.active !== null) {
    const masks = world.pieces.masks.map((mask, i) => i === world.pieces!.active
      ? [...shiftReflectionPoints(new Set(mask), [...delta])] : mask);
    return { ...world, body: [...new Set(masks.flat())], pieces: { ...world.pieces, masks } };
  }
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

type Layout = { axes: NativePoint; translation: NativePoint; piece?: number };

function planMultiplePieces(world: OrthogonalWorld, pieces: NonNullable<OrthogonalWorld['pieces']>): Layout | null {
  const targets = world.targets.map(supportPoint);
  const total = pieces.masks.reduce((count, mask) => count + mask.length, 0);
  const bodies = pieces.masks.map(mask => {
    const xs = limits(mask, 0), ys = limits(mask, 1);
    const points = mask.map(supportPoint);
    const translations = [];
    for (let dy = -ys[0]; dy + ys[1] < world.size[1]; dy++) for (let dx = -xs[0]; dx + xs[1] < world.size[0]; dx++) {
      translations.push({ delta: [dx, dy] as const, cost: Math.abs(dx) + Math.abs(dy) });
    }
    translations.sort((a, b) => a.cost - b.cost);
    return { points, translations };
  });
  let best: { cost: number; axes: NativePoint; deltas: NativePoint[] } | undefined;
  let searched = 0;
  for (let ax = 0; ax < world.size[0]; ax++) for (let ay = 0; ay < world.size[1]; ay++) {
    const axisCost = Math.abs(ax - world.axes[0]) + Math.abs(ay - world.axes[1]);
    if (best && axisCost >= best.cost) continue;
    const fold = (x: number, y: number) => Math.abs(y - ay) * world.size[0] + Math.abs(x - ax);
    const orbits = [...new Set(targets.map(([x, y]) => fold(x!, y!)))];
    if (orbits.length > total) continue;
    const bits = new Map(orbits.map((orbit, index) => [orbit, 1n << BigInt(index)]));
    const needed = (1n << BigInt(orbits.length)) - 1n;
    const variants = bodies.map(({ points, translations }) => translations.flatMap(({ delta, cost }) => {
      if (best && axisCost + cost >= best.cost) return [];
      let coverage = 0n, covered = 0;
      for (const [x, y] of points) {
        const bit = bits.get(fold(x! + delta[0], y! + delta[1]));
        if (bit && !(coverage & bit)) { coverage |= bit; covered++; }
      }
      return covered >= orbits.length - (total - points.length) ? [{ delta, cost, coverage }] : [];
    }));
    const combine = (index: number, coverage: bigint, cost: number, deltas: NativePoint[]) => {
      if (searched++ >= 100_000 || (best && cost >= best.cost)) return;
      if (index === variants.length) {
        if (coverage === needed) best = { axes: [ax, ay], deltas, cost };
        return;
      }
      for (const candidate of variants[index]!) combine(index + 1, coverage | candidate.coverage,
        cost + candidate.cost, [...deltas, candidate.delta]);
    };
    combine(0, 0n, axisCost, []);
  }
  if (!best) return null;
  const active = pieces.active;
  const piece = active !== null && best.deltas[active]?.some(Boolean) ? active : best.deltas.findIndex(delta => delta.some(Boolean));
  return { axes: best.axes, translation: best.deltas[piece] ?? [0, 0], ...(piece >= 0 ? { piece } : {}) };
}

export function planOrthogonalReflection(world: OrthogonalWorld): Layout | null {
  if (world.pieces) return planMultiplePieces(world, world.pieces);
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
