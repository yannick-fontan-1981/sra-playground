import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';

const [vendor]=process.argv.slice(2),freeze='d0e7527ca8033bd805a6d7a8bb021eff62e87021';
const fixture=JSON.parse(gunzipSync(execFileSync('git',['show','0540f124:tests/fixtures/sic-point-contrasts-public.json.gz'])));
const loader=execFileSync('git',['show','02032a3d:experiments/sic-agenda-offres/frontiere-22-23/game.mjs']);
const {loadGame}=await import('data:text/javascript;base64,'+loader.toString('base64'));
const workspace=mkdtempSync(join(tmpdir(),'points-jeux-'));
try{
  const tree=join(workspace,'jeu'),tar=join(workspace,'jeu.tar');mkdirSync(tree);
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  execFileSync('git',['-C',repo,'archive','--output='+tar,freeze,'src','package.json','public/python']);
  execFileSync('tar',['-xf',tar,'-C',tree]);
  const root=pathToFileURL(tree+'/'),{toV6PublicObservation}=await import(new URL('src/runtime/v6-agent-protocol.ts',root));
  for(const [name,caseData] of Object.entries(fixture)){
    const game=await loadGame(name,vendor,root),n=caseData.commands.length;
    let board=game.initial;
    for(let i=0;i<=n;i++){
      const observed=toV6PublicObservation({...board,gameCode:board.code??board.gameCode},i);
      // Éviter l'affichage d'une image entière sur une divergence.
      const recorded=caseData.observations[i];
      const extra=Object.keys(observed).filter(k=>!Object.hasOwn(recorded,k));
      const different=Object.keys(recorded).filter(k=>JSON.stringify(observed[k])!==JSON.stringify(recorded[k]));
      assert.deepEqual(different,[],name+' observation '+i);
      assert.deepEqual(extra,['palette'],name+' projection du jeu '+i);
      if(i<n)board=await game.step(caseData.commands[i].id,caseData.commands[i].data);
    }
    console.log(name+' : '+(n+1)+' projections de la fixture identiques, palette supplémentaire dans le jeu, '+n+' commandes exécutées.');
  }
}finally{rmSync(workspace,{recursive:true,force:true});}
