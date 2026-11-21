import assert from 'node:assert/strict';
import { hash } from './sic-study-source-replay.mjs';

const bit=i=>1n<<BigInt(i);
const pop=n=>n.toString(2).replaceAll('0','').length;
function solve(columns,residual,n) {
  const basis=new Map();
  for(const [i,observed] of columns){
    let effects=observed,word=bit(i);
    for(let k=n-1;k>=0;k--){
      if(!(effects&bit(k)))continue;
      const row=basis.get(k);
      if(!row){basis.set(k,{effects,word});break;}
      effects^=row.effects;word^=row.word;
    }
  }
  let word=0n;
  for(let k=n-1;k>=0;k--){
    if(!(residual&bit(k)))continue;
    const row=basis.get(k);if(!row)return null;
    residual^=row.effects;word^=row.word;
  }
  return Array.from({length:n},(_,i)=>i).filter(i=>(word&bit(i))!==0n);
}

function readState(board,plan) {
  let mask=0n;
  for(const [i,site] of plan.obligations.entries()){
    const [x,y,r,b]=site.box;
    const values=new Set(site.mask?site.mask.map(([u,v])=>board.frame[y+v]?.[x+u]):board.frame.slice(y,b+1).flatMap(row=>row.slice(x,r+1)));
    const active=plan.palette.filter(c=>values.has(c));
    if(active.length!==1||(!site.palette&&values.size!==1))return null;
    if(active[0]===plan.palette[1])mask|=bit(i);
  }
  return mask;
}
function goal(plan){
  let mask=0n;
  for(const [i,s] of plan.obligations.entries()){
    const allowed=plan.palette.filter(c=>s.equal.every(v=>v===c)&&!s.different.includes(c));
    if(allowed.length!==1)return null;
    if(allowed[0]===plan.palette[1])mask|=bit(i);
  }
  return mask;
}
const click=box=>'ACTION6:'+Math.floor((box[0]+box[2])/2)+','+Math.floor((box[1]+box[3])/2);
function inferColumns(plan,board,columns) {
  const sites=plan.obligations,at=new Map(sites.map((s,i)=>[s.box.slice(0,2).join(),i]));
  const roles=sites.map(s=>{
    const [x,y,r,b]=s.box;
    return JSON.stringify(board.frame.slice(y,b+1).map(row=>row.slice(x,r+1).map(c=>plan.palette.includes(c)?'state':c)));
  });
  const byRole=new Map();
  for(const [i,delta] of columns){
    const p=sites[i].box,offsets=sites.flatMap((s,j)=>delta&bit(j)?[[s.box[0]-p[0],s.box[1]-p[1],roles[j]]]:[]);
    offsets.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const group=byRole.get(roles[i])??[];group.push(offsets);byRole.set(roles[i],group);
  }
  const all=new Map(columns);
  for(const [i,site] of sites.entries()){
    if(all.has(i))continue;
    const bindings=byRole.get(roles[i]);
    if(!bindings || bindings.length<2 || !bindings[0].length ||
      !bindings.every(v=>JSON.stringify(v)===JSON.stringify(bindings[0])))continue;
    let mask=0n;
    for(const [x,y,role] of bindings[0]){
      const j=at.get([site.box[0]+x,site.box[1]+y].join());
      if(j===undefined||roles[j]!==role){mask=0n;break;}
      mask|=bit(j);
    }
    if(mask)all.set(i,mask);
  }
  return all;
}
export function experiment(run,rep,plan,{transferColumns=false,prefix=0,ordinaryOnly=false}={}) {
  let board=rep.restore(prefix),state=readState(board,plan);const desired=goal(plan);
  if(desired===null||state===null)return null;
  const geometry=plan.obligations,inputs=geometry.map(s=>s.input??click(s.box)),columns=new Map(),tape=[],forecast=[];
  const initialErrors=pop(state^desired);
  let stop='action_cap';
  while(prefix+tape.length<run.cap){
    const residual=state^desired;
    if(!residual){stop='all_observed_constraints_satisfied';break;}
    const proposed=transferColumns ? inferColumns(plan,board,columns) : columns;
    const model=ordinaryOnly?new Map([...proposed].filter(([i])=>!geometry[i].palette)):proposed;
    const word=solve(model,residual,geometry.length);
    const available=inputs.map((_,i)=>i).filter(i=>!columns.has(i)&&(!ordinaryOnly||!geometry[i].palette)).sort((a,b)=>
      Number(!!geometry[b].palette)-Number(!!geometry[a].palette) || Number(!!(residual&bit(b)))-Number(!!(residual&bit(a))) || a-b);
    const choice=word?.[0]??available[0];
    if(choice===undefined){stop='outside_span_of_observed_controls';break;}
    if(!board.availableActionIds.includes(6)){stop='point_input_unavailable';break;}
    const expected=model.get(choice),before=state;
    const kind=!word?'probe':columns.has(choice)?'composed':'transferred';
    board=rep.act(inputs[choice]);tape.push(choice);
    if(rep.win(board)){stop='official_completion';forecast.push({choice,kind,won:true});break;}
    if(board.state!=='NOT_FINISHED'){stop='terminal';break;}
    state=readState(board,plan);
    if(state===null){stop='role_measurement_changed';break;}
    const delta=before^state;
    forecast.push({choice,kind,changedSites:pop(delta),remaining:pop(state^desired),
      matched:expected===undefined?null:expected===delta});
    if(expected!==undefined&&expected!==delta){stop='effect_depends_on_context';break;}
    columns.set(choice,delta);
  }
  const won=rep.win(board);
  let controls;
  if(won){
    function replay(selected){
      let b=rep.restore(prefix),used=0;for(const i of selected){if(rep.win(b)||b.state!=='NOT_FINISHED')break;b=rep.act(inputs[i]);used++;}
      return {won:rep.win(b),used,final:hash(b).slice(0,16)};
    }
    const repeat=replay(tape);assert.ok(repeat.won&&repeat.final===hash(board).slice(0,16));
    controls={repeat,withoutDecorated:replay(tape.filter(i=>!geometry[i].palette)),
      probesOnly:replay(tape.filter((_,i)=>forecast[i]?.kind==='probe'))};
  }
  return {cues:plan.cues.length,sites:geometry.length,decoratedSites:geometry.filter(s=>s.palette).length,
    unresolved:plan.unbound.length,initialErrors,actions:tape.length,stop,won,forecast,controls};
}
