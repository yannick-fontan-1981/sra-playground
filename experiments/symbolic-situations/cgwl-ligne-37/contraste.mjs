import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';
const [sha,out]=process.argv.slice(2);
const allowed=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','beb11112bc53afdb80d46b843f42d01474254126'];
assert.ok(allowed.includes(sha));
const work=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),tar=join(work.program,'preuve.tar');
  const script='scripts/native-object-binding-common-loop.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,allowed[1],script,
    'docs/migration/lot5c-evidence/recovery/common/common-plan.json',
    'tests/v6-object-binding-common.test.ts','scripts/review-observed-binding-common-replay.py']);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  const {runBindingCommon}=await import(pathToFileURL(join(work.program,script)));
  const cases={};
  for(const name of ['positive','refutation','ambiguity']){
    const r=await runBindingCommon(name);
    assert.equal(r.status,'passed',String(r.checks.failures.length));
    const modes=r.operations.filter(x=>x.method==='recordSource').map(x=>x.native.result).filter(Boolean);
    cases[name]={retours:r.returned,identity:r.finalState.held?.identity_status??null,
      own:r.finalAttention.composition.status,dernier:r.history.at(-1).selected.command,prochain:r.next.command,
      proof:modes.map(x=>({status:x.status,ambiguities:x.ambiguities?.map(a=>a.compatible_count)})),
      reception:r.finalState.events.map(e=>e.status)};
  }
  writeFileSync(out,JSON.stringify({sha,cases})+'\n',{flag:'wx'});
} finally {work.close();}
