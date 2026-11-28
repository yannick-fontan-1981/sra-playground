import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','a2bd031cff2fb2ce7c919b2213f0ba5a8b75a36a'];
const read=(sha,g,ext)=>readFileSync(join(dir,sha.slice(0,8)+'.'+g+'.'+ext),'utf8');
const [gel,candidate]=shas.map(sha=>{
  const tap=read(sha,'auteur','txt');
  assert.match(tap,/\bpass 3\b/);assert.match(tap,/\bfail 0\b/);
  return Object.assign({},...['nominal','contrôles'].map(g=>{
    const d=JSON.parse(read(sha,g,'json'));
    assert.equal(d.sha,sha);assert.equal(d.group,g);return d.cases;
  }));
});
assert.deepEqual(gel,candidate);
const {nominal,masqué,retrait,témoin,stationnaire}=gel,n=nominal.rows;
const count=value=>value.rows.filter(x=>x.ret).length;
assert.deepEqual(Object.values(gel).map(count),[16,3,2,2,2]);
const cells=[[2,3],[4,3],[4,3],[6,3],[6,3],[6,5],[6,5],[6,7]];
for(let i=0;i<8;i++){
  const t=n[i].ticket,r=n[i+1].ret;
  assert.equal(t.owner,'reduction_transport');
  assert.equal(t.kind,'supported_ternary_reduction');
  assert.equal(t.carriers,0);
  assert.equal(t.admis,true);
  assert.equal(t.mode,i%2===0?'select':'jump');
  assert.deepEqual(t.cell,cells[i]);
  assert.equal(r.id,t.id);
  assert.deepEqual(r.event.refs,[t.ref,r.ref]);
  assert.equal(r.matched,i===7?null:true);
  if(i<7){
    assert.equal(r.event.before,5-Math.floor(i/2));
    assert.equal(r.event.after,r.event.before-(i%2));
  }
}
assert.equal(n[8].ret.event.status,'official_boundary');
assert.equal(n[8].score,1);
assert.ok(n.slice(8,16).every(x=>x.ticket.owner!=='reduction_transport'));
assert.deepEqual(n[0].appui,{0:0,1:16,2:0});
assert.deepEqual(n[1].appui,{0:0,1:8,2:8});
assert.equal(n[1].ret.event.landing,true);
for(const r of [masqué,retrait,témoin]){
  assert.deepEqual(r.rows[0],n[0]);
  assert.deepEqual(r.rows[1].appui,{0:8,1:0,2:8});
  assert.equal(r.rows[1].photo,masqué.rows[1].photo);
  assert.equal(r.rows[1].ret.packet,n[1].ret.packet);
  assert.deepEqual([r.rows[1].ret.matched,r.rows[1].ret.event.before,r.rows[1].ret.event.after],[true,5,5]);
}
for(const r of [masqué,témoin]){
  const t=r.rows[1].ticket,a=r.rows[2].ret;
  assert.deepEqual([t.command,t.point,t.mode,t.cell],['ACTION6',{x:30,y:19},'jump',[4,3]]);
  assert.equal(a.matched,true);
  assert.deepEqual([a.event.before,a.event.after],[5,4]);
  assert.equal(a.packet,n[2].ret.packet);
  assert.deepEqual(a.event.pegs,['4,3','5,3','6,4','6,6']);
}
assert.equal(retrait.controls[0].removed,'4,3');
assert.equal(témoin.controls[0].removed,'1,2');
assert.deepEqual([retrait.rows[1].ticket.owner,retrait.rows[1].ticket.command],['observed_frontier','ACTION1']);
assert.equal(retrait.rows[2].score,0);
assert.deepEqual(retrait.rows[2].appui,n[1].appui);
assert.equal(retrait.rows[2].ticket.mode,'jump');
const after=stationnaire.rows[2];
assert.deepEqual(stationnaire.rows.slice(0,2),n.slice(0,2));
assert.equal(after.ret.packet,n[2].ret.packet);
assert.equal(after.ret.matched,false);
assert.equal(after.ret.seal,true);
assert.deepEqual([after.ret.event.before,after.ret.event.after],[5,5]);
assert.deepEqual([after.ticket.owner,after.ticket.command],['observed_frontier','ACTION1']);

console.log(JSON.stringify({stats:{versions:2,départsParVersion:5,gestesParVersion:25,testsParVersion:3,
  gestesCatalogue:16,occurrencesLigne:8,niveauxTerminés:1},coupure:{masqués:8,appuiRetiré:retrait.controls[0].removed,
  appuiTémoin:témoin.controls[0].removed,retourAuthentique:masqué.rows[2].ret.ref,coupSansPreuve:'ACTION1',
  reprise:retrait.rows[2].ticket.point}},null,2));
