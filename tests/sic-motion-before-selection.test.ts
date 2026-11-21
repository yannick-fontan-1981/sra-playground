import test from 'node:test';
import assert from 'node:assert/strict';
import { retainMotion, recoverRegisteredMotions, type PriorMotions } from '../src/sic/motion-before-selection.ts';
import type { TransportMemory } from '../src/sic/transport-observations.ts';

test('selection can bind old motion evidence while rejecting conflicting or joint motion', () => {
  function frame(x: number, y: number) {
    const row = Array<number>(15).fill(0);
    row[3*x+1] = 7;
    row[3*y+2] = 8;
    return [row,row,row];
  }
  const memory: TransportMemory = { grid: {pitch:3,left:0,top:0,columns:5,rows:1}, inks:[7,8], active:1,
    selection:'selection',mark:1,motors:{},verified:[false,false],denied:{} };
  const history: PriorMotions = {};
  retainMotion(history,'ACTION3',frame(1,4),frame(2,4),'earlier-right');
  retainMotion(history,'ACTION1',frame(1,4),frame(2,4),'first');
  retainMotion(history,'ACTION1',frame(2,4),frame(1,4),'opposite');
  retainMotion(history,'ACTION2',frame(1,4),frame(2,3),'both');
  recoverRegisteredMotions(memory,history);
  assert.deepEqual(memory.motors, {ACTION3:{dx:1,dy:0,ref:'earlier-right'}});
});
