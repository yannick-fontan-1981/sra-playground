import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { visualLayout } from '../src/sic/witnessed-preview-transfer.ts';
import { detectTransportSelection, readTransport } from '../src/sic/transport-observations.ts';
import { hash } from './sic-study-source-replay.mjs';
const [env, tape, code, out] = process.argv.slice(2);
const run = (await readFile(tape, 'utf8'))
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse)
  .find((r) => r.code === code);
assert.ok(
  run &&
    !run.sourcePrefixActions &&
    !run.observedPriorLevelActions &&
    !run.resets &&
    run.start === run.finish,
);
const series = new Map();
for (const [i, c] of run.replayCommands.entries()) {
  if (c.landmark?.stage !== 'place_before_selection') continue;
  const key = [c.from, c.id, c.to].join('/'),
    list = series.get(key) ?? [];
  list.push(i);
  series.set(key, list);
}
const repeated = [...series.values()].sort((a, b) => b.length - a.length);
assert.ok(repeated[0]?.length >= 2);
const index = repeated[0][0],
  rootCommand = run.replayCommands[index],
  { createGameDispatcher } = await import(
    pathToFileURL(resolve(env, 'src/runtime/native-game-dispatcher.ts'))
  );
const engine = createGameDispatcher(() => {
  throw Error('Public backend required');
});
const act = (c) => engine.dispatch({ type: 'action', actionId: c.id, ...(c.data ? { data: c.data } : {}) });
async function restore() {
  let b = await engine.dispatch({ type: 'load', code, level: run.start });
  if (b.level !== run.start) b = await engine.dispatch({ type: 'selectLevel', level: run.start });
  for (const c of run.replayCommands.slice(0, index)) b = await act(c);
  assert.equal(hash(b).slice(0, 16), rootCommand.from);
  return b;
}
const b = await restore(),
  o = await measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      state: b.state,
      level: b.level,
      levels_completed: b.levelsCompleted,
      available_action_refs: b.availableActionIds.map((id) => 'ACTION' + id),
    },
    0,
    'audit',
  );
const layout = visualLayout(o, b.frame),
  points = new Map();
for (const parts of Object.values(layout))
  for (const body of parts) {
    const x = Math.round(body.at[0] / 2),
      y = Math.round(body.at[1] / 2);
    points.set(x + ',' + y, [x, y]);
  }
const probe = async (id, selection) => {
  await restore();
  if (selection) await act({ id: 6, data: { x: selection[0], y: selection[1] } });
  return act({ id });
};
const motorIds = b.availableActionIds.filter((id) => id >= 1 && id <= 4),
  history = new Set(run.replayCommands.slice(0, index).map((c) => c.to));
const changed = [],
  initialControls = {};
for (const id of b.availableActionIds.filter((id) => id !== 6)) {
  const n = await probe(id);
  initialControls[id] = {
    hash: hash(n).slice(0, 16),
    novel: !history.has(hash(n).slice(0, 16)),
    state: n.state,
  };
}
if (b.availableActionIds.includes(6))
  for (const p of points.values()) {
    await restore();
    const selected = await act({ id: 6, data: { x: p[0], y: p[1] } });
    if (hash(selected) === hash(b)) continue;
    const m = detectTransportSelection(layout, b.frame, selected.frame, p, 'selection');
    const outcomes = [];
    for (const id of motorIds) {
      const result = await probe(id, p);
      if (!m || result.state !== 'NOT_FINISHED') continue;
      const original = await probe(id),
        before = readTransport(m, b.frame),
        after = readTransport(m, result.frame),
        direct = readTransport(m, original.frame);
      if (!before || !after || !direct) continue;
      const displacements = (v) => v.subject.map((n, i) => n !== before.subject[i]);
      const comparison = {
        op: id,
        withoutClick: displacements(direct),
        afterClick: displacements(after),
        hash: hash(result).slice(0, 16),
      };
      outcomes.push(comparison);
    }
    changed.push({
      p,
      selected: hash(selected).slice(0, 16),
      verified: outcomes.some(
        (v) => v.withoutClick[0] && !v.withoutClick[1] && !v.afterClick[0] && v.afterClick[1],
      ),
      outcomes,
    });
  }
const reverse = repeated.find((ids) => {
  const c = run.replayCommands[ids[0]];
  return c.from === rootCommand.to && c.to === rootCommand.from;
});
const report = {
  code,
  step: index + 1,
  again: repeated[0][1] + 1,
  visits: repeated[0].length,
  reverseVisits: reverse?.length ?? 0,
  requested: rootCommand.id,
  root: rootCommand.from,
  actionResult: rootCommand.to,
  clickTargets: points.size,
  changed,
  initialControls,
};
await writeFile(out, JSON.stringify(report));
console.log(
  JSON.stringify({
    step: report.step,
    again: report.again,
    visits: report.visits,
    reverseVisits: report.reverseVisits,
    clickTargets: points.size,
    changed: changed.length,
    verified: changed.filter((a) => a.verified).length,
    directAlternatives: Object.entries(initialControls).filter(
      ([k, v]) => Number(k) !== rootCommand.id && v.novel,
    ).length,
  }),
);
