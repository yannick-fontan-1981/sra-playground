/** Recalculate one already recorded native return without a game host or dispatch. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';

const ROOT = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, ROOT));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const proof = async path => { const bytes = await read(path); return { path, sha256: sha(bytes), bytes: bytes.length }; };
const tracePath = process.argv[2] ?? 'docs/migration/native-campaigns-v50/life-public-trace.json.gz';
const trace = JSON.parse(gunzipSync(await read(tracePath)));
assert.equal(trace.packets.length, 2);
const manifestPath = 'docs/migration/native-campaigns-v50/source-manifest.json';
const manifest = JSON.parse(await read(manifestPath));
const verify = async () => {
  for (const [path, expected] of Object.entries(manifest.files)) assert.equal(sha(await read(path)), expected, path);
  return { fileCount: Object.keys(manifest.files).length, digest: manifest.digest };
};
const sourceBefore = await verify();
assert.equal(manifest.digest, trace.sourceDigest);
const reference = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: JSON.parse(await read(reference + 'laya_proto/common_frontier_policy.drm.json')),
  strategy: JSON.parse(await read(reference + 'morphology_policy/strategy.drm')) };
const cfg = declarations.strategy.declarations[0].configuration.window_constraints;
const execution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
const family = runtime.families.find(f => f.id === 'public_occurrence_recall');
const contact = runtime.families.find(f => f.id === 'animated_contact');
assert.ok(family && contact);
const inspect = id => {
  const graph = runtime.inspectKnowledge();
  return hydrateNativeState(graph.nodes[id].value, key => graph.nodes[key].value);
};
const compact = result => ({ kind: result.kind, reason: result.reason, command: result.command ?? null,
  selected: result.snapshot.lastDecision, actions: result.snapshot.actions, levelsCompleted: result.snapshot.levelsCompleted,
  callerAcquiredTransitions: result.snapshot.caller.acquiredTransitions,
  selection: result.snapshot.proposal?.strategy_receipt?.selected ?? null });
let result = await runtime.initialize({ sessionId: 'anonymous-material-cold-path-diagnostic', observation: trace.packets[0].packet,
  budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
assert.equal(result.kind, 'action'); assert.deepEqual(result.command, trace.packets[1].command);
const initial = compact(result), beforeObservation = structuredClone(runtime.observation), beforeOwner = structuredClone(family.state());
const beforeStopReason = await family.requestedStopReason(beforeObservation);
result = await runtime.advance({ command: result.command, executionMs: 0, observation: trace.packets[1].packet }, execution);
const boundary = compact(result), afterObservation = structuredClone(runtime.observation), afterOwner = structuredClone(family.state());
assert.equal(result.kind, 'boundary');
result = await runtime.resume(execution);
const stopped = compact(result), afterStopReason = await family.requestedStopReason(afterObservation);
const ownStateUnchangedOnResume = JSON.stringify(afterOwner) === JSON.stringify(family.state());
const contactScope = inspect('native_contact_probe_scope:animated_contact');
const contactState = structuredClone(contact.state());
const domain = new ObservedInputDomain(4096), inputs = domain.candidates(afterObservation);
const contactRefusal = await contact.propose(afterObservation, trace.packets[1].packet.frame_rows, inputs, 599, execution);

async function materialOffer(ownerState, packet, observation, remaining) {
  const restored = new SharedSeriesConstraint(cfg.occurrence_recall); restored.restoreNative(ownerState);
  const before = structuredClone(restored.material.currentState()), localDomain = new ObservedInputDomain(4096);
  const proposal = await restored.materialPropose(observation, packet.frame_rows, localDomain.candidates(observation), remaining, cfg.typed_material_flow);
  assert.ok(proposal); restored.bind(proposal, localDomain);
  const guard = restored.before(proposal, 0, packet, observation);
  const pointGuard = await ObservedInputDomain.pointGuard(packet, proposal.actions[0], proposal.steps[0]);
  return { proposalKind: proposal.kind, reason: proposal.question.reason, actions: proposal.actions,
    guard, pointGuard, requestedStopReason: restored.material.requestedStopReason,
    retainedOwnState: before, retainedOwnStateUnchangedByProposal: JSON.stringify(before) === JSON.stringify(restored.material.currentState()),
    fullStateDigestUnchangedByProposal: ownerState.digest === restored.state().digest,
    scope: 'Proposal reconstructed from the actually acquired common-owner journal, after supplying the current source configuration. Never submitted to the runtime or game.' };
}
const beforeOffer = await materialOffer(beforeOwner, trace.packets[0].packet, beforeObservation, 600);
const afterOffer = await materialOffer(afterOwner, trace.packets[1].packet, afterObservation, 599);
const first = trace.packets[0].packet, last = trace.packets[1].packet;
const frameChanges = last.frame_packet.map((rows, index) => {
  const changes = rows.flatMap((row, y) => row.flatMap((v, x) => first.frame_rows[y][x] === v ? [] : [[x, y, first.frame_rows[y][x], v]]));
  return { index, changedPixels: changes.length, bbox: changes.length ? [Math.min(...changes.map(p => p[0])), Math.min(...changes.map(p => p[1])),
    Math.max(...changes.map(p => p[0])), Math.max(...changes.map(p => p[1]))] : null, changes };
});
const report = { schema: 'logos-engine.v50.material-cold-path-diagnostic.v1', status: 'passed',
  inputs: { publicTrace: await proof(tracePath), nativeSourceManifest: await proof(manifestPath) },
  sourceBefore, sourceAfter: await verify(), sessions: 1, realRecordedReturnsReplayed: 1, newGameHostRuns: 0, dispatchedActions: 0,
  initial, boundary, stopped, beforeStopReason, afterStopReason, ownStateUnchangedOnResume,
  finalRasterRestored: JSON.stringify(first.frame_rows) === JSON.stringify(last.frame_rows),
  publicProtocolUnchanged: ['level', 'levels_completed', 'state', 'available_action_refs'].every(key => JSON.stringify(first[key]) === JSON.stringify(last[key])),
  frameChanges, contactScope, contactState, contactRefusal,
  material: { beforeOffer, afterOffer }, windowGroup: runtime.groups.find(group => group.id === 'window_constraints'),
  observedSelectionTrace: runtime.trace.filter(event => ['proposal', 'before_guard', 'why_act_release', 'stop', 'native_coordination'].includes(event.kind)),
  conclusion: 'The selected animated-contact invitation acquired a transient public response and no contact model. Its following source refusal blocks unrelated probes. The current stationary-refusal scope rejects this trace because one intermediate frame differs, even though the final raster and protocol are restored. The material inquiry is still available with current guards from the real common-owner memory; it has not acquired any carrier/flow/pose event. No selection or game action was overridden.',
  qualification: 'The final displayed raster is restored; this does not assert equality of hidden game state. The diagnostic does not establish that choosing another question will complete a level.',
  generator: await proof('scripts/diagnose-v50-material-cold-path.mjs') };
const output = 'docs/migration/native-campaigns-v50/diagnostics/material-cold-path.json';
await writeFile(new URL(output, ROOT), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, status: report.status, stopped, contactRefusal, contactScope: contactScope.status,
  materialBefore: beforeOffer.actions, materialAfter: afterOffer.actions, ownMaterialEvents: afterOffer.retainedOwnState.carrier_events.length,
  currentGuard: afterOffer.guard, pointGuard: afterOffer.pointGuard, sourceUnchanged: true }));
