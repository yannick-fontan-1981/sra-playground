import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { initialMemory, recordExperiment } from '../src/sic/preparation-experiments.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { proposedOrbitTransfers } from '../src/sic/translated-orbit.ts';
const [env, dir, g, shard, output] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env)),
  [n, total] = shard.split('/').map(Number);
const files =
  g === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const programs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = [],
  out = [],
  allowed = new Set(GAME_CATALOG.map((x) => x.code));
for (const f of files)
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n'))
    runs.push(JSON.parse(l));
const read = (b, i) =>
  measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((x) => 'ACTION' + x),
    },
    i + 1
  );
for (const [k, r] of runs.entries()) {
  if (k % total !== n) continue;
  if (!allowed.has(r.code)) throw Error('Source levels only');
  const rep = sourceReplay(engine, programs, r),
    m = initialMemory(r.start),
    seen = new Set(),
    cases = [];
  let b = rep.restore(0),
    o = await read(b, 0);
  for (const [i, c] of r.steps.entries()) {
    if (!hash(b).startsWith(c.from)) throw Error('Divergent origin');
    if (i >= 5 && i % 4 === 1 && cases.length < 12) {
      const proposals = proposedOrbitTransfers(m, o, b.frame);
      for (const v of proposals.slice(0, 2)) {
        const id = JSON.stringify([v.actor, v.signature, v.near, v.far]);
        if (seen.has(id)) continue;
        seen.add(id);
        cases.push({ i, ...v, arrival: null, origin: i });
      }
    }
    const z = rep.act(op(c));
    if (!hash(z).startsWith(c.to)) throw Error('Wrong source transition');
    const y = await read(z, i + 1);
    if (y.level_epoch === o.level_epoch && y.state === o.state) {
      for (const v of cases) {
        if (v.arrival) continue;
        const e = y.entities.find((x) => x.signature === v.actor && !x.identity_ambiguous);
        if (e && v.target.some((p) => p.join() === e.position.join()))
          v.arrival = { i: i + 1, at: e.position, exact: v.foothold.join() === e.position.join(), op: op(c) };
      }
      recordExperiment(m, o, y, { action_ref: 'ACTION' + c.a, data: c.data ?? {} }, b.frame, z.frame);
    }
    b = z;
    o = y;
  }
  out.push({
    code: r.code,
    level: r.start,
    cases: cases.map(({ orbit, target, refs, ...x }) => ({
      ...x,
      orbitSize: orbit.length,
      targetSize: target.length,
    })),
  });
}
await writeFile(output, JSON.stringify(out));
