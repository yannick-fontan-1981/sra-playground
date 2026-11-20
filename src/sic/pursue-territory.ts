import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import {
  approach,
  territorialMaps,
  terrainKey,
  type Territory,
  type Stroke,
} from './controllable-territory.ts';
import { groupsOf, resolveRole, type Role } from './exchange-roles.ts';
import {
  openCapacityQuestion,
  offerCapacityWord,
  recordCapacityWord,
  type CapacityTicket,
  type WordMemory,
} from './probe-territorial-capacity.ts';
import { orbitTerritories } from './translated-orbit.ts';
import { walkToOrbit } from './walk-to-orbit.ts';
import { territorialControl, recordTerritorialControl, type TerritorialControl, type ControlTicket } from './territorial-control-forks.ts';
import { imaginedPlacements } from './imagine-territory-placement.ts';
import type { ReferenceRecipe } from './route-to-reference.ts';
import { frameEvidence } from './inverse-frame-experiment.ts';
import { measuredReferenceRecipes } from './measured-reference-recipes.ts';
import type { Experiment, Memory } from './preparation-experiments.ts';

type Stage =
  | 'approach'
  | 'challenge'
  | 'displace'
  | 'interact'
  | 'land'
  | 'explore'
  | 'capacity_input'
  | 'capacity_read'
  | 'capacity_return';
export type TerritorialStep = {
  op: string;
  stage: Stage;
  from?: XY;
  to?: XY;
  marker?: XY;
  expectedMarker?: XY;
  expectedFrame?: string;
  ref?: number;
};
type Step = TerritorialStep;
type Goal = {
  basis: Territory['basis'];
  analogy?: Territory['analogy'];
  actor: string;
  from: XY;
  initial: XY;
  ground: number;
  width: number;
  stride: XY;
  foothold: XY;
  territory: [number, number][];
  home: [number, number][];
  ops: Stroke[];
  homeSize: number;
  initialAreaSize: number | null;
  inInitialArea: boolean;
  visited: number;
  rim: XY;
  blocked: XY;
  ordinary: string;
  failed: number | null;
  outsideSize: number;
  alternatives: number;
};
type Proposal = {
  kind:
    | 'compare_control'
    | 'prepare_control'
    | 'reuse_control'
    | 'capacity_word'
    | 'capacity_reuse'
    | 'revisit_capacity'
    | 'walk_to_analogue'
    | 'ordinary_limit'
    | 'imagined_transport'
    | 'learned_transport'
    | 'contact'
    | 'relocate'
    | 'select_and_move'
    | 'reopen_limit';
  site: Role | null;
  siteAt: XY | null;
  ideal: XY | null;
  landing: XY;
  program: Step[];
  key: string;
  score: number;
  refs: number[];
};
export type TerritorialTrial = {
  goal: Goal;
  capacity?: CapacityTicket;
  control?: ControlTicket;
  plan: Proposal;
  cursor: number;
  choices: { kind: string; site: XY | null; ideal: XY | null; arrival: XY }[];
};
export type TerritorialMemory = {
  active: TerritorialTrial | null;
  words?: WordMemory;
  control?: TerritorialControl;
  failedWalks?: Record<string, number>;
  tried: Record<string, number>;
  last: number;
  goal?: Goal;
  crossed?: number;
  crossingRecipes?: Record<string, ReferenceRecipe>;
};
export const newTerritorialMemory = (): TerritorialMemory => ({ active: null, tried: {}, last: -1 });
function packed(cells: Set<number>, step: number): [number, number][] {
  const ranges: [number, number][] = [];
  for (const cell of [...cells].sort((a, b) => a - b)) {
    const tail = ranges.at(-1);
    if (tail && tail[0] + tail[1] * step === cell) tail[1]++;
    else ranges.push([cell, 1]);
  }
  return ranges;
}
export function inTerritory(g: Goal, p: XY) {
  if (p[0] < 0 || p[0] >= g.width || p[1] < 0) return false;
  const n = terrainKey(p, g.width);
  return g.territory.some(([a, k]) => n >= a && n < a + k * g.stride[0] && (n - a) % g.stride[0] === 0);
}
function goalFor(t: Territory): Goal {
  return {
    basis: t.basis,
    ...(t.analogy ? { analogy: t.analogy } : {}),
    actor: t.actor,
    from: t.from,
    initial: t.origin,
    ground: t.ground,
    width: t.width,
    stride: t.stride,
    foothold: t.foothold,
    territory: packed(t.foreign, t.stride[0]),
    home: packed(t.home, t.stride[0]),
    ops: t.ops,
    homeSize: t.home.size,
    initialAreaSize: t.initialRegion?.size ?? null,
    inInitialArea: t.initialRegion?.has(terrainKey(t.from, t.width)) ?? false,
    visited: t.seen.size,
    rim: t.rim.p,
    blocked: t.rim.at,
    ordinary: t.rim.stroke.op,
    failed: t.rim.tested,
    outsideSize: t.foreign.size,
    alternatives: t.alternatives,
  };
}
const metric = (a: XY, b: XY, t: Territory) =>
  Math.abs(a[0] - b[0]) / t.stride[0] + Math.abs(a[1] - b[1]) / t.stride[1];
