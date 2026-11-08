import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureRootedQuota, measureRootedLengths } from '../src/logos-engine/v6-rooted-quota-observation.ts';
import { measureRootedQuotaWithMarkSupport, currentRootedMarkSupportMatches } from '../src/logos-engine/v6-rooted-quota-mark-support.ts';
import { RootedQuotaMemory, rootedQuotaBefore, rootedQuotaAfter, commonRootedQuotaProposal } from '../src/logos-engine/v6-rooted-quota-access.ts';
import { propagateRootedQuota } from '../src/logos-engine/v6-rooted-quota-mechanics.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { symbolicDigest as identity } from '../src/logos-engine/v6-hash.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url), clone = <T>(value: T): T => structuredClone(value);
const read = (path: string) => readFile(new URL(path, root));
const trace = JSON.parse(gunzipSync(await read('docs/migration/native-campaigns-v42/ther-four-level-public-trace.json.gz')).toString()) as R;
const report = JSON.parse((await read('docs/migration/native-campaigns-v42/ther-four-levels.json')).toString()) as R;
const fixture = JSON.parse(gunzipSync(await read('tests/fixtures/v6-rooted-quota-reference.json.gz')).toString()) as R;
const configuration = JSON.parse((await read(`reference/v6/${fixture.sourceCommit}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`)).toString()).declarations[0].configuration;
const packet = trace.packets[15].packet, rows: number[][] = packet.frame_rows;
const acquired = report.prefixes.find((item: R) => item.callerAcquiredTransitions === 15).sharedSeries.rootedQuotaLatestState;
const observation = { level_epoch: packet.level, levels_completed: packet.levels_completed, observation_ref: acquired.evidence.at(-1),
  frame_hash: packet.frame_hash, state: packet.state, available_action_refs: packet.available_action_refs };
const sourceScene = measureRootedQuota(rows, acquired.model.empty_palette)!;
const measurement = measureRootedQuotaWithMarkSupport(rows, acquired.model.empty_palette), scene = measurement.scene!;
const native = { extendedMarkSupport: true };
const memory = (): RootedQuotaMemory => { const result = new RootedQuotaMemory(); result.applyEvent(clone(acquired)); return result; };
const propose = (raster = rows): R => memory().proposeRooted(observation, raster, [], 16, fixture.policy, 300000, () => 0, undefined, native)!;
const proposal = propose();
const beforeMeta = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
  available: observation.available_action_refs };
const afterMeta = { epoch: observation.level_epoch, score: observation.levels_completed, state: observation.state };
const positive = (axis: number, index: number): R => measurement.receipt!.axes[axis].groups[index];
const eraseUnit = (raster: number[][], group: R, index: number): void => {
  const background = group.outward_empty_slot.pixels[0][2];
  for (const [x, y] of group.units[index].pixels) raster[y][x] = background;
};
const addUnit = (raster: number[][], group: R, dx: number, dy: number, color = group.units[0].palette_value, from = 0): void => {
  for (const [x, y] of group.units[from].pixels) raster[y + dy][x + dx] = color;
};
/** Controlled raster construction, not a game return or a campaign proof. */
const filled = (lengths: number[], input = rows): number[][] => {
  const raster = clone(input);
  for (const [i, chain] of scene.chains.entries()) for (const [cx, cy] of chain.cells.slice(0, lengths[i])) {
    for (let y = scene.y_lines[cy] + 1; y < scene.y_lines[cy + 1]; y++) {
      for (let x = scene.x_lines[cx] + 1; x < scene.x_lines[cx + 1]; x++) if (raster[y][x] === scene.empty_content_palette) raster[y][x] = acquired.model.fill_palette;
    }
  }
  assert.deepEqual(measureRootedLengths(raster, scene, acquired.model), lengths);
  return raster;
};

