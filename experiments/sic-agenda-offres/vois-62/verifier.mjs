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

const roles=['public_occurrence_recall','observed_composition_services','reference_population','OP18'];
const live={admitted:true,reason:'current_population_and_reference_bound'};
const stale={admitted:false,reason:'population_or_reference_changed'};
const controls={ACTION1:[-1,0],ACTION2:[1,0],ACTION3:[0,-1],ACTION4:[0,1]};
const directional=(action)=>[action,{}];
function ticket(step,command,mode,index=0){
  const {pre:p}=step;
  assert.deepEqual([p.family,p.slot,p.kind,p.bundle],roles);
  assert.deepEqual([p.command,p.plan.mode,p.index,p.guard],[command,mode,index,live]);
  if(index===0)assert.deepEqual(p.scope,{live,stale});
}
try{
  const historical=await withEngine('historique',engine=>replay(engine,'nominal'));
  const r=await withEngine('gel',async engine=>({...await group(engine,['nominal','reference-retiree','reference-deplacee']),
    ...await group(engine,['stationnaire','reference-changee'])}));
  const s=r.nominal.steps,[a,b,,,,f,g,h,i,j,k,,,n,o,p]=s;
  assert.equal(s.length,16);
  assert.deepEqual(trajectory(historical.steps),trajectory(s));
  ticket(a,click(15,23),'select');
  ticket(b,directional('ACTION1'),'probe');
  const base=a.pre.cut.pre.scene, pair=[a.pre.ref,a.after.ref];
  assert.deepEqual([base.pitch,base.population,base.target,base.bodies.map(x=>x.cell)],[4,2,[[5,6,8],[5,7,14]],[[5,3],[5,10]]]);
  assert.deepEqual([a.pre.plan.chosen,a.pre.plan.expected,a.after.matched,a.after.seal],[[5,3],[null],null,true]);
  assert.deepEqual([a.after.record.event.pending,a.after.record.event.active,a.after.record.event.controls,a.after.record.event.color],
    [[5,3],null,{},'observed_samples_only_no_complete_law']);
  assert.deepEqual([a.after.record.event.detail.before,a.after.record.event.detail.after],pair);
  assert.deepEqual(b.after.record.event.controls.ACTION1,{delta:[-1,0],evidence:[b.pre.ref,b.after.ref]});
  assert.deepEqual([b.after.record.event.active,b.after.record.event.detail.V5_physical_step_matches],[[4,3],true]);

  const still=r.stationnaire;
  assert.deepEqual(still.steps.slice(0,1),[a]);
  assert.deepEqual(still.steps[1].pre,b.pre);
  assert.equal(still.steps[1].after.packet,b.after.packet);
  assert.deepEqual([still.steps[1].after.record.event.active,still.steps[1].after.record.event.pending,
    still.steps[1].after.record.event.controls,still.next.command],[null,[5,3],{},directional('ACTION1')]);

  for(const [step,index] of [[f,0],[g,1],[h,2]]){
    ticket(step,directional('ACTION4'),'move',index);
    assert.deepEqual([step.after.matched,step.after.seal],[true,false]);
    assert.deepEqual(step.pre.plan.expected,[[5,4],[5,5],[5,6]]);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(f.pre.cut.pre.controls).map(([k,v])=>[k,v.delta])),controls);
  assert.deepEqual([f.pre.plan.assignment,f.pre.plan.complete,f.pre.cut.pre.domains],
    ['V5.maximum_injective_matching',true,[{cell:[5,3],reachable:[{goal:[5,6],steps:3},{goal:[5,7],steps:4}]},
      {cell:[5,10],reachable:[{goal:[5,6],steps:4},{goal:[5,7],steps:3}]}]]);
  assert.deepEqual(h.after.record.event.active,[5,6]);
  ticket(i,click(43,23),'select');
  ticket(j,directional('ACTION1'),'probe');
  ticket(k,directional('ACTION2'),'move');
  assert.deepEqual([n.after.matched,n.after.seal,n.after.levels],[null,true,1]);
  ticket(o,click(39,31),'select');
  assert.equal(o.pre.cut.pre.scene.population,4);
  assert.notEqual(o.pre.cut.pre.scene.digest,base.digest);
  assert.deepEqual([o.pre.cut.pre.retained,p.after.record.event.active,p.after.record.event.detail.V5_physical_step_matches],
    [null,[6,9],true]);

  const removed=r['reference-retiree'],missing=removed.cuts[0];
  assert.equal(missing.pre.scene,null);
  assert.deepEqual([missing.pre.surplus.population,missing.pre.surplus.target,missing.pre.surplus.bodies],
    [2,[[5,6,8]],base.bodies]);
  assert.deepEqual(missing.local,{status:'abstained',reason:null});
  assert.equal(removed.steps[0].pre.plan,null);
  const moved=r['reference-deplacee'],shifted=moved.steps[0].pre.cut.pre.scene;
  assert.deepEqual(moved.change,{from:[55,55],to:[55,59],color:8});
  assert.deepEqual([shifted.population,shifted.bodies,shifted.box,shifted.zone],[2,base.bodies,base.box,base.zone]);
  assert.deepEqual(shifted.target,[[5,7,14],[6,6,8]]);
  ticket(moved.steps[0],click(43,23),'select');

  const modified=r['reference-changee'],last=modified.steps[5],failed=modified.cuts.at(-1);
  assert.deepEqual(modified.steps.slice(0,5),s.slice(0,5));
  assert.deepEqual(last.pre,f.pre);
  assert.equal(last.after.packet,f.after.packet);
  assert.notEqual(last.after.presented,last.after.physical);
  assert.deepEqual([last.after.matched,last.after.seal],[false,true]);
  assert.deepEqual([failed.pre.retained.reference,failed.pre.scene,failed.local.status,failed.local.reason],
    [base.digest,null,'unknown','current_reference_population_revalidation_missing']);
  assert.equal(modified.next,null);

  await writeFile(values.recu,JSON.stringify({versions:versionsDuRecu(),prefixes:6,historical,native:r},null,2)+'\n');
  console.log('VOIS 62 · six préfixes. Référence, déplacement acquis et appariement consommé vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
