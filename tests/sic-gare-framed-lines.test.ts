import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { FramedTransfer } from '../src/logos-engine/v6-framed-transfer.ts';
import { candidates } from '../src/logos-engine/v6-framed-transfer-observation.ts';
import { FramedPolicy } from '../src/logos-engine/v6-framed-transfer-policy.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { toV6PublicObservation, v6FrameHash, type V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';

type Row = Record<string, any>;
const readGzip = (path: string) => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString());
const archive = readGzip('../docs/migration/native-campaigns-v52/final/gare-public-trace.json.gz').packets;
const alternatives = readGzip('./fixtures/sic-gare-alternate-returns.json.gz');
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const transfer = 'observed_framed_transfer', analogy = 'observed_framed_analogy';
const owner = 'public_framed_transfer', interfaceQuestion = 'projection.exploration.parallel_solid_band_interface_question';
const homolog = 'projection.current_observed_entry_analogy', uniform = 'projection.exploration.current_uniform_frame_dependency';
const motion = 'policy.record_observed_point_motion_span', replacement = 'policy.record_observed_framed_replacement';

function packet(sequence: number): V6PublicObservation {
  const p = archive[sequence].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, availableActionIds: p.available_action_refs.map((a: string) => Number(a.slice(6))),
    level: p.level, levelsCompleted: p.levels_completed, state: p.state, stepIndex: p.step_index };
}
async function start(live = false, initial?: V6PublicObservation) {
  const backend = live && process.env.SIC_GARE_GAME_ROOT ? await sourceBackend(process.env.SIC_GARE_GAME_ROOT) : null;
  function observe(request: object, expected: V6PublicObservation, sequence: number) {
    if (!backend) return expected;
    const result = toV6PublicObservation(backend.dispatch(request), sequence), { palette, ...fields } = result;
    assert.deepEqual(fields, expected, 'GARE public return ' + sequence);
    return result;
  }
  const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), service = new V6AgentService(() => runtime);
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: initial ?? observe({ type: 'load', code: 'GARE', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      const p = reply.snapshot.proposal as Row, trace = reply.snapshot.trace as Row[];
      return { family: reply.snapshot.lastDecision, entry: p?.material_access_subquestion ?? p?.field_subquestion ?? p?.kind,
        point: reply.command?.data, kind: reply.kind, proposal: p, plan: p?.framed_transfer_plan, guard: trace.findLast(e => e.kind === 'before_guard') };
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
function alterFrames(p: V6PublicObservation, change: (rows: number[][]) => void): V6PublicObservation {
  const edit = (frame: V6PublicObservation['frame']) => { const rows = frame.map(row => [...row]); change(rows); return rows; };
  return { ...p, frame: edit(p.frame), frames: p.frames.map(edit) };
}

test('GARE historically releases seven material entries and nine analogy entries with separately measured returns', async t => {
  const record = t.mock.method(FramedTransfer.prototype, 'record');
  const game = await start(true), claims = new Set<string>();
  const materialTurns = [1, 2, 3, 8, 9, 10, 11];
  for (let n = 1; n <= 16; n++) {
    const d = await game.decision(), { offer, choice } = d.plan;
    assert.deepEqual([d.family, d.entry, d.point, d.guard?.admitted, d.proposal.steps[0].expected_after],
      [owner, materialTurns.includes(n) ? transfer : analogy, archive[n].command.data, true, null]);
    if (n === 1) {
      assert.equal(choice.projection_ref, interfaceQuestion);
      assert.deepEqual([offer.facts.parallel_solid_band_mutually_unique, offer.facts.parallel_solid_band_peer_count, choice.competing_current_offers], [true, 1, 3]);
    }
    if (n === 4 || n === 5 || n === 12) {
      assert.equal(choice.projection_ref, homolog);
      assert.deepEqual([offer.facts.framed_reception_locus_complete, offer.facts.framed_reception_locus_same_mask_marker], [true, true]);
      if (n === 4) {
        assert.equal(offer.facts.framed_reception_locus_expected_delta, -25);
        assert.equal(choice.projected.premise_claim_refs.length, 3);
        for (const ref of choice.projected.premise_claim_refs) assert.ok(claims.has(ref), ref);
      }
    }
    const result = await game.advance();
    assert.deepEqual([result.matched, result.reason], [null, 'reconcile_complete_point_transition_without_assumed_mechanics']);
    const measured = (await record.mock.calls.at(-1)!.result!).events[0] as Row;
    const fact = measured.source_result ?? measured;
    assert.deepEqual(fact.evidence, [d.proposal.binding.observation_ref, result.observation_ref]);
    const derived = fact.derived ?? [];
    for (const item of derived) claims.add(item.source_claim_ref);
    if (n === 1 || n === 4) {
      assert.equal(fact.scene_changed, true);
      assert.deepEqual(derived.map((item: Row) => item.derivation.policy), n === 1 ? [motion] : [motion, replacement]);
    }
  }
});

test('35 loses its original point when one of the two public support strips is removed', async () => {
  const changed = alterFrames(packet(0), rows => {
    for (let x = 2; x <= 6; x++) { assert.equal(rows[22]![x], 0); rows[22]![x] = rows[21]![x]!; }
  });
  const ticket = await (await start(false, changed)).decision();
  assert.deepEqual([ticket.entry, ticket.point, ticket.plan.choice.projection_ref, ticket.plan.choice.competing_current_offers],
    [transfer, { x: 44, y: 13 }, interfaceQuestion, 2]);
});

test('36 loses the homologue when one pixel of its public marker changes, also with the same retained history', async t => {
  const calls = t.mock.method(FramedTransfer.prototype, 'proposeInSubquestion');
  const game = await start();
  await prefix(game, 2);
  await game.decision();
  const changed = alterFrames(packet(3), rows => { rows[22]![18] = rows[22]![18] === 14 ? 5 : 14; });
  await game.advance(changed);
  const refused = await game.decision();
  assert.deepEqual([refused.family, refused.entry, refused.point], ['public_occurrence_recall', 'observed_occurrence_recall', { x: 13, y: 23 }]);
  const revised = await measureNativeObservation({ frame_rows: changed.frame, frame_hash: await v6FrameHash(changed.frame),
    level: changed.level, levels_completed: changed.levelsCompleted, state: changed.state,
    available_action_refs: changed.availableActionIds.map(id => 'ACTION' + id) }, 4);
  const nominal = await start();
  await prefix(nominal, 3);
  const accepted = await nominal.decision();
  const last = calls.mock.calls.at(-1)!.this;
  const options = await candidates(changed.frame, revised, last.policy, last.spans, last.receipts, last.attempts);
  assert.equal(accepted.plan.choice.projection_ref, homolog);
  assert.ok(options.every(o => o.facts.framed_reception_locus_marker_ref !== accepted.plan.offer.facts.framed_reception_locus_marker_ref
    || o.facts.framed_reception_locus_mask_digest !== accepted.plan.offer.facts.framed_reception_locus_mask_digest));
});

for (const [n, withheld, alternative, entry, successor] of [
  [1, [4, 23], [44, 13], transfer, [54, 13]],
  [4, [9, 13], [39, 13], 'field_service_composition', [9, 13]],
  [5, [34, 23], [59, 13], analogy, [44, 13]],
] as const) {
  test('GARE withdraws the selected offer and consumes the physical return of the substitute at T' + n, async t => {
    let revision = 0, masked = 0;
    const group = FramedTransfer.prototype.proposeInSubquestion, select = FramedPolicy.prototype.select;
    t.mock.method(FramedTransfer.prototype, 'proposeInSubquestion', function (this: FramedTransfer, ...args: Parameters<typeof group>) {
      revision = args[2].revision;
      return group.apply(this, args);
    });
    t.mock.method(FramedPolicy.prototype, 'select', function (this: FramedPolicy, rows: Parameters<typeof select>[0]) {
      if (revision !== n) return select.call(this, rows);
      // Keep indices stable for the real SRC receipt; withdraw only this point's eligibility facts.
      return select.call(this, rows.map(row => {
        if (row.point_x !== withheld[0] || row.point_y !== withheld[1]) return row;
        masked++;
        return { ...row, facts: {} };
      }));
    });
    const game = await start(true);
    await prefix(game, n - 1);
    const alt = await game.decision();
    assert.ok(masked > 0);
    assert.deepEqual([alt.entry, alt.point, alt.guard?.admitted], [entry, { x: alternative[0], y: alternative[1] }, true]);
    if (n === 5) assert.equal(alt.plan.choice.projection_ref, uniform);
    const result = await game.advance(alternatives[n]), next = await game.decision();
    assert.equal(result.family, n === 4 ? 'public_occurrence_recall' : owner);
    assert.deepEqual([next.entry, next.point], [n === 1 ? transfer : n === 4 ? analogy : 'field_service_composition', { x: successor[0], y: successor[1] }]);
  });
}

for (const [withdrawn, n] of [[transfer, 1], [analogy, 4]] as const) {
  test('withdrawing only ' + withdrawn + ' releases its own fallback', async t => {
    const group = FramedTransfer.prototype.proposeInSubquestion;
    t.mock.method(FramedTransfer.prototype, 'proposeInSubquestion', function (this: FramedTransfer, ...args: Parameters<typeof group>) {
      if (args[1] === withdrawn && args[2].revision === n) return Promise.resolve(null);
      return group.apply(this, args);
    });
    const game = await start();
    await prefix(game, n - 1);
    const ticket = await game.decision();
    assert.deepEqual([ticket.family, ticket.entry, ticket.point], n === 1
      ? ['information_goal', 'experiment', { x: 19, y: 13 }]
      : ['public_occurrence_recall', 'field_service_composition', { x: 39, y: 13 }]);
  });
}
