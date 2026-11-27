import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {capture} from '../ls19-ligne-90/fixture.mjs';
import {game as controlled} from '../ls19-ligne-91/situations.mjs';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';
const [sha,group,out,vendor,selection]=process.argv.slice(2),ls=capture('ls19');
const sets={jeu:['nominal','sans-vue'],historique:['déjà-essayée','épuisement','sans-questions'],réserve:['une-restante','porteur-fixe','porteur-déplacé']};
let seed=Buffer.alloc(3);
if(group==='réserve'){
  const bytes=readFileSync(selection);assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(createHash('sha256').update(bytes).digest('hex')));
  seed=Buffer.from(JSON.parse(bytes).seed,'hex');
}
const m=mount(sha,'.'),results=[];
try{
  for(const file of ['moteur','bord'])copyFileSync(new URL(file+'.mjs',import.meta.url),join(m.program,file+'.mjs'));
  const base=pathToFileURL(m.program+'/');
  let loadGame,packet;
  if(group==='jeu'){
    const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),tar=join(m.program,'jeu.tar');
    execFileSync('git',['-C',repo,'archive','--output='+tar,sha,'public/python']);execFileSync('tar',['-xf',tar,'-C',m.program]);
    const js=execFileSync('git',['show','02032a3d:experiments/sic-agenda-offres/frontiere-22-23/game.mjs']);
    ({loadGame}=await import('data:text/javascript;base64,'+js.toString('base64')));
    ({toV6PublicObservation:packet}=await import(new URL('src/runtime/v6-agent-protocol.ts',base)));
  }
  for(const variant of sets[group]){
    const live=group==='jeu'?await loadGame('LS19',vendor,base):null;
    const spec={step:13,change:variant==='porteur-déplacé'?'partiel':'identique',mode:'original',tail:2,
      band:seed[1]&1?9:12,drift:(seed[2]&1?-1:1)*(1+(seed[2]>>1)%3)};
    const sim=live?null:controlled(spec),turns=[];
    await dialogue(['--permission','--allow-fs-read='+m.program,'--import','./bord.mjs','moteur.mjs',variant,String(seed[0])],m.program,async({send})=>{
      let board=live?.initial,obs=sim?.initial;
      const cap=live?16:15;
      for(let i=0;i<=cap;i++){
        if(live){
          const {palette,...publicFields}=packet({...board,gameCode:board.code??board.gameCode},i);obs=publicFields;
          if(i<=13){
            for(const k of Object.keys(ls.observations[i]))assert.ok(JSON.stringify(obs[k])===JSON.stringify(ls.observations[i][k]),'capture LS19 '+i+' '+k);
          }
        }
        const r=await send({observation:obs,budgets:ls.budgets});turns.push(r);
        if(i===cap||!r.ticket)break;
        const command={actionRef:r.ticket.actionRef,data:r.ticket.data??{}};
        if(i<13)assert.equal(command.actionRef,ls.commands[i].actionRef);
        if(live)board=await live.step(Number(command.actionRef.slice(6)),command.data);
        else{obs=sim.advance(i,command);assert.ok(obs,'commande simulée '+i);}
      }
    });
    results.push({variant,turns});
    const t=turns[13];console.log(JSON.stringify([variant,t.famille,t.ticket?.actionRef,t.état,t.audit?.appels.map(a=>[a.continuité,a.locales.length,a.trajets.map(s=>s.pas)])]));
  }
}finally{m.close();}
writeFileSync(out,JSON.stringify({sha,results})+'\n',{flag:'wx'});
