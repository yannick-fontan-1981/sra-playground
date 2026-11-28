import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

function rectangles(parts,layout){
  const groups=new Map();
  for(const p of parts){
    const [l,t,r,b]=p.bbox,w=r-l+1;
    if(w!==b-t+1||w<3||p.area!==4*(w-1)||t===layout.inventory[0][1])continue;
    const key=t+','+w;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(p);
  }
  return Array.from(groups.values(),group=>group.sort((a,b)=>a.bbox[0]-b.bbox[0]))
    .find(group=>digest(group.map(p=>p.color))===digest(layout.word));
}
function recolor(rows,box,from,to,rim=false){
  const [l,t,r,b]=box;
  for(let y=t;y<=b;y++)for(let x=l;x<=r;x++){
    if(rim&&x!==l&&x!==r&&y!==t&&y!==b)continue;
    assert.equal(rows[y][x],from);
    rows[y][x]=to;
  }
}

export async function play(engine,variant,vendor){
  const {SlotSubstitution,measureSlotLayout,readSlotState}=await import(new URL('src/logos-engine/v6-slot-substitution.ts',engine));
  const {geometricComponents}=await import(new URL('src/logos-engine/v6-native-observer.ts',engine));
  const family=SlotSubstitution.prototype,propose=family.propose,record=family.record;
  const cuts=new Map(),records=new Map(),guards=new Map(),hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1,change=null,swaps=null,scene=null,edited=false;
  function permutation(rows){
    const apply=()=>{const next=structuredClone(rows);
      for(const pair of swaps)recolor(next,pair.box,pair.from,pair.to,true);
      return next;};
    if(swaps)return apply();
    const parts=geometricComponents(rows),obs={entities:parts.map(p=>({...p,palette_value:p.color}))};
    const layout=measureSlotLayout(obs,rows);
    assert.ok(layout);
    const frames=rectangles(parts,layout);
    assert.ok(frames);
    for(const [i,left] of frames.entries())for(const right of frames.slice(i+1)){
      if(left.color===right.color)continue;
      swaps=[{box:left.bbox,from:left.color,to:right.color},{box:right.bbox,from:right.color,to:left.color}];
      const next=apply(),altered=geometricComponents(next),after=measureSlotLayout({entities:altered.map(p=>({...p,palette_value:p.color}))},next);
      if(!after||digest(after.slots)!==digest(layout.slots)||digest(after.inventory)!==digest(layout.inventory)
        ||after.targets[0]===layout.targets[0])continue;
      change={swaps,targetsBefore:layout.targets,targetsAfter:after.targets};
      return next;
    }
    throw new Error('Aucune permutation à appariement distinct');
  }

  hooks.push(mock.method(family,'propose',async function(obs,rows,inputs,limit){
    const layout=this.epoch===obs.level_epoch?this.scene:measureSlotLayout(obs,rows);
    const shortlist=layout&&[...layout.inventory,...layout.slots].map(box=>({box,count:inputs.filter(c=>c.data
      &&box[0]<=c.data.x&&c.data.x<=box[2]&&box[1]<=c.data.y&&c.data.y<=box[3]).length}));
    const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),layout,occupancy:layout&&readSlotState(rows,layout),
      known:this.epoch===obs.level_epoch?[...this.tested].sort():[],refs:this.epoch===obs.level_epoch?[...this.refs]:[],
      retired:this.epoch===obs.level_epoch&&this.retired,shortlist};
    const cut={pre,seal:digest(pre)};
    cuts.set(obs.observation_ref,cut);
    const permuted=turn===3&&variant==='ordre-entrees';
    const p=await propose.call(this,obs,rows,permuted?[...inputs].reverse():inputs,limit);
    cut.local=p?{kind:p.kind,operation:p.steps[0].operation,command:p.actions[0]}:null;
    if(p){
      scene=this.scene;
      const pub={level:obs.level_epoch,levels_completed:obs.levels_completed,available_action_refs:obs.available_action_refs,frame_rows:rows};
      guards.set(obs.observation_ref,{live:this.before(p,0,pub,obs),stale:this.before(p,0,pub,
        {...obs,observation_ref:obs.observation_ref+':old'})});
    }
    return p;
  }));
  hooks.push(mock.method(family,'record',function(b,a,cmd,first,second,p,i){
    const result=record.call(this,b,a,cmd,first,second,p,i);
    records.set(a.observation_ref,{result,status:this.retired?'retired':'available',known:[...this.tested].sort(),refs:[...this.refs],
      occupancy:b.level_epoch===a.level_epoch?readSlotState(second,this.scene):null});
    return result;
  }));
  try{
    const result=await rejouerService({engine,vendor,gameCode:'SB26',sessionId:'sb26-85',limit:variant==='nominal'?16:
      variant==='autre-contenu'?5:3,reprise:true,entries:{cuts,records,guards},onTurn:i=>turn=i,
      initial(board){
        if(variant!=='ordre-reference')return board;
        const frame=permutation(board.frame);
        return {...board,frame,frames:[frame]};
      },
      describe(p,i){
        const step=p.steps[i];
        return {plan:p.slot_plan?{layout:p.slot_plan,op:step.operation,before:step.state,after:step.expected_after,
          box:step.address_box,steps:p.steps.map(v=>({operation:v.operation,state:v.state,expected:v.expected_after}))}:null};
      },
      present({actual,pre,i}){
        if(variant==='ordre-reference'&&i<=3){
          const frame=permutation(actual.frame);
          return {...actual,frame,frames:[frame]};
        }
        if(variant!=='autre-contenu'||edited||pre.plan?.op!=='place')return actual;
        const index=scene.slots.findIndex(b=>digest(b)===digest(pre.plan.box)),from=scene.targets[index],to=scene.hues.find(v=>v!==from);
        assert.ok(index>=0&&to!==undefined);
        const frame=structuredClone(actual.frame);
        recolor(frame,pre.plan.box,from,to);
        change={index,from,to,box:pre.plan.box,turn:i};
        edited=true;
        return {...actual,frame,frames:[frame]};
      }});
    return {...result,change,cuts:[...cuts.values()]};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  assert.ok(['nominal','ordre-reference','ordre-entrees','autre-contenu'].includes(values.variante));
  const go=e=>play(e,values.variante,resolve(values.pyodide));
  const r=values.source?await go(values.source):await withEngine(values.moteur,go);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.op??s.pre.family,JSON.stringify(s.pre.command),s.after.matched,s.after.seal,s.after.levels);
  console.log('suite',r.next?.command,r.next?.plan?.op,r.stop,r.change);
}
