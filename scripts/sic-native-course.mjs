import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceBackend } from './sic-study-source-games.mjs';
import { createDecisionTrace } from './sic-decision-trace.mjs';

export const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const checkCheckout = (cwd, revision) => {
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), revision);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
};
export const assets = ['src/games', 'src/runtime/native-game-dispatcher.ts', 'public/python', 'reference', 'scripts/python-runtime-assets.json'];

export async function captureNativeCourse(directory, checkout, revision, game, mode, label, {
  observe = false, cap = 16, actionBudget, levelActionCaps, stopAfter = cap, allowStopped = false,
  configureRuntime, onReply,
} = {}) {
  checkCheckout(checkout, revision);
  execFileSync(process.execPath, ['scripts/prepare-python.mjs'], { cwd: checkout });
  const load = path => import(pathToFileURL(resolve(checkout, 'src', path)).href);
  const { createNativeV6Runtime } = await load('logos-engine/v6-native-runtime.ts');
  const { createGameDispatcher } = await load('runtime/native-game-dispatcher.ts');
  const { V6AgentService } = await load('runtime/v6-agent-service.ts');
  const { toV6PublicObservation } = await load('runtime/v6-agent-protocol.ts');
  const { defaultRecoveryPack } = await load('sic/active-recovery.ts');
  const declarations = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  const read = path => JSON.parse(readFileSync(resolve(checkout, declarations, path), 'utf8'));
  const drm = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
  const backend = createGameDispatcher(() => sourceBackend(resolve(checkout)));
  const trace = join(directory, game + '-' + label + '.jsonl');
  const recorder = createDecisionTrace(trace, game);
  const comparisons = [];
  const commands = [];
  const sessionId = 'sra-v6-98d555fa-6cf9-42fc-b483-9225bfc834d9';
  let runtime, board, acted = 0, levelTurn = 1, reply;
  const service = new V6AgentService(async recovery => {
    runtime = await createNativeV6Runtime(drm, {
      recovery, now: () => 0,
      ...(observe ? { observeControlTrialShadow: receipt => comparisons.push({ turn: acted + 1, level: board.level, levelTurn, receipt }) } : {}),
      ...(actionBudget === undefined ? {} : { controlTrialAgenda: { mode: 'active', actionBudget } }),
    });
    configureRuntime?.(runtime);
    return runtime;
  });
  const request = async operation => {
    const result = await service.handle({ ...operation, sessionId });
    recorder.reply(operation, result, runtime.inspectKnowledge());
    onReply?.(runtime, operation, result);
    return result;
  };
  try {
    const start = { type: 'load', code: game, level: 1 };
    board = await backend.dispatch(start);
    recorder.observe(start, board);
    const recovery = mode === 'sic' ? { ...defaultRecoveryPack, solver: 'sic' } : defaultRecoveryPack;
    reply = await request({ type: 'init', sequence: 0, observation: toV6PublicObservation(board, 0), recovery,
      budgets: { maxActions: cap, levelActionCaps: levelActionCaps ?? Array(board.levelCount).fill(cap), targetLevels: board.levelCount,
        parallelWorkers: 1 } });
    while (acted < stopAfter) {
      if (reply.kind === 'boundary') reply = await request({ type: 'resume', sequence: acted });
      if (allowStopped && reply.kind !== 'action') break;
      assert.equal(reply.kind, 'action', game + ' stopped before the requested prefix: ' + reply.snapshot.reason);
      const { command, ticket } = reply;
      const actionId = Number(command.actionRef.slice(6));
      const action = { type: 'action', actionId, ...(actionId === 6 ? { data: command.data } : {}) };
      const level = board.level;
      board = await backend.dispatch(action);
      levelTurn = board.level === level ? levelTurn + 1 : 1;
      recorder.observe(action, board);
      commands.push(command);
      acted++;
      reply = await request({ type: 'advance', sequence: acted, ticketId: ticket.id,
        executionMs: 0, observation: toV6PublicObservation(board, acted) });
    }
  } finally {
    recorder.close();
  }
  writeFileSync(trace, JSON.stringify({ game, level: board.level, turn: Math.max(1, acted), kind: 'stop',
    value: { reason: acted === stopAfter ? 'comparison_prefix_completed' : 'service_stopped', acted, state: board.state, levels: board.levelsCompleted,
      serviceReason: reply.snapshot.reason } }) + '\n', { flag: 'a' });
  checkCheckout(checkout, revision);
  return { revision, trace, commands, comparisons, levels: board.levelsCompleted, cap, actionBudget, serviceReason: reply.snapshot.reason };
}
