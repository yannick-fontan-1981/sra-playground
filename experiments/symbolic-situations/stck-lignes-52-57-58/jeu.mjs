import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {archivePublique,budgets,candidat,commande,monter,service} from './commun.mjs';
const [vendor,out,packets]=process.argv.slice(2),m=monter(candidat);
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),tar=join(m.program,'jeu.tar'),base=pathToFileURL(m.program+'/');
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidat,'public/python']);execFileSync('tar',['-xf',tar,'-C',m.program]);
  const js=execFileSync('git',['show','02032a3d:experiments/sic-agenda-offres/frontiere-22-23/game.mjs'],{encoding:'utf8'});
  const mark='return { initial: send(';assert.equal(js.split(mark).length,2);
  // Expose l’opération undo déjà fournie par le pont Python.
  const loader=js.replace(mark,"return { undo:()=>send({ type:'undo' }), initial: send(");
  const {loadGame}=await import('data:text/javascript;base64,'+Buffer.from(loader).toString('base64'));
  const {toV6PublicObservation}=await import(new URL('src/runtime/v6-agent-protocol.ts',base));
  const game=await loadGame('STCK',vendor,base);
  const packet=(b,i)=>{const {palette,...o}=toV6PublicObservation({...b,gameCode:b.code??b.gameCode},i);return o;};
  const obs=[],nominal=[],replis={};
  async function alternative(turn){
    await service(m,'retrait',turn,async({send})=>{
      const rows=[];
      for(const [i,o] of obs.entries()){
        const t=await send({observation:o,budgets});rows.push(t);
        if(i+1<turn)assert.deepEqual(t,nominal[i]);
      }
      const alt=rows.at(-1);assert.ok(alt.withdrawn);
      let suite=null;
      if(alt.ticket){
        const next=await game.step(Number(alt.ticket.actionRef.slice(6)),alt.ticket.data);
        suite=await send({observation:packet(next,turn),budgets});
        const restored=packet(game.undo(),turn-1);
        assert.ok(JSON.stringify(restored.frame)===JSON.stringify(obs.at(-1).frame));assert.equal(restored.levelsCompleted,obs.at(-1).levelsCompleted);
      }
      replis[turn]={repli:alt,suite};
    });
  }
  await service(m,'nominal',0,async({send})=>{
    let b=game.initial;
    for(let i=0;i<=16;i++){
      const o=packet(b,i),expected=archivePublique[i]?.obs;
      for(const k of Object.keys(expected??{}))assert.ok(JSON.stringify(o[k])===JSON.stringify(expected[k]),i+' '+k);
      obs.push(o);
      const t=await send({observation:o,budgets});nominal.push(t);
      if(i===16)break;
      if(archivePublique[i+1])assert.deepEqual(commande(t),archivePublique[i+1].command);
      if([1,4,12].includes(i+1))await alternative(i+1);
      b=await game.step(Number(t.ticket.actionRef.slice(6)),t.ticket.data);
    }
  });
  writeFileSync(packets,gzipSync(JSON.stringify(obs)),{flag:'wx'});
  writeFileSync(out,JSON.stringify({sha:candidat,chargements:1,nominal,replis})+'\n',{flag:'wx'});
  console.log(JSON.stringify(Object.entries(replis).map(([k,v])=>[k,v.repli.type,v.repli.ticket?.data,v.suite?.type,v.suite?.état])));
}finally{m.close();}
