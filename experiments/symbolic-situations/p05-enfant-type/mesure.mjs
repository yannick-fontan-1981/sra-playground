import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';

const [assets,receipt,destination]=process.argv.slice(2);
const {runs}=JSON.parse(readFileSync(receipt));
const trace=runs.find(r=>r.arm==='nominal').rows.slice(0,5);
const game=await sourceBackend(assets);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

function parts(rows,color){
  const done=new Set(),found=[];
  for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++){
    if(rows[y][x]!==color||done.has(x+','+y))continue;
    const cells=[[x,y]];
    done.add(x+','+y);
    for(let i=0;i<cells.length;i++){
      const [a,b]=cells[i];
      for(const [u,v] of [[a+1,b],[a-1,b],[a,b+1],[a,b-1]]){
        const key=u+','+v;
        if(rows[v]?.[u]!==color||done.has(key))continue;
        done.add(key);
        cells.push([u,v]);
      }
    }
    const [left,top]=[Math.min(...cells.map(([u])=>u)),Math.min(...cells.map(([,v])=>v))];
    found.push({origin:[left,top],mask:cells.map(([u,v])=>(u-left)+','+(v-top)).sort()});
  }
  return found;
}
let board=game.dispatch({type:'load',code:'G50T',level:1}),before;
for(const t of trace){
  before=board;
  board=game.dispatch({type:'action',actionId:Number(t.shot.command.slice(6))});
  const obs=toV6PublicObservation({...board,gameCode:board.gameCode??board.code},t.i);
  assert.equal(digest(obs),t.actual);
}
const t5=trace[4], [x,y]=t5.shot.child.subject.start;
const color=before.frame[y][x];
const origins=parts(before.frame,color).filter(p=>p.origin[0]===x&&p.origin[1]===y);
assert.equal(origins.length,1);
const [origin]=origins;
const aliases=parts(board.frame,color).filter(p=>JSON.stringify(p.mask)===JSON.stringify(origin.mask));
assert.equal(aliases.length,1);
const dest=aliases[0].origin;
const out={position:origin.origin,positionRetour:dest,vecteur:[dest[0]-x,dest[1]-y],pixels:origin.mask.length,
  retour:t5.actual,gestes:5};
assert.deepEqual(out.vecteur,[6,0]);
writeFileSync(destination,JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(out));
