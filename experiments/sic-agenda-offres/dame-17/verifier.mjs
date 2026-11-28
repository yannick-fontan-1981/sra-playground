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


const guard={admitted:true,reason:'current_population_selection_and_lattice'};
function ticket(p,command,mode,index=0){
  assert.deepEqual([p.family,p.kind,p.bundle,p.command,p.index,p.plan.mode,p.guard],
    ['invited_reduction','invited_population_reduction','OP18',command,index,mode,guard]);
  if(index===0)assert.deepEqual(p.scope,{live:guard,stale:{...guard,admitted:false}});
}
const position=v=>v.slice(0,2),positions=s=>s.population.map(position);
const same=(a,b)=>digest(a)===digest(b);
try{
  const old=await withEngine('historique',engine=>replay(engine,'nominal'));
  const r=await withEngine('gel',async e=>({...await group(e,['nominal','sans-invitation']),
    ...await group(e,['une-invitation','victime-preservee'])}));
  const n=r.nominal.steps,[a,b,c,,e,,g,h,i]=n;
  assert.equal(n.length,16);
  assert.deepEqual(trajectory(old.steps),trajectory(n));
  ticket(a.pre,click(31,19),'select');
  const first=a.after.record,firstEvent=first.result.events[0],initial=a.pre.cut.pre.scene;
  assert.deepEqual([initial.pitch,initial.origin,positions(initial),a.pre.plan.focusAfter],
    [7,[14,16],[[1,1],[1,3],[2,0],[2,2],[3,1]],[2,0]]);
  assert.deepEqual(initial.population,first.after.population);
  assert.deepEqual([firstEvent.kind,firstEvent.evidence,firstEvent.invitations,first.state.relations,a.after.levels],
    ['current_selection_domain',a.after.ref,[[0,2],[4,2]],{},0]);
  ticket(b.pre,click(17,33),'probe');
  assert.deepEqual([b.pre.plan.focusBefore,b.pre.plan.focusAfter,b.pre.plan.expected,b.after.matched,b.after.seal],
    [[2,0],[0,2],null,null,true]);
  assert.ok(b.pre.evidence.includes(a.after.ref));
  const reduced=b.after.record,result=reduced.result.events[0];
  assert.deepEqual([result.kind,result.relation,result.evidence],['observed_consumed_intermediate',[[-1,1],[-2,2]],b.after.ref]);
  const before=reduced.before.population,after=reduced.after.population;
  assert.deepEqual(before.filter(x=>!positions(reduced.after).some(p=>same(p,position(x)))).map(position),[[1,1],[2,0]]);
  assert.deepEqual(after.find(x=>same(position(x),[0,2])).slice(2),before.find(x=>same(position(x),[2,0])).slice(2));
  assert.equal(before.length-after.length,1);

  const single=r['une-invitation'],empty=r['sans-invitation'];
  for(const contrast of [single,empty]){
    const s=contrast.steps[0],observed=s.after.record;
    assert.deepEqual(s.pre,a.pre);
    assert.equal(s.after.packet,a.after.packet);
    assert.deepEqual(observed.after.population,initial.population);
    assert.deepEqual(observed.state.relations,{});
  }
  assert.deepEqual(single.change.invitations.map(v=>v.cell),[[0,2]]);
  assert.deepEqual(single.steps[0].after.record.state.invites,[[4,2]]);
  ticket(single.next,click(45,33),'probe');
  assert.deepEqual(empty.change.invitations.map(v=>v.cell),[[0,2],[4,2]]);
  assert.deepEqual([empty.steps[0].after.record.state.invites,empty.steps[0].after.record.state.focus],[[],null]);
  ticket(empty.next,click(24,26),'select');

  const control=r['victime-preservee'],held=control.steps[1].after;
  assert.deepEqual(control.steps[0],a);
  assert.deepEqual(control.steps[1].pre,b.pre);
  assert.equal(held.packet,b.after.packet);
  assert.notEqual(held.presented,held.physical);
  assert.deepEqual(control.change.victim.cell,[1,1]);
  assert.deepEqual(held.record.after.population,[...after,before[0]].sort((u,v)=>u[0]-v[0]||u[1]-v[1]));
  assert.deepEqual([held.record.result.events,held.record.state.relations],[[],{}]);
  ticket(control.next,click(24,26),'select');

  ticket(c.pre,click(31,47),'capture');
  assert.equal(c.pre.plan.states,8);
  assert.deepEqual(c.pre.plan.expected.map(position),[[2,2],[2,4],[3,1]]);
  assert.ok(c.pre.evidence.includes(b.after.ref));
  assert.deepEqual([c.after.matched,c.after.seal],[true,false]);
  assert.equal(e.after.record.result.events[0].kind,'observed_consumed_intermediate');
  assert.deepEqual([g.after.record.result.events[0].kind,g.after.levels],['reduction_official_boundary',1]);
  ticket(h.pre,click(28,16),'select');
  ticket(i.pre,click(14,30),'capture',1);
  assert.deepEqual([h.pre.cut.pre.scene.population.length,h.pre.plan.states,h.pre.plan.steps.length,i.after.matched],
    [7,33,8,true]);
  assert.deepEqual([n[14].after.record.result.events[0].kind,n[14].after.levels],['reduction_official_boundary',2]);
  await writeFile(values.recu,JSON.stringify({versions:versionsDuRecu(),prefixes:5,historical:old,native:r},null,2)+'\n');
  console.log('DAME 17 · cinq préfixes. Invitation, transaction de réduction et reprise vérifiées.');
}finally{await rm(tmp,{recursive:true,force:true});}
