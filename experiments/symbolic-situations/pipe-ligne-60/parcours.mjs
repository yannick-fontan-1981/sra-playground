import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {mock} from 'node:test';
import {digest,rejouerService} from './rejouer-service.mjs';
import {loadGame} from './frontiere-22-23/game.mjs';
import {withEngine} from './moteur-reference.mjs';

const [arm,vendor,out]=process.argv.slice(2);
const limits={nominal:16,stationnaire:2,autrePièce:2,sansMéthode:3,preuveÉtrangère:4,extérieur:15};
assert.ok(Object.hasOwn(limits,arm));
const directions=[[0,-1],[1,0],[0,1],[-1,0]];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function readings(scene){
  if(!scene)return null;
  const {cells,geometry_ref}=scene,ports=cells.map(c=>c.ports);
  const grid=new Map(cells.map(c=>[c.grid.join(','),c]));
  const joins=[],open=[];
  for(const cell of cells){
    const [x,y]=cell.grid;
    for(const i of cell.ports){
      const [dx,dy]=directions[i];
      const neighbour=grid.get([x+dx,y+dy].join(','));
      if(neighbour?.ports.includes((i+2)%4)){
        if(cell.index<neighbour.index)joins.push([cell.index,neighbour.index]);
      }else open.push([cell.index,i,neighbour?.index??null]);
    }
  }
  return {ports,joins,open,geometry:geometry_ref};
}
const snapshot=s=>({method:s.port_point_rule,prior:s.port_prior,rejected:s.port_rejected,
  history:s.port_events.map(e=>[e.kind,e.evidence??null,e.rule?.turn??null])});
const recordKeys=['evidence','rule','refuted','ports_prediction_matched','selection_observed','goal_terminal_status'];
async function play(engine){
  const prefix='src/logos-engine/v6-radial-port-';
  const {RadialPortMemory,radialPortBefore}=await import(new URL(prefix+'access.ts',engine));
  const {measureRadialPorts,radialAtGeometry,selectedRadialOccurrence}=await import(new URL(prefix+'observation.ts',engine));
  const M=RadialPortMemory.prototype,cuts=new Map(),guards=new Map(),records=new Map();
  const {proposeRadial,record}=M;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1,alternative=null;
  hooks.push(mock.method(M,'proposeRadial',function(obs,rows,...args){
    const beforehand=this.currentState(),scene=measureRadialPorts(rows),method=this.pointRule;
    let change;
    if(arm==='sansMéthode'&&turn===2){
      assert.ok(method);
      change={removed:method.evidence};
      this.pointRule=null;
    }
    if(arm==='preuveÉtrangère'&&turn===4){
      assert.ok(method);
      const previous=beforehand.port_events.find(e=>e.rule&&e.evidence.every(ref=>!method.evidence.includes(ref)));
      assert.ok(previous);
      change={authentic:method.evidence,foreign:previous.evidence};
      this.pointRule={...method,evidence:previous.evidence};
    }
    try{
      cuts.set(obs.observation_ref,structuredClone({ref:obs.observation_ref,scene:readings(scene),raster:digest(rows),
        before:snapshot(beforehand),used:snapshot(this.currentState()),change}));
      const p=proposeRadial.call(this,obs,rows,...args);
      if(p?.radial_port_plan){
        const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
        guards.set(obs.observation_ref,{live:radialPortBefore(p,0,rows,meta),
          stale:radialPortBefore(p,0,rows,{...meta,observation_ref:meta.observation_ref+':ancien'})});
      }
      return p;
    }finally{if(change)this.pointRule=method;}
  }));
  hooks.push(mock.method(M,'record',function(b,command,a,rows,later,p,index){
    const items=record.call(this,b,command,a,rows,later,p,index);
    const plan=p.radial_port_plan;
    if(plan){
      const expected=plan.steps[index],first=radialAtGeometry(rows,plan.scene),second=radialAtGeometry(later,plan.scene);
      const result=readings(second),before=readings(first);
      const changed=second&&second.cells.filter(cell=>!equal(cell.ports,expected.ports_before[cell.index])).map(x=>x.index);
      const conserved=second&&readings(second).joins.filter(e=>before.joins.some(old=>equal(old,e)));
      const gained=second&&result.joins.filter(e=>!conserved.some(x=>equal(x,e)));
      const lost=second&&before.joins.filter(e=>!conserved.some(x=>equal(x,e)));
      const measured={before,result,changed,gained,lost,selected:second&&selectedRadialOccurrence(later,second),
        event:items[0]?Object.fromEntries(recordKeys.map(k=>[k,items[0][k]])):null};
      records.set(a.observation_ref,structuredClone(measured));
    }
    return items;
  }));
  try{
    const run=await rejouerService({engine,vendor,gameCode:'PIPE',sessionId:'pipe-60',entries:{cuts,guards,records},
      limit:limits[arm],reprise:arm!=='nominal',onTurn:i=>turn=i,
      describe(p,i){
        const q=p.radial_port_plan,s=p.steps[i];
        return {plan:q?{reason:p.question.reason,cell:s.cell,point:q.scene.cells[s.cell].point,
          portsBefore:s.ports_before,portsAfter:s.ports_after,turn:q.sign,revalidated:q.point_method_revalidated,
          length:q.steps.length,scope:q.goal_status}:null};
      },
      async present({board,actual,pre,i}){
        if(arm==='extérieur'&&i===14){
          const scene=measureRadialPorts(board.frame);
          assert.ok(scene.cells.every(c=>c.bbox[0]>0||c.bbox[1]>0));
          const raster=actual.frame.map(r=>[...r]),v=raster[0][0];
          raster[0][0]=(v+1)%16;
          alternative={extérieur:[0,0],avant:v,après:raster[0][0]};
          return {...actual,frame:raster,frames:[raster]};
        }
        if(i!==1)return actual;
        if(arm==='stationnaire')return {...board,frames:[board.frame]};
        if(arm!=='autrePièce')return actual;
        const game=await loadGame('PIPE',vendor,engine);
        assert.equal(digest(game.initial.frame),digest(board.frame));
        const scene=measureRadialPorts(board.frame);
        const foreign=scene.cells.find(c=>c.index!==pre.plan.cell&&(!c.ports.includes((c.ports[0]+1)%4)||c.ports.length>1));
        assert.ok(foreign);
        const [x,y]=foreign.point,packet=await game.step(6,{x,y});
        alternative={cell:foreign.index,action:['ACTION6',{x,y}],from:digest(board.frame),to:digest(packet.frame)};
        return packet;
      }});
    return {...run,alternative};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
writeFileSync(out,JSON.stringify(await withEngine('revision',play))+'\n');
