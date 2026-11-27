import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [sha,opening,vendor,receipt,variant]=process.argv.slice(2);
export const candidate='c0b9f4027f1df257d7b8c96f5656f9dbb83661f0',freeze='d0e7527ca8033bd805a6d7a8bb021eff62e87021';
assert.ok([freeze,candidate].includes(sha) && ['catalogue','curieux'].includes(opening));
if(variant)assert.ok(sha===candidate && opening==='catalogue' && variant==='retrait');
const workspace=mkdtempSync(join(tmpdir(),'jeu-dico-')),root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const git=(...args)=>execFileSync('git',['-C',root,...args]);
try{
  const engine=join(workspace,'engine'),experiment=join(workspace,'lot');
  mkdirSync(engine);mkdirSync(experiment);
  const pack='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  const tar=join(workspace,'engine.tar');
  git('archive','--output='+tar,sha,'src','package.json','public/python',pack+'laya_proto',pack+'morphology_policy');
  execFileSync('tar',['-xf',tar,'-C',engine]);
  const upstream='experiments/sic-agenda-offres/';
  mkdirSync(join(workspace,'frontiere-22-23'));
  writeFileSync(join(workspace,'frontiere-22-23','game.mjs'),git('show',candidate+':'+upstream+'frontiere-22-23/game.mjs'));
  writeFileSync(join(experiment,'parcours.mjs'),git('show',candidate+':'+upstream+'dico-87/parcours.mjs'));
  copyFileSync(new URL('./sonde.mjs',import.meta.url),join(experiment,'sonde.mjs'));
  const args=[join(experiment,'parcours.mjs'),opening,vendor,pathToFileURL(engine+'/').href,...(variant?['autre-optimum']:[])];
  const raw=execFileSync(process.execPath,args,{cwd:workspace,windowsHide:true,maxBuffer:8*1024*1024});
  const data=JSON.parse(raw);
  writeFileSync(receipt,JSON.stringify({sha,variant:variant??null,...data})+'\n',{flag:'wx'});
  const d=data.rows[3];console.log(JSON.stringify({opening,variant,level:d.level,propriétaire:d.family,stratégie:d.strategy,point:d.ticket.data,
    retour:d.feedback?.event?.label??null,restants:d.feedback?.retained?.length}));
}finally{rmSync(workspace,{recursive:true,force:true});}
