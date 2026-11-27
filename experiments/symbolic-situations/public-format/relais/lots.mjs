import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { development } from '../operator/schedule.mjs';
import { publicCase } from '../reductions/cases.mjs';
import { situations } from '../accuses/situations.mjs';

export function crossed() {
  const base=situations().find(c=>c.id==='B5');
  base.message.sources[3]='La commande indexer P renvoie exactement « indexé ». Elle est disponible si P est non indexé et indexe P.';
  return [{...base,id:'X1'}, {...base,id:'X2',negative:true,substitution:base.other}];
}
export async function groups(historical) {
  const lots={reductions:['A','B','C'].map(publicCase),developpement:development()};
  if (historical) {
    const old=await import('../operator/reserved.mjs');
    lots.anciens=old.reserved();
    const third=await import('../operator/private/structure-v1/verify.mjs');
    lots.structure=third.cases();
    const gate=JSON.parse(readFileSync(new URL('../operator/private/structure-v1/gate.json',import.meta.url)));
    const payload=JSON.stringify(lots.structure.map(c=>c.message));
    assert.equal(createHash('sha256').update(payload).digest('hex'),gate.sha256);
    const {checks}=third.verify(lots.structure);
    assert.equal(checks.edges,288);
  }
  return lots;
}
