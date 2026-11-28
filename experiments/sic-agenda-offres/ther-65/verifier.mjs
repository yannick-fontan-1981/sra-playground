import {verifyArchive} from './archive.mjs';
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

const live={admitted:true,reason:'current_rooted_composition_bound'};
const stale={admitted:false,reason:'rooted_context_or_predicted_prefix_changed'};
const add='discriminate_local_effect_from_rooted_prefix',cut='discriminate_truncation_from_repeated_toggle',compose='realize_conditional_joint_prefixes';
function ticket(step,command,phase,index=0){
  const {pre:p}=step;
  assert.deepEqual([p.family,p.slot,p.kind,p.bundle,p.command,p.plan.phase,p.index,p.guard],
    ['public_occurrence_recall','rooted_quota_composition','rooted_quota_experiment','OP18',command,phase,index,live]);
  if(index===0)assert.deepEqual(p.scope,{live,stale});
}
try{
  const historical=await withEngine('historique',engine=>replay(engine,'nominal'));
  const {native:r,archive}=await withEngine('gel',async engine=>({
    native:await group(engine,['nominal','stationnaire','soeur-modifiee']),archive:await verifyArchive(engine),
  }));
  const s=r.nominal.steps,[a,b,c,d,e]=s;
  assert.equal(s.length,16);
  assert.equal(historical.steps.length>=15,true);
  assert.deepEqual(trajectory(historical.steps.slice(0,15)),trajectory(s.slice(0,15)));
  const current=a.pre.cut.pre;
  ticket(a,click(21,21),add);
  assert.deepEqual([current.lengths,current.scene.rows,current.scene.columns,current.scene.chains[0].points],
    [[0,0,0],[0,1,3],[1,2,1],[[21,49],[21,35],[21,21]]]);
  assert.deepEqual([a.pre.plan.chain,a.pre.plan.rank,a.pre.plan.predicted,a.after.matched,a.after.seal],[0,2,null,null,true]);
  assert.deepEqual([a.after.record.event.context.lengths,a.after.record.event.context.owner_preserved,
    a.after.record.event.model.addition,a.after.record.event.model.cut],[[3,0,0],true,true,false]);
  assert.deepEqual(a.after.record.event.refs,[a.pre.ref,a.after.ref]);

  for(const [variant,stop,lengths,preserved] of [
    ['stationnaire','indexed_edit_response_not_supported',[0,0,0],true],
    ['soeur-modifiee','indexed_edit_owner_or_prefix_refuted',[3,1,0],false],
  ]){
    const response=r[variant],first=response.steps[0];
    assert.deepEqual(first.pre,a.pre);
    assert.equal(first.after.packet,a.after.packet);
    assert.notEqual(first.after.presented,first.after.physical);
    assert.deepEqual([first.after.record.event.context.lengths,first.after.record.event.context.owner_preserved,
      first.after.record.event.model.addition,first.after.record.event.model.cut,response.stop,response.next],
      [lengths,preserved,false,false,stop,null]);
  }
  ticket(b,click(21,35),cut);
  assert.deepEqual([b.pre.plan.chain,b.pre.plan.rank,b.pre.plan.predicted,b.after.record.event.context.lengths,
    b.after.record.event.model.addition,b.after.record.event.model.cut],[0,1,null,[1,0,0],true,true]);
  ticket(c,click(35,35),compose);
  assert.deepEqual([c.pre.plan.before,c.pre.plan.desired,c.pre.plan.predicted,c.after.matched,c.after.seal],
    [[1,0,0],[[1],[2],[1]],[1,2,0],true,false]);
  ticket(d,click(49,49),compose,1);
  assert.deepEqual([d.pre.plan.predicted,d.after.matched,d.after.seal,d.after.levels],[[1,2,1],null,true,1]);
  ticket(e,click(35,49),compose);
  assert.deepEqual([e.pre.plan.desired,e.after.matched],[[[4],[1],[1]],true]);

  const fifth=s[15],obs=fifth.pre.cut.pre;
  ticket(fifth,click(19,26),compose);
  assert.deepEqual(archive.nominal.marks,[obs.scene.rows,obs.scene.columns]);
  assert.deepEqual(archive.nominal.lengths,obs.lengths);
  assert.deepEqual(archive.nominal.domains,fifth.pre.plan.desired);
  assert.deepEqual(archive.nominal.actions[0],{action_ref:fifth.pre.command[0],data:fifth.pre.command[1]});
  assert.deepEqual([fifth.after.matched,fifth.after.levels,fifth.after.record.event.support],
    [true,4,'current_structural_mark_support_preserved']);

  await writeFile(values.recu,JSON.stringify({versions:versionsDuRecu(),prefixes:4,historical,native:r,archive},null,2)+'\n');
  console.log('THER 65 · quatre préfixes et un témoin V42. Mesure, propriété de l’effet et contrainte conjointe vérifiées.');
}finally{await rm(tmp,{recursive:true,force:true});}
