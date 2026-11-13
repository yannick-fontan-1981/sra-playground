import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureTraceField, traceFieldCenter } from '../src/logos-engine/v6-trace-field-observation.ts';
import { TraceFieldMemory, traceFieldBefore, traceFieldAfter, commonTraceFieldProposal, bindTraceField } from '../src/logos-engine/v6-trace-field-access.ts';
import { constructTraceField } from '../src/logos-engine/v6-trace-field-mechanics.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest as identity } from '../src/logos-engine/v6-hash.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const native = { distinguishCellSupport: true };
const probe = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-trace-field-original-public.json.gz', import.meta.url))).toString()) as R;
const last = probe.packets.at(-1), initialRows = last.packet.frame_rows as number[][];
const beforeMeta = (observation: R): R => ({ epoch: observation.level_epoch, score: observation.levels_completed,
  observation_ref: observation.observation_ref, available: observation.available_action_refs });
const afterMeta = (observation: R): R => ({ epoch: observation.level_epoch, score: observation.levels_completed, state: observation.state });

function propose(memory = new TraceFieldMemory()): R {
  return memory.proposeTrace(last.observation, initialRows, [], 16, { ...probe.policy, remaining_level_actions: 600 },
    360_000, () => 0, undefined, native)!;
}

/** Controlled public rasters, not an environment or a stored action solution. */
function raster(size = 9, count = 4): number[][] {
  const pitch = size + 1, left = 3, top = 5, extent = count * pitch;
  const rows = Array.from({ length: top + extent + 4 }, () => Array(left + extent + 4).fill(8));
  for (let y = top; y <= top + extent; y++) for (let x = left; x <= left + extent; x++) {
    const edge = x === left || y === top || x === left + extent || y === top + extent;
    rows[y]![x] = edge ? 4 : (x - left) % pitch && (y - top) % pitch ? 2 : 3;
  }
  const geometry = { bbox: [left, top, left + extent, top + extent], pitch, size };
  ring(rows, traceFieldCenter(geometry, [0, 0]), size - 2, 5, 6);
  ring(rows, traceFieldCenter(geometry, [count - 1, count - 1]), size - 2, 7, 2);
  return rows;
}

function ring(rows: number[][], center: readonly number[], width: number, palette: number, inside: number): void {
  const [cx, cy] = center, half = Math.floor(width / 2);
  for (let y = cy! - half; y <= cy! + half; y++) for (let x = cx! - half; x <= cx! + half; x++) {
    rows[y]![x] = x === cx! - half || x === cx! + half || y === cy! - half || y === cy! + half ? palette : inside;
  }
}

test('explicit visual extension resolves only the source ambiguity and grants no action or terminal authority', () => {
  assert.equal(measureTraceField(initialRows), null);
  assert.equal(measureTraceField(initialRows, null, { distinguishCellSupport: false }), null);
  const scene = measureTraceField(initialRows, null, native)!;
  assert.ok(scene);
  const witness = scene.native_support_discrimination;
  assert.equal(witness.original_pair_count, 2);
  assert.equal(witness.retained_pair_count, 1);
  assert.ok(witness.current_full_cell_homologues.length >= 3);
  assert.equal(witness.frame_digest, identity(initialRows));
  assert.equal(witness.geometry_ref, scene.geometry_ref);
  assert.deepEqual(witness.selected_marks, [scene.head, scene.receiver_hypothesis]);
  assert.equal(witness.path_search_used, false);
  assert.equal(witness.primitive_release_authorized, false);
  assert.equal(witness.terminal_role_acquired, false);
  for (const { mark, inset } of witness.excluded_cell_material_rings) {
    assert.equal(mark.palette, scene.geometry.floor_value);
    assert.equal(mark.width, scene.geometry.size);
    assert.deepEqual(mark.cell, inset.cell);
    assert.ok(mark.width > inset.width);
  }
  const memory = new TraceFieldMemory(), empty = memory.currentState(), plan = propose(memory);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.steps[0].relation_observed, false);
  assert.equal(plan.trace_field_plan.native_support_ref, identity(witness));
  assert.equal(plan.facts.official_terminal_law_unknown, true);
  assert.deepEqual(memory.currentState(), empty, 'A proposed visual hypothesis cannot acquire its own evidence');
});

