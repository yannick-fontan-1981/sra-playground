import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','0da75640d974e9fbe3b44b78b07649344169c470'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
function read(sha,g){
  const f=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.json')));
  assert.equal(f.sha,sha);assert.equal(f.group,g);return f.cases;
}
const variants=shas.map(sha=>Object.assign({},...['nominal','contrôles','réserve'].map(g=>read(sha,g))));
assert.deepEqual(variants[0],variants[1]);
const v=variants[0];
const cat=v.catalogue.rows,long=v.prolongé.rows;
const t=(rows,n)=>rows[n-1].ticket;
const r=(rows,n)=>rows[n].reçu;
const e=(rows,n)=>{
  const ref=r(rows,n).ref;
  const events=rows.slice(1).flatMap(row=>row.reçu.événements).filter(event=>event.ref===ref);
  assert.equal(events.length,1);return events[0];
};
const p=(rows,n)=>t(rows,n).point;
for(const {rows} of Object.values(v)){
  for(let i=0;i<rows.length-1;i++){
    const ticket=rows[i].ticket,ret=rows[i+1].reçu;
    assert.deepEqual([ticket.famille,ticket.kind,ticket.cmd,ticket.admis],['code_program','learned_code_program','ACTION6',true]);
    assert.equal(ret.id,ticket.id);assert.equal(ret.famille,ticket.famille);
    assert.equal(rows[i+1].ticket?.ref??ret.ref,ret.ref);assert.equal(e(rows,i+1).ref,ret.ref);
  }
}
assert.equal(cat.length,17);assert.equal(long.length,20);
assert.equal(v.catalogue.budget,16);assert.equal(v.prolongé.budget,19);
for(let n=1;n<=16;n++){
  const {événements:catalogueEvents,...catalogueReturn}=r(cat,n);
  const {événements:extendedEvents,...extendedReturn}=r(long,n);
  assert.deepEqual(t(cat,n),t(long,n));assert.deepEqual(catalogueReturn,extendedReturn);
  assert.deepEqual(e(cat,n),e(long,n));
}
const initial=t(long,1), first=r(long,1), acquired=e(long,1);
assert.deepEqual([initial.mode,initial.opérateurs,initial.exécutions,initial.exemples,initial.acteur,initial.but,initial.point,
  initial.courant,initial.code,initial.prévu,initial.preuves],
  ['execute',0,0,0,[4,1],[4,6],{x:36,y:55},[3,0,3,0,0],[3,0,3,0,0],null,[initial.ref]]);
assert.equal(first.images,7);
assert.equal(first.accord,null);
assert.deepEqual(acquired.position,[[4,1],[4,1]]);
assert.deepEqual(acquired.avant,[]);assert.deepEqual(acquired.après,[['3',[0,1]]]);
assert.deepEqual(acquired.références,[first.ref]);

function observedVectors(images,prefix,origin) {
  const columns=new Map(images.filter(i=>i.colonne!==null && i.position!==null).map(i=>[i.colonne,i.position]));
  const operators=[];
  for(const [i,code] of prefix.entries()){
    const from=i===0?origin:columns.get(i-1),to=columns.get(i);
    if(!from || !to)continue;
    const displacement=to.map((x,j)=>x-from[j]);
    if(Math.abs(displacement[0])+Math.abs(displacement[1])===1)operators.push({code,displacement});
  }
  return operators;
}
assert.deepEqual(observedVectors(acquired.images,initial.code,initial.acteur),
  [{code:3,displacement:[0,1]},{code:3,displacement:[0,1]}]);
assert.deepEqual(acquired.mesures,observedVectors(acquired.images,initial.code,initial.acteur));
function checkReuse(learnedFrom,edit,execution,from,goal,word,dir){
  const desired=Array.from({length:execution.code.length},()=>word);
  assert.ok(learnedFrom.mesures.length>0);
  assert.ok(learnedFrom.mesures.every(m=>m.code===word && JSON.stringify(m.displacement)===JSON.stringify(dir)));
  assert.deepEqual(edit.acteur,from);assert.deepEqual(edit.but,goal);
  assert.deepEqual(edit.cible,desired);assert.deepEqual(execution.code,desired);
  assert.ok(edit.preuves.includes(learnedFrom.ref));assert.ok(execution.preuves.includes(learnedFrom.ref));
  const reached=from.map((x,i)=>x+execution.code.length*dir[i]);
  assert.deepEqual(reached,goal);
}
const n1edit=t(long,2), n1exec=t(long,8);
assert.deepEqual([n1edit.point,n1edit.mode,n1edit.prévu,r(long,2).accord],[{x:26,y:42},'edit',[3,2,3,0,0],true]);
assert.deepEqual([n1exec.mode,n1exec.point],['execute',initial.point]);
checkReuse(acquired,n1edit,n1exec,[4,1],[4,6],3,[0,1]);
assert.deepEqual([e(long,8).status,r(long,8).motif,long[8].niveau,long[8].progression],['official_boundary','official_boundary',2,1]);

