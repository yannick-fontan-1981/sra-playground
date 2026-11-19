/** Author-only exhaustive counterfactual checks for SS09 L8.
 * Run after npm run build: node reference/author/verify-level8-necessity.mjs
 * A weaker escape goal is enough: every WIN puts both heroes on the east island.
 * Time/state limits never count as proofs and make this command fail.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {solve,replay} from '../../scripts/solver.mjs';

const designPath=new URL('../level8-design.json',import.meta.url);
const proofPath=new URL('../level8-necessity.json',import.meta.url);
const design=JSON.parse(readFileSync(designPath,'utf8'));
const proof=JSON.parse(readFileSync(proofPath,'utf8'));
const spec=design.spec;
const hash=createHash('sha256').update(JSON.stringify(spec)).digest('hex');
assert.equal(proof.mapSha256,hash,'The recorded evidence must refer to this exact grid');
assert.equal(spec.gates.length,1);
assert.deepEqual(spec.gates[0].at,{x:6,y:6});
assert.deepEqual(spec.circuits[0].buttons,[{x:4,y:12}]);
assert.equal(spec.rows.join('').split('o').length-1,1);
const witness=replay(spec,design.commands);
assert.equal(witness.state.complete,true);
assert.equal(witness.metrics.blocked,0);
assert.equal(witness.metrics.deaths,0);

const noCrate=structuredClone(spec);
noCrate.rows=noCrate.rows.map(row=>row.replaceAll('o','.'));
const closedGate=structuredClone(spec);
closedGate.gates=[];
closedGate.rows[6]=closedGate.rows[6].slice(0,6)+'#'+closedGate.rows[6].slice(7);

const variants=[
  {name:'Crate removed',spec:noCrate,goal:state=>state.heroes.every(hero=>hero.at.x>=8)},
  {name:'Ray gate held shut',spec:closedGate,goal:state=>state.heroes.some(hero=>hero.at.x>=8)},
];
for(const [index,variant] of variants.entries()){
  const result=solve(variant.spec,{maxStates:1000000,maxMs:45000,goal:variant.goal});
  console.log(JSON.stringify({name:variant.name,...result,state:undefined}));
  assert.equal(result.status,'unsolvable',variant.name+': the complete reachable queue must be exhausted');
  assert.equal(result.states,result.expanded,variant.name+': every reachable state was expanded');
  proof.checks[index]={...proof.checks[index],...result};
}
proof.reproduce='npm run build && node reference/author/verify-level8-necessity.mjs';
writeFileSync(proofPath,JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify({level:8,mapSha256:hash,checks:proof.checks.length,success:true}));
