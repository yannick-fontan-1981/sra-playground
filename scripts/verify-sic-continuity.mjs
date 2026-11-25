import assert from 'node:assert/strict';
import { measureManipulation, requireManipulation } from './measure-ss01-manipulation.mjs';
import { compileLevel, equal, initialState, stepWorld } from '../experiments/sinking-star-ss02/src/core.ts';
import { SS02_LEVELS } from '../experiments/sinking-star-ss02/src/levels.ts';
import { compileLevel as compilePullLevel, initialState as initialPullState, stepDetailed as stepPullWorld } from '../experiments/sinking-star-ss03/src/core.ts';
import { SS03_LEVELS } from '../experiments/sinking-star-ss03/src/levels.ts';
import { compileLevel as compileExchangeLevel, initialState as initialExchangeState, stepDetailed as stepExchangeWorld, terrainAt as exchangeTerrainAt } from '../experiments/sinking-star-ss04/src/core.ts';
import { SS04_LEVELS } from '../experiments/sinking-star-ss04/src/levels.ts';
import { compileLevel as compileCarryLevel, doorsOpen as carryDoorsOpen, initialState as initialCarryState, stepDetailed as stepCarryWorld } from '../experiments/sinking-star-ss05/src/core.ts';
import { SS05_LEVELS } from '../experiments/sinking-star-ss05/src/levels.ts';
import { compileLevel as compileActorLevel, initialState as initialActorState, stepDetailed as stepActorWorld, circuitPressed as actorCircuitPressed, gateClosed as actorGateClosed } from '../experiments/sinking-star-ss06/src/core.ts';
import { SS06_LEVELS } from '../experiments/sinking-star-ss06/src/levels.ts';
import { compileLevel as compileSetLevel, initialState as initialSetState, stepDetailed as stepSetWorld } from '../experiments/sinking-star-ss07/src/core.ts';
import { SS07_LEVELS } from '../experiments/sinking-star-ss07/src/levels.ts';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Contracts are per level. A high count elsewhere must never mask a loss.
// Reference pairs are [commands, commands executed after index zero].
const campaign = [
  [36, 17],
  [32, 22],
  [42, 20],
  [79, 58],
  [62, 14],
  [116, 59],
  [37, 23],
  [41, 30],
];
const requiredPhysical = {
  2: ['mirror', 'position'],
  3: ['crate', 'position'],
  4: ['crate', 'mirror', 'position'],
  5: ['crate', 'mirror'],
  6: ['crate', 'mirror', 'position'],
  7: ['crate', 'position'],
  8: ['crate', 'mirror', 'position'],
};
const sources = { AR25: 'move', HANO: 'click', DC22: 'mixed', SS02: 'move', SS03: 'move', SS04: 'move', SS05: 'move', SS06: 'move', SS07: 'move' };

function consecutiveStonePushes(level, tickets) {
  const world = compileLevel(SS02_LEVELS[level - 1]);
  let state = initialState(world), previous;
  const pairs = [];
  const crossed = new Set();
  const pushingFootings = new Set();
  let exitFooting;
  for (const [index, ticket] of tickets.entries()) {
    if (ticket.resets !== previous?.resets) state = initialState(world);
    const next = stepWorld(world, state, Number(ticket.action.slice(6)));
    if (next.supports.some(support => equal(support, next.hero))) crossed.add(`${next.hero.x},${next.hero.y}`);
    // The engine preserves stone order unless a stone is converted into a bridge.
    const moved = state.stones.length === next.stones.length
      ? state.stones.flatMap((stone, i) => equal(stone, next.stones[i]) ? [] : [i]) : [];
    if (state.supports.some(support => equal(support, state.hero))) {
      const footing = `${state.hero.x},${state.hero.y}`;
      if (moved.length || next.stones.length < state.stones.length) pushingFootings.add(footing);
      if (world.doors.some(door => equal(door, next.hero))) exitFooting = footing;
    }
    if (ticket.actionIndex > 0 && ticket.decisionRevision === previous?.revision
      && ticket.resets === previous.resets && moved.some(i => previous.moved.includes(i))) {
      pairs.push({ kind: 'stone', first: index, last: index + 1 });
    }
    previous = { revision: ticket.decisionRevision, resets: ticket.resets, moved };
    state = next;
  }
  assert.equal(state.complete, true, 'Executed SS02 L' + level + ' tickets do not reproduce the official goal');
  assert.ok(pairs.length, 'SS02 L' + level + ' lost consecutive pushes of the same stone');
  if (level >= 3) {
    assert.ok(crossed.size > 0 && state.supports.length > world.supports.length,
      'SS02 L' + level + ' did not build and traverse an immersed support');
    assert.ok(world.buttons.every(mark => state.stones.some(stone => equal(mark, stone))),
      'SS02 L' + level + ' did not leave a stone holding each pressure mark');
  }
  if (level === 5) {
    assert.ok(pushingFootings.size >= 2, 'SS02 L5 did not use separate supports as pushing stances');
    assert.ok(exitFooting && !pushingFootings.has(exitFooting), 'SS02 L5 did not cross a separate support into the exit gate');
  }
  return pairs;
}

function consecutiveStonePulls(level, tickets) {
  const world = compilePullLevel(SS03_LEVELS[level - 1]);
  let state = initialPullState(world), previous;
  const pairs = [];
  const usedPresses = new Set();
  const driver = level === 8 ? world.gates.findIndex(gate => gate.closedWhen === 'pressed'
    && world.gates.filter(other => other.circuit === gate.circuit).length === 1) : -1;
  const control = world.circuits.find(circuit => circuit.id === world.gates[driver]?.circuit)?.buttons[0];
  let released = false, longestStroke = 0;
  for (const [index, ticket] of tickets.entries()) {
    if (ticket.resets !== previous?.resets) state = initialPullState(world);
    const detail = stepPullWorld(world, state, Number(ticket.action.slice(6)));
    for (const phase of detail.phases) {
      if (phase.kind === 'piston' && phase.moves.some(move => move.actor === 'stone')) usedPresses.add(phase.gateIndex);
      if (control && phase.kind === 'pull') {
        released ||= phase.moves.some(move => move.actor === 'stone' && equal(move.from, control));
      }
      if (phase.kind === 'piston' && phase.gateIndex === driver) {
        longestStroke = Math.max(longestStroke, phase.moves.filter(move => move.actor === 'stone').length);
      }
    }
    const phase = detail.phases[0];
    const pull = detail.phases.length === 1 && phase?.kind === 'pull' ? phase.moves.find(move => move.actor === 'stone') : undefined;
    if (pull && previous?.pull && equal(previous.pull.to, pull.from)
      && ticket.actionIndex > 0 && ticket.decisionRevision === previous.revision && ticket.resets === previous.resets) {
      pairs.push({ kind: 'pull', first: index, last: index + 1 });
    }
    previous = { revision: ticket.decisionRevision, resets: ticket.resets, pull };
    state = detail.state;
  }
  assert.equal(state.complete, true, 'Executed SS03 L' + level + ' tickets do not reproduce the official goal');
  assert.ok(pairs.length, 'SS03 L' + level + ' lost consecutive pulls of the same stone');
  if (level === 7) {
    assert.equal(usedPresses.size, 2, 'SS03 L7 did not displace a stone with both presses');
    const exit = world.gates.find(gate => gate.closedWhen === 'released');
    const controls = world.circuits.find(circuit => circuit.id === exit?.circuit);
    assert.ok(controls?.buttons.every(mark => state.stones.some(stone => equal(mark, stone))), 'SS03 L7 did not hold the matched exit controls');
  }
  if (level === 8) {
    assert.ok(released, 'SS03 L8 did not release the initially held press control');
    assert.equal(longestStroke, world.stones.length, 'SS03 L8 did not drive the full file of stones');
    assert.equal(state.stones.length, world.stones.length, 'SS03 L8 lost a stone');
  }
  return pairs;
}

