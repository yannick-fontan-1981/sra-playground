import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {newPreviewLearning,observePreviewBindings,visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {measureTerminalContact,offerTerminalContact} from '../src/sic/terminal-contact.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,output,...files]=process.argv.slice(2);
const source=await sourceBackend(resolve(environment)),results=[];
async function view(b,revision){
  return measureNativeObservation({frame_rows:b.frame,level:b.level,levels_completed:b.levelsCompleted,state:b.state,
    available_action_refs:b.availableActionIds.map(n=>'ACTION'+n),frame_hash:await publicFrameHash(b.frame)},revision,'public-source');
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);assert.ok(game&&game.group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions||run.start!==run.finish)continue;
  const rep=sourceReplay(source,{},run),learn=newPreviewLearning(),trials=[],attempted=new Set();
  let board=rep.restore(0),observation=await view(board,0);
  for(const [i,step] of run.steps.entries()){
    const available=new Set(observation.available_action_refs),offer=offerTerminalContact({previewLearning:learn},i,observation,board.frame,available,true);
    const t=offer?.terminalContact;
    if(t&&i+t.distance<=run.cap&&trials.length<12){
      const target=[t.witness.actor,t.witness.marker,t.site,t.from,t.op].join('/');
      if(!attempted.has(target)){
        attempted.add(target);
        const n=rep.act(t.op),after=await view(n,i+1),local=structuredClone(learn);
        const measured=measureTerminalContact(local,t,observation,after,t.op,visualLayout(after,n.frame));
        let won=rep.win(n),word=[t.op],sameTarget=true,secondMatched=null,controls=[];
        if(!won&&measured.matched&&t.distance===2&&n.state==='NOT_FINISHED'){
          observePreviewBindings(local,observation,after,visualLayout(observation,board.frame),visualLayout(after,n.frame),t.op);
          const next=offerTerminalContact({previewLearning:local},i+1,after,n.frame,new Set(after.available_action_refs),true)?.terminalContact;
          sameTarget=!!next&&next.distance===1&&next.witness.actor===t.witness.actor&&next.witness.marker===t.witness.marker;
          if(sameTarget){
            const end=rep.act(next.op),returned=await view(end,i+2);
            word.push(next.op);won=rep.win(end);
            secondMatched=measureTerminalContact(local,next,after,returned,next.op,visualLayout(returned,end.frame)).matched;
          }
        }
        if(won&&word.length===2){
          for(const first of [null,...board.availableActionIds.filter(n=>n!==6).map(n=>'ACTION'+n)].filter(c=>c!==word[0])){
            let start=rep.restore(i);if(first)start=rep.act(first);
            const early=rep.win(start),possible=!early&&start.state==='NOT_FINISHED'&&start.availableActionIds.includes(Number(word[1].slice(6)));
            controls.push({first,early,won:early||(possible&&rep.win(rep.act(word[1])))});
          }
        }
        trials.push({prefix:i,word,planned:t.distance,sameTarget,matched:measured.matched,secondMatched,won,controls});
        board=rep.restore(i);assert.equal(hash(board).slice(0,16),step.from);
      }
    }
    const n=rep.act(op(step));assert.equal(hash(n).slice(0,16),step.to);
    const after=await view(n,i+1);
    observePreviewBindings(learn,observation,after,visualLayout(observation,board.frame),visualLayout(after,n.frame),op(step));
    board=n;observation=after;
  }
  results.push({code:run.code,level:run.start,won:run.levels[0].won,originalActions:run.issued,trajectory:run.trajectory,trials});
}
await writeFile(output,JSON.stringify(results));console.log('episodes',results.length,'proposals',results.reduce((n,r)=>n+r.trials.length,0));
