import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'9186a49ea207caff1fee6a1386b506739b22d4a3'};
const arms=['nominal','sans-offre','contradiction','stationnaire','référence','sans-acquis'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(tree(shas.gel),tree(shas.candidat));
const cases=Object.keys(shas).map(engine=>Object.fromEntries(arms.map(arm=>{
  const {sha,arm:name,...r}=JSON.parse(readFileSync(join(dir,engine+'.'+arm+'.json'),'utf8'));
  assert.deepEqual([sha,name],[shas[engine],arm]);
  for(const cut of [...r.steps.map(x=>x.issued.cut),r.next?.cut].filter(Boolean))assert.equal(hash(cut.pre),cut.seal);
  return [arm,r];
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],nom=c.nominal.steps,first=nom[0],second=nom[1],third=nom[2],issued=first.issued,cut=issued.cut.pre;
const click=(x,y)=>['ACTION6',{x,y}];
for(const run of Object.values(c))for(let i=0;i<run.steps.length-1;i++)assert.equal(run.steps[i].after.ref,run.steps[i+1].issued.ref);
assert.deepEqual([issued.family,issued.entry,issued.type,issued.command,issued.index],
  ['public_occurrence_recall','observed_composition_services','chamber_relations',click(31,47),0]);
assert.deepEqual([cut.layout.controls.length,cut.layout.axes.length,cut.layout.axes.filter(a=>a.target!==null).length,
  cut.domain.count,cut.domain.enumerated,cut.domain.checks,cut.domain.complete,cut.domain.bounded],[4,8,6,1,16,35,true,false]);
assert.deepEqual(cut.memory.edges,{});
assert.deepEqual(cut.domain.offers,[issued.plan.candidate]);
assert.deepEqual(issued.plan.candidate.changes,['relation:9:12','relation:6:9','relation:11:12']);
const edit=issued.plan.edits[0];
assert.deepEqual([edit.id,edit.old,edit.new,edit.known,JSON.parse(edit.edge)],['relation:9:12','12','10',false,[5,'12','10']]);
assert.deepEqual(issued.envelope.point,[[31,47],12]);
assert.deepEqual(issued.envelope.real,{admitted:true,reason:'current_relation_control_bound'});
const acquired=first.after.record.memory.edges[edit.edge];
assert.deepEqual([first.after.matched,first.after.record.detail.changed_controls,acquired.evidence],
  [true,[edit.id],[issued.ref,first.after.ref]]);
const binds=(offer,receipt,evidence)=>receipt.record!==null&&evidence[0]===offer.ref&&evidence[1]===receipt.ref;
assert.ok(binds(issued,first.after,acquired.evidence));
assert.ok(!binds(second.issued,first.after,acquired.evidence));
assert.deepEqual([second.issued.command,third.issued.command],[click(27,51),click(35,51)]);
assert.deepEqual(second.issued.cut.pre.memory.edges[edit.edge],acquired);
assert.deepEqual([second.issued.plan.kind,third.issued.plan.kind],Array(2).fill('conditional_relation_contribution'));
assert.deepEqual([second.after.matched,third.after.matched,third.after.seal,third.after.levels],[true,null,true,1]);

const slot=c['sans-offre'],fallback=slot.steps[0],retried=slot.steps[1];
assert.deepEqual([fallback.issued.family,fallback.issued.command,fallback.issued.ref],['animated_contact',click(31,51),issued.ref]);
assert.deepEqual([retried.issued.type,retried.issued.command,retried.after.matched],['chamber_relations',issued.command,true]);
assert.ok(binds(retried.issued,retried.after,retried.after.record.memory.edges[edit.edge].evidence));

const conflict=c.contradiction;
assert.deepEqual([conflict.steps.length,conflict.next,conflict.stop,conflict.last.blocked,conflict.last.rawReason],
  [0,null,'frontier_unknown',true,'shared_relation_rows_contradicted']);
assert.equal(conflict.last.contradictory.observation,issued.ref);
assert.notEqual(conflict.last.contradictory.observed,conflict.last.contradictory.value);
const stale=c['référence'],[[ref,comp]]=stale.evaluations;
assert.deepEqual([stale.steps.length,stale.next,stale.stop,stale.last.raw,stale.last.offered],[0,null,'no_admissible_prefix','proposed','proposed']);
assert.equal(ref,issued.ref);assert.deepEqual(comp,issued.envelope);
assert.deepEqual(comp.foreign,{admitted:false,reason:'relation_binding_changed'});

const stationary=c.stationnaire,held=stationary.steps[0];
assert.deepEqual(held.issued,issued);
assert.equal(held.after.packet,first.after.packet);assert.notEqual(held.after.shown,held.after.physical);
assert.deepEqual([held.after.matched,held.after.record.detail.changed_controls,held.after.record.memory.edges,held.after.record.memory.failed],
  [false,[],{},[edit.trial]]);
assert.deepEqual([stationary.next.command,stationary.next.plan.kind,stationary.next.plan.edits[0].known],
  [second.issued.command,'relation_experiment',false]);

const reacquire=c['sans-acquis'].steps;
assert.deepEqual(reacquire[0],first);
const same=reacquire[1];
assert.deepEqual([same.issued.ref,same.issued.command,same.after.packet,same.after.matched],
  [second.issued.ref,second.issued.command,second.after.packet,true]);
const {edges:removed,...m}=second.issued.cut.pre.memory;
assert.deepEqual(same.issued.cut.pre,{...second.issued.cut.pre,memory:{...m,edges:{}}});
assert.deepEqual([same.issued.plan.kind,same.issued.plan.edits[0].known,same.after.record.detail.changed_controls],
  ['relation_experiment',false,['relation:6:9']]);
assert.ok(binds(same.issued,same.after,same.after.record.memory.edges[edit.edge].evidence));
const stats=Object.entries(shas).map(([engine,sha],i)=>({engine,sha,départs:arms.length,gestes:Object.values(cases[i]).reduce((n,r)=>n+r.steps.length,0)}));
console.log(JSON.stringify({stats,moteur:tree(shas.gel),inverse:{configurations:cut.domain.enumerated,relations:cut.domain.checks,admissibles:cut.domain.count},
  acquisition:{commande:edit.id,réglage:[edit.old,edit.new],support:JSON.parse(edit.edge)[0]},
  mêmeClic:{commande:same.issued.command,nominal:second.issued.plan.kind,variante:same.issued.plan.kind,empreinteIdentique:true},
  arrêts:{contradiction:conflict.stop,référence:stale.stop},scoreT3:third.after.levels},null,2));
