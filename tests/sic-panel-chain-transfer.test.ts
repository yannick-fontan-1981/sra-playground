import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { measurePanelService } from '../src/logos-engine/v6-panel-service-observation.ts';
import { createSicVerifyPanelConfiguration, continuePanelChainGroup } from '../src/sic/panel-matching.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { NativeRows } from '../src/logos-engine/v6-native-types.ts';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const captured = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-panel-transport-public.json.gz', import.meta.url))).toString());
const initial = measurePanelService(captured.steps[0].before.frame)!;
const columns = [...new Set<number>(initial.panels.flatMap((panel: any) => panel.cells.map((cell: any) => cell.point[0])))];
const rowOffsets = [...new Set<number>(initial.panels.flatMap((panel: any) => panel.cells.map((cell: any) => cell.point[1] - panel.bbox[1])))];
const plus = new Set(['1,0', '0,1', '1,1', '2,1', '1,2']), elbow = new Set(['0,0', '0,1', '0,2', '1,2', '2,2']);

// The second public scenario changes every pigment, shifts the interface, and
// gives the acquired transport glyph a different shape. No production rule uses
// either drawing; both are acquired from the actual returned panel transfers.
function raster(rows: NativeRows, varied: boolean): number[][] {
  if (!varied) return rows.map(row => [...row]);
  const copied = rows.map(row => [...row]);
  for (const panel of initial.panels) for (const x of columns) for (const dy of rowOffsets) {
    const y = panel.bbox[1] + dy, ink = rows[y]![x]!, background = rows[y - 1]![x - 1]!;
    const isTransport = ink !== background && [...Array(3).keys()].every(cy => [...Array(3).keys()].every(cx =>
      rows[y - 1 + cy]![x - 1 + cx] === (plus.has(cx + ',' + cy) ? ink : background)));
    if (isTransport) for (let cy = 0; cy < 3; cy++) for (let cx = 0; cx < 3; cx++) {
      copied[y - 1 + cy]![x - 1 + cx] = elbow.has(cx + ',' + cy) ? ink : background;
    }
  }
  const result = Array.from({ length: 64 }, () => Array<number>(64).fill((rows[0]![0]! * 5 + 3) % 16));
  for (let y = 0; y < 63; y++) for (let x = 1; x < 64; x++) result[y + 1]![x - 1] = (copied[y]![x]! * 5 + 3) % 16;
  return result;
}

type Mutation = 'none' | 'ambiguous_panels' | 'missing_application';
function packet(board: any, stepIndex: number, varied: boolean, mutation: Mutation = 'none'): V6PublicObservation {
  const frame = raster(board.frame, varied);
  if (board.level === 4 && mutation === 'ambiguous_panels') {
    for (const row of frame) row.fill(frame[0]![0]!, 0, initial.panels[0]!.bbox[0] - 1);
    for (const panel of initial.panels) {
      const [l, top, r, bottom] = panel.bbox;
      for (let y = top; y <= bottom; y++) for (let x = l; x <= r; x++) frame[y]![x - l] = board.frame[y][x];
    }
  }
  return { frame, frames: [frame], level: board.level, levelsCompleted: board.levelsCompleted, state: board.state,
    availableActionIds: board.level === 4 && mutation === 'missing_application' ? [6] : board.availableActionIds, stepIndex };
}

async function start(varied: boolean, mutation: Mutation = 'none') {
  const family = createSicVerifyPanelConfiguration(), prepared = createPreparedEffects(undefined, defaultRecoveryPack);
  const calls: { level: number; group: string; proposed: boolean }[] = [];
  const propose = family.proposeInGroup!.bind(family);
  family.proposeInGroup = async (group, observation, ...args) => {
    const proposal = await propose(group, observation, ...args);
    calls.push({ level: observation.level_epoch, group, proposed: proposal !== null });
    return proposal;
  };
  const groups = planningGroupsWithExperiments(standalonePlanningGroups).map(group => {
    const entries = group.families.flatMap((id, index) => [family.id, prepared.id].includes(id)
      ? [{ id, entry: group.entryPoints?.[index] ?? null }] : []);
    return { ...group, families: entries.map(item => item.id), entryPoints: entries.map(item => item.entry) };
  }).filter(group => group.families.length);
  const runtime = new NativeV6Runtime({ families: [family, prepared], groups, sourceDigest: 'panel-chain-transfer', maxPointOccurrences: 100 });
  const service = new V6AgentService(() => runtime), sessionId = 'panel-chain-' + varied + '-' + mutation;
  const sealedRevisions = new Set<number>();
  const collectSeal = (snapshot: { trace: readonly unknown[] }) => {
    const seal = (snapshot.trace as readonly Record<string, unknown>[]).findLast(event => event.kind === 'sealed_prefix');
    assert.equal(seal?.family, family.id);
    assert.equal(seal?.acquired_actions, 1);
    assert.equal(typeof seal?.revision, 'number');
    assert.ok(!sealedRevisions.has(seal!.revision as number));
    sealedRevisions.add(seal!.revision as number);
  };
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence,
    observation: packet(captured.steps[0].before, 0, varied), budgets: { targetLevels: 5, levelActionCaps: [30, 30, 30, 30, 30] } });
  for (const step of captured.steps.slice(0, 19)) {
    assert.ok(result.ticket, JSON.stringify({ reason: result.reason, phase: result.snapshot.proposal?.kind, sequence }));
    assert.equal(result.snapshot.proposal?.kind, family.id);
    assert.equal(result.ticket.actionRef, 'ACTION' + step.command.id, 'Public acquisition command ' + (sequence + 1));
    if (step.command.data) assert.deepEqual(result.ticket.data,
      { x: step.command.data.x - Number(varied), y: step.command.data.y + Number(varied) });
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: result.ticket.id,
      executionMs: 1, observation: packet(step.after, sequence, varied, mutation) });
    assert.equal(result.kind, 'boundary');
    collectSeal(result.snapshot);
    result = await service.handle({ type: 'resume', sessionId, sequence });
  }
  async function advance(rows: NativeRows) {
    assert.ok(result.ticket);
    const next = packet(captured.steps[19].before, sequence + 1, varied);
    next.frame = rows; next.frames = [rows];
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: result.ticket.id,
      executionMs: 1, observation: next });
    collectSeal(result.snapshot);
    return result;
  }
  return { family, runtime, calls, advance, sealedRevisions, get result() { return result; } };
}

