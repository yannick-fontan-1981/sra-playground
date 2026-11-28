import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','735b5e7d9fc3d3b426588e4d619187d925d269f0'];
const read=(sha,g,ext)=>readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.'+ext),'utf8');
const [gel,candidate]=shas.map(s=>{
  const tap=read(s,'auteur','txt');
  assert.match(tap,/\bpass 2\b/);assert.match(tap,/\bfail 0\b/);
  return Object.assign({},...['nominal','contrôles'].map(group=>{
    const p=JSON.parse(read(s,group,'json'));
    assert.equal(p.sha,s);assert.equal(p.group,group);
    return p.cases;
  }));
});
assert.deepEqual(gel,candidate);
const {nominal:n,disposition:alternate,stationnaire:still}=gel;
assert.deepEqual(Object.values(gel).map(c=>c.filter(x=>x.ret).length),[16,4,9]);
assert.ok(n.slice(0,16).every(r=>r.ticket.owner==='relative_arrangements'&&r.ticket.admis));
assert.ok(n.slice(1).every(r=>r.ret.matched===null));
assert.deepEqual(n.filter((r,i)=>i&&r.score>n[i-1].score).map(r=>r.tour-1),[2,13]);
assert.equal(n[2].ticket.ancienne,false);
assert.deepEqual(n[0].ticket.plan.move,{from:[8,6],to:[9,6],value:9});
assert.equal(n[1].ret.event.status,'selection_observed');
assert.equal(n[2].ret.event.status,'official_boundary');
assert.deepEqual(n[2].ticket.plan.move,{from:[0,9],to:[12,9],value:9});
assert.deepEqual(alternate.slice(0,2),n.slice(0,2));
assert.equal(alternate[2].vraiePhoto,n[2].photo);
assert.equal(alternate[2].écartRaster,18);
assert.deepEqual(alternate[2].ticket.plan.objets,[[[14,2],9],[[12,9],9],[[12,11],9]]);
assert.deepEqual(alternate[2].ticket.plan.move,{from:[14,2],to:[13,10],value:9});
assert.deepEqual(alternate[2].ticket.data,n[7].ticket.data);
assert.equal(alternate[3].ret.event.status,'selection_observed');
assert.deepEqual(alternate[3].ticket.data,n[8].ticket.data);
assert.equal(alternate[4].score,1);

for(const [a,b] of [[n[8],n[9]],[alternate[3],alternate[4]]]){
  const r=b.ret,e=r.event;
  assert.equal(a.ticket.plan.rôle,'probe_actuator_relation');
  assert.equal(r.id,a.ticket.id);
  assert.deepEqual([e.before,e.after,e.selection],[a.ticket.ref,r.ref,a.ticket.ref]);
  assert.deepEqual([e.status,e.from,e.to,e.delta,e.preserved],['single_object_and_actuator_displacement',
    [14,2],[13,3],[-1,1],[[12,9,9],[12,11,9]]]);
}
assert.deepEqual(still.slice(0,9),n.slice(0,9));
assert.equal(still[9].ret.packet,n[9].ret.packet);
assert.equal(still[9].ret.event.status,'no_arrangement_change');
assert.equal(still[9].ret.event.delta,undefined);
assert.deepEqual(still[9].ticket.data,{x:17,y:57});
assert.notDeepEqual(still[9].ticket.data,n[9].ticket.data);
assert.equal(still[9].score,1);
console.log(JSON.stringify({stats:{versions:2,départsParVersion:3,gestesParVersion:29,testsParVersion:2,catalogue:16,
  niveauxTerminés:2},contraste:{sujetNominal:n[2].ticket.plan.move,sujetAlternatif:alternate[2].ticket.plan.move,
  retourAlternatif:alternate[4].ret.event,repriseStationnaire:still[9].ticket.data}},null,2));
