import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir,hpFile]=process.argv.slice(2);
const shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'d0348ec1f1646259b9c95f0fa4a44dd0bb966025'};
const singles=['une-fenetre','fenêtre-2','fenêtre-3','fenêtre-4'];
const arms=['nominal',...singles,'sans-adresse','stationnaire','un-seul-effet','sans-projection'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(tree(shas.gel),tree(shas.candidat));
const cases=Object.keys(shas).map(engine=>Object.fromEntries(arms.map(arm=>{
  const {sha,arm:name,...r}=JSON.parse(readFileSync(join(dir,engine+'.'+arm+'.json'),'utf8'));
  assert.deepEqual([sha,name],[shas[engine],arm]);
  for(const cut of [...r.steps.map(x=>x.pre.cut),r.next?.cut].filter(Boolean))assert.equal(hash(cut.pre),cut.seal);
  return [arm,r];
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.nominal.steps;
const p=(rows,i)=>rows[i-1].pre,r=(rows,i)=>rows[i-1].after;
const points=(f,key)=>f[key].flatMap(x=>x.groups.flat().map(tile=>tile.origin));
const click=(x,y)=>['ACTION6',{x,y}];
for(const run of Object.values(c))for(let i=0;i<run.steps.length-1;i++)assert.equal(run.steps[i].after.ref,run.steps[i+1].pre.ref);
const t1=p(n,1),cut=t1.cut.pre,fit=cut.retained.fit;
const source=[[12,10],[12,44],[44,44],[46,10]];
assert.deepEqual(points(cut.fields,'before').map(JSON.stringify).sort(),source.map(JSON.stringify).sort());
assert.deepEqual(cut.fields.before,cut.fields.used);
assert.deepEqual([fit.fit.window_count,fit.fit.holdout_correct,fit.fit.holdout_total,fit.fit.constant_baseline_correct,fit.equivalent_alignments],
  [4,28,32,20,1]);
assert.deepEqual(cut.retained.rule,{shape:[3,3],anchor:[1,1],orientation:0,roles:{0:true,2:false}});
assert.deepEqual([cut.out.constraints,cut.out.violations.length],[32,4]);
assert.deepEqual(cut.out.violations[0],{point:[36,36],value:9,equal:[8],different:[],sources:[[44,44]]});
const addresses=[[36,36],[36,44],[36,52],[52,44]],clicks=[click(38,38),click(38,46),click(38,54),click(54,46)];
for(let i=1;i<=4;i++){
  const t=p(n,i);
  assert.deepEqual([t.family,t.entry,t.kind,t.command,t.plan.selected.p,t.guard.admitted,t.bundle],
    ['window_constraints','multiscale_constraints','public_window_constraint',clicks[i-1],addresses[i-1],true,'OP18']);
}
assert.deepEqual(t1.scope,{live:{admitted:true,reason:'current_constraint_and_point_bound'},
  old:{admitted:false,reason:'projected_constraint_or_address_changed'},payload:[38,38]});
for(const i of [1,2]){
  const v=r(n,i).record.result;
  assert.deepEqual([v.status,v.address,v.before,v.after,v.satisfies_frozen_constraint,v.changes_outside_bound_field],
    ['local_rewrite_witness',addresses[i-1],9,8,true,2]);
  assert.deepEqual([p(n,i).plan.prediction,r(n,i).matched,r(n,i).seal],[null,null,true]);
}
const t3=p(n,3),known=t3.cut.pre.minimized.effects[0];
assert.equal(known[0],9);
assert.deepEqual(known[1],addresses.slice(0,2).map((a,i)=>({point:a.join(),value:8,ref:r(n,i+1).ref})));
assert.equal(t3.plan.selected_cells.length,2);
assert.deepEqual([t3.plan.selected.expected_value,r(n,3).matched,r(n,3).reason],[8,true,'projected_local_rewrite']);
assert.ok(t3.plan.prediction);
assert.deepEqual([r(n,4).levels,r(n,4).matched,r(n,4).reason],[1,null,'official_boundary']);

for(const [i,arm] of singles.entries()){
  const q=c[arm].steps,pre=p(q,1).cut.pre;
  assert.equal(p(q,1).ref,t1.ref);
  assert.deepEqual(pre.fields.before,cut.fields.before);
  assert.deepEqual(points(pre.fields,'used'),[source[i]]);
  assert.equal(pre.out,null);
  assert.deepEqual([p(q,1).family,p(q,1).command,p(q,2).family,p(q,2).command],
    ['observed_frontier',click(12,10),'window_constraints',clicks[0]]);
}
const uns=c['sans-adresse'].steps,d=p(uns,1),u=d.cut.pre;
assert.deepEqual([u.obs,u.fields,u.out],[cut.obs,cut.fields,cut.out]);
assert.deepEqual(u.removed.map(k=>k.data),[{x:38,y:38}]);
assert.deepEqual(u.addressed,cut.addressed.filter(x=>x[0]!==38||x[1]!==38));
assert.deepEqual([d.family,d.command,r(uns,1).record.result.address,r(uns,1).record.result.after],
  ['window_constraints',clicks[1],addresses[1],8]);

const little=c['un-seul-effet'].steps,less=p(little,3);
assert.deepEqual(little.slice(0,2),n.slice(0,2));
assert.deepEqual([less.ref,less.command,less.cut.pre.out,r(little,3).packet],[t3.ref,t3.command,t3.cut.pre.out,r(n,3).packet]);
assert.deepEqual([less.cut.pre.minimized.effects[0][1],less.plan.selected_cells.length,less.plan.prediction,r(little,3).matched],
  [[known[1][0]],1,null,null]);

const held1=c.stationnaire,held3=c['sans-projection'];
assert.deepEqual(p(held1.steps,1),t1);assert.equal(r(held1.steps,1).packet,r(n,1).packet);
assert.notEqual(r(held1.steps,1).presented,r(held1.steps,1).physical);
assert.deepEqual([r(held1.steps,1).record.memory.effects,held1.next.command],[[],clicks[1]]);
assert.deepEqual(held3.steps.slice(0,2),n.slice(0,2));
assert.deepEqual(p(held3.steps,3),t3);assert.equal(r(held3.steps,3).packet,r(n,3).packet);
assert.equal(r(held3.steps,3).presented,r(n,2).presented);
assert.deepEqual([r(held3.steps,3).matched,r(held3.steps,3).seal],[false,true]);

const hp=JSON.parse(readFileSync(hpFile,'utf8'));
assert.deepEqual([hp.sha,hp.arm],[shas.gel,'nominal']);
const win=hp.steps[3],prior=hp.steps[2];
assert.deepEqual([win.pre.family,win.pre.bundle,win.pre.command,win.pre.guard.admitted,win.after.matched,win.after.seal],
  ['public_window_question','OP18',click(14,30),true,null,true]);
assert.deepEqual([t1.bundle,t1.scope.payload,r(n,1).matched,r(n,1).seal],[win.pre.bundle,[38,38],null,true]);
assert.deepEqual(win.pre.plan.offer.methods[0].evidence,[prior.pre.ref,prior.after.ref]);
assert.ok(t1.plan.selected.sources.every(o=>source.some(s=>hash(o)===hash(s))));
assert.notEqual(win.pre.guard.reason,t1.guard.reason);
const count=n.filter(x=>x.pre.family==='window_constraints').length;
assert.equal(count,4);
const stats=Object.entries(shas).map(([engine,sha],i)=>({engine,sha,départs:arms.length,gestes:Object.values(cases[i]).reduce((total,item)=>total+item.steps.length,0)}));
console.log(JSON.stringify({stats,moteur:tree(shas.gel),occurrencesCatalogue:count,sources:source.length,contrôlesSourceSeule:singles.length,
  choixRetiréSansEffetSurLInférence:d.command,T3:{valeurPrévue:t3.plan.selected.expected_value,vrai:r(n,3).matched,
    retourStationnaire:r(held3.steps,3).matched},scoreT4:r(n,4).levels,contratCommunHPDL:{opération:t1.bundle,pointRequis:true,questionScellée:true}},null,2));
