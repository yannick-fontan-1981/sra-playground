import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { SymbolTransactions, substitute } from '../src/logos-engine/v6-symbol-transactions.ts';
import { NativeSrcProgram } from '../src/logos-engine/v6-src-program.ts';
import type { NativeCommand, NativeObservation, NativePublicObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-symbol-transactions-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(value: T): T => structuredClone(value);
const receiptFields = ['workflow', 'src_hash', 'src_status', 'executed_statements'];

/** Check the complete original projection; no receipt, witness, state or action
 * field is normalized away to accommodate the native implementation.
 */
function sourceView(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sourceView);
  if (receiptFields.every(key => Object.hasOwn(value, key)) && typeof value.workflow === 'string') {
    assert.deepEqual(Object.keys(value).sort(), [...receiptFields].sort(), 'Retain every original SRC receipt field');
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sourceView(child)]));
}

for (const row of fixture.cases) test(`symbol transactions original family: ${row.id}`, async () => {
  const owner = await SymbolTransactions.create(); owner.restore(copy(row.seedState));
  assert.equal(owner.src_calls, row.srcCallsBefore);
  const run = async () => {
    const value = await (owner as unknown as R)[row.operation](...copy(row.arguments));
    return value === undefined ? null : sourceView(value);
  };
  if (row.error) await assert.rejects(run); else assert.deepEqual(await run(), row.value);
  assert.deepEqual(sourceView(owner.state()), row.afterState, 'Compare all five source fields including the entire nested Interface');
  assert.deepEqual({ rejected: owner.rejected.length, events: owner.events.length }, row.internalCounts,
    'Export bounds must not silently trim the live source ledger');
  assert.equal(owner.src_calls, row.srcCallsAfter, 'Count actual SRC entries, including abstaining active-guide selections');
});

for (const row of fixture.selectionCases) test(`symbol transactions original selection boundary: ${row.id}`, async () => {
  const owner = await SymbolTransactions.create(); owner.observation = copy(row.observation); owner.rejected = copy(row.rejected);
  const run = () => owner.select(copy(row.measured));
  if (row.error) assert.throws(run); else assert.deepEqual(run(), row.value);
  assert.deepEqual(sourceView(owner.selected), row.selected, 'Compare action, full facts, rule order and all alternative displayed rows');
  assert.match(row.qualification, /constructed metadata/);
});

for (const row of fixture.helperCases) test(`symbol transactions original format boundary: ${row.id}`, () => {
  assert.equal(row.operation, 'substitute');
  const run = () => substitute(...copy(row.arguments) as [any, R]);
  if (row.error) assert.throws(run); else assert.deepEqual(run(), row.value);
});

test('symbol transactions oracle executes unchanged source, real geometry and SRC and discloses component scope', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.symbol-transactions-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false);
  assert.ok(fixture.sourceFilesVerifiedBeforeAndAfter > 1700);
  assert.equal(fixture.actionsDispatched, 0);
  assert.equal(fixture.completeInterfaceCoverage, true, 'A development --guide-only artifact cannot pass the final gate');
  assert.match(fixture.qualification, /synthetic/); assert.match(fixture.qualification, /No game dispatch/);
  for (const [name, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.referenceCommit}/source/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, name);
  }
  assert.equal(fixture.inputCorpora.length, 1);
  for (const source of fixture.inputCorpora) {
    const bytes = readFileSync(new URL(`../${source.path}`, import.meta.url));
    assert.equal(bytes.length, source.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256, source.path);
    assert.match(source.use, /expected values independently recomputed/);
  }
  for (const [path, name] of [
    ['agents/yf_arc3_v5/capabilities/concentric_frames.py', 'measure_concentric_frames'],
    ['agents/yf_arc3_v5/capabilities/symbolic_diagrams.py', 'measure_diagram_rows'],
    ['agents/yf_arc3_v5/capabilities/symbolic_diagrams.py', 'measure_diagram_transition'],
    ['agents/yf_arc3_v6/morphology_policy/symbol_transactions/geometry.py', 'project'],
    ['agents/yf_arc3_v6/morphology_policy/symbol_transactions/family.py', 'SymbolTransactions.propose'],
    ['agents/yf_arc3_v6/morphology_policy/symbol_transactions/family.py', 'SymbolTransactions.measure'],
    ['agents/yf_arc3_v6/morphology_policy/symbol_transactions/family.py', 'SymbolTransactions.select'],
    ['agents/yf_arc3_v6/morphology_policy/symbol_transactions/family.py', 'SymbolTransactions.before'],
    ['agents/yf_arc3_v6/morphology_policy/symbol_transactions/family.py', 'SymbolTransactions.record'],
    ['agents/yf_arc3_v6/morphology_policy/symbol_transactions/interface.py', 'Interface.record'],
    ['agents/yf_arc3_v6/morphology_policy/symbol_transactions/interface.py', 'Interface.build_method'],
    ['agents/yf_arc3_v6/morphology_policy/symbol_transactions/interface.py', 'Interface.options'],
  ]) assert.ok(fixture.executedSourceFunctions.some((row: R) => row.path === path && row.function === name && row.calls > 0), `${path}:${name}`);
});

