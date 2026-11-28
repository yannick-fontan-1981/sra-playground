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
const tmp=await mkdtemp(join(tmpdir(),'pipe-60-'));
const variants={nominal:['nominal'],stationnaire:['stationnaire','--tour','1'],autre:['autre-port','--tour','1'],
  methode:['sans-methode','--tour','2'],exterieur:['pixel-exterieur','--tour','14']};
const live={admitted:true,reason:'bound_observed_support_and_conditional_ports'},stale={admitted:false,reason:'port_context_or_payload_changed'};
const initial='initial_radial_interface_experiment',assembly='conditional_port_assembly',review='test_point_binding_of_recalled_rotation';
const click=(x,y)=>['ACTION6',{x,y}],refs=s=>[s.pre.ref,s.after.ref];
function ticket(p,command,why,index=0){
  assert.deepEqual([p.family,p.slot,p.kind,p.bundle,p.command,p.guard,p.plan.why,p.index],
    ['public_occurrence_recall','radial_port_composition','radial_port_composition','OP18',command,live,why,index]);
  if(index===0)assert.deepEqual(p.scope,{live,stale});
}
async function replay(engine,key){
  const out=join(tmp,key+'.json');
  await run(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',...variants[key],'--recu',out]);
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut].filter(Boolean))assert.equal(digest(cut.pre),cut.seal);
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
  const r=await withEngine('gel',async engine=>({...await group(engine,['nominal','stationnaire','autre']),
    ...await group(engine,['methode','exterieur'])}));
  assert.deepEqual(old,r.nominal);
  const n=r.nominal.steps,[a,b,,end,l2,next,,,,,,end2,l3,inside,resume]=n;
  assert.equal(n.length,16);
  assert.equal(r.nominal.stop,'session_action_budget');
  assert.ok(n.every(s=>s.pre.slot==='radial_port_composition'));
  ticket(a.pre,click(16,28),initial);
  const {pre,target}=a.pre.cut,centers=pre.scene.cells.map(c=>c.point);
  assert.deepEqual([pre.scene.origin,pre.scene.pitch,pre.scene.shape,centers[3],centers[6]],[[8,4],16,[3,3],[16,28],[16,44]]);
  assert.deepEqual(pre.links.joined,[[0,1,1,3],[1,1,2,3],[3,1,4,3],[4,1,5,3]]);
  assert.equal(pre.links.open.length,8);
  assert.deepEqual([target.turns,target.visited,a.pre.plan.searchNodes],[[0,0,0,1,0,1,1,0,1],7,7]);
  assert.deepEqual(target.links.open,[]);
  assert.equal(target.links.joined.length,centers.length-1);
  const connected=new Set([0]);
  for(const _ of centers)for(const [left,,right] of target.links.joined){
    if(connected.has(left)||connected.has(right)){connected.add(left);connected.add(right);}
  }
  assert.equal(connected.size,centers.length);
  assert.deepEqual([a.pre.plan.steps.length,a.pre.plan.sign,a.pre.plan.known,a.pre.plan.step.candidate_turns,a.pre.plan.step.ports_after],
    [1,0,false,[0,1,2,3],null]);
  const ret=a.after.record,rule=ret.event.rule;
  assert.deepEqual([a.after.matched,a.after.seal,ret.selected.index],[null,true,3]);
  assert.deepEqual([a.pre.plan.step.ports_before[3],ret.ports[3]],[[0,1],[1,2]]);
  assert.deepEqual(ret.links.joined,[...pre.links.joined.slice(0,3),[3,2,6,0],pre.links.joined[3]]);
  assert.deepEqual([rule.turn,rule.epoch,rule.evidence],[1,1,refs(a)]);
  assert.deepEqual(ret.ports.filter((_,i)=>i!==3),a.pre.plan.step.ports_before.filter((_,i)=>i!==3));
  ticket(b.pre,click(48,28),assembly);
  assert.deepEqual(b.pre.cut.pre.used.rule,rule);
  assert.deepEqual([b.pre.plan.steps.length,b.pre.plan.sign,b.pre.plan.known],[3,1,true]);
  assert.deepEqual([b.after.matched,b.after.seal,b.after.reason,b.after.record.actual.outside_changed_pixels],
    [true,true,'ports_matched_extra_pixels_unexplained',371]);

  const stationary=r.stationnaire.steps[0],other=r.autre.steps[0];
  for(const s of [stationary,other]){
    assert.deepEqual(s.pre,a.pre);
    assert.equal(s.after.packet,a.after.packet);
    assert.notEqual(s.after.presented,a.after.physical);
    assert.deepEqual([s.after.record.event.rule,s.after.record.event.refuted],[null,true]);
    assert.deepEqual(s.after.record.event.evidence,refs(s));
  }
  assert.equal(stationary.after.record.event.selection_observed,false);
  assert.deepEqual([r.stationnaire.next.family,r.stationnaire.next.command],['observed_frontier',['ACTION1',{}]]);
  assert.deepEqual(r.autre.changedPixel,{point:[36,12],cell:1,before:10,after:5});
  assert.equal(other.after.record.event.selection_observed,true);
  assert.deepEqual(other.after.record.ports[3],ret.ports[3]);
  assert.deepEqual(other.after.record.ports[1],[3]);

  const absent=r.methode,hidden=absent.next,mc=hidden.cut.pre,bc=b.pre.cut.pre;
  assert.deepEqual(absent.steps,[a]);
  assert.deepEqual(mc,{...bc,used:{...bc.used,rule:null}});
  ticket(hidden,click(48,28),initial);
  assert.deepEqual([hidden.plan.steps.length,hidden.plan.known,hidden.plan.step.ports_after],[1,false,null]);

  assert.deepEqual([end.after.levels,end.after.matched,end2.after.levels,end2.after.matched],[1,null,2,null]);
  for(const [s,prior,x,y] of [[l2,1,32,12],[l3,2,50,10]]){
    ticket(s.pre,click(x,y),review);
    assert.equal(s.pre.cut.pre.prior.rule.epoch,prior);
    assert.deepEqual([s.pre.plan.steps.length,s.pre.plan.known,s.after.matched,s.after.seal],[1,false,true,true]);
    assert.equal(s.after.record.event.rule.epoch,prior+1);
  }
  ticket(next.pre,click(32,12),assembly);
  assert.equal(next.pre.plan.steps.length,7);

  ticket(inside.pre,click(50,10),assembly);
  ticket(resume.pre,click(14,22),assembly,1);
  assert.deepEqual([inside.after.matched,inside.after.seal],[true,false]);
  assert.deepEqual(inside.pre.plan.steps,resume.pre.plan.steps);
  assert.deepEqual(inside.pre.plan.step.ports_after,resume.pre.plan.step.ports_before);
  const outside=r.exterieur,changed=outside.steps[13];
  assert.deepEqual(outside.steps.slice(0,13),n.slice(0,13));
  assert.deepEqual(changed.pre,inside.pre);
  assert.equal(changed.after.packet,inside.after.packet);
  assert.notEqual(changed.after.presented,inside.after.physical);
  assert.deepEqual(changed.after.record.ports,inside.pre.plan.step.ports_after);
  assert.deepEqual([changed.after.matched,changed.after.seal,changed.after.reason,changed.after.record.actual.outside_changed_pixels],
    [true,true,'ports_matched_extra_pixels_unexplained',1]);
  ticket(outside.next,click(14,22),assembly);
  assert.equal(outside.next.plan.steps.length,2);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:6,native:r},null,2)+'\n');
  console.log('PIPE 60 · six préfixes. Ports, effet local, revalidation et fermeture du préfixe vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
