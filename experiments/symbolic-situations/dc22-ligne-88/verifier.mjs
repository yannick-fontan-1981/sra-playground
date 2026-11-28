import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','d713024aa7f9b45c8fbd114b86209d36c4efd6ba'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.nominal.rows,s=c.stationnaire.rows,w=c.retrait.rows,alt=c.alternatif;
const t=(v,i)=>v[i-1].ticket,r=(v,i)=>v[i].ret;
const e=(v,i,kind)=>v.flatMap(x=>x.ret?.events??[]).find(x=>x.after===r(v,i).ref&&x.kind===kind);
assert.deepEqual([n.length-1,s.length-1,w.length-1,alt.commandes.length+1],[16,2,9,10]);
for(const rows of [n,s,w])for(let i=1;i<rows.length;i++){
  const a=t(rows,i),b=r(rows,i);
  assert.deepEqual([a.id,a.owner,a.admitted],[b.ticket,b.owner,true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,b.ref);
}
assert.equal(t(n,1).owner,'acquire_control_for_target');
for(let i=2;i<=16;i++)assert.deepEqual([t(n,i).owner,t(n,i).kind,t(n,i).guard],
  ['support_navigation','reconfigurable_support','current_support_actor_and_epoch_bound']);
const learn=t(n,2),got=e(n,2,'unit_translation_and_support_observed');
assert.deepEqual([learn.action,learn.actor,learn.underlay,learn.promesse,learn.positions,r(n,2).matched],
  ['ACTION2',[10,38,11,39],[2],null,[null],null]);
assert.deepEqual([got.command,got.delta,got.before,got.after],['ACTION2',[2,0],learn.ref,r(n,2).ref]);
assert.deepEqual(t(n,5).actions.map(a=>a.action_ref),['ACTION1','ACTION4']);
assert.deepEqual(t(n,5).positions,[[10,38],[12,38]]);
assert.ok(r(n,5).matched&&r(n,6).matched);
assert.deepEqual(t(s,2),learn);assert.deepEqual(r(s,2).paquet,r(n,2).paquet);
assert.equal(s[2].empreinte,n[1].empreinte);assert.equal(e(s,2,'unit_translation_and_support_observed'),undefined);
assert.deepEqual([t(s,3).action,t(s,3).promesse],['ACTION2',null]);

assert.equal(new Set([7,8,9].map(i=>t(n,i).experiment)).size,3);
for(const i of [7,8,9]){
  const q=t(n,i),change=e(n,i,'remote_support_effect_measured'),closed=e(n,i,'contextual_control_question_closed');
  assert.deepEqual([q.action,q.data,q.promesse,r(n,i).matched],['ACTION6',{x:48,y:i===9?36:19},[12,38],true]);
  assert.deepEqual([change.before,change.after,change.usefulness,closed.question],[q.ref,r(n,i).ref,'unconfirmed',q.experiment]);
  assert.ok(change.cellRows>0);
}
assert.deepEqual([r(n,9).changement['4→9'],r(n,9).changement['9→4']],[8,8]);
assert.deepEqual([t(n,10).positions.length,t(n,10).positions.slice(0,2),t(n,10).actions.slice(0,2).map(a=>a.action_ref),t(n,11).promesse,r(n,11).matched],
  [7,[[10,38],[10,36]],['ACTION3','ACTION1'],[10,36],true]);
assert.deepEqual([n[10].surface,n[11].surface.cible],[{porteur:[14,14,14,14],cible:[9,9,9,9]},[14,14,14,14]]);
assert.equal(n[16].score,0);

assert.equal(alt.origin,n[0].empreinte);
assert.deepEqual(alt.prefix,n.slice(1,9).map(x=>x.empreinte));
assert.equal(alt.commandes.at(-1),3);
assert.deepEqual(alt.avant,{porteur:[14,14,14,14],cible:[4,9,9,4]});
assert.deepEqual([alt.après,alt.empreintes[1],alt.changement,alt.score],[alt.avant,alt.empreintes[0],{},0]);
const [guard]=c.nominal.guards;
assert.equal(c.nominal.guards.length,1);
assert.deepEqual([guard.ref,guard.command.action_ref,guard.index,guard.surfaceÉtrangère],[t(n,11).ref,'ACTION1',1,alt.avant]);
assert.deepEqual([guard.vrai,guard.croisé],
  [{admitted:true,reason:'current_support_actor_and_epoch_bound'},{admitted:false,reason:'support_binding_changed'}]);

assert.deepEqual(w.slice(0,8),n.slice(0,8));
assert.deepEqual(c.retrait.interventions,[{ref:t(n,9).ref,key:t(n,9).experiment,offer:t(n,9).actions[0]}]);
assert.deepEqual([t(w,9).ref,t(w,9).owner,t(w,9).kind,t(w,9).action,t(w,9).data,r(w,9).owner,w[9].surface.cible,w[9].stop],
  [t(n,9).ref,'public_occurrence_recall','nested_control_experiment','ACTION6',{x:24,y:20},'public_occurrence_recall',[4,9,9,4],'nested_control_effect_requires_composition']);
assert.notEqual(r(w,9).vrai,r(n,9).vrai);
const stats=shas.map(sha=>{
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(report,/pass 2\b/);assert.match(report,/fail 0/);
  return {sha,départsService:3,gestesService:27,départsPhysiquesComplémentaires:1,gestesPhysiquesComplémentaires:10,testsAuteur:2};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:15,mesureT2:got.delta,réglageT9:[t(n,9).data,t(w,9).data],
  accès:{cible:t(n,11).promesse,nominal:n[10].surface.cible,alternatif:alt.avant.cible,resultatGarde:guard.croisé.reason}},null,2));
