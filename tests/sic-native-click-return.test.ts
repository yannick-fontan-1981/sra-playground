import assert from 'node:assert/strict';
import test from 'node:test';
import { projectNativeClickReturn } from '../src/logos-engine/v6-native-click-return.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { readControlEffectShadow } from '../src/sic/shadow.ts';
import { observeSpace } from '../src/sic/space-return.ts';
import { changedReturnRegions } from '../src/logos-engine/v6-public-return-visuals.ts';
import { compareAboveColors, compareClickReturns, contrastClickContexts } from '../src/sic/click-evidence.ts';

async function measure(rows: number[][], revision: number, level = 1, state = 'NOT_FINISHED') {
  return measureNativeObservation({
    frame_rows: rows, frame_hash: `fixture-${revision}`, level,
    levels_completed: level - 1, state, available_action_refs: ['ACTION6'],
  }, revision, 'session');
}

const command = { action_ref: 'ACTION6', data: { x: 1, y: 1 } };

test('other regions exclude the clicked box and retain aligned before and after crops', () => {
  const before = [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]];
  const after = [[2, 2, 1, 3], [2, 2, 1, 3], [1, 1, 1, 1]];
  const changes = changedReturnRegions(before, after, [0, 0, 1, 1]);
  assert.deepEqual(changes, {
    totalPixels: 2, regionCount: 1,
    samples: [{ box: [3, 0, 3, 1], pixels: 2, stride: 1, before: [[1], [1]], after: [[3], [3]] }],
  });
});

test('Space retains transient changes and counts every frame even when previews are sampled', () => {
  const before = [[0, 0]];
  const frames = Array.from({ length: 13 }, (_, index) => index === 4 ? [[1, 1]] : before);
  const result = observeSpace({ sessionId: 's', sequence: 3, fromLevel: 1, toLevel: 1 }, before, frames);
  assert.equal(result.peakChange, 2);
  assert.equal(result.finalChange, 0);
  assert.equal(result.frames.length, 13);
  assert.equal(result.frames[5]?.changedFromPrevious, 2);
  assert.equal(result.previews.length, 12);
  assert.equal(result.previews[0]?.index, 1);
  assert.equal(result.previews.at(-1)?.index, 13);
});
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

test('the click context measures the board before the action and clips at the edge', async () => {
  const rows = [[2, 3, 4], [2, 3, 4], [5, 6, 7]];
  const before = await measure(rows, 1);
  const after = await measure(beforeRows, 2);
  const receipt = projectNativeClickReturn({ action_ref: 'ACTION6', data: { x: 0, y: 0 } }, before, after, beforeRows, rows);
  assert.deepEqual(receipt?.beforeContext, {
    state: 'NOT_FINISHED', commands: ['ACTION6'], matchingRegions: 1,
    neighborhood: { above: [], right: [3, 4], below: [5], left: [] },
  });
  assert.deepEqual(receipt?.preview, {
    before: rows, after: beforeRows.slice(0, 3).map(row => row.slice(0, 3)), point: [0, 0], stride: 1,
  });
});

test('sprite previews are bounded and omit the after image at a game boundary', async () => {
  const rows = Array.from({ length: 64 }, () => Array(64).fill(2));
  const before = await measure(rows, 1);
  const after = await measure(rows, 2, 2);
  const receipt = projectNativeClickReturn(command, before, after, rows, rows);
  assert.equal(receipt?.preview?.stride, 4);
  assert.equal(receipt?.preview?.before.length, 16);
  assert.equal(receipt?.preview?.before[0]?.length, 16);
  assert.equal(receipt?.preview?.after, null);
});

test('the above-color contrast excludes changes to other measured conditions', async () => {
  const before = await measure(beforeRows, 1);
  const recolored = beforeRows.map(row => row.map(pixel => pixel === 2 ? 3 : pixel));
  const first = projectNativeClickReturn(command, before, await measure(recolored, 2), recolored, beforeRows);
  assert.ok(first?.beforeContext);
  const context = first.beforeContext;
  const alternative = {
    ...first, sequence: 2, sameSupport: false,
    beforeContext: { ...context, neighborhood: { ...context.neighborhood, above: [4] } },
  };
  const confounded = {
    ...alternative, sequence: 3,
    beforeContext: { ...context, neighborhood: { ...alternative.beforeContext.neighborhood, right: [7] } },
  };
  const group = compareClickReturns([first, alternative, confounded], 0).comparisons[0]!;
  assert.deepEqual(compareAboveColors(group.effects), [{ left: first, right: alternative, recolorDiffers: true }]);
});

