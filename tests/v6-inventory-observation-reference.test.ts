import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as measurements from '../src/logos-engine/v6-inventory-measurements.ts';
import * as initial from '../src/logos-engine/v6-inventory-initial.ts';
import * as contrast from '../src/logos-engine/v6-inventory-contrast.ts';
import * as effect from '../src/logos-engine/v6-inventory-effect-scope.ts';
import { current_material_layers } from '../src/logos-engine/v6-inventory-material-layers.ts';
import { measurements as controlMeasurements } from '../src/logos-engine/v6-inventory-control-revalidation.ts';
import { CellProjection } from '../src/logos-engine/v6-inventory-project.ts';
import { supportParts } from '../src/logos-engine/v6-support-measurements.ts';
type R=Record<string,any>;
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-inventory-observation-reference.json.gz',import.meta.url))).toString());
const underlays=(rows:any[])=>new Map<string,R>(rows.map(([box,value])=>[box.join(','),value]));
function hydrateBox(b:R):R{return {...b,width:b.right-b.left+1,height:b.bottom-b.top+1};}
function plainComponent(c:R):R{return {...c,bbox:{top:c.bbox.top,left:c.bbox.left,bottom:c.bbox.bottom,right:c.bbox.right}};}
function probe(args:R):R{
 const value={...args,components:measurements.detect_components(args.frame)};
 for(const k of ['canonical_provisional_control_geometry_bboxes','input_aligned_entity_bboxes','visited_input_aligned_entity_bboxes'])if(value[k])value[k]=value[k].map(hydrateBox);
 if(value.periodic_cell_grids)value.periodic_cell_grids={...value.periodic_cell_grids,candidates:value.periodic_cell_grids.candidates.map((g:R)=>({...g,cells:g.cells.map((c:R)=>({...c,bbox:hydrateBox(c.bbox)}))}))};
 return value;
}
function projectionSequence(args:R):R[]{
 let tracker=new CellProjection();if(args.state)tracker.restore(args.state);const out:R[]=[];
 for(const step of args.steps){let value:any=null;const op=step.operation??'record';
  if(op==='scope')tracker.observe_scope(step.obs,step.rows);
  else if(op==='restore'){const saved=tracker.state();tracker=new CellProjection();tracker.restore(saved);value=tracker.state();}
  else value=tracker.record(step.before,step.after,step.action,step.first,step.second,step.meaning==null?null:()=>structuredClone(step.meaning));
  const current=step.after??step.obs,measured=current?tracker.measure(current,step.second??step.rows):null;out.push(structuredClone({value,measure:measured,state:tracker.state()}));
 }
 return out;
}
function execute(op:string,a:R):any{
 switch(op){
  case 'components':return {...measurements.detect_components(a.rows,a.connectivity),components:supportParts(a.rows,a.connectivity).map(plainComponent)};
  case 'initial_candidates':return initial.initial_candidates(a.observation,a.rows);
  case 'provisional_scenes':return initial.provisional_scenes(a.observation,a.rows);
  case 'projection_sequence':return projectionSequence(a);
  case 'moved_core':return measurements.moved_core(a.before,a.after,a.minimum_area??4,a.preferred_minimum_area??null);
  case 'locate':return measurements.locate(a.rows,a.core);
  case 'current_material_layers':return current_material_layers(underlays(a.underlays),a.epoch,a.rows,a.body,a.control_signature);
  case 'control_measurements':return controlMeasurements(a.prior,a.epoch,a.delta,a.moved,a.underlays,a.rows);
  case 'measure_effect_scope':return effect.measure(measurements.detect_components(a.rows),underlays(a.underlays),a.epoch,a.body,a.observation);
  case 'measure_contour_domain':return measurements.measure_contour_domain({...a,bbox:hydrateBox(a.bbox)});
  case 'contrast_effect_scope':return effect.contrast(a.domain,a.before,a.after,a.first,a.second,a.allowed,a.body);
  case 'retain_effect_scope':return effect.retain(a.proposal,a.index,a.before,a.after,a.second,a.outcome,a.prior??null);
  case 'recall_effect_scope':{const value=effect.recall(a.record,a.scene,a.obs,a.rows);return{value,record:a.record};}
  case 'transferred_shape':return contrast.transferred_shape(a.before,a.after,a.first,a.second,a.first_facts,a.second_facts,a.action);
  case 'display_matches':return contrast.display_matches(a.receipt,a.rows);
  case 'reverse_transfer':return contrast.reverse_transfer(a.receipt,a.before,a.after,a.first,a.second,a.facts);
  case 'world_complements':return contrast.world_complements(a.facts,a.rows);
  case 'translation_quantum':return measurements._unique_primitive_action_translation_quantum(probe(a));
  case 'route_grid_candidates':return measurements._action_quantized_route_grid_candidates(probe(a)).map(measurements.public_grid);
  case 'retained_underlay_count':return measurements._current_action_quantized_control_cell_retained_underlay_value_count(probe(a));
  case 'edge_complements':{const value=probe(a);return measurements._edge_display_exact_complement_cell_measurements(value,value.periodic_cell_grids?.candidates);}
  case 'provisional_object_terminating_routes':return measurements._provisional_object_terminating_routes(probe(a));
  default:throw new Error('Unmapped original operation '+op);
 }
}
test('inventory observation proof pins every consumed original source',()=>{
 const root=new URL('../reference/v6/'+fixture.referenceCommit+'/source/',import.meta.url);
 for(const [path,hash]of Object.entries(fixture.sourceHashes))assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),hash);
 assert.equal(fixture.referenceCommit,'786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
 assert.ok(fixture.cases.length>=70);
});
for(const row of fixture.cases)test('inventory observation unchanged Python '+row.id,()=>{
 const input=structuredClone(row.arguments);
 if(row.error)assert.throws(()=>execute(row.operation,input),(error:any)=>error.name===row.error.name);
 else assert.deepEqual(execute(row.operation,input),row.value);
});
test('inventory state restoration detaches nested observations and retains exact state',()=>{
 const saved=fixture.cases.find((c:R)=>c.id==='projection:(0, 0):False').value[5].state,first=new CellProjection();first.restore(saved);
 assert.deepEqual(first.state(),saved);const detached=first.state();detached.controls.ACTION4.delta[0]=999;assert.deepEqual(first.state(),saved);
 const second=new CellProjection();second.restore(first.state());first.controls.ACTION4.delta[0]=998;assert.deepEqual(second.state(),saved);
});
test('component connectivity remains explicit and default four-connected cache is isolated',()=>{
 const rows=[[0,1,0],[1,0,1],[0,1,0]],four=supportParts(rows),eight=supportParts(rows,8);
 assert.equal(four.length,9);assert.equal(eight.length,2);assert.deepEqual(supportParts(rows),four);assert.deepEqual(supportParts(rows,8),eight);
 assert.throws(()=>supportParts(rows,5 as any),TypeError);
});
