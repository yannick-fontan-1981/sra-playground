import { readFile, writeFile } from 'node:fs/promises';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { fitSpatialCapability, predictSpatialCapability } from '../src/sic/spatial-capability.ts';

// B has never moved this role. Can a condition learned under another input
// predict its first activation, after every previous B was tried outside that condition?
const [file, output] = process.argv.slice(2),
  games = JSON.parse(await readFile(file, 'utf8'));
if (
  games
    .map((g) => g.code)
    .sort()
    .join() !==
  GAME_CATALOG.map((g) => g.code)
    .sort()
    .join()
)
  throw Error('Expected the 100 original source games');
const count = () => ({ forecasts: 0, measured: 0, opened: 0, exact: 0 });
const results = [];
for (const g of games) {
  const histories = new Map(),
    seen = new Set(),
    baseline = count(),
    gates = count();
  let first = null;
  for (const [from, k, to] of g.edges) {
    const input = from + '/' + k;
    if (seen.has(input)) continue;
    seen.add(input);
    const scene = g.scenes[from],
      after = g.scenes[to];
    for (const [actor, raw] of Object.entries(scene)) {
      if (raw[2] >= 1024) continue;
      const history = histories.get(actor) ?? new Map(),
        past = history.get(k) ?? [];
      histories.set(actor, history);
      const xy = raw.slice(0, 2);
      const obs = {
        actor: xy,
        objects: Object.fromEntries(
          Object.entries(scene)
            .filter(([p, v]) => p !== actor && v[2] < 1024)
            .map(([id, v]) => [id, v.slice(0, 2)])
        ),
      };
      const other = [...history].filter(([j, rows]) => j !== k && rows.some((s) => s.outcome));
      let choice = null,
        eligible = past.length > 0 && past.every((s) => !s.outcome) && other.length > 0;
      if (eligible) {
        baseline.forecasts++;
        for (const [donor, rows] of other) {
          const positive = rows.filter((s) => s.outcome);
          if (positive.length < 2 || rows.length - positive.length < 2) continue;
          for (const peer of Object.keys(obs.objects)) {
            if (
              ![...past, ...rows].every((s) => s.layout.objects[peer]) ||
              new Set(rows.map((s) => s.layout.objects[peer].join())).size < 2
            )
              continue;
            const model = fitSpatialCapability(rows, [peer], 'board');
            if (
              !model ||
              model.sensitivity < 0.75 ||
              model.specificity < 0.75 ||
              !predictSpatialCapability(model, obs) ||
              !past.every((s) => predictSpatialCapability(model, s.layout) === false)
            )
              continue;
            const distance = (s) =>
              s.layout.actor.reduce(
                (n, v, j) =>
                  n + Math.abs(v - xy[j]) + Math.abs(s.layout.objects[peer][j] - obs.objects[peer][j]),
                0
              );
            const dist = Math.min(...positive.map(distance)),
              nearest = positive.filter((s) => distance(s) === dist);
            const delta = nearest.every((s) => s.delta.join() === nearest[0].delta.join())
              ? nearest[0].delta
              : null;
            const weight =
              model.sensitivity +
              model.specificity +
              Math.min(4, positive.length, rows.length - positive.length) / 8;
            if (!choice || weight > choice.weight || (weight === choice.weight && dist < choice.dist))
              choice = { donor, weight, dist, destination: delta ? xy.map((v, j) => v + delta[j]) : null };
          }
        }
        if (choice) gates.forecasts++;
      }
      if (!after[actor]) continue;
      const delta = xy.map((v, i) => after[actor][i] - v),
        outcome = delta.some(Boolean);
      if (eligible) {
        baseline.measured++;
        baseline.opened += Number(outcome);
        if (choice) {
          gates.measured++;
          gates.opened += Number(outcome);
          const exact = !!choice.destination && choice.destination.join() === after[actor].slice(0, 2).join();
          gates.exact += Number(exact);
          first ??= { donor: choice.donor, command: k, opened: outcome, exact };
        }
      }
      past.push({ layout: obs, outcome, delta });
      history.set(k, past);
    }
  }
  results.push({ code: g.code, baseline, gates, first });
}
await writeFile(output, JSON.stringify(results));
console.log(
  JSON.stringify({
    games: results.length,
    active: results.filter((r) => r.gates.opened).length,
    proposals: results.reduce((n, r) => n + r.gates.forecasts, 0),
  })
);
