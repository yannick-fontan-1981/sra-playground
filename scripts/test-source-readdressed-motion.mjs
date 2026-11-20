import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';

const [environment, directory, out, cohort, shard = '0/1'] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  runs = [];
const names =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
for (const name of names)
  for (const l of (await readFile(join(directory, name + '.jsonl'), 'utf8')).trim().split('\n'))
    runs.push(JSON.parse(l));
if (runs.some((r) => !allowed.has(r.code)) || runs.length !== (cohort === 'lower' ? 100 : 18))
  throw Error('Unexpected source cohort');
const eq = (p, q) => JSON.stringify(p) === JSON.stringify(q),
  add = (p, d) => p.map((v, i) => v + d[i]);
function graphOf(run) {
  const graph = new Map(),
    at = new Map();
  for (const [i, s] of run.steps.entries()) {
    const k = op(s),
      line = graph.get(s.from) ?? new Map(),
      dst = line.get(k) ?? new Set();
    dst.add(s.to);
    line.set(k, dst);
    graph.set(s.from, line);
    if (!at.has(s.from)) at.set(s.from, i);
  }
  function back(start, goal) {
    const q = [{ s: start, word: [] }],
      seen = new Set([start]);
    for (const n of q)
      if (n.word.length < 8)
        for (const [k, to] of graph.get(n.s) ?? []) {
          if (to.size !== 1) continue;
          const dest = [...to][0],
            word = [...n.word, k];
          if (dest === goal) return word;
          if (!seen.has(dest)) {
            seen.add(dest);
            q.push({ s: dest, word });
          }
        }
    return null;
  }
  const pairs = [];
  for (const [s, line] of graph)
    for (const [k, to] of line) {
      if (to.size !== 1 || to.has(s)) continue;
      const dest = [...to][0],
        undo = back(dest, s);
      if (undo) pairs.push({ s, k, dest, undo, index: at.get(s), options: line.size });
    }
  return pairs;
}
function roleIn(parts, e) {
  return {
    sig: e.signature,
    at: e.position,
    fixed: parts
      .filter((x) => x.signature === e.signature && !eq(x.position, e.position))
      .map((x) => x.position.join())
      .sort(),
  };
}
function locate(parts, role) {
  const group = parts.filter((e) => e.signature === role.sig);
  if (
    group.length !== role.fixed.length + 1 ||
    !role.fixed.every((p) => group.some((e) => e.position.join() === p))
  )
    return null;
  return group.find((e) => !role.fixed.includes(e.position.join()))?.position ?? null;
}
async function check(r) {
  const rep = sourceReplay(engine, programs, r),
    read = publicParts(),
    pairs = graphOf(r),
    rows = [];
  const selected = pairs
    .sort((a, b) => a.index - b.index || b.options - a.options)
    .filter((p, i, all) => all.findIndex((q) => q.k === p.k && eq(q.undo, p.undo)) === i)
    .slice(0, 6);
  for (const edge of selected) {
    const root = rep.restore(edge.index),
      start = hash(root),
      base = (await read(root)).parts;
    const active = (b) =>
      b &&
      b.level === r.start &&
      b.levelsCompleted === root.levelsCompleted &&
      b.state !== 'WIN' &&
      b.state !== 'GAME_OVER';
    const apply = (b, k) =>
      active(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? rep.act(k) : null;
    const run = (word) => {
      let b = rep.restore(edge.index);
      for (const k of word) {
        if (!active(b)) break;
        b = apply(b, k);
      }
      return b;
    };
    const changed = run([edge.k]),
      returned = run([edge.k, ...edge.undo]);
    if (
      !active(changed) ||
      !active(returned) ||
      hash(returned) !== start ||
      !hash(changed).startsWith(edge.dest)
    )
      continue;
    const edited = [];
    for (let y = 0; y < root.frame.length; y++)
      for (let x = 0; x < root.frame[y].length; x++)
        if (root.frame[y][x] !== changed.frame[y][x]) edited.push([x, y]);
    if (!edited.length) continue;
    const keys = new Set(root.availableActionIds.filter((n) => n !== 6).map((n) => 'ACTION' + n));
    for (const s of r.steps) if (s.from === edge.s) keys.add(op(s));
    const predictions = [];
    const mobile = base.filter((e) => e.area <= (root.frame.length * root.frame[0].length) / 12);
    const roles = new Map(mobile.map((e) => [e, roleIn(base, e)]));
    const proximity = new Map(
      mobile.map((e) => [
        e,
        edited.reduce(
          (n, [x, y]) =>
            Math.min(
              n,
              Math.max(0, e.bbox[0] - x, x - e.bbox[2]) + Math.max(0, e.bbox[1] - y, y - e.bbox[3])
            ),
          Infinity
        ),
      ])
    );
    for (const k of keys) {
      if (k === edge.k) continue;
      const plain = run([k]);
      if (!active(plain)) continue;
      const direct = (await read(plain)).parts;
      for (const actor of mobile) {
        const a = roles.get(actor),
          arrive = locate(direct, a);
        if (!arrive || eq(a.at, arrive)) continue;
        const d = arrive.map((x, i) => x - a.at[i]);
        const options = [];
        for (const item of mobile) {
          if (item.signature === a.sig) continue;
          const partner = roles.get(item),
            stay = locate(direct, partner);
          if (!eq(stay, partner.at)) continue;
          const q = add(partner.at, d);
          if (
            q.some(
              (x, j) =>
                x < 0 || x + item.bbox[j + 2] - item.bbox[j] >= (j ? root.frame.length : root.frame[0].length)
            )
          )
            continue;
          const near = proximity.get(item);
          if (near > Math.max(1, Math.abs(d[0]) + Math.abs(d[1]))) continue;
          const score =
            Number(near === 0) * 4 +
            Number(eq(actor.mask, item.mask)) * 3 -
            near / 2 -
            Math.abs(Math.log(item.area / actor.area));
          options.push({ partner, q, score });
        }
        options.sort((a, b) => b.score - a.score);
        if (options.length) predictions.push({ k, a, delta: d, direct: arrive, ...options[0] });
      }
    }
    const seal = createHash('sha256').update(JSON.stringify(predictions)).digest('hex'),
      cache = new Map(),
      results = [];
    for (const p of predictions) {
      if (!cache.has(p.k)) {
        const b = run([edge.k, p.k, ...edge.undo]);
        cache.set(p.k, {
          active: active(b),
          won: b && (b.levelsCompleted > root.levelsCompleted || b.state === 'WIN'),
          parts: active(b) ? (await read(b)).parts : [],
        });
      }
      const x = cache.get(p.k),
        a = locate(x.parts, p.a),
        b = locate(x.parts, p.partner);
      results.push({
        actor: a,
        partner: b,
        visible: !!a && !!b,
        matched: eq(a, p.a.at) && eq(b, p.q),
        won: !!x.won,
      });
    }
    rows.push({ edge, root: start, seal, predictions, results });
  }
  return {
    code: r.code,
    level: r.start,
    sourcePrefixActions: r.sourcePrefixActions ?? 0,
    edges: pairs.length,
    rows,
  };
}
const [n, N] = shard.split('/').map(Number),
  reports = [];
for (const [i, r] of runs.entries()) if (i % N === n) reports.push(await check(r));
await writeFile(out, JSON.stringify(reports));
