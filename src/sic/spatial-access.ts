import type { NativeObservation, NativeRows, NativeEntity } from '../logos-engine/v6-native-types.ts';
import type { Edge, Experiment, Memory } from './preparation-experiments.ts';
import { accessLaws, landing, lawId, type AccessLaw } from './spatial-access-laws.ts';
import { add, diff, point, same, size, terrain, type XY, type Floor } from './access-terrain.ts';

type Consequence = { op: string; from: XY; to: XY; newPosition: boolean; featureGain: number };
type Interest = {
  newGroundRegion: boolean;
  closerToFeature: number;
  distinguishesControl: boolean;
  productiveNext: Consequence | null;
  testsFrameOfReference: boolean;
  setupCost: number;
  priorMisses: number;
};
type Leg = { op: string; p: XY; q: XY };
export type AccessCard = {
  interest?: Interest;
  law: AccessLaw;
  source: XY;
  initialAnchor: XY;
  launch: XY;
  anchorAt: XY;
  destination: XY;
  legs: Leg[];
  originScene: number;
  replay?: boolean;
  control: string | null;
  regionChange: boolean;
  ground: number;
  newPosition: boolean;
  score: number;
};
export type SpatialMemory = {
  floor: Floor;
  blocked: Record<string, number>;
  tested: Record<string, number>;
  misses: Record<string, number>;
  setupMisses: Record<string, number>;
  confirmed: Record<string, { card: AccessCard; destinationScene: number; verifiedAt: number; uses: number }>;
  continuation: { scene: number; card: AccessCard } | null;
  active: { card: AccessCard; step: number } | null;
};
export const newSpatialMemory = (): SpatialMemory => ({
  floor: {},
  blocked: {},
  tested: {},
  misses: {},
  setupMisses: {},
  confirmed: {},
  continuation: null,
  active: null,
});
export const layoutKey = (c: AccessCard) => [lawId(c.law), c.launch, c.anchorAt].join('|');
const blockedKey = (l: AccessLaw, p: XY, q: XY, op: string) => [l.actor, l.anchor, p, q, op].join('|');
const spatialEntity = (o: NativeObservation, id: string) =>
  o.entities.find((e) => !e.identity_ambiguous && e.signature === id);
