import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const field=f=>({x:f.xs,y:f.ys,size:f.size,cells:f.xs.length*f.ys.length});
const table=t=>[...t].map(([k,v])=>({cell:k.split(',').map(Number),actual:v.actual,expected:[...v.eq],
  sources:[...v.sources].map(s=>s.split(',').map(Number))})).sort((a,b)=>a.cell[0]-b.cell[0]||a.cell[1]-b.cell[1]);
const retained=s=>({epoch:s.epoch,rule:s.rule,tests:s.tests,rejected:s.rejected,deactivated:s.deactivated});

const lattice=[[8,10,8,10],[11,12,11,12],[9,10,9,10],[11,12,11,12]];
function candidateRaster(size,ambiguity){
  const rows=Array.from({length:size[1]},()=>Array(size[0]).fill(0));
  const pattern=structuredClone(lattice);
  if(!ambiguity)pattern[0][2]=9;
  for(const [y,row] of pattern.entries())for(const [x,color] of row.entries()){
    for(let v=12+10*y;v<16+10*y;v++)for(let u=12+10*x;u<16+10*x;u++)rows[v][u]=color;
  }
  return rows;
}

export async function play(engine,variant,vendor){
  const {SymmetricField,measuredFields,symmetryEvidence,periodicHypotheses}=await import(new URL('src/logos-engine/v6-field-constraints.ts',engine));
  const family=SymmetricField.prototype,propose=family.propose,record=family.record;
  const synthetic=['ambigu','contraste-clair'].includes(variant);
  const cuts=new Map(),records=new Map(),guards=new Map(),hooks=[mock.method(Date,'now',()=>1700000000000)];
  let change=null;
  hooks.push(mock.method(family,'propose',async function(obs,rows,inputs,limit){
    const memory=this.state(),fields=measuredFields(obs),hypotheses=[];
    for(const f of fields){
      const shape=[f.xs[0],f.ys[0],f.xs.length,f.ys.length,[...f.size]];
      const add=(family,fit)=>{
        if(!fit)return;
        const prior=memory.epoch===obs.level_epoch?memory.rule:null;
        hypotheses.push({family,shape,counts:fit[1],constraints:table(fit[0]),compatible:!prior||digest([prior.lattice,prior.family])===digest([shape,family])});
      };
      for(const id of this.policy.isometries)add(id,symmetryEvidence(f,id));
      for(const [id,tab,counts] of periodicHypotheses(f,this.policy.maximum_hypothetically_omitted_values??0))add(id,[tab,counts]);
    }
    const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),fields:fields.map(field),hypotheses,
      memory:retained(memory),actions:obs.available_action_refs};
    const cut={pre,seal:digest(pre)};
    cuts.set(obs.observation_ref,cut);
    const p=await propose.call(this,obs,rows,inputs,limit);
    cut.local=p?{command:p.actions[0],rule:p.constraint_plan.rule}:null;
    if(p)guards.set(obs.observation_ref,{live:await this.before(p,0,obs,rows),
      stale:await this.before(p,0,{...obs,observation_ref:obs.observation_ref+':old'},rows)});
    return p;
  }));
  hooks.push(mock.method(family,'record',function(b,a,cmd,first,second,p,i){
    const result=record.call(this,b,a,cmd,first,second,p,i);
    records.set(a.observation_ref,{result,memory:retained(this.state())});
    return result;
  }));

  try{
    const result=await rejouerService({engine,vendor,gameCode:'SYME',sessionId:'syme-78',
      limit:synthetic||variant==='autre-reference'?0:variant==='nominal'?16:1,reprise:true,entries:{cuts,records,guards},
      initial(board){
        if(variant==='autre-reference'){
          const frame=structuredClone(board.frame),[x,y]=[53,33];
          for(let j=y;j<y+5;j++)for(let k=x;k<x+5;k++){
            assert.equal(frame[j][k],9);
            frame[j][k]=8;
          }
          change={cell:[x,y],from:9,to:8};
          return {...board,frame,frames:[frame]};
        }
        if(!synthetic)return board;
        const frame=candidateRaster([board.frame[0].length,board.frame.length],variant==='ambigu');
        return {...board,frame,frames:[frame]};
      },
      describe(p,i){
        if(p.kind!=='public_symmetric_field')return {plan:null};
        const plan=p.constraint_plan,step=p.steps[i];
        return {plan:{rule:plan.rule,fit:plan.fit,size:plan.cell_size,cell:step.constraint,predicted:step.expected_after!==null,
          steps:p.steps.map(s=>s.constraint)}};
      },
      present({actual,pre,i}){
        if(variant!=='retour-contraire'||i!==1)return actual;
        const [x,y]=pre.plan.cell.p,[w,h]=pre.plan.size;
        const desired=pre.plan.cell.equal[0],before=pre.plan.cell.before;
        const to=Array.from({length:16},(_,k)=>k).find(v=>v!==desired&&v!==before&&v!==actual.frame[y][x]);
        const frame=structuredClone(actual.frame);
        for(let j=y;j<y+h;j++)for(let k=x;k<x+w;k++)frame[j][k]=to;
        change={cell:[x,y],shape:[w,h],physical:actual.frame[y][x],to,desired};
        return {...actual,frame,frames:[frame]};
      }});
    return {...result,change,cuts:[...cuts.values()],synthetic};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  assert.ok(['nominal','ambigu','contraste-clair','retour-contraire','autre-reference'].includes(values.variante));
  const go=e=>play(e,values.variante,resolve(values.pyodide));
  const r=values.source?await go(values.source):await withEngine(values.moteur,go);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.fit?.geometries??s.pre.family,JSON.stringify(s.pre.command),
    s.after.record?.result?.status,s.after.matched,s.after.seal,s.after.levels);
  console.log('suite',r.next?.command,r.next?.family,r.cuts.at(-1)?.local,r.stop,r.change);
}
