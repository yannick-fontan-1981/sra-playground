/** Replay an official game under SIC while removing specific reasoning dependencies. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { loadPyodide } from '../public/vendor/pyodide/pyodide.mjs';

const root = new URL('../', import.meta.url);
const field = {
  original: 'sic_field_repair',
  shared: 'sic_learn_correspondence',
  module: 'src/logos-engine/v6-field-constraints.ts',
  guards: { measuredFields: '[]', symmetryEvidence: 'null', periodicHypotheses: '[]' },
};
const groupEffects = {
  original: 'sic_subset_experiment', shared: 'sic_learn_scope_effects',
  module: 'src/logos-engine/v6-subset-diagnosis.ts',
  guards: { measureSubsetScene: 'null', subsetFeedback: 'null' },
};
const cases = {
  DICO: groupEffects,
  LF52: groupEffects,
  DNOI: field,
  SYME: field,
  TRIA: field,
  HANO: {
    original: 'sic_ordered_support_transfer', shared: 'sic_learn_support_moves',
    module: 'src/logos-engine/v6-ordered-support.ts',
    guards: { measureOrderedSupportScene: 'null', measureSupportBand: 'null', measureMaterialBands: 'null' },
  },
  KLOT: {
    original: 'sic_move_masked_pieces', shared: 'sic_learn_selected_access',
    module: 'src/logos-engine/v6-selected-rigid-search.ts',
    guards: { selectedRigidRoute: 'null' },
  },
  LS20: {
    original: 'sic_framed_contact', shared: 'sic_learn_pattern_access',
    module: 'src/sic/inset-contact.ts',
    guards: { measureInsetContact: 'null' },
  },
};
const [code, mode, scope = 'first', budgetText = '80', projection = 'standard'] = process.argv.slice(2);
const entry = Object.hasOwn(cases, code) ? cases[code] : null;
const budget = Number(budgetText);
assert.ok(entry && ['original', 'family', 'planner'].includes(mode) && ['first', 'complete'].includes(scope)
  && Number.isSafeInteger(budget) && budget > 0 && ['standard', 'neutral'].includes(projection),
  'Usage: node scripts/check-sic-planner-dependency.mjs DICO|DNOI|HANO|SYME|LF52|TRIA|KLOT|LS20 original|family|planner [first|complete] [actions per level] [standard|neutral]');

const disabled = new Set(mode === 'original' ? [] : [entry.original]);
if (mode === 'planner') disabled.add(entry.shared);
const guardHits = Object.fromEntries(Object.keys(entry.guards).map(name => [name, 0]));
const targetModule = new URL(entry.module, root).href;
const guardToken = Symbol.for('sic.planner-dependency.guard');
let installedGuards = [];
globalThis[guardToken] = name => { guardHits[name]++; };

// Replace only the inspected function bodies in this isolated Node process.
// An unavailable measurement yields its usual empty result before running any model code.
const hook = mode === 'planner' ? registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== targetModule) return loaded;
    const source = loaded.source.toString();
    const syntax = ts.createSourceFile(entry.module, source, ts.ScriptTarget.Latest);
    const edits = [];
    for (const statement of syntax.statements) {
      if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) continue;
      const name = statement.name.text;
      if (!Object.hasOwn(entry.guards, name)) continue;
      edits.push({ name, start: statement.body.getStart(syntax) + 1 });
    }
    installedGuards = edits.map(edit => edit.name).sort();
    assert.deepEqual(installedGuards, Object.keys(entry.guards).sort(), 'Every declared dependency must be intercepted');
    let instrumented = source;
    for (const { name, start } of edits.reverse()) {
      const stop = `globalThis[Symbol.for(${JSON.stringify(Symbol.keyFor(guardToken))})](${JSON.stringify(name)}); return ${entry.guards[name]};`;
      instrumented = instrumented.slice(0, start) + stop + instrumented.slice(start);
    }
    return { ...loaded, source: instrumented };
  },
}) : null;

async function run() {
  const { createNativeV6Runtime } = await import('../src/logos-engine/v6-native-runtime.ts');
  const { BrowserV6Agent } = await import('../src/runtime/v6-agent.ts');
  const { V6AgentService } = await import('../src/runtime/v6-agent-service.ts');
  const { defaultRecoveryPack } = await import('../src/sic/active-recovery.ts');
  if (mode === 'planner') assert.ok(installedGuards.length > 0, 'The guarded module did not load');
  const reference = new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', root);
  const json = async file => JSON.parse(await readFile(new URL(file, reference), 'utf8'));
  const [common, strategy] = await Promise.all([
    json('laya_proto/common_frontier_policy.drm.json'), json('morphology_policy/strategy.drm'),
  ]);
  const service = new V6AgentService(async recovery => {
    const runtime = await createNativeV6Runtime({ common, strategy }, { recovery });
    for (const id of disabled) {
      assert.ok(runtime.families.some(family => family.id === id) && runtime.groups.some(group => group.families.includes(id)),
        `The reference provider must exist in both factory and agenda: ${id}`);
    }
    runtime.families = runtime.families.filter(family => !disabled.has(family.id));
    runtime.groups = runtime.groups.map(group => ({ ...group, families: group.families.filter(id => !disabled.has(id)) }));
    return runtime;
  });
  const py = await loadPyodide({ indexURL: fileURLToPath(new URL('public/vendor/pyodide/', root)), stdout: () => {}, stderr: () => {} });
  await py.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
  const assets = new URL('public/python/', root);
  for (const archive of ['official-games.zip', 'custom-games.zip']) {
    py.unpackArchive(new Uint8Array(await readFile(new URL(archive, assets))), 'zip', { extractDir: '/games' });
  }
  for (const name of ['game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py']) {
    py.FS.writeFile('/games/' + name, await readFile(new URL(name, assets), 'utf8'));
  }
  py.runPython("import sys\nsys.path.insert(0, '/games')\nfrom game_bridge import dispatch");
  const remap = rows => rows.map(row => row.map(value => (value * 5 + 3) % 16));
  function play(request) {
    py.globals.set('_sic_request', JSON.stringify(request));
    const packet = JSON.parse(py.runPython('dispatch(_sic_request)'));
    assert.ok(!packet.error, 'Official game bridge rejected the request');
    if (projection === 'neutral') return { ...packet, gameCode: 'UNKNOWN', frame: remap(packet.frame), frames: packet.frames.map(remap) };
    return { ...packet, gameCode: packet.code ?? packet.gameCode };
  }
  let board = play({ type: 'load', code, level: 1 });
  const target = scope === 'complete' ? board.levelCount : 1;
  const usage = new Map(), primitives = new Map();
  const levels = [];
  const entryReviews = new Map();
  const commands = createHash('sha256'), trajectory = createHash('sha256');
  let verifiedReuse = 0;
  const agent = new BrowserV6Agent({
    transport: { request: operation => service.handle(operation), reset() {}, dispose() {} },
    targetLevels: target,
    actionsPerLevel: budget,
    recoveryConfiguration: () => ({ ...defaultRecoveryPack, solver: 'sic' }),
    getObservation: () => board,
    canDispatch: () => true,
    onState() {},
    dispatch: async action => {
      if (board.levelsCompleted > 0 && !entryReviews.has(board.level)) {
        const prior = agent.snapshot.victoryReviews?.find(review => review.level === board.level - 1
          && review.score === board.levelsCompleted);
        entryReviews.set(board.level, { level: board.level, reviewedLevel: prior?.level ?? null, goal: prior?.hypothesis?.label ?? null });
      }
      const plan = agent.snapshot.trace.findLast(event => event.kind === 'sic_native_plan');
      assert.ok(plan?.authority === 'sicOnly' && plan.strategy && !disabled.has(plan.family), 'Expected an exclusive SIC decision');
      usage.set(plan.family, (usage.get(plan.family) ?? 0) + 1);
      primitives.set(plan.strategy, (primitives.get(plan.strategy) ?? 0) + 1);
      const samples = agent.snapshot.proposal?.sicSituationCard?.predictionSupport;
      if (plan.strategy === 'P02' && Array.isArray(samples) && new Set(samples).size >= 2) verifiedReuse++;
      const start = performance.now();
      board = play({ type: 'action', actionId: action.id, ...(action.id === 6 ? { data: action.data } : {}) });
      const executionMs = performance.now() - start;
      commands.update(JSON.stringify(action));
      trajectory.update(JSON.stringify([action, board.frame, board.frames, board.level, board.levelsCompleted, board.state]));
      return { observation: board, executionMs };
    },
  });
  try {
    for (let level = 1; level <= target; level++) {
      const start = performance.now(), before = agent.snapshot.actionCount;
      await agent.run(budget);
      const won = board.levelsCompleted >= level;
      levels.push({ level, won, actions: agent.snapshot.actionCount - before, ms: Math.round(performance.now() - start) });
      if (!won || agent.snapshot.status === 'stopped') break;
    }
    const snapshot = agent.snapshot;
    assert.notEqual(snapshot.status, 'error', snapshot.message?.slice(0, 240));
    assert.equal(snapshot.sicActionCoverage?.sicOnly ?? 0, snapshot.actionCount);
    const retained = snapshot.coverage?.registeredFamilies ?? [];
    assert.ok([...disabled].every(id => !retained.includes(id)), 'A forbidden provider remained in the runtime');
    return { code, mode, projection, target, completed: board.levelsCompleted, disabled: [...disabled], installedGuards, guardHits,
      actions: snapshot.actionCount, reason: snapshot.reason ?? snapshot.status, levels,
      providers: Object.fromEntries(usage), primitives: Object.fromEntries(primitives), verifiedReuse,
      victoryReviews: snapshot.victoryReviews?.map(review => ({ level: review.level, action: review.winningAction,
        goal: review.hypothesis?.label ?? null, checks: review.checks.length })) ?? [],
      entryReviews: [...entryReviews.values()],
      commands: commands.digest('hex'), trajectory: trajectory.digest('hex') };
  } finally {
    agent.dispose();
  }
}

try {
  console.log(JSON.stringify(await run()));
} finally {
  hook?.deregister();
  delete globalThis[guardToken];
}
