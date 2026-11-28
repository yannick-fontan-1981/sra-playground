import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_LIFE_ENGINE_ROOT;
const sourceModule = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { AnimatedContactAccess, animatedCrossInvitation }: typeof import('../src/logos-engine/v6-animated-contact.ts') =
  await import(sourceModule('src/logos-engine/v6-animated-contact.ts'));
const { TypedMaterialMemory }: typeof import('../src/logos-engine/v6-typed-material-access.ts') =
  await import(sourceModule('src/logos-engine/v6-typed-material-access.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') =
  await import(sourceModule('src/logos-engine/v6-native-runtime.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(sourceModule('src/runtime/v6-agent-protocol.ts'));
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(sourceModule('src/runtime/v6-agent-service.ts'));
type Row = Record<string, any>;
const readGzip = (path: string) => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString());
const archive = readGzip('../docs/migration/native-campaigns-v50/life-public-trace-final.json.gz').packets;
const alternatives = readGzip('./fixtures/sic-life-alternate-returns.json.gz');
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const carrier = 'typed_carrier_experiment', flow = 'typed_material_flow', animated = 'measured_animated_contact';
const recall = 'public_occurrence_recall';

function packet(sequence: number): V6PublicObservation {
  const p = archive[sequence].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, availableActionIds: p.available_action_refs.map((a: string) => Number(a.slice(6))),
    level: p.level, levelsCompleted: p.levels_completed, state: p.state, stepIndex: p.step_index };
}
async function start(live = false, initial?: V6PublicObservation) {
  const backend = live && process.env.SIC_LIFE_GAME_ROOT ? await sourceBackend(process.env.SIC_LIFE_GAME_ROOT) : null;
  function observe(request: object, expected: V6PublicObservation, sequence: number) {
    if (!backend) return expected;
    const result = toV6PublicObservation(backend.dispatch(request), sequence), { palette, ...fields } = result;
    assert.deepEqual(fields, expected, 'LIFE public return ' + sequence);
    return result;
  }
  const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), service = new V6AgentService(() => runtime);
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: initial ?? observe({ type: 'load', code: 'LIFE', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      const p = reply.snapshot.proposal as Row, trace = reply.snapshot.trace as Row[];
      return { family: reply.snapshot.lastDecision, kind: reply.kind, point: reply.command?.data, proposal: p, reason: reply.reason,
        guard: trace.findLast(e => e.kind === 'before_guard') };
    },
    async advance(expected = packet(sequence + 1)) {
      assert.equal(reply.kind, 'action');
      const command = reply.command!;
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket!.id, executionMs: 0,
        observation: observe({ type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data }, expected, sequence) });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
async function prefix(game: Awaited<ReturnType<typeof start>>, count: number) {
  for (let turn = 1; turn <= count; turn++) {
    assert.deepEqual((await game.decision()).point, archive[turn].command.data);
    await game.advance();
  }
}

test('LIFE attributes the 16 physical returns to the animated invitation, the carrier or the material flow', async t => {
  const animations = t.mock.method(AnimatedContactAccess.prototype, 'recordPacket');
  const records = t.mock.method(TypedMaterialMemory.prototype, 'record');
  const game = await start(true);
  let children: Row[] = [], selectedChild: string | undefined;
  const refByTurn = new Map<number, string>();
  for (let turn = 1; turn <= 16; turn++) {
    const ticket = await game.decision(), p = ticket.proposal;
    const mode = turn === 1 || turn === 16 ? animated : [2, 3, 4, 9, 10, 11].includes(turn) ? carrier : flow;
    assert.deepEqual([ticket.kind, ticket.family, p.kind, ticket.guard?.admitted, ticket.point],
      ['action', mode === animated ? 'animated_contact' : recall, mode, true, archive[turn].command.data]);
    if (mode !== animated) assert.equal(p.field_subquestion, flow);
    if (turn === 2) {
      assert.equal(p.typed_carrier_plan.contact_context, null);
      assert.deepEqual(p.route_refs, [refByTurn.get(1)]);
      assert.equal(p.typed_carrier_plan.scene.carriers.length, 4);
    }
    if (turn === 3 || turn === 4) assert.ok(p.typed_carrier_plan.contact_context.evidence.includes(refByTurn.get(turn - 1)));
    if (mode === flow) {
      const plan = p.material_flow_plan;
      assert.ok(children.some(c => c.id === plan.child.id && c.source_ref === plan.child.source_ref));
      assert.ok(p.route_refs.includes(plan.child.source_ref));
      if (plan.mode === 'select') selectedChild = plan.child.id;
      else assert.equal(plan.child.id, selectedChild);
    }
    const result = await game.advance();
    refByTurn.set(turn, result.observation_ref);
    assert.deepEqual([result.family, result.matched], [ticket.family, null]);
    if (mode === animated) {
      const e = animations.mock.calls.at(-1)!.result![0]!;
      assert.deepEqual([e.mode, e.packet_frames, e.evidence, e.model], ['invitation', 4, [p.binding.observation_ref, result.observation_ref], null]);
      assert.deepEqual(packet(turn).frame, packet(turn - 1).frame);
      assert.equal(result.reason, 'public_animation_requires_reconciliation');
    } else {
      const events = records.mock.calls.at(-1)!.result!, receipt = events.find(e => e.kind === (mode === carrier ? 'typed_carrier_response' : flow))!;
      assert.deepEqual(receipt.evidence, [p.binding.observation_ref, result.observation_ref]);
      if (turn === 2 || turn === 3) assert.deepEqual([receipt.changed_public_pixels.length, receipt.contact_context.kind],
        turn === 2 ? [29, 'local_marking'] : [232, 'produced_support']);
      if (turn === 4 || turn === 11) {
        const activated = events.find(e => e.effect === 'replacement_activated_into_typed_occurrences')!;
        children = activated.added_children;
        assert.equal(children.length, 2);
        assert.ok(children.every(c => c.source_ref === result.observation_ref));
      }
      if (mode === flow) {
        const expected = turn === 15 ? 'official_boundary_after_request' : p.material_flow_plan.mode === 'select'
          ? 'local_child_marking' : 'material_consumed_and_request_changed';
        assert.equal(receipt.effect, expected);
      }
    }
  }
});

test('2 abstains on two visible crosses and hands the unchanged carrier offer the first ticket', async t => {
  const propose = t.mock.method(AnimatedContactAccess.prototype, 'proposeGraph');
  const original = packet(0);
  function duplicate(frame: V6PublicObservation['frame']) {
    const rows = frame.map(row => [...row]);
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1]]) {
      assert.equal(rows[20 + dy]![9 + dx], 4);
      rows[20 + dy]![9 + dx] = frame[7]![24]!;
    }
    return rows;
  }
  const game = await start(false, { ...original, frame: duplicate(original.frame), frames: original.frames.map(duplicate) });
  const first = await game.decision();
  assert.equal(animatedCrossInvitation(propose.mock.calls[0]!.arguments[0]), null);
  assert.deepEqual([first.family, first.proposal.kind, first.point], [recall, carrier, { x: 6, y: 48 }]);
});

