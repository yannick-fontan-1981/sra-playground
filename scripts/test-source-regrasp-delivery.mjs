import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';
import {orientedCouplingInitial,orientedCouplingScene,orientedCouplingTile} from '../src/logos-engine/v6-oriented-coupling.ts';
import {deliveryByRegrasp} from './source-regrasp-delivery.mjs';

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const results=[],seen=new Set();
const equal=(u,v)=>u.join()===v.join();
const parts=s=>Object.keys(s.boxes).map(v=>v.split(',').map(Number));
function learnFloor(frame,geometry,scene) {
  const floor=new Set([...Object.keys(scene.boxes),scene.pose.join(),...geometry.targets.map(p=>p.join())]);
  const {pitch,phase}=geometry;
  for(let y=0;phase[1]+(y+1)*pitch<=frame.length;y++)for(let x=0;phase[0]+(x+1)*pitch<=frame[0].length;x++){
    const tile=orientedCouplingTile(frame,geometry,[x,y]);
    if (tile.every(row=>row.every(v=>v===geometry.background))) floor.add([x,y].join());
  }
  return floor;
}
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run=JSON.parse(line),game=getGameByCode(run.code),id=run.code+'/'+run.start;
  assert.ok(game && game.group!=='custom_4');
  if (seen.has(id)||run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions||run.start!==run.finish) continue;
  seen.add(id);
  const rep=sourceReplay(engine,{},run),first=rep.restore(0),geometry=orientedCouplingInitial(first.frame);
  const record={code:run.code,level:run.start,historicalWin:run.levels[0].won,arms:[]};
  results.push(record);
  if (!geometry || ![1,2,3,4,5].every(n=>first.availableActionIds.includes(n))) continue;
  const subjects=[...new Set(first.frame.flat())].filter(v=>![geometry.core,geometry.background,geometry.rest_shell].includes(v))
    .filter(v=>orientedCouplingScene(first.frame,geometry,v));
  if (subjects.length!==1 || !run.steps.length || ![1,2,3,4].includes(run.steps[0].a)) continue;
  const color=subjects[0];
  for (const allowRegrasp of [false,true]) {
    rep.restore(0);
    let board=rep.act(op(run.steps[0])),used=1;
    assert.equal(hash(board).slice(0,16),run.steps[0].to);
    let scene=orientedCouplingScene(board.frame,geometry,color);
    const arm={allowRegrasp,plans:[],issued:1,won:false,matched:0,divergence:null,inputs:[op(run.steps[0])]};
    record.arms.push(arm);
    if (!scene) continue;
    const tested=new Set();
    while (scene && !rep.win(board) && board.state==='NOT_FINISHED' && used<100) {
      const h=hash(board);
      if (tested.has(h)) break;
      tested.add(h);
      const floor=learnFloor(board.frame,geometry,scene);
      const plan=deliveryByRegrasp(floor,scene.pose,scene.face,parts(scene),geometry.targets,{allowRegrasp,budget:100-used});
      if (!plan) break;
      arm.plans.push({length:plan.steps.length,interactions:plan.steps.filter(s=>s.input==='ACTION5').length});
      let old=plan.initialObject;
      for (const s of plan.steps) {
        if (!board.availableActionIds.includes(Number(s.input.slice(6)))) {arm.divergence='unavailable';break;}
        board=rep.act(s.input);used++;arm.inputs.push(s.input);
        if (rep.win(board)||board.state!=='NOT_FINISHED') break;
        scene=orientedCouplingScene(board.frame,geometry,color);
        if (!scene || !equal(scene.pose,s.actor) || !equal(scene.face,s.face) ||
          !Object.hasOwn(scene.boxes,s.object.join()) || (!equal(s.object,old)&&Object.hasOwn(scene.boxes,old.join()))) {
          arm.divergence=s.input;break;
        }
        arm.matched++;old=s.object;
      }
      if (arm.divergence) break;
    }
    arm.issued=used;arm.won=rep.win(board);arm.final=hash(board);
  }
}
await writeFile(output,JSON.stringify(results));
console.log('levels',results.length,'with visible configuration',results.filter(r=>r.arms.length).length);
