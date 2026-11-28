import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_HANO_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { OrderedSupportTransfer, measureOrderedSupportScene, orderedSupportSelectionMatches, materializeOrderedSupportTransferWitnesses, declaredSupportOrders }:
  typeof import('../src/logos-engine/v6-ordered-support.ts') = await import(moduleURL('src/logos-engine/v6-ordered-support.ts'));
type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-hano-public-returns.json.gz', import.meta.url))).toString());
const packet = (n: number): V6PublicObservation => fixture.nominal.observations[n];
const sessionId = 'sra-v6-' + fixture.session;
const transfers = 'ordered_support_transfer', framed = 'public_framed_transfer';
async function start(limit: number, live = false) {
  const backend = live && process.env.SIC_HANO_GAME_ROOT ? await sourceBackend(process.env.SIC_HANO_GAME_ROOT) : null;
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const { palette, ...actual } = toV6PublicObservation(backend.dispatch(request), n);
    assert.deepEqual(actual, expected, 'official HANO return ' + n);
    return { ...actual, palette };
  }
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'HANO', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: limit } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')!;
      assert.equal(guard.admitted, true);
      return { p, guard, owner: reply.snapshot.lastDecision, command: reply.command! };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1)) {
      const command = reply.command!;
      const observation = observe({ type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data }, expected, ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
test('25 first selection and deposit bind the measured layer, then the same transfer operator serves changed piles and a four-support level', async t => {
  const record = t.mock.method(OrderedSupportTransfer.prototype, 'record'), game = await start(19, true);
  const refs = new Map<number, string>(), states = new Map<number, Row>();
  const witnesses = [1, 3, 7];
  for (let n = 1; n <= 19; n++) {
    const d = await game.decision(), plan = d.p.support_plan, expected = fixture.nominal.commands[n - 1];
    assert.deepEqual([d.command.actionRef, d.command.data], ['ACTION' + expected.id, expected.data]);
    if (n <= 16) {
      assert.deepEqual([d.owner, d.p.kind, d.p.material_access_subquestion, d.guard.index, d.guard.reason],
        [transfers, 'conditional_ordered_support_transfer', transfers, (n - 1) % 2, 'current_ordered_support_scope_and_intermediate_selection']);
      if (n % 2 === 1) {
        const scene = await measureOrderedSupportScene(packet(n - 1).frame);
        assert.deepEqual(scene, plan.scene);
        assert.deepEqual(d.p.steps[0].expected_after, { selection: 'unknown_until_current_comparison' });
        if (n === 3) assert.ok(d.p.question.hypothesis_refs.includes(refs.get(2)));
        if (witnesses.includes(n)) {
          const cfg = declarations.common.ordered_support_transfer, result = materializeOrderedSupportTransferWitnesses({
            configuration: { support_extents: scene!.configuration }, endpoint_support_index: scene!.target,
            traversal_orders: declaredSupportOrders(scene!.configuration.length, scene!.target, cfg.traversal_orders),
            maximum_state_expansions: cfg.maximum_state_expansions, maximum_transfer_depth: cfg.maximum_transfer_depth,
          });
          const w = result.witnesses[0]!.steps[0]!;
          assert.deepEqual([plan.source, plan.destination, plan.member.bbox[2] - plan.member.bbox[0] + 1],
            [w.source_support_index, w.destination_support_index, w.extent]);
          states.set(n, { configuration: scene!.configuration, source: plan.source, destination: plan.destination, extent: w.extent });
        }
      } else {
        assert.equal(orderedSupportSelectionMatches(packet(n - 2).frame, packet(n - 1).frame, plan), true);
      }
    }
    const mark = record.mock.callCount(), out = await game.advance();
    refs.set(n, out.observation_ref);
    if (n <= 16) {
      const boundary = n === 6 || n === 16;
      assert.deepEqual([out.matched, out.reason], boundary ? [null, 'official_boundary'] : n % 2 ? [true, 'observed_selection_only'] :
        [true, 'compare_conditional_transfer_not_universal_law']);
      if (n % 2 === 0) {
        const events = (await Promise.all(record.mock.calls.slice(mark).map(call => call.result!))).flatMap(r => r.events) as Row[];
        const selected = events.find(e => e.after === refs.get(n - 1)), deposit = events.find(e => e.after === out.observation_ref);
        assert.deepEqual([selected!.before, selected!.selection_observed, selected!.transfer_observed, selected!.parent],
          [refs.get(n - 2) ?? d.p.binding.observation_ref, true, false, 'G_official_completion']);
        assert.deepEqual([deposit!.before, deposit!.transfer_observed, deposit!.official_progress, deposit!.parent],
          [refs.get(n - 1), !boundary, boundary, 'G_official_completion']);
        if (!boundary) assert.deepEqual((await measureOrderedSupportScene(packet(n).frame))!.configuration, plan.expected_configuration);
      }
    }
    if (n === 17) assert.equal(d.owner, framed);
  }
  assert.deepEqual([...states.values()], [
    { configuration: [[11, 7], [], []], source: 0, destination: 1, extent: 7 },
    { configuration: [[11], [7], []], source: 0, destination: 2, extent: 11 },
    { configuration: [[15, 11, 7], [], [], []], source: 0, destination: 1, extent: 7 },
  ]);
});

test('25 at the same first ticket a return without the member mark seals the prefix before the deposit', async t => {
  const record = t.mock.method(OrderedSupportTransfer.prototype, 'record'), game = await start(19);
  const d = await game.decision();
  assert.deepEqual([d.owner, d.command.data], [transfers, { x: 13, y: 51 }]);
  assert.equal(orderedSupportSelectionMatches(packet(0).frame, packet(1).frame, d.p.support_plan), true);
  assert.equal(orderedSupportSelectionMatches(packet(0).frame, packet(3).frame, d.p.support_plan), false);
  const first = packet(0).frame, out = await game.advance({ ...packet(1), frame: first, frames: [first] });
  assert.deepEqual([out.matched, out.reason, out.seal_prefix], [false, 'observed_selection_only', true]);
  const call = record.mock.calls.at(-1)!;
  const [event] = (await call.result!).events as Row[];
  assert.deepEqual([event!.after, event!.selection_observed, event!.transfer_observed, call.this.state().closed],
    [out.observation_ref, false, false, [d.p.support_plan.context_key]]);
  const next = await game.decision();
  assert.notEqual(next.owner, transfers);
  assert.notDeepEqual(next.command.data, { x: 31, y: 51 });
});

test('25 withdrawing the initial support offer releases the real framing probes and then reuses the ordered transfer', async t => {
  const propose = OrderedSupportTransfer.prototype.propose;
  const observed: Row[] = [];
  t.mock.method(OrderedSupportTransfer.prototype, 'propose', async function (this: OrderedSupportTransfer, ...args: Parameters<typeof propose>) {
    const original = await propose.apply(this, args);
    if (!original || args[0].revision !== 1) return original;
    observed.push(original);
    const alternative = new OrderedSupportTransfer({ ...this.policy, enabled: false });
    alternative.restore(this.state());
    return propose.apply(alternative, args);
  });
  const game = await start(8, true);
  const checks = [framed, framed, transfers, transfers];
  for (const [i, owner] of checks.entries()) {
    const d = await game.decision();
    assert.deepEqual([d.owner, d.command.data], [owner, fixture.withdrawal.commands[i].data]);
    if (i === 2) assert.deepEqual([d.p.support_plan.scene.configuration, d.p.support_plan.source, d.p.support_plan.destination],
      [[[11, 7], [], []], 0, 1]);
    const out = await game.advance(fixture.withdrawal.observations[i]);
    if (i === 3) assert.equal(out.matched, true);
  }
  assert.ok(observed.length > 0);
  assert.deepEqual((await game.decision()).p.support_plan.scene.configuration, [[11], [7], []]);
});
