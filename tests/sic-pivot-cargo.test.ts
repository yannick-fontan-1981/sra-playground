import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeExecution, NativeObservation, NativePoint, NativeProgramRegistry } from '../src/logos-engine/v6-native-types.ts';
import { createSicPivotCargo, learnPivotCargoId } from '../src/sic/pivot-cargo.ts';

test('a checked attachment separates touching loads and keeps both delivery obligations', async () => {
  const actor: NativePoint = [1, 1], adjacent: NativePoint = [2, 1], resting: NativePoint = [3, 1];
  const at = { actor, cargo: [[adjacent, resting]], held: -1, delivered: 0 };
  const pitch = 3, floor = Array.from({ length: 30 }, (_, cell) => [cell % 6, Math.floor(cell / 6)].join(','));
  const destinations = [['3,3', '4,3']], actorColor = 10, freeColor = 7, heldColor = 6, core = 0;
  const layout = { origin: [0, 0], pitch, floor, destinations, pivot: [], actorColor, core, initial: at,
    freeColors: [freeColor], receiverColors: [13] };
  const action = { action_ref: 'ACTION5', data: {} };
  const family = createSicPivotCargo();
  family.restore!({ witness: null, state: { epoch: 1, layout, at, refs: [], moves: true, interactions: [], failed: false,
    steps: [{ input: action.action_ref, intent: 'attach', subject: 0, next: { ...at, held: 0 } }] } });
  const rows = Array.from({ length: 5 * pitch }, () => Array<number>(6 * pitch).fill(5));
  function token(frame: number[][], [x, y]: NativePoint, color: number) {
    for (let i = 0; i < pitch; i++) frame[y * pitch + i]!.fill(color, x * pitch, (x + 1) * pitch);
    frame[y * pitch + 1]![x * pitch + 1] = core;
  }
  token(rows, actor, actorColor);
  token(rows, adjacent, freeColor);
  token(rows, resting, freeColor);
  const next = rows.map(row => row.slice());
  token(next, adjacent, heldColor);
  const observation = (revision: number): NativeObservation => ({
    revision, frame_hash: 'frame-' + revision, observation_ref: 'board:revision:' + revision, level_epoch: 1,
    coordinate_basis: 'screen', entities: [], available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'],
    state: 'NOT_FINISHED', levels_completed: 0, unknowns: [], provenance: 'fixture',
  });
  const before = observation(1), after = observation(2);
  const probe = await family.propose(before, rows, [], 50);
  assert.ok(probe);

  const changedTerrain = next.map(row => row.slice());
  changedTerrain[0]![0] = 8;
  const contradicted = await family.after(probe, 0, before, after, rows, changedTerrain);
  assert.equal(contradicted.matched, false);

  const confirmed = await family.after(probe, 0, before, after, rows, next);
  assert.equal(confirmed.reason, 'attachment_distinguishes_touching_loads');
  assert.equal(confirmed.seal_prefix, true);
  await family.record(before, after, action, rows, next, probe, 0);
  const replanned = await family.propose(after, next, [], 49);
  assert.ok(replanned);
  assert.deepEqual(replanned.local.at, { ...at, held: 0, cargo: [[adjacent], [resting]] });
  assert.deepEqual(replanned.local.layout.destinations, [destinations[0], destinations[0]]);
  assert.equal(replanned.local.steps.filter(step => step.intent === 'drop').length, 2);
});

test('one witnessed movement can register disconnected visible terrain before a delivery plan is used', async () => {
  const {nativePlanReceipt} = await import('../src/sic/native-plan-receipt.ts');
  const {readRecoveryRevision,recoveryRevision} = await import('../src/sic/recovery-pack.ts');
  const {compileInformationPreference} = await import('../src/sic/information-preference.ts');
  const option = compileInformationPreference({strategy:'motion_contrast',mode:'active',minimumOutcomes:2,
    fieldRegistration:'test_aligned_fragments_after_motion'});
  const pack = recoveryRevision({version:1,mode:'active',maxDepth:64,maxNodes:1000,solver:'sic-fallback',informationPreference:option});
  assert.equal(readRecoveryRevision(pack).configuration.informationPreference?.fieldRegistration, option.fieldRegistration);
  assert.throws(() => compileInformationPreference({...option,fieldRegistration:'unchecked'}));
  for (const transposed of [false,true]) {
    const pitch=5, offset=transposed?4:3, actorColor=transposed?11:2;
    function board(actorX:number,actorY:number) {
      const rows=Array.from({length:offset+6*pitch+6},()=>Array<number>(offset+6*pitch+4).fill(0));
      const tile=(x:number,y:number): NativePoint => [offset+(transposed?y:x)*pitch,offset+(transposed?x:y)*pitch];
      const paint=(x:number,y:number,size:number,color:number) => {
        for (let j=y;j<y+size;j++) rows[j]!.fill(color,x,x+size);
      };
      for (let y=0;y<6;y++) for (let x=0;x<6;x++) paint(...tile(x,y),pitch,5);
      for (let column=0;column<6;column++) {
        const [x,y]=tile(column,2);
        paint(x,y,pitch,6);
        paint(x+1,y+1,pitch-2,column===0?3:column<=2?4:8);
      }
      for (const [column,row,color] of [[actorX,actorY,actorColor],[3,3,7],[3,4,10],[4,4,10]] as const) {
        const [x,y]=tile(column,row);
        paint(x,y,pitch,color);
        rows[y+2]![x+2]=9;
      }
      paint(2,offset+6*pitch+2,2,actorColor);
      return rows;
    }
    const before=board(1,3),after=board(2,3);
    const observe=(revision:number): NativeObservation => ({
      revision,frame_hash:'fragmented-'+revision,observation_ref:'field:revision:'+revision,level_epoch:1,
      coordinate_basis:'screen',entities:[],available_action_refs:['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5'],
      state:'NOT_FINISHED',levels_completed:0,unknowns:[],provenance:'synthetic',
    });
    const initial=observe(1),current=observe(2),command=transposed?'ACTION2':'ACTION4';
    const execution: NativeExecution = {readPriorDirectionalScene(project) {
      const scene=project(before,initial);
      return scene===null ? null : {beforeRef:initial.observation_ref,afterRef:current.observation_ref,levelEpoch:1,command,scene};
    }};
    const family=(active:boolean)=>createSicPivotCargo(learnPivotCargoId,false,active);
    const registry={registerProgram: async()=>({run:async({situation}:{situation:{eligibleProbe:boolean}})=>
      ({result:situation.eligibleProbe?'P05':'P07',receipt:{}})})} as unknown as NativeProgramRegistry;
    const old=family(false),candidate=family(true);
    await old.attachPrograms?.(registry);
    await candidate.attachPrograms?.(registry);
    assert.equal(await old.propose(current,after,[],50,execution),null);
    assert.equal(await candidate.propose(current,before,[],50,execution),null);
    assert.equal(await candidate.propose(current,after,[],50,{}),null);
    const offer=await candidate.propose(current,after,[],50,execution);
    assert.ok(offer);
    assert.equal(offer.local.fieldRegistration?.command,command);
    assert.equal(offer.local.fieldRegistration?.withDeliveryPlan,1);
    assert.equal(offer.local.fieldRegistration?.consistentWithMotion,1);
    assert.deepEqual(offer.local.refs,[initial.observation_ref,current.observation_ref]);
    const receipt=nativePlanReceipt(learnPivotCargoId,offer,current,0);
    assert.deepEqual(receipt.fieldRegistrationForecast,offer.fieldRegistrationForecast);
  }
});
