import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {orientedCouplingInitial,orientedCouplingScene} from '../src/logos-engine/v6-oriented-coupling.ts';
import {supportParts} from '../src/logos-engine/v6-support-measurements.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const results=[];
const add=(p,d)=>p.map((v,i)=>v+d[i]),delta=(q,p)=>q.map((v,i)=>v-p[i]);
function carriers(rows,g,ink) {
  const groups=new Map();
  for(const part of supportParts(rows)) {
    const {width,height,left,top}=part.bbox;
    if (width!==g.pitch || height!==g.pitch || part.area!==g.pitch*g.pitch ||
      [g.core,g.background,ink].includes(part.value) || (left-g.phase[0])%g.pitch || (top-g.phase[1])%g.pitch) continue;
    const sites=groups.get(part.value)??[];
    sites.push([(left-g.phase[0])/g.pitch,(top-g.phase[1])/g.pitch]);groups.set(part.value,sites);
  }
  return groups;
}
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const r=JSON.parse(line),game=getGameByCode(r.code);
  assert.ok(game && game.group!=='custom_4' && !r.error && !r.resets && !r.observedPriorLevelActions && !r.sourcePrefixActions);
  const rep=sourceReplay(engine,{},r),initial=rep.restore(0),g=orientedCouplingInitial(initial.frame);
  assert.ok(g);
  const colors=[...new Set(initial.frame.flat())].filter(c=>![g.core,g.background,g.rest_shell].includes(c)&&orientedCouplingScene(initial.frame,g,c));
  assert.equal(colors.length,1);
  const ink=colors[0],targets=new Set(g.targets.map(p=>p.join())),handed=new Map(),releases=[],taken=[];
  let board=initial,old=orientedCouplingScene(board.frame,g,ink),oldPeers=carriers(board.frame,g,ink),maxPlaced=0;
  for (const [i,s] of r.steps.entries()) {
    board=rep.act(op(s));assert.equal(hash(board).slice(0,16),s.to);
    if (rep.win(board)||board.state!=='NOT_FINISHED') break;
    const scene=orientedCouplingScene(board.frame,g,ink),peers=carriers(board.frame,g,ink);
    if (!scene||!old) {handed.clear();old=scene;oldPeers=peers;continue;}
    const front=add(old.pose,old.face).join(),held=old.boxes[front]===old.face_value;
    const destinations=Object.keys(scene.boxes).filter(p=>!Object.hasOwn(old.boxes,p));
    const origins=Object.keys(old.boxes).filter(p=>!Object.hasOwn(scene.boxes,p));
    const moved=new Map();
    for(const [type,sites] of oldPeers) {
      const newer=peers.get(type);
      if(sites.length!==1 || newer?.length!==1) continue;
      const from=sites[0],d=delta(newer[0],from);
      if (d.reduce((n,v)=>n+Math.abs(v),0)!==1) continue;
      const candidates=origins.filter(p=>{
        const q=p.split(',').map(Number);
        return !(held&&p===front) && delta(q,from).reduce((n,v)=>n+Math.abs(v),0)===1 &&
          destinations.includes(add(q,d).join());
      });
      if(candidates.length===1) moved.set(candidates[0],add(candidates[0].split(',').map(Number),d).join());
    }
    const transfers=[];
    for(const p of origins) {
      const event=handed.get(p),to=moved.get(p);
      handed.delete(p);
      if (!event||!to||[...moved.values()].filter(k=>k===to).length!==1) continue;
      event.pickup??=i+1;
      if (targets.has(to)) event.arrival??=i+1;
      transfers.push([to,event]);
    }
    for(const [to,event] of transfers) handed.set(to,event);
    const changed=Object.hasOwn(scene.boxes,front)&&scene.boxes[front]!==old.boxes[front];
    if (s.a===5 && changed && old.pose.join()===scene.pose.join()) {
      if (held && !targets.has(front) && scene.boxes[front]!==scene.face_value) {
        const event={release:i+1};releases.push(event);handed.set(front,event);
      } else handed.delete(front);
    }
    maxPlaced=Math.max(maxPlaced,Object.keys(scene.boxes).filter(k=>targets.has(k)).length);
    old=scene;oldPeers=peers;
  }
  assert.equal(rep.win(board),r.levels[0].won);
  const official=rep.win(board),tape=r.steps.map(op);
  for(const release of releases.filter(v=>v.pickup)) {
    const i=release.release-1,start=rep.restore(i);
    const controls=[];
    for(const replace of [null,...start.availableActionIds.filter(n=>n>=1&&n<=4).map(n=>'ACTION'+n)]) {
      let end=rep.restore(i),stepsUsed=i;
      for(const input of [...(replace?[replace]:[]),...tape.slice(i+1)]) {
        if(rep.win(end)||end.state!=='NOT_FINISHED'||!end.availableActionIds.includes(Number(input.split(':')[0].slice(6)))) break;
        end=rep.act(input);stepsUsed++;
      }
      controls.push({replace,win:rep.win(end),stepsUsed});
    }
    taken.push({...release,controls});
  }
  results.push({file,code:r.code,level:r.start,actions:r.issued,official,trajectory:r.trajectory,
    crates:g.initial_boxes.length,places:g.targets.length,maxPlacedBeforeBoundary:maxPlaced,releases:releases.length,taken});
}
await writeFile(output,JSON.stringify(results));
console.log(results.map(r=>[r.code,r.level,r.actions,r.official,r.taken.length]));
