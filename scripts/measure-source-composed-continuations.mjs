import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op} from './sic-study-source-replay.mjs';
import {primitiveProgram,joinPrograms,observedRewrite,learnRewrites,translatedOutcome} from '../src/sic/rewrite-composition.ts';

const [environment,study,out,...args]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const fromFrontier=args.includes('--frontier'),games=args.filter(k=>!k.startsWith('--'));
const read=async name=>readFile(resolve(study,name),'utf8');
const reports=[];
for(const code of games){
  const game=getGameByCode(code);assert.ok(game&&game.group!=='custom_4'&&game.group!=='official');
  const coverage=JSON.parse(await read((fromFrontier?'compose47-frontier-':'compose45-payoff-')+code+'.json'));
  const records=(await read('compose45-baseline-'+code+'-upper.jsonl')).trim().split(/\r?\n/).map(JSON.parse);
  for(const run of records){
    assert.ok(!run.resets&&!run.observedPriorLevelActions&&!run.sourcePrefixActions);
    const reference=coverage.find(q=>q.level===run.start),trials=[];
    for(const trial of reference.trials){
      const rep=sourceReplay(engine,{},run),bank=[],history=[];let board=rep.restore(0);
      for(const [i,cmd] of run.steps.slice(0,trial.at).entries()){
        const k=op(cmd),next=rep.act(k);assert.ok(!rep.win(next));
        learnRewrites(bank,board.frame,next.frame,k,i+1);
        history.push(k);board=next;
      }
      const past=trial.refs.map((ref,i)=>bank.find(r=>r.ref===ref&&r.op===trial.word[i]&&r.changes.length===trial.changed[i]));
      assert.ok(past.every(Boolean));
      const initial=board.frame.flat(),allow=new Set(board.availableActionIds.map(n=>'ACTION'+n));
      const apply=(state,r)=>{const out=[...state];for(const [p,,v] of r.changes)out[p]=v;return out;};
      const ready=(r,x)=>r.changes.every(([p,v])=>x[p]===v)&&(r.guards??[]).every(([p,v])=>x[p]===v);
      const ab=past.slice(0,-1).reduce(apply,initial),abc=apply(ab,past.at(-1));
      const joined=past.map(primitiveProgram).reduce((a,b)=>joinPrograms(a,b));assert.ok(joined);
      const prior=new Set(history.slice(3).map((_,i)=>history.slice(i,i+4).join('/')));
      const candidates=bank.filter(r=>allow.has(r.op.split(':')[0])&&r.op!==past.at(-1).op&&
        !ready(r,initial)&&!ready(r,ab)&&ready(r,abc)&&joinPrograms(joined,primitiveProgram(r))&&
        !prior.has([...trial.word,r.op].join('/'))&&r.changes.some(([p,,v])=>v!==initial[p]));
      candidates.sort((a,b)=>b.count-a.count||b.changes.length-a.changes.length);
      const d=fromFrontier?candidates.find(r=>r.op===trial.forecastNext?.op&&r.ref===trial.forecastNext?.source):candidates[0],report={prefix:trial.at,options:candidates.length};trials.push(report);
      if(!d||trial.at+4>run.cap)continue;
      function act(prefix){
        let b=rep.restore(trial.at);
        for(const key of prefix){if(rep.win(b)||b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(Number(key.split(':')[0].slice(6))))return {unavailable:true};b=rep.act(key);}
        if(rep.win(b)||b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(Number(d.op.split(':')[0].slice(6))))return {unavailable:true};
        const n=rep.act(d.op),won=rep.win(n),live=!won&&n.state==='NOT_FINISHED';
        return {won,atSite:live&&observedRewrite(d,b.frame,n.frame),anywhere:live&&translatedOutcome(d,b.frame,n.frame),
          end:createHash('sha256').update(JSON.stringify(n.frame)).digest('hex').slice(0,16)};
      }
      const [a,b,c]=trial.word,sham=history.find(k=>![a,b,c,d.op].includes(k)&&allow.has(k.split(':')[0]));
      Object.assign(report,{op:d.op,source:d.ref,afterFull:act([a,b,c]),beforeC:act([a,b]),beforeA:act([]),reversed:act([b,a,c]),...(sham?{equalLength:act([a,b,sham])}:{})});
    }
    reports.push({code,level:run.start,trials});
  }
}
await writeFile(out,JSON.stringify(reports));console.log(reports.reduce((n,r)=>n+r.trials.length,0));
