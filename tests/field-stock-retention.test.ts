import assert from 'node:assert/strict';
import test from 'node:test';
import { FieldStock, type FieldStockEntity, type RetainedAddressedFieldPrior } from '../src/logos-engine/field-stock.ts';
import { createAddressedFieldRetentionState, crossAddressedFieldBoundary } from '../src/logos-engine/addressed-field-retention.ts';
import { ObservedAddressedMaterialRuntime } from '../src/runtime/observed-addressed-material-runtime.ts';
import type { PublicObservationLike } from '../src/logos-engine/linked-preparation.ts';

const rows=Array.from({length:8},()=>Array(12).fill(0));
const square=(palette:number,bbox:readonly [number,number,number,number],mask:readonly (readonly [number,number])[]=[[0,0],[1,0],[0,1],[1,1]]):FieldStockEntity=>({palette_value:palette,bbox,mask,rectangular:true});
const enclosureMask=[[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]] as const;
const prior=():RetainedAddressedFieldPrior=>({action_ref:'ACTION6',lower_squared:4,upper_squared:9,boundary:'b0',request_row:5,
  goal_region:{size:[3,3],envelope:[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]]},
  class_templates:{'2':{size:[2,2],offset:[1,1],mask:[[0,0],[1,0],[0,1],[1,1]],alignment_supported:true}},
  qualification:'retained local hypothesis; new occurrence and field require revalidation'});
function observation(ref:string,epoch:number,completed:number,entities:FieldStockEntity[]):PublicObservationLike{
  return {observation_ref:ref,revision:1,level_epoch:epoch,levels_completed:completed,state:'NOT_FINISHED',frame_hash:ref,available_action_refs:['ACTION6'],entities};
}
function revalidationScene(ref='new'){return observation(ref,2,1,[square(1,[1,1,2,2]),square(2,[4,1,5,2]),square(3,[7,1,8,2]),square(2,[1,5,2,6]),square(9,[7,4,9,6],enclosureMask)]);}

test('FieldStock.create revalidates retained knowledge only against a matching current scene',()=>{
  const stock=FieldStock.create(prior(),revalidationScene(),rows); assert.ok(stock); assert.deepEqual(stock.order,[1,2,3]); assert.equal(stock.demands.get(2),1); assert.equal(stock.zones.length,1); assert.equal(stock.sceneRef,'new');
});
test('a new object/context does not inherit the retained model automatically',()=>{
  const noRequest=observation('other',2,1,[square(1,[1,1,2,2]),square(2,[4,1,5,2]),square(3,[7,1,8,2]),square(9,[7,4,9,6],enclosureMask)]);
  assert.equal(FieldStock.create(prior(),noRequest,rows),null);
});
test('retained stock crosses a later boundary as compact prior, not as active stock',()=>{
  const runtime=new ObservedAddressedMaterialRuntime(); runtime.field.prior=prior(); assert.equal(runtime.revalidate(revalidationScene('level2'),rows),'revalidated_stock');
  const before=revalidationScene('before-boundary'); const after=observation('level3',3,2,[]); assert.deepEqual(runtime.boundary(before,after),{crossed:true,officialBoundary:2});
  assert.equal(runtime.field.stock,null); assert.equal(runtime.status(),'retained_pending_revalidation'); assert.equal(runtime.mayUseRetainedKnowledge(),false); assert.equal(runtime.field.prior?.boundary,'level3');
  assert.match(runtime.field.prior?.qualification??'',/next epoch requires fresh bindings/);
});
test('revalidation succeeds after a boundary and enables decision-facing use',()=>{
  const runtime=new ObservedAddressedMaterialRuntime(); runtime.field.prior=prior(); assert.equal(runtime.revalidate(revalidationScene('resume'),rows),'revalidated_stock'); assert.equal(runtime.mayUseRetainedKnowledge(),true);
});
test('failed revalidation preserves prior but refuses applicability',()=>{
  const runtime=new ObservedAddressedMaterialRuntime(); runtime.field.prior=prior(); const incompatible=observation('resume-other',2,1,[square(7,[1,1,2,2])]);
  assert.equal(runtime.revalidate(incompatible,rows),'retained_not_applicable'); assert.ok(runtime.field.prior); assert.equal(runtime.field.stock,null); assert.equal(runtime.mayUseRetainedKnowledge(),false);
});
test('refuted revalidated stock is kept distinct from merely pending knowledge',()=>{
  const runtime=new ObservedAddressedMaterialRuntime(); runtime.field.prior=prior(); assert.equal(runtime.revalidate(revalidationScene(),rows),'revalidated_stock');
  runtime.field.stock!.refute('unselected_material_changed_or_occluded','a','b'); assert.equal(runtime.status(),'refuted'); assert.equal(runtime.mayUseRetainedKnowledge(),false);
});
test('model boundary retention requires two aligned witnesses before promoting alignment support',()=>{
  const state=createAddressedFieldRetentionState(); state.epoch=1; state.upperSquared=9; state.lowerSquared=4; state.samples=[{moved_to_anchor:true},{moved_to_anchor:true}];
  state.model={action_ref:'ACTION6',palette:2,size:[2,2],offset:[1,1],mask:[[0,0],[1,0],[0,1],[1,1]],exemplar:{bbox:[1,4,2,5]},goal:{enclosure:{bbox:[5,2,7,4],mask:enclosureMask}}};
  crossAddressedFieldBoundary(state,observation('l1',1,0,[]),observation('l2',2,1,[])); assert.equal(state.model,null); assert.equal(state.prior?.class_templates?.['2']?.alignment_supported,true);
  assert.match(state.prior?.qualification??'',/new occurrence and field require revalidation/);
});