test('native full-support reader extends omitted public units without changing the faithful source measurement', () => {
  assert.equal(report.status, 'passed'); assert.equal(report.final.levelsCompleted, 4); assert.equal(packet.levels_completed, 4);
  assert.deepEqual(sourceScene.row_marks, [3, 3, 3, 3, 1]); assert.deepEqual(sourceScene.column_marks, [2, 3, 3, 3, 2]);
  assert.equal(measurement.status, 'measured'); assert.equal(measurement.reason, 'complete_visible_support_extends_source_counts');
  assert.deepEqual(scene.row_marks, [3, 3, 4, 3, 1]); assert.deepEqual(scene.column_marks, [2, 3, 4, 3, 2]);
  assert.deepEqual(measureRootedQuota(rows, acquired.model.empty_palette), sourceScene);
  assert.equal(scene.native_mark_support, measurement.receipt);
  const source = propagateRootedQuota(sourceScene, observation, acquired.model, 300000, () => 0);
  const extended = propagateRootedQuota(scene, observation, acquired.model, 300000, () => 0);
  assert.equal(source.cause, 'EMPTY_DOMAIN_CONTRADICTION'); assert.equal(extended.status, 'COMPLETE'); assert.equal(extended.values.all_domains_singleton, true);
  assert.equal(packet.levels_completed, 4, 'Analytic singleton domains are not a fifth completed game level');
});

test('the receipt contains exact support, observed spacing, half-pixel phase and separate conditional semantics', () => {
  const receipt = clone(measurement.receipt!), ref = receipt.support_ref; delete receipt.support_ref;
  assert.equal(identity(receipt), ref); assert.notEqual(scene.geometry_ref, sourceScene.geometry_ref);
  for (const axis of receipt.axes) {
    assert.equal(axis.repetition_pitch, 2); assert.equal(axis.transverse_offset_doubled, -1);
    assert.equal(axis.inward_anchor, 3);
    for (const group of axis.groups) {
      for (const unit of group.units) for (const [x, y] of unit.pixels) assert.equal(rows[y][x], unit.palette_value);
      for (const [x, y, value] of group.support_pixels) assert.equal(rows[y][x], value);
      for (const [x, y, value] of group.outward_empty_slot.pixels) assert.equal(rows[y][x], value);
    }
  }
  assert.match(receipt.scope, /remain conditional/); assert.match(receipt.scope, /no solver-selected reading or terminal law/);
});

for (let index = 0; index < 15; index++) test(`all saved pre-extension public packets retain exact source geometry: ${index}`, () => {
  const raster = trace.packets[index].packet.frame_rows, source = measureRootedQuota(raster, acquired.model.empty_palette);
  const current = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.equal(current.status, 'measured'); assert.deepEqual(current.scene, source);
});

test('actual source-component prefix continuations still satisfy complete current mark guards', () => {
  let actualReturns = 0;
  for (const envelope of fixture.commonEnvelopes as R[]) for (const step of envelope.steps as R[]) {
    const earlier = fixture.scenes[`public:${step.actionIndex - 1}`], later = fixture.scenes[`public:${step.actionIndex}`];
    const plan = envelope.proposal;
    assert.deepEqual(rootedQuotaBefore(plan, step.index, earlier.rows, {
      epoch: earlier.observation.level_epoch, score: earlier.observation.levels_completed,
      observation_ref: earlier.observation.observation_ref, available: earlier.observation.available_action_refs,
    }, native), step.beforeGuard);
    assert.deepEqual(rootedQuotaAfter(plan, step.index, earlier.rows, later.rows, {
      epoch: later.observation.level_epoch, score: later.observation.levels_completed, state: later.observation.state,
    }, native), step.outcome);
    actualReturns++;
  }
  assert.equal(actualReturns, 11);
});

test('a palette permutation retains inferred counts and discovers the new palette from pixels', () => {
  const palette = (value: number): number => (value * 29 + 7) % 256;
  const changed = rows.map(row => row.map(palette)), result = measureRootedQuotaWithMarkSupport(changed, palette(acquired.model.empty_palette));
  assert.equal(result.status, 'measured'); assert.deepEqual(result.scene!.row_marks, scene.row_marks); assert.deepEqual(result.scene!.column_marks, scene.column_marks);
  assert.deepEqual(result.receipt!.palette_values, measurement.receipt!.palette_values.map(palette).sort((a: number, b: number) => a - b));
  assert.notEqual(result.receipt!.support_ref, measurement.receipt!.support_ref);
});

