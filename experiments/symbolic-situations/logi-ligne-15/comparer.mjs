import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';

const [dir,typescriptRoot='.']=process.argv.slice(2);
const ts=createRequire(join(resolve(typescriptRoot),'package.json'))('typescript');
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','7bf3c85a4183baf0dd535ca7c97d055bb6a0b958','48472784f1ee59b1117dddb53ef5c9fced929ec8'];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trimEnd();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const file='src/logos-engine/v6-coupled-displays.ts';
const changes=git('diff','--name-only',shas[0],shas[2],'--',':(top)src');
assert.equal(changes,file);
const source=sha=>git('show',sha+':'+file);
const output=sha=>ts.transpileModule(source(sha),{compilerOptions:{target:ts.ScriptTarget.ES2022,
  module:ts.ModuleKind.ESNext,verbatimModuleSyntax:true,newLine:ts.NewLineKind.LineFeed}}).outputText;
const trees=shas.map(sha=>git('rev-parse',sha+':src'));
assert.equal(trees[0],trees[1]);
assert.equal(output(shas[0]),output(shas[2]));
const groups=['public','reserve','rewi'];
const signatures={};
const evidence=shas.map((sha,index)=>{
  const dossier={sha,src:trees[index],reçus:{}};
  for(const group of groups){
    const bytes=readFileSync(join(dir,sha.slice(0,8)+'-'+group+'.json')),packet=JSON.parse(bytes);
    assert.equal(packet.sha,sha);
    const material=group==='rewi'?packet.turns:packet.results;
    const digest=hash(JSON.stringify(material));
    if(index===0)signatures[group]=digest;
    assert.equal(digest,signatures[group],'Reçus natifs différents, groupe '+group);
    if(group==='rewi')assert.ok(Object.values(packet.ok).every(Boolean));
    else assert.ok(packet.results.every(r=>r.ok));
    dossier.reçus[group]=hash(bytes);
  }
  return dossier;
});
console.log(JSON.stringify({typescript:ts.version,module:file,javascript:hash(output(shas[0])),
  empreintesCommunes:signatures,révisions:evidence},null,2));
