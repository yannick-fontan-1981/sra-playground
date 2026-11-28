import { execFileSync } from 'node:child_process';
import { mkdtemp, copyFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const source='1aaafe36177ab73edf63c18f1a0950bd790a9c6c';
const dir=await mkdtemp(join(tmpdir(),'as66-83-'));
try {
  const archive=join(dir,'fixture.tar');
  execFileSync('git',['archive','--format=tar','--output',archive,source,'tests/sic-cavity-direction-as66.test.ts',
    'tests/fixtures/sic-cavity-direction-as66-public.json.gz','tests/fixtures/v6-sliding-cavity-reference.json.gz'],{cwd:root});
  execFileSync('tar',['-xf',archive,'-C',dir]);
  for(const folder of ['src','scripts','reference'])await symlink(join(root,folder),join(dir,folder),'junction');
  await copyFile(join(root,'package.json'),join(dir,'package.json'));
  execFileSync(process.execPath,['--test',join(dir,'tests','sic-cavity-direction-as66.test.ts')],{stdio:'inherit'});
} finally {await rm(dir,{recursive:true,force:true});}