test('enabled extension preserves every measured scene, source plan, guard and acquisition over the first four levels', async () => {
  const memory = new TraceFieldMemory();
  let count = 0;
  for (const prefix of probe.prefixes) {
    const first = probe.packets[prefix.steps[0].actionIndex - 1];
    const proposal = await commonTraceFieldProposal(memory, first.observation, first.packet.frame_rows, [], 120,
      probe.policy, 360_000, () => 0, undefined, native);
    bindTraceField(proposal!, new ObservedInputDomain(4096));
    assert.deepEqual(proposal, prefix.proposal, 'A source-unique scene keeps its exact source plan');
    for (const step of prefix.steps) {
      const before = probe.packets[step.actionIndex - 1], after = probe.packets[step.actionIndex];
      assert.deepEqual(measureTraceField(before.packet.frame_rows, null, native), measureTraceField(before.packet.frame_rows));
      assert.deepEqual(traceFieldBefore(proposal!, step.index, before.packet.frame_rows, beforeMeta(before.observation) as any, native), step.beforeGuard);
      assert.deepEqual(traceFieldAfter(proposal!, step.index, before.packet.frame_rows, after.packet.frame_rows, afterMeta(after.observation) as any, native), step.outcome);
      const events = memory.record(before.observation, after.command, after.observation, before.packet.frame_rows,
        after.packet.frame_rows, proposal!, step.index, native);
      assert.deepEqual(events, step.acquired.events);
      assert.deepEqual(memory.currentState(), step.afterState.projection);
      count++;
    }
  }
  assert.equal(count, 53);
  assert.equal(memory.currentState().trace_events.filter(event => event.transition.outcome === 'official_boundary').length, 4);
});

test('support relation survives palette bijections, translated screens, reflections and transposition', () => {
  const source = measureTraceField(initialRows, null, native)!, width = initialRows[0]!.length;
  const transformed = [
    { rows: initialRows.map(row => row.map(value => (value * 7 + 3) % 17)), cell: (cell: number[]) => cell },
    { rows: initialRows.map(row => [...row].reverse()), cell: (cell: number[]) => [source.geometry.shape[0] - 1 - cell[0]!, cell[1]] },
    { rows: [...initialRows].reverse().map(row => [...row]), cell: (cell: number[]) => [cell[0], source.geometry.shape[1] - 1 - cell[1]!] },
    { rows: Array.from({ length: width }, (_, x) => initialRows.map(row => row[x]!)), cell: (cell: number[]) => [cell[1], cell[0]] },
    { rows: [...Array.from({ length: 7 }, () => Array(width + 5).fill(22)), ...initialRows.map(row => [...Array(5).fill(22), ...row])], cell: (cell: number[]) => cell },
  ];
  for (const item of transformed) {
    assert.equal(measureTraceField(item.rows), null);
    const measured = measureTraceField(item.rows, null, native)!;
    assert.ok(measured);
    assert.deepEqual(measured.head.cell, item.cell(source.head.cell));
    assert.deepEqual(measured.receiver_hypothesis.cell, item.cell(source.receiver_hypothesis.cell));
    assert.equal(measured.native_support_discrimination.rule, source.native_support_discrimination.rule);
    assert.equal(measured.native_support_discrimination.frame_digest, identity(item.rows));
  }
});

test('same visual rule works across independently generated cell sizes and grid counts', () => {
  for (const size of [7, 9, 11, 13]) for (const count of [3, 4, 5]) {
    const rows = raster(size, count), scene = measureTraceField(rows, null, native);
    assert.equal(measureTraceField(rows), null);
    assert.ok(scene, `size ${size}, grid ${count}`);
    assert.equal(scene.geometry.size, size);
    assert.deepEqual(scene.geometry.shape, [count, count]);
    assert.equal(scene.head.width, size - 2);
    assert.equal(scene.native_support_discrimination.original_pair_count, 2);
  }
});

test('visual interpretation does not use a covering solution as evidence', () => {
  const rows = raster(), scene = measureTraceField(rows, null, native)!;
  assert.ok(scene.native_support_discrimination);
  // Opposite corners of an even square have the same checkerboard parity:
  // the current visual relation is clear but this requested covering path is impossible.
  assert.equal(constructTraceField(scene, last.observation, 600, 360_000, () => 0), null);
  const memory = new TraceFieldMemory(), empty = memory.currentState();
  const result = memory.proposeTrace(last.observation, rows, [], 16, { ...probe.policy, remaining_level_actions: 600 },
    360_000, () => 0, undefined, native);
  assert.equal(result!.reason, 'experimental_trace_has_no_bounded_cover_in_measured_graph');
  assert.deepEqual(memory.currentState(), empty);
  assert.deepEqual(measureTraceField(rows, null, native), scene);
});

test('competing positions, competing inset rings and different outer material retain the ambiguity', () => {
  const original = raster(), scene = measureTraceField(original, null, native)!, g = scene.geometry;
  const competingHead = copy(original);
  ring(competingHead, traceFieldCenter(g, [1, 1]), g.size - 2, 5, 6);
  const competingReceiver = copy(original);
  ring(competingReceiver, traceFieldCenter(g, [1, 1]), g.size - 2, 7, 2);
  const deeperInset = copy(original);
  for (const mark of [scene.head, scene.receiver_hypothesis]) ring(deeperInset,
    traceFieldCenter(g, mark.cell), mark.width - 2, 10, mark.center_value);
  const foreignMaterial = copy(original);
  for (const { mark } of scene.native_support_discrimination.excluded_cell_material_rings) {
    const [l, t, r, b] = mark.bbox;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (x === l || x === r || y === t || y === b) foreignMaterial[y]![x] = 11;
  }
  for (const rows of [competingHead, competingReceiver, deeperInset, foreignMaterial]) {
    assert.equal(measureTraceField(rows, g), null);
    assert.equal(measureTraceField(rows, g, native), null);
  }
});

