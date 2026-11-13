import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FieldStock,
  type FieldStockDependencies,
  type RetainedAddressedFieldPrior,
} from '../src/logos-engine/field-stock.ts';
import { validateBundle, type CompositionBundle } from '../src/logos-engine/v6-composition-engine.ts';
import { releaseBundle } from '../src/logos-engine/v6-native-authority.ts';
import type { PublicObservationLike } from '../src/logos-engine/linked-preparation.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';

const prior: RetainedAddressedFieldPrior = {
  action_ref: 'ACTION6',
  lower_squared: 4,
  upper_squared: 9,
  boundary: 'boundary',
  request_row: 1,
  goal_region: { size: [1,1], envelope: [[0,0]] },
  class_templates: {
    '1': { size:[1,1], offset:[0,0], mask:[[0,0]], alignment_supported:true },
    '2': { size:[1,1], offset:[0,0], mask:[[0,0]], alignment_supported:true },
    '3': { size:[1,1], offset:[0,0], mask:[[0,0]], alignment_supported:true },
  },
  qualification: 'retained',
};

function observation(ref='obs', available_action_refs: readonly string[]=['ACTION6']): PublicObservationLike {
  return {
    observation_ref: ref,
    revision: 7,
    level_epoch: 2,
    levels_completed: 1,
    state: 'NOT_FINISHED',
    frame_hash: ref,
    available_action_refs,
    entities: [],
  };
}

function grid(points: Array<readonly [number,number,number]>): number[][] {
  const out = Array.from({length:6},()=>Array(8).fill(0));
  for (const [x,y,value] of points) out[y]![x] = value;
  return out;
}

function stockFixture(): FieldStock {
  const stock = new FieldStock();
  stock.prior = structuredClone(prior);
  stock.epoch = 2;
  stock.order = [1,2,3];
  stock.requests = [];
  stock.demands = new Map([[2,1]]);
  stock.zones = [{ bbox:[4,1,4,1], point:[4,1], source_ref:'scene' }];
  stock.interfaceBoxes = [];
  stock.lower = 4;
  stock.upper = 9;
  stock.actionRef = 'ACTION6';
  stock.templates = structuredClone(prior.class_templates!);
  stock.rules = {};
  stock.motionTypes = new Set([1,2,3]);
  stock.sceneRef = 'scene';
  return stock;
}

const deps: FieldStockDependencies = {
  digest(value) {
    return 'digest-' + JSON.stringify(value).length.toString(16).padStart(16,'0');
  },
  makeLocusWitness(observation, _rows, point, reason, evidence) {
    return { observation_ref:observation.observation_ref, point, reason, evidence };
  },
};

test('preservation obligations retain only currently observed demand counts', () => {
  const stock = stockFixture();
  const obligations = stock.preservationObligations(observation(), grid([[1,1,2]]), deps);
  assert.equal(obligations.length,1);
  assert.equal(obligations[0]?.entity_predicate.palette_value,2);
  assert.equal(obligations[0]?.entity_predicate.minimum_count,1);
  assert.deepEqual(obligations[0]?.evidence,['scene','obs']);
});

test('known retained movement produces a bounded multi-step proposal toward a demand zone', () => {
  const stock = stockFixture();
  const proposal = stock.propose(observation(), grid([[1,1,2]]), 16, deps);
  assert.equal(proposal?.status,'proposed');
  assert.equal(proposal?.kind,'typed_field_stock');
  assert.deepEqual(proposal?.actions,[
    {action_ref:'ACTION6',data:{x:3,y:1}},
    {action_ref:'ACTION6',data:{x:4,y:1}},
  ]);
  const plan = proposal?.field_plan as Record<string, unknown>;
  assert.equal(plan.stock,true);
  assert.deepEqual((proposal?.binding as Record<string, unknown>).observation_ref,'obs');
  assert.equal((proposal?.bundle_template as Record<string, unknown>).operation_key,'OP18');
});

test('unknown rewrite closes the proposal after the first experiment', () => {
  const stock = stockFixture();
  stock.demands = new Map([[2,1]]);
  stock.motionTypes.clear();
  stock.rules = {};
  const rows = grid([[1,1,1],[3,1,1]]);
  const proposal = stock.propose(observation(), rows, 16, deps);
  assert.equal(proposal?.status,'proposed');
  assert.equal(proposal?.actions.length,1);
  const steps = proposal?.steps as Array<Record<string, unknown>>;
  assert.equal(steps[0]?.expected_after,null);
});

test('refuted stock reports refutation and never produces actions', () => {
  const stock = stockFixture();
  stock.invalid = { reason:'observed_rewrite_context_changed' };
  const proposal = stock.propose(observation(), grid([[1,1,2]]), 16, deps);
  assert.equal(proposal?.status,'typed_field_applicability_refuted');
  assert.deepEqual(proposal?.actions,[]);
});

test('unavailable addressed action prevents a stock proposal', () => {
  const stock = stockFixture();
  assert.equal(stock.propose(observation('obs', ['ACTION1']), grid([[1,1,2]]), 16, deps), null);
});

test('runtime exposes proposal only after a currently revalidated stock exists', () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  assert.equal(runtime.proposeStock(observation(), grid([[1,1,2]]), 16, deps), null);
  runtime.field.stock = stockFixture();
  assert.equal(runtime.proposeStock(observation(), grid([[1,1,2]]), 16, deps)?.status,'proposed');
});

test('FieldStock bundle template is admitted by the existing OP18 native authority', () => {
  const stock = stockFixture();
  const proposal = stock.propose(observation(), grid([[1,1,2]]), 16, deps);
  assert.equal(proposal?.status,'proposed');

  const composition = (proposal?.compositions as Array<Record<string, unknown>>)[0]!;
  const template = proposal?.bundle_template as Record<string, unknown>;
  const bundle: CompositionBundle = {
    ...template,
    id:'bundle:field-stock',
    operation_key:'OP18',
    composition_ref:String(template.composition_ref),
    objective_ref:'G_official_completion',
    preserve_refs:[],
    observation_revision:7,
    kind:'probe',
    actions:proposal!.actions,
    purpose:String(template.purpose),
    preconditions:template.preconditions as Record<string, unknown>,
    evidence:template.evidence as unknown[],
    outcome_guard:template.outcome_guard as {path:['value'];contains:string},
  };

  const state = {
    compositions:[
      { id:'G_official_completion', observed:true },
      composition,
    ],
    facts:proposal?.facts,
  };
  assert.equal(validateBundle(bundle,state,7),true);
  const released = releaseBundle(bundle,state,{
    episodeId:'episode',
    levelEpoch:2,
    observationId:'obs',
    observationRevision:7,
  });
  assert.equal(released.need.status,'needed');
  assert.equal(released.releaseAllowed,true);
  assert.deepEqual(released.result?.result.value,[bundle.composition_ref]);
});
