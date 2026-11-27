// Capture each VALV question, its real input response and the next ticket.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from './sic-study-source-games.mjs';

const [revision, destination, option] = process.argv.slice(2);
assert.ok(revision && destination && (!option || ['--retraits', '--frontiere'].includes(option)), 'REVISION OUTPUT [--retraits|--frontiere]');
const bench = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: bench });
const sha = git('rev-parse', revision + '^{commit}').toString().trim();
const ref = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const frozen = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021';
git('diff', '--exit-code', frozen, '--', 'public/python', ref, 'scripts/sic-study-source-games.mjs');
const read = p => JSON.parse(git('show', sha + ':' + ref + '/' + p));
const config = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const digest = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const arms = [
  [44, 2, 'offerEnvelopeFill', 'envelope_fill_experiment'],
  [47, 5, 'offerFieldService', 'field_service_experiment'],
  [48, 11, 'offerFieldTransfer', 'field_service_transfer_experiment'],
];
const engine = mkdtempSync(join(tmpdir(), 'valv-banc-'));
try {
  const tar = join(engine, 'source.tar');
  git('archive', '--format=tar', '--output=' + tar, sha, 'src', 'package.json', 'public/python',
    ref + '/laya_proto', ref + '/morphology_policy');
  execFileSync('tar', ['-xf', tar, '-C', engine]);
  const load = path => import(pathToFileURL(join(engine, 'src', path)).href);
  const { createNativeV6Runtime } = await load('logos-engine/v6-native-runtime.ts');
  const { V6AgentService } = await load('runtime/v6-agent-service.ts');
  const { FieldServiceMemory } = await load('logos-engine/v6-field-service-access.ts');
  const { toV6PublicObservation } = await load('runtime/v6-agent-protocol.ts');
  // Load Pyodide once. Each arm starts a new game and a new service.
  symlinkSync(join(bench, 'public/vendor'), join(engine, 'public/vendor'), process.platform === 'win32' ? 'junction' : 'dir');
  const game = await sourceBackend(engine);
  const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
  const budgets = { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 };
  const prototype = FieldServiceMemory.prototype;
  const original = prototype.record;
  let acquisitions;
  prototype.record = function (...args) {
    const events = original.apply(this, args);
    for (const e of events) {
      const c = e.context;
      acquisitions.push({ kind: e.kind, evidence: e.evidence, changed: e.changed_pixels,
        inside: e.changed_inside_control, outside: e.changed_outside_control, point: e.selected?.point,
        nextPhase: c?.phase, fieldsPreserved: c?.field_contents_preserved, orientationChanged: c?.paired_control_orientation_changed,
        restoredFields: c?.restored_measured_fields, repeatable: c?.repeatable_extent_change,
        boundaryWitness: e.model?.official_boundary_witness, attempts: c?.attempts,
        lastControl: c?.attempted_controls?.at(-1), sourceRevalidated: c?.source_revalidated,
        change: c?.new_field_observations?.at(-1)?.changed_pixels });
    }
    return events;
  };
  async function play(arm, wrongBoundary = false) {
    const runtime = await createNativeV6Runtime(config, { now: () => 0 });
    const service = new V6AgentService(() => runtime);
    let withdrawn = 0;
    const refs = [];
    let altered;
    const transfer = prototype.transferEvent;
    if (wrongBoundary) prototype.transferEvent = function (model, context, stop, evidence) {
      if (refs.length === 10 && model?.official_boundary_witness && !altered) {
        assert.deepEqual(model.official_boundary_witness, evidence);
        const incorrect = [refs[8], evidence[1]];
        assert.match(incorrect[0], /:epoch:1:revision:9:/);
        assert.match(evidence[0], /:epoch:1:revision:10:/);
        assert.match(evidence[1], /:epoch:2:revision:11:/);
        altered = { genuine: evidence, incorrect };
        model = { ...model, official_boundary_witness: incorrect };
      }
      return transfer.call(this, model, context, stop, evidence);
    };
    const method = arm?.[2], originalOffer = method && prototype[method];
    if (arm) prototype[method] = function (...args) {
      const offer = originalOffer.apply(this, args);
      if (args[0].revision !== arm[1] || offer?.kind !== arm[3]) return offer;
      withdrawn++;
      return undefined;
    };
    try {
      const initial = toV6PublicObservation(game.dispatch({ type: 'load', code: 'VALV', level: 1 }), 0);
      let reply = await service.handle({ type: 'init', sessionId, sequence: 0, observation: initial, budgets });
      const rows = [], limit = arm ? arm[1] + 1 : 16;
      const frames = [digest(initial.frame)];
      for (let turn = 1; turn <= limit; turn++) {
        if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence: turn - 1 });
        if (!reply.ticket) break;
        const p = reply.snapshot.proposal, ticket = reply.ticket;
        const plan = p.nested_control_plan, guard = reply.snapshot.trace.findLast(e => e.kind === 'before_guard');
        const row = { turn, level: ticket.level, id: ticket.id, ref: ticket.observationRef, family: reply.snapshot.lastDecision,
          kind: p.kind, phase: plan?.phase, point: ticket.data, action: ticket.actionRef,
          question: p.question?.reason, hypotheses: p.question?.hypothesis_refs, admitted: guard?.admitted };
        assert.equal(row.admitted, true);
        refs.push(ticket.observationRef);
        const board = game.dispatch({ type: 'action', actionId: Number(ticket.actionRef.slice(6)), data: ticket.data });
        const observation = toV6PublicObservation(board, turn);
        frames.push(digest(observation.frame));
        acquisitions = [];
        reply = await service.handle({ type: 'advance', sessionId, sequence: turn, ticketId: ticket.id, observation, executionMs: 0 });
        const outcome = reply.snapshot.trace.findLast(e => e.kind === 'actual_outcome');
        rows.push({ ...row, outcome: { ref: outcome.observation_ref, matched: outcome.matched, reason: outcome.reason }, acquisitions });
      }
      if (wrongBoundary) assert.ok(altered);
      return { withdrawn, altered, frames, rows, final: reply.kind, reason: reply.snapshot.reason };
    } finally {
      if (wrongBoundary) prototype.transferEvent = transfer;
      if (arm) prototype[method] = originalOffer;
    }
  }
  const nominal = await play(null), withdrawals = {};
  for (const [line, turn, , kind] of arms) {
    const expected = line === 44 ? 3 : 6;
    assert.equal(nominal.rows.filter(r => r.kind === kind).length, expected);
    if (option !== '--retraits') continue;
    const result = await play(arms.find(a => a[0] === line));
    assert.deepEqual(result.rows.slice(0, turn - 1), nominal.rows.slice(0, turn - 1));
    const released = result.rows[turn-1];
    assert.ok(result.withdrawn > 0 && released.admitted);
    assert.equal(released.kind, 'nested_control_experiment');
    assert.equal(released.question, 'test_unique_nested_compact_motif');
    assert.deepEqual(released.point, { x: 32, y: line === 48 ? 51 : 50 });
    const receipt = released.acquisitions.find(e => e.kind === 'nested_control_response');
    assert.deepEqual(receipt.evidence, [released.ref, released.outcome.ref]);
    withdrawals[line] = result;
  }
  const boundary = option === '--frontiere' ? await play(null, true) : undefined;
  if (boundary) {
    assert.deepEqual(nominal.rows.slice(0, 9), boundary.rows.slice(0, 9));
    assert.deepEqual(nominal.frames.slice(0, 11), boundary.frames.slice(0, 11));
    assert.deepEqual(nominal.rows[9].outcome, boundary.rows[9].outcome);
    assert.deepEqual(nominal.rows[10].point, { x: 11, y: 35 });
  }
  const report = { boundary, source: sha, srcTree: git('rev-parse', sha + ':src').toString().trim(), sessionId, budgets, nominal, withdrawals };
  writeFileSync(resolve(destination), JSON.stringify(report) + '\n', { flag: 'wx' });
  console.log(sha.slice(0,8), nominal.rows.length, Object.keys(withdrawals));
} finally {
  assert.equal(dirname(realpathSync(engine)), realpathSync(tmpdir()));
  assert.ok(basename(engine).startsWith('valv-banc-'));
  const vendor = join(engine, 'public/vendor');
  if (existsSync(vendor)) unlinkSync(vendor);
  rmSync(engine, { recursive: true, force: true });
}