test('retained geometry cannot substitute for current independent full-cell material witnesses', () => {
  const original = raster(), scene = measureTraceField(original, null, native)!, g = scene.geometry;
  for (const keep of [new Set(['1,0', '2,0']), new Set(['1,0', '2,0', '3,0'])]) {
    const rows = copy(original);
    for (const full of scene.native_support_discrimination.current_full_cell_homologues) {
      if (keep.has(full.cell.join(','))) continue;
      const [x, y] = traceFieldCenter(g, full.cell); rows[y]![x] = 13;
    }
    assert.equal(measureTraceField(rows, g, native), null);
  }
});

test('native trace guards bind the current witness, public epoch, command, pixels and permission', async () => {
  const memory = new TraceFieldMemory(), empty = memory.currentState();
  const proposal = await commonTraceFieldProposal(memory, last.observation, initialRows, [], 600, probe.policy,
    360_000, () => 0, undefined, native);
  assert.ok(proposal);
  bindTraceField(proposal, new ObservedInputDomain(4096));
  const meta = beforeMeta(last.observation) as any;
  assert.equal(traceFieldBefore(proposal, 0, initialRows, meta, native).admitted, true);
  assert.equal(traceFieldBefore(proposal, 0, initialRows, meta).admitted, false);
  for (const mutate of [
    (p: R) => { p.trace_field_plan.native_support_ref = 'unbound'; },
    (p: R) => { p.trace_field_plan.scene.native_support_discrimination.current_full_cell_homologues.pop(); },
    (p: R) => { delete p.trace_field_plan.scene.native_support_discrimination; },
    (p: R) => { delete p.trace_field_plan.native_support_ref; },
    (p: R) => { p.actions[0].data.x++; },
    (p: R) => { p.steps[0].source = [...p.trace_field_plan.scene.receiver_hypothesis.cell]; },
  ]) {
    const changed = copy(proposal); mutate(changed);
    assert.equal(traceFieldBefore(changed, 0, initialRows, meta, native).admitted, false);
  }
  for (const patch of [{ epoch: meta.epoch + 1 }, { score: meta.score + 1 }, { observation_ref: 'stale' }, { available: [] }]) {
    assert.equal(traceFieldBefore(proposal, 0, initialRows, { ...meta, ...patch }, native).admitted, false);
  }
  const changedPixels = copy(initialRows); changedPixels[0]![0]++;
  assert.equal(traceFieldBefore(proposal, 0, changedPixels, meta, native).admitted, false);
  const movedPoint = copy(proposal); movedPoint.steps[0].point_support.point[0]++;
  assert.throws(() => bindTraceField(movedPoint, new ObservedInputDomain(4096)), /point|payload/i);
  assert.throws(() => memory.record(last.observation, proposal.actions[0], last.observation, initialRows,
    initialRows, proposal, 0), /enabled interpretation/);
  assert.deepEqual(memory.currentState(), empty, 'A rejected native receipt cannot acquire a partial event');
  assert.equal(traceFieldAfter(proposal, 0, initialRows, initialRows, afterMeta(last.observation) as any, native).matched, false);
});

test('an actual unchanged public return refutes the experiment and retains its proposed visual witness', () => {
  const memory = new TraceFieldMemory(), proposal = propose(memory), after = { ...last.observation, observation_ref: 'controlled:unchanged-public-return' };
  const events = memory.record(last.observation, proposal.actions[0], after, initialRows, initialRows, proposal, 0, native);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.transition.outcome, 'projection_refuted');
  assert.equal(events[0]!.native_support_discrimination.actual_response, 'projection_refuted');
  assert.equal(events[0]!.native_support_discrimination.local_control_effect_observed, false);
  assert.equal(events[0]!.native_support_discrimination.terminal_role_acquired, false);
  assert.equal(events[0]!.native_support_discrimination.primitive_release_authorized, false);
  assert.deepEqual(events[0]!.native_support_discrimination.witness, proposal.trace_field_plan.scene.native_support_discrimination);
  assert.equal(memory.currentState().trace_state!.successes.length, 0);
  assert.equal(memory.currentState().trace_state!.failures.length, 1);
  assert.equal(propose(memory).reason, 'trace_command_refuted_in_exact_context');
  const retained = memory.currentState(), restored = new TraceFieldMemory();
  for (const event of retained.trace_events) restored.applyEvent(event);
  assert.deepEqual(restored.currentState(), retained);
  events[0]!.native_support_discrimination.witness.selected_marks.length = 0;
  assert.deepEqual(memory.currentState(), retained, 'Returned events do not mutate retained evidence');
});
