import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {footprints} from './source-contact-footprints.mjs';
import {observeEncounterMotion} from './source-projected-encounters.mjs';

const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),results=[],seen=new Set();
const stamp=(frame,x,y,w,h)=>JSON.stringify(frame.slice(y,y+h).map(row=>row.slice(x,x+w)));
const contains=(box,x,y)=>x>=box[0]&&x<=box[2]&&y>=box[1]&&y<=box[3];

function opportunities(board,view,memory) {
  const proposals=[];
  for (const [shape,motors] of memory) {
    const bodies=view.get(shape);
    if (bodies?.size!==1 || motors.size<2) continue;
    const body=bodies.values().next().value,[x,y,r,b]=body.bbox,w=r-x+1,h=b-y+1;
    for (const [input,examples] of motors) {
      if (examples.size!==1 || !board.availableActionIds.includes(Number(input.slice(6)))) continue;
      const [dx,dy]=examples.values().next().value,step=Math.max(Math.abs(dx),Math.abs(dy));
      const arrival=[x+dx,y+dy,r+dx,b+dy];
      if (step>4*Math.max(w,h) || arrival[0]<0 || arrival[1]<0 || arrival[2]>=board.frame[0].length || arrival[3]>=board.frame.length) continue;
      for (const [peer,parts] of view) {
        if (shape===peer || memory.has(peer)) continue;
        for (const t of parts.values()) {
          const [l,u,v,z]=t.bbox,tw=v-l+1,th=z-u+1,cx=(l+v)/2,cy=(u+z)/2;
          if (Math.max(tw,th)>2*step || tw*th>4*w*h || contains(body.bbox,cx,cy) || !contains(arrival,cx,cy)) continue;
          proposals.push({shape,peer,body,target:t,input,x,y,w,h,dx,dy,
            id:JSON.stringify([shape,peer,x,y,input])});
        }
      }
    }
  }
  return proposals;
}

for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const r=JSON.parse(line),game=getGameByCode(r.code),id=r.code+'/'+r.start;
  assert.ok(game&&game.group!=='custom_4');
  if (seen.has(id)||r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions||r.start!==r.finish) continue;
  seen.add(id);
  const rep=sourceReplay(engine,{},r),alive=b=>!rep.win(b)&&b.state==='NOT_FINISHED';
  const confirmed=new Map(),tried=new Set(),queries=[],report={code:r.code,level:r.start,historicalWin:r.levels[0].won,queries};
  results.push(report);
  let board=rep.restore(0),view=footprints(board.frame);
  const visited=new Set([hash(board)]);
  if (!board.availableActionIds.some(n=>n>4&&n!==6) || board.availableActionIds.filter(n=>n>=1&&n<=4).length<2) continue;
  for (let i=0;i<r.steps.length;i++) {
    const choices=opportunities(board,view,confirmed);
    // First six distinct situations are prospective. The last observed
    // position is also inspected separately to diagnose scored boundaries.
    const terminalProbe=i===r.steps.length-1;
    const cache=new Map();
    function play(word) {
      const k=word.join('/');
      if (cache.has(k)) return cache.get(k);
      let b=rep.restore(i),used=0;
      for (const input of word) {
        if (!alive(b) || !b.availableActionIds.includes(Number(input.slice(6)))) break;
        b=rep.act(input);used++;
      }
      const result={board:b,used,win:rep.win(b)};
      cache.set(k,result);return result;
    }
    for (const p of choices) {
      if (!terminalProbe && (tried.size>=6||tried.has(p.id))) continue;
      if (terminalProbe && queries.some(q=>q.prefix===i&&q.id===p.id)) continue;
      const {x,y,w,h,dx,dy,input:d}=p;
      const prospective=tried.size<6&&!tried.has(p.id);
      if (prospective) tried.add(p.id);
      const reportFor={id:p.id,prefix:i,terminalProbe,prospective,d,arms:[]};
      // The public geometry is kept local. Retain only the causal measurements.
      queries.push(reportFor);
      function transported(from,end) {
        if (!alive(end)) return false;
        const original=stamp(from.frame,x,y,w,h);
        return stamp(from.frame,x+dx,y+dy,w,h)!==original &&
          stamp(end.frame,x+dx,y+dy,w,h)===original && stamp(end.frame,x,y,w,h)!==original;
      }
      const direct=play([d]), repeated=play([d,d]);
      const baseMoved=transported(board,direct.board), old=stamp(board.frame,x,y,w,h);
      for (const n of board.availableActionIds.filter(v=>v>4&&v!==6)) {
        const c='ACTION'+n,setup=play([c]),changed=alive(setup.board)&&stamp(setup.board.frame,x,y,w,h)!==old;
        const sequence=play([c,d]),reverse=play([d,c]), repeatedC=play([c,c]);
        const changedTarget=alive(setup.board) && stamp(setup.board.frame,x+dx,y+dy,w,h)!==stamp(board.frame,x+dx,y+dy,w,h);
        const moved=sequence.used===2 && transported(setup.board,sequence.board);
        let retainedForm=false,arrivedForm=false,directStayed=false,rivalArrival=false;
        if (moved && !baseMoved) {
          // A vacated patch can look like the neighbouring floor. Require a
          // visible body at the old origin after C and at the destination
          // after D before attributing this crossing to the changing subject.
          const mask=JSON.stringify(p.body.mask),startBox=p.body.bbox.join(),endBox=[x+dx,y+dy,x+w-1+dx,y+h-1+dy].join();
          const origins=footprints(setup.board.frame),arrivals=footprints(sequence.board.frame);
          directStayed=alive(direct.board) && !!footprints(direct.board.frame).get(p.shape)?.has(startBox);
          const others=[reverse,repeated,repeatedC].filter(v=>alive(v.board)).map(v=>footprints(v.board.frame));
          for (const [type,group] of origins) {
            const at=group.get(startBox);
            if (!at || JSON.stringify(at.mask)!==mask) continue;
            retainedForm=true;
            if (arrivals.get(type)?.has(endBox) && !origins.get(type).has(endBox) && !arrivals.get(type).has(startBox)) arrivedForm=true;
            if (others.some(r=>r.get(type)?.has(endBox) && !r.get(type).has(startBox))) rivalArrival=true;
          }
        }
        reportFor.arms.push({c,d,changed,changedTarget,baseMoved,moved,retainedForm,arrivedForm,directStayed,rivalArrival,
          setupSeen:visited.has(hash(setup.board)),resultSeen:visited.has(hash(sequence.board)),
          baseWin:direct.win,setupWin:setup.win,used:sequence.used,
          win:sequence.win,reverseWon:reverse.win,repeatedMotorWon:repeated.win,repeatedSetupWon:repeatedC.win});
      }
    }
    if (cache.size) board=rep.restore(i);
    if (terminalProbe) break;
    const s=r.steps[i],next=rep.act(op(s));
    assert.equal(hash(next).slice(0,16),s.to);
    visited.add(hash(next));
    const after=footprints(next.frame);
    if (s.a>=1&&s.a<=4) observeEncounterMotion(confirmed,view,after,op(s));
    board=next;view=after;
  }
  for (const q of queries) delete q.id;
}
await writeFile(output,JSON.stringify(results));
console.log('levels',results.length,'geometric approaches',results.reduce((n,r)=>n+r.queries.length,0));
