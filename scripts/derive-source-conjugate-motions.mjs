import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, op, hash } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
import { groupsOf, observedExchanges, poseOf, resolveRole } from '../src/sic/exchange-roles.ts';
import { contactEvidence } from '../src/sic/contact-aspirations.ts';

const [environment, directory, out, cohort, split = '0/1'] = process.argv.slice(2);
const horizon = Number(process.env.SIC_SOURCE_JOINT_WRITES ?? 3),
  uniqueGoals = process.env.SIC_SOURCE_DISTINCT_GOALS === '1';
if (!Number.isInteger(horizon) || horizon < 2 || horizon > 8)
  throw Error('Expected a horizon of two through eight writes');
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  engine = await sourceBackend(resolve(environment));
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const programs = await readJson(
  new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url)
);
const source = [];
for (let i = 0; i < 8; i++)
  for (const l of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
    .trim()
    .split('\n'))
    source.push(JSON.parse(l));
if (
  source.length !== 100 ||
  new Set(source.map((r) => r.code)).size !== 100 ||
  source.some((r) => !allowed.has(r.code))
)
  throw Error('Incomplete original source cohort');
const seeds = [];
if (cohort === 'lower') {
  for (let i = 0; i < 3; i++)
    for (const row of await readJson(join(directory, 'local12-source-' + i + '.json'))) {
      const demo = row.examples[0];
      if (!demo) continue;
      const run = source.find((r) => r.code === row.code);
      seeds.push({
        code: row.code,
        level: 1,
        prefix: run.steps.slice(0, demo.step - 1).map(op),
        root: demo.from,
        known: demo.op,
      });
    }
} else if (cohort === 'seven') {
  for (const name of ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'])
    for (const line of (await readFile(join(directory, 'cold12-' + name + '.jsonl'), 'utf8'))
      .trim()
      .split('\n')) {
      const row = JSON.parse(line);
      seeds.push({
        code: row.code,
        level: row.start,
        prefix: [],
        root: row.initial,
        sourcePrefixActions: row.sourcePrefixActions ?? 0,
      });
    }
} else {
  for (const code of cohort.split(','))
    for (const r of await readJson(join(directory, 'exclusion12-' + code + '.json')))
      if (r.level > 1 && r.prepared)
        seeds.push({ code, level: r.level, prefix: r.prelude, root: r.prepared });
}
const eq = (p, q) => JSON.stringify(p) === JSON.stringify(q),
  seal = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const add = (p, d) => p.map((v, i) => v + d[i]),
  delta = (q, p) => q.map((v, i) => v - p[i]),
  swap = (p) => [p[1], p[0]];
async function survey(seed, frontier) {
  if (!allowed.has(seed.code)) throw Error('Expected source game');
  const rep = sourceReplay(engine, programs, {
      code: seed.code,
      start: seed.level,
      sourcePrefixActions: seed.sourcePrefixActions,
    }),
    read = publicParts();
  function open() {
    let b = rep.openEntry().b;
    if (b.level !== seed.level) throw Error('Unavailable level');
    for (const k of seed.prefix) b = rep.act(k);
    if (!hash(b).startsWith(seed.root)) throw Error('Wrong source prefix');
    return b;
  }
  const root = open(),
    won = (b) => b.level > root.level || b.levelsCompleted > root.levelsCompleted || b.state === 'WIN';
  const active = (b) => !won(b) && b.state !== 'GAME_OVER';
  const available = (b, k) => b.availableActionIds.includes(Number(k.split(':')[0].slice(6)));
  const run = (word) => {
    let b = open();
    for (const k of word) {
      if (!active(b)) break;
      if (!available(b, k)) return null;
      b = rep.act(k);
    }
    return b;
  };
  async function view(b) {
    if (!b || !active(b)) return null;
    const s = await read(b);
    return groupsOf({ entities: s.parts });
  }
  const base = await view(root),
    keys = root.availableActionIds.filter((n) => n !== 6).map((n) => 'ACTION' + n);
  if (seed.known && !keys.includes(seed.known)) keys.push(seed.known);
  frontier.seen.add(hash(root));
  if (root.availableActionIds.includes(6)) {
    const groups = Array.from(base.values())
      .filter(
        (es) => es.size && es.values().next().value.area <= (root.frame.length * root.frame[0].length) / 12
      )
      .sort((a, b) => a.size - b.size || b.values().next().value.area - a.values().next().value.area);
    for (const group of groups.slice(0, 6)) {
      const f = group.values().next().value;
      const p = [0, 1].map((j) => Math.round((f.bbox[j] + f.bbox[j + 2]) / 2));
      const k = 'ACTION6:' + p.join();
      if (!keys.includes(k)) keys.push(k);
    }
  }
  const calibration = new Map();
  for (const k of keys) {
    const b = run([k]),
      s = await view(b);
    if (s) {
      calibration.set(k, s);
      const key = hash(b);
      if (frontier.queue.length < 14 && !frontier.seen.has(key) && seed.prefix.length - frontier.start < 2) {
        frontier.seen.add(key);
        frontier.queue.push({ ...seed, prefix: [...seed.prefix, k], root: key, known: undefined });
      }
    }
  }
  const hypotheses = [];
  let mirrors = 0,
    reversible = 0,
    separable = 0;
  for (const [t, g] of calibration)
    for (const roles of observedExchanges(base, g)) {
      const p = poseOf(base, roles),
        after = poseOf(g, roles);
      if (!eq(after, swap(p))) continue;
      mirrors++;
      let undo = [t],
        inverseWitness = false;
      for (const k of new Set([t, ...keys])) {
        const inverse = await view(run([t, k]));
        if (inverse && eq(p, poseOf(inverse, roles))) {
          undo = [k];
          inverseWitness = true;
          break;
        }
      }
      if (!inverseWitness) {
        // A permutation among several locations can need several presses to undo one.
        let b = run([t]);
        const returnWord = [];
        while (b && active(b) && available(b, t) && returnWord.length < 8) {
          b = rep.act(t);
          returnWord.push(t);
          const g = await view(b);
          if (g && eq(p, poseOf(g, roles))) {
            undo = [...returnWord];
            inverseWitness = true;
            break;
          }
        }
      }
      if (inverseWitness) reversible++;
      for (const [d, s] of calibration) {
        const direct = poseOf(s, roles);
        if (d === t || !direct || eq(direct[0], p[0]) === eq(direct[1], p[1])) continue;
        separable++;
        const activeMember = eq(direct[0], p[0]) ? 1 : 0,
          passive = 1 - activeMember;
        const v = delta(direct[activeMember], p[activeMember]);
        const middle = swap(p);
        middle[activeMember] = add(middle[activeMember], v);
        const prediction = swap(middle),
          word = [t, d, ...undo];
        if (
          prediction.some((q, i) =>
            q.some(
              (x, j) =>
                x < 0 ||
                x + (resolveRole(base, roles[i]).bbox[j + 2] - resolveRole(base, roles[i]).bbox[j]) >=
                  (j ? root.frame.length : root.frame[0].length)
            )
          )
        )
          continue;
        hypotheses.push({
          roles,
          t,
          d,
          p,
          direct,
          activeMember,
          undo,
          inverseWitness,
          passive,
          delta: v,
          word,
          middle,
          prediction,
        });
      }
    }
  const conjugateSeal = seal(hypotheses),
    verified = [];
  let correct = 0,
    intermediate = 0,
    terminal = 0;
  for (const h of hypotheses) {
    const mid = await view(run(h.word.slice(0, 2))),
      b = run(h.word),
      s = await view(b);
    const middle = !!mid && eq(poseOf(mid, h.roles), h.middle);
    intermediate += Number(middle);
    terminal += Number(!!b && won(b));
    if (middle && s && eq(poseOf(s, h.roles), h.prediction)) {
      correct++;
      verified.push(h);
    }
  }
  const catalog = new Map();
  for (const h of verified) {
    const k = JSON.stringify([h.roles, h.t, h.undo, h.activeMember]);
    const v = catalog.get(k) ?? [];
    v.push(h);
    catalog.set(k, v);
  }
  const candidates = [];
  for (const variants of catalog.values()) {
    const h = variants[0],
      bodies = h.roles.map((r) => resolveRole(base, r));
    const features = (await read(root)).parts.filter(
      (e) =>
        !h.roles.some((r) => r.signature === e.signature) &&
        e.area < (root.frame.length * root.frame[0].length) / 12
    );
    const potential = new Map();
    const bestAt = (i, q) => {
      const key = i + '/' + q.join();
      if (potential.has(key)) return potential.get(key);
      let best = 0;
      for (const f of features) {
        const body = bodies[i],
          dest = [0, 1].map((j) => (f.bbox[j] + f.bbox[j + 2] - body.bbox[j + 2] + body.bbox[j]) / 2);
        const dist = (p) => p.reduce((n, x, j) => n + Math.abs(x - dest[j]), 0);
        const advance = dist(h.p[i]) - dist(q);
        if (advance > 0)
          best = Math.max(
            best,
            Math.exp(contactEvidence(body, f)) * (Math.min(24, advance) + 16 / (1 + dist(q)))
          );
      }
      potential.set(key, best);
      return best;
    };
    const seen = new Set([JSON.stringify(h.p)]),
      queue = [{ p: h.p, word: [], writes: [], path: [] }];
    for (const n of queue) {
      if (n.writes.length >= horizon) continue;
      for (const v of variants)
        for (const target of [v.activeMember, v.passive]) {
          const q = n.p.map((p) => [...p]);
          q[target] = add(q[target], v.delta);
          const key = JSON.stringify(q);
          if (
            seen.has(key) ||
            eq(q[0], q[1]) ||
            q.some((p, i) =>
              p.some(
                (x, j) =>
                  x < 0 ||
                  x + bodies[i].bbox[j + 2] - bodies[i].bbox[j] >=
                    (j ? root.frame.length : root.frame[0].length)
              )
            )
          )
            continue;
          seen.add(key);
          const commands = target === v.passive ? v.word : [v.d];
          const mid = swap(n.p);
          mid[v.activeMember] = add(mid[v.activeMember], v.delta);
          const path =
            target === v.passive ? [swap(n.p), mid, ...Array(v.undo.length - 1).fill(null), q] : [q];
          const z = {
            p: q,
            word: [...n.word, ...commands],
            writes: [...n.writes, target],
            path: [...n.path, ...path],
          };
          queue.push(z);
          if (!eq(q[0], h.p[0]) && !eq(q[1], h.p[1]))
            candidates.push({
              ...z,
              roles: h.roles,
              origin: h.p,
              t: h.t,
              score: bestAt(0, q[0]) + bestAt(1, q[1]) - z.word.length / 5,
            });
        }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const positions = new Set();
  const plans = candidates
      .filter((v) => {
        if (!uniqueGoals) return true;
        const id = JSON.stringify([v.roles, v.p]);
        if (positions.has(id)) return false;
        positions.add(id);
        return true;
      })
      .slice(0, 24),
    jointSeal = seal(plans),
    wins = [],
    exact = [];
  for (const plan of plans) {
    let b = open(),
      matched = true,
      issued = 0;
    for (const [i, k] of plan.word.entries()) {
      if (!available(b, k)) {
        matched = false;
        break;
      }
      b = rep.act(k);
      issued++;
      if (won(b)) break;
      const s = await view(b);
      if (!s || (plan.path[i] && !eq(poseOf(s, plan.roles), plan.path[i]))) {
        matched = false;
        break;
      }
    }
    if (won(b)) {
      const executed = plan.word.slice(0, issued);
      const ablated = run(executed.filter((k) => k !== plan.t));
      wins.push({ executed, withoutExchange: !!ablated && won(ablated), initial: plan.origin, goal: plan.p });
    } else if (matched && issued === plan.word.length)
      exact.push({ from: plan.origin, to: plan.p, word: plan.word });
  }
  return {
    ...seed,
    root: hash(root),
    calibrations: calibration.size,
    mirrors,
    reversible,
    separable,
    conjugates: hypotheses,
    programs: plans,
    conjugateSeal,
    hypotheses: hypotheses.length,
    middle: intermediate,
    correct,
    terminal,
    one: verified[0] ?? null,
    options: candidates.length,
    horizon,
    uniqueGoals,
    jointSeal,
    joint: plans.length,
    jointExact: exact.length,
    jointWins: wins.length,
    examples: exact.slice(0, 2),
    wins: wins.slice(0, 4),
  };
}
const [part, total] = split.split('/').map(Number),
  reports = [];
for (const [i, s] of seeds.entries())
  if (i % total === part) {
    const frontier = { queue: [s], seen: new Set(), start: s.prefix.length };
    let fallback;
    const max = Number(process.env.SIC_SOURCE_CONJUGATE_SITES ?? 1);
    for (let j = 0; j < Math.min(max, frontier.queue.length); j++) {
      const row = await survey(frontier.queue[j], frontier);
      if (
        !fallback ||
        row.hypotheses > fallback.hypotheses ||
        (!row.hypotheses && !fallback.hypotheses && row.mirrors > fallback.mirrors)
      )
        fallback = row;
      if (row.conjugates.some((h) => h.inverseWitness)) {
        fallback = row;
        fallback.inspected = j + 1;
        break;
      }
      fallback.inspected = j + 1;
    }
    reports.push(fallback);
  }
await writeFile(out, JSON.stringify(reports));
