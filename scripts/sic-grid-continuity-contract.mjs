import assert from 'node:assert/strict';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';
import { gridOwner } from './sic-grid-continuity.mjs';

export const gridCeilings = [21,29,28,44,42,35];
// Actual tickets from the combined-source SNAR collection, run 46028362277.
export const gridContinuity = [
  { actions: 16, continued: 6, walks: 6, holds: 0, exits: 0, terrain: 0 },
  { actions: 24, continued: 6, walks: 6, holds: 0, exits: 0, terrain: 0 },
  { actions: 23, continued: 7, walks: 7, holds: 0, exits: 0, terrain: 0 },
  { actions: 36, continued: 8, walks: 8, holds: 0, exits: 0, terrain: 2 },
  { actions: 35, continued: 4, walks: 3, holds: 0, exits: 0, terrain: 1 },
  { actions: 29, continued: 11, walks: 8, holds: 2, exits: 1, terrain: 7 },
];
const delta = (action, columns) => ({ ACTION1:-columns,ACTION2:columns,ACTION3:-1,ACTION4:1 })[action];
const position = value => value && value.actorCount === 1 && Number.isSafeInteger(value.actor);

export function measureGridContinuity(run, issued, groups) {
  const physical = [];
  for (const group of groups.values()) {
    if (group.length > 1 && group[0].outcome?.family === gridOwner)
      assert.ok(group.every(ticket=>ticket.grid), 'An executed grid continuation has no public measurement');
    if (!group.some(ticket=>ticket.grid)) continue;
    requireExecutedPrefix('Grid navigation',group);
    assert.ok(group.length<=16 && group.every((ticket,index)=>ticket.grid && ticket.outcome.family===gridOwner
      && ticket.actionIndex===index && ticket.planId===group[0].planId && ticket.decisionRevision===group[0].decisionRevision),
    'Grid prefix lost native identity or its bound');
    assert.equal(group.at(-1).sealed,group.length,'Grid prefix did not reconcile every actual return once');
    const initial=group[0].grid, scope=continuityObservation(initial.bindingRef);
    assert.ok(scope && initial.beforeRef===initial.bindingRef && group[0].planId==='sic-plan:'+initial.bindingRef);
    assert.ok(initial.learnedEvidence.length && initial.learnedEvidence.every(ref=>{
      const parsed=continuityObservation(ref);return parsed&&parsed.scope===scope.scope&&parsed.epoch<=scope.epoch&&parsed.revision<=scope.revision;
    }),'Known grid movement has no acquired public evidence');
    let continued=0, confirmedExit=0, terrainUnderPatrols=0;
    for(const [index,ticket] of group.entries()) {
      const grid=ticket.grid,before=continuityObservation(grid.beforeRef),after=continuityObservation(grid.afterRef);
      const effect=run.steps?.[run.executedTickets.indexOf(ticket)];
      assert.ok(before&&after&&before.scope===scope.scope&&after.scope===scope.scope
        && before.epoch===ticket.level&&grid.levelEpoch===ticket.level&&grid.scoreBefore===ticket.level-1
        && after.revision===before.revision+1 && grid.afterRef===ticket.outcome.observation_ref
        && (grid.boundary?grid.scoreAfter===grid.scoreBefore+1:grid.scoreAfter===grid.scoreBefore&&after.epoch===before.epoch)
        && effect?.a===Number(ticket.action.slice(6))&&effect.family===gridOwner&&effect.from===before.frame&&effect.to===after.frame,
      'Grid physical evidence does not bind the executed command and exact return');
      assert.equal(grid.actionRef,ticket.action);assert.equal(grid.kind,initial.kind);
      assert.equal(grid.bindingRef,initial.bindingRef);assert.equal(grid.roleFingerprint,initial.roleFingerprint);
      assert.deepEqual(grid.learnedEvidence,initial.learnedEvidence);
      assert.deepEqual(grid.completedRole,initial.completedRole);
      assert.ok(position(grid.before)&&grid.before.actor===grid.expectedFrom,'Grid input has no uniquely measured controlled carrier');
      if(index>0) {
        assert.equal(grid.beforeRef,group[index-1].grid.afterRef);
        assert.deepEqual(grid.before,group[index-1].grid.after,'Grid continuation does not follow its preceding physical return');
      }
      if(grid.kind!=='stationary hold') {
        const movement=delta(ticket.action,grid.columns);
        assert.ok(Number.isSafeInteger(movement)&&grid.expectedTo-grid.expectedFrom===movement);
        if(Math.abs(movement)===1)assert.equal(Math.floor(grid.expectedFrom/grid.columns),Math.floor(grid.expectedTo/grid.columns));
        assert.ok(!grid.before.obstacles.includes(grid.expectedTo)&&!grid.before.patrols.includes(grid.expectedTo),
          'Grid walk began toward a currently occupied cell');
        if (grid.kind === 'probe with known exit') {
          assert.ok(group.length <= 2 && grid.experimental === (index === 0) && grid.probeTerrain === null
            && grid.exitSignature === initial.exitSignature && grid.before.exitSignature === grid.exitSignature,
          'The exit continuation must preserve the same visible signature after an experimental first step');
          if (index > 0) {
            assert.equal(grid.expectedTo, grid.goal);
            assert.equal(group[0].grid.after.actor, grid.expectedFrom);
          }
        }
      } else {
        const held=grid.holdRole, role=held?.role, learnedBefore=continuityObservation(role?.before),learnedAfter=continuityObservation(role?.after);
        assert.ok(held&&role&&learnedBefore&&learnedAfter&&learnedBefore.scope===scope.scope&&learnedAfter.scope===scope.scope
          && learnedAfter.epoch===scope.epoch&&learnedBefore.epoch===scope.epoch
          && learnedAfter.revision===learnedBefore.revision+1&&learnedAfter.revision<=scope.revision
          && initial.learnedEvidence.includes(role.before)&&initial.learnedEvidence.includes(role.after)
          && role.input===ticket.action&&role.at===grid.expectedFrom&&grid.expectedTo===grid.expectedFrom
          && grid.before.staticWall===true&&grid.before.obstacles.includes(held.target),
        'A stationary grid control lost its acquired blocking-wall effect');
        assert.deepEqual(grid.holdRole,initial.holdRole);
      }
      if(ticket.outcome.matched===true&&!grid.boundary) {
        assert.ok(position(grid.after)&&grid.after.actor===grid.expectedTo,'Grid command has no matching actual carrier return');
        if(grid.kind==='stationary hold')assert.ok(grid.after.staticWall===true&&grid.after.charges===grid.before.charges,
          'Stationary grid control spent a charge or lost its wall');
        if(index>0)continued++;
      } else assert.equal(index,group.length-1,'A grid prefix continued through a contradiction or official boundary');
      if(index<group.length-1)assert.equal(grid.acquisition,null,'Grid state was published before reconciliation');
      else if(grid.boundary) {
        const completed=grid.acquisition?.completed;
        assert.ok(ticket.outcome.matched===true&&grid.kind!=='stationary hold'&&grid.expectedTo===grid.goal
          &&completed?.epoch===ticket.level&&completed.score===grid.scoreAfter&&completed.before===grid.beforeRef&&completed.after===grid.afterRef,
        'Grid official boundary did not acquire the actual completed-navigation witness');
        if (grid.kind === 'probe with known exit') {
          assert.equal(index, 1, 'The experimental step cannot be counted as the known exit');
          confirmedExit++;
        }
      } else if(ticket.outcome.matched===true) {
        const acquired=grid.acquisition;
        assert.ok(acquired&&acquired.epoch===ticket.level&&acquired.score===grid.scoreAfter&&acquired.at===grid.after.actor
          &&acquired.charges===grid.after.charges,'Grid final acquisition does not describe the actual return');
        const tail=group.slice(-5).map(item=>item.grid.afterRef);
        assert.deepEqual(acquired.evidence.slice(-tail.length),tail,'Grid returns were not acquired once in order');
        if(initial.turnBefore!==null)assert.equal(acquired.turn,initial.turnBefore+group.length,'Grid rail clock skipped or doubled an actual return');
        if(grid.kind==='stationary hold')assert.ok(acquired.stationary?.before===grid.beforeRef&&acquired.stationary.after===grid.afterRef);
        for (const [cell, remembered] of Object.entries(grid.terrainBeforePatrols ?? {})) {
          assert.equal(acquired.terrainUnderPatrols[cell], remembered, 'Measured patrols must preserve their independently known terrain');
          terrainUnderPatrols++;
        }
      }
    }
    if (continued > 0 || confirmedExit > 0 || terrainUnderPatrols > 0)
      physical.push({ kind: initial.kind, first: issued.indexOf(group[0]), last: issued.indexOf(group.at(-1)),
        continued, confirmedExit, terrainUnderPatrols });
  }
  return physical;
}

export function requireGridContinuity(level, run, issued, groups) {
  const expected = gridContinuity[level - 1];
  assert.ok(expected, 'Missing qualified grid level');
  assert.ok(issued.length <= gridCeilings[level - 1] && issued.every(ticket => ticket.resets === 0),
    'SNAR exceeded its original chronological ceiling or reset');
  assert.ok(issued.length - groups.size >= expected.continued, 'SNAR lost its executed grid continuity');
  const effects = measureGridContinuity(run, issued, groups);
  const count = (kind, field) => effects.filter(effect => kind === null || effect.kind === kind)
    .reduce((total, effect) => total + effect[field], 0);
  assert.ok(count('known grid walk', 'continued') >= expected.walks, 'SNAR lost physically confirmed known walks');
  assert.ok(count('stationary hold', 'continued') >= expected.holds, 'SNAR lost its physically confirmed stationary hold');
  assert.ok(count('probe with known exit', 'confirmedExit') >= expected.exits, 'SNAR lost the guarded official exit');
  assert.ok(count(null, 'terrainUnderPatrols') >= expected.terrain, 'SNAR lost preserved terrain under measured patrols');
  return effects;
}