function measuredExchangeSeries(level, tickets) {
  const world = compileExchangeLevel(SS04_LEVELS[level - 1]);
  let state = initialExchangeState(world), previous;
  const entryResets = tickets[0]?.resets ?? 0;
  const mixed = [];
  let deaths = 0, threatExchanges = 0, crossedWater = false, openedWithWeight = false;
  let reflected = false, placed = [];
  const sharedControl = level === 7 ? world.circuits.find(circuit => circuit.buttons.length > 1)?.buttons : undefined;
  let builtFromWeight = 0;
  let reflectedTwice = false, observedRelay = false;
  for (const [index, ticket] of tickets.entries()) {
    if (ticket.resets !== (previous?.resets ?? entryResets)) {
      if (level === 4) assert.ok(state.dead, 'SS04 L4 reset without an observed loss');
      state = initialExchangeState(world);
    }
    const detail = stepExchangeWorld(world, state, Number(ticket.action.slice(6)));
    const kind = detail.phases[0]?.kind;
    if (level === 2) assert.ok(kind === 'walk' || kind === 'swap', 'SS04 L2 used a blocked or speculative action');
    if (level === 4) {
      if (detail.state.dead) deaths++;
      if (kind === 'swap' && !detail.state.dead && detail.phases[0].moves.some(move => move.actor === 'monster')) threatExchanges++;
      if (ticket.resets > entryResets) assert.ok(kind && !detail.state.dead, 'SS04 L4 recovery used an ineffective or fatal arrival');
    }
    if (level === 5) {
      assert.ok(kind === 'walk' || kind === 'swap', 'SS04 L5 used a blocked or speculative action');
      crossedWater ||= kind === 'swap' && detail.phases[0].ray.some(cell => exchangeTerrainAt(world, cell) === '~');
      if (kind === 'swap' && !openedWithWeight && world.buttons.every(mark => detail.state.stones.some(stone => equal(mark, stone)))) {
        openedWithWeight = true;
        mixed.push({ kind: 'load the pressure control', first: index + 1, last: index + 1 });
      }
    }
    if (level === 6) {
      assert.ok(kind === 'walk' || kind === 'swap', 'SS04 L6 used a blocked or speculative action');
      reflected ||= kind === 'swap' && detail.phases[0].ray.some(cell => world.mirrors.some(mirror => equal(mirror.at, cell)));
      const covered = world.buttons.filter(mark => detail.state.stones.some(stone => equal(mark, stone)));
      assert.ok(placed.every(mark => covered.includes(mark)), 'SS04 L6 removed a weight before completing the pressure circuit');
      if (covered.length > placed.length) mixed.push({ kind: 'load a circuit control', first: index + 1, last: index + 1 });
      placed = covered;
    }
    if (level === 7) {
      assert.ok((kind === 'walk' || kind === 'swap') && !detail.state.dead, 'SS04 L7 used an ineffective or unsafe action');
      const constructed = detail.state.supports.length - state.supports.length;
      if (constructed > 0) {
        assert.ok(detail.phases.some(phase => phase.kind === 'piston' && phase.moves.some(move => move.actor === 'stone')),
          'SS04 L7 created a foothold without a witnessed press');
        assert.equal(state.stones.length - detail.state.stones.length, constructed);
        builtFromWeight += constructed;
        mixed.push({ kind: 'press a weight into water', first: index + 1, last: index + 1 });
      }
    }
    if (level === 8) {
      assert.ok((kind === 'walk' || kind === 'swap') && !detail.state.dead, 'SS04 L8 used an ineffective or unsafe action');
      observedRelay ||= detail.phases.filter(phase => phase.kind === 'piston').length > 1
        && detail.state.supports.length > state.supports.length;
      if (kind === 'swap' && detail.phases[0].ray.filter(cell => world.mirrors.some(mirror => equal(mirror.at, cell))).length >= 2) {
        reflectedTwice = true;
        mixed.push({ kind: 'exchange via two mirrors', first: index + 1, last: index + 1 });
      }
    }
    if (kind === 'swap' && previous?.kind === 'walk' && previous.revision === ticket.decisionRevision && ticket.actionIndex > 0) {
      assert.ok(detail.phases[0].moves.some(move => move.actor !== 'hero' && equal(move.to, state.hero)), 'Expected a real exchange');
      mixed.push({ kind: 'walk then swap', first: index, last: index + 1 });
    }
    previous = { kind, revision: ticket.decisionRevision, resets: ticket.resets };
    state = detail.state;
  }
  assert.equal(state.complete, true, 'Executed SS04 L' + level + ' tickets do not reproduce the official goal');
  assert.ok(mixed.some(step => step.kind === 'walk then swap'), 'SS04 L' + level + ' lost continuous positioning into an exchange');
  if (level === 2) {
    assert.ok(world.buttons.every(mark => state.stones.some(stone => equal(mark, stone))), 'SS04 L2 did not hold the pressure control');
  }
  if (level === 4) {
    assert.ok(deaths <= 1 && deaths === previous?.resets - entryResets, 'SS04 L4 failed to retain its first loss across reset');
    assert.ok(threatExchanges > 0, 'SS04 L4 did not exchange with a threat and survive');
  }
  if (level === 5) {
    assert.ok(crossedWater && openedWithWeight, 'SS04 L5 must exchange across water and activate the pressure control with the weight');
    assert.ok(world.buttons.every(mark => state.stones.some(stone => equal(mark, stone))), 'SS04 L5 lost the weight on the pressure control before the goal');
  }
  if (level === 6) {
    assert.ok(reflected && placed.length === world.buttons.length, 'SS04 L6 did not compose mirror exchanges with the full pressure circuit');
  }
  if (level === 7) {
    assert.equal(builtFromWeight, 2, 'SS04 L7 must build both footholds with the presses');
    assert.ok(sharedControl?.length === 2 && sharedControl.every(mark => [...state.stones, ...state.monsters].some(body => equal(mark, body))),
      'SS04 L7 did not keep the shared pressure circuit active');
    assert.ok(sharedControl.some(mark => state.stones.some(body => equal(mark, body)))
      && sharedControl.some(mark => state.monsters.some(body => equal(mark, body))), 'SS04 L7 must use the crate and monster together');
  }
  if (level === 8) {
    assert.ok(observedRelay && reflectedTwice, 'SS04 L8 lost the revealed relay or the exchange via two mirrors');
  }
  return mixed;
}

