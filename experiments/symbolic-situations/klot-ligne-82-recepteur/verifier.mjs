import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root=process.argv[2];
const versions=['03fba8c827c9a4725d1fda343695fe6e9fbb533d','37983796259ab45f3366364896a72c55752e332d'];
const load=(s,g,ext='json')=>readFileSync(join(root,s.slice(0,8)+'.'+g+'.'+ext),'utf8');
const [parent,candidate]=versions.map(sha=>Object.assign({},...['catalogue','retours'].map(group=>{
  const data=JSON.parse(load(sha,group));
  assert.equal(data.sha,sha);
  assert.equal(data.group,group);
  return data.cases;
})));
const authored=load(versions[1],'auteur','txt');
assert.match(authored,/\bpass 4\b/);
assert.match(authored,/\bfail 0\b/);
assert.deepEqual(candidate.nominal,parent.nominal);
const n=candidate.nominal.rows;
assert.equal(n.length,17);
assert.ok(n.slice(0,16).every(x=>x.ticket.owner==='selected_rigid'&&x.ticket.admitted));
assert.equal(n.filter(r=>r.ret?.matched===true).length,12);
assert.equal(n.at(-1).score,1);
const moved=event=>Object.keys(event.avant).filter(k=>JSON.stringify(event.avant[k])!==JSON.stringify(event.après[k]));
for(const [t,subject] of [[2,'11'],[7,'6'],[9,'12']]){
  const {ret}=n[t],ticket=n[t-1].ticket;
  assert.equal(ret.id,ticket.id);
  assert.deepEqual([ret.event.detail.before,ret.event.detail.after],[ticket.ref,ret.ref]);
  assert.deepEqual(moved(ret.event),[subject]);
  assert.equal(ret.event.detail.role_status,'observed_exclusive_receiver');
}
for(const key of ['sélectionStationnaire','mouvementStationnaire','deuxPasBonsujet'])
  assert.deepEqual(candidate[key],parent[key]);
const proper=candidate.deuxPasBonsujet.rows.at(-1);
assert.equal(proper.ret.event.sujet,'6');
assert.deepEqual(moved(proper.ret.event),['6']);
assert.deepEqual([proper.ret.event.avant['6'],proper.ret.event.après['6']],[[0,3],[0,1]]);
assert.deepEqual([proper.ret.matched,proper.ret.event.detail.compatible_model_count,proper.ret.event.detail.role_status],
  [false,0,'observed_exclusive_receiver']);
assert.equal(proper.ticket,null);
const interventions=[];
for(const [name,t,expected,alternate] of [['autreRécepteur7',7,'6','11'],['autreRécepteur9',9,'12','6']]){
  const original=parent[name],fixed=candidate[name];
  assert.deepEqual(original.alternate,fixed.alternate);
  assert.deepEqual([fixed.alternate.expected,fixed.alternate.moved],[expected,[alternate]]);
  assert.deepEqual(original.rows.slice(0,t),fixed.rows.slice(0,t));
  const a=original.rows[t],b=fixed.rows[t];
  assert.deepEqual(moved(b.ret.event),[alternate]);
  assert.deepEqual([b.ret.event.sujet,b.ret.event.detail.moved,b.ret.event.detail.compatible_model_count],
    [expected,true,0]);
  const earlier=a.ret.event.detail.role_status,later=b.ret.event.detail.role_status;
  assert.equal(earlier,'observed_exclusive_receiver');
  assert.equal(later,'blocked_or_unselected_remains_conditional');
  const restored=structuredClone(b);
  restored.ret.event.detail.role_status=earlier;
  assert.deepEqual(a,restored);
  assert.equal(b.ret.matched,false);
  assert.equal(b.ret.scellé,true);
  assert.equal(b.ticket,null);
  assert.equal(b.arrêt,'rigid_control_or_collision_model_refuted');
  assert.equal(b.ret.packet,n[t].ret.packet);
  interventions.push({tour:t,sujetAttendu:expected,sujetMesuré:alternate,gel:earlier,correctif:later,arrêt:b.arrêt,
    reçu:b.ret.ref});
}
assert.ok([parent,candidate].every(c=>Object.values(c).reduce((s,r)=>s+r.rows.filter(x=>x.ret).length,0)===48));
console.log(JSON.stringify({stats:{versions:2,départsParVersion:6,gestesServiceParVersion:48,
  gestesAuxiliairesParVersion:17,testsCorrectif:4,retoursÉtrangersCorrigés:2,catalogue:16},interventions,
  doublePas:{mouvement:proper.ret.event.après['6'],modèles:proper.ret.event.detail.compatible_model_count,
    rôle:proper.ret.event.detail.role_status}},null,2));
