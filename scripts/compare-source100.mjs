import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {publicLesson} from './sic-study-public-lesson.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceInterface } from './sic-study-source-interface.mjs';
import { fromSourceFork } from './sic-study-source-fork.mjs';
import { appendFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Use the same public game backend and assets for both solvers. Each run creates a new agent.
const [solverArg, environmentArg, output, cohort, startArg, finishArg, capArg, shardArg = '0/1'] =
  process.argv.slice(2);
// A supervisor may yield this tape at the next game boundary and resume later.
const pauseFile = output + '.pause';
if (existsSync(pauseFile)) process.exit(0);
const solverRoot = resolve(solverArg),
  environment = resolve(environmentArg);
const start = Number(startArg),
  finish = Number(finishArg),
  cap = Number(capArg);
const source = cohort === 'source' || cohort.startsWith('source:');
const parallelWorkers = Number(process.env.SIC_STUDY_WORKERS ?? 1);
const load = (root, file) => import(pathToFileURL(join(root, file)).href);
const { BrowserV6Agent } = await load(solverRoot, 'src/runtime/v6-agent.ts');
const { V6AgentService } = await load(solverRoot, 'src/runtime/v6-agent-service.ts');
const { createNativeV6Runtime } = await load(solverRoot, 'src/logos-engine/v6-native-runtime.ts');
const { defaultRecoveryPack } = await load(solverRoot, 'src/sic/active-recovery.ts');
const packPath = process.env.SIC_STUDY_RECOVERY_PACK;
const packRevision = packPath ? (await load(solverRoot,'src/sic/recovery-pack.ts')).readRecoveryRevision(
  JSON.parse(await readFile(packPath,'utf8'))) : null;
if (packRevision && packRevision.configuration.solver !== 'sic-fallback') throw Error('SIC Fallback pack required');
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
  const prefixFile = process.env.SIC_STUDY_PUBLIC_PREFIX;
  if (prefixFile && !source) throw Error('Archived entry programs are only admitted for source studies');
  let board = await games.dispatch({ type: 'load', code, level: prefixFile ? 1 : start });
  let entryActions = 0;
  if (prefixFile) {
    const programs = JSON.parse(await readFile(prefixFile, 'utf8'));
    for (let level = 1; level < start; level++) {
      const word = level === 1
        ? programs.niveau_1[code]?.suite_gagnante
        : programs.niveaux_supérieurs.find(row => row.code === code && row.l === level)?.seq;
      if (board.level !== level || !word) throw Error('Missing verified prefix for ' + code + '/' + level);
      for (const command of word) {
        const [op, coordinates] = command.split('@');
        const [x, y] = coordinates ? coordinates.split(',').map(Number) : [];
        board = await games.dispatch({
          type: 'action', actionId: Number(op), ...(coordinates ? { data: { x, y } } : {})
        });
        entryActions++;
      }
    }
  } else if (board.level !== start && board.canSelectLevel)
    board = await games.dispatch({ type: 'selectLevel', level: start });
  if (board.level !== start) throw Error('Backend did not start at requested level: ' + board.level);
  const lesson=process.env.SIC_STUDY_OBSERVED_LESSON?await publicLesson(games,code,start,process.env.SIC_STUDY_OBSERVED_LESSON,solverRoot):null;
  if(lesson)board=lesson.board;
  const initialCompleted = board.levelsCompleted,
    initial = hash(board.frame);
  // A fresh V6 campaign starts at ordinal one. In the isolated test only,
  // translate the campaign counters while retaining the real engine observation.
  const observation = () =>
    start === 1
      ? board
      : {
          ...board,
          // A direct-entry engine may display an earlier unfinished level after a win.
          // The native test campaign has still advanced one ordinal on that scored action.
          level: board.levelsCompleted - initialCompleted === finish - start + 1
            ? finish - start + 2
            : board.level - start + 1,
          levelCount: board.levelCount - start + 1,
          levelsCompleted: board.levelsCompleted - initialCompleted,
        };
  const cursorAudit = process.env.SIC_STUDY_CURSOR_OFFERS ? [] : null;
  const boundaryAudit = process.env.SIC_STUDY_BOUNDARY_LAWS ? [] : null;
  const service = new V6AgentService(async(recovery) => {
    const backend=await createNativeV6Runtime(declarations,{recovery});
    if (cursorAudit || boundaryAudit) {
      const family = backend.families.find(f => f.id === 'sic_test_prepared_effects');
      const original = family.proposeInGroup.bind(family);
      family.proposeInGroup = async (...args) => {
        const proposal = await original(...args);
        const trial = proposal?.cursorSelectionForecast ?? proposal?.experiment?.cursorTrial;
        cursorAudit?.push({decision:issued+1, group:args[0], offered:trial?.stage??null});
        const epoch=args[1].level_epoch;
        if(boundaryAudit && epoch>1 && !boundaryAudit.some(b=>b.epoch===epoch)){
          const memory=family.state();
          const laws=(memory.localCapacity?.laws??[]).map(law=>({actions:[law.a,law.b,law.c],
            trainedEpoch:Number(law.ref.match(/:epoch:(\d+):/)?.[1]??0),signature:hash(law.key),
            matchedInTraining:law.matchedInTraining}));
          boundaryAudit.push({epoch,decision:issued+1,laws,terminalContacts:memory.previewLearning?.terminal?.length??0,
            previewBindings:Object.keys(memory.previewLearning?.bindings??{}).length,
            situatedPreparations:memory.previewLearning?.inheritedPreparations?.length??0,
            producedCues:Object.values(memory.previewLearning?.bindings??{}).filter(binding=>binding.producer).length});
        }
        return proposal;
      };
    }
    return lesson?lesson.wrap(backend):backend;
  });
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
  const recordedFieldRegistrations = new Set();
  const preparation = new Map();
  let withdrawal;
  const collectPreparation = (snapshot) => {
    if(!withdrawal){
      const event=snapshot.trace?.find(e=>e.kind==='sic_fallback_primary_withdrawn');
      if(event)withdrawal={family:event.family,observation:event.observation_ref};
    }
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
    parallelWorkers,
    recoveryConfiguration: () => packRevision?.configuration ?? { ...defaultRecoveryPack, solver: 'sic-fallback' },
    canDispatch: () => true,
    onState: collectPreparation,
    getObservation: observation,
    resetLevel: async () => {
      resets++;
      board = await games.dispatch({ type: 'reset' });
      return observation();
    },
    dispatch: async (action) => {
      if (board.level > finish || board.levelsCompleted - initialCompleted >= finish - start + 1)
        throw Error('Action after target level');
      const previous = board;
      const plan = agent.snapshot.trace.findLast((event) => event.kind === 'sic_native_plan');
      const frameSeal=plan?.frameForecast?hash(plan.frameForecast):null;
      const terminalContactSeal=plan?.terminalContactForecast?hash(plan.terminalContactForecast):null;
      const localCapacity=plan?.localCapacityForecast?structuredClone(plan.localCapacityForecast):null;
      const localSeal=localCapacity?hash(localCapacity):null;
      const configuration=plan?.configurationForecast;
      const mobilitySeal=plan?.mobilityForecast?hash(plan.mobilityForecast):null;
      const mechanismSeal=plan?.mechanismForecast?hash(plan.mechanismForecast):null;
      const indicatorProbeSeal=plan?.indicatorProbeForecast?hash(plan.indicatorProbeForecast):null;
      const previewReadSeal=plan?.witnessedPreviewForecast?hash(plan.witnessedPreviewForecast):null;
      const occupancySeal=plan?.occupancyForecast?hash(plan.occupancyForecast):null;
      const territorySeal=plan?.territoryForecast?hash(plan.territoryForecast):null;
      const activationSeal=plan?.activationForecast?hash(plan.activationForecast):null;
      const retainedSeal=plan?.retainedForecast?hash(plan.retainedForecast):null;
      const siteSeal=plan?.instrumentForecast?hash(plan.instrumentForecast):null;
      const transportSeal=plan?.transportForecast?hash(plan.transportForecast):null;
      const forecast = plan?.exchangeForecast;
      const forecastSeal = forecast ? hash([forecast.roles,forecast.refs,forecast.steps,forecast.alternatives,forecast.aims]) : null;
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
        replayCommands.push({id:action.id, ...(localSeal?{localCapacity,localSeal}:{}), ...(plan?.family ? {family:plan.family} : {}), ...(forecastSeal ? { forecastSeal } : {}), ...(frameSeal ? {frameSeal}:{}), ...(activationSeal?{activationSeal}:{}), ...(territorySeal?{territorySeal}:{}), ...(occupancySeal?{occupancySeal}:{}), ...(previewReadSeal?{previewReadSeal}:{}), ...(indicatorProbeSeal?{indicatorProbeSeal}:{}), ...(mechanismSeal?{mechanismSeal}:{}), ...(mobilitySeal?{mobilitySeal}:{}), ...(terminalContactSeal?{terminalContactSeal}:{}), ...(retainedSeal ? {retainedSeal}:{}), ...(transportSeal ? {transportSeal} : {}), ...(siteSeal ? {siteSeal,siteStepSeal:hash(plan.instrumentPosition??null)} : {}), ...(action.id === 6 ? { data:action.data } : {}),
          ...(plan?.compositionForecast?{composition:plan.compositionForecast}:{}),
          ...(plan?.roleArrangementForecast?{roleArrangement:plan.roleArrangementForecast}:{}),
          ...(plan?.reactiveContactForecast?{reactiveContact:plan.reactiveContactForecast}:{}),
          ...(plan?.operandForecast?{operand:plan.operandForecast}:{}),
          ...(plan?.fieldForecast?{field:plan.fieldForecast}:{}),
          ...(plan?.terminalContactForecast?.witness?.basis==='unique_contact_hypothesis'?{contactHypothesis:{
            actor:plan.terminalContactForecast.witness.actor,marker:plan.terminalContactForecast.witness.marker,
            from:plan.terminalContactForecast.from,to:plan.terminalContactForecast.to,site:plan.terminalContactForecast.site,
            distance:plan.terminalContactForecast.distance}}:{}),
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
      if (configuration && replayCommands)
        Object.assign(replayCommands.at(-1), {configuration, configurationSeal:hash(configuration)});
      if(plan?.cooperativeTransportForecast && replayCommands)Object.assign(replayCommands.at(-1),{cooperative:plan.cooperativeTransportForecast});
      if(plan?.silentInputForecast && replayCommands)Object.assign(replayCommands.at(-1),{silentInput:plan.silentInputForecast});
      if (plan?.motorBaselineForecast && replayCommands) replayCommands.at(-1).motorBaseline = plan.motorBaselineForecast;
      const registration = plan?.fieldRegistrationForecast;
      if (registration && replayCommands && !recordedFieldRegistrations.has(registration.after)) {
        const command = replayCommands.at(-1);
        if (!registration.after.endsWith(':frame:' + command.from) || registration.nextAction !== 'ACTION' + action.id)
          throw Error('Field registration does not describe the first action of this plan');
        command.fieldRegistration = registration;
        recordedFieldRegistrations.add(registration.after);
      }
      if(plan?.deferredMechanismForecast && replayCommands)Object.assign(replayCommands.at(-1),{deferredMechanism:plan.deferredMechanismForecast});
      if(plan?.transportControlForecast && replayCommands)Object.assign(replayCommands.at(-1),{transportControl:plan.transportControlForecast});
      if(plan?.markedMotionForecast && replayCommands)Object.assign(replayCommands.at(-1),{markedMotion:plan.markedMotionForecast});
      if(plan?.landmarkForecast && replayCommands)Object.assign(replayCommands.at(-1),{landmark:plan.landmarkForecast});
      if(plan?.cursorSelectionForecast && replayCommands){
        const cursor=plan.cursorSelectionForecast;
        Object.assign(replayCommands.at(-1),{cursorStage:cursor.stage,cursorEvidence:hash(cursor),
          observedSubjects:[cursor.source.box,cursor.target.box]});
        if(cursor.decisionMode)Object.assign(replayCommands.at(-1),{decisionMode:cursor.decisionMode});
        if(cursor.contrast)Object.assign(replayCommands.at(-1),{controlContrast:cursor.contrast});
        if(cursor.repairOptions)Object.assign(replayCommands.at(-1),{repairOptions:cursor.repairOptions,triedMotors:cursor.triedMotors});
        if(cursor.beyondReturn)Object.assign(replayCommands.at(-1),{beyondReturn:true});
        if(cursor.projectedMove) Object.assign(replayCommands.at(-1),{cursorMotor:cursor.projectedMove.command,
          cursorDelta:cursor.projectedMove.delta});
      }
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
      // Some direct-entry engines return to the earliest uncompleted level after scoring.
      // Select the earned successor through the public menu, preserving the real credit.
      if (start > 1 && previous.level < finish && board.level < start &&
          board.levelsCompleted === previous.levelsCompleted + 1 && board.state !== 'WIN') {
        if (!board.canSelectLevel) throw Error('The scored direct-entry campaign has no public level selector.');
        const level = previous.level + 1, credit = board.levelsCompleted;
        const selected = await games.dispatch({ type: 'selectLevel', level });
        if (selected.level !== level || selected.levelsCompleted !== credit)
          throw Error('Selecting the earned successor did not preserve its level and official credit.');
        const entry = { level, frame: hash(selected.frame) };
        if (replayCommands) replayCommands.at(-1).nextLevelEntry = entry;
        if (source) steps.at(-1).nextLevelEntry = entry;
        board = selected;
      }
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
      parallelWorkers,
      initial,
      initialCompleted,
      ...(withdrawal?{withdrawal}:{}),
      ...(prefixFile ? { sourcePrefixActions: entryActions } : {}),
      ...(lesson?{observedPriorLevelActions:lesson.length}:{}),
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
          projection,
          exchange,
          transport,
          instrument,
          frame,
          activation,
          territorial,
          terminalContact,mobilityProbe,mechanism,localRepeat,cueSearch,relativePlacement,
          unreadIndicator,
          witnessedPreview,
          occupancy,
          retained,
          transfer,
          frontier,
          condition,
          delayed,
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
          ...(terminalContact?{terminalContact}:{}), ...(mobilityProbe?{mobilityProbe}:{}), ...(mechanism?{mechanism}:{}), ...(localRepeat?{localRepeat}:{}),
          ...(cueSearch?{cueSearch}:{}),
          ...(relativePlacement?{relativePlacement}:{}),
          ...(unreadIndicator ? {unreadIndicator} : {}),
          ...(witnessedPreview ? {witnessedPreview} : {}),
          ...(occupancy ? {occupancy} : {}),
          ...(territorial ? {territorial} : {}),
          ...(activation ? {activation} : {}),
          ...(frame ? {frame} : {}),
          ...(retained ? {retained} : {}),
          ...(instrument ? {instrument} : {}),
          ...(transport ? {transport} : {}),
          ...(exchange ? {exchange} : {}),
          ...(projection ? {projection} : {}),
          ...(delayed ? { delayed } : {}),
          ...(frontier ? {frontier} : {}),
          ...(condition ? {condition} : {}),
          ...(transfer ? {transfer} : {}),
        })
      ),
      ...(cursorAudit ? {cursorAudit} : {}),
      ...(boundaryAudit ? {boundaryAudit} : {}),
      ...(packRevision ? {packDigest:packRevision.digest} : {}),
      ...(source ? { steps } : {}),
    };
  } finally {
    agent.dispose();
  }
}

