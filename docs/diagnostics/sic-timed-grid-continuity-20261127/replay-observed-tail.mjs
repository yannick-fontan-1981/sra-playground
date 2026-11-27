// Diagnostic only: reproduce already executed public commands, then retain
// their actual public returns. There is no agent, planning, hidden state read,
// new command selection, direct level entry, or success/time qualification.
// Usage: node THIS.mjs FULL_CAPTURE.json STRICT_RESULT.jsonl OUTPUT.json
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [captureFile, strictFile, outputFile] = process.argv.slice(2);
if (!captureFile || !strictFile || !outputFile) throw Error('Supply the actual capture, strict result and output paths');
const bytes = await readFile(captureFile), strictBytes = await readFile(strictFile);
const source = JSON.parse(bytes), strict = JSON.parse(strictBytes.toString().trim());
const prefix = [...source.learning, ...source.publicEvidence.map(step => ({ action:step.action, after:step.publicAfter }))];
const indexed = new Map(prefix.map((step,index) => [index+1, step.action]));
for (const command of strict.recentCommands) {
  if (indexed.has(command.index)) assert.equal(indexed.get(command.index).id, command.id, 'The observed command overlap diverges');
  else { assert.equal(command.index,indexed.size+1,'The public command trace contains a gap'); indexed.set(command.index,{id:command.id}); }
}
assert.equal(indexed.size,strict.actions);
const { sourceBackend } = await import(pathToFileURL(resolve('scripts/sic-study-source-games.mjs')));
const backend = await sourceBackend(process.cwd()), began = new Date().toISOString();
let board = await backend.dispatch({type:'load',code:source.code,level:1});
const project = value => ({ level:value.level,levelsCompleted:value.levelsCompleted,state:value.state,
  frame:value.frame,frames:value.frames,availableActionIds:value.availableActionIds });
const tail = [];
for (const [index,action] of indexed) {
  const before = project(board);
  board = await backend.dispatch({type:'action',actionId:action.id,...(action.id===6?{data:action.data}:{})});
  if (index<=prefix.length) {
    const previous=prefix[index-1].after;
    assert.deepEqual(board.frame,previous.frame,'Public pixels diverge at '+index);
    assert.equal(board.level,previous.level);assert.equal(board.levelsCompleted,previous.levelsCompleted);
    if(previous.frames)assert.deepEqual(board.frames,previous.frames,'Public animation diverges at '+index);
  } else tail.push({index,action,before,after:project(board)});
}
const hash = data => createHash('sha256').update(data).digest('hex');
const result={schema:'sic.observed-command-public-tail.v1',diagnosticOnly:true,sourceCode:source.code,
  checkoutSource:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  navigationSha256:hash(await readFile('src/sic/navigate-revealed-grid.ts')),
  prefixSource:source.source,prefixCaptureSha256:hash(bytes),strictResultSha256:hash(strictBytes),
  startedAt:began,finishedAt:new Date().toISOString(),matchedPrefixReturns:prefix.length,
  replayedCommands:indexed.size,tail,levelsCompleted:board.levelsCompleted,
  qualification:'Recorded public command restitution only. No agent run, planning, new command, private game data or time-budget qualification.'};
await writeFile(outputFile,JSON.stringify(result));
console.log(JSON.stringify({outputFile,matchedPrefixReturns:prefix.length,tailReturns:tail.length,levelsCompleted:board.levelsCompleted}));
