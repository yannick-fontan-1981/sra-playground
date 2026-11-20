import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { fitSpatialCapability, predictSpatialCapability } from '../src/sic/spatial-capability.ts';

// Source-only laboratory. Every held-out word and prediction is committed to memory before
// the first held-out action is sent. The archived winning suffix is a laboratory probe.
const [environment, directory, output, group = 'lower', shard = '0/1'] = process.argv.slice(2);
const read = async (path) => JSON.parse(await readFile(path, 'utf8'));
const programs = await read(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url));
const published = await read(
  new URL('../docs/architecture/sic-projected-affordances-results.json', import.meta.url)
);
const cases = [];
if (group === 'lower') {
  const rows = (
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
    )
  ).flatMap((t) => t.trim().split('\n').map(JSON.parse));
  if (rows.length !== 100 || new Set(rows.map((r) => r.code)).size !== 100)
    throw Error('Expected original cohort');
  for (const e of published.returnedOriginExperiments.originalL1.interventions.filter(
    (r) => r.swaps?.validation
  )) {
    const run = rows.find((r) => r.code === e.code);
    cases.push({
      run,
      begin: e.begin,
      word: e.placement,
      suffix: e.swaps.capability[1],
      destination: e.swaps.capability[0],
      actor: e.actor,
    });
  }
} else if (group === 'upper' || group === 'upper-motion') {
  for (const e of published.upperLevels) {
    if (!e.confirmed) throw Error('Unconfirmed source program');
    const seq = programs.niveaux_supérieurs
      .find((r) => r.code === e.code && r.l === e.level)
      .seq.map((c) => 'ACTION' + c.replace('@', ':'));
    const prefix = seq.slice(0, Math.max(0, seq.length - 6));
    cases.push({
      run: { code: e.code, start: e.level, sourcePrefixActions: e.entry === 'chronological' ? 1 : 0 },
      prefix,
      word: seq.slice(prefix.length, -2),
      suffix: seq.slice(-2),
      destination: 'WIN',
    });
  }
} else throw Error('Unknown cohort');
const engine = await sourceBackend(resolve(environment));
const digest = (s) => createHash('sha256').update(s).digest('hex');
const choose = (words, n) =>
  [...new Set(words.map((w) => w.join('/')))]
    .map((k) => [digest(k), k])
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .slice(0, n)
    .map(([, k]) => (k ? k.split('/') : []));
