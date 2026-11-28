import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { digest, play, readCard } from './operateur.mjs';
import { git, versions, withEngine } from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'},source:{type:'string'},cas:{type:'string'}}});
const vendor=resolve(values.pyodide), cases=['catalogue','couverture','retrait-acces','retrait-horloge','ecart-physique'];
const access='sliding_cavity_access', clock='clocked_cavity_access';
function decision(s){
  const {appel,...issued}=s.before;
  return {geste:s.geste,...issued,retour:s.after,pre:appel?.pre??null,offre:appel?.offre??null};
}
function compare(left,right,length) {
  assert.ok(left.length>=length && right.length>=length);
  for(let i=0;i<length;i++)assert.deepEqual(decision(left[i]),decision(right[i]),'geste '+(i+1));
}
function assertIssued(s,type,command,index){
  assert.equal(s.before.famille,'sliding_cavity');
  assert.equal(s.before.type,type);
  assert.equal(s.before.commande,command);
  assert.equal(s.before.indice,index);
  assert.equal(s.before.garde,true);
}
function ticket(s){
  return {geste:s.geste,niveau:s.before.niveau,ref:s.before.ref,famille:s.before.famille,type:s.before.type,
    ticket:s.before.ticket,indice:s.before.indice,commande:s.before.commande,garde:s.before.garde,
    position:s.before.position,arretPrevu:s.before.arretPrevu,branchesAvant:s.before.branches,retour:s.after};
}
function verify84(run) {
  const steps=run.catalogue.steps,first=steps[4],later=steps[7];
  const a=first.before.appel, b=later.before.appel;
  assertIssued(first,access,'ACTION2',0);
  assert.deepEqual(a.offre.positions,[[24,26],[24,38]]);
  assert.equal(a.offre.geometrie.route[0],'ACTION2');
  assert.equal(a.pre.sourcesDirections.ACTION2.apres,steps[1].after.ref);
  assert.deepEqual(a.pre.directions.ACTION2,[1,0]);
  assert.equal(a.pre.arrets[0],'observed_stop:'+steps[1].after.ref);
  assert.equal(a.variantes.sansDirection.ACTION2,null);
  assert.equal(a.variantes.sansDirection.ACTION3.type,access);
  assert.equal(a.variantes.sansArrets.type,access);
  assert.deepEqual([first.after.accord,first.after.scelle,first.after.niveaux],[null,true,1]);
  assert.equal(first.after.motif,'official_boundary');
  assert.deepEqual(steps.slice(5,7).map(s=>[s.before.type,s.before.commande,s.after.accord]),[
    ['cavity_direction_question','ACTION1',null],['cavity_direction_question','ACTION4',null]]);
  assertIssued(later,access,'ACTION1',0);
  assert.equal(b.pre.sourcesDirections.ACTION1.apres,steps[5].after.ref);
  assert.equal(b.pre.sourcesDirections.ACTION4.apres,steps[6].after.ref);
  assert.deepEqual(b.offre.actions,['ACTION1','ACTION4','ACTION2','ACTION3']);
  assert.deepEqual(b.variantes.sansDirection.ACTION4.actions,['ACTION4']);
  assert.equal(b.variantes.sansDirection.ACTION4.type,'cavity_direction_question');
  assert.equal(b.variantes.sansArrets,null);
  assert.equal(later.after.accord,true);
  assert.equal(steps[8].before.indice,1);
  assert.deepEqual(steps.filter(s=>s.before.type===access).map(s=>s.geste),[5,8,9,10,11,12,13]);
  return {temoin:ticket(first),acquis:a,secondContexte:ticket(later),acquisL2:b,
    suiteL2:steps.slice(8,11).map(ticket)};
}
function verify97(run) {
  const cap=run.catalogue.steps,open=run.couverture.steps,s=open[13],a=s.before.appel,b=cap[13].before.appel;
  assert.deepEqual(cap.slice(0,13).map(s=>[s.before.commande,s.after.paquetJeu]),open.slice(0,13).map(s=>[s.before.commande,s.after.paquetJeu]));
  assert.equal(open[13].before.ref,cap[13].before.ref);
  assert.notEqual(open[13].after.paquetJeu,cap[13].after.paquetJeu);
  const {restant,...pre}=a.pre,{restant:short,...preCap}=b.pre;
  assert.deepEqual(pre,preCap);
  assert.deepEqual([restant,short],[598,3]);
  assert.deepEqual(a.pre.phase.map(v=>[v.action,v.ref,v.position,v.delta,v.avantActeur]),[
    ['ACTION2',open[11].after.ref,[16,6],[4,0],true],
    ['ACTION3',open[12].after.ref,[20,6],[4,0],true]]);
  assert.equal(a.pre.phase[0].motif,a.pre.phase[1].motif);
  assert.deepEqual(a.offre.phase,a.pre.phase.map(x=>x.ref));
  assert.ok(a.offre.hypotheses.length>=2);
  for(const v of [a.variantes,b.variantes]){
    for(const n of [1,2,3,4,5])assert.equal(v.horizons[n],null);
    assert.equal(v.horizons[6].type,clock);
    for(const key of ['uneMesure','memeCommande','masqueDecale','sansOffreHorloge'])assert.equal(v[key],null);
  }
  assert.equal(a.variantes.sansDirection.ACTION1.type,'cavity_direction_question');
  assert.deepEqual(a.variantes.sansDirection.ACTION1.actions,['ACTION1']);
  assert.equal(b.offre,null);
  assert.equal(cap[13].before.famille,'observed_frontier');
  assert.equal(cap[13].before.commande,'ACTION2');
  assert.equal(cap.filter(s=>s.before.type===clock).length,0);
  const six=open.slice(13);
  assert.equal(six.length,6);
  for(const [i,s] of six.entries()){
    assertIssued(s,clock,['ACTION1','ACTION1','ACTION1','ACTION1','ACTION4','ACTION1'][i],i);
    assert.equal(s.after.accord,i<5);
    assert.equal(s.after.scelle,i===5);
    assert.equal(s.after.motif,'complete_forecast_board_comparison');
    assert.equal(s.after.niveaux,i===5?3:2);
    assert.equal(s.before.branches.some(k=>s.after.branches.includes(k)),s.after.accord);
  }
  assert.deepEqual(six.map(s=>s.after.branches),[[0,1],[0,1],[1],[1],[1],[]]);
  return {temoin:ticket(s),acquis:a,catalogue:ticket(cap[13]),preCatalogue:b.pre,suite:six.slice(1).map(ticket),
    paquetsCommuns13:digest(cap.slice(0,13).map(s=>s.after.paquetJeu))};
}
async function verify() {
  const runs={},tmp=await mkdtemp(join(tmpdir(),'as66-comparaison-')),out=join(tmp,'prefixe.json');
  try {
    for(const source of ['historique','gel','candidat']){
      runs[source]={};
      await withEngine(source,async engine=>{
        for(const name of source==='historique'?cases.slice(0,2):cases){
          execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--source',engine,'--cas',name,'--pyodide',vendor,'--recu',out],{stdio:['ignore','ignore','inherit']});
          const run=JSON.parse(await readFile(out,'utf8'));
          for(const s of run.steps)if(s.before.appel)assert.equal(digest(s.before.appel.pre),s.before.appel.seal);
          runs[source][name]=run;
        }
      });
    }
    const {historique:h,gel:g,candidat:c}=runs;
    for(const [name,n] of [['catalogue',16],['couverture',19]]){
      assert.equal(c[name].steps.length,n);
      assert.equal(g[name].steps.length,n);
      assert.equal(h[name].steps.length,n);
      compare(h[name].steps,g[name].steps,n);
      compare(g[name].steps,c[name].steps,n);
    }
    const line84=verify84(c),line97=verify97(c);
    verify84(g);verify97(g);
    const cOut=c['retrait-acces'].steps,gOut=g['retrait-acces'].steps;
    compare(gOut,g.catalogue.steps,6);
    compare(cOut,c.catalogue.steps,4);
    assert.equal(g.catalogue.steps[4].before.appel.variantes.sansOffreAcces,'raccord_absent');
    assert.equal(c.catalogue.steps[4].before.appel.variantes.sansOffreAcces,null);
    assert.deepEqual(cOut[4].before.appel.pre,c.catalogue.steps[4].before.appel.pre);
    assert.equal(cOut[4].before.appel.offre,null);
    assert.equal(cOut[4].before.famille,'observed_frontier');
    assert.equal(cOut[4].before.commande,'ACTION3');
    assertIssued(cOut[5],access,'ACTION2',0);
    for(const name of ['retrait-horloge','ecart-physique']){
      const variant=c[name].steps;
      compare(g[name].steps,variant,15);
      compare(c.couverture.steps,variant,13);
      assert.deepEqual(variant[13].before.appel.pre,c.couverture.steps[13].before.appel.pre);
      const t=variant[13];
      if(name==='retrait-horloge'){
        assert.equal(t.before.appel.offre,null);
        assert.deepEqual([t.before.famille,t.before.commande],['observed_frontier','ACTION2']);
      }else{
        assertIssued(t,clock,'ACTION1',0);
        assert.equal(t.after.paquetJeu,c.couverture.steps[13].after.paquetJeu);
        assert.notEqual(t.after.physique,t.after.presente);
        assert.deepEqual([t.after.accord,t.after.scelle,t.after.branches],[false,true,[]]);
      }
      assertIssued(variant[14],clock,'ACTION1',0);
    }
    const receipt={versions:{...versions,candidat:git('rev-parse','HEAD'),attendus:git('rev-parse','7651ad0e'),
      controleBanc:git('rev-parse','47ae8531')},parcours:12,
      ligne84:{...line84,retraitGel:ticket(gOut[4]),retraitCandidat:cOut.slice(4).map(ticket)},
      ligne97:{...line97,retrait:c['retrait-horloge'].steps.slice(13).map(ticket),retourModifie:c['ecart-physique'].steps.slice(13).map(ticket)},
      parite:Object.fromEntries(['catalogue','couverture'].map(f=>[f,digest(c[f].steps.map(decision))]))};
    if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
    console.log('AS66 · 12 préfixes vérifiés. 84 : sept tickets du catalogue, offre statique substituable sur candidat.');
    console.log('97 : six tickets horlogés sur gel et candidat, cinq projections confirmées. T19 : matched:false et troisième niveau terminé.');
  } finally {await rm(tmp,{recursive:true,force:true});}
}
if(values.cas){
  assert.ok(cases.includes(values.cas));
  const result=await play(values.source,await readCard(new URL('public/'+values.cas+'.json',import.meta.url)),vendor);
  await writeFile(values.recu,JSON.stringify(result));
}else{
  await verify();
}
