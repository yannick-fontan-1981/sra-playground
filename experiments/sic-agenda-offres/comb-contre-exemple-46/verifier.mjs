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
const vendor=resolve(values.pyodide),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'comb-conflit-')),seedfile=join(tmp,'preuves.json');
const runWorker=promisify(execFile);
const variants=['contradiction-n1','contradiction-n2','locale','locale-contredite','ancienne','etrangere'];
const live={admitted:true,reason:'current_factor_point_and_values_bound'},click=x=>['ACTION6',{x,y:20}];
const physical=({pre:p,after:a})=>[p.ref,p.level,p.family,p.slot,p.kind,p.bundle,p.command,p.guard,p.plan,a.ref,a.matched,a.seal,a.reason,a.levels,a.packet];
function measure(q){return [q.ref,q.hash,q.available,q.geometry,q.epoch,q.values];}
async function replay(engine,mode){
  const out=join(tmp,mode+'.json');
  await runWorker(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',mode,'--amorce',seedfile,'--recu',out]);
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const s of r.steps)if(s.pre.cut)assert.equal(digest(s.pre.cut.pre),s.pre.cut.seal);
  return r;
}

async function replays(engine,modes){
  const results=await Promise.allSettled(modes.map(mode=>replay(engine,mode)));
  return results.map(result=>{
    if(result.status==='rejected')throw result.reason;
    return result.value;
  });
}

try{
  await writeFile(seedfile,'null');
  const candidate=await withEngine('candidat',async engine=>{
    const [n,c1,c2,ce]=await replays(engine,['nominal','capture-n1','capture-n2','capture-exacte']);
    const local=n.steps[9].after.record.edges.find(e=>e.factor===1&&e.before.toString()==='4,4,11');
    assert.ok(local);
    const seed={n1:c1.steps.at(-1).after.record,n2:c2.steps.at(-1).after.record,exact:ce.steps.at(-1).after.record,local};
    await writeFile(seedfile,JSON.stringify(seed));
    const runs={};
    for(let i=0;i<variants.length;i+=3){
      const group=variants.slice(i,i+3);
      const results=await replays(engine,group);
      for(const [index,mode] of group.entries())runs[mode]=results[index];
    }
    return {nominal:n,captures:{c1,c2,ce},seed,runs};
  });
  const gel=await withEngine('gel',async engine=>{
    const [nominal,n1,n2]=await replays(engine,['nominal','contradiction-n1','contradiction-n2']);
    return {nominal,n1,n2};
  });
  const n=candidate.nominal.steps,base=gel.nominal.steps,{seed,captures,runs}=candidate;
  assert.equal(n.length,16);
  assert.deepEqual(n.map(physical),base.map(physical));
  assert.equal(n.filter(s=>s.pre.slot==='product_panel_composition').length,13);
  const evidence=s=>[s.pre.ref,s.after.ref];
  for(const [c,i,inputs,outputs,x] of [[captures.c1,0,[4,4],[9,8],24],[captures.c2,4,[9,4,4],[4,8,4],31],
    [captures.ce,8,[4,4,11],[9,8,11],31]]){
    const s=c.steps[i],original=n[i];
    assert.deepEqual(s.pre,original.pre);
    assert.equal(s.after.packet,original.after.packet);
    assert.notEqual(s.after.physical,s.after.presented);
    const [counter]=s.after.record.counterexamples;
    assert.deepEqual(counter,{command:{action_ref:'ACTION6',data:{x,y:20}},before:inputs,after:outputs,changed_factors:[0,1],
      evidence:evidence(s)});
  }
  assert.deepEqual([seed.local.factor,seed.local.before,seed.local.after,seed.local.evidence],
    [1,[4,4,11],[4,8,11],evidence(n[8])]);

  const cases=[['contradiction-n1','n1',2,24,[4,8],false],['contradiction-n2','n2',8,31,[4,8,11],true]];
  for(const [mode,key,index,x,expected,seen] of cases){
    const original=n[index],old=gel[key].steps[index],next=runs[mode].steps[index],p=old.pre,q=next.pre,cut=q.cut.pre;
    assert.deepEqual(runs[mode].steps.slice(0,index),n.slice(0,index));
    assert.deepEqual(measure(cut),measure(original.pre.cut.pre));
    assert.deepEqual(measure(p.cut.pre),measure(cut));
    assert.deepEqual(cut.used.edges,original.pre.cut.pre.used.edges);
    assert.deepEqual(cut.used.counterexamples,seed[key].counterexamples);
    assert.deepEqual(cut.used,p.cut.pre.used);
    assert.deepEqual([p.command,p.plan.projected,p.plan.relation,p.guard],[click(x),expected,seen,live]);
    assert.ok(p.plan.compiled.length);
    assert.equal(old.after.packet,original.after.packet);
    assert.deepEqual(q.cut.result,{status:'abstained',reason:'factor_product_independence_refuted_in_current_scope'});
    assert.equal(q.plan,null);
    assert.equal(cut.configured,true);
  }

  const direct=runs.locale.steps[8],dp=direct.pre;
  assert.deepEqual(runs.locale.steps.slice(0,8),n.slice(0,8));
  assert.deepEqual(dp.plan.local,seed.local);
  assert.ok(seed.local.evidence.every(ref=>dp.refs.includes(ref)));
  assert.deepEqual([dp.command,dp.plan.compiled,dp.plan.commands.length,dp.plan.relation,dp.plan.projected,dp.guard],
    [click(31),null,1,true,[4,8,11],live]);
  assert.deepEqual([direct.after.packet,direct.after.matched,direct.after.seal],[n[8].after.packet,true,true]);
  assert.deepEqual(direct.after.record.local,[{factor:1,before:[4,4,11],evidence:evidence(direct)}]);
  assert.equal(runs.locale.steps[9].pre.index,0);
  for(const [mode,counter] of [['locale-contredite',seed.exact.counterexamples[0]],['ancienne',seed.n2.counterexamples[0]]]){
    const p=runs[mode].steps[8].pre;
    assert.deepEqual(measure(p.cut.pre),measure(dp.cut.pre));
    assert.deepEqual(p.cut.pre.used.edges,dp.cut.pre.used.edges);
    assert.deepEqual(p.cut.pre.used.counterexamples[0].evidence,counter.evidence);
    assert.equal(Object.hasOwn(p.cut.pre.used.counterexamples[0],'before'),mode==='locale-contredite');
    assert.equal(p.plan,null);
    assert.equal(p.cut.result.reason,'factor_product_independence_refuted_in_current_scope');
  }
  const other=runs.etrangere.steps[3],otherPre=other.pre.cut.pre;
  assert.deepEqual(runs.etrangere.steps.map(physical),n.slice(0,4).map(physical));
  assert.equal(otherPre.prior.epoch,1);
  assert.equal(otherPre.epoch,2);
  assert.equal(otherPre.used,null);

  await writeFile(values.recu,JSON.stringify({versions:{gel:versions.gel,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},
    candidate,gel},null,2)+'\n');
  console.log('COMB 46 · deux routes indépendantes écartées et réexécution locale vérifiée par le service.');
}finally{await rm(tmp,{recursive:true,force:true});}
