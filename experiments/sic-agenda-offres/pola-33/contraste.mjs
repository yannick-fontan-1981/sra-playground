import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {digest} from './operateur.mjs';

export async function publicContrast(engine){
  const {AxialQuestion}=await import(new URL('src/logos-engine/v6-axial-question.ts',engine));
  const bytes=await readFile(new URL('../../../tests/fixtures/v6-axial-question-reference.json.gz',import.meta.url));
  const {kernelCold:k}=JSON.parse(gunzipSync(bytes));
  const family=await AxialQuestion.create();
  assert.equal(await family.proposeSource(k.initialObservation,k.initialRows,[],8),null);
  const selected=family.recordObserved(k.initialObservation,k.selectedObservation,k.selectionCommand,k.initialRows,k.selectedRows);
  assert.deepEqual(selected.events,['selection_marker_changed_under_input']);
  const first=[k.selectedObservation,k.selectedRows],second=[k.contraryObservation,k.contraryRows];
  const proposed=await family.proposeSource(...first,[],8);
  const {action_ref:command}=proposed.actions[0],o=proposed.axial_plan.offer;
  assert.deepEqual([command,o.projection.axis,o.turn],['ACTION4',[0,1],1]);
  assert.equal(family.before(proposed,0,{frame_rows:first[1]},first[0]).admitted,true);
  const returned=family.record(first[0],second[0],proposed.actions[0],first[1],second[1],proposed,0,[second[1]]);
  assert.equal(returned.events[0].events.includes('quarter_rotation_observed'),true);
  const [method]=family.rotations;
  assert.equal(method.turn,-1);
  const conditional=family.after(proposed,0,first[0],second[0],first[1],second[1]);
  assert.equal(conditional.matched,null);
  const known=await family.proposeSource(...second,[],8);
  assert.equal(family.before(known,0,{frame_rows:second[1]},second[0]).admitted,true);
  const withheld=await AxialQuestion.create();
  withheld.restore({...family.state(),rotations:[]});
  const unproven=await withheld.proposeSource(...second,[],8);
  assert.deepEqual([known.actions[0].action_ref,unproven.actions[0].action_ref],['ACTION4','ACTION3']);
  const [offers]=family.offers(...second),reversed=[...offers].reverse();
  const [a]=await family.policy.choose(offers),[b]=await family.policy.choose(reversed);
  assert.equal(offers[a.index].key,reversed[b.index].key);
  assert.notEqual(offers[a.index].action,'ACTION3');
  assert.notEqual(a.index,b.index);
  const result=p=>{
    const o=p.axial_plan.offer;
    return {action:p.actions[0].action_ref,axis:o.actor.axis,desired:o.relation.desired_axis,projection:o.projection,
      distance:o.quarter_distance,turn:o.turn,method:o.method_revalidation?.method??null};
  };
  return {fixture:'kernelCold',input:digest(second[1]),first:result(proposed),conditional,returned:returned.events[0],
    retained:result(known),withheld:result(unproven),rankings:{original:offers.map(o=>o.action),reversed:reversed.map(o=>o.action),
      originalIndex:a.index,reversedIndex:b.index,chosen:offers[a.index].action}};
}
