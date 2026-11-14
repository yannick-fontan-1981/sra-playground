import { BrowserGameRuntime } from '../../src/runtime/browser-games.ts';
import { BrowserV6Agent, type V6AgentSnapshot } from '../../src/runtime/v6-agent.ts';
import { readNativeResolution, type NativeResolution } from '../../src/sic/native-resolution.ts';
import { defaultRecoveryPack, type RecoveryPack } from '../../src/sic/active-recovery.ts';
import { recoveryRevision } from '../../src/sic/recovery-pack.ts';
import type { AgentAction } from '../../src/runtime/contracts.ts';
import { GAME_CATALOG } from '../../src/games/catalog.ts';
import { compileInformationPreference } from '../../src/sic/information-preference.ts';
import { standalonePlanningFamilies } from '../../src/sic/ordered-contact.ts';

const cases = [
  { game: 'SK48', target: 1, baseline: [19, 1], alternate: [19, 1], divergence: null },
  { game: 'AS66', target: 3, baseline: [19, 3], alternate: [23, 3], divergence: 2 },
  { game: 'SYME', target: 1, baseline: [9, 1], alternate: [9, 1], divergence: null },
  { game: 'LKEY', target: 3, baseline: [44, 3], alternate: [40, 2], divergence: 8, alternateStop: 'frontier_unknown' },
  { game: 'CASC', target: 1, baseline: [1, 0], alternate: [1, 0], divergence: null, baselineStop: 'frontier_unknown', alternateStop: 'frontier_unknown' },
] as const;
const alternativePack: RecoveryPack = { ...defaultRecoveryPack, frontier: { inputOrder: 'command_order' } };
const authoredRule = { title: 'Study recurring directions', commands: 'directions', minimumUsageGap: 1, prefer: 'command_order' } as const;
const start = document.querySelector<HTMLButtonElement>('#qualify')!;
const output = document.querySelector<HTMLElement>('#report')!;

type ObservedStrategy = {
  family: string; strategy: string; entry: string | null; proposal: string; authority: string;
  sequence: number; level: number; action: number; operation: string | null; aim: string | null;
  result?: boolean | null; advanced?: boolean;
};

