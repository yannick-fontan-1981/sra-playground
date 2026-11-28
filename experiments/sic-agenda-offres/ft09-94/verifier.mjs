import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {digest} from './operateur.mjs';
import {git,versions,withEngine} from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},hpdl:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'ft09-94-')),out=join(tmp,'prefixe.json');
const modes={'nominal':[],'une-fenetre':[],'sans-adresse':['--point','38,38'],'stationnaire':[],'un-seul-effet':[]};
const click=(x,y)=>['ACTION6',{x,y}];
function ticket(s,x,y,index=0){
  assert.deepEqual([s.pre.family,s.pre.entry,s.pre.kind,s.pre.bundle,s.pre.command,s.pre.index,s.pre.guard],
    ['window_constraints','multiscale_constraints','public_window_constraint','OP18',click(x,y),index,
      {admitted:true,reason:'current_constraint_and_point_bound'}]);
  assert.deepEqual(s.pre.plan.point,[x,y]);
}
async function replay(version,all){
  const runs={};
  await withEngine(version,async engine=>{
    for(const [mode,args]of Object.entries(modes)){
      if(!all&&mode!=='nominal')continue;
      execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',mode,...args,'--recu',out],
        {stdio:['ignore','ignore','inherit']});
      const r=JSON.parse(await readFile(out,'utf8'));
      for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut].filter(Boolean))assert.equal(digest(cut.pre),cut.seal);
      runs[mode]=r;
    }
  });
  return runs;
}
function paired(hp,s){
  const h=hp.temoin,t=h.pre,f=s.pre;
  assert.equal(t.bundle,f.bundle);
  assert.equal(t.command[0],f.command[0]);
  assert.deepEqual(t.point,[14,30]);
  assert.equal(t.guard.reason,'exact_current_geometry_method_and_payload');
  assert.equal(f.guard.reason,'current_constraint_and_point_bound');
  assert.equal(t.guard.admitted,true);
  assert.equal(f.guard.admitted,true);
  assert.deepEqual([h.after.matched,h.after.seal,s.after.matched,s.after.seal],[null,true,null,true]);
  return {hpdl:{ticket:t.ticket,ref:t.ref,bundle:t.bundle,point:t.point,guard:t.guard,refs:t.refs,question:t.plan.offer.kind,
      after:h.after.record.registered.events[0]},
    ft09:{ticket:f.ticket,ref:f.ref,bundle:f.bundle,point:f.plan.point,guard:f.guard,refs:f.refs,
      question:f.kind,after:s.after.record.result}};
}
try{
  const hpBytes=await readFile(resolve(values.hpdl)),hpHash=createHash('sha256').update(hpBytes).digest('hex');
  assert.equal(hpHash,'e46bf9bbb5d3dcea851b3e2aeb530b2fb7c966443b7bd4645fc319fb1ed606c8');
  const hp=JSON.parse(hpBytes);
  assert.equal(hp.versions.qualification,'66ce04946bccb531d5a6403ec36a5c2a90bf99a4');
  const h=await replay('historique',false),g=await replay('gel',true);
  assert.deepEqual(h.nominal,g.nominal);
  const n=g.nominal.steps,[a,b,c,d]=n,cut=a.pre.cut.pre;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.equal(n.filter(s=>s.pre.entry==='multiscale_constraints').length,4);
  ticket(a,38,38);
  assert.deepEqual(a.pre.scope.old,{admitted:false,reason:'projected_constraint_or_address_changed'});
  assert.deepEqual(cut.out.field.size,[6,6]);
  assert.deepEqual(cut.out.field.pitch,[8,8]);
  assert.deepEqual(cut.out.field.groups.flat().map(x=>x.origin),[[12,10],[46,10],[12,44],[44,44]]);
  assert.deepEqual(a.pre.plan.rule,{shape:[3,3],anchor:[1,1],orientation:0,roles:{'0':true,'2':false}});
  assert.deepEqual(a.pre.plan.fit,{method:'empirical_cross_window_alignment',fit:{window_count:4,holdout_correct:28,holdout_total:32,
    perfect_holdout_count:3,constant_baseline_correct:20},equivalent_alignments:1,initial_ref:a.pre.ref,prior_scoring_ref:null});
  assert.equal(cut.out.constraints,32);
  assert.equal(cut.out.violations.length,4);
  assert.deepEqual(cut.minimized.effects,[]);
  assert.deepEqual(a.pre.plan.selected,{p:[36,36],before:9,equal:[8],different:[],sources:[[44,44]],
    action:{action_ref:'ACTION6',data:{x:38,y:38}},expected_value:null});
  assert.deepEqual(a.pre.refs,[a.pre.ref,a.pre.ref]);
  assert.equal(a.pre.plan.prediction,null);
  assert.deepEqual([a.after.matched,a.after.seal],[null,true]);
  assert.deepEqual(a.after.record.result,{status:'local_rewrite_witness',address:[36,36],before:9,after:8,satisfies_frozen_constraint:true,
    constraint_refs:[[44,44]],changes_outside_bound_field:2,counterexample_retained:false});
  ticket(b,38,46);
  assert.equal(b.pre.plan.selected.expected_value,null);
  assert.equal(b.after.record.result.status,'local_rewrite_witness');
  assert.equal(b.after.record.result.after,8);
  const learned=[[9,[{point:'36,36',ref:a.after.ref,value:8},{point:'36,44',ref:b.after.ref,value:8}]]];
  ticket(c,38,54);
  assert.deepEqual(c.pre.cut.pre.minimized.effects,learned);
  assert.equal(c.pre.plan.selected.expected_value,8);
  assert.equal(c.pre.plan.selected_cells.length,2);
  assert.deepEqual([c.after.matched,c.after.seal],[true,false]);
  ticket(d,54,46,1);
  assert.deepEqual([d.after.matched,d.after.seal,d.after.levels,d.after.record.result.status],[null,true,1,'official_boundary_witness']);

  const limited=g['une-fenetre'].steps,l=limited[0];
  assert.equal(l.pre.ref,a.pre.ref);
  assert.deepEqual(l.pre.cut.pre.fields.before,cut.fields.before);
  assert.deepEqual(l.pre.cut.pre.fields.used.flatMap(f=>f.groups.flat()).map(x=>x.origin),[[12,10]]);
  assert.equal(l.pre.cut.pre.out,null);
  assert.equal(l.pre.cut.offered,null);
  assert.deepEqual([l.pre.family,l.pre.command],['observed_frontier',click(12,10)]);
  ticket(limited[1],38,38);

  const reordered=g['sans-adresse'].steps,r=reordered[0];
  assert.equal(r.pre.ref,a.pre.ref);
  assert.deepEqual(r.pre.cut.pre.out,cut.out);
  assert.deepEqual(r.pre.cut.pre.removed,[{action_ref:'ACTION6',data:{x:38,y:38}}]);
  ticket(r,38,46);
  assert.deepEqual(r.after.record.result.address,[36,44]);
  ticket(reordered[1],38,38);

  const still=g.stationnaire,st=still.steps[0];
  assert.deepEqual(st.pre,a.pre);
  assert.equal(st.after.packet,a.after.packet);
  assert.notEqual(st.after.presented,st.after.physical);
  assert.deepEqual(st.after.record.memory.effects,[]);
  assert.deepEqual(st.after.record.memory.rejected,['36,36,9']);
  assert.equal(st.after.record.result.status,'no_unique_local_rewrite');
  assert.deepEqual(still.next.command,click(38,46));

  const one=g['un-seul-effet'].steps,unbound=one[2];
  assert.deepEqual(one.slice(0,2),n.slice(0,2));
  ticket(unbound,38,54);
  assert.deepEqual(unbound.pre.cut.pre.minimized.effects,[[9,[learned[0][1][0]]]]);
  assert.deepEqual(unbound.pre.cut.pre.out,c.pre.cut.pre.out);
  assert.equal(unbound.pre.plan.selected.expected_value,null);
  assert.equal(unbound.pre.plan.selected_cells.length,1);
  assert.equal(unbound.after.packet,c.after.packet);
  assert.deepEqual([unbound.after.matched,unbound.after.seal],[null,true]);
  ticket(one[3],54,46);
  assert.equal(one[3].after.levels,1);

  const pair=paired(hp,a);
  assert.equal(git('rev-parse','HEAD:src'),git('rev-parse','d0e7527c:src'));
  const receipt={versions:{...versions,qualification:git('rev-parse','HEAD'),attendus:git('rev-parse','ae88904c'),
      hpdl:hp.versions.qualification,hpHash},prefixes:6,nominal:[a,b,c,d],relationLocale:pair,
    uneFenetre:limited.slice(0,2),sansAdresse:reordered.slice(0,2),stationnaire:still,unSeulEffet:one.slice(2),parite:digest(n)};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('FT09 94 · six préfixes. Fenêtres sources, liaison du point, deux observations de réécriture et comparaison HPDL vérifiées.');
}finally{await rm(tmp,{recursive:true,force:true});}
