import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
const [env, dir, sealPath, output, cohort] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env));
const split = process.argv.find((arg) => arg.startsWith('--shorter-shard='))?.split('=')[1] ?? '0/1';
const [part, total] = split.split('/').map(Number);
if (!Number.isInteger(part) || !Number.isInteger(total) || part < 0 || part >= total)
  throw Error('Invalid shorter-path shard');
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const files =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const runs = new Map();
for (const f of files)
  for (const line of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    runs.set(r.code + '/' + r.start, r);
  }
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1],
  results = [];
for (const row of JSON.parse(await readFile(sealPath, 'utf8'))) {
  if (
    !GAME_CATALOG.some((g) => g.code === row.code) ||
    createHash('sha256').update(JSON.stringify(row.inverses)).digest('hex') !== row.inverseSeal
  )
    throw Error('Invalid sealed source cohort');
  const counts = {},
    examples = [],
    r = runs.get(row.code + '/' + row.level),
    rep = sourceReplay(engine, programs, r),
    read = publicParts();
  const active = (b) => !!b && !rep.win(b) && b.state !== 'GAME_OVER';
  const inc = (k, b = true) => (counts[k] = (counts[k] ?? 0) + Number(!!b));
  async function pos(b, role) {
    if (!active(b)) return null;
    const cls = (await read(b)).parts.filter((e) => e.signature === role.signature);
    if (
      cls.length !== role.fixed.length + 1 ||
      !role.fixed.every((k) => cls.some((e) => e.position.join() === k))
    )
      return null;
    return cls.find((e) => !role.fixed.includes(e.position.join()))?.position ?? null;
  }
  for (const p of row.inverses) {
    let b = rep.restore(p.i - 1);
    if (!hash(b).startsWith(p.root) || !p.nested) throw Error('Invalid root or projection');
    const anchor = { signature: p.anchor, fixed: [] };
    inc('trials');
    if (!p.nested.firstKnown) inc('unmeasuredFirstAction');
    let path = true;
    for (const stage of p.nested.trace) {
      if (!active(b) || !b.availableActionIds.includes(Number(p.a.slice(6).split(':')[0]))) {
        b = null;
        break;
      }
      b = rep.act(p.a);
      path = path && eq(await pos(b, anchor), stage.at) && eq(await pos(b, p.role), stage.patient);
    }
    const a = await pos(b, anchor),
      s = await pos(b, p.role),
      last = p.nested.trace.at(-1);
    if (!a || !s) continue;
    inc('measurable');
    const prior = eq(a, p.placement),
      now = eq(a, last.at),
      bothOld = prior && eq(s, p.patient),
      bothNew = now && eq(s, last.patient);
    inc('ordinaryPlacement', prior);
    inc('nestedPlacement', now);
    inc('ordinaryPair', bothOld);
    inc('nestedPair', bothNew);
    inc('entirePath', path);
    inc('correctRejection', !prior && now);
    inc('incorrectRevision', prior && !now);
    if (!p.nested.firstKnown) {
      inc('unmeasuredOrdinary', prior);
      inc('unmeasuredNested', now);
    }
    if (!eq(a, p.at)) {
      inc('actuallyMoved');
      inc('movingOrdinary', prior);
      inc('movingNested', now);
    }
    if (!b.availableActionIds.includes(Number(p.q.slice(6).split(':')[0]))) continue;
    b = rep.act(p.q);
    const arrived = await pos(b, p.role);
    if (!arrived) continue;
    inc('measurableArrival');
    inc('ordinaryArrival', eq(arrived, p.to));
    inc('nestedArrival', eq(arrived, p.nested.to));
    inc('ordinaryChain', bothOld && eq(arrived, p.to) && !eq(arrived, s));
    inc('nestedChain', bothNew && eq(arrived, p.nested.to) && !eq(arrived, s));
    if (!bothNew || !eq(arrived, p.nested.to) || eq(arrived, s) || eq(a, p.at)) continue;
    const run = (word) => {
      let state = rep.restore(p.i - 1);
      for (const command of word) {
        if (!active(state) || !state.availableActionIds.includes(Number(command.slice(6).split(':')[0])))
          return null;
        state = rep.act(command);
      }
      return state;
    };
    const alone = await pos(run([p.q]), p.role);
    if (!alone || eq(alone, arrived)) continue;
    inc('controlledNew');
    inc('fixedTraveller', eq(s, p.from));
    inc('separateActions', p.a !== p.q);
    const example = {
      i: p.i,
      setup: p.a,
      length: p.length,
      q: p.q,
      before: p.at,
      placement: a,
      from: p.from,
      patient: s,
      alone,
      arrival: arrived,
      knownFirst: p.nested.firstKnown,
    };
    if (examples.length < 4) examples.push(example);
    if (process.argv.includes('--shorter') && p.a !== p.q && !eq(p.from, arrived)) {
      const clicks = [
        ...new Set(
          r.steps
            .slice(0, p.i - 1)
            .map(op)
            .filter((k) => k.startsWith('ACTION6:'))
        ),
      ];
      const cmds = (b) => b.availableActionIds.flatMap((n) => (n === 6 ? clicks : ['ACTION' + n]));
      const short = {
        maxLength: Math.min(2, p.length),
        examined: 0,
        unidentified: 0,
        hits: 0,
        withoutSetup: 0,
        first: null,
      };
      if (total > 1) short.partition = split;
      example.shorter = short;
      const alternatives = new Set();
      const matched = { layouts: 0, identifiable: 0, forecasts: 0, distinctArrivals: 0, examples: [] };
      example.matchedTraveller = matched;
      async function scan(word) {
        const b = run(word),
          where = await pos(b, p.role);
        if (word.length) {
          short.examined++;
          if (!where) short.unidentified++;
          if (eq(where, arrived)) {
            short.hits++;
            if (!word.includes(p.a)) short.withoutSetup++;
            short.first ??= word;
          }
        }
        if (eq(where, s)) {
          const reference = await pos(b, anchor);
          if (reference && !eq(reference, a) && !alternatives.has(hash(b))) {
            alternatives.add(hash(b));
            const target = p.axes.map(
              (axis, j) => p.offset[j] + (axis === 'self' ? where[j] : axis === 'world' ? 0 : reference[j])
            );
            const actual = await pos(run([...word, p.q]), p.role);
            matched.layouts++;
            if (actual) {
              matched.identifiable++;
              if (eq(target, actual)) matched.forecasts++;
              if (!eq(actual, arrived)) matched.distinctArrivals++;
            }
            if (total > 1 || matched.examples.length < 3)
              matched.examples.push({ frame: hash(b), word, reference, target, actual });
          }
        }
        if (active(b) && word.length < short.maxLength) {
          const commands = cmds(b).filter((_, index) => word.length > 0 || index % total === part);
          for (const command of commands) await scan([...word, command]);
        }
      }
      await scan([]);
    }
    if (p.follow) {
      const k = p.follow.op,
        prep = Array(p.length).fill(p.a);
      const end = await pos(run([...prep, p.q, k]), p.role),
        direct = await pos(run([p.q, k]), p.role),
        omit = await pos(run([...prep, k]), p.role);
      inc(
        'controlledUse',
        eq(end, p.follow.to) && !eq(end, arrived) && direct && omit && !eq(end, direct) && !eq(end, omit)
      );
    }
  }
  results.push({ code: row.code, level: row.level, counts, examples });
}
await writeFile(output, JSON.stringify(results));
