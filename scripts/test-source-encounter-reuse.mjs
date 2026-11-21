import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {footprints} from './source-contact-footprints.mjs';
import {observeEncounterMotion,projectEncounters,preparationVisible} from './source-projected-encounters.mjs';
import {relationalUses} from './source-relational-use.mjs';

const [environment,evidence,output,...args] = process.argv.slice(2);
const relational=args.includes('--relational');
const files=args.filter(v=>v!=='--relational');
const cases = JSON.parse(await readFile(evidence,'utf8')).continuations.unseenCases;
const engine = await sourceBackend(resolve(environment)), results=[], seen=new Set();
const patch = (frame,x,y,w,h) => frame.slice(y,y+h).flatMap(row=>row.slice(x,x+w));
const same = (u,v) => u.length===v.length && u.every((n,i)=>n===v[i]);

// A one-pixel border puts the learned operation in context. Include unchanged
// occurrences when counting support. Every admissible gesture is proposed
// before the fourth action is tried.
function priorUses(history,site,created,dirs,coverage) {
  const [w,h]=site.size,[tx,ty]=site.end.map((v,k)=>Math.ceil(v-(site.size[k]-1)/2));
  if (tx<1 || ty<1 || tx+w>=created[0].length || ty+h>=created.length) return [];
  const pattern=patch(created,tx-1,ty-1,w+2,h+2), core=patch(created,tx,ty,w,h);
  if (new Set(pattern).size<2) return [];
  const effects=new Map();
  for (const {before,after,step} of history) {
    if (!dirs.includes(step.a)) continue;
    for (let y=1; y+h<before.length; y++) for (let x=1; x+w<before[0].length; x++) {
      if (x===tx && y===ty || before[y-1][x-1]!==pattern[0] || before[y][x]!==core[0]) continue;
      let input='ACTION'+step.a;
      if (step.a===6) {
        const dx=step.data.x-x,dy=step.data.y-y;
        if (dx<0 || dy<0 || dx>=w || dy>=h) continue;
        input+=':'+(tx+dx)+','+(ty+dy);
      }
      if (!same(pattern,patch(before,x-1,y-1,w+2,h+2))) continue;
      coverage.equalContexts++;
      const effect=effects.get(input)??{outputs:new Set(),unchanged:0,sites:new Set()};
      const next=patch(after,x,y,w,h);
      if (same(core,next)) effect.unchanged++;
      else {effect.outputs.add(JSON.stringify(next));effect.sites.add([x,y].join());coverage.changedContexts++;}
      effects.set(input,effect);
    }
  }
  return [...effects].filter(([,e])=>e.outputs.size===1).map(([input,e])=>({
    input,expected:JSON.parse([...e.outputs][0]),tx,ty,w,h,sites:e.sites.size,unchanged:e.unchanged}));
}

