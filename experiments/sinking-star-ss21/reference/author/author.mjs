import {writeFileSync} from 'node:fs';
import {compileLevel,initialState,stepDetailed,circuitPressed} from '../../dist/core.js';
import {decodeCommand,replay,stateKey,solve} from '../../scripts/solver.mjs';

/** Author tooling only: routes and private state never enter the playable bundle. */
export class Author {
 constructor(spec){this.spec=spec;this.world=compileLevel(spec);this.state=initialState(this.world);this.commands='';this.stages=[];this.ox=Math.floor((20-spec.rows[0].length)/2);this.oy=Math.floor((20-spec.rows.length)/2);}
 point(x,y){return{x:x+this.ox,y:y+this.oy};}
 get hero(){return this.state.heroes[this.state.active];}
 act(commands){for(const c of commands.replace(/\s/g,'')){const a=decodeCommand(c,this.state),d=stepDetailed(this.world,this.state,a.id,a.data);if(d.state.failed||d.state.dead||this.state.complete)throw Error(JSON.stringify({error:'Invalid author action',command:c,previous:this.commands,hero:this.hero,phases:d.phases.map(p=>p.kind),failed:d.state.failed,dead:d.state.dead}));this.state=d.state;this.commands+=c;}return this;}
 select(kind){if(!this.state.heroes.some(h=>h.kind===kind))throw Error(`Unknown hero kind ${kind}`);for(let i=0;this.hero.kind!==kind&&i<this.state.heroes.length;i++)this.act('C');return this;}
 // Walking routes never push, pull, swap, reflect, or move an occupant indirectly.
 go(x,y,kind){if(kind)this.select(kind);const target=this.point(x,y);if(this.hero.at.x===target.x&&this.hero.at.y===target.y)return this;
  const queue=[{state:this.state,route:''}],seen=new Set([stateKey(this.state)]);
  for(let i=0;i<queue.length&&i<16000;i++){const n=queue[i];for(const c of 'UDLR'){
   const a=decodeCommand(c,n.state),d=stepDetailed(this.world,n.state,a.id),h=d.state.heroes[d.state.active];
   if(d.state.failed||d.state.dead||d.phases.some(p=>!['walk','gate','platform'].includes(p.kind)||p.moves.some(m=>m.actor!=='hero')))continue;
   const route=n.route+c;if(h.at.x===target.x&&h.at.y===target.y)return this.act(route);
   const key=stateKey(d.state);if(seen.has(key))continue;seen.add(key);queue.push({state:d.state,route});
  }}throw Error(JSON.stringify({error:'No walking route',target,kind:this.hero.kind,hero:this.hero.at,commands:this.commands,states:seen.size}));
 }
 seek(goal,options={}){const result=solve(this.spec,{maxStates:50000,maxMs:2500,...options,start:this.state,goal:(s,w)=>goal(s,w,this)});if(result.status!=='solved')throw Error(JSON.stringify({error:'Author stage not found',commands:this.commands,result}));return this.act(result.commands);}
 stage(label){this.stages.push({label,turn:this.commands.length,heroes:this.state.heroes.map(h=>({kind:h.kind,at:h.at})),stones:this.state.stones,supports:this.state.supports,mirrors:this.state.mirrors,monsters:this.state.monsters,circuits:Object.fromEntries(this.world.circuits.map(c=>[c.id,circuitPressed(this.world,this.state,c.id)]))});return this;}
 result(source,adaptation){const r=replay(this.spec,this.commands);if(!r.state.complete||r.metrics.blocked||r.metrics.deaths)throw Error('Unsolved author route');source={piston:!!this.spec.gates?.length,platform:!!this.spec.platforms?.length,...source};if(source.secondaryUrl){source.secondary={label:source.secondaryLabel??'Référence complémentaire',url:source.secondaryUrl};delete source.secondaryLabel;delete source.secondaryUrl;}return{spec:this.spec,commands:this.commands,actions:r.actions,source,metrics:r.metrics,stages:this.stages,adaptation};}
 save(path,source,adaptation){const d=this.result(source,adaptation);writeFileSync(path,JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({path:String(path),title:d.spec.title,metrics:d.metrics,commands:d.commands}));return d;}
}
export function board(width,height,background='#'){
 const rows=Array.from({length:height},()=>Array(width).fill(background));
 const put=(x,y,c='.')=>{rows[y][x]=c;};
 const fill=(x1,y1,x2,y2,c='.')=>{for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)put(x,y,c);};
 return{rows,put,fill,strings:()=>rows.map(r=>r.join(''))};
}
