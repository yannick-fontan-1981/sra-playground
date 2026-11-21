import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {geometricComponents} from '../src/logos-engine/v6-native-observer.ts';
import learned from '../src/sic/source-field-relations.json' with {type:'json'};
import {partialFieldPlans} from './source-partial-field-relations.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay} from './sic-study-source-replay.mjs';

import { experiment } from './source-coupled-field-model.mjs';

const [environment,output,...args]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const transferColumns=args.includes('--transfer-columns'),ordinaryOnly=args.includes('--ordinary-only');
const files=args.filter(f=>f!=='--transfer-columns'&&f!=='--ordinary-only');
const results=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game&&game.group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions)continue;
  const rep=sourceReplay(engine,{},run),board=rep.restore(0);
  const plans=board.availableActionIds.includes(6)?partialFieldPlans(board.frame,geometricComponents(board.frame),learned.rules,true,true):[];
  const eligible=plans.filter(p=>p.palette.length===2&&p.obligations.some(s=>s.palette));
  results.push({code:run.code,level:run.start,baselineWon:run.levels[0].won,trial:eligible[0]?experiment(run,rep,eligible[0],{transferColumns,ordinaryOnly}):null});
}
await writeFile(output,JSON.stringify(results));
console.log('cold trials',results.filter(r=>r.trial).length,'wins',results.filter(r=>r.trial?.won).length);
