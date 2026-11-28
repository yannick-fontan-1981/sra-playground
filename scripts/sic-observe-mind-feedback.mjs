import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_MIND_ENGINE_ROOT: root, SIC_MIND_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { FeedbackSequences } = await load('logos-engine/v6-feedback-sequences.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
let acquired;
const record = FeedbackSequences.prototype.record;
FeedbackSequences.prototype.record = async function (...args) {
  const r = await record.apply(this, args);
  const event = r.event;
  acquired.push({ status: r.status, evidence: r.evidence, matches: r.matches,
    ref: event?.ref, before: event?.before, value: event?.value, values: event?.values,
    marks: event?.marks, revalidation: event?.method_revalidation,
    history: this.state().history.map(item => item.ref) });
  return r;
};
const handle = V6AgentService.prototype.handle, sessions = [];
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), s = reply.snapshot;
  if (message.type === 'advance') {
    const r = s.trace.findLast(e => e.kind === 'actual_outcome'), o = message.observation;
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched,
      reason: r?.reason, owner: r?.family, levels: o.levelsCompleted, acquired,
      packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = s.proposal, plan = p.feedback_plan, step = p.steps[t.actionIndex], selection = plan.selection;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, ref: t.observationRef, level: t.level, id: t.id,
      owner: s.lastDecision, action: t.actionRef, point: t.data, step: step.kind, symbol: step.value, prefix: step.prefix_before,
      expected: step.expected_after, trial: selection.trial, candidates: selection.candidate_count, laws: selection.law_alternatives,
      methodEpoch: selection.recalled_entry?.source_epoch, evidence: plan.evidence,
      guard: s.trace.findLast(e => e.kind === 'before_guard')?.reason });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
