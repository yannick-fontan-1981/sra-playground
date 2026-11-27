import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { consumer } from '../operator/frozen.mjs';
import { measure } from '../operator/measure.mjs';
import { frozen } from '../reductions/consumer.mjs';
import { probe } from '../accuses/dialogue.mjs';
import { crossed, groups } from './lots.mjs';
import { translate } from './traduire.mjs';

const {values:v}=parseArgs({options:{sha:{type:'string'},depot:{type:'string'},format:{type:'string'},
  entree:{type:'string'},dep:{type:'string',multiple:true},historiques:{type:'boolean'},rapport:{type:'string'}}});
if (!v.sha || !v.depot || !['v1','v1.1'].includes(v.format) || (v.dep && !v.entree)) throw Error('SHA, dépôt, format et montage cohérent requis');
const solver=v.entree ? consumer({sha:v.sha,depot:v.depot,entree:v.entree,dep:v.dep}) : frozen(v.sha,v.depot);
const adapt=c=>v.format==='v1.1' ? {...c,message:translate(c.message)} : c;
const controls={};
for(const [group,cases] of Object.entries(await groups(v.historiques))) controls[group]=await measure(cases.map(adapt),solver);
const x=[];
for(const c of crossed()) x.push(await probe(adapt(c),solver));
const result={sha:v.sha,format:v.format,entry:solver.program,blobs:solver.hashes,runtime:process.version,controls,x};
if(v.rapport) writeFileSync(v.rapport,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sha:v.sha,format:v.format,groupes:Object.fromEntries(Object.entries(controls).map(([name,c])=>[name,c.bilan])),
  croisements:x.map(r=>({cas:r.cas,conforme:r.conforme,issue:r.issue,suivant:r.suivant}))}));
