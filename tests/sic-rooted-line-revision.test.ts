import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { RootedLineMemory, rootedLineAfter, rootedLineBefore } from '../src/logos-engine/v6-rooted-line-access.ts';
import { planCellPush } from '../src/logos-engine/v6-rooted-line-revision.ts';
import { measureRootedLine } from '../src/logos-engine/v6-rooted-line-observation.ts';
import { readNativeResolution } from '../src/sic/native-resolution.ts';
import { compileRecoveryPack, contactRecoveryOrder, defaultRecoveryPack, selectRootedRecovery } from '../src/sic/active-recovery.ts';
import { nextRecoveryRevision, readRecoveryRevision, recoveryRevision } from '../src/sic/recovery-pack.ts';

const trace = new URL('../docs/migration/lot3d-evidence/final/sk48-rooted-session/sk48-public-trace.json.gz', import.meta.url);
const policy = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm', import.meta.url);

test('an observed push chain unblocks rooted-line search, retaining its estimate and counterexample', () => {
  const { packets } = JSON.parse(gunzipSync(readFileSync(trace)).toString());
  const config = JSON.parse(readFileSync(policy, 'utf8')).declarations[0].configuration.observed_composition_services;
  const memory = new RootedLineMemory();
  const observation = (index: number) => ({
    observation_ref: `local:epoch:1:revision:${index + 1}:frame:witness`,
    level_epoch: 1, levels_completed: 0, available_action_refs: packets[index].packet.available_action_refs,
  });
  let proposal;
  for (let i = 0; i < packets.length - 1; i++) {
    const before = packets[i].packet.frame_rows, { command, packet } = packets[i + 1];
    const index = i < 4 ? 0 : i - 4;
    if (!index) proposal = memory.propose(observation(i), before, [], 16, config);
    assert.equal(proposal?.actions[index].action_ref, command.action_ref);
    memory.record(observation(i), command, observation(i + 1), before, packet.frame_rows, proposal!, index);
  }
  const last = packets.length - 1, current = observation(last), rows = packets[last].packet.frame_rows;
  const state = memory.currentState().line_memory;
  assert.equal(state.refuted[0]?.cell_push_witness, true);
  assert.equal(state.sic_recovery_need?.status, 'admitted');
  const restored = new RootedLineMemory();
  restored.applyEvent({ kind: 'observed_rooted_line', memory: state });
  assert.deepEqual(restored.currentState().line_memory.sic_recovery_need, state.sic_recovery_need);
  const shadow = compileRecoveryPack({ ...defaultRecoveryPack, mode: 'shadow' });
  const ignored = memory.propose(current, rows, [], 16, { ...config, sic_recovery: shadow });
  assert.equal(ignored?.reason, 'sic_recovery_shadow');
  assert.equal(ignored?.actions, undefined);
  assert.equal(ignored?.block_unrelated_probe, true);
  assert.equal(ignored?.release_authority, false);
  assert.deepEqual(ignored?.sic_decision.agenda.map((entry: { result: string }) => entry.result), ['shadow', 'shadow']);
  const narrow = compileRecoveryPack({ ...defaultRecoveryPack, maxDepth: 1 });
  const limited = memory.propose(current, rows, [], 16, { ...config, sic_recovery: narrow });
  assert.equal(limited?.reason, 'rooted_cell_access_unresolved');
  assert.equal(limited?.actions, undefined);
  const offScope = current.observation_ref.replace(':epoch:1:', ':epoch:2:');
  assert.equal(selectRootedRecovery(defaultRecoveryPack, state.refuted, state.refuted[0].layout, offScope).status, 'unresolved');
  assert.equal(selectRootedRecovery(defaultRecoveryPack, state.refuted, state.refuted[0].layout, observation(last - 1).observation_ref).status, 'unresolved');
  const revised = memory.propose(current, rows, [], 16, config)!;
  assert.equal(revised.rooted_line_plan.search.operation, 'OP26');
  assert.deepEqual(revised.rooted_line_plan.search.recovery_operations.map((operation: { key: string }) => operation.key),
    ['OP03', 'OP12', 'OP08', 'OP26']);
  assert.deepEqual(revised.rooted_line_plan.search.recovery_evidence, [observation(11).observation_ref, current.observation_ref]);
  assert.equal(revised.bundle_template.operation_key, 'OP18');
  assert.deepEqual(revised.actions, [{ action_ref: 'ACTION3' }]);
  const alternativePack = compileRecoveryPack({ ...defaultRecoveryPack, strategyOrder: [...contactRecoveryOrder].reverse() });
  const alternate = memory.propose(current, rows, [], 16, { ...config, sic_recovery: alternativePack })!;
  assert.deepEqual(alternate.actions, [{ action_ref: 'ACTION1' }]);
  assert.equal(alternate.rooted_line_plan.search.predicted_goal_distance, 9);
  assert.equal(alternate.rooted_line_plan.search.sic_decision.needId, revised.rooted_line_plan.search.sic_decision.needId);
  assert.deepEqual(alternate.rooted_line_plan.search.sic_decision.situation, revised.rooted_line_plan.search.sic_decision.situation);
  assert.equal(alternate.rooted_line_plan.search.sic_decision.situation.revision, current.observation_ref);
  assert.ok(alternate.rooted_line_plan.search.sic_decision.situation.facts.availableRootTranslation.evidence.length > 1);
  assert.deepEqual(alternate.rooted_line_plan.search.sic_decision.agenda.map((entry: { id: string; result: string }) => [entry.id, entry.result]),
    [['reposition_root_before_contact', 'selected'], ['revise_rooted_contact', 'lower_priority']]);
  const constrained = memory.propose(current, rows, [], 16, {
    ...config, sic_recovery: compileRecoveryPack({ ...alternativePack, maxDepth: 7 }),
  })!;
  assert.deepEqual(constrained.actions, revised.actions);
  assert.deepEqual(constrained.rooted_line_plan.search.sic_decision.agenda.map((entry: { result: string }) => entry.result), ['no_plan', 'selected']);
  const view = readNativeResolution({
    sessionId: 'local', sequence: last, level: 1, trace: [], lastDecision: 'public_occurrence_recall',
    proposal: revised, phase: 'authorised_not_executed',
  });
  assert.equal(view?.recoveryAction, 12);
  assert.equal(view?.recoveryDecision?.strategy, 'Revise the contact projection');
  assert.deepEqual(view?.recoveryDecision?.objective, { id: 'find_ordered_contact_access',
    label: 'Find an access that puts the pieces in the reference order', parent: 'G_official_completion' });
  assert.equal(view?.recoveryDecision?.maxDepth, 88);
  assert.equal(view?.recoveryDecision?.situationAction, 12);
  assert.ok(view?.recoveryDecision?.agendaEvidence?.reposition_root_before_contact?.includes(12));
  assert.equal(view?.recoveryDecision?.packDigest, recoveryRevision(defaultRecoveryPack).digest);
  assert.equal(view?.operation, 'OP18');
  assert.deepEqual(view?.recoveryOperations?.map(operation => operation.key), ['OP03', 'OP12', 'OP08', 'OP26']);
  assert.equal(rootedLineBefore(revised, 0, rows, {
    epoch: 1, score: 0, observation_ref: current.observation_ref, available: current.available_action_refs,
  }).admitted, true);
  assert.equal(revised.rooted_line_plan.search.sic_decision.needId, state.sic_recovery_need.id);
  const after = { ...current, observation_ref: 'local:epoch:2:revision:14:frame:return', level_epoch: 2, levels_completed: 1 };
  assert.equal(rootedLineAfter(revised, 0, rows, rows, { epoch: 2, score: 1 }).sic_need.status, 'satisfied');
  restored.record(current, revised.actions[0], after, rows, rows, revised, 0);
  assert.deepEqual(restored.currentState().line_memory.sic_recovery_need, {
    ...state.sic_recovery_need, status: 'satisfied', outcomeRef: after.observation_ref,
  });
  assert.equal(planCellPush(measureRootedLine(rows)!, state.controls, 1, 1000, () => false), null);
  assert.equal(planCellPush(measureRootedLine(rows)!, state.controls, 20, 1000, () => true), null);
});

