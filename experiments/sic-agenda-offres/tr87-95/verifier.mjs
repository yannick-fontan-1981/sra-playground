import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs,promisify} from 'node:util';
import {digest} from '../rejouer-service.mjs';
import {git,versions,withEngine} from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const worker=fileURLToPath(new URL('operateur.mjs',import.meta.url)),run=promisify(execFile),vendor=resolve(values.pyodide);
const tmp=await mkdtemp(join(tmpdir(),'sic-qualification-'));
const click=(x,y)=>['ACTION6',{x,y}];
const trajectory=steps=>steps.map(s=>[s.pre.level,s.pre.family,s.pre.slot,s.pre.kind,s.pre.command,s.after.packet,s.after.levels]);
async function replay(engine,variant){
  const out=join(tmp,variant+'.json');
  await run(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',variant,'--recu',out]);
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const cut of r.cuts)assert.equal(digest(cut.pre),cut.seal);
  return r;
}
async function group(engine,names){
  const results=await Promise.allSettled(names.map(async name=>[name,await replay(engine,name)]));
  return Object.fromEntries(results.map(result=>{
    if(result.status==='rejected')throw result.reason;
    return result.value;
  }));
}
function versionsDuRecu(){
  return {...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))};
}


const a1=['ACTION1',{}],a2=['ACTION2',{}],a3=['ACTION3',{}];
const guard={admitted:true,reason:'bind_full_glyph_word_and_focus'};
function ticket(p,command,index=0){
  assert.deepEqual([p.family,p.kind,p.bundle,p.command,p.index,p.guard],
    ['word_interface','typed_word_interface','OP18',command,index,guard]);
  if(index===0)assert.deepEqual(p.scope,{live:guard,stale:{...guard,admitted:false}});
}
try{
  const old=await withEngine('historique',engine=>replay(engine,'nominal'));
  const r=await withEngine('gel',async e=>({...await group(e,['nominal','sans-types','type-temoin']),
    ...await group(e,['ordre-entrees','stationnaire'])}));
  const n=r.nominal.steps,[a,b,,,,,cycled,inverse,cursor,reprise,next,newFocus]=n;
  assert.equal(n.length,16);
  assert.deepEqual(trajectory(old.steps),trajectory(n));
  ticket(a.pre,a1);
  const pre=a.pre.cut.pre,rows=pre.table,focus=a.pre.plan.before[1];
  assert.equal(rows.length,6);
  assert.ok(rows.every(x=>x.types[0]===10&&x.types[1]===7));
  assert.deepEqual([pre.scene.source.box,pre.scene.editable.box,pre.scene.source.type,pre.scene.editable.type,
    pre.scene.rules,pre.scene.derivations,focus],[[14,40,48,46],[14,51,48,57],10,7,6,1,0]);
  assert.equal(pre.scene.complete,true);
  assert.deepEqual(pre.scene.target,pre.sourceWord.map(g=>rows.find(x=>x.words[0][0]===g).words[1][0]));
  assert.deepEqual([pre.native.edits,pre.native.directions,a.pre.plan.expected,a.after.matched,a.after.seal],[[],[],null,null,true]);
  const receipt=a.after.record;
  const oldGlyph=a.pre.plan.before[0][0],newGlyph=receipt.measured[0][0];
  assert.notEqual(oldGlyph,newGlyph);
  assert.deepEqual(receipt.measured,[[newGlyph,...a.pre.plan.before[0].slice(1)],0]);
  assert.deepEqual([receipt.event.status,receipt.event.ref,receipt.native.edits],
    ['local_glyph_rewrite',a.after.ref,[['ACTION1',[[oldGlyph,newGlyph]]]]]);
  ticket(b.pre,a1);
  assert.equal(b.pre.evidence.includes(a.after.ref),true);

  const missing=r['sans-types'],c=missing.cuts[0];
  assert.deepEqual(missing.change,[{box:[45,13,51,19],from:7,to:10,changed:34,glyphInk:5}]);
  assert.deepEqual(c.pre.table,rows.filter((_,i)=>i!==3));
  assert.equal(c.pre.scene,null);
  assert.equal(c.local,null);
  assert.deepEqual(missing.steps[0].pre.command,a1);
  assert.notEqual(missing.steps[0].pre.family,'word_interface');
  assert.equal(missing.steps[0].after.packet,a.after.packet);

  const control=r['type-temoin'],different=control.steps[0].pre.cut.pre;
  assert.deepEqual(different.table,rows.filter((_,i)=>i!==5));
  assert.deepEqual(different.scene.target,pre.scene.target);
  ticket(control.steps[0].pre,a1);
  assert.equal(control.steps[0].after.packet,a.after.packet);

  const stable=r['ordre-entrees'];
  assert.deepEqual(stable.steps,[a]);
  assert.deepEqual(stable.next,b.pre);

  const still=r.stationnaire,read=still.steps[0].after;
  assert.deepEqual(still.steps[0].pre,a.pre);
  assert.equal(read.packet,a.after.packet);
  assert.notEqual(read.presented,read.physical);
  assert.deepEqual([read.record.event.status,read.record.measured,read.record.native.edits,read.record.native.directions],
    ['unknown_transition',a.pre.plan.before,[],[]]);
  ticket(still.next,a2);
  assert.equal(still.next.plan.expected,null);

  assert.equal(cycled.after.record.native.edits[0][1].length,7);
  ticket(inverse.pre,a2);
  ticket(cursor.pre,a3);
  assert.deepEqual([cursor.after.record.event.status,cursor.after.record.native.directions,cursor.after.record.measured],
    ['cursor_step',[['ACTION3',-1]],[cursor.pre.plan.before[0],4]]);
  ticket(reprise.pre,a2);
  ticket(next.pre,a2,1);
  ticket(newFocus.pre,a3,2);
  assert.deepEqual(reprise.pre.plan.path,['ACTION2','ACTION2','ACTION3','ACTION2','ACTION3','ACTION1','ACTION1']);
  assert.deepEqual([inverse.after.ref,cursor.after.ref].map(ref=>reprise.pre.evidence.includes(ref)),[true,true]);
  for(const s of n.slice(9,16)){
    assert.equal(s.after.matched,true);
    assert.deepEqual(s.pre.plan.path,reprise.pre.plan.path);
  }
  assert.deepEqual(newFocus.pre.plan.expected,[newFocus.pre.plan.before[0],3]);
  assert.equal(n.at(-1).after.levels,0);
  await writeFile(values.recu,JSON.stringify({versions:versionsDuRecu(),prefixes:6,historical:old,native:r},null,2)+'\n');
  console.log('TR87 95 · six préfixes. Types, opération expérimentale et effets de réécriture vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