async function hash(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function run(runtime: BrowserGameRuntime, code: string, target: number | 'complete', pack: RecoveryPack, maxActions?: number,
  onStrategy?: (row: ObservedStrategy) => void) {
  let board = await runtime.load(code, 1);
  const targetLevels = target === 'complete' ? board.levelCount : target;
  let state: V6AgentSnapshot | undefined;
  const trace: { action: AgentAction; packet: string; level: number; levelsCompleted: number }[] = [];
  const information: { sequence: number; strategy: string; predictions: number | null;
    result?: NonNullable<NativeResolution['outcome']>['informationOutcome'];
    preference?: NonNullable<NativeResolution['informationStrategy']>['preference'] }[] = [];
  let opening: NonNullable<NativeResolution['frontierStrategy']>['opening'];
  const modes: { sequence: number; level: number; mode: string; card: string; selected: string | null }[] = [];
  const controlCards: { sequence: number; level: number; mode: string | null; card: string }[] = [];
  let observedStrategy: ObservedStrategy | undefined;
  const agent = new BrowserV6Agent({
    getObservation: () => board,
    canDispatch: () => true,
    recoveryConfiguration: () => pack,
    onState: snapshot => {
      state = snapshot;
      const last = information.at(-1);
      if (last?.sequence === snapshot.sequence && !last.result) last.result = readNativeResolution(snapshot)?.outcome?.informationOutcome;
      if (observedStrategy?.sequence === snapshot.sequence) {
        const checked = readNativeResolution(snapshot)?.outcome;
        if (checked) {
          observedStrategy.result = checked.matched;
          onStrategy?.(observedStrategy);
          observedStrategy = undefined;
        }
      }
    },
    ...(maxActions === undefined ? {} : { maxSessionActions: maxActions }),
    dispatch: async action => {
      const decision = state ? readNativeResolution(state) : null;
      const release = state?.trace.findLast(value => {
        const event = value as Record<string, unknown> | null;
        return event?.kind === 'sic_native_plan' && event.family === decision?.family;
      }) as Record<string, unknown> | undefined;
      if (pack.solver === 'sic') {
        const families = state?.coverage?.registeredFamilies;
        if (!exclusiveFamilies(families) || release?.authority !== 'sicOnly'
          || !release.objective || !release.subObjective || !release.strategy) {
          throw new Error('No exclusive SIC receipt for the pending command.');
        }
      }
      const selection = state?.sicFamilySelection, mode = selection?.reasoning;
      if (mode && (modes.at(-1)?.card !== mode.card || modes.at(-1)?.level !== mode.level)) {
        modes.push({ sequence: trace.length + 1, level: mode.level, mode: mode.mode, card: mode.card, selected: selection.selected });
      }
      if (decision?.missingControl?.trigger) controlCards.push({ sequence: trace.length + 1, level: board.level,
        mode: mode?.mode ?? null, card: decision.missingControl.trigger.id });
      if (onStrategy && decision?.family && decision.proposalKind && state) {
        const bundle = state.proposal as Record<string, unknown> | null;
        const entry = bundle?.material_access_subquestion ?? bundle?.program_subquestion ?? bundle?.field_subquestion
          ?? bundle?.goal_access_subquestion ?? bundle?.strategy_subquestion;
        if (typeof release?.strategy === 'string' && typeof release.authority === 'string') {
          const strategy = decision.frontierStrategy?.opening?.mode === 'active'
            && decision.frontierStrategy.opening.command !== decision.frontierStrategy.opening.baseline
            ? 'opening_curiosity' : release.strategy;
          observedStrategy = { family: decision.family, strategy, entry: typeof entry === 'string' ? entry : null,
            proposal: decision.proposalKind, authority: release.authority, sequence: trace.length + 1, level: board.level,
            action: action.id, operation: decision.operation, aim: decision.question };
        }
      }
      const strategy = decision?.informationStrategy;
      if (!trace.length) opening = decision?.frontierStrategy?.opening;
      if (strategy) information.push({ sequence: trace.length + 1, strategy: strategy.title, predictions: strategy.distinctOutcomes,
        preference: strategy.preference });
      const started = performance.now();
      board = await runtime.action(action.id, action.id === 6 ? action.data : undefined);
      if (observedStrategy) observedStrategy.advanced = board.level > observedStrategy.level || board.state === 'WIN';
      const executionMs = performance.now() - started;
      const packet = await hash([board.frame, board.frames, board.availableActionIds, board.level, board.levelsCompleted, board.state]);
      trace.push({ action, packet, level: board.level, levelsCompleted: board.levelsCompleted });
      return { observation: board, executionMs };
    },
  });
  try {
    for (let level = 0; level < targetLevels; level++) {
      await agent.run(600);
      if (state?.status === 'error') throw new Error(`${code}: ${state.message}`);
      if (board.levelsCompleted <= level || state?.status === 'stopped') break;
    }
    return { actions: trace.length, levels: board.levelsCompleted, stop: state?.reason ?? null, trace, targetLevels, boardState: board.state,
      coverage: state?.sicActionCoverage, families: state?.coverage?.registeredFamilies,
      guard: state?.trace.findLast(value => (value as { kind?: string } | null)?.kind === 'before_guard'),
      selection: state?.sicFamilySelection, information, opening, modes, controlCards };
  } finally {
    agent.dispose();
  }
}

function exclusiveFamilies(families: readonly string[] | undefined) {
  return families?.length === standalonePlanningFamilies.length && standalonePlanningFamilies.every(family => families.includes(family));
}

async function qualifySicOnly(parameters: URLSearchParams) {
  const games = parameters.get('games')?.split(',') ?? GAME_CATALOG.filter(game => game.availability === 'playable').map(game => game.code);
  const maxActions = Number(parameters.get('actions') ?? 600);
  if (!Number.isSafeInteger(maxActions) || maxActions < 1 || maxActions > 600) throw new Error('Expected an action limit from 1 to 600.');
  const runtime = new BrowserGameRuntime();
  const results = [];
  const pack: RecoveryPack = { ...defaultRecoveryPack, solver: 'sic' };
  try {
    for (const game of games) {
      output.textContent = JSON.stringify({ status: 'running', game, results }, null, 2);
      try {
        const operations = new Set<string>();
        const strategies = new Map<string, { commands: number; contradictedAt: number[] }>();
        const result = await run(runtime, game, 'complete', pack, maxActions, row => {
          if (row.operation) operations.add(row.operation);
          const entry = strategies.get(row.strategy) ?? { commands: 0, contradictedAt: [] };
          entry.commands++;
          if (row.result === false) entry.contradictedAt.push(row.sequence);
          strategies.set(row.strategy, entry);
        });
        const qualified = exclusiveFamilies(result.families)
          && (result.coverage?.sicOnly ?? 0) === result.actions;
        results.push({ game, qualified, levels: result.levels, total: result.targetLevels, actions: result.actions,
          state: result.boardState, stop: result.stop, operations: [...operations], strategies: Object.fromEntries(strategies),
          levelEnds: result.trace.flatMap((entry, index) => entry.levelsCompleted > (result.trace[index - 1]?.levelsCompleted ?? 0) ? [index + 1] : []),
          traceDigest: await hash(result.trace),
          ...(result.stop === 'no_admissible_prefix' ? { guard: result.guard } : {}) });
      } catch (error) {
        results.push({ game, error: error instanceof Error ? error.message : String(error) });
      }
    }
    output.textContent = JSON.stringify({ status: 'completed', results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

async function inventoryStrategies(parameters: URLSearchParams) {
  const games = parameters.get('games')?.split(',');
  const maxActions = Number(parameters.get('actions') ?? 16);
  if (!Number.isSafeInteger(maxActions) || maxActions < 1 || maxActions > 600) throw new Error('Expected an action limit from 1 to 600.');
  const selected = games ?? GAME_CATALOG.filter(game => game.availability === 'playable').map(game => game.code);
  const shard = Number(parameters.get('shard') ?? 0), shards = Number(parameters.get('shards') ?? 1);
  if (!Number.isSafeInteger(shard) || !Number.isSafeInteger(shards) || shards < 1 || shard < 0 || shard >= shards) {
    throw new Error('Invalid inventory shard.');
  }
  const scope = selected.filter((_, index) => index % shards === shard);
  const openingCuriosity = parameters.has('curious') ? 'active' as const : undefined;
  const runtime = new BrowserGameRuntime();
  const strategies = new Map<string, { count: number; games: string[]; witness: ObservedStrategy & { game: string } }>();
  const results: { game: string; actions?: number; levels?: number; observed?: number; stop?: string | null; error?: string }[] = [];
  const publish = (status: string, running?: string) => {
    output.textContent = JSON.stringify({ status, running, maxActions, openingCuriosity: openingCuriosity ?? 'native',
      results, strategies: [...strategies.values()] }, null, 2);
  };
  try {
    for (const game of scope) {
      publish('running', game);
      let observed = 0;
      try {
        const result = await run(runtime, game, 'complete', { ...defaultRecoveryPack, ...(openingCuriosity ? { openingCuriosity } : {}) }, maxActions, row => {
          const key = JSON.stringify([row.family, row.strategy, row.entry, row.proposal]);
          const existing = strategies.get(key);
          if (existing) {
            existing.count++;
            if (!existing.games.includes(game)) existing.games.push(game);
          } else strategies.set(key, { count: 1, games: [game], witness: { game, ...row } });
          observed++;
        });
        results.push({ game, actions: result.actions, levels: result.levels, observed, stop: result.stop });
      } catch (error) {
        results.push({ game, observed, error: error instanceof Error ? error.message : String(error) });
      }
    }
    publish('completed');
  } finally {
    runtime.dispose();
  }
}

function compare(baseline: Awaited<ReturnType<typeof run>>, alternate: Awaited<ReturnType<typeof run>>) {
  const mismatch = baseline.trace.findIndex((entry, index) => JSON.stringify(entry) !== JSON.stringify(alternate.trace[index]));
  const divergence = mismatch < 0 ? baseline.actions === alternate.actions ? null : baseline.actions + 1 : mismatch + 1;
  return { divergence, changedCommand: divergence ? [baseline.trace[divergence - 1]?.action, alternate.trace[divergence - 1]?.action] : null };
}

async function qualifyInformationPriority(parameters: URLSearchParams) {
  const games = parameters.get('games')?.split(',') ?? ['LOGI', 'REWI', 'GLOB', 'EVAS', 'UPST', 'ONDE'];
  const cap = Number(parameters.get('actions') ?? 16);
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > 600) throw new Error('Expected an action limit from 1 to 600.');
  const preference = compileInformationPreference({ mode: 'shadow',
    strategy: parameters.get('prefer') ?? 'point_contrast', minimumOutcomes: Number(parameters.get('outcomes') ?? 2) });
  const runtime = new BrowserGameRuntime();
  const results = [];
  try {
    for (const game of games) {
      output.textContent = JSON.stringify({ status: 'running', game, results });
      const baseline = await run(runtime, game, 'complete', defaultRecoveryPack, cap);
      const shadow = await run(runtime, game, 'complete', { ...defaultRecoveryPack, informationPreference: preference }, cap);
      const active = await run(runtime, game, 'complete', { ...defaultRecoveryPack, informationPreference: { ...preference, mode: 'active' } }, cap);
      const summary = (value: typeof baseline) => ({ actions: value.actions, levels: value.levels, stop: value.stop, state: value.boardState,
        experiments: value.information.length, matching: value.information.filter(item => item.preference?.preferred).length,
        differentOffers: value.information.filter(item => item.preference?.preferred && item.preference.preferred !== item.preference.baseline)
          .map(({ sequence, preference }) => ({ sequence, ...preference })) });
      results.push({ game, baseline: summary(baseline), shadow: summary(shadow), active: summary(active),
        sameShadow: compare(baseline, shadow).divergence === null && baseline.stop === shadow.stop && baseline.boardState === shadow.boardState,
        ...compare(baseline, active) });
    }
    output.textContent = JSON.stringify({ status: results.every(row => row.sameShadow) ? 'passed' : 'failed', preference, results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

async function qualify() {
  const runtime = new BrowserGameRuntime();
  const results = [];
  try {
    for (const fixture of cases) {
      output.textContent = JSON.stringify({ status: 'running', game: fixture.game, results }, null, 2);
      const baseline = await run(runtime, fixture.game, fixture.target, defaultRecoveryPack);
      const alternate = await run(runtime, fixture.game, fixture.target, alternativePack);
      const promoted = await run(runtime, fixture.game, fixture.target, defaultRecoveryPack);
      const { divergence, changedCommand: firstDifferentCommand } = compare(baseline, alternate);
      const rollbackMatches = JSON.stringify(promoted) === JSON.stringify(baseline);
      const passed = baseline.actions === fixture.baseline[0] && baseline.levels === fixture.baseline[1]
        && alternate.actions === fixture.alternate[0] && alternate.levels === fixture.alternate[1] && divergence === fixture.divergence
        && baseline.stop === ('baselineStop' in fixture ? fixture.baselineStop : null)
        && alternate.stop === ('alternateStop' in fixture ? fixture.alternateStop : null) && rollbackMatches;
      results.push({ game: fixture.game, passed, divergence, firstDifferentCommand, rollbackMatches,
        baseline: { actions: baseline.actions, levels: baseline.levels, stop: baseline.stop, traceDigest: await hash(baseline.trace) },
        alternate: { actions: alternate.actions, levels: alternate.levels, stop: alternate.stop, traceDigest: await hash(alternate.trace) },
      });
    }
    output.textContent = JSON.stringify({ status: results.every(result => result.passed) ? 'passed' : 'failed',
      baselinePack: recoveryRevision(defaultRecoveryPack).digest, alternatePack: recoveryRevision(alternativePack).digest,
      alternatePreservesProgress: results.every(result => result.alternate.levels >= result.baseline.levels), results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

async function qualifyAuthoredRule() {
  const runtime = new BrowserGameRuntime();
  try {
    const results = [];
    for (const fixture of cases) {
      output.textContent = JSON.stringify({ status: 'running', game: fixture.game, results }, null, 2);
      const pack = (mode: 'shadow' | 'active'): RecoveryPack => ({ ...defaultRecoveryPack,
        frontier: { inputOrder: 'least_tried', localRule: { ...authoredRule, mode } } });
      const baseline = await run(runtime, fixture.game, fixture.target, defaultRecoveryPack);
      const shadow = await run(runtime, fixture.game, fixture.target, pack('shadow'));
      const active = await run(runtime, fixture.game, fixture.target, pack('active'));
      results.push({ game: fixture.game, baseline: { actions: baseline.actions, levels: baseline.levels },
        active: { actions: active.actions, levels: active.levels, stop: active.stop },
        ...compare(baseline, active), matchedShadow: JSON.stringify(shadow) === JSON.stringify(baseline) });
    }
    output.textContent = JSON.stringify({ status: results.every(row => row.matchedShadow) ? 'passed' : 'failed',
      activePreservesProgress: results.every(row => row.active.levels >= row.baseline.levels), results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

async function qualifyActionCoverage() {
  const runtime = new BrowserGameRuntime();
  try {
    const results = [];
    for (const fixture of cases) {
      output.textContent = JSON.stringify({ status: 'running', game: fixture.game, results }, null, 2);
      const { coverage, actions, levels } = await run(runtime, fixture.game, fixture.target, defaultRecoveryPack);
      if (!coverage || Object.values(coverage).reduce((sum, count) => sum + count, 0) !== actions
        || actions !== fixture.baseline[0] || levels !== fixture.baseline[1]) throw new Error(`${fixture.game}: command coverage or outcome differs from its expected total.`);
      results.push({ game: fixture.game, actions, levels, coverage });
    }
    output.textContent = JSON.stringify({ status: 'passed', results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

async function qualifyFamilyAgenda(gameFilter: string | null) {
  const runtime = new BrowserGameRuntime();
  try {
    const results = [];
    const requested = gameFilter?.split(',');
    const selected = requested ? cases.filter(fixture => requested.includes(fixture.game)) : cases;
    if (!selected.length) throw new Error('No matching qualification game.');
    for (const fixture of selected) {
      output.textContent = JSON.stringify({ status: 'running', game: fixture.game, results }, null, 2);
      const baseline = await run(runtime, fixture.game, fixture.target, { ...defaultRecoveryPack, familyAgenda: 'native' });
      const shadow = await run(runtime, fixture.game, fixture.target, { ...defaultRecoveryPack, familyAgenda: 'shadow' });
      const active = await run(runtime, fixture.game, fixture.target, { ...defaultRecoveryPack, familyAgenda: 'active' });
      const equalResult = (candidate: typeof active) => compare(baseline, candidate).divergence === null
        && candidate.levels === baseline.levels && candidate.stop === baseline.stop;
      results.push({ game: fixture.game, actions: active.actions, levels: active.levels, stop: active.stop,
        traceDigest: await hash(active.trace), coverage: active.coverage,
        matchesShadow: equalResult(shadow) && shadow.selection?.matchesSource === true,
        matchesActive: equalResult(active) && active.selection?.mode === 'active',
        baselineExpected: baseline.actions === fixture.baseline[0] && baseline.levels === fixture.baseline[1] });
    }
    output.textContent = JSON.stringify({ status: results.every(row => row.matchesShadow && row.matchesActive && row.baselineExpected) ? 'passed' : 'failed', results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

async function qualifyReasoningModes(gameFilter: string | null) {
  const runtime = new BrowserGameRuntime();
  const results = [];
  try {
    const requested = gameFilter?.split(',') ?? ['SK48', 'AS66', 'SYME', 'LKEY', 'CASC', 'LOGI', 'DC22'];
    for (const game of requested) {
      output.textContent = JSON.stringify({ status: 'running', game, results });
      const target = cases.find(item => item.game === game)?.target ?? 2;
      const baseline = await run(runtime, game, target, defaultRecoveryPack, 50);
      const adaptive = await run(runtime, game, target, { ...defaultRecoveryPack, reasoningMode: 'adaptive' }, 50);
      results.push({ game, baseline: [baseline.actions, baseline.levels, baseline.stop], adaptive: [adaptive.actions, adaptive.levels, adaptive.stop],
        ...compare(baseline, adaptive), modeChanges: adaptive.modes.slice(0, 8), totalModeChanges: adaptive.modes.length,
        controlCards: adaptive.controlCards.slice(0, 8), totalControlCards: adaptive.controlCards.length });
    }
    output.textContent = JSON.stringify({ status: 'completed', results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

async function findInformationExperiments() {
  const runtime = new BrowserGameRuntime();
  const results = [];
  try {
    for (const game of ['LS20', 'AR25', 'LP85', 'TR87', 'CATR', 'SMLP']) {
      output.textContent = JSON.stringify({ status: 'running', game, results }, null, 2);
      const { actions, levels, information } = await run(runtime, game, 2, defaultRecoveryPack, 32);
      results.push({ game, actions, levels, information });
      if (information.some(item => item.result)) break;
    }
    output.textContent = JSON.stringify({ status: 'completed', results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

async function qualifyOpeningCuriosity() {
  const runtime = new BrowserGameRuntime();
  const results = [];
  try {
    for (const game of ['CONN', 'TICT', 'DAME', 'DICO', 'LIFE', 'GMAP', 'KATA', 'POLA', 'HOLE', 'MIND', 'CLRS']) {
      output.textContent = JSON.stringify({ status: 'running', game, results }, null, 2);
      const baseline = await run(runtime, game, 1, defaultRecoveryPack, 1);
      const shadow = await run(runtime, game, 1, { ...defaultRecoveryPack, openingCuriosity: 'shadow' }, 1);
      const active = shadow.opening ? await run(runtime, game, 1, { ...defaultRecoveryPack, openingCuriosity: 'active' }, 1) : null;
      results.push({ game, baseline: baseline.trace[0]?.action, shadowIdentical: compare(baseline, shadow).divergence === null,
        candidate: shadow.opening, active: active?.trace[0]?.action, activeCandidate: active?.opening });
      if (results.filter(row => row.candidate).length >= 2) break;
    }
    output.textContent = JSON.stringify({ status: 'completed', results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

async function qualifyOpeningCampaigns(gameFilter: string | null) {
  const requested = gameFilter?.split(',');
  const scenarios = [{ game: 'DICO', target: 'complete' as const }, ...cases];
  const selected = requested ? scenarios.filter(row => requested.includes(row.game)) : scenarios;
  if (!selected.length) throw new Error('No matching opening campaign.');
  const runtime = new BrowserGameRuntime();
  const results = [];
  try {
    for (const { game, target } of selected) {
      output.textContent = JSON.stringify({ status: 'running', game, phase: 'baseline', results }, null, 2);
      const baseline = await run(runtime, game, target, defaultRecoveryPack);
      output.textContent = JSON.stringify({ status: 'running', game, phase: 'shadow', results }, null, 2);
      const shadow = await run(runtime, game, target, { ...defaultRecoveryPack, openingCuriosity: 'shadow' });
      output.textContent = JSON.stringify({ status: 'running', game, phase: 'active', results }, null, 2);
      const active = await run(runtime, game, target, { ...defaultRecoveryPack, openingCuriosity: 'active' });
      const digestCampaign = async (campaign: typeof active) => ({ actions: campaign.actions, levels: campaign.levels,
        state: campaign.boardState, stop: campaign.stop, digest: await hash(campaign.trace), opening: campaign.opening,
        levelEnds: campaign.trace.flatMap((entry, index) => entry.levelsCompleted > (campaign.trace[index - 1]?.levelsCompleted ?? 0) ? [index + 1] : []) });
      results.push({ game, target: baseline.targetLevels, baseline: await digestCampaign(baseline), active: await digestCampaign(active),
        shadowIdentical: compare(baseline, shadow).divergence === null && baseline.stop === shadow.stop && baseline.boardState === shadow.boardState,
        ...compare(baseline, active) });
      output.textContent = JSON.stringify({ status: 'running', game, phase: 'completed', results }, null, 2);
    }
    output.textContent = JSON.stringify({ status: 'completed', results }, null, 2);
  } finally {
    runtime.dispose();
  }
}

start.addEventListener('click', async () => {
  start.disabled = true;
  try {
    const parameters = new URLSearchParams(location.search);
    await (parameters.has('sic-only') ? qualifySicOnly(parameters)
      : parameters.has('strategy-inventory') ? inventoryStrategies(parameters)
      : parameters.has('information-priority') ? qualifyInformationPriority(parameters)
      : parameters.has('reasoning-modes') ? qualifyReasoningModes(parameters.get('games'))
      : parameters.has('opening-campaign') ? qualifyOpeningCampaigns(parameters.get('games'))
      : parameters.has('opening') ? qualifyOpeningCuriosity() : parameters.has('information') ? findInformationExperiments()
      : parameters.has('family') ? qualifyFamilyAgenda(parameters.get('games')) : parameters.has('coverage') ? qualifyActionCoverage()
      : parameters.has('authored') ? qualifyAuthoredRule() : qualify());
  } catch (error) {
    output.textContent = JSON.stringify({ status: 'failed', error: error instanceof Error ? error.message : String(error) });
  } finally {
    start.disabled = false;
  }
});
