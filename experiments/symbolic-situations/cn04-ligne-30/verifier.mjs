import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','bfba3acb8de4c3f13fc10651b2aa22490def5070'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.prolongé.rows,cat=c.catalogue.rows;
const t=(v,i)=>v[i-1].ticket,r=(v,i)=>v[i].ret;
const e=(v,i)=>v.flatMap(x=>x.ret?.events??[]).find(x=>x.ref===r(v,i).ref);
assert.deepEqual(Object.values(c).map(x=>x.rows.length-1),[16,19,18,7]);
for(const {rows} of Object.values(c))for(let i=1;i<rows.length;i++){
  const a=t(rows,i),b=r(rows,i);
  assert.deepEqual([a.id,a.owner,a.admitted],[b.id,b.owner,true]);
  assert.deepEqual([a.owner,a.kind,a.reason],['port_assembly','rigid_port_assembly','compare_joint_material_occupancy_and_epoch']);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,b.ref);
}
for(let i=0;i<16;i++){
  const word=n[i].ticket.word.slice(0,i<7?1:9);
  assert.deepEqual(cat[i],{...n[i],ticket:{...n[i].ticket,word}},'catalogue T'+(i+1));
}
const {events:_cat,...at16}=r(cat,16),{events:_long,...same16}=r(n,16);
assert.deepEqual(at16,same16);
assert.equal(cat[16].score,0);
const first=t(n,1),old=e(n,1);
assert.deepEqual([first.action,first.materials,first.ports,first.poses,first.goal,first.mode,first.expected,first.unit],
  ['ACTION1',2,[2,2],[[0,3,3],[0,12,9]],null,'calibrate',null,3]);
assert.deepEqual([old.status,old.poses,old.motion,r(n,1).matched],['pose_measured',[[0,3,2],[0,12,9]],[['ACTION1',[0,-1]]],null]);
const [at5,at8]=c.prolongé.qualifiers,goal=[[3,7,10],[0,12,9]];
assert.deepEqual([at5.ref,at5.compatible,at5.path,t(n,5).goal],[t(n,5).ref,true,null,goal]);
for(let i=5;i<=7;i++){
  assert.deepEqual([t(n,i).mode,t(n,i).action,t(n,i).expected,t(n,i).poses[0],e(n,i).poses[0]],
    ['rotate','ACTION5',null,[i-5,3,3],[i-4,3,3]]);
}
const words=[...Array(7).fill('ACTION2'),...Array(4).fill('ACTION4')];
assert.deepEqual([at8.compatible,at8.path,at8.withoutDown,t(n,8).word],[true,words,null,words]);
const [guard]=c.prolongé.guards;
assert.deepEqual([guard.ref,guard.real.admitted,guard.previous],[t(n,8).ref,true,{admitted:false,reason:first.reason}]);
for(let i=8;i<=17;i++)assert.deepEqual([t(n,i).mode,r(n,i).matched,e(n,i).poses],['move',true,t(n,i).expected]);
assert.deepEqual(t(n,18).expected,goal);

const observed=(a,match)=>({pixels:[[[12,11],a],[[12,13],a]],match});
assert.deepEqual(r(n,17).physicalContacts,[observed(8,false)]);
assert.deepEqual(r(n,18).physicalContacts,[observed(3,true),observed(3,true),observed(12,false)]);
assert.deepEqual(r(n,18).physicalContacts,r(n,18).shownContacts);
assert.deepEqual([r(n,18).matched,r(n,18).reason,e(n,18).status,r(n,18).official],
  [null,'official_boundary','official_boundary',[2,1]]);
const next=t(n,19);
assert.deepEqual([next.action,next.materials,next.ports,next.goal,next.expected,next.mode],['ACTION1',4,[2,4,4,2],null,null,'calibrate']);

const filtered=c.finale.rows;
assert.deepEqual(filtered.slice(0,18),n.slice(0,18));
assert.deepEqual([r(filtered,18).packet,r(filtered,18).served,r(filtered,18).shownContacts,r(filtered,18).official],
  [r(n,18).packet,r(n,18).packet.slice(-1),[observed(12,false)],[2,1]]);
assert.deepEqual(e(filtered,18),e(n,18));
assert.deepEqual(t(filtered,19),next);
const still=c.sansRotation.rows;
assert.deepEqual(still.slice(0,7),n.slice(0,7));
assert.deepEqual([r(still,7).packet,still[7].présenté,e(still,7).poses,t(still,8).mode,t(still,8).action],
  [r(n,7).packet,n[6].présenté,t(n,7).poses,'rotate','ACTION5']);
assert.equal(c.sansRotation.qualifiers[1].path,null);
assert.equal(still[7].score,0);

const stats=shas.map(sha=>{
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(report,/pass 1\b/);assert.match(report,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((n,x)=>n+x.rows.length-1,0),testsAuteur:1};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:16,rotations:3,translations:words.length,
  contact:{avant:r(n,17).physicalContacts,retour:r(n,18).physicalContacts,finale:r(filtered,18).shownContacts},
  frontière:r(n,18).official,reprise:next.mode},null,2));
