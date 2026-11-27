import assert from 'node:assert/strict';
import {inquire} from './experiments/sic-agenda-offres/projection-initiale/enquete.mjs';
import {trace} from './experiments/sic-agenda-offres/projection-initiale/trajet.mjs';
import {measurePiercingGoal} from './src/logos-engine/v5-piercing-plan.ts';
const m=await inquire([9,13]),winner=m.search.plans[0],path=await trace(m,winner.action_refs),last=path.at(-1);
const byPiece=new Map(last.configuration.pieces.map(p=>[p.piece_ref,p.type_ref]));
const stations=Object.fromEntries(last.contacts.map(([p,i])=>[byPiece.get(p),i]));
const symbols=m.scene.order;assert.equal(symbols.length,3);assert.equal(new Set(Object.values(stations)).size,2);
const résultats=[];
for(const first of symbols)for(const second of symbols.filter(s=>s!==first)){
  const requested=[first,second,symbols.find(s=>s!==first && s!==second)];
  const admissible=requested.every((s,i)=>!i||stations[requested[i-1]]<=stations[s]);
  const result=measurePiercingGoal({configuration:last.configuration,requested_root_ref:'current_root',requested_type_order:requested},'test_compatible_stations');
  assert.equal(result.projected_order_trial.status,admissible?'compatible_unordered':'incompatible');assert.deepEqual(result.measured_type_order,[]);
  assert.equal(result.predicted_rooted_match,false);assert.equal(result.rooted_match,false);
  résultats.push({requested,admissible,statut:result.projected_order_trial.status});
}
assert.equal(résultats.filter(r=>r.admissible).length,2);
console.log(JSON.stringify({stations,résultats}));