test('symbol transactions cold guide SRC, point/frame identities and active no-effect rejection match the continuous source chain', async () => {
  const owner = await SymbolTransactions.create(), row = fixture.kernelControlled;
  assert.equal(row.sessionId, 'symbols:synthetic');
  assert.equal(row.observation.observation_ref, `${row.sessionId}:epoch:1:revision:1:frame:${row.public.frame_hash}`);
  assert.deepEqual(row.observation.available_action_refs, ['ACTION6']);
  assert.equal(owner.src_calls, 0);
  const proposed = await owner.proposeSource(copy(row.observation), copy(row.rows), copy(row.inputs), row.remaining) as R;
  assert.deepEqual(sourceView(proposed), row.proposal);
  assert.deepEqual(owner.state(), row.afterProposeState);
  assert.equal(proposed.kind, 'public_symbol_transaction');
  assert.equal(proposed.bundle_template.operation_key, 'OP18');
  assert.equal(proposed.symbol_transaction_plan.workflow.workflow, 'v6.symbol_transactions.choose');
  assert.equal(proposed.symbol_transaction_plan.workflow.src_status, 'completed');
  assert.notEqual(proposed.symbol_transaction_plan.entity_ref, proposed.steps[0].point_binding.entity_ref,
    'Guide frame and clicked entity have independent measured identities');
  assert.equal(proposed.steps[0].expected_after, null);
  assert.equal(proposed.symbol_transaction_plan.effect_status, 'unknown_until_sealed_observation');
  assert.deepEqual(owner.before(proposed, 0, copy(row.public), copy(row.observation)), row.beforeCurrent);
  assert.deepEqual(owner.recordSource(copy(row.observation), copy(row.noEffectObservation), copy(proposed.actions[0]),
    copy(row.rows), copy(row.rows), proposed, 0), row.noEffectReturn);
  assert.deepEqual(owner.state(), row.noEffectState);
  assert.equal(await owner.proposeSource(copy(row.noEffectObservation), copy(row.rows), copy(row.inputs), row.remaining), row.postRefutationProposal);
  assert.equal(owner.events.at(-1)!.universal_law_confirmed, false);
  assert.deepEqual(owner.recordSource(copy(row.noEffectObservation), copy(row.boundaryObservation), copy(proposed.actions[0]),
    copy(row.rows), copy(row.rows), proposed, 0), row.boundaryReturn);
  assert.deepEqual(owner.state(), row.boundaryState);
  assert.deepEqual(await owner.proposeSource(copy(row.boundaryObservation), copy(row.rows), copy(row.inputs), row.remaining), row.postBoundaryProposal);
});

