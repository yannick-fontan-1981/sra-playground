// Source-only laboratory. Train on elapsed public transitions and test sealed predictions on matched forks.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

const [environment, game, levelText, output, inputs, priorFile] = process.argv.slice(2);
const level = Number(levelText);
const packets = await Promise.all(
  inputs.split(',').map(async (f) => (await readFile(f, 'utf8')).trim().split(/\r?\n/).map(JSON.parse))
);
const run = packets.flat().find((r) => r.code === game && r.start === level);
assert.ok(run && run.sic === run.issued && !run.resets);
const engine = await sourceBackend(resolve(environment));
const replay = sourceReplay(engine, {}, run);
const prior = priorFile ? JSON.parse(await readFile(priorFile, 'utf8')) : null;
if (prior) assert.ok(prior.game === game && prior.level < level);
const laws = [...(prior?.laws ?? [])];
const lawKeys = new Set(laws.map((law) => law.key));
const results = [],
  roots = new Set(),
  cache = new Map();
const digest = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
import {
  shiftSite as plus,
  siteOffset as minus,
  separation as distance,
  localPatch as patch,
  publicEdits as edits,
  clickSite as clickAt,
  translateCommand as translated,
  orderEdits as rankEdits,
  separateEdits as apart,
} from '../src/sic/local-response.ts';
const usable = (b) =>
  b && b.state === 'NOT_FINISHED' && b.level === level && b.levelsCompleted === run.initialCompleted;
