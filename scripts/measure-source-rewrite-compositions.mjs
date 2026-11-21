import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {GAME_CATALOG,getGameByCode} from '../src/games/catalog.ts';
import {learnRewrites,composeRewrites,observedRewrite,translatedOutcome} from '../src/sic/rewrite-composition.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

const [environment,out,...args]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const length=Number(args.find(v=>v.startsWith('--length='))?.split('=')[1]??3),withSuffix=!args.includes('--effects-only');
const files=args.filter(v=>!v.startsWith('--'));
assert.ok(Number.isInteger(length)&&length>=2);
const held=new Set(['hanoi_order',...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const reports=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);assert.ok(game&&game.group!=='custom_4');
  if(run.error||held.has(game.family)||run.resets||run.observedPriorLevelActions||run.sourcePrefixActions||run.finish!==run.start)continue;
  const rep=sourceReplay(engine,{},run),bank=[],history=[],tested=new Set(),trials=[];
  let board=rep.restore(0);
  const states=new Set([hash(board)]);
  for(const [i,s] of run.steps.entries()){
    const current=hash(board),available=board.availableActionIds.map(n=>'ACTION'+n);
    const candidate=i+length<=run.cap&&i>=length&&trials.length<3?composeRewrites(bank,board.frame,history,available,tested,{length}):null;
    if(candidate){
      const [a,b]=candidate.steps,c=candidate.steps.at(-1),word=candidate.steps.map(r=>r.op),d=[...new Set(history)].find(k=>!word.includes(k)&&available.includes(k.split(':')[0]));
      tested.add(word.join('/'));
      assert.ok(candidate.steps.every(r=>r.ref<=i));
      function intervene(keys){
        let root=rep.restore(i);assert.equal(hash(root),current);
        let second=null,third=null,translated=null,applied=0;const observed=[];
        for(const key of keys){
          if(rep.win(root)||root.state!=='NOT_FINISHED'||!root.availableActionIds.includes(Number(key.split(':')[0].slice(6))))break;
          const next=rep.act(key);applied++;
          const active=next.state==='NOT_FINISHED'&&!rep.win(next);
          if(key===b.op)second=active?observedRewrite(b,root.frame,next.frame):null;
          if(applied===keys.length){
            third=active?observedRewrite(c,root.frame,next.frame):null;
            translated=active?translatedOutcome(c,root.frame,next.frame):null;
          }
          observed.push(active&&observedRewrite(candidate.steps[applied-1],root.frame,next.frame));
          root=next;
        }
        const immediate=rep.win(root),novel=!states.has(hash(root));
        if(withSuffix)for(const t of run.steps.slice(i+length)){
          if(rep.win(root)||root.state!=='NOT_FINISHED'||!root.availableActionIds.includes(t.a))break;
          root=rep.act(op(t));
        }
        return {applied,second,third,translated,observed,immediate,novel,won:rep.win(root)};
      }
      const arms={abc:intervene(word),c:intervene([c.op])};
      const removed=[],substituted=[];
      for(let index=0;index<length-1;index++){
        removed.push(intervene(word.filter((_,k)=>k!==index)));
        if(d)substituted.push(intervene(word.map((v,k)=>k===index?d:v)));
      }
      const exchanged=[...word];[exchanged[0],exchanged[1]]=[exchanged[1],exchanged[0]];
      arms.bac=intervene(exchanged);
      if(length===3){
        [arms.bc,arms.ac]=removed;
        if(d)[arms.dbc,arms.adc]=substituted;
      }
      trials.push({at:i,word,refs:candidate.steps.map(r=>r.ref),changed:candidate.steps.map(r=>r.changes.length),kind:candidate.terminalKind,arms,removed,substituted,withSuffix});
      board=rep.restore(i);
    }
    const key=op(s),next=rep.act(key);assert.equal(hash(next).slice(0,16),s.to);
    if(next.state==='NOT_FINISHED'&&!rep.win(next))learnRewrites(bank,board.frame,next.frame,key,i+1,!args.includes('--fragments'));
    history.push(key);board=next;states.add(hash(board));
  }
  assert.equal(rep.win(board),run.levels[0].won);reports.push({code:run.code,level:run.start,won:rep.win(board),actions:run.issued,trials});
}
await writeFile(out,JSON.stringify(reports));
console.log(reports.length,reports.reduce((n,r)=>n+r.trials.length,0));
