import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','484f3f0d066b7c00a3e2ad68c983ad556be3a3ac'];
const access='sliding_cavity_access', clock='clocked_cavity_access';
const read=(sha,group)=>{
  const x=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));
  assert.equal(x.sha,sha);assert.equal(x.group,group);
  return x;
};
const runs=shas.map(sha=>{
  const [nominal,developer,reserve]=['nominal','développement','réserve'].map(g=>read(sha,g));
  return {...nominal.results,...developer.results,...reserve.results,eligible:reserve.eligible};
});
const golden=runs[0];
for(const r of runs) {
  for(const [name,run] of Object.entries(r)){
    if(name==='eligible')continue;
    if(name!=='sansAccès')assert.deepEqual(run,golden[name]);
    for(const [i,{geste,before,after}] of run.steps.entries()){
      assert.equal(geste,i+1);assert.ok(before.garde);
      assert.equal(after.ticket,before.ticket);assert.equal(after.famille,before.famille);
      const next=run.steps[i+1]?.before??(i===run.steps.length-1?run.choixSuivant:null);
      if(next)assert.equal(after.ref,next.ref);
    }
  }
}
const [cat,coverage]=[golden.catalogue.steps,golden.couverture.steps];
const bench=JSON.parse(execFileSync('git',['show',
  '47ae8531:docs/diagnostics/sic-as66-preparation-84-97/banc.json'],{encoding:'utf8'}));
for(const [name,steps,kind] of [['catalogue',cat,access],['couverture',coverage,clock]]){
  const expected=bench.arms[name],selected=steps.filter(s=>s.before.type===kind);
  assert.equal(steps.length,expected.actions);assert.equal(steps.at(-1).after.scorePhysique,expected.levels);
  assert.deepEqual(selected.map(s=>s.geste),expected.turns);
  assert.deepEqual(selected.map(s=>s.after.accord),expected.matches);
}
assert.equal(cat.length,16);assert.equal(coverage.length,19);
assert.equal(golden.catalogue.budgets.maxActions,16);assert.ok(!Object.hasOwn(golden.couverture.budgets,'maxActions'));
assert.ok(golden.couverture.budgets.levelActionCaps.every(n=>n===600));
assert.deepEqual(cat.slice(0,13).map(s=>s.after.paquetJeu),coverage.slice(0,13).map(s=>s.after.paquetJeu));
const entries=steps=>steps.filter(x=>x.before.type===access).map(x=>x.geste);
assert.deepEqual(entries(cat),[5,8,9,10,11,12,13]);
const a5=cat[4],a8=cat[7],a14=coverage[13];
const choice=b=>[b.famille,b.type,b.commande,b.indice];
assert.deepEqual(choice(a5.before),['sliding_cavity',access,'ACTION2',0]);
assert.deepEqual(a5.before.position,[24,26]);assert.deepEqual(a5.before.arretPrevu,[24,38]);
assert.ok(a5.before.appel.offre.geometrie.surface);
assert.deepEqual(a5.before.appel.pre.directions.ACTION2,[1,0]);
assert.equal(a5.before.appel.pre.sourcesDirections.ACTION2.apres,cat[1].after.ref);
assert.deepEqual([a5.after.accord,a5.after.motif,a5.after.scelle,a5.after.scorePhysique],[null,'official_boundary',true,1]);
assert.deepEqual(choice(a8.before),['sliding_cavity',access,'ACTION1',0]);
assert.deepEqual(a8.before.arretPrevu,[40,30]);assert.equal(a8.after.accord,true);
assert.equal(a8.before.appel.pre.sourcesDirections.ACTION1.apres,cat[5].after.ref);
assert.equal(a8.before.appel.pre.sourcesDirections.ACTION4.apres,cat[6].after.ref);

