import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {observedRewrite, translatedOutcome} from '../src/sic/rewrite-composition.ts';
import {footprints, changedFootprints} from './source-contact-footprints.mjs';

const [engineRoot, receipts, output, ...files]=process.argv.slice(2);
const {createGameDispatcher}=await import(pathToFileURL(resolve(engineRoot,'src/runtime/native-game-dispatcher.ts')).href);
const proofs=JSON.parse(await readFile(receipts,'utf8')), reports=[];
const hash=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const key=c=>'ACTION'+c.id+(c.id===6?':'+[c.data.x,c.data.y].join(','):'');
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run=JSON.parse(line);
  const proof=proofs.find(q=>q.code===run.code && q.level===run.start);
  assert.ok(proof && run.code!=='SS09' && !run.observedPriorLevelActions);
  const trials=proof.trials.filter(t=>t.checks.length===t.word.length && t.checks.every(c=>c==='matched'));
  if (!trials.length) continue;
  assert.equal(run.resets,0,'This controlled comparison requires a continuous cold prefix');
  const engine=createGameDispatcher(()=>{throw Error('Unexpected non-native backend');});
  const act=c=>engine.dispatch({type:'action',actionId:c.id,...(c.data?{data:c.data}:{})});
  async function restore(length, visit) {
    let b=await engine.dispatch({type:'load',code:run.code,level:run.start});
    if(b.level!==run.start && b.canSelectLevel) b=await engine.dispatch({type:'selectLevel',level:run.start});
    assert.equal(hash(b.frame),run.initial);
    for(const [i,c] of run.replayCommands.slice(0,length).entries()) {
      const next=await act(c);assert.equal(hash(next.frame).slice(0,16),c.to);
      visit?.(b,next,i);b=next;
    }
    return b;
  }
  for (const t of trials) {
    const prefix=t.at-1, program=run.replayCommands.slice(prefix,prefix+t.word.length),last=program.at(-1);
    const trainingIndex=t.sources.at(-1)-1, changes=[], beforeSites=new Set();
    let frameWidth=0;
    const note=b=>{for(const [shape,parts] of footprints(b.frame))for(const pos of parts.keys())beforeSites.add(shape+'/'+pos);};
    await restore(prefix,(b,n,i)=>{
      note(b);if(i!==trainingIndex)return;
      frameWidth=b.frame[0].length;
      for(let y=0;y<b.frame.length;y++)for(let x=0;x<b.frame[y].length;x++)
        if(b.frame[y][x]!==n.frame[y][x])changes.push([y*b.frame[0].length+x,b.frame[y][x],n.frame[y][x]]);
    });
    assert.ok(changes.length>0 && changes.length===last.composition.changes);
    const preparation=program.slice(0,-1);
    async function arm(commands, actual=false) {
      let b=await restore(prefix);if(actual)note(b);
      for(const c of commands) {
        if(b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(c.id))return {available:false};
        b=await act(c);if(actual)note(b);
      }
      if(b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(last.id))return {available:false};
      const next=await act(last);
      if(actual)assert.equal(hash(next.frame).slice(0,16),last.to);
      const moved=changedFootprints(footprints(b.frame),footprints(next.frame));
      let actualChanges=0;
      for(let y=0;y<b.frame.length;y++)for(let x=0;x<b.frame[y].length;x++)if(b.frame[y][x]!==next.frame[y][x])actualChanges++;
      return {available:true,actualChanges,atSite:observedRewrite({changes},b.frame,next.frame),anywhere:translatedOutcome({changes},b.frame,next.frame),
        won:next.levelsCompleted>run.initialCompleted||next.state==='WIN',end:hash(next.frame).slice(0,16),
        moved:moved.map(m=>({size:m.from.area,shape:hash(m.shape).slice(0,12),from:m.from.bbox.slice(0,2),to:m.to.bbox.slice(0,2),
          previouslySeenDestination:beforeSites.has(m.shape+'/'+m.to.bbox.join(','))}))};
    }
    const full=await arm(preparation,true);assert.ok(full.atSite);
    const sham=run.replayCommands.slice(0,prefix).find(c=>!program.some(q=>key(c)===key(q)));
    const xs=changes.map(([p])=>p%frameWidth),ys=changes.map(([p])=>Math.floor(p/frameWidth));
    reports.push({code:run.code,level:run.start,start:t.at,word:t.word,source:t.sources.at(-1),changes:changes.length,
      expectedBox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],full,
      bare:await arm([]),omitLastPreparation:await arm(preparation.slice(0,-1)),
      ...(sham?{sham:key(sham),equalLength:await arm([...preparation.slice(0,-1),sham])}:{})});
  }
}
await writeFile(output,JSON.stringify(reports));console.log('verified endpoints',reports.length);
