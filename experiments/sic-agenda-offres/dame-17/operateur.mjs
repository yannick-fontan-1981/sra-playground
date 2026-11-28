import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const snapshot=f=>({epoch:f.epoch,focus:f.focus,invites:f.invites,refs:f.refs,relations:f.relations,
  selected:f.selected,control:f.control_marks,base:f.base_values,tried:f.tried});

export async function play(engine,variant,vendor){
  const {InvitedReduction,reductionPacked,reductionGeometry,reductionPoint,
    measureReductionScene,retainedReductionScene}=await import(new URL('src/logos-engine/v6-invited-reduction.ts',engine));
  const family=InvitedReduction.prototype,propose=family.propose,record=family.record;
  const cuts=new Map(),records=new Map(),guards=new Map(),hooks=[mock.method(Date,'now',()=>1700000000000)];
  let owner=null,geometry=null,change=null;
  const summarize=s=>s&&{pitch:s.pitch,origin:s.origin,cells:s.cells.size,population:reductionPacked(s.bodies)};
  hooks.push(mock.method(family,'propose',async function(obs,rows,inputs,limit){
    owner=this;
    const before=this.state();
    const current=before.epoch===obs.level_epoch?await retainedReductionScene(rows,before.hint):await measureReductionScene(rows);
    const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),available:obs.available_action_refs,
      scene:summarize(current),memory:snapshot(before)};
    const cut={pre,seal:digest(pre)};
    cuts.set(obs.observation_ref,cut);
    const p=await propose.call(this,obs,rows,inputs,limit);
    cut.local=p?{command:p.actions[0],mode:p.steps[0].mode}:null;
    if(p){
      geometry=p.steps[0].geometry??reductionGeometry(current);
      const packet={level:obs.level_epoch,levels_completed:obs.levels_completed,frame_hash:obs.frame_hash,frame_rows:rows};
      guards.set(obs.observation_ref,{live:await this.before(p,0,packet,obs),stale:await this.before(p,0,
        {...packet,frame_hash:obs.frame_hash+':old'},obs)});
    }
    return p;
  }));
  hooks.push(mock.method(family,'record',async function(b,a,cmd,first,second,p,i){
    const result=await record.call(this,b,a,cmd,first,second,p,i);
    if(p?.support_plan?.invited_reduction){
      const g=p.steps[i].geometry;
      records.set(a.observation_ref,{result,state:snapshot(this.state()),before:summarize(await retainedReductionScene(first,g)),
        after:b.level_epoch===a.level_epoch?summarize(await retainedReductionScene(second,g)):null});
    }
    return result;
  }));
  function copyCell(target,source,cell){
    const {origin,pitch}=geometry,[x,y]=[origin[0]+cell[0]*pitch,origin[1]+cell[1]*pitch];
    let changed=0;
    for(let j=y;j<y+pitch;j++)for(let i=x;i<x+pitch;i++){
      if(target[j][i]!==source[j][i])changed++;
      target[j][i]=source[j][i];
    }
    assert.ok(changed);
    return {cell,pixels:changed,point:reductionPoint(geometry,cell)};
  }
  try{
    const result=await rejouerService({engine,vendor,gameCode:'DAME',sessionId:'dame-17',limit:variant==='nominal'?16:
      ['sans-invitation','une-invitation'].includes(variant)?1:2,reprise:true,entries:{cuts,records,guards},
      describe(p,i){
        if(!p.support_plan?.invited_reduction)return {plan:null};
        const step=p.steps[i];
        return {plan:{mode:step.mode,before:step.expected_before,expected:step.expected_after,focusBefore:step.focus_before,focusAfter:step.focus_after,
          control:step.control_marks,steps:p.steps.map(v=>[v.mode,v.action]),hypothesis:p.support_plan.hypothesis,states:p.support_plan.search_states}};
      },
      async present({board,actual,pre,i}){
        const invitation=['sans-invitation','une-invitation'].includes(variant)&&i===1, victim=variant==='victime-preservee'&&i===2;
        if(!invitation&&!victim)return actual;
        const first=await retainedReductionScene(board.frame,geometry),returned=await retainedReductionScene(actual.frame,geometry);
        assert.ok(first&&returned);
        const altered=structuredClone(actual.frame);
        if(invitation){
          const open=owner.currentInvites(returned).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
          assert.ok(open.length);
          change={invitations:(variant==='une-invitation'?open.slice(0,1):open).map(cell=>copyCell(altered,board.frame,cell))};
        }else{
          const from=JSON.stringify(pre.plan.focusBefore),lost=[...first.bodies.keys()].filter(k=>!returned.bodies.has(k)&&k!==from);
          assert.equal(lost.length,1);
          change={victim:copyCell(altered,board.frame,JSON.parse(lost[0]))};
        }
        return {...actual,frame:altered,frames:[altered]};
      }});
    return {...result,change,cuts:[...cuts.values()]};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  assert.ok(['nominal','sans-invitation','une-invitation','victime-preservee'].includes(values.variante));
  const go=e=>play(e,values.variante,resolve(values.pyodide));
  const r=values.source?await go(values.source):await withEngine(values.moteur,go);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.mode??s.pre.family,JSON.stringify(s.pre.command),
    s.after.record?.result?.events?.map(v=>v.kind),s.after.matched,s.after.seal,s.after.levels);
  console.log('suite',r.next?.command,r.next?.plan?.mode,r.stop,r.change);
}
