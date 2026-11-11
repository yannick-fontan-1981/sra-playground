import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution } from '../src/logos-engine/v6-native-types.ts';
import { RankedWorkshop } from '../src/logos-engine/v6-ranked-workshop.ts';
import { syntheticWorkshopPublicState } from './helpers/v6-synthetic-workshop.ts';

type R = Record<string, any>;
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = { common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')) } as NativeV6Declarations;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };

test('cold production caller acquires a public mode contrast, scopes a stationary contact and releases only the exact Workshop continuation', async () => {
  const free = await syntheticWorkshopPublicState(false, 1, 1, ['ACTION5'], true);
  const held = await syntheticWorkshopPublicState(true, 2, 1, ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'], true);
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), internal = runtime as unknown as R;
  const owner = internal.acquisitionFamilies.workshop as RankedWorkshop;
  const calls: { selected: boolean; action: R }[] = [], record = owner.recordSource.bind(owner);
  owner.recordSource = (...args: Parameters<RankedWorkshop['recordSource']>) => {
    calls.push({ selected: args[5] != null, action: structuredClone(args[2]) }); return record(...args);
  };
  try {
    assert.deepEqual(owner.state(), (await RankedWorkshop.create()).state());
    let result = await runtime.initialize({ sessionId: 'independent-workshop-cold-caller', observation: free.publicPacket,
      budgets: { targetLevels: 3, levelActionCaps: [12, 12, 12], maxActions: 36 } }, execution);
    assert.equal(result.kind, 'action', result.reason);
    assert.deepEqual(result.command, { action_ref: 'ACTION5' });
    assert.notEqual(result.snapshot.lastDecision, owner.id);
    result = await runtime.advance({ command: result.command!, observation: held.publicPacket, executionMs: 0 }, execution);
    assert.equal(result.kind, 'boundary', result.reason);
    assert.equal(owner.mode_evidence.length, 1);
    assert.deepEqual(owner.mode_evidence[0]!.observed_change, [0, 1]);
    assert.deepEqual(calls, [{ selected: false, action: { action_ref: 'ACTION5' } }]);

    result = await runtime.resume(execution);
    assert.equal(result.kind, 'action', result.reason);
    assert.equal(result.snapshot.lastDecision, 'animated_contact');
    assert.deepEqual(result.command, { action_ref: 'ACTION6', data: { x: 21, y: 17 } });
    result = await runtime.advance({ command: result.command!, observation: { ...held.publicPacket, step_index: 2 }, executionMs: 0 }, execution);
    assert.equal(result.kind, 'boundary', result.reason);
    const scope = internal.knowledge.value('native_contact_probe_scope:animated_contact');
    assert.equal(scope.status, 'stationary_unlearned_invitation');
    assert.equal(calls.length, 2); assert.ok(calls.every(call => !call.selected));
    const acquired = owner.state();

    // The common store, not an object seeded by the test, restores acquisition.
    owner.restore((await RankedWorkshop.create()).state());
    assert.equal(owner.mode_evidence.length, 0);
    result = await runtime.resume(execution);
    assert.equal(result.kind, 'action', result.reason);
    assert.equal(result.snapshot.lastDecision, owner.id);
    assert.deepEqual(result.command, { action_ref: 'ACTION4' });
    assert.deepEqual(owner.state(), acquired);
    assert.equal(calls.length, 2, 'Restoration and selection do not acquire the same return again');
    const proposal = result.snapshot.proposal as R;
    assert.equal(proposal.material_access_subquestion, 'observed_ranked_workshop');
    assert.equal(proposal.workshop_plan.workflow.workflow, 'v6.ranked_workshop.choose');
    assert.equal(proposal.bundle_template.operation_key, 'OP18');
    const receipt = proposal.strategy_receipt.native_coordination.find((row: R) => row.rule === 'stationary_unlearned_contact_refusal_is_local');
    assert.ok(receipt); assert.equal(receipt.preferred_proposal_id, null);
    assert.equal(receipt.source_state_ref, 'family_state:public_ranked_workshop');
    assert.deepEqual(receipt.grounded_inquiry.context_model_ids, [owner.mode_methods[0]!.ref]);
    assert.equal(receipt.grounded_inquiry.status, 'acquired_context_for_unknown_effect');
    assert.equal((result.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
    assert.ok(result.authorization);
    assert.equal(result.snapshot.actions, 2, 'A release is not a claimed third observed effect');
    assert.equal(result.snapshot.levelsCompleted, 0, 'The independent contract makes no game-success claim');

    result = await runtime.advance({ command: result.command!, observation: { ...held.publicPacket, step_index: 3 }, executionMs: 0 }, execution);
    assert.equal(result.kind, 'boundary', result.reason);
    assert.equal(result.snapshot.actions, 3);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls.at(-1), { selected: true, action: { action_ref: 'ACTION4' } });
    assert.deepEqual((result.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
    assert.equal(owner.events.at(-1)!.status, 'no_discriminating_change');
    assert.equal(owner.events.at(-1)!.universal_law_confirmed, false);
    assert.deepEqual(owner.rejected, [[proposal.workshop_plan.rule_ref, proposal.workshop_plan.context_sha256]]);
    const refuted = owner.state();
    owner.restore((await RankedWorkshop.create()).state());
    result = await runtime.resume(execution);
    assert.ok(result.kind !== 'action' || result.snapshot.lastDecision !== owner.id,
      'A retained no-effect return cannot become renewed authority for the same Workshop question');
    assert.deepEqual(owner.state(), refuted);
    assert.equal(calls.length, 3, 'The selected Workshop return is acquired exactly once across restoration');
    assert.equal(result.snapshot.levelsCompleted, 0);
  } finally { runtime.close('independent-workshop-cold-caller-complete'); }
});
