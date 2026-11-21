import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

const [environment,evidence,output,...files] = process.argv.slice(2);
const cases = JSON.parse(await readFile(evidence,'utf8')).continuations.unseenCases;
const engine = await sourceBackend(resolve(environment)), results = [];
const seen = new Set();
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const r = JSON.parse(line), game = getGameByCode(r.code);
  assert.ok(game && game.group !== 'custom_4');
  const id = r.code+'/'+r.start;
  if (seen.has(id) || r.error || r.resets || r.sourcePrefixActions || r.observedPriorLevelActions || r.start !== r.finish) continue;
  seen.add(id);
  const rep = sourceReplay(engine,{},r);
  for (const {prefix,a,b,c} of cases.filter(v => v.code === r.code && v.level === r.start)) {
    const origin = rep.restore(prefix);
    const equal = origin.availableActionIds.filter(n=>n>=1&&n<=4).map(n=>'ACTION'+n)
      .filter(input=>input!==a).map(input=>[input,b,c]);
    const arms = {full:[a,b,c],omitA:[b,c],omitB:[a,c],omitC:[a,b],useAlone:[c],none:[],
      historical:r.steps.slice(prefix,prefix+3).map(op),...Object.fromEntries(equal.map((v,i)=>['rival'+i,v]))};
    const play = word => {
      let board = rep.restore(prefix),used=0;
      for (const key of word) {
        if (rep.win(board) || board.state !== 'NOT_FINISHED' ||
          !board.availableActionIds.includes(Number(key.split(':')[0].slice(6)))) break;
        board = rep.act(key);
        used++;
      }
      return {win:rep.win(board),used,final:hash(board)};
    };
    for (const offset of [0,3]) {
      const suffix = r.steps.slice(prefix+offset,prefix+offset+Math.max(0,r.cap-prefix-3)).map(op);
      const cache = new Map(),outcomes = {};
      for (const [label,lead] of Object.entries(arms)) {
        const word = [...lead,...suffix], key = JSON.stringify(word);
        if (!cache.has(key)) cache.set(key,play(word));
        outcomes[label] = cache.get(key);
      }
      if (offset === 3 && prefix+3+suffix.length === r.issued) {
        assert.equal(outcomes.historical.final.slice(0,16),r.steps.at(-1).to);
        assert.equal(outcomes.historical.win,r.levels[0].won);
      }
      results.push({code:r.code,level:r.start,prefix,plan:[a,b,c],offset,suffixLength:suffix.length,outcomes});
    }
  }
}
await writeFile(output,JSON.stringify(results));
console.log('matched continuations',results.length,'wins',results.filter(r=>r.outcomes.full.win).length);