const at = (e: NativeEntity): XY => [...e.position];
function poses(o: NativeObservation, l: AccessLaw) {
  const a = spatialEntity(o, l.actor),
    b = l.anchor ? spatialEntity(o, l.anchor) : a;
  return a && b ? { p: at(a), q: at(b) } : null;
}
function motionOptions(edges: Edge[], l: AccessLaw, commands: Set<string>) {
  const ops = new Map<string, Map<string, { op: string; p: XY; q: XY; n: number }>>();
  for (const e of edges) {
    if (!e.stable || !commands.has(e.cmd) || !e.anchors[l.actor] || (l.anchor && !e.anchors[l.anchor]))
      continue;
    const a = e.effect.moves.find((v) => v.actor === l.actor),
      b = l.anchor ? e.effect.moves.find((v) => v.actor === l.anchor) : a;
    if (!a && !b) continue;
    const p: XY = a ? [a.dx, a.dy] : [0, 0],
      q: XY = b ? [b.dx, b.dy] : [0, 0];
    if (e.cmd === l.op && (l.kind === 'anchor' || same(p, l.offset))) continue;
    const table = ops.get(e.cmd) ?? new Map(),
      key = [p, q].join('|'),
      v = table.get(key) ?? { op: e.cmd, p, q, n: 0 };
    v.n++;
    table.set(key, v);
    ops.set(e.cmd, table);
  }
  return [...ops.values()].map(
    (v) => [...v.values()].sort((a, b) => b.n - a.n || size(a.p) + size(a.q) - size(b.p) - size(b.q))[0]!
  );
}
function ordinaryEffects(edges: Edge[], actor: string, trigger: string, commands: Set<string>) {
  const by = new Map<string, Map<string, Set<string>>>();
  for (const e of edges) {
    if (!e.stable || !commands.has(e.cmd) || e.cmd === trigger) continue;
    const v = e.effect.moves.find((d) => d.actor === actor);
    if (!v) continue;
    const choices = by.get(e.cmd) ?? new Map<string, Set<string>>(),
      key = [v.dx, v.dy].join();
    const sites = choices.get(key) ?? new Set<string>();
    sites.add(v.from);
    choices.set(key, sites);
    by.set(e.cmd, choices);
  }
  return [...by].flatMap(([op, choices]) => {
    const [best] = [...choices].sort((a, b) => b[1].size - a[1].size);
    if (
      !best ||
      best[1].size < 2 ||
      [...choices.values()].some((v) => v !== best[1] && v.size >= best[1].size)
    )
      return [];
    return [{ op, d: point(best[0]) }];
  });
}
function presentLabel(l: AccessLaw) {
  return l.kind === 'anchor' ? 3 : witnessedAlignment(l) ? 2 : 1;
}
const witnessedAlignment = (l: AccessLaw) => l.kind === 'alignment';
function featureGain(
  o: NativeObservation,
  mobile: Set<string>,
  actor: NativeEntity,
  locations: XY[],
  rows: NativeRows
) {
  const dx = (actor.bbox[2] - actor.bbox[0]) / 2,
    dy = (actor.bbox[3] - actor.bbox[1]) / 2;
  const features = o.entities
    .filter((e) => !mobile.has(e.signature) && e.area <= (rows.length * rows[0]!.length) / 10)
    .map((e) => {
      const distance = (p: XY) =>
        Math.max(0, e.bbox[0] - p[0] - dx, p[0] + dx - e.bbox[2]) +
        Math.max(0, e.bbox[1] - p[1] - dy, p[1] + dy - e.bbox[3]);
      return { distance, best: Math.min(...locations.map(distance)) };
    });
  return (p: XY) =>
    features.reduce((score, f) => {
      const d = f.distance(p);
      return Math.max(score, d < f.best ? Math.min(14, f.best - d) + (d <= 2 ? 15 : 0) : 0);
    }, 0);
}