for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run=JSON.parse(line),game=getGameByCode(run.code),id=run.code+'/'+run.start;
  assert.ok(game && game.group!=='custom_4');
  if (seen.has(id) || run.error || run.resets || run.sourcePrefixActions || run.observedPriorLevelActions || run.start!==run.finish) continue;
  seen.add(id);
  const rep=sourceReplay(engine,{},run), alive=b=>!rep.win(b)&&b.state==='NOT_FINISHED';
  for (const record of cases.filter(r=>r.code===run.code&&r.level===run.start)) {
    const {prefix,a,b,c}=record,history=[],memory=new Map();
    let board=rep.restore(0),view=footprints(board.frame);
    for (const step of run.steps.slice(0,prefix)) {
      const n=rep.act(op(step)),next=footprints(n.frame);
      assert.equal(hash(n).slice(0,16),step.to);
      history.push({before:board.frame,after:n.frame,step});
      if (step.a>=1&&step.a<=4) observeEncounterMotion(memory,view,next,op(step));
      view=next;board=n;
    }
    const projected=projectEncounters(view,memory,a,b,[board.frame[0].length,board.frame.length]);
    const intermediate=rep.act(a),joined=rep.act(b),created=rep.act(c);
    assert.ok(alive(created));
    const tests=[], forecasts=new Map(), mid=footprints(intermediate.frame);
    const coverage={isolatedSites:0,equalContexts:0,changedContexts:0};
    function alternate(prep) {
      let before=rep.restore(prefix);
      for (const action of prep) {
        if (!alive(before) || !before.availableActionIds.includes(Number(action.slice(6)))) return null;
        before=rep.act(action);
      }
      if (!alive(before) || !before.availableActionIds.includes(Number(c.slice(6)))) return null;
      return {before,after:rep.act(c)};
    }
    const omitted=[[],[a],[b]].map(alternate);
    const competitors=board.availableActionIds.filter(v=>v>=1&&v<=4&&'ACTION'+v!==a).map(v=>alternate(['ACTION'+v,b])).filter(Boolean);
    if (a!==b) {const reverse=alternate([b,a]);if (reverse) competitors.push(reverse);}
    assert.ok(omitted.every(Boolean) && competitors.length);
    for (const site of projected.filter(s=>preparationVisible(mid,s))) {
      const [w,h]=site.size,[x,y]=site.end.map((v,k)=>Math.ceil(v-(site.size[k]-1)/2));
      const current=patch(created.frame,x,y,w,h);
      // Only consider a newly arrived local result of C at the projected site.
      if ([...history.map(v=>v.before),board.frame,intermediate.frame,joined.frame]
        .some(frame=>same(current,patch(frame,x,y,w,h)))) continue;
      if ([...omitted,...competitors].some(v=>!alive(v.after) ||
        !same(patch(v.before.frame,x,y,w,h),patch(v.after.frame,x,y,w,h)))) continue;
      coverage.isolatedSites++;
      const uses=relational?relationalUses(history,site,created.frame,created.availableActionIds,memory.get(site.shape)):
        priorUses(history,site,created.frame,created.availableActionIds,coverage);
      for (const f of uses) {
        const key=JSON.stringify([f.input,f.tx,f.ty,w,h,f.expected]),old=forecasts.get(key);
        // An output may be justified by several source sites or guards.
        // Choose on observed evidence before ever trying the held-out action.
        if (!relational || !old || (f.hits+1)/(f.hits+f.misses+2)>(old.hits+1)/(old.hits+old.misses+2)) forecasts.set(key,f);
      }
    }
    const outcomes=new Map();
    function apply(preparation,input) {
      let n=rep.restore(prefix);
      for (const action of preparation) {
        if (!alive(n) || !n.availableActionIds.includes(Number(action.slice(6)))) return null;
        n=rep.act(action);
      }
      if (!alive(n) || !n.availableActionIds.includes(Number(input.split(':')[0].slice(6)))) return null;
      return {n,end:rep.act(input)};
    }
    for (const f of forecasts.values()) {
      function test(preparation) {
        const key=JSON.stringify([preparation,f.input]);
        if (!outcomes.has(key)) outcomes.set(key,apply(preparation,f.input));
        const outcome=outcomes.get(key);
        if (!outcome) return null;
        const {n,end}=outcome,old=patch(n.frame,f.tx,f.ty,f.w,f.h);
        return {win:rep.win(end),matched:alive(end)&&!same(old,f.expected)&&same(patch(end.frame,f.tx,f.ty,f.w,f.h),f.expected)};
      }
      const full=test([a,b,c]), omittedWords=[[a,b],[a,c],[b,c],[c],...(relational?[[]]:[])], omissions=omittedWords.map(test);
      const rivalWords=board.availableActionIds.filter(n=>n>=1&&n<=4&&'ACTION'+n!==a).map(n=>['ACTION'+n,b,c]);
      const alternatives=rivalWords.map(test),rivals=alternatives.filter(Boolean);
      tests.push({input:f.input,fromSites:f.sites,unchangedMatches:f.unchanged,
        ...(relational?{guard:f.guard,hits:f.hits,misses:f.misses,sourceOffset:f.sourceOffset,destinationOffset:f.destinationOffset}:{}),
        full,controlsAvailable:omissions.every(Boolean)&&rivals.length>0,
        matchingPreparations:[...omittedWords,...rivalWords].filter((_,i)=>[...omissions,...alternatives][i]?.matched),
        controlsMatched:[...omissions,...rivals].some(s=>s?.matched),controlsWon:[...omissions,...rivals].some(s=>s?.win)});
    }
    results.push({...record,coverage,tests});
  }
}
await writeFile(output,JSON.stringify(results));
console.log('prepared configurations',results.length,'predicted uses',results.reduce((n,r)=>n+r.tests.length,0));