function stockFixture(): FieldStock {
  const stock = new FieldStock();
  stock.prior = prior();
  stock.epoch = 2;
  stock.order = [1,2,3];
  stock.requests = [];
  stock.demands = new Map();
  stock.zones = [];
  stock.interfaceBoxes = [];
  stock.lower = 4;
  stock.upper = 9;
  stock.actionRef = 'ACTION6';
  stock.templates = {
    '1': { size:[1,1], offset:[0,0], mask:[[0,0]], alignment_supported:true },
    '2': { size:[1,1], offset:[0,0], mask:[[0,0]], alignment_supported:true },
    '3': { size:[1,1], offset:[0,0], mask:[[0,0]], alignment_supported:true },
  };
  stock.rules = {};
  stock.motionTypes = new Set([1,2,3]);
  stock.sceneRef = 'scene';
  return stock;
}

function grid(points: Array<readonly [number,number,number]>): number[][] {
  const out = Array.from({length:6},()=>Array(8).fill(0));
  for (const [x,y,value] of points) out[y]![x] = value;
  return out;
}

function publicFrame(frame_rows: readonly (readonly number[])[], level=2, levels_completed=1) {
  return {
    frame_rows,
    level,
    levels_completed,
    state:'NOT_FINISHED',
    frame_hash:'frame',
    available_action_refs:['ACTION6'],
  };
}

test('FieldStock before admits only the bound current stock and exact first observation', () => {
  const stock = stockFixture();
  const current = grid([[1,1,1],[4,1,2]]);
  const expected = stock.bodies(current);
  const proposal = {
    field_plan:{stock:true},
    steps:[{before_bodies:expected,offer:{kind:'move' as const,selected:[0],point:[2,1] as const,product:1}}],
    binding:{observation_ref:'bound',level_epoch:2,levels_completed:1},
  };
  assert.deepEqual(
    stock.before(proposal,0,publicFrame(current),observation('bound',2,1,[])),
    {admitted:true,reason:'typed_stock_and_address_bound'},
  );
  assert.equal(stock.before(proposal,0,publicFrame(current),observation('other',2,1,[])).admitted,false);
  assert.equal(stock.before(proposal,0,publicFrame(grid([[1,1,1]])),observation('bound',2,1,[])).admitted,false);
});

