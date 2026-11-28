import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','915e0601e3aad82653733ac602909bef2286343d'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const recall='public_occurrence_recall',frontier='observed_frontier',view='catalogue_view_experiment',site='occluded_catalogue_experiment';
const response='catalogue_response',field='catalogue_field_input_observed';
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.cases;
}
const runs=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
assert.deepEqual(runs[0],runs[1]);
const c=runs[0],nom=c.nominal.rows;
const t=(rows,tour)=>rows[tour-1].ticket,r=(rows,tour)=>rows[tour].ret;
const event=(rows,tour,kind)=>r(rows,tour).événements.find(e=>e.kind===kind);
const choice=t=>[t.owner,t.kind,t.cmd,t.data];
for(const {rows} of Object.values(c))for(let i=0;i<rows.length-1;i++){
  const before=rows[i].ticket, after=rows[i+1].ret;
  assert.equal(after.id,before.id);assert.equal(after.owner,before.owner);assert.ok(before.admis);
  for(const e of after.événements)assert.deepEqual(e.evidence,[before.ref,after.ref]);
}
const turns=kind=>nom.slice(0,-1).filter(x=>x.ticket.kind===kind).map(r=>r.tour);
assert.deepEqual(turns(site),[2,3,5,7,8,10,12,13,16]);
assert.deepEqual(turns(view),[4,15]);
const difference={};
for(const [level,access,submit,select,change,chosen,candidates,available] of [
  [1,1,2,3,4,0,[0,1,2],[2]],[3,11,12,13,15,3,[0,1,2,3],[0]]
]){
  const answer=t(nom,submit),trial=event(nom,submit,response),origin=event(nom,access,field);
  assert.equal(nom[submit-1].niveau,level);
  assert.deepEqual([answer.owner,answer.kind,answer.sub,answer.mode,answer.palette,answer.candidat,answer.fonds,answer.attendu],
    [recall,site,'occluded_catalogue_composition','answer',8,chosen,[5],null]);
  assert.equal(trial.key,answer.key);assert.equal(trial.official,false);assert.equal(r(nom,submit).accord,null);
  assert.deepEqual([t(nom,select).mode,t(nom,select).palette,r(nom,select).accord],['select',9,true]);
  const move=t(nom,change);
  assert.deepEqual(choice(move),[recall,view,'ACTION3',{}]);
  assert.deepEqual(move.preuve,origin.evidence);assert.deepEqual(move.candidats,candidates);
  assert.ok(!move.preuve.includes(trial.evidence[1]));
  assert.deepEqual([origin.command,origin.changed,origin.structure],['ACTION3',true,true]);
  assert.deepEqual([r(nom,change).accord,r(nom,change).motif],[null,'field_changed_requires_catalogue_recomparison']);
  assert.deepEqual(event(nom,change,'catalogue_observation').candidates,available);
  difference[level]={soumission:answer.data,candidat:chosen,sourceAccès:origin.evidence,
    pixelsSoumission:r(nom,submit).pixelsJeu,pixelsAccès:r(nom,change).pixelsJeu,candidatsAprèsAccès:available};
}
assert.deepEqual(t(nom,2).data,{x:11,y:53});
assert.deepEqual(t(nom,12).data,{x:54,y:53});
assert.deepEqual([r(nom,2).pixelsJeu,r(nom,4).pixelsJeu,r(nom,12).pixelsJeu,r(nom,15).pixelsJeu],[63,39,53,57]);
for(const [name,tour] of [['sansSoumission54',3],['sansAccès40',4],['sansLienDirect54',4],['accèsPériméN3',15]]){
  const check=c[name];assert.deepEqual(check.rows.slice(0,tour-1),nom.slice(0,tour-1));
  assert.equal(t(check.rows,tour).ref,t(nom,tour).ref);
  assert.equal(check.interventions.length,1);assert.equal(check.interventions[0].tour,tour);
}
const repeat=c.sansSoumission54, off=c.sansAccès40, independent=c.sansLienDirect54, stale=c.accèsPériméN3;
assert.deepEqual(repeat.interventions[0].removed,[event(nom,2,response)]);
assert.deepEqual(choice(t(repeat.rows,3)),choice(t(nom,2)));
assert.equal(t(repeat.rows,3).mode,'answer');assert.equal(r(repeat.rows,3).pixelsJeu,0);
assert.equal(r(repeat.rows,3).motif,'catalogue_submission_without_local_correctness_claim');
assert.deepEqual(off.interventions[0].removed,[event(nom,1,field)]);
assert.deepEqual(choice(t(off.rows,4)),[frontier,'experiment','ACTION4',{}]);
assert.equal(r(off.rows,4).pixelsJeu,50);
assert.deepEqual([event(off.rows,4,field).command,event(off.rows,4,field).changed],['ACTION4',true]);
assert.deepEqual(independent.interventions[0].removed.map(e=>e.kind),['catalogue_observation',response]);
assert.equal(independent.interventions[0].same,true);
assert.deepEqual(t(independent.rows,4),t(nom,4));
assert.deepEqual(stale.interventions[0].removed,[event(nom,11,field)]);
assert.ok(stale.interventions[0].oldWitness);
assert.deepEqual(choice(t(stale.rows,15)),[frontier,'experiment','ACTION4',{}]);
assert.notEqual(r(stale.rows,15).jeu,r(nom,15).jeu);
assert.equal(r(stale.rows,15).pixelsJeu,39);
assert.equal(event(stale.rows,15,field).command,'ACTION4');
assert.deepEqual(choice(t(stale.rows,16)),choice(t(nom,16)));

