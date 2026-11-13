import assert from 'node:assert/strict';
import test from 'node:test';
import { projectNativeClickReturn } from '../src/logos-engine/v6-native-click-return.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { readControlEffectShadow } from '../src/sic/shadow.ts';

async function measure(rows: number[][], revision: number, level = 1, state = 'NOT_FINISHED') {
  return measureNativeObservation({
    frame_rows: rows, frame_hash: `fixture-${revision}`, level,
    levels_completed: level - 1, state, available_action_refs: ['ACTION6'],
  }, revision, 'session');
}

const command = { action_ref: 'ACTION6', data: { x: 1, y: 1 } };
const beforeRows = [
  [0, 0, 0, 0],
  [0, 2, 2, 0],
  [0, 2, 0, 0],
  [0, 0, 0, 0],
];

test('a native click receipt counts the addressed mask and recognizes exact support', async () => {
  const afterRows = [
    [0, 0, 0, 0],
    [0, 3, 3, 0],
    [0, 3, 0, 0],
    [0, 0, 0, 0],
  ];
  const before = await measure(beforeRows, 1);
  const after = await measure(afterRows, 2);
  const receipt = projectNativeClickReturn(command, before, after, afterRows);
  assert.equal(receipt?.target?.pixels, 3);
  assert.equal(receipt?.target?.palette, 2);
  assert.equal(receipt?.atPointAfter?.palette, 3);
  assert.equal(receipt?.sameSupport, true);
  assert.equal(receipt?.changedTargetPixels, 3);
  assert.equal(projectNativeClickReturn({ action_ref: 'ACTION1', data: {} }, before, after, afterRows), null);
  // The native runtime can carry a non-coordinate command with no data field.
  const space = { action_ref: 'ACTION5' } as typeof command;
  assert.equal(projectNativeClickReturn(space, before, after, afterRows), null);
});

test('a shape change is not a same-support recolor and a new level is not a local effect', async () => {
  const afterRows = [
    [0, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 2, 2, 0],
    [0, 0, 0, 0],
  ];
  const before = await measure(beforeRows, 1);
  const after = await measure(afterRows, 2);
  const receipt = projectNativeClickReturn(command, before, after, afterRows);
  assert.equal(receipt?.changedTargetPixels, 1);
  assert.equal(receipt?.sameSupport, false);
  const boundary = projectNativeClickReturn(command, before, await measure(afterRows, 2, 2), afterRows);
  assert.equal(boundary?.boundary, true);
  assert.equal(boundary?.atPointAfter, null);
  assert.equal(boundary?.changedTargetPixels, 0);
});

test('SIC binds the native receipt to its checked return without promoting the next command', async () => {
  const before = await measure(beforeRows, 1);
  const after = await measure(beforeRows, 2);
  const receipt = projectNativeClickReturn(command, before, after, beforeRows);
  assert.ok(receipt);
  const board = { gameCode: 'TEST', level: 1, state: 'NOT_FINISHED', availableActionIds: [6] };
  const agent = {
    sessionId: 'session', sequence: 1, level: 1, status: 'paused', busy: false,
    pendingAction: { id: 6, data: { x: 2, y: 2 } },
    trace: [{ kind: 'actual_outcome', observation_ref: receipt.afterRef, matched: true }],
    lastClickReturn: receipt,
  } as const;
  const view = readControlEffectShadow(board, agent, 2);
  assert.deepEqual(view?.clickReturn, receipt);
  assert.equal(view?.clickReturn?.changedTargetPixels, 0);
  assert.equal(view?.resolution.outcome, 'needs_evidence');
  assert.equal(view?.frame.traits.effectIsolatable, undefined);
  assert.equal(readControlEffectShadow(board, { ...agent, sequence: 2 }, 3)?.clickReturn, null);
  assert.equal(readControlEffectShadow(board, { ...agent, sessionId: 'replacement' }, 2)?.clickReturn, null);
  assert.equal(readControlEffectShadow(board, { ...agent, trace: [] }, 2)?.clickReturn, null);
  assert.equal(readControlEffectShadow(board, {
    ...agent, lastClickReturn: { ...receipt, beforeRef: 'wrong-source' },
  }, 2)?.clickReturn, null);
});
