import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','b5dda8ecb17b1725816bae09b44973449869dbae'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const factor='factored_material_return',rewrite='scored_local_rewrite',frontier='observed_frontier';
const sample='factored_rewrite_sample',scored='factored_rewrite_scored',test='scored_rewrite_test';
function read(sha,g){
  const file=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(file.sha,sha);assert.equal(file.group,g);return file.cases;
}
const runs=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
assert.deepEqual(runs[0],runs[1]);
const c=runs[0], cat=c.catalogue.rows,n=c.prolongé.rows;
const t=(rows,tour)=>rows[tour-1].ticket,r=(rows,tour)=>rows[tour].ret;
const decision=t=>[t.famille,t.kind,t.cmd,t.index];
const event=(rows,tour,kind)=>r(rows,tour).événements.find(e=>e.kind===kind);
for(const {rows} of Object.values(c))for(let i=0;i<rows.length-1;i++){
  const ticket=rows[i].ticket,ret=rows[i+1].ret;
  assert.ok(ticket.admis);assert.equal(ret.id,ticket.id);assert.equal(ret.famille,ticket.famille);
  if(rows[i+1].ticket)assert.equal(rows[i+1].ticket.ref,ret.ref);
}
assert.equal(cat.length,17);assert.equal(n.length,20);
for(let i=1;i<=16;i++){
  assert.deepEqual(t(cat,i),t(n,i));
  assert.deepEqual(r(cat,i),r(n,i));
}
assert.equal(n[0].image,n[7].image);assert.equal(n[0].score,n[7].score);
assert.equal(n[0].niveau,n[7].niveau);
assert.deepEqual(t(n,8).factor.indices,[60,61,62]);
assert.deepEqual(t(n,8).factor.témoins,[t(n,2).ref,t(n,4).ref,t(n,5).ref]);
assert.deepEqual(t(n,8).factor.plan,['ACTION1','ACTION3','ACTION2','ACTION4']);
for(const [i,cmd] of t(n,8).factor.plan.entries()){
  const turn=8+i,ticket=t(n,turn),receipt=r(n,turn);
  assert.deepEqual(decision(ticket),[factor,'public_factored_return',cmd,i]);
  if(i<3){
    assert.deepEqual(receipt.canaux.attendu,receipt.canaux.physique);
    assert.ok(receipt.canaux.pixelsPhysiques.every(count=>count>0));
    assert.equal(receipt.accord,true);assert.equal(receipt.raison,'both_current_channels_matched');
  }
}
const proof=event(n,11,scored),model=proof.modèle;
const observations=[8,9,10].map(turn=>event(n,turn,sample)??n.flatMap(row=>row.ret?.événements??[]).find(e=>e.kind===sample && e.avant===t(n,turn).ref));
assert.deepEqual(model.witnesses,observations.map(s=>s.avant));
assert.deepEqual(observations.map(s=>s.action),['ACTION1','ACTION3','ACTION2']);
for(const [i,s] of observations.entries())assert.equal(s.après,r(n,8+i).ref);
assert.deepEqual([model.source,model.target,model.epoch,model.command],[5,14,1,'ACTION4']);
assert.deepEqual([model.boundary,proof.après,n[11].niveau,n[11].score,r(n,11).accord],
  [t(n,11).ref,r(n,11).ref,2,1,null]);
for(let turn=12;turn<=19;turn++){
  const ticket=t(n,turn),out=event(n,turn,test);
  assert.equal(ticket.famille,rewrite);assert.equal(ticket.kind,'public_scored_rewrite');
  assert.ok(model.witnesses.every(ref=>ticket.preuves.includes(ref)));
  assert.ok(ticket.preuves.includes(model.boundary));
  assert.deepEqual([out.avant,out.après,out.supports],[ticket.ref,r(n,turn).ref,ticket.sites.length]);
  assert.equal(out.effet,turn===18?'official_progress':'matched');
}
const first=t(n,12);
assert.deepEqual([first.cmd,first.sites.map(s=>s.origin),r(n,12).accord],['ACTION1',[[16,34]],true]);
assert.ok(first.sites[0].pixels>0);
assert.equal(r(n,12).rewrite.physique,first.sites[0].pixels);

