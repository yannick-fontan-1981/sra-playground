// Offline paired interventions on the original cohort. The solver never imports this script.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
const [environment, layouts, rulesFile, output, ...files] = process.argv.slice(2);
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));
const poses = await read(layouts),
  laws = await read(rulesFile);
const traces = (
  await Promise.all(files.map(async (f) => (await readFile(f, 'utf8')).trim().split('\n').map(JSON.parse)))
).flat();
const ids = GAME_CATALOG.map((g) => g.code)
  .sort()
  .join();
for (const group of [poses, laws, traces])
  if (
    group
      .map((g) => g.code)
      .sort()
      .join() !== ids ||
    group.length !== 100
  )
    throw Error('Source cohort');
const engine = await sourceBackend(resolve(environment));
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const seen = new Map();
async function measure(board) {
  const id = hash(board.frame);
  if (!seen.has(id)) {
    const o = await measureNativeObservation(
      {
        frame_rows: board.frame,
        frame_hash: id,
        level: board.level,
        levels_completed: board.levelsCompleted,
        state: board.state,
        available_action_refs: board.availableActionIds.map((i) => 'ACTION' + i),
      },
      1
    );
    seen.set(
      id,
      Object.fromEntries(
        o.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e.position])
      )
    );
  }
  return seen.get(id);
}
const step = (op) => {
  const [name, xy] = op.split(':'),
    [x, y] = xy?.split(',').map(Number) ?? [];
  return engine.dispatch({
    type: 'action',
    actionId: Number(name.slice(6)),
    ...(xy ? { data: { x, y } } : {}),
  });
};
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const reports = [];
for (const group of laws.filter((g) => g.anchorRules.length)) {
  const trace = traces.find((g) => g.code === group.code),
    { scenes, edges } = poses.find((g) => g.code === group.code);
  function rewind(i) {
    let b = engine.dispatch({ type: 'load', code: trace.code, level: 1 });
    for (const s of trace.steps.slice(0, i)) {
      if (hash(b.frame) !== s.from) throw Error('Divergent source prefix');
      b = step(s.a === 6 ? 'ACTION6:' + s.data.x + ',' + s.data.y : 'ACTION' + s.a);
    }
    if (hash(b.frame) !== trace.steps[i].from) throw Error('Divergent fork');
    return b;
  }
  for (const l of group.anchorRules) {
    const a = l.traveler,
      k = l.landmark;
    const witnesses = edges.filter(
      ([s, op, t]) =>
        op === l.trigger &&
        scenes[s][a] &&
        scenes[s][k] &&
        scenes[t][a] &&
        !eq(scenes[s][a], scenes[t][a]) &&
        eq(add(scenes[s][k], l.offset), scenes[t][a])
    );
    const trained = new Set(witnesses.map(([s]) => scenes[s][k].slice(0, 2).join()));
    const controls = [
      ...new Set(
        edges
          .filter(
            ([s, op, t]) =>
              op !== l.trigger &&
              scenes[s][k] &&
              scenes[t][k] &&
              !eq(scenes[s][k], scenes[t][k]) &&
              eq(scenes[s][a], scenes[t][a])
          )
          .map(([, op]) => op)
      ),
    ].sort();
    const cases = [],
      tested = new Set();
    for (const [base] of witnesses) {
      const i = trace.steps.findIndex((s) => s.from === base),
        origin = rewind(i),
        initial = await measure(origin),
        bare = step(l.trigger);
      const barePos = (await measure(bare))[a];
      if (!barePos || !eq(barePos, add(initial[k], l.offset))) continue;
      const paths = controls.flatMap((op) => [[op], ...controls.map((other) => [op, other])]);
      for (const path of paths) {
        rewind(i);
        let after;
        for (const op of path) {
          after = step(op);
          if (after.level !== 1 || after.state !== origin.state) break;
        }
        if (after.level !== 1 || after.state !== origin.state) continue;
        const m = await measure(after);
        if (!eq(m[a], initial[a]) || !m[k] || trained.has(m[k].join())) continue;
        const key = base + '/' + m[k];
        if (tested.has(key) || edges.some(([s, op]) => s === hash(after.frame) && op === l.trigger)) continue;
        const forecast = add(m[k], l.offset);
        if (eq(forecast, barePos)) continue;
        tested.add(key);
        const test = {
          prefix: i,
          setup: path,
          actorOrigin: m[a],
          anchor: m[k],
          bare: barePos,
          predicted: forecast,
        };
        const end = step(l.trigger),
          actual = (await measure(end))[a] ?? null;
        cases.push({ ...test, actual, match: !!eq(actual, forecast) });
      }
    }
    reports.push({ game: group.code, law: l, cases });
  }
}
await writeFile(output, JSON.stringify(reports));
for (const r of reports)
  console.log(
    r.game,
    r.law.traveler.slice(0, 6),
    r.law.landmark.slice(0, 6),
    r.cases.filter((c) => c.match).length,
    r.cases.length
  );
