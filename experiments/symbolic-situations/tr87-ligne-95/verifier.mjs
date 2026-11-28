import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'c41c028c2ed06244715bad39024f542d44f8eda0'};
const lengths={"nominal":16,"sans-types":1,"type-temoin":1,"ordre-entrees":2,"stationnaire":1,"stationnaire-plan":10};
const arms=Object.keys(lengths);
function read(version,arm){
  const {sha:actual,...r}=JSON.parse(readFileSync(join(destination,version+'.'+arm+'.json'),'utf8'));
  assert.equal(actual,sha[version]);
  assert.equal(r.arm,arm);
  assert.equal(r.steps.length,lengths[arm]);
  return r;
}
const cases=Object.fromEntries(arms.map(arm=>{
  const gel=read('gel',arm),candidate=read('candidat',arm);
  assert.deepEqual(candidate,gel,arm);
  return [arm,gel];
}));
const stats={departsParSha:arms.length,gestesParSha:Object.values(lengths).reduce((a,b)=>a+b),parite:true};
const t=(r,i)=>r.steps[i-1];
const {nominal,stationnaire}=cases;
const [sans,temoin,ordre,arret]=['sans-types','type-temoin','ordre-entrees','stationnaire-plan'].map(a=>cases[a]);
const first=t(nominal,1),cut=first.pre.cut.pre;
assert.equal(cut.table.length,6);
assert.equal(cut.sourceWord.length,5);
assert.equal(cut.scene.target.length,5);
assert.equal(cut.scene.derivations,1);
assert.equal(cut.scene.complete,true);
assert.equal(first.pre.plan.expected,null);
assert.equal(first.after.matched,null);
const status=s=>s.after.record?.event?.status;
const changed=(before,after)=>before[0].flatMap((g,i)=>g===after[0][i]?[]:[i]);
assert.equal(status(first),'local_glyph_rewrite');
assert.deepEqual(changed(first.pre.plan.before,first.after.record.measured),[0]);
assert.equal(first.pre.plan.before[1],first.after.record.measured[1]);
assert.equal(t(sans,1).pre.cut.pre.table.length,5);
assert.equal(t(sans,1).pre.cut.pre.scene,null);
assert.equal(t(sans,1).pre.family,'acquire_control_for_target');
assert.equal(t(temoin,1).pre.cut.pre.table.length,5);
assert.equal(t(temoin,1).pre.cut.pre.scene.complete,true);
assert.equal(t(temoin,1).pre.family,first.pre.family);
for(const r of [sans,temoin,ordre,stationnaire]){
  assert.deepEqual(t(r,1).pre.command,first.pre.command);
  assert.equal(t(r,1).after.packet,first.after.packet);
}
assert.equal(t(ordre,2).after.packet,t(nominal,2).after.packet);
assert.equal(status(t(stationnaire,1)),'unknown_transition');
assert.deepEqual(stationnaire.next.command,['ACTION2',{}]);
assert.deepEqual(t(nominal,8).pre.command,['ACTION2',{}]);
assert.equal(status(t(nominal,8)),'local_glyph_rewrite');
assert.deepEqual(t(nominal,9).pre.command,['ACTION3',{}]);
assert.equal(status(t(nominal,9)),'cursor_step');
assert.deepEqual(nominal.steps.slice(9).map(s=>s.pre.index),[0,1,2,3,4,5,6]);
assert.ok(nominal.steps.slice(9).every(s=>s.after.matched===true));
assert.equal(t(nominal,16).after.levels,0);
assert.deepEqual(t(arret,10).pre.command,t(nominal,10).pre.command);
assert.equal(t(arret,10).after.packet,t(nominal,10).after.packet);
assert.equal(t(arret,10).after.matched,false);
assert.equal(t(arret,10).after.seal,true);
assert.equal(status(t(arret,10)),'unknown_transition');
assert.deepEqual(arret.next.command,t(nominal,10).pre.command);
assert.equal(arret.next.index,0);
console.log(JSON.stringify({sha,stats,lengths,paires:6,glyphes:5,derivations:1,familleNominale:first.pre.family,
  retraitType:{paires:5,famille:t(sans,1).pre.family,memePaquet:true},temoinType:{paires:5,famille:first.pre.family},
  apprentissage:{premierIndice:0,editionInverse:8,curseur:9},projectionsConfirmees:7,gains:0,
  stationnaireT10:{matched:false,seal:true,commandeSuivante:arret.next.command,indexSuivant:arret.next.index}},null,2));
