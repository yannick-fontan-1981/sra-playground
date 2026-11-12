import type { CompositionBundle } from '../../src/logos-engine/v6-composition-engine.ts';
import { OperationResultCache } from '../../src/logos-engine/v6-operation-cache.ts';
import { runOperationCycle } from '../../src/logos-engine/v6-operation-cycle.ts';
import { OperationTraceSink } from '../../src/logos-engine/v6-operation-trace.ts';
import { KnowledgeStore } from '../../src/logos-engine/v6-target-binding.ts';

export interface SyntheticSessionOptions {
  cycles: number;
  trace: false | 'counters' | 'full';
  cache: boolean;
}

export interface SyntheticSessionResult {
  released: number;
  op29: number;
  op30: number;
  op31: number;
  knowledgeKeys: string[];
  traceEvents: number;
  cacheSize: number;
}

function bundle(revision: number): CompositionBundle {
  return {
    id: `probe-${revision}`,
    operation_key: 'OP18',
    composition_ref: 'B',
    objective_ref: 'G',
    preserve_refs: ['A'],
    observation_revision: revision,
    kind: 'probe',
    actions: ['ACTION1'],
    purpose: 'measure a bounded unknown effect',
    preconditions: { free: true },
    evidence: [`obs-${revision}`],
    preservation_evidence: { A: `preserve-${revision}` },
    outcome_guard: { path: ['value'], contains: 'B' },
  };
}

function beforeState(revision: number) {
  return {
    compositions: [
      { id: 'A', observed: true },
      { id: 'B', observed: false, open_question: 'bounded unknown effect' },
      { id: 'G', observed: true },
    ],
    facts: { free: true },
  };
}

function afterState(revision: number) {
  return {
    compositions: [{ id: 'B' }],
    observation_revision: revision + 1,
    observation_ref: `obs-${revision + 1}`,
    expected_properties: { color: 'blue', door: 'open' },
    observed_properties: { color: revision % 2 === 0 ? 'blue' : 'red' },
    knowledge_updates: [{
      composition_ref: 'B',
      property: 'color',
      value: revision % 2 === 0 ? 'blue' : 'red',
      revision: revision + 1,
      evidence: `obs-${revision + 1}`,
    }],
    objective_assessments: [{
      composition_ref: 'G',
      satisfied: false,
      feasible: 'unknown',
      new_evidence: [`obs-${revision + 1}`],
    }],
  };
}

export function runSyntheticOperationSession(options: SyntheticSessionOptions): SyntheticSessionResult {
  if (!Number.isInteger(options.cycles) || options.cycles < 1 || options.cycles > 10_000) {
    throw new RangeError('Synthetic cycle count must be in [1, 10000].');
  }
  const trace = options.trace ? new OperationTraceSink(Math.min(4096, options.cycles * 8), options.trace) : undefined;
  const cache = options.cache ? new OperationResultCache(Math.min(1024, options.cycles * 2)) : undefined;
  const knowledge = new KnowledgeStore();
  let released = 0;
  let op29 = 0;
  let op30 = 0;
  let op31 = 0;

  for (let revision = 1; revision <= options.cycles; revision += 1) {
    const result = runOperationCycle(
      bundle(revision),
      beforeState(revision),
      {
        episodeId: 'synthetic-c7',
        levelEpoch: 1,
        observationId: `obs-${revision}`,
        observationRevision: revision,
      },
      afterState(revision),
      { trace, cache, knowledge },
    );
    if (result.released) released += 1;
    for (const receipt of result.postAnalysis) {
      if (receipt.op === 'OP29') op29 += 1;
      if (receipt.op === 'OP30') op30 += 1;
      if (receipt.op === 'OP31') op31 += 1;
    }
  }

  return {
    released,
    op29,
    op30,
    op31,
    knowledgeKeys: Object.keys(knowledge.snapshot()).sort(),
    traceEvents: trace?.snapshot().events.length ?? 0,
    cacheSize: cache?.size ?? 0,
  };
}