const a=runs[1].sansAccès.steps,b=golden.sansAccès.steps,d=golden.sansDirection.steps;
assert.deepEqual(b,cat.slice(0,6));
for(const s of [a,d]){
  assert.deepEqual(s.slice(0,4),cat.slice(0,4));assert.equal(s[4].before.ref,a5.before.ref);
  assert.notEqual(s[4].before.type,access);
}
assert.equal(a[4].before.commande,'ACTION3');assert.equal(a[5].before.type,access);
assert.deepEqual(a.map(s=>choice(s.before)),d.map(s=>choice(s.before)));
assert.equal(a[5].after.scorePhysique,1);assert.equal(d[5].after.scorePhysique,1);
assert.deepEqual(d[4].before.appel.pre.directions,a5.before.appel.pre.directions);
assert.ok(!Object.hasOwn(d[4].before.appel.pre.directionsServies,'ACTION2'));
const s84=golden.stationnaire84;
assert.deepEqual(s84.steps.slice(0,4),cat.slice(0,4));
assert.deepEqual(s84.steps[4].before,a5.before);
const alt84=s84.steps[4].after;
assert.equal(alt84.paquetJeu,a5.after.paquetJeu);
assert.equal(alt84.scorePhysique,1);assert.equal(alt84.niveaux,0);
assert.equal(alt84.presente,a5.before.image);assert.ok(alt84.scelle);
assert.equal(alt84.accord,false);
assert.deepEqual(choice(s84.choixSuivant),choice(a5.before));
assert.notEqual(s84.choixSuivant.ref,a5.before.ref);
const validatedProgress=receipt=>receipt.niveaux===alt84.niveaux && receipt.ref===alt84.ref && receipt.ticket===a5.before.ticket;
assert.ok(validatedProgress(alt84));assert.ok(!validatedProgress({...alt84,niveaux:1}));

const q=coverage.slice(13), phases=a14.before.appel.pre.phase;
assert.deepEqual(q.map(s=>s.before.commande),['ACTION1','ACTION1','ACTION1','ACTION1','ACTION4','ACTION1']);
assert.deepEqual(q.map(s=>s.before.indice),[0,1,2,3,4,5]);
assert.ok(q.every(s=>s.before.niveau===3 && s.before.type===clock));
assert.deepEqual(q.map(s=>s.after.accord),[true,true,true,true,true,false]);
assert.equal(q.at(-1).after.scorePhysique,3);assert.equal(q.at(-1).after.scelle,true);
assert.equal(q[0].before.branches.length,2);
assert.equal(q[2].after.branches.length,1);
for(const [i,s] of q.slice(0,-1).entries()){
  assert.deepEqual(s.before.arretPrevu,q[i+1].before.position);
  assert.deepEqual(s.after.branches,q[i+1].before.branches);
}
assert.deepEqual(phases.map(p=>p.action),['ACTION2','ACTION3']);
assert.deepEqual(phases.map(p=>p.ref),coverage.slice(11,13).map(s=>s.after.ref));
assert.deepEqual(phases.map(p=>p.delta),[[4,0],[4,0]]);
assert.deepEqual(phases.map(p=>p.position),[[16,6],[20,6]]);
assert.ok(phases.every(p=>p.avantActeur && p.motif===phases[0].motif));
// Recoupe la datation sans appeler le producteur de phase. L'image antérieure est à l'indice 0.
const archivePath='docs/migration/native-campaigns-v55/final/as66-public-trace.json.gz';
const data=execFileSync('git',['show',shas[0]+':'+archivePath],{maxBuffer:16*1024*1024});
const {packets}=JSON.parse(gunzipSync(data));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const patch=(frame,[x,y],width,height)=>frame.slice(y,y+height).map(row=>row.slice(x,x+width));
const dated=phases.map((phase,i)=>{
  const tour=12+i, packet=packets[tour].packet, previous=packets[tour-1].packet, step=coverage[tour-1];
  const actions=packet.available_action_refs.map(key=>Number(key.slice(6)));
  assert.equal(hash([packet.frame_rows,packet.frame_packet,actions,packet.level,packet.levels_completed,packet.state]),step.after.paquetJeu);
  assert.equal(hash(previous.frame_rows),step.before.image);
  const [w,h]=phase.taille, origin=phase.position.map((pos,j)=>pos-phase.delta[j]);
  const [color,bodyHeight,bodyWidth]=step.before.appel.pre.corps;
  const mask=patch(packet.frame_rows,phase.position,w,h);
  const sequence=[previous.frame_rows,...packet.frame_packet];
  const maskArrives=sequence.findIndex(frame=>isDeepStrictEqual(patch(frame,phase.position,w,h),mask));
  const actorLeaves=sequence.findIndex(frame=>patch(frame,step.before.position,bodyWidth,bodyHeight).flat().some(p=>p!==color));
  assert.ok(maskArrives>0 && actorLeaves>maskArrives);
  for(const [index,frame] of sequence.entries()){
    assert.deepEqual(patch(frame,index<maskArrives?origin:phase.position,w,h),mask);
  }
  return {tour,masque:maskArrives,acteur:actorLeaves};
});
assert.deepEqual(dated.map(e=>[e.masque,e.acteur]),[[2,3],[2,3]]);
for(const name of ['sansHorloge','mêmeCommande']){
  const z=golden[name].steps;
  assert.deepEqual(z.slice(0,13),coverage.slice(0,13));
  assert.equal(z[13].before.ref,a14.before.ref);
  assert.deepEqual(choice(z[13].before),['observed_frontier','experiment','ACTION2',0]);
  assert.deepEqual(choice(z[14].before),['sliding_cavity',clock,'ACTION1',0]);
  assert.equal(z[14].after.accord,true);
}
const merged=golden.mêmeCommande.steps[13].before.appel.pre;
assert.deepEqual(merged.phase,phases);
assert.deepEqual(merged.phaseServie,[phases[0],{...phases[1],action:phases[0].action}]);
assert.equal(cat[13].before.ref,a14.before.ref);assert.notEqual(cat[13].before.type,clock);
assert.equal(cat[13].before.appel.pre.restant,3);assert.equal(a14.before.appel.pre.restant,598);

