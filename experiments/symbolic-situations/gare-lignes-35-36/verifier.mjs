import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';
const [dir]=process.argv.slice(2),shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','c3f24fb80a39604bf99686f7c0725b175c2628dd'];
const runs=shas.map(sha=>Object.assign({},...['nominal','transfert','analogie','réserve'].map(group=>{
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));assert.equal(f.sha,sha);return f.results;
})));
assert.deepEqual(runs[0],runs[1]);const cases=runs[0],baseline=cases.nominal.rows;
const owner='public_framed_transfer',transfer='observed_framed_transfer',analogy='observed_framed_analogy';
const point=t=>[t.point.x,t.point.y],label=t=>[t.famille,t.entrée,...point(t)];
function receipt(r,i){const before=r.rows[i],after=r.rows[i+1];return r.facts.find(v=>equal(v.refs,[before.ref,after.retour.ref]));}
function belongs(before,after,f){
  return Boolean(after.retour.ticket===before.ticket && f && equal(f.refs,[before.ref,after.retour.ref]));
}
let total=0;
for(const r of Object.values(cases)){
  for(const [i,t] of r.rows.slice(0,-1).entries()){
    const n=r.rows[i+1];total++;assert.equal(n.retour.ticket,t.ticket);assert.ok(t.admis);
    if(n.ticket)assert.equal(n.ref,n.retour.ref);
    if(t.famille===owner){
      assert.equal(t.prédiction,null);assert.equal(n.retour.matched,null);assert.equal(n.retour.famille,owner);
      assert.ok(belongs(t,n,receipt(r,i)),'reçu de cadre T'+(i+1));
    }
  }
}
const entries=baseline.slice(0,16);
assert.deepEqual(entries.filter(t=>t.entrée===transfer).map(t=>t.tour),[1,2,3,8,9,10,11]);
assert.equal(entries.filter(t=>t.entrée===analogy).length,9);
assert.equal(baseline[0].plan.paire,true);assert.equal(baseline[0].plan.partenaires,1);
const t4=baseline[3];assert.equal(t4.plan.complet,true);assert.equal(t4.plan.masque,true);assert.notEqual(t4.plan.source,t4.plan.marqueur);
assert.equal(t4.plan.premisses.length,3);
const previous=cases.nominal.facts.filter(e=>baseline.slice(1,4).some(t=>t.retour.ref===e.refs[1]));
assert.ok(t4.plan.premisses.every(ref=>previous.some(v=>v.preuves.some(([k])=>k===ref))));
assert.deepEqual(point(cases.bande.rows[0]),[44,13]);assert.equal(cases.bande.rows[0].entrée,transfer);
const invalid=cases.masque.rows[3];assert.notEqual(invalid.entrée,analogy);assert.deepEqual(point(invalid),[13,23]);
const changes={};
for(const [name,i,entry,xy,suite] of [
  ['retrait1',0,'experiment',[19,13]],['autre1',0,transfer,[44,13],[54,13]],['retrait4',3,'field_service_composition',[39,13]],
  ['autre4',3,'field_service_composition',[39,13],[9,13]],['autre5',4,analogy,[59,13],[44,13]]
]){
  const r=cases[name],t=r.rows[i],n=r.rows[i+1];assert.ok(r.changes.length>0);
  assert.deepEqual(r.rows.slice(0,i),baseline.slice(0,i));assert.equal(t.ref,baseline[i].ref);
  assert.equal(t.entrée,entry);assert.deepEqual(point(t),xy);assert.equal(n.retour.ticket,t.ticket);
  assert.equal(n.observation.écart,0);if(suite)assert.deepEqual(point(n),suite);
  changes[name]={décision:label(t),retour:{famille:n.retour.famille,matched:n.retour.matched},pixels:n.observation.servi,suite:label(n)};
}
assert.deepEqual(cases.autre4.rows,cases.retrait4.rows);
const partial={};
for(const [name,i] of [['local1',0],['local4',3]]){
  const r=cases[name],t=r.rows[i],n=r.rows[i+1],real=baseline[i+1],o=n.observation;
  assert.deepEqual(r.rows.slice(0,i+1),baseline.slice(0,i+1));assert.equal(o.réel,real.observation.servi);
  assert.ok(o.servi>0 && o.écart>0);assert.equal(o.réel,o.servi+o.écart);assert.notEqual(n.retour.ref,real.retour.ref);
  const authentic=receipt(cases.nominal,i),limited=receipt(r,i);assert.ok(!belongs(t,n,authentic));assert.ok(belongs(t,n,limited));
  const motion = 'policy.record_observed_point_motion_span';
  const replacement = 'policy.record_observed_framed_replacement';
  const firstClick = i === 0;
  assert.deepEqual(authentic.preuves.map(([, policy]) => policy), firstClick ? [motion] : [motion, replacement]);
  assert.deepEqual(limited.preuves, []);
  assert.deepEqual(o, firstClick ? {réel:94, servi:29, écart:65} : {réel:248, servi:43, écart:205});
  assert.deepEqual(label(real), firstClick ? [owner,transfer,44,13] : [owner,analogy,34,23]);
  assert.deepEqual(label(n), firstClick ? [owner,transfer,44,13] : [owner,transfer,59,13]);
  partial[name]={décision:label(t),pixels:o,politiquesNominales:authentic.preuves.map(x=>x[1]),politiquesServies:limited.preuves.map(x=>x[1]),
    suiteNominale:label(real),suiteServie:label(n)};
}
assert.equal(Object.keys(cases).length,10);
assert.equal(total,44);
const stock=readFileSync(join(dir,'c3f24fb8.auteur.txt'),'utf8');assert.match(stock,/pass 8/);assert.match(stock,/fail 0/);
console.log(JSON.stringify({shas,départsParSHA:10,gestesParSHA:total,occurrences:{35:7,36:9},testsAuteur:8,substitutions:changes,réserve:partial},null,2));
