import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
const [sha,group,out,vendor,selection]=process.argv.slice(2);
const proof='08fa10a6b9986e7028551fbfc9d9e16eb83726b7',gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021';
assert.ok([proof,gel].includes(sha));assert.ok(['historique','développement','réserve','complément'].includes(group));
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const base=mkdtempSync(join(tmpdir(),'sk48-contact-')),engine=join(base,'moteur'),op=join(base,'operateur');
function archive(ref,dir,paths){
  mkdirSync(dir);const tar=dir+'.tar';
  execFileSync('git',['-C',repo,'archive','--output='+tar,ref,...paths]);execFileSync('tar',['-xf',tar,'-C',dir]);
}
let colors=['historique','complément'].includes(group)?[]:[9,14];
if(group==='réserve'){
  const s=readFileSync(selection),digest=createHash('sha256').update(s).digest('hex');
  assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(digest));
  colors=[8,Buffer.from(JSON.parse(s).seed,'hex')[0]&1?14:9];
}
const alt='reposition_root_before_contact',normal='revise_rooted_contact';
const mapped=id=>colors.includes(id)?colors[1-colors.indexOf(id)]:id;
try{
  const declarations='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  archive(sha,engine,['src','package.json','public/python',declarations+'laya_proto',declarations+'morphology_policy']);
  const folder='experiments/sic-agenda-offres/',revision=folder+'revision-96/';
  archive(proof,op,['package.json',folder+'frontiere-22-23/game.mjs',folder+'evaluateur-jeu.mjs',...['sonde','parcours','moteurs','operateur'].map(n=>revision+n+'.mjs')]);
  const results=[];
  const signs={historique:[false],complément:[true],développement:[false,true],réserve:[false,true]};
  for(const negative of signs[group])for(const alternate of [false,true]){
    const card={version:'sic.contact/1',couleurs:colors,pack:alternate?{strategyOrder:[alt,normal]}:{},gestes:group==='historique'?24:13};
    if(negative)card.retourModifie={geste:12,zone:[42,30,45,40],couleurs:[mapped(9),mapped(14)]};
    const input=join(base,'fiche.json'),receipt=join(base,'recu.json');writeFileSync(input,JSON.stringify(card));
    execFileSync(process.execPath,[join(op,revision,'operateur.mjs'),'--moteur','candidat','--source',pathToFileURL(engine+'/').href,
      '--fiche',input,'--pyodide',vendor,'--recu',receipt],{cwd:op,windowsHide:true,timeout:180000,maxBuffer:1024*1024});
    const result=JSON.parse(readFileSync(receipt));results.push({alternate,negative,card,result});
    console.log(JSON.stringify([group,alternate,negative,result.steps.length,result.steps.at(-1)?.ticket.command,result.stop.reason]));
  }
  writeFileSync(out,JSON.stringify({sha,op:proof,results})+'\n',{flag:'wx'});
}finally{rmSync(base,{recursive:true,force:true});}
