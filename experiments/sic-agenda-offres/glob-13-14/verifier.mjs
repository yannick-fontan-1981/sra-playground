import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { digest,play,readCard } from './operateur.mjs';
import { git,versions,withEngine } from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'},source:{type:'string'},cas:{type:'string'}}});
const vendor=resolve(values.pyodide);
const cases=['nominal','image-finale','deplace','commande','reference','inertie','cible','placement','acces','dependance'];
if(values.cas) {
  assert.ok(cases.includes(values.cas));
  const card=await readCard(new URL('public/'+values.cas+'.json',import.meta.url));
  await writeFile(values.recu,JSON.stringify(await play(values.source,card,vendor)));
} else {
  await verify();
}
const cmd=s=>[s.pre.cmd,s.pre.data];
const pairs=e=>Object.values(e.samples).reduce((count,group)=>count+group.length,0);
function parity(a,b,length,label) {
  assert.ok(a.length>=length&&b.length>=length,label);
  for(let i=0;i<length;i++) assert.equal(digest(a[i]),digest(b[i]),label+' geste '+(i+1));
}
function firstQuestion(s,control) {
  const [first,placed,question]=s;
  assert.equal(first.pre.cmd,control);
  assert.equal(first.pre.ref.split(':').at(-1),first.after.ref.split(':').at(-1));
  assert.equal(placed.after.record.events[0].kind,'placement_changed_with_unchanged_word');
  const p=question.pre, pre=p.selected.pre;
  assert.equal(p.family,'fixed_origin');
  assert.equal(p.kind,'fixed_origin_dependency');
  assert.equal(p.cmd,control);
  assert.equal(p.guard,true);
  assert.equal(p.index,0);
  assert.deepEqual(pre.inert,[control]);
  assert.equal(pre.pending.ref,p.ref);
  assert.equal(pre.pending.frame,pre.frame);
  assert.deepEqual(p.refs,[placed.pre.ref,placed.after.ref]);
  assert.equal(pre.pending.node,13);
  assert.deepEqual(p.expected,{status:'unknown'});
  assert.equal(question.after.matched,null);
  assert.equal(question.after.seal,true);
  const execution=question.after.record.events[0];
  assert.equal(execution.kind,'fixed_program_public_execution');
  assert.equal(execution.before,p.ref);
  assert.equal(execution.after,question.after.ref);
  return execution;
}
function access(s,origin,target,point) {
  const p=s.pre, d=p.selected.origins;
  assert.equal(p.kind,'fixed_program_origin_access');
  assert.equal(p.family,'fixed_origin');
  assert.equal(p.guard,true);
  assert.equal(p.index,0);
  assert.equal(p.origin,origin);
  assert.deepEqual(cmd(s),['ACTION6',point]);
  assert.equal(p.target,target);
  assert.equal(p.models,8);
  assert.equal(p.solver,'COMPLETE');
  assert.deepEqual(d.safe,[String(origin)]);
  assert.equal(d.domain.length,29);
  assert.deepEqual(d.eligible.map(e=>[e.origin,e.command.data]),[[origin,point]]);
  assert.equal(p.trace.length,12);
  assert.equal(p.trace.at(-1),String(target));
  assert.equal(p.selected.pre.executions[0].after,p.ref);
  assert.ok(p.refs.includes(p.ref));
}
function canonical(s) {
  return {geste:s.i,ref:s.pre.ref,ticket:s.pre.ticket,famille:s.pre.family,type:s.pre.kind,commande:cmd(s),indice:s.pre.index,
    garde:s.pre.guard,question:s.pre.question,origine:s.pre.origin,cible:s.pre.target,apres:s.after.ref,accord:s.after.matched,
    scelle:s.after.seal,niveaux:s.after.completed};
}
async function verify() {
  const temp=await mkdtemp(join(tmpdir(),'glob-verif-')),out=join(temp,'jeu.json'),runs={};
  try {
    for(const v of ['historique','gel','candidat']) {
      runs[v]={};
      await withEngine(v,async engine=>{
        for(const f of v==='historique'?['nominal']:cases) {
          execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--source',engine,'--cas',f,'--pyodide',vendor,'--recu',out],
            {stdio:['ignore','ignore','inherit']});
          runs[v][f]=JSON.parse(await readFile(out,'utf8')).steps;
        }
      });
    }
    const b=runs.gel,c=runs.candidat,nom=c.nominal,mod=c.deplace,alias=c.commande,changed=c.cible;
    assert.deepEqual(runs.historique.nominal.map(canonical),nom.map(canonical));
    for(const f of cases.filter(f=>f!=='dependance')) {
      assert.equal(b[f].length,c[f].length,f);
      parity(b[f],c[f],b[f].length,f);
    }
    for(const [prefix,control] of [[nom,'ACTION5'],[mod,'ACTION5'],[alias,'ACTION4']]){
      const e=firstQuestion(prefix,control);
      assert.equal(pairs(e),12);
      assert.equal(prefix[2].after.rawFrames,66);
      assert.equal(prefix[2].after.shownFrames,66);
      assert.equal(prefix[3].after.matched,true);
      assert.equal(prefix[3].after.seal,false);
      assert.equal(prefix[4].pre.index,1);
      assert.equal(prefix[4].pre.cmd,control);
      assert.equal(prefix[4].pre.guard,true);
      assert.equal(prefix[4].after.completed,1);
      assert.equal(prefix[4].after.matched,null);
    }
    access(nom[3],10,23,{x:31,y:12}); access(mod[3],10,23,{x:31,y:13}); access(alias[3],10,23,{x:31,y:12});
    assert.deepEqual(nom[3].pre.trace,mod[3].pre.trace);
    assert.deepEqual(mod[3].pre.selected.pre.scene.nodes,nom[3].pre.selected.pre.scene.nodes.map(([l,t,r,b])=>[l,t+1,r,b+1]));
    assert.deepEqual(mod[3].pre.selected.pre.scene.word,nom[3].pre.selected.pre.scene.word);
    assert.deepEqual(mod[2].after.record.events[0].samples,nom[2].after.record.events[0].samples);
    assert.deepEqual(changed[2].after.record.events[0].samples,nom[2].after.record.events[0].samples);
    access(changed[3],11,24,{x:37,y:12});
    const thin=c['image-finale'],thinExecution=firstQuestion(thin,'ACTION5');
    assert.equal(thin[2].after.ref,nom[2].after.ref);
    assert.equal(thin[2].after.shownFrames,1);
    assert.equal(thin[2].after.rawFrames,66);
    assert.equal(pairs(thinExecution),1);
    assert.equal(thin[3].pre.selected.offer,null);
    assert.equal(thin[3].pre.family,'observed_frontier');
    assert.deepEqual(b.dependance.map(canonical),nom.slice(0,4).map(canonical));
    for(const name of ['reference','inertie','dependance']){
      parity(c[name],nom,2,name+' avant intervention');
      assert.equal(c[name][2].pre.ref,nom[2].pre.ref);
      assert.equal(c[name][2].pre.selected.offer,null);
      assert.equal(c[name][2].pre.family,'observed_frontier');
      assert.deepEqual(cmd(c[name][2]),['ACTION6',{x:10,y:17}]);
    }
    assert.notEqual(c.reference[2].pre.selected.pre.pending.ref,c.reference[2].pre.ref);
    assert.deepEqual(c.inertie[2].pre.selected.pre.inert,[]);
    parity(c.acces,nom,3,'retrait du raccord historique de 14');
    assert.equal(c.acces[3].pre.selected.offer,null);
    assert.equal(c.acces[3].pre.family,'observed_frontier');
    assert.equal(c.acces[4].pre.kind,'fixed_program_origin_access');
    const failed=c.placement;
    parity(failed,nom,3,'placement avant retour modifié');
    assert.deepEqual(failed[3].pre,nom[3].pre);
    assert.equal(failed[3].after.matched,false);
    assert.equal(failed[3].after.seal,true);
    assert.equal(failed[4].pre.index,0);
    assert.equal(failed[4].pre.cmd,'ACTION6');
    assert.equal(failed[4].after.completed,0);
    const report={versions:{...versions,candidat:git('rev-parse','HEAD'),attendus:git('rev-parse','a958fd3f')},
      ligne13:{temoin:canonical(nom[2]),avant:nom[2].pre.selected.pre,acquisition:nom[2].after.record.events[0],
        renommage:canonical(alias[2]),referenceEtrangere:canonical(c.reference[2]),sansInertie:canonical(c.inertie[2]),
        retraitOffreGel:canonical(b.dependance[2]),retraitOffreCandidat:canonical(c.dependance[2])},
      ligne14:{temoin:canonical(nom[3]),offres:nom[3].pre.selected.origins,trace:nom[3].pre.trace,suite:canonical(nom[4]),
        imageFinale:{acquisition:thinExecution,suite:canonical(thin[3])},translation:canonical(mod[3]),cibleModifiee:canonical(changed[3]),
        retraitAcces:c.acces.slice(3).map(canonical),placementAbsent:failed.slice(3).map(canonical)},
      parite:Object.fromEntries(cases.filter(f=>f!=='dependance').map(f=>[f,digest(c[f])]))};
    if(values.recu) await writeFile(values.recu,JSON.stringify(report,null,2)+'\n');
    console.log('GLOB · 21 préfixes. Ligne 13 : ACTION5 (ACTION4 après renommage), 12 transitions observées. Retrait de son offre sur candidat.');
    console.log('Ligne 14 : origine 10 vers 23, origine 11 vers 24. Huit modèles compatibles. Image finale seule : autre famille.');
    console.log('Placement non vu : le lancement est annulé et la famille peut reproposer le placement. Translation +1 vérifiée.');
  } finally {await rm(temp,{recursive:true,force:true});}
}
