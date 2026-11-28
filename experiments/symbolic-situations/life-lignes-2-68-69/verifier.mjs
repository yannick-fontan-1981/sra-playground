import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','f005be662b0e4b556a0cea3d246381cd98eec7ae'];
const contact='measured_animated_contact', carrier='typed_carrier_experiment', flow='typed_material_flow';
const read=(sha,group)=> {
  const input=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));
  assert.equal(input.sha,sha);assert.equal(input.group,group);
  return input.results;
};
const common=shas.map(sha=>Object.assign({},...['nominal','contact','réserve','complément'].map(group=>read(sha,group))));
assert.deepEqual(common[0],common[1]);
const cases=common[0], nominal=cases.nominal.rows;
const counts=Object.fromEntries([contact,carrier,flow].map(k=>[k,nominal.slice(0,-1).filter(row=>row.ticket.kind===k).length]));
assert.deepEqual(Object.values(counts),[2,6,8]);
const substitutions=read(shas[1],'substitution');
const point=t=>[t.point.x,t.point.y];
const event=(row,kind)=>row.returned.events.find(e=>e.kind===kind);
for(const r of [...Object.values(cases),...Object.values(substitutions)]){
  for(let i=0;i<r.rows.length-1;i++){
    const t=r.rows[i].ticket, ret=r.rows[i+1].returned;
    assert.ok(t.admitted);assert.equal(ret.ticket,t.id);assert.equal(ret.owner,t.owner);assert.equal(ret.matched,null);
    const evidence=ret.events.find(e=>e.kind===({[carrier]:'typed_carrier_response',[flow]:flow,[contact]:contact}[t.kind]));
    assert.deepEqual(evidence.refs,[t.ref,ret.ref]);
  }
}
assert.deepEqual(nominal.filter(r=>r.ticket?.kind===contact).map(r=>[r.level,...point(r.ticket)]),[[1,24,7],[2,40,7]]);
const physical=nominal[1].returned, still=cases.immobile.rows.at(-1);
assert.equal(physical.actualPixels,0);assert.equal(physical.images,4);assert.equal(physical.distinct,2);
assert.equal(still.returned.seenPixels,0);assert.equal(still.returned.distinct,1);assert.equal(still.status,'stopped');
assert.equal(event(still,contact).measurement,event(nominal[1],contact).measurement);
assert.equal(event(still,contact).model,null);
const removed=cases.retrait1.rows;
assert.equal(removed[0].ticket.kind,carrier);assert.deepEqual(point(removed[0].ticket),[6,48]);
assert.equal(event(removed[1],'typed_carrier_response').context,'local_marking');
assert.equal(removed[1].ticket.kind,contact);assert.deepEqual(point(removed[2].ticket),[41,48]);

function verifyCarrier(rows) {
  const chosen=rows[1].ticket, partner=rows[2].ticket, marked=event(rows[2],'typed_carrier_response');
  assert.equal(chosen.kind,carrier);assert.equal(chosen.offeredCarriers.length,4);
  const validReceipt=(t,e)=>e.refs[0]===t.ref && e.context==='local_marking' && JSON.stringify(point(t))===JSON.stringify(e.selected.point);
  assert.ok(validReceipt(chosen,marked));
  assert.ok(!validReceipt(chosen,{...marked,selected:partner.chosen}));
  assert.deepEqual(partner.bound.point,point(chosen));
  const profile=s=>s.profile.map(p=>p[2]).sort((a,b)=>a-b);
  const compatible=partner.offeredCarriers.filter(c=>String(c.point)!==String(partner.bound.point) && String(profile(c))===String(profile(partner.bound)));
  assert.deepEqual(compatible.map(c=>c.point),[point(partner)]);
  assert.equal(event(rows[3],'typed_carrier_response').context,'produced_support');
  const children=event(rows[4],flow).additions;
  assert.equal(children.length,2);assert.ok(children.every(c=>c.source===rows[4].returned.ref));
}
function verifyChild(rows) {
  const select=rows[4].ticket, deliver=rows[5].ticket, mark=event(rows[5],flow), delivered=event(rows[6],flow);
  const generated=event(rows[4],flow).additions;
  assert.ok(generated.some(c=>c.id===select.child.id && c.source===select.child.source));
  assert.ok(select.refs.includes(select.child.source));
  assert.equal(select.mode,'select');assert.equal(mark.effect,'local_child_marking');
  const validReceipt=(t,e)=>t.child.id===e.marked.id && e.refs[0]===t.ref;
  assert.ok(validReceipt(select,mark));assert.ok(!validReceipt(select,{...mark,marked:generated.find(c=>c.id!==select.child.id)}));
  assert.equal(deliver.mode,'deliver');assert.equal(deliver.child.id,select.child.id);assert.deepEqual(point(deliver),select.target.point);
  assert.equal(delivered.effect,'material_consumed_and_request_changed');assert.deepEqual(delivered.removed,[select.child.id]);
}
verifyCarrier(nominal);verifyCarrier(substitutions.autre2.rows);
verifyChild(nominal);verifyChild(substitutions.autre5.rows);
for(const turn of [2,5]){
  const changed=substitutions['autre'+turn], t=changed.rows[turn-1].ticket;
  assert.deepEqual(changed.rows.slice(0,turn-1),nominal.slice(0,turn-1));
  assert.equal(t.ref,nominal[turn-1].ticket.ref);
  assert.equal(t.owner,nominal[turn-1].ticket.owner);
  assert.notDeepEqual(point(t),point(nominal[turn-1].ticket));
  assert.equal(changed.offers.length,1);assert.deepEqual(changed.offers[0].points[changed.offers[0].index],point(t));
  const masked=cases['local'+turn].rows[turn], noMark=cases['sansMarque'+turn].rows[turn];
  assert.equal(masked.returned.altered,0);assert.deepEqual(masked.ticket,nominal[turn].ticket);
  assert.equal(noMark.returned.seenPixels,0);assert.equal(noMark.returned.actualPixels,turn===2?29:32);
  assert.equal(noMark.status,'stopped');
}
assert.equal(event(cases.sansMarque2.rows[2],'typed_carrier_response').context,undefined);
assert.equal(event(cases.sansMarque5.rows[5],flow).effect,'unknown');
const stats=shas.map((sha,i)=>{
  const starts=i?{...common[i],...substitutions}:common[i];
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  const tests=i?10:6;
  assert.match(report,new RegExp('pass '+tests+'\\b'));assert.match(report,/fail 0/);
  return {sha,départs:Object.keys(starts).length,gestes:Object.values(starts).reduce((s,r)=>s+r.rows.length-1,0),testsAuteur:tests};
});
console.log(JSON.stringify({stats,occurrences:counts,invitation:{images:4,distinctes:2,distinctesImmobiles:1,suiteImmobile:still.status},
  substitutions:Object.fromEntries(Object.entries(substitutions).map(([name,r])=>[name,r.rows.slice(name==='autre2'?1:4).map(row=>point(row.ticket))])),
  réserve:{pixelsFinauxMasqués:[0,0]},complément:{pixelsFinauxMasqués:[29,32],suites:['stopped','stopped']}},null,2));
