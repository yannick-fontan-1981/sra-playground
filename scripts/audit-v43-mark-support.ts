/**
 * Read-only audit of a previously executed cold campaign. This script never
 * imports a game host, creates an agent, invokes a live caller or issues a game
 * command. Pure measurement/mechanics/guard calls are analytic checks against
 * saved public packets, expressly distinct from another campaign.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { measureRootedQuota, measureRootedLengths } from '../src/logos-engine/v6-rooted-quota-observation.ts';
import { measureRootedQuotaWithMarkSupport } from '../src/logos-engine/v6-rooted-quota-mark-support.ts';
import { propagateRootedQuota, stepRootedQuota } from '../src/logos-engine/v6-rooted-quota-mechanics.ts';
import { rootedQuotaBefore, rootedQuotaAfter } from '../src/logos-engine/v6-rooted-quota-access.ts';
import { symbolicDigest as identity } from '../src/logos-engine/v6-hash.ts';

type R = Record<string, any>;
const ROOT = new URL('../', import.meta.url), SCRIPT = 'scripts/audit-v43-mark-support.ts';
const REPORT = 'docs/migration/native-campaigns-v43/ther-six-levels.json';
const TRACE = 'docs/migration/native-campaigns-v43/ther-six-level-public-trace.json.gz';
const PREVIOUS_REPORT = 'docs/migration/native-campaigns-v42/ther-four-levels.json';
const PREVIOUS_TRACE = 'docs/migration/native-campaigns-v42/ther-four-level-public-trace.json.gz';
const OUTPUT = 'docs/migration/native-campaigns-v43/ther-mark-support-audit.json';
const FIELDS = ['frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash'];
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const read = (path: string) => readFile(new URL(path, ROOT));
async function load(path: string): Promise<{ value: R; proof: R }> {
  const bytes = await read(path), unpacked = path.endsWith('.gz') ? gunzipSync(bytes) : bytes;
  return { value: JSON.parse(unpacked.toString()), proof: { path, sha256: hash(bytes), bytes: bytes.length,
    ...(path.endsWith('.gz') ? { unpackedSha256: hash(unpacked), unpackedBytes: unpacked.length } : {}) } };
}
const [current, stream, previous, previousStream] = await Promise.all([load(REPORT), load(TRACE), load(PREVIOUS_REPORT), load(PREVIOUS_TRACE)]);
const report = current.value, trace = stream.value, oldReport = previous.value, oldTrace = previousStream.value;
const packetHash = (packet: R): string => {
  assert.deepEqual(Object.keys(packet).sort(), [...FIELDS].sort());
  return hash(JSON.stringify(Object.fromEntries(FIELDS.map(field => [field, packet[field]]))));
};

// Verify the complete current source set, not just the files named by a report.
const sourceHashes: Record<string, string> = {};
async function walk(path: string): Promise<void> {
  for (const entry of await readdir(new URL(path, ROOT), { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) await walk(child);
    else if (/\.(?:ts|json|drm)$/.test(entry.name)) sourceHashes[child] = hash(await read(child));
  }
}
await walk('src/logos-engine'); await walk('src/runtime');
const orderedSource = Object.fromEntries(Object.entries(sourceHashes).sort(([a], [b]) => a.localeCompare(b, 'en')));
assert.deepEqual(orderedSource, report.source.files); assert.equal(Object.keys(orderedSource).length, report.source.fileCount);
assert.equal(hash(JSON.stringify(orderedSource)), report.source.digest); assert.equal(trace.sourceDigest, report.source.digest);
assert.equal(report.sourceUnchangedDuringRun, true); assert.deepEqual(report.pythonAgentModules, []);
const unchangedSourceModules = ['src/logos-engine/v6-rooted-quota-observation.ts', 'src/logos-engine/v6-rooted-quota-mechanics.ts'];
for (const path of unchangedSourceModules) assert.equal(report.source.files[path], oldReport.source.files[path], path);
for (const [name, expected] of Object.entries(report.gameAssets)) assert.equal(hash(await read(`public/python/${name}`)), expected, name);
assert.deepEqual(report.gameAssets, oldReport.gameAssets);

assert.equal(report.status, 'passed'); assert.equal(trace.status, 'passed'); assert.equal(report.failure, null);
assert.equal(report.final.state, 'WIN'); assert.equal(report.final.levelsCompleted, 6); assert.equal(report.final.actions, 26);
assert.equal(report.final.sessions, 1); assert.deepEqual(report.final.operationCounts, { init: 1, advance: 26, resume: 7 });
assert.equal(report.final.caller.acquiredTransitions, 26); assert.equal(report.final.fullV6Parity, false);
assert.equal(trace.packets.length, 27); assert.equal(report.actions.length, 26); assert.equal(report.prefixes.length, 8);
assert.equal(trace.packets[0].command, null); assert.equal(trace.packets[0].packet.level, 1); assert.equal(trace.packets[0].packet.levels_completed, 0);
const boundaries: R[] = [], packetHashes: string[] = [];
let previousBoundary = 0, animationFrames = 0;
for (let index = 0; index < trace.packets.length; index++) {
  const entry = trace.packets[index], packet = entry.packet;
  assert.equal(packet.step_index, index); assert.equal(hash(JSON.stringify(packet.frame_rows)).slice(0, 16), packet.frame_hash);
  const digest = packetHash(packet); packetHashes.push(digest);
  if (index === 0) { assert.equal(digest, report.initial.publicPacketSha256); continue; }
  const action = report.actions[index - 1], before = trace.packets[index - 1].packet;
  assert.equal(action.sequence, index); assert.deepEqual(action.command, entry.command);
  assert.equal(action.command.action_ref, 'ACTION6'); assert.ok(before.available_action_refs.includes(action.command.action_ref));
  assert.equal(action.publicPacketSha256, digest); assert.equal(action.frameHash, packet.frame_hash);
  assert.equal(action.animationFrames, packet.frame_packet.length); animationFrames += action.animationFrames;
  assert.deepEqual([action.levelBefore, action.completedBefore], [before.level, before.levels_completed]);
  assert.deepEqual([action.levelAfter, action.completedAfter, action.state], [packet.level, packet.levels_completed, packet.state]);
  assert.equal(action.family, 'public_occurrence_recall');
  if (packet.levels_completed > before.levels_completed) {
    assert.equal(packet.levels_completed, before.levels_completed + 1);
    boundaries.push({ completedLevel: packet.levels_completed, totalActions: index, levelActions: index - previousBoundary,
      state: packet.state, publicPacketSha256: digest }); previousBoundary = index;
  }
}
assert.deepEqual(boundaries.map(item => item.levelActions), [4, 3, 4, 4, 5, 6]);
assert.deepEqual(boundaries.map(item => [item.completedLevel, item.totalActions, item.levelActions]),
  report.boundaries.map((item: R) => [item.completedLevel, item.totalActions, item.levelActions]));
assert.ok(report.boundaries.every((item: R) => item.sessionRetained === true));
assert.equal(report.requests.filter((item: R) => item.operation === 'init').length, 1);
assert.ok(report.requests.every((item: R) => ['init', 'advance', 'resume'].includes(item.operation)));
assert.deepEqual(report.requests.filter((item: R) => item.operation === 'advance').map((item: R) => item.sequence),
  Array.from({ length: 26 }, (_, i) => i + 1));

// No projection, session rebinding or ignored field in this public comparison.
assert.equal(oldReport.actions.length, 15); assert.equal(oldTrace.packets.length, 16);
for (let index = 0; index < oldTrace.packets.length; index++) assert.deepEqual(trace.packets[index], oldTrace.packets[index]);
assert.deepEqual(report.actions.slice(0, 15).map((item: R) => item.command), oldReport.actions.map((item: R) => item.command));

const finalEvidence: string[] = report.prefixes.at(-1).sharedSeries.rootedQuotaLatestState.model.evidence;
assert.equal(finalEvidence.length, 52);
const publicRefs = [finalEvidence[0]!, ...Array.from({ length: 26 }, (_, i) => finalEvidence[i * 2 + 1]!)];
const sessionRefs = new Set<string>();
for (let i = 0; i < publicRefs.length; i++) {
  const packet = trace.packets[i].packet, match = publicRefs[i]!.match(/^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]{16})$/);
  assert.ok(match); sessionRefs.add(match[1]!);
  assert.equal(Number(match[2]), packet.level); assert.equal(Number(match[3]), i + 1); assert.equal(match[4], packet.frame_hash);
  if (i < 26) assert.equal(finalEvidence[i * 2], publicRefs[i]);
}
assert.equal(sessionRefs.size, 1);
for (const prefix of report.prefixes as R[]) {
  const end = prefix.callerAcquiredTransitions, event = prefix.sharedSeries.rootedQuotaLatestState;
  assert.equal(prefix.family, 'public_occurrence_recall'); assert.equal(prefix.fieldSubquestion, 'rooted_quota_composition');
  assert.equal(prefix.proposalKind, 'rooted_quota_experiment'); assert.deepEqual(prefix.operations, ['OP29', 'OP30', 'OP31']);
  assert.equal(prefix.sharedSeries.rootedQuotaStateCount, end); assert.equal(event.kind, 'rooted_quota_state'); assert.equal(event.stop_reason, null);
  assert.deepEqual(event.evidence, [publicRefs[end - 1], publicRefs[end]]);
  assert.deepEqual(event.model.evidence, finalEvidence.slice(0, end * 2));
  assert.match(prefix.graphChain, /^[a-f0-9]{64}$/); assert.ok(prefix.graphRevision > 0);
}

/** Independent pixel flood fill; no production component extractor is reused. */
function components(raster: number[][]): R[] {
  const height = raster.length, width = raster[0]!.length, visited = new Set<number>(), result: R[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const seed = y * width + x; if (visited.has(seed)) continue;
    const color = raster[y]![x], pending = [[x, y]], pixels: number[][] = []; visited.add(seed);
    while (pending.length) {
      const [a, b] = pending.pop()!; pixels.push([a!, b!]);
      for (const [u, v] of [[a! - 1, b!], [a! + 1, b!], [a!, b! - 1], [a!, b! + 1]]) {
        const key = v! * width + u!;
        if (u! >= 0 && u! < width && v! >= 0 && v! < height && !visited.has(key) && raster[v!]![u!] === color) {
          visited.add(key); pending.push([u!, v!]);
        }
      }
    }
    pixels.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
    result.push({ color, pixels, bbox: [Math.min(...pixels.map(p => p[0]!)), Math.min(...pixels.map(p => p[1]!)),
      Math.max(...pixels.map(p => p[0]!)), Math.max(...pixels.map(p => p[1]!))] });
  }
  return result;
}
function rectangle(raster: number[][], box: number[]): number[][] {
  const pixels: number[][] = [];
  for (let y = box[1]!; y <= box[3]!; y++) for (let x = box[0]!; x <= box[2]!; x++) pixels.push([x, y, raster[y]![x]!]);
  return pixels;
}
// Independent implementation of the public integer receipt's documented
// color-free identity, used only to verify saved evidence, never to release ACT.
function structural(value: any, field = ''): any {
  if (Array.isArray(value)) return ['pixels', 'support_pixels'].includes(field) ? value.map(p => p.slice(0, 2)) : value.map(p => structural(p));
  if (value !== null && typeof value === 'object') {
    const out: R = {};
    for (const name of Object.keys(value)) if (!['palette_value', 'palette_values', 'support_ref', 'structure_ref', 'geometry_ref'].includes(name)) out[name] = structural(value[name], name);
    return out;
  }
  return value;
}
function pixelAudit(raster: number[][], source: R, receipt: R): R {
  const parts = components(raster), axes: R[] = [];
  const body = { ...receipt }; delete body.support_ref;
  assert.equal(identity(body), receipt.support_ref); assert.equal(identity(structural(receipt)), receipt.structure_ref);
  assert.equal(receipt.source_geometry_ref, source.geometry_ref);
  assert.deepEqual(receipt.source_counts, { rows: source.row_marks, columns: source.column_marks });
  let unitPixels = 0, omittedUnits = 0;
  for (let axis = 0; axis < 2; axis++) {
    const value = receipt.axes[axis], lines = axis === 0 ? source.y_lines : source.x_lines, edge = source.bbox[axis];
    const pitch = lines[1] - lines[0], shape = source.mark_unit_shapes[axis], counts: number[] = [], omissions: R[] = [];
    assert.deepEqual(value.grid_lines, lines); assert.equal(value.grid_edge, edge); assert.equal(value.grid_pitch, pitch);
    assert.equal(value.source_band_minimum, edge - pitch); assert.deepEqual(value.unit_shape, shape);
    for (let index = 0; index < lines.length - 1; index++) {
      const mid = Math.floor((lines[index] + lines[index + 1]) / 2), group = value.groups[index];
      const candidates = parts.filter(part => part.bbox[axis + 2] < edge
        && Math.abs((part.bbox[1 - axis] + part.bbox[3 - axis]) - 2 * mid) < pitch / 2)
        .sort((a, b) => b.bbox[axis + 2] - a.bbox[axis + 2]);
      assert.equal(group.kind, 'repeated_units', 'This saved-campaign audit covers the positive units of the two new levels');
      assert.equal(group.index, index); assert.equal(group.cell_center, mid); assert.equal(candidates.length, group.count);
      assert.ok(candidates.length > 0); assert.equal(new Set(candidates.map(part => part.color)).size, 1);
      assert.equal(group.palette_value, candidates[0]!.color);
      const inside = candidates.filter(part => part.bbox[axis] >= edge - pitch), outside = candidates.filter(part => part.bbox[axis] < edge - pitch);
      assert.equal(group.source_count, inside.length); assert.equal(group.seed_unit_count, inside.length);
      assert.equal(group.count, candidates.length); counts.push(candidates.length); omittedUnits += outside.length;
      if (outside.length) omissions.push({ index, units: outside.map(part => ({ bbox: part.bbox, palette_value: part.color, pixels: part.pixels })) });
      assert.deepEqual(group.units, candidates.map(part => ({ bbox: part.bbox, palette_value: part.color, pixels: part.pixels })));
      const distances: number[] = [];
      for (const [i, part] of candidates.entries()) {
        assert.deepEqual([part.bbox[2] - part.bbox[0] + 1, part.bbox[3] - part.bbox[1] + 1], shape);
        assert.equal(part.pixels.length, shape[0] * shape[1]); unitPixels += part.pixels.length;
        distances.push(edge - part.bbox[axis + 2]);
        assert.equal(part.bbox[1 - axis] + part.bbox[3 - axis] - 2 * mid, value.transverse_offset_doubled);
        if (i > 0) assert.equal(distances[i]! - distances[i - 1]!, value.repetition_pitch);
      }
      assert.deepEqual(group.inward_distances, distances); assert.equal(distances[0], value.inward_anchor);
      const expectedBox = [Math.min(...candidates.map(part => part.bbox[0])), Math.min(...candidates.map(part => part.bbox[1])),
        Math.max(...candidates.map(part => part.bbox[2])), Math.max(...candidates.map(part => part.bbox[3]))];
      assert.deepEqual(group.support_bbox, expectedBox); assert.deepEqual(group.support_pixels, rectangle(raster, expectedBox));
      const next = [...candidates.at(-1)!.bbox]; next[axis] -= value.repetition_pitch; next[axis + 2] -= value.repetition_pitch;
      assert.ok(next[0] >= 0 && next[1] >= 0 && next[2] < raster[0]!.length && next[3] < raster.length);
      assert.deepEqual(group.outward_empty_slot, { bbox: next, pixels: rectangle(raster, next) });
      assert.ok(group.outward_empty_slot.pixels.every((p: number[]) => p[2] !== group.palette_value));
    }
    assert.deepEqual(counts, axis === 0 ? receipt.counts.rows : receipt.counts.columns);
    axes.push({ axis: value.axis, sourceCounts: axis === 0 ? source.row_marks : source.column_marks,
      fullCounts: counts, omittedBySourceBand: omissions, observedPitch: value.repetition_pitch,
      observedAnchor: value.inward_anchor, doubledAlignment: value.transverse_offset_doubled });
  }
  return { axes, unitPixels, omittedUnits, supportRef: receipt.support_ref, structureRef: receipt.structure_ref };
}

