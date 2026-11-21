import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAME_CATALOG,getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [env,out,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(env));
const programs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8'));
const reserved=new Set(['hanoi_order',...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const entries=[];
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game && game.group!=='custom_4'); if(run.error||reserved.has(game.family)) continue;
  assert.ok(!run.resets && !run.observedPriorLevelActions && run.start===run.finish);
  const replay=sourceReplay(engine,programs,run),pairs=[],seen=new Set();
  let board=replay.restore(0);
  for(const [i,s] of run.steps.entries()) {
    assert.equal(hash(board).slice(0,16),s.from);
    const next=replay.act(op(s));assert.equal(hash(next).slice(0,16),s.to);
    const b=run.steps[i+1];
    if(b && op(s)!==op(b) && board.availableActionIds.includes(b.a) && next.state==='NOT_FINISHED' &&
        !replay.win(next) && board.availableActionIds.join()===next.availableActionIds.join()) {
      const invisible=s.from===s.to, local=s.pixels>0 && s.width>0 && s.height>0 &&
        s.width<=Math.ceil(board.frame[0].length/4) && s.height<=Math.ceil(board.frame.length/4);
      const type=invisible?'invisible':local?'localized':null;
      const key=[s.from,op(s),op(b)].join('/');
      if(type && !seen.has(key) && pairs.filter(p=>p.type===type).length<6) {
        pairs.push({i,type});seen.add(key);
      }
    }
    board=next;
  }
  const won=replay.win(board);assert.equal(won,run.levels[0].won);
  const tests=[];
  for(const {i,type} of pairs) {
    const [a,b]=run.steps.slice(i,i+2),root=replay.restore(i);
    const prepared=replay.act(op(a)), actual=replay.act(op(b));
    assert.equal(hash(actual).slice(0,16),b.to);
    replay.restore(i);
    let bare=replay.act(op(b));
    const surviving=v=>!replay.win(v) && v.state==='NOT_FINISHED';
    let changedElsewhere=0,extraWrites=0,missingWrites=0;
    if(surviving(bare)&&surviving(actual)) {
      root.frame.forEach((row,y)=>row.forEach((v,x)=>{
        // The changed point must have been identical before B in both arms.
        if(v!==prepared.frame[y]?.[x] || actual.frame[y]?.[x]===bare.frame[y]?.[x])return;
        changedElsewhere++;
        extraWrites+=Number(actual.frame[y]?.[x]!==v && bare.frame[y]?.[x]===v);
        missingWrites+=Number(actual.frame[y]?.[x]===v && bare.frame[y]?.[x]!==v);
      }));
    }
    const physicalChange=changedElsewhere>0 || replay.win(bare)!==replay.win(actual) || bare.state!==actual.state;
    let scoreWithoutA=null;
    if(physicalChange || type==='invisible') {
      let valid=true;
      for(const c of run.steps.slice(i+2)) {
        if(!surviving(bare))break;
        if(!bare.availableActionIds.includes(c.a)){valid=false;break;}
        bare=replay.act(op(c));
      }
      if(valid)scoreWithoutA=replay.win(bare);
    }
    tests.push({at:i+1,type,a:op(a),b:op(b),physicalChange,changedElsewhere,extraWrites,missingWrites,scoreWithoutA});
  }
  entries.push({code:run.code,level:run.start,won,tests});
}
const summary={};
for(const type of ['invisible','localized']){
  const rows=entries.flatMap(e=>e.tests.filter(t=>t.type===type).map(t=>({...t,code:e.code,won:e.won})));
  summary[type]={tested:rows.length,changes:rows.filter(x=>x.physicalChange).length,
    games:[...new Set(rows.filter(x=>x.physicalChange).map(x=>x.code))],
    indispensableInWin:rows.filter(x=>x.won&&x.scoreWithoutA===false).length,winByOmission:rows.filter(x=>!x.won&&x.scoreWithoutA===true).length};
}
await writeFile(out,JSON.stringify({summary,entries},null,2)+'\n');console.log(JSON.stringify(summary));
