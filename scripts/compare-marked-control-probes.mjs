import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from './sic-study-source-replay.mjs';
const [engineDir, tape, code, out] = process.argv.slice(2);
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(engineDir, 'src/runtime/native-game-dispatcher.ts'))
);
const run = (await readFile(tape, 'utf8'))
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse)
  .find((r) => r.code === code);
assert.ok(run && run.start === run.finish && !run.resets);
const engine = createGameDispatcher(() => {
  throw Error('Public backend required');
});
const act = (c) =>
  engine.dispatch({
    type: 'action',
    actionId: c.id,
    ...(c.data ? { data: c.data } : {}),
  });
async function fork(index) {
  let b = await engine.dispatch({ type: 'load', code, level: run.start });
  if (b.level !== run.start)
    b = await engine.dispatch({ type: 'selectLevel', level: run.start });
  for (const c of run.replayCommands.slice(0, index)) b = await act(c);
  assert.equal(hash(b).slice(0, 16), run.replayCommands[index].from);
  return b;
}
function pattern(frame, box, dx = 0, dy = 0) {
  const out = [];
  for (let y = box[1]; y <= box[3]; y++)
    for (let x = box[0]; x <= box[2]; x++) out.push(frame[y + dy]?.[x + dx]);
  return out;
}
function localTravel(before, after, box) {
  const first = pattern(before, box),
    w = box[2] - box[0] + 1,
    h = box[3] - box[1] + 1;
  const offsets = [
    [0, 0],
    [w, 0],
    [-w, 0],
    [0, h],
    [0, -h],
  ];
  return offsets.flatMap(([dx, dy]) => {
    const next = pattern(after, box, dx, dy);
    return next.every((v, i) => v === first[i]) &&
      ((!dx && !dy) ||
        !pattern(before, box, dx, dy).every((v, i) => v === first[i]))
      ? [[dx, dy]]
      : [];
  });
}
const trials = [];
for (const p of run.preparation.filter(
  (p) =>
    p.phase === 'selectMarkedCursor' && p.result === 'cursor_mark_transferred',
)) {
  const index = p.actionIndex - 1,
    click = run.replayCommands[index],
    probe = run.replayCommands[index + 1];
  assert.equal(click.id, 6);
  const root = await fork(index),
    selected = await act(click);
  assert.equal(hash(selected).slice(0, 16), click.to);
  const alternatives = [];
  const hist = (frame, box) =>
    Object.entries(
      pattern(frame, box).reduce((h, v) => {
        h[v] = (h[v] ?? 0) + 1;
        return h;
      }, {}),
    );
  const shape = click.observedSubjects.map((box) => ({
    before: hist(root.frame, box),
    selected: hist(selected.frame, box),
  }));
  for (const id of root.availableActionIds.filter((id) => id >= 1 && id <= 5)) {
    const returns = [];
    for (const withClick of [false, true]) {
      await fork(index);
      if (withClick) await act(click);
      const result = await act({ id });
      const input = (withClick ? selected : root).frame;
      const subjects = click.observedSubjects.map((box) =>
        localTravel(input, result.frame, box),
      );
      returns.push({
        subjects,
        changed: hash(result) !== hash(withClick ? selected : root),
        won: result.levelsCompleted > root.levelsCompleted,
      });
      if (withClick && probe?.id === id)
        assert.equal(hash(result).slice(0, 16), probe.to);
    }
    alternatives.push({ id, without: returns[0], with: returns[1] });
  }
  // Independently replay the issued verification commands. Track occupied cells by their
  // ink counts and the parked foreground by its exact pixel mask.
  let prior = await fork(index);
  prior = await act(click);
  const [parked, target] = click.observedSubjects;
  const sorted = (arr) => [...arr].sort((a, b) => a - b).join(',');
  const stationaryInk = shape[0].before
    .filter(([v]) => !shape[1].before.some(([w]) => w === v))
    .sort(([, a], [, b]) => b - a)[0]?.[0];
  const tracking = [];
  for (const [i, cmd] of run.replayCommands
    .slice(index + 1, index + 6)
    .entries()) {
    if (cmd.cursorStage !== 'verify') break;
    const next = await act(cmd);
    assert.equal(hash(next).slice(0, 16), cmd.to);
    const old = pattern(prior.frame, target),
      signature = sorted(old);
    const oldPark = pattern(prior.frame, parked),
      newPark = pattern(next.frame, parked);
    const stationary =
      stationaryInk !== undefined &&
      oldPark.every(
        (v, j) =>
          (v === Number(stationaryInk)) ===
          (newPark[j] === Number(stationaryInk)),
      );
    const w = target[2] - target[0] + 1,
      h = target[3] - target[1] + 1;
    const sites = [
      [0, 0],
      [-w, 0],
      [w, 0],
      [0, -h],
      [0, h],
    ].filter(
      ([dx, dy]) =>
        sorted(pattern(next.frame, target, dx, dy)) === signature &&
        ((!dx && !dy) ||
          sorted(pattern(prior.frame, target, dx, dy)) !== signature),
    );
    tracking.push({ step: index + i + 2, id: cmd.id, stationary, sites });
    prior = next;
  }
  trials.push({
    step: index + 1,
    nextInput: probe?.id,
    alternatives,
    tracking,
  });
}
assert.ok(trials.length, 'No transferred visible mark in tape');
await writeFile(out, JSON.stringify({ code, start: run.start, trials }));
console.log(JSON.stringify({ trials: trials.length, first: trials[0].step }));
