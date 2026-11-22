import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { visualLayout } from '../src/sic/witnessed-preview-transfer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceInterface } from './sic-study-source-interface.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

const [environment, output, ...files] = process.argv.slice(2);
if (!files.length) throw Error('Expected a source environment, output file and direct-entry source tapes.');
const engine = await sourceBackend(resolve(environment));

function firstRepeatedApproach(run) {
  const known = new Map(), tape = run.replayCommands;
  let repeats = 0;
  for (const [i, step] of tape.entries()) {
    const input = step.from + '/' + op(run.steps[i]);
    const returns = known.get(input) ?? new Set();
    repeats = returns.size === 1 && returns.has(step.to) ? repeats + 1 : 0;
    returns.add(step.to);
    known.set(input, returns);
    if (repeats < 4 || !tape[i + 1]) continue;
    const last = tape.slice(i - 3, i + 1);
    if (last.every((s, j) => s.reactiveContact && s.from !== s.to &&
        (!j || (s.from === last[j-1].to && s.to === last[j-1].from)))) return i;
  }
  return null;
}

async function parts(board) {
  const observation = await measureNativeObservation({
    frame_rows: board.frame, frame_hash: hash(board), state: board.state, level: board.level,
    levels_completed: board.levelsCompleted, available_action_refs: board.availableActionIds.map(id => 'ACTION' + id),
  }, 0, 'audit');
  return visualLayout(observation, board.frame);
}

async function compareAt(replay, run, index, cycle) {
  const board = replay.restore(index), step = run.replayCommands[index];
  assert.equal(hash(board).slice(0, 16), step.from);
  const inputs = board.availableActionIds.filter(id => id !== 6).map(id => 'ACTION' + id);
  if (board.availableActionIds.includes(6)) {
    const clicks = run.steps.slice(0, index).filter(s => s.a === 6).map(op);
    inputs.push(...new Set(clicks));
  }
  const direct = inputs.map(input => {
    replay.restore(index);
    const after = replay.act(input);
    return { input, image: hash(after).slice(0, 16), loss: after.state === 'GAME_OVER', credit: replay.win(after) };
  });
  const changed = new Map();
  for (const outcome of direct) {
    if (!outcome.loss && !outcome.credit && outcome.image !== step.from && !changed.has(outcome.image))
      changed.set(outcome.image, outcome.input);
  }
  const unchanged = direct.filter(o => o.image === step.from && !o.credit && !o.loss);
  const probes = [...unchanged.filter(o => !o.input.startsWith('ACTION6')).slice(0, 3),
    ...unchanged.filter(o => o.input.startsWith('ACTION6')).slice(0, 1)];
  const contrasts = [];
  let pairsTried = 0;
  for (const [preparedImage, preparation] of [...changed].slice(0, 4)) {
    for (const probe of probes) {
      replay.restore(index);
      const prepared = replay.act(preparation);
      assert.equal(hash(prepared).slice(0, 16), preparedImage);
      if (!prepared.availableActionIds.includes(Number(probe.input.split(':')[0].slice(6)))) continue;
      pairsTried++;
      const tested = replay.act(probe.input), image = hash(tested).slice(0, 16);
      if (tested.state !== 'GAME_OVER' && image !== preparedImage && !cycle.has(image))
        contrasts.push({ preparation, probe: probe.input, alone: probe.image, preparedImage, final: image, credit: replay.win(tested) });
    }
  }
  replay.restore(index);
  const forecast = step.reactiveContact, moved = replay.act(op(run.steps[index]));
  assert.equal(hash(moved).slice(0, 16), step.to);
  const before = await parts(board), after = await parts(moved);
  return { action: index + 1, origin: step.from, selected: op(run.steps[index]),
    arrivalObserved: !!after[forecast.actor]?.some(p => p.at.join() === forecast.to.join()),
    contactPredicted: forecast.to.join() === forecast.target.join(), targetsBefore: before[forecast.peer]?.length ?? 0,
    targetsAfter: after[forecast.peer]?.length ?? 0, direct, safeExits: direct.filter(o => !o.loss && !cycle.has(o.image)).length,
    pairsTried, contrasts };
}

const cases = [];
for (const file of files) {
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line.replace(/^\uFEFF/, ''));
    if (run.error || run.resets || run.start !== run.finish || run.observedPriorLevelActions || run.sourcePrefixActions) continue;
    if (!run.replayCommands?.some(c => c.reactiveContact)) continue;
    assert.equal(run.steps.length, run.issued);
    const i = firstRepeatedApproach(run);
    const row = { game: run.code, level: run.start, initial: run.initial, pack: run.packDigest, budget: run.cap,
      recordedScore: run.levels[0].won, firstRepeatedApproach: i === null ? null : i + 1, comparisons: [] };
    if (i !== null) {
      const replay = sourceReplay(sourceInterface(engine, run.sourceInterface), {}, run);
      const cycle = new Set([run.steps[i].from, run.steps[i].to]);
      for (const at of [i, i + 1]) {
        if (run.replayCommands[at].reactiveContact) row.comparisons.push(await compareAt(replay, run, at, cycle));
      }
    }
    cases.push(row);
  }
}
await writeFile(output, JSON.stringify(cases, null, 2) + '\n');
