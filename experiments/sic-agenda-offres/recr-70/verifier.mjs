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


const assign=click(35,54),engage=['ACTION5',{}];
const guard={admitted:true,reason:'actual_front_marker_current_queues_legend_buttons_and_exact_payload'};
function ticket(p,command,step,kind){
  assert.deepEqual([p.family,p.plan.slot,p.bundle,p.command,p.plan.local.step,p.plan.local.kind,p.index,p.guard],
    ['public_ordered_recruitment','ordered_recruitment','OP18',command,step,kind,0,guard]);
  assert.deepEqual(p.scope,{live:guard,stale:{admitted:false,reason:'scope_changed'}});
}
try{
  const old=await withEngine('historique',engine=>replay(engine,'nominal'));
  const r=await withEngine('gel',engine=>group(engine,['nominal','ordre-permute','sans-ajout']));
  const n=r.nominal.steps,[a,b,c,d,e,f,g,h,i]=n;
  assert.equal(n.length,16);
  assert.deepEqual(trajectory(old.steps),trajectory(n));
  assert.deepEqual([a.pre.family,a.pre.command,a.after.levels],['observed_frontier',engage,0]);
  const calibration=a.after.record.result.events[0];
  assert.deepEqual([calibration.kind,calibration.observed_pair,calibration.evidence],
    ['legend_direction_calibrated_by_actual_single_enemy_return',[2,0],[a.pre.ref,a.after.ref]]);
  assert.deepEqual([a.after.record.old.summary.queue,a.after.record.old.summary.enemy,
    a.after.record.after.summary.queue,a.after.record.after.summary.enemy],[[2,2],[0],[2,2],[]]);

  ticket(b.pre,assign,'assign','composition_question');
  const basis=b.pre.cut.pre,proposal=b.pre.plan.local;
  assert.deepEqual(basis.measurement.buttons.map(v=>[v.type,v.point]),[[2,[15,54]],[1,[25,54]],[0,[35,54]]]);
  assert.deepEqual([basis.measurement.summary,basis.offers.length,basis.search.visited,basis.search.truncated],
    [{room:0,phase:'RECRUIT',quota:1,queue:[2,2],enemy:[]},1,4,false]);
  assert.deepEqual([proposal.type,proposal.cost,proposal.survivors,proposal.refs,proposal.search.reused],
    [0,2,1,[[a.pre.ref,a.after.ref]],'measure_ordered_front_reduction_d']);
  assert.deepEqual(b.after.record.result.events.map(v=>v.kind),['one_current_occurrence_appended','conditional_plan_reconciled']);
  assert.deepEqual(b.after.record.after.summary,proposal.projected);
  assert.deepEqual(proposal.projected,{room:1,phase:'COMBAT',quota:null,queue:[2,2,0],enemy:[1,1]});
  assert.deepEqual(b.after.record.state.continuation.refs,[b.pre.ref,b.after.ref]);
  assert.equal(b.after.record.state.continuation.rest,1);
  ticket(c.pre,engage,'engage','continuation');
  assert.equal(c.pre.plan.local.search.status,'validated_suffix_retained_no_new_search');
  assert.deepEqual(c.pre.plan.trace.map(v=>v.outcome),['RIGHT','RIGHT','LEFT','LEFT']);
  assert.deepEqual([c.after.record.result.boundary,c.after.levels],[true,1]);

  for(const name of ['ordre-permute','sans-ajout']){
    const comparison=r[name],s=comparison.steps[1],after=s.after.record;
    assert.deepEqual(comparison.steps[0],a);
    assert.deepEqual(s.pre,b.pre);
    assert.equal(s.after.packet,b.after.packet);
    assert.notEqual(s.after.presented,s.after.physical);
    assert.equal(after.state.continuation,null);
    assert.equal(after.result.events.length,1);
    assert.equal(after.result.events[0].matched_context,false);
  }
  const swap=r['ordre-permute'];
  assert.deepEqual([swap.change.first.type,swap.change.second.type,swap.change.perSubject],[2,0,1]);
  assert.deepEqual(swap.change.next,{...swap.change.old,queue:[0,2,2]});
  assert.deepEqual(swap.next.cut.pre.measurement.summary,swap.change.next);
  ticket(swap.next,engage,'engage','composition_question');
  assert.deepEqual([swap.next.plan.local.survivors,swap.next.plan.trace.map(v=>v.outcome),swap.next.plan.trace[0].consumed_occurrence_refs],
    [3,['LEFT','LEFT'],['enemy:0']]);
  assert.deepEqual(c.pre.plan.trace[0].consumed_occurrence_refs,['ally:0']);
  const absent=r['sans-ajout'];
  assert.deepEqual(absent.steps[1].after.record.after.summary,basis.measurement.summary);
  assert.equal(absent.next.family,'observed_frontier');
  assert.equal(absent.next.plan,null);

  ticket(d.pre,engage,'engage','composition_question');
  assert.deepEqual([d.pre.plan.local.before.queue,d.pre.plan.local.before.enemy,d.pre.plan.local.search.visited,
    d.after.record.after.summary.queue,d.after.record.after.summary.quota],[[1,0,1],[2,2,1],22,[0,1],2]);
  ticket(e.pre,assign,'assign','continuation');
  ticket(f.pre,assign,'assign','continuation');
  ticket(g.pre,engage,'engage','continuation');
  ticket(h.pre,assign,'assign','continuation');
  ticket(i.pre,engage,'engage','continuation');
  assert.deepEqual([e.after.record.after.summary.queue,f.after.record.after.summary.queue,
    g.after.record.after.summary.queue,i.after.levels],[[0,1,0],[0,1,0,0],[0],2]);
  await writeFile(values.recu,JSON.stringify({versions:versionsDuRecu(),prefixes:4,historical:old,native:r},null,2)+'\n');
  console.log('RECR 70 · quatre préfixes. Ordre, conservation des sujets et reprise conditionnelle vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
