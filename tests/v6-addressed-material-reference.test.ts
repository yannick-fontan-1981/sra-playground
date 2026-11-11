/** Independent expectations are exported only by the immutable original Python.
 * Native checkpoint restoration is tested separately from that source API: the
 * original defines no checkpoint format. No native output generates a fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { AddressedMaterial, ADDRESSED_MATERIAL_STATE_SCHEMA } from '../src/logos-engine/v6-addressed-material.ts';
import { center, support, distanceSquared, targetCandidates, transientContour } from '../src/logos-engine/v6-addressed-field.ts';
import { FieldStock } from '../src/logos-engine/v6-field-stock.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-addressed-material-reference.json.gz', import.meta.url))).toString());
function difference(actual: any, expected: any, path = '$'): string | null {
  if (Object.is(actual, expected)) return null;
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object')
    return `${path}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`;
  if (Array.isArray(actual) !== Array.isArray(expected)) return `${path}: collection type differs`;
  if (Array.isArray(actual)) {
    if (actual.length !== expected.length) return `${path}.length: ${actual.length} !== ${expected.length}`;
    for (let i = 0; i < actual.length; i++) { const found = difference(actual[i], expected[i], `${path}[${i}]`); if (found) return found; }
    return null;
  }
  const a = Object.keys(actual).sort(), b = Object.keys(expected).sort();
  if (JSON.stringify(a) !== JSON.stringify(b)) return `${path}: keys ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
  for (const key of a) { const found = difference(actual[key], expected[key], path + '.' + key); if (found) return found; }
  return null;
}
function exact(actual: any, expected: any, context: string): void {
  const found = difference(actual, expected); assert.equal(found, null, context + (found ? ': ' + found : ''));
}
type Caller = { proposal?: R | null };
async function invoke(owner: AddressedMaterial, operation: R, caller: Caller): Promise<R> {
  const i = structuredClone(operation.input);
  switch (operation.method) {
    case 'propose': {
      const result = await owner.propose(i.observation, i.rows, i.inputs, i.remaining);
      caller.proposal = structuredClone(result); return { result };
    }
    case 'record': return { result: owner.recordSource(i.before, i.after, i.command, i.first, i.second, i.proposal, i.index, i.frames) };
    case 'before': return { result: await owner.before(i.proposal, i.index, i.public, i.observation) };
    case 'after': return { result: await owner.after(i.proposal, i.index, i.before, i.after, i.first, i.second) };
    case 'bind': {
      // Proposals belong to the caller, independently of owner restoration.
      // Keep the actual native proposal aliases: JSON duplicates steps and
      // field_plan.steps, whereas both original and native direct results share
      // these branches. Compare their full public values before and after bind.
      assert.ok(caller.proposal); exact(caller.proposal, i.proposal, 'bind receives its preceding native proposal');
      const proposal = structuredClone(caller.proposal);
      owner.bind(proposal, new ObservedInputDomain(4096)); caller.proposal = structuredClone(proposal);
      return { result: null, proposalAfterBind: proposal };
    }
    case 'preservation_obligations': return { result: owner.preservationObligations(i.observation, i.rows) };
    case 'stock.bodies': assert.ok(owner.stock); return { result: owner.stock.bodies(i.rows) };
    case 'stock.allocations': assert.ok(owner.stock); return { result: owner.stock.allocations(i.bodies) };
    case 'stock.retained': assert.ok(owner.stock); return { result: owner.stock.retained(i.boundary) };
    default: throw new Error('Unexecuted addressed original operation: ' + operation.method);
  }
}
type Cursor = { observation: R; rows: any[] };
function cursorAfter(operation: R, previous: Cursor | null): Cursor | null {
  const i = operation.input;
  if (operation.method === 'record' || operation.method === 'after') return { observation: i.after, rows: i.second };
  if (operation.method === 'before') return { observation: i.observation, rows: i.public.frame_rows };
  if (operation.method === 'propose' || operation.method === 'preservation_obligations') return { observation: i.observation, rows: i.rows };
  return previous;
}
async function restoredContinuations(state: R, retained: R, cursor: Cursor | null, context: string): Promise<void> {
  const fromCopy = new AddressedMaterial(), fromOwned = new AddressedMaterial();
  fromCopy.restore(state); fromOwned.restoreNative(retained);
  exact(fromCopy.sourceState(), fromOwned.sourceState(), context + ': restored source variables');
  if (!cursor) return;
  const observed = await AddressedMaterial.fullObservation(structuredClone(cursor.observation), cursor.rows);
  // These are detached extension probes. They never modify the owners replaying
  // the original call sequence, including lazy stock/minimum acquisitions.
  const copyProposal = await fromCopy.propose(structuredClone(observed), cursor.rows, [], 16);
  const ownedProposal = await fromOwned.propose(structuredClone(observed), cursor.rows, [], 16);
  exact(copyProposal, ownedProposal, context + ': next proposal after two restoration paths');
  exact(fromCopy.sourceState(), fromOwned.sourceState(), context + ': state after restored proposal');
  const copyObligations = fromCopy.preservationObligations(structuredClone(observed), cursor.rows);
  const ownedObligations = fromOwned.preservationObligations(structuredClone(observed), cursor.rows);
  exact(copyObligations, ownedObligations, context + ': obligations after two restoration paths');
  exact(fromCopy.sourceState(), fromOwned.sourceState(), context + ': state after restored obligations');
}

test('addressed material oracle pins the source and declares its transport and extension boundaries', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.addressed-material-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.mode, 'declared-synthetic-public-returns');
  assert.deepEqual(fixture.inputJournals, []);
  assert.deepEqual(fixture.sourceModules, ['common_addressed_material', 'common_addressed_field', 'common_field_stock', 'common_linked_preparation']);
  assert.ok(fixture.qualifications.some((value: string) => value.includes('Python does not define a checkpoint API')));
  for (const chain of fixture.chains) assert.equal(Object.hasOwn(chain.initialState, 'current_observation'), false, chain.id);
  const exceptions = fixture.helpers.filter((row: R) => row.exception).length
    + fixture.chains.reduce((sum: number, chain: R) => sum + chain.operations.filter((row: R) => row.exception).length, 0);
  assert.equal(fixture.exceptions.length, exceptions, 'source exceptions remain explicit, including zero exceptions');
});

for (const helper of fixture.helpers) test('addressed material original helper: ' + helper.id, async () => {
  const i = structuredClone(helper.input); let actual: any, error: Error | null = null;
  try {
    switch (helper.method) {
      case 'center': actual = center(i.box); break;
      case 'support': actual = [...support(i.entity)].map(value => JSON.parse(value)).sort((a, b) => a[0] - b[0] || a[1] - b[1]); break;
      case 'distance_squared': actual = distanceSquared(i.point, i.pixels); break;
      case 'target_candidates': actual = targetCandidates(i.observation, i.mobile, i.rows); break;
      case 'transient_contour': actual = transientContour(i.first, i.frames, i.point); break;
      case 'full_observation': actual = await AddressedMaterial.fullObservation(i.observation, i.rows); break;
      case 'stock_create': actual = FieldStock.create(i.prior, i.observation, i.rows)?.sourceState() ?? null; break;
      default: throw new Error('Unexecuted addressed original helper: ' + helper.method);
    }
  } catch (caught) { error = caught as Error; }
  if (helper.exception) {
    assert.ok(error, helper.id + ': retained source exception'); assert.equal(error.message, helper.exception.message, helper.id + ': exception message');
  } else { assert.equal(error, null, helper.id + ': unexpected native exception'); exact(actual, helper.result, helper.id); }
});

for (const chain of fixture.chains) test('addressed material original cold chain and native restoration: ' + chain.id, async () => {
  const live = new AddressedMaterial(); let restoredCopy = new AddressedMaterial(), restoredOwned = new AddressedMaterial(), cursor: Cursor | null = null;
  const callers: Caller[] = [{}, {}, {}];
  exact(live.sourceState(), chain.initialState, chain.id + ': initial state');
  exact(restoredCopy.sourceState(), chain.initialState, chain.id + ': initial copy state');
  exact(restoredOwned.sourceState(), chain.initialState, chain.id + ': initial owned state');
  for (let index = 0; index < chain.operations.length; index++) {
    const operation = chain.operations[index], context = chain.id + ':' + index + ':' + operation.method;
    for (const [stream, [label, owner]] of ([['live', live], ['state/restore', restoredCopy], ['nativeState/restoreNative', restoredOwned]] as const).entries()) {
      let actual: R | undefined, error: Error | null = null;
      try { actual = await invoke(owner, operation, callers[stream]!); } catch (caught) { error = caught as Error; }
      if (operation.exception) {
        assert.ok(error, context + ':' + label + ': retained source exception');
        assert.equal(error.message, operation.exception.message, context + ':' + label + ': exception message');
      } else {
        assert.equal(error, null, context + ':' + label + ': unexpected native exception');
        exact(actual?.result, operation.result, context + ':' + label + ': result');
        if (Object.hasOwn(operation, 'proposalAfterBind')) exact(actual?.proposalAfterBind, operation.proposalAfterBind, context + ':' + label + ': bound proposal');
      }
      exact(owner.sourceState(), operation.state, context + ':' + label + ': all source variables');
    }
    const cloned = restoredCopy.state(), owned = restoredOwned.nativeState();
    assert.equal(cloned.schema, ADDRESSED_MATERIAL_STATE_SCHEMA); assert.equal(owned.schema, ADDRESSED_MATERIAL_STATE_SCHEMA);
    exact(cloned, owned, context + ': native checkpoint representations');
    restoredCopy = new AddressedMaterial(); restoredCopy.restore(cloned);
    restoredOwned = new AddressedMaterial(); restoredOwned.restoreNative(owned);
    exact(restoredCopy.sourceState(), live.sourceState(), context + ': fresh state restore');
    exact(restoredOwned.sourceState(), live.sourceState(), context + ': fresh native restore');
    cursor = cursorAfter(operation, cursor);
    await restoredContinuations(cloned, owned, cursor, context);
  }
});

test('independent fixtures retain the positive path, refutations, cold stock and selected stock acquisitions', () => {
  const chains = new Map<string, R>(fixture.chains.map((chain: R) => [chain.id, chain]));
  const positive = chains.get('field-calibrated-positive')!;
  assert.ok(positive);
  const first = positive.operations.find((row: R) => row.method === 'record');
  assert.deepEqual(first.input.before.available_action_refs, ['ACTION1']);
  assert.deepEqual(first.input.after.available_action_refs, ['ACTION6']);
  const path = positive.operations.find((row: R) => row.method === 'propose' && row.result?.field_plan?.experiment === 'navigation');
  assert.ok(path.result.actions.length >= 2, 'independent field proposal contains a continuous guarded path');
  assert.ok(chains.get('field-counterexample-stationary-inside-known-bound')!.operations.some((row: R) => row.result?.status === 'field_refuted'));
  assert.ok(chains.get('stock-confirmed-rewrite-counterexample')!.operations.some((row: R) => row.result?.status === 'material_rewrite_refuted'));
  assert.ok(chains.get('stock-unselected-preservation-refuted')!.operations.some((row: R) => row.result?.status === 'field_preservation_prediction_refuted'));
  const selected = chains.get('cold-stock-source-selected')!, qualification = selected.publicResponseQualification;
  assert.ok(selected); assert.ok(qualification.observedRewrites >= 2); assert.ok(qualification.observedRelocations >= 1);
  assert.ok(qualification.sourceSelectedCommands <= qualification.actionBound);
  assert.equal(qualification.consultedOwnerOrPredictionForReturns, false);
  for (const transition of qualification.returns) {
    const operation = selected.operations[transition.recordOperation];
    assert.equal(operation.method, 'record'); assert.equal(operation.input.proposal.field_plan.stock, true);
    exact(operation.input.command, operation.input.proposal.actions[operation.input.index], 'executed stock command is independently source-selected');
    exact(operation.input.command, transition.command, 'declared public stock return is bound to the same command');
  }
});