test('the recovery pack accepts only the native capability and bounded search limits', () => {
  assert.deepEqual(compileRecoveryPack(), defaultRecoveryPack);
  assert.throws(() => compileRecoveryPack({ ...defaultRecoveryPack, action: 'ACTION3' }), TypeError);
  assert.throws(() => compileRecoveryPack({ ...defaultRecoveryPack, version: 2 }), TypeError);
  assert.throws(() => compileRecoveryPack({ ...defaultRecoveryPack, maxNodes: 1001 }), RangeError);
  assert.throws(() => compileRecoveryPack({ ...defaultRecoveryPack, strategyOrder: [contactRecoveryOrder[0], contactRecoveryOrder[0]] }), TypeError);
  assert.deepEqual(compileRecoveryPack({ ...defaultRecoveryPack, strategyOrder: contactRecoveryOrder }), defaultRecoveryPack);
  assert.throws(() => compileRecoveryPack({ ...defaultRecoveryPack, frontier: { inputOrder: 'invented' } }), TypeError);
  assert.deepEqual(compileRecoveryPack({ ...defaultRecoveryPack, frontier: { inputOrder: 'least_tried' } }), defaultRecoveryPack);
});

test('portable recovery packs validate content and preserve the last distinct revision', () => {
  const active = recoveryRevision(defaultRecoveryPack);
  const shadow = recoveryRevision({ ...defaultRecoveryPack, mode: 'shadow' });
  const frontier = recoveryRevision({ ...defaultRecoveryPack, frontier: { inputOrder: 'command_order' } });
  assert.equal(frontier.schemaVersion, 2);
  const custom = recoveryRevision({ ...defaultRecoveryPack, frontier: { inputOrder: 'least_tried', localRule: {
    title: 'Compare directions', commands: 'directions', minimumUsageGap: 2, mode: 'shadow', prefer: 'command_order',
  } } });
  assert.equal(custom.schemaVersion, 3);
  assert.deepEqual(readRecoveryRevision(JSON.parse(JSON.stringify(custom))), custom);
  assert.throws(() => recoveryRevision({ ...defaultRecoveryPack, frontier: { ...custom.configuration.frontier!,
    localRule: { ...custom.configuration.frontier!.localRule!, minimumUsageGap: 0 },
  } }), TypeError);
  assert.deepEqual(readRecoveryRevision(JSON.parse(JSON.stringify(frontier))), frontier);
  assert.throws(() => readRecoveryRevision({ ...active, configuration: frontier.configuration }), /schema version disagree/);
  assert.notEqual(active.digest, shadow.digest);
  const exported = JSON.parse(JSON.stringify(shadow));
  assert.deepEqual(readRecoveryRevision(exported), shadow);
  assert.throws(() => readRecoveryRevision({ ...exported, schemaVersion: 2 }), /version/);
  assert.throws(() => readRecoveryRevision({ ...exported, configuration: undefined }), /configuration/);
  assert.throws(() => readRecoveryRevision({ ...exported, configuration: active.configuration }), /digest/);
  assert.throws(() => readRecoveryRevision({ ...exported, actions: [] }), TypeError);
  const saved = nextRecoveryRevision(active, null, shadow);
  assert.deepEqual(saved, { current: shadow, previous: active });
  assert.deepEqual(nextRecoveryRevision(saved.current, saved.previous, readRecoveryRevision(exported)), saved);
});