function catalogue(m: Memory, o: NativeObservation, rows: NativeRows, commands: Set<string>, s: number) {
  const present = new Set(o.entities.filter((e) => !e.identity_ambiguous).map((e) => e.signature));
  const laws = accessLaws(m, present, commands).sort(
    (a, b) =>
      presentLabel(b) - presentLabel(a) ||
      Number(b.reciprocal) - Number(a.reciprocal) ||
      b.sites.length - a.sites.length ||
      size(b.offset) - size(a.offset)
  );
  const mobile = new Set(m.edges.flatMap((e) => e.effect.moves.map((v) => v.actor)));
  const stationary = new Set<string>();
  for (const e of m.edges)
    if (e.stable)
      for (const id of e.visibleAfter ?? [])
        if (e.anchors[id] && !e.effect.moves.some((v) => v.actor === id))
          stationary.add([id, e.anchors[id]!.at, e.cmd].join('/'));
  const successes = new Set(Object.values(m.space.confirmed).map((v) => lawId(v.card.law)));
  const viable = laws.filter((l) => (m.space.misses[lawId(l)] ?? 0) < 5);
  const explained = new Set(
    viable
      .filter((l) => l.kind === 'anchor' && (l.reciprocal || successes.has(lawId(l))))
      .flatMap((l) => l.deltas.map((d) => [l.actor, l.op, d].join('|')))
  );
  const terrains = new Map<string, ReturnType<typeof terrain>>(),
    cards: AccessCard[] = [];
  for (const l of viable
    .filter((l) => l.kind !== 'stride' || !explained.has([l.actor, l.op, l.offset].join('|')))
    .slice(0, 16)) {
    const qualified = successes.has(lawId(l));
    const horizon = qualified ? 12 : 2;
    const initial = poses(o, l)!,
      actor = spatialEntity(o, l.actor)!,
      anchor = spatialEntity(o, l.anchor) || actor;
    const fitted = terrainFor(actor);
    const seen = new Set<string>(),
      locations: XY[] = [];
    for (const e of m.edges)
      for (const v of e.effect.moves)
        if (v.actor === l.actor)
          for (const p of [v.from, v.to])
            if (!seen.has(p)) {
              seen.add(p);
              locations.push(point(p));
            }
    const gain = featureGain(o, mobile, actor, locations, rows),
      cached = new Map<string, number>();
    const improvement = (p: XY) => {
      const k = p.join();
      let n = cached.get(k);
      if (n === undefined) {
        n = gain(p);
        cached.set(k, n);
      }
      return n;
    };
    const visitedRegions = new Set(locations.map(fitted.region));
    const steps = motionOptions(m.edges, l, commands),
      direct = m.edges.find((e) => e.stable && e.s === s && e.cmd === l.op);
    const control = direct
      ? (direct.effect.moves.find((v) => v.actor === l.actor)?.to ??
        (direct.visibleAfter?.includes(l.actor) ? initial.p.join() : null))
      : null;
    const firstRegion = fitted.region(initial.p),
      queue = [{ ...initial, legs: [] as Leg[] }],
      visited = new Set([initial.p + '|' + initial.q]);
    const candidates: AccessCard[] = [];
    const ordinary = ordinaryEffects(m.edges, l.actor, l.op, commands);
    const inside = (p: XY, e: NativeEntity) =>
      p[0] >= 0 &&
      p[1] >= 0 &&
      p[0] + e.bbox[2] - e.position[0] < rows[0]!.length &&
      p[1] + e.bbox[3] - e.position[1] < rows.length;
    for (let i = 0; i < queue.length && i < 512; i++) {
      const n = queue[i]!,
        dest = landing(l, n.p, n.q);
      if (dest && inside(dest, actor) && !same(dest, n.p)) {
        const dstRegion = fitted.region(dest),
          launchRegion = fitted.region(n.p);
        const cross = !!launchRegion && !!dstRegion && launchRegion !== dstRegion;
        const novel = !seen.has(dest.join()),
          contrast = !!control && same(n.p, initial.p) && control !== dest.join();
        const card: AccessCard = {
          law: l,
          source: initial.p,
          initialAnchor: initial.q,
          launch: n.p,
          anchorAt: n.q,
          destination: dest,
          legs: n.legs,
          originScene: s,
          control,
          regionChange: cross,
          ground: fitted.ground,
          newPosition: novel,
          score: 0,
        };
        if (
          !m.space.tested[layoutKey(card)] &&
          (novel || contrast || (cross && !visitedRegions.has(dstRegion))) &&
          (n.legs.length || !direct) &&
          (l.kind !== 'stride' || novel)
        ) {
          const nearest = locations.reduce((d, p) => Math.min(d, size(diff(dest, p))), Infinity);
          const nextOptions: Consequence[] = [];
          for (const move of ordinary) {
            const to = add(dest, move.d);
            if (
              !inside(to, actor) ||
              seen.has(to.join()) ||
              (dstRegion && fitted.region(to) !== dstRegion) ||
              m.blocked[[l.actor, ...dest, move.op].join('/')] ||
              stationary.has([l.actor, dest.join(), move.op].join('/'))
            )
              continue;
            nextOptions.push({
              op: move.op,
              from: dest,
              to,
              newPosition: true,
              featureGain: improvement(to),
            });
          }
          nextOptions.sort((a, b) => b.featureGain - a.featureGain);
          const next = nextOptions[0] ?? null;
          const testsFrameOfReference = l.kind === 'anchor' && same(n.p, initial.p) && !same(n.q, initial.q);
          card.interest = {
            testsFrameOfReference,
            newGroundRegion: cross && !visitedRegions.has(dstRegion),
            closerToFeature: improvement(dest),
            distinguishesControl: contrast,
            productiveNext: next,
            setupCost: n.legs.length,
            priorMisses: m.space.misses[lawId(l)] ?? 0,
          };
          card.score =
            (next ? 10 + Math.min(12, next.featureGain) : 0) +
            (cross && !visitedRegions.has(dstRegion) ? (qualified ? 125 : 45) : cross ? 32 : 0) +
            (novel ? 24 : 0) +
            (contrast ? 20 : 0) +
            (testsFrameOfReference ? 24 : 0) +
            (l.kind === 'anchor' ? 22 : 0) +
            (l.reciprocal ? 7 : 0) +
            (dstRegion ? 12 : 0) +
            (firstRegion && launchRegion === firstRegion ? 5 : 0) +
            Math.min(18, nearest) +
            improvement(dest) -
            n.legs.length * 3 -
            (m.space.misses[lawId(l)] ?? 0) * 9 -
            Math.min(20, m.space.setupMisses[lawId(l)] ?? 0);
          candidates.push(card);
        }
      }
      if (n.legs.length >= horizon) continue;
      for (const step of steps) {
        const p = add(n.p, step.p),
          q = add(n.q, step.q),
          key = p + '|' + q;
        if (
          visited.has(key) ||
          !inside(p, actor) ||
          !inside(q, anchor) ||
          m.space.blocked[blockedKey(l, n.p, n.q, step.op)] ||
          (size(step.p) > 0 && (m.blocked[[l.actor, ...n.p, step.op].join('/')] ?? 0) > 0)
        )
          continue;
        visited.add(key);
        queue.push({ p, q, legs: [...n.legs, { op: step.op, p, q }] });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    cards.push(...candidates.slice(0, 4));
  }
  for (const saved of Object.values(m.space.confirmed)) {
    if (
      saved.card.originScene !== s ||
      saved.uses ||
      !commands.has(saved.card.law.op) ||
      ![...commands].some((op) => !m.edges.some((e) => e.s === saved.destinationScene && e.cmd === op))
    )
      continue;
    cards.push({ ...saved.card, replay: true, score: 80 - saved.card.legs.length * 3 });
  }
  const unique = new Set<string>();
  return cards
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const key = [c.destination, c.law.op, c.launch, c.anchorAt].join('|');
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    })
    .slice(0, 8);
  function terrainFor(actor: NativeEntity) {
    let t = terrains.get(actor.signature);
    if (!t) {
      t = terrain(rows, actor, mobile, o, m.space.floor);
      terrains.set(actor.signature, t);
    }
    return t;
  }
}

