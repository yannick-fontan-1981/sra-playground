import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { digest } from '../frontiere-22-23/observation.mjs';
import { digest as nativeDigest } from '../../../src/logos-engine/canonical.ts';
import { git,versions,withEngine } from '../moteur-reference.mjs';
import { play,readCard } from './operateur.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'},source:{type:'string'},cas:{type:'string'}}});
const vendor=resolve(values.pyodide), fixtures=['catalogue','lecture','coupe','reprise','horloge'];
if(values.cas) {
  assert.ok(fixtures.includes(values.cas));
  const card=await readCard(new URL('public/'+values.cas+'.json',import.meta.url));
  await writeFile(values.recu,JSON.stringify(await play(values.source,card,vendor)));
} else {
  await verify();
}
function receipt(s) {
  const p=s.pre;
  return {n:s.n,level:p.level,frame:p.frame,ref:p.ref,ticket:p.ticket,global:p.global,family:p.family,strategy:p.strategy,
    kind:p.kind,cmd:p.cmd,index:p.index,guard:p.guard,actions:p.actions,expected:p.expected,question:p.question,
    need:p.need,accessNeed:p.accessNeed,after:s.after};
}
function samePrefix(a,b,len,label) {
  assert.ok(a.steps.length>=len && b.steps.length>=len,label);
  for(let t=0;t<len;t++) assert.equal(digest(receipt(a.steps[t])),digest(receipt(b.steps[t])),label+' / '+(t+1));
}
async function checkAccess(run,capacity) {
  const s=run.steps[15],p=s.pre,f=p.frontiere,prior=run.steps[11];
  assert.equal(p.level,3);
  assert.equal(p.global,'observed_frontier');
  assert.equal(p.family,p.global);
  assert.equal(p.kind,'access');
  assert.equal(p.strategy,'reach_open_input');
  assert.equal(p.cmd,'ACTION4');
  assert.equal(p.guard,true);
  assert.equal(p.index,0);
  assert.equal(p.retourBranche.capacity,capacity);
  assert.equal(p.retourBranche.offer,null);
  assert.equal(f.pre.routeStatus,'found');
  assert.equal(f.pre.local,null);
  assert.deepEqual(f.pre.domain.map(d=>[d.command.action_ref,d.tried.length]),[['ACTION3',1],['ACTION4',1]]);
  assert.equal(f.pre.path.length,1);
  assert.equal(f.pre.path[0].source,f.pre.index);
  assert.equal(f.pre.path[0].target,f.pre.remote.context);
  assert.equal(f.pre.path[0].action.action_ref,'ACTION4');
  assert.deepEqual(f.pre.remote.action,{action_ref:'ACTION3'});
  assert.equal(prior.pre.frame,p.frame);
  assert.equal(prior.pre.cmd,'ACTION4');
  assert.equal(prior.after.ref.split(':').at(-1),p.expected);
  const transition='transition:'+await nativeDigest([prior.pre.ref,{action_ref:prior.pre.cmd},prior.after.ref]);
  assert.deepEqual(f.pre.path[0].witnesses,[transition]);
  assert.equal(f.prediction.strategy,p.strategy);
  assert.equal(f.prediction.familyPrediction,'indéterminée');
  assert.equal(f.prediction.command.action_ref,p.cmd);
  assert.equal(f.prediction.question,p.question);
  assert.equal(f.seal,digest(f.pre));
  assert.equal(s.after.matched,true);
  assert.equal(s.after.family,p.family);
  assert.ok(s.after.ref.endsWith(p.expected));
  assert.equal(s.after.completed,2);
}
async function verify() {
  const dir=await mkdtemp(join(tmpdir(),'regn22-verif-')),out=join(dir,'jeu.json'), runs={};
  const matrix={historique:['catalogue','lecture','horloge'],gel:fixtures,candidat:['catalogue','lecture','reprise']};
  try {
    for(const [v,cases] of Object.entries(matrix)) {
      runs[v]={};
      await withEngine(v,async source=>{
        for(const name of cases) {
          execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--source',source,'--pyodide',vendor,'--cas',name,'--recu',out],
            {stdio:['ignore','ignore','inherit']});
          runs[v][name]=JSON.parse(await readFile(out,'utf8'));
        }
      });
    }
    const b=runs.gel;
    for(const [v,set] of Object.entries(runs)) {
      await checkAccess(set.catalogue,1);
      const neg=set.lecture.steps[15];
      samePrefix(set.catalogue,set.lecture,15,v+' seule borne');
      assert.equal(neg.pre.retourBranche.capacity,16);
      assert.equal(neg.pre.retourBranche.offer.actions.length,4);
      assert.equal(neg.pre.retourBranche.offer.scope.access_steps,3);
      assert.deepEqual(neg.pre.retourBranche.episode,set.catalogue.steps[15].pre.retourBranche.episode);
      assert.equal(neg.pre.ref,set.catalogue.steps[15].pre.ref);
      assert.equal(neg.pre.family,'returned_branch_contrast');
      assert.equal(neg.pre.global,neg.pre.family);
      assert.equal(neg.pre.frontiere,null);
      assert.ok(!neg.pre.visites.includes('observed_frontier'));
      assert.equal(neg.after.matched,true);
      assert.equal(neg.pre.cmd,set.catalogue.steps[15].pre.cmd);
      assert.equal(neg.after.ref,set.catalogue.steps[15].after.ref);
      assert.equal(set.catalogue.stop.raison,'session_action_budget');
      if(set.reprise) {
        await checkAccess(set.reprise,2);
        const [access,probe]=set.reprise.steps.slice(15);
        assert.deepEqual(access.pre.actions.map(a=>a.action_ref),['ACTION4','ACTION3']);
        assert.equal(access.after.seal,false);
        assert.equal(probe.pre.index,1);
        assert.equal(probe.pre.cmd,'ACTION3');
        assert.equal(probe.pre.ref,access.after.ref);
        assert.equal(probe.pre.question,access.pre.frontiere.pre.remote.ref);
        assert.equal(probe.pre.need,access.pre.need);
        assert.equal(probe.after.outcome.need,access.pre.need);
        assert.equal(probe.after.outcome.objective,probe.pre.question);
        assert.equal(probe.after.outcome.status,'observed');
        assert.equal(probe.after.matched,null);
        assert.equal(probe.after.seal,true);
      }
    }
    for(const set of Object.values(runs)) for(const [n,run] of Object.entries(set)){
      if(n!=='horloge') samePrefix(run,b[n],run.steps.length,n+' / parité');
    }
    samePrefix(b.coupe,b.catalogue,15,'seule coupure de lecture');
    assert.equal(b.coupe.stop.prochain,'boundary');
    for(const v of ['historique','gel']) samePrefix(runs[v].horloge,runs[v].catalogue,16,v+' horloge du planificateur');
    const fixtureFile=join(dir,'fixture.json');
    execFileSync(process.execPath,[fileURLToPath(new URL('../frontiere-22-23/qualifier.mjs',import.meta.url)),'--recu',fixtureFile]);
    const fixture=JSON.parse(await readFile(fixtureFile,'utf8')).fixture;
    assert.equal(git('diff',versions.gel,'HEAD','--','src'),'');
    const code='02032a3d50ba15d7d0d7ff1c74d01165ad7e31f2';
    assert.equal(git('diff',code,'HEAD','--','experiments/sic-agenda-offres/frontiere-22-23'),'');
    const report={versions:{...versions,candidat:git('rev-parse','HEAD'),parent80:git('rev-parse','6bfb8ccf'),attendus:git('rev-parse','176f054a'),
      publicationInventaire:git('rev-parse','2a17e14b'),fixture:code},matrice:matrix,
      prefixeCommun:digest(b.catalogue.steps.slice(0,15).map(receipt)),fixtureParite:fixture.parity,
      coupe15:b.coupe.stop,avecBudget16:b.catalogue.steps[15],lectureSeule:b.lecture.steps[15],
      reprise17:b.reprise.steps.slice(15),finBudget16:b.catalogue.stop,finBudget17:b.reprise.stop,
      selectionsReprise:b.reprise.steps.filter(s=>s.pre.strategy==='reach_open_input'&&s.pre.index===0).map(s=>s.n),
      continuationsReprise:b.reprise.steps.filter(s=>s.pre.strategy==='reach_open_input'&&s.pre.index>0).map(s=>s.n)};
    if(values.recu) await writeFile(values.recu,JSON.stringify(report,null,2)+'\n');
    console.log('REGN/22 · 11 parcours, plus la fixture historique. Même préfixe de 15 décisions.');
    console.log('Au geste 16 : budget global 16, reach_open_input ; limite de lecture seule, returned_branch_contrast. ACTION4 et retour identiques.');
    console.log('Budget 17 : une sélection au 16, une continuation au 17, question distante observée. Horloges fixe et native vérifiées.');
  } finally {await rm(dir,{recursive:true,force:true});}
}
