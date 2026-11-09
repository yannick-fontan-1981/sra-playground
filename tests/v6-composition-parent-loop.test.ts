import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AttentionMemory } from '../src/logos-engine/v6-attention-memory.ts';
import { revalidateTypedMaterialParent, consumeTypedMaterialParent, recordTypedMaterialParent, typedMaterialParentGuard,
  TYPED_MATERIAL_COMPOSITION_OWNER } from '../src/logos-engine/v6-typed-material-composition.ts';
import { typedMaterialDigest } from '../src/logos-engine/v6-typed-material-observation.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeAuthorityTransition } from '../src/logos-engine/v6-native-authority.ts';
import { CommonMaterialReplay, copy, MATERIAL_OWNER, MATERIAL_EVENT_KINDS, materialPublicTrace, type R } from './helpers/native-composition-loop.ts';
import { ComponentParent, changedPacket, rotatedReturn } from './helpers/native-composition-component.ts';

async function evidence(name: string, value: R): Promise<void> {
  if (!process.env.LOGOS_LOT1_EVIDENCE_DIR) return;
  const directory = resolve(process.env.LOGOS_LOT1_EVIDENCE_DIR); await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${name}.json`), JSON.stringify({ schema: 'logos-engine.lot1.contract-evidence.v1', ...value }, null, 2) + '\n', { flag: 'wx' });
}

test('a cold common runtime retains two delivery parents through actual pose returns, restoration and an official boundary', async () => {
  const driver = await CommonMaterialReplay.cold('lot1-cold-common-parent-loop');
  const runtime = driver.runtime as unknown as R;
  const owner = runtime.families.find((family: R) => family.id === 'public_occurrence_recall'), initial = copy(owner.state());
  assert.equal(runtime.families.filter((family: R) => family.id === owner.id).length, 1);
  let restored = false, parentQuestions = 0, consumed = 0, conditionalSteps = 0;
  const parentIds = new Set<string>(), terminal: R[] = [], nextDecisions: R[] = [];
  while (driver.packetIndex < materialPublicTrace.packets.length - 1) {
    await driver.ready();
    assert.equal(driver.result.kind, 'action', driver.result.reason ?? 'common experiment required');
    const proposal = driver.result.snapshot.proposal as R, dependency = proposal.native_composition_dependency;
    if (dependency) {
      parentQuestions++; parentIds.add(dependency.parent_ref);
      assert.equal(dependency.release_authority, false); assert.equal(dependency.admitted, true);
      assert.ok(driver.result.authorization, 'Common WHY/ACT still authorizes each primitive');
      assert.equal(driver.attention()!.status, 'pending');
      assert.equal(driver.attention()!.owner, TYPED_MATERIAL_COMPOSITION_OWNER);
      assert.equal(proposal.composition_target_tree.route_key ?? null, null, 'Native composition is not fabricated morphology');
      if (dependency.consumed_return_ref) {
        consumed++; const acquired = driver.retained(dependency.consumed_return_ref);
        assert.ok(acquired.caller_acquisition && acquired.frontier_acquisition);
        const ownerState = owner.compositionDependencyState();
        const events = [...ownerState.pose_events, ...ownerState.flow_events];
        assert.ok(events.some((event: R) => 'typed-material-event:' + typedMaterialDigest(event) === dependency.returned_event_ref));
        nextDecisions.push({ afterActions: driver.packetIndex, decision: dependency.decision, parent: dependency.parent_ref,
          returnedTransition: dependency.consumed_return_ref, nextCommand: copy(driver.result.command) });
      }
      conditionalSteps += Number(proposal.actions.length > 1);
    }
    await driver.recorded();
    if (driver.result.kind !== 'action') {
      const attention = driver.attention();
      assert.equal((driver.result.snapshot.caller as R).acquiredTransitions, driver.packetIndex, 'Each real transition is acquired exactly once');
      const events = driver.retained(MATERIAL_OWNER).events.filter((event: R) => MATERIAL_EVENT_KINDS.has(event.kind));
      const eventIds = events.map((event: R) => typedMaterialDigest(event));
      assert.equal(new Set(eventIds).size, eventIds.length, 'No duplicate relevant material acquisitions');
      if (attention && ['achieved', 'refuted', 'boundary'].includes(attention.status)) terminal.push(copy(attention));
      if (!restored && attention?.binding.phase === 'needs_pose') {
        const retainedMaterial = driver.retained(MATERIAL_OWNER), retainedAttention = copy(attention);
        const temporary = runtime.caller.state(); temporary.attention.composition = null;
        runtime.caller.restore(temporary); owner.restore(initial);
        assert.equal(runtime.caller.attention.composition, null);
        await driver.ready();
        assert.deepEqual(owner.state(), retainedMaterial, 'Restoration reads the actual authoritative graph');
        assert.equal(driver.attention()!.id, retainedAttention.id);
        assert.equal(driver.attention()!.binding.last_return.transition_ref, retainedAttention.binding.last_return.transition_ref);
        assert.equal((driver.result.snapshot.proposal as R).native_composition_dependency.consumed_return_ref, retainedAttention.binding.last_return.transition_ref);
        restored = true;
      }
    }
  }
  assert.equal(driver.result.snapshot.levelsCompleted, 3); assert.equal(driver.result.snapshot.actions, 49);
  assert.equal(parentIds.size, 2); assert.equal(restored, true); assert.ok(parentQuestions >= 6 && consumed >= 4 && conditionalSteps >= 3);
  assert.ok(terminal.some(item => item.status === 'achieved')); assert.equal(driver.attention()!.status, 'boundary');
  assert.ok(driver.timeline.some(item => item.attention?.binding.child && item.poseMode === 'select'));
  await evidence('common-positive', { status: 'passed', source: 'Cold common runtime; real retained public returns checked only after native choice',
    actions: 49, levelsCompleted: 3, parents: [...parentIds], restoredFromGraph: restored, nextDecisions, timeline: driver.timeline,
    finalAttention: driver.attention(), finalCaller: driver.result.snapshot.caller });
});

test('a different measured return changes the next common decision while retaining the same parent', async () => {
  const driver = await CommonMaterialReplay.cold('lot1-common-alternate-pose-return');
  await driver.until(proposal => proposal.material_pose_plan?.mode === 'control' && proposal.material_pose_plan.rule === null);
  const proposal = copy(driver.result.snapshot.proposal as R), retained = driver.attention()!;
  const packet = materialPublicTrace.packets[driver.packetIndex].packet;
  const alternative = await rotatedReturn(packet, proposal.material_pose_plan.child, 3);
  await driver.returned(alternative);
  assert.equal(driver.attention()!.id, retained.id); assert.equal(driver.attention()!.status, 'pending');
  assert.equal(driver.attention()!.binding.phase, 'needs_pose');
  await driver.ready(); assert.equal(driver.result.kind, 'action', driver.result.reason ?? 'Changed return must cause a pertinent continuation');
  const next = driver.result.snapshot.proposal as R;
  assert.equal(next.material_pose_plan.mode, 'control'); assert.equal(next.material_pose_plan.rule.turns, 3);
  assert.equal(next.native_composition_dependency.decision, 'resume_pose'); assert.equal(next.native_composition_dependency.parent_ref, retained.id);
  assert.equal(next.material_pose_plan.option.target.id, retained.target_ref);
  assert.equal(next.actions.length, 2, 'Two more observed 270-degree turns complete the retained 90-degree objective');
  assert.ok(driver.result.authorization); assert.equal(next.native_composition_dependency.release_authority, false);
  await evidence('common-alternative', { status: 'passed', qualification: 'Counterfactual public raster return, not a live game result; all preceding returns cold and real',
    beforeActions: driver.packetIndex - 1, returnedRotation: 3, retainedTarget: retained.target_ref, observation: alternative,
    nextDecision: next.native_composition_dependency, nextActions: next.actions, acquiredParent: driver.attention() });
});

test('an observed rule which cannot reach the retained request suspends it without silently replacing the parent', async () => {
  const branch = await ComponentParent.selected(), parent = copy(branch.attention.composition);
  const receipt = await branch.acquire(await rotatedReturn(branch.row.packet, branch.proposal.material_pose_plan.child, 2));
  assert.equal(branch.state().pose_rule.turns, 2); assert.equal(receipt!.decision, 'suspend');
  assert.equal(branch.attention.composition!.id, parent.id); assert.equal(branch.attention.composition!.binding.phase, 'suspended');
  assert.equal(revalidateTypedMaterialParent(branch.attention, branch.state(), branch.row.observation, branch.row.packet.frame_rows)!.admitted, false);
  await evidence('unreachable-parent', { status: 'passed', qualification: 'Controlled public-return component contract',
    receipt, poseRule: branch.state().pose_rule, parent: branch.attention.composition });
});

test('a conditional pose contradiction is retained by the one material owner and closes the parent as refuted', async () => {
  const branch = await ComponentParent.selected(1), parent = copy(branch.attention.composition);
  assert.equal(branch.proposal.actions.length, 3); assert.equal(branch.state().pose_rule.turns, 1);
  const receipt = await branch.acquire(await rotatedReturn(branch.row.packet, branch.proposal.material_pose_plan.child, 2));
  assert.equal(receipt!.decision, 'refuted'); assert.equal(branch.attention.composition!.status, 'refuted');
  assert.equal(branch.attention.composition!.id, parent.id); assert.equal(branch.state().pose_rule.status, 'refuted');
  assert.ok(branch.state().pose_rule.counterexample); assert.equal(branch.state().pose_events.at(-1).stop_reason, 'typed_pose_effect_unexplained');
  const retained = branch.family.nativeState(), pose = branch.state(); branch.family.restoreNative(copy(retained));
  assert.deepEqual(branch.state(), pose, 'Restoration preserves the acquired counterexample');
  assert.equal(typedMaterialParentGuard(branch.attention, branch.state(), branch.proposal, 1, branch.row.observation, branch.row.packet.frame_rows)!.admitted, false);
  await evidence('refuted-parent', { status: 'passed', receipt, retainedRule: branch.state().pose_rule, parent: branch.attention.composition });
});

test('return reconciliation consumes an already acquired event once and creates no second business owner', async () => {
  const branch = await ComponentParent.selected(), last = branch.records.at(-1)!;
  const domain = copy(branch.family.nativeState()), attention = copy(branch.attention.state());
  const again = recordTypedMaterialParent(branch.attention, branch.state(), copy(branch.proposal), last.transition, last.record);
  assert.equal(again!.duplicate, true); assert.deepEqual(branch.family.nativeState(), domain); assert.deepEqual(branch.attention.state(), attention);
  const serialized = JSON.stringify(branch.attention.state());
  assert.equal(serialized.includes('flow_events'), false); assert.equal(serialized.includes('pose_events'), false);
  assert.equal(branch.attention.item, null, 'Composition retention does not create motion attention');
});

test('interrupting a conditional pose prefix acquires its observed part and restores only the remaining work', async () => {
  const branch = await ComponentParent.selected(1), parent = copy(branch.attention.composition);
  assert.equal(branch.proposal.actions.length, 3);
  assert.equal(branch.proposal.material_pose_plan.child.lineage_status, 'ambiguous_observed_matches_preserved');
  assert.equal(typedMaterialParentGuard(branch.attention, branch.state(), branch.proposal, 0, branch.row.observation, branch.row.packet.frame_rows)!.admitted, true,
    'Ambiguous historical ancestry does not make the measured current child ambiguous');
  await branch.acquire(await rotatedReturn(branch.row.packet, branch.proposal.material_pose_plan.child, 1));
  assert.equal(branch.attention.composition!.binding.phase, 'needs_pose');
  const state = copy(branch.family.nativeState()), attention = copy(branch.attention.state());
  const lastReturn = attention.composition.binding.last_return.transition_ref;
  branch.family.restoreNative(state); branch.attention = new AttentionMemory(); branch.attention.restore(attention);
  const next = await branch.offer(); assert.ok(next);
  assert.equal(next.actions.length, 2); assert.equal(next.material_pose_plan.option.target.id, parent.target_ref);
  assert.equal(next.native_composition_dependency.consumed_return_ref, lastReturn);
  assert.deepEqual(branch.family.nativeState(), state, 'Planning the remaining work does not reacquire its predecessor');
});

test('a foreign public return which removes selection evidence suspends the retained parent', async () => {
  const branch = await ComponentParent.selected(), selected = branch.records[0]!.transition;
  const before = copy(branch.row), rows = copy(before.packet.frame_rows), command = copy(branch.proposal.actions[0]);
  let restoredPixels = 0;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    if (selected.first.frame_rows[y][x] !== selected.second.frame_rows[y][x]) {
      rows[y][x] = selected.first.frame_rows[y][x]; restoredPixels++;
    }
  }
  assert.ok(restoredPixels > 0);
  const packet = await changedPacket(before.packet, rows);
  const after = await measureNativeObservation(packet, before.observation.revision + 1, 'foreign-selection-evidence-removed');
  const priorEvents = branch.state().pose_events.length;
  const record = branch.family.record(before.observation, after, command, before.packet.frame_rows, rows, {}, 0, packet.frame_packet);
  const transition = { before: before.observation, after, first: before.packet, second: packet, command, index: 0,
    outcome: { matched: null, seal_prefix: true, reason: 'controlled_foreign_public_return', official_progress: false } } as NativeAuthorityTransition;
  const receipt = recordTypedMaterialParent(branch.attention, branch.state(), {}, transition, record);
  assert.equal(branch.state().pose_events.length, priorEvents, 'A foreign proposal is not acquired as a selected pose experiment');
  assert.equal(receipt!.admitted, false); assert.equal(branch.attention.composition!.binding.phase, 'suspended');
  assert.match(receipt!.reason, /selection/);
});

for (const [label, alter] of [
  ['missing acquired return', (state: R) => { state.pose_events = []; }],
  ['ambiguous current child identity', (state: R) => { state.flow_children.push(copy(state.flow_children.find((child: R) => child.id === state.pose_context.child.id))); }],
  ['ambiguous current control', (state: R) => { state.pose_controls.push(copy(state.pose_controls[0])); }],
  ['changed historical comparison proof', (state: R) => { Object.values(state.pose_models).forEach((model: any) => model.evidence.push('unacquired-model-revision')); }],
  ['lost selected context', (state: R) => { state.pose_context = null; state.flow_context = null; }],
] as const) test(`a ${label} prevents unjustified parent resumption`, async () => {
  const branch = await ComponentParent.selected(), state = copy(branch.state()), original = copy(branch.family.nativeState()); alter(state);
  const receipt = revalidateTypedMaterialParent(branch.attention, state, branch.row.observation, branch.row.packet.frame_rows);
  assert.equal(receipt!.admitted, false); assert.equal(branch.attention.composition!.binding.phase, 'suspended');
  assert.deepEqual(branch.family.nativeState(), original, 'Revalidation cannot revise another owner or erase a counterexample');
});

test('a changed request descriptor, a stale proposal and an observed scope boundary invalidate old authorizations', async () => {
  const branch = await ComponentParent.selected();
  const stale = copy(branch.proposal); stale.binding.observation_ref = 'previous-unacquired-view';
  assert.equal(consumeTypedMaterialParent(branch.attention, branch.state(), stale, branch.row.observation, branch.row.packet.frame_rows)!.admitted, false);
  const boundary = new AttentionMemory(); boundary.restore(copy(branch.attention.state()));
  const receipt = revalidateTypedMaterialParent(boundary, branch.state(), { ...branch.row.observation, level_epoch: branch.row.observation.level_epoch + 1 }, branch.row.packet.frame_rows);
  assert.equal(receipt!.decision, 'boundary'); assert.equal(boundary.composition!.status, 'boundary');
  assert.equal(typedMaterialParentGuard(boundary, branch.state(), branch.proposal, 0, branch.row.observation, branch.row.packet.frame_rows)!.admitted, false);
  const direct = new AttentionMemory(); direct.restore(copy(branch.attention.state()));
  const closed = consumeTypedMaterialParent(direct, branch.state(), branch.proposal,
    { ...branch.row.observation, level_epoch: branch.row.observation.level_epoch + 1 }, branch.row.packet.frame_rows);
  assert.equal(closed!.decision, 'boundary'); assert.equal(direct.composition!.status, 'boundary');
  const changed = await ComponentParent.selected(), rows = copy(changed.row.packet.frame_rows);
  const [x, y] = changed.attention.composition!.binding.request.point; rows[y][x] = rows[y][x] === 0 ? 1 : 0;
  const packet = await changedPacket(changed.row.packet, rows);
  const refusal = revalidateTypedMaterialParent(changed.attention, changed.state(), changed.row.observation, packet.frame_rows);
  assert.equal(refusal!.admitted, false); assert.equal(changed.attention.composition!.binding.phase, 'suspended');
});