const n2start=t(long,9), demo=e(long,9), n2edit=t(long,10), n2exec=t(long,18);
assert.deepEqual([n2start.mode,n2start.exemple,n2start.exemples,n2start.opérateurs,n2start.point],['demonstrate',0,2,0,{x:21,y:55}]);
assert.deepEqual(n2start.observé.opérateurs,[]);
assert.ok(!n2start.preuves.includes(acquired.ref));
assert.equal(demo.préservé,true);assert.deepEqual(demo.position,[[3,5],[3,5]]);
assert.deepEqual(demo.après,[['33',[0,-1]]]);
checkReuse(demo,n2edit,n2exec,[3,5],[3,1],33,[0,-1]);
assert.deepEqual([n2exec.mode,n2exec.point,e(long,18).status,long[18].niveau,long[18].progression],
  ['execute',{x:46,y:58},'official_boundary',3,2]);

const endpoint=v.finale.rows,masked=r(endpoint,1),absent=e(endpoint,1);
assert.deepEqual(t(endpoint,1),initial);assert.equal(masked.finale,first.finale);assert.equal(masked.ref,first.ref);
assert.deepEqual([masked.images,absent.mesures,absent.après,absent.références],[1,[],[],[]]);
const validateEvidence=(ret,receipt)=>ret.ref===receipt.ref && JSON.stringify(ret.événements[0].mesures)===JSON.stringify(receipt.mesures);
assert.ok(validateEvidence(masked,absent));
assert.ok(!validateEvidence(masked,acquired));
assert.deepEqual([p(endpoint,2),t(endpoint,2).cible,r(endpoint,2).accord],[{x:21,y:42},[1,0,3,0,0],true]);
assert.deepEqual([p(endpoint,3),t(endpoint,3).mode],[initial.point,'execute']);
assert.deepEqual(effectsCanonical(e(endpoint,3).après),[['1',[1,0]],['3',[0,1]]]);
function effectsCanonical(entries){return entries.toSorted(([a],[b])=>a.localeCompare(b));}

const removed=v.sansOpérateur.rows;
assert.deepEqual(r(removed,1),first);
assert.deepEqual(v.sansOpérateur.interventions,[{turn:2,opérateurRetiré:3}]);
assert.deepEqual(t(removed,2).observé.opérateurs,[]);
assert.deepEqual([p(removed,2),t(removed,2).cible,r(removed,2).accord],[p(endpoint,2),t(endpoint,2).cible,true]);

const alt=v.autreExemple.rows;
assert.deepEqual(alt.slice(0,8),long.slice(0,8));
assert.equal(t(alt,9).ref,n2start.ref);
assert.deepEqual([t(alt,9).mode,t(alt,9).opérateurs,t(alt,9).exemple,p(alt,9)],['demonstrate',0,1,{x:8,y:58}]);
assert.deepEqual([e(alt,9).mesures,e(alt,9).préservé,e(alt,9).après],[[],true,[]]);
assert.deepEqual([t(alt,10).mode,t(alt,10).code,p(alt,10),e(alt,10).mesures],['execute',[0,0,0,0],n2exec.point,[]]);
assert.deepEqual(t(alt,11).cible,[0,0,0,1]);

const reserve=v.permutation.rows,received=r(reserve,1),measurement=e(reserve,1);
assert.deepEqual(t(reserve,1),initial);
assert.equal(received.finale,first.finale);assert.equal(received.ref,first.ref);assert.equal(received.images,7);
const order=first.paquet.slice(),[j,k]=received.pair;
assert.ok(j>0 && k<6 && j<k);assert.notEqual(order[j],order[k]);
[order[j],order[k]]=[order[k],order[j]];
assert.deepEqual(received.paquet,order);
assert.deepEqual(measurement.mesures,observedVectors(measurement.images,initial.code,initial.acteur));
assert.deepEqual(measurement.mesures,acquired.mesures);
assert.deepEqual(t(reserve,2),n1edit);

const stats=shas.map(sha=>{
  const stock=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(stock,/pass 3\b/);assert.match(stock,/fail 0/);
  return {sha,départs:Object.keys(v).length,gestes:Object.values(v).reduce((s,c)=>s+c.rows.length-1,0),testsAuteur:3};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),catalogue:{tickets:16,
  modes:cat.slice(0,16).reduce((o,row)=>(o[row.ticket.mode]=(o[row.ticket.mode]??0)+1,o),{})},prolongation:19,
  N1:{ouverture:initial.mode,images:first.images,transitions:acquired.images,opérateur:acquired.après,
    code:n1exec.code,finaleSeule:{mesures:absent.mesures,pointT2:p(endpoint,2),mesuresT3:e(endpoint,3).mesures},
    retraitOpérateur:{pointT2:p(removed,2),cible:t(removed,2).cible}},
  N2:{exemple:p(long,9),opérateur:demo.après,code:n2exec.code,autreExemple:{point:p(alt,9),mesures:e(alt,9).mesures,exécution:p(alt,10)}},
  réserve:{paire:[j,k],séquence:measurement.images,mesures:measurement.mesures,pointT2:p(reserve,2)}},null,2));
