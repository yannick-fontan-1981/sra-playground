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
const tmp=await mkdtemp(join(tmpdir(),'rswp-55-'));
const variants={nominal:['nominal'],stationnaire:['stationnaire'],selection:['sans-selection','--tour','4'],
  effets:['sans-effets','--tour','8'],relation8:['sans-relation','--tour','8'],relation16:['sans-relation','--tour','16']};
const live={admitted:true,reason:'current_panel_service_bound'},stale={admitted:false,reason:'panel_service_binding_changed'};
const click=(x,y)=>['ACTION6',{x,y}],apply=['ACTION5',{}];
const direct='current_material_matches_local_receiver',rewrite='displayed_rewrite_prepares_local_receiver',
  remote='test_room_parameter_to_prepare_matching_receiver';
function ticket(p,kind,command,index=0){
  assert.deepEqual([p.family,p.slot,p.kind,p.bundle,p.plan.kind,p.command,p.guard,p.index],
    ['public_occurrence_recall','observed_composition_services','panel_service','OP18',kind,command,live,index]);
  if(index===0)assert.deepEqual(p.scope,{live,stale});
}
const material=panels=>panels.map(p=>p.material);
const reasons=plan=>plan.contributions.map(c=>c.reason);
const pixels=r=>r.physical.map(p=>[p.room.changed,p.panel.changed]);
const observable=cut=>[cut.ref,cut.epoch,cut.available,cut.hash,cut.fields,cut.prior];
async function replay(engine,key){
  const out=join(tmp,key+'.json');
  await run(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',...variants[key],'--recu',out]);
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut,r.lastCut].filter(Boolean))assert.equal(digest(cut.pre),cut.seal);
  return r;
}
async function group(engine,entries){
  const results=await Promise.allSettled(entries.map(key=>replay(engine,key)));
  return Object.fromEntries(results.map((value,i)=>{
    if(value.status==='rejected')throw value.reason;
    return [entries[i],value.value];
  }));
}

