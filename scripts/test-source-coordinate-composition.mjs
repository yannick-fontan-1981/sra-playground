import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {footprints} from './source-contact-footprints.mjs';
import {newCoordinateMemory,observeCoordinates,coordinatePrograms,midpoint} from './source-coordinate-composition.mjs';

const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),results=[];
const id=s=>createHash('sha256').update(s).digest('hex').slice(0,12),same=(a,b)=>a?.join()===b?.join();
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),game=getGameByCode(r.code);assert.ok(game&&game.group!=='custom_4');
  if(r.error||r.resets||r.observedPriorLevelActions||r.sourcePrefixActions||r.start!==r.finish)continue;
  let b,view;const rep=sourceReplay(engine,{},r),memory=newCoordinateMemory(),tested=new Set(),groups=[];
  const live=n=>n.state==='NOT_FINISHED'&&!rep.win(n);
  b=rep.restore(0);view=footprints(b.frame);
  for(const [i,s] of r.steps.entries()){
    if(groups.length<4){
      const offers=coordinatePrograms(memory,view,b.frame,new Set(b.availableActionIds),i,r.cap-i),tests=[];
      for(const [rank,p] of offers.entries()){
        const signature=[p.role,p.marker,p.goal,p.start].join('/');
        if(tested.has(signature))continue;tested.add(signature);
        let n=rep.restore(i),at=p.start,remaining=[...p.word],matched=0,reason='arrived';
        assert.equal(hash(n),hash(b));
        const attempts=new Set(),used=[];
        while(live(n)&&remaining.length){
          if(i+used.length>=r.cap){reason='budget';break;}
          const j=remaining.findIndex(input=>!attempts.has([at,input].join('/')));
          if(j<0){reason='blocked';break;}
          const input=remaining[j],axis=input===p.x.input?0:1,delta=axis===0?p.x.delta:p.y.delta;
          if(!n.availableActionIds.includes(Number(input.slice(6)))){reason='unavailable';break;}
          const expected=[...at];expected[axis]+=delta;
          n=rep.act(input);used.push(input);
          if(!live(n)){reason=rep.win(n)?'score':'game_over';break;}
          const now=footprints(n.frame),actor=now.get(p.role);
          const position=actor?.size===1?midpoint(actor.values().next().value):null;
          if(same(position,expected)){matched++;remaining.splice(j,1);at=position;}
          else if(same(position,at))attempts.add([at,input].join('/'));
          else {reason='other_effect';break;}
          if(remaining.length&&!now.get(p.marker)?.has(p.site)){reason='marker_changed';break;}
        }
        const controls=[];
        if(rep.win(n)){
          function measure(word){let q=rep.restore(i),length=0;for(const action of word){
            if(!live(q)||!q.availableActionIds.includes(Number(action.split(':')[0].slice(6))))break;
            q=rep.act(action);length++;
          }return {length,won:rep.win(q)};}
          const recorded=r.steps.slice(i,i+used.length).map(op);
          controls.push({kind:'recorded',same:recorded.join('/')===used.join('/'),...measure(recorded)});
          for(const motor of [p.x,p.y])controls.push({kind:'constant',input:motor.input,...measure(Array(used.length).fill(motor.input))});
          if(used.length<=8)for(let k=0;k<used.length;k++)controls.push({kind:'omit',k,...measure(used.filter((_,j)=>j!==k))});
        }
        tests.push({rank,role:id(p.role),marker:id(p.marker),copies:p.copies,start:p.start,goal:p.goal,plan:p.word,
          support:[p.x.support,p.y.support],orderWitness:[p.xy,p.yx],terrainCost:p.cost,matched,used,reason,won:rep.win(n),controls});
        if(tests.length>=3)break;
      }
      if(tests.length){groups.push({prefix:i,tests});rep.restore(i);}
    }
    const n=rep.act(op(s));assert.equal(hash(n).slice(0,16),s.to);if(!live(n))break;
    const next=footprints(n.frame);observeCoordinates(memory,view,next,b.frame,n.frame,op(s),i+1);b=n;view=next;
  }
  results.push({code:r.code,level:r.start,baselineWon:r.levels[0].won,baselineActions:r.issued,groups});
}
await writeFile(output,JSON.stringify(results));console.log('episodes',results.length,'winning branches',results.flatMap(r=>r.groups.flatMap(g=>g.tests)).filter(t=>t.won).length);
