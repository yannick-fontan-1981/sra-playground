import { candidates, same } from './source-transfer-demonstration.mjs';
import { hash } from './sic-study-source-replay.mjs';
import { length, diff } from './source-corresponding-sites.mjs';

// Rebind the local effects in a demonstration. Each public scene can yield a different menu.
// Keep the two site locations actually produced by an intervention, including snapped placements.
export async function recombineSites({ root, model, observe, play, issue, active }) {
  const queue = [{ word: [], marks: 0 }],
    seen = new Set([hash(root)]),
    covered = new Set(),
    prepared = new Map();
  const rootParts = await observe(root);
  const origins = new Set(
    rootParts.parts.filter((e) => e.geometry === model.markerShape).map((e) => e.position.join())
  );
  let expanded = 0,
    commands = 0;
  const rank = (n) => 20 * n.marks - n.word.length;
  while (queue.length && expanded < 48) {
    queue.sort((a, b) => rank(b) - rank(a));
    const node = queue.shift(),
      b = play(node.word),
      idx = await observe(b);
    expanded++;
    const marks = idx.parts.filter((e) => e.geometry === model.markerShape);
    for (const e of marks)
      for (const f of marks) {
        if (
          same(e.position, f.position) ||
          (origins.has(e.position.join()) && origins.has(f.position.join()))
        )
          continue;
        const key = e.position.join() + '/' + f.position.join();
        if (!prepared.has(key))
          prepared.set(key, {
            word: node.word,
            entry: e.position,
            exit: f.position,
            weight: 1 / (1 + node.word.length),
          });
      }
    if (node.word.length >= 6) continue;
    const pointOptions = new Map();
    if (b.availableActionIds.includes(6))
      for (const s of model.steps) {
        for (const { p, fidelity } of candidates(s, idx, b.frame, true))
          pointOptions.set(
            'ACTION6:' + p.join(),
            Math.max(pointOptions.get('ACTION6:' + p.join()) ?? 0, fidelity)
          );
      }
    const ops = [...pointOptions.keys()].sort((a, b) => pointOptions.get(b) - pointOptions.get(a));
    ops.push(...b.availableActionIds.filter((k) => k !== 6).map((k) => 'ACTION' + k));
    for (const k of ops) {
      const n = issue(play(node.word), k);
      commands++;
      if (!active(n)) continue;
      const key = hash(n);
      if (seen.has(key)) continue;
      const next = await observe(n),
        sites = next.parts.filter((e) => e.geometry === model.markerShape);
      const positioned = sites
        .map((e) => e.position.join())
        .sort()
        .join('/');
      const previous = marks
        .map((e) => e.position.join())
        .sort()
        .join('/');
      if (
        !k.includes(':') &&
        positioned === previous &&
        [...idx.ids.values()].some(
          (e) =>
            e.geometry === model.actorShape &&
            next.ids.get(e.signature) &&
            !same(next.ids.get(e.signature).position, e.position)
        )
      )
        continue;
      seen.add(key);
      const group = positioned + '|' + k.split(':')[0];
      const bonus = covered.has(group) ? 0 : 0.2;
      covered.add(group);
      queue.push({ word: [...node.word, k], marks: Math.min(2, sites.length) + bonus });
    }
  }
  return { setups: [...prepared.values()], expanded, commands, observations: seen.size };
}
