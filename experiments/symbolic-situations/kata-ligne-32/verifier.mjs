import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','d22d706c8c148da1b6bde090d3c6c53d20c69d50'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(group=>{
  const p=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(p.sha,sha);assert.equal(p.group,group);return p.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.prolongé.rows,cat=c.catalogue.rows,still=c.stationnaire.rows,one=c.moinsUn.rows,all=c.moinsTout.rows,privateRun=c.réserve.rows;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].ret;
const e=(rows,i)=>rows.flatMap(x=>x.ret?.events??[]).find(x=>x.detail.after===r(rows,i).ref);
assert.deepEqual(Object.values(c).map(x=>x.rows.length-1),[16,33,1,19,19,1]);
for(const {rows} of Object.values(c))for(let i=1;i<rows.length;i++){
  const q=t(rows,i),x=r(rows,i);
  assert.equal(q.id,x.ticket);
  assert.deepEqual([q.owner,q.kind,x.owner,q.admitted],['preview_packing','preview_packing','preview_packing',true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,x.ref);
}
assert.deepEqual(cat.slice(0,16),n.slice(0,16));
assert.deepEqual([r(cat,16),cat[16].score],[r(n,16),2]);
const first=t(n,1);
assert.deepEqual([first.chosen.id,first.chosen.color,first.chosen.anchor,first.target.anchor,first.data,first.selected,first.preview],
  ['piece:2',14,[0,5],[0,1],{x:29,y:4},null,null]);
assert.equal(first.prediction,null);
const observed=e(n,1);
function materialBinding(claim,plan,event,returned){
  return Boolean(claim && claim.member===plan.chosen.id && claim.ref===returned.ref && event.selected===claim.member &&
    event.detail.before===plan.ref && event.detail.after===claim.ref && claim.samples.length===plan.chosen.mask.length &&
    claim.samples.every(counts=>Object.keys(counts).length===1&&Object.hasOwn(counts,event.preview_color))&&
    event.preview_color!==plan.chosen.color);
}
assert.ok(materialBinding(observed.binding,first,observed,r(n,1)));
assert.deepEqual([observed.preview_color,observed.epoch,observed.detail.selection_observed,r(n,1).matched],[0,1,true,null]);
assert.equal(t(n,2).mode,'edit');assert.ok(t(n,2).refs.includes(r(n,1).ref));
assert.deepEqual(still[0],n[0]);
assert.deepEqual(r(still,1).réel,r(n,1).réel);
assert.notEqual(r(still,1).présenté,r(still,1).finale);
assert.deepEqual([e(still,1).detail.selection_observed,e(still,1).selected,t(still,2).mode,t(still,2).data],[false,null,'select',first.data]);
assert.deepEqual(e(n,2).controls,{});
assert.deepEqual(e(n,5).controls.ACTION3,{kind:'translation',delta:[0,-1],evidence:[t(n,5).ref,r(n,5).ref]});
assert.deepEqual([t(n,6).action,t(n,6).prediction.anchor,r(n,6).matched],['ACTION3',[0,3],true]);
assert.ok(t(n,6).refs.includes(r(n,5).ref));
assert.deepEqual([n[8].score,n[16].score,n[33].score],[1,2,3]);

const preview=t(n,18);
assert.deepEqual([t(n,17).mode,t(n,17).chosen.id,t(n,17).target.anchor,e(n,17).selected],
  ['select','piece:2',[2,0],'piece:2']);
assert.deepEqual([preview.selected,preview.preview,preview.action,preview.prediction.anchor,r(n,18).matched],
  ['piece:2',0,'ACTION2',[1,6],true]);
assert.ok(preview.refs.includes(r(n,17).ref));
for(const key of ['moinsUn','moinsTout']){
  const scenario=c[key],rows=scenario.rows,change=scenario.interventions[0];
  assert.equal(scenario.interventions.length,1);
  assert.deepEqual(rows.slice(0,17),n.slice(0,17));
  assert.deepEqual([change.ref,change.action,change.prediction],[preview.ref,preview.action,preview.prediction]);
  assert.deepEqual(t(rows,18).chosen,preview.chosen);
  assert.equal(t(rows,18).selected,preview.selected);
  assert.equal(t(rows,18).preview,preview.preview);
  assert.equal(t(rows,18).prediction,null);assert.equal(r(rows,18).matched,null);
  assert.equal(t(rows,19).action,'ACTION2');assert.equal(r(rows,19).matched,true);
}
assert.deepEqual([Object.keys(c.moinsUn.interventions[0].kept).sort(),Object.keys(c.moinsTout.interventions[0].kept)],[['ACTION1','ACTION3','ACTION4','ACTION5'],[]]);
assert.deepEqual([t(one,18).action,r(one,18).réel,e(one,18).detail.observed_pose.anchor,t(one,19).prediction.anchor],
  ['ACTION2',r(n,18).réel,[1,6],[2,6]]);
assert.deepEqual([t(all,18).action,e(all,18).detail.observed_pose.anchor,t(all,19).prediction.anchor],['ACTION1',[0,6],[1,6]]);
const placed=e(n,25).pieces.find(p=>p.id==='piece:2');
const next=t(n,26);
assert.deepEqual([placed.anchor,placed.mask],[t(n,25).target.anchor,t(n,25).target.mask]);
assert.deepEqual([r(n,25).matched,next.mode,next.chosen.id,next.target.anchor,e(n,26).selected],
  [true,'select','piece:3',[2,1],'piece:3']);
assert.ok(materialBinding(e(n,26).binding,next,e(n,26),r(n,26)));

const reserved=e(privateRun,1),returnReserved=r(privateRun,1);
assert.equal(r(n,1).finale,returnReserved.finale);
assert.deepEqual(returnReserved.servi,[returnReserved.finale]);
assert.ok(materialBinding(reserved.binding,first,reserved,returnReserved));
assert.ok(reserved.invented);
assert.equal(reserved.invented.ref,reserved.binding.ref);
assert.notEqual(reserved.invented.member,reserved.binding.member);
assert.ok(!materialBinding({...reserved.binding,member:reserved.invented.member},first,reserved,returnReserved));
const stats=shas.map(sha=>{
  const tests=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(tests,/pass 3\b/);assert.match(tests,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((count,x)=>count+x.rows.length-1,0),testsAuteur:3};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:16,
  sélection:{cible:first.target.anchor,cellules:observed.binding.samples.length,couleur:observed.preview_color},
  reprise:{nominal:[preview.action,preview.prediction.anchor],sansAction2:[t(one,18).action,t(one,18).prediction,t(one,19).prediction.anchor],
    sansTout:[t(all,18).action,t(all,18).prediction,t(all,19).prediction.anchor]},
  changement:{posé:placed.id,pose:placed.anchor,prochain:next.chosen.id,cible:next.target.anchor,scoreN3:n[33].score},
  réserve:{imagesRéelles:returnReserved.réel.length,imagesServies:returnReserved.servi.length,rejetFaux:true}},null,2));
