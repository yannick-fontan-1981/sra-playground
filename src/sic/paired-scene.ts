import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import type { VisualLayout } from './witnessed-preview-transfer.ts';
import {
  neighbor,
  sitePoint,
  type TransportMemory,
  type TransportState,
} from './transport-observations.ts';

export type Grid = TransportMemory['grid'];
export type Door = { site: number; controls: number[]; closed: string };
export type Scene = {
  grid: Grid;
  floor: number;
  bodies: [number, number];
  accent: number;
  cargo: string;
  ground: number[];
  medium: number[];
  goals: number[];
  doors: Door[];
  other: number[];
  origin: [number, number];
  features: string[];
  initial: string[];
};
export type Reading = TransportState & { opened: number[]; anchor: number };
const counts = (v: number[]) => {
  const m = new Map<number, number>();
  for (const n of v) m.set(n, (m.get(n) ?? 0) + 1);
  return m;
};
export function picture(g: Grid, rows: NativeRows): string[] {
  return Array.from({ length: g.columns * g.rows }, (_, i) => {
    const x = g.left + (i % g.columns) * g.pitch,
      y = g.top + Math.floor(i / g.columns) * g.pitch;
    return Array.from({ length: g.pitch }, (_, j) =>
      rows[y + j]!.slice(x, x + g.pitch).join(','),
    ).join(',');
  });
}
const inks = (s: string) => s.split(',').map(Number);
function shape(key: string, p: number) {
  const v = inks(key),
    h = Math.floor(p / 2),
    center = v[h * p + h]!,
    corners = [v[0], v[p - 1], v[v.length - p], v[v.length - 1]];
  const surround = v.filter((_, i) => i !== h * p + h);
  const field = corners.every((x) => x === corners[0]) ? corners[0] : undefined;
  const arms = v.filter(
    (_, i) => (i % p === h || Math.floor(i / p) === h) && i !== h * p + h,
  );
  const cross =
    field !== undefined &&
    v.every((n, i) =>
      i % p === h || Math.floor(i / p) === h ? n !== field : n === field,
    );
  const marks = cross ? arms.filter((n) => n !== center) : [];
  const ring =
    surround.every((n) => n === surround[0]) && surround[0] !== center;
  return {
    center,
    field,
    arms,
    cross,
    marks,
    ring,
    uniform: v.every((n) => n === center),
    colors: [...counts(v).keys()],
  };
}
export function pairedScene(
  layout: VisualLayout,
  rows: NativeRows,
  preferred?: number | readonly [number, number],
  knownBodies?: readonly [number, number],
): Scene | undefined {
  const tried = new Set<string>();
  for (const parts of Object.values(layout).sort(
    (a, b) => b.length - a.length,
  )) {
    const b = parts[0]!.box,
      p = b[2]! - b[0]! + 1;
    if (p < 3 || p % 2 === 0 || b[3]! - b[1]! + 1 !== p) continue;
    const left = b[0]! % p,
      top = b[1]! % p;
    if (tried.has([p, left, top].join())) continue;
    tried.add([p, left, top].join());
    const grid = {
      pitch: p,
      left,
      top,
      columns: Math.floor((rows[0]!.length - left) / p),
      rows: Math.floor((rows.length - top) / p),
    };
    const initial = picture(grid, rows),
      byForm = new Map<string, number[]>();
    initial.forEach((k, i) => {
      const a = byForm.get(k) ?? [];
      a.push(i);
      byForm.set(k, a);
    });
    const forms = [...byForm].map(([key, sites]) => ({
      key,
      sites,
      ...shape(key, p),
    }));
    const pairs = forms.flatMap((a) =>
      !a.cross || a.sites.length !== 1 || a.marks.length !== 1
        ? []
        : forms
            .filter(
              (b) =>
                b.cross &&
                b.sites.length === 1 &&
                !b.marks.length &&
                b.field === a.field &&
                a.center !== b.center &&
                forms.some((f) => f.uniform && f.center === a.field),
            )
            .map((b) => [a, b] as const),
    );
    const wanted =
      typeof preferred === 'number' || preferred === undefined
        ? preferred
        : Math.floor((preferred[0] - left) / p) +
          grid.columns * Math.floor((preferred[1] - top) / p);
    const eligible = pairs.filter(
      (pair) =>
        (wanted === undefined || pair[1].sites[0] === wanted) &&
        (!knownBodies || pair.every((f, i) => f.center === knownBodies[i])),
    );
    if (eligible.length !== 1) continue;
    const [actor, partner] = eligible[0]!,
      floor = actor.field!,
      origin: [number, number] = [actor.sites[0]!, partner.sites[0]!];
    const goals = forms.filter(
      (f) => f.ring && f.center === floor && f.sites.length === 2,
    );
    const cargos = forms
      .filter((f) => f.ring && f.center !== floor && f.sites.length >= 1)
      .sort((a, b) => b.sites.length - a.sites.length);
    if (
      goals.length !== 1 ||
      !cargos.length ||
      cargos[0]!.sites.length === cargos[1]?.sites.length
    )
      continue;
    const cargo = cargos[0]!,
      goal = goals[0]!;
    const switches = forms.filter(
      (f) =>
        f.cross &&
        f.field === floor &&
        f.arms.every((x) => x === f.arms[0]) &&
        f.center !== f.arms[0] &&
        f !== actor &&
        f !== partner,
    );
    const structures = forms.filter(
      (f) =>
        !f.cross && !f.ring && !f.uniform && f.field !== floor && f !== cargo,
    );
    const doors: Door[] = structures.flatMap((f) => {
      const match = switches.filter(
        (sw) =>
          f.colors.includes(sw.center) &&
          f.colors.includes(sw.arms[0]!) &&
          f.colors.some((x) => x !== sw.center && x !== sw.arms[0]),
      );
      return match.length === 1
        ? f.sites.map((site) => ({
            site,
            closed: f.key,
            controls: match[0]!.sites,
          }))
        : [];
    });
    const outside = initial[0],
      medium = forms
        .filter((f) => f.uniform && f.key !== outside && f.center !== floor)
        .flatMap((f) => f.sites);
    const features = forms
      .filter(
        (f) =>
          !f.uniform &&
          f !== actor &&
          f !== partner &&
          f !== goal &&
          f !== cargo,
      )
      .map((f) => f.key);
    const other = forms
      .filter(
        (f) =>
          features.includes(f.key) &&
          !switches.includes(f) &&
          !doors.some((d) => d.closed === f.key),
      )
      .flatMap((f) => f.sites);
    const ground = forms
      .filter((f) =>
        f.uniform
          ? f.center === floor
          : f === actor ||
            f === partner ||
            f === goal ||
            f === cargo ||
            switches.includes(f) ||
            doors.some((d) => d.closed === f.key),
      )
      .flatMap((f) => f.sites);
    return {
      grid,
      floor,
      bodies: [actor.center, partner.center],
      accent: actor.marks[0]!,
      cargo: cargo.key,
      ground,
      medium,
      goals: goal.sites,
      doors,
      origin,
      other,
      features,
      initial,
    };
  }
}
export function readPair(
  s: Scene,
  tiles: string[],
  old?: Reading,
): Reading | undefined {
  const p = s.grid.pitch,
    middle = Math.floor((p * p) / 2);
  const forms = new Map<string, ReturnType<typeof shape>>();
  function glyph(k: string) {
    let f = forms.get(k);
    if (!f) {
      f = shape(k, p);
      forms.set(k, f);
    }
    return f;
  }
  const subjects = s.bodies.map((ink) =>
    tiles.flatMap((k, i) => {
      const f = glyph(k);
      return f.center === ink &&
        f.arms.filter((x) => x === ink).length >= f.arms.length - 1
        ? [i]
        : [];
    }),
  );
  if (
    subjects.some((a) => a.length !== 1) ||
    subjects[0]![0] === subjects[1]![0]
  )
    return;
  const sites = subjects.map((z) => z[0]!) as [number, number];
  const marked = sites.flatMap((z, i) =>
    glyph(tiles[z]!).arms.includes(s.accent) ? [i] : [],
  );
  if (marked.length !== 1) return;
  const controls = new Set(s.doors.flatMap((d) => d.controls)),
    cargoCenter = inks(s.cargo)[middle];
  const pieces = tiles.flatMap((k, i) =>
    k === s.cargo ||
    (controls.has(i) &&
      !sites.includes(i) &&
      glyph(k).center === cargoCenter &&
      glyph(k).colors.includes(inks(s.cargo)[0]!))
      ? [i]
      : [],
  );
  const supports = s.medium.filter((i) => {
    const t = tiles[i]!,
      f = glyph(t);
    return (
      (old?.supports.includes(i) &&
        (sites.includes(i) || pieces.includes(i))) ||
      (!f.uniform &&
        f.field !== undefined &&
        !f.cross &&
        !f.ring &&
        f.center !== s.floor &&
        !s.bodies.includes(f.center) &&
        t !== s.cargo &&
        f.colors.length === 2 &&
        f.arms.every((n) => n !== f.center))
    );
  });
  return {
    subjects: sites,
    active: marked[0] as 0 | 1,
    pieces,
    supports,
    opened: s.doors.flatMap((d) =>
      tiles[d.site] !== d.closed ? [d.site] : [],
    ),
    anchor: -1,
  };
}
export function pointCommand(g: Grid, site: number) {
  return 'ACTION6:' + sitePoint(g, site).join(',');
}
export const cardinal = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;
export function surrounding(g: Grid, site: number) {
  return cardinal
    .map(([dx, dy]) => neighbor(g, site, dx, dy))
    .filter((n) => n >= 0);
}
