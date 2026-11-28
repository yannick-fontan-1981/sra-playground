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
const tmp=await mkdtemp(join(tmpdir(),'colm-59-'));
const variants={nominal:['nominal'],stationnaire:['stationnaire','--tour','1'],dupliquee:['trame-dupliquee','--tour','1'],
  'sans-reception':['sans-reception','--tour','3'],'translation-refutee':['stationnaire','--tour','6']};
const live={admitted:true,reason:'current_queue_composition_bound'},stale={admitted:false,reason:'queue_premise_or_payload_changed'};
const cmd=action=>[action,{}],refs=s=>[s.pre.ref,s.after.ref];
function ticket(p,action,mode='control_experiment',index=0){
  assert.deepEqual([p.family,p.slot,p.kind,p.bundle,p.command,p.guard,p.plan.mode,p.index],
    ['public_occurrence_recall','queued_field_composition','queued_field_experiment','OP18',cmd(action),live,mode,index]);
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
  const result=await Promise.allSettled(entries.map(key=>replay(engine,key)));
  return Object.fromEntries(result.map((value,i)=>{
    if(value.status==='rejected')throw value.reason;
    return [entries[i],value.value];
  }));
}

try{
  const old=await withEngine('historique',engine=>replay(engine,'nominal'));
  const g=await withEngine('gel',async engine=>({...await group(engine,['nominal','stationnaire','dupliquee']),
    ...await group(engine,['sans-reception','translation-refutee'])}));
  assert.deepEqual(old,g.nominal);
  const n=g.nominal.steps,[a,b,c,left,right,d,e]=n,pre=a.pre.cut.pre;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.ok(n.every(s=>s.pre.slot==='queued_field_composition'));
  ticket(a.pre,'ACTION1');
  assert.equal(pre.memory,null);
  assert.equal(a.pre.plan.prediction,null);
  assert.deepEqual(pre.scene.geometry,{origin:[3,3],shape:[6,7],size:[3,3],pitch:[5,5]});
  const r=a.after.record;
  assert.deepEqual([r.frames,r.settledEqual,r.placement,r.refs,r.before.mark.column,r.final.mark.column],
    [1,true,[],refs(a),3,3]);
  assert.deepEqual([r.before.mark.values,r.final.mark.values],[[8,11,8],[8,8,11]]);
  assert.deepEqual([r.event.last,r.event.controls.ACTION1.permutations,r.event.controls.ACTION1.evidence],
    ['single_public_preparation',[[0,2,1],[2,0,1]],refs(a)]);
  assert.deepEqual([a.after.matched,a.after.seal],[null,true]);
  ticket(b.pre,'ACTION1');
  assert.deepEqual(b.pre.plan.active.controls.ACTION1,r.event.controls.ACTION1);
  assert.deepEqual(b.after.record.event.controls.ACTION1.permutations,[[2,0,1]]);

  const stationary=g.stationnaire.steps[0],dup=g.dupliquee.steps[0];
  for(const s of [stationary,dup]){
    assert.deepEqual(s.pre,a.pre);
    assert.equal(s.after.packet,a.after.packet);
    assert.deepEqual(s.after.record.event.controls,{});
  }
  assert.deepEqual(stationary.after.record.before,stationary.after.record.final);
  ticket(g.stationnaire.next,'ACTION2');
  assert.equal(dup.after.presented,a.after.presented);
  assert.deepEqual(dup.after.record.final,r.final);
  assert.deepEqual([dup.after.record.frames,dup.after.record.event.last],[2,'unexplained_or_boundary']);
  ticket(g.dupliquee.next,'ACTION1');
  assert.deepEqual(g.dupliquee.next.plan.active.controls,{});

  ticket(c.pre,'ACTION2');
  const cr=c.after.record;
  assert.deepEqual([cr.frames,cr.placement.map(p=>[p.gravity,p.index]),cr.settledEqual],[9,[[1,1]],false]);
  assert.deepEqual([cr.before.mark.values,cr.final.mark.values],[[11,8,8],[14,8,14]]);
  assert.deepEqual([cr.event.controls.ACTION2.kind,cr.event.controls.ACTION2.phase_index,cr.event.gravity,cr.event.closure.length,
    cr.event.status,cr.event.preview],['receive',1,1,2,'compatible_public_closure_models',[[true,true],[true,false]]]);
  assert.deepEqual(cr.event.controls.ACTION2.evidence,refs(c));
  ticket(left.pre,'ACTION3');
  const continued=g['sans-reception'],lost=continued.steps[2],lc=lost.after.record;
  assert.deepEqual(continued.steps.slice(0,2),n.slice(0,2));
  assert.deepEqual(lost.pre,c.pre);
  assert.deepEqual([lost.after.packet,lost.after.presented],[c.after.packet,c.after.presented]);
  assert.deepEqual([continued.removed,lc.frames,lc.placement,lc.final],[[1],8,[],cr.final]);
  assert.deepEqual([lc.event.controls.ACTION2,lc.event.gravity,lc.event.closure,lc.event.last],
    [undefined,null,null,'unexplained_or_boundary']);
  ticket(continued.next,'ACTION2');

  assert.deepEqual([left.after.record.settledEqual,left.after.record.before.mark.column,left.after.record.final.mark.column,
    left.after.record.event.controls.ACTION3.delta],[true,3,2,-1]);
  assert.deepEqual([right.after.record.settledEqual,right.after.record.before.mark.column,right.after.record.final.mark.column,
    right.after.record.event.controls.ACTION4.delta],[true,2,3,1]);
  for(const s of [left,right]){
    const {before,final,event}=s.after.record;
    assert.deepEqual(final.mark.values,before.mark.values);
    assert.ok(before.mark.rows.every(y=>final.grid[y][before.mark.column]===event.empty));
  }
  ticket(d.pre,'ACTION3','prepare_and_receive');
  ticket(e.pre,'ACTION2','prepare_and_receive',1);
  assert.deepEqual(d.pre.plan.commands,[{action_ref:'ACTION3'},{action_ref:'ACTION2'}]);
  assert.deepEqual([d.after.matched,d.after.seal,e.after.matched,e.after.seal],[true,false,null,true]);
  assert.equal(d.pre.plan.estimate.models,2);
  const stopped=g['translation-refutee'],s=stopped.steps[5],sr=s.after.record;
  assert.deepEqual(stopped.steps.slice(0,5),n.slice(0,5));
  assert.deepEqual(s.pre,d.pre);
  assert.equal(s.after.packet,d.after.packet);
  assert.deepEqual([s.after.matched,s.after.seal,sr.event.refuted.length],[false,true,1]);
  assert.deepEqual(sr.event.refuted[0].evidence,refs(s));
  assert.deepEqual(sr.event.controls.ACTION3,left.after.record.event.controls.ACTION3);
  ticket(stopped.next,'ACTION2','prepare_and_receive');
  assert.equal(stopped.next.plan.column,3);

  assert.equal(n[14].after.levels,1);
  assert.equal(n[15].pre.plan.portable.current_epoch,2);
  assert.equal(n[15].pre.plan.portable.source_epoch,1);
  assert.deepEqual(n[15].after.record.placement.map(p=>[p.gravity,p.index]),[[1,1],[1,2]]);
  assert.equal(n[15].after.record.event.controls.ACTION2.revalidated_epoch,2);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:6,native:g},null,2)+'\n');
  console.log('COLM 59 · six préfixes. Préparation, réception et réfutation contextuelle vérifiées.');
}finally{await rm(tmp,{recursive:true,force:true});}