const catalogue = source
  ? (await load(solverRoot, 'src/games/catalog.ts')).GAME_CATALOG.filter((game) => game.group !== 'custom_4').map((game) => game.code).sort()
  : cohort.split(',');
if (source && (catalogue.length !== 100 || (cohort === 'source' && (start !== 1 || finish !== 1)))) throw Error('Invalid source cohort');
const selected = cohort.startsWith('source:') ? cohort.slice(7).split(',') : catalogue;
if (selected.some((code) => !catalogue.includes(code))) throw Error('Game outside cohort');
const [index, shards] = shardArg.split('/').map(Number);
const variation = process.env.SIC_STUDY_SOURCE_INTERFACE;
if (variation && !source) throw Error('Interface variations apply only to the source cohort');
const forkFile = process.env.SIC_STUDY_SOURCE_FORKS;
if (forkFile && (!source || start !== finish || variation || process.env.SIC_STUDY_PUBLIC_PREFIX || process.env.SIC_STUDY_OBSERVED_LESSON))
  throw Error('A source fork requires one direct-entry source level');
const forks = forkFile ? JSON.parse(await readFile(forkFile, 'utf8')) : null;
const games = source
  ? sourceInterface(await sourceBackend(environment), variation)
  : (await load(environment, 'src/runtime/native-game-dispatcher.ts')).createGameDispatcher(() => {
      throw Error('Native evaluation unexpectedly requested a legacy game');
    });
const jobs = forks ? forks.filter(f => selected.includes(f.code) && f.level === start)
  : selected.map(code => ({code}));
for (const job of jobs.filter((_, i) => i % shards === index)) {
  if (existsSync(pauseFile)) break;
  const {code} = job;
  try {
    const result = await run(code, forks ? fromSourceFork(games, job) : games);
    if (forks) result.sourceFork = { id: job.id, prefix: job.prefix, arm: job.arm, initial: job.initial };
    if (variation) result.sourceInterface = variation;
    await appendFile(output, JSON.stringify(result) + '\n');
    console.log(
      code,
      result.levels.map((level) => [level.won, level.actions])
    );
  } catch (error) {
    await appendFile(output, JSON.stringify({ code, ...(forks ? {sourceFork: job.id} : {}), error: String(error) }) + '\n');
    process.exitCode = 1;
  }
}
