import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_SMLP_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { ConfiguredArrivals, configuredPatch, configuredScene, configuredTrajectories }: typeof import('../src/logos-engine/v6-configured-arrivals.ts') =
  await import(moduleURL('src/logos-engine/v6-configured-arrivals.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const gz = (path: string) => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString());
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const archive = gz('../docs/migration/native-campaigns-v57/baseline-smlp/smlp-public-trace.json.gz').packets;
const extra = gz('./fixtures/sic-smlp-alternate-returns.json.gz');
const sessionId = 'sra-v6-' + extra.session;
const configured = 'configured_arrivals', frontier = 'observed_frontier';

function packet(n: number): V6PublicObservation {
  if (n === 16) return extra.lastReturn;
  const p = archive[n].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, level: p.level, levelsCompleted: p.levels_completed,
    state: p.state, stepIndex: p.step_index, availableActionIds: p.available_action_refs.map((key: string) => Number(key.slice(6))) };
}
async function start(live = false) {
  const backend = live && process.env.SIC_SMLP_GAME_ROOT ? await sourceBackend(process.env.SIC_SMLP_GAME_ROOT) : null;
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const { palette, ...actual } = toV6PublicObservation(backend.dispatch(request), n);
    assert.deepEqual(actual, expected, 'official SMLP return ' + n);
    return { ...actual, palette };
  }
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'SMLP', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')!;
      assert.equal(guard.admitted, true);
      return { p, guard, owner: reply.snapshot.lastDecision, command: reply.command! };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1), onlyLastFrame = false) {
      const { actionRef, data } = reply.command!;
      const actual = observe({ type: 'action', actionId: Number(actionRef.slice(6)), ...(data?.x === undefined ? {} : { data }) }, expected, ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0,
        observation: onlyLastFrame ? { ...actual, frames: [actual.frame] } : actual });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
type Game = Awaited<ReturnType<typeof start>>;
function historical(d: Awaited<ReturnType<Game['decision']>>, n: number) {
  const cmd = n === 16 ? { action_ref: 'ACTION5', data: {} } : archive[n].command;
  assert.deepEqual([d.command.actionRef, d.command.data], [cmd.action_ref, cmd.data ?? {}]);
}
async function prefix(game: Game, n: number) {
  for (let i = 1; i <= n; i++) {
    historical(await game.decision(), i);
    await game.advance();
  }
}
test('6 observes the first race and reuses the route and arrival operators on multiple real configurations', async t => {
  const record = t.mock.method(ConfiguredArrivals.prototype, 'record'), game = await start(true);
  const qual = ConfiguredArrivals.prototype.qualifyRoutes;
  let rejectedCoincidence = false;
  t.mock.method(ConfiguredArrivals.prototype, 'qualifyRoutes', function (this: ConfiguredArrivals, ...args: Parameters<typeof qual>) {
    const [scene, nodes, routes, observation, edits, requireCoincidence, execution] = args;
    if (observation.revision === 10) {
      assert.equal(requireCoincidence, false);
      assert.equal(qual.call(this, scene, nodes, routes, observation, edits, true, execution), null);
      rejectedCoincidence = true;
    }
    return qual.apply(this, args);
  });
  const refs = new Map<number, string>();
  const expectedFits = new Map([[1, [2, 24, 4, { 9: 52, 12: 68 }]], [4, [3, 12, 4, { 9: 84, 12: 148, 15: 68 }]],
    [9, [3, 6, 3, { 9: 42, 12: 24, 15: 48 }]], [11, [3, 3, 3, { 9: 54, 12: 24, 15: 48 }]]]);
  for (let n = 1; n <= 16; n++) {
    const d = await game.decision();
    historical(d, n);
    if (![1, 8, 16].includes(n)) {
      assert.deepEqual([d.owner, d.p.kind, d.p.program_subquestion, d.guard.reason],
        [configured, 'configured_first_arrival_composition', configured, 'current_network_edits_and_start_poses']);
    }
    const { support_plan: plan } = d.p;
    if (n === 2) {
      assert.deepEqual([d.command.data, plan.v5_proof, plan.target, plan.fit.at(-1).evidence], [{ x: 32, y: 26 }, null, [56, 34], refs.get(1)]);
      assert.notDeepEqual(configuredPatch(packet(1).frame, [32, 26]), configuredPatch(packet(2).frame, [32, 26]));
    }
    if ([3, 5, 10, 12].includes(n)) {
      const proof = plan.v5_proof, p = proof.conditional_predictions;
      assert.deepEqual([proof.question, p.length, proof.route_domains.length],
        n === 3 ? ['coincident_first_arrivals', 24, 2] : n === 5 ? ['coincident_first_arrivals', 12, 3] :
          n === 10 ? ['route_order_discrimination', 6, 3] : ['coincident_first_arrivals', 3, 3]);
      assert.ok(proof.route_domains.every((r: Row) => r.status === 'COMPLETE'));
      if (n === 10) {
        assert.ok(new Set(p.map((r: Row) => JSON.stringify(r.arrival_intervals))).size > 1);
        assert.equal(rejectedCoincidence, true);
      } else {
        const tick = n === 12 ? 18 : 17, actors = n === 3 ? ['12', '9'] : ['12', '15', '9'];
        assert.ok(p.every((r: Row) => r.arrival_intervals.every((x: number) => x === tick)));
        assert.equal(proof.dated_cohorts.length, 1);
        assert.deepEqual([proof.dated_cohorts[0].tick, [...proof.dated_cohorts[0].actor_refs].sort()], [tick, actors]);
      }
      assert.ok(d.p.question.hypothesis_refs.includes(refs.get(n - 1)));
    }
    const mark = record.mock.callCount(), out = await game.advance();
    refs.set(n, out.observation_ref);
    const calls = record.mock.calls.slice(mark), events = calls.flatMap(c => c.result?.events ?? []);
    if (expectedFits.has(n)) {
      const event = events.find(e => e.kind === 'public_configured_arrival_packet')!;
      const call = calls.find(c => c.result?.events.includes(event))!;
      const s = configuredScene(call.arguments[3], call.this.grid)!;
      const arrived = Object.fromEntries([...configuredTrajectories(s, call.arguments[7]!)].map(([actor, [path, ticks]]) => {
        assert.deepEqual(path.at(-1), s.target);
        return [actor, ticks.at(-1)];
      }));
      assert.deepEqual([event.tracks, event.compatible_route_orders, event.samples_per_cell, arrived], expectedFits.get(n));
      assert.deepEqual([event.before, event.after], [refs.get(n - 1) ?? call.arguments[0].observation_ref, out.observation_ref]);
    }
    if (n === 2) {
      const event = events.find(e => e.kind === 'configured_local_rewrite')!;
      assert.deepEqual([event.point, event.before, event.after], [[32, 26], refs.get(1), out.observation_ref]);
    }
    if ([3, 7, 15].includes(n)) {
      assert.deepEqual([out.matched, out.reason, packet(n).levelsCompleted], [null, 'official_score_boundary', n === 3 ? 1 : n === 7 ? 2 : 3]);
      assert.ok(events.some(e => e.kind === 'configured_arrival_official_boundary' && e.after === out.observation_ref));
    }
  }
});

