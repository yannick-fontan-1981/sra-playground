import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {verifyCheckout,localDecision,localReturn,candidate} from './service-commun.mjs';
import {dialogue} from './dialogue.mjs';
import {development,parameters,freeze} from './situations.mjs';

const [mode,checkout,receipt,selection]=process.argv.slice(2);
assert.ok(['gel','candidat'].includes(mode));
const {lot}=verifyCheckout(checkout);
const temp=mkdtempSync(join(tmpdir(),'essai-public-')),out={};
async function play(name,start,steps,stale=false){
  const file=join(temp,name+'.json');
  writeFileSync(file,JSON.stringify({version:'sic.essai-local/1',depart:start,historique:[]}));
  const cli=['operateur','--moteur',mode,'--fiche',file,'--ordre','least_tried'];
  const inputs=[],outputs=[];
  out[name]=await dialogue([join(lot,'operateur.mjs'),...cli.slice(1)],lot,async({send,receive})=>{
    const initial=await receive(),decisions=[initial.decision],returns=[],refus=[];
    outputs.push(initial);
    async function deliver(message){
      inputs.push(message);const answer=await send(message);outputs.push(answer);return answer;
    }
    for(const [i,after] of steps.entries()){
      const current=decisions.at(-1);
      if(!current.ticket)break;
      if(stale && i<2)refus.push(await deliver({ticket:i===0?'etranger':decisions[0].ticket.id,retour:after}));
      const next=await deliver({ticket:current.ticket.id,retour:after});
      returns.push(next.acquisition);
      decisions.push(next.decision);
    }
    if(!inputs.length)refus.push(await deliver({ticket:'etranger',retour:start}));
    return {decisions,returns,refus};
  });
  // Le pipeline PowerShell reçoit un préfixe fini. Le dialogue Node a déjà lié chaque retour au ticket.
  if(process.platform==='win32'){
    const prefix=join(temp,'prefix.jsonl');
    writeFileSync(prefix,inputs.map(x=>JSON.stringify(x)).join('\n')+'\n');
    const script='$OutputEncoding=[Text.UTF8Encoding]::new($false); [Console]::OutputEncoding=$OutputEncoding; '+
      'Get-Content -Encoding UTF8 -LiteralPath $env:SRA_PREFIX | & ./lancer.ps1 operateur --moteur $env:SRA_MODE --fiche $env:SRA_CARD --ordre least_tried; exit $LASTEXITCODE';
    const replay=spawnSync('pwsh.exe',['-NoProfile','-Command',script],{cwd:lot,encoding:'utf8',windowsHide:true,
      env:{...process.env,SRA_PREFIX:prefix,SRA_MODE:mode,SRA_CARD:file},timeout:160000,maxBuffer:4*1024*1024});
    if(replay.status!==0)throw Error('Échec du rejeu PowerShell, code '+replay.status+' '+(selection?'':replay.stderr.slice(0,700)));
    assert.deepEqual(replay.stdout.trim().split(/\r?\n/).map(x=>JSON.parse(x)),outputs);
  }
}
let params=development;
if(selection){
  const bytes=readFileSync(selection);
  assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(createHash('sha256').update(bytes).digest('hex')));
  params=parameters(JSON.parse(bytes).seed);
}
const [u,v]=params.ids,A={fond:params.colors[0],commandes:[u,v]},B={fond:params.colors[1],commandes:[u,v]};
const test={};
try{
  await play('cycle',A,[A,B,B],true);
  await play('permutation',{...A,commandes:[v,u]},[]);
  const {decisions:d,returns:r,refus}=out.cycle;
  test.choix=d.slice(0,3).map(x=>x.ticket?.actionRef).join(',')===[u,v,u].map(x=>'ACTION'+x).join(',');
  test.local=r.length===3 && r.every((x,i)=>localDecision(d[i]) && localReturn(d[i],x));
  test.reprise=d.length>=3 && d[0].pre?.index===d[1].pre?.index && d[1].pre?.index!==d[2].pre?.index &&
    d[0].question?.id!==d[2].question?.id && d[1].pre.domain.find(t=>t.command.action_ref==='ACTION'+u)?.tried.includes(r[0].transition.acquisition);
  test.permutation=localDecision(out.permutation.decisions[0]) && out.permutation.decisions[0].question.id===d[0].question?.id;
  test.ticketsPérimés=refus.length===2 && refus.every(x=>x.erreur==='ticket_perime') && r.length===3;
  if(!selection){
    const a={fond:0,commandes:[4]},b={fond:1,commandes:[1,2,3]};
    await play('acces',b,[a,b,a,b,b]);
    const {decisions,returns}=out.acces,access=decisions[3],resume=decisions[4],stop=decisions[5];
    test.temoin22=access?.family==='observed_frontier' && access.strategy==='reach_open_input' && access.kind==='access' &&
      access.ticket?.actionRef==='ACTION4' && access.ticket.actionIndex===0 && access.pre?.path[0].witnesses.includes(returns[1].transition.acquisition) &&
      returns[3]?.matched===true && resume?.ticket.actionRef==='ACTION3' && resume.ticket.actionIndex===1 &&
      resume.question.id===access.question.id && returns[4].need?.status==='observed';
    test.sansTrajet=stop?.ticket===null && stop.pre?.routeStatus==='exhausted' && stop.need?.status==='open';
  }
}finally{rmSync(temp,{recursive:true,force:true});}
writeFileSync(resolve(receipt),JSON.stringify({sha:mode==='gel'?freeze:candidate,out,test})+'\n',{flag:'wx'});
console.log(JSON.stringify({mode,réserve:!!selection,test}));
process.exitCode=Number(Object.values(test).some(v=>!v));
