import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';
import {footprints,changedFootprints} from './source-contact-footprints.mjs';
import {getGameByCode} from '../src/games/catalog.ts';

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment)),results=[];
const id=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const center=p=>[(p[0]+p[2])/2,(p[1]+p[3])/2];
const key=v=>v.join(','),delta=(a,b)=>a.map((v,i)=>b[i]-v),taxi=p=>Math.abs(p[0])+Math.abs(p[1]);
for(const f of files)for(const raw of (await readFile(f,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(raw),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');
  if(r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions||r.start!==r.finish)continue;
  const rep=sourceReplay(engine,{},r),steps=[],motion=new Map();
  let b=rep.restore(0),parts=footprints(b.frame);
  for(const [i,s] of r.steps.entries()){
    const n=rep.act(op(s));assert.equal(hash(n).slice(0,16),s.to);
    if(rep.win(n)||n.state!=='NOT_FINISHED')break;
    const next=footprints(n.frame);
    if(s.a>=1&&s.a<=4){
      const moves=changedFootprints(parts,next).filter(m=>m.copies===1);
      for(const m of moves){
        const controls=motion.get(m.shape)??new Map(),observed=controls.get(op(s))??new Map(),d=key([m.dx,m.dy]);
        observed.set(d,(observed.get(d)??0)+1);controls.set(op(s),observed);motion.set(m.shape,controls);
      }
      steps.push({i,op:op(s),parts,next,rows:b.frame,moves});
    }
    b=n;parts=next;
  }
  const candidates=[];
  for(const [actor,controls] of motion){
    const motors=new Map([...controls].filter(([,d])=>d.size===1).map(([q,d])=>[q,[...d.keys()][0].split(',').map(Number)]));
    if(motors.size<2||motors.size!==controls.size)continue;
    const pitches=new Set([...motors.values()].map(taxi));if(pitches.size!==1)continue;const pitch=[...pitches][0];
    for(const [peer,responses] of motion){
      if(peer===actor||![...responses.values()].some(d=>d.size>=2))continue;
      const samples=[];
      for(const st of steps){
        const aa=st.parts.get(actor),bb=st.parts.get(peer),a2=st.next.get(actor),b2=st.next.get(peer);
        if(aa?.size!==1||bb?.size!==1||a2?.size!==1||b2?.size!==1||!motors.has(st.op))continue;
        const A=[...aa.values()][0].bbox,B=[...bb.values()][0].bbox;
        const a=center(A),b=center(B),an=center([...a2.values()][0].bbox),bn=center([...b2.values()][0].bbox);
        const da=delta(a,an),db=delta(b,bn);
        if(taxi(db)!==0&&taxi(db)!==pitch||Math.max(...delta(a,b).map(Math.abs))<pitch/2)continue;
        samples.push({at:st.i,input:st.op,a,b,da,db,
          toward:taxi(delta(an,bn))-taxi(delta(an,b)),range:taxi(delta(an,b))/pitch});
      }
      const both=samples.filter(s=>taxi(s.da)&&taxi(s.db)).length;
      if(both>=2)candidates.push({actor:id(actor),peer:id(peer),pitch,motors:Object.fromEntries(motors),both,samples});
    }
  }
  candidates.sort((a,b)=>b.both-a.both||b.samples.length-a.samples.length);
  results.push({code:r.code,level:r.start,won:r.levels[0].won,options:candidates.length,model:candidates[0]??null});
}
await writeFile(output,JSON.stringify(results));console.log('episodes',results.length,'recognized',results.filter(r=>r.model).length);
