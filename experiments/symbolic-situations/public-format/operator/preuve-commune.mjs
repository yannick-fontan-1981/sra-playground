import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCard, publicCard } from '../../cards.mjs';
import { enumerate } from '../../enumerate.mjs';
import { development, makeCase } from './schedule.mjs';
import { measure } from './measure.mjs';
import { frozen } from '../reductions/consumer.mjs';

const sha = 'bd61ff40b0a9fbc243787ea269b4e89225206dd8';
const solver = frozen(sha, process.argv[2]);
const replay = process.argv[3];
assert.ok(!replay || replay === '--temoins-operateur');
const suite = replay ? (await import('./reserved.mjs')).reserved() : development();
const known = await measure(suite, solver);
assert.equal(known.bilan.issues.succes, 18);
assert.equal(known.bilan.actions.refusees, 0);
console.log(JSON.stringify({sha, partition: replay ? 'témoins opérateur' : 'développement', familles:known.familles}));

const original = readFileSync(new URL('../../exemple/public/9fd1072013fd810d513c.md', import.meta.url), 'utf8');
const model = parseCard(original);
assert.equal(model.wiring.X6e9ba2, 'Xa16dcd');
const same = {...model, wiring:{...model.wiring, X6e9ba2:'X03a3e1'}};
for (const [id, m, expected] of [['commun', same, 3], ['opposé', model, 4]]) {
  const c = makeCase('dial', id, publicCard(m));
  const oracle = enumerate(m);
  assert.equal(oracle.minimum, expected);
  const result = await measure([c], solver);
  assert.equal(result.bilan.issues.succes, 2);
  const pair = Object.fromEntries(result.departs.map((r,i) => [c.worlds[i].dial, r.tours.map(t=>t.action)]));
  assert.ok(oracle.optimal.some(policy=>Object.keys(pair).every(k=>JSON.stringify(policy[k])===JSON.stringify(pair[k]))));
  assert.equal(result.bilan.lectures.retours, id === 'commun' ? 0 : 2);
  console.log(JSON.stringify({variation:id, minimum:expected, bilan:result.bilan, paire:result.paires[0]}));
}