function interventions(word, vocab) {
  const singles = [[], word],
    doubles = [],
    insert = [];
  for (let i = 0; i < word.length; i++) {
    singles.push(word.filter((_, j) => j !== i));
    for (let j = i + 1; j < word.length; j++) {
      const swapped = word.slice();
      [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
      singles.push(swapped);
    }
  }
  const training = [];
  for (const initial of singles.filter((w) => w.length === word.length))
    for (let i = 0; i < word.length; i++)
      for (const a of vocab) {
        if (a === initial[i]) continue;
        const w = initial.slice();
        w[i] = a;
        training.push(w);
      }
  const train = choose([...singles, ...choose(training, 128)], 256),
    seen = new Set(train.map((w) => w.join('/')));
  for (let i = 0; i < word.length; i++)
    for (const a of vocab) {
      if (a === word[i]) continue;
      const w = word.slice();
      w[i] = a;
      for (let j = i + 1; j < word.length; j++)
        for (const b of vocab) {
          if (b === word[j]) continue;
          const x = w.slice();
          x[j] = b;
          doubles.push(x);
        }
      for (let j = 0; j <= w.length; j++)
        for (const b of vocab) insert.push([...w.slice(0, j), b, ...w.slice(j)]);
    }
  const fresh = (ws) => ws.filter((w) => !seen.has(w.join('/')));
  return { train, test: [...choose(fresh(doubles), 96), ...choose(fresh(insert), 96)] };
}
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const score = () => ({
  measured: 0,
  positiveCases: 0,
  classified: 0,
  correct: 0,
  called: 0,
  confirmed: 0,
  missed: 0,
});
function record(s, forecast, y) {
  s.measured++;
  s.positiveCases += Number(y);
  if (forecast === null) return;
  s.classified++;
  s.correct += Number(y === forecast);
  s.called += Number(forecast);
  s.confirmed += Number(forecast && y);
  s.missed += Number(!forecast && y);
}
async function intermediate(c) {
  const run = c.run,
    seq = [...c.prefix, ...c.word, ...c.suffix];
  const { openEntry, act, win } = sourceReplay(engine, programs, run);
  const active = (b) => b && !win(b) && b.state !== 'GAME_OVER';
  const poses = new Map();
  async function parts(b) {
    if (!active(b)) return {};
    const k = hash(b);
    if (!poses.has(k)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: k,
          level: 1,
          levels_completed: 0,
          state: b.state,
          available_action_refs: b.availableActionIds.map((id) => 'ACTION' + id),
        },
        1
      );
      poses.set(
        k,
        Object.fromEntries(
          o.entities
            .filter((e) => !e.identity_ambiguous && e.area < (b.frame.length * b.frame[0].length) / 4)
            .map((e) => [e.signature, e.position])
        )
      );
    }
    return poses.get(k);
  }
  let b = openEntry().b;
  const path = [await parts(b)];
  for (const k of seq) {
    if (!active(b)) throw Error('Premature source win');
    b = act(k);
    path.push(await parts(b));
  }
  if (!win(b)) throw Error('Unverified sequence');
  let best = null;
  for (let i = 1; i < seq.length - 1; i++)
    for (let depth = 1; depth <= Math.min(i, 4); depth++) {
      const begin = i - depth,
        from = path[begin],
        before = path[i],
        after = path[i + 1];
      b = openEntry().b;
      for (const k of seq.slice(0, begin)) b = act(k);
      if (!b.availableActionIds.includes(Number(seq[i].split(':')[0].slice(6)))) continue;
      const bare = await parts(act(seq[i]));
      for (const [actor, pos] of Object.entries(before)) {
        if (!from[actor] || !after[actor] || !bare[actor] || !dist(pos, after[actor])) continue;
        const delta = after[actor].map((v, j) => v - pos[j]),
          control = bare[actor].map((v, j) => v - from[actor][j]);
        if (
          delta.join() === control.join() ||
          !Object.keys(before).some((peer) => peer !== actor && from[peer] && dist(before[peer], from[peer]))
        )
          continue;
        const following =
          i + 2 === seq.length ? 'WIN' : path[i + 2][actor]?.map((v, j) => v - after[actor][j]);
        if (!following || (following !== 'WIN' && following.every((v) => !v))) continue;
        const priority =
          Number(!dist(from[actor], pos)) * 4 +
          Number(!dist(from[actor], bare[actor])) * 2 +
          Number(following === 'WIN');
        if (!best || priority > best.priority)
          best = {
            priority,
            run,
            prefix: seq.slice(0, begin),
            word: seq.slice(begin, i),
            suffix: [seq[i]],
            destination: after[actor].join(),
            actor,
            follow: { key: seq[i + 1], effect: following },
            sameOrigin: !dist(from[actor], pos),
            inactiveBare: !dist(from[actor], bare[actor]),
          };
      }
    }
  return best;
}

