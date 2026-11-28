import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { digest,play,readCard } from './operateur.mjs';
import { git,versions,withEngine } from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'},source:{type:'string'},cas:{type:'string'}}});
const vendor=resolve(values.pyodide);
const names=['historique','sans-retour','sans-questions','inversion','passif'];
if(values.cas) {
  assert.ok(names.includes(values.cas));
  const card=await readCard(new URL('public/'+values.cas+'.json',import.meta.url));
  await writeFile(values.recu,JSON.stringify(await play(values.source,card,vendor)));
} else {
  await qualify();
}
function physical(row) {
  const {offer,...native}=row.pre;
  return {pre:native,after:row.after};
}
function witness(rows,at,length) {
  const s=rows[at], episode=s.pre.offer.before.episode, focus=s.pre.focus;
  assert.equal(s.pre.family,'returned_branch_contrast');
  assert.equal(s.pre.global,s.pre.family);
  assert.equal(s.pre.kind,'access');
  assert.equal(s.pre.frontier,undefined);
  assert.equal(s.pre.guard,true);
  assert.equal(focus.access_steps,length);
  assert.equal(focus.return_ref,s.pre.ref);
  assert.equal(episode.at(-1)[2].frame,episode[0][0].frame);
  const q=s.pre.offer.domains.at(-1).offered;
  assert.equal(q.length,1);
  assert.deepEqual(q[0].cmd,{action_ref:'ACTION4'});
  assert.equal(s.pre.question.question,q[0].question);
  assert.equal(s.pre.question.refs.length,length+1);
  assert.equal(s.pre.edges.length,length);
  for(let i=0;i<length;i++) {
    const access=rows[at+i];
    assert.equal(access.pre.cmd,'ACTION3');
    assert.equal(access.after.matched,true);
    assert.ok(access.after.ref.endsWith(access.pre.expected));
    assert.equal(access.after.seal,false);
  }
  const probe=rows[at+length];
  assert.equal(probe.pre.cmd,'ACTION4');
  assert.equal(probe.pre.guard,true);
  assert.equal(probe.pre.expected,null);
  assert.equal(probe.after.matched,null);
  assert.equal(probe.after.seal,true);
  assert.equal(probe.after.completed,s.pre.level);
  assert.equal(rows[at+length+1].pre.level,s.pre.level+1);
}
async function qualify() {
  const tmp=await mkdtemp(join(tmpdir(),'regn-verif-')),file=join(tmp,'result.json'),runs={};
  try {
    for(const label of ['historique','gel','candidat']) {
      runs[label]={};
      await withEngine(label,async engine=>{
        for(const n of label==='historique'?['historique']:names) {
          execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--source',engine,'--pyodide',vendor,
            '--cas',n,'--recu',file],{stdio:['ignore','ignore','inherit']});
          runs[label][n]=JSON.parse(await readFile(file,'utf8')).steps;
        }
      });
    }
    const b=runs.gel,c=runs.candidat,s=c.historique;
    assert.equal(git('diff','d0e7527c','HEAD','--','src'),'');
    assert.equal(digest(runs.historique.historique),digest(s));
    for(const n of names) assert.equal(digest(b[n]),digest(c[n]),n);
    assert.equal(digest(c.passif.map(physical)),digest(s.map(physical)));
    witness(s,2,1); witness(s,7,2);
    for(const n of ['sans-retour','sans-questions','inversion']) {
      const path=c[n];
      assert.deepEqual(path.slice(0,2),s.slice(0,2));
      assert.equal(path[2].pre.ref,s[2].pre.ref);
      if(n==='inversion'){assert.deepEqual(path,s.slice(0,path.length));continue;}
      assert.equal(path[2].pre.offer.decision,null);
      assert.equal(path[2].pre.family,'observed_frontier');
      assert.equal(path[2].pre.frontier,'test_local_input');
      assert.equal(path[2].pre.cmd,'ACTION4');
      assert.equal(path[2].after.matched,null);
      assert.equal(path[2].after.completed,0);
      assert.equal(path[4].pre.family,'returned_branch_contrast');
      assert.equal(path[4].pre.cmd,'ACTION4');
      assert.equal(path[4].after.matched,true);
    }
    assert.equal(c['sans-retour'][2].pre.offer.before.used.length,1);
    assert.deepEqual(c['sans-questions'][2].pre.offer.domains.at(-1).offered,[]);
    const report={versions:{...versions,candidat:git('rev-parse','HEAD'),attendus:git('rev-parse','37eb151c')},
      a3:s.slice(2,4),a8:s.slice(7,10),sansRetour:c['sans-retour'].slice(2,5),sansQuestions:c['sans-questions'][2],
      empreintes:Object.fromEntries(names.map(n=>[n,digest(c[n])]))};
    if(values.recu) await writeFile(values.recu,JSON.stringify(report,null,2)+'\n');
    console.log('REGN/80 · 11 parcours sur trois révisions. Accès confirmé au 3, question ACTION4 au 4 et niveau franchi.');
    console.log('Second accès à deux transitions au 8. Retirer le dernier retour ou la question donne un essai local au 3.');
  } finally {await rm(tmp,{recursive:true,force:true});}
}
