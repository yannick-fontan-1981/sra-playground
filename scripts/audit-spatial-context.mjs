import { readFile, writeFile } from 'node:fs/promises';
import { fitSpatialCapability, predictSpatialCapability } from '../src/sic/spatial-capability.ts';
import { GAME_CATALOG } from '../src/games/catalog.ts';

const [file, output] = process.argv.slice(2);
const games = JSON.parse(await readFile(file, 'utf8'));
if (
  games.length !== 100 ||
  games
    .map((g) => g.code)
    .sort()
    .join() !==
    GAME_CATALOG.map((g) => g.code)
      .sort()
      .join()
)
  throw Error('Expected the original hundred source games');
const modes = ['pair', 'board', 'landmarks', 'majority'];
function buckets() {
  return Object.fromEntries(
    modes.map((m) => [m, { measured: 0, actual: 0, classified: 0, correct: 0, called: 0, confirmed: 0 }])
  );
}
function account(bucket, pred, actual) {
  bucket.measured++;
  bucket.actual += Number(actual);
  if (pred === null) return;
  bucket.classified++;
  bucket.correct += Number(pred === actual);
  bucket.called += Number(pred);
  bucket.confirmed += Number(pred && actual);
}
function layout(scene, actor) {
  const objects = Object.fromEntries(
    Object.entries(scene)
      .filter(([id, v]) => id !== actor && v[2] < 1024)
      .map(([id, v]) => [id, v.slice(0, 2)])
  );
  return { actor: scene[actor].slice(0, 2), objects };
}
const results = [];
for (const g of games) {
  const byInput = new Map(),
    seen = new Set(),
    all = buckets(),
    shifted = buckets();
  const extra = { disagreements: 0, correct: 0, opened: 0, confirmed: 0 };
  for (const [source, op, target] of g.edges) {
    const key = source + '/' + op;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = g.scenes[source],
      t = g.scenes[target],
      past = byInput.get(op) ?? [];
    for (const [actor, origin] of Object.entries(s)) {
      if (origin[2] >= 1024 || !t[actor]) continue;
      const rows = past
        .filter((r) => r.s[actor] && r.t[actor])
        .map((r) => ({
          layout: layout(r.s, actor),
          outcome: r.s[actor][0] !== r.t[actor][0] || r.s[actor][1] !== r.t[actor][1],
        }));
      const successes = rows.filter((r) => r.outcome).length;
      if (successes < 2 || rows.length - successes < 2) continue;
      const l = layout(s, actor);
      // Select a visibly relocated partner from past observations before reading the outcome.
      const peers = Object.entries(l.objects).filter(
        ([id]) =>
          rows.every((r) => r.layout.objects[id]) &&
          new Set(rows.map((r) => r.layout.objects[id].join())).size > 1
      );
      peers.sort(
        (a, b) =>
          Math.abs(a[1][0] - origin[0]) +
            Math.abs(a[1][1] - origin[1]) -
            Math.abs(b[1][0] - origin[0]) -
            Math.abs(b[1][1] - origin[1]) || a[0].localeCompare(b[0], 'en')
      );
      if (!peers.length) continue;
      const primary = [peers[0][0]];
      const predictions = Object.fromEntries(
        modes.slice(0, 3).map((m) => [m, predictSpatialCapability(fitSpatialCapability(rows, primary, m), l)])
      );
      predictions.majority = successes * 2 > rows.length;
      const actual = t[actor][0] !== origin[0] || t[actor][1] !== origin[1];
      const novel = !rows.some(
        (r) =>
          r.layout.actor.join() === l.actor.join() &&
          r.layout.objects[primary[0]].join() === l.objects[primary[0]].join()
      );
      for (const m of modes) {
        account(all[m], predictions[m], actual);
        if (novel) account(shifted[m], predictions[m], actual);
      }
      if (
        novel &&
        predictions.landmarks !== null &&
        predictions.board !== null &&
        predictions.board !== predictions.landmarks
      ) {
        extra.disagreements++;
        extra.correct += Number(predictions.landmarks === actual);
        extra.opened += Number(predictions.landmarks);
        extra.confirmed += Number(predictions.landmarks && actual);
      }
    }
    past.push({ s, t });
    byInput.set(op, past);
  }
  results.push({ code: g.code, all, shifted, extra });
}
await writeFile(output, JSON.stringify(results));
console.log(
  JSON.stringify({ games: results.length, measured: results.reduce((n, r) => n + r.all.pair.measured, 0) })
);
