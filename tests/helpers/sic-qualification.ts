import { BrowserGameRuntime } from '../../src/runtime/browser-games.ts';
import { BrowserV6Agent, type V6AgentSnapshot } from '../../src/runtime/v6-agent.ts';
import { defaultRecoveryPack, type RecoveryPack } from '../../src/sic/active-recovery.ts';
import { recoveryRevision } from '../../src/sic/recovery-pack.ts';
import type { AgentAction } from '../../src/runtime/contracts.ts';

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

async function hash(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function run(runtime: BrowserGameRuntime, code: string, target: number, pack: RecoveryPack) {
  let board = await runtime.load(code, 1);
  let state: V6AgentSnapshot | undefined;
  const trace: { action: AgentAction; packet: string }[] = [];
  const agent = new BrowserV6Agent({
    getObservation: () => board,
    canDispatch: () => true,
    recoveryConfiguration: () => pack,
    onState: snapshot => { state = snapshot; },
    dispatch: async action => {
      const started = performance.now();
      board = await runtime.action(action.id, action.id === 6 ? action.data : undefined);
      const executionMs = performance.now() - started;
      const packet = await hash([board.frame, board.frames, board.availableActionIds, board.level, board.levelsCompleted, board.state]);
      trace.push({ action, packet });
      return { observation: board, executionMs };
    },
  });
  try {
    for (let level = 0; level < target; level++) {
      await agent.run(600);
      if (state?.status === 'error') throw new Error(`${code}: ${state.message}`);
      if (board.levelsCompleted <= level || state?.status === 'stopped') break;
    }
    return { actions: trace.length, levels: board.levelsCompleted, stop: state?.reason ?? null, trace };
  } finally {
    agent.dispose();
  }
}

function compare(baseline: Awaited<ReturnType<typeof run>>, alternate: Awaited<ReturnType<typeof run>>) {
  const mismatch = baseline.trace.findIndex((entry, index) => JSON.stringify(entry) !== JSON.stringify(alternate.trace[index]));
  const divergence = mismatch < 0 ? baseline.actions === alternate.actions ? null : baseline.actions + 1 : mismatch + 1;
  return { divergence, changedCommand: divergence ? [baseline.trace[divergence - 1]?.action, alternate.trace[divergence - 1]?.action] : null };
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

start.addEventListener('click', async () => {
  start.disabled = true;
  try {
    await (new URLSearchParams(location.search).has('authored') ? qualifyAuthoredRule() : qualify());
  } catch (error) {
    output.textContent = JSON.stringify({ status: 'failed', error: error instanceof Error ? error.message : String(error) });
  } finally {
    start.disabled = false;
  }
});
