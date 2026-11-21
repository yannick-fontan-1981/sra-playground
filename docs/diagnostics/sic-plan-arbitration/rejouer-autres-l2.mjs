import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [engineRoot, archive] = process.argv.slice(2);
const { games } = JSON.parse(await readFile(archive, 'utf8'));
const load = path => import(pathToFileURL(resolve(engineRoot, path)).href);
const runtime = await load('src/runtime/native-game-dispatcher.ts');
const hash = frame => createHash('sha256').update(JSON.stringify(frame)).digest('hex');
const key = ({ x, y }) => x + ',' + y;
const stones = state => state.stones.map(key).sort().join(';');

// Post-run only. Search forwards from recorded positions, then authenticate any
// successful continuation through the public dispatcher from its exact prefix.
async function shortContinuation(code, core, world, roots, controls, commands) {
  const limit = 6;
  const seen = new Set(roots.keys());
  let frontier = [...roots.values()];
  for (let depth = 1; depth <= limit; depth++) {
    const next = [];
    for (const node of frontier) {
      const options = controls.filter(id => id !== 6);
      if (controls.includes(6)) {
        // A click in this engine only selects a living hero. All other clicks
        // preserve the state, so selecting each hero covers every changed outcome.
        for (const hero of node.state.heroes.filter(h => !h.dead)) {
          const { x, y } = core.cellToPixel(hero.at);
          options.push([6, x, y]);
        }
      }
      for (const action of options) {
        const [id, x, y] = Array.isArray(action) ? action : [action];
        const state = core.stepWorld(world, node.state, id, id === 6 ? { x, y } : undefined);
        if (state.dead) continue;
        if (state.complete) {
          const suffix = [...node.suffix, action];
          const engine = runtime.createGameDispatcher(() => { throw Error('Unexpected backend'); });
          let board = await engine.dispatch({ type: 'load', code, level: 2 });
          if (board.level !== 2 && board.canSelectLevel) board = await engine.dispatch({ type: 'selectLevel', level: 2 });
          assert.equal(board.level, 2); assert.equal(board.levelsCompleted, 0);
          for (const k of [...commands.slice(0, node.prefix), ...suffix]) {
            const [op, px, py] = Array.isArray(k) ? k : [k];
            board = await engine.dispatch({ type: 'action', actionId: op, ...(op === 6 ? { data: { x: px, y: py } } : {}) });
          }
          assert.equal(board.levelsCompleted, 1);
          return { limit, minimum: depth, prefix: node.prefix, suffix };
        }
        const signature = JSON.stringify(state);
        if (depth < limit && !seen.has(signature)) {
          seen.add(signature);
          next.push({ state, prefix: node.prefix, suffix: [...node.suffix, action] });
        }
      }
    }
    frontier = next;
  }
  return { limit, minimum: null };
}
async function replay(code, tape) {
  const dir = 'experiments/sinking-star-' + code.toLowerCase() + '/src/';
  const [core, levels] = await Promise.all([load(dir + 'core.ts'), load(dir + 'levels.ts')]);
  const world = core.compileLevel(levels[code + '_LEVELS'][1]);
  const goals = (world.goals ?? [world.goal]).map(key);
  let state = core.initialState(world);
  const cells = new Map(), phases = {}, selected = new Set(), stoneLayouts = new Set();
  const doors = new Set(), goalsVisited = new Set();
  let peakOccupied = 0;
  function measure() {
    const heroes = state.heroes ?? [{ kind: 'hero', at: state.hero, dead: state.dead }];
    const living = new Set();
    for (const hero of heroes.filter(h => !h.dead)) {
      if (!cells.has(hero.kind)) cells.set(hero.kind, new Set());
      cells.get(hero.kind).add(key(hero.at));
      living.add(key(hero.at));
    }
    const occupied = goals.filter(p => living.has(p));
    for (const p of occupied) goalsVisited.add(p);
    peakOccupied = Math.max(peakOccupied, occupied.length);
    selected.add(heroes[state.active ?? 0].kind);
    stoneLayouts.add(stones(state));
    if (world.gates?.length) doors.add(world.gates.map((_, i) => Number(core.gateClosed(world, state, i))).join(''));
    else if (world.doors?.length) doors.add(String(Number(core.doorsOpen(world, state))));
  }
  const engine = runtime.createGameDispatcher(() => { throw Error('Unexpected backend'); });
  let board = await engine.dispatch({ type: 'load', code, level: 2 });
  if (board.level !== 2 && board.canSelectLevel) board = await engine.dispatch({ type: 'selectLevel', level: 2 });
  assert.equal(board.level, 2);
  assert.equal(board.levelsCompleted, 0);
  assert.equal(hash(board.frame), tape.initial);
  assert.equal(hash(core.renderWorld(world, state)), tape.initial);
  const chain = createHash('sha256').update(tape.initial + '\n');
  const controls = board.availableActionIds;
  const roots = new Map([[JSON.stringify(state), { state, prefix: 0, suffix: [] }]]);
  measure();
  for (const [i, input] of tape.commands.entries()) {
    assert.equal(state.complete || !!state.dead, false);
    const [id, x, y] = Array.isArray(input) ? input : [input];
    const data = id === 6 ? { x, y } : undefined;
    const before = state;
    if (core.stepDetailed) {
      const step = core.stepDetailed(world, before, id, data);
      state = step.state;
      for (const phase of step.phases) {
        const entry = phases[phase.kind] ??= { first: i + 1, count: 0 };
        entry.count++;
      }
    } else {
      state = core.stepWorld(world, before, id, data);
      if (stones(state) !== stones(before)) {
        const entry = phases.push ??= { first: i + 1, count: 0 };
        entry.count++;
      }
    }
    measure();
    if (!tape.won && !state.dead && !state.complete) {
      const signature = JSON.stringify(state);
      if (!roots.has(signature)) roots.set(signature, { state, prefix: i + 1, suffix: [] });
    }
    board = await engine.dispatch({ type: 'action', actionId: id, ...(data ? { data } : {}) });
    const frame = hash(board.frame);
    chain.update(frame.slice(0,16) + '\n');
    if (board.levelsCompleted === 0) assert.equal(hash(core.renderWorld(world, state)), frame);
    else assert.equal(i + 1, tape.commands.length);
  }
  assert.equal(chain.digest('hex'), tape.frameChain);
  assert.equal(state.complete, tape.won);
  assert.equal(board.levelsCompleted, Number(tape.won));
  assert.equal(board.state, tape.terminalState);
  const result = {
    peakOccupied, totalGoals: goals.length, differentGoalsVisited: goalsVisited.size,
    cells: Object.fromEntries([...cells].map(([kind, seen]) => [kind, seen.size])),
    controlled: [...selected], stoneLayouts: stoneLayouts.size, gateLayouts: doors.size, phases,
    ...(!tape.won ? { shortContinuation: await shortContinuation(code, core, world, roots, controls, tape.commands) } : {})
  };
  if (tape.physical) assert.deepEqual(result, tape.physical);
  return result;
}
async function replayCampaign(code, campaign) {
  const engine = runtime.createGameDispatcher(() => { throw Error('Unexpected backend'); });
  let board = await engine.dispatch({ type: 'load', code, level: 1 });
  assert.equal(board.level, 1); assert.equal(board.levelsCompleted, 0);
  assert.equal(hash(board.frame), campaign.initial);
  const chain = createHash('sha256').update(campaign.initial + '\n');
  const levels = new Map();
  const resets = new Map(campaign.resets.map(x => [x.after, x.frame]));
  for (const [i, action] of campaign.commands.entries()) {
    if (resets.has(i)) {
      const prevLevel = board.level, prevScore = board.levelsCompleted;
      board = await engine.dispatch({ type: 'reset' });
      assert.equal(board.level, prevLevel); assert.equal(board.levelsCompleted, prevScore);
      assert.equal(hash(board.frame).slice(0,16), resets.get(i));
    }
    const [id, x, y] = Array.isArray(action) ? action : [action];
    const { level, levelsCompleted } = board;
    board = await engine.dispatch({ type: 'action', actionId: id, ...(id === 6 ? { data: { x, y } } : {}) });
    const record = levels.get(level) ?? { level, actions: 0, won: false };
    record.actions++; record.won ||= board.levelsCompleted > levelsCompleted;
    levels.set(level, record);
    chain.update(hash(board.frame).slice(0,16) + '\n');
  }
  assert.equal(chain.digest('hex'), campaign.frameChain);
  // A reached level can also stop without issuing a single command.
  const measured = campaign.levels.map(({ level }) => levels.get(level) ?? { level, actions: 0, won: false });
  assert.deepEqual(measured, campaign.levels.map(({ level, actions, won }) => ({ level, actions, won })));
  assert.equal(board.levelsCompleted, measured.filter(x => x.won).length);
}
async function checkSplice(code, entry) {
  const campaign = entry.campaign;
  const splice = campaign.splice;
  const cold = entry.tapes[entry.runs.v31.tape];
  const l1 = campaign.levels.find(x => x.level === 1).actions;
  const engine = runtime.createGameDispatcher(() => { throw Error('Unexpected backend'); });
  let board = await engine.dispatch({ type: 'load', code, level: 2 });
  if (board.level !== 2 && board.canSelectLevel) board = await engine.dispatch({ type: 'selectLevel', level: 2 });
  const play = input => {
    const [id, x, y] = Array.isArray(input) ? input : [input];
    return engine.dispatch({ type: 'action', actionId: id, ...(id === 6 ? { data: { x, y } } : {}) });
  };
  for (const input of cold.commands.slice(0, splice.coldPrefix)) board = await play(input);
  assert.equal(board.levelsCompleted, 0);
  assert.equal(hash(board.frame).slice(0,16), splice.frame);
  const suffix = campaign.commands.slice(l1 + splice.warmPrefix);
  assert.equal(suffix.length, splice.suffixLength);
  for (const input of suffix) {
    if (board.levelsCompleted || board.state !== 'NOT_FINISHED') break;
    board = await play(input);
  }
  return board.levelsCompleted;
}
const results = {};
for (const [code, entry] of Object.entries(games)) {
  if (entry.campaign) await replayCampaign(code, entry.campaign);
  if (entry.campaign?.splice) {
    const score = await checkSplice(code, entry);
    if (entry.campaign.splice.score !== undefined) assert.equal(score, entry.campaign.splice.score);
    console.error(JSON.stringify({ code, spliceScore: score }));
  }
  results[code] = [];
  for (const tape of entry.tapes) results[code].push(await replay(code, tape));
}
console.log(JSON.stringify(results));
