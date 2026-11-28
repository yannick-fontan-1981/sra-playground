import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_SP80_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { BranchRouting }: typeof import('../src/logos-engine/v6-branch-routing.ts') =
  await import(moduleURL('src/logos-engine/v6-branch-routing.ts'));
const { CellPlacementMemory }: typeof import('../src/logos-engine/v6-cell-placement.ts') =
  await import(moduleURL('src/logos-engine/v6-cell-placement.ts'));
const { measureCellPatchFields, projectCellPatch }: typeof import('../src/logos-engine/v6-cell-patch-observation.ts') =
  await import(moduleURL('src/logos-engine/v6-cell-patch-observation.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') =
  await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));

type Row = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-sp80-public-returns.json.gz', import.meta.url))).toString());
const packet = (turn: number): V6PublicObservation => fixture.observations[turn];
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const branches = 'branch_routing', cells = 'public_occurrence_recall';
const branchKind = 'parallel_branch_routing', cellKind = 'cell_patch_placement';

async function start(live = false) {
  const backend = live && process.env.SIC_SP80_GAME_ROOT ? await sourceBackend(process.env.SIC_SP80_GAME_ROOT) : null;
  function observe(request: object, expected: V6PublicObservation, sequence: number) {
    if (!backend) return expected;
    const actual = toV6PublicObservation(backend.dispatch(request), sequence);
    assert.deepEqual(actual, expected, 'SP80 public return ' + sequence);
    return actual;
  }
  const sessionId = 'sra-v6-' + fixture.session;
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence, budgets: fixture.budgets,
    observation: observe({ type: 'load', code: 'SP80', level: 1 }, packet(0), 0) });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      const trace = reply.snapshot.trace as Row[], index = trace.findLast(e => e.kind === 'before_guard')!;
      assert.equal(index.admitted, true);
      return { owner: reply.snapshot.lastDecision, command: reply.command!, proposal: reply.snapshot.proposal as Row, index: index.index };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1)) {
      const command = reply.command!;
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket!.id, executionMs: 0,
        observation: observe({ type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data }, expected, sequence) });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
async function prefix(game: Awaited<ReturnType<typeof start>>, count: number) {
  for (let i = 0; i < count; i++) {
    const { command } = await game.decision();
    assert.deepEqual([command.actionRef, command.data], ['ACTION' + fixture.commands[i].id, fixture.commands[i].data ?? {}]);
    await game.advance();
  }
}
function changed(before: V6PublicObservation, after: V6PublicObservation) {
  return before.frame.flatMap((row, y) => row.flatMap((value, x) => after.frame[y]![x] === value ? [] : [[x, y]]));
}