test('symbol transactions measured diagram return updates the integer counter and the next DRM conclusion', async () => {
  const owner = await SymbolTransactions.create(), row = fixture.transitionControlled;
  const proposal = await owner.proposeSource(copy(row.before), copy(row.first), copy(row.inputs), row.remaining) as R;
  assert.deepEqual(proposal, row.proposal);
  assert.deepEqual(owner.recordSource(copy(row.before), copy(row.after), copy(proposal.actions[0]), copy(row.first), copy(row.second), proposal, 0), row.event);
  assert.equal(row.event.diagram_operand_removal_result_appearance_matches, 1);
  assert.equal(owner.transition_count, 1);
  assert.deepEqual(owner.state(), row.afterState);
  const next = await owner.proposeSource(copy(row.after), copy(row.second), copy(row.inputs), row.remaining) as R;
  assert.deepEqual(next, row.nextProposal);
  assert.equal(next.symbol_transaction_plan.conclusions.symbol_diagram_effect_support, 'observed_operand_removal_and_result_appearance');
});

test('symbol transactions nested interface learns by original contrasts, then owner SRC and active refutation match', async () => {
  const owner = await SymbolTransactions.create(), row = fixture.interfaceControlled;
  assert.ok(row, 'The acquired interface chain is required');
  assert.match(row.qualification, /No learned state injected/);
  assert.match(row.qualification, /not all chosen by the cold common caller/);
  for (const step of row.acquisitionSteps) {
    assert.deepEqual(owner.interface.record(...copy(step.arguments) as [R, R, R, NativeRows, NativeRows, R]), step.value, step.id);
    assert.deepEqual(owner.state(), step.afterState, `${step.id}: complete source state`);
  }
  assert.deepEqual(owner.state(), row.acquiredState);
  const proposed = await owner.proposeSource(copy(row.next.observation), copy(row.next.rows), copy(row.next.inputs), row.next.remaining) as R;
  assert.deepEqual(proposed, row.proposal);
  assert.equal(proposed.symbol_transaction_plan.mode, 'interface');
  assert.deepEqual(owner.state(), row.afterProposeState);
  assert.deepEqual(owner.before(proposed, 0, copy(row.public), copy(row.next.observation)), row.beforeCurrent);
  assert.deepEqual(owner.recordSource(copy(row.next.observation), copy(row.noEffectObservation), copy(proposed.actions[0]),
    copy(row.next.rows), copy(row.next.rows), proposed, 0), row.noEffectReturn);
  assert.deepEqual(owner.state(), row.noEffectState);
  assert.equal(await owner.proposeSource(copy(row.noEffectObservation), copy(row.next.rows), copy(row.next.inputs), row.next.remaining), row.postRefutationProposal);
});

test('symbol transactions native checkpoint is immutable, round-trips exact source state and clears transient selection', async () => {
  const row = fixture.kernelControlled, owner = await SymbolTransactions.create();
  owner.restore(copy(row.noEffectState));
  const checkpoint = owner.nativeState(), revision = owner.nativeRevision;
  assert.equal(checkpoint.format, 'native.public_symbol_transaction.v1');
  assert.deepEqual(checkpoint.source_state, row.noEffectState);
  assert.equal(owner.nativeState(), checkpoint);
  assert.equal(owner.nativeRevision, revision);
  assert.ok(Object.isFrozen(checkpoint)); assert.ok(Object.isFrozen(checkpoint.source_state));
  const published = owner.sourceState(); published.events.length = 0;
  assert.deepEqual(owner.state(), row.noEffectState, 'Public reads cannot mutate authoritative state');
  const restored = await SymbolTransactions.create(); restored.restoreNative(checkpoint);
  assert.deepEqual(restored.sourceState(), row.noEffectState);
  assert.equal(restored.src_calls, 0); assert.equal(restored.selected, null);
  assert.deepEqual(restored.measured, {}); assert.deepEqual(restored.observation, {});
  assert.equal(await restored.proposeSource(copy(row.noEffectObservation), copy(row.rows), copy(row.inputs), row.remaining), null);
  const currentRevision = restored.nativeRevision;
  restored.restoreNative(restored.nativeState());
  assert.equal(restored.nativeRevision, currentRevision);
  assert.equal(restored.selected, null, 'Restoration does not reissue an old selection');
  restored.scope(copy(row.boundaryObservation));
  assert.ok(restored.nativeRevision > currentRevision);
  assert.deepEqual(restored.state().events, row.noEffectState.events, 'Scope changes preserve the event history');
});

