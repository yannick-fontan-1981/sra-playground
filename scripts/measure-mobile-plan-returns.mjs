import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {cellMatches} from '../src/sic/calibrate-spatial-controls.ts';
import {hash} from './sic-study-source-replay.mjs';

// Post-run audit of a cold, single-level episode. Receipts nominate the roles.
// The independent game instance supplies all positions, indications and scores.
const [engineRoot, tapePath, output] = process.argv.slice(2);
const run = JSON.parse((await readFile(tapePath, 'utf8')).trim());
assert.equal(run.start, run.finish);
assert.equal(run.resets, 0);
assert.equal(run.sic, run.replayCommands.length);
const {createGameDispatcher} = await import(pathToFileURL(resolve(engineRoot, 'src/runtime/native-game-dispatcher.ts')));
const engine = createGameDispatcher(() => { throw Error('Unexpected engine'); });
let board = await engine.dispatch({type:'load', code:run.code, level:run.start});
if (board.level !== run.start) board = await engine.dispatch({type:'selectLevel', level:run.start});
assert.equal(hash(board), run.initial);
const receipts = run.replayCommands.map(c => c.landmark);
const selection = receipts.findIndex(r => r?.stage === 'select_after_contact');
const offers = receipts.filter(r => r?.basis === 'use_mobile_indication');
assert.ok(selection >= 0 && offers.length);
const walks = offers.map(r => r.access.first).filter(s => !s.read);
const pitch = [0, 1].map(axis => Math.min(...walks.map(s => Math.abs(s.expected[axis] - s.from[axis])).filter(Boolean)));
assert.ok(pitch.every(Number.isFinite));
const matches = (position, expected) => cellMatches(position ?? null, expected, pitch);
const single = (layout, role) => layout[role]?.length === 1 ? layout[role][0].at : null;
async function observe(board, i) {
  const packet = await measureNativeObservation({frame_rows:board.frame, frame_hash:hash(board), state:board.state,
    level:board.level, levels_completed:board.levelsCompleted, available_action_refs:board.availableActionIds.map(id => 'ACTION'+id)}, i, 'audit');
  return visualLayout(packet, board.frame);
}

const history = new Map(), reads = [], borrowed = [];
let layout = await observe(board, 0), originalRoles, guardedRoles, selectedRoles, guarded = 0, matched = 0;
const rolesAt = (view, at) => Object.keys(view).filter(role => matches(single(view,role), at));
for (const [i, c] of run.replayCommands.entries()) {
  const r = c.landmark, mobile = r?.basis === 'use_mobile_indication' ? r.access : null;
  assert.equal(hash(board).slice(0,16), c.from);
  const priorRoles = r?.stage === 'place_before_selection' ? rolesAt(layout,r.from) : [];
  if (i > selection) {
    const candidates = guardedRoles.filter(role => matches(single(layout,role), receipts[selection].home));
    assert.ok(candidates.length, 'First placement lost before action '+(i+1));
    guardedRoles = candidates;
    guarded++;
  }
  if (mobile) {
    const step = mobile.first;
    selectedRoles = selectedRoles.filter(role => matches(single(layout,role),step.from));
    assert.ok(selectedRoles.length && matches(single(layout,mobile.pivot), step.centre));
    if (step.read) {
      assert.ok(matches(single(layout,mobile.cue),step.expected), 'Indication missing before activation');
      reads.push(i+1);
    }
    if (step.partnerVisit) {
      const previousFrame = step.partnerVisit.split(':frame:').at(-1);
      const wasVisited = history.get(previousFrame)?.some(v => originalRoles.includes(v.role) && matches(v.position,step.expected));
      assert.ok(wasVisited, 'Previous subject did not witness this site');
      borrowed.push(i+1);
    }
  }
  const next = await engine.dispatch({type:'action',actionId:c.id,...(c.data ? {data:c.data} : {})});
  assert.equal(hash(next).slice(0,16), c.to);
  const sameLevel = next.level === run.start && next.state === 'NOT_FINISHED';
  const nextLayout = sameLevel ? await observe(next,i+1) : null;
  for (const role of priorRoles) {
    const from = single(layout,role), to = nextLayout && single(nextLayout,role);
    if (!to || matches(to,from)) continue;
    for (const [frame, position] of [[c.from,from],[c.to,to]]) {
      history.set(frame,[...(history.get(frame) ?? []),{role,position}]);
    }
  }
  if (i === selection) {
    originalRoles = rolesAt(layout,r.home).filter(role => !matches(single(nextLayout,role),r.home));
    assert.ok(originalRoles.length, 'No original subject redrawn at the placement');
    selectedRoles = rolesAt(nextLayout,r.guard).filter(role => !matches(single(layout,role),r.guard));
    assert.ok(selectedRoles.length, 'No redrawn subject at the selected location');
    guardedRoles = Object.keys(nextLayout).filter(role => !matches(single(layout,role),r.home) && matches(single(nextLayout,role),r.home));
    assert.ok(guardedRoles.length, 'No redrawn partner at the placement');
  }
  if (mobile && sameLevel) {
    selectedRoles = selectedRoles.filter(role => matches(single(nextLayout,role),mobile.first.expected));
    assert.ok(selectedRoles.length && matches(single(nextLayout,mobile.pivot), mobile.first.placed),
      'Predicted position contradicted at action '+(i+1));
    matched++;
  }
  board = next; layout = nextLayout;
}
const official = board.levelsCompleted > run.initialCompleted || board.state === 'WIN';
assert.equal(official, run.levels[0].won);
const result = {game:run.code, level:run.start, official, actions:run.issued, selection:selection+1, guarded,
  firstMobileAction:receipts.findIndex(r => r?.basis === 'use_mobile_indication')+1,
  plannedActions:offers.length, predictedPosesObserved:matched, reads, borrowed,
  initialCompleted:run.initialCompleted, finalCompleted:board.levelsCompleted};
await writeFile(output, JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
