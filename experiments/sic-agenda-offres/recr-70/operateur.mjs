import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const action=c=>[c.action_ref,c.data??{}];
function offer(o){
  return {kind:o.kind,cost:o.cost,survivors:o.survivors,command:action(o.action),type:o.step.type,step:o.step.kind,
    before:o.step.expected_context,projected:o.step.projected_context,search:o.search,refs:o.method_revalidation.methods.map(v=>v.evidence)};
}
const state=s=>({epoch:s.epoch,order:s.order,methods:s.methods,portable:s.portable,continuation:s.continuation&&
  {before:s.continuation.steps[0]?.expected_context,rest:s.continuation.steps.length,refs:s.continuation.evidence}});
const byValue=a=>[...a].sort((x,y)=>x-y);

export async function play(engine,variant,vendor,target=2){
  const {OrderedRecruitment}=await import(new URL('src/logos-engine/v6-ordered-recruitment.ts',engine));
  const {measureOrderedRecruitment,orderedRecruitmentSummary}=await (async()=>{
    const g=await import(new URL('src/logos-engine/v6-ordered-recruitment-geometry.ts',engine));
    const p=await import(new URL('src/logos-engine/v6-ordered-recruitment-projection.ts',engine));
    return {...g,...p};
  })();
  const family=OrderedRecruitment.prototype,propose=family.propose,record=family.recordSource,native=family.nativeOffers;
  const cuts=new Map(),records=new Map(),guards=new Map(),hooks=[mock.method(Date,'now',()=>1700000000000)];
  let active=null,owner=null,change=null;
  const measurement=m=>m&&{summary:orderedRecruitmentSummary(m),order:m.order,legend:m.legend,buttons:m.buttons,links:m.links,
    rooms:m.rooms.map(r=>({box:r.bbox,left:r.left,right:r.right,grid:r.grid,front:r.front_markers,quota:r.quota_hypothesis}))};
  hooks.push(mock.method(family,'nativeOffers',async function(obs,rows,remaining,execution){
    const output=await native.call(this,obs,rows,remaining,execution);
    if(active===obs.observation_ref){
      const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),measurement:measurement(output.measurement),
        offers:output.offers.map(offer),search:output.bound,state:state(this.state())};
      cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
    }
    return output;
  }));
  hooks.push(mock.method(family,'propose',async function(obs,rows,inputs,remaining,execution){
    active=obs.observation_ref;owner=this;
    let p;
    try{p=await propose.call(this,obs,rows,inputs,remaining,execution);}
    finally{active=null;}
    if(p){
      const packet={frame_rows:rows};
      guards.set(obs.observation_ref,{live:await this.before(p,0,packet,obs,execution),
        stale:await this.before(p,0,packet,{...obs,observation_ref:obs.observation_ref+':old'},execution)});
    }
    return p;
  }));
  hooks.push(mock.method(family,'recordSource',function(b,a,cmd,first,second,p,i,frames){
    const retained=this.order,old=measurement(measureOrderedRecruitment(first,retained));
    const result=record.call(this,b,a,cmd,first,second,p,i,frames);
    if(result){
      const after=b.level_epoch===a.level_epoch?measurement(measureOrderedRecruitment(second,retained)):null;
      records.set(a.observation_ref,{result,state:state(this.state()),old,after});
    }
    return result;
  }));

  const swapQueue=actual=>{
    const order=owner?.order??null,m=measureOrderedRecruitment(actual.frame,order),room=m?.rooms[m.current];
    assert.ok(room&&room.left.length>=2);
    const a=room.left[0];
    assert.ok(a);
    const other=room.left.find(v=>v.type!==a.type);
    assert.ok(other);
    const grid=structuredClone(actual.frame),[l,t,r,d]=room.bbox;
    const region=token=>{
      const queue=[token.point],seen=new Map([[token.point.join(','),token.point]]);
      for(const [x,y] of queue){
        for(const [u,v] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
          const key=u+','+v;
          if(u<=l||v<=t||u>=r||v>=d||seen.has(key)||actual.frame[v][u]!==token.value)continue;
          seen.set(key,[u,v]);queue.push([u,v]);
        }
      }
      return queue;
    };
    const left=region(a),right=region(other);
    assert.equal(left.length,right.length);
    for(const [x,y] of left)grid[y][x]=other.value;
    for(const [x,y] of right)grid[y][x]=a.value;
    const later=measureOrderedRecruitment(grid,order);
    assert.ok(later);
    const old=orderedRecruitmentSummary(m),next=orderedRecruitmentSummary(later);
    assert.deepEqual(byValue(old.queue),byValue(next.queue));
    assert.notDeepEqual(old.queue,next.queue);
    assert.deepEqual({...old,queue:next.queue},next);
    assert.deepEqual(m.legend,later.legend);
    assert.deepEqual(m.links,later.links);
    change={first:a,second:other,perSubject:left.length,old,next};
    return grid;
  };

  try{
    const result=await rejouerService({engine,vendor,gameCode:'RECR',sessionId:'recr-70',limit:variant==='nominal'?16:target,
      reprise:true,entries:{cuts,records,guards},
      describe(p){
        const q=p.recruitment_plan;
        return {plan:q?{local:offer(q.offer),trace:q.offer.plan.trace,route:q.offer.plan.steps.map(s=>[s.kind,action(s.action),s.type,s.projected_context]),
          choice:q.choice.index,slot:p.material_access_subquestion}:null};
      },
      present({board,actual,i}){
        if(i!==target||variant==='nominal')return actual;
        if(variant==='sans-ajout')return {...board,frames:[board.frame]};
        const frame=swapQueue(actual);
        return {...actual,frame,frames:[frame]};
      }});
    return {...result,change,cuts:[...cuts.values()]};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},tour:{type:'string',default:'2'},recu:{type:'string'}}});
  assert.ok(['nominal','ordre-permute','sans-ajout'].includes(values.variante));
  const go=e=>play(e,values.variante,resolve(values.pyodide),Number(values.tour));
  const r=values.source?await go(values.source):await withEngine(values.moteur,go);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.local.step??s.pre.family,JSON.stringify(s.pre.command),
    s.after.record?.result?.events.map(e=>e.kind),s.after.levels);
  console.log('suite',r.next?.command,r.next?.plan?.local,r.stop,r.change);
}