test('4 and 41 reproduce the catalogue, seal the branch poses and acquire five unresolved cell returns', async t => {
  const branch = t.mock.method(BranchRouting.prototype, 'record'), cell = t.mock.method(CellPlacementMemory.prototype, 'record');
  const game = await start(true);
  for (let n = 1; n <= 16; n++) {
    const { owner, command, proposal, index } = await game.decision(), historical = fixture.commands[n - 1];
    assert.deepEqual([command.actionRef, command.data], ['ACTION' + historical.id, historical.data ?? {}]);
    const p = proposal.cell_placement_plan;
    if (n <= 11) {
      const mode = n <= 4 ? 'calibrate' : n === 8 ? 'propagate' : n === 11 ? 'select' : 'move';
      assert.deepEqual([owner, proposal.kind, proposal.material_access_subquestion, proposal.steps[index].mode], [branches, branchKind, branchKind, mode]);
      if (n === 5) assert.equal(branch.mock.calls.at(-1)!.this.verified.size, 4);
    } else {
      assert.deepEqual([owner, proposal.kind, proposal.field_subquestion, p.point, p.model, p.expected_motif],
        [cells, cellKind, 'cell_patch_composition', [0, 1], null, null]);
      assert.deepEqual(proposal.question.hypothesis_refs, [p.observation_ref]);
      assert.deepEqual(projectCellPatch(packet(n).frame, p.field.geometry)!.grid, p.field.grid);
      assert.ok(changed(packet(n - 1), packet(n)).every(([, y]) => y === 63));
      if (n === 12) assert.deepEqual(changed(packet(n - 1), packet(n)), [[4, 63], [5, 63]]);
    }
    const outcome = await game.advance();
    assert.deepEqual([outcome.family, outcome.matched], [owner, (n >= 5 && n <= 7 || n >= 9 && n <= 11) ? true : null]);
    if (n === 1 || n === 11) {
      const e = branch.mock.calls.at(-1)!.result!;
      assert.deepEqual([e.mode, e.ref, e.before, e.after], n === 1
        ? ['calibrate', outcome.observation_ref, [[[12, 16]], 0], [[[12, 12]], 0]]
        : ['select', outcome.observation_ref, [[[8, 16], [28, 24], [28, 36]], 2], [[[8, 16], [28, 24], [28, 36]], 0]]);
    }
    if (n === 8) assert.deepEqual([outcome.reason, packet(n).level], ['official_boundary', 2]);
    if (n >= 12) {
      const e = cell.mock.calls.at(-1)!.result![0]!;
      assert.deepEqual([e.detail.before_ref, e.detail.after_ref, e.detail.canonical_unchanged, e.models, e.refused],
        [p.observation_ref, outcome.observation_ref, false, {}, []]);
      assert.equal(outcome.reason, 'cell_and_remote_response_require_reconciliation');
    }
  }
});

test('41 becomes admissible when selection changes the evidence for the empty role in the same field', () => {
  const [before] = measureCellPatchFields(packet(10).frame), [after] = measureCellPatchFields(packet(11).frame);
  assert.deepEqual(before!.geometry, { origin: [8, 16], shape: [2, 2], size: [12, 4], pitch: [20, 8] });
  assert.deepEqual(after!.geometry, before!.geometry);
  const palettes = (field: Row) => field.grid.map((row: string[]) => row.map(key => field.motifs[key].palette));
  assert.deepEqual([palettes(before!), palettes(after!)], [[[8, 12], [12, 8]], [[9, 12], [12, 8]]]);
  assert.equal(before!.empty_hypothesis, null);
  assert.ok(after!.empty_hypothesis);
  const vacant = after!.grid.flatMap((row: string[], y: number) =>
    row.flatMap((value, x) => value === after!.empty_hypothesis ? [[x, y]] : []));
  assert.deepEqual(vacant, [[1, 0], [0, 1]]);
});

test('4 records a stationary calibration as tried at this pose, without a motion reference', async t => {
  const record = t.mock.method(BranchRouting.prototype, 'record');
  const game = await start();
  const first = await game.decision();
  assert.equal(first.command.actionRef, 'ACTION1');
  await game.advance({ ...packet(1), frame: packet(0).frame, frames: [packet(0).frame] });
  const measured = record.mock.calls.at(-1)!, owner = measured.this;
  assert.deepEqual(measured.result!.before, measured.result!.after);
  assert.deepEqual([owner.motion, owner.refs, owner.state().seen], [{}, {}, [['ACTION1', [[12, 16]], 0]]]);
  const next = await game.decision();
  assert.deepEqual([next.owner, next.command.actionRef], [branches, 'ACTION2']);
});

test('41 refuses the same field trial after a stationary whole observation and resumes the bound branch move', async t => {
  const record = t.mock.method(CellPlacementMemory.prototype, 'record');
  const game = await start();
  await prefix(game, 11);
  const trial = (await game.decision()).proposal.cell_placement_plan;
  const result = await game.advance({ ...packet(12), frame: packet(11).frame, frames: [packet(11).frame] });
  const event = record.mock.calls.at(-1)!.result![0]!;
  assert.deepEqual([event.refused, event.detail.after_ref, event.detail.canonical_unchanged, event.models],
    [[trial.trial], result.observation_ref, true, {}]);
  const next = await game.decision();
  assert.deepEqual([next.owner, next.proposal.steps[next.index].mode, next.command.actionRef], [branches, 'move', 'ACTION4']);
});

