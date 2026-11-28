import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const versions=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','6172e2d3579f36af9c0912578f6d58333a298343'];
const read=(sha,group,ext)=>readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.'+ext),'utf8');
const cases={};
for(const group of ['nominal','contrôles','recherche']){
  const [baseline,comparison]=versions.map(sha=>{
    const data=JSON.parse(read(sha,group,'json'));
    assert.equal(data.sha,sha);
    assert.equal(data.group,group);
    return data.cases;
  });
  assert.deepEqual(comparison,baseline);
  Object.assign(cases,baseline);
}
for(const sha of versions){
  assert.match(read(sha,'auteur','txt'),/\bpass 3\b/);
  assert.match(read(sha,'noyau','txt'),/\bpass 2\b/);
  for(const suite of ['auteur','noyau'])assert.match(read(sha,suite,'txt'),/\bfail 0\b/);
}

const {catalogue,sansGrille,sansCarte,stationnaire,prolongé,départN2}=cases;
const isMotif=r=>r.ticket?.kind==='motif_to_geometric_access';
const nominal=catalogue.rows;
const row=(i,set=catalogue)=>set.rows[i-1];
const count=set=>set.rows.filter(r=>r.ret).length;
assert.deepEqual([catalogue,sansGrille,sansCarte,stationnaire,prolongé].map(count),[16,2,8,15,51]);
assert.match(départN2.refus,/must begin at level 1 with zero completed levels/);
assert.deepEqual(nominal.filter(isMotif).map(r=>r.tour),[2,3,4,5,6,7,8,11,12,13,14,15]);
assert.ok(nominal.filter(isMotif).every(r=>r.ticket.owner==='motif_access'&&r.ticket.admitted));
assert.deepEqual(prolongé.rows.slice(0,16),nominal.slice(0,16));
assert.ok(prolongé.rows.slice(15,-1).every(r=>r.ticket.kind==='cell_patch_placement'));
assert.deepEqual([prolongé.rows.at(-1).niveau,prolongé.rows.at(-1).score,prolongé.rows.at(-1).stop],
  [1,0,'native_game_over']);

assert.equal(row(3).ret.original,8);
assert.deepEqual(row(2).ticket.motif.actor,row(3).ticket.motif.actor);
assert.deepEqual(row(5).ticket.motif.motion.ACTION3,[-4,0]);
assert.deepEqual(row(8).ticket.motif.motion.ACTION4,[4,0]);
assert.deepEqual(row(2,sansGrille).ticket.command,row(2).ticket.command);
assert.equal(row(2,sansGrille).vu,row(2).vu);
assert.equal(row(2,sansGrille).ticket.kind,'experiment');
assert.equal(row(8,sansCarte).vu,row(8).vu);
assert.deepEqual(row(8,sansCarte).ticket.data,{x:12,y:19});
assert.deepEqual(row(8).ticket.data,{x:30,y:50});
assert.deepEqual(row(13).ticket.data,row(9).ticket.data);
assert.notEqual(row(13).ticket.owner,row(9).ticket.owner);

const invocation=row(15).ticket;
const effect=row(16).ret;
const altered=row(16,stationnaire).ret;
assert.equal(invocation.motif.mode,'invoke');
assert.deepEqual(invocation.data,{x:30,y:60});
assert.deepEqual(row(15,stationnaire).ticket,invocation);
assert.equal(effect.id,invocation.id);
assert.equal(altered.id,invocation.id);
assert.deepEqual(effect.frames,altered.frames);
assert.deepEqual([effect.owner,effect.frames.length,effect.servi,altered.original,altered.servi],['motif_access',17,54,54,0]);
const acquired=effect.events.find(e=>e.mode==='invoke'&&e.ref===effect.ref);
const rejected=altered.events.find(e=>e.mode==='invoke'&&e.ref===altered.ref);
assert.deepEqual([acquired.cleared,rejected.cleared],[true,false]);
assert.deepEqual([acquired.ray,rejected.ray],[undefined,undefined]);
assert.equal(row(16).ticket.kind,'cell_patch_placement');
assert.equal(row(16,stationnaire).ticket.kind,'cell_patch_placement');
assert.equal(prolongé.rows.filter(r=>r.ticket?.motif?.mode==='walk').length,0);

console.log(JSON.stringify({stats:{versions:2,départsAdmisParVersion:5,départsRefusésParVersion:1,gestesParVersion:92,
  motifsCatalogue:12,gestesCatalogue:16,gestesProlongés:51,accèsMotifNatif:0,testsAuteurParVersion:3,
  contrôlesConstruitsNoyauParVersion:2},prolongation:{niveau:1,score:0,arrêt:'native_game_over'},
  invocation:{tour:15,commande:invocation.data,images:effect.frames.length,changements:effect.servi,
    ordinaire:acquired,stationnaire:rejected},refusN2:départN2.refus},null,2));
