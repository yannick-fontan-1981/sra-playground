/** Independent expectations are generated solely by the frozen Python source.
 * Each cold chain also runs through a fresh native checkpoint after every call. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { LinkedTemporalPreparation, LINKED_TEMPORAL_STATE_SCHEMA } from '../src/logos-engine/v6-linked-temporal-preparation.ts';
import { linkedNodes, linkedOpenEnclosures, linkedPhaseSlots } from '../src/logos-engine/v6-linked-temporal-contact.ts';
import { LinkedTemporalPhaseTransfer } from '../src/logos-engine/v6-linked-temporal-phase.ts';
import { temporalBytePatch, temporalCompressed } from '../src/logos-engine/v6-linked-temporal-common.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-linked-preparation-reference.json.gz', import.meta.url))).toString());
function difference(a: any, b: any, path = '$'): string | null {
  if (Object.is(a, b)) return null;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return `${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: collection type differs`;
  if (Array.isArray(a)) { if (a.length !== b.length) return `${path}.length: ${a.length} !== ${b.length}`;
    for (let i = 0; i < a.length; i++) { const d = difference(a[i], b[i], `${path}[${i}]`); if (d) return d; } return null; }
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort();
  if (JSON.stringify(ak) !== JSON.stringify(bk)) return `${path}: keys ${JSON.stringify(ak)} !== ${JSON.stringify(bk)}`;
  for (const k of ak) { const d = difference(a[k], b[k], path + '.' + k); if (d) return d; } return null;
}
function exact(actual: any, expected: any, context: string): void { assert.equal(difference(actual, expected), null, context + ': ' + difference(actual, expected)); }
async function invoke(family: LinkedTemporalPreparation, operation: R): Promise<any> {
  const i = operation.input;
  switch (operation.method) {
    case 'propose': return family.propose(i.observation, i.rows, i.inputs, i.remaining);
    case 'record': return family.recordSource(i.before, i.after, i.command, i.first, i.second, i.proposal, i.index);
    case 'before': return family.before(i.proposal, i.index, i.public, i.observation);
    case 'after': return family.after(i.proposal, i.index, i.before, i.after, i.first, i.second);
    case 'preservation_obligations': return family.preservationObligations(i.observation, i.rows);
    default: throw new Error('Unexecuted oracle operation: ' + operation.method);
  }
}

test('linked temporal oracle pins the original source and retains its explicit exceptions', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.linked-preparation-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.ok(fixture.exceptions.length > 0);
});
for (const helper of fixture.helpers) test('linked temporal original helper: ' + helper.id, async () => {
  const i = helper.input; let actual: any;
  switch (helper.method) {
    case 'open_enclosures': actual = linkedOpenEnclosures(i.observation, i.body, i.quantum); break;
    case 'linked_nodes': actual = linkedNodes(i.observation, i.body, i.quantum); break;
    case 'phase_slots': actual = linkedPhaseSlots(i.observation, i.body, i.details); break;
    case 'full_observation': actual = await LinkedTemporalPreparation.fullObservation(i.observation, i.rows); break;
    case 'compressed': actual = temporalCompressed(i.values); break;
    case 'portable_patch': actual = temporalBytePatch(i.rows, i.position, i.size); break;
    default: throw new Error('Unexecuted oracle helper: ' + helper.method);
  }
  exact(actual, helper.result, helper.id);
});

for (const chain of fixture.chains) test('linked temporal original cold chain and repeated restoration: ' + chain.id, async () => {
  const live = new LinkedTemporalPreparation(); let cold = new LinkedTemporalPreparation();
  for (let index = 0; index < chain.operations.length; index++) {
    const operation = chain.operations[index], context = chain.id + ':' + index + ':' + operation.method;
    for (const [name, family] of [['live', live], ['cold-restored', cold]] as const) {
      const prior = family.sourceState();
      let result: any, error: Error | null = null; try { result = await invoke(family, operation); } catch (caught) { error = caught as Error; }
      const malformedAfter = operation.method === 'record' && operation.exception?.type === 'KeyError'
        && operation.exception.message === "'entities'" && !Object.hasOwn(operation.input.after, 'entities');
      if (malformedAfter) {
        // Python appends a command before its missing-entities KeyError. Its
        // partial state remains in the immutable fixture. Native ingress rejects
        // this out-of-contract observation atomically, before publishing history.
        assert.ok(error instanceof TypeError, context + ' native invalid-input rejection');
        assert.equal(operation.state.phase.commands.length, operation.state.phase.states.length, context + ' retained original partial mutation');
        exact(family.sourceState(), prior, context + ' atomic native rejection'); continue;
      }
      if (operation.exception) { assert.ok(error, context + ' must retain the source refusal'); assert.equal(error.message, operation.exception.message, context + ' exception message'); }
      else { assert.equal(error, null, context + ': unexpected native exception'); exact(result, operation.result, context + ':' + name + ':result'); }
      exact(family.sourceState(), operation.state, context + ':' + name + ':state');
    }
    const checkpoint = cold.state(); cold = new LinkedTemporalPreparation(); cold.restore(checkpoint);
    exact(cold.sourceState(), live.sourceState(), context + ':restoration');
  }
});

for (const component of fixture.components) test('linked temporal explicitly seeded source component: ' + component.id, async () => {
  const family = new LinkedTemporalPreparation(); family.restore({ schema: LINKED_TEMPORAL_STATE_SCHEMA, ...component.setup });
  const i = component.input; let actual: any;
  if (component.method === 'phase.condition_measure') actual = family.phase.conditionMeasure(i.state);
  else if (component.method === 'PhaseTransfer.from_boundary') actual = LinkedTemporalPhaseTransfer.fromBoundary(family.phase, i.before, i.command, i.rows, i.after)?.prior ?? null;
  else if (component.method === 'before' || component.method === 'after') actual = await invoke(family, component);
  else throw new Error('Unexecuted oracle component: ' + component.method);
  exact(actual, component.result, component.id + ':result'); exact(family.sourceState(), component.state, component.id + ':state');
});

test('portable checkpoint retains conditional templates without old-epoch raster histories and rejects inconsistent shapes', () => {
  const setup = fixture.components.find((c: R) => c.id === 'portable-before-valid').setup;
  const family = new LinkedTemporalPreparation(); family.restore({ schema: LINKED_TEMPORAL_STATE_SCHEMA, ...setup });
  const baseline = family.state(), prior = baseline.phase.portable.prior;
  assert.ok(prior.source_validation); assert.ok(prior.entry); assert.ok(prior.boundary);
  assert.equal(baseline.phase.states.length, 1); assert.equal(baseline.phase.commands.length, 0);
  const oldRasterKeys = (value: any): number => value && typeof value === 'object'
    ? Object.entries(value).reduce((sum, [k, v]) => sum + Number(k === 'rows') + oldRasterKeys(v), 0) : 0;
  assert.equal(oldRasterKeys(baseline.phase.portable), 0);
  for (const edit of [(s: R) => { s.phase.portable.prior.shape = '0'.repeat(64); },
    (s: R) => { s.phase.portable.prior.size = [99, 99]; },
    (s: R) => { s.phase.portable.prior.locus_template.pop(); }]) {
    const changed = structuredClone(baseline); edit(changed); assert.throws(() => family.restore(changed), /portable/);
    exact(family.state(), baseline, 'invalid portable checkpoint does not replace owner');
  }
});
