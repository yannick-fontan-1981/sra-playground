import { fitMotion, projectedStep, equalLayout } from '../src/sic/projected-motion.ts';
import { compareControlRepertoires } from '../src/sic/control-repertoire.ts';

const layout = (state, pair) => (pair.every((r) => state.has(r)) ? pair.map((r) => state.get(r)) : null);

// For each preparation withhold all its subsequent measurements, including every
// other preparation producing the same full image. No held-out terminal states enter fitting.
export function forecastPreparedControls(start, singles, forks, hashes) {
  const out = new Map();
  for (const [a, prepared] of singles) {
    if (!prepared) continue;
    const transitions = [];
    for (const [op, state] of singles) if (state) transitions.push({ op, from: start, to: state });
    for (const [other, answers] of forks) {
      if (hashes.get(other) === hashes.get(a)) continue;
      for (const [op, state] of answers)
        if (state) transitions.push({ op, from: singles.get(other), to: state });
    }
    const variation = new Map();
    for (const { from, to } of transitions)
      for (const [id, p] of from) {
        const end = to.get(id);
        if (!end || p.join() === end.join() || !start.has(id) || !prepared.has(id)) continue;
        const changed = variation.get(id) ?? new Set();
        changed.add(p.join());
        changed.add(end.join());
        variation.set(id, changed);
      }
    const ids = [...variation]
      .sort((x, y) => y[1].size - x[1].size || x[0].localeCompare(y[0]))
      .slice(0, 4)
      .map(([id]) => id);
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const pair = [ids[i], ids[j]],
          root = layout(start, pair),
          here = layout(prepared, pair);
        if (equalLayout(root, here)) continue;
        const samples = new Map();
        for (const [k, t] of transitions.entries()) {
          const before = layout(t.from, pair),
            after = layout(t.to, pair);
          if (!before || !after) continue;
          const list = samples.get(t.op) ?? [];
          list.push({ before, after, ref: k });
          samples.set(t.op, list);
        }
        const guesses = new Map();
        for (const [op, list] of samples) {
          const direct = singles.get(op) && layout(singles.get(op), pair);
          if (!direct) continue;
          const matching = list.filter((s) => equalLayout(s.before, here));
          if (matching.length && !matching.every((s) => equalLayout(s.after, matching[0].after))) continue;
          const after = matching[0]?.after ?? projectedStep(fitMotion(op, list), here);
          guesses.set(op, { direct, after, unseen: !matching.length });
        }
        for (const role of [0, 1]) {
          const responses = new Map(
            [...guesses].map(([op, g]) => [op, { before: g.direct[role], after: g.after[role] }])
          );
          for (const [b, g] of guesses) {
            const signal = compareControlRepertoires(root[role], here[role], responses, b);
            if (!signal || signal.score <= 0) continue;
            const key = a + '/' + b,
              prior = out.get(key);
            if (!prior || signal.score > prior.score)
              out.set(key, { a, b, role: pair[role], at: g.after[role], ...signal, unseen: g.unseen });
          }
        }
      }
  }
  return out;
}