test('translation recomputes anchors and supports without a fixed screen coordinate', () => {
  const dx = 3, dy = 4, background = positive(0, 0).outward_empty_slot.pixels[0][2];
  const shifted = Array.from({ length: rows.length + 8 }, () => Array(rows[0]!.length + 8).fill(background));
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[0]!.length; x++) shifted[y + dy]![x + dx] = rows[y]![x];
  const result = measureRootedQuotaWithMarkSupport(shifted, acquired.model.empty_palette);
  assert.equal(result.status, 'measured'); assert.deepEqual(result.scene!.row_marks, scene.row_marks); assert.deepEqual(result.scene!.column_marks, scene.column_marks);
  assert.deepEqual(result.scene!.bbox, [scene.bbox[0] + dx, scene.bbox[1] + dy, scene.bbox[2] + dx, scene.bbox[3] + dy]);
  assert.deepEqual(result.receipt!.axes.map((axis: R) => axis.inward_anchor), [3, 3]);
});

test('transposition exchanges row/column roles and exact half-pixel alignment', () => {
  const transposed = rows[0]!.map((_, x) => rows.map(row => row[x]!)), result = measureRootedQuotaWithMarkSupport(transposed, acquired.model.empty_palette);
  assert.equal(result.status, 'measured'); assert.deepEqual(result.scene!.row_marks, scene.column_marks); assert.deepEqual(result.scene!.column_marks, scene.row_marks);
  assert.deepEqual(result.scene!.mark_unit_shapes, [[1, 2], [2, 1]]);
  assert.deepEqual(result.receipt!.axes.map((axis: R) => axis.transverse_offset_doubled), [-1, -1]);
});

test('counting is independent of whether the downstream quota constraints are satisfiable', () => {
  const raster = clone(rows), group = positive(0, 4), pitch = measurement.receipt!.axes[0].repetition_pitch;
  addUnit(raster, group, -pitch, 0);
  const result = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.equal(result.status, 'measured'); assert.deepEqual(result.scene!.row_marks, [3, 3, 4, 3, 2]);
  const mechanical = propagateRootedQuota(result.scene!, observation, acquired.model, 300000, () => 0);
  assert.equal(mechanical.cause, 'EMPTY_DOMAIN_CONTRADICTION');
  assert.equal(memory().proposeRooted(observation, raster, [], 16, fixture.policy, 300000, () => 0, undefined, native)!.reason,
    'conditional_prefix_marginals_not_singleton');
});

test('a missing internal unit refuses a gapped series even when the near-grid source reader succeeds', () => {
  const raster = clone(rows); eraseUnit(raster, positive(0, 2), 2);
  assert.ok(measureRootedQuota(raster, acquired.model.empty_palette));
  const result = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.equal(result.status, 'refused'); assert.match(result.reason, /spacing_ambiguous|gap_or_second_phase/);
  const refused = memory().proposeRooted(observation, raster, [], 16, fixture.policy, 300000, () => 0, undefined, native)!;
  assert.equal(refused.status, 'abstained'); assert.ok(refused.native_mark_refusal); assert.equal(refused.rooted_quota_plan, undefined);
});

test('an aligned unit in another palette cannot be counted or silently discarded', () => {
  const raster = clone(rows), group = positive(0, 2), outer = group.units.at(-1);
  for (const [x, y] of outer.pixels) raster[y][x] = 99;
  assert.ok(measureRootedQuota(raster, acquired.model.empty_palette));
  const result = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.equal(result.status, 'refused'); assert.equal(result.reason, 'mixed_aligned_unit_palettes');
});

test('a second aligned phase remains ambiguous and never becomes a solver-selected subset', () => {
  const raster = clone(rows), group = positive(0, 2);
  addUnit(raster, group, -9, 0); // Same visible unit at a different phase, outside the source band.
  assert.ok(measureRootedQuota(raster, acquired.model.empty_palette));
  const result = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.equal(result.status, 'refused'); assert.equal(result.reason, 'aligned_series_has_gap_or_second_phase');
});

test('a separate same-phase run with a missing intervening slot is not folded into the quota', () => {
  const raster = clone(rows), group = positive(0, 0);
  addUnit(raster, group, -8, 0);
  const result = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.equal(result.status, 'refused'); assert.equal(result.reason, 'aligned_series_has_gap_or_second_phase');
});

test('inconsistent inward anchors are a measurement refusal', () => {
  const raster = clone(rows), group = positive(0, 4);
  eraseUnit(raster, group, 0); addUnit(raster, group, -2, 0);
  assert.ok(measureRootedQuota(raster, acquired.model.empty_palette));
  const result = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.equal(result.status, 'refused'); assert.equal(result.reason, 'inward_anchor_ambiguous');
});