function measuredCarrySeries(level, tickets) {
  const world = compileCarryLevel(SS05_LEVELS[level - 1]);
  let state = initialCarryState(world), previous, firstCarry;
  let openedWithWeight = false, reflectedWeight = false;
  let separatedWeight = false, crossedOpenGate = false;
  let boardedFrom, crossings = 0, repositioned = 0;
  let firstReflection, heldFinalGate = false;
  const bank = (from, to) => {
    const queue = [from], seen = new Set([from.y * 20 + from.x]);
    for (const point of queue) {
      if (equal(point, to)) return true;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const x = point.x + dx, y = point.y + dy, key = y * 20 + x;
        if (x >= 0 && x < 20 && y >= 0 && y < 20 && world.terrain[key] === '.' && !seen.has(key)) {
          seen.add(key); queue.push({ x, y });
        }
      }
    }
    return false;
  };
  const series = [];
  for (const [index, ticket] of tickets.entries()) {
    const result = stepCarryWorld(world, state, Number(ticket.action.slice(6)));
    const phase = result.phases[0];
    const moves = (phase?.moves ?? []).filter(move => move.actor === 'stone');
    const continued = previous?.revision === ticket.decisionRevision && ticket.actionIndex > 0;
    if (level === 5) {
      assert.equal(result.state.stones.length, world.stones.length, 'SS05 L5 consumed the required weight');
      if (phase?.kind === 'reflect') {
        assert.ok(continued, 'SS05 L5 separated the approach from the useful reflection');
        reflectedWeight ||= moves.length > 0;
        series.push({ kind: moves.length ? 'reflect the preserved movable weight' : 'reflect to another route', first: index, last: index + 1 });
      }
      openedWithWeight ||= !carryDoorsOpen(world, state) && carryDoorsOpen(world, result.state)
        && result.state.stones.some(stone => world.buttons.some(button => equal(stone, button)));
    }
    if (level === 6) {
      assert.equal(result.state.stones.length, world.stones.length, 'SS05 L6 consumed the required weight');
      const opened = carryDoorsOpen(world, state);
      if (phase?.kind === 'reflect') {
        const apart = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 2;
        if (moves.some(move => !apart(state.hero, move.from) && apart(result.state.hero, move.to))) {
          assert.ok(continued, 'SS05 L6 should reflect the weight out of range in the same series');
          separatedWeight = true;
          series.push({ kind: 'separate the weight from the controller through reflection', first: index, last: index + 1 });
        }
        if (opened && phase.paths?.some(path => path.some(cell => world.doors.some(door => equal(cell, door))))) {
          crossedOpenGate = true;
          series.push({ kind: 'reflect through the activated gate', first: index + 1, last: index + 1 });
        }
      }
      openedWithWeight ||= !opened && carryDoorsOpen(world, result.state)
        && result.state.stones.some(stone => world.buttons.some(button => equal(stone, button)));
    }
    const supports = (phase?.moves ?? []).filter(move => move.actor === 'support');
    if (level === 7) {
      const standing = state.supports.some(spot => equal(spot, state.hero));
      const landed = result.state.supports.some(spot => equal(spot, result.state.hero));
      if (!standing && landed) {
        assert.ok(continued, 'SS05 L7 must board the support in a continuous route');
        boardedFrom = state.hero;
      }
      if (standing && !landed && boardedFrom && !bank(boardedFrom, result.state.hero)) {
        crossings++;
        series.push({ kind: 'cross to another bank using the support', first: index, last: index + 1 });
      }
      if (continued && supports.some(move => previous.supports.some(prior => equal(prior.to, move.from)))) {
        repositioned++;
        series.push({ kind: 'slide the same floating support', first: index, last: index + 1 });
      }
    }
    if (level === 8 && phase?.kind === 'reflect' && phase.moves.some(move => move.actor === 'hero')) {
      firstReflection ??= index + 1;
      const gate = world.gates.find(item => item.circuit === 'final');
      const mark = world.circuits.find(item => item.id === gate.circuit).buttons[0];
      if (phase.paths?.some(path => path.some(cell => equal(cell, gate.at)))) {
        assert.ok(continued, 'SS05 L8 lost the continuous approach to the final reflection');
        heldFinalGate ||= [...state.stones, ...state.monsters].some(cell => equal(cell, mark))
          && !state.gateClosed[world.gates.indexOf(gate)];
      }
      series.push({ kind: 'reflect onto a supported landing', first: index + 1, last: index + 1 });
    }
    if (level === 3 && state.monsters.length - result.state.monsters.length === 2) {
      assert.ok(continued && result.phases.some(phase => phase.kind === 'combat'), 'SS05 L3 lost the deliberate continuous contact');
      series.push({ kind: 'compose the two moving objects', first: index, last: index + 1 });
    }
    if (level === 4 && !carryDoorsOpen(world, state) && carryDoorsOpen(world, result.state)
      && result.state.monsters.some(monster => world.buttons.some(button => equal(button, monster)))) {
      assert.ok(continued && phase?.moves.some(move => move.actor === 'monster'
        && world.buttons.some(button => equal(button, move.to))), 'SS05 L4 lost the continuous placement that opens the exit');
      series.push({ kind: 'place the moving object on the control and open access', first: index, last: index + 1 });
    }
    if (moves.length && !firstCarry) {
      firstCarry = index + 1;
      if (level === 2) {
        assert.ok(continued && previous.kind === 'walk', 'SS05 L2 must approach the first weight and carry it in the same series');
        assert.ok(moves.some(move => equal(move.from, world.stones[0])), 'SS05 L2 bypassed the first accessible weight');
      }
    }
    if (level < 3 && continued && moves.some(move => previous.moves.some(prior => equal(prior.to, move.from)))) {
      series.push({ kind: 'carry the same weight', first: index, last: index + 1 });
    }
    if (level < 3 && continued && moves.length && previous.kind === 'walk') {
      series.push({ kind: 'approach then carry', first: index, last: index + 1 });
    }
    assert.ok(!result.state.dead, 'SS05 lost the actor during the carry');
    previous = { revision: ticket.decisionRevision, kind: phase?.kind, moves, supports };
    state = result.state;
  }
  assert.ok(state.complete, 'SS05 executed tickets do not reach the exit');
  if (level === 5) {
    assert.ok(openedWithWeight && reflectedWeight && series.length >= 3, 'SS05 L5 must use the preserved weight to restore access');
    return series;
  }
  if (level === 6) {
    assert.ok(separatedWeight && openedWithWeight && crossedOpenGate, 'SS05 L6 must separate the weight, activate the control group and reflect through');
    return series;
  }
  if (level === 7) {
    assert.ok(crossings >= 2 && repositioned >= 2, 'SS05 L7 must reposition and cross both supports');
    return series;
  }
  if (level === 8) {
    assert.ok(firstReflection <= 22 && series.length >= 2, 'SS05 L8 delayed or abandoned the verified reflections');
    assert.ok(heldFinalGate, 'SS05 L8 must keep the final gate open with an object while reflecting through');
    return series;
  }
  if (level === 3 || level === 4) {
    assert.equal(series.length, 1, 'SS05 did not execute the expected object composition');
    return series;
  }
  assert.ok(series.some(step => step.kind === 'carry the same weight'), 'SS05 lost consecutive moves of the same weight');
  assert.equal(firstCarry, level === 1 ? 1 : 5, 'SS05 delayed the first useful carry');
  return series;
}

