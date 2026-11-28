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
const tmp=await mkdtemp(join(tmpdir(),'sele-51-'));
const variants={nominal:['nominal'],long:['long'],stationnaire:['stationnaire'],decoration:['decoration-contradictoire'],
  'sans-trames-4':['sans-trames','--tour','4'],'sans-trames-18':['sans-trames','--tour','18']};
const live={admitted:true,reason:'current_linked_experiment_bound'},stale={admitted:false,reason:'linked_context_or_command_changed'};
const click=(x,y)=>['ACTION6',{x,y}],move=a=>[a,{}];
function ticket(p,command,reason){
  assert.deepEqual([p.family,p.slot,p.kind,p.bundle,p.command,p.guard,p.plan.reason],
    ['public_occurrence_recall','linked_packet_composition','linked_packet_experiment','OP18',command,live,reason]);
  assert.deepEqual(p.scope,{live,stale});
  if(command[0]==='ACTION6')assert.deepEqual(p.plan.point.point,[command[1].x,command[1].y]);
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
  const r=await withEngine('gel',async engine=>({...await group(engine,['nominal','long','stationnaire']),
    ...await group(engine,['decoration','sans-trames-4','sans-trames-18'])}));
  assert.deepEqual(old,r.nominal);
  const n=r.nominal.steps,[a,,,first,contrast,,,finish,left,right,test,reselect]=n;
  assert.equal(n.length,16);
  assert.equal(r.nominal.stop,'session_action_budget');
  assert.ok(n.every(s=>s.pre.slot==='linked_packet_composition'&&s.after.matched===null&&s.after.seal));
  assert.equal(finish.after.levels,1);
  ticket(a.pre,click(32,52),'test_visible_remote_motif_binding');
  assert.deepEqual(a.pre.plan.target.point,[30,8]);
  assert.equal(a.pre.cut.pre.memory.state,null);
  const recipient=a.after.record.affected[0][0];
  assert.deepEqual(a.after.record.affected,[[recipient,[30,24]]]);
  assert.deepEqual(a.after.record.step.selection_witness,{kind:'single_cochanged_support'});
  assert.equal(a.after.record.state.bindings[a.pre.plan.control.ref].ref,recipient);
  assert.equal(a.after.record.packet.accepted,false);

  const still=r.stationnaire.steps[0],sc=r.stationnaire.next;
  assert.deepEqual(still.pre,a.pre);
  assert.equal(still.after.packet,a.after.packet);
  assert.notEqual(still.after.presented,a.after.physical);
  assert.deepEqual(still.after.record.state.bindings,{});
  assert.deepEqual(still.after.record.affected,[]);
  assert.equal(sc.cut.result.reason,'linked_selection_refuted_or_ambiguous_in_exact_context');
  assert.deepEqual([sc.family,sc.command],['observed_frontier',move('ACTION3')]);

  ticket(first.pre,move('ACTION5'),'identify_input_effect_on_selected_public_motif');
  const pkt=first.after.record.packet,{detail}=pkt;
  assert.deepEqual([pkt.count,pkt.accepted,detail.canonicalSame,detail.segments.length,detail.received.length],
    [16,true,true,2,1]);
  assert.deepEqual([detail.before,detail.after,detail.received[0].body_ref,detail.received[0].frame_interval,pkt.memory.launch],
    [first.pre.ref,first.after.ref,recipient,[8,13],'ACTION5']);
  ticket(contrast.pre,move('ACTION3'),'contrast_current_drawing_output_toward_receiver_hypothesis');
  assert.deepEqual(contrast.pre.cut.pre.memory.outputs,pkt.memory.outputs);
  const tr=r['sans-trames-4'],last=tr.steps[3],short=last.after.record.packet;
  assert.deepEqual(tr.steps.slice(0,3),n.slice(0,3));
  assert.deepEqual(last.pre,first.pre);
  assert.deepEqual([last.after.packet,last.after.presented,short.last],[first.after.packet,first.after.presented,pkt.last]);
  assert.deepEqual([short.count,short.accepted,short.memory.outputs,short.memory.launch],[1,false,{},null]);
  assert.equal(tr.next.cut.result.reason,'linked_packet_trigger_not_acquired');
  assert.deepEqual([tr.next.family,tr.next.command],['observed_frontier',click(10,61)]);

  ticket(left.pre,click(21,52),'test_visible_remote_motif_binding');
  ticket(right.pre,click(43,52),'test_visible_remote_motif_binding');
  const [p0,p1]=right.after.record.affected;
  assert.deepEqual([p0[1],p1[1]],[[18,28],[44,28]]);
  const pair={kind:'reciprocal_center_decoration_replacement',previous_ref:p0[0],current_ref:p1[0],
    previous_values:[0,2],current_values:[2,0]};
  assert.deepEqual(right.after.record.step.selection_witness,pair);
  assert.equal(right.after.record.state.bindings[right.pre.plan.control.ref].ref,p1[0]);
  ticket(test.pre,move('ACTION5'),'revalidate_recalled_packet_input_on_current_supports');
  assert.deepEqual(test.after.record.packet.detail.received.map(o=>[o.body_ref,o.frame_interval]),[[p0[0],[5,11]]]);
  ticket(reselect.pre,click(21,52),'select_provider_for_current_relay_contribution');

  const dec=r.decoration,corrupt=dec.steps[9];
  assert.deepEqual(dec.steps.slice(0,9),n.slice(0,9));
  assert.deepEqual(corrupt.pre,right.pre);
  assert.equal(corrupt.after.packet,right.after.packet);
  assert.notEqual(corrupt.after.presented,right.after.physical);
  assert.deepEqual(corrupt.after.record.affected,right.after.record.affected);
  assert.equal(corrupt.after.record.step.selection_witness.kind,'cochange_without_reciprocal_decoration');
  assert.deepEqual(corrupt.after.record.state.bindings,left.after.record.state.bindings);
  ticket(dec.next,click(43,52),'test_visible_remote_motif_binding');

  const wide=r.long.steps,more=wide[17],m=more.after.record.packet;
  assert.equal(wide.length,20);
  assert.equal(more.pre.level,2);
  ticket(more.pre,move('ACTION5'),'test_prepared_relay_composition');
  assert.deepEqual([m.count,m.accepted,m.detail.canonicalSame,more.after.levels],[25,true,false,2]);
  assert.deepEqual(m.detail.received.map(o=>[o.body_ref,o.frame_interval]),[[p0[0],[5,9]],[p1[0],[12,15]]]);
  assert.deepEqual(m.detail.comparison.actual_front_sources,[p0[0],p1[0]]);
  assert.equal(m.detail.comparison.comparison,'matched_observed_front_prefix');
  const sh=r['sans-trames-18'],h=sh.steps[17];
  assert.deepEqual(sh.steps.slice(0,17),wide.slice(0,17));
  assert.deepEqual(h.pre,more.pre);
  assert.deepEqual([h.after.packet,h.after.presented,h.after.levels],[more.after.packet,more.after.presented,2]);
  assert.equal(h.after.record.packet.accepted,false);
  assert.deepEqual(sh.next.command,wide[18].pre.command);
  assert.notDeepEqual(sh.next.cut.pre.memory.outputs,wide[18].pre.cut.pre.memory.outputs);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:7,native:r},null,2)+'\n');
  console.log('SELE 51 · sept préfixes. Motifs, trames datées, fronts et choix de reprise vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
