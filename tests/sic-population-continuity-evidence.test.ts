import assert from 'node:assert/strict';
import test from 'node:test';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import { measureReferencePopulation } from '../src/logos-engine/v6-reference-population-observation.ts';
import { capturePopulationControl, measurePopulationReturn, completePopulationControl,
  measuredPopulationPreparation, observePopulationContinuity } from '../scripts/sic-population-continuity.mjs';

const room = (selected: number[] = [0], moved = false, changedNeighbor = false) => {
  const rows = Array.from({length: 20}, () => Array(20).fill(0));
  const bodies = [[2, moved ? 2 : 1, 3], [2, 3, changedNeighbor ? 5 : 4]];
  bodies.forEach(([y, x, color], index) => {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) rows[y! * 3 + dy]![x! * 3 + dx] = color!;
    if (selected.includes(index)) rows[y! * 3]![x! * 3] = 9;
  });
  return rows;
};
const scene = {q:3, offset:[0,0], population:2, background:0, empty:0, border:8,
  floor:Array.from({length:16}, (_, i) => [1 + Math.floor(i / 4), 1 + i % 4]),
  reference_box:[15,15,17,17], reference_digest:symbolicDigest(Array.from({length:3}, () => [0,0,0])),
  observed_marker_overlays:[[0,0,9]], bodies:[{cell:[2,1],appearance:3},{cell:[2,3],appearance:4}]};
const proposal = () => ({kind:'sic_learn_reference_placement', binding:{level_epoch:2},
  actions:[{action_ref:'ACTION6'},{action_ref:'ACTION4'}],
  local:{scene:structuredClone(scene), controls:{ACTION4:{delta:[0,1]}}, evidence:['learned-direction'],
    neighborEffectRef:'observed-neighbor'}, choice:{expected:[99,99]}, route:[{expected:[99,99]},{expected:[99,99]}]});
const ticket = (index: number) => ({actionIndex:index, actionRef:index ? 'ACTION4' : 'ACTION6',
  observationRef:index ? 'selected' : 'before-selection', levelsCompleted:1, data:index ? {} : {x:3,y:6}});
const returned = (index: number, seal = index === 1) => ({sealCount:Number(seal),
  outcome:{family:'sic_learn_reference_placement', observation_ref:index ? 'moved' : 'selected', matched:true,
    seal_prefix:seal, reason:'population_return_measured'}});
const capture = (index: number, second = room([0], true), changed = false) => {
  const p = proposal(), initial = index ? room([0]) : room([1]);
  return measurePopulationReturn(capturePopulationControl(p,ticket(index),initial,measureReferencePopulation),
    changed ? room([0],true,true) : second,p,measureReferencePopulation,1);
};
const physicalTicket = (index: number, data = capture(index,index ? room([0],true) : room([0]))) => ({
  action:ticket(index).actionRef, ...returned(index), population:completePopulationControl(data,
    () => ({state:{epoch:2,evidence:['moved'],neighborEffectRef:'moved'}}),returned(index))});

test('population collector reads the actual selection and movement, independent of the forecast', () => {
  const p = capture(1);
  assert.deepEqual(p.movement,{from:[2,1],to:[2,2]});
  assert.deepEqual(p.before.selected,[2,1]);
  assert.deepEqual(p.after.selected,[2,2]);
  assert.deepEqual(p.knownDelta,[0,1]);
  const first = physicalTicket(0), second = physicalTicket(1), run = {executedTickets:[first,second]};
  assert.deepEqual(measuredPopulationPreparation(run,run.executedTickets,new Map([['plan',run.executedTickets]])),
    {preparedSelections:1,movementsAfterSelection:1,neighborEffects:0,unknownSupportTickets:0});
});

test('capture is immutable and acquisition is read only after native reconciliation', () => {
  const p = proposal(), before = capturePopulationControl(p,ticket(1),room(),measureReferencePopulation);
  p.local.controls.ACTION4.delta[0] = 7; p.local.evidence.push('late');
  assert.deepEqual(before.knownDelta,[0,1]); assert.deepEqual(before.learnedEvidence,['learned-direction']);
  let reads = 0;
  const result = completePopulationControl(before,() => {reads++; return {};},returned(0,false));
  assert.equal(reads,0); assert.equal(result.acquisition,null);
});

for (const selected of [[],[0,1]]) test('missing or ambiguous actual selection cannot prove a prepared movement '+selected, () => {
  const p = proposal(), actual = observePopulationContinuity(room(selected),p,measureReferencePopulation);
  assert.equal(actual.selected,null); assert.equal(actual.markerCount,selected.length);
  const first = physicalTicket(0,capture(0,room(selected))), second = physicalTicket(1);
  assert.throws(() => measuredPopulationPreparation({executedTickets:[first,second]},[first,second],
    new Map([['plan',[first,second]]])),/unique physical selection/);
});

test('a planned movement without physical displacement is rejected', () => {
  const first = physicalTicket(0), second = physicalTicket(1,capture(1,room([0])));
  assert.equal(second.population.movement,null);
  assert.throws(() => measuredPopulationPreparation({executedTickets:[first,second]},[first,second],
    new Map([['plan',[first,second]]])),/actual selected position/);
});

test('a stationary neighbor response requires its actual acquired receipt and seals the prefix', () => {
  const changed = physicalTicket(1,capture(1,room([0],true,true),true));
  assert.deepEqual(changed.population.changedNeighbors,[{cell:[2,3],before:4,after:5}]);
  const run = {executedTickets:[changed]};
  assert.equal(measuredPopulationPreparation(run,run.executedTickets,new Map()).neighborEffects,1);
  changed.population.acquisition.neighborEffectRef = 'forecast';
  assert.throws(() => measuredPopulationPreparation(run,run.executedTickets,new Map()),/actual return/);
});

test('unknown support cannot inherit a predicted neighbor effect without an earlier observed response', () => {
  const first = physicalTicket(0);
  first.population.support = {cells:[[3,1]],unknownMasks:[11],unknownAssigned:false};
  first.population.neighborEffectRef = 'unmeasured';
  assert.throws(() => measuredPopulationPreparation({executedTickets:[first]},[first],new Map()),/preceding actual/);
});

test('official score closes the last physical preparation without inventing positions on the next board', () => {
  const first = physicalTicket(0), p = proposal();
  const before = capturePopulationControl(p,ticket(1),room([0]),measureReferencePopulation);
  const boundary = measurePopulationReturn(before,[],p,measureReferencePopulation,2);
  assert.equal(boundary.after,null); assert.equal(boundary.movement,null);
  const second = physicalTicket(1,boundary); second.outcome.reason = 'official_boundary';
  assert.equal(measuredPopulationPreparation({executedTickets:[first,second]},[first,second],
    new Map([['plan',[first,second]]])).preparedSelections,1);
});
