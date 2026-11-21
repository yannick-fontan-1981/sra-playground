import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {hash, op, sourceReplay} from './sic-study-source-replay.mjs';

const [env, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(env));
const reports = [];
const at = (board, x, y) => board[y]?.[x];
const keyOf = (x, y) => x + ',' + y;

function observe(bank, before, after, command, ref) {
  const diff = [];
  for (let y = 0; y < before.length; y++) {
    for (let x = 0; x < before[y].length; x++) {
      if (before[y][x] !== after[y][x]) diff.push([x, y, before[y][x], after[y][x]]);
    }
  }
  if (diff.length < 2 || diff.length > 160) return;
  const minX = Math.min(...diff.map(p => p[0])), minY = Math.min(...diff.map(p => p[1]));
  if (diff.some(([x,y]) => x-minX >= 18 || y-minY >= 18)) return;
  const changes = diff.map(([x,y,from,to]) => [x-minX, y-minY, from, to]);
  const id = command.a;
  const click = id === 6 ? [command.data.x-minX, command.data.y-minY] : null;
  const key = JSON.stringify([id, click, changes]);
  const site = keyOf(minX, minY);
  const existing = bank.get(key);
  if (existing) {
    if (!existing.witnesses.has(site)) existing.witnesses.set(site, ref);
    existing.guards = existing.guards.filter(([x,y,v]) => at(before,minX+x,minY+y) === v);
    return;
  }
  const sources = new Set(changes.map(([x,y]) => keyOf(x,y)));
  const guardMap = new Map();
  for (const [dx,dy] of changes) {
    for (let j=-1; j<=1; j++) for (let i=-1; i<=1; i++) {
      const x=dx+i, y=dy+j, value=at(before,minX+x,minY+y), k=keyOf(x,y);
      if (value !== undefined && !sources.has(k)) guardMap.set(k,[x,y,value]);
    }
  }
  bank.set(key, {id,click,changes,guards:[...guardMap.values()],witnesses:new Map([[site,ref]])});
}
function ready(rows, rule, x, y) {
  return rule.changes.every(([dx,dy,v]) => at(rows,x+dx,y+dy) === v)
    && rule.guards.every(([dx,dy,v]) => at(rows,x+dx,y+dy) === v);
}
function command(rule,x,y,rows) {
  if (!rule.click) return 'ACTION'+rule.id;
  const [cx,cy]=[rule.click[0]+x,rule.click[1]+y];
  return at(rows,cx,cy) === undefined ? null : 'ACTION6:'+keyOf(cx,cy);
}
function choose(bank, board, tested) {
  const rows=board.frame, allowed=bank.filter(r => r.witnesses.size >= 2 && board.availableActionIds.includes(r.id));
  let best, rank=-1;
  for (const a of allowed) for (let y=0;y<rows.length;y++) for (let x=0;x<rows[y].length;x++) {
    if (!ready(rows,a,x,y)) continue;
    const ca=command(a,x,y,rows);
    if (!ca) continue;
    const next=rows.map(row => [...row]);
    for (const [dx,dy,,v] of a.changes) next[y+dy][x+dx]=v;
    for (const b of allowed) {
      const tried=new Set();
      for (const [ax,ay,,supplied] of a.changes) for (const [bx,by,required] of b.changes) {
        if (supplied !== required) continue;
        const tx=x+ax-bx, ty=y+ay-by, site=keyOf(tx,ty);
        if (tried.has(site) || b.witnesses.has(site)) continue;
        tried.add(site);
        if (!ready(next,b,tx,ty)) continue;
        const cb=command(b,tx,ty,rows);
        if (!cb || cb===ca) continue;
        const signature=JSON.stringify([ca,cb,x,y,tx,ty,a.changes,b.changes]);
        if (tested.has(signature)) continue;
        const value=(a.id!==b.id?8:0)+(!a.witnesses.has(keyOf(x,y))?4:0)+Math.min(3,b.witnesses.size);
        if (value>rank) {best={a,b,x,y,tx,ty,ca,cb,signature}; rank=value;}
      }
    }
  }
  return best;
}
function matches(rule, x, y, before, after) {
  return rule.changes.every(([dx,dy,old,v]) => at(before,x+dx,y+dy)===old && at(after,x+dx,y+dy)===v);
}
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run=JSON.parse(line), game=getGameByCode(run.code);
  if (!game || game.group==='custom_4' || game.group==='official' || run.error || run.resets || run.sourcePrefixActions || run.observedPriorLevelActions) continue;
  const rep=sourceReplay(engine,{},run), bank=new Map(), tested=new Set(), trials=[], history=[];
  let board=rep.restore(0);
  for (const [i,step] of run.steps.entries()) {
    if (i>=8 && i%4===0 && i+2<=run.cap && trials.length<2) {
      const p=choose([...bank.values()],board,tested);
      if (p) {
        tested.add(p.signature);
        const origin=hash(board);
        function arm(prefix) {
          let b=rep.restore(i);
          assert.equal(hash(b),origin);
          let first=null;
          if(prefix) {
            const n=rep.act(prefix); first=matches(p.a,p.x,p.y,b.frame,n.frame); b=n;
          }
          if(rep.win(b)||b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(p.b.id)) return {first,won:rep.win(b)};
          const n=rep.act(p.cb);
          return {first,last:matches(p.b,p.tx,p.ty,b.frame,n.frame),won:rep.win(n),end:hash(n).slice(0,16)};
        }
        const sham=history.find(k=>k!==p.ca && k!==p.cb && board.availableActionIds.includes(Number(k.split(':')[0].slice(6))));
        const witnesses=r=>[...r.witnesses].slice(0,2);
        trials.push({prefix:i,word:[p.ca,p.cb],sites:[[p.x,p.y],[p.tx,p.ty]],firstWitnesses:witnesses(p.a),secondWitnesses:witnesses(p.b),
          firstRelocated:!p.a.witnesses.has(keyOf(p.x,p.y)),whole:arm(p.ca),bare:arm(null),...(sham?{replacement:sham,control:arm(sham)}:{})});
        board=rep.restore(i);
      }
    }
    const key=op(step), next=rep.act(key); assert.equal(hash(next).slice(0,16),step.to);
    if(!rep.win(next)&&next.state==='NOT_FINISHED') observe(bank,board.frame,next.frame,step,i+1);
    history.push(key);board=next;
  }
  reports.push({code:run.code,level:run.start,repeatedAtDistinctSites:[...bank.values()].filter(r=>r.witnesses.size>=2).length,trials});
}
await writeFile(output,JSON.stringify(reports));
console.log('episodes',reports.length,'proposals',reports.reduce((n,r)=>n+r.trials.length,0));
