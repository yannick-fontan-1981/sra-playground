import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { sourceBackend } from './sic-study-source-games.mjs';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { measureEffect } from '../src/sic/preparation-experiments.ts';
const [environment, output, ...files] = process.argv.slice(2);
const games = await sourceBackend(resolve(environment));
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const observe = (board) =>
  measureNativeObservation(
    {
      frame_rows: board.frame,
      frame_hash: hash(board.frame),
      level: board.level,
      levels_completed: board.levelsCompleted,
      state: board.state,
      available_action_refs: board.availableActionIds.map((i) => 'ACTION' + i),
    },
    1
  );
const act = (op) => {
  const [name, point] = op.split(':'),
    id = Number(name.slice(6));
  const [x, y] = point?.split(',').map(Number) ?? [];
  return games.dispatch({ type: 'action', actionId: id, ...(id === 6 ? { data: { x, y } } : {}) });
};
const report = [];
for (const file of files) {
  const r = JSON.parse((await readFile(file, 'utf8')).trim());
  if (!['KEYD', 'SWCH'].includes(r.code) || r.start !== 1 || r.finish !== 1 || r.sic !== r.issued)
    throw Error('Expected focused public source trace');
  const unique = new Set(),
    outcomes = [];
  for (const e of r.preparation.filter((x) => x.phase === 'deriveControl')) {
    const key = e.hypothesis + '/' + e.testSite;
    if (unique.has(key)) continue;
    unique.add(key);
    const i = e.actionIndex - 1,
      [, prep, probe] = e.hypothesis.split('|'),
      action = r.steps[i];
    if (!action || probe.split(':')[0] !== 'ACTION' + action.a)
      throw Error('Invalid prospective probe index ' + r.code + ' ' + i);
    function rewind() {
      let board = games.dispatch({ type: 'load', code: r.code, level: 1 });
      for (const s of r.steps.slice(0, i)) {
        if (hash(board.frame) !== s.from) throw Error('Prefix diverged');
        board = games.dispatch({ type: 'action', actionId: s.a, ...(s.a === 6 ? { data: s.data } : {}) });
      }
      if (hash(board.frame) !== action.from) throw Error('Origins do not match');
      return board;
    }
    const origin = rewind(),
      observed = await observe(origin),
      direct = act(probe);
    if (hash(direct.frame) !== action.to) throw Error('Control outcome diverged');
    const bare = measureEffect(observed, await observe(direct), origin.frame, direct.frame);
    rewind();
    const ready = act(prep),
      obsReady = await observe(ready);
    const preparation = measureEffect(observed, obsReady, origin.frame, ready.frame);
    if (ready.level !== 1 || ready.state === 'GAME_OVER' || ready.state === 'WIN') {
      outcomes.push({ id: key, status: 'terminal_preparation' });
      continue;
    }
    const prepared = act(probe),
      effect = measureEffect(obsReady, await observe(prepared), ready.frame, prepared.frame);
    const cap = e.capability;
    const bm = cap && bare.moves.find((v) => v.actor === cap.bareActor),
      cm = cap && effect.moves.find((v) => v.actor === cap.actor);
    const absent = cap
      ? cap.newMotion
        ? !bm
        : !bm || bm.dx !== cap.dx || bm.dy !== cap.dy
      : bare.key === e.bareEffect;
    const present = cap
      ? !!cm &&
        (cap.newMotion
          ? Math.sign(cm.dx) === Math.sign(cap.dx) && Math.sign(cm.dy) === Math.sign(cap.dy)
          : cm.dx === cap.dx && cm.dy === cap.dy)
      : effect.key === e.predicted;
    const matchesA = preparation.key === e.precondition,
      verified = matchesA && absent && present && effect.key !== bare.key;
    outcomes.push({
      id: key,
      sourceRevision: e.revision,
      site: e.testSite,
      trained: e.trainedSite,
      matchedPrefix: action.from,
      absent,
      matchesA,
      present,
      status: verified ? 'verified' : 'not_verified',
    });
  }
  report.push({
    code: r.code,
    total: outcomes.length,
    verified: outcomes.filter((x) => x.status === 'verified').length,
    outcomes,
  });
}
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.map(({ code, total, verified }) => ({ code, total, verified }))));
