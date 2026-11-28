import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mock } from 'node:test';
import { observeFrontier, digest } from './observation.mjs';
import { predict } from './prediction.mjs';

const [scenario = 'fixture', observation = 'on', vendor, engine] = process.argv.slice(2);
const root = engine ?? new URL('../../../', import.meta.url);
const native = path => import(new URL('src/' + path, root));
const records = [];
if (observation === 'on') observeFrontier(seal => records.push({ seal, prediction: predict(seal) }), root);
// Imports dynamiques pour que le module natif soit chargé après l'installation de la sonde.
const { createNativeV6Runtime } = await native('logos-engine/v6-native-runtime.ts');
const { V6AgentService } = await native('runtime/v6-agent-service.ts');
const { V6_DEFAULT_ACTIONS_PER_LEVEL, toV6PublicObservation } = await native('runtime/v6-agent-protocol.ts');
const { defaultRecoveryPack } = await native('sic/active-recovery.ts');
const { defaultBrowserFamilyAgenda } = await native('sic/family-agenda.ts');
const source = new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', root);
const read = async path => JSON.parse(await readFile(new URL(path, source), 'utf8'));
const declarations = { common: await read('laya_proto/common_frontier_policy.drm.json'), strategy: await read('morphology_policy/strategy.drm') };
// Réglage effectif de v6-agent-worker.ts pour le pack de l'inventaire navigateur.
const service = new V6AgentService(recovery => createNativeV6Runtime(declarations, {
  recovery: { ...recovery, familyAgenda: recovery.familyAgenda ?? defaultBrowserFamilyAgenda }, now: () => 0,
}));

function fixture() {
  const board = (color, inputs) => {
    const frame = Array.from({ length: 64 }, () => Array(64).fill(color));
    return { frame, frames: [frame], availableActionIds: inputs, state: 'NOT_FINISHED', level: 1, levelCount: 1, levelsCompleted: 0 };
  };
  const a = board(0, [4]), b = board(1, [1, 2, 3]);
  let current = b;
  return { initial: current, step(id) {
    assert.ok(current.availableActionIds.includes(id));
    current = current === a || id === 3 ? b : a;
    return current;
  } };
}

const game = scenario === 'fixture' ? fixture() : await (await import('./game.mjs')).loadGame(scenario, vendor, root);
const cap = { fixture: 8, REGN: 16, G50T: 1 }[scenario];
assert.ok(cap);
let board = game.initial;
const packet = stepIndex => scenario === 'fixture' ? { frame: board.frame, frames: board.frames,
  availableActionIds: board.availableActionIds, level: board.level, levelsCompleted: board.levelsCompleted,
  state: board.state, stepIndex } : toV6PublicObservation({ ...board, gameCode: board.code ?? board.gameCode }, stepIndex);
const sessionId = 'frontier-qualification';
// Le journal du magasin horodate ses écritures indépendamment du budget du planificateur.
mock.method(Date, 'now', () => 1700000000000);
const budgets = { targetLevels: board.levelCount, levelActionCaps: Array(board.levelCount).fill(V6_DEFAULT_ACTIONS_PER_LEVEL) };
let result = await service.handle({ type: 'init', sessionId, sequence: 0, observation: packet(0), budgets, recovery: defaultRecoveryPack });
const released = [], boundaries = [];
let stop = null;
for (let sequence = 0; sequence < cap; sequence++) {
  let resumes = 0;
  while (result.kind === 'boundary' && resumes++ < 8) result = await service.handle({ type: 'resume', sessionId, sequence });
  if (!result.ticket) {
    const refused = result.snapshot.trace.findLast(e => e.kind === 'sic_frontier_refusal');
    stop = { reason: result.reason, kind: result.kind, ticket: result.ticket, ref: refused?.observation_ref,
      need: refused?.decision?.need, graphChain: result.snapshot.graphChain };
    break;
  }
  const ticket = result.ticket;
  const plan = result.snapshot.trace.findLast(e => e.kind === 'sic_native_plan');
  const p = result.snapshot.proposal;
  const frontier = p?.sic_frontier_decision;
  const global = result.snapshot.sicFamilySelection;
  released.push({ sequence: sequence + 1, level: board.level, ticket, family: plan?.family, strategy: plan?.strategy,
    global: global && { selected: global.selected, visited: global.visited, mode: global.mode },
    kind: p?.kind, observation: plan?.observationRef, question: frontier?.objective?.id,
    need: frontier?.need?.id, accessNeed: frontier?.prerequisite?.id });
  board = await game.step(Number(ticket.actionRef.slice(6)), ticket.data);
  result = await service.handle({ type: 'advance', sessionId, sequence: sequence + 1, ticketId: ticket.id, observation: packet(sequence + 1), executionMs: 0 });
  const event = result.snapshot.trace.findLast(e => e.kind === 'actual_outcome');
  assert.ok(event?.observation_ref.includes(':revision:' + (sequence + 2) + ':'), 'retour du geste courant');
  boundaries.push({ sequence: sequence + 1, ticket: ticket.id, ref: event.observation_ref, family: event.family,
    matched: event.matched, status: event.status, plan: event.sic_plan, outcome: event.sic_frontier_outcome,
    graphChain: result.snapshot.graphChain, nativeDigest: result.snapshot.nativeExecutionDigest });
}
process.stdout.write(JSON.stringify({ native: { released, boundaries, stop }, records,
  nativeDigest: digest({ released, boundaries, stop }) }));
