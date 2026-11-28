import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const variants=['nominal','stationnaire','sans-methode','pixel-exterieur','autre-port'];
const directions=[[0,-1],[1,0],[0,1],[-1,0]];
const memory=s=>({prior:s.port_prior,rule:s.port_point_rule,rejected:s.port_rejected,refs:s.port_events.map(e=>e.evidence)});
const geometry=s=>s&&{origin:s.origin,pitch:s.pitch,shape:s.shape,border:s.border,substrate:s.substrate,ref:s.geometry_ref,cells:s.cells};
function links(cells){
  const joined=[],open=[];
  for(const cell of cells)for(const direction of cell.ports){
    const [dx,dy]=directions[direction],[x,y]=cell.grid,other=cells.find(c=>c.grid[0]===x+dx&&c.grid[1]===y+dy),opposite=(direction+2)%4;
    if(!other?.ports.includes(opposite))open.push([cell.index,direction]);
    else if(cell.index<other.index)joined.push([cell.index,direction,other.index,opposite]);
  }
  return {joined,open};
}

export async function play(engine,variant,vendor,target){
  assert.ok(variants.includes(variant));
  assert.ok(variant==='nominal'||Number.isInteger(target)&&target>0);
  const prefix='src/logos-engine/v6-radial-port-';
  const {RadialPortMemory,radialPortBefore,radialPortAfter}=await import(new URL(prefix+'access.ts',engine));
  const {assemblePorts}=await import(new URL('src/logos-engine/v6-port-assembly.ts',engine));
  const {measureRadialPorts,radialAtGeometry,selectedRadialOccurrence,radialAssemblyModel,rotateRadialPorts}=await import(
    new URL(prefix+'observation.ts',engine));
  const family=RadialPortMemory.prototype,cuts=new Map(),records=new Map(),guards=new Map();
  const propose=family.proposeRadial,record=family.record;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1,changedPixel=null,frozenScene=null;
  hooks.push(mock.method(family,'proposeRadial',function(obs,rows,inputs,limit,config,base){
    const prior=this.currentState(),rule=this.pointRule,hide=turn===target&&variant==='sans-methode';
    if(hide){assert.ok(rule);this.pointRule=null;}
    try{
      const scene=measureRadialPorts(rows),recognized=geometry(scene);
      const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),available:obs.available_action_refs,
        scene:recognized,links:scene&&links(scene.cells),prior:memory(prior),used:memory(this.currentState())});
      const cut={pre,seal:digest(pre)};
      cuts.set(obs.observation_ref,cut);
      const p=propose.call(this,obs,rows,inputs,limit,config,base),plan=p?.radial_port_plan;
      if(plan){
        frozenScene=plan.scene;
        const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
        guards.set(obs.observation_ref,{live:radialPortBefore(p,0,rows,meta),
          stale:radialPortBefore(p,0,rows,{...meta,observation_ref:meta.observation_ref+':old'})});
        if(turn===1){
          const [model,current]=radialAssemblyModel(scene),targetPoses=assemblePorts(model,current,null,plan.sign);
          const cells=scene.cells.map((c,i)=>({...c,ports:rotateRadialPorts(c.ports,targetPoses[i][0])}));
          cut.target={turns:targetPoses.map(p=>p[0]),ports:cells.map(c=>c.ports),links:links(cells),visited:model.search_nodes};
        }
      }
      return p;
    }finally{if(hide)this.pointRule=rule;}
  }));
  hooks.push(mock.method(family,'record',function(b,cmd,a,rows,later,p,i){
    const events=record.call(this,b,cmd,a,rows,later,p,i),plan=p.radial_port_plan;
    if(plan){
      const valid=a.level_epoch===b.level_epoch,next=valid?radialAtGeometry(later,plan.scene):null;
      records.set(a.observation_ref,structuredClone({event:events[0]??null,state:memory(this.currentState()),ports:next?.cells.map(c=>c.ports)??null,
        links:next&&links(next.cells),selected:next&&selectedRadialOccurrence(later,next),
        actual:radialPortAfter(p,i,rows,later,{epoch:a.level_epoch,score:a.levels_completed,state:a.state})}));
    }
    return events;
  }));
  try{
    const scope=variant==='nominal'?16:variant==='sans-methode'?target-1:target;
    const r=await rejouerService({engine,vendor,gameCode:'PIPE',sessionId:'pipe-60',entries:{cuts,guards,records},
      limit:scope,reprise:variant!=='nominal',onTurn:i=>turn=i,
      describe(p,i){
        const plan=p.radial_port_plan;
        return {plan:plan?{steps:plan.steps,step:plan.steps[i],sign:plan.sign,known:plan.point_method_revalidated,
          searchNodes:plan.search_nodes,goal:plan.goal_status,why:p.question.reason}:null};
      },
      present({board,actual,pre,i}){
        if(i!==target||variant==='nominal')return actual;
        if(variant==='stationnaire')return {...board,frames:[board.frame]};
        const altered=actual.frame.map(row=>[...row]);
        if(variant==='pixel-exterieur'){
          const [l,t,r,b]=frozenScene.cells[pre.plan.step.cell].bbox;
          for(const [x,y] of [[0,0],[63,0],[0,63],[63,63]]){
            if(l<=x&&x<=r&&t<=y&&y<=b||board.frame[y][x]!==actual.frame[y][x])continue;
            altered[y][x]=(altered[y][x]+1)%16;
            changedPixel={point:[x,y],before:actual.frame[y][x],after:altered[y][x]};
            break;
          }
        }else{
          const scene=radialAtGeometry(altered,frozenScene),cell=scene.cells.find(c=>c.index!==pre.plan.step.cell&&c.ports.length>1);
          const [dx,dy]=directions[cell.ports[0]],k=Math.max(1,Math.floor(scene.pitch/4)),[cx,cy]=cell.point;
          const [x,y]=[cx+dx*k,cy+dy*k];
          altered[y][x]=scene.substrate;
          changedPixel={point:[x,y],cell:cell.index,before:actual.frame[y][x],after:altered[y][x]};
        }
        assert.ok(changedPixel);
        return {...actual,frame:altered,frames:[altered]};
      }});
    return {...r,changedPixel};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},tour:{type:'string'},recu:{type:'string'}}});
  const playOne=e=>play(e,values.variante,resolve(values.pyodide),Number(values.tour));
  const r=values.source?await playOne(values.source):await withEngine(values.moteur,playOne);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.why??s.pre.kind,JSON.stringify(s.pre.command),
    s.after.matched,s.after.seal,s.after.levels);
  if(r.stop)console.log(r.stop);
}
