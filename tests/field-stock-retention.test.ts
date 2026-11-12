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