const half=c.partiel54.rows,frozen=c.stationnaire40.rows;
assert.deepEqual(t(half,2),t(nom,2));assert.deepEqual(t(frozen,4),t(nom,4));
assert.equal(r(half,2).jeu,r(nom,2).jeu);assert.equal(r(frozen,4).jeu,r(nom,4).jeu);
assert.equal(r(half,2).pixelsServis,31);
const partialResponse=event(half,2,response);
assert.deepEqual([partialResponse.key,partialResponse.palette,partialResponse.mode],[t(nom,2).key,8,'answer']);
assert.deepEqual(choice(t(half,3)),[frontier,'experiment','ACTION4',{}]);
assert.equal(r(frozen,4).pixelsServis,0);
assert.deepEqual([event(frozen,4,field).command,event(frozen,4,field).changed],['ACTION3',false]);
assert.equal(r(frozen,4).motif,'field_change_unconfirmed');
assert.deepEqual(choice(t(frozen,5)),[frontier,'experiment','ACTION4',{}]);
function validates(receipt,ticket,ret){
  return receipt.evidence[0]===ticket.ref && receipt.evidence[1]===ret.ref;
}
for(const [tour,kind,foreign] of [[2,response,1],[4,field,2],[15,field,4]]){
  const correct=event(nom,tour,kind);
  assert.ok(validates(correct,t(nom,tour),r(nom,tour)));
  assert.ok(!validates({...correct,evidence:[correct.evidence[0],r(nom,foreign).ref]},t(nom,tour),r(nom,tour)));
}
const stats=shas.map(sha=>{
  const author=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(author,/pass 4\b/);assert.match(author,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((s,x)=>s+x.rows.length-1,0),testsAuteur:4};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),nominal:{54:turns(site),40:turns(view),situations:difference},
  retrait:{soumissionT3:choice(t(repeat.rows,3)),accèsT4:choice(t(off.rows,4)),accèsPériméT15:choice(t(stale.rows,15))},
  indépendance40:independent.interventions[0].same,
  réserve:{partiel54:{pixels:r(half,2).pixelsServis,suite:choice(t(half,3))},stationnaire40:{pixels:0,suite:choice(t(frozen,5))}},
  reçusAltérésRejetés:3},null,2));
