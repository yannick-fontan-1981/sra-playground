import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { SupportNavigation } from '../src/logos-engine/v6-support-navigation.ts';
import { measureSupportNavigationDomain } from '../src/logos-engine/v6-support-navigation-domain.ts';
import { addressedSupportComponent,currentReciprocalSupportFields,enclosedSupportPixels,measureCurrentSupportUnderlays,
  measureSupportOrthogonalBands,measureSupportTranslationLattices,measureSupportValuedMaskPoses,sortedPoints,supportCompare,
  supportFieldAssociation,supportParts,supportPoint,supportResidualCorrespondences,transformSupportPoints } from '../src/logos-engine/v6-support-measurements.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
const oracle=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-support-navigation-reference.json.gz',import.meta.url))).toString('utf8'));
const scenes=oracle.scenes;
const coreState=(s:SupportNavigation)=>{const {schema,acquired_composition_ids,pending_subcompositions,...state}=s.state();return state;};
const knowledge=()=>new NativeKnowledgeStore('support-reference','support-reference');

test('support oracle retains unchanged original source hashes and declares its bounded domain',async()=>{
  assert.match(oracle.qualification,/zero claimed solved game levels/);
  for(const [path,expected]of Object.entries(oracle.sourceHashes))assert.equal(createHash('sha256').update(await readFile(new URL('../reference/v6/'+oracle.commit+'/source/'+path,import.meta.url))).digest('hex'),expected,path);
});
for(const c of oracle.cases)test('support '+c.operation+': '+c.id,()=>{
  const a=c.args,scene=(name:string)=>scenes[name];const call=()=>{
    switch(c.operation){
      case 'parts':return supportParts(scene(a.scene).rows);
      case 'bands':return measureSupportOrthogonalBands(a.points);
      case 'interior':return enclosedSupportPixels(a.points);
      case 'underlay':return measureCurrentSupportUnderlays(scene(a.before).rows,scene(a.after).rows);
      case 'residual':return supportResidualCorrespondences(scene(a.before).observation,scene(a.after).observation,scene(a.before).rows,scene(a.after).rows);
      case 'domain':return measureSupportNavigationDomain({frame:a.frame,components:a.components,memory:a.memory,associations:a.associations,contract:a.contract,availableActions:a.available_actions,currentInputAlignedUnderlayValues:a.current_input_aligned_underlay_values,inputAlignedEntityBboxes:a.input_aligned_entity_bboxes,currentTranslationUnderlayRows:a.current_translation_underlay_rows});
      case 'reciprocal':return currentReciprocalSupportFields(a.effects,a.rows,a.epoch,a.height,a.width);
      case 'addressed':return addressedSupportComponent(a.field);
      case 'field_association':return supportFieldAssociation(a.field);
      case 'valued_pose':return measureSupportValuedMaskPoses(a.frame,a.signature,a.quarter_turns,a.maximum_pixels,a.maximum_matches);
      case 'lattices':return measureSupportTranslationLattices(a.boxes,a.translations);
      case 'transform':return transformSupportPoints(a.points,a.command);
      default:throw new Error(c.operation);
    }
  };
  if(c.error)assert.throws(call,error=>error instanceof Error&&error.message===c.error);else assert.deepEqual(call(),c.expected);
});
for(const scenario of oracle.scenarios)test('support native coordinator: '+scenario.id,async context=>{
  let family=new SupportNavigation({}),proposal:any=null,domain:ObservedInputDomain|null=null;
  for(const [i,row]of scenario.steps.entries())await context.test(i+' '+row.operation.kind,async()=>{
    const op=row.operation;let result:any;
    switch(op.kind){
      case 'record':{const b=scenes[op.before],a=scenes[op.after];result=await family.recordExisting(b.observation,a.observation,op.command,b.rows,a.rows,op.selected?proposal:undefined,op.index);break;}
      case 'propose':{const view=scenes[op.scene];domain=new ObservedInputDomain(4096);const inputs=domain.candidates(view.observation);proposal=await family.propose(view.observation,view.rows,inputs,op.remaining??100);result=proposal;break;}
      case 'bind':family.bind(proposal,domain!);result=proposal;break;
      case 'before':{const view=scenes[op.scene];result=await family.before(proposal,op.index??0,view.public,view.observation);break;}
      case 'after':{const b=scenes[op.before],a=scenes[op.after];result=await family.after(proposal,op.index??0,b.observation,a.observation,b.rows,a.rows);break;}
      case 'geometry':{const view=scenes[op.scene],current=family.scene(view.rows)!;const[cells,owner,grid]=family.geometry(view.rows,current[1],current[3]);result={cells:sortedPoints(cells),owner:[...owner].map(([p,v])=>[supportPoint(p),[...v].sort((a,b)=>a-b)]).sort((a,b)=>supportCompare(a[0],b[0])),grid};break;}
      case 'context':{const view=scenes[op.scene];result=family.experimentContext(family.scene(view.rows)!,view.rows);break;}
      case 'quotient':{const view=scenes[op.scene],current=family.scene(view.rows)!;result=family.quotientEffects(view.rows,current[1],current[3]);break;}
      case 'seed':{const aliases:Record<string,string>={};for(const[k,v]of Object.entries(op.fields))(family as any)[aliases[k]??k]=structuredClone(v);result=null;break;}
      default:throw new Error(op.kind);
    }
    assert.deepEqual(result,row.expected.result,'returned result');assert.deepEqual(coreState(family),row.expected.state,'retained coordinator state');
    const state=family.state();const restored=new SupportNavigation({});restored.restore(state);assert.deepEqual(restored.state(),state,'all native state round-trips after each operation');family=restored;
  });
});

test('component reuse checks current raster content and protects immutable records', () => {
 const rows=[[1,1,0],[0,0,0],[0,0,2]],prior=supportParts(rows),priorValue=structuredClone(prior);
 assert.equal(Object.isFrozen(prior[0]),true);assert.equal(Object.isFrozen(prior[0].bbox),true);assert.equal(Object.isFrozen(prior[0].pixels[0]),true);
 assert.throws(()=>{prior[0].bbox.top=99;},TypeError);
 const array=supportParts(rows);array.reverse();assert.deepEqual(supportParts(rows),priorValue);
 rows[0][0]=3;const changed=supportParts(rows);assert.notDeepEqual(changed,priorValue);assert.equal(changed[0].value,3);assert.deepEqual(prior,priorValue);
 rows[0][0]=1;assert.deepEqual(supportParts(rows),priorValue);
});
