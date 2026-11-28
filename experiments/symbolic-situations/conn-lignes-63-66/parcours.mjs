import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {RecurrentSeriesMemory} from './src/logos-engine/v6-recurrent-series-access.ts';
import {recurrentSeriesFields,recurrentSeriesExtensions} from './src/logos-engine/v6-recurrent-series-observation.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=f=>JSON.parse(readFileSync(new URL(f,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const file=new URL('docs/migration/lot3i-evidence/final/conn-recurrent-series-session/conn-public-trace.json.gz',import.meta.url);
const archive=JSON.parse(gunzipSync(readFileSync(file))).packets;
const sets={initial:[['nominal',16],['champ-seul',0],['retrait-63',2],['substitution-63',2]],
  appui:[['retrait-66',14],['substitution-66',14],['sans-but',14]],temps:[['finales',14],['finale-T12',14]]};
function crop(obs){
  const fields=recurrentSeriesFields(obs.frame),f=fields[0],[left,top]=f.origin;
  const right=left+(f.shape[0]-1)*f.pitch[0]+f.size[0],bottom=top+(f.shape[1]-1)*f.pitch[1]+f.size[1];
  const mask=frame=>frame.map((r,y)=>r.map((v,x)=>x>=left-1 && x<=right && y>=top-1 && y<=bottom?v:frame[0][0]));
  const frame=mask(obs.frame),remaining=recurrentSeriesFields(frame);assert.equal(remaining.length,1);assert.equal(remaining[0].ref,f.ref);
  assert.ok(recurrentSeriesExtensions(remaining[0]).some(e=>e.length===3 && e.color===11));return {...obs,frame,frames:obs.frames.map(mask)};
}
function event(e){
  const keys=['kind','epoch','trial','field','source','before','after','candidate_length','palette','result','support_fields',
    'blocked_goal_extension','point','arrived','response','own','other','own_before_response'];
  return Object.fromEntries(keys.filter(k=>Object.hasOwn(e,k)).map(k=>[k,e[k]]));
}
export async function run(group,gameRoot){
  assert.ok(sets[group]);const backend=await sourceBackend(gameRoot),results={};
  const original=RecurrentSeriesMemory.prototype.propose,record=RecurrentSeriesMemory.prototype.record;
  const clock=mock.method(Date,'now',()=>1700000000000);
  try{
    for(const [name,cap] of sets[group]){
      let events=[],note=null;
      const hook=mock.method(RecurrentSeriesMemory.prototype,'propose',function(obs,rows,inputs,budget,config,bounds){
        const args=[obs,rows,inputs,budget,config,bounds],turn=obs.revision;
        if(![1,13].includes(turn))return original.apply(this,args);
        const samples=this.insertSamples.filter(s=>s.epoch===obs.level_epoch);
        note={champs:recurrentSeriesFields(rows).length,buts:this.lineGoals.map(g=>[g.candidate_length,g.source]),
          échantillons:samples.map(s=>[s.source,s.after,s.blocked_goal_extension,Boolean(this.insertOrders[s.source]?.own_before_response)])};
        if(name==='sans-but' && turn===13){
          const retained=this.lineGoals;this.lineGoals=[];
          try{return original.apply(this,args);}finally{this.lineGoals=retained;}
        }
        const ordinary=original.apply(this,args),tag=turn===1?'63':'66';
        if(name==='retrait-'+tag){
          note.omis=ordinary.kind;const key=turn===1?'repeated_line_completion':'prepare_supported_lines';
          return original.call(this,obs,rows,inputs,budget,{...config,[key]:false},bounds);
        }
        if(name==='substitution-'+tag){
          const {x,y}=ordinary.actions[0].data;note.omis=ordinary.kind;note.pointOmis=[x,y];
          const available=inputs.filter(a=>a.action_ref!=='ACTION6'||a.data?.x!==x||a.data?.y!==y);
          return turn===1?this.lineQuestion(obs,rows,available):original.call(this,obs,rows,available,budget,{...config,repeated_line_completion:false},bounds);
        }
        return ordinary;
      });
      const rh=mock.method(RecurrentSeriesMemory.prototype,'record',function(...args){
        const output=record.apply(this,args);events.push(...output.map(event));return output;
      });
      try{
        const rt=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>rt);
        const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10',budgets={targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16};
        let board=backend.dispatch({type:'load',code:'CONN',level:1}),last=null;
        const turns=[];
        for(let sequence=0;sequence<=cap;sequence++){
          const ordinary=toV6PublicObservation({...board,gameCode:board.code??board.gameCode},sequence),hist=archive[sequence]?.packet;
          if(name==='nominal')for(const [a,b] of [['frame','frame_rows'],['frames','frame_packet'],['level','level'],['levelsCompleted','levels_completed']]){
            assert.ok(JSON.stringify(ordinary[a])===JSON.stringify(hist[b]),sequence+' '+a);
          }
          const partial=(name==='finales' && sequence>=10 && sequence<=12)||(name==='finale-T12' && sequence===12);
          const obs=name==='champ-seul'?crop(ordinary):partial?{...ordinary,frames:[ordinary.frame]}:ordinary;
          events=[];note=null;
          let r=await service.handle({sessionId,sequence,observation:obs,...(last?{type:'advance',ticketId:last.id,executionMs:0}:{type:'init',budgets})});
          const ret=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
          while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence});
          const s=r.snapshot,p=s.proposal,plan=p?.line_plan??p?.supported_line_plan,t=r.ticket;
          const guard=s.trace.findLast(e=>e.kind==='before_guard');
          let carré=null;
          if(last?.target){
            const [x,y]=last.target,[w,h]=last.size;
            carré=obs.frame.slice(y,y+h).every(row=>row.slice(x,x+w).every(v=>v===last.palette));
          }
          turns.push({i:sequence+1,ref:t?.observationRef,type:p?.kind,famille:t&&s.lastDecision,sousQuestion:p?.field_subquestion,
            ticket:t?.id,commande:t?.actionRef,point:t?.data,niveau:obs.level,terminés:obs.levelsCompleted,
            admis:t&&guard?.admitted,état:r.kind,images:obs.frames.length,carré,refPlan:plan?.observation_ref,refs:p?.route_refs,
            longueur:plan?.candidate_length??plan?.goal_length,origine:plan?.observed_length,supports:plan?.support_fields?.length,
            palette:plan?.expected_palette,preuve:note,acquisitions:events.map(e=>({...e})),
            retour:ret&&{ticket:last?.id,ref:ret.observation_ref,matched:ret.matched,raison:ret.reason}});
          if(!t||sequence===cap)break;
          board=backend.dispatch({type:'action',actionId:Number(t.actionRef.slice(6)),data:t.data});
          last={id:t.id,target:plan?.target,size:plan?.size,palette:plan?.expected_palette};
        }
        results[name]=turns;
      }finally{rh.mock.restore();hook.mock.restore();}
    }
  }finally{clock.mock.restore();}
  return results;
}