test('FieldStock after matches a known expected stock and seals at the end of the prefix', () => {
  const stock = stockFixture();
  const first = grid([[1,1,1],[4,1,2]]);
  const second = grid([[2,1,1],[4,1,2]]);
  const beforeBodies = stock.bodies(first);
  const expected = stock.bodies(second);
  const proposal = {
    field_plan:{stock:true},
    steps:[{
      before_bodies:beforeBodies,
      offer:{kind:'move' as const,selected:[0],point:[2,1] as const,product:1},
      expected_after:expected,
    }],
    binding:{observation_ref:'b',level_epoch:2,levels_completed:1},
  };
  assert.deepEqual(
    stock.after(proposal,0,observation('b',2,1,[]),observation('a',2,1,[]),first,second),
    {matched:true,seal_prefix:true,reason:'compare_stable_material_stock'},
  );
  assert.deepEqual(
    stock.after(proposal,0,observation('b',2,1,[]),observation('boundary',3,2,[]),first,second),
    {matched:null,seal_prefix:true,reason:'official_boundary'},
  );
});

test('FieldStock record learns a relocated typed occurrence at the addressed point', () => {
  const stock = stockFixture();
  const first = grid([[1,1,2]]);
  const second = grid([[3,1,2]]);
  const result = stock.record(
    observation('b',2,1,[]),
    observation('a',2,1,[]),
    {action_ref:'ACTION6',data:{x:3,y:1}},
    first,
    second,
  );
  assert.equal(result.status,'material_observation_recorded');
  assert.equal(result.events[0]?.kind,'typed_material_relocated_to_address');
  assert.equal(stock.templates['2']?.alignment_supported,true);
  assert.equal(stock.motionTypes.has(2),true);
});

test('FieldStock record learns a two-parent observed rewrite without claiming conserved pixel identity', () => {
  const stock = stockFixture();
  const first = grid([[1,1,1],[3,1,1]]);
  const second = grid([[2,1,2]]);
  const result = stock.record(
    observation('b',2,1,[]),
    observation('a',2,1,[]),
    {action_ref:'ACTION6',data:{x:2,y:1}},
    first,
    second,
  );
  assert.equal(result.status,'material_observation_recorded');
  assert.equal(stock.rules[1]?.product,2);
  assert.equal(stock.rules[1]?.confirmations,1);
  assert.equal(result.events.at(-1)?.kind,'observed_joint_material_rewrite');
  assert.equal(result.events.at(-1)?.conserved_pixel_identity_claimed,false);
});

test('FieldStock refutes a stock proposal when unselected material changes or disappears', () => {
  const stock = stockFixture();
  const first = grid([[1,1,1],[4,1,2]]);
  const second = grid([[2,1,1]]);
  const beforeBodies = stock.bodies(first);
  const proposal = {
    field_plan:{stock:true},
    steps:[{before_bodies:beforeBodies,offer:{kind:'move' as const,selected:[0],point:[2,1] as const,product:1}}],
    binding:{observation_ref:'b',level_epoch:2,levels_completed:1},
  };
  const result = stock.record(
    observation('b',2,1,[]),
    observation('a',2,1,[]),
    {action_ref:'ACTION6',data:{x:2,y:1}},
    first,
    second,
    proposal,
    0,
  );
  assert.equal(result.status,'field_preservation_prediction_refuted');
  assert.equal(stock.invalid?.reason,'unselected_material_changed_or_occluded');
});

test('FieldStock refutes a confirmed rewrite when the same source type produces another product', () => {
  const stock = stockFixture();
  stock.rules[1] = { product:2, confirmations:1, prior_evidence:['old'], evidence:['confirmed'] };
  const first = grid([[1,1,1],[3,1,1]]);
  const second = grid([[2,1,3]]);
  const result = stock.record(
    observation('b',2,1,[]),
    observation('a',2,1,[]),
    {action_ref:'ACTION6',data:{x:2,y:1}},
    first,
    second,
  );
  assert.equal(result.status,'material_rewrite_refuted');
  assert.equal(stock.invalid?.reason,'observed_rewrite_context_changed');
});