function project(i, commands) {
  const key = JSON.stringify([i, commands]);
  if (cache.has(key)) return cache.get(key);
  let b = replay.restore(i);
  for (const command of commands) {
    if (!usable(b) || !command) {
      b = null;
      break;
    }
    b = replay.act(command);
  }
  if (!usable(b)) b = null;
  cache.set(key, b);
  return b;
}
function learn(i) {
  const seq = run.steps.slice(i, i + 3).map(op);
  if (seq.includes('ACTION7')) return;
  const [a, b, c] = seq,
    base = project(i, []),
    va = project(i, [a]),
    vb = project(i, [b]);
  const vab = project(i, [a, b]),
    vabc = project(i, seq);
  for (const [j, observed] of [va, vab, vabc].entries()) {
    if (observed) assert.equal(hash(observed).slice(0, 16), run.steps[i + j].to);
  }
  if (!base || !va || !vb || !vab) return;
  const prepare = apart(rankEdits(edits(base, va, []), clickAt(a)), 2);
  const response = apart(rankEdits(edits(va, vab, [vb, base]), clickAt(b)), 3);
  if (!prepare.length || !response.length) return;
  const vac = project(i, [a, c]),
    vbc = project(i, [b, c]);
  const use = vabc && vac && vbc ? rankEdits(edits(vab, vabc, [vac, vbc, base, va, vb]), clickAt(c)) : [];
  for (const first of prepare)
    for (const second of response) {
      const third = use.find((e) => distance(e.p, second.p) >= 3 && distance(e.p, first.p) >= 3);
      const spec = { a, b, c, first, second, third: third ?? null, beforeB: patch(base, second.p) };
      const key = digest(spec);
      if (lawKeys.has(key)) continue;
      lawKeys.add(key);
      laws.push({ ...spec, key, origin: hash(base), learnedAt: i + 3, level });
    }
}
function match(base, law, q) {
  const shift = minus(q, law.first.p);
  if (distance(q, law.first.p) < 3) return null;
  const qb = plus(law.second.p, shift),
    qc = law.third && plus(law.third.p, shift);
  if (patch(base, qb) !== law.beforeB || (qc && !patch(base, qc))) return null;
  const [a, b, c] = [law.a, law.b, law.c].map((k) => translated(k, shift, base));
  if (!a || !b || !c) return null;
  return { a, b, c, q, qb, qc, law };
}
function bindings(base, oldHash) {
  const locations = new Map();
  for (let y = 1; y < base.frame.length - 1; y++)
    for (let x = 1; x < base.frame[y].length - 1; x++) {
      const p = [x, y],
        signature = patch(base, p);
      if (!locations.has(signature)) locations.set(signature, []);
      locations.get(signature).push(p);
    }
  const candidates = [];
  for (const law of laws) {
    if (law.origin === oldHash) continue;
    const sites = locations.get(law.first.from) ?? [];
    // Ambiguous featureless regions cannot locate the causal preparation.
    if (sites.length > 32) continue;
    for (const p of sites) {
      const v = match(base, law, p);
      if (v) candidates.push({ ...v, ambiguity: sites.length });
    }
  }
  return candidates.sort(
    (x, y) =>
      Number(!!y.qc) - Number(!!x.qc) ||
      x.ambiguity - y.ambiguity ||
      y.law.second.n - x.law.second.n ||
      x.law.key.localeCompare(y.law.key) ||
      x.q[1] - y.q[1] ||
      x.q[0] - y.q[0]
  );
}
function test(i, origin, v, revised) {
  const { a, b, c, q, qb, qc, law } = v;
  const commitment = {
    i,
    origin,
    trained: law.origin,
    trainedSite: law.first.p,
    learnedLevel: law.level,
    learnedAt: law.learnedAt,
    a,
    b,
    c,
    site: q,
    first: law.first.to,
    siteB: qb,
    fromB: law.second.from,
    afterB: law.second.to,
    siteC: qc,
    fromC: law.third?.from,
    afterC: law.third?.to,
    revised,
  };
  return {
    commitment,
    resolveOutcome() {
      const va = project(i, [a]),
        vb = project(i, [b]),
        vab = project(i, [a, b]);
      const aOK = !!va && patch(va, q) === law.first.to;
      const rival = !!vb && patch(vb, qb) !== law.second.to;
      const enabled = aOK && rival && patch(va, qb) === law.second.from && patch(vab, qb) === law.second.to;
      let used = false;
      if (enabled && qc && patch(vab, qc) === law.third.from) {
        const vac = project(i, [a, c]),
          vbc = project(i, [b, c]),
          vabc = project(i, [a, b, c]);
        used =
          !!vac &&
          !!vbc &&
          patch(vac, qc) !== law.third.to &&
          patch(vbc, qc) !== law.third.to &&
          patch(vabc, qc) === law.third.to;
      }
      return { i, aOK, rival, enabled, used, hasUse: !!qc, revised, prior: law.level !== level };
    },
  };
}
for (let i = 0; i < run.steps.length; i++) {
  const base = project(i, []);
  if (!base) break;
  if (i >= 3) learn(i - 3);
  const origin = hash(base);
  if (roots.has(origin)) continue;
  roots.add(origin);
  const candidates = bindings(base, origin),
    seen = new Set();
  let retained = null;
  for (let turn = 0; turn < 3; turn++) {
    const key = (v) => JSON.stringify([v.a, v.b, v.q, v.qb, v.law.second.to]);
    const preserves = (v) =>
      retained &&
      v.a === retained.a &&
      distance(v.q, retained.q) === 0 &&
      v.law.first.to === retained.law.first.to &&
      v.b !== retained.b;
    const eligible = candidates.filter((v) => !seen.has(key(v)));
    const revision = eligible.find(preserves);
    const choice = revision ?? eligible[0];
    if (!choice) break;
    seen.add(key(choice));
    const { commitment, resolveOutcome } = test(i, origin, choice, !!revision);
    const seal = digest(commitment);
    await appendFile(output + '.journal', JSON.stringify({ kind: 'forecast', seal, commitment }) + '\n');
    const outcome = resolveOutcome();
    results.push(outcome);
    await appendFile(output + '.journal', JSON.stringify({ kind: 'outcome', seal, ...outcome }) + '\n');
    if (outcome.enabled) break;
    if (outcome.aOK) retained = choice;
  }
}
const summary = {
  roots: roots.size,
  laws: laws.length,
  forecasts: results.length,
  verified: results.filter((x) => x.enabled).length,
  uses: results.filter((x) => x.used).length,
  retainedRefutations: results.filter((x) => x.aOK && !x.enabled).length,
  revised: results.filter((x) => x.revised).length,
  revisedVerified: results.filter((x) => x.revised && x.enabled).length,
  priorForecasts: results.filter((x) => x.prior).length,
  priorVerified: results.filter((x) => x.prior && x.enabled).length,
};
await writeFile(output, JSON.stringify({ game, level, summary, laws }) + '\n');
console.log(JSON.stringify(summary));
