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


const guard={admitted:true,reason:'current_constraint_and_point_bound'};
function ticket(p,command,geometry,index=0){
  assert.deepEqual([p.family,p.kind,p.bundle,p.command,p.plan.rule.family,p.index,p.guard],
    ['regular_field_correspondence','public_symmetric_field','OP18',command,geometry,index,guard]);
  if(index===0)assert.deepEqual(p.scope,{live:guard,stale:{admitted:false,reason:'projected_constraint_or_address_changed'}});
}
try{
  const old=await withEngine('historique',engine=>replay(engine,'nominal'));
  const r=await withEngine('gel',async e=>({...await group(e,['nominal','retour-contraire','autre-reference']),
    ...await group(e,['ambigu','contraste-clair'])}));
  const n=r.nominal.steps,[a,b,,,e,f,,,i,j,k,l]=n;
  assert.equal(n.length,16);
  assert.deepEqual(trajectory(old.steps),trajectory(n));
  ticket(a.pre,click(7,35),'horizontal');
  const pre=a.pre.cut.pre;
  assert.deepEqual([pre.fields.length,pre.fields[0].size,pre.fields[0].cells],[1,[5,5],81]);
  assert.deepEqual(pre.hypotheses.map(x=>[x.family,x.counts.unchanged_pairs,x.counts.contrast_pairs]),
    [['horizontal',27,9]]);
  assert.deepEqual(a.pre.plan.cell,{p:[5,33],before:11,equal:[9],different:[],sources:[[53,33]],expected_value:null,
    action:{action_ref:'ACTION6',data:{x:7,y:35}}});
  const observed=a.after.record.result;
  assert.deepEqual([a.after.matched,a.after.seal,observed.status,observed.after,observed.satisfies_frozen_constraint,observed.constraint_refs],
    [null,true,'local_rewrite_witness',9,true,[[53,33]]]);
  ticket(b.pre,click(13,23),'horizontal');
  assert.deepEqual(b.pre.cut.pre.memory.tests,[['5,33',9]]);

  const split=r['autre-reference'];
  assert.deepEqual(split.change,{cell:[53,33],from:9,to:8});
  assert.deepEqual(split.cuts[0].pre.fields,pre.fields);
  ticket(split.next,click(7,35),'horizontal');
  assert.deepEqual(split.next.plan.cell,{...a.pre.plan.cell,equal:[8]});

  const contradicted=r['retour-contraire'],sameClick=contradicted.steps[0],reply=sameClick.after.record;
  assert.deepEqual(sameClick.pre,a.pre);
  assert.equal(sameClick.after.packet,a.after.packet);
  assert.notEqual(sameClick.after.presented,sameClick.after.physical);
  assert.deepEqual([reply.result.after,reply.result.satisfies_frozen_constraint,reply.result.counterexample_retained,
    reply.memory.tests,reply.memory.deactivated],[0,false,true,[],true]);
  assert.equal(contradicted.next.plan,null);
  assert.notEqual(contradicted.next.family,'regular_field_correspondence');

  const ambiguous=r.ambigu.cuts[0],resolved=r['contraste-clair'],certain=resolved.cuts[0].pre;
  assert.equal(r.ambigu.steps.length,0);
  assert.equal(resolved.steps.length,0);
  assert.deepEqual(ambiguous.pre.fields,certain.fields);
  assert.deepEqual(ambiguous.pre.hypotheses.map(h=>[h.family,h.counts.hypothetically_omitted_values,h.counts.contrast_pairs]),
    [['period:2:2',[8],2],['period:2:2',[9],2]]);
  const [x,y]=ambiguous.pre.hypotheses.map(h=>h.constraints);
  assert.ok(x.every(first=>y.every(second=>digest(first.cell)!==digest(second.cell))));
  assert.equal(ambiguous.local,null);
  assert.deepEqual(r.ambigu.next.command,click(13,13));
  assert.notEqual(r.ambigu.next.family,'regular_field_correspondence');
  ticket(resolved.next,click(13,13),'period:2:2');
  assert.deepEqual([certain.hypotheses.length,resolved.next.plan.cell.equal,resolved.next.plan.cell.sources,resolved.next.plan.predicted],
    [1,[9],[[12,32],[32,12],[32,32]],false]);

  assert.ok(n.slice(0,5).every(s=>s.pre.plan.predicted===false));
  assert.deepEqual([...new Set(e.after.record.memory.tests.map(([,value])=>value))],[9,8]);
  ticket(f.pre,click(37,53),'horizontal');
  assert.deepEqual([f.pre.plan.predicted,f.pre.plan.steps.length,f.after.matched,f.after.seal],[true,4,true,false]);
  assert.deepEqual([i.after.record.result.status,i.after.matched,i.after.levels],['official_boundary_witness',null,1]);
  ticket(j.pre,click(9,27),'vertical');
  ticket(k.pre,click(17,23),'vertical');
  ticket(l.pre,click(17,39),'vertical');
  assert.deepEqual([j.pre.plan.predicted,k.pre.plan.predicted,l.pre.plan.predicted,l.pre.plan.steps.length,l.after.matched],
    [false,false,true,5,true]);

  await writeFile(values.recu,JSON.stringify({versions:versionsDuRecu(),prefixes:6,historical:old,native:r},null,2)+'\n');
  console.log('SYME 78 · six préfixes. Correspondance, ambiguïté périodique et retours vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
