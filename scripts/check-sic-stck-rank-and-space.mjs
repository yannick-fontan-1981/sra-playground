/** Local audit of public STCK returns. Print aggregates only. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { compareStckRank } from '../src/sic/stck-stack.ts';
import { observeSpace } from '../src/sic/space-return.ts';

const archive = new URL('../docs/migration/native-campaigns-v42/stck-four-level-public-trace.json.gz', import.meta.url);
const { packets } = JSON.parse(gunzipSync(readFileSync(archive)));
const clicks = { stack: 0, other: 0, original: 0, additional: 0, slotsMatched: 0, shiftsMatched: 0, byLevel: {} };
const effects = { top: {}, lower: {} };
const space = { actions: 0, frames: 0, focus: 0, multipleFocus: 0, focusWithSprites: 0,
  focusWithOnlyRegions: 0, sprites: 0, moved: 0, changed: 0, lost: 0, boundaries: 0 };
for (let i = 1; i < packets.length; i++) {
  const { command, packet: after } = packets[i];
  const { packet: before } = packets[i - 1];
  if (command.action_ref === 'ACTION6') {
    const { x, y } = command.data;
    const trial = compareStckRank(before.frame_rows, after.frame_rows, [x, y], before.level);
    if (!trial) { clicks.other++; continue; }
    clicks.stack++;
    if ((before.level === 1 && x === 4 && y === 50) || (before.level === 3 && x === 4 && y === 26)) clicks.original++;
    else clicks.additional++;
    clicks.byLevel[trial.level] = (clicks.byLevel[trial.level] ?? 0) + 1;
    clicks.slotsMatched += Number(trial.expectedColor === trial.actualColor);
    clicks.shiftsMatched += Number(trial.stackShiftMatched);
    const row = effects[trial.rank === trial.depth ? 'top' : 'lower'];
    row[trial.actual] = (row[trial.actual] ?? 0) + 1;
  }
  if (command.action_ref !== 'ACTION5') continue;
  const entry = observeSpace({ sessionId: 'archive', sequence: i, fromLevel: before.level, toLevel: after.level },
    before.frame_rows, after.frame_packet);
  space.actions++;
  space.frames += entry.frames.length;
  for (const frame of entry.frames) {
    if (frame.boundary) space.boundaries++;
    if (frame.focus.length) space.focus++;
    if (frame.focus.length > 1) space.multipleFocus++;
    if (frame.focus.length && frame.sprites.length) space.focusWithSprites++;
    if (frame.focus.length && !frame.sprites.length && frame.regions?.regionCount) space.focusWithOnlyRegions++;
    if (frame.sprites.length) space.sprites++;
    if (frame.sprites.some(item => item.effect.includes('moved'))) space.moved++;
    if (frame.sprites.some(item => item.effect.includes('changed'))) space.changed++;
    if (frame.sprites.some(item => item.effect === 'no longer detected')) space.lost++;
  }
}
const replay = fileURLToPath(new URL('./check-sic-stck-rank-engine.py', import.meta.url));
const controlledCases = JSON.parse(execFileSync(process.env.PYTHON ?? 'python', [replay, '--local-audit-pipe'],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
const controlled = { cases: controlledCases.length, ranksMatched: 0, slotsMatched: 0, shiftsMatched: 0, effects: {} };
for (const [level, point, before, after, rank, depth] of controlledCases) {
  const trial = compareStckRank(before, after, point, level);
  if (!trial) continue;
  controlled.ranksMatched += Number(trial.rank === rank && trial.depth === depth);
  controlled.slotsMatched += Number(trial.actualColor === trial.expectedColor);
  controlled.shiftsMatched += Number(trial.stackShiftMatched);
  controlled.effects[trial.actual] = (controlled.effects[trial.actual] ?? 0) + 1;
}
assert.equal(clicks.shiftsMatched, clicks.stack);
assert.equal(controlled.ranksMatched, controlled.cases);
assert.equal(controlled.slotsMatched, controlled.cases);
assert.equal(controlled.shiftsMatched, controlled.cases);
console.log(JSON.stringify({ clicks, effects, controlled, space }));
