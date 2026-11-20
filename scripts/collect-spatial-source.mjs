import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const [environment, output, ...files] = process.argv.slice(2);
const stopping = files[0] === '--stopping';
if (stopping) files.shift();
const createAudit = stopping
  ? (await import('./audit-source-stopping-surfaces.mjs')).sourceStoppingAudit
  : null;
const traces = (
  await Promise.all(files.map(async (f) => (await readFile(f, 'utf8')).trim().split('\n').map(JSON.parse)))
).flat();
if (
  traces
    .map((r) => r.code)
    .sort()
    .join() !==
    GAME_CATALOG.map((g) => g.code)
      .sort()
      .join() ||
  traces.length !== 100
)
  throw Error('Require complete original cohort');
const engine = await sourceBackend(resolve(environment));
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const result = [];
for (const r of traces) {
  if (r.start !== 1 || r.finish !== 1 || r.resets || r.issued !== r.steps.length)
    throw Error('Invalid source prefix ' + r.code);
  let board = engine.dispatch({ type: 'load', code: r.code, level: 1 });
  const scenes = {},
    edges = [];
  const audit = createAudit?.(),
    extents = {};
  async function scene(board, expected) {
    const digest = hash(board.frame);
    if (digest !== expected) throw Error('Frame mismatch ' + r.code);
    if (!scenes[digest]) {
      const obs = await measureNativeObservation(
        {
          frame_rows: board.frame,
          frame_hash: digest,
          level: board.level,
          levels_completed: board.levelsCompleted,
          state: board.state,
          available_action_refs: board.availableActionIds.map((i) => 'ACTION' + i),
        },
        1
      );
      scenes[digest] = Object.fromEntries(
        obs.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, [...e.position, e.area]])
      );
      if (audit)
        for (const e of obs.entities)
          extents[e.signature] = [e.bbox[2] - e.bbox[0] + 1, e.bbox[3] - e.bbox[1] + 1];
    }
  }
  for (const step of r.steps) {
    await scene(board, step.from);
    const after = engine.dispatch({
      type: 'action',
      actionId: step.a,
      ...(step.a === 6 ? { data: step.data } : {}),
    });
    await scene(after, step.to);
    if (
      board.state === after.state &&
      board.level === after.level &&
      board.levelsCompleted === after.levelsCompleted
    ) {
      edges.push([
        step.from,
        step.a === 6 ? 'ACTION6:' + step.data.x + ',' + step.data.y : 'ACTION' + step.a,
        step.to,
      ]);
      if (audit)
        audit.observe(board.frame, scenes[step.from], scenes[step.to], extents, edges.at(-1)[1], step.from);
    }
    board = after;
  }
  result.push(audit ? { code: r.code, ...audit.totals() } : { code: r.code, scenes, edges });
}
await writeFile(output, JSON.stringify(result));
console.log(
  JSON.stringify({
    games: traces.length,
    steps: traces.reduce((n, r) => n + r.steps.length, 0),
    ...(stopping ? {} : { scenes: result.reduce((n, r) => n + Object.keys(r.scenes).length, 0) }),
  })
);
