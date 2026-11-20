import { fitStoppingSurface, firstHit, latticeContact } from './qualify-source-stopping-surfaces.mjs';
import { motionLawSelector } from './select-source-motion-law.mjs';

// Each forecast uses the last fitting displacement of the same role and command in another lane.
export function sourceStoppingAudit() {
  const history = new Map(),
    measured = new Set(),
    lengths = new Map(),
    result = [];
  const select = motionLawSelector();
  function observe(rows, before, after, extents, op, scene) {
    const edges = scene + '/' + op;
    if (measured.has(edges)) return;
    measured.add(edges);
    for (const [role, entry] of Object.entries(before)) {
      const from = entry.slice(0, 2),
        extent = extents[role],
        key = role + '/' + op;
      const group = history.get(key) ?? { origins: new Set(), examples: [] };
      history.set(key, group);
      const sample = group.examples.findLast((e) => e.from[1 - e.axis] !== from[1 - e.axis]);
      if (sample && !group.origins.has(from.join())) {
        const { axis, sign, rule, delta, end } = sample;
        const predicted = firstHit(rows, from, extent, axis, sign, rule.gap, rule.surface);
        const clear = firstHit(rows, from, extent, axis, sign, rule.gap, null, rule.traversed);
        if (predicted) {
          const add = from.map((v, i) => v + delta[i]),
            fixed = [...from];
          fixed[axis] = end[axis];
          const actual = after[role]?.slice(0, 2).join() ?? null;
          const lattice = latticeContact(from, clear, axis, sign, lengths.get(role), extent, rows);
          const choice = select(role, from, add, lattice, actual);
          result.push({
            seen: actual !== null,
            selected: choice.exact,
            choseStop: choice.useStop,
            different: predicted.join() !== add.join(),
            latticeDifferent: !!lattice && lattice.join() !== add.join(),
            lattice: !!lattice && lattice.join() === actual,
            surface: predicted.join() === actual,
            clearance: !!clear && clear.join() === actual,
            additive: add.join() === actual,
            fixed: fixed.join() === actual,
          });
        }
      }
      group.origins.add(from.join());
      if (!after[role]) continue;
      const end = after[role].slice(0, 2),
        delta = end.map((v, i) => v - from[i]);
      if (delta.filter(Boolean).length !== 1) continue;
      const axis = delta[0] ? 0 : 1,
        sign = Math.sign(delta[axis]);
      const values = lengths.get(role) ?? new Set();
      values.add(Math.abs(delta[axis]));
      lengths.set(role, values);
      const rule = fitStoppingSurface(rows, from, end, extent, axis, sign);
      if (rule) group.examples.push({ from, end, delta, rule, axis, sign });
    }
  }
  const summarize = (selected) => ({
    forecasts: selected.length,
    ...Object.fromEntries(
      ['seen', 'surface', 'clearance', 'lattice', 'additive', 'fixed', 'selected', 'choseStop'].map((k) => [
        k,
        selected.filter((r) => r[k]).length,
      ])
    ),
  });
  return {
    observe,
    totals: () => ({
      all: summarize(result),
      discordant: summarize(result.filter((r) => r.different)),
      latticeDiscordant: summarize(result.filter((r) => r.latticeDifferent)),
    }),
  };
}
