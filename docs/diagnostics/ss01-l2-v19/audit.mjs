// Post-freeze replay with the frozen observer and movement measurement. No agent decisions are generated.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [environment, dir, output, chron] = process.argv.slice(2);
const mod = (p) => import(pathToFileURL(join(resolve(environment), p)));
const { measureNativeObservation } = await import(
  pathToFileURL(join(resolve(dir), 'projection-v19-eval-candidate/src/logos-engine/v6-native-observer.ts'))
);
const { measureEffect } = await import(
  pathToFileURL(join(resolve(dir), 'projection-v19-eval-candidate/src/sic/preparation-experiments.ts'))
);
const { SS01_LEVELS } = await mod('src/games/sinking-star/levels.ts');
const {
  compileLevel,
  initialState,
  stepWorld,
  renderWorld,
  reflectionPreviews,
  cellToPixel,
  SinkingStarSession,
} = await mod('src/games/sinking-star/core.ts');
const w = compileLevel(SS01_LEVELS[1]),
  s0 = initialState(w),
  w1 = compileLevel(SS01_LEVELS[0]);
const same = (a, b) => a.x === b.x && a.y === b.y;
const pos = (p) => p.x + ',' + p.y;
const hash = (f) => createHash('sha256').update(JSON.stringify(f)).digest('hex');
const local = (p, l = 2) => [
  p.x - Math.floor((20 - SS01_LEVELS[l - 1].rows[0].length) / 2) + 1,
  p.y - Math.floor((20 - SS01_LEVELS[l - 1].rows.length) / 2) + 1,
];
const id = (s) => [s.hero, ...s.mirrors].map(pos).join('|');
const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ],
  labels = new Map(),
  sizes = [];
for (let i = 0; i < 400; i++)
  if (w.tiles[i] === '.' && !labels.has(i)) {
    const cells = new Set([i]);
    for (const p of cells) {
      const x = p % 20,
        y = Math.floor(p / 20);
      for (const [dx, dy] of dirs) {
        const nx = x + dx,
          ny = y + dy,
          n = nx + 20 * ny;
        if (nx >= 0 && nx < 20 && ny >= 0 && ny < 20 && w.tiles[n] === '.') cells.add(n);
      }
    }
    for (const p of cells) labels.set(p, sizes.length);
    sizes.push(cells.size);
  }
const region = (p) => labels.get(p.x + 20 * p.y),
  top = region(s0.hero),
  left = region(s0.mirrors[1]),
  right = region(w.goal);
const names = { [top]: 'haut', [left]: 'gauche', [right]: 'droite' };
const fixed = new Map([[id(s0), s0]]),
  fixedX = [];
for (const s of fixed.values())
  for (const a of [1, 2, 3, 4, 5]) {
    const z = stepWorld(w, s, a);
    if (z.mirrors.some((m, i) => !same(m, s0.mirrors[i]))) continue;
    if (a === 5 && !same(z.hero, s.hero))
      fixedX.push({
        from: local(s.hero),
        to: local(z.hero),
        d: Math.abs(s.hero.x - s.mirrors[0].x) + Math.abs(s.hero.y - s.mirrors[0].y),
      });
    if (!fixed.has(id(z))) fixed.set(id(z), z);
  }
const room = new Map([[id(s0), { s: s0, path: [] }]]),
  outgoing = new Map();
for (const { s, path } of room.values())
  for (const a of [1, 2, 3, 4, 5]) {
    const z = stepWorld(w, s, a);
    if (region(z.hero) !== top) {
      if (region(z.hero) === left) {
        const k = pos(s.mirrors[0]),
          v = outgoing.get(k) ?? { place: local(s.mirrors[0]), cross: [] };
        v.cross.push({ start: local(s.hero), to: local(z.hero), path: [...path, 5], s: z });
        outgoing.set(k, v);
      }
      continue;
    }
    if (!room.has(id(z))) room.set(id(z), { s: z, path: [...path, a] });
  }
