import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { correspondences } from './source-operand-correspondence.mjs';
import { footprints,newOperandMemory,observeOperands,proposeOperands,operandContrasts } from './source-retained-operations.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay,hash,op } from './sic-study-source-replay.mjs';

const [environment,output,...inputs]=process.argv.slice(2), engine=await sourceBackend(resolve(environment));
const partial=inputs.includes('--partial'),files=inputs.filter(arg=>arg!=='--partial');
const split=patch=>patch.split('/').map(row=>row.split(',').map(Number));
function projectedValue(rule,target,rows,[a,b,c,d,u,v]) {
  const before=split(rule.before),after=split(rule.after);
  let old=true,desired=true,changed=0;
  const landmarks=[];
  for (let j=0;j<before.length;j++) for(let i=0;i<before[j].length;i++) {
    if(before[j][i]===after[j][i])continue;
    const x=target[0]+i,y=target[1]+j,tx=a*x+b*y+u,ty=c*x+d*y+v;
    if(tx>=target[0] && tx<=target[2] && ty>=target[1] && ty<=target[3])return null;
    const pixel=rows[ty]?.[tx];if(pixel===undefined)return null;
    changed++;old&&=pixel===before[j][i];desired&&=pixel===after[j][i];
    landmarks.push([tx,ty,pixel]);
  }
  return changed && (old||desired)?{desired,landmarks}:null;
}
const ruleKey=r=>JSON.stringify([r.operand,r.binding,r.before,r.after]);
function propose(memory,board,layout) {
  const options=proposeOperands(memory,board.frame,layout,new Set(board.availableActionIds)),candidates=[];
  for(const rule of new Set(options.map(o=>o.rule))) {
    const siblings=options.filter(o=>o.rule===rule);
    if(siblings.length<3 || siblings.length>48)continue;
    for(const relation of correspondences(board.frame,siblings).evidence) {
      const projected=siblings.map(o=>projectedValue(rule,o.target,board.frame,relation.matrix));
      if(!partial && projected.some(v=>!v))continue;
      const known=projected.filter(Boolean);
      const todo=siblings.filter((o,i)=>projected[i]?.desired);
      if(todo.length<2 || todo.length===siblings.length)continue;
      const insideChange=([x,y])=>todo.some(({target:[l,t,r,b]})=>x>=l&&x<=r&&y>=t&&y<=b);
      if(known.filter(v=>!partial||v.desired).some(v=>v.landmarks.some(insideChange)))continue;
      const landmarks=known.flatMap(v=>v.landmarks).filter(p=>!insideChange(p));
      candidates.push({role:ruleKey(rule),targets:todo.map(o=>o.target),landmarks,subjects:known.length,unresolved:siblings.length-known.length,
        witnesses:siblings[0].kept.length,model:relation.kind,word:todo.map(o=>o.word)});
    }
  }
  candidates.sort((a,b)=>b.witnesses-a.witnesses || b.subjects-a.subjects || a.targets.length-b.targets.length);
  const best=candidates[0];if(!best)return;
  const peers=candidates.filter(c=>c.witnesses===best.witnesses && c.subjects===best.subjects && c.targets.length===best.targets.length);
  if(peers.some(c=>c.role!==best.role || JSON.stringify(c.targets)!==JSON.stringify(best.targets)))return;
  return best;
}

function tryProgram(rep,run,prefix,original,plan) {
  let board=rep.restore(prefix),layout=footprints(board.frame);
  const memory=structuredClone(original),used=[],outcomes=[];
  const collected=[],patch=(rows,box)=>rows.slice(box[1],box[3]+1).map(r=>r.slice(box[0],box[2]+1).join(',')).join('/');
  let stop='all_predicted_sites_obtained';
  outer:for(const target of plan.targets) {
    const current=proposeOperands(memory,board.frame,layout,new Set(board.availableActionIds))
      .find(o=>ruleKey(o.rule)===plan.role && o.target.join()===target.join());
    if(!current){stop='unreachable_next_operand';break;}
    for(const command of current.word) {
      if(prefix+used.length>=run.cap || !board.availableActionIds.includes(Number(command.split(':')[0].slice(6)))){stop='budget_or_availability';break outer;}
      const next=rep.act(command);used.push(command);
      if(rep.win(next)){stop='official_completion';board=next;break outer;}
      if(next.state!=='NOT_FINISHED'){stop='terminal';board=next;break outer;}
      const view=footprints(next.frame);
      observeOperands(memory,board.frame,next.frame,layout,view,command,prefix+used.length);board=next;layout=view;
    }
    const effect=operandContrasts(current,board.frame);
    const held=collected.every(c=>patch(board.frame,c.box)===c.value);
    const fixed=plan.landmarks.every(([x,y,color])=>board.frame[y]?.[x]===color);
    outcomes.push({changed:effect.changed,preserved:effect.kept&&held,reference:fixed});
    if(!effect.changed||!effect.kept||!held||!fixed){stop='public_prediction_refuted';break;}
    collected.push({box:target,value:current.rule.after});
  }
  let omission=null;
  if(rep.win(board)){
    let again=rep.restore(prefix);for(const c of used)again=rep.act(c);
    assert.equal(hash(again),hash(board));assert.ok(rep.win(again));
    let short=rep.restore(prefix);
    for(const c of used.slice(1)){if(rep.win(short)||short.state!=='NOT_FINISHED'||!short.availableActionIds.includes(Number(c.split(':')[0].slice(6))))break;short=rep.act(c);}
    omission=rep.win(short);
  }
  return {prefix,targets:plan.targets,subjects:plan.subjects,unresolved:plan.unresolved,witnesses:plan.witnesses,model:plan.model,used,outcomes,stop,won:rep.win(board),omission};
}

const results=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game&&game.group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions)continue;
  const rep=sourceReplay(engine,{},run),memory=newOperandMemory(),seen=new Set(),trials=[];
  let board=rep.restore(0),layout=footprints(board.frame);
  for(const [i,c] of run.steps.entries()){
    if(trials.length>=4)break;
    const plan=propose(memory,board,layout);
    if(plan) {
      const key=JSON.stringify([plan.role,plan.targets,plan.witnesses]);
      if(!seen.has(key)){seen.add(key);trials.push(tryProgram(rep,run,i,memory,plan));rep.restore(i);}
    }
    const next=rep.act(op(c));assert.equal(hash(next).slice(0,16),c.to);
    if(rep.win(next)||next.state!=='NOT_FINISHED')break;
    const view=footprints(next.frame);observeOperands(memory,board.frame,next.frame,layout,view,op(c),i+1);
    board=next;layout=view;
  }
  results.push({code:run.code,level:run.start,baselineWon:run.levels[0].won,trials});
}
await writeFile(output,JSON.stringify(results));
console.log('branches',results.reduce((n,r)=>n+r.trials.length,0));