function measureActorComposition(issued) {
  const world = compileActorLevel(SS06_LEVELS[0]);
  let state = initialActorState(world);
  const firstPush = new Map();
  const transfers = new Map();
  const events = [];
  for (const [index, ticket] of issued.entries()) {
    const result = stepActorWorld(world, state, Number(ticket.action.slice(6)), ticket.data);
    const active = state.heroes[state.active].kind;
    const phase = result.phases[0];
    if ((phase?.kind === 'push' || phase?.kind === 'reflect') && phase.moves.length) {
      if (phase.kind === 'push' && phase.moves.some(move => move.actor === 'stone')) {
        if (!firstPush.has(active)) firstPush.set(active, index + 1);
        if (phase.moves.filter(move => move.actor === 'stone').length > 1
          && result.state.supports.length > state.supports.length) {
          events.push({kind: 'push a row to create support', first: index + 1, last: index + 1});
        }
      } else if (phase.kind === 'reflect' && phase.moves.some(move => move.actor === 'hero')) {
        if (!transfers.has(active)) transfers.set(active, index + 1);
      }
    }
    state = result.state;
  }
  assert.equal(state.complete, true, 'SS06 must stand both actor roles on destinations together');
  assert.ok(firstPush.get('merchant') <= 12 && firstPush.get('warrior') <= 20,
    'SS06 must test contact promptly for each controllable actor');
  assert.equal(transfers.size, 2, 'SS06 must use the observed transfer with both actors');
  assert.ok(events.length, 'SS06 must use the distinct line-push capacity to create access');
  return [
    ...[...firstPush].map(([role,index]) => ({kind: 'test push with ' + role, first: index, last: index})),
    ...events,
    ...[...transfers].map(([role,index]) => ({kind: 'use transfer with ' + role, first: index, last: index})),
  ];
}
function measureJointActorTransfer(issued) {
  const world = compileActorLevel(SS06_LEVELS[1]);
  let state = initialActorState(world);
  const preparations = new Map();
  let released = null, joint = null, chained = false;
  assert.equal(issued[0]?.actorPlan?.strategy, 'prepare_transfer_by_moving_reflector',
    'SS06 L2 must start by preparing a transfer using the learned controls');
  assert.ok(issued.every(ticket => ticket.actorPlan && ticket.actorPlan.strategy !== 'calibrate_actor_action'),
    'SS06 L2 recalibrated controls instead of using previously observed roles');
  for (const [i, ticket] of issued.entries()) {
    const result = stepActorWorld(world, state, Number(ticket.action.slice(6)), ticket.data);
    for (const phase of result.phases) {
      if (phase.kind === 'push' && phase.moves.some(move => move.actor === 'mirror')) {
        const role = state.heroes[state.active].kind;
        assert.equal(ticket.actorPlan.strategy, 'prepare_transfer_by_moving_reflector');
        assert.ok(ticket.actorPlan.evidence.some(ref => /:epoch:1:revision:(?:[6-9]|[1-9][0-9]+):/.test(ref)),
          'Mirror preparation must cite a role effect learned in L1');
        preparations.set(role, i + 1);
        chained ||= phase.moves.some(move => move.actor === 'stone');
      } else if (phase.kind === 'piston' && phase.moves.some(move => move.actor === 'stone')) {
        released = i + 1;
      } else if (phase.kind === 'reflect' && phase.moves.filter(move => move.actor === 'hero').length === 2) {
        assert.equal(ticket.actorPlan.strategy, 'compose_simultaneous_observed_transfers');
        joint = i + 1;
      }
    }
    state = result.state;
  }
  assert.equal(state.complete, true, 'SS06 L2 must reach both destinations');
  assert.equal(preparations.size, 2, 'Both learned actor roles must reposition a reflector');
  assert.ok(chained && released && joint && joint > released, 'The chain and linked release must precede the joint transfer');
  return [...[...preparations].map(([role,i])=>({kind:'prepare reflector with '+role,first:i,last:i})),
    {kind:'clear a transfer ray with the linked gate',first:released,last:released},
    {kind:'transfer both actors together',first:joint,last:joint}];
}


function measureLinkedGateRelay(issued) {
  const world=compileActorLevel(SS06_LEVELS[2]);
  let state=initialActorState(world);
  let firstChain=null,firstPress=null,firstUsefulReflection=null;
  const toggled=new Set();
  assert.ok(issued.every(ticket=>ticket.actorPlan&&ticket.actorPlan.strategy!=='calibrate_actor_action'),
    'SS06 L3 must keep the observed actor controls');
  for(const [i,ticket] of issued.entries()){
    const result=stepActorWorld(world,state,Number(ticket.action.slice(6)),ticket.data);
    if(ticket.actorPlan.strategy==='test_reachable_chain_composition'
      &&result.phases.some(phase=>phase.kind==='push'&&phase.moves.filter(move=>move.actor==='stone').length>=2)){
      firstChain??=i+1;
      assert.ok(ticket.actorPlan.evidence.some(ref=>/:epoch:1:revision:(?:[6-9]|[1-9][0-9]+):/.test(ref)),
        'The chain attempt must reuse a prior role effect');
    }
    if(ticket.actorPlan.strategy==='test_reachable_pressure_composition'
      &&!actorCircuitPressed(world,state,world.circuits[0].id)&&actorCircuitPressed(world,result.state,world.circuits[0].id)){
      firstPress??=i+1;
      assert.ok(ticket.actorPlan.evidence.some(ref=>/:epoch:2:revision:/.test(ref)),
        'The new pressure experiment must cite the previously witnessed gate reaction');
    }
    if(result.phases.some(phase=>phase.kind==='reflect'&&phase.moves.length)){
      firstUsefulReflection??=i+1;
      assert.ok(ticket.actorPlan.evidence.some(ref=>/:epoch:1:revision:/.test(ref)),
        'Relay activation must cite evidence from before the current level');
    }
    for(const gate of world.gates.keys()){
      if(actorGateClosed(world,state,gate)!==actorGateClosed(world,result.state,gate))toggled.add(gate);
    }
    state=result.state;
  }
  assert.ok(firstChain!==null&&firstChain<=5,'SS06 L3 must physically test the reachable row promptly');
  assert.ok(firstPress!==null&&firstPress<=10,'SS06 L3 must physically test the reachable button promptly');
  assert.ok(firstUsefulReflection&&toggled.size>=2&&state.complete,
    'SS06 L3 must compose verified reflection and linked gate access through official completion');
  return [
    {kind:'test reachable row',first:firstChain,last:firstChain},
    {kind:'test reachable pressure mark',first:firstPress,last:firstPress},
    {kind:'activate witnessed transport',first:firstUsefulReflection,last:firstUsefulReflection},
  ];
}



