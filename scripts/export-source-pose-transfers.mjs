import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourcePoseIndex} from './source-numbered-poses.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

const [environment,cache,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),known=new Set(),extra=[];
for(const f of await readdir(cache)) {
  if(!/^poses20-.*\.json$/.test(f)) continue;
  for(const r of JSON.parse(await readFile(join(cache,f),'utf8'))) known.add(r.code+'/'+r.level);
}
for(const file of files) for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const r=JSON.parse(line),game=getGameByCode(r.code),id=r.code+'/'+r.start;
  assert.ok(game && game.group!=='custom_4');
  if(known.has(id)||r.error||r.resets||r.observedPriorLevelActions||r.sourcePrefixActions||r.start!==r.finish) continue;
  known.add(id);
  const rep=sourceReplay(engine,{},r),pose=sourcePoseIndex(),frames={},steps=[];
  let board=rep.restore(0);
  for(const step of r.steps) {
    const h=hash(board).slice(0,16);assert.equal(h,step.from);
    frames[h]??=(await pose(board)).rows;
    board=rep.act(op(step));
    const z=hash(board).slice(0,16);assert.equal(z,step.to);
    const end=rep.win(board);
    if(!end) frames[z]??=(await pose(board)).rows;
    steps.push([h,op(step),z,end]);
  }
  extra.push({code:r.code,level:r.start,steps,frames});
}
await writeFile(output,JSON.stringify(extra));
console.log('additional source levels',extra.length);
