import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {digest} from './operateur.mjs';
import {git,versions,withEngine} from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}}), vendor=resolve(values.pyodide);
const worker=fileURLToPath(new URL('operateur.mjs',import.meta.url)),variants=['nominal','sans-exemple','sans-voisin'];
const tmp=await mkdtemp(join(tmpdir(),'memo-56-')),out=join(tmp,'run.json');
const click=(x,y)=>['ACTION6',{x,y}];
const modelKey=({relation,comparison})=>'plural_antecedent:'+relation+':'+comparison;
async function replay(version,modes){
  const result={};
  await withEngine(version, async engine=>{
    for(const v of modes){
      execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',v,'--recu',out],
        {stdio:['ignore','ignore','inherit']});
      result[v]=JSON.parse(await readFile(out,'utf8'));
      for(const s of result[v].steps)if(s.issued.cut)assert.equal(s.issued.cut.seal,digest(s.issued.cut.pre));
    }
  });
  return result;
}
const recap=s=>({turn:s.i,ref:s.issued.ref,ticket:s.issued.ticket,family:s.issued.family,command:s.issued.command,after:s.after});
try{
  const h=await replay('historique',['nominal']),g=await replay('gel',variants);
  assert.deepEqual(h.nominal,g.nominal);
  const nominal=g.nominal.steps,missing=g['sans-exemple'],neutral=g['sans-voisin'].steps;
  assert.equal(nominal.length,8);
  assert.equal(neutral.length,8);
  assert.equal(missing.steps.length,7);
  assert.deepEqual(nominal.slice(0,6),missing.steps.slice(0,6));
  assert.deepEqual(nominal.slice(0,6),neutral.slice(0,6));
  for(const s of nominal.slice(0,6)){
    assert.equal(s.issued.cut.authorizes.reason,'test_observed_enclosing_emphasis');
    assert.equal(s.issued.entry,'observed_occurrence_recall');
    assert.equal(s.after.memory[0].mode,'forward');
  }

  const [before,t7,t8]=nominal.slice(5),cut=t7.issued.cut,current=cut.pre.current,prior=cut.pre.prior,offer=cut.authorizes;
  assert.equal(t7.issued.entry,'observed_occurrence_recall');
  assert.equal(t7.issued.guard,'public_occurrence_bound');
  assert.equal(t7.issued.admitted,true);
  assert.deepEqual(t7.issued.command,click(15,35));
  assert.equal(offer.reason,'test_retained_occurrence_correspondence');
  assert.equal(current.occurrences.length,3);
  assert.ok(current.occurrences.every(o=>!o.marked));
  assert.equal(prior.example,before.issued.ref);
  assert.equal(before.after.ref,t7.issued.ref);
  assert.deepEqual(before.after.memory[0].consolidated,prior);
  assert.deepEqual(offer.refs,[t7.issued.ref,before.issued.ref]);
  const matching=prior.previous.occurrences.filter(o=>o.shape===offer.selected.shape && o.color===offer.selected.color);
  assert.equal(matching.length,1);
  assert.deepEqual(matching[0].point,[46,41]);
  assert.notEqual(matching[0].id,prior.chosen);
  assert.deepEqual(offer.support,[
    'plural_antecedent:previous_all:exact_mask_and_color','plural_antecedent:previous_all:exact_mask',
    'plural_antecedent:previous_unchosen:exact_mask_and_color','plural_antecedent:previous_unchosen:exact_mask',
  ]);
  for(const key of offer.support){
    const learned=cut.pre.models.find(m=>m.key===key);
    assert.equal(learned.count,4);
    assert.equal(learned.evidence.length,4);
    assert.deepEqual(learned.counterexamples,[]);
    assert.deepEqual(cut.comparisons.find(c=>modelKey(c)===key).candidates,[offer.selected.id]);
  }
  assert.deepEqual([t7.after.matched,t7.after.seal,t7.after.memory[0].mode],[null,true,'forward']);
  assert.deepEqual(t7.after.memory[0].evidence,[t7.issued.ref,t7.after.ref]);
  assert.equal(t8.issued.entry,'observed_occurrence_recall');
  assert.deepEqual(t8.issued.command,click(14,28));
  assert.equal(t8.issued.cut.authorizes.reason,'test_retained_occurrence_correspondence');
  assert.equal(t8.after.memory[0].mode,'forward');
  assert.equal(t8.issued.cut.pre.prior.example,t7.issued.ref);

  const deprived=missing.steps[6],loss=deprived.issued.cut;
  assert.deepEqual(loss.pre,cut.pre);
  assert.deepEqual(loss.removed,matching[0]);
  assert.equal(loss.authorizes,null);
  for(const key of offer.support)assert.deepEqual(loss.comparisons.find(c=>modelKey(c)===key).candidates,[]);
  assert.equal(deprived.issued.family,'animated_contact');
  assert.deepEqual(deprived.issued.command,click(37,13));
  assert.equal(deprived.after.memory,null);
  assert.equal(missing.stop,'frontier_unknown');

  const control=neutral[6],{removed,...unfiltered}=control.issued.cut;
  assert.deepEqual(removed.point,[14,37]);
  assert.notEqual(removed.shape,offer.selected.shape);
  assert.deepEqual({...unfiltered,removed:null},cut);
  assert.deepEqual({...control,issued:{...control.issued,cut}},t7);
  assert.deepEqual(neutral[7],t8);

  assert.equal(git('rev-parse','HEAD:src'),git('rev-parse','d0e7527c:src'));
  const receipt={versions:{...versions,qualification:git('rev-parse','HEAD'),attendus:git('rev-parse','f9037da6'),spor:'2aad6e6c'},
    avantReprise:recap(before),rappel:t7,suite:t8,retrait:deprived,arret:missing.stop,
    controle:control,parite:digest(nominal),prefixes:4};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('MEMO · quatre préfixes. Rappel sur exemple exact T7, retrait sélectif et reprise T8 vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
