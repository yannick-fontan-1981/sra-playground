import assert from 'node:assert/strict';
import { seal } from './sceau.mjs';
import { predictLocal } from './predire.mjs';
import { compareLocal } from './comparer.mjs';

export function verifyIsolation(entries, receipts, sealedPredictions) {
  const predict = list => list.map(predictLocal);
  assert.deepEqual(predict(entries).map(p => p.decision), ['P07', 'P05']);
  assert.deepEqual(compareLocal(sealedPredictions, receipts).map(row => row.verdict), ['accord', 'accord']);
  const poisoned = receipts.map(r => ({ ...r, strategy: 'leurre', command: 'leurre',
    proposalDigest: 'leurre', nextObservation: 'leurre', ticket: 'leurre' }));
  assert.deepEqual(compareLocal(sealedPredictions, poisoned).map(row => row.verdict), ['écart', 'écart']);
  assert.deepEqual(predict(entries), sealedPredictions.event);
  assert.equal(compareLocal(seal([]), receipts)[0].verdict, 'indéterminé');
  assert.equal(compareLocal(seal([...sealedPredictions.event, sealedPredictions.event[0]]), receipts)[0].verdict, 'indéterminé');
  assert.equal(compareLocal(sealedPredictions, [...receipts, receipts[0]])[0].verdict, 'indéterminé');
  assert.equal(compareLocal(sealedPredictions, [{ ...receipts[0], observationRef: 'observation-étrangère' }])[0].verdict, 'indéterminé');
  assert.equal(compareLocal(sealedPredictions, [{ ...receipts[0], strategy: null }])[0].verdict, 'indéterminé');
  assert.throws(() => compareLocal({ ...sealedPredictions, sha256: 'altéré' }, receipts), /altérées/);

  const second = entries[1].event;
  const withFacts = facts => predictLocal(seal({ ...second, facts })).decision;
  const { routeSupported, ...withoutRoute } = second.facts;
  assert.equal(routeSupported, false);
  assert.equal(withFacts(withoutRoute), 'indéterminé');
  assert.equal(withFacts({ ...withoutRoute, routeSupported: false }), 'P05');
  assert.equal(withFacts({ ...second.facts, routeSupported: true, eligibleProbe: false }), 'P07');
  assert.equal(withFacts({ ...second.facts, eligibleProbe: false, knownInteraction: true }), 'P02');
  assert.equal(withFacts({ ...second.facts, eligibleProbe: false }), 'abstention');
  assert.equal(predictLocal(null).decision, 'indéterminé');
  assert.equal(predictLocal(seal({ ...second, family: 'autre_famille' })).decision, 'indéterminé');
  assert.equal(predictLocal(seal({ ...second, evidence: [] })).decision, 'indéterminé');
  assert.throws(() => predictLocal({ event: second, sha256: 'altéré' }), /Empreinte/);
  for (const name of ['strategy', 'command', 'proposal', 'ticket', 'nextObservation']) {
    assert.throws(() => predictLocal(seal({ ...second, [name]: 'leurre' })), /hors contrat/);
  }
}
