import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {BandTransfer} from './src/logos-engine/v6-band-transfer.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=f=>JSON.parse(readFileSync(new URL(f,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const archive=JSON.parse(gunzipSync(readFileSync(new URL('tests/fixtures/sic-vc33-line3.json.gz',import.meta.url)))).observations;
function pixel(frame,m,cross,d){
  const z=m.end+m.side*d;
  return m.axis===0?[cross,z]:[z,cross];
}
function lengths(frame,m){
  return m.probes.map(group=>{
    const counts=group.map(c=>{
      let n=0;
      while(n<Math.max(frame.length,frame[0].length)){
        const [y,x]=pixel(frame,m,c,n);
        if(frame[y]?.[x]!==m.fill)break;
        n++;
      }
      return n;
    });
    assert.equal(new Set(counts).size,1);return counts[0];
  });
}
function edited(name,initial,next,m){
  if(name==='stationnaire')return {...next,frame:initial.frame,frames:[initial.frame]};
  if(name==='amplitude'){
    const frame=initial.frame.map(r=>r.slice()),q=lengths(initial.frame,m);
    for(const [i,crosses] of m.probes.entries())for(const cross of crosses){
      const [y,x]=pixel(frame,m,cross,i===0?q[i]:q[i]-1);
      const [v,u]=pixel(frame,m,cross,q[i]);
      frame[y][x]=i===0?m.fill:initial.frame[v][u];
    }
    assert.deepEqual(lengths(frame,m),[q[0]+1,q[1]-1]);return {...next,frame,frames:[frame]};
  }
  if(name==='référence'){
    const marker=m.markers[0],[l,t,r,b]=marker.reference;
    const cut=frame=>frame.map((row,y)=>y<t||y>b?row:row.map((v,x)=>x>=l&&x<=r?row[l-1]:v));
    assert.notEqual(next.frame[t][l-1],marker.color);
    return {...next,frame:cut(next.frame),frames:next.frames.map(cut)};
  }
  return next;
}
export async function run(group,gameRoot){
  const cases={parcours:[['nominal',16],['autre',3],['retrait',2],['retrait-T2',3]],
    retours:[['stationnaire',1],['amplitude',1],['référence',1]]}[group];
  assert.ok(cases);
  const backend=await sourceBackend(gameRoot),results={};
  const native=BandTransfer.prototype.propose,record=BandTransfer.prototype.record,selector=BandTransfer.prototype.selectProbe;
  const clock=mock.method(Date,'now',()=>1700000000000);
  try{
    for(const [name,cap] of cases){
      const calls=[],events=[],attempts=[],rows=[];
      let model=null,revision=0;
      const ph=mock.method(BandTransfer.prototype,'propose',async function(obs,...args){
        revision=obs.revision;
        const p=await native.call(this,obs,...args);
        model=this.model;
        attempts.push({revision,ref:obs.observation_ref,sens:this.sense,réfuté:this.refuted,essais:[...this.tried.values()],proposé:p?.kind??null});
        return p;
      });
      const rh=mock.method(BandTransfer.prototype,'record',function(...args){
        const e=record.apply(this,args);events.push(structuredClone(e));return e;
      });
      const sh=selector&&mock.method(BandTransfer.prototype,'selectProbe',function(offers){
        const i=name==='autre'&&revision===1?offers[1]:(name==='retrait'&&revision===1)||(name==='retrait-T2'&&revision===2)?undefined:selector.call(this,offers);
        calls.push({revision,offres:[...offers],choix:i??null});return i;
      });
      try{
        const rt=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>rt);
        const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10',budgets={targetLevels:7,levelActionCaps:Array(7).fill(600),maxActions:16};
        let board=backend.dispatch({type:'load',code:'VC33',level:1}),past=null,initial;
        for(let sequence=0;sequence<=cap;sequence++){
          let obs=toV6PublicObservation({...board,gameCode:board.code??board.gameCode},sequence);
          if(sequence===0)initial=obs;
          if(sequence===1 && group==='retours')obs=edited(name,initial,obs,past.m);
          if(name==='nominal')for(const k of Object.keys(archive[sequence]))assert.ok(JSON.stringify(obs[k])===JSON.stringify(archive[sequence][k]),'archive '+sequence+' '+k);
          const physical=past?.m && obs.level===past.level?lengths(obs.frame,past.m):null;
          let r=await service.handle({sessionId,sequence,observation:obs,...(past?{type:'advance',ticketId:past.id,executionMs:0}:{type:'init',budgets})});
          const ret=r.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
          while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence});
          const s=r.snapshot,p=s.proposal,t=r.ticket,plan=t&&p?.band_plan,step=plan?p.steps[t.actionIndex]:null;
          const g=s.trace.findLast(e=>e.kind==='before_guard');
          rows.push({tour:sequence+1,niveau:obs.level,réussis:obs.levelsCompleted,ticket:t?.id,ref:t?.observationRef,
            famille:t&&s.lastDecision,type:t&&p?.kind,état:r.kind,cmd:t?.actionRef,point:t?.data,admis:t&&g?.admitted,
            plan:plan&&{sens:plan.signed_relation,axe:plan.alignment_axis,unité:plan.quantum,cibles:plan.constrained_lengths,
              longueurs:step.quantities,attendu:step.expected_after,actuateur:step.control_index,refs:p.route_refs},
            pixelsAvant:plan?lengths(obs.frame,model):null,
            retour:ret&&{ticket:past.id,ref:ret.observation_ref,matched:ret.matched,raison:ret.reason,longueurs:physical}});
          if(!t||sequence===cap)break;
          past={id:t.id,level:obs.level,m:plan?structuredClone(model):null};
          board=backend.dispatch({type:'action',actionId:Number(t.actionRef.slice(6)),data:t.data});
        }
        results[name]={sélecteurDisponible:Boolean(selector),rows,events,calls,attempts};
      }finally{ph.mock.restore();rh.mock.restore();sh?.mock.restore();}
    }
  }finally{clock.mock.restore();}
  return results;
}