const reachable = new Set(),
  reverse = new Map();
for (const [from, { s }] of room)
  for (const a of [1, 2, 3, 4, 5]) {
    const z = stepWorld(w, s, a);
    if (region(z.hero) === left) reachable.add(from);
    if (region(z.hero) === top) {
      const set = reverse.get(id(z)) ?? new Set();
      set.add(from);
      reverse.set(id(z), set);
    }
  }
for (const key of reachable) for (const prev of reverse.get(key) ?? []) reachable.add(prev);
function finish(start) {
  const reached = new Map([[id(start), { s: start, path: [] }]]);
  for (const { s, path } of reached.values())
    for (const a of [1, 2, 3, 4, 5]) {
      const z = stepWorld(w, s, a);
      if (
        !same(z.mirrors[0], start.mirrors[0]) ||
        z.mirrors[1].x !== start.mirrors[1].x ||
        z.mirrors[1].y > s.mirrors[1].y ||
        z.mirrors[1].y < start.mirrors[1].y - 2
      )
        continue;
      const dest = region(z.hero);
      if (dest === top || (dest === right && z.mirrors[1].y !== start.mirrors[1].y - 2)) continue;
      if (z.complete) return [...path, a];
      if (!reached.has(id(z))) reached.set(id(z), { s: z, path: [...path, a] });
    }
}
let witness = null;
for (const entry of outgoing.values())
  for (const b of entry.cross) {
    const suffix = finish(b.s);
    if (suffix && (!witness || b.path.length + suffix.length < witness.length))
      witness = [...b.path, ...suffix];
  }
if (!witness) throw Error('No two-up witness');
const evidence = {
  meta: {
    engine: 'f4d28aee9ebbb35533bb97a26968efd22887473d',
    candidate: 'fc74c10aec27dd9e1f58ab3d97e9d919c8e4e942',
    control: '7f2cb3eb29a4bd7640c3c38b71107af86b521ad5',
    coordinate: '1-based local level rectangle, x right, y down',
  },
  world: {
    l1: {
      title: w1.title,
      merchants: [w1.start, ...w1.companions].map((p) => local(p, 1)),
      goals: w1.goals.map((p) => local(p, 1)),
      mirrors: w1.mirrors.map((p) => ({ place: local(p, 1), face: p.face })),
    },
    l2: {
      start: local(s0.hero),
      goals: w.goals.map((p) => local(p)),
      mirrors: s0.mirrors.map((p) => ({ place: local(p), face: p.face })),
      land: Object.fromEntries(sizes.map((n, i) => [names[i], n])),
      fixedReach: fixed.size,
      fixedX,
      reachableUpperPlacements: [...new Set([...room.values()].map((v) => pos(v.s.mirrors[0])))].length,
      crossingPlacements: [...outgoing].map(([key, v]) => ({
        at: v.place,
        crossings: v.cross.map((b) => ({ from: b.start, to: b.to })),
        eastmost: Math.max(
          ...[...room.values()]
            .map((x) => x.s)
            .filter((s) => pos(s.mirrors[0]) === key && s.hero.y === s.mirrors[0].y)
            .map((s) => local(s.hero)[0])
        ),
      })),
      witness,
      events: [],
    },
  },
  runs: {},
};
const session = new SinkingStarSession(SS01_LEVELS);
session.selectLevel(2);
let cs = s0;
for (const [i, a] of witness.entries()) {
  const z = stepWorld(w, cs, a),
    b = session.action(a);
  if (!z.complete && hash(b.frame) !== hash(renderWorld(w, z))) throw Error('Witness replay mismatch');
  const mi = z.mirrors.findIndex((p, i) => !same(p, cs.mirrors[i]));
  if (mi >= 0 || region(z.hero) !== region(cs.hero) || z.complete)
    evidence.world.l2.events.push({
      i: i + 1,
      a,
      from: local(cs.hero),
      to: local(z.hero),
      mirror: mi < 0 ? null : [local(cs.mirrors[mi]), local(z.mirrors[mi])],
      region: names[region(z.hero)],
      complete: z.complete,
    });
  cs = z;
}
if (!cs.complete || session.observe().levelsCompleted !== 1) throw Error('No official witness completion');
evidence.world.l2.witnessOfficial = session.observe().levelsCompleted;
const { routes } = await mod('tests/ss01-routes.ts');
const demo = new SinkingStarSession(SS01_LEVELS);
let demoState = initialState(w1);
const l1events = [];
for (const [i, c] of [...routes[0].replace(/([A-Z])(\d+)/g, (_, ch, n) => ch.repeat(Number(n)))].entries()) {
  let q = { U: 1, D: 2, L: 3, R: 4, X: 5, C: 6 }[c],
    data;
  if (c === 'C') {
    const p = cellToPixel(demoState.others[0]);
    data = { x: p.x + 1, y: p.y + 1 };
  }
  const z = stepWorld(w1, demoState, q, data),
    b = demo.action(q, data);
  if (c === 'X')
    l1events.push({
      n: i + 1,
      from: local(demoState.hero, 1),
      to: local(z.hero, 1),
      m: local(demoState.mirrors[0], 1),
      occupied: z.others.some((p) => same(p, demoState.hero)),
      changed: !same(demoState.hero, z.hero),
    });
  if (!z.complete && hash(renderWorld(w1, z)) !== hash(b.frame)) throw Error('L1 witness mismatch');
  demoState = z;
}
if (!demoState.complete || demo.observe().level !== 2) throw Error('L1 official fixture');
let sr = initialState(w1);
for (const a of [2, 4]) sr = stepWorld(w1, sr, a);
const sf = stepWorld(w1, sr, 5),
  sb = stepWorld(w1, sf, 5);
