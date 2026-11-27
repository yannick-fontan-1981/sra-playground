import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_STCK_SOURCE: root, SIC_STCK_RECEIPT: output } = process.env;
const load = path => import(pathToFileURL(resolve(root, 'src', path)));
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const { OccurrenceRecallAccess } = await load('logos-engine/v6-occurrence-recall.ts');
const acquire = OccurrenceRecallAccess.prototype.applyEvent;
const handle = V6AgentService.prototype.handle;
const sessions = [];
let events = [];
const kinds = new Set(['marked_collection_result', 'program_composition_reconciled', 'respondent_probe_result', 'observed_respondent_order']);
OccurrenceRecallAccess.prototype.applyEvent = function (event) {
  if (kinds.has(event.kind)) events.push({ kind: event.kind, evidence: event.evidence, matched: event.outcome?.matched,
    anchor: event.continuation?.own_base, restored: event.editing_composition_restored, progression: event.official_progress,
    results: event.results?.map(r => ({ word: r.candidate.object.word, moving: r.matching_packet_indices,
      universal: r.universal_rule_confirmed })), order: event.order?.map(r => [r.word, r.first_effect]) });
  return acquire.call(this, event);
};
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  events = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const ret = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ turn: message.sequence, kind: 'return', ref: ret?.observation_ref, matched: ret?.matched,
      reason: ret?.reason, frames: message.observation.frames.length, events });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal;
    const plan = p.marked_collection_plan ?? p.program_composition_plan ?? p.respondent_probe_plan;
    rows.push({ turn: message.sequence + 1, kind: 'ticket', id: t.id, observation: t.observationRef, level: t.level,
      action: t.actionRef, data: t.data, index: t.actionIndex, family: snapshot.lastDecision, offer: p.kind,
      mode: plan?.mode, initial: plan?.before_collection, word: plan?.word, prepared: plan?.prepared_word });
  } else if (reply.kind === 'stopped') rows.push({ turn: message.sequence + 1, kind: 'stop', reason: snapshot.reason });
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