for (const withdraw of [false, true]) {
  test('4 substitutes the first calibration at fixed input: ' + (withdraw ? 'frontier' : 'other control'),
    { skip: !BranchRouting.prototype.selectCalibration && 'historical engine has no calibration selector' }, async t => {
    const record = t.mock.method(BranchRouting.prototype, 'record'), select = t.mock.method(BranchRouting.prototype, 'selectCalibration');
    select.mock.mockImplementationOnce(keys => withdraw ? undefined : keys[1]);
    const game = await start(true), first = await game.decision();
    assert.deepEqual(select.mock.calls[0]!.arguments[0], ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5']);
    assert.deepEqual([first.owner, first.command.actionRef], withdraw ? ['observed_frontier', 'ACTION1'] : [branches, 'ACTION2']);
    const observations = fixture.alternatives[withdraw ? 'off4' : 'alt4'];
    const result = await game.advance(observations[0]);
    const next = await game.decision();
    assert.deepEqual([next.owner, next.command.actionRef], [branches, 'ACTION1']);
    if (withdraw) assert.equal(record.mock.callCount(), 0);
    else {
      const measured = record.mock.calls.at(-1)!;
      assert.deepEqual([measured.result!.after, measured.this.motion.ACTION2, measured.this.refs.ACTION2],
        [[[[12, 20]], 0], [0, 4], result.observation_ref]);
    }
    await game.advance(observations[1]);
    assert.equal((await game.decision()).command.actionRef, withdraw ? 'ACTION2' : 'ACTION3');
  });
}

for (const withdraw of [false, true]) {
  test('41 substitutes the cold point at fixed input: ' + (withdraw ? 'branch offer' : 'other vacant cell'),
    { skip: !CellPlacementMemory.prototype.selectProbeCell && 'historical engine has no cold cell selector' }, async t => {
    const record = t.mock.method(CellPlacementMemory.prototype, 'record');
    const game = await start(true);
    await prefix(game, 10);
    const selection = await game.decision();
    assert.deepEqual([selection.owner, selection.command.data], [branches, { x: 13, y: 17 }]);
    const select = t.mock.method(CellPlacementMemory.prototype, 'selectProbeCell');
    select.mock.mockImplementationOnce(() => withdraw ? null : 1);
    await game.advance();
    const offer = await game.decision(), obs = fixture.alternatives[withdraw ? 'off41' : 'alt41'];
    assert.deepEqual(select.mock.calls[0]!.arguments[0], [[0, 1], [1, 0]]);
    assert.deepEqual([offer.owner, offer.command.actionRef, offer.command.data],
      withdraw ? [branches, 'ACTION4', {}] : [cells, 'ACTION6', { x: 33, y: 17 }]);
    const outcome = await game.advance(obs[0]);
    assert.deepEqual([outcome.family, outcome.matched], [offer.owner, withdraw ? true : null]);
    if (withdraw) {
      assert.deepEqual(offer.proposal.steps[offer.index].expected_after, [[[12, 16], [28, 24], [28, 36]], 0]);
    } else {
      assert.deepEqual(changed(packet(11), obs[0]), [[4, 63], [5, 63]]);
      const event = record.mock.calls.at(-1)!.result![0]!;
      assert.deepEqual([event.detail.after_ref, event.models], [outcome.observation_ref, {}]);
    }
    const next = await game.decision();
    assert.deepEqual([next.owner, next.command.actionRef, next.command.data],
      withdraw ? [branches, 'ACTION4', {}] : [cells, 'ACTION6', { x: 13, y: 25 }]);
    await game.advance(obs[1]);
    assert.equal((await game.decision()).owner, next.owner);
  });
}
