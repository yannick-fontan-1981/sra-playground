import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const variants=['nominal','stationnaire','trame-dupliquee','sans-reception'];
const state=s=>s&&{epoch:s.epoch,geometry:s.geometry,controls:s.controls,empty:s.empty??null,gravity:s.gravity??null,
  active_member_count:s.active_member_count??null,
  closure:s.closure_models??null,status:s.closure_status??null,last:s.last_transition??null,preview:s.preview_orientations??null,
  evidence:s.evidence,attempts:s.attempts,refuted:s.refuted_translations??[],restorations:s.restorations?.length??0};
const observed=s=>s&&{geometry:s.geometry,mark:s.mark,preview:s.preview_alternatives,grid:s.grid,
  empty:s.empty_appearance_hypothesis};

export async function play(engine,variant,vendor,target){
  assert.ok(variants.includes(variant));
  assert.ok(variant==='nominal'||Number.isInteger(target)&&target>0);
  const prefix='src/logos-engine/v6-queued-field-';
  const {QueuedFieldMemory,queuedFieldBefore}=await import(new URL(prefix+'access.ts',engine));
  const {activeQueueMemberCount}=await import(new URL(prefix+'models.ts',engine));
  const {measureQueuedField,queuedFieldBoard}=await import(new URL(prefix+'observation.ts',engine));
  const {queuedFieldPlacement}=await import(new URL(prefix+'mechanics.ts',engine));
  const family=QueuedFieldMemory.prototype,cuts=new Map(),records=new Map(),guards=new Map();
  const propose=family.proposeQueue,record=family.recordPacket;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let removed=[];
  const measure=(rows,prior)=>measureQueuedField(rows,prior?.geometry??null,activeQueueMemberCount(prior));
  function placementEvidence(first,empty,frames){
    if(!first?.mark||empty===null)return [];
    const mark=first.mark,board=queuedFieldBoard(first,empty),matches=[];
    for(const gravity of [-1,1]){
      const placed=queuedFieldPlacement(board,mark.values,mark.column,gravity);
      if(!placed)continue;
      const values=digest(placed.map(row=>row.map(v=>v??empty)));
      for(const [index,frame] of frames.entries()){
        const scene=measureQueuedField(frame,first.geometry,mark.values.length);
        if(scene&&!scene.mark&&digest(scene.grid)===values)matches.push({gravity,index,hash:digest(frame)});
      }
    }
    return matches;
  }
  hooks.push(mock.method(family,'proposeQueue',function(obs,rows,inputs,limit,config,deadline,now,base){
    const prior=this.currentState().queue_state;
    const scene=measure(rows,prior?.epoch===obs.level_epoch?prior:null);
    const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),available:obs.available_action_refs,
      scene:observed(scene),memory:state(prior),remaining:config.remaining_level_actions});
    const cut={pre,seal:digest(pre)};
    cuts.set(obs.observation_ref,cut);
    const p=propose.call(this,obs,rows,inputs,limit,config,deadline,now,base);
    cut.result=p?{status:p.status,reason:p.reason??null}:null;
    if(p?.queued_field_plan){
      const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
      guards.set(obs.observation_ref,{live:queuedFieldBefore(p,0,rows,meta,this),stale:queuedFieldBefore(p,0,rows,
        {...meta,observation_ref:meta.observation_ref+':old'},this)});
    }
    return p;
  }));
  hooks.push(mock.method(family,'recordPacket',function(b,cmd,a,rows,frames){
    const pending=this.pending,prior=this.currentState().queue_state;
    const events=record.call(this,b,cmd,a,rows,frames),event=events[0];
    if(pending&&event){
      const before=measure(pending.rows,prior?.epoch===b.level_epoch?prior:null);
      const final=before?measureQueuedField(pending.later,before.geometry,before.mark?.values.length??null):null;
      const empty=prior?.empty??before?.empty_appearance_hypothesis??null;
      records.set(a.observation_ref,structuredClone({event:state(event.state),prior:state(prior),refs:event.evidence,
        frames:event.packet_images_consumed,placement:placementEvidence(before,empty,frames),before:observed(before),final:observed(final),
        settledEqual:!!before&&!!final&&empty!==null&&digest(queuedFieldBoard(before,empty))===digest(queuedFieldBoard(final,empty))}));
    }
    return events;
  }));
  try{
    const r=await rejouerService({engine,vendor,gameCode:'COLM',sessionId:'colm-59',entries:{cuts,guards,records},
      limit:variant==='nominal'?16:target,reprise:variant!=='nominal',
      describe(p,i){
        const plan=p.queued_field_plan,s=p.steps[i];
        return {plan:plan?{mode:plan.mode,commands:plan.commands,column:s.controlled_column_before,before:s.expected_before_grid,
          prediction:s.expected_after_grid,active:plan.active_control_model,portable:plan.portable_model?.transfer_scope??null,
          estimate:plan.estimate&&{models:plan.estimate.model_alternatives.length,placed:plan.estimate.placed,
            projection:plan.estimate.mechanical_receipt?.descriptive_facts??null}}:null};
      },
      present({board,actual,pre,i}){
        if(i!==target||variant==='nominal')return actual;
        if(variant==='stationnaire')return {...board,frames:[board.frame]};
        if(variant==='trame-dupliquee')return {...actual,frames:[actual.frame,actual.frame]};
        const q=pre.cut.pre,m=q.memory?.epoch===q.epoch?q.memory:null,first=measure(board.frame,m);
        const matches=placementEvidence(first,m?.empty??first.empty_appearance_hypothesis,actual.frames);
        assert.ok(matches.length>0);
        removed=[...new Set(matches.map(item=>item.index))];
        assert.ok(!removed.includes(actual.frames.length-1));
        return {...actual,frames:actual.frames.filter((_,index)=>!removed.includes(index))};
      }});
    return {...r,removed};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},tour:{type:'string'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide),Number(values.tour));
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.mode??s.pre.kind,JSON.stringify(s.pre.command),
    s.after.record?.frames??null,s.after.record?.event.last??null,s.after.levels);
  if(r.stop)console.log(r.stop);
}
