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
const tmp=await mkdtemp(join(tmpdir(),'catl-50-')),out=join(tmp,'prefixe.json');
const variants={nominal:['nominal'],stationnaire:['stationnaire'],'permutation-1':['permute','--tour','1','--echanges','0,1'],
  'permutation-9':['permute','--tour','9','--echanges','0,2'],'sans-controles-retenus':['sans-controles-retenus'],
  'sans-reutilisation':['sans-reutilisation']};
const live={admitted:true,reason:'current_labeled_query_and_button_bound'},stale={admitted:false,reason:'labeled_context_or_payload_changed'};
const click=(x,y=52)=>['ACTION6',{x,y}];
const count=[{kind:'NOT',feature:'COUNT:8',comparator:'EQ',value:0},{kind:'ATOM',feature:'COUNT:8',comparator:'GE',value:1}];
const endpoint=[{kind:'NOT',feature:'ENDPOINT_EQUAL',comparator:'EQ',value:false},
  {kind:'ATOM',feature:'ENDPOINT_EQUAL',comparator:'EQ',value:true}];
const queryValue=(inference,feature)=>inference.query.find(([id])=>id===feature)[1];
function ticket(p,label,tests){
  const x=label===15?43:56;
  assert.deepEqual([p.family,p.slot,p.kind,p.bundle,p.command,p.guard,p.plan.label,p.plan.step.point_binding.point],
    ['public_occurrence_recall','labeled_sequence_composition','labeled_sequence_experiment','OP18',click(x),live,label,[x,52]]);
  assert.deepEqual(p.scope,{live,stale});
  assert.equal(p.plan.step.expected_after,null);
  const infer=p.plan.inference;
  assert.deepEqual([infer.status,infer.complete,infer.predictions,infer.agreement,infer.modelUnique,infer.release,infer.created],
    ['COMPLETE',true,[String(label)],true,false,false,false]);
  assert.deepEqual(infer.tests,tests);
  assert.equal(infer.native,null);
  assert.equal(infer.training.refs.length,20);
  assert.deepEqual(p.evidence,[p.ref,p.cut.pre.examples.context]);
}
function returned(s,status,progress){
  const r=s.after.record;
  assert.deepEqual([s.after.matched,s.after.seal,s.after.reason],
    [null,true,'classification_response_and_next_query_require_reconciliation']);
  assert.deepEqual([r.before_ref,r.after_ref,r.query,r.label,r.physical_receipt_status,r.official_progress,r.law_uniqueness_claimed],
    [s.pre.ref,s.after.ref,s.pre.cut.pre.examples.query.values,s.pre.plan.label,status,progress,false]);
  assert.deepEqual(r.cache,s.pre.plan.inference.training);
}
function sameInput(a,b){
  assert.deepEqual([a.ref,a.epoch,a.input,a.available,a.syntax,a.recent],[b.ref,b.epoch,b.input,b.available,b.syntax,b.recent]);
}
async function replay(engine,key){
  execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',...variants[key],'--recu',out],
    {stdio:['ignore','ignore','inherit']});
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut].filter(Boolean))assert.equal(digest(cut.pre),cut.seal);
  return r;
}

