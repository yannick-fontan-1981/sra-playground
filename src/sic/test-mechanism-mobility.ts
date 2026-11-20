import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { same, diff, type XY } from './access-terrain.ts';
import { visualLayout } from './witnessed-preview-transfer.ts';
import { motorsFor, type ZoneRepeat } from './local-progress.ts';
import type { Memory, Experiment } from './preparation-experiments.ts';

type Site = { role: string; at: XY; peers: XY[]; priorMove: number | null; contact: boolean };
export type MobilityProbe = {
  cause: ZoneRepeat;
  actor: string;
  op: string;
  from: XY;
  before: string;
  sites: Site[];
};
export function proposeMobilityTest(
  m: Memory,
  s: number,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  cause: ZoneRepeat | null
): Experiment | null {
  const occ = m.occupancy;
  if (!cause || !occ) return null;
  const p = cause.actor,
    v = occ.layouts[s],
    u = v?.[p];
  if (!u) return null;
  const controls = [...available].filter(
    (op) => op !== cause.op && !op.startsWith('ACTION6:') && occ.observed[s + '/' + op] === undefined
  );
  if (!controls.length) return null;
  const layout = visualLayout(o, rows),
    motors = motorsFor(occ, p),
    indicators = new Set(
      Object.values(m.previewLearning?.bindings ?? {})
        .filter((b) => b.actor === p)
        .map((b) => b.indicator)
    );
  const changes = new Map<string, Map<string, number>>();
  for (const e of occ.edges) {
    if (e.unstable) continue;
    const b = occ.layouts[e.s]!,
      a = occ.layouts[e.t]!;
    for (const [role, at] of Object.entries(b)) {
      if (!a[role] || same(at, a[role]!)) continue;
      const map = changes.get(role) ?? new Map<string, number>();
      map.set(e.op, e.ref);
      changes.set(role, map);
    }
  }
  const sites: Site[] = [];
  for (const [role, bodies] of Object.entries(layout)) {
    if (role === p || indicators.has(role) || bodies.length > 12) continue;
    for (const b of bodies) {
      if (same(b.at, u)) continue;
      const contact = motors.some((m) => same(m.d, diff(b.at, u)) || same(m.d, diff(u, b.at)));
      const prior = changes.get(role),
        stable = occ.layouts[cause.sourceScene]?.[role];
      if (!prior && !contact && (!stable || !same(stable, b.at))) continue;
      sites.push({
        role,
        at: b.at,
        peers: bodies.filter((x) => x !== b).map((x) => x.at),
        priorMove: prior?.values().next().value ?? null,
        contact,
      });
    }
  }
  if (!sites.length) return null;
  let winner: { op: string; sites: Site[]; score: number } | null = null;
  for (const op of controls) {
    const rank = (site: Site) =>
      8 * Number(changes.get(site.role)?.has(op)) +
      4 * Number(site.priorMove !== null) +
      2 * Number(site.contact);
    const sorted = sites.slice().sort((a, b) => rank(b) - rank(a));
    const score = rank(sorted[0]!) + Number(!motors.some((m) => m.op === op));
    if (!winner || score > winner.score) winner = { op, sites: sorted.slice(0, 6), score };
  }
  const probe: MobilityProbe = {
    cause,
    actor: p,
    op: winner!.op,
    from: u,
    before: o.observation_ref,
    sites: winner!.sites,
  };
  return {
    phase: 'testMechanismMobility',
    origin: s,
    a: probe.op,
    b: probe.op,
    rule: 'test_which_persistent_part_can_be_moved_from_this_repeated_configuration',
    refs: [
      ...new Set([
        cause.previous,
        cause.revision,
        ...probe.sites.flatMap((s) => (s.priorMove === null ? [] : [s.priorMove])),
      ]),
    ],
    mobilityProbe: probe,
  };
}
export function measureMobility(
  test: MobilityProbe,
  b: NativeObservation,
  a: NativeObservation,
  next: NativeRows,
  op: string
) {
  const layout = visualLayout(a, next),
    live =
      b.level_epoch === a.level_epoch &&
      b.levels_completed === a.levels_completed &&
      b.state === a.state &&
      b.observation_ref === test.before &&
      op === test.op;
  const outcomes = test.sites.map((site) => {
    const group = layout[site.role] ?? [],
      named = group.filter((v) => !site.peers.some((k) => same(k, v.at)));
    const identified =
      group.length === 1 + site.peers.length &&
      site.peers.every((k) => group.some((v) => same(k, v.at))) &&
      named.length === 1;
    const actual = identified ? named[0]!.at : null;
    return {
      role: site.role,
      at: site.at,
      actual,
      status: !live ? 'inapplicable' : !actual ? 'unobserved' : same(actual, site.at) ? 'still' : 'moved',
    };
  });
  return {
    test,
    outcomes,
    moved: outcomes.filter((v) => v.status === 'moved').length,
    won: a.levels_completed > b.levels_completed || a.state === 'WIN',
  };
}
