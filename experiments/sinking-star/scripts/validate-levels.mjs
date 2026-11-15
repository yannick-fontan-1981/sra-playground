/** Authoring report; this script and its witnesses are excluded from the browser. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { compileLevel, initialState, stepWorld } from '../dist/core.js';
import { SS01_LEVELS } from '../dist/levels.js';
import { LEGACY_LEVELS } from '../tests/fixtures/pilot-levels.mjs';
import { search, walkingCells } from '../tests/helpers/search.mjs';
const reports = SS01_LEVELS.map((spec,i) => {
  const w=compileLevel(spec), s=initialState(w), result=search(w);
  const walkingOnly=search(w,{actions:[1,2,3,4]});
  assert.equal(result.status,'solved'); assert.equal(walkingOnly.status,'unsolvable');
  let replay=s;
  for(const a of result.actions) replay=stepWorld(w,replay,a);
  assert.equal(replay.complete,true);
  return {level:i+1,id:spec.id,title:spec.title,
    walkableCellsBeforePower:walkingCells(w).length,
    previousWalkableCells:i<3?walkingCells(compileLevel(LEGACY_LEVELS[i])).length:null,
    initialMovementChoices:[1,2,3,4].filter(a=>JSON.stringify(stepWorld(w,s,a).hero)!==JSON.stringify(s.hero)).length,
    shortestActionCount:result.actions.length,shortestActions:result.actions,
    searchStatus:result.status,discoveredStates:result.visited,walkingOnly:walkingOnly.status};
});
const report={version:'0.1.0',scope:'author-validation-only; not SRA performance',
  search:'Exhaustive breadth-first search; facing and feedback omitted from key because Merchant rules ignore them.',
  levels:reports};
await writeFile(new URL('../docs/validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.table(reports.map(({level,walkableCellsBeforePower,initialMovementChoices,shortestActionCount,walkingOnly})=>({level,walkableCellsBeforePower,initialMovementChoices,shortestActionCount,walkingOnly})));
