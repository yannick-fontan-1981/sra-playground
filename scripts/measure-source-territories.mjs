import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { initialMemory, recordExperiment } from '../src/sic/preparation-experiments.ts';
import { territorialMaps, terrainKey } from '../src/sic/controllable-territory.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, op, hash } from './sic-study-source-replay.mjs';
const [env, dir, cohort, shard, out] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env)),
  [n, total] = shard.split('/').map(Number);
const files =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const programs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = [];
for (const f of files)
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n'))
    runs.push(JSON.parse(l));
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  reports = [];
for (const [k, r] of runs.entries()) {
  if (k % total !== n) continue;
  if (!allowed.has(r.code)) throw Error('Source games only');
  const m = initialMemory(r.start),
    rep = sourceReplay(engine, programs, r),
    seen = new Set(),
    tickets = [],
    positions = [],
    counts = {};
  const measure = (b, j) =>
    measureNativeObservation(
      {
        frame_rows: b.frame,
        frame_hash: hash(b),
        level: b.level,
        levels_completed: b.levelsCompleted,
        state: b.state,
        available_action_refs: b.availableActionIds.map((k) => 'ACTION' + k),
      },
      j + 1
    );
  let board = rep.restore(0),
    o = await measure(board, 0);
  for (const [i, c] of r.steps.entries()) {
    if (!hash(board).startsWith(c.from)) throw Error('Wrong source origin');
    if (i >= 4 && i % 3 === 1) {
      const maps = territorialMaps(m, o, board.frame);
      counts.charted = (counts.charted ?? 0) + Number(maps.length > 0);
      for (const t of maps.slice(0, 2)) {
        const key = JSON.stringify([t.actor, t.foothold, t.stride, t.rim.tested !== null]);
        if (seen.has(key) || tickets.length >= 12) continue;
        seen.add(key);
        tickets.push({
          i,
          actor: t.actor,
          from: t.from,
          origin: t.origin,
          width: t.width,
          stride: t.stride,
          ground: t.ground,
          seen: t.seen.size,
          home: t.home.size,
          foreign: [...t.foreign],
          foothold: t.foothold,
          rim: t.rim,
          alternatives: t.alternatives,
          firstArrival: null,
          ops: t.ops,
        });
      }
    }
    const next = rep.act(op(c));
    if (!hash(next).startsWith(c.to)) throw Error('Source transition changed');
    const after = await measure(next, i + 1);
    if (o.level_epoch === after.level_epoch && o.state === after.state) {
      for (const t of tickets) {
        if (t.firstArrival) continue;
        const actor = after.entities.find((e) => e.signature === t.actor && !e.identity_ambiguous);
        if (actor && t.foreign.includes(terrainKey(actor.position, t.width)))
          t.firstArrival = { action: i + 1, op: op(c), to: actor.position };
      }
      recordExperiment(
        m,
        o,
        after,
        { action_ref: 'ACTION' + c.a, data: c.data ?? {} },
        board.frame,
        next.frame
      );
    }
    o = after;
    board = next;
  }
  reports.push({
    code: r.code,
    level: r.start,
    counts,
    tickets: tickets.map(({ foreign, ...rest }) => ({ ...rest, foreignSize: foreign.length })),
  });
}
await writeFile(out, JSON.stringify(reports));
