import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {withEngine} from './montage.mjs';
const [sha,code,mode,vendor,receipt,alt]=process.argv.slice(2);
await withEngine(sha,async({root,lab})=>{
  const stdout=execFileSync(process.execPath,[join(lab,'ouverture-98/jeu.mjs'),resolve(vendor),root,code,mode,...(alt?['autre-egalite']:[])],
    {windowsHide:true,maxBuffer:8*1024*1024});
  const rows=JSON.parse(stdout);writeFileSync(receipt,JSON.stringify({sha,rows})+'\n',{flag:'wx'});
  console.log(JSON.stringify(rows.map(r=>({niveau:r.level,p:r.ticket.data,max:r.opening?.distinctRelations,famille:r.family,complétés:r.returned.completed}))));
},!!alt);
