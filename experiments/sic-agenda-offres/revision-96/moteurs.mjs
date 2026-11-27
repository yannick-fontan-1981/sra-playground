import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { root } from './parcours.mjs';
export const historique='8ce7ee3563fa1d5eca1639c6ad03975cfc962460';
export const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021';
export function run(cmd,args) {
  const r=spawnSync(cmd,args,{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:8*1024*1024});
  if (r.error) throw r.error;
  if (r.status!==0) throw Error((r.stderr+'\n'+r.stdout).split(/\r?\n/).filter(x=>x.length<600).slice(-18).join('\n'));
  return r.stdout;
}
export async function pinned(ref,callback) {
  if (![historique,gel].includes(ref)) throw Error('Révision de référence inconnue.');
  const tmp=await mkdtemp(join(tmpdir(),'sic-contact96-')), tar=join(tmp,'code.tar');
  const dir='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  try {
    run('git',['archive','--format=tar','--output',tar,ref,'src','package.json','public/python',dir+'laya_proto',dir+'morphology_policy']);
    run('tar',['-xf',tar,'-C',tmp]);
    return await callback(pathToFileURL(tmp+sep).href);
  } finally {await rm(tmp,{recursive:true,force:true});}
}
