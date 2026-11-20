import { readFile } from 'node:fs/promises';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { publicParts, same } from './source-transfer-demonstration.mjs';

// Select the earliest witnessed exchange and a few earlier distinct preparations.
// For each selected prefix the subsequent commands of the archived episode remain hidden from the planner.
export async function exchangePrefixes(file, code, level, engine, programs) {
  const rows = (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
  const run = rows.find((r) => r.code === code && r.start === level);
  if (!run || !run.steps || run.resets || run.issued !== run.sic || run.steps.length !== run.issued)
    throw Error('Expected a verified source trajectory');
  const replay = sourceReplay(engine, programs, run),
    observe = publicParts(),
    word = [],
    changed = [],
    swaps = [],
    poses = new Set(),
    refs = new Set();
  let b = replay.restore(0);
  for (const s of run.steps) {
    if (hash(b).slice(0, 16) !== s.from) throw Error('Archived prefix diverged');
    const idx = await observe(b),
      n = replay.act(op(s));
    word.push(op(s));
    if (hash(n).slice(0, 16) !== s.to) throw Error('Archived step diverged');
    if (
      n.level !== level ||
      n.levelsCompleted !== run.initialCompleted ||
      n.state === 'WIN' ||
      n.state === 'GAME_OVER'
    )
      break;
    const next = await observe(n);
    const moved = [...idx.ids.values()].filter(
      (e) => next.ids.has(e.signature) && !same(next.ids.get(e.signature).position, e.position)
    );
    const swap = moved.some((e) =>
      moved.some(
        (f) =>
          f !== e &&
          same(next.ids.get(e.signature).position, f.position) &&
          same(next.ids.get(f.signature).position, e.position)
      )
    );
    if (swap && !refs.has(s.to)) {
      swaps.push([...word]);
      refs.add(s.to);
    }
    if (changed.length < 8 && !poses.has(s.to) && s.from !== s.to && (moved.length > 0 || !changed.length)) {
      changed.push([...word]);
      poses.add(s.to);
    }
    b = n;
  }
  const paths = [...swaps.slice(0, 2), ...changed.slice(0, 3), ...changed.slice(-2)];
  return {
    paths: [...new Map(paths.map((w) => [w.join('/'), w])).values()],
    initial: run.initial,
    observedSwaps: swaps.length,
  };
}
