import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readCard } from './fiche.mjs';
import { digest,play } from './parcours.mjs';
import { inspect } from './variations.mjs';
import { git,withEngine,versions } from './moteurs.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'},source:{type:'string'},cas:{type:'string'}}});
if (!values.pyodide) throw Error('Chemin Pyodide requis.');
const vendor=resolve(values.pyodide);
const files=['historique','autre-sonde','preimage','autre-canal','palette','budget','ordre-initial'];
if (values.cas) {
  assert.ok(files.includes(values.cas));
  const card=await readCard(new URL('public/'+values.cas+'.json',import.meta.url));
  const report=await play(card,vendor,values.source,card.variations?inspect:null);
  await writeFile(values.recu,JSON.stringify(report));
} else {
  await qualify();
}

function native(row) {
  const {offers,variations,...receipt}=row;
  return receipt;
}
function samePath(left,right,label) {
  assert.equal(left.length,right.length,label);
  left.forEach((row,i)=>assert.equal(digest(native(row)),digest(native(right[i])),label+' · geste '+(i+1)));
}
function onReturn(step,kind,delta) {
  assert.equal(step.guard,true);
  const event=step.after.events.find(e=>e.kind===kind);
  assert.ok(event);
  assert.equal(event.before,step.pre.ref);
  assert.equal(event.after,step.after.ref);
  assert.deepEqual(event.delta,delta);
}
function checkNominal(run) {
  const [first,second,third,,,sixth,seventh,eighth]=run.steps;
  assert.deepEqual([first.level,second.level,seventh.level],[1,1,3]);
  assert.equal(first.command,second.command);
  assert.equal(first.command,'ACTION3');
  assert.equal(first.pre.probe,true);
  assert.equal(first.pre.expected,null);
  assert.deepEqual(first.pre.laws.individual,{});
  assert.deepEqual(first.pre.refs,[first.pre.ref]);
  assert.deepEqual(first.pre.scene.periods,[8,8]);
  assert.deepEqual(first.variations.returns.map(r=>[r.cmd.action_ref,r.acquired]),[['ACTION3',false],['ACTION4',false]]);
  assert.equal(first.variations.afterExhaustion,null);
  assert.deepEqual(first.variations.refs,[]);
  assert.deepEqual(first.variations.ambiguous,{periods:[8,8],focus:null,offer:null});
  onReturn(first,'individual_phase_displacement',[-1,0]);
  assert.equal(first.after.matched,null);
  assert.equal(first.after.seal,true);
  assert.equal(second.pre.ref,first.after.ref);
  assert.deepEqual(second.pre.laws.individual,{ACTION3:-1});
  assert.ok(second.pre.refs.includes(first.after.ref));
  assert.equal(second.pre.probe,false);
  assert.ok(second.pre.expected);
  assert.equal(second.pre.domain.assignment_count,64);
  assert.equal(second.pre.domain.target_refs.length,11);
  assert.equal(second.after.matched,null);
  assert.equal(second.after.reason,'official_boundary');
  assert.equal(second.after.completed,1);
  assert.equal(third.pre.mode,'joint_phase_target');
  assert.equal(third.pre.scene.detectors.length,2);
  const local=second.variations;
  assert.equal(local.noLaw.cmd.action_ref,'ACTION3');
  assert.equal(local.noLaw.probe,true);
  assert.equal(local.reverseAtOne.kind,'periodic_sum_channel_question');
  assert.equal(local.actualAtOne.kind,'periodic_sum_joint_phase_target');
  assert.equal(local.retainedPreimages,10);
  assert.equal(local.alternate.cmd.action_ref,'ACTION6');
  assert.equal(sixth.after.completed,2);
  assert.equal(seventh.pre.mode,'channel_question');
  assert.equal(seventh.pre.probe,true);
  assert.equal(seventh.pre.expected,null);
  assert.deepEqual(seventh.pre.scene.periods,[10,12]);
  assert.equal(seventh.pre.domain.assignment_count,120);
  assert.equal(seventh.pre.domain.target_refs.length,3);
  assert.deepEqual(seventh.data,{x:48,y:3});
  onReturn(seventh,'joint_phase_displacement',[-1,-3]);
  assert.equal(seventh.after.matched,null);
  assert.equal(eighth.pre.ref,seventh.after.ref);
  assert.ok(eighth.pre.refs.includes(seventh.after.ref));
  assert.equal(eighth.pre.mode,'joint_phase_target');
  assert.equal(eighth.pre.probe,false);
  assert.deepEqual(eighth.data,seventh.data);
  assert.equal(eighth.after.matched,true);
  const channel=seventh.variations;
  for(const r of [channel.other,channel.complete,channel.stableNext]) assert.deepEqual(r.cmd.data,{x:57,y:3});
  assert.deepEqual(channel.partial.cmd.data,seventh.data);
  assert.deepEqual(channel.afterNoChange,[]);
  assert.deepEqual(channel.learned,{});
  assert.equal(channel.ambiguousOffset,null);
  assert.equal(channel.otherPeriodBootstrap.kind,'periodic_sum_initial_control_question');
  assert.equal(channel.largerBudget.probe,false);
}
function summary(row) {
  return {geste:row.turn,niveau:row.level,famille:row.family,mode:row.pre.mode,cmd:row.command,point:row.data,
    sonde:row.pre.probe,garde:row.guard,before:row.pre.ref,after:row.after.ref,retour:row.after.reason,accord:row.after.matched,
    evenements:row.after.events?.map(e=>({kind:e.kind,delta:e.delta})),sceau:row.seal};
}
async function qualify() {
  const tmp=await mkdtemp(join(tmpdir(),'sic-onde-verif-')), receipt=join(tmp,'parcours.json');
  const runs={};
  try {
    for(const name of ['historique','gel','candidat']) {
      runs[name]={};
      await withEngine(name,async engine=>{
        for(const file of name==='historique'?['historique']:files) {
          execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--source',engine,'--cas',file,
            '--pyodide',vendor,'--recu',receipt],{stdio:['ignore','ignore','inherit']});
          runs[name][file]=JSON.parse(await readFile(receipt,'utf8'));
        }
      });
    }
    const b=runs.gel,c=runs.candidat, old=runs.historique.historique;
    for(const r of [old,b.historique,c.historique,b.palette,c.palette]) checkNominal(r);
    const nominal=c.historique.steps;
    samePath(old.steps,nominal,'catalogue historique');
    const sameOnBoth=['historique','palette','preimage','budget','ordre-initial'];
    for(const f of sameOnBoth) samePath(b[f].steps,c[f].steps,'gel / candidat '+f);
    for(const [f,stop] of [['autre-sonde',3],['autre-canal',8]]) samePath(b[f].steps,nominal.slice(0,stop),'gel '+f);
    assert.deepEqual(c.palette.steps.map(r=>[r.command,r.data]),nominal.slice(0,8).map(r=>[r.command,r.data]));
    assert.notDeepEqual(c.palette.steps[6].pre.scene.colors,nominal[6].pre.scene.colors);
    assert.deepEqual(c.budget.steps.slice(0,6).map(r=>[r.command,r.data]),nominal.slice(0,6).map(r=>[r.command,r.data]));
    const wide=c.budget.steps[6];
    assert.equal(wide.pre.ref,nominal[6].pre.ref);
    assert.deepEqual(wide.pre.laws,nominal[6].pre.laws);
    assert.equal(nominal[6].pre.remaining,10);
    assert.equal(wide.pre.remaining,58);
    assert.equal(wide.pre.probe,false);
    assert.equal(wide.command,'ACTION3');
    const alternate28=c['autre-sonde'].steps, alternate27=c['autre-canal'].steps;
    assert.deepEqual(alternate28[0].offers,nominal[0].offers);
    samePath(b['ordre-initial'].steps,alternate28,'priorité déclarée / choix entre offres');
    assert.deepEqual(nominal[0].offers[0].map(o=>o.command.action_ref),['ACTION3','ACTION4']);
    assert.equal(alternate28[0].command,'ACTION4');
    onReturn(alternate28[0],'individual_phase_displacement',[1,0]);
    assert.equal(alternate28[1].pre.probe,false);
    assert.equal(alternate28[1].after.matched,true);
    samePath(alternate27.slice(0,6),nominal.slice(0,6),'préfixe avant substitution du canal');
    assert.deepEqual(alternate27[6].offers,nominal[6].offers);
    for(const row of [nominal[0],nominal[6]]) assert.ok(row.offers[0].every(o=>o.observationRef===row.pre.ref));
    assert.deepEqual(nominal[6].offers[0].map(o=>[o.kind,o.command.data?.x??null]),
      [['collective_channel',48],['collective_channel',57],['individual_channel',null]]);
    assert.deepEqual(alternate27[6].data,{x:57,y:3});
    onReturn(alternate27[6],'joint_phase_displacement',[1,3]);
    assert.equal(alternate27[7].family,'public_occurrence_recall');
    const filtered=c.preimage.steps;
    assert.deepEqual(filtered[0].command,nominal[0].command);
    assert.equal(filtered[1].pre.ref,nominal[1].pre.ref);
    assert.equal(filtered[1].projection.removed,true);
    assert.equal(filtered[1].projection.retained,10);
    assert.deepEqual(filtered[1].data,{x:4,y:32});
    onReturn(filtered[1],'strip_focus_changed',[0,0]);
    assert.equal(filtered[2].after.completed,1);
    const report={versions:{...versions,candidat:git('rev-parse','HEAD'),attendus:'592e8e1903fb32f30c3bf7fdfbedcbfee0d8c9e8'},
      seuils:{28:'focus + résidu + question neuve',29:'loi acquise + préimage et trajet borné',27:'pas de trajet dans la borne + loi incomplète'},
      temoins:Object.fromEntries([0,1,6,7].map(i=>[i+1,{...summary(nominal[i]),avant:nominal[i].pre,
        offres:nominal[i].offers,variations:nominal[i].variations}])),
      parite:Object.fromEntries(sameOnBoth.map(f=>[f,digest(c[f].steps.map(native))])),
      autres:{remplacer28:alternate28.slice(0,2).map(summary),remplacer27:alternate27.slice(6).map(summary),
        restreindre29:filtered.slice(1).map(summary),projection:filtered[1].projection,horizon:summary(wide)},
      decisions:{28:'ordre initial déclaré et consommé sur gel ; liste des offres admissibles substituable sur candidat',29:'domaine de préimages substitué et consommé sur gel et candidat',
        27:'offres de canal substituables sur candidat'}};
    if(values.recu) await writeFile(values.recu,JSON.stringify(report,null,2)+'\n');
    console.log('ONDE · 15 parcours. Ligne 28 : ACTION3 ou ACTION4 puis déplacement mesuré.');
    console.log('Ligne 29 : 11 préimages, retrait de [7,0] consommé sur le gel, changement de focus puis niveau terminé.');
    console.log('Ligne 27 : (48,3) ou (57,3), acquisitions opposées. À horizon élargi, ACTION3 est déjà exploitable.');
  } finally {await rm(tmp,{recursive:true,force:true});}
}
