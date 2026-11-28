import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const dir=process.argv[2],read=f=>JSON.parse(readFileSync(join(dir,f)));
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const versions=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','626afb83bcc904c6be987fae08fae01b7bd8a94b','be816a3f09e7b36d9393aaead8d835d9dc3850c5'];
function load(sha,g){
  const f=read(sha.slice(0,8)+'.'+g+'.json');assert.equal(f.sha,sha);return f.results;
}
const runs=versions.map(sha=>Object.assign({},...['budget','preuve','substitution','autre'].map(g=>load(sha,g))));
assert.deepEqual(runs[0],runs[1]);assert.deepEqual(runs[1],runs[2]);
const cases=runs[2],reference=cases.borne17.steps,start=reference[15],probe=reference[16],f=start.pre.frontiere.pre;
const stock=load('8ce7ee3563fa1d5eca1639c6ad03975cfc962460','catalogue').borne16;
assert.deepEqual(stock.steps,cases.borne16.steps);assert.deepEqual(stock.stop,cases.borne16.stop);
const labels=t=>[t.pre.family,t.pre.strategy,t.pre.kind,t.pre.cmd,t.after.matched];
for(const r of Object.values(cases)){
  for(const [i,t] of r.steps.entries()){
    assert.equal(t.seal,digest(t.pre));assert.ok(t.pre.guard);
    if(r.steps[i+1])assert.equal(t.after.ref,r.steps[i+1].pre.ref);
  }
  assert.deepEqual(r.steps.slice(0,15).map(labels),reference.slice(0,15).map(labels));
}
for(const name of ['borne16','borne17']){
  const r=cases[name],t=r.steps[15];assert.equal(t.pre.index,0);assert.equal(t.pre.global,'observed_frontier');
  assert.deepEqual(labels(t),['observed_frontier','reach_open_input','access','ACTION4',true]);
  assert.ok(t.after.ref.endsWith(t.pre.expected));assert.ok(!t.after.outcome);
  assert.equal(r.stop.raison,'session_action_budget');
}
assert.equal(f.local,null);assert.equal(f.routeStatus,'found');assert.ok(f.domain.every(q=>q.tried.length));assert.equal(f.path.length,1);
const edge=f.path[0],past=reference[11],witness='transition:'+digest([past.pre.ref,{action_ref:past.pre.cmd},past.after.ref]);
assert.deepEqual(edge.witnesses,[witness]);assert.deepEqual(start.pre.path,[edge.ref]);assert.equal(f.remote.context,edge.target);
assert.notEqual(start.pre.need,start.pre.accessNeed);assert.equal(start.pre.question,probe.pre.question);
assert.equal(probe.pre.index,1);assert.equal(probe.pre.expected,null);assert.equal(probe.pre.cmd,'ACTION3');
assert.equal(probe.after.matched,null);assert.equal(probe.after.outcome.status,'observed');assert.equal(probe.after.outcome.objective,start.pre.question);
assert.equal(probe.after.outcome.need,start.pre.need);
assert.equal(cases.lecture16.steps[15].pre.family,'returned_branch_contrast');assert.equal(cases.lecture16.steps[15].pre.frontiere,null);
assert.equal(cases.lecture16.steps[15].after.ref,start.after.ref);
const checks={};
for(const name of ['question','arête','remplacement','autre-question','retrait']){
  const r=cases[name];assert.deepEqual(r.steps.slice(0,15),reference.slice(0,15));
  assert.equal(r.checks.length,1);const c=r.checks[0];assert.equal(c.ref,start.pre.ref);assert.deepEqual(c.local,[]);
  assert.deepEqual(c.possibles.map(p=>p.arêtes.length),[1,2,3]);assert.equal(new Set(c.possibles.map(o=>o.question)).size,3);
  assert.deepEqual(c.normal,c.possibles[0]);assert.equal(c.normal.question,start.pre.question);
  for(const q of c.possibles){
    assert.equal(q.arêtes[0].id,edge.ref);assert.equal(q.arêtes[0].source,f.index);
    for(const [i,e] of q.arêtes.entries()){
      assert.ok(e.witnesses.every(id=>reference.slice(0,15).some(t=>id==='transition:'+digest([t.pre.ref,e.action,t.after.ref]) && t.pre.cmd===e.action.action_ref)));
      if(i)assert.equal(q.arêtes[i-1].target,e.source);
    }
    assert.equal(q.contexte,q.arêtes.at(-1).target);
  }
  if(['arête','retrait'].includes(name)){
    assert.equal(r.steps.length,15);assert.deepEqual(c.rendu.arêtes,[]);assert.equal(c.rendu.question,null);
    assert.equal(r.stop.kind,'stopped');assert.equal(r.stop.reason,'frontier_frontier_exhausted');
  }else{
    const t=r.steps[15],u=r.steps[16],same=name==='remplacement';
    assert.equal(t.pre.question,c.rendu.question);assert.deepEqual(t.pre.path,c.rendu.arêtes.map(e=>e.id));
    assert.equal(t.pre.family,'observed_frontier');assert.deepEqual(t.pre.path,u.pre.path);assert.equal(t.pre.ref,start.pre.ref);
    assert.equal(t.pre.cmd,'ACTION4');assert.equal(t.after.matched,true);assert.equal(t.after.ref,start.after.ref);
    if(same){assert.deepEqual(r.steps,reference);assert.equal(c.fournisseur,'énumération');}
    else{
      assert.deepEqual(c.rendu,c.possibles[1]);assert.notEqual(t.pre.need,start.pre.need);
      assert.equal(u.pre.cmd,'ACTION4');assert.equal(u.after.matched,true);assert.ok(u.after.ref.endsWith(u.pre.expected));
      assert.equal(u.after.outcome,undefined);assert.equal(u.after.completed,2);assert.equal(r.stop.raison,'session_action_budget');
      if(name==='autre-question')assert.equal(c.fournisseur,'énumération');
    }
  }
  checks[name]={longueur:c.rendu.arêtes.length,question:c.rendu.question,tickets:r.steps.slice(15).map(labels),arrêt:r.stop};
}
assert.deepEqual(cases['autre-question'].steps,cases.question.steps);
const transitions=load(versions[2],'appels');assert.deepEqual(load(versions[0],'appels'),transitions);
const cut=transitions['arrêt-15'],resume=transitions['reprise-16'];
assert.deepEqual(cut.steps,cases.borne16.steps.slice(0,15));assert.deepEqual(resume.steps,cases.borne16.steps);
assert.equal(cut.stop.prochain,'boundary');assert.equal(cut.appels.length,1);assert.deepEqual(cut.appels,resume.appels.slice(0,1));
const [a,b]=resume.appels;assert.equal(a.appel,'advance');assert.equal(a.ticketEntrant,reference[14].pre.ticket);
assert.equal(a.réponse,'boundary');assert.equal(a.ticketSortant,null);assert.equal(b.appel,'resume');assert.equal(a.sequence,b.sequence);
assert.equal(b.réponse,'action');assert.equal(b.ticketSortant,start.pre.ticket);assert.equal(b.commande,'ACTION4');
const perCore=Object.values(cases).reduce((sum,r)=>sum+r.steps.length,0);
console.log(JSON.stringify({versions,départsCommunsParSHA:Object.keys(cases).length,gestesCommunsParSHA:perCore,
  catalogue:{sha:'8ce7ee3563fa1d5eca1639c6ad03975cfc962460',gestes:16},appelsSupplémentaires:{révisions:[versions[0],versions[2]],départsParSHA:2,gestesParSHA:31,dialogue:resume.appels},
  arêteDatée:witness,questionsAtteignables:3,premiersÉcarts:checks},null,2));
