import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const dir=process.argv[2],versions=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','f489393bb15a1ce775a3904ee97a216d40db026f'];
const datasets=versions.map(sha=>Object.assign({},...['parcours','retours'].map(group=>{
  const p=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));assert.equal(p.sha,sha);return p.results;
})));
const [old,corrected]=datasets;
for(const name of Object.keys(old)){
  assert.equal(old[name].sélecteurDisponible,false);assert.equal(corrected[name].sélecteurDisponible,true);
  if(!['autre','retrait'].includes(name))for(const key of ['rows','attempts','events'])assert.deepEqual(old[name][key],corrected[name][key]);
}
// Rang et ensemble de toutes les premières actions minimales dans le graphe N1.
function minimum(q,target,unit){
  const frontier=[{q,first:null,d:0}],seen=new Set(),firsts=new Set();let best=Infinity;
  for(let i=0;i<frontier.length;i++){
    const f=frontier[i];if(f.d>best)break;
    const key=JSON.stringify([f.q,f.first]);if(seen.has(key))continue;seen.add(key);
    if(f.q[1]===target){best=f.d;firsts.add(f.first);continue;}
    for(const control of [0,1]){
      const donor=1-control;if(f.q[donor]<unit)continue;
      const next=[...f.q];next[donor]-=unit;next[control]+=unit;
      frontier.push({q:next,first:f.first??control,d:f.d+1});
    }
  }
  return {distance:best,premiers:[...firsts].sort()};
}
function physical(t,n){
  assert.equal(n.retour.ticket,t.ticket);assert.ok(t.admis);assert.equal(t.cmd,'ACTION6');
  if(t.plan)assert.deepEqual(t.pixelsAvant,t.plan.longueurs);
  if(n.retour.raison==='official_boundary'){assert.equal(n.retour.matched,null);return;}
  if(t.plan?.attendu){assert.equal(n.retour.matched,true);assert.deepEqual(n.retour.longueurs,t.plan.attendu);}
}
const scopes={};
for(const [v,data] of datasets.entries()){
  const n=data.nominal;assert.equal(n.rows.length,17);
  for(const result of Object.values(data))for(const [i,t] of result.rows.slice(0,-1).entries())physical(t,result.rows[i+1]);
  for(const [i,t] of n.rows.slice(0,-1).entries()){
    assert.equal(t.famille,'band_transfer');assert.equal(t.type,'aligned_band_transfers');
    const next=n.rows[i+1],event=n.events.find(e=>e.ref===next.retour.ref);
    assert.ok(event);assert.equal(event.control,t.plan.actuateur);assert.deepEqual(event.before,t.pixelsAvant);
    if(event.after){assert.deepEqual(event.after,next.retour.longueurs);assert.equal(event.after.reduce((s,x)=>s+x,0),t.pixelsAvant.reduce((s,x)=>s+x,0));}
  }
  const geometries=n.rows.filter((_,i)=>[0,5,12].includes(i)).map(t=>[t.plan.axe,t.plan.unité,t.plan.longueurs.length,t.plan.cibles.length]);
  assert.deepEqual(geometries,[[0,4,2,1],[0,4,3,1],[1,2,5,3]]);
  for(const name of ['nominal','autre','retrait-T2']){
    const r=data[name],a=r.rows[0],b=r.rows[1],c=r.rows[2],alt=Boolean(v)&&name==='autre';
    assert.deepEqual(a.plan.longueurs,[32,12]);assert.equal(a.plan.sens,null);assert.equal(a.plan.attendu,null);
    assert.equal(a.point.y,alt?33:25);assert.deepEqual(b.pixelsAvant,alt?[28,16]:[36,8]);assert.equal(b.retour.matched,null);
    assert.equal(b.plan.sens,'into_clicked');assert.ok(b.plan.refs.includes(b.retour.ref));assert.deepEqual(b.plan.attendu,alt?[24,20]:[32,12]);
    assert.deepEqual(c.retour.longueurs,b.plan.attendu);
    const bfs=minimum(b.pixelsAvant,24,4);assert.deepEqual(bfs,{distance:alt?2:4,premiers:[1]});assert.ok(bfs.premiers.includes(b.plan.actuateur));
    if(name==='retrait-T2')assert.ok(!r.calls.some(q=>q.revision===2));
  }
  const r=data.retrait;
  if(v){
    assert.deepEqual(r.calls[0],{revision:1,offres:[0,1],choix:null});assert.equal(r.rows[0].famille,'observed_frontier');
    assert.deepEqual(r.rows[0].point,{x:21,y:36});assert.equal(r.rows[1].plan.sens,null);assert.equal(r.rows[1].point.y,25);
    assert.deepEqual(r.rows[2].retour.longueurs,[36,8]);assert.deepEqual(data.autre.calls[0],{revision:1,offres:[0,1],choix:1});
  }else assert.deepEqual(r.rows,old.nominal.rows.slice(0,r.rows.length));
  for(const name of ['stationnaire','amplitude','référence']){
    const r=data[name],next=r.rows[1],test=r.attempts.find(e=>e.revision===2);
    assert.equal(next.retour.matched,null);assert.equal(test.réfuté,name==='amplitude');
    assert.equal(test.sens,name==='référence'?'into_clicked':null);
    if(name==='stationnaire'){
      assert.deepEqual(next.retour.longueurs,[32,12]);assert.deepEqual(test.essais,[[[32,12],0]]);
      assert.equal(next.plan.attendu,null);assert.equal(next.point.y,33);assert.equal(next.plan.actuateur,1);
    }else{
      assert.deepEqual(next.retour.longueurs,name==='amplitude'?[33,11]:[36,8]);assert.equal(test.proposé,null);assert.equal(next.famille,'observed_frontier');
    }
  }
  const matched=n.rows.filter(t=>t.retour?.matched===true).length;assert.equal(matched,13);
  scopes[versions[v]]={départs:7,ticketsAvecRetour:Object.values(data).reduce((k,r)=>k+r.rows.length-1,0),nominaux:16,
    prédictionsConfirmées:matched,sondeSansPrédiction:1,frontièresOfficielles:2,autreSonde:data.autre.rows[0].point,repli:r.rows[0].famille,testsAuteur:v?6:3};
  assert.match(readFileSync(join(dir,versions[v].slice(0,8)+'.tests-auteur.txt'),'utf8'),new RegExp('pass '+(v?6:3)+'\\b'));
}
console.log(JSON.stringify({mesures:scopes},null,2));