const here = (t: Territory, k: number): XY => [k % t.width, Math.floor(k / t.width)];
const centre = (e: NativeEntity): XY => [(e.bbox[0] + e.bbox[2]) / 2, (e.bbox[1] + e.bbox[3]) / 2];
function navigation(t: Territory, point: XY): Step[] | null {
  if (same(t.from, point)) return [];
  const path = approach(t, point);
  if (!path.length) return null;
  let from = t.from;
  return path.map((p) => {
    const step: Step = { op: p.op, stage: 'approach', from, to: p.to, ref: p.ref };
    from = p.to;
    return step;
  });
}
function hypotheses(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  t: Territory,
  s: number,
  available: Set<string>
): Proposal[] {
  const targetHas = (p: XY) =>
    p[0] >= 0 && p[0] < t.width && p[1] >= 0 && p[1] < rows.length && t.foreign.has(terrainKey(p, t.width));
  const goals = t.foothold,
    offers: Proposal[] = [],
    actor = o.entities.find((e) => e.signature === t.actor)!,
    g = groupsOf(o);
  function submit(
    kind: Proposal['kind'],
    site: Role | null,
    at: XY | null,
    ideal: XY | null,
    landing: XY,
    program: Step[],
    score: number,
    refs: number[]
  ) {
    if (!program.length) return;
    const first = program.find((x) => x.stage !== 'approach');
    const key = JSON.stringify([
      t.actor,
      t.foothold,
      kind,
      site?.signature,
      at,
      ideal,
      first?.from,
      ...(kind === 'walk_to_analogue' ? [t.from] : []),
      program.filter((x) => kind === 'walk_to_analogue' || x.stage !== 'approach').map((x) => x.op),
    ]);
    if (m.territory?.tried[key] !== undefined) return;
    offers.push({
      kind,
      site,
      siteAt: at,
      ideal,
      landing,
      program,
      key,
      score: score - Math.log2(1 + program.length),
      refs: [...new Set([...refs, ...program.flatMap((x) => (x.ref ? [x.ref] : []))])],
    });
  }
  if (t.analogy) {
    const walk = walkToOrbit(t, m, rows, available, actor),
      failures = m.territory?.failedWalks?.[JSON.stringify([t.actor, t.analogy.near, t.analogy.far])] ?? 0;
    if (walk.length)
      submit(
        'walk_to_analogue',
        null,
        null,
        null,
        walk.at(-1)!.to!,
        walk,
        48 / (1 + failures),
        t.analogy.refs
      );
  }
  const route = navigation(t, t.rim.p);
  if (route && t.rim.tested === null)
    submit(
      'ordinary_limit',
      null,
      null,
      null,
      t.foothold,
      [
        ...route,
        { stage: 'challenge', op: t.rim.stroke.op, from: t.rim.p, to: t.rim.at, ref: t.rim.stroke.ref },
      ],
      40,
      t.ops.map((v) => v.ref)
    );
  for (const v of imaginedPlacements(m, o, rows, t, available)) {
    submit(
      'imagined_transport',
      { signature: v.anchor, fixed: [] },
      v.at,
      v.ideal,
      v.landing,
      v.program,
      v.value,
      v.refs
    );
  }
  const input = frameEvidence(m, o, rows, s, available);
  for (const law of [
    ...Object.values(m.frames?.recipes ?? {}),
    ...Object.values(m.territory?.crossingRecipes ?? {}),
    ...(input ? measuredReferenceRecipes(input) : []),
  ]) {
    if (law.role.signature !== t.actor || law.role.fixed.length) continue;
    const anchor = { signature: law.anchor, fixed: [] },
      e = resolveRole(g, anchor);
    if (!e) continue;
    const at: XY = [...e.position],
      needed = diff(goals, law.offset);
    if (targetHas(add(at, law.offset))) {
      submit(
        'learned_transport',
        anchor,
        at,
        at,
        add(at, law.offset),
        [{ op: law.q, stage: 'land', from: t.from, to: add(at, law.offset) }],
        100,
        law.refs
      );
      continue;
    }
    const displacements = new Map<string, { op: string; d: XY; ref: number }>();
    for (const edge of m.edges)
      if (edge.stable && edge.cmd !== law.q) {
        const d = edge.effect.moves.find((x) => x.actor === law.anchor);
        if (
          d &&
          edge.anchors[t.actor] &&
          edge.visibleAfter?.includes(t.actor) &&
          !edge.effect.moves.some((x) => x.actor === t.actor)
        )
          displacements.set(edge.cmd, { op: edge.cmd, d: [d.dx, d.dy], ref: edge.ref });
      }
    const queue: { p: XY; path: Step[] }[] = [{ p: at, path: [] }],
      seen = new Set([at.join()]);
    for (const row of queue) {
      if (row.path.length && targetHas(add(row.p, law.offset))) {
        submit(
          'learned_transport',
          anchor,
          at,
          row.p,
          add(row.p, law.offset),
          [...row.path, { op: law.q, stage: 'land', from: t.from, to: add(row.p, law.offset) }],
          90 - metric(row.p, needed, t),
          law.refs
        );
        break;
      }
      for (const v of displacements.values()) {
        const next = add(row.p, v.d);
        if (
          seen.has(next.join()) ||
          next[0] < 0 ||
          next[1] < 0 ||
          next[0] >= t.width ||
          next[1] >= rows.length
        )
          continue;
        seen.add(next.join());
        queue.push({
          p: next,
          path: [
            ...row.path,
            { stage: 'displace', op: v.op, marker: row.p, expectedMarker: next, ref: v.ref },
          ],
        });
      }
    }
  }
  const features = o.entities.filter(
    (e) => e.signature !== t.actor && e.area <= (rows.length * t.width) / 10
  );
  const ordinary = new Set(t.ops.map((v) => v.op)),
    other = [...available].filter((q) => !ordinary.has(q) && !q.startsWith('ACTION6:'));
  if (route && t.rim.tested !== null) {
    for (const op of available)
      if (op !== t.rim.stroke.op && !op.startsWith('ACTION6:')) {
        submit(
          'reopen_limit',
          null,
          null,
          t.rim.at,
          t.foothold,
          [
            ...route,
            { op, stage: 'interact', from: t.rim.p },
            { op: t.rim.stroke.op, stage: 'challenge', from: t.rim.p, to: t.rim.at, ref: t.rim.stroke.ref },
          ],
          8 + (ordinary.has(op) ? 0 : 2),
          [t.rim.tested]
        );
      }
  }
  const shapes = new Map(features.map((e) => [e, JSON.stringify(e.mask)]));
  const travel = [terrainKey(t.from, t.width), ...t.route.keys()];
  for (const marker of features) {
    const c = centre(marker),
      offset: XY = [(actor.bbox[2] - actor.bbox[0]) / 2, (actor.bbox[3] - actor.bbox[1]) / 2],
      area = diff(c, offset);
    const nearest = travel.reduce((a, b) =>
      metric(here(t, a), area, t) <= metric(here(t, b), area, t) ? a : b
    );
    if (metric(here(t, nearest), area, t) > 1.75) continue;
    const positions = g.get(marker.signature)!,
      site: Role = {
        signature: marker.signature,
        fixed: [...positions.keys()].filter((k) => k !== marker.position.join()).sort(),
      };
    if (site.fixed.length > 11) continue;
    const at: XY = [...marker.position];
    let similarity = 0,
      landing = t.foothold;
    for (const peer of features) {
      if (peer === marker) continue;
      const anchor = diff(centre(peer), offset);
      if (metric(anchor, t.foothold, t) > Math.max(3, Math.sqrt(t.foreign.size))) continue;
      const matches = shapes.get(peer) === shapes.get(marker) ? 4 : peer.area === marker.area ? 1 : 0;
      if (matches <= similarity) continue;
      let nearestTarget = t.foothold;
      for (const id of t.foreign) {
        const x = here(t, id);
        if (metric(x, anchor, t) < metric(nearestTarget, anchor, t)) nearestTarget = x;
      }
      if (metric(nearestTarget, anchor, t) <= 1.5) {
        similarity = matches;
        landing = nearestTarget;
      }
    }
    const proximity = 1 / (1 + metric(area, t.rim.p, t));
    // Approach a real site. Contact alone, operation at contact, and contact followed by a directional input are distinct experiments.
    for (const stroke of t.ops) {
      let best: { from: XY; to: XY; dist: number } | null = null;
      for (const id of travel) {
        const p = here(t, id),
          dest = add(p, stroke.d),
          d = metric(dest, area, t);
        if (d > 1 || metric(p, area, t) <= d) continue;
        const reach = d + 0.025 * metric(t.from, p, t);
        if (!best || reach < best.dist) best = { from: p, to: dest, dist: reach };
      }
      if (!best) continue;
      const path = navigation(t, best.from);
      if (!path) continue;
      const interact: Step = {
        stage: 'interact',
        op: stroke.op,
        from: best.from,
        to: best.to,
        ref: stroke.ref,
      };
      submit('contact', site, at, null, landing, [...path, interact], 7 + similarity * 2 + proximity, [
        stroke.ref,
      ]);
      // First try to put an instrument closer to the near-side boundary or into alignment with the desired landing.
      const moved = add(at, stroke.d),
        improvement = metric(at, t.rim.p, t) - metric(moved, t.rim.p, t);
      if (improvement > 0 || metric(moved, landing, t) < metric(at, landing, t)) {
        for (const op of other.length ? other : [stroke.op]) {
          const select: Step = { stage: 'interact', op, from: best.from };
          const shift: Step = {
            stage: 'displace',
            op: stroke.op,
            marker: at,
            expectedMarker: moved,
            ref: stroke.ref,
          };
          submit(
            'select_and_move',
            site,
            at,
            moved,
            landing,
            [...path, select, shift, { op, stage: 'land' }],
            9 + similarity + proximity + Math.max(0, improvement),
            [stroke.ref]
          );
        }
        submit(
          'relocate',
          site,
          at,
          moved,
          landing,
          [
            ...path,
            { ...interact, stage: 'displace', marker: at, expectedMarker: moved },
            { op: stroke.op, stage: 'land' },
          ],
          8 + similarity + proximity,
          [stroke.ref]
        );
      }
      for (const op of other)
        submit(
          'contact',
          site,
          at,
          null,
          landing,
          [...path, interact, { op, stage: 'land' }],
          8 + similarity * 2 + proximity,
          [stroke.ref]
        );
    }
  }
  return offers.sort((a, b) => b.score - a.score);
}
export function offerTerritory(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  s: number,
  available: Set<string>
): Experiment | null {
  const state = m.territory;
  if (!state) return null;
  let t = state.active;
  if (
    !t &&
    (state.last < m.turns || state.words?.primed?.ref === o.revision || state.words?.resume === o.revision)
  )
    t = offerCapacityWord(m, o, available);
  if (!t) {
    if (m.turns < 4 || m.turns <= state.last) return null;
    function* maps() {
      yield* territorialMaps(m, o, rows);
      yield* orbitTerritories(m, o, rows);
    }
    for (const map of maps()) {
      const contrasted=territorialControl(m,o,map,goalFor(map),s,available);
      if(contrasted){t=contrasted;break;}
      const plans = hypotheses(m, o, rows, map, s, available),
        plan = plans[0];
      if (!plan) continue;
      const choices: TerritorialTrial['choices'] = [],
        seen = new Set<string>();
      for (const p of plans) {
        const k = JSON.stringify([p.kind, p.siteAt, p.ideal]);
        if (seen.has(k)) continue;
        seen.add(k);
        choices.push({ kind: p.kind, site: p.siteAt, ideal: p.ideal, arrival: p.landing });
        if (choices.length === 6) break;
      }
      t = { goal: goalFor(map), plan, cursor: 0, choices };
      break;
    }
  }
  if (!t) return null;
  const step = t.plan.program[t.cursor];
  const local = o.entities.find((e) => e.signature === t.goal.actor && !e.identity_ambiguous);
  if (step?.from && (!local || !same([...local.position], step.from))) return null;
  if (!step || (!available.has(step.op) && !step.op.startsWith('ACTION6:'))) return null;
  return {
    phase: 'territorialAccess',
    origin: s,
    a: t.plan.program[0]!.op,
    b: step.op,
    refs: [...new Set([...t.plan.refs, ...(t.goal.failed ? [t.goal.failed] : [])])],
    rule: t.plan.kind,
    territorial: t,
  };
}
function backToLimit(g: Goal, from: XY): Step[] | null {
  const start = from.join(),
    dest = g.rim.join(),
    path = new Map<string, { from: XY; stroke: Stroke }>(),
    queue = [from];
  const inside = (p: XY) => {
    const n = terrainKey(p, g.width);
    return (
      p[0] >= 0 &&
      p[0] < g.width &&
      p[1] >= 0 &&
      g.home.some(([a, k]) => n >= a && n < a + k * g.stride[0] && (n - a) % g.stride[0] === 0)
    );
  };
  for (const p of queue) {
    if (p.join() === dest) break;
    for (const stroke of g.ops) {
      const next = add(p, stroke.d),
        k = next.join();
      if (!inside(next) || k === start || path.has(k)) continue;
      path.set(k, { from: p, stroke });
      queue.push(next);
    }
  }
  if (start !== dest && !path.has(dest)) return null;
  const steps: Step[] = [];
  let p = g.rim;
  while (p.join() !== start) {
    const v = path.get(p.join())!;
    steps.push({ op: v.stroke.op, stage: 'approach', from: v.from, to: p, ref: v.stroke.ref });
    p = v.from;
  }
  return [
    ...steps.reverse(),
    { op: g.ordinary, stage: 'challenge', from: g.rim, to: g.blocked, ref: g.failed ?? undefined },
  ];
}
export function recordTerritory(m: Memory, t: TerritorialTrial, b: NativeObservation, a: NativeObservation) {
  const state = m.territory!,
    step = t.plan.program[t.cursor]!,
    g = groupsOf(a),
    patient = resolveRole(g, { signature: t.goal.actor, fixed: [] }),
    marker = t.plan.site ? resolveRole(g, t.plan.site) : null,
    landed: XY | null = patient ? [...patient.position] : null,
    mark: XY | null = marker ? [...marker.position] : null;
  const won = a.levels_completed > b.levels_completed || a.state === 'WIN',
    live = a.state === b.state && a.level_epoch === b.level_epoch;
  const crossed = live && !!landed && inTerritory(t.goal, landed);
  const beforeMarker = t.plan.site ? resolveRole(groupsOf(b), t.plan.site) : null;
  const atContact = step.to ? !!landed && same(landed, step.to) : live;
  const markerMoved = !!beforeMarker && !!mark && !same([...beforeMarker.position], mark);
  const isWord = step.stage === 'capacity_input' || step.stage === 'capacity_read';
  const success =
    step.stage === 'capacity_return'
      ? live && a.frame_hash === step.expectedFrame
      : step.stage === 'capacity_input'
        ? live
        : step.stage === 'capacity_read'
          ? crossed ||
            (!!mark &&
              !!t.plan.ideal &&
              !!t.plan.siteAt &&
              !same(mark, t.plan.siteAt) &&
              same(mark, t.plan.ideal))
          : step.stage === 'approach' || step.stage === 'challenge' || step.stage === 'explore'
            ? !!landed && !!step.to && same(landed, step.to)
            : step.stage === 'displace'
              ? live &&
                markerMoved &&
                !!beforeMarker &&
                !!step.marker &&
                same([...beforeMarker.position], step.marker) &&
                !!mark &&
                !!step.expectedMarker &&
                same(mark, step.expectedMarker)
              : step.stage === 'land'
                ? crossed
                : live && (atContact || markerMoved || crossed);
  state.last = m.turns;
  state.tried[t.plan.key] = a.revision;
  state.goal = t.goal;
  const control=t.control&&step.stage==='interact'?recordTerritorialControl(m,t.control,a,live,t.cursor):undefined;
  if (t.goal.analogy && t.plan.kind === 'walk_to_analogue' && !success && !crossed) {
    const id = JSON.stringify([t.goal.actor, t.goal.analogy.near, t.goal.analogy.far]);
    const failures = (state.failedWalks ??= {});
    failures[id] = (failures[id] ?? 0) + 1;
  }
  if (step.stage === 'capacity_return' && state.words) {
    if (!success) (state.words.failedReturns ??= {})[t.plan.key] = a.revision;
    else if (t.cursor + 1 === t.plan.program.length) state.words.resume = a.revision;
  }
  if (!crossed && live && !isWord && step.stage === 'displace') openCapacityQuestion(m, t, b, a);
  if (crossed && step.stage !== 'explore') state.crossed = a.revision;
  if (
    crossed &&
    landed &&
    mark &&
    step.stage === 'land' &&
    t.plan.site &&
    !t.plan.site.fixed.length &&
    t.plan.ideal &&
    same(mark, t.plan.ideal)
  ) {
    const recipe: ReferenceRecipe = {
      q: step.op,
      role: { signature: t.goal.actor, fixed: [] },
      anchor: t.plan.site.signature,
      offset: diff(landed, mark),
      refs: [a.revision],
      placement: mark,
    };
    (state.crossingRecipes ??= {})[
      JSON.stringify([recipe.q, recipe.role.signature, recipe.anchor, recipe.offset])
    ] = recipe;
  }
  state.active =
    live && success && !crossed && t.cursor + 1 < t.plan.program.length
      ? { ...t, cursor: t.cursor + 1 }
      : null;
  if(control?.type==='setup'&&control.matched!==true)state.active=null;
  if (isWord && t.capacity) state.active = recordCapacityWord(m, t, b, a, crossed, won);
  if (
    live &&
    landed &&
    success &&
    !crossed &&
    step.stage === 'displace' &&
    t.goal.failed !== null &&
    t.plan.kind !== 'learned_transport' &&
    t.plan.kind !== 'imagined_transport'
  ) {
    const retest = backToLimit(t.goal, landed);
    if (retest)
      state.active = {
        ...t,
        cursor: t.cursor + 1,
        plan: { ...t.plan, program: [...t.plan.program.slice(0, t.cursor + 1), ...retest] },
      };
  }
  if (live && landed && success && !crossed && step.stage === 'challenge') {
    const distance = (p: XY) => size(diff(p, t.goal.foothold));
    const nearer = t.goal.ops
      .map((v) => ({ v, to: add(landed, v.d) }))
      .filter((x) => distance(x.to) < distance(landed))
      .sort((x, y) => distance(x.to) - distance(y.to))[0];
    if (nearer)
      state.active = {
        ...t,
        cursor: t.cursor + 1,
        plan: {
          ...t.plan,
          program: [
            ...t.plan.program.slice(0, t.cursor + 1),
            { op: nearer.v.op, stage: 'challenge', from: landed, to: nearer.to, ref: nearer.v.ref },
          ],
        },
      };
  }
  if (crossed && landed && step.stage !== 'explore') {
    for (const v of m.edges.flatMap((e) =>
      e.effect.moves
        .filter((d) => d.actor === t.goal.actor)
        .map((d) => ({ op: e.cmd, d: [d.dx, d.dy] as XY, ref: e.ref }))
    )) {
      const to = add(landed, v.d);
      if (!inTerritory(t.goal, to) || same(to, landed)) continue;
      state.active = {
        ...t,
        cursor: t.cursor + 1,
        plan: {
          ...t.plan,
          program: [
            ...t.plan.program.slice(0, t.cursor + 1),
            { stage: 'explore', op: v.op, from: landed, to, ref: v.ref },
          ],
        },
      };
      break;
    }
  }
  return {
    result:
      isWord && !won && !crossed && !success
        ? 'capacity_unconfirmed'
        : won
          ? 'territory_completion'
          : crossed
            ? 'territory_entry'
            : success
              ? 'territory_step'
              : 'territory_refuted',
    detail: { trial: t, stage: step.stage, landed, marker: mark, success, crossed, won, ...(control?{control}:{}) },
  };
}
