import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureReferencePopulation } from '../src/logos-engine/v6-reference-population-observation.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { assessPopulationSupport, createSicVerifyReferencePlacement, learnReferencePlacementId,
  measureTransferredPopulationSelection } from '../src/sic/population-placement.ts';

const fixture = new URL('./fixtures/v6-reference-population-reference.json.gz', import.meta.url);
const base: number[][] = JSON.parse(gunzipSync(readFileSync(fixture)).toString()).rasters.base;
const layout = measureReferencePopulation(base)!;
const cells: [number, number][] = layout.bodies.map(({ cell: [y, x] }: { cell: number[] }) =>
  [layout.offset[1] + x! * layout.q, layout.offset[0] + y! * layout.q]);
const ink = Math.max(...base.flat()) + 1;

function marked(index: number, offsets: number[][]) {
  const rows = structuredClone(base), [x, y] = cells[index]!;
  for (const [dx, dy] of offsets) rows[y + dy!]![x + dx!] = ink;
  return rows;
}

test('a translated mark reveals a stationary population and binds the body actually clicked', () => {
  for (const shape of [[[1, 1]], [[0, 1], [1, 1]]]) {
    const before = marked(0, shape), after = marked(1, shape);
    const original = structuredClone(before);
    assert.equal(measureReferencePopulation(before), null);
    const result = measureTransferredPopulationSelection(before, after, cells[1]!);
    assert.deepEqual(result?.selection, layout.bodies[1].cell);
    assert.deepEqual(result?.scene.bodies, layout.bodies);
    assert.deepEqual(measureReferencePopulation(before, result!.scene)?.bodies, layout.bodies);
    assert.deepEqual(before, original);
    assert.equal(measureTransferredPopulationSelection(before, after, cells[0]!), null);
  }
});

test('shifted offsets, extra edits, an absent mark or a solitary new mark do not prove transfer', () => {
  const before = marked(0, [[1, 1]]), after = marked(1, [[1, 1]]);
  assert.equal(measureTransferredPopulationSelection(before, marked(1, [[0, 0]]), cells[1]!), null);
  assert.equal(measureTransferredPopulationSelection(base, after, cells[1]!), null);
  assert.equal(measureTransferredPopulationSelection(before, before, cells[1]!), null);
  after[0]![0] = ink;
  assert.equal(measureTransferredPopulationSelection(before, after, cells[1]!), null);
});

test('a projected neighbor relation stays open until a measured appearance confirms or contradicts it', () => {
  const scene = { target: [[0,0,1], [0,2,2]] as [number,number,number][] };
  const known = {8:{appearance:1,ref:'east'}};
  assert.equal(assessPopulationSupport(scene,[[0,1]],known),null);
  assert.deepEqual(assessPopulationSupport(scene,[[0,1]],known,'changed-neighbor'),
    {evidence:['east','changed-neighbor'],unknownMasks:[4]});
  assert.equal(assessPopulationSupport(scene,[[0,1]],{...known,4:{appearance:3,ref:'west'}},'changed-neighbor'),null);
  assert.deepEqual(assessPopulationSupport(scene,[[0,1]],{...known,4:{appearance:2,ref:'west'}}),
    {evidence:['east','west'],unknownMasks:[]});
  assert.equal(assessPopulationSupport(scene,[],{},'changed-neighbor'),null);
});

test('a planner can acquire a click and calibrated movement issued by another strategy', async () => {
  const before = marked(0, [[1,1]]), selected = marked(1, [[1,1]]);
  const [y,x] = layout.bodies[1].cell, occupied = new Set(layout.bodies.map((p:{cell:number[]}) => p.cell.join(',')));
  const available = layout.floor.find(([r,c]:number[]) => Math.abs(r!-y)+Math.abs(c!-x)===1 && !occupied.has([r,c].join(',')));
  assert.ok(available);
  const [r,c] = available, next = structuredClone(selected), [l,t] = cells[1]!;
  const dx = (c-x)*layout.q, dy = (r-y)*layout.q;
  for(let j=0;j<layout.q-1;j++) for(let i=0;i<layout.q-1;i++){
    next[t+j]![l+i] = selected[t+j+dy]![l+i+dx]!;
    next[t+j+dy]![l+i+dx] = selected[t+j]![l+i]!;
  }
  const observe = (rows:number[][],i:number) => measureNativeObservation({frame_rows:rows,frame_hash:'frame'+i,
    level:1,levels_completed:0,state:'NOT_FINISHED',available_action_refs:['ACTION6','ACTION4']},i,'test');
  const family=createSicVerifyReferencePlacement(learnReferencePlacementId);
  const [a,b,n]=await Promise.all([observe(before,0),observe(selected,1),observe(next,2)]);
  await family.observePublicOutcome!(a,b,{action_ref:'ACTION6',data:{x:l,y:t}},before,selected);
  assert.deepEqual(family.state!().state.selection,[y,x]);
  await family.observePublicOutcome!(b,n,{action_ref:'ACTION4',data:{}},selected,next);
  const state=family.state!().state;
  assert.deepEqual(state.selection,[r,c]);assert.deepEqual(state.controls.ACTION4.delta,[r-y,c-x]);
  assert.ok(state.evidence.includes(b.observation_ref)&&state.evidence.includes(n.observation_ref));
});