test('6 the same launch with only the last image supplies neither arrival order nor the historical edit', async t => {
  const record = t.mock.method(ConfiguredArrivals.prototype, 'record'), game = await start(true);
  historical(await game.decision(), 1);
  await game.advance(packet(1), true);
  const calls = record.mock.calls;
  assert.ok(calls.length > 0);
  assert.ok(calls.every(c => !c.result?.events.some((e: Row) => e.kind === 'public_configured_arrival_packet')));
  const first = await game.decision();
  assert.deepEqual([first.owner, first.command.actionRef, first.command.data], [frontier, 'ACTION6', { x: 10, y: 32 }]);
  await game.advance(extra.endpoint[0]);
  const second = await game.decision();
  assert.deepEqual([second.owner, second.command.data], [frontier, { x: 11, y: 26 }]);
  await game.advance(extra.endpoint[1]);
});

test('6 route-order evidence absent at the same N3 observation suspends the composition, with physical fallback and later reuse', async t => {
  const proposal = ConfiguredArrivals.prototype.propose;
  let withheld = false;
  t.mock.method(ConfiguredArrivals.prototype, 'propose', async function (this: ConfiguredArrivals, ...args: Parameters<typeof proposal>) {
    const result = await proposal.apply(this, args);
    if (args[0].revision !== 10 || result?.support_plan.v5_proof?.question !== 'route_order_discrimination') return result;
    const uncertain = new ConfiguredArrivals(this.policy);
    uncertain.restore(this.state());
    uncertain.fit.at(-1)!.compatible_orders = 0;
    withheld = true;
    const alternative = await proposal.apply(uncertain, args);
    assert.equal(alternative, null);
    return alternative;
  });
  const game = await start(true);
  await prefix(game, 9);
  const fallback = await game.decision();
  assert.equal(withheld, true);
  assert.deepEqual([fallback.owner, fallback.command.data], [frontier, { x: 10, y: 18 }]);
  assert.deepEqual(extra.noOrder[0].frame, packet(9).frame);
  await game.advance(extra.noOrder[0]);
  const resume = await game.decision();
  assert.deepEqual([resume.owner, resume.command.data, resume.p.support_plan.v5_proof.question],
    [configured, { x: 22, y: 21 }, 'route_order_discrimination']);
  assert.equal((await game.advance(extra.noOrder[1])).matched, true);
  const launch = await game.decision();
  assert.deepEqual([launch.owner, launch.command.actionRef], [configured, 'ACTION5']);
  await game.advance(extra.noOrder[2]);
  assert.equal((await game.decision()).p.support_plan.v5_proof.question, 'coincident_first_arrivals');
});