try{
  const old=await withEngine('historique',engine=>replay(engine,'nominal'));
  const r=await withEngine('gel',async engine=>({...await group(engine,['nominal','stationnaire','selection']),
    ...await group(engine,['effets','relation8','relation16'])}));
  assert.deepEqual(old,r.nominal);
  const n=r.nominal.steps,[a,b,c,d,,,g,h,,,k,l,,,o,p]=n,top=a.pre.plan.contributions[0].panel;
  assert.equal(n.length,16);
  assert.equal(r.nominal.stop,'session_action_budget');
  assert.ok(n.every(s=>s.pre.kind==='panel_service'));
  ticket(a.pre,'configuration',click(45,12));
  assert.deepEqual(a.pre.cut.pre.fields[0].room,[1,8,33,25]);
  assert.deepEqual(a.pre.cut.pre.fields[0].services,[{kind:'displayed_receiver',site:[28,16],input:13,output:null,point:[45,12]}]);
  assert.deepEqual(material(a.pre.plan.projection),[13,13,13]);
  assert.deepEqual(reasons(a.pre.plan),[direct,direct,direct]);
  assert.deepEqual([a.pre.plan.memory.confirmed,a.after.record.memory.confirmed],[false,true]);
  assert.deepEqual(pixels(a.after.record),[[0,32],[0,0],[0,0]]);
  assert.deepEqual([a.after.matched,a.after.record.detail.prediction_matched,a.after.levels],[true,true,0]);
  ticket(b.pre,'configuration',click(45,48));
  ticket(c.pre,'application',apply);
  assert.deepEqual([c.after.levels,c.after.record.detail.boundary,c.after.matched],[1,true,null]);

  ticket(d.pre,'configuration',click(45,17));
  assert.equal(d.pre.plan.commands.length,3);
  assert.deepEqual(reasons(d.pre.plan),[rewrite,rewrite,rewrite]);
  const no=r.selection,single=no.next,oc=single.cut.pre,dc=d.pre.cut.pre;
  assert.deepEqual(no.steps,n.slice(0,3));
  assert.deepEqual(observable(oc),observable(dc));
  assert.deepEqual(oc.used,{...dc.used,confirmed:false});
  ticket(single,'configuration',click(45,17));
  assert.deepEqual(single.plan.commands,[{action_ref:'ACTION6',data:{x:45,y:17}}]);

  ticket(g.pre,'application',apply);
  const ret=g.after.record;
  assert.deepEqual([g.after.matched,g.after.seal,g.after.levels,ret.detail.boundary,ret.detail.score_delta],[null,true,1,false,0]);
  assert.deepEqual(pixels(ret),Array(3).fill([21,120]));
  assert.deepEqual([material(ret.before),material(ret.after)],[[15,12,13],[12,13,15]]);
  assert.deepEqual(reasons(g.pre.plan),[rewrite,rewrite,rewrite]);
  ticket(h.pre,'configuration',click(45,12));
  assert.deepEqual(reasons(h.pre.plan),[direct,direct,direct]);
  assert.deepEqual(h.pre.cut.pre.fields,ret.after);
  assert.deepEqual(h.pre.plan.projection,ret.projected);
  assert.equal(h.pre.ref,ret.detail.after);
  assert.ok(h.pre.refs.includes(ret.detail.after));
  const clean=r.effets,ef=clean.next,hc=h.pre.cut.pre,ec=ef.cut.pre;
  assert.deepEqual(clean.steps,n.slice(0,7));
  assert.deepEqual(observable(ec),observable(hc));
  assert.deepEqual(ec.used,{...hc.used,effects:[]});
  ticket(ef,'configuration',click(45,12));
  assert.deepEqual(ef.plan,{...h.pre.plan,memory:{...h.pre.plan.memory,effects:[]}});

  ticket(k.pre,'application',apply);
  assert.deepEqual([k.after.record.detail.boundary,k.after.levels],[true,2]);
  ticket(l.pre,'configuration',click(60,22));
  assert.deepEqual(reasons(l.pre.plan),[remote,remote,remote]);
  ticket(o.pre,'application',apply);
  assert.deepEqual([o.after.matched,o.after.levels,o.after.record.detail.boundary],[null,2,false]);
  assert.deepEqual(pixels(o.after.record),Array(3).fill([21,88]));
  assert.deepEqual([material(o.after.record.before),material(o.after.record.after)],[[13,15,12],[13,15,12]]);
  assert.deepEqual(reasons(o.pre.plan),[remote,remote,remote]);
  ticket(p.pre,'configuration',click(45,12));
  assert.deepEqual(p.pre.cut.pre.fields,o.after.record.after);
  assert.deepEqual(reasons(p.pre.plan),[direct,direct,direct]);

  for(const [key,baseline,position,site,removed,value] of [['relation8',h,7,[28,16],[28,20,30,22],12],
    ['relation16',p,15,[28,49],[28,53,30,55],13]]){
    const lost=r[key],cut=lost.lastCut,mc=cut.pre,bc=baseline.pre.cut.pre;
    assert.deepEqual(lost.steps,n.slice(0,position));
    assert.deepEqual(observable(mc),observable(bc));
    assert.deepEqual(mc.changed,{panel:top,site,removed,value,background:5});
    assert.equal(mc.samePanels,true);
    assert.deepEqual(material(mc.usedFields),material(mc.fields));
    assert.deepEqual(mc.usedFields.slice(1),mc.fields.slice(1));
    assert.deepEqual(cut.result,{status:'unknown',reason:'panel_service_correspondence_unresolved',blocking:true,missing:[top]});
    assert.equal(lost.stop,'frontier_unknown');
    assert.equal(lost.next,null);
  }

  const still=r.stationnaire,station=still.steps[0];
  assert.deepEqual(station.pre,a.pre);
  assert.equal(station.after.packet,a.after.packet);
  assert.notEqual(station.after.presented,a.after.physical);
  assert.deepEqual([station.after.matched,station.after.record.memory.confirmed,station.after.record.memory.failed.length],[false,false,1]);
  assert.deepEqual(still.lastCut.result,{status:'unknown',reason:'panel_configuration_refused_in_context',blocking:true,missing:null});
  assert.equal(still.stop,'frontier_unknown');
  assert.equal(still.next,null);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:7,native:r},null,2)+'\n');
  console.log('RSWP 55 · sept préfixes. Sélection, effet dans les zones et remesure causale vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
