import test from 'node:test';
import assert from 'node:assert/strict';
import { anotherOperandTest } from '../src/sic/experiment-with-another-operand.ts';
import { planDisplacements } from '../src/sic/plan-paired-displacements.ts';
import { fresh, localEffects } from '../src/sic/paired-displacements.ts';
import type { Reading, Scene } from '../src/sic/paired-scene.ts';

const room: Scene = {
  grid: { pitch: 3, left: 0, top: 0, columns: 7, rows: 5 }, floor: 2, accent: 4, bodies: [8, 9],
  ground: [0, 14, 15, 16, 17], medium: [7], goals: [33, 34], doors: [], other: [], features: [],
  origin: [16, 0], initial: Array(35).fill('floor'), partialContext: true,
};
const start: Reading = {active: 0, subjects: [16, 0], pieces: [15], supports: [], opened: [], anchor: -1};

test('a different movable operand can release a stranded subject while keeping the other one free', () => {
  const m = fresh();
  for (const [i, [dx, dy]] of [[0,-1],[0,1],[-1,0],[1,0]].entries())
    m.motors['ACTION'+(i+1)] = {dx:dx!, dy:dy!, ref:'observed motor'};
  m.strandedPartner = {side:1,site:0,witness:'peer gained mobility after the exchange'};
  assert.equal(anotherOperandTest(room, m, start, 'fresh', 8, 80), undefined);
  m.evidence[1] = {exchange:4, clear_path_exchange:4};
  assert.equal(anotherOperandTest({...room, goals:[16,34]}, m, start, 'occupied goal', 8, 80), undefined);
  assert.equal(anotherOperandTest({...room, medium:[]}, m, start, 'intervening wall', 8, 80), undefined);
  const stricter = planDisplacements(room,structuredClone(m),start,'three outcomes required',8,80,3);
  assert.equal(stricter?.operandTest, undefined);
  const commanded = planDisplacements(room,structuredClone(m),start,'two outcomes required',8,80,2);
  assert.ok(commanded?.operandTest);
  const move=anotherOperandTest(room,m,start,'observed',8,80)!;
  assert.equal(move.command,'ACTION3');
  assert.equal(move.operandTest!.steps,2);
  const placed={...start,subjects:[15,0],pieces:[14]} satisfies Reading;
  assert.equal(localEffects(room,m,start,placed,move.command,'placed',move),'the_alternative_operand_preparation_matched');
  const select=anotherOperandTest(room,m,placed,'placed',8,80)!;
  assert.ok(select.command.startsWith('ACTION6:'));
  const selected = {...placed,active:1} satisfies Reading;
  const effect=anotherOperandTest(room,m,selected,'selected',8,80)!;
  assert.equal(effect.command,'ACTION2');
  assert.equal(effect.operandTest!.steps,0);
  const inert = structuredClone(m);
  assert.equal(localEffects(room,inert,selected,selected,effect.command,'no change',effect),'the_alternative_operand_left_the_subject_confined');
  assert.ok(inert.checked.includes('operand/' + effect.key));
  assert.equal(anotherOperandTest(room,inert,selected,'after refusal',2,20), undefined);
  const released={...selected,subjects:[15,14],pieces:[0]} satisfies Reading;
  assert.equal(localEffects(room,m,selected,released,effect.command,'release',effect),'an_alternative_operand_released_the_subject_and_preserved_its_partner');
  assert.equal(m.strandedPartner,undefined);
});
