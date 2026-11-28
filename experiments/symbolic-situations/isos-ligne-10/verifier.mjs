import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.catalogue.rows;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].return;
const e=(rows,i)=>rows.flatMap(x=>x.return?.events??[]).find(x=>x.after===r(rows,i).ref);
assert.deepEqual(Object.values(c).map(x=>x.rows.length-1),[16,3,7,4,1,2]);
for(const {rows} of Object.values(c))for(let i=1;i<rows.length;i++){
  const q=t(rows,i),b=r(rows,i);
  assert.deepEqual([q.id,q.owner,q.admitted],[b.id,b.owner,true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,b.ref);
}
const first=t(n,1),second=t(n,2),third=t(n,3);
assert.deepEqual([first.world,first.example,first.scale,first.support,first.parts.map(x=>[...x].sort((a,b)=>a-b))],
  [[0,0,63,43],[2,45,18,59],0.6,[29,21,38,25],[[8,9,14],[8,9,14]]]);
assert.deepEqual([first.offer,first.method,second.offer,second.method,third.method.shift],
  ['probe_congruent_empty_face',null,'probe_visible_cap',null,[0,-6]]);
assert.deepEqual([first.command,first.data,second.command,second.data],
  ['ACTION6',{x:33,y:23},'ACTION6',{x:33,y:23}]);
assert.equal(first.scope,second.scope);
assert.deepEqual([e(n,1).status,e(n,1).outside,r(n,1).served,e(n,2).status,e(n,2).shift,e(n,2).side,r(n,2).served],
  ['filled_example_correspondence',true,{inside:76,outside:0},'observed_visible_cap_and_side_change',[0,-6],[true,true],{inside:89,outside:0}]);
assert.ok(third.refs.includes(r(n,2).ref));
for(let i=1;i<=12;i++){
  const q=t(n,i),b=r(n,i),v=e(n,i);
  assert.deepEqual([q.owner,q.entry,q.kind,q.guard,q.predicted,b.matched,b.reason,v.evidence],
    ['facet_examples','facet_example','public_facet_example','current_visible_face_bound',null,null,
      'observe_current_face_edit_without_assuming_owner',[q.ref,b.ref]]);
}
for(const [i,score,offset] of [[3,1,null],[7,2,[6,3]],[12,3,[-6,3]]]){
  if(offset)assert.deepEqual(t(n,i).method.offset,offset);
  assert.deepEqual([e(n,i).status,e(n,i).portable.boundary_ref,n[i].score],['official_boundary',r(n,i).ref,score]);
}
for(const i of [4,8]){
  const q=t(n,i);
  assert.deepEqual([q.offer,q.compound.prefix,q.compound.status,e(n,i).status,e(n,i).matched,e(n,i).outside],
    ['recall_seed_for_compound_reference',0,'observed_seed_method_revalidated_here','compound_seed_effect_matched',true,true]);
  assert.notEqual(q.scope,first.scope);
  assert.equal(q.refs.at(-1),r(n,i-1).ref);
}
assert.deepEqual(t(n,11).method.offset,[0,-6]);
assert.equal(t(n,13).owner,'observed_frontier');

for(const [key,i] of [['sansPassage',3],['sansPassageN3',7]]){
  const {rows,changes:[m]}=c[key];
  assert.deepEqual(rows.slice(0,i),n.slice(0,i));
  assert.deepEqual([m.tour,m.avant.boundary_ref,m.retour],[i,r(n,i).ref,r(n,i).ref]);
  const {boundary_ref,...still}=m.avant;
  assert.deepEqual(m.après,still);
  assert.deepEqual([rows[i].image,rows[i].niveau,rows[i].score,r(rows,i).packet],[n[i].image,n[i].niveau,n[i].score,r(n,i).packet]);
  assert.deepEqual([t(rows,i+1).owner,t(rows,i+1).data],['observed_frontier',{x:10,y:14}]);
}
const bad=c.référenceÉtrangère,m=bad.changes[0],old=r(n,2).ref,badTicket=t(bad.rows,4),goodTicket=t(n,4);
assert.equal(bad.changes.length,1);
assert.deepEqual(m.après,{...m.avant,boundary_ref:old});
assert.deepEqual(bad.rows.slice(0,3),n.slice(0,3));
assert.deepEqual([bad.rows[3].image,r(bad.rows,3).packet],[n[3].image,r(n,3).packet]);
const isBoundary=(reference,returned)=>reference===returned.ref;
assert.ok(isBoundary(m.avant.boundary_ref,r(n,3)));
assert.ok(!isBoundary(m.après.boundary_ref,r(n,3)));
assert.deepEqual(badTicket,{...goodTicket,refs:[...goodTicket.refs.slice(0,-1),old]});
assert.ok(badTicket.admitted);
assert.deepEqual([r(bad.rows,4).packet,e(bad.rows,4).status,e(bad.rows,4).matched],
  [r(n,4).packet,'compound_seed_effect_matched',true]);

for(const [name,i,owner] of [['stationnaireT1',1,'observed_frontier'],['stationnaireT2',2,'contextual_compartments']]){
  const rows=c[name].rows;
  assert.deepEqual(rows.slice(0,i),n.slice(0,i));
  assert.deepEqual(r(rows,i).packet,r(n,i).packet);
  assert.deepEqual([rows[i].image,r(rows,i).served,e(rows,i).status,t(rows,i+1).owner],
    [n[i-1].image,{inside:0,outside:0},'no_visible_effect',owner]);
}
const stats=shas.map(sha=>{
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(report,/pass 3\b/);assert.match(report,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((n,x)=>n+x.rows.length-1,0),testsAuteur:3};
});
const occurrences=n.slice(0,16).filter(x=>x.ticket?.owner==='facet_examples').length;
assert.equal(occurrences,12);
console.log(JSON.stringify({stats,moteur:tree(shas[0]),occurrences,
  phasesMêmeClic:[first.offer,second.offer],translationMesurée:e(n,2).shift,reprisesN2etN3:[4,8],
  référencePréFrontière:{attendue:m.avant.boundary_ref,substituée:m.après.boundary_ref,admissionNative:badTicket.admitted,
    mêmeRetour:JSON.stringify(r(bad.rows,4).packet)===JSON.stringify(r(n,4).packet)},score:n[16].score},null,2));
