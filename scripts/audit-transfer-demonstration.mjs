import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { recombineSites } from './recombine-source-site-operations.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { hash, sourceReplay } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import {
  readDemonstration,
  publicParts,
  candidates,
  changedAsExpected,
  same,
  inside,
  travel,
} from './source-transfer-demonstration.mjs';
import { add, diff, length } from './source-corresponding-sites.mjs';
const [environment, directory, receipts, output, ...entries] = process.argv.slice(2);
const relational = process.env.SIC_SOURCE_BIND_BY_EFFECT === '1';
const recombine = process.env.SIC_SOURCE_RECOMBINE_SITES === '1';
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  engine = await sourceBackend(resolve(environment));
const seeds = JSON.parse(await readFile(receipts, 'utf8'));
const starts = new Map();
for (let i = 0; i < 8; i++)
  for (const line of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
    .trim()
    .split('\n')) {
    const r = JSON.parse(line);
    starts.set(r.code, r);
  }
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const studies = [];
for (const seed of seeds) {
  if (!seed.eligible || !allowed.has(seed.code)) continue;
  const model = await readDemonstration(seed, sourceReplay(engine, programs, starts.get(seed.code)));
  if (model) studies.push({ seed: seed.code, model });
}
const spin = (p, r) => (r === 0 ? p : r === 1 ? [-p[1], p[0]] : r === 2 ? [-p[0], -p[1]] : [p[1], -p[0]]);
const centre = (e) => [(e.bbox[2] - e.bbox[0]) / 2, (e.bbox[3] - e.bbox[1]) / 2];
const rotateAnchor = (offset, extent, r) => diff(spin(add(offset, extent), r), extent);
const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function evaluate(code, level, study) {
  if (!allowed.has(code)) throw Error('Source only');
  const model = study.model;
  const replay = sourceReplay(engine, programs, { code, start: level }),
    observe = publicParts();
  function open() {
    let { b } = replay.openEntry();
    if (b.level !== level) {
      b = engine.dispatch({ type: 'load', code, level: 1 });
      for (let i = 1; i < level; i++) {
        const seq =
          i === 1
            ? programs.niveau_1[code]?.suite_gagnante
            : programs.niveaux_supérieurs.find((x) => x.code === code && x.l === i)?.seq;
        if (!seq || b.level !== i) return null;
        for (const k of seq) b = replay.act('ACTION' + k.replace('@', ':'));
      }
    }
    return b.level === level ? b : null;
  }
  const root = open();
  if (!root) return { code, level, status: 'entry unavailable' };
  const base = root.levelsCompleted;
  const win = (b) => !!b && (b.level > level || b.levelsCompleted > base || b.state === 'WIN'),
    active = (b) => !!b && !win(b) && b.state !== 'GAME_OVER';
  const issue = (b, k) =>
    active(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? replay.act(k) : null;
  const play = (keys) => keys.reduce(issue, open());
  const rootIndex = await observe(root);
  let setups = [{ word: [], entry: null, exit: null, weight: 0 }];
  const breadth = [];
  for (const s of recombine ? [] : model.steps) {
    const choices = new Map();
    for (const z of setups) {
      const scene = play(z.word),
        idx = await observe(scene);
      if (!scene.availableActionIds.includes(6)) continue;
      for (const { p, fidelity } of candidates(s, idx, scene.frame, relational)) {
        const step = 'ACTION6:' + p.join(),
          word = [...z.word, step];
        const next = issue(play(z.word), step);
        if (!active(next)) continue;
        const post = await observe(next);
        if (!changedAsExpected(s, scene, next, post, p, relational)) continue;
        const entry = s.entryOffset ? add(p, s.entryOffset) : z.entry,
          exit = s.exitOffset ? add(p, s.exitOffset) : z.exit;
        if (entry && exit && same(entry, exit)) continue;
        const id = hash(next) + '/' + entry + '/' + exit,
          weight = z.weight + fidelity;
        if (!choices.has(id) || choices.get(id).weight < weight)
          choices.set(id, { word, entry, exit, weight });
      }
    }
    setups = [...choices.values()].sort((a, b) => b.weight - a.weight).slice(0, 48);
    breadth.push(choices.size);
  }
  let search = null;
  if (recombine) {
    const { setups: observed, ...counts } = await recombineSites({
      root,
      model,
      observe,
      play,
      issue,
      active,
    });
    setups = observed;
    search = counts;
  }
  const counters = {
    calibrations: 0,
    catalogue: 0,
    planned: 0,
    arrivedAtTrigger: 0,
    executed: 0,
    exact: 0,
    ordinaryExact: 0,
    continued: 0,
    won: 0,
  };
  const catalogue = [];
  const rootActors = [...rootIndex.ids.values()].filter((e) => e.geometry === model.actorShape);
  for (const z of setups) {
    const scene = play(z.word),
      idx = await observe(scene);
    const mark = idx.parts.find((e) => e.geometry === model.markerShape && same(e.position, z.entry));
    if (!mark || !idx.parts.some((e) => e.geometry === model.markerShape && same(e.position, z.exit)))
      continue;
    const bodies = rootActors.map((e) => idx.ids.get(e.signature)).filter(Boolean);
    for (const body of bodies) {
      const extent = diff(centre(body), centre(mark)),
        cmdMap = new Map();
      for (const k of travel(scene)) {
        const n = issue(play(z.word), k);
        counters.calibrations++;
        if (!active(n)) continue;
        const to = (await observe(n)).ids.get(body.signature)?.position;
        if (!to) continue;
        const delta = diff(to, body.position);
        if (length(delta)) cmdMap.set(k, delta);
      }
      for (const [cmd, delta] of cmdMap) {
        const turns = [0, 1, 2, 3].filter((r) => same(spin(model.stride, r), delta));
        for (const turn of turns) {
          const from = add(z.entry, rotateAnchor(model.commandToEntry, extent, turn));
          const goal = add(z.exit, rotateAnchor(model.arrivalFromExit, extent, turn));
          const after = add(goal, delta);
          if (
            !inside(from, scene.frame) ||
            !inside(goal, scene.frame) ||
            !inside(after, scene.frame) ||
            length(diff(goal, from)) < 3 * length(delta)
          )
            continue;
          const mobile = new Set([body.signature, mark.signature]);
          const distances = idx.parts
            .filter(
              (e) =>
                e.area > 1 &&
                e.area < (scene.frame.length * scene.frame[0].length) / 8 &&
                !mobile.has(e.signature)
            )
            .map((e) => length(diff(after, e.position)));
          const utility =
            z.weight -
            Math.min(...distances, 32) / 32 -
            length(diff(from, body.position)) / (8 * length(delta));
          catalogue.push({
            setup: z.word,
            entry: z.entry,
            exit: z.exit,
            role: body.signature,
            cmd,
            delta,
            from,
            goal,
            after,
            utility,
          });
        }
      }
    }
  }
  counters.catalogue = catalogue.length;
  const plans = catalogue.sort((a, b) => b.utility - a.utility);
  const unique = new Set(),
    selected = [];
  // Cover different destinations before spending another approach on the same one.
  for (const p of plans) {
    const k = p.goal.join();
    if (unique.has(k)) continue;
    unique.add(k);
    selected.push(p);
  }
  const selectedPlans = [...new Set([...selected, ...plans])].slice(0, 24);
  const seal = sha(selectedPlans);
  counters.planned = selectedPlans.length;
  const examples = [],
    results = [];
  for (const p of selectedPlans) {
    const queue = [{ word: [], distance: Infinity }],
      visited = new Set();
    let hit = null;
    for (let count = 0; count < 64 && queue.length; count++) {
      queue.sort((a, b) => a.distance + a.word.length * 0.2 - (b.distance + b.word.length * 0.2));
      const node = queue.shift(),
        keys = [...p.setup, ...node.word],
        b = play(keys);
      if (!active(b) || visited.has(hash(b))) continue;
      const idx = await observe(b),
        body = idx.ids.get(p.role);
      if (!body) continue;
      visited.add(hash(b));
      if (same(body.position, p.from)) {
        hit = node.word;
        break;
      }
      for (const cmd of travel(b)) {
        const after = issue(play(keys), cmd);
        if (!active(after) || visited.has(hash(after))) continue;
        const to = (await observe(after)).ids.get(p.role)?.position;
        if (!to) continue;
        const distance = length(diff(p.from, to)) / length(p.delta);
        if (queue.some((q) => q.key === hash(after))) continue;
        queue.push({ word: [...node.word, cmd], key: hash(after), distance });
      }
    }
    if (!hit) {
      results.push({ goal: p.goal, reached: false });
      continue;
    }
    counters.arrivedAtTrigger++;
    const keys = [...p.setup, ...hit],
      b = play(keys),
      idx = await observe(b);
    const hasSite = (q) => idx.parts.some((e) => e.geometry === model.markerShape && same(e.position, q));
    if (!hasSite(p.entry) || !hasSite(p.exit)) {
      results.push({ goal: p.goal, reached: true, sites: false });
      continue;
    }
    const n = issue(b, p.cmd);
    counters.executed++;
    const to = active(n) ? (await observe(n)).ids.get(p.role)?.position : null,
      exact = same(to, p.goal);
    const end = issue(n, p.cmd),
      out = active(end) ? (await observe(end)).ids.get(p.role)?.position : null;
    counters.ordinaryExact += Number(same(to, add(p.from, p.delta)));
    counters.exact += Number(exact);
    counters.continued += Number(exact && same(out, p.after));
    counters.won += Number(exact && win(end));
    const e = { goal: p.goal, reached: true, sites: true, exact, won: win(end), to: to ?? null };
    results.push(e);
    if (exact)
      examples.push({
        ...e,
        entry: p.entry,
        exit: p.exit,
        from: p.from,
        after: p.after,
        observedAfter: out ?? null,
        setup: p.setup,
        approach: hit,
        cmd: p.cmd,
        initial: hash(root),
        prepared: hash(b),
        landed: hash(n),
      });
  }
  return {
    code,
    level,
    trainedOn: study.seed,
    relational,
    status: 'evaluated',
    initial: hash(root),
    breadth,
    roleCandidates: rootActors.length,
    counters,
    search,
    seal,
    distinctPredicted: unique.size,
    distinctExact: new Set(examples.map((x) => x.goal.join())).size,
    examples,
    results,
  };
}
const result = [];
for (const entry of entries) {
  const [code, l] = entry.split('/');
  for (const s of studies) result.push(await evaluate(code, Number(l), s));
}
await writeFile(output, JSON.stringify(result));
