import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [destination,mode]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'eb5611b3ff76409fbd67680ac29a5f6a17586422'};
const read=(version,suffix)=>readFileSync(join(destination,sha[version].slice(0,8)+'.'+suffix),'utf8');
function byVersion(version){
  return Object.assign({},...['nominal','contrôles'].map(g=>{
    const r=JSON.parse(read(version,g+'.json'));
    assert.equal(r.sha,sha[version]);
    assert.equal(r.group,g);
    return r.cases;
  }));
}
const [gel,candidat]=Object.keys(sha).map(byVersion);
const refs=list=>list?.map(r=>Number(r.match(/:revision:(\d+):/)[1]))??null;
const row=(r,i)=>r.rows[i-1];
const view=(r,i)=>({plan:refs(row(r,i).ticket.continuation),gabarit:refs(row(r,i).ticket.bundle)});
const t5=r=>view(r,5);
for(const arm of ['nominal','doublonInverse','unSeulSansBorne','stationnaire'])assert.deepEqual(candidat[arm],gel[arm],arm);
const row5=row(gel.doublon,5),fix5=row(candidat.doublon,5);
const {ticket:ta,...a}=row5,{ticket:tb,...b}=fix5;
const {continuation:ca,bundle:ba,...da}=ta,{continuation:cb,bundle:bb,...db}=tb;
assert.deepEqual(a,b);
assert.deepEqual(da,db);
assert.deepEqual(gel.doublon.cuts,candidat.doublon.cuts);
assert.deepEqual(gel.doublon.rows.slice(0,4),candidat.doublon.rows.slice(0,4));
assert.deepEqual(gel.doublon.rows.slice(5),candidat.doublon.rows.slice(5));
assert.deepEqual(t5(gel.nominal),{plan:[3,4,5],gabarit:[5,3,4,5]});
assert.deepEqual(t5(gel.doublon),{plan:[3,3,5],gabarit:[5,3,3,5]});
assert.deepEqual(t5(candidat.doublon),{plan:[2,3,5],gabarit:[5,2,3,5]});
assert.deepEqual(t5(candidat.doublonInverse),{plan:[3,4,5],gabarit:[5,3,4,5]});
assert.deepEqual(t5(candidat.unSeulSansBorne),{plan:null,gabarit:[5]});
const cut=gel.doublon.cuts[0];
assert.deepEqual(refs(cut.used.filter(e=>e.status==='observed_row_completion').map(e=>e.ref)),[2,3,3]);
const neg=gel.unSeulSansBorne.cuts[0].used;
assert.equal(new Set(neg.filter(e=>e.status==='observed_row_completion').map(e=>e.key)).size,1);
assert.ok(!neg.some(e=>e.status==='official_boundary'));
for(const r of [gel,candidat]){
  for(const arm of ['doublon','doublonInverse','unSeulSansBorne']){
    const scoped=r[arm];
    for(const turn of [5,6]){
      assert.deepEqual(row(scoped,turn).ticket.point,row(r.nominal,turn).ticket.point);
      assert.equal(row(scoped,turn).ticket.admitted,true);
      assert.deepEqual(row(scoped,turn+1).ret,row(r.nominal,turn+1).ret);
    }
    assert.deepEqual(view(scoped,6),view(r.nominal,6));
  }
  assert.equal(row(r.stationnaire,2).ticket.command,'ACTION1');
  assert.equal(row(r.stationnaire,2).ret.event.status,'answer_acceptance_unconfirmed');
  assert.deepEqual(row(r.stationnaire,3).ticket.point,row(r.nominal,1).ticket.point);
}
const gestures=r=>Object.values(r).reduce((n,a)=>n+a.rows.filter(z=>z.ret).length,0);
assert.equal(gestures(gel),29);
assert.equal(gestures(candidat),29);
const stats={departsParSha:5,gestesParSha:29};
if(mode!=='operateur'){
  const report=read('candidat','auteur.txt');
  assert.match(report,/\bpass 19\b/);
  assert.match(report,/\bfail 0\b/);
  stats.testsComplementairesCandidat=19;
}
console.log(JSON.stringify({sha,stats,nominal:t5(gel.nominal),doublon:{gel:t5(gel.doublon),candidat:t5(candidat.doublon)},
  doublonInverse:t5(candidat.doublonInverse),retrait:t5(candidat.unSeulSansBorne),
  premierClic:ta.point,retourIdentique:row(candidat.doublon,6).ret.event.status,reprise:view(candidat.doublon,6)},null,2));