export function proposeAccess(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  commands: Set<string>,
  s: number
): Experiment | null {
  const continuation = m.space.continuation;
  if (continuation?.scene === s) {
    const options = [...commands].filter((op) => !m.edges.some((e) => e.s === s && e.cmd === op));
    const planned = continuation.card.interest?.productiveNext?.op;
    const op =
      planned && options.includes(planned) ? planned : options.find((op) => op !== continuation.card.law.op);
    if (op)
      return {
        phase: 'accessContinue',
        a: op,
        b: op,
        rule: lawId(continuation.card.law),
        origin: s,
        refs: continuation.card.law.refs,
        access: { card: continuation.card, step: continuation.card.legs.length, alternatives: [] },
      };
  }
  if (!m.space.active && (m.recurrences < 2 || m.turns % 8 === 0)) return null;
  const active = m.space.active;
  let cards: AccessCard[] = [];
  if (active) {
    const expected = active.step
      ? active.card.legs[active.step - 1]!
      : { p: active.card.source, q: active.card.initialAnchor };
    const actual = poses(o, active.card.law);
    if (!actual || !same(expected.p, actual.p) || !same(expected.q, actual.q)) m.space.active = null;
  }
  if (!m.space.active) cards = catalogue(m, o, rows, commands, s);
  const card = m.space.active?.card ?? cards[0];
  if (!card) return null;
  const step = m.space.active?.step ?? 0,
    leg = card.legs[step],
    op = leg?.op ?? card.law.op;
  if (!commands.has(op)) return null;
  return {
    phase: leg ? 'accessSetup' : 'accessTrigger',
    a: op,
    b: op,
    rule: lawId(card.law),
    origin: s,
    refs: card.law.refs,
    access: {
      card,
      step,
      alternatives: cards.slice(1, 5).map((c) => ({
        actor: c.law.actor,
        anchor: c.law.anchor,
        op: c.law.op,
        setup: c.legs.map((leg) => leg.op),
        launch: c.launch,
        anchorAt: c.anchorAt,
        destination: c.destination,
        regionChange: c.regionChange,
        interest: c.interest,
        score: c.score,
      })),
    },
  };
}