test('2 can withdraw its invitation while the service retains the real presentation for 68', async t => {
  const original = AnimatedContactAccess.prototype.proposeGraph;
  t.mock.method(AnimatedContactAccess.prototype, 'proposeGraph', function (this: AnimatedContactAccess, ...args: Parameters<typeof original>) {
    const [observation, rows, inputs, remaining, config] = args, received = animatedCrossInvitation(observation);
    assert.deepEqual(received?.point, { x: 24, y: 7 });
    const without = { ...observation, entities: observation.entities.filter((e: Row) => e.id !== received!.entity_ref) };
    return original.call(this, without, rows, inputs, remaining, config);
  });
  const first = await (await start()).decision();
  assert.deepEqual([first.family, first.proposal.kind, first.point], [recall, carrier, { x: 6, y: 48 }]);
});

test('2 repeats the invitation at T2 if only the animated acquisition is withheld', async t => {
  t.mock.method(AnimatedContactAccess.prototype, 'recordPacket', function (this: AnimatedContactAccess) {
    this.arc_pending = null;
    return [];
  });
  const game = await start(); await prefix(game, 1);
  const again = await game.decision();
  assert.deepEqual([again.family, again.proposal.kind, again.point], ['animated_contact', animated, { x: 24, y: 7 }]);
});