try{
  const h=await withEngine('historique',engine=>replay(engine,'nominal'));
  const g=await withEngine('gel',async engine=>{
    const runs={};
    for(const key of Object.keys(variants))runs[key]=await replay(engine,key);
    return runs;
  });
  assert.deepEqual(h,g.nominal);
  const n=g.nominal.steps,[a,b]=n,ep=n[8],ac=a.pre.cut.pre,bc=b.pre.cut.pre;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.ok(n.every(s=>s.pre.slot==='labeled_sequence_composition'&&s.after.matched===null&&s.after.seal));
  assert.deepEqual(n.filter(s=>s.after.record.official_progress).map(s=>s.i),[8,16]);

  ticket(a.pre,15,count);
  assert.deepEqual(ac.examples.query.values,[8,9,9,9]);
  assert.deepEqual(ac.examples.examples.map(e=>[e.label,e.words.length]),[[15,10],[12,10]]);
  assert.ok(ac.examples.examples[0].words.every(w=>w.includes(8)));
  assert.ok(ac.examples.examples[1].words.every(w=>!w.includes(8)));
  assert.deepEqual([ac.used,a.pre.plan.inference.reused,a.pre.plan.inference.examined],[null,false,3844]);
  returned(a,'changed_public_context',false);

  ticket(b.pre,12,count);
  assert.deepEqual(bc.examples.query.values,[9,11,9,9,11]);
  assert.equal(b.pre.ref,a.after.ref);
  assert.deepEqual(bc.used,a.after.record.cache);
  assert.equal(b.pre.plan.inference.reused,true);
  assert.deepEqual(b.pre.plan.inference.training,a.pre.plan.inference.training);
  returned(b,'changed_public_context',false);
  returned(n[7],'official_boundary',true);

  ticket(ep.pre,12,endpoint);
  const ec=ep.pre.cut.pre;
  assert.deepEqual(ec.examples.query.values,[9,8,11,11,11]);
  assert.ok(ec.examples.examples[0].words.every(w=>w[0]===w.at(-1)));
  assert.ok(ec.examples.examples[1].words.every(w=>w[0]!==w.at(-1)));
  assert.deepEqual([ep.pre.plan.inference.reused,ep.pre.plan.inference.examined],[false,3684]);
  assert.equal(ec.used,null);
  assert.notEqual(ec.examples.context,ac.examples.context);
  returned(ep,'changed_public_context',false);

  const p=g['permutation-1'],pc=p.next.cut.pre;
  assert.deepEqual(p.steps,[]);
  assert.deepEqual(p.contrast.base,ac.examples);
  assert.deepEqual(p.contrast.used,pc.examples);
  assert.notEqual(pc.input,ac.input);
  assert.deepEqual(pc.available,ac.available);
  assert.deepEqual(pc.examples.query.values,[9,8,9,9]);
  ticket(p.next,15,count);
  assert.equal(queryValue(p.next.plan.inference,'COUNT:8'),queryValue(a.pre.plan.inference,'COUNT:8'));

  const q=g['permutation-9'],qc=q.next.cut.pre;
  assert.deepEqual(q.steps.slice(0,7),n.slice(0,7));
  assert.deepEqual(q.steps[7].pre,n[7].pre);
  assert.equal(q.steps[7].after.packet,n[7].after.packet);
  assert.notEqual(q.steps[7].after.presented,n[7].after.physical);
  assert.deepEqual(q.contrast.base,ec.examples);
  assert.deepEqual(q.contrast.used,qc.examples);
  assert.deepEqual(qc.available,ec.available);
  assert.deepEqual(qc.examples.query.values,[11,8,9,11,11]);
  ticket(q.next,15,endpoint);
  assert.deepEqual([queryValue(ep.pre.plan.inference,'ENDPOINT_EQUAL'),queryValue(q.next.plan.inference,'ENDPOINT_EQUAL')],[false,true]);
  assert.equal(queryValue(ep.pre.plan.inference,'COUNT:8'),queryValue(q.next.plan.inference,'COUNT:8'));

  const still=g.stationnaire,station=still.steps[0];
  assert.deepEqual(station.pre,a.pre);
  assert.equal(station.after.packet,a.after.packet);
  assert.notEqual(station.after.physical,station.after.presented);
  returned(station,'unchanged_public_context',false);
  assert.deepEqual([still.next.family,still.next.command,still.next.cut.result],
    ['observed_frontier',click(10,11),{status:'abstained',reason:'identical_labeled_submission_context_already_observed'}]);

  const without=g['sans-controles-retenus'],wp=without.steps[1].pre,wc=wp.cut.pre;
  assert.deepEqual(without.steps[0],a);
  sameInput(bc,wc);
  assert.deepEqual(wc.used,{...bc.used,controls:[]});
  assert.equal(wc.examples,null);
  assert.deepEqual([wp.family,wp.command,wp.cut.result],
    ['observed_frontier',click(10,11),{status:'abstained',reason:'no_recurrent_line_question'}]);

  const again=g['sans-reutilisation'],fresh=again.steps[1].pre,fc=fresh.cut.pre;
  assert.deepEqual(again.steps[0],a);
  sameInput(bc,fc);
  assert.deepEqual(fc.used,{...bc.used,context:bc.used.context+':recompute'});
  assert.deepEqual(fc.examples,bc.examples);
  ticket(fresh,12,count);
  assert.equal(fresh.plan.inference.reused,false);
  assert.equal(fresh.plan.inference.training.featuresHash,b.pre.plan.inference.training.featuresHash);
  assert.notEqual(fresh.plan.inference.training.hash,b.pre.plan.inference.training.hash);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:7,native:g},null,2)+'\n');
  console.log('CATL 50 · sept préfixes. Accord de prédicats, deux permutations, preuve de commande et retour distingués.');
}finally{await rm(tmp,{recursive:true,force:true});}
