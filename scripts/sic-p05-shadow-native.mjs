import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sourceBackend } from './sic-study-source-games.mjs';
import { createDecisionTrace } from './sic-decision-trace.mjs';
import { compareTraces } from './compare-sic-decisions.mjs';

const base = '0aef4289e97ce094782dfd03f5a79ace6eae5fd2';
const [reference, candidate, sha, output, variant] = process.argv.slice(2);
assert.ok(reference && candidate && /^[a-f0-9]{40}$/.test(sha ?? '') && output
  && (variant === undefined || variant === '--active'),
  'Pass REFERENCE-CHECKOUT CANDIDATE-CHECKOUT CANDIDATE-SHA NEW-OUTPUT-DIRECTORY [--active]');
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
async function capture(checkout, revision, game, mode, label, { observe = false, cap = 16, actionBudget } = {}) {
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
    ...(actionBudget === undefined ? {} : { controlTrialAgenda: { mode: 'active', actionBudget } }),
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
  return { revision, trace, commands, comparisons, levels: board.levelsCompleted, cap, actionBudget };
}

let failed = false;
for (const [game, mode] of [['AS66', 'V6'], ['G50T', 'sic']]) {
  const a = await capture(reference, base, game, mode, 'A');
  const b = await capture(candidate, sha, game, mode, 'B', { observe: true, actionBudget: variant === '--active' ? 1 : undefined });
  const native = await compareTraces(a.trace, b.trace);
  const observed = b.comparisons.map(({ turn, receipt }) => ({
    turn, observation: receipt.observationRef, family: receipt.family, action: receipt.action, reference: receipt.reference.selected,
    shadow: receipt.shadow.selected, difference: receipt.firstDifference,
    sameEvidence: JSON.stringify(receipt.reference.evidence) === JSON.stringify(receipt.shadow.evidence),
  }));
  const result = { game, mode, cap: a.cap, a, b, native, observed };
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
  failed ||= !native.equal || native.decisions !== a.cap || observed.some(x => !x.reference || !x.shadow || !x.sameEvidence || x.difference !== null)
    || !registered;
}

if (variant === '--active') {
  const one = await capture(candidate, sha, 'G50T', 'sic', 'local-one', { observe: true, cap: 1, actionBudget: 1 });
  const zero = await capture(candidate, sha, 'G50T', 'sic', 'local-zero', { observe: true, cap: 1, actionBudget: 0 });
  const records = trace => {
    const rows = readFileSync(trace, 'utf8').trimEnd().split('\n').map(JSON.parse);
    const { value: decision } = rows.find(row => row.kind === 'decision');
    const guard = rows.find(row => row.kind === 'native' && row.value.kind === 'before_guard').value;
    const returned = rows.find(row => row.kind === 'native' && row.value.kind === 'actual_outcome').value;
    return { owner: guard.family, strategy: decision.proposal.sicLocalDecision?.strategy,
      command: decision.command, guard: guard.reason, admitted: guard.admitted, returned: returned.reason,
      matched: returned.matched, observations: rows.filter(row => row.kind === 'observation').map(row => row.value) };
  };
  const a = records(one.trace), b = records(zero.trace);
  const first = await compareTraces(one.trace, zero.trace);
  const result = { one, zero, first, before: a, after: b };
  writeFileSync(join(directory, 'budget-zero.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  assert.deepEqual(a.command, { actionRef: 'ACTION1', data: {} });
  assert.deepEqual(b.command, a.command);
  assert.deepEqual(a.observations, b.observations);
  assert.deepEqual([a.owner, b.owner], ['sic_verify_remote_replay', 'sic_public_input_exploration']);
  assert.equal(a.strategy, 'P05');
  assert.ok(a.admitted && b.admitted);
  assert.deepEqual([a.guard, b.guard], ['current_replay_and_carrier_bound', 'current_public_input_bound']);
  assert.deepEqual([a.returned, b.returned], ['compare_replayed_motion_and_remote_return', 'observed_public_input_return']);
  assert.deepEqual([a.matched, b.matched], [null, null]);
  assert.equal(one.comparisons[0]?.receipt.firstDifference, null);
  assert.equal(zero.comparisons[0]?.receipt.firstDifference, 'selected');
  assert.equal(zero.comparisons[0]?.receipt.shadow.selected, false);
  assert.deepEqual(first, { equal: false, game: 'G50T', level: 1, turn: 1, event: 2, kind: 'native',
    field: '/value/family', before: a.owner, after: b.owner });
  const compact = ({ owner, strategy, guard, returned }) => ({ owner, strategy, guard, returned });
  const { event, level, turn, field } = first;
  console.log(JSON.stringify({ budgetZero: { event, level, turn, field, before: compact(a), after: compact(b),
    command: a.command, physicalParity: true } }));
}
process.exitCode = Number(failed);
