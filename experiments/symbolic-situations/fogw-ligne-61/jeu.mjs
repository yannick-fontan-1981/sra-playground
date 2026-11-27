import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
const [vendor]=process.argv.slice(2),temp=mkdtempSync(join(tmpdir(),'fogw-pixels-'));
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),tar=join(temp,'jeu.tar');
  execFileSync('git',['-C',repo,'archive','--output='+tar,'d0e7527c','public/python','src','package.json']);execFileSync('tar',['-xf',tar,'-C',temp]);
  const root=pathToFileURL(temp+'/'),{toV6PublicObservation}=await import(new URL('src/runtime/v6-agent-protocol.ts',root));
  const js=execFileSync('git',['show','02032a3d:experiments/sic-agenda-offres/frontiere-22-23/game.mjs']);
  const {loadGame}=await import('data:text/javascript;base64,'+js.toString('base64'));
  const fixture=JSON.parse(gunzipSync(execFileSync('git',['show','e2e5b52f:tests/fixtures/sic-reception-fogw-public.json.gz'])));
  const game=await loadGame('FOGW',vendor,root);let board=game.initial;
  for(const [i,obs] of fixture.observations.entries()){
    const {palette,...actual}=toV6PublicObservation({...board,gameCode:board.code??board.gameCode},i);
    assert.deepEqual(Object.keys(actual).sort(),Object.keys(obs).sort());
    for(const k of Object.keys(actual))assert.ok(JSON.stringify(actual[k])===JSON.stringify(obs[k]),i+' '+k);
    if(i<fixture.commands.length)board=await game.step(fixture.commands[i].id);
  }
  console.log('33/33 observations publiques, 32 commandes du jeu Python.');
}finally{rmSync(temp,{recursive:true,force:true});}
