import {execFileSync} from 'node:child_process';
import {copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';
export const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat='39e32b1f0218d53f41c27b7140c925e8e929e705';
export const budgets={targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16};
const archive=JSON.parse(gunzipSync(execFileSync('git',['show','d0e7527c:docs/migration/native-campaigns-v39/diagnostics/stck-six-level-attempt-public.json.gz'])));
export const archivePublique=archive.packets.slice(0,14).map(({packet:p,command})=>({command,obs:{frame:p.frame_rows,frames:p.frame_packet,
  availableActionIds:p.available_action_refs.map(a=>Number(a.slice(6))),state:p.state,level:p.level,levelsCompleted:p.levels_completed,stepIndex:p.step_index}}));
export function monter(sha){
  const m=mount(sha,'.');
  try{copyFileSync(new URL('moteur.mjs',import.meta.url),join(m.program,'moteur.mjs'));return m;}
  catch(e){m.close();throw e;}
}
export function service(m,mode,param,callback){
  return dialogue(['--permission','--allow-fs-read='+m.program,'moteur.mjs',mode,String(param)],m.program,callback);
}
export const commande=t=>({action_ref:t.ticket.actionRef,data:t.ticket.data??{}});
