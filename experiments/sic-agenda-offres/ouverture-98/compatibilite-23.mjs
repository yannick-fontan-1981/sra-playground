import assert from 'node:assert/strict';
import { symlink, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { current, refs, run, withEngine } from './versions.mjs';

export async function verifierTypes23() {
  const modules = ['src/logos-engine/v6-observed-frontier.ts','src/sic/opening-curiosity.ts'];
  const patch = run('git',['diff','--no-color','--unified=1',refs.parent,'--',...modules]);
  assert.ok(patch.includes('+      opening = selectOpeningOffer(offers);'));
  return withEngine('types23',async root => {
    const cwd = fileURLToPath(root);
    for (const flags of [['--check'],[]]) {
      run('git',['apply','--no-index','--unidiff-zero','--whitespace=error',...flags,'-'],{cwd,input:patch});
    }
    const link = join(cwd,'node_modules');
    await symlink(fileURLToPath(new URL('node_modules/',current)),link,process.platform==='win32'?'junction':'dir');
    try {
      run(process.execPath,[join(link,'typescript/bin/tsc'),'--pretty','false','--noEmit'],{cwd});
    } finally { await unlink(link); }
    return { parent:refs.types23, modules, application:true, compilation:true };
  });
}