test('context contrasts require disjoint values for every observed outcome and complete samples', async () => {
  const before = await measure(beforeRows, 1);
  const recolored = beforeRows.map(row => row.map(pixel => pixel === 2 ? 3 : pixel));
  const first = projectNativeClickReturn(command, before, await measure(recolored, 2), recolored, beforeRows);
  assert.ok(first?.beforeContext);
  const second = {
    ...first, sequence: 2, sameSupport: false,
    beforeContext: { ...first.beforeContext, matchingRegions: 2 },
  };
  const distinct = compareClickReturns([first, second], 0).comparisons[0]!;
  assert.deepEqual(contrastClickContexts(distinct.effects), {
    differences: [{ label: 'Matching regions', values: [['1'], ['2']], separates: true }], missing: 0,
  });
  const overlap = compareClickReturns([first, second, { ...second, sequence: 3, beforeContext: first.beforeContext }], 0).comparisons[0]!;
  assert.equal(contrastClickContexts(overlap.effects).differences[0]?.separates, false);
  const missing = compareClickReturns([first, second, { ...second, sequence: 3, beforeContext: undefined }], 0).comparisons[0]!;
  assert.equal(contrastClickContexts(missing.effects).differences[0]?.separates, false);
  assert.equal(contrastClickContexts(missing.effects).missing, 1);
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
    clickReturns: [receipt, { ...receipt, sequence: 2 }, { ...receipt, beforeRef: 'other-session' }],
    omittedClickReturns: 1,
  } as const;
  const view = readControlEffectShadow(board, agent, 2);
  assert.deepEqual(view?.clickReturn, receipt);
  assert.equal(view?.clickReturn?.changedTargetPixels, 0);
  assert.equal(view?.clickEvidence?.comparisons[0]?.count, 1);
  assert.equal(view?.clickEvidence?.omitted, 1);
  assert.equal(view?.resolution.outcome, 'needs_evidence');
  assert.equal(view?.frame.traits.effectIsolatable, undefined);
  assert.equal(readControlEffectShadow(board, { ...agent, sequence: 2 }, 3)?.clickReturn, null);
  assert.equal(readControlEffectShadow(board, { ...agent, sessionId: 'replacement' }, 2)?.clickReturn, null);
  assert.equal(readControlEffectShadow(board, { ...agent, sessionId: 'replacement' }, 2)?.clickEvidence, null);
  assert.equal(readControlEffectShadow(board, { ...agent, trace: [] }, 2)?.clickReturn, null);
  assert.equal(readControlEffectShadow(board, {
    ...agent, lastClickReturn: { ...receipt, beforeRef: 'wrong-source' },
  }, 2)?.clickReturn, null);
});

test('SIC compares exact visible starting conditions, separates outcomes, and excludes boundaries', async () => {
  const before = await measure(beforeRows, 1);
  const recoloredRows = beforeRows.map(row => row.map(pixel => pixel === 2 ? 3 : pixel));
  const after = await measure(recoloredRows, 2);
  const first = projectNativeClickReturn(command, before, after, recoloredRows);
  assert.ok(first?.target);
  const shifted = {
    ...first, sequence: 3, fromLevel: 2, toLevel: 2, point: [2, 2] as const,
    target: { ...first.target, box: [2, 2, 3, 3] as const },
  };
  const repeated = compareClickReturns([first, shifted, shifted], 4);
  assert.equal(repeated.comparisons[0]?.status, 'repeated');
  assert.deepEqual(repeated.comparisons[0]?.effects, [
    { kind: 'recolor', afterPalette: 3, count: 2, levels: [1, 2], returns: [first, shifted] },
  ]);
  assert.deepEqual(repeated.returns, [first, shifted]);
  assert.equal(repeated.omitted, 4);

  const comparison = compareClickReturns([
    first,
    shifted,
    { ...first, sequence: 4, sameSupport: false, changedTargetPixels: 0 },
    { ...first, sequence: 5, point: [2, 1] },
    { ...first, sequence: 6, target: { ...first.target, signature: 'different-shape' } },
    { ...first, sequence: 7, boundary: true },
    { ...first, sequence: 8, target: null },
  ], 0);
  assert.equal(comparison.comparisons[0]?.status, 'varied');
  assert.deepEqual(comparison.comparisons[0]?.effects.map(effect => effect.kind), ['recolor', 'unchanged']);
  assert.deepEqual(comparison.comparisons[0]?.effects.map(effect => effect.returns.map(receipt => receipt.sequence)), [[1, 3], [4]]);
  assert.deepEqual(comparison.comparisons.slice(1).map(group => group.status), ['single', 'single']);
  assert.equal(comparison.boundaries, 1);
  assert.equal(comparison.unidentified, 1);
  assert.deepEqual(comparison.returns.map(receipt => receipt.sequence), [1, 3, 4, 5, 6, 7, 8]);
});

test('different destination colors are different outcomes and unmatched changes stay unresolved', async () => {
  const before = await measure(beforeRows, 1);
  const recoloredRows = beforeRows.map(row => row.map(pixel => pixel === 2 ? 3 : pixel));
  const first = projectNativeClickReturn(command, before, await measure(recoloredRows, 2), recoloredRows);
  assert.ok(first?.atPointAfter);
  const changed = { ...first, sequence: 2, atPointAfter: { ...first.atPointAfter, palette: 4 } };
  assert.equal(compareClickReturns([first, changed], 0).comparisons[0]?.status, 'varied');
  const unresolved = { ...first, sameSupport: false };
  assert.equal(compareClickReturns([unresolved, { ...unresolved, sequence: 2 }], 0).comparisons[0]?.status, 'unresolved');
});
