import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { initialMemory, recordExperiment } from '../src/sic/preparation-experiments.ts';
import { accessLaws, landing } from '../src/sic/spatial-access-laws.ts';
import { samplesFor, fitMotion, projectedStep } from '../src/sic/projected-motion.ts';
const [environment, directory, input, output] = process.argv.slice(2);
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));
const cases = await read(input),
  programs = await read(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url));
const info = await read(
  new URL('../docs/architecture/sic-projected-affordances-results.json', import.meta.url)
);
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  lower = new Map(),
  engine = await sourceBackend(resolve(environment));
for (let i = 0; i < 8; i++)
  for (const line of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
    .trim()
    .split('\n')) {
    const r = JSON.parse(line);
    lower.set(r.code, r);
  }
const equal = (a, b) => !!a && !!b && a.join() === b.join();
async function verify(r) {
  if (!allowed.has(r.code)) throw Error('Source only');
  let run = lower.get(r.code),
    prefixLength;
  if (r.level === 1)
    prefixLength = run.levels[0].won ? run.steps.length - 3 : Math.min(8, run.steps.length - 3);
  else {
    const metadata = info.upperLevels.find((x) => x.code === r.code && x.level === r.level && x.confirmed);
    if (!metadata) throw Error('Unconfirmed upper entry');
    run = { code: r.code, start: r.level, sourcePrefixActions: Number(metadata.entry === 'chronological') };
    prefixLength =
      programs.niveaux_supérieurs.find((x) => x.code === r.code && x.l === r.level).seq.length - 3;
  }
  const rep = sourceReplay(engine, programs, run);
  const init = rep.openEntry().b.levelsCompleted;
  const win = (b) => !!b && (b.level > r.level || b.levelsCompleted > init || b.state === 'WIN');
  const active = (b) => !!b && !win(b) && b.state !== 'GAME_OVER';
  const act = (b, k) =>
    active(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? rep.act(k) : null;
  const setup = (word) => {
    let b;
    if (r.level === 1) b = rep.restore(prefixLength);
    else {
      b = rep.openEntry().b;
      const seq = programs.niveaux_supérieurs.find((x) => x.code === r.code && x.l === r.level).seq;
      for (const k of seq.slice(0, prefixLength)) b = act(b, 'ACTION' + k.replace('@', ':'));
    }
    return word.reduce(act, b);
  };
  const cache = new Map(),
    observations = new Map();
  async function positions(b) {
    if (!active(b)) return new Map();
    const key = hash(b);
    if (!cache.has(key)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: key,
          level: b.level,
          levels_completed: b.levelsCompleted,
          state: b.state,
          available_action_refs: b.availableActionIds.map((x) => 'ACTION' + x),
        },
        1
      );
      observations.set(key, o);
      cache.set(
        key,
        new Map(o.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e.position]))
      );
    }
    return cache.get(key);
  }
  const keys = new Set(),
    edges = new Set(),
    dest = new Set(),
    independent = new Set();
  const stats = {
    guards: 0,
    tests: 0,
    exact: 0,
    equalPartner: 0,
    swaps: 0,
    partnerHeld: 0,
    bareAtSameOrigin: 0,
    bareCannotReach: 0,
    reused: 0,
    reusedExact: 0,
    useChangesDisplacement: 0,
    official: 0,
    distinctVerifiedPairs: 0,
  };
  const witnesses = [];
  const production = { supported: 0, exact: 0, projected: 0, projectedExact: 0 };
  for (const p of r.examples) {
    const memory = initialMemory(1);
    let revision = 1;
    for (const c of p.training) {
      let s = setup([]);
      memory.previous = -1;
      for (const cmd of [...c.word, p.trigger]) {
        const a = act(s, cmd);
        await positions(s);
        await positions(a);
        const [name, point] = cmd.split(':'),
          [x, y] = point?.split(',').map(Number) ?? [];
        recordExperiment(
          memory,
          { ...observations.get(hash(s)), revision },
          { ...observations.get(hash(a)), revision: revision + 1 },
          { action_ref: name, data: point ? { x, y } : {} },
          s.frame,
          a.frame
        );
        revision++;
        s = a;
      }
      const b = setup(c.word),
        before = await positions(b),
        a = act(b, p.trigger),
        after = await positions(a);
      if (
        hash(b) !== c.key ||
        !equal(before.get(p.actor), p.departure) ||
        !equal(before.get(p.partner), c.x) ||
        !equal(after.get(p.actor), c.y)
      )
        throw Error('Invalid reference');
      stats.guards++;
    }
    const laws = accessLaws(memory, new Set([p.actor, p.partner]), new Set([p.trigger])).filter(
      (l) => l.kind === 'anchor' && l.actor === p.actor && l.anchor === p.partner
    );
    const samples = samplesFor(memory.edges, [p.actor, p.partner], new Set([p.trigger])).get(p.trigger);
    const projection = samples?.length ? fitMotion(p.trigger, samples) : null;
    const root = setup([]),
      rootActor = (await positions(root)).get(p.actor),
      bare = (await positions(act(root, p.trigger))).get(p.actor);
    const exact = new Set();
    for (const c of p.targets) {
      if (p.training.some((s) => equal(s.x, c.partnerAt) || equal(s.y, c.target)))
        throw Error('Target was a calibration coordinate');
      const b = setup(c.word),
        before = await positions(b);
      if (
        hash(b) !== c.key ||
        parseInt(c.key.slice(0, 2), 16) % 2 !== 1 ||
        c.word.length < 2 ||
        !equal(before.get(p.actor), p.departure) ||
        !equal(before.get(p.partner), c.partnerAt)
      )
        throw Error('Unheld preparation');
      const a = act(b, p.trigger),
        after = await positions(a);
      const pos = after.get(p.actor),
        good = equal(pos, c.target);
      const originalLaw = laws.some((l) => equal(landing(l, p.departure, c.partnerAt), c.target));
      production.supported += Number(originalLaw);
      production.exact += Number(originalLaw && good);
      const projected =
        projection && equal(projectedStep(projection, [p.departure, c.partnerAt])[0], c.target);
      production.projected += Number(!!projected);
      production.projectedExact += Number(!!projected && good);
      if (good !== c.exact || (!equal(pos, c.actual) && (pos || c.actual)) || win(a) !== c.won)
        throw Error('Forecast result differs');
      const event = c.key + '/' + p.trigger;
      edges.add(event);
      keys.add(event + '/' + p.actor);
      stats.tests++;
      stats.exact += Number(good);
      stats.official += Number(win(a));
      if (!good) continue;
      exact.add(c.target.join());
      dest.add(c.target.join());
      stats.equalPartner += Number(equal(pos, c.partnerAt));
      stats.swaps += Number(equal(after.get(p.partner), p.departure));
      stats.partnerHeld += Number(equal(after.get(p.partner), c.partnerAt));
      const comparable = equal(rootActor, p.departure) && !!bare;
      stats.bareAtSameOrigin += Number(comparable);
      stats.bareCannotReach += Number(comparable && !equal(bare, pos));
      const proof = {
        from: p.departure,
        trigger: p.trigger,
        setup: c.word,
        partnerAt: c.partnerAt,
        forecast: c.target,
        observed: pos,
        bare: comparable ? bare : null,
      };
      if (c.continuation) {
        const f = p.follow,
          end = act(a, f.cmd),
          got = (await positions(end)).get(p.actor);
        const followed = f.win
          ? win(end)
          : equal(
              got,
              c.target.map((n, i) => n + f.delta[i])
            );
        if (followed !== c.continuation.exact || win(end) !== c.continuation.won)
          throw Error('Continuation differs');
        stats.reused++;
        stats.reusedExact += Number(followed);
        stats.official += Number(win(end));
        const bareUse = (await positions(act(setup(c.word), f.cmd))).get(p.actor);
        if (bareUse && got && bareUse.some((v, i) => v - p.departure[i] !== got[i] - c.target[i]))
          stats.useChangesDisplacement++;
        proof.use = {
          command: f.cmd,
          expected: c.continuation.expected,
          observed: got ?? null,
          bareUse: bareUse ?? null,
        };
      }
      if (!independent.has(event) && witnesses.length < 8) {
        witnesses.push(proof);
        independent.add(event);
      }
    }
    stats.distinctVerifiedPairs += Number(exact.size >= 2);
  }
  return {
    code: r.code,
    level: r.level,
    stats,
    production,
    distinctActionOutcomes: edges.size,
    distinctRolePredictions: keys.size,
    distinctDestinationCoordinates: dest.size,
    witnesses,
  };
}
const verified = [];
for (const r of cases) if (r.examples.length) verified.push(await verify(r));
await writeFile(output, JSON.stringify(verified));
