import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {candidate,verifyCheckout} from './service-commun.mjs';
import {freeze} from './situations.mjs';
const [dir,checkout]=process.argv.slice(2);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const ts=createRequire(join(verifyCheckout(checkout).dir,'package.json'))('typescript');
const files=git('diff','--name-only',freeze,candidate,'--',':(top)src').trim().split('\n');
assert.deepEqual(files,['src/logos-engine/v6-observed-frontier.ts']);
const hash=s=>createHash('sha256').update(s).digest('hex');
const compiled={};
for(const removeComments of [false,true]){
  const emit=sha=>ts.transpileModule(git('show',sha+':'+files[0]),{compilerOptions:{target:ts.ScriptTarget.ES2022,
    module:ts.ModuleKind.ESNext,verbatimModuleSyntax:true,newLine:ts.NewLineKind.LineFeed,removeComments}}).outputText;
  const a=emit(freeze),b=emit(candidate);
  compiled[removeComments?'sansCommentaires':'avecCommentaires']={identique:a===b,gel:hash(a),candidat:hash(b)};
}
const groupes={};
for(const group of ['dev','res','G50T','REGN','dialogue-dev','dialogue-res']){
  const receipts=[freeze,candidate].map(s=>JSON.parse(readFileSync(join(dir,s.slice(0,8)+'.'+group+'.json'))));
  for(const [i,r] of receipts.entries()){
    assert.equal(r.sha,[freeze,candidate][i]);
    if(r.verdicts)assert.ok(r.verdicts.every(x=>!x.issues.length));
    if(r.test)assert.ok(Object.values(r.test).every(Boolean));
    if('ok' in r)assert.ok(r.ok && r.changes.every(Boolean));
    delete r.sha;
  }
  assert.deepEqual(receipts[0],receipts[1],group);
  groupes[group]=hash(JSON.stringify(receipts[0]));
}
assert.ok(compiled.sansCommentaires.identique);
console.log(JSON.stringify({gel:freeze,candidat:candidate,typescript:ts.version,compiled,groupes},null,2));
