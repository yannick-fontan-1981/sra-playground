import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,sep } from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { root } from './parcours.mjs';
export const versions={historique:'8ce7ee3563fa1d5eca1639c6ad03975cfc962460',gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021'};
export const git=(...args)=>execFileSync('git',args,{cwd:fileURLToPath(root),encoding:'utf8'}).trim();
export async function withEngine(name,fn) {
  if(name==='candidat') return fn(root);
  if(!Object.hasOwn(versions,name)) throw Error('Moteur inconnu');
  const tmp=await mkdtemp(join(tmpdir(),'sic-onde-')), tar=join(tmp,'source.tar');
  const base='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  try {
    git('archive','--format=tar','--output',tar,versions[name],'src','package.json','public/python',base+'laya_proto',base+'morphology_policy');
    execFileSync('tar',['-xf',tar,'-C',tmp]);
    return await fn(pathToFileURL(tmp+sep).href);
  } finally {await rm(tmp,{recursive:true,force:true});}
}
