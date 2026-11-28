import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {digest} from '../rejouer-service.mjs';
import {git,versions,withEngine} from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'weav-proof-')),out=join(tmp,'prefixe.json');
const modes=['nominal','ancienne-reference','journal-altere','journal-intact','sans-paire','sans-recu','epoque'];
const fallback=['information_goal',['ACTION6',{x:28,y:61}]],good=['public_occurrence_recall',['ACTION1',{}]];
const choice=p=>[p.family,p.command];
const physical=({i,pre:p,after:a})=>[i,p.ref,p.level,p.kind,p.family,p.slot,p.bundle,p.command,p.guard,p.refs,p.plan,
  a.ref,a.matched,a.seal,a.reason,a.levels,a.packet];
const publicInput=p=>[p.ref,p.epoch,p.available,p.raster];
async function replay(engine,mode){
  execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',mode,'--recu',out],
    {stdio:['ignore','ignore','inherit']});
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut].filter(Boolean))assert.equal(digest(cut.pre),cut.seal);
  return r;
}

try{
  const gel=await withEngine('gel',async engine=>({nominal:await replay(engine,'nominal'),wrong:await replay(engine,'ancienne-reference')}));
  const candidate=await withEngine('candidat',async engine=>{
    const cases={};
    for(const mode of modes)cases[mode]=await replay(engine,mode);
    return cases;
  });
  const n=candidate.nominal.steps,o=gel.nominal.steps,w=gel.wrong.steps,step=n[6],cut=step.pre.cut.pre;
  assert.equal(n.length,16);
  assert.deepEqual(n.map(physical),o.map(physical));
  assert.equal(n[1].after.record.witness,null);
  assert.equal(n[3].after.record.witness,null);
  const crossing=n[4].after.record;
  assert.equal(crossing.comparison.reference_property_matched,true);
  assert.equal(crossing.witness,crossing.pairDigest);
  assert.match(crossing.witness,/^[0-9a-f]{64}$/);
  assert.deepEqual(crossing.pair.evidence,[n[4].pre.ref,n[4].after.ref]);
  assert.deepEqual(crossing.pair.inputs,{'0':'ACTION1','1':'ACTION3'});
  assert.equal(crossing.pair.owner,0);
  assert.deepEqual(step.pre.plan.pair,crossing.pair);
  assert.deepEqual(step.pre.plan.cell,[1,0]);
  assert.deepEqual(choice(step.pre),good);
  assert.equal(step.after.matched,true);
  assert.ok(step.pre.refs.includes(n[4].pre.ref));
  assert.deepEqual(cut.used.receipts,[{after:n[4].after.ref,digest:crossing.witness,comparison:crossing.comparison}]);
  assert.equal(cut.attestation,true);

  assert.deepEqual(w.slice(0,6),o.slice(0,6));
  assert.deepEqual(choice(w[6].pre),good);
  assert.deepEqual(w[6].pre.plan.pair.evidence,[o[1].after.ref,o[4].after.ref]);
  assert.equal(w[6].after.packet,o[6].after.packet);
  assert.equal(w[6].pre.cut.pre.attestation,false);

  const ready=candidate['journal-intact'].steps;
  assert.deepEqual(ready,n.slice(0,7));
  for(const k of ['ancienne-reference','journal-altere','sans-paire','sans-recu']){
    const r=candidate[k].steps,p=r[6].pre,used=p.cut.pre;
    assert.deepEqual(r.slice(0,6),n.slice(0,6));
    assert.deepEqual(publicInput(cut),publicInput(used));
    assert.deepEqual(choice(p),fallback);
    assert.equal(p.plan,null);
    assert.deepEqual(used.before,cut.before);
    assert.deepEqual(used.used.past,cut.used.past);
    assert.deepEqual(used.used.axisInputs,cut.used.axisInputs);
    assert.deepEqual(used.used.progress,cut.used.progress);
    assert.deepEqual(used.used.receipts,k==='sans-recu'?[]:cut.used.receipts);
    const wrong={...crossing.pair,evidence:[n[1].after.ref,n[4].after.ref]};
    const expected=k==='sans-recu'?[crossing.pair]:k==='sans-paire'?[]:[wrong];
    assert.deepEqual(used.used.pairs,expected);
  }

  const continuation=candidate.epoque.steps;
  const afterBoundary=continuation.find(s=>s.pre.level===2&&s.pre.cut);
  assert.ok(afterBoundary,'The bounded run must reach the measured second level');
  assert.deepEqual(afterBoundary.pre.cut.pre.used.pairs.find(pair=>pair.evidence[1]===crossing.evidence),crossing.pair);
  assert.ok(afterBoundary.pre.cut.pre.used.receipts.some(receipt=>receipt.digest===crossing.witness));
  assert.ok(afterBoundary.after.record);
  await writeFile(values.recu,JSON.stringify({versions:{gel:versions.gel,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},
    firstDifference:7,afterBoundary:afterBoundary.i,
    firstSecondEpochUse:continuation.find(s=>s.pre.level===2&&s.pre.plan?.pair?.epoch===1)?.i??null,gel,candidate},null,2)+'\n');
  console.log('WEAV 43 · provenance du croisement vérifiée avant et après réhydratation du journal.');
}finally{await rm(tmp,{recursive:true,force:true});}
