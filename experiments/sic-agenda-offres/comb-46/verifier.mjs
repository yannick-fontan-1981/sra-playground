import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {digest} from '../rejouer-service.mjs';
import {git,versions,withEngine} from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'comb-46-')),out=join(tmp,'prefixe.json');
const variants={nominal:[],'catalogue-incomplet':[],'sans-arete':['--tour','3'],stationnaire:[],
  multifactoriel:[],'petite-reserve':['--tour','7']};
const live={admitted:true,reason:'current_factor_point_and_values_bound'},no={admitted:false,reason:'factor_binding_or_payload_changed'};
const click=x=>['ACTION6',{x,y:20}];
const input=(a,b)=>assert.deepEqual([a.ref,a.input,a.actions,a.epoch,a.remaining,a.maxPrefix],[b.ref,b.input,b.actions,b.epoch,b.remaining,b.maxPrefix]);
const edge=(s,f,b,a)=>({factor:f,from:b[f],to:a[f],before:b,after:a,evidence:[s.pre.ref,s.after.ref]});
function ticket(p,x,i,b,a,known){
  assert.deepEqual([p.family,p.slot,p.kind,p.bundle,p.command,p.guard],
    ['public_occurrence_recall','product_panel_composition','factor_product_experiment','OP18',click(x),live]);
  if(p.index===0)assert.deepEqual(p.scope,{live,stale:no,wrongValues:no});
  const s=p.plan.step;
  assert.deepEqual([s.factor,s.before_values,s.after_values,s.relation_observed,s.point_binding.point],[i,b,a,known,[x,20]]);
  assert.equal(s.expected_after,null);
}
async function replay(engine,name){
  execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',name,...variants[name],'--recu',out],
    {stdio:['ignore','ignore','inherit']});
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut].filter(Boolean))assert.equal(digest(cut.pre),cut.seal);
  return r;
}