if (!same(sr.hero, sb.hero) || same(sr.hero, sf.hero)) throw Error('Non-reciprocal reference');
evidence.world.l1.reference = {
  events: l1events,
  roundTrip: [sr, sf, sb].map((s) => local(s.hero, 1)),
  completed: demo.observe().levelsCompleted,
};
let exchange = sf;
const cp = cellToPixel(exchange.others[0]);
exchange = stepWorld(w1, exchange, 6, { x: cp.x + 1, y: cp.y + 1 });
for (const op of [4, 4, 1]) exchange = stepWorld(w1, exchange, op);
const switched = stepWorld(w1, exchange, 5);
if (!same(switched.hero, exchange.others[0]) || !same(switched.others[0], exchange.hero))
  throw Error('No reciprocal exchange');
const wet = stepWorld(w1, initialState(w1), 4),
  wetPreview = reflectionPreviews(w1, wet).find((p) => same(p.from, wet.hero)),
  wetAfter = stepWorld(w1, wet, 5);
if (!wetPreview || w1.tiles[wetPreview.to.y * 20 + wetPreview.to.x] !== '~' || !same(wet.hero, wetAfter.hero))
  throw Error('Water control failed');
evidence.world.l1.exchange = {
  before: [exchange.hero, ...exchange.others].map((p) => local(p, 1)),
  after: [switched.hero, ...switched.others].map((p) => local(p, 1)),
};
evidence.world.l1.waterReflection = {
  from: local(wet.hero, 1),
  prospect: local(wetPreview.to, 1),
  valid: wetPreview.valid,
  actual: local(wetAfter.hero, 1),
};
evidence.world.l2.reachableStates = { upper: room.size, withEscape: reachable.size };
function localPixel(pt, l = 2) {
  if (!pt) return null;
  return local({ x: Math.floor((pt[0] - 2) / 3), y: Math.floor((pt[1] - 2) / 3) }, l);
}
async function audit(name, file) {
  const r = JSON.parse((await readFile(file, 'utf8')).trim()),
    es = new Map(r.preparation.map((e) => [e.actionIndex, e]));
  const game = new SinkingStarSession(SS01_LEVELS);
  game.selectLevel(r.start);
  let lv = r.start,
    board = game.observe(),
    world = compileLevel(SS01_LEVELS[lv - 1]),
    s = initialState(world);
  const hist = {},
    observed = new Map();
  async function obs(frame, lv) {
    const k = lv + '|' + hash(frame);
    if (!observed.has(k))
      observed.set(
        k,
        await measureNativeObservation(
          {
            frame_rows: frame,
            frame_hash: hash(frame),
            level: lv,
            levels_completed: 0,
            state: 'NOT_FINISHED',
            available_action_refs: [1, 2, 3, 4, 5].map((v) => 'ACTION' + v),
          },
          1
        )
      );
    return observed.get(k);
  }
  const playerPart = (o, p) => {
    const pt = cellToPixel(p);
    return o.entities.find(
      (e) =>
        e.palette_value === 12 &&
        e.bbox[0] >= pt.x &&
        e.bbox[2] <= pt.x + 2 &&
        e.bbox[1] >= pt.y &&
        e.bbox[3] <= pt.y + 2
    );
  };
  for (const [i, c] of r.replayCommands.entries()) {
    const n = i + 1,
      e = es.get(n),
      a = c.id,
      z = stepWorld(world, s, a, c.data);
    if (hash(board.frame).slice(0, 16) !== c.from) throw Error('Actual origin ' + name + ' ' + n);
    board = game.action(a, c.data);
    if (
      hash(board.frame).slice(0, 16) !== c.to ||
      (!z.complete && hash(renderWorld(world, z)) !== hash(board.frame))
    )
      throw Error('Actual result ' + n);
    const h = (hist[lv] ??= {
      tracking: {
        translations: 0,
        matched: 0,
        rotationsWithoutTravel: 0,
        firstMismatch: null,
        firstChangedShape: null,
        firstMatched: null,
        orientations: {},
        head: [],
      },
      selectedSwitches: 0,
      goalOccupancyMax: 0,
      globalTransfers: 0,
      firstGlobal: null,
      firstOccupiedGoal: null,
      firstLost: null,
      initialFeasibleX: 0,
      initialFeasibleByAction: {},
      actions: 0,
      position: new Set(),
      initialLayout: new Set(),
      regions: new Set(),
      pushed: [],
      teleports: [],
      distancePairs: {},
      validOpportunity: {},
      chosenAtOpportunity: {},
      touches: 0,
      failedPushes: 0,
      failedExamples: [],
      head: [],
      firstWater: null,
      firstWalk: null,
      firstOnEachAxis: {},
      landedOnGoal: [],
      firstReach: new Map(),
      layouts: new Set(),
      firstValid: null,
      firstReady: null,
      firstMirrorAlignment: null,
      firstActualTeleport: null,
      mirrorEntered: new Map(),
      activate: 0,
      failedActivations: 0,
      waterBumps: 0,
      stepsTaken: 0,
      choices: {},
      territorial: [],
    });
    h.actions++;
    const l = (p) => local(p, lv),
      at = l(s.hero),
      after = l(z.hero),
      mirror = s.mirrors[0],
      mi = z.mirrors.findIndex((p, j) => !same(s.mirrors[j], p)),
      sg = pos(mirror);
    if (!z.complete && a !== 6) {
      const fr = renderWorld(world, s),
        next = renderWorld(world, z),
        before = await obs(fr, lv),
        afterObs = await obs(next, lv);
      const orig = playerPart(before, s.hero),
        dest = playerPart(afterObs, z.hero),
        q = h.tracking,
        walked = !same(s.hero, z.hero);
      const effect = measureEffect(before, afterObs, fr, next);
      const match =
        !!orig &&
        !!dest &&
        effect.moves.some(
          (v) =>
            v.actor === orig.signature &&
            v.actor === dest.signature &&
            v.dx === (z.hero.x - s.hero.x) * 3 &&
            v.dy === (z.hero.y - s.hero.y) * 3
        );
      const detail = {
        n,
        a,
        from: l(s.hero),
        to: l(z.hero),
        facing: [s.facing, z.facing],
        before: orig?.signature.slice(0, 10) ?? null,
        after: dest?.signature.slice(0, 10) ?? null,
        match,
      };
      if (dest) (q.orientations[z.facing] ??= {})[dest.signature.slice(0, 10)] = 1;
      if (orig && dest && orig.signature !== dest.signature) {
        q.firstChangedShape ??= detail;
        if (!walked) q.rotationsWithoutTravel++;
      }
      if (walked) {
        q.translations++;
        if (match) {
          q.matched++;
          q.firstMatched ??= detail;
        } else q.firstMismatch ??= detail;
      }
      if (n <= 5) q.head.push(detail);
    }
    h.position.add(pos(s.hero));
    h.position.add(pos(z.hero));
    h.layouts.add(z.mirrors.map(pos).join('|'));
    h.choices[a] = (h.choices[a] ?? 0) + 1;
    if (s.mirrors.every((p, j) => same(p, world.mirrors[j]))) h.initialLayout.add(pos(s.hero));
    if (lv === 2) {
      h.regions.add(names[region(s.hero)]);
      h.regions.add(names[region(z.hero)]);
      if (!h.mirrorEntered.has(sg)) h.mirrorEntered.set(sg, { i: n, place: l(mirror) });
    }
    if (!h.firstReach.has(at.join())) h.firstReach.set(at.join(), n);
    if (a === 6 && !same(s.hero, z.hero)) h.selectedSwitches++;
    const occupied = world.goals.filter((g) => [z.hero, ...z.others].some((p) => same(g, p))).length;
    h.goalOccupancyMax = Math.max(h.goalOccupancyMax, occupied);
    if (occupied && !h.firstOccupiedGoal) h.firstOccupiedGoal = n;
    if (a === 5) {
      const movements = [s.hero, ...s.others].flatMap((p, j) => {
        const dest = [z.hero, ...z.others][j];
        return same(p, dest) ? [] : [{ selected: j === 0, from: l(p), to: l(dest) }];
      });
      h.globalTransfers += movements.length;
      if (movements.length) h.firstGlobal ??= { n, movements };
    }
    const valid = reflectionPreviews(world, s).filter(
      (p) => p.kind === 'merchant' && p.valid && same(s.hero, p.from)
    );
    if (e?.activation && a === 5 && !same(z.hero, s.hero)) {
      const event = e.activation,
        p = event.plan,
        fr = renderWorld(world, s),
        b = await obs(fr, lv),
        part = b.entities.find(
          (v) => v.signature === p.role.signature && !p.role.fixed.includes(v.position.join())
        );
      h.physicalActivation = {
        n,
        actual: [at, after],
        subjectBefore: localPixel(p.from, lv),
        subjectAfter: localPixel(event.arrived, lv),
        color: part?.palette_value ?? null,
        otherMerchants: s.others.map(l),
        moved: event.moved,
        verdict: e.result,
      };
    }
    const possible = valid.some((p) => !same(p.from, p.to)),
      useful = lv === 2 && valid.some((p) => region(p.from) !== region(p.to));
    if (lv === 2 && s.mirrors.every((p, j) => same(p, world.mirrors[j])) && possible) {
      h.initialFeasibleX++;
      h.initialFeasibleByAction[a] = (h.initialFeasibleByAction[a] ?? 0) + 1;
      (h.initialOpportunities ??= []).push({
        command: n, player: at, destination: l(valid[0].to), action: a,
        phase: e?.phase ?? null, hypothesis: e?.hypothesis ?? null, result: e?.result ?? null,
      });
    }
    if (
      lv === 2 &&
      region(s.hero) === top &&
      region(z.hero) === top &&
      reachable.has(id(s)) &&
      !reachable.has(id(z)) &&
      !h.firstLost
    ) {
      const alternatives = [1, 2, 3, 4, 5].map((op) => {
        const next = stepWorld(w, s, op);
        return { op, h: l(next.hero), m: l(next.mirrors[0]), escape: reachable.has(id(next)) };
      });
      const below = new Map([[id(z), z]]);
      for (const state of below.values())
        for (const op of [1, 2, 3, 4, 5]) {
          const next = stepWorld(w, state, op);
          if (!below.has(id(next))) below.set(id(next), next);
        }
      h.firstLost = {
        n,
        at,
        m: l(s.mirrors[0]),
        chosen: a,
        alternatives,
        descendantStates: below.size,
        descendantRegions: [...new Set([...below.values()].map((v) => names[region(v.hero)]))],
        descendantMirrorPoses: [...new Set([...below.values()].map((v) => l(v.mirrors[0]).join()))],
      };
    }
    if (possible) {
      h.validOpportunity[a] = (h.validOpportunity[a] ?? 0) + 1;
      if (!h.firstValid) h.firstValid = { n, at, m: l(mirror), to: l(valid[0].to), a };
    }
    if (useful) {
      h.chosenAtOpportunity[a] = (h.chosenAtOpportunity[a] ?? 0) + 1;
      if (!h.firstReady) h.firstReady = { n, at, m: l(mirror), to: l(valid[0].to), a };
    }
    const was = lv === 2 && outgoing.has(sg);
    if (was && !h.firstMirrorAlignment) h.firstMirrorAlignment = { n, at, m: l(mirror), a };
    const phase = e?.phase ?? null,
      hyp = e?.hypothesis ?? null;
    if (a <= 4) {
      const [dx, dy] = dirs[a - 1],
        nx = { x: s.hero.x + dx, y: s.hero.y + dy };
      const contact = s.mirrors.findIndex((p) => same(p, nx));
      if (contact >= 0) {
        h.touches++;
        if (mi < 0) {
          h.failedPushes++;
          if (h.failedExamples.length < 4)
            h.failedExamples.push({ n, at, m: l(s.mirrors[contact]), a, phase });
        }
      }
      if (world.tiles[nx.x + 20 * nx.y] === '~' && same(s.hero, z.hero)) {
        h.waterBumps++;
        h.firstWater ??= { n, at, water: l(nx), a };
      }
      if (!same(s.hero, z.hero)) {
        h.stepsTaken++;
        h.firstWalk ??= { n, at, to: after, a };
      }
    }
    if (mi >= 0)
      h.pushed.push({
        n,
        a,
        at,
        to: after,
        old: l(s.mirrors[mi]),
        now: l(z.mirrors[mi]),
        mi,
        phase,
        hyp,
        eligibleNext: lv === 2 && outgoing.has(pos(z.mirrors[0])),
      });
    if (a === 5) {
      h.activate++;
      if (!same(z.hero, s.hero)) {
        const j = s.mirrors.findIndex(
          (p) =>
            ((p.x === s.hero.x && p.y === z.hero.y) || (p.y === s.hero.y && p.x === z.hero.x)) &&
            Math.abs(p.x - s.hero.x) + Math.abs(p.y - s.hero.y) ===
              Math.abs(p.x - z.hero.x) + Math.abs(p.y - z.hero.y)
        );
        const m = s.mirrors[j],
          d = m ? Math.abs(m.x - s.hero.x) + Math.abs(m.y - s.hero.y) : null,
          axis = m?.x === s.hero.x ? 'S→E' : 'E→S',
          t = { n, at, to: after, m: m ? l(m) : null, d, axis, phase, hyp };
        h.teleports.push(t);
        h.firstOnEachAxis[axis] ??= t;
        h.firstActualTeleport ??= t;
        h.distancePairs[axis + '/' + d] = (h.distancePairs[axis + '/' + d] ?? 0) + 1;
      } else h.failedActivations++;
    }
    if (world.goals.some((p) => same(p, z.hero)) && !world.goals.some((p) => same(p, s.hero)))
      h.landedOnGoal.push(n);
    if (n <= 12) h.head.push({ n, a, at, to: after, phase });
    const t = e?.territorial?.trial;
    if (t) {
      const g = t.goal,
        plan = t.plan,
        project = (pt) => localPixel(pt, lv),
        stage = e.territorial.stage;
      const mp = plan.siteAt ? project(plan.siteAt) : null,
        actor = project(g.from);
      const inCells = (ranges, pixel) => {
        const k = pixel[1] * g.width + pixel[0];
        return ranges.some(([x, n]) => k >= x && k < x + n * g.stride[0] && (k - x) % g.stride[0] === 0);
      };
      const groundTruth = [...fixed.values()].map((x) => {
        const q = cellToPixel(x.hero);
        return [q.x, q.y];
      });
      const homeMatches = lv === 2 ? groundTruth.filter((pt) => inCells(g.home, pt)).length : null;
      const original = renderWorld(world, s);
      const obs = await measureNativeObservation(
        {
          frame_rows: original,
          frame_hash: hash(original),
          level: lv,
          levels_completed: 0,
          state: 'NOT_FINISHED',
          available_action_refs: [1, 2, 3, 4, 5].map((v) => 'ACTION' + v),
        },
        n
      );
      const nativeActor = obs.entities.find((v) => v.signature === g.actor && !v.identity_ambiguous);
      const reportEntity = (v) =>
        v
          ? {
              color: v.palette_value,
              box: v.bbox,
              area: v.area,
              anchor: project(v.position),
              cells: [...new Set(v.mask.map((d) => project([v.bbox[0] + d[0], v.bbox[1] + d[1]]).join()))],
            }
          : null;
      const mark =
        plan.site &&
        obs.entities.find(
          (v) => v.signature === plan.site.signature && !plan.site.fixed.includes(v.position.join())
        );
      const tracked = reportEntity(nativeActor),
        trackedMark = reportEntity(mark);
      const noPreview = renderWorld(world, s, false);
      const disappears =
        !!nativeActor &&
        nativeActor.mask.every((pt) => {
          const x = nativeActor.bbox[0] + pt[0],
            y = nativeActor.bbox[1] + pt[1];
          return (
            original[y][x] === nativeActor.palette_value && noPreview[y][x] !== nativeActor.palette_value
          );
        });
      const coincides =
        !!tracked &&
        reflectionPreviews(world, s).some(
          (p) => p.kind === 'merchant' && l(p.to).join() === tracked.anchor.join()
        );
      const pixel = cellToPixel(s.hero),
        realVisible = obs.entities
          .filter(
            (v) =>
              v.palette_value === 12 &&
              v.bbox[0] >= pixel.x &&
              v.bbox[2] <= pixel.x + 2 &&
              v.bbox[1] >= pixel.y &&
              v.bbox[3] <= pixel.y + 2
          )
          .map((v) => v.signature.slice(0, 10));
      const alternativePlaces = (t.choices ?? [])
        .map((ch) => (ch.ideal ? project(ch.ideal) : null))
        .filter(Boolean);
      h.territorial.push({
        n,
        a,
        tracked,
        trackedMark,
        disappears,
        coincides,
        realVisible,
        cursor: t.cursor,
        kind: plan.kind,
        basis: g.basis,
        stage,
        player: at,
        next: after,
        semanticMirror: l(mirror),
        targetFeature: mp,
        actualFeature: e.territorial.marker ? project(e.territorial.marker) : null,
        ideal: project(plan.ideal),
        foothold: project(g.foothold),
        home: g.homeSize,
        out: g.outsideSize,
        homeMatches,
        gactor: g.actor.slice(0, 10),
        actorStart: actor,
        knownLimit: g.failed,
        alternatives: alternativePlaces,
        siteSig: plan.site?.signature?.slice(0, 10) ?? null,
        actorIsHero: actor.join() === at.join(),
        success: e.territorial.success,
        changedMirror: mi >= 0,
      });
    }
    if (z.complete) {
      lv = board.level;
      world = compileLevel(SS01_LEVELS[lv - 1]);
      s = initialState(world);
    } else s = z;
  }
  for (const h of Object.values(hist)) {
    h.position = h.position.size;
    h.initialLayout = h.initialLayout.size;
    h.regions = [...h.regions];
    h.layouts = h.layouts.size;
    h.firstReach = Object.fromEntries(h.firstReach);
    h.mirrorEntered = [...h.mirrorEntered.values()];
  }
  evidence.runs[name] = {
    initial: r.initial,
    trajectory: r.trajectory,
    resets: r.resets,
    start: r.start,
    sourcePrefixActions: r.sourcePrefixActions ?? 0,
    issued: r.issued,
    official: board.levelsCompleted,
    finalLevel: board.level,
    reason: r.levels.map((v) => [v.level, v.reason, v.won]),
    hist,
  };
}
await audit('candidate', join(dir, 'matched19-candidate.jsonl'));
await audit('control', join(dir, 'matched19-control.jsonl'));
if (chron) await audit('chronological', chron);
// Branch at exactly the first observed valid initial reflection, then use the maximum eastward separation.
const raw = JSON.parse(await readFile(join(dir, 'matched19-candidate.jsonl'), 'utf8'));
const cutoff = evidence.runs.candidate.hist['2'].firstValid.n - 1;
const counter = new SinkingStarSession(SS01_LEVELS);
counter.selectLevel(2);
let prior = initialState(w);
for (const q of raw.replayCommands.slice(0, cutoff)) {
  prior = stepWorld(w, prior, q.id, q.data);
  const b = counter.action(q.id, q.data);
  if (hash(b.frame).slice(0, 16) !== q.to) throw Error('Fork divergence');
}
const base = [5, 3, 3, 3, 4, 4, 4, 4, 5];
let start = prior;
for (const a of base) start = stepWorld(w, start, a);
if (region(start.hero) !== left) throw Error('Maximum-separation history');
const tail = finish(start),
  program = [...base, ...tail],
  branchEvents = [];
