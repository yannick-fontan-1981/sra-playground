import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FieldStock,
  type FieldStockDependencies,
  type FieldStockProposalResult,
  type RetainedAddressedFieldPrior,
} from '../src/logos-engine/field-stock.ts';
import {
  type CompositionBundle,
} from '../src/logos-engine/v6-composition-engine.ts';
import { releaseBundle } from '../src/logos-engine/v6-native-authority.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import type { PublicObservationLike } from '../src/logos-engine/linked-preparation.ts';

const prior: RetainedAddressedFieldPrior = {
  action_ref: 'ACTION6',
  lower_squared: 4,
  upper_squared: 9,
  boundary: 'boundary',
  request_row: 1,
  goal_region: { size: [1, 1], envelope: [[0, 0]] },
  class_templates: {
    '1': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
    '2': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
    '3': { size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: true },
  },
  qualification: 'retained',
};

function observation(
  ref = 'obs',
  availableActionRefs: readonly string[] = ['ACTION6'],
): PublicObservationLike {
  return {
    observation_ref: ref,
    revision: 7,
    level_epoch: 2,
    levels_completed: 1,
    state: 'NOT_FINISHED',
    frame_hash: ref,
    available_action_refs: availableActionRefs,
    entities: [],
  };
}

function grid(points: Array<readonly [number, number, number]>): number[][] {
  const rows = Array.from({ length: 6 }, () => Array(8).fill(0));
  for (const [x, y, value] of points) rows[y]![x] = value;
  return rows;
}

function stockFixture(): FieldStock {
  const stock = new FieldStock();
  stock.prior = structuredClone(prior);
  stock.epoch = 2;
  stock.order = [1, 2, 3];
  stock.requests = [];
  stock.demands = new Map([[2, 1]]);
  stock.zones = [{ bbox: [4, 1, 4, 1], point: [4, 1], source_ref: 'scene' }];
  stock.interfaceBoxes = [];
  stock.lower = 4;
  stock.upper = 9;
  stock.actionRef = 'ACTION6';
  stock.templates = structuredClone(prior.class_templates!);
  stock.rules = {};
  stock.motionTypes = new Set([1, 2, 3]);
  stock.sceneRef = 'scene';
  return stock;
}

const dependencies: FieldStockDependencies = {
  digest(value) {
    return `digest-${JSON.stringify(value).length.toString(16).padStart(16, '0')}`;
  },
  makeLocusWitness(current, _rows, point, reason, evidence) {
    return {
      observation_ref: current.observation_ref,
      point,
      reason,
      evidence,
    };
  },
};

function bundleFrom(proposal: FieldStockProposalResult): {
  bundle: CompositionBundle;
  state: Record<string, unknown>;
} {
  const composition = (proposal.compositions as Array<Record<string, unknown>>)[0]!;
  const template = proposal.bundle_template as Record<string, unknown>;
  const bundle: CompositionBundle = {
    ...template,
    id: 'bundle:field-stock:trace',
    operation_key: 'OP18',
    composition_ref: String(template.composition_ref),
    objective_ref: 'G_official_completion',
    preserve_refs: [],
    observation_revision: 7,
    kind: 'probe',
    actions: proposal.actions,
    purpose: String(template.purpose),
    preconditions: template.preconditions as Record<string, unknown>,
    evidence: template.evidence as unknown[],
    outcome_guard: template.outcome_guard as { path: ['value']; contains: string },
  };
  return {
    bundle,
    state: {
      compositions: [
        { id: 'G_official_completion', observed: true },
        composition,
      ],
      facts: proposal.facts,
    },
  };
}

test('FieldStock need reaches OP18 and operationAdmission consumes the result', () => {
  const proposal = stockFixture().propose(
    observation(),
    grid([[1, 1, 2]]),
    16,
    dependencies,
  );
  assert.equal(proposal?.status, 'proposed');
  const { bundle, state } = bundleFrom(proposal!);
  const trace = new OperationTraceSink();

  const released = releaseBundle(bundle, state, {
    episodeId: 'episode',
    levelEpoch: 2,
    observationId: 'obs',
    observationRevision: 7,
  }, trace);

  assert.equal(released.need.status, 'needed');
  assert.equal(released.releaseAllowed, true);
  assert.deepEqual(released.result?.result.value, [bundle.composition_ref]);

  const events = trace.snapshot().events;
  assert.deepEqual(events.map(event => event.kind), [
    'need',
    'operation',
    'consumption',
  ]);
  assert.equal(events[1]?.kind === 'operation' && events[1].op, 'OP18');
  assert.equal(
    events[2]?.kind === 'consumption' && events[2].consumer,
    'operationAdmission',
  );
  assert.equal(
    events[2]?.kind === 'consumption' && events[2].effectKind,
    'guard',
  );
  assert.equal(new Set(events.map(event => event.needId)).size, 1);
});

test('missing addressed action stops the FieldStock producer before any OP call', () => {
  const trace = new OperationTraceSink();
  const proposal = stockFixture().propose(
    observation('obs', ['ACTION1']),
    grid([[1, 1, 2]]),
    16,
    dependencies,
  );
  assert.equal(proposal, null);
  assert.deepEqual(trace.snapshot().events, []);
});

test('changed observation revision invalidates the old FieldStock bundle', () => {
  const proposal = stockFixture().propose(
    observation(),
    grid([[1, 1, 2]]),
    16,
    dependencies,
  );
  const { bundle, state } = bundleFrom(proposal!);
  const trace = new OperationTraceSink();

  assert.throws(() => releaseBundle(bundle, state, {
    episodeId: 'episode',
    levelEpoch: 2,
    observationId: 'obs-new',
    observationRevision: 8,
  }, trace), /Stale composition contract/);

  assert.deepEqual(trace.snapshot().events.map(event => event.kind), ['need']);
});