async function audit(c) {
  const { run, word, suffix, destination } = c;
  if (!GAME_CATALOG.some((g) => g.code === run.code)) throw Error('Not a source entry');
  const { act, restore, openEntry, win } = sourceReplay(engine, programs, run);
  const active = (b) => b && !win(b) && b.state !== 'GAME_OVER';
  function step(b, k) {
    return active(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? act(k) : null;
  }
  function entry() {
    if (!c.prefix) return restore(c.begin);
    let { b } = openEntry();
    if (b.level !== run.start) throw Error('Divergent level');
    for (const k of c.prefix) b = step(b, k);
    if (!active(b)) throw Error('Divergent source prefix');
    return b;
  }
  const obs = new Map();
  async function positions(b) {
    const key = hash(b);
    if (!obs.has(key)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: key,
          level: 1,
          levels_completed: 0,
          state: b.state,
          available_action_refs: b.availableActionIds.map((id) => 'ACTION' + id),
        },
        1
      );
      obs.set(
        key,
        Object.fromEntries(
          o.entities
            .filter((e) => !e.identity_ambiguous && e.area < (b.frame.length * b.frame[0].length) / 4)
            .map((e) => [e.signature, e.position])
        )
      );
    }
    return obs.get(key);
  }
  const initial = entry(),
    start = await positions(initial);
  let b = initial;
  const path = [start];
  for (const k of word) {
    b = step(b, k);
    if (!active(b)) throw Error('Reference placement diverged');
    path.push(await positions(b));
  }
  const placed = path.at(-1),
    undisturbed = Object.keys(start).filter((id) => path.every((p) => p[id]));
  let refBoard = b,
    following = null;
  for (const [i, k] of suffix.entries()) {
    refBoard = step(refBoard, k);
    if (!refBoard) throw Error('Reference suffix failed');
    if (i === 0 && active(refBoard)) following = await positions(refBoard);
  }
  if (destination === 'WIN' && !win(refBoard)) throw Error('Unreproduced source win');
  const travel = (id) => path.slice(1).reduce((n, p, i) => n + dist(p[id], path[i][id]), 0);
  const actor =
    c.actor ??
    undisturbed
      .slice()
      .sort(
        (a, b) =>
          (following?.[b] ? dist(following[b], placed[b]) : 0) -
            (following?.[a] ? dist(following[a], placed[a]) : 0) ||
          travel(b) - travel(a) ||
          a.localeCompare(b, 'en')
      )[0];
  const result = { code: run.code, level: run.start };
  if (!actor || !start[actor] || !placed[actor]) return { ...result, excluded: 'no measurable actor' };
  if (
    destination !== 'WIN' &&
    (!active(refBoard) || (await positions(refBoard))[actor]?.join() !== destination)
  )
    throw Error('Unreproduced source destination');
  const primary = undisturbed
    .filter((id) => id !== actor && dist(start[id], placed[id]))
    .sort((a, b) => dist(start[b], placed[b]) - dist(start[a], placed[a]) || a.localeCompare(b, 'en'))
    .slice(0, 3);
  if (!primary.length) return { ...result, excluded: 'no relocated partner' };
  const vocab = [
    ...new Set([
      ...initial.availableActionIds.filter((id) => id !== 6).map((id) => 'ACTION' + id),
      ...word,
      ...suffix,
      ...(c.prefix ?? run.steps.slice(0, c.begin).map(op)).filter((k) => k.startsWith('ACTION6:')).slice(-4),
    ]),
  ];
  const { train, test } = interventions(word, vocab),
    edges = new Map();
  const layout = (p) =>
    p[actor]
      ? { actor: p[actor], objects: Object.fromEntries(Object.entries(p).filter(([id]) => id !== actor)) }
      : null;
  const joint = (l) => [l.actor, ...primary.map((id) => l.objects[id] ?? '?')].join('/');
  async function prepare(keys, learn = false) {
    let b = entry(),
      p = start;
    for (const k of keys) {
      const beforeKey = learn ? hash(b) : null;
      b = step(b, k);
      if (!active(b)) return null;
      if (learn) {
        const next = await positions(b),
          key = beforeKey + '/' + k;
        if (!edges.has(key)) edges.set(key, { k, from: p, to: next, target: hash(b) });
        p = next;
      }
    }
    const l = layout(learn ? p : await positions(b));
    return l && primary.every((id) => l.objects[id]) ? { b, l, key: hash(b) } : null;
  }
  async function consequence({ b, l }) {
    for (const k of suffix) {
      b = step(b, k);
      if (!b) return false;
    }
    if (destination === 'WIN') return win(b);
    if (!active(b)) return false;
    const pos = (await positions(b))[actor];
    return pos
      ? pos.every((v, i) => v - l.actor[i] === Number(destination.split(',')[i]) - placed[actor][i])
      : null;
  }
  const samples = new Map(),
    conflicts = new Set();
  for (const w of train) {
    const prepared = await prepare(w, true);
    if (!prepared) continue;
    const y = await consequence(prepared);
    if (y === null) continue;
    if (samples.has(prepared.key) && samples.get(prepared.key).outcome !== y) conflicts.add(prepared.key);
    samples.set(prepared.key, { layout: prepared.l, outcome: y });
  }
  for (const key of conflicts) samples.delete(key);
  const history = [...samples.values()],
    knownJoint = new Set(history.map((s) => joint(s.layout)));
  const modes = ['pair', 'board', 'landmarks'],
    models = Object.fromEntries(modes.map((m) => [m, fitSpatialCapability(history, primary, m)]));
  const yes = history.filter((s) => s.outcome).length,
    majority = yes * 2 > history.length;
  const first = {},
    counts = () => Object.fromEntries([...modes, 'majority', 'imagined'].map((m) => [m, score()]));
  const unseen = counts(),
    unseenJoint = counts(),
    seen = new Set([...samples.keys(), ...conflicts]),
    seenJoint = new Set(knownJoint);
  const byCommand = new Map();
  for (const e of edges.values()) {
    const a = byCommand.get(e.k) ?? [];
    a.push(e);
    byCommand.set(e.k, a);
  }
  function imagine(keys) {
    let current = start;
    let image = hash(initial);
    for (const k of keys) {
      const exact = image === null ? null : edges.get(image + '/' + k);
      if (exact) {
        current = exact.to;
        image = exact.target;
        continue;
      }
      image = null;
      const prior = byCommand.get(k);
      if (!prior?.length) return null;
      const roles = [actor, ...primary];
      if (!roles.every((id) => current[id])) return null;
      const contextual = prior
        .filter((e) => roles.every((id) => e.from[id] && e.to[id]))
        .map((e) => ({
          edge: e,
          distance: roles.reduce((n, id) => n + dist(current[id], e.from[id]), 0),
        }));
      const near = Math.min(...contextual.map((x) => x.distance));
      const context = contextual.filter((x) => x.distance === near).map((x) => x.edge);
      const next = {};
      for (const [id, at] of Object.entries(current)) {
        let nearest = Infinity;
        const ends = new Map();
        for (const e of context) {
          const from = e.from[id],
            to = e.to[id];
          if (!from || !to) continue;
          const d = dist(from, at);
          if (d > nearest) continue;
          if (d < nearest) {
            nearest = d;
            ends.clear();
          }
          const end = at.map((v, i) => v + to[i] - from[i]);
          const p = ends.get(end.join()) ?? { end, n: 0 };
          p.n++;
          ends.set(end.join(), p);
        }
        const vs = [...ends.values()].sort((a, b) => b.n - a.n);
        if (vs.length && vs[0].n * 2 > vs.reduce((n, v) => n + v.n, 0)) next[id] = vs[0].end;
      }
      current = next;
    }
    return current[actor] && primary.every((id) => current[id]) ? layout(current) : null;
  }
  async function continued(w) {
    const r = await prepare(w);
    const landed = step(r.b, suffix[0]),
      before = (await positions(landed))[actor],
      next = step(landed, c.follow.key);
    const after = active(next) ? (await positions(next))[actor] : null;
    return c.follow.effect === 'WIN'
      ? !!next && win(next)
      : !!before && !!after && after.every((v, i) => v - before[i] === c.follow.effect[i]);
  }
  if (process.argv.includes('--alternatives')) {
    const { qualifyPreparationAlternatives } = await import('./qualify-preparation-alternatives.mjs');
    const alternatives = await qualifyPreparationAlternatives({
      word,
      vocab,
      actor,
      primary,
      model: models.board,
      edges,
      prepare,
      consequence,
      known: knownJoint,
      baseline: samples,
      follow: c.follow ? continued : null,
    });
    return { ...result, source: destination === 'WIN' ? 'official' : 'role displacement', alternatives };
  }
  const plans = test.map((w) => {
    const l = imagine(w);
    return { w, l, forecast: l ? predictSpatialCapability(models.board, l) : null };
  });
  const selected =
    plans.find((p) => p.forecast && !knownJoint.has(joint(p.l))) ?? plans.find((p) => p.forecast);
  let exact = 0,
    imagined = 0,
    selection = null;
  for (const p of plans) {
    const ready = await prepare(p.w);
    if (!ready) {
      if (p === selected) selection = { word: p.w, legal: false };
      continue;
    }
    const forecasts = Object.fromEntries(modes.map((m) => [m, predictSpatialCapability(models[m], ready.l)]));
    forecasts.majority = majority;
    forecasts.imagined = p.forecast;
    const y = await consequence(ready);
    if (y === null) continue;
    const j = joint(ready.l),
      isExact = !!p.l && joint(p.l) === j;
    if (p === selected)
      selection = {
        word: p.w,
        legal: true,
        exact: isExact,
        works: y,
        unseenImage: !samples.has(ready.key),
        unseenJoint: !knownJoint.has(j),
      };
    if (p === selected && y && c.follow) selection.follow = await continued(p.w);
    if (seen.has(ready.key)) continue;
    seen.add(ready.key);
    if (p.l) {
      imagined++;
      exact += Number(isExact);
    }
    const newJoint = !seenJoint.has(j);
    seenJoint.add(j);
    for (const [m, v] of Object.entries(forecasts)) {
      record(unseen[m], v, y);
      if (newJoint) record(unseenJoint[m], v, y);
    }
    if (newJoint && y && forecasts.landmarks === true && forecasts.board !== true && !first.extra)
      first.extra = {
        word: p.w,
        suffix,
        actor: ready.l.actor,
        partners: primary.map((id) => ready.l.objects[id]),
      };
  }
  if (selection?.works) {
    const w = selection.word,
      words = new Map();
    for (let mask = 0; mask < (1 << w.length) - 1; mask++) {
      const sub = w.filter((_, i) => mask & (1 << i));
      words.set(sub.join('/'), sub);
    }
    const result = { count: words.size, unknown: 0, alsoWork: 0, shortest: null, bare: null };
    for (const sub of words.values()) {
      const ready = await prepare(sub),
        y = ready ? await consequence(ready) : null;
      if (!sub.length) result.bare = y;
      if (y === null) result.unknown++;
      if (y) {
        result.alsoWork++;
        if (!result.shortest || result.shortest.length > sub.length) result.shortest = sub;
      }
    }
    selection.omissions = result;
  }
  return {
    ...result,
    source: destination === 'WIN' ? 'official' : 'role displacement',
    ...(c.follow ? { follow: c.follow, sameOrigin: c.sameOrigin, inactiveBare: c.inactiveBare } : {}),
    role: actor,
    primary,
    trainingWords: train.length,
    trainingImages: history.length,
    positive: yes,
    conflicts: conflicts.size,
    heldOutWords: test.length,
    models,
    unseen,
    unseenJoint,
    imagined,
    exact,
    selection,
    first,
  };
}
const [index, n] = shard.split('/').map(Number),
  results = [];
for (const c of cases.filter((_, i) => i % n === index)) {
  const experiment = group === 'upper-motion' ? await intermediate(c) : c;
  results.push(
    experiment
      ? await audit(experiment)
      : {
          code: c.run.code,
          level: c.run.start,
          excluded: 'no differential movement followed by another movement or victory',
        }
  );
}
await writeFile(output, JSON.stringify(results));
console.log(
  JSON.stringify({ entries: results.length, modeled: results.filter((r) => r.models?.landmarks).length })
);
