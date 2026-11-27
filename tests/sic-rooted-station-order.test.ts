import assert from 'node:assert/strict';
import test from 'node:test';
import { measurePiercingGoal } from '../src/logos-engine/v5-piercing-plan.ts';

function request(firstRef: string, secondRef: string, order = ['early','first','second'], distinct = false) {
  const spine = [0,1,2,3,4].map(col => [1,col]);
  const piece = (piece_ref: string, type_ref: string, row: number, col: number) =>
    ({ piece_ref, type_ref, occupied_positions: [[row,col]], support_refs: ['rod'] });
  return { configuration: { configuration_ref: 'projection', is_predicted_configuration: true,
    rods: [{ rod_ref: 'rod', root_ref: 'root', root_to_tip_positions: spine,
      rod_footprint_positions: [...spine,...spine.map(([,col]) => [2,col])] }],
    pieces: [piece('origin','early',1,1),piece(firstRef,'first',1,3),piece(secondRef,'second',2,distinct ? 4 : 3)] },
    requested_root_ref: 'root', requested_type_order: order };
}

test('an experiment may test two compatible type orders without asserting either, regardless of participant names', () => {
  for (const [one,two] of [['a','z'],['z','a']] as const) {
    for (const order of [['early','first','second'],['early','second','first']]) {
      const result=measurePiercingGoal(request(one,two,order),'test_compatible_stations');
      assert.equal(result.projected_order_trial.status,'compatible_unordered');
      assert.deepEqual(result.projected_order_trial.groups.map((g: {station:number})=>g.station),[1,3]);
      assert.equal(result.predicted_rooted_match,false);
      assert.equal(result.rooted_match,false);
      assert.deepEqual(result.measured_type_order,[]);
    }
  }
});

test('a station tie cannot move a type ahead of a preceding station', () => {
  const result=measurePiercingGoal(request('a','z',['second','early','first']),'test_compatible_stations');
  assert.equal(result.projected_order_trial.status,'incompatible');
  assert.equal(result.predicted_rooted_match,false);
});

test('distinct stations determine the projected order, and the reference policy retains its own measurements', () => {
  const ordered=measurePiercingGoal(request('z','a',undefined,true),'test_compatible_stations');
  assert.equal(ordered.predicted_rooted_match,true);
  assert.equal(ordered.rooted_match,false);
  assert.equal(ordered.projected_order_trial,undefined);
  assert.equal(measurePiercingGoal(request('a','z')).predicted_rooted_match,true);
  assert.equal(measurePiercingGoal(request('z','a')).predicted_rooted_match,false);
});