test('a shifted half-pixel phase is not rounded into another observed alignment', () => {
  const raster = clone(rows), group = positive(0, 2), outer = group.units.length - 1;
  eraseUnit(raster, group, outer); addUnit(raster, group, 0, 1, group.units[outer].palette_value, outer);
  const result = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.equal(result.status, 'refused'); assert.equal(result.reason, 'transverse_alignment_ambiguous');
});

test('independent row and column series may recolor uniformly without an invented global palette law', () => {
  const raster = clone(rows);
  for (const group of measurement.receipt!.axes[1].groups) for (const unit of group.units) for (const [x, y] of unit.pixels) raster[y][x] = 99;
  assert.ok(measureRootedQuota(raster, acquired.model.empty_palette));
  const result = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.equal(result.status, 'measured'); assert.equal(result.receipt!.structure_ref, measurement.receipt!.structure_ref);
  assert.notEqual(result.receipt!.support_ref, measurement.receipt!.support_ref);
  assert.equal(currentRootedMarkSupportMatches(raster, scene), false, 'First-frame measurement is still exact');
  assert.equal(currentRootedMarkSupportMatches(raster, scene, true), true, 'Continuation remeasures each complete recolored series');
});

test('a unit touching the visible boundary does not certify a complete outward series', () => {
  const cropped = rows.map(row => row.slice(positive(0, 2).units.at(-1).bbox[0]));
  assert.ok(measureRootedQuota(cropped, acquired.model.empty_palette));
  const result = measureRootedQuotaWithMarkSupport(cropped, acquired.model.empty_palette);
  assert.equal(result.status, 'refused'); assert.equal(result.reason, 'visible_support_touches_raster_boundary');
});

test('an outermost unit away from the edge still needs a fully visible next empty slot', () => {
  const cropped = rows.map(row => row.slice(positive(0, 2).units.at(-1).bbox[0] - 1));
  assert.ok(measureRootedQuota(cropped, acquired.model.empty_palette));
  const result = measureRootedQuotaWithMarkSupport(cropped, acquired.model.empty_palette);
  assert.equal(result.status, 'refused'); assert.equal(result.reason, 'outward_series_end_not_visible');
});

test('the colored singleton contained by a hollow zero remains containment, not a numeric unit', () => {
  const first = trace.packets[0].packet.frame_rows, measured = measureRootedQuotaWithMarkSupport(first, acquired.model.empty_palette);
  assert.equal(measured.status, 'measured'); assert.equal(measured.scene!.row_marks[0], 0);
  const zero = measured.receipt!.axes[0].groups[0]; assert.equal(zero.kind, 'hollow_zero');
  assert.equal(zero.contained_components.length, 1); assert.equal(zero.contained_components[0].pixels.length, 1);
  assert.notEqual(zero.shell.palette_value, zero.contained_components[0].palette_value);
});

test('a true separate unit alongside a zero is competing support rather than contained zero interior', () => {
  const raster = clone(trace.packets[0].packet.frame_rows), first = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  const zero = first.receipt!.axes[0].groups[0], group = first.receipt!.axes[0].groups[1];
  // Place the extra unit beside the zero, with the unit's measured transverse
  // offset, rather than recoloring the contained hole.
  const targetX = zero.shell.bbox[0] - 2, targetY = zero.cell_center - 1;
  const unit = group.units[0]; addUnit(raster, group, targetX - unit.bbox[0], targetY - unit.bbox[1]);
  const result = measureRootedQuotaWithMarkSupport(raster, acquired.model.empty_palette);
  assert.notEqual(result.status, 'measured'); assert.equal(result.scene, null);
});

test('source-default proposal remains the original contradiction refusal; native proposal acquires nothing', async () => {
  const original = memory(), before = original.currentState(), digest = original.retainedDigest('parent');
  assert.equal(original.proposeRooted(observation, rows, [], 16, fixture.policy, 300000, () => 0)!.reason, 'conditional_prefix_marginals_not_singleton');
  const current = await commonRootedQuotaProposal(original, observation, rows, [], 16, fixture.policy, 300000, () => 0, undefined, native);
  assert.equal(current!.kind, 'rooted_quota_experiment'); assert.equal(current!.actions.length, 5);
  assert.deepEqual(current!.rooted_quota_plan.scene.native_mark_support, measurement.receipt);
  assert.deepEqual(original.currentState(), before); assert.equal(original.retainedDigest('parent'), digest);
  assert.equal(current!.steps.length, 5); assert.ok(current!.steps.every((step: R) => step.point_support));
});

