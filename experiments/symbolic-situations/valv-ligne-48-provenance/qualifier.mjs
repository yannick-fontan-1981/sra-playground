import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {archivePublique,budgets,commande,monter,service} from '../valv-lignes-44-47-48/commun.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';

const [sha,vendor,out,selection]=process.argv.slice(2);
assert.ok(['699ac89e70be0e3cd9bceafa16689552576310a0','495ea14890c1d0cd69de356d40a3b243e0b86f6d'].includes(sha));
const cases=[['nominal','nominal',0],['publique','altérée',8],['absence','absente',0],['lié','lié',0]];
const hash=x=>createHash('sha256').update(x).digest('hex');
if(selection){
  const bytes=readFileSync(selection);
  assert.ok(readFileSync(new URL('../valv-lignes-44-47-48/CONTRAT.md',import.meta.url),'utf8').includes(hash(bytes)));
  cases.push(['réserve','altérée',1+Buffer.from(JSON.parse(bytes).seed,'hex')[1]%7]);
}
const m=monter(sha);
try{
  const base=pathToFileURL(m.program+'/'),tar=join(m.program,'jeu.tar');
  const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  execFileSync('git',['-C',root,'archive','--output='+tar,sha,'public/python']);execFileSync('tar',['-xf',tar,'-C',m.program]);
  copyFileSync(new URL('lie.mjs',import.meta.url),join(m.program,'lie.mjs'));
  const js=execFileSync('git',['show','02032a3d:experiments/sic-agenda-offres/frontiere-22-23/game.mjs'],{encoding:'utf8'});
  const mark='return { initial: send(';assert.equal(js.split(mark).length,2);
  const loader=js.replace(mark,"return { undo:()=>send({ type:'undo' }), initial: send(");
  const {loadGame}=await import('data:text/javascript;base64,'+Buffer.from(loader).toString('base64'));
  const {toV6PublicObservation}=await import(new URL('src/runtime/v6-agent-protocol.ts',base));
  const game=await loadGame('VALV',vendor,base);
  const packet=(b,i)=>{const {palette,...p}=toV6PublicObservation({...b,gameCode:b.code??b.gameCode},i);return p;};
  const observations=[packet(game.initial,0)],results={};
  const apply=async t=>game.step(Number(t.ticket.actionRef.slice(6)),t.ticket.data);
  let prefix;
  for(const [name,mode,param] of cases){
    const run=fn=>mode==='lié'?dialogue(['--permission','--allow-fs-read='+m.program,'lie.mjs',mode,'0'],m.program,fn):service(m,mode,param,fn);
    await run(async({send})=>{
      const turns=[],physical=[];
      const cap=name==='nominal'?16:13;
      let b=null;
      for(let i=0;i<=cap;i++){
        const o=i<=10 && observations[i]?observations[i]:packet(b,i);
        if(i<=10 || name==='nominal'){
          const archived=archivePublique[i].obs;
          for(const k of Object.keys(archived))assert.ok(JSON.stringify(o[k])===JSON.stringify(archived[k]),'archive : '+i+' '+k);
        }
        if(i<=10 && !observations[i])observations[i]=o;
        const t=await send({observation:o,budgets});turns.push(t);
        physical.push({image:hash(JSON.stringify(o.frame)),animation:hash(JSON.stringify(o.frames)),niveau:o.level,réussis:o.levelsCompleted});
        if(i===cap || !t.ticket)break;
        if(i<10 || name==='nominal')assert.deepEqual(commande(t),archivePublique[i+1].command);
        if(name==='nominal'||i>=10)b=await apply(t);
      }
      if(name==='nominal')prefix=turns.slice(0,10);
      for(let i=0;i<10;i++){
        const {récepteur,...t}=turns[i];
        assert.deepEqual(t,prefix[i]);
      }
      for(let i=turns.length-2;i>=10;i--){
        const restored=packet(game.undo(),i);
        assert.equal(hash(JSON.stringify(restored.frame)),physical[i].image);
        assert.equal(restored.levelsCompleted,physical[i].réussis);
      }
      results[name]={turns,physical};
      console.log(JSON.stringify([name,...turns.slice(10,14).map(t=>[t.type,t.point,t.état])]));
    });
  }
  writeFileSync(out,JSON.stringify({sha,chargements:1,results})+'\n',{flag:'wx'});
}finally{m.close();}
