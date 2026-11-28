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


const reason='bind_visible_inventory_selection_and_all_occupancies';
const guard={admitted:true,reason};
function ticket(step,command,operation,index=0){
  const {pre:p}=step;
  assert.deepEqual([p.family,p.kind,p.bundle,p.command,p.plan.op,p.index,p.guard],
    ['slot_substitution','ordered_slot_substitution','OP18',command,operation,index,guard]);
  if(index===0)assert.deepEqual(p.scope,{live:guard,stale:{admitted:false,reason}});
}
try{
  const old=await withEngine('historique',engine=>replay(engine,'nominal'));
  const r=await withEngine('gel',async e=>({...await group(e,['nominal','ordre-reference']),
    ...await group(e,['ordre-entrees','autre-contenu'])}));
  const n=r.nominal.steps;
  assert.equal(n.length,16);
  assert.deepEqual(trajectory(old.steps),trajectory(n));
  const [,,first,place,,resume,sibling,,,,,submit,,second,secondPlace]=n;
  const basis=first.pre.cut.pre,layout=basis.layout;
  assert.notEqual(n[0].pre.family,'slot_substitution');
  assert.notEqual(n[1].pre.family,'slot_substitution');
  ticket(first,click(35,58),'select');
  assert.deepEqual([layout.word,layout.hues,layout.group_count,layout.call_count],
    [[9,14,11,15],[14,15,9,11],1,0]);
  assert.deepEqual(layout.slots,[[22,29,23,30],[28,29,29,30],[34,29,35,30],[40,29,41,30]]);
  assert.deepEqual(basis.occupancy,[[true,true,true,true],[null,null,null,null],null]);
  assert.deepEqual([first.pre.plan.after,first.after.record.occupancy,first.after.record.known],
    [[[true,true,true,true],[null,null,null,null],2],[[true,true,true,true],[null,null,null,null],2],['select']]);
  assert.equal(first.after.record.result.ref,first.after.ref);
  ticket(place,click(22,29),'place');
  assert.equal(place.pre.evidence.includes(first.after.ref),true);
  assert.deepEqual(place.after.record.occupancy,[[true,true,false,true],[9,null,null,null],null]);
  assert.deepEqual(place.after.record.known,['place','select']);
  ticket(resume,click(19,58),'select');
  ticket(sibling,click(28,29),'place',1);
  assert.equal(resume.pre.plan.steps.length,7);
  assert.deepEqual(resume.pre.plan.steps,sibling.pre.plan.steps);
  assert.equal(resume.pre.evidence.includes(place.after.ref),true);
  assert.deepEqual([resume.after.matched,resume.after.seal],[true,false]);
  ticket(submit,['ACTION5',{}],'submit',6);
  assert.deepEqual([submit.pre.plan.before,submit.after.matched,submit.after.levels],
    [[[false,false,false,false],[9,14,11,15],null],null,1]);

  const shifted=r['ordre-reference'],changed=shifted.steps[2],order=changed.pre.cut.pre;
  assert.deepEqual(shifted.change.targetsAfter,[14,9,11,15]);
  assert.deepEqual(order.layout,{...layout,word:[14,9,11,15],targets:[14,9,11,15]});
  assert.deepEqual(order.occupancy,basis.occupancy);
  assert.deepEqual(shifted.steps.slice(0,2).map(s=>s.after.packet),n.slice(0,2).map(s=>s.after.packet));
  ticket(changed,click(19,58),'select');
  assert.deepEqual(shifted.next.plan.after,[[false,true,true,true],[14,null,null,null],null]);
  assert.deepEqual(shifted.next.command,place.pre.command);

  const permuted=r['ordre-entrees'];
  assert.deepEqual(permuted.steps,n.slice(0,3));
  assert.deepEqual(permuted.next,place.pre);

  const wrong=r['autre-contenu'],falsePlace=wrong.steps[3];
  assert.deepEqual(wrong.steps.slice(0,3),n.slice(0,3));
  assert.deepEqual(falsePlace.pre,place.pre);
  assert.equal(falsePlace.after.packet,place.after.packet);
  assert.notEqual(falsePlace.after.presented,falsePlace.after.physical);
  assert.deepEqual([falsePlace.after.matched,falsePlace.after.seal,falsePlace.after.record.status,
    falsePlace.after.record.known,falsePlace.after.record.occupancy],
    [false,true,'retired',['select'],[[true,true,false,true],[14,null,null,null],null]]);
  assert.ok(wrong.cuts.at(-1).pre.retired);
  assert.equal(wrong.cuts.at(-1).local,null);

  ticket(second,click(31,58),'select');
  ticket(secondPlace,click(22,22),'place');
  assert.deepEqual([second.pre.plan.layout.groups,second.pre.plan.layout.typed_references,second.pre.plan.layout.required_values],
    [2,1,[12,15,8,9,14,11,6]]);
  assert.deepEqual(second.pre.plan.layout.expanded_slot_order.map(b=>b[1]),[22,22,36,36,36,36,22]);
  assert.deepEqual(secondPlace.after.record.occupancy[1],[12,null,null,null,null,null,null]);
  await writeFile(values.recu,JSON.stringify({versions:versionsDuRecu(),prefixes:5,historical:old,native:r},null,2)+'\n');
  console.log('SB26 85 · cinq préfixes. Ordre, substitution et retour en contradiction vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
