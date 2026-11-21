import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {footprints} from './source-contact-footprints.mjs';
import {poseFamilyKey} from '../src/sic/pose-families.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,output,evidence,identity,inference,...files]=process.argv.slice(2);
assert.ok(['exact','rigid'].includes(identity));
assert.ok(['observed','one_unknown'].includes(inference));
const engine=await sourceBackend(resolve(environment)),results=[];
const reports=JSON.parse(await readFile(evidence,'utf8'));
const token=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const center=p=>[0,1].map(i=>(p.bbox[i]+p.bbox[i+2])/2);
const distance=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const families=new Map();
function family(key,group){
  if(identity==='exact')return token(key);
  if(!families.has(key)){
    const p=group.values().next().value;
    families.set(key,poseFamilyKey({palette_value:p.color,mask:p.mask,bbox:p.bbox}));
  }
  return families.get(key);
}
function findActor(view,kind){
  if(!kind)return null;
  const matches=[...view].filter(([k,g])=>family(k,g)===kind).flatMap(([,g])=>[...g.values()]);
  return matches.length===1?matches[0]:null;
}

// The only hypothetical floor consists of witnessed actor sites and visible
// copies of the acquired objective. A single plan must include every sibling.
function visitAll(start,sites,goals,motors,budget){
  if(goals.length<2||goals.length>12||motors.length<2)return;
  const goalAt=new Map(goals.map((p,i)=>[p.join(),1<<i])),complete=(1<<goals.length)-1;
  const queue=[{at:start,mask:0,parent:-1,input:null,depth:0}],seen=new Set([start.join()+'/0']);
  for(let i=0;i<queue.length&&i<30000;i++){
    const q=queue[i];
    if(q.mask===complete){
      const path=[];
      for(let j=i;queue[j].parent>=0;j=queue[j].parent)path.push(queue[j]);
      return path.reverse();
    }
    if(q.depth>=budget)continue;
    for(const [input,d] of motors){
      const at=add(q.at,d),cell=at.join(),mask=q.mask|(goalAt.get(cell)??0),key=cell+'/'+mask;
      if(!sites.has(cell)||seen.has(key))continue;
      seen.add(key);queue.push({at,mask,parent:i,input,depth:q.depth+1});
    }
  }
}
function routeWithOneUnknown(start,sites,goals,motors,budget,inputs,pitch){
  const known=visitAll(start,sites,goals,motors,budget);
  if(known)return {path:known};
  if(inference!=='one_unknown'||!motors.length)return;
  const options=[];
  for(const input of inputs.filter(n=>n>=1&&n<=4).map(n=>'ACTION'+n)){
    if(motors.some(([op])=>op===input))continue;
    for(const d of [[pitch,0],[-pitch,0],[0,pitch],[0,-pitch]]){
      if(motors.some(([,v])=>v.join()===d.join()))continue;
      const path=visitAll(start,sites,goals,[...motors,[input,d]],budget);
      if(path?.some(q=>q.input===input))options.push({path,unknown:{input,d}});
    }
  }
  return options.sort((a,b)=>a.path.length-b.path.length||
    a.path.findIndex(q=>q.input===a.unknown.input)-b.path.findIndex(q=>q.input===b.unknown.input))[0];
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),game=getGameByCode(r.code);assert.ok(game&&game.group!=='custom_4');
  const report=reports.find(c=>c.code===r.code&&c.level===r.start);
  if(!report?.confirmations.length||r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions)continue;
  const rep=sourceReplay(engine,{},r),trials=[],seenPlans=new Set(),obstacles={};
  const blocked=k=>{obstacles[k]=(obstacles[k]??0)+1;};
  for(const w of report.confirmations){
    if(trials.length>=5)break;
    let board=rep.restore(0),view=footprints(board.frame),pitch=w.pitch;
    const dirs=new Map(),sites=new Set();let kind;
    for(const [i,s] of r.steps.entries()){
      const raw=[...view].find(([k])=>token(k)===w.actor);
      if(raw)kind??=family(...raw);
      const actor=findActor(view,kind);
      if(actor)sites.add(center(actor).join());
      if(i>=w.confirmed&&actor&&trials.length<5){
        const marker=[...view.keys()].find(k=>token(k)===w.peer),peers=[...(view.get(marker)?.values()??[])];
        if(peers.some(p=>distance(center(p),w.firstSite)<=pitch*.45))break;
        const start=center(actor),motors=[...dirs].filter(([,v])=>v.size===1).map(([k,v])=>[k,[...v.values()][0]]);
        const goals=peers.map(p=>center(p).map((v,k)=>start[k]+pitch*Math.round((v-start[k])/pitch)));
        const unique=new Set(goals.map(p=>p.join()));
        if(!unique.has(start.join())&&unique.size===peers.length){
          const key=[kind,marker,start.join(),[...unique].sort().join('/'),motors.map(m=>m.join()).join('/')].join('|');
          if(!seenPlans.has(key)){
            seenPlans.add(key);
            const unmeasured=board.availableActionIds.filter(n=>!dirs.has('ACTION'+n));
            const solution=routeWithOneUnknown(start,new Set([...sites,...unique]),goals,motors,r.cap-i,unmeasured,pitch);
            if(solution){
              const {path,unknown}=solution;
              let b=board,old=view,mask=0,acquired=0,steps=0,reason='completed';
              let testedUnknown=0,matchedUnknown=0;
              const alternativeControls=[];let divergence;
              for(const q of path){
                if(!b.availableActionIds.includes(Number(q.input.slice(6)))){reason='input_unavailable';break;}
                if(unknown?.input===q.input)testedUnknown++;
                const before=hash(b);
                b=rep.act(q.input);steps++;
                if(rep.win(b)){reason='score';break;}
                if(b.state!=='NOT_FINISHED'){reason='game_over';break;}
                const next=footprints(b.frame),subject=findActor(next,kind),items=[...(next.get(marker)?.values()??[])];
                if(!subject||distance(center(subject),q.at)>.001){
                  reason='actor_diverged';
                  divergence={input:q.input,wasUnknown:unknown?.input===q.input,expected:q.at,returned:subject?center(subject):null};
                  for(const n of board.availableActionIds.filter(n=>n>=1&&n<=4)){
                    const control='ACTION'+n;
                    if(control===q.input)continue;
                    let branch=rep.restore(i);
                    for(const earlier of path.slice(0,steps-1))branch=rep.act(earlier.input);
                    assert.equal(hash(branch),before);
                    if(!branch.availableActionIds.includes(n))continue;
                    branch=rep.act(control);
                    const immediate=rep.win(branch),after=immediate?null:findActor(footprints(branch.frame),kind);
                    const matched=!!after&&distance(center(after),q.at)<.001;
                    let continued=0;
                    if(matched)for(const remaining of path.slice(steps)){
                      const action=remaining.input===q.input?control:remaining.input;
                      if(rep.win(branch)||branch.state!=='NOT_FINISHED'||!branch.availableActionIds.includes(Number(action.slice(6))))break;
                      branch=rep.act(action);continued++;
                    }
                    alternativeControls.push({control,immediate,matched,continued,won:rep.win(branch)});
                  }
                  break;
                }
                if(unknown?.input===q.input)matchedUnknown++;
                if(items.some(p=>distance(center(p),w.firstSite)<=pitch*.45)){reason='first_site_returned';break;}
                if(q.mask!==mask){
                  if(items.length!==(old.get(marker)?.size??0)-1||items.some(p=>distance(center(p),q.at)<=pitch*.45)){
                    reason='sibling_effect_missing';break;
                  }
                  acquired++;
                }
                mask=q.mask;old=next;
              }
              trials.push({prefix:i,earlier:w.step,keptFrom:w.confirmed,actor:w.actor,peer:w.peer,goals:goals.length,
                plan:path.map(q=>q.input),unknown,testedUnknown,matchedUnknown,divergence,alternativeControls,steps,acquired,reason,won:rep.win(b),baselineWon:r.levels[0].won,
                identicalPrefix:path.every((q,n)=>r.steps[i+n]&&op(r.steps[i+n])===q.input)});
              rep.restore(i);
            }else blocked(goals.length<2?'single_remaining':goals.length>12?'more_than_twelve':motors.length<2?'too_few_motors':'no_complete_route');
          }
        }
      }
      const b=rep.act(op(s));assert.equal(hash(b).slice(0,16),s.to);if(rep.win(b)||b.state!=='NOT_FINISHED')break;
      const next=footprints(b.frame);
      const arrived=findActor(next,kind);
      if(s.a>=1&&s.a<=4&&actor&&arrived){
        const d=center(arrived).map((v,i)=>v-center(actor)[i]);
        if(Math.abs(d[0])+Math.abs(d[1])===pitch&&d.includes(0)){
          const v=dirs.get(op(s))??new Map();v.set(d.join(),d);dirs.set(op(s),v);
        }
      }
      view=next;board=b;
    }
  }
  results.push({code:r.code,level:r.start,identity,inference,obstacles,trials});
}
await writeFile(output,JSON.stringify(results));
console.log('experiments', results.reduce((n,r)=>n+r.trials.length,0));