function measureBypassWithStackedSupport(issued) {
  const world=compileActorLevel(SS06_LEVELS[3]);
  let state=initialActorState(world), firstExtension=null, layeredLoad=null, beforeMovedBack=null;
  let direction=null, traversed=false, lead=null;
  const matches=(a,b)=>equal(a,b);
  assert.ok(issued.every(ticket=>ticket.actorPlan&&ticket.actorPlan.strategy!=='calibrate_actor_action'),
    'SS06 L4 must use observed control roles without recalibrating them');
  for(const [i,ticket] of issued.entries()){
    const result=stepActorWorld(world,state,Number(ticket.action.slice(6)),ticket.data);
    const phase=result.phases[0], moves=phase?.moves??[];
    if(ticket.actorPlan.strategy==='test_extended_chain_capacity'&&phase?.kind==='push'
      &&moves.filter(move=>move.actor==='stone').length>=4){
      const movement=moves.find(move=>move.actor==='hero');
      assert.ok(ticket.actorPlan.evidence.some(ref=>/:epoch:1:revision:/.test(ref)),
        'The long push must be an extension of an observed role');
      assert.ok(movement);
      direction={x:movement.to.x-movement.from.x,y:movement.to.y-movement.from.y};
      lead=state.heroes[state.active].kind;
      firstExtension??=i+1;
    }
    if(['reflect','push'].includes(phase?.kind)&&moves.some(move=>move.actor==='stone'
      &&state.supports.some(p=>matches(p,move.to))&&result.state.stones.some(p=>matches(p,move.to)))){
      layeredLoad??=i+1;
    }
    if(direction&&lead===state.heroes[state.active].kind){
      if(moves.some(move=>move.actor==='hero'&&state.supports.some(p=>matches(p,move.to))))traversed=true;
      if(traversed&&moves.some(move=>move.actor==='mirror'
        &&(move.to.x-move.from.x)*direction.x+(move.to.y-move.from.y)*direction.y<0)){
        beforeMovedBack??=i+1;
      }
    }
    state=result.state;
  }
  assert.ok(firstExtension!==null&&firstExtension<=6,'SS06 L4 skipped the reachable longer chain');
  assert.ok(layeredLoad&&beforeMovedBack&&traversed&&state.complete,
    'SS06 L4 must use a load on an existing support and reach the other side of the mirror');
  return [
    {kind:'test longer reachable chain',first:firstExtension,last:firstExtension},
    {kind:'land transportable load on an established support',first:layeredLoad,last:layeredLoad},
    {kind:'cross supports and push from behind the reflector',first:beforeMovedBack,last:beforeMovedBack},
  ];
}


function measureSharedPressureTransport(issued) {
  const world=compileActorLevel(SS06_LEVELS[4]);
  const circuit=world.circuits.find(group=>group.buttons.length>2);
  assert.ok(circuit);
  let state=initialActorState(world), piston, pressing, transport, carry, previous;
  assert.ok(issued.every(ticket=>ticket.actorPlan&&ticket.actorPlan.strategy!=='calibrate_actor_action'),
    'SS06 L5 must reuse the observed action and actor roles');
  for(const [i,ticket] of issued.entries()){
    const {state:after,phases}=stepActorWorld(world,state,Number(ticket.action.slice(6)),ticket.data);
    const loadMoves=phases.filter(phase=>phase.kind==='push').flatMap(phase=>phase.moves.filter(move=>move.actor==='stone'));
    if(phases.some(phase=>phase.kind==='piston'&&phase.moves.some(move=>move.actor==='mirror')))piston??=i+1;
    if(ticket.actionIndex>0&&previous?.revision===ticket.decisionRevision
      &&loadMoves.some(move=>previous.loads.some(load=>equal(move.from,load))))carry??=i+1;
    const warrior=after.heroes.find(actor=>actor.kind==='warrior');
    if(!actorCircuitPressed(world,state,circuit.id)&&actorCircuitPressed(world,after,circuit.id)
      &&circuit.buttons.some(cell=>equal(warrior.at,cell))
      &&circuit.buttons.some(cell=>after.stones.some(stone=>equal(stone,cell))))pressing??=i+1;
    if(phases.some(phase=>phase.kind==='reflect'&&phase.moves.filter(move=>move.actor==='hero').length===2))transport??=i+1;
    previous={revision:ticket.decisionRevision,loads:loadMoves.map(move=>move.to)};
    state=after;
  }
  assert.ok(piston&&carry&&pressing&&transport>pressing&&state.complete,
    'SS06 L5 must align a reflector, push a load in series, press the shared circuit and transfer both actors');
  return [[piston,'align reflector by piston'],[carry,'carry the same load during a prefix'],
    [pressing,'press the shared circuit'],[transport,'transfer both actors jointly']]
    .map(([action,kind])=>({kind,first:action,last:action}));
}

