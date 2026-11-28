import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceBackend } from './sic-study-source-games.mjs';
import { createDecisionTrace } from './sic-decision-trace.mjs';
import { compareTraces } from './compare-sic-decisions.mjs';

const base = '0aef4289e97ce094782dfd03f5a79ace6eae5fd2';
const [reference, candidate, sha, output] = process.argv.slice(2);
assert.ok(reference && candidate && /^[a-f0-9]{40}$/.test(sha ?? '') && output,
  'Pass REFERENCE-CHECKOUT CANDIDATE-CHECKOUT CANDIDATE-SHA NEW-OUTPUT-DIRECTORY');
assert.equal(process.version, 'v24.22.3');
const directory = resolve(output);
mkdirSync(directory);

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const checkCheckout = (cwd, revision) => {
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), revision);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
};
const assets = ['src/games', 'src/runtime/native-game-dispatcher.ts', 'public/python', 'reference', 'scripts/python-runtime-assets.json'];
git(candidate, 'merge-base', '--is-ancestor', base, sha);
git(candidate, 'diff', '--quiet', base, sha, '--', ...assets);
const cap = 16;

async function capture(checkout, revision, game, mode, label, observe) {
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
  let runtime, board, acted = 0, reply;
  const service = new V6AgentService(async recovery => (runtime = await createNativeV6Runtime(drm, {
    recovery, now: () => 0,
    ...(observe ? { observeControlTrialShadow: receipt => comparisons.push({ turn: acted + 1, receipt }) } : {}),
  })));
  const request = async operation => {
    const result = await service.handle({ ...operation, sessionId });
    recorder.reply(operation, result, runtime.inspectKnowledge());
    return result;
  };
  try {
    const start = { type: 'load', code: game, level: 1 };
    board = await backend.dispatch(start);
    recorder.observe(start, board);
    const recovery = mode === 'sic' ? { ...defaultRecoveryPack, solver: 'sic' } : defaultRecoveryPack;
    reply = await request({ type: 'init', sequence: 0, observation: toV6PublicObservation(board, 0), recovery,
      budgets: { maxActions: cap, levelActionCaps: Array(board.levelCount).fill(cap), targetLevels: board.levelCount,
        parallelWorkers: 1 } });
    while (acted < cap) {
      if (reply.kind === 'boundary') reply = await request({ type: 'resume', sequence: acted });
      assert.equal(reply.kind, 'action', game + ' stopped before the requested prefix: ' + reply.snapshot.reason);
      const { command, ticket } = reply;
      const actionId = Number(command.actionRef.slice(6));
      const action = { type: 'action', actionId, ...(actionId === 6 ? { data: command.data } : {}) };
      board = await backend.dispatch(action);
      recorder.observe(action, board);
      commands.push(command);
      acted++;
      reply = await request({ type: 'advance', sequence: acted, ticketId: ticket.id,
        executionMs: 0, observation: toV6PublicObservation(board, acted) });
    }
  } finally {
    recorder.close();
  }
  writeFileSync(trace, JSON.stringify({ game, level: board.level, turn: acted, kind: 'stop',
    value: { reason: 'comparison_prefix_completed', acted, state: board.state, levels: board.levelsCompleted,
      serviceReason: reply.snapshot.reason } }) + '\n', { flag: 'a' });
  checkCheckout(checkout, revision);
  return { revision, trace, commands, comparisons, levels: board.levelsCompleted };
}

let failed = false;
for (const [game, mode] of [['AS66', 'V6'], ['G50T', 'sic']]) {
  const a = await capture(reference, base, game, mode, 'A', false);
  const b = await capture(candidate, sha, game, mode, 'B', true);
  const native = await compareTraces(a.trace, b.trace);
  const observed = b.comparisons.map(({ turn, receipt }) => ({
    turn, observation: receipt.observationRef, family: receipt.family, action: receipt.action, reference: receipt.reference.selected,
    shadow: receipt.shadow.selected, difference: receipt.firstDifference,
    sameEvidence: JSON.stringify(receipt.reference.evidence) === JSON.stringify(receipt.shadow.evidence),
  }));
  const result = { game, mode, cap, a, b, native, observed };
  writeFileSync(join(directory, game + '.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  const { equal, event, level, turn, kind, field, events, decisions } = native;
  console.log(JSON.stringify({ game, mode, native: { equal, event, level, turn, kind, field, events, decisions },
    shadow: observed }));
  const registered = game === 'AS66'
    ? observed.length === 2 && observed.every((x, i) =>
        x.family === 'sliding_cavity' && x.action === ['ACTION1', 'ACTION4'][i]
        && x.observation.includes(':revision:' + (6 + i) + ':'))
    : JSON.stringify(observed.map(x => x.turn)) === '[1,2,3,4,5,9]'
      && observed.every(x => x.family === 'sic_verify_remote_replay');
  failed ||= !native.equal || native.decisions !== cap || observed.some(x => !x.reference || !x.shadow || !x.sameEvidence || x.difference !== null)
    || !registered;
}
process.exitCode = Number(failed);
