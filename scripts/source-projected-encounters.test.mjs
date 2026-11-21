import assert from 'node:assert/strict';
import test from 'node:test';
import {projectEncounters, preparationVisible, encounterRoute} from './source-projected-encounters.mjs';

const part = (x,y) => ({bbox:[x,y,x+1,y+1]});
const group = (...parts) => new Map(parts.map(p => [p.bbox.join(),p]));
const view = (actor,peer) => new Map([['body',group(actor)],['receiver',group(peer)]]);
const motor = (dx,dy) => new Map([[[dx,dy].join(),[dx,dy]]]);
const motors = new Map([['X',motor(2,0)],['Y',motor(0,2)]]);
const memory = new Map([['body',motors]]);

test('two independently measured strokes can meet a receiver that neither reaches alone',() => {
  const [plan] = projectEncounters(view(part(2,2),part(4,4)),memory,'X','Y',[12,12]);
  assert.ok(plan.flags.includes('turn'));
  assert.ok(preparationVisible(view(part(4,2),part(4,4)),plan));
  assert.equal(preparationVisible(view(part(2,2),part(4,4)),plan),false);
  assert.equal(projectEncounters(view(part(2,2),part(2,4)),memory,'X','Y',[12,12]).length,0);
});

test('project the known response of both subjects and reject unknown target motion',() => {
  const joint = new Map([...memory,['receiver',new Map([['X',motor(0,2)],['Y',motor(-2,0)]])]]);
  const before = view(part(2,2),part(6,2));
  const [plan] = projectEncounters(before,joint,'X','Y',[12,12]);
  assert.ok(plan.flags.includes('moving'));
  assert.equal(preparationVisible(view(part(4,2),part(6,2)),plan),false);
  assert.ok(preparationVisible(view(part(4,2),part(6,4)),plan));
  joint.get('receiver').delete('Y');
  assert.deepEqual(projectEncounters(before,joint,'X','Y',[12,12]),[]);
});

test('a longer horizon finds an approach and checks an alternative first step after a contradiction',() => {
  const before = view(part(2,2),part(8,4));
  const find = (h,tried=new Set(),used=new Set()) => encounterRoute(before,memory,
    ['X','Y'],[12,12],h,'contact',tried,used);
  assert.equal(find(2),null);
  const direct = find(6);
  assert.equal(direct.steps.length,4);
  const alternative = find(6,new Set(),new Set([direct.steps[0].input]));
  assert.equal(alternative.steps.length,4);
  assert.notEqual(alternative.steps[0].input,direct.steps[0].input);
  assert.deepEqual(alternative.steps.at(-1).middle,[8.5,4.5]);
  assert.equal(find(6,new Set([direct.id])),null);
});
