import assert from 'node:assert/strict';
import { measureManipulation, requireManipulation } from './measure-ss01-manipulation.mjs';
import { compileLevel, equal, initialState, stepWorld } from '../experiments/sinking-star-ss02/src/core.ts';
import { SS02_LEVELS } from '../experiments/sinking-star-ss02/src/levels.ts';
import { compileLevel as compilePullLevel, initialState as initialPullState, stepDetailed as stepPullWorld } from '../experiments/sinking-star-ss03/src/core.ts';
import { SS03_LEVELS } from '../experiments/sinking-star-ss03/src/levels.ts';
import { compileLevel as compileExchangeLevel, initialState as initialExchangeState, stepDetailed as stepExchangeWorld, terrainAt as exchangeTerrainAt } from '../experiments/sinking-star-ss04/src/core.ts';
import { SS04_LEVELS } from '../experiments/sinking-star-ss04/src/levels.ts';
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
const sources = { AR25: 'move', HANO: 'click', DC22: 'mixed', SS02: 'move', SS03: 'move', SS04: 'move' };

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
  return mixed;
}

export function checkRun(run) {
  const { code, executedTickets: tickets, levels } = run;
  const reference = code === 'SS01' ? campaign : null;
  assert.ok(reference || code in sources, 'Unexpected game ' + code);
  assert.equal(run.solver, 'sic');
  assert.ok(Array.isArray(tickets) && tickets.length > 0, 'Missing executed tickets');
  assert.equal(tickets.length, run.sic);
  assert.equal(tickets.length, run.issued);
  assert.equal(levels.length, reference?.length ?? (code === 'SS02' ? 6 : code === 'SS03' ? 8 : code === 'SS04' ? 7 : 1), code + ' incomplete campaign');
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
    const physical = reference ? measureManipulation(row.level, issued)
      : code === 'SS02' ? consecutiveStonePushes(row.level, issued) : code === 'SS03' ? consecutiveStonePulls(row.level, issued)
      : code === 'SS04' ? measuredExchangeSeries(row.level, issued) : [];
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
      ['l-axe-violet', 'SS04', '7', '150'],
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
  assert.deepEqual(runs.map((r) => r.code).sort(), ['AR25', 'DC22', 'HANO', 'SS01', 'SS02', 'SS03', 'SS04']);
  console.table(runs.flatMap(checkRun));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
