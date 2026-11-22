import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, localEffects } from '../src/sic/paired-displacements.ts';
import { observeRequiredOpening, persistentOpeningTest } from '../src/sic/test-a-persistent-opening.ts';
import type { Scene, Reading } from '../src/sic/paired-scene.ts';

const s:Scene={grid:{pitch:3,left:0,top:0,columns:7,rows:5},floor:2,bodies:[8,9],accent:4,ground:[14,15,16,17,18,19,20],
  medium:[],goals:[19,20],doors:[{site:17,closed:'closed',controls:[15]}],origin:[14,20],other:[],features:[],initial:Array(35).fill('floor'),partialContext:true};
const before:Reading={active:0,anchor:-1,subjects:[14,20],pieces:[16],supports:[],opened:[]};
const held:Reading={...before,subjects:[15,20],opened:[17]};
test('test whether a substitute can keep a passage available to both subjects',()=>{
  const m=fresh(); m.evidence[0].pull=4;
  m.motors.ACTION3={dx:-1,dy:0,ref:'moved left'};
  assert.equal(persistentOpeningTest(s,m,held,'no causal witness',8,40),undefined);
  observeRequiredOpening(s,m,before,held,'gate appearance changed with the control');
  const f=persistentOpeningTest(s,m,held,'goal and keeper separated by this gate',8,40)!;
  assert.equal(f.command,'ACTION3');
  assert.deepEqual(f.openingTest,{gate:17,controls:[15],remaining:1});
  const material:Reading={...held,subjects:[14,20],pieces:[15]};
  const rejected=structuredClone(m);
  assert.equal(localEffects(s,rejected,held,{...material,opened:[]},f.command,'gate closed',f),'material_did_not_keep_the_gate_open');
  assert.equal(localEffects(s,m,held,material,f.command,'still open',f),'material_holds_the_route_open_without_either_subject');
  assert.equal(m.openings?.need,undefined);
  const decoy=fresh();
  observeRequiredOpening({...s,ground:[...s.ground,9,10,11]},decoy,before,held,'there is a bypass');
  assert.equal(decoy.openings?.need,undefined);
});
