import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {footprints,newOperandMemory,observeOperands,proposeOperands,verifyOperand} from './source-retained-operations.mjs';
import {correspondences} from './source-operand-correspondence.mjs';

const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),results=[];
const policy=process.env.SIC_STUDY_OPERAND_POLICY??'baseline';
assert.ok(['baseline','correspondence'].includes(policy));
function proposals(memory,rows,view,available){
  const all=proposeOperands(memory,rows,view,available);
  if(policy==='baseline')return all;
  const supported=[];
  for(const rule of new Set(all.map(o=>o.rule))){
    const options=all.filter(o=>o.rule===rule);
    if(options.length===1){supported.push(options[0]);continue;}
    const relation=correspondences(rows,options);
    const ranked=options.map((offer,i)=>({offer,score:relation.score[i]})).filter(x=>x.score>0);
    ranked.sort((a,b)=>b.score-a.score);
    supported.push(...ranked.map(x=>x.offer));
  }
  return supported;
}
const digest=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
function offerId(o){return JSON.stringify([o.rule.operand,o.rule.before,o.rule.after,o.rule.binding,o.target]);}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),game=getGameByCode(r.code);
  assert.ok(game&&game.group!=='custom_4');
  if(r.error||r.resets||r.observedPriorLevelActions||r.sourcePrefixActions||r.start!==r.finish)continue;
  const rep=sourceReplay(engine,{},r),memory=newOperandMemory(),tested=new Set(),branches=[];
  const live=b=>b.state==='NOT_FINISHED'&&!rep.win(b);
  let b=rep.restore(0),view=footprints(b.frame);
  for(const [i,recorded] of r.steps.entries()){
    const offers=proposals(memory,b.frame,view,new Set(b.availableActionIds));
    const first=offers.find(o=>!tested.has(offerId(o))&&i+o.word.length<=r.cap);
    if(first&&branches.length<4){
      tested.add(offerId(first));
      let current=b,layout=view,offer=first,reason='bound';
      const local=structuredClone(memory),used=[],trials=[],sites=new Set();
      for(let j=0;j<16&&offer&&live(current);j++){
        const id=offerId(offer);if(sites.has(id)){reason='repeated';break;}sites.add(id);
        if(i+used.length+offer.word.length>r.cap){reason='budget';break;}
        let executed=0;
        for(const input of offer.word){
          if(!live(current)||!current.availableActionIds.includes(Number(input.split(':')[0].slice(6))))break;
          const next=rep.act(input);used.push(input);executed++;
          if(live(next)){
            const v=footprints(next.frame);
            observeOperands(local,current.frame,next.frame,layout,v,input,i+used.length);layout=v;
          }
          current=next;
        }
        const result=live(current)&&executed===offer.word.length?verifyOperand(offer,current.frame):null;
        trials.push({kind:offer.rule.binding.kind,actor:offer.rule.binding.actor?digest(offer.rule.binding.actor):null,
          operand:digest(offer.rule.operand),target:offer.target,witnesses:offer.kept.map(s=>s.step),remaining:offer.remaining,
          word:offer.word,executed,result,won:rep.win(current)});
        if(!live(current)){reason=rep.win(current)?'score':'game_over';break;}
        if(!result?.changed||!result?.kept){reason=result?.kept?'effect_missing':'acquired_effect_lost';break;}
        offer=proposals(local,current.frame,layout,new Set(current.availableActionIds)).find(o=>!sites.has(offerId(o)));
        if(!offer)reason='no_continuation';
      }
      const branchWon=rep.win(current),scoreControls=[];
      if(branchWon){
        function replay(word){
          let n=rep.restore(i),length=0;
          for(const q of word){
            if(!live(n)||!n.availableActionIds.includes(Number(q.split(':')[0].slice(6))))break;
            n=rep.act(q);length++;
          }
          return {won:rep.win(n),length};
        }
        const observed=r.steps.slice(i,i+used.length).map(op);
        scoreControls.push({type:'recorded',...replay(observed),identical:used.join('/')===observed.join('/')});
        for(const cmd of new Set(used))scoreControls.push({type:'constant',input:cmd,...replay(Array(used.length).fill(cmd))});
        if(used.length<=12)for(let n=0;n<used.length;n++)
          scoreControls.push({type:'omit',index:n,...replay(used.filter((_,j)=>j!==n))});
      }
      branches.push({prefix:i,used:used.length,reason,won:branchWon,baselineWon:r.levels[0].won,trials,scoreControls});
      rep.restore(i);
    }
    const next=rep.act(op(recorded));assert.equal(hash(next).slice(0,16),recorded.to);
    if(!live(next))break;
    const v=footprints(next.frame);observeOperands(memory,b.frame,next.frame,view,v,op(recorded),i+1);
    b=next;view=v;
  }
  results.push({code:r.code,level:r.start,baselineWon:r.levels[0].won,baselineActions:r.issued,rules:memory.rules.size,branches});
}
await writeFile(output,JSON.stringify(results));
console.log('episodes',results.length,'branches',results.reduce((n,r)=>n+r.branches.length,0),'wins',results.filter(r=>r.branches.some(b=>b.won)).length);