const newPrefixes: R[] = [], storedReceipts: R[] = [];
let guardedCommands = 0, nonterminalMatches = 0, excludedBoundaries = 0, independentUnitPixelChecks = 0, paletteChanges = 0;
for (let prefixIndex = 6; prefixIndex < report.prefixes.length; prefixIndex++) {
  const prefix = report.prefixes[prefixIndex], prior = report.prefixes[prefixIndex - 1], end = prefix.callerAcquiredTransitions;
  const start = end - prefix.acquiredActions, initial = trace.packets[start].packet, model = prior.sharedSeries.rootedQuotaLatestState.model;
  assert.equal(prior.callerAcquiredTransitions, start); assert.equal(prefix.decisionRevision, start + 1);
  assert.equal(model.addition_observed, true); assert.equal(model.cut_observed, true);
  assert.equal(prefix.rootedQuotaPhase, 'realize_conditional_joint_prefixes');
  const observation = { level_epoch: initial.level, levels_completed: initial.levels_completed,
    observation_ref: publicRefs[start], frame_hash: initial.frame_hash, state: initial.state, available_action_refs: initial.available_action_refs };
  const source = measureRootedQuota(initial.frame_rows, model.empty_palette), measured = measureRootedQuotaWithMarkSupport(initial.frame_rows, model.empty_palette);
  assert.ok(source); assert.equal(measured.status, 'measured'); assert.ok(measured.scene!.native_mark_support);
  const scene = measured.scene!, initialAudit = pixelAudit(initial.frame_rows, source, measured.receipt!);
  const sourceMechanical = propagateRootedQuota(source, observation, model, 300000, () => 0);
  const method = propagateRootedQuota(scene, observation, model, 300000, () => 0);
  assert.equal(method.status, 'COMPLETE'); assert.equal(method.values.all_domains_singleton, true);
  const lengths = measureRootedLengths(initial.frame_rows, scene, model); assert.ok(lengths);
  const desired = method.values.retained_domains.map((domain: number[]) => domain[0]), actions: R[] = [], steps: R[] = [];
  let working = [...lengths];
  for (const [chain, length] of desired.entries()) {
    if (length === working[chain]) continue;
    const rank = length > working[chain]! ? length - 1 : length;
    const primitive = stepRootedQuota(scene, working, chain, rank, observation, model, 300000, () => 0);
    assert.equal(primitive.status, 'COMPLETE'); const next = primitive.values.filled_lengths, point = scene.chains[chain].points[rank];
    const action = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
    actions.push(action); steps.push({ action, chain, rank, prediction: { before: working, after: next, method: primitive }, expected_after: null }); working = [...next];
  }
  assert.equal(actions.length, prefix.acquiredActions);
  assert.deepEqual(actions, report.actions.slice(start, end).map((item: R) => item.command));
  const analyticPlan = { rooted_quota_plan: { epoch: initial.level, score: initial.levels_completed,
    observation_ref: publicRefs[start], frame_digest: identity(initial.frame_rows), scene, lengths_before: lengths,
    phase: 'realize_conditional_joint_prefixes', model, method }, actions, steps };
  const checked: R[] = [];
  for (let index = 0; index < actions.length; index++) {
    const sequence = start + index + 1, before = trace.packets[sequence - 1].packet, after = trace.packets[sequence].packet;
    const currentSource = measureRootedQuota(before.frame_rows, model.empty_palette), actual = measureRootedQuotaWithMarkSupport(before.frame_rows, model.empty_palette);
    assert.ok(currentSource); assert.equal(actual.status, 'measured');
    const audit = pixelAudit(before.frame_rows, currentSource, actual.receipt!); independentUnitPixelChecks += audit.unitPixels;
    assert.equal(audit.structureRef, initialAudit.structureRef);
    assert.equal(report.actions[sequence - 1].actionIndex, index); assert.equal(report.actions[sequence - 1].decisionRevision, start + 1);
    const beforeGuard = rootedQuotaBefore(analyticPlan, index, before.frame_rows, {
      epoch: before.level, score: before.levels_completed, observation_ref: publicRefs[sequence - 1], available: before.available_action_refs,
    }, { extendedMarkSupport: true });
    assert.equal(beforeGuard.admitted, true); guardedCommands++;
    const outcome = rootedQuotaAfter(analyticPlan, index, before.frame_rows, after.frame_rows,
      { epoch: after.level, score: after.levels_completed, state: after.state }, { extendedMarkSupport: true });
    const boundary = after.levels_completed > before.levels_completed || after.level !== before.level;
    let afterSupport: R | null = null;
    if (boundary) {
      assert.deepEqual(outcome, { matched: null, seal_prefix: true, reason: 'official_boundary', official_progress: true }); excludedBoundaries++;
    } else {
      assert.equal(outcome.matched, true); assert.equal(outcome.seal_prefix, false); assert.equal(outcome.official_progress, false);
      assert.deepEqual(measureRootedLengths(after.frame_rows, scene, model), steps[index].prediction.after); nonterminalMatches++;
      const later = measureRootedQuotaWithMarkSupport(after.frame_rows, model.empty_palette); assert.equal(later.status, 'measured');
      assert.equal(later.receipt!.structure_ref, initialAudit.structureRef);
      afterSupport = { supportRef: later.receipt!.support_ref, structureRef: later.receipt!.structure_ref,
        groupPalettes: later.receipt!.axes.map((axis: R) => axis.groups.map((group: R) => group.palette_value)) };
      if (afterSupport.supportRef !== actual.receipt!.support_ref) paletteChanges++;
    }
    checked.push({ sequence, command: actions[index], beforePacketSha256: packetHashes[sequence - 1], afterPacketSha256: packetHashes[sequence],
      beforeSupportRef: actual.receipt!.support_ref, structureRef: actual.receipt!.structure_ref,
      currentGroupPalettes: actual.receipt!.axes.map((axis: R) => axis.groups.map((group: R) => group.palette_value)),
      beforeGuard, outcome, afterSupport, attribution: boundary ? 'official_boundary_excluded' : 'conditional_prefix_and_structural_support_matched' });
  }
  const retained = prefix.sharedSeries.rootedQuotaLatestState.native_mark_support, beforeLast = trace.packets[end - 1].packet;
  assert.ok(retained); const actualLast = measureRootedQuotaWithMarkSupport(beforeLast.frame_rows, model.empty_palette);
  assert.equal(actualLast.status, 'measured'); assert.deepEqual(retained.measurement, actualLast.receipt);
  assert.deepEqual(retained.evidence, [publicRefs[end - 1], publicRefs[end]]);
  assert.equal(retained.plan_support_ref, measured.receipt!.support_ref);
  assert.equal(retained.before_status, 'current_structural_mark_support_measured');
  assert.equal(retained.after_status, 'official_boundary_excluded_from_mark_attribution');
  assert.deepEqual(retained.revalidation, { after_group_palettes: null, after_structure_ref: null, after_support_ref: null,
    before_support_ref: actualLast.receipt!.support_ref });
  assert.notEqual(retained.measurement.support_ref, retained.plan_support_ref, 'Actual before colors are not mislabeled as the initial plan colors');
  storedReceipts.push({ prefixId: prefix.id, acquiredAtAction: end, beforePacketIndex: end - 1,
    beforePacketSha256: packetHashes[end - 1], evidence: retained.evidence,
    planSupportRef: retained.plan_support_ref, actualBeforeSupportRef: retained.measurement.support_ref,
    structureRef: retained.measurement.structure_ref, afterStatus: retained.after_status,
    scope: 'This exact acquired latest-state receipt is exported by the original campaign and verified against its actual before packet.' });
  newPrefixes.push({ prefixId: prefix.id, level: initial.level, initialPacketIndex: start, finalAction: end,
    acquiredActions: prefix.acquiredActions, acquiredModelEvidence: { additionObserved: model.addition_observed,
      cutObserved: model.cut_observed, sourceEventAtAction: prior.callerAcquiredTransitions, evidenceRefCount: model.evidence.length },
    sourceMeasurement: { rows: source.row_marks, columns: source.column_marks, geometryRef: source.geometry_ref },
    fullSupportMeasurement: { rows: scene.row_marks, columns: scene.column_marks, geometryRef: scene.geometry_ref, ...initialAudit },
    sourceMechanical: { status: sourceMechanical.status, cause: sourceMechanical.cause, allDomainsSingleton: sourceMechanical.values.all_domains_singleton },
    nativeMechanical: { status: method.status, cause: method.cause, allDomainsSingleton: method.values.all_domains_singleton, desiredLengths: desired },
    checkedPublicTransitions: checked,
    qualification: 'Analytic plan and guard reconstruction on saved inputs, not a new caller/game execution or a claim that all intermediate Kernel event payloads were exported.' });
}
assert.equal(guardedCommands, 11); assert.equal(nonterminalMatches, 9); assert.equal(excludedBoundaries, 2); assert.equal(storedReceipts.length, 2);
const result: R = { schema: 'logos-engine.native-mark-support-saved-public-audit.v1', status: 'passed',
  generator: SCRIPT, generatorSha256: hash(await read(SCRIPT)),
  scope: 'Read-only audit of the saved real campaign. Independent raw-pixel component/count checks plus pure measurement/mechanics/guard calls; no new game, agent, caller or action.',
  inputs: { campaign: current.proof, publicTrace: stream.proof, previousCampaign: previous.proof, previousPublicTrace: previousStream.proof },
  nativeSource: { verifiedFileCount: report.source.fileCount, digest: report.source.digest,
    sourceUnchangedDuringRecordedRun: report.sourceUnchangedDuringRun, sourceFilesMatchRecordedRun: true, files: orderedSource },
  faithfulSourceSeparation: { unchangedComparedWithV42: Object.fromEntries(unchangedSourceModules.map(path => [path, orderedSource[path]])),
    unchangedGameAssetHashes: report.gameAssets, pureComponentCallsOnly: true, fullV6Parity: false,
    qualification: 'The faithful observation and propagation modules are byte-identical to v42. Wider mark support and its guards are explicitly native. This audit does not execute or establish full Python-caller parity.' },
  recordedCampaign: { game: report.game, commands: report.actions.length, fullPublicPackets: trace.packets.length,
    animationFrames, sessions: report.final.sessions, officialFinalState: report.final.state, levelsCompleted: report.final.levelsCompleted,
    acquiredPrefixes: report.prefixes.length, callerAcquiredTransitions: report.final.caller.acquiredTransitions,
    boundaryReplays: report.final.caller.boundaryReplays, pythonAgentModules: report.pythonAgentModules, boundaries },
  previousTrajectory: { exactCommands: 15, exactFullPublicPackets: 16, ignoredFields: [], normalizationApplied: false,
    publicActionDomainsCompared: true, framePacketsCompared: true },
  extensionAudit: { newPrefixes: 2, publicCommandsChecked: guardedCommands, nonterminalGuardMatches: nonterminalMatches,
    officialBoundariesExcludedFromAttribution: excludedBoundaries, independentlyCheckedUnitPixels: independentUnitPixelChecks,
    wholeSeriesRecoloringTransitions: paletteChanges, distinctInitialOmittedUnits: newPrefixes.reduce((sum, prefix) => sum + prefix.fullSupportMeasurement.omittedUnits, 0),
    directlyExportedAcquiredSupportReceiptsVerified: storedReceipts.length, storedReceipts,
    evidenceLimit: 'The report exports the latest rooted state at each prefix. The two expanded-prefix boundary receipts are directly verified. Nine intermediate outcomes are checked analytically against actual public packets; their complete acquired event payloads are not separately exported.' },
  newPrefixes,
  nextRemainingPerceptionLimit: 'The extension still requires the source grid/chain/unit seed. An unavailable seed, clipped outward slot, gapped or competing series, mixed colors within a series or ambiguous ownership remains a refusal. Six successful levels do not establish universal mark semantics or handling of arbitrary numeral formats.',
};
await mkdir(new URL('docs/migration/native-campaigns-v43/', ROOT), { recursive: true });
await writeFile(new URL(OUTPUT, ROOT), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output: OUTPUT, status: result.status, verifiedSourceFiles: report.source.fileCount,
  first15CommandsAnd16FullPacketsExact: true, commands: 26, officialWin: true, guardedNewCommands: guardedCommands,
  nonterminalMatches, excludedBoundaries, directlyVerifiedAcquiredReceipts: storedReceipts.length,
  initialOmittedUnits: result.extensionAudit.distinctInitialOmittedUnits, paletteChanges,
  perLevelCounts: newPrefixes.map(prefix => ({ level: prefix.level, source: prefix.sourceMeasurement,
    extended: { rows: prefix.fullSupportMeasurement.rows, columns: prefix.fullSupportMeasurement.columns } })) }, null, 2));
