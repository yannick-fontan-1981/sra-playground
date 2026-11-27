import { mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const current = new URL('../../../',import.meta.url);
export const refs = {
  historique:'8ce7ee3563fa1d5eca1639c6ad03975cfc962460', gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',
  parent:'c0b9f4027f1df257d7b8c96f5656f9dbb83661f0', types23:'ba04161fbce03f9660e9e73c14ed2c14ef2538d7',
};
export function run(cmd,args,options={}) {
  const r=spawnSync(cmd,args,{cwd:fileURLToPath(current),encoding:'utf8',maxBuffer:16*1024*1024,...options});
  if(r.error) throw r.error;
  if(r.status!==0) throw Error((r.stderr+'\n'+r.stdout).split(/\r?\n/).filter(s=>s.length<500).slice(-22).join('\n'));
  return r.stdout;
}
export async function withEngine(name,work) {
  if (!refs[name]) throw Error('Version inconnue');
  const tmp = await mkdtemp(join(tmpdir(),'sic-opening-')), archive = join(tmp,'source.tar');
  const dir='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  const paths=['package.json','src','public/python',dir+'laya_proto',dir+'morphology_policy'];
  try {
    if(name==='types23') {
      paths.push('tsconfig.json', ...run('git',['ls-tree','--name-only','-d',refs[name]+':experiments'])
        .trim().split(/\r?\n/).filter(s=>s.startsWith('sinking-star-')).map(s=>'experiments/'+s+'/src')
        .filter(s=>run('git',['ls-tree','-d',refs[name],s]).trim()));
    }
    run('git',['archive','--format=tar','--output',archive,refs[name],...paths]);
    run('tar',['-xf',archive,'-C',tmp]);
    return await work(pathToFileURL(tmp+sep).href);
  } finally {await rm(tmp,{recursive:true,force:true});}
}