for (const varied of [false, true]) test('native panel chain reuses the acquired material transport before independent previews' + (varied ? ' with different glyphs, pigments, placement and clicks' : ''), async () => {
  const run = await start(varied);
  try {
    assert.ok(run.calls.filter(call => call.level <= 3 && call.group === continuePanelChainGroup).every(call => !call.proposed));
    assert.equal(run.result.snapshot.levelsCompleted, 3);
    assert.equal(run.result.snapshot.actions, 19);
    assert.equal(run.result.ticket?.actionRef, 'ACTION6');
    assert.deepEqual(run.result.ticket?.data, { x: 45 - Number(varied), y: 17 + Number(varied) });
    assert.equal(run.calls.at(-1)?.group, continuePanelChainGroup);
    const proof = structuredClone(run.family.state!().retained);
    assert.equal(proof.completed, 3);
    assert.equal(proof.transportProof.length, 2);
    assert.ok(proof.transportProof.every((ref: string) => ref.includes(':epoch:3:')));
    assert.ok(run.result.snapshot.proposal?.route_refs.every((ref: string) => typeof ref === 'string'));
    assert.ok(proof.transportProof.every((ref: string) => run.result.snapshot.proposal?.route_refs.includes(ref)));
    assert.ok(run.result.ticket?.graphChain && run.result.ticket.nativeExecutionDigest);
    if (varied) assert.deepEqual(proof.transport, [...elbow].map(pair => pair.split(',').map(Number)).sort((a, b) => a[1]! - b[1]! || a[0]! - b[0]!));
    // The captured click after three idle previews addresses the same measured
    // panels. Its public selected-outline return supplies this functional test;
    // the real first-click replay is qualified separately by the standard runner.
    const returned = await run.advance(raster(captured.steps[22].after.frame, varied));
    assert.equal(returned.kind, 'boundary');
    assert.equal(returned.snapshot.actions, 20);
    assert.ok(returned.snapshot.trace.some(event => event.kind === 'actual_outcome' && event.family === run.family.id
      && event.matched === true && event.reason === 'panel_chain_selection_observed'));
    assert.equal(run.sealedRevisions.size, 20);
    assert.deepEqual(run.family.state!().retained, proof);
  } finally { run.runtime.close('test_complete'); }
});

for (const mutation of ['ambiguous_panels', 'missing_application'] as const) test('native panel transfer refuses ' + mutation + ' and preserves the earlier effect', async () => {
  const run = await start(false, mutation);
  try {
    assert.ok(run.calls.some(call => call.level === 4 && call.group === continuePanelChainGroup && !call.proposed));
    assert.ok(!run.calls.some(call => call.level === 4 && call.group === continuePanelChainGroup && call.proposed));
    assert.equal(run.family.state!().retained.transportProof.length, 2);
  } finally { run.runtime.close('test_complete'); }
});

test('a contradictory transferred panel selection closes its ticket and preserves the prior transport proof', async () => {
  const run = await start(false), proof = structuredClone(run.family.state!().retained);
  try {
    const returned = await run.advance(raster(captured.steps[19].before.frame, false));
    assert.equal(returned.kind, 'boundary');
    assert.equal(returned.ticket, null);
    assert.ok(returned.snapshot.trace.some(event => event.kind === 'actual_outcome' && event.family === run.family.id
      && event.matched === false && event.reason === 'panel_chain_prediction_contradicted'));
    assert.equal(run.family.state!().state.stopped, true);
    assert.deepEqual(run.family.state!().retained, proof);
  } finally { run.runtime.close('test_complete'); }
});

test('an unproved or foreign transport cannot acquire priority through retained glyphs alone', async () => {
  const run = await start(false), learned = structuredClone(run.family.state!());
  try {
    const observation = (run.runtime as any).observation, rows = captured.steps[19].before.frame;
    for (const transportProof of [undefined, [], ['one', 'one'], ['foreign:epoch:3:revision:1', 'foreign:epoch:3:revision:2']]) {
      run.family.restore!({ ...learned, retained: { ...learned.retained, transportProof } });
      assert.equal(await run.family.proposeInGroup!(continuePanelChainGroup, observation, rows, [], 30), null);
    }
    run.family.restore!(learned);
    assert.ok(await run.family.proposeInGroup!(continuePanelChainGroup, observation, rows, [], 30));
  } finally { run.runtime.close('test_complete'); }
});
