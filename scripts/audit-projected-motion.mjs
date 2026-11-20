// Evaluate a two-command forecast before either observed result is used for fitting.
import { readFileSync } from 'node:fs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { equalLayout, fitMotion, layoutId, projectedStep } from '../src/sic/projected-motion.ts';

const data = JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
if (
  data
    .map((g) => g.code)
    .sort()
    .join() !==
  GAME_CATALOG.map((g) => g.code)
    .sort()
    .join()
)
  throw Error('Expected the original cohort');
const results = [];
for (const game of data) {
  const { scenes, edges } = game,
    observed = [],
    moving = new Map(),
    seen = new Set();
  const counts = {
    trials: 0,
    arrivals: 0,
    both: 0,
    productiveBoth: 0,
    constantBoth: 0,
    productiveConstantBoth: 0,
  };
  const pairAt = (state, ids) =>
    ids.every((id) => state[id]) ? ids.map((id) => state[id].slice(0, 2)) : null;
  for (const [i, [s, op, t]] of edges.entries()) {
    const next = edges[i + 1],
      start = scenes[s];
    if (next?.[0] === t) {
      const cmd = next[1],
        ids = [...moving.keys()]
          .filter((id) => start[id])
          .sort((a, b) => moving.get(b) - moving.get(a) || a.localeCompare(b))
          .slice(0, 6);
      let picked = false;
      for (let j = 0; !picked && j < ids.length; j++)
        for (let k = j + 1; !picked && k < ids.length; k++) {
          const roles = [ids[j], ids[k]],
            pose = pairAt(start, roles),
            key = [roles, op, cmd, layoutId(pose)].join('/');
          if (seen.has(key)) continue;
          const samples = (name) =>
            observed
              .filter((e) => e[1] === name)
              .flatMap(([a, , b], n) => {
                const before = pairAt(scenes[a], roles),
                  after = pairAt(scenes[b], roles);
                return before && after ? [{ before, after, ref: n + 1 }] : [];
              });
          const a = samples(op),
            b = samples(cmd);
          if (
            ![a, b].every((list) => list.length >= 2 && list.some((x) => !equalLayout(x.before, x.after))) ||
            a.some((x) => equalLayout(x.before, pose))
          )
            continue;
          const first = fitMotion(op, a),
            second = fitMotion(cmd, b);
          const arrival = projectedStep(first, pose),
            continuation = projectedStep(second, arrival);
          if (equalLayout(pose, arrival) || equalLayout(arrival, continuation)) continue;
          // Comparator uses the modal pair of local displacements for each command.
          function translate(list, at) {
            const freq = new Map();
            for (const { before, after } of list) {
              const ds = after.map((p, i) => p.map((v, j) => v - before[i][j])),
                k = JSON.stringify(ds);
              freq.set(k, (freq.get(k) ?? 0) + 1);
            }
            const delta = JSON.parse([...freq].sort((x, y) => y[1] - x[1])[0][0]);
            return at.map((p, i) => p.map((v, j) => v + delta[i][j]));
          }
          const plain = translate(a, pose),
            plainNext = translate(b, plain);
          const actual = pairAt(scenes[t], roles),
            later = pairAt(scenes[next[2]], roles);
          picked = true;
          seen.add(key);
          counts.trials++;
          const hit = actual && equalLayout(actual, arrival),
            both = hit && later && equalLayout(continuation, later);
          const constant = actual && later && equalLayout(actual, plain) && equalLayout(later, plainNext);
          if (hit) counts.arrivals++;
          if (both) counts.both++;
          if (constant) counts.constantBoth++;
          if (actual && later && !equalLayout(pose, actual) && !equalLayout(actual, later)) {
            if (both) counts.productiveBoth++;
            if (constant) counts.productiveConstantBoth++;
          }
        }
    }
    observed.push([s, op, t]);
    for (const [id, pose] of Object.entries(start))
      if (scenes[t][id] && pose.slice(0, 2).join() !== scenes[t][id].slice(0, 2).join())
        moving.set(id, (moving.get(id) ?? 0) + 1);
  }
  if (counts.trials) results.push({ code: game.code, ...counts });
}
const sums = Object.fromEntries(
  Object.keys(results[0] ?? {})
    .filter((k) => k !== 'code')
    .map((k) => [k, results.reduce((n, r) => n + r[k], 0)])
);
console.log(JSON.stringify({ cohort: data.length, games: results.length, ...sums, byGame: results }));
