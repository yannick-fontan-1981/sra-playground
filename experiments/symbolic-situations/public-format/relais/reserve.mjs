import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync,openSync,readFileSync,writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { consumer } from '../operator/frozen.mjs';
import { measure } from '../operator/measure.mjs';
import { translate } from './traduire.mjs';

const {values:v}=parseArgs({options:{sha:{type:'string'},depot:{type:'string'},entree:{type:'string'},dep:{type:'string',multiple:true}}});
if(!v.sha || !v.depot || !v.entree) throw Error('Un montage Git figé du candidat final est requis');
const solver=consumer(v);
const dir='../operator/private/reduction-reserve-v1/';
const {cases,manifests}=await import(dir+'construire.mjs');
const rows=cases(), originals=manifests(rows);
const bytes=JSON.stringify(originals)+'\n';
assert.equal(bytes,readFileSync(new URL(dir+'manifest.json',import.meta.url),'utf8'));
const digest=createHash('sha256').update(bytes).digest('hex');
assert.equal(digest,'105658d2693f9d66d03c9460b3d447b829822d3138d8af661fe5e03a389836bd');
const submitted=rows.map(c=>({...c,message:translate(c.message)}));
const output=new URL(dir+'qual-v11-'+v.sha+'.json',import.meta.url);
const fd=openSync(output,'wx');
try {
  writeFileSync(fd,JSON.stringify({ouverture:v.sha,engagement:digest})+'\n');
} finally {closeSync(fd);}
const report=await measure(submitted,solver);
const matches=report.departs.map(row=>{
  const old=originals.find(c=>c.id===row.fiche);
  return row.statut==='succes' && row.tours.every(t=>t.executee) &&
    JSON.stringify(row.tours.map(t=>[t.action,t.retour]))===JSON.stringify(old.trace[row.mondeOperateur-1]);
});
const accepted=matches.filter(Boolean).length;
const packet=JSON.stringify({sha:v.sha,entry:solver.program,blobs:solver.hashes,runtime:process.version,
  engagement:digest,accepted,matches,...report},null,2)+'\n';
writeFileSync(output,packet);
console.log(JSON.stringify({sha:v.sha,bilan:report.bilan,politiquesConformes:accepted,
  empreinte:createHash('sha256').update(packet).digest('hex')}));
