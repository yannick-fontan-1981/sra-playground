import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {footprints,newOperandMemory,observeOperands,proposeOperands,operandContrasts,operandContext} from './source-retained-operations.mjs';
import {correspondences} from './source-operand-correspondence.mjs';

const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),results=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),game=getGameByCode(r.code);assert.ok(game&&game.group!=='custom_4');
  if(r.error||r.resets||r.observedPriorLevelActions||r.sourcePrefixActions||r.start!==r.finish)continue;
  const rep=sourceReplay(engine,{},r),memory=newOperandMemory(),groups=[],tested=new Set();
  const live=b=>b.state==='NOT_FINISHED'&&!rep.win(b);
  let b=rep.restore(0),view=footprints(b.frame);
  for(const [i,s] of r.steps.entries()){
    const options=proposeOperands(memory,b.frame,view,new Set(b.availableActionIds));
    for(const rule of new Set(options.map(o=>o.rule))){
      if(groups.length>=4)break;
      const same=options.filter(o=>o.rule===rule&&i+o.word.length<=r.cap);
      if(same.length<2||same.length>32)continue;
      const fingerprint=JSON.stringify([rule.operand,rule.binding,same.map(o=>[o.target,o.word]),same[0].kept.map(s=>s.step)]);
      if(tested.has(fingerprint))continue;tested.add(fingerprint);
      const choices=[],relation=correspondences(b.frame,same);
      for(const [index,o] of same.entries()){
        const similarity=operandContext(o,b.frame);
        let n=rep.restore(i),used=0;assert.equal(hash(n),hash(b));
        for(const cmd of o.word){
          if(!live(n)||!n.availableActionIds.includes(Number(cmd.split(':')[0].slice(6))))break;
          n=rep.act(cmd);used++;
        }
        const won=rep.win(n),observed=live(n)&&used===o.word.length?operandContrasts(o,n.frame):null;
        choices.push({target:o.target,word:o.word,similarity,correspondence:relation.score[index],won,used,observed});
      }
      groups.push({prefix:i,sourceSites:same[0].kept.map(s=>s.step),kind:rule.binding.kind,relations:relation.evidence,choices});
      rep.restore(i);
    }
    const n=rep.act(op(s));assert.equal(hash(n).slice(0,16),s.to);if(!live(n))break;
    const v=footprints(n.frame);observeOperands(memory,b.frame,n.frame,view,v,op(s),i+1);b=n;view=v;
  }
  results.push({code:r.code,level:r.start,won:r.levels[0].won,groups});
}
await writeFile(output,JSON.stringify(results));console.log('origins',results.reduce((n,r)=>n+r.groups.length,0));