export function recordAccess(m: Memory, x: Experiment, b: NativeObservation, a: NativeObservation) {
  const { card, step, alternatives } = x.access!,
    actual = poses(a, card.law),
    leg = card.legs[step];
  // The actor can remain identifiable even if the other body changes form on activation.
  const traveler = spatialEntity(a, card.law.actor),
    observed = traveler ? at(traveler) : null;
  let result: string;
  m.space.active = null;
  m.space.continuation = null;
  const receipt=m.space.confirmed[layoutKey(card)];
  if(card.replay && receipt && step===0 && x.phase!=='accessContinue') receipt.uses++;
  if (a.levels_completed > b.levels_completed || a.state === 'WIN') {
    result='official_completion';
  } else if (a.state!==b.state || a.level_epoch!==b.level_epoch) {
    result='terminal_without_landing';
  } else if (x.phase === 'accessContinue') {
    const expected = card.interest?.productiveNext;
    result =
      expected && x.b === expected.op
        ? observed && same(observed, expected.to)
          ? 'predicted_continuation_verified'
          : 'predicted_continuation_refuted'
        : 'tested_destination_continuation';
  } else if (leg) {
    if (actual && same(actual.p, leg.p) && same(actual.q, leg.q)) {
      m.space.active = { card, step: step + 1 };
      result = 'layout_step_verified';
    } else {
      const origin = poses(b, card.law);
      if (origin) m.space.blocked[blockedKey(card.law, origin.p, origin.q, leg.op)] = 1;
      m.space.setupMisses[lawId(card.law)] = (m.space.setupMisses[lawId(card.law)] ?? 0) + 1;
      result = 'layout_step_refuted';
    }
  } else {
    m.space.tested[layoutKey(card)] = a.revision;
    if (observed && same(observed, card.destination)) {
      result = 'predicted_landing_verified';
      const known = m.space.confirmed[layoutKey(card)],
        destinationScene = m.revisionScene[a.revision]!;
      m.space.confirmed[layoutKey(card)] = {
        card: known?.card ?? card,
        destinationScene,
        verifiedAt: a.revision,
        uses: known?.uses ?? 0,
      };
      m.space.continuation = { scene: destinationScene, card };
    } else {
      result = observed ? 'predicted_landing_refuted' : 'traveler_unresolved';
      m.space.misses[lawId(card.law)] = (m.space.misses[lawId(card.law)] ?? 0) + 1;
    }
  }
  return {
    result,
    detail: {
      kind: card.law.kind,
      actor: card.law.actor,
      anchor: card.law.anchor,
      trigger: card.law.op,
      origin: card.source,
      initialAnchor: card.initialAnchor,
      launch: card.launch,
      placed: card.anchorAt,
      predicted: card.destination,
      observed,
      control: card.control,
      ground: card.ground,
      regionChange: card.regionChange,
      interest: card.interest,
      score: card.score,
      issued: x.b,
      newPosition: card.newPosition,
      reused: !!card.replay,
      setup: card.legs.map((k) => k.op),
      step,
      alternatives,
    },
  };
}