try{
  const h=await withEngine('historique',engine=>replay(engine,'nominal'));
  const g=await withEngine('gel',async engine=>{
    const runs={};
    for(const name of Object.keys(variants))runs[name]=await replay(engine,name);
    return runs;
  });
  assert.deepEqual(h,g.nominal);
  const n=g.nominal.steps,[a,b,c,l2,,lastControl,d,,e,f]=n;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.equal(n.filter(s=>s.pre.slot==='product_panel_composition').length,13);
  const ac=a.pre.cut.pre,bc=b.pre.cut.pre,cc=c.pre.cut.pre;
  assert.deepEqual(ac.scene.controls,[{point:[24,20],values:[4,9]},{point:[38,20],values:[4,8]}]);
  assert.deepEqual(ac.scene.catalogue,[[4,4],[9,4],[4,8],[9,8]]);
  assert.deepEqual(ac.unknown,[0,1]);
  assert.equal(ac.used,null);
  ticket(a.pre,24,0,[4,4],null,false);
  assert.equal(a.pre.plan.estimate,null);
  assert.deepEqual([a.after.matched,a.after.seal],[null,true]);
  const left=edge(a,0,[4,4],[9,4]),right=edge(b,1,[9,4],[9,8]);
  assert.deepEqual(a.after.record.state.edges,[left]);
  assert.deepEqual(bc.used.edges,[left]);
  assert.deepEqual(bc.unknown,[1]);
  ticket(b.pre,38,1,[9,4],null,false);
  assert.deepEqual(b.after.record.state.edges,[left,right]);
  assert.deepEqual(cc.unknown,[]);
  assert.deepEqual(cc.used.edges,[left,right]);
  ticket(c.pre,24,0,[9,8],[4,8],false);
  const co=c.pre.plan.estimate;
  assert.deepEqual([co.factors,co.indices,co.status,co.complete,co.examined,co.releases],
    [[['4','9'],['4','8']],[0],'COMPLETE',true,6,false]);
  assert.ok(co.assumptions.includes('local_effect_independence_remains_conditional'));
  assert.deepEqual([c.after.matched,c.after.seal,c.after.levels],[false,true,1]);
  assert.deepEqual(c.after.record.state.edges,[left,right]);
  assert.deepEqual(c.after.record.state.boundary,{before:c.pre.ref,after:c.after.ref,official_score:1,catalogue_goal_causal_status:'compatible_not_universal'});

  assert.deepEqual([l2.pre.plan.scene.catalogue.length,l2.pre.cut.pre.unknown],[8,[0,1,2]]);
  assert.equal(l2.pre.cut.pre.used,null);
  assert.equal(lastControl.pre.plan.step.factor,2);
  ticket(d.pre,31,1,[9,8,11],[9,4,11],false);
  assert.deepEqual(d.pre.plan.estimate.indices,[1,0,1,2]);
  assert.deepEqual([d.after.matched,d.after.seal],[true,true]);
  ticket(e.pre,31,1,[4,4,11],[4,8,11],true);
  ticket(f.pre,45,2,[4,8,11],[4,8,4],false);
  assert.equal(e.pre.index,0);
  assert.equal(f.pre.index,1);
  assert.deepEqual(e.pre.plan.steps,f.pre.plan.steps);
  assert.equal(e.pre.plan.steps.length,2);
  assert.deepEqual([e.after.matched,e.after.seal,f.after.matched,f.after.seal,f.after.levels],[true,false,false,true,2]);
  assert.equal(n[13].pre.cut.result.reason,'factor_product_has_no_supported_bounded_route');
  assert.equal(n[13].pre.cut.pre.remaining,3);
  assert.equal(n[13].pre.plan,null);

  const bad=g['catalogue-incomplet'].steps[0],xc=bad.pre.cut.pre;
  input(ac,xc);
  assert.deepEqual(xc.original,ac.scene);
  assert.deepEqual(xc.contrast,{factor:0,point:[15,47],before:[4,4],after:[9,4]});
  assert.equal(xc.scene,null);
  assert.deepEqual([bad.pre.family,bad.pre.command,bad.pre.plan],['containment',['ACTION1',{}],null]);
  assert.deepEqual(bad.after.record.state.edges,[]);
  assert.equal(bad.after.record.own,false);

  const removed=g['sans-arete'];
  assert.deepEqual(removed.steps,n.slice(0,2));
  const rc=removed.next.cut.pre;
  input(cc,rc);
  assert.deepEqual(rc.retained,cc.retained);
  assert.deepEqual(rc.scene,cc.scene);
  assert.deepEqual(rc.withheld,right);
  assert.deepEqual(rc.used,{...cc.used,edges:[left]});
  assert.deepEqual(rc.unknown,[1]);
  ticket(removed.next,38,1,[9,8],null,false);
  assert.equal(removed.next.plan.estimate,null);

  const same=g.stationnaire.steps[0],multi=g.multifactoriel.steps[0];
  for(const s of [same,multi]){
    assert.deepEqual(s.pre,a.pre);
    assert.equal(s.after.packet,a.after.packet);
    assert.notEqual(s.after.presented,a.after.physical);
    assert.deepEqual(s.after.record.state.edges,[]);
  }
  assert.deepEqual(same.after.record.state.visited,[[4,4]]);
  assert.deepEqual(same.after.record.state.counterexamples,[]);
  assert.deepEqual(multi.after.record.state.visited,[[4,4],[9,8]]);
  assert.deepEqual(multi.after.record.state.counterexamples,[{command:{action_ref:'ACTION6',data:{x:24,y:20}},
    changed_factors:[0,1],evidence:[multi.pre.ref,multi.after.ref]}]);
  ticket(g.stationnaire.next,24,0,[4,4],null,false);
  ticket(g.multifactoriel.next,24,0,[9,8],null,false);

  const low=g['petite-reserve'],lc=low.next.cut.pre,dc=d.pre.cut.pre;
  assert.deepEqual(low.steps,n.slice(0,6));
  input(dc,lc);
  assert.deepEqual(lc,{...dc,available:1});
  assert.deepEqual(low.next.cut.result,{status:'abstained',reason:'factor_product_has_no_supported_bounded_route'});
  assert.equal(low.next.plan,null);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:7,native:g},null,2)+'\n');
  console.log('COMB 46 · sept préfixes. Catalogue fini, arêtes attribuées, calcul conditionnel et garde de reprise vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
