import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash } from './sic-study-source-replay.mjs';
import { geometryIndex, add, diff, length } from './source-corresponding-sites.mjs';

const [environment, directory, seedFile, output, space = 'same-colour'] = process.argv.slice(2);
if (!['same-colour', 'all'].includes(space)) throw Error('Invalid search space');
const sources = new Set(GAME_CATALOG.map((g) => g.code));
const seeds = JSON.parse(await readFile(seedFile, 'utf8'));
const runs = new Map();
for (let i = 0; i < 8; i++) {
  for (const line of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
    .trim()
    .split('\n')) {
    const r = JSON.parse(line);
    if (seeds.some((e) => e.code === r.code)) runs.set(r.code, r);
  }
}
const engine = await sourceBackend(resolve(environment));
const same = (p, q) => p && q && p[0] === q[0] && p[1] === q[1];
const address = (key) => (key.includes(':') ? key.split(':')[1].split(',').map(Number) : null);
const inside = (p, rows) => p[0] >= 0 && p[1] >= 0 && p[0] < rows[0].length && p[1] < rows.length;
const eqKey = (v) => v.join();
const sha = (data) => createHash('sha256').update(JSON.stringify(data)).digest('hex');

async function audit(seed) {
  const r = runs.get(seed.code);
  if (!r || !sources.has(r.code) || r.start !== 1 || r.resets || !seed.original?.exact)
    throw Error('Unverified source');
  const replay = sourceReplay(engine, {}, r),
    memo = new Map();
  const active = (b) => b && !replay.win(b) && b.state !== 'GAME_OVER';
  const step = (b, k) =>
    active(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? replay.act(k) : null;
  const setup = (word) => word.reduce(step, replay.restore(0));
  async function snap(b) {
    if (!active(b)) return null;
    const k = hash(b);
    if (!memo.has(k)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: k,
          level: r.start,
          levels_completed: b.levelsCompleted,
          state: b.state,
          available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
        },
        1
      );
      memo.set(k, geometryIndex(o.entities, b.frame));
    }
    return memo.get(k);
  }
  const ref = seed.original,
    word = ref.keys,
    plan = ref.selected,
    root = replay.restore(0);
  const prepared = setup(word),
    index = await snap(prepared),
    discharged = await snap(step(prepared, seed.probe));
  if (hash(prepared) !== ref.image || !discharged) throw Error('Seed geometry diverged');
  const role = [...index.ids.values()].filter(
    (e) => same(e.position, ref.p) && same(discharged.ids.get(e.signature)?.position, ref.actual)
  );
  if (role.length !== 1) throw Error('Ambiguous traveler');
  const body = role[0],
    exit = index.parts.find(
      (e) =>
        same(e.position, plan.exit) &&
        index.parts.some((f) => same(f.position, plan.entry) && e.geometry === f.geometry)
    );
  if (!exit) throw Error('Missing matched motifs');
  const landmark = (s, p) => !!s?.parts.some((x) => x.geometry === exit.geometry && same(x.position, p));
  const bindings = [];
  for (let i = 0; i < word.length; i++) {
    const before = setup(word.slice(0, i)),
      s = await snap(before),
      after = await snap(step(before, word[i]));
    const omitted = await snap(setup(word.filter((_, j) => j !== i)));
    const point = address(word[i]);
    bindings.push({
      at: i,
      kind: point ? 'address' : 'button',
      adds: !landmark(s, plan.exit) && landmark(after, plan.exit),
      removesOnOmission: !landmark(omitted, plan.exit),
      distance: point ? length(diff(plan.exit, point)) : null,
    });
  }
  const selected = bindings
    .filter((x) => x.kind === 'address' && x.removesOnOmission)
    .sort((a, b) => Number(b.adds) - Number(a.adds) || a.distance - b.distance)[0];
  if (!selected) return { code: r.code, bindings, status: 'no addressed exit control' };
  const at = selected.at,
    point = address(word[at]),
    origin = setup(word.slice(0, at)),
    rows = origin.frame;
  const ordinary = add(ref.p, seed.ordinary);
  const anchorDelta = diff(plan.exit, point);
  const visible = await snap(origin);
  const candidateMap = new Map();
  // Every predicted destination determines its required exit, then the command address.
  // Score local texture and the room for a next move near another visible feature.
  const nearby = visible.parts.filter(
    (e) => e.area > 1 && e.area < (rows.length * rows[0].length) / 8 && !same(e.position, plan.exit)
  );
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const goal = [x, y],
        needed = add(plan.entry, diff(goal, ordinary)),
        click = diff(needed, anchorDelta);
      if (
        same(goal, ref.actual) ||
        !inside(click, rows) ||
        !inside(needed, rows) ||
        (space === 'same-colour' && rows[click[1]][click[0]] !== rows[point[1]][point[0]])
      )
        continue;
      if (length(diff(goal, ref.p)) < 3 * length(seed.ordinary)) continue;
      const featureDistance = Math.min(100, ...nearby.map((e) => length(diff(goal, e.position))));
      let matches = 0,
        count = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const a = add(point, [dx, dy]),
            b = add(click, [dx, dy]);
          if (!inside(a, rows) || !inside(b, rows)) continue;
          matches += Number(rows[a[1]][a[0]] === rows[b[1]][b[0]]);
          count++;
        }
      const next = add(goal, seed.ordinary);
      if (!inside(next, rows)) continue;
      const score = matches / count + 0.1 / (1 + featureDistance);
      candidateMap.set(eqKey(goal), { goal, needed, click, score, next });
    }
  const ranked = [...candidateMap.values()].sort(
    (a, b) => b.score - a.score || length(diff(a.goal, ref.actual)) - length(diff(b.goal, ref.actual))
  );
  const first = [],
    covered = new Set();
  // First cover distinct parts of the board, then include the remaining legal placements.
  for (const p of ranked) {
    const region = p.goal.map((n) => Math.floor(n / Math.max(1, length(seed.ordinary)))).join();
    if (covered.has(region)) continue;
    first.push(p);
    covered.add(region);
  }
  const plans = [...new Set([...first, ...ranked])];
  const setDigest = sha(plans);
  const events = [],
    tallies = { trials: 0, unchangedActor: 0, placed: 0, exact: 0, nextExact: 0, won: 0, exactWon: 0 },
    distinct = new Set();
  const observedLandings = new Map(),
    observedGeometry = new Map();
  const top = { ...tallies },
    uniquePlacements = new Set(),
    examples = [];
  for (const [rank, p] of plans.entries()) {
    const keys = [...word];
    keys[at] = word[at].split(':')[0] + ':' + p.click.join();
    const b = setup(keys),
      s = await snap(b),
      start = s?.ids.get(body.signature)?.position;
    const pose = same(start, ref.p),
      placed = pose && landmark(s, plan.entry) && landmark(s, p.needed);
    const outcome = step(b, seed.probe),
      t = await snap(outcome),
      actual = t?.ids.get(body.signature)?.position;
    const exact = !!placed && same(actual, p.goal);
    const finish = step(outcome, seed.next),
      f = await snap(finish),
      next = f?.ids.get(body.signature)?.position;
    const won = !!finish && replay.win(finish);
    if (pose && actual) {
      const key = eqKey(actual);
      observedLandings.set(key, (observedLandings.get(key) ?? 0) + 1);
      const sites = s.parts
        .filter((e) => e.geometry === exit.geometry)
        .map((e) => eqKey(e.position))
        .sort()
        .join('/');
      observedGeometry.set(sites, (observedGeometry.get(sites) ?? 0) + 1);
    }
    const stat = {
      trials: 1,
      unchangedActor: Number(!!pose),
      placed: Number(!!placed),
      exact: Number(!!exact),
      nextExact: Number(!!exact && same(next, p.next) === true),
      won: Number(won),
      exactWon: Number(!!exact && won),
    };
    for (const k in stat) {
      tallies[k] += stat[k];
      if (rank < 12) top[k] += stat[k];
    }
    if (placed) uniquePlacements.add(eqKey(p.needed));
    if (exact) {
      distinct.add(eqKey(actual));
      const witness = {
        rank: rank + 1,
        goal: p.goal,
        needed: p.needed,
        click: p.click,
        keys,
        from: start,
        actual,
        next: next ?? null,
        nextPredicted: p.next,
        won,
        source: hash(b).slice(0, 16),
      };
      if (examples.length < 6) examples.push(witness);
      events.push(witness);
    }
  }
  return {
    code: r.code,
    status: 'measured',
    bindings,
    at,
    anchorDelta,
    setDigest,
    top,
    tallies,
    space,
    observedLandings: Object.fromEntries(observedLandings),
    observedGeometry: Object.fromEntries(observedGeometry),
    distinctPlacements: uniquePlacements.size,
    distinctArrivals: distinct.size,
    examples,
    events,
  };
}
const result = [];
for (const s of seeds) if (s.eligible) result.push(await audit(s));
await writeFile(output, JSON.stringify(result));
