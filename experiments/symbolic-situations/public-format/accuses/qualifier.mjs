import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { frozen } from '../reductions/consumer.mjs';
import { publicCase } from '../reductions/cases.mjs';
import { development } from '../operator/schedule.mjs';
import { measure } from '../operator/measure.mjs';
import { verifyCases } from './evaluer.mjs';
import { probe } from './dialogue.mjs';

const [sha,depot,output,selection] = process.argv.slice(2);
assert.ok(sha && depot && (!selection || selection==='--historiques'));
const solver = frozen(sha,depot);
const probes=[];
for (const c of verifyCases()) probes.push(await probe(c,solver));
const groups=[['A',[publicCase('A')]],['C',[publicCase('C')]],['développement',development()]];
if (selection==='--historiques') {
  const older = await import('../operator/reserved.mjs');
  groups.push(['ancienne réserve des deux familles',older.reserved()]);
  const {cases} = await import('../operator/private/structure-v1/verify.mjs');
  const rows=cases();
  const {sha256} = JSON.parse(readFileSync(new URL('../operator/private/structure-v1/gate.json',import.meta.url)));
  assert.equal(createHash('sha256').update(JSON.stringify(rows.map(c=>c.message))).digest('hex'),sha256);
  groups.push(['huit témoins structurels',rows]);
}
const controles={};
for (const [name,rows] of groups) controles[name]=await measure(rows,solver);
const result={sha,runtime:process.version,fichiers:solver.hashes,probes,controles};
if (output) writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sha,probes:probes.map(r=>[r.cas,r.admission,r.livre,r.suivant,r.issue,r.conforme]),
  controles:Object.fromEntries(Object.entries(controles).map(([k,r])=>[k,r.bilan]))},null,2));