function measureReleasedControlCrossing(issued) {
  const world=compileActorLevel(SS06_LEVELS[5]);
  let state=initialActorState(world), continuousAlignment;
  const crossings=new Map(), usedFootings=new Set(), createdFootings=new Set();
  const releases=[];
  assert.ok(issued.every(ticket=>ticket.actorPlan&&ticket.actorPlan.strategy!=='calibrate_actor_action'),
    'SS06 L6 must reuse the learned actors and trigger');
  for(const [i,ticket] of issued.entries()){
    const {state:after,phases}=stepActorWorld(world,state,Number(ticket.action.slice(6)),ticket.data);
    const moved=phases.filter(phase=>phase.kind==='reflect').flatMap(phase=>phase.moves);
    if(ticket.actionIndex>0&&phases.some(phase=>phase.kind==='push'&&phase.moves.some(move=>move.actor==='mirror')))
      continuousAlignment??=i+1;
    for(const move of moved.filter(item=>item.actor==='monster')){
      const gate=world.gates.findIndex(item=>world.circuits.some(circuit=>circuit.id===item.circuit
        &&circuit.buttons.some(button=>equal(button,move.from))));
      if(gate>=0&&actorGateClosed(world,state,gate)&&!actorGateClosed(world,after,gate)){
        assert.equal(ticket.actorPlan.strategy,'transfer_subject_off_linked_control');
        assert.ok(ticket.actorPlan.evidence.some(ref=>/:epoch:1:revision:/.test(ref)),
          'The release must use evidence for the previously observed transfer');
        releases.push(i+1);
      }
    }
    if(after.supports.length>state.supports.length){
      assert.equal(releases.length,world.gates.length,'SS06 L6 consumed a load before releasing its controls');
      for(const cell of after.supports.filter(cell=>!state.supports.some(old=>equal(cell,old))))createdFootings.add(JSON.stringify(cell));
    }
    for(const move of moved.filter(item=>item.actor==='hero')){
      const actor=state.heroes.find(hero=>equal(hero.at,move.from));
      if(actor&&releases.length===world.gates.length&&!crossings.has(actor.kind))crossings.set(actor.kind,i+1);
    }
    for(const hero of after.heroes)if(after.supports.some(cell=>equal(hero.at,cell)))usedFootings.add(JSON.stringify(hero.at));
    state=after;
  }
  assert.ok(releases.length===world.gates.length&&releases.at(-1)<=10&&continuousAlignment&&crossings.size===state.heroes.length&&state.complete,
    'SS06 L6 must release the controls and carry both actors through verified reflections');
  assert.ok([...createdFootings].every(cell=>usedFootings.has(cell)),'SS06 L6 sacrificed a load on an unused foothold');
  return [[continuousAlignment,'position the reflector in series'],[releases[0],'release the first occupied control'],
    [releases[1],'release the second occupied control'],...[...crossings.values()].map(action=>[action,'reflect an actor through the open access'])]
    .map(([action,kind])=>({kind,first:action,last:action}));
}

function measureBridgeToReflector(issued) {
  const world=compileActorLevel(SS06_LEVELS[6]);
  let state=initialActorState(world), held, firstChain, layered, cleared, approach, push;
  const dryByActor=new Map(), created=new Set(), used=new Set(), reflected=new Set();
  const cell=point=>[point.x,point.y].join(',');
  assert.ok(issued.every(ticket=>ticket.actorPlan&&ticket.actorPlan.strategy!=='calibrate_actor_action'),
    'SS06 L7 must reuse controls and learned mobility');
  for(const [index,ticket] of issued.entries()){
    const order=index+1, active=state.heroes[state.active].kind;
    const {state:after,phases}=stepActorWorld(world,state,Number(ticket.action.slice(6)),ticket.data);
    const loads=phases.filter(phase=>phase.kind==='push').flatMap(phase=>phase.moves.filter(move=>move.actor==='stone'));
    if(ticket.actorPlan.strategy==='hold_relay_gate_with_observed_load'&&loads.length>1&&active==='warrior'&&ticket.actionIndex>0){
      assert.ok(ticket.actorPlan.evidence.some(ref=>/:epoch:1:revision:/.test(ref)),
        'The opening composition must reuse the observed controls');
      firstChain??=order;
    }
    if(loads.some(move=>state.supports.some(support=>equal(support,move.to))&&after.stones.some(stone=>equal(stone,move.to)))){
      layered??=order;
    }
    if(!held)for(const [index,gate] of world.gates.entries()){
      if(!actorGateClosed(world,state,index)||actorGateClosed(world,after,index))continue;
      const reserved=world.circuits.find(circuit=>circuit.id===gate.circuit)?.buttons
        .find(button=>loads.some(move=>equal(move.to,button))&&after.stones.some(stone=>equal(stone,button)));
      if(reserved){held={cell:reserved,gate:index,order};break;}
    }
    if(held)assert.ok(after.stones.some(stone=>equal(stone,held.cell))&&!actorGateClosed(world,after,held.gate),
      'SS06 L7 must keep the loaded gate open while spending other weights on access');
    if(phases.some(phase=>phase.kind==='piston'&&phase.moves.some(move=>move.actor==='monster'))
      &&after.monsters.length<state.monsters.length)cleared??=order;
    for(const tile of after.supports)if(!state.supports.some(old=>equal(old,tile)))created.add(cell(tile));
    for(const hero of after.heroes)if(created.has(cell(hero.at))){
      dryByActor.set(hero.kind,order);
      used.add(cell(hero.at));
    }
    if(phases.some(phase=>phase.kind==='push'&&phase.moves.some(move=>move.actor==='mirror'))&&dryByActor.has(active)){
      approach??=dryByActor.get(active);
      push??=order;
    }
    for(const move of phases.filter(phase=>phase.kind==='reflect').flatMap(phase=>phase.moves).filter(move=>move.actor==='hero')){
      const actor=state.heroes.find(hero=>equal(hero.at,move.from));
      if(actor&&cleared&&push)reflected.add(actor.kind);
    }
    state=after;
  }
  assert.ok(firstChain&&held&&layered&&cleared&&approach&&push&&state.complete&&reflected.size===state.heroes.length,
    'SS06 L7 must hold the gate, test a separate control, extend footing, reach and reposition the mirror and cross with both actors');
  assert.ok(created.size>0&&[...created].every(tile=>used.has(tile)),'SS06 L7 must use the footholds it makes');
  return [[firstChain,'push the known row in series'],[held.order,'hold the gate with a load'],
    [cleared,'release the independent actuator'],[layered,'move a load over established footing'],[approach,'walk over new footing'],
    [push,'reposition the reflector after crossing']]
    .map(([action,kind])=>({kind,first:action,last:action}));
}

function measureWeightedPlatformCrossing(issued) {
  const world=compileActorLevel(SS06_LEVELS[7]);
  const anchor=world.circuits.find(circuit=>world.platforms.filter(mark=>mark.circuit===circuit.id).every(mark=>mark.activeWhen==='pressed'));
  const alternating=world.circuits.find(circuit=>new Set(world.platforms.filter(mark=>mark.circuit===circuit.id).map(mark=>mark.activeWhen)).size>1);
  assert.ok(anchor&&alternating);
  assert.ok(issued.every(ticket=>ticket.actorPlan&&ticket.actorPlan.strategy!=='calibrate_actor_action'
    &&ticket.actorPlan.strategy!=='verify_transfer_of_control'),'SS06 L8 must reuse a known role after the roster shrinks');
  let state=initialActorState(world), pressureTransfer, mirrorInSeries, firstToggle, secondToggle, platformWalk;
  for(const [index,ticket] of issued.entries()){
    const order=index+1, {state:after,phases}=stepActorWorld(world,state,Number(ticket.action.slice(6)),ticket.data);
    const reflected=phases.filter(phase=>phase.kind==='reflect').flatMap(phase=>phase.moves).filter(move=>move.actor==='stone');
    if(world.buttons.every(button=>reflected.some(move=>equal(move.to,button)))){
      assert.equal(ticket.actorPlan.strategy,'reflect_loads_onto_linked_controls');
      assert.ok(ticket.actorPlan.evidence.some(ref=>/:epoch:1:revision:/.test(ref)),'Use the witnessed reflection trigger');
      pressureTransfer??=order;
    }
    if(pressureTransfer){
      assert.ok(anchor.buttons.every(button=>after.stones.some(stone=>equal(stone,button))),
        'Keep the permanent bridge load in place throughout alternating transfers');
      if(ticket.actionIndex>0&&phases.some(phase=>phase.kind==='push'&&phase.moves.some(move=>move.actor==='mirror')))
        mirrorInSeries??=order;
      const before=actorCircuitPressed(world,state,alternating.id), pressed=actorCircuitPressed(world,after,alternating.id);
      if(reflected.length&&before&&!pressed)firstToggle??=order;
      if(reflected.length&&!before&&pressed&&firstToggle)secondToggle??=order;
      if(phases.some(phase=>phase.kind==='walk'&&phase.moves.some(move=>world.platforms.some(mark=>equal(move.to,mark.at)))))
        platformWalk??=order;
    }
    state=after;
  }
  assert.ok(pressureTransfer&&mirrorInSeries&&platformWalk&&firstToggle&&secondToggle&&state.complete,
    'SS06 L8 must compose loading two controls, guarding one while alternating the other, and traverse the platforms');
  return [[pressureTransfer,'reflect both loads onto controls'],[mirrorInSeries,'push the ray blocker in series'],
    [platformWalk,'cross the observed platforms'],[firstToggle,'unload the alternating control'],[secondToggle,'load it again']]
    .map(([action,kind])=>({kind,first:action,last:action}));
}

