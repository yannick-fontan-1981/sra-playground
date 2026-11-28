import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {FramedPolicy} from './src/logos-engine/v6-framed-transfer-policy.ts';
import {FramedTransfer} from './src/logos-engine/v6-framed-transfer.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=f=>JSON.parse(readFileSync(new URL(f,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const file=new URL('docs/migration/native-campaigns-v52/final/gare-public-trace.json.gz',import.meta.url);
const archive=JSON.parse(gunzipSync(readFileSync(file))).packets;
const transfer='observed_framed_transfer',analogy='observed_framed_analogy';
function count(a,b){let n=0;for(let y=0;y<a.length;y++)for(let x=0;x<a[y].length;x++)if(a[y][x]!==b[y][x])n++;return n;}
function editFrame(obs,change){
  const edit=frame=>frame.map((row,y)=>row.map((v,x)=>change(v,x,y,frame)));
  return {...obs,frame:edit(obs.frame),frames:obs.frames.map(edit)};
}
export async function run(group,gameRoot,seed){
  const cases={nominal:[['nominal',16]],transfert:[['retrait1',2],['autre1',2],['bande',0]],analogie:[['retrait4',5],['autre4',5],['autre5',6],['masque',3]],réserve:[['local1',1],['local4',4]]}[group];assert.ok(cases);
  const game=await sourceBackend(gameRoot),results={},clock=mock.method(Date,'now',()=>1700000000000);
  const original=FramedTransfer.prototype.proposeInSubquestion,selector=FramedPolicy.prototype.select,record=FramedTransfer.prototype.record;
  try{
    for(const [name,cap] of cases){
      const turn=Number(name.match(/[145]$/)?.[0]??0),changes=[],facts=[],rows=[];let revision=0;
      const h=mock.method(FramedTransfer.prototype,'proposeInSubquestion',async function(...args){
        revision=args[2].revision;
        if(name.startsWith('retrait') && revision===turn && args[1]===(turn===1?transfer:analogy)){
          const withdrawn=await original.apply(this,args);changes.push({tour:revision,entrée:args[1],point:withdrawn?.actions[0].data});return null;
        }
        return original.apply(this,args);
      });
      const policy=mock.method(FramedPolicy.prototype,'select',function(offers){
        if(!name.startsWith('autre')||revision!==turn)return selector.call(this,offers);
        const p=archive[turn].command.data,alternatives=offers.map(o=>{
          if(o.point_x!==p.x || o.point_y!==p.y)return o;
          changes.push({tour:revision,point:p,offre:o.candidate_ref});return {...o,facts:{}};
        });
        return selector.call(this,alternatives);
      });
      const rh=mock.method(FramedTransfer.prototype,'record',async function(...args){
        const result=await record.apply(this,args);
        for(const ev of result.events??[]){
          const v=ev.source_result??ev;if(!v.evidence)continue;
          facts.push({refs:v.evidence,changée:v.scene_changed,preuves:(v.derived??[]).map(d=>[d.source_claim_ref,d.derivation.policy])});
        }
        return result;
      });
      try{
        const rt=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>rt);
        const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
        const budgets={targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16};
        let board=game.dispatch({type:'load',code:'GARE',level:1}),past=null;
        for(let i=0;i<=cap;i++){
          const ordinary=toV6PublicObservation(board,i);let obs=ordinary,physics=null;
          if(name==='nominal'){
            const p=archive[i].packet;
            for(const [a,b] of [['frame','frame_rows'],['frames','frame_packet'],['level','level'],['levelsCompleted','levels_completed']])assert.ok(JSON.stringify(obs[a])===JSON.stringify(p[b]),i+' '+a);
          }
          if(name==='bande'&&i===0)obs=editFrame(obs,(v,x,y,f)=>y===22 && x>=2 && x<=6?f[21][x]:v);
          if(name==='masque'&&i===3)obs=editFrame(obs,(v,x,y)=>x===18 && y===22?(v===14?5:14):v);
          if(name.startsWith('local')&&i===turn){
            const radius=4+seed[turn===1?0:1]%5,{x,y}=past.data;
            obs=editFrame(obs,(v,u,w)=>Math.max(Math.abs(u-x),Math.abs(w-y))<=radius?v:past.frame[w][u]);
          }
          if(past)physics={réel:count(past.frame,ordinary.frame),servi:count(past.frame,obs.frame),écart:count(ordinary.frame,obs.frame)};
          let r=await service.handle({sessionId,sequence:i,observation:obs,...(past?{type:'advance',ticketId:past.id,executionMs:0}:{type:'init',budgets})});
          const ret=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
          while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i});
          const snap=r.snapshot,p=snap.proposal,t=r.ticket,fp=t&&p?.framed_transfer_plan,g=snap.trace.findLast(e=>e.kind==='before_guard');
          const offer=fp?.offer,f=offer?.facts,choice=fp?.choice,claims=choice?.projected?.premise_claim_refs;
          rows.push({tour:i+1,ticket:t?.id,ref:t?.observationRef,niveau:obs.level,état:r.kind,famille:t&&snap.lastDecision,
            entrée:t&&(p?.material_access_subquestion??p?.field_subquestion??p?.kind),cmd:t?.actionRef,point:t?.data,
            admis:t&&g?.admitted,prédiction:t?p?.steps?.[t.actionIndex]?.expected_after:undefined,observation:physics,
            plan:fp?{projection:choice.projection_ref,premisses:claims??[],paire:f.parallel_solid_band_mutually_unique,partenaires:f.parallel_solid_band_peer_count,
              masque:f.framed_reception_locus_same_mask_marker,source:f.framed_reception_locus_source_ref,marqueur:f.framed_reception_locus_marker_ref,
              complet:f.framed_reception_locus_complete,delta:f.framed_reception_locus_expected_delta}:null,
            retour:ret&&{ticket:past.id,ref:ret.observation_ref,famille:ret.family,matched:ret.matched,raison:ret.reason}});
          if(!t||i===cap)break;
          past={id:t.id,data:t.data,frame:obs.frame};
          board=game.dispatch({type:'action',actionId:Number(t.actionRef.slice(6)),data:t.data});
        }
        results[name]={rows,changes,facts};
      }finally{rh.mock.restore();policy.mock.restore();h.mock.restore();}
    }
  }finally{clock.mock.restore();}
  return results;
}
