import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const variants=['nominal','long','stationnaire','decoration-contradictoire','sans-trames'];
const stateView=s=>s&&{epoch:s.epoch,bindings:s.bindings,selected:s.selected,masks:s.selection_masks,edges:s.edges,
  inputTests:s.input_tests,trials:s.trials,received:s.received_controls??null,evidence:s.evidence,
  expected:s.pending_relay_path??null,last:s.last_relay_comparison??null};
const journalView=s=>({state:stateView(s.linked_state),outputs:s.linked_outputs,inputs:s.linked_input_steps,launch:s.linked_launch});
const scenes=s=>s&&{bounds:s.bounds,background:s.background,controls:s.controls,objects:s.objects};

export async function play(engine,variant,vendor,targetTurn){
  assert.ok(variants.includes(variant));
  assert.ok(variant!=='sans-trames'||Number.isInteger(targetTurn)&&targetTurn>0);
  const prefix='src/logos-engine/v6-linked-packet-';
  const {LinkedPacketMemory,linkedPacketBefore}=await import(new URL(prefix+'access.ts',engine));
  const {measureLinkedScene,linkedTargetMarker,changedLinkedSupports}=await import(new URL(prefix+'observation.ts',engine));
  const family=LinkedPacketMemory.prototype,cuts=new Map(),records=new Map(),guards=new Map();
  const propose=family.proposeLinked,record=family.record,packet=family.recordPacket;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let lastSelection=null;
  hooks.push(mock.method(family,'proposeLinked',function(obs,rows,inputs,limit,config,deadline,now,base){
    const scene=measureLinkedScene(rows);
    const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),available:obs.available_action_refs,
      scene:scenes(scene),target:scene&&linkedTargetMarker(rows,scene),memory:journalView(this.currentState())});
    const cut={pre,seal:digest(pre)};
    cuts.set(obs.observation_ref,cut);
    const p=propose.call(this,obs,rows,inputs,limit,config,deadline,now,base);
    cut.result=p?{status:p.status,reason:p.reason??null}:null;
    if(p?.linked_packet_plan){
      const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
      guards.set(obs.observation_ref,{live:linkedPacketBefore(p,0,rows,meta),
        stale:linkedPacketBefore(p,0,rows,{...meta,observation_ref:meta.observation_ref+':old'})});
    }
    return p;
  }));
  hooks.push(mock.method(family,'record',function(b,cmd,a,rows,later,p,index){
    const events=record.call(this,b,cmd,a,rows,later,p,index),event=events[0];
    if(event){
      const changed=cmd.action_ref==='ACTION6'?changedLinkedSupports(rows,later,event.state.scene):[];
      lastSelection=event.state.bindings[event.state.selected]??null;
      records.set(a.observation_ref,structuredClone({step:event.detail,state:stateView(event.state),
        affected:changed.map(o=>[o.ref,o.point]),packet:null}));
    }
    return events;
  }));
  hooks.push(mock.method(family,'recordPacket',function(b,cmd,a,rows,frames){
    const events=packet.call(this,b,cmd,a,rows,frames),event=events[0];
    const old=records.get(a.observation_ref)??{step:null,state:null,affected:[]};
    const measured=event?.detail.packet_measurement;
    records.set(a.observation_ref,structuredClone({...old,packet:{count:frames.length,last:frames.length?digest(frames.at(-1)):null,
      accepted:!!event,detail:event&&{before:event.detail.before_ref,after:event.detail.after_ref,received:event.detail.outputs_received,
        canonicalSame:event.detail.canonical_return_equals_initial,segments:measured.segments.map(({start_frame,end_frame,first_center,direction})=>
          ({start_frame,end_frame,first_center,direction})),comparison:event.detail.relay_comparison},memory:journalView(this.currentState())}}));
    return events;
  }));
  try{
    const longer=variant==='long'||variant==='sans-trames'&&targetTurn>16;
    return await rejouerService({engine,vendor,gameCode:'SELE',sessionId:'sele-51',entries:{cuts,guards,records},
      limit:variant==='nominal'?16:variant==='long'?20:variant==='sans-trames'?targetTurn:variant==='stationnaire'?1:10,
      maxActions:longer?20:16,reprise:variant!=='nominal'&&variant!=='long',
      describe(p,i){
        const q=p.linked_packet_plan;
        return {plan:q?{reason:q.reason,control:q.control,target:q.target_hypothesis,state:stateView(q.state),
          contribution:q.relay_contribution,point:p.steps[i].point_binding??null}:null};
      },
      present({board,actual,i}){
        if(variant==='stationnaire')return {...board,frames:[board.frame]};
        if(variant==='sans-trames'&&i===targetTurn)return {...actual,frames:[actual.frame]};
        if(variant!=='decoration-contradictoire'||i!==10)return actual;
        assert.ok(lastSelection);
        const [x,y]=lastSelection.point,a=board.frame[y][x],b=actual.frame[y][x];
        assert.notEqual(a,b);
        const changed=actual.frame.map(row=>[...row]);
        changed[y][x]=Array.from({length:16},(_,value)=>value).find(v=>v!==a&&v!==b);
        return {...actual,frame:changed,frames:[changed]};
      }});
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},tour:{type:'string'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide),Number(values.tour));
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.kind,JSON.stringify(s.pre.command),s.after.record?.packet?.count??0,
    s.after.record?.packet?.detail?.received.length??0);
  if(r.stop)console.log(r.stop);
}
