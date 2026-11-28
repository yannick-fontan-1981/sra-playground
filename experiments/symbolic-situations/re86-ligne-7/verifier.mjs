import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','8e820aa64f321153bb858040d462d7f766178947'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.cases;
}
const runs=shas.map(sha=>Object.assign({},...['nominal','prolongé','alternative','réserve'].map(g=>read(sha,g))));
assert.deepEqual(runs[0],runs[1]);
const c=runs[0],cat=c.catalogue.rows,n=c.prolongé.rows,a=c.alternative.rows;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].ret;
const e=(rows,i)=>rows.flatMap(row=>row.ret?.events??[]).find(x=>x.ref===r(rows,i).ref);
const choice=t=>[t.owner,t.kind,t.action,t.index];
const family='constellation_cover',kind='controlled_constellation_cover';
for(const {rows} of Object.values(c))for(let i=0;i<rows.length-1;i++){
  const ticket=rows[i].ticket,ret=rows[i+1].ret;
  assert.ok(ticket.admitted);assert.equal(ticket.id,ret.id);assert.equal(ticket.owner,ret.owner);
  if(rows[i+1].ticket)assert.equal(rows[i+1].ticket.ref,ret.ref);
}
assert.deepEqual([c.catalogue.budget,c.prolongé.budget,c.alternative.budget],[16,30,32]);
assert.equal(cat.length,17);assert.equal(n.length,28);assert.equal(a.length,30);
for(let i=1;i<=16;i++){
  assert.deepEqual(choice(t(cat,i)),choice(t(n,i)));
  assert.equal(t(cat,i).owner,family);assert.equal(t(cat,i).kind,kind);
  assert.equal(r(cat,i).packet,r(n,i).packet);assert.equal(r(cat,i).matched,r(n,i).matched);
  assert.deepEqual(e(cat,i),e(n,i));
}
const first=t(n,1);
assert.deepEqual([first.action,first.mode,first.bodies,first.vectors,first.selector,first.expected],['ACTION1','acquire',0,{},null,null]);
assert.deepEqual([1,2,3,4].map(i=>e(n,i).vector),[[0,-3],[0,3],[-3,0],[3,0]]);
for(let i=1;i<=4;i++){
  assert.equal(e(n,i).before,t(n,i).ref);
  assert.ok(t(n,i+1).refs.includes(r(n,i).ref));
}
const support0=e(n,4).supports[0],support1=e(n,8).supports[0];
assert.deepEqual([support0.owner,support0.palette,support0.pixels,support1.owner,support1.palette,support1.pixels],[0,9,53,1,11,45]);
assert.ok(support0.refs.includes(r(n,4).ref));assert.ok(support1.refs.includes(r(n,8).ref));
const valid=(support,owner,ref)=>support.owner===owner && support.refs.includes(ref);
assert.ok(valid(support1,1,r(n,8).ref));assert.ok(!valid({...support1,owner:0},1,r(n,8).ref));
for(const i of [5,8,20])assert.equal(e(n,i)['seléction'],true);
assert.deepEqual([t(n,9).poses,t(n,9).active,t(n,9).complete,t(n,9).mode],[[[36,45],[18,24]],0,true,'move']);
assert.ok(t(n,9).refs.includes(r(n,8).ref));assert.equal(r(n,9).matched,true);
assert.deepEqual([t(n,21).poses,t(n,21).active,t(n,21).complete,t(n,21).mode],[[[48,24],[18,24]],1,true,'move']);
assert.equal(r(n,21).matched,true);
for(let i=9;i<=25;i++)if(i!==20)assert.deepEqual([r(n,i).matched,r(n,i).reason],[true,'compare_frozen_joint_supports']);
assert.deepEqual([r(n,26).matched,r(n,26).reason,n[26].score,e(n,26).status],[null,'official_boundary',1,'official_boundary']);
assert.deepEqual([n[26].niveau,t(n,27).mode,t(n,27).bodies,t(n,27).complete],[2,'acquire',0,false]);

assert.equal(t(a,1).ref,first.ref);
assert.deepEqual(c.alternative.interventions,[{tour:1,retirée:'ACTION1',départ:first.ref}]);
assert.deepEqual([t(a,1).action,e(a,1).vector,t(a,2).action],['ACTION2',[0,3],'ACTION1']);
assert.deepEqual(t(a,2).vectors,{ACTION2:[0,3]});
assert.deepEqual([t(a,9).poses,t(a,9).complete,t(a,9).mode,r(a,9).matched],[[[36,45],[18,30]],true,'move',true]);
assert.ok(t(a,9).refs.includes(r(a,8).ref));
assert.deepEqual([a[28].score,r(a,28).reason,t(a,29).mode,t(a,29).bodies],[1,'official_boundary','acquire',0]);

const stationary=c.stationnaire.rows,next=t(stationary,2);
assert.deepEqual(t(stationary,1),first);assert.equal(r(stationary,1).packet,r(n,1).packet);
assert.equal(r(stationary,1).pixels[1],0);
assert.deepEqual([e(stationary,1).vector,e(stationary,1).bodies,e(stationary,1).tried,r(stationary,1).matched],[undefined,0,1,null]);
assert.deepEqual([next.action,next.vectors,next.mode],['ACTION2',{},'acquire']);

const edit=c.composante.rows, s8=c.stationnaire8.rows;
for(const rows of [edit,s8]){
  assert.deepEqual(rows.slice(0,7),n.slice(0,7));assert.deepEqual(t(rows,8),t(n,8));
  assert.equal(r(rows,8).packet,r(n,8).packet);
}
const components=r(edit,8).composantes;
assert.equal(components.reduce((s,v)=>s+v,0),r(n,8).pixels[0]);
assert.ok(components.includes(r(edit,8).pixels[1]));
assert.deepEqual(r(edit,8).pixels,[3,1]);
assert.deepEqual([e(edit,8).status,e(edit,8).bodies,e(edit,8).complete],['focus_ambiguous',2,false]);
assert.equal(t(edit,9).owner,'observed_frontier');
assert.equal(r(s8,8).pixels[1],0);
assert.deepEqual([e(s8,8).status,e(s8,8).complete,t(s8,9).owner],['selection_hypothesis_refuted',false,'pre_score_contact']);
const stats=shas.map(sha=>{
  const tests=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(tests,/pass 3\b/);assert.match(tests,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((s,x)=>s+x.rows.length-1,0),testsAuteur:3};
});
function summary(rows,i){
  const v=t(rows,i);
  return v&&{choix:choice(v),mode:v.mode,bodies:v.bodies,complete:v.complete,poses:v.poses};
}
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:16,nominal:{vecteurs:[1,2,3,4].map(i=>e(n,i).vector),
  supports:[support0,support1],couvertureT9:t(n,9).poses,couvertureT21:t(n,21).poses,scoreT26:n[26].score},
  alternative:{commande:t(a,1).action,couverture:t(a,9).poses,scoreT28:a[28].score},stationnaireT1:summary(stationary,2),
  réserve:{composantes:components,pixels:r(edit,8).pixels,partiel:summary(edit,9),stationnaire:summary(s8,9)}},null,2));
