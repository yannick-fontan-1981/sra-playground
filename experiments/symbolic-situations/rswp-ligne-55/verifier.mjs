import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const versions={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'f3051af812f4f7f74f0179a804a87753bffa5910'};
const arms={nominal:16,stationnaire:1,'sans-selection':4,'effets-t8':8,'relation-t8':7,'zone-t8':8,
  'effets-t16':16,'relation-t16':15,'zone-t16':16};
const cases={};
for(const [name,n] of Object.entries(arms)){
  const [gel,candidate]=Object.entries(versions).map(([version,sha])=>{
    const {sha:actual,...data}=JSON.parse(readFileSync(join(dir,version+'.'+name+'.json'),'utf8'));
    assert.equal(actual,sha);
    assert.equal(data.arm,name);
    assert.equal(data.steps.length,n);
    return data;
  });
  assert.deepEqual(gel,candidate);
  cases[name]=gel;
}
const nominal=cases.nominal.steps;
assert.ok(nominal.every(x=>x.pre.kind==='panel_service'&&x.pre.guard.admitted));
const command=({pre})=>pre.command;
const T1=nominal[0],still=cases.stationnaire.steps[0];
const delta=after=>after.record.physical.map(p=>p.room.changed);
const panelDelta=after=>after.record.physical.map(p=>p.panel.changed);
assert.deepEqual(command(T1),['ACTION6',{x:45,y:12}]);
assert.equal(T1.after.matched,true);
assert.equal(T1.after.record.memory.confirmed,true);
assert.deepEqual(delta(T1.after),[0,0,0]);
assert.deepEqual(panelDelta(T1.after),[32,0,0]);
assert.equal(still.after.packet,T1.after.packet);
assert.equal(still.after.matched,false);
assert.equal(cases.stationnaire.lastCut.result.reason,'panel_configuration_refused_in_context');
assert.equal(cases.stationnaire.next,null);
const partial=cases['sans-selection'].steps[3],full=nominal[3];
assert.deepEqual(command(partial),command(full));
assert.equal(partial.pre.cut.pre.used.confirmed,false);
assert.equal(partial.pre.cut.pre.prior.confirmed,true);
assert.deepEqual([partial.pre.plan.commands.length,full.pre.plan.commands.length],[1,3]);
assert.equal(partial.after.packet,full.after.packet);

const scopes={};
for(const [tour,materialsBefore,materialsAfter] of [[8,[15,12,13],[12,13,15]],[16,[13,15,12],[13,15,12]]]){
  const apply=nominal[tour-2],next=nominal[tour-1],application=apply.after.record;
  assert.deepEqual([apply.pre.plan.kind,command(apply),apply.after.matched],['application',['ACTION5',{}],null]);
  assert.deepEqual([application.detail.before,application.detail.after],[apply.pre.ref,apply.after.ref]);
  assert.deepEqual(delta(apply.after),[21,21,21]);
  assert.deepEqual(application.before.map(x=>x.material),materialsBefore);
  assert.deepEqual(application.after.map(x=>x.material),materialsAfter);
  assert.equal(application.detail.score_delta,0);
  assert.equal(next.pre.plan.kind,'configuration');
  const missing=cases['relation-t'+tour],projection=missing.lastCut.pre;
  assert.equal(missing.stop,'frontier_unknown');
  assert.equal(missing.next,null);
  assert.equal(missing.lastCut.result.reason,'panel_service_correspondence_unresolved');
  assert.equal(missing.lastCut.result.blocking,true);
  assert.equal(missing.lastCut.result.missing.length,1);
  assert.equal(projection.samePanels,true);
  assert.deepEqual(projection.used,projection.prior);
  assert.deepEqual(projection.usedFields.slice(1),projection.fields.slice(1));
  assert.notDeepEqual(projection.usedFields[0],projection.fields[0]);
  assert.equal(projection.hash,next.pre.cut.pre.hash);
  assert.equal(missing.steps.at(-1).after.packet,apply.after.packet);

  const edited=cases['zone-t'+tour],after=edited.steps[tour-2].after;
  assert.equal(after.packet,apply.after.packet);
  assert.notEqual(after.physical,after.presented);
  assert.deepEqual(delta(after),[0,21,21]);
  assert.deepEqual(edited.steps[tour-1].pre.cut.pre.usedFields,next.pre.cut.pre.usedFields);
  const erased=cases['effets-t'+tour].steps[tour-1];
  assert.equal(erased.pre.cut.pre.used.effects.length,0);
  assert.ok(erased.pre.cut.pre.prior.effects.length>0);
  assert.equal(erased.pre.cut.pre.hash,next.pre.cut.pre.hash);
  for(const x of [edited.steps[tour-1],erased]){
    assert.deepEqual(command(x),command(next));
    assert.deepEqual(x.pre.plan.contributions,next.pre.plan.contributions);
    assert.deepEqual(x.pre.plan.commands,next.pre.plan.commands);
    assert.equal(x.after.packet,next.after.packet);
    assert.equal(x.after.matched,true);
  }
  scopes[tour]={matériauxAvant:materialsBefore,matériauxAprès:materialsAfter,changement:delta(apply.after),
    sourceRetour:apply.after.ref,pixelsSansZone:delta(after),retraitRelation:projection.changed,
    commandeRésolue:command(next),score:next.after.levels};
}
console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(arms).length,
  gestesParVersion:Object.values(arms).reduce((a,b)=>a+b,0),catalogue:16,reprisesExercées:2,niveauxTerminés:2},scopes},null,2));
