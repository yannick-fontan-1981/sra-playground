import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const read=v=>JSON.parse(readFileSync(join(dir,v+'.json'),'utf8')).runs;
const [base,candidate]=['base','candidat'].map(read);
const arms=['nominal','première','seconde','deux'];
assert.deepEqual(base.map(r=>r.arm),arms);
assert.deepEqual(candidate.map(r=>r.arm),arms);
const pack=r=>({arm:r.arm,budgets:r.budgets,rows:r.rows,preparations:r.preparations,acquisitions:r.acquisitions});
assert.deepEqual(base.map(pack),candidate.map(pack));
const [nominal,première,seconde,deux]=candidate;
const ticket=(r,n)=>r.rows[n-1],cut=r=>r.preparations[0],context=r=>r.comparisons.find(c=>c.observationRef===cut(r).view);
const comparables=({observation,level})=>[observation,level];
for(const r of candidate){
  assert.equal(r.budgets.maxActions,16);
  assert.equal(r.rows.length,7);
  assert.deepEqual(r.rows.slice(0,5),nominal.rows.slice(0,5));
  assert.deepEqual(comparables(ticket(r,6)),comparables(ticket(nominal,6)));
  assert.equal(ticket(r,6).level,2);
  assert.equal(cut(r).frame,'fb4c841eea2f859a');
  assert.deepEqual([cut(r).known,cut(r).actions,cut(r).questions],[cut(nominal).known,cut(nominal).actions,cut(nominal).questions]);
}
const [first,second]=cut(nominal).questions;
assert.deepEqual(candidate.map(r=>cut(r).suppressed),[[],[first],[second],[first,second]]);
const listed=offers=>offers?.map(o=>[o.action,o.cost,o.applicability,o.result]);
const same=context(nominal).offers;
assert.deepEqual(listed(same),[['ACTION1',1,'applicable','selected'],['ACTION4',1,'applicable','lower_priority']]);
assert.deepEqual(same[0].evidence,same[1].evidence);
assert.deepEqual(listed(context(première).offers),[['ACTION4',1,'applicable','selected']]);
assert.deepEqual(listed(context(seconde).offers),[['ACTION1',1,'applicable','selected']]);
assert.deepEqual(context(première).offers[0].evidence,same[1].evidence);
assert.deepEqual(context(seconde).offers[0].evidence,same[0].evidence);
assert.equal(context(deux),undefined);
assert.deepEqual(nominal.rows,seconde.rows);
const extracted=r=>r.acquisitions.find(e=>e.return===ticket(r,6).returned.ref);
const n6=ticket(nominal,6),p6=ticket(première,6),p7=ticket(première,7);
assert.deepEqual([n6.q.command,n6.changed,extracted(nominal).after.ACTION1,ticket(nominal,7).q.command],['ACTION1',80,[-1,0],'ACTION4']);
assert.deepEqual([p6.q.command,p6.changed,extracted(première).after.ACTION4],['ACTION4',82,[0,1]]);
assert.equal(extracted(première).after.ACTION1,undefined);
assert.equal(p6.q.guard,n6.q.guard);
assert.equal(p6.returned.family,'sliding_cavity');
assert.deepEqual([p7.q.command,p7.q.kind,p7.returned.matched,p7.returned.reason],
  ['ACTION2','sliding_cavity_access',true,'compare_frozen_slide_endpoint_and_static_support']);
const d6=ticket(deux,6);
assert.deepEqual([d6.q.command,d6.q.owner,d6.returned.family,ticket(deux,7).q.command],
  ['ACTION2','observed_frontier','observed_frontier','ACTION1']);
assert.deepEqual(extracted(deux).before,extracted(deux).after);
const summarize=r=>{
 const t6=ticket(r,6),t7=ticket(r,7);
 return {départ:r.arm,t6:{commande:t6.q.command,auteur:t6.q.owner,retour:t6.returned,pixels:t6.changed,paquet:t6.after},
  t7:{commande:t7.q.command,suite:t7.q.kind,retour:t7.returned},nouvelleDirection:r.arm==='deux'?null:extracted(r).after[t6.q.command]};
};
console.log(JSON.stringify({sha:{base:'162e45506cd9196171c15cb2402cf2ca1ee4266d',candidat:'3047ef55a7a06d4560a07d36dfaf08719c50c802'},
  stats:{departsParSha:4,gestesParSha:28},preuvesÉgales:true,dir:same.map(o=>[o.action,o.cost,o.result]),résultats:candidate.map(summarize)},null,2));
