import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { digest } from './operateur.mjs';
import { git,versions,withEngine } from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide);
const nav='subset_scope_navigation',query='subset_scope_query',domain=[0,1,4,5],wide=[0,1,2,3,4,5,6,7],partial=[0,1,4,5,6,7];
const click=x=>['ACTION6',{x,y:3}];
function assertNavigation(s,x){
  const {pre,after}=s;
  assert.equal(pre.kind,nav);
  assert.equal(pre.family,'subset_diagnosis');
  assert.deepEqual(pre.command,click(x));
  assert.equal(pre.guard,true);
  assert.equal(pre.guardReason,'current_subset_control_and_exact_declared_question');
  assert.deepEqual(pre.subset.candidates,domain);
  assert.deepEqual(pre.subset.scope,domain);
  assert.equal(pre.subset.prediction,null);
  assert.equal(after.match,null);
  assert.equal(after.seal,true);
}
function focusResponse(s,focus){
  const r=s.after.record;
  assert.equal(r.kind,'scope_navigation_response');
  assert.equal(r.before,s.pre.ref);
  assert.equal(r.after,s.after.ref);
  assert.deepEqual(r.expected_focus,domain);
  assert.deepEqual(r.observed_focus,focus);
  assert.deepEqual(r.candidates_unchanged,domain);
  assert.equal(r.matched,false);
}
function resumedQuery(s){
  assert.equal(s.pre.kind,query);
  assert.deepEqual(s.pre.command,click(6));
  assert.deepEqual(s.pre.subset.focus,partial);
  assert.deepEqual(s.pre.subset.candidates,domain);
  assert.deepEqual(s.pre.offers.pre.offers,[]);
  assert.ok(s.pre.offers.pre.queryCount>0);
}
const tmp=await mkdtemp(join(tmpdir(),'dico86-')),out=join(tmp,'prefixe.json');
const prefixWorker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
async function playVersions(){
  const matrix={historique:['nominal'],gel:['nominal','stationnaire'],
    candidat:['nominal','stationnaire','autre-commande','permutation','retrait']};
  const results={};
  for(const [version,variants] of Object.entries(matrix)){
    results[version]={};
    await withEngine(version,async engine=>{
      for(const v of variants){
        execFileSync(process.execPath,[prefixWorker,'--source',engine,'--pyodide',vendor,'--variante',v,'--recu',out],
          {stdio:['ignore','ignore','inherit']});
        const run=JSON.parse(await readFile(out,'utf8'));
        const cuts=[...run.steps.map(s=>s.pre.offers),run.nextStationary?.offers].filter(Boolean);
        for(const cut of cuts)assert.equal(cut.seal,digest(cut.pre));
        results[version][v]=run;
      }
    });
  }
  return results;
}
try {
  const {historique,gel,candidat}=await playVersions();
  assert.deepEqual(historique.nominal,gel.nominal);
  assert.deepEqual(gel.nominal,candidat.nominal);
  assert.deepEqual(gel.stationnaire,candidat.stationnaire);
  assert.deepEqual(candidat.permutation,candidat.nominal);

  const [first,t2,t3,t4]=candidat.nominal.steps;
  const initial=t2.pre.offers.pre,later=t3.pre.offers.pre;
  assert.equal(first.after.record.kind,'public_subset_feedback');
  assert.equal(first.after.record.feedback,'GLOBAL');
  assert.deepEqual(first.after.record.candidates_before,wide);
  assert.deepEqual(first.after.record.candidates_after,domain);
  assertNavigation(t2,6);
  assert.deepEqual(initial.focus,wide);
  assert.equal(initial.queryCount,0);
  assert.equal(initial.remaining,15);
  assert.deepEqual(initial.evidence,[first.after.ref]);
  assert.deepEqual(initial.offers.map(o=>[o.scope,o.command.data.x,o.knownEffect]),[[domain,16,false],[domain,6,false]]);
  assert.equal(initial.offers[1].question,t2.pre.subset.question);
  assert.equal(t2.after.record.kind,'public_subset_feedback');
  assert.equal(t2.after.record.feedback,'GLOBAL');
  assert.deepEqual(t2.after.record.candidates_before,domain);
  assert.deepEqual(t2.after.record.candidates_after,domain);
  assert.equal(t2.after.count,14);
  assertNavigation(t3,16);
  assert.deepEqual(later.focus,wide);
  assert.equal(later.queryCount,0);
  assert.deepEqual(later.evidence,[first.after.ref,t2.after.ref]);
  assert.deepEqual(later.attempted,[]);
  assert.ok(later.pressShapes.some(shape=>shape[2]===initial.offers[1].shape[2]));
  assert.ok(!initial.pressShapes.some(shape=>shape[2]===initial.offers[1].shape[2]));
  assert.deepEqual(later.offers,[initial.offers[0]]);
  focusResponse(t3,partial);
  resumedQuery(t4);
  assert.ok(t4.pre.offers.pre.attempted.includes(t3.pre.subset.question));
  assert.deepEqual(candidat.nominal.staleChecks,[{admitted:false,reason:'subset_scope_changed'}]);

  const still=candidat.stationnaire,second=still.steps[1];
  assert.deepEqual(still.steps[0],first);
  assert.deepEqual(second.pre,t2.pre);
  assert.equal(second.after.gamePacket,t2.after.gamePacket);
  assert.notEqual(second.after.shownFrame,t2.after.shownFrame);
  focusResponse(second,wide);
  assert.deepEqual(still.nextStationary.command,click(16));
  assert.deepEqual(still.nextStationary.offers.pre.candidates,domain);
  assert.deepEqual(still.nextStationary.offers.pre.attempted,[t2.pre.subset.question]);
  assert.deepEqual(still.nextStationary.offers.pre.pressShapes,initial.pressShapes);
  assert.deepEqual(still.nextStationary.offers.pre.offers,[initial.offers[0]]);

  const [same1,other,next]=candidat['autre-commande'].steps;
  assert.deepEqual(same1,first);
  assert.deepEqual(other.pre.offers,t2.pre.offers);
  assertNavigation(other,16);
  assert.equal(other.pre.subset.question,t3.pre.subset.question);
  assert.notEqual(other.after.gamePacket,t2.after.gamePacket);
  focusResponse(other,partial);
  resumedQuery(next);

  const [original,withheld,resumed]=candidat.retrait.steps;
  assert.deepEqual(original,first);
  assert.deepEqual(withheld.pre.offers,t2.pre.offers);
  assert.equal(withheld.pre.family,'observed_frontier');
  assert.equal(withheld.pre.kind,'experiment');
  assert.deepEqual(withheld.pre.command,['ACTION6',{x:10,y:23}]);
  assertNavigation(resumed,6);

  const receipt={versions:{...versions,candidat:git('rev-parse','HEAD'),attendus:git('rev-parse','78a85c23')},
    verdict:{nominal:candidat.nominal,alternatif:candidat['autre-commande'],stationnaire:still,retrait:candidat.retrait},
    permutation:digest(candidat.permutation),pariteNominale:digest(candidat.nominal)};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('DICO 86 · huit préfixes natifs qualifiés. Permutation stable, substitution au service et reprise après les deux retours vérifiées.');
} finally { await rm(tmp,{recursive:true,force:true}); }
