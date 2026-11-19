import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [env, solver, official, recording, output] = process.argv.slice(2);
const real = JSON.parse((await readFile(official, 'utf8')).trim()),
  replay = JSON.parse((await readFile(recording, 'utf8')).trim());
if (real.trajectory !== replay.trajectory) throw Error('Unmatched campaign');
const load = (base, file) => import(pathToFileURL(join(resolve(base), file)).href);
const { createGameDispatcher } = await load(env, 'src/runtime/native-game-dispatcher.ts');
const { measureNativeObservation } = await load(solver, 'src/logos-engine/v6-native-observer.ts');
const { measureEffect } = await load(solver, 'src/sic/preparation-experiments.ts');
const engine = createGameDispatcher(() => {
  throw Error('Unexpected backend');
});
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const obs = (b) =>
  measureNativeObservation(
    {
      level: b.level,
      levels_completed: b.levelsCompleted,
      frame_rows: b.frame,
      frame_hash: hash(b.frame),
      state: b.state,
      available_action_refs: b.availableActionIds.map((i) => 'ACTION' + i),
    },
    1
  );
function send(cmd) {
  return engine.dispatch({ type: 'action', actionId: cmd.id, ...(cmd.id === 6 ? { data: cmd.data } : {}) });
}
async function original(n) {
  let b = await engine.dispatch({ type: 'load', code: real.code, level: real.start });
  if (b.level !== real.start && b.canSelectLevel)
    b = await engine.dispatch({ type: 'selectLevel', level: real.start });
  if (hash(b.frame) !== real.initial) throw Error('Initial mismatch');
  for (const cmd of replay.replayCommands.slice(0, n)) b = await send(cmd);
  return b;
}
const byIndex = new Map(real.preparation.map((e) => [e.actionIndex, e])),
  out = [];
for (const e of real.preparation.filter((e) => e.phase === 'deriveB')) {
  const prepare = byIndex.get(e.actionIndex - 1);
  if (prepare?.phase !== 'deriveA' || prepare.hypothesis !== e.hypothesis || prepare.testSite !== e.testSite)
    throw Error('Missing preparation step');
  const start = e.actionIndex - 2,
    A = replay.replayCommands[start],
    B = replay.replayCommands[start + 1];
  const base = await original(start),
    control = await send(B),
    bare = measureEffect(await obs(base), await obs(control), base.frame, control.frame);
  const same = await original(start);
  if (hash(same.frame) !== hash(base.frame)) throw Error('Experimental origins diverged');
  const ready = await send(A),
    done = await send(B);
  const seenA = measureEffect(await obs(same), await obs(ready), same.frame, ready.frame),
    seenB = measureEffect(await obs(ready), await obs(done), ready.frame, done.frame);
  if (seenB.key !== e.actual) throw Error('Native treated return differs');
  const cap = e.capability,
    bm = cap && bare.moves.find((v) => v.actor === cap.bareActor),
    cm = cap && seenB.moves.find((v) => v.actor === cap.actor);
  const absent = cap
    ? cap.newMotion
      ? !bm
      : !bm || bm.dx !== cap.dx || bm.dy !== cap.dy
    : bare.key === e.bareEffect;
  const matched = cap
    ? !!cm &&
      (cap.newMotion
        ? Math.sign(cm.dx) === Math.sign(cap.dx) && Math.sign(cm.dy) === Math.sign(cap.dy)
        : cm.dx === cap.dx && cm.dy === cap.dy)
    : seenB.key === e.predicted;
  out.push({
    actionIndex: e.actionIndex,
    A: A.id,
    B: B.id,
    origin: hash(base.frame).slice(0, 16),
    sourceSite: e.trainedSite,
    site: e.testSite,
    preparationMatched: seenA.key === e.precondition,
    actualBaselineMatchesEpisode: bare.key === e.bareEffect,
    newCapability: !!cap?.newMotion && absent && matched,
    verified: seenA.key === e.precondition && absent && matched && bare.key !== seenB.key,
  });
}
await writeFile(output, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out));
