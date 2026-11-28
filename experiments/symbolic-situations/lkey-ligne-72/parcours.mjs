import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {resolve} from 'node:path';
import {rejouerService} from './rejouer-service.mjs';
import {RankedWorkshop} from '../../src/logos-engine/v6-ranked-workshop.ts';

const engine=new URL('../../',import.meta.url);
const above='station_profile_neighbor_above_equal_marked_cut_count';

export async function play(arm,vendor){
  const family=RankedWorkshop.prototype;
  const {proposeSource,select,recordSource}=family;
  const records=new Map();
  const cuts=new Map();
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let active=null;
  hooks.push(mock.method(family,'proposeSource',async function(obs,...rest){
    const prior=this.mode_evidence;
    const scope=obs.level_epoch===1&&obs.revision===11;
    active=scope&&obs.observation_ref;
    if(scope){
      cuts.set(active,{prior:structuredClone(prior),refs:obs.available_action_refs});
      if(arm==='sans-mode')this.mode_evidence=[];
    }
    try{return await proposeSource.call(this,obs,...rest);}
    finally{if(scope&&arm==='sans-mode')this.mode_evidence=prior;active=null;}
  }));
  hooks.push(mock.method(family,'select',function(measured){
    if(!active)return select.call(this,measured);
    const cut=cuts.get(active),before=this.observation;
    cut.neighbor=measured.context[above];
    assert.equal(cut.neighbor,1);
    if(arm==='sans-relation'){
      cut.neighborShown=0;
      return select.call(this,{...measured,context:{...measured.context,[above]:0}});
    }
    if(arm==='ordre-inverse')this.observation={...before,available_action_refs:[...before.available_action_refs].reverse()};
    try{return select.call(this,measured);}
    finally{this.observation=before;}
  }));
  hooks.push(mock.method(family,'recordSource',function(b,a,...rest){
    const r=recordSource.call(this,b,a,...rest);
    const effect=this.input_effects.find(e=>e.evidence.at(-1)===a.observation_ref);
    if(r||effect)records.set(a.observation_ref,structuredClone({result:r,effect,mode:this.mode_evidence}));
    return r;
  }));
  try{
    const r=await rejouerService({engine,vendor:resolve(vendor),gameCode:'LKEY',sessionId:'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10',
      limit:arm==='nominal'?16:12,reprise:true,entries:{records,cuts,guards:new Map()},
      describe(p){
        const q=p.workshop_plan;
        return {plan:q?{stage:q.stage,extension:q.extension,evidence:q.evidence,neighbor:q.context[above]}:null};
      }});
    return {...r,cuts:[...cuts.values()]};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
