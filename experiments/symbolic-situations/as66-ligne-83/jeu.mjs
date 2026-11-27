import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
const [vendor]=process.argv.slice(2),dir=mkdtempSync(join(tmpdir(),'as66-jeu-'));
try{
  const gameTar=join(dir,'jeu.tar');
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  execFileSync('git',['-C',repo,'archive','--output='+gameTar,'d0e7527c','src','package.json','public/python']);
  execFileSync('tar',['-xf',gameTar,'-C',dir]);
  const fixture=JSON.parse(gunzipSync(execFileSync('git',['show','1aaafe36:tests/fixtures/sic-cavity-direction-as66-public.json.gz'])));
  const loader=execFileSync('git',['show','02032a3d:experiments/sic-agenda-offres/frontiere-22-23/game.mjs']);
  const {loadGame}=await import('data:text/javascript;base64,'+loader.toString('base64'));
  const root=pathToFileURL(dir+'/'),{toV6PublicObservation}=await import(new URL('src/runtime/v6-agent-protocol.ts',root));
  for(const other of [false,true]){
    const game=await loadGame('AS66',vendor,root);
    const observations=other?[...fixture.observations.slice(0,6),...fixture.alternateReturns]:fixture.observations;
    let board=game.initial;
    for(let i=0;i<observations.length;i++){
      const {palette,...actual}=toV6PublicObservation({...board,gameCode:board.code??board.gameCode},i);
      assert.deepEqual(Object.keys(actual).sort(),Object.keys(observations[i]).sort());
      for(const k of Object.keys(actual))assert.ok(JSON.stringify(actual[k])===JSON.stringify(observations[i][k]),'observation '+i+' champ '+k);
      if(i+1<observations.length)board=await game.step(other&&i>=5?[4,2][i-5]:fixture.commands[i].id);
    }
    console.log((other?'alternatif':'historique')+' '+observations.length+'/'+observations.length+' observations, images intermédiaires incluses.');
  }
}finally{rmSync(dir,{recursive:true,force:true});}
