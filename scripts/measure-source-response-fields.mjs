import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
import { responseField } from './fit-source-response-field.mjs';
const [env, dir, selection, output, cohort] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env));
const files =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : cohort === 'extra'
      ? [2, 3, 4, 5].map((l) => 'cold13-f' + l)
      : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const runs = new Map(),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
for (const f of files)
  for (const line of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    runs.set(r.code + '/' + r.start, r);
  }
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1],
  out = [];
for (const group of JSON.parse(await readFile(selection, 'utf8'))) {
  if (!allowed.has(group.code)) throw Error('Source games only');
  const r = runs.get(group.code + '/' + group.level),
    rep = sourceReplay(engine, programs, r),
    read = publicParts(),
    summaries = [];
  const live = (b) => b && !rep.win(b) && b.state !== 'GAME_OVER';
  const fire = (b, cmd) =>
    live(b) && b.availableActionIds.includes(Number(cmd.slice(6).split(':')[0])) ? rep.act(cmd) : null;
  const at = async (b, role) => {
    if (!live(b)) return null;
    const g = (await read(b)).parts.filter((x) => x.signature === role.signature);
    return g.length === role.fixed.length + 1 &&
      role.fixed.every((k) => g.some((e) => e.position.join() === k))
      ? g.find((e) => !role.fixed.includes(e.position.join()))?.position
      : null;
  };
  for (const p of group.cases) {
    const root = rep.restore(p.write);
    if (!hash(root).startsWith(p.baseline)) throw Error('Unbound response-field origin');
    const keys = root.availableActionIds.flatMap((n) =>
      n === 6
        ? [
            ...new Set(
              r.steps
                .slice(0, p.i - 1)
                .map(op)
                .filter((k) => k.startsWith('ACTION6:'))
                .reverse()
            ),
          ].slice(0, 4)
        : ['ACTION' + n]
    );
    const controls = [...new Set([p.a, ...keys])].filter((k) => k !== p.q);
    const words = [
      [],
      ...controls.map((k) => [k]),
      ...controls.map((k) => [p.a, k]),
      ...controls.filter((k) => k !== p.a).map((k) => [k, p.a]),
    ];
    const anchor = { signature: p.anchor, fixed: [] },
      observations = [],
      counts = {},
      forecasts = [],
      representatives = new Map();
    const inc = (k, val = true) => {
      if (val) counts[k] = (counts[k] ?? 0) + 1;
    };
    for (const [i, word] of words.entries()) {
      let b = rep.restore(p.write);
      for (const k of word) b = fire(b, k);
      inc('preparations');
      if (!live(b)) continue;
      const patient = await at(b, p.role),
        reference = await at(b, anchor);
      if (!eq(patient, p.from) || !reference) continue;
      inc('matched');
      const image = hash(b),
        binding = reference.join(),
        prev = representatives.get(binding);
      const known = observations.find((e) => eq(e.r, reference));
      const forecast = !known ? responseField(observations, reference) : null;
      const last = observations.at(-1),
        identity = last && reference.map((v, j) => v + last.y[j] - last.r[j]);
      const base = observations[0];
      const target = forecast?.to;
      const state = fire(b, p.q),
        actual = await at(state, p.role);
      if (!actual) {
        inc('wins', !!state && rep.win(state));
        continue;
      }
      if (prev && prev.image !== image) {
        inc('otherSceneSameReference');
        inc('sameResponse', eq(actual, prev.y));
      }
      if (!prev) representatives.set(binding, { image, y: actual });
      if (forecast) {
        inc('freshPredictions');
        inc('correct', eq(target, actual));
        inc('rank' + forecast.rank);
        inc('exactRank' + forecast.rank, eq(target, actual));
        inc('varying', forecast.varying);
        inc('varyingExact', forecast.varying && eq(target, actual));
        inc('identity', eq(identity, actual));
        inc('last', eq(last.y, actual));
        const newLanding = !observations.some((e) => eq(e.y, actual));
        inc('novelLanding', newLanding);
        inc('novelExact', newLanding && eq(target, actual));
        inc('originChanged', !eq(base.y, actual));
        if (forecasts.length < 5)
          forecasts.push({
            word,
            r: reference,
            target,
            actual,
            refs: forecast.refs,
            rank: forecast.rank,
            varying: forecast.varying,
            newLanding,
            identity,
          });
      }
      observations.push({ r: reference, y: actual, i });
    }
    const samples = [...representatives.values()];
    summaries.push({
      i: p.i,
      origin: p.baseline,
      probe: p.q,
      source: p.kind,
      from: p.from,
      distinctPlacements: samples.length,
      distinctArrivals: new Set(samples.map((v) => v.y.join())).size,
      counts,
      forecasts,
      arms: observations.map((v) => ({ word: words[v.i], r: v.r, y: v.y })),
    });
  }
  out.push({ code: r.code, level: r.start, cases: summaries });
}
await writeFile(output, JSON.stringify(out));
