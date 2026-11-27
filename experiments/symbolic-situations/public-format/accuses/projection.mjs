import assert from 'node:assert/strict';
import { frozen, baseline } from '../reductions/consumer.mjs';
import { enumerateFinite } from '../../finite-policies.mjs';
import { publicCase } from '../reductions/cases.mjs';
import { measure } from '../operator/measure.mjs';

const sha='6191afeeafe7baac597685f2d9e5b08b241cce99';
const solver=frozen(sha,process.argv[2]), before=frozen(baseline,process.argv[2]);
const changed=Object.keys(solver.hashes).filter(k=>solver.hashes[k]!==before.hashes[k]);
assert.deepEqual(changed,['programme/experiments/sic-agenda-offres/public-v1/planifier.mjs']);
for (const id of ['A','B','C']) {
  const c=publicCase(id), oracle=enumerateFinite(c.worlds,c.dynamics);
  const r=await measure([c],solver);
  assert.equal(r.bilan.admission.admises,c.worlds.length);
  if (id==='B') {
    assert.deepEqual(r.departs[0].tours,[{action:'indexer P',retour:'indexé',executee:true}]);
    assert.equal(r.departs[0].premierEcart.detail,'accusé matériel non reconnu pour la commande demandée');
  } else {
    assert.equal(r.bilan.issues.succes,2);
    assert.ok(oracle.optimal.some(policy=>r.departs.every((row,i)=>
      JSON.stringify(row.tours.map(t=>t.action))===JSON.stringify(policy[c.worlds[i]]))));
  }
  console.log(JSON.stringify({sha,id,minimum:oracle.minimum,admissions:r.bilan.admission.admises,
    decisions:r.departs.map(row=>({actions:row.tours.map(t=>[t.action,t.retour]),issue:row.statut,ecart:row.premierEcart}))}));
}
