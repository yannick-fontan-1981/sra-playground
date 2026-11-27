import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
const [vendor,out]=process.argv.slice(2),temp=mkdtempSync(join(tmpdir(),'sk48-pixels-'));
const packets=JSON.parse(gunzipSync(execFileSync('git',['show','08fa10a6:docs/migration/lot3d-evidence/final/sk48-rooted-session/sk48-public-trace.json.gz']))).packets;
// Lecture indépendante de la zone de jeu hors bandeau de référence.
function geometry(frame){
  const bounds=new Map();
  for(let y=6;y<55;y++)for(let x=8;x<54;x++){
    const v=frame[y][x],b=bounds.get(v)??[64,64,-1,-1,0];
    b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);b[4]++;
    bounds.set(v,b);
  }
  const pieces=[8,9,14].map(c=>{const b=bounds.get(c);assert.equal(b[4],16);return [c,b.slice(0,4)];});
  return {root:bounds.get(6).slice(0,4),tip:bounds.get(1)[2],pieces};
}
const prefix=packets.map(p=>geometry(p.packet.frame_rows)),alternatives={};
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),tar=join(temp,'jeu.tar');
  execFileSync('git',['-C',repo,'archive','--output='+tar,'d0e7527c','public/python']);execFileSync('tar',['-xf',tar,'-C',temp]);
  const js=execFileSync('git',['show','02032a3d:experiments/sic-agenda-offres/frontiere-22-23/game.mjs']);
  const {loadGame}=await import('data:text/javascript;base64,'+js.toString('base64'));
  for(const next of ['ACTION3','ACTION1']){
    const game=await loadGame('SK48',vendor,pathToFileURL(temp+'/'));let board=game.initial;
    for(const [i,p] of packets.entries()){
      if(i)board=await game.step(Number(p.command.action_ref.slice(6)));
      assert.ok(JSON.stringify(board.frame)===JSON.stringify(p.packet.frame_rows),'trame publique '+i);
    }
    alternatives[next]=geometry((await game.step(Number(next.slice(6)))).frame);
  }
  writeFileSync(out,JSON.stringify({prefix,alternatives})+'\n',{flag:'wx'});
  console.log('Deux préfixes de 13 trames reproduits ; deux retours au geste 13 mesurés sur les pixels.');
}finally{rmSync(temp,{recursive:true,force:true});}
