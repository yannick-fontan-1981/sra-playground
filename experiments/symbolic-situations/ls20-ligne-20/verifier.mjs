import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','a0af03d0f7c1ebe722b3b7b8bc4db4ba05364025'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.prolongé.rows,cat=c.catalogue.rows;
const t=(x,i)=>x[i-1].ticket,r=(x,i)=>x[i].ret;
const edge=(rows,i)=>rows.flatMap(p=>p.ret?.events??[]).find(x=>x.observation_ref===r(rows,i).ref);
const show=(rows,i)=>{
  const {owner,action,data,route,ref,step}=t(rows,i),{finale,réel,différence}=r(rows,i);
  return {owner,action,data,route,ref,step,finale,réel,différence};
};
assert.deepEqual(Object.values(c).map(x=>x.rows.length-1),[16,18,7,7,14,10]);
for(const {rows} of Object.values(c))for(let i=1;i<rows.length;i++){
  const ticket=t(rows,i),returned=r(rows,i);
  assert.deepEqual([ticket.id,ticket.owner,ticket.admitted],[returned.ticket,returned.owner,true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,returned.ref);
}
for(let i=1;i<=16;i++)assert.deepEqual(show(cat,i),show(n,i));
assert.equal(cat[16].score,0);assert.equal(n[17].score,1);assert.equal(n[17].niveau,2);
const select=(rows,i,route,action)=>{
  const q=t(rows,i);
  assert.deepEqual([q.owner,q.kind,q.guard,q.route,q.action],['morphology','morphology_probe','current_geometry_bound',route,action]);
  return q;
};
const t7=select(n,7,'modifier','ACTION3'),f=t7.facts;
assert.deepEqual([f.orientation_relation,f.feature_residuals.orientation_alternatives,f.color_relation,f.homologous,t7.pair.scales],
  ['different',[3],'equal',true,[1,2]]);
assert.deepEqual([t7.step.from,t7.step.to,r(n,7).matched,r(n,7).différence],[[24,45],[19,45],true,52]);
assert.deepEqual([f.routes.modifier.observation_ref,f.routes.modifier.level_epoch],[t7.ref,t7.epoch]);
const effect=edge(n,10);
assert.deepEqual([r(n,10).reason,r(n,10).matched,effect.parent,effect.unchanged_peer,effect.route],
  ['measure_terminal_contact_or_boundary',null,t(n,10).ref,[33,9,39,15],'modifier']);
const st=effect.station_entry;
assert.deepEqual([st.before,st.after,st.from,st.site,st.peer_preserved],[t(n,10).ref,r(n,10).ref,[19,35],[19,30],true]);
assert.equal(st.before_pose.peer_pose,st.after_pose.peer_pose);
assert.equal(st.before_pose.peer_color,st.after_pose.peer_color);
assert.deepEqual(effect.peerCounts[0],effect.peerCounts[1]);
assert.notEqual(st.before_pose.mobile_pose,st.after_pose.mobile_pose);
assert.deepEqual([st.before_pose.residual,st.after_pose.residual],[3,0]);

const t11=select(n,11,'peer_access_probe','ACTION1'),t14=select(n,14,'peer','ACTION4');
for(const q of [t11,t14]){
  assert.deepEqual([q.facts.pair_ref,q.facts.orientation_relation,q.facts.feature_residuals.orientation_alternatives,
    q.facts.single_pattern_contact_change,q.facts.single_pattern_change_observation_ref],
    [f.pair_ref,'aligned',[0],true,r(n,10).ref]);
}
assert.deepEqual([t11.step.from,t11.step.to,r(n,11).matched,t14.step.from,t14.step.to,r(n,14).matched],
  [[19,30],[19,25],true,[29,25],[34,25],true]);
assert.notEqual(r(n,7).finale,r(n,14).finale);

for(const [key,reason,binding] of [['orientation','pose_not_discriminated','bound'],['périmée','modifier_access_unbound','stale_scope']]){
  const {rows,interventions:[probe]}=c[key];
  assert.deepEqual(rows.slice(0,6),n.slice(0,6));
  assert.deepEqual([probe.tour,probe.nominal.ref,probe.nominal.route,probe.altéré.route,probe.altéré.reason,
    probe.altéré.bindings.modifier,probe.altéré.authority],[7,t7.ref,'modifier',null,reason,binding,false]);
  assert.deepEqual([t(rows,7).ref,t(rows,7).owner,t(rows,7).action,r(rows,7).owner],[t7.ref,'view','ACTION2','view']);
  assert.notEqual(r(rows,7).finale,r(n,7).finale);
}
assert.equal(c.périmée.interventions[0].après.binding.observation_ref,t(n,5).ref);
assert.equal(c.orientation.interventions[0].après.orientation,'ambiguous');
const missing=c.sansSélectif.rows,probe=c.sansSélectif.interventions[0];
assert.deepEqual(missing.slice(0,13),n.slice(0,13));
assert.deepEqual([probe.tour,probe.nominal.ref,probe.nominal.route,probe.altéré.route,probe.altéré.reason,
  probe.altéré.bindings.peer,probe.altéré.authority],[14,t14.ref,'peer',null,'selective_contact_effect_unconfirmed','bound',false]);
assert.deepEqual([t(missing,14).ref,t(missing,14).action,t(missing,14).owner,r(missing,14).owner,r(missing,14).finale],
  [t14.ref,t14.action,'view','view',r(n,14).finale]);
const still=c.stationnaire.rows;
assert.deepEqual(still.slice(0,10),n.slice(0,10));
assert.deepEqual(r(still,10).réel,r(n,10).réel);assert.equal(r(still,10).présenté,r(n,9).finale);
assert.deepEqual([edge(still,10).station_entry,edge(still,10).unchanged_peer,t(still,11).owner,t(still,11).action],
  [null,null,'view','ACTION3']);
const test=(q,ret,owner)=>q.id===ret.ticket&&q.owner===owner&&ret.owner===owner;
assert.ok(test(t14,r(n,14),'morphology'));
assert.ok(!test(t14,r(missing,14),'morphology'));

const stats=shas.map(sha=>{
  const results=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(results,/pass 3\b/);assert.match(results,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((count,x)=>count+x.rows.length-1,0),testsAuteur:3};
});
const count=cat.slice(0,16).filter(row=>row.ticket.owner==='morphology').length;
assert.equal(count,10);
console.log(JSON.stringify({stats,moteur:tree(shas[0]),occurrencesCatalogue:count,témoin:[t7.action,t7.step.from,t7.step.to],
  contact:{résidu:[st.before_pose.residual,st.after_pose.residual],pairConservé:st.peer_preserved},
  sansSélectif:{commande:t(missing,14).action,nominal:t14.owner,variante:t(missing,14).owner,empreinteIdentique:true},scoreHorsCatalogue:n[17].score},null,2));
