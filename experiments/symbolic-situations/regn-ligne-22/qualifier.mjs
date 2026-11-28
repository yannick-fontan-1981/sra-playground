import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,vendor,out]=process.argv.slice(2);
const proof='626afb83bcc904c6be987fae08fae01b7bd8a94b',gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',catalogue='8ce7ee3563fa1d5eca1639c6ad03975cfc962460';
const fixed='be816a3f09e7b36d9393aaead8d835d9dc3850c5';
assert.ok([proof,fixed,gel,catalogue].includes(sha));const m=mount(sha,'.');
const transport=sha===catalogue?mount(proof,'.'):m;
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),head='experiments/sic-agenda-offres/';
  for(const [rev,files] of [[sha,['public/python']],[sha===fixed?fixed:proof,[head+'regn-22',head+'frontiere-22-23',head+'evaluateur-jeu.mjs',head+'moteur-reference.mjs',head+'agenda.mjs']]]){
    const tar=join(m.program,'exp.tar');execFileSync('git',['-C',repo,'archive','--output='+tar,rev,...files]);
    execFileSync('tar',['-xf',tar,'-C',files[0]==='public/python'?m.program:transport.program]);
  }
  const engine=pathToFileURL(m.program+'/'),base=pathToFileURL(transport.program+'/');let run;
  if(sha===catalogue){
    const {play}=await import(new URL(head+'regn-22/operateur.mjs',base));
    run=async(_name,card,vendor)=>({...await play(engine.href,card,vendor),checks:[]});
  }else{
    copyFileSync(new URL('parcours.mjs',import.meta.url),join(m.program,'parcours.mjs'));
    ({run}=await import(new URL('parcours.mjs',base)));
  }
  const groups={budget:[['borne16',16,16],['lecture16',16,null],['borne17',17,17]],preuve:[['question',17,17],['arête',17,17]],substitution:[['remplacement',17,17],['retrait',17,17]],autre:[['autre-question',17,17]],catalogue:[['borne16',16,16]],appels:[['arrêt-15',15,16],['reprise-16',16,16]]};
  assert.ok(groups[group]);const results={};
  for(const [name,gestes,budget] of groups[group]){
    const card={version:'sic.regn.frontiere/1',gestes,budget,horloge:'fixe'};
    results[name]={card,...await run(name,card,vendor)};console.log(JSON.stringify([name,results[name].steps.length,results[name].stop.kind]));
  }
  writeFileSync(out,JSON.stringify({sha,results})+'\n',{flag:'wx'});
}finally{if(transport!==m)transport.close();m.close();}
