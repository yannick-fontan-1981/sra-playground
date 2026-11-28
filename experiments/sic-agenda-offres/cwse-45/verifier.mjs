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

const {values}=parseArgs({options:{pyodide:{type:'string'},catr:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'cwse-45-')),out=join(tmp,'prefixe.json');
const modes={nominal:['--gestes','16'],priorite:['--gestes','2'],stationnaire:['--gestes','2'],
  'sans-effet':['--gestes','4','--tour','2','--commande','ACTION4']};
function ticket(s,kind,command,index=0){
  assert.deepEqual([s.pre.family,s.pre.entry,s.pre.type,s.pre.command,s.pre.plan.kind,s.pre.index,s.pre.guard],
    ['public_occurrence_recall','observed_composition_services','exposed_reception',command,kind,index,
      {admitted:true,reason:'current_reception_bound'}]);
}
async function replay(version,all){
  const runs={};
  await withEngine(version,async engine=>{
    for(const [arm,args]of Object.entries(modes)){
      if(!all&&arm!=='nominal')continue;
      execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',arm,...args,'--recu',out],
        {stdio:['ignore','ignore','inherit']});
      const r=JSON.parse(await readFile(out,'utf8'));
      for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut,r.lastCut].filter(Boolean))
        assert.equal(digest(cut.before),cut.seal);
      runs[arm]=r;
    }
  });
  return runs;
}
function compareGuards(catr,cw){
  const c=catr.issued,w=cw.pre;
  assert.equal(c.entry,w.entry);
  assert.deepEqual(c.command,['ACTION6',{x:31,y:47}]);
  assert.equal(w.command,'ACTION4');
  assert.deepEqual(c.envelope.point,[[31,47],12]);
  assert.equal(w.envelope.point,null);
  const expected=['frame_hash','level_epoch','levels_completed','state'];
  for(const [t,reason]of [[c,'relation_binding_changed'],[w,'reception_binding_changed']]){
    const f=t.envelope.expected;
    assert.deepEqual(Object.keys(f).sort(),expected);
    assert.deepEqual([f.level_epoch,f.levels_completed,f.state],[1,0,'NOT_FINISHED']);
    assert.equal(f.frame_hash,t.ref.split(':').at(-1));
    assert.equal(t.envelope.real.admitted,true);
    assert.deepEqual(t.envelope.foreign,{admitted:false,reason});
  }
  assert.notEqual(c.envelope.expected.frame_hash,w.envelope.expected.frame_hash);
  const bind=t=>({ticket:t.ticket,ref:t.ref,entry:t.entry,type:t.type,command:t.command,envelope:t.envelope});
  return {catr:bind(c),cwse:bind(w)};
}
try{
  const catrBytes=await readFile(resolve(values.catr));
  const catrSHA=createHash('sha256').update(catrBytes).digest('hex');
  assert.equal(catrSHA,'c11abc945f851c61a1579d71e6065674c00536465b804acdc399288c3ffa3cb2');
  const catr=JSON.parse(catrBytes);
  assert.equal(catr.versions.qualification,'9186a49ea207caff1fee6a1386b506739b22d4a3');
  const h=await replay('historique',false),g=await replay('gel',true);
  assert.deepEqual(h.nominal,g.nominal);
  const n=g.nominal.steps,[a,b,c,d]=n;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  ticket(a,'control_question','ACTION4');
  const initial=a.pre.cut.before;
  assert.deepEqual(initial.scene.actor,[1,2]);
  assert.deepEqual(initial.scene.slots,[{pos:[4,2],color:9},{pos:[6,4],color:9}]);
  assert.deepEqual(initial.controls,{});
  assert.deepEqual(initial.priority,['ACTION4','ACTION1','ACTION2','ACTION3']);
  assert.equal(a.pre.cut.search.pathLength,6);
  assert.deepEqual(a.pre.cut.search.first[0],{delta:[1,0],actor:[2,2]});
  assert.equal(a.pre.plan.expected,null);
  assert.deepEqual([a.after.matched,a.after.seal],[null,true]);
  assert.deepEqual(a.after.record.detail.actor_delta,[1,0]);
  const acquired={delta:[1,0],evidence:[a.pre.ref,a.after.ref]};
  assert.deepEqual(a.after.record.controls.ACTION4,acquired);
  assert.deepEqual(a.after.record.detail.body_changes.map(x=>x.delta),[[1,0],[1,0]]);
  assert.equal(a.after.record.models.coupled['9'].status,'observed_same_mode_co_motion_candidate');
  ticket(b,'access','ACTION4');
  assert.deepEqual(b.pre.cut.before.controls.ACTION4,acquired);
  assert.deepEqual(b.pre.plan.expected.actor,[3,2]);
  assert.deepEqual([b.after.matched,b.after.seal,b.after.record.detail.layout_transition_unknown],[false,true,true]);
  ticket(c,'exposure_question','ACTION6');
  ticket(d,'exposure_question','ACTION6');
  assert.equal(d.after.levels,1);

  const alt=g.priorite.steps;
  ticket(alt[0],'control_question','ACTION1');
  ticket(alt[1],'control_question','ACTION4');
  assert.deepEqual({...alt[0].pre.cut.before,priority:initial.priority},initial);
  assert.deepEqual(alt[0].after.record.controls.ACTION1.delta,[0,-1]);
  assert.deepEqual(alt[0].after.record.detail.body_changes,[]);

  const held=g.stationnaire,still=held.steps[0];
  assert.equal(held.steps.length,1);
  assert.deepEqual(still.pre,a.pre);
  assert.equal(still.after.packet,a.after.packet);
  assert.notEqual(still.after.presented,still.after.physical);
  assert.deepEqual(still.after.record.controls,{});
  assert.deepEqual(still.after.record.detail.actor_delta,[0,0]);
  assert.deepEqual(still.after.record.probed,[[[1,2],'ACTION4']]);
  assert.deepEqual([held.next.command,held.next.plan.kind],['ACTION1','control_question']);

  const missing=g['sans-effet'].steps,withheld=missing[1];
  assert.deepEqual(missing[0],a);
  assert.deepEqual(withheld.pre.cut.removed,{action:'ACTION4',...acquired});
  assert.deepEqual({...withheld.pre.cut.before,controls:{ACTION4:acquired}},b.pre.cut.before);
  assert.deepEqual(withheld.pre.cut.search,b.pre.cut.search);
  ticket(withheld,'control_question','ACTION4');
  assert.equal(withheld.pre.plan.expected,null);
  assert.equal(withheld.after.matched,null);
  assert.equal(withheld.after.packet,b.after.packet);
  ticket(missing[2],'exposure_question','ACTION6');

  const access=n.slice(12);
  assert.equal(access[0].pre.level,3);
  assert.equal(access[0].pre.cut.search.bounded,true);
  assert.equal(access[0].pre.cut.search.reason,'reception_search_node_bound');
  assert.equal(access[0].pre.cut.search.pathLength,8);
  assert.equal(access[0].pre.cut.search.nodes,8000);
  for(const [i,command]of ['ACTION2','ACTION1','ACTION4','ACTION1'].entries()){
    const s=access[i];
    ticket(s,'access',command,i);
    assert.deepEqual([s.after.matched,s.after.reason,s.after.levels],[true,'expected_conditional_reception_step',2]);
  }
  const paired=compareGuards(catr.nominal[0],a);
  assert.equal(git('rev-parse','HEAD:src'),git('rev-parse','d0e7527c:src'));

  const receipt={versions:{...versions,qualification:git('rev-parse','HEAD'),attendus:git('rev-parse','6db703b6'),
    catr:catr.versions.qualification,catrSHA},prefixes:5,premier:a,acces:b,exposition:[c,d],suiteN3:access,
    variationOrdre:alt,stationnaire:held,sansEffet:missing.slice(1),enveloppes:paired,parite:digest(n)};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('CWSE 45 · cinq préfixes. Liaison au contrôle et accès vérifiés. Les deux vrais tickets CATR et CWSE vérifient la liaison courante.');
}finally{await rm(tmp,{recursive:true,force:true});}