const s97=golden.stationnaire97, actual=s97.steps.at(-1), t=actual.geste, authentic=coverage[t-1];
assert.ok(golden.eligible.includes(t));assert.deepEqual(runs[1].eligible,golden.eligible);
assert.deepEqual(s97.steps.slice(0,-1),coverage.slice(0,t-1));
assert.deepEqual(actual.before,authentic.before);
assert.equal(actual.after.paquetJeu,authentic.after.paquetJeu);
assert.equal(actual.after.presente,authentic.before.image);
assert.notEqual(actual.after.presente,actual.after.physique);
assert.equal(actual.after.accord,false);assert.equal(actual.after.scelle,true);
assert.deepEqual(actual.after.branches,[]);
assert.deepEqual(choice(s97.choixSuivant),['sliding_cavity',clock,'ACTION1',0]);
assert.notEqual(s97.choixSuivant.ref,actual.before.ref);
const stats=runs.map((r,i)=>({sha:shas[i],départs:Object.keys(r).length-1,
  gestes:Object.entries(r).filter(([k])=>k!=='eligible').reduce((s,[,v])=>s+v.steps.length,0)}));
console.log(JSON.stringify({stats,catalogue:{gestes:cat.length,l84:entries(cat),choixT14:choice(cat[13].before)},
  couverture:{gestes:coverage.length,l97:q.map(s=>s.geste),accords:q.map(s=>s.after.accord),phase:phases.map(({motif,...p})=>p),datationImages:dated},
  ligne84:{nominal:choice(a5.before),sansAccèsGel:choice(b[4].before),sansAccèsBranche:choice(a[4].before),sansDirection:choice(d[4].before),
    suiteRetrait:choice(a[5].before),stationnaire:{accord:alt84.accord,physique:alt84.scorePhysique,servi:alt84.niveaux,suite:s84.choixSuivant&&choice(s84.choixSuivant)}},
  ligne97:{sansHorloge:golden.sansHorloge.steps.slice(13).map(s=>choice(s.before)),
    mêmeCommande:golden.mêmeCommande.steps.slice(13).map(s=>choice(s.before)),
    stationnaire:{tour:t,indice:actual.before.indice,accord:actual.after.accord,scellé:actual.after.scelle,
      suite:s97.choixSuivant&&choice(s97.choixSuivant)}}},null,2));
