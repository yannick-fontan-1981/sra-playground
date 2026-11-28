import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {bras,premierÉcart,résumer} from './preuve.mjs';

const [sha,assets,output]=process.argv.slice(2);
assert.match(sha??'',/^[0-9a-f]{40}$/,'SHA complet requis');
assert.ok(assets&&output,'Racine du jeu et destination requises');
const reference=JSON.parse(readFileSync(new URL('references.json',import.meta.url),'utf8'));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['-C',git,'rev-parse',sha+'^{commit}'],{encoding:'utf8'}).trim(),sha);
const work=mount(sha,'.');
try{
  const script='scripts/sic-study-source-games.mjs',tar=join(work.program,'jeu.tar');
  execFileSync('git',['-C',git,'archive','--output='+tar,reference.candidat,script]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  const local=join(work.program,'parcours.mjs');
  copyFileSync(new URL('../seri-ligne-93-temoins/parcours.mjs',import.meta.url),local);
  const {run}=await import(pathToFileURL(local));
  const result=résumer(await run('intégration',assets));
  const cas=Object.fromEntries(bras.map(arm=>{
    const écartCorrection=premierÉcart(result[arm],reference.correction[arm],[arm]);
    const écartGel=premierÉcart(result[arm],reference.gelObservé[arm],[arm]);
    return [arm,{identiqueAuCorrectif:écartCorrection===null,écartCorrection,écartGel,
      mesure:result[arm].portée}];
  }));
  const conforme=bras.every(arm=>cas[arm].identiqueAuCorrectif);
  writeFileSync(output,JSON.stringify({sha,référenceOpérateur:reference.reçu,conforme,cas},null,2)+'\n',{flag:'wx'});
  for(const arm of bras)console.log(arm,cas[arm].identiqueAuCorrectif?'conforme':cas[arm].écartCorrection.champ);
  if(!conforme)process.exitCode=1;
}finally{work.close();}
