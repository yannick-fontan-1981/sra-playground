import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const engine = process.env.SIC_VC33_ENGINE_ROOT;
const moduleUrl = (path: string) => engine ? pathToFileURL(resolve(engine, path)).href : new URL('../' + path, import.meta.url).href;
const { BandTransfer }: typeof import('../src/logos-engine/v6-band-transfer.ts') = await import(moduleUrl('src/logos-engine/v6-band-transfer.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleUrl('src/logos-engine/v6-native-runtime.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleUrl('src/runtime/v6-agent-protocol.ts'));
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleUrl('src/runtime/v6-agent-service.ts'));

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-vc33-line3.json.gz', import.meta.url))).toString());
const nominal: V6PublicObservation[] = fixture.observations;
const alternatives: V6PublicObservation[] = fixture.alternativeReturns;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';

async function start(live = false) {
  const backend = live && process.env.SIC_VC33_GAME_ROOT ? await sourceBackend(process.env.SIC_VC33_GAME_ROOT) : null;
  function observe(request: object, expected: V6PublicObservation, turn: number) {
    if (!backend) return expected;
    const observation = toV6PublicObservation(backend.dispatch(request), turn);
    assert.deepEqual(observation, expected, 'VC33 public return ' + turn);
    return observation;
  }
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime);
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'VC33', level: 1 }, nominal[0]!, 0),
    budgets: { targetLevels: 7, levelActionCaps: Array(7).fill(600), maxActions: 16 } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      const trace = reply.snapshot.trace as Record<string, any>[];
      return { kind: reply.kind, family: reply.snapshot.lastDecision, command: reply.command, proposal: reply.snapshot.proposal as Record<string, any>,
        plan: trace.findLast(e => e.kind === 'sic_native_plan'), guard: trace.findLast(e => e.kind === 'before_guard') };
    },
    async advance(expected: V6PublicObservation) {
      assert.equal(reply.kind, 'action');
      const command = reply.command!;
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket!.id, executionMs: 0,
        observation: observe({ type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data }, expected, sequence) });
      return (reply.snapshot.trace as Record<string, any>[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

test('VC33 releases the 16 catalogue steps and records the physical response at the scoped band vector', async t => {
  const record = t.mock.method(BandTransfer.prototype, 'record');
  const game = await start(true), expectedAcquisitions: unknown[] = [];
  for (let turn = 1; turn <= 16; turn++) {
    const next = await game.decision(), saved = fixture.historical[turn - 1], p = next.proposal;
    const step = p.steps[saved.index];
    assert.deepEqual([next.kind, next.family, p.material_access_subquestion, p.kind],
      ['action', 'band_transfer', 'conserved_band_transfer', 'aligned_band_transfers']);
    assert.deepEqual([next.plan?.id, next.guard?.admitted, next.guard?.reason, next.guard?.index],
      [saved.plan, true, 'bind_current_band_lengths_and_local_actuator', saved.index]);
    assert.deepEqual([next.command?.actionRef, next.command?.data, step.control_index, step.quantities, step.expected_after],
      ['ACTION6', saved.point, saved.control, saved.before, saved.expected]);
    if (turn === 1 || turn === 6 || turn === 13) {
      const plan = p.band_plan;
      const geometry = turn === 1 ? [0, 4, [[1, 24]]] : turn === 6 ? [0, 4, [[2, 28]]] : [1, 2, [[0, 16], [3, 18], [4, 10]]];
      assert.deepEqual([plan.alignment_axis, plan.quantum, plan.constrained_lengths], geometry);
    }
    if (turn === 2) assert.ok(p.route_refs.includes(record.mock.calls[0]!.result!.ref));
    const outcome = await game.advance(nominal[turn]!);
    assert.deepEqual([outcome.matched, outcome.reason], [saved.matched, saved.reason]);
    expectedAcquisitions.push([outcome.observation_ref, saved.before, saved.control]);
  }
  // The service acquires a multi-step prefix at seal, after witnessing each return.
  const acquired = record.mock.calls.map(call => call.result!);
  assert.deepEqual(acquired.map(event => [event.ref, event.before, event.control]), expectedAcquisitions);
  assert.deepEqual([acquired[0]!.after, acquired[0]!.signed_relation], [[36, 8], 'into_clicked']);
  assert.deepEqual([acquired[4]!.status, acquired[11]!.status], ['official_boundary', 'official_boundary']);
});

test('VC33 consumes a different eligible probe and continues from its own physical return', async t => {
  const choose = t.mock.method(BandTransfer.prototype, 'selectProbe', (eligible: readonly number[]) => {
    assert.deepEqual(eligible, [0, 1]);
    return eligible[1];
  });
  const game = await start(true), first = await game.decision();
  assert.deepEqual([first.family, first.command?.data, first.proposal.steps[0].expected_after], ['band_transfer', { x: 61, y: 33 }, null]);
  const result = await game.advance(alternatives[0]!), second = await game.decision();
  assert.equal(result.matched, null);
  assert.ok(second.proposal.route_refs.includes(result.observation_ref));
  assert.deepEqual([second.family, second.proposal.band_plan.signed_relation, second.proposal.steps[0].quantities,
    second.command?.data, second.proposal.steps[0].expected_after], ['band_transfer', 'into_clicked', [28, 16], { x: 61, y: 33 }, [24, 20]]);
  assert.equal((await game.advance(alternatives[1]!)).matched, true);
  const third = await game.decision();
  assert.deepEqual([third.family, third.command?.data, third.guard?.index], ['band_transfer', { x: 61, y: 33 }, 1]);
  assert.equal(choose.mock.callCount(), 1);
});

for (const offered of [undefined, 2]) {
  test('VC33 at T1 declines a probe that is ' + (offered === undefined ? 'withdrawn' : 'outside the measured controls'), async t => {
    t.mock.method(BandTransfer.prototype, 'selectProbe', (eligible: readonly number[]) => {
      assert.deepEqual(eligible, [0, 1]); return offered;
    });
    const game = await start(), ticket = await game.decision();
    assert.deepEqual([ticket.kind, ticket.family, ticket.proposal.kind, ticket.command?.data],
      ['action', 'observed_frontier', 'experiment', { x: 21, y: 36 }]);
  });
}

test('the same second actuator remains a probe after a stationary return', async () => {
  const game = await start(), first = await game.decision();
  assert.deepEqual(first.command?.data, { x: 61, y: 25 });
  const initial = nominal[0]!, stationary = { ...nominal[1]!, frame: initial.frame, frames: [initial.frame] };
  await game.advance(stationary);
  const second = await game.decision();
  assert.deepEqual([second.family, second.command?.data, second.proposal.band_plan.signed_relation, second.proposal.steps[0].expected_after],
    ['band_transfer', { x: 61, y: 33 }, null, null]);
});

test('the measured direction cannot authorize alignment after the fixed marker disappears', async t => {
  const propose = t.mock.method(BandTransfer.prototype, 'propose');
  const game = await start(), first = await game.decision();
  const [left, top, right, bottom] = first.proposal.band_plan.participants[0].reference;
  const packet = nominal[1]!;
  function removeMarker(frame: V6PublicObservation['frame']) {
    return frame.map((row, y) => {
      if (y < top || y > bottom) return row;
      assert.notEqual(row[left - 1], 11);
      return row.map((pixel, x) => x >= left && x <= right ? row[left - 1]! : pixel);
    });
  }
  await game.advance({ ...packet, frame: removeMarker(packet.frame), frames: packet.frames.map(removeMarker) });
  const second = await game.decision(), attempt = propose.mock.calls.at(-1)!;
  assert.equal(attempt.this.sense, 'into_clicked');
  assert.equal(await attempt.result, null);
  assert.deepEqual([second.kind, second.family, second.proposal.kind, second.command?.data],
    ['action', 'observed_frontier', 'experiment', { x: 61, y: 25 }]);
});
