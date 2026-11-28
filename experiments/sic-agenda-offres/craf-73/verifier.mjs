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


const guard={admitted:true,reason:'current_symbol_frame_and_exact_discriminating_input'};
const unknown='unknown_until_sealed_observation';
const rule=name=>'projection.exploration.symbol_diagram_'+name;
function ticket(p,command,mode){
  assert.deepEqual([p.family,p.kind,p.plan.slot,p.bundle,p.command,p.plan.mode,p.plan.unknown,p.index,p.guard],
    ['public_symbol_transaction','public_symbol_transaction','observed_symbol_transaction','OP18',command,mode,unknown,0,guard]);
  assert.deepEqual(p.scope,{live:guard,stale:{admitted:false,reason:'symbol_frame_binding_changed'}});
}
const recipe={left:[11,9],right:[14],branch:15,size:3};
try{
  const old=await withEngine('historique',engine=>replay(engine,'nominal'));
  const r=await withEngine('gel',async e=>({...await group(e,['nominal','sans-guide']),...await group(e,['stationnaire','produit-substitue'])}));
  const n=r.nominal.steps,[a,b,c,d,e,f,g,,i,j,k,,,,o]=n;
  assert.equal(n.length,16);
  assert.deepEqual(trajectory(old.steps),trajectory(n));
  const sequence=[[[4,11],'select'],[[46,14],'load'],[[4,16],'select'],[[54,14],'load'],
    [[48,21],'transform'],[[4,21],'select'],[[50,44],'receive']];
  for(const [index,[[x,y],effect]] of sequence.entries()){
    const s=n[index],rec=s.after.record;
    ticket(s.pre,click(x,y),'guide');
    assert.deepEqual([rec.event.interface_event.kinds,s.after.matched,s.after.seal,s.after.levels],[[effect],null,true,0]);
    assert.deepEqual(rec.event.evidence,[s.pre.ref,s.after.ref]);
  }
  const basis=a.pre.cut.pre;
  assert.equal(basis.options.length,1);
  assert.deepEqual([basis.mode,basis.options[0].entities,basis.options[0].point,basis.scene.diagrams[0],basis.state.contrasts],
    ['guide',[[1,8,7,14]],{box:[3,10,5,12],palette:11},recipe,[]]);
  assert.deepEqual([a.after.record.event.changed_pixels,a.after.record.state.count,a.after.record.next.tight],
    [65,0,[{point:[4,11],value:11,box:[2,9,6,13]}]]);
  assert.ok(b.pre.plan.rules.includes(rule('load_operand')));
  assert.ok(d.pre.plan.rules.includes(rule('load_operand')));
  assert.ok(e.pre.plan.rules.includes(rule('apply_transformation')));
  assert.equal(e.pre.plan.facts.diagram_equal_pair_matches_left_group_count,1);
  assert.equal(e.pre.cut.pre.state.count,0);
  assert.deepEqual(e.after.record.old.pairs[0].map(x=>x.value),recipe.left);
  assert.deepEqual(e.after.record.next.pairs[0].map(x=>x.value),[5,5]);
  assert.deepEqual(e.after.record.next.glyphs.find(v=>v.point[0]===4&&v.point[1]===21),
    {point:[4,21],value:14,size:3,solid:true,box:[3,20,5,22]});
  assert.deepEqual([e.after.record.state.count,e.after.record.event.diagram_operand_removal_result_appearance_matches,
    e.after.record.state.contrasts.at(-1).transform,e.after.record.event.universal_law_confirmed],
    [1,1,e.after.record.old.pairs,false]);
  assert.equal(f.pre.cut.pre.state.count,1);
  assert.ok(f.pre.plan.rules.includes(rule('causal_support')));
  assert.equal(g.after.record.event.interface_event.facts.selection_cleared_matching_hollow_filled,true);

  const removed=r['sans-guide'];
  assert.deepEqual(removed.change,{box:[1,8,7,14],point:[4,8],from:0,to:13,center:[4,11],centerValue:11});
  assert.deepEqual([removed.cuts[0].pre.options,removed.cuts[0].local,removed.next.family,removed.next.plan],
    [[],null,'observed_frontier',null]);
  const stationary=r.stationnaire,still=stationary.steps[0];
  assert.deepEqual(still.pre,a.pre);
  assert.equal(still.after.packet,a.after.packet);
  assert.deepEqual([still.after.record.event.status,still.after.record.event.changed_pixels,
    still.after.record.state.contrasts,still.after.record.state.rejected.length,stationary.next.family],
    ['no_discriminating_change',0,[],1,'observed_frontier']);

  const substituted=r['produit-substitue'],different=substituted.steps[4],bad=different.after.record,guide=substituted.steps[5];
  assert.deepEqual(substituted.steps.slice(0,4),n.slice(0,4));
  assert.deepEqual(different.pre,e.pre);
  assert.equal(different.after.packet,e.after.packet);
  assert.notEqual(different.after.presented,different.after.physical);
  assert.deepEqual(substituted.change,{box:[3,20,5,22],point:[4,21],extent:3,from:14,to:0});
  assert.deepEqual([bad.next.pairs,bad.state.count,bad.event.interface_event.kinds,bad.state.contrasts.map(v=>v.kind)],
    [e.after.record.next.pairs,0,[],['select','load','select','load']]);
  ticket(guide.pre,click(4,21),'guide');
  assert.equal(guide.pre.cut.pre.state.count,0);
  assert.equal(guide.pre.plan.rules.includes(rule('causal_support')),false);
  assert.deepEqual(i.after.record.event.interface_event.status,'boundary_method_built');
  assert.equal(i.after.levels,1);
  const method=i.after.record.state.methods[0];
  assert.ok(method.evidence.includes(e.after.ref));
  ticket(j.pre,click(4,31),'interface');
  assert.deepEqual([j.pre.plan.interface.method_ref,j.pre.plan.interface.current_demands.map(v=>v.value),j.pre.plan.interface.expected_effect],
    [method.id,[7,14,10],'select']);
  ticket(k.pre,click(47,44),'interface');
  assert.deepEqual([k.pre.plan.interface.expected_effect,k.after.record.event.interface_event.kinds],['receive',['receive']]);
  ticket(o.pre,click(46,14),'interface');
  assert.deepEqual([o.pre.plan.interface.displayed_row,o.pre.plan.interface.expected_effect],
    [{left:[6,11],right:[14],branch:15,size:3},'load']);
  assert.equal(n.every(t=>t.after.matched===null),true);

  const boundary=substituted.steps[8];
  assert.equal(boundary.after.levels,1);
  assert.equal(boundary.after.record.event.interface_event.status,'boundary_method_incomplete');
  assert.deepEqual(boundary.after.record.state.methods,[]);
  assert.notEqual(substituted.next?.plan?.mode,'interface');
  await writeFile(values.recu,JSON.stringify({versions:versionsDuRecu(),prefixes:5,historical:old,native:r},null,2)+'\n');
  console.log('CRAF 73 · cinq préfixes. Guide, opérandes, produit et transfert de méthode vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
