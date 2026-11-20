import { createHash } from 'node:crypto';
import { sourceBackend } from './sic-study-source-games.mjs';
import { appendFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Use the same public game backend and assets for both solvers. Each run creates a new agent.
const [solverArg, environmentArg, output, cohort, startArg, finishArg, capArg, shardArg = '0/1'] =
  process.argv.slice(2);
const solverRoot = resolve(solverArg),
  environment = resolve(environmentArg);
const start = Number(startArg),
  finish = Number(finishArg),
  cap = Number(capArg);
const source = cohort === 'source' || cohort.startsWith('source:');
const load = (root, file) => import(pathToFileURL(join(root, file)).href);
const { BrowserV6Agent } = await load(solverRoot, 'src/runtime/v6-agent.ts');
const { V6AgentService } = await load(solverRoot, 'src/runtime/v6-agent-service.ts');
const { createNativeV6Runtime } = await load(solverRoot, 'src/logos-engine/v6-native-runtime.ts');
const { defaultRecoveryPack } = await load(solverRoot, 'src/sic/active-recovery.ts');
const declarationsRoot = join(
  environment,
  'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6'
);
const declaration = async (path) => JSON.parse(await readFile(join(declarationsRoot, path), 'utf8'));
const declarations = {
  common: await declaration('laya_proto/common_frontier_policy.drm.json'),
  strategy: await declaration('morphology_policy/strategy.drm'),
};
const motion = source ? null : await load(solverRoot, 'src/sic/observed-translation.ts');

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function clickPatch(frame, data) {
  if (!data || !Number.isInteger(data.x)) return null;
  const patch = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      patch.push(frame[data.y + dy]?.[data.x + dx] ?? -1);
    }
  return hash(patch).slice(0, 12);
}
function changeSummary(before, after, click) {
  let pixels = 0,
    near = 0,
    left = Infinity,
    right = -1,
    top = Infinity,
    bottom = -1;
  for (let y = 0; y < before.length; y++)
    for (let x = 0; x < before[y].length; x++) {
      if (before[y][x] === after[y]?.[x]) continue;
      pixels++;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      if (click && Math.max(Math.abs(x - click.x), Math.abs(y - click.y)) <= 4) near++;
    }
  return { pixels, near, width: pixels ? right - left + 1 : 0, height: pixels ? bottom - top + 1 : 0 };
}
async function run(code, games) {
  let board = await games.dispatch({ type: 'load', code, level: start });
  if (board.level !== start && board.canSelectLevel)
    board = await games.dispatch({ type: 'selectLevel', level: start });
  if (board.level !== start) throw Error('Backend did not start at requested level: ' + board.level);
  const initialCompleted = board.levelsCompleted,
    initial = hash(board.frame);
  // A fresh V6 campaign starts at ordinal one. In the isolated test only,
  // translate the campaign counters while retaining the real engine observation.
  const observation = () =>
    start === 1
      ? board
      : {
          ...board,
          level: board.level - start + 1,
          levelCount: board.levelCount - start + 1,
          levelsCompleted: board.levelsCompleted - initialCompleted,
        };
  const service = new V6AgentService((recovery) => createNativeV6Runtime(declarations, { recovery }));
  const transport = { request: (operation) => service.handle(operation), reset() {}, dispose() {} };
  const trajectory = createHash('sha256'),
    levels = [],
    steps = [];
  let issued = 0,
    resets = 0,
    sic = 0,
    trials = 0,
    changes = 0,
    newScenes = 0,
    relational = 0;
  const trialActions = {},
    seen = new Set([initial]);
  let levelCoverage;
  const replayCommands = process.env.SIC_STUDY_RECORD_COMMANDS === '1' ? [] : null;
  const preparation = new Map();
  const collectPreparation = (snapshot) => {
    const event = snapshot.trace?.findLast((e) => e.kind === 'sic_preparation_outcome');
    if (event && !preparation.has(event.revision))
      preparation.set(event.revision, { ...event, actionIndex: issued });
  };
  function emptyCoverage() {
    return {
      images: new Set([hash(board.frame)]),
      edges: new Set(),
      actions: new Set(),
      pairs: new Set(),
      previous: null,
      returns: 0,
      replayed: 0,
      translated: 0,
      returnedPositions: 0,
      positions: new Map(),
    };
  }
  function observeCoverage(before, after, action, nextHash) {
    const c = levelCoverage,
      prevHash = hash(before.frame),
      key = JSON.stringify([prevHash, action.id, action.data, nextHash]);
    const changed = prevHash !== nextHash;
    if (changed && c.images.has(nextHash)) c.returns++;
    if (changed && c.edges.has(key)) c.replayed++;
    c.images.add(nextHash);
    c.edges.add(key);
    c.actions.add(action.id);
    if (c.previous !== null) c.pairs.add(c.previous + ',' + action.id);
    c.previous = action.id;
    if (!motion || !changed || after.level !== before.level || before.state !== after.state) return;
    const matches = motion.measureComponentTranslations(before.frame, after.frame, (p) => p.area > 1);
    if (!matches.length) return;
    c.translated++;
    let revisited = false;
    for (const { from, to } of matches) {
      const shape = JSON.stringify([from.color, from.mask]),
        positions = c.positions.get(shape) ?? new Set();
      positions.add(from.bbox.join(','));
      if (positions.has(to.bbox.join(','))) revisited = true;
      positions.add(to.bbox.join(','));
      c.positions.set(shape, positions);
    }
    if (revisited) c.returnedPositions++;
  }
  const agent = new BrowserV6Agent({
    transport,
    targetLevels: finish - start + 1,
    actionsPerLevel: cap,
    parallelWorkers: Number(process.env.SIC_STUDY_WORKERS ?? 4),
    recoveryConfiguration: () => ({ ...defaultRecoveryPack, solver: 'sic-fallback' }),
    canDispatch: () => true,
    onState: collectPreparation,
    getObservation: observation,
    resetLevel: async () => {
      resets++;
      board = await games.dispatch({ type: 'reset' });
      return observation();
    },
    dispatch: async (action) => {
      if (board.level > finish) throw Error('Action after target level');
      const previous = board;
      const plan = agent.snapshot.trace.findLast((event) => event.kind === 'sic_native_plan');
      const began = performance.now();
      board = await games.dispatch({
        type: 'action',
        actionId: action.id,
        ...(action.id === 6 ? { data: action.data } : {}),
      });
      const executionMs = performance.now() - began;
      issued++;
      if (process.env.SIC_STUDY_PROGRESS === '1' && issued % 100 === 0)
        console.log(JSON.stringify({ code, level:board.level, issued, seconds:Math.round(process.uptime()) }));
      if (replayCommands)
        replayCommands.push({id:action.id, ...(action.id === 6 ? { data:action.data } : {}),
          from:hash(previous.frame).slice(0,16), to:hash(board.frame).slice(0,16)});
      if (plan?.authority === 'sicOnly') sic++;
      const nextHash = hash(board.frame);
      if (!source) observeCoverage(previous, board, action, nextHash);
      if (plan?.family === 'sic_test_observed_compositions') {
        trials++;
        if (hash(previous.frame) !== nextHash) changes++;
        if (!seen.has(nextHash)) newScenes++;
        if (plan.need?.satisfactionContract === 'observe_change_in_pair_distance') relational++;
        trialActions[action.id] = (trialActions[action.id] ?? 0) + 1;
      }
      seen.add(nextHash);
      trajectory.update(
        JSON.stringify([action, board.frame, board.frames, board.level, board.levelsCompleted, board.state])
      );
      if (source)
        steps.push({
          a: action.id,
          data: action.data,
          family: plan?.family,
          from: hash(previous.frame).slice(0, 16),
          to: hash(board.frame).slice(0, 16),
          patch: clickPatch(previous.frame, action.data),
          ...changeSummary(previous.frame, board.frame, action.data),
        });
      return { observation: observation(), executionMs };
    },
  });
  try {
    if (!agent.snapshot.canRun) throw Error('Invalid initial agent state: ' + agent.snapshot.message);
    for (let level = start; level <= finish; level++) {
      levelCoverage = emptyCoverage();
      seen.clear();
      seen.add(hash(board.frame));
      const actionsBefore = issued,
        wonBefore = board.levelsCompleted;
      const probesBefore = trials,
        effectsBefore = changes,
        newBefore = newScenes,
        relationalBefore = relational;
      let previousIssued;
      do {
        previousIssued = issued;
        const left = cap - (issued - actionsBefore);
        await agent.run(Math.min(600, left));
        if (agent.snapshot.status === 'error') throw Error(agent.snapshot.message);
      } while (issued > previousIssued && issued - actionsBefore < cap && board.level === level &&
        board.levelsCompleted === wonBefore && board.state !== 'WIN' && board.state !== 'GAME_OVER' &&
        agent.snapshot.canRun && agent.snapshot.status !== 'stopped');
      const snapshot = agent.snapshot;
      if (snapshot.status === 'error') throw Error(snapshot.message);
      const won = board.levelsCompleted > wonBefore || board.level > level || board.state === 'WIN';
      levels.push({
        level,
        won,
        actions: issued - actionsBefore,
        reason: snapshot.reason ?? null,
        state: board.state,
        compositionTrials: trials - probesBefore,
        changedTrials: changes - effectsBefore,
        newScenes: newScenes - newBefore,
        relational: relational - relationalBefore,
        ...(!source
          ? {
              uniqueImages: levelCoverage.images.size,
              returns: levelCoverage.returns,
              replayed: levelCoverage.replayed,
              controls: [...levelCoverage.actions].sort(),
              pairs: levelCoverage.pairs.size,
              translated: levelCoverage.translated,
              returnedPositions: levelCoverage.returnedPositions,
            }
          : {}),
      });
      if (!won || snapshot.status === 'stopped') break;
    }
    if (issued !== sic) throw Error('Incomplete SIC authority: ' + sic + '/' + issued);
    return {
      code,
      start,
      finish,
      cap,
      ...(process.env.SIC_STUDY_WORKERS ? {parallelWorkers:Number(process.env.SIC_STUDY_WORKERS)} : {}),
      initial,
      initialCompleted,
      levels,
      issued,
      sic,
      resets,
      trials,
      changes,
      newScenes,
      relational,
      trialActions,
      trajectory: trajectory.digest('hex'),
      ...(replayCommands ? { replayCommands } : {}),
      preparation: [...preparation.values()].map(
        ({
          epoch,
          access,
          equation,
          phase,
          hypothesis,
          result,
          longer,
          actor,
          from,
          to,
          localPath,
          revision,
          refs,
          trainedSite,
          testSite,
          predicted,
          actual,
          bareEffect,
          enabledMotion,
          strictMatch,
          actionIndex,
          precondition,
          capability,
          predictedGap,
        }) => ({
          level: (epoch ?? 1) + start - 1,
          phase,
          hypothesis,
          result,
          longer,
          actor,
          from,
          to,
          localPath,
          revision,
          refs,
          trainedSite,
          testSite,
          predicted,
          actual,
          bareEffect,
          enabledMotion,
          strictMatch,
          actionIndex,
          precondition,
          capability,
          predictedGap,
          ...(access ? {access} : {}),
          ...(equation ? {equation} : {}),
        })
      ),
      ...(source ? { steps } : {}),
    };
  } finally {
    agent.dispose();
  }
}

const catalogue = source
  ? (await load(solverRoot, 'src/games/catalog.ts')).GAME_CATALOG.map((game) => game.code).sort()
  : cohort.split(',');
if (source && (catalogue.length !== 100 || start !== 1 || finish !== 1)) throw Error('Invalid source cohort');
const selected = cohort.startsWith('source:') ? cohort.slice(7).split(',') : catalogue;
if (selected.some((code) => !catalogue.includes(code))) throw Error('Game outside cohort');
const [index, shards] = shardArg.split('/').map(Number);
const games = source
  ? await sourceBackend(environment)
  : (await load(environment, 'src/runtime/native-game-dispatcher.ts')).createGameDispatcher(() => {
      throw Error('Native evaluation unexpectedly requested a legacy game');
    });
for (const code of selected.filter((_, i) => i % shards === index)) {
  try {
    const result = await run(code, games);
    await appendFile(output, JSON.stringify(result) + '\n');
    console.log(
      code,
      result.levels.map((level) => [level.won, level.actions])
    );
  } catch (error) {
    await appendFile(output, JSON.stringify({ code, error: String(error) }) + '\n');
    process.exitCode = 1;
  }
}
