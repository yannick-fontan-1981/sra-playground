import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','9b41b8ba322fceb2737a99dfa264a4d809055bad'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.nominal.rows,early=c.précoce;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].ret;
assert.deepEqual([n.length-1,c.deux.rows.length-1,c.zéro.rows.length-1,c.stationnaire.rows.length-1],[11,8,8,9]);
for(const {rows} of Object.values(c).filter(x=>x.rows))for(let i=1;i<rows.length;i++){
  const q=t(rows,i),b=r(rows,i);
  assert.deepEqual([q.id,q.owner,q.admitted],[b.ticket,b.owner,true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,b.ref);
}
for(const [i,x] of [34,28,22,16,10,4].entries()){
  const q=t(n,i+1);
  assert.deepEqual([q.owner,q.kind,q.action,q.data,q.information],['information_goal','experiment','ACTION6',{x,y:61},true]);
}
assert.deepEqual([t(n,7).owner,t(n,7).action,t(n,8).owner,t(n,8).action],['observed_frontier','ACTION3','observed_frontier','ACTION3']);
assert.ok(n.slice(0,8).every(r=>!r.unique));
const q=t(n,9),canonical=n[8];
assert.deepEqual([q.owner,q.entry,q.kind,q.action,q.data,q.guard,q.expected,q.information],
  ['public_occurrence_recall','framed_window_composition','framed_window_experiment','ACTION6',{x:33,y:24},'current_window_and_point_bound',null,false]);
const boxes=[[53,53,62,62],[1,1,62,42]],exact={checks:1749,matches:[[27,18]],boxes};
assert.deepEqual([canonical.unique,canonical.natif,canonical.indépendant],[true,exact,exact]);
assert.deepEqual([q.window.reference,q.window.image,q.window.window,q.window.point,q.window.examined,q.window.method,q.refs],
  [...boxes,[27,18],[33,24],1749,{status:'COMPLETE',complete:true},[q.ref]]);

const b=r(n,9),event=b.events.find(e=>e.evidence.at(-1)===b.ref);
assert.deepEqual([b.matched,b.seal,b.reason,b.official,n[9].score,event.kind,event.epoch,event.after_epoch,
  event.official_progress,event.canonical_changed,event.evidence],
  [null,true,'window_point_effect_requires_public_reconciliation',[2,1],1,'framed_window_response',1,2,true,true,[q.ref,b.ref]]);
assert.deepEqual([t(n,10).owner,t(n,10).action,t(n,10).question],['observed_frontier','ACTION3','rebind_prior_epoch_hypothesis_without_transferring_authority']);

assert.deepEqual(early.prefix,n.slice(0,8).map(x=>x.empreinte));
assert.deepEqual([early.action,early.level,early.gain,early.changed,early.unique],[[q.action,q.data],1,0,0,null]);
const [guard]=c.nominal.guards;
const refused={admitted:false,reason:'window_context_or_payload_changed'};
assert.deepEqual(guard,{actuel:{admitted:true,reason:'current_window_and_point_bound'},
  unTourAvant:refused,sansÉgalité:refused,doubleÉgalité:refused});
for(const [name,matches] of [['deux',[[5,5],[27,18]]],['zéro',[]]]){
  const rows=c[name].rows,crop=rows[8];
  assert.deepEqual(rows.slice(0,8),n.slice(0,8));
  assert.equal(crop.physique,canonical.physique);assert.notEqual(crop.empreinte,canonical.empreinte);
  assert.deepEqual([crop.unique,crop.natif,crop.indépendant],[false,{...exact,matches},{...exact,matches}]);
  assert.deepEqual([t(rows,9).owner,t(rows,9).action],['observed_frontier','ACTION3']);
}
const still=c.stationnaire.rows,held=r(still,9),negative=held.events.find(e=>e.evidence.at(-1)===held.ref);
assert.deepEqual(still.slice(0,9),n.slice(0,9));
assert.deepEqual([held.physique,held.official],[b.physique,b.official]);
assert.deepEqual([still[9].niveau,still[9].score,still[9].empreinte,held.matched,held.pixels],[1,0,canonical.empreinte,null,0]);
assert.deepEqual([negative.official_progress,negative.canonical_changed,negative.evidence],[false,false,[q.ref,held.ref]]);
assert.ok(held.blocked.some(e=>e.ref===held.ref&&e.keys.length===1&&e.keys[0]===q.window.trial));
assert.deepEqual([t(still,10).owner,t(still,10).action],['observed_frontier','ACTION3']);
const stats=shas.map(sha=>{
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(report,/pass 4\b/);assert.match(report,/fail 0/);
  return {sha,départsService:4,gestesService:36,départsPhysiquesComplémentaires:2,gestesPhysiquesComplémentaires:16,testsAuteur:4};
});
assert.equal(n.slice(0,11).filter(x=>x.ticket?.kind==='framed_window_experiment').length,1);
console.log(JSON.stringify({stats,moteur:tree(shas[0]),occurrencesCatalogue:1,comparaisons:exact.checks,fenêtre:exact.matches[0],
  témoinPrécoce:{gain:early.gain,pixels:early.changed},gainT9:b.official,retourStationnaire:negative.official_progress},null,2));
