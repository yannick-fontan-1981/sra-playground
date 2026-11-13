#!/usr/bin/env node
/** Baseline ablation driven exclusively by retained public observations.
 * Usage: node scripts/prove-native-parent-ablation.mjs RUNTIME_CHECKOUT OUTPUT.json [QUARTER_TURNS=3]
 * The runtime is imported from the explicit, clean checkout. The current test
 * helper only supplies public packets, checks commands after native choice,
 * and rotates the measured child's public raster for one controlled return.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [runtimeArgument, outputArgument, turnsArgument = '3'] = process.argv.slice(2);
assert.ok(runtimeArgument && outputArgument, 'Provide a clean runtime checkout and a new evidence path');
const runtimeRoot = resolve(runtimeArgument), output = resolve(outputArgument), turns = Number(turnsArgument);
assert.ok([1, 2, 3].includes(turns), 'Controlled return requires one, two or three quarter turns');
try { await access(output); throw new Error('Refusing to replace existing evidence'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const sha = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: runtimeRoot, encoding: 'utf8' }).trim();
const sourceHead = git('rev-parse', 'HEAD');
assert.equal(git('diff', 'HEAD', '--name-only', '--', 'src/logos-engine', 'src/runtime'), '', 'Runtime source must be clean');
async function fingerprint(path, root = ROOT) {
  const bytes = await readFile(resolve(root, path));
  return { path, bytes: bytes.length, sha256: sha(bytes) };
}
async function nativeInventory() {
  const names = [];
  async function walk(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, item.name);
      if (item.isDirectory()) await walk(full);
      else if (item.isFile() && /\.(ts|json|drm)$/.test(item.name)) names.push(relative(runtimeRoot, full));
    }
  }
  for (const folder of ['src/logos-engine', 'src/runtime']) await walk(resolve(runtimeRoot, folder));
  const files = {};
  for (const name of names.sort()) files[name] = sha(await readFile(resolve(runtimeRoot, name)));
  return { fileCount: names.length, digest: sha(JSON.stringify(files)), files };
}
const sourceBefore = await nativeInventory(), generator = await fingerprint(relative(ROOT, fileURLToPath(import.meta.url)));
const reference = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const publicInputs = [
  `${reference}/laya_proto/common_frontier_policy.drm.json`, `${reference}/morphology_policy/strategy.drm`,
  'docs/migration/native-campaigns-v50/life-public-trace-final.json.gz',
  'tests/fixtures/v6-typed-material-original-public.json.gz',
];
const helperPaths = ['tests/helpers/native-composition-loop.ts', 'tests/helpers/native-composition-component.ts',
  'src/logos-engine/v6-native-observer.ts', 'src/logos-engine/v6-typed-material-observation.ts'];
const inputsBefore = await Promise.all([...publicInputs, ...helperPaths].map(path => fingerprint(path)));
for (const path of [...publicInputs, ...helperPaths.slice(2)]) {
  assert.deepEqual(await fingerprint(path), await fingerprint(path, runtimeRoot), `Public input/helper primitive differs from runtime checkout: ${path}`);
}
const { createNativeV6Runtime } = await import(pathToFileURL(resolve(runtimeRoot, 'src/logos-engine/v6-native-runtime.ts')).href);
const { CommonMaterialReplay, copy, materialPublicTrace, MATERIAL_OWNER, MATERIAL_EVENT_KINDS } = await import('../tests/helpers/native-composition-loop.ts');
const { rotatedReturn } = await import('../tests/helpers/native-composition-component.ts');
const startedAt = new Date().toISOString();
const driver = await CommonMaterialReplay.cold(`lot1-baseline-ablation-${turns}-quarter-turns`, createNativeV6Runtime);
const commands = [];
function state() {
  const proposal = copy(driver.result.snapshot.proposal ?? {});
  return { packetIndex: driver.packetIndex, kind: driver.result.kind, reason: driver.result.reason ?? null,
    actions: driver.result.snapshot.actions, levelsCompleted: driver.result.snapshot.levelsCompleted,
    target: proposal.material_pose_plan?.option?.target ?? proposal.material_flow_plan?.target ?? null,
    parent: driver.attention() ?? null, command: copy(driver.result.command ?? null),
    authorization: copy(driver.result.authorization ?? null), proposal,
    caller: copy(driver.result.snapshot.caller) };
}
for (let i = 0; ; i++) {
  assert.ok(i < materialPublicTrace.packets.length, 'No unknown pose control in the complete public trace');
  await driver.ready();
  assert.equal(driver.result.kind, 'action', driver.result.reason ?? 'Expected an actual released command');
  const proposal = driver.result.snapshot.proposal;
  if (proposal.material_pose_plan?.mode === 'control' && proposal.material_pose_plan.rule === null) break;
  commands.push({ action: driver.packetIndex + 1, command: copy(driver.result.command),
    authorizationPresent: Boolean(driver.result.authorization), returnKind: 'recorded_public_packet' });
  await driver.recorded();
  if (driver.packetIndex % 10 === 0) console.log(JSON.stringify({ phase: 'cold-public-replay', actions: driver.packetIndex }));
}
const before = state();
assert.equal(before.parent, null, 'This ablation must run the source with no retained material parent');
const originalPacket = copy(materialPublicTrace.packets[driver.packetIndex].packet);
const alternative = await rotatedReturn(originalPacket, before.proposal.material_pose_plan.child, turns);
assert.equal(alternative.levels_completed, originalPacket.levels_completed);
const materialBefore = driver.retained(MATERIAL_OWNER).events.filter(event => MATERIAL_EVENT_KINDS.has(event.kind));
commands.push({ action: driver.packetIndex + 1, command: copy(driver.result.command),
  authorizationPresent: Boolean(driver.result.authorization), returnKind: 'controlled_public_raster', quarterTurns: turns });
await driver.returned(alternative);
const afterReturn = state();
assert.equal(afterReturn.parent, null);
const materialAfter = driver.retained(MATERIAL_OWNER).events.filter(event => MATERIAL_EVENT_KINDS.has(event.kind));
await driver.ready();
const next = state();
assert.equal(next.parent, null);
const sourceAfter = await nativeInventory();
assert.deepEqual(sourceAfter, sourceBefore, 'Runtime source changed during ablation');
assert.deepEqual(await Promise.all([...publicInputs, ...helperPaths].map(path => fingerprint(path))), inputsBefore,
  'Public input or helper changed during ablation');
assert.deepEqual(await fingerprint(relative(ROOT, fileURLToPath(import.meta.url))), generator, 'Ablation generator changed');
const result = {
  schema: 'logos-engine.lot1.native-parent-ablation.v1', status: 'observed', startedAt, completedAt: new Date().toISOString(),
  sourceHead, nativeSource: sourceBefore, generator, inputs: inputsBefore,
  qualification: 'Cold full common runtime from the explicit clean baseline checkout. All preparation packets are recorded public returns; expected commands are checked only after native choice. The final raster rotation is a controlled counterfactual public return, not a live game result. No game host, hidden state, learned-state injection, target override or decision override is used.',
  runtimeCheckout: runtimeRoot, preparationActions: before.actions, acquiredActions: next.actions,
  before, controlledReturn: { quarterTurns: turns, originalFrameHash: originalPacket.frame_hash, packet: alternative },
  afterReturn, next, actualCommands: commands,
  newlyAcquiredMaterialEvents: materialAfter.slice(materialBefore.length),
  observations: { retainedParentAbsentThroughoutProbe: before.parent === null && afterReturn.parent === null && next.parent === null,
    beforeTargetId: before.target?.id ?? null, nextTargetId: next.target?.id ?? null,
    currentTargetChanged: before.target?.id !== next.target?.id,
    nextCommandReleased: next.kind === 'action' && Boolean(next.authorization),
    acquiredExactlyOnce: next.caller.acquiredTransitions === next.actions },
};
assert.equal(result.observations.acquiredExactlyOnce, true);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), sourceHead,
  nativeDigest: sourceBefore.digest, preparationActions: before.actions, acquiredActions: next.actions,
  observations: result.observations, nextKind: next.proposal.kind,
  nextPoseMode: next.proposal.material_pose_plan?.mode, nextPoseRule: next.proposal.material_pose_plan?.rule,
  nextActions: next.proposal.actions }));
