import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','280a54b5dd589d192d369b690781de057efaec8c'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.nominal.rows,other=c.alternatif,still=c.stationnaire.rows,cross=c.autreReçu.rows;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].ret;
const event=(rows,i)=>rows.flatMap(x=>x.ret?.events??[]).find(x=>x.after===r(rows,i).ref&&x.kind==='metric_control_response');
assert.deepEqual([n.length-1,still.length-1,cross.length-1,c.référenceRecalculée.rows.length-1],[16,1,1,5]);
for(const {rows} of Object.values(c).filter(x=>x.rows))for(let i=1;i<rows.length;i++){
  const q=t(rows,i),b=r(rows,i);
  assert.deepEqual([q.id,q.owner,q.admitted],[b.ticket,b.owner,true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,b.ref);
}
const nominal=t(n,1),n2=t(n,3);
for(const i of [1,3]){
  const q=t(n,i);
  assert.deepEqual([q.owner,q.kind,q.guard,q.primitive.kind,q.controls,q.certifié,n[i-1].forme.selected],
    ['metric_composition','metric_composition_access','metric_target_selection_and_visible_support_bound','SELECT',null,true,null]);
  assert.ok(q.offers>0);
  assert.equal(r(n,i).matched,true);
  assert.equal(n[i].forme.selected,Number(q.primitive.cell_ref));
  assert.deepEqual(n[i].forme.fills,q.visible);
}
assert.deepEqual([nominal.action,nominal.data,nominal.target.scale,nominal.target.anchor,nominal.cost,nominal.primitive.occurrence_ref],
  ['ACTION6',{x:28,y:25},[2,1],[14,10],2,'visible:24']);
assert.deepEqual([n2.action,n2.data,n2.target.scale,n2.target.anchor,n2.cost,n2.primitive.occurrence_ref],
  ['ACTION6',{x:19,y:28},[3,1],[8,6],9,'visible:30']);
assert.deepEqual([r(n,2).reason,n[2].niveau,n[2].score,r(n,11).reason,n[11].niveau,n[11].score],
  ['official_score',2,1,'official_score',3,2]);
assert.equal(t(n,12).owner,'contextual_compartments');

const binding=(q,after)=>Number(q.primitive.cell_ref)===after.selected&&q.grid===after.grid&&q.source===after.target;
assert.ok(binding(nominal,n[1].forme));
assert.equal(n[0].empreinte,other.first);assert.equal(other.action,nominal.action);
assert.notDeepEqual(other.click,nominal.data);assert.equal(other.choice.grid,n[1].forme.grid);
assert.deepEqual([other.choice.target,other.choice.fills,other.choice.selected],[n[1].forme.target,n[1].forme.fills,8]);
assert.ok(!binding(nominal,other.choice));
assert.deepEqual([other.effect.selected,other.effect.fills[1],other.effect.fills[24],other.score],[1,'8','11',0]);
const [guard]=c.nominal.guards;
assert.deepEqual([guard.ref,guard.origine,guard.vrai.admitted,guard.croisé],[t(n,2).ref,'visible:24',true,{admitted:false,reason:'metric_premise_changed'}]);
for(const rows of [still,cross]){
  assert.deepEqual(rows[0],n[0]);assert.equal(r(rows,1).réel,r(n,1).réel);
  assert.deepEqual([r(rows,1).matched,r(rows,1).seal],[false,true]);
}
assert.equal(still[1].forme.selected,null);assert.equal(still[1].empreinte,n[0].empreinte);
assert.equal(cross[1].empreinte,other.physique[0]);assert.equal(cross[1].forme.selected,8);

const proof=event(n,4),current=event(n,5),transfer=t(n,5),resume=t(n,6);
assert.deepEqual([r(n,4).matched,proof.expected_visible_matched,proof.unknown_underlay_revealed],
  [true,true,false]);
assert.ok(transfer.refs.includes(r(n,4).ref));assert.ok(transfer.controls);
assert.deepEqual([transfer.primitive.occurrence_ref,transfer.primitive.destination_ref,current.expected_visible_matched,current.unknown_underlay_revealed],
  ['visible:30','16',true,false]);
assert.deepEqual([n[5].forme.grid,n[5].forme.selected,n[5].forme.fills],[transfer.grid,16,transfer.visible]);
assert.ok(n[4].forme.visibleTarget.flat().includes('9'));
assert.ok(!n[5].forme.visibleTarget.flat().includes('9'));
assert.notEqual(n[5].forme.target,transfer.source);
assert.equal(resume.source,n[5].forme.target);
assert.deepEqual([r(n,5).matched,r(n,5).seal,r(n,5).reason],[false,true,'metric_effect_or_underlay_requires_reconciliation']);
const replay=c.référenceRecalculée,change=replay.interventions[0];
assert.equal(replay.interventions.length,1);
assert.deepEqual(replay.rows.slice(0,5),n.slice(0,5));
assert.deepEqual([replay.rows[5].forme,replay.rows[5].empreinte,r(replay.rows,5).paquet],[n[5].forme,n[5].empreinte,r(n,5).paquet]);
assert.deepEqual([change.retour,change.offre,change.mesure],[r(n,5).ref,transfer.source,n[5].forme.target]);
assert.deepEqual([change.current.matched,change.current.seal_prefix,change.compared.matched,change.compared.seal_prefix,
  r(replay.rows,5).matched,r(replay.rows,5).seal],[false,true,true,false,true,false]);
const stats=shas.map(sha=>{
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(report,/pass 2\b/);assert.match(report,/fail 0/);
  return {sha,départsService:4,gestesService:23,départsPhysiquesComplémentaires:1,gestesPhysiquesComplémentaires:2,testsAuteur:2};
});
const count=n.slice(0,16).filter(x=>x.ticket.owner==='metric_composition').length;
assert.equal(count,11);
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:count,échelles:[nominal.target.scale,n2.target.scale],
  contrôles:{T5TransfertMesuré:current.expected_visible_matched,T5Scellé:r(n,5).seal,référenceSeule:r(replay.rows,5).matched,
    sélectionNominale:n[1].forme.selected,sélectionAlternative:other.choice.selected},score:n[16].score},null,2));