test('68 needs the local mark before it can select the matching partner', async t => {
  const records = t.mock.method(TypedMaterialMemory.prototype, 'record');
  const game = await start(); await prefix(game, 1);
  await game.decision();
  const prior = packet(1), stationary = { ...packet(2), frame: prior.frame, frames: [prior.frame] };
  await game.advance(stationary);
  const response = records.mock.calls.at(-1)!.result!.find(e => e.kind === 'typed_carrier_response')!;
  assert.deepEqual([response.changed_public_pixels.length, response.contact_context], [0, null]);
  const next = await game.decision();
  assert.deepEqual([next.kind, next.point], ['stopped', undefined]);
});

test('69 changes the selected descendant when the first request is already filled', async t => {
  const original = TypedMaterialMemory.prototype.flowQuestion;
  t.mock.method(TypedMaterialMemory.prototype, 'flowQuestion', function (this: TypedMaterialMemory, ...args: Parameters<typeof original>) {
    if (args[0].revision === 5) {
      const nominal = original.apply(this, args)!;
      assert.deepEqual(nominal.material_flow_plan.target.bbox, [20, 3, 28, 11]);
      if (!this.flowFilled.length) this.flowFilled.push(nominal.material_flow_plan.target.bbox);
    }
    return original.apply(this, args);
  });
  const game = await start(); await prefix(game, 4);
  const other = await game.decision();
  assert.deepEqual([other.proposal.kind, other.point, other.proposal.material_flow_plan.target.bbox],
    [flow, { x: 19, y: 21 }, [53, 3, 61, 11]]);
});

for (const turn of [2, 5]) {
  const points = turn === 2 ? [[6, 48], [23, 48], [41, 48], [58, 48]] : [[12, 21], [19, 21]];
  test('selectUnboundSubject substitutes a physical subject and follows it through two real returns at T' + turn, async t => {
    const inquire = TypedMaterialMemory.prototype.carrierQuestion, original = TypedMaterialMemory.prototype.selectUnboundSubject;
    let revision = 0, used = false;
    t.mock.method(TypedMaterialMemory.prototype, 'carrierQuestion', function (this: TypedMaterialMemory, ...args: Parameters<typeof inquire>) {
      revision = args[0].revision;
      return inquire.apply(this, args);
    });
    t.mock.method(TypedMaterialMemory.prototype, 'selectUnboundSubject', function (this: TypedMaterialMemory, ordered: readonly Row[]) {
      if (revision !== turn) return original.call(this, ordered);
      assert.deepEqual(ordered.map(c => c.point), points);
      used = true; return 1;
    });
    const game = await start(true); await prefix(game, turn - 1);
    const other = await game.decision();
    assert.ok(used);
    assert.deepEqual([other.proposal.kind, other.point], [turn === 2 ? carrier : flow, { x: points[1]![0], y: points[1]![1] }]);
    const actual = await game.advance(alternatives[turn][0]), bound = await game.decision();
    assert.equal(actual.family, recall);
    assert.deepEqual(bound.point, turn === 2 ? { x: 58, y: 48 } : { x: 56, y: 7 });
    if (turn === 2) assert.deepEqual(bound.proposal.typed_carrier_plan.contact_context.selected.point, points[1]);
    else assert.equal(bound.proposal.material_flow_plan.child.id, other.proposal.material_flow_plan.child.id);
    await game.advance(alternatives[turn][1]);
    const next = await game.decision();
    assert.deepEqual(next.point, turn === 2 ? { x: 48, y: 34 } : { x: 12, y: 21 });
  });
  test('selectUnboundSubject can withdraw all eligible subjects at T' + turn, async t => {
    const game = await start(); await prefix(game, turn - 1);
    t.mock.method(TypedMaterialMemory.prototype, 'selectUnboundSubject', () => null);
    const ticket = await game.decision();
    assert.deepEqual([ticket.kind, ticket.point], ['stopped', undefined]);
  });
}
