import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';
import {footprints,changedFootprints} from './source-contact-footprints.mjs';

const [environment,output,routes,proposals,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const read=async f=>JSON.parse(await readFile(f,'utf8'));
const routeRows=await read(routes),trials=await read(proposals),episodes=new Map(),results=[];
const sig=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const key=p=>p.join(','),site=box=>box.slice(0,2),add=(p,d)=>p.map((v,i)=>v+d[i]);
for(const f of files)for(const s of (await readFile(f,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(s),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');
  episodes.set([r.code,r.start].join('/'),r);
}
function surface(rows,box,delta){
  const [x0,y0,x1,y1]=box,[dx,dy]=delta,values=[];
  for(let y=y0+dy;y<=y1+dy;y++)for(let x=x0+dx;x<=x1+dx;x++)
    if(x<x0||x>x1||y<y0||y>y1)values.push(rows[y]?.[x]??-1);
  return sig(values.join(','));
}
for(const route of routeRows){
  const {code,level,prefix}=route,run=episodes.get([code,level].join('/'));
  assert.ok(run&&!run.resets&&!run.observedPriorLevelActions&&!run.sourcePrefixActions);
  const trial=trials.find(r=>r.code===code&&r.level===level).trials.find(t=>t.prefix===prefix);
  const s=trial.continuation,rep=sourceReplay(engine,{},run);
  const flash=rep.restore(s.ref-1),after=rep.act(s.input);
  assert.equal(hash(after).slice(0,16),run.steps[s.ref-1].to);
  const moves=changedFootprints(footprints(flash.frame),footprints(after.frame));
  const roles=[{id:'A',sig:trial.actor,old:add(s.oldPeer,s.requiredOffset),now:add(s.from,s.requiredOffset)},
    {id:'B',sig:trial.peer,old:s.oldPeer,now:s.from}].map(r=>{
      const move=moves.find(m=>sig(m.shape)===r.sig&&key(site(m.from.bbox))===key(r.old));assert.ok(move);
      return {...r,shape:move.shape,delta:[move.dx,move.dy],witness:surface(flash.frame,move.from.bbox,[move.dx,move.dy]),lands:new Set()};
    });
  let b=rep.restore(0);
  for(const step of run.steps.slice(0,prefix)){
    const n=rep.act(op(step)),moved=changedFootprints(footprints(b.frame),footprints(n.frame));
    for(const role of roles)for(const m of moved)if(m.shape===role.shape&&m.dx===role.delta[0]&&m.dy===role.delta[1])
      role.lands.add(surface(b.frame,m.from.bbox,role.delta));
    b=n;
  }
  for(const ex of route.reachedExamples??[]){
    rep.restore(prefix);for(const cmd of [...trial.present,trial.test,...ex.word])b=rep.act(cmd);
    assert.equal(hash(b),ex.frame);
    const f=footprints(b.frame);
    const measured=roles.map(role=>{
      const box=[...(f.get(role.shape)?.values()??[])].find(p=>key(site(p.bbox))===key(role.now))?.bbox;assert.ok(box);
      const pattern=surface(b.frame,box,role.delta);
      return {role:role.id,box,delta:role.delta,sameAsWitness:pattern===role.witness,previouslyTraversedSurface:role.lands.has(pattern)};
    });
    const n=rep.act(s.input),g=footprints(n.frame),changes=changedFootprints(f,g);
    const check=measured.map((m,i)=>{
      const role=roles[i],move=changes.find(c=>c.shape===role.shape&&key(c.from.bbox)===key(m.box));
      return {...m,actual:move?[move.dx,move.dy]:g.get(role.shape)?.has(key(m.box))?[0,0]:null};
    });
    results.push({code,level,prefix,ref:s.ref,word:ex.word,input:s.input,image:ex.frame,unchanged:hash(b)===hash(n),roles:check});
  }
}
await writeFile(output,JSON.stringify(results));console.log('controlled poses',results.length);
