import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';

const [dir,archive]=process.argv.slice(2);
const shas=['699ac89e70be0e3cd9bceafa16689552576310a0','495ea14890c1d0cd69de356d40a3b243e0b86f6d'];
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const [parent,candidate]=shas.map(sha=>{
  const p=read(join(dir,sha.slice(0,8)+'.json'));assert.equal(p.sha,sha);assert.equal(p.chargements,1);return p.results;
});
const eventType={envelope_fill_experiment:'envelope_fill_context',field_service_experiment:'field_service_context',
  field_service_transfer_experiment:'field_service_transfer',nested_control_experiment:'nested_control_response'};
const transfer='field_service_transfer_experiment',nested='nested_control_experiment';
function dated(ticket,next,event){
  return Boolean(event && next.retour.ticket===ticket.ticket.id && equal(event.refs,[ticket.ticket.observationRef,next.retour.ref]));
}
function own(ticket,next){
  return next.events.find(e=>e.kind===eventType[ticket.type] && dated(ticket,next,e));
}
function core(row){const {récepteur,...rest}=row;return rest;}
function ticket(t){return [t.type,t.phase??null,t.point??(t.ticket?.data?[t.ticket.data.x,t.ticket.data.y]:null),t.ticket?.actionRef];}
function boundary(t){
  const t10=t[9],t11=t[10];assert.ok(t11.ticket.level===t10.ticket.level+1);
  const pair=[t10.ticket.observationRef,t11.retour.ref];
  for(const kind of ['field_service_context','nested_control_response']){
    assert.ok(t11.events.some(e=>e.kind===kind && dated(t10,t11,e)));
  }
  return pair;
}
function summary(t,index){
  const d=t[index],n=t[index+1],e=own(d,n);
  return {tour:index+1,type:d.type,phase:d.phase,point:d.point,retour:e.kind,mesure:e.essai??null,suite:ticket(n),étatSuivant:n.état};
}
assert.deepEqual(Object.keys(parent),Object.keys(candidate));
assert.deepEqual(parent.nominal,candidate.nominal);
const nominal=parent.nominal.turns,counts=Object.fromEntries(['envelope_fill_experiment','field_service_experiment',transfer]
  .map((type,i)=>[[44,47,48][i],nominal.filter(t=>t.type===type).length]));
assert.deepEqual(counts,{44:3,47:6,48:6});
if(archive){
  assert.deepEqual(nominal,read(join(archive,'jeu.json')).nominal);
  const oldGroups={réserve:['réserve','altérée'],publique:['reproduction-48','altérée'],absence:['public','absente']};
  for(const [name,[group,variant]] of Object.entries(oldGroups)){
    const row=parent[name];assert.ok(row,'archive demandée sans le groupe réservé');
    const old=read(join(archive,'699ac89e.'+group+'.json')).results.find(s=>s.variant===variant).turns;
    assert.deepEqual(row.turns.slice(0,old.length),old);
  }
}
const cases={};
for(const [name,p] of Object.entries(parent)){
  const c=candidate[name],a=p.turns,b=c.turns;
  assert.deepEqual(p.physical.slice(0,11),c.physical.slice(0,11));
  for(const [arr,phys] of [[a,p.physical],[b,c.physical]]){
    assert.deepEqual(arr.slice(0,10).map(core),nominal.slice(0,10));
    const pair=boundary(arr);
    for(const [i,t] of arr.slice(0,-1).entries()){
      const n=arr[i+1];assert.ok(t.ticket && t.admis);assert.equal(n.retour.ticket,t.ticket.id);assert.equal(n.retour.matched,null);
      if(t.famille==='observed_frontier'){
        assert.equal(t.type,'experiment');assert.ok(!eventType[t.type]);assert.equal(n.events.length,0);
      }else{
        assert.equal(t.périmé,false);assert.ok(own(t,n),'reçu propre T'+(i+1));
      }
    }
    assert.equal(phys[10].image,parent.nominal.physical[10].image);
    if(['publique','réserve','absence'].includes(name)){
      const {avant,après}=arr[10].proof;assert.deepEqual(avant,pair);
      assert.equal(equal(après,pair),false);
      if(name==='absence')assert.equal(après,null);
      else{
        assert.equal(après[1],pair[1]);assert.ok(arr.slice(0,9).some(t=>t.ref===après[0]));
        if(name==='publique')assert.equal(après[0],arr[8].ref);
      }
    }else{
      assert.deepEqual(arr[10].events.find(e=>e.kind==='field_service_transfer').frontière,pair);
      assert.deepEqual(ticket(arr[10]),[transfer,'revalidate_source_access',[11,35],'ACTION6']);
      assert.deepEqual(own(arr[10],arr[11]).essai,{point:[11,35],de:'horizontal',à:'vertical'});
    }
  }
  let pivot=10;
  if(name==='nominal'){
    assert.equal(a.length,17);assert.deepEqual(p,c);
  }else if(name==='absence'){
    assert.deepEqual(p,c);assert.equal(a[10].type,nested);
  }else if(name==='lié'){
    pivot=11;assert.deepEqual(a.slice(0,11),b.slice(0,11));assert.deepEqual(p.physical.slice(0,12),c.physical.slice(0,12));
    const x=a[11].récepteur;assert.deepEqual(x,b[11].récepteur);assert.equal(x.après,x.avant+1);
    assert.deepEqual(x.paire,boundary(a));assert.deepEqual(x.refs,own(a[10],a[11]).refs);
    assert.equal(a[11].type,transfer);assert.notEqual(b[11].type,transfer);
  }else{
    assert.equal(a[10].type,transfer);assert.deepEqual(a[10].point,[11,35]);
    assert.equal(b[10].type,nested);assert.deepEqual(b[10].point,[32,51]);
    assert.deepEqual(c.physical,candidate.absence.physical);
    assert.ok(!dated(b[10],b[11],own(a[10],a[11])),'reçu de revalidation prêté au repli');
  }
  cases[name]={parent:summary(a,pivot),candidat:summary(b,pivot)};
}
console.log(JSON.stringify({révisions:shas,départsParSHA:Object.keys(cases).length,occurrencesNominales:counts,cas:cases},null,2));
