import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const summary=s=>s&&{chains:s.chains.map(c=>({cells:c.cells,points:c.points})),
  rows:s.row_marks,columns:s.column_marks,empty:s.empty_content_palette,lines:[s.x_lines,s.y_lines]};
const model=m=>({addition:m.addition_observed??false,cut:m.cut_observed??false,empty:m.empty_palette??null,
  fill:m.fill_palette??null,evidence:m.evidence??[]});
const mark=m=>m.receipt&&{ref:m.receipt.support_ref,structure:m.receipt.structure_ref,
  axes:m.receipt.axes.map(axis=>axis.groups.map(group=>({index:group.index,units:group.units?.length??0,
    points:group.units?.map(u=>u.pixels)??[]})))};

export async function play(engine,variant,vendor){
  const {RootedQuotaMemory,rootedQuotaBefore}=await import(new URL('src/logos-engine/v6-rooted-quota-access.ts',engine));
  const {measureRootedQuota,measureRootedLengths}=await import(new URL('src/logos-engine/v6-rooted-quota-observation.ts',engine));
  const {measureRootedQuotaWithMarkSupport}=await import(new URL('src/logos-engine/v6-rooted-quota-mark-support.ts',engine));
  const family=RootedQuotaMemory.prototype,cuts=new Map(),records=new Map(),guards=new Map();
  const propose=family.proposeRooted,record=family.record,hooks=[mock.method(Date,'now',()=>1700000000000)];
  let measured,change=null;
  hooks.push(mock.method(family,'proposeRooted',function(obs,rows,inputs,limit,config,deadline,now,base,native){
    const prior=this.currentState().quota_model,extended=native?.extendedMarkSupport===true;
    const support=measureRootedQuotaWithMarkSupport(rows,prior.empty_palette??null);
    const scene=extended?support.scene:measureRootedQuota(rows,prior.empty_palette??null);
    const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),scene:summary(scene),
      lengths:scene&&measureRootedLengths(rows,scene,prior),prior:model(prior),support:{status:support.status,reason:support.reason,mark:mark(support)}};
    const cut={pre,seal:digest(pre)};
    cuts.set(obs.observation_ref,cut);
    const p=propose.call(this,obs,rows,inputs,limit,config,deadline,now,base,native),plan=p?.rooted_quota_plan;
    cut.local={status:p?.status??'abstained',reason:p?.reason??null};
    if(plan){
      measured={scene:plan.scene,model:plan.model};
      const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
      guards.set(obs.observation_ref,{live:rootedQuotaBefore(p,0,rows,meta,native),
        stale:rootedQuotaBefore(p,0,rows,{...meta,observation_ref:obs.observation_ref+':old'},native)});
    }
    return p;
  }));
  hooks.push(mock.method(family,'record',function(b,cmd,a,rows,later,p,i){
    const events=record.call(this,b,cmd,a,rows,later,p,i),plan=p.rooted_quota_plan;
    if(plan){
      const event=events[0];
      records.set(a.observation_ref,{event:event&&{model:model(event.model),context:event.context,stop:event.stop_reason,
        support:event.native_mark_support?.after_status??null,refs:event.evidence},
        expectedStep:p.steps[i].prediction?.after??null});
    }
    return events;
  }));
  try{
    const result=await rejouerService({engine,vendor,gameCode:'THER',sessionId:'ther-65',
      limit:variant==='nominal'?16:1,reprise:true,entries:{cuts,records,guards},
      describe(p,i){
        const plan=p.rooted_quota_plan,step=p.steps[i];
        return {plan:plan?{phase:plan.phase,chain:step.chain,rank:step.rank,before:step.prediction?.before??plan.lengths_before,
          predicted:step.prediction?.after??null,desired:plan.method?.values?.retained_domains??null,
          steps:p.actions.length}:null};
      },
      present({actual,board,pre,i}){
        if(i!==1||variant==='nominal')return actual;
        if(variant==='stationnaire')return {...board,frames:[board.frame]};
        const {scene}=measured,altered=structuredClone(actual.frame);
        const [x,y]=scene.chains[pre.plan.chain].points[0],color=actual.frame[y][x];
        assert.notEqual(color,scene.empty_content_palette);
        const sister=scene.chains.findIndex((c,j)=>j!==pre.plan.chain&&c.points.every(([u,v])=>actual.frame[v][u]===scene.empty_content_palette));
        assert.ok(sister>=0);
        const [cx,cy]=scene.chains[sister].cells[0];
        for(let v=scene.y_lines[cy]+1;v<scene.y_lines[cy+1];v++){
          for(let u=scene.x_lines[cx]+1;u<scene.x_lines[cx+1];u++){
            if(altered[v][u]===scene.empty_content_palette)altered[v][u]=color;
          }
        }
        change={sister,rank:0,cell:[cx,cy],color};
        return {...actual,frame:altered,frames:[altered]};
      }});
    return {...result,change,cuts:[...cuts.values()]};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  assert.ok(['nominal','stationnaire','soeur-modifiee'].includes(values.variante));
  const go=e=>play(e,values.variante,resolve(values.pyodide));
  const r=values.source?await go(values.source):await withEngine(values.moteur,go);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.phase??s.pre.family,JSON.stringify(s.pre.command),s.after.matched,s.after.seal,s.after.levels);
  console.log('suite',r.next?.command,r.stop,r.cuts.at(-1)?.local,r.change);
}
