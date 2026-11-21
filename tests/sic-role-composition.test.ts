import test from 'node:test';
import assert from 'node:assert/strict';
import {composeVacancyMoves} from '../src/sic/vacancy-composition.ts';
import {planRoleOccupancy} from '../src/sic/role-occupancy-experiment.ts';

test('temporarily vacates an occupied target when it blocks the route and restores it at the end',()=>{
  const plan=composeVacancyMoves([[0,0],[0,1],[0,2]],[[0,0],[0,1]],[[0,1],[0,2]],{right:{delta:[0,1]}});
  assert.deepEqual(plan,[
    {from:[0,1],to:[0,2],input:'right',select:true},
    {from:[0,0],to:[0,1],input:'right',select:true},
  ]);
  assert.equal(composeVacancyMoves([[0,0],[0,2]],[[0,0]],[[0,2]],{right:{delta:[0,1]}}),null);
});
test('vacancy transport retains intermediate holes and routes the selected subject across consecutive empty cells',()=>{
  const floor:[number,number][]=Array.from({length:6},(_,i)=>[0,i]);
  const plan=composeVacancyMoves(floor,[[0,0],[0,3]],[[0,3],[0,5]],{right:{delta:[0,1]}})!;
  const occupied=new Set(['0,0','0,3']);let switches=0;
  for(const step of plan){
    assert.ok(occupied.delete(step.from.join()));assert.ok(!occupied.has(step.to.join()));
    occupied.add(step.to.join());if(step.select)switches++;
  }
  assert.deepEqual([...occupied].sort(),['0,3','0,5']);assert.equal(switches,2);
});
test('derives equal-duration preparations differing only in where the first subject stops',()=>{
  const motors=[{input:'R',dx:1,dy:0,ref:3},{input:'L',dx:-1,dy:0,ref:4}];
  const plan=planRoleOccupancy([0,0],[4,0],motors,p=>p[0]>=0&&p[0]<=4,3)!;
  assert.deepEqual(plan.occupied.map(p=>p.input),['R','R','R']);
  assert.deepEqual(plan.clear.map(p=>p.input),['R','R','L']);
  assert.equal(plan.test.input,'L');assert.deepEqual(plan.destination,[3,0]);
  assert.equal(planRoleOccupancy([0,0],[4,0],motors,p=>p[0]>=0&&p[0]<=4,2),null);
});

test('moves the preparer into a measured contact pose and keeps the same subsequent command in both arms',()=>{
  const motors=[{input:'advance',dx:1,dy:0,ref:3},{input:'retreat',dx:-1,dy:0,ref:4}];
  const plan=planRoleOccupancy([0,0],[3,0],motors,p=>p[0]>=0&&p[0]<=4,2,new Set(),
    {input:'advance',offset:[-1,0]})!;
  assert.deepEqual(plan.occupied.map(p=>p.input),['advance','advance']);
  assert.deepEqual(plan.clear.map(p=>p.input),['advance','retreat']);
  assert.deepEqual(plan.destination,[2,0]);
  assert.equal(plan.test.input,'advance');
});