test('symbol transactions rejects malformed native checkpoints atomically without changing either nested interface or source state', async () => {
  const owner = await SymbolTransactions.create(); owner.restore(copy(fixture.interfaceControlled.noEffectState));
  const original = owner.nativeState(), source = owner.sourceState(), revision = owner.nativeRevision;
  const variants = [
    { ...copy(original), format: 'native.public_ranked_workshop.v1' },
    { ...copy(original), added: true },
    { format: original.format, source_state: {} },
    { format: original.format, source_state: { ...copy(source), transition_count: -1 } },
    { format: original.format, source_state: { ...copy(source), events: [null] } },
    { format: original.format, source_state: { ...copy(source), interface_state: { ...copy(source.interface_state), methods: [null] } } },
    { format: original.format, source_state: { ...copy(source), interface_state: { ...copy(source.interface_state), extra: [] } } },
  ];
  for (const malformed of variants) {
    assert.throws(() => owner.restoreNative(malformed));
    assert.deepEqual(owner.sourceState(), source);
    assert.equal(owner.nativeState(), original);
    assert.equal(owner.nativeRevision, revision);
  }
  const invalidPartial = { epoch: 7, interface_state: { refutations: [null] } };
  assert.throws(() => owner.restore(invalidPartial));
  assert.deepEqual(owner.sourceState(), source, 'Native partial-state validation precedes mutation');
});

test('symbol transactions registry callbacks execute the actual SRC and source entry adds only its declared material subquestion', async () => {
  const owner = await SymbolTransactions.create(), row = fixture.kernelControlled;
  const registrations: R[] = [], requests: R[] = [];
  await owner.attachPrograms({ async registerProgram(id, callbacks) {
    registrations.push({ id, callbacks: Object.keys(callbacks).sort() });
    const program = await NativeSrcProgram.create(id, callbacks);
    return { workflowId: id, async run(input, options) { requests.push(copy(input)); return program.run(input, options); } };
  } });
  const proposal = await owner.proposeInSubquestion('factored_material_return', 'observed_symbol_transaction',
    copy(row.observation), copy(row.rows), copy(row.inputs), row.remaining);
  assert.deepEqual(registrations, [{ id: 'v6.symbol_transactions.choose', callbacks: ['symbols.measure', 'symbols.select'] }]);
  assert.deepEqual(requests, [{ request: { observation_ref: row.observation.observation_ref } }]);
  assert.deepEqual(proposal, { ...copy(row.proposal), material_access_subquestion: 'observed_symbol_transaction' });
  for (const [group, question] of [['goal_access', 'observed_symbol_transaction'], ['factored_material_return', 'observed_ranked_workshop']]) {
    await assert.rejects(owner.proposeInSubquestion(group!, question!, copy(row.observation), copy(row.rows), copy(row.inputs), row.remaining));
  }
  assert.equal(owner.src_calls, 1);
});

test('symbol transactions native active-return adapter stores exactly one source return and has no passive callback', async () => {
  const owner = await SymbolTransactions.create(), row = fixture.kernelControlled;
  owner.restore(copy(row.afterProposeState));
  const result = owner.record(copy(row.observation) as NativeObservation, copy(row.noEffectObservation) as NativeObservation,
    copy(row.proposal.actions[0]) as NativeCommand, copy(row.rows), copy(row.rows), copy(row.proposal), 0, []);
  assert.deepEqual(result, { events: [row.noEffectReturn] });
  assert.deepEqual(owner.sourceState(), row.noEffectState);
  assert.equal(owner.events.length, row.afterProposeState.events.length + 1);
  assert.equal('recordPassive' in owner, false);
  assert.equal('passiveRecord' in owner, false);
  assert.deepEqual(owner.before(copy(row.proposal), 1, copy(row.public) as NativePublicObservation, copy(row.observation)),
    { admitted: false, reason: 'symbol_frame_binding_changed' });
});
