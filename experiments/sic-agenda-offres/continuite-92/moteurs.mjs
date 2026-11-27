import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { root } from './jouer.mjs';
export const refs={historique:'8ce7ee3563fa1d5eca1639c6ad03975cfc962460',gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',
  ligne91:'14db9cd82a345752030531e9db37fb7c0ea6df45'};
export function run(cmd,args) {
  const r=spawnSync(cmd,args,{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:4*1024*1024});
  if(r.error) throw r.error;
  if(r.status!==0) throw Error((r.stderr+'\n'+r.stdout).split(/\r?\n/).filter(line=>line.length<500).slice(-18).join('\n'));
  return r.stdout;
}
export async function withEngine(name,work) {
  if(!Object.hasOwn(refs,name)) throw Error('Révision inconnue');
  const temp=await mkdtemp(join(tmpdir(),'sic-92-code-')),tar=join(temp,'source.tar');
  const src='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  try {
    run('git',['archive','--format=tar','--output',tar,refs[name],'src','package.json','public/python',src+'laya_proto',src+'morphology_policy']);
    run('tar',['-xf',tar,'-C',temp]);
    return await work(pathToFileURL(temp+sep).href);
  } finally {await rm(temp,{recursive:true,force:true});}
}
