import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mount } from '../ls19-ligne-90/montage.mjs';

const [sha, group, gameRoot, output, privateFile] = process.argv.slice(2);
const base = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021';
const candidate = 'f005be662b0e4b556a0cea3d246381cd98eec7ae';
assert.ok([base,candidate].includes(sha));
const mounted = mount(sha, '.');
try {
  const repo = execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const archive = join(mounted.program,'transport.tar');
  execFileSync('git',['-C',repo,'archive','--output='+archive,candidate,
    'scripts/sic-study-source-games.mjs','tests/sic-life-three-lines.test.ts','tests/fixtures/sic-life-alternate-returns.json.gz',
    'docs/migration/native-campaigns-v50/life-public-trace-final.json.gz']);
  execFileSync('tar',['-xf',archive,'-C',mounted.program]);
  if (group === 'auteur') {
    const args = ['--test'];
    if (sha === base) args.push('--test-name-pattern=^LIFE|^2 |^68 |^69 ');
    args.push('tests/sic-life-three-lines.test.ts');
    const report = execFileSync(process.execPath,args,{cwd:mounted.program,encoding:'utf8',
      env:{...process.env,SIC_LIFE_GAME_ROOT:gameRoot,SIC_LIFE_ENGINE_ROOT:mounted.program}});
    assert.match(report, /fail 0/);
    writeFileSync(output, report, { flag:'wx' });
  } else {
    let seed;
    if (['réserve','substitution'].includes(group)) {
      const bytes = readFileSync(privateFile);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),'12c971cedfa65bbf7518cb41c7a4131f1c8e1b8c1ee43fcc6003f3bfec8a28bd');
      seed = Buffer.from(JSON.parse(bytes).seed,'hex');
    }
    copyFileSync(new URL('parcours.mjs',import.meta.url),join(mounted.program,'parcours.mjs'));
    const { run } = await import(pathToFileURL(join(mounted.program,'parcours.mjs')));
    writeFileSync(output, JSON.stringify({sha,group,results:await run(group,gameRoot,seed)})+'\n',{flag:'wx'});
  }
} finally {
  mounted.close();
}
