import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_WA30_ENGINE_ROOT: root, SIC_WA30_RECEIPT: output } = process.env;
const load = path => import(pathToFileURL(resolve(root, 'src', path)));
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const { OrientedCoupling } = await load('logos-engine/v6-oriented-coupling.ts');
const { EffectAccess } = await load('logos-engine/v6-effect-access.ts');
const sessions = [];
let acquisitions, prior;
for (const type of [OrientedCoupling, EffectAccess]) {
  const oldRecord = type.prototype.record;
  function note(record) {
    for (const event of Array.isArray(record) ? record : record?.events ?? []) {
      acquisitions.push({ owner: type.name, kind: event.kind, evidence: event.evidence, delta: event.delta,
        before: event.before_ref, after: event.after_ref, trial: event.trial_key, role: event.role,
        action: event.action, status: event.input_status, expected: event.expected_families, matched: event.matched_families,
        scoreDelta: event.score_delta, vector: event.provisional_vector });
    }
    return record;
  }
  type.prototype.record = function (...args) {
    const result = oldRecord.apply(this, args);
    return result?.then ? result.then(note) : note(result);
  };
}
const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') { sessions.push([]); prior = message.observation.frame; }
  acquisitions = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const r = snapshot.trace.findLast(e => e.kind === 'actual_outcome'), obs = message.observation;
    const changed = obs.frame.reduce((n, row, y) => n + row.filter((v, x) => v !== prior[y][x]).length, 0);
    const packet = createHash('sha256').update(JSON.stringify(obs)).digest('hex');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, owner: r?.family,
      reason: r?.reason, matched: r?.matched, changed, packet, acquisitions });
    prior = obs.frame;
  }
  if (reply.ticket) {
    const p = snapshot.proposal, t = reply.ticket, effect = p.effect_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, offer: p.kind, action: t.actionRef, point: t.data,
      proof: p.question?.hypothesis_refs, site: effect?.site, alternatives: effect?.reachable_contact_alternatives,
      trial: effect?.trial_key, contactProof: effect?.contact_evidence, expected: p.steps?.[t.actionIndex]?.expected_after,
      guard: snapshot.trace.findLast(e => e.kind === 'before_guard')?.reason });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
