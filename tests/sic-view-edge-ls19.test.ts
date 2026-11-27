import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { readNativeResolution } from '../src/sic/native-resolution.ts';
import { selectViewStrategy, type ViewNeedSituation } from '../src/sic/view-strategy.ts';

const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(readFileSync(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(readFileSync(new URL('morphology_policy/strategy.drm', source), 'utf8')),
};

test('LS19 historical edge approach releases ACTION1 and closes its own objective after the fourth step', async () => {
  const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-view-edge-ls19-l1.json.gz', import.meta.url))).toString());
  const { sessionId, budgets, observations, commands } = capture;
  const service = new V6AgentService(recovery => createNativeV6Runtime(declarations, { recovery, now: () => 0 }));
  let result = await service.handle({ type: 'init', sessionId, sequence: 0, budgets, observation: observations[0] });
  let firstObjective: string | undefined, secondObjective: string | undefined;
  assert.equal(commands.length, 13);
  for (let index = 0; index < commands.length; index++) {
    const turn = index + 1;
    if (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence: index });
    assert.equal(result.kind, 'action');
    assert.deepEqual(result.command, commands[index], `ticket ${turn}`);
    const snapshot = result.snapshot;
    const proposal = snapshot.proposal as Record<string, any>;
    const release = snapshot.trace.findLast(event => event.kind === 'sic_native_plan')!;
    const guard = snapshot.trace.findLast(event => event.kind === 'before_guard')!;
    const decision = proposal.sic_view_decision;
    if (turn <= 2) assert.equal(release.family, 'observed_frontier');
    if (turn === 3) {
      assert.equal(result.command!.actionRef, 'ACTION1');
      assert.equal(release.family, 'view');
      assert.equal(release.authority, 'viewAccess');
      assert.equal(release.strategy, 'approach_view_edge');
      assert.equal(proposal.kind, 'public_view_frontier');
      assert.equal(decision.need.kind, 'observe_view_access');
      assert.equal(decision.objective.parent, 'G_official_completion');
      firstObjective = decision.objective.id;
      assert.equal(release.subObjective, firstObjective);
      const facts = decision.situation.facts;
      assert.deepEqual(Object.fromEntries(Object.entries(facts).map(([key, fact]) => [key, (fact as { value: unknown }).value])),
        { reopened: false, obstruction: false, repeated: 'unknown', edgeAccess: true });
      assert.deepEqual(facts.edgeAccess.evidence, [proposal.binding.observation_ref, ...proposal.view_plan.details.evidence_refs]);
      assert.deepEqual(decision.agenda.filter((entry: { result: string }) => entry.result === 'selected').map((entry: { id: string }) => entry.id), ['approach_view_edge']);
      const details = proposal.view_plan.details;
      assert.deepEqual([details.access_vector, details.conditional_new_viewport_pixels, details.steps_to_projected_screen_edge], [[0, -8], 512, 5]);
      assert.deepEqual(details.other_accesses, []);
      assert.deepEqual(proposal.view_plan.steps.map((step: { entry_texture_witnessed: boolean }) => step.entry_texture_witnessed), [true, true, true, false]);
    }
    if (turn >= 3 && turn <= 6) {
      assert.equal(release.subObjective, firstObjective);
      assert.deepEqual([guard.index, guard.admitted, guard.reason], [turn - 3, true, 'bound_view_step']);
    }
    if (turn === 9) {
      secondObjective = decision.objective.id;
      assert.notEqual(secondObjective, firstObjective);
      assert.equal(release.strategy, 'approach_view_edge');
    }
    if (turn === 13) {
      assert.equal(release.strategy, 'confirm_access_obstruction');
      assert.equal(decision.situation.facts.obstruction.value, true);
      assert.equal(decision.situation.facts.edgeAccess.value, 'unknown');
      assert.notEqual(decision.objective.id, secondObjective);
    }
    result = await service.handle({ type: 'advance', sessionId, sequence: turn, ticketId: result.ticket!.id,
      observation: observations[turn], executionMs: 0 });
    const outcome = readNativeResolution({ ...result.snapshot, sessionId, sequence: turn, phase: result.phase })?.outcome;
    if (turn >= 3 && turn <= 5) {
      assert.deepEqual([outcome?.matched, outcome?.reason, outcome?.viewOutcome], [true, 'screen_pose_matched', undefined]);
    }
    if (turn === 6 || turn === 12) {
      assert.deepEqual([outcome?.matched, outcome?.reason], [false, 'screen_pose_diverged']);
      assert.deepEqual(outcome?.viewOutcome, { objective: turn === 6 ? firstObjective : secondObjective, status: 'no_new_area', newPixels: 0 });
    }
    if (turn === 13) assert.deepEqual(outcome?.viewOutcome, { objective: decision.objective.id, status: 'no_new_area', newPixels: 0 });
    if (turn === 3) {
      // Full public plan, references, guard and measured outcome from the 8ce7ee35 replay.
      const evidence = [commands[index], proposal.view_plan, decision, release, guard, outcome?.matched, outcome?.reason, outcome?.viewOutcome];
      assert.equal(createHash('sha256').update(JSON.stringify(evidence)).digest('hex'), '7560f18611c6ddcb766ec999e61e3eed46bb6aed322b503c4f04c50615e781a0');
    }
  }
});

test('the same directional offers switch to obstruction or stay pending when the evidence changes', () => {
  const current: ViewNeedSituation = { observationRef: 'transfer:epoch:1:revision:3:frame:scene', segment: 1,
    reopened: null, obstruction: null, edgeAccess: ['measured-motion'] };
  const edge = { action: 'ACTION1', evidence: 'motion' }, blocked = { action: 'ACTION1', evidence: 'stop' };
  const called: string[] = [];
  const planners = {
    approach_view_edge: () => { called.push('edge'); return edge; },
    confirm_access_obstruction: () => { called.push('obstruction'); return blocked; },
    test_change_of_witnessed_obstruction: () => null,
    test_reopened_access: () => null,
  };
  const first = selectViewStrategy(current, planners);
  assert.equal(first.selected?.plan, edge);
  const stopped = selectViewStrategy({ ...current, obstruction: { refs: ['stopped-at-boundary'], repeated: false } }, planners);
  assert.equal(stopped.selected?.plan, blocked);
  assert.equal(stopped.need.id, first.need.id);
  assert.ok(stopped.need.evidence.includes('stopped-at-boundary'));
  assert.equal(selectViewStrategy({ ...current, edgeAccess: null }, planners).selected, null);
  assert.deepEqual(called, ['edge', 'obstruction']);
});
