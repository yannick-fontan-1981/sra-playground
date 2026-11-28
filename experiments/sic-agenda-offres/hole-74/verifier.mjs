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


const guard={admitted:true,reason:'current_partition_topology_and_exact_point'};
function ticket(p,command,mode,region,pockets,target){
  assert.deepEqual([p.family,p.kind,p.plan.slot,p.bundle,p.command,p.plan.offer.mode,p.guard],
    ['public_topological_recolor','public_topological_recolor','topological_recolor','OP18',command,mode,guard]);
  assert.deepEqual(p.scope,{live:guard,stale:{admitted:false,reason:'scope_changed'}});
  const b=p.plan.offer.body;
  assert.deepEqual([b.box,b.pockets,b.target,b.ref],[region,pockets,target,p.ref]);
}
const select='select_pigment',paint='paint_region',first=[12,8,24,20],second=[36,8,51,15],third=[20,32,31,43];
const palette={'0':9,'1':10};
try{
  const old=await withEngine('historique',engine=>replay(engine,'nominal'));
  const r=await withEngine('gel',async e=>({...await group(e,['nominal','poche-ouverte']),
    ...await group(e,['stationnaire','exterieur'])}));
  const n=r.nominal.steps,[,,,,,a,b,c,d,e,,,,,,f]=n;
  assert.equal(n.length,16);
  assert.deepEqual(trajectory(old.steps),trajectory(n));
  ticket(a.pre,click(22,59),select,first,0,9);
  const input=a.pre.cut.pre;
  assert.deepEqual([input.measurement.active,input.measurement.mapping,input.state.selection],[14,palette,[]]);
  assert.deepEqual(input.offers.map(x=>[x.mode,x.body.box,x.body.pockets,x.body.target]),
    [[select,first,0,9],[select,second,1,10],[select,third,0,9]]);
  assert.deepEqual([a.after.matched,a.after.seal,a.after.record.result.status,a.after.record.result.changed_count],
    [null,true,'selection_observed',44]);
  assert.equal(a.after.record.result.comparison.outside_count,0);
  assert.deepEqual(a.after.record.state.selection[0].evidence,[a.pre.ref,a.after.ref]);
  assert.equal(a.after.record.state.writes.length,0);
  for(const [s,command,region,count] of [[b,click(18,14),first,133],[c,click(20,32),third,95]]){
    ticket(s.pre,command,paint,region,0,9);
    assert.deepEqual(s.pre.plan.offer.method.source_evidence,[a.pre.ref,a.after.ref]);
    assert.equal(s.pre.plan.offer.method.current_observation_ref,s.pre.ref);
    const record=s.after.record;
    const {count:pixels,pigment,within,only,outside}=record.state.writes.at(-1);
    assert.deepEqual([record.result.status,pixels,pigment,within,only,outside,s.after.levels],
      ['write_effect_observed',count,9,true,true,0,0]);
  }
  ticket(d.pre,click(40,59),select,second,1,10);
  ticket(e.pre,click(43,11),paint,second,1,10);
  assert.deepEqual([e.after.record.result.status,e.after.matched,e.after.levels],['boundary',null,1]);

  const contrast=r['poche-ouverte'],x=contrast.steps[5],y=contrast.next;
  assert.deepEqual(contrast.steps.slice(0,4),n.slice(0,4));
  assert.deepEqual(contrast.steps.slice(4).map(s=>s.after.packet),n.slice(4,7).map(s=>s.after.packet));
  assert.deepEqual(contrast.change.point,[36,11]);
  assert.deepEqual([contrast.change.old.pockets,contrast.change.old.target,contrast.change.new.pockets,contrast.change.new.target],
    [1,10,0,9]);
  assert.deepEqual(x.pre.cut.pre.measurement.mapping,palette);
  assert.deepEqual(x.pre.cut.pre.offers.map(o=>[o.mode,o.body.box,o.body.pockets,o.body.target]),
    [[select,first,0,9],[select,second,0,9],[select,third,0,9]]);
  ticket(x.pre,click(22,59),select,first,0,9);
  ticket(y,click(43,11),paint,second,0,9);
  assert.equal(y.cut.pre.measurement.active,9);

  for(const [variant,outside,pixels,next] of [['stationnaire',0,0,click(40,59)],['exterieur',1,45,click(22,59)]]){
    const s=r[variant].steps[5],after=s.after.record.result;
    assert.deepEqual(s.pre,a.pre);
    assert.equal(s.after.packet,a.after.packet);
    assert.notEqual(s.after.presented,s.after.physical);
    assert.deepEqual([after.status,after.comparison.outside_count,after.changed_count,s.after.record.state.selection],
      ['unknown_or_no_visible_effect',outside,pixels,[]]);
    assert.deepEqual(r[variant].next.command,next);
    assert.equal(r[variant].next.plan.offer.mode,select);
  }

  ticket(f.pre,click(43,7),paint,[36,4,51,11],1,14);
  assert.deepEqual([f.pre.plan.offer.method.source_epoch,f.pre.plan.offer.method.current_epoch,
    f.pre.cut.pre.measurement.mapping,f.after.record.state.writes.at(-1).count],[1,2,{'0':9,'1':14,'2':11},89]);
  await writeFile(values.recu,JSON.stringify({versions:versionsDuRecu(),prefixes:5,historical:old,native:r},null,2)+'\n');
  console.log('HOLE 74 · cinq préfixes. Poches, choix du pigment, preuve de sélection et recolorations vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
