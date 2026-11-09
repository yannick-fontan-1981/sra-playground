#!/usr/bin/env node
/** Reproduce the published V59 component gap without modifying that checkout.
 * Usage: node scripts/prove-native-parent-scope-gap.mjs BASELINE_ROOT OUTPUT.json [EXTENSION_ROOT]
 * The optional extension is a separate parent-binding contract over the same
 * acquired returns. Neither branch is a common-runtime or live-game campaign.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const SCRIPT = fileURLToPath(import.meta.url), PROJECT = resolve(dirname(SCRIPT), '..');
const BASE_COMMIT = 'f7b9a56af5488c8d4cebd5d912262a541f4fe403';
const SOURCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const INPUTS = ['tests/fixtures/v6-typed-material-original-public.json.gz', `${SOURCE}/morphology_policy/strategy.drm`];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value);
const load = (root, name) => import(pathToFileURL(resolve(root, name)).href);
const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
async function fingerprint(root, name) {
  const bytes = await readFile(resolve(root, name));
  return { path: name, bytes: bytes.length, sha256: sha(bytes) };
}
async function nativeInventory(root) {
  const names = [];
  async function walk(folder) {
    for (const item of await readdir(resolve(root, folder), { withFileTypes: true })) {
      const name = `${folder}/${item.name}`;
      if (item.isDirectory()) await walk(name);
      else if (item.isFile() && /\.(ts|json|drm)$/.test(item.name)) names.push(name);
    }
  }
  for (const folder of ['src/logos-engine', 'src/runtime']) await walk(folder);
  const files = {};
  for (const name of names.sort()) files[name] = sha(await readFile(resolve(root, name)));
  return { fileCount: names.length, digest: sha(JSON.stringify(files)), files };
}
function relocateRequest(packet, target) {
  const rows = copy(packet.frame_rows), counts = new Map();
  for (const row of rows) for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
  const background = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const [left, top, right, bottom] = target.bbox, width = right - left + 1, height = bottom - top + 1;
  let destination = null;
  for (let y = 1; y < rows.length - height - 1 && !destination; y++) {
    for (let x = 1; x < rows[0].length - width - 1 && !destination; x++) {
      let empty = true;
      for (let v = y - 1; v <= y + height; v++) for (let u = x - 1; u <= x + width; u++) if (rows[v][u] !== background) empty = false;
      if (empty) destination = [x, y];
    }
  }
  assert.ok(destination, 'The measured public raster must contain an empty area for the counterfactual request relocation');
  const request = rows.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) rows[y][x] = background;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows[destination[1] + y][destination[0] + x] = request[y][x];
  return { rows, destination, background };
}

const [baselineArgument, outputArgument, extensionArgument] = process.argv.slice(2);
if (!baselineArgument || !outputArgument || process.argv.length > 5) throw new Error('Usage: prove-native-parent-scope-gap.mjs BASELINE_ROOT OUTPUT.json [EXTENSION_ROOT]');
const baselineRoot = resolve(baselineArgument), output = resolve(PROJECT, outputArgument);
const extensionRoot = extensionArgument ? resolve(extensionArgument) : null;
assert.ok(relative(baselineRoot, output).startsWith('..'), 'Evidence must be written outside the immutable baseline checkout');
try { await access(output); throw new Error('Evidence already exists; refusing overwrite'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.equal(git(baselineRoot, ['rev-parse', 'HEAD']), BASE_COMMIT);
const nativeStatusBefore = git(baselineRoot, ['status', '--porcelain', '--untracked-files=all', '--', 'src/logos-engine', 'src/runtime']);
assert.equal(nativeStatusBefore, '', 'The published baseline native source must be clean');
const sourceBefore = await nativeInventory(baselineRoot);
const generator = { path: relative(PROJECT, SCRIPT), sha256: sha(await readFile(SCRIPT)) };
const inputs = await Promise.all(INPUTS.map(name => fingerprint(baselineRoot, name)));
const extensionBefore = extensionRoot ? await nativeInventory(extensionRoot) : null;

const { SharedSeriesConstraint } = await load(baselineRoot, 'src/logos-engine/v6-shared-series.ts');
const { ObservedInputDomain, measureNativeObservation, publicFrameHash } = await load(baselineRoot, 'src/logos-engine/v6-native-observer.ts');
const { CompositionTargetTree } = await load(baselineRoot, 'src/logos-engine/v6-target-binding.ts');
const { proposedTypedMaterialInquiryWitness } = await load(baselineRoot, 'src/logos-engine/v6-typed-material-evidence.ts');
const { typedMaterialRequests } = await load(baselineRoot, 'src/logos-engine/v6-typed-material-observation.ts');
const fixture = JSON.parse(gunzipSync(await readFile(resolve(baselineRoot, INPUTS[0]))));
const strategy = JSON.parse(await readFile(resolve(baselineRoot, INPUTS[1])));
const cfg = strategy.declarations[0].configuration.window_constraints;
const family = new SharedSeriesConstraint(cfg.occurrence_recall);
assert.equal(family.material.currentState().pose_events.length, 0, 'Cold component has no imported pose knowledge');
let packetIndex = 0, selected = null;
const prefixReceipts = [];
for (const [prefixIndex, prefix] of fixture.prefixes.entries()) {
  if (prefixIndex >= 34) break;
  const row = fixture.packets[packetIndex], domain = new ObservedInputDomain(4096);
  const proposal = await family.materialPropose(row.observation, row.packet.frame_rows, domain.candidates(row.observation), 600, cfg.typed_material_flow);
  assert.ok(proposal); assert.deepEqual(proposal.actions, prefix.proposal.actions, 'Check archived commands only after the cold component computes its proposal');
  family.bind(proposal, domain);
  if (proposal.material_pose_plan?.mode === 'select') selected = { proposal: copy(proposal), beforeState: family.material.currentState(), before: copy(row), returns: [] };
  for (const [index, command] of proposal.actions.entries()) {
    const before = fixture.packets[packetIndex], after = fixture.packets[++packetIndex];
    assert.deepEqual(command, after.command);
    assert.equal(family.before(proposal, index, before.packet, before.observation).admitted, true);
    const outcome = family.after(proposal, index, before.observation, after.observation, before.packet.frame_rows, after.packet.frame_rows);
    const record = family.record(before.observation, after.observation, copy(command), before.packet.frame_rows, after.packet.frame_rows, proposal, index, after.packet.frame_packet);
    if (selected?.proposal.proposal_id === proposal.proposal_id) selected.returns.push({
      state: family.material.currentState(), record: copy(record),
      transition: { command: copy(command), before: copy(before.observation), after: copy(after.observation), first: copy(before.packet), second: copy(after.packet), index, outcome: copy(outcome) },
    });
  }
  prefixReceipts.push({ prefix: prefixIndex + 1, proposal: proposal.proposal_id, kind: proposal.kind, actions: proposal.actions.length, lastPacket: packetIndex });
}
assert.equal(prefixReceipts.length, 34); assert.ok(selected); assert.equal(selected.returns.length, 1);
assert.equal(packetIndex, 34, 'This retained reference prefix has 34 public actions');
const original = fixture.packets[packetIndex], stateBeforeForeign = family.material.currentState();
const priorTarget = copy(selected.proposal.material_pose_plan.option.target);
const originalDomain = new ObservedInputDomain(4096);
const currentControl = await family.materialPropose(original.observation, original.packet.frame_rows, originalDomain.candidates(original.observation), 600, cfg.typed_material_flow);
assert.equal(currentControl?.material_pose_plan?.mode, 'control');
family.bind(currentControl, originalDomain);
assert.equal(family.before(currentControl, 0, original.packet, original.observation).admitted, true);
const foreignCommand = copy(currentControl.actions[0]);
assert.equal(foreignCommand.action_ref, 'ACTION6'); assert.ok(original.observation.available_action_refs.includes(foreignCommand.action_ref));
const { rows, destination, background } = relocateRequest(original.packet, priorTarget);
const changedPacket = { ...copy(original.packet), step_index: original.packet.step_index + 1,
  frame_rows: rows, frame_hash: await publicFrameHash(rows), frame_packet: [copy(rows)] };
const changedObs = await measureNativeObservation(changedPacket, original.observation.revision + 1, 'counterfactual-public-foreign-return');
// The actual current candidate supplies an available, measured command. An
// empty selected-family proposal deliberately exercises only passive record;
// the relocated raster is not claimed to be an observed effect of that command.
const passive = family.record(original.observation, changedObs, foreignCommand, original.packet.frame_rows, rows, {}, 0, [rows]);
const stateAfterForeign = family.material.currentState();
assert.deepEqual(stateAfterForeign, stateBeforeForeign, 'Passive foreign acquisition must not manufacture a selected pose return');
const domain = new ObservedInputDomain(4096);
const proposal = await family.materialPropose(changedObs, rows, domain.candidates(changedObs), 600, cfg.typed_material_flow);
assert.ok(proposal?.material_pose_plan); family.bind(proposal, domain);
const guard = family.before(proposal, 0, changedPacket, changedObs);
const witness = proposedTypedMaterialInquiryWitness(family.material.currentState(), proposal, changedObs, rows);
const target = new CompositionTargetTree().bind(proposal, changedObs, { id: 'G_official_completion' });
assert.notEqual(priorTarget.id, proposal.material_pose_plan.option.target.id);
assert.deepEqual(priorTarget.descriptor, proposal.material_pose_plan.option.target.descriptor);
assert.equal(guard.admitted, true); assert.ok(witness); assert.equal(target.admitted, true);
assert.equal(target.retained_target, null); assert.equal(target.reason, 'independent_current_contribution');
const poseReturns = state => state.pose_events.filter(event => event.kind === 'typed_pose_response').length;
assert.equal(poseReturns(stateAfterForeign), poseReturns(stateBeforeForeign));

let extensionContract = null;
if (extensionRoot) {
  const { AttentionMemory } = await load(extensionRoot, 'src/logos-engine/v6-attention-memory.ts');
  const { retainTypedMaterialParent, consumeTypedMaterialParent, recordTypedMaterialParent, revalidateTypedMaterialParent } = await load(extensionRoot, 'src/logos-engine/v6-typed-material-composition.ts');
  const attention = new AttentionMemory(), selectedProposal = copy(selected.proposal);
  const retained = await retainTypedMaterialParent(attention, copy(selected.beforeState), selectedProposal, selected.before.observation, selected.before.packet.frame_rows);
  assert.equal(retained?.admitted, true);
  assert.equal(consumeTypedMaterialParent(attention, copy(selected.beforeState), selectedProposal, selected.before.observation, selected.before.packet.frame_rows)?.admitted, true);
  for (const actual of selected.returns) recordTypedMaterialParent(attention, copy(actual.state), selectedProposal, copy(actual.transition), copy(actual.record));
  const parentBefore = copy(attention.composition);
  assert.equal(parentBefore.target_ref, priorTarget.id); assert.equal(parentBefore.status, 'pending');
  const transition = { command: copy(foreignCommand), before: copy(original.observation), after: copy(changedObs),
    first: copy(original.packet), second: copy(changedPacket), index: 0, outcome: { matched: null, seal_prefix: true, reason: 'counterfactual_foreign_component_return' } };
  const foreign = recordTypedMaterialParent(attention, copy(stateAfterForeign), {}, transition, copy(passive));
  const revalidated = revalidateTypedMaterialParent(attention, copy(stateAfterForeign), changedObs, rows);
  assert.equal(foreign?.admitted, false); assert.equal(foreign?.decision, 'suspend');
  assert.equal(revalidated?.admitted, false); assert.equal(attention.composition.id, parentBefore.id);
  assert.equal(attention.composition.target_ref, priorTarget.id); assert.equal(attention.composition.binding.phase, 'suspended');
  extensionContract = { qualification: 'Separate coordination contract using baseline-acquired component states and the identical counterfactual foreign return; no current common runtime, fresh game, or second domain reducer is executed.',
    nativeSource: extensionBefore, parentBefore, foreignReceipt: foreign, nextRevalidation: revalidated, parentAfter: copy(attention.composition),
    parentIdentityRetained: true, resumptionRefused: true, domainRecordCalls: 0 };
}
assert.deepEqual(await nativeInventory(baselineRoot), sourceBefore, 'Baseline native source changed during diagnosis');
assert.equal(git(baselineRoot, ['rev-parse', 'HEAD']), BASE_COMMIT);
assert.equal(git(baselineRoot, ['status', '--porcelain', '--untracked-files=all', '--', 'src/logos-engine', 'src/runtime']), nativeStatusBefore);
for (const input of inputs) assert.deepEqual(await fingerprint(baselineRoot, input.path), input);
assert.equal(sha(await readFile(SCRIPT)), generator.sha256, 'Diagnostic harness changed during execution');
if (extensionRoot) assert.deepEqual(await nativeInventory(extensionRoot), extensionBefore, 'Extension native source changed during the separate contract');
const report = { schema: 'logos-engine.lot1.parent-scope-gap.v1', status: 'passed', recordedAt: new Date().toISOString(),
  generator, environment: { node: process.version }, inputs, baseline: { commit: BASE_COMMIT, nativeSource: sourceBefore,
    nativeSourceClean: true, nativeSourceUnchanged: true, inputFilesUnchanged: true, coldComponent: true,
    acquiredPrefixes: prefixReceipts.length, acquiredPublicActions: packetIndex, prefixReceipts,
    priorTarget, counterfactual: { qualification: 'One invented public raster return of a foreign proposal. Its available command is copied from the currently measured and admitted pose control, but the relocation is not asserted to be that command\'s real effect.',
      command: foreignCommand, commandSourceProposal: currentControl.proposal_id, commandAvailable: true, commandGuardAdmitted: true,
      relocatedTo: destination, observedBackground: background, beforePacket: copy(original.packet), afterPacket: changedPacket, beforeObservation: copy(original.observation), afterObservation: changedObs },
    currentTargets: typedMaterialRequests(rows, changedObs).map(value => ({ id: value.id, bbox: value.bbox, descriptor: value.descriptor })),
    selectedPoseReturnCountBefore: poseReturns(stateBeforeForeign), selectedPoseReturnCountAfter: poseReturns(stateAfterForeign),
    materialStateUnchangedByForeignReturn: true, foreignEventKinds: passive.events.map(event => event.kind),
    next: { proposal: proposal.proposal_id, mode: proposal.material_pose_plan.mode, reason: proposal.material_pose_plan.reason,
      target: proposal.material_pose_plan.option.target, guard, witnessAccepted: Boolean(witness), compositionTarget: target },
    parentSilentlyChanged: true }, extensionContract,
  qualifications: ['The baseline executes only the immutable published V59 native component source. Thirty-four prefixes are acquired from complete archived public packets, with expected commands checked after each independently computed proposal.',
    'This is a bounded component ablation: it establishes a changed requested occurrence with an admitted component guard and no new acquired pose event. It does not establish a released common-runtime action or a live-game failure.',
    'Coordinates, colors and the empty relocation area are derived from the supplied public raster only; none is a solver rule. The one counterfactual packet is clearly separated from the preceding recorded returns.',
    'The optional parent contract consumes the same acquired states and foreign packet without invoking a material reducer again. Native source inventories, inputs and the generator are checked before and after execution.'] };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, output: relative(PROJECT, output), baselineCommit: BASE_COMMIT,
  acquiredPrefixes: report.baseline.acquiredPrefixes, parentSilentlyChanged: true,
  componentGuardAdmitted: guard.admitted, selectedPoseReturnCountBefore: report.baseline.selectedPoseReturnCountBefore,
  selectedPoseReturnCountAfter: report.baseline.selectedPoseReturnCountAfter, extensionResumptionRefused: extensionContract?.resumptionRefused ?? null }));
