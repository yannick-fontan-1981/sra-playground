import assert from 'node:assert/strict';
import test from 'node:test';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import { KnowledgeStore, postAnalysis } from '../src/logos-engine/v6-target-binding.ts';

function analysisState() {
  return {
    compositions: [{ id: 'B' }],
    expected_properties: { color: 'blue', door: 'open' },
    observed_properties: { color: 'red' },
    knowledge_updates: [
      { composition_ref: 'B', property: 'color', value: 'red', revision: 3, evidence: 'obs3' },
      { composition_ref: 'B', property: 'door', value: 'open', revision: 2, evidence: 'stale' },
    ],
    objective_assessments: [{ composition_ref: 'G', satisfied: false, feasible: 'unknown', new_evidence: ['obs3'] }],
  };
}

test('postAnalysis keeps OP29 and OP31 information-only without inventing decision authority', () => {
  const trace = new OperationTraceSink();
  const receipts = postAnalysis(analysisState(), 'B', {
    needId: 'post-1', observationRevision: 3, decisionRef: 'decision-1', trace, knowledge: new KnowledgeStore(),
  });
  assert.equal(receipts.find(receipt => receipt.op === 'OP29')?.disposition, 'information_only');
  assert.equal(receipts.find(receipt => receipt.op === 'OP31')?.disposition, 'information_only');
  const consumptions = trace.snapshot().events.filter(event => event.kind === 'consumption');
  assert.equal(consumptions.some(event => event.kind === 'consumption' && event.op === 'OP29' && event.semanticEffect === false), true);
  assert.equal(consumptions.some(event => event.kind === 'consumption' && event.op === 'OP31' && event.semanticEffect === false), true);
});

test('OP30 persists only current-revision evidence and survives snapshot restoration', () => {
  const knowledge = new KnowledgeStore();
  const receipts = postAnalysis(analysisState(), 'B', {
    needId: 'post-2', observationRevision: 3, decisionRef: 'decision-2', knowledge,
  });
  const op30 = receipts.find(receipt => receipt.op === 'OP30');
  assert.equal(op30?.disposition, 'persisted_only');
  assert.equal(op30?.writes, 1);
  assert.deepEqual(knowledge.get('knowledge:B:color'), { value: 'red', evidence: 'obs3', revision: 3 });
  assert.equal(knowledge.get('knowledge:B:door'), undefined);

  const snapshot = knowledge.snapshot();
  const restored = new KnowledgeStore();
  restored.restore(snapshot);
  assert.deepEqual(restored.get('knowledge:B:color'), { value: 'red', evidence: 'obs3', revision: 3 });
});

test('replaying the same OP30 update does not duplicate a durable write', () => {
  const knowledge = new KnowledgeStore();
  const options = { needId: 'post-3', observationRevision: 3, decisionRef: 'decision-3', knowledge };
  assert.equal(postAnalysis(analysisState(), 'B', options).find(receipt => receipt.op === 'OP30')?.writes, 1);
  assert.equal(postAnalysis(analysisState(), 'B', options).find(receipt => receipt.op === 'OP30')?.writes, 0);
});

test('missing expectations block OP29 and absent updates/assessments avoid OP30/OP31 execution', () => {
  const trace = new OperationTraceSink();
  const receipts = postAnalysis({ compositions: [{ id: 'B' }] }, 'B', {
    needId: 'post-4', observationRevision: 4, decisionRef: 'decision-4', trace, knowledge: new KnowledgeStore(),
  });
  assert.deepEqual(receipts.map(receipt => [receipt.op, receipt.disposition]), [
    ['OP29', 'blocked'], ['OP30', 'not_required'], ['OP31', 'not_required'],
  ]);
  const operations = trace.snapshot().events.filter(event => event.kind === 'operation');
  assert.equal(operations.every(event => event.kind === 'operation' && event.mode !== 'executed'), true);
});
