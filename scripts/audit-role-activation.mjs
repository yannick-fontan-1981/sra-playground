import { readFile } from 'node:fs/promises';
import { separateMotion } from '../src/sic/conditional-placements.ts';
const games = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (games.length !== 100 || new Set(games.map((g) => g.code)).size !== 100)
  throw Error('Expected 100 distinct source games');
const total = {
  forecasts: 0,
  visible: 0,
  correct: 0,
  baselineCorrect: 0,
  disagreements: 0,
  correctDisagreements: 0,
  predictsOpening: 0,
  opened: 0,
};
const byGame = [];
for (const game of games) {
  const history = new Map(),
    seen = new Set();
  const counts = Object.fromEntries(Object.keys(total).map((k) => [k, 0]));
  for (const [scene, op, target] of game.edges) {
    const input = scene + '/' + op;
    if (seen.has(input)) continue;
    seen.add(input);
    const before = game.scenes[scene],
      after = game.scenes[target];
    for (const [role, data] of Object.entries(before)) {
      if (data[2] >= 1024) continue;
      const origin = data.slice(0, 2),
        k = role + '/' + op,
        prior = history.get(k) ?? [];
      history.set(k, prior);
      const on = prior.filter((s) => s.moved),
        off = prior.filter((s) => !s.moved);
      if (on.length && off.length) {
        let yes = 0,
          n = 0;
        for (const [peer, pt] of Object.entries(before)) {
          if (peer === role || pt[2] >= 1024 || prior.some((s) => !game.scenes[s.scene][peer])) continue;
          const offsets = (ss) => ss.map((s) => s.origin.map((v, i) => v - game.scenes[s.scene][peer][i]));
          const rules = separateMotion(offsets(on), offsets(off)),
            delta = origin.map((v, i) => v - pt[i]);
          for (const r of rules) {
            n++;
            const x = delta[r.axis];
            if (((r.signOnly ? Math.sign(x) : x) === r.value) === r.onMatch) yes++;
          }
        }
        if (n && Math.max(yes, n - yes) * 5 >= 4 * n) {
          counts.forecasts++;
          if (after[role]) {
            const vote = yes > n / 2,
              actual = after[role].slice(0, 2).join() !== origin.join();
            const local = prior.filter((s) => s.origin.join() === origin.join()),
              controls = local.length ? local : prior;
            // Same tie-breaking as a mode over previously observed displacements.
            const modes = new Map();
            for (const s of controls) modes.set(s.delta, (modes.get(s.delta) ?? 0) + 1);
            const base = [...modes].sort((a, b) => b[1] - a[1])[0][0] !== '0,0';
            counts.visible++;
            counts.correct += Number(vote === actual);
            counts.baselineCorrect += Number(base === actual);
            if (vote !== base) {
              counts.disagreements++;
              counts.correctDisagreements += Number(vote === actual);
              if (vote) {
                counts.predictsOpening++;
                counts.opened += Number(actual);
              }
            }
          }
        }
      }
      if (after[role]) {
        const delta = origin.map((v, i) => after[role][i] - v).join();
        prior.push({ scene, origin, moved: delta !== '0,0', delta });
      }
    }
  }
  for (const k of Object.keys(total)) total[k] += counts[k];
  if (counts.disagreements)
    byGame.push([
      game.code,
      counts.disagreements,
      counts.correctDisagreements,
      counts.predictsOpening,
      counts.opened,
    ]);
}
console.log(JSON.stringify({ total, byGame }));
