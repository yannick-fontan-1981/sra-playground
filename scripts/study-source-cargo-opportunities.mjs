import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode,GAME_CATALOG} from '../src/games/catalog.ts';
import {observeTravel,readTravelGrid} from '../src/sic/observed-travel-frontier.ts';
import {observeCoverage} from '../src/sic/observed-coverage.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [env,out,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(env));
const programs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8'));
const reserved=new Set(['hanoi_order',...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const entries=[];
for (const file of files) for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game && game.group!=='custom_4'); if(run.error||reserved.has(game.family)) continue;
  assert.ok(!run.resets && !run.observedPriorLevelActions && run.start===run.finish);
  const replay=sourceReplay(engine,programs,run);
  let b=replay.restore(0), travel, coverage, gridSteps=0;
  const witnesses=[];
  for(const [i,s] of run.steps.entries()) {
    const next=replay.act(op(s));assert.equal(hash(next).slice(0,16),s.to);
    if(!replay.win(next) && next.state==='NOT_FINISHED') {
      const command={action_ref:'ACTION'+s.a,data:s.data??{}}, ref=String(i+1);
      const returned=observeTravel(travel,b.frame,next.frame,command,ref);
      const updated=observeCoverage(coverage,travel,returned,b.frame,next.frame,command,ref);
      if(returned) gridSteps++;
      const d=returned?.moves[command.action_ref]?.delta;
      if (travel?.actor && returned?.actor && d && travel.grid.ink===returned.grid.ink) {
        const [x,y]=travel.actor.split(',').map(Number), step=n=>[x+n*d[0],y+n*d[1]].join(',');
        if(returned.actor===step(1)) {
          const first=readTravelGrid(b.frame,travel.grid).cells,last=readTravelGrid(next.frame,travel.grid).cells;
          for(const [motion,origin,to] of [['push',step(1),step(2)],['pull',step(-1),step(0)]]) {
            const tile=first.get(origin);
            if(!tile || new Set(tile).size<2)continue;
            const stamp=tile.join(','), positions=map=>[...map].filter(([,p])=>p.join(',')===stamp).map(([k])=>k);
            const unprepared=positions(first), prepared=positions(last);
            if(unprepared.includes(to)||prepared.includes(origin)||!prepared.includes(to)||
              prepared.length!==unprepared.length||unprepared.some(k=>k!==origin&&!prepared.includes(k)))continue;
            witnesses.push({at:i+1,motion,pieces:unprepared.length,recognized:updated?.motion===motion,layout:!!updated?.layout});
          }
        }
      }
      travel=returned;coverage=updated;
    }
    b=next;
  }
  assert.equal(replay.win(b),run.levels[0].won);
  entries.push({code:run.code,level:run.start,won:run.levels[0].won,gridSteps,witnesses});
}
const w=entries.flatMap(e=>e.witnesses);
const summary={entries:entries.length,calibrated:entries.filter(e=>e.gridSteps).length,witnessed:w.length,
  games:[...new Set(entries.filter(e=>e.witnesses.length).map(e=>e.code))],recognized:w.filter(v=>v.recognized).length,withLayout:w.filter(v=>v.layout).length};
await writeFile(out,JSON.stringify({summary,entries},null,2)+'\n');console.log(JSON.stringify(summary));
