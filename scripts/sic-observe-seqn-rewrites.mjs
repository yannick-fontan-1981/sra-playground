import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_SEQN_ENGINE_ROOT: root, SIC_SEQN_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { ScoredRewriteAccess } = await load('logos-engine/v6-scored-rewrite.ts');
const { partition } = await load('logos-engine/v6-factored-return.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired, pending;
const record = ScoredRewriteAccess.prototype.record;
ScoredRewriteAccess.prototype.record = async function (...args) {
  const events = await record.apply(this, args);
  for (const e of events) {
    if (!['factored_rewrite_sample','factored_rewrite_scored','scored_rewrite_test'].includes(e.kind)) continue;
    acquired.push({ kind: e.kind, before: e.before, after: e.after, action: e.action,
      epoch: e.epoch, outcome: e.outcome, model: e.model, sites: e.predicted_sites });
  }
  return events;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') { sessions.push([]); pending = null; }
  const plan = pending;
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const r = snapshot.trace.findLast(e => e.kind === 'actual_outcome'), o = message.observation;
    const channels = plan?.expected ? partition(o.frame, plan.axis, plan.indices) : null;
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, owner: r?.family,
      matched: r?.matched, reason: r?.reason, seal: r?.seal_prefix, levels: o.levelsCompleted, acquired,
      partition: channels?.map((actual, i) => ({ actual, expected: plan.expected[i], matched: actual === plan.expected[i] })),
      packet: createHash('sha256').update(JSON.stringify([o.frame, o.frames, o.availableActionIds, o.level, o.levelsCompleted, o.state])).digest('hex') });
  }
  if (reply.ticket) {
    const p = snapshot.proposal, t = reply.ticket, factor = p.factor_plan, rewrite = p.rewrite_plan;
    pending = factor ? { axis: factor.axis, indices: factor.indices, expected: factor.steps[t.actionIndex].expected_after } : null;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, id: t.id, ref: t.observationRef, level: t.level,
      owner: snapshot.lastDecision, offer: p.kind, index: t.actionIndex, action: t.actionRef, point: t.data,
      factor: factor && { axis: factor.axis, indices: factor.indices, returned: factor.return_ref,
        witnesses: factor.channel_witnesses, plan: factor.steps.map(step => step.action_ref), expected: pending.expected },
      rewrite: rewrite && { action: rewrite.action, source: rewrite.source, target: rewrite.target, sites: rewrite.sites.map(s => s.origin) },
      evidence: p.question?.hypothesis_refs, guard: snapshot.trace.findLast(e => e.kind === 'before_guard')?.reason });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