function measureDestinationSet(issued) {
  const world=compileSetLevel(SS07_LEVELS[0]);
  let state=initialSetState(world), firstPull, crossing, reflection, arrangement;
  for(const [index,ticket] of issued.entries()){
    const {state:after,phases}=stepSetWorld(world,state,Number(ticket.action.slice(6)),ticket.data);
    if(phases.some(phase=>phase.kind==='pull'&&phase.moves.some(move=>move.actor==='stone')))firstPull??=index+1;
    if(phases.some(phase=>phase.moves.some(move=>move.actor==='hero'&&state.supports.some(cell=>equal(cell,move.to)))))crossing??=index+1;
    if(phases.some(phase=>phase.kind==='reflect'&&phase.moves.some(move=>move.actor==='hero')))reflection??=index+1;
    if(after.complete&&world.goals.every(goal=>after.heroes.some(hero=>equal(goal,hero.at)))){
      assert.ok(ticket.actorPlan?.strategy==='compose_group_destination_after_access'
        ||ticket.actorPlan?.strategy==='test_complete_destination_arrangement');
      assert.equal(ticket.actorPlan.subjects.length,world.goals.length,'Track the whole destination criterion');
      arrangement=index+1;
    }
    state=after;
  }
  assert.ok(firstPull&&crossing&&reflection&&arrangement,'SS07 L1 needs the observed pull, prepared access, transport and complete placement');
  return [[firstPull,'learn an available withdrawal'],[crossing,'walk on prepared access'],[reflection,'reflect a participant to the reachable side'],
    [arrangement,'occupy all destinations in the same settled state']]
    .map(([action,kind])=>({kind,first:action,last:action}));
}