let v = prior;
for (const [j, op] of program.entries()) {
  const z = stepWorld(w, v, op),
    b = counter.action(op);
  if (!z.complete && hash(b.frame) !== hash(renderWorld(w, z))) throw Error('Fork validation');
  if (op === 5 || z.complete)
    branchEvents.push({
      at: cutoff + j + 1,
      from: local(v.hero),
      to: local(z.hero),
      m: z.mirrors.map((p) => local(p)),
    });
  v = z;
}
if (!v.complete || counter.observe().levelsCompleted !== 1) throw Error('Unverified counterfactual');
evidence.world.l2.samePrefix = {
  actions: cutoff,
  firstDifferent: cutoff + 1,
  actual: raw.replayCommands[cutoff].id,
  alternative: program,
  events: branchEvents,
  official: counter.observe().levelsCompleted,
};
const verified = evidence.runs.candidate.hist[2],
  plans = verified.territorial.filter((v) => v.cursor === 0);
if (
  fixed.size !== 18 ||
  verified.initialOpportunities.map(v => v.command).join(',') !== '55,57,59,61,63,172' ||
  verified.initialOpportunities.some(v =>
    v.player.join(',') !== '8,4' || v.destination.join(',') !== '9,3' || v.action === 5
  ) ||
  outgoing.size !== 4 ||
  verified.firstLost.n !== 172 ||
  verified.firstLost.descendantStates !== 72 ||
  plans.length !== 22 ||
  plans.some((p) => !p.disappears || !p.coincides || p.actorIsHero) ||
  verified.tracking.matched !== 59 ||
  verified.tracking.translations !== 300
)
  throw Error('Diagnostic no longer matches the frozen comparison');
if (chron && evidence.runs.chronological.hist[1].physicalActivation.n !== 210)
  throw Error('Unexpected chronological run');
await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