test('native current-scene guard rejects receipt deletion instead of downgrading to narrow source behavior', () => {
  assert.equal(rootedQuotaBefore(proposal, 0, rows, beforeMeta, native).admitted, true);
  const changed = clone(proposal); delete changed.rooted_quota_plan.scene.native_mark_support;
  assert.equal(rootedQuotaBefore(changed, 0, rows, beforeMeta, native).admitted, false);
  assert.equal(currentRootedMarkSupportMatches(rows, changed.rooted_quota_plan.scene), false);
});

for (const field of ['method', 'scope', 'support_ref']) test(`native guard rejects forged descriptive support ${field}`, () => {
  const changed = clone(proposal); changed.rooted_quota_plan.scene.native_mark_support[field] = 'forged';
  assert.equal(rootedQuotaBefore(changed, 0, rows, beforeMeta, native).admitted, false);
});

test('rehashing forged support scope cannot make it the current native measurement', () => {
  const changed = clone(proposal), altered = changed.rooted_quota_plan.scene, receipt = altered.native_mark_support;
  receipt.scope = 'forged unconditional quota law';
  delete receipt.support_ref; receipt.support_ref = identity(receipt);
  delete altered.geometry_ref; altered.geometry_ref = identity(altered);
  assert.equal(rootedQuotaBefore(changed, 0, rows, beforeMeta, native).admitted, false);
  const later = filled(proposal.steps[0].prediction.after);
  assert.equal(rootedQuotaBefore(changed, 1, later, beforeMeta, native).admitted, false);
});

test('changing only a clue invalidates continuation even when the predicted filled lengths still match', () => {
  const later = filled(proposal.steps[0].prediction.after), changed = clone(later);
  eraseUnit(changed, positive(0, 2), 3);
  assert.deepEqual(measureRootedLengths(changed, scene, acquired.model), proposal.steps[1].prediction.before);
  assert.equal(rootedQuotaBefore(proposal, 1, later, beforeMeta, native).admitted, true);
  assert.equal(rootedQuotaBefore(proposal, 1, changed, beforeMeta).admitted, true, 'Faithful source path illustrates its narrower guard');
  assert.equal(rootedQuotaBefore(proposal, 1, changed, beforeMeta, native).admitted, false);
});

test('the same-epoch after guard refuses positive attribution when only current mark support changed', () => {
  const later = filled(proposal.steps[0].prediction.after), changed = clone(later);
  eraseUnit(changed, positive(0, 2), 3);
  assert.equal(rootedQuotaAfter(proposal, 0, rows, later, afterMeta, native).matched, true);
  assert.equal(rootedQuotaAfter(proposal, 0, rows, changed, afterMeta).matched, true);
  assert.deepEqual(rootedQuotaAfter(proposal, 0, rows, changed, afterMeta, native), {
    matched: false, seal_prefix: true, reason: 'native_rooted_mark_support_changed', official_progress: false,
  });
});

test('an official boundary seals the prefix without attributing a new mark or terminal law', () => {
  const boundary = { ...afterMeta, epoch: afterMeta.epoch + 1, score: afterMeta.score + 1 };
  assert.deepEqual(rootedQuotaAfter(proposal, 0, rows, [[0]], boundary, native), {
    matched: null, seal_prefix: true, reason: 'official_boundary', official_progress: true,
  });
  const owner = memory(), events = owner.record(observation, proposal.actions[0], {
    ...observation, level_epoch: boundary.epoch, levels_completed: boundary.score, observation_ref: 'controlled:boundary',
  }, rows, [[0]], proposal, 0);
  assert.equal(events[0].native_mark_support.after_status, 'official_boundary_excluded_from_mark_attribution');
  assert.deepEqual(events[0].native_mark_support.evidence, [observation.observation_ref, 'controlled:boundary']);
  assert.deepEqual(events[0].native_mark_support.measurement, measurement.receipt);
  assert.equal(events[0].native_mark_support.sample, undefined);
});

