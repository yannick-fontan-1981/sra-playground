import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';
import {footprints} from './source-contact-footprints.mjs';
import {observeEncounterMotion} from './source-projected-encounters.mjs';

function relation(pos,marker,delta,body) {
  const gap=marker.map((v,i)=>v-pos[i]);
  if (gap.every((v,i)=>Math.abs(v)<body[i]/2)) return 'overlap';
  const axis=delta[0]?0:1, other=1-axis;
  if (Math.abs(gap[other])<body[other]/2) return gap[axis]*delta[axis]>0?'ahead':'behind';
  if (Math.abs(gap[axis])<body[axis]/2) return 'across';
  return null;
}
function features(view,memory,input,bounds) {
  const flags=new Set();
  for (const [kind,controls] of memory) {
    const actor=view.get(kind),vectors=controls.get(input);
    if (actor?.size!==1 || controls.size<2 || vectors?.size!==1) continue;
    const [l,u,r,b]=actor.values().next().value.bbox, size=[r-l+1,b-u+1];
    const d=vectors.values().next().value,pitch=Math.max(...d.map(Math.abs));
    if (pitch>4*Math.max(...size)) continue;
    const start=[(l+r)/2,(u+b)/2],end=start.map((v,i)=>v+d[i]);
    if (end.some((v,i)=>v<(size[i]-1)/2 || v>bounds[i]-1-(size[i]-1)/2)) continue;
    flags.add('measured');
    for (const [type,peers] of view) {
      if (type===kind || memory.has(type)) continue;
      for (const target of peers.values()) {
        const [x,y,v,z]=target.bbox,tw=v-x+1,th=z-y+1;
        if (Math.max(tw,th)>2*pitch || tw*th>4*size[0]*size[1]) continue;
        const marker=[(v+x)/2,(z+y)/2],rel=relation(end,marker,d,size);
        if (!rel) continue;
        const before=relation(start,marker,d,size);
        const distance=Math.max(...marker.map((v,i)=>Math.abs(v-end[i])))/pitch;
        const change=rel===before?'keeps':'gains',count=peers.size===1?'unique':'repeated';
        const range=distance<=1.5?'near':'far';
        for (const prefix of [rel,change+'/'+rel]) {
          for (const suffix of ['', '/'+count,'/'+range,'/'+count+'/'+range]) flags.add(prefix+suffix);
        }
      }
    }
  }
  return [...flags].sort();
}

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const results=[],seen=new Set();
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run=JSON.parse(line),game=getGameByCode(run.code),key=run.code+'/'+run.start;
  assert.ok(game && game.group!=='custom_4');
  if (seen.has(key)||run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions||run.start!==run.finish) continue;
  seen.add(key);
  const rep=sourceReplay(engine,{},run),motion=new Map(),samples=[];
  results.push({code:run.code,level:run.start,historicalWin:run.levels[0].won,samples});
  let board=rep.restore(0),view=footprints(board.frame);
  if (board.availableActionIds.filter(n=>n>=1&&n<=4).length<2 || !board.availableActionIds.some(n=>n>4&&n!==6)) continue;
  const fixed=[4,8,16],tail=run.issued-2;
  const positions=new Set([...fixed,tail].filter(i=>i>=0&&i<run.steps.length));
  const last=Math.max(...positions);
  for (let i=0;i<=last;i++) {
    if (positions.has(i)) {
      const commands=board.availableActionIds.map(n=>'ACTION'+n);
      const dirs=commands.filter(k=>/^ACTION[1-4]$/.test(k));
      const uses=commands.filter(k=>Number(k.slice(6))>4&&k!=='ACTION6');
      const options=dirs.map(d=>({d,flags:features(view,motion,d,[board.frame[0].length,board.frame.length])}));
      const sample={i,tail:i===tail,fixed:fixed.includes(i),choices:[]};
      samples.push(sample);
      if (options.some(v=>v.flags.length)) {
        const outcomes=new Map();
        function execute(word) {
          const id=word.join('/');
          if (!outcomes.has(id)) {
            let n=rep.restore(i),used=0;
            for (const k of word) {
              if (rep.win(n)||n.state!=='NOT_FINISHED'||!n.availableActionIds.includes(Number(k.slice(6)))) break;
              n=rep.act(k);used++;
            }
            outcomes.set(id,{win:rep.win(n),used});
          }
          return outcomes.get(id);
        }
        for (const c of uses) for (const {d,flags} of options) {
          const joint=execute([d,c]),alone=execute([c]),move=execute([d]),rev=execute([c,d]);
          sample.choices.push({d,c,flags,win:joint.win&&joint.used===2,eligible:joint.used===2,
            alone:alone.win,direct:move.win,reverse:rev.win});
        }
        board=rep.restore(i);
      }
    }
    if (i===last) break;
    const s=run.steps[i],next=rep.act(op(s));
    assert.equal(hash(next).slice(0,16),s.to);
    const after=footprints(next.frame);
    if (s.a>=1&&s.a<=4) observeEncounterMotion(motion,view,after,op(s));
    view=after;board=next;
  }
}
await writeFile(output,JSON.stringify(results));
console.log('episodes',results.length,'positions',results.flatMap(r=>r.samples).filter(s=>s.choices.length).length);