const missingBand=c.sansTémoin11,drop=c.sansModèle81,lacking=c.unÉchantillon;
assert.deepEqual(missingBand.rows.slice(0,7),n.slice(0,7));
assert.deepEqual(missingBand.interventions[0],{tour:8,témoin:t(n,2).ref});
assert.deepEqual(decision(t(missingBand.rows,8)),[frontier,'experiment','ACTION4',0]);
assert.deepEqual(decision(t(missingBand.rows,9)),[frontier,'experiment','ACTION1',0]);
assert.ok(!event(missingBand.rows,8,sample));
assert.deepEqual(drop.rows.slice(0,11),n.slice(0,11));
const {key:storedFingerprint,...storedModel}=drop.interventions[0].modèle;
const {key:eventFingerprint,...eventModel}=model;
assert.deepEqual(storedModel,eventModel);
assert.equal(t(drop.rows,12).ref,first.ref);
assert.deepEqual(decision(t(drop.rows,12)),[frontier,'experiment','ACTION1',0]);
assert.equal(r(drop.rows,12).jeu,r(n,12).jeu);
assert.ok(!event(drop.rows,12,test));
const good=e=>e.kind===test&&e.avant===first.ref&&e.après===r(n,12).ref&&e.action===first.cmd;
assert.ok(good(event(n,12,test)));
assert.ok(!good({kind:test,avant:first.ref,après:r(n,13).ref,action:first.cmd}));
assert.deepEqual(decision(t(drop.rows,13)),[rewrite,'public_scored_rewrite','ACTION2',0]);
assert.equal(r(drop.rows,13).accord,true);

assert.deepEqual(lacking.rows.slice(0,11),n.slice(0,11));
assert.deepEqual(lacking.interventions[0],{tour:11,témoins:model.witnesses,gardé:model.witnesses[0]});
assert.equal(r(lacking.rows,11).jeu,r(n,11).jeu);
assert.equal(lacking.rows[11].score,1);assert.ok(!event(lacking.rows,11,scored));
assert.equal(t(lacking.rows,12).famille,frontier);

const canal=c.canal8.rows, mask=c.masque12.rows;
assert.deepEqual(t(canal,8),t(n,8));assert.deepEqual(t(mask,12),first);
assert.equal(r(canal,8).jeu,r(n,8).jeu);assert.equal(r(mask,12).jeu,r(n,12).jeu);
const report=r(canal,8),channels=report.canaux;
assert.ok(channels.pixelsServis.includes(0));assert.ok(channels.pixelsServis.some(x=>x>0));
assert.equal(channels.attendu.filter((x,i)=>x===channels.servi[i]).length,1);
assert.deepEqual([report.accord,report.scelle,report.raison],[false,true,'partition_forecast_diverged']);
assert.ok(!event(canal,8,sample));assert.equal(t(canal,9).index,0);
assert.deepEqual([r(mask,12).accord,r(mask,12).scelle,r(mask,12).raison],[false,true,'predicted_mask_rewrite_refuted']);
assert.equal(first.sites[0].pixels,30);
assert.deepEqual(r(mask,12).rewrite,{géométrie:30,physique:30,servi:0});
assert.equal(event(mask,12,test).effet,'refuted');
assert.ok(t(mask,13).famille!==rewrite||t(mask,13).cmd!=='ACTION1');
const stats=shas.map(sha=>{
  const tests=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(tests,/pass 5\b/);assert.match(tests,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((s,x)=>s+x.rows.length-1,0),testsAuteur:5};
});
const count=kind=>cat.slice(0,16).filter(row=>row.ticket.famille===kind).length;
assert.deepEqual([count(factor),count(rewrite)],[4,5]);
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:{11:count(factor),81:count(rewrite)},
  ligne11:{plan:t(n,8).factor.plan,témoins:t(n,8).factor.témoins,repli:decision(t(missingBand.rows,8)),
    réserve:{pixels:[channels.pixelsPhysiques,channels.pixelsServis],suite:decision(t(canal,9))}},
  ligne81:{modèle:model,repli:decision(t(drop.rows,12)),suite:decision(t(drop.rows,13)),
    sansModèleÀLaFrontière:decision(t(lacking.rows,12)),réserve:{masque:r(mask,12).rewrite,suite:decision(t(mask,13))}}},null,2));