export function checkRun(run) {
  const { code, executedTickets: tickets, levels } = run;
  const reference = code === 'SS01' ? campaign : null;
  assert.ok(reference || code in sources, 'Unexpected game ' + code);
  assert.equal(run.solver, 'sic');
  assert.ok(Array.isArray(tickets) && tickets.length > 0, 'Missing executed tickets');
  assert.equal(tickets.length, run.sic);
  assert.equal(tickets.length, run.issued);
  const campaignLengths = { SS02: 6, SS03: 8, SS04: 8, SS05: 8, SS06: 8 };
  assert.equal(levels.length, reference?.length ?? campaignLengths[code] ?? 1, code + ' incomplete campaign');
  assert.equal(
    tickets.length,
    levels.reduce((n, l) => n + l.actions, 0),
  );
  const result = [];
  for (const [i, row] of levels.entries()) {
    assert.equal(row.level, i + 1);
    assert.equal(row.won, true, code + ' L' + row.level + ' failed to win');
    const issued = tickets.filter((t) => t.level === row.level);
    assert.equal(issued.length, row.actions);
    if (code === 'SS02' && row.level > 1) {
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS02 must preserve learned access without resetting');
      assert.equal(issued[1]?.decisionRevision, issued[0]?.decisionRevision,
        'SS02 L' + row.level + ' must begin with a plan from the learned controls');
      if (row.level === 6) assert.ok(issued.length <= 110, 'SS02 L6 exceeded its verified action ceiling');
    }
    const groups = new Map();
    let last;
    for (const t of issued) {
      assert.ok(
        Number.isInteger(t.decisionRevision) && /^ACTION[1-7]$/.test(t.action),
        'Missing native command identity',
      );
      if (!groups.has(t.decisionRevision)) groups.set(t.decisionRevision, []);
      else assert.equal(last, t.decisionRevision, 'A sealed decision resumed later');
      const group = groups.get(t.decisionRevision);
      assert.equal(t.actionIndex, group.length, 'Unexpected step inside decision');
      group.push(t);
      last = t.decisionRevision;
    }
    const lengths = [],
      kinds = new Set();
    for (const group of groups.values()) {
      assert.ok(group.length <= 16, 'More than 16 commands under one decision');
      for (const t of group.slice(0, -1)) assert.equal(t.sealed, null, 'Reconciliation before end of series');
      assert.equal(group.at(-1).sealed, group.length, 'Missing final reconciliation of actual commands');
      if (group.length < 2) continue;
      lengths.push(group.length);
      const clicks = group.filter((t) => t.action === 'ACTION6').length;
      kinds.add(clicks === group.length ? 'click' : clicks ? 'mixed' : 'move');
    }
    const continued = issued.length - groups.size;
    if (reference) {
      const [actions, minContinued] = reference[i];
      assert.ok(
        continued >= Math.min(issued.length - 1, Math.ceil((minContinued * issued.length) / actions)),
        code + ' L' + row.level + ' lost executed continuity (' + continued + '/' + issued.length + ')',
      );
    } else assert.ok(kinds.has(sources[code]), code + ' lost its ' + sources[code] + ' series');
    if (code === 'SS03' && row.level === 2) {
      // The exploratory route needed 111 commands and 95 decisions; the composed route needs 27 and 7.
      assert.ok(issued.length <= 35 && groups.size <= 10, 'SS03 L2 lost the direct pull and gate route');
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS03 L2 reset during the direct route');
    }
    if (code === 'SS03' && row.level === 3) {
      // The exploratory route stalled at 220 commands and 199 decisions. The composed route completes in 63 and 5.
      assert.ok(issued.length <= 75 && groups.size <= 8, 'SS03 L3 lost the direct pressure route');
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS03 L3 entered a trap on the direct route');
    }
    if (code === 'SS03' && row.level === 4) {
      // The exploratory route took 84 commands and 48 decisions. The shortest composed route takes 40 and 4.
      assert.ok(issued.length <= 45 && groups.size <= 6, 'SS03 L4 lost the shared pressure route');
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS03 L4 reset on the shared pressure route');
    }
    if (code === 'SS03' && row.level === 7) {
      // The exploratory route stalled at 220 commands and 153 decisions. The witnessed route completes in 60 and 11.
      assert.ok(issued.length <= 85 && groups.size <= 16, 'SS03 L7 lost the direct press route');
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS03 L7 trapped the cursor on the direct route');
    }
    if (code === 'SS03' && row.level === 8) {
      // The exploratory run did not finish by 130 commands. The guarded press relay completes in 160.
      assert.ok(issued.length <= 200 && groups.size <= 24, 'SS03 L8 lost the guarded press relay');
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS03 L8 reset while building the file');
    }
    if (code === 'SS04' && row.level === 1) {
      // Acquiring the exchange previously took 50 decisions for 51 commands. The guarded route takes 26.
      assert.ok(issued.length <= 55 && groups.size <= 32 && continued >= 20, 'SS04 L1 lost its verified exchange series');
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS04 L1 reset while learning exchanges');
    }
    if (code === 'SS04' && row.level === 2) {
      // The exploratory route took 119 commands and 115 decisions. Transferred exchanges take 54 and 4.
      assert.ok(issued.length <= 60 && groups.size <= 5, 'SS04 L2 lost the direct mixed exchange route');
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS04 L2 reset during the exchange route');
    }
    if (code === 'SS04' && row.level === 4) {
      // The earlier run made 39 decisions, died twice and stopped. The recovered route must execute verified series.
      assert.ok(issued.length <= 55 && continued >= 30, 'SS04 L4 lost its safe exchange route');
    }
    if (code === 'SS04' && row.level === 5) {
      // Without the earlier transmission witness SIC exhausted 180 commands without one exchange.
      assert.ok(issued.length <= 85 && groups.size <= 6, 'SS04 L5 lost the direct route to the pressure control');
      assert.ok(issued.every(ticket => ticket.resets === issued[0].resets), 'SS04 L5 reset during the pressure route');
    }
    if (code === 'SS04' && row.level === 6) {
      // The older route exhausted 150 commands with 42 exchanges and no lasting placement.
      assert.ok(issued.length <= 42 && groups.size <= 4, 'SS04 L6 lost its direct pressure composition');
      assert.ok(issued.every(ticket => ticket.resets === issued[0].resets), 'SS04 L6 reset during the pressure composition');
    }
    if (code === 'SS04' && row.level === 7) {
      assert.ok(issued.length <= 90 && groups.size <= 7, 'SS04 L7 lost the verified bridge and pressure composition');
      assert.ok(issued.every(ticket => ticket.resets === issued[0].resets), 'SS04 L7 reset during the composition');
    }
    if (code === 'SS04' && row.level === 8) {
      assert.ok(issued.length <= 90 && groups.size <= 8, 'SS04 L8 lost the direct reflected exchange route');
      assert.ok(issued.every(ticket => ticket.resets === issued[0].resets), 'SS04 L8 reset during the reflected route');
    }
    if (code === 'SS05') {
      // The earlier run used 46 isolated actions on L1 and first moved a weight on L2 at action 119.
      const [cap, minimumContinued] = [[42, 18], [75, 50], [55, 42], [96, 75], [40, 24], [38, 20], [90, 40], [55, 30]][row.level - 1];
      assert.ok(issued.length <= cap && continued >= minimumContinued, 'SS05 lost its verified carry series');
      assert.ok(issued.every(ticket => ticket.resets === issued[0].resets), 'SS05 reset during a carry route');
    }
    if (code === 'SS06') {
      const cap=[45,42,115,55,65,65,90,90][row.level-1];
      assert.ok(issued.length <= cap && continued >= 15, 'SS06 lost its guarded multi-actor routes');
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS06 must retain the prepared access');
    }
    if (code === 'SS07') {
      assert.ok(issued.length<=85&&continued>=20&&issued.every(ticket=>ticket.resets===0),
        'SS07 L1 must prepare and complete the destination set in guarded series');
    }
    const physical = reference ? measureManipulation(row.level, issued)
      : code === 'SS02' ? consecutiveStonePushes(row.level, issued) : code === 'SS03' ? consecutiveStonePulls(row.level, issued)
      : code === 'SS04' ? measuredExchangeSeries(row.level, issued) : code === 'SS05' ? measuredCarrySeries(row.level, issued)
      : code === 'SS06' ? [measureActorComposition,measureJointActorTransfer,measureLinkedGateRelay,measureBypassWithStackedSupport,measureSharedPressureTransport,measureReleasedControlCrossing,measureBridgeToReflector,measureWeightedPlatformCrossing][row.level-1](issued)
      : code === 'SS07' ? measureDestinationSet(issued) : [];
    if (reference) requireManipulation(physical, requiredPhysical[row.level] ?? [], row.level);
    result.push({
      game: code,
      level: row.level,
      commands: issued.length,
      continued,
      physical: physical.map(r => r.kind + ' ' + r.first + '-' + r.last).join(', '),
      series: lengths.length,
      longest: Math.max(1, ...lengths),
    });
  }
  return result;
}
function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const temp = mkdtempSync(join(tmpdir(), 'sic-continuity-'));
  const env = { ...process.env, SIC_STUDY_CONTINUITY: '1', SIC_STUDY_WORKERS: '1', SIC_STUDY_SOLVER: 'sic' };
  const execute = (args) => {
    const r = spawnSync(process.execPath, args, { env, cwd: root, stdio: 'inherit' });
    if (r.error) throw r.error;
    assert.equal(r.status, 0, 'Check failed: ' + args.join(' '));
  };
  let files = process.argv.slice(2);
  if (!files.length) {
    execute(['scripts/prepare-python.mjs']);
    files = [];
    for (const [name, cohort, end, cap] of [
      ['mirror-isles', 'SS01', '8', '120'],
      ['la-force-rouge', 'SS02', '6', '160'],
      ['la-ruse-verte', 'SS03', '8', '240'],
      ['l-axe-violet', 'SS04', '8', '150'],
      ['local-carry', 'SS05', '8', '155'],
      ['actor-composition', 'SS06', '8', '125'],
      ['destination-set', 'SS07', '1', '100'],
      ['native-sources', 'source:AR25,HANO,DC22', '1', '120'],
    ]) {
      const output = join(temp, name + '.jsonl');
      files.push(output);
      execute(['scripts/compare-source100.mjs', '.', '.', output, cohort, '1', end, cap]);
    }
  }
  const runs = files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line)),
  );
  assert.deepEqual(runs.map((r) => r.code).sort(), ['AR25', 'DC22', 'HANO', 'SS01', 'SS02', 'SS03', 'SS04', 'SS05', 'SS06', 'SS07']);
  console.table(runs.flatMap(checkRun));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