test('FieldStock leaves an unaddressed transition outside the learned stock model', () => {
  const stock = stockFixture();
  const first = grid([[1,1,2]]);
  const second = grid([[3,1,2]]);
  const result = stock.record(
    observation('b',2,1,[]),
    observation('a',2,1,[]),
    {action_ref:'ACTION1'},
    first,
    second,
  );
  assert.deepEqual(result,{status:'material_transition_unaddressed',events:[]});
});

test('runtime integrates learning boundary revalidation guard response and decision gate', () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  runtime.field.epoch = 1;
  runtime.field.upperSquared = 9;
  runtime.field.lowerSquared = 4;
  runtime.field.samples = [{ moved_to_anchor:true }, { moved_to_anchor:true }];
  runtime.field.model = {
    action_ref:'ACTION6',
    palette:2,
    size:[2,2],
    offset:[1,1],
    mask:[[0,0],[1,0],[0,1],[1,1]],
    exemplar:{bbox:[1,4,2,5]},
    goal:{enclosure:{bbox:[5,2,7,4],mask:enclosureMask}},
  };

  const learned = observation('learned-l1',1,0,[]);
  const crossed = observation('entered-l2',2,1,[]);
  assert.deepEqual(runtime.boundary(learned,crossed),{crossed:true,officialBoundary:1});
  assert.equal(runtime.status(),'retained_pending_revalidation');
  assert.equal(runtime.mayUseRetainedKnowledge(),false);

  const currentScene = observation('current-l2',2,1,[
    square(1,[1,1,2,2]),
    square(2,[4,1,5,2]),
    square(3,[7,1,8,2]),
    square(2,[1,4,2,5]),
    square(9,[7,4,9,6],enclosureMask),
  ]);
  assert.equal(runtime.revalidate(currentScene,rows),'revalidated_stock');
  assert.equal(runtime.mayUseRetainedKnowledge(),true);

  const beforeRows = grid([[6,3,2]]);
  const afterRows = grid([[6,4,2]]);
  const beforeBodies = runtime.field.stock!.bodies(beforeRows);
  const afterBodies = runtime.field.stock!.bodies(afterRows);
  const proposal = {
    field_plan:{stock:true},
    steps:[{
      before_bodies:beforeBodies,
      offer:{kind:'move' as const,selected:[0],point:[6,4] as const,product:2},
      expected_after:afterBodies,
    }],
    binding:{observation_ref:'current-l2',level_epoch:2,levels_completed:1},
  };

  assert.equal(runtime.beforeStock(proposal,0,publicFrame(beforeRows),currentScene).admitted,true);
  const recorded = runtime.recordStock(
    observation('before-action',2,1,[]),
    observation('after-action',2,1,[]),
    {action_ref:'ACTION6',data:{x:6,y:4}},
    beforeRows,
    afterRows,
    proposal,
    0,
  );
  assert.equal(recorded.status,'material_observation_recorded');
  assert.equal(recorded.events[0]?.kind,'typed_material_relocated_to_address');
  assert.deepEqual(
    runtime.afterStock(
      proposal,
      0,
      observation('before-action',2,1,[]),
      observation('after-action',2,1,[]),
      beforeRows,
      afterRows,
    ),
    {matched:true,seal_prefix:true,reason:'compare_stable_material_stock'},
  );
  assert.equal(runtime.mayUseRetainedKnowledge(),true);
});

test('runtime refuses stock lifecycle calls before current-scene revalidation', () => {
  const runtime = new ObservedAddressedMaterialRuntime();
  runtime.field.prior = prior();
  const emptyProposal = {
    field_plan:{stock:true},
    steps:[],
    binding:{observation_ref:'x',level_epoch:2,levels_completed:1},
  };
  assert.deepEqual(
    runtime.beforeStock(emptyProposal,0,publicFrame(grid([])),observation('x',2,1,[])),
    {admitted:false,reason:'retained_stock_not_revalidated'},
  );
  assert.equal(
    runtime.recordStock(
      observation('b',2,1,[]),
      observation('a',2,1,[]),
      {action_ref:'ACTION6',data:{x:1,y:1}},
      grid([]),
      grid([]),
    ).status,
    'retained_stock_not_revalidated',
  );
});
