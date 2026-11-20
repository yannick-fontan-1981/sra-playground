import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const [environment, file] = process.argv.slice(2);
const run = JSON.parse(readFileSync(file, 'utf8').trim());
if (!run.replayCommands || run.replayCommands.length !== run.issued || run.sic !== run.issued || run.resets)
  throw Error('Expected a complete SIC-only trajectory without external resets');
const { createGameDispatcher } = await import(
  pathToFileURL(join(resolve(environment), 'src/runtime/native-game-dispatcher.ts'))
);
const engine = createGameDispatcher(() => {
  throw Error('Unexpected backend');
});
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
let board = await engine.dispatch({ type: 'load', code: run.code, level: run.start });
if (board.level !== run.start && board.canSelectLevel)
  board = await engine.dispatch({ type: 'selectLevel', level: run.start });
if (
  hash(board.frame) !== run.initial ||
  board.level !== run.start ||
  board.levelsCompleted !== run.initialCompleted
)
  throw Error('Initial observation differs');
const events = new Map(run.preparation.filter((e) => e.projection).map((e) => [e.actionIndex, e]));
const counts = { issued: 0, observed: 0, verifiedLanding: 0, verifiedContinuation: 0, refuted: 0 };
const cache = new Map();
for (const [i, cmd] of run.replayCommands.entries()) {
  if (hash(board.frame).slice(0, 16) !== cmd.from) throw Error('Divergent source at ' + i);
  board = await engine.dispatch({
    type: 'action',
    actionId: cmd.id,
    ...(cmd.id === 6 ? { data: cmd.data } : {}),
  });
  if (hash(board.frame).slice(0, 16) !== cmd.to) throw Error('Divergent return at ' + i);
  const event = events.get(i + 1);
  if (!event) continue;
  const p = event.projection;
  counts.issued++;
  const action = 'ACTION' + cmd.id + (cmd.id === 6 ? ':' + cmd.data.x + ',' + cmd.data.y : '');
  if (p.program[p.index] !== action) throw Error('Unbound experiment command at ' + i);
  if (event.result === 'official_completion') {
    if (board.levelsCompleted === run.initialCompleted && board.state !== 'WIN')
      throw Error('False claimed completion');
    continue;
  }
  const key = cmd.to + board.state + board.level;
  if (!cache.has(key))
    cache.set(
      key,
      await measureNativeObservation(
        {
          frame_rows: board.frame,
          frame_hash: cmd.to,
          level: board.level,
          levels_completed: board.levelsCompleted,
          state: board.state,
          available_action_refs: board.availableActionIds.map((v) => 'ACTION' + v),
        },
        i + 1
      )
    );
  const parts = cache.get(key).entities;
  const positions = p.roles.map(
    (id) => parts.find((e) => !e.identity_ambiguous && e.signature === id)?.position
  );
  const observed = positions.every(Boolean) ? positions : null;
  if (JSON.stringify(p.observed) !== JSON.stringify(observed))
    throw Error('Unreproducible pose observation at ' + i);
  const match = JSON.stringify(p.expected) === JSON.stringify(observed);
  if (['placement_verified', 'arrival_verified', 'continuation_verified'].includes(event.result) && !match)
    throw Error('False spatial match at ' + i);
  counts.observed += Number(!!observed);
  counts.verifiedLanding += Number(event.result === 'arrival_verified');
  counts.verifiedContinuation += Number(event.result === 'continuation_verified');
  counts.refuted += Number(event.result === 'projection_refuted');
}
const won = board.levelsCompleted > run.initialCompleted || board.level > run.start || board.state === 'WIN';
if (won !== run.levels[0].won) throw Error('Official replay differs');
console.log(
  JSON.stringify({
    code: run.code,
    start: run.start,
    initial: run.initial,
    actions: run.issued,
    levelsCompleted: board.levelsCompleted,
    finalLevel: board.level,
    state: board.state,
    won,
    projections: counts,
  })
);