test('a controlled actual record owns the descriptive support; reconstruction includes its digest', () => {
  const later = filled(proposal.steps[0].prediction.after), owner = memory(), after = { ...observation, observation_ref: 'controlled:after' };
  const events = owner.record(observation, proposal.actions[0], after, rows, later, proposal, 0);
  assert.equal(events[0].native_mark_support.after_status, 'current_structural_mark_support_preserved');
  const state = owner.currentState(), digest = owner.retainedDigest('parent'), reconstructed = new RootedQuotaMemory();
  for (const event of state.quota_events) reconstructed.applyEvent(event);
  assert.equal(reconstructed.retainedDigest('parent'), digest); assert.deepEqual(reconstructed.currentState(), state);
  events[0].native_mark_support.measurement.counts.rows[0] = 999;
  state.quota_events.at(-1)!.native_mark_support.measurement.axes[0].groups[0].units[0].pixels[0][0] = 999;
  assert.equal(owner.retainedDigest('parent'), digest, 'Caller mutation cannot rewrite retained acquired support');
});

test('uniform series recoloring is remeasured at each actual before/after and retained with current colors', () => {
  const firstReturn = filled(proposal.steps[0].prediction.after), group = positive(0, 2);
  for (const unit of group.units) for (const [x, y] of unit.pixels) firstReturn[y][x] = 77;
  const secondReturn = filled(proposal.steps[1].prediction.after, firstReturn);
  for (const unit of group.units) for (const [x, y] of unit.pixels) secondReturn[y][x] = 78;
  assert.equal(rootedQuotaBefore(proposal, 1, firstReturn, beforeMeta, native).admitted, true);
  assert.equal(rootedQuotaAfter(proposal, 1, firstReturn, secondReturn, afterMeta, native).matched, true);
  const owner = memory(), event = owner.record({ ...observation, observation_ref: 'controlled:recolored:before' }, proposal.actions[1],
    { ...observation, observation_ref: 'controlled:recolored:after' }, firstReturn, secondReturn, proposal, 1)[0];
  assert.equal(event.native_mark_support.after_status, 'current_structural_mark_support_preserved');
  assert.equal(event.native_mark_support.measurement.axes[0].groups[2].palette_value, 77);
  assert.equal(event.native_mark_support.revalidation.after_group_palettes[0].groups[2].palette_value, 78);
  assert.notEqual(event.native_mark_support.measurement.support_ref, event.native_mark_support.plan_support_ref);
  assert.equal(event.native_mark_support.measurement.structure_ref, event.native_mark_support.revalidation.after_structure_ref);
  assert.notEqual(event.native_mark_support.revalidation.before_support_ref, event.native_mark_support.revalidation.after_support_ref);
});

test('shared checkpoint restore preserves native mark guards and rejects tampering atomically', () => {
  const family = new SharedSeriesConstraint(configuration.window_constraints.occurrence_recall, { extendedRootedMarkSupport: true });
  const later = filled(proposal.steps[0].prediction.after), after = { ...observation, observation_ref: 'controlled:shared:after' };
  family.record(observation, after, proposal.actions[0], rows, later, proposal, 0, [later]);
  const saved = family.state(), restored = new SharedSeriesConstraint(configuration.window_constraints.occurrence_recall, { extendedRootedMarkSupport: true });
  restored.restore(clone(saved)); assert.deepEqual(restored.state(), saved);
  const retained = saved.events.find((event: R) => event.kind === 'rooted_quota_state');
  assert.equal(retained.native_mark_support.after_status, 'current_structural_mark_support_preserved');
  const tampered = clone(saved); tampered.events.find((event: R) => event.kind === 'rooted_quota_state').native_mark_support.measurement.method = 'forged';
  assert.throws(() => restored.restore(tampered), /changed during recall/); assert.deepEqual(restored.state(), saved);
  const changed = clone(proposal); delete changed.rooted_quota_plan.scene.native_mark_support;
  assert.equal(restored.before(changed, 0, packet, observation).admitted, false);
});

test('a controlled changed mark return retains local refusal without certifying the reading', () => {
  const later = filled(proposal.steps[0].prediction.after); eraseUnit(later, positive(0, 2), 3);
  const owner = memory(), events = owner.record(observation, proposal.actions[0], {
    ...observation, observation_ref: 'controlled:changed-marks',
  }, rows, later, proposal, 0);
  assert.equal(events[0].native_mark_support.after_status, 'current_mark_support_changed_or_unresolved');
  assert.equal(owner.requestedStopReason, 'native_rooted_mark_support_changed');
});
