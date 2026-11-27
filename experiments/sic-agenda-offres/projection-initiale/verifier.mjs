import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { evidence } from './preuves.mjs';
import { inquire,root } from './enquete.mjs';
import { trace } from './trajet.mjs';
import { gel,pinned,run } from '../revision-96/moteurs.mjs';
import { sha } from '../revision-96/sonde.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
if(!values.pyodide) throw Error('Indiquer --pyodide');
const temp=await mkdtemp(join(tmpdir(),'sic-calibrage-')), output=join(temp,'parcours.json');
const dev=['direct','reposition','contraire','contraire-reposition'];
const controls=['historique','reposition','palette','chaine-etrangere'];
function local(path){return fileURLToPath(new URL(path,import.meta.url));}
async function play(name,engine,producer='public/') {
  run(process.execPath,[local('operateur.mjs'),'--source',engine,'--fiche',local(producer+name+'.json'),
    '--pyodide',resolve(values.pyodide),'--recu',output]);
  return JSON.parse(await readFile(output,'utf8'));
}
function result(row) {
  const t5=row.steps[4],t12=row.steps[11],t13=row.steps[12];
  return {gestes:row.steps.length,fin:row.completed,arret:row.stop,choix5:t5?.cmd ?? null,apres5:t5?.after.matched ?? null,
    accord12:t12?.after.matched ?? null,choix13:t13?.cmd ?? null,accord13:t13?.after.matched ?? null,
    verdictBesoin96:row.steps.at(-1)?.after.need?.status ?? null,recherche:row.choice5[0],proposition:row.choice5[1] ?? null};
}
function verifyNewAccess(row) {
  assert.deepEqual(row.steps.slice(0,4).map(r=>r.cmd),['ACTION1','ACTION4','ACTION3','ACTION2']);
  const [search,offer]=row.choice5;
  assert.equal(search.nodes,282);
  assert.equal(search.count,1);
  assert.deepEqual(search.bounds,[]);
  assert.equal(search.goals[0].projection,false);
  assert.equal(search.goals[0].observed,false);
  assert.equal(search.goals[0].trial.status,'compatible_unordered');
  assert.deepEqual(offer.trial,search.goals[0].trial);
  assert.equal(offer.ref,row.steps[3].after.ref);
  assert.equal(offer.action.action_ref,'ACTION1');
  assert.equal(row.steps[4].cmd,'ACTION1');
  assert.equal(row.steps[4].guard.admitted,true);
  assert.equal(row.steps[4].after.matched,true);
  assert.equal(row.steps[11].after.matched,false);
  assert.equal(row.steps[11].after.seal,true);
}
function verifyRecovery(row,negative,alternate) {
  if (negative) {
    assert.equal(row.steps.length,12);
    assert.equal(row.completed,0);
    assert.equal(row.stop,'frontier_unknown');
    return;
  }
  const first=row.steps[12];
  assert.equal(first.cmd,alternate?'ACTION1':'ACTION3');
  assert.equal(first.strategy,alternate?'reposition_root_before_contact':'revise_rooted_contact');
  assert.equal(first.guard.admitted,true);
  assert.equal(first.after.matched,true);
  assert.deepEqual(first.expected,first.after.physical);
  for(const r of row.steps.slice(12,-1)) {
    assert.equal(r.after.matched,true);
    assert.deepEqual(r.after.need,{id:first.need,status:'assigned'});
  }
  assert.equal(row.steps.length,alternate?21:19);
  assert.equal(row.completed,1);
  assert.equal(row.steps.at(-1).after.matched,null);
  assert.deepEqual(row.steps.at(-1).after.need,{id:first.need,status:'satisfied'});
}
try {
  const geometry=await evidence();
  const report={candidat:run('git',['rev-parse','HEAD']).trim(),gel,parent:'08fa10a6b9986e7028551fbfc9d9e16eb83726b7',
    operateur:'5804fc7d73c6b7655d97bca777aed9fb6475acef',geometrie:geometry,developpement:{},controles96:{}};
  await pinned(gel,async frozen=>{
    // Reconstruire le premier écart dans le noyau du gel, séparément du choix du service.
    const bad=await inquire([9,14],frozen),path=geometry.palettes[0].trajet;
    assert.deepEqual(bad.search.exhausted_bound_refs,['bound.max_nodes']);
    assert.equal(bad.search.expanded_node_count,1000);
    assert.equal(bad.search.plans.length,0);
    assert.equal(bad.proposal.reason,'rooted_contact_plan_unresolved');
    const simulation=await trace(bad,path,frozen);
    assert.equal(simulation.at(-1).matched,false);
    report.planAvant={raison:bad.proposal.reason,etats:bad.search.expanded_node_count,ouverts:bad.search.open_frontier_count,
      bornes:bad.search.exhausted_bound_refs,dernieresStations:simulation.at(-1).contacts};

    for(const n of dev) {
      const before=await play(n,frozen),after=await play(n,root);
      assert.equal(before.steps.length,4);
      assert.equal(before.stop,'frontier_unknown');
      assert.deepEqual(before.steps,after.steps.slice(0,4));
      assert.deepEqual(before.knowledge,after.knowledge);
      assert.equal(after.knowledge.data.previous,null);
      assert.deepEqual(after.knowledge.data.evidence,[]);
      assert.equal(before.choice5[0].nodes,1000);
      verifyNewAccess(after);
      verifyRecovery(after,n.startsWith('contraire'),n.includes('reposition'));
      report.developpement[n]={gel:result(before),candidat:result(after),avant5:after.knowledge.seal};
    }
    for(const n of controls) {
      const before=await play(n,frozen,'../revision-96/public/'),after=await play(n,root,'../revision-96/public/');
      verifyNewAccess(after);
      verifyRecovery(after,n==='chaine-etrangere',n==='reposition');
      assert.equal(before.choice5[0].goals[0].projection,true);
      assert.equal(before.choice5[0].goals[0].trial,null);
      assert.deepEqual(after.steps,before.steps);
      assert.equal(after.stop,before.stop);
      report.controles96[n]={parcours:sha(after.steps),gestes:after.steps.length,fin:after.completed,
        arret:after.stop,ordreAvant:before.choice5[0].goals[0].projection,ordreApres:after.choice5[0].goals[0].trial.status};
    }
  });
  if(values.recu) await writeFile(values.recu,JSON.stringify(report,null,2)+'\n');
  console.log('SK48 après calibrage · quatre préfixes identiques jusqu’au retour 4. ACTION1 admise au geste 5 avec ordre indéterminé.');
  console.log('9↔14 : progression aux gestes 19 et 21 sous les deux priorités. Les deux retours étrangers suspendent au 12.');
  console.log('Quatre témoins de 96 conservés ; renommage opaque, inversion stricte, égalité et comparaison V5 par défaut vérifiés.');
} finally {await rm(temp,{recursive:true,force:true});}
