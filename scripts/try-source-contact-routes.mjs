import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode, GAME_CATALOG} from '../src/games/catalog.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {newPreviewLearning, visualLayout, observePreviewBindings} from '../src/sic/witnessed-preview-transfer.ts';
import {exposedUnderParts} from '../src/sic/controlled-parts.ts';
import {sourceContactHypotheses} from '../src/sic/source-contact-hypothesis.ts';
import {measureTerminalContact, offerTerminalContact} from '../src/sic/terminal-contact.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

const [env,out,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(env));
const programs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8'));
const reserved=new Set(['hanoi_order', ...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const entries=[];
for (const f of files) for (const line of (await readFile(f,'utf8')).trim().split(/\r?\n/)) {
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game && game.group!=='custom_4');
  if (run.error || reserved.has(game.family)) continue;
  assert.ok(!run.resets && !run.observedPriorLevelActions && run.start===run.finish);
  const replay=sourceReplay(engine,programs,run);
  const view=(b,n)=>measureNativeObservation({frame_rows:b.frame,frame_hash:hash(b),level:b.level,levels_completed:b.levelsCompleted,
    state:b.state,available_action_refs:b.availableActionIds.map(x=>'ACTION'+x)},n,run.code);
  async function update(m,b,o,command,next,revision) {
    const after=await view(next,revision), prior=visualLayout(o,b.frame), later=visualLayout(after,next.frame);
    observePreviewBindings(m,o,after,prior,later,command);
    if (o.level_epoch===after.level_epoch && o.levels_completed===after.levels_completed && o.state===after.state) {
      exposedUnderParts(m,o,after,b.frame,next.frame,prior,later);
    }
    return after;
  }
  let b=replay.restore(0), o=await view(b,1);
  const m=newPreviewLearning(),tested=new Map(),trials=[];
  let withHypothesis=0,withRoute=0;
  for (const [i,s] of run.steps.entries()) {
    assert.equal(hash(b).slice(0,16),s.from);
    const choices=sourceContactHypotheses(m,o,b.frame);
    if (choices.length) withHypothesis++;
    const choose=(m,o,b,choices)=>offerTerminalContact({previewLearning:m},0,o,b.frame,new Set(o.available_action_refs),choices)?.terminalContact;
    const first=choices.length && choose(m,o,b,choices);
    if (first) withRoute++;
    const key=first && [first.witness.actor,first.witness.marker,first.site].join('/');
    if (first && trials.length<8 && first.distance<(tested.get(key)??Infinity)) {
      tested.set(key,first.distance);
      const learned=structuredClone(m), steps=[];
      let board=b,ob=o,p=first,matches=true;
      for (let j=0;p && j<first.distance && i+j<run.cap;j++) {
        const after=replay.act(p.op);
        const next=await update(learned,board,ob,p.op,after,i+j+2);
        const measured=measureTerminalContact(learned,p,ob,next,p.op,visualLayout(next,after.frame));
        steps.push(p.op);
        matches=measured.matched;
        board=after; ob=next;
        if (!matches || replay.win(board) || board.state!=='NOT_FINISHED') break;
        p=choose(learned,ob,board,[first.witness]);
      }
      trials.push({at:i+1,distance:first.distance,steps,matches,won:replay.win(board),descriptor:first.witness.sourceDescriptor});
      b=replay.restore(i);
    }
    const next=replay.act(op(s));
    assert.equal(hash(next).slice(0,16),s.to);
    o=await update(m,b,o,op(s),next,i+2);b=next;
  }
  assert.equal(replay.win(b),run.levels[0].won);
  entries.push({code:run.code,level:run.start,won:run.levels[0].won,withHypothesis,withRoute,trials});
}
const summary={entries:entries.length,hypotheses:entries.filter(r=>r.withHypothesis).length,routes:entries.filter(r=>r.withRoute).length,
  trials:entries.reduce((n,e)=>n+e.trials.length,0),wonTrials:entries.flatMap(e=>e.trials).filter(t=>t.won).length,
  converted:entries.filter(e=>!e.won && e.trials.some(t=>t.won)).map(e=>[e.code,e.level])};
await writeFile(out, JSON.stringify({summary,entries},null,2)+'\n');
console.log(JSON.stringify(summary));
