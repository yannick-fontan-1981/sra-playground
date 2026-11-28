import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','860835b1b77ae9cde489230be5c1f83c05237302'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.cases;
}
const both=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
assert.deepEqual(both[0],both[1]);
const c=both[0],cat=c.catalogue.rows,n=c.prolongé.rows,a=c.sansHistorique.rows,reduced=c.retourRéduit.rows;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].ret;
const event=(rows,i)=>rows.flatMap(row=>row.ret?.events??[]).find(e=>e.ref===r(rows,i).ref);
for(const {rows} of Object.values(c))for(let i=0;i<rows.length-1;i++){
  const p=rows[i].ticket,x=rows[i+1].ret;
  assert.ok(p.admitted);assert.equal(p.id,x.ticket);assert.equal(p.owner,x.owner);
  assert.deepEqual([p.owner,p.kind],['feedback_sequences','public_feedback_sequence']);
  if(rows[i+1].ticket)assert.equal(rows[i+1].ticket.ref,x.ref);
}
assert.deepEqual([cat.length,n.length,a.length,reduced.length],[17,18,14,9]);
for(let i=1;i<=16;i++){
  const {events:ce,...cr}=r(cat,i),{events:ne,...nr}=r(n,i);
  assert.deepEqual(t(cat,i),t(n,i));assert.deepEqual(cr,nr);assert.deepEqual(event(cat,i),event(n,i));
}
const initial=t(n,1);
assert.deepEqual([initial.mode,initial.value,initial.data,initial.prévu,initial.choix.trial],['ADD',8,{x:4,y:54},null,[8]]);
assert.deepEqual([event(n,1).status,event(n,1).value,event(n,1).repeatable],['observed_append',8,false]);
assert.deepEqual(t(n,2).préfixe,[8]);assert.equal(t(n,2).value,14);assert.deepEqual(t(n,2).data,initial.data);
assert.ok(t(n,2).refs.includes(r(n,1).ref));

const exploratory=[8,14,9],selected=[8,9,14];
const returned=event(n,4);
assert.deepEqual([t(n,4).mode,returned.status,returned.values,returned.marks.length,returned.before,returned.ref],
  ['CONTROL_WHEN_FULL','observed_submission_feedback',exploratory,3,t(n,4).ref,r(n,4).ref]);
const nominal=t(n,5),alternative=t(a,5);
assert.deepEqual([nominal.choix.trial,nominal.choix.candidate_count,nominal.choix.law_alternatives],[selected,2,4]);
assert.deepEqual([alternative.choix.trial,alternative.choix.candidate_count,alternative.choix.law_alternatives],[exploratory,9,1]);
assert.deepEqual(a.slice(0,4),n.slice(0,4));
assert.equal(nominal.ref,alternative.ref);assert.deepEqual(nominal.data,alternative.data);assert.equal(nominal.value,alternative.value);
assert.deepEqual([t(n,6).data,t(n,6).value],[{x:10,y:54},9]);
assert.deepEqual([t(a,6).data,t(a,6).value],[{x:4,y:54},14]);
assert.deepEqual([t(n,6).préfixe,t(a,6).préfixe],[[8],[8]]);
assert.ok(nominal.refs.includes(r(n,4).ref));
assert.deepEqual(c.sansHistorique.interventions,[{tour:5,retirés:[r(n,4).ref]}]);

const realAlternative=event(a,8);
assert.deepEqual([realAlternative.status,realAlternative.matchs,realAlternative.proof],['feedback_ambiguous',2,r(a,8).ref]);
assert.equal(a[8].score,0);assert.deepEqual(t(a,9).choix.trial,selected);
assert.ok(t(a,9).refs.includes(r(n,4).ref));
assert.equal(a[12].score,1);
function binding(claim,ticket,ret){
  return claim.symbol===ticket.value && claim.ref===ret.ref && JSON.stringify(claim.sequence)===JSON.stringify(ticket.choix.trial);
}
assert.ok(binding({symbol:14,sequence:exploratory,ref:r(a,6).ref},t(a,6),r(a,6)));
assert.ok(!binding({symbol:14,sequence:selected,ref:r(a,6).ref},t(a,6),r(a,6)));

assert.deepEqual([n[8].score,r(n,8).reason,n[16].score,r(n,16).reason],[1,'official_boundary',2,'official_boundary']);
assert.deepEqual([t(n,9).choix.recalled_entry.source_epoch,t(n,9).choix.recalled_entry.submit_evidence,event(n,9).revalidated],
  [1,r(n,4).ref,'active_rank_row_confirmed']);
assert.deepEqual(event(n,12).values,[8,14,6]);
assert.deepEqual([t(n,13).choix.trial,t(n,13).choix.candidate_count,t(n,13).choix.law_alternatives],[ [14,6,8],4,12]);
assert.ok(t(n,13).refs.includes(r(n,12).ref));
assert.equal(t(n,17).choix.recalled_entry.source_epoch,2);

const shown=r(reduced,8),original=r(a,8);
assert.deepEqual(reduced.slice(0,7),a.slice(0,7));assert.deepEqual(t(reduced,8),t(a,8));
assert.deepEqual(shown.réel,original.réel);assert.equal(shown.finale,original.finale);
const {eligible,kept}=shown.variation;
if(kept===null){assert.equal(eligible.length,0);assert.deepEqual(shown.servi,[shown.finale]);}
else{assert.ok(eligible.includes(kept));assert.deepEqual(shown.servi,original.réel.map((h,k)=>k===kept?h:shown.finale));}
assert.deepEqual(event(reduced,8),realAlternative);assert.deepEqual(t(reduced,9).choix.trial,selected);
const stats=shas.map(sha=>{
  const tests=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(tests,/pass 2\b/);assert.match(tests,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((s,x)=>s+x.rows.length-1,0),testsAuteur:2};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:16,
  historique:{soumission:returned.values,réutilisation:nominal.choix.trial,premierClic:nominal.data,secondClic:t(n,6).data,scoreT8:n[8].score},
  variante:{séquence:alternative.choix.trial,secondClic:t(a,6).data,ambiguïté:realAlternative.matchs,scoreT8:a[8].score,scoreT12:a[12].score},
  N2:{entrée:t(n,9).choix.recalled_entry.source_epoch,proposition:t(n,13).choix.trial,scoreT16:n[16].score},
  réserve:{imagesRéelles:shown.réel.length,imagesServies:shown.servi.length,intérieures:eligible.length,ambiguïté:event(reduced,8).matchs}},null,2));
